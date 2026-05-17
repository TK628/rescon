import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getDatabase, ref, onValue, set, get, remove, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
        
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

        const isLocalEnv = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
        const sysPath = isLocalEnv ? "system_local" : "system";
        const MASTER_HASH = "d6c61b07926d88b2547eec66fb7dcc8df859a4368ef07bce99406dc5d6dd9001";

        // 🎯 [復元完了] ローカル環境判定プロトコル
        if (isLocalEnv) {
            document.getElementById('site-title').innerText = "[LOCAL] " + document.getElementById('site-title').innerText;
        }

        document.addEventListener('DOMContentLoaded', () => {
            const sendBtn = document.getElementById('btn-send-report');
            if (sendBtn) {
                sendBtn.addEventListener('click', () => {
                    const text = document.getElementById('report-text').value.trim();
                    if (!text) return;
                    const reportRef = push(ref(db, `${sysPath}/bug_reports`));
                    set(reportRef, { text: text, timestamp: Date.now(), date: new Date().toLocaleString() }).then(() => { document.getElementById('report-text').value = ""; alert("送信を完了しました。ご協力ありがとうございます！"); }).catch(err => { alert("送信エラーが発生しました:\n" + err.message); });
                });
            }
        });

        onValue(ref(db, `${sysPath}/masterMaintenance`), (snap) => { if (!!snap.val()) { location.replace("maintenance.html"); } });

        onValue(ref(db, `${sysPath}/update_list`), (snap) => {
            const data = snap.val(); const dotEl = document.getElementById('update-alert-dot');
            if (!dotEl) return; if (!data) { dotEl.style.display = "none"; return; }
            const now = Date.now(); const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000; let hasNewUpdate = false;
            Object.keys(data).forEach(key => { if (data[key].timestamp && (now - data[key].timestamp < THREE_DAYS_MS)) { hasNewUpdate = true; } });
            dotEl.style.display = hasNewUpdate ? "block" : "none";
        });

        setInterval(() => {
            get(ref(db, `${sysPath}/news_list`)).then((snap) => {
                const data = snap.val(); if (!data) return; const now = Date.now();
                Object.keys(data).forEach(async (key) => { if (data[key].deleteAt && now > data[key].deleteAt) { await set(ref(db, `${sysPath}/auth_token`), MASTER_HASH); await remove(ref(db, `${sysPath}/news_list/${key}`)); await remove(ref(db, `${sysPath}/auth_token`)); } });
            });
        }, 3000);

        onValue(ref(db, `${sysPath}/news_list`), (snap) => {
            const data = snap.val(); const container = document.getElementById('board-inner');
            if (!data) { container.innerHTML = '<div style="color:#666; text-align:center; padding-top:20px;">お知らせはありません。</div>'; return; }
            let html = ""; const now = Date.now();
            const keys = Object.keys(data).sort((a, b) => { const pinA = data[a].pinned === true ? 1 : 0; const pinB = data[b].pinned === true ? 1 : 0; if (pinA !== pinB) return pinB - pinA; return data[b].timestamp - data[a].timestamp; });
            keys.forEach(key => { const item = data[key]; if (item.deleteAt && now > item.deleteAt) return; if ((item.releaseTime && item.releaseTime > now) || item.hidden === true) return; let badgeHtml = ""; if (item.pinned === true) badgeHtml += '<span class="badge pinned-post">📌 PINNED</span>'; html += `<div class="news-item ${item.pinned === true ? 'is-pinned' : ''}"><div class="info-header"><span>SYSTEM NOTIFICATION ${badgeHtml}</span><span>${item.date}</span></div><div class="info-content">${escapeHTML(item.text)}</div></div>`; });
            container.innerHTML = html || '<div style="color:#666; text-align:center; padding-top:20px;">お知らせはありません。</div>';
        });

        function escapeHTML(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
        window.closePopup = () => { document.getElementById('mode-popup-overlay').style.display = 'none'; };

        let selectedRoom = ""; const roomList = document.getElementById('room-list');
        for (let i = 1; i <= 10; i++) {
            const roomId = `room${i}`; const btn = document.createElement('div'); btn.className = 'room-btn'; btn.innerHTML = `<div class="smoke-layer"><div class="smoke smoke-1"></div><div class="smoke smoke-2"></div></div><div class="room-title-text">ROOM ${i.toString().padStart(2, '0')}</div><span class="online-badge">● IN USE</span><span class="offline-badge">● EMPTY</span>`; btn.onclick = () => { selectedRoom = roomId; document.getElementById('popup-room-title').innerText = `ROOM ${i.toString().padStart(2, '0')}`; document.getElementById('mode-popup-overlay').style.display = 'flex'; }; roomList.appendChild(btn);
            onValue(ref(db, `rooms/${roomId}/online`), (snapshot) => { if (snapshot.val() === true) { btn.classList.add('active'); get(ref(db, `rooms/${roomId}/referees`)).then(refSnap => { if (!refSnap.exists()) { remove(ref(db, `rooms/${roomId}/online`)); remove(ref(db, `rooms/${roomId}/config`)); } }); } else { btn.classList.remove('active'); } });
        }
        window.goToPage = (page) => { if (selectedRoom) window.location.href = `${page}?room=${selectedRoom}`; };
