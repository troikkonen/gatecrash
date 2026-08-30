// ============================================================
// Audio — everything synthesized with WebAudio, no files
// ============================================================
// ---------- sound: everything is synthesized with WebAudio, so no audio files ----------
let AC = null, muted = localStorage.getItem('gc_mute') === '1';
function audioInit(){ if (!AC){ try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} } if (AC && AC.state === 'suspended') AC.resume(); }
function tone(freq, dur, type='square', vol=0.08, slide=0, delay=0){
  if (!AC || muted) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol=0.1, lp=2000, delay=0){
  if (!AC || muted) return;
  const t = AC.currentTime + delay, n = AC.sampleRate*dur, buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
  for (let i=0;i<n;i++) d[i] = (Math.random()*2-1) * (1 - i/n);
  const src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  src.buffer = buf; f.type = 'lowpass'; f.frequency.value = lp; g.gain.value = vol;
  src.connect(f).connect(g).connect(AC.destination); src.start(t);
}
let shotThrottle = 0;
const SFX = {
  shoot(w){ if (performance.now() < shotThrottle) return; shotThrottle = performance.now() + 45;
    if (w === 4) tone(1200, 0.08, 'sawtooth', 0.03, -600); else if (w === 5) noise(0.25, 0.12, 900); else if (w === 2) noise(0.12, 0.1, 1500); else noise(0.05, 0.05, 3000); },
  kill(){ tone(300, 0.08, 'square', 0.05, -200); noise(0.06, 0.05, 1200); },
  hurt(){ tone(160, 0.18, 'sawtooth', 0.09, -100); noise(0.15, 0.08, 600); },
  gate(){ tone(660, 0.12, 'sine', 0.08); tone(990, 0.18, 'sine', 0.08, 0, 0.08); },
  mul(){ tone(523, 0.1, 'triangle', 0.09); tone(784, 0.1, 'triangle', 0.09, 0, 0.09); tone(1047, 0.25, 'triangle', 0.09, 0, 0.18); },
  board(){ tone(140, 0.09, 'square', 0.06, -60); noise(0.05, 0.05, 700); },
  bridge(){ for (let i=0;i<4;i++) tone(330*Math.pow(1.25,i), 0.15, 'triangle', 0.08, 0, i*0.08); },
  chip(){ noise(0.03, 0.04, 2500); },
  crack(){ noise(0.4, 0.18, 1200); tone(90, 0.4, 'sine', 0.15, -60); },
  pickup(){ tone(880, 0.08, 'square', 0.07); tone(1320, 0.14, 'square', 0.07, 0, 0.08); },
  roar(){ tone(70, 0.9, 'sawtooth', 0.18, 30); noise(0.8, 0.12, 300); },
  slam(){ tone(50, 0.5, 'sine', 0.25, -20); noise(0.35, 0.2, 500); },
  bossDown(){ for (let i=0;i<6;i++){ noise(0.5, 0.15, 800, i*0.12); } for (let i=0;i<5;i++) tone(392*Math.pow(1.2,i), 0.3, 'triangle', 0.1, 0, 0.7 + i*0.1); },
  win(){ [523,659,784,1047].forEach((f,i) => tone(f, 0.35, 'triangle', 0.1, 0, i*0.12)); },
  lose(){ [440,370,311,262].forEach((f,i) => tone(f, 0.4, 'sawtooth', 0.08, 0, i*0.18)); },
};
function toggleMute(){ muted = !muted; localStorage.setItem('gc_mute', muted ? '1' : '0'); document.getElementById('mute').textContent = muted ? '🔇' : '🔊'; audioInit(); }

