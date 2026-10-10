import {roadHalfWidth} from './track-presentation.mjs?v=r430';
import {updateCompositionRanking,updateProgress} from './race-hud.js?v=r430';
import {PRESENTATION as P,PHONE,PLAYER_FAR} from './presentation-config.mjs?v=r430';
import {chaseComposition,compositionRivals} from './race-composition.mjs?v=r430';
import {playerRhythmPath,PRESENTATION_LOOKAHEAD} from './presentation-path.mjs?v=r430';
import {installApprovedEnvironment} from './approved-environment.js?v=r430';
import {createApprovedHorse,approvedAssets,mergeForRace} from './approved-assets.js?v=r430';
import {THREE, animateHorse, disposeHorse} from './horse-model.js?v=r430';
import {HORSES, CITIES, DURATION, LEG_SECONDS, JUMP_LEAD, JUMP_WINDOW, sprintActive, boostActive, raceLane, weatherAt, weatherAmount, trackAt, jumpMotion, timingWindows, clamp} from './game.js?v=r430';
import {turnAt} from './track-projection.js?v=r430';
import {ROAD_WIDTH, HORSE_Z, HIT_Z, NOTE_LOOKAHEAD, RUNNER_LANES, raceCameraFov, raceCameraFrame, roadPose, beatPose, hurdlePose, rivalOffset, relayActors} from './race-world.js?v=r430';
import {RaceHorsePose,projectedHorseHeight,rhythmScreenPose} from './race-motion.js?v=r430';

const PALETTES = [
  {sky: '#82c8f0', fog: '#c0dfdf', grass: '#8aad62', verge: '#abc77f', dirt: '#d4b38a', trees: '#609050', hill: '#91b39a'},
  {sky: '#9acfe9', fog: '#cbdfdc', grass: '#7caa7a', verge: '#a9c890', dirt: '#cbb99c', trees: '#528b71', hill: '#8eafa9'},
  {sky: '#93cddd', fog: '#e0dfca', grass: '#c6c194', verge: '#d4cca3', dirt: '#dac098', trees: '#769073', hill: '#b2bba3'}
];
const BEAT_COLORS = ['#fff071', '#46dee2'];
// The rider's seat (radians of forward bend: split = the share at hips / spine / chest / neck, the neck turning back
// up; mostly at the hips, the thighs held where they were: the toy rider's rigid parts come apart at a sharp waist bend): `ride` at a trot, + `crouch` as the horse runs harder (tuck, 0–1: the player's surge; anyone's
// sprint) and + `sprint` in a sprint. seat: how much of the authored half-seat (RacePose) from upright to tucked.
// max: the most bend there is room for over the horse's neck (a stumble on top of a full tuck). On horse_new3 (a higher,
// fuller crest than the first horse's) with rider_new2: past ~.75 the helmet goes into the neck (crouch was .45, sprint .1).
export const POSTURE={ride:.45,crouch:.25,sprint:.3,max:1.05,split:[.6,.2,.2,-.3],seat:[.6,1],tripLean:.35,reach:.02,rush:[.07,.07],tripPitch:.2,tripRoll:.06,rival:[2.4,.3],wind:[.22,.14,.1],ram:[.32,.95,.28,.2],come:[.12,.3,.22,.55,1.25,.3]};   // sprint: the rider folds flat over the neck (2026-10-10, the user: the sprint did not read; it was .05) · rush: in a sprint the buddy's nose goes down this much more (rad) and it runs this much lower (m) · rival: a rival that is hit rolls this many times more than a stumble and swerves this far (m) · come: a rival coming over at the player (slice-game ramStep), by the share u of its time: first it leans away [until u, m, rad], then it rolls toward the player and drifts over: across its lane line (.55 m… of the 1.1 to it) at the share `react` of the time, at the player's flank [m] with this roll [rad] at the hit · ram: the bump: how long (s), how far the buddy throws itself sideways (m; the next lane is 2.2 m off), how far it rolls into it and turns toward it (rad); it is out fast and back slow · wind: the kick's wind-up, the first share of its time: rump down (rad), body down (m)
// The racing stride, three gaits by how hard the horse is running: 小跑步 (trot) → 大跑步 (canter) → 奔跑 (gallop). The
// player's horse: slice-game gait(); rivals canter and gallop in a sprint.
// All from the one Gallop clip: each leg bone's turn away from its standing pose is
// amplified (gain by segment, × the gait's amp), one cycle covers the gait's `length` × the ground it did (shorter: a
// quicker cadence), and the body rises (lift, m) and rocks (rock, rad) with every stride.
export const STRIDE={gain:{Front_Upper:1.8,Hind_Upper:1.85,Front_Lower:1.45,Hind_Lower:1.45,Front_Hoof:1.25,Hind_Hoof:1.25},
  length:[.6,.8,1.05],amp:[.5,1,1.5],lift:[.05,.1,.17],rock:[.03,.06,.1],push:.16};   // push: m the horse drives forward on a hit
const gait=(a,g)=>{const i=Math.min(1,Math.floor(g));return a[i]+(a[i+1]-a[i])*(g-i);};   // a gait value at g (0–2, between gaits while changing)
const STRIDE_Q=new THREE.Quaternion();
// Horses and riders (every runner alike): 19% smaller on screen than the 1.18 they were sized at (two 10% cuts). They
// also stand 0.9 m further up the road (race-world HORSE_Z), which alone makes them 7% smaller: the factor allows for it.
// Try-out (SPEC 6.0k): ?big=<×> draws every horse and rider that much bigger (with ?cam, the camera further back). The
// rules' distances do not change with it.
const RUNNER={scale:1.18*.81*1.07*1.2};   // × 1.2 (2026-10-04, the user's call: bigger horses now the camera is 15 m back); the following distance grew with them (slice-config followGap)
// A struck note (rhythm): it lifts off the pad over `time` (simulation s), rising `rise` × its size and growing by
// `grow` ([Good, Perfect]); an unhit one is drawn for `past` s after its beat (by then it has left the screen).
const NOTE_POP={time:.42,rise:[.7,1.15],grow:[.2,.45],past:1.6};
// Race look rider (the concept art's rider): limbs turned about the rider's forward axis on top of the pose (rad, + =
// the bone's outer side up): thighs down off the horse's wide barrel with the shins back out so the feet stay in the
// stirrups (the splayed flat thighs read as big hips). Parents before children. The upper arms are not turned
// (2026-10-04, the user: hands in toward the horse's neck, not out in the air; they were ±.5, elbows out, the fists
// beside the hips): the pose's own hands rest at the foot of the mane. Their entries stay: the second is the fist pump's.
const RIDER_TURNS=[['UpperArmL',0],['UpperArmR',0],['ThighL',-.2],['ThighR',.2],['ShinL',.35],['ShinR',-.35]];
const RIDER_WAIST=1.2;   // the lower torso × this sideways (and half as much front to back), the chest scaled back: a less pinched waist
const BUCK=[['HindUpper',[0,-.45,-.9]],['HindLower',[0,.05,-1]],['HindCannon',[0,.22,-.97]],['HindHoof',[0,.45,-.9]]],BUCK_Q=new THREE.Quaternion(),BUCK_W=new THREE.Quaternion(),BUCK_P=new THREE.Quaternion(),BUCK_X=new THREE.Vector3(),BUCK_Y=new THREE.Vector3(),BUCK_Z=new THREE.Vector3(),BUCK_M=new THREE.Matrix4();
const ARM_Q=new THREE.Quaternion(),ARM_W=new THREE.Quaternion(),FORWARD=new THREE.Vector3();
// The horse and rider answer the player (racePosture). lean: the horse rolls into a lane change (rad at most, per lane
// of sideways speed); slump: after two misses in a row the rider sits up out of the crouch (share of the bend lost)
// until the next hit; glance: the rider's head turns to a rival passed or passing ([rad, s]); pump: a fist in the air
// for a clean jump, a leap, taking the lead ([rad on the right upper arm, s]); tail: it flicks to the side of a hit
// ([rad, s]). kick: a sprint or an apple widens the view by this many degrees (the framing itself stays).
const WIDE=(new URLSearchParams(globalThis.location?.search||'').get('wide')||'6,9,3').split(',').map(Number);   // [m up, m back, m its aim is raised] the camera is taken at a start gate wider than the three lanes
const REACT={pump:[-1.7,.7],kick:8,rise:[.3,.22],launch:[0,1.4],lamp:{reach:6,from:16,size:1.9,alpha:.8,tint:new THREE.Color('#ffd98a')}};
// rise: over a fence the camera lifts [m, look-at m] per metre of the player's jump · launch: [degrees the view is closed in
// by on the grid, seconds it opens out over once they are off] (0 since 2026-10-05, it was 3.5: the user saw the buddy a different size in the countdown and in the race) · lamp: the street lamps' glow, lit `reach` m further up the
// road per hit of the streak (to 16), none nearer than `from` m ahead of the horse (a glow that near fills the screen).
const Y_AXIS=new THREE.Vector3(0,1,0),Z_AXIS=new THREE.Vector3(0,0,1),bell=u=>u>0&&u<1?Math.sin(Math.PI*u):0;
const SCREEN=new THREE.Vector3(),BEND_Q=new THREE.Quaternion(),X_AXIS=new THREE.Vector3(1,0,0);
const HANDOFF={in:6,out:10,drift:2.2};   // metres after the relay line; drift: how far the relieved horse peels off sideways (inside the fence from an outer lane)
// The camera is P.camera.distance behind the player's horse. PAST: what is on the track (hurdles, coins, the finish
// line) stays drawn until the camera has passed it. A rival right behind the player's horse stands in front of it and
// is drawn solid (the user's call, 2026-10-04: no see-through horses).
const PAST=P.camera.distance+2;
const RUNNER_LENGTH=4;   // m: a runner this far past the camera's place has its nose behind the camera too (the model is about 3 m long × RUNNER.scale)
const RIDER_HEAD=.66;   // race look: the rider's head (helmet, face, hair) × this, from the neck (from behind the helmet took the eye)
const LEAP_LIFT=2.1;   // a sprint leap (slice-game leapTarget) clears the horse ahead: the hurdle arc (1.55 m) × 2.1 tops its rider's head
const SLICE_TURN=.2;
// Race look effects (slice): soft round sprites, one draw per layer (THREE.Points). Per point: position, size (m),
// alpha and tint; `scale` turns metres into pixels for the camera and canvas. Hoof dust kicked up behind every galloping
// horse (more in a sprint, darker on mud; it stays where it was kicked, so it streams back at the race speed) and a
// warm glow behind each coin.
const COIN_GLOW=new THREE.Color('#ffc84a'),SPARK=[new THREE.Color('#ffe27a'),new THREE.Color('#fff6d0'),new THREE.Color('#ffb52e')];
// Coin pickup: a burst of gold sparks and a flash where the coin was (they stay with the rider, no ground scroll), and
// a 'coin-burst' event on the canvas with its screen point (slice-app flies a coin to the HUD counter from there).
const SPARKS={max:200,count:22,life:.55,speed:[2.5,5.5],size:[.5,.1],flash:{size:3,life:.24}};
// Pickups stand at `height` (m, their centre), `scale` m across, and turn about their upright axis (`spin` rad per
// simulation s, each one `step` rad ahead of the one before: a row shimmers in a wave), bobbing `bob` m; a halo behind
// (glow: its size in m, tint, alpha) and sparks of their own colours when picked up.
const COIN={scale:1.2,height:1.3,spin:3.4,step:.7,bob:0,glow:1.6,tint:COIN_GLOW,alpha:.3,sparks:SPARK};
const APPLE={scale:1.3,height:1.4,spin:1.6,step:0,bob:.12,glow:2.3,tint:new THREE.Color('#ff6a4a'),alpha:.4,sparks:[new THREE.Color('#ff5a48'),new THREE.Color('#fff2e0'),new THREE.Color('#8fd45a')]};
const DUST={max:300,rate:20,life:.8,size:[.6,2],alpha:.6,dirt:new THREE.Color('#c9a27c'),mud:new THREE.Color('#7f5f45')};
// Behind the player's horse the lanes close in on the middle of the screen (SPEC 6.0k): from NARROW.from m behind it,
// everything is drawn up to NARROW.by nearer the camera's centre line (reached NARROW.over m further back). The view is
// only ±14° wide, so the next lanes ran off the sides just behind the horse and a horse coming up there showed late,
// at the very edge; narrowed, it shows a few metres earlier. Ahead of the horse, the horizon and the skyline are
// untouched.
// Drawing only: WARP goes into the vertex stage of every material this renderer compiles (three's project_vertex
// chunk, swapped in while it compiles; the puff layers carry their own copy) and acts for a camera looking up the
// track. A runner (skinned) moves as one piece, by its own spot; shadows are cast as if flat.
// ponytail: the camera-to-horse distance is baked in (the speed pull-back moves the start up to 0.6 m). Per-material
// uniforms if it has to follow the camera.
// The rhythm ribbons' colours [body, edge, glow], left and right (measured from the painted ribbon by tools/ribbon.py).
const RIBBON=[['#ffce32','#ffd742','#ffbc0e'],['#1cd4ff','#40e0ff','#00b4ff']];
const NARROW={by:.5,from:1.5,over:6};
const warp=(v,dc=chaseComposition(.55).z-HORSE_Z)=>{const n=x=>x.toFixed(4);return `
if(!isOrthographic&&viewMatrix[2][2]>.8){mat3 hbR=mat3(viewMatrix);
#ifdef USE_SKINNING
vec3 hbO=transpose(hbR)*(viewMatrix*vec4(modelMatrix[3].xyz,1.)).xyz;
#else
vec3 hbO=transpose(hbR)*${v}.xyz;
#endif
float hbU=hbO.z+${n(dc-NARROW.from)};
if(hbU>0.){vec3 hbW=transpose(hbR)*${v}.xyz;hbW.x-=hbO.x*${n(NARROW.by)}*min(hbU,${n(NARROW.over)})/${n(NARROW.over)};${v}.xyz=hbR*hbW;}}
`;};
const PROJECT=THREE.ShaderChunk.project_vertex,WARP=warp('mvPosition');
const warped=draw=>{THREE.ShaderChunk.project_vertex=PROJECT.replace('gl_Position',WARP+'gl_Position');try{draw();}finally{THREE.ShaderChunk.project_vertex=PROJECT;}};
function puffLayer(max,additive=false,onTop=false){   // onTop: drawn over everything (the coin burst happens inside the horse)
  const g=new THREE.BufferGeometry(),a=(n,w)=>{const b=new THREE.BufferAttribute(new Float32Array(n*w),w);b.setUsage(THREE.DynamicDrawUsage);return b;};
  g.setAttribute('position',a(max,3));g.setAttribute('size',a(max,1));g.setAttribute('alpha',a(max,1));g.setAttribute('tint',a(max,3));
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:!onTop,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,uniforms:{scale:{value:1}},
    vertexShader:'attribute float size,alpha;attribute vec3 tint;uniform float scale;varying float vA;varying vec3 vC;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);'+warp('mv')+'gl_PointSize=size*scale/-mv.z;vA=alpha;vC=tint;gl_Position=projectionMatrix*mv;}',
    fragmentShader:'varying float vA;varying vec3 vC;void main(){vec2 d=gl_PointCoord-.5;float r=max(0.,1.-dot(d,d)*4.);float a=vA*r*r;if(a<.01)discard;gl_FragColor=vec4(vC,a);\n#include <colorspace_fragment>\n}'});
  const points=new THREE.Points(g,m);points.frustumCulled=false;points.renderOrder=onTop?10:2;g.setDrawRange(0,0);
  return {points,g,m,count:0,set(i,x,y,z,size,alpha,c){const A=g.attributes;A.position.setXYZ(i,x,y,z);A.size.setX(i,size);A.alpha.setX(i,alpha);A.tint.setXYZ(i,c.r,c.g,c.b);},
    sync(camera,height,count){this.count=count;m.uniforms.scale.value=height*.5*camera.projectionMatrix.elements[5];for(const k in g.attributes)g.attributes[k].needsUpdate=true;g.setDrawRange(0,count);}};
}   // road bend at a full course bend (roadPose turn): ~9 m sideways 100 m ahead
export class ChaseRenderer {
  constructor(canvas,{controls=[],rhythm=true,slice=false,city=null,capture=false}={}) {
    this.canvas = canvas;this.slice=slice;this.city=city;
    this.controls=controls;this.targets=[];
    if(rhythm){
      this.rhythmCanvas=document.createElement('canvas');this.rhythmCanvas.className='rhythm-overlay';this.rhythmCanvas.setAttribute('aria-hidden','true');
      this.rhythmCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3';
      canvas.after(this.rhythmCanvas);this.rhythmContext=this.rhythmCanvas.getContext('2d');
      if(this.slice){
        this.noteCanvas=document.createElement('canvas');this.noteCanvas.className='rhythm-note-overlay';this.noteCanvas.setAttribute('aria-hidden','true');
        this.noteCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5';
        this.rhythmCanvas.after(this.noteCanvas);this.noteContext=this.noteCanvas.getContext('2d');
      }
    }
    // preserveDrawingBuffer only for the dev capture pages (capture: true): it costs a copy every frame on phones.
    this.r = new THREE.WebGLRenderer({canvas, antialias: !PHONE, alpha: false, preserveDrawingBuffer: capture, powerPreference: 'high-performance'});
    this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, PHONE ? 1.25 : 1.5));
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.r.toneMappingExposure = .98;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(49, 1, .1, 520);
    this.scene.add(new THREE.HemisphereLight('#fff8ed', '#76948a', 1.6));
    this.sun = new THREE.DirectionalLight('#fff4df', 1.8);
    this.sun.position.set(-25, 40, 20);
    this.scene.add(this.sun);
    this.resources = new Set();
    this.models = new Map();
    this.pulses = [-100, -100];
    this.pulseStrength=[0,0];
    this.judgementPositions=[];
    this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.dummy = new THREE.Object3D();
    this.lastCity = -1;
    this.lastWeather = '';
    this.lastTerrain = '';
    this.lastStats = -10;
    this.frameAverage = 16.7;
    this.frameSamples = 0;
    this.buildEnvironment();
    this.buildRhythm();
    this.buildHurdles();
    this.buildRelayGates();
    if(this.slice)this.approvedEnvironment=installApprovedEnvironment(this);
    this.canvas.dataset.renderEngine = 'three-webgl';
    this.canvas.addEventListener('webglcontextlost', this.onContextLost = e => {
      e.preventDefault();
      this.canvas.dispatchEvent(new CustomEvent('race-render-error', {bubbles: true}));
    });
  }

  own(resource) { this.resources.add(resource); return resource; }
  material(color, basic = false) {
    return this.own(basic ? new THREE.MeshBasicMaterial({color}) : new THREE.MeshStandardMaterial({color, roughness: 1}));
  }
  mesh(geometry, material, parent = this.scene) {
    const mesh = new THREE.Mesh(geometry, material); parent.add(mesh); return mesh;
  }
  texture(draw, width = 128, height = 64) {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    draw(c.getContext('2d'), width, height);
    const texture = this.own(new THREE.CanvasTexture(c));
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  strip(width, y, material) {
    const count = 112, data = new Float32Array((count + 1) * 6), indices = [];
    const uv=new Float32Array((count+1)*4);
    for(let i=0;i<=count;i++){uv.set([0,i/count,1,i/count],i*4)}
    for (let i = 0; i < count; i++) {const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);}
    const geometry = this.own(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(data, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    const normals = new Float32Array(data.length);
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3)); geometry.setIndex(indices);
    const mesh = this.mesh(geometry, material); mesh.frustumCulled = false;
    return {width, y, count, data, geometry};
  }
  instances(geometry, material, count) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
    this.scene.add(mesh); return mesh;
  }
  place(instance, index, x, y, z, sx, sy, sz, angle = 0) {
    this.dummy.position.set(x, y, z); this.dummy.rotation.set(0, angle, 0);
    this.dummy.scale.set(sx, sy, sz); this.dummy.updateMatrix(); instance.setMatrixAt(index, this.dummy.matrix);
  }
  buildEnvironment() {
    const plane = this.own(new THREE.PlaneGeometry(620, 620));
    this.grassMaterial = this.material('#8aad62');
    this.ground = this.mesh(plane, this.grassMaterial); this.ground.rotation.x = -Math.PI / 2; this.ground.position.set(0, -.045, -120);
    this.vergeMaterial = this.material('#abc77f'); this.roadMaterial = this.material('#d4b38a');
    const dirt=this.texture((c,w,h)=>{
      c.fillStyle='#c7ad8b';c.fillRect(0,0,w,h);let seed=83;
      const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
      for(let i=0;i<9000;i++){const shade=random();c.fillStyle=shade>.5?'#816d5120':'#fff1d528';c.beginPath();c.ellipse(random()*w,random()*h,.5+random()*2,1+random()*3,random()*3,0,Math.PI*2);c.fill()}
    },512,512);
    dirt.wrapS=dirt.wrapT=THREE.RepeatWrapping;dirt.repeat.set(3,90);this.roadMaterial.map=dirt;
    this.verge = this.strip(ROAD_WIDTH + 1.6, -.015, this.vergeMaterial);
    this.road = this.strip(ROAD_WIDTH, 0, this.roadMaterial);
    const box = this.own(new THREE.BoxGeometry(1, 1, 1));
    this.railMaterial = this.material('#f5f5e9');
    this.posts = this.instances(box, this.railMaterial, 92);
    this.rails = this.instances(box, this.railMaterial, 184);
    this.pathMarks = this.instances(box, this.material('#eee0c2', true), 54);
    this.pathMarks.material.transparent = true; this.pathMarks.material.opacity = .13;
    const sphere = this.own(new THREE.SphereGeometry(1, 16, 10));
    this.treeMaterial = this.material('#609050');
    this.trunks = this.instances(this.own(new THREE.CylinderGeometry(.14, .23, 1, 7)), this.material('#7e7761'), 56);
    this.crowns = this.instances(sphere, this.treeMaterial, 168);
    this.treeData = Array.from({length: 56}, (_, i) => ({
      side: i % 2 ? 1 : -1, z: (i * 23.73) % 180, offset: 10 + ((i * 19.37) % 45),
      height: 2.6 + ((i * 1.31) % 3.7), width: 1.4 + ((i * 1.71) % 1.7)
    }));
    for (let i = 0; i < 168; i++) this.crowns.setColorAt(i, new THREE.Color().setHSL(.22 + (i % 4) * .012, .25, .64 + (i % 3) * .09));
    this.hills = [];
    for (let i = 0; i < 9; i++) {
      const material = this.material('#91b39a');
      const hill = this.mesh(sphere, material);
      hill.position.set((i - 4) * 65, -3, -390 - (i % 3) * 12);
      hill.scale.set(33 + (i % 3) * 12, 9 + (i % 4) * 2.5, 36);
      this.hills.push(hill);
    }
    const cloudMaterial = this.cloudMaterial = this.material('#f5faf5');
    this.clouds = new THREE.Group(); this.scene.add(this.clouds);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      const cloud = this.mesh(sphere, cloudMaterial, this.clouds);
      cloud.position.set(-110 + i * 43 + j * 5, 29 + (i % 3) * 6 + (j === 1 ? 2 : 0), -140 - (i % 2) * 20);
      cloud.scale.set(7, 3 + (j === 1 ? 1.5 : 0), 4);
    }
    const shadowMap = this.texture((c, w, h) => {
      const gradient = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gradient.addColorStop(0, 'rgba(32,48,37,.32)'); gradient.addColorStop(.45, 'rgba(32,48,37,.22)'); gradient.addColorStop(1, 'rgba(32,48,37,0)');
      c.fillStyle = gradient; c.fillRect(0, 0, w, h);
    }, 64, 64);
    this.shadowMaterial = this.own(new THREE.MeshBasicMaterial({map: shadowMap, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1}));
    this.shadowGeometry = this.own(new THREE.PlaneGeometry(2.1, 3.7));
    const finishMap = this.texture((c, w, h) => {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 18; x++) {c.fillStyle = (x + y) % 2 ? '#f5f4e9' : '#344d45'; c.fillRect(x * w / 18, y * h / 2, w / 18 + 1, h / 2);}
    }, 512, 64);
    this.finish = this.mesh(this.own(new THREE.PlaneGeometry(ROAD_WIDTH, .9)), this.own(new THREE.MeshBasicMaterial({map: finishMap})));
    this.finish.rotation.x = -Math.PI / 2; this.finish.visible = false;
    const rainData = new Float32Array(180 * 6);
    this.rainGeometry = this.own(new THREE.BufferGeometry()); this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainData, 3).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(this.rainGeometry, this.own(new THREE.LineBasicMaterial({color: '#dfedf0', transparent: true, opacity: .45})));
    this.rain.frustumCulled = false; this.scene.add(this.rain);
    this.puddleMaterial=this.own(new THREE.MeshBasicMaterial({color:'#b6d5dc',transparent:true,opacity:0,depthWrite:false}));
    this.puddles=this.instances(this.own(new THREE.CircleGeometry(1,24).rotateX(-Math.PI/2)),this.puddleMaterial,30);
    this.weatherColors={sky:new THREE.Color(),fog:new THREE.Color(),road:new THREE.Color()};
  }
  buildRhythm() {
    this.noteImages=[];
    for (let lane = 0; lane < 2; lane++) {
      const noteMap = this.texture((c, w, h) => {
        if(this.slice){
          c.fillStyle=lane?'#46dee2bb':'#fff071bb';c.strokeStyle='#fffdf0';c.lineWidth=5;
          c.beginPath();c.arc(w/2,h/2,w*.43,0,Math.PI*2);c.fill();c.stroke();return;
        }
        c.strokeStyle=BEAT_COLORS[lane];c.lineWidth=8;c.shadowColor=BEAT_COLORS[lane];c.shadowBlur=12;
        c.beginPath();if(this.slice)c.arc(w/2,h/2,w*.36,0,Math.PI*2);else c.ellipse(w/2,h/2,w*.36,h*.40,0,0,Math.PI*2);c.stroke();
        c.fillStyle=BEAT_COLORS[lane];
        if(this.slice){c.beginPath();c.arc(w/2,h/2,w*.30,0,Math.PI*2);c.fill()}
        else for(const side of [-1,1]){c.beginPath();c.ellipse(w/2+side*17,h/2,13,28,side*.14,0,Math.PI*2);c.fill()}
      },128,128);
      this.noteImages.push(noteMap.image);
      // Slice: the painted note (assets/ui, tools/ribbon.py), once it has loaded; the drawn disc until then.
      if(this.slice){const img=new Image();img.onload=()=>{this.noteImages[lane]=img;};img.src=new URL(`./assets/ui/note_${lane?'right':'left'}.webp`,import.meta.url).href;}
    }
    this.runnerLabels = ['YOU', 'PACER', 'CHASER', 'HAZEL', 'RIO', 'SAGE'].map((text, i) => {
      const map = this.texture((c, w, h) => {
        c.fillStyle = ['#205a50ee','#465e59dd','#946944ee','#8a5a2cee','#3d4f86ee'][i]; c.beginPath(); c.roundRect(0, 0, w, h, 12); c.fill();
        c.fillStyle = '#fffdf0'; c.font = 'bold 26px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 1);
      }, 128, 40);
      const label = new THREE.Sprite(this.own(new THREE.SpriteMaterial({map, depthWrite: false})));
      label.scale.set(1.03, .32, 1);label.visible=false; this.scene.add(label); return label;
    });
  }
  pulse(lane, time, strength=1) {this.pulses[lane] = time;this.pulseStrength[lane]=strength;}
  // The rider looks to that side (−1 left, 1 right) / punches the air, from now (race time).
  // The ball game (2026-10-08): buck(): the kick behind. win(): first past the post, it rears and the rider's fist goes up.
  buck(){this.buckAt=this.raceTime??0;}
  // The bump (2026-10-10, the user: 「撞了好像不明顯」): the player's buddy throws its shoulder at the runner beside it (side 0 left, 1 right) and comes back.
  ram(side){this.ramAt=this.raceTime??0;this.ramSide=side?1:-1;}
  // Where a runner is on the screen (CSS px of the canvas): lane (lane units), how far ahead of the player (m), y: m up.
  screenOfRunner(lane,ahead,y=2.6,laneSpacing=2.2){const p=new THREE.Vector3(lane*laneSpacing,y,HORSE_Z-ahead).project(this.camera);return {x:(p.x+1)*this.width/2,y:(1-p.y)*this.height/2,behind:p.z>1};}
  win(){this.winAt=performance.now();}
  // The same track and field again: the scene, the models and the coins stay; only what the last run left is cleared.
  rerun(race){
    if(this.coinMeshes&&(this.coinMeshes.length!==race.coins.length||this.appleMeshes.length!==(race.apples||[]).length))return false;
    for(const m of [...this.coinMeshes||[],...this.appleMeshes||[]])m.userData.burst=false;
    this.dustParts=[];this.sparkParts=[];this.dustTime=undefined;this.pulses=[-100,-100];this.buckAt=this.winAt=this.ramAt=null;this.sliceTurn=0;this.surge=0;this.kick=0;
    this.models.forEach(e=>{for(const k of ['sprint','gait','crouch','tuck','dustTime','dustDue','lastTime','animationTime','lastDistance','bones'])delete e[k];if(e.model.blaze)e.model.blaze.value=0;});
    return true;
  }
  // The start gate (slice races): a stall per runner where it stands at the start, a door before each that swings open
  // over the last of the countdown (time: simulation seconds, below 0 before GO); left behind once they are off.
  startGate(race,time,turn){
    if(!this.stalls){
      const box=this.own(new THREE.BoxGeometry(1,1,1)),white=this.material('#f4efe2'),blue=this.material('#2f58c8'),group=new THREE.Group(),W=race.config.laneSpacing*(race.config.stall||.5)/2;this.scene.add(group);
      const part=(parent,x,y,z,sx,sy,sz,m)=>{const o=this.mesh(box,m,parent);o.position.set(x,y,z);o.scale.set(sx,sy,sz);return o;};
      const xs=[race.laneValue,...race.rivals.filter(r=>r.distance>-50).map(r=>r.laneValue)].map(l=>l*race.config.laneSpacing),posts=[...new Set(xs.flatMap(x=>[x-W,x+W]).map(x=>+x.toFixed(2)))];
      for(const x of posts)for(const z of [0,3.4])part(group,x,1.5,z,.12,3,.12,white);
      for(const x of posts)part(group,x,2.9,1.7,.08,.1,3.4,white);
      part(group,(Math.min(...posts)+Math.max(...posts))/2,3.2,0,Math.max(...posts)-Math.min(...posts)+.3,.5,.16,blue);
      const doors=xs.flatMap(x=>[-1,1].map(side=>{const pivot=new THREE.Group();pivot.position.set(x+side*W,0,0);group.add(pivot);for(const y of [.9,1.5,2.1])part(pivot,-side*W/2,y,0,W-.08,.1,.08,blue);return {pivot,side};}));
      this.stalls={group,doors,wide:Math.max(...xs.map(Math.abs))>race.config.laneSpacing?WIDE:0};
    }
    const g=this.stalls,ahead=3.2-race.distance,pose=roadPose(HORSE_Z-ahead,turn),open=clamp(1+time/.7,0,1);
    g.group.visible=ahead>-30;g.group.position.set(pose.x,0,pose.z);g.group.rotation.y=pose.heading;
    for(const d of g.doors)d.pivot.rotation.y=d.side*Math.PI*.55*open*open*(3-2*open);
  }
  buildRelayGates(){
    const box=this.own(new THREE.BoxGeometry(1,1,1)),wood=this.material('#aa8761'),roof=this.material('#557b75'),trim=this.material('#e3d7b6');
    this.relayGates=[1,2,3].map(lap=>{
      const group=new THREE.Group();this.scene.add(group);
      const part=(x,y,z,sx,sy,sz,material)=>{const m=this.mesh(box,material,group);m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m};
      for(const x of [-9.4,-4.95,4.95,9.4])for(const z of [7.8,13.8])part(x,2.95,z,.28,5.9,.28,wood);
      const canopy=part(0,5.85,10.8,19.3,.36,6,roof);canopy.visible=lap<3;
      for(const z of [7.8,13.8])part(0,5.57,z,19.3,.28,.24,trim);
      if(lap<3)for(let x=-9;x<=9;x+=1.5)part(x,6.055,10.8,.07,.05,6,trim);
      // Waiting bays are outside the racing lanes; the solid roof hides the handoff.
      for(const x of [-7.6,7.6])for(const z of [-2,3])part(x,1.15,z,3,.14,.18,wood);
      const doors=[-6.5,5.8,8.5].map(x=>{
        const pivot=new THREE.Group();pivot.position.set(x-1,0,1);group.add(pivot);
        for(const y of [.55,1.05]){const rail=this.mesh(box,trim,pivot);rail.position.set(1,y,0);rail.scale.set(2,.12,.14)}
        return pivot;
      });
      const map=this.texture((c,w,h)=>{c.fillStyle='#244e49';c.fillRect(0,0,w,h);c.fillStyle='#fff4d4';c.textAlign='center';c.textBaseline='middle';c.font='bold 29px Arial';c.fillText(lap===3?'FINISH':`RELAY  /  LAP ${lap+1}`,w/2,h/2)},512,64);
      const sign=this.mesh(this.own(new THREE.PlaneGeometry(6.3,.8)),this.own(new THREE.MeshBasicMaterial({map})),group);sign.position.set(0,5.24,13.95);
      const line=this.mesh(this.own(new THREE.PlaneGeometry(ROAD_WIDTH,.5)),this.material('#f3e4b4',true),group);line.rotation.x=-Math.PI/2;line.position.y=.025;
      return {group,canopy,doors,lap};
    });
  }
  gates(time,turn){
    for(const gate of this.relayGates){
      const remaining=gate.lap*LEG_SECONDS-time;
      gate.group.visible=remaining<7&&remaining>-2;
      const pose=roadPose(HORSE_Z-remaining*12,turn);
      gate.group.position.set(pose.x,0,pose.z);gate.group.rotation.y=pose.heading;
      gate.doors.forEach(door=>{door.visible=gate.lap<3;door.rotation.y=-Math.PI/2*clamp(1-remaining,0,1)});
    }
    this.canvas.dataset.relayGate=String(this.relayGates.find(g=>g.group.visible)?.lap||0);
  }
  buildHurdles(){
    const box=this.own(new THREE.BoxGeometry(1,1,1)),white=this.material('#fffbed');
    this.hurdleModels=Array.from({length:6},()=>[0,-ROAD_WIDTH/3,ROAD_WIDTH/3].map(lane=>{
      const group=new THREE.Group(),beam=new THREE.Group(),accent=this.material('#df9467');
      group.add(beam);this.scene.add(group);group.visible=false;group.scale.x=ROAD_WIDTH/3/2.1;
      for(const x of [-.93,.93]){
        const post=this.mesh(box,white,group);post.position.set(x,.46,0);post.scale.set(.14,.92,.14);
        const foot=this.mesh(box,white,group);foot.position.set(x,.04,0);foot.scale.set(.4,.08,.62);
      }
      for(let i=0;i<6;i++){
        const bar=this.mesh(box,i%2?white:accent,beam);bar.position.set(-.875+i*.35,0,0);bar.scale.set(.35,.2,.18);
      }
      beam.position.y=.70;
      const marker=this.mesh(this.own(new THREE.PlaneGeometry(1.7,.24)),this.own(new THREE.MeshBasicMaterial({color:'#fff1a3',transparent:true,opacity:.7,depthWrite:false})),group);
      marker.rotation.x=-Math.PI/2;marker.position.set(0,.03,JUMP_LEAD*12);
      return {group,beam,accent,lane,marker};
    }));
  }
  hurdles(race,time,turn,offsets){
    let visible=0;
    race.hurdles.forEach((h,i)=>this.hurdleModels[i].forEach((entry,side)=>{
      const remaining=race.slice?(h.distance-race.distance)/12:h.t-time,show=remaining<(race.slice?9:5)&&remaining>(race.slice?-PAST/12:-.9)&&(!race.slice||side===0);
      entry.group.visible=show;if(!show)return;visible++;
      const p=hurdlePose(remaining,turn,entry.lane),hit=h.state==='hit'&&remaining<=0;
      entry.group.position.set(p.x,0,p.z);entry.group.rotation.y=p.heading;
      entry.beam.rotation.z=hit?-.28*clamp(-remaining/.25,0,1):0;
      entry.beam.position.y=hit?.7-.38*clamp(-remaining/.25,0,1):.7;
      entry.accent.color.set(hit?'#c05b4e':side===0&&h.state==='cleared'?'#6eaf90':race.slice?'#315daa':'#df9467');
      const ready=side===0&&!h.state&&Math.abs(remaining-JUMP_LEAD)<=JUMP_WINDOW;
      entry.marker.visible=side===0&&!h.state&&remaining>0&&remaining<2.5;
      entry.marker.material.opacity=ready?.95:.35;
      if(ready)entry.accent.color.set('#fff1a3');
    }));
    this.canvas.dataset.visibleHurdles=String(visible);
  }
  prepare(race) {this.buckAt=this.winAt=this.ramAt=null;   // a new run: nothing of the last one's kick or win (2026-10-08: only rerun() cleared them)

    this.resize(); this.configure(race, -3);
    // Upload coats and compile all relay runners before the countdown starts.
    const teams=race.slice?[['player',race.horses,0],...race.rivals.map((r,i)=>[r.id,r.horses,i+1])]:[['player', race.team], ...compositionRivals(race,race.metrics?.()||{rivals:race.rivals,player:{distance:0,speed:12}}).map(r=>[r.id,r.team])];
    for (const [role, team, variant] of teams) team.forEach((id, leg) => {
      const {model} = race.slice?this.model(`${role}-${leg}`,variant,id.coat,id.hair):this.model(`${role}-${leg}-${id}`, id);
      model.root.visible = true;
      model.root.traverse(mesh => {if (mesh.isMesh) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (material.map) this.r.initTexture(material.map);});
    });
    warped(()=>this.r.compile(this.scene, this.camera));
  }
  // The canvas size comes from a ResizeObserver: measuring it every frame forced a full page layout each frame (the race
  // page rewrites its HUD every frame), which held phones near 30 fps.
  resize() {
    if (!this.sizeObserver) {this.sizeObserver = new ResizeObserver(([e]) => {this.box = e.contentRect;}); this.sizeObserver.observe(this.canvas);}
    const {width, height} = this.box ?? this.canvas.getBoundingClientRect();
    if (!width || !height) return false;
    if (this.width !== width || this.height !== height) {
      this.width = width; this.height = height; this.r.setSize(width, height, false);
      this.camera.aspect = width / height;
      // Tall phones need enough horizontal room for three runners and both beat lanes.
      this.camera.fov = this.slice?chaseComposition(this.camera.aspect).fov:raceCameraFov(this.camera.aspect);
      this.camera.updateProjectionMatrix();
      if(this.rhythmCanvas){
        const ratio=Math.min(window.devicePixelRatio||1,PHONE?1.25:1.5);this.rhythmCanvas.width=Math.round(width*ratio);this.rhythmCanvas.height=Math.round(height*ratio);this.rhythmContext.setTransform(ratio,0,0,ratio,0,0);
        if(this.noteCanvas){this.noteCanvas.width=Math.round(width*ratio);this.noteCanvas.height=Math.round(height*ratio);this.noteContext.setTransform(ratio,0,0,ratio,0,0);}
      }
      const canvasRect=this.canvas.getBoundingClientRect();
      this.targets=[0,1].map(lane=>{
        const button=this.controls[lane],rect=button?.getBoundingClientRect();
        return rect?{x:rect.left+rect.width/2-canvasRect.left,y:rect.top+rect.height/2-canvasRect.top,size:rect.width}:{x:width*(lane?.83:.17),y:height*.87,size:62};
      });
    }
    return true;
  }
  configure(race, time) {
    const palette = PALETTES[race.city], amount=weatherAmount(race.weather,time), rain=amount>0;
    const environmentChanged = this.lastCity !== race.city || this.lastWeather !== race.weather;
    if (environmentChanged) {
      const sky = rain ? '#a5c3ce' : palette.sky, fog = rain ? '#b6cbd0' : palette.fog;
      this.scene.background = new THREE.Color(sky); this.scene.fog = new THREE.Fog(fog, rain ? 38 : 65, rain ? 125 : 215);
    this.grassMaterial.color.set(palette.grass); this.vergeMaterial.color.set(palette.verge); this.treeMaterial.color.set(palette.trees);
      this.hills.forEach((hill, i) => hill.material.color.set(palette.hill).lerp(new THREE.Color(fog), .12 + (i % 3) * .12));
      this.sun.intensity = rain ? 1.05 : 1.8; this.rain.visible = rain; this.clouds.visible = !rain;
      this.lastCity = race.city; this.lastWeather = race.weather;
    }
    this.scene.background.set(palette.sky).lerp(this.weatherColors.sky.set('#9cafb9'),amount*.8);
    this.scene.fog.color.set(palette.fog).lerp(this.weatherColors.fog.set('#afbec7'),amount*.85);
    this.scene.fog.near=110-35*amount;this.scene.fog.far=365-100*amount;
    this.sun.intensity=1.45-.6*amount;this.rain.visible=rain;this.rain.material.opacity=.55*amount;
    this.clouds.visible=true;this.cloudMaterial.color.set('#edf1ea').lerp(this.weatherColors.sky.set('#9cabb1'),amount*.7);
    this.puddleMaterial.opacity=.25*amount;this.puddles.visible=amount>0;
    const leg = clamp(Math.floor(Math.max(0, time) / LEG_SECONDS), 0, 2), terrain = trackAt(race.city,time);
    if (terrain !== this.lastTerrain || environmentChanged) {
      this.roadMaterial.color.set(terrain === 'mud' ? (rain ? '#938a76' : '#af997d') : palette.dirt);
      this.lastTerrain = terrain;
    }
    this.roadMaterial.color.set(terrain==='mud'?'#af997d':palette.dirt).lerp(this.weatherColors.road.set(terrain==='mud'?'#817f70':'#b0a897'),amount*.7);
    if(terrain!=='mud')this.roadMaterial.color.set('#eee7dd').lerp(this.weatherColors.road.set('#b0a897'),amount*.7);
    this.canvas.dataset.activeLeg = String(leg + 1); this.canvas.dataset.terrain = terrain;
    this.canvas.dataset.weather=weatherAt(race.weather,time);this.canvas.dataset.rainAmount=amount.toFixed(3);
  }
  updateRoad(turn, distance) {
    if(this.roadMaterial.map)this.roadMaterial.map.offset.y=distance*this.roadMaterial.map.repeat.y/390;
    for(const line of this.laneLines||[]){
      for(let i=0;i<=line.count;i++)for(let side=0;side<2;side++){
        const p=roadPose(14-i/line.count*line.far,turn,line.offset+(side?1:-1)*line.width/2),k=i*6+side*3;
        line.data[k]=p.x;line.data[k+1]=line.y;line.data[k+2]=p.z;
      }
      line.geometry.attributes.position.needsUpdate=true;
    }
    // Slice mud: the road is tinted where the course is mud (vertex colours over the dirt texture), eased over 8 m.
    if(this.race?.slice){
      const g=this.road.geometry;let c=g.attributes.color;
      if(!c){c=new THREE.BufferAttribute(new Float32Array((this.road.count+1)*6).fill(1),3).setUsage(THREE.DynamicDrawUsage);g.setAttribute('color',c);this.roadMaterial.vertexColors=true;this.roadMaterial.needsUpdate=true;}
      const mud=d=>{let m=0;for(const o of [-4,0,4])m+=this.race.terrainAt(d+o)==='mud'?1/3:0;return m;};
      for(let i=0;i<=this.road.count;i++){const m=mud(distance+HORSE_Z-(14-i/this.road.count*390));
        for(let side=0;side<2;side++)c.setXYZ(i*2+side,1-.36*m,1-.47*m,1-.55*m);}
      c.needsUpdate=true;
    }
    for (const strip of [this.verge, this.road]) {
      for (let i = 0; i <= strip.count; i++) for (let side = 0; side < 2; side++) {
        const z=14-i/strip.count*390;
        const half=this.slice?roadHalfWidth(z)+(strip.width-P.track.width)/2:strip.width/2;
        const pose = roadPose(z, turn, (side ? 1 : -1) * half), k = i * 6 + side * 3;
        strip.data[k] = pose.x; strip.data[k + 1] = strip.y; strip.data[k + 2] = pose.z;
      }
      strip.geometry.attributes.position.needsUpdate = true;
    }
    const spacing = 4.2, scroll = distance % spacing;
    for (let i = 0; i < 46; i++) for (let side = 0; side < 2; side++) {
      const z = 14 - i * spacing + scroll, lane = (side ? 1 : -1) * (ROAD_WIDTH / 2 + .65);
      const p = roadPose(z, turn, lane), n = roadPose(z - spacing, turn, lane), index = i * 2 + side;
      this.place(this.posts, index, p.x, .66, p.z, .14, 1.38, .14, p.heading);
      const dx = n.x - p.x, dz = n.z - p.z;
      for (let rail = 0; rail < 2; rail++) this.place(this.rails, index * 2 + rail, (p.x + n.x) / 2, .48 + rail * .53, (p.z + n.z) / 2, .10, .12, Math.hypot(dx, dz) + .08, Math.atan2(dx, dz));
    }
    this.posts.instanceMatrix.needsUpdate = true; this.rails.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 54; i++) {
      const z = 10 - (i % 18) * 9 + distance % 9, p = roadPose(z, turn, (Math.floor(i / 18) - 1) * 2.35);
      this.place(this.pathMarks, i, p.x, .012, p.z, .065, .006, 3 + i % 3, p.heading);
    }
    this.pathMarks.instanceMatrix.needsUpdate = true;
    for(let i=0;i<30;i++){
      const p=roadPose(12-(i*7.13-distance%7.13),turn,((i*1.73)%7)-3.5);
      this.place(this.puddles,i,p.x,.023,p.z,.28+(i%3)*.12,1,.55+(i%4)*.25,p.heading);
    }
    this.puddles.instanceMatrix.needsUpdate=true;
    this.treeData.forEach((tree, i) => {
      const z = 20 - ((tree.z - distance) % 180 + 180) % 180;
      const p = roadPose(z, turn, tree.side * tree.offset), size = this.lastCity === 2 ? .7 : 1;
      this.place(this.trunks, i, p.x, tree.height * .32, p.z, size, tree.height * .64, size);
      for (let j = 0; j < 3; j++) this.place(this.crowns, i * 3 + j, p.x + (j - 1) * tree.width * .55, tree.height * (.78 + (j === 1 ? .14 : 0)), p.z + (j % 2) * .3, tree.width * size, tree.height * .40, tree.width * .86 * size);
    });
    this.trunks.instanceMatrix.needsUpdate = true; this.crowns.instanceMatrix.needsUpdate = true;
  }
  model(key, id, coat=null, hair=null) {   // hair: a relay leg's own mane style (the player's buddies; approved-assets HAIR)
    if (!this.models.has(key)) {
      // phones: rivals on the light models (createApprovedHorse far)
      const model = createApprovedHorse(id,coat,PLAYER_FAR||PHONE&&!key.startsWith('player'),hair); model.root.scale.setScalar(RUNNER.scale); this.scene.add(model.root);
      if(this.slice){mergeForRace(model).forEach(resource=>this.own(resource));   // 31 parts → 5 meshes, 2 skeletons (mobile)
        const bone=n=>model.riderContent.getObjectByName(n),w=1+(RIDER_WAIST-1)/2;   // race look: a smaller head, a fuller waist
        bone('Head')?.scale.setScalar(RIDER_HEAD);bone('Spine')?.scale.set(RIDER_WAIST,1,w);bone('Chest')?.scale.set(1/RIDER_WAIST,1,1/w);}
      if(PHONE&&!key.startsWith('player'))model.root.traverse(o=>{if(o.isMesh)o.castShadow=false;});   // phones: rivals keep only the ground blob
      const shadow = this.mesh(this.shadowGeometry, this.shadowMaterial.clone()); this.own(shadow.material); shadow.rotation.x = -Math.PI / 2;
      this.models.set(key, {model, pose:new RaceHorsePose(model), shadow, opacity: 1});
    }
    return this.models.get(key);
  }
  runners(race, time, turn, metrics) {
    this.models.forEach(({model, shadow}) => {model.root.visible = false; shadow.visible = false;});
    const rivals=compositionRivals(race,metrics);
    const runners=[{id:'player',team:race.team,...metrics.player,lead:0,leg:race.leg,horses:race.horses,jumps:race.jumps},...rivals];
    for (const [index,runner] of runners.entries()) {
      const role=runner.id,team=runner.team,lane=role==='player'?(race.slice?race.laneValue*race.config.laneSpacing:raceLane(race,time)*2.2):(runner.visualLane??RUNNER_LANES[role]),offset=race.slice?-(runner.visualGap||0):rivalOffset(runner.lead);
      const runnerTime=time;
      for (const actor of (race.slice?this.sliceActors(race,role,runner,lane,offset):relayActors(team, runnerTime, lane))) {
        const entry = race.slice?this.model(`${role}-${actor.leg}`,index,runner.horses[actor.leg].coat,runner.horses[actor.leg].hair):this.model(`${role}-${actor.leg}-${actor.id}`, actor.id), {model, shadow} = entry;
        model.setLOD?.(actor.waiting&&HORSE_Z-actor.z>16?'far':'near');
        const hoofAccent=role==='player'&&actor.active?this.pulses.map((at,lane)=>this.pulseStrength[lane]*clamp(1-(time-at)/.32,0,1)):[0,0];
        const p = roadPose(actor.z+(race.slice?0:offset), turn, actor.lane), impulse = Math.max(...hoofAccent);
        const jump=actor.active?(race.slice?jumpMotion(runner,time,false):jumpMotion(race,time,role!=='player')):{height:0,pitch:0,airborne:false};if(role==='player'&&actor.active)this.playerJump=jump.height;
        if(race.slice&&jump.airborne&&runner.jumps.findLast(j=>time>=j.t)?.leap)jump.height*=LEAP_LIFT;
        const collision=role==='player'&&actor.active&&!race.slice&&race.hurdles.some(h=>h.state==='hit'&&time>=h.t&&time<h.t+.35);
        const scale=RUNNER.scale;
        model.root.scale.setScalar(scale);
        // A rival the camera has passed (behind it, off the screen) is not posed or drawn: it was costing its whole model,
        // its bones and its animation every frame for nothing (up to four of them while the player leads).
        const unseen=race.slice&&role!=='player'&&actor.z-HORSE_Z>PAST+RUNNER_LENGTH;
        model.root.visible = actor.opacity > 0&&!unseen; model.root.position.set(p.x, .025+jump.height-.05*(jump.crouch||0)-.09*(jump.landing||0), p.z); model.root.rotation.set(jump.pitch+(collision?-.09:0),p.heading,0);
        if (actor.active){
          this.runnerLabels[index].position.set(p.x,3.77*scale+jump.height,p.z-.45);
          this.canvas.dataset[role+'Z']=p.z.toFixed(3);
          this.canvas.dataset[role+'ProjectedHeight']=projectedHorseHeight(this.camera,p.x,p.z,scale).toFixed(4);
        }
        if(role==='player'&&actor.active)this.canvas.dataset.jumpHeight=jump.height.toFixed(3);
        if (entry.opacity !== actor.opacity) {
          model.root.traverse(mesh => {if (mesh.isMesh) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            const transparent = actor.opacity < 1;
            if (material.transparent !== transparent) {material.transparent = transparent; material.needsUpdate = true;}
            material.opacity = actor.opacity;
          }});
          entry.opacity = actor.opacity;
        }
        if(unseen){shadow.visible=false;continue;}
        const coast=time>DURATION?Math.exp(-(time-DURATION)*1.8):1;
        const speed = clamp(runner.speed / (race.slice?race.config.baseSpeed:12), .92, race.slice&&role==='player'?1.5:1.28)*coast;
        if(race.slice&&!actor.running)entry.animationTime=(entry.animationTime||0)+Math.max(0,time-(entry.lastTime??time));   // waiting at the gate: idle
        else if(race.slice){
          // Tie the gallop cycle to ground covered, so a rhythm surge visibly
          // quickens the stride without making the horse run in place.
          entry.animationTime=(entry.animationTime||0)+Math.max(0,(runner.distance-(entry.lastDistance??runner.distance))/race.config.baseSpeed/gait(STRIDE.length,entry.gait??1));
          entry.lastDistance=runner.distance;
        }else entry.animationTime = entry.lastTime === undefined ? Math.max(0, time) : entry.animationTime + Math.max(0, time - entry.lastTime) * speed;
        entry.lastTime = time;
        entry.pose.restore();animateHorse(model, entry.animationTime, {running: time >= 0&&actor.running, impulse, hoofAccent, reduced: this.reduced});entry.pose.apply(jump);model.riderPose?.(time>=0&&actor.running,jump.airborne?clamp(jump.phase/.1,0,1):jump.landing||0,race.slice?POSTURE.seat[0]+(POSTURE.seat[1]-POSTURE.seat[0])*(entry.tuck??0):undefined);model.updateAttachment?.();
        if(race.slice)this.racePosture(entry,race,role,runner,time,actor,jump);
        // Full gallop (the player: a sprint, an apple or the top gait; a rival: its sprint): the gold rim (approved-assets RACE_FUR blaze).
        if(model.blaze){const want=role==='player'?+(race.gait?.()===2):+!!runner.boosting;model.blaze.value+=(want-model.blaze.value)*.14;}
        if(race.slice&&actor.active&&actor.running&&time>=0&&!jump.airborne&&!this.reduced)this.kickDust(entry,p,runner,race,time);
        shadow.visible = model.root.visible; shadow.position.set(p.x, .018, p.z); shadow.rotation.set(-Math.PI / 2, 0, -p.heading); shadow.material.opacity = actor.opacity*(1-jump.height*.27);shadow.scale.setScalar((scale/1.18)*(1+jump.height*.12));
      }
    }
  }
  // Racing posture (slice), layered on the Gallop clip and the rider's RacePose: the rider rides a forward half-seat and
  // tucks down flat the harder the horse runs; the horse reaches with its neck and its stride grows by gait (STRIDE; the
  // stride itself follows ground covered). A knocked hurdle is a clear stumble: nose down, a dip, the rider thrown
  // forward, a wobble, then straight back to running.
  racePosture(entry,race,role,runner,time,actor,jump){
    // Leg bones the kick or the win turned last frame go back to what they were, unless the animation has written them
    // since (it only writes a bone whose value changed): without this a frame that stands still (a pause, the finish, a
    // buddy whose legs the stride below does not touch) kept the kicked legs, and the stride took them for the gallop's.
    for(const x of entry.kept||[])if(x.b.quaternion.equals(x.set))x.b.quaternion.copy(x.was);entry.kept=[];
    const model=entry.model,run=actor.running&&time>=0&&!this.reduced?1:0,fold=jump.airborne?clamp(jump.phase/.1,0,1):jump.landing||0;
    const player=role==='player'&&actor.active,target=role==='player'?race.rush(time):runner.boosting?1:0;entry.sprint=(entry.sprint??0)+(target-(entry.sprint??0))*.12;   // rush: a sprint or an apple
    const s=entry.sprint,st=player?race.stumbles.at(-1):runner.stumbleAt!=null?{t:runner.stumbleAt}:null,age=st?time-st.t:9,   // a rival's last stumble too (2026-10-08: kicked, shoved or off a fence, it showed nothing)
      T=race.config.stumbleTime;
    const trip=age>=0&&age<T?Math.sin(Math.PI*age/T):0,phase=(entry.animationTime||0)*2*Math.PI/(model.clips.run?.duration||.77);
    const surge=player?race.surge():0,level=player?race.gait():target>0?2:1;
    const g=entry.gait=(entry.gait??level)+(level-(entry.gait??level))*.07;
    model.root.rotation.x+=run*(gait(STRIDE.rock,g)*Math.sin(phase)-POSTURE.reach*(1+s)-POSTURE.rush[0]*s)-POSTURE.tripPitch*trip;   // reach: nose a little down, more in a sprint
    model.root.position.y-=run*POSTURE.rush[1]*s;
    // A rival that is hit (kicked, bumped, off a fence) staggers: it rolls further than the player's own stumble and swerves.
    const hard=player?1:POSTURE.rival[0];model.root.rotation.z=POSTURE.tripRoll*hard*trip*Math.sin(age*4*Math.PI/T);
    if(!player&&trip){const h=model.root.rotation.y,sw=POSTURE.rival[1]*trip*Math.sin(age*2*Math.PI/T);model.root.position.x+=Math.cos(h)*sw;model.root.position.z-=Math.sin(h)*sw;}
    // A hit on the beat (the pads' pulse): the player's horse drives forward a little and dips its nose.
    const hit=role==='player'&&actor.active?run*Math.max(...this.pulses.map((at,l)=>this.pulseStrength[l]*clamp(1-(time-at)/.32,0,1))):0;
    if(hit){const h=model.root.rotation.y;model.root.position.x-=Math.sin(h)*STRIDE.push*hit;model.root.position.z-=Math.cos(h)*STRIDE.push*hit;model.root.rotation.x-=.025*hit;}
    // The harder the horse is running (race.surge: the combo drive in a solo run), the lower its rider crouches.
    entry.crouch=(entry.crouch??0)+(surge-(entry.crouch??0))*.08;const tuck=entry.tuck=Math.max(entry.crouch,s);
    model.root.position.y+=run*gait(STRIDE.lift,g)*Math.abs(Math.sin(phase))-.14*trip;
    // Legs: amplified from the standing pose, on a kept base like the rider's bend below (the jump pose wins while it folds).
    entry.stride??=[...entry.pose.bones.values()].filter(b=>STRIDE.gain[b.role]).map(b=>({b,base:new THREE.Quaternion(),set:null}));
    for(const x of entry.stride){const q=x.b.bone.quaternion;
      if(!x.set||!q.equals(x.set))x.base.copy(q);
      q.copy(x.b.rest).slerp(STRIDE_Q.copy(x.base),1+(STRIDE.gain[x.b.role]-1)*gait(STRIDE.amp,g)*run*(1-fold));(x.set??=new THREE.Quaternion()).copy(q);}
    // Rider: bend at the waist (POSTURE.split), neck part of the way back up; the legs stay in the stirrups. The
    // mixer only rewrites a bone when its animated value changes (not every frame), so the bend goes on top of a kept
    // base pose (refreshed whenever the mixer did write) instead of being added to the bone again each frame.
    entry.back??=['Hips','Spine','Chest','Neck'].map(n=>model.riderContent?.getObjectByName(n)).filter(Boolean);
    const bend=model.forward*Math.min(POSTURE.max,(run*(POSTURE.ride+POSTURE.crouch*tuck+POSTURE.sprint*s))*(1-fold)+POSTURE.tripLean*trip);   // forward: less on a llama (approved-assets COATS)
    const look=0,pump=player&&this.winAt?1:0;   // 2026-10-08: the rider's glance at a rival and the fist for a clean jump or a pass are gone; the fist is the win's
    entry.back.forEach((bone,i)=>{
      entry.backBase??=[];entry.backSet??=[];
      if(!entry.backSet[i]||!bone.quaternion.equals(entry.backSet[i]))(entry.backBase[i]??=new THREE.Quaternion()).copy(bone.quaternion);
      bone.quaternion.copy(entry.backBase[i]).multiply(BEND_Q.setFromAxisAngle(X_AXIS,bend*POSTURE.split[i]));
      if(i===3&&look)bone.quaternion.multiply(BEND_Q.setFromAxisAngle(Y_AXIS,look));   // the neck: a glance to the side
      (entry.backSet[i]??=new THREE.Quaternion()).copy(bone.quaternion);
    });
    // RIDER_TURNS: each limb turns about the rider's forward axis, on a kept base like the bend above.
    entry.limbs??=RIDER_TURNS.map(([n,a])=>[model.riderContent?.getObjectByName(n),a]).filter(([b])=>b);
    FORWARD.set(0,0,-1).applyQuaternion(model.root.quaternion);
    entry.limbs.forEach(([bone,angle],i)=>{
      entry.limbBase??=[];entry.limbSet??=[];
      if(!entry.limbSet[i]||!bone.quaternion.equals(entry.limbSet[i]))(entry.limbBase[i]??=new THREE.Quaternion()).copy(bone.quaternion);
      bone.parent.updateWorldMatrix(true,false);bone.parent.getWorldQuaternion(ARM_W).multiply(entry.limbBase[i]);
      const axis=FORWARD.clone().applyQuaternion(ARM_W.invert()).normalize();
      bone.quaternion.copy(entry.limbBase[i]).multiply(ARM_Q.setFromAxisAngle(axis,angle+(i===1?REACT.pump[0]*pump:0)));   // i 1: the right upper arm (the fist pump)
      if(bone.parent===entry.back[0])bone.quaternion.premultiply(BEND_Q.setFromAxisAngle(X_AXIS,-bend*POSTURE.split[0]));   // the thighs stay where they were under the turned hips
      (entry.limbSet[i]??=new THREE.Quaternion()).copy(bone.quaternion);
    });
    // The ball game's two moves of its own (buck, win above), last: after the stride's own leg work above, which would
    // take these legs as the gallop's and push them further. The whole body turns and lifts, so every buddy has them;
    // the legs (the horse's rig: Fore* / Hind* bones) fold where the model has them.
    if(!player&&runner.ram&&race.config.ram&&!this.reduced){const R=race.config.ram,[w,back,lean,line,hit,roll]=POSTURE.come,u=clamp((time-runner.ram.t)/R.time,0,1),ur=R.react/R.time,d=runner.ram.dir;
      // away first (the wind-up), then over: to its lane line by `react`, into the player by the end, faster and faster
      const off=u<w?-back*Math.sin(Math.PI*u/w):u<ur?line*((u-w)/(ur-w))**1.5:line+(hit-line)*((u-ur)/(1-ur))**2,tilt=u<w?-lean*Math.sin(Math.PI*u/w):roll*Math.min(1,(u-w)/(1-w)*1.6);
      const R0=model.root,h=R0.rotation.y;R0.position.x+=Math.cos(h)*off*d;R0.position.z-=Math.sin(h)*off*d;R0.rotation.z-=tilt*d;R0.rotation.y-=.12*Math.max(0,tilt)*d;}
    if(player&&!this.reduced&&this.ramAt!=null){const [T,far,roll,turn]=POSTURE.ram,u=(time-this.ramAt)/T,k=u>0&&u<1?Math.sin(Math.PI*Math.pow(u,.55)):0;   // out in the first third, back over the rest
      if(k>.01){const R=model.root,h=R.rotation.y,d=this.ramSide;R.position.x+=Math.cos(h)*far*k*d;R.position.z-=Math.sin(h)*far*k*d;R.rotation.z-=roll*k*d;R.rotation.y-=turn*k*d;}}
    if(player&&!this.reduced){const R=model.root,now=performance.now()/1000;
      const keep=bone=>{const x={b:bone,was:bone.quaternion.clone(),set:null};entry.kept.push(x);return x;};
      const legs=(names,angle)=>{for(const n of names){const bone=(entry.bones??={})[n]??=model.content?.getObjectByName(n)??null;if(bone){const x=keep(bone);bone.rotateX(angle);x.set=bone.quaternion.clone();}}};
      const win=this.winAt?Math.min(1,(now-this.winAt/1000)/.35):0,up=win*win*(3-2*win);
      if(up>.01){R.rotation.x+=.42*up;R.position.y+=.4*up;legs(['ForeUpperL','ForeUpperR'],-.8*up);legs(['ForeLowerL','ForeLowerR'],1.2*up);}   // the win: it rears, forelegs tucked
      // The kick behind: nose down, rump up, and both hind legs thrown straight out behind. The legs are aimed, not
      // turned from where the gallop has them (r336 turned them: the kick looked different at every point of the stride,
      // folded under the tail at some; the user: 「後踢有問題」). A bone runs along its +Y; BUCK is the way each segment
      // points in the buddy's own space (y up, z forward) at the top of the kick.
      if(this.buckAt!=null){const u=(time-this.buckAt)/.6,[share,sink,drop]=POSTURE.wind,w=bell(u/share),k=bell((u-share*.8)/(1-share*.8));   // the wind-up: it sits back on its haunches, then lets fly
        if(w>.01){R.rotation.x+=sink*w;R.position.y-=drop*w;}
        if(k>.01){R.rotation.x-=.3*k;R.position.y+=.25*k;R.updateMatrixWorld(true);
        const base=model.content?.getObjectByName('Root')??R;base.getWorldQuaternion(BUCK_Q);const turn=Math.min(1,k*1.6);
        for(const side of ['L','R'])for(const [n,d] of BUCK){const bone=(entry.bones??={})[n+side]??=model.content?.getObjectByName(n+side)??null;if(!bone)continue;
          bone.parent.updateWorldMatrix(true,false);BUCK_Y.set(...d).normalize().applyQuaternion(BUCK_Q);BUCK_X.set(1,0,0).applyQuaternion(BUCK_Q);BUCK_X.addScaledVector(BUCK_Y,-BUCK_X.dot(BUCK_Y)).normalize();
          BUCK_W.setFromRotationMatrix(BUCK_M.makeBasis(BUCK_X,BUCK_Y,BUCK_Z.crossVectors(BUCK_X,BUCK_Y)));bone.parent.getWorldQuaternion(BUCK_P);const x=keep(bone);bone.quaternion.slerp(BUCK_P.invert().multiply(BUCK_W),turn);x.set=bone.quaternion.clone();}}}}
    model.updateAttachment?.();
  }
  coinBurst(at,S=COIN){
    const r=Math.random;
    this.sparkParts.push({x:at.x,y:at.y,z:at.z,vx:0,vy:0,vz:0,age:0,life:SPARKS.flash.life,size:[SPARKS.flash.size*.6,SPARKS.flash.size],a:.9,c:S.sparks[1]});
    for(let i=0;i<SPARKS.count&&this.sparkParts.length<SPARKS.max;i++){const a=r()*Math.PI*2,e=(r()-.3)*1.4,v=SPARKS.speed[0]+r()*(SPARKS.speed[1]-SPARKS.speed[0]);
      this.sparkParts.push({x:at.x,y:at.y,z:at.z,vx:Math.cos(a)*Math.cos(e)*v,vy:Math.abs(Math.sin(e))*v+1.5,vz:Math.sin(a)*Math.cos(e)*v,age:0,life:SPARKS.life*(.7+r()*.6),size:SPARKS.size,a:1,c:S.sparks[i%3]});}
    if(S!==COIN)return;   // a coin also flies to the HUD counter (slice-app)
    const q=SCREEN.copy(at).project(this.camera);
    this.canvas.dispatchEvent(new CustomEvent('coin-burst',{detail:{x:(q.x+1)/2*this.width,y:(1-q.y)/2*this.height}}));
  }
  // A burst of dust on top of the steady trail: n puffs from every horse (the start), or the player's only (a landing).
  dustBurst(n,playerOnly=false){this.models.forEach((e,key)=>{if(!playerOnly||String(key).startsWith('player'))e.dustDue=(e.dustDue||0)+n;});}
  // Hoof dust for one galloping horse (DUST): from behind its hind hooves, at a rate that follows its speed (a sprint
  // kicks up more); darker on mud. The horse faces −Z, so behind it is +Z.
  kickDust(entry,p,runner,race,time){
    if(!this.dustParts)return;   // the layers come with the first sliceCoins()
    const dt=clamp(time-(entry.dustTime??time),0,.1);entry.dustTime=time;
    entry.dustDue=(entry.dustDue||0)+dt*DUST.rate*clamp(runner.speed/race.config.baseSpeed,.6,1.8);
    const c=race.terrainAt(runner.distance)==='mud'?DUST.mud:DUST.dirt;
    for(;entry.dustDue>=1&&this.dustParts.length<DUST.max;entry.dustDue--){
      const r=Math.random;this.dustParts.push({x:p.x+(r()-.5)*.9,y:.2,z:p.z+1.5+r()*.6,vx:(r()-.5)*1.2,vy:.5+r()*.6,vz:1+r()*1.5,age:0,life:DUST.life*(.7+r()*.5),big:.75+r()*.5,c});
    }
    if(entry.dustDue>=1)entry.dustDue=0;
  }
  // Slice handoff, at the relay line: the new horse fades in where the runner is (over the first HANDOFF.in m) while
  // the relieved one peels off toward the nearer rail, drops back and fades out (HANDOFF.out m). No teleport, no pause.
  sliceActors(race,role,runner,lane,offset){
    const z=HORSE_Z+offset,since=runner.leg?runner.distance-race.marks.relays[runner.leg-1]:Infinity,running=!(role==='player'&&race.finished);
    const actors=[{id:runner.leg,leg:runner.leg,active:true,lane,z,opacity:clamp(since/HANDOFF.in,.05,1),running}];
    if(since<HANDOFF.out){const k=since/HANDOFF.out,side=lane<=0?-1:1;
      actors.push({id:runner.leg-1,leg:runner.leg-1,active:false,lane:lane+side*HANDOFF.drift*Math.sin(k*Math.PI/2),z:z+since*.2,opacity:1-k,running:true});}
    return actors;
  }
  rhythm(race, time, turn) {
    const context=this.rhythmContext;context?.clearRect(0,0,this.width,this.height);
    const noteContext=this.noteContext||context;if(noteContext!==context)noteContext.clearRect(0,0,this.width,this.height);
    if(race.slice&&race.finished)return;   // the run is over: no ribbons or notes behind the results
    let count=0;const ready=[false,false],positions=[];
    const lookahead=race.slice?PRESENTATION_LOOKAHEAD:NOTE_LOOKAHEAD;
    const project=(x,y,z)=>{const p=new THREE.Vector3(x,y,z).project(this.camera);return {x:(p.x+1)*this.width/2,y:(1-p.y)*this.height/2};};
    const player=project((race.laneValue||0)*(race.config?.laneSpacing||2.2),3,HORSE_Z);
    const shift=player.x-this.width/2;
    const coinScreens=[...race.coins||[],...race.apples||[]].filter(c=>!c.collected&&c.distance-race.distance>2&&c.distance-race.distance<42).map(c=>{
      const x=c.lane*race.config.laneSpacing,z=HORSE_Z-(c.distance-race.distance),p=project(x,1.1,z),edge=project(x+.48,1.1,z);
      return {...p,radius:Math.abs(edge.x-p.x),lane:c.lane};
    });
    const anchors=[-1,1].map(side=>({
      knots:P.rhythm.points[side<0?0:1].map((p,i)=>({x:p[0]*this.width+shift*(i===0?P.rhythm.laneFollowStart:1),y:p[1]*this.height})),
      lane:side<0?0:1,obstacles:coinScreens.filter(c=>side*(c.lane-race.laneValue)>.25),
      start:{x:this.width*P.rhythm.start[side<0?0:1][0]+shift*P.rhythm.laneFollowStart,y:this.height*P.rhythm.start[side<0?0:1][1]},
      beside:{x:this.width*P.rhythm.beside[side<0?0:1][0]+shift,y:this.height*P.rhythm.beside[side<0?0:1][1]}
    }));
    if(race.slice&&context){
      for(let lane=0;lane<2;lane++){
        // The ribbon, in the look of the painted one (references/style/ribbon_neon.webp; tools/ribbon.py prints its
        // colours): narrow far off and wider toward the pad (ribbonWidth × the note's size there), a see-through body
        // with a bright edge and a soft glow, fading in at its far end. Plain fills, no canvas blur. It is drawn, not a
        // picture: it follows the pad and bends round coins.
        const pts=[];for(let i=0;i<=40;i++)pts.push(playerRhythmPath({remaining:lookahead*(1-i/40),...anchors[lane],target:this.targets[lane],width:this.width,height:this.height}));
        const [body,rim,glow]=RIBBON[lane],fade=(hex,a)=>{const g=context.createLinearGradient(pts[0].x,pts[0].y,pts[13].x,pts[13].y);g.addColorStop(0,hex+'00');g.addColorStop(1,hex+a);return g;};
        const sides=k=>pts.map((p,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(40,i+1)],l=Math.hypot(b.x-a.x,b.y-a.y)||1,h=p.size*P.rhythm.ribbonWidth*k/2,nx=(b.y-a.y)/l*h,ny=-(b.x-a.x)/l*h;return [p.x-nx,p.y-ny,p.x+nx,p.y+ny];});
        const band=(k,style)=>{const e=sides(k);context.beginPath();e.forEach((q,i)=>i?context.lineTo(q[0],q[1]):context.moveTo(q[0],q[1]));for(let i=40;i>=0;i--)context.lineTo(e[i][2],e[i][3]);context.closePath();context.fillStyle=style;context.fill();return e;};
        band(2.1,fade(glow,'1f'));band(1.44,fade(glow,'38'));
        const e=band(1,fade(body,'b3'));
        context.lineWidth=Math.max(1,this.width*.004);context.strokeStyle=fade(rim,'f2');
        for(const o of [0,2]){context.beginPath();e.forEach((q,i)=>i?context.lineTo(q[o],q[o+1]):context.moveTo(q[o],q[o+1]));context.stroke();}
      }
      // Peripheral ground-flow cues use the real race speed. They strengthen
      // acceleration without moving the approved portrait camera or controls.
      // rush (a sprint or an apple, slice-game): twice the lines (a second row further in), brighter, longer, faster.
      const surge=clamp((race.speed/race.config.baseSpeed-1)/.45,0,1),rush=race.rush?.()??0;
      if((surge>.03||rush>0)&&!this.reduced){
        context.save();context.lineCap='round';context.lineWidth=Math.max(1.5,this.width*(.004+.002*rush));
        context.strokeStyle=`rgba(244,251,255,${Math.min(.7,.08+.23*surge+.3*rush)})`;
        for(const side of [-1,1])for(let i=0,n=4+Math.round(4*rush);i<n;i++){
          const x=this.width*(.5+side*(.40+(i%4)*.016-(i>3?.07:0)));
          const phase=(time*(.28+.42*surge)*(1+rush)+i*.113+(side>0?.07:0))%.46;
          const y=this.height*(.34+phase),length=this.height*(.024+.025*surge)*(1+1.5*rush);
          context.beginPath();context.moveTo(x-side*3,y);context.lineTo(x,y+length);context.stroke();
        }
        context.restore();
      }
    }
    for (let i=race.notes.length-1;i>=0;i--) {
      const n=race.notes[i];
      const remaining = n.t - time;
      if(race.slice&&noteContext&&(n.state==='perfect'||n.state==='good')){
        // A hit: the ring lifts off from where it was struck, grows and fades (a Perfect further and bigger).
        const u=(time-n.hitAt)/NOTE_POP.time;if(u<0||u>=1)continue;
        const perfect=n.state==='perfect',e=1-(1-u)*(1-u),p=playerRhythmPath({remaining:n.t-n.hitAt,...anchors[n.lane],target:this.targets[n.lane],width:this.width,height:this.height});
        const size=p.size*(1+NOTE_POP.grow[+perfect]*e);noteContext.globalAlpha=1-u*u;
        noteContext.drawImage(this.noteImages[n.lane],p.x-size/2,p.y-size/2-p.size*NOTE_POP.rise[+perfect]*e,size,size);noteContext.globalAlpha=1;continue;
      }
      // An unhit note keeps going past the pad and off the screen (dimmed once it is a miss); the old race holds it
      // on the button only while its hit window is open.
      const missed=race.slice&&n.state==='miss';
      if ((n.state&&!missed) || remaining > lookahead || remaining < -(race.slice?NOTE_POP.past:.3)) continue;
      if((race.slice?!missed&&remaining<=.65&&remaining>-race.config.goodWindow:Math.abs(remaining)<=timingWindows(HORSES[race.team[n.leg]],n.track,n.weather).perfect))ready[n.lane]=true;
      const p=race.slice?playerRhythmPath({remaining,...anchors[n.lane],target:this.targets[n.lane],width:this.width,height:this.height,lateWindow:race.config.goodWindow}):rhythmScreenPose(beatPose(remaining,n.lane,turn),remaining,NOTE_LOOKAHEAD,this.camera,this.width,this.height,this.targets[n.lane],beatPose(0,n.lane,turn));
      if(race.slice&&p.y-p.size/2>this.height)continue;
      if(!missed)positions.push({id:n.id,lane:n.lane,remaining,...p});
      const squash=p.squash;
      if(noteContext){noteContext.globalAlpha=missed?.4:1;noteContext.drawImage(this.noteImages[n.lane],p.x-p.size/2,p.y-p.size*squash/2,p.size,p.size*squash);noteContext.globalAlpha=1;}count++;
    }
    this.targets.forEach((target,lane)=>{
      this.judgementPositions[lane]={x:target.x,y:target.y};
      this.controls[lane]?.classList.toggle('beat-ready',ready[lane]);
    });
    this.visibleNotes=count;this.canvas.dataset.notePositions=JSON.stringify(positions);
    this.canvas.dataset.rhythmTargets=JSON.stringify(this.targets);
  }
  draw(race, time, metrics) {
    if (!this.resize()) return;
    const now = performance.now(), frameTime = now - (this.lastDrawTime ?? now);
    if (time > 0 && frameTime > 0 && frameTime < 100) {
      this.frameAverage = this.frameAverage * .97 + frameTime * .03;
      this.frameSamples++;
      if (this.frameSamples > 120 && this.frameAverage > 40 && this.r.getPixelRatio() > 1) this.r.setPixelRatio(1);   // below 25 a second (the game draws 30: slice-app frame): the resolution comes down for the rest of the run
    }
    this.lastDrawTime = now;
    this.raceTime=time;this.configure(race, race.slice?0:time);
    const coastAge=Math.max(0,time-DURATION),coastDistance=metrics.player.speed*(1-Math.exp(-coastAge*1.8))/1.8;
    // Slice: the road ahead curves with the course's coming bend (slice-game bendAhead), eased so it never snaps.
    if(race.slice){this.race=race;this.sliceTurn=(this.sliceTurn??0)+(race.bendAhead()*SLICE_TURN-(this.sliceTurn??0))*(1-Math.exp(-Math.max(0,frameTime)/450));}
    const turn = race.slice?this.sliceTurn:turnAt(race.city, time), distance = metrics.player.distance+coastDistance;
    this.updateRoad(turn, distance);this.approvedEnvironment?.update(distance,turn,race);
    // Keep the established covered handoff framing only while crossing a relay gate.
    const gateDistance=Math.min(Math.abs(time-LEG_SECONDS),Math.abs(time-LEG_SECONDS*2));
    const gateBlend=clamp((1.3-gateDistance)/1.15,0,1),cover=gateBlend*gateBlend*(3-2*gateBlend);
    const framing=raceCameraFrame(this.camera.fov);
    this.camera.position.set(0,framing.y+(6.4-framing.y)*cover,framing.z+(HORSE_Z+13-framing.z)*cover);
    // Small, steady pullback for a surge; no camera shake or target movement.
    const boost=sprintActive(race,time)||boostActive(race,time)?1:0;
    this.surge=(this.surge||0)+(boost-(this.surge||0))*Math.min(1,Math.max(0,frameTime)/180);
    if(!this.reduced)this.camera.position.z+=this.surge*.32;
    const target = roadPose(framing.targetZ+(HORSE_Z-5.5-framing.targetZ)*cover, turn); this.camera.lookAt(target.x * (.22+.28*cover), .8+.3*cover, target.z);
    if(race.slice){
      const c=chaseComposition(this.camera.aspect,race.laneValue*race.config.laneSpacing);
      const targetEase=this.reduced?0:clamp((race.speed/race.config.baseSpeed-1)/.45,0,1);
      this.sliceCameraEase=(this.sliceCameraEase||0)+(targetEase-(this.sliceCameraEase||0))*(1-Math.exp(-Math.max(0,frameTime)/210));
      const lift=this.reduced?0:this.playerJump||0;   // the player's jump height, from the last frame's runners()
      // The start gate's whole row in view: the camera is lifted (stalls.wide m) through the countdown and comes back down over the first 1.2 s after GO.
      const back=clamp(1-Math.max(0,time)/1.2,0,1),high=this.stalls?.wide?back*back*(3-2*back):0;
      this.camera.position.set(c.x,c.y+high*WIDE[0]+.035*this.sliceCameraEase+REACT.rise[0]*lift,c.z+high*WIDE[1]+.3*this.sliceCameraEase);
      // A sprint or an apple: the view widens a little (REACT.kick), eased; the framing and the controls stay put.
      this.kick=(this.kick||0)+((this.reduced?0:race.rush(time))-(this.kick||0))*(1-Math.exp(-Math.max(0,frameTime)/140));
      const off=clamp(1-Math.max(0,time)/REACT.launch[1],0,1),fov=c.fov+REACT.kick*this.kick-(this.reduced?0:REACT.launch[0]*off*off*(3-2*off));if(Math.abs(this.camera.fov-fov)>.01){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
      this.camera.lookAt(c.x,c.targetY+high*WIDE[2]+REACT.rise[1]*lift,c.targetZ);
      this.canvas.dataset.composition=JSON.stringify(c);
      this.canvas.dataset.cameraSpeedEase=this.sliceCameraEase.toFixed(3);
    }
    this.camera.updateMatrixWorld();
    const sceneryTime=coastAge?DURATION+coastDistance/12:time;
    if(race.slice){this.relayGates.forEach(g=>g.group.visible=false);this.startGate(race,time,turn);}else this.gates(sceneryTime,turn);this.runners(race, time, turn, metrics); this.rhythm(race, time, turn);
    this.hurdles(race,time,turn,[0,...metrics.rivals.map(r=>rivalOffset(r.lead))]);
    const finishAhead=race.slice?race.config.length-race.distance:null;
    this.finish.visible=race.slice?(finishAhead>=-PAST&&finishAhead<72):time>DURATION-5;
    if (this.finish.visible) {const p = roadPose(race.slice?HORSE_Z-finishAhead:HORSE_Z - (DURATION - sceneryTime) * 12, turn); this.finish.position.set(p.x, .025, p.z); this.finish.rotation.set(-Math.PI / 2, 0, -p.heading);}
    if (this.rain.visible) {
      const data = this.rainGeometry.attributes.position.array, clock = this.reduced ? 0 : Math.max(0, time);
      for (let i = 0; i < 180; i++) {
        const x = ((i * 7.31) % 32) - 16, y = 15 - ((i * 1.73 + clock * 10) % 15), z = 9 - ((i * 3.17) % 44), k = i * 6;
        data[k] = x; data[k + 1] = y; data[k + 2] = z; data[k + 3] = x - .12; data[k + 4] = y - .65; data[k + 5] = z;
      }
      this.rainGeometry.attributes.position.needsUpdate = true;
    }
    if(race.slice)this.sliceCoins(race,time,turn);
    if(race.slice){updateCompositionRanking(race,metrics);updateProgress(race,metrics);}
    // narrowed behind the horse: a mesh's own bounds no longer say whether it is on the screen
    if(this.unculled!==this.scene.children.length){this.unculled=this.scene.children.length;this.scene.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh)o.frustumCulled=false;});}
    warped(()=>this.r.render(this.scene, this.camera));
    this.canvas.dataset.turn=turn.toFixed(3);
    this.canvas.dataset.sprinting=String(!!boost);this.canvas.dataset.coasting=String(coastAge>0);
    if (Math.abs(time - this.lastStats) > .5) {
      this.canvas.dataset.visibleNotes = String(this.visibleNotes);
      this.canvas.dataset.drawCalls = String(this.r.info.render.calls); this.canvas.dataset.triangles = String(this.r.info.render.triangles);
      this.canvas.dataset.pixelRatio = String(this.r.getPixelRatio());
      this.lastStats = time;
    }
  }
  sliceCoins(race,time,turn=0) {
    if(!this.coinMeshes){
      // Race look: coins that glow a little (their own gold as emissive), with a soft halo layer behind them.
      const coin=approvedAssets.get('coin').scene,bright=new Map(),glowing=m=>{if(!bright.has(m)){const b=this.own(m.clone());b.emissive?.copy(b.color).multiplyScalar(.35);bright.set(m,b);}return bright.get(m);};
      this.coinMeshes=race.coins.map(()=>{const c=coin.clone();c.scale.setScalar(COIN.scale);c.traverse(o=>{if(o.isMesh)o.material=glowing(o.material);});this.scene.add(c);return c;});
      // Apples (solo run): a red apple with a stem and a leaf, built here (no model file), glowing a little like the coins.
      const part=(geometry,color,x,y,turn=0)=>{const m=this.material(color);m.roughness=.45;m.emissive.set(color).multiplyScalar(.3);return [this.own(geometry),m,x,y,turn];};
      const parts=race.apples?.length?[part(new THREE.SphereGeometry(.5,14,10).scale(1,.9,1),'#e0352b',0,0),part(new THREE.CylinderGeometry(.03,.05,.3,6),'#6b4423',0,.52),part(new THREE.SphereGeometry(.2,8,6).scale(1,.22,.5),'#58a83a',.17,.58,.5)]:[];
      this.appleMeshes=(race.apples||[]).map(()=>{const a=new THREE.Group();for(const [geometry,material,x,y,turn] of parts){const m=this.mesh(geometry,material,a);m.position.set(x,y,0);m.rotation.z=turn;}
        a.scale.setScalar(APPLE.scale);this.scene.add(a);return a;});
      this.coinGlow=puffLayer(race.coins.length+this.appleMeshes.length,true);this.own(this.coinGlow.g);this.own(this.coinGlow.m);this.scene.add(this.coinGlow.points);
      this.lampGlow=puffLayer(48,true);this.own(this.lampGlow.g);this.own(this.lampGlow.m);this.scene.add(this.lampGlow.points);
      this.dust=puffLayer(DUST.max);this.own(this.dust.g);this.own(this.dust.m);this.scene.add(this.dust.points);this.dustParts=[];
      this.sparks=puffLayer(SPARKS.max,true,true);this.own(this.sparks.g);this.own(this.sparks.m);this.scene.add(this.sparks.points);this.sparkParts=[];
      // Lane lines: thin road-following strips (updateRoad bends them with the road).
      const lineMaterial=this.own(new THREE.MeshBasicMaterial({color:'#fff8e0',transparent:true,opacity:.25,depthWrite:false}));
      this.laneLines=[-1,1].map(side=>({...this.strip(.035,.02,lineMaterial),offset:side*race.config.laneSpacing/2,far:150}));
      this.runnerLabels.forEach(label=>label.visible=false);
    }
    let glow=0;
    const show=(list,meshes,S)=>list.forEach((item,i)=>{
      const mesh=meshes[i],gap=item.distance-race.distance,move=this.reduced?0:1;
      if(item.collected&&!mesh.userData.burst&&gap>-6&&gap<6){mesh.userData.burst=true;this.coinBurst(mesh.position,S);}
      mesh.visible=!item.collected&&gap>-PAST&&gap<150;   // race look: they show from far down the road (was 70 m)
      const p=roadPose(HORSE_Z-gap,turn,item.lane*race.config.laneSpacing);
      mesh.position.set(p.x,S.height+move*S.bob*Math.sin(time*3+i),p.z);mesh.rotation.set(0,p.heading+move*(time*S.spin+i*S.step),0);
      if(mesh.visible)this.coinGlow.set(glow++,p.x,S.height,p.z+.15,S.glow,S.alpha+.08*Math.sin(time*5+i),S.tint);
    });
    show(race.coins,this.coinMeshes,COIN);show(race.apples||[],this.appleMeshes,APPLE);
    this.coinGlow.sync(this.camera,this.r.domElement.height,glow);
    // The street lamps light up down the road with the streak (one more pair a hit, to 16), and go dark on a miss.
    const lit=Math.min(race.combo||0,16)*REACT.lamp.reach;let lamps=0;
    for(const p of this.lampSpots||[])if(lit>0&&lamps<48&&HORSE_Z-p.z<REACT.lamp.from+lit&&p.z<HORSE_Z-REACT.lamp.from)this.lampGlow.set(lamps++,p.x,p.y,p.z,REACT.lamp.size,REACT.lamp.alpha,REACT.lamp.tint);
    this.lampGlow.sync(this.camera,this.r.domElement.height,lamps);
    // Dust: age, drift up and out, stream back with the ground (the player's speed), grow and fade.
    const dt=clamp(time-(this.dustTime??time),0,.1),scroll=race.speed*dt;this.dustTime=time;let n=0;
    this.dustParts=this.dustParts.filter(d=>(d.age+=dt)<d.life);
    for(const d of this.dustParts){const k=d.age/d.life;d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt+scroll;
      if(n<DUST.max)this.dust.set(n++,d.x,d.y,d.z,DUST.size[0]+(DUST.size[1]-DUST.size[0])*k*d.big,DUST.alpha*d.big*(1-k)*Math.min(1,k*6),d.c);}
    this.dust.sync(this.camera,this.r.domElement.height,n);
    this.sparkParts=this.sparkParts.filter(s=>(s.age+=dt)<s.life);let m=0;
    for(const s of this.sparkParts){const k=s.age/s.life;s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;s.vy-=6*dt;
      if(m<SPARKS.max)this.sparks.set(m++,s.x,s.y,s.z,s.size[0]+(s.size[1]-s.size[0])*k,(1-k)*s.a,s.c);}
    this.sparks.sync(this.camera,this.r.domElement.height,m);
  }
  dispose() {
    this.sizeObserver?.disconnect();
    this.rhythmCanvas?.remove();
    this.noteCanvas?.remove();
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.models.forEach(({model}) => {model.riderMixer?.stopAllAction();disposeHorse(model)}); this.models.clear();
    this.scene.traverse(object => {if (object.isInstancedMesh) object.dispose();});
    this.resources.forEach(resource => resource.dispose()); this.resources.clear();
    this.r.dispose(); this.r.forceContextLoss();
  }
}
