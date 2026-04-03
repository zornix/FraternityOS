from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_current_user, require_officer
from api.models.schemas import InviteRequest, UserProfile
from api.db import get_supabase_admin

router = APIRouter()


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
