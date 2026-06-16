// ============ MAP ENGINE ============
const TILE_EMPTY=0, TILE_DIRT=1, TILE_STONE=2, TILE_METAL=3, TILE_ICE=4, TILE_GLASS=5;
const TILE_PLAT=6, TILE_SPIKE=7, TILE_BOUNCER=8, TILE_WATER=9, TILE_LAVA=10, TILE_LADDER=11;
const TILE_BG_DIRT=12, TILE_BG_STONE=13, TILE_BG_METAL=14, TILE_BG_ICE=15, TILE_BG_GLASS=16;
const TILE_WOOD=17, TILE_BRICK=18, TILE_CRUMBLE=19;
const TILE_WOOD_PLANK=20, TILE_CRACKED_WOOD=21, TILE_BG_WOOD=22;

let map={ outdoor:{}, rooms:[], doors:[], pickups:[], enemies:[], decorations:[], spawnX: 60, spawnY: 440, bgY: 0 };
let currentMapIdx = -1; // -1 = outdoor, 0+ = rooms
let activeEnemies = [];
let respawnPoint = {x: 60, y: 440, mapIdx: -1};
let respawnData = null;
let levelList = [];

function getActiveMap(){ return currentMapIdx === -1 ? map.outdoor : map.rooms[currentMapIdx]; }
function isSolidTile(t){ return (t>=1 && t<=5) || t===8 || t===17 || t===18 || t===TILE_WOOD_PLANK || t===TILE_CRACKED_WOOD; }

function getFg(t) {
    if(t >= 100) return t % 100;
    if(t >= 12 && t <= 16) return TILE_EMPTY; // Only BG (dirt/stone/metal/ice/glass)
    if(t === TILE_BG_WOOD) return TILE_EMPTY;  // BG Wood - only BG
    return t; // Normal FG
}
function getBg(t) {
    if(t >= 100) return Math.floor(t / 100);
    if(t >= 12 && t <= 16) return t; // Only BG
    if(t === TILE_BG_WOOD) return t; // BG Wood
    return TILE_EMPTY; // No BG
}

function makeEmptyMapData(cols, rows){
    const t = [];
    for(let y=0;y<rows;y++){ t[y]=[]; for(let x=0;x<cols;x++) t[y][x]=(y>=rows-2)?TILE_DIRT:TILE_EMPTY; }
    return {cols, rows, w:cols*TS, h:rows*TS, tiles: t};
}

function initEmptyMap(cols=100){
    map = { outdoor: makeEmptyMapData(cols, 20), rooms: [], doors: [], pickups: [], enemies: [], decorations:[], spawnX: 60, spawnY: 17*TS, bgY: 0, fog: 0, weather: 'none' };
    currentMapIdx = -1;
}

function loadMapData(data){
    if(!data) { initEmptyMap(); return; }
    map.outdoor = makeEmptyMapData(data.cols||100, data.rows||20);
    map.outdoor.tiles = data.tiles;
    map.rooms = data.rooms || [];
    map.pickups = data.pickups || [];
    map.doors = data.doors || [];
    map.enemies = data.enemies || [];
    map.decorations = data.decorations || [];
    map.spawnX = data.spawnX || 60; map.spawnY = data.spawnY || (map.outdoor.rows-3)*TS;
    map.bgY = data.bgY || 0;
    map.fog = data.fog || 0;
    map.weather = data.weather || 'none';
    
    // Update Editor UI
    const sel = document.getElementById('ed-map-select');
    if(sel){
        sel.innerHTML = '<option value="outdoor">Outdoor</option>';
        map.rooms.forEach((r,i) => {
            const opt = document.createElement('option');
            opt.value = i; opt.innerText = 'Room ' + i;
            sel.appendChild(opt);
        });
        document.getElementById('ed-fog').value = map.fog;
        document.getElementById('ed-weather-rain').checked = hasWeather('rain');
        document.getElementById('ed-weather-mist').checked = hasWeather('mist');
        document.getElementById('ed-weather-lightning').checked = hasWeather('lightning');
    }
    
    map.rooms.forEach(r => { r.w = r.cols*TS; r.h = r.rows*TS; });
    currentMapIdx = -1;
}

function updateAtmosphere(){
    map.fog = parseFloat(document.getElementById('ed-fog').value) || 0;
    map.weather = [];
    if(document.getElementById('ed-weather-rain').checked) map.weather.push('rain');
    if(document.getElementById('ed-weather-mist').checked) map.weather.push('mist');
    if(document.getElementById('ed-weather-lightning').checked) map.weather.push('lightning');
    isMapUnsaved = true;
}

function hasWeather(w){
    if(!map.weather) return false;
    if(typeof map.weather === 'string') return map.weather === w;
    return map.weather.includes(w);
}

function changeMapLevel(val){
    currentMapIdx = val === 'outdoor' ? -1 : parseInt(val);
    cam.x = 0; cam.y = 0;
}

function addRoom(){
    const idx = map.rooms.length;
    map.rooms.push(makeEmptyMapData(40, 20));
    const sel = document.getElementById('ed-map-select');
    const opt = document.createElement('option');
    opt.value = idx; opt.innerText = 'Room ' + idx;
    sel.appendChild(opt);
    sel.value = idx;
    currentMapIdx = idx;
    isMapUnsaved = true;
}

function mapTile(c,r){
    const d = getActiveMap();
    if(c<0||c>=d.cols||r<0||r>=d.rows)return TILE_EMPTY; 
    return getFg(d.tiles[r][c]); // Only return FG for physics
}

function resizeMap(){
    const nw = parseInt(document.getElementById('map-w-inp').value);
    const nh = parseInt(document.getElementById('map-h-inp').value);
    if(nw && nh && nw>10 && nh>10) {
        const m = getActiveMap();
        const oldC = m.cols, oldR = m.rows;
        m.cols = nw; m.w = nw*TS;
        m.rows = nh; m.h = nh*TS;
        
        // 1. Expand Width First
        for(let y=0;y<oldR;y++){
            if(nw > oldC) {
                // If the last block in this row was a ground block, extend it
                const lastTile = m.tiles[y][oldC - 1];
                const isGround = (lastTile === 1 || lastTile === 2 || lastTile === 3);
                const fillTile = isGround ? lastTile : 0;
                for(let x=oldC; x<nw; x++) m.tiles[y].push(fillTile);
            } else if(nw < oldC) {
                m.tiles[y].length = nw;
            }
        }
        
        // 2. Expand Height (Add/Remove from top so ground level doesn't float)
        if(nh !== oldR){
            const diffR = nh - oldR;
            if(diffR > 0){
                for(let y=0; y<diffR; y++){
                    let newRow = [];
                    for(let x=0; x<nw; x++) newRow.push(0); 
                    m.tiles.unshift(newRow);
                }
            } else {
                m.tiles.splice(0, Math.abs(diffR));
            }
            
            const dy = diffR * TS;
            map.enemies.forEach(e => { if(e.mapIdx === currentMapIdx) e.y += dy; });
            map.pickups.forEach(p => { if(p.mapIdx === currentMapIdx) p.y += dy; });
            map.doors.forEach(d => { if(d.mapIdx === currentMapIdx) d.wy += dy; });
            map.decorations.forEach(d => { if(d.mapIdx === currentMapIdx) d.y += dy; });
            if(currentMapIdx === -1) {
                map.spawnY += dy;
                if(typeof player !== 'undefined') player.y += dy;
            }
            if(typeof cam !== 'undefined') cam.y += dy;
        }
        
        cam.mw = m.w; cam.mh = m.h;
        isMapUnsaved = true;
        showToast('Map Resized to ' + nw + 'x' + nh);
    }
}

