import {COUNTDOWN,DURATION,LEG_SECONDS,JUMP_LEAD} from './game.js?v=r430';
import {racePhase} from './race-session.js?v=r430';

// A tune everyone knows for each city (2026-10-06, the user; all long out of copyright), played over the rhythm section
// in place of the made-up lead: [semitones from C5, length in half-beats] (null: a rest), looped from the first note of
// the chart (simulation t = 1; a beat is .6 simulation s, the spacing of the chart's notes, so the taps fall on it).
// taipei: Rossini, William Tell overture (finale) · tokyo: Sakura Sakura · paris: Offenbach, the can-can (Galop infernal)
// seoul: Arirang · stockholm: Grieg, In the Hall of the Mountain King.
const G3=[[7,.5],[7,.5],[7,1]],TELL_A=[...G3,...G3,[7,.5],[7,.5],[12,1],[14,1],[16,1]],MK=[[-3,1],[-1,1],[0,1],[2,1],[4,1],[0,1],[4,2]];
const MELODY={
  taipei:[...TELL_A,...G3,[7,.5],[7,.5],[12,1],[16,.5],[16,.5],[14,1],[11,1],[7,1],...TELL_A,[12,1],[16,1],[19,2],[17,1],[16,1],[14,1],[12,1]],
  tokyo:[[-3,2],[-3,2],[-1,4],[-3,2],[-3,2],[-1,4],[-3,2],[-1,2],[0,2],[-1,2],[-3,2],[-1,1],[-3,1],[-7,4],[-8,2],[-12,2],[-8,2],[-7,2],[-8,2],[-8,1],[-12,1],[-13,4]],
  paris:[[0,2],[0,2],[2,1],[5,1],[4,1],[2,1],[7,2],[7,2],[7,1],[9,1],[4,1],[5,1],[2,2],[2,2],[2,1],[5,1],[4,1],[2,1],[0,1],[12,1],[11,1],[9,1],[7,1],[5,1],[4,1],[2,1]],
  seoul:[[7,3],[9,1],[7,2],[9,2],[12,3],[14,1],[12,2],[14,2],[16,2],[14,1],[16,1],[14,1],[12,1],[9,2],[7,3],[9,1],[7,2],[9,2],[12,2],[14,1],[12,1],[9,1],[7,1],[9,2],[7,4],[null,4]],
  stockholm:[...MK,[3,1],[-1,1],[3,2],[2,1],[-2,1],[2,2],...MK.slice(0,6),[4,1],[9,1],[7,1],[4,1],[0,1],[4,1],[7,4]],
};
export function buildScore(race){
  // The pace test (race.beats: slice-game config.pace) has no beat to follow: the city's tune alone, no pulse under it and
  // no blip where a note would have been.
  if(race.beats&&!race.config?.ball)return buildScore({...race,beats:null,notes:race.beats}).filter(e=>e.kind!=='beat'&&e.kind!=='note');
  // The ball game (2026-10-08, the user: 「音樂就不用打點，直接當背景音樂」): nothing to hit, so the music is just music: the
  // city's tune over its own rhythm section on a steady beat (one every .6 simulation s, no rests), and no blip per note.
  if(race.config?.ball)return buildScore({...race,config:{...race.config,ball:false},beats:null,notes:Array.from({length:400},(_,i)=>({t:i*.6,lane:0,leg:0}))}).filter(e=>e.kind!=='note');
  const tempo=race.slice?race.config.tempo??1:1;
  const events=[0,1,2].map(t=>({t,kind:'count'}));
  events.push({t:COUNTDOWN,kind:'go'});
  // Keep the backing pulse on the playable chart, including the gentler first lap.
  race.notes.forEach((note,i)=>{events.push({t:COUNTDOWN+note.t/tempo,kind:'beat',i,leg:note.leg,phase:racePhase(note.t),rest:false});
    // The chart's rests (a beat or two between phrases): a quiet beat that sounds only once the music has built up
    // (RaceAudio layers), so a long streak is not cut to silence.
    const next=race.notes[i+1];if(race.slice&&next)for(let t=note.t+.6;t<next.t-.3;t+=.6)events.push({t:COUNTDOWN+t/tempo,kind:'beat',i,leg:note.leg,phase:racePhase(t),rest:true,fill:true});});
  for(const lap of (race.slice?[]:[1,2]))events.push({t:COUNTDOWN+lap*LEG_SECONDS,kind:'relay'});
  for(const n of race.notes)events.push({t:COUNTDOWN+n.t/tempo,kind:'note',lane:n.lane});
  const tune=race.slice&&MELODY[race.course?.id];
  if(tune)for(let t=1,k=0,end=race.notes.at(-1)?.t??0;t<end;k++){const [st,len]=tune[k%tune.length];if(st!==null)events.push({t:COUNTDOWN+t/tempo,kind:'melody',f:523.25*2**(st/12),len:len*.3/tempo});t+=len*.3;}
  for(const h of (race.slice?[]:race.hurdles)){
    events.push({t:COUNTDOWN+h.t-JUMP_LEAD-1,kind:'approach'});
    events.push({t:COUNTDOWN+h.t-JUMP_LEAD,kind:'hurdle'});
  }
  return events.sort((a,b)=>a.t-b.t);
}

export function outputDelay(context,now=performance.now()){
  let output;try{output=context.getOutputTimestamp?.()}catch{}
  if(Number.isFinite(output?.contextTime)&&output.contextTime>0&&Number.isFinite(output.performanceTime)&&output.performanceTime>0){
    const audible=output.contextTime+(now-output.performanceTime)/1000;
    return Math.max(0,Math.min(.25,context.currentTime-audible));
  }
  const latency=context.outputLatency||context.baseLatency||0;
  return Number.isFinite(latency)?Math.max(0,Math.min(.25,latency)):0;
}

// Tap latency (Settings → 節奏校正): how late this player's taps land after the beat they hear (Bluetooth earbuds, slow
// touch screens), in ms. Race rhythm taps are judged that much earlier (slice-app); 0 until calibrated.
const LATENCY_KEY='hoofbeat.latency.v1';
export function readLatency(){try{const v=parseFloat(localStorage.getItem(LATENCY_KEY));return Number.isFinite(v)?v:0}catch{return 0}}
export function saveLatency(ms){try{localStorage.setItem(LATENCY_KEY,String(Math.round(ms)))}catch{}}
// Calibration: `beats` beeps `interval` s apart, scheduled like the race (heard at their clock time after the reported
// output delay); the first `skip` are a count-in. Call from a user gesture (audio unlock).
// → {tap(eventTimeStamp) → steady taps so far, total, done: Promise<median ms late | null when under 6 taps>}
export async function calibrateLatency(clock,{beats=12,interval=.6,lead=1,skip=2}={}){
  const ctx=new(window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});await ctx.resume();
  const t0=clock.elapsed()+lead,start=ctx.currentTime+lead-outputDelay(ctx),late=[];
  for(let k=0;k<beats;k++){const at=start+k*interval,o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=k<skip?660:880;
    g.gain.setValueAtTime(.3,at);g.gain.exponentialRampToValueAtTime(.001,at+.08);o.connect(g).connect(ctx.destination);o.start(at);o.stop(at+.1);}
  const tap=stamp=>{const t=clock.inputElapsed(stamp),k=Math.round((t-t0)/interval);
    if(k>=skip&&k<beats&&late[k]===undefined&&Math.abs(t-t0-k*interval)<interval/2)late[k]=t-t0-k*interval;return late.filter(x=>x!==undefined).length;};
  const done=new Promise(res=>setTimeout(()=>{ctx.close();const v=late.filter(x=>x!==undefined).sort((a,b)=>a-b);
    res(v.length>=6?Math.round(v[v.length>>1]*1000):null);},(lead+beats*interval+.4)*1000));
  return {tap,done,total:beats-skip};
}

// Short tunes by name (accent): each event has its own, so the ear can tell them apart.
const ACCENTS={relay:[523.25,659.25],finish:[523.25,659.25,783.99],overtake:[659.25,987.77,1318.51],sprint:[392,587.33,880],final:[440,660,880,1174.66],warning:[330,247],streak:[659.25,783.99],
  milestone:[783.99,987.77,1174.66,1567.98],gait1:[523.25,659.25],gait2:[659.25,783.99,1046.5],apple:[783.99,1046.5,1318.51],charged:[587.33,880],handoff:[392,523.25,659.25,783.99],lesson:[523.25,783.99],
  win:[523.25,659.25,783.99,1046.5,1318.51],podium:[523.25,659.25,783.99,1046.5],lost:[392,329.63],star:[1046.5,1318.51]};
const LAYERS=[5,15,30,50];   // streak lengths at which the music gains a layer
// Each city's backing music (2026-10-04, the user: five kinds, by difficulty): the same pulse and streak layers, in its
// own key, chords, instrument and tune, and busier the harder the city (Taipei 1 · Paris 2 · Tokyo 2 · Stockholm 3 ·
// Seoul 3, which is also the order of their tempos).
//   roots  the four chords' bass notes (Hz), each lasting 8 notes; minor: which of them are minor
//   tune   one step per note, 16 notes round: an index into the chord's own five notes and its octave (SCALE), -1 a rest
//   lead   the tune's oscillator, how far above the chord root (×), loudness, length (s)
//   hat    ticks between the beats: 0 none, 1 on the off-beat, 2 sixteenths
//   drive  the bass: 0 only with a long streak, 1 on every beat and off-beat, 2 the off-beat an octave up
//   stab   a short chord on the off-beat; twice: the tune answers on the off-beat too (from a 5 streak)
//   blip   the left / right note cues, in the city's key
// Taipei: C major, a soft plain tune. Paris: F major, off-beat chords like an accordion band. Tokyo: D minor on the
// in scale, plucked like a koto. Stockholm: A minor, a driving bass and a sawtooth lead. Seoul: E minor, four on the
// floor with sixteenth hats, a jumping bass and an arpeggio.
const SCALE={major:[0,2,4,7,9,12],minor:[0,3,5,7,10,12],in:[0,1,5,7,8,12]};
const MUSIC={
  taipei:{roots:[130.81,110,174.61,196],minor:[0,1,0,0],tune:[0,1,2,1,0,1,2,3,2,1,0,1,2,3,4,3],lead:['triangle',4,.05,.22],hat:0,drive:0,stab:0,twice:0,blip:[659.25,880]},
  paris:{roots:[174.61,146.83,116.54,130.81],minor:[0,1,0,0],tune:[2,3,2,0,-1,1,2,3,4,3,2,1,0,-1,1,2],lead:['square',4,.026,.2],hat:0,drive:0,stab:1,twice:0,blip:[698.46,880]},
  tokyo:{roots:[146.83,116.54,130.81,146.83],minor:[1,0,0,1],scale:'in',tune:[0,2,3,2,4,3,2,0,5,4,3,2,3,2,1,0],lead:['triangle',4,.06,.12],hat:1,drive:0,stab:0,twice:0,blip:[587.33,880]},
  stockholm:{roots:[110,87.31,130.81,98],minor:[1,0,0,0],tune:[0,-1,2,3,4,3,2,-1,0,2,3,5,4,3,2,0],lead:['sawtooth',4,.022,.18],hat:1,drive:1,stab:0,twice:0,blip:[659.25,880]},
  seoul:{roots:[164.81,130.81,196,146.83],minor:[1,0,0,0],tune:[0,2,4,2,3,5,4,2,0,2,4,5,4,3,2,3],lead:['square',4,.024,.1],hat:2,drive:2,stab:1,twice:1,blip:[659.25,987.77]},
};
export class RaceAudio {
  constructor(){this.context=null;this.master=null;this.nodes=new Set();this.muted=false;this.next=0;this.timer=0;this.layer=0;try{this.muted=localStorage.getItem('hoofbeat.muted')==='true'}catch{}}
  async prepare() {
    try {
      this.context??=new(window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});
      if(!this.master){
        this.master=this.context.createGain();this.master.connect(this.context.destination);
        this.noiseBuffer=this.context.createBuffer(1,Math.ceil(this.context.sampleRate*.15),this.context.sampleRate);
        const data=this.noiseBuffer.getChannelData(0);let seed=12345;
        for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1}
      }
      if(!this.wind){
        const source=this.context.createBufferSource(),filter=this.context.createBiquadFilter(),gain=this.context.createGain();
        source.buffer=this.noiseBuffer;source.loop=true;filter.type='lowpass';filter.frequency.value=650;gain.gain.value=0;
        source.connect(filter);filter.connect(gain);gain.connect(this.master);source.start();
        this.wind={source,filter,gain};
      }
      this.master.gain.value=this.muted?0:.38;
      await this.context.resume();
    } catch { /* Gameplay and visual timing remain available without audio. */ }
  }
  voice(source,at,duration,volume,pan=0){
    const ctx=this.context,gain=ctx.createGain(),stereo=ctx.createStereoPanner?.();
    gain.gain.setValueAtTime(.001,at);gain.gain.exponentialRampToValueAtTime(Math.max(.002,volume),at+.004);
    gain.gain.exponentialRampToValueAtTime(.001,at+duration);
    source.connect(gain);
    if(stereo){stereo.pan.value=pan;gain.connect(stereo);stereo.connect(this.master)}else gain.connect(this.master);
    this.nodes.add(source);
    source.onended=()=>{this.nodes.delete(source);source.disconnect();gain.disconnect();stereo?.disconnect()};
    source.start(at);source.stop(at+duration+.01);
  }
  tone(frequency,at,duration=.1,type='sine',volume=.25,endFrequency=null,pan=0){
    if(!this.context||!this.master)return;
    const osc=this.context.createOscillator();osc.type=type;osc.frequency.setValueAtTime(frequency,at);
    if(endFrequency)osc.frequency.exponentialRampToValueAtTime(endFrequency,at+duration);
    this.voice(osc,at,duration,volume,pan);
  }
  tick(at,volume=.05,duration=.035){
    if(!this.noiseBuffer)return;
    const source=this.context.createBufferSource();source.buffer=this.noiseBuffer;this.voice(source,at,duration,volume);
  }
  start(getElapsed,race) {
    this.stop();this.next=0;this.layer=0;this.finalStretch=false;this.surge=0;this.beatGap=.6/(race.config?.tempo??1);this.music=MUSIC[race.course?.id]??MUSIC.taipei;this.getElapsed=getElapsed;this.events=buildScore(race);this.melody=this.events.some(e=>e.kind==='melody');this.end=race.slice?Infinity:COUNTDOWN+DURATION;   // the relay ends by distance
    if(!this.context)return;
    this.timer=setInterval(()=>this.schedule(),25);this.schedule();
  }
  schedule() {
    const ctx=this.context;if(!ctx||ctx.state!=='running')return;
    const t=this.getElapsed(),delay=outputDelay(ctx);
    // Schedule against the audible output clock, not the later animation callback.
    while(this.next<this.events.length&&this.events[this.next].t<t+.16+delay) {
      const event=this.events[this.next++],at=ctx.currentTime+event.t-t-delay;
      if((at<ctx.currentTime-.02&&!(event.kind==='count'&&t-event.t<.12))||event.t>=this.end)continue;
      const when=Math.max(ctx.currentTime,at);
      if(event.kind==='count'){this.tone(440,when,.08,'sine',.24);continue}
      if(event.kind==='go'){this.tone(880,when,.18,'sine',.25);this.tick(when,.16,.045);this.tone(300,when+.02,.26,'sawtooth',.05,1300);continue}   // the gate clacks open, a rush of air
      if(event.kind==='relay'){this.tone(523.25,when,.35,'sine',.14);this.tone(783.99,when+.08,.35,'sine',.1);continue}
      if(event.kind==='note'){this.tone(this.music.blip[event.lane?1:0],when,.065,'triangle',.15,null,event.lane?.45:-.45);continue}
      if(event.kind==='melody'){this.tone(event.f,when,Math.max(.09,event.len*.92),'square',.05);this.tone(event.f/2,when,Math.max(.09,event.len*.92),'triangle',.07);continue}
      if(event.kind==='approach'){this.tone(392,when,.10,'sine',.13);continue}
      if(event.kind==='hurdle'){this.tone(587.33,when,.14,'sine',.23,1174.66);continue}
      if(event.fill&&this.layer<2)continue;
      const M=this.music,bar=(Math.floor(event.i/8)+event.leg)%4,duck=event.rest?.3:1,late=event.phase==='finish'||this.finalStretch,chord=M.roots[bar],minor=M.minor[bar],half=this.beatGap/2;
      const scale=SCALE[minor?M.scale||'minor':'major'],third=2**((minor?3:4)/12),step=M.tune[event.i%16],[wave,up,loud,long]=M.lead;
      this.tone(100,when,.12,'sine',.26*duck,42);
      if(event.i%2===0)this.tone(chord,when,.24,'triangle',.1*duck);
      if(event.phase!=='opening'&&event.i%4===2)this.tick(when,.09*duck,.065);
      if(event.leg>0||late)this.tick(when+.04,(late?.06:.035)*duck);
      // The music fills in with the streak (layer, setCombo): a pad, a high note on the beat, a fifth between beats,
      // then a bass and an open hat. A miss takes one layer off (dropLayer), not all of them.
      // The city's tune and its own rhythm section (MUSIC).
      if(step>=0&&!event.rest&&!this.melody){this.tone(chord*up*2**(scale[step]/12),when,long,wave,loud*(1+.2*this.layer));
        if(M.twice&&this.layer>=1)this.tone(chord*up*2**(scale[(step+2)%6]/12),when+half,long,wave,loud*.8);}
      if(M.hat>=1)this.tick(when+half,.04*duck,.02);
      if(M.hat>=2){this.tick(when+half/2,.028*duck,.015);this.tick(when+half*1.5,.028*duck,.015);}
      if(M.drive){this.tone(chord/2,when,.16,'sine',.1*duck);this.tone(M.drive>1?chord:chord/2,when+half,.12,'sine',.075*duck);}
      if(M.stab){this.tone(chord*2,when+half,.08,'triangle',.045*duck);this.tone(chord*2*third,when+half,.08,'triangle',.035*duck);}
      if(event.i%4===0&&this.layer>=1){this.tone(chord*2,when,.34,'sine',.07*duck);this.tone(chord*2*third,when+.01,.32,'sine',.035*duck);this.tone(chord*3,when+.02,.32,'sine',.045*duck)}
      if(this.layer>=2)this.tone(chord*4,when,.1,'triangle',.05*duck);
      if(this.layer>=3)this.tone(chord*6,when+this.beatGap/2,.09,'triangle',.04*duck);
      if(this.layer>=4){this.tone(chord/2,when,.2,'sine',.13*duck);this.tick(when+this.beatGap/2,.05*duck,.08);}
      if(late&&!event.rest)this.tick(when+.18,.035,.025);
      // The harder the horse runs (surge), the busier the rhythm sounds: off-beat ticks from a third of the way up,
      // double time from two thirds. The notes keep their spacing.
      if(this.surge>=.34)this.tick(when+this.beatGap/2,.06*duck,.03);
      if(this.surge>=.67){this.tick(when+this.beatGap/4,.04*duck,.02);this.tick(when+this.beatGap*3/4,.04*duck,.02);}
    }
  }
  setCombo(combo){this.layer=Math.max(this.layer||0,LAYERS.filter(n=>combo>=n).length)}
  dropLayer(){this.layer=Math.max(0,(this.layer||0)-1)}
  // Airtime: everything dips for `seconds`, then comes back (the landing thud lands on the quiet).
  duck(seconds=.5){const ctx=this.context;if(ctx?.state!=='running'||this.muted)return;const g=this.master.gain,t=ctx.currentTime;
    g.cancelScheduledValues(t);g.setTargetAtTime(.19,t,.03);g.setTargetAtTime(.38,t+seconds,.06);}
  // A cue by name: the hurdle coming (approach), its take-off window opening (window), a long streak lost (break), a
  // sprint or an apple running out (ebb), a button (click), and step k of n while a number counts up (count).
  cue(kind,k=0,n=1){const ctx=this.context;if(ctx?.state!=='running')return;const t=ctx.currentTime;
    if(kind==='approach')this.tone(392,t,.1,'sine',.13);
    else if(kind==='window')this.tone(587.33,t,.14,'sine',.2,1174.66);
    else if(kind==='break')this.tone(392,t,.14,'triangle',.16,196);
    else if(kind==='ebb')this.tone(660,t,.2,'sine',.07,330);
    else if(kind==='click')this.tone(520,t,.05,'triangle',.14,780);
    else if(kind==='deny')this.tone(196,t,.07,'triangle',.12,147);
    else if(kind==='lane')this.tone(420,t,.06,'sine',.07,560);
    else if(kind==='count')this.tone(880*2**(k/Math.max(1,n)),t,.045,'triangle',.07);
    else if(kind==='crunch'){this.tick(t,.2,.05);this.tick(t+.05,.12,.03);}}
  tap(lane){
    const ctx=this.context;if(ctx?.state!=='running')return;
    // Immediate physical key response; score/energy still wait for chord resolution.
    this.tone(lane?300:260,ctx.currentTime,.024,'triangle',.065,145,lane?.25:-.25);
  }
  hoof(lane,perfect,speedRatio=1,combo=0) {
    const ctx=this.context;if(!ctx || ctx.state!=='running')return;
    // Good: a short hoof thud. Perfect: a fuller thud with a click and a bright two-step ping (crisper, not louder).
    const pace=Math.max(1,Math.min(1.5,speedRatio)),t=ctx.currentTime,pan=lane?.25:-.25,f=(lane?200:160)*pace;
    if(!perfect){this.tone(f,t,.045,'triangle',.28*(1+(pace-1)*.25),70,pan);return;}
    this.tone(f,t,.07,'triangle',.4*(1+(pace-1)*.25),55,pan);this.tick(t,.08,.014);
    const up=2**([0,2,4,5,7,9,11,12][Math.min(7,Math.max(0,combo-1))]/12);   // the ping climbs a scale with the combo: an octave by the 8th hit in a row
    const a=(lane?1318.51:1046.5)*up;this.tone(a,t,.05,'sine',.12);this.tone((lane?1975.53:1567.98)*up,t+.014,.04,'sine',.06);
    // Past the octave it grows richer, not louder: a fifth from 10 in a row, an octave above from 25, a sparkle from 50.
    if(combo>=10)this.tone(a*1.5,t+.006,.05,'sine',.04);if(combo>=25)this.tone(a*2,t+.02,.06,'sine',.035);if(combo>=50)this.tick(t+.012,.04,.03);
  }
  speedFeedback(speedRatio=1,surge=0,rush=0){   // rush 0–1: a sprint or an apple has the horse (more wind)
    this.surge=surge;const ctx=this.context;if(!this.wind||ctx?.state!=='running')return;
    const strength=Math.max(0,Math.min(1,(speedRatio-1)/.45));
    this.wind.gain.gain.setTargetAtTime(.065*strength+.07*rush,ctx.currentTime,.12);
    this.wind.filter.frequency.setTargetAtTime(650+1150*strength,ctx.currentTime,.12);
  }
  jump(clear){const ctx=this.context;if(ctx?.state==='running')this.tone(clear?390:260,ctx.currentTime,.22,'sine',.24,clear?780:330)}
  collision(){const ctx=this.context;if(ctx?.state==='running'){this.tone(130,ctx.currentTime,.18,'triangle',.25,42);this.tick(ctx.currentTime,.12,.09)}}
  land(clear=false){const ctx=this.context;if(ctx?.state==='running'){this.tone(145,ctx.currentTime,.12,'triangle',.34,48);if(clear)this.tone(523.25,ctx.currentTime+.025,.12,'sine',.14)}}
  accent(kind){
    const ctx=this.context;if(ctx?.state!=='running')return;
    if(kind==='sprint')this.tone(220,ctx.currentTime,.34,'sawtooth',.09,990);   // a rising whoosh under the chord
    const notes=ACCENTS[kind]??ACCENTS.relay,long=kind==='finish'||kind==='win'||kind==='podium';
    notes.forEach((note,i)=>this.tone(note,ctx.currentTime+i*(kind==='milestone'?.055:long?.09:.065),long?.35:.14,'sine',.13));
    if(kind==='win')this.tick(ctx.currentTime+notes.length*.09,.12,.3);   // a cymbal on the last note
  }
  // Pickup chime; step: the coin's place in its run of three (each a tone higher, the third with a sparkle on top).
  // A segment stored: each one a step higher than the last, so the ear knows how many are in hand; the one that
  // fills the horse's store ends on a third note and a sparkle ("full: use one").
  charged(n=1,full=false){const ctx=this.context;if(ctx?.state!=='running')return;const t=ctx.currentTime,k=[1,1.189,1.335][Math.min(2,Math.max(0,n-1))];
    this.tone(587.33*k,t,.14,'sine',.13);this.tone(880*k,t+.065,.14,'sine',.13);if(full){this.tone(1174.66*k,t+.13,.2,'sine',.12);this.tick(t+.13,.05,.03);}}
  coin(step=0){const ctx=this.context;if(ctx?.state!=='running')return;const t=ctx.currentTime,up=2**(step*2/12);this.tone(1318.51*up,t,.07,'triangle',.12);this.tone(1975.53*up,t+.06,.14,'triangle',.1);if(step>=2)this.tone(2637*up,t+.12,.16,'sine',.07);}
  countIn(){const ctx=this.context;if(ctx?.state==='running')for(const t of [0,.6])this.tone(440,ctx.currentTime+t,.08,'sine',.2)}
  setMuted(value){this.muted=value;if(this.master){this.master.gain.cancelScheduledValues(0);this.master.gain.value=value?0:.38;}try{localStorage.setItem('hoofbeat.muted',String(value))}catch{}}
  silence(){clearInterval(this.timer);if(this.wind&&this.context)this.wind.gain.gain.setTargetAtTime(0,this.context.currentTime,.03);for(const node of this.nodes){try{node.stop()}catch{}}this.nodes.clear()}
  pause(){this.silence();this.context?.suspend().catch(()=>{})}
  resume(getElapsed){
    this.getElapsed=getElapsed;this.silence();
    const t=getElapsed();this.next=this.events.findIndex(e=>e.t>=t);
    if(this.next<0)this.next=this.events.length;
    if(this.context){this.timer=setInterval(()=>this.schedule(),25);this.schedule()}
  }
  stop(){this.silence()}
}
