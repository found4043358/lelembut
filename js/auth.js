const Auth = {
    user: null,
    stats: { wins: 0, kills: 0 },
    
    async init() {
        // Get initial session
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (session) {
            this.user = session.user;
            await this.loadStats();
        }
        
        // Listen for auth changes
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (session) {
                this.user = session.user;
                await this.loadStats();
            } else {
                this.user = null;
                this.stats = { wins: 0, kills: 0 };
            }
            this.updateUI();
        });
        
        this.updateUI();
    },
    
    async login(email, password) {
        if(!email || !password) { showToast("Email & Password required!"); return false; }
        showLoading("Logging in...");
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        hideLoading();
        if (error) {
            showToast("Login failed: " + error.message);
            return false;
        }
        showToast("Login successful!");
        return true;
    },
    
    async register(email, password) {
        if(!email || !password) { showToast("Email & Password required!"); return false; }
        showLoading("Registering...");
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        hideLoading();
        if (error) {
            showToast("Registration failed: " + error.message);
            return false;
        }
        showToast("Registration successful! You can now log in.");
        return true;
    },
    
    async logout() {
        showLoading("Logging out...");
        const { error } = await supabaseClient.auth.signOut();
        hideLoading();
        if (error) showToast("Logout failed: " + error.message);
        else showToast("Logged out!");
    },
    
    async loadStats() {
        if (!this.user) return;
        const { data, error } = await supabaseClient.from('user_stats').select('wins, kills').eq('user_id', this.user.id).single();
        if (data) {
            this.stats.wins = data.wins || 0;
            this.stats.kills = data.kills || 0;
        }
    },
    
    async addKill() {
        if (!this.user) return;
        this.stats.kills++;
        await supabaseClient.from('user_stats').upsert({ user_id: this.user.id, kills: this.stats.kills, wins: this.stats.wins });
        this.updateUI();
    },
    
    async addWin() {
        if (!this.user) return;
        this.stats.wins++;
        await supabaseClient.from('user_stats').upsert({ user_id: this.user.id, kills: this.stats.kills, wins: this.stats.wins });
        this.updateUI();
    },
    
    async syncConfigToCloud() {
        if (!this.user) { showToast("You must log in to sync settings."); return; }
        showLoading("Syncing to cloud...");
        const configData = {};
        for(let i=0; i<localStorage.length; i++) {
            const key = localStorage.key(i);
            // Sync all settings, excluding supabase auth tokens
            if ((key.startsWith('lelembut_') || key.startsWith('mobile_') || key.startsWith('dev_')) && !key.includes('supabase')) {
                configData[key] = localStorage.getItem(key);
            }
        }
        const { error } = await supabaseClient.from('user_configs').upsert({
            user_id: this.user.id,
            config_data: configData
        });
        hideLoading();
        if (error) showToast("Sync failed: " + error.message);
        else showToast("Settings synced to cloud!");
    },
    
    async syncConfigFromCloud() {
        if (!this.user) { showToast("You must log in to sync settings."); return; }
        showLoading("Fetching from cloud...");
        const { data, error } = await supabaseClient.from('user_configs').select('config_data').eq('user_id', this.user.id).single();
        hideLoading();
        if (error) {
            showToast("Failed to fetch settings.");
            return;
        }
        if (data && data.config_data) {
            const keys = Object.keys(data.config_data);
            keys.forEach(k => {
                localStorage.setItem(k, data.config_data[k]);
            });
            showToast("Settings downloaded & applied! Reloading...");
            setTimeout(() => location.reload(), 1500);
        } else {
            showToast("No settings found in cloud.");
        }
    },
    
    updateUI() {
        const accTab = document.getElementById('account-tab-content');
        if (!accTab) return;
        
        if (this.user) {
            accTab.innerHTML = `
                <div style="text-align:center; padding: 20px;">
                    <i class="fa-solid fa-circle-user" style="font-size: 64px; color:#aaa; margin-bottom:15px;"></i>
                    <h3 style="margin: 0; color:#fff; font-family: 'Courier New', monospace; font-size: 20px;">${this.user.email}</h3>
                    <p style="color:#666; font-size:12px; margin-top:5px; font-family: 'Courier New', monospace;">ID: ${this.user.id.substring(0,8)}</p>
                    
                    <div style="display:flex; justify-content:center; gap: 20px; margin: 30px 0;">
                        <div style="background:#1a1a1a; padding: 20px; border-radius: 8px; border:1px solid #333; min-width: 120px;">
                            <i class="fa-solid fa-trophy" style="color:#aaa; font-size: 32px; margin-bottom:15px;"></i>
                            <div style="font-size:28px; font-weight:bold; color:#fff; font-family:'Special Elite';">${this.stats.wins}</div>
                            <div style="font-size:14px; color:#777; margin-top:5px;">TOTAL WINS</div>
                        </div>
                        <div style="background:#1a1a1a; padding: 20px; border-radius: 8px; border:1px solid #333; min-width: 120px;">
                            <i class="fa-solid fa-skull" style="color:#aaa; font-size: 32px; margin-bottom:15px;"></i>
                            <div style="font-size:28px; font-weight:bold; color:#fff; font-family:'Special Elite';">${this.stats.kills}</div>
                            <div style="font-size:14px; color:#777; margin-top:5px;">TOTAL KILLS</div>
                        </div>
                    </div>
                    
                    <h4 style="color:#888; margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:10px; text-transform: uppercase; letter-spacing: 2px;">Cloud Synchronization</h4>
                    <div style="display:flex; gap:15px; justify-content:center; margin-bottom: 30px;">
                        <button onclick="Auth.syncConfigToCloud()" class="ed-btn" style="background:#222; color:#ccc; border:1px solid #444; padding: 10px 20px;"><i class="fa-solid fa-cloud-arrow-up"></i> Save to Cloud</button>
                        <button onclick="Auth.syncConfigFromCloud()" class="ed-btn" style="background:#222; color:#ccc; border:1px solid #444; padding: 10px 20px;"><i class="fa-solid fa-cloud-arrow-down"></i> Load from Cloud</button>
                    </div>
                    
                    <button onclick="Auth.logout()" class="ed-btn" style="background:#300; color:#fff; border:1px solid #600; padding: 10px 30px;"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
                </div>
            `;
        } else {
            accTab.innerHTML = `
                <div style="text-align:center; padding: 40px 20px; max-width: 350px; margin: 0 auto;">
                    <i class="fa-solid fa-user-lock" style="font-size: 64px; color:#555; margin-bottom:20px;"></i>
                    <h3 style="margin: 0 0 10px 0; color:#fff; font-size: 24px;">Account Required</h3>
                    <p style="color:#888; font-size:14px; margin-bottom: 30px; line-height: 1.5;">Log in to sync your graphics, layout, and controls to the cloud, and track your global stats.</p>
                    
                    <input type="email" id="auth-email" placeholder="Email Address" style="width:100%; box-sizing: border-box; padding:12px 15px; margin-bottom:15px; background:#111; color:#fff; border:1px solid #333; border-radius:4px; font-family:'Courier New', monospace; font-size: 16px; outline:none; transition:border 0.2s;" onfocus="this.style.borderColor='#666'" onblur="this.style.borderColor='#333'">
                    <input type="password" id="auth-pass" placeholder="Password" style="width:100%; box-sizing: border-box; padding:12px 15px; margin-bottom:30px; background:#111; color:#fff; border:1px solid #333; border-radius:4px; font-family:'Courier New', monospace; font-size: 16px; outline:none; transition:border 0.2s;" onfocus="this.style.borderColor='#666'" onblur="this.style.borderColor='#333'">
                    
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <button onclick="Auth.login(document.getElementById('auth-email').value, document.getElementById('auth-pass').value)" class="ed-btn" style="background:#222; color:#fff; border:1px solid #444; font-size:16px; padding:12px; border-radius: 4px;"><i class="fa-solid fa-right-to-bracket"></i> Login</button>
                        <button onclick="Auth.register(document.getElementById('auth-email').value, document.getElementById('auth-pass').value)" class="ed-btn" style="background:#111; color:#ccc; border:1px solid #333; font-size:16px; padding:12px; border-radius: 4px;"><i class="fa-solid fa-user-plus"></i> Create Account</button>
                    </div>
                </div>
            `;
        }
    }
};

window.addEventListener('load', () => {
    Auth.init();
});

function showLoading(msg) {
    const el = document.getElementById('loading-overlay');
    const txt = document.getElementById('loading-text');
    if (el) {
        if(txt) txt.innerText = msg || "LOADING...";
        el.classList.remove('hidden');
    }
}
function hideLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) el.classList.add('hidden');
}
