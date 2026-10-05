// One interpretation per physical press. No double-tap gesture, timer or DOM dependency.
export class InputResolver {
  constructor({window, single, jump}) {
    this.window=window; this.single=single; this.jump=jump; this.reset();
  }
  reset(){this.pending=[];this.sources=new Map();this.chordHeld=false;}
  advance(time){
    while(this.pending.length && time>this.pending[0].time+this.window+1e-9){
      const p=this.pending.shift();this.single(p.side,p.time,time);
    }
  }
  // → true when the press counts (a rhythm tap or the second hoof of a jump), false when it is ignored
  down(side,source,time){
    if(this.sources.has(source))return false;
    this.advance(time);
    const sameHeld=[...this.sources.values()].includes(side);
    this.sources.set(source,side);
    if(sameHeld||this.chordHeld)return false;
    // Timestamp pairing is authoritative, even for a very short released tap.
    const index=this.pending.findIndex(p=>p.side!==side&&time-p.time<=this.window+1e-9);
    if(index!==-1){
      // Resolve earlier unpaired presses before this chord, in timestamp order.
      for(const p of this.pending.splice(0,index))this.single(p.side,p.time,time);
      const first=this.pending.shift();this.chordHeld=true;this.jump(time,first);return true;
    }
    this.pending.push({side,time});return true;
  }
  up(source){this.sources.delete(source);if(!this.sources.size)this.chordHeld=false;}
  get oldestPendingTime(){return this.pending[0]?.time??Infinity;}
}
