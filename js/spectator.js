import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

        const firebaseConfig = {
            apiKey: "AIzaSyCIBxNvfpaSV3sBS-VKtDob4zYhZJ7djIk",
            authDomain: "hidamari-pj-8b4bb.firebaseapp.com",
            databaseURL: "https://hidamari-pj-8b4bb-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "hidamari-pj-8b4bb",
            storageBucket: "hidamari-pj-8b4bb.firebasestorage.app",
            messagingSenderId: "293093126367",
            appId: "1:293093126367:web:151cce22308352fa5ff96a"
        };
        const app = initializeApp(firebaseConfig);
        const db = getDatabase(app);

        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room') || 'default';
        const roomNum = urlParams.get('room') ? urlParams.get('room').replace('room', '') : '01';
        const formattedRoom = "ROOM " + roomNum.padStart(2, '0');
        
        document.getElementById('spectator-title-display').innerText = formattedRoom + " - SPECTATOR";

        const isLocal = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
        const sysPath = isLocal ? "system_local" : "system";

        let systemUnderMaintenance = false;

        function switchView(targetId) {
            if (systemUnderMaintenance) return;
            const views = ['auth-overlay', 'game-content'];
            views.forEach(id => { document.getElementById(id).style.display = 'none'; });
            const target = document.getElementById(targetId);
            if (target) target.style.display = (targetId === 'game-content') ? 'block' : 'flex';
        }

        onValue(ref(db, `${sysPath}/masterMaintenance`), (snap) => {
            systemUnderMaintenance = !!snap.val();
            document.getElementById('master-maintenance-overlay').style.display = systemUnderMaintenance ? 'flex' : 'none';
            if (systemUnderMaintenance) {
                document.getElementById('auth-overlay').style.display = 'none';
                document.getElementById('game-content').style.display = 'none';
            } else {
                onValue(ref(db, `rooms/${roomId}/config`), (configSnap) => {
                    if (configSnap.exists()) switchView('game-content');
                    else switchView('auth-overlay');
                }, { onlyOnce: true });
            }
        });

        onValue(ref(db, `rooms/${roomId}/config`), (configSnap) => {
            if (configSnap.exists()) switchView('game-content');
            else switchView('auth-overlay');
        });

        onValue(ref(db, `rooms/${roomId}/state`), (snap) => {
            const state = snap.val(); if (!state) return;

            const min = Math.floor(state.timerSeconds / 60); const sec = state.timerSeconds % 60;
            document.getElementById('countdown-display').innerText = `${min}:${sec.toString().padStart(2, '0')}`;

            for (let i = 1; i <= 3; i++) {
                const unit = document.getElementById(`unit-${i}`); if (!unit) continue;

                if (i > state.activeCount) { unit.style.display = "none"; continue; }
                unit.style.display = "block";

                const d = state.dummies[`d${i}`]; const fill = document.getElementById(`d${i}-fill`); const valText = document.getElementById(`d${i}-val`);
                if (fill) { fill.style.width = (Math.max(0, d.life) * 0.94) + "%"; }
                if (valText) valText.innerText = `${Math.floor(Math.max(0, d.life) * 2.5)} / 250`;
            }
        });

        onValue(ref(db, `rooms/${roomId}/referee_discovery`), (snap) => {
            const data = snap.val() || {};
            for (let i = 1; i <= 3; i++) {
                const unit = document.getElementById(`unit-${i}`); if (!unit) continue;
                if (!!data[`d${i}`]) unit.classList.add('active-neon');
                else unit.classList.remove('active-neon');
            }
        });

        onValue(ref(db, `rooms/${roomId}/player_status`), (snap) => {
            const data = snap.val() || {};
            for (let i = 1; i <= 3; i++) {
                const dData = data[`d${i}`]; const cEl = document.getElementById(`d${i}-spec-color`); const fEl = document.getElementById(`d${i}-spec-freq`); const sEl = document.getElementById(`d${i}-spec-status`);
                if (dData) {
                    if (cEl) cEl.innerText = dData.color; if (fEl) fEl.innerText = dData.frequency + " Hz";
                    if (sEl) {
                        sEl.innerText = dData.status; sEl.className = "spec-readout-val";
                        if (dData.status === "ERROR") sEl.classList.add('status-err');
                        if (dData.status === "CRITICAL") sEl.classList.add('status-crit');
                    }
                } else {
                    if (cEl) cEl.innerText = "---"; if (fEl) fEl.innerText = "--- Hz"; if (sEl) { sEl.innerText = "---"; sEl.className = "spec-readout-val"; }
                }
            }
        });
