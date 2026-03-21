# Complete PostgreSQL Datastore Installation Guide

This guide walks through the complete installation and verification of the PostgreSQL datastore for the CoPilot system.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Installation Steps](#installation-steps)
3. [Verification](#verification)
4. [Usage](#usage)
5. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required
- Docker and Docker Compose installed
- Node.js 18+ and npm
- PostgreSQL 16 (installed via Docker)

### Verify Prerequisites
```bash
# Check Docker
docker --version

# Check Docker Compose
docker compose --version

# Check Node.js
node --version
npm --version
```

## Installation Steps

### Step 1: Install Dependencies

From the workspace root, install PostgreSQL driver packages:

```bash
cd services/gateway
npm install pg @types/pg
cd ../..
```

**Expected output:**
```
added 3 packages, and audited 192 packages in 5s
```

### Step 2: Start PostgreSQL Container

Run PostgreSQL with Docker Compose using the storage profile:

```bash
docker compose --profile storage up -d postgres
```

**Expected output:**
```
Creating copilot-postgres ... done
```

**Verify it's running:**
```bash
docker ps | findstr postgres
```

Should show:
```
copilot-postgres  postgres:16-alpine  Up X seconds  0.0.0.0:5432->5432/tcp
```

### Step 3: Wait for PostgreSQL to be Ready

PostgreSQL takes a few seconds to initialize:

```bash
# Check logs
docker logs copilot-postgres

# Test connection
docker exec copilot-postgres pg_isready -U copilot
```

Wait until you see:
```
accepting connections
```

### Step 4: Verify Database Connection

Test connection from your local machine:

```bash
# Option A: Using Docker exec
docker exec -it copilot-postgres psql -U copilot -d copilot -c "SELECT NOW();"

# Option B: Using psql (if installed locally)
psql postgresql://copilot:copilot@localhost:5432/copilot -c "SELECT NOW();"
```

**Expected output:**
```
              now              
-------------------------------
 2026-03-20 12:34:56.789012+00
```

### Step 5: Configure Environment Variables

Create a `.env` file in the project root (or update existing):

```env
# Database Configuration
DATABASE_URL=postgresql://copilot:copilot@postgres:5432/copilot
USE_DATABASE=true

# Other services (copy from .env.example if needed)
OLLAMA_API=http://localhost:11434
STT_API=http://localhost:8001/transcribe
```

**For Docker usage**, the `docker-compose.yml` already sets:
```yaml
- DATABASE_URL=postgresql://copilot:copilot@postgres:5432/copilot
- USE_DATABASE=true
```

### Step 6: Start the Backend Service

The backend will automatically initialize the database schema on startup:

```bash
# Option A: Using Docker Compose (Recommended)
docker compose up --build backend

# Option B: Local development
cd services/gateway
npm run dev
```

**Expected output:**
```
📡 Initializing database connection...
✓ Database connection successful: { now: '2026-03-20T12:34:56.789Z' }
Running database schema initialization...
✓ Database schema initialized successfully
🚀 Server running on port 4000
```

### Step 7: Verify Schema Creation

Check that tables were created:

```bash
docker exec -it copilot-postgres psql -U copilot -d copilot -c "\dt"
```

**Expected output:**
```
               List of relations
 Schema |         Name          | Type  | Owner   
--------+-----------------------+-------+---------
 public | meeting_events        | table | copilot
 public | meeting_events_id_seq | sequence | copilot
 public | meetings              | table | copilot
 public | meetings_id_seq       | sequence | copilot
```

### Step 8: Start Full Stack

Now start all services:

```bash
# With storage profile
docker compose --profile storage up -d --build

# Or without storage profile (PostgreSQL still available)
docker compose up -d --build
```

**Verify all services:**
```bash
docker ps
```

Should see:
- `copilot-ollama` (LLM)
- `copilot-stt` (Speech-to-Text)
- `copilot-backend` (API Gateway - main service)
- `copilot-frontend` (UI)
- `copilot-postgres` (Database)
- `copilot-redis` (Cache - if storage profile)
- `copilot-qdrant` (Vector DB - if storage profile)

## Verification

### Test 1: Database Connection from Backend

```bash
curl http://localhost:4000/health
```

**Expected response:**
```json
{
  "status": "ok"
}
```

### Test 2: API Endpoints

```bash
# List meetings (should be empty initially)
curl http://localhost:4000/api/meetings

# Expected response:
# {"meetings":[]}
```

### Test 3: Check Backend Logs

```bash
docker logs -f copilot-backend
```

Look for:
- `✓ Database connection successful`
- `✓ Database schema initialized successfully`
- `📊 Using PostgreSQL for meeting storage`

### Test 4: Manual Database Query

```bash
docker exec -it copilot-postgres psql -U copilot -d copilot << EOF
-- Check table structure
\d meetings
\d meeting_events

-- Check row counts (should be 0)
SELECT COUNT(*) as meetings_count FROM meetings;
SELECT COUNT(*) as events_count FROM meeting_events;
EOF
```

## Usage

### Create a Session and Record Events

When you use the overlay UI to record a meeting:

1. **Session created**: Entry added to `meetings` table
2. **Events recorded**: Each transcript/AI response added to `meeting_events`
3. **Automatic timestamps**: Created_at and updated_at tracked

### Query Meeting Data

```bash
docker exec -it copilot-postgres psql -U copilot -d copilot << EOF
-- Get all meetings
SELECT session_id, created_at, duration_seconds FROM meetings;

-- Get events for a specific meeting
SELECT * FROM meeting_events 
WHERE meeting_id IN (SELECT id FROM meetings WHERE session_id = 'YOUR_SESSION_ID')
ORDER BY created_at ASC;

-- Count events by type
SELECT event_type, COUNT(*) FROM meeting_events GROUP BY event_type;
EOF
```

### Access via REST API

The backend provides REST endpoints:

```bash
# List all meetings
curl http://localhost:4000/api/meetings

# Get specific meeting
curl http://localhost:4000/api/meetings/YOUR_SESSION_ID

# Both return JSON with meetings and events
```

## Troubleshooting

### PostgreSQL Container Won't Start

**Symptoms:** `docker ps` doesn't show postgres container

**Solution:**
```bash
# Check error logs
docker logs copilot-postgres

# If port 5432 already in use
docker ps | grep 5432

# Stop conflicting container
docker stop container_name

# Try again
docker compose --profile storage up -d postgres
```

### Connection Refused

**Symptoms:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution:**
```bash
# Verify PostgreSQL is running
docker ps | grep postgres

# If running with Docker Compose, use 'postgres' host not 'localhost'
# Check DATABASE_URL in docker-compose.yml environment

# If running locally, ensure PostgreSQL service is running
# and port 5432 is accessible
```

### Tables Not Created

**Symptoms:** `psql` shows empty schema

**Solution:**
```bash
# Manually initialize schema
docker exec -i copilot-postgres psql -U copilot -d copilot < services/gateway/src/db/schema.sql

# Verify
docker exec -it copilot-postgres psql -U copilot -d copilot -c "\dt"
```

### Backend Can't Connect to Database

**Symptoms:** Backend logs show connection error

**Solution:**
1. Check if postgres is running: `docker ps | grep postgres`
2. Check DATABASE_URL environment variable
3. Verify network connectivity:
   ```bash
   docker exec copilot-backend ping postgres
   ```
4. Check postgres logs:
   ```bash
   docker logs copilot-postgres
   ```

### High Memory Usage

PostgreSQL takes ~200MB on first start. Normal.

Monitor with:
```bash
docker stats copilot-postgres
```

### Reset Everything

```bash
# Stop all containers
docker compose down

# Remove all volumes (WARNING: deletes data)
docker volume rm copilot-postgres copilot-redis copilot-data

# Start fresh
docker compose --profile storage up -d --build

# Reinitialize
docker exec -i copilot-postgres psql -U copilot -d copilot < services/gateway/src/db/schema.sql
```

### Change PostgreSQL Password

For production use, change the default password:

1. Update `docker-compose.yml`:
   ```yaml
   postgres:
     environment:
       - POSTGRES_PASSWORD=your_strong_password_here
   ```

2. Update DATABASE_URL:
   ```env
   DATABASE_URL=postgresql://copilot:your_strong_password_here@postgres:5432/copilot
   ```

3. Recreate container:
   ```bash
   docker volume rm copilot-postgres
   docker compose up -d postgres
   ```

## File Structure

The datastore setup created/modified these files:

```
CoPilot-APP/
├── docker-compose.yml                    # Updated: added postgres to backend deps
├── .env.example                          # New: example environment variables
├── setup-datastore.sh                    # New: Linux/Mac setup script
├── setup-datastore.bat                   # New: Windows setup script
├── DATA_STORE_README.md                  # New: detailed documentation
├── DATASTORE_INSTALLATION.md             # New: this file
└── services/gateway/
    ├── package.json                      # Updated: added pg, @types/pg
    ├── src/
    │   ├── config/
    │   │   └── env.ts                    # Updated: added DATABASE_URL, USE_DATABASE
    │   ├── server.ts                     # Updated: init pool and schema
    │   ├── db/
    │   │   ├── db.ts                     # New: connection pool management
    │   │   ├── schema.sql                # New: database schema
    │   │   ├── init-db.ts                # New: schema initialization
    │   │   └── db-meeting-store.ts       # New: PostgreSQL meeting store
    │   └── services/
    │       └── meeting-store.singleton.ts # Updated: dynamic backend selection
```

## What Happens on Startup

1. **Server starts** → `src/server.ts`
2. **Pool initialized** → `initializePool(DATABASE_URL)`
3. **Connection tested** → `testConnection()`
4. **Schema initialized** → `initializeDatabase()` (creates tables if not exist)
5. **Meeting store selected** → Uses PostgreSQL if available, falls back to files
6. **WebSocket server starts** → Ready for sessions
7. **Graceful shutdown** → Closes pool when process ends

## Performance Tips

### Query Optimization
```sql
-- Use indexes that are created
SELECT * FROM meetings WHERE session_id = 'xyz' LIMIT 1;      -- Fast
SELECT * FROM meetings WHERE created_at > NOW() - INTERVAL '7 days';  -- Fast
SELECT * FROM meeting_events WHERE event_type = 'transcript';  -- Fast
```

### Maintena nce
```bash
# Weekly: Analyze tables for query planning
docker exec copilot-postgres vacuumdb -U copilot copilot

# Monthly: Full maintenance
docker exec copilot-postgres reindexdb -U copilot copilot
```

### Backup Strategy
```bash
# Daily backup
docker exec copilot-postgres pg_dump -U copilot copilot > backup_$(date +%Y%m%d).sql

# Store in secure location
mv backup_*.sql /path/to/backups/

# Restore when needed
cat backup_20260320.sql | docker exec -i copilot-postgres psql -U copilot copilot
```

## Next Steps

1. ✅ Datastore installed and verified
2. Start using the system: `docker compose up -d --build`
3. Record meetings via the overlay UI
4. Query results via PostgreSQL or REST API
5. Set up automated backups for production

## Support

For issues:
1. Check [DATA_STORE_README.md](DATA_STORE_README.md) for detailed info
2. Review backend logs: `docker logs copilot-backend`
3. Check PostgreSQL logs: `docker logs copilot-postgres`
4. Query database directly: `docker exec -it copilot-postgres psql -U copilot -d copilot`

---

**Installation completed!** The system is now ready to store meeting data in PostgreSQL.
