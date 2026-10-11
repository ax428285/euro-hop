'use strict';

/**
 * 亞洲篇（v1.32.1 絲路）的美術：國旗、地標、遠景、各國敵人。機關（氣流、宣禮塔、駱駝商隊、飛毯）在 silkroad.js。
 *
 * 跟 america.js 一樣「從外面掛進 Sprites」（flagDirs / landmarks / skylines / countryEnemies）。
 * 載入順序：sprites.js、america.js 之後，game.js 之前。
 */
const Asia = (function () {

  // ── 小工具 ──────────────────────────────────────────────

  function ridge(ctx, camX, p, gy, W, color, h, jag, seed) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    for (let x = 0; x <= W + 20; x += 20) {
      const wx = x + camX * p + seed * 97;
      const y = gy - h * (0.55 + 0.25 * Math.sin(wx * 0.004) + 0.2 * Math.sin(wx * 0.011 + seed))
        - jag * Math.abs(Math.sin(wx * 0.037 + seed * 3));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 20, gy); ctx.closePath(); ctx.fill();
  }
  function tiled(ctx, camX, p, tileW, W, fn) {
    const off = -((camX * p) % tileW + tileW) % tileW;
    for (let x = off - tileW; x < W + tileW; x += tileW) fn(x);
  }
  function squashed(ctx, e, cx, by) {
    if (e.squash > 0) { ctx.translate(cx, by); ctx.scale(1.3, 0.35); ctx.translate(-cx, -by); }
  }
  /** 洋蔥圓頂（底部中心 x, y；w = 寬，h = 高） */
  function dome(ctx, x, y, w, h) {
    ctx.beginPath(); ctx.moveTo(x - w / 2, y);
    ctx.bezierCurveTo(x - w * 0.62, y - h * 0.55, x - w * 0.1, y - h * 0.75, x, y - h);
    ctx.bezierCurveTo(x + w * 0.1, y - h * 0.75, x + w * 0.62, y - h * 0.55, x + w / 2, y);
    ctx.closePath(); ctx.fill();
  }

  // ── 國旗 ────────────────────────────────────────────────

  const FLAGS = {
    // 伊朗：綠白紅橫條，中間紅色的國徽（簡化成一朵鬱金香形）
    iran: function (ctx, x, y, w, h, c) {
      for (let i = 0; i < 3; i++) { ctx.fillStyle = c[i]; ctx.fillRect(x, y + h * i / 3, w, h / 3 + 0.5); }
      ctx.fillStyle = c[2];
      const cx = x + w / 2, cy = y + h / 2, r = h * 0.12;
      ctx.beginPath(); ctx.ellipse(cx - r * 0.5, cy, r * 0.45, r, 0, 0, Math.PI * 2); ctx.ellipse(cx + r * 0.5, cy, r * 0.45, r, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - r * 0.12, cy - r * 1.1, r * 0.24, r * 2.2);
    },
    // 烏茲別克：藍白綠橫條、中間夾兩條細紅線，左上白色新月＋小星星
    uzbekistan: function (ctx, x, y, w, h, c) {
      for (let i = 0; i < 3; i++) { ctx.fillStyle = c[i]; ctx.fillRect(x, y + h * i / 3, w, h / 3 + 0.5); }
      ctx.fillStyle = '#ce1126';
      ctx.fillRect(x, y + h / 3 - h * 0.025, w, h * 0.05); ctx.fillRect(x, y + h * 2 / 3 - h * 0.025, w, h * 0.05);
      ctx.fillStyle = '#ffffff';
      const mx = x + w * 0.14, my = y + h * 0.17, r = h * 0.11;
      ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c[0]; ctx.beginPath(); ctx.arc(mx + r * 0.35, my, r * 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (let k = 0; k < 5; k++) ctx.fillRect(x + w * (0.26 + k * 0.06), y + h * 0.13, Math.max(1, h * 0.05), Math.max(1, h * 0.05));
    }
  };
  // v1.33 第二批
  function star5(ctx, cx, cy, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (rot || 0) + i * Math.PI / 5, rr = i % 2 ? r * 0.4 : r;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }
  // 印度：番紅花、白、綠橫條，中間藍色的法輪
  FLAGS.india = function (ctx, x, y, w, h, c) {
    for (let i = 0; i < 3; i++) { ctx.fillStyle = c[i]; ctx.fillRect(x, y + h * i / 3, w, h / 3 + 0.5); }
    ctx.strokeStyle = '#06038d'; ctx.lineWidth = Math.max(1, h * 0.03);
    const r = h * 0.13;
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2); ctx.stroke();
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6;
      ctx.beginPath(); ctx.moveTo(x + w / 2, y + h / 2); ctx.lineTo(x + w / 2 + Math.cos(a) * r, y + h / 2 + Math.sin(a) * r); ctx.stroke();
    }
  };
  // 尼泊爾：兩個疊起來的三角旗（世界上唯一不是長方形的國旗）：深紅底、藍邊，上面白月亮、下面白太陽
  FLAGS.nepal = function (ctx, x, y, w, h, c) {
    const pw = h * 0.82;
    ctx.fillStyle = c[1];
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + pw, y + h * 0.5); ctx.lineTo(x + pw * 0.42, y + h * 0.5); ctx.lineTo(x + pw, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
    const b = h * 0.06;
    ctx.fillStyle = c[0];
    ctx.beginPath(); ctx.moveTo(x + b, y + b * 2.2); ctx.lineTo(x + pw - b * 2.6, y + h * 0.5 - b); ctx.lineTo(x + pw * 0.42 - b, y + h * 0.5 - b);
    ctx.lineTo(x + pw - b * 2.6, y + h - b); ctx.lineTo(x + b, y + h - b); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x + pw * 0.25, y + h * 0.3, h * 0.08, 0, Math.PI); ctx.fill();
    star5(ctx, x + pw * 0.25, y + h * 0.75, h * 0.1, 0);
  };
  // 中國：紅底，左上一顆大黃星＋四顆小黃星
  FLAGS.china = function (ctx, x, y, w, h, c) {
    ctx.fillStyle = c[0]; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = c[1];
    star5(ctx, x + w * 0.17, y + h * 0.27, h * 0.15, 0);
    [[0.33, 0.1], [0.4, 0.2], [0.4, 0.35], [0.33, 0.45]].forEach(function (q, k) { star5(ctx, x + w * q[0], y + h * q[1], h * 0.05, 0.4 - k * 0.3); });
  };
  // 蒙古：紅藍紅直條，左邊紅條上黃色的索永布（簡化成火焰＋日月＋兩根柱子）
  FLAGS.mongolia = function (ctx, x, y, w, h, c) {
    for (let i = 0; i < 3; i++) { ctx.fillStyle = c[i]; ctx.fillRect(x + w * i / 3, y, w / 3 + 0.5, h); }
    ctx.fillStyle = '#f9cf02';
    const cx = x + w / 6;
    ctx.beginPath(); ctx.moveTo(cx, y + h * 0.1); ctx.lineTo(cx - h * 0.04, y + h * 0.2); ctx.lineTo(cx + h * 0.04, y + h * 0.2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, y + h * 0.28, h * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, y + h * 0.38, h * 0.06, 0, Math.PI); ctx.fill();
    ctx.fillRect(cx - h * 0.07, y + h * 0.48, h * 0.14, h * 0.04);
    ctx.fillRect(cx - h * 0.1, y + h * 0.55, h * 0.03, h * 0.3); ctx.fillRect(cx + h * 0.07, y + h * 0.55, h * 0.03, h * 0.3);
    ctx.beginPath(); ctx.arc(cx, y + h * 0.7, h * 0.06, 0, Math.PI * 2); ctx.fill();
  };
  Object.keys(FLAGS).forEach(function (k) { Sprites.flagDirs[k] = FLAGS[k]; });

  // ── 地標（遠方的大建築，半透明） ───────────────────────

  const LM = {
    /** 伊朗：伊斯法罕伊瑪目廣場的清真寺 —— 藍綠色大圓頂、正門的尖拱、兩座宣禮塔 */
    naqshJahan: function (ctx, x, baseY, s) {
      ctx.save(); ctx.translate(x, baseY);
      ctx.fillStyle = 'rgba(214, 196, 160, 0.72)';
      ctx.fillRect(-200 * s, -70 * s, 400 * s, 70 * s);                   // 廣場邊的拱廊
      ctx.fillStyle = 'rgba(160, 130, 90, 0.6)';
      for (let k = 0; k < 12; k++) { ctx.beginPath(); ctx.arc((-184 + k * 33) * s, -26 * s, 11 * s, Math.PI, 0); ctx.fill(); ctx.fillRect((-195 + k * 33) * s, -26 * s, 22 * s, 26 * s); }
      ctx.fillStyle = 'rgba(70, 150, 170, 0.78)';
      dome(ctx, 0, -110 * s, 150 * s, 120 * s);                            // 大圓頂
      ctx.fillStyle = 'rgba(214, 196, 160, 0.8)'; ctx.fillRect(-80 * s, -112 * s, 160 * s, 42 * s);   // 鼓座
      ctx.fillStyle = 'rgba(50, 110, 160, 0.75)';
      ctx.beginPath(); ctx.moveTo(-40 * s, -70 * s); ctx.lineTo(-40 * s, -150 * s); ctx.quadraticCurveTo(0, -200 * s, 40 * s, -150 * s); ctx.lineTo(40 * s, -70 * s); ctx.fill();   // 正門
      ctx.fillStyle = 'rgba(60, 130, 180, 0.75)';
      [-60, 52].forEach(function (mx) { ctx.fillRect(mx * s, -230 * s, 8 * s, 160 * s); ctx.fillStyle = 'rgba(230, 200, 120, 0.8)'; dome(ctx, (mx + 4) * s, -230 * s, 12 * s, 16 * s); ctx.fillStyle = 'rgba(60, 130, 180, 0.75)'; });
      ctx.restore();
    },
    /** 烏茲別克：撒馬爾罕的雷吉斯坦廣場 —— 三座伊斯蘭學院面對面，正門大拱、藍色圓頂、四角的塔 */
    registan: function (ctx, x, baseY, s) {
      ctx.save(); ctx.translate(x, baseY);
      [-170, 0, 170].forEach(function (bx, i) {
        const ww = (i === 1 ? 150 : 120) * s, hh = (i === 1 ? 150 : 128) * s;
        ctx.fillStyle = 'rgba(206, 180, 140, 0.75)';
        ctx.fillRect(bx * s - ww / 2, -hh, ww, hh);
        ctx.fillStyle = 'rgba(40, 110, 170, 0.72)';                         // 正門的磁磚框＋尖拱
        ctx.fillRect(bx * s - ww * 0.28, -hh + 10 * s, ww * 0.56, hh - 10 * s);
        ctx.fillStyle = 'rgba(120, 90, 60, 0.7)';
        ctx.beginPath(); ctx.moveTo(bx * s - ww * 0.18, 0); ctx.lineTo(bx * s - ww * 0.18, -hh * 0.6); ctx.quadraticCurveTo(bx * s, -hh * 0.86, bx * s + ww * 0.18, -hh * 0.6); ctx.lineTo(bx * s + ww * 0.18, 0); ctx.fill();
        ctx.fillStyle = 'rgba(206, 180, 140, 0.8)';
        ctx.fillRect(bx * s - ww / 2 - 8 * s, -hh - 30 * s, 10 * s, hh + 30 * s);     // 兩角的塔
        ctx.fillRect(bx * s + ww / 2 - 2 * s, -hh - 30 * s, 10 * s, hh + 30 * s);
        if (i !== 1) { ctx.fillStyle = 'rgba(50, 150, 190, 0.78)'; dome(ctx, bx * s + (i ? 1 : -1) * ww * 0.25, -hh, 50 * s, 46 * s); }
      });
      ctx.restore();
    }
  };
  /** v1.33 印度：齋浦爾的風之宮殿 —— 粉紅色、一層層凸出來的小窗，像一座蜂巢 */
  LM.hawaMahal = function (ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(232, 140, 120, 0.75)';
    ctx.beginPath(); ctx.moveTo(-170 * s, 0); ctx.lineTo(-170 * s, -110 * s); ctx.lineTo(-90 * s, -150 * s); ctx.lineTo(-40 * s, -200 * s); ctx.lineTo(40 * s, -200 * s); ctx.lineTo(90 * s, -150 * s); ctx.lineTo(170 * s, -110 * s); ctx.lineTo(170 * s, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(250, 220, 200, 0.7)';
    for (let r = 0; r < 6; r++) {
      const ww = (160 - Math.max(0, r - 2) * 40) * s, y = -20 * s - r * 30 * s;
      for (let k = -4; k <= 4; k++) {
        const wx = k * 18 * s;
        if (Math.abs(wx) > ww) continue;
        ctx.beginPath(); ctx.arc(wx, y - 8 * s, 6 * s, Math.PI, 0); ctx.fill(); ctx.fillRect(wx - 6 * s, y - 8 * s, 12 * s, 10 * s);
      }
    }
    ctx.fillStyle = 'rgba(200, 110, 100, 0.8)';
    [-30, 0, 30].forEach(function (k) { ctx.beginPath(); ctx.arc(k * s, -200 * s, 12 * s, Math.PI, 0); ctx.fill(); });
    ctx.restore();
  };
  /** v1.33 尼泊爾：聖母峰（白色的峰頂、被風吹出的一道雪旗） */
  LM.everest = function (ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(110, 120, 150, 0.7)';
    ctx.beginPath(); ctx.moveTo(-300 * s, 0); ctx.lineTo(-120 * s, -170 * s); ctx.lineTo(-60 * s, -140 * s); ctx.lineTo(10 * s, -260 * s); ctx.lineTo(90 * s, -170 * s); ctx.lineTo(160 * s, -200 * s); ctx.lineTo(300 * s, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(250, 252, 255, 0.85)';
    ctx.beginPath(); ctx.moveTo(-40 * s, -190 * s); ctx.lineTo(10 * s, -260 * s); ctx.lineTo(60 * s, -200 * s); ctx.lineTo(30 * s, -210 * s); ctx.lineTo(10 * s, -190 * s); ctx.lineTo(-10 * s, -200 * s); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(140 * s, -186 * s); ctx.lineTo(160 * s, -200 * s); ctx.lineTo(186 * s, -176 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath(); ctx.moveTo(10 * s, -258 * s); ctx.quadraticCurveTo(80 * s, -270 * s, 150 * s, -250 * s); ctx.quadraticCurveTo(80 * s, -255 * s, 14 * s, -248 * s); ctx.fill();
    ctx.restore();
  };
  /** v1.33 中國：八達嶺的長城，沿著山脊蜿蜒，一座座敵樓 */
  LM.greatWall = function (ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(110, 140, 100, 0.6)';
    ctx.beginPath(); ctx.moveTo(-320 * s, 0); ctx.quadraticCurveTo(-200 * s, -170 * s, -80 * s, -110 * s); ctx.quadraticCurveTo(40 * s, -40 * s, 140 * s, -150 * s); ctx.quadraticCurveTo(230 * s, -230 * s, 320 * s, -120 * s); ctx.lineTo(320 * s, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(200, 180, 150, 0.85)'; ctx.lineWidth = 12 * s;
    ctx.beginPath(); ctx.moveTo(-320 * s, -10 * s); ctx.quadraticCurveTo(-200 * s, -180 * s, -80 * s, -120 * s); ctx.quadraticCurveTo(40 * s, -50 * s, 140 * s, -160 * s); ctx.quadraticCurveTo(230 * s, -240 * s, 320 * s, -130 * s); ctx.stroke();
    ctx.fillStyle = 'rgba(190, 170, 140, 0.9)';
    [[-230, -118], [-80, -128], [60, -88], [180, -200], [300, -150]].forEach(function (q) {
      ctx.fillRect((q[0] - 14) * s, (q[1] - 28) * s, 28 * s, 28 * s);
      for (let k = 0; k < 3; k++) ctx.fillRect((q[0] - 14 + k * 11) * s, (q[1] - 34) * s, 6 * s, 6 * s);
    });
    ctx.restore();
  };
  /** v1.33 蒙古：成吉思汗騎馬的銀色大雕像（草原上的地標） */
  LM.chinggis = function (ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(200, 200, 210, 0.75)';
    ctx.fillRect(-90 * s, -60 * s, 180 * s, 60 * s);
    ctx.beginPath(); ctx.ellipse(0, -110 * s, 70 * s, 30 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(50 * s, -120 * s); ctx.lineTo(90 * s, -170 * s); ctx.lineTo(100 * s, -150 * s); ctx.lineTo(70 * s, -110 * s); ctx.fill();
    ctx.fillRect(-50 * s, -96 * s, 14 * s, 40 * s); ctx.fillRect(36 * s, -96 * s, 14 * s, 40 * s);
    ctx.fillRect(-14 * s, -180 * s, 28 * s, 60 * s);
    ctx.beginPath(); ctx.arc(0, -190 * s, 14 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  Object.keys(LM).forEach(function (k) { Sprites.landmarks[k] = LM[k]; });

  // ── 遠景 ────────────────────────────────────────────────

  const SKY = {
    // 伊朗：遠方的札格洛斯山脈＋一排藍色圓頂和宣禮塔
    IR: function (ctx, camX, gy, W) {
      ridge(ctx, camX, 0.05, gy - 40, W, 'rgba(170, 130, 100, 0.5)', 180, 22, 61);
      tiled(ctx, camX, 0.16, 560, W, function (x0) {
        ctx.fillStyle = 'rgba(210, 190, 150, 0.55)'; ctx.fillRect(x0 + 60, gy - 70, 260, 70);
        ctx.fillStyle = 'rgba(70, 150, 180, 0.55)'; dome(ctx, x0 + 190, gy - 70, 90, 70);
        ctx.fillStyle = 'rgba(70, 130, 180, 0.5)';
        ctx.fillRect(x0 + 120, gy - 150, 8, 80); ctx.fillRect(x0 + 252, gy - 150, 8, 80);
      });
    },
    // 烏茲別克：天山腳下的沙漠綠洲 —— 黃色沙丘、泥磚城牆、一座座藍色圓頂
    UZ: function (ctx, camX, gy, W) {
      ridge(ctx, camX, 0.04, gy - 50, W, 'rgba(150, 160, 190, 0.5)', 200, 30, 63);
      ridge(ctx, camX, 0.1, gy - 10, W, 'rgba(220, 190, 130, 0.55)', 70, 4, 65);
      tiled(ctx, camX, 0.2, 620, W, function (x0) {
        ctx.fillStyle = 'rgba(190, 150, 110, 0.6)'; ctx.fillRect(x0 + 40, gy - 50, 300, 50);
        for (let k = 0; k < 8; k++) ctx.fillRect(x0 + 40 + k * 40, gy - 58, 20, 8);    // 城垛
        ctx.fillStyle = 'rgba(50, 140, 190, 0.6)'; dome(ctx, x0 + 400, gy - 40, 70, 60);
        ctx.fillStyle = 'rgba(190, 150, 110, 0.6)'; ctx.fillRect(x0 + 368, gy - 40, 64, 40);
      });
    }
  };
  // v1.33 印度：粉紅色的齋浦爾城牆、遠方的阿梅爾堡
  SKY.IN = function (ctx, camX, gy, W) {
    ridge(ctx, camX, 0.05, gy - 40, W, 'rgba(190, 150, 110, 0.5)', 150, 14, 71);
    tiled(ctx, camX, 0.18, 600, W, function (x0) {
      ctx.fillStyle = 'rgba(230, 150, 130, 0.55)'; ctx.fillRect(x0 + 40, gy - 60, 360, 60);
      for (let k = 0; k < 9; k++) ctx.fillRect(x0 + 40 + k * 42, gy - 70, 22, 10);
      ctx.fillStyle = 'rgba(240, 200, 170, 0.6)';
      [x0 + 120, x0 + 320].forEach(function (cx) { dome(ctx, cx, gy - 60, 40, 30); });
    });
  };
  // v1.33 尼泊爾：喜馬拉雅山脈的雪峰
  SKY.NP = function (ctx, camX, gy, W) {
    ridge(ctx, camX, 0.03, gy - 60, W, 'rgba(140, 150, 180, 0.6)', 260, 60, 73);
    ridge(ctx, camX, 0.09, gy - 10, W, 'rgba(110, 120, 140, 0.55)', 120, 30, 75);
  };
  // v1.33 中國：長城在後面的山脊上一路延伸
  SKY.CN = function (ctx, camX, gy, W) {
    ridge(ctx, camX, 0.05, gy - 40, W, 'rgba(110, 140, 110, 0.5)', 170, 20, 77);
    ctx.strokeStyle = 'rgba(190, 170, 140, 0.6)'; ctx.lineWidth = 6;
    ctx.beginPath();
    for (let x = 0; x <= W + 20; x += 20) {
      const wx = x + camX * 0.05 + 77 * 97;
      const y = gy - 40 - 170 * (0.55 + 0.25 * Math.sin(wx * 0.004) + 0.2 * Math.sin(wx * 0.011 + 77)) - 20 * Math.abs(Math.sin(wx * 0.037 + 77 * 3)) + 6;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  Object.keys(SKY).forEach(function (k) { Sprites.skylines[k] = SKY[k]; });

  // ── 各國敵人（行為、碰撞跟原本一樣，只換長相） ──────────

  /** 沙漠盜賊：纏頭巾、蒙面、彎刀（伊朗的走路怪、烏茲別克搶駱駝的盜賊共用，頭巾顏色不同） */
  function bandit(ctx, e, t, turban) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    ctx.save(); squashed(ctx, e, cx, by);
    const step = Math.sin(t * 0.35) * 2;
    ctx.fillStyle = '#3a2a22';
    ctx.fillRect(cx - 7 + step, by - 7, 5, 7); ctx.fillRect(cx + 2 - step, by - 7, 5, 7);
    ctx.fillStyle = '#5a3a2a';
    ctx.beginPath(); ctx.moveTo(cx - 10, by - 6); ctx.lineTo(cx - 8, by - 22); ctx.lineTo(cx + 8, by - 22); ctx.lineTo(cx + 10, by - 6); ctx.fill();   // 長袍
    ctx.fillStyle = '#c8a07a'; ctx.beginPath(); ctx.arc(cx, by - 27, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(cx - 6, by - 26, 12, 5);                        // 蒙面
    ctx.fillStyle = '#16161c'; ctx.fillRect(cx - 3 + e.dir * 1.5, by - 29, 2, 2); ctx.fillRect(cx + 1 + e.dir * 1.5, by - 29, 2, 2);
    ctx.fillStyle = turban;
    ctx.beginPath(); ctx.ellipse(cx, by - 33, 8, 4.5, 0, 0, Math.PI * 2); ctx.fill();         // 頭巾
    ctx.strokeStyle = '#d8d8e0'; ctx.lineWidth = 2;                                          // 彎刀
    ctx.beginPath(); ctx.moveTo(cx + e.dir * 8, by - 16); ctx.quadraticCurveTo(cx + e.dir * 18, by - 22, cx + e.dir * 20, by - 34); ctx.stroke();
    ctx.restore();
  }
  /** 鳥（身體＋兩片拍動的翅膀） */
  function bird(ctx, e, t, body, wing, extra) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    ctx.save();
    if (e.squash > 0) { ctx.translate(cx, cy); ctx.scale(1.3, 0.4); ctx.translate(-cx, -cy); }
    const flap = Math.sin(t * 0.3) * 8;
    ctx.fillStyle = wing;
    ctx.beginPath(); ctx.moveTo(cx - 3, cy - 2); ctx.quadraticCurveTo(cx - 16, cy - 10 - flap, cx - 26, cy - flap); ctx.quadraticCurveTo(cx - 14, cy + 2, cx - 3, cy + 3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 3, cy - 2); ctx.quadraticCurveTo(cx + 16, cy - 10 - flap, cx + 26, cy - flap); ctx.quadraticCurveTo(cx + 14, cy + 2, cx + 3, cy + 3); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(cx, cy, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + e.dir * 9, cy - 4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b830'; ctx.beginPath(); ctx.moveTo(cx + e.dir * 13, cy - 5); ctx.lineTo(cx + e.dir * 18, cy - 3); ctx.lineTo(cx + e.dir * 13, cy - 2); ctx.fill();
    ctx.fillStyle = '#16161c'; ctx.fillRect(cx + e.dir * 10 - 1, cy - 6, 2, 2);
    if (extra) extra(ctx, cx, cy);
    ctx.restore();
  }

  const CE = Sprites.countryEnemies;
  CE.IR = {
    walker: function (ctx, e, t) { bandit(ctx, e, t, '#2a7a5a'); },
    // 伊朗：波斯的孔雀（藍綠色的身體、拖著一把有眼斑的尾巴）
    flyer: function (ctx, e, t) {
      bird(ctx, e, t, '#1a5aa8', '#2a8a7a', function (ctx, cx, cy) {
        ctx.fillStyle = '#2a8a5a';
        ctx.beginPath(); ctx.moveTo(cx - 6, cy); ctx.lineTo(cx - 24 * 1, cy + 8); ctx.lineTo(cx - 20, cy - 4); ctx.fill();
        ctx.fillStyle = '#e8b830'; ctx.beginPath(); ctx.arc(cx - 18, cy + 3, 2.4, 0, Math.PI * 2); ctx.fill();
      });
    }
  };
  CE.UZ = {
    walker: function (ctx, e, t) { bandit(ctx, e, t, e.bandit ? '#a8202e' : '#e8d8b0'); },
    // 烏茲別克：草原上的金鵰（中亞的獵人到現在還用牠打獵）
    flyer: function (ctx, e, t) { bird(ctx, e, t, '#6a4a2a', '#8a6a3a'); }
  };

  // ── 紀念品圖示（souvenirs.js）────────────────────────────

  const IC = Sprites.icons;
  /** 波斯小地毯：紅底、深藍邊、中間一個金色的菱形大花紋，兩頭有流蘇 */
  IC.miniCarpet = function (ctx, s) {
    ctx.fillStyle = '#1a2a6a'; ctx.fillRect(-12 * s, -8 * s, 24 * s, 16 * s);
    ctx.fillStyle = '#a8202e'; ctx.fillRect(-10 * s, -6 * s, 20 * s, 12 * s);
    ctx.fillStyle = '#e8b830';
    ctx.beginPath(); ctx.moveTo(0, -5 * s); ctx.lineTo(7 * s, 0); ctx.lineTo(0, 5 * s); ctx.lineTo(-7 * s, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1a2a6a'; ctx.beginPath(); ctx.arc(0, 0, 2 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4ead0';
    for (let k = 0; k < 6; k++) { ctx.fillRect(-14 * s, (-7 + k * 2.6) * s, 2 * s, 1.2 * s); ctx.fillRect(12 * s, (-7 + k * 2.6) * s, 2 * s, 1.2 * s); }
  };
  /** 蘇札尼刺繡：米白的布，上面繡著紅色的太陽（石榴）和綠葉 */
  IC.suzani = function (ctx, s) {
    ctx.fillStyle = '#f4ead0'; ctx.fillRect(-12 * s, -10 * s, 24 * s, 20 * s);
    ctx.strokeStyle = '#a8202e'; ctx.lineWidth = 1.2 * s; ctx.strokeRect(-11 * s, -9 * s, 22 * s, 18 * s);
    ctx.fillStyle = '#c8202e'; ctx.beginPath(); ctx.arc(0, 0, 5.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2a030'; ctx.beginPath(); ctx.arc(0, 0, 2.6 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a8a4a';
    [[-8, -6], [8, -6], [-8, 6], [8, 6]].forEach(function (q) { ctx.beginPath(); ctx.ellipse(q[0] * s, q[1] * s, 2.6 * s, 1.4 * s, q[0] * q[1] > 0 ? 0.6 : -0.6, 0, Math.PI * 2); ctx.fill(); });
  };

  // v1.33 印度：調皮的獼猴（搶東西吃）＋綠色的鸚鵡
  CE.IN = {
    walker: function (ctx, e, t) {
      const cx = e.x + e.w / 2, by = e.y + e.h;
      ctx.save(); squashed(ctx, e, cx, by);
      const step = Math.sin(t * 0.4) * 2;
      ctx.fillStyle = '#a07850';
      ctx.fillRect(cx - 9 + step, by - 8, 5, 8); ctx.fillRect(cx + 4 - step, by - 8, 5, 8);
      ctx.beginPath(); ctx.ellipse(cx, by - 13, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#a07850'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(cx - e.dir * 10, by - 14); ctx.quadraticCurveTo(cx - e.dir * 24, by - 26, cx - e.dir * 16, by - 32); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + e.dir * 8, by - 22, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8a890'; ctx.beginPath(); ctx.ellipse(cx + e.dir * 10, by - 21, 4.5, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#16161c'; ctx.fillRect(cx + e.dir * 9 - 2, by - 24, 1.6, 1.6); ctx.fillRect(cx + e.dir * 12 - 1, by - 24, 1.6, 1.6);
      ctx.restore();
    },
    flyer: function (ctx, e, t) { bird(ctx, e, t, '#3aa84a', '#2a8a3a', function (ctx, cx, cy) { ctx.fillStyle = '#d8302a'; ctx.fillRect(cx + e.dir * 6 - 2, cy - 1, 4, 2); }); }
  };
  // v1.33 尼泊爾：犛牛（長毛、彎角）＋喜馬拉雅虹雉（彩色的國鳥）
  CE.NP = {
    walker: function (ctx, e, t) {
      const cx = e.x + e.w / 2, by = e.y + e.h;
      ctx.save(); squashed(ctx, e, cx, by);
      const step = Math.sin(t * 0.3) * 1.5;
      ctx.fillStyle = '#2a2420';
      ctx.fillRect(cx - 10 + step, by - 7, 4, 7); ctx.fillRect(cx + 6 - step, by - 7, 4, 7);
      ctx.beginPath(); ctx.ellipse(cx, by - 14, 15, 9, 0, 0, Math.PI * 2); ctx.fill();
      for (let k = -3; k <= 3; k++) ctx.fillRect(cx + k * 4 - 1, by - 8, 2, 5);                // 垂下來的長毛
      ctx.beginPath(); ctx.ellipse(cx + e.dir * 13, by - 16, 6, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e8e0d0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx + e.dir * 10, by - 21); ctx.quadraticCurveTo(cx + e.dir * 8, by - 28, cx + e.dir * 13, by - 28); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + e.dir * 16, by - 21); ctx.quadraticCurveTo(cx + e.dir * 20, by - 28, cx + e.dir * 17, by - 29); ctx.stroke();
      ctx.fillStyle = '#f4f4f0'; ctx.fillRect(cx + e.dir * 15 - 1, by - 18, 2, 2);
      ctx.restore();
    },
    flyer: function (ctx, e, t) { bird(ctx, e, t, '#2a6a9a', '#7a3a9a', function (ctx, cx, cy) { ctx.fillStyle = '#e8702a'; ctx.beginPath(); ctx.ellipse(cx - 9, cy + 1, 6, 3, 0, 0, Math.PI * 2); ctx.fill(); }); }
  };
  // v1.33 中國：戴毛帽、拿長矛的北方騎兵（長城要擋的那些人）＋丹頂鶴
  CE.CN = {
    walker: function (ctx, e, t) {
      const cx = e.x + e.w / 2, by = e.y + e.h;
      ctx.save(); squashed(ctx, e, cx, by);
      const step = Math.sin(t * 0.35) * 2;
      ctx.fillStyle = '#3a2a22';
      ctx.fillRect(cx - 7 + step, by - 7, 5, 7); ctx.fillRect(cx + 2 - step, by - 7, 5, 7);
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(cx - 9, by - 22, 18, 16);
      ctx.fillStyle = '#c8a07a'; ctx.beginPath(); ctx.arc(cx, by - 27, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#16161c'; ctx.fillRect(cx - 3 + e.dir * 1.5, by - 28, 2, 2); ctx.fillRect(cx + 1 + e.dir * 1.5, by - 28, 2, 2);
      ctx.fillStyle = '#8a6a4a'; ctx.beginPath(); ctx.arc(cx, by - 32, 7, Math.PI, 0); ctx.fill();          // 毛帽
      ctx.fillStyle = '#e8d8b0'; ctx.fillRect(cx - 8, by - 33, 16, 3);
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx + e.dir * 10, by - 6); ctx.lineTo(cx + e.dir * 14, by - 40); ctx.stroke();
      ctx.fillStyle = '#c8c8d0'; ctx.beginPath(); ctx.moveTo(cx + e.dir * 13, by - 40); ctx.lineTo(cx + e.dir * 15, by - 48); ctx.lineTo(cx + e.dir * 17, by - 40); ctx.fill();
      ctx.restore();
    },
    flyer: function (ctx, e, t) { bird(ctx, e, t, '#f4f4f0', '#2a2a2a', function (ctx, cx, cy) { ctx.fillStyle = '#d8202a'; ctx.beginPath(); ctx.arc(cx + e.dir * 9, cy - 8, 2, 0, Math.PI * 2); ctx.fill(); }); }
  };

  // v1.33 紀念品圖示
  /** 印度香料盒：圓形的鐵盒，裡面七小格五顏六色的香料 */
  IC.masala = function (ctx, s) {
    ctx.fillStyle = '#b8b8c0'; ctx.beginPath(); ctx.arc(0, 0, 13 * s, 0, Math.PI * 2); ctx.fill();
    const cols = ['#e8b830', '#c8302a', '#8a5a30', '#6a9a3a', '#e8702a', '#f4ead0', '#5a3a2a'];
    ctx.fillStyle = cols[6]; ctx.beginPath(); ctx.arc(0, 0, 3.6 * s, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3;
      ctx.fillStyle = cols[k]; ctx.beginPath(); ctx.arc(Math.cos(a) * 8 * s, Math.sin(a) * 8 * s, 3.6 * s, 0, Math.PI * 2); ctx.fill();
    }
  };
  /** 尼泊爾經幡：一串藍白紅綠黃的小方旗 */
  IC.prayerFlags = function (ctx, s) {
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1.2 * s;
    ctx.beginPath(); ctx.moveTo(-14 * s, -8 * s); ctx.quadraticCurveTo(0, -2 * s, 14 * s, -8 * s); ctx.stroke();
    const cols = ['#2a6ab8', '#f4f4f0', '#c8302a', '#3a9a4a', '#f2c230'];
    for (let k = 0; k < 5; k++) {
      const u = (k + 0.5) / 5, x = -14 * s + u * 28 * s, y = -8 * s + Math.sin(u * Math.PI) * 4 * s;
      ctx.fillStyle = cols[k]; ctx.fillRect(x - 2.4 * s, y, 4.8 * s, 9 * s);
    }
  };
  /** 中國青花瓷瓶：白底藍花 */
  IC.porcelain = function (ctx, s) {
    ctx.fillStyle = '#f4f4f8';
    ctx.beginPath(); ctx.moveTo(-4 * s, -13 * s); ctx.lineTo(4 * s, -13 * s); ctx.quadraticCurveTo(3 * s, -8 * s, 9 * s, -2 * s);
    ctx.quadraticCurveTo(12 * s, 8 * s, 5 * s, 13 * s); ctx.lineTo(-5 * s, 13 * s); ctx.quadraticCurveTo(-12 * s, 8 * s, -9 * s, -2 * s); ctx.quadraticCurveTo(-3 * s, -8 * s, -4 * s, -13 * s); ctx.fill();
    ctx.strokeStyle = '#1a4aa8'; ctx.lineWidth = 1.2 * s;
    ctx.beginPath(); ctx.moveTo(-9 * s, -1 * s); ctx.lineTo(9 * s, -1 * s); ctx.moveTo(-7 * s, 10 * s); ctx.lineTo(7 * s, 10 * s); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 4 * s, 3 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(-5 * s, 4 * s, 1.6 * s, 0, Math.PI * 2); ctx.arc(5 * s, 4 * s, 1.6 * s, 0, Math.PI * 2); ctx.stroke();
  };
  /** 蒙古馬頭琴：梯形的琴箱、長長的琴桿，頂上雕一個馬頭 */
  IC.morinKhuur = function (ctx, s) {
    ctx.fillStyle = '#8a5a30';
    ctx.beginPath(); ctx.moveTo(-7 * s, 4 * s); ctx.lineTo(7 * s, 4 * s); ctx.lineTo(8 * s, 14 * s); ctx.lineTo(-8 * s, 14 * s); ctx.closePath(); ctx.fill();
    ctx.fillRect(-1.4 * s, -10 * s, 2.8 * s, 15 * s);
    ctx.fillStyle = '#5a3a1a'; ctx.beginPath(); ctx.moveTo(-1.5 * s, -10 * s); ctx.lineTo(5 * s, -12 * s); ctx.lineTo(4 * s, -8 * s); ctx.lineTo(1.4 * s, -7 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-1 * s, -11 * s); ctx.lineTo(0, -15 * s); ctx.lineTo(1.4 * s, -11 * s); ctx.fill();
    ctx.strokeStyle = '#e8e0d0'; ctx.lineWidth = 0.6 * s;
    ctx.beginPath(); ctx.moveTo(-0.6 * s, -7 * s); ctx.lineTo(-0.6 * s, 13 * s); ctx.moveTo(0.6 * s, -7 * s); ctx.lineTo(0.6 * s, 13 * s); ctx.stroke();
  };

  // v1.33.3 泉州造船廠的船（從上面看）
  ['dhow', 'fuchuan', 'baochuan'].forEach(function (id) {
    IC['aship_' + id] = function (ctx, s) {
      if (typeof NavalWar === 'undefined') return;
      const sp = NavalWar.SHIPS[id];
      ctx.save(); ctx.scale(s * 0.42, s * 0.42); ctx.rotate(-0.5);
      NavalWar.drawTopShip(ctx, { x: 0, y: 0, a: 0, len: sp.len, wid: sp.wid }, id, 0, 0);
      ctx.restore();
    };
  });

  return { FLAGS: FLAGS, dome: dome };
})();
