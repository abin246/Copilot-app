# PostgreSQL Datastore - Quick Reference Card

## 🚀 Quick Start Commands

### Windows
```powershell
# One-click setup
.\setup-datastore.bat

# Or manual setup
docker compose --profile storage up -d postgres
cd services\gateway
npm install pg @types/pg
cd ..\..
docker compose up --build
```

### Linux/macOS
```bash
# One-click setup
./setup-datastore.sh

# Or manual setup
docker compose --profile storage up -d postgres
cd services/gateway
npm install pg @types/pg
cd ../..
docker compose up --build
```

## 🔌 Connection String
```
postgresql://copilot:copilot@localhost:5432/copilot
```

**Docker:** Use `postgres` instead of `localhost`

## 🗄️ Database Info

| Item | Value |
|------|-------|
| Host | `postgres` (Docker) / `localhost` (Host) |
| Port | `5432` |
| User | `copilot` |
| Pass | `copilot` |
| Database | `copilot` |

## 📋 Tables

### meetings
```sql
-- Session metadata
id, session_id (UUID), created_at, updated_at, 
duration_seconds, participant_count
```

### meeting_events
```sql
-- Event log (transcripts, AI responses, errors)
id, meeting_id, event_type, event_text, 
event_data (JSONB), created_at
```

## 🔍 Common Commands

### Docker Management
```bash
# Start PostgreSQL
docker compose --profile storage up -d postgres

# Check status
docker ps | grep postgres

# View logs
docker logs copilot-postgres

# Open database shell
docker exec -it copilot-postgres psql -U copilot -d copilot

# Stop PostgreSQL
docker stop copilot-postgres
```

### Database Queries
```bash
# List tables
docker exec -it copilot-postgres psql -U copilot -d copilot -c "\dt"

# Show current connections
docker exec -it copilot-postgres psql -U copilot -d copilot -c "SELECT * FROM pg_stat_activity;"

# Check database size
docker exec -it copilot-postgres psql -U copilot -d copilot -c "SELECT pg_size_pretty(pg_database_size('copilot'));"
```

### Data Management
```bash
# Backup database
docker exec copilot-postgres pg_dump -U copilot copilot > backup.sql

# Restore from backup
cat backup.sql | docker exec -i copilot-postgres psql -U copilot copilot

# Delete all data (full reset)
docker exec -it copilot-postgres psql -U copilot -d copilot << EOF
TRUNCATE meeting_events;
TRUNCATE meetings;
EOF

# Get meeting count
docker exec -it copilot-postgres psql -U copilot -d copilot -c "SELECT COUNT(*) FROM meetings;"
```

## 🧪 Verification

### 1. Check PostgreSQL is Running
```bash
docker ps | grep postgres
# Should see: copilot-postgres ... Up X seconds
```

### 2. Test Connection
```bash
docker exec copilot-postgres pg_isready -U copilot
# Should see: accepting connections
```

### 3. Verify Backend Connected
```bash
docker logs copilot-backend | grep "Database connection"
# Should see: ✓ Database connection successful
```

### 4. Check Schema Created
```bash
docker exec -it copilot-postgres psql -U copilot -d copilot -c "\dt"
# Should show: meetings, meeting_events tables
```

## 📊 REST API Endpoints

### Auth
```bash
# Register new user
curl -X POST http://localhost:4000/api/auth/register -H "Content-Type: application/json" -d '{"email":"user@example.com","password":"secure123","name":"User"}'

# Login
curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{"email":"user@example.com","password":"secure123"}'

# Get current user (requires token)
curl -H "Authorization: Bearer <token>" http://localhost:4000/api/auth/me
```

### Meetings
```bash
# List all meetings
curl http://localhost:4000/api/meetings

# Get specific meeting
curl http://localhost:4000/api/meetings/SESSION_ID

# Check backend health
curl http://localhost:4000/health
```

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `.env` | Environment variables (DATABASE_URL, USE_DATABASE) |
| `docker-compose.yml` | Service definitions and dependencies |
| `src/db/schema.sql` | Database schema |
| `src/config/env.ts` | Environment validation |

## 📁 Key Files Modified

- `src/server.ts` - Initialize database on startup
- `src/services/meeting-store.singleton.ts` - Select storage backend
- `src/config/env.ts` - Add database config
- `package.json` - Add pg dependency
- `docker-compose.yml` - Configure postgres service

## ⚡ Performance Tips

```sql
-- Query with indexes (fast)
SELECT * FROM meetings WHERE session_id = 'abc-123';

-- Expensive query (avoid)
SELECT * FROM meeting_events WHERE event_data::text LIKE '%search%';

-- Good aggregation
SELECT event_type, COUNT(*) FROM meeting_events GROUP BY event_type;
```

## 🆘 Troubleshooting

### Database Connection Failed
```bash
# 1. Check PostgreSQL is running
docker ps | grep postgres

# 2. Verify connection
docker exec copilot-postgres pg_isready -U copilot

# 3. Check backend environment
docker exec copilot-backend env | grep DATABASE_URL

# 4. View backend logs
docker logs -f copilot-backend
```

### Port 5432 Already in Use
```bash
# Find process using port
netstat -an | findstr 5432

# Kill conflicting container
docker stop container_id

# Restart PostgreSQL
docker compose --profile storage up -d postgres
```

### Tables Missing
```bash
# Manually run schema
docker exec -i copilot-postgres psql -U copilot -d copilot < services/gateway/src/db/schema.sql

# Verify
docker exec -it copilot-postgres psql -U copilot -d copilot -c "\dt"
```

### Reset Everything
```bash
# Stop all
docker compose down

# Remove volumes
docker volume rm copilot-postgres

# Start fresh
docker compose --profile storage up -d --build
```

## 📞 Support Resources

| Problem | Document |
|---------|----------|
| Installation help | `DATASTORE_INSTALLATION.md` |
| Complete reference | `DATA_STORE_README.md` |
| Setup complete summary | `DATASTORE_SETUP_COMPLETE.md` |
| PostgreSQL docs | https://www.postgresql.org/docs/16/ |
| Node.js pg docs | https://node-postgres.com/ |

## 🎯 Next Steps

1. ✅ Review [DATASTORE_SETUP_COMPLETE.md](DATASTORE_SETUP_COMPLETE.md)
2. 🚀 Run: `docker compose --profile storage up -d --build`
3. 📊 Check logs: `docker logs -f copilot-backend`
4. 🔌 Test: `curl http://localhost:4000/api/meetings`
5. 💾 Setup backups: `docker exec copilot-postgres pg_dump ...`

---

**PostgreSQL datastore ready to use! 🎉**
