// AGBERO vertical slice — main orchestrator.
import * as THREE from 'three';
import { S, resetGame, save, fmt, fmtTime, dayName, addMsg, quotaRemaining, DAYS } from './state.js';
import { World } from './world.js';
import { ARCHETYPES, pickArchetype, RUNGS, KABIRU_CALLS, DAY_EVENTS } from './content.js';
import { sfx, unlock, startAmbience, startMusic, setMuted } from './audio.js';
import { show, hide, updateHUD, floatText, toast, renderPhone, setSubtitle, setTapHint, setCinebars, showInfo } from './ui.js';

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
let hungerWarned = false, hungerDrainT = 0;
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
  show('btn-skip-opening');
  $('btn-skip-opening').onclick = e => {
    e.stopPropagation(); sfx.tap();
    hide('btn-skip-opening'); hide('beg-meter-wrap');
    opening = null; setSubtitle(null); setTapHint(false);
    $('scene').style.background = ''; $('scene').onclick = null;
    startDay(1);
  };
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
  S.hunger = 20; S.lastmaDone = false;
  hungerWarned = false; hungerDrainT = 0;
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
  S.rainy = day > 1 && Math.random() < 0.25;
  world.setRain(S.rainy);
  if (S.rainy) setTimeout(() => toast('🌧️ Rain dey fall — drivers dey rush, shine your eye!', 3600), 6000);
  spawnTimer = 4;
  updateHUD(); save();

  if (day === 1) {
    setTimeout(() => pushMsg('Oga Sule', 'Today na Monday. Make ₦5,000 before night. No story.'), 1500);
    setTimeout(() => toast('🚐 Tap an APPROACHING danfo to wave it down! 💰 loaded · 😰 easy · 🚔 risky.', 4200), 3500);
  }
  $('scene').onclick = onSceneTap;
}

function phase() {
  if (S.timeMin < 720) return 'morning';
  if (S.timeMin < 1080) return 'midday';
  return 'evening';
}

function spawnInterval() {
  let base = phase() === 'midday' ? 10 : 13; // flag-down era: buses come often, player chooses
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
  // wave down an approaching bus in the wave zone
  const passingMeshes = [];
  const passing = [];
  for (const rec of world.buses) {
    if (rec.state !== 'passing') continue;
    const z = rec.bus.position.z;
    if (z < -52 || z > -6) continue;
    passing.push(rec);
    rec.bus.traverse(o => { if (o.isMesh) { o.userData.busRec = rec; passingMeshes.push(o); } });
  }
  const phits = r.intersectObjects(passingMeshes, false);
  if (phits.length) { waveBus(phits[0].object.userData.busRec); return; }
  for (const rec of passing) {
    const p = rec.bus.position.clone(); p.y += 1.4; p.project(world.camera);
    if (p.z > 1) continue;
    const sx = (p.x * 0.5 + 0.5) * innerWidth, sy = (-p.y * 0.5 + 0.5) * innerHeight;
    if (Math.hypot(e.clientX - sx, e.clientY - sy) < 90) { waveBus(rec); return; }
  }
  // tap Mama Put -> food menu
  if (world.mamaChar) {
    const mMeshes = [];
    world.mamaChar.traverse(o => { if (o.isMesh) mMeshes.push(o); });
    const mhits = r.intersectObjects(mMeshes, false);
    const p = world.mamaChar.position.clone(); p.y += 1.4; p.project(world.camera);
    const sx = (p.x * 0.5 + 0.5) * innerWidth, sy = (-p.y * 0.5 + 0.5) * innerHeight;
    if (mhits.length || (p.z < 1 && Math.hypot(e.clientX - sx, e.clientY - sy) < 90)) { openFood(); return; }
  }
  // tap the agbero himself -> he gists
  if (world.agb) {
    const p = world.agb.grp.position.clone(); p.y += 1.1; p.project(world.camera);
    if (p.z < 1) {
      const sx = (p.x * 0.5 + 0.5) * innerWidth, sy = (-p.y * 0.5 + 0.5) * innerHeight;
      if (Math.hypot(e.clientX - sx, e.clientY - sy) < 80) {
        toast(pick(AGBERO_LINES), 2400); sfx.tap(); return;
      }
    }
  }
}

// ---------- FLAG-DOWN ----------
// wave zone: approaching buses the player can pull into the stop
const AGBERO_LINES = [
  'Na me be king for this bus stop!',
  'Wave danfo, make I see something.',
  'Oga Sule no dey joke with quota o.',
  'This Lagos sun no be here o.',
  'Conductor, bring my money come!',
  'No long talk — pay your levy!',
];
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function waveBus(rec) {
  if (S.screen !== 'day' || encounterOpen || paused || foodOpen()) return;
  if (world.buses.some(r => r.state === 'arriving' || r.state === 'halted')) {
    toast('⏳ Finish with this bus first!', 1800); return;
  }
  if (rec.state !== 'passing') return;
  world.waveDown(rec);
  removeBadge(rec);
  sfx.whistle();
  const t = rec.tell || { id: 'normal', label: '' };
  if (t.id === 'hot') {
    addHeat(15);
    toast('🚔 LASTMA dey trail this bus! +15 heat', 3200);
  } else if (t.id === 'normal') {
    toast('📢 You wave am down!', 2200);
  } else {
    toast('📢 You wave am down! ' + t.label, 2600);
  }
}

// read-the-road badges: one per approaching bus with a tell
function updateTellBadges() {
  const layer = $('tell-badges');
  const seen = new Set();
  const showBadges = !encounterOpen && !paused;
  for (const rec of world.buses) {
    const inZone = rec.state === 'passing' && rec.bus.position.z > -52 && rec.bus.position.z < -6;
    const emoji = rec.tell && rec.tell.emoji;
    if (inZone && emoji && showBadges) {
      seen.add(rec);
      if (!rec.badgeEl) {
        const d = document.createElement('div');
        d.className = 'tell-badge' + (rec.tell.id === 'hot' ? ' hot' : '');
        d.innerHTML = emoji + '<span class="tell-wave">WAVE!</span>';
        d.title = rec.tell.label;
        d.onclick = e => { e.stopPropagation(); waveBus(rec); };
        layer.appendChild(d);
        rec.badgeEl = d;
      }
      const p = rec.bus.position.clone(); p.y += 2.9; p.project(world.camera);
      if (p.z < 1) {
        // clamp to screen edges so the badge stays tappable even near the frame edge
        const sx = Math.max(34, Math.min(innerWidth - 34, (p.x * 0.5 + 0.5) * innerWidth));
        rec.badgeEl.style.left = sx + 'px';
        rec.badgeEl.style.top = ((-p.y * 0.5 + 0.5) * innerHeight) + 'px';
        rec.badgeEl.style.display = 'block';
      } else rec.badgeEl.style.display = 'none';
    }
  }
  // cleanup badges for buses that left or were waved
  for (const rec of [...world.buses]) if (!seen.has(rec) && rec.badgeEl) removeBadge(rec);
  // also sweep any orphan badge elements
  for (const d of [...layer.children]) {
    if (![...world.buses].some(rec => rec.badgeEl === d)) d.remove();
  }
}

function removeBadge(rec) {
  if (rec.badgeEl) { rec.badgeEl.remove(); rec.badgeEl = null; }
}

// ---------- LASTMA RAID (heat hits 100) ----------
function lastmaRaid() {
  S.lastmaDone = true;
  sfx.siren();
  toast('🚨 LASTMA RAID! Van dey come!', 3200);
  world.spawnLastma(vanRec => openLastmaEncounter(vanRec));
}

function lastmaBtn(label, sub, risk, fn, disabled) {
  const b = document.createElement('button');
  b.className = 'rung';
  b.disabled = !!disabled;
  b.innerHTML = '<span>' + label + '<br><small style="color:var(--muted)">' + sub + '</small></span>' +
    '<span class="risk">' + risk + '</span>';
  b.onclick = fn;
  return b;
}

function openLastmaEncounter(rec) {
  encounterOpen = true;
  activeBus = rec;
  camPushTarget = 1;
  $('enc-emoji').textContent = '👮';
  $('enc-name').textContent = 'LASTMA Officer';
  $('enc-trait').textContent = 'Heat 100 — dem come for you';
  $('enc-dialogue').textContent = '"We get report of tout activity for this bus stop. Oya, explain yourself!"';
  $('enc-actions').style.display = 'none';
  const box = $('enc-rungs');
  box.innerHTML = '';

  const pExplain = Math.min(90, 25 + Math.floor(S.respect / 2) + Math.floor(S.kabiru / 20));
  box.appendChild(lastmaBtn('🗣️ Explain yourself', 'Talk your way out. Respect helps.', pExplain + '% work', () => {
    sfx.tap();
    if (Math.random() * 100 < pExplain) {
      S.heat = 30;
      $('enc-dialogue').textContent = '"Hmm. Oya, dey go. But I dey watch you." — Heat drops to 30.';
      S.goodwill = Math.min(100, S.goodwill + 2);
      sfx.good();
    } else {
      const fine = Math.min(S.cash, 2000);
      S.cash -= fine; S.heat = 50; S.timeMin += 60;
      $('enc-dialogue').textContent = '"Story! Enter van." — You pay ' + naira(fine) + ' fine. Heat 50, +1hr lost.';
      sfx.bad();
    }
    box.innerHTML = ''; updateHUD();
    setTimeout(() => { world.lastmaLeave(); closeEncounter(); $('enc-actions').style.display = ''; }, 1800);
  }));

  box.appendChild(lastmaBtn('💵 Bribe ₦1,000', 'Officer smiles, problem disappears.', 'Heat → 20', () => {
      S.cash -= 1000; S.heat = 20;
      sfx.cash();
      $('enc-dialogue').textContent = '"No wahala, my oga." — The envelope changes hands. Heat drops to 20.';
      box.innerHTML = ''; updateHUD();
      setTimeout(() => { world.lastmaLeave(); closeEncounter(); $('enc-actions').style.display = ''; }, 1800);
    }, S.cash < 1000));

  box.appendChild(lastmaBtn('🏃 Run!', 'Vanish into the crowd. Risky.', '60% escape', () => {
    sfx.tap();
    if (Math.random() < 0.6) {
      S.health = Math.max(1, S.health - 15); S.heat = 70;
      $('enc-dialogue').textContent = 'You melt into the crowd! Dem no fit catch you. −15 HP. Heat 70.';
      sfx.good();
    } else {
      const fine = Math.min(S.cash, 2000);
      S.cash -= fine; S.health = Math.max(1, S.health - 25); S.heat = 60;
      $('enc-dialogue').textContent = 'Dem catch you for junction! Beating + ' + naira(fine) + ' fine. −25 HP. Heat 60.';
      sfx.bad(); world.shake(0.4);
    }
    box.innerHTML = ''; updateHUD();
    setTimeout(() => { world.lastmaLeave(); closeEncounter(); $('enc-actions').style.display = ''; }, 1800);
  }));
  show('encounter');
}

// ---------- MAMA PUT FOOD ----------
function foodOpen() { return !$('food-pop').classList.contains('hidden'); }

function openFood() {
  if (S.screen !== 'day' || encounterOpen || paused) return;
  $('food-hunger').textContent = 'Hunger: ' + Math.round(S.hunger) + '/100';
  $('btn-food-full').style.opacity = S.cash >= 300 ? 1 : 0.4;
  $('btn-food-snack').style.opacity = S.cash >= 150 ? 1 : 0.4;
  show('food-pop');
  sfx.tap();
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
    const eff = effectiveSuccess(r, arch, rec);
    b.innerHTML = '<span>' + r.label + '<br><small style="color:var(--muted)">' + r.sub + '</small></span>' +
      '<span class="risk">' + eff + '% pay<br>🔥+' + r.heat + '</span>';
    b.onclick = () => resolveRung(rec, arch, r, i);
    box.appendChild(b);
  });
}

function effectiveSuccess(rung, arch, rec) {
  let p = rung.success + arch.payBonus + Math.floor(S.fear / 8) + Math.floor((S.goodwill - 50) / 10) + Math.floor(S.respect / 25);
  if (rec && rec.tell && rec.tell.id === 'nervous') p += 10; // easy mark
  if (rec && rec.tell && rec.tell.id === 'loaded') p -= 5; // bolder driver
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
  const p = effectiveSuccess(rung, arch, rec);
  rec.rung = idx + 1;
  addHeat(rung.heat * (arch.heatMult || 1));
  const yMult = (dayEvent && dayEvent.yieldMult) || 1;
  const tellMult = rec.tell && rec.tell.id === 'loaded' ? 1.5 : 1;
  const [yLo, yHi] = arch.yield;
  const win = Math.random() * 100 < p;

  if (win) {
    const amt = Math.round((yLo + Math.random() * (yHi - yLo)) * yMult * tellMult / 10) * 10;
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
  // clear any tell badges still floating
  document.getElementById('tell-badges').innerHTML = '';
  for (const rec of world.buses) rec.badgeEl = null;
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
// ---------- mama put food ----------
$('btn-food-full').onclick = () => {
  if (S.cash < 300) { toast('You no get ₦300!', 2000); return; }
  S.cash -= 300; S.hunger = 0; S.health = Math.min(100, S.health + 10);
  sfx.good(); hide('food-pop'); toast('🍛 Mama Put special! Belle full, +10 HP.', 2600); updateHUD(); save();
};
$('btn-food-snack').onclick = () => {
  if (S.cash < 150) { toast('You no get ₦150!', 2000); return; }
  S.cash -= 150; S.hunger = Math.max(0, S.hunger - 50);
  sfx.good(); hide('food-pop'); toast('🥧 Meat pie don hold belle small.', 2400); updateHUD(); save();
};
$('btn-food-close').onclick = () => { hide('food-pop'); sfx.tap(); };
$('tap-mama').onclick = e => { e.stopPropagation(); openFood(); };
// ---------- clickable HUD icons ----------
$('chip-cash').onclick = () => { showInfo('cash'); sfx.tap(); };
document.querySelector('.chip.quota').onclick = () => { showInfo('quota'); sfx.tap(); };
$('chip-time').onclick = () => { showInfo('time'); sfx.tap(); };
$('chip-heat').onclick = () => { showInfo('heat'); sfx.tap(); };
$('chip-hp').onclick = () => { showInfo('hp'); sfx.tap(); };
$('chip-hunger').onclick = () => { showInfo('hunger'); sfx.tap(); };
$('btn-info-close').onclick = () => { hide('info-pop'); sfx.tap(); };
$('info-pop').onclick = e => { if (e.target.id === 'info-pop') hide('info-pop'); };
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
$('btn-phone').onclick = e => { e.stopPropagation(); showPhoneTab('msgs'); renderPhone(); show('phone'); sfx.tap(); };
$('btn-strike').onclick = () => brawlStrike();
$('btn-phone-close').onclick = () => { hide('phone'); sfx.tap(); };
$('tab-msgs').onclick = () => { showPhoneTab('msgs'); sfx.tap(); };
$('tab-call').onclick = () => { showPhoneTab('call'); renderCall(); sfx.tap(); };

// ---------- ACCOUNTS + CLOUD SAVE ----------
// Same-origin API when hosted on Dokploy; falls back to guest mode elsewhere
// (GitHub Pages demo, APK) where /api/health is unreachable.
const API = {
  token: localStorage.getItem('agbero_token') || null,
  email: localStorage.getItem('agbero_email') || null,
  available: false,
  user: null,
  async check() {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch('/api/health', { cache: 'no-store', signal: ctl.signal });
      clearTimeout(t);
      this.available = r.ok && (await r.json()).db === true;
    } catch { this.available = false; }
  },
  headers() {
    return { 'content-type': 'application/json', ...(this.token ? { authorization: 'Bearer ' + this.token } : {}) };
  },
  async call(method, path, body) {
    const r = await fetch('/api' + path, {
      method, headers: this.headers(), body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
};

let acctMode = 'login';
let pendingSave = null; // { state, source } — newest save offered as CONTINUE

function updateAcctChip() {
  const b = $('btn-acct');
  if (b) {
    b.style.borderColor = API.user ? '#2fbf71' : '';
    b.title = API.user ? 'Signed in: ' + API.user.email : 'Account';
  }
}

function setAcctMode(m) {
  acctMode = m;
  $('tab-login').classList.toggle('active', m === 'login');
  $('tab-register').classList.toggle('active', m === 'register');
  $('acct-go').textContent = m === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT';
  $('acct-err').textContent = '';
}

function openAcct() {
  sfx.tap();
  $('acct-err').textContent = '';
  if (!API.available) {
    $('acct-offline').classList.remove('hidden');
    $('acct-form').classList.add('hidden');
  } else {
    $('acct-offline').classList.add('hidden');
    $('acct-form').classList.toggle('hidden', !!API.user);
  }
  $('acct-out').classList.toggle('hidden', !API.user);
  if (API.user) $('acct-who').textContent = API.user.email;
  show('acct');
}

function applySaveState(saved) {
  if (!saved || !Object.keys(saved).length) return false;
  const keep = { ...saved };
  delete keep.screen;
  // startDay resets the daily counters — stash and restore them after
  const daily = {
    dailyCollected: keep.dailyCollected || 0,
    encountersToday: keep.encountersToday || 0,
    timeMin: keep.timeMin || 360,
    hunger: keep.hunger != null ? keep.hunger : 20,
  };
  if (keep.dailyTarget) daily.dailyTarget = keep.dailyTarget;
  Object.assign(S, keep);
  return daily;
}

function continueFromSave() {
  if (!pendingSave) return;
  unlock(); startAmbience(); startMusic(); sfx.tap();
  const daily = applySaveState(pendingSave.state);
  pendingSave = null;
  hide('btn-continue');
  startDay(S.day || 1);
  if (daily) Object.assign(S, daily);
  updateHUD(); save();
  toast('Save loaded. Back to the hustle.', 2400);
}

function offerContinue(state, source) {
  if (!state || !(state.day > 1 || state.cash > 0 || state.week > 1)) return;
  pendingSave = { state, source };
  $('continue-label').textContent = `CONTINUE — DAY ${state.day} (${source === 'cloud' ? '☁️ cloud' : '📱 this device'})`;
  show('btn-continue');
}

async function initAccount() {
  updateAcctChip();
  await API.check();
  // newest save wins: local vs cloud
  let best = null;
  try {
    const raw = localStorage.getItem('agbero-save-v1');
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.savedAt) best = { state: d, at: d.savedAt, source: 'local' };
    }
  } catch {}
  if (API.available && API.token) {
    try {
      const data = await API.call('GET', '/state');
      API.user = { email: API.email };
      const at = new Date(data.updated_at).getTime() || 0;
      if (data.state && Object.keys(data.state).length && (!best || at > best.at))
        best = { state: data.state, at, source: 'cloud' };
    } catch {
      API.token = null; API.email = null; API.user = null;
      localStorage.removeItem('agbero_token'); localStorage.removeItem('agbero_email');
    }
  }
  updateAcctChip();
  if (best) {
    const { screen, ...rest } = best.state;
    Object.assign(S, rest); // S holds the newest progress either way
    offerContinue(best.state, best.source);
  }
}

// throttled cloud push, fired on every local save via the agbero-save event
let lastCloudPush = 0, cloudPushTimer = null;
function saveCloud() {
  if (!API.user || !API.available) return;
  const now = Date.now();
  if (now - lastCloudPush < 20000) {
    if (!cloudPushTimer)
      cloudPushTimer = setTimeout(() => { cloudPushTimer = null; saveCloud(); }, 20000 - (now - lastCloudPush));
    return;
  }
  lastCloudPush = now;
  const { screen, ...rest } = S;
  API.call('PUT', '/state', { state: rest }).catch(() => {});
}
window.addEventListener('agbero-save', saveCloud);

$('btn-acct').onclick = e => { e.stopPropagation(); openAcct(); };
$('btn-acct-title').onclick = () => openAcct();
$('acct-close').onclick = () => { hide('acct'); sfx.tap(); };
$('tab-login').onclick = () => { setAcctMode('login'); sfx.tap(); };
$('tab-register').onclick = () => { setAcctMode('register'); sfx.tap(); };
$('btn-continue').onclick = continueFromSave;
$('acct-signout').onclick = () => {
  API.token = null; API.email = null; API.user = null;
  localStorage.removeItem('agbero_token'); localStorage.removeItem('agbero_email');
  updateAcctChip(); openAcct(); toast('Signed out. Guest mode.', 2200); sfx.tap();
};
$('acct-go').onclick = async () => {
  const email = $('acct-email').value.trim();
  const password = $('acct-pass').value;
  $('acct-err').textContent = '';
  if (!email || !password) { $('acct-err').textContent = 'Enter email and password.'; return; }
  $('acct-go').disabled = true;
  try {
    const data = await API.call('POST', '/auth/' + (acctMode === 'login' ? 'login' : 'register'), { email, password });
    API.token = data.token; API.email = data.email; API.user = { email: data.email };
    localStorage.setItem('agbero_token', data.token);
    localStorage.setItem('agbero_email', data.email);
    updateAcctChip();
    hide('acct');
    toast(acctMode === 'login' ? 'Welcome back, hustler!' : 'Account created. Hustle saved! ☁️', 2600);
    if (data.state && Object.keys(data.state).length && S.screen === 'title')
      offerContinue(data.state, 'cloud');
    saveCloud();
  } catch (e) {
    $('acct-err').textContent = e.message;
  }
  $('acct-go').disabled = false;
};

// ---------- PHONE: CALL COLLEAGUES ----------
const CONTACTS = [
  { name: 'Emeka', stop: 'Oshodi', booming: true, sub: 'Oshodi Under Bridge' },
  { name: 'Tunde', stop: 'Mile 2', booming: false, sub: 'Mile 2 Bus Stop' },
  { name: 'Kabiru', stop: 'Your stop', booming: null, sub: 'Your guy — dey here with you' },
];

function showPhoneTab(which) {
  const msgs = which === 'msgs';
  $('tab-msgs').classList.toggle('active', msgs);
  $('tab-call').classList.toggle('active', !msgs);
  $('phone-msgs').classList.toggle('hidden', !msgs);
  $('phone-call').classList.toggle('hidden', msgs);
  if (!msgs) renderCall();
}

function renderCall() {
  const box = $('phone-call');
  box.innerHTML = '';
  for (const c of CONTACTS) {
    const d = document.createElement('div');
    d.className = 'call-contact';
    d.innerHTML = '📞 ' + c.name + '<br><span class="sub">' + c.sub + '</span>';
    d.onclick = () => startCall(c);
    box.appendChild(d);
  }
}

function callLine(box, text, me) {
  const d = document.createElement('div');
  d.className = 'call-line' + (me ? ' me' : '');
  d.textContent = text;
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}

function callOpts(box, opts) {
  for (const o of opts) {
    const b = document.createElement('button');
    b.className = 'call-opt';
    b.textContent = o.label;
    b.onclick = o.fn;
    box.appendChild(b);
  }
  box.scrollTop = box.scrollHeight;
}

function startCall(c) {
  const box = $('phone-call');
  box.innerHTML = '';
  sfx.sms();
  callLine(box, '📞 Calling ' + c.name + '...', true);
  setTimeout(() => {
    if (c.name === 'Kabiru') {
      callLine(box, '"Kabiru: I dey here with you na! Put phone down, bus dey come." 😅');
      callOpts(box, [{ label: '↩ End call', fn: renderCall }]);
      return;
    }
    callLine(box, '"' + c.name + ': Hello? Who be this? Ah, my guy! How your side?"');
    callOpts(box, [
      {
        label: '💬 "How your stop dey? E dey boom?"', fn: () => {
          callLine(box, '"How your stop dey? E dey boom?"', true);
          sfx.tap();
          setTimeout(() => {
            if (c.booming) {
              callLine(box, '"' + c.name + ': ' + c.stop + ' DEY BOOM today! I don collect ₦8k since morning. Drivers dey fear my name! Tip: danfos with roof racks dey carry extra load — wave dem down, dem dey pay well. 💰"');
              pushMsg(c.name, c.stop + ' dey boom today — ₦8k since morning! Remember: roof-rack danfos (💰) pay more.');
            } else {
              callLine(box, '"' + c.name + ': My guy, ' + c.stop + ' dry like harmattan. Drivers dey dodge me since. Stay where you dey — grass no greener here."');
              pushMsg(c.name, c.stop + ' dry today. No be every stop dey boom.');
            }
            callOpts(box, [{ label: '↩ End call', fn: renderCall }]);
          }, 900);
        }
      },
      {
        label: '🔀 "I wan request transfer to your stop"', fn: () => {
          callLine(box, '"I wan request transfer to your stop. Help me talk to Oga?"', true);
          sfx.tap();
          setTimeout(() => {
            callLine(box, '"' + c.name + ': Ha! You go need Oga Sule approval o. I go put mouth, but no promise. Good luck with that one!"');
            callOpts(box, [{ label: '↩ End call', fn: renderCall }]);
            setTimeout(() => {
              pushMsg('Oga Sule', 'Transfer? You never clear ONE week for Mainland! Clear 4 weeks straight, then we go talk Island. Face your work. 😤');
              sfx.sms();
              toast('📩 Oga Sule replied. Check MSGS.', 3000);
            }, 4000);
          }, 900);
        }
      },
      { label: '↩ End call', fn: renderCall },
    ]);
  }, 900);
}
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
      setTimeout(() => { hide('btn-skip-opening'); opening = null; startDay(1); }, 600);
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
    world.daySky(S.timeMin);
    if (!kabiruEventDone && S.timeMin >= 720 && S.day < 7 && Math.random() < 0.004) kabiruEvent();
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = spawnInterval() * (0.7 + Math.random() * 0.6);
      const passing = world.buses.filter(r => r.state === 'passing').length;
      if (passing < 3) {
        world.spawnDanfo(rec => {
          // bus halted after wave-down — auto leave after 14s if ignored
          setTimeout(() => {
            if (rec.state === 'halted' && !encounterOpen) world.danfoLeave(rec);
          }, 14000);
        });
        if (Math.random() < 0.6) sfx.engine();
      }
    }
    // hunger grows through the day; starving drains health
    S.hunger = Math.min(100, S.hunger + dt * 0.28);
    if (S.hunger >= 80 && !hungerWarned) {
      hungerWarned = true;
      toast('🍲 Hunger dey catch you! Tap Mama Put to chop.', 3600);
    }
    if (S.hunger >= 95) {
      hungerDrainT += dt;
      if (hungerDrainT >= 5) {
        hungerDrainT = 0;
        S.health -= 2;
        floatText('-2 HP 🍲', '#e63946', 50, 55);
        if (S.health <= 0) collapse(); else updateHUD();
      }
    }
    // LASTMA comes for you at max heat — once per day
    if (S.heat >= 100 && !S.lastmaDone && !encounterOpen && !paused) lastmaRaid();
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
    // read-the-road tell badges over approaching buses in the wave zone
    updateTellBadges();
    // Mama Put food marker above her stall (clamped to screen edge, tappable)
    const mamaEl = $('tap-mama');
    if (!encounterOpen && !paused && !foodOpen()) {
      const p = world.mamaChar.position.clone(); p.y += 2.2; p.project(world.camera);
      if (p.z < 1) {
        const sx = Math.max(34, Math.min(innerWidth - 34, (p.x * 0.5 + 0.5) * innerWidth));
        mamaEl.style.left = sx + 'px';
        mamaEl.style.top = ((-p.y * 0.5 + 0.5) * innerHeight) + 'px';
        mamaEl.classList.remove('hidden');
      } else mamaEl.classList.add('hidden');
    } else mamaEl.classList.add('hidden');
  }

  // camera push easing
  world.camPush += (camPushTarget - world.camPush) * Math.min(1, dt * 3);
  updateBrawl(dt);
  world.update(dt);
  // the agbero is always on screen: pacing, hailing, collecting
  if (S.screen === 'day' && world.agb) {
    world.updateAgbero(dt, {
      arriving: world.buses.some(r => r.state === 'arriving'),
      halted: world.buses.some(r => r.state === 'halted'),
      encounterOpen,
    });
  }
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

// accounts: silent sign-in + newest-save detection (local vs cloud)
initAccount();

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

// dev hook for automated testing (?dev=1)
if (params.get('dev') === '1') {
  window.__agbero = { S, world, lastmaRaid, openFood, waveBus, sfx, save, API };
}
