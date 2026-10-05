// HOOFBEAT unified look (docs/VISUAL_STYLE.md): one light rig for every 3D view — race, stable, review pages.
// Soft "vinyl toy" render: sky/ground image-based light (every surface gets soft wrap light and a broad sheen),
// warm key sun with soft shadows, cool sky fill, warm rim, Neutral tone mapping (keeps the palette's hues).
import * as THREE from './vendor/three.module.min.js';

export const LOOK = Object.freeze({
  toneMapping: THREE.NeutralToneMapping, exposure: 1.0,
  sky: {zenith: '#8ec8ef', horizon: '#fff0dc', ground: '#b8966f', sunGlow: '#fff4e0'},
  env: {intensity: 0.85},
  sun: {color: '#fff2e2', intensity: 2.0},
  fill: {sky: '#dcecff', ground: '#b58f6a', intensity: 0.45},
  rim: {color: '#fff1dc', intensity: 0.8},
  backdrop: {top: '#6fb3ee', horizon: '#d6e9f2'},   // visible sky gradient; horizon doubles as the fog colour
  shadow: {type: THREE.PCFShadowMap, radius: 3, raceMap: 1024, stableMap: 2048},
  // Race only (approved-environment.js, the race concept art): brighter key, less fill and sky light so forms read
  // (lit backs, deeper bellies and shadows), stronger rim, a touch more exposure, and a saturation lift in the tone
  // mapping itself (raceGrade: no extra pass). The stable keeps the base rig above.
  // One picture, three layers (2026-10-04): the painted far view is soft and cool, so the 3D near layer and the horses
  // are held closer to it: saturation 1.05 (was 1.18), the unlit painted cards (trees, hedges: the most vivid things on
  // screen) a further × card, the fill carries more of the painted sky (skyFill), and the fog starts sooner (fog ×
  // the city's distances) so the roadside fades into the painting's haze instead of ending against it.
  // 2026-10-04, the user: the roadside trees and things still drew the eye too much. The painted cards (trees, lamps,
  // banners, shrubs, benches; the skyline cards too) are held back: card = their saturation, cardValue = their brightness.
  race: {sun: 2.5, fill: 0.3, env: 0.68, rim: 1.1, exposure: 1.06, saturation: 1.18, card: 0.72, cardValue: 0.92, skyFill: 0.3, fog: [1, 1]},
});
// Race grade: Neutral tone mapping, then saturation × LOOK.race.saturation, in the same shader step (CustomToneMapping).
// The chunk is shared, but only renderers set to CustomToneMapping (the race) use it.
export function raceGrade(renderer, saturation = LOOK.race.saturation) {
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment, custom = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
  if (chunk.includes(custom)) THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(custom,
    `vec3 CustomToneMapping( vec3 color ) { color = NeutralToneMapping( color ); float l = dot( color, vec3( .2126, .7152, .0722 ) ); return max( vec3( 0. ), mix( vec3( l ), color, ${saturation.toFixed(3)} ) ); }`);
  renderer.toneMapping = THREE.CustomToneMapping;
}

// Image-based light from a procedural sky dome: zenith blue -> warm horizon -> warm ground bounce, plus a soft
// glow toward the sun so glossy parts (eyes, helmet, boots) pick up a broad highlight instead of nothing.
export function skyEnvironment(renderer, sunDir = new THREE.Vector3(-.5, .7, .5)) {
  const c = LOOK.sky, dome = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {zen: {value: new THREE.Color(c.zenith)}, hor: {value: new THREE.Color(c.horizon)}, gnd: {value: new THREE.Color(c.ground)},
      glow: {value: new THREE.Color(c.sunGlow)}, sun: {value: sunDir.clone().normalize()}},
    vertexShader: 'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform vec3 zen,hor,gnd,glow,sun;varying vec3 vDir;void main(){
      float y=vDir.y;vec3 sky=mix(hor,zen,smoothstep(0.,.6,y));vec3 col=y>0.?sky:mix(hor,gnd,smoothstep(0.,.25,-y));
      col+=glow*pow(max(dot(vDir,sun),0.),6.)*1.6;gl_FragColor=vec4(col,1.);}`,
  }));
  const s = new THREE.Scene(); s.add(dome);
  const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(s, 0.02).texture;
  pm.dispose(); dome.geometry.dispose(); dome.material.dispose();
  return tex;
}

// Apply the rig. Pass the lights a view already has (sun/fill/rim may be null -> created); returns them.
export function applyLook(renderer, scene, {sun, fill, rim, shadowMap = LOOK.shadow.raceMap} = {}) {
  renderer.toneMapping = LOOK.toneMapping; renderer.toneMappingExposure = LOOK.exposure;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = LOOK.shadow.type;
  const dir = sun ? sun.position.clone().sub(sun.target.position).normalize() : undefined;
  scene.environment = skyEnvironment(renderer, dir); scene.environmentIntensity = LOOK.env.intensity;
  if (!fill) { fill = new THREE.HemisphereLight(); scene.add(fill); }
  fill.color.set(LOOK.fill.sky); fill.groundColor.set(LOOK.fill.ground); fill.intensity = LOOK.fill.intensity;
  if (sun) {
    sun.color.set(LOOK.sun.color); sun.intensity = LOOK.sun.intensity;
    if (sun.castShadow) { sun.shadow.mapSize.set(shadowMap, shadowMap); sun.shadow.radius = LOOK.shadow.radius; sun.shadow.map?.dispose(); sun.shadow.map = null; }
  }
  if (rim) { rim.color.set(LOOK.rim.color); rim.intensity = LOOK.rim.intensity; }
  return {sun, fill, rim};
}
