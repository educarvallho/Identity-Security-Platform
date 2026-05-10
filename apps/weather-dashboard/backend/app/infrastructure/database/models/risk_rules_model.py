import uuid
from datetime import datetime
from sqlalchemy import Integer, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID
from app.infrastructure.database.connection import Base


class RiskRulesModel(Base):
    __tablename__ = "risk_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    rain_prob_high: Mapped[float] = mapped_column(Float, nullable=False, default=70.0)
    rain_prob_medium: Mapped[float] = mapped_column(Float, nullable=False, default=40.0)
    wind_high: Mapped[float] = mapped_column(Float, nullable=False, default=50.0)
    wind_medium: Mapped[float] = mapped_column(Float, nullable=False, default=30.0)
    temp_extreme_high: Mapped[float] = mapped_column(Float, nullable=False, default=33.0)
    temp_extreme_low: Mapped[float] = mapped_column(Float, nullable=False, default=5.0)
    temp_high: Mapped[float] = mapped_column(Float, nullable=False, default=28.0)
    temp_low: Mapped[float] = mapped_column(Float, nullable=False, default=10.0)
    rain_volume_high: Mapped[float] = mapped_column(Float, nullable=False, default=20.0)
    score_high_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    score_medium_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
