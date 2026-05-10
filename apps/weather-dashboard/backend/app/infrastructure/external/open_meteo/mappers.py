from datetime import date
from app.domain.entities.weather import CurrentWeather, DailyForecast
from app.domain.entities.risk_rules import RiskRules
from app.use_cases.weather.calculate_risk_use_case import CalculateRiskUseCase

_risk_use_case = CalculateRiskUseCase()


def map_current(current_json: dict, rules: RiskRules | None = None) -> CurrentWeather:
    temperature = current_json.get("temperature_2m", 0.0)
    rain_prob = current_json.get("precipitation_probability", 0)
    wind_speed = current_json.get("wind_speed_10m", 0.0)
    rain_volume = current_json.get("precipitation", 0.0)

    risk = _risk_use_case.execute(temperature, rain_prob, wind_speed, rain_volume, rules=rules)

    return CurrentWeather(
        temperature=temperature,
        apparent_temperature=current_json.get("apparent_temperature", temperature),
        humidity=current_json.get("relative_humidity_2m", 0),
        wind_speed_kmh=wind_speed,
        rain_probability=int(rain_prob),
        rain_volume_mm=rain_volume,
        weather_code=current_json.get("weather_code", 0),
        risk=risk,
    )


def map_daily(daily_json: dict, rules: RiskRules | None = None) -> list[DailyForecast]:
    dates = daily_json.get("time", [])
    max_temps = daily_json.get("temperature_2m_max", [])
    min_temps = daily_json.get("temperature_2m_min", [])
    rain_probs = daily_json.get("precipitation_probability_max", [])
    rain_vols = daily_json.get("precipitation_sum", [])
    wind_speeds = daily_json.get("wind_speed_10m_max", [])
    weather_codes = daily_json.get("weather_code", [])

    results = []
    for i, d in enumerate(dates):
        max_t = max_temps[i] if i < len(max_temps) else 0.0
        min_t = min_temps[i] if i < len(min_temps) else 0.0
        rain_p = rain_probs[i] if i < len(rain_probs) else 0
        rain_v = rain_vols[i] if i < len(rain_vols) else 0.0
        wind = wind_speeds[i] if i < len(wind_speeds) else 0.0
        code = weather_codes[i] if i < len(weather_codes) else 0
        avg_temp = (max_t + min_t) / 2
        risk = _risk_use_case.execute(avg_temp, rain_p or 0, wind or 0, rain_v or 0, rules=rules)
        results.append(DailyForecast(
            date=date.fromisoformat(d),
            max_temp=max_t or 0.0,
            min_temp=min_t or 0.0,
            rain_probability=int(rain_p or 0),
            rain_volume_mm=rain_v or 0.0,
            max_wind_speed_kmh=wind or 0.0,
            weather_code=code or 0,
            risk=risk,
        ))
    return results
