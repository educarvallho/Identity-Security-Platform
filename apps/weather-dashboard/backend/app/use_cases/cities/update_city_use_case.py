from typing import Optional
from app.domain.entities.city import City
from app.domain.entities.user import User
from app.domain.enums import UserRole
from app.domain.exceptions import ForbiddenException, NotFoundException
from app.infrastructure.database.repositories.interfaces.i_city_repository import ICityRepository


class UpdateCityUseCase:
    def __init__(self, city_repo: ICityRepository):
        self._repo = city_repo

    def execute(self, current_user: User, city_id: int, name: Optional[str] = None, state: Optional[str] = None, country: Optional[str] = None, latitude: Optional[float] = None, longitude: Optional[float] = None) -> City:
        if current_user.role not in (UserRole.ADMIN, UserRole.OPERATOR):
            raise ForbiddenException("Only admins and operators can edit cities")
        city = self._repo.update(city_id, name, state, country, latitude, longitude)
        if not city:
            raise NotFoundException("City")
        return city
