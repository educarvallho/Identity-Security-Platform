from app.domain.entities.weather import RiskResult
from app.domain.entities.risk_rules import RiskRules
from app.domain.enums import RiskLevel


class CalculateRiskUseCase:
    def execute(
        self,
        temperature: float,
        rain_prob: float,
        wind_speed_kmh: float,
        rain_volume_mm: float,
        rules: RiskRules | None = None,
    ) -> RiskResult:
        if rules is None:
            rules = RiskRules()

        score = 0
        reasons: list[str] = []

        if rain_prob > rules.rain_prob_high:
            score += 2
            reasons.append(f"Prob. chuva alta ({rain_prob:.0f}%)")
        elif rain_prob > rules.rain_prob_medium:
            score += 1
            reasons.append(f"Prob. chuva moderada ({rain_prob:.0f}%)")

        if wind_speed_kmh > rules.wind_high:
            score += 2
            reasons.append(f"Vento perigoso ({wind_speed_kmh:.0f} km/h)")
        elif wind_speed_kmh > rules.wind_medium:
            score += 1
            reasons.append(f"Vento forte ({wind_speed_kmh:.0f} km/h)")

        if temperature > rules.temp_extreme_high or temperature < rules.temp_extreme_low:
            score += 2
            reasons.append(f"Temperatura extrema ({temperature:.1f}°C)")
        elif temperature > rules.temp_high or temperature < rules.temp_low:
            score += 1
            reasons.append(f"Temperatura elevada/baixa ({temperature:.1f}°C)")

        if rain_volume_mm > rules.rain_volume_high:
            score += 1
            reasons.append(f"Volume de chuva alto ({rain_volume_mm:.1f} mm)")

        if score >= rules.score_high_threshold:
            level = RiskLevel.HIGH
        elif score >= rules.score_medium_threshold:
            level = RiskLevel.MEDIUM
        else:
            level = RiskLevel.LOW

        return RiskResult(score=score, level=level, reasons=reasons)
