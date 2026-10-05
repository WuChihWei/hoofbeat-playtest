// App entry: the home shell (routes Home / Race / Stable / Tracks / Settings). ?race=1 jumps straight into a race.
import './i18n.js?v=r268';   // the language switch: translates the page's texts as they appear
import {startSlice} from './playable/slice-app.js?v=r268';
import {startHome} from './playable/home.js?v=r268';
import {watchErrors} from './playtest.js?v=r268';

watchErrors();   // playtest build: script errors go into the test log (Settings → 測試紀錄)

const q=new URLSearchParams(location.search);
if(q.get('race')==='1')startSlice({city:q.get('city'),onExit:(r,dest)=>location.replace(`${location.pathname}#${dest||'home'}`)});
else startHome();   // ?race=1 back: into the home shell
