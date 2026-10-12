// App entry: the home shell (routes Home / Race / Ranch / Shop / Settings).
import './i18n.js?v=r576';   // the language switch: translates the page's texts as they appear
import {startHome} from './playable/home.js?v=r576';
import {watchErrors} from './playtest.js?v=r576';

watchErrors();   // playtest build: script errors go into the test log (Settings → 測試紀錄)
startHome();
