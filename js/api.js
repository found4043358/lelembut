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
                respawnData = null;
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
async function duplicateLevel(id){
    try {
        const res = await fetch(`api.php?action=load&id=${id}`);
        const json = await res.json();
        if(json.success){
            const newName = json.level.name + ' (Copy)';
            const saveRes = await fetch('api.php?action=save', {
                method:'POST', body: JSON.stringify({id: null, name: newName, data: json.level.data})
            });
            const saveJson = await saveRes.json();
            if(saveJson.success){
                showToast("Level duplicated!");
                fetchLevels('edit');
            }
        }
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
    const data = {
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

