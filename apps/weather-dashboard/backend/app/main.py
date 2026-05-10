import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.presentation.routers import auth, cities, weather, users, agent, rules

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)

settings = get_settings()

app = FastAPI(
    title="Weather Risk Dashboard API",
    description="API para monitoramento climático e riscos operacionais",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(cities.router)
app.include_router(weather.router)
app.include_router(users.router)
app.include_router(agent.router)
app.include_router(rules.router)


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
