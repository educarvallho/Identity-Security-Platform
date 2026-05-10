from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CityOut(BaseModel):
    id: int
    name: str
    state: str
    country: str
    latitude: float
    longitude: float
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CityCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    state: str = Field(..., min_length=2, max_length=2)
    country: str = Field(default="Brasil", max_length=50)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class CityUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    state: Optional[str] = Field(None, min_length=2, max_length=2)
    country: Optional[str] = Field(None, max_length=50)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
