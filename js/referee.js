import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

        document.querySelectorAll('.btn-exit-trigger').forEach(btn => {
            btn.addEventListener('click', () => { sessionStorage.removeItem('isAuthorized'); location.href = 'index.html'; });
        });

        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room') || 'default';
        const roomNum = urlParams.get('room') ? urlParams.get('room').replace('room', '') : '01';
        const formattedRoom = "ROOM " + roomNum.padStart(2, '0');
        document.getElementById('referee-title-display').innerText = formattedRoom + " - REFEREE";
        
        const roomBadge = document.getElementById('room-title-display');
        if (roomBadge) roomBadge.innerText = formattedRoom;

        window.toggleDiscovery = (num) => {
            if (!window.db) return;
            const isChecked = document.getElementById(`d${num}-discover-toggle`).checked;
            set(ref(window.db, `rooms/${roomId}/referee_discovery/d${num}`), isChecked);
        };

        function initRefereeLink() {
            if (!window.db) return setTimeout(initRefereeLink, 200);

            onValue(ref(window.db, `rooms/${roomId}/referee_discovery`), (snap) => {
                const data = snap.val() || {};
                for (let i = 1; i <= 3; i++) {
                    const toggle = document.getElementById(`d${i}-discover-toggle`);
                    if (toggle) toggle.checked = !!data[`d${i}`];
                }
            });

            onValue(ref(window.db, `rooms/${roomId}/player_status`), (snap) => {
                const data = snap.val() || {};
                for (let i = 1; i <= 3; i++) {
                    const dummyData = data[`d${i}`];
                    const colorEl = document.getElementById(`d${i}-mon-color`);
                    const freqEl = document.getElementById(`d${i}-mon-freq`);
                    const statusEl = document.getElementById(`d${i}-mon-status`);

                    if (dummyData) {
                        if (colorEl) colorEl.innerText = dummyData.color;
                        if (freqEl) freqEl.innerText = dummyData.frequency + " Hz";
                        if (statusEl) {
                            statusEl.innerText = dummyData.status;
                            statusEl.className = "monitor-val";
                            if (dummyData.status === "ERROR") statusEl.classList.add('status-error');
                            if (dummyData.status === "CRITICAL") statusEl.classList.add('status-critical');
                        }
                    } else {
                        if (colorEl) colorEl.innerText = "---";
                        if (freqEl) freqEl.innerText = "--- Hz";
                        if (statusEl) { statusEl.innerText = "---"; statusEl.className = "monitor-val"; }
                    }
                }
            });
        }
        initRefereeLink();

        const setPassInput = document.getElementById('set-pass');
        if (setPassInput) {
            setPassInput.addEventListener('keydown', function(e) {
                if ((e.keyCode >= 96 && e.keyCode <= 105) || e.key === 'Enter' && e.code.startsWith('Numpad')) { e.preventDefault(); e.stopPropagation(); }
            });
            setPassInput.addEventListener('compositionstart', function(e) { e.preventDefault(); });
            setPassInput.addEventListener('input', function() {
                this.value = this.value.replace(/[^0-9]/g, '');
                if (this.value.length > 4) this.value = this.value.slice(0, 4);
            });
        }

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
                if(overlay && overlay.style.display !== 'none' && document.getElementById('login-fields').style.display !== 'none') focusSecretInput();
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
