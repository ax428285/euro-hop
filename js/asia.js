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

  return { FLAGS: FLAGS, dome: dome };
})();
