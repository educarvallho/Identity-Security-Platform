#!/usr/bin/env bash
# Initializes keycloak_db and infisical_db with dedicated users.
# Runs automatically on first PostgreSQL startup via /docker-entrypoint-initdb.d/.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE keycloak_db;
    CREATE DATABASE infisical_db;

    CREATE USER ${KC_DB_USER} WITH PASSWORD '${KC_DB_PASSWORD}';
    CREATE USER ${INFISICAL_DB_USER} WITH PASSWORD '${INFISICAL_DB_PASSWORD}';

    GRANT ALL PRIVILEGES ON DATABASE keycloak_db TO ${KC_DB_USER};
    GRANT ALL PRIVILEGES ON DATABASE infisical_db TO ${INFISICAL_DB_USER};
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "keycloak_db" <<-EOSQL
    GRANT ALL ON SCHEMA public TO ${KC_DB_USER};
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "infisical_db" <<-EOSQL
    GRANT ALL ON SCHEMA public TO ${INFISICAL_DB_USER};
EOSQL
