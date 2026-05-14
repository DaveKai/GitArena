#!/usr/bin/env bash
# GitArena interactive setup
# Usage: bash scripts/setup.sh
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RESET='\033[0m'

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║        GitArena Setup Wizard         ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════╝${RESET}"
echo ""

# ── Collect inputs ─────────────────────────────────────────────────────────
echo -e "${CYAN}Create a GitHub PAT at: https://github.com/settings/tokens${RESET}"
echo -e "  Required scopes: ${BOLD}read:org${RESET}, ${BOLD}repo${RESET}"
echo ""
read -rp "GitHub Personal Access Token: " PAT
if [[ -z "$PAT" ]]; then
  echo -e "${YELLOW}Warning: PAT is empty. Backend will not work without it.${RESET}"
fi

read -rp "GitHub Organisation slug (e.g. my-company): " ORG
if [[ -z "$ORG" ]]; then
  echo -e "${YELLOW}Warning: org is empty. Fill it in .env before starting.${RESET}"
fi

read -rp "Port to run on [3002]: " PORT
PORT="${PORT:-3002}"

read -rp "Admin secret for /api/recalculate and /api/repair (leave blank to skip): " ADMIN_SECRET

# ── Write .env ────────────────────────────────────────────────────────────
cat > .env <<EOF
GITARENA_PAT=${PAT}
GITARENA_ORG=${ORG}
PORT=${PORT}
EOF

if [[ -n "$ADMIN_SECRET" ]]; then
  echo "GITARENA_ADMIN_SECRET=${ADMIN_SECRET}" >> .env
fi

echo -e "${GREEN}✓ .env written${RESET}"

# ── Write src/config.ts ───────────────────────────────────────────────────
if [[ ! -f src/config.ts ]]; then
  cp src/config.example.ts src/config.ts
  echo -e "${GREEN}✓ src/config.ts created from example${RESET}"
else
  echo -e "${YELLOW}✓ src/config.ts already exists — skipping${RESET}"
fi

# ── Install dependencies ─────────────────────────────────────────────────
echo ""
echo -e "${CYAN}Installing dependencies...${RESET}"
npm install
echo -e "${GREEN}✓ Dependencies installed${RESET}"

echo ""
echo -e "${BOLD}Setup complete!${RESET}"
echo ""
echo "  Development:  npm start"
echo "  Production:   docker-compose up --build"
echo ""
echo -e "  Dashboard will be available at ${CYAN}http://localhost:${PORT}${RESET}"
echo ""
