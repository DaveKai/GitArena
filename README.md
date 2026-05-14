<div align="center">

# 🏟️ GitArena

**A live gamification dashboard that turns your GitHub org activity into XP, streaks, badges, and boss fights — designed to run on your team's office TV.**

[![CI](https://github.com/Societe-tangeroise-de-maintenance/GitArena/actions/workflows/ci.yml/badge.svg)](https://github.com/Societe-tangeroise-de-maintenance/GitArena/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev/)

[**Live Demo →**](https://demo.gitarena.pro) &nbsp;·&nbsp; [Report Bug](https://github.com/Societe-tangeroise-de-maintenance/GitArena/issues) &nbsp;·&nbsp; [Request Feature](https://github.com/Societe-tangeroise-de-maintenance/GitArena/issues)

</div>

---

## What is GitArena?

GitArena polls your GitHub organisation every 10 seconds and turns every commit, PR, review, and issue into XP. It runs on a single server and displays a glanceable **1920×1080 dashboard** on a TV or monitor in your office.

**Key features:**

- 🏆 **Live leaderboard** — weekly XP ranking with animated rank changes
- 🔥 **Streaks** — daily activity streaks with milestone bonuses
- 🎖️ **Badges** — automatically awarded (ghostSlayer, closer, ironDev, streakMaster…)
- 👾 **Boss fights** — team-wide goals (close 30 issues, merge 20 PRs, hit 200 commits)
- 📡 **Real-time** — Server-Sent Events push every event instantly
- 🎬 **Cinematic overlays** — level-up, rank overtaken, achievement, and boss-victory animations
- 🌟 **Spotlight panels** — rotate through trophy, velocity, streak wall, duel, and fun stats
- 🎭 **Demo mode** — runs without a GitHub token for presentations and screenshots
- 🔧 **Hot-reload config** — edit `xp-config.json` to tune XP values live, no restart needed

---

## Screenshots

All screenshots below were generated in demo mode with synthetic activity and fake avatars.

### Desktop dashboard (1920x1080)

![GitArena desktop dashboard](docs/screenshots/gitarena-dashboard-desktop.png)

### Mobile view

![GitArena mobile dashboard](docs/screenshots/gitarena-dashboard-mobile.png)

---

## Quick Start

### Option A — Docker (recommended for production)

```bash
# 1. Clone
git clone https://github.com/Societe-tangeroise-de-maintenance/GitArena.git
cd gitarena

# 2. Configure
cp .env.example .env
#    Edit .env → set GITARENA_PAT and GITARENA_ORG

# 3. Run
docker-compose up --build
```

Open **http://localhost:3002** on the TV browser.

---

### Option B — npm (development / local)

```bash
# 1. Clone & setup
git clone https://github.com/Societe-tangeroise-de-maintenance/GitArena.git
cd gitarena
bash scripts/setup.sh   # interactive wizard: creates .env and src/config.ts

# 2. Start
npm start               # runs backend (port 3002) + Vite dev server (port 5173)
```

Open **http://localhost:5173** in your browser.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GITARENA_PAT` | ✅ | GitHub Personal Access Token (`read:org` + `repo` scopes) |
| `GITARENA_ORG` | ✅ | GitHub organisation slug (e.g. `my-company`) |
| `GITARENA_REPOS` | — | Comma-separated repo names to watch. Empty = auto-discover all org repos |
| `PORT` | — | Backend port (default: `3002`) |
| `GITARENA_ADMIN_SECRET` | — | If set, `POST /api/recalculate` and `POST /api/repair` require an `X-Admin-Secret` header matching this value |
| `SERVE_STATIC` | — | Set to `1` to have the backend serve the built frontend (used by Docker) |

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Browser / TV  (React 18 + Vite + Tailwind)          │
│                                                      │
│  Leaderboard │ Activity Feed │ Spotlight Panels      │
│  Boss Fight  │ Overlays      │ Stats / Belts         │
└──────────────────────┬───────────────────────────────┘
                       │  SSE + REST  (port 3002)
┌──────────────────────▼───────────────────────────────┐
│  Backend  (Express + tsx)                            │
│                                                      │
│  pollEvents()  ←  GitHub Events API  (every 10s)    │
│  fullSync()    ←  GitHub Search API  (every 5min)   │
│                                                      │
│  State persisted to server-state.json every 30s      │
└──────────────────────────────────────────────────────┘
```

**Tech stack:** React 18 · Vite · TypeScript · Tailwind CSS v3 · Zustand · Framer Motion · Express · tsx

---

## XP System

| Action | XP |
|---|---|
| Commit (capped at 10/push) | +50 |
| Open PR | +80 |
| Merge PR | +120 |
| Review PR | +60 |
| Close issue | +40 |
| Open issue | +20 |
| Create branch | +30 |
| Streak milestone (3/5/7/10/14/21/30 days) | +200 |

All values are live-editable in `xp-config.json` — no restart needed.

---

## Demo Mode

GitArena has a built-in demo mode with randomised live events — no GitHub token required. To enable it, set `pat` to any non-empty string in `src/config.ts`:

```ts
// src/config.ts
export const CONFIG = { pat: 'demo', org: '', repos: [] };
```

Then run `npm run dev` — you'll see a fully animated dashboard with fake team members and live activity.

---

## Deployment Tips

- **TV kiosk**: open in Chrome/Chromium with `--kiosk --start-fullscreen` flags
- **Port 80/443**: put nginx in front of port 3002 with a proxy_pass
- **Persistent state**: mount the container working directory as a Docker volume so `server-state.json` survives restarts

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs, issues, and ideas are welcome.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features and how to contribute.

## License

MIT © 2026 STM Societe Tangeroise de Maintenance

