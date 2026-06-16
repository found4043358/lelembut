// ============ MAIN LOOP ============
const ctx=canvas.getContext('2d');
let lastT=0, gameOver=false;
let throwables = [];
let crumblingTiles = [];
let crackingTiles = []; // Cracked wood tiles that take damage

function damageCrackedWood(bx, by, dmg) {
    const r = Math.floor(by / TS), c = Math.floor(bx / TS);
    const d = getActiveMap();
    if(!d || !d.tiles || !d.tiles[r] || d.tiles[r][c] === undefined) return;
    // Check FG of the tile at this position
    const fg = getFg(d.tiles[r][c]);
    if(fg !== TILE_CRACKED_WOOD) return;
    let ct = crackingTiles.find(t => t.r===r && t.c===c && t.mapIdx===currentMapIdx);
    if(!ct) { ct = {r, c, mapIdx:currentMapIdx, hp:3, maxHp:3}; crackingTiles.push(ct); }
    ct.hp -= dmg;
    if(ct.hp <= 0) {
        // Remove FG, keep BG (set tile to BG value only)
        const bg = getBg(d.tiles[r][c]);
        d.tiles[r][c] = bg; // tile is now just BG (or empty)
        crackingTiles.splice(crackingTiles.indexOf(ct), 1);
        Audio.door();
        for(let j=0;j<20;j++) particles.push({x:c*TS+Math.random()*TS,y:r*TS+Math.random()*TS,vx:(Math.random()-0.5)*200,vy:(Math.random()-0.5)*200-100,life:0.6+Math.random()*0.4,maxLife:1,decay:1.2,color:'#7a4e2d',sz:3+Math.random()*5,g:300,type:'debris'});
    }
}

function triggerCrumble(r, c) {
    if(!crumblingTiles.find(t => t.r === r && t.c === c)) {
        crumblingTiles.push({r, c, timer: 1.0, mapIdx: currentMapIdx});
    }
}


function startGameplay(resetAll=true){
    setMenu('game'); gameOver=false; victory=false;
    devMode = false; // Always start fresh — P to toggle if devMenuEnabled
    canvas.style.filter = _baseCanvasFilter; // Ensure no grayscale on start
    currentMapIdx = respawnPoint.mapIdx;
    
    player.x = respawnPoint.x; player.y = respawnPoint.y;
    player.vx=0; player.vy=0; 
    player.right=true; // Ensure player faces right on spawn
    if(resetAll){ 
        player.hp=player.maxHp; 
        player.battery=player.maxBattery; 
        player.nvTimer=0;
        if(typeof respawnData !== 'undefined' && respawnData) {
            player.inventory = Object.assign({ battery: 0, medkit: 0, potion_speed: 0, potion_jump: 0, potion_shield: 0, potion_nv: 0, grenade: 0, landmine: 0, smoke: 0 }, JSON.parse(JSON.stringify(respawnData.inventory)));
            player.weapons = JSON.parse(JSON.stringify(respawnData.weapons));
            player.weapIdx = respawnData.weapIdx;
        } else {
            player.inventory = { battery: 0, medkit: 0, potion_speed: 0, potion_jump: 0, potion_shield: 0, potion_nv: 0, grenade: 0, landmine: 0, smoke: 0 };
            player.weapons.forEach(w => {
                w.ammo = w.id==='pistol'?40:0; w.mag = w.id==='pistol'?10:0;
                w.unlocked = w.id==='pistol';
            });
            player.weapIdx = 0;
        }
        player.buffs = { speed: 0, jump: 0, shield: 0 };
    }
    player.invT=2; // 2 seconds of spawn invincibility
    player.bullets=[]; 
    particles.length=0;
    throwables.length=0;
    crumblingTiles.length=0;
    crackingTiles.length=0;
    camShake = 0;
    camZoom = 4.0; camZoomTarget = 1.4; zoomState = 1;
    
    const m = getActiveMap();
    cam.mw = m.w; cam.mh = m.h + CH/2;
    cam.x = player.x + player.w/2 - CW/2;
    cam.y = player.y + player.h/2 - CH/2;
    camFollow(player.x + player.w/2, player.y + player.h/2, 0.016);
    spawnEnemiesForCurrentMap();
    updateHUD();
}

function resetGame(){
    const om=map.outdoor; player.x=om.w/2; player.y=om.h-200;
    player.vx=player.vy=0; player.hp=player.maxHp; 
    player.weapons.forEach(w => {
        w.ammo = w.id==='pistol'?40:0; w.mag = w.id==='pistol'?10:0;
        w.unlocked = w.id==='pistol';
    });
    player.weapIdx=0; player.battery=100; player.nvTimer=0;
    player.inventory = { battery: 0, medkit: 0, potion_speed: 0, potion_jump: 0, potion_shield: 0, potion_nv: 0, grenade: 0, landmine: 0, smoke: 0 };
    player.buffs = { speed: 0, jump: 0, shield: 0 };
    player.bullets=[]; activeEnemies=[]; particles=[];
    Object.assign(player, {invT:0,fireCd:0,reloadCd:0,coyote:0,jbuf:0});
    cam.x=player.x-CW/2;cam.y=player.y-CH/2;
    currentMapIdx = -1; // reset to outdoor
    if(map.spawnX!==undefined && map.spawnY!==undefined){
        player.x = map.spawnX; player.y = map.spawnY;
    }
    loadCurrentMapEntities();
    updateHUD(); updateVisionUI();
}

function switchWeapon(idx) {
    if(idx >= 0 && idx < player.weapons.length && player.weapIdx !== idx) {
        if(!player.weapons[idx].unlocked) return; // Prevent switching to locked weapons
        player.weapIdx = idx;
        player.reloadCd = 0; // Cancel reload
        player.fireCd = 0.5; // Short delay before firing new weapon
        showPickupNotif(`<i class="fa-solid fa-gun"></i>`, `Switched to ${player.currentWeapon.name}`);
        updateHUD();
        if(typeof renderInventory === 'function') renderInventory();
    }
}

function updatePlay(dt){
    if(gameOver || victory) return;

    if(devMode){
        const flySpd=500; player.vx=0; player.vy=0;
        if(keys.l){player.x-=flySpd*dt;player.right=false;}
        if(keys.r){player.x+=flySpd*dt;player.right=true;}
        if(keys.u)player.y-=flySpd*dt;
        if(keys.d)player.y+=flySpd*dt;
        player.grounded=true;
    } else {
        let isIce = false, isWater = false, isLadder = false;
        const col = Math.floor((player.x+player.w/2)/TS);
        const rowBelow = Math.floor((player.y+player.h+2)/TS);
        const rowCenter = Math.floor((player.y+player.h/2)/TS);
        
        if(player.grounded && mapTile(col, rowBelow) === TILE_ICE) isIce = true;
        
        const centerTile = mapTile(col, rowCenter);
        if(centerTile === TILE_WATER) isWater = true;
        if(centerTile === TILE_LADDER) isLadder = true;
        
        player.isWater = isWater;
        
        // Splash effect when entering water
        if(isWater && !player.wasInWater) {
            for(let i=0; i<15; i++) {
                particles.push({
                    x: player.x + Math.random()*player.w, 
                    y: player.y + player.h/2,
                    vx: (Math.random()-0.5)*100, 
                    vy: -Math.random()*150 - 50,
                    life: 0.8, maxLife: 0.8,
                    color: 'rgba(200, 230, 255, 0.8)',
                    size: 3 + Math.random()*3
                });
            }
        }
        player.wasInWater = isWater;
        
        // Bubbles while swimming
        if (isWater && Math.abs(player.vx) > 10 && Math.random() < 0.1) {
            particles.push({
                x: player.x + Math.random()*player.w, 
                y: player.y + player.h/2 + Math.random()*10,
                vx: -player.vx * 0.1, 
                vy: -Math.random()*20,
                life: 1, maxLife: 1,
                color: 'rgba(255, 255, 255, 0.6)',
                size: 1 + Math.random()*2
            });
        }

        let dir=0; if(keys.l)dir-=1; if(keys.r)dir+=1;
        
        // Handle Buffs
        let buffActive = false;
        if(player.buffs.speed > 0) { player.buffs.speed -= dt; if(player.buffs.speed < 0) player.buffs.speed = 0; buffActive = true; }
        if(player.buffs.jump > 0) { player.buffs.jump -= dt; if(player.buffs.jump < 0) player.buffs.jump = 0; buffActive = true; }
        if(player.buffs.shield > 0) { player.buffs.shield -= dt; if(player.buffs.shield < 0) player.buffs.shield = 0; player.invT = 1; buffActive = true; }
        if(buffActive) updateHUD();

        const accel = isWater ? 1000 : 2200;
        let maxSpd = isWater ? 120 : 280;
        if(player.buffs.speed > 0) maxSpd *= 1.5;
        const friction = isIce ? 300 : (isWater ? 1200 : 1800);

        if(dir!==0){
            player.vx+=dir*accel*dt; player.right=dir>0; 
            if(player.grounded&&!isIce&&!isWater&&Math.random()<.08)pDust(player.x+player.w/2,player.y+player.h,dir);
        } else {
            const f=friction*dt; player.vx=player.vx>0?Math.max(0,player.vx-f):Math.min(0,player.vx+f);
        }
        player.vx=Math.max(-maxSpd,Math.min(player.vx,maxSpd));
        if(player.grounded&&Math.abs(player.vx)>10)player.bobPhase+=dt*10;
        if(keys.jpressed){player.jbuf=.12;keys.jpressed=0;} else if(player.jbuf>0)player.jbuf-=dt;
        
        if(isWater) {
            player.breath -= dt;
            if(player.breath <= 0) {
                player.breathDmgTimer -= dt;
                if(player.breathDmgTimer <= 0) {
                    playerDamage(10);
                    player.breathDmgTimer = 1.0;
                }
            }
        } else {
            player.breath = player.maxBreath;
            player.breathDmgTimer = 0;
        }

        let wasG = player.grounded;
        if(isLadder) {
            // Ladder climbing logic
            let climbDir = 0;
            if(keys.u || keys.jump) climbDir -= 1;
            if(keys.d) climbDir += 1;
            
            if(climbDir !== 0) {
                player.vy = climbDir * 150;
            } else {
                player.vy = 0; // hang on ladder
            }
            player.grounded = true; // count as grounded to allow jumps off it
        } else {
            const grav = isWater ? 600 : 1500;
            const maxFall = isWater ? 200 : 600;
            player.vy+=grav*dt; if(player.vy>maxFall)player.vy=maxFall;
            if(player.grounded)player.coyote=.1;else player.coyote-=dt;
            
            player.grounded=false;
            if(player.jbuf>0 && (player.coyote>0 || isWater)){
                let jumpPow = isWater ? -300 : -610;
                if(player.buffs.jump > 0) jumpPow *= 1.3;
                player.vy = jumpPow;
                player.jbuf=0;player.coyote=0;
                if(!isWater) pEmit(player.x+player.w/2,player.y+player.h,5,'rgba(220,220,220,.6)',25,60,200);
                else {
                    // Bubbles on swimming up
                    for(let i=0; i<3; i++) {
                        particles.push({
                            x: player.x + Math.random()*player.w, 
                            y: player.y + player.h,
                            vx: (Math.random()-0.5)*20, 
                            vy: Math.random()*20,
                            life: 1, maxLife: 1,
                            color: 'rgba(255, 255, 255, 0.6)',
                            size: 1 + Math.random()*3
                        });
                    }
                }
            }
            if(!keys.jump&&player.vy<0)player.vy+=grav*.5*dt;
        }
        
        moveAndCollide(player,dt);
        if(!wasG && player.grounded && !isWater && !isIce) {
            pEmit(player.x+player.w/2,player.y+player.h,5,'rgba(180,180,180,.7)',15,45,200);
            
            // Calculate fall damage
            const fallDist = player.y - player.highestY;
            if(fallDist > TS * 7) { // Only take damage if fallen more than 7 tiles
                const dmg = Math.floor((fallDist - TS*7) / 10);
                if(dmg > 0) playerDamage(dmg);
            }
            player.highestY = player.y; // Reset highest point upon landing
        } else if (!player.grounded) {
            if(player.vy < 0 || player.y < player.highestY) {
                player.highestY = player.y; // Track the highest point while airborne
            }
        } else {
            player.highestY = player.y;
        }
    }
        // Weapon stats
        const cw = player.currentWeapon;
        // Reload block
        if(player.reloadCd > 0) {
            player.reloadCd -= dt;
            if(player.reloadCd <= 0) {
                const need = cw.maxMag - cw.mag;
                const toReload = Math.min(need, cw.ammo);
                cw.mag += toReload;
                cw.ammo -= toReload;
                updateHUD();
            }
        } else if(keys.rpressed && cw.mag < cw.maxMag && cw.ammo > 0) {
            player.reloadCd = cw.reloadTime;
            updateHUD();
        }
        keys.rpressed = 0; // Prevent queued reloads!

        player.fireCd-=dt;
        const gunOx = player.x + player.w/2;
        const gunOy = player.y + player.h/2;
        
        let gunAngle = player.right ? 0 : Math.PI;
        if(aimMode === 'mouse' && typeof mouseX !== 'undefined' && typeof mouseY !== 'undefined') {
            const dx = (cam.x + mouseX) - gunOx;
            const dy = (cam.y + mouseY) - gunOy;
            gunAngle = Math.atan2(dy, dx);
            player.right = Math.abs(gunAngle) < Math.PI/2;
        } else if(aimMode === 'keyboard') {
            if(keys.u) gunAngle = player.right ? -Math.PI/4 : -3*Math.PI/4;
            if(keys.d) gunAngle = player.right ? Math.PI/4 : 3*Math.PI/4;
            if(keys.u && !keys.l && !keys.r) gunAngle = -Math.PI/2;
            if(keys.d && !keys.l && !keys.r && !player.grounded) gunAngle = Math.PI/2;
        }
        player.gunAngle = gunAngle;

        if(keys.shoot && cw.mag > 0 && player.fireCd <= 0 && player.reloadCd <= 0){
            cw.mag--; 
            player.fireCd = cw.fireCdTime; 
            Audio.shoot();
            
            const bx = gunOx + Math.cos(gunAngle) * 16;
            const by = gunOy + Math.sin(gunAngle) * 16;
            
            const bSpeed = cw.bulletSpeed;
            let bvx = Math.cos(gunAngle) * bSpeed;
            let bvy = Math.sin(gunAngle) * bSpeed;
            
            player.bullets.push({x:bx, y:by, vx:bvx, vy:bvy, life:1.2, dmg: cw.damage, color: cw.color});
            pEmit(bx,by,3,cw.color,25,55,100); 
            // Muzzle flash
            pEmit(bx, by, 5, '#ffaa00', 80, 150, 150);
            pEmit(bx, by, 3, '#ffffff', 100, 200, 100);
            updateHUD();
        } else if(keys.shoot && cw.mag === 0 && cw.ammo > 0 && player.reloadCd <= 0 && player.fireCd <= 0) {
            player.reloadCd = cw.reloadTime; // auto reload
            updateHUD();
        }

        for(let i=player.bullets.length-1;i>=0;i--){
            const b=player.bullets[i]; b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
            if(isSolidTile(mapTile(Math.floor(b.x/TS),Math.floor(b.y/TS)))||b.life<=0){
                // Bullet impact light spark particles
                const now = performance.now();
                if(!b._lastImpact || now - b._lastImpact > 50) {
                    const sparkCount = 5 + Math.floor(Math.random()*4);
                    for(let s=0; s<sparkCount; s++) {
                        const angle = Math.random() * Math.PI * 2;
                        const spd = 60 + Math.random() * 120;
                        particles.push({
                            x: b.x, y: b.y,
                            vx: Math.cos(angle) * spd,
                            vy: Math.sin(angle) * spd - 30,
                            life: 0.15 + Math.random() * 0.2,
                            maxLife: 0.35,
                            color: s < 2 ? 'rgba(255,255,200,0.95)' : 'rgba(255,160,50,0.8)',
                            size: 1.5 + Math.random() * 2
                        });
                    }
                }
                pEmit(b.x,b.y,3,'#ff9900',15,40,150);
                // Check if bullet hit cracked wood
                damageCrackedWood(b.x, b.y, 1);
                player.bullets.splice(i,1); continue;
            }
            for(const e of activeEnemies){
                if(e.dead)continue;
                if(b.x>e.x&&b.x<e.x+e.w&&b.y>e.y&&b.y<e.y+e.h){
                    const dmg = b.dmg;
                    e.hp-=dmg;e.flash=1; pEmit(b.x,b.y,6,b.color,30,70,200);
                    pText(e.x+e.w/2, e.y, dmg.toString(), b.color);
                    if(e.hp<=0){e.dead=true;pEmit(e.x+e.w/2,e.y+e.h/2,12,'#880000',40,90,200);}
                    player.bullets.splice(i,1);break;
                }
            }
        } 

    if(player.invT>0)player.invT-=dt;
    for(const pk of map.pickups){
        if(pk.mapIdx !== currentMapIdx) continue;
        if(pk.got)continue;
        const cx=pk.x+TS/2,cy=pk.y+TS/2;
        // AABB collision instead of just center point
        if(player.x < pk.x + TS && player.x + player.w > pk.x && 
           player.y < pk.y + TS && player.y + player.h > pk.y){
            pk.got=1;
            if(pk.t==='ammo'){
                Audio.pick(); 
                let w = player.weapons[0]; // pistol
                w.ammo=Math.min(w.maxAmmo, w.ammo+10);
                pEmit(cx,cy,8,'#ffcc00',40,80,150);
                showPickupNotif('<i class="fa-solid fa-box" style="color:#ffcc00;"></i>', '+10 Pistol Ammo');
            }
            else if(pk.t==='ammo_mg'){
                Audio.pick(); 
                let w = player.weapons[1]; // mg
                w.ammo=Math.min(w.maxAmmo, w.ammo+30);
                pEmit(cx,cy,8,'#ffcc00',40,80,150);
                showPickupNotif('<i class="fa-solid fa-boxes-stacked" style="color:#ffcc00;"></i>', '+30 MG Ammo');
            }
            else if(pk.t==='ammo_sniper'){
                Audio.pick(); 
                let w = player.weapons[2]; // sniper
                w.ammo=Math.min(w.maxAmmo, w.ammo+5);
                pEmit(cx,cy,8,'#ffcc00',40,80,150);
                showPickupNotif('<i class="fa-solid fa-box-open" style="color:#ffcc00;"></i>', '+5 Sniper Ammo');
            }
            else if(pk.t==='hp'){
                Audio.pick(); player.hp=Math.min(player.maxHp,player.hp+25);
                pEmit(cx,cy,8,'#ff4444',40,80,150);
                showPickupNotif('<i class="fa-solid fa-heart" style="color:#ff4444;"></i>', '+25 HP');
            }
            else if(pk.t==='battery'){
                Audio.pick(); 
                if(player.battery / player.maxBattery < 0.15) {
                    player.battery=player.maxBattery; 
                    showPickupNotif('<i class="fa-solid fa-battery-full" style="color:#00ffcc;"></i>', 'Battery Refilled');
                } else {
                    player.inventory.battery++;
                    showPickupNotif('<i class="fa-solid fa-battery-full" style="color:#00ffcc;"></i>', 'Battery Stored');
                }
                pEmit(cx,cy,8,'#00ffcc',40,80,150);
            }
            else if(pk.t==='nightvision'){
                Audio.pick(); 
                player.inventory.potion_nv = (player.inventory.potion_nv || 0) + 1;
                pEmit(cx,cy,8,'#00ff00',40,80,150);
                showPickupNotif('<i class="fa-solid fa-glasses" style="color:#00ff00;"></i>', 'Night Vision Stored');
            }
            else if(pk.t==='gun_mg'){
                Audio.pick(); player.weapons[1].unlocked = true;
                pEmit(cx,cy,10,'#ffaa00',50,100,150);
                showPickupNotif('<i class="fa-solid fa-gun" style="color:#ffaa00;"></i>', 'Machine Gun Unlocked!');
            }
            else if(pk.t==='gun_sniper'){
                Audio.pick(); player.weapons[2].unlocked = true;
                pEmit(cx,cy,10,'#ff4400',50,100,150);
                showPickupNotif('<i class="fa-solid fa-crosshairs" style="color:#ff4400;"></i>', 'Sniper Unlocked!');
            }
            else if(pk.t==='medkit'){
                Audio.pick(); player.inventory.medkit++;
                pEmit(cx,cy,8,'#ff4444',40,80,150);
                showPickupNotif('<i class="fa-solid fa-suitcase-medical" style="color:#ff4444;"></i>', 'Medkit');
            }
            else if(pk.t==='potion_speed'){
                Audio.pick(); player.inventory.potion_speed++;
                pEmit(cx,cy,8,'#00ddff',40,80,150);
                showPickupNotif('<i class="fa-solid fa-flask" style="color:#00ddff;"></i>', 'Speed Potion');
            }
            else if(pk.t==='potion_jump'){
                Audio.pick(); player.inventory.potion_jump++;
                pEmit(cx,cy,8,'#ff00ff',40,80,150);
                showPickupNotif('<i class="fa-solid fa-flask" style="color:#ff00ff;"></i>', 'Jump Potion');
            }
            else if(pk.t==='potion_shield'){
                Audio.pick(); player.inventory.potion_shield++;
                pEmit(cx,cy,8,'#ffff00',40,80,150);
                showPickupNotif('<i class="fa-solid fa-shield" style="color:#ffff00;"></i>', 'Shield Potion');
            }
            else if(pk.t==='grenade'){
                Audio.pick(); player.inventory.grenade++;
                pEmit(cx,cy,8,'#ff4400',40,80,150);
                showPickupNotif('<i class="fa-solid fa-bomb" style="color:#ff4400;"></i>', 'Grenade');
            }
            else if(pk.t==='landmine'){
                Audio.pick(); player.inventory.landmine++;
                pEmit(cx,cy,8,'#aaaaaa',40,80,150);
                showPickupNotif('<i class="fa-solid fa-compact-disc" style="color:#aaaaaa;"></i>', 'Landmine');
            }
            else if(pk.t==='smoke'){
                Audio.pick(); player.inventory.smoke++;
                pEmit(cx,cy,8,'#888888',40,80,150);
                showPickupNotif('<i class="fa-solid fa-cloud" style="color:#888888;"></i>', 'Smoke Grenade');
            }
            else if(pk.t==='check'){
                Audio.save(); 
                respawnPoint={x:pk.x, y:pk.y, mapIdx:currentMapIdx}; 
                respawnData={
                    inventory: JSON.parse(JSON.stringify(player.inventory)),
                    weapons: JSON.parse(JSON.stringify(player.weapons)),
                    weapIdx: player.weapIdx
                };
                showToast("Checkpoint Saved!");
            }
            else if(pk.t==='end'){Audio.save(); victory=true; transitionTo('victory-menu');}
            updateHUD();
        }
    }

    let canDoor = false;
    for(const dr of map.doors){
        if(dr.mapIdx !== currentMapIdx) continue;
        if(Math.abs((player.x+player.w/2)-dr.wx)<30 && Math.abs((player.y+player.h)-dr.wy)<20){
            canDoor = true;
            if(keys.ipressed){
                keys.ipressed = 0; Audio.door();
                if(dr.targetRoom !== -1 && !map.rooms[dr.targetRoom]){
                    showToast("Target Room " + dr.targetRoom + " doesn't exist!");
                    break;
                }
                transitionTo(() => {
                    const oldMapIdx = currentMapIdx;
                    currentMapIdx = dr.targetRoom;
                    const m = getActiveMap();
                    cam.mw = m.w; cam.mh = m.h + CH/2;
                    spawnEnemiesForCurrentMap();
                    const tgtDoor = map.doors.find(d => d.mapIdx === currentMapIdx && d.targetRoom === oldMapIdx);
                    if(tgtDoor){ player.x = tgtDoor.wx - player.w/2; player.y = tgtDoor.wy - player.h; }
                    else { player.x = m.w/2; player.y = m.h/2; }
                    cam.x = player.x - CW/2; cam.y = player.y - CH/2;
                    camFollow(player.x, player.y, 100);
                    updateHUD();
                });
                break;
            }
        }
    }
    const pr=document.getElementById('prompt-box');
    if(canDoor) pr.classList.remove('hidden'); else pr.classList.add('hidden');

    let aimDir = aimLock;
    if(keys.u) aimDir = -1;
    else if(keys.d) aimDir = 1;
    
    if(player.nvTimer > 0) {
        player.nvTimer -= dt;
        if(player.nvTimer < 0) player.nvTimer = 0;
    } else if(player.battery > 0 && player.flashlightOn) {
        player.battery -= dt * 1.5; 
        if(player.battery < 0) player.battery = 0;
        
        if (player.autoBattery && (player.battery / player.maxBattery <= 0.15) && player.inventory.battery > 0) {
            player.inventory.battery--;
            player.battery = player.maxBattery;
            showPickupNotif('<i class="fa-solid fa-battery-full" style="color:#00ffcc;"></i>', 'Auto-Reload Battery');
            if(gameState === 'INVENTORY') renderInventory();
        }
    }
    
    // UI update handled mainly in updateHUD, but we can do a quick check here or just rely on updateHUD being called periodically or on events. Actually updateHUD is better.
    // Wait, let's call updateHUD() when nvTimer ends or battery crosses thresholds?
    // The previous code had battery icon updates here. I'll just call updateHUD() every 0.5s or just leave it to the loop. 
    // Actually, I'll update the icon directly here to keep it smooth, but since it's just an icon class, it's fast.
    const bIcon = document.getElementById('battery-icon');
    if(bIcon) {
        let bPct = player.battery / player.maxBattery;
        if(bPct > 0.75) bIcon.className = 'fa-solid fa-battery-full';
        else if(bPct > 0.50) bIcon.className = 'fa-solid fa-battery-three-quarters';
        else if(bPct > 0.25) bIcon.className = 'fa-solid fa-battery-half';
        else if(bPct > 0.0) bIcon.className = 'fa-solid fa-battery-quarter';
        else bIcon.className = 'fa-solid fa-battery-empty';
    }
    
    lightUpdate(dt, player.right, aimDir, player.x, player.y);
    
    // Crumbling tiles
    for(let i=crumblingTiles.length-1; i>=0; i--) {
        let t = crumblingTiles[i];
        if (t.mapIdx !== currentMapIdx) continue;
        t.timer -= dt;
        if(Math.random() < 0.2) {
            particles.push({
                x: t.c*TS + Math.random()*TS, y: t.r*TS + Math.random()*10,
                vx: 0, vy: 20 + Math.random()*20, life: 0.5, maxLife: 0.5, decay: 1,
                color: '#aa8855', sz: 2 + Math.random()*2, g: 5, type: 'dust'
            });
        }
        if(t.timer <= 0) {
            const d = getActiveMap();
            const rawT = d.tiles[t.r][t.c];
            const bg = getBg(rawT);
            d.tiles[t.r][t.c] = bg; // Remove FG, keep BG
            Audio.door();
            for(let j=0; j<15; j++) {
                particles.push({
                    x: t.c*TS + Math.random()*TS, y: t.r*TS + Math.random()*TS,
                    vx: (Math.random()-0.5)*150, vy: (Math.random()-0.5)*150,
                    life: 0.5 + Math.random()*0.5, maxLife: 1.0, decay: 1,
                    color: '#aa8855', sz: 3 + Math.random()*4, g: 15, type: 'debris'
                });
            }
            crumblingTiles.splice(i, 1);
        }
    }
    
    // Process throwables
    for(let i=throwables.length-1; i>=0; i--){
        let t = throwables[i];
        
        if(t.type !== 'landmine' || !t.grounded) {
            t.vy += 1000 * dt; // gravity
            t.x += t.vx * dt;
            resolveX(t);
            t.y += t.vy * dt;
            resolveY(t);
            if(t.grounded) {
                t.vx *= 0.9; 
                if(Math.abs(t.vx) < 10) t.vx = 0;
            } else {
                t.vx *= 0.99;
            }
        }
        
        t.life -= dt;
        
        if(t.type === 'grenade' && t.life <= 0) {
            explodeAt(t.x + t.w/2, t.y + t.h/2, 120, 100);
            throwables.splice(i, 1);
            continue;
        } else if(t.type === 'landmine') {
            let triggered = false;
            for(const e of activeEnemies) {
                if(e.dead) continue;
                if(Math.hypot((t.x+t.w/2) - (e.x+e.w/2), (t.y+t.h/2) - (e.y+e.h/2)) < 30) {
                    triggered = true; break;
                }
            }
            if(triggered) {
                explodeAt(t.x + t.w/2, t.y + t.h/2, 100, 150);
                throwables.splice(i, 1);
                continue;
            }
        } else if(t.type === 'smoke') {
            if(t.grounded) t.vx = 0;
            if(Math.random() < 0.3) {
                particles.push({
                    x: t.x + t.w/2 + (Math.random()-0.5)*20,
                    y: t.y + t.h/2 + (Math.random()-0.5)*10,
                    vx: (Math.random()-0.5)*40,
                    vy: -10 - Math.random()*20,
                    life: 1, maxLife: 1.5, decay: 0.5,
                    color: 'rgba(150, 150, 150, 0.9)', sz: 30 + Math.random()*30, g: -10, type: 'smoke'
                });
            }
            if(t.life <= 0) {
                throwables.splice(i, 1);
                continue;
            }
        }
    }
    
    for(const e of activeEnemies){
        if(e.dead)continue;
        
        if(e.displayHp === undefined) e.displayHp = e.hp;
        if(e.displayHp > e.hp) e.displayHp -= (e.displayHp - e.hp) * 5 * dt + 5 * dt;
        if(e.displayHp < e.hp) e.displayHp = e.hp;

        const ecX = e.x + e.w/2;
        const ecY = e.y + e.h/2;
        const tileCenter = mapTile(Math.floor(ecX/TS), Math.floor(ecY/TS));
        const isEWater = tileCenter === TILE_WATER;
        const isELava = tileCenter === TILE_LAVA;
        
        let isFrozen = false;
        for(const t of throwables) {
            if(t.type === 'smoke' && t.grounded && Math.hypot((t.x+t.w/2) - ecX, (t.y+t.h/2) - ecY) < 150) {
                isFrozen = true; break;
            }
        }
        if(isFrozen) continue; // Skip enemy logic if frozen by smoke
        
        if (isELava) {
            e.hp -= 20 * dt; // Burn
            e.flash = 1;
            pEmit(ecX, e.y+e.h, 2, '#ff4400', 10, 40, 100);
            if(e.hp <= 0) {
                e.dead = true;
                pEmit(ecX, ecY, 15, '#ffaa00', 50, 100, 200);
                continue;
            }
        }
        
        const pDist = Math.sqrt(Math.pow(player.x+player.w/2 - ecX, 2) + Math.pow(player.y+player.h/2 - ecY, 2));

        if (e.type === 'kuyang') {
            let targetVx = 0, targetVy = 0;
            if (e.hitAndRun > 0) {
                e.hitAndRun -= dt;
                targetVx = e.runVx;
                targetVy = e.runVy;
            } else if (e.stuckT && e.stuckT > 0) {
                e.stuckT -= dt;
                targetVx = e.evadeVx || 0;
                targetVy = e.evadeVy || -e.speed; // Default evade is up
            } else {
                if (pDist < 500) {
                    const angle = Math.atan2((player.y+player.h/2) - ecY, (player.x+player.w/2) - ecX);
                    targetVx = Math.cos(angle) * e.speed;
                    targetVy = Math.sin(angle) * e.speed;
                }
            }
            
            // Very smooth movement via strong Lerp (8x per second)
            const lerpK = Math.min(1, 8 * dt);
            e.vx += (targetVx - e.vx) * lerpK;
            e.vy += (targetVy - e.vy) * lerpK;
            
            // Kuyang separation
            for(const other of activeEnemies){
                if(other === e || other.dead || other.type !== 'kuyang') continue;
                const sepDx = e.x - other.x;
                const sepDy = e.y - other.y;
                const sepDist = Math.sqrt(sepDx*sepDx + sepDy*sepDy);
                if(sepDist > 0 && sepDist < 40) {
                    const repel = (40 - sepDist) / 40;
                    e.vx += (sepDx / sepDist) * 80 * repel * dt; 
                    e.vy += (sepDy / sepDist) * 80 * repel * dt; 
                }
            }
            
            // Manual position update with wall sliding (avoids snap-blink of moveAndCollide)
            const nx = e.x + e.vx * dt;
            const ny = e.y + e.vy * dt;
            // Try X
            const hitX = isSolidTile(mapTile(Math.floor((nx + (e.vx>0?e.w-1:1))/TS), Math.floor((e.y+e.h/2)/TS)));
            if (!hitX) { 
                e.x = nx; 
            } else { 
                e.vx *= -0.3; 
                // If blocked horizontally, fly upward to find a way over!
                e.evadeVx = e.vx * 2;
                e.evadeVy = -e.speed * 1.5;
                e.stuckT = 0.5; // temporary evade state
            }
            
            // Try Y
            const hitY = isSolidTile(mapTile(Math.floor((e.x+e.w/2)/TS), Math.floor((ny + (e.vy>0?e.h-1:1))/TS)));
            if (!hitY) { 
                e.y = ny; 
            } else { 
                e.vy *= -0.3; 
                // If blocked vertically, fly sideways to slide along the block!
                e.evadeVy = e.vy * 2;
                e.evadeVx = (Math.random() > 0.5 ? 1 : -1) * e.speed;
                e.stuckT = 0.5;
            }
            
            if(e.atkCd > 0) e.atkCd -= dt;
            if (pDist < (e.w/2 + player.w/2) + 10 && e.atkCd <= 0 && e.hitAndRun <= 0) {
                playerDamage(15, e.x + e.w/2);
                e.atkCd = 1.0;
                e.hitAndRun = 1.5; 
                // Always fly upward (-Math.PI/2) with some slight randomness
                const runAngle = -Math.PI/2 + (Math.random() - 0.5) * 0.5;
                e.runVx = Math.cos(runAngle) * e.speed * 1.5;
                e.runVy = Math.sin(runAngle) * e.speed * 1.5; 
            }
            if(e.flash > 0) e.flash -= dt*5;
            continue; // Skip ground physics
        }

        // Enemy Separation — strong push so enemies never stack
        for(const other of activeEnemies){
            if(other === e || other.dead || other.type === 'kuyang') continue;
            const sepDx = e.x - other.x;
            const sepDy = e.y - other.y;
            const sepDist = Math.sqrt(sepDx*sepDx + sepDy*sepDy);
            const minDist = 28; // Minimum distance between two ground enemies
            if(sepDist > 0 && sepDist < minDist && Math.abs(sepDy) < 24) {
                const push = (minDist - sepDist) / minDist;
                e.vx += (sepDx / sepDist) * 120 * push; 
            }
        }
        
        const grav = isEWater ? 600 : 1500;
        const maxFall = isEWater ? 200 : 600;
        e.vy += grav * dt; if(e.vy > maxFall) e.vy = maxFall; 
        
        const dist = Math.abs(player.x - e.x);
        
        if(!e.stuckT) e.stuckT = 0;
        if(e.stuckT > 0) {
            e.stuckT -= dt;
            e.vx = e.patDir * e.speed * 0.5;
        } else {
            if(dist < 260 && Math.abs(player.y - e.y) < 200) e.state = 'chase'; else if(dist > 340) e.state = 'patrol';
            if(e.state === 'chase') {
                if(dist < 24 && Math.abs(player.y - e.y) > 30) {
                    e.stuckT = 1.0 + Math.random();
                    e.patDir = Math.random() > 0.5 ? 1 : -1;
                    e.vx = e.patDir * e.speed * 0.5;
                } else {
                    e.vx = (player.x < e.x ? -1 : 1) * e.speed;
                }
            } else { e.patT -= dt; if(e.patT <= 0){e.patDir *= -1; e.patT = e.patI;} e.vx = e.patDir * e.speed * 0.5; }
        }
        
        // Ledge Detection
        if (e.grounded && !isEWater) {
            const lookX = e.vx > 0 ? e.x + e.w + 4 : e.x - 4;
            const gridX = Math.floor(lookX / TS);
            const gridY = Math.floor((e.y + e.h + 4) / TS);
            
            let safeToDrop = false;
            for(let i = 0; i < 4; i++) {
                const t = mapTile(gridX, gridY + i);
                if(isSolidTile(t) || t === TILE_PLAT || t === TILE_WATER || t === TILE_LAVA) {
                    safeToDrop = true;
                    break;
                }
            }
            if(!safeToDrop) {
                e.vx = 0; e.patDir *= -1; e.stuckT = 1.5 + Math.random();
            }
        }
        
        e.grounded = false;
        let attemptedVx = e.vx;
        moveAndCollide(e, dt);
        
        // Block climbing / Step up
        if(attemptedVx !== 0 && e.vx === 0) {
            const stepUpY = e.y + e.h - TS - 5;
            const stepLookX = attemptedVx > 0 ? e.x + e.w + 2 : e.x - 2;
            const tileAboveObstacle = mapTile(Math.floor(stepLookX/TS), Math.floor(stepUpY/TS));
            if(!isSolidTile(tileAboveObstacle)) {
                if (e.grounded) {
                    e.vy = -380; // Jump over the 1 block obstacle
                }
            } else {
                e.stuckT = 1.0 + Math.random(); 
                e.patDir = attemptedVx > 0 ? -1 : 1; 
            }
        }
        
        if(e.atkCd > 0) e.atkCd -= dt;
        const dx = (player.x+player.w/2) - ecX, dy = (player.y+player.h/2) - ecY;
        if(Math.sqrt(dx*dx + dy*dy) < (e.w/2 + player.w/2) + 4 && e.atkCd <= 0){
            playerDamage(12, e.x + e.w/2);
            e.atkCd = 1.2;
        }
        if(e.flash > 0) e.flash -= dt*5;
    }
    updateParticles(dt);

    const m = getActiveMap();
    if(!devMode && player.y>m.h+50){player.hp=0;} 
    if(player.hp<=0) {
        gameOver=true;
        transitionTo('gameover-menu');
    }
    camFollow(player.x+player.w/2,player.y+player.h/2,dt);
}

function loop(t){
    const dt=Math.min((t-lastT)/1000,.04);lastT=t;
    Audio.init();

    if(gameState==='PLAY') updatePlay(dt);

    if(gameState==='PLAY' || gameState==='PAUSE' || gameState==='EDITOR' || gameState==='INVENTORY'){
        camZoom += (camZoomTarget - camZoom) * 5 * dt;
        if(gameState==='EDITOR' && typeof window.rawMouseX !== 'undefined') {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const cssX = window.rawMouseX - rect.left;
            const cssY = window.rawMouseY - rect.top;
            const canvasX = cssX * dpr;
            const canvasY = cssY * dpr;
            const rawX = (canvasX - DRAW_OFFSET_X) / DRAW_SCALE;
            const rawY = (canvasY - DRAW_OFFSET_Y) / DRAW_SCALE;
            const centerX = CW / 2;
            const centerY = CH / 2;
            edMouseX = (rawX - centerX) / camZoom + centerX;
            edMouseY = (rawY - centerY) / camZoom + centerY;
        }
    } else {
        camZoom = 1; camZoomTarget = 1; zoomState = 0;
    }

    ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.save();
    ctx.translate(DRAW_OFFSET_X, DRAW_OFFSET_Y);
    ctx.scale(DRAW_SCALE, DRAW_SCALE);
    ctx.beginPath(); ctx.rect(0, 0, CW, CH); ctx.clip();

    if(gameState==='PLAY' || gameState==='EDITOR' || gameState==='PAUSE' || gameState==='INVENTORY'){
        ctx.clearRect(0,0,CW,CH);
        
        ctx.save();
        if(camShake > 0) {
            ctx.translate((Math.random()-0.5)*camShake, (Math.random()-0.5)*camShake);
            camShake -= 60 * dt;
            if(camShake < 0) camShake = 0;
        }
        
        if(camZoom !== 1 && (gameState==='PLAY' || gameState==='INVENTORY' || gameState==='EDITOR')) {
            let zx = CW/2;
            let zy = CH/2;
            if(gameState==='PLAY' || gameState==='INVENTORY') {
                zx = player.x + player.w/2 - cam.x;
                zy = player.y + player.h/2 - cam.y;
            }
            ctx.translate(zx, zy);
            ctx.scale(camZoom, camZoom);
            ctx.translate(-zx, -zy);
        }

        drawBG(ctx);
        if(typeof drawBGEffects === 'function') drawBGEffects(ctx,cam.x,cam.y);
        drawTiles(ctx);
        for(const e of activeEnemies)drawEnemy(ctx,e);
        if(gameState==='PLAY'||gameState==='PAUSE'||gameState==='INVENTORY') drawPlayer(ctx);
        if(gameState==='PLAY' && player.throwingItem) {
            if(typeof drawAimTrajectory === 'function') drawAimTrajectory(ctx);
        }
        if(typeof drawThrowables === 'function') drawThrowables(ctx);
        drawParticles(ctx,cam.x,cam.y);
        
        const hasNV = player.nvTimer > 0;
        if((gameState==='PLAY'||gameState==='PAUSE'||gameState==='INVENTORY') && !devMode && !hasNV){
            lightDraw(ctx,player.x+player.w/2,player.y+player.h/2);
            // Draw smooth gradient abyss below the map bottom
            const m = getActiveMap();
            if(m && m.h) {
                const startY = m.h - cam.y - 40; // Start slightly above the bottom line for smoother transition
                const endY = startY + 140;
                if(startY < CH) {
                    const grad = ctx.createLinearGradient(0, startY, 0, endY);
                    grad.addColorStop(0, 'rgba(0,0,0,0)');
                    grad.addColorStop(1, 'rgba(0,0,0,1)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, startY, CW, Math.max(0, CH - startY));
                }
            }
        } else if (gameState==='EDITOR' && edViewMode==='preview') {
            lightUpdate(dt, true);
            lightDraw(ctx, edMouseX+cam.x, edMouseY+cam.y);
            // Draw smooth gradient abyss below the map bottom
            const m = getActiveMap();
            if(m && m.h) {
                const startY = m.h - cam.y - 40;
                const endY = startY + 140;
                if(startY < CH) {
                    const grad = ctx.createLinearGradient(0, startY, 0, endY);
                    grad.addColorStop(0, 'rgba(0,0,0,0)');
                    grad.addColorStop(1, 'rgba(0,0,0,1)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, startY, CW, Math.max(0, CH - startY));
                }
            }
        }
        
        // Draw Editor Hover Cursor INSIDE zoom transform
        if(gameState==='EDITOR'){
            const col = Math.floor((edMouseX+cam.x)/TS), row = Math.floor((edMouseY+cam.y)/TS);
            ctx.strokeStyle='rgba(255,255,0,0.8)'; ctx.lineWidth=2;
            ctx.strokeRect(col*TS-cam.x, row*TS-cam.y, TS, TS);
        }
        
        ctx.restore(); // Restore zoom scale

        if((gameState==='PLAY'||gameState==='PAUSE') && (devMode || hasNV)){
            ctx.fillStyle='rgba(0,255,0,.15)';ctx.fillRect(0,0,CW,CH);
            if(devMode) {
                ctx.fillStyle='#0f0';ctx.font='bold 16px monospace';ctx.textAlign='left';
                ctx.fillText('🛠 DEV MODE – P to toggle | WASD fly | Noclip ON',14,CH-16);
            }
        }
        
        // Cinematic Vignette (drawn in unscaled CW/CH coordinates)
        if(gameState==='PLAY' || gameState==='PAUSE'){
            ctx.save();
            ctx.translate(CW/2, CH/2);
            const activeH = filmMode ? CH - FILM_BAR_H*2 : CH;
            // scaleY so the radial gradient becomes an ellipse fitting the active height
            ctx.scale(1, activeH / CW);
            const vgrad = ctx.createRadialGradient(0, 0, CW*0.3, 0, 0, CW*0.6);
            vgrad.addColorStop(0, 'rgba(0,0,0,0)');
            vgrad.addColorStop(1, 'rgba(0,0,0,0.8)');
            ctx.fillStyle = vgrad;
            ctx.fillRect(-CW/2, -CW, CW, CW*2);
            ctx.restore();
        }
    }
    ctx.restore();

    // Film Mode Letterbox Bars (drawn in canvas space, above everything)
    if(filmMode && (gameState==='PLAY' || gameState==='PAUSE')){
        const barH = FILM_BAR_H * DRAW_SCALE;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, DRAW_OFFSET_Y + barH);
        ctx.fillRect(0, canvas.height - DRAW_OFFSET_Y - barH, canvas.width, DRAW_OFFSET_Y + barH);
    }

    requestAnimationFrame(loop);
}

// Boot
initInput();
lightInit();
requestAnimationFrame(loop);

function updateGraphicsFilter(){
    const isHDR = document.getElementById('ed-hdr').checked;
    const sat = document.getElementById('gfx-sat').value || 1;
    const con = document.getElementById('gfx-con').value || 1;
    const bri = document.getElementById('gfx-bri').value || 1;
    
    let filterStr = `saturate(${sat}) contrast(${con}) brightness(${bri})`;
    if(isHDR){
        filterStr += ` drop-shadow(0 0 10px rgba(100,200,255,0.2))`;
    }
    _baseCanvasFilter = filterStr;
    canvas.style.filter = filterStr;
    saveGraphicsSettings();
}

function changeResolution(val){
    if(val === 'pixel'){
        canvas.style.imageRendering = 'pixelated';
    } else {
        canvas.style.imageRendering = 'auto';
    }
    saveGraphicsSettings();
}

function toggleCRT(isOn){
    const crt = document.getElementById('crt-overlay');
    if(crt){
        crt.style.display = isOn ? 'block' : 'none';
    }
    saveGraphicsSettings();
}

function toggleFilmMode(isOn){
    filmMode = isOn;
    saveGraphicsSettings();
}

// ==== THROWABLES & EXPLOSIONS ====
function spawnThrowable(type, x, y) {
    let vx = 0, vy = 0;
    if (type === 'grenade' || type === 'smoke') {
        if (aimMode === 'mouse') {
            let diffX = (cam.x + mouseX) - x;
            let diffY = (cam.y + mouseY) - y;
            let dist = Math.hypot(diffX, diffY);
            if(dist > 500) {
                diffX = (diffX / dist) * 500;
                diffY = (diffY / dist) * 500;
            }
            vx = diffX * 1.5;
            vy = diffY * 1.5 - 200;
        } else if (typeof player.gunAngle !== 'undefined') {
            vx = Math.cos(player.gunAngle) * 400;
            vy = Math.sin(player.gunAngle) * 400 - 150;
        } else {
            let dx = player.right ? 1 : -1;
            let dy = 0;
            if (aimLock === -1) { dx *= 0.5; dy = -0.866; }
            else if (aimLock === 1) { dx *= 0.5; dy = 0.866; }
            vx = dx * 400;
            vy = dy * 400 - 150;
        }
    }
    
    throwables.push({
        type: type,
        x: x, y: y, w: 10, h: 10,
        vx: vx, vy: vy,
        life: type === 'grenade' ? 3 : (type === 'smoke' ? 20 : Infinity),
        grounded: false
    });
}

function explodeAt(x, y, radius, damage) {
    for(const e of activeEnemies) {
        if(e.dead) continue;
        const dist = Math.hypot(x - (e.x+e.w/2), y - (e.y+e.h/2));
        if(dist < radius) {
            e.hp -= damage;
            e.flash = 1;
            if(e.hp <= 0 && !e.dead) {
                e.dead = true;
                pEmit(e.x+e.w/2, e.y+e.h/2, 15, '#ffaa00', 50, 100, 200);
            }
        }
    }
    const pDist = Math.hypot(x - (player.x+player.w/2), y - (player.y+player.h/2));
    if(pDist < radius) {
        playerDamage(damage/2, x);
    }
    
    // Destroy cracked wood tiles in radius
    const d = getActiveMap();
    if(d) {
        const r1=Math.floor((y-radius)/TS), r2=Math.floor((y+radius)/TS);
        const c1=Math.floor((x-radius)/TS), c2=Math.floor((x+radius)/TS);
        for(let rr=Math.max(0,r1);rr<=Math.min(d.rows-1,r2);rr++) {
            for(let cc=Math.max(0,c1);cc<=Math.min(d.cols-1,c2);cc++) {
                if(!d.tiles[rr]||!d.tiles[rr][cc]) continue;
                if(getFg(d.tiles[rr][cc])===TILE_CRACKED_WOOD) {
                    const dist = Math.hypot(x-(cc*TS+TS/2), y-(rr*TS+TS/2));
                    if(dist<radius) damageCrackedWood(cc*TS+TS/2, rr*TS+TS/2, 99);
                }
            }
        }
    }
    
    camShake = 15;
    Audio.door(); // Reuse existing sound for explosion
    for(let i=0; i<30; i++) {
        particles.push({
            x: x + (Math.random()-0.5)*radius,
            y: y + (Math.random()-0.5)*radius,
            vx: (Math.random()-0.5)*300,
            vy: (Math.random()-0.5)*300,
            life: 1, maxLife: 1, decay: 2,
            color: Math.random() > 0.5 ? '#ffaa00' : '#ff4400',
            sz: 5 + Math.random()*10,
            g: 0, type: 'explosion'
        });
    }
}
