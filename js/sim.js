// ============================================================
// Simulation — the game, in world units. Nothing in here knows about pixels.
// Step 1: squad, drag control, auto-fire, enemy waves. Gates, gaps, bosses come next.
// ============================================================
const G = {                     // game state
  level: 1, D: null, elapsed: 0, dead: false, paused: true,
  squad: { x: 0, target: 0, n: CFG.startSquad, formation: [] },
  weapon: 0, recoil: 0, fireTimer: 0, waveTimer: 1.5, scroll: 0,
  bullets: [], enemies: [], corpses: [], blockSeq: 0,
  gates: [], items: [], gaps: [], timers: {}, shield: 0, mech: 0, rightOpen: 0,
};
const gateLabel = g => g.type === 'mul' ? 'x' + g.value : '+' + g.value;
const rand = (a,b) => a + Math.random()*(b-a);

function startLevel(L){
  G.level = L; G.D = difficulty(L); G.elapsed = 0; G.dead = false;
  G.squad.x = G.squad.target = 0; G.squad.n = CFG.startSquad;
  G.weapon = G.D.startWeapon; G.recoil = 0; G.fireTimer = 0; G.waveTimer = 1.5; G.scroll = 0;
  G.bullets = []; G.enemies = []; G.corpses = []; G.gates = []; G.items = []; G.shield = 0; G.mech = 0; G.rightOpen = 0;
  G.gaps = [ makeGap(LEFT, G.D.leftBoards, G.D.leftHits), makeGap(RIGHT, G.D.rightBoards, G.D.rightHits) ];
  G.timers = { plus: 1.0, mul: 4, weapon: 6, rock: 9, jackpot: 0, mech: 0 };
  FX.particles = []; FX.smoke = []; FX.decals = []; FX.texts = []; FX.glows = [];
  uiLevel(L); uiWeapon();
}
function setWeapon(i){ G.weapon = Math.min(WEAPONS.length-1, Math.max(G.weapon, i)); uiWeapon(); }

// ---------- squad formation: rings that pack tighter as the squad grows, always inside one lane ----------
function formation(n){
  let rings = 0, cap = 1; while (cap < n){ rings++; cap += rings*6; }
  const half = CFG.laneW/2 - 0.35, sp = Math.min(0.42, rings > 0 ? half/(rings + 0.4) : 0.42);
  const out = []; let placed = 0;
  for (let ring = 0; placed < n; ring++){
    const count = ring === 0 ? 1 : ring*6;
    for (let i=0;i<count && placed<n;i++,placed++){ const a = (i/count)*Math.PI*2 + ring*0.4; out.push([Math.cos(a)*ring*sp, Math.sin(a)*ring*sp*0.8]); }
  }
  G.squad.radius = rings*sp + 0.25; G.squad.spacing = sp; return out;
}
function loseTroops(k, x, z){
  if (G.shield > 0) k = Math.ceil(k*0.5);
  G.squad.n -= k; burst(x, z, '#4fc3ff', 8, 0.5); floatText(x, z, '-' + k, '#ff5a5a', 0.7); SFX.hurt(); kick(3 + Math.min(8, k));
  if (G.squad.n <= 0){ G.squad.n = 0; gameOver(); }
}
function killEnemy(e){
  e.dead = true; burst(e.x, e.z, ENEMY[e.kind].color, 4, 0.6); sparks(e.x, e.z, 5); decal(e.x, e.z, 'blood', 0.5 + ENEMY[e.kind].hit*0.2); SFX.kill();
  G.corpses.push({ kind: e.kind, x: e.x, z: e.z, y: 0, vx: rand(-2,2), vy: rand(4,7), vz: rand(2,5), rot: 0, vr: rand(-6,6), life: 0.8 });
}

// ---------- gates: each lane has one job ----------
function addGate(lane, type, value){ G.gates.push({ lane, type, value, max: type === 'add' && value < 99 ? value*3 : value, z: CFG.spawnZ, hits: 0, flash: 0 }); }
function pumpGate(g, dmg){ g.hits += dmg; g.flash = 0.06; while (g.hits >= 2 && g.value < g.max){ g.hits -= 2; g.value++; } }
function applyGate(g){
  const S = G.squad;
  if (g.type === 'mul'){ SFX.mul(); floatText(S.x, CFG.squadZ - 1.5, gateLabel(g) + ' BULLETS', '#d58cff', 0.6); return; }   // x-gates multiply bullets, not troops
  const before = S.n; S.n = Math.min(CFG.maxSquad, S.n + g.value);
  floatText(S.x, CFG.squadZ - 1.5, gateLabel(g), g.lane === RIGHT ? '#ffd447' : '#4fc3ff', 0.9); burst(S.x, CFG.squadZ - 1, '#4fc3ff', 12, 0.6); SFX.gate();
}

// ---------- gaps: shoot the missing road to lay boards; nothing crosses until it's bridged ----------
function makeGap(lane, boards, hits){ return { lane, boards, hitsPer: hits, built: 0, hits: 0, open: true, collapse: 0 }; }
function gapHit(g, dmg){
  g.hits += dmg;
  while (g.hits >= g.hitsPer && g.built < g.boards){ g.hits -= g.hitsPer; g.built++; SFX.board(); burst(laneX(g.lane), GAP.near - (g.built - 0.5)*(GAP.near - GAP.far)/g.boards, '#c8955a', 5, 0.3); }
  if (g.built >= g.boards){ g.open = false; g.hits = 0; SFX.bridge(); floatText(laneX(g.lane), (GAP.near + GAP.far)/2, 'BRIDGE UP', '#c8955a', 0.7);
    if (g.lane === RIGHT){ G.rightOpen = G.D.jackpotWindow; G.timers.jackpot = G.D.jackpotGap; G.items.push({ type: 'crate', lane: RIGHT, z: CFG.spawnZ, mech: true }); } }
}
function inGap(lane, z){ const g = G.gaps.find(x => x.lane === lane); return g && g.open && z > GAP.far && z < GAP.near; }
// anything riding an open outer lane drops into the pit
function swallow(obj){ if (obj.lane !== MID && !obj.fall && inGap(obj.lane, obj.z)) obj.fall = 0.01; if (obj.fall){ obj.fall += 0.04; if (obj.fall > 1) obj.dead = true; return true; } return false; }

// ---------- items: weapon crates (middle) and rocks (bridged outer lanes) ----------
const ROCK_REWARDS = [ { kind:'troops', color:'#4fc3ff' }, { kind:'weapon', color:'#ffd447' }, { kind:'mech', color:'#b6ff7d' }, { kind:'shield', color:'#7dffea' } ];
function spawnCrate(){ const next = Math.min(WEAPONS.length-1, G.weapon + 1); if (next !== G.weapon) G.items.push({ type: 'crate', lane: MID, z: CFG.spawnZ, gun: next }); }
function spawnRock(){
  const open = G.gaps.filter(g => !g.open).map(g => g.lane); if (!open.length){ G.timers.rock = 3; return; }
  const rw = { ...ROCK_REWARDS[Math.floor(Math.random()*ROCK_REWARDS.length)] };
  if (rw.kind === 'troops') rw.amount = Math.round(30 + G.level*12);
  if (rw.kind === 'weapon'){ rw.gun = Math.min(WEAPONS.length-1, G.weapon + 2); if (rw.gun === G.weapon){ rw.kind = 'troops'; rw.color = '#4fc3ff'; rw.amount = Math.round(30 + G.level*12); } }
  G.items.push({ type: 'rock', lane: open[Math.floor(Math.random()*open.length)], z: CFG.spawnZ, hp: G.D.rockHp, maxHp: G.D.rockHp, reward: rw, flash: 0, cracked: false });
}
function crackOpen(it){
  it.cracked = true; const S = G.squad, x = laneX(it.lane), rw = it.reward;
  burst(x, it.z, '#a89f8c', 24, 0.8); explode(x, it.z, 1.2, rw.color); SFX.crack(); kick(8);
  if (rw.kind === 'troops'){ S.n = Math.min(CFG.maxSquad, S.n + rw.amount); floatText(x, it.z, '+' + rw.amount, rw.color, 1.1); }
  if (rw.kind === 'weapon'){ setWeapon(rw.gun); floatText(x, it.z, WEAPONS[rw.gun].name.toUpperCase(), rw.color, 1); }
  if (rw.kind === 'mech'){ G.mech = 25; floatText(x, it.z, 'MECH ONLINE', rw.color, 0.9); }
  if (rw.kind === 'shield'){ G.shield = 20; floatText(x, it.z, 'SHIELD UP', rw.color, 0.9); }
}
function collectCrate(it){
  it.dead = true; SFX.pickup(); const S = G.squad;
  if (it.mech){ G.mech = 30; floatText(S.x, CFG.squadZ - 1.5, 'MECH SUIT', '#b6ff7d', 1); burst(S.x, CFG.squadZ - 1, '#b6ff7d', 16, 0.6); return; }
  setWeapon(it.gun); floatText(S.x, CFG.squadZ - 1.5, WEAPONS[it.gun].name.toUpperCase(), '#ffd447', 0.9); burst(S.x, CFG.squadZ - 1, '#ffd447', 14, 0.6);
}

// ---------- waves: marching blocks in the middle lane ----------
function spawnWave(){
  const D = G.D, n = D.waveSize, shape = Math.random() < 0.7 ? 'block' : 'loose';
  const pick = () => { const r = Math.random(); return r < D.bruteChance ? 'brute' : r < D.bruteChance + D.runnerChance ? 'runner' : 'grunt'; };
  if (shape === 'block'){
    const kind = Math.random() < D.bruteChance ? 'brute' : (Math.random() < D.runnerChance ? 'runner' : 'grunt');
    const cols = kind === 'brute' ? 3 : (n >= 16 ? 5 : 4), id = ++G.blockSeq, speed = ENEMY[kind].speed * D.speedMult, gapX = kind === 'brute' ? 0.75 : 0.48;
    for (let i=0;i<n;i++){ const c = i % cols, r = Math.floor(i/cols);
      G.enemies.push({ kind, x: laneX(MID) + (c - (cols-1)/2)*gapX, z: CFG.spawnZ - r*(kind === 'brute' ? 1.3 : 0.9), speed, block: id, seed: Math.random(), hp: 1 }); }
    return;
  }
  for (let i=0;i<n;i++){ const kind = pick(); G.enemies.push({ kind, x: laneX(MID) + rand(-0.8, 0.8), z: CFG.spawnZ - rand(0, 6), speed: ENEMY[kind].speed * D.speedMult * rand(0.9,1.1), seed: Math.random(), hp: 1 }); }
}

// ---------- update ----------
function update(dt){
  const S = G.squad, D = G.D;
  G.elapsed += dt;
  S.formation = formation(S.n);
  const lim = CFG.road.width/2 - S.radius;
  S.target = Math.max(-lim, Math.min(lim, S.target));
  S.x += (S.target - S.x) * Math.min(1, dt*14);
  CAM.lean += ((S.target - S.x)*0.08 - CAM.lean) * 0.15;
  G.scroll += dt * CFG.conveyor * D.speedMult;
  G.recoil = Math.max(0, G.recoil - dt*6);
  if (Math.abs(S.target - S.x) > 0.1 && Math.random() < 0.5) dust(S.x + rand(-S.radius, S.radius), rand(-S.radius, S.radius)*0.8);

  // fire
  const w = WEAPONS[G.weapon];
  G.fireTimer -= dt;
  if (G.fireTimer <= 0 && S.n > 0){
    G.fireTimer = w.interval;
    const shots = w.shots + Math.min(6, Math.floor(Math.sqrt(S.n)/3));
    for (let i=0;i<shots;i++){ const f = shots === 1 ? 0 : (i/(shots-1) - 0.5);
      G.bullets.push({ x: S.x + f*S.radius*1.6, z: CFG.squadZ - 0.6, vx: f*w.spread*CFG.bulletSpeed*2 + rand(-0.9, 0.9), dmg: w.dmg, pierce: w.pierce, splash: w.splash, color: w.color, hit: new Set() }); }
    SFX.shoot(G.weapon); G.recoil = 1; muzzle(S.x, CFG.squadZ - 0.8, w.color, 1.4 + w.dmg*0.12);
  }
  if (G.mech > 0){ G.mech -= dt; G.timers.mech -= dt; if (G.timers.mech <= 0){ G.timers.mech = 0.4;
    for (const off of [-0.5, 0.5]) G.bullets.push({ x: S.x + off, z: CFG.squadZ + 1.2, vx: 0, dmg: 8, pierce: false, splash: 1.8, color: '#b6ff7d', hit: new Set() });
    muzzle(S.x, CFG.squadZ + 1.2, '#b6ff7d', 1.2); } }
  if (G.shield > 0) G.shield -= dt; if (G.rightOpen > 0) G.rightOpen -= dt;
  for (const b of G.bullets){ b.z -= CFG.bulletSpeed*dt; b.x += b.vx*dt; }
  G.bullets = G.bullets.filter(b => b.z > CFG.spawnZ - 4 && !b.dead);

  // conveyor: gates, crates and rocks come down the road
  const conv = CFG.conveyor * D.speedMult, T = G.timers;
  T.plus -= dt; T.mul -= dt; T.weapon -= dt; T.rock -= dt;
  if (T.plus <= 0){ T.plus = D.plusGap; addGate(LEFT, 'add', D.plusValue); }
  if (T.mul <= 0){ T.mul = D.mulGap; addGate(MID, 'mul', Math.random() < 0.8 ? 2 : 4); }
  if (T.weapon <= 0){ T.weapon = D.weaponGap; spawnCrate(); }
  if (T.rock <= 0){ T.rock = D.rockGap; spawnRock(); }
  if (G.rightOpen > 0){ T.jackpot -= dt; if (T.jackpot <= 0){ T.jackpot = D.jackpotGap; Math.random() < 0.25 ? addGate(RIGHT, 'mul', 4) : addGate(RIGHT, 'add', 99); } }
  // the right bridge falls again once its payoff is over
  const rg = G.gaps[1]; if (!rg.open && G.rightOpen <= 0){ rg.collapse += dt; if (rg.collapse > 3){ rg.open = true; rg.built = 0; rg.collapse = 0; floatText(laneX(RIGHT), (GAP.near + GAP.far)/2, 'BRIDGE OUT', '#ff8a8a', 0.7); burst(laneX(RIGHT), (GAP.near + GAP.far)/2, '#c8955a', 16, 0.3); } }

  // bullets into open gaps lay boards
  for (const b of G.bullets){ if (b.dead) continue; const lane = laneOfX(b.x); if (lane === MID) continue;
    if (inGap(lane, b.z)){ b.dead = true; gapHit(G.gaps.find(g => g.lane === lane), b.dmg); if (Math.random() < 0.5) FX.smoke.push({ x: b.x, y: 0.1, z: b.z, vx: rand(-.5,.5), vy: 1, vz: 0, r: 0.15, grow: 0.6, life: 0.3, tint: '#c8955a' }); } }

  // gates
  for (const g of G.gates){
    g.z += conv*dt; if (g.flash > 0) g.flash -= dt;
    if (swallow(g)) continue;
    if (!g.used){
      const spawned = [];
      for (const b of G.bullets){ if (b.dead || laneOfX(b.x) !== g.lane || Math.abs(b.z - g.z) > 0.35) continue;
        if (g.type === 'add'){ b.dead = true; pumpGate(g, b.dmg); continue; }
        b.through = b.through || new Set(); if (b.through.has(g)) continue; b.through.add(g); g.flash = 0.05;
        for (let k=1; k<g.value && G.bullets.length + spawned.length < 500; k++){ const side = (k%2 ? 1 : -1)*Math.ceil(k/2); spawned.push({ ...b, x: b.x + side*0.18, vx: b.vx + side*1.4, hit: new Set(b.hit), through: new Set(b.through) }); } }
      G.bullets.push(...spawned);
      if (g.z >= CFG.squadZ - 0.5){ if (laneOfX(S.x) === g.lane) applyGate(g); g.used = true; }
    }
    if (g.z > CFG.road.near) g.dead = true;
  }
  G.gates = G.gates.filter(g => !g.dead);

  // items
  for (const it of G.items){
    it.z += conv*dt*(it.type === 'rock' ? 0.62 : 1); if (it.flash > 0) it.flash -= dt;
    if (swallow(it)) continue;
    if (it.type === 'rock' && !it.cracked){
      for (const b of G.bullets){ if (b.dead || laneOfX(b.x) !== it.lane || Math.abs(b.z - it.z) > 0.9) continue; b.dead = true; it.hp -= b.dmg; it.flash = 0.05; SFX.chip(); sparks(b.x, b.z, 2, 0.8); if (it.hp <= 0){ crackOpen(it); break; } }
    }
    if (!it.passed && it.z >= CFG.squadZ - 0.5){ it.passed = true;
      if (it.type === 'crate' && laneOfX(S.x) === it.lane) collectCrate(it);
      if (it.type === 'rock' && !it.cracked) floatText(laneX(it.lane), it.z, 'MISSED', '#9fb3c8', 0.5); }
    if (it.z > CFG.road.near || (it.cracked && it.z > CFG.squadZ)) it.dead = true;
  }
  G.items = G.items.filter(it => !it.dead);
  G.bullets = G.bullets.filter(b => !b.dead);

  // waves
  G.waveTimer -= dt; if (G.waveTimer <= 0){ G.waveTimer = D.waveGap; spawnWave(); }
  for (const e of G.enemies){ e.z += e.speed*dt; if (Math.random() < 0.02) dust(e.x, e.z + 0.2, 1); }
  // bullets vs enemies
  for (const b of G.bullets){ if (b.dead) continue;
    for (const e of G.enemies){ if (e.dead || b.hit.has(e)) continue;
      const r = ENEMY[e.kind].radius;
      if (Math.abs(b.x - e.x) < r + 0.1 && Math.abs(b.z - e.z) < r + 0.5){
        killEnemy(e);
        if (b.splash){ explode(b.x, b.z, b.splash, b.color); kick(4); noise(0.2, 0.1, 700); for (const o of G.enemies){ if (!o.dead && Math.hypot(o.x-b.x, o.z-b.z) < b.splash) killEnemy(o); } }
        if (b.pierce) b.hit.add(e); else { b.dead = true; break; }
      } }
  }
  // contact
  for (const e of G.enemies){ if (e.dead) continue;
    if (e.z > CFG.squadZ - 0.8 && Math.abs(e.x - S.x) < S.radius + ENEMY[e.kind].radius){ e.dead = true; if (G.mech > 0){ killEnemy(e); kick(2); } else loseTroops(ENEMY[e.kind].hit, e.x, e.z); }
    if (e.z > CFG.road.near) e.dead = true; }
  G.enemies = G.enemies.filter(e => !e.dead);
  for (const c of G.corpses){ c.x += c.vx*dt; c.y += c.vy*dt; c.z += c.vz*dt; c.vy -= 18*dt; c.rot += c.vr*dt; c.life -= dt; }
  G.corpses = G.corpses.filter(c => c.life > 0);

  fxUpdate(dt, CFG.conveyor*D.speedMult);
  uiSquad(S.n);
}
function gameOver(){ if (G.dead) return; G.dead = true; SFX.lose(); uiGameOver(); }
