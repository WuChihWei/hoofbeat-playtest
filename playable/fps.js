// ?fps: a small counter in the corner, for the phone (2026-10-10, nothing 3D had been measured on one). It counts the
// browser's own frames (requestAnimationFrame), whatever a page draws: the race draws 30 pictures a second on purpose
// (slice-app), the ranch every frame, the stable 20–30. Shown: this second's frames · the page's average since it
// opened · how many seconds ran under 30 · the longest frame (ms). Starts over on every page (hash) change.
// Read it off a screenshot: a page under 50 average, or more than a couple of slow seconds, is worth a look.
const box=document.createElement('div');box.id='fps';box.setAttribute('aria-hidden','true');
box.style.cssText='position:fixed;z-index:99999;left:50%;top:max(4px,env(safe-area-inset-top));translate:-50% 0;padding:3px 8px;border-radius:8px;background:#000c;color:#dfff5a;font:700 12px/1.3 ui-monospace,Menlo,monospace;white-space:nowrap;pointer-events:none';
document.body.append(box);
let frames=0,sec=performance.now(),total=0,since=sec,slow=0,longest=0,last=sec,page=location.hash;
function tick(t){
  requestAnimationFrame(tick);
  if(location.hash!==page){page=location.hash;frames=total=slow=longest=0;sec=since=last=t;return;}
  longest=Math.max(longest,t-last);last=t;frames++;total++;
  if(t-sec>=1000){const fps=frames*1000/(t-sec),avg=total*1000/(t-since);if(fps<30)slow++;
    box.textContent=`${fps.toFixed(0)} fps · avg ${avg.toFixed(0)} · slow ${slow}s · max ${longest.toFixed(0)}ms`;box.style.color=fps<30?'#ff7b6b':fps<50?'#ffd846':'#dfff5a';
    frames=0;sec=t;}
}
requestAnimationFrame(tick);
