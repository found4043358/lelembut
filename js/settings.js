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
        musicVol: document.getElementById('set-music-vol') ? document.getElementById('set-music-vol').value : 1.0,
        sfxVol: document.getElementById('set-sfx-vol') ? document.getElementById('set-sfx-vol').value : 1.0,
        devMenuEnabled: document.getElementById('set-devmode').checked,
        forceMobileControls: document.getElementById('set-force-mobile') ? document.getElementById('set-force-mobile').checked : false,
        safeZone: document.getElementById('set-safezone') ? document.getElementById('set-safezone').value : 0
    };
    
    fetch('api.php?action=settings_save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: settings })
    }).catch(e => console.error("Error saving settings:", e));
}

function changeSafeZone(val) {
    localStorage.setItem('lelembut_safe_zone', val);
    const valEl = document.getElementById('val-safezone');
    if (valEl) valEl.innerText = val;
    
    const mc = document.getElementById('mobile-controls');
    if (mc) {
        mc.style.left = val + 'px';
        mc.style.width = `calc(100vw - ${val * 2}px)`;
    }
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
                document.getElementById('ed-resolusi').dispatchEvent(new Event('change'));
                
                document.getElementById('gfx-sat').value = s.sat || 1;
                document.getElementById('gfx-con').value = s.con || 1;
                document.getElementById('gfx-bri').value = s.bri || 1;
                if(document.getElementById('set-music-vol')) document.getElementById('set-music-vol').value = s.musicVol !== undefined ? s.musicVol : 1.0;
                if(document.getElementById('set-sfx-vol')) document.getElementById('set-sfx-vol').value = s.sfxVol !== undefined ? s.sfxVol : 1.0;
                document.getElementById('set-devmode').checked = s.devMenuEnabled || false;
                if(document.getElementById('set-force-mobile')) document.getElementById('set-force-mobile').checked = s.forceMobileControls || false;
                
                // Apply immediately
                toggleCRT(s.crt);
                toggleFilmMode(s.film);
                changeResolution(s.resolusi);
                updateGraphicsFilter();
                updateAudioSettings();
                toggleDevMode(s.devMenuEnabled || false);
                if(document.getElementById('set-force-mobile')) toggleForceMobileControls(s.forceMobileControls || false);
                if(s.safeZone !== undefined) changeSafeZone(s.safeZone);
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
        if(document.getElementById('set-music-vol')) document.getElementById('set-music-vol').value = 1.0;
        if(document.getElementById('set-sfx-vol')) document.getElementById('set-sfx-vol').value = 1.0;
        
        toggleCRT(false);
        toggleFilmMode(false);
        changeResolution('1280');
        updateGraphicsFilter();
        updateAudioSettings();
        saveGraphicsSettings();
    }
}

function updateAudioSettings() {
    if(typeof Audio !== 'undefined') {
        const mv = document.getElementById('set-music-vol');
        const sv = document.getElementById('set-sfx-vol');
        if(mv) Audio.setMusicVolume(parseFloat(mv.value));
        if(sv) Audio.setSfxVolume(parseFloat(sv.value));
    }
    saveGraphicsSettings();
}

function toggleDevMode(isOn){
    devMenuEnabled = isOn;
    const devMenuBtn = document.getElementById('dev-menu-btn');
    if(devMenuBtn){
        if(isOn) devMenuBtn.classList.remove('hidden');
        else devMenuBtn.classList.add('hidden');
    }
    
    const mcDev = document.getElementById('btn-dev');
    if(mcDev) {
        if(isOn) mcDev.classList.remove('hidden');
        else mcDev.classList.add('hidden');
    }
    
    saveGraphicsSettings();
}

function toggleForceMobileControls(isOn){
    const mc = document.getElementById('mobile-controls');
    if(mc){
        if (typeof gameState !== 'undefined' && gameState !== 'PLAY' && gameState !== 'PAUSE') {
            // Only show controls if actually in-game. Editor or Main Menu should hide them
            mc.classList.add('hidden');
        } else {
            if(isOn || 'ontouchstart' in window || navigator.maxTouchPoints > 0) {
                mc.classList.remove('hidden');
            } else {
                mc.classList.add('hidden');
            }
        }
    }
    saveGraphicsSettings();
}

function toggleForceMenuFullscreen(isOn){
    const btnMainFs = document.getElementById('btn-main-fullscreen');
    if(btnMainFs){
        if(isOn || 'ontouchstart' in window || navigator.maxTouchPoints > 0) {
            btnMainFs.classList.remove('hidden');
        } else {
            btnMainFs.classList.add('hidden');
        }
    }
    saveGraphicsSettings();
}

// ============ UI LAYOUT EDITOR ============
let mcLayoutData = {};
let isEditingLayout = false;

function applyMobileLayout() {
    const movType = localStorage.getItem('lelembut_movement') || 'analog';
    const movSelect = document.getElementById('set-movement-type');
    if(movSelect) movSelect.value = movType;
    if(typeof changeMovementType === 'function') changeMovementType(movType);

    const saved = localStorage.getItem('lelembut_mc_layout');
    if(saved) {
        mcLayoutData = JSON.parse(saved);
        const scale = mcLayoutData.scale || 1.0;
        const opacity = mcLayoutData.opacity !== undefined ? mcLayoutData.opacity : 0.6;
        
        const slider = document.getElementById('mc-scale-slider');
        if(slider) slider.value = scale;
        
        const opacitySlider = document.getElementById('mc-opacity-slider');
        if(opacitySlider) opacitySlider.value = opacity;
        
        document.querySelectorAll('.mc-btn').forEach(btn => {
            const id = btn.id;
            // Apply scale and opacity
            btn.style.transform = `scale(${scale})`;
            btn.style.opacity = opacity;
            
            // Apply position if exists
            if(mcLayoutData[id]) {
                if (mcLayoutData[id].left !== undefined) btn.style.left = mcLayoutData[id].left;
                if (mcLayoutData[id].top !== undefined) btn.style.top = mcLayoutData[id].top;
                if (mcLayoutData[id].right !== undefined) btn.style.right = mcLayoutData[id].right;
                if (mcLayoutData[id].bottom !== undefined) btn.style.bottom = mcLayoutData[id].bottom;
            }
        });
    }
}

function startMobileLayoutEditor() {
    isEditingLayout = true;
    document.getElementById('settings-menu').classList.add('hidden');
    document.getElementById('mobile-layout-editor').classList.remove('hidden');
    
    const mc = document.getElementById('mobile-controls');
    mc.classList.remove('hidden');
    
    document.querySelectorAll('.mc-btn').forEach(btn => {
        btn.classList.add('edit-mode');
        // Do not convert to absolute percentages immediately, let CSS handle it.
        // It will only be converted when dragged.
        
        // Add drag listener
        btn.onpointerdown = startDragBtn;
    });
    
    const slider = document.getElementById('mc-scale-slider');
    if(slider) {
        slider.oninput = (e) => {
            const val = e.target.value;
            document.querySelectorAll('.mc-btn').forEach(b => {
                b.style.transform = `scale(${val})`;
            });
        };
    }
    
    const opacitySlider = document.getElementById('mc-opacity-slider');
    if(opacitySlider) {
        opacitySlider.oninput = (e) => {
            const val = e.target.value;
            document.querySelectorAll('.mc-btn').forEach(b => {
                b.style.opacity = val;
            });
        };
    }
}

let draggedBtn = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

function startDragBtn(e) {
    if(!isEditingLayout) return;
    e.preventDefault();
    draggedBtn = e.currentTarget;
    
    // Get unscaled position relative to parent to avoid jump when scaled
    const offX = draggedBtn.offsetLeft;
    const offY = draggedBtn.offsetTop;
    
    draggedBtn.style.left = offX + 'px';
    draggedBtn.style.top = offY + 'px';
    draggedBtn.style.bottom = 'auto';
    draggedBtn.style.right = 'auto';

    const rect = draggedBtn.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    
    window.addEventListener('pointermove', doDragBtn);
    window.addEventListener('pointerup', stopDragBtn);
}

function doDragBtn(e) {
    if(!draggedBtn) return;
    let x = e.clientX - dragOffsetX;
    let y = e.clientY - dragOffsetY;
    
    // We adjust by offsetParent's dimensions instead of window to support Safe Zone Padding
    const parent = draggedBtn.offsetParent || document.body;
    
    let pctX = (x / parent.clientWidth) * 100;
    let pctY = (y / parent.clientHeight) * 100;
    
    // Add offsetLeft back because x was relative to rect.left but we need relative to parent
    // Wait, x/y calculation above assumes draggedBtn's top-left is exactly at e.clientX - dragOffsetX.
    // That means x,y are absolute screen coordinates if we use clientX/clientY.
    // Instead of using parent.clientWidth directly for screen coords, let's just use window.
    pctX = (x / window.innerWidth) * 100;
    pctY = (y / window.innerHeight) * 100;
    
    draggedBtn.style.left = pctX + '%';
    draggedBtn.style.top = pctY + '%';
}

function stopDragBtn(e) {
    window.removeEventListener('pointermove', doDragBtn);
    window.removeEventListener('pointerup', stopDragBtn);
    draggedBtn = null;
}

function saveMobileLayout() {
    isEditingLayout = false;
    const data = {};
    const slider = document.getElementById('mc-scale-slider');
    data.scale = slider ? parseFloat(slider.value) : 1.0;
    
    const opacitySlider = document.getElementById('mc-opacity-slider');
    data.opacity = opacitySlider ? parseFloat(opacitySlider.value) : 0.6;
    
    document.querySelectorAll('.mc-btn').forEach(btn => {
        btn.classList.remove('edit-mode');
        btn.onpointerdown = null; // remove drag listener
        data[btn.id] = {
            left: btn.style.left,
            top: btn.style.top,
            right: btn.style.right,
            bottom: btn.style.bottom
        };
    });
    
    localStorage.setItem('lelembut_mc_layout', JSON.stringify(data));
    
    document.getElementById('mobile-layout-editor').classList.add('hidden');
    document.getElementById('settings-menu').classList.remove('hidden');
    
    // Hide controls if we are just in the menu
    if(typeof gameState !== 'undefined' && gameState !== 'PLAY' && gameState !== 'PAUSE') {
        document.getElementById('mobile-controls').classList.add('hidden');
    }
}

function cancelMobileLayout() {
    isEditingLayout = false;
    document.querySelectorAll('.mc-btn').forEach(btn => {
        btn.classList.remove('edit-mode');
        btn.onpointerdown = null; // remove drag listener
    });
    
    document.getElementById('mobile-layout-editor').classList.add('hidden');
    document.getElementById('settings-menu').classList.remove('hidden');
    
    // Undo unsaved layout changes
    applyMobileLayout();
    
    if(typeof gameState !== 'undefined' && gameState !== 'PLAY' && gameState !== 'PAUSE') {
        document.getElementById('mobile-controls').classList.add('hidden');
    }
}

function resetMobileLayout() {
    localStorage.removeItem('lelembut_mc_layout');
    localStorage.removeItem('lelembut_safe_zone');
    
    // Reset Safe Zone
    if(document.getElementById('ed-safezone')) document.getElementById('ed-safezone').value = 0;
    changeSafeZone(0);
    
    // Reset Sliders
    if(document.getElementById('mc-scale-slider')) document.getElementById('mc-scale-slider').value = 1.0;
    if(document.getElementById('mc-opacity-slider')) document.getElementById('mc-opacity-slider').value = 0.6;
    
    // Default positions mapping
    const defaults = {
        'btn-shoot-left': { bottom: '190px', left: '20px', right: '', top: '' },
        'btn-interact': { bottom: '170px', right: '100px', left: '', top: '' },
        'btn-reload': { bottom: '20px', right: '100px', left: '', top: '' },
        'btn-aim': { bottom: '100px', right: '20px', left: '', top: '' },
        'btn-shoot': { bottom: '170px', right: '20px', left: '', top: '' },
        'btn-light': { bottom: '20px', left: '230px', right: '', top: '' },
        'btn-aim-shoot': { bottom: '20px', left: '275px', right: '', top: '' },
        'btn-camera': { bottom: '20px', left: '320px', right: '', top: '' },
        'btn-dev': { bottom: '20px', left: '365px', right: '', top: '' },
        'btn-jump': { bottom: '20px', right: '20px', left: '', top: '' },
        'joystick-base': { bottom: '20px', left: '20px', right: '', top: '' }
    };
    
    document.querySelectorAll('.mc-btn').forEach(btn => {
        btn.style.transform = btn.id.includes('light') || btn.id.includes('aim-shoot') || btn.id.includes('camera') || btn.id.includes('dev') ? 'scale(0.7)' : 'none';
        btn.style.opacity = '1';
        if(defaults[btn.id]) {
            btn.style.left = defaults[btn.id].left;
            btn.style.top = defaults[btn.id].top;
            btn.style.right = defaults[btn.id].right;
            btn.style.bottom = defaults[btn.id].bottom;
        }
    });
    
    const jb = document.getElementById('joystick-base');
    if(jb) {
        jb.style.transform = 'none';
        jb.style.opacity = '1';
        jb.style.left = defaults['joystick-base'].left;
        jb.style.top = defaults['joystick-base'].top;
        jb.style.right = defaults['joystick-base'].right;
        jb.style.bottom = defaults['joystick-base'].bottom;
    }
}

// Load local settings synchronously
function loadLocalSettingsSync() {
    // Graphics Quality
    const savedGQ = localStorage.getItem('lelembut_graphics_quality') || 'high';
    window.graphicsQuality = savedGQ;
    if(document.getElementById('ed-graphics-quality')) document.getElementById('ed-graphics-quality').value = savedGQ;
    
    // Restore Ultra chromatic aberration filter if needed
    if (savedGQ === 'ultra') {
        const caFilter = 'url(#ca-ultra)';
        if (typeof _baseCanvasFilter !== 'undefined' && !_baseCanvasFilter.includes(caFilter)) {
            _baseCanvasFilter = caFilter + ' ' + _baseCanvasFilter;
            if(typeof gameCanvas !== 'undefined' && gameCanvas) gameCanvas.style.filter = _baseCanvasFilter;
        }
    }
    
    // Safe Zone
    const savedSafeZone = localStorage.getItem('lelembut_safe_zone') || 0;
    if(document.getElementById('ed-safezone')) document.getElementById('ed-safezone').value = savedSafeZone;
    changeSafeZone(savedSafeZone);
    
    // FPS
    const savedFps = localStorage.getItem('lelembut_show_fps');
    if(savedFps === '1') {
        window.showFPS = true;
        if(document.getElementById('set-show-fps')) document.getElementById('set-show-fps').checked = true;
    } else {
        window.showFPS = false;
        if(document.getElementById('set-show-fps')) document.getElementById('set-show-fps').checked = false;
    }
}

// Load settings on boot
window.addEventListener('load', () => {
    loadLocalSettingsSync();
    applyMobileLayout();
    loadSettings();
    if(typeof resizeWindow === 'function') resizeWindow();
});

function changeGraphicsQuality(type) {
    localStorage.setItem('lelembut_graphics_quality', type);
    window.graphicsQuality = type;
    console.log("Graphics Quality set to: " + type);
    // Apply / remove world-wide chromatic aberration CSS filter for Ultra
    const caFilter = 'url(#ca-ultra)';
    if (type === 'ultra') {
        // Prepend CA filter to the base filter string
        if (!_baseCanvasFilter.includes(caFilter)) {
            _baseCanvasFilter = caFilter + ' ' + _baseCanvasFilter;
        }
    } else {
        // Remove CA filter
        _baseCanvasFilter = _baseCanvasFilter.replace(caFilter + ' ', '').replace(caFilter, '').trim();
        if (!_baseCanvasFilter) _baseCanvasFilter = 'none';
    }
    gameCanvas.style.filter = _baseCanvasFilter;
    
    // Disable effects (animations, shadows, CRT) on medium and below
    if (type === 'medium' || type === 'low' || type === 'lowest' || type === 'ultralow') {
        document.body.classList.add('no-effects');
    } else {
        document.body.classList.remove('no-effects');
    }
    
    // Force canvas resize to apply new DPR scale
    if(typeof resizeWindow === 'function') resizeWindow();
}

function toggleShowFPS(isOn) {
    window.showFPS = isOn;
    localStorage.setItem('lelembut_show_fps', isOn ? '1' : '0');
}

