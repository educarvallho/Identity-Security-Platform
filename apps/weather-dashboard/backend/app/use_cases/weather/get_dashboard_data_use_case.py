from datetime import datetime, timezone
from app.domain.enums import RiskLevel
from app.infrastructure.database.repositories.interfaces.i_city_repository import ICityRepository
from app.infrastructure.database.repositories.risk_rules_repository import RiskRulesRepository
from app.infrastructure.external.open_meteo.client import OpenMeteoClient
from app.infrastructure.external.open_meteo.mappers import map_current


class GetDashboardDataUseCase:
    def __init__(self, city_repo: ICityRepository, weather_client: OpenMeteoClient, rules_repo: RiskRulesRepository | None = None):
        self._city_repo = city_repo
        self._weather = weather_client
        self._rules_repo = rules_repo

    def execute(self) -> dict:
        all_cities = self._city_repo.list_all(active_only=False)
        active_cities = [c for c in all_cities if c.is_active]

        rules = self._rules_repo.get_rules() if self._rules_repo else None

        city_weather_list = []
        for city in active_cities:
            try:
                data = self._weather.fetch(city.latitude, city.longitude, city_id=city.id)
                current = map_current(data["current"], rules=rules)
                city_weather_list.append({
                    "city_id": city.id,
                    "city_name": city.name,
                    "state": city.state,
                    "current": current,
                    "fetched_at": data.get("fetched_at"),
                })
            except Exception:
                pass

        if not city_weather_list:
            return self._empty_dashboard(len(all_cities), len(active_cities))

        temps = [cw["current"].temperature for cw in city_weather_list]
        rain_probs = [cw["current"].rain_probability for cw in city_weather_list]
        rain_vols = [cw["current"].rain_volume_mm for cw in city_weather_list]
        winds = [cw["current"].wind_speed_kmh for cw in city_weather_list]

        hottest = max(city_weather_list, key=lambda x: x["current"].temperature)
        coldest = min(city_weather_list, key=lambda x: x["current"].temperature)
        most_rain_prob = max(city_weather_list, key=lambda x: x["current"].rain_probability)
        most_rain_vol = max(city_weather_list, key=lambda x: x["current"].rain_volume_mm)
        windiest = max(city_weather_list, key=lambda x: x["current"].wind_speed_kmh)

        risk_ranking = sorted(
            city_weather_list,
            key=lambda x: (x["current"].temperature, x["current"].rain_probability),
            reverse=True,
        )
        high_risk = [cw for cw in city_weather_list if cw["current"].risk.level == RiskLevel.HIGH]

        # Best city = lowest risk score, tiebreak by lowest temperature
        best_city = min(city_weather_list, key=lambda x: (x["current"].risk.score, x["current"].temperature))

        alerts = [
            {
                "city_id": cw["city_id"],
                "city_name": cw["city_name"],
                "risk_level": cw["current"].risk.level.value,
                "risk_score": cw["current"].risk.score,
                "reasons": cw["current"].risk.reasons,
            }
            for cw in city_weather_list
            if cw["current"].risk.level != RiskLevel.LOW
        ]
        alerts.sort(key=lambda a: a["risk_score"], reverse=True)

        fetched_ats = []
        for cw in city_weather_list:
            ft = cw.get("fetched_at")
            if ft is None:
                continue
            if getattr(ft, "tzinfo", None) is None:
                ft = ft.replace(tzinfo=timezone.utc)
            fetched_ats.append(ft)
        last_updated = max(fetched_ats).isoformat() if fetched_ats else datetime.now(timezone.utc).isoformat()

        return {
            "last_updated": last_updated,
            "kpis": {
                "total_cities": len(all_cities),
                "active_cities": len(active_cities),
                "avg_temperature": round(sum(temps) / len(temps), 1) if temps else 0,
                "max_temperature": round(max(temps), 1) if temps else 0,
                "min_temperature": round(min(temps), 1) if temps else 0,
                "avg_rain_probability": round(sum(rain_probs) / len(rain_probs), 0) if rain_probs else 0,
                "high_risk_count": len(high_risk),
                "hottest_city": {"id": hottest["city_id"], "name": hottest["city_name"], "temp": round(hottest["current"].temperature, 1)},
                "coldest_city": {"id": coldest["city_id"], "name": coldest["city_name"], "temp": round(coldest["current"].temperature, 1)},
                "most_rain_prob_city": {"id": most_rain_prob["city_id"], "name": most_rain_prob["city_name"], "prob": most_rain_prob["current"].rain_probability},
                "most_rain_volume_city": {"id": most_rain_vol["city_id"], "name": most_rain_vol["city_name"], "volume": round(most_rain_vol["current"].rain_volume_mm, 1)},
                "windiest_city": {"id": windiest["city_id"], "name": windiest["city_name"], "wind": round(windiest["current"].wind_speed_kmh, 1)},
                "best_operation_city": {"id": best_city["city_id"], "name": best_city["city_name"], "risk_score": best_city["current"].risk.score},
            },
            "risk_ranking": [
                {
                    "city_id": cw["city_id"],
                    "city_name": cw["city_name"],
                    "state": cw["state"],
                    "temperature": round(cw["current"].temperature, 1),
                    "rain_probability": cw["current"].rain_probability,
                    "wind_speed_kmh": round(cw["current"].wind_speed_kmh, 1),
                    "risk_score": cw["current"].risk.score,
                    "risk_level": cw["current"].risk.level.value,
                    "risk_reasons": cw["current"].risk.reasons,
                }
                for cw in risk_ranking
            ],
            "alerts": alerts,
            "temperature_comparison": [
                {"city_id": cw["city_id"], "city_name": cw["city_name"], "temperature": round(cw["current"].temperature, 1)}
                for cw in sorted(city_weather_list, key=lambda x: x["city_name"])
            ],
            "rain_comparison": [
                {"city_id": cw["city_id"], "city_name": cw["city_name"], "rain_probability": cw["current"].rain_probability, "rain_volume_mm": round(cw["current"].rain_volume_mm, 1)}
                for cw in sorted(city_weather_list, key=lambda x: x["city_name"])
            ],
        }

    def _empty_dashboard(self, total: int, active: int) -> dict:
        return {
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "kpis": {"total_cities": total, "active_cities": active, "avg_temperature": 0, "max_temperature": 0, "min_temperature": 0, "avg_rain_probability": 0, "high_risk_count": 0, "hottest_city": None, "coldest_city": None, "most_rain_prob_city": None, "most_rain_volume_city": None, "windiest_city": None, "best_operation_city": None},
            "risk_ranking": [],
            "alerts": [],
            "temperature_comparison": [],
            "rain_comparison": [],
        }
