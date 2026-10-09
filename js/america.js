'use strict';

/**
 * 美洲篇（v1.31）的美術：國旗、地標、遠景、各國敵人、道具、紀念品與時裝圖示、亞馬遜大蛇（賽道關的畫面在 race.js）。
 *
 * 跟 expedition.js 一樣「從外面掛進 Sprites」：Sprites 回傳的 landmarks / skylines / props / icons /
 * countryEnemies / shaftThemes / bossKinds / flagDirs 都是可以加東西的物件；大蛇的身體（彈射物）則是包一層 Sprites.shot。
 *
 * 載入順序：sprites.js 之後（要掛進 Sprites）、game.js 之前。
 */
const America = (function () {

  // ── 小工具 ──────────────────────────────────────────────

  function star(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }
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
  function seaBand(ctx, gy, W, top, color, t) {
    ctx.fillStyle = color;
    ctx.fillRect(0, top, W, gy - top);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 12; i++) {
      const x = ((i * 137 + t * 0.3) % (W + 60)) - 30;
      ctx.fillRect(x, top + 6 + (i % 4) * 7, 22, 1.5);
    }
  }
  function squashed(ctx, e, cx, by) {
    if (e.squash > 0) { ctx.translate(cx, by); ctx.scale(1.3, 0.35); ctx.translate(-cx, -by); }
  }
  /** 簡單的鳥：身體＋兩片拍動的翅膀＋嘴（各國換顏色） */
  function bird(ctx, e, t, o) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    ctx.save();
    if (e.squash > 0) { ctx.translate(cx, cy); ctx.scale(1.3, 0.4); ctx.translate(-cx, -cy); }
    const flap = Math.sin(t * (o.flapSpeed || 0.3)) * (o.flapAmp || 8);
    ctx.fillStyle = o.wing || o.body;
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy - 2); ctx.quadraticCurveTo(cx - 16, cy - 10 - flap, cx - (o.span || 26), cy - flap);
    ctx.quadraticCurveTo(cx - 14, cy + 2, cx - 3, cy + 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 3, cy - 2); ctx.quadraticCurveTo(cx + 16, cy - 10 - flap, cx + (o.span || 26), cy - flap);
    ctx.quadraticCurveTo(cx + 14, cy + 2, cx + 3, cy + 2); ctx.fill();
    ctx.fillStyle = o.body;
    ctx.beginPath(); ctx.ellipse(cx, cy, e.w * 0.3, e.h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = o.head || o.body;
    ctx.beginPath(); ctx.arc(cx + e.dir * 10, cy - 4, 6, 0, Math.PI * 2); ctx.fill();
    if (o.detail) o.detail(ctx, cx, cy, e.dir, t);
    ctx.fillStyle = o.beak || '#e8a033';
    const bl = o.beakLen || 7, bh = o.beakH || 3;
    ctx.beginPath();
    ctx.moveTo(cx + e.dir * 15, cy - 4 - bh / 2); ctx.lineTo(cx + e.dir * (15 + bl), cy - 2); ctx.lineTo(cx + e.dir * 15, cy - 1 + bh / 2);
    ctx.fill();
    ctx.fillStyle = '#16161c';
    ctx.fillRect(cx + e.dir * 11, cy - 6, 2, 2);
    ctx.restore();
  }

  // ── 國旗 ────────────────────────────────────────────────

  const FLAGS = {
    // 古巴：藍白五條橫紋，旗桿那側一個紅色三角形、中間一顆白星
    cuba: function (ctx, x, y, w, h, c) {
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? c[1] : c[0]; ctx.fillRect(x, y + h * i / 5, w, h / 5 + 0.5); }
      ctx.fillStyle = c[2];
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.43, y + h / 2); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
      star(ctx, x + w * 0.15, y + h / 2, h * 0.16, c[1]);
    },
    // 牙買加：黃色斜十字，上下綠色三角、左右黑色三角
    jamaica: function (ctx, x, y, w, h, c) {
      ctx.fillStyle = c[0]; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = c[2];
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w / 2, y + h / 2); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w / 2, y + h / 2); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.strokeStyle = c[1]; ctx.lineWidth = h * 0.16;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke();
      ctx.restore();
    },
    // 墨西哥：綠白紅直條，中間一個小小的老鷹國徽（棕色圓）
    mexico: function (ctx, x, y, w, h, c) {
      for (let i = 0; i < 3; i++) { ctx.fillStyle = c[i]; ctx.fillRect(x + w * i / 3, y, w / 3 + 0.5, h); }
      ctx.fillStyle = '#8a5a2a'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w * 0.07, h * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a8a3a'; ctx.fillRect(x + w / 2 - w * 0.07, y + h * 0.62, w * 0.14, h * 0.05);
    },
    // 巴拿馬：四格 —— 左上白底藍星、右上紅、左下藍、右下白底紅星
    panama: function (ctx, x, y, w, h, c) {
      ctx.fillStyle = c[0]; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = c[1]; ctx.fillRect(x + w / 2, y, w / 2, h / 2);
      ctx.fillStyle = c[2]; ctx.fillRect(x, y + h / 2, w / 2, h / 2);
      star(ctx, x + w / 4, y + h / 4, h * 0.14, c[2]);
      star(ctx, x + w * 3 / 4, y + h * 3 / 4, h * 0.14, c[1]);
    },
    // 哥倫比亞：上半黃、下面藍、紅各四分之一
    colombia: function (ctx, x, y, w, h, c) {
      ctx.fillStyle = c[0]; ctx.fillRect(x, y, w, h / 2);
      ctx.fillStyle = c[1]; ctx.fillRect(x, y + h / 2, w, h / 4);
      ctx.fillStyle = c[2]; ctx.fillRect(x, y + h * 3 / 4, w, h / 4);
    },
    // 巴西：綠底、黃色菱形、中間藍色圓球＋一條白帶
    brazil: function (ctx, x, y, w, h, c) {
      ctx.fillStyle = c[0]; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = c[1];
      ctx.beginPath(); ctx.moveTo(x + w * 0.08, y + h / 2); ctx.lineTo(x + w / 2, y + h * 0.1); ctx.lineTo(x + w * 0.92, y + h / 2); ctx.lineTo(x + w / 2, y + h * 0.9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c[2]; ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h * 0.24, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h * 0.24, 0, Math.PI * 2); ctx.clip();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, h * 0.06);
      ctx.beginPath(); ctx.arc(x + w / 2 + h * 0.1, y + h * 0.95, h * 0.5, Math.PI * 1.18, Math.PI * 1.72); ctx.stroke();
      ctx.restore();
    }
  };
  Object.keys(FLAGS).forEach(function (k) { Sprites.flagDirs[k] = FLAGS[k]; });

  // ── 地標（遠方的大建築，半透明） ───────────────────────

  const LM = {
    /** 古巴：哈瓦那的國會大廈（白色圓頂）＋前面一排彩色老房子 */
    capitolio: function (ctx, x, baseY, s) {
      ctx.save(); ctx.translate(x, baseY);
      ctx.fillStyle = 'rgba(236, 230, 214, 0.75)';
      ctx.fillRect(-170 * s, -70 * s, 340 * s, 70 * s);
      ctx.fillRect(-60 * s, -120 * s, 120 * s, 50 * s);
      ctx.beginPath(); ctx.arc(0, -120 * s, 52 * s, Math.PI, 0); ctx.fill();
      ctx.fillRect(-8 * s, -196 * s, 16 * s, 26 * s);
      ctx.fillStyle = 'rgba(190, 180, 160, 0.7)';
      for (let k = 0; k < 8; k++) ctx.fillRect((-48 + k * 13) * s, -116 * s, 5 * s, 44 * s);
      for (let k = 0; k < 14; k++) ctx.fillRect((-160 + k * 24) * s, -60 * s, 8 * s, 52 * s);
      const cols = ['rgba(120, 200, 200, 0.6)', 'rgba(240, 170, 90, 0.6)', 'rgba(230, 120, 140, 0.6)', 'rgba(250, 220, 120, 0.6)'];
      for (let k = 0; k < 6; k++) { ctx.fillStyle = cols[k % 4]; ctx.fillRect((-220 + k * 74) * s, -46 * s, 70 * s, 46 * s); }
      ctx.restore();
    },
    /** 牙買加：起霧的藍山＋一層層的咖啡梯田 */
    blueMountains: function (ctx, x, baseY, s) {
      ctx.save(); ctx.translate(x, baseY);
      ctx.fillStyle = 'rgba(70, 110, 150, 0.6)';
      ctx.beginPath(); ctx.moveTo(-260 * s, 0); ctx.lineTo(-120 * s, -170 * s); ctx.lineTo(-40 * s, -130 * s); ctx.lineTo(60 * s, -210 * s); ctx.lineTo(260 * s, 0); ctx.fill();
      ctx.fillStyle = 'rgba(240, 248, 255, 0.45)';
      ctx.beginPath(); ctx.ellipse(-20 * s, -150 * s, 140 * s, 22 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(60, 120, 70, 0.6)'; ctx.lineWidth = 4 * s;
      for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo((-200 + k * 20) * s, -k * 26 * s); ctx.lineTo((200 - k * 20) * s, -k * 26 * s); ctx.stroke(); }
      ctx.restore();
    },
    /** 墨西哥：奇琴伊察的庫庫爾坎金字塔（九層台階＋頂上的神廟） */
    chichenItza: function (ctx, x, baseY, s) {
      ctx.save(); ctx.translate(x, baseY);
      for (let k = 0; k < 9; k++) {
        const w = (260 - k * 24) * s, y = -(k + 1) * 18 * s;
        ctx.fillStyle = k % 2 ? 'rgba(200, 184, 150, 0.75)' : 'rgba(180, 164, 130, 0.75)';
        ctx.fillRect(-w / 2, y, w, 18 * s);
      }
      ctx.fillStyle = 'rgba(150, 134, 104, 0.8)';
      ctx.fillRect(-20 * s, -162 * s, 40 * s, 162 * s);               // 正面的大階梯
      ctx.fillStyle = 'rgba(190, 172, 136, 0.85)';
      ctx.fillRect(-40 * s, -196 * s, 80 * s, 34 * s);                 // 頂上的神廟
      ctx.fillStyle = 'rgba(90, 70, 50, 0.7)'; ctx.fillRect(-10 * s, -188 * s, 20 * s, 26 * s);
      ctx.restore();
    },
    /** 巴拿馬：米拉弗洛雷斯船閘 —— 一格格的閘室＋一艘大貨輪 */
    canalLocks: function (ctx, x, baseY, s) {
      ctx.save(); ctx.translate(x, baseY);
      ctx.fillStyle = 'rgba(150, 150, 140, 0.7)';
      for (let k = 0; k < 3; k++) ctx.fillRect((-240 + k * 160) * s, -(20 + k * 22) * s, 160 * s, (20 + k * 22) * s);
      ctx.fillStyle = 'rgba(60, 120, 150, 0.6)';
      for (let k = 0; k < 3; k++) ctx.fillRect((-236 + k * 160) * s, -(18 + k * 22) * s, 152 * s, 8 * s);
      // 貨輪
      ctx.fillStyle = 'rgba(180, 60, 50, 0.75)';
      ctx.beginPath(); ctx.moveTo(-60 * s, -60 * s); ctx.lineTo(150 * s, -60 * s); ctx.lineTo(130 * s, -36 * s); ctx.lineTo(-50 * s, -36 * s); ctx.fill();
      const cc = ['rgba(60, 120, 200, 0.75)', 'rgba(230, 170, 60, 0.75)', 'rgba(80, 160, 90, 0.75)'];
      for (let k = 0; k < 8; k++) { ctx.fillStyle = cc[k % 3]; ctx.fillRect((-40 + k * 20) * s, -80 * s, 18 * s, 20 * s); }
      ctx.fillStyle = 'rgba(240, 240, 235, 0.8)'; ctx.fillRect(110 * s, -100 * s, 30 * s, 40 * s);
      ctx.restore();
    },
    /** 哥倫比亞：卡塔赫納的城牆＋彩色的殖民老房子（木頭陽台、九重葛） */
    cartagena: function (ctx, x, baseY, s) {
      ctx.save(); ctx.translate(x, baseY);
      const cols = ['rgba(240, 190, 70, 0.7)', 'rgba(70, 150, 190, 0.7)', 'rgba(220, 110, 90, 0.7)', 'rgba(150, 200, 120, 0.7)', 'rgba(240, 150, 180, 0.7)'];
      for (let k = 0; k < 5; k++) {
        const hx = (-200 + k * 80) * s, hh = (90 + (k % 2) * 20) * s;
        ctx.fillStyle = cols[k]; ctx.fillRect(hx, -hh - 40 * s, 76 * s, hh);
        ctx.fillStyle = 'rgba(110, 70, 40, 0.75)'; ctx.fillRect(hx + 6 * s, -hh + 10 * s, 64 * s, 6 * s);   // 陽台
        ctx.fillStyle = 'rgba(220, 60, 140, 0.6)';
        ctx.beginPath(); ctx.arc(hx + 60 * s, -hh + 4 * s, 10 * s, 0, Math.PI * 2); ctx.fill();          // 九重葛
      }
      ctx.fillStyle = 'rgba(190, 160, 110, 0.85)';
      ctx.fillRect(-240 * s, -40 * s, 480 * s, 40 * s);              // 城牆
      for (let k = 0; k < 12; k++) ctx.fillRect((-240 + k * 40) * s, -52 * s, 22 * s, 12 * s);
      ctx.restore();
    },
    /** 巴西：里約的麵包山＋纜車 */
    sugarloaf: function (ctx, x, baseY, s) {
      ctx.save(); ctx.translate(x, baseY);
      ctx.fillStyle = 'rgba(60, 90, 80, 0.7)';
      ctx.beginPath(); ctx.moveTo(-60 * s, 0); ctx.quadraticCurveTo(-40 * s, -210 * s, 30 * s, -220 * s); ctx.quadraticCurveTo(90 * s, -200 * s, 110 * s, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-260 * s, 0); ctx.quadraticCurveTo(-220 * s, -110 * s, -160 * s, -116 * s); ctx.quadraticCurveTo(-120 * s, -100 * s, -100 * s, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(60, 60, 60, 0.6)'; ctx.lineWidth = 1.2 * s;
      ctx.beginPath(); ctx.moveTo(-160 * s, -116 * s); ctx.lineTo(28 * s, -218 * s); ctx.stroke();
      ctx.fillStyle = 'rgba(220, 220, 220, 0.85)'; ctx.fillRect(-70 * s, -170 * s, 14 * s, 9 * s);
      ctx.restore();
    }
  };
  Object.keys(LM).forEach(function (k) { Sprites.landmarks[k] = LM[k]; });

  // ── 遠景 ────────────────────────────────────────────────

  const SKY = {
    // 古巴：加勒比海＋馬雷貢海堤的老房子
    CU: function (ctx, camX, gy, W, def, t) {
      seaBand(ctx, gy, W, gy - 60, 'rgba(60, 160, 200, 0.6)', t);
      tiled(ctx, camX, 0.2, 480, W, function (x0) {
        const cols = ['rgba(120, 200, 200, 0.5)', 'rgba(240, 170, 90, 0.5)', 'rgba(230, 120, 140, 0.5)', 'rgba(250, 220, 120, 0.5)', 'rgba(150, 170, 220, 0.5)'];
        for (let k = 0; k < 5; k++) {
          const hx = x0 + 40 + k * 46, hh = 54 + (k % 3) * 14;
          ctx.fillStyle = cols[k]; ctx.fillRect(hx, gy - 60 - hh, 44, hh);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'; ctx.fillRect(hx + 4, gy - 60 - hh + 8, 36, 4);
        }
      });
    },
    // 牙買加：藍色的山＋綠色的丘陵
    JM: function (ctx, camX, gy, W) {
      ridge(ctx, camX, 0.05, gy - 30, W, 'rgba(80, 120, 160, 0.55)', 200, 18, 51);
      ctx.fillStyle = 'rgba(240, 248, 255, 0.3)';
      ctx.fillRect(0, gy - 160, W, 30);
      ridge(ctx, camX, 0.15, gy - 10, W, 'rgba(60, 130, 80, 0.6)', 90, 6, 53);
    },
    // 墨西哥：叢林上冒出來的金字塔
    MX: function (ctx, camX, gy, W) {
      ridge(ctx, camX, 0.08, gy - 10, W, 'rgba(60, 120, 70, 0.6)', 60, 4, 55);
      tiled(ctx, camX, 0.12, 700, W, function (x0) {
        ctx.fillStyle = 'rgba(190, 170, 130, 0.6)';
        for (let k = 0; k < 6; k++) ctx.fillRect(x0 + 300 - (90 - k * 14), gy - 50 - k * 14, (90 - k * 14) * 2, 14);
      });
    },
    // 巴拿馬：熱帶雨林的山＋排隊等過運河的大船
    PA: function (ctx, camX, gy, W, def, t) {
      ridge(ctx, camX, 0.06, gy - 30, W, 'rgba(50, 110, 70, 0.6)', 140, 10, 57);
      seaBand(ctx, gy, W, gy - 30, 'rgba(50, 120, 150, 0.6)', t);
      tiled(ctx, camX, 0.18, 520, W, function (x0) {
        ctx.fillStyle = 'rgba(70, 80, 100, 0.6)';
        ctx.fillRect(x0 + 100, gy - 52, 160, 18);
        const cc = ['rgba(200, 80, 60, 0.6)', 'rgba(60, 120, 200, 0.6)', 'rgba(230, 180, 60, 0.6)'];
        for (let k = 0; k < 6; k++) { ctx.fillStyle = cc[k % 3]; ctx.fillRect(x0 + 110 + k * 22, gy - 66, 20, 14); }
        ctx.fillStyle = 'rgba(230, 230, 230, 0.6)'; ctx.fillRect(x0 + 230, gy - 80, 22, 28);
      });
    },
    // 哥倫比亞：加勒比海上的海盜船（會開砲的那幾艘）
    CO: function (ctx, camX, gy, W, def, t) {
      seaBand(ctx, gy, W, gy - 50, 'rgba(60, 150, 190, 0.55)', t);
      tiled(ctx, camX, 0.25, 640, W, function (x0) {
        const bx = x0 + 200, by = gy - 52 + Math.sin(t * 0.04 + x0) * 2;
        ctx.fillStyle = 'rgba(60, 40, 30, 0.7)';
        ctx.beginPath(); ctx.moveTo(bx - 50, by); ctx.lineTo(bx + 50, by); ctx.lineTo(bx + 38, by + 14); ctx.lineTo(bx - 38, by + 14); ctx.fill();
        ctx.fillRect(bx - 2, by - 60, 3, 60);
        ctx.fillStyle = 'rgba(30, 30, 34, 0.7)';
        ctx.beginPath(); ctx.moveTo(bx + 2, by - 56); ctx.lineTo(bx + 36, by - 40); ctx.lineTo(bx + 2, by - 20); ctx.fill();
        ctx.fillStyle = 'rgba(240, 240, 240, 0.7)'; ctx.beginPath(); ctx.arc(bx + 14, by - 40, 4, 0, Math.PI * 2); ctx.fill();
        if ((t + x0) % 130 < 8) { ctx.fillStyle = 'rgba(255, 200, 120, 0.8)'; ctx.beginPath(); ctx.arc(bx - 48, by + 4, 8, 0, Math.PI * 2); ctx.fill(); }
      });
    },
    // 巴西：科帕卡巴納的海灘＋遠方的山
    BR: function (ctx, camX, gy, W, def, t) {
      ridge(ctx, camX, 0.05, gy - 40, W, 'rgba(60, 100, 90, 0.6)', 170, 26, 59);
      seaBand(ctx, gy, W, gy - 40, 'rgba(60, 150, 190, 0.55)', t);
      ctx.fillStyle = 'rgba(240, 220, 170, 0.6)'; ctx.fillRect(0, gy - 14, W, 14);
    }
  };
  Object.keys(SKY).forEach(function (k) { Sprites.skylines[k] = SKY[k]; });

  // ── 各國敵人（行為、碰撞跟原本一樣，只換長相） ──────────

  const CE = Sprites.countryEnemies;
  CE.CU = {
    // 古巴：每年春天成群橫越馬路的陸蟹＋古巴的國鳥古巴咬鵑（紅白藍三色，跟國旗一樣）
    walker: function (ctx, e, t) {
      const cx = e.x + e.w / 2, by = e.y + e.h;
      ctx.save(); squashed(ctx, e, cx, by);
      const s = Math.sin(t * 0.4) * 2;
      ctx.strokeStyle = '#c0402a'; ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.moveTo(cx - 6, by - 8); ctx.lineTo(cx - 14 - k * 2, by - 2 + (k % 2 ? s : -s)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 6, by - 8); ctx.lineTo(cx + 14 + k * 2, by - 2 + (k % 2 ? -s : s)); ctx.stroke();
      }
      ctx.fillStyle = '#d8502a';
      ctx.beginPath(); ctx.ellipse(cx, by - 11, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + e.dir * 15, by - 18, 5, 0, Math.PI * 2); ctx.fill();          // 大螯
      ctx.fillStyle = '#16161c';
      ctx.fillRect(cx - 4, by - 22, 2, 5); ctx.fillRect(cx + 3, by - 22, 2, 5);
      ctx.fillStyle = '#f4f4f0'; ctx.beginPath(); ctx.arc(cx - 3, by - 23, 2, 0, Math.PI * 2); ctx.arc(cx + 4, by - 23, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
    flyer: function (ctx, e, t) {
      bird(ctx, e, t, {
        body: '#e8e8ea', wing: '#2a6ab8', head: '#2a6ab8', beak: '#3a3a3a', beakLen: 4,
        detail: function (ctx, cx, cy) {
          ctx.fillStyle = '#d8262c'; ctx.beginPath(); ctx.ellipse(cx, cy + 4, 7, 3, 0, 0, Math.PI); ctx.fill();
        }
      });
    }
  };
  CE.JM = {
    // 牙買加：貓鼬（十九世紀被帶進來抓老鼠，結果滿山都是）＋國鳥「醫生鳥」（尾巴兩條長長的飄帶）
    walker: function (ctx, e, t) {
      const cx = e.x + e.w / 2, by = e.y + e.h;
      ctx.save(); squashed(ctx, e, cx, by);
      const step = Math.sin(t * 0.4) * 2;
      ctx.fillStyle = '#8a6a44';
      ctx.fillRect(cx - 10 + step, by - 6, 4, 6); ctx.fillRect(cx + 6 - step, by - 6, 4, 6);
      ctx.beginPath(); ctx.ellipse(cx, by - 11, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx - e.dir * 20, by - 10, 9, 3, -e.dir * 0.3, 0, Math.PI * 2); ctx.fill();   // 尾巴
      ctx.beginPath(); ctx.ellipse(cx + e.dir * 14, by - 15, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#16161c'; ctx.fillRect(cx + e.dir * 16 - 1, by - 17, 2, 2);
      ctx.restore();
    },
    flyer: function (ctx, e, t) {
      bird(ctx, e, t, {
        body: '#2f9a4a', wing: '#2a7a3a', head: '#16161c', beak: '#d8262c', beakLen: 9, beakH: 2, span: 20, flapSpeed: 0.7, flapAmp: 6,
        detail: function (ctx, cx, cy, d, t) {
          ctx.strokeStyle = '#16161c'; ctx.lineWidth = 1.5;
          const w = Math.sin(t * 0.2) * 3;
          ctx.beginPath(); ctx.moveTo(cx - d * 8, cy); ctx.quadraticCurveTo(cx - d * 22, cy + 6 + w, cx - d * 34, cy + 10 - w); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx - d * 8, cy + 2); ctx.quadraticCurveTo(cx - d * 22, cy + 10 - w, cx - d * 36, cy + 14 + w); ctx.stroke();
        }
      });
    }
  };
  CE.MX = {
    // 墨西哥：墨西哥鈍口螈（六角恐龍，粉紅色、頭上三對鰓）＋聖井裡的蝙蝠
    walker: function (ctx, e, t) {
      const cx = e.x + e.w / 2, by = e.y + e.h;
      ctx.save(); squashed(ctx, e, cx, by);
      const w = Math.sin(t * 0.3) * 3;
      ctx.fillStyle = '#f4a8b8';
      ctx.beginPath(); ctx.ellipse(cx, by - 9, 14, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - e.dir * 12, by - 9); ctx.quadraticCurveTo(cx - e.dir * 22, by - 12 + w, cx - e.dir * 26, by - 6); ctx.lineTo(cx - e.dir * 12, by - 5); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + e.dir * 13, by - 13, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e0607a'; ctx.lineWidth = 2;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath(); ctx.moveTo(cx + e.dir * 9, by - 15 + k * 3); ctx.lineTo(cx + e.dir * 3, by - 22 + k * 4); ctx.stroke();
      }
      ctx.fillStyle = '#16161c'; ctx.fillRect(cx + e.dir * 16 - 1, by - 15, 2, 2);
      ctx.strokeStyle = '#8a3a4a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx + e.dir * 15, by - 11, 3, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.restore();
    },
    flyer: function (ctx, e, t) {
      bird(ctx, e, t, { body: '#3a2a3a', wing: '#4a3a4a', head: '#3a2a3a', beak: '#3a2a3a', beakLen: 2, flapSpeed: 0.6, flapAmp: 10, span: 30 });
    }
  };
  CE.PA = {
    // 巴拿馬：扛著葉子的切葉蟻＋巨嘴鳥
    walker: function (ctx, e, t) {
      const cx = e.x + e.w / 2, by = e.y + e.h;
      ctx.save(); squashed(ctx, e, cx, by);
      const s = Math.sin(t * 0.5) * 2;
      ctx.strokeStyle = '#4a2a1a'; ctx.lineWidth = 1.6;
      for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(cx + k * 6, by - 7); ctx.lineTo(cx + k * 8 + s * k, by); ctx.stroke(); }
      ctx.fillStyle = '#7a3a1a';
      ctx.beginPath(); ctx.arc(cx - e.dir * 10, by - 9, 6, 0, Math.PI * 2); ctx.arc(cx, by - 9, 4, 0, Math.PI * 2); ctx.arc(cx + e.dir * 9, by - 11, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4aa84a';
      ctx.beginPath(); ctx.ellipse(cx + e.dir * 2, by - 28, 13, 8, e.dir * 0.4, 0, Math.PI * 2); ctx.fill();   // 扛著的葉子
      ctx.strokeStyle = '#2a7a2a'; ctx.beginPath(); ctx.moveTo(cx + e.dir * 9, by - 15); ctx.lineTo(cx + e.dir * 2, by - 26); ctx.stroke();
      ctx.restore();
    },
    flyer: function (ctx, e, t) {
      bird(ctx, e, t, {
        body: '#1e1e22', wing: '#1e1e22', head: '#1e1e22', beak: '#f29a20', beakLen: 14, beakH: 7,
        detail: function (ctx, cx, cy, d) {
          ctx.fillStyle = '#f8e050'; ctx.beginPath(); ctx.arc(cx + d * 9, cy - 1, 4, 0, Math.PI * 2); ctx.fill();
        }
      });
    }
  };
  CE.CO = {
    // 哥倫比亞：獨眼海盜（衛兵型換成海盜）＋海盜的鸚鵡
    walker: function (ctx, e, t) {
      const cx = e.x + e.w / 2, by = e.y + e.h;
      ctx.save(); squashed(ctx, e, cx, by);
      const s = Math.sin(t * 0.3) * 2;
      ctx.fillStyle = '#3a2a24'; ctx.fillRect(cx - 7 + s, by - 9, 5, 9); ctx.fillRect(cx + 2 - s, by - 9, 5, 9);
      ctx.fillStyle = '#f4f0e8'; U.roundRect(ctx, cx - 9, by - 26, 18, 18, 3); ctx.fill();
      ctx.fillStyle = '#c8202a'; for (let k = 0; k < 3; k++) ctx.fillRect(cx - 9, by - 24 + k * 6, 18, 2);
      ctx.fillStyle = '#e0b088'; ctx.beginPath(); ctx.arc(cx, by - 31, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#16161c';
      ctx.beginPath(); ctx.moveTo(cx - 10, by - 34); ctx.lineTo(cx + 10, by - 34); ctx.lineTo(cx, by - 44); ctx.closePath(); ctx.fill();   // 三角帽
      ctx.fillRect(cx + e.dir * 2 - 2, by - 33, 4, 3);                                                                                   // 眼罩
      ctx.strokeStyle = '#c8c8d0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx + e.dir * 10, by - 18); ctx.quadraticCurveTo(cx + e.dir * 20, by - 26, cx + e.dir * 16, by - 34); ctx.stroke();   // 彎刀
      ctx.restore();
    },
    flyer: function (ctx, e, t) {
      bird(ctx, e, t, {
        body: '#d8262c', wing: '#2a6ab8', head: '#d8262c', beak: '#f4f0e8', beakLen: 5, beakH: 5,
        detail: function (ctx, cx, cy, d) {
          ctx.fillStyle = '#f2c230'; ctx.fillRect(cx - 8, cy - 1, 16, 3);
        }
      });
    }
  };

  // ── 前景道具 ────────────────────────────────────────────

  const PR = Sprites.props;
  /** 古巴：停在路邊的 1950 年代老爺車（顏色輪流換） */
  PR.classicCar = function (ctx, x, baseY) {
    const cols = ['#58b8c8', '#e8a040', '#d85a6a', '#8ac060'];
    const col = cols[Math.abs(Math.round(x / 97)) % cols.length];
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(-54, -10); ctx.lineTo(-50, -26); ctx.lineTo(-36, -24); ctx.lineTo(-26, -40); ctx.lineTo(18, -40); ctx.lineTo(30, -24);
    ctx.lineTo(54, -22); ctx.lineTo(56, -10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(190, 230, 250, 0.8)'; ctx.fillRect(-22, -37, 18, 12); ctx.fillRect(0, -37, 16, 12);
    ctx.fillStyle = '#f4f0e8'; ctx.fillRect(-54, -14, 110, 3);
    ctx.fillStyle = '#c8c8d0'; ctx.fillRect(-58, -12, 6, 4); ctx.fillRect(54, -12, 6, 4);
    [-34, 34].forEach(function (wx) {
      ctx.fillStyle = '#1e1e22'; ctx.beginPath(); ctx.arc(wx, -8, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8e8ee'; ctx.beginPath(); ctx.arc(wx, -8, 4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  };
  /** 古巴：一對邦戈鼓 */
  PR.bongos = function (ctx, x, baseY) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = '#6a3a1a'; ctx.fillRect(-4, -22, 8, 22);
    [[-10, 9], [10, 7]].forEach(function (d) {
      ctx.fillStyle = '#a8602a'; ctx.beginPath(); ctx.moveTo(d[0] - d[1], -36); ctx.lineTo(d[0] + d[1], -36); ctx.lineTo(d[0] + d[1] - 2, -20); ctx.lineTo(d[0] - d[1] + 2, -20); ctx.fill();
      ctx.fillStyle = '#f0e2c0'; ctx.beginPath(); ctx.ellipse(d[0], -36, d[1], 3, 0, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  };
  /** 牙買加：一大疊雷鬼音響（sound system） */
  PR.soundSystem = function (ctx, x, baseY, t) {
    ctx.save(); ctx.translate(x, baseY);
    const beat = Math.max(0, Math.sin((t || 0) * 0.21)) * 1.5;
    [[-34, -36, 34, 36], [0, -36, 34, 36], [-17, -70, 34, 34]].forEach(function (b) {
      ctx.fillStyle = '#1e1e22'; ctx.fillRect(b[0], b[1], b[2], b[3]);
      ctx.fillStyle = '#3a3a40'; ctx.beginPath(); ctx.arc(b[0] + b[2] / 2, b[1] + b[3] / 2, 11 + beat, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a5a62'; ctx.beginPath(); ctx.arc(b[0] + b[2] / 2, b[1] + b[3] / 2, 4, 0, Math.PI * 2); ctx.fill();
    });
    ['#d8262c', '#f2c230', '#2f9a4a'].forEach(function (c, k) { ctx.fillStyle = c; ctx.fillRect(-34 + k * 23, -74, 23, 4); });
    ctx.restore();
  };
  /** 牙買加、哥倫比亞：堆在一起的咖啡豆麻布袋 */
  PR.coffeeSacks = function (ctx, x, baseY) {
    ctx.save(); ctx.translate(x, baseY);
    [[-18, 0], [14, 0], [-2, -22]].forEach(function (p) {
      ctx.fillStyle = '#c8a874';
      ctx.beginPath(); ctx.ellipse(p[0], p[1] - 12, 18, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6a3a1a'; ctx.fillRect(p[0] - 8, p[1] - 15, 16, 2); ctx.fillRect(p[0] - 6, p[1] - 11, 12, 2);
    });
    ctx.fillStyle = '#4a2a1a';
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(-26 + k * 6, -1, 2.4, 1.6, 0.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  /** 巴拿馬：拖船過閘的電動「騾子」火車頭 */
  PR.canalMule = function (ctx, x, baseY) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = '#5a5a5a'; ctx.fillRect(-40, -4, 80, 4);
    ctx.fillStyle = '#d8d8d0'; ctx.fillRect(-36, -34, 72, 28);
    ctx.fillStyle = '#c8402a'; ctx.fillRect(-36, -12, 72, 6);
    ctx.fillStyle = '#4a6a8a'; ctx.fillRect(-28, -28, 16, 10); ctx.fillRect(12, -28, 16, 10);
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(-6, -44, 12, 10);
    [-24, 24].forEach(function (wx) { ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.arc(wx, -4, 5, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  };
  /** 巴拿馬：岸上的貨櫃 */
  PR.shipContainer = function (ctx, x, baseY) {
    ctx.save(); ctx.translate(x, baseY);
    [['#3a7ac0', -60, 0], ['#d8602a', 0, 0], ['#4a9a4a', -30, -30]].forEach(function (c) {
      ctx.fillStyle = c[0]; ctx.fillRect(c[1], c[2] - 30, 60, 30);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let k = 6; k < 60; k += 8) ctx.fillRect(c[1] + k, c[2] - 28, 2, 26);
    });
    ctx.restore();
  };
  /** 哥倫比亞：殖民老房子的木頭陽台（底下掛著九重葛） */
  PR.balcony = function (ctx, x, baseY) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = '#f0c060'; ctx.fillRect(-42, -90, 84, 90);
    ctx.fillStyle = '#6a3a1a'; ctx.fillRect(-46, -58, 92, 6);
    for (let k = 0; k < 8; k++) ctx.fillRect(-42 + k * 12, -76, 3, 18);
    ctx.fillRect(-46, -78, 92, 3);
    ctx.fillStyle = '#4a2a1a'; ctx.fillRect(-14, -40, 28, 40);
    ctx.fillStyle = '#d83a8a';
    for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(-40 + k * 13, -52 + (k % 2) * 6, 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  };
  /** 巴西：海灘上賣椰子水的小攤 */
  PR.beachKiosk = function (ctx, x, baseY) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = '#e8e0d0'; ctx.fillRect(-34, -40, 68, 40);
    ctx.fillStyle = '#2f9a4a';
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-40 + k * 16, -40); ctx.lineTo(-32 + k * 16, -52); ctx.lineTo(-24 + k * 16, -40); ctx.fill(); }
    ctx.fillStyle = '#f2c230'; ctx.fillRect(-40, -44, 80, 4);
    ctx.fillStyle = '#5a8a3a';
    [[-16, -46], [0, -48], [16, -46]].forEach(function (c) { ctx.beginPath(); ctx.arc(c[0], c[1], 6, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  };

  // ── 紀念品圖示（v1.31 美洲篇不給裝備，改給紀念品：souvenirs.js）────────────

  const IC = Sprites.icons;
  /** 古巴沙鈴：兩支交叉的彩色沙鈴 */
  IC.maracas = function (ctx, s) {
    [[-1, '#e84a3a', '#f2c230'], [1, '#2f9a4a', '#f2c230']].forEach(function (m) {
      ctx.save(); ctx.rotate(m[0] * 0.45);
      ctx.fillStyle = '#8a5a2a'; ctx.fillRect(-1.6 * s, 0, 3.2 * s, 14 * s);
      ctx.fillStyle = m[1];
      ctx.beginPath(); ctx.ellipse(0, -6 * s, 6.5 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = m[2]; ctx.fillRect(-6 * s, -7 * s, 12 * s, 2.4 * s);
      ctx.restore();
    });
  };
  /** 藍山咖啡豆：小木桶＋桶口兩顆咖啡豆 */
  IC.bmcoffee = function (ctx, s) {
    ctx.fillStyle = '#a8743a';
    ctx.beginPath(); ctx.moveTo(-10 * s, -10 * s); ctx.quadraticCurveTo(-13 * s, 2 * s, -10 * s, 13 * s);
    ctx.lineTo(10 * s, 13 * s); ctx.quadraticCurveTo(13 * s, 2 * s, 10 * s, -10 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a4a50'; ctx.fillRect(-12 * s, -5 * s, 24 * s, 2.4 * s); ctx.fillRect(-12 * s, 7 * s, 24 * s, 2.4 * s);
    ctx.fillStyle = '#2f6aa8'; ctx.fillRect(-6 * s, -1 * s, 12 * s, 6 * s);
    ctx.fillStyle = '#5a3418';
    [[-3.5, -12], [3.5, -12.5]].forEach(function (b) {
      ctx.beginPath(); ctx.ellipse(b[0] * s, b[1] * s, 3.6 * s, 2.6 * s, 0.3, 0, Math.PI * 2); ctx.fill();
    });
  };
  /** 墨西哥皮納塔：彩色紙糊的星星，七個角掛著流蘇 */
  IC.pinata = function (ctx, s) {
    const cols = ['#e84a8a', '#f2c230', '#3ab0e0', '#2f9a4a', '#e8742a', '#9a5ad8', '#e84a3a'];
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + k * Math.PI * 2 / 7;
      ctx.fillStyle = cols[k];
      ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.35) * 6 * s, Math.sin(a - 0.35) * 6 * s);
      ctx.lineTo(Math.cos(a) * 15 * s, Math.sin(a) * 15 * s);
      ctx.lineTo(Math.cos(a + 0.35) * 6 * s, Math.sin(a + 0.35) * 6 * s); ctx.fill();
    }
    ctx.fillStyle = '#f4e8c8';
    ctx.beginPath(); ctx.arc(0, 0, 7 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e84a8a'; ctx.fillRect(-7 * s, -1.2 * s, 14 * s, 2.4 * s);
  };
  /** 古納族莫拉布：一層層剪開的彩色布，中間一隻鳥 */
  IC.mola = function (ctx, s) {
    [['#c8303a', 14], ['#16161c', 11.5], ['#f28a2a', 9], ['#16161c', 6.5]].forEach(function (l) {
      ctx.fillStyle = l[0]; ctx.fillRect(-l[1] * s, -l[1] * 0.8 * s, l[1] * 2 * s, l[1] * 1.6 * s);
    });
    ctx.fillStyle = '#3ab0e0';
    ctx.beginPath(); ctx.ellipse(0, 1 * s, 4 * s, 2.6 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3.6 * s, -1.6 * s, 1.8 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c230';
    ctx.beginPath(); ctx.moveTo(5.2 * s, -2 * s); ctx.lineTo(7.4 * s, -1.2 * s); ctx.lineTo(5.2 * s, -0.6 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4 * s, 0); ctx.lineTo(-7 * s, -3 * s); ctx.lineTo(-6 * s, 2 * s); ctx.fill();
  };
  /** 哥倫比亞祖母綠：切成八角形的綠寶石 */
  IC.emerald = function (ctx, s) {
    ctx.fillStyle = '#1e8a50';
    ctx.beginPath();
    [[-6, -12], [6, -12], [11, -6], [11, 6], [6, 12], [-6, 12], [-11, 6], [-11, -6]].forEach(function (p, i) {
      if (i) ctx.lineTo(p[0] * s, p[1] * s); else ctx.moveTo(p[0] * s, p[1] * s);
    });
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3ad880'; ctx.fillRect(-6 * s, -7 * s, 12 * s, 14 * s);
    ctx.fillStyle = 'rgba(220, 255, 230, 0.75)';
    ctx.beginPath(); ctx.moveTo(-5 * s, -6 * s); ctx.lineTo(-1 * s, -6 * s); ctx.lineTo(-5 * s, -1 * s); ctx.fill();
  };
  /** 世界盃足球：黑白足球，下面一條黃綠色的彩帶 */
  IC.cupball = function (ctx, s) {
    ctx.fillStyle = '#f4f4f4';
    ctx.beginPath(); ctx.arc(0, -2 * s, 11 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16161c';
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + k * Math.PI * 2 / 5;
      if (k) ctx.lineTo(Math.cos(a) * 4 * s, -2 * s + Math.sin(a) * 4 * s); else ctx.moveTo(Math.cos(a) * 4 * s, -2 * s + Math.sin(a) * 4 * s);
    }
    ctx.closePath(); ctx.fill();
    [0, 1, 2, 3, 4].forEach(function (k) {
      const a = -Math.PI / 2 + k * Math.PI * 2 / 5;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 9.5 * s, -2 * s + Math.sin(a) * 9.5 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#2f9a4a'; ctx.fillRect(-12 * s, 9 * s, 24 * s, 3 * s);
    ctx.fillStyle = '#f2c230'; ctx.fillRect(-12 * s, 12 * s, 24 * s, 2.4 * s);
  };

  // ── 聖胡安服裝店的時裝圖示：縮小的主角穿上那一套（shop.js 的 cos_*）──
  ['captain', 'matador', 'viking', 'harlequin', 'royal', 'golden', 'pharaoh'].forEach(function (id) {
    IC['cos_' + id] = function (ctx, s) {
      ctx.save(); ctx.scale(s * 0.8, s * 0.8);
      Sprites.player(ctx, { x: -11, y: -18, w: 22, h: 40, facing: 1, onGround: true, vx: 0, invuln: 0, pid: 0, equipped: {}, costume: id }, 0);
      ctx.restore();
    };
  });

  // ── 亞馬遜大蛇 Boiúna ───────────────────────────────────

  /** 魔王本體：從地底探出頭來的大黑蛇（fade < 1 = 正在鑽進／鑽出地面，畫成地上的漣漪） */
  Sprites.bossKinds.boiuna = function (ctx, b, t) {
    const cx = b.x + b.w / 2, gy = b.y + b.h;
    const fade = b.fade == null ? 1 : b.fade;
    // 地上的洞（一直都在：魔王從這裡進出）
    ctx.fillStyle = 'rgba(60, 40, 20, 0.6)';
    ctx.beginPath(); ctx.ellipse(cx, gy - 2, 40, 7, 0, 0, Math.PI * 2); ctx.fill();
    if (fade <= 0.02) {
      ctx.strokeStyle = 'rgba(120, 90, 50, 0.6)'; ctx.lineWidth = 2;
      for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.ellipse(cx, gy - 2, 20 + ((t * 0.6 + k * 12) % 26), 4 + k, 0, 0, Math.PI * 2); ctx.stroke(); }
      return;
    }
    ctx.save();
    ctx.globalAlpha *= fade;
    // 身體：從洞裡彎上來的一截
    const slump = b.phase === 'recover' ? 18 : 0;
    const sway = b.phase === 'idle' ? Math.sin(t * 0.06) * 6 : 0;
    const neckTop = b.y + 18 + slump;
    ctx.strokeStyle = '#1e2a22'; ctx.lineWidth = 26; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - b.dir * 8, gy); ctx.quadraticCurveTo(cx - b.dir * 30 + sway, (gy + neckTop) / 2, cx + sway, neckTop + 10); ctx.stroke();
    ctx.strokeStyle = '#e8c860'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(cx - b.dir * 2, gy); ctx.quadraticCurveTo(cx - b.dir * 22 + sway, (gy + neckTop) / 2, cx + b.dir * 6 + sway, neckTop + 12); ctx.stroke();
    ctx.lineCap = 'butt';
    // 花紋
    ctx.fillStyle = '#3a5a3a';
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(cx - b.dir * (12 + k * 2) + sway, gy - 12 - k * 13, 4, 0, Math.PI * 2); ctx.fill(); }
    // 頭
    const hx = cx + sway + b.dir * 8, hy = neckTop;
    ctx.fillStyle = '#16201a';
    ctx.beginPath(); ctx.ellipse(hx, hy, 24, 15, b.dir * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx + b.dir * 18, hy + 3, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
    // 會發光的眼睛（傳說裡亮得像船燈）
    const glow = 0.7 + Math.sin(t * 0.15) * 0.3;
    ctx.fillStyle = 'rgba(255, 230, 120, ' + (0.25 * glow).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(hx + b.dir * 8, hy - 5, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe070';
    ctx.beginPath(); ctx.ellipse(hx + b.dir * 8, hy - 5, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16161c'; ctx.fillRect(hx + b.dir * 8 - 1, hy - 8, 2, 6);
    // 蛇信
    if (b.phase !== 'recover' && Math.floor(t / 20) % 3 === 0) {
      ctx.strokeStyle = '#d8262c'; ctx.lineWidth = 2;
      const tx = hx + b.dir * 30;
      ctx.beginPath(); ctx.moveTo(hx + b.dir * 26, hy + 5); ctx.lineTo(tx + b.dir * 8, hy + 5); ctx.lineTo(tx + b.dir * 12, hy + 1);
      ctx.moveTo(tx + b.dir * 8, hy + 5); ctx.lineTo(tx + b.dir * 12, hy + 9); ctx.stroke();
    }
    // 破綻期：頭貼在地上、眼睛轉圈圈
    if (b.phase === 'recover') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        const a = t * 0.12 + k * 2.1;
        ctx.beginPath(); ctx.arc(hx + Math.cos(a) * 18, hy - 22 + Math.sin(a) * 4, 3, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
  };

  /** 大蛇的身體（彈射物）與預告的虛線弧 */
  function drawSerpentShot(ctx, s, t) {
    if (s.arcMark) {
      const a = s.arcMark, G = Levels.GROUND_Y;
      const k = s.warn != null ? s.warn : 0;
      if (k > a.from + 50) return;               // 狂暴的第二段：等第一段快竄完再預告
      // 地上兩個冒泡的洞
      [a.x0, a.x1].forEach(function (x, i) {
        ctx.fillStyle = 'rgba(70, 50, 30, 0.7)';
        ctx.beginPath(); ctx.ellipse(x, G - 2, 26, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(200, 180, 140, 0.8)';
        for (let b = 0; b < 3; b++) {
          const ph = (t * 0.2 + b * 2 + i) % 6;
          ctx.beginPath(); ctx.arc(x - 12 + b * 12, G - 4 - ph * 3, 2.4, 0, Math.PI * 2); ctx.fill();
        }
      });
      // 虛線弧（越接近竄出越紅）
      const hot = U.clamp(1 - (k - a.from) / 46, 0, 1);
      ctx.save();
      ctx.strokeStyle = 'rgba(255, ' + Math.round(200 - hot * 140) + ', 80, ' + (0.45 + hot * 0.45).toFixed(2) + ')';
      ctx.lineWidth = 3; ctx.setLineDash([8, 8]); ctx.lineDashOffset = -t * 0.8;
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const q = i / 24, x = a.x0 + (a.x1 - a.x0) * q, y = G - 4 * a.h * q * (1 - q);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    if (s.warn > 0) return;                       // 還在地底
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(s.ang || 0);
    if ((s.dirX || 1) < 0) ctx.scale(-1, 1);
    if (s.serpent === 'head') {
      ctx.fillStyle = '#16201a';
      ctx.beginPath(); ctx.ellipse(0, 0, 19, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(14, 2, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe070'; ctx.beginPath(); ctx.ellipse(8, -5, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#16161c'; ctx.fillRect(7.5, -7, 1.5, 4);
    } else {
      const r = 12 - (s.seg || 0) * 0.6;
      ctx.fillStyle = '#1e2a22';
      ctx.beginPath(); ctx.ellipse(0, 0, r + 3, r, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8c860';
      ctx.beginPath(); ctx.ellipse(0, r * 0.45, r * 0.9, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a5a3a'; ctx.beginPath(); ctx.arc(0, -r * 0.3, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // 竄出地面的那一下噴土
    if (s.arc && s.arc.t >= 0 && s.arc.t < 8) {
      ctx.fillStyle = 'rgba(160, 120, 70, 0.7)';
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(s.x + s.w / 2 + (k - 1.5) * 10, Levels.GROUND_Y - 6 - s.arc.t * 2, 4, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // ── 巴西足球（v1.31）────────────────────────────────────

  /** 足球：白底黑色五角形（轉動時花紋跟著轉） */
  function football(ctx, cx, cy, r, spin) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin || 0);
    ctx.fillStyle = '#f8f8f4';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e1e22';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; ctx.lineTo(Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38); }
    ctx.closePath(); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, r * 0.22, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  /** 球場：草皮上的白線（中線、中圈、禁區）＋右邊的球門（門柱、橫梁、球網），畫在守門員後面 */
  function drawPitch(ctx, state, camX, t) {
    const S = state.boss && state.boss.soccer;
    if (!S) return;
    const G = Levels.GROUND_Y, gx = S.goalX - camX, bar = S.barY;
    const back = (state.def.bossArena ? state.def.bossArena.x + state.def.bossArena.w : state.def.width) - camX;
    ctx.save();
    // 草皮的條紋
    for (let x = -camX % 80 - 80; x < 1000; x += 80) {
      ctx.fillStyle = Math.floor((x + camX) / 80) % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
      ctx.fillRect(x, G, 80, 10);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(640 - camX - 2, G, 4, 8);                         // 中線
    ctx.fillRect(gx - 180, G, 180, 3);                             // 禁區線
    ctx.fillRect(gx - 182, G, 4, 8);
    // 球網
    ctx.fillStyle = 'rgba(240, 240, 240, 0.25)';
    ctx.fillRect(gx, bar, back - gx, G - bar);
    ctx.strokeStyle = 'rgba(240, 240, 240, 0.55)'; ctx.lineWidth = 1;
    for (let x = gx; x < back; x += 12) { ctx.beginPath(); ctx.moveTo(x, bar); ctx.lineTo(x + 8, G); ctx.stroke(); }
    for (let y = bar; y < G; y += 12) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(back, y); ctx.stroke(); }
    // 門柱、橫梁
    ctx.fillStyle = '#f8f8f4';
    ctx.fillRect(gx - 3, bar - 4, 7, G - bar + 4);
    ctx.fillRect(gx - 3, bar - 4, back - gx + 3, 6);
    ctx.restore();
  }

  function drawBall(ctx, ball, camX, t) {
    const cx = ball.x + ball.w / 2 - camX, cy = ball.y + ball.h / 2;
    const G = Levels.GROUND_Y;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath(); ctx.ellipse(cx, G - 1, ball.w / 2 * (0.6 + 0.4 * Math.min(1, 80 / Math.max(1, G - cy))), 3, 0, 0, Math.PI * 2); ctx.fill();
    if (ball.scored && Math.floor(ball.scored / 6) % 2 === 0) ctx.globalAlpha = 0.6;
    football(ctx, cx, cy, ball.w / 2, ball.spin);
    ctx.globalAlpha = 1;
  }

  /**
   * 巨人守門員：黃綠球衣（巴西隊的顏色）、大手套。
   * 平常彎腰張開雙手守門；預告時把備用球舉過頭；破綻期（丟完球累倒）整個人躺在地上喘氣。
   */
  Sprites.bossKinds.goalkeeper = function (ctx, b, t) {
    const x = b.x, y = b.y, w = b.w, h = b.h, cx = x + w / 2, gy = y + h;
    if (b.phase === 'recover' && !b.defeated) {
      // 躺著：身體橫在地上、頭在右邊，頭上冒汗
      ctx.fillStyle = '#f2c230'; U.roundRect(ctx, x - 20, gy - 24, w + 10, 22, 8); ctx.fill();
      ctx.fillStyle = '#2f9a4a'; ctx.fillRect(x - 20, gy - 10, w + 10, 6);
      ctx.fillStyle = '#2a4aa8'; ctx.fillRect(x - 40, gy - 20, 22, 16);
      ctx.fillStyle = '#c8946a'; ctx.beginPath(); ctx.arc(x + w + 4, gy - 16, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1e1a18'; ctx.fillRect(x + w + 2, gy - 22, 2, 6); ctx.fillRect(x + w + 8, gy - 22, 2, 6);
      ctx.fillStyle = 'rgba(160, 210, 255, 0.9)';
      for (let k = 0; k < 3; k++) { const ph = (t * 0.2 + k * 3) % 10; ctx.beginPath(); ctx.arc(x + w + 10 + k * 6, gy - 34 - ph, 2.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#f4f4f0'; ctx.beginPath(); ctx.arc(x - 30, gy - 30, 11, 0, Math.PI * 2); ctx.fill();   // 大手套
      return;
    }
    const crouch = b.phase === 'idle' ? Math.sin(t * 0.1) * 2 : 0;
    // 腿
    ctx.fillStyle = '#2a4aa8'; ctx.fillRect(cx - 18, gy - 34, 14, 24); ctx.fillRect(cx + 4, gy - 34, 14, 24);
    ctx.fillStyle = '#f4f4f0'; ctx.fillRect(cx - 18, gy - 14, 14, 10); ctx.fillRect(cx + 4, gy - 14, 14, 10);
    ctx.fillStyle = '#1e1e22'; ctx.fillRect(cx - 20, gy - 5, 18, 5); ctx.fillRect(cx + 2, gy - 5, 18, 5);
    // 身體（黃色球衣、綠色領口與號碼 1）
    ctx.fillStyle = '#f2c230'; U.roundRect(ctx, cx - 26, y + 26 + crouch, 52, 40, 8); ctx.fill();
    ctx.fillStyle = '#2f9a4a'; ctx.fillRect(cx - 8, y + 26 + crouch, 16, 5);
    U.text(ctx, '1', cx, y + 48 + crouch, { size: 16, weight: 800, color: '#2f9a4a', stroke: false });
    // 頭
    ctx.fillStyle = '#c8946a'; ctx.beginPath(); ctx.arc(cx, y + 14 + crouch, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1e1a18'; ctx.beginPath(); ctx.arc(cx, y + 8 + crouch, 15, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#16161c'; ctx.fillRect(cx - 9, y + 13 + crouch, 4, 4); ctx.fillRect(cx - 1, y + 13 + crouch, 4, 4);
    // 手臂＋大手套：預告時舉起一顆備用球
    const raise = b.phase === 'telegraph' || b.phase === 'act';
    ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    if (raise) {
      ctx.beginPath(); ctx.moveTo(cx - 20, y + 32); ctx.lineTo(cx - 24, y - 6); ctx.moveTo(cx + 20, y + 32); ctx.lineTo(cx + 22, y - 2); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#f4f4f0';
      ctx.beginPath(); ctx.arc(cx - 24, y - 10, 10, 0, Math.PI * 2); ctx.arc(cx + 22, y - 6, 10, 0, Math.PI * 2); ctx.fill();
      if (b.shotsLeft > 0 || b.phase === 'telegraph') football(ctx, cx - 2, y - 22, 11, t * 0.05);
    } else {
      ctx.beginPath(); ctx.moveTo(cx - 22, y + 34 + crouch); ctx.lineTo(cx - 46, y + 18 + crouch); ctx.moveTo(cx + 22, y + 34 + crouch); ctx.lineTo(cx + 44, y + 22 + crouch); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#f4f4f0';
      ctx.beginPath(); ctx.arc(cx - 48, y + 16 + crouch, 11, 0, Math.PI * 2); ctx.arc(cx + 46, y + 20 + crouch, 11, 0, Math.PI * 2); ctx.fill();
    }
  };

  const baseShot = Sprites.shot;
  Sprites.shot = function (ctx, s, t) {
    if (s.serpent || s.arcMark) { drawSerpentShot(ctx, s, t); return; }
    if (s.football) { football(ctx, s.x + s.w / 2, s.y + s.h / 2, s.w / 2, t * 0.3); return; }
    baseShot(ctx, s, t);
  };

  return { FLAGS: FLAGS, drawPitch: drawPitch, drawBall: drawBall, football: football };
})();
