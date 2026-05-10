import uuid
from app.domain.entities.user import User
from app.domain.enums import UserRole
from app.domain.exceptions import ForbiddenException, NotFoundException
from app.infrastructure.database.repositories.interfaces.i_user_repository import IUserRepository


class DeleteUserUseCase:
    def __init__(self, user_repo: IUserRepository):
        self._repo = user_repo

    def execute(self, current_user: User, target_id: uuid.UUID) -> None:
        if current_user.role != UserRole.ADMIN:
            raise ForbiddenException("Only admins can delete users")
        deleted = self._repo.delete(target_id)
        if not deleted:
            raise NotFoundException("User")
