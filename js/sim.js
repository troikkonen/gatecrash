// ============================================================
// Simulation — the game, in world units. Nothing in here knows about pixels.
// Step 1: squad, drag control, auto-fire, enemy waves. Gates, gaps, bosses come next.
// ============================================================
const G = {                     // game state
  level: 1, D: null, elapsed: 0, dead: false, paused: true,
  squad: { x: 0, target: 0, n: CFG.startSquad, formation: [] },
  weapon: 0, recoil: 0, fireTimer: 0, waveTimer: 1.5, scroll: 0,
  bullets: [], enemies: [], corpses: [], blockSeq: 0,
};
const rand = (a,b) => a + Math.random()*(b-a);

function startLevel(L){
  G.level = L; G.D = difficulty(L); G.elapsed = 0; G.dead = false;
  G.squad.x = G.squad.target = 0; G.squad.n = CFG.startSquad;
  G.weapon = G.D.startWeapon; G.recoil = 0; G.fireTimer = 0; G.waveTimer = 1.5; G.scroll = 0;
  G.bullets = []; G.enemies = []; G.corpses = [];
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
  G.squad.n -= k; burst(x, z, '#4fc3ff', 8, 0.5); floatText(x, z, '-' + k, '#ff5a5a', 0.7); SFX.hurt(); kick(3 + Math.min(8, k));
  if (G.squad.n <= 0){ G.squad.n = 0; gameOver(); }
}
function killEnemy(e){
  e.dead = true; burst(e.x, e.z, ENEMY[e.kind].color, 4, 0.6); sparks(e.x, e.z, 5); decal(e.x, e.z, 'blood', 0.5 + ENEMY[e.kind].hit*0.2); SFX.kill();
  G.corpses.push({ kind: e.kind, x: e.x, z: e.z, y: 0, vx: rand(-2,2), vy: rand(4,7), vz: rand(2,5), rot: 0, vr: rand(-6,6), life: 0.8 });
}

// ---------- waves: marching blocks in the middle lane ----------
function spawnWave(){
  const D = G.D, n = D.waveSize, shape = Math.random() < 0.7 ? 'block' : 'loose';
  const pick = () => { const r = Math.random(); return r < D.bruteChance ? 'brute' : r < D.bruteChance + D.runnerChance ? 'runner' : 'grunt'; };
  if (shape === 'block'){
    const kind = Math.random() < D.bruteChance ? 'brute' : (Math.random() < D.runnerChance ? 'runner' : 'grunt');
    const cols = kind === 'brute' ? 2 : (n >= 9 ? 4 : 3), id = ++G.blockSeq, speed = ENEMY[kind].speed * D.speedMult, gapX = kind === 'brute' ? 0.9 : 0.55;
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
  G.scroll += dt * 5 * D.speedMult;
  G.recoil = Math.max(0, G.recoil - dt*6);
  if (Math.abs(S.target - S.x) > 0.1 && Math.random() < 0.5) dust(S.x + rand(-S.radius, S.radius), rand(-S.radius, S.radius)*0.8);

  // fire
  const w = WEAPONS[G.weapon];
  G.fireTimer -= dt;
  if (G.fireTimer <= 0 && S.n > 0){
    G.fireTimer = w.interval;
    const shots = w.shots + Math.min(6, Math.floor(Math.sqrt(S.n)/2.5));
    for (let i=0;i<shots;i++){ const f = shots === 1 ? 0 : (i/(shots-1) - 0.5);
      G.bullets.push({ x: S.x + f*S.radius*1.6, z: CFG.squadZ - 0.6, vx: f*w.spread*CFG.bulletSpeed*2, dmg: w.dmg, pierce: w.pierce, splash: w.splash, color: w.color, hit: new Set() }); }
    SFX.shoot(G.weapon); G.recoil = 1; muzzle(S.x, CFG.squadZ - 0.8, w.color, 1.4 + w.dmg*0.12);
  }
  for (const b of G.bullets){ b.z -= CFG.bulletSpeed*dt; b.x += b.vx*dt; }
  G.bullets = G.bullets.filter(b => b.z > CFG.spawnZ - 4 && !b.dead);

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
    if (e.z > CFG.squadZ - 0.8 && Math.abs(e.x - S.x) < S.radius + ENEMY[e.kind].radius){ e.dead = true; loseTroops(ENEMY[e.kind].hit, e.x, e.z); }
    if (e.z > CFG.road.near) e.dead = true; }
  G.enemies = G.enemies.filter(e => !e.dead);
  for (const c of G.corpses){ c.x += c.vx*dt; c.y += c.vy*dt; c.z += c.vz*dt; c.vy -= 18*dt; c.rot += c.vr*dt; c.life -= dt; }
  G.corpses = G.corpses.filter(c => c.life > 0);

  fxUpdate(dt, 5*D.speedMult);
  uiSquad(S.n);
}
function gameOver(){ if (G.dead) return; G.dead = true; SFX.lose(); uiGameOver(); }
