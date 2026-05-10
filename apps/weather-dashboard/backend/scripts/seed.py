"""
Idempotent seed script: creates 3 test users and 10 Brazilian cities.
Safe to run multiple times — skips if data already exists.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.infrastructure.database.connection import SessionLocal
from app.infrastructure.database.models.user_model import UserModel
from app.infrastructure.database.models.city_model import CityModel
from app.infrastructure.database.models.risk_rules_model import RiskRulesModel
from app.infrastructure.security.password_hasher import PasswordHasher

SEED_USERS = [
    {"email": "admin@weather.com", "full_name": "Admin User", "role": "admin", "password": "admin123"},
    {"email": "operator@weather.com", "full_name": "Operator User", "role": "operator", "password": "operator123"},
    {"email": "viewer@weather.com", "full_name": "Viewer User", "role": "viewer", "password": "viewer123"},
]

SEED_CITIES = [
    {"name": "São Paulo",      "state": "SP", "latitude": -23.5505, "longitude": -46.6333},
    {"name": "Rio de Janeiro", "state": "RJ", "latitude": -22.9068, "longitude": -43.1729},
    {"name": "Belo Horizonte", "state": "MG", "latitude": -19.9191, "longitude": -43.9386},
    {"name": "Curitiba",       "state": "PR", "latitude": -25.4284, "longitude": -49.2733},
    {"name": "Porto Alegre",   "state": "RS", "latitude": -30.0346, "longitude": -51.2177},
    {"name": "Florianópolis",  "state": "SC", "latitude": -27.5954, "longitude": -48.5480},
    {"name": "Brasília",       "state": "DF", "latitude": -15.8267, "longitude": -47.9218},
    {"name": "Salvador",       "state": "BA", "latitude": -12.9714, "longitude": -38.5014},
    {"name": "Recife",         "state": "PE", "latitude":  -8.0539, "longitude": -34.8811},
    {"name": "Goiânia",        "state": "GO", "latitude": -16.6869, "longitude": -49.2648},
]


def seed():
    db = SessionLocal()
    hasher = PasswordHasher()
    try:
        # Users
        existing_users = db.query(UserModel).count()
        if existing_users == 0:
            print("Seeding users...")
            for u in SEED_USERS:
                user = UserModel(
                    email=u["email"],
                    full_name=u["full_name"],
                    role=u["role"],
                    hashed_password=hasher.hash(u["password"]),
                )
                db.add(user)
            db.commit()
            print(f"  Created {len(SEED_USERS)} users")
        else:
            print(f"  Users already seeded ({existing_users} found), skipping")

        # Cities
        existing_cities = db.query(CityModel).count()
        if existing_cities == 0:
            print("Seeding cities...")
            for c in SEED_CITIES:
                city = CityModel(name=c["name"], state=c["state"], country="Brasil", latitude=c["latitude"], longitude=c["longitude"])
                db.add(city)
            db.commit()
            print(f"  Created {len(SEED_CITIES)} cities")
        else:
            print(f"  Cities already seeded ({existing_cities} found), skipping")

        # Risk rules (singleton row id=1)
        existing_rules = db.query(RiskRulesModel).filter(RiskRulesModel.id == 1).first()
        if existing_rules is None:
            print("Seeding risk rules...")
            db.add(RiskRulesModel(
                id=1,
                rain_prob_high=70.0, rain_prob_medium=40.0,
                wind_high=50.0, wind_medium=30.0,
                temp_extreme_high=33.0, temp_extreme_low=5.0,
                temp_high=28.0, temp_low=10.0,
                rain_volume_high=20.0,
                score_high_threshold=5, score_medium_threshold=3,
            ))
            db.commit()
            print("  Created default risk rules")
        else:
            print("  Risk rules already seeded, skipping")

        print("Seed complete.")
    except Exception as e:
        db.rollback()
        print(f"Seed error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
