// Three.js world: bridge (opening) + bus stop (main) scenes, danfo & person factories.
import * as THREE from 'three';

const YELLOW = 0xffc61a, GREEN = 0x1a7a4a, CHAR = 0x14110f;

export class World {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
    this.clock = new THREE.Clock();
    this.t = 0;
    this.shakeAmt = 0;
    this.buses = [];
    this.people = [];
    this.mode = null;
    this.camBase = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.camPush = 0; // 0 normal, 1 pushed in (encounter)
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.mode) this.layoutCam();
  }

  // frame the action for the current aspect — portrait phones need a wider, pulled-back view
  layoutCam() {
    const portrait = innerWidth < innerHeight;
    if (this.mode === 'stop') {
      if (portrait) { this.camBase.set(-0.8, 7.4, 21); this.camLook.set(-3.4, 1.0, 0.5); }
      else { this.camBase.set(1.5, 5.2, 13.5); this.camLook.set(-1, 1.2, -1); }
    } else if (this.mode === 'bridge') {
      if (portrait) { this.camBase.set(-4.5, 3.0, 13); this.camLook.set(0.5, 1.1, 0.5); }
      else { this.camBase.set(-4.5, 2.2, 8.5); this.camLook.set(0, 1.2, 0); }
    }
  }

  clear() {
    this.scene.clear();
    this.buses = []; this.people = []; this.traffic = []; this.walkers = [];
    this.scene.fog = null; this.fire = null;
    this.lampMats = []; this.headMats = [];
    this.skyCanvas = null; this.skyCtx = null; this.skyTex = null; this.skyMesh = null;
    this.sunDisc = null; this.rain = null; this.rainOn = false;
  }

  lights(sunColor, sunInt, hemiInt) {
    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a2f24, hemiInt);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(sunColor, sunInt);
    sun.position.set(18, 26, 12);
    sun.castShadow = true;
    sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);
    this.sun = sun; this.hemi = hemi;
  }

  ground(color, size = 120) {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color, roughness: 1 })
    );
    g.rotation.x = -Math.PI / 2; g.receiveShadow = true;
    this.scene.add(g);
    return g;
  }

  // ---------- people ----------
  makePerson({ shirt = 0x8a6d4b, skin = 0x6b4a2f, scale = 1, pants = 0x2b2b3a, cap = null } = {}) {
    const grp = new THREE.Group();
    const s = scale;
    const legH = 0.58 * s, torsoH = 0.62 * s;
    const legG = new THREE.CylinderGeometry(0.085 * s, 0.1 * s, legH, 6);
    const legM = new THREE.MeshStandardMaterial({ color: pants, roughness: 1 });
    const l1 = new THREE.Mesh(legG, legM); l1.position.set(-0.11 * s, legH / 2, 0);
    const l2 = new THREE.Mesh(legG, legM); l2.position.set(0.11 * s, legH / 2, 0);
    // shoes
    const shoeG = new THREE.BoxGeometry(0.13 * s, 0.09 * s, 0.24 * s);
    const shoeM = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.9 });
    const sh1 = new THREE.Mesh(shoeG, shoeM); sh1.position.set(-0.11 * s, 0.045 * s, 0.05 * s);
    const sh2 = new THREE.Mesh(shoeG, shoeM); sh2.position.set(0.11 * s, 0.045 * s, 0.05 * s);
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.19 * s, torsoH * 0.7, 4, 8),
      new THREE.MeshStandardMaterial({ color: shirt, roughness: 1 })
    );
    torso.position.y = legH + torsoH / 2;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.155 * s, 12, 10),
      new THREE.MeshStandardMaterial({ color: skin, roughness: 0.9 })
    );
    head.position.y = legH + torsoH + 0.2 * s;
    // arms + hands
    const armG = new THREE.CylinderGeometry(0.055 * s, 0.065 * s, 0.48 * s, 6);
    const armM = new THREE.MeshStandardMaterial({ color: shirt, roughness: 1 });
    const handG = new THREE.SphereGeometry(0.06 * s, 8, 6);
    const handM = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.9 });
    const a1 = new THREE.Mesh(armG, armM); a1.position.set(-0.28 * s, legH + torsoH * 0.55, 0); a1.rotation.z = 0.22;
    const a2 = new THREE.Mesh(armG, armM); a2.position.set(0.28 * s, legH + torsoH * 0.55, 0); a2.rotation.z = -0.22;
    const h1 = new THREE.Mesh(handG, handM); h1.position.set(-0.335 * s, legH + torsoH * 0.55 - 0.27 * s, 0);
    const h2 = new THREE.Mesh(handG, handM); h2.position.set(0.335 * s, legH + torsoH * 0.55 - 0.27 * s, 0);
    for (const m of [l1, l2, sh1, sh2, torso, head, a1, a2, h1, h2]) { m.castShadow = true; grp.add(m); }
    if (cap) {
      // face cap: crown + brim
      const capM = new THREE.MeshStandardMaterial({ color: cap, roughness: 1 });
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.165 * s, 0.175 * s, 0.11 * s, 10), capM);
      crown.position.y = head.position.y + 0.12 * s;
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.2 * s, 0.035 * s, 0.24 * s), capM);
      brim.position.set(0, head.position.y + 0.085 * s, 0.22 * s);
      crown.castShadow = brim.castShadow = true;
      grp.add(crown, brim);
    }
    grp.userData = { head, a1, a2, phase: Math.random() * 6, baseY: 0 };
    this.people.push(grp);
    this.scene.add(grp);
    return grp;
  }

  // ---------- danfo ----------
  // painted side art — every Lagos danfo shouts its hustle
  sideArt(slogan) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#f5b800'; g.fillRect(0, 0, 512, 160);
    g.fillStyle = '#141414'; g.fillRect(0, 0, 512, 14); g.fillRect(0, 146, 512, 14);
    g.fillStyle = '#141414'; g.font = 'bold 44px Anton, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    // shrink to fit
    let size = 44;
    while (g.measureText(slogan).width > 470 && size > 20) { size -= 4; g.font = `bold ${size}px Anton, sans-serif`; }
    g.fillText(slogan, 256, 68);
    g.font = 'bold 26px Anton, sans-serif'; g.fillStyle = '#0a5a30';
    g.fillText('★ LAGOS ★', 256, 118);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  makeDanfo(stripeColor = 0x141414) {
    const bus = new THREE.Group();
    const bodyM = new THREE.MeshStandardMaterial({ color: YELLOW, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 4.6), bodyM);
    body.position.y = 1.15; body.castShadow = true;
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.28, 4.62),
      new THREE.MeshStandardMaterial({ color: stripeColor, roughness: 0.7 })
    );
    stripe.position.y = 1.05;
    // side art with a random hustle slogan
    const slogans = ['NO CONDITION IS PERMANENT', 'EKO ONI BAJE', 'GOD DEY', 'ONE WAY',
      'JAH BLESS', 'SHINE YOUR EYE', 'OBO NI', 'ALHAMDULILLAH', 'NO GREE FOR ANYBODY', 'HUSTLE O'];
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.6),
      new THREE.MeshStandardMaterial({ map: this.sideArt(slogans[Math.floor(Math.random() * slogans.length)]), roughness: 0.7 }));
    art.position.set(1.02, 0.62, -0.4); bus.add(art);
    const art2 = art.clone(); art2.position.x = -1.02; art2.rotation.y = Math.PI; bus.add(art2);
    const winM = new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.3, metalness: 0.4 });
    const winF = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.06), winM);
    winF.position.set(0, 1.62, 2.31);
    const winS = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 3.2), winM);
    winS.position.set(1.01, 1.62, -0.2);
    const winS2 = winS.clone(); winS2.position.x = -1.01;
    // roof rack + luggage
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 3.4), new THREE.MeshStandardMaterial({ color: 0x3a3a3a }));
    rack.position.y = 1.95;
    const lugM = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 1 });
    for (let i = 0; i < 3; i++) {
      const lug = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.7), lugM);
      lug.position.set(-0.5 + i * 0.5, 2.16, -0.8 + (i % 2) * 1.2);
      lug.castShadow = true; bus.add(lug);
    }
    // wheels
    const wheelG = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
    const wheelM = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 1 });
    const wheels = [];
    for (const [x, z] of [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]]) {
      const w = new THREE.Mesh(wheelG, wheelM);
      w.rotation.z = Math.PI / 2; w.position.set(x, 0.38, z);
      wheels.push(w); bus.add(w);
    }
    // headlights
    const hlM = new THREE.MeshStandardMaterial({ color: 0xfff6c9, emissive: 0xffdf7a, emissiveIntensity: 0.33 });
    (this.headMats = this.headMats || []).push(hlM);
    for (const x of [-0.6, 0.6]) {
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), hlM);
      hl.position.set(x, 1.0, 2.32); bus.add(hl);
    }
    bus.add(body, stripe, winF, winS, winS2, rack);
    bus.userData = { wheels, conductor: null };
    bus.traverse(m => { if (m.isMesh) m.castShadow = true; });
    this.scene.add(bus);
    return bus;
  }

  // ---------- BRIDGE (opening) ----------
  buildBridge() {
    this.clear(); this.mode = 'bridge';
    this.scene.background = new THREE.Color(0x0a0e1a);
    this.scene.fog = new THREE.Fog(0x0a0e1a, 20, 90);
    this.lights(0x8fa8ff, 0.25, 0.35);
    this.ground(0x1c1a17);
    // stars + moon: the night you sleep under the bridge
    {
      const N = 220, pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 1.3, r = 250;
        pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
        pos[i * 3 + 1] = Math.sin(e) * r;
        pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcdd8ff, size: 1.6, sizeAttenuation: false, fog: false })));
      const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false }));
      moon.position.set(-120, 140, -180); this.scene.add(moon);
    }
    // distant city glow on the horizon
    {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 64);
      gr.addColorStop(0, 'rgba(255,150,60,0)'); gr.addColorStop(1, 'rgba(255,150,60,0.35)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 64);
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,200,120,0.5)'; g.fillRect(Math.random() * 256, 30 + Math.random() * 30, 2, 3); }
      const t = new THREE.CanvasTexture(c);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(180, 26),
        new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: false, depthWrite: false }));
      glow.position.set(0, 10, -120); this.scene.add(glow);
    }
    // bridge deck overhead
    const deckM = new THREE.MeshStandardMaterial({ color: 0x3d3a35, roughness: 1 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(60, 1.2, 14), deckM);
    deck.position.set(0, 7, -6); this.scene.add(deck);
    for (let i = -2; i <= 2; i++) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 7, 10), deckM);
      pillar.position.set(i * 12, 3.5, -6); pillar.castShadow = true; this.scene.add(pillar);
    }
    // scattered props: cartons, fire barrel
    const boxM = new THREE.MeshStandardMaterial({ color: 0x6b5233, roughness: 1 });
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), boxM);
      b.position.set(-6 + Math.random() * 12, 0.25, -2 + Math.random() * 4);
      b.rotation.y = Math.random() * 3; this.scene.add(b);
    }
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 10),
      new THREE.MeshStandardMaterial({ color: 0x7a2020, roughness: 0.8 }));
    barrel.position.set(5, 0.45, 1); this.scene.add(barrel);
    this.fire = new THREE.PointLight(0xff7733, 12, 12);
    this.fire.position.set(5, 1.4, 1); this.scene.add(this.fire);

    // player lying down
    this.playerChar = this.makePerson({ shirt: 0xf5f5f5, pants: 0x1a7a4a, cap: 0x1a7a4a, scale: 1 });
    this.playerChar.position.set(-1.5, 0, 2);
    this.playerChar.rotation.z = Math.PI / 2 - 0.15; // lying
    this.playerChar.rotation.y = 0.4;
    this.playerChar.position.y = 0.35;
    this.lying = true;

    // Oga Sule looming
    this.ogaChar = this.makePerson({ shirt: 0x161616, scale: 1.35, pants: 0x1a1a1a });
    this.ogaChar.position.set(6, 0, 2.5);
    this.ogaChar.rotation.y = -Math.PI / 2;

    this.camBase.set(-4.5, 2.2, 8.5);
    this.camLook.set(0, 1.2, 0);
    this.layoutCam();
    this.dawnP = 0;
  }

  setDawn(p) { // 0 = night, 1 = dawn
    this.dawnP = p;
    const night = new THREE.Color(0x0a0e1a), dawn = new THREE.Color(0xffb36b);
    this.scene.background.copy(night).lerp(dawn, p * 0.85);
    this.scene.fog.color.copy(this.scene.background);
    if (this.sun) { this.sun.intensity = 0.25 + p * 1.6; this.sun.color.set(0x8fa8ff).lerp(new THREE.Color(0xffd9a0), p); }
    if (this.hemi) this.hemi.intensity = 0.35 + p * 0.8;
  }

  ogaApproach(p) { // 0 far .. 1 looming over player
    if (!this.ogaChar) return;
    this.ogaChar.position.x = 6 - p * 6.2;
    this.ogaChar.position.z = 2.5 - p * 0.6;
  }

  playerSitUp() {
    if (!this.playerChar || !this.lying) return;
    this.lying = false;
    this.playerChar.rotation.z = 0;
    this.playerChar.position.y = 0;
    this.playerChar.position.x = -1.2;
  }

  // ---------- BUS STOP (main) ----------
  // gradient sky dome — far cheaper than it looks, far prettier than flat color
  skyDome(top, mid, bot) {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const g = c.getContext('2d');
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(280, 20, 14),
      new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false })
    );
    this.scene.add(sky);
    this.skyCanvas = c; this.skyCtx = g; this.skyTex = t; this.skyMesh = sky;
    this.paintSky(top, mid, bot);
    return sky;
  }

  paintSky(top, mid, bot) {
    if (!this.skyCtx) return;
    const g = this.skyCtx;
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, top); gr.addColorStop(0.62, mid); gr.addColorStop(1, bot);
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    this.skyTex.needsUpdate = true;
  }

  // --- day cycle: sky colors + sun position + lamps, driven by in-game minutes ---
  // keyframes: [minutes, top, mid, bot, sunColor, sunInt, hemiInt, fogColor]
  daySky(timeMin) {
    const K = [
      [360,  '#3a5a9c', '#e8956b', '#f7d9a8', 0xffb36b, 0.9, 0.7,  0xd9b49a],
      [480,  '#2f6cb8', '#9fc7e8', '#d9ecf7', 0xffe9c4, 1.7, 1.0,  0xbcd7ec],
      [720,  '#1f5fb0', '#8fc3ea', '#e0f0fa', 0xfff4e0, 2.0, 1.15, 0xc2dcf0],
      [990,  '#2a63b0', '#a8cdea', '#f0e2b8', 0xffe0a8, 1.8, 1.05, 0xc4d2e2],
      [1080, '#3a4a8c', '#e08a5a', '#f7c86b', 0xff9a50, 1.1, 0.8,  0xd8a884],
      [1140, '#1a2048', '#7a4a6a', '#d8705a', 0xff7a40, 0.5, 0.55, 0x8a5a62],
      [1200, '#060a18', '#101a38', '#2a3050', 0x8fa8ff, 0.25, 0.4, 0x1a2038],
    ];
    let a = K[0], b = K[K.length - 1];
    for (let i = 0; i < K.length - 1; i++) {
      if (timeMin >= K[i][0] && timeMin <= K[i + 1][0]) { a = K[i]; b = K[i + 1]; break; }
    }
    const f = b[0] === a[0] ? 0 : (timeMin - a[0]) / (b[0] - a[0]);
    const mix = (c1, c2) => '#' + new THREE.Color(c1).lerp(new THREE.Color(c2), f).getHexString();
    this.paintSky(mix(a[1], b[1]), mix(a[2], b[2]), mix(a[3], b[3]));
    if (this.scene.fog) this.scene.fog.color.set(mix(a[7], b[7]));
    if (this.sun) {
      this.sun.color.set(a[4]).lerp(new THREE.Color(b[4]), f);
      this.sun.intensity = (a[5] + (b[5] - a[5]) * f) * (this.sun.userData.rainDim || 1);
      // sun arcs east -> overhead -> west across the working day
      const dayF = Math.min(1, Math.max(0, (timeMin - 360) / 780));
      const ang = Math.PI * dayF; // 0=east horizon, PI=west horizon
      this.sun.position.set(Math.cos(ang) * 40, Math.sin(ang) * 38 + 4, 14);
      if (this.sunDisc) {
        this.sunDisc.position.set(Math.cos(ang) * 240, Math.sin(ang) * 220 + 8, -180);
        const night = timeMin > 1120;
        this.sunDisc.material.color.set(night ? 0xdfe8ff : 0xffe9a8);
        this.sunDisc.scale.setScalar(night ? 14 : 20 - dayF * 4);
      }
    }
    if (this.hemi) this.hemi.intensity = a[6] + (b[6] - a[6]) * f;
    // streetlights + headlights switch on toward dusk
    const lampOn = timeMin >= 1060;
    for (const m of (this.lampMats || [])) m.emissiveIntensity = lampOn ? 2.2 : 0.6;
    for (const m of (this.headMats || [])) m.emissiveIntensity = lampOn ? 1.6 : 0.33;
  }

  // building facade with lit/unlit windows
  facadeTexture(base, litRatio = 0.25) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    for (let y = 14; y < 240; y += 34) for (let x = 12; x < 240; x += 30) {
      const lit = Math.random() < litRatio;
      g.fillStyle = lit ? '#ffe9a8' : 'rgba(20,28,38,0.85)';
      g.fillRect(x, y, 20, 24);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, y, 20, 4);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  buildStop() {
    this.clear(); this.mode = 'stop';
    this.skyDome('#2f6cb8', '#9fc7e8', '#d9ecf7');
    this.scene.fog = new THREE.Fog(0xbcd7ec, 55, 160);
    this.lights(0xffe9c4, 1.7, 1.0);
    // sun disc riding the day arc
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
    this.sunDisc.position.set(240, 10, -180);
    this.scene.add(this.sunDisc);
    this.ground(0x6b5b43);
    // road
    const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 160),
      new THREE.MeshStandardMaterial({ color: 0x333338, roughness: 1 }));
    road.rotation.x = -Math.PI / 2; road.position.set(-6, 0.01, 0); road.receiveShadow = true;
    this.scene.add(road);
    // lane dashes
    const dashM = new THREE.MeshStandardMaterial({ color: 0xd8d8d8 });
    for (let z = -75; z < 75; z += 6) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 2), dashM);
      d.rotation.x = -Math.PI / 2; d.position.set(-6, 0.02, z);
      this.scene.add(d);
    }
    // road edge lines
    for (const x of [-12.6, 0.6]) {
      const e = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 160),
        new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }));
      e.rotation.x = -Math.PI / 2; e.position.set(x, 0.02, 0);
      this.scene.add(e);
    }
    // zebra crossing near the stop
    for (let i = 0; i < 6; i++) {
      const z = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 3.2),
        new THREE.MeshStandardMaterial({ color: 0xe8e8e8 }));
      z.rotation.x = -Math.PI / 2; z.position.set(-11 + i * 2, 0.02, 9);
      this.scene.add(z);
    }
    // sidewalk
    const walk = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 160),
      new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 1 }));
    walk.position.set(6, 0.1, 0); walk.receiveShadow = true; this.scene.add(walk);
    // streetlights along the road
    const poleM = new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.8 });
    const lampM = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffc86b, emissiveIntensity: 0.6 });
    this.lampMats = [lampM];
    for (let z = -60; z <= 60; z += 24) {
      for (const x of [-13.5, 1.5]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7.5, 8), poleM);
        pole.position.set(x, 3.75, z); pole.castShadow = true; this.scene.add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), poleM);
        arm.position.set(x + (x < -6 ? 0.8 : -0.8), 7.4, z); this.scene.add(arm);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), lampM);
        lamp.position.set(x + (x < -6 ? 1.5 : -1.5), 7.32, z); this.scene.add(lamp);
      }
    }

    // shelter
    const shM = new THREE.MeshStandardMaterial({ color: 0x1f6f4a, roughness: 0.8 });
    for (const x of [3.5, 8.5]) for (const z of [-3, 3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 8), shM);
      post.position.set(x, 1.3, z); post.castShadow = true; this.scene.add(post);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(7, 0.15, 8), shM);
    roof.position.set(6, 2.7, 0); roof.castShadow = true; this.scene.add(roof);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.12, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x6b5233, roughness: 1 }));
    bench.position.set(6, 0.75, 2.2); bench.castShadow = true; this.scene.add(bench);
    // BUS STOP sign
    const signTex = this.textTexture('BUS STOP', '#ffc61a', '#14110f');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.9),
      new THREE.MeshBasicMaterial({ map: signTex }));
    sign.position.set(6, 2.2, 3.15); this.scene.add(sign);

    // mama-put stall
    const stallM = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 1 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.2), stallM);
    table.position.set(10.5, 0.65, -6); table.castShadow = true; this.scene.add(table);
    const umb = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.0, 10),
      new THREE.MeshStandardMaterial({ color: 0x1a7a4a, roughness: 0.9 }));
    umb.position.set(10.5, 2.6, -6); umb.castShadow = true; this.scene.add(umb);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), stallM);
    pole.position.set(10.5, 1.4, -6); this.scene.add(pole);
    // cooking pots on the table
    const potM = new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 0.6, metalness: 0.3 });
    for (const [dx, r] of [[-0.6, 0.32], [0.1, 0.26], [0.65, 0.2]]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, 0.35, 12), potM);
      pot.position.set(10.5 + dx, 1.28, -6); pot.castShadow = true; this.scene.add(pot);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.06, 12), potM);
      lid.position.set(10.5 + dx, 1.48, -6); this.scene.add(lid);
    }

    // backdrop buildings with windows
    const bBases = ['#c9b896', '#a8b8c9', '#d9a066', '#9aa578', '#b98d7e', '#8fa3b8'];
    for (let i = 0; i < 10; i++) {
      const h = 10 + Math.random() * 16;
      const w = 8 + Math.random() * 6;
      const tex = this.facadeTexture(bBases[i % bBases.length], 0.2);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 10)));
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 6),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
      b.position.set(22 + Math.random() * 16, h / 2, -65 + i * 14);
      this.scene.add(b);
    }
    // a couple of blocks on the far side of the road too
    for (let i = 0; i < 4; i++) {
      const h = 8 + Math.random() * 10;
      const tex = this.facadeTexture(bBases[(i + 3) % bBases.length], 0.15);
      const b = new THREE.Mesh(new THREE.BoxGeometry(9, h, 6),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
      b.position.set(-24 - Math.random() * 8, h / 2, -45 + i * 30);
      this.scene.add(b);
    }

    // people: player, kabiru, mama put
    this.playerChar = this.makePerson({ shirt: 0xf5f5f5, pants: 0x1a7a4a, cap: 0x1a7a4a, scale: 1 });
    this.playerChar.position.set(2.5, 0.2, 1.5);
    this.playerChar.rotation.y = -Math.PI / 2 - 0.4;
    this.kabiruChar = this.makePerson({ shirt: 0xf5f5f5, pants: 0x1a1a1a, scale: 1.02 });
    this.kabiruChar.position.set(3.5, 0.2, -2.5);
    this.kabiruChar.rotation.y = Math.PI / 2;
    this.mamaChar = this.makePerson({ shirt: 0xffc61a, scale: 0.95 });
    this.mamaChar.position.set(10.5, 0.2, -7.4);
    this.mamaChar.rotation.y = Math.PI;

    this.camBase.set(1.5, 5.2, 13.5);
    this.camLook.set(-1, 1.2, -1);
    this.layoutCam();
    this.stopZ = 4; // where danfos halt
    this.spawnTraffic();
    this.spawnWalkers();
  }

  // ---------- ambient traffic: the road is never dead ----------
  makeCar(color) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 3.6),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.25 }));
    body.position.y = 0.62; body.castShadow = true;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.9),
      new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.3, metalness: 0.4 }));
    cab.position.set(0, 1.15, -0.2); cab.castShadow = true;
    car.add(body, cab);
    const wg = new THREE.CylinderGeometry(0.3, 0.3, 0.24, 10);
    const wm = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 1 });
    for (const [x, z] of [[-0.85, 1.15], [0.85, 1.15], [-0.85, -1.15], [0.85, -1.15]]) {
      const w = new THREE.Mesh(wg, wm);
      w.rotation.z = Math.PI / 2; w.position.set(x, 0.3, z); car.add(w);
    }
    car.userData.wheels = car.children.filter(m => m.geometry === wg);
    this.scene.add(car);
    return car;
  }

  makeOkada() {
    const g = new THREE.Group();
    const bike = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 1.7),
      new THREE.MeshStandardMaterial({ color: 0xb02020, roughness: 0.6 }));
    bike.position.y = 0.55; bike.castShadow = true; g.add(bike);
    const rider = this.makePerson({ shirt: 0x2b6cb0, pants: 0x222222, scale: 0.85 });
    rider.position.y = 0.55; rider.userData.baseY = 0.55; // keep the idle-bob from snapping him down
    this.scene.remove(rider); g.add(rider); // re-parent under bike
    const wg = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 10);
    const wm = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 1 });
    for (const z of [0.75, -0.75]) {
      const w = new THREE.Mesh(wg, wm);
      w.rotation.z = Math.PI / 2; w.position.set(0, 0.28, z); g.add(w);
    }
    g.userData.wheels = g.children.filter(m => m.geometry === wg);
    this.scene.add(g);
    return g;
  }

  spawnTraffic() {
    this.traffic = [];
    const defs = [
      { lane: -10.5, dir: 1 }, { lane: -2.8, dir: -1 },
    ];
    const carColors = [0xc0c6cc, 0x8a1f1f, 0x1f4d8a, 0x2b2b2b, 0xd8d8d8, 0x3a6b35];
    for (const { lane, dir } of defs) {
      for (let i = 0; i < 5; i++) {
        const kind = Math.random();
        const mesh = kind < 0.35 ? this.makeDanfo()
          : kind < 0.75 ? this.makeCar(carColors[Math.floor(Math.random() * carColors.length)])
          : this.makeOkada();
        if (dir < 0) mesh.rotation.y = Math.PI;
        const v = { mesh, lane, dir, speed: 11 + Math.random() * 8 };
        mesh.position.set(lane + (Math.random() - 0.5) * 0.6, 0.02, -75 + i * 32 + Math.random() * 14);
        this.traffic.push(v);
      }
    }
  }

  updateTraffic(dt) {
    if (!this.traffic) return;
    for (const v of this.traffic) {
      v.mesh.position.z += v.dir * v.speed * dt;
      for (const w of (v.mesh.userData.wheels || [])) w.rotation.x += dt * v.speed * 2.2;
      if (v.dir > 0 && v.mesh.position.z > 80) v.mesh.position.z = -80;
      if (v.dir < 0 && v.mesh.position.z < -80) v.mesh.position.z = 80;
    }
  }

  textTexture(text, fg, bg) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
    g.fillStyle = fg; g.font = 'bold 72px Anton, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 68);
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  // ---------- pedestrians ----------
  spawnWalkers() {
    this.walkers = [];
    const shirts = [0xc0392b, 0x2980b9, 0x8e44ad, 0xd35400, 0x16a085, 0xf39c12, 0x7f8c8d, 0xe84393];
    for (let i = 0; i < 9; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const p = this.makePerson({
        shirt: shirts[i % shirts.length],
        pants: [0x2b2b3a, 0x3a3a3a, 0x1a3a5a][i % 3],
        scale: 0.92 + Math.random() * 0.14,
        cap: Math.random() < 0.4 ? 0xdddddd : null,
      });
      const x = side > 0 ? 4.6 + Math.random() * 2.4 : -15.2 + Math.random() * 1.4;
      const dir = Math.random() < 0.5 ? 1 : -1;
      p.position.set(x, 0, -75 + Math.random() * 150);
      if (dir < 0) p.rotation.y = Math.PI;
      this.scene.add(p);
      this.walkers.push({ p, dir, speed: 1.1 + Math.random() * 1.1, phase: Math.random() * 6 });
    }
  }

  updateWalkers(dt) {
    if (!this.walkers) return;
    for (const w of this.walkers) {
      w.p.position.z += w.dir * w.speed * dt;
      w.phase += dt * 9;
      // walking bob + arm swing
      w.p.position.y = Math.abs(Math.sin(w.phase)) * 0.06;
      const u = w.p.userData;
      if (u && u.a1) { u.a1.rotation.x = Math.sin(w.phase) * 0.5; u.a2.rotation.x = -Math.sin(w.phase) * 0.5; }
      if (w.dir > 0 && w.p.position.z > 78) w.p.position.z = -78;
      if (w.dir < 0 && w.p.position.z < -78) w.p.position.z = 78;
    }
  }

  // ---------- rain ----------
  setRain(on) {
    this.rainOn = on;
    if (on && !this.rain) {
      const N = 350;
      const pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        pos[i * 3] = -20 + Math.random() * 30;
        pos[i * 3 + 1] = Math.random() * 22;
        pos[i * 3 + 2] = -40 + Math.random() * 90;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rain = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0xaaccee, size: 0.12, transparent: true, opacity: 0.6, fog: false,
      }));
      this.scene.add(this.rain);
    }
    if (this.rain) this.rain.visible = on;
    // rain gloom: dim the sun while it falls
    if (this.sun) this.sun.userData.rainDim = on ? 0.55 : 1;
  }

  updateRain(dt) {
    if (!this.rain || !this.rain.visible) return;
    const pos = this.rain.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - dt * 16;
      if (y < 0) { y = 22; pos.setX(i, -20 + Math.random() * 30); pos.setZ(i, -40 + Math.random() * 90); }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }
  // spawn a danfo driving in; onArrive(bus) when halted at the stop
  spawnDanfo(onArrive) {
    const bus = this.makeDanfo();
    bus.position.set(-6, 0, -55);
    const conductor = this.makePerson({ shirt: 0xdddddd, scale: 0.95 });
    conductor.position.set(1.35, 0.9, 1.2);
    conductor.rotation.z = -0.5;
    bus.add(conductor);
    bus.userData.conductor = conductor;
    const rec = { bus, state: 'arriving', speed: 9, onArrive };
    this.buses.push(rec);
    return rec;
  }

  danfoLeave(rec, dir = 1) {
    rec.state = 'leaving'; rec.dir = dir;
  }

  removeBus(rec) {
    const i = this.buses.indexOf(rec);
    if (i >= 0) this.buses.splice(i, 1);
    if (rec.bus.userData.conductor) {
      const ci = this.people.indexOf(rec.bus.userData.conductor);
      if (ci >= 0) this.people.splice(ci, 1);
    }
    this.scene.remove(rec.bus);
  }

  shake(amt) { this.shakeAmt = Math.max(this.shakeAmt, amt); }

  update(dt) {
    this.t += dt;
    // idle bob for people
    for (const p of this.people) {
      const u = p.userData;
      if (!u) continue;
      p.position.y = (u.baseY || 0) + Math.abs(Math.sin(this.t * 3 + u.phase)) * 0.03;
      u.a1.rotation.x = Math.sin(this.t * 3 + u.phase) * 0.12;
      u.a2.rotation.x = -Math.sin(this.t * 3 + u.phase) * 0.12;
    }
    // buses
    for (const rec of [...this.buses]) {
      const b = rec.bus;
      if (rec.state === 'arriving') {
        b.position.z += rec.speed * dt;
        rec.speed = Math.max(2.2, rec.speed - dt * 6);
        for (const w of b.userData.wheels) w.rotation.x += dt * rec.speed * 2;
        if (b.position.z >= this.stopZ) {
          b.position.z = this.stopZ; rec.state = 'halted';
          this.shake(0.15);
          if (rec.onArrive) rec.onArrive(rec);
        }
      } else if (rec.state === 'leaving') {
        b.position.z += (rec.dir || 1) * 14 * dt;
        for (const w of b.userData.wheels) w.rotation.x += dt * 20;
        if (Math.abs(b.position.z) > 70) this.removeBus(rec);
      }
    }
    if (this.fire) this.fire.intensity = 10 + Math.sin(this.t * 13) * 3 + Math.random() * 2;
    this.updateTraffic(dt);
    this.updateWalkers(dt);
    this.updateRain(dt);
    // camera
    const push = this.camPush;
    const px = this.camBase.x + Math.sin(this.t * 0.3) * 0.25 - push * 3.2;
    const py = this.camBase.y - push * 1.6;
    const pz = this.camBase.z - push * 5.5;
    let sx = 0, sy = 0;
    if (this.shakeAmt > 0.001) {
      sx = (Math.random() - 0.5) * this.shakeAmt;
      sy = (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt *= Math.pow(0.02, dt);
    }
    this.camera.position.set(px + sx, py + sy, pz);
    this.camera.lookAt(this.camLook);
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
