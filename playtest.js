// Playtest log (MVP test build): every race (finished, left or restarted) and any script error, kept in this browser
// (localStorage hoofbeat.playlog.v1, newest 300 entries). Testers copy or download it from Settings → 測試紀錄.
// FEEDBACK_URL: the playtest questionnaire, shown as a button there when set.
export const FEEDBACK_URL='';
const KEY='hoofbeat.playlog.v1',MAX=300;
export function readLog(){try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v:[]}catch{return []}}
export function addLog(entry){try{localStorage.setItem(KEY,JSON.stringify([...readLog(),{at:new Date().toISOString(),...entry}].slice(-MAX)))}catch{}}
export function clearLog(){try{localStorage.removeItem(KEY)}catch{}}
export const device=()=>({ua:navigator.userAgent,screen:[screen.width,screen.height],view:[innerWidth,innerHeight],dpr:devicePixelRatio});
// Script errors join the log, once per message per page load.
export function watchErrors(){
  const seen=new Set(),log=(msg,src)=>{msg=String(msg).slice(0,300);if(seen.has(msg))return;seen.add(msg);addLog({kind:'error',msg,src,device:device()});};
  addEventListener('error',e=>log(e.message,`${e.filename}:${e.lineno}`));
  addEventListener('unhandledrejection',e=>log(e.reason?.stack||e.reason,'promise'));
}
// One race: the game (slice-game), how it ended ('finish' | 'quit' | 'restart'), and what the app knows about it.
export function raceEntry(game,result,{city,team,practice=false,mode='relay',rivals=3,eased=false,fps=null,perf=null,latency=0}={}){
  const count=type=>game.actions.filter(e=>e.type===type).length,by=s=>game.notes.filter(n=>n.state===s).length;
  const perfect=by('perfect'),good=by('good'),miss=by('miss'),judged=perfect+good+miss;
  return {kind:'race',mode,result,practice,city:city??'template',difficulty:game.course.difficulty??null,rivals,eased,field:game.rivals.length+1,team,
    rank:game.metrics().rank,wall:+(game.time/game.config.tempo).toFixed(1),progress:Math.round(game.distance/game.config.length*100),leg:game.leg+1,
    notes:judged,perfect,good,miss,hitRate:judged?Math.round((perfect+good)/judged*100):null,bestCombo:game.bestCombo,
    sprints:game.boosts.length,leaps:count('leap'),hurdles:{cleared:count('clear'),hit:count('obstacle-miss')},laneChanges:game.laneChanges.length,
    blocked:count('blocked'),coins:game.coinCount,fps,perf,latencyMs:latency,device:device()};   // perf: ms per frame (slice-app)
}
export function summary(log=readLog()){
  const races=log.filter(e=>e.kind==='race'&&!e.practice),done=races.filter(e=>e.result==='finish');
  return {races:races.length,finished:done.length,wins:done.filter(e=>e.rank===1).length,errors:log.filter(e=>e.kind==='error').length,
    practice:log.filter(e=>e.kind==='race'&&e.practice).length,hitRate:done.length?Math.round(done.reduce((s,e)=>s+(e.hitRate??0),0)/done.length):null};
}
