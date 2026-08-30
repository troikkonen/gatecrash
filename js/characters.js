// ============================================================
// Characters — rigged models (Mixamo Soldier / Xbot, RobotExpressive), cloned into animated pools
// ============================================================
const MODELS = { soldier: 'models/vanguard.glb', xbot: 'models/Xbot.glb', robot: 'models/RobotExpressive.glb' };
// Mixamo animation clips (downloaded "without skin" for the same rig) — retargeted by bone name, rotation tracks only
const CLIPS = { RifleRun: 'models/anims/rifle_run.glb', RifleIdle: 'models/anims/rifle_idle.glb', RifleFire: 'models/anims/rifle_fire.glb', Hit: 'models/anims/hit.glb' };
const extraClips = {};
function loadClip(name){ return new Promise(res => gltfLoader.load(CLIPS[name], g => { const clip = g.animations[0]; if (clip){ clip.name = name; clip.tracks = clip.tracks.filter(t => !t.name.endsWith('.position')); extraClips[name] = clip; } res(clip); }, undefined, () => res(null))); }
const gltfs = {}, pools = {};
const gltfLoader = new THREE.GLTFLoader();

function loadModel(k){
  return new Promise(res => gltfLoader.load(MODELS[k], g => {
    g.scene.traverse(o => { if (o.isMesh){ o.castShadow = true; o.frustumCulled = false; toPBR(o, k === 'robot' ? { roughness: 0.4, metalness: 0.6 } : { roughness: 0.6, metalness: 0.2 }); } });
    gltfs[k] = g; res(g);
  }, undefined, e => { console.warn('model failed', k, e); res(null); }));
}
// A pool of animated clones of one model. Each entry owns a mixer and its actions.
function makePool(k, n, opts){
  const g = gltfs[k]; if (!g) return null;
  const items = [];
  for (let i=0;i<n;i++){
    const obj = THREE.SkeletonUtils.clone(g.scene);
    obj.traverse(o => { if (o.isMesh){ o.material = o.material.clone(); if (opts.color) o.material.color.set(opts.color); if (o.material.isMeshStandardMaterial){ o.material.roughness = Math.min(o.material.roughness, 0.6); o.material.envMapIntensity = 0.55; } } });
    const mixer = new THREE.AnimationMixer(obj), actions = {};
    for (const clip of g.animations) actions[clip.name] = mixer.clipAction(clip);
    if (opts.extra) for (const n of opts.extra){ if (extraClips[n]) actions[n] = mixer.clipAction(extraClips[n]); }
    obj.visible = false; scene.add(obj);
    items.push({ obj, mixer, actions, cur: null, seed: Math.random(), used: false });
  }
  return { items, opts, k };
}
function play(it, name, o={}){
  const a = it.actions[name]; if (!a) return;
  if (it.cur !== a){ if (it.cur) it.cur.fadeOut(0.15); a.reset(); a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = !!o.once; a.fadeIn(0.12).play(); it.cur = a; }
  a.timeScale = o.speed || 1;
}
function flash(it, on){ it.obj.traverse(o => { if (o.isMesh){ o.material.emissive.set(on ? 0xffffff : 0x000000); o.material.emissiveIntensity = on ? 0.6 : 0; } }); }
// per-frame pool bookkeeping: call begin() before placing, end() hides what wasn't used
function poolBegin(p){ for (const it of p.items) it.used = false; p.n = 0; }
function poolTake(p){ if (p.n >= p.items.length) return null; const it = p.items[p.n++]; it.used = true; it.obj.visible = true; return it; }
function poolEnd(p, dt){ for (const it of p.items){ if (!it.used) it.obj.visible = false; else it.mixer.update(dt); } }

let charactersReady = false;
const charactersLoaded = Promise.all([...['soldier','xbot','robot'].map(loadModel), ...Object.keys(CLIPS).map(loadClip)]).then(() => {
  pools.soldier = makePool('soldier', 36, { scale: 0.62, face: Math.PI, extra: ['RifleRun','RifleIdle','RifleFire','Hit'] });
  pools.grunt   = makePool('xbot', 34, { scale: 0.62, color: ENEMY.grunt.color });
  pools.runner  = makePool('xbot', 10, { scale: 0.55, color: ENEMY.runner.color });
  pools.brute   = makePool('xbot', 8,  { scale: 1.0,  color: ENEMY.brute.color });
  pools.corpse  = makePool('xbot', 16, { scale: 0.62, color: '#b42020' });
  pools.boss    = makePool('robot', 1, { scale: 1 });
  pools.mech    = makePool('robot', 1, { scale: 0.7, color: '#5a8f3a' });
  charactersReady = !!(pools.soldier && pools.grunt && pools.boss);
  return charactersReady;
});
