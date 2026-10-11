// Language switch (2026-10-04, the user: Chinese and English, switchable). The UI's texts are written where they are
// used, most in Chinese and some in English. This module turns each of them into the chosen language as it reaches the
// page: a table of pairs (i18n-strings.mjs) looked up by either form, applied to text nodes and to aria-label / title /
// alt / placeholder whenever they are added or changed (MutationObserver).
//   {zh, en}        the whole text of a node (surrounding spaces kept)
//   {zh, en, p:1}   a text with {0}, {1}… in it (a number, a name, a nested text): the captured parts are looked up in
//                   turn. The pattern with the most fixed text is tried first.
//   a · b · c       a list: each part is looked up on its own (unless the whole list is in the table).
// Not covered: text drawn into the 3D scene (the gate's RELAY / FINISH sign), the player's own rider name, and the
// race's art words (PERFECT, COMBO, GO!…: English in both languages, they are not in the table).
// ponytail: matched after rendering, not at the call sites: a text that is not in the table stays as written, and a
// switch reloads the page (texts are only ever translated from their source form, so two Chinese texts may share an
// English one). Upgrade path: a t() call at each site, if keeping the table in step with the texts gets hard.
import {STRINGS} from './i18n-strings.mjs?v=r474';

const KEY='hoofbeat.lang.v1',ATTRS=['aria-label','title','alt','placeholder'];
export const lang=()=>{try{return localStorage.getItem(KEY)||(/^zh/i.test(navigator.language||'zh')?'zh':'en');}catch{return 'zh';}};

const SEP=' · ',other={zh:'en',en:'zh'},exact=new Map(),patterns={zh:[],en:[]};   // patterns[to]: written in the other language
const template=t=>new RegExp('^'+t.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{(\d)\}/g,'(.+?)')+'$');
for(const e of STRINGS)for(const from of ['zh','en']){
  if(e.p)patterns[other[from]].push({re:template(e[from]),order:[...e[from].matchAll(/\{(\d)\}/g)].map(m=>+m[1]),fixed:e[from].replace(/\{\d\}/g,'').length,e});
  else if(!exact.has(e[from]))exact.set(e[from],e);
}
for(const list of Object.values(patterns))list.sort((a,b)=>b.fixed-a.fixed);
// A text worth trying the patterns on: one with the other language in it (the HUD's numbers change every frame).
const foreign={en:/[\u3400-\u9fff]/,zh:/[A-Za-z]{2}/};
// One text → the chosen language (unchanged when it is not in the table).
export function translate(text,to=lang(),depth=0){
  const core=text.trim();if(!core)return text;
  const hit=exact.get(core);
  let out=hit?hit[to]:null;
  if(out==null&&depth<2&&foreign[to].test(core)){
    if(core.includes(SEP))out=core.split(SEP).map(t=>translate(t,to,depth)).join(SEP);   // a list: part by part (no pattern has SEP in it: tools/check-i18n.mjs)
    else for(const p of patterns[to]){
      const m=p.re.exec(core);if(!m)continue;
      const parts=[];p.order.forEach((k,i)=>parts[k]=translate(m[i+1],to,depth+1));
      out=p.e[to].replace(/\{(\d)\}/g,(_,k)=>parts[+k]??'');break;
    }
  }
  return out==null||out===core?text:text.replace(core,()=>out);
}
const skip=n=>{const p=n.parentElement;return !p||p.closest('script,style,canvas,textarea,[data-i18n-off]');};
function apply(root){
  const to=lang();
  if(root.nodeType===3){if(!skip(root)){const t=translate(root.nodeValue,to);if(t!==root.nodeValue)root.nodeValue=t;}return;}
  if(root.nodeType!==1)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  for(let n=walker.nextNode();n;n=walker.nextNode())if(!skip(n)){const t=translate(n.nodeValue,to);if(t!==n.nodeValue)n.nodeValue=t;}
  for(const el of [root,...root.querySelectorAll('[aria-label],[title],[alt],[placeholder]')])for(const a of ATTRS){
    const v=el.getAttribute?.(a);if(v){const t=translate(v,to);if(t!==v)el.setAttribute(a,t);}}
}
export function setLang(l){try{localStorage.setItem(KEY,l);}catch{}location.reload();}

if(typeof document!=='undefined'){
  const start=()=>{document.documentElement.lang=lang()==='zh'?'zh-Hant':'en';apply(document.body);
    new MutationObserver(list=>{for(const m of list){
      if(m.type==='characterData')apply(m.target);
      else if(m.type==='attributes')apply(m.target);
      else for(const n of m.addedNodes)apply(n);}
    }).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});};
  if(document.body)start();else addEventListener('DOMContentLoaded',start);
}
