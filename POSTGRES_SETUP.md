# PostgreSQL Setup Guide

PostgreSQL is configured in the system for persistent data storage. It's currently part of the optional "storage" profile.

## Quick Start

### Option 1: Enable PostgreSQL via Docker Compose (Recommended)

Run with the storage profile enabled:

```bash
docker compose --profile storage up -d --build
```

This will start:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Qdrant Vector DB (port 6333)

### Option 2: Start Only PostgreSQL

```bash
# Start only postgres (and other core services)
docker compose up -d ollama stt backend frontend postgres --build
```

## PostgreSQL Connection Details

**Host:** `postgres` (from inside Docker) or `localhost` (from host)  
**Port:** `5432`  
**Username:** `copilot`  
**Password:** `copilot`  
**Database:** `copilot`

### Connection String
```
postgresql://copilot:copilot@postgres:5432/copilot
```

## Installation Steps (Exact Method)

### Step 1: Docker Compose Configuration (Already Done)

PostgreSQL is configured in `docker-compose.yml`:

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

**Key Features:**
- **Image:** `postgres:16-alpine` (lightweight, PostgreSQL 16)
- **Authentication:** Pre-configured credentials
- **Persistence:** Data stored in `postgres` volume
- **Network:** Connected to `copilot-network` for inter-service communication

### Step 2: Volume Creation

Docker automatically creates the `postgres` volume to persist data between container restarts.

View volumes:
```bash
docker volume ls | grep postgres
```

### Step 3: Adding PostgreSQL Support to Gateway

To use PostgreSQL from the Node.js gateway, install the PostgreSQL driver:

```bash
cd services/gateway
npm install pg
npm install --save-dev @types/pg
```

### Step 4: Configure Environment Variables

Add to `.env` or `docker-compose.yml` environment:

```env
DATABASE_URL=postgresql://copilot:copilot@postgres:5432/copilot
```

### Step 5: Start PostgreSQL

```bash
# Start with storage profile
docker compose --profile storage up -d

# Verify it's running
docker ps | grep postgres

# Check logs
docker logs copilot-postgres
```

## Database Connection from Node.js

### Basic Connection Example

```typescript
import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://copilot:copilot@postgres:5432/copilot'
});

await client.connect();
const result = await client.query('SELECT NOW()');
console.log(result.rows);
await client.end();
```

### Connection Pool (Recommended for Services)

```typescript
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://copilot:copilot@postgres:5432/copilot',
  max: 20,
});

// Use pool for queries
const result = await pool.query('SELECT * FROM meetings');
```

## Database Management

### Access PostgreSQL CLI (psql)

From host machine:
```bash
docker exec -it copilot-postgres psql -U copilot -d copilot
```

### Common Commands in psql

```sql
-- List all databases
\l

-- Connect to copilot database
\c copilot

-- List all tables
\dt

-- Describe table structure
\d table_name

-- Run a query
SELECT * FROM meetings;

-- Exit
\q
```

### Create Tables for Meeting Storage

```sql
CREATE TABLE IF NOT EXISTS meetings (
  id SERIAL PRIMARY KEY,
  session_id UUID UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  duration_seconds INT,
  participant_count INT
);

CREATE TABLE IF NOT EXISTS meeting_events (
  id SERIAL PRIMARY KEY,
  meeting_id INT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  event_type VARCHAR(50),
  event_data JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_session_id ON meetings(session_id);
CREATE INDEX idx_meeting_id ON meeting_events(meeting_id);
```

## Data Persistence

### Location
- **Host:** `docker volume inspect postgres` to see mount point
- **Windows Docker Desktop:** `\\wsl.localhost\docker-desktop-data\mnt\wsl\...`
- **Linux:** `/var/lib/docker/volumes/copilot-postgres/_data/`

### Backup Database

```bash
# Backup to SQL file
docker exec copilot-postgres pg_dump -U copilot copilot > backup.sql

# Restore from backup
cat backup.sql | docker exec -i copilot-postgres psql -U copilot copilot
```

### Reset Database

```bash
# Remove container
docker rm -f copilot-postgres

# Remove volume
docker volume rm copilot-postgres

# Start fresh
docker compose --profile storage up -d postgres
```

## Troubleshooting

### Check PostgreSQL Status

```bash
docker ps | grep postgres
docker logs copilot-postgres
```

### Test Connection from Gateway Container

```bash
docker exec copilot-backend psql postgresql://copilot:copilot@postgres:5432/copilot -c "SELECT 1"
```

### Connection Timeout Issues

Ensure:
1. PostgreSQL container is running: `docker ps | grep postgres`
2. Gateway depends on postgres: Check `docker-compose.yml`
3. Network connectivity: Both containers on `copilot-network`

### Reset Everything

```bash
# Stop all containers
docker compose down

# Remove storage volumes
docker volume rm copilot-postgres copilot-redis

# Start fresh with storage profile
docker compose --profile storage up -d --build
```

## Production Considerations

For production use:

1. **Change default credentials** in `.env`:
   ```env
   POSTGRES_USER=myuser
   POSTGRES_PASSWORD=strong_password_here
   ```

2. **Backup strategy:** Regular automated backups

3. **Connection pooling:** Use pgBouncer for high-traffic scenarios

4. **Replication:** Set up PostgreSQL replication

5. **Monitoring:** Use tools like pg_stat_statements, pgAdmin

## Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js pg Module](https://github.com/brianc/node-postgres)
- [Docker PostgreSQL Image](https://hub.docker.com/_/postgres)
