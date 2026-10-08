# EUROPA ODYSSEY／歐羅巴遠征 — 給 AI 的工作須知

純 JavaScript 的 canvas 網頁遊戲（沒有框架、沒有打包工具），朋友在 Netlify 上玩。

## 一定要遵守

- **一律用繁體中文跟使用者對話。** 程式碼註解也照專案原本的中文風格寫。
- **開發分支是 `nordic`**（N 開頭的那條）。所有開發、commit 都在 `nordic` 上做。
- **絕對不要合併到 `main`、不要推 `main`。** 推 `main` 會讓 Netlify 做正式部署、扣免費額度（超過會收費）。
- **不要執行 `tools/deploy.ps1`。** 它會推 `main` 再推 `main:live`，違反上一條。
- **使用者明確說「可以上線」之前，絕對不能上線。** 做好之後先在本機預覽給使用者看。
- **上線的方式：** 先在本機打包確認沒壞（`python tools/build-single.py`），再只推 `nordic` 到 `live` 分支：
  `git push origin nordic:live`（走 Netlify 的分支部署，不扣額度）。朋友玩的網址是
  https://live--effervescent-cucurucho-40f89f.netlify.app
- **推完就好，不要上線上網站檢查版本。**
- 每次改動都要進版：`js/branding.js` 的 `VERSION` 跟版本說明，還有 `index.html` 裡所有 `?v=` 快取參數。

## 檔案與結構

- `index.html` 依序載入 `js/*.js`（每個檔案是一個 IIFE 全域模組：Levels、Features、Encounter、Expedition、Quests、Shaft、Sprites、Save、Equipment、WorldMap、Voyage、Game、America⋯⋯）。
- 關卡在 `js/levels.js` 的 `Levels.list`，**存檔照關卡順序記，新關卡一定接在最後面**（插在中間會讓舊存檔錯位）。
- 兩張大地圖：歐洲（`js/europe-geo.js`）和新大陸（`js/america-geo.js`），用 `WorldMap.useWorld('eu'|'am')` 切換。
  地理資料由 `tools/build-europe-map.js`、`tools/build-america-map.js` 從 `ne110m.json` 產生，不要手改產生出來的檔案。
- 劇情人物與委託在 `js/quests.js`、`js/expedition.js`；美洲篇的美術在 `js/america.js`。
- 行尾：`levels.js`、`entities.js`、`sprites.js`、`levelgen.js`、`save.js`、`shaft.js`、`worldmap.js` 和部分測試是 **CRLF**，改檔時要保留原本的行尾。

## 測試

- 測試都在 `tests/*.js`，要在瀏覽器裡跑：開本機預覽後，把測試檔用 `<script>` 載入，執行 `runXxxCheck()`（例如 `runAmericaCheck()`、`runRaceCheck()`、`runQuestCheck()`），還有 `runTraversalTest()`、`runBossTest()`、`runBossFightTest()`。
- `runTouchCheck()` 要在手機尺寸下跑（需要先載入 `terrain-util.js`、`menu-check.js`）。
- 已知：`runBossFightTest()` 的義大利、羅馬尼亞打不贏是機器人的老限制，不是 bug。
- 本機預覽：`.claude/launch.json` 平常只有 python 的 `euro-hop`（port 8765）一項；若為了測試暫時加別的設定，用完要改回只有 python 那一項。

## 目前進度（2026-10-08）

- v1.30.0 北歐篇（索爾、洛基、冥界、金字塔鑰匙、哥倫布戰艦、瑞士銀行、動物園、比利時扒手、埃及豔后、聖誕老人）已上線。
- v1.31.0 美洲篇（新大陸地圖：古巴、牙買加、墨西哥、巴拿馬、哥倫比亞、巴西魔王亞馬遜大蛇）已在 `nordic` 上做好，**還沒上線**，等使用者說「可以上線」。
  - 古巴、墨西哥是「往前衝的賽道關」（`js/race.js`，layout `'race'`）；墨西哥是緝毒追擊（從抓走私販的角度做，不出現毒品本身）。
  - 牙買加是手沖咖啡（Features `'pourover'`）。
- 芬蘭聖誕老人送的「聖誕禮物」只記在存檔（`Save.flag('gift')`），用途還沒開發。
