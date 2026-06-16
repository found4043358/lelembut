// ============ PARTICLES ============
const particles=[];
function pEmit(x,y,n,color,sMin,sMax,grav){
    for(let i=0;i<n;i++){
        const a=Math.random()*Math.PI*2,s=sMin+Math.random()*(sMax-sMin);
        particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-10,life:1,decay:1.5+Math.random(),color,sz:1.5+Math.random()*3,g:grav||180});
    }
}
function pDust(x,y,dir){
    for(let i=0;i<2;i++) particles.push({x:x+(Math.random()-.5)*10,y,vx:-dir*(15+Math.random()*25),vy:-8-Math.random()*12,life:.6+Math.random()*.3,decay:2,color:'rgba(150,140,130,.7)',sz:2.5+Math.random()*3,g:50});
}
function pText(x,y,text,color){
    particles.push({x,y,vx:(Math.random()-0.5)*30,vy:-40-Math.random()*20,life:1,decay:0.8,color,text,type:'text',g:0});
}
function updateParticles(dt){
    if(hasWeather('rain') && (currentMapIdx === -1 || Math.random()<0.3)){
        const rx = cam.x + Math.random() * CW * 1.5 - CW*0.25;
        particles.push({x:rx, y:cam.y-50, vx:-100-Math.random()*50, vy:500+Math.random()*200, life:1, decay:0.5, color:'rgba(180,200,255,0.6)', sz:1.5, g:400, type:'rain'});
    }
    if(hasWeather('mist')){
        let mistCount = 0;
        for(const p of particles) { if(p.type === 'mist') mistCount++; }
        if(mistCount < 16 && Math.random() < 0.2){
            const mx = cam.x - CW*0.5 + Math.random() * CW * 2; // Spawn across wider area
            particles.push({x:mx, y:cam.y + Math.random()*CH, vx:-15-Math.random()*25, vy:0, life:0, 
maxLife:0.4+Math.random()*0.4, decay: -0.15, color:'mist', sz: 400+Math.random()*300, g:0, type:'mist'});
        }
    }
    if(hasWeather('lightning')) {
        const now = performance.now();
        if(!window._lightningTimer) window._lightningTimer = 0;
        if(now - window._lightningTimer > 4000 + Math.random()*8000) {
            window._lightningTimer = now;
            window._lightningFlash = { life: 1.0, x: cam.x + CW*0.2 + Math.random()*CW*0.6 };
        }
    }
    if(window._lightningFlash) {
        window._lightningFlash.life -= dt * 4.0;
        if(window._lightningFlash.life <= 0) window._lightningFlash = null;
    }

    for(let i=particles.length-1;i>=0;i--){
        const p=particles[i];
        p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=p.g*dt;
        
        if(p.type === 'mist') {
            if(p.decay < 0 && p.life >= p.maxLife) p.decay = Math.abs(p.decay); // start fading
            p.life -= p.decay * dt;
        } else {
            p.life -= p.decay * dt;
        }

        if(p.type === 'rain' && p.y > cam.y+CH) p.life = 0;
        else if(p.type === 'rain' && isSolidTile(mapTile(Math.floor(p.x/TS),Math.floor(p.y/TS)))){
            pEmit(p.x, p.y-2, 2, 'rgba(180,200,255,0.5)', 20, 50, 300);
            p.life = 0;
        }
        
        if(p.life<=0 && p.decay > 0) particles.splice(i,1);
    }
}
function drawBGEffects(ctx,cx,cy){
    for(const p of particles){
        if(p.type === 'mist'){
            const grad = ctx.createRadialGradient(p.x-cx, p.y-cy, 0, p.x-cx, p.y-cy, p.sz);
            grad.addColorStop(0, `rgba(220,230,240,${p.life * 0.08})`); // Very transparent mist
            grad.addColorStop(1, 'rgba(220,230,240,0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(p.x-cx, p.y-cy, p.sz, 0, Math.PI*2); ctx.fill();
        }
    }
}
function drawParticles(ctx,cx,cy){
    for(const p of particles){
        if(p.type === 'mist'){
            continue; // Mist is now drawn in drawBGEffects behind tiles
        } else if(p.type === 'rain'){
            ctx.strokeStyle = p.color; ctx.lineWidth = p.sz; ctx.globalAlpha = p.life;
            ctx.beginPath(); ctx.moveTo(p.x-cx, p.y-cy); ctx.lineTo(p.x-cx - p.vx*0.05, p.y-cy - p.vy*0.05); ctx.stroke();
        } else if(p.type === 'text'){
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.font = 'bold 16px "Special Elite", Arial';
            ctx.textAlign = 'center';
            ctx.fillText(p.text, p.x-cx, p.y-cy);
        } else if(p.type === 'smoke'){
            const grad = ctx.createRadialGradient(p.x-cx, p.y-cy, 0, p.x-cx, p.y-cy, p.sz);
            grad.addColorStop(0, `rgba(150,150,150,${p.life * 0.8})`);
            grad.addColorStop(1, 'rgba(150,150,150,0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(p.x-cx, p.y-cy, p.sz, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=p.color;
            ctx.beginPath(); ctx.arc(p.x-cx, p.y-cy, p.sz, 0, Math.PI*2); ctx.fill();
        }
    }
    ctx.globalAlpha=1;

    if(map.fog > 0){
        // Depth Vignette Fog
        const grad = ctx.createRadialGradient(CW/2, CH/2, CH*0.2, CW/2, CH/2, CW*0.8);
        grad.addColorStop(0, `rgba(5, 7, 10, 0)`);
        grad.addColorStop(1, `rgba(5, 7, 10, ${map.fog})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,CW,CH);
    }

    // Lightning flash overlay + bolt
    if(window._lightningFlash && window._lightningFlash.life > 0) {
        const fl = window._lightningFlash;
        const alpha = fl.life * 0.55;
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
        ctx.fillRect(0, 0, CW, CH);
        // Draw zigzag bolt from top to ground
        if(fl.life > 0.5) {
            ctx.save();
            ctx.strokeStyle = `rgba(255, 255, 255, ${fl.life * 0.9})`;
            ctx.lineWidth = 2 + fl.life * 2;
            ctx.shadowColor = '#88aaff';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            let bx = fl.x - cx;
            let by = 0;
            ctx.moveTo(bx, by);
            const steps = 10;
            for(let i=1; i<=steps; i++) {
                bx += (Math.random()-0.5)*60;
                by = (CH / steps) * i;
                ctx.lineTo(bx, by);
            }
            ctx.stroke();
            // Branch
            const branchAt = Math.floor(steps*0.4);
            ctx.lineWidth = 1;
            ctx.beginPath();
            let bbx = fl.x - cx + (Math.random()-0.5)*40;
            let bby = (CH/steps)*branchAt;
            ctx.moveTo(bbx, bby);
            for(let i=0; i<4; i++) {
                bbx += (Math.random()-0.5)*40;
                bby += CH/steps*0.6;
                ctx.lineTo(bbx, bby);
            }
            ctx.stroke();
            ctx.restore();
        }
    }
}

