import { useEffect, useId, useRef, useState } from 'react';
import { useCompanion } from './useCompanion';
import { useStore } from '../../store/useStore';
import { useDisplaySettings } from '../../store/useDisplaySettings';
import { voyageState } from '../arena/voyage';
import './companion.css';

export function SharedCompanion({ world, targetPercent = 50 }: { world:'city'|'spaceship'; targetPercent?:number }) {
  const moment = useCompanion(s => s.moment), lastActionAt = useCompanion(s => s.lastActionAt);
  const enabled = useDisplaySettings(s => s.preferences.companionEnabled), name = useDisplaySettings(s => s.preferences.companionName);
  const members = useStore(s => s.members), goals = useStore(s => s.bossGoals), progress = useStore(s => s.bossProgress), alerts = useStore(s => s.ciAlerts);
  const [now,setNow] = useState(Date.now());
  const [stageWidth,setStageWidth] = useState(600);
  const frame = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g,'');
  useEffect(() => { if (!enabled) return; const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t); }, [enabled]);
  useEffect(() => {
    const stage = frame.current?.parentElement;
    if (!stage) return;
    const update = () => setStageWidth(stage.clientWidth);
    const observer = new ResizeObserver(update);observer.observe(stage);update();
    return () => observer.disconnect();
  }, [enabled]);
  if (!enabled) return null;
  const idleTime = Math.max(0,now-lastActionAt);
  const activity = moment?.action || (alerts.length ? 'watch' : idleTime > 45000 ? 'nap' : Math.floor(idleTime/10000)%3 === 0 ? 'wander' : Math.floor(idleTime/10000)%3 === 1 ? 'garden' : 'watch');
  const brief = (text: string, limit: number) => text.length > limit ? `${text.slice(0,limit-1)}…` : text;
  const username = brief(members.find(m => m.login === moment?.user)?.name || moment?.user || 'the crew', 32);
  const repo = brief(moment?.repo || '', 30);
  const label = moment?.action === 'delivery' ? `Merge delivery · ${repo}` : moment?.action === 'inspection' ? `Checking CI · ${repo}` : moment?.action === 'repair' ? `Build green. Nice work!` : moment?.action === 'review' ? `Thanks for the review, ${username}!` : activity === 'nap' ? 'Recharging. Zzz…' : activity === 'garden' ? 'Keeping things growing.' : activity === 'watch' ? 'Watching over the crew.' : 'Making the rounds.';
  const upgraded = voyageState(goals,progress).percent >= 50;
  const edge = Math.min(42,Math.max(15,95 / Math.max(1,stageWidth) * 100));
  const destination = moment ? Math.max(edge,Math.min(100-edge,targetPercent)) : activity === 'wander' ? 28 : 52;
  return <div ref={frame} className={`companion companion--${world} companion--${activity}`} style={{left:`${destination}%`}} role="img" aria-label={`${name}: ${label}`} data-action={activity} data-repo={moment?.repo || ''}>
    <div className="companion-bubble"><strong>{name}</strong><span>{label}</span></div>
    <div className="companion-avatar">
      <svg viewBox="0 0 100 110" aria-hidden="true">
        <defs><linearGradient id={`${id}-shell`} x2=".6" y2="1"><stop stopColor="#eeeaff"/><stop offset="1" stopColor="#a69bce"/></linearGradient></defs>
        <ellipse className="companion-shadow" cx="50" cy="102" rx="27" ry="4" fill="#070815" opacity=".45"/>
        <g className="companion-body">
          {upgraded && <rect x="17" y="54" width="13" height="27" rx="5" fill="#6c5cf0" stroke="#c2b6ff"/>}
          <g className="companion-leg companion-leg-left"><rect x="33" y="83" width="10" height="16" rx="4" fill="#73658c"/><rect x="28" y="94" width="17" height="7" rx="3" fill="#c4bad9"/></g>
          <g className="companion-leg companion-leg-right"><rect x="57" y="83" width="10" height="16" rx="4" fill="#73658c"/><rect x="55" y="94" width="17" height="7" rx="3" fill="#c4bad9"/></g>
          <path d="M48 16V8" stroke="#bcb0db" strokeWidth="3"/><circle className="companion-beacon" cx="48" cy="7" r="4" fill="#8df5f1"/>
          <rect x="26" y="53" width="48" height="35" rx="12" fill={`url(#${id}-shell)`} stroke="#d7cded" strokeWidth="1.5"/>
          <path d="m46 64 8 6-8 6" fill="none" stroke="#6c5cf0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="62" cy="72" r="3" fill="#8df5f1"/>
          <g className="companion-arm companion-arm-left"><rect x="15" y="59" width="11" height="23" rx="5" fill="#b3a5cf"/><circle cx="20" cy="82" r="6" fill="#d8cef0"/></g>
          <g className="companion-arm companion-arm-right"><rect x="74" y="59" width="11" height="23" rx="5" fill="#b3a5cf"/><circle cx="80" cy="82" r="6" fill="#d8cef0"/></g>
          <g className="companion-head"><rect x="14" y="27" width="8" height="15" rx="4" fill="#8d7eb1"/><rect x="78" y="27" width="8" height="15" rx="4" fill="#8d7eb1"/><rect x="20" y="16" width="60" height="42" rx="15" fill={`url(#${id}-shell)`} stroke="#ded5f3" strokeWidth="1.5"/><rect x="27" y="24" width="46" height="25" rx="9" fill="#1a1933"/>
            {activity === 'nap' ? <path d="m33 36 8 2 6-2m7 0 8 2 5-2" stroke="#8df5f1" strokeWidth="2.5" fill="none" strokeLinecap="round"/> : <g className="companion-eyes"><rect x="35" y="30" width="7" height="12" rx="3.5" fill="#8df5f1"/><rect x="58" y="30" width="7" height="12" rx="3.5" fill="#8df5f1"/></g>}
          </g>
          {activity === 'delivery' && <g className="companion-parcel"><rect x="63" y="62" width="28" height="25" rx="4" fill="#8871d8" stroke="#d3c3ff" strokeWidth="1.5"/><path d="M77 62v25M63 72h28" stroke="#c1adff" strokeWidth="3"/><path d="m72 79 3 3 7-7" fill="none" stroke="#aff7e5" strokeWidth="2"/></g>}
          {activity === 'inspection' && <g><path d="m81 77 9 12" stroke="#b5a5eb" strokeWidth="4" strokeLinecap="round"/><circle cx="76" cy="70" r="9" fill="#ff648022" stroke="#ff99ad" strokeWidth="3"/></g>}
          {activity === 'repair' && <g className="companion-tool"><path d="m83 59-7 24" stroke="#b9f8e7" strokeWidth="4"/><path d="m79 63-4-8 6-5 6 2 1 8Z" fill="#8bdbcb"/></g>}
          {activity === 'garden' && <g><path d="m77 88 6-19" stroke="#7adeb0" strokeWidth="2"/><path d="M82 75c-14 0-13-9-3-6m4 3c12-7 15 2 0 5" fill="#63bf92"/><path d="m71 88 3 11h15l3-11Z" fill="#9982cf"/></g>}
        </g>
      </svg>
      {activity === 'repair' && <span className="companion-repair-sparks"/>}
      {activity === 'nap' && <span className="companion-sleep">z z</span>}
    </div>
    <small className="companion-tag">{name} / {moment ? 'ON DUTY' : activity === 'nap' ? 'OFF DUTY' : 'CREW COMPANION'}</small>
  </div>;
}
