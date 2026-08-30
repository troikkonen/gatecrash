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
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 150);
const CAM = { pos: new THREE.Vector3(0, 10.5, 11.5), look: new THREE.Vector3(0, 0.2, -9), lean: 0, shake: 0 };
function resize(){ renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------- sky + fog ----------
const SKY_TOP = 0x5c7ba3, SKY_HORIZON = 0xb9c6d6;
scene.fog = new THREE.Fog(SKY_HORIZON, 34, 78);
const skyGeo = new THREE.SphereGeometry(120, 24, 12);
const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(SKY_TOP) }, bottom: { value: new THREE.Color(SKY_HORIZON) } },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*2.2 + 0.1, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0); }' });
scene.add(new THREE.Mesh(skyGeo, skyMat));

// ---------- lights ----------
scene.add(new THREE.HemisphereLight(0xcfdbe8, 0x3a3f48, 0.3));
const sun = new THREE.DirectionalLight(0xfff1dc, 1.25);
sun.position.set(-9, 18, 6); sun.castShadow = true;
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
const roadTex = loadTex('assets/road.jpg', { repeat: [1, 12] }); roadTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
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

// ---------- trees (instanced low-poly pines on both sides) ----------
(function trees(){
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6); trunkGeo.translate(0, 0.6, 0);
  const coneGeo = new THREE.ConeGeometry(1.1, 3.2, 7); coneGeo.translate(0, 2.6, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3526, roughness: 0.9 }), coneMat = new THREE.MeshStandardMaterial({ color: 0x0f2a18, roughness: 0.95, envMapIntensity: 0.2 });
  const N = 140, trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, N), cones = new THREE.InstancedMesh(coneGeo, coneMat, N);
  cones.castShadow = true;
  const d = new THREE.Object3D();
  for (let i=0;i<N;i++){
    const side = i%2 ? 1 : -1, z = R.near + 2 - Math.random()*(R.near - R.far + 10), x = side*(R.width/2 + 2.2 + Math.random()*9), s = 0.7 + Math.random()*0.9;
    d.position.set(x, -0.3 - Math.random()*1.2, z); d.rotation.set(0, Math.random()*6.28, 0); d.scale.setScalar(s); d.updateMatrix();
    trunks.setMatrixAt(i, d.matrix); cones.setMatrixAt(i, d.matrix);
  }
  scene.add(trunks, cones);
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
