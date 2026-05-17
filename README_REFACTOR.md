# RESCON リファクタリング版

この版では、各 HTML に埋め込まれていた JavaScript を `js/` フォルダへ分離しました。

## 変換内容

- `index.html` → `js/index.js`
- `owner.html` → `js/owner.js`
- `player.html` → `js/player.js`
- `referee.html` → `js/referee.js`
- `spectator.html` → `js/spectator.js`
- `manual.html` → `js/manual.js`
- `updates.html` → `js/updates.js`
- `maintenance.html` → `js/maintenance.js`

## 効果

- HTML と JavaScript を分離
- 保守性向上
- Git差分が見やすい
- 次の段階として `state.js`, `ui.js`, `sync.js` に分割しやすい

## 次のおすすめ

最初に `js/owner.js` を以下のように分割してください。

- `config.js`
- `firebase.js`
- `state.js`
- `ui.js`
- `timer.js`
- `sync.js`
- `app.js`

このリファクタリング版は、元の動作を維持したまま構造改善の第一歩として使えます。
