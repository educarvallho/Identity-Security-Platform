from dataclasses import dataclass
from datetime import datetime
import uuid
from app.domain.enums import UserRole


@dataclass
class User:
    id: uuid.UUID
    email: str
    hashed_password: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime
