from app.domain.entities.risk_rules import RiskRules
from app.infrastructure.database.repositories.risk_rules_repository import RiskRulesRepository


class GetRulesUseCase:
    def __init__(self, rules_repo: RiskRulesRepository):
        self._repo = rules_repo

    def execute(self) -> dict:
        row = self._repo.get_row()
        if row is None:
            defaults = RiskRules()
            return {
                "rain_prob_high": defaults.rain_prob_high,
                "rain_prob_medium": defaults.rain_prob_medium,
                "wind_high": defaults.wind_high,
                "wind_medium": defaults.wind_medium,
                "temp_extreme_high": defaults.temp_extreme_high,
                "temp_extreme_low": defaults.temp_extreme_low,
                "temp_high": defaults.temp_high,
                "temp_low": defaults.temp_low,
                "rain_volume_high": defaults.rain_volume_high,
                "score_high_threshold": defaults.score_high_threshold,
                "score_medium_threshold": defaults.score_medium_threshold,
                "updated_at": None,
            }
        return {
            "rain_prob_high": row.rain_prob_high,
            "rain_prob_medium": row.rain_prob_medium,
            "wind_high": row.wind_high,
            "wind_medium": row.wind_medium,
            "temp_extreme_high": row.temp_extreme_high,
            "temp_extreme_low": row.temp_extreme_low,
            "temp_high": row.temp_high,
            "temp_low": row.temp_low,
            "rain_volume_high": row.rain_volume_high,
            "score_high_threshold": row.score_high_threshold,
            "score_medium_threshold": row.score_medium_threshold,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }
