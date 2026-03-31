# TNMS - Property Management System

## Quick Start

### Prerequisites
- **Node.js** v18+ — [download](https://nodejs.org)
- **PostgreSQL** — install via:
  - macOS: `brew install postgresql@16 && brew services start postgresql@16`
  - Ubuntu: `sudo apt install postgresql postgresql-contrib && sudo systemctl start postgresql`
  - Windows: [download installer](https://www.postgresql.org/download/windows/)

### One-Command Setup

```bash
git clone <repo-url> && cd TNMS
npm run setup
```

This will:
1. Check that Node.js and PostgreSQL are installed
2. Create `.env` from `.env.example` (edit with your DB credentials if needed)
3. Create the database
4. Install all dependencies
5. Run database migrations
6. Seed default data (roles, permissions, admin user)

### Start the App

```bash
npm run dev
```

Open **http://localhost:3000** and login:
- **Username:** `admin`
- **Password:** `admin`

---

## Manual Setup (if you prefer)

```bash
# 1. Install dependencies
npm install

# 2. Copy and edit environment config
cp .env.example .env
# Edit .env with your DATABASE_URL

# 3. Create database
createdb tnms

# 4. Run migrations
npx prisma migrate dev

# 5. Seed data
npm run db:seed

# 6. Start
npm run dev
```

## Sync Live Data

After setup, pull all real data (properties, floors, units, assets, roles, users) from the live server:

```bash
npm run sync-live
```

This connects to the production API, fetches everything, and populates your local database. All users get password `admin` locally.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (backend + frontend) |
| `npm run build` | Build for production |
| `npm run setup` | Full automated setup |
| `npm run sync-live` | Sync all data from live server |
| `npm run db:seed` | Seed/reset database with defaults |
| `npm run db:push` | Push schema changes (no migration) |

## Production Deployment

```bash
npm run build
NODE_ENV=production node dist/server/index.js
```

Or with PM2:
```bash
pm2 start dist/server/index.js --name tnms
```
