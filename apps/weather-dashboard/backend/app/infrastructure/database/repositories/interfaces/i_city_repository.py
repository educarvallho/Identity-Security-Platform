from abc import ABC, abstractmethod
from typing import Optional
import uuid
from app.domain.entities.city import City


class ICityRepository(ABC):
    @abstractmethod
    def list_all(self, active_only: bool = False) -> list[City]:
        pass

    @abstractmethod
    def get_by_id(self, city_id: int) -> Optional[City]:
        pass

    @abstractmethod
    def create(self, name: str, state: str, country: str, latitude: float, longitude: float, created_by: Optional[uuid.UUID]) -> City:
        pass

    @abstractmethod
    def update(self, city_id: int, name: Optional[str], state: Optional[str], country: Optional[str], latitude: Optional[float], longitude: Optional[float]) -> Optional[City]:
        pass

    @abstractmethod
    def toggle_active(self, city_id: int) -> Optional[City]:
        pass

    @abstractmethod
    def delete(self, city_id: int) -> bool:
        pass

    @abstractmethod
    def count(self) -> int:
        pass
