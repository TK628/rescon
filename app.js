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

// --- Firebase初期化の直後あたり ---
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') || 'default'; // URLにルーム指定がなければdefaultを使う

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ★保存先をルームごとに分ける！
const stateRef = ref(db, `rooms/${roomId}/state`);

const defaultData = {
    isRunning: false,
    activeCount: 3,
    selectedDuration: 10,
    timerSeconds: 600,
    // ★重要: ダメージなしの時にタイマー通りに減るための「基本速度」
    // 100% ÷ (10分 × 60秒) = 毎秒約0.166% ずつ減る計算
    baseDropPerSec: 0.1666, 
    dummies: {
        d1: { name: "Dummy 1", life: 100 },
        d2: { name: "Dummy 2", life: 100 },
        d3: { name: "Dummy 3", life: 100 }
    }
};

let state = JSON.parse(JSON.stringify(defaultData));

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

// --- 毎秒の更新処理 ---
setInterval(() => {
    if (window.location.pathname.includes('referee.html') && state.isRunning) {
        let changed = false;

        // 1. タイマーは常に1秒ずつ減る
        if (state.timerSeconds > 0) {
            state.timerSeconds -= 1;
            changed = true;
        }

        // 2. ライフを「基本速度」で自動減少させる
        // ダメージボタンを押していなければタイマーと同じタイミングで0になり、
        // 押していればその分早く0になります。
        for (let i = 1; i <= state.activeCount; i++) {
            let d = state.dummies[`d${i}`];
            if (d && d.life > 0) {
                d.life -= state.baseDropPerSec; 
            }
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
    // ★重要: 設定時間に合わせて「基本の減少速度」を再計算
    state.baseDropPerSec = 100 / (m * 60);
    
    state.dummies.d1.life = 100;
    state.dummies.d2.life = 100;
    state.dummies.d3.life = 100;
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

// --- オンライン状態の管理 ---
import { onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

if (roomId !== 'default') {
    const onlineRef = ref(db, `rooms/${roomId}/online`);
    // ページを開いた時に true にする
    set(onlineRef, true);
    // ブラウザを閉じたり通信が切れたりしたら自動的に削除（またはfalse）する
    onDisconnect(onlineRef).remove();
}