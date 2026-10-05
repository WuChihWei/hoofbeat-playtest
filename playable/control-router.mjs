import {InputResolver} from './input-resolver.mjs?v=r272';
// The race controls: two hoof sliders and the charge button. A hoof tap is a rhythm hit; both hoofs at once (a chord,
// within chordWindow) are a jump (the notes under the press are still judged: the chart never puts both hoofs on one
// beat). Sliding a hoof outward changes lane and the charge button sprints (or leaps): neither waits on the chord
// window. lag (simulation s): hoof taps arrive stamped that much earlier (tap latency calibration), so the feet resolve
// their chords that much behind the clock too.
export class ControlRouter {
 constructor(game,lag=0){this.game=game;this.lag=lag;
  this.feet=new InputResolver({window:game.config.chordWindow,single:(s,t)=>game.single(s,t),jump:(t,first)=>{
   game.single(first.side,first.time);game.single(1-first.side,t);game.jump(t);
  }});
 }
 reset(){this.feet.reset();}
 advance(t){this.feet.advance(t-this.lag);}
 down(side,source,t){return this.feet.down(side,source,t);}
 up(source){this.feet.up(source);}
 lane(side){return this.game.lane(side);}
 charge(t){return this.game.charge(t);}
 get oldestPendingTime(){return this.feet.oldestPendingTime;}
}
