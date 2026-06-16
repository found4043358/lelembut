// ============ PHYSICS ============
function moveAndCollide(e,dt){
    e.x+=e.vx*dt; resolveX(e);
    e.y+=e.vy*dt; resolveY(e);
}
function resolveX(e){
    const eps=.01;
    const sc=Math.floor(e.x/TS),ec=Math.floor((e.x+e.w-eps)/TS);
    const sr=Math.floor(e.y/TS),er=Math.floor((e.y+e.h-eps)/TS);
    for(let r=sr;r<=er;r++){
        for(let c=sc;c<=ec;c++){
            if(isSolidTile(mapTile(c,r))){
                if(e.vx>0)e.x=c*TS-e.w; else if(e.vx<0)e.x=(c+1)*TS;
                e.vx=0;
            }
        }
    }
}
function resolveY(e){
    const eps=.01;
    const sc=Math.floor(e.x/TS),ec=Math.floor((e.x+e.w-eps)/TS);
    const sr=Math.floor(e.y/TS),er=Math.floor((e.y+e.h-eps)/TS);
    for(let r=sr;r<=er;r++){
        for(let c=sc;c<=ec;c++){
            const tile=mapTile(c,r);
            if(isSolidTile(tile)){
                if(e.vy>0){
                    e.y=r*TS-e.h;
                    if(tile===TILE_BOUNCER && e===player) { e.vy=-850; e.grounded=false; Audio.door(); } // High bounce
                    else { e.vy=0; e.grounded=true; }
                } else if(e.vy<0) { e.y=(r+1)*TS; e.vy=0; }
            } else if((tile===TILE_PLAT || tile===TILE_CRUMBLE) && e.vy>0){
                const prevBot=e.y+e.h-e.vy*.017;
                if(prevBot<=r*TS+4){
                    e.y=r*TS-e.h;e.vy=0;e.grounded=true;
                    if(tile===TILE_CRUMBLE && e===player && typeof triggerCrumble === 'function') triggerCrumble(r, c);
                }
            } else if(tile===TILE_SPIKE && e===player){
                playerDamage(25, c*TS + TS/2);
                if(e.vy>0){e.y=r*TS-e.h;e.vy=-300;}
            } else if(tile===TILE_LAVA && e===player){
                if(player.invT <= 0) {
                    playerDamage(player.maxHp * 0.5); // Damage -50%
                    if(e.vy>0){e.y=r*TS-e.h;e.vy=-300;} // Bounce out slightly
                    for(let i=0; i<15; i++) {
                        particles.push({
                            x: player.x + Math.random()*player.w, 
                            y: player.y + player.h,
                            vx: (Math.random()-0.5)*150, 
                            vy: -Math.random()*200 - 50,
                            life: 1, maxLife: 1,
                            color: Math.random() > 0.5 ? '#ff4400' : '#ffaa00',
                            size: 4 + Math.random()*3
                        });
                    }
                }
            }
        }
    }
}

