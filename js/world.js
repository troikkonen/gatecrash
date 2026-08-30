// ============================================================
// World — renderer, camera, lighting, road, scenery
// ============================================================
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 150);
const CAM = { pos: new THREE.Vector3(0, 10.5, 11.5), look: new THREE.Vector3(0, 0.2, -9), lean: 0, shake: 0 };
function resize(){ renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------- sky + fog ----------
const SKY_TOP = 0x6f8db3, SKY_HORIZON = 0xc9d4e0;
scene.fog = new THREE.Fog(SKY_HORIZON, 34, 78);
const skyGeo = new THREE.SphereGeometry(120, 24, 12);
const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(SKY_TOP) }, bottom: { value: new THREE.Color(SKY_HORIZON) } },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*2.2 + 0.1, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0); }' });
scene.add(new THREE.Mesh(skyGeo, skyMat));

// ---------- lights ----------
scene.add(new THREE.HemisphereLight(0xcfdbe8, 0x3a3f48, 0.55));
const sun = new THREE.DirectionalLight(0xfff1dc, 1.25);
sun.position.set(-9, 18, 6); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 10, bottom: -36, near: 1, far: 60 });
sun.target.position.set(0, 0, -10); scene.add(sun, sun.target);

// ---------- textures ----------
const texLoader = new THREE.TextureLoader();
function loadTex(url, opts={}){ const t = texLoader.load(url); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; if (opts.repeat){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...opts.repeat); } return t; }
const roadTex = loadTex('assets/road.jpg', { repeat: [1, 12] });
const forestTex = loadTex('assets/forest.jpg', { repeat: [4, 4] }); forestTex.wrapS = forestTex.wrapT = THREE.MirroredRepeatWrapping;

// ---------- ground + road ----------
const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshLambertMaterial({ map: forestTex, color: 0x8e9cae }));
ground.rotation.x = -Math.PI/2; ground.position.set(0, -5, -20); scene.add(ground);

const R = CFG.road;
const roadMat = new THREE.MeshLambertMaterial({ map: roadTex, color: 0xb6bac2 });
function roadStrip(x, z0, z1, w){ const m = new THREE.Mesh(new THREE.PlaneGeometry(w, z0 - z1), roadMat); m.rotation.x = -Math.PI/2; m.position.set(x, 0, (z0 + z1)/2); m.receiveShadow = true; scene.add(m); return m; }
// the road bed: a thick slab so the edges read as a bridge deck
const deck = new THREE.Mesh(new THREE.BoxGeometry(R.width + 0.6, 0.8, R.near - R.far), new THREE.MeshLambertMaterial({ color: 0x4b4f57 }));
deck.position.set(0, -0.41, (R.near + R.far)/2); deck.receiveShadow = true; scene.add(deck);
const roadSurfaces = [0,1,2].map(l => roadStrip(laneX(l), R.near, R.far, CFG.laneW + 0.02));
// lane lines, edge rails
const lineMat = new THREE.MeshBasicMaterial({ color: 0xeef2f7 });
for (const x of [-CFG.laneW/2, CFG.laneW/2]){ const l = new THREE.Mesh(new THREE.PlaneGeometry(0.07, R.near - R.far), lineMat); l.rotation.x = -Math.PI/2; l.position.set(x, 0.012, (R.near + R.far)/2); scene.add(l); }
const railMat = new THREE.MeshLambertMaterial({ color: 0x5f6773 });
for (const x of [-R.width/2 - 0.1, R.width/2 + 0.1]){
  const r = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, R.near - R.far), railMat); r.position.set(x, 0.75, (R.near + R.far)/2); r.castShadow = true; scene.add(r);
  for (let z = R.near; z > R.far; z -= 3){ const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), railMat); p.position.set(x, 0.4, z); scene.add(p); }
}

// ---------- trees (instanced low-poly pines on both sides) ----------
(function trees(){
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6); trunkGeo.translate(0, 0.6, 0);
  const coneGeo = new THREE.ConeGeometry(1.1, 3.2, 7); coneGeo.translate(0, 2.6, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a3526 }), coneMat = new THREE.MeshLambertMaterial({ color: 0x0f2a18 });
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
const MIST = Array.from({length: 6}, (_, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, opacity: 0.5, depthWrite: false })); m.rotation.x = -Math.PI/2; m.position.y = 0.4 + i*0.06; m.userData = { x: Math.random(), z: R.far + 8 + i*7, w: 9 + Math.random()*6, v: 0.15 + Math.random()*0.25 }; scene.add(m); return m; });

function worldUpdate(dt, t, scroll){
  roadTex.offset.y = -(scroll*0.06) % 1;
  for (const m of MIST){ const u = m.userData; u.x += u.v*dt*0.05; m.position.x = ((u.x % 1.4) - 0.7)*R.width*2.2; m.position.z = u.z + Math.sin(t*0.2 + u.z)*1.5; m.scale.set(u.w, 3.2, 1); }
  // camera: lean into the drag, shake on hits
  camera.up.set(Math.sin(CAM.lean*0.35), Math.cos(CAM.lean*0.35), 0);
  camera.position.copy(CAM.pos);
  if (CAM.shake > 0){ camera.position.x += (Math.random()-0.5)*CAM.shake*0.06; camera.position.y += (Math.random()-0.5)*CAM.shake*0.04; CAM.shake = Math.max(0, CAM.shake - dt*40); }
  camera.lookAt(CAM.look);
}
function kick(k){ CAM.shake = Math.min(18, CAM.shake + k); }
