// ============ EDITOR ============
let edTool = 1; 
let edViewMode = 'flat'; 
let edMouseX=0, edMouseY=0, edMouseDown=false, edRightDown=false;
let edSel = { active: false, startX: 0, startY: 0, rect: null, grid: [], entities: [], isDragging: false, dragStartX: 0, dragStartY: 0 };
let edHistory = [];
let edHistoryIndex = -1;
let edDidMapChange = false;

function pushEdHistory(){
    if(!map || !map.rooms) return;
    const stateStr = JSON.stringify(map);
    if(edHistoryIndex >= 0 && edHistory[edHistoryIndex] === stateStr) return;
    if(edHistoryIndex < edHistory.length - 1) edHistory = edHistory.slice(0, edHistoryIndex + 1);
    edHistory.push(stateStr);
    edHistoryIndex++;
    if(edHistory.length > 50){ edHistory.shift(); edHistoryIndex--; }
}

function undoEd(){
    if(edHistoryIndex > 0){
        edHistoryIndex--;
        const cx = cam.x, cy = cam.y;
        map = JSON.parse(edHistory[edHistoryIndex]);
        updateEditorMapDropdown();
        changeMapLevel(currentMapIdx === -1 ? 'outdoor' : currentMapIdx);
        cam.x = cx; cam.y = cy;
        if(typeof showToast==='function') showToast("Undo");
    }
}
function redoEd(){
    if(edHistoryIndex < edHistory.length - 1){
        edHistoryIndex++;
        const cx = cam.x, cy = cam.y;
        map = JSON.parse(edHistory[edHistoryIndex]);
        updateEditorMapDropdown();
        changeMapLevel(currentMapIdx === -1 ? 'outdoor' : currentMapIdx);
        cam.x = cx; cam.y = cy;
        if(typeof showToast==='function') showToast("Redo");
    }
}

function toggleEditorRibbon(){ document.getElementById('ribbon-content').classList.toggle('hidden'); }
function setEdTool(t){
    edTool = t;
    document.querySelectorAll('.editor-ribbon .ed-btn, .editor-footer .ed-btn').forEach(b => b.classList.remove('active'));
    
    // Find button manually because keyboard shortcuts don't provide event.target as button
    let toolStr = typeof t === 'string' ? `'${t}'` : t;
    const btn = Array.from(document.querySelectorAll('.ed-btn')).find(b => {
        const oc = b.getAttribute('onclick');
        return oc && oc.includes(`setEdTool(${toolStr})`);
    });
    if(btn) btn.classList.add('active');
    else if(event && event.target && event.target.classList.contains('ed-btn')) event.target.classList.add('active');
    
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
    edHistory = []; edHistoryIndex = -1; edDidMapChange = false;
    pushEdHistory();
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
    pushEdHistory();
}

function handleEditorClick(cx, cy, isErase=false){
    const d = getActiveMap();
    const col = Math.floor(cx/TS), row = Math.floor(cy/TS);
    if(col<0||col>=d.cols||row<0||row>=d.rows) return;

    const rawT = d.tiles[row][col];
    let currentBg = typeof getBg === 'function' ? getBg(rawT) : 0;
    let currentFg = typeof getFg === 'function' ? getFg(rawT) : 0;

    if(isErase || edTool===0){
        if (currentFg !== TILE_EMPTY && currentBg !== TILE_EMPTY) {
            d.tiles[row][col] = currentBg;
        } else {
            d.tiles[row][col] = 0;
            map.enemies = map.enemies.filter(e => e.mapIdx!==currentMapIdx || Math.abs(e.x-cx)>20 || Math.abs(e.y-cy)>20);
            map.pickups = map.pickups.filter(e => e.mapIdx!==currentMapIdx || Math.abs(e.x-cx)>20 || Math.abs(e.y-cy)>20);
            map.doors = map.doors.filter(e => e.mapIdx!==currentMapIdx || Math.abs(e.wx-cx)>40 || Math.abs(e.wy-cy)>40);
            map.decorations = map.decorations.filter(e => e.mapIdx!==currentMapIdx || Math.abs(e.x-cx)>40 || Math.abs(e.y-cy)>40);
        }
        isMapUnsaved = true; edDidMapChange = true;
        spawnEnemiesForCurrentMap();
        return;
    }

    if(typeof edTool === 'number'){
        const isFgTool = (edTool >= 1 && edTool <= 11) || edTool >= 17;
        const isBgTool = (edTool >= 12 && edTool <= 16);

        if (isFgTool) {
            if (currentBg !== TILE_EMPTY && (edTool === TILE_PLAT || edTool === TILE_LADDER || edTool === TILE_WATER || edTool === TILE_CRUMBLE)) {
                d.tiles[row][col] = currentBg * 100 + edTool;
            } else {
                d.tiles[row][col] = edTool; 
            }
        } else if (isBgTool) {
            if (currentFg === TILE_PLAT || currentFg === TILE_LADDER || currentFg === TILE_WATER || currentFg === TILE_CRUMBLE) {
                d.tiles[row][col] = edTool * 100 + currentFg;
            } else {
                d.tiles[row][col] = edTool;
            }
        } else {
            d.tiles[row][col] = edTool;
        }
        isMapUnsaved = true; edDidMapChange = true;
    } else if (edTool !== 'select') {
        isMapUnsaved = true; edDidMapChange = true;
        if(edTool==='spawn'){
            if(currentMapIdx !== -1){ showToast("Spawn must be Outdoor!"); return; }
            map.spawnX = col*TS; map.spawnY = row*TS; player.x=map.spawnX; player.y=map.spawnY;
        } else if (edTool==='enemy' || edTool==='kuyang' || edTool==='stalker'){
            map.enemies.push({x: col*TS, y: row*TS, mapIdx: currentMapIdx, type: edTool});
            spawnEnemiesForCurrentMap();
        } else if (['ammo','ammo_mg','ammo_sniper','hp','check','end','battery','nightvision','gun_mg','gun_sniper','medkit','potion_speed','potion_jump','potion_shield','grenade','landmine','smoke'].includes(edTool)){
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

function getGraphicsDPR() {
    let baseDpr = window.devicePixelRatio || 1;
    if (typeof window.graphicsQuality !== 'undefined') {
        if (window.graphicsQuality === 'medium') return Math.min(baseDpr, 1.0);
        if (window.graphicsQuality === 'low') return Math.min(baseDpr, 0.75);
        if (window.graphicsQuality === 'lowest') return Math.min(baseDpr, 0.5);
        if (window.graphicsQuality === 'ultralow') return Math.min(baseDpr, 0.25);
    }
    return baseDpr;
}

function resizeWindow(){
    const dpr = getGraphicsDPR();
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';

    const scaleX = (window.innerWidth * dpr) / INTERNAL_W;
    const scaleY = (window.innerHeight * dpr) / INTERNAL_H;
    
    // Gunakan Math.max agar game memotong bagian atas/bawah jika layar terlalu lebar
    // Ini mencegah cheating pada layar ultrawide sekaligus menghilangkan area hitam.
    DRAW_SCALE = Math.max(scaleX, scaleY);
    CW = (window.innerWidth * dpr) / DRAW_SCALE;
    CH = (window.innerHeight * dpr) / DRAW_SCALE;
    
    DRAW_OFFSET_X = 0;
    DRAW_OFFSET_Y = 0;
    
    // Update batas kamera jika sudah ada map yang aktif
    if (typeof cam !== 'undefined' && typeof getActiveMap === 'function') {
        const m = getActiveMap();
        if (m) {
            cam.mw = m.w;
            cam.mh = m.h + CH/2;
        }
    }
    
    if(typeof lightInit === 'function') lightInit();
}
window.addEventListener('resize', resizeWindow);
resizeWindow();

function getMousePos(e){
    const rect = canvas.getBoundingClientRect();
    const dpr = getGraphicsDPR();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    
    // Canvas pixels
    const canvasX = cssX * dpr;
    const canvasY = cssY * dpr;
    
    // Un-apply DRAW_SCALE & DRAW_OFFSET
    const rawX = (canvasX - DRAW_OFFSET_X) / DRAW_SCALE;
    const rawY = (canvasY - DRAW_OFFSET_Y) / DRAW_SCALE;
    
    // Un-apply center origin camZoom
    // The zoom center in editor is CW/2, CH/2 relative to the camera view
    const centerX = typeof CW !== 'undefined' ? CW / 2 : canvas.width / 2 / DRAW_SCALE;
    const centerY = typeof CH !== 'undefined' ? CH / 2 : canvas.height / 2 / DRAW_SCALE;
    
    const mx = (rawX - centerX) / camZoom + centerX;
    const my = (rawY - centerY) / camZoom + centerY;
    
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
                edDidMapChange = true;
            } else if (edSel.active){
                edSel.active = false;
                if(edSel.rect) processSelectionBox(edSel.rect);
            }
        }
        if(edDidMapChange) { pushEdHistory(); edDidMapChange = false; }
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

// Allow horizontal scroll on editor tabs with mouse wheel
document.querySelectorAll('.ed-tab-content').forEach(el => {
    el.addEventListener('wheel', (e) => {
        if(e.deltaY !== 0) {
            e.preventDefault();
            el.scrollLeft += e.deltaY;
        }
    });
});

