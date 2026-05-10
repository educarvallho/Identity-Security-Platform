from dataclasses import dataclass
from datetime import datetime
from typing import Optional
import uuid


@dataclass
class City:
    id: int
    name: str
    state: str
    country: str
    latitude: float
    longitude: float
    is_active: bool
    created_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime
