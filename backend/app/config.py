from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    groq_api_key: str
    environment: str = "development"
    mongodb_url: str = "mongodb://localhost:27017"
    db_name: str = "interviewiq"
    allowed_origins: str = "http://localhost:3000"
    allowed_hosts: str = "localhost,127.0.0.1"
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    rate_limit_login: int = 5
    rate_limit_window_seconds: int = 60
    account_lockout_threshold: int = 5
    account_lockout_duration_minutes: int = 15
    redis_url: str = "redis://localhost:6379"
    mlim_clarification_entropy_threshold: float = 1.5
    mlim_context_horizon_k: int = 5
    metrics_enabled: bool = True

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

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


settings = Settings()