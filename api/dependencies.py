from fastapi import Depends, HTTPException, Header

from api.db import get_supabase


async def get_current_user(authorization: str = Header(...)):
    """Extract and validate JWT, return member record."""
    token = authorization.replace("Bearer ", "")
    sb = get_supabase()

    try:
        auth_response = sb.auth.get_user(token)
        auth_user = auth_response.user
    except Exception:
        raise HTTPException(401, "Invalid or expired token")

    result = (
        sb.table("members")
        .select("*, chapters(*)")
        .eq("auth_id", str(auth_user.id))
        .eq("status", "active")
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(403, "No active membership found")

    return result.data


async def require_officer(user=Depends(get_current_user)):
    """Dependency that restricts endpoint to officers only."""
    if user["role"] != "officer":
        raise HTTPException(403, "Officer access required")
    return user
