import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getDatabase, ref, onValue, set, get, remove, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
        
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

        const isLocalEnv = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
        const sysPath = isLocalEnv ? "system_local" : "system";

        // 🎯 [復元完了] メンテ画面ローカル環境判定
        if (isLocalEnv) {
            document.getElementById('maint-title').innerText = "[LOCAL] " + document.getElementById('maint-title').innerText;
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

        onValue(ref(db, `${sysPath}/masterMaintenance`), (snap) => { if (!snap.val()) { location.replace("index.html"); } });

        onValue(ref(db, `${sysPath}/news_list`), (snap) => {
            const data = snap.val(); const container = document.getElementById('board-inner');
            if (!data) { container.innerHTML = '<div style="color:#666; text-align:center; padding-top:20px;">お知らせはありません。</div>'; return; }
            let html = ""; const now = Date.now();
            const keys = Object.keys(data).sort((a, b) => { const pinA = data[a].pinned === true ? 1 : 0; const pinB = data[b].pinned === true ? 1 : 0; if (pinA !== pinB) return pinB - pinA; return data[b].timestamp - data[a].timestamp; });
            keys.forEach(key => { const item = data[key]; if (item.deleteAt && now > item.deleteAt) return; if ((item.releaseTime && item.releaseTime > now) || item.hidden === true) return; let badgeHtml = ""; if (item.pinned === true) badgeHtml += '<span class="badge pinned-post">📌 PINNED</span>'; html += `<div class="news-item ${item.pinned === true ? 'is-pinned' : ''}"><div class="info-header"><span>SYSTEM NOTIFICATION ${badgeHtml}</span><span>${item.date}</span></div><div class="info-content">${escapeHTML(item.text)}</div></div>`; });
            container.innerHTML = html || '<div style="color:#666; text-align:center; padding-top:20px;">お知らせはありません。</div>';
        });

        function escapeHTML(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
