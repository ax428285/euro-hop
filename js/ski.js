'use strict';

/**
 * 滑雪關（v1.31 玩家：塞爾維亞換成滑雪玩法）—— 塞爾維亞・科帕奧尼克滑雪場。
 *
 * 從側面看的下坡雪道：人自己往右下方滑，坡越陡滑越快；畫面跟著人捲。
 *   ↓ 按住 = 壓低身體（滑得更快，也鑽得過低低的纜車椅）
 *   ← 按住 = 犁式剎車（慢下來）
 *   跳躍   = 跳起來（跳過石頭、雪人、倒下的樹幹）
 *   跳台：衝上去會被拋到半空中，空中的金幣要靠跳台才拿得到。
 *   撞到障礙會摔一跤：扣一顆愛心、速度掉一大截。滑到山下的木屋就過關。
 *
 * 座標：世界 x 往右（下坡方向）、y 往下；地面高度存成 STEP 一格的陣列（gy）。
 * 由 race.js 轉發（def.race.view === 'ski'），對外介面跟 Race 一樣：plan / makeState / update / draw。
 * 載入順序：race.js 之前（levels.js 定義關卡時就要 plan）。
 */
const Ski = (function () {

  const STEP = 10;
  const G = 0.42;                 // 重力（空中）
  const JUMP_V = 7.6;             // 起跳的初速
  const STAND_H = 52, CROUCH_H = 30, SKIER_W = 26;
  const SCREEN_X = 260;           // 人在畫面上的 x
  const INVULN = 90;
  const MIN_V = 3, MAX_V = 10.5, TUCK_V = 12.5;
  const KICK_VY = -5.4;           // 跳台的上拋（再減掉速度 × 0.22）

  function rng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  /** 地面高度（關卡定義會經過 JSON 傳給連線的朋友，所以不放函式在 plan 裡） */
  function groundAt(pl, x) {
    const f = Math.max(0, x) / STEP, j = Math.min(pl.n - 2, Math.floor(f)), k = f - j;
    return pl.gy[j] * (1 - k) + pl.gy[j + 1] * k;
  }

  // ── 規劃 ────────────────────────────────────────────────

  /**
   * cfg.length：雪道多長（px）。坡度一段一段變（0.18 緩坡 ～ 0.5 陡坡），中間穿插跳台（短短一段上坡＋一個落差）。
   * 障礙：rock 石頭、snowman 雪人、log 倒下的樹幹（都要跳）、chair 低低的纜車椅（要壓低）。
   */
  function plan(cfg) {
    const r = rng(cfg.seed || 1);
    const L = cfg.length || 17000;
    const n = Math.ceil(L / STEP) + 120;
    const gy = new Float32Array(n);
    const kickers = [];
    let y = 200, i = 0;
    // 起點一小段平地（站在出發門）
    for (; i < 30; i++) gy[i] = y;
    let slope = 0.25;
    while (i < n) {
      const len = 50 + Math.floor(r() * 50);          // 一段 500～1000 px
      const target = 0.18 + r() * 0.3;
      for (let k = 0; k < len && i < n; k++, i++) {
        slope += (target - slope) * 0.04;
        y += slope * STEP;
        gy[i] = y;
      }
      // 跳台：14 格的上坡、接著直接落差 70（人會從唇口飛出去）
      const x = i * STEP;
      if (x > 1200 && x < L - 1600 && r() < 0.55) {
        for (let k = 0; k < 14 && i < n; k++, i++) { y -= 2.4 * (k / 14); gy[i] = y; }
        kickers.push({ x: i * STEP, y: y });
        y += 70;
        for (let k = 0; k < 6 && i < n; k++, i++) { y += slope * STEP; gy[i] = y; }
      }
    }
    const finish = L - 300;
    // 障礙：跳台附近（前 300、後 500）不放，免得落地就撞
    const nearKick = function (x) { return kickers.some(function (kk) { return x > kk.x - 320 && x < kk.x + 520; }); };
    const kinds = ['rock', 'snowman', 'log', 'rock', 'chair', 'log', 'chair', 'snowman'];
    const obs = [];
    for (let x = 900; x < finish - 700; x += (cfg.obsEvery || 520) + Math.floor(r() * 260)) {
      if (nearKick(x)) continue;
      const kind = kinds[Math.floor(r() * kinds.length)];
      const o = { x: x, kind: kind };
      if (kind === 'rock') { o.w = 34; o.h = 24; }
      else if (kind === 'snowman') { o.w = 28; o.h = 46; }
      else if (kind === 'log') { o.w = 56; o.h = 18; }
      else { o.w = 40; o.h = 0; o.low = true; }          // 纜車椅：底部在地上 38 的高度
      obs.push(o);
    }
    // 金幣：雪道上一排 4 枚（前後沒有障礙），每個跳台後面一道弧線 5 枚（飛過去才拿得到）
    const coins = [];
    for (let x = 700; x < finish - 600; x += 900 + Math.floor(r() * 300)) {
      if (nearKick(x) || obs.some(function (o) { return o.x > x - 160 && o.x < x + 260; })) continue;
      for (let k = 0; k < 4; k++) coins.push({ x: x + k * 50, h: 26 });
    }
    // 跳台後面的金幣：照「速度 11 飛出去」的拋物線放（離地高度 + 25 ≈ 身體中間；吃金幣的範圍上下有 70 多 px，快一點慢一點都吃得到）
    kickers.forEach(function (kk) {
      let x = kk.x, y = kk.y, vy = KICK_VY - 11 * 0.22;
      for (let f = 1; f <= 26; f++) {
        vy += G; x += 11; y += vy;
        const up = groundAt({ gy: gy, n: n }, x) - y;
        if (up < 4) break;                                  // 落地了
        if (f % 5 === 0) coins.push({ x: x, h: up + 25 });
      }
    });
    // 旗門（只是裝飾：紅藍輪流）、路邊的松樹
    const gates = [];
    for (let x = 600, k = 0; x < finish - 300; x += 700, k++) gates.push({ x: x, red: k % 2 === 0 });
    const trees = [];
    for (let x = -200; x < L + 600; x += 90 + Math.floor(r() * 120)) trees.push({ x: x, s: 0.7 + r() * 0.6, back: r() < 0.6 });
    return { view: 'ski', gy: gy, n: n, length: L, finish: finish, kickers: kickers,
             obs: obs, coins: coins, gates: gates, trees: trees, seed: cfg.seed || 1 };
  }

  // ── 執行期 ──────────────────────────────────────────────

  function makeState(def) {
    const pl = def.race;
    return {
      ski: true, x: 60, y: groundAt(pl, 60), vx: 2, vy: 0, air: false, crouch: false,
      invuln: 0, tumble: 0, coinsTaken: {}, done: false, seen: {},
      equipX: pl.finish - 420
    };
  }

  function slopeAt(pl, x) { return (groundAt(pl, x + 5) - groundAt(pl, x - 5)) / 10; }

  function update(state, input, t) {
    const events = [];
    const pl = state.def.race, rs = state.race, p = state.player, st = p.stats || {};
    if (rs.done) return events;
    const boost = Math.min(1.12, st.speed || 1);
    rs.crouch = !rs.air && input.isDown('down');
    const brake = input.isDown('left');
    if (rs.tumble > 0) rs.tumble--;
    if (!rs.air) {
      const s = slopeAt(pl, rs.x);
      // 坡度推著人往下滑；雪的摩擦、空氣阻力（壓低時阻力小）
      rs.vx += s * 0.32 - 0.03 - rs.vx * (rs.crouch ? 0.004 : 0.011);
      if (rs.crouch) rs.vx += 0.04;
      if (brake) rs.vx -= 0.16;
      const top = (rs.crouch ? TUCK_V : MAX_V) * boost;
      rs.vx = U.clamp(rs.vx, MIN_V, top);
      if (rs.tumble > 0) rs.vx = Math.min(rs.vx, 4);
      if (input.once('jump') && rs.tumble <= 0) {
        rs.air = true; rs.vy = s * rs.vx - JUMP_V * (1 + (st.jumpBoost || 0) * 0.04);
        events.push('jump');
      } else {
        const nx = rs.x + rs.vx;
        // 跳台：滑過唇口（落差從 kk.x − STEP 開始）的那一帧往上拋 —— 要比下面「地面掉下去 → 飛出去」先判斷
        const kick = pl.kickers.filter(function (kk) { return nx >= kk.x - STEP && rs.x < kk.x - STEP; })[0];
        if (kick) {
          rs.air = true; rs.x = nx; rs.y = kick.y; rs.vy = KICK_VY - rs.vx * 0.22;
          if (!rs.seen.kick) { rs.seen.kick = true; events.push('feature:ski_kick'); }
        }
        const gNow = groundAt(pl, rs.x), gNext = groundAt(pl, nx);
        // 前面的地面掉得比坡度還快（跳台的唇口）→ 飛出去
        if (rs.air) { /* 跳台已經處理 */ }
        else if (gNext - gNow > s * rs.vx + 6) { rs.air = true; rs.vy = Math.min(s, 0.1) * rs.vx - 1.2; }
        rs.x = nx;
        if (!rs.air) { rs.y = gNext; rs.vy = (gNext - gNow); }
      }
    }
    if (rs.air) {
      rs.vy += G;
      rs.x += rs.vx;
      rs.y += rs.vy;
      const g = groundAt(pl, rs.x);
      if (rs.y >= g) { rs.y = g; rs.air = false; rs.vy = 0; events.push('land'); }
    }
    if (rs.invuln > 0) rs.invuln--;
    p.invuln = rs.invuln;
    p.facing = 1;
    // 撞障礙
    const feetUp = groundAt(pl, rs.x) - rs.y;          // 離地多高
    const h = rs.crouch ? CROUCH_H : STAND_H;
    pl.obs.forEach(function (o) {
      if (rs.invuln > 0 || Math.abs(o.x - rs.x) > (o.w + SKIER_W) / 2) return;
      if (!rs.seen[o.kind]) { rs.seen[o.kind] = true; if (o.low) events.push('feature:ski_chair'); }
      const hit = o.low ? (feetUp + h > 38 && feetUp < 70) : feetUp < o.h - 4;
      if (hit) {
        rs.invuln = INVULN; rs.tumble = 40; rs.vx *= 0.45;
        events.push('p0:hurt');
      }
    });
    if (!rs.seen.start && rs.x > 300) { rs.seen.start = true; events.push('feature:ski'); }
    // 金幣
    pl.coins.forEach(function (cn, i) {
      if (rs.coinsTaken[i] || Math.abs(cn.x - rs.x) > 24) return;
      const cy = groundAt(pl, cn.x) - cn.h;
      if (cy > rs.y - h - 14 && cy < rs.y + 10) { rs.coinsTaken[i] = true; state.coinsGot++; events.push('coin'); }
    });
    // 這關的裝備：終點前浮在雪道上
    if (state.equip && !state.equip.taken && Math.abs(rs.x - rs.equipX) < 26) {
      state.equip.taken = true;
      events.push('equip');
    }
    if (rs.x >= pl.finish) { rs.done = true; state.cleared = true; events.push('clear'); }
    return events;
  }

  // ── 繪製 ────────────────────────────────────────────────

  function drawPine(ctx, x, y, s, shade) {
    ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 3 * s, y - 12 * s, 6 * s, 12 * s);
    ctx.fillStyle = shade || '#2f5a3a';
    for (let k = 0; k < 3; k++) {
      const w = (22 - k * 5) * s, ty = y - (12 + k * 16) * s;
      ctx.beginPath(); ctx.moveTo(x - w, ty); ctx.lineTo(x, ty - 26 * s); ctx.lineTo(x + w, ty); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.moveTo(x - 8 * s, y - 50 * s); ctx.lineTo(x, y - 60 * s); ctx.lineTo(x + 8 * s, y - 50 * s); ctx.closePath(); ctx.fill();
  }

  function draw(ctx, state, t, W, H) {
    const pl = state.def.race, rs = state.race, p = state.player;
    const camX = rs.x - SCREEN_X;
    // 鏡頭的高度：人在畫面 y = 250 左右（緩追，跳台飛起來時不會晃太兇）
    const want = groundAt(pl, rs.x) - 250;
    rs.camY = rs.camY == null ? want : rs.camY + (want - rs.camY) * 0.12;
    const camY = rs.camY;
    // 天空
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#6aa8e0'); sky.addColorStop(1, '#d8ecf8');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // 遠山（科帕奧尼克的山脊）：視差很小
    ctx.fillStyle = '#9ab4d0';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 150 + Math.sin((x + camX * 0.05) * 0.008) * 40 + Math.sin((x + camX * 0.05) * 0.021) * 18);
    ctx.lineTo(W, H); ctx.fill();
    ctx.fillStyle = '#eef4fa';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 200 + Math.sin((x + camX * 0.12) * 0.006 + 1) * 34);
    ctx.lineTo(W, H); ctx.fill();
    // 後面一排松樹（視差 0.5）
    pl.trees.forEach(function (tr) {
      if (!tr.back) return;
      const xx = tr.x - camX * 0.5;
      if (xx < -60 || xx > W + 60) return;
      drawPine(ctx, xx, 290 + (tr.s - 1) * 30, tr.s * 0.7, '#4a7a6a');
    });
    // 雪坡
    ctx.fillStyle = '#f6fafe';
    ctx.beginPath(); ctx.moveTo(-10, H + 10);
    for (let sx = -10; sx <= W + 10; sx += 10) ctx.lineTo(sx, groundAt(pl, sx + camX) - camY);
    ctx.lineTo(W + 10, H + 10); ctx.closePath(); ctx.fill();
    // 雪坡表面的陰影線（壓雪車的紋路）
    ctx.strokeStyle = 'rgba(150, 180, 210, 0.45)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let sx = -10; sx <= W + 10; sx += 10) { const yy = groundAt(pl, sx + camX) - camY + 10; if (sx === -10) ctx.moveTo(sx, yy); else ctx.lineTo(sx, yy); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(170, 200, 230, 0.25)';
    for (let sx = -10; sx <= W + 10; sx += 40) ctx.fillRect(sx - ((camX * 1) % 40), groundAt(pl, sx + camX) - camY + 24, 18, 3);
    const toS = function (x, up) { return [x - camX, groundAt(pl, x) - camY - (up || 0)]; };
    // 跳台（藍色的雪板唇口）
    pl.kickers.forEach(function (kk) {
      const a = toS(kk.x);
      if (a[0] < -80 || a[0] > W + 80) return;
      ctx.fillStyle = '#c8dcf0';
      ctx.beginPath(); ctx.moveTo(a[0] - 140, groundAt(pl, kk.x - 140) - camY); ctx.lineTo(a[0], kk.y - camY); ctx.lineTo(a[0], kk.y - camY + 70); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2f6ab0'; ctx.fillRect(a[0] - 4, kk.y - camY - 2, 8, 6);
    });
    // 旗門
    pl.gates.forEach(function (g) {
      const a = toS(g.x);
      if (a[0] < -30 || a[0] > W + 30) return;
      ctx.fillStyle = '#3a3a40'; ctx.fillRect(a[0] - 1, a[1] - 44, 3, 44);
      ctx.fillStyle = g.red ? '#d8303a' : '#2f6ab0';
      ctx.beginPath(); ctx.moveTo(a[0] + 2, a[1] - 44); ctx.lineTo(a[0] + 22, a[1] - 36); ctx.lineTo(a[0] + 2, a[1] - 28); ctx.closePath(); ctx.fill();
    });
    // 終點的山屋＋拱門
    {
      const a = toS(pl.finish);
      if (a[0] > -200 && a[0] < W + 300) {
        ctx.fillStyle = '#d8303a'; ctx.fillRect(a[0] - 4, a[1] - 90, 8, 90); ctx.fillRect(a[0] + 116, a[1] - 90, 8, 90);
        ctx.fillStyle = '#0c4076'; ctx.fillRect(a[0] - 4, a[1] - 104, 128, 18);
        U.text(ctx, '終點 KOPAONIK', a[0] + 60, a[1] - 95, { size: 11, color: '#ffffff' });
        const hx = a[0] + 180, hy = groundAt(pl, pl.finish + 180) - camY;
        ctx.fillStyle = '#8a5a30'; ctx.fillRect(hx, hy - 60, 110, 60);
        ctx.fillStyle = '#f6fafe';
        ctx.beginPath(); ctx.moveTo(hx - 14, hy - 56); ctx.lineTo(hx + 55, hy - 104); ctx.lineTo(hx + 124, hy - 56); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffd88a'; ctx.fillRect(hx + 16, hy - 44, 20, 16); ctx.fillRect(hx + 74, hy - 44, 20, 16);
        ctx.fillStyle = '#4a2a14'; ctx.fillRect(hx + 46, hy - 34, 18, 34);
      }
    }
    // 障礙
    pl.obs.forEach(function (o) {
      const a = toS(o.x);
      if (a[0] < -80 || a[0] > W + 80) return;
      const x = a[0], y = a[1];
      if (o.kind === 'rock') {
        ctx.fillStyle = '#6a6a74';
        ctx.beginPath(); ctx.moveTo(x - 17, y + 2); ctx.lineTo(x - 12, y - 18); ctx.lineTo(x + 2, y - 24); ctx.lineTo(x + 15, y - 14); ctx.lineTo(x + 17, y + 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f6fafe'; ctx.beginPath(); ctx.ellipse(x - 2, y - 21, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      } else if (o.kind === 'snowman') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x, y - 13, 14, 0, Math.PI * 2); ctx.arc(x, y - 34, 10, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#b8c8d8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y - 13, 14, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#16161c'; ctx.fillRect(x - 4, y - 37, 2, 2); ctx.fillRect(x + 3, y - 37, 2, 2);
        ctx.fillStyle = '#f07a20'; ctx.beginPath(); ctx.moveTo(x, y - 33); ctx.lineTo(x - 9, y - 31); ctx.lineTo(x, y - 30); ctx.fill();
        ctx.fillStyle = '#d8303a'; ctx.fillRect(x - 9, y - 27, 18, 4);
      } else if (o.kind === 'log') {
        ctx.fillStyle = '#7a4a26'; U.roundRect(ctx, x - 28, y - 18, 56, 16, 7); ctx.fill();
        ctx.fillStyle = '#c89a62'; ctx.beginPath(); ctx.ellipse(x + 26, y - 10, 5, 8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f6fafe'; ctx.fillRect(x - 22, y - 20, 34, 4);
      } else {
        // 纜車椅：上面一條纜繩，椅子低低地掛下來（底部離地 38）
        ctx.strokeStyle = '#3a3a40'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 400, y - 150); ctx.lineTo(x + 400, y - 120); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - 136); ctx.lineTo(x, y - 74); ctx.stroke();
        ctx.fillStyle = '#d8303a'; ctx.fillRect(x - 20, y - 76, 40, 8);
        ctx.fillStyle = '#0c4076'; ctx.fillRect(x - 20, y - 68, 6, 26); ctx.fillRect(x - 20, y - 46, 40, 8);
        // 地上的提示：一個往下的箭頭（壓低！）
        ctx.fillStyle = 'rgba(255, 190, 60, ' + (0.6 + Math.sin(t * 0.3) * 0.3).toFixed(2) + ')';
        ctx.beginPath(); ctx.moveTo(x - 10, y - 30); ctx.lineTo(x + 10, y - 30); ctx.lineTo(x, y - 18); ctx.closePath(); ctx.fill();
      }
    });
    // 金幣
    pl.coins.forEach(function (cn, i) {
      if (rs.coinsTaken[i]) return;
      const a = toS(cn.x, cn.h);
      if (a[0] < -20 || a[0] > W + 20) return;
      const sq = Math.abs(Math.cos(t * 0.1 + i));
      ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.ellipse(a[0], a[1], 10 * sq + 1, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff2a0'; ctx.beginPath(); ctx.ellipse(a[0] - 2 * sq, a[1] - 2, 3.5 * sq + 0.5, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    });
    // 裝備／紀念品
    if (state.equip && !state.equip.taken) {
      const a = toS(rs.equipX, 40);
      if (a[0] > -30 && a[0] < W + 30) {
        ctx.fillStyle = 'rgba(255, 230, 140, 0.4)'; ctx.beginPath(); ctx.arc(a[0], a[1], 24, 0, Math.PI * 2); ctx.fill();
        Sprites.equipIcon(ctx, state.equip.id, a[0], a[1] + Math.sin(t * 0.08) * 3, 0.85);
      }
    }
    // 前景的松樹（視差 1.2，畫在雪坡下面一點）
    pl.trees.forEach(function (tr) {
      if (tr.back) return;
      const sx = tr.x - camX * 1.0;
      if (sx < -60 || sx > W + 60) return;
      drawPine(ctx, sx, groundAt(pl, tr.x) - camY + 70, tr.s, '#2f5a3a');
    });
    // 滑雪的人
    const sx = rs.x - camX, sy = rs.y - camY;
    const ang = rs.air ? Math.atan2(rs.vy, rs.vx) * 0.5 : Math.atan(slopeAt(pl, rs.x));
    ctx.save();
    if (rs.invuln > 0 && Math.floor(rs.invuln / 5) % 2 === 0) ctx.globalAlpha = 0.45;
    ctx.translate(sx, sy);
    ctx.rotate(ang + (rs.tumble > 0 ? Math.sin(rs.tumble * 0.4) * 0.6 : 0));
    // 雪板（兩支，前端翹起）
    ctx.strokeStyle = '#d8303a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-22, -1); ctx.lineTo(18, -1); ctx.quadraticCurveTo(25, -1, 26, -7); ctx.stroke();
    ctx.strokeStyle = '#0c4076';
    ctx.beginPath(); ctx.moveTo(-18, 2); ctx.lineTo(20, 2); ctx.quadraticCurveTo(27, 2, 28, -4); ctx.stroke();
    // 人：用一般的主角圖（含時裝），壓低時整個縮矮
    const ph = rs.crouch ? 0.62 : 1;
    ctx.save();
    ctx.scale(1, ph);
    Sprites.player(ctx, { x: -11, y: -42, w: 22, h: 40, facing: 1, onGround: true, vx: 0, invuln: 0, pid: p.pid || 0,
                          equipped: p.equipped || {}, costume: p.costume || Save.get().costume }, t);
    ctx.restore();
    // 雪杖
    ctx.strokeStyle = '#3a3a40'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(4, -26 * ph); ctx.lineTo(-14, 0); ctx.stroke();
    ctx.restore();
    // 雪花噴出來（在地上滑得快的時候）
    if (!rs.air && rs.vx > 6) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let k = 0; k < 4; k++) { const ph2 = (t * 0.7 + k * 9) % 18; ctx.beginPath(); ctx.arc(sx - 18 - ph2 * 1.4, sy - 2 - ph2 * 0.6, 2 + ph2 * 0.15, 0, Math.PI * 2); ctx.fill(); }
    }
    // 速度表＋進度條
    const prog = U.clamp(rs.x / pl.finish, 0, 1);
    ctx.fillStyle = 'rgba(14, 18, 32, 0.55)'; U.roundRect(ctx, W - 26, 60, 12, H - 120, 6); ctx.fill();
    ctx.fillStyle = '#ffd166'; U.roundRect(ctx, W - 26, 60, 12, (H - 120) * prog, 6); ctx.fill();
    U.text(ctx, '終點', W - 20, H - 52, { size: 11, color: '#0c4076' });
    U.text(ctx, Math.round(rs.vx * 9) + ' km/h', W - 36, H - 20, { size: 14, color: '#0c4076', align: 'right' });
  }

  return {
    plan: plan, makeState: makeState, update: update, draw: draw, slopeAt: slopeAt, groundAt: groundAt,
    STAND_H: STAND_H, CROUCH_H: CROUCH_H, SKIER_W: SKIER_W
  };
})();
