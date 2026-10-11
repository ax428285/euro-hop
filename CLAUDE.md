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
- v1.31.1（2026-10-09 已上線）：造船廠密技 +1000；斯庫拉 6 下、隨機出招（encounter.js 的 `srnd`）；葡萄牙、愛爾蘭國界線；密道拿掉咖啡色記號石板；法國、德國、波蘭、摩洛哥、牙買加（v1.31.5 加瑞典）的密道是「洞裡的密道」
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
- v1.31.2、v1.31.3（2026-10-09 已上線，`nordic:live`）：比利時扒手偷 50 枚（quests.js `PICK_COINS`）；首頁「怎麼玩」（game.js `TITLE_GUIDE`）更新成 8 條。
- v1.31.2 亞特蘭提斯海底城（region `abyss`，Levels.list 最後四關 A1～A4）：入口是歐洲地圖的亞特蘭提斯（`Quests.abyssOpen()` = `Save.flag('abyssGate')`：潛水關最底層的「海神的封印」解開了，abyss.js 的 riddle），出口是光之井（special `surface`）。
  珊瑚市集 `underwater`＋Features `jellies`、水晶宮 Features `beams`、海馬競技場 race 主題 `seahorse`、海神神殿克拉肯（pattern `sphinx`，kind `kraken`，觸手 = pillar.tentacle）。
  亞特蘭提斯在歐洲地圖上時有時無（encounter.js 的 `atlantisShown`，封印解開後一直在）；海底城全破後跟人魚說話 → `Save.flag('mermaid')`，pet.js 讓她跟在後面；
  中央廣場的珊瑚貝殼屋（shop.js seller `shellHouse`）賣 Thalassa 的衣服。魔王關沒有 NPC 了（bossLevel 的 npcs 是空的）。
  海底城地圖不生海上怪物；測試 `tests/abyss-check.js` 的 `runAbyssCheck`。海神夥伴改成安提基特拉沉船拿。
  測試檔用 script 標籤載入有時會拿到舊的，改用 fetch（cache: reload）＋ eval 載入比較保險。
- v1.31.2 遠征圖鑑（原名冒險紀錄；game.js scene `journal`、`journalPages()`，鍵 L，☰ 選單按鈕）：兩頁＝主線關卡（照 region 分組）、支線與收集（地圖上的冒險從 Encounter.KINDS 自動列）。
  **新增遊戲內容（地點、劇情、收集）後要記得更新 journalPages()。**
- v1.31.2 撒哈拉沙漠（quests.js SPOTS `Q_sahara`，expedition.js `K.sahara`、minigame `desert`）：沒有終點，待滿 `DESERT_T`（5 分鐘）綠洲才出現在前面、走進去過關。測試 `tests/sahara-check.js` 的 `runSaharaCheck`。
- 珊瑚貝殼屋只賣 Thalassa 的衣服（人魚、雅典娜時裝 v1.31.3 都拿掉了，不要再加回海底的時裝）。人魚 Thalassa 照使用者給的範例圖畫：灰棕長髮、珍珠頭飾、魚鰭耳朵、白貝殼上衣、藍銀魚尾、提燈籠（pet.js `chibiMer`、quests.js 頭像）。
- 海底城大地圖（abyss.js `PALETTE`）是半透明的水晶感，不要用綠色。
- 大地圖的曲子：game.js `mapTrack()`（歐洲 MAP、新大陸 AMMAP、海底城 SEAMAP，music.js）。
- Thalassa 的衣服：shop.js `MER_OUTFITS`（商品 `mer_<id>`，珊瑚貝殼屋），旗標 `merOutfit` = 穿第幾套（0 = 白貝殼上衣）；畫在 pet.js `chibiMer` 與 quests.js 頭像。
- v1.31.2 暗夜騎士（expedition.js `darkKnight`，`fixed`＋`knight`）：在法國國土裡走動，走路才碰得到；決鬥場是巴黎鐵塔的夜晚（`Sprites.skylines.KNT`）、沒有平台，
  魔王 pattern `'joust'`（entities.js：近 = 騎馬衝鋒、遠 = 劍氣 `makeSlash`＋`dark`；血 9）；機器人：22 件裝備打不贏、28 件全套打得贏。打贏 `Save.flag('godHand')` = 稱號「神之手」。
  測試 `tests/knight-check.js` 的 `runKnightCheck`（要先載入 traversal-bot.js）。
- v1.31.2 人魚的好感度（quests.js `merLove`）：海底城的「人魚的家」（Abyss.SPOTS `Q_merHome`，talk `merHome`，panel 畫架子）把紀念品送給她，旗標 `merGift_<id>`；
  好感度滿＋打倒暗夜騎士＋人魚同行，走到法國圖釘 → talk `eiffel`（夜景），看完 `Save.flag('merHuman')`，pet.js 改畫 `drawThalassa`（人類）。
- v1.31.2 稱號（game.js `titleText()`）：神之手（`godHand`，暗夜騎士）、比利時肥羊（quests.js 扒手被偷滿 `ROB_TITLE`=3 次，旗標 `robbedTimes`、`sheep`）。
  下一個版本的改動一樣先在 `nordic` 上做，等使用者說「可以上線」。
- v1.31.3：外觀商店（shop.js `toggleWear`、`wearing`）已擁有的時裝／狗狗配件再按一次 = 穿上／脫下（狗配件脫下 = 旗標 `dogOff_<配件>`）；遠征圖鑑的勾勾改成金色徽章（game.js `journalMark`）。
- v1.31.4（2026-10-09 已上線）：海底城的光之井游進去就回海面，不用按 Enter（game.js updateMap 的 `surfArmed`）。
- v1.31.5（2026-10-10 已上線，`nordic:live`）：不同部位的裝備同一種加成疊加（equipment.js：coinMul、magnet 相加，磁鐵上限 `MAGNET_MAX`）；古巴金幣避開大浪（topdown.js）；
  自動往前衝的關卡（autorun）出生點左邊的金幣不放（entities.js buildLevelState，level-check 會檢查）、磁鐵吸力加上玩家速度；瑞典雪橇起點平地 760（levelgen `startW`）、密道是 `secretKind: 'pit'`；雙人試煉不需要解鎖東歐篇；game.js `frame()` 先排下一帧、例外不會讓遊戲凍住（子畫面出錯直接回大地圖）。
- v1.31.6（2026-10-10 已上線）：首頁「怎麼玩」（game.js `TITLE_GUIDE`）的找裝備只說「有密道」，不要寫出隱形磚、洞這些找法。
- v1.31.7（2026-10-10 已上線）：戰艦在地圖上亂繞（expedition.js `wander`：歐洲範圍 `wanderBox`、離海岸 `WANDER_COAST` 內、避開北歐結界）；quest-check 的 C2 會檢查。
- v1.31.8（2026-10-10 已上線）：墨西哥賽道的「石頭」障礙換成紅色油桶（race.js kind `barrel`），風滾草畫得更明顯；電腦版選單快捷鍵 O（☰）、U（連線）、F11（main.js）；古巴（topdown.js）的坑洞、三角錐、水果攤車重畫，加紅色警示影子。
- v1.31.9（2026-10-10 已上線）：光之井的觸發範圍改成整片最上面（game.js updateMap：`sp.y < 光之井.y + 22`）。
- v1.31.10（2026-10-10 已上線）：首頁不再畫按鍵說明（跟 index.html 的 #hint 重複）；刪除存檔只能用 ☰ 選單的「刪除存檔」（點兩次），Delete 鍵拿掉了，說明不提 F2、刪除存檔；index.html #hint 只有鍵盤上的鍵用橘色（<strong>），其他字一般顏色；手機版畫面上的按鍵提示由 utils.js `U.touchText` 自動換成手機說法（所有 U.text 都會過），新加的提示文字照「Enter／Esc、Q 回地圖」這種寫法就會自動轉。
- v1.32.0（2026-10-11 已上線）咖啡與絲路：新大陸（region america）關卡的金幣是咖啡果實（game.js `cherryMode()`、`bankCoins` 存進 `Save.flag('cherries')`；Sprites.cherry、race.js、topdown.js 照它換畫法）；
  咖啡烘豆場（quests.js AM_SPOTS `Q_roastery`，talk `roastery`，`ROAST_COST` 2500 蓋、`ROAST_PER` 200 顆一箱）→ Trade 的 `coffee`（home null，只能賣）；
  絲路公主（SPOTS `Q_princess`，talk `princess`，`PRINCESS_NEED` 2 箱，公主不給「去哪裡弄」的提示）→ `Save.flag('silkRoad')`，地圖上的絲路變金色「已開通・亞洲篇製作中」。測試 `tests/coffee-check.js` 的 `runCoffeeCheck`。
- v1.32.1（2026-10-11 已上線）亞洲篇第一批：亞洲大地圖 `WorldMap.useWorld('as')`（`js/asia-geo.js` 由 `tools/build-asia-map.js` 產生，經度 43～143），region `asia`，Levels.list 第 39、40 關（IR 伊朗、UZ 烏茲別克）。
  - 進出：開通絲路（`Save.flag('silkRoad')`）後在歐洲地圖土耳其往東走到地圖邊緣（voyage.js `silkEast`）→ game.js `crossSilk`；亞洲地圖往西走到底（`silkWest`）回歐洲。亞洲地圖不生海上怪物，大地圖曲 ASMAP。
  - 亞洲關卡的金幣是蠶繭（game.js `HARVEST` 表：america = 咖啡果實、asia = 蠶繭 `Save.flag('cocoons')`；`Game.harvestKind()`、`Sprites.harvest`），之後的批次拿去絲綢工坊。
  - 亞洲的機關寫在 `js/silkroad.js`，用 `Features.register(type, {plan, init, update, draw, solid})` 掛進 features.js（不要再把新機關塞進 features.js）；美術在 `js/asia.js`。
  - 伊朗 `def.carpet`：整關坐飛毯（entities.js 物理同潛水、不用換氣），winds（熱氣流／下沉氣流）、minarets（宣禮塔）；烏茲別克 caravan（駱駝跟在後面，盜賊 `e.bandit` 撞到扣貨，3 次 = `caravanLost` 扣命）。
  - 亞洲的紀念品標 `asia: true`，人魚只收 `Souvenirs.merDefs()`（不含亞洲，好感度上限不變）。亞洲之謎（mystery.js）主題「字母走過的路」，`wip` 到八國齊。測試 `tests/asia-check.js` 的 `runAsiaCheck`。
- v1.33.0（還沒上線，在 nordic）亞洲篇第二批：Levels.list 第 41～44 關 IN 印度、NP 尼泊爾、CN 中國（gate easia）、MN 蒙古（race，gate easia）。
  - 新的外掛點（新內容寫在自己的檔案，不要再塞進大檔案）：Features.register（silkroad.js）、Race.registerTheme（steppe.js：蒙古騎馬射箭 theme `steppe`）、
    Encounter.registerMini（asiasea.js：亞洲海上冒險 spices／dragonboat／typhoon／★goldkoi）、Quests.registerNpc（asiaquest.js：玄奘、大雁塔、馬可波羅，地點 push 進 AS_SPOTS）。
  - 印度：坐騎 kind `elephant`（features.js 的 mount 照 `EXT['mount_' + kind]` 換畫法、respawn 走到玩家身邊）＋ barricades（只有騎大象撞得開）；尼泊爾 thinAir（p.o2、補給站、`hypoxia` 扣命）；
    中國 beacons（跳起來碰火盆、全點燃 beaconGate 才開）＋ volleys 箭雨；蒙古按 K 射箭靶，全中稱號「草原神射手」（flag archer）。
  - 亞洲 EXP：`Save.expAs`／`addExpAs`，Encounter REGIONS `easia`（pool 'as'，`EASIA_EXP` 300）；亞洲地圖的 EXP 條顯示亞洲 EXP。
  - 玄奘（那爛陀寺）→ flag `sutra` 1 → 大雁塔 → `sutra` 2、稱號「取經人」（flag pilgrim）＋150 亞洲 EXP＋€500；馬可波羅 flag `marco`。
  - 測試：asia-check 包含第二批；`runTraversalTest(only)` 可以只跑幾關（使用者：機器人只測新增的關卡）。
- v1.33.1（還沒上線，在 nordic）亞洲的海上更熱鬧：
  - 大地圖魔王（asiaboss.js，registerMini 的 `at` = 經緯度、def.boss）：roc 大鵬金翅鳥（阿拉伯海）、dragon 東海龍王（東海）、orochi 八岐大蛇（日本海，酒罈灌醉再踩）；Encounter.ensureBosses 在亞洲地圖時放這些＋東方艦隊。
  - 東方艦隊（expedition.js `ASIA_WARSHIPS`、`ensureAsia`、`wanderAsia`）：warDH 阿拉伯海盜船（dhow）、warZY 鄭一嫂紅旗號（junk）、warAT 鐵甲安宅船（atake），戰艦海戰、給亞洲 EXP。
  - 亂數的南海海盜船 `asPirates`（base pirates，艦砲對決）。稀有怪的提示照實際生出來的名字（亞洲是黃金錦鯉）。
- v1.33.2（還沒上線，在 nordic）亞洲的劇情（全部在 js/asiaquest.js，載入在 asiaboss.js 之後）：
  - 西天取經 flag `sutra`：0 → 玄奘委託 1 → 三個徒弟各一個小遊戲（xyWukong 三打白骨精、xyBajie 吃西瓜比賽、xyWujing 渡流沙河；收到 = Save.seaBossDown）→ 玄奘出發 2 → 火焰山 xyFlame 3 → 大雁塔 4（稱號 pilgrim、時裝 `wukong` 齊天大聖）。
  - 大汗的寶物 flag `marco`：0 → 馬可波羅跟著走 1 → 上都（要解鎖東亞）忽必烈委託 2 → 帶齊紀念品 minicarpet、masala、porcelain → 3（稱號 envoy）。
  - 對話的 end 可以回傳 `{ fight: kind }` 直接開小遊戲；小遊戲的 def 可以有 `winTalk`（打贏接對話）、`onWin()`、`loseNote`。地圖上跟著走的人：AsiaQuest.drawFollowers。
  - 時裝 `wukong`（costumes.js special、sprites.js costumeBody/Hat、voyage.js WALK_LOOK hat band）。
- v1.33.3（還沒上線，在 nordic）：
  - 泉州造船廠（AS_SPOTS `M_asYard`、shop.js seller `asYard`，商品 `aship_dhow/fuchuan/baochuan`）：買船，旗標 `asShip` = 開哪一艘（再按一次換船）。
  - 東方艦隊的海戰改成 js/navalwar.js 的 `naval`（俯瞰海面，←→ 轉舵、↑ 加速、K 兩側齊射；船的性能 NavalWar.SHIPS；歐洲造船廠的 cannon、hull 等級有加成）；沒船不能開戰；關卡 def `hidePlayer` 不畫平台主角。
  - 西遊記：收到的徒弟先回那爛陀寺（站在玄奘旁邊），只有護送途中（sutra 2～3）師徒四人才跟著走；馬可波羅只有 marco 1（護送去上都）時跟著走。
- v1.33.4（還沒上線）：AS_SPOTS 可以有 `gone()`（馬可波羅跟你走之後喀什的地點收起來）；entities.js 的丟在 `def.hidePlayer` 的關卡不作用（海戰按 J／K 不會丟出平台的子彈）。
- v1.33.5（還沒上線）：地圖上的「！」= 有事情可以做（quests.js 的 `todo(kind)`，歐洲、新大陸、海底城；亞洲的在 asiaquest.js 的 questMark）。新增劇情人物時要記得補 todo。亞洲地圖的國名貼近圖釘（worldmap.js placeOne：as 地圖 35px）；上都搬到 (120.0, 44.6)。
- v1.33.9（還沒上線）：印度一關一隻大象（mount_elephant 的 update：被打跑後 callElephant 從左邊畫面外走回來；barricade 推不動也會叫牠）。
- v1.33.7（還沒上線）：亞洲地圖畫萬里長城（huns.js 的 WALL、drawWall，由 worldmap.js 在 as 地圖呼叫）。
- v1.33.6（還沒上線）匈奴進攻（js/huns.js）：flag `huns` 0 → 亞洲關卡（不含東亞 gate easia）全破、人在亞洲地圖 → 1（talk hunsAlarm，長城守將）→ 三支騎兵隊 hun0～2（陸地上往長安走，registerMini 的 mapNear）
  長城保衛戰（踩騎兵下馬、衝過長城太多會輸）→ 全打退 → 2（hunsFlee）→ 歐洲喀爾巴阡山下的魔王 `attila`（沙隆平原之戰：小遊戲自己的弓、木盾牌擋平射的箭；def.noThrow）→ 3、稱號 hunbane。
  Encounter.registerEnsure(fn(monsters, world)) 每帧補地圖上的怪；game.js 地圖畫面每帧問 Huns.check()。v1.33.8 起觸發條件不含東亞；第三批的韓國、日本如果標 gate easia 也不算。
  - 之後：第三批 韓國、日本相撲魔王、絲綢工坊、亞洲服裝店、忍者在大地圖隨機出現（八岐大蛇已經在 v1.33.1 做了）。
- 芬蘭聖誕老人送的「聖誕禮物」只記在存檔（`Save.flag('gift')`），用途還沒開發。
