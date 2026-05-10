from typing import Optional
import uuid
from sqlalchemy.orm import Session
from app.domain.entities.city import City
from app.infrastructure.database.models.city_model import CityModel
from app.infrastructure.database.repositories.interfaces.i_city_repository import ICityRepository


def _to_entity(model: CityModel) -> City:
    return City(
        id=model.id,
        name=model.name,
        state=model.state,
        country=model.country,
        latitude=model.latitude,
        longitude=model.longitude,
        is_active=model.is_active,
        created_by=model.created_by,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class CityRepository(ICityRepository):
    def __init__(self, db: Session):
        self._db = db

    def list_all(self, active_only: bool = False) -> list[City]:
        q = self._db.query(CityModel)
        if active_only:
            q = q.filter(CityModel.is_active == True)
        return [_to_entity(m) for m in q.order_by(CityModel.name).all()]

    def get_by_id(self, city_id: int) -> Optional[City]:
        model = self._db.query(CityModel).filter(CityModel.id == city_id).first()
        return _to_entity(model) if model else None

    def create(self, name: str, state: str, country: str, latitude: float, longitude: float, created_by: Optional[uuid.UUID]) -> City:
        model = CityModel(name=name, state=state, country=country, latitude=latitude, longitude=longitude, created_by=created_by)
        self._db.add(model)
        self._db.commit()
        self._db.refresh(model)
        return _to_entity(model)

    def update(self, city_id: int, name: Optional[str], state: Optional[str], country: Optional[str], latitude: Optional[float], longitude: Optional[float]) -> Optional[City]:
        model = self._db.query(CityModel).filter(CityModel.id == city_id).first()
        if not model:
            return None
        if name is not None:
            model.name = name
        if state is not None:
            model.state = state
        if country is not None:
            model.country = country
        if latitude is not None:
            model.latitude = latitude
        if longitude is not None:
            model.longitude = longitude
        self._db.commit()
        self._db.refresh(model)
        return _to_entity(model)

    def toggle_active(self, city_id: int) -> Optional[City]:
        model = self._db.query(CityModel).filter(CityModel.id == city_id).first()
        if not model:
            return None
        model.is_active = not model.is_active
        self._db.commit()
        self._db.refresh(model)
        return _to_entity(model)

    def delete(self, city_id: int) -> bool:
        model = self._db.query(CityModel).filter(CityModel.id == city_id).first()
        if not model:
            return False
        self._db.delete(model)
        self._db.commit()
        return True

    def count(self) -> int:
        return self._db.query(CityModel).count()
