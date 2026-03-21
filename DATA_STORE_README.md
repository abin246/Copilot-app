# PostgreSQL Datastore Setup & Configuration

This document explains the complete PostgreSQL datastore integration for the CoPilot system.

## Quick Start

### On Windows
```powershell
cd E:\CoPilot-APP
.\setup-datastore.bat
```

### On Linux/macOS
```bash
cd /path/to/CoPilot-APP
chmod +x setup-datastore.sh
./setup-datastore.sh
```

### Or Manually (All Platforms)
```bash
# Start PostgreSQL with storage profile
docker compose --profile storage up -d postgres

# Install PostgreSQL driver dependencies
cd services/gateway
npm install pg @types/pg

# Start the entire stack
cd ../..
docker compose up --build
```

## What Was Installed

### 1. Database Pool Connection (`src/db/db.ts`)
- **Purpose**: Manages PostgreSQL connection pooling
- **Features**:
  - Connection pool with max 20 connections
  - Auto-reconnection on idle timeout
  - Error handling and logging
  - Helper functions: `initializePool()`, `getPool()`, `testConnection()`, `withClient()`

### 2. Database Schema (`src/db/schema.sql`)
- **Tables**:
  - `meetings`: Stores session metadata (session_id, timestamps, duration)
  - `meeting_events`: Stores individual events (transcripts, AI responses, errors)
- **Indexes**: Created for optimal query performance on frequently searched columns

### 3. Schema Initialization (`src/db/init-db.ts`)
- Auto-initializes database schema on server startup
- Reads `schema.sql` and executes all CREATE statements
- Logs success/failure for easy debugging

### 4. PostgreSQL Meeting Store (`src/db/db-meeting-store.ts`)
- **Purpose**: Replaces file-based JSONL storage
- **Methods**:
  - `appendMeetingEvent()`: Inserts events into PostgreSQL
  - `listMeetings()`: Retrieves all meetings sorted by recency
  - `readMeeting()`: Retrieves all events for a specific session

### 5. Environment Configuration (`src/config/env.ts`)
- New variables:
  - `DATABASE_URL`: PostgreSQL connection string
  - `USE_DATABASE`: Enable/disable PostgreSQL (default: `true`)
  - `MEETINGS_DIR`: Fallback file storage directory

### 6. Server Initialization (`src/server.ts`)
- Initializes connection pool on startup
- Runs database schema initialization
- Tests connection and logs results
- Falls back to file-based storage if DB unavailable
- Graceful shutdown with connection cleanup

### 7. Meeting Store Singleton (`src/services/meeting-store.singleton.ts`)
- Dynamically selects storage backend:
  - Uses PostgreSQL if `USE_DATABASE=true` and connection works
  - Falls back to file-based storage as backup

## Architecture

```
┌─────────────────┐
│  Express App    │
└────────┬────────┘
         │
┌────────▼────────────────────┐
│  Meeting Store Singleton    │
│  (Dynamic backend selector) │
└────┬──────────────┬──────────┘
     │              │
     ▼              ▼
PostgreSQL        JSONL Files
(db-meeting-store) (meeting-store.service)
     │              │
     ▼              ▼
┌──────────────┐  ┌─────────────┐
│ PostgreSQL   │  │ File System │
│ Container    │  │ Backup      │
└──────────────┘  └─────────────┘
```

## Database Schema

### meetings table
```sql
CREATE TABLE meetings (
  id SERIAL PRIMARY KEY,
  session_id UUID UNIQUE NOT NULL,           -- Unique session identifier
  created_at TIMESTAMP WITH TIME ZONE,       -- When session started
  updated_at TIMESTAMP WITH TIME ZONE,       -- Last event timestamp
  duration_seconds INT,                      -- Session duration
  participant_count INT DEFAULT 1            -- Number of participants
);
```

### meeting_events table
```sql
CREATE TABLE meeting_events (
  id SERIAL PRIMARY KEY,
  meeting_id INT REFERENCES meetings(id),    -- Link to meeting
  event_type VARCHAR(50),                    -- 'transcript', 'ai', 'error', 'session'
  event_text TEXT,                           -- Text content
  event_data JSONB,                          -- Full event JSON
  created_at TIMESTAMP WITH TIME ZONE        -- When event occurred
);
```

## Connection Details

| Property | Value |
|----------|-------|
| **Host** | `postgres` (Docker) / `localhost` (Host machine) |
| **Port** | `5432` |
| **Username** | `copilot` |
| **Password** | `copilot` |
| **Database** | `copilot` |
| **Connection String** | `postgresql://copilot:copilot@postgres:5432/copilot` |

## Environment Configuration

### In `.env` file (or docker-compose.yml):
```env
DATABASE_URL=postgresql://copilot:copilot@postgres:5432/copilot
USE_DATABASE=true
```

### For local development (not in Docker):
```bash
# Change host from 'postgres' to 'localhost'
DATABASE_URL=postgresql://copilot:copilot@localhost:5432/copilot
USE_DATABASE=true
```

## Docker Compose Integration

The `docker-compose.yml` now includes:

```yaml
postgres:
  image: postgres:16-alpine
  container_name: copilot-postgres
  profiles: ["storage"]
  environment:
    - POSTGRES_USER=copilot
    - POSTGRES_PASSWORD=copilot
    - POSTGRES_DB=copilot
  ports:
    - "5432:5432"
  volumes:
    - postgres:/var/lib/postgresql/data
  networks:
    - copilot-network
```

Key features:
- Part of optional "storage" profile
- Lightweight Alpine Linux image
- Persistent volume for data
- Connected to copilot-network for service communication

## Accessing PostgreSQL

### From Docker Container
```bash
docker exec -it copilot-postgres psql -U copilot -d copilot
```

### From Host Machine
```bash
psql postgresql://copilot:copilot@localhost:5432/copilot
```

### Via Docker Logs
```bash
docker logs copilot-postgres
```

### Common psql Commands
```sql
-- List all tables
\dt

-- Describe table
\d meetings
\d meeting_events

-- Query meetings
SELECT * FROM meetings;

-- Query events for a session
SELECT * FROM meeting_events WHERE meeting_id = 1;

-- Count events by type
SELECT event_type, COUNT(*) FROM meeting_events GROUP BY event_type;

-- Exit
\q
```

## Troubleshooting

### Error: "Database connection failed"
1. Check if PostgreSQL is running: `docker ps | grep postgres`
2. Verify DATABASE_URL is correct
3. Test connection manually:
   ```bash
   docker exec copilot-postgres psql -U copilot -c "SELECT 1"
   ```

### Error: "ECONNREFUSED" when not using Docker
1. Ensure PostgreSQL is installed and running
2. Update DATABASE_URL to use `localhost` instead of `postgres`
3. Verify port 5432 is accessible

### Tables not created
1. Check backend logs: `docker logs copilot-backend`
2. Manually create tables: `docker exec -i copilot-postgres psql -U copilot -d copilot < services/gateway/src/db/schema.sql`

### Reset Everything
```bash
# Stop containers
docker compose down

# Remove volumes
docker volume rm copilot-postgres

# Start fresh
docker compose --profile storage up -d --build
```

## Performance & Optimization

### Current Indexes
- `meetings(session_id)` - Fast session lookup
- `meetings(created_at DESC)` - Recent meetings first
- `meeting_events(meeting_id)` - Events by session
- `meeting_events(event_type)` - Filter by event type
- `meeting_events(created_at DESC)` - Timeline queries

### Query Examples

```sql
-- Get recent meetings
SELECT * FROM meetings ORDER BY updated_at DESC LIMIT 10;

-- Get all events for a session
SELECT * FROM meeting_events 
WHERE meeting_id = (SELECT id FROM meetings WHERE session_id = 'abc-123')
ORDER BY created_at ASC;

-- Count events by type
SELECT event_type, COUNT(*) as count 
FROM meeting_events 
GROUP BY event_type;

-- Average session duration
SELECT AVG(duration_seconds) FROM meetings;
```

## Backup & Recovery

### Create Backup
```bash
docker exec copilot-postgres pg_dump -U copilot copilot > backup.sql
```

### Restore Backup
```bash
cat backup.sql | docker exec -i copilot-postgres psql -U copilot copilot
```

### Backup Volume Location
- **Windows Docker Desktop**: `\\wsl.localhost\docker-desktop-data\mnt\wsl\...`
- **Linux**: `/var/lib/docker/volumes/copilot-postgres/_data/`

## Production Considerations

1. **Change default credentials**:
   ```yaml
   environment:
     - POSTGRES_USER=produser
     - POSTGRES_PASSWORD=strong_password_123!
   ```

2. **Enable SSL connections**:
   ```
   sslmode=require
   ```

3. **Setup automated backups**: 
   - Daily pg_dump exports
   - Push to S3 or backup service

4. **Enable replication**:
   - Primary-replica setup for HA
   - Automatic failover

5. **Monitor database**:
   - Enable `pg_stat_statements`
   - Monitor slow queries
   - Track disk usage

## Files Modified/Created

### Created Files
- `src/db/db.ts` - Connection pool management
- `src/db/db-meeting-store.ts` - PostgreSQL meeting store
- `src/db/init-db.ts` - Schema initialization
- `src/db/schema.sql` - Database schema
- `setup-datastore.sh` - Linux/macOS setup script
- `setup-datastore.bat` - Windows setup script
- `DATA_STORE_README.md` - This file

### Modified Files
- `src/config/env.ts` - Added DATABASE_URL and USE_DATABASE
- `src/server.ts` - Initialize DB pool and schema
- `src/services/meeting-store.singleton.ts` - Dynamic backend selection
- `package.json` - Added pg and @types/pg
- `docker-compose.yml` - Added postgres dependency for backend

## Next Steps

1. ✅ Datastore is set up
2. Run: `npm install pg @types/pg` (already done if using stack)
3. Start stack: `docker compose up --build`
4. Check logs: `docker logs copilot-backend` 
5. Verify: Query the database with psql or via API endpoints

For any issues, check the troubleshooting section or the backend logs.
