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
        devMenuEnabled: document.getElementById('set-devmode').checked,
        forceMobileControls: document.getElementById('set-force-mobile') ? document.getElementById('set-force-mobile').checked : false,
        forceMenuFullscreen: document.getElementById('set-force-fs').checked
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
                if(document.getElementById('set-force-mobile')) document.getElementById('set-force-mobile').checked = s.forceMobileControls || false;
                document.getElementById('set-force-fs').checked = s.forceMenuFullscreen || false;
                
                // Apply immediately
                toggleCRT(s.crt);
                toggleFilmMode(s.film);
                changeResolution(s.resolusi);
                updateGraphicsFilter();
                toggleDevMode(s.devMenuEnabled || false);
                if(document.getElementById('set-force-mobile')) toggleForceMobileControls(s.forceMobileControls || false);
                toggleForceMenuFullscreen(s.forceMenuFullscreen || false);
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
        if(isOn || 'ontouchstart' in window || navigator.maxTouchPoints > 0) {
            mc.classList.remove('hidden');
        } else {
            mc.classList.add('hidden');
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
    const movType = localStorage.getItem('lelembut_movement') || 'dpad';
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
                btn.style.left = mcLayoutData[id].left;
                btn.style.top = mcLayoutData[id].top;
                btn.style.right = 'auto'; // Clear right/bottom if we use left/top absolute positioning
                btn.style.bottom = 'auto';
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
        // Convert to percentage values so it works across different screen sizes
        const rect = btn.getBoundingClientRect();
        btn.style.left = (rect.left / window.innerWidth * 100) + '%';
        btn.style.top = (rect.top / window.innerHeight * 100) + '%';
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';
        
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
    let pctX = (x / window.innerWidth) * 100;
    let pctY = (y / window.innerHeight) * 100;
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
            top: btn.style.top
        };
    });
    
    localStorage.setItem('lelembut_mc_layout', JSON.stringify(data));
    
    document.getElementById('mobile-layout-editor').classList.add('hidden');
    document.getElementById('settings-menu').classList.remove('hidden');
    
    // Hide controls if we are just in the menu and force is not checked
    const isForce = document.getElementById('set-force-mobile') && document.getElementById('set-force-mobile').checked;
    if(gameState !== 'PLAY' && !isForce) {
        document.getElementById('mobile-controls').classList.add('hidden');
    }
}

function resetMobileLayout() {
    localStorage.removeItem('lelembut_mc_layout');
    location.reload(); // Quickest way to reset everything
}

// Load settings on boot
window.addEventListener('load', () => {
    loadSettings();
    applyMobileLayout();
});

function changeMovementType(type) {
    localStorage.setItem('lelembut_movement', type);
    const dpadBtns = ['btn-up', 'btn-down', 'btn-left', 'btn-right'].map(id => document.getElementById(id));
    const joystick = document.getElementById('joystick-base');
    
    if (type === 'analog') {
        dpadBtns.forEach(b => b && b.classList.add('hidden'));
        if(joystick) joystick.classList.remove('hidden');
    } else {
        dpadBtns.forEach(b => b && b.classList.remove('hidden'));
        if(joystick) joystick.classList.add('hidden');
    }
}

