# Redis OTP Implementation Guide

## Overview
This backend now uses **Redis** for storing One-Time Passwords (OTPs) instead of the PostgreSQL database. This provides:
- **Fast TTL expiry** (5-minute OTP lifetime)
- **Atomic operations** to prevent replay attacks
- **Attempt throttling** (max 5 attempts per 5 minutes)
- **Scalability** for multi-instance deployments
- **Foundation** for caching bus schedules and other ephemeral data

## Architecture Changes

### Before (DB-backed OTP)
```
register() → generate OTP → store in User.otp → send email
verify() → read User.otp → compare → update isVerified
```

### After (Redis-backed OTP)
```
register() → generate OTP → hash OTP → store hashed in Redis (5m TTL) → send email
verify() → atomically get & delete from Redis → compare hash → update isVerified
```

## Setup Instructions

### 1. Install Redis (Local, No Docker)

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl enable --now redis-server
# Verify
redis-cli ping
# Output: PONG
```

**macOS:**
```bash
brew install redis
brew services start redis
redis-cli ping
```

**Windows:**
- Download from: https://github.com/microsoftarchive/redis/releases
- Or use WSL2 + Linux commands above

### 2. Update Environment Variables

Add `REDIS_URL` to your `.env`:
```bash
REDIS_URL=redis://127.0.0.1:6379
```

For production, use: `redis://user:password@host:port`

### 3. Install Backend Dependencies

```bash
cd backend
npm install ioredis
```

(Already added to `package.json` — running `npm install` installs it)

### 4. Run Backend

```bash
npm run start:dev
```

The app will:
1. Connect to Redis on startup
2. Log Redis connection status
3. Use Redis for OTP operations

## File Structure

```
src/
├── redis/
│   ├── redis.provider.ts     # ioredis client factory
│   ├── redis.service.ts      # Typed wrapper for Redis operations
│   └── redis.module.ts       # Nest module (exported to auth)
├── auth/
│   ├── auth.service.ts       # Updated to use RedisService
│   ├── auth.module.ts        # Imports RedisModule
│   ├── auth.controller.ts
│   └── dto/
└── ...
```

## Redis Keys & TTL Strategy

| Key | Format | TTL | Purpose |
|-----|--------|-----|---------|
| OTP | `otp:{email}` | 300s | Hashed OTP for verification |
| Attempts | `otp-attempts:{email}` | 300s | Failed attempt counter |
| Schedules | `schedule:route:{id}` | Variable | Bus route/schedule cache |
| Versions | `schedule:route:{id}:v` | ∞ | Version tracking for cache invalidation |

## API Flow (OTP)

### Register
```
POST /auth/register
{
  "name": "John",
  "email": "john@example.com",
  "password": "securepass",
  "role": "STUDENT"
}
```
Response:
```json
{ "message": "User registered. Verify OTP." }
```

Redis state after register:
```
otp:john@example.com → "hashed_otp_value"  (TTL: 300s)
```

### Verify OTP
```
POST /auth/verify-otp
{
  "email": "john@example.com",
  "otp": "123456"
}
```

On success:
```json
{ "message": "Account verified successfully" }
```

Redis operations:
1. Get hashed OTP from `otp:john@example.com` (atomic delete)
2. Compare with `bcrypt.compare(provided_otp, stored_hash)`
3. On match → update DB `isVerified = true`
4. On fail → increment `otp-attempts:john@example.com`
5. If attempts >= 5 → block further tries

## Testing OTP Flow Locally

### Via cURL

**1. Register:**
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "Test@123",
    "role": "STUDENT"
  }'
```

**2. Check Redis for OTP:**
```bash
redis-cli
> get otp:test@example.com
# Returns the hashed OTP (long string)
```

**3. Get plain OTP from logs or email:**
- Check backend logs for OTP value sent (in production, check email)
- Or check Redis expiry: `ttl otp:test@example.com` (shows remaining seconds)

**4. Verify OTP:**
```bash
curl -X POST http://localhost:3001/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "otp": "123456"
  }'
```

### Via Postman

Create requests:
1. **Register** → POST `localhost:3001/auth/register`
2. **Verify OTP** → POST `localhost:3001/auth/verify-otp`

### Via Redis CLI (Monitoring)

```bash
redis-cli
> MONITOR
```

Then run the above requests to see Redis commands in real-time.

## Security Notes

- ✅ OTPs are **hashed** before storing (bcrypt)
- ✅ Atomic **read-and-delete** prevents replay attacks
- ✅ **Attempt limiting** (5 tries per 5 minutes)
- ✅ Hashed comparison prevents timing attacks
- ⚠️ **In production:** use password-protected Redis and TLS

## Future: Bus Schedule Caching

The `RedisService` is extensible for bus schedules:

```typescript
// Cache a bus schedule
await this.redisService.cacheSchedule(
  'schedule:route:1',
  {
    stops: [...],
    arrivals: [...],
    crowdLevel: 'MODERATE'
  },
  3600  // 1-hour cache
);

// Retrieve it
const schedule = await this.redisService.getSchedule('schedule:route:1');
```

### Invalidation patterns:
- **Write-through:** Update DB → delete Redis key → fetch fresh
- **Cache-aside:** Read from Redis, if miss, fetch DB and cache
- **Pub/Sub:** Publish invalidation messages for multi-instance sync

## Environment Variables Summary

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis
REDIS_URL=redis://127.0.0.1:6379

# Auth
JWT_SECRET=your-secret-key

# Email
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Server
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Redis connection refused | Ensure `redis-server` is running: `redis-cli ping` |
| OTP expired immediately | Check `REDIS_URL` and Redis TTL settings |
| Too many attempts error | Wait 5 minutes or manually flush: `redis-cli del otp-attempts:{email}` |
| Hashing errors | Ensure `bcrypt` is installed: `npm install bcrypt` |

## Next Steps

1. Test OTP flow locally
2. Add more caching keys as needed (schedules, configs)
3. Implement pub/sub for real-time updates
4. Move to production Redis (managed service or self-hosted with auth/TLS)

---

**Implemented:** May 16, 2026  
**Branch:** `feature/redis`  
**Technologies:** NestJS, Redis (ioredis), bcrypt, Prisma
