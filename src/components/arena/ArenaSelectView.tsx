import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { ArenaIcon, type IconName } from '../ui/ArenaIcon';
import { AnimatedScore, Avatar, RankEmblem, RankTierChip, UiSwitch, tierForRank, compact, elapsed, eventIcons, number, rankBy, type UiMode } from '../shared';
import { getLevel } from '../../lib/xp';
import { getBadgeDef } from '../../lib/badges';
import { MatchPointChip, seasonClock } from '../extras';
import type { DevStats, FeedItem, Member } from '../../types';
import './arena.css';

const sections: Array<{ label: string; icon: IconName }> = [{ label: 'Standings', icon: 'users' }, { label: 'Pulse', icon: 'bolt' }, { label: 'Meta', icon: 'layers' }, { label: 'Spotlight', icon: 'star' }];
const DAY = 86400000;

/** Rotates through `count` positions on a timer; resets when `count` changes. */
function useTicker(count: number, ms: number) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setTick(0);
    if (count <= 1) return;
    const id = setInterval(() => setTick(t => (t + 1) % count), ms);
    return () => clearInterval(id);
  }, [count, ms]);
  return tick;
}

function TopBar({ now, periodStart, isDemo, memberCount, section, soundOn, onSound, uiMode, onUiMode }: { now: number; periodStart: string; isDemo: boolean; memberCount: number; section: number; soundOn: boolean; onSound: () => void; uiMode: UiMode; onUiMode: (mode: UiMode) => void }) {
  return <header className="as-top">
    <div className="as-brand"><ArenaIcon name="arena" size={30}/><span>GIT<b>ARENA</b></span></div>
    <span className="as-top-rule"/>
    <nav className="as-sections" aria-label="Display sections">{sections.map((s, i) => <span key={s.label} className={i === section ? 'active' : ''}><ArenaIcon name={s.icon} size={18}/>{s.label}{i === section && <motion.i layoutId="as-section-line"/>}</span>)}</nav>
    <div className="as-top-spacer"/>
    <MatchPointChip periodStart={periodStart} now={now}/>
    <span className="as-status"><i/>{isDemo ? 'DEMO' : 'LIVE'}</span>
    <span className="as-top-meta"><ArenaIcon name="users" size={17}/>{memberCount}</span>
    <span className="as-clock">{new Date(now).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })}<small>UTC</small></span>
    <UiSwitch mode={uiMode} onChange={onUiMode}/>
    <button className="as-sound" onClick={onSound} aria-label={soundOn ? 'Mute sound' : 'Enable sound'}><ArenaIcon name={soundOn ? 'volume' : 'mute'} size={19}/></button>
  </header>;
}

function SeasonCard({ periodStart, now, teamXp, active }: { periodStart: string; now: number; teamXp: number; active: boolean }) {
  const start = new Date(`${periodStart}T00:00:00Z`);
  const end = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1);
  const total = Math.round((end - start.getTime()) / DAY);
  const left = Math.max(0, Math.ceil((end - now) / DAY));
  const r = 30, c = 2 * Math.PI * r, spent = Math.min(1, Math.max(0, (now - start.getTime()) / (end - start.getTime())));
  return <section className={`as-season ${active ? 'is-called' : ''}`}>
    <span className="as-season-bignum">{String(start.getUTCMonth() + 1).padStart(2, '0')}</span>
    <div className="as-season-copy"><span className="as-kicker">+ SEASON {start.getUTCFullYear()}</span><h2>{start.toLocaleString('en', { month: 'long', timeZone: 'UTC' })}</h2><small>ROUND {seasonClock(periodStart, now).round}/{total} · {number(teamXp)} TEAM XP</small></div>
    <div className="as-ring" title={`${left} of ${total} days left`}><svg viewBox="0 0 72 72"><circle cx="36" cy="36" r={r}/><motion.circle cx="36" cy="36" r={r} strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * spent }} transition={{ duration: 1.2, ease: 'easeOut' }}/></svg><strong>{left}</strong><small>DAYS</small></div>
  </section>;
}

function feedVerb(item: FeedItem) {
  if (item.type === 'branch-push') return item.detail.includes('linked') ? 'PUSHING' : 'PICKING…';
  return ({ commit: 'COMMITTED', 'pr-opened': 'OPENED PR', 'pr-merged': 'MERGED', review: 'REVIEWED', issue: 'CLOSED ISSUE', 'issue-opened': 'OPENED ISSUE', badge: 'UNLOCKED', streak: 'ON A STREAK', 'level-up': 'LEVELED UP' } as Record<string, string>)[item.type] || 'ACTIVE';
}

function PartyFeed({ feed, members, now, active }: { feed: FeedItem[]; members: Member[]; now: number; active: boolean }) {
  const recent = feed.slice(0, 10);
  const [offset, setOffset] = useState(0);
  useEffect(() => { setOffset(0); }, [recent[0]?.id]);
  useEffect(() => { if (recent.length <= 5) return; const id = setInterval(() => setOffset(o => (o + 1) % recent.length), 4200); return () => clearInterval(id); }, [recent.length]);
  const rows = recent.length ? [...recent.slice(offset), ...recent.slice(0, offset)] : [];
  return <section className={`as-party ${active ? 'is-called' : ''}`}>
    <div className="as-panel-head"><span><ArenaIcon name="bolt" size={16}/> THE PULSE</span><small><i/> LIVE</small></div>
    <div className="as-party-list">
      {rows.length === 0 && <div className="as-empty">WAITING FOR THE FIRST MOVE</div>}
      {rows.map(item => { const member = members.find(m => m.login === item.user); return <motion.div layout key={item.id} className={`as-party-row ${item.id === recent[0]?.id ? 'is-latest' : ''}`} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
        <div className="as-hex"><Avatar member={member}/><span className="as-hex-badge"><ArenaIcon name={eventIcons[item.type] || 'spark'} size={13}/></span></div>
        <div className="as-party-copy"><strong>{member?.name || item.user}</strong><small>{feedVerb(item)} <b>·</b> {item.repo || item.detail}</small></div>
        <div className="as-party-meta"><strong>{item.type === 'branch-push' ? 'PR' : item.xp > 0 ? `+${item.xp}` : '—'}</strong><small>{elapsed(item.time, now)}</small></div>
      </motion.div>; })}
    </div>
  </section>;
}

function Abilities({ s }: { s?: DevStats }) {
  const items: Array<[IconName, number, string]> = [['git', s?.monthlyCommits || 0, 'Commits'], ['merge', s?.monthlyPRsMerged || 0, 'Merges'], ['review', s?.monthlyPRsReviewed || 0, 'Reviews'], ['flame', s?.streak || 0, 'Streak']];
  return <div className="as-abilities">{items.map(([icon, value, label]) => <span key={label} title={label}><ArenaIcon name={icon} size={17}/><b>{compact(value)}</b></span>)}</div>;
}

function AgentCard({ member, s, rank, focused, rose, onFire }: { member: Member; s?: DevStats; rank: number; focused: boolean; rose: boolean; onFire: boolean }) {
  const leader = rank === 0, tier = tierForRank(rank), level = getLevel(s?.totalXp || 0);
  return <motion.article layout className={`as-card ${leader ? 'is-leader' : ''} ${focused ? 'is-focused' : ''} ${tierForRank(rank) ? `as-card--${tierForRank(rank)}` : ''} ${onFire ? 'is-onfire' : ''}`} transition={{ layout: { type: 'spring', stiffness: 170, damping: 22 } }}>
    <div className="as-card-art">{member.avatarUrl ? <img src={member.avatarUrl} alt=""/> : <span style={{ background: member.color }}/>}</div>
    <header className="as-card-top">
      <span className="as-card-rank">{String(rank + 1).padStart(2, '0')}{onFire && <span className="as-card-fire" title="On fire: 3+ plays this hour"><ArenaIcon name="flame" size={16}/></span>}</span>
      {tier && <RankEmblem tier={tier} size={leader ? 62 : 52}/>}
    </header>
    <AnimatePresence>{rose && <motion.span className="as-rankup" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}><ArenaIcon name="arrow" size={14}/> RANK UP</motion.span>}</AnimatePresence>
    <div className="as-plate">
      <div className="as-plate-line">
        <span className="as-plate-tag">{tier || `LVL ${level.level}`}</span>
        <i/>
        <span>{leader ? 'LOCKED IN' : tier ? `LVL ${level.level}` : level.title}</span>
      </div>
      <h3>{member.name}</h3>
      <AnimatedScore xp={s?.monthlyXp || 0} className="as-card-xp"/>
      <Abilities s={s}/>
    </div>
  </motion.article>;
}

function MiniCard({ member, s, rank, onFire }: { member: Member; s?: DevStats; rank: number; onFire: boolean }) {
  const locked = !s?.monthlyXp;
  return <motion.article className={`as-mini ${locked ? 'is-locked' : ''}`} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} transition={{ duration: 0.35 }}>
    <div className="as-mini-art">{member.avatarUrl ? <img src={member.avatarUrl} alt=""/> : null}</div>
    {locked && <span className="as-mini-lock"><ArenaIcon name="lock" size={17}/></span>}
    {onFire && <span className="as-mini-fire"><ArenaIcon name="flame" size={16}/></span>}<div className="as-mini-copy"><small>{locked ? 'Locked' : `#${rank + 1} · ${number(s?.monthlyXp || 0)} XP`}</small><strong>{member.name}</strong></div>
  </motion.article>;
}

function AgentCards({ ranked, stats, active, hot }: { ranked: Member[]; stats: Record<string, DevStats>; active: boolean; hot: Set<string> }) {
  const top = ranked.slice(0, 5), rest = ranked.slice(5);
  const focus = useTicker(top.length, 3800);
  const pages = Math.ceil(rest.length / 5);
  const page = useTicker(pages, 5200);
  const previous = useRef<Record<string, number>>({});
  const [risen, setRisen] = useState<Record<string, boolean>>({});
  const order = ranked.map(m => m.login).join('|');
  useEffect(() => {
    const next: Record<string, number> = {}, up: Record<string, boolean> = {};
    ranked.forEach((m, i) => { next[m.login] = i; const before = previous.current[m.login]; if (before !== undefined && i < before) up[m.login] = true; });
    const hadHistory = Object.keys(previous.current).length > 0;
    previous.current = next;
    if (!hadHistory || !Object.keys(up).length) return;
    setRisen(up);
    const id = setTimeout(() => setRisen({}), 3500);
    return () => clearTimeout(id);
  }, [order]);
  const shown = rest.slice(page * 5, page * 5 + 5);
  return <section className={`as-select ${active ? 'is-called' : ''}`}>
    <div className="as-select-head"><h1>The Standings</h1><span>MONTHLY XP · TOP 5 LOCKED</span></div>
    <div className="as-cards">{top.length === 0 ? <div className="as-empty">THE ARENA IS QUIET</div> : top.map((m, i) => <AgentCard key={m.login} member={m} s={stats[m.login]} rank={i} focused={i !== 0 && i === focus} rose={!!risen[m.login]} onFire={hot.has(m.login)}/>)}</div>
    {rest.length > 0 && <div className="as-bench">
      <div className="as-bench-label"><span>THE BENCH</span><small>{pages > 1 ? `${page + 1} / ${pages}` : `${rest.length}`}</small></div>
      <div className="as-bench-cards"><AnimatePresence mode="wait" initial={false}><motion.div key={page} className="as-bench-page">{shown.map((m, i) => <MiniCard key={m.login} member={m} s={stats[m.login]} rank={5 + page * 5 + i} onFire={hot.has(m.login)}/>)}</motion.div></AnimatePresence></div>
    </div>}
  </section>;
}

function LockInBar({ goal, progress, complete, goals, index }: { goal: { label: string; target: number }; progress: number; complete: boolean; goals: number; index: number }) {
  const pct = complete ? 100 : Math.min(100, Math.round(progress / Math.max(1, goal.target) * 100));
  return <div className={`as-lockin ${complete ? 'is-complete' : ''}`}>
    <div className="as-lockin-button"><motion.span className="as-lockin-fill" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: 'easeOut' }}/><strong>{complete ? 'LOCKED IN' : 'LOCK IN'}</strong><em>{complete ? 'EVERY TEAM GOAL CLEARED' : `${goal.label} · ${number(progress)} / ${number(goal.target)}`}</em><b>{pct}%</b></div>
    <div className="as-checks" aria-label={`${Math.min(index, goals)} of ${goals} team goals complete`}>{Array.from({ length: goals }, (_, i) => <span key={i} className={i < index ? 'done' : i === index ? 'current' : ''}>{i < index && <ArenaIcon name="check" size={13}/>}</span>)}<small>TEAM GOALS</small></div>
  </div>;
}

function TeamMeta({ members, stats, active }: { members: Member[]; stats: Record<string, DevStats>; active: boolean }) {
  const tile = (field: 'monthlyCommits' | 'monthlyPRsMerged' | 'monthlyPRsReviewed' | 'streak', role: string, icon: IconName, unit: string) => {
    const best = [...members].sort((a, b) => (stats[b.login]?.[field] || 0) - (stats[a.login]?.[field] || 0))[0];
    const value = best ? stats[best.login]?.[field] || 0 : 0;
    const total = Object.values(stats).reduce((n, s) => n + (s[field] || 0), 0);
    const share = field === 'streak' ? `${value}D` : total ? `${(value / total * 100).toFixed(1)}%` : '0%';
    return <div className="as-meta-tile" key={field}>{value ? <Avatar member={best}/> : <span className="as-meta-empty"><ArenaIcon name={icon} size={26}/></span>}<div><strong>{value ? best?.name : '—'}</strong><small><ArenaIcon name={icon} size={14}/>{role}</small></div><div className="as-meta-rate"><small>{unit}</small><b>{share}</b></div></div>;
  };
  return <section className={`as-meta ${active ? 'is-called' : ''}`}>
    <div className="as-meta-copy"><h2>Team Meta</h2><p>Who owns each lane this month. Share is the percentage of the team's total for that stat.</p></div>
    <div className="as-meta-grid">{tile('monthlyCommits', 'Committer', 'git', 'Commit share')}{tile('monthlyPRsMerged', 'Closer', 'merge', 'Merge share')}{tile('monthlyPRsReviewed', 'Reviewer', 'review', 'Review share')}{tile('streak', 'Iron streak', 'flame', 'Streak')}</div>
  </section>;
}

function PlayerCard({ ranked, stats, active }: { ranked: Member[]; stats: Record<string, DevStats>; active: boolean }) {
  const index = useTicker(ranked.length, 12000), reduced = useReducedMotion();
  const member = ranked[index], s = member && stats[member.login];
  if (!member) return <section className="as-player"><div className="as-empty">NO PLAYERS YET</div></section>;
  const level = getLevel(s?.totalXp || 0);
  const badge = s?.badges?.length ? getBadgeDef(s.badges[s.badges.length - 1]) : undefined;
  const stat = (icon: IconName, label: string, value: string) => <div><span><ArenaIcon name={icon} size={17}/>{label}</span><b>{value}</b></div>;
  return <section className={`as-player ${active ? 'is-called' : ''}`}>
    <div className="as-player-cards">
      <div className="as-card-back"><div className="as-card-back-mark"><ArenaIcon name="arena" size={34}/></div></div>
      <AnimatePresence mode="wait"><motion.div key={member.login} className="as-collectible" initial={reduced ? { opacity: 0 } : { rotateY: -90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={reduced ? { opacity: 0 } : { rotateY: 90, opacity: 0 }} transition={{ duration: 0.45, ease: 'easeInOut' }}>
        <div className="as-collectible-top"><span className="as-lvl-bar"><i style={{ width: `${Math.min(100, level.level / 8 * 100)}%` }}/></span><small>{index + 1}/{ranked.length}</small></div>
        <small className="as-collectible-lvl">LVL {level.level} · {level.title.toUpperCase()}</small>
        <div className="as-collectible-art"><Avatar member={member}/></div>
        <small className="as-collectible-season">SEASON {new Date().getUTCFullYear()} · #{index + 1}</small>
        {tierForRank(index) && <span className="as-collectible-tier"><RankEmblem tier={tierForRank(index)!} size={34}/></span>}
        <strong>{member.name}</strong>
        <div className="as-collectible-icons"><ArenaIcon name="git" size={16}/><span className="as-barcode"/><ArenaIcon name={badge?.rarity === 'legendary' ? 'star' : 'shield'} size={16}/></div>
      </motion.div></AnimatePresence>
    </div>
    <div className="as-summary">
      <span className="as-kicker"><ArenaIcon name="target" size={16}/> PLAYER CHECKPOINT <RankTierChip rank={index} size={18}/></span>
      <h2>Summary</h2>
      <AnimatePresence mode="wait"><motion.div key={member.login} className="as-summary-grid" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
        {stat('bolt', 'XP this month', number(s?.monthlyXp || 0))}{stat('git', 'Commits', number(s?.monthlyCommits || 0))}{stat('merge', 'PRs merged', number(s?.monthlyPRsMerged || 0))}{stat('review', 'Reviews', number(s?.monthlyPRsReviewed || 0))}{stat('flame', 'Streak', `${s?.streak || 0} days`)}{stat('medal', 'Latest badge', badge?.name || 'None yet')}
      </motion.div></AnimatePresence>
    </div>
  </section>;
}

function ArenaMoment({ overlay, onDone }: { overlay: { type: string; payload: Record<string, unknown> }; onDone: () => void }) {
  useEffect(() => { const id = setTimeout(onDone, overlay.type === 'boss-victory' ? 5500 : 3800); return () => clearTimeout(id); }, [overlay, onDone]);
  const type = overlay.type, login = String(overlay.payload.login || 'THE TEAM');
  const tier = type === 'tier-up' ? overlay.payload.tier as 'radiant' | 'immortal' | 'ascendant' | undefined : undefined;
  const title = tier ? tier.toUpperCase() : type === 'first-blood' ? 'FIRST BLOOD' : type === 'ace' ? 'ACE' : type === 'level-up' ? 'LEVEL UP' : type === 'boss-victory' ? 'LOCKED IN' : type === 'overtaken' ? 'RANK UP' : 'UNLOCKED';
  const detail = tier ? 'PROMOTED · TOP 3 THIS MONTH' : type === 'first-blood' ? 'FIRST SCORED PLAY OF THE DAY' : type === 'ace' ? 'FIVE SCORED PLAYS IN 15 MINUTES' : type === 'level-up' ? `LEVEL ${overlay.payload.level} · ${String(overlay.payload.title || '').toUpperCase()}` : type === 'boss-victory' ? 'EVERY MONTHLY GOAL CLEARED' : type === 'overtaken' ? `NOW RANKED #${overlay.payload.newRank}` : String(getBadgeDef(String(overlay.payload.badgeId))?.name || 'NEW AWARD').toUpperCase();
  return <motion.div className={`as-moment as-moment--${tier || type}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <motion.div className="as-moment-band" initial={{ x: '-110%', skewX: -12 }} animate={{ x: 0, skewX: -12 }} exit={{ x: '110%', skewX: -12 }} transition={{ type: 'spring', stiffness: 120, damping: 20 }}>
      <div className="as-moment-inner">{tier && <div className="as-moment-emblem"><RankEmblem tier={tier} size={110}/></div>}<span>{type === 'boss-victory' ? 'TEAM VICTORY' : login}</span><h2>{title}</h2><small>{detail}</small></div>
    </motion.div>
  </motion.div>;
}

export function ArenaSelectView({ now, hot, soundOn, onSound, uiMode, onUiMode }: { now: number; hot: Set<string>; soundOn: boolean; onSound: () => void; uiMode: UiMode; onUiMode: (mode: UiMode) => void }) {
  const members = useStore(s => s.members), stats = useStore(s => s.stats), feed = useStore(s => s.feed), bossProgress = useStore(s => s.bossProgress), bossIndex = useStore(s => s.bossIndex), bossGoals = useStore(s => s.bossGoals), isDemo = useStore(s => s.isDemo), periodStart = useStore(s => s.monthStartDate), overlay = useStore(s => s.overlayQueue[0]), popOverlay = useStore(s => s.popOverlay);
  const ranked = useMemo(() => rankBy(members, stats), [members, stats]);
  const section = useTicker(sections.length, 6000);
  const complete = bossGoals.length > 0 && bossIndex >= bossGoals.length;
  const goal = complete ? { label: 'ALL GOALS COMPLETE', metric: 'complete', target: 1 } : bossGoals[bossIndex] || { label: 'NO OBJECTIVE SET', metric: 'none', target: 1 };
  const teamXp = Object.values(stats).reduce((n, s) => n + s.monthlyXp, 0);
  return <div className="theme-arena">
    <div className="as-slab" aria-hidden="true"/>
    <TopBar now={now} periodStart={periodStart} isDemo={isDemo} memberCount={members.length} section={section} soundOn={soundOn} onSound={onSound} uiMode={uiMode} onUiMode={onUiMode}/>
    <aside className="as-rail"><SeasonCard periodStart={periodStart} now={now} teamXp={teamXp} active={section === 1}/><PartyFeed feed={feed} members={members} now={now} active={section === 1}/></aside>
    <main className="as-main"><AgentCards ranked={ranked} stats={stats} active={section === 0} hot={hot}/><LockInBar goal={goal} progress={complete ? 1 : bossProgress[goal.metric] || 0} complete={complete} goals={bossGoals.length} index={bossIndex}/></main>
    <PlayerCard ranked={ranked} stats={stats} active={section === 3}/>
    <TeamMeta members={members} stats={stats} active={section === 2}/>
    <AnimatePresence>{overlay && <ArenaMoment key={`${overlay.type}-${JSON.stringify(overlay.payload)}`} overlay={overlay} onDone={popOverlay}/>}</AnimatePresence>
  </div>;
}
