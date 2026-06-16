// ============ CAMERA ============
const cam={x:0,y:0,mw:0,mh:0, yOffset: 0, yOffsetTarget: 0};
function camFollow(tx,ty,dt){
    const hw=CW/2, hh=CH/2; const dx=60, dy=40;
    
    // Base camera offset: shift camera UP (-Y) so player appears slightly lower on screen
    const baseCamOffY = -50;

    // Film mode: shift camera DOWN so player is visible above the bottom bar,
    // showing more of the world below their feet. Positive = moves view down.
    const filmOffY = filmMode ? FILM_BAR_H * 0.7 : 0;
    
    // Pan camera if holding W or S (works even while walking slowly)
    if(gameState === 'PLAY' && Math.abs(player.vx) < 10) {
        if(keys.u)      cam.yOffsetTarget = -140; // look UP (shorter, not too far)
        else if(keys.d) cam.yOffsetTarget = 140;  // look DOWN
        else            cam.yOffsetTarget = 0;
    } else {
        cam.yOffsetTarget = 0;
    }
    
    // Smooth transition — slower lerp for gentle, cinematic pan
    const panLerp = 3;
    cam.yOffset += (cam.yOffsetTarget - cam.yOffset) * panLerp * dt;
    cam.yOffset = Math.max(-150, Math.min(cam.yOffset, 150));

    let targetX=cam.x, targetY=cam.y;
    const sx=tx-cam.x;
    if(sx<hw-dx)targetX=tx-(hw-dx); else if(sx>hw+dx)targetX=tx-(hw+dx);
    const targetLookY = ty + baseCamOffY + filmOffY + cam.yOffset;
    const sy = targetLookY - cam.y;
    
    if(Math.abs(cam.yOffset) > 1 || Math.abs(cam.yOffsetTarget) > 1) {
        // W/S held OR returning: FORCE camera exactly to target, bypass deadzone to prevent snapping
        targetY = targetLookY - hh;
    } else {
        // Normal follow with deadzone hysteresis
        if(sy<hh-dy) targetY=targetLookY-(hh-dy); else if(sy>hh+dy) targetY=targetLookY-(hh+dy);
    }
    
    cam.x+=(targetX-cam.x)*6*dt; cam.y+=(targetY-cam.y)*6*dt;
    cam.x=Math.max(0,Math.min(cam.x,Math.max(0, cam.mw-CW)));
    
    // Loosen y-clamp to allow looking up/down beyond boundaries
    let minY = baseCamOffY < 0 ? baseCamOffY : 0;
    let maxY = Math.max(0, cam.mh-CH);
    if(cam.yOffset < 0) minY += cam.yOffset;
    if(cam.yOffset > 0) maxY += cam.yOffset;
    
    cam.y=Math.max(minY, Math.min(cam.y, maxY));
}

