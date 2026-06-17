// ============ LIGHTING ============
let lightCvs, lightCtx;
let ambLightCvs, ambLightCtx;
let lightAngle = 0, lightTarget = 0, sway = 0, swayX = 0, swayY = 0, flicker = 1;
function lightInit() {
    if (!lightCvs) lightCvs = document.createElement('canvas');
    lightCvs.width = CW; lightCvs.height = CH;
    lightCtx = lightCvs.getContext('2d'); // No willReadFrequently - keeps canvas in GPU VRAM for faster compositing

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
    if (window.graphicsQuality === 'ultralow') return; // Potato Mode: skip lighting completely

    const map = getActiveMap();
    if (!map) return;
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
    const sx = px - cam.x, sy = py - cam.y;

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
    // High: 160 rays (blur(45px) smooths the inter-ray gaps, saves ~33% CPU raycast time)
    // Ultra: 200 rays, step 3 (sharpest possible before blur softens)
    // Medium: 120 rays, Low: 60 rays, Lowest: 30 rays, Ultralow: 15 rays
    let numRays = 120;
    if (window.graphicsQuality === 'ultra') numRays = 200;
    else if (window.graphicsQuality === 'high') numRays = 160;
    else if (window.graphicsQuality === 'low') numRays = 60;
    else if (window.graphicsQuality === 'lowest') numRays = 30;
    else if (window.graphicsQuality === 'ultralow') numRays = 15;
    
    let maxDepth = 25;
    if (window.graphicsQuality === 'low') maxDepth = 15;
    else if (window.graphicsQuality === 'lowest') maxDepth = 5;
    else if (window.graphicsQuality === 'ultralow') maxDepth = 2; // Almost no penetration
    
    let step = 5;
    if (window.graphicsQuality === 'ultra') step = 3;
    else if (window.graphicsQuality === 'high') step = 4;
    else if (window.graphicsQuality === 'lowest' || window.graphicsQuality === 'ultralow') step = 10; // Huge steps, very fast

    const rayPoints = [];
    for (let i = 0; i <= numRays; i++) {
        let a = lightAngle - cone / 2 + (cone * i / numRays);
        let dist = 0;
        let dx = Math.cos(a), dy = Math.sin(a);
        let hitDepth = 0;
        let hit = false;
        while (dist < radius) {
            dist += step;
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

    // Blur per quality level — cost scales as radius²:  3²=9  |  8²=64  |  45²=2025
    if (window.graphicsQuality === 'ultra' || window.graphicsQuality === 'high') {
        lc.filter = 'blur(45px)';
        lc.fillStyle = bg;
        lc.fill();
        lc.filter = 'none';
    } else if (window.graphicsQuality === 'medium') {
        lc.filter = 'blur(16px)'; // Smoother gradient for medium (was 8px)
        lc.fillStyle = bg;
        lc.fill();
        lc.filter = 'none';
    } else if (window.graphicsQuality === 'low') {
        lc.filter = 'blur(3px)'; // minimum effective softening, ~7x cheaper than medium
        lc.fillStyle = bg;
        lc.fill();
        lc.filter = 'none';
    } else {
        // Potato Mode: Hard edges, NO filter, maximum performance
        lc.fillStyle = bg;
        lc.fill();
    }
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
    if (map.decorations) {
        map.decorations.forEach(d => {
            if (d.mapIdx === currentMapIdx) {
                if (d.type === 'dec_torch') drawPointLight(d.x + TS / 2, d.y + TS / 4, 250 * flicker, 0.9, 60);
                if (d.type === 'dec_lamp') drawPointLight(d.x + TS / 2, d.y + TS / 4, 350, 0.9, 80);
            }
        });
    }

    // Endgame Door Glow
    if (map.pickups) {
        map.pickups.forEach(pk => {
            const mIdx = pk.mapIdx !== undefined ? pk.mapIdx : -1;
            if (mIdx === currentMapIdx && pk.t === 'end') {
                drawPointLight(pk.x + TS / 2, pk.y + TS / 2, 300 * flicker, 0.9, 80);
            }
        });
    }

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
    if (window.graphicsQuality === 'ultra' || window.graphicsQuality === 'high') lc.filter = 'blur(18px)';
    else if (window.graphicsQuality === 'medium') lc.filter = 'blur(8px)';
    else lc.filter = 'blur(3px)'; // low: minimal softening on torch/lamp glow
    lc.drawImage(ambLightCvs, 0, 0, CW, CH);
    lc.filter = 'none'; // always reset
    lc.restore();

    // 0. Perfect Edge Highlight for illuminated blocks (DRAWN BEFORE DARKNESS)
    // The darkness mask will smoothly fade these lines out at the edges of the flashlight cone!
    if (window.graphicsQuality !== 'low') {
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
        if (window.graphicsQuality === 'ultra' || window.graphicsQuality === 'high') ctx.filter = 'blur(1.5px)'; 
        
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
    }

    // 1. Draw the darkness overlay (THIS WILL SOFTLY MASK THE OUTLINES OUTSIDE THE FLASHLIGHT!)
    ctx.drawImage(lightCvs, 0, 0);

    // 2. Post-lighting bloom and effects
    if (window.graphicsQuality === 'low' || window.graphicsQuality === 'lowest' || window.graphicsQuality === 'ultralow') return; // Low/Potato: skip all bloom

    const isUltra = window.graphicsQuality === 'ultra';

    // Gun tip position in screen space (where the flashlight barrel actually ends)
    // Offset ~22px along lightAngle from player center
    const GUN_REACH = 22;
    const gsx = sx + Math.cos(lightAngle) * GUN_REACH;
    const gsy = sy + Math.sin(lightAngle) * GUN_REACH * 0.75;

    // ── HIGH: Single elegant warm bloom ──
    if (!isUltra) {
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.filter = 'blur(18px)';
        const bloom = ctx.createRadialGradient(gsx, gsy, 0, gsx, gsy, radius * 0.85);
        bloom.addColorStop(0,   'rgba(255, 255, 235, 0.75)');
        bloom.addColorStop(0.45,'rgba(255, 248, 215, 0.35)');
        bloom.addColorStop(1,   'rgba(255, 240, 190, 0)');
        ctx.fillStyle = bloom;
        ctx.beginPath();
        ctx.moveTo(gsx, gsy);
        ctx.arc(gsx, gsy, radius * 0.85, lightAngle - cone / 2, lightAngle + cone / 2);
        ctx.lineTo(gsx, gsy);
        ctx.fill();
        ctx.filter = 'none';
        ctx.restore();
        return;
    }

    // ── ULTRA: Multi-layer bloom from gun tip ──

    // LAYER 1: Wide world-ambient halo — very short, tight, and circular so it doesn't rotate awkwardly
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.filter = 'blur(28px)';
    const halo = ctx.createRadialGradient(gsx, gsy, 0, gsx, gsy, radius * 0.35);
    halo.addColorStop(0,   'rgba(255, 252, 210, 0.40)');
    halo.addColorStop(0.5, 'rgba(255, 245, 190, 0.15)');
    halo.addColorStop(1,   'rgba(255, 235, 160, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(gsx, gsy, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();

    // LAYER 2: Tight hot-white core at gun tip
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.filter = 'blur(10px)';
    const core = ctx.createRadialGradient(gsx, gsy, 0, gsx, gsy, radius * 0.38);
    core.addColorStop(0,   'rgba(255, 255, 245, 0.90)');
    core.addColorStop(0.5, 'rgba(255, 252, 225, 0.40)');
    core.addColorStop(1,   'rgba(255, 248, 200, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.moveTo(gsx, gsy);
    ctx.arc(gsx, gsy, radius * 0.38, lightAngle - cone / 2.2, lightAngle + cone / 2.2);
    ctx.lineTo(gsx, gsy);
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();

    // LAYER 3: On-canvas RGB channel split from gun tip (in-cone light dispersion)
    const aberr = radius * 0.010;
    const rOff = { x: Math.cos(lightAngle + Math.PI/2) * aberr, y: Math.sin(lightAngle + Math.PI/2) * aberr };
    const bOff = { x: Math.cos(lightAngle - Math.PI/2) * aberr, y: Math.sin(lightAngle - Math.PI/2) * aberr };

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.filter = 'blur(7px)';

    const rGrad = ctx.createRadialGradient(gsx + rOff.x, gsy + rOff.y, 0, gsx + rOff.x, gsy + rOff.y, radius * 0.7);
    rGrad.addColorStop(0,   'rgba(255, 55, 35, 0.14)');
    rGrad.addColorStop(0.65,'rgba(255, 30, 10, 0.05)');
    rGrad.addColorStop(1,   'rgba(255, 0,  0,  0)');
    ctx.fillStyle = rGrad;
    ctx.beginPath();
    ctx.moveTo(gsx + rOff.x, gsy + rOff.y);
    ctx.arc(gsx + rOff.x, gsy + rOff.y, radius * 0.7, lightAngle - cone / 2.2, lightAngle + cone / 2.2);
    ctx.lineTo(gsx + rOff.x, gsy + rOff.y);
    ctx.fill();

    const bGrad = ctx.createRadialGradient(gsx + bOff.x, gsy + bOff.y, 0, gsx + bOff.x, gsy + bOff.y, radius * 0.7);
    bGrad.addColorStop(0,   'rgba(45, 90, 255, 0.14)');
    bGrad.addColorStop(0.65,'rgba(25, 60, 255, 0.05)');
    bGrad.addColorStop(1,   'rgba(0,  0,  255, 0)');
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.moveTo(gsx + bOff.x, gsy + bOff.y);
    ctx.arc(gsx + bOff.x, gsy + bOff.y, radius * 0.7, lightAngle - cone / 2.2, lightAngle + cone / 2.2);
    ctx.lineTo(gsx + bOff.x, gsy + bOff.y);
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();
}


