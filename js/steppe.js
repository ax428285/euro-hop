'use strict';

/**
 * v1.33 蒙古・草原的騎馬射箭（往前衝的賽道關，race.js 的外掛主題 'steppe'）。
 *
 * 騎著蒙古馬在草原上往前衝：跟其他賽道一樣 ←→ 轉向、跳躍跳過矮的東西（土撥鼠洞、木頭圍欄），
 * 高的（大石頭、羊群）要閃開。沿路有一座座木頭架子，架子中間吊著一個箭靶 ——
 * 按 K／丟 往前射箭，箭沿著你現在的車道飛出去，射中吊在同一個車道上的箭靶就得分。
 * 一趟全部射中 → 稱號「草原神射手」（Save.flag('archer')）。
 *
 * 載入順序：race.js 之後、levels.js 之前（關卡定義時就要 plan）。
 */
const Steppe = (function () {
  const SEG = Race.SEG;
  const ARROW_SPEED = 300;        // 箭每帧往前飛多少（世界單位；馬的極速大約 110）
  const ARROW_LIFE = 32;          // 飛多久（帧）≈ 往前 45 段
  const SHOOT_CD = 16;
  const HIT_X = 0.3;              // 箭跟箭靶左右差多少以內算射中

  function plan(cfg, segs, START, END, r) {
    // 木頭圍欄（整條路，要跳）—— 前面兩旁先插一排彩色的經幡預告
    (cfg.fences || []).forEach(function (k) {
      const i = Math.round(START + (END - START) * k);
      for (let d = -16; d < 4; d++) segs[i + d].obs = [];
      segs[i].obs.push({ x: 0, kind: 'fence', w: 2.6, low: true });
      for (let d = 6; d <= 24; d += 6) { segs[i - d].sprites.push({ x: -1.2, kind: 'flags' }); segs[i - d].sprites.push({ x: 1.2, kind: 'flags' }); }
    });
    // 箭靶：平均排開，吊在三個車道其中一個的上空（不算障礙）
    const n = cfg.targets || 10, targets = [];
    for (let k = 0; k < n; k++) {
      const i = Math.round(START + 24 + (END - START - 48) * k / Math.max(1, n - 1));
      const x = Race.LANES[Math.floor(r() * 3)];
      targets.push({ seg: i, x: x });
      segs[i].sprites.push({ x: 0, kind: 'gantry', tx: x, tid: k });
    }
    return { targets: targets };
  }

  function init(rs) { rs.arrows = []; rs.hits = {}; rs.hitN = 0; rs.shootCd = 0; rs.draw = 0; rs.archDone = false; }

  function update(state, rs, input, events) {
    const pl = state.def.race;
    if (rs.shootCd > 0) rs.shootCd--;
    if (rs.draw > 0) rs.draw--;
    if (rs.shootCd === 0 && input.once('throw')) {
      rs.arrows.push({ z: rs.pos + Race.PLAYER_Z, x: rs.x, life: ARROW_LIFE });
      rs.shootCd = SHOOT_CD; rs.draw = 10;
      events.push('throw');
    }
    rs.arrows.forEach(function (a) {
      const z0 = a.z;
      a.z += ARROW_SPEED + rs.speed;
      a.life--;
      pl.extra.targets.forEach(function (tg, k) {
        if (rs.hits[k] || a.dead) return;
        const tz = tg.seg * SEG;
        if (tz >= z0 && tz < a.z && Math.abs(tg.x - a.x) < HIT_X) {
          rs.hits[k] = true; rs.hitN++; a.dead = true;
          events.push('archery:hit');
        }
      });
    });
    rs.arrows = rs.arrows.filter(function (a) { return a.life > 0 && !a.dead; });
    // 到終點時結算：全部射中 → 稱號
    if (!rs.archDone && rs.pos + Race.PLAYER_Z >= pl.finish * SEG - (rs.speed + 1)) {
      rs.archDone = true;
      if (rs.hitN >= pl.extra.targets.length) events.push('archery:all');
    }
  }

  // ── 畫 ──────────────────────────────────────────────────

  function deco(i, segs, r) {
    if (i % 7 === 0) segs[i].sprites.push({ x: -1.6 - r() * 1.2, kind: 'ger' });
    if (i % 9 === 4) segs[i].sprites.push({ x: 1.5 + r() * 1.4, kind: r() < 0.5 ? 'ger' : 'ovoo' });
    if (i % 3 === 1) segs[i].sprites.push({ x: (r() < 0.5 ? -1 : 1) * (1.2 + r() * 1.5), kind: 'tuft' });
  }

  const sprites = {
    // 蒙古包：白色的圓頂帳篷、紅色的門、頂上一圈藍色的花紋
    ger: function (ctx, u) {
      const w = u * 0.5, h = u * 0.26;
      ctx.fillStyle = '#f4f0e6'; ctx.fillRect(-w / 2, -h, w, h);
      ctx.beginPath(); ctx.moveTo(-w / 2 - u * 0.02, -h); ctx.quadraticCurveTo(0, -h - u * 0.2, w / 2 + u * 0.02, -h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a6ab8'; ctx.fillRect(-w / 2, -h, w, Math.max(1, u * 0.025));
      ctx.fillStyle = '#c8302a'; ctx.fillRect(-u * 0.05, -h * 0.75, u * 0.1, h * 0.75);
      ctx.fillStyle = '#c8a050'; ctx.fillRect(-u * 0.025, -h - u * 0.2, u * 0.05, u * 0.04);
    },
    // 敖包：石頭堆，頂上插一根掛著藍色哈達的木竿
    ovoo: function (ctx, u) {
      ctx.fillStyle = '#9a9488';
      ctx.beginPath(); ctx.moveTo(-u * 0.22, 0); ctx.lineTo(-u * 0.06, -u * 0.2); ctx.lineTo(u * 0.06, -u * 0.2); ctx.lineTo(u * 0.22, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-u * 0.01, -u * 0.48, u * 0.02, u * 0.3);
      ctx.fillStyle = '#4a90e0'; ctx.fillRect(u * 0.01, -u * 0.46, u * 0.14, u * 0.04);
    },
    tuft: function (ctx, u) {
      ctx.strokeStyle = '#5a8a3a'; ctx.lineWidth = Math.max(1, u * 0.012);
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * u * 0.02, 0); ctx.lineTo(k * u * 0.05, -u * 0.08); ctx.stroke(); }
    },
    // 經幡（五色小旗，圍欄的預告）
    flags: function (ctx, u, o, t) {
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-u * 0.01, -u * 0.5, u * 0.02, u * 0.5);
      const cols = ['#2a6ab8', '#f4f4f0', '#c8302a', '#3a9a4a', '#f2c230'];
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = cols[k];
        const y = -u * (0.48 - k * 0.07), fl = Math.sin(t * 0.2 + k) * u * 0.02;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(u * 0.14 + fl, y + u * 0.02); ctx.lineTo(0, y + u * 0.05); ctx.fill();
      }
    },
    // 土撥鼠洞（矮，可以跳）：一個土堆＋探出頭的土撥鼠
    marmot: function (ctx, u, o, t) {
      ctx.fillStyle = '#7a5a34';
      ctx.beginPath(); ctx.ellipse(0, 0, u * 0.2, u * 0.06, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.ellipse(0, -u * 0.01, u * 0.08, u * 0.025, 0, 0, Math.PI * 2); ctx.fill();
      const up = (Math.sin(t * 0.1 + o.x * 5) + 1) / 2;
      ctx.fillStyle = '#b08a5a'; ctx.beginPath(); ctx.ellipse(0, -u * (0.03 + up * 0.06), u * 0.045, u * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-u * 0.025, -u * (0.06 + up * 0.06), u * 0.012, u * 0.012); ctx.fillRect(u * 0.013, -u * (0.06 + up * 0.06), u * 0.012, u * 0.012);
    },
    // 大石頭（高，要閃）：灰色的大圓石，下面有紅色的警示影子
    rock: function (ctx, u) {
      ctx.fillStyle = 'rgba(200, 40, 30, 0.35)'; ctx.beginPath(); ctx.ellipse(0, 0, u * 0.22, u * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a8478'; ctx.beginPath(); ctx.ellipse(0, -u * 0.12, u * 0.18, u * 0.14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a8a294'; ctx.beginPath(); ctx.ellipse(-u * 0.05, -u * 0.17, u * 0.07, u * 0.05, 0, 0, Math.PI * 2); ctx.fill();
    },
    // 羊群（高，要閃）：三隻白白胖胖的綿羊
    sheep: function (ctx, u, o, t) {
      ctx.fillStyle = 'rgba(200, 40, 30, 0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, u * 0.24, u * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      [[-0.1, 0], [0.1, 0.02], [0, -0.06]].forEach(function (q, k) {
        const x = q[0] * u, y = q[1] * u, b = Math.sin(t * 0.2 + k) * u * 0.008;
        ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x - u * 0.06, y - u * 0.05, u * 0.02, u * 0.05); ctx.fillRect(x + u * 0.04, y - u * 0.05, u * 0.02, u * 0.05);
        ctx.fillStyle = '#f4f0e6'; ctx.beginPath(); ctx.ellipse(x, y - u * 0.1 + b, u * 0.09, u * 0.065, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.ellipse(x + u * 0.08, y - u * 0.12 + b, u * 0.03, u * 0.035, 0, 0, Math.PI * 2); ctx.fill();
      });
    },
    // 木頭圍欄（整條路，要跳）
    fence: function (ctx, u) {
      const w = u * 2.6;
      ctx.fillStyle = '#8a5a30';
      for (let k = 0; k <= 12; k++) ctx.fillRect(-w / 2 + k * w / 12 - u * 0.015, -u * 0.16, u * 0.03, u * 0.16);
      ctx.fillRect(-w / 2, -u * 0.14, w, u * 0.03); ctx.fillRect(-w / 2, -u * 0.07, w, u * 0.03);
    },
    // 吊箭靶的木架：兩根柱子在路邊、橫木跨過整條路，箭靶吊在其中一個車道上（射中後變成插著箭的樣子、往下垂）
    gantry: function (ctx, u, o, t) {
      const H = u * 0.95, half = u * 1.12;
      ctx.fillStyle = '#7a5030';
      ctx.fillRect(-half - u * 0.02, -H, u * 0.04, H); ctx.fillRect(half - u * 0.02, -H, u * 0.04, H);
      ctx.fillRect(-half, -H, half * 2, u * 0.035);
      const tx = o.tx * u, ty = -H + u * 0.3;
      const rs = Steppe.cur, hit = rs && rs.hits && rs.hits[o.tid];
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = Math.max(1, u * 0.008);
      ctx.beginPath(); ctx.moveTo(tx, -H); ctx.lineTo(tx, ty - u * 0.13); ctx.stroke();
      const sw = Math.sin(t * 0.06 + o.tid) * u * 0.01;
      const R = u * 0.13;
      ['#f4f0e6', '#c8302a', '#f4f0e6', '#c8302a', '#f2c230'].forEach(function (c, k) {
        ctx.fillStyle = hit ? (k % 2 ? '#7a6a5a' : '#bab0a0') : c;
        ctx.beginPath(); ctx.arc(tx + sw, ty, R * (1 - k * 0.2), 0, Math.PI * 2); ctx.fill();
      });
      if (hit) {
        ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = Math.max(1, u * 0.012);
        ctx.beginPath(); ctx.moveTo(tx + sw, ty); ctx.lineTo(tx + sw - u * 0.05, ty + u * 0.1); ctx.stroke();
      } else {
        // 還沒射中：箭靶外面一圈閃閃的金光（看得到要射的是哪一個車道）
        ctx.strokeStyle = 'rgba(255, 220, 120, ' + (0.4 + Math.sin(t * 0.2) * 0.3).toFixed(2) + ')'; ctx.lineWidth = Math.max(1, u * 0.015);
        ctx.beginPath(); ctx.arc(tx + sw, ty, R * 1.2, 0, Math.PI * 2); ctx.stroke();
      }
    },
    // 終點：成吉思汗騎馬像下面的那達慕大會門樓
    naadam: function (ctx, u) {
      const half = u * 1.2, H = u * 1.0;
      ctx.fillStyle = '#c8302a'; ctx.fillRect(-half, -H, u * 0.1, H); ctx.fillRect(half - u * 0.1, -H, u * 0.1, H);
      ctx.fillStyle = '#2a6ab8'; ctx.fillRect(-half - u * 0.05, -H - u * 0.12, half * 2 + u * 0.1, u * 0.14);
      ctx.fillStyle = '#f2c230'; ctx.fillRect(-half, -H - u * 0.05, half * 2, u * 0.03);
      U.text(ctx, '終點', 0, -H - u * 0.05, { size: Math.max(8, u * 0.07), color: '#ffffff', stroke: false });
    }
  };

  function backdrop(ctx, pl, rs, t, W, H, off, hz) {
    // 遠方一層層綠色的丘陵＋藍天上的白雲；一群野馬在地平線上跑
    [['#7aa860', 0.5, 50, 0.006], ['#6a9a50', 1, 26, 0.012]].forEach(function (L) {
      ctx.fillStyle = L[0];
      ctx.beginPath(); ctx.moveTo(0, hz + 14);
      for (let x = 0; x <= W; x += 24) ctx.lineTo(x, hz - L[2] * (0.6 + 0.4 * Math.sin((x + off * 600 * L[1]) * L[3])));
      ctx.lineTo(W, hz + 14); ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let k = 0; k < 5; k++) {
      const x = ((k * 230 - off * 120) % (W + 200) + W + 200) % (W + 200) - 100, y = 40 + (k % 3) * 26;
      ctx.beginPath(); ctx.ellipse(x, y, 40, 12, 0, 0, Math.PI * 2); ctx.ellipse(x + 22, y - 6, 24, 10, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#5a3a24';
    for (let k = 0; k < 6; k++) {
      const x = ((W * 0.6 + k * 22 - off * 300 + t * 0.4) % (W + 100) + W + 100) % (W + 100) - 50, y = hz - 6 + (k % 2) * 3;
      ctx.fillRect(x, y - 5, 12, 5); ctx.fillRect(x + 10, y - 9, 3, 5);
      const g = Math.sin(t * 0.4 + k) * 2;
      ctx.fillRect(x + 1 + g, y, 2, 4); ctx.fillRect(x + 9 - g, y, 2, 4);
    }
  }

  /** 騎在蒙古馬上的背影：棕色的馬（鬃毛隨風飄）、你穿藍色的蒙古袍、背著弓；射箭時把弓拉開 */
  function drawPlayer(ctx, pl, rs, t) {
    const run = Math.sin(t * 0.5) * 3;
    ctx.fillStyle = '#7a4a28';
    ctx.fillRect(-30, -18 + run, 12, 22); ctx.fillRect(18, -18 - run, 12, 22);         // 後腿
    ctx.beginPath(); ctx.ellipse(0, -34, 34, 22, 0, 0, Math.PI * 2); ctx.fill();      // 屁股
    ctx.fillStyle = '#3a2214';
    ctx.beginPath(); ctx.moveTo(-4, -40); ctx.quadraticCurveTo(-8 + Math.sin(t * 0.3) * 6, -10, -2, 6); ctx.lineTo(4, 6); ctx.quadraticCurveTo(0, -12, 4, -40); ctx.fill();   // 尾巴
    ctx.fillStyle = '#c8302a'; ctx.fillRect(-20, -58, 40, 12);                           // 鞍
    // 騎士（藍色蒙古袍＋金色腰帶）
    ctx.fillStyle = '#2a5aa8'; ctx.fillRect(-14, -90, 28, 34);
    ctx.fillStyle = '#f2c230'; ctx.fillRect(-14, -66, 28, 4);
    ctx.fillStyle = '#6a4a30'; ctx.beginPath(); ctx.arc(0, -98, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8302a'; ctx.beginPath(); ctx.arc(0, -104, 9, Math.PI, 0); ctx.fill();   // 帽子
    // 弓：平常斜背在背上；射箭時舉到前面、拉滿
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 3;
    if (rs.draw > 0) {
      ctx.beginPath(); ctx.arc(0, -96, 26, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.strokeStyle = '#e8e0d0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-22, -110); ctx.lineTo(0, -96 + rs.draw * 0.6); ctx.lineTo(22, -110); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(-4, -76, 22, -0.9, 0.9); ctx.stroke();
    }
  }

  /** 每一段畫完之後：飛在這一段的箭 */
  function drawSeg(ctx, s, rs, sx, u) {
    (rs.arrows || []).forEach(function (a) {
      if (Math.floor(a.z / SEG) !== s.i) return;
      const x = sx(a.x), y = s.p1.sy - u * 0.62;
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = Math.max(1.2, u * 0.012);
      ctx.beginPath(); ctx.moveTo(x, y + u * 0.06); ctx.lineTo(x, y - u * 0.04); ctx.stroke();
      ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.moveTo(x, y - u * 0.07); ctx.lineTo(x - u * 0.015, y - u * 0.035); ctx.lineTo(x + u * 0.015, y - u * 0.035); ctx.fill();
    });
  }

  function overlay(ctx, state, t, W) {
    const rs = state.race, n = state.def.race.extra.targets.length;
    ctx.fillStyle = 'rgba(14, 18, 32, 0.6)'; U.roundRect(ctx, W / 2 - 170, 52, 340, 28, 8); ctx.fill();
    U.text(ctx, '箭靶 ' + rs.hitN + ' / ' + n + '　按 K／丟 射箭（射同一個車道的靶）', W / 2, 66, { size: 13, color: rs.hitN >= n ? '#8fe3a0' : '#ffe9a8' });
  }

  Race.registerTheme('steppe', {
    colors: {
      sky: ['#4a9ae0', '#d8f0ff'], ground1: '#8ab860', ground2: '#82b058',
      road1: '#c8a878', road2: '#c0a070', rumble1: '#6a9a48', rumble2: '#f4f0e6', lane: null
    },
    deco: deco,
    obsKinds: [{ kind: 'marmot', low: true, w: 0.4 }, { kind: 'rock', low: false, w: 0.36 }, { kind: 'sheep', low: false, w: 0.4 }],
    plan: plan, init: init,
    update: function (state, rs, input, events, t) { Steppe.cur = rs; update(state, rs, input, events, t); },
    tipKinds: ['fence'],
    sprites: sprites,
    backdrop: function (ctx, pl, rs, t, W, H, off, hz) { Steppe.cur = rs; backdrop(ctx, pl, rs, t, W, H, off, hz); }, drawPlayer: drawPlayer, drawSeg: drawSeg,
    overlay: function (ctx, state, t, W, H) { Steppe.cur = state.race; overlay(ctx, state, t, W, H); },
    finish: 'naadam'
  });

  return { cur: null, ARROW_SPEED: ARROW_SPEED, HIT_X: HIT_X };
})();
