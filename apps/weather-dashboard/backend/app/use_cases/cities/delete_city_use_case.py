from app.domain.entities.user import User
from app.domain.enums import UserRole
from app.domain.exceptions import ForbiddenException, NotFoundException
from app.infrastructure.database.repositories.interfaces.i_city_repository import ICityRepository


class DeleteCityUseCase:
    def __init__(self, city_repo: ICityRepository):
        self._repo = city_repo

    def execute(self, current_user: User, city_id: int) -> None:
        if current_user.role != UserRole.ADMIN:
            raise ForbiddenException("Only admins can delete cities")
        deleted = self._repo.delete(city_id)
        if not deleted:
            raise NotFoundException("City")
