// js/ui.js

function updateRefereeUI(state) {
    document.querySelectorAll('.btn-opt').forEach(b => {
        b.classList.remove('active');
    });

    const activeDur = document.getElementById(`dur-${state.selectedDuration}`);
    if (activeDur) activeDur.classList.add('active');

    const activeCnt = document.getElementById(`cnt-${state.activeCount}`);
    if (activeCnt) activeCnt.classList.add('active');

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.innerText = state.isRunning ? "PAUSE" : "START";

        startBtn.style.background = state.isRunning
            ? "linear-gradient(135deg, rgba(255, 75, 43, 0.2) 0%, rgba(255, 65, 108, 0.3) 100%)"
            : "linear-gradient(135deg, rgba(0, 255, 255, 0.2) 0%, rgba(0, 150, 255, 0.3) 100%)";

        startBtn.style.borderColor = state.isRunning
            ? "#ff416c"
            : "#00ffff";
    }
}

// 観客画面などのテキスト情報を完全初期化するサブプロトコル
function clearTelemetryUI() {
    for (let i = 1; i <= 3; i++) {
        const cEl = document.getElementById(`d${i}-spec-color`);
        const fEl = document.getElementById(`d${i}-spec-freq`);
        const sEl = document.getElementById(`d${i}-spec-status`);
        if (cEl) cEl.innerText = "---";
        if (fEl) fEl.innerText = "--- Hz";
        if (sEl) {
            sEl.innerText = "ONLINE";
            sEl.className = "spec-readout-val";
        }
    }
}

function getLifeColor(currentLife) {
    if (currentLife <= 20) {
        return "var(--hp-red, #ff0000)";
    }

    if (currentLife <= 50) {
        return "var(--hp-yellow, #ffff00)";
    }

    return "var(--hp-green, #7cfc00)";
}

function getDummyLifeText(currentLife) {
    return `${Math.floor(currentLife * 2.5)} / 250`;
}

function updateDummyLifeUI(index, currentLife, isSpectator) {

    if (currentLife < 0) {
        currentLife = 0;
    }

    const fill = document.getElementById(`d${index}-fill`);
    const valText = document.getElementById(`d${index}-val`);

    const rate = isSpectator ? 0.94 : 1.0;

    if (fill) {
        fill.style.width = (currentLife * rate) + "%";
        fill.style.backgroundColor = getLifeColor(currentLife);
    }

    if (valText) {
        valText.innerText = getDummyLifeText(currentLife);
    }
}

export {
    updateRefereeUI,
    clearTelemetryUI,
    getLifeColor,
    getDummyLifeText,
    updateDummyLifeUI
};