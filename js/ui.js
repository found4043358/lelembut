// ============ UI & MENUS ============
let isTransitioning = false;
let settingsReturnMenu = 'main-menu';

function openSettings(fromMenu) {
    settingsReturnMenu = fromMenu;
    transitionTo('settings-menu');
}

function openEditorFromPause() {
    if(!currentLevelId) {
        showToast("Bukan Custom Map.");
        return;
    }
    transitionTo(() => {
        const activeLevel = levelList.find(l => l.id == currentLevelId);
        if(activeLevel) document.getElementById('level-name-input').value = activeLevel.name;
        startEditor();
    });
}

function transitionTo(targetMenuOrFunction) {
    if(isTransitioning) return;
    isTransitioning = true;
    const fade = document.getElementById('screen-fade');
    
    // 1. Start fading to black
    if(fade) fade.classList.add('active');
    
    // 2. Wait exactly 300ms for the screen to become completely black
    setTimeout(async () => {
        try {
            // 3. Execute the target function or menu change while screen is pitch black
            if(typeof targetMenuOrFunction === 'function'){
                const result = targetMenuOrFunction();
                if (result instanceof Promise) {
                    await result;
                }
            } else {
                setMenu(targetMenuOrFunction);
            }
        } catch(e) {
            console.error("Transition error:", e);
        } finally {
            // 4. Determine how long to stay black before fading out
            let stayBlackDuration = 100;
            if (typeof gameState !== 'undefined' && gameState === 'PLAY') {
                stayBlackDuration = 200; // brief wait before game fade in starts
            }
            
            // 5. Wait, then start fading to clear
            setTimeout(() => {
                if(fade) fade.classList.remove('active');
                
                // 6. Wait exactly 300ms for the screen to become completely clear, then allow new transitions
                setTimeout(() => { 
                    isTransitioning = false; 
                }, 300);
            }, stayBlackDuration);
        }
    }, 300);
}

function setMenu(id){
    document.querySelectorAll('.overlay-menu').forEach(e=>e.classList.add('hidden'));
    document.getElementById('ui-layer').classList.add('hidden');
    document.getElementById('editor-ui').classList.add('hidden');
    
    // Always restore canvas filter when leaving game (removes lingering grayscale from pause)
    if(gameState === 'PAUSE' || gameState === 'PLAY') {
        canvas.style.filter = _baseCanvasFilter;
    }
    
    // Hide mobile controls by default on menu changes
    const mc = document.getElementById('mobile-controls');
    if(mc) mc.classList.add('hidden');

    if(id==='game'){
        gameState='PLAY';
        Audio.playBGM();
        document.getElementById('ui-layer').classList.remove('hidden');
        document.body.classList.add('playing');
        
        // Re-show mobile controls if enabled
        const isForce = document.getElementById('set-force-mobile') && document.getElementById('set-force-mobile').checked;
        if(isForce || 'ontouchstart' in window || navigator.maxTouchPoints > 0) {
            if(mc) mc.classList.remove('hidden');
        }
    } else if(id==='editor-ui'){
        gameState='EDITOR';
        Audio.stopBGM();
        // Also clear filter for editor
        canvas.style.filter = _baseCanvasFilter;
        document.getElementById(id).classList.remove('hidden');
        document.body.classList.remove('playing');
    } else if(id==='level-select'){
        fetchLevels('play');
        Audio.playMenuBGM();
        document.getElementById(id).classList.remove('hidden');
        document.body.classList.remove('playing');
    } else if(id==='editor-select'){
        fetchLevels('edit');
        Audio.playMenuBGM();
        document.getElementById(id).classList.remove('hidden');
        document.body.classList.remove('playing');
    } else if(id==='pause-menu'){
        gameState='PAUSE';
        document.getElementById('pause-menu').classList.remove('hidden');
        document.getElementById('ui-layer').classList.remove('hidden');
        document.body.classList.remove('playing');
        canvas.style.filter = _baseCanvasFilter + ' grayscale(1)';
        
        const peBtn = document.getElementById('pause-editor-btn');
        if (peBtn) {
            if (devMode) peBtn.classList.remove('hidden');
            else peBtn.classList.add('hidden');
        }
    } else {
        if(id==='gameover-menu') { gameState='GAMEOVER'; Audio.stopBGM(); }
        else if(id==='victory-menu') { gameState='VICTORY'; Audio.stopBGM(); }
        else {
            if (id === 'settings-menu' && settingsReturnMenu === 'pause-menu') {
                gameState = 'PAUSE';
            } else {
                gameState='MENU'; Audio.playMenuBGM(); 
            }
        }
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
        
        const peBtn = document.getElementById('pause-editor-btn');
        if (peBtn) {
            if (devMode) peBtn.classList.remove('hidden');
            else peBtn.classList.add('hidden');
        }
        
        // Hide mobile controls
        const mc = document.getElementById('mobile-controls');
        if(mc) mc.classList.add('hidden');
    } else if (gameState==='PAUSE'){
        gameState='PLAY';
        document.getElementById('pause-menu').classList.add('hidden');
        canvas.style.filter = _baseCanvasFilter;
        
        // Show mobile controls
        const mc = document.getElementById('mobile-controls');
        const isForce = document.getElementById('set-force-mobile') && document.getElementById('set-force-mobile').checked;
        if(isForce || 'ontouchstart' in window || navigator.maxTouchPoints > 0) {
            if(mc) mc.classList.remove('hidden');
        }
    }
}

document.addEventListener('click', (e) => {
    if(e.target.closest('button') && gameState !== 'PLAY') {
        Audio.ui('click');
    }
});

// ============ CUSTOM UI COMPONENTS ============
function showCustomConfirm(title, message, onConfirm, onCancel) {
    const overlay = document.getElementById('custom-alert-overlay');
    if(!overlay) return;
    
    document.getElementById('custom-alert-title').innerText = title;
    document.getElementById('custom-alert-message').innerText = message;
    
    const btnCancel = document.getElementById('custom-alert-btn-cancel');
    const btnOk = document.getElementById('custom-alert-btn-ok');
    
    // cleanup old listeners
    const newBtnCancel = btnCancel.cloneNode(true);
    const newBtnOk = btnOk.cloneNode(true);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);
    
    overlay.classList.remove('hidden');
    
    // trigger reflow
    void overlay.offsetWidth;
    
    const box = document.getElementById('custom-alert-box');
    box.style.transform = 'scale(1)';
    box.style.opacity = '1';
    
    newBtnCancel.onclick = () => {
        closeCustomConfirm();
        if(onCancel) onCancel();
    };
    
    newBtnOk.onclick = () => {
        closeCustomConfirm();
        if(onConfirm) onConfirm();
    };
}

function closeCustomConfirm() {
    const overlay = document.getElementById('custom-alert-overlay');
    const box = document.getElementById('custom-alert-box');
    if(!box || !overlay) return;
    
    box.style.transform = 'scale(0.8)';
    box.style.opacity = '0';
    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 300);
}
