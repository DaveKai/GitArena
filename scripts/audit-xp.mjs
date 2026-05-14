#!/usr/bin/env node
// Audit live server state vs. expected XP from per-user counters.
// Usage:
//   node scripts/audit-xp.mjs [http://host:port]
// Defaults to http://localhost:3002.

const base = process.argv[2] || process.env.GITARENA_URL || 'http://localhost:3002';

const res = await fetch(`${base}/api/state`);
if (!res.ok) {
  console.error(`GET /api/state failed: ${res.status}`);
  process.exit(1);
}
const state = await res.json();
const xp = state.xpConfig.xpValues;

const rows = [];
for (const [login, s] of Object.entries(state.stats)) {
  const searchableXp =
    s.weeklyCommits * xp.commit +
    s.weeklyPRsOpened * xp.prOpened +
    s.weeklyPRsMerged * xp.prMerged +
    s.weeklyIssuesClosed * xp.issueClosed +
    (s.weeklyIssuesOpened || 0) * xp.issueOpened;
  const reviewXp = s.weeklyPRsReviewed * xp.prReviewed;
  const minExpected = searchableXp; // reviews/streaks/branches add on top
  const drift = s.weeklyXp - minExpected;
  rows.push({
    login,
    weeklyXp: s.weeklyXp,
    searchableXp,
    reviewXp,
    drift,
    commits: s.weeklyCommits,
    prsOpen: s.weeklyPRsOpened,
    prsMerge: s.weeklyPRsMerged,
    issuesClose: s.weeklyIssuesClosed,
    issuesOpen: s.weeklyIssuesOpened || 0,
    reviews: s.weeklyPRsReviewed,
  });
}

rows.sort((a, b) => b.drift - a.drift);

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('login', 24), pad('weeklyXp', 10), pad('searchXp', 10), pad('reviewXp', 10), pad('drift', 10), 'counters');
console.log('-'.repeat(110));
for (const r of rows) {
  console.log(
    pad(r.login, 24),
    pad(r.weeklyXp, 10),
    pad(r.searchableXp, 10),
    pad(r.reviewXp, 10),
    pad(r.drift, 10),
    `c=${r.commits} pO=${r.prsOpen} pM=${r.prsMerge} iC=${r.issuesClose} iO=${r.issuesOpen} rv=${r.reviews}`,
  );
}

const suspicious = rows.filter(r => r.drift > r.reviewXp + 2000);
if (suspicious.length) {
  console.log(`\nSUSPICIOUS DRIFT (drift > reviewXp + 2000) for ${suspicious.length} users:`);
  for (const r of suspicious) console.log(`  ${r.login}: drift=${r.drift}, reviewXp=${r.reviewXp}`);
  process.exit(2);
}
console.log('\nOK: no suspicious drift.');
