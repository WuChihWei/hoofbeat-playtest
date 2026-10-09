// Usage: node compress-models.mjs <in.glb> <out.glb>   (npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer)
// Lossless EXT_meshopt_compression: no quantization or filters, so the decoded attributes and keyframes are the
// originals bit for bit (only vertex/index order changes, for a better ratio). Node transforms are copied back from
// the source afterwards: the writer would otherwise round near-identity scales (1.000003) to 1.
import fs from 'fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTMeshoptCompression} from '@gltf-transform/extensions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import {reorder} from '@gltf-transform/functions';
const [inp,out]=process.argv.slice(2);
await MeshoptEncoder.ready;await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const doc=await io.read(inp);
await doc.transform(reorder({encoder:MeshoptEncoder,target:'size'}));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
const glb=Buffer.from(await io.writeBinary(doc));
const chunk=b=>{const n=b.readUInt32LE(12);return {json:JSON.parse(b.subarray(20,20+n).toString()),rest:b.subarray(20+n)};};
const src=chunk(fs.readFileSync(inp)).json,{json,rest}=chunk(glb);
if(src.nodes.length!==json.nodes.length)throw new Error('node count changed');
json.nodes.forEach((n,i)=>{const s=src.nodes[i];if(s.name!==n.name)throw new Error(`node ${i} renamed`);for(const k of ['translation','rotation','scale','matrix']){if(k in s)n[k]=s[k];else delete n[k];}});
let text=Buffer.from(JSON.stringify(json));text=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,0x20)]);
const head=Buffer.alloc(20);head.writeUInt32LE(0x46546C67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(20+text.length+rest.length,8);head.writeUInt32LE(text.length,12);head.writeUInt32LE(0x4E4F534A,16);
fs.writeFileSync(out,Buffer.concat([head,text,rest]));
