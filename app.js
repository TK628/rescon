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

function switchView(targetId) {
    const views = ['master-maintenance-overlay', 'auth-overlay', 'game-content'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const target = document.getElementById(targetId);
    if (target) target.style.display = (targetId === 'game-content') ? 'block' : 'flex';
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
            // ★バグ修正：Firebaseのパスワードが空文字列で壊れて保存されている場合も、すり抜けず必ず再入力を要求する
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
    // 🚀 バグ修正：テンキー入力で文字数制限をすり抜けた場合も、送信直前に確実に4桁に切り取る
    let pass = document.getElementById('set-pass').value;
    if (pass.length > 4) pass = pass.slice(0, 4);
    
    const cap = parseInt(document.getElementById('set-capacity').value) || 99;
    
    set(configRef, { pass: pass, capacity: cap }).then(() => {
        sessionStorage.setItem('isAuthorized', roomId);
        if (window.location.pathname.includes('referee.html')) enterAsReferee();
        else switchView('game-content');
    });
};

window.checkPass = () => {
    // 🚀 バグ修正：テンキー入力対応。送信直前に確実に4桁に切り取る
    let input = document.getElementById('input-pass').value;
    if (input.length > 4) input = input.slice(0, 4);
    
    get(configRef).then((snap) => {
        const config = snap.val();
        if (!config) return;
        
        if (config.pass === input) {
            // 🎯【人数制限（定員ブロック）ロジックをここに完全新規実装】
            // パスコードが一致した際、Firebaseから現在の審判の人数を取得して比較する
            get(refereeListRef).then((refSnap) => {
                const refs = refSnap.val() || {};
                const currentCount = Object.keys(refs).length;
                const capacity = config.capacity || 99;
                
                // 審判画面（referee.html）へのアクセスで、すでに定員に達している場合はブロックして弾く
                if (window.location.pathname.includes('referee.html') && currentCount >= capacity) {
                    alert(`定員オーバーです。この部屋の審判枠は最大 ${capacity} 名です。`);
                    return;
                }
                
                // 定員以内、または選手画面（player.html）であれば正常に入室を許可
                sessionStorage.setItem('isAuthorized', roomId);
                if (window.location.pathname.includes('referee.html')) enterAsReferee();
                else switchView('game-content');
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
            remove(onlineRef);
            remove(configRef);
        } else if (keys.length === 1 && keys[0] === myId) {
            onDisconnect(onlineRef).remove();
            onDisconnect(configRef).remove();
        } else {
            onDisconnect(onlineRef).cancel();
            onDisconnect(configRef).cancel();
        }
    });

    switchView('game-content');
}

// 🚀【バグ修正：テンキー連続入力・全キーボード詰まり完全解消リアルタイムリスナー】
// 入力した瞬間にJavaScriptが裏で完全に文字数を4桁にホールドするため、2回目以降のフリーズが完全に消滅します
document.addEventListener('input', (e) => {
    if (e.target && (e.target.id === 'input-pass' || e.target.id === 'set-pass')) {
        if (e.target.value.length > 4) {
            e.target.value = e.target.value.slice(0, 4);
        }
    }
});

// --- ゲームロジック ---
const defaultData = { isRunning: false, activeCount: 3, selectedDuration: 10, timerSeconds: 600, baseDropPerSec: 0.1666, dummies: { d1: { name: "Dummy 1", life: 100 }, d2: { name: "Dummy 2", life: 100 }, d3: { name: "Dummy 3", life: 100 } } };
let state = JSON.parse(JSON.stringify(defaultData));

onValue(stateRef, (snapshot) => { 
    const data = snapshot.val(); 
    if (data) { state = data; updateUI(); } 
    else { saveState(); } 
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
        const min = Math.floor(state.timerSeconds / 60);
        const sec = state.timerSeconds % 60; 
        countdownDisplay.innerText = `${min}:${sec.toString().padStart(2, '0')}`;
    }
    if (window.location.pathname.includes('referee.html')) {
        document.querySelectorAll('.btn-opt').forEach(b => b.classList.remove('active'));
        const activeDur = document.getElementById(`dur-${state.selectedDuration}`);
        if (activeDur) activeDur.classList.add('active');
        const activeCnt = document.getElementById(`cnt-${state.activeCount}`);
        if (activeCnt) activeCnt.classList.add('active');
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
        }
        if (valText) valText.innerText = `${Math.floor(Math.max(0, d.life) * 2.5)} / 250`;
    }
}

window.toggleTimer = () => { state.isRunning = !state.isRunning; saveState(); };
window.setCount = (val) => { state.activeCount = parseInt(val); saveState(); };
window.setDuration = (min) => { state.selectedDuration = min; state.timerSeconds = min * 60; state.baseDropPerSec = 100 / (min * 60); saveState(); };
window.applyDmg = (id, amt) => { state.dummies[id].life -= amt; saveState(); };
window.resetSystem = () => { if(confirm("リセット？")) set(stateRef, defaultData); };