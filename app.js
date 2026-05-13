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

// --- 部屋の初期化・認証管理 ---
window.addEventListener('DOMContentLoaded', () => {
    onValue(configRef, (snapshot) => {
        const config = snapshot.val();
        const overlay = document.getElementById('auth-overlay');
        if (!overlay) return;

        if (!config) {
            // 部屋が未設定
            if (window.location.pathname.includes('referee.html')) {
                document.getElementById('auth-title').innerText = "ROOM SETUP";
                document.getElementById('setup-fields').style.display = 'block';
                document.getElementById('login-fields').style.display = 'none';
            } else {
                document.getElementById('auth-title').innerText = "WAITING...";
                document.getElementById('login-msg').innerText = "審判が部屋を作成するまでお待ちください。";
                document.getElementById('login-fields').style.display = 'block';
                document.getElementById('input-pass').style.display = 'none';
                document.getElementById('login-fields').querySelector('button').style.display = 'none';
            }
        } else {
            // 設定あり
            if (config.pass === "") {
                if (window.location.pathname.includes('player.html')) { overlay.style.display = 'none'; }
                else { checkRefereeCapacity(config); }
            } else {
                document.getElementById('auth-title').innerText = "ENTER PASSCODE";
                document.getElementById('setup-fields').style.display = 'none';
                document.getElementById('login-fields').style.display = 'block';
                document.getElementById('input-pass').style.display = 'inline-block';
                document.getElementById('login-fields').querySelector('button').style.display = 'inline-block';
            }
        }
    });
});

async function checkRefereeCapacity(config) {
    const snap = await get(refereeListRef);
    const refs = snap.val() || {};
    const count = Object.keys(refs).length;
    if (count >= config.capacity && !sessionStorage.getItem('myRefereeId')) {
        document.getElementById('login-fields').style.display = 'none';
        const err = document.getElementById('error-msg');
        err.innerText = `審判が定員(${config.capacity}名)に達しています。`;
        err.style.display = 'block';
    } else { enterAsReferee(); }
}

window.setupRoom = () => {
    const pass = document.getElementById('set-pass').value;
    const cap = parseInt(document.getElementById('set-capacity').value);
    set(configRef, { pass: pass, capacity: cap }).then(() => { enterAsReferee(); });
};

window.checkPass = () => {
    const input = document.getElementById('input-pass').value;
    get(configRef).then((snap) => {
        const config = snap.val();
        if (config && config.pass === input) {
            if (window.location.pathname.includes('referee.html')) { checkRefereeCapacity(config); }
            else { document.getElementById('auth-overlay').style.display = 'none'; }
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

    // オンライン状態と入室記録をセット
    set(myRef, true);
    set(onlineRef, true);

    // 切断時の予約：自分の記録を消す
    onDisconnect(myRef).remove();

    // ★リセットの核：審判リストを監視し、自分がいなくなった時に他がいなければ消す
    onValue(refereeListRef, (snap) => {
        const refs = snap.val() || {};
        const keys = Object.keys(refs);
        // 自分だけしかいない場合、自分が切断されたらconfigとonlineも消すよう予約
        if (keys.length === 1 && keys[0] === myId) {
            onDisconnect(configRef).remove();
            onDisconnect(onlineRef).remove();
            // ついでにゲームデータもリセットしたい場合は以下を有効に
            // onDisconnect(stateRef).remove(); 
        } else {
            // 他に審判がいるなら、自分が抜けても部屋の設定は残す（予約キャンセル）
            onDisconnect(configRef).cancel();
            onDisconnect(onlineRef).cancel();
        }
    });

    document.getElementById('auth-overlay').style.display = 'none';
}

// --- ゲームロジック ---
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