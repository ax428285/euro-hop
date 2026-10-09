'use strict';

/**
 * 上帝視角的賽車關（v1.31 玩家：古巴改成上帝視角賽車關卡，附參考圖）。
 *
 * 從正上方往下看：車子固定在畫面下方，馬路一路往下捲（車子往畫面上方開），馬路會左彎右彎。
 *   古巴・哈瓦那的馬雷貢海濱大道：左邊是海和海堤、右邊是人行道和彩色老房子的屋頂。
 *   ←→ 轉向，車子自己往前開；開上路邊的紅白路緣會變慢，海堤、房子撞不過去。
 *   路上：慢吞吞的老爺車（同方向、比你慢）、坑洞、三角錐、水果推車 —— 撞到扣一顆愛心、速度掉一大截。
 *   大浪（參考圖裡兩旁噴火的那種「旁邊打過來」的危險）：海堤先冒水花預告，接著浪從左邊打上路面，
 *   蓋住左邊三分之二的馬路 —— 要趕快開到最右邊的車道。
 *
 * 座標：世界 y 往前開是增加；畫面上 sy = PLAYER_SY − (y − d)（d = 車子跑了多遠）。
 * 由 race.js 轉發（def.race.view === 'top'），對外介面跟 Race 一樣：plan / makeState / update / draw。
 * 載入順序：race.js 之前（levels.js 定義關卡時就要 plan）。
 */
const TopRace = (function () {

  const RW = 150;                 // 馬路的半寬（三線道，每線 100）
  const LANE = 100;
  const LANES = [-LANE, 0, LANE];
  const PLAYER_SY = 380;          // 車子在畫面上的位置（下方）
  const CAR_W = 32, CAR_H = 58;
  const INVULN = 90;
  const WAVE_WARN = 54, WAVE_HIT = 44, WAVE_LEN = 460;
  const STEP = 20;                // 馬路中心線每 STEP px 記一個點

  function rng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  // ── 規劃 ────────────────────────────────────────────────

  /**
   * cfg.length：整條路多長（px）；cfg.bends：[長度, 往右偏多少] 一段段的彎（緩入緩出）
   */
  function plan(cfg) {
    const r = rng(cfg.seed || 1);
    const L = cfg.length || 24000;
    const n = Math.ceil(L / STEP) + 60;
    const cx = new Float32Array(n);
    let x = 480, i = 0;
    (cfg.bends || []).forEach(function (b) {
      const steps = Math.round(b[0] / STEP), x0 = x;
      for (let k = 0; k < steps && i < n; k++, i++) {
        const q = k / Math.max(1, steps - 1);
        cx[i] = x0 + b[1] * (0.5 - Math.cos(q * Math.PI) / 2);
      }
      x = x0 + b[1];
    });
    for (; i < n; i++) cx[i] = x;
    for (let k = 0; k < n; k++) cx[k] = Math.max(RW + 110, Math.min(960 - RW - 140, cx[k]));
    const START = 700, END = L - 900;
    const finish = L - 300;
    // 障礙
    const kinds = [{ kind: 'pothole', w: 46, h: 34 }, { kind: 'cone', w: 24, h: 24 }, { kind: 'cart', w: 46, h: 62 }];
    const obs = [];
    const waves = (cfg.waves || []).map(function (k) { return Math.round(START + (END - START) * k); });
    const nearWave = function (y) { return waves.some(function (w) { return y > w - 420 && y < w + WAVE_LEN + 160; }); };
    for (let y = START; y < END; y += (cfg.obsEvery || 300) + Math.floor(r() * 140)) {
      if (nearWave(y)) continue;
      const o = kinds[Math.floor(r() * kinds.length)];
      obs.push({ y: y, lx: LANES[Math.floor(r() * 3)], kind: o.kind, w: o.w, h: o.h });
    }
    // 金幣：一排 5 枚，放在前後都沒有障礙的車道
    const coins = [];
    for (let y = START + 200; y < END - 200; y += 620 + Math.floor(r() * 200)) {
      let lx = LANES[Math.floor(r() * 3)];
      // v1.31.4 玩家：古巴的金幣很難全收 —— 有一排剛好放在大浪會打到的地方（靠海那邊、中線）。
      // 浪打過來的那一段，金幣一律放在最右邊（靠房子那側）的車道，浪打不到
      if (nearWave(y) || nearWave(y + 280)) lx = LANES[2];
      if (obs.some(function (o) { return Math.abs(o.lx - lx) < 60 && o.y > y - 120 && o.y < y + 420; })) continue;
      for (let k = 0; k < 5; k++) coins.push({ y: y + k * 70, lx: lx });
    }
    // 路邊：棕櫚樹、路燈、房子（顏色）
    const deco = [];
    for (let y = 0; y < L + 600; y += 160) deco.push({ y: y + Math.floor(r() * 60), kind: r() < 0.6 ? 'palm' : 'lamp' });
    const houses = [];
    for (let y = -400, k = 0; y < L + 800; k++) { const h = 120 + Math.floor(r() * 80); houses.push({ y: y, h: h, col: Math.floor(r() * 5) }); y += h + 6; }
    return { view: 'top', theme: cfg.theme || 'car', cx: cx, length: L, finish: finish, obs: obs, coins: coins, waves: waves,
             deco: deco, houses: houses, traffic: cfg.traffic || 0, maxSpeed: cfg.maxSpeed || 7, seed: cfg.seed || 1 };
  }

  function centerAt(pl, y) {
    const f = Math.max(0, y) / STEP, i = Math.min(pl.cx.length - 2, Math.floor(f)), k = f - i;
    return pl.cx[i] * (1 - k) + pl.cx[i + 1] * k;
  }

  // ── 執行期 ──────────────────────────────────────────────

  function makeState(def) {
    const pl = def.race;
    const r = rng(pl.seed + 9);
    const cars = [];
    for (let k = 0; k < pl.traffic; k++) {
      cars.push({ y: 900 + k * (pl.length - 1600) / Math.max(1, pl.traffic), lx: LANES[Math.floor(r() * 3)],
                  speed: pl.maxSpeed * (0.42 + r() * 0.16), col: Math.floor(r() * 4) });
    }
    return {
      top: true, d: 0, x: centerAt(pl, 0), speed: 0, vx: 0, invuln: 0, tilt: 0,
      cars: cars, coinsTaken: {}, done: false, seen: {},
      waves: pl.waves.map(function (y) { return { y: y, state: 'idle', t: 0 }; }),
      equipY: pl.finish - 420
    };
  }

  /** 這一道浪現在蓋住的範圍（世界座標；沒有在打就回 null） */
  function waveBox(pl, w) {
    if (w.state !== 'hit') return null;
    const c = centerAt(pl, w.y + WAVE_LEN / 2);
    return { x: 0, y: w.y, w: c + 30, h: WAVE_LEN };          // 從海那邊一直蓋到中線右邊一點
  }

  function rectHit(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  function update(state, input, t) {
    const events = [];
    const pl = state.def.race, rs = state.race, p = state.player, st = p.stats || {};
    if (rs.done) return events;
    const top = pl.maxSpeed * Math.min(1.15, st.speed || 1);
    const c = centerAt(pl, rs.d);
    const off = rs.x - c;
    const curb = Math.abs(off) > RW - 14;
    const limit = curb ? top * 0.55 : top;
    if (rs.speed < limit) rs.speed = Math.min(limit, rs.speed + top * 0.02);
    else rs.speed = Math.max(limit, rs.speed - top * 0.05);
    // 轉向：方向盤有一點慣性（不是瞬間橫移）
    let dir = 0;
    if (input.isDown('left')) dir -= 1;
    if (input.isDown('right')) dir += 1;
    rs.vx += (dir * 5.4 - rs.vx) * 0.25;
    rs.x += rs.vx;
    rs.tilt += (dir - rs.tilt) * 0.2;
    p.facing = dir || p.facing || 1;
    // 左邊是海堤、右邊是房子：撞不過去
    const minX = c - RW - 18, maxX = c + RW + 64;
    if (rs.x < minX) { rs.x = minX; rs.vx = 0; }
    if (rs.x > maxX) { rs.x = maxX; rs.vx = 0; }
    rs.d += rs.speed;
    if (rs.invuln > 0) rs.invuln--;
    p.invuln = rs.invuln;
    const me = { x: rs.x - CAR_W / 2 + 3, y: rs.d - CAR_H / 2 + 4, w: CAR_W - 6, h: CAR_H - 8 };
    // 車流
    rs.cars.forEach(function (car) {
      car.y += car.speed;
      if (car.y > pl.length - 500) car.y = rs.d - 400;           // 開過頭的車繞回後面（不會擋在終點）
      if (rs.invuln > 0) return;
      const box = { x: centerAt(pl, car.y) + car.lx - 17, y: car.y - 30, w: 34, h: 60 };
      if (rectHit(me, box)) {
        rs.invuln = INVULN; rs.speed = Math.min(rs.speed, car.speed * 0.5);
        rs.vx = (rs.x < box.x + 17 ? -1 : 1) * 6;
        events.push('p0:hurt');
      }
    });
    // 障礙
    pl.obs.forEach(function (o) {
      if (rs.invuln > 0 || o.y < rs.d - 80 || o.y > rs.d + 80) return;
      const box = { x: centerAt(pl, o.y) + o.lx - o.w / 2, y: o.y - o.h / 2, w: o.w, h: o.h };
      if (rectHit(me, box)) {
        rs.invuln = INVULN; rs.speed *= 0.4;
        rs.vx = (rs.x < box.x + o.w / 2 ? -1 : 1) * 6;
        events.push('p0:hurt');
      }
    });
    // 大浪
    rs.waves.forEach(function (w) {
      if (w.state === 'idle' && rs.d > w.y - 360) {
        w.state = 'warn'; w.t = WAVE_WARN;
        events.push('waveWarn');
        if (!rs.seen.wave) { rs.seen.wave = true; events.push('feature:topwave'); }
      } else if (w.state === 'warn' && --w.t <= 0) {
        w.state = 'hit'; w.t = WAVE_HIT;
      } else if (w.state === 'hit') {
        const box = waveBox(pl, w);
        if (rs.invuln <= 0 && rectHit(me, box)) {
          rs.invuln = INVULN; rs.speed *= 0.4; rs.vx = 6; events.push('p0:hurt');
        }
        if (--w.t <= 0) w.state = 'done';
      }
    });
    // 金幣
    pl.coins.forEach(function (cn, i) {
      if (rs.coinsTaken[i] || cn.y < rs.d - 60 || cn.y > rs.d + 60) return;
      const cx = centerAt(pl, cn.y) + cn.lx;
      if (Math.abs(cx - rs.x) < 30 && Math.abs(cn.y - rs.d) < 40) { rs.coinsTaken[i] = true; state.coinsGot++; events.push('coin'); }
    });
    // 這關的裝備：終點前漂浮在中線
    if (state.equip && !state.equip.taken && Math.abs(rs.d - rs.equipY) < 40 && Math.abs(rs.x - centerAt(pl, rs.equipY)) < 40) {
      state.equip.taken = true;
      events.push('equip');
    }
    if (rs.d >= pl.finish) { rs.done = true; state.cleared = true; events.push('clear'); }
    return events;
  }

  // ── 繪製 ────────────────────────────────────────────────

  const HOUSE_COLS = ['#e8a87a', '#8ac8c8', '#e88aa0', '#f2d08a', '#a8b8e8'];
  const CAR_COLS = ['#58b8c8', '#e8a040', '#d85a6a', '#8ac060'];

  /** 從正上方看的老爺車（長長的車身、尾鰭、前面兩顆大燈） */
  function drawCar(ctx, x, y, col, tilt, me) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((tilt || 0) * 0.14);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'; U.roundRect(ctx, -CAR_W / 2 + 3, -CAR_H / 2 + 5, CAR_W, CAR_H, 9); ctx.fill();
    ctx.fillStyle = col; U.roundRect(ctx, -CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H, 9); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-CAR_W / 2, CAR_H / 2 - 12); ctx.lineTo(-CAR_W / 2 - 4, CAR_H / 2 + 2); ctx.lineTo(-CAR_W / 2 + 6, CAR_H / 2 - 2); ctx.fill();   // 尾鰭
    ctx.beginPath(); ctx.moveTo(CAR_W / 2, CAR_H / 2 - 12); ctx.lineTo(CAR_W / 2 + 4, CAR_H / 2 + 2); ctx.lineTo(CAR_W / 2 - 6, CAR_H / 2 - 2); ctx.fill();
    ctx.fillStyle = 'rgba(190, 230, 250, 0.85)'; ctx.fillRect(-CAR_W / 2 + 5, -CAR_H / 2 + 12, CAR_W - 10, 9);   // 擋風玻璃
    ctx.fillStyle = me ? '#f4f0e8' : 'rgba(255,255,255,0.7)'; ctx.fillRect(-CAR_W / 2 + 6, -4, CAR_W - 12, 14);    // 白色車頂（敞篷車就是座位）
    if (me) {
      ctx.fillStyle = '#6a4a30'; ctx.beginPath(); ctx.arc(-4, 0, 5, 0, Math.PI * 2); ctx.fill();                   // 開車的你
      ctx.fillStyle = '#2a4a8a'; ctx.fillRect(-9, 4, 10, 6);
    }
    ctx.fillStyle = '#ffe9a0'; ctx.fillRect(-CAR_W / 2 + 3, -CAR_H / 2, 6, 3); ctx.fillRect(CAR_W / 2 - 9, -CAR_H / 2, 6, 3);
    ctx.fillStyle = '#d8262c'; ctx.fillRect(-CAR_W / 2 + 3, CAR_H / 2 - 3, 6, 3); ctx.fillRect(CAR_W / 2 - 9, CAR_H / 2 - 3, 6, 3);
    ctx.fillStyle = '#c8c8d0'; ctx.fillRect(-CAR_W / 2 + 2, -CAR_H / 2 - 1, CAR_W - 4, 2); ctx.fillRect(-CAR_W / 2 + 2, CAR_H / 2 - 1, CAR_W - 4, 2);
    ctx.restore();
  }

  function draw(ctx, state, t, W, H) {
    const pl = state.def.race, rs = state.race;
    const d = rs.d;
    const wy = function (sy) { return d + (PLAYER_SY - sy); };      // 畫面 y → 世界 y
    const sy = function (y) { return PLAYER_SY - (y - d); };        // 世界 y → 畫面 y
    // 一條一條橫的畫：海、海堤、路緣、馬路、人行道、房子
    const SH = 8;
    for (let y0 = -SH; y0 < H + SH; y0 += SH) {
      const yw = wy(y0), c = centerAt(pl, yw);
      const L = c - RW, R = c + RW;
      ctx.fillStyle = '#3a8ab8'; ctx.fillRect(0, y0, L - 30, SH + 1);                         // 海
      ctx.fillStyle = '#d8d0bc'; ctx.fillRect(L - 30, y0, 22, SH + 1);                        // 海堤
      ctx.fillStyle = Math.floor(yw / 40) % 2 ? '#f4f0e6' : '#c8402a'; ctx.fillRect(L - 8, y0, 8, SH + 1);   // 紅白路緣
      ctx.fillStyle = '#5a5a62'; ctx.fillRect(L, y0, RW * 2, SH + 1);                          // 馬路
      ctx.fillStyle = Math.floor(yw / 40) % 2 ? '#f4f0e6' : '#c8402a'; ctx.fillRect(R, y0, 8, SH + 1);
      ctx.fillStyle = '#d8c8a8'; ctx.fillRect(R + 8, y0, 70, SH + 1);                          // 人行道
      ctx.fillStyle = '#b8a888'; ctx.fillRect(R + 78, y0, W - R - 78, SH + 1);
      // 車道分隔線（虛線）
      if (Math.floor(yw / 36) % 2 === 0) {
        ctx.fillStyle = '#f4f0e6';
        ctx.fillRect(c - LANE / 2 - 2, y0, 4, SH + 1); ctx.fillRect(c + LANE / 2 - 2, y0, 4, SH + 1);
      }
    }
    // 海浪的白線
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    for (let k = 0; k < 10; k++) {
      const yw = Math.floor(wy(0) / 90) * 90 - k * 90, y = sy(yw), c = centerAt(pl, yw);
      ctx.beginPath(); ctx.moveTo(20 + (k % 3) * 30, y); ctx.quadraticCurveTo(60 + (k % 3) * 30, y - 6 + Math.sin(t * 0.05 + k) * 3, c - RW - 50, y); ctx.stroke();
    }
    // 房子的屋頂（從上面看：一塊塊彩色的長方形＋屋脊線）
    pl.houses.forEach(function (h) {
      const y1 = sy(h.y + h.h), y2 = sy(h.y);
      if (y2 < -10 || y1 > H + 10) return;
      const c = centerAt(pl, h.y + h.h / 2), x = c + RW + 92;
      ctx.fillStyle = HOUSE_COLS[h.col]; ctx.fillRect(x, y1, W - x, y2 - y1);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x, y1, 8, y2 - y1);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x + 20, (y1 + y2) / 2 - 2, W - x - 20, 4);
    });
    // 路邊：棕櫚樹、路燈
    pl.deco.forEach(function (o) {
      const y = sy(o.y);
      if (y < -40 || y > H + 40) return;
      const c = centerAt(pl, o.y), x = c + RW + 40;
      if (o.kind === 'palm') {
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(x + 6, y + 6, 22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3f8a3a';
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + 0.3; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 12, y + Math.sin(a) * 12, 14, 5, a, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#3a3a40'; ctx.fillRect(x - 2, y - 2, 4, 4);
        ctx.fillStyle = 'rgba(255, 233, 160, 0.5)'; ctx.beginPath(); ctx.arc(x - 12, y, 7, 0, Math.PI * 2); ctx.fill();
      }
    });
    // 終點線
    {
      const y = sy(pl.finish), c = centerAt(pl, pl.finish);
      if (y > -20 && y < H + 20) {
        for (let k = 0; k < 15; k++) for (let j = 0; j < 2; j++) {
          ctx.fillStyle = (k + j) % 2 ? '#16161c' : '#f4f4f0';
          ctx.fillRect(c - RW + k * (RW * 2 / 15), y - 10 + j * 10, RW * 2 / 15 + 0.5, 10);
        }
      }
    }
    // 大浪：預告 = 海堤上一排往上噴的水花；打上來 = 白浪蓋住左邊的馬路
    rs.waves.forEach(function (w) {
      const y1 = sy(w.y + WAVE_LEN), y2 = sy(w.y);
      if (y2 < -20 || y1 > H + 20) return;
      if (w.state === 'warn') {
        const k = 1 - w.t / WAVE_WARN;
        ctx.fillStyle = 'rgba(240, 250, 255, ' + (0.5 + k * 0.4).toFixed(2) + ')';
        for (let yy = y1; yy < y2; yy += 26) {
          const c = centerAt(pl, wy(yy));
          for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(c - RW - 20 + j * 8, yy + Math.sin(t * 0.4 + yy + j) * 4, 4 + k * 8, 0, Math.PI * 2); ctx.fill(); }
        }
        // 往右的箭頭：提醒「往右開」
        ctx.fillStyle = 'rgba(255, 210, 90, ' + (0.6 + Math.sin(t * 0.3) * 0.3).toFixed(2) + ')';
        const ay = Math.max(30, Math.min(H - 30, (y1 + y2) / 2)), ax = centerAt(pl, wy(ay)) + 40;
        ctx.beginPath(); ctx.moveTo(ax, ay - 14); ctx.lineTo(ax + 26, ay); ctx.lineTo(ax, ay + 14); ctx.closePath(); ctx.fill();
      } else if (w.state === 'hit') {
        const box = waveBox(pl, w);
        ctx.fillStyle = 'rgba(120, 190, 230, 0.75)';
        ctx.fillRect(0, y1, box.w, y2 - y1);
        ctx.fillStyle = 'rgba(245, 252, 255, 0.95)';
        for (let yy = y1; yy < y2; yy += 18) { ctx.beginPath(); ctx.arc(box.w + Math.sin(t * 0.3 + yy * 0.1) * 8, yy, 12, 0, Math.PI * 2); ctx.fill(); }
      }
    });
    // 障礙
    pl.obs.forEach(function (o) {
      const y = sy(o.y);
      if (y < -60 || y > H + 60) return;
      const x = centerAt(pl, o.y) + o.lx;
      /*
       * v1.31.8 玩家：古巴的障礙物各種看不懂 → 每一樣都畫得一看就知道是什麼，而且底下一圈紅色的警示影子（= 會撞到）：
       *   坑洞：馬路裂開的大洞（一圈碎裂的柏油、四周往外的裂痕、底下積水）
       *   三角錐：三個一組、從斜上方看得到尖頂和白色反光條
       *   水果攤車：木頭推車＋兩個輪子＋紅白條紋的遮陽棚，棚子底下露出一籃籃水果
       */
      ctx.fillStyle = 'rgba(230, 40, 40, ' + (0.18 + Math.abs(Math.sin(t * 0.08 + o.y)) * 0.12).toFixed(2) + ')';
      ctx.beginPath(); ctx.ellipse(x, y + 4, o.w / 2 + 12, o.h / 2 + 10, 0, 0, Math.PI * 2); ctx.fill();
      if (o.kind === 'pothole') {
        ctx.strokeStyle = '#1a1a20'; ctx.lineWidth = 2;
        for (let k = 0; k < 8; k++) {
          const a2 = k * Math.PI / 4 + 0.3, r1 = o.w / 2 - 2, r2 = o.w / 2 + 10 + (k % 3) * 4;
          ctx.beginPath(); ctx.moveTo(x + Math.cos(a2) * r1, y + Math.sin(a2) * r1 * 0.75);
          ctx.lineTo(x + Math.cos(a2 + 0.15) * (r1 + r2) / 2, y + Math.sin(a2 + 0.15) * (r1 + r2) / 2 * 0.75);
          ctx.lineTo(x + Math.cos(a2) * r2, y + Math.sin(a2) * r2 * 0.75); ctx.stroke();
        }
        ctx.fillStyle = '#6a6a72';
        ctx.beginPath();
        for (let k = 0; k < 12; k++) { const a2 = k * Math.PI / 6, r = (o.w / 2 + 3) * (k % 2 ? 0.92 : 1.05); ctx.lineTo(x + Math.cos(a2) * r, y + Math.sin(a2) * r * 0.75); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#121216'; ctx.beginPath(); ctx.ellipse(x, y + 2, o.w / 2 - 4, o.h / 2 - 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(110, 170, 210, 0.65)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 5, o.w / 3, o.h / 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; ctx.fillRect(x - 6, y + 3, 8, 1.6);
      } else if (o.kind === 'cone') {
        [[-11, 6], [11, 6], [0, -8]].forEach(function (q) {
          const cx = x + q[0], cy = y + q[1];
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; ctx.beginPath(); ctx.ellipse(cx + 3, cy + 7, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#1a1a1a'; ctx.fillRect(cx - 9, cy + 4, 18, 5);
          ctx.fillStyle = '#f06a10'; ctx.beginPath(); ctx.moveTo(cx - 7, cy + 5); ctx.lineTo(cx, cy - 14); ctx.lineTo(cx + 7, cy + 5); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(cx - 4.4, cy - 2); ctx.lineTo(cx + 4.4, cy - 2); ctx.lineTo(cx + 3.2, cy - 6); ctx.lineTo(cx - 3.2, cy - 6); ctx.closePath(); ctx.fill();
        });
      } else {
        const L = x - o.w / 2, T = y - o.h / 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'; ctx.fillRect(L + 5, T + 6, o.w, o.h);
        // 兩個輪子
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(L - 5, T + o.h * 0.55, 6, 16); ctx.fillRect(L + o.w - 1, T + o.h * 0.55, 6, 16);
        // 木頭車身＋一籃籃水果
        ctx.fillStyle = '#9a6a34'; ctx.fillRect(L, T + 8, o.w, o.h - 8);
        ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = 1.5;
        for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(L, T + 8 + k * (o.h - 8) / 4); ctx.lineTo(L + o.w, T + 8 + k * (o.h - 8) / 4); ctx.stroke(); }
        [['#f2c230', 0.25, 0.75], ['#e04a3a', 0.75, 0.75], ['#5aa040', 0.5, 0.9]].forEach(function (f) {
          ctx.fillStyle = f[0];
          for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(L + o.w * f[1] + (k - 1) * 5, T + o.h * f[2] - (k % 2) * 4, 4.5, 0, Math.PI * 2); ctx.fill(); }
        });
        // 推車的把手
        ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(L + 6, T + o.h); ctx.lineTo(L + 6, T + o.h + 10); ctx.lineTo(L + o.w - 6, T + o.h + 10); ctx.lineTo(L + o.w - 6, T + o.h); ctx.stroke();
        // 紅白條紋的遮陽棚（蓋住前半）
        for (let k = 0; k < 5; k++) {
          ctx.fillStyle = k % 2 ? '#f4f4f0' : '#d8302a';
          ctx.fillRect(L - 4 + k * (o.w + 8) / 5, T - 4, (o.w + 8) / 5 + 0.5, o.h * 0.5);
        }
        ctx.fillStyle = '#d8302a';
        for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(L - 4 + (k + 0.5) * (o.w + 8) / 5, T - 4 + o.h * 0.5, (o.w + 8) / 10, 0, Math.PI); ctx.fill(); }
      }
    });
    // 金幣
    pl.coins.forEach(function (cn, i) {
      if (rs.coinsTaken[i]) return;
      const y = sy(cn.y);
      if (y < -20 || y > H + 20) return;
      const x = centerAt(pl, cn.y) + cn.lx, sq = Math.abs(Math.cos(t * 0.1 + i));
      ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.ellipse(x, y, 11 * sq + 1, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff2a0'; ctx.beginPath(); ctx.ellipse(x - 2 * sq, y - 2, 4 * sq + 0.5, 5, 0, 0, Math.PI * 2); ctx.fill();
    });
    // 裝備
    if (state.equip && !state.equip.taken) {
      const y = sy(rs.equipY), x = centerAt(pl, rs.equipY);
      if (y > -30 && y < H + 30) {
        ctx.fillStyle = 'rgba(255, 230, 140, 0.4)'; ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
        Sprites.equipIcon(ctx, state.equip.id, x, y, 0.9);
      }
    }
    // 其他車
    rs.cars.forEach(function (car) {
      const y = sy(car.y);
      if (y < -60 || y > H + 60) return;
      drawCar(ctx, centerAt(pl, car.y) + car.lx, y, CAR_COLS[car.col], 0, false);
    });
    // 你的車
    ctx.save();
    if (rs.invuln > 0 && Math.floor(rs.invuln / 5) % 2 === 0) ctx.globalAlpha = 0.45;
    drawCar(ctx, rs.x, PLAYER_SY, '#e87aa0', rs.tilt, true);
    ctx.restore();
    // 排氣管的煙
    ctx.fillStyle = 'rgba(170, 170, 180, 0.45)';
    for (let k = 0; k < 3; k++) { const ph = (t * 0.6 + k * 7) % 21; ctx.beginPath(); ctx.arc(rs.x - 6 + Math.sin(k) * 4, PLAYER_SY + CAR_H / 2 + ph, 3 + ph * 0.25, 0, Math.PI * 2); ctx.fill(); }
    // 右邊的進度條
    const prog = U.clamp(rs.d / pl.finish, 0, 1);
    ctx.fillStyle = 'rgba(14, 18, 32, 0.55)'; U.roundRect(ctx, W - 26, 60, 12, H - 120, 6); ctx.fill();
    ctx.fillStyle = '#ffd166'; U.roundRect(ctx, W - 26, 60 + (H - 120) * (1 - prog), 12, (H - 120) * prog, 6); ctx.fill();
    U.text(ctx, '終點', W - 20, 50, { size: 11, color: '#ffffff' });
  }

  return {
    plan: plan, makeState: makeState, update: update, draw: draw,
    centerAt: centerAt, waveBox: waveBox,
    RW: RW, LANE: LANE, LANES: LANES, CAR_W: CAR_W, CAR_H: CAR_H, WAVE_LEN: WAVE_LEN, WAVE_WARN: WAVE_WARN, WAVE_HIT: WAVE_HIT
  };
})();
