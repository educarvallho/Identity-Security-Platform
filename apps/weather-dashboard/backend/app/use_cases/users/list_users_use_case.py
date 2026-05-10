from app.domain.entities.user import User
from app.domain.entities.user import User
from app.domain.exceptions import ForbiddenException
from app.domain.enums import UserRole
from app.infrastructure.database.repositories.interfaces.i_user_repository import IUserRepository


class ListUsersUseCase:
    def __init__(self, user_repo: IUserRepository):
        self._repo = user_repo

    def execute(self, current_user: User) -> list[User]:
        if current_user.role != UserRole.ADMIN:
            raise ForbiddenException("Only admins can list users")
        return self._repo.list_all()
