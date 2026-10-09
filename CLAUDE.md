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
- 三張大地圖：歐洲（`js/europe-geo.js`）、新大陸（`js/america-geo.js`）、亞特蘭提斯海底城（`js/abyss.js`，手畫的世界座標），用 `WorldMap.useWorld('eu'|'am'|'sea')` 切換。
  地理資料由 `tools/build-europe-map.js`、`tools/build-america-map.js` 從 `ne110m.json` 產生，不要手改產生出來的檔案。
- 劇情人物與委託在 `js/quests.js`、`js/expedition.js`；美洲篇的美術在 `js/america.js`。
- 行尾：`levels.js`、`entities.js`、`sprites.js`、`levelgen.js`、`save.js`、`shaft.js`、`worldmap.js` 和部分測試是 **CRLF**，改檔時要保留原本的行尾。

## 測試

- 測試都在 `tests/*.js`，要在瀏覽器裡跑：開本機預覽後，把測試檔用 `<script>` 載入，執行 `runXxxCheck()`（例如 `runAmericaCheck()`、`runRaceCheck()`、`runQuestCheck()`），還有 `runTraversalTest()`、`runBossTest()`、`runBossFightTest()`。
- `runTouchCheck()` 要在手機尺寸下跑（需要先載入 `terrain-util.js`、`menu-check.js`）。
- 已知：`runBossFightTest()` 的義大利、羅馬尼亞打不贏是機器人的老限制，不是 bug。
- 本機預覽：`.claude/launch.json` 平常只有 python 的 `euro-hop`（port 8765）一項；若為了測試暫時加別的設定，用完要改回只有 python 那一項。

## 目前進度（2026-10-09）

- v1.30.0 北歐篇（索爾、洛基、冥界、金字塔鑰匙、哥倫布戰艦、瑞士銀行、動物園、比利時扒手、埃及豔后、聖誕老人）已上線。
- v1.31.0 美洲篇（新大陸地圖：古巴、牙買加、墨西哥、巴拿馬、哥倫比亞、巴西魔王巨人守門員）＋塞爾維亞滑雪、保加利亞羽球、紀念品、外觀商店、地圖全開密技，2026-10-09 已上線（`nordic:live`）。
  下一個版本的改動一樣先在 `nordic` 上做，等使用者說「可以上線」。
- v1.31.1（2026-10-09 已上線）：造船廠密技 +1000；斯庫拉 6 下、隨機出招（encounter.js 的 `srnd`）；葡萄牙、愛爾蘭國界線；密道拿掉咖啡色記號石板；法國、德國、波蘭、摩洛哥、牙買加的密道是「洞裡的密道」
  （levels.js `secretKind: 'pit'`：挑一個斷崖不放尖刺，掉進去 = game.js 的 `pitcave` 洞窟畫面，拿完東西從 `exit` 爬上來；測試 `runPitCaveCheck`）。
  - 古巴、墨西哥是「往前衝的賽道關」（`js/race.js`，layout `'race'`）；墨西哥是緝毒追擊（從抓走私販的角度做，不出現毒品本身）。
  - 牙買加是手沖咖啡（Features `'pourover'`）。
  - 古巴是「上帝視角」賽車（`js/topdown.js`，`def.race.view === 'top'`，由 race.js 轉發）；墨西哥還是往前衝的 3D 賽道。
  - 新大陸的海上怪（encounter.js）四種都是自己的玩法，不跟歐洲重複：piranhas（抓食人魚）、buccaneers（踢火藥桶）、dolphins（踩海豚摘星星）、goldturtle（追浪海龜）
    給「美洲 EXP」（Save.expAm，跟歐洲的 EXP 分開）；累積 Encounter.SOUTH_EXP 解鎖南美（關卡標 `gate: 'samerica'`：哥倫比亞、巴西）。
  - 巴西魔王是踢足球（entities.js 的 pattern `'soccer'`：進球才扣血，踩頭沒用）；測試用 `runSoccerBot`（tests/traversal-bot.js）。
    原本的亞馬遜大蛇 Boiúna（pattern `'boiuna'`）程式還留著，目前沒有關卡用。
  - 美洲篇不給裝備（Equipment 只到冰島，28 件），改給紀念品（`js/souvenirs.js`、`Save.souvenirs`）：放在原本裝備的位置，走同一條 `state.equip`（`souvenir: true`）。
  - 只賣外觀的店（shop.js `kind: 'look'`）：聖胡安服裝店（seller `boutique`，時裝；擁有看 `Save.costumes`）、千里達寵物用品店（`petshop`，狗的配件 `Shop.dogAccs()`，要先收養狗）。地點在 quests.js 的 `AM_SPOTS`。
  - 瑞士銀行：歐洲任意 `Quests.BANK_NEED`（10）國金幣收滿就能開戶。
- 塞爾維亞（滑雪，`js/ski.js`，view `'ski'`）、保加利亞（羽球，`js/badminton.js`，view `'badminton'`）也是 layout `'race'`，由 race.js 轉發；測試是 race-check 的 `runRemakeCheck`。
  舊存檔破過這兩關的會在讀檔時變回還沒破（game.js `remakeReset`，旗標 `remake131`，每個存檔只做一次）。
- v1.31.2（2026-10-09 已上線，`nordic:live`）：比利時扒手偷 50 枚（quests.js `PICK_COINS`）；首頁「怎麼玩」（game.js `TITLE_GUIDE`）更新成 8 條。
- v1.31.2 亞特蘭提斯海底城（region `abyss`，Levels.list 最後四關 A1～A4）：入口是歐洲地圖的亞特蘭提斯（`Quests.abyssOpen()` = `Save.flag('abyssGate')`：潛水關最底層的「海神的封印」解開了，abyss.js 的 riddle），出口是光之井（special `surface`）。
  珊瑚市集 `underwater`＋Features `jellies`、水晶宮 Features `beams`、海馬競技場 race 主題 `seahorse`、海神神殿克拉肯（pattern `sphinx`，kind `kraken`，觸手 = pillar.tentacle）。
  亞特蘭提斯在歐洲地圖上時有時無（encounter.js 的 `atlantisShown`，封印解開後一直在）；海底城全破後跟人魚說話 → `Save.flag('mermaid')`，pet.js 讓她跟在後面；
  中央廣場的珊瑚貝殼屋（shop.js seller `shellHouse`）賣人魚、海神時裝（Costumes `mermaid`、`athena`，special）。魔王關沒有 NPC 了（bossLevel 的 npcs 是空的）。
  海底城地圖不生海上怪物；測試 `tests/abyss-check.js` 的 `runAbyssCheck`。海神夥伴改成安提基特拉沉船拿。
  測試檔用 script 標籤載入有時會拿到舊的，改用 fetch（cache: reload）＋ eval 載入比較保險。
- v1.31.2 遠征圖鑑（原名冒險紀錄；game.js scene `journal`、`journalPages()`，鍵 L，☰ 選單按鈕）：兩頁＝主線關卡（照 region 分組）、支線與收集（地圖上的冒險從 Encounter.KINDS 自動列）。
  **新增遊戲內容（地點、劇情、收集）後要記得更新 journalPages()。**
- v1.31.2 撒哈拉沙漠（quests.js SPOTS `Q_sahara`，expedition.js `K.sahara`、minigame `desert`）：沒有終點，待滿 `DESERT_T`（5 分鐘）綠洲才出現在前面、走進去過關。測試 `tests/sahara-check.js` 的 `runSaharaCheck`。
- 珊瑚貝殼屋的時裝是人魚（`mermaid`：魚尾巴取代雙腳）和雅典娜（`athena`，取代原本的波賽頓）。人魚的畫法照使用者給的範例圖（Q 版、粉紅長髮、青綠魚尾；pet.js `chibiMer`、quests.js 頭像）。
- v1.31.2 暗夜騎士（expedition.js `darkKnight`，`fixed`＋`knight`）：在法國國土裡走動，走路才碰得到；決鬥場是巴黎鐵塔的夜晚（`Sprites.skylines.KNT`）、沒有平台，
  魔王 pattern `'joust'`（entities.js：近 = 騎馬衝鋒、遠 = 劍氣 `makeSlash`＋`dark`；血 9）；機器人：22 件裝備打不贏、28 件全套打得贏。打贏 `Save.flag('godHand')` = 稱號「神之手」。
  測試 `tests/knight-check.js` 的 `runKnightCheck`（要先載入 traversal-bot.js）。
- v1.31.2 人魚的好感度（quests.js `merLove`）：海底城的「人魚的家」（Abyss.SPOTS `Q_merHome`，talk `merHome`，panel 畫架子）把紀念品送給她，旗標 `merGift_<id>`；
  好感度滿＋打倒暗夜騎士＋人魚同行，走到法國圖釘 → talk `eiffel`（夜景），看完 `Save.flag('merHuman')`，pet.js 改畫 `drawThalassa`（人類）。
- v1.31.2 稱號（game.js `titleText()`）：神之手（`godHand`，暗夜騎士）、比利時肥羊（quests.js 扒手被偷滿 `ROB_TITLE`=3 次，旗標 `robbedTimes`、`sheep`）。
  下一個版本的改動一樣先在 `nordic` 上做，等使用者說「可以上線」。
- 芬蘭聖誕老人送的「聖誕禮物」只記在存檔（`Save.flag('gift')`），用途還沒開發。
