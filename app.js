import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, onDisconnect, remove, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCIBxNvfpaSV3sBS-VKtDob4zYhZJ7djIk",
    authDomain: "hidamari-pj-8b4bb.firebaseapp.com",
    databaseURL: "https://hidamari-pj-8b4bb-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "hidamari-pj-8b4bb",
    storageBucket: "hidamari-pj-8b4bb.firebasestorage.app",
    messagingSenderId: "293093126367",
    appId: "1:293093126367:web:151cce22308352fa5ff96a",
    measurementId: "G-7NNBEZBNXZ"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
window.db = db;

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') || 'default';

const stateRef = ref(db, `rooms/${roomId}/state`);
const configRef = ref(db, `rooms/${roomId}/config`);
const refereeListRef = ref(db, `rooms/${roomId}/referees`);
const onlineRef = ref(db, `rooms/${roomId}/online`);
const discoveryRef = ref(db, `rooms/${roomId}/referee_discovery`);

function switchView(targetId) {
    const views = ['master-maintenance-overlay', 'auth-overlay', 'game-content'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const target = document.getElementById(bypassTargetId(targetId));
    if (target) target.style.display = (targetId === 'game-content') ? 'block' : 'flex';
}

function bypassTargetId(id) {
    if (id === 'master-maintenance-overlay' && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')) {
        return 'auth-overlay';
    }
    return id;
}

const isLocal = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
const currentSysPath = isLocal ? "system_local" : "system";

onValue(ref(db, `${currentSysPath}/masterMaintenance`), (snap) => {
    if (snap.val()) switchView('master-maintenance-overlay');
    else checkCurrentStatus();
});

function checkCurrentStatus() {
    get(configRef).then((snapshot) => {
        const config = snapshot.val();
        const isRef = window.location.pathname.includes('referee.html');
        
        if (!config) {
            switchView('auth-overlay');
            document.getElementById('setup-fields').style.display = isRef ? 'block' : 'none';
            document.getElementById('login-fields').style.display = isRef ? 'none' : 'block';
            if (!isRef) {
                const msgEl = document.getElementById('login-msg');
                if (msgEl) msgEl.innerText = "審判が部屋を作成するまでお待ちください。";
            }
        } else {
            if (config.pass !== "" && sessionStorage.getItem('isAuthorized') === roomId) {
                if (isRef) enterAsReferee();
                else switchView('game-content');
            } else {
                switchView('auth-overlay');
                document.getElementById('setup-fields').style.display = 'none';
                document.getElementById('login-fields').style.display = 'block';
            }
        }
    });
}

window.setupRoom = () => {
    let pass = document.getElementById('set-pass').value;
    if (pass.length > 4) pass = pass.slice(0, 4);
    const capacity = parseInt(document.getElementById('set-capacity').value) || 99;
    
    set(configRef, { pass: pass, capacity: capacity }).then(() => {
        sessionStorage.setItem('isAuthorized', roomId);
        set(discoveryRef, { d1: false, d2: false, d3: false });
        if (window.location.pathname.includes('referee.html')) enterAsReferee();
        else switchView('game-content');
    });
};

window.checkPass = () => {
    let input = document.getElementById('input-pass').value;
    if (input.length > 4) input = input.slice(0, 4);
    
    get(configRef).then((snap) => {
        const config = snap.val();
        if (!config) return;
        
        if (config.pass === input) {
            get(refereeListRef).then((refSnap) => {
                const refs = refSnap.val() || {};
                const currentCount = Object.keys(refs).length;
                const capacity = config.capacity || 99;
                
                if (window.location.pathname.includes('referee.html')) {
                    if (currentCount >= capacity) {
                        alert(`定員オーバーです。この部屋の審判枠は最大 ${capacity} 名です。`);
                        return;
                    }
                    sessionStorage.setItem('isAuthorized', roomId);
                    enterAsReferee();
                } else {
                    sessionStorage.setItem('isAuthorized', roomId);
                    switchView('game-content');
                }
            });
        } else {
            alert("パスコードが違います");
        }
    });
};

function enterAsReferee() {
    let myId = sessionStorage.getItem('myRefereeId');
    if (!myId) {
        myId = Math.random().toString(36).substring(2, 10);
        sessionStorage.setItem('myRefereeId', myId);
    }
    const myRef = ref(db, `rooms/${roomId}/referees/${myId}`);
    
    set(myRef, true);
    set(onlineRef, true);
    onDisconnect(myRef).remove();

    onValue(refereeListRef, (snap) => {
        const refs = snap.val() || {};
        const keys = Object.keys(refs);
        if (keys.length === 0) {
            remove(onlineRef); remove(configRef); remove(discoveryRef);
        } else if (keys.length === 1 && keys[0] === myId) {
            onDisconnect(onlineRef).remove(); onDisconnect(configRef).remove(); onDisconnect(discoveryRef).remove();
        } else {
            onDisconnect(onlineRef).cancel(); onDisconnect(configRef).cancel(); onDisconnect(discoveryRef).cancel();
        }
    });
    switchView('game-content');
}

// =================================================================
// 🧠 ゲームコア同期ロジック（リセット完全連動プロトコル）
// =================================================================

const defaultData = { 
    isRunning: false, 
    activeCount: 3, 
    selectedDuration: 10, 
    targetTimestamp: 0, 
    pausedLeftSeconds: 600, 
    baseDropPerSec: 0.1666, 
    dummies: { 
        d1: { name: "Dummy 1", lifeAtSync: 100 }, 
        d2: { name: "Dummy 2", lifeAtSync: 100 }, 
        d3: { name: "Dummy 3", lifeAtSync: 100 } 
    } 
};
let state = JSON.parse(JSON.stringify(defaultData));

const isReferee = window.location.pathname.includes('referee.html');
const isSpectator = window.location.pathname.includes('spectator.html');
const isPlayer = window.location.pathname.includes('player.html');

// 🔄 Firebase から最新の国家ステータスを受信
onValue(stateRef, (snapshot) => { 
    const data = snapshot.val(); 
    if (data) { 
        // 古いデータ構造（life）が残っている場合のセーフティ互換ケア
        if (data.dummies) {
            for(let i = 1; i <= 3; i++) {
                if (data.dummies[`d${i}`] && data.dummies[`d${i}`].life !== undefined) {
                    data.dummies[`d${i}`].lifeAtSync = data.dummies[`d${i}`].life;
                    delete data.dummies[`d${i}`].life;
                }
            }
        }
        state = data; 
        
        // 【重要】設定台数（BODIES）の枠外の要素を即座に非表示にする
        if (!isReferee) {
            for (let i = 1; i <= 3; i++) {
                const card = document.getElementById(`unit-${i}`) || document.querySelector(`.dummy-card:nth-child(${i})`);
                if (card) {
                    card.style.display = (i > state.activeCount) ? "none" : "block";
                }
            }
        }
        
        updateUI(); 
    } else { 
        // 🎯 審判がリセットした際、またはデータが完全に空の時
        state = JSON.parse(JSON.stringify(defaultData));
        if (isReferee) {
            saveState(); 
        } else {
            // 選手・観客画面：データが空＝リセットされたと判断し、ローカルの表示も完全初期化
            clearTelemetryUI();
            updateUI();
        }
    } 
});

function saveState() { set(stateRef, state); }

// 観客画面などのテキスト情報を完全初期化するサブプロトコル
function clearTelemetryUI() {
    for (let i = 1; i <= 3; i++) {
        const cEl = document.getElementById(`d${i}-spec-color`);
        const fEl = document.getElementById(`d${i}-spec-freq`);
        const sEl = document.getElementById(`d${i}-spec-status`);
        if (cEl) cEl.innerText = "---";
        if (fEl) fEl.innerText = "--- Hz";
        if (sEl) {
            sEl.innerText = "ONLINE";
            sEl.className = "spec-readout-val";
        }
    }
}

// 🎯 【超高精度ローカル・レンダリングループ】
setInterval(() => { 
    const now = Date.now();
    let currentLeftSeconds = 0;
    let elapsedSecondsSinceSync = 0; 

    if (state.isRunning) {
        const diffMs = state.targetTimestamp - now;
        currentLeftSeconds = Math.max(0, Math.floor(diffMs / 1000));
        elapsedSecondsSinceSync = state.pausedLeftSeconds - (diffMs / 1000);
        if (elapsedSecondsSinceSync < 0) elapsedSecondsSinceSync = 0;
    } else {
        currentLeftSeconds = state.pausedLeftSeconds;
        elapsedSecondsSinceSync = 0; 
    }

    // 🕒 タイマーの文字盤描画
    const countdownDisplay = document.getElementById('countdown-display');
    if (countdownDisplay) { 
        const min = Math.floor(currentLeftSeconds / 60); 
        const sec = currentLeftSeconds % 60; 
        countdownDisplay.innerText = `${min}:${sec.toString().padStart(2, '0')}`;
    }

    // 📊 ライフゲージ＆数値テキストの変調同期
    if (state.dummies) {
        for (let i = 1; i <= 3; i++) {
            const d = state.dummies[`d${i}`]; 
            if (!d) continue;

            const fill = document.getElementById(`d${i}-fill`); 
            const valText = document.getElementById(`d${i}-val`);
            
            let currentLife = d.lifeAtSync - (state.baseDropPerSec * elapsedSecondsSinceSync);
            if (currentLife < 0) currentLife = 0;

            const rate = isSpectator ? 0.94 : 1.0;

            if (fill) { 
                fill.style.width = (currentLife * rate) + "%"; 
                if (currentLife <= 20) {
                    fill.style.backgroundColor = "var(--hp-red, #ff0000)";
                } else if (currentLife <= 50) {
                    fill.style.backgroundColor = "var(--hp-yellow, #ffff00)";
                } else {
                    fill.style.backgroundColor = "var(--hp-green, #7cfc00)";
                }
            }
            if (valText) { 
                valText.innerText = `${Math.floor(currentLife * 2.5)} / 250`;
            }
        }
    }

    updateUI(currentLeftSeconds);
}, 100); 

function updateUI(currentLeftSeconds = 600) {
    if (isReferee) {
        document.querySelectorAll('.btn-opt').forEach(b => b.classList.remove('active'));
        const activeDur = document.getElementById(`dur-${state.selectedDuration}`); if (activeDur) activeDur.classList.add('active');
        const activeCnt = document.getElementById(`cnt-${state.activeCount}`); if (activeCnt) activeCnt.classList.add('active');
        
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.innerText = state.isRunning ? "PAUSE" : "START";
            startBtn.style.background = state.isRunning ? 
                "linear-gradient(135deg, rgba(255, 75, 43, 0.2) 0%, rgba(255, 65, 108, 0.3) 100%)" : 
                "linear-gradient(135deg, rgba(0, 255, 255, 0.2) 0%, rgba(0, 150, 255, 0.3) 100%)";
            startBtn.style.borderColor = state.isRunning ? "#ff416c" : "#00ffff";
        }
    }
}

// =================================================================
// 🎛️ 審判コントロール窓口関数
// =================================================================

window.toggleTimer = () => { 
    if (!isReferee) return;
    const now = Date.now();

    if (!state.isRunning) {
        state.isRunning = true;
        state.targetTimestamp = now + (state.pausedLeftSeconds * 1000);
    } else {
        const diffMs = state.targetTimestamp - now;
        const elapsed = state.pausedLeftSeconds - (diffMs / 1000);

        for (let i = 1; i <= 3; i++) {
            if(state.dummies[`d${i}`]) {
                state.dummies[`d${i}`].lifeAtSync -= (state.baseDropPerSec * elapsed);
                if (state.dummies[`d${i}`].lifeAtSync < 0) state.dummies[`d${i}`].lifeAtSync = 0;
            }
        }

        state.isRunning = false;
        state.pausedLeftSeconds = Math.max(0, Math.floor(diffMs / 1000));
    }
    saveState(); 
};

window.setCount = (val) => { if (!isReferee) return; state.activeCount = parseInt(val); saveState(); };

window.setDuration = (min) => { 
    if (!isReferee) return;
    state.selectedDuration = min; 
    state.pausedLeftSeconds = min * 60; 
    if (state.isRunning) {
        state.targetTimestamp = Date.now() + (state.pausedLeftSeconds * 1000);
    }
    state.baseDropPerSec = 100 / (min * 60); 
    for (let i = 1; i <= 3; i++) {
        if(state.dummies[`d${i}`]) state.dummies[`d${i}`].lifeAtSync = 100;
    }
    saveState(); 
};

window.applyDmg = (id, amt) => { 
    if (!isReferee) return;
    if (state.isRunning) {
        const diffMs = state.targetTimestamp - Date.now();
        const elapsed = state.pausedLeftSeconds - (diffMs / 1000);
        
        for (let i = 1; i <= 3; i++) {
            if (state.dummies[`d${i}`]) {
                const currentLife = state.dummies[`d${i}`].lifeAtSync - (state.baseDropPerSec * elapsed);
                if (`d${i}` === id) {
                    state.dummies[id].lifeAtSync = Math.max(0, currentLife - amt);
                } else {
                    state.dummies[`d${i}`].lifeAtSync = Math.max(0, currentLife);
                }
            }
        }
        state.pausedLeftSeconds = Math.max(0, diffMs / 1000);
        state.targetTimestamp = Date.now() + (state.pausedLeftSeconds * 1000);
    } else {
        if(state.dummies[id]) {
            state.dummies[id].lifeAtSync = Math.max(0, state.dummies[id].lifeAtSync - amt);
        }
    }
    saveState(); 
};

// 🎯 【改善】リセット時に周辺データ（発見フラグ・選手ステータス）も一括消去する完全クレンジング
window.resetSystem = async () => { 
    if (!isReferee) return;
    if(confirm("ルームデータをリセットしますか？")) {
        try {
            // 1. メインステータスをデフォルトにリセット
            await set(stateRef, defaultData);
            // 2. 審判の発見フラグ（active-neon用）をデータベースから完全消去
            await remove(discoveryRef);
            // 3. 選手画面から送られている副次テレメトリー（周波数・顔色など）のノードも完全消去
            const playerStatusRef = ref(db, `rooms/${roomId}/player_status`);
            await remove(playerStatusRef);
        } catch (e) {
            console.error("Reset Error: ", e);
        }
    }
};

// =================================================================
// 📡 【周辺信号プロトコル】選手画面・観客画面用の発見（Neon）同期
// =================================================================
onValue(discoveryRef, (snap) => {
    const data = snap.val() || {};
    for (let i = 1; i <= 3; i++) {
        const unit = document.getElementById(`unit-${i}`);
        if (!unit) continue;
        
        if (state && i > state.activeCount) { 
            unit.style.display = "none"; 
            continue; 
        }
        
        unit.style.display = "block";
        if (!!data[`d${i}`]) {
            unit.classList.add('active-neon');
        } else {
            unit.classList.remove('active-neon');
        }
    }
});