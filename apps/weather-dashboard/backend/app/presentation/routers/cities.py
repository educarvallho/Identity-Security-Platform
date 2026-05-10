import logging
from fastapi import APIRouter, Depends, HTTPException, status

logger = logging.getLogger(__name__)
from app.domain.entities.user import User
from app.domain.exceptions import ForbiddenException, NotFoundException
from app.infrastructure.database.repositories.city_repository import CityRepository
from app.presentation.dependencies import get_city_repository, get_current_user, require_admin, require_admin_or_operator
from app.presentation.schemas.city_schemas import CityOut, CityCreateRequest, CityUpdateRequest
from app.use_cases.cities.list_cities_use_case import ListCitiesUseCase
from app.use_cases.cities.get_city_use_case import GetCityUseCase
from app.use_cases.cities.create_city_use_case import CreateCityUseCase
from app.use_cases.cities.update_city_use_case import UpdateCityUseCase
from app.use_cases.cities.toggle_city_active_use_case import ToggleCityActiveUseCase
from app.use_cases.cities.delete_city_use_case import DeleteCityUseCase

router = APIRouter(prefix="/cities", tags=["cities"])


def _to_out(city) -> CityOut:
    return CityOut(
        id=city.id, name=city.name, state=city.state, country=city.country,
        latitude=city.latitude, longitude=city.longitude, is_active=city.is_active,
        created_at=city.created_at, updated_at=city.updated_at,
    )


@router.get("", response_model=list[CityOut])
def list_cities(
    active_only: bool = False,
    city_repo: CityRepository = Depends(get_city_repository),
    _: User = Depends(get_current_user),
):
    return [_to_out(c) for c in ListCitiesUseCase(city_repo).execute(active_only)]


@router.get("/{city_id}", response_model=CityOut)
def get_city(
    city_id: int,
    city_repo: CityRepository = Depends(get_city_repository),
    _: User = Depends(get_current_user),
):
    try:
        return _to_out(GetCityUseCase(city_repo).execute(city_id))
    except NotFoundException:
        raise HTTPException(status_code=404, detail="Cidade não encontrada")


@router.post("", response_model=CityOut, status_code=status.HTTP_201_CREATED)
def create_city(
    body: CityCreateRequest,
    city_repo: CityRepository = Depends(get_city_repository),
    current_user: User = Depends(require_admin_or_operator),
):
    try:
        city = CreateCityUseCase(city_repo).execute(current_user, body.name, body.state, body.country, body.latitude, body.longitude)
        logger.info("city_created id=%s name=%s user=%s", city.id, city.name, current_user.email)
        return _to_out(city)
    except ForbiddenException as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.put("/{city_id}", response_model=CityOut)
def update_city(
    city_id: int,
    body: CityUpdateRequest,
    city_repo: CityRepository = Depends(get_city_repository),
    current_user: User = Depends(require_admin_or_operator),
):
    try:
        city = UpdateCityUseCase(city_repo).execute(current_user, city_id, body.name, body.state, body.country, body.latitude, body.longitude)
        logger.info("city_updated id=%s name=%s user=%s", city.id, city.name, current_user.email)
        return _to_out(city)
    except (ForbiddenException, NotFoundException) as e:
        code = 403 if isinstance(e, ForbiddenException) else 404
        raise HTTPException(status_code=code, detail=str(e))


@router.patch("/{city_id}/toggle", response_model=CityOut)
def toggle_city(
    city_id: int,
    city_repo: CityRepository = Depends(get_city_repository),
    current_user: User = Depends(require_admin_or_operator),
):
    try:
        city = ToggleCityActiveUseCase(city_repo).execute(current_user, city_id)
        logger.info("city_toggled id=%s active=%s user=%s", city.id, city.is_active, current_user.email)
        return _to_out(city)
    except (ForbiddenException, NotFoundException) as e:
        code = 403 if isinstance(e, ForbiddenException) else 404
        raise HTTPException(status_code=code, detail=str(e))


@router.delete("/{city_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_city(
    city_id: int,
    city_repo: CityRepository = Depends(get_city_repository),
    current_user: User = Depends(require_admin),
):
    try:
        DeleteCityUseCase(city_repo).execute(current_user, city_id)
        logger.info("city_deleted id=%s user=%s", city_id, current_user.email)
    except (ForbiddenException, NotFoundException) as e:
        code = 403 if isinstance(e, ForbiddenException) else 404
        raise HTTPException(status_code=code, detail=str(e))
