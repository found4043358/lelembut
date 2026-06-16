const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = `<canvas id="gameCanvas"></canvas><div id="hp-bar"></div><div id="battery-icon"></div><div id="lungs-container"></div><div id="lungs-icon"></div><div id="ammo-txt"></div><div id="reload-icon"></div><div id="pickup-notifs"></div><div id="dmg-flash"></div><div id="prompt-box"></div><div id="hud-left"></div><div id="room-label"></div><div id="aim-lock-icon"></div><div id="aim-dir-txt"></div>`;
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost' });
const window = dom.window;
window.AudioContext = function() {};
window.requestAnimationFrame = function(cb) { setTimeout(() => cb(100), 16); };
window.performance = { now: () => 100 };
window.localStorage = { getItem:()=>null, setItem:()=>{} };
const document = window.document;

let code = '';
['globals','audio','settings','entities','map','lighting','camera','render','editor','input','ui','api','main'].forEach(f => {
    code += fs.readFileSync('c:/laragon/www/game-web/platformer/js/'+f+'.js','utf8') + '\n';
});
window.eval(code);

try {
    window.startGameplay(true);
    window.loop(116);
    console.log('SUCCESS');
} catch(e) {
    console.error('CRASH:', e);
}
