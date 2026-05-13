// Firebaseの設定
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

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const stateRef = ref(db, 'system/state');

// ★ autoDamage: 1秒間に減らすHP量（0.1なら10秒でHPが1減る）
const autoDamage = 0.2; 

const defaultData = {
    isRunning: false,
    activeCount: 3,
    selectedDuration: 10,
    timerSeconds: 600,
    dummies: {
        d1: { name: "Dummy 1", life: 100 },
        d2: { name: "Dummy 2", life: 100 },
        d3: { name: "Dummy 3", life: 100 }
    }
};

let state = JSON.parse(JSON.stringify(defaultData));

// --- 同期処理 ---
onValue(stateRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        state = data;
        updateUI();
    } else {
        saveState();
    }
});

function saveState() {
    set(stateRef, state);
}

// --- 1秒ごとの更新処理 ---
setInterval(() => {
    if (window.location.pathname.includes('referee.html') && state.isRunning) {
        let changed = false;

        // 1. タイマーを減らす
        if (state.timerSeconds > 0) {
            state.timerSeconds -= 1;
            changed = true;
        }

        // 2. 人形のライフをちょっとずつ減らす
        for (let i = 1; i <= state.activeCount; i++) {
            let d = state.dummies[`d${i}`];
            if (d && d.life > 0) {
                d.life -= autoDamage; // ここで少しずつ減少
                changed = true;
            }
        }

        if (changed) saveState();
    }
}, 1000);

// --- 画面表示の更新 ---
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

// --- ボタン操作 ---
window.toggleTimer = () => { 
    state.isRunning = !state.isRunning; 
    saveState(); 
};

window.setCount = (val) => { 
    state.activeCount = parseInt(val); 
    saveState(); 
};

window.setDuration = (min) => { 
    const m = parseInt(min);
    state.selectedDuration = m;
    state.timerSeconds = m * 60;
    saveState(); 
};

window.applyDmg = (id, amt, isSpeed) => {
    if (!isSpeed) {
        state.dummies[id].life -= amt;
        saveState();
    }
};

window.resetSystem = () => {
    if(confirm("全データをリセットしますか？")) {
        set(stateRef, defaultData);
    }
};