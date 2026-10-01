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
  }

  clear() {
    this.scene.clear();
    this.buses = []; this.people = [];
    this.scene.fog = null;
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
  makePerson({ shirt = 0x8a6d4b, skin = 0x6b4a2f, scale = 1, pants = 0x2b2b3a } = {}) {
    const grp = new THREE.Group();
    const s = scale;
    const legH = 0.55 * s, torsoH = 0.65 * s;
    const legG = new THREE.CylinderGeometry(0.09 * s, 0.11 * s, legH, 6);
    const legM = new THREE.MeshStandardMaterial({ color: pants, roughness: 1 });
    const l1 = new THREE.Mesh(legG, legM); l1.position.set(-0.12 * s, legH / 2, 0);
    const l2 = new THREE.Mesh(legG, legM); l2.position.set(0.12 * s, legH / 2, 0);
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.21 * s, torsoH * 0.7, 4, 8),
      new THREE.MeshStandardMaterial({ color: shirt, roughness: 1 })
    );
    torso.position.y = legH + torsoH / 2;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.16 * s, 12, 10),
      new THREE.MeshStandardMaterial({ color: skin, roughness: 0.9 })
    );
    head.position.y = legH + torsoH + 0.2 * s;
    // arms
    const armG = new THREE.CylinderGeometry(0.06 * s, 0.07 * s, 0.5 * s, 6);
    const armM = new THREE.MeshStandardMaterial({ color: shirt, roughness: 1 });
    const a1 = new THREE.Mesh(armG, armM); a1.position.set(-0.3 * s, legH + torsoH * 0.55, 0); a1.rotation.z = 0.25;
    const a2 = new THREE.Mesh(armG, armM); a2.position.set(0.3 * s, legH + torsoH * 0.55, 0); a2.rotation.z = -0.25;
    for (const m of [l1, l2, torso, head, a1, a2]) { m.castShadow = true; grp.add(m); }
    grp.userData = { head, a1, a2, phase: Math.random() * 6, baseY: 0 };
    this.people.push(grp);
    this.scene.add(grp);
    return grp;
  }

  // ---------- danfo ----------
  makeDanfo(stripeColor = GREEN) {
    const bus = new THREE.Group();
    const bodyM = new THREE.MeshStandardMaterial({ color: YELLOW, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 4.6), bodyM);
    body.position.y = 1.15; body.castShadow = true;
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.28, 4.62),
      new THREE.MeshStandardMaterial({ color: stripeColor, roughness: 0.7 })
    );
    stripe.position.y = 1.05;
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
    const hlM = new THREE.MeshStandardMaterial({ color: 0xfff6c9, emissive: 0x554411 });
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
    this.playerChar = this.makePerson({ shirt: 0x6b5a44, scale: 1 });
    this.playerChar.position.set(-1.5, 0, 2);
    this.playerChar.rotation.z = Math.PI / 2 - 0.15; // lying
    this.playerChar.rotation.y = 0.4;
    this.playerChar.position.y = 0.35;
    this.lying = true;

    // Oga Sule looming
    this.ogaChar = this.makePerson({ shirt: 0xa02323, scale: 1.35, pants: 0x1a1a1a });
    this.ogaChar.position.set(6, 0, 2.5);
    this.ogaChar.rotation.y = -Math.PI / 2;

    this.camBase.set(-4.5, 2.2, 8.5);
    this.camLook.set(0, 1.2, 0);
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
  buildStop() {
    this.clear(); this.mode = 'stop';
    this.scene.background = new THREE.Color(0x9fc7e8);
    this.scene.fog = new THREE.Fog(0x9fc7e8, 45, 130);
    this.lights(0xfff2d9, 1.5, 0.9);
    this.ground(0x4a3f30);
    // road
    const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 130),
      new THREE.MeshStandardMaterial({ color: 0x2e2e33, roughness: 1 }));
    road.rotation.x = -Math.PI / 2; road.position.set(-6, 0.01, 0); road.receiveShadow = true;
    this.scene.add(road);
    // lane dashes
    const dashM = new THREE.MeshStandardMaterial({ color: 0xd8d8d8 });
    for (let z = -60; z < 60; z += 6) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 2), dashM);
      d.rotation.x = -Math.PI / 2; d.position.set(-6, 0.02, z);
      this.scene.add(d);
    }
    // sidewalk
    const walk = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 130),
      new THREE.MeshStandardMaterial({ color: 0x7a756c, roughness: 1 }));
    walk.position.set(6, 0.1, 0); walk.receiveShadow = true; this.scene.add(walk);

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
      new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.9 }));
    umb.position.set(10.5, 2.6, -6); umb.castShadow = true; this.scene.add(umb);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), stallM);
    pole.position.set(10.5, 1.4, -6); this.scene.add(pole);

    // backdrop buildings
    const bColors = [0xc9b896, 0xa8b8c9, 0xd9a066, 0x9aa578];
    for (let i = 0; i < 8; i++) {
      const h = 8 + Math.random() * 14;
      const b = new THREE.Mesh(new THREE.BoxGeometry(8 + Math.random() * 6, h, 6),
        new THREE.MeshStandardMaterial({ color: bColors[i % 4], roughness: 1 }));
      b.position.set(20 + Math.random() * 14, h / 2, -55 + i * 15);
      this.scene.add(b);
    }

    // people: player, kabiru, mama put
    this.playerChar = this.makePerson({ shirt: 0x6b5a44, scale: 1 });
    this.playerChar.position.set(2.5, 0.2, 1.5);
    this.playerChar.rotation.y = -Math.PI / 2 - 0.4;
    this.kabiruChar = this.makePerson({ shirt: 0x2b6cb0, scale: 1.02 });
    this.kabiruChar.position.set(3.5, 0.2, -2.5);
    this.kabiruChar.rotation.y = Math.PI / 2;
    this.mamaChar = this.makePerson({ shirt: 0xe63946, scale: 0.95 });
    this.mamaChar.position.set(10.5, 0.2, -7.4);
    this.mamaChar.rotation.y = Math.PI;

    this.camBase.set(1.5, 5.2, 13.5);
    this.camLook.set(-1, 1.2, -1);
    this.stopZ = 4; // where danfos halt
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
