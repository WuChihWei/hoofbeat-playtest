// Course = a city pack's track (cities/<id>.mjs: lap of shared pieces + gameplay on it) + its look (themes.mjs).
// Each lap starts down the left side, counter-clockwise on the map; closeLoop solves the F straights so it closes.
// Start/Finish is s = 0. Race = 2 laps, 3 horses: handoffs at the end of the Relay Zone on each lap, then the line.
// Gameplay positions are metres along ONE lap and lanes (-1|0|+1); they never name assets.
import {buildTrack,closeLoop} from './track.mjs';
import {THEMES} from './themes.mjs?v=r430';
import {CITIES} from './cities/index.mjs?v=r430';

export const RELAY_ZONE=40;  // metres of straight where the handoff happens
const trail=(s,lane,n=3,gap=7)=>Array.from({length:n},(_,i)=>({s:s+i*gap,lane}));  // lane-change coin runs
const PIECE={S:'Straight_S',M:'Straight_M',L:'Straight_L',F:'Straight_Fill'};

export const COURSES=Object.freeze(CITIES.map(p=>{
  const lap=closeLoop(p.track.lap.split(' ').map(t=>PIECE[t]??'Curve_'+t)),pieces=buildTrack(lap).pieces;
  const at=(i,t)=>pieces[i].s0+t;   // s at `t` metres into piece `i` (placements follow the recipe)
  return {id:p.id,city:p.city,title:p.title,brief:p.brief,tagline:p.tagline,surface:p.surface,scenery:p.scenery,difficulty:p.difficulty,mvp:!!p.mvp,theme:p.id,lap,gameplay:p.track.gameplay({at,trail})};
}));

// Everything a race needs for one city, in whole-race distances.
export function buildCourse(id){
  const c=COURSES.find(x=>x.id===id);if(!c)throw new Error('Unknown course: '+id);
  const lap=buildTrack(c.lap),n=c.gameplay.laps,track=buildTrack(Array(n).fill(c.lap).flat()),L=lap.length;
  const perLap=(list)=>Array.from({length:n},(_,k)=>list.map(o=>({...o,s:o.s+k*L,lap:k+1}))).flat();
  return {...c,lapLength:L,track,theme:THEMES[c.theme],relayZone:{s:c.gameplay.relay,length:RELAY_ZONE},
    jumps:perLap(c.gameplay.jumps),coins:perLap(c.gameplay.coins),
    // one leg per horse: handoff at the end of the Relay Zone on laps 1..n, then the anchor runs to the line
    relays:[...Array.from({length:n},(_,k)=>({s:k*L+c.gameplay.relay+RELAY_ZONE,lap:k+1})),{s:n*L,lap:n,final:true}]};
}

// Solo run (單騎練跑): one horse over whole laps of the city's track to about `target` m: no handoffs, the lap's own
// bends and jumps on every lap, the pack's mud stretches (the same shares of the run).
// The lap's centre line as [x, z] at even steps of about 5 m (the first at the line), for the race's track map (race-hud).
const outlineOf=lap=>{const n=Math.round(lap.length/5);return Array.from({length:n},(_,i)=>{const p=lap.pose(i*lap.length/n);return [+p.x.toFixed(1),+p.z.toFixed(1)];});};
export function soloCourse(id,target=0){   // one lap (2026-10-05, the user: stage 1 about 20 s, the others 40-odd: the laps themselves are that long); the practice asks for more
  const c=COURSES.find(x=>x.id===id);if(!c)throw new Error('Unknown course: '+id);
  const lap=buildTrack(c.lap),lapLength=lap.length,laps=target?Math.max(1,Math.round(target/lapLength)):c.gameplay.soloLaps||1;   // a stage's own run: the pack's soloLaps (stage 1: one lap, about 20 s; the others two, 40-odd)
  const track=buildTrack(Array(laps).fill(c.lap).flat()),length=track.length;
  const sections=track.pieces.map(p=>({s0:p.s0,s1:p.s0+p.length,kind:p.straight?'straight':'curve',bend:p.straight?0:Math.sign(p.k)}));
  const hurdles=Array.from({length:laps},(_,k)=>c.gameplay.jumps.map(j=>j.s+k*lapLength)).flat().filter(h=>h>80&&h<length-60).slice(0,6);
  return {id,city:c.city,title:c.title,difficulty:c.difficulty,length,laps,lapLength,relays:[],hurdles,sections,
    mud:(c.gameplay.mud||[]).map(([a,b])=>[a*length,b*length]),solo:true,outline:outlineOf(lap)};
}

// Relay race on a city's own lap (the map on its card): whole laps to about RELAY_TARGET m, three legs split at the
// thirds (each handoff snapped onto the nearest straight), bends exactly where the lap bends (bend: +1 left, −1 right),
// the pack's mud stretches (gameplay.mud, race fractions) and its jumps on every lap, kept clear of the start, the
// handoffs and the line. Terrain for a horse's aptitude: mud if muddy, else bend or straight.
export const RELAY_TARGET=1620;
export function relayCourse(id){
  const c=COURSES.find(x=>x.id===id);if(!c)throw new Error('Unknown course: '+id);
  const lap=buildTrack(c.lap),lapLength=lap.length,laps=Math.max(1,Math.round(RELAY_TARGET/lapLength));
  const track=buildTrack(Array(laps).fill(c.lap).flat()),length=track.length;
  const straights=track.pieces.filter(p=>p.straight&&p.length>=30);
  const relays=[1,2].map(k=>{const t=k*length/3;let best=t,gap=Infinity;
    for(const p of straights){const s=Math.min(p.s0+p.length-12,Math.max(p.s0+12,t));if(Math.abs(s-t)<gap){gap=Math.abs(s-t);best=s;}}return gap<=60?best:t;});   // no straight near: hand off on the bend
  const mud=(c.gameplay.mud||[]).map(([a,b])=>[a*length,b*length]);
  const sections=track.pieces.map(p=>({s0:p.s0,s1:p.s0+p.length,kind:p.straight?'straight':'curve',bend:p.straight?0:Math.sign(p.k)}));
  const all=Array.from({length:laps},(_,k)=>c.gameplay.jumps.map(j=>j.s+k*lapLength)).flat()
    .filter(h=>h>80&&h<length-60&&relays.every(r=>Math.abs(h-r)>100));
  const hurdles=all.length>4?[0,1,2,3].map(i=>all[Math.round(i*(all.length-1)/3)]):all;   // at most four, spread out
  return {id,city:c.city,title:c.title,difficulty:c.difficulty,length,laps,lapLength,relays,hurdles,sections,mud,outline:outlineOf(lap)};
}
