from supabase import create_client, Client

from api.config import settings


def get_supabase() -> Client:
    """Anon client — respects RLS, used with user JWT."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)


def get_supabase_admin() -> Client:
    """Service role client — bypasses RLS, used for admin ops like invite."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
