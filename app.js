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

onValue(stateRef, (snapshot) => { 
    const data = snapshot.val(); if (data) { state = data; updateUI(); } else { saveState(); } 
});

function saveState() { set(stateRef, state); }

setInterval(() => { 
    if (window.location.pathname.includes('referee.html') && state.isRunning) { 
        if (state.timerSeconds > 0) state.timerSeconds -= 1; 
        for (let i = 1; i <= state.activeCount; i++) { 
            if (state.dummies[`d${i}`].life > 0) state.dummies[`d${i}`].life -= state.baseDropPerSec; 
        } 
        saveState(); 
    } 
}, 1000);

function updateUI() {
    const countdownDisplay = document.getElementById('countdown-display');
    if (countdownDisplay) { 
        const min = Math.floor(state.timerSeconds / 60); const sec = state.timerSeconds % 60; 
        countdownDisplay.innerText = `${min}:${sec.toString().padStart(2, '0')}`;
    }
    if (window.location.pathname.includes('referee.html')) {
        document.querySelectorAll('.btn-opt').forEach(b => b.classList.remove('active'));
        const activeDur = document.getElementById(`dur-${state.selectedDuration}`); if (activeDur) activeDur.classList.add('active');
        const activeCnt = document.getElementById(`cnt-${state.activeCount}`); if (activeCnt) activeCnt.classList.add('active');
    }

    // 審判画面での基本表示台数制御
    if (window.location.pathname.includes('referee.html')) {
        for (let i = 1; i <= 3; i++) {
            const unit = document.getElementById(`unit-${i}`); if (!unit) continue; 
            unit.style.display = i <= state.activeCount ? "block" : "none";
            const d = state.dummies[`d${i}`]; const fill = document.getElementById(`d${i}-fill`); const valText = document.getElementById(`d${i}-val`);
            if (fill) { const life = Math.max(0, d.life); fill.style.width = (life * 0.94) + "%"; }
            if (valText) valText.innerText = `${Math.floor(Math.max(0, d.life) * 2.5)} / 250`;
        }
    } else {
        // 選手側表示の生命維持同期用
        for (let i = 1; i <= 3; i++) {
            const d = state.dummies[`d${i}`]; const fill = document.getElementById(`d${i}-fill`); const valText = document.getElementById(`d${i}-val`);
            if (fill) { const life = Math.max(0, d.life); fill.style.width = (life * 0.94) + "%"; }
            if (valText) valText.innerText = `${Math.floor(Math.max(0, d.life) * 2.5)} / 250`;
        }
    }
}

// 🎯 [NEWロジック] 選手（プレイヤー）画面側：常時グリッド展開プロトコル
if (!window.location.pathname.includes('referee.html')) {
    onValue(discoveryRef, (snap) => {
        const data = snap.val() || {};
        for (let i = 1; i <= 3; i++) {
            const unit = document.getElementById(`unit-${i}`);
            if (!unit) continue;

            // 基本設定（BODIES台数）の範囲外なら完全に消去
            if (i > state.activeCount) {
                unit.style.display = "none";
                continue;
            }

            // 範囲内なら常に画面に表示（display: block）し、審判のON/OFFに応じてクラスをインジェクション変色！
            unit.style.display = "block";
            const isDiscovered = !!data[`d${i}`];
            if (isDiscovered) {
                unit.classList.add('active-neon');
            } else {
                unit.classList.remove('active-neon');
            }
        }
    });
}

window.toggleTimer = () => { state.isRunning = !state.isRunning; saveState(); };
window.setCount = (val) => { state.activeCount = parseInt(val); saveState(); };
window.setDuration = (min) => { state.selectedDuration = min; state.timerSeconds = min * 60; state.baseDropPerSec = 100 / (min * 60); saveState(); };
window.applyDmg = (id, amt) => { state.dummies[id].life -= amt; saveState(); };
window.resetSystem = () => { if(confirm("リセット？")) set(stateRef, defaultData); };