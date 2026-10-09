// The wheat field (2026-10-09, the user: 「可以餵養這些動物同時可以獲得小麥種子的機會」「把種小麥的機制放進去」): six beds in the
// ranch's fenced field. Feeding a buddy sometimes turns up a seed; a seed sown in an empty bed is ripe after `grow` of
// real time (it grows while the game is closed: only the moment it was sown is kept); a ripe bed gives `yield` wheat, a
// food that is not sold. One crop, two taps (sow, reap), nothing withers: staying away costs nothing.
// Seeds and wheat are counted in the item bag (stable-care ITEMS `seed`, `wheat`); the beds live in hoofbeat.farm.v1.
export const FARM=Object.freeze({beds:6,
  grow:45e3,   // playtest build: 45 seconds, to feel the whole round in one go (2026-10-09, the user: 「快速版先不要等那麼久」; it was 20 minutes; meant: a few hours)
  yield:3,seedChance:1/3});
const KEY='hoofbeat.farm.v1';
export const freshFarm=()=>({beds:Array(FARM.beds).fill(null)});   // a bed: null (empty) or {at: when it was sown, ms}
export function readFarm(storage){
  let s={};try{s=JSON.parse(storage.getItem(KEY)||'{}')}catch{}
  return {beds:freshFarm().beds.map((_,i)=>Number.isFinite(s.beds?.[i]?.at)?{at:s.beds[i].at}:null)};
}
export const saveFarm=(storage,farm)=>{try{storage.setItem(KEY,JSON.stringify(farm));return true}catch{return false}};
// 0 empty · 1 sprouts · 2 growing · 3 ripe
export const stage=(bed,now=Date.now())=>!bed?0:now-bed.at>=FARM.grow?3:now-bed.at>=FARM.grow/3?2:1;
export const growth=(bed,now=Date.now())=>!bed?0:Math.min(1,Math.max(0,(now-bed.at)/FARM.grow));   // 0 just sown … 1 ripe
export const secondsLeft=(bed,now=Date.now())=>Math.max(1,Math.ceil((FARM.grow-(now-bed.at))/1000));
// A tap on bed i → {farm, items, did: 'sow' | 'reap'}, or {fail, secs?} (nothing changes on a fail).
export function tend(farm,items,i,now=Date.now()){
  const bed=farm.beds[i],s=stage(bed,now),beds=[...farm.beds],bag={...items};
  if(s===0){if(!(bag.seed>0))return {fail:'沒有種子：餵夥伴的時候有機會找到'};bag.seed--;beds[i]={at:now};return {farm:{beds},items:bag,did:'sow'};}
  if(s===3){bag.wheat=(bag.wheat||0)+FARM.yield;beds[i]=null;return {farm:{beds},items:bag,did:'reap'};}
  return {fail:'還沒熟',secs:secondsLeft(bed,now)};
}
export const seedFound=(roll=Math.random())=>roll<FARM.seedChance;
