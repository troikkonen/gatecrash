// ============================================================
// UI — HUD, title, input
// ============================================================
const $ = id => document.getElementById(id);
function uiSquad(n){ $('squad').textContent = n; }
function uiLevel(L){ $('level').textContent = L; }
function uiWeapon(){ $('wpnV').textContent = WEAPONS[G.weapon].name; $('wpnI').src = 'assets/w' + G.weapon + '.png'; }
function uiProgress(f, boss){ $('fill').style.width = (f*100) + '%'; $('fill').className = boss ? 'boss' : ''; }
function uiBossName(n){ $('bossName').textContent = n ? n + ' · KILL IT TO CLEAR' : ''; $('bossName').style.display = n ? 'block' : 'none'; }
function uiGameOver(extra){ uiTitleInfo(); $('overS').textContent = 'Level ' + G.level + (extra ? '  ·  ' + extra : ''); $('over').style.display = 'flex'; }
function uiWin(stars, strong){
  $('stars').innerHTML = [1,2,3].map(i => `<i class="${i<=stars?'on':''}">★</i>`).join('');
  $('winT').textContent = G.level >= TOTAL_LEVELS ? 'All 30 levels cleared' : 'Level ' + G.level + ' cleared';
  const next = G.level + 1;
  $('winS').innerHTML = 'Squad ' + G.squad.n + '  ·  Score ' + G.score + (strong ? '' : '<br>finish with ' + (40 + G.level*3) + '+ troops for the third star') + (next % 5 === 0 && next <= TOTAL_LEVELS ? '<br>' + BOSSES[Math.ceil(next/5)-1].name + ' is waiting at level ' + next + '.' : '');
  $('win').style.display = 'flex';
}
function nextLevel(){ for (const p of ['win','over','picker']) $(p).style.display = 'none'; G.paused = false; lastT = performance.now(); startLevel(G.level >= TOTAL_LEVELS ? 1 : G.level + 1); }
function retryLevel(){ for (const p of ['win','over','picker']) $(p).style.display = 'none'; G.paused = false; lastT = performance.now(); startLevel(G.level); }
function openPicker(){
  const box = $('pick'); box.innerHTML = '';
  for (let L=1; L<=TOTAL_LEVELS; L++){ const b = document.createElement('button'); b.innerHTML = L + (SAVE.stars[L] ? '<s>' + '★'.repeat(SAVE.stars[L]) + '</s>' : '');
    if (L > SAVE.level) b.className = 'locked'; else b.onclick = () => { audioInit(); hudShow(true); for (const p of ['title','win','over','picker']) $(p).style.display = 'none'; G.paused = false; lastT = performance.now(); startLevel(L); };
    box.appendChild(b); }
  G.paused = true; pickerFromTitle = $('title').style.display === 'flex'; for (const p of ['win','over','title']) $(p).style.display = 'none'; $('picker').style.display = 'flex'; box.style.display = 'flex';
}
let pickerFromTitle = false;
function closePicker(){ $('picker').style.display = 'none'; if (pickerFromTitle){ $('title').style.display = 'flex'; return; } if (G.dead){ (G.won ? $('win') : $('over')).style.display = 'flex'; } else { G.paused = false; lastT = performance.now(); } }
// boss intro overlay: full portrait slides in, name from the left
const introEl = $('intro');
function uiIntro(){
  const b = G.boss;
  if (G.intro > 0 && b){ introEl.classList.add('on'); const img = introEl.querySelector('img'); if (img.dataset.k !== b.def.img){ img.src = 'assets/boss_' + b.def.img + '.png'; img.dataset.k = b.def.img; }
    introEl.querySelector('.k').textContent = b.named ? 'WORLD BOSS' : 'INCOMING'; introEl.querySelector('.n').textContent = b.def.name;
    introEl.querySelector('.t').textContent = { slam:'dodge the red lane', sweep:'step around the beam', rocks:'stay out of the circles', charge:'sidestep the rush', barrage:'two lanes at once' }[b.def.patterns[b.def.patterns.length-1]];
    introEl.style.setProperty('--p', Math.min(1, (2.6 - G.intro)*2.2)); introEl.style.opacity = Math.min(1, G.intro*2.5); }
  else introEl.classList.remove('on');
}

// one thumb, drag anywhere
let dragging = false, dragX = 0, dragStart = 0, tipShown = true;
function down(x){ dragging = true; dragX = x; dragStart = G.squad.target; if (tipShown){ tipShown = false; $('tip').style.opacity = 0; } }
function move(x){ if (!dragging) return; G.squad.target = dragStart + (x - dragX)*CFG.drag; }
function up(){ dragging = false; }
canvas.addEventListener('touchstart', e => { down(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove',  e => { move(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', up); canvas.addEventListener('touchcancel', up);
canvas.addEventListener('mousedown', e => down(e.clientX)); addEventListener('mousemove', e => move(e.clientX)); addEventListener('mouseup', up);

$('mute').onclick = toggleMute;
$('qual').onclick = () => setQuality(QUALITY.level === 'high' ? 'low' : 'high', true);
setQuality(QUALITY.level); $('mute').textContent = muted ? '🔇' : '🔊';
function hudShow(on){ $('hud').style.visibility = on ? '' : 'hidden'; $('tip').style.visibility = on ? '' : 'hidden'; }
hudShow(false);
$('playBtn').onclick = () => { audioInit(); $('title').style.display = 'none'; hudShow(true); G.paused = false; lastT = performance.now(); startLevel(G.level); };
$('lvl').onclick = openPicker; $('levelsBtn').onclick = openPicker;
function uiTitleInfo(){ const total = Object.values(SAVE.stars).reduce((a,b)=>a+b,0); const next = Math.min(TOTAL_LEVELS, SAVE.level); $('playBtn').textContent = next > 1 ? 'Continue · Level ' + next : 'Play'; $('titleBest').textContent = next > 1 ? '★ ' + total + ' of ' + TOTAL_LEVELS*3 : 'Drag to move. Everything else is automatic.'; const bossImg = (next % 5 === 0 ? BOSSES[Math.ceil(next/5)-1] : BOSSES[Math.min(5, Math.floor((next-1)/5))]).img; $('titleBoss').src = 'assets/boss_' + bossImg + '.png'; }
document.addEventListener('visibilitychange', () => { if (document.hidden) G.paused = true; else if (['title','win','over','picker'].every(p => $(p).style.display !== 'flex')){ G.paused = false; lastT = performance.now(); } });
