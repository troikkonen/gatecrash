// ============================================================
// Gatecrash: Hold the Lane — configuration
// All distances are world units (roughly metres). The road runs along -z;
// the squad stands near z = 0 and everything comes toward +z.
// ============================================================
const CFG = {
  road: { width: 7.2, lanes: 3, near: 6, far: -44 },      // road extent in z
  spawnZ: -26,                                              // close enough that the horde reaches your line                                              // where things step onto the road
  squadZ: 0,                                                // where the squad stands
  maxSquad: 250, startSquad: 12,
  drag: 0.021,                                              // world units per screen pixel of drag
  bulletSpeed: 44, bulletRange: 22,                         // shots fade out before the spawn line — nothing dies at the horizon
};
CFG.laneW = CFG.road.width / CFG.road.lanes;
CFG.conveyor = 9;                                                     // how fast gates, crates and rocks come down the road (units/s, × speedMult)
const GAP = { near: -9, far: -15 };                                   // the missing stretch of road in each outer lane (z range)
const LEFT = 0, MID = 1, RIGHT = 2;
const laneX = lane => (lane - 1) * CFG.laneW;                       // centre x of a lane
const laneOfX = x => Math.min(2, Math.max(0, Math.floor((x + CFG.road.width/2) / CFG.laneW)));

// Weapons: you start each level on the first available gun and pick better ones up in the middle lane.
const WEAPONS = [
  { name:'Pistol',  interval:0.30, shots:1, dmg:1,  spread:0,    pierce:false, splash:0,   color:'#ffd447' },
  { name:'SMG',     interval:0.11, shots:1, dmg:1,  spread:0,    pierce:false, splash:0,   color:'#ffd447' },
  { name:'Shotgun', interval:0.28, shots:3, dmg:2,  spread:0.16, pierce:false, splash:0,   color:'#ffb347' },
  { name:'Gatling', interval:0.06, shots:2, dmg:1,  spread:0.05, pierce:false, splash:0,   color:'#ffe08a' },
  { name:'Laser',   interval:0.18, shots:1, dmg:4,  spread:0,    pierce:true,  splash:0,   color:'#7dffea' },
  { name:'Rocket',  interval:0.45, shots:1, dmg:10, spread:0,    pierce:false, splash:2.0, color:'#ff6b6b' },
];

// Every regular enemy dies to one bullet. Speeds in units/s, "hit" is what it costs you if it reaches the squad.
const ENEMY = {
  grunt:  { speed: 10.5, hit: 1, scale: 0.62, color: '#6f8a4a', anim: 'ZRun',   radius: 0.45 },
  runner: { speed: 15.0, hit: 1, scale: 0.55, color: '#a04a2a', anim: 'ZCrawl', radius: 0.4 },
  brute:  { speed: 8.0, hit: 3, scale: 0.95, color: '#c9c9c9', anim: 'WWalk',  radius: 0.75 },
};

// Bosses: a captain on ordinary levels, a named world boss on 5/10/15/20/25/30. Each world adds an attack pattern.
//  slam: your lane gets crushed · sweep: a beam walks across the road · rocks: boulders land on marked circles
//  charge: it rushes down your lane and back · barrage: two lanes at once
const BOSSES = [
  { name:'THE WARDEN',   img:'warden',    color:'#8a1c1c', patterns:['slam'] },
  { name:'SCRAPJAW',     img:'scrapjaw',  color:'#5b3a8a', patterns:['slam','sweep'] },
  { name:'STONEFIST',    img:'stonefist', color:'#5e5240', patterns:['slam','sweep','rocks'] },
  { name:'FROSTBITE',    img:'frostbite', color:'#2f6f8a', patterns:['sweep','rocks','charge'] },
  { name:'HELLBRAND',    img:'hellbrand', color:'#b3400f', patterns:['slam','rocks','charge','barrage'] },
  { name:'THE PROTOCOL', img:'protocol',  color:'#1f1f2b', patterns:['slam','sweep','rocks','charge','barrage'] },
];
const CAPTAIN = { name:'CAPTAIN', img:'captain', color:'#9c3b2e', patterns:['slam'] };
const TOTAL_LEVELS = 30;

function difficulty(L){
  const world = Math.ceil(L/5);
  return {
    world,
    prep:        22 + L*1.5,                              // seconds before the boss steps on
    waveGap:     Math.max(1.0, 2.4 - L*0.05),
    waveSize:    Math.min(40, Math.round(12 * Math.pow(1.06, L-1))),   // big blocks: you chew the front rank while the rest keeps coming
    speedMult:   1 + (L-1)*0.023,
    bruteChance: Math.min(0.3, 0.04 + L*0.01),
    runnerChance:world >= 2 ? Math.min(0.3, 0.1 + (L-5)*0.015) : 0,
    startWeapon: Math.min(3, world-1),
    plusValue:   1 + Math.floor((L-1)/8),                 // left-lane gate value: +1, then +2 from level 9, +3 from 17...
    plusGap:     2.0, mulGap: 6.5,
    jackpotGap:  1.5, jackpotWindow: 12,                  // right lane payoff once its bridge is built
    leftBoards:  5,  leftHits:  Math.round(5 * Math.pow(1.06, L-1)),
    rightBoards: 8,  rightHits: Math.round(9 * Math.pow(1.07, L-1)),
    weaponGap:   8, rockGap: 15,
    rockHp:      Math.round(22 * Math.pow(1.07, L-1)),
    bossHp:      L % 5 === 0 ? Math.round(420 * Math.pow(1.5, world-1)) : Math.round(200 * Math.pow(1.10, L-1)),
    bossAdvance: 8,                                       // seconds for the boss to walk down to your line, then it fights there
    telegraph:   Math.max(0.6, 1.05 - world*0.06),        // warning time before an attack lands
  };
}
