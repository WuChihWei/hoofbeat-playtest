// Stable care (stable page mock): per buddy Hunger / Stamina / Mood / Clean (0-100) + xp (level), one shared item bag.
// Feed eats one food item; Brush needs a brush (not used up). Care feeds the race (raceForm) and the race feeds care
// back (afterRace): racing tires the buddy and makes it hungry, and earns xp. Stamina comes back on its own over time.
// `stamina` here is how rested the buddy is: 精神 in the UI since 2026-10-04 (體力 is the buddy's own Stamina number,
// its sprint pool in a race: slice-config buddyStats).
// Shop items (price in coins) go into the same bag: foods are eaten by Feed (the one picked in Items), care items are
// used from Items; two of them are one-race buffs kept on the horse (`buff`, spent by the next race).
// Everything lives in localStorage (hoofbeat.care.v2 / hoofbeat.items.v1). Icons: assets/stable/item_<id>.webp.
import {MAX_LEVEL} from './playable/slice-config.mjs?v=r301';
export const ITEMS=[
  // food: +Hunger, +Mood (stamina: +Stamina)
  {id:'hay',name:'乾草',kind:'food',food:25,mood:2,price:20},{id:'carrot',name:'紅蘿蔔',kind:'food',food:15,mood:6,price:15},
  {id:'apple',name:'蘋果',kind:'food',food:15,mood:8,price:15},{id:'feed',name:'飼料',kind:'food',food:35,mood:2,price:35},
  {id:'oats',name:'燕麥',kind:'food',food:30,mood:3,price:30},{id:'alfalfa',name:'苜蓿',kind:'food',food:28,mood:4,price:30},
  {id:'sugar',name:'方糖',kind:'food',food:5,mood:12,price:15},{id:'mint',name:'薄荷糖',kind:'food',food:5,mood:10,price:15},
  {id:'cookie',name:'夥伴餅乾',kind:'food',food:10,mood:10,price:25},{id:'pear',name:'西洋梨',kind:'food',food:15,mood:7,price:20},
  {id:'watermelon',name:'西瓜',kind:'food',food:12,mood:9,price:25},{id:'beet',name:'甜菜粕',kind:'food',food:35,mood:2,price:35},
  {id:'mash',name:'溫熱麥麩粥',kind:'food',food:25,mood:6,stamina:10,price:45},
  // care: used from Items
  {id:'shampoo',name:'洗毛精',kind:'care',mood:5,clean:40,price:40},{id:'vitamin',name:'維他命',kind:'care',stamina:20,price:50},
  {id:'electrolyte',name:'電解水',kind:'care',stamina:30,price:70},{id:'hoofoil',name:'護足油',kind:'care',mood:8,price:30},
  {id:'flyspray',name:'防蚊噴霧',kind:'care',mood:8,price:30},{id:'balm',name:'舒緩藥膏',kind:'care',stamina:15,mood:5,price:45},
  {id:'ribbonkit',name:'編鬃套組',kind:'care',mood:20,price:80},
  {id:'energybar',name:'能量棒',kind:'care',buff:{energy:10},price:60},{id:'luckyshoe',name:'幸運符',kind:'care',buff:{bonus:2},price:120},
  // tools (not sold)
  {id:'brush',name:'刷子',kind:'tool'},{id:'bucket',name:'水桶',kind:'tool'},{id:'towel',name:'毛巾',kind:'tool'},
];
export const itemEffect=it=>[it.food&&`飽足 +${it.food}`,it.mood&&`心情 +${it.mood}`,it.stamina&&`精神 +${it.stamina}`,it.clean&&`清潔 +${it.clean}`,
  it.buff?.energy&&`下一場起跑能量 +${it.buff.energy}`,it.buff?.bonus&&`下一場名次獎勵 ×${it.buff.bonus}`].filter(Boolean).join(' · ');
const STARTER={hay:24,carrot:18,apple:12,feed:8,brush:5,bucket:10,towel:6};   // everything else starts at 0
const COOLDOWN=1200;
export const freshCare=()=>({hunger:60,stamina:80,mood:70,clean:70,xp:0,last:0,at:0});   // at: when stamina was last settled
const STATS=['hunger','stamina','mood','clean'];
const STAMINA_PER_MIN=10;   // playtest build: full from empty in ~10 min, so back-to-back test races are not all tired (was 2: ~50 min)
const clamp=v=>Math.max(0,Math.min(100,Math.round(v)));

// ids: every horse the player owns (home.js ROSTER); a horse new to the save starts fresh.
export function readCare(storage,ids=[0,1,2]){
  let saved={};try{saved=JSON.parse(storage.getItem('hoofbeat.care.v2')||'{}')}catch{}
  return Object.fromEntries(ids.map(id=>{const r=freshCare(),s=saved[id]||{};
    for(const k of STATS)if(Number.isFinite(s[k]))r[k]=clamp(s[k]);
    if(Number.isFinite(s.xp))r.xp=Math.max(0,s.xp);if(Number.isFinite(s.at))r.at=s.at;if(s.buff)r.buff=s.buff;return [id,recover(r)];}));
}
export function readItems(storage){
  let saved={};try{saved=JSON.parse(storage.getItem('hoofbeat.items.v1')||'{}')}catch{}
  return Object.fromEntries(ITEMS.map(i=>[i.id,Number.isFinite(saved[i.id])?Math.max(0,saved[i.id]):STARTER[i.id]??0]));
}
export function saveCare(storage,care,items){
  try{storage.setItem('hoofbeat.care.v2',JSON.stringify(care));storage.setItem('hoofbeat.items.v1',JSON.stringify(items));return true}catch{return false}
}
export const XP_LEVEL=40,level=r=>Math.min(MAX_LEVEL,1+Math.floor(r.xp/XP_LEVEL));   // the level sets how much of its numbers a buddy uses (slice-config buddyStats)
// Stamina the horse has rested back since `at`.
export function recover(r,now=Date.now()){
  if(!r.at)return {...r,at:now};
  return {...r,stamina:clamp(r.stamina+(now-r.at)/60000*STAMINA_PER_MIN),at:now};
}

// Race form: what the stable makes of a buddy's own numbers on the track (small on purpose: rhythm still decides).
// base: the race config with this buddy's numbers at its level (slice-config racing(): base speed, rhythm gains, stamina).
//   hunger < 30   base speed -5% (hungry)                   mood    rhythm gain ×0.9 (0) … ×1.1 (100)
//   clean < 30    rhythm gain ×0.95 (muddy coat)            stamina (精神)  start energy = 30% of it (0–30 of 50);
//                                                                    below 25 the sprint is 30% shorter (tired)
export function raceForm(r,base){
  const speed=r.hunger<30?.95:1,dirty=r.clean<30,mood=(.9+.2*r.mood/100)*(dirty?.95:1),tired=r.stamina<25;
  const config={baseSpeed:+(base.baseSpeed*speed).toFixed(3),rhythmGain:base.rhythmGain*mood,goodRhythmGain:base.goodRhythmGain*mood,stamina:base.stamina,
    startEnergy:Math.min(base.energyMax,Math.round(r.stamina*.3)+(r.buff?.energy||0)),boostDuration:+(base.boostDuration*(tired?.7:1)).toFixed(3),
    placeBonus:base.placeBonus.map(b=>b*(r.buff?.bonus||1))};
  const notes=[`起跑能量 ${config.startEnergy}`];
  if(r.hunger<30)notes.push('肚子餓：速度變慢');if(tired)notes.push('疲累：衝刺縮短');if(dirty)notes.push('毛髒了：節奏變差');
  if(r.buff?.energy)notes.push(`能量棒 +${r.buff.energy}`);if(r.buff?.bonus)notes.push(`幸運符：名次獎勵 ×${r.buff.bonus}`);
  return {config,notes};
}
// Relay form: every leg runs on its own buddy's form (bases[k]: that buddy's numbers; speed, rhythm, stamina, sprint
// length, as raceForm); the start energy is the first buddy's, and buffs count from any of the three (energy bars add
// up, the best lucky charm applies).
export function relayForm(rs,bases,names=rs.map((_,i)=>`#${i+1}`)){
  const forms=rs.map((r,i)=>raceForm(r,bases[i])),bonus=Math.max(1,...rs.map(r=>r.buff?.bonus||1)),base=bases[0];
  const startEnergy=Math.min(base.energyMax,Math.round(rs[0].stamina*.3)+rs.reduce((s,r)=>s+(r.buff?.energy||0),0));
  const config={...forms[0].config,startEnergy,placeBonus:base.placeBonus.map(b=>b*bonus),
    legs:forms.map(({config:c})=>({baseSpeed:c.baseSpeed,rhythmGain:c.rhythmGain,goodRhythmGain:c.goodRhythmGain,stamina:c.stamina,boostDuration:c.boostDuration}))};
  // Cover line, short: the start energy, then only what holds a horse back (hungry / tired / muddy).
  const warn=forms.map((f,i)=>[names[i],f.notes.filter(n=>/^(肚子餓|疲累|毛髒了)/.test(n)).map(n=>n.split('：')[0].replace('了',''))]).filter(([,w])=>w.length);
  const notes=[`起跑能量 ${startEnergy}`,...warn.map(([n,w])=>`${n}：${w.join('、')}`)];
  if(bonus>1)notes.push(`幸運符：名次獎勵 ×${bonus}`);
  return {config,notes};
}
// After a race: -12 hunger, -25 stamina, -20 clean (dust), mood up for a top-two finish, xp by place 1st–5th (+1 per 5
// perfect hits): a good 2nd place ≈ 27 xp, so a level (40 xp) takes about two good races.
export const RACE_XP=[30,20,12,8,5];
export function afterRace(r,{rank,perfect=0},now=Date.now()){
  const c=recover(r,now),xp=RACE_XP[rank-1]+Math.floor(perfect/5),lv=level(c);
  const next={...c,buff:undefined,hunger:clamp(c.hunger-12),stamina:clamp(c.stamina-25),mood:clamp(c.mood+(rank===1?6:rank===2?2:0)),
    clean:clamp((c.clean??70)-20),xp:c.xp+xp};
  return {care:next,xp,levelUp:level(next)>lv};
}
// A solo run is practice (2026-10-04, the user: it earns xp too): xp by the stars the run was worth (+1 per 5 perfect
// hits), about half a relay's; no wear, no buffs spent.
export const SOLO_XP=[6,10,15];
export function afterSolo(r,{stars,perfect=0}){const xp=SOLO_XP[stars-1]+Math.floor(perfect/5),next={...r,xp:r.xp+xp};return {care:next,xp,levelUp:level(next)>level(r)};}

// -> {care, items, msg} or {fail} (nothing changes on a fail). food: the item picked in the Items panel.
// Brushing cleans the coat (+30) and cheers a little (+6 mood).
export function careAction(record,items,action,food='carrot',now=Date.now()){
  if(now-record.last<COOLDOWN)return {fail:'慢一點，讓牠休息一下'};
  const r={...record,last:now},bag={...items};
  if(action==='feed'){
    const it=ITEMS.find(i=>i.id===food&&i.food&&bag[i.id]>0)||ITEMS.find(i=>i.food&&bag[i.id]>0);
    if(!it)return {fail:'沒有飼料了'};
    if(r.hunger>=100)return {fail:'已經吃飽了'};
    bag[it.id]--;r.hunger=clamp(r.hunger+it.food);r.mood=clamp(r.mood+it.mood);r.stamina=clamp(r.stamina+(it.stamina||0));
    return {care:r,items:bag,msg:`吃了${it.name}`,item:it.id};
  }
  if(action==='use'){   // `food` names the care item here
    const it=ITEMS.find(i=>i.id===food&&i.kind==='care');
    if(!it||!bag[it.id])return {fail:'沒有這個道具'};
    if(it.buff&&Object.keys(it.buff).some(k=>r.buff?.[k]))return {fail:'下一場已經有這個效果了'};
    bag[it.id]--;r.mood=clamp(r.mood+(it.mood||0));r.stamina=clamp(r.stamina+(it.stamina||0));r.clean=clamp((r.clean??70)+(it.clean||0));if(it.buff)r.buff={...r.buff,...it.buff};
    return {care:r,items:bag,msg:`用了${it.name}`,item:it.id};
  }
  if(action==='brush'){
    if(!bag.brush)return {fail:'需要一把刷子'};
    r.mood=clamp(r.mood+6);r.clean=clamp((r.clean??70)+30);return {care:r,items:bag,msg:'刷得閃閃發亮'};
  }
  return {fail:'?'};
}

// self-check: copy to a .mjs and run  node -e "import('./x.mjs').then(m=>m.demo())"
export function demo(){
  const mem=new Map(),st={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v)},ok=(c,m)=>{if(!c)throw new Error(m)};
  const care=readCare(st),items=readItems(st),r0=care[1];
  const fed=careAction(r0,items,'feed','carrot',1e6);ok(fed.items.carrot===17&&fed.care.hunger===75,'feed');
  ok(careAction(fed.care,fed.items,'feed','carrot',1e6+100).fail,'cooldown');
  const br=careAction(r0,{...items,brush:0},'brush','carrot',1e6);ok(br.fail,'no brush');
  saveCare(st,{...care,1:fed.care},fed.items);ok(readItems(st).carrot===17&&readCare(st)[1].hunger===75,'persist');
  const base={baseSpeed:12,rhythmGain:.32,goodRhythmGain:.22,stamina:20,boostDuration:3,energyMax:50,placeBonus:[50,30,15]};
  const fresh=raceForm({...freshCare(),stamina:100,mood:100,xp:0},base);ok(fresh.config.baseSpeed===12&&fresh.config.stamina===20&&fresh.config.startEnergy===30&&Math.abs(fresh.config.rhythmGain-.352)<1e-9,'form fresh');
  const worn=raceForm({...freshCare(),hunger:10,stamina:10,mood:0,xp:400},base);ok(worn.config.baseSpeed===11.4&&worn.config.boostDuration===2.1&&worn.notes.length===3,'form worn (the level is in the base numbers, not here)');
  ok(level({xp:0})===1&&level({xp:79})===2&&level({xp:99999})===MAX_LEVEL,'levels stop at the top');
  const run=afterSolo({...freshCare(),xp:30,hunger:60},{stars:2,perfect:11});ok(run.xp===12&&run.levelUp&&run.care.hunger===60,'a solo run: xp, no wear');
  const raced=afterRace({...freshCare(),xp:35,at:1e6},{rank:1,perfect:4},1e6);ok(raced.care.stamina===55&&raced.care.hunger===48&&raced.xp===30&&raced.levelUp,'after race');
  ok(raced.care.clean===50,'clean after race');
  ok(RACE_XP.every((x,i)=>afterRace(freshCare(),{rank:i+1},1e6).xp===x),'xp for every place of the five-horse field');
  const brushed=careAction({...r0,clean:10},items,'brush','carrot',1e6).care;ok(brushed.clean===40&&brushed.mood===76,'brush cleans');
  const muddy=raceForm({...freshCare(),stamina:100,mood:100,clean:0,xp:0},base);ok(muddy.config.startEnergy===30&&Math.abs(muddy.config.rhythmGain-.3344)<1e-9&&muddy.notes.length===2,'form dirty');
  ok(recover({...freshCare(),stamina:10,at:0+1},1+60000*2).stamina===10+2*STAMINA_PER_MIN,'rest');
  const bag={...items,energybar:1,luckyshoe:1},used=careAction(r0,bag,'use','energybar',1e6);ok(used.care.buff.energy===10&&used.items.energybar===0,'use buff');
  ok(careAction(used.care,{...used.items,energybar:1},'use','energybar',1e7).fail,'buff once');
  const lucky=careAction(used.care,used.items,'use','luckyshoe',1e7).care,bf=raceForm({...lucky,stamina:100},base);
  ok(bf.config.startEnergy===40&&bf.config.placeBonus[0]===100,'buff form');ok(afterRace(lucky,{rank:2},1e7).care.buff===undefined,'buff spent');
  ok(readItems(st).oats===0&&ITEMS.every(i=>i.kind==='tool'||i.price>0),'shop stock');
  const relay=relayForm([{...freshCare(),stamina:100},{...freshCare(),hunger:10,buff:{energy:10}},{...freshCare(),stamina:10,buff:{bonus:2}}],[base,base,{...base,stamina:35}],['A','B','C']);
  ok(relay.config.startEnergy===40&&relay.config.legs[1].baseSpeed===11.4&&relay.config.legs[2].boostDuration===2.1&&relay.config.legs[2].stamina===35&&relay.config.placeBonus[0]===100,'relay form: each leg its own buddy');
  console.log('stable-care ok');
}
