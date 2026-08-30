// ============================================================
// Gatecrash: Hold the Lane — configuration
// All distances are world units (roughly metres). The road runs along -z;
// the squad stands near z = 0 and everything comes toward +z.
// ============================================================
const CFG = {
  road: { width: 7.2, lanes: 3, near: 6, far: -44 },      // road extent in z
  spawnZ: -40,                                              // where things step onto the road
  squadZ: 0,                                                // where the squad stands
  maxSquad: 250, startSquad: 12,
  drag: 0.021,                                              // world units per screen pixel of drag
  bulletSpeed: 34,
};
CFG.laneW = CFG.road.width / CFG.road.lanes;
const LEFT = 0, MID = 1, RIGHT = 2;
const laneX = lane => (lane - 1) * CFG.laneW;                       // centre x of a lane
const laneOfX = x => Math.min(2, Math.max(0, Math.floor((x + CFG.road.width/2) / CFG.laneW)));

// Weapons: you start each level on the first available gun and pick better ones up in the middle lane.
const WEAPONS = [
  { name:'Pistol',  interval:0.22, shots:1, dmg:1,  spread:0,    pierce:false, splash:0,   color:'#ffd447' },
  { name:'SMG',     interval:0.11, shots:1, dmg:1,  spread:0,    pierce:false, splash:0,   color:'#ffd447' },
  { name:'Shotgun', interval:0.28, shots:3, dmg:2,  spread:0.16, pierce:false, splash:0,   color:'#ffb347' },
  { name:'Gatling', interval:0.06, shots:2, dmg:1,  spread:0.05, pierce:false, splash:0,   color:'#ffe08a' },
  { name:'Laser',   interval:0.18, shots:1, dmg:4,  spread:0,    pierce:true,  splash:0,   color:'#7dffea' },
  { name:'Rocket',  interval:0.45, shots:1, dmg:10, spread:0,    pierce:false, splash:2.0, color:'#ff6b6b' },
];

// Every regular enemy dies to one bullet. Speeds in units/s, "hit" is what it costs you if it reaches the squad.
const ENEMY = {
  grunt:  { speed: 7.5, hit: 1, scale: 0.62, color: '#d52a2a', anim: 'run',  radius: 0.45 },
  runner: { speed: 12.0, hit: 1, scale: 0.55, color: '#ff7a2a', anim: 'run',  radius: 0.4 },
  brute:  { speed: 5.5, hit: 3, scale: 1.0,  color: '#8a1414', anim: 'walk', radius: 0.7 },
};

function difficulty(L){
  const world = Math.ceil(L/5);
  return {
    world,
    prep:        22 + L*1.5,                              // seconds before the boss steps on
    waveGap:     Math.max(1.15, 2.8 - L*0.05),
    waveSize:    Math.round(5 * Math.pow(1.095, L-1)),
    speedMult:   1 + (L-1)*0.023,
    bruteChance: Math.min(0.3, 0.04 + L*0.01),
    runnerChance:world >= 2 ? Math.min(0.3, 0.1 + (L-5)*0.015) : 0,
    startWeapon: Math.min(3, world-1),
  };
}
