'use strict';

/**
 * v1.32.1 亞洲篇（絲路）的招牌機制。用 Features.register 掛進 features.js（features.js 之後、levels.js 之前載入）。
 *
 *   伊朗・伊斯法罕（def.carpet：整關坐飛毯，跳躍 = 往上飛一下，物理跟潛水一樣輕飄飄的，但不用換氣）
 *     winds     熱氣流（金色，往上托）和下沉氣流（藍色，往下壓）一段一段交錯
 *     minarets  宣禮塔：高高的塔頂碰到會痛，要從上面飛過去
 *   烏茲別克・撒馬爾罕
 *     caravan   護送駱駝商隊：一隻駱駝沿著你走過的路跟在後面；前面不時冒出盜賊往回走去搶駱駝，
 *               踩倒他們。駱駝被撞到三次 = 貨被搶光，扣一條命（駱駝回到 3 顆心繼續走）
 *
 * 美術（駱駝、宣禮塔、氣流、飛毯）也畫在這裡；國旗、遠景、地標、敵人的長相在 asia.js。
 */
const SilkRoad = (function () {
  const WIND_W = 360, WIND_PUSH = 0.17;
  const MINARET_W = 34;
  const CAMEL_W = 50, CAMEL_H = 38, CAMEL_LAG = 26, CAMEL_HP = 3;

  // ── 熱氣流／下沉氣流 ──
  Features.register('winds', {
    plan: function (c, ctx, list) {
      const n = c.count || 5, W = ctx.width;
      for (let i = 0; i < n; i++) {
        const x = Math.round(W * (0.14 + 0.72 * i / Math.max(1, n - 1)));
        if (Math.abs(x - ctx.goal) < 500) continue;
        list.push({ type: 'wind', x0: x, x1: x + WIND_W, dir: i % 2 ? 1 : -1 });     // -1 往上托、+1 往下壓
      }
    }
  });
  Features.register('wind', {
    update: function (state, f, players) {
      players.forEach(function (p) {
        const cx = p.x + p.w / 2;
        if (cx < f.x0 || cx > f.x1 || p.onGround) return;
        const k = p.stats && p.stats.stormProof ? 0.5 : 1;          // 圖阿雷格頭巾：風不怕
        p.vy += f.dir * WIND_PUSH * k;
      });
    },
    draw: function (ctx, state, f, camX, t) {
      const sx = f.x0 - camX;
      if (sx > 1000 || sx + WIND_W < -40) return;
      const up = f.dir < 0;
      ctx.save();
      const g = ctx.createLinearGradient(0, 60, 0, 420);
      g.addColorStop(0, up ? 'rgba(255, 210, 120, 0)' : 'rgba(120, 170, 230, 0.16)');
      g.addColorStop(1, up ? 'rgba(255, 210, 120, 0.16)' : 'rgba(120, 170, 230, 0)');
      ctx.fillStyle = g; ctx.fillRect(sx, 60, WIND_W, 360);
      ctx.strokeStyle = up ? 'rgba(255, 220, 140, 0.55)' : 'rgba(170, 210, 255, 0.55)'; ctx.lineWidth = 2;
      for (let k = 0; k < 9; k++) {
        const lx = sx + 20 + k * 38 + Math.sin(t * 0.05 + k) * 6;
        const ph = ((t * 2.2 * (up ? -1 : 1) + k * 47) % 360 + 360) % 360;
        const y0 = 70 + ph;
        ctx.beginPath(); ctx.moveTo(lx, y0); ctx.quadraticCurveTo(lx + 8, y0 + 18, lx, y0 + 36); ctx.stroke();
        // 箭頭
        const ay = up ? y0 : y0 + 36;
        ctx.beginPath(); ctx.moveTo(lx - 5, ay + (up ? 7 : -7)); ctx.lineTo(lx, ay); ctx.lineTo(lx + 5, ay + (up ? 7 : -7)); ctx.stroke();
      }
      ctx.restore();
    }
  });

  // ── 宣禮塔 ──
  Features.register('minarets', {
    plan: function (c, ctx, list) {
      const n = c.count || 6, W = ctx.width, F = Features.helpers;
      for (let i = 0; i < n; i++) {
        const sp = F.findSpot(ctx, W * (0.12 + 0.76 * i / Math.max(1, n - 1)), MINARET_W, 210);
        if (!sp || sp.x < 700) continue;
        const h = 140 + ((i * 37) % 4) * 12;                    // 140～176，加上圓頂不超過 200
        list.push({ type: 'minaret', x: sp.x, y: sp.y, h: h });
        ctx.avoid.push({ x: sp.x - 90, y: 0, w: MINARET_W + 180, h: 600 });
      }
    }
  });
  function minaretBox(f) { return { x: f.x, y: f.y - f.h - 26, w: MINARET_W, h: f.h + 26 }; }
  Features.register('minaret', {
    update: function (state, f, players, lead, events) {
      const box = minaretBox(f);
      players.forEach(function (p, i) { if (U.overlap(p, box)) Features.helpers.hurt(p, f.x + MINARET_W / 2, events, Features.helpers.pidOf(p, i)); });
    },
    draw: function (ctx, state, f, camX, t) {
      const sx = f.x - camX;
      if (sx < -60 || sx > 1020) return;
      const top = f.y - f.h;
      ctx.save();
      // 塔身（藍色磁磚＋一圈圈白線）
      const g = ctx.createLinearGradient(sx, 0, sx + MINARET_W, 0);
      g.addColorStop(0, '#2a5a9a'); g.addColorStop(0.5, '#4a90d0'); g.addColorStop(1, '#2a5a9a');
      ctx.fillStyle = g; ctx.fillRect(sx + 4, top, MINARET_W - 8, f.h);
      ctx.fillStyle = 'rgba(240, 230, 200, 0.8)';
      for (let y = top + 20; y < f.y - 10; y += 26) ctx.fillRect(sx + 4, y, MINARET_W - 8, 3);
      // 陽台
      ctx.fillStyle = '#d8c8a0'; ctx.fillRect(sx, top + 10, MINARET_W, 7);
      // 金色洋蔥圓頂＋新月
      ctx.fillStyle = '#e8b830';
      ctx.beginPath(); ctx.moveTo(sx + 4, top);
      ctx.quadraticCurveTo(sx - 4, top - 14, sx + MINARET_W / 2, top - 26);
      ctx.quadraticCurveTo(sx + MINARET_W + 4, top - 14, sx + MINARET_W - 4, top); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e8b830'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx + MINARET_W / 2, top - 32, 4, Math.PI * 0.3, Math.PI * 1.7); ctx.stroke();
      // 會痛：塔頂一閃一閃的紅光
      ctx.fillStyle = 'rgba(255, 80, 60, ' + (0.15 + Math.abs(Math.sin(t * 0.1)) * 0.25).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(sx + MINARET_W / 2, top - 12, 20, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  });

  // ── 護送駱駝商隊 ──
  Features.register('caravan', {
    plan: function (c, ctx, list) { list.push({ type: 'camelTrain', x: 0, bandits: c.bandits || 8 }); }
  });
  function camelPos(f) {
    if (!f.trail.length) return null;
    const q = f.trail[Math.max(0, f.trail.length - 1 - CAMEL_LAG)];
    return { x: q.x - CAMEL_W / 2, y: q.y - CAMEL_H, w: CAMEL_W, h: CAMEL_H, facing: q.f };
  }
  Features.register('camelTrain', {
    init: function (o) { o.trail = []; o.hp = CAMEL_HP; o.cd = 240; o.spawned = 0; o.flash = 0; o.box = null; },
    update: function (state, f, players, lead, events) {
      const p = state.players[0];
      if (!p || p.out) return;
      const last = f.trail[f.trail.length - 1];
      const fx = p.x + p.w / 2, fy = p.y + p.h;
      if (!last || Math.hypot(fx - last.x, fy - last.y) > 3) {
        f.trail.push({ x: fx, y: fy, f: last ? (fx >= last.x ? 1 : -1) : 1 });
        if (f.trail.length > 400) f.trail.shift();
      }
      f.box = camelPos(f);
      if (f.flash > 0) f.flash--;
      // 盜賊：從前面冒出來，往回（往左）走去搶駱駝
      const def = state.def;
      if (f.spawned < f.bandits && p.x < def.goal - 700 && --f.cd <= 0) {
        f.cd = 300 + (f.spawned * 53) % 160;
        const bx = p.x + 520;
        const seg = (def.groundSegs || []).filter(function (s) { return bx >= s.x + 20 && bx <= s.x + s.w - 40; })[0];
        if (seg && typeof makeEnemy === 'function') {
          const e = makeEnemy({ type: 'walker', x: bx, y: seg.y - 26, left: seg.x + 4, right: seg.x + seg.w - 30, dir: -1, speed: 1.5 });
          e.bandit = true;
          state.enemies.push(e);
          f.spawned++;
          events.push('caravan:bandit');
        }
      }
      // 盜賊撞到駱駝 → 搶走一袋貨
      if (f.box) {
        state.enemies.forEach(function (e) {
          if (!e.alive || !e.bandit || !U.overlap(e, f.box)) return;
          e.alive = false;
          f.hp--; f.flash = 60;
          if (f.hp <= 0) { f.hp = CAMEL_HP; events.push('p0:caravanLost'); }
          else events.push('caravan:hit:' + f.hp);
        });
      }
    },
    draw: function (ctx, state, f, camX, t) {
      if (!f.box) return;
      const b = f.box, sx = b.x - camX;
      if (sx < -80 || sx > 1040) return;
      drawCamel(ctx, sx + b.w / 2, b.y + b.h, t, b.facing || 1, f.flash > 0 && Math.floor(f.flash / 5) % 2 === 0);
      // 頭上的心（駱駝還剩幾袋貨）
      for (let k = 0; k < CAMEL_HP; k++) {
        const hx = sx + b.w / 2 - 14 + k * 14, hy = b.y - 18;
        ctx.fillStyle = k < f.hp ? '#ff6a7a' : 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath(); ctx.arc(hx - 2.4, hy, 3, 0, Math.PI * 2); ctx.arc(hx + 2.4, hy, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(hx - 5.4, hy + 1); ctx.lineTo(hx, hy + 6.5); ctx.lineTo(hx + 5.4, hy + 1); ctx.fill();
      }
    }
  });

  /** 駱駝（x = 腳底中心）：雙峰駱駝（中亞的品種）、紅色鞍毯、兩側掛著布袋，脖子上一串銅鈴 */
  function drawCamel(ctx, x, by, t, facing, dim) {
    ctx.save();
    ctx.translate(x, by);
    ctx.scale(facing, 1);
    if (dim) ctx.globalAlpha = 0.5;
    const step = Math.sin(t * 0.25) * 3;
    ctx.fillStyle = '#a07040';
    [[-16, step], [-8, -step], [8, step], [16, -step]].forEach(function (q) { ctx.fillRect(q[0] - 2, -16, 4, 16 + 0 * q[1]); });
    ctx.fillStyle = '#c08a50';
    ctx.beginPath(); ctx.ellipse(0, -20, 22, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-8, -30, 7, 8, 0, 0, Math.PI * 2); ctx.ellipse(8, -30, 7, 8, 0, 0, Math.PI * 2); ctx.fill();     // 雙峰
    ctx.beginPath(); ctx.moveTo(18, -24); ctx.quadraticCurveTo(30, -26, 30, -40); ctx.lineTo(36, -40); ctx.lineTo(36, -34); ctx.quadraticCurveTo(34, -22, 22, -16); ctx.closePath(); ctx.fill();   // 脖子、頭
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(32, -39, 2, 2);
    ctx.fillStyle = '#b0202e'; ctx.fillRect(-4, -32, 8, 12);        // 鞍毯
    ctx.fillStyle = '#e8c870'; ctx.fillRect(-4, -24, 8, 2);
    ctx.fillStyle = '#7a5a3a';                                        // 布袋
    ctx.beginPath(); ctx.ellipse(-14, -16, 6, 7, 0, 0, Math.PI * 2); ctx.ellipse(13, -16, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8a030';                                        // 銅鈴
    ctx.beginPath(); ctx.arc(27, -24 + Math.sin(t * 0.3) * 1, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** 飛毯（畫在玩家腳下）：紅底、金邊、流蘇，會微微起伏 */
  function drawCarpet(ctx, p, sx, t) {
    const x = sx + p.w / 2, y = p.y + p.h + 2;
    ctx.save();
    ctx.translate(x, y);
    const w = 50, wave = function (u) { return Math.sin(t * 0.18 + u * 0.25) * 2; };
    ctx.fillStyle = '#a8202e';
    ctx.beginPath(); ctx.moveTo(-w / 2, wave(0));
    for (let u = 0; u <= 8; u++) ctx.lineTo(-w / 2 + u * w / 8, wave(u));
    for (let u = 8; u >= 0; u--) ctx.lineTo(-w / 2 + u * w / 8, wave(u) + 8);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#e8b830'; ctx.lineWidth = 1.4;
    ctx.beginPath(); for (let u = 0; u <= 8; u++) ctx.lineTo(-w / 2 + u * w / 8, wave(u) + 4); ctx.stroke();
    ctx.fillStyle = '#e8b830';
    [-w / 2 - 3, w / 2 + 1].forEach(function (fx) { for (let k = 0; k < 4; k++) ctx.fillRect(fx, wave(0) + k * 2, 3, 1.2); });
    ctx.restore();
  }

  return { drawCamel: drawCamel, drawCarpet: drawCarpet, CAMEL_HP: CAMEL_HP, camelPos: camelPos };
})();
