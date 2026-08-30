// ============================================================
// Main loop — sim update, then draw characters + fx + world
// ============================================================
let lastT = performance.now();

function drawCharacters(dt){
  if (!charactersReady) return;
  const S = G.squad, t = performance.now()/1000, blobs = [];
  // squad
  const p = pools.soldier; poolBegin(p);
  const sc = Math.min(0.62, 0.3 + S.spacing*1.1), moving = Math.abs(S.target - S.x) > 0.1;
  S.formation.slice(0, p.items.length).sort((a,b)=>a[1]-b[1]).forEach(([dx,dz]) => { const it = poolTake(p); if (!it) return;
    it.obj.position.set(S.x + dx, 0.05, CFG.squadZ + dz); it.obj.rotation.set(0, Math.PI + (S.target - S.x)*0.08, G.recoil*0.05); it.obj.scale.setScalar(sc); blobs.push({ x: S.x + dx, z: CFG.squadZ + dz, r: 0.28 });
    play(it, moving ? 'RifleRun' : (G.recoil > 0.35 ? 'RifleFire' : 'RifleIdle'), { speed: moving ? 1.1 + it.seed*0.2 : 1.4 }); });
  poolEnd(p, dt);
  // enemies
  for (const k of ['grunt','runner','brute']) poolBegin(pools[k]);
  for (const e of G.enemies){ const pk = pools[e.kind], it = poolTake(pk); if (!it) continue; const def = ENEMY[e.kind];
    it.obj.position.set(e.x, 0.05, e.z); it.obj.rotation.set(0, Math.sin(t*2 + e.seed*6)*0.06, 0); it.obj.scale.setScalar(def.scale); blobs.push({ x: e.x, z: e.z, r: def.radius });
    const near = e.z > CFG.squadZ - 2.5 && laneOfX(S.x) === MID;
    play(it, near && it.actions.ZAttack ? 'ZAttack' : def.anim, { speed: (e.kind === 'runner' ? 1.4 : e.kind === 'brute' ? 0.9 : 1.2) * G.D.speedMult }); }
  for (const k of ['grunt','runner','brute']) poolEnd(pools[k], dt);
  // corpses: each keeps its own pool slot so its death animation plays through without restarting
  const cp = pools.corpse, live = new Set(G.corpses);
  for (const it of cp.items){ if (it.owner && !live.has(it.owner)){ it.owner = null; } }
  for (const c of G.corpses){ if (c.item && c.item.owner === c) continue;
    const free = cp.items.find(it => !it.owner); if (!free) break; free.owner = c; c.item = free; poolReset(free);
    free.obj.position.set(c.x0, 0.05, c.z0); free.obj.rotation.set(0, 0, 0); free.obj.scale.setScalar(ENEMY[c.kind].scale); play(free, free.actions.ZDeath ? 'ZDeath' : 'sad_pose', { once: !!free.actions.ZDeath, speed: 1.7 }); }
  for (const it of cp.items){ it.obj.visible = !!it.owner; if (it.owner) it.mixer.update(dt); }
  // mech walker behind the squad
  poolBegin(pools.mech);
  if (G.mech > 0){ const it = poolTake(pools.mech); it.obj.position.set(S.x, 0.05, CFG.squadZ + 1.6); it.obj.rotation.set(0, Math.PI, 0); it.obj.scale.setScalar(0.7); play(it, moving ? 'Walking' : 'Idle', { speed: 1.2 });
    FX.texts.push({ x: S.x, z: CFG.squadZ + 2.6, y: 0.2, str: '▮'.repeat(Math.max(1, Math.round(12*Math.min(1, G.mech/30)))), color: '#b6ff7d', size: 0.22, life: 0.01 }); }
  poolEnd(pools.mech, dt);
  if (G.boss) blobs.push({ x: G.boss.x, z: G.boss.z, r: 1.4*G.boss.scale });
  if (G.mech > 0) blobs.push({ x: S.x, z: CFG.squadZ + 1.6, r: 0.9 });
  blobsDraw(blobs);
  // block counters
  const fronts = {};
  for (const e of G.enemies){ if (!e.block) continue; const f = fronts[e.block] || (fronts[e.block] = { n: 0, z: -999 }); f.n++; if (e.z > f.z) f.z = e.z; }
  for (const id in fronts){ const f = fronts[id]; if (f.n >= 2) FX.texts.push({ x: laneX(MID), z: f.z + 0.9, y: 0.15, str: String(f.n), color: '#fff', size: 0.55, life: 0.01 }); }
}

function frame(now){
  let dt = Math.min(0.033, (now - lastT)/1000); lastT = now;
  if (G.intro > 0){ G.intro -= dt; dt *= 0.12; }
  const run = !G.paused && !G.dead;
  if (run) update(dt);
  const S = G.squad, w = WEAPONS[G.weapon];
  muzzleLight.position.set(S.x, 1.1, CFG.squadZ - 0.8); muzzleLight.color.set(w.color); muzzleLight.intensity = G.recoil*2.2;
  drawCharacters(run ? dt : 0);
  drawProps(); drawTelegraphs(); if (charactersReady) drawBoss(run ? dt : 0);
  uiIntro();
  fxDraw(G.bullets);
  worldUpdate(dt, now/1000, G.scroll);
  composer.render();
  requestAnimationFrame(frame);
}
charactersLoaded.then(ok => { if (ok) uiTitleInfo(); else $('titleBest').textContent = 'Models failed to load — check the connection.'; $('playBtn').disabled = !ok; });
requestAnimationFrame(frame);
