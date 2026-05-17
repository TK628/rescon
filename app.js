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

// --- ゲームコア同期ロジック ---
const defaultData = { isRunning: false, activeCount: 3, selectedDuration: 10, timerSeconds: 600, baseDropPerSec: 0.1666, dummies: { d1: { name: "Dummy 1", life: 100 }, d2: { name: "Dummy 2", life: 100 }, d3: { name: "Dummy 3", life: 100 } } };
let state = JSON.parse(JSON.stringify(defaultData));

// 複数の審判が同時に時間を削るのを防ぐロック変数
let lastUpdateTime = Date.now();

// 🔄 Firebaseからの受信イベント（白紙状態でも確実にUIを起動するセーフティ版）
onValue(stateRef, (snapshot) => { 
    const data = snapshot.val(); 
    if (data) { 
        state = data; 
        updateUI(); 
    } else { 
        // 🎯 データベースが空っぽ（白紙）であっても、確実に初期データを読み込んでupdateUIを走らせる
        state = JSON.parse(JSON.stringify(defaultData));
        updateUI();
        if (window.location.pathname.includes('referee.html')) saveState(); 
    } 
});

function saveState() { set(stateRef, state); }

// 🎯【タイマー競合の修正ガード】
setInterval(() => { 
    const now = Date.now();
    if (window.location.pathname.includes('referee.html') && state.isRunning) { 
        if (now - lastUpdateTime >= 950) {
            if (state.timerSeconds > 0) state.timerSeconds -= 1; 
            for (let i = 1; i <= state.activeCount; i++) { 
                if (state.dummies && state.dummies[`d${i}`] && state.dummies[`d${i}`].life > 0) {
                    state.dummies[`d${i}`].life -= state.baseDropPerSec; 
                }
            } 
            saveState(); 
            lastUpdateTime = now; 
        }
    } else {
        lastUpdateTime = now;
    }
}, 200);

function updateUI() {
    const countdownDisplay = document.getElementById('countdown-display');
    if (countdownDisplay && state.timerSeconds !== undefined) { 
        const min = Math.floor(state.timerSeconds / 60); const sec = state.timerSeconds % 60; 
        countdownDisplay.innerText = `${min}:${sec.toString().padStart(2, '0')}`;
    }
    if (window.location.pathname.includes('referee.html')) {
        document.querySelectorAll('.btn-opt').forEach(b => b.classList.remove('active'));
        const activeDur = document.getElementById(`dur-${state.selectedDuration}`); if (activeDur) activeDur.classList.add('active');
        const activeCnt = document.getElementById(`cnt-${state.activeCount}`); if (activeCnt) activeCnt.classList.add('active');
    }

    if (state.dummies) {
        for (let i = 1; i <= 3; i++) {
            const unit = document.getElementById(`unit-${i}`); 
            const d = state.dummies[`d${i}`]; 
            const fill = document.getElementById(`d${i}-fill`); 
            const valText = document.getElementById(`d${i}-val`);

            if (window.location.pathname.includes('referee.html') && unit) {
                unit.style.display = i <= state.activeCount ? "block" : "none";
            }

            if (d && d.life !== undefined) {
                const life = Math.max(0, d.life); 
                if (fill) { 
                    const rate = window.location.pathname.includes('spectator.html') ? 0.94 : 1.0;
                    fill.style.width = (life * rate) + "%"; 
                }
                if (valText) valText.innerText = `${Math.floor(life * 2.5)} / 250`;
            }
        }
    }
}

if (!window.location.pathname.includes('referee.html')) {
    onValue(discoveryRef, (snap) => {
        const data = snap.val() || {};
        for (let i = 1; i <= 3; i++) {
            const unit = document.getElementById(`unit-${i}`);
            if (!unit) continue;
            if (i > state.activeCount) { unit.style.display = "none"; continue; }
            unit.style.display = "block";
            const isDiscovered = !!data[`d${i}`];
            if (isDiscovered) { unit.classList.add('active-neon'); } 
            else { unit.classList.remove('active-neon'); }
        }
    });
}

window.toggleTimer = () => { state.isRunning = !state.isRunning; saveState(); };
window.setCount = (val) => { state.activeCount = parseInt(val); saveState(); };
window.setDuration = (min) => { state.selectedDuration = min; state.timerSeconds = min * 60; state.baseDropPerSec = 100 / (min * 60); saveState(); };
window.applyDmg = (id, amt) => { if(state.dummies && state.dummies[id]) { state.dummies[id].life -= amt; saveState(); } };

// 🎯【完全復元】あなたが最初に作った完璧なリセット関数
window.resetSystem = () => { 
    if(confirm("リセット？")) {
        set(stateRef, defaultData); 
    }
};