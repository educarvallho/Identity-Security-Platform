import uuid
import pytest
from unittest.mock import MagicMock
from datetime import datetime, timezone
from app.domain.entities.user import User
from app.domain.enums import UserRole
from app.domain.exceptions import InvalidCredentialsException, InactiveUserException
from app.use_cases.auth.login_use_case import LoginUseCase
from app.infrastructure.security.password_hasher import PasswordHasher
from app.infrastructure.security.jwt_handler import JWTHandler


def _make_user(role=UserRole.VIEWER, is_active=True) -> User:
    now = datetime.now(timezone.utc)
    return User(id=uuid.uuid4(), email="test@test.com", hashed_password="hashed", full_name="Test", role=role, is_active=is_active, created_at=now, updated_at=now)


def test_valid_login_returns_token():
    user = _make_user()
    repo = MagicMock()
    repo.get_by_email.return_value = user
    hasher = MagicMock()
    hasher.verify.return_value = True
    jwt = MagicMock()
    jwt.create_access_token.return_value = "token123"

    result = LoginUseCase(repo, jwt, hasher).execute("test@test.com", "pass")

    assert result["access_token"] == "token123"
    assert result["user"] == user


def test_wrong_password_raises():
    user = _make_user()
    repo = MagicMock()
    repo.get_by_email.return_value = user
    hasher = MagicMock()
    hasher.verify.return_value = False
    jwt = MagicMock()

    with pytest.raises(InvalidCredentialsException):
        LoginUseCase(repo, jwt, hasher).execute("test@test.com", "wrong")


def test_nonexistent_user_raises_same_error():
    repo = MagicMock()
    repo.get_by_email.return_value = None
    hasher = MagicMock()
    hasher.verify.return_value = False
    jwt = MagicMock()

    with pytest.raises(InvalidCredentialsException):
        LoginUseCase(repo, jwt, hasher).execute("nobody@test.com", "pass")


def test_inactive_user_raises():
    user = _make_user(is_active=False)
    repo = MagicMock()
    repo.get_by_email.return_value = user
    hasher = MagicMock()
    hasher.verify.return_value = True
    jwt = MagicMock()

    with pytest.raises(InactiveUserException):
        LoginUseCase(repo, jwt, hasher).execute("test@test.com", "pass")


def test_jwt_handler_creates_decodable_token():
    import os
    os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
    os.environ.setdefault("SECRET_KEY", "test_secret_key_must_be_32_chars!")
    os.environ.setdefault("OPENAI_API_KEY", "")

    handler = JWTHandler()
    user_id = uuid.uuid4()
    token = handler.create_access_token(user_id, "admin")
    decoded_id = handler.get_user_id_from_token(token)
    assert decoded_id == user_id
