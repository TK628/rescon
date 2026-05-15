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

// --- マスターメンテナンス監視 ---
onValue(ref(db, 'system/masterMaintenance'), (snap) => {
    const isMaint = snap.val();
    const mOverlay = document.getElementById('master-maintenance-overlay');
    const gContent = document.getElementById('game-content');
    const authOverlay = document.getElementById('auth-overlay');

    if (isMaint) {
        if (mOverlay) mOverlay.style.display = 'flex';
        if (gContent) gContent.style.display = 'none';
        if (authOverlay) authOverlay.style.display = 'none';
    } else {
        if (mOverlay) mOverlay.style.display = 'none';
        // メンテナンス中でなければ認証の判定へ（まだ game-content は表示しない）
    }
});

// --- 部屋の初期化・認証管理 ---
window.addEventListener('DOMContentLoaded', () => {
    onValue(configRef, (snapshot) => {
        // ...中略（既存の認証ロジック）...
        // 認証に成功した時だけ以下を実行するようにします
    });
});

// 認証成功時に呼ばれる関数（共通）
function onAuthSuccess() {
    const authOverlay = document.getElementById('auth-overlay');
    const gContent = document.getElementById('game-content');
    
    // メンテナンス中でないことを再確認してから表示
    get(ref(db, 'system/masterMaintenance')).then((snap) => {
        if (!snap.val()) {
            if (authOverlay) authOverlay.style.display = 'none';
            if (gContent) gContent.style.display = 'block'; // ここで初めて表示！
        }
    });
}

// 既存の enterAsReferee 関数や checkPass 関数の中で 
// 「overlay.style.display = 'none'」していた場所を 
// 「onAuthSuccess()」に書き換えてください。