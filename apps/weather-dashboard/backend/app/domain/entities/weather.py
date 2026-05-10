from dataclasses import dataclass, field
from datetime import date
from typing import Optional
from app.domain.enums import RiskLevel


@dataclass
class RiskResult:
    score: int
    level: RiskLevel
    reasons: list[str] = field(default_factory=list)


@dataclass
class CurrentWeather:
    temperature: float
    apparent_temperature: float
    humidity: int
    wind_speed_kmh: float
    rain_probability: int
    rain_volume_mm: float
    weather_code: int
    risk: RiskResult


@dataclass
class DailyForecast:
    date: date
    max_temp: float
    min_temp: float
    rain_probability: int
    rain_volume_mm: float
    max_wind_speed_kmh: float
    weather_code: int
    risk: RiskResult


@dataclass
class CityWeather:
    city_id: int
    city_name: str
    state: str
    current: CurrentWeather
    daily: list[DailyForecast] = field(default_factory=list)


@dataclass
class LocationWeather:
    latitude: float
    longitude: float
    nearest_city_name: Optional[str]
    current: CurrentWeather
