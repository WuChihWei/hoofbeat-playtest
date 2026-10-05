// HOOFBEAT UI Guideline v1, markup side (styles: ui.css, rules: docs/UI_FRAMEWORK.md). One monochrome icon set and
// the few builders every page repeats: brand, wallet, header, bottom nav, bars, toast. Builders return HTML strings; wire
// clicks with data-go / data-back (the router in playable/home.js does it for the whole page).
export const esc=s=>String(s).replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
const P={
  arrow:'<path d="M5 12h13M13 6l6 6-6 6" stroke-width="2.6" stroke-linecap="round"/>',back:'<path d="M15 5l-7 7 7 7" stroke-width="3" stroke-linecap="round"/>',
  chev:'<path d="M9 5l7 7-7 7" stroke-width="2.8" stroke-linecap="round"/>',close:'<path d="M6 6l12 12M18 6 6 18" stroke-width="3" stroke-linecap="round"/>',
  plus:'<path d="M12 5v14M5 12h14" stroke-width="3" stroke-linecap="round"/>',
  home:'<path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z"/>',
  horse:'<path d="M5 21c0-5 2-8 5-10L8 7l1-4 3 3c4 0 8 3 8 8v7h-4v-5l-3-2-2 3v4z"/>',
  tracks:'<circle cx="17" cy="6" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M17 9v2c0 2-2 3-4 3H9a3 3 0 0 0 0 6h3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="5" cy="6" r="1.6"/><path d="M3.5 9.5 5 6l1.5 3.5" fill="none" stroke="currentColor" stroke-width="2"/>',
  shop:'<path d="M3 4h3l2.4 11h10.2L21 7H7.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="10" cy="19.5" r="1.7"/><circle cx="17" cy="19.5" r="1.7"/>',
  settings:'<path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zm8.5 5.3-1.9.4a6.8 6.8 0 0 1-.8 1.9l1.1 1.6-1.9 1.9-1.6-1.1a6.8 6.8 0 0 1-1.9.8l-.4 1.9h-2.6l-.4-1.9a6.8 6.8 0 0 1-1.9-.8l-1.6 1.1-1.9-1.9 1.1-1.6a6.8 6.8 0 0 1-.8-1.9l-1.9-.4v-2.6l1.9-.4a6.8 6.8 0 0 1 .8-1.9L5 6.9 6.9 5l1.6 1.1a6.8 6.8 0 0 1 1.9-.8l.4-1.9h2.6l.4 1.9a6.8 6.8 0 0 1 1.9.8L17.1 5 19 6.9l-1.1 1.6a6.8 6.8 0 0 1 .8 1.9l1.9.4z" fill-rule="evenodd"/>',
  items:'<path d="M3 9h18l-1.5 11h-15z"/><path d="M8 9V6a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  gem:'<path d="M6 3h12l4 6-10 12L2 9z"/>',
  fork:'<path d="M5 2v7a3 3 0 0 0 2 2.8V22h2V11.8A3 3 0 0 0 11 9V2H9.5v6h-1V2h-1v6h-1V2zM15 2c3 0 4 4 4 8h-2v12h-2z"/>',
  bolt:'<path d="M13 2 4 14h6l-2 8 10-13h-6z"/>',
  smile:'<circle cx="12" cy="12" r="10"/><circle cx="8.5" cy="10" r="1.5" fill="#1c3a14"/><circle cx="15.5" cy="10" r="1.5" fill="#1c3a14"/><path d="M7.5 14c1.2 2.4 7.8 2.4 9 0" fill="none" stroke="#1c3a14" stroke-width="1.8" stroke-linecap="round"/>',
  brush:'<path d="M14 3l7 7-4 4-7-7z"/><path d="M9 8l7 7-7 7-3-3 3-3-2-2-3 3-3-3z"/>',
  palette:'<path fill-rule="evenodd" d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4-4-7.4-9-7.4zM6.5 13a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>',
  saddle:'<path d="M3 9c3 0 5-3 9-3s6 3 9 3v2c-2 0-3 1-3 3v3h-2.5v-3c0-1.5-1.5-2.5-3.5-2.5S8.5 12.5 8.5 14v3H6v-3c0-2-1-3-3-3z"/><path d="M11 13h2v6h-2z"/>',
  pencil:'<path d="M3 17.3V21h3.7L18 9.7 14.3 6zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8L19 8.8z"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/>',
  again:'<path d="M19 12a7 7 0 1 1-2.1-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M20 3v6h-6z"/>',
  sound:'<path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  music:'<path d="M9 17.5V5l11-2.5v12" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="6.5" cy="17.5" r="3"/><circle cx="17.5" cy="15" r="3"/>',
  sun:'<circle cx="12" cy="12" r="4.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  cloud:'<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4.3 4.3 0 0 1-.5 8.5z"/>',
  rain:'<path d="M7 14a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 5.5a4.3 4.3 0 0 1-.5 8.5z"/><path d="M8 17l-1 3M12.5 17l-1 3M17 17l-1 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  laps:'<path d="M4 12a8 8 0 1 0 3-6.2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M3 3v5h5z"/>',
  jump:'<path d="M3 20h18M5 20v-8M19 20v-8M5 13h14M5 16.5h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  person:'<circle cx="12" cy="7.5" r="4"/><path d="M4 21a8 8 0 0 1 16 0z"/>',
  info:'<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 11v6M12 7.2v.3" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  reset:'<path d="M5 12a7 7 0 1 0 2.1-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M4 3v6h6z"/>',
  sparkle:'<path d="M10 2l1.9 5.6L17.5 9.5l-5.6 1.9L10 17l-1.9-5.6L2.5 9.5l5.6-1.9zM18.5 13l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z"/>',
  coin:'<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8.5 7.5v4a3.5 3.5 0 0 0 7 0v-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  flag:'<path d="M5 22V3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M6 4h13l-3 4.5 3 4.5H6z"/>',
  star:'<path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21.1l1.5-7L2 9.3l7-.8z"/>',
};
export const icon=(n,cls='fill')=>`<svg viewBox="0 0 24 24" aria-hidden="true" class="${cls}">${P[n]}</svg>`;

// Brand: the mockups' type wordmark (HOOFBEAT / RIDE THE WORLD); {logo:true} = the results sheet's logo art instead.
// With attrs it is a button (data-back / data-go="home").
export const brand=(attrs='',{logo=false}={})=>{const tag=attrs?'button':'div',a=attrs?`${attrs} aria-label="HOOFBEAT"`:'';
  return logo?`<${tag} class="ui-brand" ${a}><img class="mark" src="assets/ui/logo_mark.webp" alt=""><img class="word" src="assets/ui/wordmark.webp" alt="HOOFBEAT · RIDE THE WORLD"></${tag}>`
    :`<${tag} class="ui-wordmark" ${a}><b>HOOFBEAT</b><small>RIDE THE WORLD</small></${tag}>`;};
export const coin='<i class="ui-coin" aria-hidden="true">U</i>';
// The prize chest (ui-v2.css .ui-chest): prizes [{img, name, tag?, sub?}] → markup. In the page it plays once: it hops
// in, turns a full turn, the lid opens and each prize rises out as a card, back first, then turns over (its tag, its
// picture, its name and a line under it; several: side by side). cls 'at-0' | 'at-1' | 'at-b' | 'at-2' holds it still.
export const chest=(prizes,cls='')=>`<div class="ui-chest ${cls}" aria-hidden="true"><div class="hop"><div class="turn">${['b-back','b-left','b-right','b-in'].map(f=>`<i class="f ${f}"></i>`).join('')}${
  prizes.map((p,i)=>`<div class="prize" style="--x:${(i-(prizes.length-1)/2)*120}"><div class="front">${p.tag?`<span class="tag">${esc(p.tag)}</span>`:''}<img src="${p.img}" alt=""><b>${esc(p.name??'')}</b>${p.sub?`<small>${esc(p.sub)}</small>`:''}</div><i class="back"></i></div>`).join('')}<i class="f b-front"></i><div class="lid">${['l-in','l-back','l-left','l-right','l-top','l-front','lock'].map(f=>`<i class="f ${f}"></i>`).join('')}</div></div></div></div>`;
export const wallet=(coins,{gems=null}={})=>`<div class="ui-wallet" aria-label="金幣 ${coins}">${coin}<b data-coins>${coins.toLocaleString('en-US')}</b></div>${
  gems==null?'':`<div class="ui-wallet" aria-label="鑽石 ${gems}"><i class="gem">${icon('gem')}</i><b>${gems.toLocaleString('en-US')}</b></div>`}`;
export const header=(title,coins)=>`<header class="ui-header"><button class="ui-icon-btn" data-back aria-label="返回">${icon('back','')}</button><h1>${esc(title)}</h1>${coins==null?'':wallet(coins)}</header>`;
export const NAV=[['home','比賽','flag'],['stable','牧場','horse'],['shop','商店','shop'],['settings','設定','settings']];   // Home is the level map: races start there
export const nav=active=>`<nav class="ui-nav ui-panel deep" style="--n:${NAV.length}" aria-label="主選單">${NAV.map(([r,label,ic])=>
  `<button data-go="${r}" ${r===active?'aria-current="page"':''}>${icon(ic)}<span>${label}</span></button>`).join('')}</nav>`;
const pct=v=>Math.max(0,Math.min(100,Math.round(v)));
// Bars take their accent as a CSS colour (default green): var(--ui-lime), var(--ui-yellow), var(--ui-cyan)…
export const bar=(v,c='')=>`<span class="ui-bar" style="--v:${pct(v)};${c?`--c:${c}`:''}"><i></i></span>`;
export const meter=(ic,v,c='')=>`<span class="ui-meter" style="${c?`--c:${c}`:''}">${icon(ic)}${bar(v,c)}</span>`;
// Toast: a status line in `host` (one per page); returns show(message).
export function toaster(host){
  const t=host.querySelector('.ui-toast')||host.appendChild(Object.assign(document.createElement('p'),{className:'ui-toast',role:'status'}));let timer=0;
  return msg=>{t.textContent=msg;t.classList.add('on');clearTimeout(timer);timer=setTimeout(()=>t.classList.remove('on'),1800);};
}
