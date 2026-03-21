@echo off
REM Setup script for PostgreSQL datastore on Windows

echo 4db  Setting up PostgreSQL datastore...
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [X] Docker is not running. Please start Docker and try again.
    exit /b 1
)

REM Start PostgreSQL with storage profile
echo Starting PostgreSQL container...
call docker compose --profile storage up -d postgres

REM Wait for PostgreSQL to be ready
echo Waiting for PostgreSQL to be ready...
:wait_db
timeout /t 2 /nobreak >nul
docker exec copilot-postgres pg_isready -U copilot >nul 2>&1
if errorlevel 1 (
    echo Waiting for database...
    goto wait_db
)

echo [OK] PostgreSQL is ready!
echo.

REM Run schema initialization
echo Initializing database schema...
(
echo CREATE TABLE IF NOT EXISTS meetings (
echo   id SERIAL PRIMARY KEY,
echo   session_id UUID UNIQUE NOT NULL,
echo   created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
echo   updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
echo   duration_seconds INT,
echo   participant_count INT DEFAULT 1
echo );
echo.
echo CREATE TABLE IF NOT EXISTS meeting_events (
echo   id SERIAL PRIMARY KEY,
echo   meeting_id INT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
echo   event_type VARCHAR(50) NOT NULL,
echo   event_text TEXT,
echo   event_data JSONB,
echo   created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
echo );
echo.
echo CREATE INDEX IF NOT EXISTS idx_meetings_session_id ON meetings(session_id);
echo CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at DESC);
echo CREATE INDEX IF NOT EXISTS idx_meeting_events_meeting_id ON meeting_events(meeting_id);
echo CREATE INDEX IF NOT EXISTS idx_meeting_events_type ON meeting_events(event_type);
echo CREATE INDEX IF NOT EXISTS idx_meeting_events_created_at ON meeting_events(created_at DESC);
) | docker exec -i copilot-postgres psql -U copilot -d copilot

echo.
echo [OK] PostgreSQL datastore setup complete!
echo.
echo Connection details:
echo   Host: postgres ^(Docker^) or localhost ^(Host^)
echo   Port: 5432
echo   Username: copilot
echo   Password: copilot
echo   Database: copilot
echo.
echo Next steps:
echo   1. cd services\gateway
echo   2. npm install pg @types/pg
echo   3. From root: docker compose up --build
echo   4. Backend will auto-initialize tables on startup
echo.
