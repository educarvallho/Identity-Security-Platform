import json
from datetime import datetime, timezone
from app.domain.exceptions import OpenAIUnavailableException
from app.infrastructure.external.openai.client import OpenAIClient
from app.infrastructure.external.open_meteo.client import OpenMeteoClient
from app.infrastructure.external.open_meteo.mappers import map_current
from app.infrastructure.database.repositories.interfaces.i_city_repository import ICityRepository

SYSTEM_PROMPT_TEMPLATE = """Você é um assistente especialista em riscos climáticos operacionais para cidades brasileiras.

Você tem acesso aos dados meteorológicos em tempo real das cidades monitoradas pelo sistema.
Responda APENAS com base nos dados fornecidos abaixo — nunca invente valores ou estimativas.
Seja objetivo, use linguagem clara e mencione os dados relevantes na sua resposta.
Classifique riscos como: BAIXO (score 0-2), MÉDIO (score 3-4) ou ALTO (score 5+).

Se o usuário perguntar sobre uma cidade fora dos dados disponíveis, informe que você só tem informações das cidades monitoradas.

DADOS CLIMÁTICOS ATUAIS DO SISTEMA:
{context}

Data/hora de referência: {datetime} (horário de Brasília)
"""


class ChatUseCase:
    def __init__(self, city_repo: ICityRepository, weather_client: OpenMeteoClient, openai_client: OpenAIClient):
        self._city_repo = city_repo
        self._weather = weather_client
        self._openai = openai_client

    def execute(self, message: str) -> str:
        context = self._build_context()
        now = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M")
        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(context=json.dumps(context, ensure_ascii=False, indent=2), datetime=now)
        return self._openai.chat(system_prompt, message)

    def _build_context(self) -> dict:
        cities = self._city_repo.list_all(active_only=True)
        cities_data = []
        for city in cities:
            try:
                data = self._weather.fetch(city.latitude, city.longitude, city_id=city.id)
                current = map_current(data["current"])
                cities_data.append({
                    "cidade": city.name,
                    "estado": city.state,
                    "temperatura_atual_c": round(current.temperature, 1),
                    "sensacao_termica_c": round(current.apparent_temperature, 1),
                    "umidade_pct": current.humidity,
                    "prob_chuva_pct": current.rain_probability,
                    "volume_chuva_mm": round(current.rain_volume_mm, 1),
                    "vento_kmh": round(current.wind_speed_kmh, 1),
                    "risco_score": current.risk.score,
                    "risco_nivel": current.risk.level.value,
                    "risco_motivos": current.risk.reasons,
                })
            except Exception:
                pass

        if not cities_data:
            return {"erro": "Dados climáticos temporariamente indisponíveis"}

        temps = [c["temperatura_atual_c"] for c in cities_data]
        risks = [c for c in cities_data if c["risco_nivel"] == "high"]
        best = min(cities_data, key=lambda x: x["risco_score"])

        return {
            "cidades": cities_data,
            "resumo": {
                "cidade_mais_quente": max(cities_data, key=lambda x: x["temperatura_atual_c"])["cidade"],
                "cidade_mais_fria": min(cities_data, key=lambda x: x["temperatura_atual_c"])["cidade"],
                "temperatura_media_c": round(sum(temps) / len(temps), 1),
                "cidades_alto_risco": [c["cidade"] for c in risks],
                "melhor_cidade_operacao": best["cidade"],
                "cidade_maior_vento": max(cities_data, key=lambda x: x["vento_kmh"])["cidade"],
                "cidade_maior_chuva_prob": max(cities_data, key=lambda x: x["prob_chuva_pct"])["cidade"],
            },
        }
