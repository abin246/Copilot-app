# 🚀 Running the Complete App (Backend + Frontend + Database)

## Quick Start - 3 Commands

### Terminal 1: Start Database + Backend
```bash
cd E:\CoPilot-APP
docker compose --profile storage up --build
# Wait for PostgreSQL and backend to start
# Backend runs on http://localhost:4000
```

### Terminal 2: Start Frontend
```bash
cd E:\CoPilot-APP\apps\overlay-ui
npm run dev
# Frontend runs on http://localhost:3000
```

### Terminal 3: Test API (Optional)
```bash
# Test backend with curl
curl http://localhost:4000/health
# Should respond with: {"status":"ok"}
```

---

## Full Architecture

```
┌────────────────────────────────────────────────────┐
│         Frontend (Next.js)                          │
│  http://localhost:3000                             │
│  ├─ Login/Register Pages                           │
│  ├─ Protected Dashboard                            │
│  ├─ Meetings List                                  │
│  └─ Settings Page                                  │
└────────────────────────────────────────────────────┘
                      ↓ (HTTP)
┌────────────────────────────────────────────────────┐
│      Gateway Service (Express + WebSocket)         │
│  http://localhost:4000                             │
│  ├─ POST /api/auth/register                        │
│  ├─ POST /api/auth/login                           │
│  ├─ GET  /api/auth/me                              │
│  └─ GET  /api/meetings                             │
└────────────────────────────────────────────────────┘
                      ↓ (SQL)
┌────────────────────────────────────────────────────┐
│      PostgreSQL Database (Docker)                  │
│  localhost:5432                                    │
│  ├─ users table                                    │
│  ├─ sessions table                                 │
│  ├─ meetings table                                 │
│  └─ meeting_events table                           │
└────────────────────────────────────────────────────┘
```

---

## Step-by-Step Setup

### 1. Verify Docker is Running
```powershell
docker ps
# Should show some containers or "CONTAINER ID" header
```

### 2. Start Backend Stack
```powershell
cd E:\CoPilot-APP
docker compose --profile storage up --build

# Output should show:
# - Creating postgres...
# - Creating redis... (if configured)
# - Starting backend...
# - Database connection successful ✓
# - Server running on port 4000 ✓
```

### 3. Wait for Backend Ready
Look for:
```
✓ Database connection successful
✓ Database schema initialized successfully
🚀 Server running on port 4000
```

### 4. In New Terminal: Start Frontend
```powershell
cd E:\CoPilot-APP\apps\overlay-ui
npm run dev

# Output should show:
# ▲ Next.js 14.1.0
# - Local: http://localhost:3000
# ✓ Ready in 2.3s
```

### 5. Open Browser
Navigate to: http://localhost:3000

---

## First Time Usage

### 1. Register Account
- Click "Create one" on login page
- Fill in: Name, Email, Password
- Click "Create account"
- Auto-redirected to dashboard

### 2. View Dashboard
- See welcome message with your name
- View stats cards (initially 0)
- See recent activity section

### 3. Navigate App
- **Dashboard** - Home page
- **Meetings** - List of meetings (initially empty)
- **Settings** - User preferences
- **Logout** - Sign out

### 4. Test Copilot Panel
- Go back to Home (/)
- Click into CopilotPanel
- Interact with audio/messaging features

---

## Verify Everything Works

### Test 1: Can Register
```bash
# In browser or with curl:
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","name":"Test"}'

# Response should have: token and user object
```

### Test 2: Can Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# Response should have: token and user object
```

### Test 3: Can Access Meetings
```bash
curl http://localhost:4000/api/meetings

# Response should be array of meetings (empty initially)
```

### Test 4: Frontend Loads
- Open http://localhost:3000 in browser
- Should redirect to /login if not authenticated
- After login, dashboard loads successfully

---

## Troubleshooting

### Docker Container Won't Start
```bash
# Check logs
docker logs copilot-postgres
docker logs copilot-backend

# If port conflicts, stop other services
docker ps -a
docker rm container_id
```

### Backend Fails to Connect to Database
```powershell
# Check if postgres is running
docker ps | findstr postgres

# If not running, restart
docker compose --profile storage up postgres -d
```

### Frontend Won't Build
```bash
cd apps\overlay-ui
npm install
npm run build

# Check for TypeScript errors
```

### CORS Errors in Browser Console
- Ensure backend is running on :4000
- Check that requests go to http://localhost:4000 (not :3000)
- Backend already has CORS enabled

### Token Errors
```bash
# Clear localStorage in browser devtools
# Application → Local Storage → http://localhost:3000 → Delete all
# Refresh and login again
```

### Database Already Exists
```bash
# If you want a fresh database
docker volume rm copilot-postgres-volume

# Then restart containers
docker compose --profile storage down -v
docker compose --profile storage up -d
```

---

## File Changes Summary

### Backend Files Added/Modified
✅ `src/services/auth.service.ts` - Auth logic
✅ `src/middleware/auth.middleware.ts` - Token verification
✅ `src/routes/auth.routes.ts` - Auth endpoints
✅ `src/db/auth-schema.sql` - Database tables
✅ `src/app.ts` - Added auth routes
✅ `src/config/env.ts` - Added JWT_SECRET
✅ `src/db/init-db.ts` - Auto-init auth tables
✅ `package.json` - Added jsonwebtoken, bcryptjs

### Frontend Files Added/Modified
✅ `hooks/useAuth.tsx` - Auth context & hook
✅ `components/Header.tsx` - Navigation header
✅ `components/ProtectedRoute.tsx` - Auth guard
✅ `app/layout.tsx` - AuthProvider wrapper
✅ `app/page.tsx` - Home with redirect
✅ `app/login/page.tsx` - Login form
✅ `app/register/page.tsx` - Register form
✅ `app/dashboard/page.tsx` - Dashboard (protected)
✅ `app/meetings/page.tsx` - Meetings list (protected)
✅ `app/settings/page.tsx` - Settings (protected)

---

## Ports Reference

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Backend | 4000 | http://localhost:4000 |
| PostgreSQL | 5432 | postgres://user:pass@localhost:5432/copilot |
| Redis | 6379 | redis://localhost:6379 (if used) |

---

## Environment Variables

### Backend (.env / docker-compose.yml)
```env
DATABASE_URL=postgresql://copilot:copilot@localhost:5432/copilot
USE_DATABASE=true
JWT_SECRET=change-me-in-production
```

### Frontend (No new env vars needed)
Uses hardcoded `http://localhost:4000` for backend

---

## Production Deployment

See `PRODUCTION_DEPLOYMENT.md` for:
- Production-grade database setup
- PgBouncer connection pooling
- Monitoring & alerting
- Automated backups
- High availability setup

---

## Next Development Steps

1. **Add Real Data** - Connect copilot features to save meetings to DB
2. **Enhance Dashboard** - Show real stats from database
3. **User Profile** - Let users edit name/email
4. **Email Verification** - Send verification emails
5. **Two-Factor Auth** - Add 2FA support
6. **OAuth** - Google/GitHub authentication

---

**Everything is set up and ready to run!** 🚀

Run: `docker compose --profile storage up --build` and `npm run dev` in apps/overlay-ui

Then open http://localhost:3000
