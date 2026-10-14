// Stable care: per buddy Hunger and Clean (0-100) + xp (level), one shared item bag. Two numbers, both only worn by
// racing (2026-10-10, the user, on the MVP: 「精神、心情拿掉」; there were four, and the solo stages read none of them):
//   Hunger  fed with wheat from the ranch's field (a treat fills a little and teaches a little)
//   Clean   brushed (the brush is not used up)
// Both are felt in every race, solo and relay (raceForm): a hungry buddy starts with less energy and runs slower, a
// dusty one fills its ball slower. Racing wears both and earns xp (afterRace, afterSolo).
// MVP: `hidden` items are not sold and not shown (the care items, the one-race buffs, most foods); what a save holds of
// them stays in the bag, unused. Everything lives in localStorage (hoofbeat.care.v2 / hoofbeat.items.v1).
// Icons: assets/stable/item_<id>.webp.
import {MVP} from './playable/slice-config.mjs?v=r722';
export const ITEMS=[
  // the ranch's crop (farm.mjs): wheat is reaped from the field, not sold; its seed is bought with coins or brought home
  // from a race
  {id:'wheat',name:'小麥',kind:'food',food:30,xp:2,sell:5},{id:'seed',name:'小麥種子',kind:'seed',price:10,note:'種在麥田，長成小麥'},
  // the pond's catch (farm.mjs, 2026-10-11: the field's rules again): fish, and the bait that is cast for it. sell: what one
  // of a harvest brings in the shop (4 while a crop takes 45 s in the playtest build: 3 a plot less the 10 of its seed is
  // about what a race pays for the same time; meant: 5, with a crop that takes hours)
  {id:'fish',name:'魚',kind:'food',food:30,xp:2,price:8},{id:'bait',name:'魚餌',kind:'seed',hidden:true,note:'放進魚池，釣到魚'},   // fishing is put away (2026-10-14, the user: hide the fishing, fish is bought with coins): fish 8 a piece in the shop, not sold back; bait has no price, so the shop does not list it (the pond's rules stay in farm.mjs)
 
  // treats: a little filling, a little xp
  ...[{id:'carrot',name:'紅蘿蔔',kind:'food',food:10,xp:2,price:15},{id:'apple',name:'蘋果',kind:'food',food:10,xp:3,price:20},
  {id:'cookie',name:'夥伴餅乾',kind:'food',food:15,xp:5,price:35}].map(i=>MVP.treats?i:{...i,kind:'hidden',hidden:true}),   // MVP: wheat is the food
  // tools (not sold)
  {id:'brush',name:'刷子',kind:'tool'},
  // hidden for the MVP (kept so a save's counts survive)
  ...['hay','feed','oats','alfalfa','sugar','mint','pear','watermelon','beet','mash','shampoo','vitamin','electrolyte','hoofoil','flyspray','balm','ribbonkit','energybar','luckyshoe','bucket','towel'].map(id=>({id,name:id,kind:'hidden',hidden:true})),
];
// What a buddy eats: the bear and the wolf fish, the others wheat, and not the other one (2026-10-12, the user: the dorm's
// button for what it does not eat is off; it was: the other one fills half). A treat is a treat to everyone.
export const likes=species=>species==='bear'||species==='wolf'?'fish':'wheat',HARVEST=['wheat','fish'];
// Selling a harvest in the shop: all of it at once. → {items, coins}
export function sellAll(items,id){const it=ITEMS.find(i=>i.id===id&&i.sell),n=it?items[id]||0:0;return {items:n?{...items,[id]:0}:items,coins:n*(it?.sell||0)};}
export const itemEffect=it=>[it.food&&`飽足 +${it.food}`,it.xp&&`經驗 +${it.xp}`].filter(Boolean).join(' · ');
const STARTER={wheat:8,seed:3,fish:8,bait:3,carrot:2,brush:1};   // fish like wheat (2026-10-12, the user: 「魚和小麥一樣邏輯」): eight to start with, so a bear or a wolf can be fed before the first catch   // wheat to feed with and seeds to sow at the start; everything else starts at 0
const COOLDOWN=1200;
export const freshCare=()=>({hunger:80,clean:80,xp:0,last:0});
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
// 2026-10-12 (the user: 強度靠等級): a buddy's level is its growth. Every buddy has its full numbers (home.js passes MAX_LEVEL to
// buddyStats); each level over 1 makes it LV_SPEED faster (raceForm). xp: races, and a little from every feed.
// 2026-10-12 (the user: 三個等級就可以，等級區間可以寬一點): three levels, the buddy's three ages (approved-assets GROW). LV_XP: the xp each
// starts at, about 8 solo runs to the second and 16 more to the third. lvPart: how far through its level (0-1), lvLeft: xp to go.
export const LV_SPEED=.08,LV_XP=Object.freeze([0,100,300]),LV_TOP=LV_XP.length,level=r=>MVP.levels?LV_XP.findLastIndex(x=>(r.xp||0)>=x)+1:LV_TOP;
export const lvLeft=r=>level(r)>=LV_TOP?0:LV_XP[level(r)]-r.xp,lvPart=r=>{const l=level(r);return l>=LV_TOP?1:(r.xp-LV_XP[l-1])/(LV_XP[l]-LV_XP[l-1]);};   // MVP: every buddy at full strength (xp still counts, unseen)   // the level sets how much of its numbers a buddy uses (slice-config buddyStats)
export const recover=r=>r;   // nothing comes back by itself any more (it was the stamina's rest); kept for its callers
// Race form: what the stable makes of a buddy's own numbers on the track (small on purpose: the rhythm still decides).
// base: the race config with this buddy's numbers at its level (slice-config racing()).
//   hunger   start energy = FORM.energy of it; under FORM.low the speed falls, to ×FORM.speed at 0
//   clean    shown as 心情 (mood). 2026-10-13 (the user: 刷毛純互動): it costs nothing in a race any more; at FORM.low or over a
//            run's xp is × MOOD_XP (afterSolo, afterRace). Brushing is play, never a chore before a run.
export const FORM={low:50,speed:.9,energy:.3},MOOD_XP=1.1;
const dip=(v,to)=>v>=FORM.low?1:to+(1-to)*v/FORM.low;
// What the player is told (2026-10-13, the user: as little as will do; when to feed, with what follows, and whether the buddy is fit
// to run): no numbers of the game's, only how many feeds or brushings put it right. `clean` is shown as 心情 (mood): brushed up,
// worn by racing, low it charges slower. icon: the same one as its bar in the dorm (ui.js icon).
export const fitness=r=>{const n=k=>r[k]>=FORM.low?0:Math.ceil((FORM.low-r[k])/30);return {feed:n('hunger'),brush:n('clean')};};
export const fitNotes=(r,name='')=>{const f=fitness(r),who=name?name+' ':'';return [f.feed?{icon:'fork',text:`${who}餓了，跑得慢，不能加碼。餵 ${f.feed} 次`}:{icon:'star',ok:true,text:`${who}狀態好`},...(f.brush?[]:[{icon:'smile',ok:true,text:`${who}心情好，經驗 ×${MOOD_XP}`}])];};
export function raceForm(r,base){
  const speed=dip(r.hunger,FORM.speed),combo=1,lv=level(r),grow=1+(lv-1)*LV_SPEED;
  const config={baseSpeed:+(base.baseSpeed*speed*grow).toFixed(3),rhythmGain:base.rhythmGain*combo,goodRhythmGain:base.goodRhythmGain*combo,accel:+((base.accel??0)*combo).toFixed(4),charge:combo,   // charge: how fast the ball fills (slice-game ballStep; 2026-10-11: a dusty coat slowed `accel`, which the ball game never reads)
    stamina:base.stamina,startEnergy:Math.min(base.energyMax,Math.round(r.hunger*FORM.energy)),boostDuration:base.boostDuration,placeBonus:base.placeBonus};
  return {config,notes:fitNotes(r)};
}
// Solo form: the one buddy's, given to the game as its leg (slice-game legForm reads config.legs[0]).
export function soloForm(r,base){const f=raceForm(r,base);return {config:{startEnergy:f.config.startEnergy,legs:[{baseSpeed:f.config.baseSpeed,accel:f.config.accel,charge:f.config.charge}]},notes:f.notes};}
// Relay form: every leg runs on its own buddy's form; the start energy is the first buddy's.
export function relayForm(rs,bases,names=rs.map((_,i)=>`#${i+1}`)){
  const forms=rs.map((r,i)=>raceForm(r,bases[i])),base=bases[0];
  const config={...forms[0].config,legs:forms.map(({config:c})=>({baseSpeed:c.baseSpeed,rhythmGain:c.rhythmGain,goodRhythmGain:c.goodRhythmGain,accel:c.accel,charge:c.charge,stamina:c.stamina,boostDuration:c.boostDuration}))};
  const notes=rs.flatMap((r,i)=>fitNotes(r,names[i]).filter(n=>!n.ok));
  return {config,notes:notes.length?notes:[{icon:'star',ok:true,text:'三隻狀態都好'}]};
}
// What a race costs and earns. WEAR: hunger and clean lost (a relay leg, a solo run): a wheat (+30) feeds about two solo
// runs, a brushing (+30) cleans as many. xp by place 1st–5th (relay) or by the run's stars (solo), +1 per 5 perfect hits.
export const RACE_XP=[30,20,12,8,5],SOLO_XP=[6,10,15],WEAR={relay:{hunger:20,clean:20},solo:{hunger:15,clean:12}};
const worn=(r,w,xp)=>{if(r.clean>=FORM.low)xp=Math.round(xp*MOOD_XP);const next={...r,hunger:clamp(r.hunger-w.hunger),clean:clamp(r.clean-w.clean),xp:r.xp+xp};return {care:next,xp,levelUp:level(next)>level(r)};};
export const afterRace=(r,{rank,perfect=0})=>worn(r,WEAR.relay,RACE_XP[rank-1]+Math.floor(perfect/5));
export const afterSolo=(r,{stars,perfect=0})=>worn(r,WEAR.solo,SOLO_XP[stars-1]+Math.floor(perfect/5));

// 全部餵飽 (2026-10-13, the user: 一鍵餵食全部): the hungriest first, each eats what it likes (likes()) until one more would be
// wasted (over FULL), or the food is gone. buddies: [{id, species}]. -> {care, items, used: {wheat, fish}, fed: [id],
// short: [id] (still under FORM.low), grew: [id]}.
export const FULL=70;
export function feedAll(care,items,buddies){
  const next={...care},bag={...items},used={wheat:0,fish:0},fed=[],grew=[];
  for(const b of [...buddies].sort((a,c)=>care[a.id].hunger-care[c.id].hunger)){const food=likes(b.species),it=ITEMS.find(i=>i.id===food);let r={...next[b.id]},ate=false;
    while(r.hunger<=FULL&&bag[food]>0){bag[food]--;used[food]++;r.hunger=clamp(r.hunger+it.food);r.xp+=it.xp||0;ate=true;}
    if(ate){fed.push(b.id);if(level(r)>level(next[b.id]))grew.push(b.id);next[b.id]=r;}}
  return {care:next,items:bag,used,fed,short:buddies.filter(b=>next[b.id].hunger<FORM.low).map(b=>b.id),grew};
}
// -> {care, items, msg, levelUp?} or {fail} (nothing changes on a fail). food: the item picked in the Items panel.
export function careAction(record,items,action,food='wheat',now=Date.now(),species='horse'){
  if(now-record.last<COOLDOWN)return {fail:'慢一點，讓牠休息一下'};
  const r={...record,last:now},bag={...items};
  if(action==='feed'){
    const it=ITEMS.find(i=>i.id===food&&i.food&&bag[i.id]>0);   // the food asked for and no other: a treat is never eaten for want of wheat
    if(!it)return {fail:food==='fish'?'沒有魚了：去魚池收':'沒有小麥了：去麥田收成'};
    if(HARVEST.includes(it.id)&&likes(species)!==it.id)return {fail:it.id==='fish'?'牠不吃魚':'牠不吃小麥'};
    if(r.hunger>=100)return {fail:'已經吃飽了'};
    bag[it.id]--;r.hunger=clamp(r.hunger+it.food);r.xp+=it.xp||0;
    return {care:r,items:bag,msg:`吃了${it.name}`,item:it.id,levelUp:level(r)>level(record)};
  }
  if(action==='brush'){
    if(!bag.brush)return {fail:'需要一把刷子'};
    if(r.clean>=100)return {fail:'心情已經很好了'};
    r.clean=clamp(r.clean+30);return {care:r,items:bag,msg:'刷得很開心'};
  }
  return {fail:'?'};
}
