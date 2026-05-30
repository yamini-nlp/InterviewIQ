from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    groq_api_key: str
    mongodb_url: str = "mongodb://localhost:27017"
    db_name: str = "interviewiq"
    allowed_origins: str = "http://localhost:3000"
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    rate_limit_login: int = 5
    rate_limit_window_seconds: int = 60
    redis_url: str = "redis://localhost:6379"

    @field_validator("jwt_secret")
    @classmethod
    def jwt_secret_must_be_strong(cls, v: str) -> str:
        if v == "change-this-in-production" or len(v) < 32:
            raise ValueError(
                "JWT_SECRET must be at least 32 characters and not the default value"
            )
        return v

    @field_validator("groq_api_key")
    @classmethod
    def groq_key_required(cls, v: str) -> str:
        if not v or v.strip() == "":
            raise ValueError("GROQ_API_KEY is required")
        return v

    class Config:
        env_file = ".env"


settings = Settings()