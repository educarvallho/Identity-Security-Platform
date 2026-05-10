from app.domain.entities.city import City
from app.domain.exceptions import NotFoundException
from app.infrastructure.database.repositories.interfaces.i_city_repository import ICityRepository


class GetCityUseCase:
    def __init__(self, city_repo: ICityRepository):
        self._repo = city_repo

    def execute(self, city_id: int) -> City:
        city = self._repo.get_by_id(city_id)
        if not city:
            raise NotFoundException("City")
        return city
