'use strict';

/**
 * 往前衝的賽道關（v1.31 玩家：左右、上下都有了，少一個往前的賽車類型）。
 *
 * 假 3D 的賽道（跟老街機的 OutRun 一樣）：賽道切成一段一段（SEG 長），每段有彎度（curve）和高度（y），
 * 畫的時候從近到遠投影到畫面上；玩家永遠在畫面下方中間，賽道往畫面裡面捲。
 *
 * 操作（跟其他關一樣的鍵）：自動往前衝；←→ 轉向；跳躍 = 車子彈起來（跳過矮的障礙）。
 *   高的障礙（路上的車、大石頭）要閃開；矮的（大浪、樹幹、坑洞）可以跳過去。
 *   彎道會把人往外甩（離心力），要往內側壓；衝出路面會變慢（古巴的人行道、墨西哥的沙地）。
 *   撞到障礙扣一顆愛心、速度掉一大截；開到終點線就過關。
 *
 * 兩種主題：
 *   car   （v1.31 古巴改成上帝視角，見 topdown.js；這個主題的程式還留著）
 *   chase 墨西哥・銅峽谷：緝毒大追擊 —— 開警車追走私販的卡車，卡車沿路丟下木箱（矮，跳過去）；
 *         仙人掌、大石頭要閃，風滾草可以跳；終點是攔下卡車的路障
 *
 * 對外：
 *   Race.plan(cfg)               關卡定義時排好整條賽道（固定 seed，結果可重現）
 *   Race.makeState(def)          執行期狀態
 *   Race.update(state, input, t) 每帧，回傳事件（'coin'、'p0:hurt'、'jump'、'equip'、'clear'、'feature:xxx'）
 *   Race.draw(ctx, state, t, W, H)
 *
 * 載入順序：levelgen.js 之後、levels.js 之前（levels.js 定義關卡時就要 plan）。
 */
const Race = (function () {

  const SEG = 200;              // 一段賽道的長度（世界單位）
  const ROAD_W = 2000;          // 路寬的一半（x = ±1 就是路邊）
  const CAM_H = 1000;           // 攝影機高度
  const CAM_DEPTH = 0.84;       // 1 / tan(視角 / 2)，視角約 100 度
  const PLAYER_Z = CAM_H * CAM_DEPTH;   // 玩家離攝影機多遠（畫在畫面下方的那個位置）
  const DRAW = 150;             // 往前畫幾段
  const LANES = [-0.62, 0, 0.62];
  const PLAYER_W = 0.34;        // 玩家（車子）的寬（路寬單位）
  /*
   * 跳起來的初速、重力（hop 是離地高度，像素）。
   * v1.31 玩家：墨西哥的障礙很難跳過去 → 跳得更高、在空中更久（約 50 帧），矮的障礙只要離地 HOP_CLEAR 就算跳過。
   */
  const HOP_V = 10.5, HOP_G = 0.42, HOP_CLEAR = 6;
  const INVULN = 90;

  /** 可重現的偽隨機 */
  function rng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
  function ease(a, b, k) { return a + (b - a) * ((-Math.cos(k * Math.PI) / 2) + 0.5); }

  // ── 規劃 ────────────────────────────────────────────────

  /**
   * cfg.course：一串 [段數, 彎度, 高低起伏]（彎度正 = 右彎；起伏是這一段結束時比開始高多少，單位世界座標）
   * cfg.theme：'car'（古巴）/ 'chase'（墨西哥）
   */
  function plan(cfg) {
    // v1.31 古巴改成上帝視角（view: 'top'，見 topdown.js）
    if (cfg.view === 'top') return TopRace.plan(cfg);
    const r = rng(cfg.seed || 1);
    const segs = [];
    let y = 0;
    (cfg.course || [[400, 0, 0]]).forEach(function (sec) {
      const n = sec[0], curve = sec[1] || 0, rise = sec[2] || 0;
      const y0 = y;
      for (let i = 0; i < n; i++) {
        const k = n > 1 ? i / (n - 1) : 1;
        // 彎度在一段的頭尾 15% 淡入淡出，不會一下子甩出去
        const c = curve * Math.min(1, Math.min(i, n - 1 - i) / Math.max(1, n * 0.15));
        segs.push({ i: segs.length, curve: c, y1: 0, y2: 0, sprites: [], obs: [], coins: [] });
        segs[segs.length - 1].yEnd = ease(y0, y0 + rise, k);
      }
      y = y0 + rise;
    });
    // 每段的起訖高度
    for (let i = 0; i < segs.length; i++) {
      segs[i].y1 = i === 0 ? 0 : segs[i - 1].yEnd;
      segs[i].y2 = segs[i].yEnd;
    }
    const total = segs.length;
    const START = 40, END = total - 60;        // 前 40 段暖身、終點前 60 段清空（終點後面也不放東西）
    const finish = total - 40;

    // 路邊的裝飾
    const deco = cfg.theme === 'chase'
      ? function (i) {
          if (i % 5 === 0) segs[i].sprites.push({ x: -1.4 - r() * 0.9, kind: 'cactus' });
          if (i % 5 === 2) segs[i].sprites.push({ x: 1.4 + r() * 0.9, kind: r() < 0.6 ? 'cactus' : 'mesa' });
          if (i % 11 === 0) segs[i].sprites.push({ x: (r() < 0.5 ? -1 : 1) * 1.15, kind: 'sign' });
        }
      : function (i) {
          if (i % 4 === 0) segs[i].sprites.push({ x: -1.25, kind: 'seawall' });
          if (i % 6 === 0) segs[i].sprites.push({ x: 1.3 + r() * 0.2, kind: 'palm' });
          if (i % 5 === 2) segs[i].sprites.push({ x: 2.1 + r() * 0.4, kind: 'house', col: Math.floor(r() * 5) });
          if (i % 9 === 4) segs[i].sprites.push({ x: 1.15, kind: 'lamp' });
        };
    for (let i = 0; i < total; i++) deco(i);

    // 障礙：每隔一段距離放一個；高的（要閃）、矮的（可以跳）
    const obsKinds = cfg.theme === 'chase'
      ? [{ kind: 'tumbleweed', low: true, w: 0.4 }, { kind: 'rock', low: false, w: 0.42 }, { kind: 'cactusRoad', low: false, w: 0.3 }]
      : [{ kind: 'pothole', low: true, w: 0.5 }, { kind: 'cone', low: false, w: 0.3 }, { kind: 'cart', low: false, w: 0.46 }];
    const gap = cfg.obsEvery || 34;
    for (let i = START; i < END; i += gap + Math.floor(r() * 12)) {
      const o = obsKinds[Math.floor(r() * obsKinds.length)];
      if (o.full) {
        segs[i].obs.push({ x: 0, kind: o.kind, w: o.w, low: true });
      } else {
        const lane = LANES[Math.floor(r() * 3)];
        segs[i].obs.push({ x: lane, kind: o.kind, w: o.w, low: o.low });
      }
    }
    // 古巴：大浪（整條路，要跳）—— 海堤前幾段先冒水花預告
    (cfg.waves || []).forEach(function (k) {
      const i = Math.round(START + (END - START) * k);
      for (let d = 0; d < 3; d++) segs[i + d].obs = [];
      segs[i].obs.push({ x: 0, kind: 'wave', w: 2.6, low: true });
      for (let d = 4; d <= 22; d += 3) segs[i - d].sprites.push({ x: -1.15, kind: 'spray' });
    });
    // 墨西哥：走私卡車丟下的一整排木箱（整條路，要跳）—— 前面兩側先立警示牌（跟古巴海堤冒水花一樣是預告）
    (cfg.crates || []).forEach(function (k) {
      const i = Math.round(START + (END - START) * k);
      for (let d = -16; d < 4; d++) segs[i + d].obs = [];
      segs[i].obs.push({ x: 0, kind: 'crates', w: 2.6, low: true });
      for (let d = 6; d <= 24; d += 6) { segs[i - d].sprites.push({ x: -1.2, kind: 'warn' }); segs[i - d].sprites.push({ x: 1.2, kind: 'warn' }); }
    });
    // 金幣：一排 5 枚，放在沒有障礙的車道
    const coins = [];
    for (let i = START + 10; i < END - 10; i += 52 + Math.floor(r() * 14)) {
      const lane = LANES[Math.floor(r() * 3)];
      let ok = true;
      for (let d = -2; d < 12; d++) if (segs[i + d] && segs[i + d].obs.some(function (o) { return Math.abs(o.x - lane) < (o.w + 0.3) / 2 && !o.low; })) ok = false;
      if (!ok) continue;
      for (let d = 0; d < 5; d++) {
        const c = { seg: i + d * 2, x: lane };
        segs[i + d * 2].coins.push(c);
        coins.push(c);
      }
    }
    // 終點線
    segs[finish].sprites.push({ x: 0, kind: cfg.theme === 'chase' ? 'roadblock' : 'finish' });
    return {
      theme: cfg.theme || 'car',
      segs: segs,
      total: total,
      finish: finish,
      coins: coins,
      traffic: cfg.traffic || 0,
      maxSpeed: cfg.maxSpeed || 120,
      offroad: 'slow',
      seed: cfg.seed || 1
    };
  }

  // ── 執行期 ──────────────────────────────────────────────

  function makeState(def) {
    const pl = def.race;
    if (pl.view === 'top') return TopRace.makeState(def);
    const r = rng(pl.seed + 7);
    // 古巴：路上慢慢開的老爺車（跟你同方向，比你慢）
    const cars = [];
    for (let k = 0; k < pl.traffic; k++) {
      cars.push({ z: (60 + k * (pl.total - 160) / Math.max(1, pl.traffic)) * SEG, x: LANES[Math.floor(r() * 3)],
                  speed: pl.maxSpeed * (0.32 + r() * 0.18), col: Math.floor(r() * 4) });
    }
    return {
      pos: 0, x: 0, speed: 0, hop: 0, vh: 0, invuln: 0, skyOff: 0,
      coinsTaken: {}, cars: cars, done: false, seen: {}, scrape: 0, tilt: 0,
      equipSeg: pl.finish - 30, equipX: 0
    };
  }

  function segAt(pl, z) { return pl.segs[Math.max(0, Math.min(pl.total - 1, Math.floor(z / SEG)))]; }

  function update(state, input, t) {
    if (state.def.race.view === 'top') return TopRace.update(state, input, t);
    const events = [];
    const def = state.def, pl = def.race, rs = state.race, p = state.player;
    const st = p.stats || {};
    if (rs.done) return events;
    const maxS = pl.maxSpeed;
    // 速度：自動加速到極速（跑鞋 speed 也算進去）；衝出路面（古巴）只剩一半
    const top = maxS * Math.min(1.15, st.speed || 1);
    const off = Math.abs(rs.x) > 1;
    const limit = off && pl.offroad === 'slow' ? top * 0.45 : top;
    if (rs.speed < limit) rs.speed = Math.min(limit, rs.speed + maxS * 0.012);
    else rs.speed = Math.max(limit, rs.speed - maxS * 0.03);
    const k = rs.speed / maxS;
    // 轉向＋彎道的離心力
    const seg = segAt(pl, rs.pos + PLAYER_Z);
    // 轉向力跟著速度走（穿了跑鞋跑得比極速快時，轉向也要跟著變強，不然最急的彎壓不住）
    const steer = 0.034 * Math.min(1.25, k + 0.2);
    let dir = 0;
    if (input.isDown('left')) dir -= 1;
    if (input.isDown('right')) dir += 1;
    rs.x += dir * steer;
    rs.x -= seg.curve * k * 0.0062;
    rs.tilt += (dir - rs.tilt) * 0.2;
    p.facing = dir || p.facing || 1;
    rs.x = U.clamp(rs.x, -1.8, 1.8);
    // 跳（離地 hop）
    if (rs.hop <= 0 && input.once('jump')) { rs.vh = HOP_V * (1 + (st.jumpBoost || 0) * 0.04); rs.hop = 0.01; events.push('jump'); }
    if (rs.hop > 0) {
      rs.hop += rs.vh; rs.vh -= HOP_G;
      if (rs.hop <= 0) { rs.hop = 0; rs.vh = 0; events.push('land'); }
    }
    // 往前
    const before = rs.pos;
    rs.pos += rs.speed;
    rs.skyOff += seg.curve * k * 0.0016;
    if (rs.invuln > 0) rs.invuln--;
    p.invuln = rs.invuln;
    // 車流
    rs.cars.forEach(function (c) { c.z += c.speed; if (c.z > (pl.total - 50) * SEG) c.z = 30 * SEG; });

    // 這一帧掃過的路段（速度快時一帧會跨過好幾段，中間的障礙也要算）
    const z0 = before + PLAYER_Z, z1 = rs.pos + PLAYER_Z;
    const i0 = Math.floor(z0 / SEG), i1 = Math.floor(z1 / SEG);
    for (let i = i0; i <= i1 && i < pl.total; i++) {
      const s = pl.segs[i];
      if (!s) continue;
      // 第一次看到某種障礙：提示（大浪、樹幹）
      for (let d = 30; d <= 34; d++) {
        const ahead = pl.segs[i + d];
        if (ahead) ahead.obs.forEach(function (o) {
          if ((o.kind === 'wave' || o.kind === 'crates') && !rs.seen[o.kind]) { rs.seen[o.kind] = true; events.push('feature:race_' + o.kind); }
        });
      }
      s.obs.forEach(function (o) {
        if (rs.invuln > 0) return;
        if (o.low && rs.hop > HOP_CLEAR) return;            // 跳在半空中：矮的障礙飛過去
        if (o.kind === 'wave' && st.waveProof) { rs.speed *= 0.7; return; }   // v1.31 古巴襯衫：浪打到不痛，只是慢下來
        if (Math.abs(rs.x - o.x) < (o.w + PLAYER_W) / 2) {
          rs.invuln = INVULN;
          rs.speed *= 0.35;
          rs.x += (rs.x >= o.x ? 1 : -1) * 0.25;
          events.push('p0:hurt');
        }
      });
      s.coins.forEach(function (c) {
        const key = c.seg + ':' + c.x;
        if (rs.coinsTaken[key]) return;
        if (Math.abs(rs.x - c.x) < 0.32 && rs.hop < 70) {
          rs.coinsTaken[key] = true;
          state.coinsGot++;
          events.push('coin');
        }
      });
      // 這關的裝備：終點前漂浮在路中間
      if (state.equip && !state.equip.taken && i === rs.equipSeg && Math.abs(rs.x - rs.equipX) < 0.4) {
        state.equip.taken = true;
        events.push('equip');
      }
    }
    // 撞上前面的車（跟車子同一段、左右重疊）
    rs.cars.forEach(function (c) {
      if (rs.invuln > 0) return;
      const dz = c.z - (rs.pos + PLAYER_Z);
      if (dz > -SEG * 0.3 && dz < SEG * 0.6 && Math.abs(rs.x - c.x) < (0.46 + PLAYER_W) / 2) {
        rs.invuln = INVULN;
        rs.speed = Math.min(rs.speed, c.speed * 0.6);
        rs.x += (rs.x >= c.x ? 1 : -1) * 0.3;
        events.push('p0:hurt');
      }
    });
    if (z1 >= pl.finish * SEG) {
      rs.done = true;
      state.cleared = true;
      events.push('clear');
    }
    return events;
  }

  // ── 繪製 ────────────────────────────────────────────────

  const THEME = {
    car: {
      sky: ['#f6a970', '#ffe0b0'], ground1: '#d8c8a0', ground2: '#cdbb92',
      road1: '#6a6a72', road2: '#64646c', rumble1: '#f4f0e6', rumble2: '#c8402a', lane: '#f4f0e6'
    },
    chase: {
      sky: ['#5aa8e0', '#f8dca0'], ground1: '#d8945a', ground2: '#cc8a52',
      road1: '#5a5a60', road2: '#55555b', rumble1: '#f2c230', rumble2: '#2a2a30', lane: '#f2c230'
    }
  };

  function project(p, camX, camY, camZ, W, H) {
    const z = p.z - camZ;
    p.scale = CAM_DEPTH / z;
    p.sx = Math.round(W / 2 + p.scale * (p.x - camX) * W / 2);
    p.sy = Math.round(H / 2 - p.scale * (p.y - camY) * H / 2);
    p.sw = Math.round(p.scale * ROAD_W * W / 2);
  }

  function quad(ctx, x1, y1, w1, x2, y2, w2, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1 - w1, y1); ctx.lineTo(x2 - w2, y2); ctx.lineTo(x2 + w2, y2); ctx.lineTo(x1 + w1, y1);
    ctx.closePath(); ctx.fill();
  }

  /** 遠景：古巴是海平線＋哈瓦那的老房子剪影＋國會大廈圓頂；墨西哥是銅峽谷的紅色峭壁＋前面逃跑的卡車揚起的沙塵 */
  function drawBackdrop(ctx, pl, rs, t, W, H) {
    const th = THEME[pl.theme];
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const off = rs.skyOff;
    const hz = H * 0.5;
    if (pl.theme === 'car') {
      // 夕陽
      ctx.fillStyle = 'rgba(255, 240, 180, 0.9)';
      ctx.beginPath(); ctx.arc(W * 0.3 - off * 200, hz - 40, 38, 0, Math.PI * 2); ctx.fill();
      // 左半是海
      ctx.fillStyle = '#3a8ab8'; ctx.fillRect(0, hz - 14, W * 0.55, 30);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let k = 0; k < 10; k++) ctx.fillRect(((k * 97 - off * 300) % (W * 0.55) + W * 0.55) % (W * 0.55), hz - 8 + (k % 3) * 6, 24, 1.5);
      // 右半是城市剪影
      const cols = ['#e8a87a', '#8ac8c8', '#e88aa0', '#f2d08a', '#a8b8e8'];
      for (let k = 0; k < 18; k++) {
        const x = ((W * 0.42 + k * 44 - off * 400) % (W * 1.2) + W * 1.2) % (W * 1.2) - 60;
        const h = 26 + (k * 37) % 40;
        ctx.fillStyle = cols[k % cols.length];
        ctx.fillRect(x, hz - h + 16, 40, h);
      }
      const cx = ((W * 0.75 - off * 400) % (W * 1.2) + W * 1.2) % (W * 1.2) - 60;
      ctx.fillStyle = '#efe6d4';
      ctx.beginPath(); ctx.arc(cx, hz - 40, 16, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx - 18, hz - 40, 36, 56);
    } else {
      // 銅峽谷：一層層的紅色峭壁（平頂的方山）
      [['#b8643a', 0.6, 110, 0.006], ['#a0502e', 1, 70, 0.013]].forEach(function (L) {
        ctx.fillStyle = L[0];
        ctx.beginPath(); ctx.moveTo(0, hz + 14);
        for (let x = 0; x <= W; x += 24) {
          const v = Math.sin((x + off * 600 * L[1]) * L[3]);
          ctx.lineTo(x, hz - L[2] * (v > 0.2 ? 1 : 0.55) - Math.sin((x + off * 500) * 0.04) * 4);
        }
        ctx.lineTo(W, hz + 14); ctx.closePath(); ctx.fill();
      });
      ctx.fillStyle = 'rgba(255, 240, 200, 0.25)'; ctx.fillRect(0, hz - 40, W, 8);
      // 前面逃跑的走私卡車揚起的沙塵（越接近終點越近、越大）
      const prog = U.clamp((rs.pos + PLAYER_Z) / (pl.finish * SEG), 0, 1);
      const dx = W / 2 - off * 300, sz = 10 + prog * 26;
      ctx.fillStyle = 'rgba(230, 200, 150, 0.6)';
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(dx + (k - 1.5) * sz * 0.8, hz - 6 - (k % 2) * 4, sz * 0.6, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#4a5a6a'; ctx.fillRect(dx - sz * 0.6, hz - sz * 0.9, sz * 1.2, sz * 0.7);
    }
  }

  function drawSprite(ctx, kind, sx, sy, scale, W, o, t) {
    // scale：世界 → 畫面的倍率；ROAD_W 寬 = sw。這裡的 u = 一個「路寬單位」換成像素
    const u = scale * ROAD_W * W / 2;
    ctx.save();
    ctx.translate(sx, sy);
    switch (kind) {
      case 'palm': {
        const h = u * 0.9;
        ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = Math.max(1, u * 0.05);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(u * 0.08, -h * 0.5, 0, -h); ctx.stroke();
        ctx.fillStyle = '#3f8a3a';
        for (let k = 0; k < 6; k++) {
          const a = k * Math.PI / 3;
          ctx.beginPath(); ctx.ellipse(Math.cos(a) * u * 0.18, -h + Math.sin(a) * u * 0.06, u * 0.2, u * 0.05, a, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'cactus': case 'cactusRoad': {
        // 巨柱仙人掌（路邊的是大的、路上的是小的）
        const h = kind === 'cactus' ? u * 0.75 : u * 0.34, w = kind === 'cactus' ? u * 0.06 : u * 0.05;
        ctx.fillStyle = '#3f8a4a';
        ctx.fillRect(-w, -h, w * 2, h);
        ctx.fillRect(-w * 3, -h * 0.65, w, h * 0.3); ctx.fillRect(-w * 3, -h * 0.65, w * 2.2, w);
        ctx.fillRect(w * 2, -h * 0.8, w, h * 0.35); ctx.fillRect(w, -h * 0.5, w * 2, w);
        ctx.fillStyle = '#5aa85a'; ctx.fillRect(-w * 0.3, -h, w * 0.6, h);
        break;
      }
      case 'mesa':
        ctx.fillStyle = '#b05a34';
        ctx.beginPath(); ctx.moveTo(-u * 0.6, 0); ctx.lineTo(-u * 0.45, -u * 0.7); ctx.lineTo(u * 0.4, -u * 0.72); ctx.lineTo(u * 0.6, 0); ctx.fill();
        ctx.fillStyle = 'rgba(255, 220, 170, 0.3)'; ctx.fillRect(-u * 0.5, -u * 0.5, u, u * 0.04);
        break;
      case 'warn':
        // 前方有障礙的三角警示牌
        ctx.fillStyle = '#5a5a60'; ctx.fillRect(-u * 0.01, -u * 0.3, u * 0.02, u * 0.3);
        ctx.fillStyle = '#f2a020';
        ctx.beginPath(); ctx.moveTo(0, -u * 0.5); ctx.lineTo(u * 0.12, -u * 0.3); ctx.lineTo(-u * 0.12, -u * 0.3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#16161c'; ctx.fillRect(-u * 0.01, -u * 0.45, u * 0.02, u * 0.08); ctx.fillRect(-u * 0.01, -u * 0.35, u * 0.02, u * 0.02);
        break;
      case 'sign':
        // 路邊的告示牌：「緝毒檢查哨 前方 2 公里」
        ctx.fillStyle = '#5a5a60'; ctx.fillRect(-u * 0.01, -u * 0.36, u * 0.02, u * 0.36);
        ctx.fillStyle = '#2f7a3a'; ctx.fillRect(-u * 0.14, -u * 0.46, u * 0.28, u * 0.12);
        ctx.fillStyle = '#f4f4f0'; ctx.fillRect(-u * 0.11, -u * 0.42, u * 0.22, u * 0.02); ctx.fillRect(-u * 0.11, -u * 0.38, u * 0.14, u * 0.02);
        break;
      case 'tumbleweed': {
        const rr = u * 0.1, sp = t * 0.15;
        ctx.strokeStyle = '#a0784a'; ctx.lineWidth = Math.max(1, u * 0.012);
        ctx.beginPath(); ctx.arc(0, -rr, rr, 0, Math.PI * 2); ctx.stroke();
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(0, -rr, rr * (0.3 + k * 0.17), sp + k, sp + k + 2.4); ctx.stroke(); }
        break;
      }
      case 'crates': {
        // 走私卡車丟下來的一整排木箱（整條路，要跳）
        const w = u * 1.25, n = 7;
        for (let k = 0; k < n; k++) {
          const bx = -w + k * (2 * w / n);
          ctx.fillStyle = k % 2 ? '#a0703a' : '#8a5a2a';
          ctx.fillRect(bx + 1, -u * 0.13, 2 * w / n - 2, u * 0.13);
          ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = Math.max(1, u * 0.008);
          ctx.beginPath(); ctx.moveTo(bx + 2, -u * 0.13); ctx.lineTo(bx + 2 * w / n - 2, 0); ctx.stroke();
        }
        break;
      }
      case 'roadblock': {
        // 終點：警察的路障＋被攔下來的走私卡車
        const w = u * 1.1;
        for (let k = 0; k < 8; k++) { ctx.fillStyle = k % 2 ? '#d8262c' : '#f4f4f0'; ctx.fillRect(-w + k * (w / 4), -u * 0.16, w / 4, u * 0.06); }
        ctx.fillStyle = '#5a5a60'; ctx.fillRect(-w, -u * 0.1, u * 0.03, u * 0.1); ctx.fillRect(w - u * 0.03, -u * 0.1, u * 0.03, u * 0.1);
        ctx.fillStyle = '#4a5a6a'; ctx.fillRect(-u * 0.3, -u * 0.62, u * 0.6, u * 0.4);
        ctx.fillStyle = '#e8e0d0'; ctx.fillRect(-u * 0.24, -u * 0.74, u * 0.48, u * 0.14);
        ctx.fillStyle = Math.floor(t / 10) % 2 ? '#2a6ae8' : '#e8262c';
        ctx.beginPath(); ctx.arc(-w * 0.8, -u * 0.22, u * 0.04, 0, Math.PI * 2); ctx.arc(w * 0.8, -u * 0.22, u * 0.04, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'seawall':
        ctx.fillStyle = '#d8d0bc'; ctx.fillRect(-u * 0.12, -u * 0.14, u * 0.24, u * 0.14);
        break;
      case 'spray': {
        const ph = (t * 0.2) % 1;
        ctx.fillStyle = 'rgba(240, 250, 255, 0.85)';
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc((k - 1.5) * u * 0.08, -u * (0.2 + ph * 0.3 + k * 0.05), u * 0.06, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case 'house': {
        const cols = ['#e8a87a', '#8ac8c8', '#e88aa0', '#f2d08a', '#a8b8e8'];
        ctx.fillStyle = cols[o.col || 0]; ctx.fillRect(-u * 0.45, -u * 0.8, u * 0.9, u * 0.8);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (let k = 0; k < 3; k++) ctx.fillRect(-u * 0.38 + k * u * 0.28, -u * 0.62, u * 0.14, u * 0.2);
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-u * 0.42, -u * 0.36, u * 0.84, u * 0.04);
        break;
      }
      case 'lamp':
        ctx.fillStyle = '#3a3a40'; ctx.fillRect(-u * 0.015, -u * 0.6, u * 0.03, u * 0.6);
        ctx.fillStyle = '#ffe8a0'; ctx.beginPath(); ctx.arc(0, -u * 0.62, u * 0.04, 0, Math.PI * 2); ctx.fill();
        break;
      case 'finish': {
        const w = u * 1.1;
        ctx.fillStyle = '#2a2a30'; ctx.fillRect(-w - u * 0.03, -u * 0.7, u * 0.04, u * 0.7); ctx.fillRect(w, -u * 0.7, u * 0.04, u * 0.7);
        for (let k = 0; k < 16; k++) for (let j = 0; j < 2; j++) {
          ctx.fillStyle = (k + j) % 2 ? '#16161c' : '#f4f4f0';
          ctx.fillRect(-w + k * (2 * w / 16), -u * 0.7 + j * u * 0.06, 2 * w / 16 + 0.5, u * 0.06);
        }
        break;
      }
      // ── 障礙 ──
      case 'pothole':
        ctx.fillStyle = 'rgba(40, 40, 46, 0.9)';
        ctx.beginPath(); ctx.ellipse(0, -u * 0.02, u * 0.24, u * 0.05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(120, 180, 220, 0.6)';
        ctx.beginPath(); ctx.ellipse(0, -u * 0.025, u * 0.16, u * 0.03, 0, 0, Math.PI * 2); ctx.fill();
        break;
      case 'cone':
        ctx.fillStyle = '#f07a20';
        ctx.beginPath(); ctx.moveTo(-u * 0.1, 0); ctx.lineTo(0, -u * 0.3); ctx.lineTo(u * 0.1, 0); ctx.fill();
        ctx.fillStyle = '#f4f4f0'; ctx.fillRect(-u * 0.06, -u * 0.16, u * 0.12, u * 0.04);
        break;
      case 'cart':
        // 路邊小販的水果推車
        ctx.fillStyle = '#8a5a2a'; ctx.fillRect(-u * 0.22, -u * 0.26, u * 0.44, u * 0.18);
        ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.arc(-u * 0.1, -u * 0.28, u * 0.06, 0, Math.PI * 2); ctx.arc(u * 0.06, -u * 0.29, u * 0.06, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e04a3a'; ctx.beginPath(); ctx.arc(-u * 0.02, -u * 0.33, u * 0.06, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1e1e22'; ctx.beginPath(); ctx.arc(-u * 0.15, -u * 0.05, u * 0.05, 0, Math.PI * 2); ctx.arc(u * 0.15, -u * 0.05, u * 0.05, 0, Math.PI * 2); ctx.fill();
        break;
      case 'wave': {
        // 整條路被打上來的浪蓋住（白浪）
        const w = u * 1.3;
        ctx.fillStyle = 'rgba(80, 160, 210, 0.85)';
        ctx.fillRect(-w, -u * 0.14, w * 2, u * 0.14);
        ctx.fillStyle = 'rgba(245, 252, 255, 0.95)';
        for (let k = 0; k < 12; k++) { ctx.beginPath(); ctx.arc(-w + (k + 0.5) * (2 * w / 12), -u * 0.14 + Math.sin(t * 0.3 + k) * u * 0.01, w / 12, Math.PI, 0); ctx.fill(); }
        break;
      }
      case 'rock':
        ctx.fillStyle = '#8a6a52';
        ctx.beginPath(); ctx.moveTo(-u * 0.21, 0); ctx.lineTo(-u * 0.16, -u * 0.26); ctx.lineTo(u * 0.04, -u * 0.34); ctx.lineTo(u * 0.21, -u * 0.18); ctx.lineTo(u * 0.2, 0); ctx.fill();
        ctx.fillStyle = 'rgba(60, 120, 60, 0.7)'; ctx.fillRect(-u * 0.16, -u * 0.28, u * 0.16, u * 0.04);
        break;
      case 'coin': {
        const r = Math.max(2, u * 0.07), sq = Math.abs(Math.cos(t * 0.1));
        ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.ellipse(0, -u * 0.18, r * sq + 0.5, r, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff2a0'; ctx.beginPath(); ctx.ellipse(-r * 0.2 * sq, -u * 0.2, r * 0.3 * sq + 0.3, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'car': {
        // 路上的老爺車（從後面看）
        const cols = ['#58b8c8', '#e8a040', '#d85a6a', '#8ac060'];
        const w = u * 0.23;
        ctx.fillStyle = cols[o.col || 0];
        ctx.fillRect(-w, -u * 0.2, w * 2, u * 0.16);
        ctx.fillRect(-w * 0.7, -u * 0.3, w * 1.4, u * 0.1);
        ctx.fillStyle = 'rgba(180, 220, 240, 0.8)'; ctx.fillRect(-w * 0.6, -u * 0.28, w * 1.2, u * 0.06);
        ctx.fillStyle = '#e8262c'; ctx.fillRect(-w, -u * 0.16, w * 0.2, u * 0.05); ctx.fillRect(w * 0.8, -u * 0.16, w * 0.2, u * 0.05);
        ctx.fillStyle = '#1e1e22'; ctx.fillRect(-w * 0.95, -u * 0.05, w * 0.4, u * 0.05); ctx.fillRect(w * 0.55, -u * 0.05, w * 0.4, u * 0.05);
        break;
      }
    }
    ctx.restore();
  }

  /** 玩家：古巴是從後面看的粉紅老爺車（尾鰭＋紅尾燈）；墨西哥是黑白的警車（車頂警示燈一閃一閃） */
  function drawPlayer(ctx, pl, rs, p, W, H, t) {
    const x = W / 2, y = H - 40 - rs.hop;
    ctx.save();
    if (rs.invuln > 0 && Math.floor(rs.invuln / 5) % 2 === 0) ctx.globalAlpha = 0.45;
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x, H - 34, 70 - Math.min(30, rs.hop * 0.3), 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(x, y);
    ctx.rotate(rs.tilt * 0.06);
    const bounce = rs.hop > 0 ? 0 : Math.sin(t * 0.5) * 0.8 * (rs.speed / pl.maxSpeed);
    ctx.translate(0, bounce);
    if (pl.theme === 'car') {
      ctx.fillStyle = '#e87aa0';
      ctx.fillRect(-64, -40, 128, 30);
      ctx.beginPath(); ctx.moveTo(-64, -40); ctx.lineTo(-58, -58); ctx.lineTo(-50, -40); ctx.fill();     // 尾鰭
      ctx.beginPath(); ctx.moveTo(64, -40); ctx.lineTo(58, -58); ctx.lineTo(50, -40); ctx.fill();
      ctx.fillStyle = '#f4f0e8'; ctx.fillRect(-64, -24, 128, 4);
      ctx.fillStyle = '#d8262c'; ctx.fillRect(-62, -36, 14, 8); ctx.fillRect(48, -36, 14, 8);           // 尾燈
      ctx.fillStyle = '#c8c8d0'; ctx.fillRect(-66, -14, 132, 6);                                          // 保險桿
      ctx.fillStyle = '#f2c230'; ctx.fillRect(-12, -22, 24, 8);                                           // 車牌
      ctx.fillStyle = '#1e1e22'; ctx.fillRect(-60, -10, 26, 12); ctx.fillRect(34, -10, 26, 12);          // 輪胎
      // 坐在車上的你（條紋衫的背影）
      for (let k = 0; k < 3; k++) { ctx.fillStyle = k % 2 ? '#f4f4f0' : '#2a4a8a'; ctx.fillRect(-12, -60 + k * 7, 24, 7); }
      ctx.fillStyle = '#6a4a30'; ctx.beginPath(); ctx.arc(0, -68, 10, 0, Math.PI * 2); ctx.fill();
      // 排氣管的煙
      ctx.fillStyle = 'rgba(160, 160, 170, 0.5)';
      for (let k = 0; k < 3; k++) { const ph = (t * 0.4 + k * 6) % 18; ctx.beginPath(); ctx.arc(-40 - ph * 0.5, -6 + ph * 1.2, 3 + ph * 0.3, 0, Math.PI * 2); ctx.fill(); }
    } else {
      // 警車：黑色車身、白色車門，車頂紅藍警示燈
      ctx.fillStyle = '#1e1e24'; ctx.fillRect(-62, -40, 124, 32);
      ctx.fillStyle = '#f4f4f0'; ctx.fillRect(-62, -30, 124, 12);
      ctx.fillStyle = '#1e1e24'; ctx.fillRect(-44, -60, 88, 22);
      ctx.fillStyle = 'rgba(180, 220, 240, 0.8)'; ctx.fillRect(-38, -56, 76, 14);
      const on = Math.floor(t / 8) % 2;
      ctx.fillStyle = on ? '#e8262c' : '#5a1a1a'; ctx.fillRect(-26, -68, 24, 8);
      ctx.fillStyle = on ? '#1a2a5a' : '#2a6ae8'; ctx.fillRect(2, -68, 24, 8);
      ctx.fillStyle = on ? 'rgba(232, 38, 44, 0.25)' : 'rgba(42, 106, 232, 0.25)';
      ctx.beginPath(); ctx.arc(on ? -14 : 14, -64, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8262c'; ctx.fillRect(-60, -38, 12, 7); ctx.fillRect(48, -38, 12, 7);
      ctx.fillStyle = '#c8c8d0'; ctx.fillRect(-64, -12, 128, 5);
      ctx.fillStyle = '#16161c'; ctx.fillRect(-58, -8, 24, 10); ctx.fillRect(34, -8, 24, 10);
      ctx.fillStyle = '#f2c230'; ctx.fillRect(-16, -27, 32, 6);              // 「POLICÍA」字條
      ctx.fillStyle = '#6a4a30'; ctx.beginPath(); ctx.arc(0, -50, 8, 0, Math.PI * 2); ctx.fill();   // 開車的你（從後窗看得到頭）
      // 揚起的沙塵
      ctx.fillStyle = 'rgba(220, 180, 130, 0.5)';
      for (let k = 0; k < 3; k++) { const ph = (t * 0.5 + k * 6) % 18; ctx.beginPath(); ctx.arc((k - 1) * 50, -2 + ph * 0.4, 4 + ph * 0.5, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  function draw(ctx, state, t, W, H) {
    if (state.def.race.view === 'top') { TopRace.draw(ctx, state, t, W, H); return; }
    const def = state.def, pl = def.race, rs = state.race, th = THEME[pl.theme];
    drawBackdrop(ctx, pl, rs, t, W, H);
    const base = segAt(pl, rs.pos);
    const basePct = (rs.pos % SEG) / SEG;
    const playerSeg = segAt(pl, rs.pos + PLAYER_Z);
    const playerPct = ((rs.pos + PLAYER_Z) % SEG) / SEG;
    const playerY = playerSeg.y1 + (playerSeg.y2 - playerSeg.y1) * playerPct;
    const camX = rs.x * ROAD_W, camY = CAM_H + playerY;
    let maxy = H, x = 0, dx = -(base.curve * basePct);
    const drawn = [];
    for (let n = 0; n < DRAW; n++) {
      const i = base.i + n;
      if (i >= pl.total) break;
      const s = pl.segs[i];
      const p1 = { x: x, y: s.y1, z: i * SEG }, p2 = { x: x + dx, y: s.y2, z: (i + 1) * SEG };
      project(p1, camX, camY, rs.pos, W, H);
      project(p2, camX, camY, rs.pos, W, H);
      x += dx; dx += s.curve;
      s.clip = maxy;
      s.p1 = p1;
      drawn.push(s);
      if (p1.z - rs.pos <= CAM_DEPTH || p2.sy >= maxy || p2.sy >= p1.sy) continue;
      const alt = Math.floor(i / 3) % 2;
      ctx.fillStyle = alt ? th.ground1 : th.ground2;
      ctx.fillRect(0, p2.sy, W, p1.sy - p2.sy);
      const r1 = p1.sw / 8, r2 = p2.sw / 8;
      quad(ctx, p1.sx, p1.sy, p1.sw + r1, p2.sx, p2.sy, p2.sw + r2, alt ? th.rumble1 : th.rumble2);
      quad(ctx, p1.sx, p1.sy, p1.sw, p2.sx, p2.sy, p2.sw, alt ? th.road1 : th.road2);
      if (th.lane && alt) {
        const l1 = p1.sw / 40, l2 = p2.sw / 40;
        [-0.31, 0.31].forEach(function (k) { quad(ctx, p1.sx + p1.sw * k * 2, p1.sy, l1, p2.sx + p2.sw * k * 2, p2.sy, l2, th.lane); });
      }
      if (i === pl.finish) {
        for (let k = 0; k < 10; k++) quad(ctx, p1.sx - p1.sw + (k + 0.5) * p1.sw / 5, p1.sy, p1.sw / 10, p2.sx - p2.sw + (k + 0.5) * p2.sw / 5, p2.sy, p2.sw / 10, k % 2 ? '#16161c' : '#f4f4f0');
      }
      maxy = p1.sy;
    }
    // 由遠到近畫路邊的東西、障礙、金幣、車
    for (let n = drawn.length - 1; n >= 1; n--) {
      const s = drawn[n];
      if (!s.p1 || s.p1.z - rs.pos <= CAM_DEPTH * 2) continue;
      const sc = s.p1.scale;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, s.clip); ctx.clip();
      s.sprites.forEach(function (o) { drawSprite(ctx, o.kind, s.p1.sx + sc * o.x * ROAD_W * W / 2, s.p1.sy, sc, W, o, t); });
      s.obs.forEach(function (o) { drawSprite(ctx, o.kind, s.p1.sx + sc * o.x * ROAD_W * W / 2, s.p1.sy, sc, W, o, t); });
      s.coins.forEach(function (c) {
        if (rs.coinsTaken[c.seg + ':' + c.x]) return;
        drawSprite(ctx, 'coin', s.p1.sx + sc * c.x * ROAD_W * W / 2, s.p1.sy, sc, W, c, t);
      });
      if (state.equip && !state.equip.taken && s.i === rs.equipSeg) {
        const ex = s.p1.sx + sc * rs.equipX * ROAD_W * W / 2, u = sc * ROAD_W * W / 2;
        ctx.fillStyle = 'rgba(255, 230, 140, 0.4)'; ctx.beginPath(); ctx.arc(ex, s.p1.sy - u * 0.3, u * 0.16, 0, Math.PI * 2); ctx.fill();
        Sprites.equipIcon(ctx, state.equip.id, ex, s.p1.sy - u * 0.3, Math.max(0.2, u / 140));
      }
      rs.cars.forEach(function (c) {
        const ci = Math.floor(c.z / SEG);
        if (ci === s.i) drawSprite(ctx, 'car', s.p1.sx + sc * c.x * ROAD_W * W / 2, s.p1.sy, sc, W, c, t);
      });
      ctx.restore();
    }
    drawPlayer(ctx, pl, rs, state.player, W, H, t);
    // 速度線（越快越多）
    const k = rs.speed / pl.maxSpeed;
    if (k > 0.8) {
      ctx.strokeStyle = 'rgba(255, 255, 255, ' + ((k - 0.8) * 1.5).toFixed(2) + ')'; ctx.lineWidth = 2;
      for (let j = 0; j < 8; j++) {
        const a = (j * 0.8 + t * 0.07) % (Math.PI * 2), r0 = 260 + ((t * 9 + j * 37) % 120);
        ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0 * 0.6); ctx.lineTo(W / 2 + Math.cos(a) * (r0 + 40), H / 2 + Math.sin(a) * (r0 + 40) * 0.6); ctx.stroke();
      }
    }
    // 右邊的進度條（離終點多遠）
    const prog = U.clamp((rs.pos + PLAYER_Z) / (pl.finish * SEG), 0, 1);
    ctx.fillStyle = 'rgba(14, 18, 32, 0.55)'; U.roundRect(ctx, W - 26, 60, 12, H - 120, 6); ctx.fill();
    ctx.fillStyle = '#ffd166'; U.roundRect(ctx, W - 26, 60 + (H - 120) * (1 - prog), 12, (H - 120) * prog, 6); ctx.fill();
    U.text(ctx, '終點', W - 20, 50, { size: 11, color: '#ffffff' });
  }

  return {
    plan: plan,
    makeState: makeState,
    update: update,
    draw: draw,
    segAt: segAt,
    SEG: SEG,
    PLAYER_Z: PLAYER_Z,
    PLAYER_W: PLAYER_W,
    LANES: LANES,
    HOP_V: HOP_V,
    HOP_CLEAR: HOP_CLEAR,
    HOP_G: HOP_G
  };
})();
