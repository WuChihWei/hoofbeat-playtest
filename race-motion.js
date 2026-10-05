import {THREE} from './horse-model.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// A race-only pose layer. Neutral transforms are captured before the first gallop.
export class RaceHorsePose {
  constructor(model){
    this.model=model;this.bones=new Map();this.target=new THREE.Quaternion();this.rotation=new THREE.Quaternion();
    for(const binding of model.poseBones||[])this.bones.set(binding.bone.uuid,{...binding,rest:binding.bone.quaternion.clone(),base:binding.bone.quaternion.clone(),layered:false});
  }
  restore(){
    for(const entry of this.bones.values())if(entry.layered){entry.bone.quaternion.copy(entry.base);entry.layered=false}
  }
  apply(jump){
    const weight=jump.airborne?clamp(jump.phase/.10,0,1):jump.landing;
    if(!weight)return;
    const {tuck,crouch,landing}=jump;
    const angles={
      Front_Upper:-.65*tuck+.12*landing,
      Front_Lower:1.3*tuck+.22*crouch+.25*landing,
      Front_Hoof:-.45*tuck,
      Hind_Upper:.55*tuck-.12*crouch,
      Hind_Lower:-1.1*tuck-.25*crouch-.18*landing,
      Hind_Hoof:.35*tuck,
      Neck:-.07*tuck+.05*landing
    };
    for(const entry of this.bones.values()){
      const angle=angles[entry.role];
      if(angle===undefined)continue;
      entry.base.copy(entry.bone.quaternion);entry.layered=true;
      this.rotation.setFromAxisAngle(entry.axis,angle*entry.sign);this.target.copy(entry.rest).multiply(this.rotation);
      entry.bone.quaternion.slerp(this.target,weight);
    }
    if(!this.model.fromAsset)for(const leg of this.model.legs){
      const prefix=leg.rear?'Hind':'Front';
      leg.joint.rotation.x=angles[prefix+'_Upper'];leg.lower.rotation.x=angles[prefix+'_Lower'];leg.foot.rotation.x=angles[prefix+'_Hoof'];
    }
  }
}

const foot=new THREE.Vector3(),head=new THREE.Vector3();
export function projectedHorseHeight(camera,x,z,scale){
  foot.set(x,.025,z).project(camera);head.set(x,.025+3.3*scale,z).project(camera);
  return Math.abs(head.y-foot.y);
}
export function equalSizeScale(camera,x,z,targetHeight){
  let low=.5,high=1.9;
  for(let i=0;i<12;i++){
    const mid=(low+high)/2;
    if(projectedHorseHeight(camera,x,z,mid)<targetHeight)low=mid;else high=mid;
  }
  return (low+high)/2;
}

const notePoint=new THREE.Vector3(),noteEnd=new THREE.Vector3();
// Keep cues on the road shoulders until they reach the fixed thumb lanes.
export function rhythmScreenPose(point,remaining,lookahead,camera,width,height,target,endpoint=point){
  if(remaining<=0)return {x:target.x,y:target.y,size:target.size,squash:1};
  const depth=-notePoint.set(point.x,.035,point.z).applyMatrix4(camera.matrixWorldInverse).z;
  const endDepth=-noteEnd.set(endpoint.x,.035,endpoint.z).applyMatrix4(camera.matrixWorldInverse).z;
  notePoint.set(point.x,.035,point.z).project(camera);
  noteEnd.set(endpoint.x,.035,endpoint.z).project(camera);
  const progress=1-clamp(remaining/lookahead,0,1),blend=clamp(progress*endDepth/depth,0,1);
  const size=10+(target.size-10)*progress*progress;
  const x=(notePoint.x+1)*width/2,y=(1-notePoint.y)*height/2;
  const endY=(1-noteEnd.y)*height/2;
  const approach=clamp((progress-.65)/.35,0,1),dock=approach*approach*(3-2*approach);
  const shoulderX=clamp(x,size/2+6,width-size/2-6);
  const entry=clamp((progress-.85)/.15,0,1),entryBlend=entry*entry*(3-2*entry);
  return {x:shoulderX+(target.x-shoulderX)*entryBlend,y:y+(target.y-endY)*dock,size,squash:.32+.68*blend};
}
