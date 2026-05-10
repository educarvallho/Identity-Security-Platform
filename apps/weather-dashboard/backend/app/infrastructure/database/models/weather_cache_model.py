from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, Float, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.infrastructure.database.connection import Base


class WeatherCacheModel(Base):
    __tablename__ = "weather_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    city_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("cities.id", ondelete="CASCADE"), nullable=True, index=True
    )
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    current_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    forecast_json: Mapped[dict] = mapped_column(JSON, nullable=False)
