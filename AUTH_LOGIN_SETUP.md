# Email Login Setup - Brief Guide

## ✅ What's Added

- **User registration with email**: `/api/auth/register`
- **User login with email**: `/api/auth/login`  
- **Protected endpoints**: `/api/auth/me`
- **JWT tokens**: 7-day expiry
- **Password hashing**: bcryptjs
- **Database tables**: users, sessions

## 🚀 Quick Start

### 1. Build & Start
```bash
docker compose up --build
```

### 2. Register New User
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure123",
    "name": "User Name"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

### 3. Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "secure123"
  }'
```

### 4. Use Token in Authenticated Endpoints
```bash
curl http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer eyJhbGc..."
```

## 📋 Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/register` | ❌ | Create new user |
| POST | `/api/auth/login` | ❌ | Get JWT token |
| GET | `/api/auth/me` | ✅ | Get current user |

## 🔑 Token Usage

All authenticated endpoints require:
```
Authorization: Bearer <jwt_token>
```

Token automatically added to request.user (id, email).

## ⚙️ Configuration

Set in `.env`:
```env
JWT_SECRET=your-secret-key-change-this
```

Default: `change-me-in-production`

## 🗄️ Database

New tables automatically created:
- `users` - email, password_hash, name
- `sessions` - user_id, token_hash, expires_at

Meetings linked to users via `user_id` foreign key.

## 🔒 Security Notes

- Passwords hashed with bcryptjs (10 rounds)
- JWT expires after 7 days
- Change `JWT_SECRET` in production
- Tokens stored in Bearer header

## 📝 Next Steps

1. Connect frontend to `/api/auth/register` and `/api/auth/login`
2. Store returned token in localStorage/sessionStorage
3. Send token in Authorization header for authenticated requests
4. Update env with strong `JWT_SECRET` for production

---

**Email login is ready to use! 🎉**
