// ================================================================
//  LELEMBUT SIDE-SCROLL — Engine v6
//  Features: 10+ Blocks, Decorations, Lighting Rework, Bug Fixes
// ================================================================
"use strict";

const INTERNAL_W = 1280, INTERNAL_H = 720;
let CW = INTERNAL_W, CH = INTERNAL_H;
let DRAW_SCALE = 1, DRAW_OFFSET_X = 0, DRAW_OFFSET_Y = 0;
let camZoom = 1, camZoomTarget = 1, zoomState = 0;
let camShake = 0;
const TS = 40;
let filmMode = false;
const FILM_BAR_H = 60;

let gameState = 'MENU'; 
let currentLevelId = null;
let isMapUnsaved = false;
let _baseCanvasFilter = 'none'; // stores user graphic filter (excl. grayscale)

// ============ UI & MENUS ============
let isTransitioning = false;
function transitionTo(targetMenuOrFunction) {
    if(isTransitioning) return;
    isTransitioning = true;
    const fade = document.getElementById('screen-fade');
    fade.classList.add('active');
    
    setTimeout(() => {
        try {
            if(typeof targetMenuOrFunction === 'function'){
                targetMenuOrFunction();
            } else {
                setMenu(targetMenuOrFunction);
            }
        } catch(e) {
            console.error("Transition error:", e);
        } finally {
            setTimeout(() => {
                fade.classList.remove('active');
                setTimeout(() => { isTransitioning = false; }, 400);
            }, 100);
        }
    }, 400);
}

function setMenu(id){
    document.querySelectorAll('.overlay-menu').forEach(e=>e.classList.add('hidden'));
    document.getElementById('ui-layer').classList.add('hidden');
    document.getElementById('editor-ui').classList.add('hidden');
    
    // Always restore canvas filter when leaving game (removes lingering grayscale from pause)
    if(gameState === 'PAUSE' || gameState === 'PLAY') {
        canvas.style.filter = _baseCanvasFilter;
    }
    
    if(id==='game'){
        gameState='PLAY';
        document.getElementById('ui-layer').classList.remove('hidden');
        document.body.classList.add('playing');
    } else if(id==='editor-ui'){
        gameState='EDITOR';
        // Also clear filter for editor
        canvas.style.filter = _baseCanvasFilter;
        document.getElementById(id).classList.remove('hidden');
        document.body.classList.remove('playing');
    } else if(id==='level-select'){
        fetchLevels('play');
        document.getElementById(id).classList.remove('hidden');
        document.body.classList.remove('playing');
    } else if(id==='editor-select'){
        fetchLevels('edit');
        document.getElementById(id).classList.remove('hidden');
        document.body.classList.remove('playing');
    } else {
        if(id==='gameover-menu') gameState='GAMEOVER';
        else if(id==='victory-menu') gameState='VICTORY';
        else gameState='MENU';
        if(id) document.getElementById(id).classList.remove('hidden');
        document.body.classList.remove('playing');
    }
}
function showToast(msg){
    const t=document.getElementById('toast');
    t.innerText=msg; t.classList.remove('hidden');
    setTimeout(()=>t.classList.add('hidden'), 3000);
}
function togglePause(){
    if(gameState==='PLAY'){
        gameState='PAUSE';
        document.getElementById('pause-menu').classList.remove('hidden');
        canvas.style.filter = _baseCanvasFilter + ' grayscale(1)';
    } else if (gameState==='PAUSE'){
        gameState='PLAY';
        document.getElementById('pause-menu').classList.add('hidden');
        canvas.style.filter = _baseCanvasFilter;
    }
}

// ============ SETTINGS & KEYBINDS ============
let binds = {l:'KeyA', r:'KeyD', u:'KeyW', d:'KeyS', jump:'Space', shoot:'KeyZ', interact:'KeyE'};
const keys = {l:0,r:0,u:0,d:0,jump:0,jpressed:0,shoot:0,interact:0,ipressed:0};
let waitingForBind = null;

function loadBinds(){
    const saved = localStorage.getItem('lelembut_binds');
    if(saved) binds = JSON.parse(saved);
    updateBindUI();
}
function saveBinds(){ localStorage.setItem('lelembut_binds', JSON.stringify(binds)); }
function updateBindUI(){
    Object.keys(binds).forEach(k=>{
        const btn = document.getElementById('bind-'+k);
        if(btn) btn.innerText = binds[k].replace('Key','').replace('Arrow','');
    });
}
function rebind(action){
    document.getElementById('bind-'+action).innerText = "...";
    waitingForBind = action;
}

function initInput(){
    loadBinds();
    window.onkeydown=e=>{
        if(waitingForBind){
            binds[waitingForBind] = e.code; waitingForBind = null;
            updateBindUI(); saveBinds(); e.preventDefault(); return;
        }
        if(e.code===binds.l) keys.l=1;
        if(e.code===binds.r) keys.r=1;
        if(e.code===binds.u) keys.u=1;
        if(e.code===binds.d) keys.d=1;
        if(e.code===binds.jump) {if(!keys.jump)keys.jpressed=1; keys.jump=1; e.preventDefault();}
        if(e.code===binds.shoot) keys.shoot=1;
        if(e.code===binds.interact) {if(!keys.interact)keys.ipressed=1; keys.interact=1;}
        if(e.code==='KeyP' && gameState==='PLAY' && devMenuEnabled) devMode=!devMode;
        if(e.code==='Escape') {
            if(gameState==='PLAY' || gameState==='PAUSE') togglePause();
            else if(gameState==='EDITOR') attemptExitEditor();
        }
        if(e.code==='KeyM' && gameState==='PLAY') {
            zoomState = (zoomState + 1) % 3;
            if(zoomState===0) camZoomTarget = 1;
            else if(zoomState===1) camZoomTarget = 1.4;
            else if(zoomState===2) camZoomTarget = 1.2;
        }
        
        if(gameState==='EDITOR' && edTool==='select' && edSel.rect && (e.code==='Delete' || e.code==='Backspace')){
            deleteSelection(); isMapUnsaved = true;
        }
    };
    window.onkeyup=e=>{
        if(e.code===binds.l) keys.l=0;
        if(e.code===binds.r) keys.r=0;
        if(e.code===binds.u) keys.u=0;
        if(e.code===binds.d) keys.d=0;
        if(e.code===binds.jump) keys.jump=0;
        if(e.code===binds.shoot) keys.shoot=0;
        if(e.code===binds.interact) keys.interact=0;
    };
}

// ============ AUDIO ============
const Audio = {
    ctx: null,
    _g(v){const g=this.ctx.createGain();g.gain.value=v;g.connect(this.ctx.destination);return g},
    init(){if(!this.ctx){this.ctx=new (window.AudioContext||window.webkitAudioContext)()}},
    shoot(){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this._g(.25);o.connect(g);o.type='square';const t=this.ctx.currentTime;o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(40,t+.1);g.gain.exponentialRampToValueAtTime(.001,t+.1);o.start();o.stop(t+.1)},
    hit(){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this._g(.15);o.connect(g);o.type='sawtooth';const t=this.ctx.currentTime;o.frequency.setValueAtTime(110,t);o.frequency.linearRampToValueAtTime(35,t+.22);g.gain.linearRampToValueAtTime(.001,t+.22);o.start();o.stop(t+.22)},
    door(){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this._g(.12);o.connect(g);o.type='sine';const t=this.ctx.currentTime;o.frequency.setValueAtTime(90,t);o.frequency.linearRampToValueAtTime(55,t+.45);g.gain.linearRampToValueAtTime(.001,t+.45);o.start();o.stop(t+.45)},
    pick(){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this._g(.08);o.connect(g);o.type='sine';const t=this.ctx.currentTime;o.frequency.setValueAtTime(320,t);o.frequency.setValueAtTime(520,t+.08);g.gain.linearRampToValueAtTime(.001,t+.25);o.start();o.stop(t+.25)},
    save(){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this._g(.1);o.connect(g);o.type='triangle';const t=this.ctx.currentTime;o.frequency.setValueAtTime(400,t);o.frequency.linearRampToValueAtTime(600,t+.3);g.gain.linearRampToValueAtTime(.001,t+.3);o.start();o.stop(t+.3)},
};

// ============ PARTICLES ============
const particles=[];
function pEmit(x,y,n,color,sMin,sMax,grav){
    for(let i=0;i<n;i++){
        const a=Math.random()*Math.PI*2,s=sMin+Math.random()*(sMax-sMin);
        particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-10,life:1,decay:1.5+Math.random(),color,sz:1.5+Math.random()*3,g:grav||180});
    }
}
function pDust(x,y,dir){
    for(let i=0;i<2;i++) particles.push({x:x+(Math.random()-.5)*10,y,vx:-dir*(15+Math.random()*25),vy:-8-Math.random()*12,life:.6+Math.random()*.3,decay:2,color:'rgba(150,140,130,.7)',sz:2.5+Math.random()*3,g:50});
}
function updateParticles(dt){
    if(map.weather === 'rain' && (currentMapIdx === -1 || Math.random()<0.3)){
        const rx = cam.x + Math.random() * CW * 1.5 - CW*0.25;
        particles.push({x:rx, y:cam.y-50, vx:-100-Math.random()*50, vy:500+Math.random()*200, life:1, decay:0.5, color:'rgba(180,200,255,0.6)', sz:1.5, g:400, type:'rain'});
    }
    if(map.weather === 'mist' && Math.random() < 0.05){
        const mx = cam.x + CW + 100;
        particles.push({x:mx, y:cam.y + Math.random()*CH, vx:-20-Math.random()*30, vy:0, life:0, maxLife:0.3+Math.random()*0.3, decay: -0.1, color:'mist', sz: 150+Math.random()*150, g:0, type:'mist'});
    }

    for(let i=particles.length-1;i>=0;i--){
        const p=particles[i];
        p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=p.g*dt;
        
        if(p.type === 'mist') {
            if(p.decay < 0 && p.life >= p.maxLife) p.decay = Math.abs(p.decay); // start fading
            p.life -= p.decay * dt;
        } else {
            p.life -= p.decay * dt;
        }

        if(p.type === 'rain' && p.y > cam.y+CH) p.life = 0;
        else if(p.type === 'rain' && isSolidTile(mapTile(Math.floor(p.x/TS),Math.floor(p.y/TS)))){
            pEmit(p.x, p.y-2, 2, 'rgba(180,200,255,0.5)', 20, 50, 300);
            p.life = 0;
        }
        
        if(p.life<=0 && p.decay > 0) particles.splice(i,1);
    }
}
function drawParticles(ctx,cx,cy){
    for(const p of particles){
        if(p.type === 'mist'){
            const grad = ctx.createRadialGradient(p.x-cx, p.y-cy, 0, p.x-cx, p.y-cy, p.sz);
            grad.addColorStop(0, `rgba(200,210,220,${p.life * 0.5})`);
            grad.addColorStop(1, 'rgba(200,210,220,0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(p.x-cx, p.y-cy, p.sz, 0, Math.PI*2); ctx.fill();
        } else if(p.type === 'rain'){
            ctx.strokeStyle = p.color; ctx.lineWidth = p.sz; ctx.globalAlpha = p.life;
            ctx.beginPath(); ctx.moveTo(p.x-cx, p.y-cy); ctx.lineTo(p.x-cx - p.vx*0.05, p.y-cy - p.vy*0.05); ctx.stroke();
        } else {
            ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=p.color;
            ctx.beginPath(); ctx.arc(p.x-cx, p.y-cy, p.sz, 0, Math.PI*2); ctx.fill();
        }
    }
    ctx.globalAlpha=1;

    if(map.fog > 0){
        // Depth Vignette Fog
        const grad = ctx.createRadialGradient(CW/2, CH/2, CH*0.2, CW/2, CH/2, CW*0.8);
        grad.addColorStop(0, `rgba(5, 7, 10, 0)`);
        grad.addColorStop(1, `rgba(5, 7, 10, ${map.fog})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,CW,CH);
    }
}

// ============ CAMERA ============
const cam={x:0,y:0,mw:0,mh:0, yOffset: 0, yOffsetTarget: 0};
function camFollow(tx,ty,dt){
    const hw=CW/2, hh=CH/2; const dx=60, dy=40;
    
    // Base camera offset: shift camera UP (-Y) so player appears slightly lower on screen
    const baseCamOffY = -50;

    // Film mode: shift camera DOWN so player is visible above the bottom bar,
    // showing more of the world below their feet. Positive = moves view down.
    const filmOffY = filmMode ? FILM_BAR_H * 0.7 : 0;
    
    // Pan camera if holding W or S (works even while walking slowly)
    if(gameState === 'PLAY' && Math.abs(player.vx) < 10) {
        if(keys.u)      cam.yOffsetTarget = -140; // look UP (shorter, not too far)
        else if(keys.d) cam.yOffsetTarget = 140;  // look DOWN
        else            cam.yOffsetTarget = 0;
    } else {
        cam.yOffsetTarget = 0;
    }
    
    // Smooth transition — slower lerp for gentle, cinematic pan
    const panLerp = 3;
    cam.yOffset += (cam.yOffsetTarget - cam.yOffset) * panLerp * dt;
    cam.yOffset = Math.max(-150, Math.min(cam.yOffset, 150));

    let targetX=cam.x, targetY=cam.y;
    const sx=tx-cam.x;
    if(sx<hw-dx)targetX=tx-(hw-dx); else if(sx>hw+dx)targetX=tx-(hw+dx);
    const targetLookY = ty + baseCamOffY + filmOffY + cam.yOffset;
    const sy = targetLookY - cam.y;
    
    if(Math.abs(cam.yOffset) > 1 || Math.abs(cam.yOffsetTarget) > 1) {
        // W/S held OR returning: FORCE camera exactly to target, bypass deadzone to prevent snapping
        targetY = targetLookY - hh;
    } else {
        // Normal follow with deadzone hysteresis
        if(sy<hh-dy) targetY=targetLookY-(hh-dy); else if(sy>hh+dy) targetY=targetLookY-(hh+dy);
    }
    
    cam.x+=(targetX-cam.x)*6*dt; cam.y+=(targetY-cam.y)*6*dt;
    cam.x=Math.max(0,Math.min(cam.x,Math.max(0, cam.mw-CW)));
    
    // Loosen y-clamp to allow looking up/down beyond boundaries
    let minY = baseCamOffY < 0 ? baseCamOffY : 0;
    let maxY = Math.max(0, cam.mh-CH);
    if(cam.yOffset < 0) minY += cam.yOffset;
    if(cam.yOffset > 0) maxY += cam.yOffset;
    
    cam.y=Math.max(minY, Math.min(cam.y, maxY));
}

// ============ MAP ENGINE ============
const TILE_EMPTY=0, TILE_DIRT=1, TILE_STONE=2, TILE_METAL=3, TILE_ICE=4, TILE_GLASS=5;
const TILE_PLAT=6, TILE_SPIKE=7, TILE_BOUNCER=8, TILE_WATER=9, TILE_LAVA=10;

let map={ outdoor:{}, rooms:[], doors:[], pickups:[], enemies:[], decorations:[], spawnX: 60, spawnY: 440, bgY: 0 };
let currentMapIdx = -1; // -1 = outdoor, 0+ = rooms
let activeEnemies = [];
let respawnPoint = {x: 60, y: 440, mapIdx: -1};
let levelList = [];

function getActiveMap(){ return currentMapIdx === -1 ? map.outdoor : map.rooms[currentMapIdx]; }
function isSolidTile(t){ return (t>=1 && t<=5) || t===8; }

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
        document.getElementById('ed-weather').value = map.weather;
    }
    
    map.rooms.forEach(r => { r.w = r.cols*TS; r.h = r.rows*TS; });
    currentMapIdx = -1;
}

function updateAtmosphere(){
    map.fog = parseFloat(document.getElementById('ed-fog').value) || 0;
    map.weather = document.getElementById('ed-weather').value || 'none';
    isMapUnsaved = true;
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
    return d.tiles[r][c];
}

function resizeMap(){
    const nw = parseInt(document.getElementById('map-w-inp').value);
    const nh = parseInt(document.getElementById('map-h-inp').value);
    if(nw && nh && nw>10 && nh>10) {
        const m = getActiveMap();
        const oldC = m.cols, oldR = m.rows;
        m.cols = nw; m.w = nw*TS;
        m.rows = nh; m.h = nh*TS;
        
        if(nh > oldR){
            const diffR = nh - oldR;
            for(let y=0; y<diffR; y++){
                let newRow = [];
                for(let x=0; x<nw; x++) newRow.push(TILE_EMPTY);
                m.tiles.unshift(newRow);
            }
            const diffY = diffR * TS;
            if(currentMapIdx === -1) map.spawnY += diffY;
            map.enemies.forEach(e => { if(e.mapIdx===currentMapIdx) e.y += diffY; });
            map.pickups.forEach(p => { if(p.mapIdx===currentMapIdx) p.y += diffY; });
            map.doors.forEach(d => { if(d.mapIdx===currentMapIdx) d.wy += diffY; });
            map.decorations.forEach(d => { if(d.mapIdx===currentMapIdx) d.y += diffY; });
            
        } else if (nh < oldR) {
            m.tiles.splice(0, oldR - nh);
            const diffY = (oldR - nh) * TS;
            if(currentMapIdx === -1) map.spawnY -= diffY;
            map.enemies.forEach(e => { if(e.mapIdx===currentMapIdx) e.y -= diffY; });
            map.pickups.forEach(p => { if(p.mapIdx===currentMapIdx) p.y -= diffY; });
            map.doors.forEach(d => { if(d.mapIdx===currentMapIdx) d.wy -= diffY; });
            map.decorations.forEach(d => { if(d.mapIdx===currentMapIdx) d.y -= diffY; });
        }
        
        for(let y=0;y<m.rows;y++){
            if(nw > oldC) { for(let x=oldC; x<nw; x++) m.tiles[y][x]=TILE_EMPTY; }
            else { m.tiles[y].length = nw; }
        }
        cam.mw = m.w; cam.mh = m.h;
        isMapUnsaved = true;
        showToast('Map Resized to ' + nw + 'x' + nh);
    }
}

// ============ PHYSICS ============
function moveAndCollide(e,dt){
    e.x+=e.vx*dt; resolveX(e);
    e.y+=e.vy*dt; resolveY(e);
}
function resolveX(e){
    const eps=.01;
    const sc=Math.floor(e.x/TS),ec=Math.floor((e.x+e.w-eps)/TS);
    const sr=Math.floor(e.y/TS),er=Math.floor((e.y+e.h-eps)/TS);
    for(let r=sr;r<=er;r++){
        for(let c=sc;c<=ec;c++){
            if(isSolidTile(mapTile(c,r))){
                if(e.vx>0)e.x=c*TS-e.w; else if(e.vx<0)e.x=(c+1)*TS;
                e.vx=0;
            }
        }
    }
}
function resolveY(e){
    const eps=.01;
    const sc=Math.floor(e.x/TS),ec=Math.floor((e.x+e.w-eps)/TS);
    const sr=Math.floor(e.y/TS),er=Math.floor((e.y+e.h-eps)/TS);
    for(let r=sr;r<=er;r++){
        for(let c=sc;c<=ec;c++){
            const tile=mapTile(c,r);
            if(isSolidTile(tile)){
                if(e.vy>0){
                    e.y=r*TS-e.h;
                    if(tile===TILE_BOUNCER && e===player) { e.vy=-850; e.grounded=false; Audio.door(); } // High bounce
                    else { e.vy=0; e.grounded=true; }
                } else if(e.vy<0) { e.y=(r+1)*TS; e.vy=0; }
            } else if(tile===TILE_PLAT && e.vy>0){
                const prevBot=e.y+e.h-e.vy*.017;
                if(prevBot<=r*TS+4){e.y=r*TS-e.h;e.vy=0;e.grounded=true;}
            } else if(tile===TILE_SPIKE && e===player){
                playerDamage(25);
                if(e.vy>0){e.y=r*TS-e.h;e.vy=-300;}
            } else if(tile===TILE_LAVA && e===player){
                if(player.invT <= 0) {
                    playerDamage(player.maxHp * 0.5); // Damage -50%
                    if(e.vy>0){e.y=r*TS-e.h;e.vy=-300;} // Bounce out slightly
                    for(let i=0; i<15; i++) {
                        particles.push({
                            x: player.x + Math.random()*player.w, 
                            y: player.y + player.h,
                            vx: (Math.random()-0.5)*150, 
                            vy: -Math.random()*200 - 50,
                            life: 1, maxLife: 1,
                            color: Math.random() > 0.5 ? '#ff4400' : '#ffaa00',
                            size: 4 + Math.random()*3
                        });
                    }
                }
            }
        }
    }
}

// ============ LIGHTING ============
let lightCvs,lightCtx;
let ambLightCvs, ambLightCtx;
let lightAngle=0,lightTarget=0,sway=0,swayX=0,swayY=0,flicker=1;
function lightInit(){
    if(!lightCvs) lightCvs=document.createElement('canvas'); 
    lightCvs.width=CW; lightCvs.height=CH;
    lightCtx=lightCvs.getContext('2d', {willReadFrequently: true});

    if(!ambLightCvs) ambLightCvs=document.createElement('canvas');
    ambLightCvs.width=CW/2; ambLightCvs.height=CH/2; 
    ambLightCtx=ambLightCvs.getContext('2d');
}
function lightUpdate(dt,facingRight,aimDir=0){
    if(aimDir === -1) lightTarget = -Math.PI/2;
    else if (aimDir === 1) lightTarget = Math.PI/2;
    else lightTarget=facingRight?0:Math.PI;
    
    let diff=lightTarget-lightAngle;
    while(diff>Math.PI)diff-=Math.PI*2; while(diff<-Math.PI)diff+=Math.PI*2;
    lightAngle+=diff*12*dt; sway+=dt;
    swayX=Math.sin(sway*1.3)*7; swayY=Math.sin(sway*2.1)*4;
    flicker=.93+Math.sin(sway*17)*.03+Math.random()*.02;
}
function lightDraw(ctx,px,py){
    if(!lightCtx) return;
    const lc=lightCtx; 
    let radius=500*flicker; // Increased flashlight distance
    let ambR=radius*.25;

    const sx=px-cam.x+swayX, sy=py-cam.y+swayY;

    lc.globalCompositeOperation='source-over';
    lc.fillStyle=currentMapIdx===-1?'rgba(8,12,20,.85)':'rgba(2,2,3,.98)'; 
    lc.fillRect(0,0,CW,CH);

    lc.globalCompositeOperation='destination-out';

    // Ambient Player Glow (dimmer and smaller)
    ambR = radius*.15; // smaller
    const ag=lc.createRadialGradient(sx,sy,0,sx,sy,ambR);
    ag.addColorStop(0,'rgba(0,0,0,0.42)'); // 50% dimmer
    ag.addColorStop(.6,'rgba(0,0,0,0.15)'); // 50% dimmer
    ag.addColorStop(1,'rgba(0,0,0,0)');
    lc.fillStyle=ag;lc.beginPath();lc.arc(sx,sy,ambR,0,Math.PI*2);lc.fill();

    // Flashlight Raycast
    const cone=Math.PI/2.2;
    lc.save();
    lc.beginPath();
    lc.moveTo(sx, sy);
    const numRays = 240; // High resolution rays to reduce jaggedness
    const maxDepth = 15; // Depth of light penetration into blocks
    for(let i=0; i<=numRays; i++){
        let a = lightAngle - cone/2 + (cone * i / numRays);
        let dist = 0;
        let dx = Math.cos(a), dy = Math.sin(a);
        let hitDepth = 0;
        while(dist < radius) {
            dist += 3; // Small step size for high precision
            let wx = px + dx*dist, wy = py + dy*dist;
            let t = mapTile(Math.floor(wx/TS), Math.floor(wy/TS));
            if(isSolidTile(t) && t !== 8) {
                hitDepth += 3;
                if(hitDepth >= maxDepth) break;
            }
        }
        lc.lineTo(sx + dx*dist, sy + dy*dist);
    }
    lc.lineTo(sx, sy);
    
    // Fill polygon directly with shadow blur and filter to completely smooth out the hard edges
    const bg=lc.createRadialGradient(sx,sy,0,sx,sy,radius);
    bg.addColorStop(0,'rgba(0,0,0,1)');
    bg.addColorStop(.5,'rgba(0,0,0,1)'); // Extended 100% brightness (30% increase in core size)
    bg.addColorStop(.8,'rgba(0,0,0,.5)');
    bg.addColorStop(1,'rgba(0,0,0,0)'); // Fades fully to 0%
    
    // TRUE Blur for buttery smooth edges (eliminates sawtooth)
    lc.filter = 'blur(45px)'; 
    lc.fillStyle=bg;
    lc.fill(); 
    lc.filter = 'none'; // reset
    lc.restore();

    // --- SECONDARY LIGHTS ON OFF-SCREEN CANVAS (FAST AND SOFT) ---
    // Clear the small canvas
    ambLightCtx.clearRect(0,0,ambLightCvs.width,ambLightCvs.height);
    
    // Helper to draw points to ambLightCvs
    const drawPointLight = (lpx, lpy, lightR, alpha, rayCount) => {
        let lx = lpx - cam.x, ly = lpy - cam.y;
        if(lx < -lightR || lx > CW+lightR || ly < -lightR || ly > CH+lightR) return;
        
        let sc = 0.5; // Draw at half resolution for immense performance gain
        let mlx = lx * sc, mly = ly * sc, mR = lightR * sc;

        ambLightCtx.beginPath();
        if(rayCount <= 0) {
            ambLightCtx.arc(mlx, mly, mR, 0, Math.PI*2);
        } else {
            for(let i=0; i<=rayCount; i++) {
                let a = (Math.PI * 2 * i) / rayCount;
                let dist = 0, hitDepth = 0;
                let dx = Math.cos(a), dy = Math.sin(a);
                while(dist < lightR) {
                    dist += 10;
                    let wx = lpx + dx*dist, wy = lpy + dy*dist;
                    let t = mapTile(Math.floor(wx/TS), Math.floor(wy/TS));
                    if(isSolidTile(t) && t !== 8) {
                        hitDepth += 10;
                        if(hitDepth >= 15) break;
                    }
                }
                if(i===0) ambLightCtx.moveTo(mlx + dx*dist*sc, mly + dy*dist*sc);
                else ambLightCtx.lineTo(mlx + dx*dist*sc, mly + dy*dist*sc);
            }
        }
        let dg = ambLightCtx.createRadialGradient(mlx, mly, 0, mlx, mly, mR);
        dg.addColorStop(0, `rgba(255,255,255,${alpha})`);
        dg.addColorStop(0.4, `rgba(255,255,255,${alpha*0.4})`);
        dg.addColorStop(1, `rgba(255,255,255,0)`);
        
        ambLightCtx.fillStyle = dg;
        ambLightCtx.fill();
    };

    // Draw Torches and Lamps Glow
    map.decorations.forEach(d => {
        if(d.mapIdx === currentMapIdx){
            if(d.type==='dec_torch') drawPointLight(d.x+TS/2, d.y+TS/4, 250*flicker, 0.9, 60);
            if(d.type==='dec_lamp') drawPointLight(d.x+TS/2, d.y+TS/4, 350, 0.9, 80);
        }
    });

    // Endgame Door Glow
    map.pickups.forEach(pk => {
        const mIdx = pk.mapIdx !== undefined ? pk.mapIdx : -1;
        if(mIdx === currentMapIdx && pk.t === 'end'){
            drawPointLight(pk.x+TS/2, pk.y+TS/2, 300*flicker, 0.9, 80);
        }
    });

    // Lava Glow
    const cMap = getActiveMap();
    if(cMap) {
        const scl = Math.floor(cam.x/TS);
        const ecl = Math.floor((cam.x+CW)/TS) + 1;
        const srl = Math.floor(cam.y/TS);
        const erl = Math.floor((cam.y+CH)/TS) + 1;
        for(let r=Math.max(0, srl); r<=Math.min(cMap.rows-1, erl); r++){
            for(let c=Math.max(0, scl); c<=Math.min(cMap.cols-1, ecl); c++){
                if(cMap.tiles[r][c] === 8) { // Lava
                    if(r===0 || cMap.tiles[r-1][c] !== 8){
                        drawPointLight(c*TS+TS/2, r*TS+TS/2, 180 + Math.random()*15, 0.85, 30);
                    }
                }
            }
        }
    }

    // Blend the secondary light map into the main light canvas!
    // The browser's native bilinear scaling + a single blur pass makes it incredibly smooth and completely lag-free.
    lc.save();
    lc.globalCompositeOperation = 'destination-out';
    lc.filter = 'blur(18px)';
    lc.drawImage(ambLightCvs, 0, 0, CW, CH);
    lc.restore();

    ctx.drawImage(lightCvs,0,0);
}

// ============ ENTITIES ============
const player={x:0,y:0,w:20,h:32,vx:0,vy:0,grounded:false, right:true,hp:100,maxHp:100,ammo:12,maxAmmo:40, bullets:[],fireCd:0,coyote:0,jbuf:0,invT:0, bobPhase:0, highestY: 0};
let devMode = false;
let devMenuEnabled = false;
let victory = false;

function playerDamage(amt){
    if(devMode || player.invT>0 || gameState!=='PLAY') return;
    player.hp-=amt; player.invT=1; camShake = 15; Audio.hit();
    const fl=document.getElementById('dmg-flash');fl.classList.add('active');setTimeout(()=>fl.classList.remove('active'),100);
    pEmit(player.x+player.w/2,player.y+player.h/2,8,'#ff0000',30,60,200);
    updateHUD();
}
function updateHUD(){
    document.getElementById('hp-bar').style.width=(Math.max(0,player.hp)/player.maxHp*100)+'%';
    document.getElementById('ammo-txt').innerText=player.ammo;
    if(currentMapIdx !== -1) {
        document.getElementById('room-label').innerText = 'Room ' + currentMapIdx;
        document.getElementById('room-label').classList.remove('hidden');
    } else document.getElementById('room-label').classList.add('hidden');
    
    const fl=document.getElementById('dmg-flash');
    if(player.hp <= player.maxHp * 0.2 && player.hp > 0) fl.classList.add('critical');
    else fl.classList.remove('critical');
}

function spawnEnemiesForCurrentMap(){
    activeEnemies = [];
    map.enemies.forEach(e=>{
        const mIdx = e.mapIdx || -1;
        if(mIdx === currentMapIdx) activeEnemies.push({x:e.x, y:e.y, w:26, h:34, vx:0, vy:0, grounded:false, hp:50, dead:false, flash:0, speed:70, patDir:1, patT:0, patI:2+Math.random()*2, state:'patrol', atkCd:0});
    });
}

// ============ RENDER ============
function drawBG(ctx){
    const mode = gameState==='PLAY' ? 'preview' : edViewMode;
    
    if(mode==='flat'){
        ctx.fillStyle='#111'; ctx.fillRect(0,0,CW,CH);
        ctx.save(); ctx.translate(-cam.x%TS, -cam.y%TS);
        ctx.strokeStyle='#222'; ctx.lineWidth=1;
        for(let x=0; x<=CW+TS; x+=TS) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,CH+TS); ctx.stroke(); }
        for(let y=0; y<=CH+TS; y+=TS) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CW+TS,y); ctx.stroke(); }
        ctx.restore();
        return;
    }

    if(currentMapIdx === -1){
        // Sky based on fog
        const skyG = ctx.createLinearGradient(0,0,0,CH);
        skyG.addColorStop(0, map.fog > 0.5 ? '#020305' : '#060814');
        skyG.addColorStop(1, map.fog > 0.5 ? '#0a0c10' : '#141824');
        ctx.fillStyle=skyG; ctx.fillRect(0,0,CW,CH);
        
        // Stars
        if(map.fog < 0.7){
            ctx.fillStyle='rgba(255,255,255,.4)';
            for(let i=0;i<60;i++){
                const sx=((42*(i*73))%1000)/1000*CW, sy=((42*(i*37))%1000)/1000*(CH*.5);
                ctx.globalAlpha=(.3+.7*Math.abs(Math.sin(performance.now()/900+i)))*.4 * (1-map.fog);
                ctx.fillRect(sx,sy,1.5,1.5);
            }
            ctx.globalAlpha=1;
        }

        // Moon
        if(map.fog < 0.9){
            const mx = CW*0.8 - cam.x*0.02; const my = CH*0.2 - cam.y*0.02 + (map.bgY||0);
            ctx.fillStyle = `rgba(255,255,220,${0.8 - map.fog*0.5})`;
            ctx.beginPath(); ctx.arc(mx, my, 40, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = skyG; ctx.beginPath(); ctx.arc(mx-10, my-5, 35, 0, Math.PI*2); ctx.fill(); // Crescent cutout
        }

        const mountBaseY = CH + (map.bgY||0); 

        // Layer 3: Distant Silhouette Mountains
        ctx.fillStyle=`rgba(10,12,16,${0.9 - map.fog*0.2})`;
        const px0=((-cam.x*.05) - 200)%800;
        for(let i=-1;i<5;i++){
            ctx.beginPath();ctx.moveTo(px0+i*800,mountBaseY);
            ctx.lineTo(px0+i*800+400, mountBaseY-500); 
            ctx.lineTo(px0+i*800+800,mountBaseY);ctx.fill();
        }

        // Layer 2: Main Mountains
        ctx.fillStyle=`rgba(15,18,25,${0.95 - map.fog*0.1})`;
        const px1=((-cam.x*.12) - 100)%500; 
        for(let i=-1;i<8;i++){
            ctx.beginPath();ctx.moveTo(px1+i*500,mountBaseY);
            ctx.lineTo(px1+i*500+250, mountBaseY-350); 
            ctx.lineTo(px1+i*500+500,mountBaseY);ctx.fill();
        }
        
        // Layer 1.5: Dense Forest Silhouette
        ctx.fillStyle=`rgba(12,18,15,${0.97 - map.fog*0.05})`;
        const fpx=((-cam.x*.25) - 50)%200;
        for(let i=-2; i<CW/200 + 2; i++){
            for(let j=0; j<5; j++){
                const bx = fpx + i*200 + j*40;
                ctx.beginPath(); ctx.moveTo(bx, mountBaseY);
                ctx.lineTo(bx+20, mountBaseY-120 + (j%3)*20);
                ctx.lineTo(bx+40, mountBaseY); ctx.fill();
            }
        }
        
        // Layer 1: Foreground Trees
        ctx.fillStyle=`rgba(14,11,11,1)`;
        const px2=((-cam.x*.35) - 80)%240; const treeBaseY = CH + (map.bgY||0);
        for(let i=-1;i<10;i++){
            const bx=px2+i*240+60; 
            ctx.fillRect(bx, treeBaseY-260, 14, 260);
            ctx.beginPath();
            ctx.moveTo(bx+7, treeBaseY-160);ctx.lineTo(bx-45, treeBaseY-240);ctx.lineTo(bx-38, treeBaseY-232);
            ctx.moveTo(bx+7, treeBaseY-180);ctx.lineTo(bx+55, treeBaseY-230);ctx.lineTo(bx+48, treeBaseY-222); ctx.fill();
        }
    } else {
        ctx.fillStyle='#111'; ctx.fillRect(0,0,CW,CH);
        ctx.fillStyle='#1a1515';
        const px = (-cam.x*.2)%200;
        for(let i=-1; i<10; i++) ctx.fillRect(px+i*200, 0, 20, CH);
    }
}

function drawDecorations(ctx) {
    const mode = gameState==='PLAY' ? 'preview' : edViewMode;
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    
    map.decorations.forEach(d => {
        if(d.mapIdx !== currentMapIdx) return;
        const x = d.x, y = d.y;
        
        if(d.type==='dec_tree'){
            ctx.fillStyle='#3d2817'; ctx.fillRect(x+15, y-80, 10, 80); // Trunk
            ctx.fillStyle='#1c4a1e'; ctx.beginPath(); ctx.arc(x+20, y-100, 30, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle='#235e26'; ctx.beginPath(); ctx.arc(x+5, y-80, 20, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(x+35, y-75, 25, 0, Math.PI*2); ctx.fill();
        } else if(d.type==='dec_house'){
            ctx.fillStyle='#5c4333'; ctx.fillRect(x-40, y-100, 120, 100); // Body
            ctx.fillStyle='#a63b2e'; ctx.beginPath(); ctx.moveTo(x+20, y-150); ctx.lineTo(x-50, y-100); ctx.lineTo(x+90, y-100); ctx.fill(); // Roof
            ctx.fillStyle='#222'; ctx.fillRect(x-5, y-40, 25, 40); // Door
            ctx.fillStyle='#ffd700'; ctx.fillRect(x+15, y-20, 4, 4); // Knob
            ctx.fillStyle='#add8e6'; ctx.fillRect(x-25, y-80, 20, 20); ctx.fillRect(x+45, y-80, 20, 20); // Windows
        } else if(d.type==='dec_grass'){
            ctx.fillStyle='#3c8c40'; ctx.beginPath(); 
            ctx.moveTo(x+5,y); ctx.lineTo(x+15,y-20); ctx.lineTo(x+18,y); 
            ctx.moveTo(x+20,y); ctx.lineTo(x+25,y-15); ctx.lineTo(x+30,y); ctx.fill();
        } else if(d.type==='dec_torch'){
            ctx.fillStyle='#553311'; ctx.fillRect(x+16, y, 8, 30);
            ctx.fillStyle='#ff8800'; ctx.beginPath(); ctx.arc(x+20, y-5+Math.sin(performance.now()/100)*3, 8, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle='#ffff00'; ctx.beginPath(); ctx.arc(x+20, y-5+Math.sin(performance.now()/100)*3, 4, 0, Math.PI*2); ctx.fill();
        } else if(d.type==='dec_lamp'){
            ctx.fillStyle='#222'; ctx.fillRect(x+18, y, 4, 40); // Pole
            ctx.fillRect(x+10, y-10, 20, 10); // Base
            ctx.fillStyle='#e0ffff'; ctx.beginPath(); ctx.arc(x+20, y, 6, 0, Math.PI*2); ctx.fill(); // Bulb
        } else if(d.type==='dec_car'){
            ctx.fillStyle='#2a4b7c'; ctx.fillRect(x-30, y-30, 100, 30); // Body
            ctx.fillRect(x-10, y-55, 60, 25); // Top
            ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(x-5, y, 15, 0, Math.PI*2); ctx.arc(x+45, y, 15, 0, Math.PI*2); ctx.fill(); // Wheels
            ctx.fillStyle='#add8e6'; ctx.fillRect(x+30, y-50, 15, 15); // Window
        }
    });
    ctx.restore();
}

function drawTiles(ctx){
    const d = getActiveMap();
    const mode = gameState==='PLAY' ? 'preview' : edViewMode;
    const sc=Math.max(0,Math.floor(cam.x/TS)), ec=Math.min(d.cols-1,sc+Math.ceil(CW/TS)+1);
    const sr=Math.max(0,Math.floor(cam.y/TS)), er=Math.min(d.rows-1,sr+Math.ceil(CH/TS)+1);
    
    drawDecorations(ctx);

    ctx.save();ctx.translate(-cam.x,-cam.y);
    for(let r=sr;r<=er;r++){
        for(let c=sc;c<=ec;c++){
            const t=d.tiles[r][c];
            if(t===TILE_EMPTY) continue;
            
            const px=c*TS, py=r*TS; let drawH = (r === d.rows-1) ? CH : TS;
            if(t===TILE_DIRT){
                ctx.fillStyle=mode==='flat'?'#555':(currentMapIdx===-1?'#382b20':'#2c2420'); ctx.fillRect(px, py, TS, drawH);
                if(mode!=='flat'){ctx.fillStyle='#4c3d2e'; ctx.fillRect(px,py,TS,6);}
            }else if(t===TILE_STONE){
                ctx.fillStyle=mode==='flat'?'#777':'#444'; ctx.fillRect(px,py,TS,drawH);
                if(mode!=='flat'){ctx.strokeStyle='#333';ctx.lineWidth=1;ctx.strokeRect(px+.5,py+.5,TS-1,TS-1);}
            }else if(t===TILE_METAL){
                ctx.fillStyle=mode==='flat'?'#999':'#67727a'; ctx.fillRect(px,py,TS,drawH);
                if(mode!=='flat'){ctx.strokeStyle='#8c959c';ctx.lineWidth=2;ctx.strokeRect(px+2,py+2,TS-4,TS-4);}
            }else if(t===TILE_ICE){
                ctx.fillStyle=mode==='flat'?'#8cf':'rgba(140,200,255,0.7)'; ctx.fillRect(px,py,TS,drawH);
                if(mode!=='flat'){ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillRect(px,py,TS,4);}
            }else if(t===TILE_GLASS){
                ctx.fillStyle=mode==='flat'?'#dde':'rgba(200,220,230,0.4)'; ctx.fillRect(px,py,TS,drawH);
                if(mode!=='flat'){ctx.strokeStyle='rgba(255,255,255,0.5)';ctx.lineWidth=1;ctx.strokeRect(px,py,TS,TS); ctx.beginPath();ctx.moveTo(px+TS,py);ctx.lineTo(px,py+TS);ctx.stroke();}
            }else if(t===TILE_PLAT){
                ctx.fillStyle=mode==='flat'?'#b55':'#4a3320';ctx.fillRect(px,py,TS,10);
                if(mode!=='flat'){ctx.fillStyle='#332010';ctx.fillRect(px,py,TS,3);}
            }else if(t===TILE_SPIKE){
                ctx.fillStyle=mode==='flat'?'#f00':'#888';
                ctx.beginPath(); ctx.moveTo(px, py+TS); ctx.lineTo(px+TS/2, py+5); ctx.lineTo(px+TS, py+TS); ctx.fill();
            }else if(t===TILE_BOUNCER){
                ctx.fillStyle=mode==='flat'?'#f0f':'#c0c'; ctx.fillRect(px,py+TS-15,TS,15);
                if(mode!=='flat'){ctx.fillStyle='#e3e'; ctx.fillRect(px+5,py+TS-20,TS-10,5);}
            }else if(t===TILE_WATER){
                ctx.fillStyle=mode==='flat'?'#00f':'rgba(30,100,200,0.6)'; ctx.fillRect(px,py,TS,drawH);
                if(mode!=='flat' && r>0 && d.tiles[r-1][c]!==TILE_WATER){
                    ctx.fillStyle='rgba(255,255,255,0.3)';
                    ctx.beginPath();
                    for(let w=0; w<=TS; w+=8) {
                        ctx.arc(px+w, py+2+Math.sin(performance.now()/200 + (px+w)*0.05)*3, 2, 0, Math.PI*2);
                    }
                    ctx.fill();
                }
            }else if(t===TILE_LAVA){
                ctx.fillStyle=mode==='flat'?'#f50':'rgba(220,50,0,0.9)'; ctx.fillRect(px,py,TS,drawH);
                if(mode!=='flat'){ctx.fillStyle='rgba(255,200,0,0.6)'; ctx.fillRect(px,py,TS,4);}
            }
        }
    }
    
    const now=performance.now()/1000;
    
    // Pickups
    for(const pk of map.pickups){
        const mIdx = pk.mapIdx || -1;
        if(mIdx !== currentMapIdx) continue;
        if(pk.got && gameState!=='EDITOR')continue;
        const bob=Math.sin(now*2+pk.x)*4;
        
        if(pk.t==='ammo'){
            ctx.fillStyle='#c8a000';ctx.fillRect(pk.x+14,pk.y+10+bob,12,18);
            ctx.fillStyle='#ffee88';ctx.fillRect(pk.x+14,pk.y+10+bob,12,4);
        }else if(pk.t==='hp'){
            ctx.fillStyle='#cc0000';ctx.beginPath();ctx.arc(pk.x+TS/2,pk.y+TS/2+bob,9,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#ff6666';ctx.beginPath();ctx.arc(pk.x+TS/2-3,pk.y+TS/2-3+bob,3,0,Math.PI*2);ctx.fill();
        }else if(pk.t==='check'){
            ctx.fillStyle='#555';ctx.fillRect(pk.x+TS/2-2,pk.y,4,TS);
            ctx.fillStyle=pk.got?'#0f0':'#777'; ctx.beginPath();ctx.moveTo(pk.x+TS/2,pk.y);ctx.lineTo(pk.x+TS,pk.y+8);ctx.lineTo(pk.x+TS/2,pk.y+16);ctx.fill();
        }else if(pk.t==='end'){
            ctx.fillStyle='#ddaa00'; ctx.fillRect(pk.x+5, pk.y, TS-10, TS);
            ctx.fillStyle='#ffcc00'; ctx.fillText('🏆', pk.x+8, pk.y+TS/2);
        }
    }

    // Doors
    for(const dr of map.doors){
        const mIdx = dr.mapIdx || -1;
        if(mIdx !== currentMapIdx) continue;
        ctx.fillStyle='#1a0f0a';ctx.fillRect(dr.wx-TS/2,dr.wy-TS*2,TS*2,TS*2.5);
        ctx.fillStyle='#0d0906';ctx.fillRect(dr.wx,dr.wy-TS*1.5,TS,TS*1.8);
        ctx.strokeStyle='#3d2a1a';ctx.lineWidth=3;ctx.strokeRect(dr.wx-TS/2,dr.wy-TS*2,TS*2,TS*2.5);
        if(gameState==='EDITOR'){
            ctx.fillStyle='#fff';ctx.font='12px monospace';
            ctx.fillText(dr.targetRoom===-1?'To Out':'To Rm '+(dr.targetRoom+1), dr.wx-15, dr.wy-TS*2-5);
        }
    }

    // Spawn Point in Editor
    if(gameState==='EDITOR' && currentMapIdx === -1){
        ctx.fillStyle='#fff';ctx.fillRect(map.spawnX, map.spawnY, 20, 32);
        ctx.fillStyle='#f00';ctx.font='16px monospace';ctx.fillText('🚩', map.spawnX, map.spawnY-5);
    }
    
    // Editor Selection Highlight
    if(gameState==='EDITOR' && edTool==='select'){
        ctx.fillStyle='rgba(0,150,255,0.4)';
        for(let r=0; r<d.rows; r++){
            for(let c=0; c<d.cols; c++){
                if(edSel.grid[r] && edSel.grid[r][c]) ctx.fillRect(c*TS, r*TS, TS, TS);
            }
        }
        ctx.strokeStyle='#00ffff'; ctx.lineWidth=2;
        edSel.entities.forEach(en=>{
            if(en.type==='enemy') ctx.strokeRect(en.ref.x, en.ref.y, 26, 34);
            else if(en.type==='pickup') ctx.strokeRect(en.ref.x, en.ref.y, TS, TS);
            else if(en.type==='decor') ctx.strokeRect(en.ref.x-10, en.ref.y-10, TS+20, TS+20);
            else if(en.type==='door') ctx.strokeRect(en.ref.wx-TS/2, en.ref.wy-TS*2, TS*2, TS*2.5);
            else if(en.type==='spawn') ctx.strokeRect(map.spawnX, map.spawnY, 20, 32);
        });
        
        if(edSel.active && edSel.rect){
            ctx.strokeStyle='rgba(0,255,255,0.8)'; ctx.lineWidth=1;
            ctx.strokeRect(edSel.rect.x, edSel.rect.y, edSel.rect.w, edSel.rect.h);
        }
    }
    
    ctx.restore();
}

function drawPlayer(ctx){
    const p=player; const sx=p.x-cam.x, sy=p.y-cam.y;
    if(p.invT>0&&Math.floor(performance.now()/80)%2===0)return;
    ctx.save();ctx.translate(sx,sy);
    ctx.fillStyle='#888';ctx.fillRect(0,8,p.w,p.h-8); 
    ctx.fillStyle='#aaa';ctx.fillRect(3,0,p.w-6,12); 
    ctx.fillStyle='#fff';
    if(p.right){ctx.fillRect(p.w-8,2,4,4);ctx.fillStyle='#000';ctx.fillRect(p.w-7,3,2,2);}
    else{ctx.fillRect(4,2,4,4);ctx.fillStyle='#000';ctx.fillRect(5,3,2,2);}
    ctx.fillStyle='#4a3a28';ctx.fillRect(0,12,p.w,12); 
    ctx.fillStyle='#2a2a2a'; 
    const bob=p.grounded&&Math.abs(p.vx)>10?Math.sin(p.bobPhase)*4:0;
    ctx.fillRect(2,24,7,8-bob);ctx.fillRect(p.w-9,24,7,8+bob);
    const gx=p.right?p.w:-16;
    ctx.fillStyle='#555';ctx.fillRect(gx,p.h/2-2,16,5); 
    ctx.fillStyle='#333';ctx.fillRect(p.right?gx+12:gx,p.h/2-1,5,3);
    ctx.restore();
    ctx.fillStyle='#ffee00'; 
    for(const b of p.bullets){ctx.beginPath();ctx.arc(b.x-cam.x,b.y-cam.y,3,0,Math.PI*2);ctx.fill();}
}

function drawEnemy(ctx,e){
    if(e.dead && gameState!=='EDITOR')return;
    const dist=Math.abs((e.x+e.w/2)-(player.x+player.w/2));
    if(dist>400 && gameState!=='EDITOR')return;
    const alpha=gameState==='EDITOR'?1:Math.min(1,(400-dist)/200);
    ctx.save(); ctx.translate(e.x-cam.x,e.y-cam.y); ctx.globalAlpha=alpha*(e.state==='chase'?.85:.45);
    ctx.fillStyle=e.flash>.1?'#ff5500':'#4a0a0a'; ctx.fillRect(0,0,e.w,e.h);
    ctx.fillStyle=e.flash>.1?'#ff8800':'#6a0f0f'; ctx.beginPath();
    const wave=Math.sin(performance.now()/200+e.x)*3;
    ctx.ellipse(e.w/2,-5+wave,e.w/2-2,9,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ff0000';ctx.globalAlpha=alpha;
    ctx.beginPath();ctx.arc(e.w/2-5,e.h/3,3,0,Math.PI*2);ctx.arc(e.w/2+5,e.h/3,3,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#880000';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,e.h-5);ctx.lineTo(-5,e.h+4);ctx.moveTo(e.w,e.h-5);ctx.lineTo(e.w+5,e.h+4);ctx.stroke();
    ctx.globalAlpha=1;
    if(e.hp<50){ctx.fillStyle='#400000';ctx.fillRect(0,-8,e.w,3);ctx.fillStyle='#cc0000';ctx.fillRect(0,-8,e.w*(e.hp/50),3);}
    ctx.restore();
}

// ============ API ============
async function fetchLevels(mode){
    try {
        const res = await fetch('api.php?action=list');
        const json = await res.json();
        const list = document.getElementById(mode==='play'?'play-level-list':'edit-level-list');
        list.innerHTML = '';
        if(json.success && json.levels.length>0){
            levelList = json.levels;
            json.levels.forEach(l=>{
                const d = document.createElement('div'); d.className='level-item';
                if(mode==='play'){
                    d.innerHTML = `<span>${l.name}</span> <div class="actions"><button class="ed-btn" onclick="playLevel(${l.id})">▶ Play</button></div>`;
                } else {
                    d.innerHTML = `<span>${l.name}</span> <div class="actions">
                        <button class="ed-btn" onclick="duplicateLevel(${l.id})">📑 Duplicate</button>
                        <button class="ed-btn" onclick="loadEditorLevel(${l.id})">✏️ Edit</button>
                    </div>`;
                }
                list.appendChild(d);
            });
        } else { list.innerHTML = '<div style="color:#666">No levels found.</div>'; }
    } catch(e){ console.error(e); }
}

async function playLevel(id){
    try {
        const res = await fetch(`api.php?action=load&id=${id}`);
        const json = await res.json();
        if(json.success){
            transitionTo(() => {
                currentLevelId = json.level.id;
                loadMapData(json.level.data);
                respawnPoint = {x: map.spawnX, y: map.spawnY, mapIdx: -1};
                startGameplay();
            });
        }
    } catch(e) { showToast('Error loading level'); }
}
function restartLevel(){
    transitionTo(() => {
        map.pickups.forEach(p=>p.got=0);
        startGameplay(true); // resetAll = true to reset HP
    });
}
function playNextLevel(){
    let idx = levelList.findIndex(l => l.id === currentLevelId);
    if(idx !== -1 && idx < levelList.length - 1){
        playLevel(levelList[idx+1].id);
    } else {
        showToast("No more levels! Back to menu.");
        transitionTo('level-select');
    }
}

async function loadEditorLevel(id, duplicate=false){
    try {
        const res = await fetch(`api.php?action=load&id=${id}`);
        const json = await res.json();
        if(json.success){
            transitionTo(() => {
                loadMapData(json.level.data);
                if(duplicate){
                    currentLevelId = null;
                    document.getElementById('level-name-input').value = json.level.name + ' (Copy)';
                } else {
                    currentLevelId = json.level.id;
                    document.getElementById('level-name-input').value = json.level.name;
                }
                startEditor();
            });
        }
    } catch(e) { showToast('Error loading level'); }
}
function duplicateLevel(id){ loadEditorLevel(id, true); }
function createNewLevel(){
    currentLevelId = null;
    initEmptyMap(100);
    document.getElementById('level-name-input').value = 'New Level';
    startEditor();
}

async function saveLevel(){
    const name = document.getElementById('level-name-input').value;
    const data = {
        cols: map.outdoor.cols, rows: map.outdoor.rows,
        tiles: map.outdoor.tiles,
        rooms: map.rooms,
        pickups: map.pickups,
        doors: map.doors,
        enemies: map.enemies,
        decorations: map.decorations,
        spawnX: map.spawnX, spawnY: map.spawnY,
        bgY: map.bgY
    };
    try {
        const res = await fetch('api.php?action=save', {
            method:'POST', body: JSON.stringify({id: currentLevelId, name, data})
        });
        const json = await res.json();
        if(json.success){
            currentLevelId = json.id;
            isMapUnsaved = false;
        }
        return true;
    } catch(e){ showToast('Error saving level'); return false; }
}

async function saveAndPlay(){
    const ok = await saveLevel();
    if(ok){
        stopEditor();
        respawnPoint = {x: map.spawnX, y: map.spawnY, mapIdx: -1};
        startGameplay();
    }
}

function attemptExitEditor(){
    if(isMapUnsaved){
        const c = confirm("You have unsaved changes! Click OK to Save & Exit, or Cancel to keep editing.");
        if(c){
            saveLevel().then(() => { setMenu('main-menu'); stopEditor(); });
        }
    } else {
        setMenu('main-menu'); stopEditor();
    }
}

// ============ EDITOR ============
let edTool = 1; 
let edViewMode = 'flat'; 
let edMouseX=0, edMouseY=0, edMouseDown=false, edRightDown=false;
let edSel = { active: false, startX: 0, startY: 0, rect: null, grid: [], entities: [], isDragging: false, dragStartX: 0, dragStartY: 0 };

function toggleEditorRibbon(){ document.getElementById('ribbon-content').classList.toggle('hidden'); }
function setEdTool(t){
    edTool = t;
    document.querySelectorAll('.editor-ribbon .ed-btn').forEach(b=>b.classList.remove('active'));
    event.target.classList.add('active');
    edSel.grid = []; edSel.entities = []; edSel.rect = null;
}
function changeViewMode(m){ edViewMode = m; }

function updateEditorMapDropdown(){
    const sel = document.getElementById('ed-map-select');
    sel.innerHTML = `<option value="-1">Outdoor</option>`;
    map.rooms.forEach((r,i)=>{ sel.innerHTML += `<option value="${i}">Room ${i+1}</option>`; });
    sel.value = currentMapIdx;
}
function changeEditorMap(val){
    currentMapIdx = parseInt(val);
    const m = getActiveMap();
    cam.mw = m.w; cam.mh = m.h + CH/2; cam.x=0; cam.y=0;
    document.getElementById('map-w-inp').value = m.cols;
    document.getElementById('map-h-inp').value = m.rows;
    document.getElementById('bg-y-inp').value = map.bgY || 0;
    spawnEnemiesForCurrentMap();
    edSel.grid = []; edSel.entities = []; edSel.rect = null;
}
function addEditorRoom(){
    map.rooms.push(makeEmptyMapData(30, 20));
    updateEditorMapDropdown();
    changeEditorMap(map.rooms.length - 1);
    isMapUnsaved = true;
}

function startEditor(){
    setMenu('editor-ui');
    currentMapIdx = -1;
    updateEditorMapDropdown();
    cam.mw = map.outdoor.w; cam.mh = map.outdoor.h + CH/2;
    player.x = map.spawnX; player.y = map.spawnY;
    document.getElementById('map-w-inp').value = map.outdoor.cols;
    document.getElementById('map-h-inp').value = map.outdoor.rows;
    document.getElementById('bg-y-inp').value = map.bgY || 0;
    document.getElementById('ed-view-mode').value = edViewMode;
    isMapUnsaved = false;
    edSel.grid = []; edSel.entities = []; edSel.rect = null;
    spawnEnemiesForCurrentMap();
}
function stopEditor(){ }

// ============ EDITOR ADVANCED TOOLS ============
function processSelectionBox(rect){
    const d = getActiveMap();
    edSel.grid = []; edSel.entities = [];
    
    const sc = Math.max(0, Math.floor(rect.x/TS));
    const ec = Math.min(d.cols-1, Math.floor((rect.x+rect.w)/TS));
    const sr = Math.max(0, Math.floor(rect.y/TS));
    const er = Math.min(d.rows-1, Math.floor((rect.y+rect.h)/TS));
    
    for(let r=sr; r<=er; r++){
        edSel.grid[r] = [];
        for(let c=sc; c<=ec; c++){
            if(d.tiles[r][c] !== TILE_EMPTY) edSel.grid[r][c] = d.tiles[r][c];
        }
    }
    
    map.enemies.forEach(en => { if(en.mapIdx===currentMapIdx && en.x>=rect.x && en.x<=rect.x+rect.w && en.y>=rect.y && en.y<=rect.y+rect.h) edSel.entities.push({type:'enemy', ref:en, ox:en.x, oy:en.y}); });
    map.pickups.forEach(pk => { if(pk.mapIdx===currentMapIdx && pk.x>=rect.x && pk.x<=rect.x+rect.w && pk.y>=rect.y && pk.y<=rect.y+rect.h) edSel.entities.push({type:'pickup', ref:pk, ox:pk.x, oy:pk.y}); });
    map.doors.forEach(dr => { if(dr.mapIdx===currentMapIdx && dr.wx>=rect.x && dr.wx<=rect.x+rect.w && dr.wy>=rect.y && dr.wy<=rect.y+rect.h) edSel.entities.push({type:'door', ref:dr, ox:dr.wx, oy:dr.wy}); });
    map.decorations.forEach(dc => { if(dc.mapIdx===currentMapIdx && dc.x>=rect.x && dc.x<=rect.x+rect.w && dc.y>=rect.y && dc.y<=rect.y+rect.h) edSel.entities.push({type:'decor', ref:dc, ox:dc.x, oy:dc.y}); });
    
    if(currentMapIdx === -1 && map.spawnX >= rect.x && map.spawnX <= rect.x+rect.w && map.spawnY >= rect.y && map.spawnY <= rect.y+rect.h){
        edSel.entities.push({type: 'spawn', ref: null, ox: map.spawnX, oy: map.spawnY});
    }
}

function applyMoveSelection(dx, dy){
    const d = getActiveMap();
    const dc = Math.round(dx/TS);
    const dr = Math.round(dy/TS);
    if(dc===0 && dr===0) return; 
    
    for(let r=0; r<d.rows; r++){ if(edSel.grid[r]) for(let c=0; c<d.cols; c++) { if(edSel.grid[r][c]) d.tiles[r][c] = TILE_EMPTY; } }
    let newGrid = [];
    for(let r=0; r<d.rows; r++){
        if(!edSel.grid[r]) continue;
        for(let c=0; c<d.cols; c++){
            if(edSel.grid[r][c]){
                const nr = r + dr; const nc = c + dc;
                if(nr>=0 && nr<d.rows && nc>=0 && nc<d.cols){
                    d.tiles[nr][nc] = edSel.grid[r][c];
                    if(!newGrid[nr]) newGrid[nr] = [];
                    newGrid[nr][nc] = edSel.grid[r][c];
                }
            }
        }
    }
    edSel.grid = newGrid;
    edSel.entities.forEach(en => {
        if(['enemy','pickup','decor'].includes(en.type)) { en.ref.x += dc*TS; en.ref.y += dr*TS; en.ox = en.ref.x; en.oy = en.ref.y; }
        else if(en.type==='door') { en.ref.wx += dc*TS; en.ref.wy += dr*TS; en.ox = en.ref.wx; en.oy = en.ref.wy; }
        else if(en.type==='spawn') { map.spawnX += dc*TS; map.spawnY += dr*TS; en.ox = map.spawnX; en.oy = map.spawnY; }
    });
    isMapUnsaved = true; spawnEnemiesForCurrentMap();
}

function deleteSelection(){
    const d = getActiveMap();
    for(let r=0; r<d.rows; r++){ if(edSel.grid[r]) for(let c=0; c<d.cols; c++) { if(edSel.grid[r][c]) d.tiles[r][c] = TILE_EMPTY; } }
    
    edSel.entities.forEach(en => {
        if(en.type==='enemy') map.enemies = map.enemies.filter(x => x !== en.ref);
        else if(en.type==='pickup') map.pickups = map.pickups.filter(x => x !== en.ref);
        else if(en.type==='door') map.doors = map.doors.filter(x => x !== en.ref);
        else if(en.type==='decor') map.decorations = map.decorations.filter(x => x !== en.ref);
    });
    edSel.grid = []; edSel.entities = []; edSel.rect = null;
    spawnEnemiesForCurrentMap();
}

function handleEditorClick(cx, cy, isErase=false){
    const d = getActiveMap();
    const col = Math.floor(cx/TS), row = Math.floor(cy/TS);
    if(col<0||col>=d.cols||row<0||row>=d.rows) return;

    if(isErase || edTool===0){
        d.tiles[row][col] = 0;
        map.enemies = map.enemies.filter(e => e.mapIdx!==currentMapIdx || Math.abs(e.x-cx)>20 || Math.abs(e.y-cy)>20);
        map.pickups = map.pickups.filter(e => e.mapIdx!==currentMapIdx || Math.abs(e.x-cx)>20 || Math.abs(e.y-cy)>20);
        map.doors = map.doors.filter(e => e.mapIdx!==currentMapIdx || Math.abs(e.wx-cx)>40 || Math.abs(e.wy-cy)>40);
        map.decorations = map.decorations.filter(e => e.mapIdx!==currentMapIdx || Math.abs(e.x-cx)>40 || Math.abs(e.y-cy)>40);
        isMapUnsaved = true;
        spawnEnemiesForCurrentMap();
        return;
    }

    if(typeof edTool === 'number'){
        d.tiles[row][col] = edTool;
        isMapUnsaved = true;
    } else if (edTool !== 'select') {
        isMapUnsaved = true;
        if(edTool==='spawn'){
            if(currentMapIdx !== -1){ showToast("Spawn must be Outdoor!"); return; }
            map.spawnX = col*TS; map.spawnY = row*TS; player.x=map.spawnX; player.y=map.spawnY;
        } else if (edTool==='enemy'){
            map.enemies.push({x: col*TS, y: row*TS, mapIdx: currentMapIdx});
            spawnEnemiesForCurrentMap();
        } else if (['ammo','hp','check','end'].includes(edTool)){
            map.pickups.push({t: edTool, x: col*TS, y: row*TS, mapIdx: currentMapIdx});
        } else if (edTool==='door'){
            let tgt = parseInt(prompt("Enter Target Room ID (0 for Room 1, 1 for Room 2, etc). Type -1 for Outdoor.", "0"));
            if(!isNaN(tgt)){
                map.doors.push({wx: col*TS + TS/2, wy: (row+1)*TS, ri:0, mapIdx: currentMapIdx, targetRoom: tgt});
            }
        } else if (edTool.startsWith('dec_')) {
            map.decorations.push({type: edTool, x: col*TS, y: (row+1)*TS, mapIdx: currentMapIdx});
        }
    }
}

const canvas=document.getElementById('gameCanvas');
function resizeWindow(){
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';

    const scaleX = (window.innerWidth * dpr) / INTERNAL_W;
    const scaleY = (window.innerHeight * dpr) / INTERNAL_H;
    DRAW_SCALE = Math.min(scaleX, scaleY);
    DRAW_OFFSET_X = ((window.innerWidth * dpr) - (INTERNAL_W * DRAW_SCALE)) / 2;
    DRAW_OFFSET_Y = ((window.innerHeight * dpr) - (INTERNAL_H * DRAW_SCALE)) / 2;
    lightInit();
}
window.addEventListener('resize', resizeWindow);
resizeWindow();

function getMousePos(e){
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    // Convert CSS pixels → canvas pixels → game units
    const canvasX = cssX * dpr;
    const canvasY = cssY * dpr;
    const mx = (canvasX - DRAW_OFFSET_X) / DRAW_SCALE;
    const my = (canvasY - DRAW_OFFSET_Y) / DRAW_SCALE;
    return {mx, my};
}

canvas.addEventListener('mousemove', e=>{
    const pos = getMousePos(e);
    const dx = pos.mx - edMouseX; const dy = pos.my - edMouseY;
    edMouseX = pos.mx; edMouseY = pos.my;
    
    if(gameState==='EDITOR'){
        if(edRightDown){ 
            cam.x -= dx; cam.y -= dy;
            cam.x=Math.max(0,Math.min(cam.x,cam.mw-CW)); cam.y=Math.max(0,Math.min(cam.y,cam.mh-CH));
        } else if (edMouseDown && typeof edTool === 'number') {
            handleEditorClick(edMouseX + cam.x, edMouseY + cam.y);
        } else if (edTool === 'select'){
            if(edSel.isDragging){
                const dX = (edMouseX + cam.x) - edSel.dragStartX;
                const dY = (edMouseY + cam.y) - edSel.dragStartY;
                edSel.entities.forEach(en => {
                    if(['enemy','pickup','decor'].includes(en.type)) { en.ref.x = en.ox + dX; en.ref.y = en.oy + dY; }
                    else if(en.type==='door') { en.ref.wx = en.ox + dX; en.ref.wy = en.oy + dY; }
                    else if(en.type==='spawn') { map.spawnX = en.ox + dX; map.spawnY = en.oy + dY; }
                });
            } else if (edSel.active){
                const curX = edMouseX + cam.x; const curY = edMouseY + cam.y;
                edSel.rect = {
                    x: Math.min(edSel.startX, curX), y: Math.min(edSel.startY, curY),
                    w: Math.abs(edSel.startX - curX), h: Math.abs(edSel.startY - curY)
                };
            }
        }
    }
});
canvas.addEventListener('mousedown', e=>{
    const pos = getMousePos(e);
    if(gameState==='EDITOR'){
        if(e.button===2 || e.button===1){ edRightDown=true; } 
        else { 
            edMouseDown=true; 
            if(edTool === 'select'){
                const cx = pos.mx + cam.x; const cy = pos.my + cam.y;
                let insideSelection = false;
                if(edSel.rect && cx >= edSel.rect.x && cx <= edSel.rect.x+edSel.rect.w && cy >= edSel.rect.y && cy <= edSel.rect.y+edSel.rect.h) insideSelection = true;
                
                if(insideSelection){
                    edSel.isDragging = true;
                    edSel.dragStartX = cx; edSel.dragStartY = cy;
                } else {
                    edSel.active = true; edSel.startX = cx; edSel.startY = cy;
                    edSel.rect = null; edSel.grid = []; edSel.entities = [];
                }
            } else { handleEditorClick(pos.mx + cam.x, pos.my + cam.y, e.shiftKey); }
        }
    }
});
canvas.addEventListener('mouseup', e=>{ 
    if(e.button===2||e.button===1) edRightDown=false; 
    else {
        edMouseDown=false;
        if(gameState==='EDITOR' && edTool === 'select'){
            if(edSel.isDragging){
                const pos = getMousePos(e);
                const dx = (pos.mx + cam.x) - edSel.dragStartX;
                const dy = (pos.my + cam.y) - edSel.dragStartY;
                applyMoveSelection(dx, dy);
                edSel.isDragging = false;
                if(edSel.rect) {
                    const snapX = Math.round(dx/TS)*TS; const snapY = Math.round(dy/TS)*TS;
                    edSel.rect.x += snapX; edSel.rect.y += snapY;
                }
            } else if (edSel.active){
                edSel.active = false;
                if(edSel.rect) processSelectionBox(edSel.rect);
            }
        }
    }
});
canvas.addEventListener('contextmenu', e=>e.preventDefault());
canvas.addEventListener('wheel', e=>{
    if(gameState==='EDITOR'){
        if(e.shiftKey || e.altKey) { 
            cam.y += e.deltaY; cam.y=Math.max(0,Math.min(cam.y,cam.mh-CH)); 
        } else { 
            if(Math.abs(e.deltaX) > 0) cam.x += e.deltaX;
            else cam.x += e.deltaY;
            cam.x=Math.max(0,Math.min(cam.x,cam.mw-CW)); 
        }
        e.preventDefault();
    }
}, {passive: false});

// ============ MAIN LOOP ============
const ctx=canvas.getContext('2d');
let lastT=0, gameOver=false;

function startGameplay(resetAll=true){
    setMenu('game'); gameOver=false; victory=false;
    devMode = false; // Always start fresh — P to toggle if devMenuEnabled
    canvas.style.filter = _baseCanvasFilter; // Ensure no grayscale on start
    currentMapIdx = respawnPoint.mapIdx;
    
    player.x = respawnPoint.x; player.y = respawnPoint.y;
    player.vx=0; player.vy=0; 
    if(resetAll){ player.hp=player.maxHp; player.ammo=12; }
    player.invT=2; // 2 seconds of spawn invincibility
    player.bullets=[]; 
    particles.length=0;
    camShake = 0;
    camZoom = 1.4; camZoomTarget = 1.4; zoomState = 1;
    
    const m = getActiveMap();
    cam.mw = m.w; cam.mh = m.h + CH/2;
    camFollow(player.x, player.y, 100);
    spawnEnemiesForCurrentMap();
    updateHUD();
}

function updatePlay(dt){
    if(gameOver || victory) return;

    if(devMode){
        const flySpd=500; player.vx=0; player.vy=0;
        if(keys.l){player.x-=flySpd*dt;player.right=false;}
        if(keys.r){player.x+=flySpd*dt;player.right=true;}
        if(keys.u)player.y-=flySpd*dt;
        if(keys.d)player.y+=flySpd*dt;
        player.grounded=true;
    } else {
        let isIce = false, isWater = false;
        const col = Math.floor((player.x+player.w/2)/TS);
        const rowBelow = Math.floor((player.y+player.h+2)/TS);
        const rowCenter = Math.floor((player.y+player.h/2)/TS);
        
        if(player.grounded && mapTile(col, rowBelow) === TILE_ICE) isIce = true;
        if(mapTile(col, rowCenter) === TILE_WATER) isWater = true;
        
        // Splash effect when entering water
        if(isWater && !player.wasInWater) {
            for(let i=0; i<15; i++) {
                particles.push({
                    x: player.x + Math.random()*player.w, 
                    y: player.y + player.h/2,
                    vx: (Math.random()-0.5)*100, 
                    vy: -Math.random()*150 - 50,
                    life: 0.8, maxLife: 0.8,
                    color: 'rgba(200, 230, 255, 0.8)',
                    size: 3 + Math.random()*3
                });
            }
        }
        player.wasInWater = isWater;
        
        // Bubbles while swimming
        if (isWater && Math.abs(player.vx) > 10 && Math.random() < 0.1) {
            particles.push({
                x: player.x + Math.random()*player.w, 
                y: player.y + player.h/2 + Math.random()*10,
                vx: -player.vx * 0.1, 
                vy: -Math.random()*20,
                life: 1, maxLife: 1,
                color: 'rgba(255, 255, 255, 0.6)',
                size: 1 + Math.random()*2
            });
        }

        let dir=0; if(keys.l)dir-=1; if(keys.r)dir+=1;
        
        const accel = isWater ? 1000 : 2200;
        const maxSpd = isWater ? 120 : 280;
        const friction = isIce ? 300 : (isWater ? 1200 : 1800);

        if(dir!==0){
            player.vx+=dir*accel*dt; player.right=dir>0; 
            if(player.grounded&&!isIce&&!isWater&&Math.random()<.08)pDust(player.x+player.w/2,player.y+player.h,dir);
        } else {
            const f=friction*dt; player.vx=player.vx>0?Math.max(0,player.vx-f):Math.min(0,player.vx+f);
        }
        player.vx=Math.max(-maxSpd,Math.min(player.vx,maxSpd));
        if(player.grounded&&Math.abs(player.vx)>10)player.bobPhase+=dt*10;
        if(keys.jpressed){player.jbuf=.12;keys.jpressed=0;} else if(player.jbuf>0)player.jbuf-=dt;
        
        const grav = isWater ? 600 : 1500;
        const maxFall = isWater ? 200 : 600;
        player.vy+=grav*dt; if(player.vy>maxFall)player.vy=maxFall;
        if(player.grounded)player.coyote=.1;else player.coyote-=dt;
        
        const wasG=player.grounded;player.grounded=false;
        if(player.jbuf>0&&player.coyote>0){
            player.vy = isWater ? -300 : -610; 
            player.jbuf=0;player.coyote=0;
            if(!isWater) pEmit(player.x+player.w/2,player.y+player.h,5,'rgba(220,220,220,.6)',25,60,200);
        }
        if(!keys.jump&&player.vy<0)player.vy+=grav*.5*dt;
        
        moveAndCollide(player,dt);
        if(!wasG && player.grounded && !isWater && !isIce) {
            pEmit(player.x+player.w/2,player.y+player.h,5,'rgba(180,180,180,.7)',15,45,200);
            
            // Calculate fall damage
            const fallDist = player.y - player.highestY;
            if(fallDist > TS * 7) { // Only take damage if fallen more than 7 tiles
                const dmg = Math.floor((fallDist - TS*7) / 10);
                if(dmg > 0) playerDamage(dmg);
            }
            player.highestY = player.y; // Reset highest point upon landing
        } else if (!player.grounded) {
            if(player.vy < 0 || player.y < player.highestY) {
                player.highestY = player.y; // Track the highest point while airborne
            }
        } else {
            player.highestY = player.y;
        }
    }

    player.fireCd-=dt;
    if(keys.shoot&&player.fireCd<=0&&player.ammo>0){
        player.ammo--;player.fireCd=.32;Audio.shoot();
        const bx=player.right?player.x+player.w+2:player.x-6;
        player.bullets.push({x:bx,y:player.y+player.h/2,vx:(player.right?1:-1)*700,vy:0,life:1.2});
        pEmit(bx,player.y+player.h/2,3,'#ffee00',25,55,100); updateHUD();
    }

    for(let i=player.bullets.length-1;i>=0;i--){
        const b=player.bullets[i]; b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
        if(isSolidTile(mapTile(Math.floor(b.x/TS),Math.floor(b.y/TS)))||b.life<=0){pEmit(b.x,b.y,3,'#ff9900',15,40,150);player.bullets.splice(i,1);continue;}
        for(const e of activeEnemies){
            if(e.dead)continue;
            if(b.x>e.x&&b.x<e.x+e.w&&b.y>e.y&&b.y<e.y+e.h){
                e.hp-=25;e.flash=1; pEmit(b.x,b.y,6,'#ff2200',30,70,200);
                if(e.hp<=0){e.dead=true;pEmit(e.x+e.w/2,e.y+e.h/2,12,'#880000',40,90,200);}
                player.bullets.splice(i,1);break;
            }
        }
    }

    if(player.invT>0)player.invT-=dt;
    for(const pk of map.pickups){
        if(pk.mapIdx !== currentMapIdx) continue;
        if(pk.got)continue;
        const cx=pk.x+TS/2,cy=pk.y+TS/2;
        // AABB collision instead of just center point
        if(player.x < pk.x + TS && player.x + player.w > pk.x && 
           player.y < pk.y + TS && player.y + player.h > pk.y){
            pk.got=1;
            if(pk.t==='ammo'){Audio.pick(); player.ammo=Math.min(player.maxAmmo,player.ammo+10);pEmit(cx,cy,8,'#ffcc00',40,80,150);}
            else if(pk.t==='hp'){Audio.pick(); player.hp=Math.min(player.maxHp,player.hp+25);pEmit(cx,cy,8,'#ff4444',40,80,150);}
            else if(pk.t==='check'){Audio.save(); respawnPoint={x:pk.x, y:pk.y, mapIdx:currentMapIdx}; showToast("Checkpoint Saved!");}
            else if(pk.t==='end'){Audio.save(); victory=true; transitionTo('victory-menu');}
            updateHUD();
        }
    }

    let canDoor = false;
    for(const dr of map.doors){
        if(dr.mapIdx !== currentMapIdx) continue;
        if(Math.abs((player.x+player.w/2)-dr.wx)<30 && Math.abs((player.y+player.h)-dr.wy)<20){
            canDoor = true;
            if(keys.ipressed){
                keys.ipressed = 0; Audio.door();
                if(dr.targetRoom !== -1 && !map.rooms[dr.targetRoom]){
                    showToast("Target Room " + dr.targetRoom + " doesn't exist!");
                    break;
                }
                transitionTo(() => {
                    const oldMapIdx = currentMapIdx;
                    currentMapIdx = dr.targetRoom;
                    const m = getActiveMap();
                    cam.mw = m.w; cam.mh = m.h + CH/2;
                    spawnEnemiesForCurrentMap();
                    const tgtDoor = map.doors.find(d => d.mapIdx === currentMapIdx && d.targetRoom === oldMapIdx);
                    if(tgtDoor){ player.x = tgtDoor.wx - player.w/2; player.y = tgtDoor.wy - player.h; }
                    else { player.x = m.w/2; player.y = m.h/2; }
                    cam.x = player.x - CW/2; cam.y = player.y - CH/2;
                    camFollow(player.x, player.y, 100);
                    updateHUD();
                });
                break;
            }
        }
    }
    const pr=document.getElementById('prompt-box');
    if(canDoor) pr.classList.remove('hidden'); else pr.classList.add('hidden');

    let aimDir = 0;
    if(keys.u) aimDir = -1;
    else if(keys.d) aimDir = 1;
    lightUpdate(dt, player.right, aimDir);
    
    for(const e of activeEnemies){
        if(e.dead)continue;
        e.vy+=1500*dt;if(e.vy>600)e.vy=600; e.grounded=false;
        const dist=Math.abs(player.x-e.x);
        if(dist<260)e.state='chase'; else if(dist>340)e.state='patrol';
        if(e.state==='chase') e.vx=(player.x<e.x?-1:1)*e.speed;
        else{e.patT-=dt;if(e.patT<=0){e.patDir*=-1;e.patT=e.patI;}e.vx=e.patDir*e.speed*.5;}
        moveAndCollide(e,dt);
        if(e.atkCd>0)e.atkCd-=dt;
        const dx=(player.x+player.w/2)-(e.x+e.w/2),dy=(player.y+player.h/2)-(e.y+e.h/2);
        if(Math.sqrt(dx*dx+dy*dy)<(e.w/2+player.w/2)+4&&e.atkCd<=0){playerDamage(12);e.atkCd=1.2;}
        if(e.flash>0)e.flash-=dt*5;
    }
    updateParticles(dt);

    const m = getActiveMap();
    if(!devMode && player.y>m.h+50){player.hp=0;} 
    if(player.hp<=0) {
        gameOver=true;
        transitionTo('gameover-menu');
    }
    camFollow(player.x+player.w/2,player.y+player.h/2,dt);
}

function loop(t){
    const dt=Math.min((t-lastT)/1000,.04);lastT=t;
    Audio.init();

    if(gameState==='PLAY') updatePlay(dt);

    if(gameState==='PLAY' || gameState==='PAUSE'){
        camZoom += (camZoomTarget - camZoom) * 5 * dt;
    } else {
        camZoom = 1; camZoomTarget = 1; zoomState = 0;
    }

    ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.save();
    ctx.translate(DRAW_OFFSET_X, DRAW_OFFSET_Y);
    ctx.scale(DRAW_SCALE, DRAW_SCALE);
    ctx.beginPath(); ctx.rect(0, 0, CW, CH); ctx.clip();

    if(gameState==='PLAY' || gameState==='EDITOR' || gameState==='PAUSE'){
        ctx.clearRect(0,0,CW,CH);
        
        ctx.save();
        if(camShake > 0) {
            ctx.translate((Math.random()-0.5)*camShake, (Math.random()-0.5)*camShake);
            camShake -= 60 * dt;
            if(camShake < 0) camShake = 0;
        }
        
        if((gameState==='PLAY' || gameState==='PAUSE') && camZoom !== 1) {
            const zx = player.x + player.w/2 - cam.x;
            const zy = player.y + player.h/2 - cam.y;
            ctx.translate(zx, zy);
            ctx.scale(camZoom, camZoom);
            ctx.translate(-zx, -zy);
        }

        drawBG(ctx);
        drawTiles(ctx);
        for(const e of activeEnemies)drawEnemy(ctx,e);
        if(gameState==='PLAY'||gameState==='PAUSE') drawPlayer(ctx);
        drawParticles(ctx,cam.x,cam.y);
        
        if((gameState==='PLAY'||gameState==='PAUSE') && !devMode){
            lightDraw(ctx,player.x+player.w/2,player.y+player.h/2);
            // Draw smooth gradient abyss below the map bottom
            const m = getActiveMap();
            if(m && m.h) {
                const startY = m.h - cam.y - 40; // Start slightly above the bottom line for smoother transition
                const endY = startY + 140;
                if(startY < CH) {
                    const grad = ctx.createLinearGradient(0, startY, 0, endY);
                    grad.addColorStop(0, 'rgba(0,0,0,0)');
                    grad.addColorStop(1, 'rgba(0,0,0,1)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, startY, CW, Math.max(0, CH - startY));
                }
            }
        } else if (gameState==='EDITOR' && edViewMode==='preview') {
            lightUpdate(dt, true);
            lightDraw(ctx, edMouseX+cam.x, edMouseY+cam.y);
            // Draw smooth gradient abyss below the map bottom
            const m = getActiveMap();
            if(m && m.h) {
                const startY = m.h - cam.y - 40;
                const endY = startY + 140;
                if(startY < CH) {
                    const grad = ctx.createLinearGradient(0, startY, 0, endY);
                    grad.addColorStop(0, 'rgba(0,0,0,0)');
                    grad.addColorStop(1, 'rgba(0,0,0,1)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, startY, CW, Math.max(0, CH - startY));
                }
            }
        }
        
        ctx.restore(); // Restore zoom scale

        if((gameState==='PLAY'||gameState==='PAUSE') && devMode){
            ctx.fillStyle='rgba(0,255,0,.15)';ctx.fillRect(0,0,CW,CH);
            ctx.fillStyle='#0f0';ctx.font='bold 16px monospace';ctx.textAlign='left';
            ctx.fillText('⚙ DEV MODE — P to toggle | WASD fly | Noclip ON',14,CH-16);
        }
        if(gameState==='EDITOR'){
            const col = Math.floor((edMouseX+cam.x)/TS), row = Math.floor((edMouseY+cam.y)/TS);
            ctx.strokeStyle='rgba(255,255,0,0.8)'; ctx.lineWidth=2;
            ctx.strokeRect(col*TS-cam.x, row*TS-cam.y, TS, TS);
        }
        
        // Cinematic Vignette (drawn in unscaled CW/CH coordinates)
        if(gameState==='PLAY' || gameState==='PAUSE'){
            ctx.save();
            ctx.translate(CW/2, CH/2);
            const activeH = filmMode ? CH - FILM_BAR_H*2 : CH;
            // scaleY so the radial gradient becomes an ellipse fitting the active height
            ctx.scale(1, activeH / CW);
            const vgrad = ctx.createRadialGradient(0, 0, CW*0.3, 0, 0, CW*0.6);
            vgrad.addColorStop(0, 'rgba(0,0,0,0)');
            vgrad.addColorStop(1, 'rgba(0,0,0,0.8)');
            ctx.fillStyle = vgrad;
            ctx.fillRect(-CW/2, -CW, CW, CW*2);
            ctx.restore();
        }
    }
    ctx.restore();

    // Film Mode Letterbox Bars (drawn in canvas space, above everything)
    if(filmMode && (gameState==='PLAY' || gameState==='PAUSE')){
        const barH = FILM_BAR_H * DRAW_SCALE;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, DRAW_OFFSET_Y + barH);
        ctx.fillRect(0, canvas.height - DRAW_OFFSET_Y - barH, canvas.width, DRAW_OFFSET_Y + barH);
    }

    requestAnimationFrame(loop);
}

// Boot
initInput();
lightInit();
requestAnimationFrame(loop);

function updateGraphicsFilter(){
    const isHDR = document.getElementById('ed-hdr').checked;
    const sat = document.getElementById('gfx-sat').value || 1;
    const con = document.getElementById('gfx-con').value || 1;
    const bri = document.getElementById('gfx-bri').value || 1;
    
    let filterStr = `saturate(${sat}) contrast(${con}) brightness(${bri})`;
    if(isHDR){
        filterStr += ` drop-shadow(0 0 10px rgba(100,200,255,0.2))`;
    }
    _baseCanvasFilter = filterStr;
    canvas.style.filter = filterStr;
    saveGraphicsSettings();
}

function changeResolution(val){
    if(val === 'pixel'){
        canvas.style.imageRendering = 'pixelated';
    } else {
        canvas.style.imageRendering = 'auto';
    }
    saveGraphicsSettings();
}

function toggleCRT(isOn){
    const crt = document.getElementById('crt-overlay');
    if(crt){
        crt.style.display = isOn ? 'block' : 'none';
    }
    saveGraphicsSettings();
}

function toggleFilmMode(isOn){
    filmMode = isOn;
    saveGraphicsSettings();
}

// ============ SETTINGS SAVE / LOAD ============
let isSettingsLoading = false;

function saveGraphicsSettings(){
    if(isSettingsLoading) return; // Prevent saving while loading defaults
    
    const settings = {
        hdr: document.getElementById('ed-hdr').checked,
        crt: document.getElementById('ed-crt').checked,
        film: document.getElementById('ed-film').checked,
        resolusi: document.getElementById('ed-resolusi').value,
        sat: document.getElementById('gfx-sat').value,
        con: document.getElementById('gfx-con').value,
        bri: document.getElementById('gfx-bri').value,
        devMenuEnabled: document.getElementById('set-devmode').checked
    };
    
    fetch('api.php?action=settings_save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: settings })
    }).catch(e => console.error("Error saving settings:", e));
}

function loadSettings(){
    isSettingsLoading = true;
    fetch('api.php?action=settings_load')
        .then(r => r.json())
        .then(res => {
            if(res.success && res.settings){
                const s = res.settings;
                document.getElementById('ed-hdr').checked = s.hdr || false;
                document.getElementById('ed-crt').checked = s.crt || false;
                document.getElementById('ed-film').checked = s.film || false;
                document.getElementById('ed-resolusi').value = s.resolusi || '1280';
                document.getElementById('gfx-sat').value = s.sat || 1;
                document.getElementById('gfx-con').value = s.con || 1;
                document.getElementById('gfx-bri').value = s.bri || 1;
                document.getElementById('set-devmode').checked = s.devMenuEnabled || false;
                
                // Apply immediately
                toggleCRT(s.crt);
                toggleFilmMode(s.film);
                changeResolution(s.resolusi);
                updateGraphicsFilter();
                toggleDevMode(s.devMenuEnabled || false);
            }
            isSettingsLoading = false;
        }).catch(e => { console.error("Error loading settings:", e); isSettingsLoading = false; });
}

function resetGraphicsSettings(){
    if(confirm("Are you sure you want to reset all graphics settings to default?")){
        document.getElementById('ed-hdr').checked = false;
        document.getElementById('ed-crt').checked = false;
        document.getElementById('ed-film').checked = false;
        document.getElementById('ed-resolusi').value = '1280';
        document.getElementById('gfx-sat').value = 1;
        document.getElementById('gfx-con').value = 1;
        document.getElementById('gfx-bri').value = 1;
        
        toggleCRT(false);
        toggleFilmMode(false);
        changeResolution('1280');
        updateGraphicsFilter();
    }
}

function toggleDevMode(isOn){
    devMenuEnabled = isOn;
    const devMenuBtn = document.getElementById('dev-menu-btn');
    if(devMenuBtn){
        if(isOn) devMenuBtn.classList.remove('hidden');
        else devMenuBtn.classList.add('hidden');
    }
    saveGraphicsSettings();
}

// Load settings on boot
window.addEventListener('load', () => {
    loadSettings();
});
