'use strict';

/** 主遊戲：狀態機 + 渲染 */
const Game = (function () {
  const W = 960, H = 480;

  let ctx = null;
  let t = 0;
  let scene = 'title';   // title | map | inventory | saveinfo | play | paused | clear | dead | win
  let state = null;
  let levelIndex = 0;
  let cursor = 0;
  /*
   * 命數。
   *
   * 兩人同機時每位玩家有自己的命 —— 共用一條命會變成
   * 「一個人亂玩害死另一個」，玩起來很糟。
   * lives 陣列的索引對應 state.players。
   * 單人時只用 lives[0]，所以既有邏輯只要改成讀陣列即可。
   */
  let lives = [3, 3];
  let maxLives = 3;
  let coop = false;          // 兩人同機模式
  let downed = [false, false];   // 這一關已經沒命的玩家（等隊友過關）
  let runScore = 0;      // 本關累積分數（進關歸零）
  let runCoins = 0;      // 本關撿到的金幣數（過關/死亡時入帳到錢包）
  let coinsBanked = 0;   // 剛入帳的金幣數（過關/死亡畫面顯示用）
  let stats = null;
  let shopBonus = Shop.resolve();   // 商店強化的加成（買完要重算）
  let sceneTimer = 0;
  let camX = 0;
  // 垂直關卡用：相機也要跟著 y 移動。
  // 橫向關卡的 def.camLockY 為 true，camY 固定 0，行為跟以前完全一樣。
  let camY = 0;
  let shake = 0;
  let toast = null;      // 拿到裝備時的提示 { text, sub, life }
  let newEquip = null;   // 過關畫面要展示的新裝備
  let confirmWipe = false;   // 清除存檔的二次確認
  let shopCursor = 0;        // 商店選到第幾項
  let shopMsg = null;        // 商店的提示訊息 { text, color, life }
  // 貿易港（v1.27）：哪一港、哪一頁（0 交易 / 1 懸賞）、游標（列 -1 = 分頁列；交易頁 col 0 買 / 1 賣）
  let mkPort = null, mkTab = 0, mkRow = 0, mkCol = 0, mkMsg = null, mkAbandon = false;
  let bountyNote = null;     // 懸賞完成／失敗的提示，回到地圖時顯示
  let deadNote = null;       // 打輸時額外的一句話（海盜搶走一箱貨⋯⋯）
  // v1.30 劇情對話（quests.js）：正在講的那一段 { who, lines, i, t, end, panel }；回到地圖時要接著打開的對話
  let talk = null;
  let pendingTalk = null;
  let blockedToastT = 0;     // 撞到北歐結界的提示：不要每帧都跳
  let yardCursor = 0;        // 造船廠選到第幾列（v1.26）
  let yardPaint = 0;         // 油漆列選到第幾色
  let yardMsg = null;
  let shopSeller = 'portugal';   // 正在跟誰買（葡萄牙商店 / 神祕商人 id，見 Shop.SELLERS）
  let invCursor = 0;         // 裝備畫面選到第幾件（-1 = 最上面的時裝列）
  let invCol = 0;            // 最後停在哪個子欄（從時裝列往下時回到這欄）
  let invMsg = null;         // 裝備畫面的提示 { text, color, life }
  // 海上遭遇戰：正在打哪一隻（null = 一般關卡）、開打前船的位置、這場拿到的 EXP
  let skirmish = null;
  let shipBack = null;
  let expResult = null;      // { gain, before, after }
  // 世界之謎：這一關新拿到的線索、線索剛到齊等著揭曉的洲、謎畫面的游標與「看謎底」模式
  let newClue = null;        // { clue, cont, progress, completed }
  let pendingReveal = null;  // 洲 id
  let mysteryCursor = 0;
  let mysteryReveal = false;
  let mysteryCont = 'europe'; // 謎畫面正在看哪個洲
  let mysOther = -1;          // 選到下方第幾個「其他大陸」格子（-1 = 在線索格裡）

  // ── 場景切換 ──────────────────────────────────────────

  function startLevel(i) {
    const sv = Save.get();
    levelIndex = i;
    skirmish = null;
    shipBack = null;
    // 商店強化先算。注意 Equipment.resolve 內部已經會疊 Shop.resolve()，
    // 這裡留一份是給 UI 顯示用，計分不要再乘一次（會重複計算）。
    shopBonus = Shop.resolve();
    stats = Equipment.resolve(Save.wornIds());
    maxLives = stats.maxLives;
    lives = [maxLives, maxLives];
    downed = [false, false];
    runScore = 0;
    runCoins = 0;
    newEquip = null;
    newClue = null;
    toast = null;
    const def = Levels.list[i];
    // 交通關一進來先講玩法（toast 在 const VEHICLE_INTRO 的說明）
    if (def.vehicle && VEHICLE_INTRO[def.vehicle]) {
      const vi = VEHICLE_INTRO[def.vehicle];
      toast = { text: vi[0], sub: vi[1], life: 260 };
    }
    if ((def.layout === 'race' || !def.isBoss && def.layout !== 'shaft') && def.intro) toast = { text: def.intro[0], sub: def.intro[1], life: 300 };
    if (def.autorun) {
      toast = def.ride === 'car'
        ? { text: '坐上古巴老爺車！', sub: '車子會自己往前開、停不下來 —— 只要按跳躍・海堤後面捲起浪頭就準備跳', life: 280 }
        : { text: '坐上馴鹿雪橇！', sub: '雪橇會自己往前衝、停不下來 —— 只要按跳躍・冰面上會越滑越快', life: 280 };
    }
    state = buildLevelState(def, i, sv.equipment, stats, coop);
    // 海神夥伴（消耗品）：有的話魔王關自動出戰，第一次出手才扣掉一個（還沒出手就輸了不算）
    if (def.isBoss && Save.get().allies > 0) {
      state.ally = { x: def.spawnX - 30, y: Levels.GROUND_Y - 110, throws: ALLY_THROWS, used: false, wait: 0, shot: null, cool: false };
      toast = { text: '海神夥伴出戰！', sub: '魔王倒地露出破綻時，牠會丟三叉戟幫你打（這場最多 ' + ALLY_THROWS + ' 下）', life: 220 };
    }
    camX = 0;
    /*
     * 豎井關的相機起點由 Shaft 決定。
     * climb 的樓層往上長（世界座標大→小），相機不能從 0 開始 ——
     * 那會讓玩家出生在畫面外很下面的地方，整個畫面空白。
     */
    camY = def.layout === 'shaft' ? Shaft.camStart(def.shaft, H) : 0;
    if (state.shaft) state.shaft.camY = camY;
    scene = 'play';
    sceneTimer = 0;
    Music.playForLevel(i);
    netLevelStarted();
  }

  /**
   * 海上遭遇戰：跟一般關卡共用整套關卡流程（物理、HUD、扣命、過關畫面），
   * 只是關卡定義由 Encounter 臨時產生，levelIndex = -1（不屬於任何國家）。
   */
  function startSkirmish(m) {
    const sv = Save.get();
    shipBack = Voyage.shipPos();
    shopBonus = Shop.resolve();
    stats = Equipment.resolve(Save.wornIds());
    maxLives = stats.maxLives;
    lives = [maxLives, maxLives];
    downed = [false, false];
    runScore = 0;
    runCoins = 0;
    newEquip = null;
    newClue = null;
    expResult = null;
    levelIndex = -1;
    skirmish = m;
    // 造船廠的加厚船身（v1.26）：海上遭遇戰多幾顆愛心（潛水是人下水，不算）
    if (!m.def.dive && !m.def.duo && !m.def.quest && typeof Shipyard !== 'undefined') {
      maxLives = Math.min(Equipment.MAX_LIVES, maxLives + Shipyard.hullBonus(Save.ship()));
      lives = [maxLives, maxLives];
    }
    // 雙人試煉：二段跳、蹬牆跳、滑翔、跳躍強化封印（不然一個人就上得了高台，見 duo.js）
    if (m.def.duo) stats = Duo.seal(stats);
    const def = Encounter.makeDef(m, stats);
    state = buildLevelState(def, -1, sv.equipment, stats, coop);
    camX = 0;
    // 亞特蘭提斯是往下潛的豎井關：相機起點跟一般豎井一樣由 Shaft 決定
    camY = def.layout === 'shaft' ? Shaft.camStart(def.shaft, H) : 0;
    if (state.shaft) state.shaft.camY = camY;
    scene = 'play';
    sceneTimer = 0;
    toast = { text: m.def.say || m.def.name + '・' + m.def.game, sub: m.def.goal, life: m.def.say ? 300 : 170 };
    Music.playTrack(skirmishTrack(m.def));
    netLevelStarted();
  }

  /** 遭遇戰的配樂：潛水用亞特蘭提斯的、雙人試煉借附近國家的（KINDS.track），其他是海戰 */
  function skirmishTrack(k) {
    return k.track || (k.dive ? 'ATL' : 'BATTLE');
  }

  /**
   * 峽灣的黃金獵犬（v1.29，pet.js）：船艙有臘腸就餵一根（扣一箱），牠就變成寵物跟著你。
   * 沒有臘腸：牠只會聞一聞你，提示去熱那亞的貿易港買。
   */
  function greetDog() {
    if (Pet.adopted()) return;
    if (!(Save.get().cargo.sausage > 0)) {
      Sfx.select();
      // v1.30 玩家：食物要講得隱晦一點（臘腸、熱那亞都不直接說）
      toast = { text: '黃金獵犬一直往你的背包裡嗅，搖搖尾巴⋯⋯', sub: '牠想要一條一條、香噴噴的肉 —— 哥倫布出生的那座港城，好像飄著這個味道', life: 240 };
      return;
    }
    Save.moveCargo('sausage', -1, 0);
    Save.setPet('dog');
    const sp = Voyage.shipPos();
    Pet.snap(sp.x, sp.y);
    Sfx.equip();
    toast = { text: '黃金獵犬吃了臘腸，決定跟著你！', sub: '從今天起牠是你的夥伴，走到哪跟到哪（開船時牠會游在後面）', life: 260 };
  }

  /** 雙人試煉：場上有兩位玩家才進得去（同機 C 鍵，或連線時朋友當 2P） */
  function tryStartDuo(spNear) {
    const k = Encounter.KINDS[spNear.def.port];
    // v1.31.4 玩家反映：雙人關卡不需要任何前置條件就能挑戰 → 跟土耳其旁邊的東歐篇一起解鎖（海上冒險 EXP 夠了才開）
    if (!regionUnlocked('east')) {
      Sfx.clang();
      toast = { text: k.name + '還沒開放', sub: '要先解鎖東歐篇（打海上怪物累積 EXP：' + Save.get().exp + ' / ' + Encounter.regionOf('east').exp + '）', life: 220 };
      return;
    }
    if (!coop) {
      Sfx.clang();
      // 手機沒有鍵盤（按不了 C）：只提示連線
      const touch = document.documentElement.classList.contains('touch');
      toast = { text: k.name + '需要兩位玩家',
                sub: touch ? '點左上角 ☰ 選單的「連線」，找朋友當 2P 一起闖'
                           : '按 C 開啟兩人同機（2P 用 WASD＋G），或用「連線遊玩」找朋友當 2P', life: 260 };
      return;
    }
    Sfx.select();
    const ship0 = Voyage.shipPos();
    startSkirmish({ kind: spNear.def.port, def: k, x: ship0.x, y: ship0.y, port: true });
  }

  function toMap() {
    scene = 'map';
    // 關卡裡在畫面上點的那幾下不能帶到地圖：不然回地圖第一帧就被當成「點國家」，船被傳走
    // （v1.27.2 玩家：放棄關卡回大地圖後人物不在原本關卡上）
    Input.clearClick();
    // 連線：離開關卡了，下一關開始時再整份重傳（朋友那邊會收到 'wait' 回等待畫面）
    net.levelLive = false;
    cursor = U.clamp(cursor, 0, Save.get().unlocked - 1);
    // v1.31：回到「這一國所在的那張地圖」（美洲篇的國家在新大陸地圖上）。打完遭遇戰回來（shipBack）不換。
    if (!shipBack) worldFor(cursor);
    sceneTimer = 0;
    // 從關卡或海戰回來 = 過了一天（貿易行情、懸賞跟著換）
    if (state) Save.nextDay();
    if (shipBack) {
      // 打完遭遇戰：船回到開打的地方，不要瞬移回港口
      // 卡律布狄斯：開打的地方就在漩渦眼上 → 甩到漩渦外面，而且一陣子不吸，不然一回來又被吸進去
      // （v1.30 冥界：從卡律布狄斯沉下去的，回來也是同一個漩渦旁邊）
      if (skirmish && (skirmish.kind === 'charybdis' || skirmish.kind === 'hel')) {
        const ang = Math.atan2(shipBack.y - skirmish.y, shipBack.x - skirmish.x) || -Math.PI / 2;
        shipBack = { x: skirmish.x + Math.cos(ang) * 95, y: skirmish.y + Math.sin(ang) * 95 };
        Encounter.calmVortex(420);
      }
      Voyage.placeShip(shipBack.x, shipBack.y);
      shipBack = null;
    } else {
      // 船停在剛才那一國的港口外，回地圖時位置才連貫
      Voyage.reset(cursor);
    }
    const sp = Voyage.shipPos();
    WorldMap.follow(sp.x, sp.y, true);
    skirmish = null;
    toast = null;      // 關卡裡的提示（「第 3/3 波」之類）不要帶到地圖上
    if (bountyNote) { toast = bountyNote; bountyNote = null; }
    if (!toast) toast = abyssNotice();
    // 地圖有自己的曲子（從關卡回來就換曲；從商店回來則一路接著播）
    Music.playTrack(mapTrack());
    // 剛湊齊一整個洲的線索：先揭曉謎底（看完按返回就是地圖，船已經擺好了）
    if (pendingReveal) openMystery(pendingReveal, true);
    // v1.30：冥界最底下的洛基
    else if (pendingTalk) { const w = pendingTalk; pendingTalk = null; openTalk(w); }
  }

  // ── 兩張地圖（v1.31 美洲篇）──────────────────────────
  // 歐洲地圖往西開到底 → 新大陸；新大陸往東開到底 → 回歐洲。兩邊各記得上次停在哪一國（cursor）。
  const lastCursor = { eu: 0, am: -1, sea: -1 };
  let crossToastT = 0;
  function worldOfLevel(i) {
    const r = Levels.list[i] && Levels.list[i].region;
    return r === 'america' ? 'am' : r === 'abyss' ? 'sea' : 'eu';      // v1.31.2 海底城的四區在 'sea' 地圖
  }
  /** 大地圖的曲子（v1.31.3）：歐洲 = 航海的 MAP、新大陸 = 卡利普索 AMMAP、海底城 = SEAMAP */
  function mapTrack() { const w = WorldMap.world(); return w === 'sea' ? 'SEAMAP' : w === 'am' ? 'AMMAP' : 'MAP'; }
  function switchWorld(id) {
    if (WorldMap.world() !== id) lastCursor[WorldMap.world()] = cursor;
    if (!WorldMap.useWorld(id)) return false;
    Voyage.rebuild();
    Encounter.clear();          // 海上的怪是在另一張地圖上生的
    if (mapLike(scene)) Music.playTrack(mapTrack());   // 潛進海底城／浮回海面：換曲
    return true;
  }
  /** 地圖切到第 i 關所在的那一張 */
  function worldFor(i) { switchWorld(worldOfLevel(i)); }
  /** 船開到地圖邊緣：to = 'am'（往西到新大陸）／'eu'（往東回歐洲） */
  function crossAtlantic(to) {
    switchWorld(to);
    // 入口：新大陸在小安地列斯群島東邊的大西洋；歐洲在加那利群島西北的大西洋
    const p = to === 'am' ? WorldMap.project(-31.2, 15) : WorldMap.project(-25.6, 31);
    let at = null;
    for (let r = 0; r <= 200 && !at; r += 8) {
      for (let k = 0; k < 16 && !at; k++) {
        const a = k * Math.PI / 8, x = p[0] + Math.cos(a) * r, y = p[1] + Math.sin(a) * r;
        if (Voyage.isNavigable(x, y)) at = { x: x, y: y };
        if (r === 0) break;
      }
    }
    at = at || { x: p[0], y: p[1] };
    Voyage.placeShip(at.x, at.y);
    WorldMap.follow(at.x, at.y, true);
    const firstAm = Levels.list.findIndex(function (lv) { return lv.region === 'america'; });
    cursor = to === 'am' ? (lastCursor.am >= 0 ? lastCursor.am : firstAm) : lastCursor.eu;
    Sfx.fanfare();
    toast = to === 'am'
      ? { text: '橫越大西洋，抵達新大陸！', sub: '1492 年哥倫布也是這樣一路往西開・往東開到地圖最東邊就回歐洲', life: 280 }
      : { text: '回到歐洲', sub: '想再去新大陸：往西開到地圖最西邊', life: 200 };
  }

  /*
   * v1.31.2 亞特蘭提斯海底城：歐洲地圖的亞特蘭提斯（第一次潛到神殿之後）按 Enter 潛下去；
   * 海底城最上面的「光之井」游進去（v1.31.3 起不用按 Enter），回到歐洲的亞特蘭提斯旁邊。
   */
  /*
   * v1.31.2 玩家：亞特蘭提斯破完後要讓玩家明顯知道多了海底城（有人先破關過了）→ 回大地圖時各講一次：
   *   潛過神殿、封印還沒解開 → 提示「再潛一次」；封印解開、還沒進去過 → 提示「海底城開放了」
   */
  function abyssNotice() {
    if (!Save.seaBossDown('atlantis')) return null;
    if (!Quests.abyssOpen()) {
      if (Save.flag('abyssHint')) return null;
      Save.setFlag('abyssHint', 1);
      return { text: '亞特蘭提斯有新東西了！', sub: '神殿深處的大門有一道封印 —— 再潛一次，記住牆上的三幅壁畫（亞特蘭提斯不時會沉下去，等一下就浮上來）', life: 400 };
    }
    // 海底城四區全破、還沒帶人魚走 → 提醒回廣場找她（講一次）
    const ab = Levels.list.map(function (l, i) { return { l: l, i: i }; }).filter(function (o) { return o.l.region === 'abyss'; });
    if (ab.length && ab.every(function (o) { return Save.isCleared(o.i); }) && !Save.flag('mermaid') && !Save.flag('mermaidCall')) {
      Save.setFlag('mermaidCall', 1);
      return { text: '亞特蘭提斯海底城全部破完了！', sub: '中央廣場的人魚 Thalassa 好像有話想跟你說', life: 320 };
    }
    if (Save.flag('abyssVisited') || Save.flag('abyssNews')) return null;
    Save.setFlag('abyssNews', 1);
    return { text: '亞特蘭提斯海底城開放了！', sub: '到大西洋上的亞特蘭提斯（金色的光渦）按 Enter 潛下去', life: 360 };
  }

  function enterAbyss() {
    Save.setFlag('abyssVisited', 1);
    switchWorld('sea');
    const sp = Abyss.SPOTS.filter(function (q) { return q.surface; })[0];
    Voyage.placeShip(sp.x, sp.y + 40);
    WorldMap.follow(sp.x, sp.y + 40, true);
    const first = Levels.list.findIndex(function (lv) { return lv.region === 'abyss'; });
    cursor = lastCursor.sea >= 0 ? lastCursor.sea : first;
    Sfx.fanfare();
    toast = { text: '潛進了亞特蘭提斯海底城！', sub: '去中央廣場找人魚 Thalassa 說話・想回海面就游進最上面的光之井', life: 280 };
  }
  function leaveAbyss() {
    switchWorld('eu');
    const atl = Encounter.monsters().filter(function (m) { return m.kind === 'atlantis'; })[0];
    const p = atl ? [atl.x, atl.y] : EuropeWorld.project(-9.4, 33.4);
    let at = null;
    for (let r = 40; r <= 200 && !at; r += 8) {
      for (let k = 0; k < 16 && !at; k++) {
        const a = k * Math.PI / 8, x = p[0] + Math.cos(a) * r, y = p[1] + Math.sin(a) * r;
        if (Voyage.isNavigable(x, y)) at = { x: x, y: y };
      }
    }
    at = at || { x: p[0], y: p[1] + 40 };
    Voyage.placeShip(at.x, at.y);
    WorldMap.follow(at.x, at.y, true);
    cursor = lastCursor.eu;
    Sfx.select();
    toast = { text: '回到海面了', sub: '想再去海底城：到亞特蘭提斯按 Enter 潛下去', life: 200 };
  }

  // ── 劇情對話（v1.30，quests.js）────────────────────────

  function openTalk(who) {
    const tk = Quests.talk(who);
    if (!tk || !tk.lines.length) return;
    talk = tk; talk.i = 0; talk.t = 0;
    scene = 'talk';
    Sfx.talk();
  }

  function updateTalk() {
    if (!talk) { scene = 'map'; return; }
    talk.t++;
    const click = Input.takeClick();
    if (talk.t > 10 && (Input.once('confirm') || Input.once('jump') || click)) {
      talk.i++; talk.t = 0;
      if (talk.i >= talk.lines.length) { finishTalk(); return; }
      Sfx.talk();
    }
    if (Input.once('back')) finishTalk();
  }

  function finishTalk() {
    const tk = talk;
    talk = null;
    scene = 'map';
    // complete：有沒有把每一句都看完（中途按 Esc 離開 = false；埃及豔后只有看完才付錢）
    const r = tk && tk.end ? tk.end(tk.i >= tk.lines.length) : null;
    if (!r) return;
    if (r.sfx && Sfx[r.sfx]) Sfx[r.sfx]();
    if (r.shake) shake = r.shake;
    if (r.toast) toast = r.toast;
  }

  function drawTalk() {
    const sv = Save.get();
    drawMapBackdrop(sv);
    ctx.fillStyle = 'rgba(8,12,24,0.55)';
    ctx.fillRect(0, 0, W, H);
    if (!talk) return;
    if (talk.panel) Quests.drawPanel(ctx, talk.panel, W, t, talk);
    const line = talk.lines[Math.min(talk.i, talk.lines.length - 1)];
    const top = H - 168;
    panel(40, top, W - 80, 140);
    // 頭像
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    U.roundRect(ctx, 58, top + 16, 108, 108, 12); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.rect(58, top + 16, 108, 108); ctx.clip();
    Quests.portrait(ctx, line.who, 112, top + 70, t);
    ctx.restore();
    U.text(ctx, Quests.NAMES[line.who] || '', 112, top + 136, { size: 13, color: '#ffd166' });
    // 台詞（逐字打出來）
    const shown = line.text.slice(0, Math.max(1, Math.floor(talk.t * 1.6)));
    const rows = wrapText(shown, W - 300, 18);
    rows.slice(0, 3).forEach(function (s, k) {
      U.text(ctx, s, 190, top + 36 + k * 30, { size: 18, color: line.who === 'me' ? '#bfe3ff' : '#ffffff', align: 'left' });
    });
    U.text(ctx, (talk.i + 1) + ' / ' + talk.lines.length, W - 64, top + 18, { size: 12, color: '#7d88a6', align: 'right' });
    if (Math.floor(t / 28) % 2 === 0) {
      U.text(ctx, talk.i + 1 < talk.lines.length ? '▼ Enter／點一下 繼續' : '▼ Enter 結束', W - 64, top + 120, { size: 12, color: '#c6d2e8', align: 'right' });
    }
  }

  /** 丹麥積木塔（v1.30 蓄力跳）的蓄力條：頭上一條會變長的條，夠高（綠）、蓄滿閃白；sx = 玩家左緣的畫面 x */
  function drawChargeBar(p, sx) {
    if (!(p.charge > 0) || p.out) return;
    const k = Math.min(1, p.charge / PHYS.CHARGE_MAX);
    const bx = sx + p.w / 2 - 20, by = p.y - 16;
    ctx.fillStyle = 'rgba(10, 14, 26, 0.75)'; U.roundRect(ctx, bx - 2, by - 2, 44, 9, 4); ctx.fill();
    ctx.fillStyle = k >= 1 && Math.floor(t / 4) % 2 === 0 ? '#ffffff' : k > 0.7 ? '#8fe3a0' : '#ffd166';
    U.roundRect(ctx, bx, by, Math.max(4, 40 * k), 5, 3); ctx.fill();
  }

  /** 從地圖直接開始的探險（金字塔；冥界從卡律布狄斯接過去） */
  function startQuestLevel(kind, at) {
    startSkirmish(Expedition.questMonster(kind, at || Voyage.shipPos()));
  }

  /*
   * v1.30：卡律布狄斯的漩渦逃生裡掉進中間的漩渦眼（還沒救出洛基時）→ 不是被甩回來，
   * 而是被漩渦吞到底、沉進冥界赫爾海姆（雷神索爾謎語裡「吞下船的嘴」）。玩家：掉下去就可以了，不用到沒血。
   */
  function startHel() {
    const at = { x: skirmish.x, y: skirmish.y };
    Music.stop();
    Sfx.bossRoar();
    startQuestLevel('hel', at);
    shipBack = at;
    toast = { text: '被漩渦吞下去了⋯⋯', sub: '一路往下沉、往下沉 —— 這裡是哪裡？', life: 220 };
  }

  // ── 世界之謎 ──────────────────────────────────────────

  function openMystery(contId, reveal) {
    pendingReveal = null;
    scene = 'mystery';
    if (contId !== mysteryCont) mysteryCursor = 0;
    mysteryCont = contId;
    mysOther = -1;
    mysteryReveal = !!reveal && Mystery.progress(contId).complete;
    if (reveal) Sfx.fanfare();
  }

  /** 謎畫面下方「其他大陸」的格子（不含正在看的這個洲） */
  function mysOthers() {
    return Mystery.continents.filter(function (c) { return c.id !== mysteryCont; });
  }
  /** 可以切換過去看的洲：有關卡（open）的才行 */
  function mysCanOpen(c) { return !!(c && c.open); }

  /**
   * 線索格版面（畫與方向鍵共用）：
   *   歐洲：西歐 5×2、東歐 4×2 並排；其他洲：一塊 5 欄
   * 回傳 [{ region, x, cols, lo, hi }]（lo/hi = 這一塊在 slots 裡的 index 範圍）
   */
  function mysBlocks(cont, slots) {
    const out = [];
    let idx = 0;
    cont.groups.forEach(function (g, gi) {
      const n = slots.filter(function (s) { return (s.def.region || 'west') === g.region; }).length;
      const two = cont.groups.length > 1;
      out.push({
        region: g.region, title: g.title,
        x: two ? (gi === 0 ? MYS_WEST_X : MYS_EAST_X) : MYS_WEST_X,
        cols: two && gi > 0 ? MYS_COLS_E : MYS_COLS_W,
        lo: idx, hi: idx + n - 1
      });
      idx += n;
    });
    return out;
  }

  /**
   * 謎畫面：方向鍵選線索格，Enter 看謎底（線索到齊才行）。
   * v1.23 非洲之謎也能解了：最下面一列往下 = 選「其他大陸」的格子，Enter 切換過去。
   */
  function updateMystery() {
    if (mysteryReveal) {
      if (Input.once('confirm') || Input.once('back') || Input.once('mystery') || Input.once('tomap')) {
        Sfx.select(); mysteryReveal = false;
      }
      return;
    }
    const cont = Mystery.get(mysteryCont);
    const slots = Mystery.slots(mysteryCont);
    const n = slots.length;
    const others = mysOthers();
    // 點下方的其他大陸格子（手機）：直接切換
    const click = Input.takeClick();
    if (click && click.y >= 372 && click.y <= 428) {
      const boxW = (W - 80 - 16 * (others.length - 1)) / others.length;
      const k = Math.floor((click.x - 40) / (boxW + 16));
      if (k >= 0 && k < others.length) {
        if (mysCanOpen(others[k])) { Sfx.select(); openMystery(others[k].id, false); }
        else Sfx.clang();
        return;
      }
    }
    if (mysOther >= 0) {
      // 在「其他大陸」那一列
      let k = mysOther;
      if (Input.once('left')) k = Math.max(0, k - 1);
      if (Input.once('right')) k = Math.min(others.length - 1, k + 1);
      if (k !== mysOther) { mysOther = k; Sfx.select(); }
      if (Input.once('up')) { mysOther = -1; Sfx.select(); return; }
      if (Input.once('confirm')) {
        if (mysCanOpen(others[mysOther])) { Sfx.select(); openMystery(others[mysOther].id, false); }
        else Sfx.clang();
        return;
      }
    } else {
      const blocks = mysBlocks(cont, slots);
      const b = blocks.filter(function (q) { return mysteryCursor >= q.lo && mysteryCursor <= q.hi; })[0] || blocks[0];
      const cols = b.cols, lo = b.lo, hi = b.hi;
      let c = mysteryCursor;
      if (Input.once('left')) c = Math.max(0, c - 1);
      if (Input.once('right')) c = Math.min(n - 1, c + 1);
      if (Input.once('up') && c - cols >= lo) c -= cols;
      if (Input.once('down')) {
        if (c + cols <= hi) c += cols;
        else if (Math.floor((c - lo) / cols) === Math.floor((hi - lo) / cols)) { mysOther = 0; Sfx.select(); return; }
      }
      if (c !== mysteryCursor) { mysteryCursor = c; Sfx.select(); }

      if (Input.once('confirm')) {
        if (Mystery.progress(mysteryCont).complete) { Sfx.fanfare(); mysteryReveal = true; }
        else Sfx.clang();
        return;
      }
    }
    if (Input.once('mystery') || Input.once('back') || Input.once('tomap')) {
      Sfx.select(); scene = 'map';
    }
  }

  /** 在地圖系列畫面（地圖、商店、裝備、存檔）都播地圖曲 */
  function mapLike(s) {
    return s === 'map' || s === 'shop' || s === 'inventory' || s === 'saveinfo' || s === 'mystery' || s === 'shipyard' || s === 'market' || s === 'journal';
  }

  // ── 更新 ──────────────────────────────────────────────

  function update() {
    t++;
    if (sceneTimer > 0) sceneTimer--;
    if (shake > 0) shake--;
    if (toast && --toast.life <= 0) toast = null;

    if (Input.once('mute')) {
      const nowMuted = Sfx.toggleMute();
      // 解除靜音時，如果還在關卡裡就把音樂接回來
      if (!nowMuted && scene === 'play') {
        if (skirmish) Music.playTrack(skirmishTrack(skirmish.def)); else Music.playForLevel(levelIndex);
      }
      if (!nowMuted && mapLike(scene)) Music.playTrack(mapTrack());
    }

    /*
     * 兩人同機開關（C 鍵）。
     *
     * 只在「還沒進關卡」的畫面能切 —— 關卡中途加人會需要處理
     * 半路加入的出生點、命數、相機跳動，複雜度不值得。
     * 標題與地圖都能切，因為玩家通常是在地圖上才想到要揪人玩。
     */
    // 連線中 P2 是朋友，不能關掉兩人模式
    if (Input.once('coop') && (scene === 'title' || scene === 'map') && isHost()) {
      Sfx.clang();
      toast = { text: '連線中', sub: '朋友就是 2P —— 要改回單人，先從 ☰ →「連線」離開', life: 170 };
    } else if (Input.once('coop') && (scene === 'title' || scene === 'map')) {
      coop = !coop;
      Sfx.select();
      toast = {
        text: coop ? '兩人同機：開' : '兩人同機：關',
        sub: coop ? '1P 方向鍵+空白+J　2P WASD+G' : '回到單人遊玩',
        life: 180
      };
    }

    switch (scene) {
      case 'title':
        if (Input.once('confirm') || Input.once('jump')) { Sfx.select(); toMap(); }
        break;

      case 'map': updateMap(); break;

      case 'inventory':
        if (checkCheat()) break;
        updateInventory();
        // Q（回大地圖）也要能離開 —— 提示列寫「Q 回大地圖」，商店也吃 Q，只有這裡漏掉
        // v1.22：Enter 改成「裝上／卸下」，不再是離開
        if (Input.once('inventory') || Input.once('back') || Input.once('tomap')) {
          Sfx.select(); invMsg = null; scene = 'map';
        }
        break;

      case 'shop':
        if (shopSeller === 'portugal' && cheatTyped()) { cheatMap(); break; }
        updateShop();
        break;
      case 'shipyard':
        // v1.31 玩家：在造船廠按一樣的密技可以拿 1000 元（每按一次給一次）
        if (cheatTyped()) {
          Save.addCoins(1000); Sfx.coin();
          yardMsg = { text: '密技發動！錢包 +1000 金幣', color: '#ffd166', life: 200 };
          break;
        }
        updateShipyard();
        break;
      case 'market': updateMarket(); break;

      case 'mystery': updateMystery(); break;
      case 'talk': updateTalk(); break;

      case 'journal': updateJournal(); break;

      case 'saveinfo':
        if (Input.once('wipe')) {
          if (confirmWipe) {
            wipeSave();      // 會自己回大地圖
          } else {
            confirmWipe = true;
            Sfx.select();
          }
          break;
        }
        if (Input.once('saveinfo') || Input.once('back') || Input.once('confirm') || Input.once('tomap')) {
          Sfx.select(); confirmWipe = false; scene = 'map';
        }
        break;

      case 'play': updatePlay(); break;

      case 'clear':
        if (Input.once('tomap')) {
          Sfx.select();
          if (!skirmish) cursor = levelIndex;
          toMap();
          break;
        }
        if (sceneTimer === 0 && (Input.once('confirm') || Input.once('jump'))) {
          if (skirmish) { toMap(); break; }
          // 篇章最終關（西歐篇的希臘、東歐篇的羅馬尼亞）打完播結局
          if (Levels.list[levelIndex].finale) { scene = 'win'; sceneTimer = 30; }
          // 回地圖時人物停在剛打完的這一國（玩家反應：被傳到下一國很突兀，
          // 也可能還想回頭逛商店、打海上怪）。下一國已經解鎖，自己走過去就好
          else { cursor = levelIndex; toMap(); }
        }
        break;

      case 'dead':
        if (Input.once('tomap') ||
            (sceneTimer === 0 && (Input.once('confirm') || Input.once('jump')))) toMap();
        break;

      case 'win':
        if (sceneTimer === 0 && (Input.once('confirm') || Input.once('jump'))) {
          scene = 'title';
          sceneTimer = 20;
        }
        break;
    }

    Input.endFrame();
  }

  /**
   * 密技：在裝備畫面輸入 ↑↑↓↓←→←→（Konami 密技去掉 B A）→ 全部裝備到手。
   *
   * 放在裝備畫面而不是標題：標題的 ↑ 同時是「跳」，第一下就會開始遊戲。
   * 裝備畫面的 ↑↓ 沒有作用、←→ 是換時裝（←→←→ 剛好換回原本那套），不會有副作用。
   * 手機用 ☰ → 裝備，在搖桿上照順序推就行。
   * 裝備會寫進存檔（跟正常撿到一樣），要復原就清除存檔。
   */
  /** 字太長就截斷加「⋯」（裝備格子窄，說明文字會跑進隔壁格） */
  function fitText(str, maxW, size) {
    ctx.save();
    ctx.font = '600 ' + size + 'px "Segoe UI", "Microsoft JhengHei", sans-serif';
    let s = str;
    if (ctx.measureText(s).width > maxW) {
      while (s.length > 1 && ctx.measureText(s + '⋯').width > maxW) s = s.slice(0, -1);
      s += '⋯';
    }
    ctx.restore();
    return s;
  }

  /*
   * 裝備畫面版面（v1.23 玩家：只用文字分部位很難讀）——
   *   每個部位一區（直欄），欄頭有部位顏色＋圖示；飾品件數多，佔兩個子欄。
   *   vcols：畫面上的子欄（{ slot, items: [def index] }），畫與點擊判定、方向鍵都共用。
   */
  const SLOT_STYLE = {
    head: { color: '#f0a83c', dark: 'rgba(110, 70, 20, 0.55)' },
    body: { color: '#5cb0f0', dark: 'rgba(25, 70, 115, 0.55)' },
    hand: { color: '#f06a55', dark: 'rgba(115, 35, 30, 0.55)' },
    feet: { color: '#86d46a', dark: 'rgba(40, 95, 35, 0.55)' },
    acc:  { color: '#c890f0', dark: 'rgba(85, 45, 120, 0.55)' }
  };
  function invLayout() {
    const vcols = [];
    const groups = [];
    Equipment.SLOTS.forEach(function (s) {
      const idx = s.items.map(function (id) { return Equipment.defs.indexOf(Equipment.get(id)); })
        .filter(function (i) { return i >= 0; });
      const sub = idx.length > 6 ? 2 : 1;      // 件數多的部位分兩個子欄
      const per = Math.ceil(idx.length / sub);
      const g = { slot: s, first: vcols.length, span: sub };
      for (let k = 0; k < sub; k++) vcols.push({ slot: s.id, items: idx.slice(k * per, (k + 1) * per) });
      groups.push(g);
    });
    const gx = 8, gGap = 14, gy = 6;
    const top = 102, headH = 26, bottom = H - 88;   // top 避開左上角的選單鈕
    const rows = Math.max.apply(null, vcols.map(function (c) { return c.items.length; }));
    const cw = Math.floor((W - 24 - (vcols.length - groups.length) * gx - (groups.length - 1) * gGap) / vcols.length);
    const ch = Math.min(64, Math.floor((bottom - top - headH - 6 - (rows - 1) * gy) / rows));
    // 每個子欄的 x
    let x = (W - (vcols.length * cw + (vcols.length - groups.length) * gx + (groups.length - 1) * gGap)) / 2;
    groups.forEach(function (g, gi) {
      if (gi) x += gGap - gx;
      g.x = x;
      for (let k = 0; k < g.span; k++) { vcols[g.first + k].x = x; x += cw + gx; }
      g.w = g.span * cw + (g.span - 1) * gx;
    });
    const at = {};   // def index → { vc, row }
    vcols.forEach(function (c, vc) { c.items.forEach(function (i, row) { at[i] = { vc: vc, row: row }; }); });
    return {
      vcols: vcols, groups: groups, cw: cw, ch: ch, top: top, headH: headH, at: at,
      cell: function (i) {
        const a = at[i];
        return { x: vcols[a.vc].x, y: top + headH + 6 + a.row * (ch + gy) };
      }
    };
  }

  /** 部位圖示（向量，不靠字型）：頭 = 帽子、身體 = 上衣、手 = 手套、腳 = 靴子、飾品 = 寶石 */
  function drawSlotIcon(c, slot, x, y, r, color) {
    c.save();
    c.translate(x, y);
    c.fillStyle = color;
    c.strokeStyle = color;
    c.lineWidth = Math.max(1.2, r * 0.18);
    c.beginPath();
    if (slot === 'head') {
      c.ellipse(0, r * 0.45, r, r * 0.28, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(-r * 0.6, r * 0.45);
      c.quadraticCurveTo(-r * 0.62, -r * 0.8, 0, -r * 0.8);
      c.quadraticCurveTo(r * 0.62, -r * 0.8, r * 0.6, r * 0.45);
      c.fill();
    } else if (slot === 'body') {
      c.moveTo(-r * 0.35, -r * 0.85);
      c.lineTo(-r, -r * 0.45); c.lineTo(-r * 0.75, 0); c.lineTo(-r * 0.55, -r * 0.15);
      c.lineTo(-r * 0.55, r * 0.9); c.lineTo(r * 0.55, r * 0.9); c.lineTo(r * 0.55, -r * 0.15);
      c.lineTo(r * 0.75, 0); c.lineTo(r, -r * 0.45); c.lineTo(r * 0.35, -r * 0.85);
      c.quadraticCurveTo(0, -r * 0.45, -r * 0.35, -r * 0.85);
      c.fill();
    } else if (slot === 'hand') {
      U.roundRect(c, -r * 0.6, -r * 0.35, r * 1.2, r * 1.15, r * 0.3); c.fill();
      for (let k = 0; k < 4; k++) {
        U.roundRect(c, -r * 0.6 + k * r * 0.31, -r * 0.95, r * 0.26, r * 0.8, r * 0.13); c.fill();
      }
      c.beginPath();
      c.ellipse(-r * 0.75, r * 0.05, r * 0.2, r * 0.4, -0.5, 0, Math.PI * 2);
      c.fill();
    } else if (slot === 'feet') {
      c.moveTo(-r * 0.55, -r * 0.9); c.lineTo(r * 0.1, -r * 0.9); c.lineTo(r * 0.1, r * 0.1);
      c.quadraticCurveTo(r, r * 0.2, r, r * 0.6); c.lineTo(r, r * 0.85); c.lineTo(-r * 0.55, r * 0.85);
      c.closePath();
      c.fill();
    } else {
      c.moveTo(0, -r); c.lineTo(r * 0.85, -r * 0.2); c.lineTo(0, r); c.lineTo(-r * 0.85, -r * 0.2);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.beginPath();
      c.moveTo(0, -r * 0.6); c.lineTo(r * 0.4, -r * 0.2); c.lineTo(0, r * 0.05); c.lineTo(-r * 0.4, -r * 0.2);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  /** 裝上 / 卸下第 i 件（沒擁有的不能裝） */
  function toggleWear(i) {
    const d = Equipment.defs[i];
    if (!d) return;
    if (!Save.hasEquip(d.id)) {
      invMsg = { text: '還沒拿到：在' + d.country + '關卡中尋找', color: '#9aa7c7', life: 120 };
      Sfx.clang();
      return;
    }
    const slotName = Equipment.SLOTS.filter(function (s) { return s.id === d.slot; })[0].name;
    if (Save.isWorn(d.id)) {
      Save.unwear(d.id);
      invMsg = { text: '卸下 ' + d.name + '（' + slotName + '空著）', color: '#c6d2e8', life: 120 };
      Sfx.select();
    } else {
      const prev = Save.wear(d.id);
      const pd = prev && Equipment.get(prev);
      invMsg = { text: '裝上 ' + d.name + (pd ? '，換下 ' + pd.name : '') + '（' + slotName + '）', color: '#8fe3a0', life: 140 };
      Sfx.equip();
    }
    stats = Equipment.resolve(Save.wornIds());
    maxLives = stats.maxLives;
  }

  /**
   * 裝備畫面操作（v1.22 分部位）：
   *   方向鍵選格、Enter 裝上／卸下；最上面一列往上 = 時裝列（←→ 換時裝）
   *   手機：點格子 = 選取並裝上／卸下
   */
  function updateInventory() {
    if (invMsg && --invMsg.life <= 0) invMsg = null;
    const n = Equipment.defs.length;
    const L = invLayout();
    if (invCursor < 0) {
      // 時裝列：←→ 換時裝（原本的條紋衫 + 擁有的時裝輪流）
      const step = Input.once('left') ? -1 : (Input.once('right') ? 1 : 0);
      const sv = Save.get();
      const opts = [null].concat(sv.costumes);
      if (step && opts.length > 1) {
        const i = Math.max(0, opts.indexOf(sv.costume));
        Save.wearCostume(opts[(i + step + opts.length) % opts.length]);
        Sfx.select();
      }
      if (Input.once('down')) {
        const col = L.vcols[Math.min(invCol, L.vcols.length - 1)];
        invCursor = col.items.length ? col.items[0] : 0;
        Sfx.select();
      }
    } else {
      // 每個部位一欄：↑↓ 在同部位裡換、←→ 換部位（換欄時盡量停在同一列）
      const a = L.at[invCursor] || { vc: 0, row: 0 };
      let vc = a.vc, row = a.row;
      if (Input.once('left') && vc > 0) vc--;
      if (Input.once('right') && vc < L.vcols.length - 1) vc++;
      let c = L.vcols[vc].items[Math.min(row, L.vcols[vc].items.length - 1)];
      if (Input.once('up')) c = row === 0 ? -1 : L.vcols[vc].items[row - 1];
      if (Input.once('down') && row + 1 < L.vcols[vc].items.length) c = L.vcols[vc].items[row + 1];
      if (c !== invCursor) { invCursor = c; invCol = vc; Sfx.select(); }
      if (invCursor >= 0 && Input.once('confirm')) toggleWear(invCursor);
    }
    // 點格子（手機／滑鼠）
    const click = Input.takeClick();
    if (click) {
      for (let i = 0; i < n; i++) {
        if (!L.at[i]) continue;
        const p = L.cell(i);
        if (click.x >= p.x && click.x <= p.x + L.cw && click.y >= p.y && click.y <= p.y + L.ch) {
          invCursor = i;
          invCol = L.at[i].vc;
          toggleWear(i);
          break;
        }
      }
    }
  }

  const CHEAT = 'UUDDLRLR';
  let cheatBuf = '';
  /** 這一帧有沒有剛好打完密技 ↑↑↓↓←→←→（裝備畫面 = 裝備全開；葡萄牙商店 = 地圖全開；造船廠 = 1000 金幣） */
  function cheatTyped() {
    const k = Input.once('up') ? 'U' : Input.once('down') ? 'D' :
              Input.once('left') ? 'L' : Input.once('right') ? 'R' : '';
    if (!k) return false;
    cheatBuf = (cheatBuf + k).slice(-CHEAT.length);
    if (cheatBuf !== CHEAT) return false;
    cheatBuf = '';
    return true;
  }

  /**
   * v1.31 玩家：增加密技「地圖全開」（在葡萄牙商店按跟裝備全開一樣的密技）。
   * 所有篇章一次解鎖：東歐、非洲（EXP 補到門檻）、北歐（索爾的結界解開）、美洲（哥倫布的委託完成）、南美（美洲 EXP 補到門檻）。
   */
  function cheatMap() {
    const sv = Save.get();
    const needExp = Math.max.apply(null, Encounter.EXP_REGIONS.map(function (r) { return r.exp; }));
    if (sv.exp < needExp) Save.gainExp(needExp - sv.exp);
    ['thorAsked', 'loki', 'north'].forEach(function (k) { if (!Save.flag(k)) Save.setFlag(k, 1); });
    if (Save.flag('columbus') < 2) Save.setFlag('columbus', 2);
    if (Save.expAm() < Encounter.SOUTH_EXP) { sv.expAm = Encounter.SOUTH_EXP; Save.touch(); }
    sv.unlocked = Levels.count;
    Save.touch();
    Sfx.fanfare();
    shopMsg = { text: '密技發動！地圖全開 —— 東歐、非洲、北歐、美洲、南美全部解鎖', color: '#ffd166', life: 240 };
  }

  function checkCheat() {
    if (!cheatTyped()) return false;
    Equipment.defs.forEach(function (d) { Save.addEquip(d.id); });
    // 全部到手後，每個部位換成最好的那件（不然會停在「最早撿到的」那件）
    Equipment.pickWorn(Save.get().equipment).forEach(function (id) { Save.wear(id); });
    stats = Equipment.resolve(Save.wornIds());
    maxLives = stats.maxLives;
    Sfx.equip();
    toast = { text: '密技發動！', sub: '全部 ' + Equipment.count + ' 件裝備到手', life: 200 };
    return true;
  }

  /**
   * 地圖 = 航海模式。
   *
   * 玩家在海上開船、在陸地上步行（自動切換），走到某國城市圖釘旁按 Enter 進關卡。
   * cursor 仍然保留，代表「目前靠近的國家」，底部資訊卡與其他畫面都還是讀它。
   */
  let eiffelArmed = true, surfArmed = false;
  function updateMap() {
    const unlocked = Save.get().unlocked;

    if (Input.once('inventory')) { Sfx.select(); scene = 'inventory'; return; }
    if (Input.once('saveinfo')) { Sfx.select(); confirmWipe = false; scene = 'saveinfo'; return; }
    if (Input.once('journal')) { Sfx.select(); journalPage = 0; scene = 'journal'; return; }
    if (Input.once('shop')) { Sfx.select(); shopCursor = 0; shopSeller = 'portugal'; scene = 'shop'; return; }
    if (Input.once('mystery')) { Sfx.select(); openMystery(mysteryCont, false); return; }

    /*
     * 海上的怪：船靠過去按 Enter 開打。
     * 要在 Voyage.update 之前判斷 —— 兩者都吃 Enter，
     * 怪物跟港口同時在旁邊時，以挑戰怪物優先（港口跑不掉，怪會游走）。
     */
    const monster = Encounter.nearby();
    if (monster && monster.kind === 'atlantis' && Quests.abyssOpen() && Input.once('confirm')) { enterAbyss(); return; }
    if (monster && Input.once('confirm')) {
      Sfx.bossRoar();
      startSkirmish(monster);
      return;
    }

    const events = Voyage.update(Input);
    // 寵物（v1.29）：收養的黃金獵犬沿著足跡跟在後面
    Pet.update(Voyage.shipPos());
    /*
     * v1.31.3 玩家：光之井不用按 Enter 就能回去（跟開到地圖邊緣進新大陸一樣）—— 游進光之井就浮回海面。
     * 剛潛下來時人在光之井正下方，要先游開一點（surfArmed）才會觸發，不然一下來就被送回去。
     */
    if (WorldMap.world() === 'sea') {
      const sw = Abyss.SPOTS.filter(function (q) { return q.surface; })[0], sp = Voyage.shipPos();
      const d = Math.hypot(sp.x - sw.x, sp.y - sw.y);
      if (d > 30) surfArmed = true;
      else if (d < 16 && surfArmed) { surfArmed = false; leaveAbyss(); return; }
    } else surfArmed = false;
    /*
     * v1.31.2 玩家：打倒暗夜騎士之後，帶著人魚、好感度全滿來到巴黎鐵塔 → 看夜景的對話，看完她變成人類。
     * 走到法國的圖釘（巴黎）旁邊就自動開始；中途按 Esc 離開，要先走遠一點再回來才會再開始。
     */
    if (WorldMap.world() === 'eu' && Quests.eiffelReady()) {
      const fr = WorldMap.nations.filter(function (n) { return n.id === 'FR'; })[0];
      const sp = Voyage.shipPos();
      const d = fr ? Math.hypot(sp.x - fr.pin[0], sp.y - fr.pin[1]) : 999;
      if (d > 60) eiffelArmed = true;
      else if (d < 30 && eiffelArmed && Voyage.mode() === 'land') { eiffelArmed = false; openTalk('eiffel'); return; }
    }
    // v1.30 瑞士銀行的利息（用真實時間算）
    Quests.tick();
    if (blockedToastT > 0) blockedToastT--;
    if (events.indexOf('blocked') >= 0 && blockedToastT === 0) {
      blockedToastT = 150;
      Sfx.clang(); shake = 4;
      toast = Save.flag('loki')
        ? { text: '雷神的結界擋住了去路', sub: '你已經救出洛基了 —— 回北海跟雷神索爾說話', life: 170 }
        : Save.flag('thorAsked')
        ? { text: '雷神的結界擋住了去路', sub: '索爾說：南方溫暖的海，有一張「吞下船的嘴」⋯⋯', life: 170 }
        : { text: '雷神的結界擋住了去路', sub: '北海上的雷神索爾好像在等人 —— 去找他問問', life: 170 };
    }
    // v1.31 橫越大西洋（Voyage 在船頂著地圖邊緣還往外開時回報）
    if (crossToastT > 0) crossToastT--;
    if (events.indexOf('edgeWest') >= 0 || events.indexOf('edgeEast') >= 0) {
      const toAm = events.indexOf('edgeWest') >= 0;
      if (toAm && !Quests.americaOpen()) {
        if (crossToastT === 0) {
          crossToastT = 180;
          Sfx.clang();
          toast = { text: '大西洋的另一頭⋯⋯', sub: Save.flag('columbus') ? '還沒有人開過去 —— 先完成哥倫布的委託，讓他出航' : '還沒有人開過去 —— 塞維亞的哥倫布好像想往西航行', life: 200 };
        }
      } else {
        crossAtlantic(toAm ? 'am' : 'eu');
        return;
      }
    }
    const shipNow = Voyage.shipPos();
    // v1.30 比利時的扒手：船開到比利時海岸就被扒走金幣
    {
      const stolen = Quests.pickpocket(shipNow);
      if (stolen > 0) {
        Sfx.clang(); shake = 4;
        toast = Save.flag('robbedTimes') === Quests.ROB_TITLE
          ? { text: '又被扒了！-' + stolen + ' 金幣⋯⋯獲得稱號「比利時肥羊」', sub: '被同一個扒手偷了 ' + Quests.ROB_TITLE + ' 次，連他都不好意思了', life: 300 }
          : { text: '錢包被扒了！-' + stolen + ' 金幣', sub: '比利時港邊的扒手一溜煙跑掉了⋯⋯歐洲扒手真多，下次繞遠一點（被偷 ' + Save.flag('robbedTimes') + ' 次）', life: 220 };
      } else if (stolen === -2) {
        Sfx.stomp();
        toast = { text: '扒手伸手⋯⋯嘶！', sub: '埃及豔后的聖蛇把比利時扒手嚇跑了！', life: 220 };
      } else if (stolen < 0) {
        toast = { text: '扒手摸了你的口袋⋯⋯', sub: '可惜裡面一枚金幣也沒有，他白跑一趟', life: 180 };
      }
    }
    // 地圖比畫面高：相機跟著船走
    WorldMap.follow(shipNow.x, shipNow.y);
    // 稀有怪出現時提示一下（牠待不久，而且會逃）
    const mapEv = Encounter.updateMap(shipNow, Save.get().exp);
    // E 卡律布狄斯：被吸到漩渦眼 → 漩渦逃生
    if (mapEv.indexOf('vortex') >= 0) {
      Sfx.bossRoar();
      startSkirmish(Encounter.boss('charybdis'));
      return;
    }
    if (mapEv.indexOf('vortexpull') >= 0 && t % 50 === 0) {
      toast = { text: '被大漩渦吸住了！', sub: '用力往外開，不然會被捲進卡律布狄斯的漩渦眼', life: 90 };
    }
    // D 懸賞：限時送信只在大地圖上倒數
    {
      const b = Save.get().bounty;
      if (b && b.type === 'letter') {
        b.time--;
        if (t % 120 === 0) Save.touch();
        if (b.time <= 0) {
          Save.finishBounty();
          Sfx.clang();
          toast = { text: '信送遲了⋯⋯', sub: '這張懸賞失敗了（到貿易港的懸賞板可以接新的）', life: 200 };
        }
      }
    }
    if (mapEv.indexOf('rare') >= 0) {
      Sfx.equip();
      // v1.31 新大陸的稀有怪是黃金海龜（玩家：提示還寫海馬）
      toast = { text: '稀有怪出現了！', sub: (WorldMap.world() === 'am' ? '閃金光的黃金海龜' : '閃金光的黃金海馬') + ' —— 抓到會掉時裝', life: 200 };
    }
    const near = Voyage.nearbyLevel();

    // 靠近哪一國，資訊卡就顯示那一國
    if (near >= 0 && near !== cursor) {
      cursor = near;
      Sfx.select();
    }

    // 點地圖也能直接把船開過去（手機/滑鼠）
    const rawClick = Input.takeClick();
    // 點擊是畫面座標，地圖是世界座標（有相機捲動），要先換算；點到上下 UI 條不算
    const click = rawClick && rawClick.y >= WorldMap.VIEW_TOP &&
      rawClick.y < WorldMap.VIEW_TOP + WorldMap.VIEW_H
      ? WorldMap.toWorld(rawClick.x, rawClick.y) : null;
    if (click) {
      const hit = WorldMap.hitTest(click.x, click.y);
      // 點特殊地點（葡萄牙商店、愛爾蘭裝備）：跟點國家一樣，把人直接帶過去（手機上很需要）
      const spHit = hit < 0 ? WorldMap.nearSpecial(click.x, click.y, 34) : null;
      if (spHit) {
        Voyage.placeShip(spHit.pin[0], spHit.pin[1] + 4);
        Sfx.select();
      } else if (hit >= 0 && hit < unlocked) {
        Voyage.reset(hit);
        cursor = hit;
        Sfx.select();
      } else {
        // 點東歐國：告訴玩家這區的狀態（還沒有關卡內容）
        const e = WorldMap.hitTestEast(click.x, click.y);
        if (e) {
          Sfx.select();
          const open = eastUnlocked();
          toast = open
            ? { text: e.name + '・東歐篇', sub: '地圖已解鎖，關卡開發中，敬請期待', life: 170 }
            : { text: e.name + '・東歐篇（未解鎖）',
                sub: '打海上怪物累積 EXP：' + Save.get().exp + ' / ' + Encounter.EAST_EXP, life: 170 };
        }
      }
    }

    // 上岸／上船的小音效，讓玩家感覺到「換交通工具了」
    if (events.indexOf('land') >= 0) Sfx.land();
    if (events.indexOf('embark') >= 0) Sfx.select();

    // 特殊地點（v1.21.1）：葡萄牙 = 商店、愛爾蘭 = 裝備。不是關卡，按 Enter 直接打開那個畫面
    const spNear = Voyage.nearbySpecial();
    if (events.indexOf('dock') >= 0 && spNear) {
      Sfx.select();
      if (spNear.def.scene === 'shop') { shopCursor = 0; shopSeller = spNear.def.seller || 'portugal'; }
      // v1.26 地中海港口：沉船潛水直接開潛；造船廠打開升級畫面
      if (spNear.def.scene === 'duo') { tryStartDuo(spNear); return; }
      if (spNear.def.scene === 'dog') { greetDog(); return; }
      // v1.30 劇情人物與地點：金字塔直接進去探險，其他都是對話
      if (spNear.def.scene === 'talk') {
        if (spNear.def.npc === 'pyramid' || spNear.def.npc === 'zoo' || spNear.def.npc === 'cleopatra' || spNear.def.npc === 'sahara') {
          if (!regionUnlocked('africa')) {
            Sfx.clang();
            toast = { text: '非洲篇還沒解鎖', sub: '打海上怪物累積 EXP：' + Save.get().exp + ' / ' + Encounter.regionOf('africa').exp, life: 170 };
            return;
          }
          if (spNear.def.npc === 'pyramid') { Sfx.select(); startQuestLevel('pyramid'); return; }
          if (spNear.def.npc === 'sahara') { Sfx.select(); startQuestLevel('sahara'); return; }
        }
        openTalk(spNear.def.npc);
        return;
      }
      if (spNear.def.scene === 'surface') { leaveAbyss(); return; }
      if (spNear.def.scene === 'dive') {
        const ship0 = Voyage.shipPos();
        startSkirmish({ kind: spNear.def.port, def: Encounter.KINDS[spNear.def.port], x: ship0.x, y: ship0.y, port: true });
        return;
      }
      if (spNear.def.scene === 'market') {
        mkPort = spNear.def.market; mkTab = 0; mkRow = 0; mkCol = 0; mkMsg = null; mkAbandon = false;
        arriveAt(mkPort);
      }
      if (spNear.def.scene === 'shipyard') {
        yardCursor = 0; yardMsg = null;
        yardPaint = Math.max(0, Shipyard.PAINTS.indexOf(Shipyard.paint(Save.ship())));
      }
      scene = spNear.def.scene;
      return;
    }

    if (events.indexOf('dock') >= 0 && near >= 0 && near < unlocked) {
      // 東歐篇、非洲篇要 EXP 解鎖（門檻見 Encounter.REGIONS）
      // v1.31 南美（哥倫比亞、巴西）另外要美洲 EXP（Levels gate: 'samerica'）
      const rg = Levels.list[near].gate && regionUnlocked(Levels.list[near].region) ? Levels.list[near].gate : Levels.list[near].region;
      if (!regionUnlocked(rg)) {
        Sfx.clang();
        const reg = Encounter.regionOf(rg);
        toast = rg === 'samerica'
          ? { text: '南美篇還沒解鎖', sub: '在新大陸打海上怪物累積美洲 EXP：' + Save.expAm() + ' / ' + reg.exp, life: 170 }
          : rg === 'america'
          ? { text: reg.name + '還沒開放', sub: '先完成塞維亞哥倫布的委託', life: 170 }
          : reg.quest
          ? { text: reg.name + '被雷神的結界罩住了', sub: '北海上的雷神索爾好像知道怎麼解開', life: 170 }
          : { text: reg.name + '還沒解鎖',
              sub: '打海上怪物累積 EXP：' + Save.get().exp + ' / ' + reg.exp, life: 170 };
      } else {
        Sfx.select();
        startLevel(near);
      }
    }
  }

  /** 招牌機制的第一次提示 */
  const FEATURE_TIPS = {
    stampede: ['奔牛來了！', '公牛從後面衝過來 —— 一直往前跑，或跳上平台躲開'],
    pad: ['咖啡館遮陽篷', '踩上紅白條紋的篷子會彈很高，空中有金幣'],
    barrels: ['啤酒桶滾下來了', '跳過去，或從上面踩碎它'],
    dark: ['維利奇卡鹽礦', '礦坑裡一片漆黑，只看得到身邊和礦燈'],
    geyser: ['溫泉間歇泉', '冒泡之後會噴發 —— 站上去能被衝上天、飛過河面'],
    gusts: ['塔特拉山風', '樹葉往後飄就是要颳逆風了 —— 颳風時跳著走比較快'],
    cannons: ['城牆砲擊', '地上的紅圈是砲彈落點，看到就快離開'],
    bridge: ['河上的老木橋', '踩上去一下就會塌，別停下來'],
    thorn: ['玫瑰荊棘', '花苞抖動之後會冒出尖刺，等它縮回去再過'],
    // v1.21 非洲篇
    sand: ['撒哈拉流沙', '踩進去會走不快、跳不高，越陷越深 —— 別停下來，趕快走出去'],
    // v1.23 非洲篇補齊
    sandstorm: ['撒哈拉沙塵暴', '沙子變濃就要颳了 —— 逆風推人、只看得到身邊，小心看不見的敵人'],
    brine: ['杰里德鹽湖', '鹽泥陷得很快，硬走一定受傷 —— 等駱駝靠岸，跳上駝峰讓牠載你'],
    camel: ['駱駝商隊', '紅色鞍毯可以站上去，駱駝會載著你走過鹽湖'],
    column: ['羅馬古柱', '一靠近就會搖晃倒下，地上紅框是壓到的範圍 —— 衝過去，或等它倒完'],
    flood: ['潛進地中海', '這一段淹在海裡：跳躍 = 往上游、會慢慢下沉，頭上的氣泡用完會嗆水'],
    vortex: ['卡律布狄斯', ''],
    current: ['暗流', '水流會把你往一邊推 —— 貼著海底走推力只剩一半，或趁空檔用力游過去'],
    clam: ['巨蚌', '一開一合，抖動之後就要夾起來了 —— 張開時裡面的珍珠可以拿'],
    relic: ['沉船寶物', '發光的就是兩千年前的寶物，沿路一共三件，終點船艙還有一件'],
    vent: ['海底氣泡噴口', '頭上的氣泡是你的空氣 —— 游進噴口冒出來的氣泡柱就能補滿'],
    mount: ['駱駝坐騎', '碰一下就騎上去：跑得快、跳得高、不陷沙也不怕風沙；被打到駱駝會跑掉，但你不扣血'],
    // v1.30 北歐篇
    brick: ['樂高積木階梯', '紅、藍積木輪流出現 —— 腳下的積木開始閃就起跳，落下時另一色剛好出來'],
    ice: ['結冰的湖面', '雪橇在冰上越滑越快、跳得更遠 —— 斷崖前要算準起跳點，別跳過頭'],
    floe: ['峽灣的浮冰', '冰海跳不過去，要踩浮冰 —— 浮冰站一下就會往下沉，別停，一塊接一塊跳'],
    aurora: ['北極圈的極夜', '只看得到身邊 —— 等天上的極光亮起來，整片雪地就看得清楚了'],
    // v1.31 美洲篇
    waves: ['馬雷貢海堤的大浪', '海堤後面捲起浪頭就準備跳 —— 浪拍上路面的那一下，人要在半空中'],
    beatpad: ['雷鬼音響', '站在喇叭上等紅黃綠燈亮完 ——「咚」的那一下才會把你彈上天'],
    lock: ['巴拿馬運河的船閘', '中間的閘門跳不過去 —— 站上小船等它升上去，再翻過閘門跳到另一邊'],
    pourover: ['手沖咖啡', '壺冒蒸氣就要沖水了 —— 站在濾杯的旁邊（別站正中間的水柱），咖啡粉悶蒸會把你托上去'],
    race_wave: ['大浪要打上來了！', '浪會蓋住整條路 —— 快到的時候按跳躍，從浪上面飛過去'],
    topwave: ['大浪要打上來了！', '海堤冒水花 = 浪要從左邊打上路面，蓋住左邊三分之二的馬路 —— 快開到最右邊的車道'],
    race_crates: ['走私卡車丟下木箱！', '一整排木箱擋住整條路 —— 按跳躍飛過去'],
    // v1.31 東歐換新玩法：塞爾維亞滑雪、保加利亞羽球
    ski: ['科帕奧尼克滑雪場', '按住 ↓ 壓低滑得更快、按 ← 剎車；石頭、雪人、樹幹要跳過去'],
    ski_kick: ['跳台！', '衝上跳台會飛起來 —— 空中的金幣只有飛過去才拿得到'],
    ski_chair: ['低低的纜車椅！', '跳不過去 —— 按住 ↓ 壓低身體，從椅子底下鑽過去'],
    badminton: ['玫瑰谷羽球對決', '球飛過來就自動揮拍：按住 ↓ 打網前小球，跳起來打是殺球。先拿 5 分獲勝！'],
    rope: ['海盜盪繩', '跳起來抓住繩子，盪到往前衝的那一下按跳躍放手，就能飛過水道'],
    // v1.31.2 亞特蘭提斯海底城
    jelly: ['發光水母', '從上面踩傘蓋會被彈得很高（上面有金幣）；碰到側邊或觸手會被電'],
    beam: ['水晶光束', '水晶亮起來、地上出現虛線 = 光束要掃過來了 —— 跳起來閃'],
    race_reefwall: ['礁石牆！', '一整排礁石從沙裡冒出來擋住整條路 —— 按跳躍讓海馬跳過去']
  };
  // 交通關（v1.20）同一個機制換了場景，提示也要換說法
  const VEHICLE_TIPS = {
    train: {
      geyser: ['溫泉區的蒸氣', '車頂通風口冒泡之後會噴發 —— 站上去能被衝上天'],
      bridge: ['車廂連結板', '踩上去一下就會塌，別停下來'],
      thorn: ['玫瑰貨車廂', '花苞抖動之後會冒出尖刺，等它縮回去再過']
    },
    cable: {
      gusts: ['塔特拉山風', '颳風時月台上會被往後吹 —— 坐在纜車裡很安全，只是會晃'],
      cannons: ['城牆砲擊', '月台上的紅圈是砲彈落點，看到就快離開，或趕快搭上纜車']
    }
  };
  // 一進交通關先講怎麼玩（尤其纜車：要等靠站，不能跳過去）
  const VEHICLE_INTRO = {
    train: ['東方快車', '在車廂頂上往車頭跑・車廂之間的縫要跳過去'],
    cable: ['搭纜車過山谷', '山谷跳不過去：在月台邊等纜車靠站再走上去，到對岸再下車']
  };

  function eastUnlocked() { return regionUnlocked('east'); }
  /** 這一篇解鎖了嗎（西歐篇與不在 Encounter.REGIONS 的篇章一開始就開放） */
  function regionUnlocked(region) { return Encounter.regionUnlocked(region, Save.get().exp); }

  /*
   * 海神夥伴（v1.24.2 玩家：亞特蘭提斯終點拿到海神夥伴，用來幫忙打魔王，是消耗品；v1.31.2 改成安提基特拉沉船拿到）。
   * 騎著海豚的小海神，跟在玩家身後飄；魔王倒地露出破綻 ALLY_WAIT 帧後丟一支三叉戟，
   * 打中算一下傷害（跟玩家踩到一樣）。每次破綻只丟一支、一場最多 ALLY_THROWS 支，
   * 所以還是要自己打 —— 牠是幫忙，不是代打。第一次出手時才從存檔扣掉一個。
   */
  const ALLY_THROWS = 2;
  const ALLY_WAIT = 24;
  function updateAlly() {
    const a = state.ally, b = state.boss;
    const events = [];
    if (!a || !b) return events;
    const p = state.player;
    a.x += (p.x - (p.facing || 1) * 34 - a.x) * 0.08;
    a.y += (p.y - 78 + Math.sin(t * 0.08) * 6 - a.y) * 0.08;     // 飄在玩家頭上斜後方（再低會被 NPC 對話泡泡蓋住）
    a.facing = (b.x + b.w / 2) > a.x ? 1 : -1;
    if (a.shot) {
      const s = a.shot;
      const tx = b.x + b.w / 2, ty = b.y + b.h / 2;
      const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
      if (d < 18) {
        a.shot = null;
        if (bossVulnerable(b)) {
          events.push(damageBoss(state, b));
        } else {
          a.throws++;        // 魔王剛好被玩家打起來了：這支不算，下次破綻再丟
        }
      } else {
        s.x += dx / d * 9; s.y += dy / d * 9;
        s.a = Math.atan2(dy, dx);
      }
    } else if (!b.defeated && bossVulnerable(b)) {
      if (!a.cool && a.throws > 0 && ++a.wait >= ALLY_WAIT) {
        a.wait = 0;
        a.cool = true;                       // 這次破綻丟過了
        a.throws--;
        if (!a.used) { a.used = true; Save.useAlly(); }
        a.shot = { x: a.x, y: a.y, a: 0 };
        events.push('allythrow');
      }
    } else {
      a.wait = 0;
      a.cool = false;
    }
    return events;
  }

  function updatePlay() {
    // 沒有關卡狀態就不該在 play（只會發生在狀態被外部改動時），退回地圖
    if (!state) { toMap(); return; }
    if (Input.once('pause') || Input.once('back')) { scene = 'paused'; return; }
    // 回大地圖 = 放棄這一關（進度不計分），先跳確認框，避免誤按就白打
    if (Input.once('tomap')) { Sfx.select(); scene = 'quitconfirm'; return; }
    // v1.31 洞裡的密道：在地底洞窟的這段時間整關停住（畫面播洞窟），時間到從斷崖對面爬上來
    if (state.pitCave) { updatePitCave(); return; }

    // v1.31 往前衝的賽道關（race.js）：不跑橫向關卡的物理，事件格式一樣（'coin'、'p0:hurt'、'clear'⋯⋯）
    let events;
    if (state.def.layout === 'race') {
      events = Race.update(state, coop ? Input.pad(0) : Input, t);
    } else {
    updateMovers(state.movers, t);
    const enemyEvents = updateEnemies(state, t);
    const bossEvents = updateBoss(state, t);
    updateAlly().forEach(function (e) { bossEvents.push(e); });
    updateShots(state);
    // 豎井關：塌陷平台的倒數（要在玩家物理之前，塌掉這帧就不該接住人）
    const shaftEvents = updateShaftFloors(state);
    // 海上遭遇戰：補下一波、判定勝利（非遭遇戰回傳空陣列）
    const seaEvents = Encounter.updateSkirmish(state, coop ? Input.pad(0) : Input);

    /*
     * 每位玩家各跑一次物理，各讀自己的按鍵。
     *
     * 事件要標記是哪位玩家發出的 —— 扣命、受傷都是個人的。
     * 格式用 'p1:hurt' 這種前綴，下面的 switch 會先拆出 pid。
     * 已經沒命的玩家跳過（他的角色退場，等隊友過關）。
     *
     * ⚠️ 單人模式一定要用「合併輸入」（Input 本身）而不是 pad(0)。
     * 我把 WASD 從 P1 的替代鍵移給 P2 之後，單人玩家按 WASD 就不會動了 ——
     * 那是硬生生拿掉既有操作方式的回歸 bug（實測 soloWASDWorks=false）。
     * 合併視圖讓單人玩家方向鍵與 WASD 都能用，跟改動前一致。
     */
    let playerEvents = [];
    state.players.forEach(function (pl, i) {
      if (downed[i]) return;
      const src = coop ? Input.pad(i) : Input;
      const evs = updatePlayer(state, src, t, pl);
      for (let k = 0; k < evs.length; k++) playerEvents.push('p' + i + ':' + evs[k]);
    });

    // 招牌機制（要在玩家物理之後：彈跳墊要知道玩家這帧有沒有站在上面）
    state.players.forEach(function (q, i) { q.out = !!downed[i]; });
    const featureEvents = state.features ? Features.update(state, t) : [];
    // 雙人試煉：壓板、閘門、吊橋（要在玩家物理之後：看這帧誰站在壓板上）
    if (state.duo) Duo.update(state).forEach(function (e) { featureEvents.push(e); });
    // 玩家丟出去的板球／辣椒火球
    updatePlayerShots(state).forEach(function (e) { featureEvents.push(e); });
    // 會講話的 NPC（玩家走近就講）
    Npcs.update(state).forEach(function (e) { featureEvents.push(e); });

    events = enemyEvents.concat(bossEvents, shaftEvents, seaEvents, playerEvents, featureEvents);
    }
    updateParticles(state.particles);

    events.forEach(function (raw) {
      // 拆出玩家前綴（'p0:hurt' → pid=0, ev='hurt'）
      let pid = 0, ev = raw;
      if (typeof raw === 'string' && /^p\d:/.test(raw)) {
        pid = parseInt(raw[1], 10);
        ev = raw.slice(3);
      }
      // 密道事件帶索引，格式 "secret:0"
      // v1.31.2 海神的封印（亞特蘭提斯潛水關的最底層）
      if (ev === 'riddle:start') {
        Sfx.secret();
        toast = { text: '踩石板解開海神的封印！', sub: '照牆上壁畫的順序（I → II → III），走到金色箭頭下面的石板上・不想解就游進右邊的氣泡柱浮上去', life: 420 };
        return;
      }
      // 路過一幅壁畫："riddle:mural:0"
      if (ev.indexOf && ev.indexOf('riddle:mural:') === 0) {
        const m = state.riddle && state.riddle.murals[parseInt(ev.slice(13), 10)];
        if (m) {
          Sfx.secret();
          toast = { text: '牆上的壁畫：' + Abyss.RIDDLE_NUMS[m.n] + '・' + Abyss.SYM_NAME[m.sym], sub: '記下來！潛到神殿底下，要照 I、II、III 的順序踩石板', life: 200 };
        }
        return;
      }
      if (ev === 'riddle:press') { Sfx.select(); return; }
      if (ev === 'riddle:wrong') {
        Sfx.clang(); shake = 5;
        toast = { text: '順序不對⋯⋯', sub: '石板又浮回來了 —— 回想一下牆上的壁畫：I、II、III 各是什麼圖案？', life: 200 };
        return;
      }
      if (ev === 'riddle:solved') {
        Sfx.fanfare(); shake = 8;
        Save.setFlag('abyssGate', 1);
        toast = { text: '海神的封印解開了！', sub: '大門後面⋯⋯是一整座沉在海底的城市！', life: 260 };
        return;
      }
      // v1.31 洞裡的密道："pitcave:0" = 掉進了沒有尖刺的那個斷崖
      if (ev.indexOf && ev.indexOf('pitcave:') === 0) {
        startPitCave(parseInt(ev.split(':')[1], 10), pid);
        return;
      }
      if (ev.indexOf && ev.indexOf('secret:') === 0) {
        onSecret(parseInt(ev.split(':')[1], 10));
        return;
      }
      // 第一次接近招牌機制：提示這段要注意什麼
      // 沉船潛水：撈到寶物（'relic:amphora'）
      if (ev.indexOf && ev.indexOf('relic:') === 0) {
        const rid = ev.slice(6);
        (state.relicsGot || (state.relicsGot = [])).push(rid);
        const rd = Encounter.RELICS.filter(function (q) { return q.id === rid; })[0];
        Sfx.secret(); runScore += 300;
        toast = { text: '撈到寶物：' + (rd ? rd.name : rid) + '！', sub: rd ? rd.note : '', life: 220 };
        return;
      }
      if (ev === 'duo:press') { Sfx.select(); return; }
      if (ev === 'duo:unlock') {
        Sfx.secret(); shake = 6;
        toast = { text: '石門打開了！', sub: '兩個人一起過去吧', life: 140 };
        return;
      }
      if (ev.indexOf && ev.indexOf('feature:') === 0) {
        const vt = state.def.vehicle && VEHICLE_TIPS[state.def.vehicle];
        const tip = (vt && vt[ev.slice(8)]) || FEATURE_TIPS[ev.slice(8)];
        if (tip) toast = { text: tip[0], sub: tip[1], life: 170 };
        return;
      }
      switch (ev) {
        case 'jump': Sfx.jump(); break;
        case 'doublejump': Sfx.doubleJump(); break;
        case 'walljump': Sfx.jump(); break;
        case 'land': Sfx.land(); break;
        case 'hitkill': runScore += 50; break;
        // 金幣同時給分數與錢包。
        // 分數是成績，錢包是商店可花用的餘額 —— 兩者分開記。
        // 不在這裡直接寫入存檔（每顆金幣都 persist 會很浪費），
        // 累積在 runCoins，過關或死亡時一次入帳。
        case 'coin':
          Sfx.coin();
          // stats.coinMul 已經含商店的 coinBonus（見 Equipment.resolve）
          runScore += Math.round(10 * stats.coinMul);
          runCoins++;
          break;
        case 'stomp': Sfx.stomp(); runScore += 50; break;
        case 'clang': Sfx.clang(); break;
        case 'shoot': Sfx.shoot(); break;
        case 'hurt': {
          // 騎駱駝時被打到：駱駝嚇跑，人不扣血（無敵帧照樣給）
          const rider = state.players[pid || 0];
          if (rider && rider.mount) {
            Features.dismount(state, rider);
            Sfx.clang(); shake = 6;
            toast = { text: '駱駝嚇跑了！', sub: '這一下沒有扣血 —— 牠等一下會回到原本的地方', life: 140 };
            break;
          }
          Sfx.hurt(); shake = 10; loseLife(false, pid); break;
        }
        case 'fall': {
          const faller = state.players[pid || 0];
          if (faller && faller.mount) Features.dismount(state, faller);
          // v1.31 葡萄牙商店的軟木救生圈：每關第一次掉下去不扣愛心
          if (faller && faller.stats && faller.stats.pitSave && !(state.pitUsed && state.pitUsed[pid || 0])) {
            state.pitUsed = state.pitUsed || {};
            state.pitUsed[pid || 0] = true;
            lives[pid || 0]++;
            toast = { text: '軟木救生圈救了你！', sub: '掉下去不扣愛心（這一關只有一次）', life: 160 };
          }
          Sfx.hurt(); shake = 14; loseLife(true, pid); break;
        }
        case 'mount': Sfx.equip(); break;
        case 'allythrow': Sfx.shoot(); break;
        case 'pearl': Sfx.coin(); runCoins += 10; runScore += 50; break;      // 巨蚌裡的珍珠
        // 潛水（亞特蘭提斯）
        case 'swim': break;
        case 'breathe': Sfx.coin(); break;
        case 'drown': {
          Sfx.hurt(); shake = 8;
          toast = { text: '空氣用完了！', sub: '頭上的氣泡快沒了就去找海底噴口補氣', life: 140 };
          const dp = state.players[pid || 0];
          if (dp) dp.invuln = 90 + stats.invulnBonus;
          loseLife(false, pid);
          break;
        }
        case 'equip': onEquip(); break;
        // 豎井關
        case 'spring': Sfx.jump(); break;
        case 'npc': Sfx.talk(); break;
        case 'gift':
          Sfx.equip();
          toast = { text: '拿到聖誕老人的禮物！', sub: '包得好好的一份聖誕禮物（先收著，以後會用到）', life: 300 };
          break;
        case 'npcline': break;
        case 'crumble': Sfx.land(); break;
        case 'secretbump':
          Sfx.secret(); shake = 5;
          toast = state.secrets.some(function (sc) { return sc.revealed && sc.kind === 'branch'; })
            ? { text: '咚！', sub: '旁邊彈出一塊跳板⋯⋯上面好像有另一條路', life: 170 }
            : { text: '咚！', sub: '頂出了一塊舊磚⋯⋯底下好像有什麼打開了', life: 150 };
          break;
        case 'chime': {
          const cs = state.def.shaft && state.def.shaft.chime;
          if (cs && cs.sound === 'fanfare') Sfx.fanfare();
          else if (cs && cs.sound === 'rumble') { Sfx.bossRoar(); shake = 10; }   // 亞特蘭提斯：海底地震
          else Sfx.bell();
          shake = 6;
          break;
        }
        case 'stampede': Sfx.bossRoar(); shake = 12; break;
        case 'throw': Sfx.swing(); break;
        case 'quake': shake = 8; break;
        // 海上小遊戲
        case 'shoo': Sfx.stomp(); break;
        case 'steal': Sfx.hurt(); shake = 6; break;
        case 'fire': Sfx.shoot(); shake = 4; break;
        case 'hit': Sfx.bossHit(); shake = 8; runScore += 100; break;
        case 'boom': Sfx.stomp(); shake = 8; break;
        case 'catch': Sfx.coin(); runScore += 100; break;
        case 'minifail': onMiniFail(); break;
        case 'helfall': startHel(); break;
        case 'cannon': Sfx.stomp(); shake = 8; break;
        case 'waveWarn': Sfx.land(); break;
        case 'bad:hit': Sfx.select(); break;                 // v1.31 羽球：揮拍
        case 'bad:smash': Sfx.shoot(); shake = 4; break;
        case 'bad:point': Sfx.coin(); runScore += 100; break;
        case 'bad:lose': Sfx.clang(); break;           // v1.31 古巴：浪頭在海堤後面捲起來了
        case 'pour': Sfx.land(); break;               // v1.31 牙買加：細口壺開始沖水
        // v1.31 巴西足球
        case 'kick': Sfx.stomp(); break;
        case 'save': Sfx.clang(); shake = 4; break;
        case 'goal': {
          Sfx.fanfare(); shake = 10;
          const left = state.boss ? state.boss.hp : 0;      // 進球時已經扣過了（soccerTick 同一帧呼叫 damageBoss）
          toast = { text: '進球！GOOOL！', sub: left > 0 ? '再進 ' + left + ' 球就贏了' : '最後一球！', life: 140 };
          break;
        }
        case 'beat': Sfx.stomp(); break;              // v1.31 牙買加：重低音「咚」
        case 'grab': Sfx.select(); break;             // v1.31 哥倫比亞：抓住盪繩
        case 'creak': Sfx.clang(); break;
        case 'collapse': Sfx.land(); shake = 4; break;
        case 'wave':
          Sfx.bossRoar();
          break;
        // 踩到尖刺樓梯：扣命但留在原地（玩家已被彈開，還能繼續玩）
        case 'spikefloor': Sfx.hurt(); shake = 10; loseLife(false, pid); break;
        /*
         * 被追擊的危險區碰到（descend 的尖刺天花板 / climb 的雪崩）：
         * 扣命並重新定位。
         *
         * 一定要 respawn —— 玩家是因為「被相機推到危險區」才中的，
         * 若只扣命不移動，他下一帧還在危險區裡，會連續扣到死，
         * 而且完全沒有反應機會。重生會把他放回畫面內安全的樓層。
         */
        case 'hazard': Sfx.hurt(); shake = 12; loseLife(true, pid); break;
        // 魔王
        case 'telegraph': Sfx.bossRoar(); break;
        case 'slam': shake = 16; break;
        case 'bosshit': Sfx.bossHit(); shake = 8; runScore += 150; break;
        case 'bossdown': Sfx.bossDown(); shake = 22; runScore += 800; onBossDown(); break;
        case 'blocked': Sfx.clang(); break;
        case 'clear': onClear(); break;
      }
    });

    updateCamera();
  }

  /**
   * 相機。
   *
   * 橫向關卡：只跟 x，camY 固定 0。
   * 豎井關卡：x 固定（單畫面），camY 自己往下推 —— 這是壓力來源。
   */
  function updateCamera() {
    const def = state.def;
    if (def.layout === 'race') { camX = 0; camY = 0; return; }     // 賽道關的鏡頭在 race.js 裡
    /*
     * 相機追蹤點。
     *
     * 單人就是玩家本身；兩人同機取「還活著的玩家」的中點 ——
     * 這樣兩個人都在畫面上。退場的玩家不算（否則相機會被
     * 留在原地的屍體拖住）。
     */
    const alive = state.players.filter(function (_, i) { return !downed[i]; });
    const crowd = alive.length ? alive : state.players;
    const p = crowd.length === 1 ? crowd[0] : {
      x: crowd.reduce(function (s, q) { return s + q.x; }, 0) / crowd.length,
      y: crowd.reduce(function (s, q) { return s + q.y; }, 0) / crowd.length,
      w: crowd[0].w, h: crowd[0].h
    };

    if (def.layout === 'shaft') {
      /*
       * 豎井相機 —— 純自動捲動，絕對不跟隨玩家。
       *
       * ⚠️ 這點是整個玩法的關鍵，我第一版寫錯了：
       * 原本加了一條 `follow = p.y - H*0.42` 取最大值，想「玩家降太快就跟上」。
       * 那會同時毀掉兩個核心機制：
       *   1. 掉出畫面底部永遠不會發生 —— 相機無限跟著玩家往下，
       *      玩家與畫面底的距離恆定，「掉下去死」的判定永遠不觸發
       *      （測試機器人因此掉到第 2481 層還活著，整座井只有 26 層）。
       *   2. 「站著不動也會被推向尖刺」的壓力消失 —— 相機會等玩家。
       *
       * 正確模型（跟原作一致）：
       *   平台是靜止的，相機等速往下 → 平台在畫面上往上移動。
       *   站在平台上 = 被往上推向尖刺（所以不能停）。
       *   自由落體 = 往畫面下方移動，掉出底部就死（所以不能亂衝）。
       * 兩端都會死，玩家要自己控制下降節奏。
       */
      camX = 0;
      /*
       * 相機推進交給 Shaft.advanceCam ——
       * 它內部用「相機目前所在的層」決定捲速（不是玩家位置：玩家掉出
       * 畫面時 floorAtY 會算出離譜層數，捲速會暴衝），並且到終點就停。
       *
       * 到終點必須停：不停的話危險區會繼續逼近，把站在終點的玩家擠死，
       * 而終點還有裝備要撿，等於「抵達終點反而被懲罰」。
       */
      // 傳入玩家 y：climb 模式需要「玩家爬得比相機快就跟上」，
      // 否則玩家會衝出畫面頂端看不見自己（descend 內部會忽略這個值）
      // 鐘聲加速：倍率由樓層狀態的帧數決定（測試機器人用同一個算法）
      const boost = state.shaft ? Shaft.chimeAt(def.shaft, state.shaft.frame).boost : 1;
      camY = Shaft.advanceCam(def.shaft, camY, H, p.y, boost);
      // 把 camY 同步給物理層（危險區與掉落判定都要用）
      if (state.shaft) state.shaft.camY = camY;
      return;
    }

    if (def.bossArena) {
      const a = def.bossArena;
      const tx = U.clamp(p.x - W * 0.42, a.x, Math.max(a.x, a.x + a.w - W));
      camX = U.lerp(camX, tx, 0.1);
    } else {
      const tx = U.clamp(p.x - W * 0.38, 0, Math.max(0, def.width + 160 - W));
      camX = U.lerp(camX, tx, 0.12);
    }
    camY = 0;
  }

  /** 船艙能放幾箱：造船廠的船身＋葡萄牙商店的大船艙（v1.31） */
  function holdCap() { return Trade.capacity(Save.ship()) + (Shop.resolve().hold || 0); }

  /** 商店：用金幣買永久強化 */
  function updateShop() {
    if (shopMsg && --shopMsg.life <= 0) shopMsg = null;

    const cols = 3;
    const list = Shop.itemsOf(shopSeller);      // v1.22：葡萄牙商店與神祕商人各賣各的
    const n = list.length;
    shopCursor = U.clamp(shopCursor, 0, Math.max(0, n - 1));
    if (n > 1) {
      if (Input.once('left'))  { shopCursor = (shopCursor + n - 1) % n; Sfx.select(); }
      if (Input.once('right')) { shopCursor = (shopCursor + 1) % n; Sfx.select(); }
      if (Input.once('up'))    { shopCursor = (shopCursor + n - cols) % n; Sfx.select(); }
      if (Input.once('down'))  { shopCursor = (shopCursor + cols) % n; Sfx.select(); }
    }

    if (n && Input.once('confirm')) {
      const it = list[shopCursor];
      const price = Shop.priceOf(it.id);
      const why = Shop.blockedOf(it.id);
      if (price == null && it.kind === 'look') {
        // v1.31.2 玩家：時裝、狗狗配件要可以脫下來 → 已經有的再按一次 = 穿上／脫下
        const r = Shop.toggleWear(it.id);
        shopMsg = it.mer
          ? (r === 'off' ? { text: 'Thalassa 換回白貝殼上衣', color: '#c6d2e8', life: 130 }
                         : { text: 'Thalassa 換上了' + it.name.replace('Thalassa：', '「') + '」！', color: '#8fe3a0', life: 130 })
          : it.costume
          ? (r === 'off' ? { text: '脫下「' + it.name + '」，換回條紋衫', color: '#c6d2e8', life: 130 }
                         : { text: '換上「' + it.name + '」！', color: '#8fe3a0', life: 130 })
          : (r === 'off' ? { text: '幫狗狗拿下' + it.name, color: '#c6d2e8', life: 130 }
                         : { text: '狗狗戴上了' + it.name + '！', color: '#8fe3a0', life: 130 });
        Sfx.equip();
      } else if (price == null) {
        shopMsg = { text: '已經買到最高階了', color: '#9aa7c7', life: 110 };
        Sfx.clang();
      } else if (why) {
        shopMsg = { text: why, color: '#ff9aa8', life: 150 };
        Sfx.clang();
      } else if (!Shop.canBuy(it.id)) {
        shopMsg = {
          text: '金幣不足（還差 ' + (price - Save.get().wallet) + '）',
          color: '#ff9aa8', life: 130
        };
        Sfx.clang();
      } else {
        Shop.buy(it.id);
        // 買完立刻重算能力，下一關就生效
        shopBonus = Shop.resolve();
        stats = Equipment.resolve(Save.wornIds());
        maxLives = stats.maxLives;
        shopMsg = { text: it.mer ? 'Thalassa 換上了' + it.name.replace('Thalassa：', '「') + '」！（再按一次可以換回貝殼上衣）'
                        : it.costume ? '買下「' + it.name + '」，已經穿上了！（按 I 可以換）'
                        : it.acc ? '狗狗戴上了' + it.name + '！'
                        : it.name + ' 升級了！', color: '#8fe3a0', life: 150 };
        Sfx.equip();
      }
    }

    if (Input.once('shop') || Input.once('back') || Input.once('tomap')) {
      Sfx.select(); shopMsg = null; scene = 'map';
    }
  }

  /*
   * 造船廠（v1.26）。四列：船帆、船首砲、船身、油漆。
   *   ↑↓ 選列、Enter 買下一級；油漆列 ←→ 選顏色、Enter 買（買過的直接換上）
   *   手機：點那一列（油漆點色塊）就是選＋買
   */
  const YARD_TOP = 186, YARD_ROW = 44;      // v1.30 多了火藥庫（5 列）：列高 52 → 44 才不會壓到底下的說明
  function yardBuy(row) {
    const it = Shipyard.ITEMS[row];
    const ship = Save.ship();
    const pid = Shipyard.PAINTS[yardPaint].id;
    const price = Shipyard.priceOf(it.id, ship, pid);
    if (price == null) { yardMsg = { text: it.name + '已經是最高級了', color: '#9aa7c7', life: 110 }; Sfx.clang(); return; }
    if (it.id === 'paint' && ship.paint === pid) { yardMsg = { text: '船已經是這個顏色了', color: '#9aa7c7', life: 100 }; Sfx.clang(); return; }
    if (price > Save.get().wallet) {
      yardMsg = { text: '金幣不足（還差 ' + (price - Save.get().wallet) + '）', color: '#ff9aa8', life: 130 }; Sfx.clang(); return;
    }
    Save.setShip(Shipyard.buy(it.id, ship, pid), price);
    Sfx.equip();
    yardMsg = it.id === 'paint'
      ? { text: '船漆成「' + Shipyard.PAINTS[yardPaint].name + '」了！', color: '#8fe3a0', life: 130 }
      : { text: it.name + ' 升到 Lv' + Save.ship()[it.id] + '！' + it.desc(Save.ship()[it.id]), color: '#8fe3a0', life: 150 };
  }
  function updateShipyard() {
    if (yardMsg && --yardMsg.life <= 0) yardMsg = null;
    const n = Shipyard.ITEMS.length;
    if (Input.once('up')) { yardCursor = (yardCursor + n - 1) % n; Sfx.select(); }
    if (Input.once('down')) { yardCursor = (yardCursor + 1) % n; Sfx.select(); }
    if (Shipyard.ITEMS[yardCursor].id === 'paint') {
      const m = Shipyard.PAINTS.length;
      if (Input.once('left')) { yardPaint = (yardPaint + m - 1) % m; Sfx.select(); }
      if (Input.once('right')) { yardPaint = (yardPaint + 1) % m; Sfx.select(); }
    }
    if (Input.once('confirm')) yardBuy(yardCursor);
    const click = Input.takeClick();
    if (click) {
      for (let r = 0; r < n; r++) {
        const y = YARD_TOP + r * YARD_ROW;
        if (click.x < 150 || click.x > W - 150 || click.y < y || click.y > y + YARD_ROW - 6) continue;
        yardCursor = r;
        if (Shipyard.ITEMS[r].id === 'paint') {
          // 點色塊選顏色（再點一次同一塊 = 買／換上）
          const k = Math.floor((click.x - 470) / 64);
          if (k >= 0 && k < Shipyard.PAINTS.length) {
            if (k !== yardPaint) { yardPaint = k; Sfx.select(); break; }
          } else break;
        }
        yardBuy(r);
        break;
      }
    }
    if (Input.once('back') || Input.once('tomap') || Input.once('shop')) { Sfx.select(); yardMsg = null; scene = 'map'; }
  }

  /** 造船廠畫面的船（放大的側面，跟地圖上的船同一套顏色） */
  function drawYardShip(x, y, s, ship, t) {
    const pt = Shipyard.paint(ship);
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 0.04) * 2);
    ctx.scale(s, s);
    ctx.fillStyle = pt.hull;
    ctx.beginPath(); ctx.moveTo(-26, -4); ctx.lineTo(28, -4); ctx.lineTo(18, 8); ctx.lineTo(-20, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pt.trim;
    ctx.fillRect(-24, -4, 50, 2.5);
    if (ship.cannon > 0) { ctx.fillStyle = '#2a2a30'; ctx.fillRect(24, -9, 9, 4); }
    ctx.fillStyle = '#d8d0bc'; ctx.fillRect(-1.5, -40, 3, 36);
    const big = 1 + ship.sail * 0.16;
    ctx.fillStyle = pt.sail;
    ctx.beginPath(); ctx.moveTo(1.5, -40 * big); ctx.quadraticCurveTo(22 * big, -24, 1.5, -6); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(-1.5, -36 * big); ctx.quadraticCurveTo(-18 * big, -22, -1.5, -8); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    if (ship.hull > 0) {
      // 加厚船身：船殼上一排鉚釘
      ctx.fillStyle = 'rgba(240, 220, 160, 0.8)';
      for (let k = 0; k < 4 + ship.hull * 2; k++) ctx.fillRect(-18 + k * (36 / (3 + ship.hull * 2)), 1, 2, 2);
    }
    ctx.restore();
    // 海面
    ctx.strokeStyle = 'rgba(160, 210, 240, 0.6)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = -110; k <= 110; k += 10) {
      const yy = y + 8 * s + Math.sin(k * 0.08 + t * 0.06) * 2;
      if (k === -110) ctx.moveTo(x + k, yy); else ctx.lineTo(x + k, yy);
    }
    ctx.stroke();
  }

  function drawShipyard() {
    const sv = Save.get();
    drawMapBackdrop(sv);
    ctx.fillStyle = 'rgba(8,12,24,0.86)';
    ctx.fillRect(0, 0, W, H);
    panel(120, 22, W - 240, H - 44);
    U.text(ctx, '瓦倫西亞造船廠', W / 2, 52, { size: 26, color: '#ffd166' });
    U.text(ctx, '中世紀的皇家造船廠 Drassanes del Grau・升級你的船　錢包 \u20AC ' + sv.wallet, W / 2, 80, { size: 13, color: '#9fb4d8' });
    const ship = Save.ship();
    drawYardShip(W / 2, 156, 1.6, ship, t);

    Shipyard.ITEMS.forEach(function (it, r) {
      const y = YARD_TOP + r * YARD_ROW;
      const sel = r === yardCursor;
      ctx.fillStyle = sel ? 'rgba(255, 209, 102, 0.14)' : 'rgba(255,255,255,0.05)';
      U.roundRect(ctx, 150, y, W - 300, YARD_ROW - 6, 8); ctx.fill();
      ctx.strokeStyle = sel ? '#ffd166' : 'rgba(126,151,201,0.5)'; ctx.lineWidth = sel ? 2 : 1;
      U.roundRect(ctx, 150, y, W - 300, YARD_ROW - 6, 8); ctx.stroke();
      const cy = y + (YARD_ROW - 6) / 2;
      U.text(ctx, it.name, 170, cy - 8, { size: 16, color: '#ffffff', align: 'left' });
      if (it.id === 'paint') {
        U.text(ctx, it.desc(), 170, cy + 11, { size: 11, color: '#9fb4d8', align: 'left' });
        Shipyard.PAINTS.forEach(function (p, k) {
          const px = 470 + k * 64, owned = ship.paints.indexOf(p.id) >= 0;
          const on = ship.paint === p.id, pick = sel && k === yardPaint;
          ctx.fillStyle = p.hull;
          U.roundRect(ctx, px, cy - 15, 54, 22, 5); ctx.fill();
          ctx.fillStyle = p.sail;
          ctx.fillRect(px + 20, cy - 13, 14, 8);
          ctx.strokeStyle = pick ? '#ffd166' : on ? '#8fe3a0' : 'rgba(255,255,255,0.3)';
          ctx.lineWidth = pick || on ? 2.2 : 1;
          U.roundRect(ctx, px, cy - 15, 54, 22, 5); ctx.stroke();
          U.text(ctx, on ? '使用中' : owned ? p.name : (p.price ? '\u20AC ' + p.price : p.name), px + 27, cy + 15,
            { size: 10, color: on ? '#8fe3a0' : owned ? '#dce5f5' : '#ffd166' });
        });
        return;
      }
      const lv = ship[it.id];
      // 等級格子
      for (let k = 0; k < it.max; k++) {
        ctx.fillStyle = k < lv ? '#8fe3a0' : 'rgba(255,255,255,0.14)';
        U.roundRect(ctx, 290 + k * 22, cy - 15, 18, 10, 3); ctx.fill();
      }
      U.text(ctx, '目前：' + it.desc(lv), 290, cy + 9, { size: 12, color: '#c6d2e8', align: 'left' });
      const price = Shipyard.priceOf(it.id, ship);
      U.text(ctx, price == null ? '已滿級' : fitText('下一級：' + it.desc(lv + 1), 230, 12), 480, cy - 8, { size: 12, color: price == null ? '#8fe3a0' : '#dce5f5', align: 'left' });
      if (price != null) {
        U.text(ctx, '\u20AC ' + price, W - 170, cy - 8, { size: 15, color: price <= sv.wallet ? '#ffd166' : '#ff9aa8', align: 'right' });
      }
    });

    const cur = Shipyard.ITEMS[yardCursor];
    const foot = yardMsg ? yardMsg.text : (cur.note || '←→ 選顏色，Enter 買下來或換上');
    U.text(ctx, fitText(foot, W - 300, 13), W / 2, H - 52, { size: 13, color: yardMsg ? yardMsg.color : '#9aa7c7' });
    U.text(ctx, '↑↓ 選擇　Enter 升級／購買　Esc、Q 回地圖', W / 2, H - 30, { size: 12, color: '#7d88a6' });
  }

  // ── 貿易港（C 貿易、D 懸賞，v1.27）──────────────────────

  /** 海戰打輸（時間到或沒命）：船上有貨的話，海盜搶走一箱（潛水不算：人下水了，船沒事） */
  function loseCargo() {
    deadNote = null;
    if (!skirmish || skirmish.def.dive || skirmish.def.duo || !Save.cargoCount()) return;
    const id = Object.keys(Save.get().cargo)[0];
    Save.moveCargo(id, -1, 0);
    deadNote = '趁亂被搶走了一箱' + Trade.good(id).name + '⋯⋯';
  }

  function completeBounty(b) {
    Save.finishBounty();
    Save.addCoins(b.reward);
    Save.gainExp(b.exp);
    Sfx.fanfare();
    bountyNote = { text: '懸賞完成！', sub: Trade.describe(b) + '　＋€' + b.reward + '　＋' + b.exp + ' EXP', life: 240 };
  }

  /** 靠岸：送信、運貨的懸賞在這裡交件 */
  function arriveAt(portId) {
    const b = Save.get().bounty;
    if (!b || b.to !== portId) return;
    if (b.type === 'letter') { completeBounty(b); mkMsg = { text: bountyNote.sub, color: '#8fe3a0', life: 200 }; bountyNote = null; }
    if (b.type === 'cargo' && (Save.get().cargo[b.good] || 0) >= b.n) {
      Save.moveCargo(b.good, -b.n, 0);
      completeBounty(b); mkMsg = { text: '貨交給委託人了！' + bountyNote.sub, color: '#8fe3a0', life: 220 }; bountyNote = null;
    }
  }

  const MK_TOP = 168, MK_ROW = 52;
  /** 今天的委託（已經接下的那張不再列出來） */
  function mkOffers() {
    const sv = Save.get();
    return Trade.offers(sv.day, sv.bountyDone).filter(function (o) { return !sv.bounty || o.id !== sv.bounty.id; });
  }

  function mkTrade(row, col) {
    const sv = Save.get();
    const g = Trade.GOODS[row];
    const pr = Trade.price(mkPort, g.id, sv.day);
    if (col === 0) {
      if (pr.buy == null) { mkMsg = { text: '這裡不產' + g.name + '：要到產地' + Trade.port(g.home).name + '買', color: '#9aa7c7', life: 130 }; Sfx.clang(); return; }
      if (Save.cargoCount() >= holdCap()) { mkMsg = { text: '船艙滿了（造船廠加厚船身、葡萄牙商店的大船艙可以多放）', color: '#ff9aa8', life: 130 }; Sfx.clang(); return; }
      if (sv.wallet < pr.buy) { mkMsg = { text: '金幣不足（還差 ' + (pr.buy - sv.wallet) + '）', color: '#ff9aa8', life: 120 }; Sfx.clang(); return; }
      Save.moveCargo(g.id, 1, -pr.buy);
      Sfx.coin();
      mkMsg = { text: '買進一箱' + g.name + '（€' + pr.buy + '）', color: '#8fe3a0', life: 100 };
    } else {
      if (!(sv.cargo[g.id] > 0)) { mkMsg = { text: '船上沒有' + g.name, color: '#9aa7c7', life: 100 }; Sfx.clang(); return; }
      Save.moveCargo(g.id, -1, pr.sell);
      Sfx.coin();
      mkMsg = { text: '賣出一箱' + g.name + '，賺到 €' + pr.sell, color: '#ffd166', life: 110 };
    }
  }

  function mkBounty(row) {
    const sv = Save.get();
    if (row === 0) {
      if (!sv.bounty) return;
      if (!mkAbandon) { mkAbandon = true; mkMsg = { text: '再按一次放棄這張懸賞', color: '#ff9aa8', life: 150 }; Sfx.clang(); return; }
      Save.finishBounty(); mkAbandon = false;
      mkMsg = { text: '放棄了懸賞', color: '#9aa7c7', life: 110 }; Sfx.select();
      return;
    }
    const b = mkOffers()[row - 1];
    if (!b) return;
    if (sv.bounty) { mkMsg = { text: '一次只能接一張：先完成或放棄目前這張', color: '#ff9aa8', life: 140 }; Sfx.clang(); return; }
    const copy = JSON.parse(JSON.stringify(b));
    if (copy.type === 'hunt') copy.got = 0;
    Save.setBounty(copy);
    Sfx.equip();
    mkMsg = { text: '接下懸賞：' + Trade.describe(copy), color: '#8fe3a0', life: 160 };
  }

  function updateMarket() {
    if (mkMsg && --mkMsg.life <= 0) { mkMsg = null; mkAbandon = false; }
    const rows = mkTab === 0 ? Trade.GOODS.length : 4;
    if (Input.once('up')) { mkRow = mkRow <= -1 ? rows - 1 : mkRow - 1; Sfx.select(); }
    if (Input.once('down')) { mkRow = mkRow >= rows - 1 ? -1 : mkRow + 1; Sfx.select(); }
    if (mkRow === -1) {
      if (Input.once('left') || Input.once('right')) { mkTab = 1 - mkTab; mkMsg = null; Sfx.select(); }
    } else if (mkTab === 0) {
      if (Input.once('left')) { mkCol = 0; Sfx.select(); }
      if (Input.once('right')) { mkCol = 1; Sfx.select(); }
    }
    if (Input.once('confirm')) {
      if (mkRow === -1) { mkTab = 1 - mkTab; Sfx.select(); }
      else if (mkTab === 0) mkTrade(mkRow, mkCol);
      else mkBounty(mkRow);
    }
    const click = Input.takeClick();
    if (click) {
      // 分頁
      if (click.y >= 104 && click.y <= 136) {
        const k = click.x < W / 2 ? 0 : 1;
        if (k !== mkTab) { mkTab = k; mkRow = 0; Sfx.select(); }
      } else {
        const r = Math.floor((click.y - MK_TOP) / MK_ROW);
        if (r >= 0 && r < rows && click.x > 150 && click.x < W - 150) {
          mkRow = r;
          if (mkTab === 0) {
            if (click.x > 560 && click.x < 680) { mkCol = 0; mkTrade(r, 0); }
            else if (click.x >= 680) { mkCol = 1; mkTrade(r, 1); }
          } else mkBounty(r);
        }
      }
    }
    if (Input.once('back') || Input.once('tomap') || Input.once('shop')) { Sfx.select(); mkMsg = null; scene = 'map'; }
  }

  function drawCrate(x, y, color) {
    ctx.fillStyle = '#8a5a30';
    ctx.fillRect(x - 13, y - 11, 26, 22);
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2;
    ctx.strokeRect(x - 13, y - 11, 26, 22);
    ctx.beginPath(); ctx.moveTo(x - 13, y - 11); ctx.lineTo(x + 13, y + 11); ctx.moveTo(x + 13, y - 11); ctx.lineTo(x - 13, y + 11); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  }

  function drawMarket() {
    const sv = Save.get();
    drawMapBackdrop(sv);
    ctx.fillStyle = 'rgba(8,12,24,0.86)';
    ctx.fillRect(0, 0, W, H);
    panel(120, 22, W - 240, H - 44);
    const pt = Trade.port(mkPort);
    U.text(ctx, pt.name + '・貿易港', W / 2, 50, { size: 24, color: '#ffd166' });
    U.text(ctx, '第 ' + (sv.day + 1) + ' 天　錢包 \u20AC ' + sv.wallet + '　船艙 ' + Save.cargoCount() + ' / ' + holdCap() + ' 箱',
      W / 2, 80, { size: 13, color: '#9fb4d8' });
    // 分頁
    ['交易', '懸賞板'].forEach(function (name, k) {
      const x = k === 0 ? W / 2 - 150 : W / 2 + 10;
      const on = mkTab === k, sel = mkRow === -1 && on;
      ctx.fillStyle = on ? 'rgba(255, 209, 102, 0.2)' : 'rgba(255,255,255,0.05)';
      U.roundRect(ctx, x, 104, 140, 30, 8); ctx.fill();
      ctx.strokeStyle = sel ? '#ffffff' : on ? '#ffd166' : 'rgba(126,151,201,0.5)'; ctx.lineWidth = sel ? 2.4 : 1.2;
      U.roundRect(ctx, x, 104, 140, 30, 8); ctx.stroke();
      U.text(ctx, name + (k === 1 && sv.bounty ? '（進行中）' : ''), x + 70, 119, { size: 14, color: on ? '#ffd166' : '#c6d2e8' });
    });

    if (mkTab === 0) {
      Trade.GOODS.forEach(function (g, r) {
        const y = MK_TOP + r * MK_ROW, cy = y + (MK_ROW - 6) / 2;
        const sel = mkRow === r;
        ctx.fillStyle = sel ? 'rgba(255, 209, 102, 0.1)' : 'rgba(255,255,255,0.04)';
        U.roundRect(ctx, 150, y, W - 300, MK_ROW - 6, 8); ctx.fill();
        drawCrate(178, cy, g.color);
        U.text(ctx, g.name, 204, cy - 8, { size: 15, color: '#ffffff', align: 'left' });
        U.text(ctx, '產地：' + Trade.port(g.home).name + (g.home === mkPort ? '（這裡）' : ''), 204, cy + 11, { size: 11, color: '#9fb4d8', align: 'left' });
        U.text(ctx, '船上 ' + (sv.cargo[g.id] || 0) + ' 箱', 420, cy, { size: 13, color: sv.cargo[g.id] ? '#ffe070' : '#7d88a6', align: 'left' });
        const pr = Trade.price(mkPort, g.id, sv.day);
        [[0, '買', pr.buy], [1, '賣', pr.sell]].forEach(function (bt) {
          const bx = bt[0] === 0 ? 566 : 686;
          const on = sel && mkCol === bt[0];
          const ok = bt[0] === 0 ? pr.buy != null : (sv.cargo[g.id] || 0) > 0;
          ctx.fillStyle = on ? 'rgba(255, 209, 102, 0.3)' : ok ? 'rgba(143, 227, 160, 0.12)' : 'rgba(255,255,255,0.04)';
          U.roundRect(ctx, bx, cy - 15, 104, 30, 7); ctx.fill();
          ctx.strokeStyle = on ? '#ffd166' : ok ? 'rgba(143,227,160,0.6)' : 'rgba(126,151,201,0.3)'; ctx.lineWidth = on ? 2 : 1;
          U.roundRect(ctx, bx, cy - 15, 104, 30, 7); ctx.stroke();
          U.text(ctx, bt[2] == null ? '不賣' : bt[1] + ' \u20AC' + bt[2], bx + 52, cy, { size: 13, color: ok ? '#ffffff' : '#7d88a6' });
        });
      });
    } else {
      const b = sv.bounty;
      const rows = [b ? { text: '進行中：' + Trade.describe(b) + (b.type === 'letter' ? '　剩 ' + Math.ceil(b.time / 60) + ' 秒' : ''), sub: '獎勵 €' + b.reward + '・' + b.exp + ' EXP　（Enter 兩次＝放棄）', active: true }
                        : { text: '目前沒有接懸賞', sub: '從下面挑一張（一次只能接一張）', active: false }];
      mkOffers().forEach(function (o) { rows.push({ text: Trade.describe(o), sub: '獎勵 €' + o.reward + '・' + o.exp + ' EXP', offer: true }); });
      rows.forEach(function (q, r) {
        const y = MK_TOP + r * MK_ROW, cy = y + (MK_ROW - 6) / 2;
        const sel = mkRow === r;
        ctx.fillStyle = q.active ? 'rgba(143, 227, 160, 0.14)' : sel ? 'rgba(255, 209, 102, 0.1)' : 'rgba(255,255,255,0.04)';
        U.roundRect(ctx, 150, y, W - 300, MK_ROW - 6, 8); ctx.fill();
        ctx.strokeStyle = sel ? '#ffd166' : q.active ? '#8fe3a0' : 'rgba(126,151,201,0.4)'; ctx.lineWidth = sel ? 2 : 1;
        U.roundRect(ctx, 150, y, W - 300, MK_ROW - 6, 8); ctx.stroke();
        // 懸賞單：一張釘在板上的紙
        ctx.fillStyle = q.offer ? '#e8dcc0' : q.active ? '#8fe3a0' : '#5a6a8a';
        ctx.fillRect(166, cy - 13, 20, 26);
        ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(176, cy - 11, 2.5, 0, Math.PI * 2); ctx.fill();
        U.text(ctx, fitText(q.text, W - 400, 14), 200, cy - 8, { size: 14, color: '#ffffff', align: 'left' });
        U.text(ctx, q.sub, 200, cy + 11, { size: 11, color: '#9fb4d8', align: 'left' });
      });
    }
    const foot = mkMsg ? mkMsg.text
      : mkTab === 0 ? '在產地買便宜、運到越遠的港口賣越貴；行情每天變（打完一關或一場海戰就過一天）・船上有貨海盜比較多'
      : '完成後自動領賞・送信只有在大地圖上才會倒數';
    U.text(ctx, fitText(foot, W - 280, 12), W / 2, H - 52, { size: 12, color: mkMsg ? mkMsg.color : '#9aa7c7' });
    U.text(ctx, '↑↓ 選擇（最上面換分頁）　←→ 買／賣　Enter 確定　Esc、Q 回地圖', W / 2, H - 30, { size: 12, color: '#7d88a6' });
  }

  function onSecret(idx) {
    const sc = state.secrets[idx];
    if (!sc) return;
    Sfx.secret();
    // 亞特蘭提斯（levelIndex -1，不在關卡清單裡）的密道不記進存檔：存檔是照關卡編號記的
    const first = levelIndex < 0 ? true : Save.markSecret(levelIndex, idx);
    if (levelIndex >= 0) netProgress({ t: 'secret', li: levelIndex, idx: idx });
    runScore += 250;
    toast = {
      text: '發現密道！',
      sub: first ? sc.hint : '（之前就找過這條）',
      life: 200
    };
  }

  /*
   * v1.31 玩家：密道太明顯、其中一些密道放到會死掉的洞（某些刺換成洞）。
   * 掉進那個洞：第一次 = 發現密道（存檔）＋洞窟裡的金幣＋這關的裝備；之後再掉進去只是繞一圈。
   * 洞窟的畫面播 PIT_CAVE_T 帧，然後人從斷崖對面（sc.exit）爬上來，給一點無敵時間。
   */
  const PIT_CAVE_T = 170;
  function startPitCave(idx, pid) {
    const sc = state.secrets[idx];
    if (!sc) return;
    const first = !sc.found;
    let coinsGot = 0, eq = null;
    if (first) {
      sc.found = true;
      state.secretsFound++;
      onSecret(idx);
      sc.coins.forEach(function (c) {
        if (c.taken) return;
        c.taken = true; coinsGot++;
        runCoins++; runScore += Math.round(10 * stats.coinMul);
      });
    }
    if (state.equip && !state.equip.taken && state.equip.secretIdx === idx) {
      state.equip.taken = true;
      eq = state.equip.def;
      onEquip();
    }
    Sfx.secret();
    state.pitCave = { idx: idx, pid: pid || 0, t: 0, first: first, coins: coinsGot, eq: eq, hint: sc.hint };
    toast = null;
  }
  function updatePitCave() {
    const pc = state.pitCave;
    if (++pc.t < PIT_CAVE_T && !(pc.t > 40 && (Input.once('confirm') || Input.once('jump')))) return;
    const sc = state.secrets[pc.idx], p = state.players[pc.pid] || state.player;
    if (p.mount) Features.dismount(state, p);
    p.x = sc.exit.x; p.y = sc.exit.y - p.h; p.vx = 0; p.vy = 0; p.onGround = true;
    p.invuln = Math.max(p.invuln || 0, 60);
    state.pitCave = null; state.pitIn = false;
    toast = pc.first ? { text: '從洞窟爬上來了！', sub: '洞裡的東西都拿到了', life: 140 } : null;
  }
  /** 地底洞窟的畫面：岩壁、火把、鐘乳石、這次拿到的金幣和裝備 */
  function drawPitCave() {
    const pc = state.pitCave;
    const k = U.clamp(pc.t / 20, 0, 1), out = U.clamp((PIT_CAVE_T - pc.t) / 16, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.min(k, out);
    ctx.fillStyle = '#14100c'; ctx.fillRect(0, 0, W, H);
    // 岩壁
    ctx.fillStyle = '#3a2e24';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 360 + Math.sin(x * 0.03) * 24 + Math.sin(x * 0.011) * 18);
    ctx.lineTo(W, H); ctx.fill();
    ctx.fillStyle = '#2a2018';
    for (let x = 30; x < W; x += 70) {
      const h = 40 + ((x * 37) % 50);
      ctx.beginPath(); ctx.moveTo(x - 14, 0); ctx.lineTo(x, h); ctx.lineTo(x + 14, 0); ctx.fill();   // 鐘乳石
    }
    // 火把的光
    [[150, 230], [W - 150, 230]].forEach(function (f) {
      const r = 120 + Math.sin(t * 0.2 + f[0]) * 6;
      const g = ctx.createRadialGradient(f[0], f[1], 4, f[0], f[1], r);
      g.addColorStop(0, 'rgba(255, 190, 90, 0.55)'); g.addColorStop(1, 'rgba(255, 190, 90, 0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f[0], f[1], r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(f[0] - 3, f[1], 6, 26);
      ctx.fillStyle = '#ffb040'; ctx.beginPath(); ctx.ellipse(f[0], f[1] - 4, 6, 10 + Math.sin(t * 0.4) * 2, 0, 0, Math.PI * 2); ctx.fill();
    });
    U.text(ctx, pc.first ? '地底的洞窟！' : '又掉進洞窟了', W / 2, 120, { size: 30, color: '#ffd166' });
    U.text(ctx, fitText(pc.hint || '', W - 160, 15), W / 2, 158, { size: 15, color: '#e8dcc0' });
    // 拿到的東西
    let y = 230;
    if (pc.coins) {
      for (let i = 0; i < pc.coins; i++) {
        const bob = Math.sin(t * 0.1 + i) * 4;
        Sprites.coin(ctx, { x: W / 2 - pc.coins * 17 + i * 34, y: y - 12 + bob }, t);
      }
      U.text(ctx, '金幣 +' + pc.coins, W / 2, y + 34, { size: 15, color: '#ffd166' });
      y += 70;
    }
    if (pc.eq) {
      ctx.fillStyle = 'rgba(255, 220, 130, 0.25)'; ctx.beginPath(); ctx.arc(W / 2, y + 10, 30, 0, Math.PI * 2); ctx.fill();
      Sprites.equipIcon(ctx, pc.eq.id, W / 2, y + 10, 1);
      U.text(ctx, (Equipment.get(pc.eq.id) ? '裝備：' : '紀念品：') + pc.eq.name, W / 2, y + 56, { size: 16, color: '#ffffff' });
    } else if (!pc.coins) {
      U.text(ctx, '洞裡已經空了，爬回上面吧', W / 2, y + 10, { size: 15, color: '#c6b89a' });
    }
    // 你（站在洞窟底，抬頭看）
    const p = state.players[pc.pid] || state.player;
    Sprites.player(ctx, { x: W / 2 - 160, y: 322, w: 22, h: 40, facing: 1, onGround: true, vx: 0, invuln: 0, pid: p.pid || 0,
                          equipped: p.equipped || {}, costume: p.costume || Save.get().costume }, t);
    if (pc.t > 40) U.text(ctx, '按跳躍爬上去', W / 2, H - 30, { size: 13, color: '#9a8a70' });
    ctx.restore();
  }

  function onBossDown() {
    Save.markBoss(levelIndex);
    netProgress({ t: 'boss', li: levelIndex });
    toast = { text: '魔王倒下了', sub: '去撿它掉下來的東西', life: 220 };
  }

  function onEquip() {
    const e = state.equip;
    Sfx.equip();
    // v1.31 美洲篇：紀念品只收藏，不重算能力
    if (e.souvenir || !Equipment.get(e.id)) {
      Save.addSouvenir(e.id);
      newEquip = e.def;
      toast = { text: '取得紀念品：' + e.def.name, sub: e.def.note, life: 260 };
      netProgress({ t: 'equip', id: e.id });
      runScore += 200;
      return;
    }
    Save.addEquip(e.id);
    newEquip = e.def;
    toast = { text: '取得 ' + e.def.name, sub: e.def.desc, life: 220 };
    // 立刻生效：重算能力值，愛心上限提高就補一顆
    const prevMax = maxLives;
    stats = Equipment.resolve(Save.wornIds());
    // 能力值是共用的（裝備存檔也是共用），兩位玩家一起更新；
    // 人物身上畫的配件也跟著換（新裝備部位空著才會裝上，見 Save.addEquip）
    state.players.forEach(function (q) {
      q.stats = stats;
      q.equipped = {};
      stats.worn.forEach(function (id) { q.equipped[id] = true; });
    });
    // 連線：P2 是朋友，用朋友自己的裝備算能力（這件也算他拿到）
    if (isHost() && net.levelLive && state.players[1]) {
      if (net.guestEquip.indexOf(e.id) < 0) net.guestEquip.push(e.id);
      net.guestStats = Equipment.resolve(Equipment.pickWorn(net.guestEquip));
      state.players[1].stats = net.guestStats;
      state.players[1].equipped = {};
      net.guestStats.worn.forEach(function (id) { state.players[1].equipped[id] = true; });
    }
    netProgress({ t: 'equip', id: e.id });
    maxLives = stats.maxLives;
    if (maxLives > prevMax) {
      const gain = maxLives - prevMax;
      for (let k = 0; k < lives.length; k++) lives[k] += gain;
    }
    runScore += 200;
  }

  /**
   * 扣一條命。
   *
   * pid 指定是哪位玩家（預設 0 = P1）。
   * 兩人同機時每人有自己的命；一個人沒命只是「退場」，
   * 隊友還能繼續玩並過關 —— 只有「全部玩家都沒命」才算失敗。
   * 這比共用命數好：不會一個人亂玩就直接結束兩人的遊戲。
   */
  /** 場上所有玩家剩餘命的總和（計分與過關畫面用） */
  function livesTotal() {
    const n = coop ? 2 : 1;
    let s = 0;
    for (let i = 0; i < n; i++) s += Math.max(0, lives[i]);
    return s;
  }

  function loseLife(respawn, pid) {
    const i = pid || 0;
    // 法蒂瑪之手（v1.23）：每關第一次被打掉最後一顆愛心時擋下來
    const guard = state.players[i] && state.players[i].stats && state.players[i].stats.guardian;
    if (lives[i] <= 1 && guard && !(state.guardUsed && state.guardUsed[i])) {
      state.guardUsed = state.guardUsed || {};
      state.guardUsed[i] = true;
      Sfx.equip();
      toast = { text: '法蒂瑪之手護住了你！', sub: '這一關不會再擋第二次', life: 160 };
      lives[i]++;
    }
    lives[i]--;
    if (lives[i] <= 0) {
      downed[i] = true;
      // 還有隊友活著 → 這位玩家退場，遊戲繼續
      const anyAlive = state.players.some(function (_, k) { return !downed[k]; });
      // 雙人試煉少一個人就過不去了 → 直接算失敗，不要讓剩下的人卡在閘門前
      const duoOut = anyAlive && state.duo;
      if (anyAlive && !state.duo) {
        Sfx.hurt();
        toast = {
          text: (i === 0 ? '玩家 1' : '玩家 2') + ' 沒命了',
          sub: '隊友還能繼續 —— 撐到終點就好',
          life: 160
        };
        return;
      }
      Sfx.gameover();
      loseCargo();       // 海戰沒命：船上的貨被搶走一箱（見 loseCargo）
      if (duoOut) deadNote = (i === 0 ? '玩家 1' : '玩家 2') + ' 沒命了 —— 雙人試煉要兩個人一起才過得去';
      // 死掉也保留撿到的金幣（否則練習關卡完全沒收益，玩家會覺得白跑）
      // 但只給一半，死亡仍有代價。
      const keep = Math.floor(runCoins / 2);
      if (keep > 0) Save.addCoins(keep);
      netProgress({ t: 'coins', n: keep });
      coinsBanked = keep;
      runCoins = 0;
      Music.stop();
      scene = 'dead';
      sceneTimer = 50;
      return;
    }
    if (respawn) {
      const p = state.players[i];

      /*
       * 豎井關的重生：放回「畫面上方還看得到的最高一層」。
       *
       * ⚠️ 不能走下面的橫向邏輯 —— 豎井關的 def.ground 是空陣列
       * （底下是無底洞），那段迴圈不會跑，sy 會留在 Levels.GROUND_Y，
       * 玩家會被塞到一個跟目前深度完全無關的高度。
       *
       * 相機不回退（保持壓力），所以重生點必須在目前可見範圍內，
       * 而且要離天花板遠一點，不然一重生又被刺。
       */
      if (state.shaft) {
        // 豎井的重生邏輯放在 entities.js，測試機器人共用同一份
        respawnInShaft(state, 90 + stats.invulnBonus, p);
        return;
      }

      const segs = state.def.ground;
      let sx = state.def.spawnX || 60;
      let sy = Levels.GROUND_Y;
      // 退回「玩家左側最近的一段地面」，而且要用那段地面的實際高度。
      for (let i = 0; i < segs.length; i++) {
        if (segs[i].x <= p.x) { sx = segs[i].x + 40; sy = segs[i].y; }
      }
      // 魔王關要退回場內，而且離魔王遠一點
      if (state.def.bossArena) { sx = state.def.bossArena.x + 40; sy = Levels.GROUND_Y; }
      p.x = sx;
      p.y = sy - p.h - 4;
      p.vx = 0; p.vy = 0;
      p.ridingMover = null;
      p.invuln = 90 + stats.invulnBonus;
      camX = U.clamp(p.x - W * 0.38, 0, Math.max(0, state.def.width + 160 - W));
    }
  }

  /** 海上小遊戲失敗（時間到、麵包被搶光⋯⋯）：跟關卡死掉走同一個畫面 */
  function onMiniFail() {
    Sfx.gameover();
    loseCargo();
    coinsBanked = 0;
    runCoins = 0;
    Music.stop();
    // 稀有怪沒抓到就跑掉了（不會留在海上等你）
    if (skirmish && skirmish.def.rare) Encounter.remove(skirmish);
    scene = 'dead';
    sceneTimer = 50;
  }

  function onClear() {
    Sfx.clear();
    if (state.coinsGot === state.coinsTotal && state.coinsTotal > 0) runScore += 300;
    // 剩餘命獎勵：兩人同機時把雙方剩下的命一起算
    runScore += livesTotal() * 100;
    Save.addScore(runScore);
    // 金幣入帳到錢包（商店花用）。全收額外給 50% 獎勵。
    let gain = runCoins;
    if (state.coinsTotal > 0 && state.coinsGot === state.coinsTotal) {
      gain += Math.ceil(runCoins * 0.5);
    }
    if (gain > 0) Save.addCoins(gain);
    coinsBanked = gain;
    runCoins = 0;
    if (skirmish) {
      // 遭遇戰不記關卡進度，改給 EXP；怪物從地圖上消失
      // v1.31 新大陸的怪給「美洲 EXP」（跟歐洲的分開累積，解鎖南美用）
      // v1.31 葡萄牙商店的航海家星盤：EXP 加成
      const expGain = Math.round(state.def.exp * (1 + (Shop.resolve().expBonus || 0)));
      const r = state.def.am ? Save.addExpAm(expGain) : Save.addExp(expGain);
      expResult = { gain: expGain, before: r.before, after: r.after, costume: null, am: !!state.def.am };
      netProgress({ t: 'exp', n: expGain, gain: gain });
      // 海上魔王：第一次打倒加送金幣（之後再打只給一般 EXP）
      if ((skirmish.def.boss || skirmish.def.dive || skirmish.def.fixed || skirmish.def.duo || skirmish.def.quest) && Save.markSeaBoss(skirmish.kind)) {
        Save.addCoins(state.def.bossCoins || 0);
        coinsBanked += state.def.bossCoins || 0;
        expResult.firstBoss = skirmish.def.name;
      }
      // v1.31.2 亞特蘭提斯：過關畫面講海神的封印（解開了 = 海底城開了；沒解開 = 提示下次怎麼解）
      if (skirmish.kind === 'atlantis' && state.riddle) {
        const rd = state.riddle;
        expResult.note = rd.done ? '封印解開了！回大地圖在亞特蘭提斯按 Enter，就能潛進海底城'
          : rd.solved ? '海底城的大門開著 —— 回大地圖在亞特蘭提斯按 Enter 潛進去'
          : '神殿大門的封印還沒解開 —— 下次潛下來，記住牆上三幅壁畫（I、II、III）的圖案';
      }
      // 安提基特拉沉船：沿路撈到的寶物＋終點的安提基特拉機械，收進存檔
      // v1.31.2 玩家：亞特蘭提斯的夥伴移到沉船那關 → 每次撈起機械都拿到一個海神夥伴（最多 Save.ALLY_MAX 個）
      if (skirmish.kind === 'wreck') {
        const before = Save.get().allies;
        expResult.ally = { now: Save.addAlly(), full: before >= Save.ALLY_MAX };
        const got = (state.relicsGot || []).concat(['mechanism']);
        expResult.relics = got.map(function (id) {
          const rd = Encounter.RELICS.filter(function (q) { return q.id === id; })[0];
          return { id: id, name: rd ? rd.name : id, fresh: Save.addRelic(id) };
        });
      }
      // v1.30 戰艦、動物大遷徙、冥界、金字塔（expedition.js）
      if (skirmish.def.custom) {
        const ex = Expedition.onClear(skirmish, state);
        if (ex.note) expResult.note = ex.note;
        if (ex.costume) expResult.costume = ex.costume;
        if (ex.talk) pendingTalk = ex.talk;
      }
      // 稀有怪：掉一套還沒有的時裝（全部都有了就改給金幣）
      if (skirmish.def.rare) {
        const missing = Costumes.defs.filter(function (d) { return !d.special && !Save.get().costumes.includes(d.id); });
        if (missing.length) {
          const pick = missing[Math.floor(Math.random() * missing.length)];
          Save.addCostume(pick.id);
          expResult.costume = pick;
        } else {
          Save.addCoins(150);
          coinsBanked += 150;
        }
      }
      // D 懸賞：討伐、黃金海馬、斯庫拉
      {
        const b = Save.get().bounty;
        if (b && !skirmish.def.dive && !skirmish.def.duo) {
          if (b.type === 'hunt') { b.got = (b.got || 0) + 1; if (b.got >= b.n) completeBounty(b); else Save.touch(); }
          if (b.type === 'golden' && skirmish.def.rare) completeBounty(b);
          if (b.type === 'scylla' && skirmish.kind === 'scylla') completeBounty(b);
        }
      }
      Encounter.remove(skirmish);
    } else {
      // 世界之謎：第一次通關這一國 = 拿到它的線索（線索就是「已通關」，不另外存）
      const first = !Save.isCleared(levelIndex);
      Save.markCleared(levelIndex, state.coinsGot, state.coinsTotal, runScore);
      netProgress({ t: 'clear', li: levelIndex, cg: state.coinsGot, ct: state.coinsTotal, score: runScore, gain: gain });
      const clue = Mystery.clueFor(levelIndex);
      const cont = Mystery.continentOf(levelIndex);
      if (first && clue && cont) {
        const pr = Mystery.progress(cont.id);
        newClue = { clue: clue, cont: cont, progress: pr, completed: pr.complete };
        // 這一條讓整個洲的線索到齊：回地圖時直接揭曉謎底
        if (pr.complete) pendingReveal = cont.id;
      }
    }
    Music.stop();
    scene = 'clear';
    sceneTimer = 45;
  }

  // ── 遊戲內渲染 ────────────────────────────────────────

  function drawBackground(def) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, def.sky[0]);
    g.addColorStop(1, def.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 雲（火車關：雲也慢慢往後飄，站著不動也看得出車在跑）
    const rnd = U.rng(1337);
    const cloudDrift = def.vehicle === 'train' ? t * 0.5 : 0;
    ctx.fillStyle = def.cloud || 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 14; i++) {
      const bx = rnd() * def.width;
      const by = 40 + rnd() * 110;
      const bs = 0.7 + rnd() * 0.7;
      const x = bx - camX * 0.18 - cloudDrift;
      const wrapped = ((x % def.width) + def.width) % def.width;
      if (wrapped > W + 120) continue;
      ctx.beginPath();
      ctx.arc(wrapped, by, 20 * bs, 0, Math.PI * 2);
      ctx.arc(wrapped + 22 * bs, by + 4, 15 * bs, 0, Math.PI * 2);
      ctx.arc(wrapped - 20 * bs, by + 5, 13 * bs, 0, Math.PI * 2);
      ctx.fill();
    }

    // 遠景：每國有自己的剪影（巴黎屋頂、阿爾卑斯雪峰、多瑙河⋯⋯），沒有才用通用山丘
    const sky = Sprites.skylines[def.id];
    if (sky) {
      sky(ctx, camX, Levels.GROUND_Y, W, def, t);
    } else {
    ctx.fillStyle = def.hill;
    ctx.globalAlpha = 0.55;
    const hx = -camX * 0.3;
    ctx.beginPath();
    ctx.moveTo(hx - 200, Levels.GROUND_Y);
    for (let i = 0; i <= 18; i++) {
      const px = hx - 200 + i * 160;
      const ph = Levels.GROUND_Y - (70 + Math.sin(i * 1.7) * 48 + Math.cos(i * 0.9) * 26);
      ctx.lineTo(px, ph);
    }
    ctx.lineTo(hx + 2800, Levels.GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    }

    // 地標（中景）
    // 魔王關不畫：魔王本身就長得像該國地標（風車巨人／大理石巨像），
    // 背景再擺一排同款地標會讓人分不出哪個才是要打的目標。
    const fn = def.isBoss ? null : Sprites.landmarks[def.landmark];
    if (fn) {
      ctx.globalAlpha = 0.9;
      for (let k = 0; k < 3; k++) {
        const wx = 500 + k * Math.max(900, def.width / 3);
        const sx = wx - camX * 0.55;
        if (sx < -260 || sx > W + 260) continue;
        fn(ctx, sx, Levels.GROUND_Y - 6, 0.95, t * 0.06);
      }
      ctx.globalAlpha = 1;
    }

    // 火車關：鐵軌、枕木、電線桿往後飛（整列車在世界裡是靜止的，「在跑」全靠這一層）
    if (def.vehicle === 'train') Sprites.trainTrack(ctx, camX, t, W, Levels.GROUND_Y);
    // 纜車關：遠遠的谷底（一排松樹剪影），只會從山谷之間透出來 —— 看起來才夠深、夠高
    if (def.vehicle === 'cable') Sprites.valleyFloor(ctx, camX, W, H, Levels.GROUND_Y, def.hill);
  }

  /**
   * 國家特色物件。
   * layer='bg' 用 0.78 視差畫在地形後面（高大建築，避免跟平台/樹重疊）
   * layer='fg' 貼地面畫在地形之後（小道具，增加現場感）
   */
  function drawProps(def, layer) {
    const par = layer === 'bg' ? 0.78 : 1;
    (def.props || []).forEach(function (p) {
      if ((Sprites.propLayer[p.type] || 'fg') !== layer) return;
      const fn = Sprites.props[p.type];
      if (!fn) return;
      const halfW = (Sprites.propWidth[p.type] || 120) / 2 + 30;
      const sx = p.x - camX * par;
      if (sx + halfW < 0 || sx - halfW > W) return;
      if (layer === 'bg') {
        // 背景層稍微壓低飽和，製造空氣遠近感
        ctx.save();
        ctx.globalAlpha = 0.88;
        fn(ctx, sx, Levels.GROUND_Y, t, p);
        ctx.restore();
      } else {
        fn(ctx, sx, Levels.GROUND_Y, t, p);
      }
    });
  }

  /** 兩個 #rrggbb 顏色依比例 k（0 = a、1 = b）混合，回傳 rgb() 字串（土色調暗、調亮用） */
  const mixCache = {};
  function mixHex(a, b, k) {
    const key = a + b + k;
    if (mixCache[key]) return mixCache[key];
    const pa = parseInt((a || '#5a4a3a').slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = function (sh) { return Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k); };
    return (mixCache[key] = 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')');
  }

  function drawTerrain(def) {
    const worldH = def.height || H;

    /*
     * 交通關（v1.20）：
     *   火車 —— 地面段畫成車廂（Sprites.trainCar），車廂之間看得到底下的鐵軌，不填黑坑、不種樹
     *   纜車 —— 車站照一般地面畫（山頭），山谷不填黑坑：透出天空和遠山才像在高空
     */
    if (def.vehicle === 'train') {
      def.groundSegs.forEach(function (s, i) {
        const sx = s.x - camX;
        if (sx > W + 80 || sx + s.w < -80) return;
        const next = def.groundSegs[i + 1];
        Sprites.trainCar(ctx, sx, s.y, s.w, t, { loco: !!s.loco, idx: i, coupleTo: next ? next.x - s.x - s.w : 0 });
      });
      drawTerrainExtras(def);
      return;
    }

    // 斷崖深坑先填暗色，否則會透出天空。
    // 只對「高度相同的相鄰地面」做 —— 高低差大的相鄰段是階梯地形，
    // 中間不是坑，填黑會把整片畫面糊掉。
    for (let i = 0; i < def.ground.length - 1 && def.vehicle !== 'cable'; i++) {
      const a = def.ground[i], b = def.ground[i + 1];
      const gx0 = a.x + a.w, gw = b.x - gx0;
      if (gw <= 0) continue;
      if (Math.abs(a.y - b.y) > 2) continue;
      const sx = gx0 - camX;
      if (sx > W || sx + gw < 0) continue;
      const top = a.y;
      /*
       * v1.23.1 玩家：坑跟尖刺太醜、沒融入背景 —— 原本是固定的黑褐色＋灰色三角形，
       * 每一國都一樣，跟彩色的地面格格不入。改成用這一國的土色調暗：
       * 坑裡是同一種土、越深越暗，兩側是凹凸的土壁，底下的尖刺是土色的尖石（見 drawTerrainExtras）。
       */
      const g = ctx.createLinearGradient(0, top, 0, worldH);
      g.addColorStop(0, mixHex(def.groundBody, '#000000', 0.45));
      g.addColorStop(1, mixHex(def.groundBody, '#000000', 0.78));
      ctx.fillStyle = g;
      ctx.fillRect(sx, top, gw, worldH - top);
      // 凹凸的土壁（左右兩側）＋ 坑口一圈草皮色的邊
      ctx.fillStyle = mixHex(def.groundBody, '#000000', 0.25);
      for (let y = top; y < worldH; y += 18) {
        const k = ((y * 7 + gx0) % 5);
        ctx.fillRect(sx, y, 6 + k, 18);
        ctx.fillRect(sx + gw - 6 - ((k + 2) % 5), y, 6 + ((k + 2) % 5), 18);
      }
      ctx.fillStyle = mixHex(def.groundTop, '#000000', 0.35);
      ctx.fillRect(sx, top, gw, 4);
      // 坑裡零星的小石頭
      ctx.fillStyle = mixHex(def.groundBody, '#ffffff', 0.12);
      for (let k = 0; k < gw / 30; k++) {
        ctx.beginPath(); ctx.ellipse(sx + 14 + k * 30, top + 18 + (k % 3) * 9, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    def.ground.forEach(function (s) {
      const sx = s.x - camX;
      if (sx > W || sx + s.w < 0) return;
      ctx.fillStyle = def.groundBody;
      ctx.fillRect(sx, s.y + 14, s.w, s.h - 14);
      ctx.fillStyle = def.groundTop;
      ctx.fillRect(sx, s.y, s.w, 14);
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      for (let i = 0; i < s.w; i += 48) {
        ctx.fillRect(sx + i + 12, s.y + 28, 14, 5);
        ctx.fillRect(sx + i + 30, s.y + 48, 10, 4);
      }
    });

    // 植物
    const deco = Sprites.decos[def.deco];
    if (deco) {
      const rnd = U.rng(4242);
      def.ground.forEach(function (s) {
        const n = Math.floor(s.w / 170);
        for (let i = 0; i < n; i++) {
          /*
           * ⚠️ 兩個亂數一定要先抽完才能 continue（玩家回報：有些關卡的樹會閃來閃去）。
           * 舊版的大小（第二個 rnd）寫在「畫面外就跳過」之後 —— 樹一移出畫面就少抽一次，
           * 後面每一棵的位置、大小整串錯位，鏡頭一動樹就跳。
           */
          const wx = s.x + 50 + i * 170 + rnd() * 50;
          const scale = 0.85 + rnd() * 0.3;
          if (wx > s.x + s.w - 30) continue;
          const sx = wx - camX;
          if (sx < -60 || sx > W + 60) continue;
          deco(ctx, sx, s.y + 2, scale);
        }
      });
    }

    drawTerrainExtras(def);
  }

  /** 地形上的水、尖刺、平台（一般關與交通關共用） */
  function drawTerrainExtras(def) {
    // 水
    (def.water || []).forEach(function (wt) {
      const sx = wt.x - camX;
      if (sx > W || sx + wt.w < 0) return;
      const g = ctx.createLinearGradient(0, wt.y, 0, wt.y + wt.h);
      g.addColorStop(0, 'rgba(84,152,214,0.92)');
      g.addColorStop(1, 'rgba(32,70,132,0.95)');
      ctx.fillStyle = g;
      ctx.fillRect(sx, wt.y, wt.w, wt.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= wt.w; i += 6) {
        const yy = wt.y + 4 + Math.sin((i + t * 2) * 0.06) * 3;
        if (i === 0) ctx.moveTo(sx + i, yy); else ctx.lineTo(sx + i, yy);
      }
      ctx.stroke();
    });

    /*
     * 尖刺：土色的尖石（v1.23.1 改，原本是灰色鐵三角）。
     * 高低錯落、左暗右亮做出立體感，底下堆一層碎土 —— 顏色都從這一國的地面取，跟坑壁是同一種石頭。
     * 尖端一點點偏紅提醒「這會痛」，但不搶畫面。
     */
    (def.spikes || []).forEach(function (sp) {
      const sx = sp.x - camX;
      if (sx > W || sx + sp.w < 0) return;
      const dark = mixHex(def.groundBody, '#000000', 0.35);
      const lite = mixHex(def.groundBody, '#ffffff', 0.25);
      const base = sp.y + sp.h;
      const n = Math.max(2, Math.floor(sp.w / 14));
      const bw = sp.w / n;
      // 坑底：尖石插在實實在在的土裡（不然看起來像浮在坑中間的一層架子）
      const fg = ctx.createLinearGradient(0, base, 0, base + 90);
      fg.addColorStop(0, mixHex(def.groundBody, '#000000', 0.3));
      fg.addColorStop(1, mixHex(def.groundBody, '#000000', 0.6));
      ctx.fillStyle = fg;
      ctx.fillRect(sx - 6, base - 2, sp.w + 12, 90);
      for (let i = 0; i < n; i++) {
        const bx = sx + i * bw;
        const h = sp.h * (0.7 + ((i * 37 + Math.round(sp.x)) % 4) * 0.12);
        const tipX = bx + bw / 2 + ((i % 3) - 1) * 1.5;
        ctx.fillStyle = dark;
        ctx.beginPath(); ctx.moveTo(bx - 1, base); ctx.lineTo(tipX, base - h); ctx.lineTo(tipX, base); ctx.closePath(); ctx.fill();
        ctx.fillStyle = lite;
        ctx.beginPath(); ctx.moveTo(tipX, base - h); ctx.lineTo(bx + bw + 1, base); ctx.lineTo(tipX, base); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(200, 70, 60, 0.55)';
        ctx.beginPath(); ctx.moveTo(tipX - 1.6, base - h + 5); ctx.lineTo(tipX, base - h); ctx.lineTo(tipX + 1.6, base - h + 5); ctx.closePath(); ctx.fill();
      }
      // 碎土堆
      ctx.fillStyle = mixHex(def.groundBody, '#000000', 0.2);
      for (let x = 0; x < sp.w; x += 10) {
        ctx.beginPath(); ctx.ellipse(sx + x + 5, base, 7, 4, 0, Math.PI, 0); ctx.fill();
      }
    });

    // 平台
    (def.platforms || []).forEach(function (pf) {
      const sx = pf.x - camX;
      if (sx > W || sx + pf.w < 0) return;
      ctx.fillStyle = '#6b5a44';
      U.roundRect(ctx, sx, pf.y, pf.w, pf.h, 5);
      ctx.fill();
      ctx.fillStyle = def.groundTop;
      U.roundRect(ctx, sx, pf.y, pf.w, 7, 4);
      ctx.fill();
    });
  }

  /**
   * 豎井關的渲染。
   *
   * 跟一般關卡差太多（沒有地面、沒有視差山景、有追擊天花板），
   * 硬塞進 drawPlay 會變成到處是 if。獨立一條路徑比較好讀。
   */
  function drawShaftPlay() {
    const def = state.def;
    const pl = def.shaft;
    const sh = state.shaft;

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    /*
     * 背景。
     *
     * descend：越深越暗（往地底鑽）
     * climb  ：越高越亮（往塔頂/山頂爬）—— 用同一個進度值但反向，
     *          玩家能從背景亮度感覺到自己接近終點。
     */
    const prog = U.clamp(sh.deepest / pl.floors, 0, 1);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, def.sky[0]);
    g.addColorStop(1, def.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (pl.mode === 'climb') {
      ctx.fillStyle = 'rgba(255, 252, 240, ' + (prog * 0.3).toFixed(3) + ')';
    } else {
      ctx.fillStyle = 'rgba(8, 10, 20, ' + (prog * 0.45).toFixed(3) + ')';
    }
    ctx.fillRect(0, 0, W, H);

    // 主題背景（齒輪、鐘面⋯⋯）。沒有主題的井什麼都不畫
    Sprites.shaftBackdrop(ctx, def.theme, camY, t, W, H);

    /*
     * 把世界層裁切在「可玩區域」內。
     *
     * 不裁的話，危險區外的金幣／平台會畫進 HUD 區域 ——
     * 實測有金幣出現在 screenY=-12，看起來像 HUD 上多了一個金幣圖示，
     * 很容易誤認成介面元素。
     *
     * descend 裁掉天花板以上，climb 裁掉 HUD 以上（下方由雪崩自己蓋住）。
     */
    const clipTop = pl.mode === 'climb' ? 44 : Shaft.CEIL_TOP + Shaft.CEIL_H - 6;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, clipTop, W, H - clipTop);
    ctx.clip();

    ctx.translate(0, -camY);

    // 兩側石壁
    sh.walls.forEach(function (wl) { Sprites.shaftWall(ctx, wl, camY, H, def.theme, t); });
    // v1.31.2 亞特蘭提斯：牆上的壁畫、神殿大門（在樓層後面）
    if (state.riddle) Abyss.drawRiddle(ctx, state, t, 'back', camY, H);

    // 樓層（只畫看得到的，整座井有 30+ 層）
    sh.floors.forEach(function (f) {
      if (f.gone) return;
      if (f.rect.y < camY - 40 || f.rect.y > camY + H + 40) return;
      Sprites.shaftFloor(ctx, f, t, def.theme);
    });

    // 鐘擺（支點在畫面外也要畫：擺錘可能已經擺進畫面）
    sh.pendulums.forEach(function (pd) {
      if (pd.def.py > camY + H + 40 || pd.def.py + pd.def.len < camY - 40) return;
      Sprites.pendulum(ctx, pd, t);
    });

    // 金幣
    state.coins.forEach(function (c) {
      if (c.taken) return;
      if (c.y < camY - 40 || c.y > camY + H + 40) return;
      Sprites.coin(ctx, { x: c.x, y: c.y }, t);
    });

    // 抵達層上方的裝備
    if (state.equip && !state.equip.taken) {
      Sprites.equipPickup(ctx, state.equip.x, state.equip.y, state.equip.id, t);
    }

    // 招牌機制（亞特蘭提斯的氣泡噴口）
    if (state.features) Features.drawWorld(ctx, state, 0, t, 'fg');
    if (state.riddle) Abyss.drawRiddle(ctx, state, t, 'front', camY, H);

    // 玩家的遠程攻擊（豎井裡也丟得出去）
    (state.pshots || []).forEach(function (s) { Sprites.playerShot(ctx, s, 0, t); });

    // 粒子
    state.particles.forEach(function (q) {
      ctx.globalAlpha = U.clamp(q.life / 24, 0, 1);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;

    // 玩家（兩人同機時畫所有還在場上的）
    state.players.forEach(function (p, i) {
      if (downed[i]) return;
      Sprites.player(ctx, {
        x: p.x, y: p.y, w: p.w, h: p.h,
        facing: p.facing, onGround: p.onGround, vx: p.vx,
        invuln: p.invuln, equipped: p.equipped,
        pid: i, costume: Save.get().costume   // 時裝（只換外觀）
      }, t);
      drawChargeBar(p, p.x);     // 丹麥積木塔的蓄力條
    });

    ctx.restore();   // 收掉 camY

    // 追擊的危險區畫在螢幕座標：它固定在畫面的一側才讀得出剩餘空間
    if (pl.calm) {
      // 沒有追擊的危險區（瑞士：有冰面就不要雪崩）
    } else if (pl.mode === 'climb') {
      Sprites.shaftFlood(ctx, H - Shaft.FLOOD_H, Shaft.FLOOD_H, W, t, def.floodTint, def.theme);
    } else {
      Sprites.shaftCeiling(ctx, Shaft.CEIL_TOP, Shaft.CEIL_H, W, t, def.theme);
    }

    ctx.restore();   // 收掉震動

    if (sh.chime > 0) Sprites.chimeOverlay(ctx, sh.chime, W, H, pl.chime);
    // 潛水：水的濾鏡＋頭上的空氣計（豎井要扣掉 camY）
    if (state.features) Features.drawOverlay(ctx, state, 0, t, W, H, camY);

    drawHud();
    drawShaftGauge();

    /*
     * 開場提示。
     *
     * 這個玩法跟橫向關卡完全不同，玩家第一次進來會不知道該往哪走
     * 而站在原地等死。前幾層給一行字說明，之後淡出。
     */
    if (state.shaft.deepest < 3) {
      const life = U.clamp((3 - state.shaft.deepest) / 3, 0, 1);
      const climb = pl.mode === 'climb';
      ctx.save();
      ctx.globalAlpha = life;
      // climb 的提示不能放畫面底部（那裡是雪崩），改放上面
      const by = climb ? 92 : H - 74;
      ctx.fillStyle = 'rgba(10,14,26,0.82)';
      U.roundRect(ctx, W / 2 - 215, by, 430, 48, 8); ctx.fill();
      U.text(ctx, def.intro ? def.intro[0] : def.dive ? '往下潛到海神的神殿！上面的礁石會崩下來' : pl.calm ? '往上爬到山頂！' : climb ? '往上跳！下面的雪崩會追上來' : '往下跳！上面的尖刺會追上來',
        W / 2, by + 18, { size: 16, color: '#ffd166' });
      U.text(ctx, def.intro ? def.intro[1] : climb ? (def.theme === 'alps' ? '平台可以從下面穿過去・藍色冰面會滑，要提早放開方向鍵'
                                                : '←→ 移動　空白 跳躍　平台可以從下面穿過去')
                        : def.intro ? def.intro[1]
                        : def.theme === 'bigben' ? '往下掉時小心鐘擺・鐘聲響起時會加速'
                        : def.theme === 'opera' ? '鋼琴鍵平台第 3 拍會消失・小心飛來的音符'
                        : def.dive ? '跳躍 = 往上游・頭上的氣泡用完會嗆水，游進噴口的氣泡柱補氣'
                        : '←→ 移動　掉出畫面下方也會死',
        W / 2, by + 38, { size: 13, color: '#c6d2e8' });
      ctx.restore();
    }

    if (toast) drawToast();
  }

  /**
   * 豎井關的深度進度條（畫面右側）。
   * 玩家需要知道「還要降幾層」，否則不知道終點在哪會很焦慮。
   */
  function drawShaftGauge() {
    const pl = state.def.shaft;
    const sh = state.shaft;
    /*
     * 深度計放在「右側石壁的中線」上。
     *
     * 原本貼在 W-26（畫面最右），但井壁本身就畫在那裡（厚 150px），
     * 計量條壓在石磚紋理上看不清楚。擺在石壁中央反而像個嵌在牆上的
     * 刻度，讀起來清楚也不會擋住井道。
     */
    const wallInner = pl.shaftX + pl.shaftW;
    const x = Math.min(W - 18, wallInner + (W - wallInner) / 2);
    const top = 92, h = H - 150;

    ctx.fillStyle = 'rgba(8,10,18,0.78)';
    U.roundRect(ctx, x - 7, top - 7, 16, h + 14, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(190,200,220,0.3)';
    ctx.lineWidth = 1;
    U.roundRect(ctx, x - 7, top - 7, 16, h + 14, 8); ctx.stroke();

    // 已降進度
    const prog = U.clamp(sh.deepest / pl.floors, 0, 1);
    ctx.fillStyle = 'rgba(143,227,160,0.9)';
    U.roundRect(ctx, x - 3, top, 8, Math.max(3, h * prog), 4); ctx.fill();

    // 終點標記
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(x + 1, top + h, 5, 0, Math.PI * 2);
    ctx.fill();

    // 數字加個底，壓在石牆上才讀得到
    const label = sh.deepest + '/' + pl.floors;
    ctx.fillStyle = 'rgba(8,10,18,0.8)';
    U.roundRect(ctx, x - 24, top + h + 10, 50, 20, 5); ctx.fill();
    U.text(ctx, label, x + 1, top + h + 20, { size: 12, color: '#eaf0fa' });
  }

  function drawPlay() {
    if (state.def.layout === 'shaft') { drawShaftPlay(); return; }
    if (state.def.layout === 'race') {
      ctx.save();
      if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      Race.draw(ctx, state, t, W, H);
      ctx.restore();
      drawHud();
      if (toast) drawToast();
      return;
    }

    const def = state.def;
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    // 背景自己處理視差，不受 camY 的整體位移影響（它有自己的係數）
    drawBackground(def);

    // 世界層：垂直關卡時整層往上移。
    // 用 translate 而不是在每個 draw 呼叫裡減 camY —— 後者要改幾十處，
    // 漏一個就會有東西飄在錯的位置。
    ctx.save();
    if (camY !== 0) ctx.translate(0, -camY);

    // 招牌機制的背景（鹽礦岩壁要蓋住後面的建築，所以最先畫）
    if (state.features) Features.drawWorld(ctx, state, camX, t, 'bg');
    drawProps(def, 'bg');     // 高大建築：地形之前，會被地面遮住底部
    drawTerrain(def);
    // 密室畫在地形之後：未發現時是假牆（蓋住內容），發現後露出內部
    state.secrets.forEach(function (sc) {
      // 岔路的空中平台延伸很遠，裁切要看整條路的範圍
      const box = sc.span || sc.room;
      const sx = box.x - camX;
      if (sx > W || sx + box.w < 0) return;
      // 玩家離隱形磚多近（0~1），越近磚的輪廓越清楚
      if (sc.block) {
        const d = Math.abs(state.player.x + state.player.w / 2 - (sc.block.x + sc.block.w / 2));
        sc.near = U.clamp(1 - (d - 50) / 230, 0, 1);
      }
      Sprites.secretRoom(ctx, sc, def, t, camX);
    });
    // 密室裡的金幣（發現後才畫）
    state.secrets.forEach(function (sc) {
      if (!sc.found) return;
      sc.coins.forEach(function (c) {
        if (c.taken) return;
        const sx = c.x - camX;
        if (sx > W + 30 || sx < -30) return;
        Sprites.coin(ctx, { x: sx, y: c.y }, t);
      });
    });
    drawProps(def, 'fg');     // 小道具：貼在地面上
    Npcs.draw(ctx, state, camX, t);   // 當地居民（站在小道具前面）
    // 招牌機制本體（彈跳墊、間歇泉、啤酒桶、牛群）
    if (state.features) Features.drawWorld(ctx, state, camX, t, 'fg');
    // 雙人試煉的壓板、閘門、吊橋
    if (state.duo) Duo.drawWorld(ctx, state, camX, t, W);
    // 海上小遊戲的場景物件（麵包籃、海盜船、海獺、黃金海馬）
    if (def.skirmish) Encounter.drawWorld(ctx, state, t);

    // 移動平台
    // 纜車關：移動平台畫成纜車（纜線、塔架、車廂）；起風時車廂跟著晃
    const gusting = !!(state.features && state.features.list.some(function (f) {
      return f.type === 'gusts' && f.state === 'blow';
    }));
    state.movers.forEach(function (m) {
      if (def.vehicle === 'cable') { Sprites.cableGondola(ctx, m, camX, t, gusting, W, def.id); return; }
      const sx = m.x - camX;
      if (sx > W || sx + m.w < 0) return;
      ctx.fillStyle = '#7c6a52';
      U.roundRect(ctx, sx, m.y, m.w, m.h, 5);
      ctx.fill();
      ctx.fillStyle = '#e0a94b';
      U.roundRect(ctx, sx, m.y, m.w, 5, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (m.axis === 'x') {
        ctx.moveTo(m.ox - m.range - camX + m.w / 2, m.y + m.h / 2);
        ctx.lineTo(m.ox + m.range - camX + m.w / 2, m.y + m.h / 2);
      } else {
        ctx.moveTo(sx + m.w / 2, m.oy - m.range + m.h / 2);
        ctx.lineTo(sx + m.w / 2, m.oy + m.range + m.h / 2);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // 金幣
    state.coins.forEach(function (c) {
      if (c.taken) return;
      const sx = c.x - camX;
      if (sx > W + 30 || sx < -30) return;
      Sprites.coin(ctx, { x: sx, y: c.y }, t);
    });

    // 待拾取的裝備（密道裡的要先發現；魔王掉落的要先打倒）
    if (state.equip && !state.equip.taken) {
      const si = state.equip.secretIdx;
      const gated = si >= 0 && !(state.secrets[si] && state.secrets[si].found);
      const bossPending = state.boss && !state.boss.defeated;
      if (!gated && !bossPending) {
        const sx = state.equip.x - camX;
        if (sx > -60 && sx < W + 60) {
          Sprites.equipPickup(ctx, sx, state.equip.y, state.equip.id, t);
        }
      }
    }

    // 終點旗（魔王關沒有）
    if (!state.def.isBoss) {
      const gx = def.goal - camX;
      if (gx > -120 && gx < W + 120) {
        // v1.30 挪威：終點在右上角的高台上
        Sprites.goalFlag(ctx, gx, def.goalY != null ? def.goalY : Levels.GROUND_Y, def.flag, t, def.flagDir);
      }
    }

    // v1.31 巴西足球：球場的線、球門（在守門員後面）
    if (state.ball && typeof America !== 'undefined') America.drawPitch(ctx, state, camX, t);
    // 魔王（破綻期用實際的矮碰撞盒繪製，玩家看到的就是能踩的範圍）
    if (state.boss) {
      const b = state.boss;
      const bx = bossBox(b);
      Sprites.boss(ctx, {
        x: bx.x - camX, y: bx.y, w: bx.w, h: bx.h,
        dir: b.dir, kind: b.kind, phase: b.phase,
        hp: b.hp, hpMax: b.hpMax, hurtFlash: b.hurtFlash,
        defeated: b.defeated, deathTimer: b.deathTimer, fade: b.fade,
        swing: b.swing, swingK: b.swingK      // 冰島火巨人：劍舉高（高掃）還是壓低（低掃）
      }, t);
    }

    // 敵人
    state.enemies.forEach(function (e) {
      if (!e.alive && e.squash <= 0) return;
      const sx = e.x - camX;
      if (sx > W + 50 || sx + e.w < -50) return;
      Sprites.enemy(ctx, {
        x: sx, y: e.y, w: e.w, h: e.h, dir: e.dir, squash: e.squash,
        type: e.type, cd: e.cd, charging: e.charging, stun: e.stun, bump: e.bump
      }, t, def.id, def.flag);   // 各國專屬外型（見 Sprites COUNTRY_ENEMIES）
    });

    // 彈射物 / 震波
    if (state.ball && typeof America !== 'undefined') America.drawBall(ctx, state.ball, camX, t);   // v1.31 巴西足球
    state.shots.forEach(function (s) {
      const sx = s.x - camX;
      if (sx > W + 30 || sx < -30) return;
      Sprites.shot(ctx, { x: sx, y: s.y, w: s.w, h: s.h, wave: s.wave, fire: s.fire, debris: s.debris,
        spear: s.spear, bat: s.bat, vx: s.vx, vy: s.vy,
        pillar: s.pillar, tentacle: s.tentacle, warn: s.warn, life: s.life, patch: s.patch, ember: s.ember,
        slash: s.slash, lava: s.lava, dark: s.dark,
        serpent: s.serpent, seg: s.seg, ang: s.ang, dirX: s.dirX, arc: s.arc,          // v1.31 亞馬遜大蛇
        football: s.football,                                                           // v1.31 巴西守門員丟的球
        arcMark: s.arcMark ? { x0: s.arcMark.x0 - camX, x1: s.arcMark.x1 - camX, h: s.arcMark.h, from: s.arcMark.from } : null }, t);
    });

    // 玩家的遠程攻擊（板球／辣椒火球）
    (state.pshots || []).forEach(function (s) { Sprites.playerShot(ctx, s, camX, t); });

    // 粒子
    state.particles.forEach(function (q) {
      ctx.globalAlpha = U.clamp(q.life / 24, 0, 1);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - camX - 2, q.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;

    // 玩家（兩人同機時畫所有還在場上的）
    state.players.forEach(function (p, i) {
      if (downed[i]) return;
      Sprites.player(ctx, {
        x: p.x - camX, y: p.y - (p.mount ? 14 : 0), w: p.w, h: p.h,
        facing: p.facing, onGround: p.onGround, vx: p.vx,
        invuln: p.invuln, equipped: p.equipped,
        pid: i, costume: Save.get().costume   // 時裝（只換外觀）
      }, t);
      // 騎駱駝（非洲關坐騎）：駱駝蓋在玩家腿上
      if (p.mount) Features.drawMount(ctx, p, p.x - camX, t);
      // 瑞典馴鹿雪橇（v1.30）：雪橇墊在腳下、馴鹿在前面拉
      if (state.def.autorun && !p.out) (state.def.ride === 'car' ? Features.drawCar : Features.drawSled)(ctx, p, p.x - camX, t);
      drawChargeBar(p, p.x - camX);
    });
    // 海神夥伴（魔王關）與牠丟出去的三叉戟
    if (state.ally) {
      const al = state.ally;
      Sprites.seaAlly(ctx, al.x - camX, al.y, t, al.facing || 1, 1);
      if (al.shot) Sprites.trident(ctx, al.shot.x - camX, al.shot.y, al.shot.a);
    }

    ctx.restore();   // 收掉 camY 的位移
    ctx.restore();   // 收掉震動

    // 鹽礦的黑暗遮罩（蓋在整個關卡上、HUD 底下）
    if (state.features) Features.drawOverlay(ctx, state, camX, t, W, H);
    // NPC 對話泡泡：蓋在所有東西上面（含鹽礦黑暗）、HUD 底下
    if (state.npcs && state.npcs.length) {
      ctx.save();
      if (camY !== 0) ctx.translate(0, -camY);
      Npcs.drawBubbles(ctx, state, camX, t, W);
      ctx.restore();
    }

    drawHud();
    if (def.skirmish) Encounter.drawHud(ctx, state, W);
    // 魔王血條（固定在畫面上，不受相機與震動影響）
    if (state.boss && !state.boss.defeated) Sprites.bossBar(ctx, state.boss, W);
    if (state.pitCave) drawPitCave();
    if (toast) drawToast();
  }

  function drawHud() {
    const def = state.def;
    ctx.fillStyle = 'rgba(14,18,32,0.62)';
    ctx.fillRect(0, 0, W, 44);

    Sprites.flagFace(ctx, 16, 12, 33, 20, def.flag, def.flagDir);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(16, 12, 33, 20);

    let title;
    if (def.duo) {
      title = '雙人試煉　' + def.country + ' · ' + def.city;
    } else if (def.skirmish || def.dive || def.quest) {
      title = def.country + '　' + def.city;
    } else {
      title = (def.isBoss ? '魔王關　' : `第 ${levelIndex + 1} / ${Levels.count} 關　`) +
        def.country + ' · ' + def.city;
    }
    U.text(ctx, title, 60, 23,
      { size: 16, align: 'left', color: def.isBoss || def.skirmish ? '#ffc0c8' : '#ffffff' });

    U.text(ctx, `\u20AC ${state.coinsGot}/${state.coinsTotal}`, 400, 23,
      { size: 15, align: 'left', color: '#f6d98a' });

    // 密道計數（有密道的關卡才顯示）
    // 沉船潛水：寶物計數（沿路三件）
    if (def.id === 'WRK') {
      U.text(ctx, '寶物 ' + (state.relicsGot || []).length + '/3', 690, 23, { size: 15, align: 'left', color: '#ffe070' });
    }
    if (state.secrets.length) {
      U.text(ctx, `密道 ${state.secretsFound}/${state.secrets.length}`, 500, 23,
        { size: 15, align: 'left', color: '#b9d4f5' });
    }

    U.text(ctx, `分數 ${runScore}`, 606, 23, { size: 15, align: 'left', color: '#cfd8ec' });

    // 海神夥伴：這場還能幫忙打幾下（左下角，不跟魔王血條搶位置）
    if (state.ally) {
      U.text(ctx, '海神夥伴　還能丟 ' + state.ally.throws + ' 支三叉戟', 20, H - 18,
        { size: 14, align: 'left', color: state.ally.throws ? '#a8f0e8' : '#7d88a6' });
    }

    // 豎井關：在 HUD 顯示目前深度（右側的計量條是圖示，這裡給精確數字）
    if (def.layout === 'shaft' && state.shaft) {
      U.text(ctx, `深度 ${state.shaft.deepest}/${def.shaft.floors} 層`, 500, 23,
        { size: 15, align: 'left', color: '#9fe3b0' });
    }

    // （v1.8 拿掉了關卡 HUD 上的裝備小圖示：裝備 18 件會排出去壓到愛心，
    //   而且關卡中不需要 —— 要看裝備去地圖按 I）

    /*
     * 命數。
     *
     * 單人：原本的一排愛心。
     * 兩人：上下兩排小愛心，前面標 1P / 2P ——
     *   每人有自己的命，所以必須分開顯示，不然玩家不知道自己還剩幾條。
     */
    function hearts(baseX, baseY, n, full, scale, color) {
      for (let i = 0; i < n; i++) {
        const hx = baseX + i * 26 * scale, hy = baseY;
        const s = scale;
        ctx.fillStyle = i < full ? color : 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.arc(hx - 4.5 * s, hy - 3 * s, 5.5 * s, 0, Math.PI * 2);
        ctx.arc(hx + 4.5 * s, hy - 3 * s, 5.5 * s, 0, Math.PI * 2);
        ctx.moveTo(hx - 10 * s, hy - 1 * s);
        ctx.lineTo(hx, hy + 10 * s);
        ctx.lineTo(hx + 10 * s, hy - 1 * s);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (coop) {
      U.text(ctx, '1P', 792, 13, { size: 11, align: 'left', color: '#7fc4f5' });
      hearts(824, 14, maxLives, downed[0] ? 0 : lives[0], 0.62, '#e0526b');
      U.text(ctx, '2P', 792, 33, { size: 11, align: 'left', color: '#ff8a6b' });
      hearts(824, 34, maxLives, downed[1] ? 0 : lives[1], 0.62, '#e0526b');
    } else {
      // 靠右對齊：愛心上限最多 7 顆（3 + 襯衫 1 + 商店 3），從固定 x 往右排會超出畫面
      hearts(Math.min(836, 938 - (maxLives - 1) * 26), 22, maxLives, lives[0], 1, '#e0526b');
    }

    /*
     * 水平進度條。
     *
     * 魔王關不畫：沒有「往右跑到終點」的概念，而且會跟魔王血條打架。
     * 豎井關也不畫：
     *   1. goal 是 Infinity，player.x / Infinity = 0，條永遠不動
     *   2. 它的 y=52 正好落在尖刺天花板上，疊成一團看不懂
     * 豎井關的進度由右側的 drawShaftGauge() 用「深度」表示。
     */
    if (!def.isBoss && !def.skirmish && def.layout !== 'shaft') {
      const prog = U.clamp(state.player.x / def.goal, 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(16, 52, W - 32, 6);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(16, 52, (W - 32) * prog, 6);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(16 + (W - 32) * prog, 55, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** 拿到裝備的浮動提示 */
  function drawToast() {
    const alpha = U.clamp(toast.life / 40, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    const bw = 400, bh = 62, bx = (W - bw) / 2, by = 76;
    ctx.fillStyle = 'rgba(12,16,30,0.9)';
    U.roundRect(ctx, bx, by, bw, bh, 10); ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    U.roundRect(ctx, bx, by, bw, bh, 10); ctx.stroke();
    U.text(ctx, toast.text, bx + bw / 2, by + 22, { size: 18, color: '#ffd166' });
    U.text(ctx, toast.sub, bx + bw / 2, by + 44, { size: 14, color: '#dce5f5' });
    ctx.restore();
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(12,16,30,0.88)';
    U.roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = '#7e97c9';
    ctx.lineWidth = 2;
    U.roundRect(ctx, x, y, w, h, 14);
    ctx.stroke();
  }

  // ── 選單畫面 ──────────────────────────────────────────

  /**
   * 標題字：金屬漸層 + 深色外框 + 投影，兩側各一條飾線與星芒，
   * 中文名夾在兩條細線中間 —— 比單純的黃字有「大作」的質感。
   */
  function drawLogo(cx, cy) {
    ctx.save();
    ctx.font = '900 64px "Georgia", "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(Brand.titleEn).width;
    // 投影
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillText(Brand.titleEn, cx + 4, cy + 5);
    // 外框
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#2a1a10';
    ctx.strokeText(Brand.titleEn, cx, cy);
    // 金屬漸層
    const g = ctx.createLinearGradient(0, cy - 32, 0, cy + 32);
    g.addColorStop(0, '#fff4c8');
    g.addColorStop(0.45, '#f2c14e');
    g.addColorStop(0.55, '#c8862a');
    g.addColorStop(1, '#ffe08a');
    ctx.fillStyle = g;
    ctx.fillText(Brand.titleEn, cx, cy);
    // 高光掃過（每 4 秒一次）
    const k = (t % 240) / 240;
    if (k < 0.35) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      const sx = cx - tw / 2 + (tw + 120) * (k / 0.35) - 60;
      const hg = ctx.createLinearGradient(sx - 30, 0, sx + 30, 0);
      hg.addColorStop(0, 'rgba(255,255,255,0)');
      hg.addColorStop(0.5, 'rgba(255,255,255,0.75)');
      hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg;
      ctx.fillText(Brand.titleEn, cx, cy);
      ctx.restore();
    }
    ctx.restore();

    // 中文名 + 兩側飾線
    const zy = cy + 56;
    ctx.strokeStyle = 'rgba(242, 193, 78, 0.8)';
    ctx.lineWidth = 2;
    [-1, 1].forEach(function (s) {
      ctx.beginPath();
      ctx.moveTo(cx + s * 92, zy); ctx.lineTo(cx + s * (tw / 2 + 10), zy);
      ctx.stroke();
      ctx.fillStyle = '#f2c14e';
      ctx.beginPath();
      const sx = cx + s * (tw / 2 + 18);
      ctx.moveTo(sx, zy - 6); ctx.lineTo(sx + 3, zy); ctx.lineTo(sx, zy + 6); ctx.lineTo(sx - 3, zy); ctx.fill();
    });
    U.text(ctx, Brand.titleZh, cx, zy, { size: 30, weight: 800, color: '#ffffff', strokeWidth: 6 });
  }

  /*
   * 首頁的「怎麼玩」（v1.28.2）：兩欄、一條一句話講完一個玩法。
   * 不做成另外一頁 —— 手機按不了說明鍵，放首頁大家第一眼就看得到。
   * v1.31.2 玩家：遊戲說明更新一下 → 補上劇情人物（北歐、美洲怎麼開）、洞裡的密道、地圖上的店；三列 → 四列
   */
  const TITLE_GUIDE = [
    ['#ffd166', '開船環遊', '開到國家旁按 Enter 進城，跑到終點旗子過關'],
    ['#8fe3a0', '找裝備', '每關藏一件，頂出隱形磚、或跳進沒有刺的洞'],
    ['#ff9aa8', '海上冒險', '打海怪拿 EXP 解鎖東歐、非洲；新大陸解鎖南美'],
    ['#f2a65a', '劇情人物', '找雷神索爾、哥倫布，完成委託開放北歐、美洲'],
    ['#9cd0c8', '港口', 'B 商店・造船廠升級船・貿易港低買高賣接懸賞'],
    ['#c8b0ff', '逛逛地圖', '神祕商人、服裝店、寵物店，瑞士銀行生利息'],
    ['#e2c8ff', '兩人一起', 'C 同機雙人，或 ☰ 選單「連線」；土耳其有雙人關'],
    ['#f6d98a', '世界之謎', '每過一關得一條線索（N 查看），集滿揭開祕密']
  ];
  function drawTitleGuide(top) {
    const x0 = 60, w = W - 120, h = 142;
    ctx.fillStyle = 'rgba(46, 28, 14, 0.9)';      // v1.29.10 配古地圖：胡桃木底＋金線
    U.roundRect(ctx, x0, top, w, h, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(212, 162, 58, 0.75)';
    ctx.lineWidth = 1.2;
    U.roundRect(ctx, x0, top, w, h, 10); ctx.stroke();
    U.text(ctx, '怎麼玩', W / 2, top + 18, { size: 14, color: '#f2c14e', weight: 800 });
    const colW = w / 2;
    TITLE_GUIDE.forEach(function (g, i) {
      const col = i % 2, row = Math.floor(i / 2);
      const x = x0 + 22 + col * colW, y = top + 44 + row * 28;
      ctx.fillStyle = g[0];
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      U.text(ctx, g[1], x + 12, y, { size: 14, color: g[0], align: 'left', weight: 800 });
      U.text(ctx, fitText(g[2], colW - 100, 13), x + 82, y, { size: 13, color: '#f0e0c0', align: 'left' });
    });
  }

  function drawTitle() {
    /*
     * v1.29.10 玩家：大地圖改古地圖了，一開始的首頁畫風沒跟進 → 首頁也做成一張羊皮紙：
     * 泛黃紙底＋紙紋＋燒黃暈邊（跟大地圖同一張紙紋貼圖），遠景地標用 multiply 印上去像褪色的版畫。
     */
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#f3e3b6');
    g.addColorStop(1, '#dcc18a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const keys = Object.keys(Sprites.landmarks);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.22;
    keys.forEach(function (k, i) {
      const x = ((i * 220 - t * 0.5) % (W + 440) + W + 440) % (W + 440) - 220;
      Sprites.landmarks[k](ctx, x, H - 60, 0.8, t * 0.06);
    });
    ctx.restore();
    WorldMap.paperOverlay(ctx, 0, 0, W, H);

    // 名稱與標語一律從 Brand 取，避免改到一半漏掉
    // v1.28.2 玩家：首頁放些遊戲說明 → 標誌往上挪，中間空出一塊「怎麼玩」
    drawLogo(W / 2, 78);
    U.text(ctx, Brand.tagline(Levels.count),
      W / 2, 172, { size: 15, color: '#5a3a18', strokeColor: 'rgba(250, 238, 205, 0.8)' });
    U.text(ctx, Brand.versionLabel, W - 12, H - 12,
      { size: 12, color: '#7a5a38', align: 'right', strokeColor: 'rgba(250, 238, 205, 0.8)' });

    if (Math.floor(t / 30) % 2 === 0) {
      U.text(ctx, '按 Enter 或 空白鍵 開始', W / 2, 206, { size: 22, color: '#a3260f', strokeColor: 'rgba(250, 238, 205, 0.9)' });
    }
    drawTitleGuide(226);

    const sv = Save.get();
    const secretsAll = Levels.list.reduce(function (n, lv) {
      return n + (lv.secrets || []).length;
    }, 0);
    U.text(ctx,
      `通關 ${sv.cleared.length}/${Levels.count}　裝備 ${sv.equipment.length}/${Equipment.count}　密道 ${sv.secrets.length}/${secretsAll}　總分 ${sv.score}` + (titleText() ? '　稱號' + titleText() : ''),
      W / 2, 392, { size: 15, color: '#4a2e14', strokeColor: 'rgba(250, 238, 205, 0.8)' });

    // 已取得的裝備排一列
    if (sv.equipment.length) {
      const n = sv.equipment.length;
      const startX = W / 2 - (n - 1) * 30 / 2;
      sv.equipment.forEach(function (id, i) {
        Sprites.equipIcon(ctx, id, startX + i * 30, 416, 0.6);
      });
    }

    U.text(ctx, '←→ 移動　空白 跳躍　K 遠程攻擊　Q 回大地圖　I 裝備　P 暫停',
      W / 2, 440, { size: 13, color: '#6e5232', strokeColor: 'rgba(250, 238, 205, 0.8)' });
    // 兩人同機的開關說明（放在標題，讓玩家一開始就知道有這功能）
    U.text(ctx, coop ? 'C 兩人同機：開（2P 用 WASD + G）' : 'C 兩人同機：關',
      W / 2, 460, { size: 13, color: coop ? '#2f7a4a' : '#6e5232', strokeColor: 'rgba(250, 238, 205, 0.8)' });
  }

  /**
   * 地圖捲動指示：右側一條細的位置條，讓玩家知道「上下還有地圖」。
   * 不畫的話，第一次看到的人會以為歐洲只有畫面上這一段。
   */
  function drawMapScroll() {
    const top = WorldMap.VIEW_TOP + 6, h = WorldMap.VIEW_H - 12;
    const k = WorldMap.VIEW_H / WorldMap.worldH();
    const y = top + (WorldMap.cam.y / WorldMap.worldH()) * h;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    U.roundRect(ctx, W - 8, top, 4, h, 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    U.roundRect(ctx, W - 8, y, 4, Math.max(16, h * k), 2); ctx.fill();
  }

  /** 地圖當底圖的畫面（裝備、商店、存檔）：同一個相機位置 */
  function drawMapBackdrop(sv) {
    ctx.fillStyle = '#15293f';
    ctx.fillRect(0, 0, W, H);
    WorldMap.beginView(ctx);
    WorldMap.draw(ctx, W, H, {
      unlocked: sv.unlocked,
      clearedFn: function (i) { return Save.isCleared(i); },
      cursor: cursor,
      t: t,
      east: { unlocked: eastUnlocked() },
      regionOpen: regionUnlocked
    });
    WorldMap.endView(ctx);
  }

  /**
   * 雙人試煉的資訊卡（蓋在一般關卡資訊卡上）：
   *   第一行：兩個小人的徽章、試煉名（＋「需雙人」標記）、小知識｜右邊：目前幾位玩家
   *   第二行：玩法｜右邊：首次獎勵／已通過
   */
  function drawDuoCard(spot, CARD, t) {
    const k = Encounter.KINDS[spot.def.port];
    const base = Duo.build(k.duo);
    const done = Save.seaBossDown(spot.def.port);
    ctx.fillStyle = 'rgba(46, 28, 14, 0.97)';
    ctx.fillRect(0, H - CARD + 1, W, CARD - 1);
    // 徽章：紫底兩個小人
    ctx.fillStyle = '#8a4ab8';
    U.roundRect(ctx, 14, H - 50, 33, 22, 4); ctx.fill();
    ctx.fillStyle = '#f4efe2';
    ctx.beginPath(); ctx.arc(25, H - 44, 3, 0, Math.PI * 2); ctx.arc(36, H - 44, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(22, H - 40, 6, 9); ctx.fillRect(33, H - 40, 6, 9);
    const nameStr = k.name + ' · ' + base.city;
    U.text(ctx, nameStr, 56, H - 39, { size: 16, color: '#ffffff', align: 'left' });
    ctx.font = '600 16px "Segoe UI", "Microsoft JhengHei", sans-serif';
    const bx = 56 + ctx.measureText(nameStr).width + 10;
    // 「需雙人」標記（同魔王關標記的樣式，紫色）
    ctx.fillStyle = 'rgba(176,120,232,0.25)';
    U.roundRect(ctx, bx, H - 49, 58, 20, 5); ctx.fill();
    ctx.strokeStyle = '#c89af0'; ctx.lineWidth = 1.2;
    U.roundRect(ctx, bx, H - 49, 58, 20, 5); ctx.stroke();
    U.text(ctx, '需雙人', bx + 29, H - 39, { size: 11, color: '#e2c8ff' });
    U.text(ctx, fitText(base.fact, W - 236 - bx - 68, 12), bx + 72, H - 39, { size: 12, color: '#d6c4a0', align: 'left' });
    // 右上：現在場上幾位玩家（一個人時提示怎麼找 2P）
    const two = coop;
    const touch = document.documentElement.classList.contains('touch');
    U.text(ctx, two ? '✓ 兩位玩家' + (isHost() ? '（連線）' : '') : touch ? '目前 1 人：用連線找 2P' : '目前 1 人：按 C 加入 2P', W - 14, H - 39,
      { size: 12, color: two ? '#8fe3a0' : '#ff9aa8', align: 'right' });
    U.text(ctx, k.tags, 56, H - 15, { size: 12, color: '#e2cfa8', align: 'left' });
    U.text(ctx, done ? '已通過　再闖 +' + k.exp + ' EXP' : '首次 +' + k.bossExp + ' EXP、€' + k.bossCoins, W - 14, H - 15,
      { size: 12, color: done ? '#8fe3a0' : '#f6d98a', align: 'right' });
  }

  function drawMap() {
    const sv = Save.get();
    // 航海模式：Voyage 內部會先叫 WorldMap.draw 畫海與陸地，再疊船與港口
    const eastOpen = eastUnlocked();
    ctx.fillStyle = '#2e1c0e';     // 地圖與資訊卡之間露出來的底色（v1.29.9 配古地圖的木框）
    ctx.fillRect(0, 0, W, H);
    WorldMap.beginView(ctx);
    Voyage.draw(ctx, t, {
      unlocked: sv.unlocked,
      clearedFn: function (i) { return Save.isCleared(i); },
      east: { unlocked: eastOpen },
      regionOpen: regionUnlocked,
      beforeShip: function () { Encounter.drawMap(ctx, t); Pet.drawFollower(ctx, t); }
    });
    WorldMap.endView(ctx);
    drawMapScroll();

    // 標題條
    // v1.29.9 玩家：地圖改古地圖了，周圍的框還是一開始的深藍 → 標題條、資訊卡改成深胡桃木＋金線
    ctx.fillStyle = 'rgba(46, 28, 14, 0.94)';
    ctx.fillRect(0, 0, W, 40);
    ctx.fillStyle = 'rgba(212, 162, 58, 0.7)';
    ctx.fillRect(0, 39, W, 1.5);
    U.text(ctx, WorldMap.world() === 'am' ? '新大陸' : WorldMap.world() === 'sea' ? '海底城' : '世界地圖', 16, 20,
      { size: 18, color: '#ffd166', align: 'left' });

    /*
     * 經驗值條：打海上怪物累積，滿了解鎖下一篇（東歐 → v1.21 非洲）。
     * 放在標題與右側統計之間，一直看得到進度，才有「再打一隻」的動機。
     * 進度是「上一篇門檻 → 下一篇門檻」這一段，不是從 0 算（不然解鎖東歐後條子一開始就快滿）。
     */
    // v1.31.2 海底城：沒有海上怪物，EXP 條換成「四區破了幾區」
    if (WorldMap.world() === 'sea') {
      const bx = 160, by = 14, bw = 160, bh = 12;
      const ab = Levels.list.map(function (l, i) { return { l: l, i: i }; }).filter(function (o) { return o.l.region === 'abyss'; });
      const got = ab.filter(function (o) { return Save.isCleared(o.i); }).length;
      U.text(ctx, '探索', bx - 6, 20, { size: 12, color: '#e8c27a', align: 'right' });
      ctx.fillStyle = 'rgba(255, 230, 180, 0.15)'; U.roundRect(ctx, bx, by, bw, bh, 6); ctx.fill();
      ctx.fillStyle = got >= ab.length ? '#8fe3a0' : '#4ac0d0';
      if (got) { U.roundRect(ctx, bx, by, Math.max(bh, bw * got / ab.length), bh, 6); ctx.fill(); }
      U.text(ctx, got >= ab.length ? '海底城全部破完' : '海底城 ' + got + ' / ' + ab.length + ' 區', bx + bw + 8, 20,
        { size: 12, color: got >= ab.length ? '#8fe3a0' : '#f0dcb0', align: 'left' });
    } else {
      const bx = 160, by = 14, bw = 160, bh = 12;   // v1.25.1 標題只剩「世界地圖」，EXP 條往左靠
      // v1.31 新大陸：EXP 條換成美洲 EXP（解鎖南美）
      const amW = WorldMap.world() === 'am';
      const sr = Encounter.regionOf('samerica'), ea = Save.expAm();
      const nx = amW ? (ea < sr.exp ? sr : null) : Encounter.nextRegion(sv.exp);
      const done = !nx;
      // v1.30 北歐篇是劇情解鎖，不在 EXP 條上
      const XR = Encounter.EXP_REGIONS;
      const idx = nx && !amW ? XR.indexOf(nx) : XR.length;
      const from = !amW && idx > 0 ? XR[idx - 1].exp : 0;
      const cur = amW ? ea : sv.exp;
      const prog = done ? 1 : U.clamp((cur - from) / (nx.exp - from), 0, 1);
      U.text(ctx, amW ? '美洲 EXP' : 'EXP', bx - 6, 20, { size: 12, color: '#e8c27a', align: 'right' });
      ctx.fillStyle = 'rgba(255, 230, 180, 0.15)';
      U.roundRect(ctx, bx, by, bw, bh, 6); ctx.fill();
      ctx.fillStyle = done ? '#8fe3a0' : '#d4a23a';
      if (prog > 0) { U.roundRect(ctx, bx, by, Math.max(bh, bw * prog), bh, 6); ctx.fill(); }
      U.text(ctx, done ? (amW ? '南美已解鎖' : Quests.northOpen() ? '全部篇章已解鎖' : '東歐、非洲已解鎖') : `${cur}/${nx.exp} 解鎖${nx.name.replace('篇', '')}`, bx + bw + 8, 20,
        { size: 12, color: done ? '#8fe3a0' : '#f0dcb0', align: 'left' });
    }
    U.text(ctx, (coop ? '2P　' : '') +
      `通關 ${sv.cleared.length}/${Levels.count}　裝備 ${sv.equipment.length}/${Equipment.count}　\u20AC ${sv.wallet}`,
      W - 16, 20, { size: 14, color: coop ? '#8fe3a0' : '#f0e0c0', align: 'right' });

    // 底部資訊卡
    const lv = Levels.list[cursor];
    const open = cursor < sv.unlocked;
    const best = sv.best[cursor];
    const eq = Equipment.forLevel(cursor) || Souvenirs.forLevel(cursor);   // v1.31 美洲篇是紀念品

    /*
     * v1.25.1 玩家：下面這塊太大 → 資訊卡從 88 縮到 58，兩行：
     *   第一行：國旗、關名（＋魔王標記）、小知識（放不下就截斷）｜右邊：這一關的裝備
     *   第二行：密道進度｜中間：靠岸提示／操作說明｜右邊：最佳紀錄
     */
    const CARD = 58;
    ctx.fillStyle = 'rgba(46, 28, 14, 0.94)';
    ctx.fillRect(0, H - CARD, W, CARD);
    ctx.strokeStyle = 'rgba(212, 162, 58, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, H - CARD); ctx.lineTo(W, H - CARD); ctx.stroke();

    // 國旗
    Sprites.flagFace(ctx, 14, H - 50, 33, 22, lv.flag, lv.flagDir);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(14, H - 50, 33, 22);

    const nameStr = (cursor + 1) + '. ' + lv.country + ' · ' + lv.city;
    U.text(ctx, nameStr, 56, H - 39,
      { size: 16, color: open ? '#ffffff' : '#a8967a', align: 'left' });
    ctx.font = '600 16px "Segoe UI", "Microsoft JhengHei", sans-serif';
    let afterName = 56 + ctx.measureText(nameStr).width + 10;

    // 魔王關標記，接在關名後面
    if (lv.isBoss) {
      const bx = afterName;
      ctx.fillStyle = Save.bossBeaten(cursor) ? 'rgba(143,227,160,0.2)' : 'rgba(224,82,107,0.25)';
      U.roundRect(ctx, bx, H - 49, 58, 20, 5); ctx.fill();
      ctx.strokeStyle = Save.bossBeaten(cursor) ? '#8fe3a0' : '#e0526b';
      ctx.lineWidth = 1.2;
      U.roundRect(ctx, bx, H - 49, 58, 20, 5); ctx.stroke();
      U.text(ctx, Save.bossBeaten(cursor) ? '魔王已破' : '魔王關',
        bx + 29, H - 39, { size: 11, color: Save.bossBeaten(cursor) ? '#8fe3a0' : '#ff9aa8' });
      afterName += 68;
    }

    U.text(ctx, fitText(lv.fact, W - 236 - afterName, 12), afterName + 4, H - 39, { size: 12, color: '#d6c4a0', align: 'left' });

    // 密道進度
    const scTotal = (lv.secrets || []).length;
    if (scTotal) {
      const found = Save.secretsFound(cursor);
      U.text(ctx, '密道 ' + found + '/' + scTotal, 56, H - 15,
        { size: 12, color: found >= scTotal ? '#8fe3a0' : '#e8d4a8', align: 'left' });
    }

    // 這一關的裝備狀態
    if (eq) {
      const got = Equipment.get(eq.id) ? Save.hasEquip(eq.id) : Save.hasSouvenir(eq.id);
      Sprites.equipIcon(ctx, eq.id, W - 206, H - 39, 0.5);
      U.text(ctx, fitText((got ? '已取得 ' : '藏有 ') + (Equipment.get(eq.id) ? '' : '紀念品') + eq.name, 176, 12), W - 190, H - 39,
        { size: 12, color: got ? '#8fe3a0' : '#ffd166', align: 'left' });
    }

    if (best) {
      U.text(ctx, '最佳 € ' + best.coins + '/' + best.total + '　' + best.score + ' 分', W - 14, H - 15,
        { size: 12, color: '#f6d98a', align: 'right' });
    } else if (!open) {
      U.text(ctx, '未解鎖', W - 14, H - 15, { size: 12, color: '#a8967a', align: 'right' });
    }

    // 雙人試煉（v1.28）：靠近時資訊卡換成試煉的資料，關名後面標「需雙人」
    const duoSpot = Voyage.nearbySpecial();
    if (duoSpot && duoSpot.def.duo) drawDuoCard(duoSpot, CARD, t);

    // 靠岸提示：在港口圈內才顯示「可上岸」；旁邊有怪時優先提示挑戰
    const near = Voyage.nearbyLevel();
    const mon = Encounter.nearby();
    const spot = Voyage.nearbySpecial();
    if (mon) {
      const blink = Math.floor(t / 20) % 2 === 0;
      const bossTxt = mon.kind === 'atlantis' && Quests.abyssOpen() ? '按 Enter 潛進亞特蘭提斯海底城'
        : mon.def.custom ? Expedition.prompt(mon) : mon.def.dive
        ? '按 Enter 潛入亞特蘭提斯（' + (Save.seaBossDown(mon.kind) ? `再潛一次 +${mon.def.exp} EXP・神殿大門的封印還沒解開）` : `首次 +${mon.def.bossExp} EXP、€${mon.def.bossCoins}）`)
        : mon.def.boss
        ? `按 Enter 挑戰魔王 ${mon.def.name}（` + (Save.seaBossDown(mon.kind) ? `再戰 +${mon.def.exp} EXP）` : `首次 +${mon.def.bossExp} EXP、€${mon.def.bossCoins}）`)
        : `按 Enter 挑戰 ${mon.def.name} Lv${mon.def.lv}（+${mon.def.exp} EXP）`;
      U.text(ctx, blink ? bossTxt : '　',
        W / 2, H - 15, { size: 14, color: '#ff9aa8' });
    } else if (spot) {
      const blink = Math.floor(t / 20) % 2 === 0;
      const sausages = Save.get().cargo.sausage || 0;
      const txt = spot.def.dog ? (sausages ? '按 Enter 餵黃金獵犬一根臘腸（船艙有 ' + sausages + ' 箱）' : '按 Enter 摸摸黃金獵犬')
        : (spot.def.prompt || '按 Enter 進入' + spot.name + '的' + spot.def.role);
      U.text(ctx, blink ? txt : '　', W / 2, H - 15,
        { size: 14, color: spot.def.merchant ? '#d8b8ff' : '#ffd166' });
    } else if (near >= 0 && near < sv.unlocked) {
      const blink = Math.floor(t / 20) % 2 === 0;
      U.text(ctx, blink ? '按 Enter 進入' + Levels.list[near].city : '　', W / 2, H - 15,
        { size: 14, color: '#ffd166' });
    } else {
      U.text(ctx, '方向鍵 移動　Enter 進城　B 商店　I 裝備　N 世界之謎　F2 存檔',
        W / 2, H - 15, { size: 12, color: '#c0aa84' });
    }
  }

  /** 存檔資訊畫面：告訴玩家進度存在哪、可以清除 */
  /** 依實際寬度換行（中文沒有空白可斷，逐字量） */
  function wrapText(str, maxW, size) {
    ctx.save();
    ctx.font = `600 ${size}px "Segoe UI", "Microsoft JhengHei", sans-serif`;
    const lines = [];
    let line = '';
    for (const ch of str) {
      if (line && ctx.measureText(line + ch).width > maxW) { lines.push(line); line = ''; }
      line += ch;
    }
    if (line) lines.push(line);
    ctx.restore();
    return lines;
  }

  // 謎畫面版面：西歐 10 格（5×2）、東歐 8 格（4×2）並排
  const MYS_COLS_W = 5, MYS_COLS_E = 4;
  const MYS_SLOT_W = 86, MYS_SLOT_H = 40, MYS_GAP = 6;
  // 西歐那塊往右讓出位置：左側有 ☰／↩ 按鈕（top 22%），放在 x=40 會被它蓋住第一格
  const MYS_WEST_X = 66, MYS_EAST_X = 552;
  const MYS_TEXT_W = 660;

  function drawMystery() {
    const sv = Save.get();
    drawMapBackdrop(sv);
    ctx.fillStyle = 'rgba(8,12,24,0.9)';
    ctx.fillRect(0, 0, W, H);

    const cont = Mystery.get(mysteryCont);
    const slots = Mystery.slots(mysteryCont);
    const pr = Mystery.progress(mysteryCont);
    const euroDone = Mystery.progress('europe').complete;
    if (mysteryCursor >= slots.length) mysteryCursor = 0;

    U.text(ctx, '世界之謎', W / 2, 30, { size: 26, color: '#ffd166' });
    U.text(ctx, cont.name + '：' + cont.question, 40, 64, { size: 16, color: '#eaf0fa', align: 'left' });
    U.text(ctx, '線索 ' + pr.got + ' / ' + pr.total, W - 40, 64,
      { size: 16, color: pr.complete ? '#8fe3a0' : '#ffd166', align: 'right' });

    // 線索格（歐洲兩塊、其他洲一塊，見 mysBlocks）
    const blocks = mysBlocks(cont, slots);
    let idx = 0;
    blocks.forEach(function (b) {
      U.text(ctx, b.title, b.x, 92, { size: 13, color: '#9aa7c7', align: 'left' });
      const mine = slots.filter(function (s) { return (s.def.region || 'west') === b.region; });
      mine.forEach(function (s, k) {
        const i = idx + k;
        const x = b.x + (k % b.cols) * (MYS_SLOT_W + MYS_GAP);
        const y = 102 + Math.floor(k / b.cols) * (MYS_SLOT_H + MYS_GAP);
        const sel = i === mysteryCursor && mysOther < 0;
        ctx.fillStyle = s.got ? 'rgba(255,209,102,0.16)' : 'rgba(255,255,255,0.05)';
        U.roundRect(ctx, x, y, MYS_SLOT_W, MYS_SLOT_H, 7); ctx.fill();
        ctx.strokeStyle = sel ? '#ffffff' : (s.got ? '#ffd166' : '#3c4a78');
        ctx.lineWidth = sel ? 2.5 : 1.2;
        U.roundRect(ctx, x, y, MYS_SLOT_W, MYS_SLOT_H, 7); ctx.stroke();
        U.text(ctx, s.def.country, x + MYS_SLOT_W / 2, y + 14,
          { size: 13, color: s.got ? '#ffffff' : '#7d88a6' });
        U.text(ctx, s.got ? '✓ 線索 ' + (i + 1) : '？？？', x + MYS_SLOT_W / 2, y + 30,
          { size: 11, color: s.got ? '#ffd166' : '#5d6886' });
      });
      idx += mine.length;
    });

    // 選中的線索內容
    const s = slots[mysteryCursor];
    panel(40, 202, W - 80, 128);
    if (s && s.got && s.clue) {
      U.text(ctx, '線索 ' + (mysteryCursor + 1) + '・' + s.def.country + '：' + s.clue.item, 64, 226,
        { size: 15, color: '#ffd166', align: 'left' });
      // 寬度留到 x≈724：手機版右下的「確定」鍵疊在畫面上，文字跑到它底下會看不清楚
      wrapText(s.clue.text, MYS_TEXT_W, 16).slice(0, 3).forEach(function (ln, k) {
        U.text(ctx, ln, 64, 258 + k * 26, { size: 16, color: '#eaf0fa', align: 'left' });
      });
    } else if (s) {
      U.text(ctx, '線索 ' + (mysteryCursor + 1) + '・？？？', 64, 226, { size: 15, color: '#7d88a6', align: 'left' });
      U.text(ctx, '通關「' + s.def.country + '・' + s.def.city + '」就能拿到這條線索。', 64, 262,
        { size: 16, color: '#b9c6e2', align: 'left' });
    }

    // 謎底按鈕 / 還差幾條
    if (pr.complete) {
      U.text(ctx, '★ 線索到齊了！按 Enter（確定）解開謎底 ★', W / 2, 350, { size: 17, color: '#8fe3a0' });
    } else {
      U.text(ctx, '再找到 ' + (pr.total - pr.got) + ' 條線索，就能解開' + cont.name + '。', W / 2, 350,
        { size: 15, color: '#b9c6e2' });
    }

    // 其他大陸：有關卡的洲可以切換過去看（↓ 選到這列按 Enter，或直接點）；
    // 還沒有關卡的洲，歐洲解開之前只看得到「？？？」—— 解開才知道彼此有關係
    const others = mysOthers();
    const boxW = (W - 80 - 16 * (others.length - 1)) / others.length;
    others.forEach(function (c, k) {
      const x = 40 + k * (boxW + 16);
      const sel = mysOther === k;
      ctx.fillStyle = sel ? 'rgba(127,196,245,0.14)' : 'rgba(255,255,255,0.04)';
      U.roundRect(ctx, x, 372, boxW, 56, 8); ctx.fill();
      ctx.strokeStyle = sel ? '#ffffff' : '#3c4a78'; ctx.lineWidth = sel ? 2.5 : 1;
      U.roundRect(ctx, x, 372, boxW, 56, 8); ctx.stroke();
      const cx = x + 14;
      if (c.open) {
        const cp = Mystery.progress(c.id);
        U.text(ctx, '🔍 ' + c.name + '：線索 ' + cp.got + ' / ' + cp.total + (cp.complete ? '（已解開）' : ''), cx, 390,
          { size: 13, color: cp.complete ? '#8fe3a0' : '#7fc4f5', align: 'left' });
        U.text(ctx, sel ? 'Enter 切換到這個謎' : fitText(c.question, boxW - 28, 12), cx, 412,
          { size: 12, color: sel ? '#ffd166' : '#7d88a6', align: 'left' });
        return;
      }
      U.text(ctx, '🔒 ' + (euroDone ? c.name + '：' + c.question : '？？？之謎'), cx, 390,
        { size: 13, color: '#c6d2e8', align: 'left' });
      U.text(ctx, fitText(euroDone ? c.teaser : '先解開歐洲之謎', boxW - 28, 12), cx, 412,
        { size: 12, color: '#7d88a6', align: 'left' });
    });

    U.text(ctx, '方向鍵 選線索（↓ 到底可換別的洲）　Enter 解開謎底　N、Q 或 Esc 返回地圖', W / 2, H - 18,
      { size: 13, color: '#9aa7c7' });

    if (mysteryReveal) drawMysteryAnswer(cont);
  }

  /** 謎底揭曉 */
  function drawMysteryAnswer(cont) {
    ctx.fillStyle = 'rgba(6,9,20,0.92)';
    ctx.fillRect(0, 0, W, H);
    // 左邊留給 ☰／↩ 按鈕，面板不要蓋到它
    panel(100, 28, W - 200, H - 56);
    U.text(ctx, cont.name + '・謎底', W / 2, 60, { size: 16, color: '#9aa7c7' });
    U.text(ctx, cont.answerTitle, W / 2, 94, { size: 28, color: '#ffd166' });
    let y = 138;
    cont.answer.forEach(function (para, i) {
      // 最後一句是整個謎的核心，用金色
      const last = i === cont.answer.length - 1;
      wrapText(para, W - 260, 16).forEach(function (ln) {
        U.text(ctx, ln, W / 2, y, { size: last ? 18 : 16, color: last ? '#ffd166' : '#eaf0fa' });
        y += last ? 30 : 26;
      });
      y += 4;
    });
    U.text(ctx, cont.next, W / 2, H - 76, { size: 15, color: '#8fe3a0' });
    U.text(ctx, '按 Enter 或 Esc 返回', W / 2, H - 46, { size: 13, color: '#9aa7c7' });
  }

  /*
   * v1.31.2 玩家：設定列表加一個「所有關卡和支線關卡」，把開發過的東西都列進去，破完的打勾（玩家：叫「紀錄」有點 low → 遠征圖鑑）。
   * 新增遊戲內容（地圖上的冒險、劇情、收集）時記得也加進 journalPages()。
   * 遠征圖鑑（☰ →「遠征圖鑑」或 L）：兩頁 —— 主線（各篇章的每一關）、支線（海上冒險、劇情、收集）。
   * ←→ 換頁（手機點畫面左右半邊），Esc / Q / L 回大地圖。支線的海上冒險從 Encounter.KINDS 自動列（以後加的也會出現）。
   */
  /** v1.31.2 拿到的稱號（首頁、存檔資訊顯示）：神之手（暗夜騎士）、比利時肥羊（被扒手偷三次） */
  function titleText() {
    const t = [];
    if (Save.flag('godHand')) t.push('「神之手」');
    if (Save.flag('sheep')) t.push('「比利時肥羊」');
    return t.join('');
  }
  let journalPage = 0;
  const JOURNAL_REGIONS = [['west', '西歐篇'], ['east', '東歐篇'], ['africa', '非洲篇'], ['north', '北歐篇'], ['america', '美洲篇'], ['abyss', '亞特蘭提斯海底城']];
  function journalPages() {
    const sv = Save.get();
    const main = [];
    JOURNAL_REGIONS.forEach(function (r) {
      const lvs = Levels.list.map(function (l, i) { return { l: l, i: i }; }).filter(function (o) { return (o.l.region || 'west') === r[0]; });
      if (!lvs.length) return;
      main.push({ head: r[1] + '（' + lvs.filter(function (o) { return Save.isCleared(o.i); }).length + ' / ' + lvs.length + '）' });
      lvs.forEach(function (o) {
        main.push({ name: o.l.country + (o.l.isBoss ? '　⚔' : ''), done: Save.isCleared(o.i) });
      });
    });
    const side = [];
    side.push({ head: '地圖上的冒險' });
    Object.keys(Encounter.KINDS).forEach(function (k) {
      const d = Encounter.KINDS[k];
      if (k === 'herd' || d.am) return;
      if (!(d.boss || d.dive || d.duo || d.fixed || d.quest || d.knight || d.desert)) return;
      side.push({ name: d.name, done: Save.seaBossDown(k) });
    });
    side.push({ name: '動物大遷徙（動物園 ' + Object.keys(Save.zoo()).length + ' / ' + Object.keys(Quests.ANIMALS).length + '）', done: Object.keys(Save.zoo()).length >= Object.keys(Quests.ANIMALS).length });
    side.push({ head: '劇情' });
    [['雷神索爾的結界', !!Save.flag('north')], ['冥界救出洛基', !!Save.flag('loki')], ['哥倫布的委託', Save.flag('columbus') >= 2],
     ['海神的封印', Quests.abyssOpen()], ['人魚 Thalassa 同行', Quests.mermaidJoined()],
     ['人魚的好感度 ♥ ' + Quests.merLove() + ' / ' + Quests.merLoveMax(), Quests.merLove() >= Quests.merLoveMax()],
     ['巴黎鐵塔的夜景（人魚變成人類）', Quests.merHuman()], ['瑞士銀行開戶', !!Save.bank().open],
     ['收養黃金獵犬', Save.pet() === 'dog'], ['埃及豔后的聖蛇', !!Save.flag('asp')], ['聖誕老人的禮物', !!Save.flag('gift')]
    ].forEach(function (q) { side.push({ name: q[0], done: q[1] }); });
    side.push({ head: '收集' });
    const cn = function (a, b) { return a + ' / ' + b; };
    [['裝備 ' + cn(sv.equipment.length, Equipment.count), sv.equipment.length >= Equipment.count],
     ['紀念品 ' + cn(sv.souvenirs.length, Souvenirs.count), sv.souvenirs.length >= Souvenirs.count],
     ['時裝 ' + cn(sv.costumes.length, Costumes.count), sv.costumes.length >= Costumes.count],
     ['人魚的衣服 ' + cn(Pet.MER_OUTFITS.filter(function (o, k) { return k && Save.upgradeLevel('mer_' + o.id) > 0; }).length, Pet.MER_OUTFITS.length - 1),
      Pet.MER_OUTFITS.every(function (o, k) { return !k || Save.upgradeLevel('mer_' + o.id) > 0; })],
     ['沉船寶物 ' + cn(sv.relics.length, Encounter.RELICS.length), sv.relics.length >= Encounter.RELICS.length],
     ['密道 ' + cn(sv.secrets.length, Levels.list.reduce(function (n, l) { return n + (l.secrets || []).length; }, 0)),
      sv.secrets.length >= Levels.list.reduce(function (n, l) { return n + (l.secrets || []).length; }, 0)]
    ].forEach(function (q) { side.push({ name: q[0], done: q[1] }); });
    Mystery.continents.filter(function (c) { return c.open; }).forEach(function (c) {
      const pr = Mystery.progress(c.id);
      side.push({ name: c.name + ' ' + cn(pr.got, pr.total), done: !!pr.complete });
    });
    side.push({ name: '稱號「神之手」（打倒暗夜騎士）', done: !!Save.flag('godHand') });
    side.push({ name: '稱號「比利時肥羊」（被扒手偷 ' + Math.min(Save.flag('robbedTimes') || 0, Quests.ROB_TITLE) + ' / ' + Quests.ROB_TITLE + ' 次）', done: !!Save.flag('sheep') });
    return [{ title: '主線關卡', items: main, cols: 3 }, { title: '支線與收集', items: side, cols: 3 }];
  }
  function updateJournal() {
    const n = 2;
    if (Input.once('left') || Input.once('up')) { journalPage = (journalPage + n - 1) % n; Sfx.select(); }
    if (Input.once('right') || Input.once('down')) { journalPage = (journalPage + 1) % n; Sfx.select(); }
    const click = Input.takeClick();
    if (click) { journalPage = click.x < W / 2 ? 0 : 1; Sfx.select(); }
    if (Input.once('journal') || Input.once('back') || Input.once('tomap') || Input.once('confirm')) { Sfx.select(); scene = 'map'; }
  }
  /*
   * v1.31.2 玩家：遠征圖鑑的勾勾好醜，重新設計 → 完成 = 一枚金色圓徽章（亮面＋白色粗勾），
   * 還沒完成 = 一個暗暗的空心圓（中間一個小點）。
   */
  function journalMark(cx, cy, done) {
    ctx.save();
    if (done) {
      ctx.fillStyle = 'rgba(255, 200, 90, 0.18)';
      ctx.beginPath(); ctx.arc(cx, cy, 9.5, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createLinearGradient(cx, cy - 7, cx, cy + 7);
      g.addColorStop(0, '#ffe08a'); g.addColorStop(1, '#e09a2a');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#a8681a'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath(); ctx.ellipse(cx - 2, cy - 3.6, 3.6, 1.8, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 3.4, cy + 0.2); ctx.lineTo(cx - 0.8, cy + 2.8); ctx.lineTo(cx + 3.6, cy - 2.6); ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(160, 172, 200, 0.45)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(160, 172, 200, 0.35)';
      ctx.beginPath(); ctx.arc(cx, cy, 1.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawJournal() {
    const sv = Save.get();
    drawMapBackdrop(sv);
    ctx.fillStyle = 'rgba(8, 12, 24, 0.9)';
    ctx.fillRect(0, 0, W, H);
    const pages = journalPages(), pg = pages[journalPage];
    const done = pg.items.filter(function (q) { return !q.head && q.done; }).length;
    const total = pg.items.filter(function (q) { return !q.head; }).length;
    U.text(ctx, '遠征圖鑑', W / 2, 30, { size: 26, color: '#ffd166' });
    // 分頁籤
    pages.forEach(function (p, k) {
      const x = W / 2 + (k ? 90 : -90), on = k === journalPage;
      ctx.fillStyle = on ? 'rgba(255, 209, 102, 0.22)' : 'rgba(255, 255, 255, 0.06)';
      U.roundRect(ctx, x - 80, 50, 160, 26, 8); ctx.fill();
      U.text(ctx, p.title, x, 63, { size: 14, color: on ? '#ffd166' : '#9aa7c7' });
    });
    {
      const bw = 150, bx = W - 30 - bw, by = 36;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'; U.roundRect(ctx, bx, by, bw, 6, 3); ctx.fill();
      const pg2 = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      pg2.addColorStop(0, '#e09a2a'); pg2.addColorStop(1, '#ffe08a');
      ctx.fillStyle = pg2; U.roundRect(ctx, bx, by, Math.max(6, bw * done / Math.max(1, total)), 6, 3); ctx.fill();
      U.text(ctx, '完成 ' + done + ' / ' + total, W - 30, 24, { size: 13, color: done >= total ? '#ffe08a' : '#c6d2e8', align: 'right' });
    }
    // 內容：依欄排（篇章標題不會落在一欄的最後一行）
    const top = 96, lh = 19, rows = Math.floor((H - top - 40) / lh), colW = (W - 96) / pg.cols;   // 左邊空出返回鍵的位置
    let col = 0, row = 0;
    pg.items.forEach(function (q) {
      if (q.head && row >= rows - 1) { col++; row = 0; }
      if (row >= rows) { col++; row = 0; }
      if (q.head && row > 0) row += 0.4;
      const x = 66 + col * colW, y = top + row * lh;
      if (q.head) {
        U.text(ctx, q.name || q.head, x, y, { size: 14, weight: 800, color: '#e8c27a', align: 'left' });
        // 標題底下一條金色細線（往右淡出）
        const ug = ctx.createLinearGradient(x, 0, x + colW - 30, 0);
        ug.addColorStop(0, 'rgba(232, 194, 122, 0.7)'); ug.addColorStop(1, 'rgba(232, 194, 122, 0)');
        ctx.fillStyle = ug; ctx.fillRect(x, y + 9, colW - 30, 1.2);
      } else {
        journalMark(x + 12, y, q.done);
        U.text(ctx, fitText(q.name, colW - 34, 13), x + 26, y, { size: 13, color: q.done ? '#fff4d6' : '#7d88a6', align: 'left' });
      }
      row++;
    });
    U.text(ctx, '←→ 換頁（手機點左右半邊）　Esc、Q、L 回大地圖', W / 2, H - 16, { size: 12, color: '#7d88a6' });
  }

  function drawSaveInfo() {
    const sv = Save.get();
    drawMapBackdrop(sv);
    ctx.fillStyle = 'rgba(8,12,24,0.88)';
    ctx.fillRect(0, 0, W, H);

    panel(110, 56, W - 220, H - 130);

    U.text(ctx, '存檔資訊', W / 2, 92, { size: 26, color: '#ffd166' });

    const info = Save.info();
    const rows = [
      ['存放位置', '瀏覽器 localStorage（這台電腦、這個瀏覽器）'],
      ['鍵名', info.key],
      ['狀態', info.writable ? '可寫入，進度會自動儲存' : '無法寫入（無痕模式？進度不會保留）'],
      ['目前大小', info.bytes + ' bytes'],
      ['通關', sv.cleared.length + ' / ' + Levels.count + ' 關'],
      ['裝備', sv.equipment.length + ' / ' + Equipment.count + ' 件　美洲紀念品 ' + sv.souvenirs.length + ' / ' + Souvenirs.count + '　時裝 ' + sv.costumes.length + ' / ' + Costumes.count],
      ['密道', sv.secrets.length + ' 條'],
      ['魔王', sv.bosses.length + ' 隻'],
      ['貿易', '第 ' + (sv.day + 1) + ' 天　船艙 ' + Save.cargoCount() + ' 箱' + (sv.bounty ? '　懸賞：' + Trade.describe(sv.bounty) : '')],
      ['船', '帆 Lv' + sv.ship.sail + '　砲 Lv' + sv.ship.cannon + '　船身 Lv' + sv.ship.hull + '　沉船收藏 ' + sv.relics.length + ' / ' + Encounter.RELICS.length],
      ['海上', sv.seaWins + ' 場勝利　EXP ' + sv.exp +
        (Encounter.nextRegion(sv.exp) ? ' / ' + Encounter.nextRegion(sv.exp).exp + '（' + Encounter.nextRegion(sv.exp).name + '）' : '（EXP 篇章都解鎖了）') +
        // v1.31 新大陸另外累積的美洲 EXP
        (Quests.americaOpen() ? '　美洲 EXP ' + Save.expAm() + (Save.expAm() < Encounter.SOUTH_EXP ? ' / ' + Encounter.SOUTH_EXP + '（南美篇）' : '（南美已解鎖）') : '')],
      ['總分', String(sv.score) + (titleText() ? '　稱號：' + titleText() : '')]
    ];

    rows.forEach(function (r, i) {
      const y = 126 + i * 25;   // v1.26 多一列「船」，行距縮一點
      U.text(ctx, r[0], 170, y, { size: 14, color: '#9aa7c7', align: 'left' });
      U.text(ctx, r[1], 300, y, { size: 14, color: '#eaf0fa', align: 'left' });
    });

    U.text(ctx, '不是存成檔案，所以換瀏覽器或清除瀏覽資料就會消失',
      W / 2, 396, { size: 13, color: '#b9c6e2' });

    // 清除存檔確認
    if (confirmWipe) {
      ctx.fillStyle = 'rgba(224,82,107,0.18)';
      U.roundRect(ctx, 240, 408, W - 480, 34, 6); ctx.fill();
      ctx.strokeStyle = '#e0526b';
      ctx.lineWidth = 1.5;
      U.roundRect(ctx, 240, 408, W - 480, 34, 6); ctx.stroke();
      U.text(ctx, '再按一次 Delete 清除全部進度（無法復原）',
        W / 2, 425, { size: 14, color: '#ff9aa8' });
    } else {
      U.text(ctx, 'Delete 清除存檔　　F2 或 Esc 返回地圖',
        W / 2, 425, { size: 13, color: '#9aa7c7' });
    }
  }

  function drawInventory() {
    // 地圖當底，壓暗
    const sv = Save.get();
    drawMapBackdrop(sv);
    ctx.fillStyle = 'rgba(8,12,24,0.82)';
    ctx.fillRect(0, 0, W, H);

    U.text(ctx, '裝備', W / 2, 36, { size: 26, color: '#ffd166' });
    // 時裝選擇（稀有怪掉落）：游標在時裝列時 ←→ 切換
    {
      const cos = sv.costume ? Costumes.get(sv.costume) : null;
      const onRow = invCursor < 0;
      const label = sv.costumes.length
        ? '時裝：' + (cos ? cos.name : '條紋衫（原本的樣子）') + (onRow ? '　◀ ▶ 切換' : '　（往上選到這列可以換）') + '　收集 ' + sv.costumes.length + ' / ' + Costumes.count
        : '時裝：還沒有 —— 地圖上閃金光的稀有怪會掉落，新大陸的聖胡安服裝店也買得到（收集 0 / ' + Costumes.count + '）';
      if (onRow) {
        ctx.fillStyle = 'rgba(255, 209, 102, 0.14)';
        U.roundRect(ctx, 120, 56, W - 240, 28, 8); ctx.fill();
      }
      U.text(ctx, label, W / 2, 70, { size: 14, color: onRow ? '#ffd166' : (sv.costumes.length ? '#ffe070' : '#b9c6e2') });
    }

    /*
     * 格子大小依裝備數自動算（固定 5 欄，列高塞滿畫面中段，見 invLayout）。
     * v1.22 分部位：每格左上角標部位；裝上的那件綠框＋「裝備中」；選到的那格金框。
     */
    const L = invLayout();
    const cw = L.cw, ch = L.ch;
    const slotName = {};
    Equipment.SLOTS.forEach(function (s) { slotName[s.id] = s.name; });
    const wornMap = sv.worn || {};

    // 部位區：底色＋欄頭（顏色、圖示、部位名、目前裝了什麼）
    L.groups.forEach(function (g) {
      const sty = SLOT_STYLE[g.slot.id];
      const colH = L.headH + 6 + Math.max.apply(null, L.vcols.slice(g.first, g.first + g.span)
        .map(function (c) { return c.items.length; })) * (ch + 6) + 2;
      ctx.fillStyle = sty.dark;
      U.roundRect(ctx, g.x - 4, L.top - 2, g.w + 8, colH + 2, 10); ctx.fill();
      ctx.fillStyle = sty.color;
      U.roundRect(ctx, g.x - 4, L.top - 2, g.w + 8, L.headH, 10); ctx.fill();
      // v1.23.1 玩家：字太黑看不清 → 白字＋細的深色描邊（原本深色字＋U.text 預設的深色粗描邊糊成一團）
      drawSlotIcon(ctx, g.slot.id, g.x + 11, L.top + 11, 8, '#ffffff');
      U.text(ctx, g.slot.name, g.x + 24, L.top + 11, { size: 15, weight: 800, color: '#ffffff', align: 'left', strokeWidth: 3, strokeColor: 'rgba(30,20,40,0.55)' });
      if (!wornMap[g.slot.id]) {
        U.text(ctx, '空著', g.x + g.w, L.top + 11, { size: 12, color: '#ffffff', align: 'right', strokeWidth: 3, strokeColor: 'rgba(30,20,40,0.55)' });
      }
    });

    Equipment.defs.forEach(function (d, i) {
      if (!L.at[i]) return;
      const pos = L.cell(i);
      const cx = pos.x, cy = pos.y;
      const got = Save.hasEquip(d.id);
      const worn = got && Save.isWorn(d.id);
      const sel = i === invCursor;
      const sty = SLOT_STYLE[d.slot];

      ctx.fillStyle = worn ? 'rgba(30, 70, 50, 0.95)' : got ? 'rgba(32,46,82,0.95)' : 'rgba(22,26,40,0.9)';
      U.roundRect(ctx, cx, cy, cw, ch, 8); ctx.fill();
      // 左邊的部位色條
      ctx.fillStyle = sty.color;
      ctx.globalAlpha = got ? 1 : 0.4;
      U.roundRect(ctx, cx, cy, 5, ch, 3); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = sel ? '#ffd166' : worn ? '#8fe3a0' : got ? 'rgba(126,151,201,0.8)' : '#4a5470';
      ctx.lineWidth = sel ? 2.6 : worn ? 2 : 1;
      U.roundRect(ctx, cx, cy, cw, ch, 8); ctx.stroke();

      // 圖示：未取得時只畫剪影輪廓，不疊問號（疊起來兩個都看不清）
      const iconS = Math.min(0.8, ch / 62);
      if (!got) ctx.globalAlpha = 0.22;
      Sprites.equipIcon(ctx, d.id, cx + 25, cy + ch / 2, iconS);
      ctx.globalAlpha = 1;

      U.text(ctx, fitText(d.name, cw - 52, 12.5), cx + 44, cy + ch / 2 - 8,
        { size: 12.5, color: got ? '#ffffff' : '#78839c', align: 'left' });
      U.text(ctx, worn ? '裝備中' : got ? '在背包' : fitText(d.country, cw - 52, 10.5), cx + 44, cy + ch / 2 + 9,
        { size: 10.5, color: worn ? '#8fe3a0' : got ? '#9fb4d8' : '#5f6a82', align: 'left' });
    });

    // 五個部位現在裝了什麼（一眼看出哪個部位空著）；有提示訊息時先顯示訊息
    const selDef = invCursor >= 0 ? Equipment.defs[invCursor] : null;
    if (invMsg) {
      U.text(ctx, invMsg.text, W / 2, H - 70, { size: 15, color: invMsg.color });
    } else if (selDef) {
      // 選到的那件：完整說明（格子裡放不下會截斷）
      const got = Save.hasEquip(selDef.id);
      const sty = SLOT_STYLE[selDef.slot];
      const line = fitText(selDef.name + '：' +
        (got ? selDef.desc + (Save.isWorn(selDef.id) ? '（裝備中，Enter 卸下）' : '（Enter 裝上）') : '還沒拿到，在' + selDef.country + '關卡中尋找'),
        W - 140, 14);
      ctx.font = '600 14px "Segoe UI", "Microsoft JhengHei", sans-serif';
      const tw = ctx.measureText(line).width;
      const tagW = 46, x0 = W / 2 - (tw + tagW + 8) / 2;
      ctx.fillStyle = sty.color;
      U.roundRect(ctx, x0, H - 80, tagW, 20, 5); ctx.fill();
      drawSlotIcon(ctx, selDef.slot, x0 + 11, H - 70, 6, '#ffffff');
      U.text(ctx, slotName[selDef.slot], x0 + 31, H - 70, { size: 12, weight: 800, color: '#ffffff', strokeWidth: 3, strokeColor: 'rgba(30,20,40,0.55)' });
      U.text(ctx, line, x0 + tagW + 8, H - 70, { size: 14, color: got ? '#ffffff' : '#9aa7c7', align: 'left' });
    } else {
      U.text(ctx, '↓ 選裝備：↑↓ 同部位換、←→ 換部位，Enter 裝上／卸下', W / 2, H - 70, { size: 13, color: '#dce5f5' });
    }

    // 目前總能力。
    // 注意：不要用 ✓/✗ 這類字元 —— Segoe UI 沒有，會被代換成 CJK 字型，
    // 基線和字高都會跑掉。改用「開 / 關」純文字 + 顏色區分。
    const st = Equipment.resolve(Save.wornIds());
    const bits = [
      { label: '愛心上限', val: String(st.maxLives), on: st.maxLives > 3 },
      { label: '跑速', val: 'x' + st.speed.toFixed(2), on: st.speed > 1 },
      { label: '二段跳', val: st.doubleJump ? '開' : '關', on: st.doubleJump },
      { label: '蹬牆跳', val: st.wallJump ? '開' : '關', on: st.wallJump },
      { label: '遠程', val: st.ranged === 'fire' ? '火球' : (st.ranged ? '板球' : '關'), on: !!st.ranged },
      { label: '金幣', val: 'x' + st.coinMul, on: st.coinMul > 1 },
      // 海神夥伴（安提基特拉沉船拿到的消耗品）
      { label: '海神夥伴', val: String(sv.allies || 0), on: sv.allies > 0 }
    ];

    // 先量總寬再置中排版，避免用 join 無法分別上色
    ctx.save();
    ctx.font = '600 14px "Segoe UI", "Microsoft JhengHei", sans-serif';
    const gap = 22;
    let total = 0;
    const widths = bits.map(function (b) {
      const w = ctx.measureText(b.label + ' ' + b.val).width;
      total += w;
      return w;
    });
    total += gap * (bits.length - 1);
    ctx.restore();

    let bx = W / 2 - total / 2;
    bits.forEach(function (b, i) {
      U.text(ctx, b.label + ' ', bx, H - 46,
        { size: 14, color: '#9fb0cc', align: 'left' });
      const lw = (function () {
        ctx.save();
        ctx.font = '600 14px "Segoe UI", "Microsoft JhengHei", sans-serif';
        const w = ctx.measureText(b.label + ' ').width;
        ctx.restore();
        return w;
      })();
      U.text(ctx, b.val, bx + lw, H - 46,
        { size: 14, color: b.on ? '#8fe3a0' : '#78839c', align: 'left' });
      bx += widths[i] + gap;
    });

    U.text(ctx, '方向鍵 選擇　Enter（或點一下）裝上／卸下　同一個部位只能裝一件　I、Q、Esc 返回', W / 2, H - 18, { size: 13, color: '#9aa7c7' });
  }

  /**
   * 金幣商店。
   * 版面跟裝備收藏刻意做成同一套（3 欄格子、地圖壓暗當底），
   * 玩家不用重新學一次怎麼看。差別是這裡每格要塞「階級條 + 價格」。
   */
  function drawShop() {
    const sv = Save.get();
    drawMapBackdrop(sv);
    ctx.fillStyle = 'rgba(8,12,24,0.85)';
    ctx.fillRect(0, 0, W, H);

    const seller = Shop.SELLERS[shopSeller] || Shop.SELLERS.portugal;
    const mystic = shopSeller !== 'portugal';
    U.text(ctx, seller.name, W / 2, 38, { size: 28, color: mystic ? '#d8b8ff' : '#ffd166' });
    U.text(ctx, seller.line, W / 2, 64,
      { size: 13, color: mystic ? '#e6d8ff' : '#b9c6e2' });

    // 錢包
    const walletStr = '\u20AC ' + sv.wallet;
    ctx.save();
    ctx.font = '700 20px "Segoe UI", "Microsoft JhengHei", sans-serif';
    const wW = ctx.measureText(walletStr).width + 34;
    ctx.restore();
    const wX = W / 2 - wW / 2;
    ctx.fillStyle = 'rgba(255,209,102,0.14)';
    U.roundRect(ctx, wX, 76, wW, 30, 8); ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 1.4;
    U.roundRect(ctx, wX, 76, wW, 30, 8); ctx.stroke();
    U.text(ctx, walletStr, W / 2, 91, { size: 20, color: '#ffd166' });

    const list = Shop.itemsOf(shopSeller);
    // 東西少（葡萄牙只剩 1 樣、商人 1~2 樣）時整排置中，不要全擠在左邊
    const cols = Math.max(1, Math.min(3, list.length)), cw = 288, ch = 116, gapX = 20, gapY = 14;
    const totalW = cols * cw + (cols - 1) * gapX;
    const sx = (W - totalW) / 2;
    const sy = 120;

    list.forEach(function (it, i) {
      const cx = sx + (i % cols) * (cw + gapX);
      const cy = sy + Math.floor(i / cols) * (ch + gapY);
      const lv = Shop.levelOf(it.id);
      const price = Shop.priceOf(it.id);
      const maxed = price == null;
      const look = it.kind === 'look';          // v1.31 外觀商品（時裝、狗狗配件）：買一次就有，沒有階級
      const why = maxed ? null : Shop.blockedOf(it.id);
      const afford = !maxed && !why && sv.wallet >= price;
      const sel = i === shopCursor;

      ctx.fillStyle = lv > 0 ? 'rgba(32,46,82,0.95)' : 'rgba(22,26,40,0.92)';
      U.roundRect(ctx, cx, cy, cw, ch, 10); ctx.fill();
      ctx.strokeStyle = sel ? '#ffd166' : (lv > 0 ? '#7e97c9' : '#58637c');
      ctx.lineWidth = sel ? 2.4 : 1.2;
      U.roundRect(ctx, cx, cy, cw, ch, 10); ctx.stroke();

      // 選中的加一圈外光，純邊框在壓暗底上不夠明顯
      if (sel) {
        ctx.strokeStyle = 'rgba(255,209,102,0.3)';
        ctx.lineWidth = 1.2;
        U.roundRect(ctx, cx - 4, cy - 4, cw + 8, ch + 8, 12); ctx.stroke();
      }

      // 圖示。沒買過的壓淡作為區別，但 0.4 在深底上幾乎看不見，
      // 0.68 剛好「看得清楚但明顯比已買的黯淡」。
      ctx.globalAlpha = lv > 0 ? 1 : 0.68;
      Sprites.icon(ctx, it.icon, cx + 40, cy + 40, 1);
      ctx.globalAlpha = 1;

      U.text(ctx, it.name, cx + 76, cy + 24,
        { size: 16, color: lv > 0 ? '#ffffff' : '#c2cde4', align: 'left' });
      U.text(ctx, it.desc, cx + 76, cy + 46,
        { size: 12, color: '#9fb4d8', align: 'left' });

      // 階級條：每階一格，買到就點亮
      for (let k = 0; k < (look ? 0 : it.maxLevel); k++) {
        const bx = cx + 76 + k * 30;
        const by = cy + 60;
        ctx.fillStyle = k < lv ? '#ffd166' : 'rgba(255,255,255,0.14)';
        U.roundRect(ctx, bx, by, 24, 7, 3); ctx.fill();
      }
      if (!look) {
        U.text(ctx, maxed ? '已滿級' : ('第 ' + (lv + 1) + ' 階'),
          cx + 76 + it.maxLevel * 30 + 8, cy + 64,
          { size: 11, color: maxed ? '#8fe3a0' : '#9aa7c7', align: 'left' });
      }

      // 價格 / 狀態
      if (maxed && look) {
        const on = Shop.wearing(it.id);
        U.text(ctx, on ? (it.acc ? '戴著' : '穿著') : '已擁有', cx + 16, cy + 98,
          { size: 14, color: on ? '#8fe3a0' : '#c6d2e8', align: 'left' });
        U.text(ctx, on ? (it.acc ? 'Enter 拿下來' : 'Enter 脫下') : (it.acc ? 'Enter 戴上' : 'Enter 穿上'), cx + cw - 16, cy + 98,
          { size: 12, color: on ? '#ffb0b8' : '#8fe3a0', align: 'right' });
      } else if (maxed) {
        U.text(ctx, '已滿級', cx + 16, cy + 98,
          { size: 14, color: '#8fe3a0', align: 'left' });
      } else {
        U.text(ctx, '\u20AC ' + price, cx + 16, cy + 98,
          { size: 15, color: afford ? '#ffd166' : '#8894b2', align: 'left' });
        U.text(ctx, afford ? '按 Enter 購買' : why ? '要先有狗狗' : '金幣不足',
          cx + cw - 16, cy + 98,
          { size: 12, color: afford ? '#8fe3a0' : '#ff9aa8', align: 'right' });
      }
    });

    // 提示訊息（買成功 / 錢不夠）
    if (shopMsg) {
      U.text(ctx, shopMsg.text, W / 2, H - 44, { size: 16, color: shopMsg.color });
    } else if (seller.look) {
      U.text(ctx, '這裡賣的都是外觀，不會增加能力，純粹好看', W / 2, H - 44, { size: 13, color: '#9aa7c7' });
    } else {
      // 沒訊息時顯示目前加成總覽，讓玩家知道買下去有什麼差
      const b = Shop.resolve();
      const bits = [];
      if (b.bonusLives) bits.push('愛心 +' + b.bonusLives);
      if (b.magnet) bits.push('磁鐵 ' + b.magnet + 'px');
      if (b.invulnBonus) bits.push('無敵 +' + b.invulnBonus);
      if (b.jumpBoost) bits.push('跳躍 +' + b.jumpBoost.toFixed(1));
      if (b.coinBonus) bits.push('金幣 +' + Math.round(b.coinBonus * 100) + '%');
      if (b.pitSave) bits.push('救生圈');
      if (b.hold) bits.push('船艙 +' + b.hold);
      if (b.expBonus) bits.push('EXP +' + Math.round(b.expBonus * 100) + '%');
      U.text(ctx, bits.length ? '目前加成：' + bits.join('　') : '還沒買任何強化',
        W / 2, H - 44, { size: 13, color: bits.length ? '#8fe3a0' : '#9aa7c7' });
    }

    U.text(ctx, '方向鍵 選擇　Enter 購買　B 或 Esc 返回地圖',
      W / 2, H - 18, { size: 13, color: '#9aa7c7' });
  }

  /** 遭遇戰勝利畫面：重點是 EXP 與下一篇的解鎖進度（東歐 → 非洲） */
  function drawSeaClear() {
    const def = state.def;
    const r = expResult || { gain: def.exp, before: 0, after: def.am ? Save.expAm() : Save.get().exp, am: !!def.am };
    // 這一場剛好跨過門檻的篇章；沒有的話就看下一個還沒解鎖的
    // v1.30：北歐篇改成劇情解鎖，只看要 EXP 的篇章；v1.31 新大陸只看南美篇（美洲 EXP）
    const XR = r.am ? [Encounter.regionOf('samerica')] : Encounter.EXP_REGIONS;
    const opened = XR.filter(function (g) { return r.before < g.exp && r.after >= g.exp; })[0];
    const target = opened || (r.am ? XR[0] : Encounter.nextRegion(r.after)) || XR[XR.length - 1];
    const need = target.exp;
    const justOpened = !!opened;
    const tall = (justOpened ? 280 : 240) + (r.ally || r.relics ? 70 : r.costume ? 50 : 0) + (r.ally && r.relics ? 50 : 0) + (r.note ? 46 : 0);
    const top = (H - tall) / 2;
    panel(200, top, 560, tall);
    const md = def.monster.def;
    U.text(ctx, md.clearTitle ? md.clearTitle : def.monster.kind === 'wreck' ? '撈起了安提基特拉機械！' : md.duo ? '兩人合力闖過' + md.name + '！' : md.dive ? '潛到了亞特蘭提斯的神殿！' : (md.rare ? '抓到了 ' : md.boss ? '打倒了魔王 ' : '擊退了 ') + md.name + '！', W / 2, top + 42,
      { size: md.clearTitle && md.clearTitle.length > 11 ? 26 : 32, color: md.dive ? '#8ff0e0' : md.rare || md.boss || md.custom ? '#ffe070' : '#8fe3a0' });
    if (r.note) {
      ctx.fillStyle = 'rgba(255, 220, 140, 0.12)';
      U.roundRect(ctx, 230, top + tall - 96 - (r.costume ? 50 : 0), 500, 36, 8); ctx.fill();
      U.text(ctx, fitText(r.note, 480, 14), W / 2, top + tall - 78 - (r.costume ? 50 : 0), { size: 14, color: '#ffe9a8' });
    }
    // 稀有怪掉的時裝（已經自動穿上，到裝備畫面可以換）
    if (r.relics) {
      // 沉船：這次撈到的寶物（新的標金色），以及收藏進度
      ctx.fillStyle = 'rgba(255, 220, 140, 0.12)';
      U.roundRect(ctx, 230, top + tall - 96, 500, 40, 8); ctx.fill();
      r.relics.forEach(function (q, k) { Sprites.relic(ctx, q.id, 254 + k * 30, top + tall - 76, 0.7); });
      const fresh = r.relics.filter(function (q) { return q.fresh; }).length;
      U.text(ctx, '寶物 ' + r.relics.length + ' 件' + (fresh ? '（新收藏 ' + fresh + '）' : '') + '・沉船收藏 ' + Save.get().relics.length + ' / ' + Encounter.RELICS.length,
        W / 2 + 60, top + tall - 76, { size: 14, color: fresh ? '#ffe070' : '#dce5f5' });
    }
    if (r.ally) {
      // 沉船船艙裡的海神夥伴（v1.31.2 從亞特蘭提斯搬過來；沉船同時有寶物那一列 → 往上疊一列）
      const ay = r.relics ? -50 : 0;
      ctx.fillStyle = 'rgba(120, 240, 230, 0.14)';
      U.roundRect(ctx, 230, top + tall - 96 + ay, 500, 40, 8); ctx.fill();
      Sprites.seaAlly(ctx, 262, top + tall - 70 + ay, t, 1, 0.7);
      U.text(ctx, r.ally.full ? '海神夥伴已經跟著你了（最多只能帶一位，魔王關會自動出戰）'
                              : '獲得海神夥伴！下一場魔王關牠會自動出戰幫你打', W / 2 + 14, top + tall - 76 + ay,
        { size: 15, color: '#a8f0e8' });
    }
    if (r.costume) {
      ctx.fillStyle = 'rgba(255, 224, 112, 0.14)';
      U.roundRect(ctx, 260, top + tall - 96, 440, 40, 8); ctx.fill();
      U.text(ctx, '獲得時裝：' + r.costume.name + '（已穿上，按 I 可以換）', W / 2, top + tall - 76,
        { size: 15, color: '#ffe070' });
    }
    U.text(ctx, `經驗值 +${r.gain} ${r.am ? '美洲 EXP' : 'EXP'}`, W / 2, top + 84, { size: 22, color: '#d8ccff' });

    // EXP 條（從 before 長到 after 的動畫）
    const k = U.clamp((45 - sceneTimer) / 45, 0, 1);
    const shown = r.before + (r.after - r.before) * k;
    const bx = 280, by = top + 108, bw = 400, bh = 16;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    U.roundRect(ctx, bx, by, bw, bh, 8); ctx.fill();
    ctx.fillStyle = shown >= need ? '#8fe3a0' : '#a98bff';
    U.roundRect(ctx, bx, by, Math.max(bh, bw * U.clamp(shown / need, 0, 1)), bh, 8); ctx.fill();
    // EXP 篇章都解鎖之後（v1.30 北歐改劇情解鎖）不要再顯示「820 / 500」，只寫累積多少
    U.text(ctx, opened || r.after < need ? `${Math.round(shown)} / ${need}` : `累積 ${Math.round(shown)} EXP`, W / 2, by + 30, { size: 14, color: '#eaf0fa' });

    let y = by + 56;
    if (coinsBanked > 0) {
      U.text(ctx, `錢包 +€ ${coinsBanked}${r.firstBoss ? '（含第一次的獎勵）' : ''}　餘額 € ${Save.get().wallet}`, W / 2, y,
        { size: 14, color: '#ffd166' });
      y += 26;
    }
    if (justOpened) {
      U.text(ctx, target.name + '地圖解鎖！', W / 2, y + 4, { size: 20, color: '#ffd166' });
      // 列出這一篇的國家（從關卡表抓，不手寫）
      const names = Levels.list.filter(function (l) { return l.region === target.id || l.gate === target.id; })
        .map(function (l) { return l.country; });
      U.text(ctx, names.slice(0, 4).join('、') + (names.length > 4 ? '⋯⋯' : '') + '，開船過去吧', W / 2, y + 30,
        { size: 13, color: '#dce5f5' });
    } else if (r.after < need) {
      U.text(ctx, `再 ${need - r.after} ${r.am ? '美洲 EXP' : 'EXP'} 解鎖${target.name}`, W / 2, y + 4, { size: 14, color: '#c6d2e8' });
    }
    if (sceneTimer === 0 && Math.floor(t / 28) % 2 === 0) {
      U.text(ctx, '按 Enter 回到海上', W / 2, top + tall - 22, { size: 18, color: '#ffffff' });
    }
  }

  function drawClear() {
    drawPlay();
    ctx.fillStyle = 'rgba(8,12,24,0.74)';
    ctx.fillRect(0, 0, W, H);
    if (skirmish) { drawSeaClear(); return; }
    const def = state.def;
    // 面板高度依內容算，不要寫死 —— 多了「金幣入帳」那行之後，
    // 固定高度會讓裝備框跟入帳文字疊在一起。
    const bankLine = coinsBanked > 0;
    const tall = 206 + (bankLine ? 26 : 0) + (newEquip ? 80 : 0) + (newClue ? 62 : 0);
    const top = (H - tall) / 2;
    panel(170, top, 620, tall);

    U.text(ctx, '關卡完成！', W / 2, top + 44, { size: 36, color: '#8fe3a0' });
    U.text(ctx, `${def.country} · ${def.city}`, W / 2, top + 86, { size: 21, color: '#ffd166' });
    U.text(ctx, `金幣 ${state.coinsGot}/${state.coinsTotal}　　剩餘命 ${livesTotal()}　　本關 ${runScore} 分`,
      W / 2, top + 118, { size: 16, color: '#ffffff' });

    let y = top + 136;

    // 入帳金額（含全收集的 50% 獎勵）——讓玩家知道錢包多了多少
    if (bankLine) {
      const full = state.coinsTotal > 0 && state.coinsGot >= state.coinsTotal;
      U.text(ctx, `錢包 +\u20AC ${coinsBanked}` + (full ? '（全收集 +50%）' : '') +
        `　餘額 \u20AC ${Save.get().wallet}`,
        W / 2, y + 8, { size: 14, color: '#ffd166' });
      y += 26;
    }

    if (newEquip) {
      ctx.fillStyle = 'rgba(255,209,102,0.12)';
      U.roundRect(ctx, 210, y, 540, 68, 8); ctx.fill();
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 1.5;
      U.roundRect(ctx, 210, y, 540, 68, 8); ctx.stroke();
      Sprites.equipIcon(ctx, newEquip.id, 250, y + 34, 0.9);
      const souv = !Equipment.get(newEquip.id);       // v1.31 美洲篇的紀念品
      U.text(ctx, (souv ? '紀念品：' : '新裝備：') + newEquip.name, 288, y + 22,
        { size: 17, color: '#ffd166', align: 'left' });
      U.text(ctx, souv ? fitText(newEquip.note, 450, 13) : newEquip.desc + '（已存檔，下次還能用）', 288, y + 48,
        { size: 13, color: '#dce5f5', align: 'left' });
      y += 80;
    }

    // 世界之謎：新線索（第一次通關才有）
    if (newClue) {
      ctx.fillStyle = 'rgba(127,196,245,0.12)';
      U.roundRect(ctx, 210, y, 540, 52, 8); ctx.fill();
      ctx.strokeStyle = '#7fc4f5';
      ctx.lineWidth = 1.5;
      U.roundRect(ctx, 210, y, 540, 52, 8); ctx.stroke();
      const p = newClue.progress;
      U.text(ctx, '🔍 ' + newClue.cont.name + '・新線索：' + newClue.clue.item + '（' + p.got + '/' + p.total + '）',
        W / 2, y + 17, { size: 15, color: '#7fc4f5' });
      U.text(ctx, newClue.completed ? '線索全部到齊！回到地圖就會解開謎底'
                                    : newClue.cont.wip ? '非洲篇還在開發中，線索先幫你收著'
                                    : '在地圖按 N，或 ☰ →「世界之謎」查看線索內容',
        W / 2, y + 38, { size: 13, color: newClue.completed ? '#8fe3a0' : '#dce5f5' });
      y += 62;
    }

    U.text(ctx, def.fact, W / 2, y + 14, { size: 13, color: '#c6d2e8' });

    if (sceneTimer === 0 && Math.floor(t / 28) % 2 === 0) {
      const last = !!Levels.list[levelIndex].finale;
      U.text(ctx, last ? '按 Enter 看結局' : '按 Enter 回大地圖',
        W / 2, top + tall - 26, { size: 18, color: '#ffffff' });
    }
  }

  function drawDead() {
    drawPlay();
    ctx.fillStyle = 'rgba(30,8,14,0.8)';
    ctx.fillRect(0, 0, W, H);
    panel(230, 134, 500, 222);
    U.text(ctx, '旅程中斷', W / 2, 182, { size: 38, color: '#ff8a9c' });
    U.text(ctx, `這關拿到 ${state.coinsGot} 枚金幣`, W / 2, 224, { size: 17, color: '#ffffff' });
    // 死亡只保住一半金幣，講清楚才不會覺得被偷
    U.text(ctx, coinsBanked > 0
        ? `錢包 +\u20AC ${coinsBanked}（死亡只保留一半）　餘額 \u20AC ${Save.get().wallet}`
        : `錢包沒有進帳　餘額 \u20AC ${Save.get().wallet}`,
      W / 2, 252, { size: 13, color: '#ffd166' });
    U.text(ctx, skirmish
        ? (deadNote || (skirmish.def.duo ? '試煉場還在，兩個人準備好再來' : skirmish.def.rare ? skirmish.def.name + '溜走了⋯⋯下次看到要把握' : skirmish.def.dive ? '遺跡還在海底，準備好再潛一次' : skirmish.kind === 'charybdis' ? '被漩渦甩出來了⋯⋯' : '怪物還在海上，準備好再去挑戰'))
        : '裝備不會消失，回地圖再挑戰一次',
      W / 2, 280, { size: 14, color: '#c6d2e8' });
    if (sceneTimer === 0 && Math.floor(t / 28) % 2 === 0) {
      U.text(ctx, '按 Enter 回大地圖', W / 2, 324, { size: 18, color: '#ffd166' });
    }
  }

  function drawWin() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#15304f');
    g.addColorStop(1, '#3c2b57');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const rnd = U.rng(99);
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 60; i++) {
      const bx = rnd() * W;
      const sp = 1 + rnd() * 2;
      const by = (rnd() * H + t * sp) % (H + 40) - 20;
      ctx.fillStyle = ['#ffd166', '#8fe3a0', '#ff8a9c', '#7fc4f5'][i % 4];
      ctx.fillRect(bx, by, 5, 12);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(10,14,28,0.6)';
    U.roundRect(ctx, 80, 84, W - 160, 268, 16);
    ctx.fill();

    const sv = Save.get();
    // 依剛打完的是哪一篇顯示（西歐篇 / 東歐篇 / 非洲篇 / 北歐篇）
    const region = (Levels.list[levelIndex] && Levels.list[levelIndex].region) || 'west';
    const WIN_TITLE = { west: '西歐全線踏遍！', east: '東歐篇完成！', africa: '非洲篇完成！', north: '北歐篇完成！', america: '美洲篇完成！', abyss: '亞特蘭提斯海底城完成！' };
    U.text(ctx, WIN_TITLE[region] || WIN_TITLE.west, W / 2, 124, { size: 42, color: '#ffd166' });
    // 路線由關卡資料組出來，加關卡不用改這裡。
    // 10 個城市一行會太長，拆兩行。
    const cities = Levels.list.filter(function (l) { return (l.region || 'west') === region; })
      .map(function (l) { return region === 'abyss' ? l.country : l.city; });   // 海底城四區的 city 都是「亞特蘭提斯」，改列區名
    const half = Math.ceil(cities.length / 2);
    U.text(ctx, cities.slice(0, half).join(' → ') + ' →',
      W / 2, 166, { size: 15, color: '#ffffff' });
    U.text(ctx, cities.slice(half).join(' → '),
      W / 2, 190, { size: 15, color: '#ffffff' });
    U.text(ctx, `總分 ${sv.score}　　裝備 ${sv.equipment.length}/${Equipment.count}`,
      W / 2, 212, { size: 22, color: '#8fe3a0' });

    if (sv.equipment.length) {
      // v1.30：裝備超過 20 件一排放不下（28 件 × 40 = 1120 > 畫面寬）→ 間距、大小跟著縮
      const n = sv.equipment.length;
      const gap = Math.min(40, (W - 200) / Math.max(1, n - 1));
      const sc = Math.min(0.8, gap / 50);
      const startX = W / 2 - (n - 1) * gap / 2;
      sv.equipment.forEach(function (id, i) {
        Sprites.equipIcon(ctx, id, startX + i * gap, 268, sc);
      });
    }
    U.text(ctx, '明信片已經寄回家了。', W / 2, 322, { size: 15, color: '#c6d2e8' });

    if (sceneTimer === 0 && Math.floor(t / 28) % 2 === 0) {
      U.text(ctx, '按 Enter 回到標題', W / 2, 400, { size: 18, color: '#ffffff' });
    }
  }

  function drawPaused() {
    drawPlay();
    ctx.fillStyle = 'rgba(8,12,24,0.72)';
    ctx.fillRect(0, 0, W, H);
    panel(300, 174, 360, 142);
    U.text(ctx, '暫停', W / 2, 214, { size: 34, color: '#ffd166' });
    U.text(ctx, '按 P 繼續', W / 2, 258, { size: 17, color: '#ffffff' });
    U.text(ctx, '進度與裝備已自動存檔', W / 2, 288, { size: 13, color: '#9aa7c7' });
  }

  /** 關卡中按「回大地圖」的確認框 */
  function drawQuitConfirm() {
    drawPlay();
    ctx.fillStyle = 'rgba(8,12,24,0.75)';
    ctx.fillRect(0, 0, W, H);
    panel(250, 150, 460, 190);
    U.text(ctx, skirmish ? (skirmish.def.dive ? '放棄這次潛水？' : skirmish.def.duo ? '放棄這次試煉？' : '放棄這場海戰？') : '放棄這一關？', W / 2, 192, { size: 30, color: '#ffd166' });
    U.text(ctx, skirmish ? '回大地圖後，這場不會拿到 EXP'
                         : '回大地圖後，這一關的金幣和分數不會保留',
      W / 2, 230, { size: 14, color: '#b9c6e2' });
    const touch = document.documentElement.classList.contains('touch');
    U.text(ctx, touch ? '再按左上角 ↩，或按「地圖」（丟的那顆）回大地圖' : 'Enter／Q 回大地圖', W / 2, 270, { size: 18, color: '#ff9aa8' });
    U.text(ctx, touch ? '按「繼續」回到關卡' : 'Esc／P／空白（跳）繼續遊戲', W / 2, 304, { size: 16, color: '#ffffff' });
  }

  /*
   * 解析度倍率（v1.24.1 玩家：電腦網頁版畫面再放大，周圍空太多）。
   * 畫面在電腦上撐滿視窗後會比 960×480 大很多，直接放大會糊／鋸齒 ——
   * 改成畫布的實際像素跟著顯示大小走（canvas.width = 960 × 倍率），所有繪圖照舊用 960×480 的座標，
   * 每帧開頭 setTransform 一次把座標放大。手機不用（倍率 1）：手機像素密度高，畫布放大很吃效能。
   */
  let renderScale = 1;
  function setRenderScale(k) {
    k = Math.max(1, Math.min(3, Math.round(k * 4) / 4));
    if (!ctx || k === renderScale) return;
    renderScale = k;
    ctx.canvas.width = Math.round(W * k);
    ctx.canvas.height = Math.round(H * k);
  }

  function render() {
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // clear / dead / paused 都疊在遊戲畫面上，沒有 state 就畫不出來。
    // 正常流程不會發生（都從 play 進入），但狀態被外部改動時要退回地圖而不是整個崩掉。
    if (!state && (scene === 'play' || scene === 'paused' || scene === 'quitconfirm' ||
                   scene === 'clear' || scene === 'dead')) {
      scene = 'map';
    }

    switch (scene) {
      case 'title': drawTitle(); break;
      case 'map': drawMap(); break;
      case 'inventory': drawInventory(); break;
      case 'shop': drawShop(); break;
      case 'shipyard': drawShipyard(); break;
      case 'market': drawMarket(); break;
      case 'saveinfo': drawSaveInfo(); break;
      case 'journal': drawJournal(); break;
      case 'mystery': drawMystery(); break;
      case 'talk': drawTalk(); break;
      case 'play': drawPlay(); break;
      case 'paused': drawPaused(); break;
      case 'quitconfirm': drawQuitConfirm(); break;
      case 'clear': drawClear(); break;
      case 'dead': drawDead(); break;
      case 'win': drawWin(); break;
      case 'netwait': drawNetWait(); break;
    }
    /*
     * 標題與地圖的浮動提示（切換兩人同機時用）。
     * drawPlay 自己會畫 toast，所以這裡只補非關卡畫面 ——
     * 否則在地圖上按 C 完全沒有回饋，玩家不知道切成功了沒。
     */
    if (toast && (scene === 'title' || scene === 'map' || scene === 'inventory')) drawToast();
    if (Sfx.isMuted()) {
      U.text(ctx, '🔇', W - 24, H - 20, { size: 18, color: '#9aa7c7' });
    }
  }

  // ── 連線遊玩（v1.17）──────────────────────────────────
  /*
   * 架構：房主說了算（host-authoritative）。
   *
   *   房主：照常跑整個遊戲（兩人同機模式），P2 的按鍵改由網路灌進來（Input.remote）；
   *         每 2 帧把關卡狀態傳給朋友，有變的欄位才傳。
   *   朋友：不跑遊戲邏輯，只把收到的狀態畫出來，並把自己的按鍵傳給房主。
   *         朋友看到的畫面＝房主的畫面（跟兩人同機一樣共用鏡頭）。
   *
   * 為什麼不讓兩邊各算各的（lockstep）：Math.sin 之類的浮點結果在 Safari 與 Chrome
   * 不保證一模一樣，算久了兩邊畫面會分岔；而且要等雙方按鍵到齊才能走下一帧，手機網路一抖就卡。
   * 房主說了算的代價是朋友的操作會晚一個來回（約 0.05～0.2 秒），一起破關夠用。
   *
   * 進度兩人都算：房主這邊發生的通關、裝備、魔王、密道、EXP、金幣入帳，
   * 都會發一則訊息給朋友，朋友寫進自己的存檔（線索也就跟著有了）。
   * 能力各用各的：P2 的能力值用朋友自己的裝備算（朋友加入時會把裝備清單傳過來）。
   */
  const LEVEL_SCENES = { play: true, paused: true, quitconfirm: true, clear: true, dead: true, win: true };
  // 每次傳給朋友的遊戲變數（state 以外，畫面會用到的）
  const NET_VARS = ['scene', 'camX', 'camY', 't', 'shake', 'toast', 'lives', 'downed', 'runScore', 'runCoins',
    'levelIndex', 'maxLives', 'sceneTimer', 'coinsBanked', 'expResult', 'newEquip', 'skirmish'];
  // state 裡不用傳的：def 兩邊都有同一份關卡資料（遭遇戰例外，見 netStartMsg）；player 就是 players[0]
  const NET_SKIP = { def: true, player: true };
  const NET_SEND_EVERY = 2;      // 60fps 的遊戲，每 2 帧傳一次 = 30 次/秒

  const net = {
    hello: false,          // 房主：朋友已經打過招呼（版本對、裝備清單到了）
    guestEquip: [],
    guestStats: null,
    prevCoop: false,
    levelLive: false,      // 房主：這一關是朋友加入後才開的（朋友才在關卡裡）
    prev: null,            // 房主：上次傳出去的那一份（下次只傳跟它的差異）
    guestData: null,       // 朋友：目前拼好的那一份 { st, v }
    fx: [],                // 房主：這段時間的音效／音樂呼叫，跟著狀態一起傳
    guestHeld: {},         // 朋友：上次傳出去的按鍵狀態
    hostWait: null,        // 朋友：房主不在關卡時的資訊 { country, inLevel }
    byeReason: null,
    // 連上那一刻記下自己是哪一邊（斷線時 Net.role() 可能已經清掉了，不能靠它判斷）
    side: null,            // 'host' | 'guest' | null
    fxTapped: false
  };

  function isHost() { return net.side === 'host' && Net.connected() && net.hello; }
  // 朋友：資料通道打開之後才算（還在連線中的時候，朋友自己的遊戲照常跑）
  function isGuest() { return net.side === 'guest'; }

  /**
   * 數字只留 1 位小數：0.1 像素畫面上看不出來，
   * 但動畫相位這類每帧只變一點點的值就不會每次都算「有變」，傳輸量少很多
   */
  function netRound(k, v) { return (typeof v === 'number' && !Number.isInteger(v)) ? Math.round(v * 10) / 10 : v; }

  /** 這一刻要同步的東西：關卡狀態 + 畫面會用到的遊戲變數（數字已四捨五入、可以安全比較的純資料） */
  function netCapture() {
    const st = {};
    Object.keys(state).forEach(function (k) { if (!NET_SKIP[k]) st[k] = state[k]; });
    const v = {
      scene: scene, camX: camX, camY: camY, t: t, shake: shake, toast: toast, lives: lives, downed: downed,
      runScore: runScore, runCoins: runCoins, levelIndex: levelIndex, maxLives: maxLives, sceneTimer: sceneTimer,
      coinsBanked: coinsBanked, expResult: expResult, newEquip: newEquip, skirmish: skirmish
    };
    return JSON.parse(JSON.stringify({ st: st, v: v }, netRound));
  }

  /*
   * 兩份資料的差異（遞迴到最底層）。
   *
   * ⚠️ 量出來的教訓：
   *   第一版「欄位有變就整個重傳」→ 敵人每帧都在走，整個敵人陣列每次重送，每秒 122 KB。
   *   第二版只往下比一層 → 豎井關的 shaft 物件裡面有整串樓層，一個小欄位變就整串重送，每秒 266 KB。
   * 所以要一路比到底，只送真正變了的那個值。
   *
   * 第三版量到每秒 37 KB，拆開看發現「值」本身很小，大部分是包裝：一個數字被包成
   * {"o":{"x":{"v":1054.4}}}。所以差異格式改成越短越好：
   *
   *   差異 = 普通物件 { 欄位或陣列索引: X }，X 是
   *     數字／字串／布林／null   直接換成這個值（最常見，例如敵人的 x 座標）
   *     [值]                    整個換掉（物件、陣列，或型別變了、陣列長度變了）
   *     []                      這個欄位被刪掉
   *     普通物件                 往下一層的差異（遞迴）
   *
   * 兩份完全一樣回 undefined；連最外層都不能比（型別不同）時回 [新值]。
   */
  function netDiff(a, b) {
    if (a === b) return undefined;
    const ao = a !== null && typeof a === 'object', bo = b !== null && typeof b === 'object';
    if (!bo) return b;                                     // 新值是基本型別：直接給值
    if (!ao || Array.isArray(a) !== Array.isArray(b)) return [b];
    if (Array.isArray(b) && a.length !== b.length) return [b];
    const out = {};
    let any = false;
    Object.keys(b).forEach(function (k) {
      const d = netDiff(a[k], b[k]);
      if (d !== undefined) { out[k] = d; any = true; }
    });
    if (!Array.isArray(b)) {
      Object.keys(a).forEach(function (k) { if (!(k in b)) { out[k] = []; any = true; } });
    }
    return any ? out : undefined;
  }

  /** 把差異套到資料上，回傳套完的結果 */
  function netPatch(target, d) {
    if (d === null || typeof d !== 'object') return d;     // 基本型別：直接是新值
    if (Array.isArray(d)) return d[0];                     // [值]：整個換掉
    if (target === null || typeof target !== 'object') target = {};
    Object.keys(d).forEach(function (k) {
      const x = d[k];
      if (Array.isArray(x) && x.length === 0) delete target[k];
      else target[k] = netPatch(target[k], x);
    });
    return target;
  }

  function netTakeFx() { const f = net.fx; net.fx = []; return f; }

  /*
   * 音效／音樂跟著傳：把 Sfx、Music 的方法包一層，房主在關卡中呼叫時順便記下來，
   * 朋友收到後照樣呼叫一次。比起在幾十個 Sfx.xxx() 呼叫點各自加程式，這樣不會漏。
   */
  function netTapFx() {
    if (net.fxTapped) return;
    net.fxTapped = true;
    const SKIP = { init: true, toggleMute: true, isMuted: true, attach: true };
    [['S', Sfx], ['M', Music]].forEach(function (pair) {
      const tag = pair[0], obj = pair[1];
      Object.keys(obj).forEach(function (name) {
        const orig = obj[name];
        if (typeof orig !== 'function' || SKIP[name]) return;
        if (tag === 'M' && ['playForLevel', 'playTrack', 'stop'].indexOf(name) < 0) return;
        obj[name] = function () {
          if (isHost() && LEVEL_SCENES[scene] && net.levelLive) {
            net.fx.push([tag, name, Array.prototype.slice.call(arguments)]);
          }
          return orig.apply(obj, arguments);
        };
      });
    });
  }

  /** 房主開了新的一關（或遭遇戰）：把朋友放進 P2、傳完整狀態 */
  function netLevelStarted() {
    if (!isHost()) { net.levelLive = false; return; }
    net.levelLive = true;
    const p2 = state.players[1];
    if (p2) {
      p2.stats = state.duo ? Duo.seal(net.guestStats) : net.guestStats;
      p2.equipped = {};
      (net.guestStats.worn || net.guestEquip).forEach(function (id) { p2.equipped[id] = true; });
      lives[1] = net.guestStats.maxLives;
    }
    net.fx = [];
    net.prev = netCapture();
    Net.send({
      t: 'start',
      full: net.prev,
      // 遭遇戰的關卡是臨時產生的（Levels.list 裡沒有），要整份傳；一般關卡朋友自己有
      def: levelIndex < 0 ? JSON.parse(JSON.stringify(state.def, netRound)) : null
    });
  }

  /** 房主：進度事件 → 朋友的存檔也記一份 */
  function netProgress(msg) { if (isHost() && net.levelLive) Net.send(msg); }

  /** 房主：每帧結束後 */
  function netHostAfterTick() {
    if (!isHost()) return;
    if (LEVEL_SCENES[scene] && net.levelLive && state) {
      if (t % NET_SEND_EVERY === 0 || net.fx.length) {
        const cap = netCapture();
        const p = netDiff(net.prev, cap);
        net.prev = cap;
        const msg = { t: 's' };
        if (p) msg.p = p;
        if (net.fx.length) msg.fx = netTakeFx();
        if (msg.p || msg.fx) Net.send(msg);
      }
    } else if (t % 20 === 0) {
      const def = Levels.list[cursor];
      Net.send({ t: 'wait', country: def ? def.country + '・' + def.city : '', inLevel: !!LEVEL_SCENES[scene] });
    }
  }

  /** 朋友：把收到的狀態套進來（之後的 render 就照著畫） */
  function netApply(msg, fresh) {
    if (fresh) {
      net.guestData = msg.full;
      newClue = null;
      newEquip = null;
    } else if (msg.p) {
      if (!net.guestData) return;          // 還沒收到這一關的完整狀態，差異無從套起
      net.guestData = netPatch(net.guestData, msg.p);
    }
    const gd = net.guestData;
    if (!gd) return;
    state = gd.st;
    const v = gd.v;
    NET_VARS.forEach(function (k) {
      if (!(k in v)) return;
      switch (k) {
        case 'scene': scene = v.scene; break;
        case 'camX': camX = v.camX; break;
        case 'camY': camY = v.camY; break;
        case 't': t = v.t; break;
        case 'shake': shake = v.shake; break;
        case 'toast': toast = v.toast; break;
        case 'lives': lives = v.lives; break;
        case 'downed': downed = v.downed; break;
        case 'runScore': runScore = v.runScore; break;
        case 'runCoins': runCoins = v.runCoins; break;
        case 'levelIndex': levelIndex = v.levelIndex; break;
        case 'maxLives': maxLives = v.maxLives; break;
        case 'sceneTimer': sceneTimer = v.sceneTimer; break;
        case 'coinsBanked': coinsBanked = v.coinsBanked; break;
        case 'expResult': expResult = v.expResult; break;
        case 'newEquip': newEquip = v.newEquip ? Equipment.get(v.newEquip.id) || Souvenirs.get(v.newEquip.id) || v.newEquip : null; break;
        case 'skirmish': skirmish = v.skirmish; break;
      }
    });
    if (fresh) net.guestDef = msg.def || Levels.list[levelIndex];
    state.def = net.guestDef;
    if (state.players) state.player = state.players[0];
    // JSON 傳不了函式：裝備定義換回本地那份
    if (state.equip && state.equip.id) state.equip.def = Equipment.get(state.equip.id) || Souvenirs.get(state.equip.id) || state.equip.def;
    coop = true;
    (msg.fx || []).forEach(function (f) {
      const obj = f[0] === 'S' ? Sfx : Music;
      if (typeof obj[f[1]] === 'function') { try { obj[f[1]].apply(obj, f[2]); } catch (e) { /* 音效失敗不影響遊戲 */ } }
    });
  }

  /** 朋友：房主這邊通關／拿裝備⋯⋯ → 記進自己的存檔 */
  function netGuestProgress(msg) {
    switch (msg.t) {
      case 'clear': {
        const first = !Save.isCleared(msg.li);
        Save.markCleared(msg.li, msg.cg, msg.ct, msg.score);
        Save.addScore(msg.score);
        if (msg.gain > 0) Save.addCoins(msg.gain);
        const clue = Mystery.clueFor(msg.li);
        const cont = Mystery.continentOf(msg.li);
        newClue = null;
        if (first && clue && cont) {
          const pr = Mystery.progress(cont.id);
          newClue = { clue: clue, cont: cont, progress: pr, completed: pr.complete };
          if (pr.complete) pendingReveal = cont.id;
        }
        break;
      }
      case 'equip':
        if (!Equipment.get(msg.id)) { Save.addSouvenir(msg.id); break; }   // 紀念品
        Save.addEquip(msg.id);
        stats = Equipment.resolve(Save.wornIds());
        break;
      case 'boss': Save.markBoss(msg.li); break;
      case 'secret': Save.markSecret(msg.li, msg.idx); break;
      case 'exp':
        Save.addExp(msg.n);
        if (msg.gain > 0) Save.addCoins(msg.gain);
        break;
      case 'coins': if (msg.n > 0) Save.addCoins(msg.n); break;
    }
  }

  /** 朋友：把自己的按鍵變化傳給房主（按下又放開在同一帧內的快速點按也要傳） */
  function netGuestInput() {
    Input.REMOTE_ACTIONS.forEach(function (a) {
      const down = Input.isDown(a);
      const tapped = Input.once(a) && !down;
      if (down !== !!net.guestHeld[a]) {
        net.guestHeld[a] = down;
        Net.send({ t: 'in', a: a, d: down ? 1 : 0 });
      } else if (tapped) {
        Net.send({ t: 'in', a: a, d: 1 });
        Net.send({ t: 'in', a: a, d: 0 });
      }
    });
  }

  /** 朋友的一帧：不跑遊戲，只傳按鍵 */
  function netGuestTick() {
    if (Net.connected()) netGuestInput();
    if (Input.once('mute')) Sfx.toggleMute();
    // 剛湊齊線索在看謎底：朋友可以自己操作這個畫面，看完（回到 'map'）就回等待畫面
    if (scene === 'mystery') updateMystery();
    else if (!LEVEL_SCENES[scene]) scene = 'netwait';
    if (scene === 'map') scene = 'netwait';
    Input.endFrame();
  }

  function netOnData(msg) {
    if (!msg || !msg.t) return;
    if (net.side === 'host') {
      if (msg.t === 'hello') {
        if (msg.v !== Brand.version) {
          Net.send({ t: 'bye', why: 'version', v: Brand.version });
          return;
        }
        net.hello = true;
        net.guestEquip = (msg.equip || []).filter(function (id) { return !!Equipment.get(id); });
        // 保險：舊版朋友會送整包已擁有的裝備 → 每個部位只留一件
        net.guestStats = Equipment.resolve(Equipment.pickWorn(net.guestEquip));
        net.prevCoop = coop;
        coop = true;
        net.levelLive = false;
        Sfx.equip();
        toast = { text: '朋友加入了！', sub: LEVEL_SCENES[scene] ? '這一關打完，下一關就一起玩' : '選一個關卡，一起出發吧', life: 220 };
        Net.send({ t: 'welcome' });
      } else if (msg.t === 'in') {
        Input.remote(msg.a, msg.d);
      }
      return;
    }
    // ── 朋友 ──
    switch (msg.t) {
      case 'welcome':
        scene = 'netwait';
        state = null;
        Music.playTrack(mapTrack());
        break;
      case 'start': netApply(msg, true); break;
      case 's': if (state) netApply(msg, false); break;
      case 'wait':
        net.hostWait = { country: msg.country, inLevel: msg.inLevel };
        if (LEVEL_SCENES[scene]) {
          // 房主離開關卡了：朋友回到等待畫面（剛湊齊線索的話先揭曉謎底）
          state = null;
          net.guestData = null;
          Music.playTrack(mapTrack());
          if (pendingReveal) openMystery(pendingReveal, true); else scene = 'netwait';
        }
        break;
      case 'bye':
        net.byeReason = msg.why === 'version'
          ? '版本不同（房主是 v' + msg.v + '，你是 v' + Brand.version + '）：兩人都重新整理網頁再試一次'
          : msg.why === 'full' ? '這個房間已經有人了' : null;
        // 被房主拒絕：自己斷線（房主只是離開的話，對方會關掉連線，等 close 事件就好）
        if (msg.why === 'version' || msg.why === 'full') Net.leave();
        break;
      default: netGuestProgress(msg);
    }
  }

  function netOnOpen() {
    net.side = Net.role();
    if (net.side === 'guest') {
      net.guestHeld = {};
      net.hostWait = null;
      net.byeReason = null;
      net.prevCoop = coop;
      // 送「裝上的」裝備（v1.22 分部位：沒裝的不生效）
      Net.send({ t: 'hello', v: Brand.version, equip: Save.wornIds() });
    } else {
      net.hello = false;
    }
  }

  function netOnClose() {
    const side = net.side;
    net.side = null;
    if (side === 'host') {
      // 房主：朋友離開了。P2 退場（他按住的鍵全部放開），恢復原本的單人／同機設定
      if (net.hello) {
        Input.releaseRemote();
        if (LEVEL_SCENES[scene] && state && state.players[1]) downed[1] = true;
        coop = net.prevCoop;
        toast = { text: '朋友離線了', sub: '可以繼續一個人玩，或請朋友用同一個邀請碼重新加入', life: 220 };
        // 雙人試煉一個人過不去：直接講清楚要回地圖
        if (LEVEL_SCENES[scene] && state && state.duo) {
          toast = { text: '朋友離線了', sub: '雙人試煉一個人過不去 —— 按左上角 ↩ 回地圖，等朋友重新加入再來', life: 300 };
        }
      }
      net.hello = false;
      net.levelLive = false;
      return;
    }
    if (side === 'guest') {
      // 朋友：回到自己的地圖（一起打的進度早就逐筆存進自己的存檔了）
      state = null;
      net.guestData = null;
      coop = net.prevCoop;
      const why = net.byeReason;
      toMap();
      toast = { text: '和房主的連線中斷了', sub: why || '回到你自己的地圖，一起打的進度都已經存好了', life: 260 };
    }
  }

  /** 朋友的等待畫面：房主在地圖選關卡時 */
  function drawNetWait() {
    drawMapBackdrop(Save.get());
    ctx.fillStyle = 'rgba(8,12,24,0.72)';
    ctx.fillRect(0, 0, W, H);
    panel(230, 150, 500, 180);
    U.text(ctx, '已和房主連線', W / 2, 190, { size: 28, color: '#8fe3a0' });
    const w = net.hostWait;
    const dots = '．'.repeat(1 + Math.floor(Date.now() / 500) % 3);
    U.text(ctx, w && w.inLevel ? '房主正在關卡中，下一關就一起玩' + dots : '等房主選關卡' + dots,
      W / 2, 232, { size: 18, color: '#ffffff' });
    if (w && w.country) U.text(ctx, '房主目前在：' + w.country, W / 2, 266, { size: 15, color: '#ffd166' });
    U.text(ctx, '你是 2P（' + (document.documentElement.classList.contains('touch') ? '用畫面上的按鈕' : '用方向鍵／空白／K') + '）', W / 2, 298,
      { size: 13, color: '#9aa7c7' });
  }

  Net.on('data', netOnData);
  Net.on('open', netOnOpen);
  Net.on('close', netOnClose);

  // ── 主迴圈：固定步長 ──────────────────────────────────
  let acc = 0, last = 0;
  const STEP = 1000 / 60;

  /** 推進一帧。暫停時只聽「繼續／回地圖」，不跑 update。主迴圈與測試用的 step 共用 */
  function tick() {
    // 連線中的朋友：不跑遊戲邏輯，畫面全靠房主傳來的狀態
    if (isGuest()) { netGuestTick(); return; }
    tickLocal();
    netHostAfterTick();
  }

  function tickLocal() {
    if (scene === 'paused') {
      if (Input.once('pause') || Input.once('back')) scene = 'play';
      else if (Input.once('tomap')) { Sfx.select(); scene = 'quitconfirm'; }
      Input.endFrame();
      t++;
    } else if (scene === 'quitconfirm') {
      /*
       * 「放棄這一關、回大地圖？」確認框（遊戲凍結，跟暫停一樣不跑 update）。
       * 只有「確定」才會離開；Esc／P／跳躍 都是取消、回到關卡。
       * 跳躍也算取消：手機上「跳」是最順手的那顆，取消要好按。
       * 再按一次「回地圖」也算確定：手機的跳／確定是同一顆，在這裡它是「繼續」，要離開就再按一次地圖。
       */
      if (Input.once('confirm') || Input.once('tomap')) { Sfx.select(); toMap(); }
      else if (Input.once('back') || Input.once('pause') || Input.once('jump')) { Sfx.select(); scene = 'play'; }
      Input.endFrame();
      t++;
    } else {
      update();
    }
  }

  /*
   * v1.31.4 玩家反映：手機版進裝備之後返回鍵失效（自己沒遇到）。
   * 返回鍵本身沒問題 —— 會「整個按不動」只有一種可能：某一帧丟了例外，原本 requestAnimationFrame 排在最後，
   * 一丟例外就不會再排下一帧，遊戲整個凍住，按什麼都沒反應（跟存檔內容有關，所以有人遇到、有人沒有）。
   * 現在先排下一帧再跑，出錯時記在 console；在子畫面（裝備、商店⋯⋯）裡出錯就直接送回大地圖，不會卡死。
   */
  let frameErrors = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    try {
      if (!last) last = now;
      acc += now - last;
      last = now;
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        tick();
        acc -= STEP;
        steps++;
      }
      if (acc > STEP * 5) acc = 0;
      render();
    } catch (e) {
      acc = 0;
      if (frameErrors++ < 20 && typeof console !== 'undefined') console.error('[frame]', scene, e);
      if (SUB_SCREENS_ESCAPE[scene]) { scene = 'map'; invMsg = null; shopMsg = null; }
    }
  }
  const SUB_SCREENS_ESCAPE = { inventory: true, shop: true, shipyard: true, market: true, saveinfo: true, journal: true, mystery: true };

  /*
   * v1.31 玩家：塞爾維亞換成滑雪、保加利亞換成羽球 →「已破關的玩家變回還沒破的關卡，這樣他才能體驗到」。
   * 每個存檔只做一次（旗標 remake131）。
   */
  function remakeReset() {
    if (Save.flag('remake131')) return;
    ['RS', 'BG'].forEach(function (id) {
      const i = Levels.list.findIndex(function (lv) { return lv.id === id; });
      if (i >= 0) Save.resetLevel(i);
    });
    Save.setFlag('remake131', 1);
  }

  function init(canvas) {
    ctx = canvas.getContext('2d');
    Save.load();
    remakeReset();
    stats = Equipment.resolve(Save.wornIds());
    maxLives = stats.maxLives;
    netTapFx();
    requestAnimationFrame(frame);
  }

  /**
   * 遠程攻擊現在能不能用（手機按鈕要顯示鎖頭）。
   * 要先拿到裝備才解鎖；海上「艦砲對決」例外 —— 那裡丟的鍵是拿來開砲的，沒裝備也能按。
   */
  function abilities() {
    const s = stats || {};
    const cannon = scene === 'play' && !!(state && state.mini && state.mini.kind === 'pirates');
    return { throw: !!s.ranged || cannon };
  }

  /**
   * 清除存檔。存檔畫面（Delete 鍵按兩次）和手機標題畫面的「刪除存檔」按鈕共用。
   * 「要按兩次才算」由呼叫端負責 —— 這裡只管清乾淨、把能力重算。
   */
  function wipeSave() {
    if (!canWipe()) return false;
    Save.reset();
    stats = Equipment.resolve(Save.wornIds());
    maxLives = stats.maxLives;
    cursor = 0;
    confirmWipe = false;
    Sfx.hurt();
    // 不在標題就回大地圖：原本所在的國家可能已經變回未解鎖，船要放回第一國
    if (scene !== 'title') toMap();
    toast = { text: '存檔已刪除', sub: '從頭開始新的遠征', life: 170 };
    return true;
  }

  /** 關卡進行中不能刪存檔（關卡狀態還握著舊的裝備與能力，刪到一半會錯亂） */
  const IN_LEVEL = { play: true, paused: true, quitconfirm: true, clear: true, dead: true, win: true };
  // 連線中也不行：朋友的畫面是房主的狀態，房主刪了存檔朋友那邊會對不上
  function canWipe() { return !IN_LEVEL[scene] && !net.side; }

  /** 按了還沒解鎖的武器鍵：告訴玩家去哪裡拿 */
  const LOCK_HINTS = {
    throw: { id: 'brolly', title: '遠程攻擊還沒解鎖' }
  };
  function lockedHint(action) {
    const h = LOCK_HINTS[action];
    const eq = h && Equipment.get(h.id);
    if (!eq) return;
    Sfx.clang();
    toast = { text: h.title, sub: '到' + eq.country + '關拿到「' + eq.name + '」就能用', life: 170 };
  }

  return {
    init: init,
    setRenderScale: setRenderScale,
    abilities: abilities,
    lockedHint: lockedHint,
    wipeSave: wipeSave,
    canWipe: canWipe,
    /** 連線狀態（連線面板用）：side = 'host'|'guest'|null；ready = 房主已收到朋友的招呼 */
    netInfo: function () {
      return { side: net.side, ready: net.side === 'guest' || net.hello, inLevel: !!LEVEL_SCENES[scene], byeReason: net.byeReason };
    },
    /** 目前在哪個畫面（手機按鈕依畫面顯示/隱藏） */
    scene: function () { return scene; },
    /** 測試用 */
    debug: {
      getScene: function () { return scene; },
      setScene: function (s) { scene = s; sceneTimer = 0; },
      getState: function () { return state; },
      /** 不靠 requestAnimationFrame，手動推進 n 帧（測試用，結果可重現） */
      step: function (n) {
        for (let k = 0; k < (n || 1); k++) tick();
      },
      getCursor: function () { return cursor; },
      /** 鏡頭位置（測試用：把世界座標換成畫面座標） */
      getCam: function () { return { x: camX, y: camY }; },
      /** 連線（測試用）：房主立刻把目前狀態傳出去，不等下一個「每 2 帧」的時間點 */
      netFlush: function () {
        if (!isHost() || !net.levelLive) return false;
        const cap = netCapture();
        const p = netDiff(net.prev, cap);
        net.prev = cap;
        if (p) Net.send({ t: 's', p: p });
        return true;
      },
      /** 世界之謎的畫面狀態（測試用） */
      getMystery: function () {
        return { cursor: mysteryCursor, reveal: mysteryReveal, pending: pendingReveal, newClue: newClue };
      },
      setCursor: function (c) { cursor = c; },
      /** v1.31.2 海底城（測試用）：直接潛下去／游回海面 */
      enterAbyss: function () { scene = 'map'; enterAbyss(); },
      leaveAbyss: function () { scene = 'map'; leaveAbyss(); },
      abyssNotice: function () { return abyssNotice(); },
      /** v1.31.2 直接打開一段對話（測試用：merHome、eiffel⋯⋯） */
      talk: function (who) { scene = 'map'; openTalk(who); return talk; },
      enter: function (i) { startLevel(i || 0); },
      /** 立刻畫一帧（測試用：抓「畫的時候才會丟例外」的 bug） */
      render: function () { render(); },
      /** 直接開一場海上遭遇戰（kind = 'gulls' / 'pirates' / 'serpent'） */
      fightSea: function (kind) {
        if (scene !== 'map') toMap();
        const k = Encounter.KINDS[kind || 'gulls'];
        const m = k && k.boss ? Encounter.boss(kind) : Encounter.spawn(Voyage.shipPos(), 0, kind || 'gulls');
        if (m) startSkirmish(m);
        return !!m;
      },
      /** 直接進雙人試煉（kind = 'duoTwins' / 'duoMaze'），會自動打開兩人同機 */
      enterDuo: function (kind) {
        if (scene !== 'map') toMap();
        coop = true;
        const sp = Voyage.shipPos();
        startSkirmish({ kind: kind, def: Encounter.KINDS[kind], x: sp.x, y: sp.y, port: true });
        return state;
      },
      warpToGoal: function () {
        if (!state) return;
        // 豎井關（含亞特蘭提斯）：放到抵達層上方，相機直接移到底
        if (state.shaft) {
          const g = state.shaft.floors.filter(function (f) { return f.goal; })[0];
          if (g) {
            state.player.x = g.rect.x + g.rect.w / 2 - state.player.w / 2;
            state.player.y = g.rect.y - state.player.h - 2;
            state.player.vx = 0; state.player.vy = 0;
            camY = Math.max(0, g.rect.y - H * 0.6);
            state.shaft.camY = camY;
          }
          return;
        }
        // 要真的跨過終點線（條件是 x + w >= goal）
        state.player.x = state.def.goal - state.player.w + 4;
        state.player.y = Levels.GROUND_Y - state.player.h;
        state.player.vx = 0; state.player.vy = 0;
      },
      warpTo: function (x, y) {
        if (!state) return;
        state.player.x = x;
        state.player.y = y == null ? Levels.GROUND_Y - state.player.h : y;
        state.player.vx = 0; state.player.vy = 0;
      },
      grantAll: function () {
        Equipment.defs.forEach(function (d) { Save.addEquip(d.id); });
        Equipment.pickWorn(Save.get().equipment).forEach(function (id) { Save.wear(id); });
        stats = Equipment.resolve(Save.wornIds());
        maxLives = stats.maxLives;
      },
      unlockAll: function () {
        const sv = Save.get();
        sv.unlocked = Levels.count;
        Save.save();
      },
      resetSave: function () {
        Save.reset();
        // 跟遊戲內「清除存檔」一致：能力要一起重算，不然還保留舊存檔的裝備
        stats = Equipment.resolve(Save.wornIds());
        maxLives = stats.maxLives;
      },
      /** 兩人同機（測試用：不必模擬按鍵） */
      setCoop: function (on) { coop = !!on; },
      isCoop: function () { return coop; },
      getLives: function () { return lives.slice(); },
      getDowned: function () { return downed.slice(); }
    }
  };
})();
