// Web Audio API synthesized sound effects — no external files needed.

let ctx: AudioContext | null = null;
const MASTER_VOLUME = 0.4;
let enabled = false;

export function setSoundEnabled(value: boolean) { enabled = value; }
export function unlockAudio() { try { getCtx().resume().catch(() => {}); } catch { /* audio unsupported */ } }

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.15, detune = 0) {
  if (!enabled) return;
  let c: AudioContext;
  try { c = getCtx(); } catch { return; }
  if (c.state === 'suspended') c.resume().catch(() => {});
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  gain.gain.setValueAtTime(vol * MASTER_VOLUME, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + duration);
}

export function playEventSound(type: string) {
  if (!enabled) return;
  switch (type) {
    case 'commit': sfxCommit(); break;
    case 'pr-merged': sfxPRMerged(); break;
    case 'review': sfxReview(); break;
    case 'issue': sfxIssueClosed(); break;
    case 'level-up': sfxLevelUp(); break;
    case 'overtaken': sfxOvertaken(); break;
    case 'achievement': sfxAchievement('rare'); break;
    case 'boss-victory': sfxBossVictory(); break;
    case 'tier-up': sfxUltReady(); break;
    case 'first-blood': sfxFirstBlood(); break;
    case 'ace': sfxAce(); break;
    case 'interstitial': sfxRoundStart(); break;
    case 'spike': sfxSpike(); break;
    default: sfxXp();
  }
}

/** Short rising "ding-ding" for XP/feed events */
export function sfxXp() {
  playTone(880, 0.12, 'sine', 0.08);
  setTimeout(() => playTone(1320, 0.1, 'sine', 0.06), 80);
}

/** Commit push — soft mechanical click */
export function sfxCommit() {
  playTone(600, 0.08, 'square', 0.04);
  setTimeout(() => playTone(900, 0.06, 'sine', 0.05), 50);
}

/** PR opened — ascending sweep */
export function sfxPROpened() {
  playTone(440, 0.15, 'triangle', 0.08);
  setTimeout(() => playTone(660, 0.12, 'triangle', 0.08), 100);
  setTimeout(() => playTone(880, 0.15, 'sine', 0.06), 200);
}

/** PR merged — satisfying chord resolve */
export function sfxPRMerged() {
  playTone(523, 0.2, 'triangle', 0.10);
  playTone(659, 0.2, 'triangle', 0.08);
  setTimeout(() => {
    playTone(784, 0.25, 'sine', 0.10);
    playTone(1047, 0.25, 'sine', 0.06);
  }, 150);
}

/** Issue closed — quick victory ping */
export function sfxIssueClosed() {
  playTone(784, 0.10, 'sine', 0.08);
  setTimeout(() => playTone(1047, 0.15, 'sine', 0.07), 80);
}

/** Review submitted — double tap */
export function sfxReview() {
  playTone(700, 0.08, 'triangle', 0.06);
  setTimeout(() => playTone(1000, 0.08, 'triangle', 0.06), 100);
}

/** Streak bonus — fire crackle */
export function sfxStreak() {
  playTone(200, 0.05, 'sawtooth', 0.04);
  setTimeout(() => playTone(400, 0.08, 'sawtooth', 0.06), 40);
  setTimeout(() => playTone(800, 0.12, 'triangle', 0.08), 80);
  setTimeout(() => playTone(1200, 0.15, 'sine', 0.06), 140);
}

/** Ascending triad for level-up */
export function sfxLevelUp() {
  playTone(523, 0.18, 'triangle', 0.12);
  setTimeout(() => playTone(659, 0.18, 'triangle', 0.12), 120);
  setTimeout(() => playTone(784, 0.25, 'triangle', 0.14), 240);
  setTimeout(() => playTone(1047, 0.35, 'triangle', 0.10), 380);
}

/** Rank overtaken — quick whoosh + high ping */
export function sfxOvertaken() {
  playTone(440, 0.08, 'sawtooth', 0.06);
  setTimeout(() => playTone(880, 0.15, 'sine', 0.10), 60);
}

/** Achievement unlock — rarity-scaled cinematic */
export function sfxAchievement(rarity: 'common' | 'rare' | 'legendary') {
  if (rarity === 'common') {
    playTone(660, 0.2, 'triangle', 0.10);
    setTimeout(() => playTone(880, 0.25, 'triangle', 0.12), 150);
    setTimeout(() => playTone(1100, 0.3, 'sine', 0.10), 300);
  } else if (rarity === 'rare') {
    playTone(523, 0.2, 'triangle', 0.12);
    setTimeout(() => playTone(659, 0.2, 'triangle', 0.12), 120);
    setTimeout(() => playTone(784, 0.2, 'triangle', 0.12), 240);
    setTimeout(() => playTone(1047, 0.35, 'sine', 0.14), 380);
    setTimeout(() => playTone(1319, 0.4, 'sine', 0.10), 520);
  } else {
    // Legendary: dramatic chord + shimmer
    playTone(262, 0.4, 'triangle', 0.14);
    playTone(330, 0.4, 'triangle', 0.10);
    setTimeout(() => {
      playTone(392, 0.35, 'triangle', 0.12);
      playTone(523, 0.35, 'sine', 0.10);
    }, 200);
    setTimeout(() => {
      playTone(659, 0.3, 'sine', 0.14);
      playTone(784, 0.3, 'sine', 0.10);
    }, 400);
    setTimeout(() => {
      playTone(1047, 0.5, 'sine', 0.15);
      playTone(1319, 0.5, 'sine', 0.08, 10);
    }, 600);
    setTimeout(() => playTone(1568, 0.6, 'sine', 0.10, 5), 800);
  }
}

/** Boss victory — triumphant fanfare */
export function sfxBossVictory() {
  playTone(392, 0.2, 'triangle', 0.14);
  setTimeout(() => playTone(523, 0.2, 'triangle', 0.14), 150);
  setTimeout(() => playTone(659, 0.2, 'triangle', 0.14), 300);
  setTimeout(() => {
    playTone(784, 0.35, 'sine', 0.14);
    playTone(523, 0.35, 'triangle', 0.08);
  }, 450);
  setTimeout(() => {
    playTone(1047, 0.5, 'sine', 0.12);
    playTone(659, 0.5, 'triangle', 0.06);
  }, 650);
}

/** First blood — low hit then a sharp sting */
export function sfxFirstBlood() {
  playTone(110, 0.3, 'sawtooth', 0.12);
  setTimeout(() => playTone(988, 0.12, 'square', 0.07), 90);
  setTimeout(() => playTone(1319, 0.35, 'sine', 0.10), 180);
}

/** Ace — five quick rising hits, then a chord */
export function sfxAce() {
  [523, 587, 659, 784, 880].forEach((f, i) => setTimeout(() => playTone(f, 0.1, 'square', 0.06), i * 85));
  setTimeout(() => { playTone(1047, 0.6, 'sine', 0.14); playTone(1319, 0.6, 'sine', 0.08); playTone(784, 0.6, 'triangle', 0.08); }, 480);
}

/** Soft sweep for screen takeovers */
export function sfxSweep() {
  [330, 440, 587].forEach((f, i) => setTimeout(() => playTone(f, 0.22, 'sine', 0.05), i * 60));
}

/** Filtered noise burst, used for impacts and whooshes. */
function playNoise(duration: number, vol: number, from: number, to: number) {
  if (!enabled) return;
  let c: AudioContext;
  try { c = getCtx(); } catch { return; }
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * duration), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
  src.buffer = buffer; filter.type = 'bandpass'; filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, c.currentTime);
  filter.frequency.exponentialRampToValueAtTime(to, c.currentTime + duration);
  gain.gain.setValueAtTime(vol * MASTER_VOLUME, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start();
}

/**
 * Tactical-shooter style kill confirm: a crisp ping that climbs with each
 * play in a streak (1..5), stacking extra pings like a multi-kill banner.
 */
export function sfxKill(streak: number) {
  const n = Math.max(1, Math.min(5, streak));
  const base = [880, 988, 1109, 1245, 1397][n - 1];
  playNoise(0.07, 0.10, 3000, 1200);
  for (let i = 0; i < n; i++) setTimeout(() => { playTone(base + i * 60, 0.09, 'square', 0.045); playTone((base + i * 60) * 2, 0.07, 'sine', 0.03); }, 40 + i * 70);
}

/** "Ultimate ready": a rising charged shimmer that lands on a bright chord. */
export function sfxUltReady() {
  playNoise(0.7, 0.05, 400, 5000);
  [392, 523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.16, 'triangle', 0.07), i * 90));
  setTimeout(() => { playTone(1047, 0.8, 'sine', 0.12); playTone(1568, 0.8, 'sine', 0.06, 8); playTone(523, 0.8, 'triangle', 0.07); }, 470);
}

/** Round start: low two-tone horn over a whoosh. */
export function sfxRoundStart() {
  playNoise(0.5, 0.06, 300, 2400);
  playTone(196, 0.35, 'sawtooth', 0.05);
  setTimeout(() => playTone(294, 0.5, 'sawtooth', 0.05), 260);
}

/** Planted-device beeps that speed up, then a sharp chirp. */
export function sfxSpike() {
  let t = 0, gap = 420;
  for (let i = 0; i < 7; i++) { setTimeout(() => playTone(1760, 0.07, 'square', 0.04), t); t += gap; gap *= 0.72; }
  setTimeout(() => playTone(2349, 0.25, 'sine', 0.06), t + 60);
}
