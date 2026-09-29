import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { IconName } from './ui/ArenaIcon';
import type { DevStats, FeedItem, Member } from '../types';

export type UiMode = 'broadcast' | 'arena';

export const eventIcons: Record<FeedItem['type'], IconName> = { commit: 'git', 'branch-push': 'git', 'pr-opened': 'branch', 'pr-merged': 'merge', review: 'review', issue: 'check', 'issue-opened': 'issue', badge: 'medal', streak: 'flame', 'level-up': 'spark' };
export const number = (value: number) => value.toLocaleString();
export const compact = (value: number) => value >= 100000 ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value) : number(value);
export const initials = (name: string) => name.split(/\s+/).map(part => part[0] || '').join('').slice(0, 2).toUpperCase();
export const rankBy = (members: Member[], stats: Record<string, DevStats>) => [...members].sort((a, b) => (stats[b.login]?.monthlyXp || 0) - (stats[a.login]?.monthlyXp || 0) || a.login.localeCompare(b.login));

export function elapsed(time: string, now: number) { const minutes = Math.max(0, Math.floor((now - new Date(time).getTime()) / 60000)); if (!Number.isFinite(minutes)) return ''; if (minutes < 1) return 'JUST NOW'; if (minutes < 60) return `${minutes} MIN AGO`; const hours = Math.floor(minutes / 60); return hours < 24 ? `${hours} HR AGO` : `${Math.floor(hours / 24)} D AGO`; }

export function Avatar({ member, large = false, className = '' }: { member?: Member; large?: boolean; className?: string }) {
  const name = member?.name || member?.login || 'Developer';
  return <div className={`arena-avatar ${large ? 'arena-avatar--large' : ''} ${className}`} style={{ '--avatar-color': member?.color || '#87bce9' } as CSSProperties}>{member?.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <span>{initials(name)}</span>}</div>;
}

export function AnimatedScore({ xp, className = 'standing-score', unit = 'XP' }: { xp: number; className?: string; unit?: string }) {
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
  return <div className={className}><motion.strong key={xp} initial={{ opacity: 0.5, y: 8, scale: 1.07 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35 }}>{number(xp)}</motion.strong><span>{unit}</span><AnimatePresence>{gain > 0 && <motion.b className="score-gain" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: -15 }} exit={{ opacity: 0, y: -31 }} transition={{ duration: .55 }}>+{number(gain)}</motion.b>}</AnimatePresence></div>;
}

export function UiSwitch({ mode, onChange }: { mode: UiMode; onChange: (mode: UiMode) => void }) {
  return <div className={`ui-switch ui-switch--${mode}`} role="radiogroup" aria-label="Display style">
    <span className="ui-switch-thumb" aria-hidden="true" />
    {(['broadcast', 'arena'] as const).map(option => <button key={option} role="radio" aria-checked={mode === option} className={mode === option ? 'active' : ''} onClick={() => onChange(option)}>{option.toUpperCase()}</button>)}
  </div>;
}

export type RankTier = 'radiant' | 'immortal' | 'ascendant';
export const rankTiers: RankTier[] = ['radiant', 'immortal', 'ascendant'];
export const tierForRank = (rank: number): RankTier | undefined => rankTiers[rank];

const tierColors: Record<RankTier, [string, string, string]> = { radiant: ['#fffbe0', '#f5dc72', '#c09a2a'], immortal: ['#ff8a9e', '#e8264e', '#7c0f2c'], ascendant: ['#b4ffd2', '#2fd57f', '#0d6b3f'] };

/** Original tier emblems in the spirit of competitive shooter top ranks. */
export function RankEmblem({ tier, size = 40 }: { tier: RankTier; size?: number }) {
  const [hi, mid, low] = tierColors[tier], g = `rank-${tier}`;
  return <svg className={`rank-emblem rank-emblem--${tier}`} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <defs><linearGradient id={g} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={hi}/><stop offset=".55" stopColor={mid}/><stop offset="1" stopColor={low}/></linearGradient></defs>
    {tier === 'radiant' && <><g stroke={mid} strokeWidth="2" strokeLinecap="round" opacity=".85">{Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6, r1 = 17, r2 = i % 2 ? 21 : 23.5; return <line key={i} x1={24 + Math.cos(a) * r1} y1={24 + Math.sin(a) * r1} x2={24 + Math.cos(a) * r2} y2={24 + Math.sin(a) * r2}/>; })}</g><path d="M24 7 36 16v16L24 41 12 32V16Z" fill={`url(#${g})`} stroke={hi} strokeWidth="1.2"/><path d="M24 13 31 18.5v11L24 35l-7-5.5v-11Z" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.4"/><circle cx="24" cy="24" r="3.4" fill="#fff"/></>}
    {tier === 'immortal' && <><path d="M4 16c6 1 10 4 12 9-5-1-9-3-12-9Zm40 0c-6 1-10 4-12 9 5-1 9-3 12-9ZM6 25c5 1 8 3 10 7-4 0-8-2-10-7Zm36 0c-5 1-8 3-10 7 4 0 8-2 10-7Z" fill={`url(#${g})`}/><path d="M24 6 34 12v13c0 7-4 12-10 16-6-4-10-9-10-16V12Z" fill={`url(#${g})`} stroke={hi} strokeWidth="1.2"/><path d="m24 14 3.2 6.2 6.8 1-5 4.6 1.2 6.7-6.2-3.3-6.2 3.3 1.2-6.7-5-4.6 6.8-1Z" fill="#fff" fillOpacity=".9"/></>}
    {tier === 'ascendant' && <><path d="M3 20 17 17l-2 7L3 20Zm42 0-14-3 2 7 12-4ZM7 29l10-2-1 5-9-3Zm34 0-10-2 1 5 9-3Z" fill={`url(#${g})`}/><path d="M24 5 35 24 24 43 13 24Z" fill={`url(#${g})`} stroke={hi} strokeWidth="1.2"/><path d="m24 13 6 11-6 11-6-11Z" fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="1.4"/><path d="M24 19v10m-4-4 4-6 4 6" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></>}
  </svg>;
}

export function RankTierChip({ rank, size = 20 }: { rank: number; size?: number }) {
  const tier = tierForRank(rank);
  return tier ? <span className={`rank-tier rank-tier--${tier}`}><RankEmblem tier={tier} size={size}/>{tier.toUpperCase()}</span> : null;
}
