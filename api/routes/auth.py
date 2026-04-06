from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.dependencies import get_current_user
from api.models.schemas import UserProfile
from api.db import get_supabase
from api.config import settings

router = APIRouter()


class LoginRequest(BaseModel):
    email: str


@router.post("/login")
async def login(body: LoginRequest):
    """
    Demo auth: enter any member email to log in.
    Officers get full access; regular members get read-only access.
    Returns a JWT — no password required.
    """
    import jwt as pyjwt

    sb = get_supabase()
    result = (
        sb.table("members")
        .select("id, name, email, role, chapter_id")
        .eq("email", body.email)
        .eq("status", "active")
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(401, "No active member found with that email")

    member = result.data

    token = pyjwt.encode(
        {"sub": member["id"], "exp": datetime.now(timezone.utc) + timedelta(days=30)},
        settings.JWT_SECRET,
        algorithm="HS256",
    )
    return {"access_token": token, "token_type": "bearer"}


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
