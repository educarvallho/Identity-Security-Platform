import uuid
import pytest
from unittest.mock import MagicMock
from datetime import datetime, timezone
from app.domain.entities.user import User
from app.domain.entities.city import City
from app.domain.enums import UserRole
from app.domain.exceptions import ForbiddenException
from app.use_cases.cities.create_city_use_case import CreateCityUseCase
from app.use_cases.cities.list_cities_use_case import ListCitiesUseCase
from app.use_cases.cities.toggle_city_active_use_case import ToggleCityActiveUseCase


def _make_user(role: UserRole) -> User:
    now = datetime.now(timezone.utc)
    return User(id=uuid.uuid4(), email="u@u.com", hashed_password="h", full_name="U", role=role, is_active=True, created_at=now, updated_at=now)


def _make_city(is_active=True) -> City:
    now = datetime.now(timezone.utc)
    return City(id=1, name="Test City", state="SP", country="Brasil", latitude=-23.5, longitude=-46.6, is_active=is_active, created_by=None, created_at=now, updated_at=now)


def test_list_cities_active_only():
    repo = MagicMock()
    repo.list_all.return_value = []
    ListCitiesUseCase(repo).execute(active_only=True)
    repo.list_all.assert_called_once_with(active_only=True)


def test_list_cities_all():
    repo = MagicMock()
    repo.list_all.return_value = []
    ListCitiesUseCase(repo).execute(active_only=False)
    repo.list_all.assert_called_once_with(active_only=False)


def test_operator_can_create_city():
    repo = MagicMock()
    repo.create.return_value = _make_city()
    user = _make_user(UserRole.OPERATOR)
    result = CreateCityUseCase(repo).execute(user, "Test", "SP", "Brasil", -23.5, -46.6)
    assert result is not None
    repo.create.assert_called_once()


def test_admin_can_create_city():
    repo = MagicMock()
    repo.create.return_value = _make_city()
    user = _make_user(UserRole.ADMIN)
    result = CreateCityUseCase(repo).execute(user, "Test", "SP", "Brasil", -23.5, -46.6)
    assert result is not None


def test_viewer_cannot_create_city():
    repo = MagicMock()
    user = _make_user(UserRole.VIEWER)
    with pytest.raises(ForbiddenException):
        CreateCityUseCase(repo).execute(user, "Test", "SP", "Brasil", -23.5, -46.6)


def test_toggle_active_to_inactive():
    city = _make_city(is_active=True)
    toggled = _make_city(is_active=False)
    repo = MagicMock()
    repo.toggle_active.return_value = toggled
    user = _make_user(UserRole.ADMIN)
    result = ToggleCityActiveUseCase(repo).execute(user, 1)
    assert result.is_active is False


def test_toggle_inactive_to_active():
    city = _make_city(is_active=False)
    toggled = _make_city(is_active=True)
    repo = MagicMock()
    repo.toggle_active.return_value = toggled
    user = _make_user(UserRole.OPERATOR)
    result = ToggleCityActiveUseCase(repo).execute(user, 1)
    assert result.is_active is True


def test_viewer_cannot_toggle():
    repo = MagicMock()
    user = _make_user(UserRole.VIEWER)
    with pytest.raises(ForbiddenException):
        ToggleCityActiveUseCase(repo).execute(user, 1)
