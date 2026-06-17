// ============ SETTINGS & KEYBINDS ============
let binds = {l:'KeyA', r:'KeyD', u:'KeyW', d:'KeyS', jump:'Space', shoot:'KeyZ', interact:'KeyE', toggleAim:'KeyQ', reload:'KeyR', toggleLight:'KeyL'};
const keys = {l:0,r:0,u:0,d:0,jump:0,jpressed:0,shoot:0,interact:0,ipressed:0,shift:0,reload:0,rpressed:0};
let waitingForBind = null;
let lastTouchTime = 0;

function loadBinds(){
    const saved = localStorage.getItem('lelembut_binds');
    if(saved) {
        binds = JSON.parse(saved);
    } else if (window.globalSettings && window.globalSettings.controls && Object.keys(window.globalSettings.controls).length > 0) {
        binds = window.globalSettings.controls;
    }
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
    
    window.addEventListener('mousemove', e => {
        window.rawMouseX = e.clientX;
        window.rawMouseY = e.clientY;
        const rect = canvas.getBoundingClientRect();
        const dpr = typeof getGraphicsDPR === 'function' ? getGraphicsDPR() : (window.devicePixelRatio || 1);
        const cssX = e.clientX - rect.left;
        const cssY = e.clientY - rect.top;
        const canvasX = cssX * dpr;
        const canvasY = cssY * dpr;
        
        let mx = (canvasX - DRAW_OFFSET_X) / DRAW_SCALE;
        let my = (canvasY - DRAW_OFFSET_Y) / DRAW_SCALE;
        
        if (typeof camZoom !== 'undefined' && camZoom !== 1 && typeof player !== 'undefined' && gameState === 'PLAY') {
            const zx = player.x + player.w/2 - cam.x;
            const zy = player.y + player.h/2 - cam.y;
            mx = (mx - zx) / camZoom + zx;
            my = (my - zy) / camZoom + zy;
        }
        
        mouseX = mx;
        mouseY = my;
    });

    window.addEventListener('mousedown', e => {
        if (Date.now() - lastTouchTime < 500) return; // Prevent mobile tap from firing double throw
        if (gameState === 'PLAY') {
            if (e.button === 0) {
                if (player.throwingItem) {
                    if(typeof spawnThrowable === 'function') {
                        spawnThrowable(player.throwingItem, player.x + player.w/2, player.y + player.h/2);
                        player.inventory[player.throwingItem]--;
                        player.throwingItem = null;
                        if(typeof renderInventory === 'function') renderInventory();
                        if(typeof updateHUD === 'function') updateHUD();
                    }
                } else {
                    keys.shoot = 1;
                }
            } else if (e.button === 2) {
                if (player.throwingItem) {
                    player.throwingItem = null;
                }
            }
        }
    });
    window.addEventListener('mouseup', e => {
        if (e.button === 0) keys.shoot = 0;
    });

    // Prevent context menu globally on the canvas
    window.addEventListener('contextmenu', e => e.preventDefault());

    window.onkeydown=e=>{
        if(waitingForBind){
            binds[waitingForBind] = e.code; waitingForBind = null;
            updateBindUI(); saveBinds(); e.preventDefault(); return;
        }
        if(e.key==='Shift'){
            keys.shift=1;
            if(keys.u) aimLock = -1;
            else if(keys.d) aimLock = 1;
            else aimLock = 0; // Clear lock
            updateHUD();
        }
        if(e.code===binds.l) keys.l=1;
        if(e.code===binds.r) keys.r=1;
        if(e.code===binds.u) { keys.u=1; if(keys.shift) { aimLock = -1; updateHUD(); } }
        if(e.code===binds.d) { keys.d=1; if(keys.shift) { aimLock = 1; updateHUD(); } }
        if(e.code===binds.jump) {if(!keys.jump)keys.jpressed=1; keys.jump=1; e.preventDefault();}
        if(e.code===binds.shoot) keys.shoot=1;
        if(e.code===binds.reload) {if(!keys.reload)keys.rpressed=1; keys.reload=1;}
        if(e.code===binds.interact) {if(!keys.interact)keys.ipressed=1; keys.interact=1;}
        if(e.code===binds.toggleAim) {
            aimMode = aimMode === 'keyboard' ? 'mouse' : 'keyboard';
            updateHUD();
        }
        if(e.code==='KeyP' && gameState==='PLAY' && devMenuEnabled) devMode=!devMode;
        if(e.code==='Tab' || e.code==='KeyI') {
            if(gameState==='PLAY' || gameState==='INVENTORY') {
                toggleInventory();
                e.preventDefault();
            }
        }
        if(e.key==='1') { if(typeof switchWeapon==='function') switchWeapon(0); }
        if(e.key==='2') { if(typeof switchWeapon==='function') switchWeapon(1); }
        if(e.key==='3') { if(typeof switchWeapon==='function') switchWeapon(2); }
        if(e.code==='Escape') {
            if(!document.getElementById('settings-menu').classList.contains('hidden')) {
                transitionTo(settingsReturnMenu);
            }
            else if(gameState==='INVENTORY') toggleInventory();
            else if(gameState==='PLAY' || gameState==='PAUSE') togglePause();
            else if(gameState==='EDITOR') attemptExitEditor();
        }
        if(e.code==='KeyM' && gameState==='PLAY') {
            zoomState = (zoomState + 1) % 3;
            if(zoomState===0) camZoomTarget = 2.0;
            else if(zoomState===1) camZoomTarget = 1.5;
            else if(zoomState===2) camZoomTarget = 1.2;
        }

        if(gameState==='PLAY') {
            if(e.code==='Digit1') switchWeapon(0);
            if(e.code==='Digit2') switchWeapon(1);
            if(e.code==='Digit3') switchWeapon(2);
            if(e.code===binds.toggleLight) { player.flashlightOn = !player.flashlightOn; Audio.flashlight(); }
        }
        
        if(gameState==='EDITOR') {
            if(e.code==='KeyV') { e.preventDefault(); setEdTool('select'); }
            if(e.code==='KeyX') { e.preventDefault(); setEdTool(0); }
            if(e.code==='KeyN') { e.preventDefault(); camZoomTarget = Math.max(0.2, camZoomTarget - 0.2); }
            if(e.code==='KeyM') { e.preventDefault(); camZoomTarget = Math.min(3.0, camZoomTarget + 0.2); }
            if(e.code==='ArrowUp') { e.preventDefault(); if(e.ctrlKey) cam.y=0; else cam.y -= TS; }
            if(e.code==='ArrowDown') { e.preventDefault(); if(e.ctrlKey) cam.y=getActiveMap().h-CH; else cam.y += TS; }
            if(e.code==='ArrowLeft') { e.preventDefault(); if(e.ctrlKey) cam.x=0; else cam.x -= TS; }
            if(e.code==='ArrowRight') { e.preventDefault(); if(e.ctrlKey) cam.x=getActiveMap().w-CW; else cam.x += TS; }
            if(e.code==='KeyZ' && e.ctrlKey && !e.shiftKey) { e.preventDefault(); undoEd(); }
            if(e.code==='KeyZ' && e.ctrlKey && e.shiftKey) { e.preventDefault(); redoEd(); }
            if(e.code==='KeyY' && e.ctrlKey) { e.preventDefault(); redoEd(); }
            if(edTool==='select' && edSel.rect && (e.code==='Delete' || e.code==='Backspace')){
                deleteSelection(); isMapUnsaved = true;
            }
        }
    };
    window.onkeyup=e=>{
        if(e.key==='Shift') keys.shift=0;
        if(e.code===binds.l) keys.l=0;
        if(e.code===binds.r) keys.r=0;
        if(e.code===binds.u) keys.u=0;
        if(e.code===binds.d) keys.d=0;
        if(e.code===binds.jump) keys.jump=0;
        if(e.code===binds.shoot) keys.shoot=0;
        if(e.code===binds.reload) keys.reload=0;
        if(e.code===binds.interact) keys.interact=0;
    };

    // Mobile Touch Controls
    const mobileControls = document.getElementById('mobile-controls');
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        if(mobileControls && typeof gameState !== 'undefined' && (gameState === 'PLAY' || gameState === 'PAUSE')) {
            mobileControls.classList.remove('hidden');
        }
        const btnMainFs = document.getElementById('btn-main-fullscreen');
        if(btnMainFs) btnMainFs.classList.remove('hidden');
    }

    const bindTouch = (id, actionDown, actionUp) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent scroll/zoom
            btn.classList.add('active');
            actionDown();
        }, {passive: false});
        
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            btn.classList.remove('active');
            actionUp();
        }, {passive: false});

        btn.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            btn.classList.remove('active');
            actionUp();
        }, {passive: false});
    };

    // D-Pad touch handlers removed, only using Analog Joystick now
    bindTouch('btn-jump', () => { if(!keys.jump) keys.jpressed=1; keys.jump=1; }, () => keys.jump=0);
    const handleShootDown = () => {
        if (player.throwingItem && typeof spawnThrowable === 'function') {
            spawnThrowable(player.throwingItem, player.x + player.w/2, player.y + player.h/2);
            player.inventory[player.throwingItem]--;
            player.throwingItem = null;
            if(typeof renderInventory === 'function') renderInventory();
            if(typeof updateHUD === 'function') updateHUD();
        } else {
            keys.shoot=1;
        }
    };
    
    bindTouch('btn-shoot', handleShootDown, () => keys.shoot=0);
    bindTouch('btn-shoot-left', handleShootDown, () => keys.shoot=0);
    bindTouch('btn-reload', () => { if(!keys.reload) keys.rpressed=1; keys.reload=1; }, () => keys.reload=0);
    bindTouch('btn-interact', () => { if(!keys.interact) keys.ipressed=1; keys.interact=1; }, () => keys.interact=0);
    
    // New buttons
    bindTouch('btn-light', () => {
        if(typeof player !== 'undefined') {
            player.flashlightOn = !player.flashlightOn;
            Audio.flashlight();
            const btn = document.getElementById('btn-light');
            if(btn) btn.style.backgroundColor = player.flashlightOn ? 'rgba(139,0,0,0.6)' : '';
        }
    }, () => {});
    bindTouch('btn-pause', () => { if(typeof togglePause === 'function') togglePause(); }, () => {});
    bindTouch('btn-camera', () => { 
        if(typeof zoomState !== 'undefined') {
            zoomState = (zoomState + 1) % 3;
            if(zoomState===0) camZoomTarget = 2.0;
            else if(zoomState===1) camZoomTarget = 1.5;
            else if(zoomState===2) camZoomTarget = 1.2;
        }
    }, () => {});
    bindTouch('btn-dev', () => { 
        if(typeof devMenuEnabled !== 'undefined' && devMenuEnabled) {
            if(typeof devMode !== 'undefined') devMode = !devMode;
        }
    }, () => {});
    bindTouch('btn-aim', () => {
        if(typeof aimMode !== 'undefined') {
            aimMode = aimMode === 'keyboard' ? 'mouse' : 'keyboard';
            const btnAim = document.getElementById('btn-aim');
            if(btnAim) btnAim.style.backgroundColor = aimMode === 'mouse' ? 'rgba(139,0,0,0.6)' : '';
            if(typeof updateHUD === 'function') updateHUD();
            const mc = document.getElementById('mobile-crosshair');
            if(mc && aimMode !== 'mouse') mc.classList.add('hidden');
        }
    }, () => {});
    
    bindTouch('btn-aim-shoot', () => { 
        aimShoots = !aimShoots; 
        const btn = document.getElementById('btn-aim-shoot');
        if(btn) btn.style.backgroundColor = aimShoots ? '' : 'rgba(139,0,0,0.6)';
        if(typeof showToast === 'function') showToast(aimShoots ? "Tap to Shoot: ON" : "Tap to Shoot: OFF");
    }, () => {});

    // Free Aim Mechanic
    let aimTouchId = null;
    let aimShoots = false;
    const gameContainer = document.getElementById('game-container');
    
    bindTouch('hud-left', () => {
        if(gameState==='PLAY' || gameState==='INVENTORY') toggleInventory();
    }, () => {});

    function updateMousePosFromTouch(touch) {
        if(!touch) return;
        window.rawMouseX = touch.clientX;
        window.rawMouseY = touch.clientY;
        const rect = canvas.getBoundingClientRect();
        const dpr = typeof getGraphicsDPR === 'function' ? getGraphicsDPR() : (window.devicePixelRatio || 1);
        const cssX = touch.clientX - rect.left;
        const cssY = touch.clientY - rect.top;
        const canvasX = cssX * dpr;
        const canvasY = cssY * dpr;
        
        let mx = (canvasX - DRAW_OFFSET_X) / DRAW_SCALE;
        let my = (canvasY - DRAW_OFFSET_Y) / DRAW_SCALE;
        
        if (typeof camZoom !== 'undefined' && camZoom !== 1 && typeof player !== 'undefined' && gameState === 'PLAY') {
            const zx = player.x + player.w/2 - cam.x;
            const zy = player.y + player.h/2 - cam.y;
            mx = (mx - zx) / camZoom + zx;
            my = (my - zy) / camZoom + zy;
        }
        
        mouseX = mx;
        mouseY = my;
        
        const mc = document.getElementById('mobile-crosshair');
        if (mc && aimMode === 'mouse') {
            mc.classList.remove('hidden');
            mc.style.color = '#ff0000';
            mc.style.opacity = '0.8';
            mc.style.transition = 'none';
            // Offset the crosshair position by the safe zone to match touch clientX accurately
            const safeZone = parseInt(localStorage.getItem('lelembut_safe_zone') || '0', 10);
            mc.style.left = (touch.clientX - safeZone) + 'px';
            mc.style.top = touch.clientY + 'px';
        }
    }

    gameContainer.addEventListener('touchstart', (e) => {
        if(e.target.closest('.mc-btn') || e.target.closest('#mobile-layout-editor')) return; // Ignore if touching a button or editor
        if (gameState === 'PLAY') {
            for(let i=0; i<e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                lastTouchTime = Date.now();
                if(!t.target.closest('.mc-btn') && aimTouchId === null) {
                    aimTouchId = t.identifier;
                    updateMousePosFromTouch(t);
                    if(aimShoots) handleShootDown();
                }
            }
        }
    }, {passive: false});
    
    gameContainer.addEventListener('touchmove', (e) => {
        if (gameState === 'PLAY' && aimTouchId !== null) {
            for(let i=0; i<e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if(t.identifier === aimTouchId) {
                    updateMousePosFromTouch(t);
                    e.preventDefault(); // Prevent scrolling while aiming
                }
            }
        }
    }, {passive: false});

    const handleAimTouchEnd = (e) => {
        if(aimTouchId !== null) {
            for(let i=0; i<e.changedTouches.length; i++) {
                if(e.changedTouches[i].identifier === aimTouchId) {
                    aimTouchId = null;
                    const shootBtn = document.getElementById('btn-shoot');
                    if(!shootBtn || !shootBtn.classList.contains('active')) {
                        if(aimShoots) keys.shoot = 0;
                    }
                    const mc = document.getElementById('mobile-crosshair');
                    if(mc) {
                        mc.style.color = '#ffffff';
                        mc.style.opacity = '0.1';
                        mc.style.transition = 'color 0.2s, opacity 0.2s';
                    }
                }
            }
        }
    };

    gameContainer.addEventListener('touchend', handleAimTouchEnd, {passive: false});
    gameContainer.addEventListener('touchcancel', handleAimTouchEnd, {passive: false});

    // Analog Joystick Logic
    const jBase = document.getElementById('joystick-base');
    const jKnob = document.getElementById('joystick-knob');
    let jActive = false;
    let jId = null;
    let jRect = null;

    if(jBase) {
        jBase.addEventListener('touchstart', (e) => {
            if(typeof isEditingLayout !== 'undefined' && isEditingLayout) return; // handled by layout editor
            const t = e.changedTouches[0];
            jId = t.identifier;
            jActive = true;
            jRect = jBase.getBoundingClientRect();
            updateJoystick(t);
        }, {passive:false});
        
        jBase.addEventListener('touchmove', (e) => {
            if(!jActive) return;
            for(let i=0; i<e.changedTouches.length; i++){
                if(e.changedTouches[i].identifier === jId) {
                    updateJoystick(e.changedTouches[i]);
                }
            }
        }, {passive:false});

        const endJoystick = (e) => {
            for(let i=0; i<e.changedTouches.length; i++){
                if(e.changedTouches[i].identifier === jId) {
                    jActive = false;
                    jId = null;
                    if(jKnob) jKnob.style.transform = `translate(0px, 0px)`;
                    keys.l = 0;
                    keys.r = 0;
                    keys.u = 0;
                    keys.d = 0;
                }
            }
        };

        jBase.addEventListener('touchend', endJoystick);
        jBase.addEventListener('touchcancel', endJoystick);
    }

    function updateJoystick(t) {
        if(!jRect || !jKnob) return;
        const centerX = jRect.left + jRect.width/2;
        const centerY = jRect.top + jRect.height/2;
        const maxDist = jRect.width/2;
        
        let dx = t.clientX - centerX;
        let dy = t.clientY - centerY;
        let dist = Math.hypot(dx, dy);
        
        if(dist > maxDist) {
            dx = (dx/dist) * maxDist;
            dy = (dy/dist) * maxDist;
        }
        
        // Kembalikan visual ke 4 arah (snap ke axis terdekat)
        if (Math.abs(dx) > Math.abs(dy)) {
            dy = 0;
        } else {
            dx = 0;
        }
        
        jKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        
        // Deadzone & mapping to keys
        keys.l = 0; keys.r = 0; keys.u = 0; keys.d = 0;
        
        if(Math.abs(dx) > 15) {
            keys.l = dx < 0 ? 1 : 0;
            keys.r = dx > 0 ? 1 : 0;
        }
        if(Math.abs(dy) > 15) {
            keys.u = dy < 0 ? 1 : 0;
            keys.d = dy > 0 ? 1 : 0;
        }
    }
}
