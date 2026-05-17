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
        const MASTER_HASH = "d6c61b07926d88b2547eec66fb7dcc8df859a4368ef07bce99406dc5d6dd9001";

        // 🎯 [復元完了] オーナー画面ローカル環境判定
        if (isLocalEnv) {
            document.getElementById('owner-title').innerText = "[LOCAL] " + document.getElementById('owner-title').innerText;
        }

        let cachedNews = {}; let cachedUpdates = {};
        async function sha256(text) { const msgUint8 = new TextEncoder().encode(text); const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8); const hashArray = Array.from(new Uint8Array(hashBuffer)); return hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); }

        window.unlockConsole = async () => { const pass = document.getElementById('owner-pass').value; if(await sha256(pass) === MASTER_HASH) { document.getElementById('auth-gate').style.display = 'none'; document.getElementById('console-view').style.display = 'block'; startConsoleSync(); } else { alert("ACCESS DENIED."); } };

        function startConsoleSync() {
            const toggle = document.getElementById('maint-toggle-switch');
            onValue(ref(db, `${sysPath}/masterMaintenance`), (snap) => { toggle.checked = !!snap.val(); });
            toggle.addEventListener('change', async (e) => { await set(ref(db, `${sysPath}/auth_token`), MASTER_HASH); await set(ref(db, `${sysPath}/masterMaintenance`), e.target.checked); await remove(ref(db, `${sysPath}/auth_token`)); });

            onValue(ref(db, `${sysPath}/bug_reports`), (snap) => {
                const data = snap.val(); const container = document.getElementById('report-list-container');
                if(!data) { container.innerHTML = '<div style="color:#444; text-align:center; font-size:12px; padding:20px;">現在、未読のバグ報告やコメントはありません。</div>'; return; }
                let html = ""; Object.keys(data).reverse().forEach(key => { const item = data[key]; html += `<div class="report-item"><div class="report-text-content">◈ ${escapeHTML(item.text)}</div><div class="report-meta"><span>${item.date}</span><span class="btn-report-del" onclick="window.deleteReport('${key}')">◈ 既読削除</span></div></div>`; }); container.innerHTML = html;
            });

            onValue(ref(db, `${sysPath}/news_list`), (snap) => {
                cachedNews = snap.val() || {}; const container = document.getElementById('active-news-container');
                if (Object.keys(cachedNews).length === 0) { container.innerHTML = '<div style="color:#444; text-align:center; font-size:11px; padding:10px;">配信中のお知らせはありません。</div>'; return; }
                let html = ""; const sortedKeys = Object.keys(cachedNews).sort((a, b) => { const pinA = cachedNews[a].pinned === true ? 1 : 0; const pinB = cachedNews[b].pinned === true ? 1 : 0; if (pinA !== pinB) return pinB - pinA; return cachedNews[b].timestamp - cachedNews[a].timestamp; });
                sortedKeys.forEach(key => { const item = cachedNews[key]; const isPinned = item.pinned === true; html += `<div class="report-item" style="${isPinned ? 'border-left: 3px solid #ffaa00; padding-left: 6px;' : ''}"><div class="report-text-content" style="font-size:12px;">${isPinned ? '<span style="color:#ffaa00; font-weight:bold; margin-right:4px;">📌 [固定中]</span>' : ''}${escapeHTML(item.text)}</div><div class="report-meta"><span>${item.date}</span><br><span class="btn-action-link pin-btn" onclick="window.togglePinNews('${key}')">${isPinned ? '📌 解除' : '📌 固定'}</span><span class="btn-action-link edit-btn" onclick="window.editNews('${key}')">✏️ 編集</span><span class="btn-action-link" onclick="window.deleteNews('${key}')">🗑️ 削除</span></div></div>`; }); container.innerHTML = html;
            });

            onValue(ref(db, `${sysPath}/update_list`), (snap) => {
                cachedUpdates = snap.val() || {}; const container = document.getElementById('active-updates-container');
                if (Object.keys(cachedUpdates).length === 0) { container.innerHTML = '<div style="color:#444; text-align:center; font-size:11px; padding:10px;">登録済みの履歴はありません。</div>'; return; }
                let html = ""; Object.keys(cachedUpdates).reverse().forEach(key => { const item = cachedUpdates[key]; html += `<div class="report-item"><div class="report-text-content" style="font-size:12px; color:#00ffff;"><span style="background:rgba(0,255,255,0.1); padding:2px 4px; border:1px solid #00ffff; border-radius:3px; font-size:10px; margin-right:5px;">Ver ${escapeHTML(item.version)}</span>${escapeHTML(item.text)}</div><div class="report-meta"><span>${escapeHTML(item.date)}</span><br><span class="btn-action-link edit-btn" onclick="window.editUpdate('${key}')">✏️ 内容修正</span></div></div>`; }); container.innerHTML = html;
            });
        }

        window.deleteReport = async (key) => { if(!confirm("この報告をリストから削除しますか？")) return; remove(ref(db, `${sysPath}/bug_reports/${key}`)); };
        window.togglePinNews = async (key) => { const item = cachedNews[key]; if (!item) return; const currentPinState = item.pinned === true; try { await set(ref(db, `${sysPath}/auth_token`), MASTER_HASH); if (!currentPinState) { const keys = Object.keys(cachedNews); for (const k of keys) { if (cachedNews[k].pinned === true) { await set(ref(db, `${sysPath}/news_list/${k}/pinned`), false); } } } await set(ref(db, `${sysPath}/news_list/${key}/pinned`), !currentPinState); await remove(ref(db, `${sysPath}/auth_token`)); } catch (e) { alert("ピン留め切り替えエラー: " + e.message); } };
        window.deleteNews = async (key) => { if (!confirm("このお知らせを完全に削除しますか？")) return; try { await set(ref(db, `${sysPath}/auth_token`), MASTER_HASH); await remove(ref(db, `${sysPath}/news_list/${key}`)); await remove(ref(db, `${sysPath}/auth_token`)); if (document.getElementById('edit-news-key').value === key) cancelNewsEdit(); alert("お知らせを完全に消去しました。"); } catch (e) { alert("削除エラー: " + e.message); } };
        window.editNews = (key) => { const item = cachedNews[key]; if (!item) return; document.getElementById('edit-news-key').value = key; document.getElementById('modal-text').value = item.text; document.getElementById('news-form-title').innerText = "✏️ EDIT NOTIFICATION / お知らせを編集・修正中"; document.getElementById('btn-news-submit').innerText = "UPDATE BROADCAST / 修正内容で上書き"; document.getElementById('btn-news-cancel').style.display = "block"; document.getElementById('news-form-title').style.color = "#00ffff"; };
        window.cancelNewsEdit = () => { document.getElementById('edit-news-key').value = ""; document.getElementById('modal-text').value = ""; document.getElementById('news-form-title').innerText = "BROADCAST NOTIFICATION / お知らせ配信"; document.getElementById('btn-news-submit').innerText = "POST BROADCAST"; document.getElementById('btn-news-cancel').style.display = "none"; document.getElementById('news-form-title').style.color = "#ff5555"; };

        window.submitNews = async () => {
            const text = document.getElementById('modal-text').value.trim(); const timeVal = document.getElementById('modal-time').value; const deleteTimeVal = document.getElementById('modal-delete-time').value; const editKey = document.getElementById('edit-news-key').value; if (!text) return alert("内容を入力してください");
            try { await set(ref(db, `${sysPath}/auth_token`), MASTER_HASH); const releaseTime = timeVal ? new Date(timeVal).getTime() : Date.now(); const deleteAt = deleteTimeVal ? new Date(deleteTimeVal).getTime() : 0; const wasPinned = editKey && cachedNews[editKey] ? cachedNews[editKey].pinned === true : false; const postData = { text: text, date: new Date(releaseTime).toLocaleDateString(), timestamp: Date.now(), releaseTime: releaseTime, deleteAt: deleteAt, hidden: false, pinned: wasPinned }; const targetRef = editKey ? ref(db, `${sysPath}/news_list/${editKey}`) : push(ref(db, `${sysPath}/news_list`)); await set(targetRef, postData); await remove(ref(db, `${sysPath}/auth_token`)); cancelNewsEdit(); document.getElementById('modal-time').value = ""; document.getElementById('modal-delete-time').value = ""; alert(editKey ? "お知らせを上書き修正しました！" : "お知らせの新規配信を完了しました！"); } catch (e) { alert("エラー: " + e.message); }
        };

        window.editUpdate = (key) => { const item = cachedUpdates[key]; if (!item) return; document.getElementById('edit-update-key').value = key; document.getElementById('update-version').value = item.version; document.getElementById('update-date').value = item.date; document.getElementById('update-text').value = item.text; document.getElementById('update-form-title').innerText = "✏️ EDIT UPDATE LOG / アップデート履歴を修正式"; document.getElementById('update-form-title').style.color = "#00ffff"; document.getElementById('btn-update-submit').innerText = "UPDATE LOG DATA / 修正履歴を上書き保存"; document.getElementById('btn-update-cancel').style.display = "block"; };
        window.cancelUpdateEdit = () => { document.getElementById('edit-update-key').value = ""; document.getElementById('update-version').value = ""; document.getElementById('update-date').value = ""; document.getElementById('update-text').value = ""; document.getElementById('update-form-title').innerText = "SYSTEM UPDATE LOG MANAGEMENT / アップデート履歴管理"; document.getElementById('update-form-title').style.color = "#ff5555"; document.getElementById('btn-update-submit').innerText = "POST UPDATE LOG"; document.getElementById('btn-update-cancel').style.display = "none"; };

        window.submitUpdateLog = async () => {
            const version = document.getElementById('update-version').value.trim(); const dateVal = document.getElementById('update-date').value.trim(); const text = document.getElementById('update-text').value.trim(); const editKey = document.getElementById('edit-update-key').value; if (!version || !text) return alert("VERSION と EXPANSION DETAILS は必須項目です。");
            try { await set(ref(db, `${sysPath}/auth_token`), MASTER_HASH); let finalDate = dateVal; if (!finalDate) { const now = new Date(); const yyyy = now.getFullYear(); const mm = String(now.getMonth() + 1).padStart(2, '0'); const dd = String(now.getDate()).padStart(2, '0'); const hh = String(now.getHours()).padStart(2, '0'); const min = String(now.getMinutes()).padStart(2, '0'); finalDate = `${yyyy}/${mm}/${dd} ${hh}:${min}`; } const postData = { version: version, date: finalDate, text: text, timestamp: Date.now() }; const targetRef = editKey ? ref(db, `${sysPath}/update_list/${editKey}`) : push(ref(db, `${sysPath}/update_list`)); await set(targetRef, postData); await remove(ref(db, `${sysPath}/auth_token`)); cancelUpdateEdit(); alert(editKey ? "過去のアップデートログを修正・上書きしました！" : "SYSTEM UPDATE LOG配信完了しました！"); } catch (e) { alert("送信エラー: " + e.message); }
        };

        function escapeHTML(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
