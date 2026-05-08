// Firebaseの設定（シンガポールサーバー専用URLに修正済み）
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

// Firebaseのライブラリを読み込み
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const stateRef = ref(db, 'system/state');

// 初期データ構造（Firebaseが空の時に使用）
const defaultData = {
    isRunning: false,
    activeCount: 3,
    selectedDuration: 10,
    dummies: {
        d1: { name: "Dummy 1", life: 100, multiplier: 1.0 },
        d2: { name: "Dummy 2", life: 100, multiplier: 1.0 },
        d3: { name: "Dummy 3", life: 100, multiplier: 1.0 }
    }
};

let state = JSON.parse(JSON.stringify(defaultData));

// --- データの同期処理 ---

// クラウド（Firebase）から最新データを受け取って画面を更新
onValue(stateRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        state = data;
        updateUI(); // 画面の表示を更新
    } else {
        // Firebaseが空（null）なら初期データを書き込む
        saveState();
    }
});

// クラウドへ現在の状態を保存する関数
function saveState() {
    set(stateRef, state);
}

// --- カウントダウン処理 ---
// 1秒ごとに実行
setInterval(() => {
    // 審判画面（referee.html）を開いている時だけ計算を行う
    if (window.location.pathname.includes('referee.html') && state.isRunning) {
        let baseDrop = 100 / (state.selectedDuration * 60);
        for (let i = 1; i <= state.activeCount; i++) {
            let d = state.dummies[`d${i}`];
            if (d && d.life > 0) {
                d.life -= baseDrop * d.multiplier;
            }
        }
        saveState(); // 計算結果をクラウドに送信
    }
}, 1000);

// --- 画面表示の更新 ---
function updateUI() {
    // タイマー表示
    const countdownDisplay = document.getElementById('countdown-display');
    if (countdownDisplay) {
        const totalSeconds = state.selectedDuration * 60;
        // ダミー1の残りHPを時間として換算
        const remainingSeconds = Math.max(0, Math.floor(totalSeconds * (state.dummies.d1.life / 100)));
        const min = Math.floor(remainingSeconds / 60);
        const sec = remainingSeconds % 60;
        countdownDisplay.innerText = `${min}:${sec.toString().padStart(2, '0')}`;
        countdownDisplay.style.color = state.dummies.d1.life < 20 ? "#ff4d4d" : "white";
    }

    // スタートボタンの見た目
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.innerText = state.isRunning ? "STOP" : "START";
        startBtn.style.background = state.isRunning ? "#ff4d4d" : "#7cfc00";
    }

    // 各ダミーのHPバー更新
    for (let i = 1; i <= 3; i++) {
        const unit = document.getElementById(`unit-${i}`);
        if (!unit) continue;
        
        // 選択された数だけ表示
        unit.style.display = i <= state.activeCount ? "block" : "none";
        
        const d = state.dummies[`d${i}`];
        const fill = document.getElementById(`d${i}-fill`);
        const valText = document.getElementById(`d${i}-val`);
        
        if (fill) {
            const life = Math.max(0, d.life);
            fill.style.width = (life * 0.94) + "%"; // SAO風の余白調整
            // 色の変化
            if (life < 20) fill.style.background = "#ff0000";
            else if (life < 50) fill.style.background = "#ffff00";
            else fill.style.background = "#7cfc00";
        }
        // player.html用の数値表示
        if (valText) valText.innerText = `${Math.floor(Math.max(0, d.life) * 2.5)} / 250 LV: 1`;
    }
}

// --- 操作用関数（HTMLのボタンから呼ばれる） ---
window.toggleTimer = () => { 
    state.isRunning = !state.isRunning; 
    saveState(); 
};

window.setCount = (val) => { 
    state.activeCount = parseInt(val); 
    saveState(); 
};

window.setDuration = (min) => { 
    state.selectedDuration = parseInt(min); 
    // 時間変更時はHPをリセット
    state.dummies.d1.life = 100;
    state.dummies.d2.life = 100;
    state.dummies.d3.life = 100;
    saveState(); 
};

window.applyDmg = (id, amt, isSpeed) => {
    if (isSpeed) {
        state.dummies[id].multiplier += 0.5;
    } else {
        state.dummies[id].life -= amt;
    }
    saveState();
};

window.resetSystem = () => {
    if(confirm("全データをリセットしますか？")) {
        set(stateRef, defaultData);
    }
};