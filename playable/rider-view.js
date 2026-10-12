// The rider's house (home.js PAGES.house): the rigged standing rider (Rider_Showcase.glb, its Stand clip) alone on a
// clear canvas over the room's picture. paint(gear) colours her clothes ({material: colour}; a missing one is as built).
import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {MODEL_VERSION} from '../approved-assets.js?v=r550';
export async function mountRiderView(host,gear={}){
  const g=await new GLTFLoader().loadAsync(new URL(`../assets/models/rider_part/rider_main/Rider_Showcase.glb?v=${MODEL_VERSION}`,import.meta.url).href);
  const r=new THREE.WebGLRenderer({antialias:true,alpha:true});r.setPixelRatio(Math.min(devicePixelRatio,2));r.outputColorSpace=THREE.SRGBColorSpace;host.append(r.domElement);
  const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(30,1,.1,30),who=g.scene,box=new THREE.Box3().setFromObject(who),h=box.max.y-box.min.y;
  scene.add(who,new THREE.HemisphereLight('#fff6e6','#b98a5a',2.2));const sun=new THREE.DirectionalLight('#fff1d6',2);sun.position.set(-2,3,3);scene.add(sun);
  who.position.y=-box.min.y;who.rotation.y=.35;cam.position.set(0,h*.55,h*2.3);cam.lookAt(0,h*.5,0);
  const built={};who.traverse(o=>{if(o.isMesh){o.frustumCulled=false;for(const m of [].concat(o.material))built[m.name]??=[m,m.color.clone()];}});
  const paint=gear=>{for(const [n,[m,c]] of Object.entries(built))gear[n]?m.color.set(gear[n]):m.color.copy(c);};paint(gear);
  const mix=new THREE.AnimationMixer(who),stand=g.animations.find(a=>a.name==='Stand');if(stand)mix.clipAction(stand).play();
  const fit=()=>{const w=host.clientWidth||1,ht=host.clientHeight||1;r.setSize(w,ht,false);cam.aspect=w/ht;cam.updateProjectionMatrix();};fit();addEventListener('resize',fit);
  let raf=0,last=performance.now();const loop=t=>{raf=requestAnimationFrame(loop);mix.update(Math.min(.05,(t-last)/1000));last=t;r.render(scene,cam);};raf=requestAnimationFrame(loop);
  return {paint,dispose(){cancelAnimationFrame(raf);removeEventListener('resize',fit);scene.traverse(o=>{o.geometry?.dispose();[].concat(o.material||[]).forEach(m=>m.dispose());});r.dispose();r.domElement.remove();}};
}
