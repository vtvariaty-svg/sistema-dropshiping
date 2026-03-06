# Dropship SaaS — Module 0: Foundation

Multi-tenant SaaS platform for dropshipping automation.

## Architecture

```
/
├── apps/
│   ├── api/          # Fastify backend (port 3001)
│   └── web/          # Next.js frontend (port 3000)
├── packages/
│   └── shared/       # Shared types + Zod schemas
├── prisma/
│   ├── schema.prisma # Database models
│   └── seed.ts       # Demo data seed
├── .env.example
└── README.md
```

## Tech Stack

| Layer     | Tech                         |
|-----------|------------------------------|
| Backend   | Node.js 20, Fastify, TypeScript |
| ORM       | Prisma                       |
| Database  | PostgreSQL (Neon)            |
| Frontend  | Next.js 14, React, Tailwind  |
| Auth      | JWT + httpOnly refresh cookie |
| Validation| Zod                          |

## Local Development

### Prerequisites
- Node.js 20+
- PostgreSQL (local or [Neon](https://neon.tech))

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
```

Edit `.env` with your database URL and secrets (min 32 chars each):
```
DATABASE_URL=postgresql://user:pass@host:5432/dropship_saas
JWT_ACCESS_SECRET=your-access-secret-at-least-32-characters
JWT_REFRESH_SECRET=your-refresh-secret-at-least-32-characters
COOKIE_SECRET=your-cookie-secret-at-least-32-characters
APP_BASE_URL=http://localhost:3001
WEB_BASE_URL=http://localhost:3000
```

### 3. Database setup
```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 4. Run
```bash
# Terminal 1 — API
npm run dev:api

# Terminal 2 — Frontend
npm run dev:web
```

### Default Credentials
| Email             | Password     | Role     |
|-------------------|-------------|----------|
| admin@demo.com    | admin123    | admin    |
| operator@demo.com | operator123 | operator |

## API Endpoints

| Method | Path                    | Auth     | Description              |
|--------|------------------------|----------|--------------------------|
| POST   | /auth/login            | No       | Login, returns JWT       |
| POST   | /auth/refresh          | Cookie   | Rotate refresh token     |
| POST   | /auth/logout           | Bearer   | Revoke refresh token     |
| GET    | /me                    | Bearer   | Current user + tenant    |
| GET    | /admin/tenants/current | Bearer+Admin | Current tenant info  |
| GET    | /health                | No       | Health check             |

## Render Deployment

### Backend API (Web Service)
- **Build Command**: `npm install && npx prisma generate --schema=prisma/schema.prisma && npm run build:api`
- **Start Command**: `npm run start:api`
- **Environment Variables**: All from `.env.example`

### Frontend Web (Web Service)
- **Build Command**: `npm install && npm run build:web`
- **Start Command**: `npm run start:web`
- **Environment Variables**: `NEXT_PUBLIC_API_BASE_URL=https://your-api.onrender.com`

### Database
- Create a Neon PostgreSQL database
- Set `DATABASE_URL` in both services
- Run migrations: `npx prisma migrate deploy --schema=prisma/schema.prisma`

## Manual Test Checklist

1. [ ] `npm install` completes without errors
2. [ ] `npm run db:generate` generates Prisma client
3. [ ] `npm run db:migrate` creates all tables
4. [ ] `npm run db:seed` creates demo tenant + users
5. [ ] `npm run dev:api` starts on port 3001
6. [ ] `GET /health` returns `{ "status": "ok" }`
7. [ ] `POST /auth/login` with `admin@demo.com / admin123` returns accessToken + sets cookie
8. [ ] `POST /auth/login` with wrong password returns 401
9. [ ] `GET /me` with valid Bearer token returns user + tenant
10. [ ] `GET /me` without token returns 401
11. [ ] `POST /auth/refresh` with valid cookie returns new accessToken
12. [ ] `POST /auth/logout` revokes refresh token
13. [ ] `GET /admin/tenants/current` as admin returns tenant info
14. [ ] `GET /admin/tenants/current` as operator returns 403
15. [ ] `npm run dev:web` starts on port 3000
16. [ ] Navigate to `/login`, enter admin credentials, submit
17. [ ] After login, redirects to `/dashboard` showing user info
18. [ ] Dashboard shows tenant name and plan
19. [ ] Logout button clears session and redirects to `/login`
20. [ ] Server logs show JSON with trace_id on every request
