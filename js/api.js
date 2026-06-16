// ============ API (Supabase Integration) ============

function showLoading(text="LOADING...") {
    const overlay = document.getElementById('loading-overlay');
    const textEl = document.getElementById('loading-text');
    if(overlay && textEl) {
        textEl.innerText = text;
        overlay.classList.remove('hidden');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if(overlay) overlay.classList.add('hidden');
}

// Migration function (only works on localhost where api.php exists)
window.migrateToSupabase = async function() {
    try {
        console.log("Starting migration from SQLite to Supabase...");
        const res = await fetch('api.php?action=list');
        const json = await res.json();
        
        if(!json.success || !json.levels) {
            alert("No levels found in local SQLite or api.php not accessible.");
            return;
        }

        let migratedCount = 0;
        for (const level of json.levels) {
            const levelDataRes = await fetch(`api.php?action=load&id=${level.id}`);
            const levelDataJson = await levelDataRes.json();
            
            if(levelDataJson.success) {
                // Insert into Supabase
                const { data, error } = await supabaseClient
                    .from('levels')
                    .insert([{ 
                        name: levelDataJson.level.name, 
                        data: levelDataJson.level.data 
                    }]);
                    
                if(error) {
                    console.error("Error migrating level:", level.name, error);
                } else {
                    console.log("Migrated:", level.name);
                    migratedCount++;
                }
            }
        }
        alert(`Migration complete! Successfully migrated ${migratedCount} levels to Supabase.`);
    } catch(e) {
        console.error(e);
        alert("Migration failed. Ensure you are running this from Laragon/localhost.");
    }
}

async function fetchLevels(mode){
    try {
        const { data: levels, error } = await supabaseClient
            .from('levels')
            .select('id, name, sort_order')
            .order('sort_order', { ascending: true });

        if (error) throw error;

        const list = document.getElementById(mode==='play'?'play-level-list':'edit-level-list');
        list.innerHTML = '';
        if(levels && levels.length>0){
            levelList = levels;
            levels.forEach(l=>{
                const d = document.createElement('div'); d.className='level-item';
                if(mode==='play'){
                    d.innerHTML = `<span>${l.name}</span> <div class="actions"><button class="ed-btn" onclick="playLevel(${l.id})"><i class="fa-solid fa-play"></i> Play</button></div>`;
                } else {
                    d.innerHTML = `<span>${l.name}</span> <div class="actions">
                        <button class="ed-btn" onclick="moveLevel(${l.id}, 'up')" title="Move Up"><i class="fa-solid fa-arrow-up"></i></button>
                        <button class="ed-btn" onclick="moveLevel(${l.id}, 'down')" title="Move Down"><i class="fa-solid fa-arrow-down"></i></button>
                        <button class="ed-btn" onclick="duplicateLevel(${l.id})"><i class="fa-solid fa-copy"></i> Duplicate</button>
                        <button class="ed-btn" onclick="loadEditorLevel(${l.id})"><i class="fa-solid fa-pen"></i> Edit</button>
                    </div>`;
                }
                list.appendChild(d);
            });
        } else { list.innerHTML = '<div style="color:#666">No levels found.</div>'; }
    } catch(e){ console.error(e); }
}

async function moveLevel(id, direction) {
    const idx = levelList.findIndex(l => l.id === id);
    if(idx === -1) return;
    
    let targetIdx = -1;
    if(direction === 'up' && idx > 0) targetIdx = idx - 1;
    if(direction === 'down' && idx < levelList.length - 1) targetIdx = idx + 1;
    
    if(targetIdx !== -1) {
        const currentLevel = levelList[idx];
        const targetLevel = levelList[targetIdx];
        
        // Swap sort_orders
        const tempOrder = currentLevel.sort_order;
        currentLevel.sort_order = targetLevel.sort_order;
        targetLevel.sort_order = tempOrder;
        
        try {
            await supabaseClient.from('levels').update({ sort_order: currentLevel.sort_order }).eq('id', currentLevel.id);
            await supabaseClient.from('levels').update({ sort_order: targetLevel.sort_order }).eq('id', targetLevel.id);
            fetchLevels('edit');
        } catch(e) {
            console.error("Error moving level", e);
            showToast("Error moving level");
        }
    }
}

async function playLevel(id){
    try {
        showLoading("LOADING LEVEL...");
        const { data, error } = await supabaseClient
            .from('levels')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        
        transitionTo(() => {
            currentLevelId = data.id;
            loadMapData(data.data);
            respawnPoint = {x: map.spawnX, y: map.spawnY, mapIdx: -1};
            respawnData = null;
            startGameplay();
            hideLoading();
        });
    } catch(e) { 
        hideLoading();
        showToast('Error loading level'); 
    }
}

function restartLevel(){
    transitionTo(() => {
        map.pickups.forEach(p=>p.got=0);
        startGameplay(true); // resetAll = true to reset HP
    });
}

function playNextLevel(){
    let idx = levelList.findIndex(l => l.id === currentLevelId);
    // Since we ordered descending, next level is actually idx - 1 if we want older levels, or just play the next in the list array
    if(idx !== -1 && idx < levelList.length - 1){
        playLevel(levelList[idx+1].id);
    } else {
        showToast("No more levels! Back to menu.");
        transitionTo('level-select');
    }
}

async function loadEditorLevel(id, duplicate=false){
    try {
        showLoading("LOADING EDITOR...");
        const { data, error } = await supabaseClient
            .from('levels')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error) throw error;

        transitionTo(() => {
            loadMapData(data.data);
            if(duplicate){
                currentLevelId = null;
                document.getElementById('level-name-input').value = data.name + ' (Copy)';
            } else {
                currentLevelId = data.id;
                document.getElementById('level-name-input').value = data.name;
            }
            startEditor();
            hideLoading();
        });
    } catch(e) { 
        hideLoading();
        showToast('Error loading level'); 
    }
}

async function duplicateLevel(id){
    try {
        const { data: original, error: fetchErr } = await supabaseClient
            .from('levels')
            .select('*')
            .eq('id', id)
            .single();
            
        if (fetchErr) throw fetchErr;

        const newName = original.name + ' (Copy)';
        const { data: saved, error: saveErr } = await supabaseClient
            .from('levels')
            .insert([{ name: newName, data: original.data, sort_order: Date.now() }])
            .select()
            .single();

        if (saveErr) throw saveErr;
        
        showToast("Level duplicated!");
        fetchLevels('edit');
    } catch(e) { showToast('Error duplicating level'); }
}

function createNewLevel(){
    currentLevelId = null;
    initEmptyMap(100);
    document.getElementById('level-name-input').value = 'New Level';
    startEditor();
}

async function saveLevel(){
    const name = document.getElementById('level-name-input').value;
    const mapData = {
        cols: map.outdoor.cols, rows: map.outdoor.rows,
        tiles: map.outdoor.tiles,
        rooms: map.rooms,
        pickups: map.pickups,
        doors: map.doors,
        enemies: map.enemies,
        decorations: map.decorations,
        spawnX: map.spawnX, spawnY: map.spawnY,
        bgY: map.bgY,
        fog: map.fog,
        weather: map.weather
    };
    
    try {
        showLoading("SAVING LEVEL...");
        if (currentLevelId) {
            // Update
            const { data, error } = await supabaseClient
                .from('levels')
                .update({ name: name, data: mapData })
                .eq('id', currentLevelId)
                .select()
                .single();
            if (error) throw error;
            currentLevelId = data.id;
        } else {
            // Insert
            const { data, error } = await supabaseClient
                .from('levels')
                .insert([{ name: name, data: mapData, sort_order: Date.now() }])
                .select()
                .single();
            if (error) throw error;
            currentLevelId = data.id;
        }
        isMapUnsaved = false;
        hideLoading();
        return true;
    } catch(e){ 
        console.error(e);
        hideLoading();
        showToast('Error saving level'); 
        return false; 
    }
}

async function saveAndPlay(){
    const ok = await saveLevel();
    if(ok){
        stopEditor();
        respawnPoint = {x: map.spawnX, y: map.spawnY, mapIdx: -1};
        respawnData = null;
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

// ============ GLOBAL DEV SETTINGS ============
let globalSettings = null;

async function fetchGlobalSettings() {
    try {
        const { data, error } = await supabaseClient.from('global_settings').select('*').eq('id', 1).single();
        if(error && error.code !== 'PGRST116') throw error; // PGRST116 is no rows
        
        if(data) {
            globalSettings = data;
            // Update UI sliders if in Dev Menu
            if(data.visuals) {
                const s = document.getElementById('dev-sat');
                const c = document.getElementById('dev-con');
                const b = document.getElementById('dev-bri');
                if(s && c && b) {
                    s.value = data.visuals.saturation || 100;
                    c.value = data.visuals.contrast || 100;
                    b.value = data.visuals.brightness || 100;
                }
                applyVisuals(data.visuals);
            }
            if(data.dev_notes !== undefined) {
                const txt = document.getElementById('dev-notes');
                if(txt) txt.value = data.dev_notes;
            }
            if(data.controls && Object.keys(data.controls).length > 0) {
                if(typeof loadBinds === 'function') loadBinds();
            }
        }
    } catch(e) {
        console.error("Error fetching global settings:", e);
    }
}

function previewVisuals() {
    const s = document.getElementById('dev-sat').value;
    const c = document.getElementById('dev-con').value;
    const b = document.getElementById('dev-bri').value;
    
    document.getElementById('val-sat').innerText = s;
    document.getElementById('val-con').innerText = c;
    document.getElementById('val-bri').innerText = b;
    
    applyVisuals({ saturation: s, contrast: c, brightness: b });
}

function resetVisuals() {
    document.getElementById('dev-sat').value = 100;
    document.getElementById('dev-con').value = 100;
    document.getElementById('dev-bri').value = 100;
    previewVisuals();
}

function applyVisuals(v) {
    const s = v.saturation || 100;
    const c = v.contrast || 100;
    const b = v.brightness || 100;
    document.body.style.filter = `saturate(${s}%) contrast(${c}%) brightness(${b}%)`;
}

async function saveGlobalVisuals() {
    try {
        showLoading("SAVING CONFIG...");
        const s = parseInt(document.getElementById('dev-sat').value);
        const c = parseInt(document.getElementById('dev-con').value);
        const b = parseInt(document.getElementById('dev-bri').value);
        
        const newVisuals = { saturation: s, contrast: c, brightness: b };
        const { error } = await supabaseClient.from('global_settings')
            .update({ visuals: newVisuals })
            .eq('id', 1);
            
        hideLoading();
        if(error) throw error;
        showToast("Global Visuals Applied");
    } catch(e) {
        hideLoading();
        console.error(e);
        showToast("Error saving visuals");
    }
}

async function saveGlobalNotes() {
    try {
        showLoading("SAVING NOTES...");
        const text = document.getElementById('dev-notes').value;
        const { error } = await supabaseClient.from('global_settings')
            .update({ dev_notes: text })
            .eq('id', 1);
            
        hideLoading();
        if(error) throw error;
        showToast("Notes Saved Globally");
    } catch(e) {
        hideLoading();
        console.error(e);
        showToast("Error saving notes");
    }
}

async function saveGlobalControls() {
    try {
        if(typeof binds === 'undefined') {
            showToast("Binds not loaded yet");
            return;
        }
        showLoading("SAVING CONTROLS...");
        const { error } = await supabaseClient.from('global_settings')
            .update({ controls: binds })
            .eq('id', 1);
            
        hideLoading();
        if(error) throw error;
        showToast("Controls Saved as Global Default");
    } catch(e) {
        hideLoading();
        console.error(e);
        showToast("Error saving controls");
    }
}

// Call on startup
window.addEventListener('load', fetchGlobalSettings);

