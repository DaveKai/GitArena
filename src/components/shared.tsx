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
    <motion.span className="ui-switch-thumb" layout transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
    {(['broadcast', 'arena'] as const).map(option => <button key={option} role="radio" aria-checked={mode === option} className={mode === option ? 'active' : ''} onClick={() => onChange(option)}>{option.toUpperCase()}</button>)}
  </div>;
}
