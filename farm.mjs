// The wheat field (2026-10-09, the user: 「可以餵養這些動物同時可以獲得小麥種子的機會」「把種小麥的機制放進去」): six beds in the
// ranch's fenced field. Seeds are bought in the shop or brought home from a race; a seed sown in an empty bed is ripe after `grow` of
// real time (it grows while the game is closed: only the moment it was sown is kept); a ripe bed gives `yield` wheat, a
// food that is not sold. One crop, two taps (sow, reap), nothing withers: staying away costs nothing.
// Seeds and wheat are counted in the item bag (stable-care ITEMS `seed`, `wheat`); the beds live in hoofbeat.farm.v1.
// The ranch grows with the buddies owned (2026-10-10, the user: 「簡單容易理解的機制」「同意做」): the ranch's level is how many
// buddies there are; every buddy opens `each` beds (to `beds` at most), every `stalls` buddies a dormitory. Nothing else
// unlocks anything. bedsFor / dormsFor / pensFor: what a ranch of n buddies has (pens: the layout's fenced fields,
// [across, deep] each, four beds a pen and the odd two in a last one).
export const FARM=Object.freeze({beds:12,each:2,pond:4,   // pond: the pond's places to cast (2026-10-11: the field's rules, bait for seed and fish for wheat)
 
  grow:45e3,   // playtest build: 45 seconds, to feel the whole round in one go (2026-10-09, the user: 「快速版先不要等那麼久」; it was 20 minutes; meant: a few hours)
  yield:3,raceSeeds:1});   // raceSeeds: what a finished race brings home
export const bedsFor=n=>Math.min(FARM.beds,Math.max(1,n)*FARM.each),stallsFor=n=>Math.max(1,n);   // a hut for every buddy (2026-10-11: it was a dormitory of six, a whole one at a time)
export const pensFor=beds=>[...Array(Math.floor(beds/4)).fill([2,2]),...(beds%4?[[2,1]]:[])];
const KEY='hoofbeat.farm.v1';
export const freshFarm=()=>({beds:Array(FARM.beds).fill(null),pond:Array(FARM.pond).fill(null)});   // a bed: null (empty) or {at: when it was sown, ms}
export function readFarm(storage){
  let s={};try{s=JSON.parse(storage.getItem(KEY)||'{}')}catch{}
  const list=k=>freshFarm()[k].map((_,i)=>Number.isFinite(s[k]?.[i]?.at)?{at:s[k][i].at}:null);return {beds:list('beds'),pond:list('pond')};
}
export const saveFarm=(storage,farm)=>{try{storage.setItem(KEY,JSON.stringify(farm));return true}catch{return false}};
// 0 empty · 1 sprouts · 2 growing · 3 ripe
export const stage=(bed,now=Date.now())=>!bed?0:now-bed.at>=FARM.grow?3:now-bed.at>=FARM.grow/3?2:1;
export const growth=(bed,now=Date.now())=>!bed?0:Math.min(1,Math.max(0,(now-bed.at)/FARM.grow));   // 0 just sown … 1 ripe
export const secondsLeft=(bed,now=Date.now())=>Math.max(1,Math.ceil((FARM.grow-(now-bed.at))/1000));
// A tap on bed i → {farm, items, did: 'sow' | 'reap'}, or {fail, secs?} (nothing changes on a fail). cast: the same for
// place i of the pond (bait in, fish out).
const work=(farm,key,items,i,now,seed,crop,none,early)=>{
  const list=farm[key]||[];if(!(i>=0&&i<list.length))return {fail:'?'};
  const bed=list[i],s=stage(bed,now),next=[...list],bag={...items};
  if(s===0){if(!(bag[seed]>0))return {fail:none};bag[seed]--;next[i]={at:now};return {farm:{...farm,[key]:next},items:bag,did:'sow'};}
  if(s===3){bag[crop]=(bag[crop]||0)+FARM.yield;next[i]=null;return {farm:{...farm,[key]:next},items:bag,did:'reap'};}
  return {fail:early,secs:secondsLeft(bed,now)};
};
export const tend=(farm,items,i,now=Date.now())=>work(farm,'beds',items,i,now,'seed','wheat','沒有種子：去商店買，或跑比賽拿','還沒熟');
export const cast=(farm,items,i,now=Date.now())=>work(farm,'pond',items,i,now,'bait','fish','沒有魚餌：去商店買','魚還沒上鉤');
