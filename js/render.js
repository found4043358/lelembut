// ============ RENDER ============
function drawBG(ctx) {
    const mode = gameState === 'PLAY' ? 'preview' : edViewMode;

    if (mode === 'flat') {
        ctx.fillStyle = '#111';
        ctx.fillRect(-CW * 3, -CH * 3, CW * 7, CH * 7);
        ctx.save(); ctx.translate(-cam.x % TS, -cam.y % TS);
        ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
        for (let x = -CW * 3; x <= CW * 4; x += TS) { ctx.beginPath(); ctx.moveTo(x, -CH * 3); ctx.lineTo(x, CH * 4); ctx.stroke(); }
        for (let y = -CH * 3; y <= CH * 4; y += TS) { ctx.beginPath(); ctx.moveTo(-CW * 3, y); ctx.lineTo(CW * 4, y); ctx.stroke(); }
        ctx.restore();
        return;
    }

    if (currentMapIdx === -1) {
        if (window.graphicsQuality === 'ultralow' || window.graphicsQuality === 'lowest') {
            // Potato Mode: No mountains, no trees, no sun, just gradient
            const skyG = ctx.createLinearGradient(0, 0, 0, CH);
            skyG.addColorStop(0, '#202020ff'); skyG.addColorStop(1, '#1d1d1dff');
            ctx.fillStyle = skyG; ctx.fillRect(0, 0, CW, CH);
            return;
        }

        const skyG = ctx.createLinearGradient(0, 0, 0, CH);
        skyG.addColorStop(0, map.fog > 0.5 ? '#020305' : '#060814');
        skyG.addColorStop(1, map.fog > 0.5 ? '#0a0c10' : '#141824');
        ctx.fillStyle = skyG; ctx.fillRect(0, 0, CW, CH);

        if (map.fog < 0.7) {
            ctx.fillStyle = 'rgba(255,255,255,.4)';
            for (let i = 0; i < 60; i++) {
                const sx = ((42 * (i * 73)) % 1000) / 1000 * CW, sy = ((42 * (i * 37)) % 1000) / 1000 * (CH * .5);
                ctx.globalAlpha = (.3 + .7 * Math.abs(Math.sin(performance.now() / 900 + i))) * .4 * (1 - map.fog);
                ctx.fillRect(sx, sy, 1.5, 1.5);
            }
            ctx.globalAlpha = 1;
        }

        if (map.fog < 0.9) {
            const mx = CW * 0.8 - cam.x * 0.02; const my = CH * 0.2 - cam.y * 0.02 + (map.bgY || 0);
            ctx.fillStyle = `rgba(255,255,220,${0.8 - map.fog * 0.5})`;
            ctx.beginPath(); ctx.arc(mx, my, 40, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = skyG; ctx.beginPath(); ctx.arc(mx - 10, my - 5, 35, 0, Math.PI * 2); ctx.fill();
        }

        const mountBaseY = CH + (map.bgY || 0);

        ctx.fillStyle = `rgba(10,12,16,${0.9 - map.fog * 0.2})`;
        const px0 = ((-cam.x * .05) - 200) % 800;
        for (let i = -1; i < 5; i++) {
            ctx.beginPath(); ctx.moveTo(px0 + i * 800, mountBaseY);
            ctx.lineTo(px0 + i * 800 + 400, mountBaseY - 500);
            ctx.lineTo(px0 + i * 800 + 800, mountBaseY); ctx.fill();
        }

        ctx.fillStyle = `rgba(15,18,25,${0.95 - map.fog * 0.1})`;
        const px1 = ((-cam.x * .12) - 100) % 500;
        for (let i = -1; i < 8; i++) {
            ctx.beginPath(); ctx.moveTo(px1 + i * 500, mountBaseY);
            ctx.lineTo(px1 + i * 500 + 250, mountBaseY - 350);
            ctx.lineTo(px1 + i * 500 + 500, mountBaseY); ctx.fill();
        }

        ctx.fillStyle = `rgba(12,18,15,${0.97 - map.fog * 0.05})`;
        const fpx = ((-cam.x * .25) - 50) % 200;
        for (let i = -2; i < CW / 200 + 2; i++) {
            for (let j = 0; j < 5; j++) {
                const bx = fpx + i * 200 + j * 40;
                ctx.beginPath(); ctx.moveTo(bx, mountBaseY);
                ctx.lineTo(bx + 20, mountBaseY - 120 + (j % 3) * 20);
                ctx.lineTo(bx + 40, mountBaseY); ctx.fill();
            }
        }

        ctx.fillStyle = `rgba(14,11,11,1)`;
        const px2 = ((-cam.x * .35) - 80) % 240; const treeBaseY = CH + (map.bgY || 0);
        for (let i = -1; i < 10; i++) {
            const bx = px2 + i * 240 + 60;
            ctx.fillRect(bx, treeBaseY - 260, 14, 260);
            ctx.beginPath();
            ctx.moveTo(bx + 7, treeBaseY - 160); ctx.lineTo(bx - 45, treeBaseY - 240); ctx.lineTo(bx - 38, treeBaseY - 232);
            ctx.moveTo(bx + 7, treeBaseY - 180); ctx.lineTo(bx + 55, treeBaseY - 230); ctx.lineTo(bx + 48, treeBaseY - 222); ctx.fill();
        }
    } else {
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, CW, CH);
        ctx.fillStyle = '#1a1515';
        const px = (-cam.x * .2) % 200;
        for (let i = -1; i < 10; i++) ctx.fillRect(px + i * 200, 0, 20, CH);
    }
}

function drawDecorations(ctx) {
    if (window.graphicsQuality === 'ultralow') return; // Potato Mode: skip decorations completely
    const mode = gameState === 'PLAY' ? 'preview' : edViewMode;
    ctx.save(); ctx.translate(-cam.x, -cam.y);

    map.decorations.forEach(d => {
        if (d.mapIdx !== currentMapIdx) return;
        const x = d.x, y = d.y;

        if (d.type === 'dec_tree') {
            ctx.fillStyle = '#3d2817'; ctx.fillRect(x + 15, y - 80, 10, 80);
            ctx.fillStyle = '#1c4a1e'; ctx.beginPath(); ctx.arc(x + 20, y - 100, 30, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#235e26'; ctx.beginPath(); ctx.arc(x + 5, y - 80, 20, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + 35, y - 75, 25, 0, Math.PI * 2); ctx.fill();
        } else if (d.type === 'dec_house') {
            ctx.fillStyle = '#5c4333'; ctx.fillRect(x - 40, y - 100, 120, 100);
            ctx.fillStyle = '#a63b2e'; ctx.beginPath(); ctx.moveTo(x + 20, y - 150); ctx.lineTo(x - 50, y - 100); ctx.lineTo(x + 90, y - 100); ctx.fill();
            ctx.fillStyle = '#222'; ctx.fillRect(x - 5, y - 40, 25, 40);
            ctx.fillStyle = '#ffd700'; ctx.fillRect(x + 15, y - 20, 4, 4);
            ctx.fillStyle = '#add8e6'; ctx.fillRect(x - 25, y - 80, 20, 20); ctx.fillRect(x + 45, y - 80, 20, 20);
        } else if (d.type === 'dec_grass') {
            ctx.fillStyle = '#3c8c40'; ctx.beginPath();
            ctx.moveTo(x + 5, y); ctx.lineTo(x + 15, y - 20); ctx.lineTo(x + 18, y);
            ctx.moveTo(x + 20, y); ctx.lineTo(x + 25, y - 15); ctx.lineTo(x + 30, y); ctx.fill();
        } else if (d.type === 'dec_torch') {
            ctx.fillStyle = '#553311'; ctx.fillRect(x + 16, y, 8, 30);
            ctx.fillStyle = '#ff8800'; ctx.beginPath(); ctx.arc(x + 20, y - 5 + Math.sin(performance.now() / 100) * 3, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(x + 20, y - 5 + Math.sin(performance.now() / 100) * 3, 4, 0, Math.PI * 2); ctx.fill();
        } else if (d.type === 'dec_lamp') {
            ctx.fillStyle = '#222'; ctx.fillRect(x + 18, y, 4, 40);
            ctx.fillRect(x + 10, y - 10, 20, 10);
            ctx.fillStyle = '#e0ffff'; ctx.beginPath(); ctx.arc(x + 20, y, 6, 0, Math.PI * 2); ctx.fill();
        } else if (d.type === 'dec_car') {
            ctx.fillStyle = '#2a4b7c'; ctx.fillRect(x - 30, y - 30, 100, 30);
            ctx.fillRect(x - 10, y - 55, 60, 25);
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x - 5, y, 15, 0, Math.PI * 2); ctx.arc(x + 45, y, 15, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#add8e6'; ctx.fillRect(x + 30, y - 50, 15, 15);
        }
    });
    ctx.restore();
}

function drawTiles(ctx) {
    const d = getActiveMap();
    let mode = gameState === 'PLAY' ? 'preview' : edViewMode;
    if (window.graphicsQuality === 'ultralow') {
        mode = 'flat';
    }
    const zoom = (typeof camZoom !== 'undefined' && camZoom > 0) ? camZoom : 1;
    const viewRadiusX = Math.ceil((CW / zoom) / TS);
    const viewRadiusY = Math.ceil((CH / zoom) / TS);
    const centerX = Math.floor((cam.x + CW / 2) / TS);
    const centerY = Math.floor((cam.y + CH / 2) / TS);
    const sc = Math.max(0, centerX - viewRadiusX);
    const ec = Math.min(d.cols - 1, centerX + viewRadiusX);
    const sr = Math.max(0, centerY - viewRadiusY);
    const er = Math.min(d.rows - 1, centerY + viewRadiusY);

    // Pass 1: Background Tiles
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    for (let r = sr; r <= er; r++) {
        for (let c = sc; c <= ec; c++) {
            const rawT = d.tiles[r][c];
            if (rawT === TILE_EMPTY) continue;

            const px = c * TS, py = r * TS; let drawH = (r === d.rows - 1) ? CH * 3 : TS;
            const bg = typeof getBg === 'function' ? getBg(rawT) : 0;

            if (bg !== TILE_EMPTY) {
                // Solid Backgrounds (no opacity)
                if (bg === TILE_BG_DIRT) { ctx.fillStyle = '#221814'; ctx.fillRect(px, py, TS, drawH); }
                else if (bg === TILE_BG_STONE) { ctx.fillStyle = '#222'; ctx.fillRect(px, py, TS, drawH); }
                else if (bg === TILE_BG_METAL) { ctx.fillStyle = '#334'; ctx.fillRect(px, py, TS, drawH); }
                else if (bg === TILE_BG_ICE) { ctx.fillStyle = '#113355'; ctx.fillRect(px, py, TS, drawH); }
                else if (bg === TILE_BG_GLASS) { ctx.fillStyle = '#223333'; ctx.fillRect(px, py, TS, drawH); }
                else if (bg === TILE_BG_WOOD) {
                    ctx.fillStyle = '#3a2510'; ctx.fillRect(px, py, TS, drawH);
                    // Wood grain lines
                    if (mode !== 'flat') {
                        ctx.strokeStyle = '#2c1c0a'; ctx.lineWidth = 1;
                        for (let li = 0; li < drawH; li += 8) { ctx.beginPath(); ctx.moveTo(px, py + li); ctx.lineTo(px + TS, py + li); ctx.stroke(); }
                    }
                }
            }
        }
    }
    ctx.restore();

    // Pass 2: Decorations (now in front of backgrounds)
    drawDecorations(ctx);

    // Pass 3: Foreground Tiles
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    for (let r = sr; r <= er; r++) {
        for (let c = sc; c <= ec; c++) {
            const rawT = d.tiles[r][c];
            if (rawT === TILE_EMPTY) continue;

            const px = c * TS, py = r * TS; let drawH = (r === d.rows - 1) ? CH * 3 : TS;
            const t = typeof getFg === 'function' ? getFg(rawT) : rawT;

            if (t === TILE_EMPTY) continue;

            if (t === TILE_DIRT) {
                ctx.fillStyle = mode === 'flat' ? '#555' : (currentMapIdx === -1 ? '#382b20' : '#2c2420'); ctx.fillRect(px, py, TS, drawH);
                if (mode !== 'flat' && (r === 0 || !isSolidTile(getFg(d.tiles[r - 1][c])))) {
                    ctx.fillStyle = '#4c3d2e'; ctx.fillRect(px, py, TS, 6);
                }
            } else if (t === TILE_STONE) {
                ctx.fillStyle = mode === 'flat' ? '#777' : '#444'; ctx.fillRect(px, py, TS, drawH);
                if (mode !== 'flat') { ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.strokeRect(px + .5, py + .5, TS - 1, TS - 1); }
            } else if (t === TILE_METAL) {
                ctx.fillStyle = mode === 'flat' ? '#999' : '#67727a'; ctx.fillRect(px, py, TS, drawH);
                if (mode !== 'flat') { ctx.strokeStyle = '#8c959c'; ctx.lineWidth = 2; ctx.strokeRect(px + 2, py + 2, TS - 4, TS - 4); }
            } else if (t === TILE_ICE) {
                ctx.fillStyle = mode === 'flat' ? '#8cf' : 'rgba(140,200,255,0.7)'; ctx.fillRect(px, py, TS, drawH);
                if (mode !== 'flat') { ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(px, py, TS, 4); }
            } else if (t === TILE_GLASS) {
                ctx.fillStyle = mode === 'flat' ? '#dde' : 'rgba(200,220,230,0.4)'; ctx.fillRect(px, py, TS, drawH);
                if (mode !== 'flat') { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(px, py, TS, TS); ctx.beginPath(); ctx.moveTo(px + TS, py); ctx.lineTo(px, py + TS); ctx.stroke(); }
            } else if (t === TILE_WOOD) {
                ctx.fillStyle = mode === 'flat' ? '#853' : '#5c3a21'; ctx.fillRect(px, py, TS, drawH);
                if (mode !== 'flat') { ctx.strokeStyle = '#3e2716'; ctx.lineWidth = 1; ctx.strokeRect(px + .5, py + .5, TS - 1, TS - 1); ctx.beginPath(); ctx.moveTo(px + TS / 2, py); ctx.lineTo(px + TS / 2, py + TS); ctx.stroke(); }
            } else if (t === TILE_BRICK) {
                ctx.fillStyle = mode === 'flat' ? '#a43' : '#8f3a2c'; ctx.fillRect(px, py, TS, drawH);
                if (mode !== 'flat') { ctx.strokeStyle = '#c15848'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, py + TS / 2); ctx.lineTo(px + TS, py + TS / 2); ctx.stroke(); }
            } else if (t === TILE_PLAT) {
                ctx.fillStyle = mode === 'flat' ? '#b55' : '#4a3320'; ctx.fillRect(px, py, TS, 10);
                if (mode !== 'flat') { ctx.fillStyle = '#332010'; ctx.fillRect(px, py, TS, 3); }
            } else if (t === TILE_CRUMBLE) {
                // Determine if crumbling
                let isCrumbling = false;
                let cTime = 1.0;
                if (typeof crumblingTiles !== 'undefined') {
                    const ct = crumblingTiles.find(ct => ct.r === r && ct.c === c && ct.mapIdx === currentMapIdx);
                    if (ct) { isCrumbling = true; cTime = ct.timer; }
                }
                let ox = 0, oy = 0;
                if (isCrumbling && cTime < 0.5) {
                    ox = (Math.random() - 0.5) * 4; oy = (Math.random() - 0.5) * 4;
                }
                ctx.fillStyle = mode === 'flat' ? '#973' : '#7a5c38'; ctx.fillRect(px + ox, py + oy, TS, 10);
                if (mode !== 'flat') {
                    ctx.fillStyle = '#543d22'; ctx.fillRect(px + ox, py + oy, TS, 3);
                    // Draw cracks
                    ctx.strokeStyle = '#382816'; ctx.beginPath(); ctx.moveTo(px + TS / 3 + ox, py + oy); ctx.lineTo(px + TS / 2 + ox, py + oy + 5); ctx.lineTo(px + TS * 0.8 + ox, py + oy + 10); ctx.stroke();
                }
            } else if (t === TILE_WOOD_PLANK) {
                // Horizontal planks - solid warm brown
                ctx.fillStyle = mode === 'flat' ? '#964' : '#7a4e2d'; ctx.fillRect(px, py, TS, drawH);
                if (mode !== 'flat') {
                    ctx.strokeStyle = '#5c3519'; ctx.lineWidth = 1;
                    // Horizontal plank lines
                    for (let li = 0; li < drawH; li += 8) {
                        ctx.beginPath(); ctx.moveTo(px, py + li); ctx.lineTo(px + TS, py + li); ctx.stroke();
                    }
                    // Nail marks
                    ctx.fillStyle = '#4a2b12';
                    ctx.fillRect(px + 4, py + 4, 3, 3);
                    ctx.fillRect(px + TS - 7, py + 4, 3, 3);
                }
            } else if (t === TILE_CRACKED_WOOD) {
                // Breakable cracked wood - lighter with visible cracks
                let hp = 1.0, isBreaking = false;
                if (typeof crackingTiles !== 'undefined') {
                    const ct = crackingTiles.find(ct => ct.r === r && ct.c === c && ct.mapIdx === currentMapIdx);
                    if (ct) { hp = ct.hp / ct.maxHp; isBreaking = true; }
                }
                let ox = 0, oy = 0;
                const woodCol = mode === 'flat' ? '#a75' : `hsl(25,${50 + hp * 20}%,${20 + hp * 20}%)`;
                ctx.fillStyle = woodCol; ctx.fillRect(px + ox, py + oy, TS, drawH);
                if (mode !== 'flat') {
                    // Grain
                    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
                    for (let li = 0; li < drawH; li += 7) {
                        ctx.beginPath(); ctx.moveTo(px + ox, py + oy + li); ctx.lineTo(px + TS + ox, py + oy + li); ctx.stroke();
                    }
                    // Cracks
                    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(px + TS * 0.3 + ox, py + oy); ctx.lineTo(px + TS * 0.4 + ox, py + oy + TS * 0.5); ctx.lineTo(px + TS * 0.2 + ox, py + oy + TS); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(px + TS * 0.7 + ox, py + oy); ctx.lineTo(px + TS * 0.6 + ox, py + oy + TS * 0.5); ctx.lineTo(px + TS * 0.8 + ox, py + oy + TS); ctx.stroke();
                    if (hp < 0.5) {
                        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
                        ctx.beginPath(); ctx.moveTo(px + TS * 0.5 + ox, py + oy + TS * 0.1); ctx.lineTo(px + TS * 0.45 + ox, py + oy + TS * 0.8); ctx.stroke();
                    }
                }
            } else if (t === TILE_SPIKE) {
                ctx.fillStyle = mode === 'flat' ? '#f00' : '#888';
                ctx.beginPath(); ctx.moveTo(px, py + TS); ctx.lineTo(px + TS / 2, py + 5); ctx.lineTo(px + TS, py + TS); ctx.fill();
            } else if (t === TILE_BOUNCER) {
                ctx.fillStyle = mode === 'flat' ? '#f0f' : '#c0c'; ctx.fillRect(px, py + TS - 15, TS, 15);
                if (mode !== 'flat') { ctx.fillStyle = '#e3e'; ctx.fillRect(px + 5, py + TS - 20, TS - 10, 5); }
            } else if (t === TILE_WATER) {
                let isSurface = mode !== 'flat' && (r === 0 || getFg(d.tiles[r - 1][c]) !== TILE_WATER);
                ctx.fillStyle = mode === 'flat' ? '#00f' : 'rgba(30,100,200,0.4)';

                if (window.graphicsQuality === 'ultralow' || window.graphicsQuality === 'lowest') {
                    // Potato Mode: No sine waves, solid block to save CPU
                    ctx.fillRect(px, py + (isSurface ? 6 : 0), TS, drawH - (isSurface ? 6 : 0));
                } else if (isSurface) {
                    ctx.beginPath();
                    ctx.moveTo(px, py + drawH);
                    ctx.lineTo(px, py + 6);
                    for (let w = 0; w <= TS; w += 5) {
                        let waveY = py + 6 + Math.sin(performance.now() / 300 + (px + w) * 0.05) * 4;
                        ctx.lineTo(px + w, waveY);
                    }
                    ctx.lineTo(px + TS, py + drawH);
                    ctx.fill();

                    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    for (let w = 0; w <= TS; w += 5) {
                        let waveY = py + 6 + Math.sin(performance.now() / 300 + (px + w) * 0.05) * 4;
                        if (w === 0) ctx.moveTo(px + w, waveY);
                        else ctx.lineTo(px + w, waveY);
                    }
                    ctx.stroke();
                } else {
                    ctx.fillRect(px, py, TS, drawH);
                }
            } else if (t === TILE_LAVA) {
                ctx.fillStyle = mode === 'flat' ? '#f50' : 'rgba(220,50,0,0.9)'; ctx.fillRect(px, py, TS, drawH);
                if (mode !== 'flat') {
                    ctx.fillStyle = 'rgba(255,200,0,0.6)'; ctx.fillRect(px, py, TS, 4);
                    if (gameState === 'PLAY' && Math.random() < 0.02) {
                        particles.push({
                            x: px + Math.random() * TS,
                            y: py + 4,
                            vx: (Math.random() - 0.5) * 10,
                            vy: -10 - Math.random() * 20,
                            life: 0.5 + Math.random() * 0.5, maxLife: 1,
                            color: 'rgba(255, 100, 0, 0.8)',
                            size: 2 + Math.random() * 3
                        });
                    }
                }
            } else if (t === TILE_LADDER) {
                ctx.fillStyle = '#6b4226';
                ctx.fillRect(px + 4, py, 4, drawH);
                ctx.fillRect(px + TS - 8, py, 4, drawH);
                for (let ly = 0; ly < drawH; ly += 10) {
                    ctx.fillRect(px + 6, py + ly + 4, TS - 12, 3);
                }
            }
        }
    }

    const now = performance.now() / 1000;

    // Pickups
    for (const pk of map.pickups) {
        const mIdx = pk.mapIdx || -1;
        if (mIdx !== currentMapIdx) continue;
        if (pk.got && gameState !== 'EDITOR') continue;
        const bob = Math.sin(now * 2 + pk.x) * 4;

        if (pk.t === 'ammo') {
            ctx.fillStyle = '#c8a000'; ctx.fillRect(pk.x + 14, pk.y + 10 + bob, 12, 18);
            ctx.fillStyle = '#ffee88'; ctx.fillRect(pk.x + 14, pk.y + 10 + bob, 12, 4);
        } else if (pk.t === 'ammo_mg') {
            ctx.fillStyle = '#9b7a00'; ctx.fillRect(pk.x + 10, pk.y + 12 + bob, 20, 16);
            ctx.fillStyle = '#eebb00';
            for (let i = 0; i < 3; i++) ctx.fillRect(pk.x + 12 + i * 6, pk.y + 8 + bob, 4, 10);
        } else if (pk.t === 'ammo_sniper') {
            ctx.fillStyle = '#553311'; ctx.fillRect(pk.x + 16, pk.y + 8 + bob, 8, 22);
            ctx.fillStyle = '#ff5500';
            ctx.beginPath(); ctx.moveTo(pk.x + 16, pk.y + 8 + bob); ctx.lineTo(pk.x + 24, pk.y + 8 + bob); ctx.lineTo(pk.x + 20, pk.y + 2 + bob); ctx.fill();
        } else if (pk.t === 'hp') {
            ctx.fillStyle = '#ff2255';
            ctx.beginPath();
            const hx = pk.x + TS / 2, hy = pk.y + TS / 2 + bob - 4;
            ctx.moveTo(hx, hy + 4);
            ctx.bezierCurveTo(hx - 12, hy - 6, hx - 16, hy + 8, hx, hy + 18);
            ctx.bezierCurveTo(hx + 16, hy + 8, hx + 12, hy - 6, hx, hy + 4);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.beginPath(); ctx.arc(hx - 5, hy + 2, 2, 0, Math.PI * 2); ctx.fill();
        } else if (pk.t === 'battery') {
            ctx.fillStyle = '#333'; ctx.fillRect(pk.x + 12, pk.y + 10 + bob, 16, 20);
            ctx.fillStyle = '#777'; ctx.fillRect(pk.x + 16, pk.y + 6 + bob, 8, 4);
            ctx.fillStyle = '#00ffcc'; ctx.fillRect(pk.x + 14, pk.y + 14 + bob, 12, 14);
        } else if (pk.t === 'nightvision') {
            ctx.fillStyle = '#333'; ctx.fillRect(pk.x + 8, pk.y + 16 + bob, 24, 8);
            ctx.fillStyle = '#00ff00'; ctx.fillRect(pk.x + 10, pk.y + 18 + bob, 8, 4); ctx.fillRect(pk.x + 22, pk.y + 18 + bob, 8, 4);
        } else if (pk.t === 'gun_mg') {
            ctx.fillStyle = '#222'; ctx.fillRect(pk.x + 4, pk.y + 16 + bob, 32, 8);
            ctx.fillStyle = '#444'; ctx.fillRect(pk.x + 16, pk.y + 24 + bob, 6, 8);
            ctx.fillStyle = '#ffaa00'; ctx.fillRect(pk.x + 36, pk.y + 18 + bob, 4, 4);
        } else if (pk.t === 'gun_sniper') {
            ctx.fillStyle = '#1a331a'; ctx.fillRect(pk.x + 2, pk.y + 18 + bob, 36, 6);
            ctx.fillStyle = '#111'; ctx.fillRect(pk.x + 10, pk.y + 14 + bob, 12, 4);
            ctx.fillStyle = '#ff4400'; ctx.fillRect(pk.x + 38, pk.y + 19 + bob, 4, 4);
        } else if (pk.t === 'medkit') {
            ctx.fillStyle = '#eee'; ctx.fillRect(pk.x + 8, pk.y + 12 + bob, 24, 20);
            ctx.fillStyle = '#ff2222'; ctx.fillRect(pk.x + 18, pk.y + 16 + bob, 4, 12);
            ctx.fillRect(pk.x + 14, pk.y + 20 + bob, 12, 4);
        } else if (pk.t.startsWith('potion_')) {
            let col = pk.t === 'potion_speed' ? '#00ddff' : pk.t === 'potion_jump' ? '#ff00ff' : '#ffff00';
            ctx.fillStyle = '#ccc'; ctx.fillRect(pk.x + 16, pk.y + 10 + bob, 8, 6);
            ctx.fillStyle = col;
            ctx.beginPath(); ctx.arc(pk.x + 20, pk.y + 24 + bob, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.beginPath(); ctx.arc(pk.x + 16, pk.y + 20 + bob, 3, 0, Math.PI * 2); ctx.fill();
        } else if (pk.t === 'grenade') {
            ctx.fillStyle = '#225522'; ctx.beginPath(); ctx.arc(pk.x + TS / 2, pk.y + TS / 2 + bob, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffcc00'; ctx.fillRect(pk.x + TS / 2 - 2, pk.y + TS / 2 - 10 + bob, 4, 4);
        } else if (pk.t === 'landmine') {
            ctx.fillStyle = '#444'; ctx.fillRect(pk.x + 8, pk.y + 24 + bob, 24, 6);
            ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.arc(pk.x + TS / 2, pk.y + 24 + bob, 3, 0, Math.PI * 2); ctx.fill();
        } else if (pk.t === 'smoke') {
            ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(pk.x + TS / 2, pk.y + TS / 2 + bob, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(pk.x + TS / 2, pk.y + TS / 2 + bob, 4, 0, Math.PI * 2); ctx.fill();
        } else if (pk.t === 'check') {
            ctx.fillStyle = '#555'; ctx.fillRect(pk.x + TS / 2 - 2, pk.y, 4, TS);
            ctx.fillStyle = pk.got ? '#0f0' : '#777'; ctx.beginPath(); ctx.moveTo(pk.x + TS / 2, pk.y); ctx.lineTo(pk.x + TS, pk.y + 8); ctx.lineTo(pk.x + TS / 2, pk.y + 16); ctx.fill();
        } else if (pk.t === 'end') {
            ctx.fillStyle = '#ddaa00'; ctx.fillRect(pk.x + 5, pk.y, TS - 10, TS);
            ctx.fillStyle = '#ffcc00'; ctx.fillText('🏆', pk.x + 8, pk.y + TS / 2);
        }
    }

    // Doors
    for (const dr of map.doors) {
        const mIdx = dr.mapIdx || -1;
        if (mIdx !== currentMapIdx) continue;
        ctx.fillStyle = '#1a0f0a'; ctx.fillRect(dr.wx - TS / 2, dr.wy - TS * 2, TS * 2, TS * 2.5);
        ctx.fillStyle = '#0d0906'; ctx.fillRect(dr.wx, dr.wy - TS * 1.5, TS, TS * 1.8);
        ctx.strokeStyle = '#3d2a1a'; ctx.lineWidth = 3; ctx.strokeRect(dr.wx - TS / 2, dr.wy - TS * 2, TS * 2, TS * 2.5);
        if (gameState === 'EDITOR') {
            ctx.fillStyle = '#fff'; ctx.font = '12px monospace';
            ctx.fillText(dr.targetRoom === -1 ? 'To Out' : 'To Rm ' + (dr.targetRoom + 1), dr.wx - 15, dr.wy - TS * 2 - 5);
        }
    }

    // Spawn Point in Editor
    if (gameState === 'EDITOR' && currentMapIdx === -1) {
        ctx.fillStyle = '#fff'; ctx.fillRect(map.spawnX, map.spawnY, 20, 32);
        ctx.fillStyle = '#f00'; ctx.font = '16px monospace'; ctx.fillText('🚩', map.spawnX, map.spawnY - 5);
    }

    // Editor Selection Highlight
    if (gameState === 'EDITOR' && edTool === 'select') {
        ctx.fillStyle = 'rgba(0,150,255,0.4)';
        for (let r = 0; r < d.rows; r++) {
            for (let c = 0; c < d.cols; c++) {
                if (edSel.grid[r] && edSel.grid[r][c]) ctx.fillRect(c * TS, r * TS, TS, TS);
            }
        }
        ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2;
        edSel.entities.forEach(en => {
            if (en.type === 'enemy') ctx.strokeRect(en.ref.x, en.ref.y, 26, 34);
            else if (en.type === 'pickup') ctx.strokeRect(en.ref.x, en.ref.y, TS, TS);
            else if (en.type === 'decor') ctx.strokeRect(en.ref.x - 10, en.ref.y - 10, TS + 20, TS + 20);
            else if (en.type === 'door') ctx.strokeRect(en.ref.wx - TS / 2, en.ref.wy - TS * 2, TS * 2, TS * 2.5);
            else if (en.type === 'spawn') ctx.strokeRect(map.spawnX, map.spawnY, 20, 32);
        });

        if (edSel.active && edSel.rect) {
            ctx.strokeStyle = 'rgba(0,255,255,0.8)'; ctx.lineWidth = 1;
            ctx.strokeRect(edSel.rect.x, edSel.rect.y, edSel.rect.w, edSel.rect.h);
        }
    }

    ctx.restore();
}

function drawPlayer(ctx) {
    const p = player; const sx = p.x - cam.x, sy = p.y - cam.y;
    if (p.invT > 0 && (!p.buffs || p.buffs.shield <= 0) && Math.floor(performance.now() / 80) % 2 === 0) return;
    ctx.save(); ctx.translate(sx, sy);
    ctx.fillStyle = '#888'; ctx.fillRect(0, 8, p.w, p.h - 8);
    ctx.fillStyle = '#aaa'; ctx.fillRect(3, 0, p.w - 6, 12);
    ctx.fillStyle = '#fff';
    if (p.right) { ctx.fillRect(p.w - 8, 2, 4, 4); ctx.fillStyle = '#000'; ctx.fillRect(p.w - 7, 3, 2, 2); }
    else { ctx.fillRect(4, 2, 4, 4); ctx.fillStyle = '#000'; ctx.fillRect(5, 3, 2, 2); }
    ctx.fillStyle = '#4a3a28'; ctx.fillRect(0, 12, p.w, 12);
    ctx.fillStyle = '#2a2a2a';
    const bob = p.grounded && Math.abs(p.vx) > 10 ? Math.sin(p.bobPhase) * 4 : 0;
    ctx.fillRect(2, 24, 7, 8 - bob); ctx.fillRect(p.w - 9, 24, 7, 8 + bob);

    // Gun
    ctx.save();
    ctx.translate(p.w / 2, p.h / 2);
    if (typeof p.gunAngle !== 'undefined') {
        ctx.rotate(p.gunAngle);
    } else {
        ctx.rotate(p.right ? 0 : Math.PI);
    }
    ctx.fillStyle = '#555'; ctx.fillRect(4, -2, 16, 5);
    ctx.fillStyle = '#333'; ctx.fillRect(16, -1, 5, 3);
    ctx.restore();

    // Shield Bubble
    if (p.buffs && p.buffs.shield > 0) {
        ctx.save();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const pRad = 22 + Math.sin(performance.now() / 150) * 2;
        ctx.arc(p.w / 2, p.h / 2, pRad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 255, 255, 0.15)';
        ctx.fill();
        ctx.restore();
    }

    ctx.restore();

    // Reload bar (outside save/restore)
    if (p.reloadCd > 0) {
        const wBar = 24;
        const hBar = 4;
        const progress = 1 - (p.reloadCd / p.currentWeapon.reloadTime);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(p.x - cam.x + p.w / 2 - wBar / 2, p.y - cam.y + p.h + 4, wBar, hBar);
        ctx.fillStyle = '#fff';
        ctx.fillRect(p.x - cam.x + p.w / 2 - wBar / 2, p.y - cam.y + p.h + 4, wBar * progress, hBar);
    }

    ctx.fillStyle = '#ffee00';
    for (const b of p.bullets) { ctx.beginPath(); ctx.arc(b.x - cam.x, b.y - cam.y, 3, 0, Math.PI * 2); ctx.fill(); }
}

function drawThrowables(ctx) {
    if (typeof throwables === 'undefined') return;
    for (const t of throwables) {
        ctx.save();
        ctx.translate(t.x - cam.x + t.w / 2, t.y - cam.y + t.h / 2);

        if (t.type === 'grenade') {
            ctx.fillStyle = '#225522';
            ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(-1, -6, 2, 3);
            if (t.life < 1 && Math.floor(performance.now() / 100) % 2 === 0) {
                ctx.fillStyle = '#ff0000';
                ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
            }
        } else if (t.type === 'landmine') {
            ctx.fillStyle = '#444';
            ctx.fillRect(-6, 2, 12, 3);
            ctx.fillStyle = '#ff0000';
            ctx.beginPath(); ctx.arc(0, 2, 1.5, 0, Math.PI * 2); ctx.fill();
        } else if (t.type === 'smoke') {
            ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
    }
}

function drawAimTrajectory(ctx) {
    if (!player || !player.throwingItem) return;
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    let vx = 0, vy = 0;
    if (player.throwingItem === 'grenade' || player.throwingItem === 'smoke') {
        if (typeof aimMode !== 'undefined' && aimMode === 'mouse') {
            let diffX = (cam.x + mouseX) - px;
            let diffY = (cam.y + mouseY) - py;
            let dist = Math.hypot(diffX, diffY);
            if (dist > 500) {
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
            if (typeof aimLock !== 'undefined') {
                if (aimLock === -1) { dx *= 0.5; dy = -0.866; }
                else if (aimLock === 1) { dx *= 0.5; dy = 0.866; }
            }
            vx = dx * 400;
            vy = dy * 400 - 150;
        }
    }

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    const gravity = 600;
    const timeStep = 0.04;
    for (let i = 1; i <= 25; i++) {
        let t = i * timeStep;
        let projX = px + vx * t;
        let projY = py + vy * t + 0.5 * gravity * t * t;

        ctx.beginPath();
        // Make dots smaller as they go further
        ctx.arc(projX - cam.x, projY - cam.y, Math.max(1, 3 - i * 0.08), 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw an indicator of what's being thrown
    if (typeof mouseX !== 'undefined' && typeof mouseY !== 'undefined') {
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = player.throwingItem === 'smoke' ? '#aaa' : (player.throwingItem === 'grenade' ? '#ff4400' : '#888');
        ctx.fillText("L-Click: Throw | R-Click: Cancel", mouseX - cam.x + 15, mouseY - cam.y + 15);
    }

    ctx.restore();
}

function drawEnemy(ctx, e) {
    if (e.dead && gameState !== 'EDITOR') return;
    const dist = Math.abs((e.x + e.w / 2) - (player.x + player.w / 2));
    if (dist > 500 && gameState !== 'EDITOR') return;

    if (e.type === 'kuyang') {
        const alpha = gameState === 'EDITOR' ? 1 : Math.min(1, (500 - dist) / 200);
        ctx.save(); ctx.translate(e.x - cam.x, e.y - cam.y); ctx.globalAlpha = alpha;

        // Head
        ctx.fillStyle = e.flash > 0 ? '#fff' : '#fcc';
        ctx.beginPath(); ctx.arc(e.w / 2, e.h / 2 - 5, 12, 0, Math.PI * 2); ctx.fill();

        // Eye
        ctx.fillStyle = '#000';
        const eyeX = e.vx > 0 ? 4 : (e.vx < 0 ? -4 : 0);
        ctx.beginPath(); ctx.arc(e.w / 2 + eyeX, e.h / 2 - 7, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f00';
        ctx.beginPath(); ctx.arc(e.w / 2 + eyeX + (e.vx > 0 ? 1 : (e.vx < 0 ? -1 : 0)), e.h / 2 - 7, 1, 0, Math.PI * 2); ctx.fill();

        // Hanging Organ
        ctx.fillStyle = e.flash > 0 ? '#fff' : '#800';
        ctx.beginPath(); ctx.ellipse(e.w / 2, e.h / 2 + 8, 6, 10, 0, 0, Math.PI * 2); ctx.fill();

        // Veins
        ctx.strokeStyle = '#500'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(e.w / 2, e.h / 2 + 2); ctx.lineTo(e.w / 2 - 4, e.h / 2 + 12);
        ctx.moveTo(e.w / 2, e.h / 2 + 2); ctx.lineTo(e.w / 2 + 4, e.h / 2 + 10); ctx.stroke();

        ctx.globalAlpha = 1;
        if (e.hp < e.maxHp) {
            ctx.fillStyle = '#400000'; ctx.fillRect(0, -8, e.w, 3);
            ctx.fillStyle = '#ffaa00'; ctx.fillRect(0, -8, e.w * (e.displayHp / e.maxHp), 3);
            ctx.fillStyle = '#cc0000'; ctx.fillRect(0, -8, e.w * (e.hp / e.maxHp), 3);
        }
        ctx.restore();
        return;
    }
    if (e.type === 'stalker') {
        const alpha = gameState === 'EDITOR' ? 1 : Math.min(1, (500 - dist) / 200);
        ctx.save(); ctx.translate(e.x - cam.x, e.y - cam.y); ctx.globalAlpha = alpha;

        // Shadowy Body
        ctx.fillStyle = e.flash > 0 ? '#fff' : '#111';
        ctx.fillRect(0, 0, e.w, e.h);

        // Tall shadowy head
        ctx.beginPath(); ctx.arc(e.w / 2, 0, 10, 0, Math.PI * 2); ctx.fill();

        // Glowing Eyes
        if (gameState === 'EDITOR' || player.flashlightOn) {
            ctx.fillStyle = e.flash > 0 ? '#000' : '#ff0000';
            const eyeDir = e.vx > 0 ? 3 : (e.vx < 0 ? -3 : 0);
            ctx.beginPath(); ctx.arc(e.w / 2 - 4 + eyeDir, -2, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(e.w / 2 + 4 + eyeDir, -2, 2, 0, Math.PI * 2); ctx.fill();
            // Glow effect
            ctx.globalAlpha = alpha * 0.5;
            ctx.beginPath(); ctx.arc(e.w / 2 - 4 + eyeDir, -2, 5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(e.w / 2 + 4 + eyeDir, -2, 5, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = alpha;
        }

        if (e.hp < e.maxHp) {
            ctx.fillStyle = '#400000'; ctx.fillRect(0, -12, e.w, 3);
            ctx.fillStyle = '#ffaa00'; ctx.fillRect(0, -12, e.w * (e.displayHp / e.maxHp), 3);
            ctx.fillStyle = '#cc0000'; ctx.fillRect(0, -12, e.w * (e.hp / e.maxHp), 3);
        }
        ctx.restore();
        return;
    }

    const alpha = gameState === 'EDITOR' ? 1 : Math.min(1, (400 - dist) / 200);
    ctx.save(); ctx.translate(e.x - cam.x, e.y - cam.y); ctx.globalAlpha = alpha * (e.state === 'chase' ? .85 : .45);
    ctx.fillStyle = e.flash > .1 ? '#ff5500' : '#4a0a0a'; ctx.fillRect(0, 0, e.w, e.h);
    ctx.fillStyle = e.flash > .1 ? '#ff8800' : '#6a0f0f'; ctx.beginPath();
    const wave = Math.sin(performance.now() / 200 + e.x) * 3;
    ctx.ellipse(e.w / 2, -5 + wave, e.w / 2 - 2, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff0000'; ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(e.w / 2 - 5, e.h / 3, 3, 0, Math.PI * 2); ctx.arc(e.w / 2 + 5, e.h / 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#880000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, e.h - 5); ctx.lineTo(-5, e.h + 4); ctx.moveTo(e.w, e.h - 5); ctx.lineTo(e.w + 5, e.h + 4); ctx.stroke();
    ctx.globalAlpha = 1;
    if (e.hp < e.maxHp) {
        ctx.fillStyle = '#400000'; ctx.fillRect(0, -8, e.w, 3);
        ctx.fillStyle = '#ffaa00'; ctx.fillRect(0, -8, e.w * (e.displayHp / e.maxHp), 3);
        ctx.fillStyle = '#cc0000'; ctx.fillRect(0, -8, e.w * (e.hp / e.maxHp), 3);
    }
    ctx.restore();
}
