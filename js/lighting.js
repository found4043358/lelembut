// ============ LIGHTING ============
let lightCvs, lightCtx;
let ambLightCvs, ambLightCtx;
let lightAngle = 0, lightTarget = 0, sway = 0, swayX = 0, swayY = 0, flicker = 1;
function lightInit() {
    if (!lightCvs) lightCvs = document.createElement('canvas');
    lightCvs.width = CW; lightCvs.height = CH;
    lightCtx = lightCvs.getContext('2d', { willReadFrequently: true });

    if (!ambLightCvs) ambLightCvs = document.createElement('canvas');
    ambLightCvs.width = CW / 2; ambLightCvs.height = CH / 2;
    ambLightCtx = ambLightCvs.getContext('2d');
}
function lightUpdate(dt, facingRight, aimDir = 0, px = 0, py = 0) {
    let target = 0;
    if (typeof aimMode !== 'undefined' && aimMode === 'mouse') {
        const sx = px - cam.x + player.w / 2;
        const sy = py - cam.y + player.h / 2;
        target = Math.atan2(mouseY - sy, mouseX - sx);
        if (mouseX > sx) player.right = true;
        else player.right = false;
    } else {
        if (aimDir === -1) target = -Math.PI / 2;
        else if (aimDir === 1) target = Math.PI / 2;
        else target = facingRight ? 0 : Math.PI;
    }

    window.gunAngle = target;

    let diff = target - lightAngle;
    while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;

    lightAngle += diff * 12 * dt;

    if(typeof player.flashlightAnim === 'undefined') player.flashlightAnim = 1.0;
    let targetAnim = player.flashlightOn ? 1.0 : 0.0;
    player.flashlightAnim += (targetAnim - player.flashlightAnim) * 15 * dt;

    sway += dt;
    swayX = Math.sin(sway * 1.3) * 7; swayY = Math.sin(sway * 2.1) * 4;
    flicker = .93 + Math.sin(sway * 17) * .03 + Math.random() * .02;
}
function lightDraw(ctx, px, py) {
    if (!lightCtx) return;
    const lc = lightCtx;

    let batteryFactor = player.battery / player.maxBattery;
    let lightScale = 1.0;
    if (batteryFactor <= 0.24) {
        lightScale = batteryFactor / 0.24;
    }
    
    let anim = player.flashlightAnim !== undefined ? player.flashlightAnim : 1.0;
    let finalScale = (0.2 + 0.8 * lightScale) * anim;
    let radius = 500 * finalScale * flicker;

    const bx = px - cam.x, by = py - cam.y;
    const sx = px - cam.x + swayX, sy = py - cam.y + swayY;

    lc.globalCompositeOperation = 'source-over';
    lc.fillStyle = currentMapIdx === -1 ? 'rgba(8,12,20,.85)' : 'rgba(2,2,3,.98)';
    lc.fillRect(0, 0, CW, CH);

    lc.globalCompositeOperation = 'destination-out';

    const lightMissing = Math.max(0, 1 - (lightScale * anim)); // 0 to 1
    let ambR = 40 + 110 * lightMissing;
    const ambAlpha0 = 0.35 + 0.05 * lightMissing;
    const ambAlpha1 = 0.12 + 0.05 * lightMissing;
    const ag = lc.createRadialGradient(bx, by, 0, bx, by, ambR);
    ag.addColorStop(0, `rgba(0,0,0,${ambAlpha0})`);
    ag.addColorStop(.5, `rgba(0,0,0,${ambAlpha1})`);
    ag.addColorStop(1, 'rgba(0,0,0,0)');
    lc.fillStyle = ag; lc.beginPath(); lc.arc(bx, by, ambR, 0, Math.PI * 2); lc.fill();

    // Flashlight Raycast
    const cone = (Math.PI / 1.8) * finalScale;
    lc.save();
    lc.beginPath();
    lc.moveTo(sx, sy);
    const numRays = 240;
    const maxDepth = 15;
    const rayPoints = [];
    for (let i = 0; i <= numRays; i++) {
        let a = lightAngle - cone / 2 + (cone * i / numRays);
        let dist = 0;
        let dx = Math.cos(a), dy = Math.sin(a);
        let hitDepth = 0;
        let hit = false;
        while (dist < radius) {
            dist += 3;
            let wx = px + dx * dist, wy = py + dy * dist;
            let t = mapTile(Math.floor(wx / TS), Math.floor(wy / TS));
            if (isSolidTile(t) && t !== 8) {
                hitDepth += 3;
                if (hitDepth >= maxDepth) { hit = true; break; }
            }
        }
        let fx = sx + dx * dist, fy = sy + dy * dist;
        lc.lineTo(fx, fy);
        rayPoints.push({ x: fx, y: fy, hit: hit });
    }
    lc.lineTo(sx, sy);

    const bg = lc.createRadialGradient(sx, sy, 0, sx, sy, radius);
    const cAlpha = 0.15 + 0.85 * finalScale;
    bg.addColorStop(0, `rgba(0,0,0,${cAlpha})`);
    bg.addColorStop(.5, `rgba(0,0,0,${cAlpha})`);
    bg.addColorStop(.8, `rgba(0,0,0,${cAlpha * 0.5})`);
    bg.addColorStop(1, 'rgba(0,0,0,0)');

    // TRUE Blur for buttery smooth edges (eliminates sawtooth)
    lc.filter = 'blur(45px)';
    lc.fillStyle = bg;
    lc.fill();
    lc.filter = 'none'; // reset
    lc.restore();

    // --- SECONDARY LIGHTS ON OFF-SCREEN CANVAS (FAST AND SOFT) ---
    // Clear the small canvas
    ambLightCtx.clearRect(0, 0, ambLightCvs.width, ambLightCvs.height);

    // Helper to draw points to ambLightCvs
    const drawPointLight = (lpx, lpy, lightR, alpha, rayCount) => {
        let lx = lpx - cam.x, ly = lpy - cam.y;
        if (lx < -lightR || lx > CW + lightR || ly < -lightR || ly > CH + lightR) return;

        let sc = 0.5; // Draw at half resolution for immense performance gain
        let mlx = lx * sc, mly = ly * sc, mR = lightR * sc;

        ambLightCtx.beginPath();
        if (rayCount <= 0) {
            ambLightCtx.arc(mlx, mly, mR, 0, Math.PI * 2);
        } else {
            for (let i = 0; i <= rayCount; i++) {
                let a = (Math.PI * 2 * i) / rayCount;
                let dist = 0, hitDepth = 0;
                let dx = Math.cos(a), dy = Math.sin(a);
                while (dist < lightR) {
                    dist += 10;
                    let wx = lpx + dx * dist, wy = lpy + dy * dist;
                    let t = mapTile(Math.floor(wx / TS), Math.floor(wy / TS));
                    if (isSolidTile(t) && t !== 8) {
                        hitDepth += 10;
                        if (hitDepth >= 15) break;
                    }
                }
                if (i === 0) ambLightCtx.moveTo(mlx + dx * dist * sc, mly + dy * dist * sc);
                else ambLightCtx.lineTo(mlx + dx * dist * sc, mly + dy * dist * sc);
            }
        }
        let dg = ambLightCtx.createRadialGradient(mlx, mly, 0, mlx, mly, mR);
        dg.addColorStop(0, `rgba(255,255,255,${alpha})`);
        dg.addColorStop(0.4, `rgba(255,255,255,${alpha * 0.4})`);
        dg.addColorStop(1, `rgba(255,255,255,0)`);

        ambLightCtx.fillStyle = dg;
        ambLightCtx.fill();
    };

    // Draw Torches and Lamps Glow
    map.decorations.forEach(d => {
        if (d.mapIdx === currentMapIdx) {
            if (d.type === 'dec_torch') drawPointLight(d.x + TS / 2, d.y + TS / 4, 250 * flicker, 0.9, 60);
            if (d.type === 'dec_lamp') drawPointLight(d.x + TS / 2, d.y + TS / 4, 350, 0.9, 80);
        }
    });

    // Endgame Door Glow
    map.pickups.forEach(pk => {
        const mIdx = pk.mapIdx !== undefined ? pk.mapIdx : -1;
        if (mIdx === currentMapIdx && pk.t === 'end') {
            drawPointLight(pk.x + TS / 2, pk.y + TS / 2, 300 * flicker, 0.9, 80);
        }
    });

    // Lava Glow
    const cMap = getActiveMap();
    if (cMap) {
        const scl = Math.floor(cam.x / TS);
        const ecl = Math.floor((cam.x + CW) / TS) + 1;
        const srl = Math.floor(cam.y / TS);
        const erl = Math.floor((cam.y + CH) / TS) + 1;
        for (let r = Math.max(0, srl); r <= Math.min(cMap.rows - 1, erl); r++) {
            for (let c = Math.max(0, scl); c <= Math.min(cMap.cols - 1, ecl); c++) {
                if (cMap.tiles[r][c] === 8) { // Lava
                    if (r === 0 || cMap.tiles[r - 1][c] !== 8) {
                        drawPointLight(c * TS + TS / 2, r * TS + TS / 2, 180 + Math.random() * 15, 0.85, 30);
                    }
                }
            }
        }
    }

    // Blend the secondary light map into the main light canvas!
    // The browser's native bilinear scaling + a single blur pass makes it incredibly smooth and completely lag-free.
    lc.save();
    lc.globalCompositeOperation = 'destination-out';
    lc.filter = 'blur(18px)';
    lc.drawImage(ambLightCvs, 0, 0, CW, CH);
    lc.restore();

    // 0. Perfect Edge Highlight for illuminated blocks (DRAWN BEFORE DARKNESS)
    // The darkness mask will smoothly fade these lines out at the edges of the flashlight cone!
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    
    // Smooth distance fade gradient
    const edgeGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius * 0.9);
    edgeGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    edgeGrad.addColorStop(0.5, 'rgba(255, 240, 200, 0.75)');
    edgeGrad.addColorStop(0.85, 'rgba(255, 220, 160, 0.3)');
    edgeGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = edgeGrad;
    
    ctx.lineWidth = 3;
    ctx.filter = 'blur(1.5px)'; 
    
    ctx.beginPath();
    const edgeMap = getActiveMap();
    if(edgeMap) {
        const scl = Math.max(0, Math.floor(cam.x / TS));
        const ecl = Math.min(edgeMap.cols - 1, Math.floor((cam.x + CW) / TS) + 1);
        const srl = Math.max(0, Math.floor(cam.y / TS));
        const erl = Math.min(edgeMap.rows - 1, Math.floor((cam.y + CH) / TS) + 1);
        for(let r=srl; r<=erl; r++){
            for(let c=scl; c<=ecl; c++){
                const t = edgeMap.tiles[r][c];
                if(isSolidTile(t) && t !== 8) { 
                    const px = c*TS - cam.x;
                    const py = r*TS - cam.y;
                    // top
                    if(r===0 || !isSolidTile(edgeMap.tiles[r-1][c])) { ctx.moveTo(px, py); ctx.lineTo(px+TS, py); }
                    // bottom
                    if(r<edgeMap.rows-1 && !isSolidTile(edgeMap.tiles[r+1][c])) { ctx.moveTo(px, py+TS); ctx.lineTo(px+TS, py+TS); }
                    // left
                    if(c===0 || !isSolidTile(edgeMap.tiles[r][c-1])) { ctx.moveTo(px, py); ctx.lineTo(px, py+TS); }
                    // right
                    if(c===edgeMap.cols-1 || !isSolidTile(edgeMap.tiles[r][c+1])) { ctx.moveTo(px+TS, py); ctx.lineTo(px+TS, py+TS); }
                }
            }
        }
    }
    ctx.stroke();
    ctx.restore();

    // 1. Draw the darkness overlay (THIS WILL SOFTLY MASK THE OUTLINES OUTSIDE THE FLASHLIGHT!)
    ctx.drawImage(lightCvs, 0, 0);

    // 2. Add bright bloom overlay to actively ILLUMINATE the flashlight cone!
    ctx.save();
    ctx.globalCompositeOperation = 'overlay'; // This brightens the underlying textures beautifully
    const bloom = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius * 0.9);
    bloom.addColorStop(0, 'rgba(255, 250, 230, 0.7)'); // 70% bright at core
    bloom.addColorStop(0.4, 'rgba(255, 250, 230, 0.35)');
    bloom.addColorStop(1, 'rgba(255, 250, 230, 0)');
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.arc(sx, sy, radius * 0.9, lightAngle - cone / 1.8, lightAngle + cone / 1.8);
    ctx.lineTo(sx, sy);
    ctx.filter = 'blur(20px)'; // Soften the edges of the bloom
    ctx.fill();
    ctx.restore();
}

