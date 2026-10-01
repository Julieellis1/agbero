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
  $('hud-day').textContent = dayName() + ' · DAY ' + S.day + '/7';
  $('chip-heat').style.color = S.heat >= 70 ? '#e63946' : '';
  $('chip-hp').style.color = S.health < 35 ? '#e63946' : '';
  // day progress meter: 6:00 (360) → 20:00 (1200)
  const dp = Math.min(1, Math.max(0, (S.timeMin - 360) / 840));
  $('daybar-fill').style.width = (dp * 100) + '%';
  $('daybar-sun').style.left = (dp * 100) + '%';
  $('daybar-sun').textContent = S.timeMin >= 1080 ? '🌙' : '☀️';
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
