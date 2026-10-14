// Progress and economy: the five levels and their stars, which horses the player owns and what the others cost, the
// three small missions of a run, the daily first-run bonus. Pure rules (no storage, no DOM): home.js keeps the state
// in localStorage ('hoofbeat.progress.v1') and calls these. Run `node dist/playable/progress.mjs` for the self-check.
import {MVP} from './slice-config.mjs?v=r765';
import {COURSES} from '../course/courses.mjs?v=r765';
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
// times here are wall-clock seconds at that tempo (the old ones × 1.95 / tempo).
// Star times (r309, measured with tools/stage-times.mjs: the starter buddy at the stage's level, by the stage's own
// rules): silver about 70% of the notes hit and gold about 87% (stage 1: 50% and 70%; stage 2: a little under 70% and
// about 80%; the last two golds ask for more). Stage 2 is one lap (cities/tokyo.mjs soloLaps: without the sprint two
// laps took over a minute), so stages 1 and 2 take about half a minute and the others 45 s or so.
// 2026-10-07, the ball game (tools/stage-times-ball.mjs: never holding / letting go at .85 every time, seconds): 27.6 / 20.2,
// 28.8 / 20.7, 50.9 / 36, 48.9 / 34, 49 / 34. Silver is a little under the middle of the two, gold about 6% over the second.
// 2026-10-12: buddies level (stable-care LV_SPEED, 1% a level), so each stage's star times are the old ones (set on a LV 1
// buddy's speed) divided by the speed of the level a player has by then: LV 1 + floor(stage / 2), LV 6 at stage 10.
// 2026-10-13: with rivals of an age by stage (rivalAge) the star times are for a buddy of that age too: stages 4–7 the
// times above ÷ 1.08, stages 8–10 ÷ 1.16 (stable-care LV_SPEED .08 an age).
export const LEVELS=Object.freeze([
  {city:'taipei',rivals:0,tempo:1.4,plain:true,locks:{lane:1,hurdle:1,sprint:1},silver:26.5,gold:23},
  {city:'tokyo',rivals:1,field:['rio'],tempo:1.6,locks:{hurdle:1,sprint:1},silver:27.2,gold:24.3,ram:[1.4,.4,14,1.5]},   // the one rival bumps here too (2026-10-13, the user: 第二關就會被撞): the fourth number is the first one's earliest time, while it is still alongside off the start,
  {city:'paris',rivals:2,field:['hazel','rio'],tempo:1.75,locks:{},silver:46.5,gold:40.6,ram:[1.4,.4,14]},   // ram: a rival beside the player comes over at it (slice-game ramStep): [s from its first lean to the hit, s until it is across its line, s between two, (s before the first: 4, or 15 the first time it is met)], real seconds
  {city:'seoul',rivals:4,field:['hazel','rio','poppy','sage'],tempo:1.85,locks:{},silver:40.8,gold:34.9,ram:[1.4,.4,11],weather:['rain'],hazards:{poop:0}},   // 2026-10-14 (the user: six stages for the playtest, the weather inside them): stage 4 is rain, stage 5 snow, stage 6 any of the three
 
  {city:'stockholm',rivals:4,field:['chaser','hazel','rio','poppy'],tempo:1.95,locks:{},silver:40.8,gold:34.9,ram:[1.4,.4,9],back:true,weather:['snow'],hazards:{poop:0}},
  // 2026-10-11, stages 6 and 7: what lies on the road. hazards: a puddle every [first, step] m and a dropping every
  // [first, step] m, lane after lane (slice-app levelHazards; slice-game wet, hazardStep). Stage 6 is the puddles,
  // stage 7 both. The cities are Taipei and Paris again (course/cities/taipei2.mjs, paris2.mjs) until they have their own art.
  {city:'taipei2',rivals:4,field:['pacer','chaser','hazel','rio'],tempo:1.95,locks:{},silver:34.6,gold:29.6,ram:[1.4,.4,9],back:true,weather:['sun','rain','snow'],hazards:{poop:0}},
  // 2026-10-12, stages 7–10 (the user: ten stages; the first six are set, the last four draw their weather): the five
  // Droppings are on the last stage only (2026-10-14, the user: 太難了，大便第十關再出現; stages 7–9 had one every 75 / 65 / 55 m). A rival's lean before its
  // ram is 1.4 s (.8 until then: the user could not tell when one was coming), and its rider's arm goes up for it (race-scene REACT.raise).
  // cities again. weather: what a run's sky is drawn from; hazards.poop: droppings every this many m (0: none); the
  // puddles or the snow come with the weather (WEATHER below); random: hurdles and everything on the road are
  // somewhere else every run (slice-app).
  {city:'tokyo2',rivals:4,tempo:2,locks:{},silver:37.4,gold:32.1,ram:[1.4,.4,8],back:true,weather:['sun','rain','snow'],hazards:{poop:0},random:true},
  {city:'stockholm2',rivals:4,tempo:2,locks:{},silver:36.1,gold:31.2,ram:[1.4,.4,8],back:true,weather:['sun','rain','snow'],hazards:{poop:0},random:true},
  {city:'paris2',rivals:4,tempo:2.05,locks:{},silver:32.6,gold:28.3,ram:[1.4,.4,7],back:true,weather:['sun','rain','snow'],hazards:{poop:0},random:true},
  {city:'seoul2',rivals:4,tempo:2.05,locks:{},silver:32.8,gold:28.4,ram:[1.4,.4,7],back:true,weather:['sun','rain','snow'],hazards:{poop:50},random:true},
]);
// What a weather puts on the road: a patch every `every` m (0: none), of water or of snow. The same rule for both
// (slice-game slowed): slower in it and a moment after, cleared by a jump or the next lane. It changes what is on the
// road, never how fast anyone runs (the stars' times must mean the same in any weather).
export const WEATHER=Object.freeze({sun:{every:150,snow:false,name:'晴'},rain:{every:42,snow:false,name:'雨'},snow:{every:46,snow:true,name:'雪'}});
export const RELAY_BUDDIES=3;   // the relay (a three-buddy team race) opens once the player has three buddies (2026-10-05: it was 3 stars, when every player started with three)
export const STAR_REWARD={coins:10,gems:1};   // each star, the first time it is earned · 10 coins (50 until 2026-10-14: two new stars paid 100 over a fee of 40, so a lost race still made money and the stake was no risk)
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
export const HORSE_PRICE=Object.freeze({0:{coins:300,gems:2},2:{coins:600,gems:3},5:{coins:400,gems:2,stars:3},   /* 2026-10-14 (the user: 送的夥伴第三關要到): one star a stage now (STAR_MAX), so 3 stars is stage 3 as 5 was */
  6:{coins:1000,gems:3},7:{coins:800,gems:4,stars:9},4:{coins:1200,gems:5},
  3:{coins:1400,gems:7,stars:12},8:{coins:1800,gems:9},9:{coins:2400,gems:12,stars:15},10:{coins:1600,gems:12,stage:5},11:{coins:2000,gems:10,stage:6},12:{coins:2200,gems:8,stage:4},13:{coins:2600,gems:10,stage:1},14:{coins:2000,gems:8,stage:3},15:{coins:2400,gems:9,stage:7}});   // 2026-10-11: clearing stage 6 gives the rhino (water does not slow it), stage 7 the wolf · 2026-10-14: stage 3 gives the cow (14, water) for stage 4's rain and stage 4 the bear (12, snow) for stage 5's snow; the black horse (2) is bought · later that day: stage 1 gives the zebra (13: its bump lands sooner) and not a second horse with the first one's own traits (0, bought now): a choice to make on stage 2
// 2026-10-12 (the user's reward table): what clearing a stage gives besides a buddy (HORSE_PRICE `stage`) or the rider's
// colours (PERKS.rider): stage 2 seeds and bait, stage 8 coins, the last stage the trophy on the shelf of the rider's house.
// THREE_STARS: coins for a stage's third star. The day's first finished run: the coins picked up on it count twice (`first`).
export const STAGE_GIFT=Object.freeze({2:{items:{seed:5,fish:15}},8:{coins:300}}),THREE_STARS=100,TROPHY_STAGE=6;
// The stake (2026-10-13, the user: 賽馬很大一部分是贏錢; an entry fee and a pot, as at a card table): a stage with rivals costs
// ENTRY × its number to enter (stage 1, run alone, is free), the pot is PURSE × the fee, shared by place (PURSE_SHARE: the
// winner all of it); whoever comes last gets none of it, whatever its place. Doubled before the start: the fee and the pot × 2.
// Without the coins the stage is run free, for its stars and xp, with no pot.
// 2026-10-13 (the user: 不管怎麼跑錢都變多要改): the winner takes three times the fee, second gets the fee back, third half of it
// (it was 5 × the fee, shared 1, 1/2, 1/4: a rider placing by chance made .75 of the fee a run). By chance in a field of five a
// run now loses a tenth of the fee; raised (DOUBLE, everything × 2) it loses twice that, and pays from about one win in three.
export const ENTRY=20,PURSE=3,PURSE_SHARE=Object.freeze([1,1/2,1/3,0,0]);   // 2026-10-14: every paid place at least pays the fee back (third had 1/6 of the pot, half the fee: 前 3 名有獎金 and third lost money)
// The fee goes by how hard the stage is (2026-10-14, the user: 報名費應該依遊戲難度調整): its course's difficulty, the dots on its card
// (1 入門, 2 進階, 3 挑戰): ENTRY, doubled a step: 20, 40, 80. (It was ENTRY × the stage's number: 40, 60, 80, 100, 120.) A stage without rivals is free.
export const entryFee=city=>{const l=LEVELS[levelOf(city)],d=COURSES.find(c=>c.id===city)?.difficulty||1;return !l||!l.rivals?0:ENTRY*2**(d-1)*(levelOf(city)===STAGES-1?FINAL:1);};
export const FINAL=2;   // the last stage shown is the big one (2026-10-14, the user: 第六關調高): its fee, and so its pot, twice its difficulty's
// Raising the stake (2026-10-13, the user: 寫倍數就好，報名費自動變兩倍): fee and pot both × 2. (It was the fee × 3 for an hour.)
// 2026-10-14 (the user: 問你要壓多少錢): three stakes, fee and pot × 1, 2, 4 (小押 中押 大押); it was one raise, × 2.
// The forecast (2026-10-14): each weather a stage can have, by its share; for now a stage's weather is as set (LEVELS weather).
export const forecast=city=>{const w=LEVELS[levelOf(city)]?.weather||['sun'];return [...new Set(w)].map(k=>({sky:k,pct:Math.round(100*w.filter(x=>x===k).length/w.length)}));};
export const BETS=Object.freeze([1,2,4]),BET_NAME=Object.freeze(['小押','中押','大押']);
// 2026-10-13 (the user: 照你的全改): raising a buddy is what wins. Rivals are of an age by stage (rivalAge: stages 1–3 young,
// 4–7 adult, 8–10 prime; each age stable-care LV_SPEED faster, as the player's own). And the pot follows the buddy (POT):
// × match when the weather is what its perk is for (rain and 不怕水, snow and 不怕雪), × moody when its mood is low; a hungry
// buddy cannot raise the stake (slice-app).
// RIVAL_PACE: every rival's speed, all stages (2026-10-13, tools/rival-sweep.mjs, on a buddy of the stage's age): at 1 a rider who
// lets go seven times a race was last from stage 4 on and one who never rests was 4th; at .9 the first places 3rd and the second 1st.
// By stage since the same evening (the user: 難易度隨著 1–10 關去調整): a stage's own number, picked off the tool's table so that the
// casual rider places 1, 1, 1, 2, 3, 3, 3, 4, 4 on stages 2 to 10 and the good one 1, 1, 1, 1, 1, 1, 2, 1, 2. (Stage 4 is slower than 3:
// the field grows from three to five and its rivals are a year older.)
// 2026-10-14: stages 2–5 send lower tiers now (LEVELS field), so their pace went up to keep the places the sweep had (S4 rain:
// the right buddy about 1st, the wrong one about 3rd, riding casually).
// 2026-10-14 (the user: 遊戲難度需要提升 20%): every shown stage's rivals 3% faster (+.03). Faster still and a casual rider can no
// longer win at all (tools/rival-sweep.mjs); this moves a casual rider from about 1st to about 2nd, a good one still wins.
export const RIVAL_PACE=Object.freeze([1,.93,1.03,.97,.94,.91,.9,.92,.92,.94]),rivalPace=city=>RIVAL_PACE[levelOf(city)]??1;
export const rivalAge=city=>{const n=levelOf(city)+1;return n<=3?1:n<=7?2:3;};   // POT (× 1.5 for the weather's buddy) is gone (2026-10-14, the user: the weather is told, not paid)   // (× .8 for a low mood was dropped the same day: mood costs nothing, stable-care MOOD_XP)
export const purseWon=(pot,rank,of)=>!(rank&&of>1)?0:rank===1?pot:rank>=of?0:Math.round(pot*(PURSE_SHARE[rank-1]??0));
export const PERK_COINS=100;   // MVP.perks off: a stage that gave a perk pays this instead
export const PERKS=Object.freeze({mane:{stage:2,id:'long'},rider:{stage:4}});

export const fresh=()=>({stars:{},owned:[...STARTERS],runs:0,jumps:0,day:null,streak:0,lost:{}});
// Three losses in a row to rivals on a stage (lost: {stage key: races in a row not won}; the relay's key is 'r:' + city):
// the next ones there are a step easier (slice-app: the rivals 5% slower) until one is won. Nothing says so.
export const EASE_AFTER=3,eased=(p,city,solo=true)=>(p.lost?.[(solo?'':'r:')+city]||0)>=EASE_AFTER;
// A saved state made whole (older saves, hand-edited ones): known cities, 0–3 stars, the starters always owned.
// Tiers (2026-10-14, the user: no odds and no rival list on the ticket; every rider wears a tier and the player judges the field by
// them): five, low to high (assets/ui/tier/shield-1…6, from the user's sheet).
// The player's goes up with points from placings (PLACE_POINTS by place, kept in progress.points) and never comes down; a rival's
// is its own for good (slice-config SLICE_RIVALS tier).
export const TIERS=Object.freeze([{img:'shield-1',name:'新手'},{img:'shield-2',name:'好手'},{img:'shield-3',name:'高手'},{img:'shield-4',name:'大師'},{img:'shield-5',name:'傳奇'}]);   // named (2026-10-14, the user: 更好懂，不要星星數，例如大師): not 進階 or 專家, the stage cards say 入門 · 進階 · 挑戰   // later the same day: five (the user: 改五個等級), one shield shape, 1–5 stars, wings, a crown (references/tiers/sheet-shields-5.png), so that the tiers are not taken for the prize medals
export const TIER_AT=Object.freeze([0,15,40,90,160]),PLACE_POINTS=Object.freeze([10,6,3,1,1]);
export const tierOf=points=>TIER_AT.filter(t=>(points||0)>=t).length-1;
export function restore(saved){
  const p={...fresh(),...(saved&&typeof saved==='object'?saved:null)};
  p.stars=Object.fromEntries(LEVELS.map(l=>[l.city,Math.max(0,Math.min(3,Math.floor(+p.stars?.[l.city]||0)))]));
  p.lost=p.lost&&typeof p.lost==='object'?{...p.lost}:{};
  p.owned=[...new Set([...STARTERS,...(Array.isArray(p.owned)?p.owned:[]).filter(id=>id in HORSE_PRICE)])];
  for(const [id,c] of Object.entries(HORSE_PRICE))if(c.stage&&cleared(p,c.stage)&&!p.owned.includes(+id))p.owned.push(+id);   // a stage already cleared has given its buddy
  return p;
}
// A stage (1–5) is cleared once its solo run has a star.
export const cleared=(p,stage)=>(p.stars[LEVELS[stage-1]?.city]||0)>=1;
export const maneOpen=(p,id)=>id!==PERKS.mane.id||MVP.perks&&cleared(p,PERKS.mane.stage),riderColors=p=>cleared(p,PERKS.rider.stage);   // 2026-10-12: the rider's colours are chosen in her house (home.js PAGES.house), open from that stage with or without the MVP's perks
export const trophy=p=>cleared(p,TROPHY_STAGE);
export const totalStars=p=>LEVELS.reduce((s,l)=>s+(p.stars[l.city]||0),0);
export const levelOf=city=>LEVELS.findIndex(l=>l.city===city);
// STAGES: how many stages are shown and can be opened (2026-10-14, the user: 後面四關隱藏): 7–10 stay in LEVELS, out of reach.
export const STAGES=6,SHOWN=LEVELS.slice(0,STAGES);
export const unlocked=(p,city)=>{const i=levelOf(city);return i===0||i>0&&i<STAGES&&cleared(p,i);};
export const relayOpen=p=>p.owned.length>=RELAY_BUDDIES;
export const owns=(p,id)=>p.owned.includes(id);
// Stars for a finished solo run of `seconds` (wall clock) on a level.
// 2026-10-14 (the user, after the reviewers: the place and the stars were two scores): the playtest gives the first star only,
// for finishing; the time goals (silver, gold) come back with STAR_MAX 3.
export const STAR_MAX=1;
export function starsFor(city,seconds,max=STAR_MAX){const l=LEVELS[levelOf(city)];return !l?0:Math.min(max,seconds<=l.gold?3:seconds<=l.silver?2:1);}
// The time the next star on this level needs, or null when it has all three.
export const nextStarTime=(city,have,max=STAR_MAX)=>{const l=LEVELS[levelOf(city)];return !l||have>=max?null:have>=2?l.gold:have>=1?l.silver:null;};
// The level to play next: the first open one short of three stars (else the last).
export const currentLevel=p=>SHOWN.find(l=>unlocked(p,l.city)&&(p.stars[l.city]||0)<STAR_MAX)??SHOWN.at(-1);

// Missions: three per run, taken in turn from the pool (run n takes n, n+1, n+2: two carry over, one is new). test(r)
// reads the run's result (slice-app). MISSION_COINS each, MISSION_ALL more for all three.
export const MISSION_COINS=20,MISSION_ALL=40;
// The counts go with the run's length: a relay is about 75 s; a solo run is one lap of 30–40 s (2026-10-05: about 35
// notes, 20 coins and 3 or 4 apples on it), so its counts are about half.
const POOL=[
  {id:'release',text:'漂亮放開 6 次',solo:true,ball:true,test:r=>r.releases>=6},{id:'limit',text:'極限放開 2 次',solo:true,ball:true,test:r=>r.limits>=2},{id:'nopop',text:'一次都不爆',solo:true,ball:true,test:r=>r.pops===0},   // the ball game (2026-10-07)
  {id:'coins',text:'撿 10 枚金幣',relay:true,test:r=>r.pickups>=10},{id:'coins',text:'撿 6 枚金幣',solo:true,test:r=>r.pickups>=6},
  {id:'clean',text:'一座欄都不撞',needs:'hurdle',test:r=>r.stumbles===0},
  {id:'sprint',text:'衝刺 3 次',relay:true,test:r=>r.boosts>=3},{id:'sprint',text:'衝刺 2 次',solo:true,needs:'sprint',test:r=>r.boosts>=2},
  {id:'apples',text:'吃 2 顆蘋果',solo:true,test:r=>r.apples>=2},
  {id:'podium',text:'跑進前 3 名',relay:true,test:r=>r.rank<=3},
];
export function missionsFor(run,solo,locks={}){const pool=POOL.filter(m=>(solo?!m.relay:!m.solo)&&!locks[m.needs]);   // locks: not what the stage does not have yet
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
  if(solo&&r.rank){const was=tierOf(p.points);p.points=(p.points||0)+(PLACE_POINTS[r.rank-1]??1);out.points=PLACE_POINTS[r.rank-1]??1;out.tierUp=tierOf(p.points)>was?tierOf(p.points):null;}   // a placing in a field: tier points
  if(solo){const had=p.stars[city]||0,got=starsFor(city,r.seconds);out.stars=Math.max(had,got);out.runStars=got;
    if(!had){const n=LEVELS[levelOf(city)+1],g=STAGE_GIFT[levelOf(city)+1];if(n)out.opened=[n.city];
      if(g){out.stageCoins=g.coins||0;out.coins+=out.stageCoins;out.items=g.items||null;}out.trophy=levelOf(city)+1===TROPHY_STAGE;}
    if(got>had){out.newStars=got-had;p.stars[city]=got;out.coins+=out.newStars*STAR_REWARD.coins;out.gems+=out.newStars*STAR_REWARD.gems;
      if(got===3){out.threeStars=THREE_STARS;out.coins+=THREE_STARS;}}}
  else out.stars=p.stars[city]||0;
  out.first=p.day!==today;
  out.daily=MVP.daily||all?daily(p,today):null;if(out.daily){p.day=today;p.streak=out.daily.streak;out.coins+=out.daily.coins;out.gems+=out.daily.gems;}
  p.day=today;p.runs++;p.jumps+=r.cleared||0;
  if(r.rank!=null){const k=(solo?'':'r:')+city;p.lost[k]=r.rank===1?0:(p.lost[k]||0)+1;}
  const now=totalStars(p);
  for(const [id,c] of Object.entries(HORSE_PRICE))if((c.stars&&now>=c.stars||c.stage&&cleared(p,c.stage))&&!owns(p,+id)){p.owned.push(+id);out.gifts.push(+id);}
  out.perks=Object.keys(PERKS).filter(k=>cleared(p,PERKS[k].stage)&&!perks0.includes(k));
  if(!MVP.perks&&!all)out.perks=out.perks.filter(k=>k==='rider');   // the mane style waits; the rider's colours are given (her house)
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
  const lock=SHOWN.find(l=>!unlocked(p,l.city));if(lock)return {kind:'level',city:lock.city,need:1,have:0};   // the stage in the way: finish it
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
  ok(starsFor('taipei',40,3)===1&&starsFor('taipei',26.5,3)===2&&starsFor('taipei',23,3)===3&&starsFor('taipei',23)===STAR_MAX,'stars by time, up to STAR_MAX');const s2=Math.min(2,STAR_MAX);
  const run={bestCombo:25,releases:8,limits:3,pops:0,pickups:12,stumbles:0,boosts:3,perfect:31,apples:4,hits:50,notes:55,seconds:24};
  let f=finish(p,{city:'taipei',solo:true,result:run,today:'2026-10-04'});
  ok(f.newStars===s2&&f.stars===s2&&f.missionCoins===100&&f.daily.coins===50&&f.coins===s2*STAR_REWARD.coins+100+50&&f.gems===s2,'first run pays stars, missions and the day');
  ok(entryFee('taipei')===0&&entryFee('tokyo')===40&&entryFee('paris')===40&&entryFee('seoul')===80&&entryFee('stockholm')===80&&entryFee('taipei2')===160&&entryFee('seoul2')===80&&purseWon(240,1,5)===240&&purseWon(240,2,5)===120&&purseWon(240,3,5)===80&&purseWon(240,4,5)===0&&purseWon(120,2,2)===0&&purseWon(120,1,2)===120&&purseWon(180,3,3)===0&&purseWon(180,2,3)===90&&[1,2,3,4,5].reduce((a,k)=>a+purseWon(240,k,5),0)/5<100&&BETS.join()==='1,2,4'&&rivalAge('paris')===1&&rivalAge('seoul')===2&&rivalAge('tokyo2')===2&&rivalAge('stockholm2')===3&&RIVAL_PACE.length===LEVELS.length&&rivalPace('seoul')===.97&&rivalPace('seoul2')===.94&&RIVAL_PACE.every(p=>p>.8&&p<=1.1),'the stake: a fee by stage, the pot shared by place, nothing for the last');
  ok(f.opened.join()==='tokyo'&&!f.relayOpened&&f.gifts.join()==='13'&&owns(f.p,13)&&!f.perks.length,'a finished run opens level 2; clearing stage 1 gives the second buddy');p=f.p;
  f=finish(p,{city:'taipei',solo:true,result:{...run,seconds:70},today:'2026-10-04'});ok(f.newStars===0&&f.stars===s2&&!f.daily&&f.p.runs===2,'a slower run keeps the stars; one daily bonus a day');p=f.p;
  f=finish(p,{city:'taipei',solo:true,result:{...run,seconds:18},today:'2026-10-05'});ok(f.newStars===(STAR_MAX>2?1:0)&&!f.relayOpened&&!f.gifts.length&&f.daily.streak===2&&f.daily.coins===60,'a third star: no relay yet (two buddies); day 2 pays more');p=f.p;
  {let q=finish(p,{city:'tokyo',solo:true,result:{...run,seconds:60},today:'2026-10-05'});ok(q.perks.join()==='mane'&&cleared(q.p,PERKS.mane.stage)&&!q.gifts.length,'clearing stage 2 gives the long mane');
   q.p.stars.paris=0;q=finish(q.p,{city:'paris',solo:true,result:{...run,seconds:90},today:'2026-10-05'});ok(q.gifts.includes(14)&&q.relayOpened&&relayOpen(q.p),'clearing stage 3 gives the third buddy (the cow, for the rain of stage 4): the relay opens');
   q=finish(q.p,{city:'seoul',solo:true,result:{...run,seconds:90},today:'2026-10-05'});ok(q.perks.join()==='rider'&&cleared(q.p,PERKS.rider.stage),'clearing stage 4 opens the rider colours');
   q=finish(q.p,{city:'stockholm',solo:true,result:{...run,seconds:90},today:'2026-10-05'});ok(q.gifts.includes(10)&&!owns(q.p,11)&&buy(q.p,11,'coins',2000).cost===2000&&buy(q.p,11,'gems',10).cost===10,'clearing stage 5 gives the llama; the rhino is diamonds only');
   ok(buy(fresh(),0,'coins',300).cost===300&&relayOpen({...fresh(),owned:[1,5,6]}),'the early buddies can be bought sooner; any three buddies open the relay');}
  {let q=fresh();const lose=()=>q=finish(q,{city:'seoul',solo:true,result:{...run,seconds:90,rank:3},today:'2026-10-05'}).p;lose();lose();ok(!eased(q,'seoul'),'two losses: as tuned');lose();ok(eased(q,'seoul')&&!eased(q,'seoul',false)&&!eased(q,'paris'),'three losses in a row: that stage is a step easier');
   q=finish(q,{city:'seoul',solo:true,result:{...run,seconds:90,rank:1},today:'2026-10-05'}).p;ok(!eased(q,'seoul'),'a win: as tuned again');}
  {let q=finish0(fresh(),{city:'taipei',solo:true,result:{...run,seconds:20},today:'2026-10-12'});ok(q.first&&(STAR_MAX<3?!q.threeStars&&q.coins===STAR_MAX*STAR_REWARD.coins:q.threeStars===THREE_STARS&&q.coins===3*STAR_REWARD.coins+THREE_STARS),'three stars pay 100 more; the first run of a day says so');
   q=finish0(q.p,{city:'tokyo',solo:true,result:{...run,seconds:60},today:'2026-10-12'});ok(!q.first&&q.items.seed===5&&q.items.fish===15&&!q.perks.length,'stage 2 gives seeds and bait; one first run a day');
   const end=fresh();SHOWN.forEach(l=>end.stars[l.city]=1);end.stars.taipei2=0;q=finish0(end,{city:'taipei2',solo:true,result:{...run,seconds:90},today:'2026-10-12'});ok(q.trophy&&trophy(q.p)&&!trophy(end)&&!unlocked(q.p,'tokyo2'),'the last shown stage (6) gives the trophy; stage 7 does not open');}
  ok(nextStarTime('taipei',2,3)===23&&nextStarTime('taipei',3,3)===null&&nextStarTime('taipei',1)===(STAR_MAX>1?26.5:null),'next star time');
  ok(buy(p,5,'coins',399).fail&&buy(p,5,'coins',400).cost===400&&buy(p,1,'coins',9999).fail,'buying');
  ok(buy(p,6,'coins',999).fail&&buy(p,6,'coins',1000).cost===1000&&owns(buy(p,6,'coins',1000).p,6)&&buy(p,6,'gems',3).cost===3,'a special coat: coins now, diamonds kept for later');
  ok(Object.values(HORSE_PRICE).every(c=>c.coins>0&&c.gems>0),'five diamond-only buddies (three special coats, the llama, the rhino), none of them a gift by stars');
  if(STAR_MAX<3){p.stars.tokyo=0;p.stars.paris=1;}else{p.stars.tokyo=1;p.stars.paris=0;}f=finish(p,{city:'tokyo',solo:true,result:{...run,seconds:60},today:'2026-10-05'});ok(f.gifts.join()==='5'&&owns(f.p,5),'three stars gift Buckskin');
  ok(tierOf(0)===0&&tierOf(14)===0&&tierOf(15)===1&&tierOf(160)===4&&tierOf(9999)===4&&finish0(fresh(),{city:'tokyo',solo:true,result:{rank:1,of:2,seconds:99},today:'2026-10-14'}).p.points===10,'tiers: points by place');
  ok(restore({owned:[9,77],stars:{taipei:9}}).owned.join()==='1,9,13'&&restore({owned:[1,0,2]}).owned.join()==='1,0,2'&&restore(null).stars.taipei===0&&restore({stars:{taipei:9}}).stars.taipei===3,'restore');
  ok(nextGoal(fresh(),0).kind==='level'&&nextGoal(fresh(),0).city==='tokyo','the next goal of a new player is level 2');
  const all=fresh();LEVELS.forEach(l=>all.stars[l.city]=3);all.owned=[...STARTERS,...Object.keys(HORSE_PRICE).map(Number)];ok(nextGoal(all,0)===null&&currentLevel(all).city==='taipei2','all done (the last of the stages shown)');
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
