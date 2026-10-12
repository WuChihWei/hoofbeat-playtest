// The rider's house (home.js PAGES.house): the rigged standing rider (Rider_Showcase.glb, its Stand clip) alone on a
// clear canvas over the room's picture. paint(gear) colours her clothes ({material: colour}; a missing one is as built).
import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {MODEL_VERSION,livingEyes} from '../approved-assets.js?v=r559';
export async function mountRiderView(host,gear={}){
  const g=await new GLTFLoader().loadAsync(new URL(`../assets/models/rider_part/rider_main/Rider_Showcase.glb?v=${MODEL_VERSION}`,import.meta.url).href);
  const r=new THREE.WebGLRenderer({antialias:true,alpha:true});r.setPixelRatio(Math.min(devicePixelRatio,2));r.outputColorSpace=THREE.SRGBColorSpace;host.append(r.domElement);
  const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(30,1,.1,30),who=g.scene,box=new THREE.Box3().setFromObject(who),h=box.max.y-box.min.y;
  scene.add(who,new THREE.HemisphereLight('#fff6e6','#b98a5a',2.2));const sun=new THREE.DirectionalLight('#fff1d6',2);sun.position.set(-2,3,3);scene.add(sun);
  who.position.y=-box.min.y;who.rotation.y=.35;cam.position.set(0,h*.55,h*2.3);cam.lookAt(0,h*.5,0);
  const built={};who.traverse(o=>{if(o.isMesh){o.frustumCulled=false;for(const m of [].concat(o.material))built[m.name]??=[m,m.color.clone()];}});
  const paint=gear=>{for(const [n,[m,c]] of Object.entries(built))gear[n]?m.color.set(gear[n]):m.color.copy(c);};paint(gear);
  // Stand loops (its own small sway) and she blinks; a drag turns her round. No wave: laid over the clip it pulled her
  // shirt's side out with the arm (the shirt is weighted to the upper arm), and the user had it taken out (2026-10-12).
  const mix=new THREE.AnimationMixer(who),stand=g.animations.find(a=>a.name==='Stand');if(stand)mix.clipAction(stand).play();
  const eyes=livingEyes(who,{measure:['Rider_Sclera'],paint:['Rider_Sclera','Rider_Iris','Rider_Pupil'],arc:'Rider_Eye',lights:'Rider_EyeLight',lidColor:'#'+(built.Rider_Skin?.[1].getHexString()??'f0c8a4'),open:1.3,from:.9,curve:1.4,arcStop:-.35});
  const el=r.domElement;el.style.touchAction='none';el.style.cursor='grab';let drag=null;
  el.addEventListener('pointerdown',e=>{el.setPointerCapture(e.pointerId);drag={x:e.clientX,from:who.rotation.y};});
  el.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x;who.rotation.y=drag.from+dx*.012;});
  const up=()=>{drag=null;};el.addEventListener('pointerup',up);el.addEventListener('pointercancel',()=>{drag=null;});
  const fit=()=>{const w=host.clientWidth||1,ht=host.clientHeight||1;r.setSize(w,ht,false);cam.aspect=w/ht;cam.updateProjectionMatrix();};fit();addEventListener('resize',fit);
  let raf=0,last=performance.now();const loop=t=>{raf=requestAnimationFrame(loop);const dt=Math.min(.05,(t-last)/1000);last=t;mix.update(dt);eyes.update(dt);r.render(scene,cam);};raf=requestAnimationFrame(loop);
  return {paint,dispose(){cancelAnimationFrame(raf);removeEventListener('resize',fit);scene.traverse(o=>{o.geometry?.dispose();[].concat(o.material||[]).forEach(m=>m.dispose());});r.dispose();r.domElement.remove();}};
}
