from pydantic import BaseModel, Field
from typing import Optional


class RiskRulesOut(BaseModel):
    rain_prob_high: float
    rain_prob_medium: float
    wind_high: float
    wind_medium: float
    temp_extreme_high: float
    temp_extreme_low: float
    temp_high: float
    temp_low: float
    rain_volume_high: float
    score_high_threshold: int
    score_medium_threshold: int
    updated_at: Optional[str] = None


class RiskRulesUpdateRequest(BaseModel):
    rain_prob_high: float = Field(gt=0, le=100)
    rain_prob_medium: float = Field(gt=0, le=100)
    wind_high: float = Field(gt=0)
    wind_medium: float = Field(gt=0)
    temp_extreme_high: float
    temp_extreme_low: float
    temp_high: float
    temp_low: float
    rain_volume_high: float = Field(gt=0)
    score_high_threshold: int = Field(ge=1)
    score_medium_threshold: int = Field(ge=1)
