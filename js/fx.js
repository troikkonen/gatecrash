// ============================================================
// FX — bullets, particles, smoke, decals, road light pools, floating text. Everything pooled or instanced.
// ============================================================
const FX = { particles: [], smoke: [], decals: [], texts: [], glows: [] };
const _d = new THREE.Object3D(), _c = new THREE.Color();
const CAM_PITCH = -0.7;

function instanced(geo, mat, n){ const im = new THREE.InstancedMesh(geo, mat, n); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; im.frustumCulled = false; scene.add(im); return im; }
const softTex = radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 64);
const bulletMesh = instanced(new THREE.PlaneGeometry(0.14, 1), new THREE.MeshBasicMaterial({ map: softTex, color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }), 520);
const sparkMesh  = instanced(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softTex, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }), 600);
const smokeMesh  = instanced(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTex('rgba(90,90,100,.9)', 'rgba(90,90,100,0)'), transparent: true, opacity: 0.45, depthWrite: false }), 250);
function decalTex(kind){
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  if (kind === 'blood'){ g.fillStyle = '#5a0f0f'; for (let i=0;i<7;i++){ const a = i*0.9, rr = 14 + 12*Math.sin(i*2.3); g.beginPath(); g.ellipse(64 + Math.cos(a)*22, 64 + Math.sin(a)*22, rr, rr*0.7, a, 0, Math.PI*2); g.fill(); } }
  else if (kind === 'scorch'){ const r = g.createRadialGradient(64,64,0,64,64,64); r.addColorStop(0,'rgba(12,10,8,.95)'); r.addColorStop(0.55,'rgba(25,20,16,.55)'); r.addColorStop(1,'rgba(25,20,16,0)'); g.fillStyle = r; g.fillRect(0,0,128,128); }
  else { g.strokeStyle = '#141519'; g.lineWidth = 4; for (let i=0;i<7;i++){ const a = i*0.9; let x = 64, y = 64; g.beginPath(); g.moveTo(x,y); for (let k=0;k<3;k++){ x += Math.cos(a + k*0.5)*18; y += Math.sin(a + k*0.5)*18; g.lineTo(x,y); } g.stroke(); } }
  return new THREE.CanvasTexture(c);
}
const decalMesh = {};
for (const k of ['blood','scorch','crack']) decalMesh[k] = instanced(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({ map: decalTex(k), transparent: true, depthWrite: false }), 40);
const blobMesh = instanced(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({ map: radialTex('rgba(0,0,0,.55)', 'rgba(0,0,0,0)', 64), transparent: true, depthWrite: false }), 200);
function blobsDraw(list){ blobMesh.count = 0; for (const b of list){ if (blobMesh.count >= 200) break; _d.position.set(b.x, 0.06, b.z); _d.rotation.set(-Math.PI/2, 0, 0); _d.scale.set(b.r*2, b.r*1.6, 1); _d.updateMatrix(); blobMesh.setMatrixAt(blobMesh.count++, _d.matrix); } blobMesh.instanceMatrix.needsUpdate = true; }
const glowPool = Array.from({length: 12}, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({ map: softTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI/2; m.visible = false; scene.add(m); return m; });
const muzzleLight = new THREE.PointLight(0xffd447, 0, 9, 2); scene.add(muzzleLight);
const fxLights = Array.from({length: 3}, () => { const l = new THREE.PointLight(0xffffff, 0, 10, 2); scene.add(l); return l; });

// floating text sprites
const textCache = new Map();
function textTex(str, color, size=64, stroke='rgba(0,0,0,.75)'){
  const key = str + '|' + color + '|' + size; if (textCache.has(key)) return textCache.get(key);
  const c = document.createElement('canvas'); const g = c.getContext('2d'); g.font = `900 ${size}px system-ui, sans-serif`;
  c.width = Math.max(4, Math.ceil(g.measureText(str).width) + size*0.6); c.height = size*1.5;
  g.font = `900 ${size}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = size*0.16; g.strokeStyle = stroke; g.strokeText(str, c.width/2, c.height/2); g.fillStyle = color; g.fillText(str, c.width/2, c.height/2);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.minFilter = THREE.LinearFilter;
  if (textCache.size > 300) textCache.clear(); textCache.set(key, t); return t;
}
const textPool = Array.from({length: 40}, () => { const t = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true })); t.visible = false; scene.add(t); return t; });

// ---------- spawners (called by the sim) ----------
const rnd = (a,b) => a + Math.random()*(b-a);
function burst(x, z, color, k=8, y=0.4){ for (let i=0;i<k;i++) FX.particles.push({ x, y, z, vx: rnd(-4,4), vy: rnd(1,6), vz: rnd(-3,3), life: rnd(.3,.6), size: 0.2, color, grav: true }); }
function sparks(x, z, k=5, y=0.5){ for (let i=0;i<k;i++) FX.particles.push({ x, y, z, vx: rnd(-7,7), vy: rnd(-2,5), vz: rnd(-7,7), life: rnd(.12,.25), size: 0.12, color: i%2 ? '#fff6c0' : '#ffd447' }); }
function dust(x, z, k=3, y=0.05){ for (let i=0;i<k;i++) FX.smoke.push({ x: x + rnd(-.3,.3), y, z: z + rnd(-.3,.3), vx: rnd(-.6,.6), vy: rnd(.4,1), vz: rnd(-.6,.6), r: rnd(.15,.3), grow: 0.9, life: rnd(.3,.5), tint: '#c8b89a' }); }
function explode(x, z, r, color){
  FX.glows.push({ x, z, r: r*1.6, color, life: 0.25, max: 0.25, light: true });
  for (let i=0;i<7;i++) FX.smoke.push({ x: x + rnd(-r*.3, r*.3), y: 0.3, z: z + rnd(-r*.3, r*.3), r: rnd(.3,.6), vx: rnd(-1,1), vy: rnd(1,2.5), vz: rnd(-1,1), grow: 1.2, life: rnd(.6,1.1), tint: '#6b6b76' });
  burst(x, z, color, 14, 0.6); sparks(x, z, 8, 0.6); decal(x, z, 'scorch', r*0.7);
}
function decal(x, z, kind, r){ FX.decals.push({ x, z, kind, r, life: 9, rot: Math.random()*6.3 }); if (FX.decals.length > 70) FX.decals.shift(); }
function floatText(x, z, str, color, size=0.8, y=1.2){ FX.texts.push({ x, z, y, str, color, size, life: 1 }); }
function muzzle(x, z, color, r){ FX.glows.push({ x, z, r, color, life: 0.08, max: 0.08 }); }

// ---------- per-frame ----------
function fxUpdate(dt, scrollV){
  for (const p of FX.particles){ p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt; if (p.grav) p.vy -= 14*dt; if (p.y < 0.05) p.y = 0.05; p.life -= dt; }
  FX.particles = FX.particles.filter(p => p.life > 0);
  for (const m of FX.smoke){ m.x += m.vx*dt; m.y += m.vy*dt; m.z += m.vz*dt; m.r += m.grow*dt; m.life -= dt; }
  FX.smoke = FX.smoke.filter(m => m.life > 0);
  for (const d of FX.decals){ d.z += scrollV*dt; d.life -= dt; } FX.decals = FX.decals.filter(d => d.life > 0 && d.z < CFG.road.near);
  for (const t of FX.texts){ t.y += 1.4*dt; t.life -= dt*0.8; } FX.texts = FX.texts.filter(t => t.life > 0);
  for (const g of FX.glows) g.life -= dt; FX.glows = FX.glows.filter(g => g.life > 0);
}
function fxDraw(bullets){
  // bullets
  bulletMesh.count = 0;
  for (const b of bullets){ if (bulletMesh.count >= 520) break; const len = b.pierce ? 2.4 : b.splash ? 0.9 : 1.2;
    _d.position.set(b.x, 0.75, b.z + len/2); _d.rotation.set(-Math.PI/2, 0, -b.vx*0.02); _d.scale.set(b.pierce ? 1.8 : b.splash ? 2.4 : 1, len, 1); _d.updateMatrix();
    bulletMesh.setMatrixAt(bulletMesh.count, _d.matrix); bulletMesh.setColorAt(bulletMesh.count, _c.set(b.color)); bulletMesh.count++; }
  bulletMesh.instanceMatrix.needsUpdate = true; if (bulletMesh.instanceColor) bulletMesh.instanceColor.needsUpdate = true;
  // particles
  sparkMesh.count = 0;
  for (const p of FX.particles){ if (sparkMesh.count >= 600) break; _d.position.set(p.x, p.y, p.z); _d.rotation.set(CAM_PITCH, 0, 0); _d.scale.setScalar(p.size); _d.updateMatrix(); sparkMesh.setMatrixAt(sparkMesh.count, _d.matrix); sparkMesh.setColorAt(sparkMesh.count, _c.set(p.color)); sparkMesh.count++; }
  sparkMesh.instanceMatrix.needsUpdate = true; if (sparkMesh.instanceColor) sparkMesh.instanceColor.needsUpdate = true;
  smokeMesh.count = 0;
  for (const m of FX.smoke){ if (smokeMesh.count >= 250) break; _d.position.set(m.x, m.y, m.z); _d.rotation.set(CAM_PITCH, 0, 0); _d.scale.setScalar(m.r*2); _d.updateMatrix(); smokeMesh.setMatrixAt(smokeMesh.count, _d.matrix); smokeMesh.setColorAt(smokeMesh.count, _c.set(m.tint)); smokeMesh.count++; }
  smokeMesh.instanceMatrix.needsUpdate = true; if (smokeMesh.instanceColor) smokeMesh.instanceColor.needsUpdate = true;
  // decals
  for (const k in decalMesh) decalMesh[k].count = 0;
  for (const d of FX.decals){ const im = decalMesh[d.kind]; if (im.count >= 40) continue; _d.position.set(d.x, 0.07, d.z); _d.rotation.set(-Math.PI/2, 0, d.rot); _d.scale.set(d.r*2, d.r*1.6, 1); _d.updateMatrix(); im.setMatrixAt(im.count++, _d.matrix); }
  for (const k in decalMesh) decalMesh[k].instanceMatrix.needsUpdate = true;
  // glows + point lights
  glowPool.forEach(g => g.visible = false); let gi = 0, li = 0;
  fxLights.forEach(l => l.intensity = 0);
  for (const g of FX.glows){ if (gi < glowPool.length){ const m = glowPool[gi++]; m.position.set(g.x, 0.08, g.z); m.scale.set(g.r*2, g.r*1.3, 1); m.material.color.set(g.color); m.material.opacity = 0.55*(g.life/g.max); m.visible = true; }
    if (g.light && li < fxLights.length){ const l = fxLights[li++]; l.position.set(g.x, 1.2, g.z); l.color.set(g.color); l.intensity = 3*(g.life/g.max); } }
  // text
  textPool.forEach(t => t.visible = false);
  FX.texts.slice(0, textPool.length).forEach((t, i) => { const s = textPool[i], tx = textTex(t.str, t.color); s.material.map = tx; s.material.opacity = Math.min(1, t.life*1.5); s.material.needsUpdate = true; s.scale.set(t.size*tx.image.width/tx.image.height, t.size, 1); s.position.set(t.x, t.y, t.z); s.visible = true; });
}
