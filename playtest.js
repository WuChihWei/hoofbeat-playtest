// Playtest log (MVP test build): every race (finished, left or restarted) and any script error, kept in this browser
// (localStorage hoofbeat.playlog.v1, newest 300 entries). Testers copy or download it from Settings → 測試紀錄.
// FEEDBACK_URL: the playtest questionnaire, shown as a button there when set.
export const FEEDBACK_URL='';
const KEY='hoofbeat.playlog.v1',MAX=300;
export function readLog(){try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch{return []}}
export function addLog(entry){try{localStorage.setItem(KEY,JSON.stringify([...readLog(),{at:new Date().toISOString(),...entry}].slice(-MAX)))}catch{}send(entry);}
// The same entries, sent to the user's sheet (2026-10-12, the user: 「幫我接數據」: who came back the next day, which stage
// they stop at). REMOTE: a Google Form of the user's with one short-answer question; a row is one line of JSON in it.
// Nothing is sent while REMOTE.url is empty, or on localhost, or with ?debug / ?demo (the builder's own runs).
// who: a random id made once for this browser (no account); name: the rider's name the player typed; day: days since
// this browser first opened the game (0 the first day): a row with kind 'open' and day 1 is someone who came back.
export const REMOTE={url:'',field:''};
const WHO='hoofbeat.install.v1',FIRST='hoofbeat.firstday.v1',get=k=>{try{return localStorage.getItem(k)}catch{return null}},put=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
const who=()=>{let w=get(WHO);if(!w){w=Math.random().toString(36).slice(2,10);put(WHO,w);}return w;};
export const dayNumber=()=>{const today=Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5);let f=+get(FIRST);if(!f){f=today;put(FIRST,String(f));}return today-f;};
export function row(entry){let name='';try{name=JSON.parse(get('hoofbeat.profile.v1')||'{}').name||''}catch{}
  const {perf,device:d,...rest}=entry;   // the frame timings and the user agent stay in the browser's own log
  return JSON.stringify({who:who(),name,day:dayNumber(),build:new URL(import.meta.url).searchParams.get('v')||'',view:[innerWidth,innerHeight],...rest}).slice(0,1800);}
export function send(entry){try{if(!REMOTE.url||/^(localhost|127\.|\[::1\])/.test(location.hostname)||/[?&](debug|demo)\b/.test(location.search))return;
    fetch(REMOTE.url,{method:'POST',mode:'no-cors',keepalive:true,body:new URLSearchParams({[REMOTE.field]:row(entry)})}).catch(()=>{});}catch{}}
export function clearLog(){try{localStorage.removeItem(KEY)}catch{}}
export const device=()=>({ua:navigator.userAgent,screen:[screen.width,screen.height],view:[innerWidth,innerHeight],dpr:devicePixelRatio});
// Script errors join the log, once per message per page load.
export function watchErrors(){
  const seen=new Set(),log=(msg,src)=>{msg=String(msg).slice(0,300);if(seen.has(msg))return;seen.add(msg);addLog({kind:'error',msg,src,device:device()});};
  addEventListener('error',e=>log(e.message,`${e.filename}:${e.lineno}`));
  addEventListener('unhandledrejection',e=>log(e.reason?.stack||e.reason,'promise'));
}
// One race: the game (slice-game), how it ended ('finish' | 'quit' | 'restart'), and what the app knows about it.
export function raceEntry(game,result,{city,team,mode='relay',eased=false,fps=null,perf=null}={}){
  const count=type=>game.actions.filter(e=>e.type===type).length,rel=game.actions.filter(e=>e.type==='release');
  return {kind:'race',mode,result,city:city??'template',difficulty:game.course.difficulty??null,eased,field:game.rivals.length+1,team,
    rank:game.metrics().rank,wall:+(game.time/game.config.tempo).toFixed(1),progress:Math.round(game.distance/game.config.length*100),leg:game.leg+1,
    releases:rel.length,limits:rel.filter(e=>e.max).length,pops:count('blown'),bestStreak:Math.max(0,...rel.map(e=>e.streak)),bumps:count('skill'),bumpMisses:count('skill-miss'),rammed:count('rammed'),dodged:count('ram-miss')+count('ram-off'),
    sprints:game.boosts.length,leaps:count('leap'),hurdles:{cleared:count('clear'),hit:count('obstacle-miss')},laneChanges:game.laneChanges.length,
    blocked:count('blocked'),coins:game.coinCount,fps,perf,device:device()};   // perf: ms per frame (slice-app)
}
export function summary(log=readLog()){
  const races=log.filter(e=>e.kind==='race'&&!e.practice),done=races.filter(e=>e.result==='finish');
  return {races:races.length,finished:done.length,wins:done.filter(e=>e.rank===1).length,errors:log.filter(e=>e.kind==='error').length};
}
