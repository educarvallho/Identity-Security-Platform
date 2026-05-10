import logging
from fastapi import APIRouter, Depends
from app.domain.entities.risk_rules import RiskRules
from app.domain.entities.user import User
from app.infrastructure.database.repositories.risk_rules_repository import RiskRulesRepository
from app.presentation.dependencies import get_rules_repository, require_admin
from app.presentation.schemas.rules_schemas import RiskRulesOut, RiskRulesUpdateRequest
from app.use_cases.rules.get_rules_use_case import GetRulesUseCase
from app.use_cases.rules.update_rules_use_case import UpdateRulesUseCase

router = APIRouter(prefix="/admin/rules", tags=["rules"])
logger = logging.getLogger(__name__)


@router.get("", response_model=RiskRulesOut)
def get_rules(
    rules_repo: RiskRulesRepository = Depends(get_rules_repository),
    _: User = Depends(require_admin),
):
    return GetRulesUseCase(rules_repo).execute()


@router.put("", response_model=RiskRulesOut)
def update_rules(
    body: RiskRulesUpdateRequest,
    rules_repo: RiskRulesRepository = Depends(get_rules_repository),
    current_user: User = Depends(require_admin),
):
    rules = RiskRules(
        rain_prob_high=body.rain_prob_high,
        rain_prob_medium=body.rain_prob_medium,
        wind_high=body.wind_high,
        wind_medium=body.wind_medium,
        temp_extreme_high=body.temp_extreme_high,
        temp_extreme_low=body.temp_extreme_low,
        temp_high=body.temp_high,
        temp_low=body.temp_low,
        rain_volume_high=body.rain_volume_high,
        score_high_threshold=body.score_high_threshold,
        score_medium_threshold=body.score_medium_threshold,
    )
    result = UpdateRulesUseCase(rules_repo).execute(rules, current_user)
    logger.info("rules_updated user=%s", current_user.email)
    return result
