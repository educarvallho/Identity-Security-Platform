import math
from app.domain.entities.weather import LocationWeather
from app.infrastructure.database.repositories.interfaces.i_city_repository import ICityRepository
from app.infrastructure.external.open_meteo.client import OpenMeteoClient
from app.infrastructure.external.open_meteo.mappers import map_current


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


class GetLocationWeatherUseCase:
    def __init__(self, city_repo: ICityRepository, weather_client: OpenMeteoClient):
        self._city_repo = city_repo
        self._weather = weather_client

    def execute(self, latitude: float, longitude: float) -> LocationWeather:
        data = self._weather.fetch(latitude, longitude, city_id=None)
        current = map_current(data["current"])

        nearest_city_name = None
        cities = self._city_repo.list_all(active_only=True)
        if cities:
            nearest = min(cities, key=lambda c: _haversine(latitude, longitude, c.latitude, c.longitude))
            nearest_city_name = nearest.name

        return LocationWeather(
            latitude=latitude,
            longitude=longitude,
            nearest_city_name=nearest_city_name,
            current=current,
        )
