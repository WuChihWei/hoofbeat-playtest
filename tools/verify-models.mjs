// Usage: node verify-models.mjs <orig.glb> <compressed.glb> — exits 1 unless the decoded content matches exactly.
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const [a,b]=await Promise.all(process.argv.slice(2).map(f=>io.read(f)));
const fails=[];const eq=(x,y,what)=>{if(JSON.stringify(x)!==JSON.stringify(y))fails.push(what);};
const near=(x,y)=>JSON.stringify(x)===JSON.stringify(y);   // exact again: compress.mjs copies node transforms back
// a primitive as a sorted list of whole vertices (all attributes), and its triangles in vertex terms: order-independent
function prim(p){
  const sem=p.listSemantics().sort(),acc=sem.map(s=>p.getAttribute(s)),n=acc[0].getCount();
  const vert=i=>acc.map(x=>Array.from(x.getElement(i,[]))).flat().join(',');
  const verts=Array.from({length:n},(_,i)=>vert(i));
  const idx=p.getIndices()?Array.from(p.getIndices().getArray()):[...Array(n).keys()];
  const tris=[];for(let i=0;i<idx.length;i+=3){const t=[vert(idx[i]),vert(idx[i+1]),vert(idx[i+2])];const r=t.indexOf([...t].sort()[0]);tris.push([...t.slice(r),...t.slice(0,r)].join('|'));}
  const targets=p.listTargets().map(t=>t.listSemantics().length);
  return {sem,types:acc.map(x=>[x.getComponentType(),x.getNormalized(),x.getType()]),mode:p.getMode(),mat:p.getMaterial()?.getName(),verts:[...new Set(verts)].sort(),tris:tris.sort(),targets};
}
const ra=a.getRoot(),rb=b.getRoot();
if(!near(ra.listNodes().map(n=>[n.getName(),n.getTranslation(),n.getRotation(),n.getScale(),n.getMesh()?.getName()??null,n.getSkin()?.getName()??null]),rb.listNodes().map(n=>[n.getName(),n.getTranslation(),n.getRotation(),n.getScale(),n.getMesh()?.getName()??null,n.getSkin()?.getName()??null]))) fails.push('nodes');
eq(ra.listMaterials().map(m=>m.getName()),rb.listMaterials().map(m=>m.getName()),'materials');
eq(ra.listSkins().map(s=>[s.listJoints().map(j=>j.getName()),Array.from(s.getInverseBindMatrices()?.getArray()??[])]),rb.listSkins().map(s=>[s.listJoints().map(j=>j.getName()),Array.from(s.getInverseBindMatrices()?.getArray()??[])]),'skins');
const ma=ra.listMeshes(),mb=rb.listMeshes();eq(ma.map(m=>m.getName()),mb.map(m=>m.getName()),'mesh names');
ma.forEach((m,i)=>m.listPrimitives().forEach((p,j)=>{const q=mb[i]?.listPrimitives()[j];if(!q)return fails.push(`prim ${m.getName()}/${j} missing`);const x=prim(p),y=prim(q);for(const k in x)eq(x[k],y[k],`${m.getName()}/${j}.${k}`);}));
const anim=d=>d.getRoot().listAnimations().map(an=>[an.getName(),an.listChannels().map(c=>[c.getTargetNode()?.getName(),c.getTargetPath(),c.getSampler().getInterpolation(),Array.from(c.getSampler().getInput().getArray()),Array.from(c.getSampler().getOutput().getArray())])]);
eq(anim(a),anim(b),'animations');
eq(ra.listTextures().map(t=>t.getImage()?.length),rb.listTextures().map(t=>t.getImage()?.length),'textures');
if(fails.length){console.log('MISMATCH',process.argv[3],fails.slice(0,10));process.exit(1);}
console.log('ok',process.argv[3].split('/').pop());
