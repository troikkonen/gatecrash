// ============================================================
// UI — HUD, title, input
// ============================================================
const $ = id => document.getElementById(id);
function uiSquad(n){ $('squad').textContent = n; }
function uiLevel(L){ $('level').textContent = L; }
function uiWeapon(){ $('wpnV').textContent = WEAPONS[G.weapon].name; $('wpnI').src = 'assets/w' + G.weapon + '.png'; }
function uiGameOver(){ $('titleBest').textContent = 'Squad wiped out. Tap Play to run it again.'; $('playBtn').disabled = false; $('title').style.display = 'flex'; }

// one thumb, drag anywhere
let dragging = false, dragX = 0, dragStart = 0, tipShown = true;
function down(x){ dragging = true; dragX = x; dragStart = G.squad.target; if (tipShown){ tipShown = false; $('tip').style.opacity = 0; } }
function move(x){ if (!dragging) return; G.squad.target = dragStart + (x - dragX)*CFG.drag; }
function up(){ dragging = false; }
canvas.addEventListener('touchstart', e => { down(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove',  e => { move(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', up); canvas.addEventListener('touchcancel', up);
canvas.addEventListener('mousedown', e => down(e.clientX)); addEventListener('mousemove', e => move(e.clientX)); addEventListener('mouseup', up);

$('mute').onclick = toggleMute; $('mute').textContent = muted ? '🔇' : '🔊';
$('playBtn').onclick = () => { audioInit(); $('title').style.display = 'none'; G.paused = false; startLevel(G.level); };
document.addEventListener('visibilitychange', () => { if (document.hidden) G.paused = true; else if ($('title').style.display === 'none'){ G.paused = false; lastT = performance.now(); } });
