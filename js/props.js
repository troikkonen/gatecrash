// ============================================================
// Props — 3D gates, gap pits + boards, rocks, crates. Pooled meshes driven by the sim each frame.
// ============================================================
const PROPS = {};

// ---------- gates: two posts + a panel, tinted per lane job ----------
(function gates(){
  const postGeo = new THREE.BoxGeometry(0.16, 1.5, 0.16); postGeo.translate(0, 0.75, 0);
  const panelGeo = new THREE.BoxGeometry(CFG.laneW - 0.5, 0.9, 0.08); panelGeo.translate(0, 0.9, 0);
  const capGeo = new THREE.BoxGeometry(0.22, 0.12, 0.22); capGeo.translate(0, 1.56, 0);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x7c8494, roughness: 0.35, metalness: 0.9 }), capMat = new THREE.MeshStandardMaterial({ color: 0xffd447, emissive: 0xffb300, emissiveIntensity: 0.8, roughness: 0.4, metalness: 0.5 });
  PROPS.gates = Array.from({length: 24}, () => {
    const g = new THREE.Group();
    for (const s of [-1, 1]){ const p = new THREE.Mesh(postGeo, postMat); p.position.x = s*(CFG.laneW/2 - 0.22); p.castShadow = true; g.add(p); const c = new THREE.Mesh(capGeo, capMat); c.position.x = p.position.x; g.add(c); }
    const panel = new THREE.Mesh(panelGeo, new THREE.MeshStandardMaterial({ color: 0x4fc3ff, emissive: 0x4fc3ff, emissiveIntensity: 1.1, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 0.92 })); panel.castShadow = true; g.add(panel);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true })); label.position.set(0, 0.95, 0.1); g.add(label);
    g.visible = false; scene.add(g); return { g, panel, label };
  });
})();
function drawGate(slot, gate){
  const { g, panel, label } = slot;
  g.position.set(laneX(gate.lane), 0.05 + (gate.fall ? -gate.fall*4 : 0), gate.z); g.visible = true;
  const col = gate.flash > 0 ? '#ffffff' : gate.type === 'mul' ? '#d58cff' : gate.lane === RIGHT ? '#ffd447' : '#4fc3ff';
  panel.material.color.set(col); panel.material.emissive.set(col); panel.material.opacity = gate.used ? 0.3 : 0.92;
  label.visible = !gate.used;
  if (label.visible){ const tx = textTex(gateLabel(gate), '#ffffff', 72); label.material.map = tx; label.material.needsUpdate = true; label.scale.set(0.9*tx.image.width/tx.image.height, 0.9, 1); }
}

// ---------- gaps: pit under each outer lane + up to 10 boards ----------
(function gaps(){
  PROPS.gaps = {};
  for (const lane of [LEFT, RIGHT]){
    const x = laneX(lane), z0 = GAP.near, z1 = GAP.far, len = z0 - z1;
    // the road surface over the gap is its own strip so it can be hidden
    const surf = roadSurfaces[lane]; scene.remove(surf);
    const near = roadStrip(x, CFG.road.near, z0, CFG.laneW + 0.02), far = roadStrip(x, z1, CFG.road.far, CFG.laneW + 0.02), mid = roadStrip(x, z0, z1, CFG.laneW + 0.02);
    const pit = new THREE.Mesh(new THREE.BoxGeometry(CFG.laneW + 0.02, 3, len), new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 1 })); pit.position.set(x, -1.9, (z0 + z1)/2); scene.add(pit);
    const boards = Array.from({length: 10}, (_, i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(CFG.laneW - 0.2, 0.14, 1), new THREE.MeshStandardMaterial({ color: i%2 ? 0xb8874f : 0xc8955a, roughness: 0.85, envMapIntensity: 0.3 })); b.castShadow = true; b.receiveShadow = true; b.visible = false; scene.add(b); return b; });
    const ghost = new THREE.Mesh(new THREE.BoxGeometry(CFG.laneW - 0.2, 0.12, 1), new THREE.MeshStandardMaterial({ color: 0xc8955a, transparent: true, opacity: 0.3 })); ghost.visible = false; scene.add(ghost);
    PROPS.gaps[lane] = { mid, boards, ghost };
  }
})();
function drawGap(gap){
  const P = PROPS.gaps[gap.lane], seg = (GAP.near - GAP.far)/gap.boards, x = laneX(gap.lane);
  P.mid.visible = !gap.open;
  const n = gap.open ? gap.built : gap.boards;
  P.boards.forEach((b, i) => { b.visible = i < n; if (b.visible){ b.scale.z = seg*0.9; b.position.set(x, 0.12, GAP.near - (i + 0.5)*seg); } });
  P.ghost.visible = gap.open && gap.built < gap.boards;
  if (P.ghost.visible){ P.ghost.scale.z = seg*0.9; P.ghost.position.set(x, 0.12, GAP.near - (gap.built + 0.5)*seg); P.ghost.material.opacity = 0.15 + 0.6*(gap.hits/gap.hitsPer); }
  if (gap.open) FX.texts.push({ x, z: GAP.far - 0.6, y: 0.5, str: gap.built + '/' + gap.boards + (gap.lane === RIGHT ? '  MECH' : ''), color: '#fff', size: 0.5, life: 0.01 });
}

// ---------- rocks: lumpy icosahedra; ice is translucent ----------
(function rocks(){
  const mk = () => { const geo = new THREE.IcosahedronGeometry(0.95, 1); const pos = geo.attributes.position; for (let i=0;i<pos.count;i++){ const s = 0.82 + Math.random()*0.36; pos.setXYZ(i, pos.getX(i)*s, pos.getY(i)*s*0.85, pos.getZ(i)*s); } geo.computeVertexNormals(); geo.translate(0, 0.8, 0); return geo; };
  PROPS.rocks = Array.from({length: 4}, () => { const m = new THREE.Mesh(mk(), new THREE.MeshStandardMaterial({ color: 0x6e6759, emissive: 0xff7a1a, emissiveIntensity: 0, flatShading: true, roughness: 0.9 })); m.castShadow = true; m.visible = false; scene.add(m); return m; });
})();
function drawRock(m, it){
  m.position.set(laneX(it.lane), 0.05 + (it.fall ? -it.fall*4 : 0), it.z); m.visible = true; m.rotation.y = it.z*0.4;
  const dmg = 1 - it.hp/it.maxHp, ice = G.D.world >= 4;
  m.material.color.set(it.flash > 0 ? 0xffffff : ice ? 0x9fd8ff : 0x6e6759); m.material.transparent = ice; m.material.opacity = ice ? 0.8 : 1;
  m.material.emissive.set(it.reward.color); m.material.emissiveIntensity = 0.2 + dmg*1.6;
  FX.texts.push({ x: m.position.x, z: it.z, y: 2.0, str: String(it.hp), color: '#fff', size: 0.85, life: 0.01 });
  const tag = it.reward.kind === 'troops' ? '+' + it.reward.amount : it.reward.kind === 'weapon' ? WEAPONS[it.reward.gun].name.toUpperCase() : it.reward.kind.toUpperCase();
  FX.texts.push({ x: m.position.x, z: it.z + 0.6, y: 0.4, str: tag, color: it.reward.color, size: 0.42, life: 0.01 });
  FX.texts.push({ x: m.position.x, z: it.z, y: 2.7, str: 'SHOOT TO CRACK', color: '#fff', size: 0.3, life: 0.01 });
}

// ---------- crates: wooden box with an icon above ----------
(function crates(){
  const geo = new THREE.BoxGeometry(0.9, 0.7, 0.9); geo.translate(0, 0.35, 0);
  const edge = new THREE.EdgesGeometry(geo);
  PROPS.crates = Array.from({length: 6}, () => { const g = new THREE.Group(); const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8a6a3c, roughness: 0.8 })); m.castShadow = true; g.add(m);
    g.add(new THREE.LineSegments(edge, new THREE.LineBasicMaterial({ color: 0x3a2a15 })));
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true })); icon.position.set(0, 1.4, 0); icon.scale.set(1.2, 0.7, 1); g.add(icon);
    g.visible = false; scene.add(g); return { g, m, icon }; });
  PROPS.iconTex = {}; for (let i=0;i<6;i++) PROPS.iconTex[i] = loadTex('assets/w' + i + '.png');
})();
function drawCrate(slot, it){
  slot.g.position.set(laneX(it.lane), 0.05 + (it.fall ? -it.fall*4 : 0), it.z); slot.g.visible = true; slot.g.rotation.y = Math.sin(it.z*0.7)*0.15;
  slot.m.material.color.set(it.mech ? 0x3f6b2a : 0x8a6a3c);
  if (it.mech){ slot.icon.visible = false; FX.texts.push({ x: slot.g.position.x, z: it.z, y: 1.5, str: 'MECH SUIT', color: '#b6ff7d', size: 0.5, life: 0.01 }); }
  else { slot.icon.visible = true; slot.icon.material.map = PROPS.iconTex[it.gun]; slot.icon.material.needsUpdate = true; FX.texts.push({ x: slot.g.position.x, z: it.z + 0.7, y: 0.25, str: WEAPONS[it.gun].name.toUpperCase(), color: '#ffd447', size: 0.4, life: 0.01 }); }
}

// ---------- shield ring ----------
PROPS.shield = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0x7dffea, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
PROPS.shield.rotation.x = -Math.PI/2; PROPS.shield.visible = false; scene.add(PROPS.shield);

// ---------- boss attack telegraphs ----------
(function telegraphs(){
  PROPS.laneWarn = [0,1,2].map(l => { const m = new THREE.Mesh(new THREE.PlaneGeometry(CFG.laneW, 30), new THREE.MeshBasicMaterial({ color: 0xff3c3c, transparent: true, opacity: 0.4, depthWrite: false })); m.rotation.x = -Math.PI/2; m.position.set(laneX(l), 0.08, -12); m.visible = false; scene.add(m); return m; });
  PROPS.beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 30), new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); PROPS.beam.visible = false; scene.add(PROPS.beam);
  PROPS.rings = Array.from({length: 6}, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffc850, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI/2; m.visible = false; scene.add(m); return m; });
  PROPS.fallRock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshStandardMaterial({ color: 0x7a705f, flatShading: true, roughness: 0.95 })); PROPS.fallRock.castShadow = true; PROPS.fallRock.visible = false; scene.add(PROPS.fallRock);
  PROPS.bossLight = new THREE.PointLight(0xff4444, 0, 16, 2); scene.add(PROPS.bossLight);
})();
function drawTelegraphs(){
  const S = G.squad, b = G.boss, t = performance.now()/1000;
  PROPS.laneWarn.forEach(m => m.visible = false); PROPS.beam.visible = false; PROPS.rings.forEach(r => r.visible = false); PROPS.fallRock.visible = false;
  let ri = 0;
  for (const tg of G.telegraphs){
    if (tg.kind === 'lane'){ const m = PROPS.laneWarn[tg.lane]; m.visible = true; m.material.opacity = tg.t > 0 ? 0.22 + 0.15*Math.sin(t*30) : 0.6; if (b){ m.position.z = (b.z + CFG.road.near)/2; m.scale.y = (CFG.road.near - b.z)/30; } }
    if (tg.kind === 'rock'){ const r = PROPS.rings[ri++]; if (r){ r.visible = true; r.position.set(tg.x, 0.09, CFG.squadZ); r.scale.set(tg.r, tg.r, 1); r.material.color.set(tg.t > 0 ? 0xffc850 : 0xffffff); r.material.opacity = 0.9; }
      if (tg.t > 0){ PROPS.fallRock.visible = true; PROPS.fallRock.position.set(tg.x, Math.max(0.3, tg.t*7), CFG.squadZ); } }
    if (tg.kind === 'beam' && b){ PROPS.beam.visible = true; PROPS.beam.position.set(tg.x, 0.15, (b.z + CFG.road.near)/2); PROPS.beam.scale.set(tg.t <= 0 ? 1 : 0.35, 1, (CFG.road.near - b.z)/30); PROPS.beam.material.opacity = tg.t <= 0 ? 0.85 : 0.3; }
  }
  if (b && b.phase !== 'dying'){ PROPS.bossLight.position.set(b.x, 1.8, b.z + 0.5); PROPS.bossLight.color.set(b.def.color); PROPS.bossLight.intensity = 1.6 + 0.4*Math.sin(t*3); FX.glows.push({ x: b.x, z: b.z, r: 2.2, color: b.def.color, life: 0.01, max: 1 }); }
  else PROPS.bossLight.intensity = 0;
}
function drawBoss(dt){
  const b = G.boss; poolBegin(pools.boss);
  if (b){ const it = poolTake(pools.boss); it.obj.position.set(b.x, 0.05, b.z); it.obj.scale.setScalar(pools.boss.mutant ? b.scale*1.35 : b.scale); it.obj.rotation.set(0, 0, 0);
    if (!pools.boss.mutant) it.obj.traverse(o => { if (o.isMesh && o.material.color) o.material.color.lerp(new THREE.Color(b.def.color), 0.15); });
    else it.obj.traverse(o => { if (o.isMesh && o.material.emissive){ o.material.emissive.set(b.def.color); o.material.emissiveIntensity = b.flash > 0 ? 0.6 : 0.18; } });
    flash(it, b.flash > 0);
    const A = it.actions, has = n => !!A[n];
    let rot = 0, dy = 0;
    if (pools.boss.mutant){
      // Mutant: until its own walk/punch/death clips arrive, Run drives everything and the body language does the rest
      if (b.phase === 'dying'){ if (!has('MDeath')){ const q = Math.min(1, b.dieT/0.9); rot = q*q*1.4; } play(it, has('MDeath') ? 'MDeath' : 'Move', { once: has('MDeath'), speed: has('MDeath') ? 1.6 : 0.2 }); }
      else if (b.anim && b.anim.kind === 'swing'){ if (!has('MPunch')){ const a = b.anim, q = a.t < a.dur - 0.35 ? a.t/(a.dur - 0.35) : 1 - (a.t - (a.dur - 0.35))/0.35; rot = -0.25*q; dy = 0.3*q; } play(it, has('MPunch') ? 'MPunch' : 'Move', { once: has('MPunch'), speed: has('MPunch') ? 1.3/b.anim.dur : 2.2 }); }
      else if (b.busy && b.busy.kind === 'charge') play(it, 'Move', { speed: 2.0 });
      else if (G.intro > 0 && has('MRoar')) play(it, 'MRoar', { speed: 1 });
      else if (b.phase === 'enter' || !b.atLine) play(it, has('MWalk') ? 'MWalk' : 'Move', { speed: has('MWalk') ? 1.3 : 0.55 });
      else play(it, has('MIdle') ? 'MIdle' : 'Move', { speed: has('MIdle') ? 1 : 0.3 });
    } else {
      if (b.phase === 'dying') play(it, 'Death', { once: true });
      else if (b.anim && b.anim.kind === 'swing') play(it, 'Punch', { once: true, speed: 1.2/b.anim.dur });
      else if (b.busy && b.busy.kind === 'charge') play(it, 'Running', { speed: 1.6 });
      else if (b.phase === 'enter' || !b.atLine) play(it, 'Walking', { speed: 0.9 });
      else play(it, 'Idle');
    }
    it.obj.rotation.x = rot; it.obj.position.y += dy;
    if (b.phase !== 'dying'){ FX.texts.push({ x: b.x, z: b.z, y: 4.4*b.scale + 0.6, str: String(b.hp), color: '#fff', size: 0.75, life: 0.01 });
      FX.texts.push({ x: b.x, z: b.z, y: 4.4*b.scale + 0.1, str: '▮'.repeat(Math.max(1, Math.round(20*b.hp/b.maxHp))), color: '#ff4d4d', size: 0.3, life: 0.01 }); } }
  poolEnd(pools.boss, dt);
}

function drawProps(){
  let gi = 0; for (const g of G.gates){ if (gi < PROPS.gates.length) drawGate(PROPS.gates[gi++], g); }
  for (; gi < PROPS.gates.length; gi++) PROPS.gates[gi].g.visible = false;
  for (const gap of G.gaps) drawGap(gap);
  let ri = 0, ci = 0;
  PROPS.rocks.forEach(m => m.visible = false); PROPS.crates.forEach(c => c.g.visible = false);
  for (const it of G.items){ if (it.type === 'rock' && !it.cracked && ri < PROPS.rocks.length) drawRock(PROPS.rocks[ri++], it); else if (it.type === 'crate' && ci < PROPS.crates.length) drawCrate(PROPS.crates[ci++], it); }
  const S = G.squad; PROPS.shield.visible = G.shield > 0;
  if (PROPS.shield.visible){ const r = S.radius + 0.5; PROPS.shield.position.set(S.x, 0.1, CFG.squadZ); PROPS.shield.scale.set(r, r, 1); PROPS.shield.material.opacity = 0.35 + 0.25*Math.sin(performance.now()/120); }
}
