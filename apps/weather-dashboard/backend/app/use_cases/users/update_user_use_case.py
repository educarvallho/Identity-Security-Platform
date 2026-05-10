import uuid
from typing import Optional
from app.domain.entities.user import User
from app.domain.enums import UserRole
from app.domain.exceptions import ForbiddenException, NotFoundException
from app.infrastructure.database.repositories.interfaces.i_user_repository import IUserRepository


class UpdateUserUseCase:
    def __init__(self, user_repo: IUserRepository):
        self._repo = user_repo

    def execute(self, current_user: User, target_id: uuid.UUID, full_name: Optional[str], role: Optional[UserRole], is_active: Optional[bool]) -> User:
        if current_user.role != UserRole.ADMIN:
            raise ForbiddenException("Only admins can update users")
        user = self._repo.update(target_id, full_name, role, is_active)
        if not user:
            raise NotFoundException("User")
        return user
