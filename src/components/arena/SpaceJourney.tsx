import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import './space.css';

export function SpaceJourney() {
  const goals = useStore(s => s.bossGoals), progress = useStore(s => s.bossProgress);
  const alerts = useStore(s => s.ciAlerts), feed = useStore(s => s.feed), month = useStore(s => s.monthStartDate);
  const journey = goals.length ? goals.reduce((sum, g) => sum + Math.min(1, Math.max(0, (progress[g.metric] || 0) / Math.max(1, g.target))), 0) / goals.length : 0;
  const pct = Math.floor(journey * 100);
  // Encounter windows begin at 25/50/75%; subsequent goal progress defeats each boss.
  const checkpoint = [25, 50, 75].find(start => pct >= start && pct < start + 10);
  const health = checkpoint === undefined ? 0 : Math.max(0, 100 - (pct - checkpoint) * 10);
  const defeated = [35, 60, 85].filter(end => pct >= end).length;
  const last = feed[0];
  const recent = last && Date.now() - Date.parse(last.time) < 60000;
  const review = recent && last.type === 'review';
  const boosting = recent && ['commit', 'branch-push', 'pr-merged'].includes(last.type);
  const previous = useRef<{month: string; defeated: number; arrived: boolean} | null>(null);
  const [moment, setMoment] = useState('');
  useEffect(() => {
    const before = previous.current;
    previous.current = {month, defeated, arrived: pct === 100};
    if (!before || before.month !== month) return;
    if (pct === 100 && !before.arrived) setMoment('DESTINATION REACHED');
    else if (defeated > before.defeated) setMoment('HOSTILE DEFEATED');
  }, [month, defeated, pct]);
  useEffect(() => { if (!moment) return; const id = setTimeout(() => setMoment(''), 6500); return () => clearTimeout(id); }, [moment]);
  return <section className={`space-journey ${boosting ? 'space-boost' : ''} ${alerts.length ? 'space-damage' : ''}`} aria-label={`Team voyage ${pct}% complete`}>
    <div className="space-scene" aria-hidden="true">
      <div className="space-stars"/><div className="space-planet"/>
      <svg className="space-ship" viewBox="0 0 300 160">
        <defs><linearGradient id="ship-hull"><stop stopColor="#e5e2ff"/><stop offset="1" stopColor="#6c5cf0"/></linearGradient></defs>
        <path className="space-engine" d="M78 60 5 80l73 20Z" fill="#9a8fff"/>
        <path d="m80 64 36-44 70 39 94 21-94 21-70 39-36-44Z" fill="url(#ship-hull)" stroke="#c8c1ff" strokeWidth="2"/>
        <path d="m124 62 50 18-50 18 14-18Z" fill="#17162e"/><path d="m191 68 49 12-49 12Z" fill="#8df5f1"/>
        <path d="M92 51h34M92 109h34" stroke="#8df5f1" strokeWidth="4"/>
        <ellipse className={review ? 'space-shield space-shield-live' : 'space-shield'} cx="166" cy="80" rx="123" ry="69" fill="none" stroke="#8df5f1" strokeWidth="2"/>
      </svg>
      {checkpoint !== undefined && <svg className="space-hostile" viewBox="0 0 100 100"><path d="m50 4 18 26 27-8-12 31 12 25-31-2-14 20-14-20-31 2 12-25L5 22l27 8Z" fill="#591b40" stroke="#ff6480" strokeWidth="3"/><path d="m28 43 16 8m28-8-16 8" stroke="#ff8ca5" strokeWidth="5"/></svg>}
      {checkpoint !== undefined && <div className="space-laser"/>}
      {alerts.length > 0 && <span className="space-warning">SYSTEM DAMAGE · {alerts.length} CI ALERTS</span>}
      {moment && <div className="space-victory">{moment}</div>}
    </div>
    <div className="space-readout"><span className="space-kicker">TEAM VOYAGE / {month.slice(0, 7)}</span><h2>{pct === 100 ? 'Orbit achieved' : checkpoint !== undefined ? 'Hostile contact' : 'Beyond the horizon'}</h2>
      <div className="space-route"><i style={{width: `${pct}%`}}/>{[25,50,75].map(n => <b key={n} style={{left: `${n}%`}}/>)}</div>
      <div className="space-status"><strong>{pct}%</strong><span>{checkpoint !== undefined ? `HOSTILE HULL ${health}%` : `${defeated}/3 HOSTILES CLEARED`}</span></div>
      {checkpoint !== undefined && <div className="space-health"><i style={{width: `${health}%`}}/></div>}
      <p>{!goals.length ? 'Awaiting team objectives.' : review ? 'Review received. Shields reinforced.' : boosting ? 'Fresh activity. Engines burning.' : 'Monthly team goals power the journey.'}</p>
    </div>
  </section>;
}
