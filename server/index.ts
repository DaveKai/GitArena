import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

// ── Paths ────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'xp-config.json');
const LEGACY_STATE_PATH = path.join(__dirname, '..', 'server-state.json');
const DATA_DIR = process.env.GITARENA_DATA_DIR || (process.env.NODE_ENV === 'production'
  ? path.join(__dirname, '..', 'data')
  : path.join(__dirname, '..'));
const STATE_PATH = path.join(DATA_DIR, 'server-state.json');
const ENV_PATH = path.join(__dirname, '..', '.env');

// ── Load .env file ───────────────────────────────
if (fs.existsSync(ENV_PATH)) {
  for (const line of fs.readFileSync(ENV_PATH, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

// ── Types ────────────────────────────────────────
interface XpConfig {
  xpValues: Record<string, number>;
  levels: Array<{ level: number; xp: number; title: string }>;
  streakMilestones: number[];
  bossGoals: Array<{ label: string; metric: string; target: number }>;
  pollIntervalSeconds: number;
  fullSyncIntervalSeconds: number;
}

interface DevStats {
  login: string;
  monthlyXp: number;
  totalXp: number;
  monthlyCommits: number;
  monthlyPRsOpened: number;
  monthlyPRsMerged: number;
  monthlyPRsReviewed: number;
  monthlyIssuesClosed: number;
  monthlyIssuesOpened: number;
  monthlyLinesAdded: number;
  monthlyLinesDeleted: number;
  dailyCommits: number;
  dailyIssuesClosed: number;
  streak: number;
  longestStreak: number;
  streakLastDate: string | null;
  lastActivityTime: string | null;
  lastCommitDate: string | null;
  badges: string[];
}

interface Member {
  login: string;
  name: string;
  color: string;
  avatarUrl: string;
}

interface FeedItem {
  id: string;
  type: string;
  user: string;
  repo: string;
  message: string;
  detail: string;
  xp: number;
  time: string;
}

interface ServerState {
  members: Member[];
  stats: Record<string, DevStats>;
  feed: FeedItem[];
  bossProgress: Record<string, number>;
  bossIndex: number;
  previousRanks: Record<string, number>;
  belts: { reviewer: string | null; closer: string | null; speedKing: string | null };
  shamePRs: Array<{ title: string; repo: string; author: string; age: number }>;
  monthStartDate: string;
  seenIds: string[];
  creditedCommitShas?: string[];
  commitLedgerSeeded?: boolean;
  dailyStartDate?: string;
  etags: Record<string, string>;
  repos: string[];
}

// ── GitHub config ────────────────────────────────
const GH_PAT = process.env.GITARENA_PAT || '';
const GH_ORG = process.env.GITARENA_ORG || '';
const GH_REPOS = (process.env.GITARENA_REPOS || '').split(',').filter(Boolean);
const PORT = parseInt(process.env.PORT || '3002', 10);
const ADMIN_SECRET = process.env.GITARENA_ADMIN_SECRET || '';
const BASE = 'https://api.github.com';
const DEMO_MODE = GH_PAT === 'demo';

if (!DEMO_MODE && (!GH_PAT || !GH_ORG)) {
  console.error('GITARENA_PAT and GITARENA_ORG environment variables are required');
  process.exit(1);
}

// ── Config hot-reload ────────────────────────────
let xpConfig: XpConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
let configMtime = fs.statSync(CONFIG_PATH).mtimeMs;

function reloadConfigIfChanged(): void {
  try {
    const mtime = fs.statSync(CONFIG_PATH).mtimeMs;
    if (mtime !== configMtime) {
      xpConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      configMtime = mtime;
      console.log('[server] XP config reloaded');
    }
  } catch { /* keep old config */ }
}

// ── State ────────────────────────────────────────
const COLORS = ['#3b82f6', '#a78bfa', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];

function emptyStats(login: string): DevStats {
  return {
    login, monthlyXp: 0, totalXp: 0,
    monthlyCommits: 0, monthlyPRsOpened: 0, monthlyPRsMerged: 0,
    monthlyPRsReviewed: 0, monthlyIssuesClosed: 0, monthlyIssuesOpened: 0,
    monthlyLinesAdded: 0, monthlyLinesDeleted: 0,
    dailyCommits: 0, dailyIssuesClosed: 0,
    streak: 0, longestStreak: 0, streakLastDate: null,
    lastActivityTime: null, lastCommitDate: null, badges: [],
  };
}

function monthStart(): string {
  return `${new Date().toISOString().slice(0, 7)}-01`;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

const BOT_LOGINS = new Set(['coderabbitai', 'copilot', 'dependabot[bot]', 'github-actions[bot]', 'renovate[bot]', 'codecov[bot]']);
function isBot(login: string): boolean {
  if (!login) return false;
  const lower = login.toLowerCase();
  return BOT_LOGINS.has(lower) || lower.endsWith('[bot]') || lower.endsWith('-bot');
}

function loadServerState(): ServerState {
  try {
    const source = fs.existsSync(STATE_PATH) ? STATE_PATH : LEGACY_STATE_PATH;
    if (fs.existsSync(source)) {
      const loaded = JSON.parse(fs.readFileSync(source, 'utf-8')) as ServerState & { weekStartDate?: string };
      // Existing weekly totals are a valid partial count for their month.
      // Keep them as the monthly baseline so the first full sync only adds
      // earlier activity that was not already included in total XP.
      if (!loaded.monthStartDate) {
        loaded.monthStartDate = loaded.weekStartDate?.slice(0, 7) === monthStart().slice(0, 7)
          ? monthStart()
          : loaded.weekStartDate || monthStart();
      }
      const names = ['Xp', 'Commits', 'PRsOpened', 'PRsMerged', 'PRsReviewed', 'IssuesClosed', 'IssuesOpened', 'LinesAdded', 'LinesDeleted'];
      for (const stats of Object.values(loaded.stats || {})) {
        const row = stats as unknown as Record<string, unknown>;
        for (const name of names) {
          const current = `monthly${name}`, legacy = `weekly${name}`;
          if (row[current] === undefined) row[current] = row[legacy] ?? 0;
          delete row[legacy];
        }
      }
      delete loaded.weekStartDate;
      return loaded;
    }
  } catch { /* corrupted file, start fresh */ }
  return {
    members: [], stats: {}, feed: [],
    bossProgress: {}, bossIndex: 0, previousRanks: {},
    belts: { reviewer: null, closer: null, speedKing: null },
    shamePRs: [], monthStartDate: monthStart(),
    seenIds: [], creditedCommitShas: [], commitLedgerSeeded: true, dailyStartDate: todayStr(), etags: {}, repos: [],
  };
}

let state: ServerState = loadServerState();
// Migration: ensure all loaded stats have new schema fields populated.
for (const s of Object.values(state.stats)) {
  if (typeof s.monthlyIssuesOpened !== 'number') s.monthlyIssuesOpened = 0;
}
const seenIds = new Set<string>(state.seenIds || []);
const creditedCommitShas = new Set<string>(state.creditedCommitShas || []);

function persistState(): void {
  // Keep action IDs for the whole month; only transient GitHub event IDs expire.
  const eventIds = [...seenIds].filter(id => !id.startsWith('rt-'));
  if (eventIds.length > 3000) for (const id of eventIds.slice(0, -3000)) seenIds.delete(id);
  state.seenIds = [...seenIds];
  state.creditedCommitShas = [...creditedCommitShas];
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(state), 'utf-8');
  } catch (err) {
    console.warn('[server] Failed to persist state:', err);
  }
}

// ── SSE clients ──────────────────────────────────
type SseClient = { id: number; res: express.Response };
let sseClientId = 0;
const sseClients: SseClient[] = [];

function broadcast(event: string, data: unknown): void {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].res.write(msg);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// ── GitHub fetch helpers ────────────────────────
function ghHeaders(etag?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${GH_PAT}`,
  };
  if (etag) h['If-None-Match'] = etag;
  return h;
}

const ghRateLimitedUntil: Record<'core' | 'search', number> = { core: 0, search: 0 };

async function ghFetch(url: string, etag?: string): Promise<{ data: unknown; etag?: string; notModified: boolean; ok: boolean }> {
  const resource = url.includes('/search/') ? 'search' : 'core';
  if (Date.now() < ghRateLimitedUntil[resource]) return { data: null, etag, notModified: false, ok: false };
  const res = await fetch(url, { headers: ghHeaders(etag) });
  if (res.status === 304) return { data: null, etag, notModified: true, ok: true };
  if (!res.ok) {
    const error = (res.status === 403 || res.status === 429) ? await res.json().catch(() => null) as { message?: string } | null : null;
    const limited = res.status === 429 || res.headers.get('x-ratelimit-remaining') === '0' || /rate limit/i.test(error?.message || '');
    if (limited) {
      const resetAt = Number(res.headers.get('x-ratelimit-reset')) * 1000;
      const retryAfter = Number(res.headers.get('retry-after')) * 1000;
      const until = Math.max(Date.now() + 60_000, Number.isFinite(resetAt) ? resetAt + 5_000 : 0, Number.isFinite(retryAfter) ? Date.now() + retryAfter : 0);
      if (until > ghRateLimitedUntil[resource]) {
        ghRateLimitedUntil[resource] = until;
        console.warn(`[gh] ${resource} rate limit reached; retry after ${new Date(until).toISOString()}`);
      }
    } else {
      console.warn(`[gh] ${res.status} ${url.split('?')[0]}`);
    }
    return { data: null, etag, notModified: false, ok: false };
  }
  const data = await res.json();
  const newEtag = res.headers.get('ETag') || etag;
  return { data, etag: newEtag, notModified: false, ok: true };
}

interface SearchResult { items: Array<Record<string, unknown>>; complete: boolean }
async function searchAll(kind: 'commits' | 'issues', baseQuery: string, dateField: string, from: string, to: string): Promise<SearchResult> {
  const query = `${baseQuery} ${dateField}:${from}..${to}`;
  const url = (page: number) => `${BASE}/search/${kind}?q=${encodeURIComponent(query)}&per_page=100&page=${page}`;
  const first = await ghFetch(url(1));
  if (!first.ok || !first.data) return { items: [], complete: false };
  const payload = first.data as Record<string, unknown>;
  const count = Number(payload.total_count || 0);
  if (count > 1000 || payload.incomplete_results === true) {
    if (from === to) {
      console.warn(`[server] Search result incomplete for ${kind} ${query}`);
      return { items: [], complete: false };
    }
    const start = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`);
    const middle = start + Math.floor((end - start) / (2 * 86400000)) * 86400000;
    const leftTo = new Date(middle).toISOString().slice(0, 10);
    const rightFrom = new Date(middle + 86400000).toISOString().slice(0, 10);
    const [left, right] = await Promise.all([searchAll(kind, baseQuery, dateField, from, leftTo), searchAll(kind, baseQuery, dateField, rightFrom, to)]);
    return { items: [...left.items, ...right.items], complete: left.complete && right.complete };
  }
  const items = Array.isArray(payload.items) ? payload.items as Array<Record<string, unknown>> : [];
  for (let page = 2; page <= Math.ceil(count / 100); page++) {
    const result = await ghFetch(url(page));
    const data = result.data as Record<string, unknown> | null;
    if (!result.ok || !data || !Array.isArray(data.items) || data.incomplete_results === true) return { items: [], complete: false };
    items.push(...data.items as Array<Record<string, unknown>>);
  }
  return { items, complete: items.length >= count };
}

// ── Core XP logic ────────────────────────────────
function getLevel(totalXp: number) {
  let current = xpConfig.levels[0];
  for (const l of xpConfig.levels) {
    if (totalXp >= l.xp) current = l;
    else break;
  }
  return current;
}

function rankedLogins(): string[] {
  return Object.values(state.stats)
    .sort((a, b) => b.monthlyXp - a.monthlyXp)
    .map(s => s.login);
}

function ensureMember(login: string, avatarUrl?: string): void {
  if (isBot(login)) return;
  const existing = state.members.find(m => m.login === login);
  if (existing) {
    if (avatarUrl && !existing.avatarUrl) existing.avatarUrl = avatarUrl;
    return;
  }
  const color = COLORS[state.members.length % COLORS.length];
  state.members.push({ login, name: login, color, avatarUrl: avatarUrl || '' });
  if (!state.stats[login]) state.stats[login] = emptyStats(login);
}

function addXp(login: string, amount: number, type: string, repo: string, message: string, detail?: string, eventTime?: string): void {
  if (isBot(login)) return;
  ensureMember(login);
  const s = state.stats[login] || emptyStats(login);
  const oldLevel = getLevel(s.totalXp).level;
  s.monthlyXp += amount;
  s.totalXp += amount;
  s.lastActivityTime = eventTime || new Date().toISOString();
  state.stats[login] = s;

  const feedItem: FeedItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type, user: login, repo, message,
    detail: detail || '', xp: amount,
    time: eventTime || new Date().toISOString(),
  };
  state.feed = [feedItem, ...state.feed]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 50);

  const newLevel = getLevel(s.totalXp).level;

  // Check level-up
  if (newLevel > oldLevel) {
    broadcast('overlay', { type: 'level-up', payload: { login, level: newLevel, title: getLevel(s.totalXp).title } });
  }

  // Check rank overtaken
  const ranked = rankedLogins();
  const newRank = ranked.indexOf(login) + 1;
  const oldRank = state.previousRanks[login] || newRank;
  if (newRank < oldRank && oldRank > 1) {
    broadcast('overlay', { type: 'overtaken', payload: { login, newRank, oldRank } });
  }
  const newPreviousRanks: Record<string, number> = {};
  ranked.forEach((l, i) => { newPreviousRanks[l] = i + 1; });
  state.previousRanks = newPreviousRanks;

  // Broadcast new feed item to all clients
  broadcast('feed', feedItem);
}

function incrementStat(login: string, field: string, delta = 1): void {
  const s = state.stats[login];
  if (!s) return;
  (s as unknown as Record<string, unknown>)[field] = ((s as unknown as Record<string, unknown>)[field] as number || 0) + delta;

  // Auto-detect count-based badges
  if (field === 'monthlyIssuesClosed' && s.monthlyIssuesClosed >= 10 && !s.badges.includes('ghostSlayer')) {
    awardBadge(login, 'ghostSlayer');
  }
  if (field === 'dailyIssuesClosed' && s.dailyIssuesClosed >= 5 && !s.badges.includes('closer')) {
    awardBadge(login, 'closer');
  }
}

function awardBadge(login: string, badgeId: string): void {
  const s = state.stats[login];
  if (!s || s.badges.includes(badgeId)) return;
  s.badges.push(badgeId);
  broadcast('overlay', { type: 'achievement', payload: { login, badgeId } });
}

function bumpStreak(login: string, eventTime?: string): void {
  const s = state.stats[login];
  if (!s) return;
  const d = eventTime?.slice(0, 10) || todayStr();
  if (s.streakLastDate && s.streakLastDate >= d) return;
  if (s.streakLastDate) {
    const last = new Date(s.streakLastDate);
    const now = new Date(d);
    const diff = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
    s.streak = diff <= 1 ? s.streak + 1 : 1;
  } else {
    s.streak = 1;
  }
  s.streakLastDate = d;
  if (s.streak > s.longestStreak) s.longestStreak = s.streak;

  if (xpConfig.streakMilestones.includes(s.streak)) {
    s.monthlyXp += xpConfig.xpValues.streakBonus;
    s.totalXp += xpConfig.xpValues.streakBonus;
  }

  if (s.streak >= 30 && !s.badges.includes('ironDev')) awardBadge(login, 'ironDev');
  else if (s.streak >= 7 && !s.badges.includes('streakMaster')) awardBadge(login, 'streakMaster');
}

function addLineStats(login: string, added: number, deleted: number): void {
  const s = state.stats[login];
  if (!s) return;
  s.monthlyLinesAdded += added;
  s.monthlyLinesDeleted += deleted;
}

async function fetchPushLineStats(login: string, repo: string, before: string, head: string): Promise<void> {
  try {
    const url = `${BASE}/repos/${GH_ORG}/${encodeURIComponent(repo)}/compare/${before}...${head}`;
    const { data, ok } = await ghFetch(url);
    if (!ok || !data) return;
    const d = data as Record<string, unknown>;
    const files = d.files as Array<Record<string, unknown>> | undefined;
    if (!files) return;
    let added = 0;
    let deleted = 0;
    for (const f of files) {
      added += (f.additions as number) || 0;
      deleted += (f.deletions as number) || 0;
    }
    if (added || deleted) {
      addLineStats(login, added, deleted);
      broadcast('state', getClientState());
    }
  } catch { /* non-critical, skip */ }
}

// ── Monthly reset check ──────────────────────────
function checkMonthlyReset(): void {
  const ms = monthStart();
  const day = todayStr();
  if (state.dailyStartDate !== day) {
    for (const s of Object.values(state.stats)) { s.dailyCommits = 0; s.dailyIssuesClosed = 0; }
    state.dailyStartDate = day;
  }
  if (ms !== state.monthStartDate) {
    console.log(`[server] Monthly reset: ${state.monthStartDate} → ${ms}`);
    for (const login of Object.keys(state.stats)) {
      const s = state.stats[login];
      s.monthlyXp = 0; s.monthlyCommits = 0; s.monthlyPRsOpened = 0;
      s.monthlyPRsMerged = 0; s.monthlyPRsReviewed = 0; s.monthlyIssuesClosed = 0;
      s.monthlyIssuesOpened = 0;
      s.monthlyLinesAdded = 0; s.monthlyLinesDeleted = 0;
      s.dailyCommits = 0; s.dailyIssuesClosed = 0;
    }
    state.monthStartDate = ms;
    state.bossProgress = {};
    state.bossIndex = 0;
    state.previousRanks = {};
    creditedCommitShas.clear();
    state.commitLedgerSeeded = true;
    // NOTE: do NOT clear seenIds here. Events from the new month are filtered by
    // `eventTime < monthStart()` in processEvent; clearing seenIds would let any
    // already-processed events get re-credited to totalXp.
    broadcast('reset', {});
  }
}

// ── GitHub polling ───────────────────────────────
function processEvent(event: Record<string, unknown>): void {
  const xp = xpConfig.xpValues;
  const actorObj = event.actor as Record<string, string>;
  const actor = actorObj?.login;
  const avatarUrl = actorObj?.avatar_url || '';
  const repo = ((event.repo as Record<string, string>)?.name || '').split('/').pop() || '';
  const type = event.type as string;
  const payload = event.payload as Record<string, unknown>;
  const eventTime = (event.created_at as string) || undefined;

  if (!actor || isBot(actor)) return;
  if (eventTime && eventTime < monthStart()) return;
  if (GH_REPOS.length && !GH_REPOS.includes(repo)) return;

  ensureMember(actor, avatarUrl);

  switch (type) {
    case 'PushEvent': {
      const commits = (payload.commits as Array<{ sha?: string; message?: string; author?: { username?: string } }>) || [];
      const newCommits = commits.filter(commit => {
        if (!commit.sha || creditedCommitShas.has(commit.sha)) return false;
        creditedCommitShas.add(commit.sha);
        return true;
      });
      if (newCommits.length > 0) {
        const byAuthor = new Map<string, typeof newCommits>();
        for (const commit of newCommits) {
          const login = commit.author?.username || actor;
          if (isBot(login)) continue;
          byAuthor.set(login, [...(byAuthor.get(login) || []), commit]);
        }
        for (const [login, authored] of byAuthor) {
          const msg = authored[0]?.message?.split('\n')[0] || 'pushed code';
          addXp(login, xp.commit * authored.length, 'commit', repo, `shipped ${authored.length} commit${authored.length > 1 ? 's' : ''}`, msg, eventTime);
          incrementStat(login, 'monthlyCommits', authored.length);
          if (!eventTime || eventTime.slice(0, 10) === todayStr()) incrementStat(login, 'dailyCommits', authored.length);
          state.stats[login].lastCommitDate = eventTime || new Date().toISOString();
          bumpStreak(login, eventTime);
        }
        // Fetch line stats via compare API
        const before = payload.before as string;
        const head = payload.head as string;
        if (before && head && repo) {
          fetchPushLineStats(actor, repo, before, head).catch(() => {});
        }
      }
      break;
    }
    case 'CreateEvent': {
      const refType = payload.ref_type as string;
      if (refType === 'branch') {
        addXp(actor, xp.firstCommit, 'commit', repo, `created branch ${(payload.ref as string) || ''}`, undefined, eventTime);
      }
      break;
    }
    case 'PullRequestEvent': {
      const action = payload.action as string;
      const pr = payload.pull_request as Record<string, unknown>;
      const title = (pr?.title as string) || 'PR';
      const prNum = pr?.number as number;
      if (action === 'opened') {
        const key = `rt-pr-open-${repo}-${prNum}`;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          addXp(actor, xp.prOpened, 'pr-opened', repo, 'opened PR', title, eventTime);
          incrementStat(actor, 'monthlyPRsOpened');
          const prAdd = (pr?.additions as number) || 0;
          const prDel = (pr?.deletions as number) || 0;
          if (prAdd || prDel) addLineStats(actor, prAdd, prDel);
        }
      } else if (action === 'closed' && pr?.merged) {
        const key = `rt-pr-merge-${repo}-${prNum}`;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          addXp(actor, xp.prMerged, 'pr-merged', repo, 'merged PR', title, eventTime);
          incrementStat(actor, 'monthlyPRsMerged');
          const prAdd = (pr?.additions as number) || 0;
          const prDel = (pr?.deletions as number) || 0;
          if (prAdd || prDel) addLineStats(actor, prAdd, prDel);
        }
      }
      break;
    }
    case 'PullRequestReviewEvent': {
      if (payload.action !== 'submitted') break;
      const reviewPr = payload.pull_request as Record<string, unknown>;
      const reviewId = (payload.review as Record<string, unknown>)?.id || event.id;
      const key = `rt-review-${repo}-${reviewId}`;
      if (!seenIds.has(key)) {
        seenIds.add(key);
        addXp(actor, xp.prReviewed, 'review', repo, 'reviewed PR', (reviewPr?.title as string) || '', eventTime);
        incrementStat(actor, 'monthlyPRsReviewed');
      }
      break;
    }
    case 'IssuesEvent': {
      const action = payload.action as string;
      const issue = payload.issue as Record<string, unknown>;
      const title = (issue?.title as string) || '';
      const issueNum = issue?.number as number;
      if (action === 'opened') {
        const key = `rt-issue-open-${repo}-${issueNum}`;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          addXp(actor, xp.issueOpened, 'issue-opened', repo, 'opened issue', title, eventTime);
          incrementStat(actor, 'monthlyIssuesOpened');
        }
      } else if (action === 'closed') {
        const key = `rt-issue-close-${repo}-${issueNum}`;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          addXp(actor, xp.issueClosed, 'issue', repo, 'closed issue', title, eventTime);
          incrementStat(actor, 'monthlyIssuesClosed');
          if (!eventTime || eventTime.slice(0, 10) === todayStr()) incrementStat(actor, 'dailyIssuesClosed');
        }
      }
      break;
    }
  }
}

function processIssueOrPR(item: Record<string, unknown>, repo: string): void {
  const xp = xpConfig.xpValues;
  const user = item.user as Record<string, string> | undefined;
  const login = user?.login;
  const avatarUrl = user?.avatar_url || '';
  if (!login || isBot(login)) return;

  const isPR = !!item.pull_request;
  const itemState = item.state as string;
  const title = (item.title as string) || '';
  const createdAt = item.created_at as string;
  const closedAt = item.closed_at as string | null;

  const ms = monthStart();
  const latestTime = closedAt || createdAt;
  if (latestTime && latestTime < ms) return;

  ensureMember(login, avatarUrl);

  if (isPR) {
    const openKey = `rt-pr-open-${repo}-${item.number}`;
    if (createdAt >= ms && !seenIds.has(openKey)) {
      seenIds.add(openKey);
      addXp(login, xp.prOpened, 'pr-opened', repo, 'opened PR', title, createdAt);
      incrementStat(login, 'monthlyPRsOpened');
    }
    // The issues list names the PR author, not the merger. The event poller and
    // full sync fetch the merger's identity before awarding merge XP.
  } else {
    const openKey = `rt-issue-open-${repo}-${item.number}`;
    if (createdAt >= ms && !seenIds.has(openKey)) {
      seenIds.add(openKey);
      addXp(login, xp.issueOpened, 'issue-opened', repo, 'opened issue', title, createdAt);
      incrementStat(login, 'monthlyIssuesOpened');
    }
    // Likewise, a closed issue must be credited to its closer, not its author.
  }
}

let reposFetched = false;
let polling = false;
let syncing = false;
let repoPollCursor = 0;

async function pollEvents(): Promise<void> {
  if (polling || syncing) return;
  polling = true;
  try {
  reloadConfigIfChanged();
  checkMonthlyReset();

  // Fetch repos if needed (optional — org events cover all repos anyway)
  if (state.repos.length === 0 && !reposFetched) {
    reposFetched = true;
    if (GH_REPOS.length > 0) {
      state.repos = GH_REPOS;
    } else {
      const { data, ok } = await ghFetch(`${BASE}/orgs/${encodeURIComponent(GH_ORG)}/repos?per_page=100&sort=pushed`);
      if (ok && Array.isArray(data)) {
        state.repos = data.map((r: Record<string, string>) => r.name);
        console.log(`[server] Discovered ${state.repos.length} repos`);
      }
      // Not fatal — org events endpoint covers all repos
    }
  }

  let eventsProcessed = 0;

  // Org events
  try {
    const { data, etag, notModified } = await ghFetch(
      `${BASE}/orgs/${encodeURIComponent(GH_ORG)}/events?per_page=100`,
      state.etags['__org__'],
    );
    state.etags['__org__'] = etag || '';
    if (!notModified && Array.isArray(data)) {
      for (const event of [...data].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))) {
        const id = event.id as string;
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        processEvent(event);
        eventsProcessed++;
      }
    }
  } catch (err) { console.warn('[server] org events error:', err); }

  // Rotate through repositories instead of requesting every repo twice on
  // every poll. Org events cover the gaps between per-repo checks.
  const repoCount = Math.min(2, state.repos.length);
  const reposToCheck = Array.from({ length: repoCount }, (_, i) => state.repos[(repoPollCursor + i) % state.repos.length]);
  if (state.repos.length) repoPollCursor = (repoPollCursor + repoCount) % state.repos.length;
  const REPO_BATCH = 5;
  for (let i = 0; i < reposToCheck.length; i += REPO_BATCH) {
    const batch = reposToCheck.slice(i, i + REPO_BATCH);
    const batchBefore = eventsProcessed;

    await Promise.allSettled(batch.map(async (repo) => {
      try {
        const { data, etag, notModified } = await ghFetch(
          `${BASE}/repos/${encodeURIComponent(GH_ORG)}/${encodeURIComponent(repo)}/events?per_page=100`,
          state.etags[repo],
        );
        state.etags[repo] = etag || '';
        if (!notModified && Array.isArray(data)) {
          for (const event of [...data].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))) {
            const id = event.id as string;
            if (seenIds.has(id)) continue;
            seenIds.add(id);
            processEvent(event);
            eventsProcessed++;
          }
        }
      } catch { /* ignore */ }

      // Supplementary: recent issues/PRs
      try {
        const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data, ok } = await ghFetch(
          `${BASE}/repos/${encodeURIComponent(GH_ORG)}/${encodeURIComponent(repo)}/issues?state=all&sort=updated&direction=desc&since=${encodeURIComponent(since)}&per_page=30`,
        );
        if (ok && Array.isArray(data)) {
          for (const item of data) processIssueOrPR(item, repo);
        }
      } catch { /* ignore */ }
    }));

    // Broadcast after each batch so clients see updates incrementally
    if (eventsProcessed > batchBefore) {
      broadcast('state', getClientState());
    }
  }

  console.log(`[server] Poll: ${eventsProcessed} events, seenIds=${seenIds.size}`);

  // Broadcast state snapshot
  broadcast('state', getClientState());
  persistState();
  } finally {
    polling = false;
  }
}

async function fullSync(): Promise<void> {
  if (syncing || polling) return;
  syncing = true;
  try {
  reloadConfigIfChanged();
  checkMonthlyReset();
  const xp = xpConfig.xpValues;
  const ws = monthStart();
  const today = todayStr();

  try {
    // Parallel search queries
    const [commitResult, prCreatedResult, prMergedResult, issueClosedResult, issueOpenedResult] = await Promise.allSettled([
      searchAll('commits', `org:${GH_ORG}`, 'committer-date', ws, today),
      searchAll('issues', `org:${GH_ORG} type:pr`, 'created', ws, today),
      searchAll('issues', `org:${GH_ORG} type:pr is:merged`, 'merged', ws, today),
      searchAll('issues', `org:${GH_ORG} type:issue is:closed`, 'closed', ws, today),
      searchAll('issues', `org:${GH_ORG} type:issue`, 'created', ws, today),
    ]);
    const searchData = (result: PromiseSettledResult<SearchResult>): SearchResult => result.status === 'fulfilled' ? result.value : { items: [], complete: false };
    const commitsSearch = searchData(commitResult), prCreatedSearch = searchData(prCreatedResult), prMergedSearch = searchData(prMergedResult), issueClosedSearch = searchData(issueClosedResult), issueOpenedSearch = searchData(issueOpenedResult);

    // Commits
    const commitItems = commitsSearch.complete ? commitsSearch.items : [];
    const commitsByUser: Record<string, { count: number; unseen: number; todayCount: number; avatarUrl: string; repos: Set<string>; lastMsg: string; lastTime: string }> = {};
    const searchCommitShas = new Set<string>();
    for (const c of commitItems) {
      const co = c as Record<string, unknown>;
      const sha = co.sha as string;
      const repo = (co.repository as Record<string, string>)?.name || '';
      if (!sha || searchCommitShas.has(sha) || (GH_REPOS.length && !GH_REPOS.includes(repo))) continue;
      searchCommitShas.add(sha);
      const login = (co.author as Record<string, string>)?.login || (co.committer as Record<string, string>)?.login;
      if (!login || isBot(login)) continue;
      const avatar = (co.author as Record<string, string>)?.avatar_url || '';
      const msg = ((co.commit as Record<string, unknown>)?.message as string || '');
      const commit = co.commit as Record<string, unknown> | undefined;
      const time = (commit?.committer as Record<string, string> | undefined)?.date || (commit?.author as Record<string, string> | undefined)?.date || '';
      if (!commitsByUser[login]) commitsByUser[login] = { count: 0, unseen: 0, todayCount: 0, avatarUrl: avatar, repos: new Set(), lastMsg: '', lastTime: '' };
      commitsByUser[login].count++;
      if (!creditedCommitShas.has(sha)) commitsByUser[login].unseen++;
      if (time.slice(0, 10) === today) commitsByUser[login].todayCount++;
      commitsByUser[login].repos.add(repo);
      if (time > commitsByUser[login].lastTime) {
        commitsByUser[login].lastMsg = msg.split('\n')[0];
        commitsByUser[login].lastTime = time;
      }
    }

    // PR numbers are only unique within a repository.
    const prCreatedItems = prCreatedSearch.complete ? prCreatedSearch.items : [];
    const prMergedItems = prMergedSearch.complete ? prMergedSearch.items : [];
    const prKey = (p: Record<string, unknown>) => `${p.repository_url || ''}#${p.number || ''}`;
    const createdKeys = new Set(prCreatedItems.map(prKey));
    const mergedKeys = new Set(prMergedItems.map(prKey));
    const prAllItems = [...new Map([...prCreatedItems, ...prMergedItems].map(p => [prKey(p), p])).values()];
    const prDataByUser: Record<string, { opens: number; merges: number; avatarUrl: string }> = {};
    let mergesComplete = prMergedSearch.complete;
    const prFeedRaw: Array<{ login: string; title: string; repo: string; time: string; merged: boolean; key: string }> = [];
    const prDetailUrls: Array<{ login: string; url: string; repo: string; title: string; mergedAt: string; key: string }> = [];
    for (const pr of prAllItems) {
      const p = pr as Record<string, unknown>;
      const login = (p.user as Record<string, string>)?.login;
      if (!login) continue;
      const avatar = (p.user as Record<string, string>)?.avatar_url || '';
      const repo = ((p.repository_url as string) || '').split('/').pop() || '';
      if (GH_REPOS.length && !GH_REPOS.includes(repo)) continue;
      const title = (p.title as string) || '';
      const key = prKey(p);
      if (createdKeys.has(key) && !isBot(login)) {
        if (!prDataByUser[login]) prDataByUser[login] = { opens: 0, merges: 0, avatarUrl: avatar };
        prDataByUser[login].opens++;
        prFeedRaw.push({ login, title, repo, time: p.created_at as string, merged: false, key });
      }
      const prUrl = (p.pull_request as Record<string, string>)?.url;
      if (prUrl) prDetailUrls.push({ login, url: prUrl, repo, title, mergedAt: (p.pull_request as Record<string, string>)?.merged_at || '', key });
      else if (mergedKeys.has(key)) mergesComplete = false;
    }

    // Fetch PR details to get line stats (additions/deletions)
    const linesByUser: Record<string, { added: number; deleted: number }> = {};
    const BATCH_SIZE = 5;
    for (let i = 0; i < prDetailUrls.length; i += BATCH_SIZE) {
      const batch = prDetailUrls.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(({ url }) => ghFetch(url)));
      for (let j = 0; j < batch.length; j++) {
        const result = results[j];
        if (result.status !== 'fulfilled' || !result.value.ok || !result.value.data) {
          if (mergedKeys.has(batch[j].key)) mergesComplete = false;
          continue;
        }
        const prDetail = result.value.data as Record<string, unknown>;
        const adds = (prDetail.additions as number) || 0;
        const dels = (prDetail.deletions as number) || 0;
        const login = batch[j].login;
        if (!isBot(login)) {
          if (!linesByUser[login]) linesByUser[login] = { added: 0, deleted: 0 };
          linesByUser[login].added += adds;
          linesByUser[login].deleted += dels;
        }
        if (mergedKeys.has(batch[j].key)) {
          const merger = (prDetail.merged_by as Record<string, string> | null)?.login;
          if (merger && !isBot(merger)) {
            if (!prDataByUser[merger]) prDataByUser[merger] = { opens: 0, merges: 0, avatarUrl: (prDetail.merged_by as Record<string, string>)?.avatar_url || '' };
            prDataByUser[merger].merges++;
            prFeedRaw.push({ login: merger, title: batch[j].title, repo: batch[j].repo, time: batch[j].mergedAt, merged: true, key: batch[j].key });
          } else if (!merger) mergesComplete = false;
        }
      }
    }

    // Issues closed
    const closedIssues = issueClosedSearch.complete ? issueClosedSearch.items : [];
    let closesComplete = issueClosedSearch.complete;
    const issuesClosedByUser: Record<string, { count: number; avatarUrl: string }> = {};
    const issueFeedRaw: Array<{ login: string; title: string; repo: string; time: string; key: string }> = [];
    for (let i = 0; i < closedIssues.length; i += 5) {
      const batch = closedIssues.slice(i, i + 5);
      const results = await Promise.allSettled(batch.map(issue => issue.closed_by
        ? Promise.resolve({ data: issue, ok: true })
        : ghFetch(issue.url as string)));
      for (let j = 0; j < batch.length; j++) {
        const iss = batch[j], result = results[j];
        if (result.status !== 'fulfilled' || !result.value.ok || !result.value.data) { closesComplete = false; continue; }
        const detail = result.value.data as Record<string, unknown>;
        const closer = detail.closed_by as Record<string, string> | null;
        const login = closer?.login;
        const repo = ((iss.repository_url as string) || '').split('/').pop() || '';
        if (!login) { closesComplete = false; continue; }
        if (isBot(login) || (GH_REPOS.length && !GH_REPOS.includes(repo))) continue;
        if (!issuesClosedByUser[login]) issuesClosedByUser[login] = { count: 0, avatarUrl: closer?.avatar_url || '' };
        issuesClosedByUser[login].count++;
        issueFeedRaw.push({ login, title: (iss.title as string) || '', repo, time: (iss.closed_at as string) || '', key: `${iss.repository_url}#${iss.number}` });
      }
    }

    // Issue opens for XP
    const openedIssues = issueOpenedSearch.complete ? issueOpenedSearch.items : [];
    const issuesOpenedByUser: Record<string, { count: number }> = {};
    for (const issue of openedIssues) {
      const iss = issue as Record<string, unknown>;
      const login = (iss.user as Record<string, string>)?.login;
      if (!login || isBot(login)) continue;
      const repo = ((iss.repository_url as string) || '').split('/').pop() || '';
      if (GH_REPOS.length && !GH_REPOS.includes(repo)) continue;
      if (!issuesOpenedByUser[login]) issuesOpenedByUser[login] = { count: 0 };
      issuesOpenedByUser[login].count++;
    }

    // Reviews (was missing from fullSync)
    // Note: Search API doesn't directly support review searches,
    // so we rely on the poller for review XP

    // Compute authoritative XP per user
    const allLogins = new Set([
      ...Object.keys(commitsByUser),
      ...Object.keys(prDataByUser),
      ...Object.keys(issuesClosedByUser),
      ...Object.keys(issuesOpenedByUser),
    ]);
    const creditedCommitsByUser = new Map<string, number>();

    for (const login of allLogins) {
      const c = commitsByUser[login];
      const p = prDataByUser[login];
      const ic = issuesClosedByUser[login];
      const io = issuesOpenedByUser[login];
      const commits = c?.count || 0;
      const prOpens = p?.opens || 0;
      const prMerges = p?.merges || 0;
      const issueCloses = ic?.count || 0;
      const issueOpens = io?.count || 0;

      const avatarUrl = c?.avatarUrl || p?.avatarUrl || ic?.avatarUrl || '';
      ensureMember(login, avatarUrl);
      const s = state.stats[login] || emptyStats(login);

      // Per-category reconciliation: each search query may succeed or fail
      // independently (rate limits, partial results), so credit each category
      // on its own. Counters are monotonically increasing — search can only
      // bump them upward — and monthlyXp/totalXp gain exactly the XP value of
      // the new events. This keeps monthlyXp == sum(counter * xpValue) regardless
      // of which queries returned, and is robust against double-counting because
      // poller-credited events are already reflected in the existing counter.
      let totalDelta = 0;
      let commitDelta = 0;
      const bumpCategory = (searchCount: number, currentField: keyof DevStats, xpPerEvent: number) => {
        const current = (s[currentField] as number) || 0;
        if (searchCount > current) {
          const eventDelta = searchCount - current;
          (s as unknown as Record<string, number>)[currentField as string] = searchCount;
          totalDelta += eventDelta * xpPerEvent;
        }
      };
      if (commitsSearch.complete) {
        if (state.commitLedgerSeeded) {
          commitDelta = c?.unseen || 0;
          s.monthlyCommits += commitDelta;
          totalDelta += commitDelta * xp.commit;
        } else {
          const beforeCommits = s.monthlyCommits;
          bumpCategory(commits, 'monthlyCommits', xp.commit);
          commitDelta = s.monthlyCommits - beforeCommits;
        }
      }
      creditedCommitsByUser.set(login, commitDelta);
      if (prCreatedSearch.complete) bumpCategory(prOpens, 'monthlyPRsOpened', xp.prOpened);
      if (mergesComplete) bumpCategory(prMerges, 'monthlyPRsMerged', xp.prMerged);
      if (closesComplete) bumpCategory(issueCloses, 'monthlyIssuesClosed', xp.issueClosed);
      if (issueOpenedSearch.complete) bumpCategory(issueOpens, 'monthlyIssuesOpened', xp.issueOpened);
      if (c?.lastTime && (!s.lastCommitDate || c.lastTime > s.lastCommitDate)) s.lastCommitDate = c.lastTime;
      if (c && commitsSearch.complete) s.dailyCommits = Math.max(s.dailyCommits, c.todayCount);
      if (totalDelta > 0) {
        if (totalDelta > 5000) {
          console.warn(`[server] Suspicious XP delta for ${login}: +${totalDelta} (search counts c=${commits} pO=${prOpens} pM=${prMerges} iC=${issueCloses} iO=${issueOpens})`);
        }
        s.monthlyXp += totalDelta;
        s.totalXp += totalDelta;
      }
      const lines = linesByUser[login];
      if (lines) {
        if (lines.added > s.monthlyLinesAdded) s.monthlyLinesAdded = lines.added;
        if (lines.deleted > s.monthlyLinesDeleted) s.monthlyLinesDeleted = lines.deleted;
      }
      state.stats[login] = s;
    }
    if (commitsSearch.complete) {
      for (const sha of searchCommitShas) creditedCommitShas.add(sha);
      state.commitLedgerSeeded = true;
    }

    // Generate feed items from search results
    const newFeedItems: FeedItem[] = [];
    const existingIds = new Set(state.feed.map(f => f.id));

    for (const login of allLogins) {
      const c = commitsByUser[login];
      const newCommitCount = creditedCommitsByUser.get(login) || 0;
      if (c && c.lastMsg && newCommitCount > 0) {
        const id = `sync-commit-${login}-${c.lastTime}`;
        if (!existingIds.has(id)) {
          newFeedItems.push({
            id,
            type: 'commit',
            user: login,
            repo: [...c.repos][0] || '',
            message: `shipped ${newCommitCount} commit${newCommitCount > 1 ? 's' : ''}`,
            detail: c.lastMsg,
            xp: newCommitCount * xp.commit,
            time: c.lastTime,
          });
          existingIds.add(id);
        }
      }
    }

    for (const item of prFeedRaw) {
      if (item.merged && !mergesComplete) continue;
      const actionKey = `rt-pr-${item.merged ? 'merge' : 'open'}-${item.repo}-${item.key.split('#').pop()}`;
      if (seenIds.has(actionKey)) continue;
      seenIds.add(actionKey);
      const id = `sync-pr-${item.merged ? 'merge' : 'open'}-${item.key}`;
      if (!existingIds.has(id)) {
        newFeedItems.push({
          id,
          type: item.merged ? 'pr-merged' : 'pr-opened',
          user: item.login,
          repo: item.repo,
          message: item.merged ? 'merged PR' : 'opened PR',
          detail: item.title,
          xp: item.merged ? xp.prMerged : xp.prOpened,
          time: item.time,
        });
        existingIds.add(id);
      }
    }

    for (const item of issueFeedRaw) {
      if (!closesComplete) continue;
      const actionKey = `rt-issue-close-${item.repo}-${item.key.split('#').pop()}`;
      if (seenIds.has(actionKey)) continue;
      seenIds.add(actionKey);
      const id = `sync-issue-${item.key}`;
      if (!existingIds.has(id)) {
        newFeedItems.push({
          id,
          type: 'issue',
          user: item.login,
          repo: item.repo,
          message: 'closed issue',
          detail: item.title,
          xp: xp.issueClosed,
          time: item.time,
        });
        existingIds.add(id);
      }
    }

    // Merge and keep latest 50
    state.feed = [...newFeedItems, ...state.feed]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 50);

    // Boss progress
    const totalMerged = Object.values(prDataByUser).reduce((a, p) => a + p.merges, 0);
    if (mergesComplete) state.bossProgress.prsMerged = totalMerged;
    if (closesComplete) state.bossProgress.issuesClosed = Object.values(issuesClosedByUser).reduce((a, s) => a + s.count, 0);
    const searchCommitTotal = Object.values(commitsByUser).reduce((a, c) => a + c.count, 0);
    const statsCommitTotal = Object.values(state.stats).reduce((a, s) => a + s.monthlyCommits, 0);
    state.bossProgress.commits = commitsSearch.complete ? Math.max(searchCommitTotal, statsCommitTotal) : statsCommitTotal;

    // Advance one objective at a time. Progress is monthly and carries into
    // the next objective; clearing it would hide already earned activity.
    while (xpConfig.bossGoals[state.bossIndex] && (state.bossProgress[xpConfig.bossGoals[state.bossIndex].metric] || 0) >= xpConfig.bossGoals[state.bossIndex].target) {
      broadcast('overlay', { type: 'boss-victory', payload: { bossIndex: state.bossIndex } });
      state.bossIndex++;
    }

    // Shame PRs + org members in parallel
    const [shameResult, membersResult] = await Promise.allSettled([
      ghFetch(`${BASE}/search/issues?q=${encodeURIComponent(`org:${GH_ORG} type:pr is:open review:none`)}&per_page=100`),
      ghFetch(`${BASE}/orgs/${encodeURIComponent(GH_ORG)}/members?per_page=100`),
    ]);

    if (shameResult.status === 'fulfilled' && shameResult.value.ok) {
      const shamePRsRaw = (shameResult.value.data as Record<string, unknown>)?.items as unknown[] || [];
      state.shamePRs = shamePRsRaw.map((pr: unknown) => {
        const p = pr as Record<string, unknown>;
        return {
          title: (p.title as string) || '',
          repo: ((p.repository_url as string) || '').split('/').pop() || '',
          author: ((p.user as Record<string, string>)?.login) || '',
          age: Math.round((Date.now() - new Date(p.created_at as string).getTime()) / 3_600_000),
        };
      });
    }

    // Belts
    const allStats = Object.values(state.stats);
    if (allStats.length > 0) {
      const reviewer = allStats.reduce((best, s) =>
        s.monthlyPRsReviewed > (best?.monthlyPRsReviewed || 0) ? s : best, allStats[0]);
      const closer = allStats.reduce((best, s) =>
        s.monthlyIssuesClosed > (best?.monthlyIssuesClosed || 0) ? s : best, allStats[0]);
      const speed = allStats.reduce((best, s) =>
        s.monthlyPRsMerged > (best?.monthlyPRsMerged || 0) ? s : best, allStats[0]);
      state.belts = {
        reviewer: reviewer?.login || null,
        closer: closer?.login || null,
        speedKing: speed?.login || null,
      };
    }

    // Apply org members from parallel result
    if (membersResult.status === 'fulfilled' && membersResult.value.ok && Array.isArray(membersResult.value.data)) {
      for (const m of membersResult.value.data as Array<Record<string, string>>) {
        if (!isBot(m.login)) ensureMember(m.login, m.avatar_url || '');
      }
    }

    console.log(`[server] Full sync done: ${allLogins.size} users`);
  } catch (err) {
    console.warn('[server] Full sync failed:', err);
  }

  broadcast('state', getClientState());
  persistState();
  } finally {
    syncing = false;
  }
}

// ── Client-facing state ──────────────────────────
function getClientState() {
  return {
    members: state.members,
    stats: state.stats,
    feed: state.feed,
    bossProgress: state.bossProgress,
    bossIndex: state.bossIndex,
    previousRanks: state.previousRanks,
    belts: state.belts,
    shamePRs: state.shamePRs,
    monthStartDate: state.monthStartDate,
    xpConfig,
  };
}

// ── Express server ───────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Admin-secret middleware — protects destructive endpoints.
// If GITARENA_ADMIN_SECRET is set, the caller must supply the same value
// in the X-Admin-Secret request header. Skipped when secret is not configured
// (i.e. local development without the env var set).
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!ADMIN_SECRET) { next(); return; }
  const provided = req.headers['x-admin-secret'];
  if (!provided || provided !== ADMIN_SECRET) {
    res.status(403).json({ error: 'Forbidden: missing or invalid X-Admin-Secret header' });
    return;
  }
  next();
}

// Full state snapshot
app.get('/api/state', (_req, res) => {
  res.json(getClientState());
});

// XP config (read)
app.get('/api/config', (_req, res) => {
  reloadConfigIfChanged();
  res.json(xpConfig);
});

// XP config (update)
app.put('/api/config', requireAdmin, (req, res) => {
  try {
    const newConfig = req.body as XpConfig;
    // Basic validation
    if (!newConfig.xpValues || !newConfig.levels) {
      res.status(400).json({ error: 'Missing xpValues or levels' });
      return;
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');
    xpConfig = newConfig;
    configMtime = fs.statSync(CONFIG_PATH).mtimeMs;
    broadcast('config', xpConfig);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Force recalculate (wipe state and re-sync)
app.post('/api/recalculate', requireAdmin, async (_req, res) => {
  console.log('[server] Force recalculate requested');
  // Preserve members (avatars, colors) but reset XP
  for (const login of Object.keys(state.stats)) {
    state.stats[login] = emptyStats(login);
  }
  state.feed = [];
  state.bossProgress = {};
  state.previousRanks = {};
  seenIds.clear();
  creditedCommitShas.clear();
  state.commitLedgerSeeded = true;
  await fullSync();
  res.json(getClientState());
});

// A repair preview never changes scores. Historical branch and streak bonuses
// were not itemized in old state, so excess is left untouched.
function buildRepairPreview() {
  const xp = xpConfig.xpValues;
  const rows = Object.entries(state.stats).sort(([a], [b]) => a.localeCompare(b)).map(([login, s]) => {
    const minimumXp =
      (s.monthlyCommits || 0) * xp.commit +
      (s.monthlyPRsOpened || 0) * xp.prOpened +
      (s.monthlyPRsMerged || 0) * xp.prMerged +
      (s.monthlyPRsReviewed || 0) * xp.prReviewed +
      (s.monthlyIssuesClosed || 0) * xp.issueClosed +
      (s.monthlyIssuesOpened || 0) * xp.issueOpened;
    return {
      login, currentMonthlyXp: s.monthlyXp, currentTotalXp: s.totalXp,
      minimumXp, safeIncrease: Math.max(0, minimumXp - s.monthlyXp),
      unverifiedExcess: Math.max(0, s.monthlyXp - minimumXp),
      counters: [s.monthlyCommits, s.monthlyPRsOpened, s.monthlyPRsMerged, s.monthlyPRsReviewed, s.monthlyIssuesClosed, s.monthlyIssuesOpened],
    };
  });
  const snapshot = createHash('sha256').update(JSON.stringify({ monthStartDate: state.monthStartDate, xp, rows })).digest('hex');
  return { snapshot, rows };
}

app.get('/api/repair/preview', requireAdmin, (_req, res) => {
  const { snapshot, rows } = buildRepairPreview();
  res.json({ token: snapshot, rows, note: 'Repair adds XP when current monthly XP is below the counter-derived minimum at current XP rates. Excess may include legitimate branch and streak bonuses.' });
});

app.post('/api/repair', requireAdmin, (req, res) => {
  const { snapshot, rows } = buildRepairPreview();
  if (req.body?.token !== snapshot) { res.status(409).json({ error: 'Preview token is missing or stale. Request a new preview.' }); return; }
  const adjustments = rows.filter(row => row.safeIncrease > 0).map(row => {
    const s = state.stats[row.login];
    s.monthlyXp += row.safeIncrease;
    s.totalXp += row.safeIncrease;
    return { login: row.login, monthlyXpBefore: row.currentMonthlyXp, monthlyXpAfter: s.monthlyXp, totalXpAfter: s.totalXp, increase: row.safeIncrease };
  });
  const ranks: Record<string, number> = {};
  rankedLogins().forEach((login, i) => { ranks[login] = i + 1; });
  state.previousRanks = ranks;
  persistState();
  broadcast('state', getClientState());
  res.json({ ok: true, adjustments });
});

// SSE endpoint
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  const clientId = ++sseClientId;
  const client: SseClient = { id: clientId, res };
  sseClients.push(client);
  console.log(`[server] SSE client ${clientId} connected (total: ${sseClients.length})`);

  req.on('close', () => {
    const idx = sseClients.findIndex(c => c.id === clientId);
    if (idx >= 0) sseClients.splice(idx, 1);
    console.log(`[server] SSE client ${clientId} disconnected (total: ${sseClients.length})`);
  });
});

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, clients: sseClients.length, seenIds: seenIds.size, repos: state.repos.length });
});

// ── Static frontend (production / Docker) ────────
// When SERVE_STATIC=1 the backend serves the Vite build output.
// In development the Vite dev server handles the frontend separately.
if (process.env.SERVE_STATIC === '1') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── Start ────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] GitArena backend running on http://0.0.0.0:${PORT}`);
  if (DEMO_MODE) {
    console.log('[server] Running in DEMO mode — GitHub polling disabled');
    return;
  }
  console.log(`[server] Org: ${GH_ORG}, repos config: ${GH_REPOS.length > 0 ? GH_REPOS.join(', ') : 'auto-discover'}`);

  // Initial full sync then start polling
  fullSync().then(() => {
    pollEvents();
    setInterval(pollEvents, xpConfig.pollIntervalSeconds * 1000);
    setInterval(fullSync, xpConfig.fullSyncIntervalSeconds * 1000);
    setInterval(persistState, 30_000); // persist every 30s
  });
});
