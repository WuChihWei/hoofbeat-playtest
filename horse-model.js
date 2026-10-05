// The race's horse driver (race-scene.js): plays the approved horse's clips by race time and frees it. The older
// procedural horse and its GLB library (model-assets.js, model-catalog.js, mobile-v3-environment.js, assets/models.json)
// were removed on 2026-10-04: nothing built them any more.
import * as THREE from './vendor/three.module.min.js';

export function animateHorse(model,time,{running=false,speed=1,impulse=0,hoofAccent=[0,0],reduced=false}={}) {
    const role=running?'run':'idle',clip=model.clips[role];
    if(model.animationRole!==role){
      model.mixer.stopAllAction();
      if(clip)model.mixer.clipAction(clip).reset().play();
      model.animationRole=role;model.lastMixerTime=undefined;
    }
    const rate=model.descriptor.animation?.[running?'runSpeed':'idleSpeed']??1;
    const mixerTime=clip&&!reduced?time*(running?speed:1)*rate:0;
    if(model.lastMixerTime!==mixerTime||hoofAccent.some(Boolean)){model.mixer.setTime(mixerTime);model.lastMixerTime=mixerTime}
    // A small additive emphasis on the matching foreleg, layered over Gallop.
    // The authored clip keeps control of the stride and never snaps to a hit pose.
    if(running&&!reduced)for(const binding of model.poseBones||[]){
      if(binding.role!=='Front_Upper'&&binding.role!=='Front_Lower')continue;
      const side=binding.bone.name.endsWith('L')?0:binding.bone.name.endsWith('R')?1:-1;
      if(side<0||!hoofAccent[side])continue;
      binding.bone.rotation.x+=(binding.role==='Front_Upper'?.10:-.055)*hoofAccent[side];
    }
    model.scene.position.y=running?.025:reduced?0:Math.sin(time*1.6)*.008;
    model.scene.position.z=-impulse*.13;
}

export function disposeHorse(model) {
  model.mixer.stopAllAction();model.mixer.uncacheRoot(model.content);model.materials.forEach(material=>material.dispose());
  const skeletons=new Set();model.root.traverse(mesh=>{if(mesh.isSkinnedMesh)skeletons.add(mesh.skeleton)});
  skeletons.forEach(skeleton=>skeleton.dispose());model.root.clear();
}

export {THREE};
