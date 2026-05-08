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

let state = JSON.parse(localStorage.getItem('dummySystemState')) || JSON.parse(JSON.stringify(defaultData));

function saveState() {
    localStorage.setItem('dummySystemState', JSON.stringify(state));
}

setInterval(() => {
    // 審判画面以外は常に最新の状態を読み込む
    if (!window.location.pathname.includes('referee.html')) {
        const saved = localStorage.getItem('dummySystemState');
        if (saved) state = JSON.parse(saved);
    }

    if (state.isRunning) {
        let baseDrop = 100 / (state.selectedDuration * 60);
        for (let i = 1; i <= state.activeCount; i++) {
            let d = state.dummies[`d${i}`];
            if (d && d.life > 0) {
                d.life -= baseDrop * d.multiplier;
            }
        }
        if (window.location.pathname.includes('referee.html')) {
            saveState();
        }
    }
    updateUI();
}, 1000);

function updateUI() {
    // カウントダウン表示（全画面共通）
    const countdownDisplay = document.getElementById('countdown-display');
    if (countdownDisplay) {
        const totalSeconds = state.selectedDuration * 60;
        const remainingSeconds = Math.max(0, Math.floor(totalSeconds * (state.dummies.d1.life / 100)));
        const min = Math.floor(remainingSeconds / 60);
        const sec = remainingSeconds % 60;
        countdownDisplay.innerText = `${min}:${sec.toString().padStart(2, '0')}`;
        countdownDisplay.style.color = state.dummies.d1.life < 20 ? "#ff4d4d" : "white";
    }

    // 審判画面用ステータス更新
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
            if (life < 20) fill.style.background = "var(--hp-red)";
            else if (life < 50) fill.style.background = "var(--hp-yellow)";
            else fill.style.background = "var(--hp-green)";
        }
        if (valText) {
            valText.innerText = `${Math.floor(Math.max(0, d.life) * 2.5)} / 250 LV: 1`;
        }
    }
}

window.toggleTimer = () => { state.isRunning = !state.isRunning; saveState(); updateUI(); };
window.setCount = (val) => { state.activeCount = parseInt(val); saveState(); updateUI(); };
window.setDuration = (min) => { state.selectedDuration = parseInt(min); saveState(); updateUI(); };
window.applyDmg = (id, amt, isSpeed) => {
    if (isSpeed) state.dummies[id].multiplier += 0.5;
    else state.dummies[id].life -= amt;
    saveState();
    updateUI();
};
window.resetSystem = () => {
    if(confirm("全データを初期化しますか？")) {
        state = JSON.parse(JSON.stringify(defaultData));
        saveState();
        location.reload();
    }
};