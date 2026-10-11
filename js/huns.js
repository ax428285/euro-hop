'use strict';

/**
 * v1.33.6 匈奴進攻（玩家：亞洲地圖全過後，會觸發匈奴進攻）。
 *
 *   觸發：亞洲的關卡全部破完、人在亞洲地圖 → 長城的守將來報：烽火點起來了，三支匈奴騎兵隊從北方草原南下（flag huns 1）
 *   一、長城保衛戰（hun0、hun1、hun2）
 *       三支騎兵隊在地圖上從蒙古草原往長安慢慢逼近（陸地上的怪，走路碰到按 Enter）。
 *       站在長城上：騎兵從右邊一隊隊衝過來 —— 跳到騎兵頭上把他踩下馬；被馬撞到會痛；弓騎兵會往你射箭，
 *       地上的紅圈是箭雨。踩下馬夠多就贏；讓太多騎兵衝過長城（左邊）就輸。
 *   二、三支都打退 → 守將：匈奴往西邊逃了，首領阿提拉要去打羅馬（flag huns 2）
 *       歐洲地圖：喀爾巴阡山下（匈牙利東北）出現「上帝之鞭 阿提拉」的營地（魔王，走路碰到）
 *   三、阿提拉之戰（attila）：沙隆平原（西元 451 年，羅馬人在這裡擋下了阿提拉）
 *       這一場給你一把弓：按 K／丟 射箭。阿提拉騎著馬來回衝（跳過去），邊跑邊射箭；
 *       停在場邊嘲笑你的時候，會朝你平射一排箭 —— 躲到木盾牌後面擋箭，再出來射他。發怒後還會叫騎兵來。
 *       打倒 → 稱號「上帝之鞭的剋星」（flag hunbane），flag huns 3
 *
 * 載入順序：asiaquest.js 之後（要用 Encounter.registerMini、Quests.registerNpc）。
 */
const Huns = (function () {
  const W = 960;
  const H = Encounter.helpers;
  const L = Quests.helpers.L;
  const HORDES = [
    { kind: 'hun0', name: '匈奴騎兵隊・左賢王', from: [96, 45.5], goal: 8, speed: 1.0, escape: 6 },
    { kind: 'hun1', name: '匈奴騎兵隊・右賢王', from: [104, 46.5], goal: 10, speed: 1.12, escape: 5 },
    { kind: 'hun2', name: '匈奴騎兵隊・單于親衛', from: [111, 45.0], goal: 12, speed: 1.25, escape: 4 }
  ];
  const CHANGAN = [108.9, 34.2];
  const ATTILA_AT = [22.6, 48.3];          // 喀爾巴阡山下（匈牙利東北）
  function flag(k) { return Save.flag(k) || 0; }
  function asiaDone() {
    return Levels.list.every(function (l, i) { return l.region !== 'asia' || Save.isCleared(i); });
  }
  function hordesDown() { return HORDES.every(function (h) { return Save.seaBossDown(h.kind); }); }
  function rnd(mini) { mini.rs = (mini.rs * 16807) % 2147483647; return (mini.rs - 1) / 2147483646; }
  function seed(mini) { mini.rs = 1 + Math.floor(Math.random() * 2147483000); }
  function stomped(q, box) {
    if (!U.overlap(q, box) || q.vy <= 0 || (q.y + q.h) - box.y > 24) return false;
    q.vy = PHYS.STOMP_BOUNCE;
    return true;
  }
  function landNear(lon, lat, project) {
    const p = project(lon, lat);
    for (let r = 0; r <= 90; r += 5) for (let k = 0; k < 16; k++) {
      const x = p[0] + Math.cos(k * Math.PI / 8) * r, y = p[1] + Math.sin(k * Math.PI / 8) * r;
      if (Voyage.isLand(x, y)) return { x: x, y: y };
      if (r === 0) break;
    }
    return null;
  }

  // ── 劇情的觸發：game.js 在地圖畫面每帧問一次，回傳要開的對話 ──
  function check() {
    const w = WorldMap.world();
    if (w === 'as' && flag('huns') === 0 && asiaDone()) { Save.setFlag('huns', 1); return 'hunsAlarm'; }
    if (w === 'as' && flag('huns') === 1 && hordesDown()) { Save.setFlag('huns', 2); return 'hunsFlee'; }
    return null;
  }

  // ── 地圖上的騎兵隊、阿提拉 ──
  Encounter.registerEnsure(function (monsters, world) {
    if (world === 'as' && flag('huns') === 1) {
      HORDES.forEach(function (h) {
        if (Save.seaBossDown(h.kind) || monsters.some(function (m) { return m.kind === h.kind; })) return;
        const at = landNear(h.from[0], h.from[1], WorldMap.project);
        const goal = WorldMap.project(CHANGAN[0], CHANGAN[1]);
        if (at) monsters.push({ kind: h.kind, def: Encounter.KINDS[h.kind], x: at.x, y: at.y, tx: goal[0], ty: goal[1], heading: 0, life: Infinity, appear: 0, step: 0 });
      });
    }
    if (world === 'eu' && flag('huns') >= 2 && !monsters.some(function (m) { return m.kind === 'attila'; })) {
      const at = landNear(ATTILA_AT[0], ATTILA_AT[1], EuropeWorld.project);
      if (at) monsters.push({ kind: 'attila', def: Encounter.KINDS.attila, x: at.x, y: at.y, heading: 0, life: Infinity, appear: 1, boss: true });
    }
  });
  /** 騎兵隊往長安慢慢逼近（走陸地；到了長安外面就停下來紮營） */
  function hordeNear(m, ship, d) {
    const dx = m.tx - m.x, dy = m.ty - m.y, dist = Math.hypot(dx, dy);
    if (dist > 46) {
      const nx = m.x + dx / dist * 0.14, ny = m.y + dy / dist * 0.14;
      if (Voyage.isLand(nx, ny)) { m.x = nx; m.y = ny; m.step += 0.14; }
    }
    m.face = dx < 0 ? -1 : 1;
    return d < 26 && Voyage.mode() === 'land';
  }
  function drawHordeMap(ctx, t, m) {
    // 三個騎兵＋揚起的沙塵＋一面紅色的狼頭旗
    ctx.fillStyle = 'rgba(200, 170, 120, 0.5)';
    ctx.beginPath(); ctx.ellipse(-8 * (m && m.face || 1), 2, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.scale(m && m.face || 1, 1);
    [[-8, 0], [0, -3], [8, 0]].forEach(function (q, k) {
      const b = Math.sin(t * 0.3 + k) * 1;
      ctx.fillStyle = '#5a3a24'; ctx.fillRect(q[0] - 4, q[1] - 5 + b, 8, 4);
      ctx.fillRect(q[0] + 3, q[1] - 8 + b, 2, 4);
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(q[0] - 1, q[1] - 10 + b, 3, 5);
      ctx.fillStyle = '#8a6a4a'; ctx.beginPath(); ctx.arc(q[0] + 0.5, q[1] - 11 + b, 2, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(0, -22, 1.2, 14);
    ctx.fillStyle = '#b8202a'; ctx.beginPath(); ctx.moveTo(1.2, -22); ctx.lineTo(9, -19); ctx.lineTo(1.2, -16); ctx.fill();
    ctx.restore();
  }

  // ════════════════════════════════════════════════════════
  // 長城保衛戰
  // ════════════════════════════════════════════════════════
  const RIDER_W = 64, RIDER_H = 56;
  function riderBox(r) { return { x: r.x, y: Levels.GROUND_Y - RIDER_H, w: RIDER_W, h: RIDER_H }; }
  function headBox(r) { return { x: r.x + 18, y: Levels.GROUND_Y - RIDER_H - 4, w: 30, h: 22 }; }
  /** 騎兵往左衝；從上面踩到頭 = 踩下馬；撞到馬身會痛；弓騎兵經過時往你射一箭（共用：長城保衛戰、阿提拉叫來的騎兵） */
  function updateRiders(state, mini, events, players, onDown) {
    const GY = Levels.GROUND_Y, p = state.player;
    mini.riders.forEach(function (r) {
      if (r.down) { r.t++; r.x += r.vx * 0.6; return; }
      r.x += r.vx;
      players.forEach(function (q) {
        if (r.down) return;
        if (stomped(q, headBox(r))) {
          r.down = true; r.t = 0; onDown(r); events.push('stomp');
          H.burst(state, r.x + 32, GY - 50, '#c8a070', 12);
        } else if (U.overlap(q, riderBox(r))) H.hurt(q, r.x + 32, events);
      });
      if (r.archer && !r.shot && r.x < p.x + 340 && r.x > p.x + 80) {
        r.shot = true;
        const T = 46;
        mini.arrows.push({ x: r.x + 20, y: GY - 60, vx: (p.x + p.w / 2 - r.x - 20) / T, vy: -5.2, g: 0.22 });
      }
    });
  }
  function updateArrows(state, mini, events, players) {
    const GY = Levels.GROUND_Y;
    mini.arrows.forEach(function (a) {
      a.x += a.vx; a.y += a.vy; a.vy += a.g || 0;
      (mini.pavises || []).forEach(function (s) { if (!a.dead && a.x > s.x && a.x < s.x + s.w && a.y > GY - s.h && a.y < GY) { a.dead = true; H.burst(state, a.x, a.y, '#c8a070', 4); events.push('clang'); } });
      players.forEach(function (q) { if (!a.dead && U.overlap(q, { x: a.x - 6, y: a.y - 3, w: 12, h: 6 })) { a.dead = true; H.hurt(q, a.x, events); } });
      if (a.y > GY || a.x < -40 || a.x > W + 40) a.dead = true;
    });
    mini.arrows = mini.arrows.filter(function (a) { return !a.dead; });
  }
  function drawRider(ctx, r, t, scale) {
    const GY = Levels.GROUND_Y, run = Math.sin(t * 0.5 + r.x * 0.05) * 6;
    ctx.save();
    ctx.translate(r.x + RIDER_W / 2, GY);
    if (r.down) { ctx.globalAlpha = Math.max(0, 1 - r.t / 40); }
    ctx.scale(-(scale || 1), scale || 1);           // 往左衝（畫的時候頭朝右，翻過來）
    ctx.fillStyle = r.horse || '#6a4a2a';
    [[-20, run], [-12, -run], [12, run], [20, -run]].forEach(function (q) { ctx.fillRect(q[0] - 2 + q[1] * 0.4, -20, 4, 20); });
    ctx.beginPath(); ctx.ellipse(0, -26, 26, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(18, -30); ctx.lineTo(30, -46); ctx.lineTo(36, -44); ctx.lineTo(26, -26); ctx.fill();
    ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.moveTo(-24, -28); ctx.quadraticCurveTo(-34, -24, -30, -14); ctx.lineTo(-26, -24); ctx.fill();   // 尾巴
    if (!r.down) {
      ctx.fillStyle = '#5a3a2a'; ctx.fillRect(-6, -52, 12, 18);                       // 皮袍
      ctx.fillStyle = '#c8946a'; ctx.beginPath(); ctx.arc(0, -56, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a6a4a'; ctx.beginPath(); ctx.arc(0, -59, 7, Math.PI, 0); ctx.fill(); ctx.fillRect(-7, -60, 14, 3);   // 毛帽
      if (r.archer) { ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(10, -46, 10, -1.2, 1.2); ctx.stroke(); }
      else { ctx.strokeStyle = '#c8c8d0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(6, -44); ctx.quadraticCurveTo(18, -52, 22, -64); ctx.stroke(); }
    } else {
      // 被踩下馬：人在地上滾
      ctx.fillStyle = '#5a3a2a'; ctx.save(); ctx.translate(-30 + r.t * 0.5, -8); ctx.rotate(r.t * 0.2); ctx.fillRect(-6, -6, 12, 12); ctx.restore();
    }
    ctx.restore();
  }
  function drawArrows(ctx, mini) {
    mini.arrows.forEach(function (a) {
      const ang = Math.atan2(a.vy, a.vx);
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang);
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(8, 0); ctx.stroke();
      ctx.fillStyle = '#c8c8d0'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(7, -3); ctx.lineTo(7, 3); ctx.fill();
      ctx.fillStyle = a.mine ? '#8fe3a0' : '#c8302a'; ctx.fillRect(-11, -2, 3, 4);
      ctx.restore();
    });
  }

  HORDES.forEach(function (hd, idx) {
    Encounter.registerMini(hd.kind, {
      def: { name: hd.name, lv: '騎兵', exp: 100, bossExp: 200, bossCoins: 300, game: '長城保衛戰', as: true, fixed: true, duration: 90 * 60,
             fact: '兩千多年前，北方草原的匈奴騎兵常常南下攻打漢朝；秦始皇、漢武帝一再修築長城，就是為了擋住他們。',
             goal: '跳到騎兵頭上把他踩下馬・別讓 ' + hd.escape + ' 個騎兵衝過長城', loseNote: '匈奴騎兵還在往長安前進⋯⋯準備好再來' },
      mapNear: hordeNear,
      drawMap: function (ctx, t, m) { drawHordeMap(ctx, t, m); },
      arena: function () { return { country: '匈奴進攻', sky: ['#c8a070', '#f0dcb0'], spawnX: 300, groundTop: '#9a8a74', groundBody: '#6a5a48' }; },
      init: function (state, mini) {
        seed(mini); mini.down = 0; mini.escaped = 0; mini.riders = []; mini.arrows = []; mini.marks = []; mini.next = 60; mini.seq = 0; mini.volCd = 220;
        mini.goal = hd.goal; mini.escapeMax = hd.escape; mini.sp = hd.speed;
      },
      update: function (state, input, mini, events, win, fail, players) {
        const GY = Levels.GROUND_Y, p = state.player;
        if (--mini.next <= 0) {
          const n = mini.seq++;
          mini.next = Math.max(58, 118 - Math.floor(mini.elapsed / 40)) + Math.floor(rnd(mini) * 30);
          mini.riders.push({ x: W + 20, vx: -(2.6 + rnd(mini) * 1.3) * mini.sp, archer: n % 3 === 1, horse: ['#6a4a2a', '#4a3a2a', '#8a6a4a'][n % 3] });
        }
        updateRiders(state, mini, events, players, function () { mini.down++; });
        mini.riders.forEach(function (r) { if (!r.down && r.x < -RIDER_W && !r.gone) { r.gone = true; mini.escaped++; events.push('clang'); } });
        mini.riders = mini.riders.filter(function (r) { return !r.gone && !(r.down && r.t > 45); });
        // 箭雨（紅圈）
        if (--mini.volCd <= 0) { mini.volCd = Math.max(150, 240 - mini.elapsed / 20); mini.marks.push({ x: U.clamp(p.x + p.w / 2 + p.vx * 30, 40, W - 40), t: 70 }); }
        mini.marks.forEach(function (m) {
          if (--m.t === 0) players.forEach(function (q) { if (Math.abs(q.x + q.w / 2 - m.x) < 46 && q.y + q.h > GY - 80) H.hurt(q, m.x, events); });
        });
        mini.marks = mini.marks.filter(function (m) { return m.t > -30; });
        updateArrows(state, mini, events, players);
        if (mini.down >= mini.goal) win();
        else if (mini.escaped >= mini.escapeMax || mini.time <= 0) fail();
      },
      draw: function (ctx, state, t, GY) {
        const mini = state.mini;
        // 遠方的草原、山上一座座點著的烽火台
        ctx.fillStyle = '#b8a070';
        ctx.beginPath(); ctx.moveTo(0, GY - 60);
        for (let x = 0; x <= W; x += 30) ctx.lineTo(x, GY - 90 - 30 * Math.abs(Math.sin(x * 0.01)));
        ctx.lineTo(W, GY - 60); ctx.lineTo(W, GY); ctx.lineTo(0, GY); ctx.closePath(); ctx.fill();
        [140, 420, 760].forEach(function (x, k) {
          const y = GY - 110 - 30 * Math.abs(Math.sin(x * 0.01));
          ctx.fillStyle = '#8a7a64'; ctx.fillRect(x - 8, y, 16, 22);
          for (let s = 0; s < 4; s++) { const ph = ((t * 0.4 + s * 20 + k * 13) % 80) / 80; ctx.fillStyle = 'rgba(70, 60, 60, ' + (0.5 - ph * 0.45).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(x - ph * 20, y - 6 - ph * 70, 5 + ph * 12, 0, Math.PI * 2); ctx.fill(); }
          ctx.fillStyle = '#ff7a30'; ctx.beginPath(); ctx.arc(x, y - 3, 4 + Math.sin(t * 0.4 + k) * 1.2, 0, Math.PI * 2); ctx.fill();
        });
        // 長城的城垛（地面前緣）＋左邊的城門（騎兵衝過去 = 衝過長城）
        ctx.fillStyle = '#8a7a64';
        for (let x = 0; x < W; x += 36) ctx.fillRect(x, GY - 14, 20, 14);
        ctx.fillStyle = '#7a6a54'; ctx.fillRect(0, GY - 120, 50, 120);
        ctx.fillStyle = '#c8302a'; ctx.fillRect(4, GY - 150, 42, 30);
        ctx.fillStyle = '#2a1a10'; ctx.fillRect(12, GY - 60, 26, 60);
        mini.marks.forEach(function (m) {
          if (m.t > 0) {
            const k = 1 - m.t / 70;
            ctx.strokeStyle = 'rgba(255, 60, 50, ' + (0.4 + k * 0.5).toFixed(2) + ')'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]);
            ctx.beginPath(); ctx.ellipse(m.x, GY - 2, 46, 9, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
          } else {
            ctx.strokeStyle = 'rgba(58, 42, 26, 0.8)'; ctx.lineWidth = 2;
            for (let a = 0; a < 7; a++) { const ax = m.x - 40 + a * 13; ctx.beginPath(); ctx.moveTo(ax, GY); ctx.lineTo(ax + 5, GY - 16); ctx.stroke(); }
          }
        });
        mini.riders.forEach(function (r) { drawRider(ctx, r, t); });
        drawArrows(ctx, mini);
        // 衝過長城的騎兵數
        ctx.fillStyle = 'rgba(14, 18, 32, 0.6)'; U.roundRect(ctx, W / 2 - 150, 92, 300, 26, 8); ctx.fill();
        U.text(ctx, '踩下馬 ' + mini.down + ' / ' + mini.goal + '　衝過長城 ' + mini.escaped + ' / ' + mini.escapeMax, W / 2, 105, { size: 13, color: mini.escaped >= mini.escapeMax - 1 ? '#ff9a8a' : '#ffe9a8', stroke: false });
      },
      hud: function (mini, sec) { return '跳到騎兵頭上踩下馬　剩 ' + sec + ' 秒　（紅圈 = 箭雨）'; }
    });
  });

  // ════════════════════════════════════════════════════════
  // 阿提拉之戰
  // ════════════════════════════════════════════════════════
  const ATT_HP = 10, ATT_W = 90, ATT_H = 92, PAVISE_X = [220, 470, 720];
  Encounter.registerMini('attila', {
    def: { name: '上帝之鞭 阿提拉', lv: '魔王', exp: 200, bossExp: 500, bossCoins: 1000, game: '沙隆平原之戰', boss: true, usesThrow: true, duration: 120 * 60,
           fact: '西元 451 年，匈奴王阿提拉帶著大軍打進高盧，被羅馬和西哥德的聯軍擋在沙隆平原 —— 歐洲人叫他「上帝之鞭」。',
           goal: '按 K／丟 射箭・他停下來時會平射一排箭，躲到木盾牌後面・騎馬衝過來時跳過去',
           onWin: function () {
             const first = flag('huns') < 3;
             Save.setFlag('huns', 3); Save.setFlag('hunbane', 1);
             return first ? '擊退了匈奴！獲得稱號「上帝之鞭的剋星」' : '阿提拉又被你打退了';
           } },
    drawMap: function (ctx, t) {
      // 營地：一頂黑色的大帳篷＋插著馬尾旗
      ctx.fillStyle = '#2a2a30';
      ctx.beginPath(); ctx.moveTo(-14, 2); ctx.lineTo(0, -16); ctx.lineTo(14, 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c8a050'; ctx.fillRect(-3, -6, 6, 8);
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(12, -26, 1.6, 28);
      ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.moveTo(13.6, -26); ctx.quadraticCurveTo(18 + Math.sin(t * 0.2) * 2, -20, 14, -14); ctx.fill();
      drawHordeMap(ctx, t, { face: -1 });
    },
    arena: function () {
      return { country: '匈奴進攻', sky: ['#7a8aa8', '#e8d8b0'], spawnX: 590, groundTop: '#8aa060', groundBody: '#6a5a3a', noThrow: true,
               pavises: PAVISE_X.map(function (x) { return { x: x, w: 26, h: 66 }; }) };
    },
    init: function (state, mini) {
      seed(mini); mini.hp = ATT_HP; mini.x = 820; mini.dir = -1; mini.state = 'ride'; mini.t = 0; mini.cd = 40; mini.flash = 0;
      mini.arrows = []; mini.mine = []; mini.riders = []; mini.shootCd = 0; mini.pavises = state.def.pavises; mini.called = 0; mini.taunts = 0;
    },
    update: function (state, input, mini, events, win, fail, players) {
      const GY = Levels.GROUND_Y, p = state.player, rage = mini.hp <= 5;
      if (mini.flash > 0) mini.flash--;
      // 你的弓（這一場才有）：往面向的方向射
      if (mini.shootCd > 0) mini.shootCd--;
      if (mini.shootCd === 0 && input && input.once('throw')) {
        mini.mine.push({ x: p.x + p.w / 2 + (p.facing || 1) * 12, y: p.y + 14, vx: (p.facing || 1) * 9, life: 80 });
        mini.shootCd = 22; events.push('throw');
      }
      const box = { x: mini.x - ATT_W / 2, y: GY - ATT_H, w: ATT_W, h: ATT_H };
      mini.mine.forEach(function (a) {
        a.x += a.vx; a.life--;
        if (U.overlap({ x: a.x - 6, y: a.y - 3, w: 12, h: 6 }, box) && mini.flash === 0) {
          a.dead = true; mini.hp--; mini.flash = 20; events.push('hit');
          H.burst(state, a.x, a.y, '#ffd070', 10);
          if (mini.hp <= 0) win();
        }
        if (a.life <= 0 || a.x < -20 || a.x > W + 20) a.dead = true;
      });
      mini.mine = mini.mine.filter(function (a) { return !a.dead; });
      mini.t++;
      if (mini.state === 'ride') {
        // 騎馬衝過整個場地：撞到會痛（跳過去）；邊跑邊往你射箭
        mini.x += mini.dir * (rage ? 7.2 : 6);
        players.forEach(function (q) { if (U.overlap(q, { x: box.x + 10, y: box.y + 20, w: box.w - 20, h: box.h - 20 })) H.hurt(q, mini.x, events); });
        if (--mini.cd <= 0) {
          mini.cd = rage ? 28 : 40;
          const T = 40, n = rage ? 3 : 1;
          for (let k = 0; k < n; k++) mini.arrows.push({ x: mini.x, y: GY - 80, vx: (p.x + p.w / 2 - mini.x + (k - (n - 1) / 2) * 60) / T, vy: -6, g: 0.3 });
        }
        if ((mini.dir < 0 && mini.x < 90) || (mini.dir > 0 && mini.x > W - 90)) { mini.state = 'taunt'; mini.t = 0; mini.taunts++; }
      } else if (mini.state === 'taunt') {
        // 停在場邊嘲笑你：之後朝你平射一排箭（躲到盾牌後面）
        const face = p.x > mini.x ? 1 : -1;
        mini.face = face;
        const T0 = rage ? 50 : 70;
        if (mini.t > T0 && (mini.t - T0) % 14 === 0 && mini.t <= T0 + 14 * 4) {
          mini.arrows.push({ x: mini.x + face * 30, y: GY - 22, vx: face * 8, vy: 0, g: 0 });
          events.push('shoot');
        }
        if (rage && mini.t === 20 && mini.called < 6) {
          // 發怒：叫兩個騎兵從另一邊衝過來
          mini.called += 2;
          [0, 70].forEach(function (off) { mini.riders.push({ x: mini.x < W / 2 ? W + 20 + off : W + 20 + off, vx: -3.4, archer: false }); });
        }
        if (mini.t > T0 + 14 * 4 + 30) { mini.state = 'ride'; mini.dir = mini.x < W / 2 ? 1 : -1; mini.cd = 30; }
      }
      updateRiders(state, mini, events, players, function () {});
      mini.riders = mini.riders.filter(function (r) { return r.x > -RIDER_W - 10 && !(r.down && r.t > 45); });
      updateArrows(state, mini, events, players);
      if (!mini.done && mini.time <= 0) fail();
    },
    draw: function (ctx, state, t, GY) {
      const mini = state.mini;
      // 沙隆平原：遠方羅馬軍團的盾牆和軍旗
      ctx.fillStyle = 'rgba(120, 40, 40, 0.5)';
      for (let k = 0; k < 22; k++) ctx.fillRect(20 + k * 44, GY - 70, 30, 34);
      ctx.fillStyle = 'rgba(232, 184, 48, 0.6)';
      for (let k = 0; k < 4; k++) { ctx.fillRect(100 + k * 240, GY - 120, 3, 50); ctx.beginPath(); ctx.arc(101 + k * 240, GY - 122, 7, 0, Math.PI * 2); ctx.fill(); }
      // 木盾牌（擋住匈奴的箭）
      mini.pavises.forEach(function (s) {
        ctx.fillStyle = '#8a5a30'; ctx.fillRect(s.x, GY - s.h, s.w, s.h);
        ctx.fillStyle = '#c8302a'; ctx.fillRect(s.x + 4, GY - s.h + 6, s.w - 8, s.h - 12);
        ctx.fillStyle = '#e8b830'; ctx.beginPath(); ctx.arc(s.x + s.w / 2, GY - s.h / 2, 6, 0, Math.PI * 2); ctx.fill();
      });
      mini.riders.forEach(function (r) { drawRider(ctx, r, t); });
      // 阿提拉：黑馬、金色的頭盔、紅披風，騎著的時候揮劍；停下來時舉劍大笑
      const face = mini.state === 'ride' ? mini.dir : (mini.face || -1);
      ctx.save(); ctx.translate(mini.x, GY);
      if (mini.flash > 0 && Math.floor(mini.flash / 4) % 2 === 0) ctx.globalAlpha = 0.45;
      ctx.scale(face, 1);
      const run = mini.state === 'ride' ? Math.sin(t * 0.6) * 7 : 0;
      ctx.fillStyle = '#1e1a1e';
      [[-26, run], [-16, -run], [16, run], [26, -run]].forEach(function (q) { ctx.fillRect(q[0] - 3 + q[1] * 0.4, -26, 6, 26); });
      ctx.beginPath(); ctx.ellipse(0, -34, 36, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(26, -40); ctx.lineTo(42, -62); ctx.lineTo(50, -58); ctx.lineTo(36, -34); ctx.fill();
      ctx.fillStyle = '#e8262c'; ctx.fillRect(43, -59, 3, 3);
      ctx.fillStyle = '#b8202a'; ctx.beginPath(); ctx.moveTo(-4, -70); ctx.quadraticCurveTo(-30, -60, -36, -40); ctx.lineTo(-6, -48); ctx.fill();   // 紅披風
      ctx.fillStyle = '#5a4a3a'; ctx.fillRect(-9, -76, 18, 28);
      ctx.fillStyle = '#c8946a'; ctx.beginPath(); ctx.arc(0, -82, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.moveTo(-6, -78); ctx.quadraticCurveTo(0, -66, 6, -78); ctx.fill();     // 鬍子
      ctx.fillStyle = '#e8b830'; ctx.beginPath(); ctx.arc(0, -86, 9, Math.PI, 0); ctx.fill(); ctx.fillRect(-1.5, -100, 3, 10);   // 金盔
      ctx.strokeStyle = '#d8d8e0'; ctx.lineWidth = 3;
      if (mini.state === 'taunt') { ctx.beginPath(); ctx.moveTo(8, -74); ctx.lineTo(16, -112); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(8, -66); ctx.quadraticCurveTo(30, -70 + Math.sin(t * 0.4) * 6, 40, -80); ctx.stroke(); }
      ctx.restore();
      if (mini.state === 'taunt' && mini.t < 60) U.text(ctx, '哈哈哈！', mini.x, GY - 120, { size: 16, color: '#ffe070', strokeWidth: 4 });
      drawArrows(ctx, { arrows: mini.arrows });
      drawArrows(ctx, { arrows: mini.mine.map(function (a) { return { x: a.x, y: a.y, vx: a.vx, vy: 0, mine: true }; }) });
      // 血條
      ctx.fillStyle = 'rgba(14, 18, 32, 0.7)'; U.roundRect(ctx, W / 2 - 160, 90, 320, 26, 8); ctx.fill();
      for (let k = 0; k < ATT_HP; k++) { ctx.fillStyle = k < mini.hp ? (mini.hp <= 5 ? '#ff5a4a' : '#ffb04a') : 'rgba(255,255,255,0.15)'; U.roundRect(ctx, W / 2 - 150 + k * 30, 104, 26, 8, 3); ctx.fill(); }
      U.text(ctx, '上帝之鞭 阿提拉' + (mini.hp <= 5 ? '（發怒！）' : ''), W / 2, 97, { size: 11, color: '#ffe9c8', stroke: false });
    },
    hud: function (mini, sec) { return '射中阿提拉 ' + (ATT_HP - mini.hp) + ' / ' + ATT_HP + '　剩 ' + sec + ' 秒　（K／丟 射箭・躲盾牌擋平射的箭）'; }
  });

  // ════════════════════════════════════════════════════════
  // 對話
  // ════════════════════════════════════════════════════════
  Quests.registerNpc('hunsAlarm', {
    names: { general: '長城守將 李將軍' },
    talk: function () {
      return { who: 'general', lines: [
        L('general', '不好了！北邊的烽火一座接一座點起來了 ——'),
        L('general', '匈奴的騎兵從蒙古草原南下，一共三支，正往長安殺過來！'),
        L('general', '你走遍了整個亞洲，是最了解這片土地的人。請你上長城，幫我們擋住他們！'),
        L('me', '交給我！')
      ], end: function () {
        return { sfx: 'bossRoar', shake: 10, toast: { text: '匈奴進攻！', sub: '三支騎兵隊從北方草原往長安逼近 —— 走過去擋住他們', life: 300 } };
      } };
    },
    portraits: {
      general: function (ctx, t, eyes) {
        ctx.fillStyle = '#c8302a'; ctx.fillRect(-28, 14, 56, 36);
        ctx.fillStyle = '#8a8a96'; ctx.fillRect(-22, 14, 44, 20);
        ctx.fillStyle = '#e0b48a'; ctx.beginPath(); ctx.arc(0, -4, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.moveTo(-12, 6); ctx.quadraticCurveTo(0, 22, 12, 6); ctx.quadraticCurveTo(0, 12, -12, 6); ctx.fill();
        eyes(-5, 7);
        ctx.fillStyle = '#6a6a74'; ctx.beginPath(); ctx.arc(0, -12, 19, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#c8302a'; ctx.fillRect(-2, -40, 4, 10);
      }
    }
  });
  Quests.registerNpc('hunsFlee', {
    talk: function () {
      return { who: 'general', lines: [
        L('general', '三支騎兵隊都被打退了！長安保住了！'),
        L('general', '可是探子回報：匈奴沒有回草原，他們一路往西邊跑了 ——'),
        L('general', '他們的首領叫阿提拉，聽說要翻過喀爾巴阡山，去打歐洲的羅馬！'),
        L('me', '我回歐洲去擋他！')
      ], end: function () {
        return { sfx: 'fanfare', toast: { text: '匈奴往西逃了！', sub: '回歐洲：阿提拉在喀爾巴阡山下（匈牙利東北）紮營', life: 320 } };
      } };
    }
  });

  return { check: check, HORDES: HORDES, ATTILA_AT: ATTILA_AT, ATT_HP: ATT_HP, asiaDone: asiaDone, hordesDown: hordesDown };
})();
