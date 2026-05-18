import {
    updateRefereeUI,
    clearTelemetryUI,
    getLifeColor,
    getDummyLifeText,
    updateDummyLifeUI
} from "./js/ui.js";

import {
    switchView,
    getRoomId,
    isRoomAuthorized,
    validatePasscode,
    authorizeRoom,
    getInputPasscode,
    getSetupPasscode,
    getSetupCapacity,
    getMyRefereeId,
    exitRoom
} from "./js/room.js";

import {
    db,
    ref,
    set,
    onValue,
    onDisconnect,
    remove,
    get,
    saveGameState,
    getSnapshotValue,
    listenGameState
} from "./js/firebase.js";

import { 
    calculateRemainingSeconds,
    formatTime
} from "./js/timer.js";

import {
    calculateCurrentLife,
    applyDamageToLife,
    createDefaultState
} from "./js/game-state.js";

import {
    isRefereePage,
    isPlayerPage,
    isSpectatorPage,
    canOperateReferee
} from "./js/referee.js";

import {
    canOperatePlayer
} from "./js/player.js";

import {
    canViewSpectator
} from "./js/spectator.js";

const roomId = getRoomId();

const stateRef = ref(db, `rooms/${roomId}/state`);
const configRef = ref(db, `rooms/${roomId}/config`);
const refereeListRef = ref(db, `rooms/${roomId}/referees`);
const onlineRef = ref(db, `rooms/${roomId}/online`);
const discoveryRef = ref(db, `rooms/${roomId}/referee_discovery`);

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
        
        if (!config) {
            switchView('auth-overlay');
            document.getElementById('setup-fields').style.display = isReferee ? 'block' : 'none';
            document.getElementById('login-fields').style.display = isReferee ? 'none' : 'block';
            if (!isReferee) {
                const msgEl = document.getElementById('login-msg');
                if (msgEl) msgEl.innerText = "審判が部屋を作成するまでお待ちください。";
            }
        } else {

            if (canViewSpectator(isSpectator)) {
                switchView('game-content');
                return;
            }

            if (config.pass !== "" && isRoomAuthorized(roomId)) {

                if (isReferee) enterAsReferee();
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
    const pass = getSetupPasscode();
    const capacity = getSetupCapacity();
    
    set(configRef, { pass: pass, capacity: capacity }).then(() => {
        authorizeRoom(roomId);
        set(discoveryRef, { d1: false, d2: false, d3: false });
        if (isReferee) enterAsReferee();
        else switchView('game-content');
    });
};

window.checkPass = () => {
    const input = getInputPasscode();
    
    get(configRef).then((snap) => {
        const config = snap.val();
        if (!config) return;
        
        if (validatePasscode(input, config.pass)) {
            get(refereeListRef).then((refSnap) => {
                const refs = refSnap.val() || {};
                const currentCount = Object.keys(refs).length;
                const capacity = config.capacity || 99;
                
                if (isReferee) {
                    if (currentCount >= capacity) {
                        alert(`定員オーバーです。この部屋の審判枠は最大 ${capacity} 名です。`);
                        return;
                    }
                    authorizeRoom(roomId);
                    enterAsReferee();
                } else {
                    authorizeRoom(roomId);
                    switchView('game-content');
                }
            });
        } else {
            alert("パスコードが違います");
        }
    });
};

function enterAsReferee() {
    const myId = getMyRefereeId();
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

// =================================================================
// 🧠 ゲームコア同期ロジック（リセット完全連動プロトコル）
// =================================================================

const defaultData = createDefaultState();
let state = JSON.parse(JSON.stringify(defaultData));

const isReferee = isRefereePage();
const isSpectator = window.location.pathname.includes('spectator.html');
const isPlayer = window.location.pathname.includes('player.html');

// 🔄 Firebase から最新の国家ステータスを受信
listenGameState(stateRef, (snapshot) => {
    const data = getSnapshotValue(snapshot);
    function handleStateUpdate(data) {

        state = data;

        updateUI();

        // ここに今の onValue の中身を
        // 少しずつ移していく
    }
    if (data) { 
        // 古いデータ構造（life）が残っている場合のセーフティ互換ケア
        if (data.dummies) {
            for(let i = 1; i <= 3; i++) {
                if (data.dummies[`d${i}`] && data.dummies[`d${i}`].life !== undefined) {
                    data.dummies[`d${i}`].lifeAtSync = data.dummies[`d${i}`].life;
                    delete data.dummies[`d${i}`].life;
                }
            }
        }
        state = data; 
        
        // 【重要】設定台数（BODIES）の枠外の要素を即座に非表示にする
        if (!isReferee) {
            for (let i = 1; i <= 3; i++) {
                const card = document.getElementById(`unit-${i}`) || document.querySelector(`.dummy-card:nth-child(${i})`);
                if (card) {
                    card.style.display = (i > state.activeCount) ? "none" : "block";
                }
            }
        }
        
        updateUI(); 
    } else { 
        // 🎯 審判がリセットした際、またはデータが完全に空の時
        state = JSON.parse(JSON.stringify(defaultData));
        if (isReferee) {
            saveGameState(stateRef, state); 
        } else {
            // 選手・観客画面：データが空＝リセットされたと判断し、ローカルの表示も完全初期化
            clearTelemetryUI();
            updateUI();
        }
    } 
});

// 🎯 【超高精度ローカル・レンダリングループ】
setInterval(() => { 
    const now = Date.now();
    let currentLeftSeconds = 0;
    let elapsedSecondsSinceSync = 0; 

    if (state.isRunning) {
        currentLeftSeconds = calculateRemainingSeconds(state.targetTimestamp);
        elapsedSecondsSinceSync = state.pausedLeftSeconds - currentLeftSeconds;
        if (elapsedSecondsSinceSync < 0) elapsedSecondsSinceSync = 0;
    } else {
        currentLeftSeconds = state.pausedLeftSeconds;
        elapsedSecondsSinceSync = 0; 
    }

    // 🕒 タイマーの文字盤描画
    const countdownDisplay = document.getElementById('countdown-display');
    if (countdownDisplay) { 
        countdownDisplay.innerText = formatTime(currentLeftSeconds);
    }

    // 📊 ライフゲージ＆数値テキストの変調同期
    if (state.dummies) {
        for (let i = 1; i <= 3; i++) {

            const d = state.dummies[`d${i}`];
            if (!d) continue;

            let currentLife = calculateCurrentLife(
                d.lifeAtSync,
                state.baseDropPerSec,
                elapsedSecondsSinceSync
            );

            updateDummyLifeUI(
                i,
                currentLife,
                isSpectator
            );
        }
    }

    updateUI(currentLeftSeconds);
}, 100); 

function updateUI(currentLeftSeconds = 600) {
    if (isReferee) {
        updateRefereeUI(state);
    }
}

// =================================================================
// 🎛️ 審判コントロール窓口関数
// =================================================================

window.toggleTimer = () => { 
    if (!canOperateReferee(isReferee)) return;
    const now = Date.now();

    if (!state.isRunning) {
        state.isRunning = true;
        state.targetTimestamp = now + (state.pausedLeftSeconds * 1000);
    } else {
        const diffMs = state.targetTimestamp - now;
        const elapsed = state.pausedLeftSeconds - (diffMs / 1000);

        for (let i = 1; i <= 3; i++) {
            if(state.dummies[`d${i}`]) {
                state.dummies[`d${i}`].lifeAtSync -= (state.baseDropPerSec * elapsed);
                if (state.dummies[`d${i}`].lifeAtSync < 0) state.dummies[`d${i}`].lifeAtSync = 0;
            }
        }

        state.isRunning = false;
        state.pausedLeftSeconds = Math.max(0, Math.floor(diffMs / 1000));
    }
    saveGameState(stateRef, state); 
};

window.setCount = (val) => { if (!canOperateReferee(isReferee)) return; state.activeCount = parseInt(val); saveGameState(stateRef, state); };

window.setDuration = (min) => { 
    if (!canOperateReferee(isReferee)) return;
    state.selectedDuration = min; 
    state.pausedLeftSeconds = min * 60; 
    if (state.isRunning) {
        state.targetTimestamp = Date.now() + (state.pausedLeftSeconds * 1000);
    }
    state.baseDropPerSec = 100 / (min * 60); 
    for (let i = 1; i <= 3; i++) {
        if(state.dummies[`d${i}`]) state.dummies[`d${i}`].lifeAtSync = 100;
    }
    saveGameState(stateRef, state); 
};

window.applyDamage = (id, amt) => {
    if (!canOperateReferee(isReferee)) return;

    if (state.isRunning) {
        const diffMs = state.targetTimestamp - Date.now();
        const elapsed = state.pausedLeftSeconds - (diffMs / 1000);

        for (let i = 1; i <= 3; i++) {
            if (state.dummies[`d${i}`]) {
                const currentLife =
                    state.dummies[`d${i}`].lifeAtSync -
                    (state.baseDropPerSec * elapsed);

                if (`d${i}` === id) {
                    state.dummies[id].lifeAtSync =
                        applyDamageToLife(currentLife, amt);
                } else {
                    state.dummies[`d${i}`].lifeAtSync =
                        Math.max(0, currentLife);
                }
            }
        }

        state.pausedLeftSeconds =
            Math.max(0, Math.floor(diffMs / 1000));

        state.targetTimestamp =
            Date.now() + (state.pausedLeftSeconds * 1000);

    } else {
        if (state.dummies[id]) {
            state.dummies[id].lifeAtSync =
                applyDamageToLife(
                    state.dummies[id].lifeAtSync,
                    amt
                );
        }
    }

    saveGameState(stateRef, state);
};

// 🎯 【改善】リセット時に周辺データ（発見フラグ・選手ステータス）も一括消去する完全クレンジング
window.resetSystem = async () => { 
    if (!canOperateReferee(isReferee)) return;
    if(confirm("ルームデータをリセットしますか？")) {
        try {
            // 1. メインステータスをデフォルトにリセット
            await set(stateRef, createDefaultState());
            // 2. 審判の発見フラグ（active-neon用）をデータベースから完全消去
            await remove(discoveryRef);
            // 3. 選手画面から送られている副次テレメトリー（周波数・顔色など）のノードも完全消去
            const playerStatusRef = ref(db, `rooms/${roomId}/player_status`);
            await remove(playerStatusRef);
        } catch (e) {
            console.error("Reset Error: ", e);
        }
    }
};

// =================================================================
// 📡 【周辺信号プロトコル】選手画面・観客画面用の発見（Neon）同期
// =================================================================
onValue(discoveryRef, (snap) => {
    const data = snap.val() || {};
    for (let i = 1; i <= 3; i++) {
        const unit = document.getElementById(`unit-${i}`);
        if (!unit) continue;
        
        if (state && i > state.activeCount) { 
            unit.style.display = "none"; 
            continue; 
        }
        
        unit.style.display = "block";
        if (!!data[`d${i}`]) {
            unit.classList.add('active-neon');
        } else {
            unit.classList.remove('active-neon');
        }
    }
});