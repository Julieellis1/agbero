// AGBERO vertical slice — main orchestrator.
import * as THREE from 'three';
import { S, resetGame, save, fmt, fmtTime, dayName, addMsg, quotaRemaining, DAYS } from './state.js';
import { World } from './world.js';
import { ARCHETYPES, pickArchetype, RUNGS, KABIRU_CALLS, DAY_EVENTS } from './content.js';
import { sfx, unlock, startAmbience, startMusic, setMuted } from './audio.js';
import { show, hide, updateHUD, floatText, toast, renderPhone, setSubtitle, setTapHint, setCinebars } from './ui.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);

// ---------- world ----------
const world = new World($('scene'));
$('scene').style.touchAction = 'none';

// ---------- game vars ----------
let encounterOpen = false;
let paused = false;
let spawnTimer = 8;
let activeBus = null;
let dayEvent = null;
let kabiruEventDone = false;
let opening = null; // opening sequence state
let camPushTarget = 0;

// ---------- helpers ----------
function naira(n) { return fmt(n); }

function pushMsg(from, text) {
  addMsg(from, text);
  sfx.sms();
  toast('📱 New message from ' + from);
}

function gainCash(n, xPct = 50, yPct = 38) {
  S.cash += n; S.dailyCollected += n;
  floatText('+' + naira(n), '#ffc61a', xPct, yPct);
  sfx.cash();
  updateHUD(); save();
}

function hurtPlayer(n) {
  S.health = Math.max(0, S.health - n);
  floatText('-' + Math.round(n) + ' HP', '#e63946', 50, 55);
  world.shake(0.35); sfx.thump();
  updateHUD();
  if (S.health <= 0) collapse();
}

function addHeat(n) {
  S.heat = Math.min(100, S.heat + n);
  updateHUD();
  if (S.heat >= 70) toast('🔥 Heat too high! LASTMA fit raid any moment!');
}

function collapse() {
  // beaten senseless
  closeEncounter();
  if (S.cash >= 1000) {
    S.cash -= 1000; S.health = 100; S.timeMin += 60;
    addMsg('Hospital', 'We treat you. ₦1,000. No insurance for agbero.');
    toast('🏥 You black out. Hospital bill: ₦1,000.');
    sfx.bad();
  } else {
    gameOver('BEATEN & BROKE',
      'You wake in the gutter with nothing. No hospital money, no strength.<br><br>' +
      'Oga Sule shakes his head: <i>"Park no be for weak man."</i><br><br>' +
      'You are back under the bridge — where you started.');
    return;
  }
  updateHUD(); save();
}

// ---------- screens ----------
function showScreen(id) {
  for (const s of ['title-screen', 'dayend', 'friday', 'endcard', 'pausemenu']) hide(s);
  if (id) show(id);
}

function startTitle() {
  S.screen = 'title';
  showScreen('title-screen');
  hide('hud');
  setCinebars(false); setSubtitle(null); setTapHint(false);
  world.buildBridge();
  world.setDawn(0.15);
}

// ---------- OPENING ----------
const BEATS = [
  { text: 'Lagos. 4:47 AM. You sleep where the bridge meets the gutter.' },
  { text: '<b>"Weytin you dey find? You no get house?"</b>', oga: true },
  { text: 'A fist cocks back. BEG FOR YOUR LIFE — tap as fast as you can!', beg: true },
  { text: '<b>"You fit work as agbero?"</b>', yes: true },
  { text: 'The rules.', rules: true },
  { text: null, dawn: true },
];

function startOpening() {
  resetGame();
  S.screen = 'opening';
  showScreen(null); show('hud'); hide('hud');
  setCinebars(true);
  world.buildBridge();
  world.setDawn(0);
  opening = { beat: 0, begTaps: 0, begTime: 0, begActive: false, ruleIdx: 0, advancing: false };
  hide('beg-meter-wrap');
  runBeat();
  // tap anywhere advances (except special beats)
  $('scene').onclick = () => advanceOpening();
}

function runBeat() {
  const b = BEATS[opening.beat];
  if (b.oga) { world.ogaApproach(1); world.shake(0.5); sfx.thump(); }
  if (b.beg) {
    opening.begActive = true; opening.begTaps = 0; opening.begTime = 4;
    show('beg-meter-wrap'); setTapHint(false);
    $('beg-fill').style.width = '0%';
    setSubtitle(b.text);
    $('scene').onclick = () => {
      opening.begTaps++;
      $('beg-fill').style.width = Math.min(100, opening.begTaps * 8) + '%';
      sfx.tap();
    };
    return;
  }
  if (b.yes) {
    world.playerSitUp();
    setSubtitle(b.text + '<br><br><button id="btn-yes" class="big-btn small">YES</button>');
    setTapHint(false);
    $('btn-yes').onclick = e => { e.stopPropagation(); sfx.tap(); advanceOpening(); };
    $('scene').onclick = null;
    return;
  }
  if (b.rules) {
    $('scene').style.background = '#000';
    const rules = [
      '1. "You go collect money from every danfo wey stop here. Loading fee. Parking fee. Anything wey I call."',
      '2. "When your colleagues dey fight, you go fight with them. No long thing."',
      '3. "Every Friday, you go submit my money to head department. No story."',
    ];
    opening.ruleIdx = 0;
    const showRule = () => {
      setSubtitle('<span style="font-family:Anton;font-size:1.3em">' + rules[opening.ruleIdx] + '</span>');
      sfx.stamp();
    };
    showRule();
    $('scene').onclick = () => {
      opening.ruleIdx++;
      if (opening.ruleIdx >= rules.length) { $('scene').style.background = ''; advanceOpening(); }
      else showRule();
    };
    setTapHint(true);
    return;
  }
  if (b.dawn) {
    setSubtitle(null); setTapHint(false);
    opening.dawnAnim = 0;
    $('scene').onclick = null;
    return;
  }
  setSubtitle(b.text);
  setTapHint(true);
  $('scene').onclick = () => advanceOpening();
}

function advanceOpening() {
  if (!opening || opening.begActive || opening.advancing) return;
  sfx.tap();
  opening.beat++;
  if (opening.beat >= BEATS.length) { startDay(1); return; }
  runBeat();
}

// ---------- DAY ----------
function startDay(day) {
  S.day = day; S.screen = 'day';
  S.timeMin = 360; S.dailyCollected = 0; S.encountersToday = 0;
  kabiruEventDone = false;
  dayEvent = null;
  if (day > 1 && Math.random() < 0.45) {
    dayEvent = DAY_EVENTS[Math.floor(Math.random() * DAY_EVENTS.length)];
    toast(dayEvent.label + ' — ' + dayEvent.desc, 4200);
  }
  if (day === 7) toast('🌴 SUNDAY — rest day. Half the danfos. Quota reckoning tonight.', 4200);

  showScreen(null); show('hud');
  setCinebars(false); setSubtitle(null); setTapHint(false);
  hide('beg-meter-wrap'); $('scene').style.background = '';
  world.buildStop();
  world.setDawn && null;
  spawnTimer = 4;
  updateHUD(); save();

  if (day === 1) {
    setTimeout(() => pushMsg('Oga Sule', 'Today na Monday. Make ₦5,000 before night. No story.'), 1500);
    setTimeout(() => toast('🚐 Tap a danfo when it stops to engage the driver!', 3600), 3500);
  }
  $('scene').onclick = onSceneTap;
}

function phase() {
  if (S.timeMin < 720) return 'morning';
  if (S.timeMin < 1080) return 'midday';
  return 'evening';
}

function spawnInterval() {
  let base = phase() === 'midday' ? 17 : 24;
  if (dayEvent && dayEvent.danfoMult) base /= dayEvent.danfoMult;
  if (S.day === 7) base *= 2.2;
  return base;
}

function onSceneTap(e) {
  if (S.screen !== 'day' || encounterOpen || paused) return;
  const r = new THREE.Raycaster();
  const m = new THREE.Vector2(
    (e.clientX / innerWidth) * 2 - 1,
    -(e.clientY / innerHeight) * 2 + 1
  );
  r.setFromCamera(m, world.camera);
  const meshes = [];
  for (const rec of world.buses) {
    if (rec.state !== 'halted') continue;
    rec.bus.traverse(o => { if (o.isMesh) { o.userData.busRec = rec; meshes.push(o); } });
  }
  const hits = r.intersectObjects(meshes, false);
  if (hits.length) { openEncounter(hits[0].object.userData.busRec); return; }
  // forgiving fallback: tap near a halted bus on screen counts (small phone screens, fat fingers)
  for (const rec of world.buses) {
    if (rec.state !== 'halted') continue;
    const p = rec.bus.position.clone(); p.y += 1.2; p.project(world.camera);
    if (p.z > 1) continue; // behind camera
    const sx = (p.x * 0.5 + 0.5) * innerWidth, sy = (-p.y * 0.5 + 0.5) * innerHeight;
    if (Math.hypot(e.clientX - sx, e.clientY - sy) < 120) { openEncounter(rec); return; }
  }
}

// ---------- ENCOUNTER ----------
function openEncounter(rec) {
  encounterOpen = true;
  activeBus = rec;
  camPushTarget = 1;
  sfx.horn();
  const arch = pickArchetype();
  rec.arch = arch;
  rec.rung = 0;
  $('enc-emoji').textContent = arch.emoji;
  $('enc-name').textContent = arch.name;
  $('enc-trait').textContent = arch.trait;
  $('enc-dialogue').textContent = '"' + arch.lines[Math.floor(Math.random() * arch.lines.length)] + '"';
  renderRungs(rec, arch);
  show('encounter');
}

function renderRungs(rec, arch) {
  const box = $('enc-rungs');
  box.innerHTML = '';
  RUNGS.forEach((r, i) => {
    if (i < rec.rung) return;
    const b = document.createElement('button');
    b.className = 'rung' + (r.danger ? ' danger' : '');
    const eff = effectiveSuccess(r, arch);
    b.innerHTML = '<span>' + r.label + '<br><small style="color:var(--muted)">' + r.sub + '</small></span>' +
      '<span class="risk">' + eff + '% pay<br>🔥+' + r.heat + '</span>';
    b.onclick = () => resolveRung(rec, arch, r, i);
    box.appendChild(b);
  });
}

function effectiveSuccess(rung, arch) {
  let p = rung.success + arch.payBonus + Math.floor(S.fear / 8) + Math.floor((S.goodwill - 50) / 10) + Math.floor(S.respect / 25);
  return Math.max(5, Math.min(99, Math.round(p)));
}

function closeEncounter() {
  hide('encounter');
  encounterOpen = false;
  camPushTarget = 0;
  if (activeBus && activeBus.state === 'halted') world.danfoLeave(activeBus);
  activeBus = null;
  updateHUD(); save();
}

function resolveRung(rec, arch, rung, idx) {
  const p = effectiveSuccess(rung, arch);
  rec.rung = idx + 1;
  addHeat(rung.heat * (arch.heatMult || 1));
  const yMult = (dayEvent && dayEvent.yieldMult) || 1;
  const [yLo, yHi] = arch.yield;
  const win = Math.random() * 100 < p;

  if (win) {
    const amt = Math.round((yLo + Math.random() * (yHi - yLo)) * yMult / 10) * 10;
    gainCash(amt);
    S.fear = Math.min(100, S.fear + rung.fear);
    S.respect = Math.min(100, S.respect + 1);
    $('enc-dialogue').textContent = '"Take am! Just no break anything!" — he pays ' + naira(amt) + '.';
    floatText('PAID ' + naira(amt), '#ffc61a');
    setTimeout(closeEncounter, 1400);
  } else if (!rung.danger) {
    S.goodwill = Math.max(0, S.goodwill - 3);
    $('enc-dialogue').textContent = '"I no get! Make I go, abeg!" — he speeds off.';
    sfx.engine();
    setTimeout(closeEncounter, 1400);
  } else {
    // failed violent rung -> brawl
    brawl(rec, arch, rung, yMult);
  }
  updateHUD(); save();
}

function brawl(rec, arch, rung, yMult) {
  // Tap-timing brawl mini-game. 3 clean hits win; misses cost HP; 15s limit.
  hide('encounter');
  show('brawl');
  sfx.smash();
  const tough = arch.fightBack || 0.5; // 0..1 driver toughness
  const brawl = {
    rec, arch, rung, yMult,
    php: 100, dhp: 3, dhpMax: 3,
    needle: 0, dir: 1, speed: 0.9 + tough * 0.7,
    zoneStart: 0.3, zoneW: 0.24 - tough * 0.06,
    time: 15, over: false,
  };
  if (S.kabiru >= 60 && Math.random() < 0.35) {
    brawl.dhp = 2;
    $('brawl-msg').innerHTML = '👊 <b>Kabiru jumps in!</b> The driver starts wobbly.';
  } else {
    $('brawl-msg').textContent = 'Time your strike! Tap STRIKE when the needle is in the green.';
  }
  window._brawl = brawl;
  renderBrawl(brawl);
}

function renderBrawl(b) {
  $('brawl-php').style.width = Math.max(0, b.php) + '%';
  $('brawl-dhp').style.width = (100 * b.dhp / b.dhpMax) + '%';
  $('brawl-timer').textContent = Math.ceil(b.time);
  $('brawl-needle').style.left = 'calc(' + (b.needle * 100).toFixed(1) + '% - 2px)';
  $('brawl-zone').style.left = (b.zoneStart * 100).toFixed(1) + '%';
  $('brawl-zone').style.width = (b.zoneW * 100).toFixed(1) + '%';
}

function updateBrawl(dt) {
  const b = window._brawl;
  if (!b || b.over) return;
  b.needle += b.dir * b.speed * dt;
  if (b.needle >= 1) { b.needle = 1; b.dir = -1; }
  if (b.needle <= 0) { b.needle = 0; b.dir = 1; }
  b.time -= dt;
  $('brawl-timer').textContent = Math.ceil(Math.max(0, b.time));
  $('brawl-needle').style.left = 'calc(' + (b.needle * 100).toFixed(1) + '% - 2px)';
  if (b.time <= 0) {
    // timeout: whoever is healthier wins; tie goes to the driver
    endBrawl(b, b.dhp <= 0 || (b.php / 100) > (b.dhp / b.dhpMax) + 0.01);
  }
}

function brawlStrike() {
  const b = window._brawl;
  if (!b || b.over || paused) return;
  sfx.tap();
  const inZone = b.needle >= b.zoneStart && b.needle <= b.zoneStart + b.zoneW;
  if (inZone) {
    b.dhp--;
    b.speed += 0.18;
    world.shake(0.35); sfx.thump();
    floatText('GBAM! 👊', '#35c463', 50, 40);
    $('brawl-msg').innerHTML = ['GBAM! Clean hit! 🥊', 'Ouch — he felt that one!', 'The crowd dey cheer! 🎉'][3 - b.dhp] || 'GBAM!';
    if (b.dhp <= 0) { endBrawl(b, true); return; }
  } else {
    b.php -= 12;
    hurtPlayerSilent(6);
    sfx.bad();
    floatText('MISS!', '#e63946', 50, 40);
    $('brawl-msg').textContent = 'You swing at air — he counters! Watch the needle.';
    const el = $('brawl');
    el.classList.remove('miss'); void el.offsetWidth; el.classList.add('miss');
    world.shake(0.25);
    if (b.php <= 0 || S.health <= 0) { endBrawl(b, false); return; }
  }
  // reposition the zone after every attempt
  b.zoneStart = Math.random() * (1 - b.zoneW);
  renderBrawl(b);
}

function endBrawl(b, won) {
  if (b.over) return;
  b.over = true;
  window._brawl = null;
  hide('brawl');
  const { rec, arch, rung, yMult } = b;
  if (won) {
    const amt = Math.round((arch.yield[1] + 50 + Math.random() * 100) * yMult / 10) * 10;
    gainCash(amt);
    S.brawlsWon++; S.fear = Math.min(100, S.fear + rung.fear + 8);
    S.respect = Math.min(100, S.respect + 3);
    addHeat(10);
    closeEncounter();
    toast('👊 Brawl won! ' + naira(amt) + ' collected.', 2600);
    sfx.good();
  } else {
    S.brawlsLost++; S.respect = Math.max(0, S.respect - 2);
    addHeat(15);
    hurtPlayer(12 + Math.random() * 10);
    closeEncounter();
    toast('👊 He overpowers you and speeds off. The stop is watching...', 2600);
    sfx.bad();
  }
  updateHUD(); save();
}

function showChoice({ emoji, name, trait, dialogue, buttons }) {
  encounterOpen = true;
  camPushTarget = 1;
  $('enc-emoji').textContent = emoji;
  $('enc-name').textContent = name;
  $('enc-trait').textContent = trait;
  $('enc-dialogue').innerHTML = dialogue;
  const box = $('enc-rungs');
  box.innerHTML = '';
  for (const b of buttons) {
    const btn = document.createElement('button');
    btn.className = 'rung' + (b.danger ? ' danger' : '');
    btn.innerHTML = '<span>' + b.label + '</span><span class="risk">' + (b.sub || '') + '</span>';
    btn.onclick = () => { b.action(); };
    box.appendChild(btn);
  }
  show('encounter');
}

// mercy / release
$('btn-mercy').onclick = () => {
  if (!activeBus || !activeBus.arch) return;
  const arch = activeBus.arch;
  const amt = Math.round(arch.yield[0] * 0.6 / 10) * 10;
  gainCash(amt);
  S.goodwill = Math.min(100, S.goodwill + 5);
  S.fear = Math.max(0, S.fear - 5);
  $('enc-dialogue').textContent = '"God bless you, oga." He pays ' + naira(amt) + ' and leaves smiling.';
  setTimeout(closeEncounter, 1400);
};
$('btn-release').onclick = () => {
  if (!activeBus) return;
  S.goodwill = Math.min(100, S.goodwill + 2);
  $('enc-dialogue').textContent = 'You wave him through. Nothing gained — but no wahala either.';
  setTimeout(closeEncounter, 1100);
};

// ---------- KABIRU EVENT ----------
function kabiruEvent() {
  kabiruEventDone = true;
  sfx.sms();
  showChoice({
    emoji: '👊', name: 'Kabiru', trait: 'Your guy is in trouble',
    dialogue: '"' + KABIRU_CALLS[Math.floor(Math.random() * KABIRU_CALLS.length)] + '"',
    buttons: [
      {
        label: 'BACK HIM UP', sub: 'risk brawl · +loyalty', danger: true,
        action: () => {
          hide('encounter'); encounterOpen = false; camPushTarget = 0;
          S.kabiru = Math.min(100, S.kabiru + 15);
          addHeat(20);
          if (Math.random() < 0.55) {
            hurtPlayer(15 + Math.random() * 15);
            toast('You fight beside Kabiru. You take some hits, but he will never forget this. (+15 loyalty)', 3600);
            sfx.good();
          } else {
            S.respect = Math.min(100, S.respect + 4);
            toast('You scatter the rivals together! The stop respects you. (+4 respect, +15 loyalty)', 3600);
            sfx.good();
          }
          updateHUD(); save();
        }
      },
      {
        label: 'FACE YOUR WORK', sub: '-loyalty, safe',
        action: () => {
          hide('encounter'); encounterOpen = false; camPushTarget = 0;
          S.kabiru = Math.max(0, S.kabiru - 12);
          toast('Kabiru handles it alone. He remembers you stayed away. (−12 loyalty)', 3600);
          sfx.bad();
          updateHUD(); save();
        }
      },
    ]
  });
}

// ---------- DAY END ----------
function endDay() {
  S.screen = 'dayend';
  $('scene').onclick = null;
  $('de-day').textContent = S.day;
  const met = S.dailyCollected >= S.dailyTarget;
  $('de-stats').innerHTML =
    'Collected today: <b>' + naira(S.dailyCollected) + '</b> / ' + naira(S.dailyTarget) +
    (met ? ' <span class="stat-good">✓ TARGET MET</span>' : ' <span class="stat-bad">✗ SHORT</span>') + '<br>' +
    'Cash on hand: <b>' + naira(S.cash) + '</b><br>' +
    'Quota banked: <b>' + naira(S.quotaPaid) + '</b> / ' + naira(S.quotaTarget) + '<br>' +
    'Health: ' + Math.round(S.health) + ' · Heat: ' + S.heat + ' · Respect: ' + S.respect;
  $('btn-agbo').style.opacity = S.cash >= 200 && S.health < 100 ? 1 : 0.4;
  $('btn-hospital').style.opacity = S.cash >= 1000 && S.health < 100 ? 1 : 0.4;
  $('btn-bribe').style.opacity = S.cash >= 1000 && S.heat > 0 ? 1 : 0.4;
  showScreen('dayend');
  hide('hud');
  // raid check
  if (S.heat >= 70 && Math.random() < 0.25) {
    const bail = Math.min(S.cash, 2000);
    S.cash -= bail; S.heat = 40;
    setTimeout(() => {
      pushMsg('???', 'LASTMA raid last night. You pay ₦' + bail.toLocaleString() + ' bail. Lie low.');
      updateHUD();
    }, 800);
  }
  save();
}

$('btn-agbo').onclick = () => {
  if (S.cash < 200 || S.health >= 100) return;
  S.cash -= 200; S.health = Math.min(100, S.health + 40);
  sfx.good(); toast('🌿 Agbo works its magic. +40 HP.'); endDayRefresh();
};
$('btn-hospital').onclick = () => {
  if (S.cash < 1000 || S.health >= 100) return;
  S.cash -= 1000; S.health = 100;
  sfx.good(); toast('🏥 Stitched up. Full HP.'); endDayRefresh();
};
$('btn-bribe').onclick = () => {
  if (S.cash < 1000 || S.heat <= 0) return;
  S.cash -= 1000; S.heat = Math.max(0, S.heat - 30);
  sfx.cash(); toast('💵 Officer smiles. Heat −30.'); endDayRefresh();
};
function endDayRefresh() { updateHUD(); endDay(); }

$('btn-sleep').onclick = () => {
  sfx.tap();
  S.health = Math.min(100, S.health + 15);
  S.heat = Math.max(0, S.heat - 10);
  S.fear = Math.max(0, S.fear - 5);
  save();
  if (S.day === 5) { fridayScreen(); return; }
  if (S.day >= 7) { weekReckoning(); return; }
  // Thursday night reminder
  if (S.day === 4 && quotaRemaining() > 0) {
    pushMsg('Oga Sule', 'Tomorrow na Friday. My ' + naira(S.quotaTarget) + ' suppose complete. No story.');
  }
  startDay(S.day + 1);
};

// ---------- FRIDAY ----------
function fridayScreen() {
  S.screen = 'friday';
  showScreen('friday');
  hide('hud');
  const rem = quotaRemaining();
  $('fri-body').innerHTML =
    'Oga Sule counts his notebook.<br><br>' +
    'Banked this week: <b>' + naira(S.quotaPaid) + '</b><br>' +
    'Target: <b>' + naira(S.quotaTarget) + '</b><br>' +
    (rem <= 0 ? '<span class="stat-good">COMPLETE. You fit smile.</span>'
      : 'Still short: <span class="stat-bad">' + naira(rem) + '</span>');
  save();
}

$('btn-fri-go').onclick = () => {
  sfx.tap();
  const rem = quotaRemaining();
  if (rem <= 0) {
    S.respect = Math.min(100, S.respect + 10);
    S.fear = Math.max(0, S.fear - 10);
    pushMsg('Oga Sule', 'You try. Weekend na for you. Monday, we go again.');
    toast('✅ Quota submitted. Oga Sule nods. Respect +10.', 3600);
    sfx.good();
    startDay(6);
  } else {
    // beating
    S.fridayMissed = true;
    world.shake(0.6); sfx.smash();
    const seized = Math.floor(S.cash / 2);
    S.cash -= seized;
    hurtPlayerSilent(40);
    S.quotaTarget = Math.round(S.quotaTarget * 1.2 / 500) * 500;
    pushMsg('Oga Sule', 'You get till Sunday night. After that, no be my fault again.');
    if (S.health <= 0) { collapse(); return; }
    toast('👊 The boys beat you. Half your cash seized. Quota now ' + naira(S.quotaTarget) + ' — final deadline SUNDAY.', 5000);
    sfx.bad();
    updateHUD(); save();
    startDay(6);
  }
};

function hurtPlayerSilent(n) {
  S.health = Math.max(0, S.health - n);
  floatText('-' + Math.round(n) + ' HP', '#e63946', 50, 55);
}

// ---------- WEEK RECKONING ----------
function weekReckoning() {
  const rem = quotaRemaining();
  if (rem <= 0) {
    gameOver('WEEK SURVIVED',
      'Seven days. ' + naira(S.quotaPaid) + ' delivered to the head department.<br><br>' +
      'Brawls won: <b>' + S.brawlsWon + '</b> · Respect: <b>' + S.respect + '</b><br>' +
      'Oga Sule claps your shoulder: <i>"Monday, bigger corner for you."</i><br><br>' +
      '<span class="stat-good">WEEK 2 COMING SOON — the slice ends here.</span>', false);
  } else {
    gameOver('CAST OUT',
      'Sunday night. The money no complete.<br><br>' +
      'Oga Sule doesn\'t even raise his voice: <i>"Park no be for jokers. Waka."</i><br><br>' +
      'You are back under the bridge — where you started.');
  }
}

function gameOver(title, body, isLoss = true) {
  S.screen = 'end'; S.over = true;
  $('scene').onclick = null;
  $('toast').classList.add('hidden');
  showScreen('endcard');
  hide('hud'); hide('encounter');
  setCinebars(false); setSubtitle(null); setTapHint(false);
  $('end-title').textContent = title;
  $('end-title').style.color = isLoss ? '#e63946' : '#35c463';
  $('end-body').innerHTML = body;
  $('btn-again').textContent = isLoss ? 'TRY AGAIN' : 'PLAY AGAIN';
  if (isLoss) sfx.bad(); else sfx.good();
  save();
}

$('btn-again').onclick = () => { sfx.tap(); resetGame(); startTitle(); };

// ---------- PHONE / PAUSE ----------
$('btn-phone').onclick = e => { e.stopPropagation(); renderPhone(); show('phone'); sfx.tap(); };
$('btn-strike').onclick = () => brawlStrike();
$('btn-phone-close').onclick = () => { hide('phone'); sfx.tap(); };
$('btn-pause').onclick = e => { e.stopPropagation(); paused = true; showScreen('pausemenu'); sfx.tap(); };
$('btn-resume').onclick = () => { paused = false; showScreen(null); show('hud'); sfx.tap(); };
$('btn-mute').onclick = () => {
  S.muted = !S.muted;
  $('btn-mute').textContent = S.muted ? '🔇 SOUND: OFF' : '🔊 SOUND: ON';
  setMuted(S.muted); save(); sfx.tap();
};

// ---------- TITLE ----------
$('btn-start').onclick = () => {
  unlock(); startAmbience(); startMusic(); sfx.tap();
  startOpening();
};
$('btn-how').onclick = () => { $('how-panel').classList.toggle('hidden'); sfx.tap(); };

// ---------- quota auto-bank ----------
// Cash collected goes to pocket; quota is banked each evening automatically? No:
// player banks quota at day end manually? Simpler & dramatic: quota auto-banks at sleep
// (Oga's boy collects the day's cut each night). Keep: on sleep, bank min(cash, dailyTarget*?)...
// Decision: at sleep, Oga's collector takes everything above ₦1,500 chop money.
const _origSleep = $('btn-sleep').onclick;
$('btn-sleep').onclick = () => {
  const keep = Math.min(S.cash, 1500);
  const banked = S.cash - keep;
  if (banked > 0) {
    S.quotaPaid += banked;
    S.cash = keep;
    toast('🧾 Oga\'s collector takes ' + naira(banked) + ' for the quota. You keep ' + naira(keep) + ' chop money.', 3600);
  }
  updateHUD();
  _origSleep();
};

// ---------- GAME LOOP ----------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000); // tolerate slow phones: 10fps still runs real-time
  last = now;
  if (paused) return;

  // opening dawn animation
  if (S.screen === 'opening' && opening && opening.dawnAnim !== undefined && opening.dawnAnim < 1) {
    opening.dawnAnim = Math.min(1, opening.dawnAnim + dt * 0.25);
    world.setDawn(opening.dawnAnim);
    if (opening.dawnAnim >= 1) {
      setTimeout(() => { opening = null; startDay(1); }, 600);
    }
  }

  // beg meter countdown
  if (opening && opening.begActive) {
    opening.begTime -= dt;
    if (opening.begTime <= 0) {
      opening.begActive = false;
      hide('beg-meter-wrap');
      if (opening.begTaps >= 12) {
        setSubtitle('"Hmm. You get liver." He lowers the fist.');
        sfx.good();
      } else {
        hurtPlayerSilent(10);
        setSubtitle('"Weak begging!" — a slap lands. <b>"But you go work."</b>');
        sfx.slap(); world.shake(0.4);
      }
      updateHUD();
      setTapHint(true);
      $('scene').onclick = () => advanceOpening();
    }
  }

  // day progression
  if (S.screen === 'day' && !encounterOpen && world.mode === 'stop') {
    S.timeMin += dt * 2; // 2 game-min per real second
    if (!kabiruEventDone && S.timeMin >= 720 && S.day < 7 && Math.random() < 0.004) kabiruEvent();
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = spawnInterval() * (0.7 + Math.random() * 0.6);
      if (world.buses.length < 3) {
        world.spawnDanfo(rec => {
          // bus halted — auto leave after 14s if ignored
          setTimeout(() => {
            if (rec.state === 'halted' && !encounterOpen) world.danfoLeave(rec);
          }, 14000);
        });
        if (Math.random() < 0.6) sfx.engine();
      }
    }
    if (S.timeMin >= 1200) { // 20:00
      for (const rec of [...world.buses]) world.danfoLeave(rec);
      endDay();
    }
    updateHUD();
    // pulsing TAP! marker over the first halted danfo
    const halted = world.buses.find(r => r.state === 'halted');
    const tapEl = $('tap-bus');
    if (halted && !encounterOpen && !paused) {
      const p = halted.bus.position.clone(); p.y += 2.9; p.project(world.camera);
      if (p.z < 1) {
        tapEl.style.left = ((p.x * 0.5 + 0.5) * innerWidth) + 'px';
        tapEl.style.top = ((-p.y * 0.5 + 0.5) * innerHeight) + 'px';
        tapEl.classList.remove('hidden');
      } else tapEl.classList.add('hidden');
    } else tapEl.classList.add('hidden');
  }

  // camera push easing
  world.camPush += (camPushTarget - world.camPush) * Math.min(1, dt * 3);
  updateBrawl(dt);
  world.update(dt);
  world.render();
}

// debug hook (used by automated visual tests)
window.__dbg = { S, world, endDay, fridayScreen, gameOver, startDay, save, resetGame,
  testBrawl() {
    const rec = activeBus || world.spawnDanfo(() => {});
    const arch = rec.arch || pickArchetype();
    rec.arch = arch;
    brawl(rec, arch, RUNGS[6], 1);
  },
  strike: () => brawlStrike(),
};

// debug shortcuts
if (params.get('s') === 'opening') {
  resetGame();
  setTimeout(() => { unlock(); startOpening(); }, 300);
} else if (params.get('s') === 'stop') {
  resetGame();
  setTimeout(() => {
    unlock(); startDay(1);
    if (params.get('bus')) {
      const rec = world.spawnDanfo(() => {});
      rec.bus.position.z = world.stopZ; rec.state = 'halted';
      if (params.get('enc')) setTimeout(() => openEncounter(rec), 800);
    }
  }, 300);
} else if (params.get('s') === 'friday') {
  resetGame();
  setTimeout(() => { unlock(); S.cash = 8000; S.quotaPaid = 22000; startDay(5); }, 300);
} else {
  startTitle();
}

requestAnimationFrame(loop);
