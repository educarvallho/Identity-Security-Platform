import uuid
from app.domain.entities.risk_rules import RiskRules
from app.domain.entities.user import User
from app.infrastructure.database.repositories.risk_rules_repository import RiskRulesRepository


class UpdateRulesUseCase:
    def __init__(self, rules_repo: RiskRulesRepository):
        self._repo = rules_repo

    def execute(self, rules: RiskRules, updated_by: User) -> dict:
        row = self._repo.upsert(rules, updated_by=updated_by.id)
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
