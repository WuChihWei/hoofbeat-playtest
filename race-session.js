export const INPUT_GRACE=.08;

// DOM input timestamps and animation frames share the performance time origin.
export class RaceClock {
  constructor(now=()=>performance.now(),origin=performance.timeOrigin){this.now=now;this.origin=origin;this.reset()}
  reset(){this.start=this.now();this.pausedAt=null;this.pausedTotal=0;this.resumedAt=this.start}
  elapsed(at=this.now()){return ((this.pausedAt??at)-this.start-this.pausedTotal)/1000}
  pause(){if(this.pausedAt===null)this.pausedAt=this.now()}
  resume(){if(this.pausedAt!==null){this.resumedAt=this.now();this.pausedTotal+=this.resumedAt-this.pausedAt;this.pausedAt=null}}
  inputElapsed(stamp){
    const now=this.now();
    if(stamp>1e12)stamp-=this.origin;
    const at=Number.isFinite(stamp)&&stamp>0?Math.min(now,Math.max(now-INPUT_GRACE*1000,this.resumedAt,stamp)):now;
    return this.elapsed(at);
  }
}

export function racePhase(t){
  if(t<0)return 'ready';
  if(t<4)return 'opening';
  if(t<25)return 'stride';
  if(t<50)return 'build';
  if(t<68)return 'push';
  return 'finish';
}

export function feedbackMoment(previousCombo,combo,recovering){
  if(combo>=10&&Math.floor(combo/10)>Math.floor(previousCombo/10))return {text:`${Math.floor(combo/10)*10} STREAK`,kind:'streak'};
  if(recovering&&combo>=4)return {text:'BACK IN STRIDE',kind:'recovery'};
  return null;
}

export function recordKey(race,version){return `${version}:${race.city}:${race.weather}:${race.team.join('-')}`}
export function validRecord(record){return !!record&&Number.isFinite(record.distance)&&record.distance>=0&&record.distance<2000&&Number.isFinite(record.accuracy)&&record.accuracy>=0&&record.accuracy<=100&&Number.isInteger(record.combo)&&record.combo>=0&&record.combo<1000}
export function compareRecord(previous,current){
  const best=validRecord(previous)?previous:null;
  const difference=best?current.distance-best.distance:0;
  const improved=!!best&&difference>.01;
  return {first:!best,improved,difference,best:!best||improved?current:best};
}
