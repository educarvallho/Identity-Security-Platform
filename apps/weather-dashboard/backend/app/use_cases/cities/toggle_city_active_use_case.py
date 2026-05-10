from app.domain.entities.city import City
from app.domain.entities.user import User
from app.domain.enums import UserRole
from app.domain.exceptions import ForbiddenException, NotFoundException
from app.infrastructure.database.repositories.interfaces.i_city_repository import ICityRepository


class ToggleCityActiveUseCase:
    def __init__(self, city_repo: ICityRepository):
        self._repo = city_repo

    def execute(self, current_user: User, city_id: int) -> City:
        if current_user.role not in (UserRole.ADMIN, UserRole.OPERATOR):
            raise ForbiddenException("Only admins and operators can toggle city status")
        city = self._repo.toggle_active(city_id)
        if not city:
            raise NotFoundException("City")
        return city
