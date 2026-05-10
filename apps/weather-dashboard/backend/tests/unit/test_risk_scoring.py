import pytest
from app.domain.enums import RiskLevel
from app.use_cases.weather.calculate_risk_use_case import CalculateRiskUseCase

uc = CalculateRiskUseCase()


def test_all_zeros_is_low():
    result = uc.execute(temperature=20, rain_prob=0, wind_speed_kmh=0, rain_volume_mm=0)
    assert result.score == 0
    assert result.level == RiskLevel.LOW


def test_rain_prob_above_70_adds_2():
    result = uc.execute(temperature=20, rain_prob=75, wind_speed_kmh=0, rain_volume_mm=0)
    assert result.score == 2


def test_rain_prob_above_40_adds_1():
    result = uc.execute(temperature=20, rain_prob=41, wind_speed_kmh=0, rain_volume_mm=0)
    assert result.score == 1


def test_rain_prob_exactly_40_adds_0():
    result = uc.execute(temperature=20, rain_prob=40, wind_speed_kmh=0, rain_volume_mm=0)
    assert result.score == 0


def test_wind_above_50_adds_2():
    result = uc.execute(temperature=20, rain_prob=0, wind_speed_kmh=51, rain_volume_mm=0)
    assert result.score == 2


def test_wind_above_30_adds_1():
    result = uc.execute(temperature=20, rain_prob=0, wind_speed_kmh=31, rain_volume_mm=0)
    assert result.score == 1


def test_wind_exactly_30_adds_0():
    result = uc.execute(temperature=20, rain_prob=0, wind_speed_kmh=30, rain_volume_mm=0)
    assert result.score == 0


def test_extreme_heat_adds_2():
    # temp_extreme_high default = 33
    result = uc.execute(temperature=34, rain_prob=0, wind_speed_kmh=0, rain_volume_mm=0)
    assert result.score == 2


def test_extreme_cold_adds_2():
    result = uc.execute(temperature=4, rain_prob=0, wind_speed_kmh=0, rain_volume_mm=0)
    assert result.score == 2


def test_moderate_heat_adds_1():
    # temp_high default = 28; temp_extreme_high = 33; so 30 is moderate
    result = uc.execute(temperature=30, rain_prob=0, wind_speed_kmh=0, rain_volume_mm=0)
    assert result.score == 1


def test_rain_volume_above_20_adds_1():
    result = uc.execute(temperature=20, rain_prob=0, wind_speed_kmh=0, rain_volume_mm=21)
    assert result.score == 1


def test_score_2_is_low():
    result = uc.execute(temperature=20, rain_prob=75, wind_speed_kmh=0, rain_volume_mm=0)
    assert result.score == 2
    assert result.level == RiskLevel.LOW


def test_score_3_is_medium():
    result = uc.execute(temperature=20, rain_prob=75, wind_speed_kmh=31, rain_volume_mm=0)
    assert result.score == 3
    assert result.level == RiskLevel.MEDIUM


def test_score_5_is_high():
    result = uc.execute(temperature=39, rain_prob=75, wind_speed_kmh=31, rain_volume_mm=0)
    assert result.score == 5
    assert result.level == RiskLevel.HIGH


def test_full_combination_is_high():
    result = uc.execute(temperature=39, rain_prob=80, wind_speed_kmh=55, rain_volume_mm=25)
    assert result.score == 7
    assert result.level == RiskLevel.HIGH
    assert len(result.reasons) == 4


def test_reasons_populated_correctly():
    result = uc.execute(temperature=39, rain_prob=75, wind_speed_kmh=0, rain_volume_mm=0)
    assert any("chuva" in r.lower() for r in result.reasons)
    assert any("temperatura" in r.lower() for r in result.reasons)
