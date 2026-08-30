// ============================================================
// Characters — rigged models (Mixamo Soldier / Xbot, RobotExpressive), cloned into animated pools
// ============================================================
const MODELS = { soldier: 'models/vanguard.glb', zombie: 'models/zombie.glb', mutant: 'models/mutant.glb', robot: 'models/RobotExpressive.glb' };   // add zombie: 'models/zombie.glb' when a Mixamo zombie character lands
// Mixamo animation clips (downloaded "without skin" for the same rig) — retargeted by bone name, rotation tracks only
const CLIPS = { RifleRun: 'models/anims/rifle_run.glb', RifleIdle: 'models/anims/rifle_idle.glb', RifleFire: 'models/anims/rifle_fire.glb', Hit: 'models/anims/hit.glb',
  ZRun: 'models/anims/zombie_run.glb', ZWalk: 'models/anims/zombie_walk.glb', ZAttack: 'models/anims/zombie_attack.glb', ZDeath: 'models/anims/zombie_death.glb', ZCrawl: 'models/anims/running_crawl.glb', };
Object.assign(CLIPS, { MWalk: 'models/anims/m_walk.glb', MPunch: 'models/anims/m_punch.glb', MDeath: 'models/anims/m_death.glb', MIdle: 'models/anims/m_idle.glb', MRoar: 'models/anims/m_roar.glb' });   // Mutant boss clips
const extraClips = {};
function loadClip(name){ return new Promise(res => gltfLoader.load(CLIPS[name], g => { const clip = g.animations[0]; if (clip){ clip.name = name; clip.tracks = clip.tracks.filter(t => !t.name.endsWith('.position')); extraClips[name] = clip; } res(clip); }, undefined, () => res(null))); }
const gltfs = {}, pools = {};
const gltfLoader = new THREE.GLTFLoader();

function loadModel(k){
  return new Promise(res => gltfLoader.load(MODELS[k], g => {
    g.scene.traverse(o => { if (o.isMesh){ o.castShadow = true; o.frustumCulled = false; toPBR(o, k === 'robot' ? { roughness: 0.4, metalness: 0.6 } : { roughness: 0.6, metalness: 0.2 }); } });
    for (const clip of g.animations){ if (clip.name === 'mixamo.com'){ clip.name = 'Move'; clip.tracks = clip.tracks.filter(t => !t.name.endsWith('.position')); } }   // a character's own bundled clip
    gltfs[k] = g; res(g);
  }, undefined, e => { console.warn('model failed', k, e); res(null); }));
}
// A pool of animated clones of one model. Each entry owns a mixer and its actions.
function makePool(k, n, opts){
  const g = gltfs[k]; if (!g) return null;
  const items = [];
  for (let i=0;i<n;i++){
    const obj = THREE.SkeletonUtils.clone(g.scene);
    obj.traverse(o => { if (o.isMesh){ o.material = o.material.clone(); if (opts.color) o.material.color.set(opts.color); if (opts.metal && o.material.isMeshStandardMaterial){ o.material.metalness = 0.85; o.material.roughness = 0.35; o.material.emissive.set(0x2bff7a); o.material.emissiveIntensity = /eye|light|lens|glass/i.test(o.name + (o.material.name||'')) ? 1.5 : 0.08; } if (o.material.isMeshStandardMaterial){ o.material.roughness = Math.min(o.material.roughness, 0.6); o.material.envMapIntensity = 0.55; } } });
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
function poolReset(it){ if (it.cur){ it.cur.stop(); it.cur = null; } }
function poolEnd(p, dt){ for (const it of p.items){ if (!it.used) it.obj.visible = false; else it.mixer.update(dt); } }

let charactersReady = false;
const charactersLoaded = Promise.all([...Object.keys(MODELS).map(loadModel), ...Object.keys(CLIPS).map(loadClip)]).then(() => {
  pools.soldier = makePool('soldier', 36, { scale: 0.62, face: Math.PI, extra: ['RifleRun','RifleIdle','RifleFire','Hit'] });
  const Z = ['ZRun','ZWalk','ZAttack','ZDeath','ZCrawl'], zk = gltfs.zombie ? 'zombie' : 'soldier';
  pools.grunt   = makePool(zk, 34, { scale: 0.62, color: zk === 'zombie' ? null : ENEMY.grunt.color, extra: Z });
  pools.runner  = makePool(zk, 10, { scale: 0.55, color: zk === 'zombie' ? '#c9a06a' : ENEMY.runner.color, extra: Z });
  pools.brute   = makePool(zk, 4, { scale: 0.62, color: null, extra: Z });
  pools.corpse  = makePool(zk, 16, { scale: 0.62, color: zk === 'zombie' ? null : ENEMY.grunt.color, extra: Z });
  pools.bruteCorpse = makePool(zk, 2, { scale: 0.62, color: null, extra: Z });
  pools.boss    = makePool(gltfs.mutant ? 'mutant' : 'robot', 1, { scale: 1, extra: gltfs.mutant ? ['MWalk','MPunch','MDeath','MIdle','MRoar'] : [] });
  pools.boss.mutant = !!gltfs.mutant;
  charactersReady = !!(pools.soldier && pools.grunt && pools.boss);
  return charactersReady;
});
