from dataclasses import dataclass


@dataclass
class RiskRules:
    rain_prob_high: float = 70.0
    rain_prob_medium: float = 40.0
    wind_high: float = 50.0
    wind_medium: float = 30.0
    temp_extreme_high: float = 33.0
    temp_extreme_low: float = 5.0
    temp_high: float = 28.0
    temp_low: float = 10.0
    rain_volume_high: float = 20.0
    score_high_threshold: int = 5
    score_medium_threshold: int = 3
