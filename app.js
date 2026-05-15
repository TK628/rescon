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
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') || 'default';

const stateRef = ref(db, `rooms/${roomId}/state`);
const configRef = ref(db, `rooms/${roomId}/config`);
const refereeListRef = ref(db, `rooms/${roomId}/referees`);
const onlineRef = ref(db, `rooms/${roomId}/online`);

// --- 画面表示の制御関数 ---
function showAuthUI() {
    document.getElementById('master-maintenance-overlay').style.display = 'none';
    document.getElementById('auth-overlay').style.display = 'flex'; // ここで黒画面を解除して入力欄を出す
    document.getElementById('game-content').style.display = 'none';
}

function onAuthSuccess() {
    document.getElementById('master-maintenance-overlay').style.display = 'none';
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('game-content').style.display = 'block'; // ここで本編を表示
}

// --- マスターメンテナンス監視 ---
onValue(ref(db, 'system/masterMaintenance'), (snap) => {
    if (snap.val()) {
        document.getElementById('master-maintenance-overlay').style.display = 'flex';
        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('game-content').style.display = 'none';
    } else {
        // メンテナンス中でなければ、認証状態を確認してUIを表示
        checkCurrentStatus();
    }
});

function checkCurrentStatus() {
    get(configRef).then((snapshot) => {
        const config = snapshot.val();
        if (!config) {
            showAuthUI(); // 設定がなければセットアップ画面へ
        } else if (config.pass === "" || sessionStorage.getItem('isAuthorized') === roomId) {
            onAuthSuccess(); // パスなし、または認証済みなら本編へ
        } else {
            showAuthUI(); // パスが必要なら入力画面へ
        }
    });
}

// --- 認証ロジック ---
window.setupRoom = () => {
    const pass = document.getElementById('set-pass').value;
    const cap = parseInt(document.getElementById('set-capacity').value);
    set(configRef, { pass: pass, capacity: cap }).then(() => {
        sessionStorage.setItem('isAuthorized', roomId);
        if (window.location.pathname.includes('referee.html')) enterAsReferee();
        else onAuthSuccess();
    });
};

window.checkPass = () => {
    const input = document.getElementById('input-pass').value;
    get(configRef).then((snap) => {
        const config = snap.val();
        if (config && config.pass === input) {
            sessionStorage.setItem('isAuthorized', roomId);
            if (window.location.pathname.includes('referee.html')) enterAsReferee();
            else onAuthSuccess();
        } else {
            const err = document.getElementById('error-msg');
            err.innerText = "パスコードが正しくありません。";
            err.style.display = 'block';
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
    onAuthSuccess();

    onValue(refereeListRef, (snap) => {
        const refs = snap.val() || {};
        const keys = Object.keys(refs);
        if (keys.length === 1 && keys[0] === myId) {
            onDisconnect(configRef).remove();
            onDisconnect(onlineRef).remove();
        } else {
            onDisconnect(configRef).cancel();
            onDisconnect(onlineRef).cancel();
        }
    });
}

// --- 以下、既存のゲームロジック（そのまま） ---
const defaultData = {
    isRunning: false, activeCount: 3, selectedDuration: 10, timerSeconds: 600, baseDropPerSec: 0.1666, 
    dummies: { d1: { name: "Dummy 1", life: 100 }, d2: { name: "Dummy 2", life: 100 }, d3: { name: "Dummy 3", life: 100 } }
};
let state = JSON.parse(JSON.stringify(defaultData));
onValue(stateRef, (snapshot) => {
    const data = snapshot.val();
    if (data) { state = data; updateUI(); }
    else { saveState(); }
});
function saveState() { set(stateRef, state); }
setInterval(() => {
    if (window.location.pathname.includes('referee.html') && state.isRunning) {
        let changed = false;
        if (state.timerSeconds > 0) { state.timerSeconds -= 1; changed = true; }
        for (let i = 1; i <= state.activeCount; i++) {
            let d = state.dummies[`d${i}`];
            if (d && d.life > 0) { d.life -= state.baseDropPerSec; }
        }
        if (changed) saveState();
    }
}, 1000);

function updateUI() {
    const countdownDisplay = document.getElementById('countdown-display');
    if (countdownDisplay) {
        const min = Math.floor(state.timerSeconds / 60);
        const sec = state.timerSeconds % 60;
        countdownDisplay.innerText = `${min}:${sec.toString().padStart(2, '0')}`;
    }
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.innerText = state.isRunning ? "STOP" : "START";
        startBtn.style.background = state.isRunning ? "#ff4d4d" : "#7cfc00";
    }
    for (let i = 1; i <= 3; i++) {
        const unit = document.getElementById(`unit-${i}`);
        if (!unit) continue;
        unit.style.display = i <= state.activeCount ? "block" : "none";
        const d = state.dummies[`d${i}`];
        const fill = document.getElementById(`d${i}-fill`);
        const valText = document.getElementById(`d${i}-val`);
        if (fill) {
            const life = Math.max(0, d.life);
            fill.style.width = (life * 0.94) + "%";
            if (life < 20) fill.style.background = "#ff0000";
            else if (life < 50) fill.style.background = "#ffff00";
            else fill.style.background = "#7cfc00";
        }
        if (valText) valText.innerText = `${Math.floor(Math.max(0, d.life) * 2.5)} / 250 LV: 1`;
    }
}
window.toggleTimer = () => { state.isRunning = !state.isRunning; saveState(); };
window.setCount = (val) => { state.activeCount = parseInt(val); saveState(); };
window.setDuration = (min) => { 
    const m = parseInt(min);
    state.selectedDuration = m; state.timerSeconds = m * 60; state.baseDropPerSec = 100 / (m * 60);
    state.dummies.d1.life = 100; state.dummies.d2.life = 100; state.dummies.d3.life = 100;
    saveState(); 
};
window.applyDmg = (id, amt, isSpeed) => { if (!isSpeed) { state.dummies[id].life -= amt; saveState(); } };
window.resetSystem = () => { if(confirm("全データをリセットしますか？")) { set(stateRef, defaultData); } };