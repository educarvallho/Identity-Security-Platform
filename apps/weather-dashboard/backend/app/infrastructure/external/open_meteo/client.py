from datetime import datetime, timedelta, timezone
from typing import Optional
import httpx
from sqlalchemy.orm import Session
from app.infrastructure.database.models.weather_cache_model import WeatherCacheModel

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
CURRENT_CACHE_MINUTES = 15
FORECAST_CACHE_HOURS = 1

CURRENT_PARAMS = "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation_probability,precipitation,weather_code"
DAILY_PARAMS = "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,weather_code"


class OpenMeteoClient:
    def __init__(self, db: Session):
        self._db = db

    def _round_coords(self, lat: float, lon: float) -> tuple[float, float]:
        return round(lat, 3), round(lon, 3)

    def _get_cached(self, city_id: Optional[int], lat: float, lon: float) -> Optional[dict]:
        now = datetime.now(timezone.utc)
        query = self._db.query(WeatherCacheModel).filter(WeatherCacheModel.expires_at > now)
        if city_id is not None:
            query = query.filter(WeatherCacheModel.city_id == city_id)
        else:
            lat_r, lon_r = self._round_coords(lat, lon)
            query = query.filter(
                WeatherCacheModel.latitude == lat_r,
                WeatherCacheModel.longitude == lon_r,
                WeatherCacheModel.city_id == None,
            )
        cached = query.order_by(WeatherCacheModel.fetched_at.desc()).first()
        if cached:
            return {"current": cached.current_json, "daily": cached.forecast_json, "fetched_at": cached.fetched_at}
        return None

    def _save_cache(self, city_id: Optional[int], lat: float, lon: float, current_json: dict, forecast_json: dict) -> datetime:
        now = datetime.now(timezone.utc)
        lat_r, lon_r = self._round_coords(lat, lon)
        self._db.query(WeatherCacheModel).filter(
            WeatherCacheModel.city_id == city_id,
            WeatherCacheModel.latitude == lat_r,
            WeatherCacheModel.longitude == lon_r,
        ).delete()
        cache = WeatherCacheModel(
            city_id=city_id,
            latitude=lat_r,
            longitude=lon_r,
            fetched_at=now,
            expires_at=now + timedelta(minutes=CURRENT_CACHE_MINUTES),
            current_json=current_json,
            forecast_json=forecast_json,
        )
        self._db.add(cache)
        self._db.commit()
        return now

    def fetch(self, lat: float, lon: float, city_id: Optional[int] = None) -> dict:
        cached = self._get_cached(city_id, lat, lon)
        if cached:
            return cached

        params = {
            "latitude": lat,
            "longitude": lon,
            "current": CURRENT_PARAMS,
            "daily": DAILY_PARAMS,
            "forecast_days": 7,
            "timezone": "America/Sao_Paulo",
            "wind_speed_unit": "kmh",
        }
        with httpx.Client(timeout=10.0) as client:
            response = client.get(OPEN_METEO_URL, params=params)
            response.raise_for_status()
            data = response.json()

        current_json = data.get("current", {})
        daily_json = data.get("daily", {})
        fetched_at = self._save_cache(city_id, lat, lon, current_json, daily_json)
        return {"current": current_json, "daily": daily_json, "fetched_at": fetched_at}
