class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 28;
        this.h = 36;
        this.vx = 0;
        this.vy = 0;

        this.speed = 80;
        this.health = 40;
        this.maxHealth = 40;
        this.damage = 12;
        this.attackCooldown = 0;
        this.attackRate = 1.2;

        this.gravity = 1500;
        this.maxFall = 600;
        this.isGrounded = false;

        this.patrolDir = 1;
        this.patrolTimer = 0;
        this.patrolInterval = 2 + Math.random() * 2;
        this.state = 'patrol'; // 'patrol' | 'chase' | 'dead'
        this.detectionRange = 280;

        this.hitFlash = 0;
        this.spawnX = x;
    }

    update(dt, player, map, particles, audioSys) {
        if (this.state === 'dead') return;

        // Gravity
        this.vy += 1500 * dt;
        if (this.vy > this.maxFall) this.vy = this.maxFall;
        this.isGrounded = false;

        const dist = Math.abs(player.x - this.x);
        const inLight = dist < 350; // Only active when player can "see" them

        // AI
        if (inLight && dist < this.detectionRange) {
            this.state = 'chase';
        } else if (dist > this.detectionRange + 80) {
            this.state = 'patrol';
        }

        if (this.state === 'chase') {
            this.vx = (player.x < this.x ? -1 : 1) * this.speed;
        } else {
            // Patrol
            this.patrolTimer -= dt;
            if (this.patrolTimer <= 0) {
                this.patrolDir *= -1;
                this.patrolTimer = this.patrolInterval;
            }
            this.vx = this.patrolDir * this.speed * 0.5;
        }

        // Move & collide
        Physics.moveAndCollide(this, dt, map);

        // Attack player on touch
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        const dx = (player.x + player.w/2) - (this.x + this.w/2);
        const dy = (player.y + player.h/2) - (this.y + this.h/2);
        if (Math.sqrt(dx*dx + dy*dy) < (this.w/2 + player.w/2) + 5 && this.attackCooldown <= 0) {
            player.takeDamage(this.damage, particles, audioSys);
            this.attackCooldown = this.attackRate;
        }

        if (this.hitFlash > 0) this.hitFlash -= dt * 5;
    }

    takeDamage(amount, particles) {
        this.health -= amount;
        this.hitFlash = 1;
        particles.emit(this.x + this.w/2, this.y + this.h/2, 6, '#ff3300', 40, 80);
        if (this.health <= 0) this.state = 'dead';
    }

    draw(ctx, camera, player) {
        if (this.state === 'dead') return;

        // Check visibility (only draw if near the player)
        const screenDist = Math.abs((this.x + this.w/2) - (player.x + player.w/2));
        if (screenDist > 420) return;

        ctx.save();
        ctx.translate(this.x - camera.x, this.y - camera.y);

        // Body — ghostly apparition
        const alpha = Math.min(1, (420 - screenDist) / 200);
        ctx.globalAlpha = alpha * (this.state === 'chase' ? 0.85 : 0.5);

        ctx.fillStyle = this.hitFlash > 0 ? '#ff5500' : '#4a0a0a';
        ctx.fillRect(0, 0, this.w, this.h);

        // Wispy top
        ctx.fillStyle = this.hitFlash > 0 ? '#ff8800' : '#6a0f0f';
        ctx.beginPath();
        const wave = Math.sin(performance.now() / 200 + this.x) * 3;
        ctx.ellipse(this.w/2, -6 + wave, this.w/2 - 2, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#ff0000';
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(this.w/2 - 6, this.h/3, 3, 0, Math.PI * 2);
        ctx.arc(this.w/2 + 6, this.h/3, 3, 0, Math.PI * 2);
        ctx.fill();

        // Claws
        ctx.strokeStyle = '#880000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, this.h - 5); ctx.lineTo(-6, this.h + 4);
        ctx.moveTo(this.w, this.h - 5); ctx.lineTo(this.w + 6, this.h + 4);
        ctx.stroke();

        ctx.globalAlpha = 1;

        // Health bar (shows when damaged)
        if (this.health < this.maxHealth) {
            ctx.fillStyle = '#400000';
            ctx.fillRect(0, -10, this.w, 4);
            ctx.fillStyle = '#cc0000';
            ctx.fillRect(0, -10, this.w * (this.health / this.maxHealth), 4);
        }

        ctx.restore();
    }
}
