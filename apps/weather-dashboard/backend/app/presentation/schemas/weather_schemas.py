from datetime import date
from typing import Optional
from pydantic import BaseModel
from app.domain.enums import RiskLevel


class RiskOut(BaseModel):
    score: int
    level: RiskLevel
    reasons: list[str]


class CurrentWeatherOut(BaseModel):
    temperature: float
    apparent_temperature: float
    humidity: int
    wind_speed_kmh: float
    rain_probability: int
    rain_volume_mm: float
    weather_code: int
    risk: RiskOut


class DailyForecastOut(BaseModel):
    date: date
    max_temp: float
    min_temp: float
    rain_probability: int
    rain_volume_mm: float
    max_wind_speed_kmh: float
    weather_code: int
    risk: RiskOut


class CityForecastResponse(BaseModel):
    city_id: int
    city_name: str
    state: str
    current: CurrentWeatherOut
    daily: list[DailyForecastOut]


class LocationWeatherResponse(BaseModel):
    latitude: float
    longitude: float
    nearest_city_name: Optional[str]
    current: CurrentWeatherOut


class LocationForecastResponse(BaseModel):
    latitude: float
    longitude: float
    nearest_city_name: Optional[str]
    current: CurrentWeatherOut
    daily: list[DailyForecastOut]


class IpLocationResponse(BaseModel):
    latitude: float
    longitude: float
    city: Optional[str] = None
    state: Optional[str] = None
    source: str
