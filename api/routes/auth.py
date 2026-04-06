from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.dependencies import get_current_user, require_officer
from api.models.schemas import InviteRequest, UserProfile
from api.db import get_supabase, get_supabase_admin
from api.config import settings

router = APIRouter()


class LoginRequest(BaseModel):
    email: str


@router.post("/login")
async def login(body: LoginRequest):
    """
    Authenticate by email.
    - Local dev (DATABASE_URL set): returns JWT directly.
    - Production (Supabase): returns ok:true so the browser sends the magic link (PKCE).
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
        # Same message whether missing member or not (avoid email enumeration).
        # `ok: false` means do not start a browser OTP flow (no verifier was created).
        return {
            "message": "If an account exists, a magic link has been sent to your email.",
            "ok": False,
        }

    # Magic link must be started in the same browser that opens the email link.
    # Server-side sign_in_with_otp + PKCE puts ?code= in the URL but no code_verifier
    # in this browser, so exchange fails and the user stays on the login screen.
    return {
        "message": "If an account exists, a magic link has been sent to your email.",
        "ok": True,
    }


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
