#!/usr/bin/env bash
set -e

echo ""
echo "========================================="
echo "  TNMS - Project Setup"
echo "========================================="
echo ""

# ── 1. Check prerequisites ──────────────────
echo "[1/6] Checking prerequisites..."

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed."
  echo "  Install it from https://nodejs.org (v18+ required)"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "ERROR: Node.js v18+ required (you have $(node -v))"
  exit 1
fi

if ! command -v psql &>/dev/null; then
  echo ""
  echo "ERROR: PostgreSQL is not installed."
  echo ""
  echo "  macOS:   brew install postgresql@16 && brew services start postgresql@16"
  echo "  Ubuntu:  sudo apt install postgresql postgresql-contrib && sudo systemctl start postgresql"
  echo "  Windows: Download from https://www.postgresql.org/download/windows/"
  echo ""
  exit 1
fi

echo "  Node.js $(node -v) ✓"
echo "  PostgreSQL ✓"

# ── 2. Create .env if missing ────────────────
echo ""
echo "[2/6] Setting up environment..."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "  Created .env from .env.example"
  echo ""
  echo "  ╔══════════════════════════════════════════════════╗"
  echo "  ║  IMPORTANT: Edit .env with your database creds  ║"
  echo "  ║  DATABASE_URL=postgresql://USER:PASS@HOST/tnms  ║"
  echo "  ╚══════════════════════════════════════════════════╝"
  echo ""
  read -p "  Press Enter after updating .env (or press Enter to use defaults)..."
else
  echo "  .env already exists ✓"
fi

# ── 3. Create database if it doesn't exist ───
echo ""
echo "[3/6] Setting up database..."

# Extract DB name from DATABASE_URL
DB_URL=$(grep DATABASE_URL .env | cut -d= -f2- | tr -d '"' | tr -d "'")
DB_NAME=$(echo "$DB_URL" | sed 's/.*\///' | cut -d? -f1)

if [ -z "$DB_NAME" ]; then
  DB_NAME="tnms"
fi

# Try to create the database (ignore error if it already exists)
createdb "$DB_NAME" 2>/dev/null && echo "  Created database '$DB_NAME' ✓" || echo "  Database '$DB_NAME' already exists ✓"

# ── 4. Install dependencies ─────────────────
echo ""
echo "[4/6] Installing dependencies..."
npm install

# ── 5. Run migrations & generate Prisma client
echo ""
echo "[5/6] Running database migrations..."
npx prisma migrate dev --skip-generate 2>/dev/null || npx prisma migrate deploy
npx prisma generate

# ── 6. Seed the database ────────────────────
echo ""
echo "[6/6] Seeding database..."
npx tsx server/config/seed.ts

echo ""
echo "========================================="
echo "  Setup complete!"
echo "========================================="
echo ""
echo "  Start the app:  npm run dev"
echo "  Then open:       http://localhost:3000"
echo ""
echo "  Default login:"
echo "    Username: admin"
echo "    Password: admin"
echo ""
