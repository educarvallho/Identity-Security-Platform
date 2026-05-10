from app.domain.entities.user import User
from app.domain.enums import UserRole
from app.domain.exceptions import ForbiddenException
from app.infrastructure.database.repositories.interfaces.i_user_repository import IUserRepository
from app.infrastructure.security.password_hasher import PasswordHasher


class CreateUserUseCase:
    def __init__(self, user_repo: IUserRepository, password_hasher: PasswordHasher):
        self._repo = user_repo
        self._hasher = password_hasher

    def execute(self, current_user: User, email: str, full_name: str, password: str, role: UserRole) -> User:
        if current_user.role != UserRole.ADMIN:
            raise ForbiddenException("Only admins can create users")
        hashed = self._hasher.hash(password)
        return self._repo.create(email=email, hashed_password=hashed, full_name=full_name, role=role)
