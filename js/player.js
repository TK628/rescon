import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

        document.querySelectorAll('.btn-exit-trigger').forEach(btn => {
            btn.addEventListener('click', () => { sessionStorage.removeItem('isAuthorized'); location.href = 'index.html'; });
        });

        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room') || 'default';
        const roomNum = urlParams.get('room') ? urlParams.get('room').replace('room', '') : '01';
        const formattedRoom = "ROOM " + roomNum.padStart(2, '0');
        document.getElementById('player-title-display').innerText = formattedRoom + " - PLAYER";

        window.updateSliderReadout = (num, val) => {
            document.getElementById(`p${num}-freq-val`).innerText = val + " Hz";
        };

        window.sendDummyReport = (dummyNum) => {
            if (!window.db) return;
            const color = document.getElementById(`p${dummyNum}-color`).value;
            const freq = parseInt(document.getElementById(`p${dummyNum}-freq`).value);
            const status = document.getElementById(`p${dummyNum}-status`).value;

            set(ref(window.db, `rooms/${roomId}/player_status/d${dummyNum}`), {
                color: color,
                frequency: freq,
                status: status,
                timestamp: Date.now()
            });
        };

        const secretInput = document.getElementById('input-pass');
        window.focusSecretInput = () => { if(secretInput) secretInput.focus(); };
        if (secretInput) {
            secretInput.addEventListener('keydown', function(e) {
                if ((e.keyCode >= 96 && e.keyCode <= 105) || e.key === 'Enter' && e.code.startsWith('Numpad')) { e.preventDefault(); e.stopPropagation(); }
            });
            secretInput.addEventListener('compositionstart', function(e) { e.preventDefault(); });
            secretInput.addEventListener('input', function() {
                this.value = this.value.replace(/[^0-9]/g, '');
                if (this.value.length > 4) this.value = this.value.slice(0, 4);
                const currentLen = this.value.length;
                for (let i = 0; i < 4; i++) {
                    const box = document.getElementById(`box-${i}`);
                    if (!box) continue;
                    if (i < currentLen) { box.innerText = "●"; box.classList.remove('active'); }
                    else { box.innerText = ""; box.classList.remove('active'); }
                    if (i === currentLen) box.classList.add('active');
                }
            });
            document.getElementById('box-0').classList.add('active');
            document.addEventListener('click', () => {
                const overlay = document.getElementById('auth-overlay');
                if(overlay && overlay.style.display !== 'none') focusSecretInput();
            });
        }

        const isLocal = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
        if (isLocal) {
            window.switchView = (targetId) => {
                const bypassTarget = (targetId === 'master-maintenance-overlay') ? 'auth-overlay' : targetId;
                const views = ['master-maintenance-overlay', 'auth-overlay', 'game-content'];
                views.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
                const target = document.getElementById(bypassTarget); if (target) target.style.display = (bypassTarget === 'game-content') ? 'block' : 'flex';
            };
        }
