from abc import ABC, abstractmethod
from typing import Optional
import uuid
from app.domain.entities.user import User
from app.domain.enums import UserRole


class IUserRepository(ABC):
    @abstractmethod
    def get_by_email(self, email: str) -> Optional[User]:
        pass

    @abstractmethod
    def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        pass

    @abstractmethod
    def list_all(self) -> list[User]:
        pass

    @abstractmethod
    def create(self, email: str, hashed_password: str, full_name: str, role: UserRole) -> User:
        pass

    @abstractmethod
    def update(self, user_id: uuid.UUID, full_name: Optional[str], role: Optional[UserRole], is_active: Optional[bool]) -> Optional[User]:
        pass

    @abstractmethod
    def delete(self, user_id: uuid.UUID) -> bool:
        pass

    @abstractmethod
    def count(self) -> int:
        pass
