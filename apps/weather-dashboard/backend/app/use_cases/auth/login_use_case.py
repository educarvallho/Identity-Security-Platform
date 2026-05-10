from app.domain.entities.user import User
from app.domain.exceptions import InvalidCredentialsException, InactiveUserException
from app.infrastructure.database.repositories.interfaces.i_user_repository import IUserRepository
from app.infrastructure.security.jwt_handler import JWTHandler
from app.infrastructure.security.password_hasher import PasswordHasher


class LoginUseCase:
    def __init__(self, user_repo: IUserRepository, jwt_handler: JWTHandler, password_hasher: PasswordHasher):
        self._repo = user_repo
        self._jwt = jwt_handler
        self._hasher = password_hasher

    def execute(self, email: str, password: str) -> dict:
        user = self._repo.get_by_email(email)
        if not user or not self._hasher.verify(password, user.hashed_password):
            raise InvalidCredentialsException("Invalid email or password")
        if not user.is_active:
            raise InactiveUserException("User account is disabled")
        token = self._jwt.create_access_token(user.id, user.role.value)
        return {"access_token": token, "token_type": "bearer", "user": user}
