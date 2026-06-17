// ============ AUDIO ============
const Audio = {
    ctx: null,
    bgm: null,
    sfx: {},
    musicVol: 1.0,
    sfxVol: 1.0,
    _g(v){const g=this.ctx.createGain();g.gain.value=v*this.sfxVol;g.connect(this.ctx.destination);return g},
    init(){
        if(!this.ctx){
            this.ctx=new (window.AudioContext||window.webkitAudioContext)();
            this.bgm = new window.Audio('sounds/backsound.mp3');
            this.bgm.loop = true;
            this.bgm.volume = 0.5 * this.musicVol;
            this.walkAudio = new window.Audio('sounds/walk.mp3');
            this.walkAudio.loop = true;
            this.walkAudio.volume = 0.4 * this.sfxVol;
            this.menuBgm = new window.Audio('sounds/backsound_mainMenu.mp3');
            this.menuBgm.loop = true;
            this.menuBgm.volume = 1.0 * this.musicVol;
            this.heartbeatAudio = new window.Audio('sounds/darah_sekarat.mp3');
            this.heartbeatAudio.loop = true;
            this.heartbeatAudio.volume = 0.6 * this.sfxVol;
            this.rainAudio = new window.Audio('sounds/rain.mp3');
            this.rainAudio.loop = true;
            this.rainAudio.volume = 0.4 * this.sfxVol;
            this.loadSfx('gun_pistol_and_machineGun.mp3', 'shoot_mg');
            this.loadSfx('sniper.mp3', 'shoot_sniper');
            this.loadSfx('reload_gun.mp3', 'reload');
            this.loadSfx('granat.mp3', 'grenade');
            this.loadSfx('entitas_enemy.mp3', 'enemy_ambient');
            this.loadSfx('entitas_kuyang.mp3', 'kuyang_ambient');
            this.loadSfx('smoke.mp3', 'smoke');
            this.loadSfx('open_inventory.mp3', 'inventory');
            this.loadSfx('walk.mp3', 'walk');
            this.loadSfx('klik_button_button_dimenu.mp3', 'click');
            this.loadSfx('dead.mp3', 'dead');
            this.loadSfx('get_item.mp3', 'get_item');
            this.loadSfx('sound_use.mp3', 'use_item');
            this.loadSfx('damage.mp3', 'damage');
            this.loadSfx('entitas_enemy_mati.mp3', 'enemy_die');
            this.loadSfx('kuyang_mati.mp3', 'kuyang_die');
            this.loadSfx('stalker_mati.mp3', 'stalker_die');
            this.loadSfx('onOffSenter.mp3', 'flashlight');
        }
    },
    setMusicVolume(v){
        this.musicVol = v;
        if(this.bgm) this.bgm.volume = 0.5 * v;
        if(this.menuBgm) this.menuBgm.volume = 1.0 * v;
    },
    setSfxVolume(v){
        this.sfxVol = v;
        if(this.walkAudio) this.walkAudio.volume = 0.4 * v;
        if(this.heartbeatAudio) this.heartbeatAudio.volume = 0.6 * v;
        if(this.rainAudio) this.rainAudio.volume = 0.4 * v;
    },
    playBGM(){
        if(this.menuBgm && !this.menuBgm.paused) this.menuBgm.pause();
        if(this.bgm && this.bgm.paused) this.bgm.play().catch(e=>{});
    },
    playMenuBGM(){
        if(this.bgm && !this.bgm.paused) this.bgm.pause();
        if(this.menuBgm && this.menuBgm.paused) this.menuBgm.play().catch(e=>{});
    },
    async loadSfx(filename, name){
        try {
            const resp = await fetch('sounds/' + filename);
            const buf = await resp.arrayBuffer();
            this.sfx[name] = await this.ctx.decodeAudioData(buf);
        } catch(e) { console.error('Audio load error:', e); }
    },
    playSfx(name, vol = 1){
        if(!this.ctx || !this.sfx[name]) return;
        const src = this.ctx.createBufferSource();
        src.buffer = this.sfx[name];
        const g = this._g(vol);
        src.connect(g);
        src.onended = () => { g.disconnect(); };
        src.start(0);
    },
    shoot(weaponType){
        if(!this.ctx)return;
        if(weaponType === 'sniper') {
            this.playSfx('shoot_sniper', 0.8);
        } else if(weaponType === 'mg' || weaponType === 'pistol') {
            this.playSfx('shoot_mg', 0.5);
        } else {
            const o=this.ctx.createOscillator(),g=this._g(.25);o.connect(g);o.type='square';const t=this.ctx.currentTime;o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(40,t+.1);g.gain.exponentialRampToValueAtTime(.001,t+.1);
            o.onended = () => { g.disconnect(); };
            o.start();o.stop(t+.1);
        }
    },
    reload(){
        this.playSfx('reload', 0.6);
    },
    explode(type){
        if(type === 'grenade' || type === 'landmine') this.playSfx('grenade', 1.0);
        else if(type === 'smoke') this.playSfx('smoke', 0.8);
    },
    ambient(type){
        if(type === 'enemy') this.playSfx('enemy_ambient', 0.8);
        else if(type === 'kuyang') this.playSfx('kuyang_ambient', 1.0);
    },
    ui(type){
        if(type === 'inventory') this.playSfx('inventory', 1.6);
        else if(type === 'click') this.playSfx('click', 1.25);
    },
    walk(isWalking){
        if(!this.walkAudio) return;
        if(isWalking) {
            if(this.walkAudio.paused) this.walkAudio.play().catch(()=>{});
        } else {
            if(!this.walkAudio.paused) this.walkAudio.pause();
        }
    },
    heartbeat(isLow){
        if(!this.heartbeatAudio) return;
        if(isLow) {
            if(this.heartbeatAudio.paused) this.heartbeatAudio.play().catch(()=>{});
        } else {
            if(!this.heartbeatAudio.paused) this.heartbeatAudio.pause();
        }
    },
    stopAll() {
        if(this.bgm) this.bgm.pause();
        if(this.menuBgm) this.menuBgm.pause();
        if(this.walkAudio) this.walkAudio.pause();
        if(this.heartbeatAudio) this.heartbeatAudio.pause();
        if(this.rainAudio) this.rainAudio.pause();
        if(this.ctx && this.ctx.state === 'running') {
            this.ctx.suspend().catch(()=>{});
        }
    },
    resumeAll() {
        if(this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(()=>{});
        }
    },
    rain(isRaining){
        if(!this.rainAudio) return;
        if(isRaining) {
            if(this.rainAudio.paused) this.rainAudio.play().catch(()=>{});
        } else {
            if(!this.rainAudio.paused) this.rainAudio.pause();
        }
    },
    item(action){
        if(action === 'get') this.playSfx('get_item', 1.0);
        else if(action === 'use') this.playSfx('use_item', 1.0);
    },
    damage(){
        this.playSfx('damage', 1.0);
    },
    enemyDie(type){
        const now = performance.now();
        if(this.lastEnemyDieTime && now - this.lastEnemyDieTime < 100) return;
        this.lastEnemyDieTime = now;
        if(typeof Auth !== 'undefined') Auth.addKill();
        
        if(type === 'kuyang') this.playSfx('kuyang_die', 1.0);
        else if(type === 'stalker') this.playSfx('stalker_die', 1.0);
        else this.playSfx('enemy_die', 1.0);
    },
    flashlight(){
        this.playSfx('flashlight', 1.0);
    },
    dead(){
        this.playSfx('dead', 1.0);
    },
    stopBGM() {
        if(this.bgm && !this.bgm.paused) this.bgm.pause();
        if(this.menuBgm && !this.menuBgm.paused) this.menuBgm.pause();
        if(this.rainAudio && !this.rainAudio.paused) this.rainAudio.pause();
        if(this.walkAudio && !this.walkAudio.paused) this.walkAudio.pause();
        if(this.heartbeatAudio && !this.heartbeatAudio.paused) this.heartbeatAudio.pause();
    },
    hit(){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this._g(.15);o.connect(g);o.type='sawtooth';const t=this.ctx.currentTime;o.frequency.setValueAtTime(110,t);o.frequency.linearRampToValueAtTime(35,t+.22);g.gain.linearRampToValueAtTime(.001,t+.22);o.start();o.stop(t+.22)},
    door(){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this._g(.12);o.connect(g);o.type='sine';const t=this.ctx.currentTime;o.frequency.setValueAtTime(90,t);o.frequency.linearRampToValueAtTime(55,t+.45);g.gain.linearRampToValueAtTime(.001,t+.45);o.start();o.stop(t+.45)},
    pick(){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this._g(.08);o.connect(g);o.type='sine';const t=this.ctx.currentTime;o.frequency.setValueAtTime(320,t);o.frequency.setValueAtTime(520,t+.08);g.gain.linearRampToValueAtTime(.001,t+.25);o.start();o.stop(t+.25)},
    save(){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this._g(.1);o.connect(g);o.type='triangle';const t=this.ctx.currentTime;o.frequency.setValueAtTime(400,t);o.frequency.linearRampToValueAtTime(600,t+.3);g.gain.linearRampToValueAtTime(.001,t+.3);o.start();o.stop(t+.3)},
};

