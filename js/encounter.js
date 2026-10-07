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
 *   大海蛇   打地鼠     蛇頭從甲板的洞輪流冒出來，踩中 6 次；蛇頭會吐口水
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
    serpent: { name: '大海蛇',   lv: 3, exp: 130, game: '打地鼠',   goal: '踩中冒出來的蛇頭 6 次' },
    golden:  { name: '黃金海馬', lv: '★', exp: 60, game: '捕捉',     goal: '碰到牠 3 次就抓到了！', rare: true }
  };

  let monsters = [];
  let spawnTimer = 120;
  let nearM = null;

  // ── 地圖上的怪 ─────────────────────────────────────────

  function pickKind(exp) {
    const w = [['gulls', 5], ['pirates', exp >= 30 ? 3 : 1], ['serpent', exp >= 90 ? 2 : 0]];
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

  function updateMap(ship, exp) {
    const events = [];
    if (--spawnTimer <= 0) {
      spawnTimer = SPAWN_EVERY;
      if (monsters.length < MAX_ON_MAP && Math.random() < SPAWN_CHANCE) {
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

  function drawSerpent(ctx, t) {
    ctx.fillStyle = '#3f8f6a'; ctx.strokeStyle = '#1f4d39'; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const h = 4 + Math.sin(t * 0.12 + i * 1.3) * 2;
      ctx.beginPath(); ctx.ellipse(-12 + i * 8, 0, 3.6, h, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
    }
    const hy = -4 + Math.sin(t * 0.1) * 1.5;
    ctx.beginPath(); ctx.ellipse(12, hy, 5, 3.6, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(13.5, hy - 1, 1, 0, Math.PI * 2); ctx.fill();
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
  const DUR = { gulls: 25 * 60, pirates: 45 * 60, serpent: 32 * 60, golden: 20 * 60 };
  const HOLES = [140, 300, 460, 620, 780];
  const BASKET = { x: 455, w: 50, h: 26 };
  const CANNON = { x: 470, angMin: 20, angMax: 70, period: 110, speed: 10.5, grav: 0.25 };
  const SHIP = { x: 680, w: 210, h: 54 };
  const DECK_W = 560;     // 艦砲對決：玩家的甲板寬度（右邊是海）

  function makeDef(m, stats) {
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
      fact: '打贏可得 ' + k.exp + ' EXP，累積 ' + EAST_EXP + ' EXP 解鎖東歐篇。',
      sky: kind === 'golden' ? ['#6a8ad8', '#f8e0a8'] : ['#5fa8d8', '#f6dcae'],
      hill: '#2f6f9a',
      // 船的甲板：木板色
      groundTop: '#b88a58', groundBody: '#6a4a30',
      deco: null,
      width: ARENA_W, height: 480,
      layout: 'boss',
      skirmish: true,
      minigame: kind,
      // 守護午餐不能出生在籃子旁邊（見 updateSkirmish 的說明）
      spawnX: kind === 'pirates' ? 380 : kind === 'gulls' ? 260 : ARENA_W / 2 - 11,
      isBoss: false,
      bossArena: { x: 0, y: 0, w: deckW, h: 480 },
      ground: [{ x: 0, y: GY, w: deckW, h: Levels.GROUND_H }],
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
    return def;
  }

  // ── 小遊戲：執行期 ─────────────────────────────────────

  function initMini(state) {
    const kind = state.def.minigame;
    const mini = { kind: kind, time: state.def.duration, elapsed: 0, score: 0, done: false };
    if (kind === 'gulls') { mini.bread = 5; mini.gulls = []; mini.next = 60; mini.seq = 0; }
    if (kind === 'pirates') { mini.hits = 0; mini.balls = []; mini.shells = []; mini.cd = 0; mini.enemyCd = 120; mini.seq = 0; mini.shipShake = 0; }
    if (kind === 'serpent') { mini.hits = 0; mini.heads = HOLES.map(function (x) { return { x: x, up: 0, t: 0, spat: false }; }); mini.next = 40; mini.seq = 0; }
    if (kind === 'golden') { mini.caught = 0; mini.px = 700; mini.py = 200; mini.cool = 0; mini.phase = 0; mini.speed = 0.022; }
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
        mini.cd = 70;      // 裝填要一點時間：每一發都要重新抓角度
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
          state.shots.push(makeShot(sx - 6, sy, dx / d * 2.3, dy / d * 2.3));
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
        ctx.fillStyle = '#3f8f6a';
        U.roundRect(ctx, b.x + 4, b.y + 10, b.w - 8, b.h + 10, 8); ctx.fill();
        ctx.beginPath(); ctx.ellipse(h.x, b.y + 12, 20, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.arc(h.x - 7, b.y + 8, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(h.x + 7, b.y + 8, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a1a20';
        ctx.fillRect(h.x - 8, b.y + 7, 2, 3); ctx.fillRect(h.x + 6, b.y + 7, 2, 3);
        if (h.t > 30 && h.t < 42) {   // 要吐口水前張嘴（預告）
          ctx.fillStyle = '#8a2a2a';
          ctx.beginPath(); ctx.ellipse(h.x, b.y + 18, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      });
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

  /** 小遊戲的目標與倒數（畫在 HUD 下面） */
  function drawHud(ctx, state, W) {
    const mini = state.mini;
    if (!mini) return;
    const k = state.def.monster.def;
    const sec = Math.max(0, Math.ceil(mini.time / 60));
    let goal;
    if (mini.kind === 'gulls') goal = '麵包 ' + mini.bread + ' / 5　撐 ' + sec + ' 秒';
    else if (mini.kind === 'pirates') goal = '命中 ' + mini.hits + ' / 5　剩 ' + sec + ' 秒　（站在砲旁按 K／丟 開砲，綠燈 = 會打中）';
    else if (mini.kind === 'serpent') goal = '踩中 ' + mini.hits + ' / 6　剩 ' + sec + ' 秒';
    else goal = '抓到 ' + mini.caught + ' / 3　剩 ' + sec + ' 秒';
    ctx.fillStyle = 'rgba(10, 16, 30, 0.75)';
    U.roundRect(ctx, W / 2 - 250, 52, 500, 30, 8); ctx.fill();
    U.text(ctx, k.game + '：' + goal, W / 2, 67, { size: 14, color: sec <= 5 ? '#ff9aa8' : '#ffe9a8' });
  }

  return {
    EAST_EXP: EAST_EXP,
    KINDS: KINDS,
    updateMap: updateMap,
    drawMap: drawMap,
    nearby: function () { return nearM; },
    monsters: function () { return monsters; },
    spawn: spawn,
    remove: remove,
    clear: function () { monsters = []; nearM = null; },
    makeDef: makeDef,
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
