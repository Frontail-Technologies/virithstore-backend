# virithstore-backend

High-performance Elysia (Bun) backend service for VirithStore e-commerce platform with PostgreSQL (Drizzle ORM), JWT authentication, digital gaming auto-delivery, ABA PayWay / KHQR payment gateway, and admin control management.

## Tech Stack
- **Runtime**: Bun
- **Framework**: Elysia.js
- **Database**: PostgreSQL (Neon / Local)
- **ORM**: Drizzle ORM
- **Authentication**: JWT / bcrypt

## Getting Started

### Prerequisites
- Bun installed (`curl -fsSL https://bun.sh/install | bash` or via PowerShell)
- PostgreSQL database

### Installation
```bash
# Install dependencies
bun install

# Configure environment variables
cp .env.example .env

# Push database schema
bun run db:push

# Seed initial catalog and store data
bun run db:seed

# Start development server
bun run dev
```

### Scripts
- `bun run dev` - Start dev server on port 4000
- `bun run start` - Start production server
- `bun run db:generate` - Generate Drizzle migrations
- `bun run db:push` - Push schema directly to database
- `bun run db:studio` - Open Drizzle Studio database viewer
- `bun run db:seed` - Seed products, categories, vouchers, and settings

## Code structure

```text
src/
  app.ts            composes the app (no listen) and exports `App`
  index.ts          process entry: listens on BACKEND_PORT
  config/env.ts     validated environment (fails fast when secrets are missing)
  db/               Drizzle client, schema, migrations runner, seed
  libs/             pure helpers: http-error, response, ids, pagination, money, password, jwt, payway, telegram, cloudinary, slug
  plugins/          Elysia plugins: auth (macros), error-handler, rate-limit
  handlers/         shared route helpers: params schemas, createCrudService
  features/<name>/  index.ts (routes) · model.ts (schemas + types) · service.ts (functions) · mappers.ts (DTOs)
```

Conventions: functions only (no classes); validation lives in `model.ts`; routes call services and never touch `db`;
routes declare access with macros (`{ auth: true }`, `{ admin: true }`, `{ optionalUser: true }`).
All routes are served under `/api/v1`. Required env: `JWT_SECRET` and `OAUTH_SHARED_SECRET` (32+ chars each);
`PAYWAY_MERCHANT_KEY` and `PAYWAY_PUBLIC_KEY` in production. Run `bun test` and `bun run typecheck`.
