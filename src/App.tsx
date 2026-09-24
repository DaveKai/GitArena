import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useStore } from './store/useStore';
import { useBackendSync } from './hooks/useBackendSync';
import { useDemoMode } from './hooks/useDemoMode';
import { ArenaIcon, type IconName } from './components/ui/ArenaIcon';
import { getBadgeDef } from './lib/badges';
import { playEventSound, setSoundEnabled, unlockAudio } from './lib/sounds';
import type { DevStats, FeedItem, Member, ShamePR } from './types';

const featureNames = ['MVP', 'HEAD TO HEAD', 'STREAKS', 'AWARDS', 'BY THE NUMBERS', 'REVIEW QUEUE', 'MOMENTUM', 'TROPHY WALL'];
const featureIcons: IconName[] = ['trophy', 'bolt', 'flame', 'medal', 'chart', 'review', 'chart', 'star'];
const eventIcons: Record<FeedItem['type'], IconName> = { commit: 'git', 'pr-opened': 'branch', 'pr-merged': 'merge', review: 'review', issue: 'check', 'issue-opened': 'issue', badge: 'medal', streak: 'flame', 'level-up': 'spark' };
const number = (value: number) => value.toLocaleString();
const initials = (name: string) => name.split(/\s+/).map(part => part[0] || '').join('').slice(0, 2).toUpperCase();
function elapsed(time: string, now: number) { const minutes = Math.max(0, Math.floor((now - new Date(time).getTime()) / 60000)); if (!Number.isFinite(minutes)) return ''; if (minutes < 1) return 'JUST NOW'; if (minutes < 60) return `${minutes} MIN AGO`; const hours = Math.floor(minutes / 60); return hours < 24 ? `${hours} HR AGO` : `${Math.floor(hours / 24)} D AGO`; }

function Avatar({ member, large = false }: { member?: Member; large?: boolean }) {
  const name = member?.name || member?.login || 'Developer';
  return <div className={`arena-avatar ${large ? 'arena-avatar--large' : ''}`} style={{ '--avatar-color': member?.color || '#87bce9' } as CSSProperties}>{member?.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <span>{initials(name)}</span>}</div>;
}

function AnimatedScore({ xp }: { xp: number }) {
  const previous = useRef(xp);
  const [gain, setGain] = useState(0);
  useEffect(() => {
    if (previous.current > 0 && xp > previous.current) {
      setGain(xp - previous.current);
      const id = setTimeout(() => setGain(0), 1700);
      previous.current = xp;
      return () => clearTimeout(id);
    }
    previous.current = xp;
  }, [xp]);
  return <div className="standing-score"><motion.strong key={xp} initial={{ opacity: 0.5, y: 8, scale: 1.07 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35 }}>{number(xp)}</motion.strong><span>XP</span><AnimatePresence>{gain > 0 && <motion.b className="score-gain" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: -15 }} exit={{ opacity: 0, y: -31 }} transition={{ duration: .55 }}>+{number(gain)}</motion.b>}</AnimatePresence></div>;
}

function Header({ isDemo, memberCount, now, periodStart, soundOn, onSound, onExpand }: { isDemo: boolean; memberCount: number; now: number; periodStart: string; soundOn: boolean; onSound: () => void; onExpand: () => void }) {
  const date = new Date(now);
  const period = new Date(`${periodStart}T00:00:00Z`);
  return <header className="arena-header">
    <div className="brand-mark"><ArenaIcon name="arena" size={27} /><span>GIT<span>ARENA</span></span></div><div className="header-rule" />
    <div className="season-label"><span className="eyebrow">THE BUILD SEASON</span><strong>{period.toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).toUpperCase()}</strong></div><div className="header-spacer" />
    <div className="broadcast-status"><span className="live-indicator" />{isDemo ? 'DEMO BROADCAST' : 'LIVE BROADCAST'}</div>
    <div className="header-team"><ArenaIcon name="users" size={18} /> {memberCount} BUILDERS</div><div className="header-clock" title="Mac system time (UTC)">{date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })} UTC</div>
    <button className="icon-button" onClick={onSound} title={soundOn ? 'Mute sound' : 'Enable sound'} aria-label={soundOn ? 'Mute sound' : 'Enable sound'}><ArenaIcon name={soundOn ? 'volume' : 'mute'} size={20} /></button>
    <button className="icon-button" onClick={onExpand} title="Fullscreen" aria-label="Fullscreen"><ArenaIcon name="expand" size={19} /></button>
  </header>;
}

function Standings({ members, stats }: { members: Member[]; stats: Record<string, DevStats> }) {
  const sorted = useMemo(() => [...members].sort((a, b) => (stats[b.login]?.monthlyXp || 0) - (stats[a.login]?.monthlyXp || 0) || a.login.localeCompare(b.login)), [members, stats]);
  const rosterRef = useRef<HTMLDivElement>(null);
  const leadXp = sorted[0] ? stats[sorted[0].login]?.monthlyXp || 0 : 0;
  useEffect(() => {
    const rail = rosterRef.current;
    if (!rail) return;
    const firstRun = rail.querySelector<HTMLElement>('.roster-sequence');
    const runWidth = () => (firstRun?.getBoundingClientRect().width || 0) + 7;
    const updateOverflow = () => rail.classList.toggle('is-static', runWidth() <= rail.clientWidth);
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(rail);
    if (firstRun) observer.observe(firstRun);
    updateOverflow();
    const wrap = () => {
      const width = runWidth();
      if (width > rail.clientWidth && rail.scrollLeft >= width) rail.scrollLeft -= width;
    };
    rail.addEventListener('scroll', wrap, { passive: true });
    const id = setInterval(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || runWidth() <= rail.clientWidth) return;
      rail.scrollBy({ left: 210, behavior: 'smooth' });
    }, 3200);
    return () => { clearInterval(id); rail.removeEventListener('scroll', wrap); observer.disconnect(); };
  }, [sorted.length]);
  const rosterCards = (copy: boolean) => sorted.map((member, i) => <div className="roster-card" key={`${copy ? 'loop-' : ''}${member.login}`}><span>{String(i + 1).padStart(2, '0')}</span><Avatar member={member}/><div><strong>{member.name}</strong><small>{number(stats[member.login]?.monthlyXp || 0)} XP</small></div></div>);
  return <section className="arena-panel standings-panel"><div className="panel-heading"><div><span className="eyebrow">01 / THE COMPETITION</span><h1>THE STANDINGS<span className="title-dot">.</span></h1></div><span className="heading-aside">MONTHLY XP <span className="heading-count">{sorted.length.toString().padStart(2, '0')}</span></span></div>
    <div className="standings-list">{sorted.length === 0 && <div className="empty-state"><ArenaIcon name="users" size={36}/><strong>THE ARENA IS QUIET</strong><span>Activity will put your team on the board.</span></div>}
      {sorted.slice(0, 5).map((member, i) => { const s = stats[member.login]; const xp = s?.monthlyXp || 0; const progress = leadXp ? Math.max(3, xp / leadXp * 100) : 0; return <motion.div layout key={member.login} className={`standing-row ${i === 0 ? 'standing-row--leader' : ''}`} transition={{ layout: { duration: 0.65, type: 'spring', bounce: 0.12 } }}><span className="standing-rank">{String(i + 1).padStart(2, '0')}</span><Avatar member={member} large={i === 0}/><div className="standing-person"><div className="standing-name-line"><strong>{member.name}</strong>{i === 0 && <span className="leader-flag"><ArenaIcon name="trophy" size={13}/> THE LEADER</span>}</div><div className="standing-subline"><span>@{member.login}</span><span className="standing-bar"><span style={{ width: `${progress}%` }}/></span></div></div>{s?.streak ? <div className="standing-streak"><ArenaIcon name="flame" size={16}/>{s.streak}D</div> : null}<AnimatedScore xp={xp}/></motion.div>; })}</div>
    {sorted.length > 0 && <div className="roster-section"><div className="roster-heading"><span>FULL ROSTER / {sorted.length} BUILDERS</span><span className="roster-heading-status">ROTATING RANKINGS ↗</span></div><div className="roster-rail" ref={rosterRef} aria-label="All ranked builders"><div className="roster-track"><div className="roster-sequence">{rosterCards(false)}</div><div className="roster-sequence" aria-hidden="true">{rosterCards(true)}</div></div></div></div>}
    <div className="standings-foot"><span>EVERY CONTRIBUTION COUNTS</span><span>RANKINGS UPDATE LIVE ↗</span></div>
  </section>;
}

function Mission({ progress, goal, teamXp, complete }: { progress: number; goal: { label: string; metric: string; target: number }; teamXp: number; complete: boolean }) {
  const pct = Math.min(100, Math.round(progress / Math.max(goal.target, 1) * 100));
  return <section className="arena-panel mission-panel"><div className="mission-top"><span className="eyebrow">TEAM OBJECTIVE / THIS MONTH</span><ArenaIcon name="target" size={22}/></div><div className="mission-center"><div><span className="mission-kicker">{complete ? 'SEASON CLEARED' : 'NEXT MILESTONE'}</span><h2>{goal.label}</h2></div><div className="mission-percent">{pct}<span>%</span></div></div><div className="mission-track"><motion.span initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: 'easeOut' }}/></div><div className="mission-bottom"><span>{complete ? 'ALL GOALS COMPLETE' : `${number(progress)} / ${number(goal.target)} COMPLETED`}</span><span>{number(teamXp)} TEAM XP</span></div></section>;
}

function Activity({ feed, members, now }: { feed: FeedItem[]; members: Member[]; now: number }) {
  const listRef = useRef<HTMLDivElement>(null);
  const recent = feed.slice(0, 8);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const firstRun = list.querySelector<HTMLElement>('.activity-sequence');
    const runHeight = () => firstRun?.getBoundingClientRect().height || 0;
    const updateOverflow = () => list.classList.toggle('is-static', runHeight() <= list.clientHeight);
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(list);
    if (firstRun) observer.observe(firstRun);
    updateOverflow();
    list.scrollTop = 0;
    const wrap = () => { const height = runHeight(); if (height > list.clientHeight && list.scrollTop >= height) list.scrollTop -= height; };
    list.addEventListener('scroll', wrap, { passive: true });
    const id = setInterval(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || runHeight() <= list.clientHeight) return;
      list.scrollBy({ top: firstRun?.querySelector('.activity-row')?.getBoundingClientRect().height || 68, behavior: 'smooth' });
    }, 3600);
    return () => { clearInterval(id); list.removeEventListener('scroll', wrap); observer.disconnect(); };
  }, [recent.length, recent[0]?.id]);
  const rows = (copy: boolean) => recent.map((item, i) => <motion.div layout key={`${copy ? 'loop-' : ''}${item.id}`} className={`activity-row ${i === 0 ? 'activity-row--first' : ''}`} initial={copy ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.35 }}><div className={`event-symbol event-symbol--${item.type}`}><ArenaIcon name={eventIcons[item.type] || 'spark'} size={21}/></div><div className="activity-copy"><div className="activity-line"><strong>{members.find(m => m.login === item.user)?.name || item.user}</strong><span>{item.message}</span></div><div className="activity-detail">{item.detail || item.repo || 'Team activity'}</div></div><div className="activity-meta"><strong>{item.xp > 0 ? `+${item.xp}` : '—'} <span>XP</span></strong><span>{elapsed(item.time, now)}</span></div></motion.div>);
  return <section className="arena-panel activity-panel"><div className="activity-heading"><div><span className="eyebrow">02 / THE PULSE</span><h2>RECENT ACTIVITY<span className="title-dot">.</span></h2></div><span className="activity-live"><span className="live-indicator"/> LIVE</span></div><div className="activity-list" ref={listRef} aria-label="Recent activity">{recent.length === 0 ? <div className="empty-state"><ArenaIcon name="git" size={34}/><strong>WAITING FOR THE FIRST MOVE</strong><span>New commits, reviews, and wins appear here.</span></div> : <div className="activity-track"><div className="activity-sequence"><AnimatePresence initial={false}>{rows(false)}</AnimatePresence></div><div className="activity-sequence" aria-hidden="true">{rows(true)}</div></div>}</div></section>;
}

function Metric({ label, value, icon }: { label: string; value: number; icon: IconName }) { return <div className="feature-metric"><ArenaIcon name={icon} size={24}/><strong>{value >= 100000 ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value) : number(value)}</strong><span>{label}</span></div>; }

function Feature({ mode, members, stats, feed, shamePRs }: { mode: number; members: Member[]; stats: Record<string, DevStats>; feed: FeedItem[]; shamePRs: ShamePR[] }) {
  const sorted = [...members].sort((a, b) => (stats[b.login]?.monthlyXp || 0) - (stats[a.login]?.monthlyXp || 0));
  const leader = sorted[0], runner = sorted[1], lead = leader && stats[leader.login], second = runner && stats[runner.login];
  const badges = members.flatMap(member => (stats[member.login]?.badges || []).map(id => ({ member, badge: getBadgeDef(id) }))).filter(entry => entry.badge).slice(-4).reverse();
  const total = (field: keyof Pick<DevStats, 'monthlyCommits' | 'monthlyPRsMerged' | 'monthlyPRsReviewed' | 'monthlyIssuesClosed'>) => Object.values(stats).reduce((n, s) => n + s[field], 0);
  const intro = (icon: IconName, eyebrow: string, title: string) => <div className="feature-intro"><ArenaIcon name={icon} size={44}/><span className="eyebrow">{eyebrow}</span><h3>{title}<span className="title-dot">.</span></h3></div>;
  if (mode === 0) return leader && lead ? <div className="feature-content feature-mvp"><div className="feature-hero-avatar"><Avatar member={leader} large/></div><div className="feature-main"><span className="eyebrow">THE FRONT RUNNER</span><h3>{leader.name}<span className="title-dot">.</span></h3><p>Setting the pace this month</p></div><div className="feature-stat-stack"><Metric label="XP THIS MONTH" value={lead.monthlyXp} icon="bolt"/><Metric label="COMMITS" value={lead.monthlyCommits} icon="git"/><Metric label="MERGES" value={lead.monthlyPRsMerged} icon="merge"/></div></div> : <div className="feature-empty">THE STORY IS STILL BEING WRITTEN.</div>;
  if (mode === 1) return leader && runner && lead && second ? <div className="feature-content feature-duel"><div className="duel-side"><span className="eyebrow">01 / IN FRONT</span><Avatar member={leader}/><strong>{leader.name}</strong><b>{number(lead.monthlyXp)} XP</b></div><div className="duel-middle"><span>THE GAP</span><strong>{number(Math.max(0, lead.monthlyXp - second.monthlyXp))}</strong><span>POINTS</span></div><div className="duel-side"><span className="eyebrow">02 / CLOSING IN</span><Avatar member={runner}/><strong>{runner.name}</strong><b>{number(second.monthlyXp)} XP</b></div></div> : <div className="feature-empty">THE NEXT RIVALRY STARTS WITH TWO BUILDERS.</div>;
  if (mode === 2) return <div className="feature-content">{intro('flame', 'CONSISTENCY WINS', 'ON A ROLL')}<div className="streak-grid">{[...members].sort((a, b) => (stats[b.login]?.streak || 0) - (stats[a.login]?.streak || 0)).slice(0, 4).map(member => <div key={member.login}><Avatar member={member}/><strong>{member.name}</strong><span>{stats[member.login]?.streak || 0} <small>DAYS</small></span></div>)}</div></div>;
  if (mode === 3 || mode === 7) return <div className="feature-content">{intro(mode === 3 ? 'medal' : 'trophy', 'UNLOCKED BY THE TEAM', mode === 3 ? 'ACHIEVEMENTS' : 'TROPHY WALL')}<div className="award-grid">{badges.length ? badges.map(({ member, badge }, i) => <div key={`${member.login}-${badge?.id}-${i}`}><ArenaIcon name={badge?.rarity === 'legendary' ? 'star' : 'shield'} size={28}/><strong>{badge?.name}</strong><span>{member.name} / {badge?.rarity.toUpperCase()}</span></div>) : <div className="feature-empty">THE FIRST AWARD IS ON ITS WAY.</div>}</div></div>;
  if (mode === 4) return <div className="feature-content">{intro('chart', 'THE MONTH SO FAR', 'TEAM OUTPUT')}<div className="numbers-grid"><Metric label="COMMITS" value={total('monthlyCommits')} icon="git"/><Metric label="MERGES" value={total('monthlyPRsMerged')} icon="merge"/><Metric label="REVIEWS" value={total('monthlyPRsReviewed')} icon="review"/><Metric label="ISSUES CLOSED" value={total('monthlyIssuesClosed')} icon="check"/></div></div>;
  if (mode === 5) return <div className="feature-content">{intro('review', 'KEEP THE WORK MOVING', 'REVIEW QUEUE')}<div className="review-grid">{shamePRs.length ? shamePRs.slice(0, 3).map((pr, i) => <div key={`${pr.repo}-${i}`}><span>{pr.repo} / {pr.age}H OLD</span><strong>{pr.title}</strong><small>BY {pr.author}</small></div>) : <div className="review-clear"><ArenaIcon name="check" size={30}/><strong>ALL CLEAR</strong><span>No pending review alerts.</span></div>}</div></div>;
  return <div className="feature-content">{intro('chart', 'LATEST CONTRIBUTIONS', 'MOMENTUM')}<div className="momentum-bars">{members.slice(0, 7).map(member => { const count = feed.filter(item => item.user === member.login).length; return <div key={member.login}><span>{initials(member.name)}</span><i style={{ height: `${Math.max(16, count * 17)}%` }}/><small>{member.name}</small></div>; })}</div><span className="momentum-caption">RECENT FEED ACTIVITY</span></div>;
}

function FeatureStage({ members, stats, feed, shamePRs }: { members: Member[]; stats: Record<string, DevStats>; feed: FeedItem[]; shamePRs: ShamePR[] }) {
  const mode = useStore(s => s.spotlightMode), reduced = useReducedMotion();
  return <section className="arena-panel feature-stage"><div className="feature-nav" role="group" aria-label="Spotlight rotation"><span className="eyebrow">03 / SPOTLIGHT</span><div>{featureNames.map((name, i) => <div key={name} className={`feature-option ${mode === i ? 'selected' : ''}`} aria-current={mode === i ? 'true' : undefined}><ArenaIcon name={featureIcons[i]} size={17}/><span>{name}</span><b>{String(i + 1).padStart(2, '0')}</b></div>)}</div></div><div className="feature-display"><AnimatePresence mode="wait"><motion.div key={mode} className="feature-frame" initial={reduced ? { opacity: 0 } : { opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={reduced ? { opacity: 0 } : { opacity: 0, x: -22 }} transition={{ duration: reduced ? 0.1 : 0.42 }}><Feature mode={mode} members={members} stats={stats} feed={feed} shamePRs={shamePRs}/></motion.div></AnimatePresence><div className="feature-timer"><motion.span key={mode} initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 12, ease: 'linear' }}/></div></div></section>;
}

function Celebration({ overlay, onDone }: { overlay: { type: string; payload: Record<string, unknown> }; onDone: () => void }) {
  useEffect(() => { const id = setTimeout(onDone, overlay.type === 'boss-victory' ? 5500 : 3800); return () => clearTimeout(id); }, [overlay, onDone]);
  const type = overlay.type, login = String(overlay.payload.login || 'THE TEAM');
  const title = type === 'level-up' ? 'LEVEL UP' : type === 'boss-victory' ? 'MISSION COMPLETE' : type === 'overtaken' ? 'RANK UP' : 'ACHIEVEMENT UNLOCKED';
  const detail = type === 'level-up' ? `LEVEL ${overlay.payload.level} / ${overlay.payload.title}` : type === 'boss-victory' ? 'THE TEAM HIT EVERY MONTHLY GOAL' : type === 'overtaken' ? `NOW RANKED #${overlay.payload.newRank}` : String(getBadgeDef(String(overlay.payload.badgeId))?.name || 'NEW AWARD').toUpperCase();
  return <motion.div className="celebration-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div className="celebration-card" initial={{ scale: 0.88, y: 45 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 1.04, opacity: 0 }} transition={{ type: 'spring', stiffness: 190, damping: 20 }}><ArenaIcon name={type === 'boss-victory' ? 'target' : type === 'achievement' ? 'medal' : 'bolt'} size={60}/><span className="eyebrow">GITARENA / LIVE MOMENT</span><h2>{title}<span className="title-dot">.</span></h2><strong>{type === 'boss-victory' ? 'TEAM VICTORY' : login}</strong><p>{detail}</p><button onClick={onDone}>CONTINUE <ArenaIcon name="arrow" size={17}/></button></motion.div></motion.div>;
}

function SoundPrompt({ onChoice }: { onChoice: (enabled: boolean) => void }) { return <div className="sound-prompt-backdrop"><div className="sound-prompt"><div className="sound-prompt-mark"><ArenaIcon name="volume" size={32}/></div><span className="eyebrow">BEFORE THE BROADCAST</span><h2>GIVE THE ARENA<br/><em>A VOICE.</em></h2><p>Hear a short cue when the team lands a big win. Choose how this display sounds.</p><div className="sound-prompt-actions"><button className="primary-action" onClick={() => onChoice(true)}><ArenaIcon name="volume" size={19}/> ENABLE SOUND</button><button className="secondary-action" onClick={() => onChoice(false)}>CONTINUE MUTED</button></div></div></div>; }

export default function App() {
  useBackendSync(); useDemoMode();
  const members = useStore(s => s.members), stats = useStore(s => s.stats), feed = useStore(s => s.feed), bossProgress = useStore(s => s.bossProgress), bossIndex = useStore(s => s.bossIndex), bossGoals = useStore(s => s.bossGoals), shamePRs = useStore(s => s.shamePRs), isDemo = useStore(s => s.isDemo), periodStart = useStore(s => s.monthStartDate), overlay = useStore(s => s.overlayQueue[0]), popOverlay = useStore(s => s.popOverlay), nextSpotlight = useStore(s => s.nextSpotlight), checkMonthlyReset = useStore(s => s.checkMonthlyReset);
  const [now, setNow] = useState(Date.now());
  const [soundChoice, setSoundChoice] = useState<boolean | null>(() => { const value = localStorage.getItem('gitarena-sound'); return value === 'on' ? true : value === 'off' ? false : null; });
  const previousFeedId = useRef<string | null>(null), previousOverlay = useRef<string | null>(null);
  const complete = bossGoals.length > 0 && bossIndex >= bossGoals.length;
  const goal = complete ? { label: 'ALL GOALS COMPLETE', metric: 'complete', target: 1 } : bossGoals[bossIndex] || { label: 'NO OBJECTIVE SET', metric: 'none', target: 1 };
  const teamXp = Object.values(stats).reduce((n, s) => n + s.monthlyXp, 0);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(id); }, []);
  useEffect(() => { if (!isDemo) return; const id = setInterval(checkMonthlyReset, 60000); return () => clearInterval(id); }, [isDemo, checkMonthlyReset]);
  useEffect(() => { const id = setInterval(nextSpotlight, 12000); return () => clearInterval(id); }, [nextSpotlight]);
  useEffect(() => { setSoundEnabled(soundChoice === true); }, [soundChoice]);
  useEffect(() => { const latest = feed[0]; if (!latest) return; if (previousFeedId.current && previousFeedId.current !== latest.id) playEventSound(latest.type); previousFeedId.current = latest.id; }, [feed]);
  useEffect(() => { if (!overlay) { previousOverlay.current = null; return; } const key = `${overlay.type}-${JSON.stringify(overlay.payload)}`; if (previousOverlay.current !== key) { playEventSound(overlay.type); previousOverlay.current = key; } }, [overlay]);
  const chooseSound = (enabled: boolean) => { if (enabled) unlockAudio(); setSoundEnabled(enabled); setSoundChoice(enabled); localStorage.setItem('gitarena-sound', enabled ? 'on' : 'off'); };
  const expand = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); else document.exitFullscreen?.().catch(() => {}); };
  return <div className="arena-shell"><Header isDemo={isDemo} memberCount={members.length} now={now} periodStart={periodStart} soundOn={soundChoice === true} onSound={() => chooseSound(!soundChoice)} onExpand={expand}/><main className="arena-main"><Standings members={members} stats={stats}/><div className="arena-right"><Mission progress={complete ? 1 : bossProgress[goal.metric] || 0} goal={goal} teamXp={teamXp} complete={complete}/><Activity feed={feed} members={members} now={now}/></div></main><FeatureStage members={members} stats={stats} feed={feed} shamePRs={shamePRs}/><footer className="arena-footer"><span>GITARENA <b>/</b> BUILD TOGETHER. WIN TOGETHER.</span><span>EVERY COMMIT WRITES THE STORY <ArenaIcon name="arrow" size={15}/></span></footer><AnimatePresence>{overlay && <Celebration key={`${overlay.type}-${JSON.stringify(overlay.payload)}`} overlay={overlay} onDone={popOverlay}/>}</AnimatePresence>{soundChoice === null && <SoundPrompt onChoice={chooseSound}/>}</div>;
}
