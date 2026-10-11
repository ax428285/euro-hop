'use strict';

/**
 * v1.33 亞洲的海上冒險（亞洲地圖的海上生成，打贏給「亞洲 EXP」，累積 Encounter.EASIA_EXP 解鎖東亞）。
 * 用 Encounter.registerMini 掛進 encounter.js（跟歐洲、新大陸的都不一樣的玩法）：
 *
 *   spices     Lv1  翻覆的香料船：香料罐從天上掉下來（甲板上先出現影子），跑過去接住；紅色的辣椒罐會燙
 *   dragonboat Lv2  龍舟競渡：按 K／丟 打鼓 —— 鼓上的圈縮到跟鼓一樣大的那一下打，龍舟才衝得快；比對手先到終點
 *   typhoon    Lv3  颱風天：強風一陣陣吹過甲板（桅杆上的旗子先往那邊飄），頂著風收集飄在空中的紙燈籠；被吹下船會痛
 *   goldkoi    ★    黃金錦鯉：從水裡躍出來劃一道弧線，跳起來碰牠 3 次就抓到
 *
 * 載入順序：encounter.js 之後（要 registerMini），game.js 之前。
 */
const AsiaSea = (function () {
  const W = 960;
  const H = Encounter.helpers;
  function rnd(mini) { mini.rs = (mini.rs * 16807) % 2147483647; return (mini.rs - 1) / 2147483646; }
  function seed(mini) { mini.rs = 1 + Math.floor(Math.random() * 2147483000); }
  /** 掉下船：痛一下、拉回甲板中間 */
  function overboard(state, mini, events, x0, x1, GY) {
    state.players.forEach(function (p) {
      if (p.out || p.y + p.h < GY + 24) return;
      if (p.x + p.w / 2 > x0 && p.x + p.w / 2 < x1) return;
      H.hurt(p, p.x < W / 2 ? 0 : W, events);
      p.x = (x0 + x1) / 2 - p.w / 2; p.y = GY - 120; p.vx = 0; p.vy = 0;
      H.burst(state, p.x + p.w / 2, GY + 10, '#bfe3ff', 12);
      events.push('shoo');
    });
  }
  function seaBand(ctx, GY, t, col, x0, x1) {
    ctx.fillStyle = col;
    ctx.fillRect(x0, GY - 8, x1 - x0, 100);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let i = 0; i < 10; i++) ctx.fillRect(x0 + ((i * 97 + t * 0.6) % Math.max(1, x1 - x0)), GY + 4 + (i % 3) * 14, 22, 2);
  }

  // ── 1. 香料雨 ───────────────────────────────────────────
  const SPICE_GOAL = 8;
  const SPICES = [['#e8b830', '薑黃'], ['#e8702a', '番紅花'], ['#8a5a30', '肉桂'], ['#6a9a3a', '小豆蔻']];
  Encounter.registerMini('spices', {
    def: { name: '翻覆的香料船', lv: 1, exp: 70, game: '接香料', as: true, duration: 40 * 60,
           fact: '一千年前，印度洋上的商船乘著季風來回，把胡椒、肉桂、番紅花運到阿拉伯和歐洲，香料比黃金還貴。',
           goal: '跑到影子底下接住香料罐・紅色的辣椒罐會燙，別碰' },
    weight: function () { return 5; },
    arena: function (GY) { return { sky: ['#4ab0d8', '#f8e0b0'], spawnX: 460 }; },
    init: function (state, mini) { seed(mini); mini.caught = 0; mini.jars = []; mini.next = 40; mini.seq = 0; },
    update: function (state, input, mini, events, win, fail, players) {
      const GY = Levels.GROUND_Y;
      if (--mini.next <= 0) {
        const n = mini.seq++;
        mini.next = Math.max(30, 58 - Math.floor(mini.elapsed / 120));
        const hot = n % 4 === 3;
        mini.jars.push({ x: 50 + rnd(mini) * 840, y: -40, vy: 1.2, w: 26, h: 30, hot: hot, kind: n % SPICES.length });
      }
      mini.jars.forEach(function (j) {
        j.y += j.vy; j.vy = Math.min(5.5, j.vy + 0.06);
        players.forEach(function (q) {
          if (j.gone || !U.overlap(q, j)) return;
          j.gone = true;
          if (j.hot) { H.hurt(q, j.x + j.w / 2, events); H.burst(state, j.x + 13, j.y + 15, '#ff5a3a', 12); }
          else { mini.caught++; events.push('catch'); H.burst(state, j.x + 13, j.y + 15, SPICES[j.kind][0], 12); }
        });
        if (!j.gone && j.y + j.h >= GY) { j.gone = true; H.burst(state, j.x + 13, GY - 4, j.hot ? '#ff5a3a' : SPICES[j.kind][0], 8); events.push('clang'); }
      });
      mini.jars = mini.jars.filter(function (j) { return !j.gone; });
      if (mini.caught >= SPICE_GOAL) win();
      else if (mini.time <= 0) fail();
    },
    draw: function (ctx, state, t) {
      const mini = state.mini, GY = Levels.GROUND_Y;
      // 後面：翻覆的香料船（船底朝天）漂在海上，旁邊浮著木箱
      ctx.fillStyle = '#7a5030';
      ctx.beginPath(); ctx.moveTo(620, GY - 70); ctx.quadraticCurveTo(760, GY - 130, 900, GY - 70); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(700, GY - 104, 6, 34);
      // 桅杆＋三角帆（我們這艘阿拉伯帆船）
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(140, GY - 230, 6, 230);
      ctx.fillStyle = 'rgba(244, 234, 208, 0.9)';
      ctx.beginPath(); ctx.moveTo(146, GY - 226); ctx.lineTo(260, GY - 70); ctx.lineTo(146, GY - 80); ctx.closePath(); ctx.fill();
      mini.jars.forEach(function (j) {
        // 甲板上的影子：越接近越大越深
        const k = U.clamp(1 - (GY - j.y) / GY, 0.1, 1);
        ctx.fillStyle = 'rgba(0, 0, 0, ' + (0.12 + k * 0.25).toFixed(2) + ')';
        ctx.beginPath(); ctx.ellipse(j.x + 13, GY - 2, 6 + k * 12, 3 + k * 2, 0, 0, Math.PI * 2); ctx.fill();
        // 陶罐：圓肚子、罐口綁著彩色的布
        ctx.fillStyle = j.hot ? '#c8202a' : '#c88a5a';
        ctx.beginPath(); ctx.ellipse(j.x + 13, j.y + 18, 12, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(j.x + 7, j.y + 2, 12, 8);
        ctx.fillStyle = j.hot ? '#ffd040' : SPICES[j.kind][0];
        ctx.fillRect(j.x + 5, j.y, 16, 5);
        if (j.hot) {
          // 辣椒罐：罐身畫一根綠蒂的紅辣椒＋冒熱氣
          ctx.fillStyle = '#ffeee0'; ctx.beginPath(); ctx.ellipse(j.x + 13, j.y + 19, 3, 6, 0.4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(255, 120, 80, 0.7)'; ctx.lineWidth = 1.5;
          for (let k2 = 0; k2 < 2; k2++) { ctx.beginPath(); ctx.moveTo(j.x + 9 + k2 * 8, j.y - 2); ctx.quadraticCurveTo(j.x + 6 + k2 * 8 + Math.sin(t * 0.3) * 2, j.y - 8, j.x + 9 + k2 * 8, j.y - 14); ctx.stroke(); }
        }
      });
    },
    hud: function (mini, sec) { return '接住 ' + mini.caught + ' / ' + SPICE_GOAL + '　剩 ' + sec + ' 秒　（紅色的辣椒罐會燙，別碰）'; },
    drawMap: function (ctx, t) {
      ctx.fillStyle = '#7a5030';
      ctx.beginPath(); ctx.moveTo(-10, 2); ctx.quadraticCurveTo(0, -8, 10, 2); ctx.closePath(); ctx.fill();
      [['#e8b830', -8], ['#e8702a', 0], ['#c8202a', 8]].forEach(function (q, k) {
        const y = -14 + Math.sin(t * 0.1 + k) * 2;
        ctx.fillStyle = q[0]; ctx.beginPath(); ctx.arc(q[1], y, 3, 0, Math.PI * 2); ctx.fill();
      });
    }
  });

  // ── 2. 龍舟競渡 ─────────────────────────────────────────
  const BEAT = 46, GOOD = 8, PERFECT = 3;
  const BOAT_BASE = 0.00024, BOAT_BOOST = 0.00066, RIVAL = 0.00061;
  Encounter.registerMini('dragonboat', {
    def: { name: '龍舟競渡', lv: 2, exp: 90, game: '划龍舟', as: true, duration: 45 * 60, usesThrow: true,
           fact: '端午節划龍舟是為了紀念兩千三百年前投江的詩人屈原；鼓手坐在船頭打鼓，全船的槳手跟著鼓聲一起划。',
           goal: '圈縮到跟鼓一樣大時按 K／丟 打鼓，比對手先到終點' },
    weight: function (es, cargo) { return es >= 30 ? 3 : 1; },
    arena: function (GY) { return { sky: ['#6ab8e0', '#f0f4d8'], spawnX: 470, groundTop: '#b8302a', groundBody: '#7a2a1a' }; },
    init: function (state, mini) { mini.prog = 0; mini.rival = 0; mini.boost = 0; mini.stun = 0; mini.judge = null; mini.judgeT = 0; mini.combo = 0; mini.hits = 0; },
    update: function (state, input, mini, events, win, fail) {
      const ph = mini.elapsed % BEAT, d = Math.min(ph, BEAT - ph);
      if (ph === 0) events.push('drumbeat');
      if (input && input.once('throw')) {
        if (d <= GOOD) {
          mini.boost = BEAT + 6; mini.combo++; mini.hits++;
          mini.judge = d <= PERFECT ? '完美！' : '好！'; mini.judgeT = 30;
          if (d <= PERFECT) mini.boost += 10;
          events.push('hit');
        } else {
          mini.boost = 0; mini.stun = 24; mini.combo = 0;
          mini.judge = '亂了！'; mini.judgeT = 30;
          events.push('clang');
        }
      }
      if (mini.boost > 0) mini.boost--;
      if (mini.stun > 0) mini.stun--;
      if (mini.judgeT > 0) mini.judgeT--;
      mini.prog += (mini.stun > 0 ? 0 : BOAT_BASE) + (mini.boost > 0 ? BOAT_BOOST : 0);
      mini.rival += RIVAL;
      if (mini.prog >= 1) win();
      else if (mini.rival >= 1 || mini.time <= 0) fail();
    },
    draw: function (ctx, state, t) {
      const mini = state.mini, GY = Levels.GROUND_Y;
      // 江面（甲板就是我們的龍舟：紅色的船身）；遠方的山、岸上的人
      ctx.fillStyle = '#7aa890';
      ctx.beginPath(); ctx.moveTo(0, GY - 150);
      for (let x = 0; x <= W; x += 40) ctx.lineTo(x, GY - 150 - 40 * Math.abs(Math.sin((x + mini.prog * 4000) * 0.006)));
      ctx.lineTo(W, GY - 150); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a8ab0'; ctx.fillRect(0, GY - 150, W, 150);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      const sp = mini.boost > 0 ? 9 : 3;
      for (let i = 0; i < 18; i++) ctx.fillRect(((i * 113 - t * sp) % (W + 60) + W + 60) % (W + 60) - 30, GY - 140 + (i % 6) * 22, 30, 2);
      // 對手的龍舟（後面那條水道；跟我們比，誰領先誰就在前面）
      const rx = 480 + (mini.rival - mini.prog) * 2400;
      drawBoat(ctx, rx, GY - 96, 0.6, '#2a6ab8', t, true);
      // 我們的龍舟：船頭龍頭、船尾龍尾，兩排槳手（有鼓聲加持時槳划得快）
      ctx.fillStyle = '#e8b830'; ctx.fillRect(60, GY - 4, 840, 6);
      dragonHead(ctx, 905, GY - 6, 1, '#b8302a');
      ctx.fillStyle = '#b8302a';
      ctx.beginPath(); ctx.moveTo(60, GY); ctx.quadraticCurveTo(20, GY - 20, 30, GY - 60); ctx.lineTo(44, GY - 54); ctx.quadraticCurveTo(44, GY - 20, 70, GY - 6); ctx.fill();
      const row = mini.boost > 0 ? 0.35 : 0.12;
      for (let k = 0; k < 8; k++) {
        const x = 130 + k * 92;
        if (Math.abs(x - 480) < 50) continue;
        const a = Math.sin(t * row + k * 0.5);
        ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, GY - 30); ctx.lineTo(x - 22 + a * 18, GY + 24); ctx.stroke();
        ctx.fillStyle = k % 2 ? '#f2c230' : '#f4f4f0'; ctx.fillRect(x - 7, GY - 34, 14, 20);
        ctx.fillStyle = '#6a4a30'; ctx.beginPath(); ctx.arc(x, GY - 40, 6, 0, Math.PI * 2); ctx.fill();
      }
      // 鼓（在甲板中間）＋縮小的圈
      const ph = mini.elapsed % BEAT, k = ph / BEAT;
      ctx.fillStyle = '#8a2a1a'; ctx.fillRect(520, GY - 34, 44, 34);
      ctx.fillStyle = '#e8d8b0'; ctx.beginPath(); ctx.ellipse(542, GY - 34, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
      const R = 22 + (1 - k) * 70;
      ctx.strokeStyle = 'rgba(255, 230, 120, ' + (0.3 + k * 0.6).toFixed(2) + ')'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(542, GY - 34, R, R * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
      if (ph < 6) { ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(542, GY - 34, 24, 8, 0, 0, Math.PI * 2); ctx.stroke(); }
      if (mini.judgeT > 0) U.text(ctx, mini.judge, 542, GY - 70 - (30 - mini.judgeT), { size: 20, color: mini.judge === '亂了！' ? '#ff8a8a' : '#ffe070', strokeWidth: 4 });
      // 上面的進度條：你（紅）跟對手（藍）
      const bx = 230, bw = 500, by = 96;
      ctx.fillStyle = 'rgba(14, 18, 32, 0.6)'; U.roundRect(ctx, bx - 10, by - 12, bw + 20, 34, 8); ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'; ctx.fillRect(bx, by + 4, bw, 3);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + bw - 2, by - 6, 4, 22);
      [[mini.rival, '#4a8ae8', by - 2], [mini.prog, '#e84a3a', by + 10]].forEach(function (q) {
        ctx.fillStyle = q[1]; ctx.beginPath(); ctx.arc(bx + bw * U.clamp(q[0], 0, 1), q[2], 6, 0, Math.PI * 2); ctx.fill();
      });
    },
    hud: function (mini, sec) {
      return '你 ' + Math.floor(mini.prog * 100) + '%　對手 ' + Math.floor(mini.rival * 100) + '%　（鼓上的圈縮到最小時按 K／丟）';
    },
    drawMap: function (ctx, t) {
      drawBoat(ctx, 0, 2, 0.22, '#b8302a', t, false);
    }
  });
  function dragonHead(ctx, x, y, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(10, -10, 14, -46); ctx.lineTo(40, -50); ctx.lineTo(34, -36); ctx.lineTo(16, -30); ctx.quadraticCurveTo(18, -8, 0, 6); ctx.fill();
    ctx.fillStyle = '#e8b830'; ctx.beginPath(); ctx.moveTo(14, -46); ctx.lineTo(8, -62); ctx.lineTo(22, -50); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(26, -44, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(27, -44, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawBoat(ctx, x, y, s, col, t, rowers) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-200, 0); ctx.lineTo(200, 0); ctx.lineTo(180, 16); ctx.lineTo(-180, 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8b830'; ctx.fillRect(-196, 0, 392, 4);
    dragonHead(ctx, 196, 2, 1, col);
    if (rowers) {
      for (let k = 0; k < 8; k++) {
        const rx = -160 + k * 42, a = Math.sin(t * 0.3 + k * 0.5);
        ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(rx, -8); ctx.lineTo(rx - 16 + a * 14, 30); ctx.stroke();
        ctx.fillStyle = '#f4f4f0'; ctx.fillRect(rx - 6, -22, 12, 16);
        ctx.fillStyle = '#4a3a2a'; ctx.beginPath(); ctx.arc(rx, -27, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ── 3. 颱風天 ───────────────────────────────────────────
  const LANTERN_GOAL = 6, DECK0 = 120, DECK1 = 840;
  const LANTERN_SPOTS = [[200, 250], [700, 200], [460, 160], [300, 290], [640, 300], [420, 240], [760, 270], [250, 180], [560, 210]];
  Encounter.registerMini('typhoon', {
    def: { name: '颱風', lv: 3, exp: 130, game: '颱風天', as: true, duration: 45 * 60,
           fact: '「颱風」可能來自廣東話的「大風」；夏天到秋天，太平洋上的颱風會一路吹到臺灣、中國、日本和菲律賓。',
           goal: '旗子往哪飄，風就往哪吹・頂著風收集 6 盞紙燈籠' },
    weight: function (es) { return es >= 90 ? 2 : 0; },
    arena: function (GY) {
      return { sky: ['#3a4a5a', '#8a9aa8'], spawnX: 460, groundTop: '#8a6a44', groundBody: '#4a3420',
               ground: [{ x: DECK0, y: GY, w: DECK1 - DECK0, h: Levels.GROUND_H }],
               platforms: [{ x: 230, y: 300, w: 120, h: 18 }, { x: 610, y: 300, w: 120, h: 18 }] };
    },
    init: function (state, mini) {
      seed(mini); mini.got = 0; mini.lanterns = []; mini.lseq = 0;
      mini.wind = { state: 'calm', t: 150, dir: 1 };
      for (let k = 0; k < 3; k++) addLantern(mini);
    },
    update: function (state, input, mini, events, win, fail, players) {
      const GY = Levels.GROUND_Y, w = mini.wind;
      if (--w.t <= 0) {
        if (w.state === 'calm') { w.state = 'warn'; w.t = 50; w.dir = rnd(mini) < 0.5 ? -1 : 1; events.push('shoo'); }
        else if (w.state === 'warn') { w.state = 'blow'; w.t = 110; }
        else { w.state = 'calm'; w.t = Math.max(70, 140 - Math.floor(mini.elapsed / 60)); }
      }
      if (w.state === 'blow') {
        players.forEach(function (q) { q.vx = U.clamp(q.vx + w.dir * (q.onGround ? 0.5 : 0.36), -7, 7); });
      }
      mini.lanterns.forEach(function (l) {
        l.ph += 0.03;
        l.x = l.hx + Math.sin(l.ph) * 30;
        l.y = l.hy + Math.cos(l.ph * 1.3) * 12;
        const box = { x: l.x - 12, y: l.y - 16, w: 24, h: 32 };
        players.forEach(function (q) {
          if (l.gone || !U.overlap(q, box)) return;
          l.gone = true; mini.got++; events.push('catch');
          H.burst(state, l.x, l.y, '#ffb050', 12);
        });
      });
      mini.lanterns = mini.lanterns.filter(function (l) { return !l.gone; });
      while (mini.lanterns.length < 3) addLantern(mini);
      overboard(state, mini, events, DECK0, DECK1, GY);
      if (mini.got >= LANTERN_GOAL) win();
      else if (mini.time <= 0) fail();
    },
    draw: function (ctx, state, t) {
      const mini = state.mini, GY = Levels.GROUND_Y, w = mini.wind;
      // 洶湧的海（甲板兩邊）＋雨
      seaBand(ctx, GY, t, '#2a4a6a', 0, DECK0);
      seaBand(ctx, GY, t, '#2a4a6a', DECK1, W);
      ctx.fillStyle = 'rgba(30, 50, 70, 0.5)';
      for (let k = 0; k < 3; k++) {
        const x = (k * 360 + t * 2) % (W + 200) - 100;
        ctx.beginPath(); ctx.ellipse(x, GY - 6, 90, 22, 0, Math.PI, 0); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(200, 220, 240, 0.45)'; ctx.lineWidth = 1.2;
      const slant = w.state === 'blow' ? w.dir * 10 : 3;
      for (let k = 0; k < 40; k++) {
        const x = (k * 53 + t * 5) % W, y = (k * 97 + t * 13) % (GY);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + slant, y + 16); ctx.stroke();
      }
      // 桅杆＋旗子（預告：旗子往風要吹的方向飄）
      ctx.fillStyle = '#5a3a20'; ctx.fillRect(476, GY - 250, 8, 250);
      const fdir = w.state === 'calm' ? 0.2 : w.dir, flap = Math.sin(t * (w.state === 'calm' ? 0.08 : 0.5)) * 6;
      ctx.fillStyle = w.state === 'warn' && Math.floor(t / 6) % 2 ? '#ffe070' : '#d8302a';
      ctx.beginPath(); ctx.moveTo(484 - (fdir < 0 ? 8 : 0), GY - 246); ctx.lineTo(480 + fdir * 70, GY - 236 + flap); ctx.lineTo(484 - (fdir < 0 ? 8 : 0), GY - 222); ctx.closePath(); ctx.fill();
      if (w.state !== 'calm') {
        // 風：一條條往風向飛的白線
        ctx.strokeStyle = 'rgba(255, 255, 255, ' + (w.state === 'blow' ? 0.6 : 0.25) + ')'; ctx.lineWidth = 2;
        for (let k = 0; k < 14; k++) {
          const y = 120 + (k * 37) % 260, x = ((k * 131 + t * 14 * w.dir) % (W + 200) + W + 200) % (W + 200) - 100;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w.dir * 50, y); ctx.stroke();
        }
        U.text(ctx, w.dir > 0 ? '風 →→' : '←← 風', 480, 128, { size: 18, color: w.state === 'blow' ? '#ffffff' : '#ffe070', strokeWidth: 4 });
      }
      // 紙燈籠：紅色、發光、下面垂著金色流蘇
      mini.lanterns.forEach(function (l) {
        ctx.fillStyle = 'rgba(255, 180, 90, 0.25)'; ctx.beginPath(); ctx.arc(l.x, l.y, 24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d8302a'; ctx.beginPath(); ctx.ellipse(l.x, l.y, 12, 15, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8b830'; ctx.fillRect(l.x - 8, l.y - 17, 16, 4); ctx.fillRect(l.x - 8, l.y + 13, 16, 4);
        ctx.strokeStyle = 'rgba(120, 20, 20, 0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(l.x, l.y - 13); ctx.lineTo(l.x, l.y + 13); ctx.stroke();
        ctx.strokeStyle = '#e8b830'; ctx.beginPath(); ctx.moveTo(l.x, l.y + 17); ctx.lineTo(l.x + Math.sin(t * 0.2) * 3, l.y + 26); ctx.stroke();
      });
    },
    hud: function (mini, sec) { return '燈籠 ' + mini.got + ' / ' + LANTERN_GOAL + '　剩 ' + sec + ' 秒　（旗子往哪邊飄，風就往哪邊吹）'; },
    drawMap: function (ctx, t) {
      ctx.strokeStyle = 'rgba(220, 230, 240, 0.9)'; ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 2.4; a += 0.3) {
          const r = 2 + a * 3, ang = a - t * 0.12 + k * 2.1;
          const x = Math.cos(ang) * r, y = Math.sin(ang) * r * 0.7 - 6;
          if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  });
  function addLantern(mini) {
    const s = LANTERN_SPOTS[mini.lseq++ % LANTERN_SPOTS.length];
    mini.lanterns.push({ hx: s[0], hy: s[1], x: s[0], y: s[1], ph: mini.lseq * 1.7 });
  }

  // ── 4. 黃金錦鯉（稀有） ─────────────────────────────────
  const KOI_GOAL = 3, POND0 = 170, POND1 = 790;
  Encounter.registerMini('goldkoi', {
    def: { name: '黃金錦鯉', lv: '★', exp: 60, game: '抓錦鯉', as: true, rare: true, duration: 25 * 60,
           fact: '傳說黃河的鯉魚只要逆流跳過「龍門」，就會變成一條龍 ——「鯉躍龍門」。',
           goal: '錦鯉躍出水面時跳起來碰牠，碰 3 次就抓到了' },
    arena: function (GY) {
      return { sky: ['#5a9ad8', '#fff0c0'], spawnX: 460,
               ground: [{ x: POND0, y: GY, w: POND1 - POND0, h: Levels.GROUND_H }],
               platforms: [{ x: 300, y: 290, w: 120, h: 18 }, { x: 540, y: 290, w: 120, h: 18 }] };
    },
    init: function (state, mini) { seed(mini); mini.caught = 0; mini.koi = null; mini.next = 50; mini.cool = 0; },
    update: function (state, input, mini, events, win, fail, players) {
      const GY = Levels.GROUND_Y;
      if (mini.cool > 0) mini.cool--;
      if (!mini.koi && --mini.next <= 0) {
        const left = rnd(mini) < 0.5;
        const x0 = left ? 70 : W - 70, x1 = left ? W - 70 : 70;
        const peak = 130 + rnd(mini) * 120;              // 弧線最高點離甲板多高
        const T = 110 + Math.floor(rnd(mini) * 30);
        // 拋物線：T 帧後落回水面、最高點離水面 peak + 30 → g = 8h / T²、初速 = -gT / 2
        const g = 8 * (peak + 30) / (T * T);
        mini.koi = { x: x0, y: GY + 30, vx: (x1 - x0) / T, vy: -g * T / 2, g: g, dir: left ? 1 : -1 };
        events.push('shoo');
      }
      const k = mini.koi;
      if (k) {
        k.x += k.vx; k.y += k.vy; k.vy += k.g;
        const box = { x: k.x - 18, y: k.y - 10, w: 36, h: 20 };
        if (mini.cool === 0) players.forEach(function (q) {
          if (mini.koi && U.overlap(q, box)) {
            mini.caught++; mini.cool = 40; events.push('catch');
            H.burst(state, k.x, k.y, '#ffe070', 14);
            mini.koi = null; mini.next = 40;
          }
        });
        if (mini.koi && k.y > GY + 40 && k.vy > 0) { H.burst(state, k.x, GY + 20, '#bfe3ff', 10); mini.koi = null; mini.next = 30; }
      }
      overboard(state, mini, events, POND0, POND1, GY);
      if (mini.caught >= KOI_GOAL) win();
      else if (mini.time <= 0) fail();
    },
    draw: function (ctx, state, t) {
      const mini = state.mini, GY = Levels.GROUND_Y;
      // 池塘（木棧道兩邊）、荷葉、遠方的拱橋
      ctx.strokeStyle = '#c8302a'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(480, GY + 40, 300, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      seaBand(ctx, GY, t, '#3a9a9a', 0, POND0);
      seaBand(ctx, GY, t, '#3a9a9a', POND1, W);
      ctx.fillStyle = '#4a9a4a';
      [[60, GY + 8], [120, GY + 24], [850, GY + 10], [910, GY + 26]].forEach(function (q) { ctx.beginPath(); ctx.ellipse(q[0], q[1], 22, 7, 0, 0.3, Math.PI * 2); ctx.fill(); });
      const k = mini.koi;
      if (k) {
        ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(Math.atan2(k.vy, k.vx));
        if (mini.cool > 0 && Math.floor(mini.cool / 4) % 2 === 0) ctx.globalAlpha = 0.4;
        drawKoi(ctx, 1.4, t);
        ctx.restore();
        for (let s = 0; s < 3; s++) {
          const a = t * 0.2 + s * 2.1;
          ctx.fillStyle = 'rgba(255, 240, 150, 0.8)'; ctx.beginPath(); ctx.arc(k.x + Math.cos(a) * 26, k.y + Math.sin(a) * 16, 2.4, 0, Math.PI * 2); ctx.fill();
        }
      }
    },
    hud: function (mini, sec) { return '碰到錦鯉 ' + mini.caught + ' / ' + KOI_GOAL + '　剩 ' + sec + ' 秒'; },
    drawMap: function (ctx, t) { ctx.save(); ctx.translate(0, -4); ctx.rotate(Math.sin(t * 0.1) * 0.3); drawKoi(ctx, 0.6, t); ctx.restore(); }
  });
  /** 錦鯉（頭朝 +x）：金色的身體、紅白斑、扇形的尾巴 */
  function drawKoi(ctx, s, t) {
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = '#f2c230';
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 7, 0, 0, Math.PI * 2); ctx.fill();
    const tw = Math.sin((t || 0) * 0.4) * 3;
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-26, -8 + tw); ctx.lineTo(-24, 0); ctx.lineTo(-26, 8 + tw); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e84a2a'; ctx.beginPath(); ctx.ellipse(-2, -2, 5, 3, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff4d8'; ctx.beginPath(); ctx.ellipse(6, 2, 4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(11, -2, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  return { SPICE_GOAL: SPICE_GOAL, LANTERN_GOAL: LANTERN_GOAL, KOI_GOAL: KOI_GOAL, BEAT: BEAT, GOOD: GOOD };
})();
