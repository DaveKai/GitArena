# Dev Gamification Dashboard — Superprompt

## What we're building

A **passive TV dashboard** — always-on, no interaction, watched from across a room by the whole dev team. It connects live to a GitHub org via a PAT, polls for real activity, and displays a real-time gamified leaderboard with animations, rankings, streaks, badges, boss fights, and a live activity feed. The goal is to motivate the team, create friendly competition, and surface recognition moments automatically.

---

## Core requirements

- Single self-contained HTML file, no build step, runs in any browser
- GitHub org PAT injected at the top of the file as a config variable
- Polls GitHub REST API on a configurable interval (default: 60s)
- WebSocket-ready architecture (can be upgraded later)
- All animations must be CSS-only (no heavy JS animation libraries)
- Must be readable at 1080p from 2–3 meters away (large fonts, high contrast)
- Dark background (the screen is always on — OLED-friendly)
- Auto-cycles spotlight panels every 30 seconds
- No user interaction required — fully autonomous after page load

---

## GitHub data to pull

### Per developer (org members)
| Metric | GitHub API endpoint |
|---|---|
| Commits this week | `/repos/{org}/{repo}/commits?author={user}&since=...` |
| PRs opened | `/search/issues?q=author:{user}+type:pr+org:{org}` |
| PRs merged | `/search/issues?q=author:{user}+type:pr+is:merged+org:{org}` |
| PRs reviewed | `/search/issues?q=reviewed-by:{user}+type:pr+org:{org}` |
| Issues closed | `/search/issues?q=assignee:{user}+type:issue+is:closed+org:{org}` |
| Lines added/deleted | `/repos/{org}/{repo}/stats/contributors` |
| Review comments left | `/repos/{org}/{repo}/pulls/comments` filtered by user |

### Org-wide
| Metric | Use for |
|---|---|
| Recent commits across all repos | Live activity feed |
| Open PRs with no review for >24h | "Hall of shame" / pressure mechanic |
| Total issues closed this week | Boss fight progress |
| Total commits today | Team mood indicator |

---

## XP system

### XP values per action
| Action | XP |
|---|---|
| Commit pushed | +50 XP |
| PR opened | +80 XP |
| PR merged | +120 XP |
| PR reviewed (approved or commented) | +60 XP |
| Issue closed | +40 XP |
| First commit of the day | +30 XP bonus |
| Net-negative PR (more deletions than additions) | +70 XP bonus |
| Commit streak milestone (3, 7, 14, 30 days) | +200 XP bonus |

### Levels
| Level | XP threshold | Title |
|---|---|---|
| 1 | 0 | Intern |
| 2 | 500 | Junior Dev |
| 3 | 1,500 | Dev |
| 4 | 3,000 | Senior Dev |
| 5 | 6,000 | Staff Engineer |
| 6 | 10,000 | Principal |
| 7 | 16,000 | Architect |
| 8 | 25,000 | Legendary |

Level-up triggers a full-screen flash animation with the developer's name and new title.

---

## Badges

### Common
| Badge | Condition |
|---|---|
| Early Bird | First commit before 9am |
| Night Owl | Commit after 11pm |
| Quick Draw | PR reviewed within 1 hour of opening |
| Closer | Close 5 issues in a single day |

### Rare
| Badge | Condition |
|---|---|
| The Surgeon | PR where deletions > 90% of changes |
| Streak Master | 7-day commit streak |
| Reviewer of the Week | Most PR reviews in a week |
| Speed Demon | PR merged within 2 hours of opening |

### Legendary
| Badge | Condition |
|---|---|
| The Janitor | Delete more lines than added in a month |
| Ghost Slayer | Close 10+ issues in a single week |
| Iron Dev | 30-day commit streak |
| The Wall | Never let a PR sit unreviewed for >4h for an entire week |

Legendary badges animate with a pulsing border and appear in a dedicated showcase on the screen when earned.

---

## Leaderboard mechanics

- Sorted by XP descending, always visible on the left panel
- Top 3 get gold / silver / bronze rank indicators
- Each row shows: rank, avatar (initials circle), name, level title, current streak fire emoji, XP, mini XP-to-next-level progress bar
- Rank changes animate: if someone moves up, their row slides up; if someone is overtaken, a big "OVERTAKEN" event fires on the right panel
- Weekly reset on Monday 00:00 (keeps competition fresh, past trophies persist in trophy case)
- Seasonal leaderboard (monthly) feeds into reward system

---

## Gamification mechanics

### Streaks
- Commit streaks tracked per developer
- Streak shown as fire emoji + count next to name
- Breaking a 7+ day streak triggers a "streak broken" animation on the activity feed
- Streak milestones (3, 7, 14, 30) trigger banner events

### Title belts
- "The Reviewer" belt: most PR reviews this week — changes hands live
- "The Closer" belt: most issues closed this week
- "Speed King" belt: fastest average PR review time
- Belt transfers animate on screen with both devs shown

### Duels
- Auto-generated head-to-head between #1 and #2 on leaderboard
- Shown as a split progress bar in the spotlight panel
- Updates live as new commits/PRs come in
- Duel resets weekly

### Boss fight
- Weekly team goal shown as a health bar at the top of the screen
- Example goals: "Close 30 issues", "Merge 20 PRs", "Hit 200 commits"
- Everyone's activity chips away at the bar
- When the bar hits 0 (goal complete), full-screen victory animation fires
- New boss spawns immediately with a harder goal

### Ghost mechanic
- If a developer has had no activity for 3+ days, their avatar gets a ghost overlay on the leaderboard
- Subtle — not shaming, just visible

---

## Screen layout (TV, 1920×1080)

```
┌──────────────────────────────────────────────────────────────────┐
│  BOSS FIGHT BAR — "[Boss name]" — [progress] / [goal]   [timer] │
├─────────────────────┬────────────────────────────────────────────┤
│                     │                                            │
│   LEADERBOARD       │   LIVE ACTIVITY FEED                       │
│                     │   (scrolling, newest at top)               │
│   1. Dev name  🔥7  │                                            │
│   2. Dev name  🔥3  │   Each item: avatar + name + action +      │
│   3. Dev name       │   repo + XP gained + timestamp             │
│   4. Dev name 👻    │                                            │
│   5. Dev name       │                                            │
│                     │                                            │
├─────────────────────┴────────────────────────────────────────────┤
│  SPOTLIGHT PANEL (auto-rotates every 30s)                        │
│  Modes: MVP of week | Badge showcase | Duel | Fun stat |         │
│         Streak wall | Open PR shame | Velocity chart            │
└──────────────────────────────────────────────────────────────────┘
```

---

## Spotlight panel rotation

Cycles automatically every 30 seconds through:

1. **This week's MVP** — top XP earner, large avatar, stats summary
2. **Badge just earned** — if a badge was earned in the last cycle, showcase it full-width
3. **Active duel** — #1 vs #2 head-to-head progress bars
4. **Fun stat** — e.g. "The team deleted 1,240 lines this week — the repo is getting cleaner 🧹"
5. **Streak wall** — all active streaks displayed as a grid
6. **Open PR hall of shame** — PRs sitting unreviewed for >24h, with time elapsed
7. **Velocity chart** — commits per day this week as a bar chart
8. **Trophy case** — this month's completed achievements

---

## Event animations (on new activity)

| Event | Animation |
|---|---|
| New commit | Avatar slides in from left, XP counter ticks up, particle burst on leaderboard row |
| PR merged | Green flash across leaderboard row, "+120 XP" floats up |
| Badge earned | Full overlay with badge name, rarity, and earner's name — 5 seconds, then fades |
| Level up | Full-screen flash, new level title displayed large |
| Rank change | Rows animate swap, "OVERTAKEN" banner fires on feed |
| Boss defeated | Full-screen victory animation, confetti, new boss announcement |
| Streak broken | Sad animation on avatar, streak counter resets |
| Personal best | "NEW RECORD" banner with stat highlighted |

---

## "Alive" between events

The screen should never feel dead:

- Avatars have a subtle idle breathing animation (scale 1.0 → 1.02, 3s loop)
- XP bars have a shimmer sweep every 8 seconds
- Activity feed slowly auto-scrolls if nothing new for >2 minutes
- "Time since last commit" counter shown in the feed header — color shifts green → amber → red as time grows
- Random fun fact flashes in the spotlight every few cycles
- Leaderboard rows have a very subtle background pulse on the top-ranked dev

---

## Config block (top of HTML file)

```javascript
const CONFIG = {
  pat: "ghp_YOUR_PAT_HERE",
  org: "your-org-name",
  repos: [],                  // empty = all org repos, or specify ["repo1","repo2"]
  pollInterval: 60,           // seconds
  weeklyResetDay: 1,          // 0=Sunday, 1=Monday
  bossGoals: [
    { label: "Close 30 issues", metric: "issuesClosed", target: 30 },
    { label: "Merge 20 PRs", metric: "prsMerged", target: 20 },
    { label: "Hit 200 commits", metric: "commits", target: 200 },
  ],
  spotlightInterval: 30,      // seconds between spotlight panel rotations
  theme: "dark",              // dark | light
  teamName: "Dev Team",
};
```

---

## Reward integration (later phase)

- End-of-month leaderboard snapshot exported as JSON
- Auto-generate a weekly summary for Slack/Teams: top 3, badge earned, boss status
- Trophy case persists across monthly resets — past winners always visible
- Reward tiers can be mapped to XP milestones externally

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Single HTML file, vanilla JS, CSS animations |
| Data | GitHub REST API v3 (no GraphQL needed) |
| Auth | PAT in config, `Authorization: Bearer {pat}` header |
| Real-time | Polling (60s default); upgrade path to webhook + WebSocket server |
| Storage | localStorage for XP persistence between page refreshes |
| Fonts | System font stack (no external font CDN) |
| Charts | Inline SVG (no chart library dependency) |

---

## Implementation phases

### Phase 1 — Core (build first)
- Config block + GitHub API polling
- Leaderboard with real org member data
- XP calculation from commit + PR data
- Live activity feed
- Boss fight bar
- Basic CSS animations on new events

### Phase 2 — Gamification layer
- Badge system with detection logic
- Streak tracking (persisted in localStorage)
- Spotlight panel with rotation
- Rank change animations
- Duel mechanic

### Phase 3 — Polish
- Level-up full-screen events
- Belt transfer mechanic
- Fun stat generator
- Ghost mechanic
- Open PR shame panel
- Velocity chart (SVG)

### Phase 4 — Reward integration
- End-of-month snapshot export
- Slack/Teams weekly summary POST
- Trophy case persistence
