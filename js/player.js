class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 22;
        this.h = 34;

        this.vx = 0;
        this.vy = 0;

        // Physics
        this.gravity     = 1500;
        this.maxFall     = 600;
        this.moveSpeed   = 280;
        this.accel       = 2200;
        this.friction    = 1800;
        this.jumpForce   = -620;

        this.isGrounded   = false;
        this.coyoteTime   = 0.1;
        this.coyoteTimer  = 0;
        this.jumpBuffer   = 0.12;
        this.jumpBufferTimer = 0;

        this.facingRight = true;

        // Combat
        this.health    = 100;
        this.maxHealth = 100;
        this.ammo      = 10;
        this.maxAmmo   = 30;
        this.bullets   = [];
        this.fireRate  = 0.35;
        this.fireCooldown = 0;
        this.invincibleTimer = 0; // brief invincibility after hit

        // Animation
        this.walkFrame  = 0;
        this.walkTimer  = 0;
        this.bobPhase   = 0;
    }

    update(dt, input, map, particles, enemies, audioSys) {
        // ----- Move -----
        let moveDir = 0;
        if (input.keys.left)  moveDir -= 1;
        if (input.keys.right) moveDir += 1;

        if (moveDir !== 0) {
            this.vx += moveDir * this.accel * dt;
            this.facingRight = moveDir > 0;
            if (this.isGrounded && Math.random() < 0.08) {
                particles.emitDust(this.x + this.w / 2, this.y + this.h, moveDir);
            }
        } else {
            const f = this.friction * dt;
            this.vx = this.vx > 0 ? Math.max(0, this.vx - f) : Math.min(0, this.vx + f);
        }
        this.vx = Math.max(-this.moveSpeed, Math.min(this.vx, this.moveSpeed));

        // ----- Walk animation -----
        if (this.isGrounded && Math.abs(this.vx) > 10) {
            this.walkTimer += dt;
            if (this.walkTimer > 0.12) { this.walkFrame = (this.walkFrame + 1) % 4; this.walkTimer = 0; }
            this.bobPhase += dt * 10;
        }

        // ----- Jump -----
        if (input.keys.jumpPressed) this.jumpBufferTimer = this.jumpBuffer;
        else if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;

        this.vy += this.gravity * dt;
        if (this.vy > this.maxFall) this.vy = this.maxFall;

        if (this.isGrounded) this.coyoteTimer = this.coyoteTime;
        else this.coyoteTimer -= dt;

        const wasGrounded = this.isGrounded;
        this.isGrounded = false;

        if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
            this.vy = this.jumpForce;
            this.jumpBufferTimer = 0;
            this.coyoteTimer = 0;
            particles.emit(this.x + this.w/2, this.y + this.h, 6, 'rgba(220,220,220,0.6)', 30, 70);
        }
        if (!input.keys.jump && this.vy < 0) this.vy += this.gravity * 0.5 * dt;

        Physics.moveAndCollide(this, dt, map);

        if (!wasGrounded && this.isGrounded) {
            particles.emit(this.x + this.w/2, this.y + this.h, 6, 'rgba(180,180,180,0.7)', 20, 50);
        }

        // ----- Shoot -----
        this.fireCooldown -= dt;
        if (input.keys.shoot && this.fireCooldown <= 0 && this.ammo > 0) {
            this._shoot(particles, audioSys);
        }

        // ----- Update Bullets -----
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.life -= dt;

            // Bullet–tile collision
            const col = Math.floor(b.x / map.tileSize);
            const row = Math.floor(b.y / map.tileSize);
            const tile = map.getTile(col, row);
            if (tile === T.SOLID || b.life <= 0) {
                particles.emit(b.x, b.y, 4, '#ff9900', 20, 50);
                this.bullets.splice(i, 1);
                continue;
            }

            // Bullet–enemy collision
            for (let e of enemies) {
                if (e.state === 'dead') continue;
                if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
                    e.takeDamage(25, particles);
                    particles.emit(b.x, b.y, 6, '#ff2200', 30, 70);
                    this.bullets.splice(i, 1);
                    break;
                }
            }
        }

        // ----- Invincibility -----
        if (this.invincibleTimer > 0) this.invincibleTimer -= dt;

        // ----- Pickups & Door -----
        map.collectPickup(this, particles, audioSys);
    }

    _shoot(particles, audioSys) {
        this.ammo--;
        this.fireCooldown = this.fireRate;
        audioSys.playShoot();
        const dir = this.facingRight ? 1 : -1;
        const bx  = this.facingRight ? this.x + this.w + 2 : this.x - 8;
        this.bullets.push({
            x: bx, y: this.y + this.h / 2,
            vx: dir * 700, vy: 0,
            life: 1.2
        });
        // Muzzle flash
        particles.emit(bx, this.y + this.h / 2, 3, '#ffee00', 30, 60);
        this.updateHUD();
    }

    takeDamage(amount, particles, audioSys) {
        if (this.invincibleTimer > 0) return;
        this.health = Math.max(0, this.health - amount);
        this.invincibleTimer = 0.6;
        audioSys.playHit();
        // Screen flash
        const flash = document.getElementById('damage-flash');
        flash.classList.add('active');
        setTimeout(() => flash.classList.remove('active'), 100);
        particles.emit(this.x + this.w/2, this.y + this.h/2, 8, '#ff0000', 30, 60);
        this.updateHUD();
    }

    updateHUD() {
        const pct = Math.max(0, (this.health / this.maxHealth) * 100);
        document.getElementById('health-bar').style.width = pct + '%';
        document.getElementById('ammo-count').innerText = `${this.ammo} / ${this.maxAmmo}`;
    }

    draw(ctx, camera) {
        ctx.save();
        ctx.translate(this.x - camera.x, this.y - camera.y);

        const blink = this.invincibleTimer > 0 && Math.floor(performance.now() / 80) % 2 === 0;
        if (blink) { ctx.restore(); return; }

        // Body
        ctx.fillStyle = '#888';
        ctx.fillRect(0, 8, this.w, this.h - 8);

        // Head
        ctx.fillStyle = '#aaa';
        ctx.fillRect(3, 0, this.w - 6, 12);

        // Eyes
        ctx.fillStyle = '#fff';
        if (this.facingRight) {
            ctx.fillRect(this.w - 8, 2, 4, 4);
            ctx.fillStyle = '#000';
            ctx.fillRect(this.w - 7, 3, 2, 2);
        } else {
            ctx.fillRect(4, 2, 4, 4);
            ctx.fillStyle = '#000';
            ctx.fillRect(5, 3, 2, 2);
        }

        // Jacket
        ctx.fillStyle = '#4a3a28';
        ctx.fillRect(0, 12, this.w, 14);

        // Legs (walking animation)
        ctx.fillStyle = '#2a2a2a';
        const legBob = this.isGrounded && Math.abs(this.vx) > 10 ? Math.sin(this.bobPhase) * 5 : 0;
        ctx.fillRect(2, 26, 8, 8 - legBob);
        ctx.fillRect(this.w - 10, 26, 8, 8 + legBob);

        // Gun
        const gx = this.facingRight ? this.w : -18;
        ctx.fillStyle = '#555';
        ctx.fillRect(gx, this.h/2 - 2, 18, 5);
        ctx.fillStyle = '#333';
        ctx.fillRect(this.facingRight ? gx + 14 : gx, this.h/2 - 1, 6, 3);

        ctx.restore();

        // Bullets
        ctx.fillStyle = '#ffee00';
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 6;
        for (const b of this.bullets) {
            ctx.beginPath();
            ctx.arc(b.x - camera.x, b.y - camera.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
    }
}
