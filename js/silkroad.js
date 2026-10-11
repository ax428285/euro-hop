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
 * v1.33 第二批：
 *   印度・齋浦爾
 *     elephants   騎大象（features.js 的坐騎，kind 'elephant'）：被打到大象會跑掉，等一下走到你身邊等你
 *     barricades  木頭路障：太高跳不過去，只有騎著大象才撞得開（沒大象推一陣子，大象會自己走過來）
 *   尼泊爾・聖母峰
 *     thinAir     高山缺氧：頭上的氧氣條一直掉（跳的時候掉更快），走進雪巴人的氧氣補給站補滿；用完扣一條命
 *   中國・長城
 *     beacons     烽火台：跳起來碰到台頂的火盆就點燃；終點前的關門要全部點燃才會打開
 *     volleys     箭雨：地上出現紅圈，一陣子後箭落下來 —— 快離開紅圈
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

  // ── v1.33 印度：騎大象、撞路障 ──
  const ELE_W = 110, BAR_W = 34, BAR_H = 300;
  Features.register('elephants', {
    plan: function (c, ctx, list) {
      const W = ctx.width, F = Features.helpers;
      (c.at || [0.06, 0.38, 0.68]).forEach(function (k) {
        const sp = F.findSpot(ctx, W * k, ELE_W, 90);
        if (!sp) return;
        list.push({ type: 'mount', kind: 'elephant', x: sp.x, y: sp.y, w: ELE_W });
        ctx.avoid.push({ x: sp.x - 60, y: 0, w: ELE_W + 120, h: 600 });
      });
    }
  });
  /** 地面上一個大象站得下的地方（x 附近；斷崖上就往左找） */
  function groundNear(def, x) {
    for (let d = 0; d < 600; d += 20) {
      const gy = Features.helpers.groundTop(def, x - d + ELE_W / 2);
      const gy2 = Features.helpers.groundTop(def, x - d);
      const gy3 = Features.helpers.groundTop(def, x - d + ELE_W);
      if (gy != null && gy === gy2 && gy === gy3) return { x: x - d, y: gy };
    }
    return null;
  }
  Features.register('mount_elephant', {
    lift: 66,            // 人坐在大象背上的坐墊（象背最高到離地 78）
    /** 大象跑掉之後：走到帶頭的玩家身邊等（不回原地，免得要走回頭路） */
    respawn: function (state, f, players) {
      const lead = players.reduce(function (a, p) { return !a || p.x > a.x ? p : a; }, null);
      if (!lead) return;
      const at = groundNear(state.def, lead.x - 40);
      if (at) { f.x = at.x; f.y = at.y; }
    },
    drawIdle: function (ctx, f, sx, t) {
      drawElephant(ctx, sx + ELE_W / 2, f.y, t, 1, false);
      const by = f.y - 104 + Math.sin(t * 0.1) * 3;
      ctx.fillStyle = 'rgba(20, 16, 30, 0.75)';
      U.roundRect(ctx, sx + ELE_W / 2 - 22, by - 9, 44, 18, 6); ctx.fill();
      U.text(ctx, '騎乘', sx + ELE_W / 2, by, { size: 11, color: '#ffd166', stroke: false });
    },
    drawRun: function (ctx, f, sx, t) { drawElephant(ctx, sx + ELE_W / 2, f.y, t * 2, f.dir, true); },
    drawRide: function (ctx, p, sx, t) {
      ctx.save();
      if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) ctx.globalAlpha = 0.5;
      drawElephant(ctx, sx + p.w / 2, p.y + p.h, p.onGround && Math.abs(p.vx) > 0.5 ? t : 0, p.facing < 0 ? -1 : 1, !!p.onGround, true);
      ctx.restore();
    }
  });
  Features.register('barricades', {
    plan: function (c, ctx, list) {
      const W = ctx.width, F = Features.helpers;
      ctx.cleared = ctx.cleared || [];
      (c.at || [0.2, 0.3, 0.5, 0.6, 0.8, 0.88]).forEach(function (k) {
        const sp = F.findSpot(ctx, W * k, BAR_W, BAR_H, true);
        if (!sp) return;
        list.push({ type: 'barricade', x: sp.x, y: sp.y, w: BAR_W, h: BAR_H, broken: false, push: 0 });
        // 前後的浮空平台、金幣、移動平台都拿掉（不然踩平台就翻過去了）
        const zone = { x: sp.x - 200, y: 0, w: BAR_W + 400, h: 600 };
        for (let i = ctx.platforms.length - 1; i >= 0; i--) {
          const b = ctx.platforms[i];
          if (b.x < zone.x + zone.w && b.x + b.w > zone.x) ctx.platforms.splice(i, 1);
        }
        ctx.cleared.push(zone);
        ctx.avoid.push(zone);
      });
    }
  });
  Features.register('barricade', {
    solid: function (f) { return f.broken ? null : { x: f.x, y: f.y - f.h, w: f.w, h: f.h }; },
    update: function (state, f, players, lead, events) {
      if (f.broken) { if (f.debris > 0) f.debris--; return; }
      let pushed = false;
      players.forEach(function (p, i) {
        const riding = p.mount && p.mount.kind === 'elephant';
        // 騎著大象：象頭比人往前 50 px，靠近就撞開；沒騎：貼著路障才算在推
        const reach = riding ? 50 : 6;
        const touching = p.y + p.h > f.y - f.h && p.x + p.w > f.x - reach && p.x < f.x + f.w + reach;
        if (!touching) return;
        if (riding) {
          f.broken = true; f.debris = 60;
          events.push('barricade:smash');
          for (let k = 0; k < 16; k++) state.particles.push({ x: f.x + f.w / 2, y: f.y - Math.random() * 120, vx: (Math.random() - 0.3) * 6, vy: -Math.random() * 5, life: 34, color: k % 2 ? '#8a5a30' : '#c8a060' });
        } else pushed = true;
      });
      // 沒騎大象一直推：提示一次，再推一陣子，等著的大象自己走過來
      if (pushed) {
        if (++f.push === 20) events.push('barricade:need');
        if (f.push === 90) {
          const ele = state.features.list.filter(function (q) {
            return q.type === 'mount' && q.kind === 'elephant' && q.state === 'wait';
          }).sort(function (a, b) { return Math.abs(a.x - f.x) - Math.abs(b.x - f.x); })[0];
          const p = lead;
          const at = ele && p ? groundNear(state.def, p.x - 40) : null;
          if (at) { ele.x = at.x; ele.y = at.y; events.push('barricade:elephant'); }
          f.push = 0;
        }
      } else f.push = 0;
    },
    draw: function (ctx, state, f, camX, t) {
      const sx = f.x - camX;
      if (sx < -80 || sx > 1040) return;
      if (f.broken) {
        // 撞爛的木頭散在地上
        ctx.fillStyle = '#8a5a30';
        for (let k = 0; k < 5; k++) { ctx.save(); ctx.translate(sx - 20 + k * 18, f.y - 4); ctx.rotate((k - 2) * 0.4); ctx.fillRect(-12, -3, 24, 6); ctx.restore(); }
        return;
      }
      // 一整排綁起來的粗竹子＋木頭，上面插著紅布條（印度的路障）
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = k % 2 ? '#a07a3a' : '#c8a050';
        ctx.fillRect(sx + k * 11, f.y - f.h, 11, f.h);
        ctx.fillStyle = 'rgba(80, 50, 20, 0.5)';
        for (let y = f.y - f.h + 30; y < f.y; y += 40) ctx.fillRect(sx + k * 11, y, 11, 3);
      }
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(sx - 4, f.y - f.h * 0.7, f.w + 8, 8); ctx.fillRect(sx - 4, f.y - f.h * 0.3, f.w + 8, 8);
      ctx.fillStyle = '#d8402a';
      ctx.beginPath(); ctx.moveTo(sx + f.w / 2, f.y - f.h); ctx.lineTo(sx + f.w / 2 + 24 + Math.sin(t * 0.15) * 3, f.y - f.h + 8); ctx.lineTo(sx + f.w / 2, f.y - f.h + 16); ctx.fill();
      // 大象的記號：「要騎大象撞開」
      ctx.fillStyle = 'rgba(20, 16, 30, 0.7)'; U.roundRect(ctx, sx - 26, f.y - 92, f.w + 52, 20, 6); ctx.fill();
      U.text(ctx, '騎象撞開', sx + f.w / 2, f.y - 82, { size: 11, color: '#ffd166', stroke: false });
    }
  });

  /** 大象（x = 腳底中心）：灰色的亞洲象，頭上披著紅色和金色的彩布；riding = 上面有人（背上一個坐墊） */
  function drawElephant(ctx, x, by, t, facing, ground, riding) {
    ctx.save();
    ctx.translate(x, by);
    ctx.scale(facing || 1, 1);
    const step = t ? Math.sin(t * 0.22) * 3 : 0;
    ctx.fillStyle = '#8a8a96';
    [[-30, step], [-14, -step], [14, step], [30, -step]].forEach(function (q) { ctx.fillRect(q[0] - 7, -28, 14, 28 - Math.abs(q[1]) * 0.3); });
    ctx.beginPath(); ctx.ellipse(0, -46, 46, 28, 0, 0, Math.PI * 2); ctx.fill();               // 身體
    ctx.beginPath(); ctx.ellipse(40, -58, 20, 20, 0, 0, Math.PI * 2); ctx.fill();               // 頭
    ctx.strokeStyle = '#8a8a96'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(54, -52); ctx.quadraticCurveTo(66, -34, 58 + Math.sin(t * 0.1) * 3, -14); ctx.stroke();   // 鼻子
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#7a7a86'; ctx.beginPath(); ctx.ellipse(30, -56, 10, 15, 0.2, 0, Math.PI * 2); ctx.fill();   // 耳朵
    ctx.fillStyle = '#f4f0e6'; ctx.beginPath(); ctx.moveTo(52, -46); ctx.lineTo(62, -40); ctx.lineTo(52, -42); ctx.fill();   // 象牙
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(46, -64, 3, 3);
    ctx.fillStyle = '#c0283a';                                                                   // 頭上的彩布
    ctx.beginPath(); ctx.moveTo(30, -76); ctx.lineTo(52, -74); ctx.lineTo(48, -52); ctx.lineTo(34, -56); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8b830'; ctx.fillRect(34, -70, 14, 3); ctx.beginPath(); ctx.arc(41, -60, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c0283a'; U.roundRect(ctx, -22, -78, 40, 14, 4); ctx.fill();                // 背上的坐墊
    ctx.fillStyle = '#e8b830'; ctx.fillRect(-22, -68, 40, 3);
    ctx.strokeStyle = '#6a6a76'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-44, -50); ctx.quadraticCurveTo(-54, -40, -50, -26); ctx.stroke();   // 尾巴
    ctx.restore();
  }

  // ── v1.33 尼泊爾：高山缺氧 ──
  const O2_MAX = 900, O2_REFILL = 14, STATION_W = 56;
  Features.register('thinAir', {
    plan: function (c, ctx, list) {
      const F = Features.helpers;
      list.push({ type: 'oxygen', x: 0 });
      for (let x = c.first || 900; x < ctx.goal - 300; x += c.every || 1300) {
        const sp = F.findSpot(ctx, x, STATION_W, 90);
        if (!sp) continue;
        list.push({ type: 'o2station', x: sp.x, y: sp.y, w: STATION_W });
        ctx.avoid.push({ x: sp.x - 40, y: 0, w: STATION_W + 80, h: 600 });
      }
    }
  });
  function stationBox(f) { return { x: f.x - 6, y: f.y - 80, w: f.w + 12, h: 80 }; }
  Features.register('oxygen', {
    update: function (state, f, players, lead, events) {
      const st = state.features.list.filter(function (q) { return q.type === 'o2station'; });
      players.forEach(function (p, i) {
        if (p.o2 == null) p.o2 = O2_MAX;
        const pid = Features.helpers.pidOf(p, i);
        const inSt = st.some(function (s) { return U.overlap(p, stationBox(s)); });
        if (inSt) {
          if (p.o2 < O2_MAX - 60 && !p.o2fill) events.push('p' + pid + ':o2');
          p.o2fill = true;
          p.o2 = Math.min(O2_MAX, p.o2 + O2_REFILL);
          return;
        }
        p.o2fill = false;
        p.o2 -= 1 + (p.vy < -1 ? 0.6 : 0);          // 跳的時候喘得更厲害
        if (p.o2 <= 0) { p.o2 = O2_MAX; events.push('p' + pid + ':hypoxia'); }
      });
    },
    draw: function (ctx, state, f, camX, t) {
      // 每個玩家頭上的氧氣條（快沒了會變紅、閃）
      state.players.forEach(function (p) {
        if (p.out || p.o2 == null) return;
        const k = p.o2 / O2_MAX, x = p.x - camX + p.w / 2, y = p.y - 26;
        if (k > 0.98 && !p.o2fill) return;
        const low = k < 0.3;
        if (low && Math.floor(t / 8) % 2 === 0) return;
        ctx.fillStyle = 'rgba(14, 18, 32, 0.7)'; U.roundRect(ctx, x - 22, y - 4, 44, 8, 4); ctx.fill();
        ctx.fillStyle = low ? '#ff6a5a' : '#7ad0ff'; U.roundRect(ctx, x - 21, y - 3, Math.max(4, 42 * k), 6, 3); ctx.fill();
        U.text(ctx, 'O₂', x - 30, y, { size: 10, color: low ? '#ff9a8a' : '#bfe8ff' });
      });
    }
  });
  Features.register('o2station', {
    draw: function (ctx, state, f, camX, t) {
      const sx = f.x - camX;
      if (sx < -80 || sx > 1040) return;
      // 雪巴人的黃色帳篷＋兩支橘色氧氣瓶＋一串五色經幡
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(sx - 20, f.y - 70); ctx.quadraticCurveTo(sx + f.w / 2, f.y - 52, sx + f.w + 20, f.y - 70); ctx.stroke();
      const cols = ['#2a6ab8', '#f4f4f0', '#c8302a', '#3a9a4a', '#f2c230'];
      for (let k = 0; k < 8; k++) {
        const u = (k + 0.5) / 8, px = sx - 20 + u * (f.w + 40), py = f.y - 70 + Math.sin(u * Math.PI) * 14;
        ctx.fillStyle = cols[k % 5]; ctx.fillRect(px - 4, py, 8, 9 + Math.sin(t * 0.2 + k) * 1.5);
      }
      ctx.fillStyle = '#e8b830';
      ctx.beginPath(); ctx.moveTo(sx, f.y); ctx.lineTo(sx + f.w / 2, f.y - 40); ctx.lineTo(sx + f.w, f.y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8a5a1a'; ctx.beginPath(); ctx.moveTo(sx + f.w / 2 - 7, f.y); ctx.lineTo(sx + f.w / 2, f.y - 18); ctx.lineTo(sx + f.w / 2 + 7, f.y); ctx.fill();
      [-1, 1].forEach(function (s, k) {
        const bx = sx + f.w / 2 + s * 34;
        ctx.fillStyle = '#e8702a'; U.roundRect(ctx, bx - 5, f.y - 30, 10, 30, 4); ctx.fill();
        ctx.fillStyle = '#c8c8d0'; ctx.fillRect(bx - 2, f.y - 35, 4, 5);
      });
      // 補氧氣中：一圈藍色的光
      const any = state.players.some(function (p) { return p.o2fill; });
      ctx.fillStyle = 'rgba(120, 210, 255, ' + (any ? 0.25 + Math.sin(t * 0.2) * 0.1 : 0.08).toFixed(2) + ')';
      ctx.beginPath(); ctx.ellipse(sx + f.w / 2, f.y - 30, f.w * 0.9, 42, 0, 0, Math.PI * 2); ctx.fill();
      U.text(ctx, 'O₂', sx + f.w / 2, f.y - 88, { size: 12, color: '#bfe8ff' });
    }
  });

  // ── v1.33 中國：長城的烽火台、箭雨 ──
  const BEACON_W = 64, BEACON_H = 104;
  Features.register('beacons', {
    plan: function (c, ctx, list) {
      const W = ctx.width, F = Features.helpers, n = c.count || 5;
      for (let i = 0; i < n; i++) {
        const sp = F.findSpot(ctx, W * (0.12 + 0.72 * i / Math.max(1, n - 1)), BEACON_W, BEACON_H + 60, true);
        if (!sp) continue;
        list.push({ type: 'beacon', x: sp.x, y: sp.y, w: BEACON_W, lit: false });
        ctx.avoid.push({ x: sp.x - 60, y: 0, w: BEACON_W + 120, h: 600 });
      }
      // 終點前的關門：烽火全部點燃才打開
      ctx.cleared = ctx.cleared || [];
      const gx = Math.round(ctx.goal - 150);
      const gy = LevelGen.groundAt(ctx.segs, gx) || ctx.segs[0].y;
      list.push({ type: 'beaconGate', x: gx, y: gy, w: 40, h: 420, open: false, t: 0 });
      ctx.cleared.push({ x: gx - 60, y: 0, w: 160, h: 600 });
      for (let i = ctx.platforms.length - 1; i >= 0; i--) {
        const b = ctx.platforms[i];
        if (b.x < gx + 100 && b.x + b.w > gx - 60) ctx.platforms.splice(i, 1);
      }
    }
  });
  // 火盆的範圍：台頂上面一大塊（小跳一下就碰得到；站在地上碰不到）
  function fireBox(f) { return { x: f.x - 6, y: f.y - BEACON_H - 46, w: f.w + 12, h: 76 }; }
  Features.register('beacon', {
    update: function (state, f, players, lead, events) {
      if (f.lit) return;
      players.forEach(function (p) {
        if (!f.lit && U.overlap(p, fireBox(f))) {
          f.lit = true;
          const left = state.features.list.filter(function (q) { return q.type === 'beacon' && !q.lit; }).length;
          events.push('beacon:lit:' + left);
        }
      });
    },
    draw: function (ctx, state, f, camX, t) {
      const sx = f.x - camX;
      if (sx < -90 || sx > 1050) return;
      const top = f.y - BEACON_H;
      // 磚砌的烽火台（往上稍微收窄）＋城垛
      ctx.fillStyle = '#9a8a74';
      ctx.beginPath(); ctx.moveTo(sx, f.y); ctx.lineTo(sx + 6, top); ctx.lineTo(sx + f.w - 6, top); ctx.lineTo(sx + f.w, f.y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(70, 60, 50, 0.4)'; ctx.lineWidth = 1;
      for (let y = top + 12; y < f.y; y += 12) { ctx.beginPath(); ctx.moveTo(sx + 3, y); ctx.lineTo(sx + f.w - 3, y); ctx.stroke(); }
      ctx.fillStyle = '#8a7a64';
      for (let k = 0; k < 4; k++) ctx.fillRect(sx + 6 + k * 15, top - 10, 9, 10);
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(sx + f.w / 2 - 8, f.y - 26, 16, 26);
      // 火盆
      const fx = sx + f.w / 2, fy = top - 14;
      ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.moveTo(fx - 14, fy - 6); ctx.lineTo(fx + 14, fy - 6); ctx.lineTo(fx + 8, fy + 4); ctx.lineTo(fx - 8, fy + 4); ctx.closePath(); ctx.fill();
      if (f.lit) {
        // 熊熊烽火＋往上冒的狼煙
        for (let k = 0; k < 3; k++) {
          const fl = Math.sin(t * 0.4 + k * 2) * 4;
          ctx.fillStyle = ['#ff5a2a', '#ffa030', '#ffe070'][k];
          ctx.beginPath(); ctx.moveTo(fx - 12 + k * 4, fy - 6); ctx.quadraticCurveTo(fx + fl, fy - 40 + k * 8, fx + 12 - k * 4, fy - 6); ctx.fill();
        }
        for (let k = 0; k < 5; k++) {
          const p = ((t * 0.5 + k * 30) % 150) / 150;
          ctx.fillStyle = 'rgba(80, 70, 70, ' + (0.45 - p * 0.4).toFixed(2) + ')';
          ctx.beginPath(); ctx.arc(fx + Math.sin(p * 6 + k) * 10 - p * 30, fy - 40 - p * 160, 8 + p * 20, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        // 還沒點：一個往上的金色箭頭（跳起來碰火盆）
        const by = fy - 26 + Math.sin(t * 0.12) * 3;
        ctx.fillStyle = 'rgba(255, 210, 110, 0.9)';
        ctx.beginPath(); ctx.moveTo(fx, by - 10); ctx.lineTo(fx - 7, by); ctx.lineTo(fx + 7, by); ctx.closePath(); ctx.fill();
        ctx.fillRect(fx - 2, by, 4, 8);
      }
    }
  });
  Features.register('beaconGate', {
    solid: function (f) { return f.open ? null : { x: f.x, y: f.y - f.h, w: f.w, h: f.h }; },
    update: function (state, f, players, lead, events) {
      const left = state.features.list.filter(function (q) { return q.type === 'beacon' && !q.lit; }).length;
      if (!f.open && left === 0) { f.open = true; events.push('beacon:open'); }
      if (f.open) { f.t = Math.min(60, f.t + 1); return; }
      if (players.some(function (p) { return p.x + p.w > f.x - 8 && p.x < f.x; })) {
        if (!f.told) { f.told = true; events.push('beacon:need:' + left); }
      } else f.told = false;
    },
    draw: function (ctx, state, f, camX, t) {
      const sx = f.x - camX;
      if (sx < -160 || sx > 1100) return;
      // 關城：兩邊厚厚的城牆、中間的木頭大門（打開時往上升）
      ctx.fillStyle = '#8a7a64'; ctx.fillRect(sx - 50, f.y - 200, 140, 200);
      ctx.fillStyle = '#7a6a54';
      for (let k = 0; k < 7; k++) ctx.fillRect(sx - 50 + k * 21, f.y - 214, 13, 14);
      ctx.fillStyle = '#c8302a'; ctx.fillRect(sx - 30, f.y - 250, 100, 36);         // 城樓
      ctx.fillStyle = '#3a3a44'; ctx.beginPath(); ctx.moveTo(sx - 44, f.y - 250); ctx.lineTo(sx + 20, f.y - 276); ctx.lineTo(sx + 84, f.y - 250); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a1a10'; ctx.fillRect(sx - 4, f.y - 130, f.w + 8, 130);           // 門洞
      const lift = f.t / 60 * 126;
      ctx.fillStyle = '#7a4a24'; ctx.fillRect(sx - 2, f.y - 128 - lift, f.w + 4, 128);
      ctx.fillStyle = '#e8b830';
      for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { ctx.beginPath(); ctx.arc(sx + 10 + c * 20, f.y - 112 + r * 30 - lift, 2.6, 0, Math.PI * 2); ctx.fill(); }
      if (!f.open) {
        const left = state.features.list.filter(function (q) { return q.type === 'beacon' && !q.lit; }).length;
        ctx.fillStyle = 'rgba(20, 16, 30, 0.75)'; U.roundRect(ctx, sx - 40, f.y - 172, 120, 22, 6); ctx.fill();
        U.text(ctx, '烽火還差 ' + left + ' 座', sx + 20, f.y - 161, { size: 12, color: '#ffd166', stroke: false });
      }
    }
  });
  Features.register('volleys', {
    plan: function (c, ctx, list) { list.push({ type: 'volley', x: 0, every: c.every || 200, cd: 240, marks: [], seq: 0 }); }
  });
  const VOLLEY_WARN = 70, VOLLEY_R = 46;
  Features.register('volley', {
    update: function (state, f, players, lead, events) {
      const def = state.def;
      if (--f.cd <= 0) {
        f.cd = f.every;
        if (lead && lead.x > 600 && lead.x < def.goal - 400) {
          const tx = lead.x + lead.w / 2 + lead.vx * 40 + [0, -70, 90, -30, 50][f.seq % 5];
          const gy = Features.helpers.groundTop(def, tx);
          if (gy != null) { f.marks.push({ x: tx, y: gy, t: VOLLEY_WARN }); events.push('volley:warn'); }
          f.seq++;
        }
      }
      f.marks.forEach(function (m) {
        if (--m.t === 0) {
          players.forEach(function (p, i) {
            if (Math.abs(p.x + p.w / 2 - m.x) < VOLLEY_R && p.y + p.h > m.y - 80) Features.helpers.hurt(p, m.x, events, Features.helpers.pidOf(p, i));
          });
          events.push('volley:land');
        }
      });
      f.marks = f.marks.filter(function (m) { return m.t > -40; });
    },
    draw: function (ctx, state, f, camX, t) {
      f.marks.forEach(function (m) {
        const sx = m.x - camX;
        if (m.t > 0) {
          const k = 1 - m.t / VOLLEY_WARN;
          ctx.strokeStyle = 'rgba(255, 60, 50, ' + (0.4 + k * 0.5).toFixed(2) + ')'; ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath(); ctx.ellipse(sx, m.y - 2, VOLLEY_R, 9, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255, 60, 50, ' + (k * 0.25).toFixed(2) + ')';
          ctx.beginPath(); ctx.ellipse(sx, m.y - 2, VOLLEY_R * k, 9 * k, 0, 0, Math.PI * 2); ctx.fill();
          // 最後 24 帧：箭從天上斜斜地落下來
          if (m.t < 24) {
            ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2;
            for (let a = 0; a < 7; a++) {
              const ax = sx - VOLLEY_R + a * (VOLLEY_R * 2 / 6) + m.t * 3, ay = m.y - 8 - m.t * 14 - (a % 3) * 10;
              ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + 8, ay - 22); ctx.stroke();
            }
          }
        } else {
          // 插在地上的箭
          ctx.strokeStyle = 'rgba(58, 42, 26, ' + Math.max(0, 1 + m.t / 40).toFixed(2) + ')'; ctx.lineWidth = 2;
          for (let a = 0; a < 7; a++) {
            const ax = sx - VOLLEY_R + 6 + a * (VOLLEY_R * 2 - 12) / 6;
            ctx.beginPath(); ctx.moveTo(ax, m.y); ctx.lineTo(ax + 5, m.y - 16); ctx.stroke();
          }
        }
      });
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

  return { drawCamel: drawCamel, drawCarpet: drawCarpet, drawElephant: drawElephant, CAMEL_HP: CAMEL_HP, camelPos: camelPos,
           O2_MAX: O2_MAX, BAR_H: BAR_H, fireBox: fireBox, stationBox: stationBox };
})();
