import logging
from fastapi import APIRouter, Depends, HTTPException
from app.domain.entities.user import User
from app.domain.exceptions import OpenAIUnavailableException
from app.infrastructure.database.repositories.city_repository import CityRepository
from app.infrastructure.external.open_meteo.client import OpenMeteoClient
from app.infrastructure.external.openai.client import OpenAIClient
from app.presentation.dependencies import get_city_repository, get_weather_client, get_openai_client, get_current_user
from app.presentation.schemas.agent_schemas import ChatRequest, ChatResponse
from app.use_cases.agent.chat_use_case import ChatUseCase

router = APIRouter(prefix="/agent", tags=["agent"])
logger = logging.getLogger(__name__)


@router.post("/chat", response_model=ChatResponse)
def chat(
    body: ChatRequest,
    city_repo: CityRepository = Depends(get_city_repository),
    weather_client: OpenMeteoClient = Depends(get_weather_client),
    openai_client: OpenAIClient = Depends(get_openai_client),
    current_user: User = Depends(get_current_user),
):
    try:
        reply = ChatUseCase(city_repo, weather_client, openai_client).execute(body.message)
        logger.info("agent_chat user=%s msg_len=%d", current_user.email, len(body.message))
        return ChatResponse(reply=reply)
    except OpenAIUnavailableException as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no agente: {str(e)}")
