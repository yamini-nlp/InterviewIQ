from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class User(BaseModel):
    id: str
    email: str
    name: str
    password_hash: str
    created_at: str
    last_login: Optional[str] = None