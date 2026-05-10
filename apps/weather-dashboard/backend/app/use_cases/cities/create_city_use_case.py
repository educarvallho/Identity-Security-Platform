import uuid
from typing import Optional
from app.domain.entities.city import City
from app.domain.entities.user import User
from app.domain.enums import UserRole
from app.domain.exceptions import ForbiddenException
from app.infrastructure.database.repositories.interfaces.i_city_repository import ICityRepository


class CreateCityUseCase:
    def __init__(self, city_repo: ICityRepository):
        self._repo = city_repo

    def execute(self, current_user: User, name: str, state: str, country: str, latitude: float, longitude: float) -> City:
        if current_user.role not in (UserRole.ADMIN, UserRole.OPERATOR):
            raise ForbiddenException("Only admins and operators can add cities")
        return self._repo.create(
            name=name, state=state, country=country,
            latitude=latitude, longitude=longitude,
            created_by=current_user.id,
        )
