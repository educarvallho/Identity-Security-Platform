import uuid
from app.domain.entities.user import User
from app.domain.exceptions import InvalidTokenException, NotFoundException
from app.infrastructure.database.repositories.interfaces.i_user_repository import IUserRepository
from app.infrastructure.security.jwt_handler import JWTHandler


class GetCurrentUserUseCase:
    def __init__(self, user_repo: IUserRepository, jwt_handler: JWTHandler):
        self._repo = user_repo
        self._jwt = jwt_handler

    def execute(self, token: str) -> User:
        user_id = self._jwt.get_user_id_from_token(token)
        user = self._repo.get_by_id(user_id)
        if not user:
            raise NotFoundException("User")
        return user
