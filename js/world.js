// ============================================================
// World — renderer, camera, lighting, road, scenery
// ============================================================
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.LinearEncoding;   // the composer's final pass converts to sRGB
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;

const scene = new THREE.Scene();
// image-based lighting: a neutral room baked into an environment map gives metal and armor real highlights
const pmrem = new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader();
scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 150);
const CAM = { pos: new THREE.Vector3(0, 7.8, 6.8), look: new THREE.Vector3(0, 0.6, -7.5), lean: 0, shake: 0 };   // close and low: characters fill the screen, the fight is in front of you
function resize(){ renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------- sky + fog ----------
const SKY_TOP = 0x2c3d5e, SKY_HORIZON = 0xc98f6e;   // dusk
scene.fog = new THREE.Fog(0x9d8577, 22, 48);
const skyGeo = new THREE.SphereGeometry(120, 24, 12);
const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(SKY_TOP) }, bottom: { value: new THREE.Color(SKY_HORIZON) } },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*2.2 + 0.1, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0); }' });
scene.add(new THREE.Mesh(skyGeo, skyMat));

// ---------- lights ----------
scene.add(new THREE.HemisphereLight(0x8fa0c4, 0x3a2f2a, 0.35));
const sun = new THREE.DirectionalLight(0xffc48a, 1.5);   // low warm sun
sun.position.set(-14, 11, 8); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.08;
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 10, bottom: -36, near: 1, far: 60 });
sun.target.position.set(0, 0, -10); scene.add(sun, sun.target);

// ---------- environment map: a small lit room baked with PMREM, so metals and armor have something to reflect ----------
(function env(){
  const pmrem = new THREE.PMREMGenerator(renderer); pmrem.compileEquirectangularShader();
  const room = new THREE.Scene(); room.background = new THREE.Color(0x9fb0c4);
  const box = new THREE.Mesh(new THREE.BoxGeometry(60, 30, 60), new THREE.MeshStandardMaterial({ color: 0x6d7d90, side: THREE.BackSide })); room.add(box);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x2b3038 })); floor.rotation.x = -Math.PI/2; floor.position.y = -14; room.add(floor);
  for (const [x, z, c] of [[-15, 0, 0xfff1dc], [15, 8, 0xdfe8ff], [0, -20, 0xffffff]]){ const l = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshBasicMaterial({ color: c })); l.position.set(x, 12, z); l.lookAt(0, 0, 0); room.add(l); }
  room.add(new THREE.AmbientLight(0xffffff, 0.6));
  scene.environment = pmrem.fromScene(room, 0.04).texture; pmrem.dispose();
})();
// upgrade any material to PBR, keeping its map and color
function toPBR(o, opts={}){
  if (!o.isMesh) return; const m = o.material; if (m.isMeshStandardMaterial) return;
  const n = new THREE.MeshStandardMaterial({ map: m.map || null, color: m.color ? m.color.clone() : 0xffffff, roughness: opts.roughness ?? 0.55, metalness: opts.metalness ?? 0.25, skinning: !!m.skinning, morphTargets: !!m.morphTargets, transparent: m.transparent, opacity: m.opacity, side: m.side });
  if (m.normalMap) n.normalMap = m.normalMap; if (m.emissive) n.emissive = m.emissive.clone(); n.envMapIntensity = 0.9; o.material = n;
}

// ---------- textures ----------
const texLoader = new THREE.TextureLoader();
function loadTex(url, opts={}){ const t = texLoader.load(url); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; if (opts.repeat){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...opts.repeat); } return t; }
const roadTex = loadTex('assets/road.jpg', { repeat: [1, 8] }); roadTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
const forestTex = loadTex('assets/forest.jpg', { repeat: [4, 4] }); forestTex.wrapS = forestTex.wrapT = THREE.MirroredRepeatWrapping;

// ---------- ground + road ----------
const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ map: forestTex, color: 0x8e9cae, roughness: 1, envMapIntensity: 0.2 }));
ground.rotation.x = -Math.PI/2; ground.position.set(0, -5, -20); scene.add(ground);

const R = CFG.road;
const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, color: 0xb0b4bc, roughness: 0.92, metalness: 0.05 });
function roadStrip(x, z0, z1, w){ const m = new THREE.Mesh(new THREE.PlaneGeometry(w, z0 - z1), roadMat); m.rotation.x = -Math.PI/2; m.position.set(x, 0.05, (z0 + z1)/2); m.receiveShadow = true; scene.add(m); return m; }
// the road bed: a thick slab so the edges read as a bridge deck
const deck = new THREE.Mesh(new THREE.BoxGeometry(R.width + 0.6, 0.8, R.near - R.far), new THREE.MeshStandardMaterial({ color: 0x4b4f57, roughness: 0.85, envMapIntensity: 0.3 }));
deck.position.set(0, -0.45, (R.near + R.far)/2); deck.receiveShadow = true; scene.add(deck);
const roadSurfaces = [0,1,2].map(l => roadStrip(laneX(l), R.near, R.far, CFG.laneW + 0.02));
// lane lines, edge rails
const lineMat = new THREE.MeshBasicMaterial({ color: 0xeef2f7 });
for (const x of [-CFG.laneW/2, CFG.laneW/2]){ const l = new THREE.Mesh(new THREE.PlaneGeometry(0.07, R.near - R.far), lineMat); l.rotation.x = -Math.PI/2; l.position.set(x, 0.065, (R.near + R.far)/2); scene.add(l); }
const railMat = new THREE.MeshStandardMaterial({ color: 0x8b93a0, roughness: 0.35, metalness: 0.85 });
for (const x of [-R.width/2 - 0.1, R.width/2 + 0.1]){
  const r = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, R.near - R.far), railMat); r.position.set(x, 0.75, (R.near + R.far)/2); r.castShadow = true; scene.add(r);
  for (let z = R.near; z > R.far; z -= 3){ const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), railMat); p.position.set(x, 0.4, z); scene.add(p); }
}

// ---------- scenery: pines, dead trees, boulders, ridge, roadside wreckage, lamp posts ----------
(function scenery(){
  const d = new THREE.Object3D();
  const place = (im, i, x, y, z, s, ry) => { d.position.set(x, y, z); d.rotation.set(0, ry, 0); d.scale.setScalar(s); d.updateMatrix(); im.setMatrixAt(i, d.matrix); };
  // pines: three stacked cones on a trunk, dark blue-green so the road stays the bright thing
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 1.6, 6); trunkGeo.translate(0, 0.8, 0);
  const c1 = new THREE.ConeGeometry(1.3, 2.4, 7); c1.translate(0, 2.4, 0);
  const c2 = new THREE.ConeGeometry(1.0, 2.0, 7); c2.translate(0, 3.6, 0);
  const c3 = new THREE.ConeGeometry(0.65, 1.6, 7); c3.translate(0, 4.7, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 1, envMapIntensity: 0.2 });
  const pineMat = new THREE.MeshStandardMaterial({ color: 0x14301f, roughness: 0.95, envMapIntensity: 0.25 });
  const N = 150, trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, N), a1 = new THREE.InstancedMesh(c1, pineMat, N), a2 = new THREE.InstancedMesh(c2, pineMat, N), a3 = new THREE.InstancedMesh(c3, pineMat, N);
  a1.castShadow = a2.castShadow = true;
  for (let i=0;i<N;i++){ const side = i%2 ? 1 : -1, z = R.near + 4 - Math.random()*(R.near - R.far + 14), x = side*(R.width/2 + 2.4 + Math.random()*11), s = 0.6 + Math.random()*1.0, ry = Math.random()*6.28, y = -0.6 - Math.random()*1.4;
    for (const im of [trunks, a1, a2, a3]) place(im, i, x, y, z, s, ry); }
  scene.add(trunks, a1, a2, a3);
  // dead trees: bare trunks with a branch
  const deadGeo = new THREE.CylinderGeometry(0.06, 0.16, 3.2, 5); deadGeo.translate(0, 1.6, 0);
  const branchGeo = new THREE.CylinderGeometry(0.03, 0.06, 1.3, 4); branchGeo.translate(0, 0.65, 0); branchGeo.rotateZ(0.8); branchGeo.translate(0.1, 2.0, 0);
  const deadMat = new THREE.MeshStandardMaterial({ color: 0x2a2320, roughness: 1 });
  const ND = 30, dead = new THREE.InstancedMesh(deadGeo, deadMat, ND), branches = new THREE.InstancedMesh(branchGeo, deadMat, ND);
  for (let i=0;i<ND;i++){ const side = i%2 ? 1 : -1, z = R.near - Math.random()*(R.near - R.far), x = side*(R.width/2 + 1.6 + Math.random()*4), s = 0.7 + Math.random()*0.8, ry = Math.random()*6.28; place(dead, i, x, -0.4, z, s, ry); place(branches, i, x, -0.4, z, s, ry); }
  scene.add(dead, branches);
  // boulders
  const rockGeo = new THREE.IcosahedronGeometry(0.8, 1); const pos = rockGeo.attributes.position; for (let i=0;i<pos.count;i++){ const k = 0.8 + Math.random()*0.4; pos.setXYZ(i, pos.getX(i)*k, pos.getY(i)*k*0.7, pos.getZ(i)*k); } rockGeo.computeVertexNormals();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4d4a48, roughness: 0.95, flatShading: true, envMapIntensity: 0.3 });
  const NR = 40, rocks = new THREE.InstancedMesh(rockGeo, rockMat, NR); rocks.castShadow = true;
  for (let i=0;i<NR;i++){ const side = i%2 ? 1 : -1, z = R.near - Math.random()*(R.near - R.far), x = side*(R.width/2 + 1.2 + Math.random()*6), s = 0.5 + Math.random()*1.6; place(rocks, i, x, -0.9 + s*0.2, z, s, Math.random()*6.28); }
  scene.add(rocks);
  // distant ridge lines
  const mkRidge = (color, y, z, sx) => { const sh = new THREE.Shape(); sh.moveTo(-120, -10); let rx = -120; while (rx < 120){ rx += 6 + Math.random()*10; sh.lineTo(rx, 4 + Math.random()*11); } sh.lineTo(120, -10); sh.lineTo(-120, -10);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color })); m.position.set(0, y, z); m.scale.set(sx, 1, 1); scene.add(m); };
  mkRidge(0x3a3f55, -3, R.far - 32, 1); mkRidge(0x2a2e40, -1, R.far - 48, 1.3);
  // roadside wreckage on the deck edge: concrete barriers and barrels, some knocked over
  const barMat = new THREE.MeshStandardMaterial({ color: 0x8b8a86, roughness: 0.9 }), barrelMat = new THREE.MeshStandardMaterial({ color: 0x8a3b2a, roughness: 0.6, metalness: 0.4 });
  const barGeo = new THREE.BoxGeometry(0.5, 0.7, 1.6); barGeo.translate(0, 0.35, 0);
  const barrelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.9, 10); barrelGeo.translate(0, 0.45, 0);
  const NB = 18, bars = new THREE.InstancedMesh(barGeo, barMat, NB), barrels = new THREE.InstancedMesh(barrelGeo, barrelMat, 10); bars.castShadow = barrels.castShadow = true;
  for (let i=0;i<NB;i++){ const side = i%2 ? 1 : -1, z = R.near - 2 - i*2.6 - Math.random()*1.5, x = side*(R.width/2 + 0.75); d.position.set(x, -0.35, z); d.rotation.set(Math.random() < 0.2 ? 0.6*side : 0, Math.random()*0.3 - 0.15, Math.random() < 0.15 ? 1.4*side : 0); d.scale.setScalar(1); d.updateMatrix(); bars.setMatrixAt(i, d.matrix); }
  for (let i=0;i<10;i++){ const side = i%2 ? 1 : -1, z = R.near - 5 - i*4.4 - Math.random()*2, x = side*(R.width/2 + 0.7); const over = Math.random() < 0.4; d.position.set(x, over ? -0.05 : -0.4, z); d.rotation.set(over ? Math.PI/2 : 0, Math.random()*3, over ? 0.3 : 0); d.scale.setScalar(1); d.updateMatrix(); barrels.setMatrixAt(i, d.matrix); }
  scene.add(bars, barrels);
  // lamp posts with glowing heads (bloom catches them)
  const postGeo = new THREE.CylinderGeometry(0.05, 0.07, 3.4, 6); postGeo.translate(0, 1.7, 0);
  const headGeo = new THREE.BoxGeometry(0.5, 0.14, 0.24); headGeo.translate(0.22, 3.4, 0);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3f48, metalness: 0.7, roughness: 0.4 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffd08a, emissiveIntensity: 2.2 });
  const NL = 10, posts = new THREE.InstancedMesh(postGeo, postMat, NL), heads = new THREE.InstancedMesh(headGeo, headMat, NL);
  for (let i=0;i<NL;i++){ const side = i%2 ? 1 : -1, z = R.near - 4 - i*4.6, x = side*(R.width/2 + 0.35); d.position.set(x, 0, z); d.rotation.set(0, side > 0 ? Math.PI : 0, 0); d.scale.setScalar(1); d.updateMatrix(); posts.setMatrixAt(i, d.matrix); heads.setMatrixAt(i, d.matrix); }
  scene.add(posts, heads);
  for (const z of [-4, -13]){ const l = new THREE.PointLight(0xffc880, 0.9, 12, 2); l.position.set(0, 3.2, z); scene.add(l); }
  // tire tracks worn into the middle lane
  const trackMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false });
  for (const x of [-0.55, 0.55]){ const t = new THREE.Mesh(new THREE.PlaneGeometry(0.35, R.near - R.far), trackMat); t.rotation.x = -Math.PI/2; t.position.set(x, 0.062, (R.near + R.far)/2); scene.add(t); }
})();

// ---------- mist drifting over the road ----------
function radialTex(inner, outer, size=128){ const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); const r = g.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2); r.addColorStop(0, inner); r.addColorStop(1, outer); g.fillStyle = r; g.fillRect(0,0,size,size); return new THREE.CanvasTexture(c); }
const mistTex = radialTex('rgba(215,224,236,.5)', 'rgba(215,224,236,0)');
const MIST = Array.from({length: 6}, (_, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, opacity: 0.28, depthWrite: false })); m.rotation.x = -Math.PI/2; m.position.y = 0.4 + i*0.06; m.userData = { x: Math.random(), z: R.far + 8 + i*7, w: 9 + Math.random()*6, v: 0.15 + Math.random()*0.25 }; scene.add(m); return m; });

// ---------- post-processing: bloom for anything emissive, then a vignette + grade ----------
const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));
const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.5, 0.86); composer.addPass(bloom);
const gradePass = new THREE.ShaderPass({
  uniforms: { tDiffuse: { value: null }, vig: { value: 0.35 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float vig; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5, 0.45)); c.rgb *= 1.0 - smoothstep(0.45, 0.95, d)*vig;      // vignette
      c.rgb = mix(c.rgb, c.rgb*vec3(1.02, 1.0, 1.06), 0.5);                                         // cool grade
      c.rgb = (c.rgb - 0.5)*1.12 + 0.5;                                                              // contrast
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114)); c.rgb = mix(vec3(l), c.rgb, 1.15);            // saturation
      c.rgb = pow(max(c.rgb, 0.0), vec3(1.0/2.2));                                                  // linear -> sRGB
      gl_FragColor = c; }` });
composer.addPass(gradePass);
function resizePost(){ composer.setSize(window.innerWidth, window.innerHeight); bloom.setSize(window.innerWidth, window.innerHeight); }
addEventListener('resize', resizePost); resizePost();

// ---------- quality: high = bloom + shadows + full res; low = none of that. Auto-drops on a slow phone. ----------
const QUALITY = { level: localStorage.getItem('gc_quality') || 'high', auto: !localStorage.getItem('gc_quality') };
function setQuality(level, manual){
  QUALITY.level = level; if (manual){ QUALITY.auto = false; localStorage.setItem('gc_quality', level); }
  const high = level === 'high';
  renderer.shadowMap.enabled = high; sun.castShadow = high;
  renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio || 1, 1.75) : 1);
  bloom.enabled = high; resize(); resizePost();
  scene.traverse(o => { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
  const b = document.getElementById('qual'); if (b) b.textContent = high ? 'Quality: High' : 'Quality: Low';
}
function worldUpdate(dt, t, scroll){
  roadTex.offset.y = (scroll / ((CFG.road.near - CFG.road.far)/12)) % 1;   // texture repeats 12× over the road; scroll is in world units, toward the player
  for (const m of MIST){ const u = m.userData; u.x += u.v*dt*0.05; m.position.x = ((u.x % 1.4) - 0.7)*R.width*2.2; m.position.z = u.z + Math.sin(t*0.2 + u.z)*1.5; m.scale.set(u.w, 3.2, 1); }
  // camera: lean into the drag, shake on hits
  camera.up.set(Math.sin(CAM.lean*0.35), Math.cos(CAM.lean*0.35), 0);
  camera.position.copy(CAM.pos);
  if (CAM.shake > 0){ camera.position.x += (Math.random()-0.5)*CAM.shake*0.06; camera.position.y += (Math.random()-0.5)*CAM.shake*0.04; CAM.shake = Math.max(0, CAM.shake - dt*40); }
  camera.lookAt(CAM.look);
}
function kick(k){ CAM.shake = Math.min(18, CAM.shake + k); }
