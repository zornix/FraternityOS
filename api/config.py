from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    FRONTEND_URL: str = "https://fraternyos.vercel.app"
    BASE_URL: str = "https://fraternityos.vercel.app"
    CHECKIN_LINK_TTL_MINUTES: int = 10

    class Config:
        env_file = ".env"


settings = Settings()
