from typing import Optional
import uuid
from sqlalchemy.orm import Session
from app.domain.entities.user import User
from app.domain.enums import UserRole
from app.infrastructure.database.models.user_model import UserModel
from app.infrastructure.database.repositories.interfaces.i_user_repository import IUserRepository


def _to_entity(model: UserModel) -> User:
    return User(
        id=model.id,
        email=model.email,
        hashed_password=model.hashed_password,
        full_name=model.full_name,
        role=UserRole(model.role),
        is_active=model.is_active,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


class UserRepository(IUserRepository):
    def __init__(self, db: Session):
        self._db = db

    def get_by_email(self, email: str) -> Optional[User]:
        model = self._db.query(UserModel).filter(UserModel.email == email).first()
        return _to_entity(model) if model else None

    def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        model = self._db.query(UserModel).filter(UserModel.id == user_id).first()
        return _to_entity(model) if model else None

    def list_all(self) -> list[User]:
        return [_to_entity(m) for m in self._db.query(UserModel).order_by(UserModel.created_at).all()]

    def create(self, email: str, hashed_password: str, full_name: str, role: UserRole) -> User:
        model = UserModel(email=email, hashed_password=hashed_password, full_name=full_name, role=role.value)
        self._db.add(model)
        self._db.commit()
        self._db.refresh(model)
        return _to_entity(model)

    def update(self, user_id: uuid.UUID, full_name: Optional[str], role: Optional[UserRole], is_active: Optional[bool]) -> Optional[User]:
        model = self._db.query(UserModel).filter(UserModel.id == user_id).first()
        if not model:
            return None
        if full_name is not None:
            model.full_name = full_name
        if role is not None:
            model.role = role.value
        if is_active is not None:
            model.is_active = is_active
        self._db.commit()
        self._db.refresh(model)
        return _to_entity(model)

    def delete(self, user_id: uuid.UUID) -> bool:
        model = self._db.query(UserModel).filter(UserModel.id == user_id).first()
        if not model:
            return False
        self._db.delete(model)
        self._db.commit()
        return True

    def count(self) -> int:
        return self._db.query(UserModel).count()
