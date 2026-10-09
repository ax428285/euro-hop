'use strict';

/**
 * 亞特蘭提斯海底城（v1.31.2 玩家：亞特蘭提斯破關後變成海底城市的入口，新地圖自己設計）。
 *
 * 第三張大地圖 'sea'：第一次潛到亞特蘭提斯的神殿之後，歐洲地圖上那個亞特蘭提斯的點就變成入口，
 * 按 Enter 潛下去換到這張地圖；地圖最上面的「光之井」往上游，就回到歐洲的海面上。
 *
 *   四個城區 = 四關（Levels.list 最後面，region 'abyss'）：
 *     A1 珊瑚市集     水下游泳關：發光水母（Features 'jellies'）、暗流、氣泡噴口
 *     A2 水晶宮       氣泡罩著的宮殿（不用游泳）：水晶光束（Features 'beams'）
 *     A3 海馬競技場   騎海馬往前衝的賽道關（race.js 主題 'seahorse'）
 *     A4 海神神殿     最終魔王：巨型章魚克拉肯（人面獅身那一套「從腳底下攻擊」，沙柱換成觸手）
 *   中央廣場站著人魚 Thalassa（quests.js 的劇情人物），會講城裡的事、提示打法。
 *   地圖上沒有海上怪物（玩家：不用遭遇戰，專心闖關）。
 *
 * 地圖不是真實地理：世界座標直接手畫（project(x, y) = [x, y]），城區是幾塊「不規則的圓」。
 * 載入順序：sprites.js 之後（要掛進 Sprites）、worldmap.js 之前（WorldMap 建地圖時要讀 AbyssWorld）。
 */

// ── 地圖（世界座標）──────────────────────────────────────

/** 不規則的圓：城區、廢墟的輪廓（固定種子，每次都一樣） */
function abyssBlob(cx, cy, rx, ry, seed) {
  const pts = [];
  for (let i = 0; i < 30; i++) {
    const a = i / 30 * Math.PI * 2;
    const r = 1 + 0.07 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 5 + seed * 2.3) + 0.03 * Math.sin(a * 9 + seed);
    pts.push([Math.round((cx + Math.cos(a) * rx * r) * 10) / 10, Math.round((cy + Math.sin(a) * ry * r) * 10) / 10]);
  }
  return pts;
}

const AbyssWorld = {
  w: 1196, h: 1239,
  /** 世界座標本來就是手畫的：直接回傳 */
  project: function (x, y) { return [x, y]; },
  VIEW_BOTTOM: 760               // 實際用到的高度（WorldMap 的 worldH）
};
const AbyssGeo = {};
/** 城區（關卡國，id 跟 Levels.list 一樣）和背景的廢墟、中央廣場 */
const AbyssBackdrop = {
  A1: { name: '珊瑚市集', shapes: [abyssBlob(250, 236, 170, 108, 1)], center: [250, 250] },
  A2: { name: '水晶宮', shapes: [abyssBlob(948, 232, 165, 112, 2)], center: [948, 246] },
  A3: { name: '海馬競技場', shapes: [abyssBlob(262, 566, 176, 104, 3)], center: [262, 578] },
  A4: { name: '海神神殿', shapes: [abyssBlob(930, 566, 178, 116, 4)], center: [930, 580] },
  PLAZA: { name: '中央廣場', shapes: [abyssBlob(598, 408, 116, 74, 5)] },
  RUIN1: { name: '倒塌的城牆', shapes: [abyssBlob(600, 650, 70, 34, 6)] },
  RUIN2: { name: '倒塌的城牆', shapes: [abyssBlob(60, 400, 44, 70, 7)] },
  RUIN3: { name: '倒塌的城牆', shapes: [abyssBlob(1140, 404, 44, 74, 8)] }
};

const Abyss = (function () {

  // ── 地圖上的地點、名稱、配色 ──────────────────────────

  /** 地圖上的地點（WorldMap.buildSeaSpecials 用）：出口、人魚 */
  const SPOTS = [
    { id: 'S_surface', name: '光之井・回海面', x: 598, y: 70, surface: true, prompt: '按 Enter 往上游，回到海面（歐洲）' },
    { id: 'Q_mermaid', name: '人魚 Thalassa', x: 598, y: 400, npc: 'mermaid', prompt: '按 Enter 跟人魚說話' },
    // v1.31.2 玩家：海底城新增商店賣人魚時裝 → 中央廣場的服裝店（shop.js 的 shellHouse）
    { id: 'M_shellHouse', name: '珊瑚貝殼屋', x: 660, y: 444, seller: 'shellHouse', prompt: '按 Enter 逛珊瑚貝殼屋（海底的服裝店）' }
  ];
  const REGIONS = [
    { name: '亞　特　蘭　提　斯', lon: 598, lat: 520, size: 26 },
    { name: '中央廣場', lon: 598, lat: 470, size: 11 }
  ];
  const SEAS = [
    { name: '光　之　井', lon: 598, lat: 150, size: 13 },
    { name: '深　淵', lon: 598, lat: 735, size: 14 }
  ];
  /** 海底城的配色（不管玩家選哪一套大地圖配色，這裡一律用自己的） */
  const PALETTE = {
    sea: '#0f4064', seaDeep: '#04182c', wave: 'rgba(140, 230, 255, 0.07)',
    open: '#2c7a84', done: '#3a9a7a', locked: '#2a4458', eastLocked: '#2a4458', eastOpen: '#3a6a8a',
    lockedEdge: 'rgba(140, 220, 255, 0.4)', doneEdge: 'rgba(255, 220, 120, 0.85)',
    edge: 'rgba(150, 240, 255, 0.75)', euFill: '#1f4a5e', euEdge: 'rgba(150, 230, 255, 0.4)',
    bgFill: '#1f4a5e', bgEdge: 'rgba(150, 230, 255, 0.4)', seaName: 'rgba(170, 230, 255, 0.45)',
    label: '#eafcff', labelSel: '#ffd166', labelLocked: '#8ab0c0', labelStroke: 'rgba(4, 20, 36, 0.85)',
    spLabel: '#eafcff', region: 'rgba(170, 230, 255, 0.16)'
  };

  /** 地圖底下的氣氛：從上面照下來的光、遠處的廢墟剪影、往上飄的泡泡、游來游去的小魚 */
  function drawMapBack(ctx, t, W, H) {
    ctx.save();
    // 光束
    for (let k = 0; k < 7; k++) {
      const x = 120 + k * 160 + Math.sin(t * 0.004 + k) * 30;
      const g = ctx.createLinearGradient(0, 0, 0, 560);
      g.addColorStop(0, 'rgba(200, 245, 255, 0.10)'); g.addColorStop(1, 'rgba(200, 245, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - 30, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 110, 560); ctx.lineTo(x - 10, 560); ctx.closePath(); ctx.fill();
    }
    // 光之井：正上方一圈亮光
    const gw = ctx.createRadialGradient(598, 20, 10, 598, 20, 170);
    gw.addColorStop(0, 'rgba(230, 250, 255, 0.45)'); gw.addColorStop(1, 'rgba(230, 250, 255, 0)');
    ctx.fillStyle = gw; ctx.fillRect(420, 0, 360, 200);
    // 遠處的廢墟剪影（柱子、拱門）
    ctx.fillStyle = 'rgba(8, 40, 64, 0.55)';
    [[90, 720, 40], [180, 740, 64], [420, 730, 52], [780, 735, 58], [1010, 726, 46], [1110, 742, 70]].forEach(function (c) {
      ctx.fillRect(c[0] - 6, c[1] - c[2], 12, c[2]);
      ctx.fillRect(c[0] - 12, c[1] - c[2] - 6, 24, 6);
    });
    ctx.beginPath(); ctx.ellipse(598, 760, 260, 50, 0, Math.PI, 0); ctx.fill();
    // 泡泡
    ctx.strokeStyle = 'rgba(210, 245, 255, 0.35)'; ctx.lineWidth = 1;
    for (let k = 0; k < 30; k++) {
      const x = (k * 197) % 1196 + Math.sin(t * 0.03 + k) * 6;
      const y = 760 - ((t * (0.4 + (k % 5) * 0.12) + k * 89) % 780);
      ctx.beginPath(); ctx.arc(x, y, 1.5 + (k % 4), 0, Math.PI * 2); ctx.stroke();
    }
    // 小魚群
    for (let g2 = 0; g2 < 3; g2++) {
      const fx = ((t * 0.5 + g2 * 400) % 1400) - 100, fy = 140 + g2 * 210 + Math.sin(t * 0.02 + g2) * 20;
      ctx.fillStyle = ['rgba(255, 200, 90, 0.7)', 'rgba(120, 220, 255, 0.7)', 'rgba(255, 140, 170, 0.7)'][g2];
      for (let k = 0; k < 6; k++) {
        const x = fx - (k % 3) * 14, y = fy + Math.floor(k / 3) * 10 + (k % 2) * 4;
        ctx.beginPath(); ctx.ellipse(x, y, 5, 2.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x - 8, y - 3); ctx.lineTo(x - 8, y + 3); ctx.fill();
      }
    }
    ctx.restore();
  }

  /** 城區上面的建築小圖（畫在國土上、國名底下）：讓四個城區一眼分得出來 */
  function drawMapDistricts(ctx, t) {
    ctx.save();
    // 珊瑚市集：一叢叢珊瑚＋攤子的布篷
    [[150, 262], [352, 250], [300, 306]].forEach(function (p, k) {
      ctx.fillStyle = ['#e86a8a', '#f29a5a', '#c87ae8'][k];
      for (let j = -2; j <= 2; j++) { ctx.beginPath(); ctx.ellipse(p[0] + j * 5, p[1] - Math.abs(j) * -2 - 8, 3, 9 - Math.abs(j) * 2, j * 0.3, 0, Math.PI * 2); ctx.fill(); }
    });
    // 水晶宮：一個透明的大氣泡罩著尖尖的水晶塔
    ctx.fillStyle = 'rgba(160, 240, 255, 0.55)';
    [[920, 230, 28], [948, 222, 40], [978, 232, 26]].forEach(function (c) {
      ctx.beginPath(); ctx.moveTo(c[0] - 7, c[1]); ctx.lineTo(c[0], c[1] - c[2]); ctx.lineTo(c[0] + 7, c[1]); ctx.closePath(); ctx.fill();
    });
    ctx.strokeStyle = 'rgba(220, 250, 255, 0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(948, 236, 54, Math.PI, 0); ctx.stroke();
    // 海馬競技場：橢圓形的跑道
    ctx.strokeStyle = 'rgba(240, 220, 160, 0.7)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(262, 566, 70, 26, 0, 0, Math.PI * 2); ctx.stroke();
    // 海神神殿：三角山牆＋一排柱子
    ctx.fillStyle = 'rgba(236, 228, 206, 0.8)';
    ctx.beginPath(); ctx.moveTo(886, 540); ctx.lineTo(930, 516); ctx.lineTo(974, 540); ctx.closePath(); ctx.fill();
    for (let k = 0; k < 5; k++) ctx.fillRect(890 + k * 19, 542, 6, 26);
    ctx.fillRect(884, 568, 92, 5);
    ctx.restore();
  }

  /** 光之井（出口）：一道往上的光柱＋往上的箭頭 */
  function drawSurface(ctx, x, y, t, near) {
    ctx.save();
    const g = ctx.createLinearGradient(0, y - 60, 0, y + 20);
    g.addColorStop(0, 'rgba(240, 252, 255, 0.0)'); g.addColorStop(0.5, 'rgba(240, 252, 255, 0.35)'); g.addColorStop(1, 'rgba(240, 252, 255, 0.05)');
    ctx.fillStyle = g; ctx.fillRect(x - 22, y - 60, 44, 80);
    if (near) {
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y - 6, 18 + Math.sin(t * 0.1) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    const bob = Math.sin(t * 0.08) * 3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(x, y - 20 + bob); ctx.lineTo(x + 9, y - 8 + bob); ctx.lineTo(x + 3, y - 8 + bob); ctx.lineTo(x + 3, y + 2 + bob);
    ctx.lineTo(x - 3, y + 2 + bob); ctx.lineTo(x - 3, y - 8 + bob); ctx.lineTo(x - 9, y - 8 + bob); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /** 地圖上的你（在水裡）：坐在潛水鐘裡（銅色的鐘、圓窗、上面一串泡泡） */
  function drawBell(ctx, x, y, t, facing) {
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 0.06) * 1.5);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath(); ctx.ellipse(0, 6, 11, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8873a';
    ctx.beginPath(); ctx.moveTo(-10, 4); ctx.quadraticCurveTo(-11, -14, 0, -16); ctx.quadraticCurveTo(11, -14, 10, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a5a24'; ctx.fillRect(-11, 2, 22, 3); ctx.fillRect(-2, -19, 4, 4);
    ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.arc(facing * 2, -6, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6a4a30'; ctx.beginPath(); ctx.arc(facing * 2, -6, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(220, 245, 255, 0.7)'; ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) { const ph = (t * 0.5 + k * 9) % 26; ctx.beginPath(); ctx.arc(Math.sin(k + t * 0.05) * 3, -20 - ph, 1.5 + k * 0.6, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }

  // ── 旗子（城區的旗：底色＋一條橫紋＋金色三叉戟）──────────

  Sprites.flagDirs.atlantis = function (ctx, x, y, w, h, c) {
    ctx.fillStyle = c[0]; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = c[1]; ctx.fillRect(x, y + h * 0.72, w, h * 0.16);
    ctx.strokeStyle = c[2]; ctx.fillStyle = c[2]; ctx.lineWidth = Math.max(1, h * 0.08);
    const cx = x + w / 2;
    ctx.beginPath(); ctx.moveTo(cx, y + h * 0.15); ctx.lineTo(cx, y + h * 0.66);
    ctx.moveTo(cx - w * 0.16, y + h * 0.2); ctx.lineTo(cx - w * 0.16, y + h * 0.36); ctx.quadraticCurveTo(cx - w * 0.16, y + h * 0.46, cx, y + h * 0.46);
    ctx.quadraticCurveTo(cx + w * 0.16, y + h * 0.46, cx + w * 0.16, y + h * 0.36); ctx.lineTo(cx + w * 0.16, y + h * 0.2);
    ctx.stroke();
  };

  // ── 地標（遠方的大建築，半透明）────────────────────────

  const LM = Sprites.landmarks;
  /** 珊瑚市集：巨大的扇形珊瑚＋珊瑚礁上蓋的圓頂小屋 */
  LM.coralBazaar = function (ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(232, 106, 138, 0.45)';
    for (let k = -4; k <= 4; k++) {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(k * 0.3) * 200 * s, -Math.cos(k * 0.3) * 200 * s); ctx.lineTo(Math.sin(k * 0.3 + 0.12) * 190 * s, -Math.cos(k * 0.3 + 0.12) * 190 * s); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(240, 210, 170, 0.5)';
    [[-170, 70], [-90, 90], [120, 80], [190, 60]].forEach(function (d) {
      ctx.fillRect((d[0] - 30) * s, -d[1] * s, 60 * s, d[1] * s);
      ctx.beginPath(); ctx.arc(d[0] * s, -d[1] * s, 30 * s, Math.PI, 0); ctx.fill();
    });
    ctx.restore();
  };
  /** 水晶宮：氣泡罩子底下一叢尖尖的水晶塔 */
  LM.crystalPalace = function (ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(160, 235, 255, 0.4)';
    [[-110, 150], [-50, 210], [0, 260], [55, 200], [115, 140]].forEach(function (c) {
      ctx.beginPath(); ctx.moveTo((c[0] - 24) * s, 0); ctx.lineTo(c[0] * s, -c[1] * s); ctx.lineTo((c[0] + 24) * s, 0); ctx.closePath(); ctx.fill();
    });
    ctx.strokeStyle = 'rgba(220, 250, 255, 0.45)'; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.arc(0, 0, 230 * s, Math.PI, 0); ctx.stroke();
    ctx.restore();
  };
  /** 海馬競技場：圓形競技場的拱門一層一層 */
  LM.hippodrome = function (ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(220, 210, 180, 0.4)';
    ctx.fillRect(-240 * s, -120 * s, 480 * s, 120 * s);
    ctx.fillStyle = 'rgba(20, 70, 100, 0.5)';
    for (let r = 0; r < 2; r++) for (let k = 0; k < 9; k++) {
      const ax = (-210 + k * 52) * s, ay = (-100 + r * 55) * s;
      ctx.fillRect(ax, ay, 30 * s, 34 * s);
      ctx.beginPath(); ctx.arc(ax + 15 * s, ay, 15 * s, Math.PI, 0); ctx.fill();
    }
    ctx.restore();
  };
  /** 海神神殿：大理石的神殿，山牆上一支三叉戟 */
  LM.poseidonTemple = function (ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(236, 228, 206, 0.5)';
    ctx.beginPath(); ctx.moveTo(-200 * s, -170 * s); ctx.lineTo(0, -240 * s); ctx.lineTo(200 * s, -170 * s); ctx.closePath(); ctx.fill();
    ctx.fillRect(-200 * s, -170 * s, 400 * s, 16 * s);
    for (let k = 0; k < 8; k++) ctx.fillRect((-188 + k * 52) * s, -154 * s, 22 * s, 140 * s);
    ctx.fillRect(-214 * s, -16 * s, 428 * s, 16 * s);
    ctx.strokeStyle = 'rgba(232, 192, 80, 0.6)'; ctx.lineWidth = 5 * s;
    ctx.beginPath(); ctx.moveTo(0, -180 * s); ctx.lineTo(0, -228 * s); ctx.moveTo(-16 * s, -224 * s); ctx.lineTo(-16 * s, -208 * s); ctx.lineTo(16 * s, -208 * s); ctx.lineTo(16 * s, -224 * s); ctx.stroke();
    ctx.restore();
  };

  // ── 遠景 ────────────────────────────────────────────────

  function tiled(ctx, camX, p, tileW, W, fn) {
    const off = -((camX * p) % tileW + tileW) % tileW;
    for (let x = off - tileW; x < W + tileW; x += tileW) fn(x);
  }
  /** 海底的光束（每個遠景都有） */
  function rays(ctx, camX, W, gy, a) {
    ctx.fillStyle = 'rgba(200, 245, 255, ' + (a || 0.07) + ')';
    tiled(ctx, camX, 0.05, 260, W, function (x0) {
      ctx.beginPath(); ctx.moveTo(x0 + 40, 0); ctx.lineTo(x0 + 90, 0); ctx.lineTo(x0 + 190, gy); ctx.lineTo(x0 + 120, gy); ctx.closePath(); ctx.fill();
    });
  }
  const SKY = Sprites.skylines;
  // 珊瑚市集：一排一排的珊瑚礁＋市集的帳篷
  SKY.A1 = function (ctx, camX, gy, W, def, t) {
    rays(ctx, camX, W, gy);
    tiled(ctx, camX, 0.15, 360, W, function (x0) {
      ctx.fillStyle = 'rgba(200, 90, 130, 0.35)';
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(x0 + 40 + k * 70, gy - 30, 30, 50 + (k % 3) * 18, 0, Math.PI, 0); ctx.fill(); }
      ctx.fillStyle = 'rgba(240, 180, 90, 0.35)';
      ctx.beginPath(); ctx.moveTo(x0 + 180, gy - 60); ctx.lineTo(x0 + 220, gy - 96); ctx.lineTo(x0 + 260, gy - 60); ctx.closePath(); ctx.fill();
    });
  };
  // 水晶宮：氣泡罩的弧線＋外面暗暗的海＋一叢叢水晶
  SKY.A2 = function (ctx, camX, gy, W, def, t) {
    ctx.strokeStyle = 'rgba(220, 250, 255, 0.25)'; ctx.lineWidth = 3;
    tiled(ctx, camX, 0.04, 900, W, function (x0) { ctx.beginPath(); ctx.arc(x0 + 450, gy + 200, 620, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); });
    tiled(ctx, camX, 0.18, 300, W, function (x0) {
      ctx.fillStyle = 'rgba(150, 230, 255, 0.35)';
      [[40, 80], [80, 130], [120, 70], [200, 110]].forEach(function (c) {
        ctx.beginPath(); ctx.moveTo(x0 + c[0] - 14, gy); ctx.lineTo(x0 + c[0], gy - c[1]); ctx.lineTo(x0 + c[0] + 14, gy); ctx.closePath(); ctx.fill();
      });
    });
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.15 + Math.sin(t * 0.05) * 0.05).toFixed(3) + ')';
    for (let k = 0; k < 10; k++) ctx.fillRect(((k * 131 - camX * 0.18) % W + W) % W, gy - 40 - (k * 37) % 120, 3, 3);
  };
  // 海神神殿：一排排大理石柱，遠處是黑漆漆的深淵
  SKY.A4 = function (ctx, camX, gy, W, def, t) {
    rays(ctx, camX, W, gy, 0.05);
    tiled(ctx, camX, 0.2, 140, W, function (x0) {
      ctx.fillStyle = 'rgba(200, 196, 180, 0.3)';
      ctx.fillRect(x0 + 50, gy - 170, 26, 170);
      ctx.fillRect(x0 + 42, gy - 178, 42, 10);
    });
  };
  SKY.A3 = SKY.A1;    // 賽道關用不到，留著給測試

  // ── 城區的敵人（行為跟原本一樣，只換長相）────────────────

  const CE = Sprites.countryEnemies;
  function squashed(ctx, e, cx, by) {
    if (e.squash > 0) { ctx.translate(cx, by); ctx.scale(1.3, 0.35); ctx.translate(-cx, -by); }
  }
  /** 小魚（各區換顏色） */
  function fish(ctx, e, t, body, fin, stripe) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    ctx.save();
    if (e.squash > 0) { ctx.translate(cx, cy); ctx.scale(1.3, 0.4); ctx.translate(-cx, -cy); }
    ctx.translate(cx, cy); ctx.scale(e.dir || 1, 1);
    const wag = Math.sin(t * 0.3) * 4;
    ctx.fillStyle = fin;
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-22, -8 + wag); ctx.lineTo(-22, 8 + wag); ctx.closePath(); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, 15, 9, 0, 0, Math.PI * 2); ctx.fill();
    if (stripe) { ctx.fillStyle = stripe; ctx.fillRect(-4, -8, 4, 16); ctx.fillRect(5, -7, 3, 14); }
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(8, -2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16161c'; ctx.beginPath(); ctx.arc(9, -2, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  CE.A1 = {
    // 珊瑚市集：寄居蟹（背著螺殼走）＋小丑魚
    walker: function (ctx, e, t) {
      const cx = e.x + e.w / 2, by = e.y + e.h;
      ctx.save(); squashed(ctx, e, cx, by);
      const s = Math.sin(t * 0.4) * 2;
      ctx.strokeStyle = '#d8502a'; ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.moveTo(cx + e.dir * 4, by - 6); ctx.lineTo(cx + e.dir * (12 + k * 3), by - 1 + (k % 2 ? s : -s)); ctx.stroke();
      }
      ctx.fillStyle = '#e8c890';
      ctx.beginPath(); ctx.arc(cx - e.dir * 3, by - 14, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#b8945a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx - e.dir * 3, by - 14, 7, 0, Math.PI * 1.6); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx - e.dir * 3, by - 14, 3, 0, Math.PI * 1.6); ctx.stroke();
      ctx.fillStyle = '#d8502a'; ctx.beginPath(); ctx.arc(cx + e.dir * 10, by - 10, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#16161c'; ctx.fillRect(cx + e.dir * 12 - 1, by - 18, 2, 5);
      ctx.restore();
    },
    flyer: function (ctx, e, t) { fish(ctx, e, t, '#f28a2a', '#f4f0e6', '#f4f4f0'); }
  };
  CE.A2 = {
    // 水晶宮：水晶守衛（藍白色的晶體小人）＋發光的燈籠魚
    walker: function (ctx, e, t) {
      const cx = e.x + e.w / 2, by = e.y + e.h;
      ctx.save(); squashed(ctx, e, cx, by);
      const step = Math.sin(t * 0.35) * 2;
      ctx.fillStyle = '#7ab8d8'; ctx.fillRect(cx - 8 + step, by - 8, 5, 8); ctx.fillRect(cx + 3 - step, by - 8, 5, 8);
      ctx.fillStyle = 'rgba(170, 235, 255, 0.95)';
      ctx.beginPath(); ctx.moveTo(cx - 11, by - 8); ctx.lineTo(cx - 8, by - 30); ctx.lineTo(cx, by - 38); ctx.lineTo(cx + 8, by - 30); ctx.lineTo(cx + 11, by - 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath(); ctx.moveTo(cx - 5, by - 12); ctx.lineTo(cx - 3, by - 30); ctx.lineTo(cx, by - 12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#16405a'; ctx.fillRect(cx + e.dir * 3 - 1, by - 26, 3, 3);
      ctx.restore();
    },
    flyer: function (ctx, e, t) {
      fish(ctx, e, t, '#3a4a6a', '#2a3a5a', null);
      const cx = e.x + e.w / 2 + (e.dir || 1) * 14, cy = e.y + e.h / 2 - 12;
      ctx.strokeStyle = '#5a6a8a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(e.x + e.w / 2 + (e.dir || 1) * 6, e.y + e.h / 2 - 6); ctx.quadraticCurveTo(cx, cy - 6, cx, cy); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 240, 150, ' + (0.7 + Math.sin(t * 0.2) * 0.3).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  };
  // 兩區共用的海底怪：海膽（尖刺型，踩不得）、小鯊魚（會追人）、劍魚（衝撞型）、拿三叉戟的水晶衛兵
  function urchin(ctx, e, t) {
    const cx = e.x + e.w / 2, by = e.y + e.h, r = Math.min(e.w, e.h) * 0.38;
    ctx.save(); squashed(ctx, e, cx, by);
    ctx.strokeStyle = '#2a1a3a'; ctx.lineWidth = 2;
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8 + Math.sin(t * 0.05) * 0.05;
      ctx.beginPath(); ctx.moveTo(cx, by - r); ctx.lineTo(cx + Math.cos(a) * r * 1.9, by - r + Math.sin(a) * r * 1.9); ctx.stroke();
    }
    ctx.fillStyle = '#4a2a5a'; ctx.beginPath(); ctx.arc(cx, by - r, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd166'; ctx.fillRect(cx - 4, by - r - 3, 2, 2); ctx.fillRect(cx + 2, by - r - 3, 2, 2);
    ctx.restore();
  }
  function shark(ctx, e, t) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    ctx.save();
    if (e.squash > 0) { ctx.translate(cx, cy); ctx.scale(1.3, 0.4); ctx.translate(-cx, -cy); }
    ctx.translate(cx, cy); ctx.scale(e.dir || 1, 1);
    const wag = Math.sin(t * 0.25) * 4;
    ctx.fillStyle = '#6a7a8a';
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-26, -9 + wag); ctx.lineTo(-24, 0); ctx.lineTo(-26, 9 + wag); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4, -7); ctx.lineTo(2, -17); ctx.lineTo(6, -7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8ecf0'; ctx.beginPath(); ctx.ellipse(2, 3, 13, 4, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#16161c'; ctx.beginPath(); ctx.arc(11, -2, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f4f0e6'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(8, 3); ctx.lineTo(10, 5); ctx.lineTo(12, 3); ctx.lineTo(14, 5); ctx.lineTo(16, 3); ctx.stroke();
    ctx.restore();
  }
  function swordfish(ctx, e, t) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    ctx.save(); squashed(ctx, e, cx, by);
    ctx.translate(cx, by - e.h * 0.5); ctx.scale(e.dir || 1, 1);
    const wag = Math.sin(t * 0.3) * 4;
    ctx.fillStyle = '#2a5a8a';
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-30, -10 + wag); ctx.lineTo(-27, 0); ctx.lineTo(-30, 10 + wag); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-8, -9); ctx.lineTo(0, -22); ctx.lineTo(8, -9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c8d8e8'; ctx.beginPath(); ctx.ellipse(2, 4, 16, 4, 0, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = '#3a4a5a'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(20, -1); ctx.lineTo(40, -2); ctx.stroke();                 // 長長的劍
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(12, -3, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16161c'; ctx.beginPath(); ctx.arc(13, -3, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function crystalGuard(ctx, e, t) {
    CE.A2.walker(ctx, e, t);
    const cx = e.x + e.w / 2, by = e.y + e.h;
    ctx.strokeStyle = '#e8c050'; ctx.lineWidth = 2.2;
    const tx = cx + e.dir * 13;
    ctx.beginPath(); ctx.moveTo(tx, by - 2); ctx.lineTo(tx, by - 46);
    ctx.moveTo(tx - 5, by - 50); ctx.lineTo(tx - 5, by - 42); ctx.lineTo(tx + 5, by - 42); ctx.lineTo(tx + 5, by - 50); ctx.stroke();
  }
  CE.A1.spiker = urchin; CE.A1.chaser = shark;
  CE.A2.spiker = urchin; CE.A2.chaser = shark; CE.A2.charger = swordfish; CE.A2.guard = crystalGuard;
  CE.A4 = CE.A2;

  // ── 紀念品圖示（souvenirs.js）───────────────────────────

  const IC = Sprites.icons;
  /** 珊瑚項鍊：一圈紅珊瑚珠子＋中間一顆珍珠 */
  IC.coralNecklace = function (ctx, s) {
    for (let k = 0; k < 11; k++) {
      const a = Math.PI * 0.1 + k * Math.PI * 0.08;
      ctx.fillStyle = k % 2 ? '#e8506a' : '#f27a8a';
      ctx.beginPath(); ctx.arc(Math.cos(a) * 12 * s, -6 * s + Math.sin(a) * 12 * s, 2.6 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#f4f0f8'; ctx.beginPath(); ctx.arc(0, 8 * s, 4.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.beginPath(); ctx.arc(-1.5 * s, 6.5 * s, 1.4 * s, 0, Math.PI * 2); ctx.fill();
  };
  /** 水晶稜鏡：三角形的水晶，一道白光進去變成彩虹出來 */
  IC.prism = function (ctx, s) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.moveTo(-15 * s, 4 * s); ctx.lineTo(-4 * s, 0); ctx.stroke();
    ['#e84a4a', '#f2c230', '#3ab04a', '#3a7ae8', '#8a4ae8'].forEach(function (c, k) {
      ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(4 * s, 0); ctx.lineTo(15 * s, (-4 + k * 2.4) * s); ctx.stroke();
    });
    ctx.fillStyle = 'rgba(170, 235, 255, 0.85)';
    ctx.beginPath(); ctx.moveTo(0, -12 * s); ctx.lineTo(10 * s, 8 * s); ctx.lineTo(-10 * s, 8 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath(); ctx.moveTo(0, -8 * s); ctx.lineTo(3 * s, 4 * s); ctx.lineTo(-4 * s, 4 * s); ctx.closePath(); ctx.fill();
  };
  /** 海馬的小鞍：金黃色的海馬＋背上紅色的鞍 */
  IC.seahorseSaddle = function (ctx, s) {
    ctx.fillStyle = '#e8b040';
    ctx.beginPath(); ctx.ellipse(0, -2 * s, 6 * s, 10 * s, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(3 * s, -12 * s, 5 * s, 3.5 * s, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(6 * s, -12 * s, 6 * s, 2.4 * s);
    ctx.strokeStyle = '#e8b040'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 8 * s); ctx.quadraticCurveTo(-2 * s, 15 * s, -7 * s, 13 * s); ctx.quadraticCurveTo(-9 * s, 10 * s, -5 * s, 9 * s); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#c8303a'; ctx.fillRect(-7 * s, -6 * s, 6 * s, 8 * s);
    ctx.fillStyle = '#16161c'; ctx.fillRect(4 * s, -13.5 * s, 1.6 * s, 1.6 * s);
  };
  /** 海神的三叉戟（縮小的模型） */
  IC.tridentModel = function (ctx, s) {
    ctx.strokeStyle = '#e8c050'; ctx.lineWidth = 2.6 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 15 * s); ctx.lineTo(0, -10 * s);
    ctx.moveTo(-8 * s, -14 * s); ctx.lineTo(-8 * s, -4 * s); ctx.quadraticCurveTo(-8 * s, 1 * s, 0, 1 * s); ctx.quadraticCurveTo(8 * s, 1 * s, 8 * s, -4 * s); ctx.lineTo(8 * s, -14 * s);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#e8c050';
    [-8, 0, 8].forEach(function (dx) { ctx.beginPath(); ctx.moveTo((dx - 3) * s, (dx ? -13 : -9) * s); ctx.lineTo(dx * s, (dx ? -19 : -16) * s); ctx.lineTo((dx + 3) * s, (dx ? -13 : -9) * s); ctx.fill(); });
    ctx.fillStyle = '#3a8ab8'; ctx.beginPath(); ctx.arc(0, 6 * s, 2.4 * s, 0, Math.PI * 2); ctx.fill();
  };

  // ── 最終魔王：巨型章魚克拉肯 ────────────────────────────

  /*
   * 打法沿用人面獅身（pattern 'sphinx'）：坐定之後一根一根觸手從你腳下的地底竄出來（先冒墨汁漩渦預告），
   * 全部打完累倒在地上 = 破綻，跳上去踩頭。這裡只管畫：本體＋八隻腳、地底竄出的觸手（Sprites.shot 的 pillar）。
   */
  Sprites.bossKinds.kraken = function (ctx, b, t) {
    const cx = b.x + b.w / 2, gy = b.y + b.h;
    const tired = b.phase === 'recover', tele = b.phase === 'telegraph';
    const sway = tired ? 0 : Math.sin(t * 0.05) * 4;
    ctx.save();
    if (b.hurtFlash > 0 && Math.floor(b.hurtFlash / 3) % 2 === 0) ctx.globalAlpha = 0.6;
    // 八隻腳（攤在地上，捲來捲去）
    ctx.lineCap = 'round';
    for (let k = 0; k < 8; k++) {
      const side = k < 4 ? -1 : 1, j = k % 4;
      const ex = cx + side * (36 + j * 22), wv = Math.sin(t * 0.07 + k) * 8;
      ctx.strokeStyle = '#6a2a7a'; ctx.lineWidth = 14 - j * 2;
      ctx.beginPath(); ctx.moveTo(cx + side * 16, gy - 22);
      ctx.quadraticCurveTo(cx + side * (26 + j * 14), gy - 4 + wv, ex, gy - 6);
      ctx.quadraticCurveTo(ex + side * 14, gy - 10 - wv, ex + side * 8, gy - 22 - j * 3);
      ctx.stroke();
      ctx.fillStyle = '#e8b0d8';
      for (let q = 0; q < 3; q++) { ctx.beginPath(); ctx.arc(cx + side * (30 + j * 14 + q * 9), gy - 3 + (q % 2), 2, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.lineCap = 'butt';
    // 頭（累倒時整顆垂到地上，像攤開的麻糬）
    const hy = tired ? gy - 34 : gy - 70 + sway;
    const hw = tired ? 66 : 52, hh = tired ? 34 : 56;
    ctx.fillStyle = tele ? '#9a3aa8' : '#7a3088';
    ctx.beginPath(); ctx.ellipse(cx, hy, hw, hh, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath(); ctx.ellipse(cx - hw * 0.3, hy - hh * 0.45, hw * 0.35, hh * 0.2, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(230, 160, 220, 0.45)';
    [[-0.4, -0.1], [0.35, -0.25], [0.1, 0.25], [-0.15, -0.5]].forEach(function (d) { ctx.beginPath(); ctx.arc(cx + d[0] * hw, hy + d[1] * hh, 5, 0, Math.PI * 2); ctx.fill(); });
    // 眼睛：平常瞪著你、出招前發紅光、累倒時變成兩條線
    const ey = hy + hh * 0.2;
    if (tired) {
      ctx.strokeStyle = '#16161c'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 26, ey); ctx.lineTo(cx - 12, ey + 3); ctx.moveTo(cx + 12, ey + 3); ctx.lineTo(cx + 26, ey); ctx.stroke();
      ctx.fillStyle = '#ffd166';
      for (let k = 0; k < 3; k++) { const a = t * 0.1 + k * 2.1; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 30, hy - hh - 6 + Math.sin(a) * 6, 3, 0, Math.PI * 2); ctx.fill(); }
    } else {
      [-1, 1].forEach(function (sd) {
        ctx.fillStyle = '#f4e8a0'; ctx.beginPath(); ctx.ellipse(cx + sd * 20, ey, 11, 13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = tele ? '#e8262c' : '#16161c'; ctx.fillRect(cx + sd * 20 - 2 + b.dir * 3, ey - 9, 4, 18);
      });
    }
    if (tele) {
      ctx.fillStyle = 'rgba(200, 60, 200, ' + (0.15 + Math.sin(t * 0.4) * 0.1).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(cx, hy, hw + 20, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  /** 從地底竄出來的觸手（克拉肯版的沙柱）：先冒墨汁漩渦，再一根長滿吸盤的腳衝上來 */
  function tentacle(ctx, s, t) {
    const cx = s.x + s.w / 2, gy = s.y + s.h;
    if (s.warn > 0) {
      const k = 1 - s.warn / 48;
      ctx.save(); ctx.translate(cx, gy - 2);
      ctx.fillStyle = 'rgba(40, 10, 50, ' + (0.3 + k * 0.4).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(0, 0, 14 + k * 12, 4 + k * 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(220, 150, 240, ' + (0.4 + k * 0.5).toFixed(3) + ')'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) { const a0 = t * 0.25 + i * 2.1; ctx.beginPath(); ctx.ellipse(0, 0, 6 + i * 6 + k * 6, 2 + i * 1.6, 0, a0, a0 + 2.2); ctx.stroke(); }
      if (s.warn < 16) {
        ctx.strokeStyle = 'rgba(230, 250, 255, 0.8)'; ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-14 + i * 7, -4 - ((t * 3 + i * 9) % 16), 2, 0, Math.PI * 2); ctx.stroke(); }
      }
      ctx.restore();
      return;
    }
    const up = s.life;
    const rise = Math.min(1, (34 - up) / 6 + 0.2), sink = Math.min(1, up / 8);
    const h = s.h * Math.min(rise, sink);
    ctx.save();
    const wv = Math.sin(t * 0.3) * 6;
    ctx.fillStyle = '#7a3088';
    ctx.beginPath(); ctx.moveTo(cx - 18, gy);
    ctx.quadraticCurveTo(cx - 20 + wv, gy - h * 0.5, cx - 6 + wv, gy - h);
    ctx.quadraticCurveTo(cx + 6 + wv, gy - h - 8, cx + 10 + wv, gy - h + 6);
    ctx.quadraticCurveTo(cx + 18 + wv * 0.5, gy - h * 0.5, cx + 18, gy);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8b0d8';
    for (let k = 1; k < 6; k++) { const yy = gy - h * k / 6; ctx.beginPath(); ctx.arc(cx + 8 + wv * (k / 6), yy, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(40, 10, 50, 0.5)';
    ctx.beginPath(); ctx.ellipse(cx, gy - 1, 26, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  const baseShot = Sprites.shot;
  Sprites.shot = function (ctx, s, t) {
    if (s.pillar && s.tentacle) { tentacle(ctx, s, t); return; }
    baseShot(ctx, s, t);
  };

  // ── 海神的封印（v1.31.2 玩家：設計個解謎小任務在亞特蘭提斯關卡，解開才能找到海底城）──────────
  /*
   * 亞特蘭提斯的潛水關（encounter.js 的 diveDef，def.riddle）：
   *   往下潛的路上，牆上有三幅壁畫，各刻一個圖案和羅馬數字 I、II、III（順序每次潛水都不一樣）。
   *   潛到神殿底部，大門前有三塊石板（貝殼、海星、三叉戟），照壁畫的順序踩 —— 踩錯了石板會浮回來重踩。
   *   三塊都對 = 封印解開（Save.flag('abyssGate')），大門後面就是海底城（Quests.abyssOpen）。
   *   不想解也行：游進右邊的氣泡柱就浮上去（照樣過關、拿 EXP，只是海底城還沒開）。
   * 解開過一次之後，再潛下來大門就是開著的（踩到底照舊直接過關）。
   */
  const SYMS = ['shell', 'star', 'trident'];
  const NUMS = ['I', 'II', 'III'];
  function makeRiddle(def) {
    const gf = (def.shaftFloors || []).filter(function (f) { return f.goal; })[0];
    if (!gf || !def.riddle) return null;
    const order = SYMS.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const q = order[i]; order[i] = order[j]; order[j] = q; }
    const floorY = function (n) { const f = def.shaftFloors.filter(function (q) { return q.floor === n; })[0]; return f ? f.y : gf.y; };
    return {
      order: order,
      murals: def.riddle.murals.map(function (n, k) {
        return { y: floorY(n) - 120, x: k % 2 ? gf.x + gf.w - 108 : gf.x + 8, sym: order[k], n: k };
      }),
      plates: SYMS.map(function (sym, k) { return { sym: sym, x: Math.round(gf.x + gf.w * (0.3 + k * 0.2) - 30), y: gf.y, w: 60, down: false }; }),
      exit: { x: gf.x + gf.w - 52, y: gf.y, w: 44 },
      door: { x: gf.x + gf.w / 2, y: gf.y },
      solved: typeof Save !== 'undefined' && !!Save.flag('abyssGate'),
      pressed: [], cool: 0, over: -1, arrived: false, done: false, doneT: 0, left: false, wrongT: 0
    };
  }
  /**
   * 每帧（豎井關的過關判定那裡呼叫）：onGoal = 站在抵達層上。回傳 true = 這一關現在過關。
   * 已經解開過的：踩到底就過關（跟原本一樣）。
   */
  function updateRiddle(state, p, onGoal, events) {
    const r = state.riddle;
    if (r.wrongT > 0) r.wrongT--;
    if (r.solved && !r.done) return onGoal;
    if (r.cool > 0 && --r.cool === 0) { r.pressed = []; r.plates.forEach(function (q) { q.down = false; }); }
    if (onGoal && !r.arrived) { r.arrived = true; events.push('riddle:start'); }
    if (!r.arrived) return false;
    r.arriveT = (r.arriveT || 0) + 1;
    if (r.done) return --r.doneT <= 0;
    const cx = p.x + p.w / 2;
    // 踩上一塊石板（剛走進那塊的那一帧才算：站在上面不會一直踩）
    let over = -1;
    r.plates.forEach(function (q, k) { if (onGoal && cx > q.x + 6 && cx < q.x + q.w - 6) over = k; });
    if (over >= 0 && over !== r.over && r.cool <= 0) {
      const q = r.plates[over];
      if (!q.down) {
        q.down = true;
        r.pressed.push(q.sym);
        const k = r.pressed.length - 1;
        if (r.pressed[k] !== r.order[k]) { r.cool = 50; r.wrongT = 50; events.push('riddle:wrong'); }
        else if (r.pressed.length === SYMS.length) { r.done = true; r.solved = true; r.doneT = 110; events.push('riddle:solved'); }
        else events.push('riddle:press');
      }
    }
    r.over = over;
    // 不解了：游進右邊的氣泡柱浮上去
    // （剛沉到底的頭一秒不算：免得落點剛好在氣泡柱裡，什麼都沒看到就浮上去了）
    if (r.arriveT > 60 && cx > r.exit.x && cx < r.exit.x + r.exit.w && p.y + p.h > r.exit.y - 220) { r.left = true; return true; }
    return false;
  }

  /** 三個圖案：貝殼、海星、三叉戟（x, y = 中心） */
  function symbol(ctx, sym, x, y, s, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    if (sym === 'shell') {
      ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-13, -4); ctx.quadraticCurveTo(0, -18, 13, -4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2;
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(k * 5, -10 + Math.abs(k)); ctx.stroke(); }
    } else if (sym === 'star') {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 5 : 14; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, -6);
      ctx.moveTo(-9, -12); ctx.lineTo(-9, -3); ctx.quadraticCurveTo(-9, 2, 0, 2); ctx.quadraticCurveTo(9, 2, 9, -3); ctx.lineTo(9, -12);
      ctx.moveTo(0, -6); ctx.lineTo(0, -14); ctx.stroke();
    }
    ctx.restore();
  }
  /**
   * 畫（豎井的世界座標，呼叫端已經 translate(0, -camY)）。
   * layer 'back'：牆上的壁畫、神殿大門（在樓層後面）；'front'：大門前的石板、離開的氣泡柱（在樓層上面）。
   */
  function drawRiddle(ctx, state, t, layer, camY, H) {
    const r = state.riddle;
    if (!r) return;
    const vis = function (y) { return y > camY - 140 && y < camY + H + 140; };
    if (layer === 'back') {
      r.murals.forEach(function (m) {
        if (!vis(m.y)) return;
        // 壁畫：一大塊刻字的石板（要大，往下潛的時候瞄一眼就看得到）
        const glow = 0.25 + Math.sin(t * 0.08 + m.n) * 0.15;
        ctx.fillStyle = 'rgba(160, 240, 255, ' + (glow * 0.6).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(m.x + 50, m.y + 56, 62, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(214, 204, 172, 0.95)'; U.roundRect(ctx, m.x, m.y, 100, 112, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(120, 100, 70, 0.9)'; ctx.lineWidth = 2.5; U.roundRect(ctx, m.x + 5, m.y + 5, 90, 102, 5); ctx.stroke();
        U.text(ctx, NUMS[m.n], m.x + 50, m.y + 22, { size: 22, weight: 800, color: '#7a2a10', stroke: false });
        symbol(ctx, m.sym, m.x + 50, m.y + 70, 1.8, '#1e5a7a');
      });
      const d = r.door;
      if (!vis(d.y)) return;
      // 神殿大門：大理石框、三個圖案的凹槽；解開 = 門往兩邊滑開，後面透出海底城的光
      ctx.fillStyle = 'rgba(220, 212, 190, 0.9)';
      ctx.fillRect(d.x - 90, d.y - 170, 180, 14); ctx.fillRect(d.x - 90, d.y - 156, 16, 156); ctx.fillRect(d.x + 74, d.y - 156, 16, 156);
      ctx.beginPath(); ctx.moveTo(d.x - 100, d.y - 170); ctx.lineTo(d.x, d.y - 210); ctx.lineTo(d.x + 100, d.y - 170); ctx.closePath(); ctx.fill();
      if (r.solved) {
        const g = ctx.createLinearGradient(0, d.y - 156, 0, d.y);
        g.addColorStop(0, 'rgba(120, 230, 255, 0.85)'); g.addColorStop(1, 'rgba(40, 120, 180, 0.6)');
        ctx.fillStyle = g; ctx.fillRect(d.x - 74, d.y - 156, 148, 156);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        for (let k = 0; k < 6; k++) ctx.fillRect(d.x - 60 + k * 24, d.y - 40 - (k % 3) * 18, 10, 40 + (k % 3) * 18);
        const open = r.done ? Math.min(1, (110 - r.doneT) / 60) : 1;
        ctx.fillStyle = '#6a5a4a';
        ctx.fillRect(d.x - 74 - open * 60, d.y - 156, 74, 156); ctx.fillRect(d.x + open * 60, d.y - 156, 74, 156);
      } else {
        ctx.fillStyle = '#6a5a4a'; ctx.fillRect(d.x - 74, d.y - 156, 148, 156);
        ctx.strokeStyle = 'rgba(40, 30, 20, 0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(d.x, d.y - 156); ctx.lineTo(d.x, d.y); ctx.stroke();
        SYMS.forEach(function (sym, k) {
          const lit = r.pressed.length > k && !r.wrongT;
          ctx.fillStyle = 'rgba(30, 20, 14, 0.6)'; ctx.beginPath(); ctx.arc(d.x - 44 + k * 44, d.y - 112, 15, 0, Math.PI * 2); ctx.fill();
          if (r.pressed[k]) symbol(ctx, r.pressed[k], d.x - 44 + k * 44, d.y - 112, 0.8, r.wrongT ? '#e84a4a' : '#ffd166');
          else U.text(ctx, NUMS[k], d.x - 44 + k * 44, d.y - 112, { size: 11, color: 'rgba(220, 200, 160, 0.7)', stroke: false });
          if (lit) { ctx.fillStyle = 'rgba(255, 220, 120, 0.25)'; ctx.beginPath(); ctx.arc(d.x - 44 + k * 44, d.y - 112, 20, 0, Math.PI * 2); ctx.fill(); }
        });
      }
      return;
    }
    if (!vis(r.door.y)) return;
    // 石板
    r.plates.forEach(function (q) {
      const down = q.down || r.solved;
      ctx.fillStyle = down ? '#c8a858' : '#8a8478';
      U.roundRect(ctx, q.x, q.y - (down ? 3 : 7), q.w, down ? 5 : 9, 3); ctx.fill();
      symbol(ctx, q.sym, q.x + q.w / 2, q.y - 22, 0.75, down ? (r.wrongT ? '#e84a4a' : '#ffd166') : 'rgba(200, 240, 255, 0.85)');
    });
    // 離開的氣泡柱（還沒解開時才有）
    if (!r.solved) {
      const e = r.exit;
      ctx.strokeStyle = 'rgba(220, 245, 255, 0.75)'; ctx.lineWidth = 1.5;
      for (let k = 0; k < 8; k++) {
        const ph = (t * 1.4 + k * 27) % 210;
        ctx.beginPath(); ctx.arc(e.x + 10 + (k % 3) * 12 + Math.sin(t * 0.1 + k) * 3, e.y - ph, 3 + (k % 3), 0, Math.PI * 2); ctx.stroke();
      }
      U.text(ctx, '↑ 浮上去', e.x + e.w / 2, e.y - 230, { size: 11, color: '#d8f4ff', stroke: true });
    }
  }

  return {
    makeRiddle: makeRiddle, updateRiddle: updateRiddle, drawRiddle: drawRiddle, symbol: symbol,
    SPOTS: SPOTS, REGIONS: REGIONS, SEAS: SEAS, PALETTE: PALETTE,
    drawMapBack: drawMapBack, drawMapDistricts: drawMapDistricts, drawSurface: drawSurface, drawBell: drawBell
  };
})();
