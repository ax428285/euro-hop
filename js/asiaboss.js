'use strict';

/**
 * v1.33.1 亞洲地圖的海上魔王（玩家：亞洲篇沒啥魔王，可以在大地圖放些魔王生物）。
 * 跟斯庫拉一樣固定待在地圖上（Encounter.registerMini 的 at = 經緯度），第一次打倒給 bossExp 亞洲 EXP＋bossCoins。
 * 每一隻都是自己的打法：
 *
 *   roc     大鵬金翅鳥（阿拉伯海，辛巴達的故事）
 *           盤旋：在天上丟大石頭（甲板上先出現影子）→ 俯衝：從一邊貼著甲板衝過來（跳過去）
 *           → 停在甲板上啄人（前面閃紅光就要啄了）—— 這時跳到牠頭上踩。踩 5 下
 *   dragon  東海龍王（東海）
 *           破浪：整條龍從海裡躍出來，在甲板上空劃一道弧（身體碰到會痛）→ 噴火球（落點先出紅圈，落地燒一陣子）
 *           → 把頭靠在甲板邊上喘氣 —— 踩牠額頭的龍珠。踩 6 下；發怒後休息完還會掀一道浪（跳過去）
 *   orochi  八岐大蛇（日本海，素戔嗚尊用酒灌醉大蛇的神話）
 *           甲板上排著 8 個酒罈：碰一下打開蓋子，附近的蛇頭就會過來喝；喝醉了趴在甲板上睡 —— 趁現在踩牠的頭。
 *           其他沒喝醉的頭會瞄準你咬下來（紅圈）。8 顆頭全部打倒就贏
 *
 * 載入順序：asiasea.js 之後。
 */
const AsiaBoss = (function () {
  const W = 960;
  const H = Encounter.helpers;
  function rnd(mini) { mini.rs = (mini.rs * 16807) % 2147483647; return (mini.rs - 1) / 2147483646; }
  function seed(mini) { mini.rs = 1 + Math.floor(Math.random() * 2147483000); }
  /** 從上面踩到 box（回傳 true 時已經把人彈起來） */
  function stomped(q, box) {
    if (!U.overlap(q, box) || q.vy <= 0 || (q.y + q.h) - box.y > 24) return false;
    q.vy = PHYS.STOMP_BOUNCE;
    return true;
  }
  function deckSea(ctx, GY, t, col) {
    ctx.fillStyle = col; ctx.fillRect(0, GY - 120, W, 120);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 16; i++) ctx.fillRect(((i * 113 + t * 0.7) % (W + 60)) - 30, GY - 110 + (i % 5) * 20, 26, 2);
  }
  function hpBar(ctx, name, hp, max, rage) {
    ctx.fillStyle = 'rgba(14, 18, 32, 0.7)'; U.roundRect(ctx, W / 2 - 160, 90, 320, 26, 8); ctx.fill();
    for (let k = 0; k < max; k++) {
      ctx.fillStyle = k < hp ? (rage ? '#ff5a4a' : '#ffb04a') : 'rgba(255, 255, 255, 0.15)';
      U.roundRect(ctx, W / 2 - 150 + k * (300 / max), 104, 300 / max - 4, 8, 3); ctx.fill();
    }
    U.text(ctx, name + (rage ? '（發怒！）' : ''), W / 2, 97, { size: 11, color: '#ffe9c8', stroke: false });
  }

  // ════════════════════════════════════════════════════════
  // 1. 大鵬金翅鳥
  // ════════════════════════════════════════════════════════
  const ROC_HP = 5, ROC_W = 150, ROC_H = 60;
  Encounter.registerMini('roc', {
    at: [64, 14],
    def: { name: '大鵬金翅鳥', lv: '魔王', exp: 150, bossExp: 300, bossCoins: 300, game: '阿拉伯海的巨鳥', as: true, boss: true, duration: 90 * 60,
           fact: '《一千零一夜》裡，辛巴達被一隻大得能抓走大象的巨鳥（Roc）帶上天；牠的蛋像一座白色的圓頂房子。',
           goal: '影子 = 落石・紅條 = 貼著甲板衝過來（跳）・停在甲板上時踩頭' },
    arena: function () { return { sky: ['#e8905a', '#fde0a8'], spawnX: 460 }; },
    init: function (state, mini) {
      seed(mini); mini.hp = ROC_HP; mini.phase = 'soar'; mini.t = 200; mini.bx = 480; mini.by = 110; mini.dir = 1;
      mini.rocks = []; mini.rockCd = 50; mini.hurtT = 0; mini.peck = 0; mini.cycles = 0;
    },
    update: function (state, input, mini, events, win, fail, players) {
      const GY = Levels.GROUND_Y, rage = mini.hp <= 2;
      if (mini.hurtT > 0) mini.hurtT--;
      mini.t--;
      if (mini.phase === 'soar') {
        mini.bx += mini.dir * (rage ? 4.2 : 3.2);
        if (mini.bx > 860) mini.dir = -1; if (mini.bx < 100) mini.dir = 1;
        mini.by = 110 + Math.sin(mini.elapsed * 0.05) * 16;
        if (--mini.rockCd <= 0) {
          mini.rockCd = rage ? 30 : 44;
          const p = state.player;
          const tx = U.clamp(p.x + p.w / 2 + p.vx * 30 + (rnd(mini) - 0.5) * 80, 30, W - 30);
          mini.rocks.push({ x: mini.bx, y: mini.by + 20, tx: tx, vx: (tx - mini.bx) / 60, vy: 0, r: 16 });
          if (rage) mini.rocks.push({ x: mini.bx, y: mini.by + 20, tx: W - tx, vx: (W - tx - mini.bx) / 60, vy: 0, r: 14 });
        }
        if (mini.t <= 0) { mini.phase = 'warn'; mini.t = 55; mini.side = rnd(mini) < 0.5 ? -1 : 1; events.push('shoo'); }
      } else if (mini.phase === 'warn') {
        // 飛到要衝過來的那一邊，甲板上閃紅條
        mini.bx += ((mini.side < 0 ? -120 : W + 120) - mini.bx) * 0.08;
        mini.by += (GY - 40 - mini.by) * 0.08;
        if (mini.t <= 0) { mini.phase = 'dive'; mini.bx = mini.side < 0 ? -140 : W + 140; mini.by = GY - 40; }
      } else if (mini.phase === 'dive') {
        mini.bx -= mini.side * (rage ? 15 : 12);
        const box = { x: mini.bx - ROC_W / 2, y: mini.by - ROC_H / 2, w: ROC_W, h: ROC_H * 0.7 };
        players.forEach(function (q) { if (U.overlap(q, box)) H.hurt(q, mini.bx, events); });
        if ((mini.side < 0 && mini.bx > W + 160) || (mini.side > 0 && mini.bx < -160)) {
          mini.phase = 'land'; mini.t = 60; mini.px = rnd(mini) < 0.5 ? 150 : W - 150;
          mini.bx = mini.px; mini.by = -80;
        }
      } else if (mini.phase === 'land') {
        mini.by += (GY - 70 - mini.by) * 0.12;
        if (mini.t <= 0) { mini.phase = 'perch'; mini.t = rage ? 150 : 210; mini.peck = 70; events.push('boom'); }
      } else if (mini.phase === 'perch') {
        // 停在甲板上：頭可以踩；面向玩家，每隔一陣子往前啄
        const p = state.player;
        mini.face = p.x + p.w / 2 > mini.bx ? 1 : -1;
        if (--mini.peck <= 0) {
          mini.peck = rage ? 55 : 75;
          const beak = { x: mini.bx + (mini.face > 0 ? 40 : -110), y: GY - 70, w: 70, h: 60 };
          players.forEach(function (q) { if (U.overlap(q, beak)) H.hurt(q, mini.bx, events); });
          mini.pecked = 10; events.push('clang');
        }
        if (mini.pecked > 0) mini.pecked--;
        const head = { x: mini.bx + mini.face * 34 - 40, y: GY - 124, w: 80, h: 36 };      // 停著的時候頭在身體前上方
        players.forEach(function (q) {
          if (mini.phase === 'perch' && mini.hurtT === 0 && stomped(q, head)) {
            mini.hp--; mini.hurtT = 40; events.push('hit');
            H.burst(state, mini.bx, GY - 110, '#ffd070', 16);
            if (mini.hp <= 0) win();
            else { mini.phase = 'soar'; mini.t = rage ? 150 : 200; }
          }
        });
        if (mini.phase === 'perch' && mini.t <= 0) { mini.phase = 'soar'; mini.t = 180; }
      }
      // 大石頭：拋物線落下，落地碎掉
      mini.rocks.forEach(function (r) {
        r.x += r.vx; r.vy += 0.16; r.y += r.vy;
        const box = { x: r.x - r.r, y: r.y - r.r, w: r.r * 2, h: r.r * 2 };
        players.forEach(function (q) { if (!r.dead && U.overlap(q, box)) { r.dead = true; H.hurt(q, r.x, events); } });
        if (!r.dead && r.y + r.r >= GY) { r.dead = true; H.burst(state, r.x, GY - 4, '#a08a70', 10); events.push('boom'); }
      });
      mini.rocks = mini.rocks.filter(function (r) { return !r.dead; });
      if (!mini.done && mini.time <= 0) fail();
    },
    draw: function (ctx, state, t, GY) {
      const mini = state.mini;
      deckSea(ctx, GY, t, '#3a8ab0');
      // 石頭的影子＋石頭
      mini.rocks.forEach(function (r) {
        const k = U.clamp(1 - (GY - r.y) / GY, 0.1, 1);
        ctx.fillStyle = 'rgba(0, 0, 0, ' + (0.15 + k * 0.3).toFixed(2) + ')';
        ctx.beginPath(); ctx.ellipse(r.tx, GY - 2, 8 + k * 14, 3 + k * 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8a7a64'; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a8987e'; ctx.beginPath(); ctx.arc(r.x - 4, r.y - 4, r.r * 0.4, 0, Math.PI * 2); ctx.fill();
      });
      if (mini.phase === 'warn') {
        // 紅條：牠要從這一邊貼著甲板衝過來
        ctx.fillStyle = 'rgba(255, 60, 50, ' + (0.25 + Math.abs(Math.sin(t * 0.3)) * 0.3).toFixed(2) + ')';
        ctx.fillRect(0, GY - 62, W, 44);
        U.text(ctx, mini.side < 0 ? '◀◀ 跳！' : '跳！ ▶▶', W / 2, GY - 40, { size: 18, color: '#ffffff', strokeWidth: 4 });
      }
      ctx.save(); ctx.translate(mini.bx, mini.by);
      if (mini.hurtT > 0 && Math.floor(mini.hurtT / 4) % 2 === 0) ctx.globalAlpha = 0.5;
      const dir = mini.phase === 'dive' ? -mini.side : mini.phase === 'perch' ? mini.face : mini.dir;
      drawRoc(ctx, t, dir, mini.phase === 'perch', mini.pecked > 0, mini.phase === 'perch' && mini.peck < 20);
      ctx.restore();
      hpBar(ctx, '大鵬金翅鳥', mini.hp, ROC_HP, mini.hp <= 2);
    },
    hud: function (mini, sec) { return '踩頭 ' + (ROC_HP - mini.hp) + ' / ' + ROC_HP + '　剩 ' + sec + ' 秒　（牠停在甲板上時跳到頭上踩）'; },
    drawMap: function (ctx, t) { ctx.save(); ctx.translate(0, -6); ctx.scale(0.16, 0.16); drawRoc(ctx, t, 1, false, false, false); ctx.restore(); }
  });
  /** 大鵬（原點 = 身體中心；perch = 停著、翅膀收起來；peck = 啄出去；warn = 要啄了閃紅） */
  function drawRoc(ctx, t, dir, perch, peck, warn) {
    ctx.save(); ctx.scale(dir || 1, 1);
    const flap = perch ? 0 : Math.sin(t * 0.2) * 30;
    ctx.fillStyle = '#b84a20';
    if (perch) {
      ctx.beginPath(); ctx.ellipse(-20, -10, 70, 40, -0.2, 0, Math.PI * 2); ctx.fill();          // 收起來的翅膀
      ctx.fillStyle = '#e8b830'; ctx.fillRect(-14, 30, 8, 40); ctx.fillRect(16, 30, 8, 40);        // 腳
    } else {
      ctx.beginPath(); ctx.moveTo(-10, -6); ctx.quadraticCurveTo(-90, -60 - flap, -190, -20 - flap); ctx.quadraticCurveTo(-100, 10, -10, 14); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10, -6); ctx.quadraticCurveTo(90, -60 - flap, 190, -20 - flap); ctx.quadraticCurveTo(100, 10, 10, 14); ctx.fill();
      ctx.fillStyle = '#e8b830';
      for (let k = 0; k < 5; k++) { ctx.fillRect(-180 + k * 24, -22 - flap * (1 - k / 6), 14, 5); ctx.fillRect(166 - k * 24, -22 - flap * (1 - k / 6), 14, 5); }
    }
    ctx.fillStyle = '#d8602a'; ctx.beginPath(); ctx.ellipse(0, 0, 54, 34, 0, 0, Math.PI * 2); ctx.fill();           // 身體
    ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.ellipse(10, 10, 30, 18, 0, 0, Math.PI * 2); ctx.fill();        // 金色的胸毛
    const hx = perch ? 34 : 56, hy = perch ? -50 : -10;
    ctx.fillStyle = '#d8602a'; ctx.beginPath(); ctx.arc(hx, hy, 24, 0, Math.PI * 2); ctx.fill();                   // 頭
    ctx.fillStyle = '#e8b830';
    ctx.beginPath(); ctx.moveTo(hx - 10, hy - 20); ctx.lineTo(hx - 24, hy - 46); ctx.lineTo(hx + 2, hy - 24); ctx.fill();   // 頭冠
    ctx.fillStyle = warn ? '#ff4a3a' : '#f2c230';
    ctx.beginPath(); ctx.moveTo(hx + 18, hy - 8); ctx.lineTo(hx + (peck ? 64 : 46), hy + 4); ctx.lineTo(hx + 16, hy + 10); ctx.closePath(); ctx.fill();   // 鳥嘴
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(hx + 8, hy - 6, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(hx + 9, hy - 7, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b84a20';
    ctx.beginPath(); ctx.moveTo(-50, -4); ctx.lineTo(-96, -20); ctx.lineTo(-92, 6); ctx.lineTo(-96, 26); ctx.closePath(); ctx.fill();   // 尾巴
    ctx.restore();
  }

  // ════════════════════════════════════════════════════════
  // 2. 東海龍王
  // ════════════════════════════════════════════════════════
  const DRAGON_HP = 6, SEGS = 18;
  Encounter.registerMini('dragon', {
    at: [122.5, 36.5],       // 黃海（東海的北邊；南邊留給安宅船）
    def: { name: '東海龍王', lv: '魔王', exp: 150, bossExp: 350, bossCoins: 350, game: '東海的龍王', as: true, boss: true, duration: 100 * 60,
           fact: '中國的傳說裡，東海龍王住在海底的水晶宮；《西遊記》的孫悟空就是去他那裡借走了金箍棒。',
           goal: '水花 = 龍要躍出來・紅圈 = 火球落點・頭靠在甲板上時踩龍珠' },
    arena: function () { return { sky: ['#2a4a6a', '#8ab0c8'], spawnX: 460 }; },
    init: function (state, mini) {
      seed(mini); mini.hp = DRAGON_HP; mini.phase = 'splash'; mini.t = 60; mini.side = 1; mini.trail = []; mini.hx = -200; mini.hy = 600;
      mini.fires = []; mini.flames = []; mini.wave = null; mini.hurtT = 0; mini.spat = 0;
    },
    update: function (state, input, mini, events, win, fail, players) {
      const GY = Levels.GROUND_Y, rage = mini.hp <= 3;
      if (mini.hurtT > 0) mini.hurtT--;
      mini.t--;
      if (mini.phase === 'splash') {
        if (mini.t <= 0) {
          mini.phase = 'arc'; mini.t = 0; mini.k = 0;
          mini.x0 = mini.side > 0 ? -80 : W + 80; mini.x1 = W - mini.x0; mini.peak = 180 + rnd(mini) * 60;
          events.push('shoo');
        }
      } else if (mini.phase === 'arc') {
        // 頭沿著拋物線從一邊的海裡躍到另一邊，身體跟著頭走過的路
        mini.k += rage ? 0.0105 : 0.0085;
        const k = Math.min(1, mini.k);
        mini.hx = mini.x0 + (mini.x1 - mini.x0) * k;
        mini.hy = GY + 60 - (GY + 60 - mini.peak) * 4 * k * (1 - k);
        if (k >= 1 && mini.trail.length && mini.trail[0].y > GY + 40) { mini.phase = 'spit'; mini.t = 40; mini.spat = 0; mini.side = -mini.side; }
      } else if (mini.phase === 'spit') {
        // 頭浮在上面，一顆一顆往你吐火球
        mini.hx += ((mini.side > 0 ? 220 : W - 220) - mini.hx) * 0.06;
        mini.hy += (120 - mini.hy) * 0.06;
        if (mini.t <= 0) {
          const p = state.player;
          const tx = U.clamp(p.x + p.w / 2 + (rnd(mini) - 0.5) * 120, 40, W - 40);
          mini.fires.push({ x: mini.hx, y: mini.hy + 20, tx: tx, k: 0 });
          if (rage) mini.fires.push({ x: mini.hx, y: mini.hy + 20, tx: U.clamp(W - tx, 40, W - 40), k: 0 });
          mini.spat++; mini.t = rage ? 34 : 46; events.push('shoot');
          if (mini.spat >= 3) { mini.phase = 'toRest'; mini.t = 70; mini.rx = mini.side > 0 ? 120 : W - 120; }
        }
      } else if (mini.phase === 'toRest') {
        mini.hx += (mini.rx - mini.hx) * 0.08;
        mini.hy += (GY - 34 - mini.hy) * 0.08;
        if (mini.t <= 0) { mini.phase = 'rest'; mini.t = rage ? 130 : 170; }
      } else if (mini.phase === 'rest') {
        // 頭靠在甲板上喘氣：額頭的龍珠可以踩
        const head = { x: mini.hx - 40, y: GY - 76, w: 80, h: 30 };
        players.forEach(function (q) {
          if (mini.phase === 'rest' && mini.hurtT === 0 && stomped(q, head)) {
            mini.hp--; mini.hurtT = 40; events.push('hit');
            H.burst(state, mini.hx, GY - 70, '#a8f0ff', 18);
            if (mini.hp <= 0) win();
            else mini.t = 0;
          }
        });
        if (mini.phase === 'rest' && mini.t <= 0) {
          if (rage && !mini.wave) { mini.wave = { x: mini.rx < W / 2 ? -60 : W + 60, dir: mini.rx < W / 2 ? 1 : -1 }; events.push('shoo'); }
          mini.phase = 'splash'; mini.t = 70; mini.side = rnd(mini) < 0.5 ? -1 : 1;
          mini.hy = GY + 200;
        }
      }
      // 身體：記住頭走過的路（只在躍出來、吐火的時候畫身體）
      mini.trail.unshift({ x: mini.hx, y: mini.hy });
      if (mini.trail.length > SEGS * 5) mini.trail.pop();
      if (mini.phase === 'arc') {
        for (let s = 1; s < SEGS; s++) {
          const q0 = mini.trail[s * 5];
          if (!q0 || q0.y > GY) continue;
          players.forEach(function (q) { if (Math.hypot(q.x + q.w / 2 - q0.x, q.y + q.h / 2 - q0.y) < 30) H.hurt(q, q0.x, events); });
        }
        players.forEach(function (q) { if (Math.hypot(q.x + q.w / 2 - mini.hx, q.y + q.h / 2 - mini.hy) < 36) H.hurt(q, mini.hx, events); });
      }
      // 火球：60 帧飛到落點，落地變成一團火燒 50 帧
      mini.fires.forEach(function (f) {
        f.k += 1 / 60;
        if (f.k >= 1) {
          f.dead = true; mini.flames.push({ x: f.tx, t: 50 });
          players.forEach(function (q) { if (Math.abs(q.x + q.w / 2 - f.tx) < 36 && q.y + q.h > GY - 50) H.hurt(q, f.tx, events); });
          events.push('boom');
        }
      });
      mini.fires = mini.fires.filter(function (f) { return !f.dead; });
      mini.flames.forEach(function (f) {
        f.t--;
        players.forEach(function (q) { if (Math.abs(q.x + q.w / 2 - f.x) < 26 && q.y + q.h > GY - 30) H.hurt(q, f.x, events); });
      });
      mini.flames = mini.flames.filter(function (f) { return f.t > 0; });
      // 發怒後的浪：貼著甲板掃過去（跳過去）
      if (mini.wave) {
        mini.wave.x += mini.wave.dir * 6;
        const box = { x: mini.wave.x - 30, y: GY - 40, w: 60, h: 40 };
        players.forEach(function (q) { if (U.overlap(q, box)) H.hurt(q, mini.wave.x, events); });
        if (mini.wave.x < -80 || mini.wave.x > W + 80) mini.wave = null;
      }
      if (!mini.done && mini.time <= 0) fail();
    },
    draw: function (ctx, state, t, GY) {
      const mini = state.mini;
      deckSea(ctx, GY, t, '#1e5a7a');
      if (mini.phase === 'splash') {
        // 要躍出來的那一邊冒水花
        const sx = mini.side > 0 ? 40 : W - 40;
        ctx.fillStyle = 'rgba(220, 245, 255, 0.85)';
        for (let k = 0; k < 6; k++) { const ph = (t * 0.6 + k * 9) % 40; ctx.beginPath(); ctx.arc(sx + (k - 2.5) * 12, GY - 20 - ph * 2, 6 - ph * 0.1, 0, Math.PI * 2); ctx.fill(); }
      }
      // 火球落點的紅圈＋飛行中的火球
      mini.fires.forEach(function (f) {
        ctx.strokeStyle = 'rgba(255, 60, 50, ' + (0.4 + f.k * 0.5).toFixed(2) + ')'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(f.tx, GY - 2, 36, 8, 0, 0, Math.PI * 2); ctx.stroke();
        const x = f.x + (f.tx - f.x) * f.k, y = f.y + (GY - 10 - f.y) * f.k - Math.sin(f.k * Math.PI) * 80;
        ctx.fillStyle = '#ff8a30'; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffe070'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      });
      mini.flames.forEach(function (f) {
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = ['#ff5a2a', '#ffa030', '#ffe070'][k];
          const fl = Math.sin(t * 0.4 + k * 2) * 4;
          ctx.beginPath(); ctx.moveTo(f.x - 22 + k * 6, GY); ctx.quadraticCurveTo(f.x + fl, GY - 46 + k * 10, f.x + 22 - k * 6, GY); ctx.fill();
        }
      });
      if (mini.wave) {
        ctx.fillStyle = '#4ab0e0';
        ctx.beginPath(); ctx.moveTo(mini.wave.x - 40, GY); ctx.quadraticCurveTo(mini.wave.x, GY - 70, mini.wave.x + 40 * mini.wave.dir, GY); ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.beginPath(); ctx.arc(mini.wave.x + 8 * mini.wave.dir, GY - 44, 8, 0, Math.PI * 2); ctx.fill();
      }
      // 身體（從尾巴畫到頭）
      if (mini.phase !== 'splash') {
        for (let s = SEGS - 1; s >= 1; s--) {
          const q0 = mini.trail[s * 5];
          if (!q0 || q0.y > GY + 80) continue;
          const r = 22 - s * 0.7;
          ctx.fillStyle = s % 2 ? '#2a8a5a' : '#3aa86a';
          ctx.beginPath(); ctx.arc(q0.x, q0.y, r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#e8c050'; ctx.beginPath(); ctx.arc(q0.x, q0.y + r * 0.5, r * 0.45, 0, Math.PI * 2); ctx.fill();
          if (s % 3 === 0) { ctx.fillStyle = '#c8302a'; ctx.beginPath(); ctx.moveTo(q0.x - 6, q0.y - r); ctx.lineTo(q0.x, q0.y - r - 12); ctx.lineTo(q0.x + 6, q0.y - r); ctx.fill(); }
        }
        const prev = mini.trail[4] || mini.trail[0];
        const face = mini.phase === 'rest' || mini.phase === 'toRest' ? (mini.rx < W / 2 ? 1 : -1) : (mini.hx >= prev.x ? 1 : -1);
        ctx.save(); ctx.translate(mini.hx, mini.hy);
        if (mini.hurtT > 0 && Math.floor(mini.hurtT / 4) % 2 === 0) ctx.globalAlpha = 0.5;
        drawDragonHead(ctx, t, face, mini.phase === 'rest');
        ctx.restore();
      }
      hpBar(ctx, '東海龍王', mini.hp, DRAGON_HP, mini.hp <= 3);
    },
    hud: function (mini, sec) { return '踩龍珠 ' + (DRAGON_HP - mini.hp) + ' / ' + DRAGON_HP + '　剩 ' + sec + ' 秒　（龍把頭靠在甲板上時跳上去踩）'; },
    drawMap: function (ctx, t) {
      ctx.save(); ctx.translate(0, -2);
      for (let s = 6; s >= 0; s--) {
        ctx.fillStyle = s % 2 ? '#2a8a5a' : '#3aa86a';
        ctx.beginPath(); ctx.arc(-12 + s * 3, -Math.sin(s * 0.6 + t * 0.08) * 4 - s * 1.2, 3.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.translate(10, -12); ctx.scale(0.22, 0.22); drawDragonHead(ctx, t, 1, false);
      ctx.restore();
    }
  });
  /** 龍頭（原點 = 頭的中心，face = 往哪邊看）；rest = 喘氣、額頭的龍珠發亮 */
  function drawDragonHead(ctx, t, face, rest) {
    ctx.save(); ctx.scale(face, 1);
    ctx.fillStyle = '#3aa86a';
    ctx.beginPath(); ctx.ellipse(0, 0, 40, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(20, -14); ctx.lineTo(62, -6); ctx.lineTo(62, 12); ctx.lineTo(20, 18); ctx.closePath(); ctx.fill();   // 長長的嘴
    ctx.fillStyle = '#f4f0e6'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(28 + k * 9, 12); ctx.lineTo(32 + k * 9, 20); ctx.lineTo(36 + k * 9, 12); ctx.fill(); }
    ctx.strokeStyle = '#e8c050'; ctx.lineWidth = 4;                                   // 鹿角
    ctx.beginPath(); ctx.moveTo(-10, -20); ctx.lineTo(-24, -52); ctx.moveTo(-18, -38); ctx.lineTo(-34, -42); ctx.moveTo(4, -22); ctx.lineTo(-4, -54); ctx.stroke();
    ctx.strokeStyle = '#f4f0e6'; ctx.lineWidth = 2.5;                                 // 龍鬚
    const w = Math.sin(t * 0.15) * 8;
    ctx.beginPath(); ctx.moveTo(56, 4); ctx.quadraticCurveTo(80, 20 + w, 70, 40 + w); ctx.moveTo(52, -6); ctx.quadraticCurveTo(84, -10 - w, 92, 6 - w); ctx.stroke();
    ctx.fillStyle = '#ffe070'; ctx.beginPath(); ctx.arc(14, -6, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(16, -6, 3, 0, Math.PI * 2); ctx.fill();
    // 額頭的龍珠
    ctx.fillStyle = rest ? 'rgba(170, 240, 255, ' + (0.7 + Math.sin(t * 0.3) * 0.3).toFixed(2) + ')' : '#8ad0e0';
    ctx.beginPath(); ctx.arc(-6, -20, rest ? 10 : 7, 0, Math.PI * 2); ctx.fill();
    if (rest) { ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(-6, -20, 16 + Math.sin(t * 0.2) * 3, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }

  // ════════════════════════════════════════════════════════
  // 3. 八岐大蛇
  // ════════════════════════════════════════════════════════
  const OROCHI_HEADS = 8, VAT_X = [80, 190, 300, 410, 550, 660, 770, 880], VAT_W = 40, VAT_H = 34;
  const DRINK_T = 80, DRUNK_T = 220, AIM_T = 55;
  Encounter.registerMini('orochi', {
    at: [134.5, 38.5],
    def: { name: '八岐大蛇', lv: '魔王', exp: 150, bossExp: 400, bossCoins: 400, game: '日本海的大蛇', as: true, boss: true, duration: 120 * 60,
           fact: '日本神話裡，素戔嗚尊在八個門口各放一罈烈酒，八岐大蛇的八顆頭把酒喝光、醉倒睡著了，他才砍倒大蛇。',
           goal: '碰酒罈打開蓋子，蛇頭喝醉了才踩得到・紅圈 = 要咬下來' },
    arena: function () { return { sky: ['#3a2a4a', '#a8889a'], spawnX: 460 }; },
    init: function (state, mini) {
      seed(mini); mini.down = 0; mini.vats = VAT_X.map(function (x) { return { x: x, open: false, empty: false, refill: 0 }; });
      mini.heads = [];
      for (let k = 0; k < OROCHI_HEADS; k++) mini.heads.push({ i: k, alive: true, state: 'home', t: 40 + k * 25, x: 60 + k * 120, y: 160, home: 60 + k * 120 });
    },
    update: function (state, input, mini, events, win, fail, players) {
      const GY = Levels.GROUND_Y, rage = mini.down >= 4, p = state.player;
      // 碰一下打開酒罈的蓋子
      mini.vats.forEach(function (v) {
        if (v.empty) { if (--v.refill <= 0) v.empty = false; return; }
        if (v.open) return;
        const box = { x: v.x - VAT_W / 2, y: GY - VAT_H, w: VAT_W, h: VAT_H };
        if (players.some(function (q) { return U.overlap(q, box); })) { v.open = true; events.push('catch'); }
      });
      const biting = mini.heads.filter(function (h) { return h.alive && (h.state === 'aim' || h.state === 'bite'); }).length;
      mini.heads.forEach(function (h) {
        if (!h.alive) return;
        h.t--;
        if (h.state === 'home') {
          // 在甲板後面的海上搖來搖去
          h.x += (h.home - h.x) * 0.05; h.y += (150 + Math.sin(mini.elapsed * 0.04 + h.i) * 20 - h.y) * 0.08;
          // 有打開的酒罈：最近的空閒的頭過去喝
          const v = mini.vats.filter(function (q) { return q.open && q.taken == null; }).sort(function (a, b) { return Math.abs(a.x - h.x) - Math.abs(b.x - h.x); })[0];
          if (v) { v.taken = h.i; h.state = 'toVat'; h.vi = mini.vats.indexOf(v); return; }     // 存索引（連線時狀態要能轉成 JSON）
          if (h.t <= 0 && biting < (rage ? 3 : 2)) { h.state = 'aim'; h.t = rage ? AIM_T - 15 : AIM_T; h.tx = p.x + p.w / 2; }
          else if (h.t <= 0) h.t = 30;
        } else if (h.state === 'aim') {
          h.x += (h.tx - h.x) * 0.1; h.y += (GY - 220 - h.y) * 0.1;
          if (h.t <= 0) { h.state = 'bite'; h.t = 10; }
        } else if (h.state === 'bite') {
          h.y += (GY - 30 - h.y) * 0.5;
          if (h.t <= 0) {
            players.forEach(function (q) { if (Math.abs(q.x + q.w / 2 - h.tx) < 40 && q.y + q.h > GY - 90) H.hurt(q, h.tx, events); });
            events.push('clang');
            h.state = 'back'; h.t = 30;
          }
        } else if (h.state === 'back') {
          h.y += (150 - h.y) * 0.1;
          if (h.t <= 0) { h.state = 'home'; h.t = 60 + Math.floor(rnd(mini) * 80); }
        } else if (h.state === 'toVat') {
          h.x += (mini.vats[h.vi].x - h.x) * 0.08; h.y += (GY - VAT_H - 20 - h.y) * 0.08;
          if (Math.abs(h.x - mini.vats[h.vi].x) < 6) { h.state = 'drink'; h.t = DRINK_T; }
        } else if (h.state === 'drink') {
          if (h.t <= 0) {
            h.state = 'drunk'; h.t = DRUNK_T;
            mini.vats[h.vi].open = false; mini.vats[h.vi].empty = true; mini.vats[h.vi].refill = 360; mini.vats[h.vi].taken = null;
            h.x = mini.vats[h.vi].x + (mini.vats[h.vi].x < W / 2 ? 50 : -50); h.y = GY - 18;
            events.push('shoo');
          }
        } else if (h.state === 'drunk') {
          // 醉倒趴在甲板上：踩頭就倒
          const box = { x: h.x - 34, y: GY - 38, w: 68, h: 38 };
          players.forEach(function (q) {
            if (h.alive && h.state === 'drunk' && stomped(q, box)) {
              h.alive = false; mini.down++; events.push('hit');
              H.burst(state, h.x, GY - 20, '#e8d0ff', 18);
            }
          });
          if (h.alive && h.t <= 0) { h.state = 'back'; h.t = 40; }
        }
      });
      // 酒罈被打開、但蛇頭都沒空（或都倒了）：先保持打開
      if (mini.down >= OROCHI_HEADS) win();
      else if (!mini.done && mini.time <= 0) fail();
    },
    draw: function (ctx, state, t, GY) {
      const mini = state.mini;
      deckSea(ctx, GY, t, '#2a3a5a');
      // 蛇頸：從海裡伸出來連到每顆頭
      mini.heads.forEach(function (h) {
        if (!h.alive) return;
        const bx = 60 + h.i * 120;
        ctx.strokeStyle = '#4a5a3a'; ctx.lineWidth = 22; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(bx, GY - 100); ctx.quadraticCurveTo((bx + h.x) / 2 + Math.sin(t * 0.05 + h.i) * 30, Math.min(h.y, GY - 100) - 40, h.x, h.y); ctx.stroke();
        ctx.strokeStyle = '#6a7a4a'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(bx, GY - 100); ctx.quadraticCurveTo((bx + h.x) / 2 + Math.sin(t * 0.05 + h.i) * 30, Math.min(h.y, GY - 100) - 40, h.x, h.y); ctx.stroke();
        ctx.lineCap = 'butt';
      });
      // 酒罈
      mini.vats.forEach(function (v) {
        ctx.fillStyle = v.empty ? '#6a5a4a' : '#a8603a';
        ctx.beginPath(); ctx.ellipse(v.x, GY - VAT_H / 2, VAT_W / 2, VAT_H / 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f4ead0'; ctx.fillRect(v.x - 10, GY - VAT_H + 8, 20, 12);
        U.text(ctx, '酒', v.x, GY - VAT_H + 14, { size: 9, color: '#2a1a10', stroke: false });
        if (!v.open && !v.empty) { ctx.fillStyle = '#5a3a1a'; ctx.fillRect(v.x - 14, GY - VAT_H - 4, 28, 6); }    // 蓋子
        if (v.open) {
          ctx.strokeStyle = 'rgba(255, 240, 200, 0.6)'; ctx.lineWidth = 1.5;                               // 酒香
          for (let k = 0; k < 3; k++) { const ph = (t * 0.5 + k * 10) % 30; ctx.beginPath(); ctx.moveTo(v.x - 6 + k * 6, GY - VAT_H - ph); ctx.quadraticCurveTo(v.x - 2 + k * 6, GY - VAT_H - ph - 6, v.x - 6 + k * 6, GY - VAT_H - ph - 12); ctx.stroke(); }
        }
      });
      // 要咬下來的紅圈
      mini.heads.forEach(function (h) {
        if (h.alive && h.state === 'aim') {
          ctx.strokeStyle = 'rgba(255, 60, 50, ' + (0.4 + (1 - h.t / AIM_T) * 0.5).toFixed(2) + ')'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.ellipse(h.tx, GY - 2, 40, 9, 0, 0, Math.PI * 2); ctx.stroke();
        }
      });
      mini.heads.forEach(function (h) {
        if (!h.alive) return;
        ctx.save(); ctx.translate(h.x, h.y);
        drawSnakeHead(ctx, t, h.state === 'drunk', h.state === 'bite' || h.state === 'aim', h.state === 'drink');
        ctx.restore();
      });
      hpBar(ctx, '八岐大蛇', OROCHI_HEADS - mini.down, OROCHI_HEADS, mini.down >= 4);
    },
    hud: function (mini, sec) { return '打倒的頭 ' + mini.down + ' / ' + OROCHI_HEADS + '　剩 ' + sec + ' 秒　（碰酒罈打開蓋子，喝醉的頭才踩得到）'; },
    drawMap: function (ctx, t) {
      for (let k = 0; k < 8; k++) {
        const a = -Math.PI * 0.9 + k * Math.PI * 0.8 / 7, sw = Math.sin(t * 0.1 + k) * 2;
        ctx.strokeStyle = '#4a5a3a'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(0, 2); ctx.quadraticCurveTo(Math.cos(a) * 8, Math.sin(a) * 8, Math.cos(a) * 14 + sw, Math.sin(a) * 14 - 4); ctx.stroke();
        ctx.fillStyle = '#6a7a4a'; ctx.beginPath(); ctx.arc(Math.cos(a) * 14 + sw, Math.sin(a) * 14 - 4, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff3a2a'; ctx.fillRect(Math.cos(a) * 14 + sw, Math.sin(a) * 14 - 5, 1, 1);
      }
    }
  });
  /** 蛇頭（原點 = 頭的中心）：drunk = 醉倒（閉眼、臉紅、冒 zzz）、open = 張嘴要咬、drink = 低頭喝酒 */
  function drawSnakeHead(ctx, t, drunk, open, drink) {
    if (drunk) ctx.rotate(0.25);
    ctx.fillStyle = '#5a6a3a';
    ctx.beginPath(); ctx.ellipse(0, 0, 32, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a9a5a'; ctx.beginPath(); ctx.ellipse(6, 8, 22, 9, 0, 0, Math.PI * 2); ctx.fill();
    if (open) {
      ctx.fillStyle = '#7a1a1a'; ctx.beginPath(); ctx.moveTo(10, 4); ctx.lineTo(44, -6); ctx.lineTo(44, 22); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f4f0e6'; ctx.beginPath(); ctx.moveTo(30, 0); ctx.lineTo(34, 10); ctx.lineTo(38, -2); ctx.fill();
    }
    if (drunk) {
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(8, -8); ctx.lineTo(18, -8); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 90, 110, 0.6)'; ctx.beginPath(); ctx.ellipse(10, 4, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
      const ph = (t * 0.6) % 40;
      U.text(ctx, 'z', 30 + ph * 0.4, -20 - ph, { size: 12 + ph * 0.15, color: '#ffffff', strokeWidth: 3 });
    } else {
      ctx.fillStyle = drink ? '#ffd070' : '#ff3a2a'; ctx.beginPath(); ctx.arc(12, -8, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(12, -12, 2, 8);
    }
    ctx.fillStyle = '#4a5a2a';
    ctx.beginPath(); ctx.moveTo(-20, -14); ctx.lineTo(-30, -30); ctx.lineTo(-10, -18); ctx.fill();
  }

  return { ROC_HP: ROC_HP, DRAGON_HP: DRAGON_HP, OROCHI_HEADS: OROCHI_HEADS, VAT_X: VAT_X };
})();
