from app.domain.entities.weather import CityWeather
from app.domain.exceptions import NotFoundException
from app.infrastructure.database.repositories.interfaces.i_city_repository import ICityRepository
from app.infrastructure.external.open_meteo.client import OpenMeteoClient
from app.infrastructure.external.open_meteo.mappers import map_current, map_daily


class GetCityForecastUseCase:
    def __init__(self, city_repo: ICityRepository, weather_client: OpenMeteoClient):
        self._city_repo = city_repo
        self._weather = weather_client

    def execute(self, city_id: int) -> CityWeather:
        city = self._city_repo.get_by_id(city_id)
        if not city:
            raise NotFoundException("City")

        data = self._weather.fetch(city.latitude, city.longitude, city_id=city.id)
        current = map_current(data["current"])
        daily = map_daily(data["daily"])

        return CityWeather(
            city_id=city.id,
            city_name=city.name,
            state=city.state,
            current=current,
            daily=daily,
        )
