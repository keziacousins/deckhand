-- Create separate databases for Kratos and Hydra within the shared Ory Postgres instance.
-- This script runs on first container boot via docker-entrypoint-initdb.d.

CREATE DATABASE kratos;
CREATE DATABASE hydra;
