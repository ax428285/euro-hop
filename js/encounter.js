'use strict';

/**
 * 海上遭遇戰 —— 大地圖上隨機出現的怪物（v1.8 改版）。
 *
 * 玩法：海面上會不定期冒出怪物，把船開過去按 Enter 就開打，贏了拿 EXP。
 * EXP 累積到 EAST_EXP 解鎖東歐篇。偶爾會出現閃金光的「稀有怪」，抓到會掉時裝。
 *
 * ── v1.8：從「打三波小怪」改成小遊戲 ────────────────────────────
 * 舊版每種怪都是「在小島上打完 2~3 波一般關卡的小怪」，
 * 跟橫向關卡玩起來一模一樣，又要打很久。現在每種怪是一個 20~45 秒、
 * 規則完全不同的小遊戲：
 *
 *   海鷗群   守護午餐   海鷗從兩邊俯衝搶麵包籃，碰到就把牠嚇跑，撐到時間到
 *   海盜船   艦砲對決   砲口自己上下擺，抓準時機按 K（丟）／Enter 開砲，命中 3 次；同時閃對方的砲彈
 *   調皮海獺 拍拍頭     海獺從甲板的洞輪流冒出來，拍中 6 次；牠會噴水（v1.26.1 玩家：海蛇太噁心，換成可愛生物）
 *   黃金海馬 捕捉       稀有怪：在場上亂竄、越來越快，碰到牠 3 次就抓到，掉落時裝
 *
 * 角色的跑跳物理完全沿用關卡那一套（updatePlayer），只換「目標」與場上的東西 ——
 * 操作不用重學，但每場要做的事都不一樣。
 * 小遊戲內部不用 Math.random（排程用帧數算），結果可重現、可以測試。
 *
 * ── 對外 API ──────────────────────────────────────────────
 *   Encounter.updateMap(ship, exp)  地圖上的怪：生成、遊蕩、消失；回傳事件（'rare' = 稀有怪出現）
 *   Encounter.drawMap(ctx, t)
 *   Encounter.nearby()              船旁邊可以挑戰的怪
 *   Encounter.makeDef(m, stats)     把一隻怪換成小遊戲的關卡定義
 *   Encounter.updateSkirmish(st, input)  小遊戲每帧，回傳 'clear' / 'minifail' 等事件
 *   Encounter.drawWorld / drawHud   小遊戲的場景物件與目標顯示
 *   Encounter.remove(m)
 */
const Encounter = (function () {

  const EAST_EXP = 300;
  /*
   * 要 EXP 解鎖的篇章（依門檻由低到高）。v1.21 加非洲篇。
   * 西歐篇不在這裡 = 一開始就開放。地圖鎖定、靠港、EXP 條、勝利畫面都讀這張表。
   */
  const REGIONS = [
    { id: 'east', name: '東歐篇', exp: EAST_EXP },
    { id: 'africa', name: '非洲篇', exp: 500 },     // v1.21.1 玩家：700 → 500
    /*
     * v1.30 北歐篇：不用 EXP，用劇情解鎖（quest）—— 北海的雷神索爾把北歐罩在結界裡，
     * 找到躲在冥界的洛基、回去跟索爾說完話才解開（見 quests.js）。
     */
    { id: 'north', name: '北歐篇', quest: true }
  ];
  function regionOf(id) { return REGIONS.filter(function (r) { return r.id === id; })[0] || null; }
  /** 這一篇解鎖了嗎（不在表上的篇章 = 一開始就開放；quest 篇章看劇情） */
  function regionUnlocked(id, exp) {
    const r = regionOf(id);
    if (!r) return true;
    if (r.quest) return typeof Quests !== 'undefined' && Quests.northOpen();
    return exp >= r.exp;
  }
  /** 要 EXP 解鎖的篇章（EXP 條、海戰勝利畫面用；劇情解鎖的不算） */
  const EXP_REGIONS = REGIONS.filter(function (r) { return r.exp != null; });
  /** 下一個還沒解鎖的 EXP 篇章（全部都解鎖了回 null） */
  function nextRegion(exp) { return EXP_REGIONS.filter(function (r) { return exp < r.exp; })[0] || null; }

  const MAX_ON_MAP = 3;
  const SPAWN_EVERY = 240;
  const SPAWN_CHANCE = 0.4;
  const RARE_CHANCE = 0.1;       // 每次生怪有 10% 是稀有怪（場上最多一隻）
  const LIFETIME = 60 * 45;
  const RARE_LIFETIME = 60 * 25; // 稀有怪待得比較短：看到要把握
  const TOUCH = 24;

  const KINDS = {
    /*
     * EXP 分配（v1.13.1 重調）。
     * 海鷗是「撐滿 25 秒」的守備戰，一定打滿全程；海盜、海蛇打得好十幾秒就結束。
     * 舊值海鷗 30 換算每秒只有 1.2 EXP，是海盜（5.5）、海蛇（8.2）的五分之一，
     * 偏偏牠出現機率最高 —— 玩家覺得「打 Lv1 怪根本沒經驗」。
     * 現在海鷗 70 / 海盜 90 / 海蛇 130：等級高的還是給比較多，但海鷗不再白打；
     * 解鎖東歐篇（300）從大約 7 場縮到 4 場左右。
     */
    gulls:   { name: '海鷗群',   lv: 1, exp: 70,  game: '守護午餐', goal: '海鷗頭上出現「!」在盤旋時，跳起來碰牠就嚇跑了' },
    pirates: { name: '海盜船',   lv: 2, exp: 90,  game: '艦砲對決', goal: '抓準砲口角度，命中海盜船 5 次' },
    // v1.26.1 玩家：Lv3 的蛇太噁心 → 換成調皮海獺（id 還是 serpent，玩法不變：從洞裡冒出來，跳上去拍頭）
    serpent: { name: '調皮海獺', lv: 3, exp: 130, game: '拍拍頭',   goal: '海獺從甲板的洞冒出來時，跳上去拍拍牠的頭 6 次' },
    golden:  { name: '黃金海馬', lv: '★', exp: 60, game: '捕捉',     goal: '碰到牠 3 次就抓到了！', rare: true },
    /*
     * 海上魔王（v1.23 玩家：地中海放隻海怪當魔王）——
     * 希臘神話的斯庫拉：住在墨西拿海峽（西西里與義大利之間）的六頭海妖，
     * 奧德修斯的船經過時被她一口叼走六個水手。固定待在海峽北口，不會遊走也不會消失。
     * 第一次打倒：bossExp + bossCoins；之後再打給一般的 exp。
     */
    scylla:  { name: '海妖斯庫拉', lv: '魔王', exp: 150, bossExp: 250, bossCoins: 200, game: '墨西拿海峽',
               goal: '頭咬下來卡在甲板上時跳上去踩！每顆頭踩兩下，六顆都打倒就贏了', boss: true }
  };
  /*
   * 亞特蘭提斯（v1.23.1 玩家：找個海域插一個亞特蘭提斯，關卡方式是潛水）——
   * 柏拉圖說它在「海克力斯之柱（直布羅陀海峽）之外」，所以放在海峽西邊的大西洋。
   * 不是小遊戲，是一整段往下潛的豎井關（Levels.makeShaft 產生，見 diveDef）；不佔關卡編號、不影響存檔順序。
   * 潛到底的神殿裡拿到「海神夥伴」（消耗品，魔王關自動出戰，見 game.js updateAlly）。
   */
  KINDS.atlantis = { name: '亞特蘭提斯', lv: '遺跡', exp: 120, bossExp: 200, bossCoins: 250, game: '潛水探險',
                     goal: '往下潛到最底層的神殿！跳躍 = 往上游・頭上的氣泡用完會嗆水，游進噴口的氣泡柱補氣', dive: true };
  /*
   * 安提基特拉沉船（v1.26 港口 A：沉船潛水）。不是地圖上的怪，入口是 worldmap.js 的港口（PORT_DEFS）。
   * 一整段 1～2 分鐘的橫向潛水：暗流、會夾人的巨蚌、鯊魚，三件寶物藏在沿路，終點船艙裡是安提基特拉機械。
   */
  KINDS.wreck = { name: '安提基特拉沉船', lv: '港口', exp: 90, bossExp: 160, bossCoins: 300, game: '沉船潛水',
                  goal: '撈起沉船裡的寶物！跳躍 = 往上游・小心暗流、巨蚌和鯊魚，終點船艙有安提基特拉機械', dive: true };
  /*
   * 雙人試煉（v1.28）：入口是 worldmap.js 的港口（PORT_DEFS，scene: 'duo'），關卡在 duo.js。
   * 要兩位玩家（同機按 C，或連線找朋友當 2P）才進得去；第一次過關的獎勵記在 Save.seaBosses。
   */
  KINDS.duoTwins = { name: '哈圖沙獅子門', lv: '雙人', exp: 80, bossExp: 180, bossCoins: 250, game: '雙人試煉', duo: 'twins', track: 'IT', tags: '壓力板・閘門・吊橋・雙開關',
                     goal: '一人踩住壓板，另一人才過得了閘門和吊橋・最後兩塊壓板要同時有人站' };
  KINDS.duoMaze = { name: '代林庫尤地下城', lv: '雙人', exp: 80, bossExp: 200, bossCoins: 300, game: '雙人試煉', duo: 'maze', track: 'GR', tags: '疊羅漢・拉桿・雙開關・閘門',
                    goal: '站到隊友頭上再跳，上得了高台（疊羅漢）・上去的人拉桿子放踏板給隊友' };
  /** 沉船的寶物（Save.relics 記撈過哪些；mechanism 是終點自動拿到） */
  const RELICS = [
    { id: 'amphora', name: '羅德島雙耳陶罐', note: '船上載了好幾百個裝酒的雙耳陶罐，罐口還留著封蠟。' },
    { id: 'philosopher', name: '哲學家青銅頭像', note: '一尊留著大鬍子的青銅頭像，眼神銳利，被叫做「安提基特拉的哲學家」。' },
    { id: 'coin', name: '帕加馬銀幣', note: '船上找到的銀幣讓考古學家推算出：這艘船大約在西元前 60 年沉沒。' },
    { id: 'mechanism', name: '安提基特拉機械', note: '三十幾個青銅齒輪組成的天文計算機，能預測日月食 —— 被稱為世界最古老的電腦。' }
  ];

  /** 地圖上固定的地點（經緯度；不能航行的話往附近找開闊海面）：海上魔王＋亞特蘭提斯 */
  /*
   * E 卡律布狄斯大漩渦（v1.27）：神話裡跟斯庫拉一對，守在墨西拿海峽的另一邊，一天吞吐海水三次。
   * 奧德修斯只能二選一：靠近斯庫拉被叼走六個人，或靠近卡律布狄斯整艘船被吞掉。
   * 地圖上：船開進漩渦範圍會被往中心吸（開船用力就逃得掉）；被吸到中心就是「漩渦逃生」小遊戲。
   */
  KINDS.charybdis = { name: '卡律布狄斯大漩渦', lv: '漩渦', exp: 90, bossExp: 160, bossCoins: 150, game: '漩渦逃生',
                      goal: '漩渦會把你往中間的漩渦眼拖！跳著抓住 5 個救生圈就能逃出去', fixed: true };
  const VORTEX_R = 45;          // 地圖上被吸的範圍（旁邊就是安提基特拉沉船的港口，不能吸到那邊）
  const VORTEX_EYE = 9;         // 吸到這麼近就開打
  let vortexCalm = 0;           // 剛逃出來的那一陣子不吸（不然一回地圖又被吸進去）
  const SEA_BOSSES = [{ kind: 'scylla', lon: 15.3, lat: 38.7 }, { kind: 'atlantis', lon: -9.4, lat: 33.4 },
                      // 神話裡在墨西拿海峽另一邊，但海峽在地圖上太窄（斯庫拉已經站在那）→ 放到海峽南邊外海的愛奧尼亞海
                      { kind: 'charybdis', lon: 19.2, lat: 36.0 }];

  let monsters = [];
  let spawnTimer = 120;
  let nearM = null;

  // ── 地圖上的怪 ─────────────────────────────────────────

  function pickKind(exp) {
    // v1.27 貿易：船上每有一箱貨，海盜的權重 +2（貨越多越容易被盯上）
    const cargo = typeof Save !== 'undefined' && Save.cargoCount ? Save.cargoCount() : 0;
    const w = [['gulls', 5], ['pirates', (exp >= 30 ? 3 : 1) + cargo * 2], ['serpent', exp >= 90 ? 2 : 0]];
    const total = w.reduce(function (s, x) { return s + x[1]; }, 0);
    let r = Math.random() * total;
    for (let i = 0; i < w.length; i++) { r -= w[i][1]; if (r < 0) return w[i][0]; }
    return 'gulls';
  }

  function findSpawn(ship) {
    const ports = Voyage.ports();
    for (let tries = 0; tries < 80; tries++) {
      const x = 30 + Math.random() * (WorldMap.WORLD_W - 60);
      const y0 = Math.max(WorldMap.MAP_TOP + 14, ship.y - WorldMap.VIEW_H * 0.75);
      const y1 = Math.min(WorldMap.MAP_BOTTOM - 14, ship.y + WorldMap.VIEW_H * 0.75);
      const y = y0 + Math.random() * Math.max(0, y1 - y0);
      if (!Voyage.isNavigable(x, y)) continue;
      if (Math.hypot(x - ship.x, y - ship.y) < 130) continue;
      if (ports.some(function (p) { return Math.hypot(x - p.x, y - p.y) < 48; })) continue;
      if (monsters.some(function (m) { return Math.hypot(x - m.x, y - m.y) < 70; })) continue;
      return { x: x, y: y };
    }
    return null;
  }

  function spawn(ship, exp, kind) {
    const at = findSpawn(ship);
    if (!at) return null;
    const k = kind || pickKind(exp);
    const m = {
      kind: k, def: KINDS[k], x: at.x, y: at.y,
      heading: Math.random() * Math.PI * 2,
      life: KINDS[k].rare ? RARE_LIFETIME : LIFETIME,
      appear: 0
    };
    monsters.push(m);
    return m;
  }

  function angleDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  /** 海上魔王一直待在固定位置：不在清單上就補回來（打完、clear() 之後） */
  function ensureBosses() {
    if (typeof EuropeWorld === 'undefined') return;
    SEA_BOSSES.forEach(function (b) {
      if (monsters.some(function (m) { return m.boss && m.kind === b.kind; })) return;
      const p = EuropeWorld.project(b.lon, b.lat);
      let at = null;
      for (let r = 0; r <= 60 && !at; r += 4) {
        for (let k = 0; k < 16 && !at; k++) {
          const a = k * Math.PI / 8;
          const x = p[0] + Math.cos(a) * r, y = p[1] + Math.sin(a) * r;
          if (Voyage.isNavigable(x, y)) at = { x: x, y: y };
          if (r === 0) break;
        }
      }
      if (!at) return;
      monsters.push({ kind: b.kind, def: KINDS[b.kind], x: at.x, y: at.y, heading: 0, life: Infinity, appear: 1, boss: true });
    });
    // v1.30 哥倫布委託的戰艦、撒哈拉的動物大遷徙（expedition.js）
    if (typeof Expedition !== 'undefined') Expedition.ensure(monsters);
  }

  function updateMap(ship, exp) {
    const events = [];
    ensureBosses();
    if (--spawnTimer <= 0) {
      spawnTimer = SPAWN_EVERY;
      if (monsters.filter(function (m) { return !m.boss; }).length < MAX_ON_MAP && Math.random() < SPAWN_CHANCE) {
        const hasRare = monsters.some(function (m) { return m.def.rare; });
        const rare = !hasRare && Math.random() < RARE_CHANCE;
        const m = spawn(ship, exp || 0, rare ? 'golden' : null);
        if (m && rare) events.push('rare');
      }
    }

    nearM = null;
    let best = TOUCH;
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      m.appear = Math.min(1, m.appear + 0.03);
      if (--m.life <= 0) { monsters.splice(i, 1); continue; }
      const d = Math.hypot(ship.x - m.x, ship.y - m.y);
      if (m.kind === 'charybdis') {
        if (vortexCalm > 0) { vortexCalm--; continue; }
        if (d < VORTEX_R && d > 0.5) {
          // 越靠近中心吸力越強，還會帶著船繞圈（切線方向）
          const k = (1 - d / VORTEX_R);
          const ux = (m.x - ship.x) / d, uy = (m.y - ship.y) / d;
          Voyage.nudge((ux * 0.5 - uy * 0.35) * k * 1.8, (uy * 0.5 + ux * 0.35) * k * 1.8);
          if (k > 0.2) events.push('vortexpull');
        }
        if (d < VORTEX_EYE) events.push('vortex');
        continue;
      }
      if (m.custom) {
        if (Expedition.mapNear(m, ship, d) && d < best + 10) { best = d; nearM = m; }
        continue;
      }
      if (m.boss) {
        // 魔王不動；身體大，靠近的判定也放寬一點
        if (d < TOUCH + 10 && d < best + 10) { best = d; nearM = m; }
        continue;
      }
      if (m.kind === 'pirates' && d < 140 && d > 4) {
        // 海盜船看到你會靠過來
        m.heading += U.clamp(angleDiff(Math.atan2(ship.y - m.y, ship.x - m.x), m.heading), -0.05, 0.05);
      } else if (m.kind === 'golden' && d < 110) {
        // 稀有怪：你靠近牠會想逃（但比船慢，追得到）
        m.heading += U.clamp(angleDiff(Math.atan2(m.y - ship.y, m.x - ship.x), m.heading), -0.08, 0.08);
      } else {
        m.heading += (Math.random() - 0.5) * 0.12;
      }
      const sp = m.kind === 'golden' ? 1.3 : m.kind === 'pirates' ? 0.55 : 0.35;
      const nx = m.x + Math.cos(m.heading) * sp, ny = m.y + Math.sin(m.heading) * sp;
      if (Voyage.isNavigable(nx, ny)) { m.x = nx; m.y = ny; }
      else m.heading += Math.PI * (0.6 + Math.random() * 0.8);
      if (d < best) { best = d; nearM = m; }
    }
    return events;
  }

  function remove(m) {
    const i = monsters.indexOf(m);
    if (i >= 0) monsters.splice(i, 1);
    if (nearM === m) nearM = null;
  }

  // ── 地圖上的怪：繪製 ───────────────────────────────────

  function drawGulls(ctx, t) {
    for (let i = 0; i < 3; i++) {
      const a = t * 0.05 + i * 2.1;
      const x = Math.cos(a) * 8, y = Math.sin(a) * 4 - 6;
      const flap = Math.sin(t * 0.3 + i) * 2;
      ctx.strokeStyle = '#f4f6fa'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - 5, y - flap); ctx.quadraticCurveTo(x - 2, y - 3, x, y);
      ctx.quadraticCurveTo(x + 2, y - 3, x + 5, y - flap); ctx.stroke();
    }
  }

  function drawPirate(ctx, t, heading) {
    ctx.save();
    ctx.scale(Math.cos(heading) < 0 ? -1 : 1, 1);
    ctx.rotate(Math.sin(t * 0.08) * 0.08);
    ctx.fillStyle = '#3a2418';
    ctx.beginPath(); ctx.moveTo(-11, -1); ctx.lineTo(12, -1); ctx.lineTo(8, 5); ctx.lineTo(-8, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d8d0bc'; ctx.fillRect(-0.8, -15, 1.6, 14);
    ctx.fillStyle = '#16161c';
    ctx.beginPath(); ctx.moveTo(1, -14); ctx.lineTo(10, -9); ctx.lineTo(1, -4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4f0e6'; ctx.beginPath(); ctx.arc(4.5, -9, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e0526b'; ctx.fillRect(-0.8, -18, 5, 3);
    ctx.restore();
  }

  /** 地圖上的調皮海獺：仰躺在水面上、抱著貝殼、尾巴拍水（v1.26.1 取代原本的海蛇） */
  function drawSerpent(ctx, t) {
    const bob = Math.sin(t * 0.08) * 1.2;
    ctx.save();
    ctx.translate(0, bob);
    ctx.fillStyle = '#8a5a3a';
    ctx.beginPath(); ctx.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2); ctx.fill();          // 身體（仰躺）
    ctx.beginPath(); ctx.ellipse(-12, 1 + Math.sin(t * 0.2) * 1, 5, 2.4, 0.3, 0, Math.PI * 2); ctx.fill();   // 尾巴
    ctx.fillStyle = '#d8b48a';
    ctx.beginPath(); ctx.ellipse(1, -1, 7, 3, 0, 0, Math.PI * 2); ctx.fill();          // 肚子
    ctx.fillStyle = '#8a5a3a';
    ctx.beginPath(); ctx.arc(11, -3, 5, 0, Math.PI * 2); ctx.fill();                   // 頭
    ctx.fillStyle = '#e8d2b0';
    ctx.beginPath(); ctx.ellipse(13, -2, 3, 2.2, 0, 0, Math.PI * 2); ctx.fill();       // 白鼻口
    ctx.fillStyle = '#1a1424';
    ctx.fillRect(10, -5.5, 1.4, 1.4); ctx.fillRect(13.2, -5.5, 1.4, 1.4);
    ctx.beginPath(); ctx.arc(14.6, -2.6, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0c8d8';                                                          // 抱著的貝殼
    ctx.beginPath(); ctx.arc(2, -4, 2.6, Math.PI, 0); ctx.fill();
    ctx.restore();
  }

  /** 黃金海馬：金色身體 + 彩虹光環 + 繞圈的星芒 —— 一看就知道是稀有的 */
  function drawSeahorse(ctx, t, s) {
    ctx.save();
    ctx.scale(s, s);
    const bob = Math.sin(t * 0.12) * 2;
    ctx.translate(0, bob);
    const g = ctx.createLinearGradient(-6, -14, 6, 12);
    g.addColorStop(0, '#fff4b0'); g.addColorStop(0.5, '#f2c14e'); g.addColorStop(1, '#c8862a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.quadraticCurveTo(8, -12, 6, -6); ctx.lineTo(12, -6); ctx.lineTo(6, -3);
    ctx.quadraticCurveTo(8, 4, 2, 8); ctx.quadraticCurveTo(-2, 12, 2, 14); ctx.quadraticCurveTo(-6, 14, -4, 8);
    ctx.quadraticCurveTo(-8, 0, -3, -6); ctx.quadraticCurveTo(-4, -12, 0, -14);
    ctx.fill();
    ctx.fillStyle = '#7a4a10'; ctx.fillRect(2, -10, 2, 2);
    ctx.fillStyle = '#ffe9a0';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-4, -8 + i * 5); ctx.lineTo(-9, -6 + i * 5); ctx.lineTo(-4, -5 + i * 5); ctx.fill(); }
    ctx.restore();
  }

  /** 地圖上的斯庫拉：海面上冒出六條長脖子，輪流擺動 */
  function drawScyllaMap(ctx, t) {
    ctx.fillStyle = 'rgba(20, 40, 60, 0.45)';
    ctx.beginPath(); ctx.ellipse(0, 6, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 6; i++) {
      const bx = -15 + i * 6;
      const sw = Math.sin(t * 0.07 + i * 1.1) * 5;
      const hx = bx + sw, hy = -14 - (i % 2) * 6 + Math.cos(t * 0.06 + i) * 2;
      ctx.strokeStyle = '#5a3f7a'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx, 5); ctx.quadraticCurveTo(bx - sw, -4, hx, hy); ctx.stroke();
      ctx.fillStyle = '#7a56a0';
      ctx.beginPath(); ctx.ellipse(hx + 1.5, hy, 3.6, 2.6, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe070'; ctx.fillRect(hx + 2, hy - 1.4, 1.3, 1.3);
    }
    ctx.lineCap = 'butt';
  }

  function sparkle(ctx, x, y, r, a) {
    ctx.fillStyle = 'rgba(255, 250, 210, ' + a.toFixed(2) + ')';
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.3, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.3, y);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - r, y); ctx.lineTo(x, y + r * 0.3); ctx.lineTo(x + r, y); ctx.lineTo(x, y - r * 0.3);
    ctx.closePath(); ctx.fill();
  }

  function drawMap(ctx, t) {
    monsters.forEach(function (m) {
      const fade = Math.min(1, m.life / 60) * m.appear;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(m.x, m.y);
      const near = m === nearM;

      if (m.custom) {
        Expedition.drawMapMonster(ctx, m, t, near);
        ctx.restore();
        return;
      }
      if (m.def.rare) {
        // 彩虹光環 + 金色光暈 + 繞圈星芒
        const glow = ctx.createRadialGradient(0, -4, 2, 0, -4, 30);
        glow.addColorStop(0, 'rgba(255, 230, 140, 0.7)');
        glow.addColorStop(1, 'rgba(255, 230, 140, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(0, -4, 30, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2.2;
        for (let k = 0; k < 6; k++) {
          ctx.strokeStyle = 'hsla(' + ((k * 60 + t * 4) % 360) + ', 90%, 65%, 0.8)';
          ctx.beginPath(); ctx.arc(0, -4, 17 + Math.sin(t * 0.1) * 1.5, k * Math.PI / 3, (k + 1) * Math.PI / 3); ctx.stroke();
        }
        for (let k = 0; k < 4; k++) {
          const a = t * 0.06 + k * Math.PI / 2;
          sparkle(ctx, Math.cos(a) * 22, -4 + Math.sin(a) * 22, 4 + Math.sin(t * 0.3 + k) * 1.5, 0.9);
        }
        drawSeahorse(ctx, t, 1);
        ctx.fillStyle = 'rgba(80, 50, 0, 0.9)';
        U.roundRect(ctx, -18, -40, 36, 13, 4); ctx.fill();
        U.text(ctx, '★稀有', 0, -33.5, { size: 9, color: '#ffe070', stroke: false });
        ctx.restore();
        return;
      }

      if (m.kind === 'charybdis') {
        // 大漩渦：一圈圈往中心轉的螺旋水紋＋中間深色的漩渦眼
        ctx.lineWidth = 1.6;
        for (let k = 0; k < 4; k++) {
          ctx.strokeStyle = 'rgba(190, 230, 255, ' + (0.55 - k * 0.1).toFixed(2) + ')';
          ctx.beginPath();
          for (let a = 0; a < Math.PI * 3.2; a += 0.2) {
            const r = 4 + a * 5.5;
            const ang = a + t * 0.05 + k * Math.PI / 2;
            const x = Math.cos(ang) * r, y = Math.sin(ang) * r * 0.55;
            if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(8, 20, 40, 0.85)';
        ctx.beginPath(); ctx.ellipse(0, 0, 6, 3.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(10, 40, 70, 0.9)';
        U.roundRect(ctx, -40, -34, 80, 14, 4); ctx.fill();
        U.text(ctx, '卡律布狄斯', 0, -27, { size: 10, color: '#bfe8ff', stroke: false });
        ctx.restore();
        return;
      }
      if (m.kind === 'atlantis') {
        // 亞特蘭提斯：海面上一圈青色光、冒泡，水下隱約露出神殿的三角山牆和柱子
        const been = typeof Save !== 'undefined' && Save.seaBossDown(m.kind);
        const pulse = 22 + Math.sin(t * 0.08) * 2;
        ctx.strokeStyle = near ? 'rgba(120, 240, 230, 1)' : 'rgba(120, 240, 230, 0.55)';
        ctx.lineWidth = near ? 2.6 : 1.6;
        ctx.beginPath(); ctx.arc(0, 0, pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(40, 140, 170, 0.35)';
        ctx.beginPath(); ctx.ellipse(0, 2, 18, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(230, 220, 180, 0.75)';
        ctx.beginPath(); ctx.moveTo(-13, -4); ctx.lineTo(0, -12); ctx.lineTo(13, -4); ctx.closePath(); ctx.fill();
        for (let k = 0; k < 4; k++) ctx.fillRect(-11 + k * 7, -3, 3, 9);
        ctx.strokeStyle = 'rgba(220, 245, 255, 0.8)'; ctx.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          const ph = (t * 0.6 + k * 9) % 26;
          ctx.beginPath(); ctx.arc(-8 + k * 8, -6 - ph, 1.6 + k * 0.4, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(10, 60, 80, 0.9)';
        // v1.25.2 玩家：用本名顯示（原本寫「海底遺跡」）
        U.roundRect(ctx, -30, -44, 60, 14, 4); ctx.fill();
        U.text(ctx, '亞特蘭提斯', 0, -37, { size: 10, color: been ? '#7fb8b0' : '#a8f0e8', stroke: false });
        ctx.restore();
        return;
      }

      if (m.boss) {
        // 魔王：紅色雙圈 + 漩渦 + 「魔王」牌子（打倒過的牌子變灰、寫「再戰」）
        const beaten = typeof Save !== 'undefined' && Save.seaBossDown(m.kind);
        ctx.strokeStyle = 'rgba(160, 210, 240, 0.4)'; ctx.lineWidth = 1.2;
        for (let k = 0; k < 3; k++) {
          const a0 = t * 0.03 + k * 2.1;
          ctx.beginPath(); ctx.arc(0, 4, 10 + k * 5, a0, a0 + 2.2); ctx.stroke();
        }
        const pulse = 24 + Math.sin(t * 0.1) * 2;
        ctx.strokeStyle = near ? 'rgba(255, 90, 100, 1)' : 'rgba(255, 90, 100, 0.6)';
        ctx.lineWidth = near ? 2.6 : 1.8;
        ctx.beginPath(); ctx.arc(0, -2, pulse, 0, Math.PI * 2); ctx.stroke();
        drawScyllaMap(ctx, t);
        ctx.fillStyle = beaten ? 'rgba(50, 40, 60, 0.9)' : 'rgba(120, 10, 24, 0.92)';
        // v1.25.2 玩家：魔王用本名顯示（原本只寫「魔王」）；打倒過的牌子變灰
        U.roundRect(ctx, -32, -46, 64, 14, 4); ctx.fill();
        U.text(ctx, m.def.name, 0, -39, { size: 10, color: beaten ? '#c8b8e0' : '#ffd0d6', stroke: false });
        ctx.restore();
        return;
      }

      const pulse = 13 + Math.sin(t * 0.1) * 2;
      ctx.strokeStyle = near ? 'rgba(255, 120, 130, 0.95)' : 'rgba(255, 120, 130, 0.45)';
      ctx.lineWidth = near ? 2 : 1.4;
      ctx.beginPath(); ctx.arc(0, 0, pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(220, 238, 255, 0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 5, 12, 3, 0, 0, Math.PI * 2); ctx.stroke();
      if (m.kind === 'gulls') drawGulls(ctx, t);
      else if (m.kind === 'pirates') drawPirate(ctx, t, m.heading);
      else drawSerpent(ctx, t);
      ctx.fillStyle = 'rgba(40, 10, 18, 0.85)';
      U.roundRect(ctx, -11, -31, 22, 12, 4); ctx.fill();
      U.text(ctx, 'Lv' + m.def.lv, 0, -25, { size: 9, color: '#ffb3bd', stroke: false });
      ctx.restore();
    });
  }

  // ── 小遊戲：關卡定義 ───────────────────────────────────

  const ARENA_W = 960;
  const DUR = { gulls: 25 * 60, pirates: 45 * 60, serpent: 32 * 60, golden: 20 * 60, scylla: 100 * 60, charybdis: 40 * 60 };
  // 漩渦逃生：場地中間是漩渦眼（掉下去會痛、被甩回岸邊）
  const EYE = { x: 400, w: 160 };
  /*
   * 斯庫拉（魔王）：六顆頭在甲板後方的海面上擺動，輪流——
   *   aim      瞄準：頭移到玩家頭頂高處，甲板上出現紅圈（AIM 帧）
   *   bite     咬下：一口砸到甲板（BITE 帧），紅圈裡的人受傷
   *   stuck    卡住：牙齒卡進甲板拔不出來（STUCK 帧）← 這時跳上去踩，踩一次這顆頭就倒了
   *   retract  沒被踩就縮回去，等下一輪
   * 踩倒 3 顆之後她發怒：同時兩顆頭輪流咬，還會用尾巴掀起橫掃甲板的浪（跳過去）。
   */
  const SCY = { AIM: 58, BITE: 8, STUCK: 125, RETRACT: 22, HOME_Y: 150, AIM_Y: 170, WAVE_H: 34, WAVE_SPEED: 5.5 };
  const SCY_HOME = [150, 280, 410, 550, 680, 810];
  const HOLES = [140, 300, 460, 620, 780];
  const BASKET = { x: 455, w: 50, h: 26 };
  const CANNON = { x: 470, angMin: 20, angMax: 70, period: 110, speed: 10.5, grav: 0.25 };
  const SHIP = { x: 680, w: 210, h: 54 };
  const DECK_W = 560;     // 艦砲對決：玩家的甲板寬度（右邊是海）

  /**
   * 亞特蘭提斯的潛水關（第一次叫的時候才產生，之後重用同一份）。
   * v1.24.2 玩家：改成垂直往下、類似倫敦那種，但要是潛水；終點是神殿，可以獲得海神夥伴。
   *   → 用豎井關的產生器（Levels.makeShaft，descend），標 underwater：
   *     entities.js 換潛水物理（划水、慢慢下沉），上面追下來的是崩落的珊瑚礁（尖刺天花板換皮），
   *     每隔幾層有氣泡噴口補空氣（features 'vent'），最底層是海神的神殿。
   */
  const DIVE_VENT_EVERY = 4;     // 每幾層放一個氣泡噴口
  let diveBase = null;
  function diveDef(m) {
    if (!diveBase) {
      diveBase = Levels.makeShaft({
        seed: 1051,
        id: 'ATL', country: '亞特蘭提斯', city: '沉沒的神殿', region: 'sea',
        flag: ['#1a5a8a', '#e8d8a0', '#1a5a8a'], flagDir: 'h',
        landmark: 'atlantis',
        fact: '柏拉圖寫道：海克力斯之柱外有一座強大的島國亞特蘭提斯，在一天一夜之間沉入了海底。',
        sky: ['#1c5a8c', '#06203c'], hill: '#1c4c6c',
        groundTop: '#d0c090', groundBody: '#5a6a6c',
        theme: 'atlantis',
        floors: 24,
        gapY: 112,
        platW: 120,
        shaftW: 600,
        /*
         * v1.25.1 玩家：礁石崩落的速度途中會加快 ——
         *   越往下越快（0.7 → 1.45），而且每 11 秒一次海底地震：之後 2.5 秒崩落速度 ×1.6
         */
        scroll: [0.7, 1.45],
        chime: { every: 660, dur: 150, boost: 1.6, label: '轟隆——', sub: '海底地震！礁石崩得更快了', sound: 'rumble' },
        extras: ['slide']
      });
      diveBase.underwater = true;
      diveBase.dive = true;
      // 氣泡噴口：放在第 3、7、11⋯ 層的中央
      diveBase.features = diveBase.shaftFloors
        .filter(function (f, i) { return i >= 3 && i % DIVE_VENT_EVERY === 3 && !f.goal && f.w >= 80; })
        .map(function (f) { return { type: 'vent', x: Math.round(f.x + f.w / 2 - 20), y: f.y, w: 40 }; });
    }
    const k = m.def;
    const first = !(typeof Save !== 'undefined' && Save.seaBossDown(m.kind));
    const def = Object.assign({}, diveBase, {
      monster: m,
      exp: first ? k.bossExp : k.exp,
      bossCoins: first ? k.bossCoins : 0,
      firstBoss: first,
      fact: diveBase.fact + (first ? '　第一次潛到神殿：' + k.bossExp + ' EXP＋' + k.bossCoins + ' 金幣' : '　再潛一次：' + k.exp + ' EXP')
    });
    return def;
  }

  let wreckBase = null;
  function wreckDef(m) {
    if (!wreckBase) {
      wreckBase = Levels.make({
        seed: 1060,
        id: 'WRK', country: '安提基特拉沉船', city: '愛琴海海底', region: 'sea',
        flag: ['#1a5a8a', '#e8d8a0', '#1a5a8a'], flagDir: 'h',
        landmark: 'wreckhull',
        fact: '1900 年，採海綿的潛水夫在安提基特拉島外海 45 公尺深的地方，發現了一艘兩千年前的羅馬沉船。',
        sky: ['#0c4a78', '#2a90c0'], hill: '#1c4c6c', cloud: 'rgba(190, 235, 255, 0.08)',
        groundTop: '#d8c898', groundBody: '#5a6a6c',
        deco: 'kelp',
        layout: 'hills',
        width: 12000,          // v1.25.3 玩家嫌西班牙那段潛水太短：直直游約 1 分鐘，邊找寶物邊閃大概 2 分鐘
        groundTypes: ['walker', 'walker', 'spiker'],
        airTypes: ['flyer', 'chaser'],
        density: 0.85,
        features: [{ type: 'air' }, { type: 'currents' }, { type: 'clams', count: 9 }, { type: 'relics' }],
        secretHint: '船身破洞後面，有一道金光',
        secretNear: 0.5,
        props: []
      });
      wreckBase.underwater = true;
      wreckBase.dive = true;
    }
    const k = m.def;
    const first = !(typeof Save !== 'undefined' && Save.seaBossDown(m.kind));
    return Object.assign({}, wreckBase, {
      monster: m,
      exp: first ? k.bossExp : k.exp,
      bossCoins: first ? k.bossCoins : 0,
      firstBoss: first,
      fact: wreckBase.fact + (first ? '　第一次撈到機械：' + k.bossExp + ' EXP＋' + k.bossCoins + ' 金幣' : '　再潛一次：' + k.exp + ' EXP')
    });
  }

  function makeDef(m, stats) {
    if (m.kind === 'wreck') return wreckDef(m);
    if (m.def.duo) return Duo.makeDef(m);
    if (m.def.custom) return Expedition.makeDef(m);
    if (m.def.dive) return diveDef(m);
    const k = m.def;
    const GY = Levels.GROUND_Y;
    const kind = m.kind;
    const deckW = kind === 'pirates' ? DECK_W : ARENA_W;
    const def = {
      id: 'SEA',
      country: '海上遭遇戰',
      city: k.name + ' · ' + k.game,
      flag: ['#1d3a5c', '#e8e2d2', '#1d3a5c'],
      flagDir: 'h',
      landmark: null,
      fact: (function () {
        if (k.boss) {
          const first = !(typeof Save !== 'undefined' && Save.seaBossDown(kind));
          return first
            ? '傳說奧德修斯的船經過墨西拿海峽，被斯庫拉一口叼走六個水手。第一次打倒她可得 ' + k.bossExp + ' EXP 和 ' + k.bossCoins + ' 金幣！'
            : '再戰斯庫拉：打贏可得 ' + k.exp + ' EXP。';
        }
        const nx = nextRegion(typeof Save !== 'undefined' ? Save.get().exp : 0);
        return '打贏可得 ' + k.exp + ' EXP' + (nx ? '，累積 ' + nx.exp + ' EXP 解鎖' + nx.name + '。' : '。');
      })(),
      sky: kind === 'golden' ? ['#6a8ad8', '#f8e0a8'] : kind === 'scylla' ? ['#3a4a78', '#c89a8a'] : ['#5fa8d8', '#f6dcae'],
      hill: kind === 'scylla' ? '#24456a' : '#2f6f9a',
      // 船的甲板：木板色
      groundTop: '#b88a58', groundBody: '#6a4a30',
      deco: null,
      width: ARENA_W, height: 480,
      layout: 'boss',
      skirmish: true,
      minigame: kind,
      // 守護午餐不能出生在籃子旁邊（見 updateSkirmish 的說明）
      spawnX: kind === 'pirates' ? 380 : kind === 'gulls' ? 260 : kind === 'charybdis' ? 120 : ARENA_W / 2 - 11,
      isBoss: false,
      bossArena: { x: 0, y: 0, w: deckW, h: 480 },
      ground: kind === 'charybdis'
        ? [{ x: 0, y: GY, w: EYE.x, h: Levels.GROUND_H }, { x: EYE.x + EYE.w, y: GY, w: ARENA_W - EYE.x - EYE.w, h: Levels.GROUND_H }]
        : [{ x: 0, y: GY, w: deckW, h: Levels.GROUND_H }],
      water: [], spikes: [], props: [],
      platforms: kind === 'gulls'
        ? [{ x: 150, y: 290, w: 130, h: 18 }, { x: 680, y: 290, w: 130, h: 18 }]
        : kind === 'golden'
          ? [{ x: 120, y: 300, w: 150, h: 18 }, { x: 405, y: 230, w: 150, h: 18 }, { x: 690, y: 300, w: 150, h: 18 }]
          : [],
      movers: [], secrets: [], enemies: [], coins: [],
      goal: Infinity,
      monster: m,
      exp: k.exp,
      duration: DUR[kind]
    };
    if (k.boss && !(typeof Save !== 'undefined' && Save.seaBossDown(kind))) {
      def.exp = k.bossExp;
      def.bossCoins = k.bossCoins;
      def.firstBoss = true;
    }
    return def;
  }

  // ── 小遊戲：執行期 ─────────────────────────────────────

  function initMini(state) {
    const kind = state.def.minigame;
    const mini = { kind: kind, time: state.def.duration, elapsed: 0, score: 0, done: false };
    if (kind === 'gulls') { mini.bread = 5; mini.gulls = []; mini.next = 60; mini.seq = 0; }
    if (kind === 'pirates') {
      mini.hits = 0; mini.balls = []; mini.shells = []; mini.cd = 0; mini.enemyCd = 120; mini.seq = 0; mini.shipShake = 0;
      // 造船廠的船首砲（v1.26）：裝填更快；滿級開場先命中一砲
      const ship = typeof Save !== 'undefined' && Save.ship ? Save.ship() : null;
      mini.cdMax = typeof Shipyard !== 'undefined' ? Shipyard.cannonCd(ship) : 70;
      if (typeof Shipyard !== 'undefined' && Shipyard.cannonHead(ship)) { mini.hits = 1; mini.shipShake = 20; }
    }
    if (kind === 'serpent') { mini.hits = 0; mini.heads = HOLES.map(function (x) { return { x: x, up: 0, t: 0, spat: false }; }); mini.next = 40; mini.seq = 0; }
    if (kind === 'golden') { mini.caught = 0; mini.px = 700; mini.py = 200; mini.cool = 0; mini.phase = 0; mini.speed = 0.022; }
    if (kind === 'charybdis') {
      mini.got = 0; mini.buoy = null; mini.next = 40; mini.seq = 0; mini.junk = []; mini.junkCd = 120;
    }
    if (typeof Expedition !== 'undefined' && Expedition.has(kind)) Expedition.initMini(state, mini);
    if (kind === 'scylla') {
      mini.hits = 0; mini.next = 90; mini.seq = 0; mini.waves = []; mini.waveCd = 200; mini.waveSeq = 0;
      mini.heads = SCY_HOME.map(function (x, i) {
        return { i: i, home: x, x: x, y: SCY.HOME_Y, alive: true, hp: 2, flash: 0, state: 'idle', t: 0, tx: x };
      });
    }
    return mini;
  }

  /** 角砲目前的仰角（度）：在 angMin~angMax 之間來回擺 */
  function cannonAngle(elapsed) {
    const k = (Math.sin(elapsed * Math.PI * 2 / CANNON.period) + 1) / 2;
    return CANNON.angMin + (CANNON.angMax - CANNON.angMin) * k;
  }

  /**
   * 海盜船的位置：會前後漂移，所以「打得中的角度」一直在變，
   * 不是記住一個時機就能連打（完美時機的機器人原本 3 秒就打完）。
   */
  function shipX(elapsed) { return SHIP.x + Math.sin(elapsed * 0.011) * 60; }

  /** 以某個仰角開砲會不會打中海盜船（測試與瞄準綠燈都用它；sx = 船現在的 x） */
  function shotHits(angleDeg, sx) {
    const a = angleDeg * Math.PI / 180;
    const x0 = sx == null ? SHIP.x : sx;
    let x = CANNON.x + 30, y = Levels.GROUND_Y - 44;
    let vx = Math.cos(a) * CANNON.speed, vy = -Math.sin(a) * CANNON.speed;
    for (let i = 0; i < 400; i++) {
      x += vx; y += vy; vy += CANNON.grav;
      if (x > x0 && x < x0 + SHIP.w && y > Levels.GROUND_Y - SHIP.h && y < Levels.GROUND_Y + 10) return true;
      if (y > Levels.GROUND_Y + 20 || x > ARENA_W + 40) return false;
    }
    return false;
  }

  function hurt(p, fromX, events) {
    if (p.invuln > 0) return;
    p.invuln = 90 + (p.stats.invulnBonus || 0);
    p.vy = -6;
    p.vx = (fromX > p.x ? -1 : 1) * 4;
    events.push('p' + (p.pid || 0) + ':hurt');
  }

  function burst(state, x, y, color, n) {
    for (let i = 0; i < (n || 10); i++) {
      state.particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4, life: 24, color: color });
    }
  }

  /**
   * 小遊戲每帧。input 只有艦砲對決會用（開砲鍵）。
   * 回傳事件：'clear'（贏）、'minifail'（輸）、'shoo'、'steal'、'boom'、'hit'、'catch'
   */
  function updateSkirmish(state, input) {
    const events = [];
    const def = state.def;
    if (!def.skirmish || state.cleared) return events;
    const mini = state.mini || (state.mini = initMini(state));
    if (mini.done) return events;
    const players = state.players.filter(function (q) { return !q.out; });
    const p = state.player;
    const GY = Levels.GROUND_Y;
    mini.elapsed++;
    mini.time--;

    function win() { mini.done = true; state.cleared = true; events.push('clear'); }
    function fail() { mini.done = true; events.push('minifail'); }

    if (mini.kind === 'gulls') {
      /*
       * v1.8.1 改簡單：海鷗分三段 ——
       *   approach  從畫面外飛到籃子斜上方的「盤旋點」
       *   hover     在那裡盤旋 45 帧（會抖動、頭上有驚嘆號）← 主要的攔截時機，一跳就碰得到
       *   dive      俯衝搶麵包
       * 原本是從高空直接斜線俯衝，玩家跳起來時牠已經貼到籃子，幾乎攔不到
       * （玩家回報：「我跳起來要踩海鷗，對方就搶走麵包了」）。
       */
      if (--mini.next <= 0) {
        mini.next = Math.max(40, 70 - Math.floor(mini.elapsed / 60));
        const left = mini.seq++ % 2 === 0;
        const off = (left ? -1 : 1) * (60 + (mini.seq % 3) * 25);
        mini.gulls.push({
          x: left ? -20 : ARENA_W + 20, y: 90 + (mini.seq * 37) % 60,
          mode: 'approach', dir: left ? 1 : -1, w: 36, h: 24,
          hx: BASKET.x + BASKET.w / 2 + off, hy: GY - 150, wait: 45
        });
      }
      const bx = BASKET.x + BASKET.w / 2, by = GY - BASKET.h / 2;
      const sp = 1.9 + mini.elapsed / 2400;
      // 嚇跑判定比身體大一圈：擦到就算。
      // 但要「跳起來」才算 —— 不然站在籃子旁邊當門神，海鷗俯衝一定擦到身體，站著不動就贏了
      const reach = players.filter(function (q) { return !q.onGround; })
        .map(function (q) { return { x: q.x - 10, y: q.y - 10, w: q.w + 20, h: q.h + 20 }; });
      function steer(g, tx, ty, speed) {
        const dx = tx - (g.x + g.w / 2), dy = ty - (g.y + g.h / 2);
        const d = Math.max(1, Math.hypot(dx, dy));
        g.x += dx / d * Math.min(speed, d); g.y += dy / d * Math.min(speed, d);
        if (Math.abs(dx) > 1) g.dir = dx > 0 ? 1 : -1;
        return d;
      }
      mini.gulls.forEach(function (g) {
        if (g.mode === 'flee') { g.y -= 4; g.x += g.dir * 2; return; }
        if (g.mode === 'approach') {
          if (steer(g, g.hx, g.hy, sp + 0.6) < 3) g.mode = 'hover';
        } else if (g.mode === 'hover') {
          g.y = g.hy - g.h / 2 + Math.sin(mini.elapsed * 0.3) * 2;
          g.dir = bx > g.x + g.w / 2 ? 1 : -1;
          if (--g.wait <= 0) g.mode = 'dive';
        } else if (g.mode === 'dive') {
          steer(g, bx, by, sp + 0.7);
        }
        if (reach.some(function (q) { return U.overlap(q, g); })) {
          g.mode = 'flee'; mini.score++; events.push('shoo');
          burst(state, g.x + g.w / 2, g.y + g.h / 2, '#f4f6fa', 6);
        } else if (g.mode === 'dive' && U.overlap(g, { x: BASKET.x, y: GY - BASKET.h, w: BASKET.w, h: BASKET.h })) {
          g.mode = 'flee'; g.loot = true; mini.bread--; events.push('steal');
          if (mini.bread <= 0) fail();
        }
      });
      mini.gulls = mini.gulls.filter(function (g) { return g.y > -60; });
      if (!mini.done && mini.time <= 0) win();

    } else if (mini.kind === 'pirates') {
      if (mini.cd > 0) mini.cd--;
      const atCannon = Math.abs(p.x + p.w / 2 - CANNON.x) < 50 && p.onGround;
      // 開砲用「丟」的鍵（v1.18 拿掉揮擊前是揮擊鍵）；鍵盤也可以按 Enter
      const fire = input && (input.once('throw') || input.once('confirm'));
      if (fire && atCannon && mini.cd === 0) {
        const a = cannonAngle(mini.elapsed) * Math.PI / 180;
        mini.balls.push({ x: CANNON.x + 30, y: GY - 44, vx: Math.cos(a) * CANNON.speed, vy: -Math.sin(a) * CANNON.speed });
        mini.cd = mini.cdMax || 70;      // 裝填要一點時間：每一發都要重新抓角度（船首砲升級會變快）
        events.push('fire');
      }
      mini.balls.forEach(function (b) {
        b.x += b.vx; b.y += b.vy; b.vy += CANNON.grav;
        const sx0 = shipX(mini.elapsed);
        if (b.x > sx0 && b.x < sx0 + SHIP.w && b.y > GY - SHIP.h && b.y < GY + 10) {
          b.dead = true; mini.hits++; mini.shipShake = 20; events.push('hit');
          burst(state, b.x, b.y, '#ffb050', 14);
          if (mini.hits >= 5) win();
        } else if (b.y > GY + 30) {
          b.dead = true; burst(state, b.x, GY + 10, '#bfe3ff', 8);     // 落海
        }
      });
      mini.balls = mini.balls.filter(function (b) { return !b.dead; });
      if (mini.shipShake > 0) mini.shipShake--;
      // 海盜還擊：砲彈落點在玩家附近，地上先出現紅圈
      if (--mini.enemyCd <= 0) {
        mini.enemyCd = Math.max(70, 120 - mini.hits * 12);
        const tx = U.clamp(p.x + p.w / 2 + [0, -70, 60, -30, 90][mini.seq++ % 5], 30, DECK_W - 30);
        mini.shells.push({ x: tx, fuse: 75 });
      }
      mini.shells.forEach(function (s) {
        if (--s.fuse === 0) {
          s.boom = 16;
          players.forEach(function (q) {
            if (Math.abs(q.x + q.w / 2 - s.x) < 34 && q.y + q.h > GY - 70) hurt(q, s.x, events);
          });
          events.push('boom');
        }
        if (s.fuse < 0) s.boom--;
      });
      mini.shells = mini.shells.filter(function (s) { return s.fuse > 0 || s.boom > 0; });
      if (!mini.done && mini.time <= 0) fail();

    } else if (mini.kind === 'serpent') {
      if (--mini.next <= 0) {
        mini.next = Math.max(34, 58 - mini.hits * 3);
        // 依序挑一個還沒冒出來的洞（跳著挑，不會總是相鄰的洞）
        for (let k = 0; k < 5; k++) {
          const h = mini.heads[(mini.seq * 3 + k) % 5];
          if (h.up === 0) { h.up = 1; h.t = 0; h.spat = false; break; }
        }
        mini.seq++;
      }
      mini.heads.forEach(function (h) {
        if (!h.up) return;
        h.t++;
        if (h.t > 95) { h.up = 0; return; }
        const rise = Math.min(1, h.t / 14) * (h.t > 80 ? (95 - h.t) / 15 : 1);
        h.box = { x: h.x - 18, y: GY - 52 * rise, w: 36, h: 52 * rise };
        // 冒出來一陣子會往玩家吐一口
        // 只有一半的洞會吐（洞的編號是偶數），速度也放慢 —— 全部都吐的話密到閃不掉
        // ⚠️ 玩家就在這顆頭上方／旁邊（要踩它）時不吐：口水會從正下方噴上來，躲都沒得躲
        const nearHead = Math.abs(p.x + p.w / 2 - h.x) < 110;
        if (h.t === 40 && !h.spat && !nearHead && HOLES.indexOf(h.x) % 2 === 0) {
          h.spat = true;
          const sx = h.x, sy = GY - 44;
          const dx = (p.x + p.w / 2) - sx, dy = (p.y + p.h / 2) - sy;
          const d = Math.max(1, Math.hypot(dx, dy));
          const sq = makeShot(sx - 6, sy, dx / d * 2.3, dy / d * 2.3);
          sq.splash = true;          // 海獺噴的是一團水（Sprites.shot 畫成水滴）
          state.shots.push(sq);
          events.push('shoot');
        }
        // 踩頭：從上方落下碰到頭頂
        players.forEach(function (q) {
          if (!h.up || !h.box || h.box.h < 20) return;
          const stomp = q.vy > 0 && U.overlap(q, h.box) && (q.y + q.h) - h.box.y < 20;
          if (stomp) {
            q.vy = PHYS.STOMP_BOUNCE;
            h.up = 0; mini.hits++; events.push('hit');
            burst(state, h.x, GY - 30, '#7fd0a0', 12);
            if (mini.hits >= 6) win();
          }
        });
      });
      if (!mini.done && mini.time <= 0) fail();

    } else if (mini.kind === 'golden') {
      // 沿著一條會變形的曲線亂竄，每被抓一次就更快
      mini.phase += mini.speed;
      const a = mini.phase;
      mini.px = 480 + Math.sin(a * 1.3) * 390 + Math.sin(a * 3.1) * 40;
      mini.py = 230 + Math.sin(a * 2.2) * 120;
      if (mini.cool > 0) mini.cool--;
      const box = { x: mini.px - 16, y: mini.py - 18, w: 32, h: 36 };
      if (mini.cool === 0 && players.some(function (q) { return U.overlap(q, box); })) {
        mini.caught++; mini.cool = 40; mini.speed += 0.006;
        mini.phase += Math.PI * 0.8;      // 被碰到就嚇得跳到別的地方
        events.push('catch');
        burst(state, mini.px, mini.py, '#ffe070', 16);
        if (mini.caught >= 3) win();
      }
      if (!mini.done && mini.time <= 0) fail();

    } else if (mini.kind === 'scylla') {
      const angry = mini.hits >= 3;
      const maxActive = angry ? 2 : 1;
      const active = mini.heads.filter(function (h) { return h.alive && h.state !== 'idle'; });
      // 輪到下一顆頭出手
      if (--mini.next <= 0 && active.length < maxActive) {
        const alive = mini.heads.filter(function (h) { return h.alive && h.state === 'idle'; });
        if (alive.length) {
          const h = alive[mini.seq % alive.length];
          // 第二顆頭（發怒後）瞄準玩家旁邊一點，留一條路給你閃
          const off = active.length ? [90, -90][mini.seq % 2] : [0, 30, -30][mini.seq % 3];
          h.tx = U.clamp(p.x + p.w / 2 + off, 60, ARENA_W - 60);
          h.state = 'aim'; h.t = 0;
        }
        mini.seq++;
        mini.next = angry ? 70 : 95;
      }
      mini.heads.forEach(function (h) {
        if (!h.alive) return;
        h.t++;
        if (h.flash > 0) h.flash--;
        if (h.state === 'idle') {
          h.x += (h.home - h.x) * 0.06;
          h.y = SCY.HOME_Y + Math.sin(mini.elapsed * 0.05 + h.i * 1.3) * 10;
        } else if (h.state === 'aim') {
          // 頭移到目標正上方，抬高蓄力
          h.x += (h.tx - h.x) * 0.12;
          h.y += (GY - SCY.AIM_Y - 60 - h.y) * 0.1;
          if (h.t >= SCY.AIM) { h.state = 'bite'; h.t = 0; h.x = h.tx; }
        } else if (h.state === 'bite') {
          const k = h.t / SCY.BITE;
          h.y = (GY - SCY.AIM_Y - 60) + ((GY - 26) - (GY - SCY.AIM_Y - 60)) * k;
          if (h.t >= SCY.BITE - 2) {
            players.forEach(function (q) {
              if (Math.abs(q.x + q.w / 2 - h.x) < 40 && q.y + q.h > GY - 110) hurt(q, h.x, events);
            });
          }
          if (h.t >= SCY.BITE) { h.state = 'stuck'; h.t = 0; h.y = GY - 26; events.push('boom'); burst(state, h.x, GY - 4, '#c9a070', 12); }
        } else if (h.state === 'stuck') {
          // 卡在甲板上掙扎：跳上去踩
          h.box = { x: h.x - 28, y: GY - 44, w: 56, h: 44 };
          players.forEach(function (q) {
            if (!h.alive || h.state !== 'stuck') return;
            const stomp = q.vy > 0 && U.overlap(q, h.box) && (q.y + q.h) - h.box.y < 24;
            if (stomp) {
              q.vy = PHYS.STOMP_BOUNCE;
              events.push('hit');
              burst(state, h.x, GY - 30, '#b48ae0', 18);
              // 每顆頭要踩兩下：第一下痛得縮回去，第二下才倒
              if (--h.hp > 0) { h.state = 'retract'; h.t = 0; h.flash = 30; return; }
              h.alive = false; h.state = 'down'; mini.hits++;
              if (mini.hits >= 6) win();
            }
          });
          if (h.alive && h.t >= SCY.STUCK) { h.state = 'retract'; h.t = 0; }
        } else if (h.state === 'retract') {
          h.y += (SCY.HOME_Y - h.y) * 0.15;
          h.x += (h.home - h.x) * 0.1;
          if (h.t >= SCY.RETRACT) { h.state = 'idle'; h.t = 0; }
        }
      });
      // 發怒後：尾巴掀浪，從甲板一端掃到另一端（先在起點冒水花預告）
      if (angry && !mini.done) {
        if (--mini.waveCd <= 0) {
          mini.waveCd = 300;
          const dir = mini.waveSeq++ % 2 === 0 ? -1 : 1;
          mini.waves.push({ dir: dir, x: dir < 0 ? ARENA_W + 10 : -10, warn: 75 });
          events.push('wave');
        }
        mini.waves.forEach(function (w) {
          if (w.warn > 0) { w.warn--; return; }
          w.x += w.dir * SCY.WAVE_SPEED;
          players.forEach(function (q) {
            if (q.y + q.h > GY - SCY.WAVE_H + 6 && Math.abs(q.x + q.w / 2 - w.x) < 22) hurt(q, w.x - w.dir * 30, events);
          });
        });
        mini.waves = mini.waves.filter(function (w) { return w.x > -60 && w.x < ARENA_W + 60; });
      }
      if (!mini.done && mini.time <= 0) fail();

    } else if (mini.kind === 'charybdis') {
      const cx = EYE.x + EYE.w / 2;
      // 漩渦往中間拖：地上推得比較用力（腳下的甲板在轉），空中比較輕
      players.forEach(function (q) {
        const qx = q.x + q.w / 2;
        const dir = qx < cx ? 1 : -1;
        q.x += dir * (q.onGround ? 1.15 : 0.6) * (1 + mini.got * 0.12);
        // 掉進漩渦眼：痛一下、被甩回兩側
        if (q.y > GY + 30) {
          hurt(q, cx, events);
          q.x = qx < cx ? 90 : ARENA_W - 110; q.y = GY - 200; q.vy = 0;
        }
      });
      // 救生圈：輪流出現在左右兩側的高處，碰到就算抓到一個
      if (!mini.buoy && --mini.next <= 0) {
        const left = mini.seq++ % 2 === 0;
        mini.buoy = { x: left ? 120 + (mini.seq % 3) * 60 : ARENA_W - 180 - (mini.seq % 3) * 60, y: GY - 130 - (mini.seq % 2) * 40, t: 0 };
      }
      if (mini.buoy) {
        const b = mini.buoy;
        b.t++;
        const box = { x: b.x - 18, y: b.y - 18, w: 36, h: 36 };
        if (players.some(function (q) { return U.overlap(q, box); })) {
          mini.got++; mini.buoy = null; mini.next = 75; events.push('catch');
          burst(state, b.x, b.y, '#ffffff', 12);
          if (mini.got >= 5) win();
        } else if (b.t > 360) { mini.buoy = null; mini.next = 20; }      // 太久沒抓就漂走，換一邊
      }
      // 漂流物：木桶從兩側被捲進來，沿著甲板滾向漩渦（跳過去）
      if (--mini.junkCd <= 0) {
        mini.junkCd = Math.max(70, 130 - mini.got * 15);
        const fromLeft = mini.seq % 2 === 0;
        mini.junk.push({ x: fromLeft ? -30 : ARENA_W + 10, dir: fromLeft ? 1 : -1, rot: 0 });
      }
      mini.junk.forEach(function (j) {
        j.x += j.dir * 3.2; j.rot += j.dir * 0.2;
        const box = { x: j.x, y: GY - 28, w: 28, h: 28 };
        players.forEach(function (q) { if (U.overlap(q, box)) hurt(q, j.x + 14, events); });
        if ((j.dir > 0 && j.x > EYE.x + 20) || (j.dir < 0 && j.x < EYE.x + EYE.w - 40)) j.gone = true;   // 被漩渦吞掉
      });
      mini.junk = mini.junk.filter(function (j) { return !j.gone; });
      if (!mini.done && mini.time <= 0) fail();
    } else if (Expedition.has(mini.kind)) {
      Expedition.update(state, input, mini, events, win, fail);
    }
    return events;
  }

  // ── 小遊戲：繪製 ───────────────────────────────────────

  function drawWorld(ctx, state, t) {
    const mini = state.mini;
    if (!mini) return;
    const GY = Levels.GROUND_Y;
    if (mini.kind === 'gulls') {
      // 麵包籃
      const bx = BASKET.x;
      ctx.fillStyle = '#a0703a';
      U.roundRect(ctx, bx, GY - BASKET.h, BASKET.w, BASKET.h, 6); ctx.fill();
      ctx.strokeStyle = '#6a4a20'; ctx.lineWidth = 1.5;
      for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(bx + i * 10, GY - BASKET.h); ctx.lineTo(bx + i * 10, GY); ctx.stroke(); }
      for (let i = 0; i < mini.bread; i++) {
        ctx.fillStyle = '#e8b45a';
        ctx.beginPath(); ctx.ellipse(bx + 12 + i * 13, GY - BASKET.h - 2, 8, 5, 0.3, 0, Math.PI * 2); ctx.fill();
      }
      mini.gulls.forEach(function (g) {
        const shake = g.mode === 'hover' ? Math.sin(t * 1.2) * 1.5 : 0;
        Sprites.enemy(ctx, { x: g.x + shake, y: g.y, w: g.w, h: g.h, dir: g.dir, squash: 0, type: 'flyer' }, t);
        // 盤旋中：頭上驚嘆號，提示「現在跳起來碰牠」
        if (g.mode === 'hover') U.text(ctx, '!', g.x + g.w / 2, g.y - 10, { size: 18, color: '#ff6b5a', strokeWidth: 4 });
        if (g.loot) {
          ctx.fillStyle = '#e8b45a';
          ctx.beginPath(); ctx.ellipse(g.x + g.w / 2, g.y + g.h + 2, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
        }
      });
    } else if (mini.kind === 'pirates') {
      // 海 + 海盜船
      ctx.fillStyle = '#2f6f9a';
      ctx.fillRect(DECK_W, GY - 6, ARENA_W - DECK_W, 86);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 6; i++) ctx.fillRect(DECK_W + ((i * 83 + t) % (ARENA_W - DECK_W)), GY + 6 + (i % 3) * 14, 26, 2);
      const sh = mini.shipShake > 0 ? Math.sin(t * 2) * 4 : 0;
      const sx = shipX(mini.elapsed) + sh, bob = Math.sin(t * 0.05) * 3;
      ctx.fillStyle = '#3a2418';
      ctx.beginPath();
      ctx.moveTo(sx - 10, GY - SHIP.h + bob); ctx.lineTo(sx + SHIP.w + 10, GY - SHIP.h + bob);
      ctx.lineTo(sx + SHIP.w - 20, GY + 6 + bob); ctx.lineTo(sx + 20, GY + 6 + bob); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a3a24'; ctx.fillRect(sx, GY - SHIP.h + 8 + bob, SHIP.w, 6);
      ctx.fillStyle = '#d8d0bc'; ctx.fillRect(sx + SHIP.w / 2 - 3, GY - 230 + bob, 6, 180);
      ctx.fillStyle = '#16161c';
      ctx.beginPath(); ctx.moveTo(sx + SHIP.w / 2 + 3, GY - 220 + bob); ctx.lineTo(sx + SHIP.w / 2 + 90, GY - 160 + bob); ctx.lineTo(sx + SHIP.w / 2 + 3, GY - 90 + bob); ctx.fill();
      ctx.fillStyle = '#f4f0e6'; ctx.beginPath(); ctx.arc(sx + SHIP.w / 2 + 34, GY - 158 + bob, 10, 0, Math.PI * 2); ctx.fill();
      // 被打中的破洞
      ctx.fillStyle = '#16100a';
      for (let i = 0; i < mini.hits; i++) { ctx.beginPath(); ctx.arc(sx + 30 + i * 38, GY - 28 + bob, 8, 0, Math.PI * 2); ctx.fill(); }
      // 我方大砲 + 擺動的砲管 + 角度指示
      const ang = cannonAngle(mini.elapsed) * Math.PI / 180;
      const good = shotHits(cannonAngle(mini.elapsed), shipX(mini.elapsed));
      ctx.save();
      ctx.translate(CANNON.x + 10, GY - 24);
      ctx.rotate(-ang);
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(0, -8, 46, 16);
      ctx.fillStyle = '#4a4a54'; ctx.fillRect(40, -10, 8, 20);
      ctx.restore();
      ctx.fillStyle = '#6a4a30';
      ctx.beginPath(); ctx.arc(CANNON.x + 4, GY - 12, 12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(CANNON.x + 22, GY - 12, 12, 0, Math.PI * 2); ctx.fill();
      // 瞄準輔助：會打中的角度時，砲口前方的瞄準點亮綠燈
      ctx.fillStyle = good ? '#8fe3a0' : 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(CANNON.x + 10 + Math.cos(ang) * 64, GY - 24 - Math.sin(ang) * 64, good ? 6 : 4, 0, Math.PI * 2); ctx.fill();
      mini.balls.forEach(function (b) {
        ctx.fillStyle = '#1a1a20'; ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, Math.PI * 2); ctx.fill();
      });
      mini.shells.forEach(function (s) {
        if (s.fuse > 0) {
          const k = s.fuse / 75;
          ctx.strokeStyle = 'rgba(255, 80, 70, ' + (0.9 - k * 0.5).toFixed(2) + ')'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(s.x, GY - 2, 12 + k * 24, 4 + k * 6, 0, 0, Math.PI * 2); ctx.stroke();
          if (s.fuse < 30) {
            ctx.fillStyle = '#2a2a30';
            ctx.beginPath(); ctx.arc(s.x + s.fuse * 8, GY - 8 - s.fuse * 9, 7, 0, Math.PI * 2); ctx.fill();
          }
        } else if (s.boom > 0) {
          ctx.fillStyle = 'rgba(255, 170, 70, ' + (s.boom / 16).toFixed(2) + ')';
          ctx.beginPath(); ctx.arc(s.x, GY - 12, 40 - s.boom, 0, Math.PI * 2); ctx.fill();
        }
      });
    } else if (mini.kind === 'serpent') {
      mini.heads.forEach(function (h) {
        // 甲板上的洞
        ctx.fillStyle = '#1a1410';
        ctx.beginPath(); ctx.ellipse(h.x, GY + 2, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
        if (!h.up || !h.box) return;
        const b = h.box;
        ctx.save();
        ctx.beginPath(); ctx.rect(b.x - 10, 0, b.w + 20, GY + 2); ctx.clip();
        // 調皮海獺（v1.26.1 取代海蛇）：圓滾滾的咖啡色身體、白臉頰、小圓耳、兩隻小手扶著洞口
        ctx.fillStyle = '#8a5a3a';
        U.roundRect(ctx, b.x + 4, b.y + 12, b.w - 8, b.h + 10, 12); ctx.fill();
        ctx.beginPath(); ctx.ellipse(h.x, b.y + 13, 19, 16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(h.x - 14, b.y + 1, 4.5, 0, Math.PI * 2); ctx.fill();      // 耳朵
        ctx.beginPath(); ctx.arc(h.x + 14, b.y + 1, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8d2b0';
        ctx.beginPath(); ctx.ellipse(h.x, b.y + 19, 12, 8, 0, 0, Math.PI * 2); ctx.fill();   // 白色口鼻
        ctx.fillStyle = '#1a1424';
        ctx.beginPath(); ctx.arc(h.x - 7, b.y + 9, 2.6, 0, Math.PI * 2); ctx.fill();       // 圓眼睛
        ctx.beginPath(); ctx.arc(h.x + 7, b.y + 9, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(h.x - 7, b.y + 7.5, 1.2, 1.2); ctx.fillRect(h.x + 7, b.y + 7.5, 1.2, 1.2);
        ctx.fillStyle = '#3a2418';
        ctx.beginPath(); ctx.ellipse(h.x, b.y + 15, 3.4, 2.4, 0, 0, Math.PI * 2); ctx.fill();  // 鼻子
        ctx.fillStyle = 'rgba(240, 140, 160, 0.55)';                                         // 腮紅
        ctx.beginPath(); ctx.arc(h.x - 12, b.y + 17, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(h.x + 12, b.y + 17, 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(60, 36, 24, 0.6)'; ctx.lineWidth = 1;                         // 鬍鬚
        [-1, 1].forEach(function (d) {
          ctx.beginPath(); ctx.moveTo(h.x + d * 5, b.y + 18); ctx.lineTo(h.x + d * 15, b.y + 16); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(h.x + d * 5, b.y + 20); ctx.lineTo(h.x + d * 15, b.y + 21); ctx.stroke();
        });
        if (h.t > 30 && h.t < 42) {   // 要噴水前嘟嘴、臉頰鼓起來（預告）
          ctx.fillStyle = '#c87a8a';
          ctx.beginPath(); ctx.arc(h.x, b.y + 23, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(160, 220, 255, 0.85)';
          ctx.beginPath(); ctx.arc(h.x, b.y + 23, 2, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(h.x - 2, b.y + 19, 2, 0.2, Math.PI - 0.2); ctx.stroke();  // ω 嘴
          ctx.beginPath(); ctx.arc(h.x + 2, b.y + 19, 2, 0.2, Math.PI - 0.2); ctx.stroke();
        }
        // 兩隻小手扶著洞口
        ctx.fillStyle = '#6a4228';
        ctx.beginPath(); ctx.ellipse(h.x - 15, GY - 4, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(h.x + 15, GY - 4, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
    } else if (mini.kind === 'charybdis') {
      drawCharybdisArena(ctx, mini, t, GY);
    } else if (mini.kind === 'scylla') {
      drawScyllaArena(ctx, mini, t, GY);
    } else if (Expedition.has(mini.kind)) {
      Expedition.drawWorld(ctx, state, t);
    } else if (mini.kind === 'golden') {
      ctx.save();
      ctx.translate(mini.px, mini.py);
      for (let k = 0; k < 5; k++) {
        const a = t * 0.08 + k * Math.PI * 2 / 5;
        sparkle(ctx, Math.cos(a) * 30, Math.sin(a) * 30, 5, 0.85);
      }
      if (mini.cool > 0 && Math.floor(mini.cool / 4) % 2 === 0) ctx.globalAlpha = 0.4;
      drawSeahorse(ctx, t, 2);
      ctx.restore();
    }
  }

  /** 斯庫拉一顆頭：狼頭似的長吻、黃眼、尖牙；stuck 時牙齒插在甲板裡、頭上冒星星 */
  function drawScyllaHead(ctx, h, t, GY) {
    ctx.save();
    ctx.translate(h.x, h.y);
    const stuck = h.state === 'stuck';
    if (stuck) ctx.rotate(Math.sin(t * 0.6 + h.i) * 0.06);
    if (h.flash > 0 && Math.floor(h.flash / 4) % 2 === 0) ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#7a56a0';
    ctx.beginPath(); ctx.ellipse(0, -6, 26, 18, 0, 0, Math.PI * 2); ctx.fill();
    // 長吻（朝下）
    ctx.beginPath();
    ctx.moveTo(-18, 2); ctx.quadraticCurveTo(-14, 26, 0, 28); ctx.quadraticCurveTo(14, 26, 18, 2);
    ctx.closePath(); ctx.fill();
    // 鰭冠
    ctx.fillStyle = '#c86a9a';
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath(); ctx.moveTo(k * 8 - 4, -20); ctx.lineTo(k * 8, -34 + Math.abs(k) * 4); ctx.lineTo(k * 8 + 4, -20); ctx.fill();
    }
    // 牙
    ctx.fillStyle = '#f4efe2';
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath(); ctx.moveTo(k * 6 - 3, 20 - Math.abs(k) * 3); ctx.lineTo(k * 6, 32 - Math.abs(k) * 3); ctx.lineTo(k * 6 + 3, 20 - Math.abs(k) * 3); ctx.fill();
    }
    // 眼睛：瞄準時發紅光
    ctx.fillStyle = h.state === 'aim' || h.state === 'bite' ? '#ff5a5a' : '#ffe070';
    ctx.beginPath(); ctx.ellipse(-11, -6, 5, 3.5, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(11, -6, 5, 3.5, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1020';
    ctx.fillRect(-12, -8, 2, 4); ctx.fillRect(10, -8, 2, 4);
    if (h.hp < 2) {
      // 被踩過一下：頭頂腫一個包
      ctx.fillStyle = '#e07aa8';
      ctx.beginPath(); ctx.arc(6, -20, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (stuck) {
      // 頭上轉圈的星星 = 現在可以踩
      for (let k = 0; k < 3; k++) {
        const a = t * 0.12 + k * Math.PI * 2 / 3;
        sparkle(ctx, h.x + Math.cos(a) * 20, h.y - 40 + Math.sin(a) * 5, 5, 0.95);
      }
    }
  }

  function drawCharybdisArena(ctx, mini, t, GY) {
    const cx = EYE.x + EYE.w / 2;
    // 背景的大漩渦（螺旋）
    ctx.save();
    ctx.lineWidth = 3;
    for (let k = 0; k < 6; k++) {
      ctx.strokeStyle = 'rgba(180, 225, 255, ' + (0.32 - k * 0.04).toFixed(2) + ')';
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.15) {
        const r = 10 + a * 34;
        const ang = a + t * 0.04 + k * Math.PI / 3;
        const x = cx + Math.cos(ang) * r, y = GY - 120 + Math.sin(ang) * r * 0.32;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // 漩渦眼（甲板中間的破洞看下去是旋轉的深水）
    const g = ctx.createRadialGradient(cx, GY + 30, 6, cx, GY + 30, EYE.w * 0.6);
    g.addColorStop(0, '#04101e'); g.addColorStop(1, '#1a5a8a');
    ctx.fillStyle = g;
    ctx.fillRect(EYE.x, GY - 2, EYE.w, 90);
    ctx.strokeStyle = 'rgba(220, 245, 255, 0.6)'; ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.ellipse(cx, GY + 20, 20 + k * 22, 6 + k * 4, 0, t * 0.08 + k, t * 0.08 + k + Math.PI * 1.2); ctx.stroke();
    }
    // 救生圈
    if (mini.buoy) {
      const b = mini.buoy, bob = Math.sin(t * 0.1) * 4;
      ctx.lineWidth = 7;
      for (let k = 0; k < 4; k++) {
        ctx.strokeStyle = k % 2 ? '#ffffff' : '#e04a3a';
        ctx.beginPath(); ctx.arc(b.x, b.y + bob, 13, k * Math.PI / 2, (k + 1) * Math.PI / 2); ctx.stroke();
      }
    }
    // 漂流的木桶
    mini.junk.forEach(function (j) {
      ctx.save();
      ctx.translate(j.x + 14, GY - 14);
      ctx.rotate(j.rot);
      ctx.fillStyle = '#8a5a30';
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#3a3a40'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#c8a050'; ctx.fillRect(-2, -11, 4, 22);
      ctx.restore();
    });
    // 兩側往中間的箭頭（拖力提示）
    U.text(ctx, '≫ ≫', EYE.x - 60, GY - 30, { size: 16, color: 'rgba(200, 240, 255, 0.55)', stroke: false });
    U.text(ctx, '≪ ≪', EYE.x + EYE.w + 60, GY - 30, { size: 16, color: 'rgba(200, 240, 255, 0.55)', stroke: false });
    ctx.restore();
  }

  function drawScyllaArena(ctx, mini, t, GY) {
    // 甲板後面的海：海峽的浪
    ctx.fillStyle = '#24507a';
    ctx.fillRect(0, GY - 70, ARENA_W, 70);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 9; i++) ctx.fillRect((i * 117 + t * 0.6) % ARENA_W, GY - 60 + (i % 3) * 18, 34, 2);
    // 身體：從海裡冒出來的巨大背脊
    ctx.fillStyle = '#4a3466';
    ctx.beginPath(); ctx.ellipse(ARENA_W / 2, GY - 64, 330, 46, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(200, 106, 154, 0.5)';
    for (let i = 0; i < 9; i++) {
      const x = ARENA_W / 2 - 240 + i * 60;
      ctx.beginPath(); ctx.moveTo(x - 10, GY - 92); ctx.lineTo(x, GY - 118 + Math.abs(i - 4) * 4); ctx.lineTo(x + 10, GY - 92); ctx.fill();
    }
    // 脖子：從背脊連到每顆頭
    mini.heads.forEach(function (h) {
      if (!h.alive) return;
      const bx = ARENA_W / 2 - 250 + h.i * 100;
      ctx.strokeStyle = '#5a3f7a'; ctx.lineWidth = 22; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx, GY - 80);
      ctx.quadraticCurveTo((bx + h.x) / 2, Math.min(GY - 80, h.y) - 70, h.x, h.y - 8);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(160, 120, 200, 0.5)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(bx - 4, GY - 82);
      ctx.quadraticCurveTo((bx + h.x) / 2 - 4, Math.min(GY - 80, h.y) - 74, h.x - 4, h.y - 12);
      ctx.stroke();
      ctx.lineCap = 'butt';
    });
    // 瞄準：甲板上的紅圈（越接近咬下越亮越小）
    mini.heads.forEach(function (h) {
      if (h.state !== 'aim') return;
      const k = h.t / SCY.AIM;
      ctx.strokeStyle = 'rgba(255, 70, 70, ' + (0.4 + k * 0.6).toFixed(2) + ')'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(h.tx, GY - 2, 54 - k * 14, 9, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 70, 70, ' + (0.1 + k * 0.2).toFixed(2) + ')';
      ctx.beginPath(); ctx.ellipse(h.tx, GY - 2, 54 - k * 14, 9, 0, 0, Math.PI * 2); ctx.fill();
    });
    mini.heads.forEach(function (h) { if (h.alive) drawScyllaHead(ctx, h, t, GY); });
    // 浪：預告時起點冒水花，之後一道浪牆掃過甲板
    mini.waves.forEach(function (w) {
      if (w.warn > 0) {
        const sx = w.dir < 0 ? ARENA_W - 30 : 30;
        ctx.fillStyle = 'rgba(200, 235, 255, 0.85)';
        for (let k = 0; k < 6; k++) {
          ctx.beginPath(); ctx.arc(sx + Math.sin(t * 0.4 + k) * 14, GY - 10 - ((t * 2 + k * 9) % 46), 4, 0, Math.PI * 2); ctx.fill();
        }
        if (Math.floor(t / 8) % 2 === 0) U.text(ctx, '浪！', sx, GY - 70, { size: 18, color: '#bfe8ff', strokeWidth: 4 });
        return;
      }
      const H = SCY.WAVE_H;
      ctx.fillStyle = 'rgba(70, 150, 210, 0.9)';
      ctx.beginPath();
      ctx.moveTo(w.x - 30 * w.dir, GY);
      ctx.quadraticCurveTo(w.x - 10 * w.dir, GY - H, w.x + 10 * w.dir, GY - H + 4);
      ctx.quadraticCurveTo(w.x + 22 * w.dir, GY - H * 0.4, w.x + 24 * w.dir, GY);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(240, 250, 255, 0.9)';
      ctx.beginPath(); ctx.arc(w.x + 8 * w.dir, GY - H + 4, 6, 0, Math.PI * 2); ctx.fill();
    });
  }

  /** 小遊戲的目標與倒數（畫在 HUD 下面） */
  function drawHud(ctx, state, W) {
    const mini = state.mini;
    if (!mini) return;
    const k = state.def.monster.def;
    const sec = Math.max(0, Math.ceil(mini.time / 60));
    let goal;
    if (mini.kind === 'gulls') goal = '麵包 ' + mini.bread + ' / 5　撐 ' + sec + ' 秒';
    else if (mini.kind === 'pirates') goal = '命中 ' + mini.hits + ' / 5　剩 ' + sec + ' 秒　（站在砲旁按 K／丟 開砲，綠燈 = 會打中）';
    else if (mini.kind === 'serpent') goal = '拍到 ' + mini.hits + ' / 6　剩 ' + sec + ' 秒';
    else if (mini.kind === 'charybdis') goal = '救生圈 ' + mini.got + ' / 5　剩 ' + sec + ' 秒　（別被拖進中間的漩渦眼）';
    else if (mini.kind === 'scylla') goal = '踩扁的頭 ' + mini.hits + ' / 6　剩 ' + sec + ' 秒' + (mini.hits >= 3 ? '　（發怒！小心浪）' : '　（紅圈 = 要咬下來了）');
    else if (Expedition.has(mini.kind)) goal = Expedition.hud(mini);
    else goal = '抓到 ' + mini.caught + ' / 3　剩 ' + sec + ' 秒';
    ctx.fillStyle = 'rgba(10, 16, 30, 0.75)';
    U.roundRect(ctx, W / 2 - 250, 52, 500, 30, 8); ctx.fill();
    U.text(ctx, k.game + '：' + goal, W / 2, 67, { size: 14, color: sec <= 5 ? '#ff9aa8' : '#ffe9a8' });
  }

  return {
    EAST_EXP: EAST_EXP,
    REGIONS: REGIONS,
    EXP_REGIONS: EXP_REGIONS,
    regionOf: regionOf,
    regionUnlocked: regionUnlocked,
    nextRegion: nextRegion,
    KINDS: KINDS,
    updateMap: updateMap,
    drawMap: drawMap,
    nearby: function () { return nearM; },
    monsters: function () { return monsters; },
    spawn: spawn,
    remove: remove,
    clear: function () { monsters = []; nearM = null; },
    /** 海上魔王本人（地圖上固定那隻；還沒生成就先補上） */
    /** 剛逃出漩渦：一段時間不再吸 */
    calmVortex: function (frames) { vortexCalm = frames || 360; },
    boss: function (kind) {
      ensureBosses();
      return monsters.filter(function (m) { return m.boss && m.kind === kind; })[0] || null;
    },
    makeDef: makeDef,
    RELICS: RELICS,
    updateSkirmish: updateSkirmish,
    drawWorld: drawWorld,
    drawHud: drawHud,
    cannonAngle: cannonAngle,
    shotHits: shotHits,
    shipX: shipX,
    CANNON: CANNON,
    HOLES: HOLES
  };
})();
