import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from app.domain.entities.user import User
from app.domain.exceptions import ForbiddenException, NotFoundException
from app.infrastructure.database.repositories.user_repository import UserRepository
from app.infrastructure.security.password_hasher import PasswordHasher
from app.presentation.dependencies import get_user_repository, get_password_hasher, require_admin
from app.presentation.schemas.user_schemas import UserDetailOut, UserCreateRequest, UserUpdateRequest
from app.use_cases.users.list_users_use_case import ListUsersUseCase
from app.use_cases.users.create_user_use_case import CreateUserUseCase
from app.use_cases.users.update_user_use_case import UpdateUserUseCase
from app.use_cases.users.delete_user_use_case import DeleteUserUseCase

router = APIRouter(prefix="/users", tags=["users"])


def _to_out(user: User) -> UserDetailOut:
    return UserDetailOut(id=str(user.id), email=user.email, full_name=user.full_name, role=user.role, is_active=user.is_active, created_at=user.created_at)


@router.get("", response_model=list[UserDetailOut])
def list_users(
    user_repo: UserRepository = Depends(get_user_repository),
    current_user: User = Depends(require_admin),
):
    return [_to_out(u) for u in ListUsersUseCase(user_repo).execute(current_user)]


@router.post("", response_model=UserDetailOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreateRequest,
    user_repo: UserRepository = Depends(get_user_repository),
    password_hasher: PasswordHasher = Depends(get_password_hasher),
    current_user: User = Depends(require_admin),
):
    try:
        return _to_out(CreateUserUseCase(user_repo, password_hasher).execute(current_user, body.email, body.full_name, body.password, body.role))
    except ForbiddenException as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao criar usuário: {str(e)}")


@router.put("/{user_id}", response_model=UserDetailOut)
def update_user(
    user_id: str,
    body: UserUpdateRequest,
    user_repo: UserRepository = Depends(get_user_repository),
    current_user: User = Depends(require_admin),
):
    try:
        return _to_out(UpdateUserUseCase(user_repo).execute(current_user, uuid.UUID(user_id), body.full_name, body.role, body.is_active))
    except (ForbiddenException, NotFoundException) as e:
        code = 403 if isinstance(e, ForbiddenException) else 404
        raise HTTPException(status_code=code, detail=str(e))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    user_repo: UserRepository = Depends(get_user_repository),
    current_user: User = Depends(require_admin),
):
    try:
        DeleteUserUseCase(user_repo).execute(current_user, uuid.UUID(user_id))
    except (ForbiddenException, NotFoundException) as e:
        code = 403 if isinstance(e, ForbiddenException) else 404
        raise HTTPException(status_code=code, detail=str(e))
