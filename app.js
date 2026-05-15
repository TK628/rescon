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

onValue(ref(db, 'system/masterMaintenance'), (snap) => {
    if (snap.val()) switchView('master-maintenance-overlay');
    else checkCurrentStatus();
});

function checkCurrentStatus() {
    get(configRef).then((snapshot) => {
        const config = snapshot.val();
        if (!config) {
            switchView('auth-overlay');
            const isRef = window.location.pathname.includes('referee.html');
            document.getElementById('setup-fields').style.display = isRef ? 'block' : 'none';
            document.getElementById('login-fields').style.display = isRef ? 'none' : 'block';
            if (!isRef) document.getElementById('login-msg').innerText = "審判が部屋を作成するまでお待ちください。";
        } else if (config.pass === "" || sessionStorage.getItem('isAuthorized') === roomId) {
            if (window.location.pathname.includes('referee.html')) enterAsReferee();
            else switchView('game-content');
        } else {
            switchView('auth-overlay');
            document.getElementById('setup-fields').style.display = 'none';
            document.getElementById('login-fields').style.display = 'block';
        }
    });
}

window.setupRoom = () => {
    const pass = document.getElementById('set-pass').value;
    const cap = parseInt(document.getElementById('set-capacity').value);
    set(configRef, { pass: pass, capacity: cap }).then(() => {
        sessionStorage.setItem('isAuthorized', roomId);
        if (window.location.pathname.includes('referee.html')) enterAsReferee();
        else switchView('game-content');
    });
};

window.checkPass = () => {
    const input = document.getElementById('input-pass').value;
    get(configRef).then((snap) => {
        const config = snap.val();
        if (config && config.pass === input) {
            sessionStorage.setItem('isAuthorized', roomId);
            if (window.location.pathname.includes('referee.html')) enterAsReferee();
            else switchView('game-content');
        } else {
            alert("パスコードが違います");
        }
    });
};

function enterAsReferee() {
    let myId = sessionStorage.getItem('myRefereeId') || Math.random().toString(36).substring(2, 10);
    sessionStorage.setItem('myRefereeId', myId);
    const myRef = ref(db, `rooms/${roomId}/referees/${myId}`);
    set(myRef, true);
    set(onlineRef, true);
    onDisconnect(myRef).remove();
    switchView('game-content');
}

const defaultData = { isRunning: false, activeCount: 3, selectedDuration: 10, timerSeconds: 600, baseDropPerSec: 0.1666, dummies: { d1: { name: "Dummy 1", life: 100 }, d2: { name: "Dummy 2", life: 100 }, d3: { name: "Dummy 3", life: 100 } } };
let state = JSON.parse(JSON.stringify(defaultData));
onValue(stateRef, (snapshot) => { const data = snapshot.val(); if (data) { state = data; updateUI(); } else { saveState(); } });
function saveState() { set(stateRef, state); }
setInterval(() => { if (window.location.pathname.includes('referee.html') && state.isRunning) { if (state.timerSeconds > 0) state.timerSeconds -= 1; for (let i = 1; i <= state.activeCount; i++) { if (state.dummies[`d${i}`].life > 0) state.dummies[`d${i}`].life -= state.baseDropPerSec; } saveState(); } }, 1000);
function updateUI() {
    const countdownDisplay = document.getElementById('countdown-display');
    if (countdownDisplay) { const min = Math.floor(state.timerSeconds / 60); const sec = state.timerSeconds % 60; countdownDisplay.innerText = `${min}:${sec.toString().padStart(2, '0')}`; }
    if (window.location.pathname.includes('referee.html')) {
        document.querySelectorAll('.btn-opt').forEach(b => b.classList.remove('active'));
        const activeDur = document.getElementById(`dur-${state.selectedDuration}`);
        if (activeDur) activeDur.classList.add('active');
        const activeCnt = document.getElementById(`cnt-${state.activeCount}`);
        if (activeCnt) activeCnt.classList.add('active');
    }
    for (let i = 1; i <= 3; i++) {
        const unit = document.getElementById(`unit-${i}`); if (!unit) continue; unit.style.display = i <= state.activeCount ? "block" : "none";
        const d = state.dummies[`d${i}`]; const fill = document.getElementById(`d${i}-fill`); const valText = document.getElementById(`d${i}-val`);
        if (fill) { const life = Math.max(0, d.life); fill.style.width = (life * 0.94) + "%"; }
        if (valText) valText.innerText = `${Math.floor(Math.max(0, d.life) * 2.5)} / 250`;
    }
}
window.toggleTimer = () => { state.isRunning = !state.isRunning; saveState(); };
window.setCount = (val) => { state.activeCount = parseInt(val); saveState(); };
window.setDuration = (min) => { state.selectedDuration = min; state.timerSeconds = min * 60; state.baseDropPerSec = 100 / (min * 60); saveState(); };
window.applyDmg = (id, amt) => { state.dummies[id].life -= amt; saveState(); };
window.resetSystem = () => { if(confirm("リセット？")) set(stateRef, defaultData); };