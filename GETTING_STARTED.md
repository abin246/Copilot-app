# 🚀 PostgreSQL Datastore - Getting Started Checklist

Complete these steps to start using your PostgreSQL datastore immediately!

---

## ✅ Pre-Start Checklist

Before starting, verify you have:

- [ ] Docker Desktop running
- [ ] Docker Compose installed (`docker compose --version` works)
- [ ] Node.js 18+ installed (`node --version` shows v18+)
- [ ] At least 2GB free disk space
- [ ] Port 5432 available (not used by another app)

**To check all at once:**
```bash
docker --version && docker compose --version && node --version
```

---

## 🎯 Quick Start (5 Minutes)

### Step 1: Navigate to Project
```bash
cd E:\CoPilot-APP
```

### Step 2: Start PostgreSQL
```bash
docker compose --profile storage up -d postgres
```

**Expected:** Container starts  
**Verify:** `docker ps | findstr postgres` shows running container

### Step 3: Wait for Database Ready
```bash
# Test connection (repeat until success)
docker exec copilot-postgres pg_isready -U copilot

# Should show: accepting connections
```

### Step 4: Start Backend
```bash
docker compose up --build backend
```

**Expected:** Logs show:
```
✓ Database connection successful
✓ Database schema initialized successfully
📊 Using PostgreSQL for meeting storage
🚀 Server running on port 4000
```

### Step 5: Verify in New Terminal
```bash
# Check API is responding
curl http://localhost:4000/health

# Should return: {"status":"ok"}
```

**🎉 You're done! PostgreSQL is now handling your data.**

---

## 🧪 Full Verification (10 Minutes)

Run these tests to ensure everything works:

### Test 1: PostgreSQL Container
```bash
# ✓ Container should be running
docker ps | findstr postgres

# ✓ Should show:
# copilot-postgres  postgres:16-alpine  Up X seconds  0.0.0.0:5432->5432/tcp
```

### Test 2: Database Connection
```bash
# ✓ Should return "accepting connections"
docker exec copilot-postgres pg_isready -U copilot
```

### Test 3: Backend Logs
```bash
# ✓ Should show database connection successful
docker logs copilot-backend | grep -i "database connection"

# ✓ Should show schema initialized
docker logs copilot-backend | grep -i "schema initialized"

# ✓ Should show using PostgreSQL
docker logs copilot-backend | grep -i "using postgresql"
```

### Test 4: Database Tables
```bash
# ✓ Should show "meetings" and "meeting_events" tables
docker exec -it copilot-postgres psql -U copilot -d copilot -c "\dt"

# Expected output:
#                List of relations
#  Schema |         Name          | Type  | Owner   
# --------+-----------------------+-------+---------
#  public | meeting_events        | table | copilot
#  public | meetings              | table | copilot
```

### Test 5: API Endpoint
```bash
# ✓ Should return {"meetings":[]}
curl http://localhost:4000/api/meetings

# Or use PowerShell:
Invoke-WebRequest http://localhost:4000/api/meetings
```

### Test 6: Insert Test Data
```bash
# ✓ Insert a test meeting
docker exec -it copilot-postgres psql -U copilot -d copilot << EOF
INSERT INTO meetings (session_id, duration_seconds) 
VALUES ('test-session-001', 120);

INSERT INTO meeting_events (meeting_id, event_type, event_text)
VALUES (1, 'transcript', 'Hello, this is a test');

SELECT * FROM meetings;
SELECT * FROM meeting_events;
EOF

# ✓ Query via API
curl http://localhost:4000/api/meetings
curl http://localhost:4000/api/meetings/test-session-001
```

---

## 🎨 Start Full Stack (With UI)

Start the complete system including frontend:

```bash
# All services (Ollama, STT, Backend, Frontend, PostgreSQL)
docker compose --profile storage up -d --build

# OR without storage profile:
docker compose up -d --build
```

**Access points:**
- **Web UI:** http://localhost:3000
- **API:** http://localhost:4000
- **Database:** psql postgresql://copilot:copilot@localhost:5432/copilot

---

## 📊 Monitor & Debug

### View All Running Services
```bash
docker ps
```

### Check Backend Logs (Real-time)
```bash
docker logs -f copilot-backend
```

### Check PostgreSQL Logs
```bash
docker logs copilot-postgres
```

### Open Database Shell
```bash
docker exec -it copilot-postgres psql -U copilot -d copilot
```

**Common commands inside psql:**
```sql
\dt                              -- List all tables
SELECT * FROM meetings;          -- View meetings
SELECT * FROM meeting_events;    -- View events
SELECT COUNT(*) FROM meetings;   -- Count meetings
\q                               -- Exit
```

---

## 🔄 Common Workflows

### Create a Test Meeting
```bash
docker exec -it copilot-postgres psql -U copilot -d copilot << EOF
BEGIN;

INSERT INTO meetings (session_id, participant_count, duration_seconds)
VALUES ('demo-' || gen_random_uuid()::text, 2, 300)
RETURNING id;

-- Note the returned ID, then:
INSERT INTO meeting_events (meeting_id, event_type, event_text, event_data)
VALUES 
  (1, 'session', '', '{"sessionId": "demo-001"}'),
  (1, 'transcript', 'Good morning everyone', '{"ts": 1000}'),
  (1, 'ai', 'Good morning! How can I help?', '{"ts": 2000}');

COMMIT;

SELECT * FROM meetings;
SELECT * FROM meeting_events;
EOF
```

### Backup Database
```bash
# Create backup file
docker exec copilot-postgres pg_dump -U copilot copilot > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh backup_*.sql
```

### Restore from Backup
```bash
cat backup_20260320_120000.sql | docker exec -i copilot-postgres psql -U copilot copilot
```

### Reset Database (Delete All Data)
```bash
docker exec -it copilot-postgres psql -U copilot -d copilot << EOF
TRUNCATE meeting_events CASCADE;
TRUNCATE meetings CASCADE;
VACUUM;
EOF
```

### View Database Statistics
```bash
docker exec -it copilot-postgres psql -U copilot -d copilot << EOF
SELECT 
  'meetings' as table_name, 
  COUNT(*) as row_count 
FROM meetings
UNION ALL
SELECT 
  'meeting_events' as table_name, 
  COUNT(*) as row_count 
FROM meeting_events;
EOF
```

---

## 🛑 Stopping Services

### Stop Specific Service
```bash
# Stop PostgreSQL (data preserved)
docker stop copilot-postgres

# Stop backend
docker stop copilot-backend

# Stop all
docker stop $(docker ps -q)
```

### Clean Full Reset
```bash
# Stop all containers
docker compose down

# Remove database volume (⚠️  DELETES DATA)
docker volume rm copilot-postgres

# Remove all volumes
docker volume prune

# Start fresh
docker compose --profile storage up -d --build
```

---

## 🆘 Quick Troubleshooting

### Problem: "Connection refused"
```bash
# Start PostgreSQL
docker compose --profile storage up -d postgres

# Wait a moment, then test
docker exec copilot-postgres pg_isready -U copilot
```

### Problem: "Port 5432 already in use"
```bash
# Find what's using port 5432
netstat -an | findstr 5432

# Stop that container
docker stop container_id

# Restart
docker compose --profile storage up -d postgres
```

### Problem: "Database not initialized"
```bash
# Manually initialize
docker exec -i copilot-postgres psql -U copilot -d copilot < services/gateway/src/db/schema.sql

# Verify
docker exec -it copilot-postgres psql -U copilot -d copilot -c "\dt"
```

### Problem: "Backend won't connect"
```bash
# Check backend logs
docker logs copilot-backend

# Verify DATABASE_URL is set
docker exec copilot-backend env | grep DATABASE_URL

# Ensure PostgreSQL is running
docker ps | grep postgres
```

---

## 📋 Configuration Files

### `.env` (Create if Needed)
```env
DATABASE_URL=postgresql://copilot:copilot@postgres:5432/copilot
USE_DATABASE=true
OLLAMA_API=http://localhost:11434
STT_API=http://localhost:8001/transcribe
```

### Connection String
```
postgresql://copilot:copilot@postgres:5432/copilot

# Components:
# postgresql:// - Protocol
# copilot:copilot - Username:Password
# postgres - Host (change to localhost if not in Docker)
# 5432 - Port
# copilot - Database name
```

---

## 📚 Additional Resources

| Document | When to Use |
|----------|------------|
| [DATASTORE_QUICK_REFERENCE.md](DATASTORE_QUICK_REFERENCE.md) | Quick commands & common tasks |
| [DATASTORE_INSTALLATION.md](DATASTORE_INSTALLATION.md) | Detailed step-by-step setup |
| [DATA_STORE_README.md](DATA_STORE_README.md) | Complete technical documentation |
| [DATASTORE_SETUP_SUMMARY.md](DATASTORE_SETUP_SUMMARY.md) | Overview & architecture |
| `.env.example` | Environment variable template |

---

## ✨ Next Steps

1. ✅ Follow quick start above (5 minutes)
2. ✅ Run full verification tests (10 minutes)
3. 🎯 Start recording meetings
4. 📊 Query data via API or psql
5. 💾 Setup automated backups
6. 📖 Read [DATA_STORE_README.md](DATA_STORE_README.md) for advanced usage

---

## 🎉 You're Ready!

Your PostgreSQL datastore is now:
- ✅ Installed
- ✅ Configured
- ✅ Running
- ✅ Ready for production use

**Start recording meetings now!** 🎥📊

---

### Quick Commands Cheat Sheet

```bash
# Start stack
docker compose --profile storage up -d --build

# Check status
docker ps

# View logs
docker logs -f copilot-backend

# Access database
docker exec -it copilot-postgres psql -U copilot -d copilot

# Test API
curl http://localhost:4000/api/meetings

# Backup
docker exec copilot-postgres pg_dump -U copilot copilot > backup.sql

# Stop all
docker compose down
```

---

**Last Updated:** March 20, 2026  
**Status:** Ready to Use ✅  
**Version:** 1.0.0
