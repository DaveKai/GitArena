# GitArena Roadmap

This document describes planned features and improvements. Items are loosely ordered by priority and effort. PRs for anything here are very welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

---

## Near-term (good first issues)

- [ ] **Screenshot / GIF in README** — capture a demo mode recording and add it to the docs
- [ ] **Custom badge designer** — allow defining new badges in `xp-config.json` with custom icons and unlock conditions
- [ ] **Configurable XP reset period** — weekly or monthly reset, configurable in `xp-config.json`
- [ ] **Per-repo XP multipliers** — award bonus XP for activity in designated "high-priority" repos
- [ ] **Leaderboard history** — track and display how rankings changed over the week
- [ ] **Audit endpoint** — expose `/api/audit` as a read-only JSON summary of XP drift per user
- [ ] **Dark/light theme toggle** — the aesthetic is already dark; add a light theme option

---

## Medium-term

- [ ] **Slack / Discord notifications** — post level-up and boss-victory events to a webhook
- [ ] **Multi-org support** — watch more than one GitHub organisation simultaneously
- [ ] **GitLab support** — plug in a GitLab group in addition to (or instead of) GitHub
- [ ] **Public read-only API** — allow external tools to query `/api/state` without SSE
- [ ] **Mobile-friendly layout** — secondary responsive view for phones when not on a TV
- [ ] **Persistent historical XP charts** — store weekly snapshots and show trend lines
- [ ] **Configurable boss goals** — define boss goals entirely from `xp-config.json` (metric formula, target, icon)

---

## Longer-term

- [ ] **Web-based config editor** — admin UI for editing `xp-config.json` in the browser
- [ ] **Team channels** — group members into sub-teams with their own mini-leaderboard
- [ ] **Bitbucket / Azure DevOps** — additional SCM backends
- [ ] **Achievement streaming** — optionally stream overlay events to a secondary Twitch channel
- [ ] **SaaS hosted version** — fully-managed GitArena with no self-hosting required

---

## Won't do (out of scope)

- Storing GitHub credentials anywhere other than the host `.env`
- Exposing individual developer data publicly without their consent
- Anti-gaming enforcement at the platform level (teams decide their own rules via XP config)

---

Want to claim an item? Open an issue and mention this roadmap entry. We'll assign it to you.
