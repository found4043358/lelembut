// ============ AUDIO ============
const Audio = {
    ctx: null,
    _g(v){const g=this.ctx.createGain();g.gain.value=v;g.connect(this.ctx.destination);return g},
    init(){if(!this.ctx){this.ctx=new (window.AudioContext||window.webkitAudioContext)()}},
    shoot(){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this._g(.25);o.connect(g);o.type='square';const t=this.ctx.currentTime;o.frequency.setValueAtTime(180,t);o.frequency.exponentialRampToValueAtTime(40,t+.1);g.gain.exponentialRampToValueAtTime(.001,t+.1);o.start();o.stop(t+.1)},
    hit(){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this._g(.15);o.connect(g);o.type='sawtooth';const t=this.ctx.currentTime;o.frequency.setValueAtTime(110,t);o.frequency.linearRampToValueAtTime(35,t+.22);g.gain.linearRampToValueAtTime(.001,t+.22);o.start();o.stop(t+.22)},
    door(){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this._g(.12);o.connect(g);o.type='sine';const t=this.ctx.currentTime;o.frequency.setValueAtTime(90,t);o.frequency.linearRampToValueAtTime(55,t+.45);g.gain.linearRampToValueAtTime(.001,t+.45);o.start();o.stop(t+.45)},
    pick(){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this._g(.08);o.connect(g);o.type='sine';const t=this.ctx.currentTime;o.frequency.setValueAtTime(320,t);o.frequency.setValueAtTime(520,t+.08);g.gain.linearRampToValueAtTime(.001,t+.25);o.start();o.stop(t+.25)},
    save(){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this._g(.1);o.connect(g);o.type='triangle';const t=this.ctx.currentTime;o.frequency.setValueAtTime(400,t);o.frequency.linearRampToValueAtTime(600,t+.3);g.gain.linearRampToValueAtTime(.001,t+.3);o.start();o.stop(t+.3)},
};

