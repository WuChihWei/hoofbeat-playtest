// Far layer: a city's panorama around the race camera — sky, clouds, far hills, skyline, landmarks. It sits on a
// sphere that follows the camera (so it is always infinitely far: running never brings it closer or slides it past),
// draws behind everything, takes no light, fog or shadow, and plays no part in gameplay.
//
// cityBackground (course/cities/<id>.mjs `background`):
//   panorama       assets/panoramas/<file>
//   projection     'equirect' — a true 2:1 360°×180° panorama (horizon at mid-height): used as-is.
//                  'strip'    — a painted wide panorama whose horizon is NOT at mid-height (the current city art):
//                               wrapped round the camera over `span` degrees with square pixels, the `horizon` image row
//                               (0 top … 1 bottom) on the true horizon, `yaw` = the heading of the image centre
//                               (negative = left of the track), mirrored past its sides, faded into `topColor` above it;
//                               `aspect` = the image's width / height (default 2).
//   fogColor       the haze at the painting's horizon: scene fog (softens the 3D mid layer into it) and the far haze
//   horizonColor   the painting's horizon sky (the far haze band)
//   ambientColor   its sky: tints the hemisphere fill        keyLightColor  its sunlight: the key light
//   sun {u, v}     where the sun is in the image: the key light comes from that direction
//   far {saturation, contrast, haze, deep}   atmospheric perspective on the painting (lower saturation / contrast, a
//                  haze band hugging the horizon) so it reads further away than the fogged 3D mid layer; deep (0–1)
//                  deepens the painted blue sky (only blue-sky pixels, rising with elevation: clouds, skyline and land keep
//                  their colours), for the race look's saturated sky
import * as THREE from './vendor/three.module.min.js';

const D2R=Math.PI/180;
// The painting is shown at FAR × the size its city pack gives (span, yaw), about the point straight ahead: the skyline
// the size of the race concept art (Taipei 101 about 12% of the screen height) and less magnified, so it reads as far
// away behind the 3D trees. The key light stays where the city pack puts it.
const FAR=.83;
// Heading (deg, + right of the track's forward −Z) and elevation (deg) of an image point under the strip mapping.
export function stripAngles(bg,u,v,aspect=2){return {az:(bg.yaw??0)+(u-.5)*bg.span,el:(bg.horizon-v)*bg.span/aspect};}
export function sunDirection(bg){
  const {az,el}=bg.projection==='equirect'?{az:(bg.sun.u-.5)*360,el:(.5-bg.sun.v)*180}:stripAngles(bg,bg.sun.u,bg.sun.v,bg.aspect??2);
  return new THREE.Vector3(Math.sin(az*D2R)*Math.cos(el*D2R),Math.sin(el*D2R),-Math.cos(az*D2R)*Math.cos(el*D2R));
}
// → {mesh (null for equirect: the scene background carries it), update(camera)}
export function installFarBackground(scene,bg,url,own=x=>x,manager=undefined){   // manager: the loading manager the painting comes through (approved-assets scenePictures)
  const tex=own(new THREE.TextureLoader(manager).load(url));tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
  if(bg.projection==='equirect'){tex.mapping=THREE.EquirectangularReflectionMapping;scene.background=tex;return {mesh:null,update(){}};}
  tex.wrapS=THREE.MirroredRepeatWrapping;
  const far=bg.far||{};
  const mat=own(new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false,toneMapped:false,
    uniforms:{map:{value:tex},span:{value:bg.span*FAR},yaw:{value:(bg.yaw??0)*FAR},horizon:{value:bg.horizon},aspect:{value:bg.aspect??2},
      topC:{value:new THREE.Color(bg.topColor??bg.ambientColor)},hazeC:{value:new THREE.Color(bg.horizonColor??bg.fogColor)},
      sat:{value:far.saturation??.9},con:{value:far.contrast??.93},haze:{value:far.haze??.3},deep:{value:far.deep??0}},
    vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D map;uniform float span,yaw,horizon,aspect,sat,con,haze,deep;uniform vec3 topC,hazeC;varying vec3 vP;
      void main(){vec3 d=normalize(vP);
        float az=degrees(atan(d.x,-d.z)),el=degrees(asin(clamp(d.y,-1.,1.)));
        float u=.5+(az-yaw)/span,v=horizon-el/(span/aspect);          // image column / row (0 top), square pixels
        vec3 c=texture2D(map,vec2(u,1.-clamp(v,.002,.998))).rgb;
        c=mix(c,topC,smoothstep(0.,-.12,v));                            // above the painting: its top colour
        float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,sat);c=(c-l)*con+l;   // atmospheric: flatter, greyer
        c=mix(c,hazeC,haze*exp(-abs(el)/1.2));                          // haze hugging the horizon
        float blue=smoothstep(.03,.12,c.b-max(c.r,c.g))*smoothstep(.5,5.,el);  // blue sky, above the skyline
        c=mix(c,c*vec3(.55,.76,1.02),deep*blue);                        // deeper sky blue
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`}));
  const mesh=new THREE.Mesh(own(new THREE.SphereGeometry(1000,48,24)),mat);mesh.renderOrder=-1;mesh.frustumCulled=false;scene.add(mesh);
  return {mesh,update(camera){mesh.position.copy(camera.position);}};
}
