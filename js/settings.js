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
