// The slice's only gameplay tuning source. Legacy game.js is intentionally untouched.
// The game's speed: simulation seconds per real second. 1.95 since 2026-10-05 (the user: testers found it too slow;
// 1.5 × the 1.3 it was): the buddies cover the ground, and the notes come, half as fast again (a note every 308 ms).
// What is meant in real time (tap windows, a sprint's length, the stamina wait, an apple) is written × T.
const T=1.95;
export const SLICE_CONFIG = Object.freeze({
  // Three-leg relay, about 75 wall seconds: one horse per leg (SLICE_LEGS), handoffs and the finish by distance.
  legLength:540, baseSpeed:12, countdown:3, tempo:T, fixedStep:1/120,
  // Rhythm windows are stored in simulation seconds. Preserve the intended
  // real-time tap tolerance when the whole race runs at 1.3x tempo.
  chordWindow:.075/1.3*T, perfectWindow:.085*T, goodWindow:.15*T,   // real time: both pads within 58 ms, Perfect ±85 ms, Good ±150 ms (170 until 2026-10-05: the notes are 308 ms apart now)
  laneDuration:.3, laneSpacing:3, bendLane:.05, followGap:6.24, laneOverlap:.8, stallOverlap:.45, stall:.75, breakOut:15,
  gaitWind:[.15,.08,.02,-.1], draftWind:.06, shoveWind:.2, appleWind:.3,   // the gait test (slice-game: config.gait)
  paceAt:.65, paceLo:.5, paceHi:.8, paceHold:.58, kickWait:1.5*T, kickWind:.15, windDrain:.2, windBack:.1, blownTime:3*T,   // the pace test (slice-game: config.pace)   // traffic: nose-to-nose following distance (m; a horse is 5.3 long: 4.4 × the 1.2 they are drawn at since 2026-10-04, and this and coinRadius grew × 1.2 with it; leapReach and draftReach stayed: growing them too let a ~70% rider win every ★3 city), side overlap (lanes); laneSpacing: m between lane centres on screen (the race concept art's wide lanes)
  leapReach:3,   // a jump in a sprint leaps the horse just ahead (up to followGap + leapReach) when there is room to land
  // Comeback (stuck behind a horse, the taps should build toward a pass, not feel wasted):
  draftReach:7, draftGain:1.6, draftTrickle:4,   // drafting: a horse ahead in the lane within draftReach m (right behind) → hits give ×draftGain energy, plus draftTrickle / s
  blockReaction:.5,   // a blocker (Willow) moves onto the lane the player was actually in this long ago, not the one pressed
  energyMax:100, startEnergy:0,   // startEnergy: the stable's race form (stable-care relayForm); energyMax: its cap
  // Charge (the charge button): boostCost energy = one segment = one sprint. A horse stores charges[type] segments (the
  // straight runner one more, its bends are its weak side); hits past that are lost and a handoff starts at 0, so
  // segments get spent along the way. Five Perfects fill one (a quick reward); a miss takes back missEnergy, never a
  // stored segment.
  charges:{straight:3,curve:2,mud:2},
  perfectEnergy:10, goodEnergy:5, missEnergy:2,
  // Accurate steps build a 10% steady advantage over V=12 in roughly 4–6 hits.
  rhythmGain:.32, goodRhythmGain:.22, rhythmMax:1.2, rhythmResponse:4, rhythmGrace:.39, rhythmDecay:.65,
  // Missed beats release rhythm drive gradually; only a knocked jump slows below V.
  missImpulse:0, impulseDecay:.4, hitImpulse:0, goodImpulse:0,
  // Sprint: one segment (50 energy), 2.6 wall seconds (simulation seconds at 1.3x tempo), no stacking. Segments are
  // capped at 2–3 and reset at each handoff, so a sprint is a big one.
  boostCost:50, boostDuration:2.6*T, boostSpeed:4.6, boostAttack:.22, boostRelease:.52,
  // Stamina (體力; 2026-10-04, the user): each buddy has its own pool, its Stamina number now in use (buddyStats; `stamina`
  // here stands in for a runner without numbers), so a handoff starts full. A sprint takes sprintStamina off as it
  // starts (none without that much left); from staminaWait after the last sprint ended it comes back at staminaRegen
  // (2 wall seconds, then 1 a wall second: both in simulation seconds here). The same for every runner.
  stamina:20, sprintStamina:5, staminaWait:2*T, staminaRegen:1/T,
  jumpDuration:1.05, jumpLead:.45, jumpWindow:.2/1.3*T,   // the window: ±154 ms of real time, as before
  // Knocked hurdle: speed dips (up to 60%) for 0.9 simulation seconds, combo, rhythm drive and a running sprint are lost.
  stumbleTime:.9, stumbleDip:.6,
  coinRadius:.78,
  // Results: each coin picked up is worth coinValue in the wallet, plus a bonus by finishing place (1st … 5th), and
  // diamonds (gemBonus) for a podium place.
  coinValue:10, placeBonus:[50,30,15,5,0],
  gemBonus:[3,2,1,0,0],   // diamonds for the top three places (1st … 5th); practice earns none
});
// The lap: three legs, straight-led, bend-led, mud-led. Sections are [from, to] fractions of a leg, a terrain and a
// bend (visual only: + curves left, - right). Hurdles are leg fractions, clear of the handoffs.
export const SLICE_LEGS = Object.freeze([
  {main:'straight',sections:[[0,.62,'straight'],[.62,.8,'curve',1],[.8,1,'straight']],hurdles:[.42]},
  {main:'curve',sections:[[0,.08,'straight'],[.08,.45,'curve',-1],[.45,.54,'straight'],[.54,.92,'curve',1],[.92,1,'straight']],hurdles:[.495]},
  {main:'mud',sections:[[0,.08,'straight'],[.08,.38,'mud'],[.38,.6,'mud',-1],[.6,.86,'mud'],[.86,1,'straight']],hurdles:[.28,.72]},
]);
// Speed multiplier by horse type (its one aptitude) and the terrain underfoot; a muddy bend is mud only.
export const AFFINITY = Object.freeze({
  straight:{straight:1.2,curve:1.1,mud:1.0},
  curve:{straight:1.0,curve:1.2,mud:1.1},
  mud:{straight:1.1,curve:1.0,mud:1.2},
});
export const TERRAIN_NAME = Object.freeze({straight:'直線',curve:'彎道',mud:'泥地'});
// Rival teams ride by the player's rules in everything (2026-10-04, the user: the same rules): their buddies have the
// same three numbers (RIVAL_BUDDY by type, at RIVAL_LEVEL of the course's difficulty), their speed is that buddy's base
// speed plus the rhythm drive their own hits build, they charge, tire, sprint, leap (after the jump's cooldown) and
// knock hurdles like the player, and none starts ahead of the player. What differs is the rider: skill (the share of
// the notes it hits, half of them Perfect; a hurdle is knocked (1 - skill) / 3 of the time), from when in a leg it
// spends its segments (sprintAt, a leg fraction; before that only when full), and Willow's blocking (block: it takes
// the player's line when just ahead). The skill is the course's (RIVAL_SKILL, by its difficulty) plus the team's edge.
// Each rides its buddies in the order that suits the course (slice-game bestOrder). name, types and coats
// (approved-assets COATS) in the team's own order; grid: lane and metres from the line (two rows, at most three
// abreast: the player is in the front row). The field is the player + the first 2 (three teams) or all 4 (five).
// Tuned with tools/verify-race-progression.mjs on every city, both fields, the player's buddies at the level a city
// expects (RIVAL_LEVEL): ~85% of the notes hit with sprints and a sensible order wins every course; ~70% wins at most
// half of the ★3 ones; ~60% wins the ★1 one.
export const SLICE_RIVALS = Object.freeze([
  {id:'pacer',name:'Willow',types:['straight','curve','straight'],coats:[3,9,3],lane:-1,start:0,sprintAt:.55,block:true},
  {id:'chaser',name:'Luna',types:['mud','curve','mud'],coats:[8,9,8],lane:1,start:0,sprintAt:.8},
  {id:'hazel',name:'Hazel',types:['curve','mud','curve'],coats:[4,5,7],edge:.05,lane:0,start:-7,sprintAt:.35},
  {id:'rio',name:'Rio',types:['mud','straight','mud'],coats:[6,8,6],lane:1,start:-7,sprintAt:.65},
  {id:'sage',name:'Sage',types:['straight','mud','curve'],coats:[5,3,4],lane:-1,start:-7,sprintAt:.45},   // the sixth runner (2026-10-05: stages 4 and 5 are run against five); the relay keeps the first four
]);
export const STALLS=[-1,1,-2,2,3].map(k=>k*.75);   // the rivals' start stalls, in lanes (the player's is 0): 2.25 m apart, across the 16 m of dirt (the three lanes are its middle 6 m)
export const fieldRivals=size=>SLICE_RIVALS.slice(0,size-1);   // size: runners with the player (a solo race: 2, 3 or 5; the relay: 5, or 3 with ?field=3)
// The ladder, by the course's difficulty (city pack `difficulty`, the ★ on the track cards; none, the template course,
// is 3): the level of the rivals' buddies, which is also the level the city expects of the player's, and their riders'
// skill. A player who hits more of the notes than that, on buddies of that level, wins.
export const RIVAL_LEVEL=Object.freeze({1:1,2:3,3:5}),RIVAL_SKILL=Object.freeze({1:.55,2:.66,3:.76});
export const RIVAL_BUDDY=Object.freeze({straight:{Speed:.78,Accel:.55,Stamina:.6},curve:{Speed:.64,Accel:.7,Stamina:.82},mud:{Speed:.6,Accel:.5,Stamina:.7}});   // the starters' numbers (home.js ROSTER: Ember, Swift, Summit)
// A buddy's three numbers (2026-10-04, the user: written 20/120, never ×1.2). full: its own fixed top, its stat (0–1,
// home.js ROSTER) × STAT_FULL; now: the part of it its level lets it use, (level + 1) / (MAX_LEVEL + 1): under a fifth
// at LV 1, all of it at LV 10.
export const MAX_LEVEL=10,STAT_FULL=150,STATS=Object.freeze(['Speed','Accel','Stamina']);
export const levelShare=lv=>(Math.max(1,Math.min(MAX_LEVEL,lv||1))+1)/(MAX_LEVEL+1);
export function buddyStats(stats={},lv=1){
  return Object.fromEntries(STATS.map(k=>{const full=Math.round((stats[k]??.7)*STAT_FULL);return [k,{now:Math.round(full*levelShare(lv)),full}];}));
}
// Those numbers on the track, by the same sums for every runner: Speed → its base speed (m/s); Accel → the rhythm drive
// a hit adds (a Good: .6875 of a Perfect, as it was) and, in a solo run, the step a hit adds to the combo drive, whose
// top is the buddy's nature, not its level (a quick accelerator tops out lower); Stamina → its sprint pool.
export function racing(st){
  const gain=.26+st.Accel.now/1000;
  return {baseSpeed:+(11.7+st.Speed.now/250).toFixed(3),rhythmGain:+gain.toFixed(4),goodRhythmGain:+(gain*.6875).toFixed(4),stamina:st.Stamina.now,
    accel:+(.02+.02*st.Accel.now/STAT_FULL).toFixed(4),top:+(.44-.16*st.Accel.full/STAT_FULL).toFixed(3)};
}
// Solo run (單騎): phase 1 of the new race rules; the relay still runs the rules above. One horse, 0–4 rivals on one
// buddy each by these same sums (slice-game rivalStep; 2026-10-05), no
// handoffs, and its own speed with a combo drive in place of baseSpeed + rhythm drive: speed = its speed × (1 + drive).
// Every hit in a row multiplies (1 + drive) by (1 + its accel) (a Good: half that step) up to its top. Nothing fades
// the drive but a miss: each takes missDrop off, miss after miss, down to floor (slower than its own speed); the next
// hit starts again from its own speed. response: how fast the running speed follows the drive (1/s). No terrain
// aptitude here (grip will replace it, phase 2), so its type gives nothing either: every buddy stores soloCharges
// segments. accel, top: the stand-ins for a buddy without numbers (racing()). target: the run is whole laps of the
// city's track to about this (m). 600 since 2026-10-05 (it was 1000: two laps of the three shorter tracks, a minute or
// more for a new player; the user: 控制在 30~40 秒): every city is now one lap, 549–791 m.
// Losing speed is a glide, not a drop: the running speed follows the drive down at `fall` (1/s, up at `response`), a
// sprint lets go over boostRelease (simulation s; the relay's is shorter), and while a sprint or an apple is carrying
// the horse a miss takes no drive (the combo and the charge still pay for it).
// Apples (sliceApples): riding through one adds appleSpeed m/s for appleTime (2 wall seconds), on top of everything
// else, a sprint included.
export const SOLO=Object.freeze({missDrop:.08,floor:-.15,response:4,fall:1.5,target:600,boostRelease:.9,appleSpeed:3.2,appleTime:2*T,soloCharges:3,accel:.03,top:.35});
// A course = {length, relays: [handoff 1, handoff 2], hurdles, sections: [{s0, s1, kind, bend}], mud: [[s0, s1]]}.
// Cities build theirs from their own lap (course/courses.mjs relayCourse); this template (SLICE_LEGS on legLength)
// is the fallback and the simulator's reference course.
export function templateCourse(c=SLICE_CONFIG){
  const L=c.legLength;
  return {id:'template',length:L*3,relays:[L,2*L],mud:[],
    hurdles:SLICE_LEGS.flatMap((leg,k)=>leg.hurdles.map(f=>Math.round((k+f)*L))),
    sections:SLICE_LEGS.flatMap((leg,k)=>leg.sections.map(([a,b,kind,bend=0])=>({s0:(k+a)*L,s1:(k+b)*L,kind,bend})))};
}
export const courseMarks=(course=templateCourse())=>({length:course.length,relays:course.relays,hurdles:course.hurdles});
const legOf=(course,d)=>d<course.relays[0]?0:d<course.relays[1]?1:2;
// Ground under distance d: its leg, terrain kind (mud wins over a bend: a muddy bend is mud) and bend (visual).
export function sectionAt(d,course=templateCourse()){
  const list=course.sections;let lo=0,hi=list.length-1;const x=Math.max(0,Math.min(course.length-1e-6,d));
  while(lo<hi){const m=(lo+hi+1)>>1;if(list[m].s0<=x)lo=m;else hi=m-1;}
  const s=list[lo],mud=s.kind==='mud'||course.mud.some(([a,b])=>x>=a&&x<b);
  return {leg:legOf(course,x),kind:mud?'mud':s.kind,bend:s.bend};
}
// Each leg's main ground (the kind covering most of it) and its share of each kind, sampled every 5 m.
export function legMains(course=templateCourse()){
  const ends=[0,...course.relays,course.length];
  return [0,1,2].map(k=>{const share={straight:0,curve:0,mud:0};let n=0;
    for(let d=ends[k];d<ends[k+1];d+=5){share[sectionAt(d,course).kind]++;n++;}
    for(const t in share)share[t]/=n;
    return {main:Object.keys(share).reduce((a,b)=>share[b]>share[a]?b:a),share,length:ends[k+1]-ends[k]};});
}
// Chart by leg intensity (times are estimated, legs take ~33 simulation seconds): leg 1 short even phrases to find the
// beat and charge, leg 2 longer mixed phrases while the lanes are fought over, leg 3 long phrases with short rests.
// One note at a time (never both hoofs at once), 0.6 s apart; runs past the slowest finish.
const PHRASES=[[[0,1,0,1],[1,0,1,0],[0,0,1,1],[1,1,0,0]],[[1,0,1,1,1,0],[0,1,1,0,1,0],[1,0,0,1,0,1],[0,1,0,1,1,0]],
  [[0,1,0,1,1,0,1,0],[1,0,1,0,0,1,0,1],[0,1,1,0,0,1,1,0],[1,0,0,1,1,0,0,1]]];
export function sliceChart(end=130,third=33){   // third: how long each intensity lasts (simulation s)
  const notes=[];let t=1,k=0;
  while(t<end){const leg=t<third?0:t<2*third?1:2,phrase=PHRASES[leg][k%4];
    phrase.forEach((lane,i)=>notes.push({id:`n${k}-${i}`,t:+(t+i*.6).toFixed(3),lane,leg}));
    t+=phrase.length*.6+(leg<2?1.2:.6);k++;}
  return notes;
}
export const SLICE_CHART = Object.freeze(sliceChart());
// A solo run is one lap, about 30 s (2026-10-05): the same build-up in thirds of that, or it would end on the opening phrases.
export const SOLO_CHART = Object.freeze(sliceChart(130,12));
export const EASY_CHART=Object.freeze(sliceChart(130,1e9));   // stage 1 (a city pack's gameplay.easy): the opening four-note phrases all the way, as the practice has them
export const soloChart=length=>sliceChart(130,Math.max(6,length/55));   // by the run's length: 384 m (stage 1) → 7 s a third, 860 m → 15.6 s
// Coin runs: three in a lane every ~70 m, lanes rotating, none near the start, a hurdle or a handoff.
export function sliceCoins(course=templateCourse()){
  const m=courseMarks(course),clear=d=>d>12&&d<m.length-15&&m.hurdles.every(h=>Math.abs(h-d)>22)&&m.relays.every(r=>Math.abs(r-d)>28),coins=[];
  for(let d=20,k=0;d<m.length;d+=70,k++){const lane=[0,-1,1,0,1,-1][k%6];
    if([0,1,2].every(i=>clear(d+i*7)))for(let i=0;i<3;i++)coins.push({id:`coin-${k}-${i}`,distance:d+i*7,lane});}
  return coins;
}
export const SLICE_COINS = Object.freeze(sliceCoins());
// Apples (solo run): a fork at every other coin run. The apple sits beside that run's middle coin, in a lane the run
// is not in (the far side for an outer run), so the rider chooses: the three coins, or the apple (a lane change is too
// slow to take both from an outer lane). None near the start, a hurdle or the line.
export function sliceApples(course=templateCourse()){
  const m=courseMarks(course),clear=d=>d>12&&d<m.length-30&&m.hurdles.every(h=>Math.abs(h-d)>22),lanes=[0,-1,1,0,1,-1],apples=[];
  for(let d=97,k=1;d<m.length;d+=140,k+=2)if(clear(d))apples.push({id:`apple-${(k-1)/2}`,distance:d,lane:lanes[k%6]?-lanes[k%6]:(k%4===1?1:-1)});
  return apples;
}
