// Central game state for the Agbero vertical slice (one week).
export const DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'];

export function newGame() {
  return {
    screen: 'title',
    day: 1,                 // 1..7
    timeMin: 360,           // 6:00
    cash: 0,
    quotaTarget: 30000,
    quotaPaid: 0,
    dailyTarget: 5000,
    dailyCollected: 0,
    health: 100,
    heat: 0,
    hunger: 20,           // 0..100 daily hunger
    fear: 10,
    respect: 10,
    goodwill: 50,           // drivers' goodwill
    kabiru: 50,             // Kabiru loyalty
    mamaDebt: 0,
    encountersToday: 0,
    brawlsWon: 0,
    brawlsLost: 0,
    fridayMissed: false,
    lastmaDone: false,      // one LASTMA raid per day max
    muted: false,
    msgs: [],               // nokia messages {from, text, time}
    over: false,
  };
}

export const S = newGame();

export function resetGame() {
  Object.assign(S, newGame());
  save();
}

export function save() {
  S.savedAt = Date.now();
  try { localStorage.setItem('agbero-save-v1', JSON.stringify(S)); } catch (e) {}
  try { window.dispatchEvent(new Event('agbero-save')); } catch (e) {}
}

export function load() {
  try {
    const raw = localStorage.getItem('agbero-save-v1');
    if (raw) { const d = JSON.parse(raw); Object.assign(S, d); return true; }
  } catch (e) {}
  return false;
}

export function fmt(n) { return '₦' + Math.round(n).toLocaleString('en-NG'); }

export function fmtTime(min) {
  const h = Math.floor(min / 60), m = Math.floor(min % 60);
  return h + ':' + String(m).padStart(2, '0');
}

export function dayName() { return DAYS[S.day - 1]; }

export function addMsg(from, text) {
  S.msgs.push({ from, text, time: fmtTime(S.timeMin) + ' ' + dayName().slice(0,3) });
  if (S.msgs.length > 40) S.msgs.shift();
  save();
}

export function quotaRemaining() { return Math.max(0, S.quotaTarget - S.quotaPaid); }
