from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.domain.entities.user import User
from app.domain.enums import UserRole
from app.domain.exceptions import (
    InvalidCredentialsException, InactiveUserException, ForbiddenException,
    TokenExpiredException, InvalidTokenException, NotFoundException,
)
from app.infrastructure.database.connection import get_db
from app.infrastructure.database.repositories.user_repository import UserRepository
from app.infrastructure.database.repositories.city_repository import CityRepository
from app.infrastructure.database.repositories.risk_rules_repository import RiskRulesRepository
from app.infrastructure.external.open_meteo.client import OpenMeteoClient
from app.infrastructure.external.openai.client import OpenAIClient
from app.infrastructure.security.jwt_handler import JWTHandler
from app.infrastructure.security.password_hasher import PasswordHasher

bearer_scheme = HTTPBearer()

_jwt_handler = JWTHandler()
_password_hasher = PasswordHasher()
_openai_client = OpenAIClient()


def get_user_repository(db: Session = Depends(get_db)) -> UserRepository:
    return UserRepository(db)


def get_city_repository(db: Session = Depends(get_db)) -> CityRepository:
    return CityRepository(db)


def get_rules_repository(db: Session = Depends(get_db)) -> RiskRulesRepository:
    return RiskRulesRepository(db)


def get_weather_client(db: Session = Depends(get_db)) -> OpenMeteoClient:
    return OpenMeteoClient(db)


def get_jwt_handler() -> JWTHandler:
    return _jwt_handler


def get_password_hasher() -> PasswordHasher:
    return _password_hasher


def get_openai_client() -> OpenAIClient:
    return _openai_client


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    user_repo: UserRepository = Depends(get_user_repository),
    jwt_handler: JWTHandler = Depends(get_jwt_handler),
) -> User:
    token = credentials.credentials
    try:
        user_id = jwt_handler.get_user_id_from_token(token)
        user = user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account disabled")
        return user
    except TokenExpiredException:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except (InvalidTokenException, Exception):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def require_admin_or_operator(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.ADMIN, UserRole.OPERATOR):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin or operator access required")
    return current_user
