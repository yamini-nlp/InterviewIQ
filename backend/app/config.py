from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    groq_api_key: str
    mongodb_url: str = "mongodb://localhost:27017"
    db_name: str = "interviewiq"
    allowed_origins: str = "http://localhost:3000"
    jwt_secret: str = "change-this-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    class Config:
        env_file = ".env"

settings = Settings()