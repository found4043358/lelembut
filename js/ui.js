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
    
    // Hide mobile controls by default on menu changes
    const mc = document.getElementById('mobile-controls');
    if(mc) mc.classList.add('hidden');

    if(id==='game'){
        gameState='PLAY';
        document.getElementById('ui-layer').classList.remove('hidden');
        document.body.classList.add('playing');
        
        // Re-show mobile controls if enabled
        const isForce = document.getElementById('set-force-mobile') && document.getElementById('set-force-mobile').checked;
        if(isForce || 'ontouchstart' in window || navigator.maxTouchPoints > 0) {
            if(mc) mc.classList.remove('hidden');
        }
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

