// Stable care: per buddy Hunger and Clean (0-100) + xp (level), one shared item bag. Two numbers, both only worn by
// racing (2026-10-10, the user, on the MVP: 「精神、心情拿掉」; there were four, and the solo stages read none of them):
//   Hunger  fed with wheat from the ranch's field (a treat fills a little and teaches a little)
//   Clean   brushed (the brush is not used up)
// Both are felt in every race, solo and relay (raceForm): a hungry buddy starts with less energy and runs slower, a
// dusty one builds its combo slower. Racing wears both and earns xp (afterRace, afterSolo).
// MVP: `hidden` items are not sold and not shown (the care items, the one-race buffs, most foods); what a save holds of
// them stays in the bag, unused. Everything lives in localStorage (hoofbeat.care.v2 / hoofbeat.items.v1).
// Icons: assets/stable/item_<id>.webp.
import {MAX_LEVEL,MVP} from './playable/slice-config.mjs?v=r471';
export const ITEMS=[
  // the ranch's crop (farm.mjs): wheat is reaped from the field, not sold; its seed is bought with coins or brought home
  // from a race
  {id:'wheat',name:'小麥',kind:'food',food:30},{id:'seed',name:'小麥種子',kind:'seed',price:10},
  // treats: a little filling, a little xp
  ...[{id:'carrot',name:'紅蘿蔔',kind:'food',food:10,xp:2,price:15},{id:'apple',name:'蘋果',kind:'food',food:10,xp:3,price:20},
  {id:'cookie',name:'夥伴餅乾',kind:'food',food:15,xp:5,price:35}].map(i=>MVP.treats?i:{...i,kind:'hidden',hidden:true}),   // MVP: wheat is the food
  // tools (not sold)
  {id:'brush',name:'刷子',kind:'tool'},
  // hidden for the MVP (kept so a save's counts survive)
  ...['hay','feed','oats','alfalfa','sugar','mint','pear','watermelon','beet','mash','shampoo','vitamin','electrolyte','hoofoil','flyspray','balm','ribbonkit','energybar','luckyshoe','bucket','towel'].map(id=>({id,name:id,kind:'hidden',hidden:true})),
];
export const itemEffect=it=>[it.food&&`飽足 +${it.food}`,it.xp&&`經驗 +${it.xp}`].filter(Boolean).join(' · ');
const STARTER={wheat:8,seed:3,carrot:2,brush:1};   // wheat to feed with and seeds to sow at the start; everything else starts at 0
const COOLDOWN=1200;
export const freshCare=()=>({hunger:60,clean:70,xp:0,last:0});
const STATS=['hunger','clean'];
const clamp=v=>Math.max(0,Math.min(100,Math.round(v)));

// ids: every horse the player owns (home.js ROSTER); a horse new to the save starts fresh.
export function readCare(storage,ids=[0,1,2]){
  let saved={};try{saved=JSON.parse(storage.getItem('hoofbeat.care.v2')||'{}')}catch{}
  return Object.fromEntries(ids.map(id=>{const r=freshCare(),s=saved[id]||{};
    for(const k of STATS)if(Number.isFinite(s[k]))r[k]=clamp(s[k]);
    if(Number.isFinite(s.xp))r.xp=Math.max(0,s.xp);return [id,r];}));
}
export function readItems(storage){
  let saved={};try{saved=JSON.parse(storage.getItem('hoofbeat.items.v1')||'{}')}catch{}
  return Object.fromEntries(ITEMS.map(i=>[i.id,Number.isFinite(saved[i.id])?Math.max(0,saved[i.id]):STARTER[i.id]??0]));
}
export function saveCare(storage,care,items){
  try{storage.setItem('hoofbeat.care.v2',JSON.stringify(care));storage.setItem('hoofbeat.items.v1',JSON.stringify(items));return true}catch{return false}
}
export const XP_LEVEL=40,level=r=>MVP.levels?Math.min(MAX_LEVEL,1+Math.floor(r.xp/XP_LEVEL)):MAX_LEVEL;   // MVP: every buddy at full strength (xp still counts, unseen)   // the level sets how much of its numbers a buddy uses (slice-config buddyStats)
export const recover=r=>r;   // nothing comes back by itself any more (it was the stamina's rest); kept for its callers
// Race form: what the stable makes of a buddy's own numbers on the track (small on purpose: the rhythm still decides).
// base: the race config with this buddy's numbers at its level (slice-config racing()).
//   hunger   start energy = FORM.energy of it; under FORM.low the speed falls, to ×FORM.speed at 0
//   clean    under FORM.low the combo builds slower (solo: accel; relay: the rhythm gains), to ×FORM.combo at 0
export const FORM={low:50,speed:.9,combo:.8,energy:.3};
const dip=(v,to)=>v>=FORM.low?1:to+(1-to)*v/FORM.low;
export function raceForm(r,base){
  const speed=dip(r.hunger,FORM.speed),combo=dip(r.clean,FORM.combo);
  const config={baseSpeed:+(base.baseSpeed*speed).toFixed(3),rhythmGain:base.rhythmGain*combo,goodRhythmGain:base.goodRhythmGain*combo,accel:+((base.accel??0)*combo).toFixed(4),
    stamina:base.stamina,startEnergy:Math.min(base.energyMax,Math.round(r.hunger*FORM.energy)),boostDuration:base.boostDuration,placeBonus:base.placeBonus};
  const notes=[`起跑能量 ${config.startEnergy}`];
  if(speed<1)notes.push(`肚子餓：速度 −${Math.round((1-speed)*100)}%`);if(combo<1)notes.push(`毛髒了：連擊 −${Math.round((1-combo)*100)}%`);
  return {config,notes};
}
// Solo form: the one buddy's, given to the game as its leg (slice-game legForm reads config.legs[0]).
export function soloForm(r,base){const f=raceForm(r,base);return {config:{startEnergy:f.config.startEnergy,legs:[{baseSpeed:f.config.baseSpeed,accel:f.config.accel}]},notes:f.notes};}
// Relay form: every leg runs on its own buddy's form; the start energy is the first buddy's.
export function relayForm(rs,bases,names=rs.map((_,i)=>`#${i+1}`)){
  const forms=rs.map((r,i)=>raceForm(r,bases[i])),base=bases[0];
  const config={...forms[0].config,legs:forms.map(({config:c})=>({baseSpeed:c.baseSpeed,rhythmGain:c.rhythmGain,goodRhythmGain:c.goodRhythmGain,accel:c.accel,stamina:c.stamina,boostDuration:c.boostDuration}))};
  const warn=forms.map((f,i)=>[names[i],f.notes.filter(n=>/^(肚子餓|毛髒了)/.test(n)).map(n=>n.split('：')[0].replace('了',''))]).filter(([,w])=>w.length);
  return {config,notes:[`起跑能量 ${config.startEnergy}`,...warn.map(([n,w])=>`${n}：${w.join('、')}`)]};
}
// What a race costs and earns. WEAR: hunger and clean lost (a relay leg, a solo run): a wheat (+30) feeds about two solo
// runs, a brushing (+30) cleans as many. xp by place 1st–5th (relay) or by the run's stars (solo), +1 per 5 perfect hits.
export const RACE_XP=[30,20,12,8,5],SOLO_XP=[6,10,15],WEAR={relay:{hunger:20,clean:20},solo:{hunger:15,clean:12}};
const worn=(r,w,xp)=>{const next={...r,hunger:clamp(r.hunger-w.hunger),clean:clamp(r.clean-w.clean),xp:r.xp+xp};return {care:next,xp,levelUp:level(next)>level(r)};};
export const afterRace=(r,{rank,perfect=0})=>worn(r,WEAR.relay,RACE_XP[rank-1]+Math.floor(perfect/5));
export const afterSolo=(r,{stars,perfect=0})=>worn(r,WEAR.solo,SOLO_XP[stars-1]+Math.floor(perfect/5));

// -> {care, items, msg, levelUp?} or {fail} (nothing changes on a fail). food: the item picked in the Items panel.
export function careAction(record,items,action,food='wheat',now=Date.now()){
  if(now-record.last<COOLDOWN)return {fail:'慢一點，讓牠休息一下'};
  const r={...record,last:now},bag={...items};
  if(action==='feed'){
    const it=ITEMS.find(i=>i.id===food&&i.food&&bag[i.id]>0);   // the food asked for and no other: a treat is never eaten for want of wheat
    if(!it)return {fail:'沒有小麥了：去麥田收成'};
    if(r.hunger>=100)return {fail:'已經吃飽了'};
    bag[it.id]--;r.hunger=clamp(r.hunger+it.food);r.xp+=it.xp||0;
    return {care:r,items:bag,msg:`吃了${it.name}`,item:it.id,levelUp:level(r)>level(record)};
  }
  if(action==='brush'){
    if(!bag.brush)return {fail:'需要一把刷子'};
    if(r.clean>=100)return {fail:'已經很乾淨了'};
    r.clean=clamp(r.clean+30);return {care:r,items:bag,msg:'刷得閃閃發亮'};
  }
  return {fail:'?'};
}
