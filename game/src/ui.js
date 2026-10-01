// DOM UI helpers: HUD, floats, toast, phone, encounter card.
import { S, fmt, fmtTime, dayName } from './state.js';

const $ = id => document.getElementById(id);

export function show(id) { $(id).classList.remove('hidden'); }
export function hide(id) { $(id).classList.add('hidden'); }

export function updateHUD() {
  $('chip-cash').textContent = '💰 ' + fmt(S.cash);
  const pct = Math.min(100, (S.dailyCollected / S.dailyTarget) * 100);
  $('quota-label').textContent = '🎯 ' + fmt(S.dailyCollected) + ' / ' + fmt(S.dailyTarget);
  $('quota-fill').style.width = pct + '%';
  $('chip-time').textContent = (S.timeMin < 720 ? '🌅 ' : S.timeMin < 1080 ? '☀️ ' : '🌙 ') + fmtTime(S.timeMin);
  $('chip-heat').textContent = '🔥 ' + S.heat;
  $('chip-hp').textContent = '❤️ ' + Math.max(0, Math.round(S.health));
  $('chip-hunger').textContent = '🍲 ' + Math.round(S.hunger);
  $('hud-day').textContent = dayName() + ' · DAY ' + S.day + '/7';
  $('chip-heat').style.color = S.heat >= 70 ? '#e63946' : '';
  $('chip-hp').style.color = S.health < 35 ? '#e63946' : '';
  $('chip-hunger').style.color = S.hunger >= 80 ? '#e63946' : '';
  // day progress meter: 6:00 (360) → 20:00 (1200)
  const dp = Math.min(1, Math.max(0, (S.timeMin - 360) / 840));
  $('daybar-fill').style.width = (dp * 100) + '%';
  $('daybar-sun').style.left = (dp * 100) + '%';
  $('daybar-sun').textContent = S.timeMin >= 1080 ? '🌙' : '☀️';
}

// What each HUD icon means — tapped icons open a short explainer.
export const ICON_INFO = {
  cash: ['💰 Cash', 'Money in your pocket. Collected from drivers. Spend it on food, agbo, hospital, bribes — or save it. Oga Sule only counts what you bank on Friday.'],
  quota: ['🎯 Daily target', 'How much you have collected today vs your ₦5,000 daily target. Hit it every day and Friday\'s ₦30,000 quota becomes easy.'],
  time: ['🕐 Time', 'The day runs 6:00 AM → 8:00 PM. When night falls, the day ends and you settle accounts.'],
  heat: ['🔥 Heat', 'LASTMA attention. Violence and risky moves raise it. At 70+ a raid can happen any time. At 100, they come for YOU. Cool it with bribes or quiet days.'],
  hp: ['❤️ Health', 'Your body. Brawls and beatings drain it. At 0 you collapse and wake up in hospital minus ₦1,000. Eat and buy agbo to recover.'],
  hunger: ['🍲 Hunger', 'Your belly. It grows all day. Above 80 you lose health slowly. Tap Mama Put\'s stall 🍲 to buy food — a hungry agbero cannot hustle.'],
};

export function showInfo(key) {
  const info = ICON_INFO[key];
  if (!info) return;
  $('info-title').textContent = info[0];
  $('info-text').textContent = info[1];
  show('info-pop');
}

export function floatText(text, color = '#ffc61a', xPct = 50, yPct = 40) {
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  el.style.color = color;
  el.style.left = xPct + '%';
  el.style.top = yPct + '%';
  $('float-layer').appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

let toastTimer = null;
export function toast(text, ms = 2600) {
  const t = $('toast');
  t.textContent = text;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

export function renderPhone() {
  $('phone-clock').textContent = fmtTime(S.timeMin);
  const box = $('phone-msgs');
  box.innerHTML = '';
  const msgs = S.msgs.slice(-12).reverse();
  if (!msgs.length) box.innerHTML = '<div class="pmsg">No messages. Oga never send you anything.</div>';
  for (const m of msgs) {
    const d = document.createElement('div');
    d.className = 'pmsg';
    d.innerHTML = '<span class="from">' + m.from + ' · ' + m.time + '</span><br>' + m.text;
    box.appendChild(d);
  }
  box.scrollTop = 0;
}

export function setSubtitle(text) {
  const s = $('subtitle');
  if (!text) { s.classList.add('hidden'); return; }
  s.innerHTML = text;
  s.classList.remove('hidden');
}

export function setTapHint(on) { $('tap-hint').classList.toggle('hidden', !on); }
export function setCinebars(on) {
  $('bar-top').classList.toggle('hidden', !on);
  $('bar-bottom').classList.toggle('hidden', !on);
}
