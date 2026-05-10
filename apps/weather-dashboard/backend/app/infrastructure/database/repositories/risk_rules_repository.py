import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.domain.entities.risk_rules import RiskRules
from app.infrastructure.database.models.risk_rules_model import RiskRulesModel

SINGLETON_ID = 1


class RiskRulesRepository:
    def __init__(self, db: Session):
        self._db = db

    def get_rules(self) -> RiskRules:
        row = self._db.query(RiskRulesModel).filter(RiskRulesModel.id == SINGLETON_ID).first()
        if row is None:
            return RiskRules()
        return RiskRules(
            rain_prob_high=row.rain_prob_high,
            rain_prob_medium=row.rain_prob_medium,
            wind_high=row.wind_high,
            wind_medium=row.wind_medium,
            temp_extreme_high=row.temp_extreme_high,
            temp_extreme_low=row.temp_extreme_low,
            temp_high=row.temp_high,
            temp_low=row.temp_low,
            rain_volume_high=row.rain_volume_high,
            score_high_threshold=row.score_high_threshold,
            score_medium_threshold=row.score_medium_threshold,
        )

    def get_row(self) -> RiskRulesModel | None:
        return self._db.query(RiskRulesModel).filter(RiskRulesModel.id == SINGLETON_ID).first()

    def upsert(self, rules: RiskRules, updated_by: uuid.UUID | None = None) -> RiskRulesModel:
        row = self._db.query(RiskRulesModel).filter(RiskRulesModel.id == SINGLETON_ID).first()
        if row is None:
            row = RiskRulesModel(id=SINGLETON_ID)
            self._db.add(row)

        row.rain_prob_high = rules.rain_prob_high
        row.rain_prob_medium = rules.rain_prob_medium
        row.wind_high = rules.wind_high
        row.wind_medium = rules.wind_medium
        row.temp_extreme_high = rules.temp_extreme_high
        row.temp_extreme_low = rules.temp_extreme_low
        row.temp_high = rules.temp_high
        row.temp_low = rules.temp_low
        row.rain_volume_high = rules.rain_volume_high
        row.score_high_threshold = rules.score_high_threshold
        row.score_medium_threshold = rules.score_medium_threshold
        row.updated_by = updated_by
        row.updated_at = datetime.now(timezone.utc)

        self._db.commit()
        self._db.refresh(row)
        return row
