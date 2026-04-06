import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.dependencies import get_current_user, require_officer
from api.models.schemas import InviteRequest, UserProfile
from api.db import get_supabase, get_supabase_admin
from api.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


class LoginRequest(BaseModel):
    email: str


@router.post("/login")
async def login(body: LoginRequest):
    """
    Authenticate by email.
    - Local dev (DATABASE_URL set): returns JWT directly.
    - Production (Supabase): sends magic link email.
    """
    if settings.use_local_db:
        import jwt as pyjwt

        sb = get_supabase()
        result = (
            sb.table("members")
            .select("id, auth_id, name, email, role, chapter_id")
            .eq("email", body.email)
            .eq("status", "active")
            .single()
            .execute()
        )
        if not result.data:
            raise HTTPException(404, "No active member with that email")

        member = result.data
        token = pyjwt.encode(
            {"sub": member["auth_id"], "exp": datetime.now(timezone.utc) + timedelta(days=30)},
            settings.JWT_SECRET,
            algorithm="HS256",
        )
        return {"access_token": token, "token_type": "bearer"}

    # Production: send magic link email via GoTrue.
    # admin.generate_link() only *builds* a URL for custom mailers — it does not send email.
    sb_admin = get_supabase_admin()
    member = (
        sb_admin.table("members")
        .select("id")
        .eq("email", body.email)
        .eq("status", "active")
        .maybe_single()
        .execute()
    )
    if not member.data:
        # Same opaque response whether missing member or not (avoid email enumeration).
        return {"message": "If an account exists, a magic link has been sent to your email."}

    try:
        sb = get_supabase()
        sb.auth.sign_in_with_otp({
            "email": body.email,
            "options": {
                "email_redirect_to": settings.FRONTEND_URL,
                "should_create_user": True,
            },
        })
    except Exception:
        logger.exception("sign_in_with_otp failed for %s", body.email)

    return {"message": "If an account exists, a magic link has been sent to your email."}


@router.get("/me", response_model=UserProfile)
async def get_me(user=Depends(get_current_user)):
    """Get current user's profile."""
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "chapter_id": user["chapter_id"],
        "chapter_name": user.get("chapters", {}).get("name"),
    }


@router.post("/invite")
async def invite_members(body: InviteRequest, officer=Depends(require_officer)):
    """Bulk invite members via magic link email."""
    sb = get_supabase_admin()
    results = {"invited": [], "failed": []}

    for email in body.emails:
        try:
            sb.auth.admin.invite_user_by_email(str(email))

            sb.table("members").upsert({
                "email": str(email),
                "chapter_id": officer["chapter_id"],
                "name": str(email).split("@")[0],
                "role": "member",
                "status": "active",
            }, on_conflict="email").execute()

            results["invited"].append(str(email))
        except Exception as e:
            results["failed"].append({"email": str(email), "error": str(e)})

    return results
