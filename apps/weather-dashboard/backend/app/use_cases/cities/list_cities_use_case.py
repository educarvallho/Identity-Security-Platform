from app.domain.entities.city import City
from app.infrastructure.database.repositories.interfaces.i_city_repository import ICityRepository


class ListCitiesUseCase:
    def __init__(self, city_repo: ICityRepository):
        self._repo = city_repo

    def execute(self, active_only: bool = False) -> list[City]:
        return self._repo.list_all(active_only=active_only)
