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

        const isLocalEnv = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
        const sysPath = isLocalEnv ? "system_local" : "system";

        onValue(ref(db, `${sysPath}/update_list`), (snap) => {
            const data = snap.val();
            const container = document.getElementById('log-inner');
            if (!data) {
                container.innerHTML = '<div style="color:#666; text-align:center; font-size:13px;">登録されているアップデート履歴はありません。</div>';
                return;
            }
            let html = "";
            const now = Date.now();
            const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000; // 🎯 3日間（ミリ秒換算プロトコル）

            Object.keys(data).reverse().forEach(key => {
                const item = data[key];
                
                // 🎯 投稿timestampが存在し、かつ現在時刻との差分が3日以内か判定
                const isNew = item.timestamp && (now - item.timestamp < THREE_DAYS_MS);
                const newBadgeHtml = isNew ? '<span class="new-badge">NEW</span>' : '';

                html += `
                    <div class="log-item">
                        <div class="log-header">
                            <div class="version-wrap">
                                <span class="log-version">Ver ${escapeHTML(item.version)}</span>
                                ${newBadgeHtml}
                            </div>
                            <span style="font-family: monospace;">${escapeHTML(item.date)}</span>
                        </div>
                        <div class="log-content">${escapeHTML(item.text)}</div>
                    </div>`;
            });
            container.innerHTML = html;
        });

        function escapeHTML(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
