from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid
from jose import JWTError, jwt, ExpiredSignatureError
from app.config import get_settings
from app.domain.exceptions import InvalidTokenException, TokenExpiredException


class JWTHandler:
    def __init__(self):
        self._settings = get_settings()

    def create_access_token(self, user_id: uuid.UUID, role: str) -> str:
        expire = datetime.now(timezone.utc) + timedelta(minutes=self._settings.access_token_expire_minutes)
        payload = {"sub": str(user_id), "role": role, "exp": expire}
        return jwt.encode(payload, self._settings.secret_key, algorithm=self._settings.algorithm)

    def decode_token(self, token: str) -> dict:
        try:
            return jwt.decode(token, self._settings.secret_key, algorithms=[self._settings.algorithm])
        except ExpiredSignatureError:
            raise TokenExpiredException("Token has expired")
        except JWTError:
            raise InvalidTokenException("Invalid token")

    def get_user_id_from_token(self, token: str) -> uuid.UUID:
        payload = self.decode_token(token)
        return uuid.UUID(payload["sub"])
