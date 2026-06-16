const player={x:0,y:0,w:20,h:32,vx:0,vy:0,speed:250,jumpPower:-420,grounded:false, isWater:false,
right:true,hp:100,maxHp:100, reloadCd:0, battery:100, maxBattery:100, flashlightOn:true, autoBattery:true, flashlightAnim:1.0, nvTimer:0, breath:20, maxBreath:20, breathDmgTimer:0, bullets:[],fireCd:0,coyote:0,jbuf:0,invT:0, bobPhase:0, highestY: 0,
weapons: [
    {id: 'pistol', name: 'Pistol', ammo: 40, maxAmmo: 120, mag: 10, maxMag: 10, fireCdTime: 0.32, reloadTime: 1.0, damage: 10, bulletSpeed: 600, color: '#ffee00', unlocked: true},
    {id: 'mg', name: 'Machine Gun', ammo: 0, maxAmmo: 200, mag: 0, maxMag: 30, fireCdTime: 0.08, reloadTime: 1.5, damage: 5, bulletSpeed: 800, color: '#ffcc00', unlocked: false},
    {id: 'sniper', name: 'Sniper', ammo: 0, maxAmmo: 20, mag: 0, maxMag: 5, fireCdTime: 1.0, reloadTime: 2.5, damage: 50, bulletSpeed: 1500, color: '#ff6600', unlocked: false}
],
inventory: { medkit: 0, potion_speed: 0, potion_jump: 0, potion_shield: 0, grenade: 5, landmine: 5, smoke: 5 },
buffs: { speed: 0, jump: 0, shield: 0 },
weapIdx: 0,
get currentWeapon() { return this.weapons[this.weapIdx]; },
get ammo() { return this.currentWeapon.ammo; },
set ammo(v) { this.currentWeapon.ammo = v; },
get maxAmmo() { return this.currentWeapon.maxAmmo; },
get mag() { return this.currentWeapon.mag; },
set mag(v) { this.currentWeapon.mag = v; },
get maxMag() { return this.currentWeapon.maxMag; }
};
let devMode = false;
let devMenuEnabled = false;
let victory = false;

function playerDamage(amt, sourceX){
    if(devMode || player.invT>0 || gameState!=='PLAY') return;
    player.hp-=amt; player.invT=1; camShake = 15; Audio.damage();
    if(sourceX !== undefined) {
        player.vx = (player.x + player.w/2 < sourceX) ? -120 : 120;
        player.vy = -120;
    }
    const fl=document.getElementById('dmg-flash');fl.classList.add('active');setTimeout(()=>fl.classList.remove('active'),100);
    pEmit(player.x+player.w/2,player.y+player.h/2,8,'#ff0000',30,60,200);
    updateHUD();
}
function updateHUD(){
    document.getElementById('hp-bar').style.width=(Math.max(0,player.hp)/player.maxHp*100)+'%';
    
    // Heartbeat logic
    Audio.heartbeat(player.hp > 0 && player.hp / player.maxHp < 0.25);
    
    // Battery icon change based on 25, 50, 75
    const bIcon = document.getElementById('battery-icon');
    let bPct = player.battery / player.maxBattery;
    if(bPct > 0.75) bIcon.className = 'fa-solid fa-battery-full';
    else if(bPct > 0.50) bIcon.className = 'fa-solid fa-battery-three-quarters';
    else if(bPct > 0.25) bIcon.className = 'fa-solid fa-battery-half';
    else if(bPct > 0.0) bIcon.className = 'fa-solid fa-battery-quarter';
    else bIcon.className = 'fa-solid fa-battery-empty';

    const lContainer = document.getElementById('lungs-container');
    const lIcon = document.getElementById('lungs-icon');
    if (lContainer && lIcon) {
        if(player.isWater) {
            lContainer.style.display = 'flex';
            let pct = Math.max(0, player.breath / player.maxBreath);
            if (player.breath <= 0) {
                lIcon.style.color = '#220000';
            } else {
                let gb = Math.floor(255 * pct);
                lIcon.style.color = `rgb(255, ${gb}, ${gb})`;
            }
        } else {
            lContainer.style.display = 'none';
        }
    }

    const nvContainer = document.getElementById('nv-container');
    if(nvContainer) {
        nvContainer.style.display = player.nvTimer > 0 ? 'flex' : 'none';
    }

    const ammoTxt = document.getElementById('ammo-txt');
    if(ammoTxt && ammoTxt.innerText !== `${player.mag}/${player.ammo}`) {
        ammoTxt.innerText = `${player.mag}/${player.ammo}`;
        ammoTxt.classList.remove('pop-anim');
        void ammoTxt.offsetWidth; // trigger reflow
        ammoTxt.classList.add('pop-anim');
    }
    
    const reloadIcon = document.getElementById('reload-icon');
    const magEmptyIcon = document.getElementById('mag-empty-icon');
    if (reloadIcon) {
        if(player.reloadCd > 0) reloadIcon.classList.remove('hidden');
        else reloadIcon.classList.add('hidden');
    }
    if (magEmptyIcon) {
        if(player.mag === 0) magEmptyIcon.classList.remove('hidden');
        else magEmptyIcon.classList.add('hidden');
    }
    if(currentMapIdx !== -1) {
        document.getElementById('room-label').innerText = 'Room ' + currentMapIdx;
        document.getElementById('room-label').classList.remove('hidden');
    } else document.getElementById('room-label').classList.add('hidden');

    const fl=document.getElementById('dmg-flash');
    if(player.hp <= player.maxHp * 0.2 && player.hp > 0) fl.classList.add('critical');
    else fl.classList.remove('critical');
    
    const aimIcon = document.getElementById('aim-lock-icon');
    const aimDirTxt = document.getElementById('aim-dir-txt');
    if(aimMode === 'mouse') {
        aimIcon.style.display = 'flex';
        aimDirTxt.innerHTML = '';
        aimIcon.querySelector('.hud-icon').innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
    } else if(aimLock !== 0) {
        aimIcon.style.display = 'flex';
        aimDirTxt.innerHTML = '';
        aimIcon.querySelector('.hud-icon').innerHTML = aimLock === -1 ? '<i class="fa-solid fa-arrow-up"></i>' : '<i class="fa-solid fa-arrow-down"></i>';
    } else {
        aimIcon.style.display = 'none';
    }
}

function spawnEnemiesForCurrentMap(){
    activeEnemies = [];
    if(!map || !map.enemies) return;
    map.enemies.forEach(e=>{
        const mIdx = e.mapIdx || -1;
        if(mIdx === currentMapIdx) {
            const type = e.type || 'enemy';
            if(type === 'kuyang') {
                activeEnemies.push({x:e.x, y:e.y, w:24, h:24, vx:0, vy:0, hp:30, maxHp:30, displayHp:30, dead:false, flash:0, speed:120, state:'chase', atkCd:0, type:'kuyang', hitAndRun: 0, runVx:0, runVy:0});
            } else if(type === 'stalker') {
                activeEnemies.push({x:e.x, y:e.y, w:24, h:46, vx:0, vy:0, grounded:false, hp:80, maxHp:80, displayHp:80, dead:false, flash:0, speed:130, patDir:1, patT:0, patI:2+Math.random()*2, state:'chase', atkCd:0, type:'stalker'});
            } else {
                activeEnemies.push({x:e.x, y:e.y, w:26, h:34, vx:0, vy:0, grounded:false, hp:50, maxHp:50, displayHp:50, dead:false, flash:0, speed:70, patDir:1, patT:0, patI:2+Math.random()*2, state:'patrol', atkCd:0, type:'enemy'});
            }
        }
    });
}

function showPickupNotif(iconHtml, text) {
    const container = document.getElementById('pickup-notifs');
    if(!container) return;
    const notif = document.createElement('div');
    notif.className = 'pickup-notif';
    notif.innerHTML = `${iconHtml} <span>${text}</span>`;
    container.appendChild(notif);
    setTimeout(() => {
        if(container.contains(notif)) container.removeChild(notif);
    }, 3000);
}

function toggleInventory() {
    if(gameState === 'PLAY') {
        gameState = 'INVENTORY';
        Audio.ui('inventory');
        Audio.walk(false); // Stop walking sound when opening inventory
        const invMenu = document.getElementById('inventory-menu');
        if(invMenu) invMenu.classList.remove('hidden');
        renderInventory();
        
        const mc = document.getElementById('mobile-controls');
        if(mc) mc.classList.add('hidden');
    } else if(gameState === 'INVENTORY') {
        gameState = 'PLAY';
        const invMenu = document.getElementById('inventory-menu');
        if(invMenu) invMenu.classList.add('hidden');
        
        const mc = document.getElementById('mobile-controls');
        const isForce = document.getElementById('set-force-mobile') && document.getElementById('set-force-mobile').checked;
        if(isForce || 'ontouchstart' in window || navigator.maxTouchPoints > 0) {
            if(mc) mc.classList.remove('hidden');
        }
    }
}

function toggleAutoBattery() {
    player.autoBattery = !player.autoBattery;
    renderInventory();
}

function renderInventory() {
    const sContainer = document.getElementById('inv-stats');
    if(sContainer) {
        const hpPct = Math.round((player.hp / player.maxHp) * 100);
        const batPct = Math.round((player.battery / player.maxBattery) * 100);
        sContainer.innerHTML = `
            <div style="background:#222; padding:10px; border-radius:5px; border-left:4px solid #ff4444; flex:1;">
                <i class="fa-solid fa-heart" style="color:#ff4444;"></i> Health: ${hpPct}% (${Math.round(player.hp)}/${player.maxHp})
            </div>
            <div style="background:#222; padding:10px; border-radius:5px; border-left:4px solid #00ffcc; flex:1; display:flex; justify-content:space-between; align-items:center;">
                <div><i class="fa-solid fa-battery-full" style="color:#00ffcc;"></i> Battery: ${batPct}%</div>
                <label style="font-size: 14px; cursor:pointer; display:flex; align-items:center; gap:5px;" title="Auto apply stored battery when below 15%">
                    <input type="checkbox" onchange="toggleAutoBattery()" ${player.autoBattery ? 'checked' : ''}> Auto Apply
                </label>
            </div>
        `;
    }

    const wContainer = document.getElementById('inv-weapons');
    if(wContainer) {
        wContainer.innerHTML = '';
        player.weapons.forEach((w, i) => {
            const icons = ['fa-gun', 'fa-person-rifle', 'fa-crosshairs'];
            const locked = !w.unlocked;
            const active = player.weapIdx === i;
            wContainer.innerHTML += `
                <div class="inv-card ${locked ? 'locked' : ''} ${active && !locked ? 'active' : ''}" onclick="switchWeapon(${i})">
                    <i class="fa-solid ${icons[i]}"></i>
                    <div class="amt">${w.name}</div>
                    <div class="amt">${locked ? 'Locked' : w.ammo}</div>
                </div>
            `;
        });
    }
    
    const iContainer = document.getElementById('inv-items');
    if(iContainer) {
        iContainer.innerHTML = '';
        const items = [
            { id: 'battery', name: 'Battery', icon: 'fa-battery-full', color: '#00ffcc' },
            { id: 'medkit', name: 'Medkit', icon: 'fa-suitcase-medical', color: '#ff4444' },
            { id: 'potion_speed', name: 'Speed Pot', icon: 'fa-flask', color: '#00ddff' },
            { id: 'potion_jump', name: 'Jump Pot', icon: 'fa-flask', color: '#ff00ff' },
            { id: 'potion_shield', name: 'Shield Pot', icon: 'fa-shield', color: '#ffff00' },
            { id: 'potion_nv', name: 'Night Vis', icon: 'fa-eye', color: '#00ff00' },
            { id: 'grenade', name: 'Grenade', icon: 'fa-bomb', color: '#ff4400' },
            { id: 'landmine', name: 'Landmine', icon: 'fa-compact-disc', color: '#aaaaaa' },
            { id: 'smoke', name: 'Smoke Gr.', icon: 'fa-cloud', color: '#888888' }
        ];
        items.forEach(item => {
            const count = player.inventory[item.id] || 0;
            const empty = count === 0;
            iContainer.innerHTML += `
                <div class="inv-card ${empty ? 'locked' : ''}" onclick="useItem('${item.id}')" style="border-color:${empty ? '' : item.color}; color:${item.color}">
                    <i class="fa-solid ${item.icon}"></i>
                    <div class="amt" style="color:#fff">${item.name}</div>
                    <div class="amt" style="color:#fff">x${count}</div>
                </div>
            `;
        });
    }
}

function useItem(id) {
    if(!player.inventory[id] || player.inventory[id] <= 0) return;
    
    if(id === 'battery') {
        if(player.battery >= player.maxBattery) {
            showToast("Battery is already full!");
            return;
        }
        player.battery = player.maxBattery;
        Audio.item('use');
        showToast("Battery Refilled!");
    } else if(id === 'medkit') {
        if(player.hp >= player.maxHp) { if(typeof showToast==='function') showToast("HP Full!"); return; }
        player.hp = Math.min(player.maxHp, player.hp + 50);
        Audio.item('use');
        if(typeof showToast==='function') showToast("Used Medkit +50 HP");
    } else if(id === 'potion_speed') {
        player.buffs.speed = 10;
        Audio.item('use');
        if(typeof showToast==='function') showToast("Speed Buff Active!");
    } else if(id === 'potion_jump') {
        player.buffs.jump = 10;
        Audio.item('use');
        if(typeof showToast==='function') showToast("Jump Buff Active!");
    } else if(id === 'potion_shield') {
        player.buffs.shield = 10;
        player.invT = 10;
        Audio.item('use');
        if(typeof showToast==='function') showToast("Shield Buff Active!");
    } else if(id === 'potion_nv') {
        player.nvTimer = 10;
        Audio.item('use');
        if(typeof showToast==='function') showToast("Night Vision Active!");
    } else if(id === 'grenade' || id === 'landmine' || id === 'smoke') {
        player.throwingItem = id;
        toggleInventory(); // close inventory, enter aiming mode
        return; // Wait for player click to throw
    }
    
    player.inventory[id]--;
    renderInventory();
    updateHUD();
}

