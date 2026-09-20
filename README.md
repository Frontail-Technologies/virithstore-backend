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
