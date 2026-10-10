// Progress and economy: the five levels and their stars, which horses the player owns and what the others cost, the
// three small missions of a run, the daily first-run bonus. Pure rules (no storage, no DOM): home.js keeps the state
// in localStorage ('hoofbeat.progress.v1') and calls these. Run `node dist/playable/progress.mjs` for the self-check.
import {MVP} from './slice-config.mjs?v=r426';
//
// The loop it builds: a run pays coins (picked up, missions, the day's first run) and stars (by time); stars open the
// next level and the relay, and gift horses; coins or diamonds buy a horse sooner; a faster horse makes the next star
// reachable. Something is always one or two runs away, and the results screen says what (nextGoal).

// A level is a city's solo run. Stars by wall-clock time: 1 for finishing, 2 under `silver`, 3 under `gold` (seconds).
// A stage opens once the one before it has been finished (its first star; 2026-10-06: a tester never got past the
// first — it took stars in total, 2 a stage, a silver each). Stage 1's own times are looser too: silver about half the
// notes hit, gold 70%. Times from the solo simulation (2026-10-04, retuned with the buddy numbers: the mean
// of the three starters at LV 1 on level 1 … LV 5 on level 5, sprints used, no apples): silver is about 70% of the
// notes hit, gold about 87%; the last two levels' gold is about 95%: it wants apples, a higher level or a faster buddy.
// 2026-10-05: a solo run is one lap everywhere (slice-config SOLO.target 600; the user: 30–40 s a run). Taipei, Paris
// and Seoul were two laps (58 / 52.5, 58 / 53, 56 / 49.5): their times are those × the same bot's time over one lap ÷ its
// time over two (.52, .53, .53 at the silver share; .52, .52, .52 at the gold one), so each star asks for the same
// riding as before. Tokyo and Stockholm were one lap already, but long ones (734 and 791 m: 41–43 s at the silver share):
// their tracks were shortened to 654 and 711 m (cities/tokyo.mjs, stockholm.mjs) and their times (39.5 / 35, 41 / 36)
// scaled the same way. At the silver share a run now takes 31–39 s on every level.
// 2026-10-06 (a tester: "同時要看很多事"; the user: 機制逐關開放, 節奏速度依關卡遞增): a stage adds one thing to the last.
// locks: what the stage does not have yet (lane: no lane changes, everything to pick up is in the middle lane; hurdle: no
// fences; sprint: no charge button). plain: the opening four-note phrases all the way (slice-config EASY_CHART).
// tempo: simulation seconds per real second on that stage (a note every .6 / tempo s: .43, .375, .34, .32, .31); the
// times here are wall-clock seconds at that tempo (the old ones × 1.95 / tempo). lesson: the practice lessons shown
// before the stage's first run ([from, to) of slice-app LESSONS): what it adds.
// Star times (r309, measured with tools/stage-times.mjs: the starter buddy at the stage's level, by the stage's own
// rules): silver about 70% of the notes hit and gold about 87% (stage 1: 50% and 70%; stage 2: a little under 70% and
// about 80%; the last two golds ask for more). Stage 2 is one lap (cities/tokyo.mjs soloLaps: without the sprint two
// laps took over a minute), so stages 1 and 2 take about half a minute and the others 45 s or so.
// 2026-10-07, the ball game (tools/stage-times-ball.mjs: never holding / letting go at .85 every time, seconds): 27.6 / 20.2,
// 28.8 / 20.7, 50.9 / 36, 48.9 / 34, 49 / 34. Silver is a little under the middle of the two, gold about 6% over the second.
export const LEVELS=Object.freeze([
  {city:'taipei',rivals:0,tempo:1.4,plain:true,locks:{lane:1,hurdle:1,sprint:1},lesson:[0,1],silver:26.5,gold:23},
  {city:'tokyo',rivals:1,tempo:1.6,locks:{hurdle:1,sprint:1},lesson:[1,3],silver:27.5,gold:24.5},
  {city:'paris',rivals:2,tempo:1.75,locks:{},lesson:[3,5],silver:47,gold:41,ram:[3,1.5,14]},   // ram: a rival beside the player comes over at it (slice-game ramStep): [s from its first lean to the hit, s until it is across its line, s between two], real seconds
  {city:'seoul',rivals:4,tempo:1.85,locks:{},silver:45,gold:38.5,ram:[3,1.5,11]},
  {city:'stockholm',rivals:4,tempo:1.95,locks:{},silver:45,gold:38.5,ram:[3,1.5,9]},
]);
export const RELAY_BUDDIES=3;   // the relay (a three-buddy team race) opens once the player has three buddies (2026-10-05: it was 3 stars, when every player started with three)
export const STAR_REWARD={coins:50,gems:1};   // each star, the first time it is earned
// Buddies by id (home.js ROSTER). The three starters are owned from the start. Four of the others are bought with coins
// or with diamonds and are also a gift at a star total (whichever comes first); the three special coats (Buckloosa,
// Snowflake, Roan: 2026-10-04, the user: new animals and special looks sell for diamonds only) and the two other
// animals (10 the llama, 11 the rhino) have a diamond price alone: no coins, no gift by stars. A diamond is priced at about 200 coins (the game does not state the rate or exchange them).
// 2026-10-05 (the user): a new player has ONE buddy; clearing a stage (its first star) gives something: stage 1 the
// second buddy, stage 2 a new mane style, stage 3 the third buddy (so the relay opens), stage 4 the other colours of the
// rider's clothes, stage 5 the llama. `stage` on a price: a gift when that stage is cleared; the two
// early ones can also be bought sooner. PERKS: what is not a buddy.
export const STARTERS=Object.freeze([1]);
// MVP (slice-config MVP.gems off): every buddy has a coin price, the diamond one waits (a race pays 20–40 coins).
export const HORSE_PRICE=Object.freeze({0:{coins:300,gems:2,stage:1},2:{coins:600,gems:3,stage:3},5:{coins:400,gems:2,stars:5},6:{coins:1000,gems:3},7:{coins:800,gems:4,stars:9},4:{coins:1200,gems:5},
  3:{coins:1400,gems:7,stars:12},8:{coins:1800,gems:9},9:{coins:2400,gems:12,stars:15},10:{coins:1600,gems:12,stage:5},11:{coins:2000,gems:10},12:{coins:2200,gems:8},13:{coins:2600,gems:10},14:{coins:2000,gems:8}});
export const PERK_COINS=100;   // MVP.perks off: a stage that gave a perk pays this instead
export const PERKS=Object.freeze({mane:{stage:2,id:'long'},rider:{stage:4}});

export const fresh=()=>({stars:{},owned:[...STARTERS],runs:0,jumps:0,day:null,streak:0});
// A saved state made whole (older saves, hand-edited ones): known cities, 0–3 stars, the starters always owned.
export function restore(saved){
  const p={...fresh(),...(saved&&typeof saved==='object'?saved:null)};
  p.stars=Object.fromEntries(LEVELS.map(l=>[l.city,Math.max(0,Math.min(3,Math.floor(+p.stars?.[l.city]||0)))]));
  p.owned=[...new Set([...STARTERS,...(Array.isArray(p.owned)?p.owned:[]).filter(id=>id in HORSE_PRICE)])];
  for(const [id,c] of Object.entries(HORSE_PRICE))if(c.stage&&cleared(p,c.stage)&&!p.owned.includes(+id))p.owned.push(+id);   // a stage already cleared has given its buddy
  return p;
}
// A stage (1–5) is cleared once its solo run has a star.
export const cleared=(p,stage)=>(p.stars[LEVELS[stage-1]?.city]||0)>=1;
export const maneOpen=(p,id)=>id!==PERKS.mane.id||MVP.perks&&cleared(p,PERKS.mane.stage),riderColors=p=>MVP.perks&&cleared(p,PERKS.rider.stage);
export const totalStars=p=>LEVELS.reduce((s,l)=>s+(p.stars[l.city]||0),0);
export const levelOf=city=>LEVELS.findIndex(l=>l.city===city);
export const unlocked=(p,city)=>{const i=levelOf(city);return i===0||i>0&&cleared(p,i);};
export const relayOpen=p=>p.owned.length>=RELAY_BUDDIES;
export const owns=(p,id)=>p.owned.includes(id);
// Stars for a finished solo run of `seconds` (wall clock) on a level.
export function starsFor(city,seconds){const l=LEVELS[levelOf(city)];return !l?0:seconds<=l.gold?3:seconds<=l.silver?2:1;}
// The time the next star on this level needs, or null when it has all three.
export const nextStarTime=(city,have)=>{const l=LEVELS[levelOf(city)];return !l||have>=3?null:have>=2?l.gold:have>=1?l.silver:null;};
// The level to play next: the first open one short of three stars (else the last).
export const currentLevel=p=>LEVELS.find(l=>unlocked(p,l.city)&&(p.stars[l.city]||0)<3)??LEVELS.at(-1);

// Missions: three per run, taken in turn from the pool (run n takes n, n+1, n+2: two carry over, one is new). test(r)
// reads the run's result (slice-app). MISSION_COINS each, MISSION_ALL more for all three.
export const MISSION_COINS=20,MISSION_ALL=40,PHRASE_COINS=5;   // PHRASE_COINS: for each phrase of the chart ridden without a miss (r.phrases)
// The counts go with the run's length: a relay is about 75 s; a solo run is one lap of 30–40 s (2026-10-05: about 35
// notes, 20 coins and 3 or 4 apples on it), so its counts are about half.
export const BALL_GAME=typeof location==='undefined'||!/[?&](classic|pace|reins|gait)=1/.test(location.search);   // slice-app CLASSIC
const POOL=[
  {id:'combo',text:'連擊到 20',relay:true,test:r=>r.bestCombo>=20},{id:'combo',text:'連擊到 12',solo:true,rhythm:true,test:r=>r.bestCombo>=12},
  {id:'release',text:'漂亮放開 6 次',solo:true,ball:true,test:r=>r.releases>=6},{id:'limit',text:'極限放開 2 次',solo:true,ball:true,test:r=>r.limits>=2},{id:'nopop',text:'一次都不爆',solo:true,ball:true,test:r=>r.pops===0},   // the ball game (2026-10-07)
  {id:'coins',text:'撿 10 枚金幣',relay:true,test:r=>r.pickups>=10},{id:'coins',text:'撿 6 枚金幣',solo:true,test:r=>r.pickups>=6},
  {id:'clean',text:'一座欄都不撞',needs:'hurdle',test:r=>r.stumbles===0},
  {id:'sprint',text:'衝刺 3 次',relay:true,test:r=>r.boosts>=3},{id:'sprint',text:'衝刺 2 次',solo:true,needs:'sprint',test:r=>r.boosts>=2},
  {id:'perfect',text:'Perfect 30 個',relay:true,test:r=>r.perfect>=30},{id:'perfect',text:'Perfect 15 個',solo:true,rhythm:true,test:r=>r.perfect>=15},
  {id:'apples',text:'吃 2 顆蘋果',solo:true,test:r=>r.apples>=2},
  {id:'sharp',text:'命中 85% 以上',rhythm:true,test:r=>r.notes>0&&r.hits/r.notes>=.85},
  {id:'podium',text:'跑進前 3 名',relay:true,test:r=>r.rank<=3},
];
export function missionsFor(run,solo,locks={}){const pool=POOL.filter(m=>(solo?!m.relay:!m.solo)&&!locks[m.needs]&&!(solo&&BALL_GAME?m.rhythm:m.ball));   // a solo run is the ball game: no rhythm missions there, no ball missions in the relay   // locks: not what the stage does not have yet
 return [0,1,2].map(k=>pool[(run+k)%pool.length]);}

// The day's first finished run pays DAILY coins, more each day in a row (to day 7, which also pays diamonds; then the
// count starts over). day: 'YYYY-MM-DD' of the last paid run. → {coins, gems, streak} or null when already paid today.
export const DAILY={coins:50,step:10,gems:3};
const dayNumber=s=>Math.round(Date.parse(s+'T00:00:00Z')/864e5);
export function daily(p,today){
  if(p.day===today)return null;
  const streak=p.day&&dayNumber(today)-dayNumber(p.day)===1&&p.streak<7?p.streak+1:1;
  return {streak,coins:DAILY.coins+DAILY.step*(streak-1),gems:streak===7?DAILY.gems:0};
}

// What a finished run changes. r: the result (slice-app; r.seconds wall clock for a solo run). → {p (the new state),
// coins, gems (to add to the wallets), stars, newStars, missions: [{text, done}], missionCoins, daily, gifts: [horse
// ids], opened: [cities], relayOpened}.
// all: every system on, whatever MVP says (the self-check).
const finish0=(p0,o)=>finish(p0,o);
export function finish(p0,{city,solo,result:r,today,all=false}){
  const p=restore(p0),before=totalStars(p),had3=relayOpen(p),perks0=Object.keys(PERKS).filter(k=>cleared(p,PERKS[k].stage)),out={coins:0,gems:0,newStars:0,gifts:[],perks:[],opened:[],relayOpened:false};
  const list=MVP.missions||all?missionsFor(p.runs,solo,solo?LEVELS[levelOf(city)]?.locks:{}):[];out.missions=list.map(m=>({text:m.text,done:!!m.test(r)}));
  const done=out.missions.filter(m=>m.done).length;out.missionCoins=done*MISSION_COINS+(done===3?MISSION_ALL:0);out.coins+=out.missionCoins;
  out.phraseCoins=(r.phrases||0)*PHRASE_COINS;out.coins+=out.phraseCoins;
  if(solo){const had=p.stars[city]||0,got=starsFor(city,r.seconds);out.stars=Math.max(had,got);out.runStars=got;
    if(!had){const n=LEVELS[levelOf(city)+1];if(n)out.opened=[n.city];}
    if(got>had){out.newStars=got-had;p.stars[city]=got;out.coins+=out.newStars*STAR_REWARD.coins;out.gems+=out.newStars*STAR_REWARD.gems;}}
  else out.stars=p.stars[city]||0;
  out.daily=MVP.daily||all?daily(p,today):null;if(out.daily){p.day=today;p.streak=out.daily.streak;out.coins+=out.daily.coins;out.gems+=out.daily.gems;}
  p.runs++;p.jumps+=r.cleared||0;
  const now=totalStars(p);
  for(const [id,c] of Object.entries(HORSE_PRICE))if((c.stars&&now>=c.stars||c.stage&&cleared(p,c.stage))&&!owns(p,+id)){p.owned.push(+id);out.gifts.push(+id);}
  out.perks=Object.keys(PERKS).filter(k=>cleared(p,PERKS[k].stage)&&!perks0.includes(k));
  if(!MVP.perks&&!all){out.perkCoins=out.perks.length*PERK_COINS;out.coins+=out.perkCoins;out.perks=[];}
  if(!MVP.gems&&!all)out.gems=0;
  out.opened??=[];out.relayOpened=(MVP.relay||all)&&!had3&&relayOpen(p);
  out.p=p;return out;
}
// Buying a horse with coins or diamonds. → {p, cost} or {fail}.
export function buy(p0,id,pay,wallet){
  const p=restore(p0),c=HORSE_PRICE[id];
  if(!c||owns(p,id))return {fail:'已經有這位夥伴了'};
  const cost=c[pay];if(!cost)return {fail:'只能用鑽石解鎖'};if(!(wallet>=cost))return {fail:pay==='gems'?'鑽石不夠':'金幣不夠'};
  p.owned.push(id);return {p,cost};
}
// The nearest thing to look forward to, for the results screen and the map: the next level, the relay, a gift horse
// (by stars), else the cheapest horse to buy (by coins). → {kind, have, need, id?/city?} or null when all is done.
export function nextGoal(p,coins){
  const lock=LEVELS.find(l=>!unlocked(p,l.city));if(lock)return {kind:'level',city:lock.city,need:1,have:0};   // the stage in the way: finish it
  const s=totalStars(p),byStars=[...Object.entries(HORSE_PRICE).filter(([id,c])=>c.stars&&!owns(p,+id)).map(([id,c])=>({kind:'gift',id:+id,need:c.stars}))].sort((a,b)=>a.need-b.need)[0];
  const shop=Object.entries(HORSE_PRICE).filter(([id,c])=>c.coins&&!owns(p,+id)).map(([id,c])=>({kind:'buy',id:+id,need:c.coins})).sort((a,b)=>a.need-b.need)[0];   // the diamond-only ones are not a coin goal
  if(byStars&&byStars.need-s<=2)return {...byStars,have:s};
  if(shop)return {...shop,have:Math.min(coins,shop.need)};
  return byStars?{...byStars,have:s}:null;
}

function demo(){
  const ok=(c,m)=>{if(!c)throw new Error('progress: '+m);},finish=(p,o)=>finish0(p,{...o,all:true});   // the rules with every system on
  let p=fresh();ok(unlocked(p,'taipei')&&!unlocked(p,'tokyo')&&!relayOpen(p)&&p.owned.join()==='1','only the first level is open; one buddy, no relay');
  ok(!maneOpen(p,'long')&&maneOpen(p,'classic')&&maneOpen(p,'short')&&!riderColors(p),'the long mane and the rider colours are closed at first');
  ok(starsFor('taipei',40)===1&&starsFor('taipei',26.5)===2&&starsFor('taipei',23)===3,'stars by time');
  const run={bestCombo:25,releases:8,limits:3,pops:0,pickups:12,stumbles:0,boosts:3,perfect:31,apples:4,hits:50,notes:55,seconds:24};
  let f=finish(p,{city:'taipei',solo:true,result:run,today:'2026-10-04'});
  ok(f.newStars===2&&f.stars===2&&f.missionCoins===100&&f.daily.coins===50&&f.coins===100+100+50&&f.gems===2,'first run pays stars, missions and the day');
  ok(f.opened.join()==='tokyo'&&!f.relayOpened&&f.gifts.join()==='0'&&owns(f.p,0)&&!f.perks.length,'a finished run opens level 2; clearing stage 1 gives the second buddy');p=f.p;
  f=finish(p,{city:'taipei',solo:true,result:{...run,seconds:70},today:'2026-10-04'});ok(f.newStars===0&&f.stars===2&&!f.daily&&f.p.runs===2,'a slower run keeps the stars; one daily bonus a day');p=f.p;
  f=finish(p,{city:'taipei',solo:true,result:{...run,seconds:18},today:'2026-10-05'});ok(f.newStars===1&&!f.relayOpened&&!f.gifts.length&&f.daily.streak===2&&f.daily.coins===60,'a third star: no relay yet (two buddies); day 2 pays more');p=f.p;
  {let q=finish(p,{city:'tokyo',solo:true,result:{...run,seconds:60},today:'2026-10-05'});ok(q.perks.join()==='mane'&&cleared(q.p,PERKS.mane.stage)&&!q.gifts.length,'clearing stage 2 gives the long mane');
   q.p.stars.paris=0;q=finish(q.p,{city:'paris',solo:true,result:{...run,seconds:90},today:'2026-10-05'});ok(q.gifts.includes(2)&&q.relayOpened&&relayOpen(q.p),'clearing stage 3 gives the third buddy: the relay opens');
   q=finish(q.p,{city:'seoul',solo:true,result:{...run,seconds:90},today:'2026-10-05'});ok(q.perks.join()==='rider'&&cleared(q.p,PERKS.rider.stage),'clearing stage 4 opens the rider colours');
   q=finish(q.p,{city:'stockholm',solo:true,result:{...run,seconds:90},today:'2026-10-05'});ok(q.gifts.includes(10)&&!owns(q.p,11)&&buy(q.p,11,'coins',2000).cost===2000&&buy(q.p,11,'gems',10).cost===10,'clearing stage 5 gives the llama; the rhino is diamonds only');
   ok(buy(fresh(),0,'coins',300).cost===300&&relayOpen({...fresh(),owned:[1,5,6]}),'the early buddies can be bought sooner; any three buddies open the relay');}
  ok(nextStarTime('taipei',2)===23&&nextStarTime('taipei',3)===null,'next star time');
  ok(buy(p,5,'coins',399).fail&&buy(p,5,'coins',400).cost===400&&buy(p,1,'coins',9999).fail,'buying');
  ok(buy(p,6,'coins',999).fail&&buy(p,6,'coins',1000).cost===1000&&owns(buy(p,6,'coins',1000).p,6)&&buy(p,6,'gems',3).cost===3,'a special coat: coins now, diamonds kept for later');
  ok(Object.values(HORSE_PRICE).every(c=>c.coins>0&&c.gems>0),'five diamond-only buddies (three special coats, the llama, the rhino), none of them a gift by stars');
  p.stars.tokyo=2;f=finish(p,{city:'tokyo',solo:true,result:{...run,seconds:60},today:'2026-10-05'});ok(f.gifts.join()==='5'&&owns(f.p,5),'five stars gift Buckskin');
  ok(restore({owned:[9,77],stars:{taipei:9}}).owned.join()==='1,9,0'&&restore({owned:[1,0,2]}).owned.join()==='1,0,2'&&restore(null).stars.taipei===0&&restore({stars:{taipei:9}}).stars.taipei===3,'restore');
  ok(nextGoal(fresh(),0).kind==='level'&&nextGoal(fresh(),0).city==='tokyo','the next goal of a new player is level 2');
  const all=fresh();LEVELS.forEach(l=>all.stars[l.city]=3);all.owned=[...STARTERS,...Object.keys(HORSE_PRICE).map(Number)];ok(nextGoal(all,0)===null&&currentLevel(all).city==='stockholm','all done');
  ok(missionsFor(0,true).length===3&&!missionsFor(5,true).some(m=>m.relay)&&!missionsFor(5,false).some(m=>m.solo),'missions by mode');
  console.log('PASS: progress (levels, stars, missions, daily bonus, horses)');
}
if(typeof process!=='undefined'&&process.argv[1]?.endsWith('progress.mjs'))demo();

// Who is out on the ranch, of the buddies owned (2026-10-10, the user: 「有些馬可以待在宿舍裡不用所有的都出來，20%或超過6再出來」
// 「我是說或是20%出來就好」): everyone up to six; past that one in five (two at the least), a window round the list that
// moves on one buddy an hour, so each has its turn out; never more than RANCH_MAX (how many the ranch draws: a
// performance number, to be measured on a phone).
export const RANCH_MAX=8,RANCH_ALL=6,RANCH_SHARE=.2,RANCH_LEAST=2;
export function whoIsOut(owned,hour=Math.floor(Date.now()/36e5)){if(owned.length<=RANCH_ALL)return owned.slice(0,RANCH_MAX);
  const n=Math.min(RANCH_MAX,Math.max(RANCH_LEAST,Math.round(owned.length*RANCH_SHARE))),start=hour%owned.length;return owned.slice(start).concat(owned.slice(0,start)).slice(0,n);}
