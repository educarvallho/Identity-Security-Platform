import logging
import time
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Request, status

logger = logging.getLogger(__name__)
from app.domain.exceptions import InvalidCredentialsException, InactiveUserException
from app.infrastructure.database.repositories.user_repository import UserRepository
from app.infrastructure.security.jwt_handler import JWTHandler
from app.infrastructure.security.password_hasher import PasswordHasher
from app.presentation.dependencies import get_user_repository, get_jwt_handler, get_password_hasher, get_current_user
from app.presentation.schemas.auth_schemas import LoginRequest, LoginResponse, UserOut
from app.use_cases.auth.login_use_case import LoginUseCase
from app.domain.entities.user import User

router = APIRouter(prefix="/auth", tags=["auth"])

_login_attempts: dict[str, list[float]] = defaultdict(list)
_RATE_WINDOW_SECONDS = 60
_RATE_MAX_ATTEMPTS = 5


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP", "").strip()
    return forwarded or real_ip or (request.client.host if request.client else "unknown")


def _check_login_rate_limit(ip: str, email: str) -> None:
    now = time.time()
    _login_attempts[ip] = [t for t in _login_attempts[ip] if now - t < _RATE_WINDOW_SECONDS]
    if len(_login_attempts[ip]) >= _RATE_MAX_ATTEMPTS:
        logger.warning("login_rate_limited ip=%s email=%s", ip, email)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas de login. Aguarde 1 minuto e tente novamente.",
        )
    _login_attempts[ip].append(now)


@router.post("/login", response_model=LoginResponse)
def login(
    request: Request,
    body: LoginRequest,
    user_repo: UserRepository = Depends(get_user_repository),
    jwt_handler: JWTHandler = Depends(get_jwt_handler),
    password_hasher: PasswordHasher = Depends(get_password_hasher),
):
    client_ip = _get_client_ip(request)
    _check_login_rate_limit(client_ip, body.email)
    use_case = LoginUseCase(user_repo, jwt_handler, password_hasher)
    try:
        result = use_case.execute(body.email, body.password)
        user = result["user"]
        logger.info("login_success email=%s role=%s", user.email, user.role)
        return LoginResponse(
            access_token=result["access_token"],
            token_type="bearer",
            user=UserOut(id=str(user.id), email=user.email, full_name=user.full_name, role=user.role, is_active=user.is_active),
        )
    except InvalidCredentialsException:
        logger.warning("login_failed email=%s reason=invalid_credentials", body.email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou senha inválidos")
    except InactiveUserException:
        logger.warning("login_failed email=%s reason=inactive_account", body.email)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conta desativada")


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut(id=str(current_user.id), email=current_user.email, full_name=current_user.full_name, role=current_user.role, is_active=current_user.is_active)
