# Contributing to GitArena

Thanks for taking the time to contribute! Here's everything you need to know.

---

## Development Setup

```bash
git clone https://github.com/Societe-tangeroise-de-maintenance/GitArena.git
cd gitarena
bash scripts/setup.sh   # creates .env and src/config.ts interactively
npm start               # backend on :3002, Vite dev server on :5173
```

TypeScript is checked on every save — run `npx tsc --noEmit` to see errors before pushing.

---

## Project Layout

```
server/index.ts        — Express backend: GitHub polling, XP engine, SSE
src/
  App.tsx              — Root layout
  store/useStore.ts    — Zustand global state
  hooks/
    useBackendSync.ts  — SSE connection + /api/state fetch
    useDemoMode.ts     — Demo mode with live-simulated events
  components/          — All React UI
  lib/
    xp.ts              — Level / XP helpers
    badges.ts          — Badge definitions
    sounds.ts          — Audio effects
xp-config.json         — Hot-reload XP values, levels, boss goals
```

---

## Commit Style

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add GitLab support
fix: streak not resetting at month boundary
docs: improve setup instructions
refactor: extract xp calculation into lib/xp.ts
chore: update dependencies
```

---

## Pull Request Process

1. Fork the repo and create a branch: `git checkout -b feat/my-feature`
2. Make your changes, keeping commits focused and atomic.
3. Run `npx tsc --noEmit` — PRs with TypeScript errors won't be merged.
4. Update `README.md` if you're adding or changing user-facing behaviour.
5. Open a PR against `main` and fill in the PR template.

---

## Good First Issues

Look for issues labelled [`good first issue`](https://github.com/Societe-tangeroise-de-maintenance/GitArena/labels/good%20first%20issue). These are self-contained improvements that don't require deep context.

---

## Questions?

Open a [Discussion](https://github.com/Societe-tangeroise-de-maintenance/GitArena/discussions) — not an issue — for questions and ideas.
