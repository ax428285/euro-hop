'use strict';

/** 純 Canvas 繪製的地標、國家特色物件與角色，不依賴任何圖檔 */
const Sprites = (function () {

  // ── 遠景地標（底部對齊 baseY） ──────────────────────────────

  function eiffel(ctx, x, baseY, s) {
    const h = 220 * s, w = 110 * s;
    ctx.save();
    ctx.translate(x, baseY);
    ctx.strokeStyle = 'rgba(70, 64, 56, 0.55)';
    ctx.fillStyle = 'rgba(96, 88, 76, 0.5)';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0); ctx.quadraticCurveTo(-w * 0.18, -h * 0.5, -w * 0.07, -h);
    ctx.moveTo(w / 2, 0);  ctx.quadraticCurveTo(w * 0.18, -h * 0.5, w * 0.07, -h);
    ctx.stroke();
    [0.28, 0.55, 0.78].forEach(function (t) {
      const yy = -h * t;
      const half = w / 2 * (1 - t) * 0.9 + 4 * s;
      ctx.fillRect(-half, yy, half * 2, 5 * s);
    });
    ctx.fillRect(-2.5 * s, -h - 22 * s, 5 * s, 22 * s);
    ctx.restore();
  }

  function windmill(ctx, x, baseY, s, t) {
    const h = 150 * s;
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(120, 100, 82, 0.55)';
    ctx.beginPath();
    ctx.moveTo(-34 * s, 0); ctx.lineTo(34 * s, 0);
    ctx.lineTo(20 * s, -h); ctx.lineTo(-20 * s, -h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(90, 70, 56, 0.6)';
    ctx.beginPath();
    ctx.moveTo(-24 * s, -h); ctx.lineTo(24 * s, -h); ctx.lineTo(0, -h - 26 * s);
    ctx.closePath(); ctx.fill();
    ctx.translate(0, -h - 6 * s);
    ctx.rotate((t || 0) * 0.5);
    ctx.fillStyle = 'rgba(70, 58, 48, 0.6)';
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 2);
      ctx.fillRect(-4 * s, -72 * s, 8 * s, 72 * s);
      ctx.restore();
    }
    ctx.restore();
  }

  function castle(ctx, x, baseY, s) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(206, 205, 198, 0.55)';
    ctx.fillRect(-70 * s, -130 * s, 140 * s, 130 * s);
    [[-56, 190], [0, 215], [58, 175]].forEach(function (p) {
      const tx = p[0] * s, th = p[1] * s;
      ctx.fillRect(tx - 17 * s, -th, 34 * s, th);
      ctx.fillStyle = 'rgba(120, 90, 92, 0.6)';
      ctx.beginPath();
      ctx.moveTo(tx - 21 * s, -th); ctx.lineTo(tx + 21 * s, -th);
      ctx.lineTo(tx, -th - 36 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(206, 205, 198, 0.55)';
    });
    ctx.fillStyle = 'rgba(70, 70, 86, 0.5)';
    for (let i = 0; i < 4; i++) ctx.fillRect((-50 + i * 30) * s, -100 * s, 10 * s, 18 * s);
    ctx.restore();
  }

  function matterhorn(ctx, x, baseY, s) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(126, 142, 160, 0.6)';
    ctx.beginPath();
    ctx.moveTo(-130 * s, 0);
    ctx.lineTo(-18 * s, -230 * s);
    ctx.lineTo(16 * s, -210 * s);
    ctx.lineTo(140 * s, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(248, 252, 255, 0.72)';
    ctx.beginPath();
    ctx.moveTo(-18 * s, -230 * s);
    ctx.lineTo(16 * s, -210 * s);
    ctx.lineTo(44 * s, -168 * s);
    ctx.lineTo(10 * s, -180 * s);
    ctx.lineTo(-20 * s, -156 * s);
    ctx.lineTo(-48 * s, -172 * s);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function colosseum(ctx, x, baseY, s) {
    ctx.save();
    ctx.translate(x, baseY);
    const w = 190 * s, h = 130 * s;
    ctx.fillStyle = 'rgba(176, 148, 112, 0.55)';
    U.roundRect(ctx, -w / 2, -h, w, h, 14 * s);
    ctx.fill();
    ctx.fillStyle = 'rgba(96, 76, 56, 0.45)';
    for (let row = 0; row < 2; row++) {
      const ay = -h + 18 * s + row * 48 * s;
      for (let i = 0; i < 7; i++) {
        const ax = -w / 2 + 16 * s + i * 25 * s;
        ctx.beginPath();
        ctx.moveTo(ax, ay + 30 * s);
        ctx.lineTo(ax, ay + 10 * s);
        ctx.arc(ax + 7 * s, ay + 10 * s, 7 * s, Math.PI, 0);
        ctx.lineTo(ax + 14 * s, ay + 30 * s);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }

  function parthenon(ctx, x, baseY, s) {
    ctx.save();
    ctx.translate(x, baseY);
    const w = 180 * s;
    ctx.fillStyle = 'rgba(234, 226, 206, 0.6)';
    ctx.fillRect(-w / 2 - 8 * s, -14 * s, w + 16 * s, 14 * s);
    for (let i = 0; i < 8; i++) {
      const cx = -w / 2 + 10 * s + i * (w - 20 * s) / 7;
      ctx.fillRect(cx - 6 * s, -112 * s, 12 * s, 98 * s);
    }
    ctx.fillRect(-w / 2 - 6 * s, -128 * s, w + 12 * s, 16 * s);
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 6 * s, -128 * s);
    ctx.lineTo(w / 2 + 6 * s, -128 * s);
    ctx.lineTo(0, -176 * s);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /** 西班牙：聖家堂（細長的尖塔群） */
  function sagradaLm(ctx, x, baseY, s) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(186, 152, 108, 0.55)';
    // 主體
    ctx.fillRect(-58 * s, -96 * s, 116 * s, 96 * s);
    // 四座尖塔，高度不一
    [[-44, 196], [-16, 228], [16, 214], [44, 176]].forEach(function (p) {
      const tx = p[0] * s, th = p[1] * s;
      ctx.fillRect(tx - 11 * s, -th, 22 * s, th);
      ctx.beginPath();
      ctx.moveTo(tx - 11 * s, -th);
      ctx.lineTo(tx + 11 * s, -th);
      ctx.lineTo(tx, -th - 30 * s);
      ctx.closePath(); ctx.fill();
    });
    // 窗
    ctx.fillStyle = 'rgba(70, 70, 86, 0.4)';
    for (let i = 0; i < 4; i++) ctx.fillRect((-44 + i * 28) * s, -70 * s, 9 * s, 24 * s);
    ctx.restore();
  }

  /** 英國：大本鐘 */
  function bigbenLm(ctx, x, baseY, s) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(176, 152, 112, 0.55)';
    // 塔身
    ctx.fillRect(-24 * s, -210 * s, 48 * s, 210 * s);
    // 鐘面
    ctx.fillStyle = 'rgba(244, 240, 226, 0.75)';
    ctx.beginPath(); ctx.arc(0, -176 * s, 17 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(80, 70, 56, 0.6)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(0, -176 * s); ctx.lineTo(0, -188 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -176 * s); ctx.lineTo(9 * s, -176 * s); ctx.stroke();
    // 尖頂
    ctx.fillStyle = 'rgba(140, 118, 86, 0.6)';
    ctx.beginPath();
    ctx.moveTo(-26 * s, -210 * s); ctx.lineTo(26 * s, -210 * s); ctx.lineTo(0, -254 * s);
    ctx.closePath(); ctx.fill();
    // 旁邊的議會大廈
    ctx.fillStyle = 'rgba(176, 152, 112, 0.45)';
    ctx.fillRect(24 * s, -96 * s, 96 * s, 96 * s);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = 'rgba(70, 70, 86, 0.35)';
      ctx.fillRect((34 + i * 15) * s, -76 * s, 8 * s, 30 * s);
    }
    ctx.restore();
  }

  /** 捷克：查理大橋 + 布拉格城堡輪廓 */
  function charlesLm(ctx, x, baseY, s) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(168, 142, 110, 0.5)';
    // 橋面
    ctx.fillRect(-120 * s, -58 * s, 240 * s, 14 * s);
    // 橋拱
    for (let i = 0; i < 4; i++) {
      const ax = (-96 + i * 64) * s;
      ctx.beginPath();
      ctx.moveTo(ax - 22 * s, 0);
      ctx.lineTo(ax - 22 * s, -44 * s);
      ctx.arc(ax, -44 * s, 22 * s, Math.PI, 0);
      ctx.lineTo(ax + 22 * s, 0);
      ctx.closePath(); ctx.fill();
    }
    // 橋塔
    ctx.fillStyle = 'rgba(150, 122, 92, 0.6)';
    [-116, 108].forEach(function (tx) {
      ctx.fillRect(tx * s - 12 * s, -130 * s, 24 * s, 76 * s);
      ctx.beginPath();
      ctx.moveTo(tx * s - 14 * s, -130 * s);
      ctx.lineTo(tx * s + 14 * s, -130 * s);
      ctx.lineTo(tx * s, -158 * s);
      ctx.closePath(); ctx.fill();
    });
    ctx.restore();
  }

  /** 奧地利：歌劇院 */
  function operaLm(ctx, x, baseY, s) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(198, 172, 138, 0.55)';
    ctx.fillRect(-92 * s, -112 * s, 184 * s, 112 * s);
    // 拱廊
    ctx.fillStyle = 'rgba(86, 70, 54, 0.4)';
    for (let i = 0; i < 5; i++) {
      const ax = (-70 + i * 35) * s;
      ctx.beginPath();
      ctx.moveTo(ax - 12 * s, 0);
      ctx.lineTo(ax - 12 * s, -34 * s);
      ctx.arc(ax, -34 * s, 12 * s, Math.PI, 0);
      ctx.lineTo(ax + 12 * s, 0);
      ctx.closePath(); ctx.fill();
    }
    // 上層與屋頂
    ctx.fillStyle = 'rgba(182, 156, 122, 0.6)';
    ctx.fillRect(-78 * s, -150 * s, 156 * s, 40 * s);
    ctx.fillStyle = 'rgba(110, 126, 112, 0.6)';
    ctx.beginPath();
    ctx.moveTo(-82 * s, -150 * s); ctx.lineTo(82 * s, -150 * s);
    ctx.lineTo(56 * s, -178 * s); ctx.lineTo(-56 * s, -178 * s);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  const landmarks = {
    eiffel: eiffel, windmill: windmill, castle: castle,
    matterhorn: matterhorn, colosseum: colosseum, parthenon: parthenon,
    sagrada: sagradaLm, bigben: bigbenLm,
    charlesbridge: charlesLm, operahouse: operaLm
  };

  // ── 國家特色物件（前景，站在地面上，baseY = 地面頂端） ──────
  // 每個函式簽名：(ctx, x, baseY, t, prop)

  // 法國 ───────────────────────────────────────────
  function arcTriomphe(ctx, x, baseY, t, p) {
    const s = (p && p.scale) || 1;
    const w = 120 * s, h = 110 * s;
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = '#cdbfa6';
    ctx.fillRect(-w / 2, -h, w, h);
    // 拱洞
    ctx.fillStyle = '#6a6252';
    ctx.beginPath();
    ctx.moveTo(-26 * s, 0);
    ctx.lineTo(-26 * s, -52 * s);
    ctx.arc(0, -52 * s, 26 * s, Math.PI, 0);
    ctx.lineTo(26 * s, 0);
    ctx.closePath(); ctx.fill();
    // 頂部線腳與浮雕
    ctx.fillStyle = '#b8a888';
    ctx.fillRect(-w / 2 - 4 * s, -h - 8 * s, w + 8 * s, 8 * s);
    ctx.fillStyle = '#9e8f73';
    for (let i = 0; i < 4; i++) ctx.fillRect(-48 * s + i * 26 * s, -h + 14 * s, 14 * s, 20 * s);
    ctx.restore();
  }

  function cafe(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    // 遮陽棚（紅白條）
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#f2f2f2' : '#c0392b';
      ctx.fillRect(-42 + i * 14, -74, 14, 16);
    }
    ctx.fillStyle = '#8a7256';
    ctx.fillRect(-44, -58, 88, 4);
    // 小圓桌
    ctx.fillStyle = '#6b5a44';
    ctx.fillRect(-3, -30, 6, 30);
    ctx.fillStyle = '#d9cdb8';
    ctx.beginPath(); ctx.ellipse(0, -32, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
    // 兩張椅子
    ctx.fillStyle = '#4a4036';
    ctx.fillRect(-28, -22, 4, 22); ctx.fillRect(-34, -24, 16, 3);
    ctx.fillRect(24, -22, 4, 22);  ctx.fillRect(18, -24, 16, 3);
    // 咖啡杯
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-5, -39, 8, 6);
    ctx.restore();
  }

  function kiosk(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = '#2f5e4a';
    ctx.fillRect(-20, -62, 40, 62);
    ctx.fillStyle = '#1f4234';
    ctx.beginPath();
    ctx.moveTo(-26, -62); ctx.lineTo(26, -62); ctx.lineTo(0, -80);
    ctx.closePath(); ctx.fill();
    // 海報
    ctx.fillStyle = '#e8d9b5';
    ctx.fillRect(-14, -54, 12, 18);
    ctx.fillStyle = '#d4a0a8';
    ctx.fillRect(2, -54, 12, 18);
    ctx.restore();
  }

  function lamp(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = '#3c4250';
    ctx.fillRect(-3, -84, 6, 84);
    ctx.fillRect(-8, -4, 16, 4);
    // 燈頭
    ctx.fillStyle = '#2f3542';
    ctx.beginPath();
    ctx.moveTo(-10, -84); ctx.lineTo(10, -84); ctx.lineTo(6, -98); ctx.lineTo(-6, -98);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255, 226, 150, 0.9)';
    ctx.fillRect(-6, -95, 12, 10);
    ctx.restore();
  }

  // 荷蘭 ───────────────────────────────────────────
  function canalHouse(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    const cols = ['#8c4a3f', '#3f5a8c', '#6b4a7a'];
    // 三棟窄高運河屋並排
    for (let k = 0; k < 3; k++) {
      const bx = -54 + k * 38;
      const bh = 104 + (k % 2) * 16;
      ctx.fillStyle = cols[k];
      ctx.fillRect(bx, -bh, 34, bh);
      // 荷蘭特有的階梯式山牆
      ctx.fillStyle = cols[k];
      ctx.fillRect(bx + 4, -bh - 8, 26, 8);
      ctx.fillRect(bx + 10, -bh - 15, 14, 7);
      ctx.fillRect(bx + 14, -bh - 20, 6, 5);
      // 窗
      ctx.fillStyle = 'rgba(248, 236, 198, 0.92)';
      for (let r = 0; r < 3; r++) {
        ctx.fillRect(bx + 6, -bh + 14 + r * 26, 9, 14);
        ctx.fillRect(bx + 19, -bh + 14 + r * 26, 9, 14);
      }
      // 門
      ctx.fillStyle = '#2b2118';
      ctx.fillRect(bx + 12, -22, 11, 22);
    }
    ctx.restore();
  }

  function bike(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.strokeStyle = '#2b2f3a';
    ctx.lineWidth = 2.5;
    // 兩輪
    ctx.beginPath(); ctx.arc(-13, -11, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(14, -11, 11, 0, Math.PI * 2); ctx.stroke();
    // 車架
    ctx.beginPath();
    ctx.moveTo(-13, -11); ctx.lineTo(0, -11); ctx.lineTo(6, -26);
    ctx.lineTo(-6, -26); ctx.lineTo(0, -11); ctx.lineTo(14, -11);
    ctx.moveTo(6, -26); ctx.lineTo(14, -11);
    ctx.stroke();
    // 龍頭與座墊
    ctx.beginPath(); ctx.moveTo(13, -27); ctx.lineTo(18, -30); ctx.stroke();
    ctx.fillStyle = '#2b2f3a';
    ctx.fillRect(-11, -31, 11, 4);
    ctx.restore();
  }

  function bridge(ctx, x, baseY, t, p) {
    const span = (p && p.span) || 100;
    ctx.save();
    ctx.translate(x, baseY);
    // 荷蘭拱橋：跨在運河上，純裝飾（不可站）
    ctx.strokeStyle = '#8a6a4a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.quadraticCurveTo(span / 2, -40, span + 6, -2);
    ctx.stroke();
    // 欄杆立柱
    ctx.fillStyle = '#6e5238';
    for (let i = 0; i <= 4; i++) {
      const tt = i / 4;
      const bx = U.lerp(-6, span + 6, tt);
      const by = -2 + (-40 + 2) * (1 - (2 * tt - 1) * (2 * tt - 1)) * 0.5;
      ctx.fillRect(bx - 1.5, by - 12, 3, 12);
    }
    ctx.restore();
  }

  function cow(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    // 乳牛（黑白花）
    ctx.fillStyle = '#f4f4f0';
    U.roundRect(ctx, -22, -30, 44, 22, 8); ctx.fill();
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.ellipse(-8, -22, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10, -26, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
    // 腿
    ctx.fillStyle = '#e6e6e0';
    ctx.fillRect(-17, -9, 5, 9); ctx.fillRect(-6, -9, 5, 9);
    ctx.fillRect(7, -9, 5, 9); ctx.fillRect(16, -9, 5, 9);
    // 頭
    ctx.fillStyle = '#f4f4f0';
    U.roundRect(ctx, 20, -34, 16, 14, 5); ctx.fill();
    ctx.fillStyle = '#d8aeb0';
    ctx.fillRect(32, -27, 5, 6);
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(25, -30, 2, 2);
    ctx.restore();
  }

  // 德國 ───────────────────────────────────────────
  function brandenburg(ctx, x, baseY, t, p) {
    const s = (p && p.scale) || 1;
    ctx.save();
    ctx.translate(x, baseY);
    // 基座與六根立柱
    ctx.fillStyle = '#d6cfc0';
    ctx.fillRect(-72 * s, -6 * s, 144 * s, 6 * s);
    for (let i = 0; i < 6; i++) {
      const cx = -60 * s + i * 24 * s;
      ctx.fillStyle = '#cfc7b6';
      ctx.fillRect(cx - 6 * s, -92 * s, 12 * s, 86 * s);
    }
    // 楣樑
    ctx.fillStyle = '#ddd6c8';
    ctx.fillRect(-76 * s, -104 * s, 152 * s, 12 * s);
    // 頂上的四馬戰車
    ctx.fillStyle = '#8d8372';
    ctx.fillRect(-20 * s, -118 * s, 40 * s, 14 * s);
    ctx.fillStyle = '#7a7161';
    for (let i = 0; i < 4; i++) ctx.fillRect(-16 * s + i * 9 * s, -126 * s, 5 * s, 9 * s);
    ctx.restore();
  }

  function halfTimber(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    const w = 76, h = 86;
    // 白牆
    ctx.fillStyle = '#f0e8d8';
    ctx.fillRect(-w / 2, -h, w, h);
    // 木構架（半木結構的招牌斜撐）
    ctx.strokeStyle = '#5c3f2a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h); ctx.lineTo(-w / 2, 0);
    ctx.moveTo(w / 2, -h);  ctx.lineTo(w / 2, 0);
    ctx.moveTo(-w / 2, -h * 0.55); ctx.lineTo(w / 2, -h * 0.55);
    ctx.moveTo(-w / 2, -h); ctx.lineTo(0, -h * 0.55);
    ctx.moveTo(w / 2, -h);  ctx.lineTo(0, -h * 0.55);
    ctx.moveTo(-w / 2, 0);  ctx.lineTo(0, -h * 0.55);
    ctx.moveTo(w / 2, 0);   ctx.lineTo(0, -h * 0.55);
    ctx.stroke();
    // 紅屋頂
    ctx.fillStyle = '#a4453a';
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 7, -h); ctx.lineTo(w / 2 + 7, -h); ctx.lineTo(0, -h - 30);
    ctx.closePath(); ctx.fill();
    // 窗與門
    ctx.fillStyle = '#89b4d4';
    ctx.fillRect(-26, -h + 12, 14, 14);
    ctx.fillRect(12, -h + 12, 14, 14);
    ctx.fillStyle = '#4a3523';
    ctx.fillRect(-9, -26, 18, 26);
    ctx.restore();
  }

  function beerTent(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    // 藍白條紋帳篷（啤酒節）
    const w = 110;
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#f2f4f8' : '#3a6ea8';
      ctx.fillRect(-w / 2 + i * (w / 8), -56, w / 8, 56);
    }
    ctx.fillStyle = '#2d5484';
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 8, -56); ctx.lineTo(w / 2 + 8, -56); ctx.lineTo(0, -88);
    ctx.closePath(); ctx.fill();
    // 長板凳
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(-40, -20, 80, 5);
    ctx.fillRect(-36, -15, 4, 15); ctx.fillRect(32, -15, 4, 15);
    ctx.restore();
  }

  function clockTower(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = '#d8cfbc';
    ctx.fillRect(-18, -120, 36, 120);
    ctx.fillStyle = '#8c5a3c';
    ctx.beginPath();
    ctx.moveTo(-24, -120); ctx.lineTo(24, -120); ctx.lineTo(0, -152);
    ctx.closePath(); ctx.fill();
    // 鐘面
    ctx.fillStyle = '#f6f1e2';
    ctx.beginPath(); ctx.arc(0, -98, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a3630';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, -98, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -98); ctx.lineTo(0, -105);
    ctx.moveTo(0, -98); ctx.lineTo(6, -98);
    ctx.stroke();
    ctx.restore();
  }

  function pretzel(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY - 54);
    // 攤架
    ctx.fillStyle = '#6b5436';
    ctx.fillRect(-2, 0, 4, 54);
    ctx.fillStyle = '#5a4630';
    ctx.fillRect(-26, -4, 52, 5);
    // 蝴蝶餅
    ctx.strokeStyle = '#9d6321';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-8, -16, 8, 0.4, Math.PI * 1.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(8, -16, 8, Math.PI * 1.1, Math.PI * 2.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, -22); ctx.lineTo(0, -34); ctx.lineTo(6, -22);
    ctx.stroke();
    ctx.restore();
  }

  // 瑞士 ───────────────────────────────────────────
  function chalet(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    const w = 86, h = 58;
    ctx.fillStyle = '#7a5235';
    ctx.fillRect(-w / 2, -h, w, h);
    // 木板橫紋
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 4; i++) ctx.fillRect(-w / 2, -h + 10 + i * 13, w, 3);
    // 大屋簷（積雪）
    ctx.fillStyle = '#5a3e28';
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 14, -h); ctx.lineTo(w / 2 + 14, -h); ctx.lineTo(0, -h - 34);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2f7fb';
    ctx.beginPath();
    ctx.moveTo(-w / 2 - 14, -h); ctx.lineTo(w / 2 + 14, -h);
    ctx.lineTo(w / 2 + 6, -h - 6); ctx.lineTo(-w / 2 - 6, -h - 6);
    ctx.closePath(); ctx.fill();
    // 窗與花台
    ctx.fillStyle = '#f8e9b8';
    ctx.fillRect(-28, -46, 16, 14);
    ctx.fillRect(12, -46, 16, 14);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-30, -31, 20, 4);
    ctx.fillRect(10, -31, 20, 4);
    ctx.fillStyle = '#3f2d1d';
    ctx.fillRect(-8, -26, 16, 26);
    ctx.restore();
  }

  function cableCar(ctx, x, baseY, t, p) {
    const span = (p && p.span) || 700;
    ctx.save();
    // 纜線從左下往右上
    const y0 = baseY - 150, y1 = baseY - 250;
    ctx.strokeStyle = 'rgba(60, 70, 86, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y0); ctx.lineTo(x + span, y1);
    ctx.stroke();
    // 兩座塔
    [0, 1].forEach(function (k) {
      const tx = x + k * span, ty = k ? y1 : y0;
      ctx.strokeStyle = 'rgba(60, 70, 86, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tx, ty); ctx.lineTo(tx - 10, ty + 54);
      ctx.moveTo(tx, ty); ctx.lineTo(tx + 10, ty + 54);
      ctx.stroke();
    });
    // 來回移動的車廂
    const prog = (Math.sin((t || 0) * 0.008) + 1) / 2;
    const cx = U.lerp(x + 40, x + span - 40, prog);
    const cy = U.lerp(y0, y1, (cx - x) / span);
    ctx.fillStyle = '#4a5468';
    ctx.fillRect(cx - 2, cy, 4, 10);
    ctx.fillStyle = '#c0392b';
    U.roundRect(ctx, cx - 13, cy + 10, 26, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#9fc9e8';
    ctx.fillRect(cx - 9, cy + 14, 18, 8);
    ctx.restore();
  }

  function swissClock(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    // 車站大鐘（瑞士鐵路鐘）
    ctx.fillStyle = '#4a515e';
    ctx.fillRect(-3, -96, 6, 96);
    ctx.fillStyle = '#f7f9fb';
    ctx.beginPath(); ctx.arc(0, -110, 17, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2c313a';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, -110, 17, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -110); ctx.lineTo(0, -121);
    ctx.moveTo(0, -110); ctx.lineTo(8, -110);
    ctx.stroke();
    // 紅色秒針圓頭
    ctx.fillStyle = '#e03131';
    ctx.beginPath(); ctx.arc(0, -121, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 義大利 ─────────────────────────────────────────
  function pisaTower(ctx, x, baseY, t, p) {
    const s = (p && p.scale) || 1;
    ctx.save();
    ctx.translate(x, baseY);
    ctx.rotate(-0.09);   // 招牌傾斜
    const w = 42 * s, h = 150 * s;
    ctx.fillStyle = '#e6e0d0';
    ctx.fillRect(-w / 2, -h, w, h);
    // 每層的拱廊
    ctx.fillStyle = 'rgba(120, 108, 88, 0.45)';
    for (let r = 0; r < 6; r++) {
      const yy = -h + 16 * s + r * 22 * s;
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(-w / 2 + 4 * s + i * 7.5 * s, yy, 3.5 * s, 12 * s);
      }
    }
    // 頂層鐘樓
    ctx.fillStyle = '#d8d0bc';
    ctx.fillRect(-w / 2 - 3 * s, -h - 14 * s, w + 6 * s, 14 * s);
    ctx.restore();
  }

  function trevi(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    // 許願池：背牆 + 水池
    ctx.fillStyle = '#e4dcc8';
    ctx.fillRect(-56, -84, 112, 84);
    ctx.fillStyle = '#cfc5ad';
    ctx.fillRect(-60, -92, 120, 10);
    // 壁龕
    ctx.fillStyle = '#9d937c';
    ctx.beginPath();
    ctx.moveTo(-16, -8); ctx.lineTo(-16, -52);
    ctx.arc(0, -52, 16, Math.PI, 0);
    ctx.lineTo(16, -8);
    ctx.closePath(); ctx.fill();
    // 雕像剪影
    ctx.fillStyle = '#efe8d6';
    ctx.beginPath(); ctx.arc(0, -46, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-5, -40, 10, 26);
    // 側柱
    ctx.fillStyle = '#d8cfb8';
    ctx.fillRect(-48, -76, 10, 76);
    ctx.fillRect(38, -76, 10, 76);
    // 水池
    ctx.fillStyle = '#5ea8d8';
    ctx.fillRect(-58, -10, 116, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(-58, -10, 116, 2);
    ctx.restore();
  }

  function ruinColumns(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    // 殘柱（高度不一，有斷裂感）
    const hs = [88, 64, 96, 42];
    hs.forEach(function (h, i) {
      const cx = -42 + i * 28;
      ctx.fillStyle = '#ddd4bd';
      ctx.fillRect(cx - 8, -h, 16, h);
      // 凹槽
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(cx - 4, -h, 2, h);
      ctx.fillRect(cx + 2, -h, 2, h);
      // 柱頭
      ctx.fillStyle = '#cfc4ab';
      ctx.fillRect(cx - 11, -h - 6, 22, 6);
    });
    // 地上的斷落楣樑
    ctx.fillStyle = '#cbc0a6';
    ctx.fillRect(-46, -8, 44, 8);
    ctx.restore();
  }

  function gondola(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    // 貢多拉船（停在岸邊）
    ctx.fillStyle = '#23252c';
    ctx.beginPath();
    ctx.moveTo(-34, -6);
    ctx.quadraticCurveTo(0, 6, 34, -6);
    ctx.quadraticCurveTo(38, -14, 30, -13);
    ctx.quadraticCurveTo(0, -4, -30, -13);
    ctx.quadraticCurveTo(-38, -14, -34, -6);
    ctx.closePath(); ctx.fill();
    // 船頭鐵飾
    ctx.fillStyle = '#b8a26a';
    ctx.fillRect(32, -26, 4, 14);
    ctx.fillRect(32, -28, 10, 4);
    // 船夫的槳
    ctx.strokeStyle = '#8a6a44';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-12, -14); ctx.lineTo(-26, -34); ctx.stroke();
    ctx.restore();
  }

  function pizzaStand(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    // 綠白紅遮陽棚
    const cols = ['#008C45', '#F4F5F0', '#CD212A'];
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = cols[i % 3];
      ctx.fillRect(-42 + i * 14, -70, 14, 14);
    }
    ctx.fillStyle = '#7a6448';
    ctx.fillRect(-44, -56, 88, 5);
    ctx.fillRect(-40, -51, 5, 51);
    ctx.fillRect(35, -51, 5, 51);
    // 檯面與披薩
    ctx.fillStyle = '#9d8460';
    ctx.fillRect(-34, -30, 68, 6);
    ctx.fillStyle = '#e8b45a';
    ctx.beginPath(); ctx.arc(-12, -34, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c0392b';
    [[-16, -37], [-8, -33], [-14, -30]].forEach(function (d) {
      ctx.beginPath(); ctx.arc(d[0], d[1], 2.2, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  function vespa(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    // 速克達
    ctx.fillStyle = '#3f8f7a';
    U.roundRect(ctx, -16, -26, 30, 14, 6); ctx.fill();
    ctx.beginPath(); ctx.arc(-14, -16, 8, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2f3a';
    ctx.beginPath(); ctx.arc(-14, -9, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(17, -9, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8cdd6';
    ctx.beginPath(); ctx.arc(-14, -9, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(17, -9, 3.5, 0, Math.PI * 2); ctx.fill();
    // 龍頭與座墊
    ctx.strokeStyle = '#2b2f3a';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(14, -24); ctx.lineTo(20, -34); ctx.stroke();
    ctx.fillStyle = '#23252c';
    ctx.fillRect(-14, -31, 16, 5);
    ctx.restore();
  }

  // 希臘 ───────────────────────────────────────────
  function blueDome(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    // 白牆教堂
    ctx.fillStyle = '#f7f8f8';
    ctx.fillRect(-40, -62, 80, 62);
    // 藍圓頂
    ctx.fillStyle = '#1f6fb5';
    ctx.beginPath(); ctx.arc(0, -62, 26, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#19598f';
    ctx.beginPath(); ctx.arc(0, -62, 26, Math.PI * 1.05, Math.PI * 1.45); ctx.fill();
    // 十字
    ctx.fillStyle = '#e4e8ec';
    ctx.fillRect(-2, -102, 4, 14);
    ctx.fillRect(-7, -98, 14, 4);
    // 拱窗與門
    ctx.fillStyle = '#1f6fb5';
    ctx.beginPath();
    ctx.moveTo(-9, 0); ctx.lineTo(-9, -26);
    ctx.arc(0, -26, 9, Math.PI, 0);
    ctx.lineTo(9, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#cfe0ee';
    ctx.fillRect(-30, -48, 10, 12);
    ctx.fillRect(20, -48, 10, 12);
    ctx.restore();
  }

  function amphora(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    // 雙耳瓶
    ctx.fillStyle = '#c87a3c';
    ctx.beginPath();
    ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
    ctx.lineTo(8, -10);
    ctx.quadraticCurveTo(18, -24, 10, -40);
    ctx.lineTo(-10, -40);
    ctx.quadraticCurveTo(-18, -24, -8, -10);
    ctx.closePath(); ctx.fill();
    // 瓶頸與口
    ctx.fillRect(-6, -50, 12, 10);
    ctx.fillStyle = '#a85f2a';
    ctx.fillRect(-9, -54, 18, 5);
    // 雙耳
    ctx.strokeStyle = '#a85f2a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(-11, -44, 6, Math.PI * 0.4, Math.PI * 1.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(11, -44, 6, Math.PI * 1.5, Math.PI * 0.6); ctx.stroke();
    // 黑繪紋飾
    ctx.fillStyle = '#2b2118';
    ctx.fillRect(-11, -32, 22, 3);
    ctx.fillRect(-11, -22, 22, 3);
    ctx.restore();
  }

  function statue(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    // 基座
    ctx.fillStyle = '#cfc6ad';
    ctx.fillRect(-20, -16, 40, 16);
    ctx.fillStyle = '#ddd4bd';
    ctx.fillRect(-16, -22, 32, 6);
    // 大理石人像
    ctx.fillStyle = '#eee8d8';
    ctx.fillRect(-9, -66, 18, 44);          // 身軀（垂墜長袍）
    ctx.beginPath(); ctx.arc(0, -74, 9, 0, Math.PI * 2); ctx.fill();
    // 手臂（一隻抬起）
    ctx.fillRect(-18, -62, 9, 22);
    ctx.save();
    ctx.translate(9, -62); ctx.rotate(-0.5);
    ctx.fillRect(0, 0, 8, 22);
    ctx.restore();
    // 衣褶
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(-5, -60, 2, 36);
    ctx.fillRect(2, -58, 2, 34);
    ctx.restore();
  }

  function fishBoat(ctx, x, baseY, t, p) {
    const span = (p && p.span) || 100;
    ctx.save();
    // 小漁船浮在水面上，隨浪上下
    const bob = Math.sin((t || 0) * 0.04 + x * 0.01) * 2.5;
    ctx.translate(x + span / 2, baseY + 26 + bob);
    ctx.fillStyle = '#1f6fb5';
    ctx.beginPath();
    ctx.moveTo(-26, -4);
    ctx.quadraticCurveTo(0, 8, 26, -4);
    ctx.lineTo(22, -10);
    ctx.lineTo(-22, -10);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2f4f6';
    ctx.fillRect(-22, -13, 44, 3);
    // 桅桿與小旗
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(-2, -40, 3, 30);
    ctx.fillStyle = '#1f6fb5';
    ctx.beginPath();
    ctx.moveTo(1, -40); ctx.lineTo(16, -34); ctx.lineTo(1, -28);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function greekWindmill(ctx, x, baseY, t) {
    ctx.save();
    ctx.translate(x, baseY);
    // 白色圓塔
    ctx.fillStyle = '#f4f6f7';
    ctx.fillRect(-26, -82, 52, 82);
    ctx.fillStyle = '#e4e8ea';
    ctx.fillRect(12, -82, 14, 82);
    // 錐形草頂
    ctx.fillStyle = '#6b5436';
    ctx.beginPath();
    ctx.moveTo(-30, -82); ctx.lineTo(30, -82); ctx.lineTo(0, -108);
    ctx.closePath(); ctx.fill();
    // 細長帆葉（希臘風車特徵）
    ctx.translate(0, -86);
    ctx.rotate((t || 0) * 0.35);
    ctx.strokeStyle = '#8a7a5c';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(248, 250, 251, 0.9)';
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 3);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -40); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(9, -38); ctx.lineTo(0, -40);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  const props = {
    arcTriomphe: arcTriomphe, cafe: cafe, kiosk: kiosk, lamp: lamp,
    canalHouse: canalHouse, bike: bike, bridge: bridge, cow: cow,
    brandenburg: brandenburg, halfTimber: halfTimber, beerTent: beerTent,
    clockTower: clockTower, pretzel: pretzel,
    chalet: chalet, cableCar: cableCar, swissClock: swissClock,
    pisaTower: pisaTower, trevi: trevi, ruinColumns: ruinColumns,
    gondola: gondola, pizzaStand: pizzaStand, vespa: vespa,
    blueDome: blueDome, amphora: amphora, statue: statue,
    fishBoat: fishBoat, greekWindmill: greekWindmill
  };

  /*
   * propWidth / propLayer 搬到 levelgen.js 了。
   *
   * 原因：levels.js 在產生關卡時就需要這些尺寸來擺裝飾，
   * 但它的載入順序在 sprites.js 之前。那是純資料、不含繪製，
   * 放在最早載入的 levelgen.js 比較合理。
   * 這裡轉接一下，讓既有的 Sprites.propWidth 用法繼續有效。
   */
  const propWidth = LevelGen.PROP_WIDTH;
  const propLayer = LevelGen.PROP_LAYER;

  // ── 裝備圖示（畫在 32x32 的格子內，中心為原點） ──────────────

  function iconBeret(ctx, s) {
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.ellipse(0, 2 * s, 12 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#962d22';
    ctx.fillRect(6 * s, -3 * s, 5 * s, 3 * s);
    ctx.fillStyle = '#8c2a20';
    ctx.beginPath(); ctx.ellipse(0, 3 * s, 12 * s, 3 * s, 0, 0, Math.PI); ctx.fill();
  }

  function iconClogs(ctx, s) {
    ctx.fillStyle = '#e8b45a';
    [-7, 7].forEach(function (dx) {
      ctx.beginPath();
      ctx.moveTo(dx * s - 5 * s, 6 * s);
      ctx.lineTo(dx * s + 5 * s, 6 * s);
      ctx.lineTo(dx * s + 5 * s, -2 * s);
      ctx.quadraticCurveTo(dx * s, -10 * s, dx * s - 5 * s, -1 * s);
      ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle = '#1f6fb5';
    [-7, 7].forEach(function (dx) {
      ctx.fillRect(dx * s - 3 * s, 0, 6 * s, 2 * s);
    });
  }

  function iconStein(ctx, s) {
    // 啤酒杯
    ctx.fillStyle = '#e8e4da';
    U.roundRect(ctx, -8 * s, -9 * s, 14 * s, 19 * s, 2 * s);
    ctx.fill();
    ctx.fillStyle = '#e0a94b';
    U.roundRect(ctx, -6 * s, -3 * s, 10 * s, 11 * s, 1.5 * s);
    ctx.fill();
    ctx.fillStyle = '#fbf7ee';
    U.roundRect(ctx, -8 * s, -12 * s, 14 * s, 5 * s, 2 * s);
    ctx.fill();
    // 把手
    ctx.strokeStyle = '#d8d2c6';
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.arc(8 * s, 0, 5 * s, Math.PI * 1.5, Math.PI * 0.5);
    ctx.stroke();
  }

  function iconRope(ctx, s) {
    ctx.strokeStyle = '#b8863c';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.arc(0, 0, 9 * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#8a6128';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(0, 0, 5 * s, 0, Math.PI * 2);
    ctx.stroke();
    // 掛鉤
    ctx.strokeStyle = '#9aa7b8';
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.arc(7 * s, -8 * s, 4 * s, Math.PI * 0.2, Math.PI * 1.6);
    ctx.stroke();
  }

  function iconSandals(ctx, s) {
    ctx.fillStyle = '#9d6b3c';
    [-7, 7].forEach(function (dx) {
      U.roundRect(ctx, dx * s - 4.5 * s, -9 * s, 9 * s, 18 * s, 4 * s);
      ctx.fill();
    });
    ctx.strokeStyle = '#d8b468';
    ctx.lineWidth = 2 * s;
    [-7, 7].forEach(function (dx) {
      ctx.beginPath();
      ctx.moveTo(dx * s - 4 * s, -3 * s); ctx.lineTo(dx * s + 4 * s, -3 * s);
      ctx.moveTo(dx * s - 4 * s, 2 * s);  ctx.lineTo(dx * s + 4 * s, 2 * s);
      ctx.stroke();
    });
  }

  function iconLaurel(ctx, s) {
    ctx.strokeStyle = '#5f8f4e';
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.arc(0, 1 * s, 10 * s, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    ctx.fillStyle = '#6f9f5a';
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.18 + i * (Math.PI * 0.64 / 6);
      const lx = Math.cos(a) * 10 * s, ly = Math.sin(a) * 10 * s + 1 * s;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath(); ctx.ellipse(0, 0, 2.2 * s, 4.5 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#e0a94b';
    ctx.beginPath(); ctx.arc(0, 12 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
  }

  // ── 商店強化圖示 ──────────────────────────────────────────────
  // 跟裝備圖示同一套畫法（32x32 格、中心原點），但商店是「數值強化」，
  // 所以用抽象符號（愛心、磁鐵⋯⋯）而不是國家特色物件。

  function iconHeart(ctx, s) {
    ctx.fillStyle = '#e0526b';
    ctx.beginPath();
    ctx.moveTo(0, 9 * s);
    ctx.bezierCurveTo(-13 * s, -1 * s, -8 * s, -11 * s, 0, -4 * s);
    ctx.bezierCurveTo(8 * s, -11 * s, 13 * s, -1 * s, 0, 9 * s);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(-4.5 * s, -3 * s, 2.4 * s, 3.4 * s, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function iconMagnet(ctx, s) {
    // U 形磁鐵，兩極塗紅/藍
    ctx.strokeStyle = '#b9c6e2';
    ctx.lineWidth = 5 * s;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.arc(0, -1 * s, 7.5 * s, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-7.5 * s, -1 * s); ctx.lineTo(-7.5 * s, 6 * s);
    ctx.moveTo(7.5 * s, -1 * s);  ctx.lineTo(7.5 * s, 6 * s);
    ctx.stroke();
    ctx.lineWidth = 5 * s;
    ctx.strokeStyle = '#e0526b';
    ctx.beginPath(); ctx.moveTo(-7.5 * s, 5 * s); ctx.lineTo(-7.5 * s, 10 * s); ctx.stroke();
    ctx.strokeStyle = '#4b8fd6';
    ctx.beginPath(); ctx.moveTo(7.5 * s, 5 * s); ctx.lineTo(7.5 * s, 10 * s); ctx.stroke();
    // 吸力線
    ctx.strokeStyle = 'rgba(255,209,102,0.85)';
    ctx.lineWidth = 1.4 * s;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(0, -1 * s, (11 + i * 3.5) * s, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  }

  function iconReach(ctx, s) {
    // 揮擊弧線 + 拐杖
    ctx.strokeStyle = '#b8863c';
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6 * s, 10 * s); ctx.lineTo(2 * s, -6 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(5 * s, -7 * s, 4 * s, Math.PI * 0.9, Math.PI * 2.1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,180,0.9)';
    ctx.lineWidth = 2.2 * s;
    [8, 12].forEach(function (r, i) {
      ctx.beginPath();
      ctx.arc(-2 * s, 2 * s, r * s, Math.PI * 1.75, Math.PI * 2.45);
      ctx.stroke();
    });
    ctx.lineCap = 'butt';
  }

  function iconShield(ctx, s) {
    ctx.fillStyle = '#4b8fd6';
    ctx.beginPath();
    ctx.moveTo(0, -11 * s);
    ctx.lineTo(9 * s, -7 * s);
    ctx.lineTo(9 * s, 2 * s);
    ctx.quadraticCurveTo(9 * s, 9 * s, 0, 12 * s);
    ctx.quadraticCurveTo(-9 * s, 9 * s, -9 * s, 2 * s);
    ctx.lineTo(-9 * s, -7 * s);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8eef9';
    ctx.beginPath();
    ctx.moveTo(0, -7 * s);
    ctx.lineTo(5.5 * s, -4.5 * s);
    ctx.lineTo(5.5 * s, 1.5 * s);
    ctx.quadraticCurveTo(5.5 * s, 6 * s, 0, 8 * s);
    ctx.quadraticCurveTo(-5.5 * s, 6 * s, -5.5 * s, 1.5 * s);
    ctx.lineTo(-5.5 * s, -4.5 * s);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e0a94b';
    ctx.beginPath(); ctx.arc(0, 0, 2.6 * s, 0, Math.PI * 2); ctx.fill();
  }

  function iconBoots(ctx, s) {
    // 靴子 + 底下彈簧
    ctx.fillStyle = '#5b4a7a';
    ctx.beginPath();
    ctx.moveTo(-4 * s, -11 * s);
    ctx.lineTo(4 * s, -11 * s);
    ctx.lineTo(4 * s, 0);
    ctx.lineTo(10 * s, 0);
    ctx.lineTo(10 * s, 4 * s);
    ctx.lineTo(-4 * s, 4 * s);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8f7cc0';
    ctx.fillRect(-4 * s, -9 * s, 8 * s, 2.4 * s);
    ctx.strokeStyle = '#b9c6e2';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(-4 * s, (5 + i * 2.6) * s);
      ctx.lineTo(10 * s, (6.3 + i * 2.6) * s);
    }
    ctx.stroke();
  }

  function iconLuck(ctx, s) {
    // 四葉草徽章
    ctx.fillStyle = '#e0a94b';
    ctx.beginPath(); ctx.arc(0, 0, 11 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f3d89a';
    ctx.beginPath(); ctx.arc(0, 0, 8.6 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4f8f46';
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, -4.2 * s, 2.7 * s, 4.2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#3c6f36';
    ctx.beginPath(); ctx.arc(0, 0, 1.6 * s, 0, Math.PI * 2); ctx.fill();
  }

  const icons = {
    beret: iconBeret, clogs: iconClogs, stein: iconStein,
    rope: iconRope, sandals: iconSandals, laurel: iconLaurel,
    heart: iconHeart, magnet: iconMagnet, reach: iconReach,
    shield: iconShield, boots: iconBoots, luck: iconLuck
  };

  // v1.31 葡萄牙商店新增的三樣
  /** 軟木救生圈：紅白相間的圈圈 */
  icons.cork = function (ctx, s) {
    for (let k = 0; k < 4; k++) {
      ctx.strokeStyle = k % 2 ? '#f4f0e6' : '#d8303a'; ctx.lineWidth = 7 * s;
      ctx.beginPath(); ctx.arc(0, 0, 11 * s, k * Math.PI / 2, (k + 1) * Math.PI / 2); ctx.stroke();
    }
    ctx.strokeStyle = '#c8a070'; ctx.lineWidth = 1.4 * s;
    ctx.beginPath(); ctx.arc(0, 0, 15 * s, -0.4, 0.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 15 * s, Math.PI - 0.4, Math.PI + 0.4); ctx.stroke();
  };
  /** 卡拉維爾大船艙：疊起來的兩個木箱＋一個桶子 */
  icons.hold = function (ctx, s) {
    ctx.fillStyle = '#a8743a'; ctx.fillRect(-15 * s, -2 * s, 14 * s, 14 * s); ctx.fillRect(-10 * s, -15 * s, 13 * s, 13 * s);
    ctx.strokeStyle = '#6a4420'; ctx.lineWidth = 1.2 * s;
    ctx.strokeRect(-15 * s, -2 * s, 14 * s, 14 * s); ctx.strokeRect(-10 * s, -15 * s, 13 * s, 13 * s);
    ctx.beginPath(); ctx.moveTo(-15 * s, -2 * s); ctx.lineTo(-1 * s, 12 * s); ctx.moveTo(-10 * s, -15 * s); ctx.lineTo(3 * s, -2 * s); ctx.stroke();
    ctx.fillStyle = '#8a5a2a';
    ctx.beginPath(); ctx.ellipse(9 * s, 4 * s, 6.5 * s, 8.5 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a4a50'; ctx.fillRect(2.6 * s, -1 * s, 12.8 * s, 1.8 * s); ctx.fillRect(2.6 * s, 8 * s, 12.8 * s, 1.8 * s);
  };
  /** 航海家的星盤：黃銅圓環＋刻度＋中間的指針 */
  icons.astrolabe = function (ctx, s) {
    ctx.fillStyle = '#d8a83a';
    ctx.beginPath(); ctx.arc(0, -14 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d8a83a'; ctx.lineWidth = 3.4 * s;
    ctx.beginPath(); ctx.arc(0, 1 * s, 12 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#8a6420'; ctx.lineWidth = 1 * s;
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8 * s, 1 * s + Math.sin(a) * 8 * s); ctx.lineTo(Math.cos(a) * 10 * s, 1 * s + Math.sin(a) * 10 * s); ctx.stroke();
    }
    ctx.strokeStyle = '#f2d27a'; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(-9 * s, 7 * s); ctx.lineTo(9 * s, -5 * s); ctx.stroke();
    ctx.fillStyle = '#f2d27a'; ctx.beginPath(); ctx.arc(0, 1 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
  };

  /**
   * 畫任意圖示（x,y 為中心）。
   * equipIcon 要先查 Equipment 定義才拿得到 icon 名稱，
   * 商店的商品自己就帶 icon 名稱，所以另開一個直接吃名稱的入口。
   */
  function icon(ctx, name, x, y, scale) {
    const fn = icons[name];
    if (!fn) return false;
    ctx.save();
    ctx.translate(x, y);
    fn(ctx, scale == null ? 1 : scale);
    ctx.restore();
    return true;
  }

  /** 畫裝備圖示（x,y 為中心） */
  function equipIcon(ctx, id, x, y, scale) {
    const d = Equipment.get(id) || (typeof Souvenirs !== 'undefined' && Souvenirs.get(id));   // v1.31 美洲篇的紀念品走同一條路
    if (!d) return;
    const fn = icons[d.icon];
    if (!fn) return;
    ctx.save();
    ctx.translate(x, y);
    fn(ctx, scale == null ? 1 : scale);
    ctx.restore();
  }

  /** 關卡中待拾取的裝備：發光底座 + 浮動圖示 */
  function equipPickup(ctx, x, y, id, t) {
    const bob = Math.sin(t * 0.06) * 5;
    ctx.save();
    // 光暈
    const g = ctx.createRadialGradient(x, y + bob, 2, x, y + bob, 34);
    g.addColorStop(0, 'rgba(255, 220, 130, 0.55)');
    g.addColorStop(1, 'rgba(255, 220, 130, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y + bob, 34, 0, Math.PI * 2); ctx.fill();
    // 旋轉星芒
    ctx.strokeStyle = 'rgba(255, 236, 180, 0.8)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = t * 0.03 + i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 20, y + bob + Math.sin(a) * 20);
      ctx.lineTo(x + Math.cos(a) * 27, y + bob + Math.sin(a) * 27);
      ctx.stroke();
    }
    equipIcon(ctx, id, x, y + bob, 1);
    ctx.restore();
  }

  // ── 前景植物 ────────────────────────────────────────────────

  function tree(ctx, x, y, s) {
    ctx.fillStyle = '#5b4232';
    ctx.fillRect(x - 4 * s, y - 28 * s, 8 * s, 28 * s);
    ctx.fillStyle = '#3f7a3a';
    ctx.beginPath(); ctx.arc(x, y - 44 * s, 22 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4b8c42';
    ctx.beginPath(); ctx.arc(x - 8 * s, y - 50 * s, 15 * s, 0, Math.PI * 2); ctx.fill();
  }

  function pine(ctx, x, y, s) {
    ctx.fillStyle = '#4a3527';
    ctx.fillRect(x - 3 * s, y - 20 * s, 6 * s, 20 * s);
    ctx.fillStyle = '#2f5f3c';
    for (let i = 0; i < 3; i++) {
      const yy = y - 20 * s - i * 18 * s;
      const half = (24 - i * 6) * s;
      ctx.beginPath();
      ctx.moveTo(x - half, yy); ctx.lineTo(x + half, yy); ctx.lineTo(x, yy - 26 * s);
      ctx.closePath(); ctx.fill();
    }
  }

  function cypress(ctx, x, y, s) {
    ctx.fillStyle = '#3a5f33';
    ctx.beginPath();
    ctx.ellipse(x, y - 38 * s, 11 * s, 40 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a3527';
    ctx.fillRect(x - 3 * s, y - 6 * s, 6 * s, 6 * s);
  }

  function olive(ctx, x, y, s) {
    ctx.fillStyle = '#6b5744';
    ctx.fillRect(x - 4 * s, y - 24 * s, 8 * s, 24 * s);
    ctx.fillStyle = '#6f8f5a';
    [[-12, -34, 14], [10, -36, 13], [0, -46, 15]].forEach(function (p) {
      ctx.beginPath();
      ctx.arc(x + p[0] * s, y + p[1] * s, p[2] * s, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function tulip(ctx, x, y, s) {
    ctx.strokeStyle = '#3f7a3a';
    ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 24 * s); ctx.stroke();
    ctx.fillStyle = '#d6435a';
    ctx.beginPath();
    ctx.moveTo(x - 7 * s, y - 24 * s);
    ctx.lineTo(x - 7 * s, y - 34 * s);
    ctx.quadraticCurveTo(x, y - 44 * s, x + 7 * s, y - 34 * s);
    ctx.lineTo(x + 7 * s, y - 24 * s);
    ctx.closePath(); ctx.fill();
  }

  /** 椰棗樹（摩洛哥）：微彎的高樹幹 + 一叢往下垂的羽狀葉 + 一串椰棗 */
  function palm(ctx, x, y, s) {
    ctx.strokeStyle = '#7a5838';
    ctx.lineWidth = 6 * s;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 6 * s, y - 34 * s, x + 2 * s, y - 64 * s); ctx.stroke();
    // 樹幹的環紋
    ctx.strokeStyle = 'rgba(60, 40, 24, 0.5)';
    ctx.lineWidth = 1.2 * s;
    for (let i = 1; i < 6; i++) {
      const yy = y - i * 11 * s, xx = x + Math.sin(i / 6 * Math.PI) * 5 * s;
      ctx.beginPath(); ctx.moveTo(xx - 3 * s, yy); ctx.lineTo(xx + 3 * s, yy - 1 * s); ctx.stroke();
    }
    // 葉子：從頂端往外垂的弧線
    ctx.strokeStyle = '#4a7a34';
    ctx.lineWidth = 4 * s;
    const tx = x + 2 * s, ty = y - 64 * s;
    [[-34, 4], [-22, -12], [0, -18], [22, -12], [34, 4], [-14, 10], [14, 10]].forEach(function (d) {
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + d[0] * 0.6 * s, ty + (d[1] - 14) * s, tx + d[0] * s, ty + (d[1] + 8) * s);
      ctx.stroke();
    });
    ctx.fillStyle = '#a0522d';
    ctx.beginPath(); ctx.arc(tx - 4 * s, ty + 6 * s, 3 * s, 0, Math.PI * 2); ctx.arc(tx + 3 * s, ty + 7 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
  }

  const decos = { tree: tree, pine: pine, cypress: cypress, olive: olive, tulip: tulip, palm: palm };

  // ── 角色 ──────────────────────────────────────────────────

  /**
   * 玩家：小旅人。會依身上裝備改變外觀。
   *
   * p.pid 是玩家編號（0 = P1、1 = P2）。兩人同機時外觀必須明顯不同，
   * 否則兩個人在混亂的畫面上根本分不出哪個是自己 ——
   * 這是「兩人同機」能不能玩的關鍵，不是裝飾。
   * 作法：換條紋衫的顏色 + 頭上加一個顏色標記。
   */
  function player(ctx, p, t) {
    const x = p.x, y = p.y, w = p.w, h = p.h;
    const eq = p.equipped || {};
    const pid = p.pid || 0;
    // P1 藍白條紋（原本的樣子）、P2 紅白條紋
    const shirt = pid === 1 ? '#c0392b' : '#2f54a0';
    const markColor = pid === 1 ? '#ff8a6b' : '#7fc4f5';
    ctx.save();

    if (p.invuln > 0 && Math.floor(p.invuln / 5) % 2 === 0) ctx.globalAlpha = 0.45;

    const cx = x + w / 2;
    const dir = p.facing;
    const walking = p.onGround && Math.abs(p.vx) > 0.4;
    const swing = walking ? Math.sin(t * 0.35) * 5 : 0;

    const costume = p.costume || null;
    // 時裝：背後的部分（披風）要最先畫，才會在身體後面
    if (costume) costumeBack(ctx, costume, cx, y, dir, t);

    // 登山繩（背在背上）
    if (eq.rope) {
      ctx.strokeStyle = '#b8863c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx - dir * 10, y + 20, 7, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#8a5a3c';
      ctx.fillRect(cx - dir * 11, y + 14, 9, 14);
    }

    // 腿
    ctx.fillStyle = '#3a4a7a';
    ctx.fillRect(cx - 8, y + h - 14, 6, 14 - Math.max(0, swing));
    ctx.fillRect(cx + 2, y + h - 14, 6, 14 + Math.min(0, swing));

    // 鞋：木鞋 / 涼鞋 / 普通
    if (eq.clogs) {
      ctx.fillStyle = '#e8b45a';
      ctx.fillRect(cx - 10, y + h - 5, 9, 5);
      ctx.fillRect(cx + 1, y + h - 5, 9, 5);
    } else if (eq.sandals) {
      ctx.fillStyle = '#9d6b3c';
      ctx.fillRect(cx - 9, y + h - 4, 8, 4);
      ctx.fillRect(cx + 1, y + h - 4, 8, 4);
      ctx.fillStyle = '#d8b468';
      ctx.fillRect(cx - 9, y + h - 7, 8, 2);
      ctx.fillRect(cx + 1, y + h - 7, 8, 2);
    } else {
      ctx.fillStyle = '#2a2a33';
      ctx.fillRect(cx - 9, y + h - 4, 8, 4);
      ctx.fillRect(cx + 1, y + h - 4, 8, 4);
    }

    // 身體（條紋衫）—— 顏色依玩家編號
    ctx.fillStyle = '#eef1f7';
    ctx.fillRect(cx - 9, y + 12, 18, 20);
    ctx.fillStyle = shirt;
    for (let i = 0; i < 3; i++) ctx.fillRect(cx - 9, y + 15 + i * 6, 18, 3);
    // 時裝的衣服蓋在條紋衫上
    if (costume) costumeBody(ctx, costume, cx, y, dir, t, h, walking);

    // 手
    ctx.fillStyle = '#f0c49a';
    ctx.fillRect(cx + dir * 9 - 2, y + 16 + (walking ? -swing : 0), 5, 11);

    // 啤酒杯（持在手上）
    if (eq.stein) {
      ctx.save();
      ctx.translate(cx + dir * 13, y + 20);
      ctx.scale(dir, 1);
      ctx.fillStyle = '#e8e4da';
      U.roundRect(ctx, -4, -6, 9, 13, 2); ctx.fill();
      ctx.fillStyle = '#e0a94b';
      U.roundRect(ctx, -2.5, -2, 6, 8, 1); ctx.fill();
      ctx.fillStyle = '#fbf7ee';
      U.roundRect(ctx, -4, -8, 9, 3, 1.5); ctx.fill();
      ctx.restore();
    }

    // 頭
    ctx.fillStyle = '#f5cda6';
    U.roundRect(ctx, cx - 8, y, 16, 14, 4);
    ctx.fill();

    // 頭飾：穿時裝時用時裝的帽子（不疊貝雷帽／月桂冠，疊在一起看不出是什麼）
    if (costume) {
      costumeHat(ctx, costume, cx, y, dir, t);
    } else
    // 頭飾：月桂冠優先於貝雷帽（兩個都有就戴月桂冠，貝雷帽縮小墊在下面）
    if (eq.beret) {
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.ellipse(cx, y, 11, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#962d22';
      ctx.fillRect(cx + dir * 6, y - 3, 4, 3);
    }
    if (eq.laurel && !costume) {
      ctx.strokeStyle = '#5f8f4e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, y + 2, 10, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.fillStyle = '#6f9f5a';
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * 1.15 + i * (Math.PI * 0.7 / 4);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 10, y + 2 + Math.sin(a) * 10, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 眼睛
    ctx.fillStyle = '#2a2a33';
    ctx.fillRect(cx + dir * 2 - 1, y + 8, 2, 3);
    ctx.fillRect(cx + dir * 6 - 1, y + 8, 2, 3);

    /*
     * 兩人同機的頭頂標記。
     *
     * 只在 pid 有傳進來時畫（單人模式不畫，避免多一個莫名的小三角）。
     * 衣服顏色在混亂場面中可能被裝備或特效蓋住，頭頂標記是最可靠的辨識。
     */
    if (p.pid != null) {
      const bob = Math.sin(t * 0.12 + pid * 2) * 1.5;
      ctx.fillStyle = markColor;
      ctx.beginPath();
      ctx.moveTo(cx, y - 7 + bob);
      ctx.lineTo(cx - 5, y - 14 + bob);
      ctx.lineTo(cx + 5, y - 14 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(12,18,30,0.65)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  // ── 時裝（稀有怪掉落，見 costumes.js）────────────────────────

  function costumeBack(ctx, c, cx, y, dir, t) {
    if (c === 'athena') {
      // （v1.31.3 玩家：人魚時裝拿掉 → 只留雅典娜）    } else if (c === 'athena') {
      // 雅典娜（v1.31.2 玩家：波賽頓是男生不適合當時裝 → 雅典娜女神）：背上一面金色圓盾、一支長矛；栗色長髮披在背後
      ctx.fillStyle = '#7a4a2a';
      ctx.beginPath(); ctx.moveTo(cx - 9, y + 4); ctx.quadraticCurveTo(cx - dir * 14, y + 18, cx - dir * 8, y + 28); ctx.lineTo(cx + dir * 4, y + 22); ctx.lineTo(cx + 9, y + 4); ctx.closePath(); ctx.fill();
      const tx = cx - dir * 12;
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tx, y + 40); ctx.lineTo(tx, y - 12); ctx.stroke();
      ctx.fillStyle = '#d8dce4';
      ctx.beginPath(); ctx.moveTo(tx, y - 20); ctx.lineTo(tx - 3, y - 11); ctx.lineTo(tx + 3, y - 11); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8b830';
      ctx.beginPath(); ctx.arc(cx - dir * 8, y + 22, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#a8761a'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = '#a8761a'; ctx.beginPath(); ctx.arc(cx - dir * 8, y + 22, 3, 0, Math.PI * 2); ctx.fill();
    } else if (c === 'royal') {
      const sw = Math.sin(t * 0.08) * 2;
      ctx.fillStyle = '#5a2a8a';
      ctx.beginPath();
      ctx.moveTo(cx - 8, y + 13); ctx.lineTo(cx + 8, y + 13);
      ctx.lineTo(cx - dir * 6 + 10 + sw, y + 38); ctx.lineTo(cx - dir * 6 - 14 + sw, y + 38);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f4efe2';
      ctx.fillRect(cx - 9, y + 12, 18, 3);
    }
  }

  function costumeBody(ctx, c, cx, y, dir, t, h, walking) {
    h = h || 40;
    if (c === 'captain') {
      ctx.fillStyle = '#a8242a'; ctx.fillRect(cx - 10, y + 12, 20, 22);
      ctx.fillStyle = '#e8c060';
      for (let i = 0; i < 3; i++) ctx.fillRect(cx - 1, y + 15 + i * 6, 2, 2);
      ctx.fillStyle = '#2a1a14'; ctx.fillRect(cx - 10, y + 26, 20, 3);
    } else if (c === 'matador') {
      ctx.fillStyle = '#1a1a24'; ctx.fillRect(cx - 9, y + 12, 18, 14);
      ctx.fillStyle = '#e8c060';
      ctx.fillRect(cx - 9, y + 12, 3, 14); ctx.fillRect(cx + 6, y + 12, 3, 14);
      ctx.fillRect(cx - 9, y + 24, 18, 2);
      ctx.fillStyle = '#c0242a'; ctx.fillRect(cx - 3, y + 14, 6, 4);
      ctx.fillStyle = '#e04a8a'; ctx.fillRect(cx - 9, y + 26, 18, 6);
    } else if (c === 'viking') {
      ctx.fillStyle = '#7a5a3a'; ctx.fillRect(cx - 9, y + 12, 18, 20);
      ctx.fillStyle = '#c8b090';
      for (let i = 0; i < 5; i++) ctx.fillRect(cx - 10 + i * 4, y + 12, 3, 5);
      ctx.fillStyle = '#4a3a2a'; ctx.fillRect(cx - 9, y + 26, 18, 3);
      ctx.fillStyle = '#c0c8d0'; ctx.fillRect(cx - 2, y + 26, 4, 3);
    } else if (c === 'harlequin') {
      const cols = ['#c0242a', '#2a8a4a', '#e8c040', '#2a54a0'];
      for (let r = 0; r < 4; r++) {
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = cols[(r + k) % 4];
          ctx.beginPath();
          const x0 = cx - 9 + k * 6, y0 = y + 12 + r * 5;
          ctx.moveTo(x0 + 3, y0); ctx.lineTo(x0 + 6, y0 + 2.5); ctx.lineTo(x0 + 3, y0 + 5); ctx.lineTo(x0, y0 + 2.5);
          ctx.fill();
        }
      }
      ctx.fillStyle = '#f4efe2'; ctx.fillRect(cx - 9, y + 11, 18, 2);
    } else if (c === 'royal') {
      ctx.fillStyle = '#f4efe2'; ctx.fillRect(cx - 9, y + 12, 18, 20);
      ctx.fillStyle = '#e8c060'; ctx.fillRect(cx - 9, y + 24, 18, 3);
      ctx.fillStyle = '#c0242a'; ctx.fillRect(cx + dir * 3 - 2, y + 15, 4, 4);
    } else if (c === 'pharaoh') {
      // 法老（v1.30 金字塔探險）：白色亞麻裙＋金藍寬領圈
      ctx.fillStyle = '#c8946a'; ctx.fillRect(cx - 8, y + 12, 16, 10);
      ctx.fillStyle = '#f4efe2'; ctx.fillRect(cx - 9, y + 22, 18, 10);
      ctx.fillStyle = '#e8b830'; ctx.fillRect(cx - 10, y + 12, 20, 4);
      ctx.fillStyle = '#2a50a0'; ctx.fillRect(cx - 10, y + 15, 20, 2);
      ctx.fillStyle = '#e8b830'; ctx.fillRect(cx - 9, y + 22, 18, 2);
    } else if (c === 'athena') {
      // 雅典娜：白色長袍（裙擺到腳踝）、斜披一條藍色披肩、金色腰帶，裙擺一圈希臘回紋
      ctx.fillStyle = '#f8f4ea';
      ctx.beginPath(); ctx.moveTo(cx - 9, y + 12); ctx.lineTo(cx + 9, y + 12); ctx.lineTo(cx + 11, y + h - 4); ctx.lineTo(cx - 11, y + h - 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a6ab8';
      ctx.beginPath(); ctx.moveTo(cx - dir * 9, y + 12); ctx.lineTo(cx - dir * 3, y + 12); ctx.lineTo(cx + dir * 9, y + 26); ctx.lineTo(cx + dir * 9, y + 31); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8b830'; ctx.fillRect(cx - 9, y + 22, 18, 2.4);
      ctx.fillStyle = '#c89820';
      for (let k = 0; k < 5; k++) { ctx.fillRect(cx - 10 + k * 4.4, y + h - 7, 3, 1.2); ctx.fillRect(cx - 10 + k * 4.4 + 2, y + h - 7, 1, 2.6); }
    } else if (c === 'golden') {
      const g = ctx.createLinearGradient(cx - 9, y + 12, cx + 9, y + 32);
      g.addColorStop(0, '#fff4b0'); g.addColorStop(0.5, '#f2c14e'); g.addColorStop(1, '#c8862a');
      ctx.fillStyle = g; ctx.fillRect(cx - 9, y + 12, 18, 20);
      // 閃光
      const k = (t % 90) / 90;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(cx - 9 + k * 18, y + 12, 2, 20);
    }
  }

  function costumeHat(ctx, c, cx, y, dir, t) {
    if (c === 'captain') {
      ctx.fillStyle = '#1a1a20';
      ctx.beginPath(); ctx.moveTo(cx - 13, y + 2); ctx.lineTo(cx, y - 9); ctx.lineTo(cx + 13, y + 2); ctx.lineTo(cx, y - 1); ctx.fill();
      ctx.fillStyle = '#e8c060'; ctx.fillRect(cx - 12, y + 1, 24, 2);
      ctx.fillStyle = '#f4efe2'; ctx.beginPath(); ctx.arc(cx, y - 3, 2, 0, Math.PI * 2); ctx.fill();
    } else if (c === 'matador') {
      ctx.fillStyle = '#1a1a24';
      ctx.beginPath(); ctx.ellipse(cx - 5, y - 1, 6, 4, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 5, y - 1, 6, 4, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - 8, y - 1, 16, 4);
    } else if (c === 'viking') {
      ctx.fillStyle = '#a0a8b4';
      ctx.beginPath(); ctx.arc(cx, y + 3, 9, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#f0e8d0';
      [-1, 1].forEach(function (s) {
        ctx.beginPath(); ctx.moveTo(cx + s * 7, y); ctx.quadraticCurveTo(cx + s * 16, y - 2, cx + s * 15, y - 12); ctx.lineTo(cx + s * 9, y - 3); ctx.fill();
      });
    } else if (c === 'harlequin') {
      [-1, 1].forEach(function (s, i) {
        ctx.fillStyle = i ? '#2a8a4a' : '#c0242a';
        ctx.beginPath(); ctx.moveTo(cx, y + 2); ctx.quadraticCurveTo(cx + s * 8, y - 12, cx + s * 14, y - 4); ctx.lineTo(cx + s * 6, y + 3); ctx.fill();
        ctx.fillStyle = '#e8c040';
        ctx.beginPath(); ctx.arc(cx + s * 14, y - 4 + Math.sin(t * 0.2 + i) * 1.5, 2.4, 0, Math.PI * 2); ctx.fill();
      });
    } else if (c === 'pharaoh') {
      // 法老頭巾 nemes：金藍條紋，兩邊垂到肩膀，額頭一條眼鏡蛇
      ctx.fillStyle = '#e8b830';
      ctx.beginPath(); ctx.moveTo(cx - 10, y + 3); ctx.quadraticCurveTo(cx, y - 10, cx + 10, y + 3);
      ctx.lineTo(cx + 11, y + 14); ctx.lineTo(cx + 7, y + 14); ctx.lineTo(cx + 6, y + 4); ctx.lineTo(cx - 6, y + 4);
      ctx.lineTo(cx - 7, y + 14); ctx.lineTo(cx - 11, y + 14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a50a0';
      ctx.fillRect(cx - 9, y - 1, 18, 2); ctx.fillRect(cx - 11, y + 7, 4, 2); ctx.fillRect(cx + 7, y + 7, 4, 2);
      ctx.fillStyle = '#c8202a'; ctx.fillRect(cx + dir * 1 - 1, y - 6, 2, 4);
    } else if (c === 'athena') {
      // 雅典娜：金色的科林斯頭盔（推到額頭上，露出臉）＋一道紅色馬鬃羽冠；兩邊垂下栗色長髮
      ctx.fillStyle = '#7a4a2a';
      ctx.fillRect(cx - 10, y + 2, 4, 12); ctx.fillRect(cx + 6, y + 2, 4, 12);
      ctx.fillStyle = '#e8b830';
      ctx.beginPath(); ctx.arc(cx, y + 4, 10, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillRect(cx - 10, y + 2, 20, 3);
      ctx.fillStyle = '#a8761a'; ctx.fillRect(cx - 10, y + 4, 20, 1.2);
      ctx.fillStyle = '#c8202a';
      ctx.beginPath(); ctx.moveTo(cx + dir * 7, y - 4);
      ctx.quadraticCurveTo(cx, y - 16, cx - dir * 12, y - 6); ctx.quadraticCurveTo(cx - dir * 8, y - 3, cx - dir * 8, y + 2);
      ctx.quadraticCurveTo(cx - dir * 2, y - 9, cx + dir * 7, y - 4); ctx.closePath(); ctx.fill();
    } else if (c === 'royal' || c === 'golden') {
      ctx.fillStyle = '#f2c14e';
      ctx.beginPath();
      ctx.moveTo(cx - 8, y + 1); ctx.lineTo(cx - 8, y - 6); ctx.lineTo(cx - 4, y - 2); ctx.lineTo(cx, y - 8);
      ctx.lineTo(cx + 4, y - 2); ctx.lineTo(cx + 8, y - 6); ctx.lineTo(cx + 8, y + 1);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c0242a'; ctx.beginPath(); ctx.arc(cx, y - 2, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** 走路敵人：鴿子 */
  function walker(ctx, e, t) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    ctx.save();
    if (e.squash > 0) {
      ctx.translate(cx, by);
      ctx.scale(1.3, 0.35);
      ctx.translate(-cx, -by);
    }
    ctx.fillStyle = '#6f7a93';
    ctx.beginPath();
    ctx.ellipse(cx, e.y + e.h * 0.62, e.w * 0.46, e.h * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#58637c';
    const flap = Math.sin(t * 0.25) * 3;
    ctx.beginPath();
    ctx.ellipse(cx - e.dir * 4, e.y + e.h * 0.55 + flap, e.w * 0.3, e.h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7e8aa5';
    ctx.beginPath();
    ctx.arc(cx + e.dir * 8, e.y + e.h * 0.3, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e4a33b';
    ctx.beginPath();
    ctx.moveTo(cx + e.dir * 14, e.y + e.h * 0.3);
    ctx.lineTo(cx + e.dir * 21, e.y + e.h * 0.34);
    ctx.lineTo(cx + e.dir * 14, e.y + e.h * 0.38);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#20232e';
    ctx.fillRect(cx + e.dir * 9, e.y + e.h * 0.24, 2, 2);
    ctx.strokeStyle = '#d2743a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 4, by - 4); ctx.lineTo(cx - 4, by);
    ctx.moveTo(cx + 4, by - 4); ctx.lineTo(cx + 4, by);
    ctx.stroke();
    ctx.restore();
  }

  /** 飛行敵人：海鷗 */
  function flyer(ctx, e, t) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    ctx.save();
    if (e.squash > 0) {
      ctx.translate(cx, cy);
      ctx.scale(1.3, 0.4);
      ctx.translate(-cx, -cy);
    }
    const flap = Math.sin(t * 0.3) * 8;
    ctx.fillStyle = '#f2f5fa';
    ctx.beginPath();
    ctx.ellipse(cx, cy, e.w * 0.32, e.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#dfe6f0';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 2);
    ctx.quadraticCurveTo(cx - 18, cy - 8 - flap, cx - 28, cy - 2 - flap);
    ctx.moveTo(cx + 4, cy - 2);
    ctx.quadraticCurveTo(cx + 18, cy - 8 - flap, cx + 28, cy - 2 - flap);
    ctx.stroke();
    ctx.fillStyle = '#f7fafd';
    ctx.beginPath(); ctx.arc(cx + e.dir * 10, cy - 4, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8a033';
    ctx.beginPath();
    ctx.moveTo(cx + e.dir * 15, cy - 4);
    ctx.lineTo(cx + e.dir * 22, cy - 1);
    ctx.lineTo(cx + e.dir * 15, cy);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#20232e';
    ctx.fillRect(cx + e.dir * 11, cy - 6, 2, 2);
    ctx.restore();
  }

  /** 衛兵：戴鋼盔的瑞士近衛兵，踩不死 */
  function guard(ctx, e, t) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    ctx.save();
    if (e.squash > 0) {
      ctx.translate(cx, by); ctx.scale(1.3, 0.35); ctx.translate(-cx, -by);
    }
    // 被踩彈開時整隻往下壓一點
    if (e.bump > 0) { ctx.translate(0, 2); }

    // 長戟
    ctx.strokeStyle = '#8a6a3c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + e.dir * 12, by - 2);
    ctx.lineTo(cx + e.dir * 12, e.y - 10);
    ctx.stroke();
    ctx.fillStyle = '#c8d0dc';
    ctx.beginPath();
    ctx.moveTo(cx + e.dir * 12, e.y - 10);
    ctx.lineTo(cx + e.dir * 19, e.y - 4);
    ctx.lineTo(cx + e.dir * 12, e.y - 1);
    ctx.closePath(); ctx.fill();

    // 條紋制服（梵蒂岡瑞士衛兵的黃藍配色）
    ctx.fillStyle = '#2f54a0';
    U.roundRect(ctx, cx - 11, e.y + 12, 22, e.h - 14, 3); ctx.fill();
    ctx.fillStyle = '#e0a94b';
    for (let i = 0; i < 3; i++) ctx.fillRect(cx - 11, e.y + 15 + i * 6, 22, 3);

    // 腳
    ctx.fillStyle = '#2a2a33';
    ctx.fillRect(cx - 8, by - 4, 7, 4);
    ctx.fillRect(cx + 1, by - 4, 7, 4);

    // 臉
    ctx.fillStyle = '#f0c49a';
    U.roundRect(ctx, cx - 7, e.y + 2, 14, 12, 3); ctx.fill();
    ctx.fillStyle = '#20232e';
    ctx.fillRect(cx + e.dir * 3 - 1, e.y + 7, 2, 2);

    // 鋼盔：寬帽簷 + 盔頂（視覺上明示「踩不下去」）
    ctx.fillStyle = '#b9c2d0';
    ctx.beginPath();
    ctx.ellipse(cx, e.y + 2, 14, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, e.y + 2, 8, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#8f99a9';
    ctx.fillRect(cx - 1.5, e.y - 7, 3, 7);
    ctx.restore();
  }

  /** 刺蝟：背上一排尖刺，踩不死 */
  function spiker(ctx, e, t) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    ctx.save();
    if (e.squash > 0) {
      ctx.translate(cx, by); ctx.scale(1.3, 0.35); ctx.translate(-cx, -by);
    }
    // 身體
    ctx.fillStyle = '#8a6a4a';
    ctx.beginPath();
    ctx.ellipse(cx, e.y + e.h * 0.62, e.w * 0.46, e.h * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    // 背刺
    ctx.fillStyle = '#4a4f5e';
    for (let i = 0; i < 5; i++) {
      const sx = cx - 11 + i * 5.5;
      ctx.beginPath();
      ctx.moveTo(sx - 2.5, e.y + 9);
      ctx.lineTo(sx, e.y - 3);
      ctx.lineTo(sx + 2.5, e.y + 9);
      ctx.closePath(); ctx.fill();
    }
    // 臉
    ctx.fillStyle = '#c49a72';
    ctx.beginPath();
    ctx.arc(cx + e.dir * 11, e.y + e.h * 0.6, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#20232e';
    ctx.fillRect(cx + e.dir * 12, e.y + e.h * 0.5, 2, 2);
    // 鼻
    ctx.fillStyle = '#5e4632';
    ctx.beginPath();
    ctx.arc(cx + e.dir * 17, e.y + e.h * 0.62, 2, 0, Math.PI * 2); ctx.fill();
    // 腳
    ctx.strokeStyle = '#5e4632';
    ctx.lineWidth = 2;
    const step = Math.sin(t * 0.4) * 2;
    ctx.beginPath();
    ctx.moveTo(cx - 5, by - 3); ctx.lineTo(cx - 5 + step, by);
    ctx.moveTo(cx + 5, by - 3); ctx.lineTo(cx + 5 - step, by);
    ctx.stroke();
    ctx.restore();
  }

  /** 蜜蜂：空中追兵 */
  function chaser(ctx, e, t) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    ctx.save();
    if (e.squash > 0) {
      ctx.translate(cx, cy); ctx.scale(1.3, 0.4); ctx.translate(-cx, -cy);
    }
    // 翅膀（高頻拍動）
    const fl = Math.sin(t * 0.9) * 5;
    ctx.fillStyle = 'rgba(226, 240, 255, 0.72)';
    ctx.beginPath();
    ctx.ellipse(cx - 5, cy - 9 - fl * 0.3, 8, 4.5, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 5, cy - 9 + fl * 0.3, 8, 4.5, 0.5, 0, Math.PI * 2); ctx.fill();
    // 身體黃黑條紋
    ctx.fillStyle = '#e8b43a';
    ctx.beginPath();
    ctx.ellipse(cx, cy, e.w * 0.42, e.h * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2a33';
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, e.w * 0.42, e.h * 0.4, 0, 0, Math.PI * 2);
    ctx.clip();
    for (let i = 0; i < 3; i++) ctx.fillRect(cx - 12 + i * 8, cy - 12, 4, 24);
    ctx.restore();
    // 螫針
    ctx.fillStyle = '#2a2a33';
    ctx.beginPath();
    ctx.moveTo(cx - e.dir * 11, cy);
    ctx.lineTo(cx - e.dir * 17, cy - 2);
    ctx.lineTo(cx - e.dir * 17, cy + 2);
    ctx.closePath(); ctx.fill();
    // 眼
    ctx.fillStyle = '#1b1e28';
    ctx.beginPath(); ctx.arc(cx + e.dir * 8, cy - 2, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** 砲台：噴泉石雕頭，會吐水彈 */
  function turret(ctx, e, t) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    ctx.save();
    if (e.squash > 0) {
      ctx.translate(cx, by); ctx.scale(1.3, 0.35); ctx.translate(-cx, -by);
    }
    // 基座
    ctx.fillStyle = '#9a9384';
    U.roundRect(ctx, cx - 14, by - 10, 28, 10, 2); ctx.fill();
    // 石頭臉
    ctx.fillStyle = '#b8b2a2';
    U.roundRect(ctx, cx - 13, e.y, 26, e.h - 9, 5); ctx.fill();
    // 蓄力時眼睛會亮
    const charging = e.cd != null && e.cd < 26;
    ctx.fillStyle = charging ? '#ff8a5c' : '#4a4f5e';
    ctx.beginPath(); ctx.arc(cx - 4, e.y + 9, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 4, e.y + 9, 2.6, 0, Math.PI * 2); ctx.fill();
    // 嘴（朝玩家）
    ctx.fillStyle = '#3a3f4c';
    U.roundRect(ctx, cx + (e.dir > 0 ? 4 : -12), e.y + 15, 8, 5, 2); ctx.fill();
    ctx.restore();
  }

  /** 公牛：會衝撞 */
  function charger(ctx, e, t) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    ctx.save();
    if (e.squash > 0) {
      ctx.translate(cx, by); ctx.scale(1.3, 0.35); ctx.translate(-cx, -by);
    }
    const stunned = e.stun > 0;
    // 衝刺時身體前傾
    if (e.charging) { ctx.translate(e.dir * 2, 1); }

    // 身體
    ctx.fillStyle = stunned ? '#6b6b73' : '#4a3a33';
    U.roundRect(ctx, cx - e.w * 0.44, e.y + 8, e.w * 0.88, e.h - 12, 7); ctx.fill();
    // 腿
    ctx.fillStyle = '#33281f';
    const gait = e.charging ? Math.sin(t * 0.8) * 3 : Math.sin(t * 0.3) * 2;
    ctx.fillRect(cx - 14, by - 6, 5, 6 + gait);
    ctx.fillRect(cx + 9, by - 6, 5, 6 - gait);
    // 頭
    ctx.fillStyle = stunned ? '#7a7a82' : '#574338';
    U.roundRect(ctx, cx + e.dir * 14 - 9, e.y + 10, 18, 16, 4); ctx.fill();
    // 牛角
    ctx.strokeStyle = '#e4ddc8';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + e.dir * 14 - 6, e.y + 11);
    ctx.quadraticCurveTo(cx + e.dir * 20, e.y + 4, cx + e.dir * 25, e.y + 9);
    ctx.stroke();
    // 眼：衝刺時變紅
    ctx.fillStyle = e.charging ? '#ff5a5a' : '#1b1e28';
    ctx.beginPath(); ctx.arc(cx + e.dir * 17, e.y + 16, 2.4, 0, Math.PI * 2); ctx.fill();
    // 鼻息（衝刺預告）
    if (e.charging) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(cx + e.dir * 28, e.y + 22 + Math.sin(t * 0.5) * 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // 暈眩星星（用圓點，Segoe UI 沒有星號字元）
    if (stunned) {
      ctx.fillStyle = '#ffd166';
      for (let i = 0; i < 3; i++) {
        const a = t * 0.12 + i * Math.PI * 2 / 3;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 14, e.y - 2 + Math.sin(a) * 5, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  const enemyKinds = {
    walker: walker, flyer: flyer, guard: guard,
    spiker: spiker, chaser: chaser, turret: turret, charger: charger
  };

  /**
   * 依型別分派。
   *
   * country（關卡 id）有專屬外型就用專屬的（見下面的 COUNTRY_ENEMIES）：
   * 行為、碰撞完全一樣，只換長相 —— 每一國的怪物看起來都是「那個地方的東西」。
   * flag 是該國國旗色，衛兵的制服會用它。
   */
  function enemy(ctx, e, t, country, flag) {
    const skin = COUNTRY_ENEMIES[country];
    const fn = skin && skin[e.type];
    if (fn) { fn(ctx, e, t); return; }
    if (e.type === 'guard' && flag) { guardColored(ctx, e, t, flag); return; }
    (enemyKinds[e.type] || walker)(ctx, e, t);
  }

  // ── 各國專屬怪物 ───────────────────────────────────────────

  /** 共用：被踩扁時的壓縮變形 */
  function squashed(ctx, e, cx, by) {
    if (e.squash > 0) { ctx.translate(cx, by); ctx.scale(1.3, 0.35); ctx.translate(-cx, -by); }
  }

  /** 衛兵換成該國國旗配色的制服 */
  function guardColored(ctx, e, t, flag) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    ctx.save();
    squashed(ctx, e, cx, by);
    if (e.bump > 0) ctx.translate(0, 2);
    ctx.strokeStyle = '#8a6a3c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx + e.dir * 12, by - 2); ctx.lineTo(cx + e.dir * 12, e.y - 10); ctx.stroke();
    ctx.fillStyle = '#c8d0dc';
    ctx.beginPath(); ctx.moveTo(cx + e.dir * 12, e.y - 10); ctx.lineTo(cx + e.dir * 19, e.y - 4); ctx.lineTo(cx + e.dir * 12, e.y - 1); ctx.fill();
    ctx.fillStyle = flag[0];
    U.roundRect(ctx, cx - 11, e.y + 12, 22, e.h - 14, 3); ctx.fill();
    ctx.fillStyle = flag[1]; ctx.fillRect(cx - 11, e.y + 18, 22, 4);
    ctx.fillStyle = flag[2] || flag[0]; ctx.fillRect(cx - 11, e.y + 24, 22, 4);
    ctx.fillStyle = '#2a2a33';
    ctx.fillRect(cx - 8, by - 4, 7, 4); ctx.fillRect(cx + 1, by - 4, 7, 4);
    ctx.fillStyle = '#f0c49a';
    U.roundRect(ctx, cx - 7, e.y + 2, 14, 12, 3); ctx.fill();
    ctx.fillStyle = '#20232e'; ctx.fillRect(cx + e.dir * 3 - 1, e.y + 7, 2, 2);
    ctx.fillStyle = '#b9c2d0';
    ctx.beginPath(); ctx.ellipse(cx, e.y + 2, 14, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, e.y + 2, 8, Math.PI, 0); ctx.fill();
    ctx.fillStyle = flag[2] || flag[0]; ctx.fillRect(cx - 1.5, e.y - 8, 3, 8);
    ctx.restore();
  }

  /** 四腳小動物的共用骨架：身體橢圓 + 頭 + 四條腿（各國換顏色與細節） */
  function quadruped(ctx, e, t, o) {
    const cx = e.x + e.w / 2, by = e.y + e.h;
    ctx.save();
    squashed(ctx, e, cx, by);
    const step = Math.sin(t * 0.35) * 2.5;
    ctx.fillStyle = o.leg || o.body;
    ctx.fillRect(cx - 10 + step, by - 7, 4, 7); ctx.fillRect(cx - 4 - step, by - 7, 4, 7);
    ctx.fillRect(cx + 4 + step, by - 7, 4, 7); ctx.fillRect(cx + 9 - step, by - 7, 4, 7);
    ctx.fillStyle = o.body;
    ctx.beginPath(); ctx.ellipse(cx, by - 13, o.bw || 14, o.bh || 8, 0, 0, Math.PI * 2); ctx.fill();
    const hx = cx + e.dir * (o.neck || 13), hy = by - 17;
    ctx.beginPath(); ctx.arc(hx, hy, o.head || 7, 0, Math.PI * 2); ctx.fill();
    if (o.detail) o.detail(ctx, cx, by, hx, hy, e.dir, t);
    ctx.fillStyle = '#16161c';
    ctx.fillRect(hx + e.dir * 2, hy - 2, 2, 2);
    ctx.restore();
  }

  /** 飛行怪的共用骨架：身體 + 兩片拍動的翅膀 + 頭與嘴 */
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
    ctx.fillStyle = o.beak || '#e8a033';
    const bl = o.beakLen || 7;
    ctx.beginPath();
    ctx.moveTo(cx + e.dir * 15, cy - 5); ctx.lineTo(cx + e.dir * (15 + bl), cy - 2); ctx.lineTo(cx + e.dir * 15, cy - 1);
    ctx.fill();
    if (o.detail) o.detail(ctx, cx, cy, e.dir, t);
    ctx.fillStyle = '#16161c';
    ctx.fillRect(cx + e.dir * 11, cy - 6, 2, 2);
    ctx.restore();
  }

  const COUNTRY_ENEMIES = {
    // 西班牙：奎爾公園的馬賽克蜥蜴 + 巴塞隆納滿街的綠色和尚鸚鵡
    ES: {
      walker: function (ctx, e, t) {
        const cx = e.x + e.w / 2, by = e.y + e.h;
        ctx.save(); squashed(ctx, e, cx, by);
        const w = Math.sin(t * 0.3) * 3;
        ctx.fillStyle = '#3fa0a8';
        ctx.beginPath();
        ctx.moveTo(cx - e.dir * 16, by - 8 + w);
        ctx.quadraticCurveTo(cx - e.dir * 4, by - 18, cx + e.dir * 10, by - 12);
        ctx.quadraticCurveTo(cx + e.dir * 18, by - 10, cx + e.dir * 16, by - 6);
        ctx.quadraticCurveTo(cx, by - 2, cx - e.dir * 16, by - 8 + w);
        ctx.fill();
        const tiles = ['#f1bf00', '#e05a3a', '#5fc0e8', '#f4efe2'];
        for (let i = 0; i < 7; i++) {
          ctx.fillStyle = tiles[i % 4];
          ctx.fillRect(cx - e.dir * (10 - i * 3.5) - 1.5, by - 14 + (i % 2) * 3, 3, 3);
        }
        ctx.fillStyle = '#2f7a80';
        [-8, 6].forEach(function (lx) { ctx.fillRect(cx + lx + w * 0.3, by - 5, 3, 5); });
        ctx.fillStyle = '#16161c'; ctx.fillRect(cx + e.dir * 13, by - 12, 2, 2);
        ctx.restore();
      },
      flyer: function (ctx, e, t) {
        bird(ctx, e, t, { body: '#5fbf4a', wing: '#3f9a3a', head: '#9ad87a', beak: '#e8d080', beakLen: 5, flapSpeed: 0.45 });
      }
    },
    // 法國：戴貝雷帽的法國鬥牛犬 + 巴黎鴿子
    FR: {
      walker: function (ctx, e, t) {
        quadruped(ctx, e, t, {
          body: '#b89878', bw: 13, bh: 8, head: 8,
          detail: function (ctx, cx, by, hx, hy, d) {
            ctx.fillStyle = '#9a7a5a';
            ctx.beginPath(); ctx.arc(hx - d * 4, hy - 7, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(hx + d * 2, hy - 8, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#c0392b';
            ctx.beginPath(); ctx.ellipse(hx, hy - 7, 7, 3, -0.2 * d, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#2a1a14'; ctx.fillRect(hx + d * 6, hy, 2, 2);
          }
        });
      },
      flyer: function (ctx, e, t) {
        bird(ctx, e, t, {
          body: '#8a92a8', wing: '#6f788f', head: '#7a8299', beak: '#3a3a40', beakLen: 4,
          detail: function (ctx, cx, cy, d) {
            ctx.fillStyle = '#5fa080';
            ctx.beginPath(); ctx.arc(cx + d * 6, cy + 1, 3, 0, Math.PI * 2); ctx.fill();
          }
        });
      }
    },
    // 德國：臘腸狗 + 黑森林咕咕鐘的布穀鳥
    DE: {
      walker: function (ctx, e, t) {
        quadruped(ctx, e, t, {
          body: '#8a4a24', bw: 17, bh: 6, head: 6, neck: 17,
          detail: function (ctx, cx, by, hx, hy, d) {
            ctx.fillStyle = '#5a2e14';
            ctx.beginPath(); ctx.ellipse(hx - d * 3, hy + 3, 3, 6, 0.3 * d, 0, Math.PI * 2); ctx.fill();
            ctx.fillRect(hx + d * 4, hy - 1, 6 * d, 4);
          }
        });
      },
      flyer: function (ctx, e, t) {
        bird(ctx, e, t, {
          body: '#a0784a', wing: '#7a5a34', head: '#8a643c', beak: '#f0c040', beakLen: 6,
          detail: function (ctx, cx, cy) {
            ctx.fillStyle = '#f4efe2';
            ctx.fillRect(cx - 5, cy + 2, 10, 2);
          }
        });
      }
    },
    // 波蘭：瓦維爾龍的小龍崽 + 白鸛（波蘭是全歐洲白鸛最多的國家）
    PL: {
      walker: function (ctx, e, t) {
        quadruped(ctx, e, t, {
          body: '#3f8a4a', head: 7,
          detail: function (ctx, cx, by, hx, hy, d, t2) {
            ctx.fillStyle = '#2f6a3a';
            for (let i = 0; i < 3; i++) {
              ctx.beginPath(); ctx.moveTo(cx - 8 + i * 6, by - 20); ctx.lineTo(cx - 5 + i * 6, by - 26); ctx.lineTo(cx - 2 + i * 6, by - 20); ctx.fill();
            }
            if ((t2 % 120) < 14) {
              ctx.fillStyle = 'rgba(255, 150, 60, 0.85)';
              ctx.beginPath(); ctx.moveTo(hx + d * 6, hy); ctx.lineTo(hx + d * 18, hy - 5); ctx.lineTo(hx + d * 18, hy + 4); ctx.fill();
            }
          }
        });
      },
      flyer: function (ctx, e, t) {
        bird(ctx, e, t, {
          body: '#f4f4f0', wing: '#f4f4f0', head: '#f4f4f0', beak: '#e04a2a', beakLen: 12, span: 30, flapSpeed: 0.18,
          detail: function (ctx, cx, cy, d, t2) {
            const flap = Math.sin(t2 * 0.18) * 8;
            ctx.fillStyle = '#1a1a20';
            ctx.beginPath(); ctx.arc(cx - 24, cy - flap, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + 24, cy - flap, 4, 0, Math.PI * 2); ctx.fill();
          }
        });
      }
    },
    // 匈牙利：捲毛豬 Mangalica + 傳說神鳥 Turul
    HU: {
      walker: function (ctx, e, t) {
        quadruped(ctx, e, t, {
          body: '#e8d8b8', bw: 15, bh: 9, head: 7,
          detail: function (ctx, cx, by) {
            ctx.strokeStyle = '#c8b090'; ctx.lineWidth = 1.2;
            for (let i = 0; i < 6; i++) {
              ctx.beginPath(); ctx.arc(cx - 10 + i * 4, by - 14 + (i % 2) * 3, 2.5, 0, Math.PI * 1.6); ctx.stroke();
            }
          }
        });
      },
      flyer: function (ctx, e, t) {
        bird(ctx, e, t, { body: '#7a5030', wing: '#c89038', head: '#8a5a34', beak: '#f0c040', beakLen: 6, span: 30, flapSpeed: 0.22 });
      }
    },
    // 斯洛伐克：塔特拉山的土撥鼠 + 金鵰
    SK: {
      walker: function (ctx, e, t) {
        quadruped(ctx, e, t, { body: '#9a7a52', bw: 13, bh: 10, head: 7, neck: 11 });
      },
      flyer: function (ctx, e, t) {
        bird(ctx, e, t, { body: '#5a3a20', wing: '#4a2e18', head: '#c89040', beak: '#f0d060', beakLen: 6, span: 32, flapSpeed: 0.16 });
      }
    },
    // 克羅埃西亞：大麥町狗（名字就來自克羅埃西亞的達爾馬提亞海岸）+ 亞得里亞海鷗
    HR: {
      walker: function (ctx, e, t) {
        quadruped(ctx, e, t, {
          body: '#f4f4f0', head: 7,
          detail: function (ctx, cx, by, hx, hy) {
            ctx.fillStyle = '#1a1a20';
            [[-8, -14], [-2, -10], [5, -15], [9, -11], [-5, -17]].forEach(function (s) {
              ctx.beginPath(); ctx.arc(cx + s[0], by + s[1], 1.8, 0, Math.PI * 2); ctx.fill();
            });
            ctx.beginPath(); ctx.arc(hx, hy - 5, 2, 0, Math.PI * 2); ctx.fill();
          }
        });
      }
    },
    // 塞爾維亞：山羊 + 蝙蝠（「vampir」這個詞就是從塞爾維亞語傳進歐洲的）
    RS: {
      walker: function (ctx, e, t) {
        quadruped(ctx, e, t, {
          body: '#d8d0c0', head: 6,
          detail: function (ctx, cx, by, hx, hy, d) {
            ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(hx, hy - 5); ctx.quadraticCurveTo(hx - d * 6, hy - 14, hx - d * 10, hy - 8); ctx.stroke();
            ctx.fillStyle = '#b8b0a0'; ctx.fillRect(hx + d * 3, hy + 4, 2, 4);
          }
        });
      },
      flyer: function (ctx, e, t) {
        bird(ctx, e, t, { body: '#2a2030', wing: '#3a2a40', head: '#2a2030', beak: '#2a2030', beakLen: 1, flapSpeed: 0.55, flapAmp: 6 });
      }
    },
    // 保加利亞：玫瑰金龜子 + 蝴蝶（玫瑰谷）
    BG: {
      walker: function (ctx, e, t) {
        const cx = e.x + e.w / 2, by = e.y + e.h;
        ctx.save(); squashed(ctx, e, cx, by);
        const g = ctx.createLinearGradient(cx - 12, 0, cx + 12, 0);
        g.addColorStop(0, '#3fa060'); g.addColorStop(0.5, '#8ad06a'); g.addColorStop(1, '#2f8a5a');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(cx, by - 10, 13, 9, 0, Math.PI, 0); ctx.fill();
        ctx.fillRect(cx - 13, by - 10, 26, 4);
        ctx.strokeStyle = '#1f5a3a'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, by - 19); ctx.lineTo(cx, by - 6); ctx.stroke();
        ctx.fillStyle = '#1f3a2a';
        ctx.beginPath(); ctx.arc(cx + e.dir * 13, by - 8, 4, 0, Math.PI * 2); ctx.fill();
        const s = Math.sin(t * 0.5) * 2;
        ctx.fillRect(cx - 9 + s, by - 6, 2, 6); ctx.fillRect(cx - s, by - 6, 2, 6); ctx.fillRect(cx + 8 + s, by - 6, 2, 6);
        ctx.restore();
      },
      flyer: function (ctx, e, t) {
        const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
        ctx.save();
        if (e.squash > 0) { ctx.translate(cx, cy); ctx.scale(1.3, 0.4); ctx.translate(-cx, -cy); }
        const f = Math.abs(Math.sin(t * 0.35));
        ctx.fillStyle = '#e86a9a';
        ctx.beginPath(); ctx.ellipse(cx - 7 * f, cy - 4, 9 * f + 1, 8, -0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + 7 * f, cy - 4, 9 * f + 1, 8, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f4b8cc';
        ctx.beginPath(); ctx.ellipse(cx - 5 * f, cy + 5, 5 * f + 1, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx + 5 * f, cy + 5, 5 * f + 1, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a1a20'; ctx.fillRect(cx - 1.5, cy - 8, 3, 16);
        ctx.restore();
      }
    },
    // 烏克蘭：向日葵小怪（一望無際的向日葵田）+ 燕子
    UA: {
      walker: function (ctx, e, t) {
        const cx = e.x + e.w / 2, by = e.y + e.h;
        ctx.save(); squashed(ctx, e, cx, by);
        const s = Math.sin(t * 0.35) * 3;
        ctx.strokeStyle = '#3f7a3a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cx - 5 + s, by); ctx.lineTo(cx, by - 12); ctx.lineTo(cx + 5 - s, by); ctx.stroke();
        ctx.fillStyle = '#5fa04a';
        ctx.beginPath(); ctx.ellipse(cx - 7, by - 12, 5, 2.5, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f4c020';
        for (let i = 0; i < 10; i++) {
          const a = i / 10 * Math.PI * 2 + t * 0.02;
          ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 9, by - 22 + Math.sin(a) * 9, 4, 2.2, a, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#5a3a1a';
        ctx.beginPath(); ctx.arc(cx, by - 22, 6.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f4efe2';
        ctx.fillRect(cx + e.dir * 2 - 1, by - 24, 2, 2);
        ctx.restore();
      },
      flyer: function (ctx, e, t) {
        bird(ctx, e, t, {
          body: '#1f2a4a', wing: '#1f2a4a', head: '#1f2a4a', beak: '#1a1a20', beakLen: 3, span: 30, flapSpeed: 0.4,
          detail: function (ctx, cx, cy, d) {
            ctx.fillStyle = '#c8402a';
            ctx.beginPath(); ctx.arc(cx + d * 13, cy - 1, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f4efe2';
            ctx.beginPath(); ctx.ellipse(cx, cy + 3, 6, 3, 0, 0, Math.PI); ctx.fill();
          }
        });
      }
    },
    // 希臘（魔王召喚的小兵）：山羊；義大利沒有小兵
    GR: {
      walker: function (ctx, e, t) {
        quadruped(ctx, e, t, {
          body: '#e8e0d0', head: 6,
          detail: function (ctx, cx, by, hx, hy, d) {
            ctx.strokeStyle = '#a89878'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(hx - d * 3, hy - 4, 4, Math.PI, Math.PI * 2); ctx.stroke();
          }
        });
      }
    }
  };

  // ── 魔王 ────────────────────────────────────────────────────

  /** 荷蘭魔王：風車巨人（手臂是旋轉的風車葉片） */
  function bossWindmill(ctx, b, t) {
    const cx = b.x + b.w / 2, by = b.y + b.h;

    // 腳：讓它明顯是「活的」，跟背景那些靜態風車區分開
    ctx.fillStyle = '#4a3a2c';
    const stride = Math.sin(t * 0.12) * 5;
    ctx.fillRect(cx - 24, by - 14, 15, 15 + stride);
    ctx.fillRect(cx + 9, by - 14, 15, 15 - stride);
    ctx.fillStyle = '#2e2520';
    ctx.fillRect(cx - 27, by - 3, 21, 5);
    ctx.fillRect(cx + 6, by - 3, 21, 5);

    // 塔身（比背景風車深色，加紅色綁帶更像敵人）
    ctx.fillStyle = '#5a4433';
    ctx.beginPath();
    ctx.moveTo(cx - b.w * 0.42, by - 12);
    ctx.lineTo(cx + b.w * 0.42, by - 12);
    ctx.lineTo(cx + b.w * 0.28, b.y + 18);
    ctx.lineTo(cx - b.w * 0.28, b.y + 18);
    ctx.closePath(); ctx.fill();
    // 紅色綁帶
    ctx.fillStyle = '#9c2f28';
    ctx.fillRect(cx - b.w * 0.36, b.y + 52, b.w * 0.72, 7);
    // 磚紋
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 4; i++) ctx.fillRect(cx - b.w * 0.36 + (i % 2) * 8, b.y + 30 + i * 13, 16, 5);
    // 屋頂
    ctx.fillStyle = '#5a4436';
    ctx.beginPath();
    ctx.moveTo(cx - b.w * 0.32, b.y + 18);
    ctx.lineTo(cx + b.w * 0.32, b.y + 18);
    ctx.lineTo(cx, b.y - 6);
    ctx.closePath(); ctx.fill();
    // 眼睛（窗戶）：平常發紅光，破綻期轉金色
    ctx.fillStyle = b.phase === 'recover' ? '#ffd166' : '#ff5a4a';
    ctx.beginPath(); ctx.arc(cx - 11, b.y + 36, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 11, b.y + 36, 5.5, 0, Math.PI * 2); ctx.fill();
    // 怒眉
    ctx.strokeStyle = '#2a2017';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 17, b.y + 27); ctx.lineTo(cx - 6, b.y + 32);
    ctx.moveTo(cx + 17, b.y + 27); ctx.lineTo(cx + 6, b.y + 32);
    ctx.stroke();
    // 風車葉片
    ctx.save();
    ctx.translate(cx, b.y + 24);
    ctx.rotate(t * (b.phase === 'act' ? 0.3 : 0.09));
    ctx.fillStyle = '#d8cdb8';
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 2);
      ctx.fillRect(-4, -54, 8, 54);
      ctx.restore();
    }
    ctx.fillStyle = '#8a6a3c';
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** 德國魔王：城堡守衛鐵騎（拿巨錘） */
  function bossKnight(ctx, b, t) {
    const cx = b.x + b.w / 2, by = b.y + b.h;
    // 披風
    ctx.fillStyle = '#8c2a20';
    ctx.beginPath();
    ctx.moveTo(cx - b.dir * 6, b.y + 20);
    ctx.quadraticCurveTo(cx - b.dir * 34, b.y + 46, cx - b.dir * 24, by - 2);
    ctx.lineTo(cx - b.dir * 2, by - 2);
    ctx.closePath(); ctx.fill();
    // 腿
    ctx.fillStyle = '#4a4f5e';
    ctx.fillRect(cx - 16, by - 20, 12, 20);
    ctx.fillRect(cx + 4, by - 20, 12, 20);
    // 軀幹盔甲
    ctx.fillStyle = '#9aa4b4';
    U.roundRect(ctx, cx - 22, b.y + 20, 44, 44, 6); ctx.fill();
    ctx.fillStyle = '#7c8696';
    ctx.fillRect(cx - 22, b.y + 38, 44, 5);
    // 頭盔
    ctx.fillStyle = '#b9c2d0';
    U.roundRect(ctx, cx - 15, b.y - 2, 30, 24, 7); ctx.fill();
    // 面罩縫（破綻期會發亮）
    ctx.fillStyle = b.phase === 'recover' ? '#ffd166' : '#2a2f3e';
    ctx.fillRect(cx - 11, b.y + 8, 22, 4);
    // 盔頂羽飾
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.ellipse(cx, b.y - 6, 5, 10, 0, 0, Math.PI * 2); ctx.fill();
    // 巨錘：act 階段高舉
    const swing = b.phase === 'act' ? -0.9 : (b.phase === 'telegraph' ? -1.5 : -0.2);
    ctx.save();
    ctx.translate(cx + b.dir * 20, b.y + 30);
    ctx.rotate(b.dir * swing);
    ctx.strokeStyle = '#6b5a44';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -40); ctx.stroke();
    ctx.fillStyle = '#8f99a9';
    U.roundRect(ctx, -13, -54, 26, 18, 4); ctx.fill();
    ctx.restore();
  }

  /** 希臘魔王：大理石巨像（宙斯石像活過來） */
  function bossColossus(ctx, b, t) {
    const cx = b.x + b.w / 2, by = b.y + b.h;
    // 腿
    ctx.fillStyle = '#ddd6c4';
    ctx.fillRect(cx - 18, by - 26, 14, 26);
    ctx.fillRect(cx + 4, by - 26, 14, 26);
    // 身體
    ctx.fillStyle = '#eae2d0';
    U.roundRect(ctx, cx - 24, b.y + 18, 48, 46, 7); ctx.fill();
    // 胸甲線條
    ctx.strokeStyle = 'rgba(120,110,92,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 16, b.y + 34); ctx.lineTo(cx + 16, b.y + 34);
    ctx.moveTo(cx, b.y + 18); ctx.lineTo(cx, b.y + 64);
    ctx.stroke();
    // 頭
    ctx.fillStyle = '#f1ead9';
    ctx.beginPath(); ctx.arc(cx, b.y + 8, 15, 0, Math.PI * 2); ctx.fill();
    // 鬍子
    ctx.fillStyle = '#cfc6b2';
    ctx.beginPath();
    ctx.arc(cx, b.y + 14, 11, 0, Math.PI); ctx.fill();
    // 眼：破綻期發亮
    ctx.fillStyle = b.phase === 'recover' ? '#ffd166' : '#6b6354';
    ctx.beginPath(); ctx.arc(cx - 5, b.y + 5, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 5, b.y + 5, 2.6, 0, Math.PI * 2); ctx.fill();
    // 月桂冠
    ctx.strokeStyle = '#6f9f5a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, b.y + 6, 15, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    // 雷電（act 階段手上帶電）
    if (b.phase === 'act' || b.phase === 'telegraph') {
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const hx = cx + b.dir * 26, hy = b.y + 30;
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + b.dir * 8, hy + 10);
      ctx.lineTo(hx + b.dir * 2, hy + 12);
      ctx.lineTo(hx + b.dir * 12, hy + 26);
      ctx.stroke();
    }
  }

  /**
   * 德國魔王：大鐘錶匠（齊射型）。
   *
   * 外觀刻意跟其他三隻不同剪影：矮胖、頭是一面鐘、身上掛齒輪。
   * 它站定不動吐扇形彈幕，所以不需要「會跑」的身體語言，
   * 改用「鐘面指針飛轉 + 齒輪轉動」表達蓄力。
   */
  function bossClockwork(ctx, b, t) {
    const cx = b.x + b.w / 2, by = b.y + b.h;
    const charging = b.phase === 'telegraph' || b.phase === 'act';

    // 底座（三隻腳的落地鐘）
    ctx.fillStyle = '#5a4433';
    ctx.beginPath();
    ctx.moveTo(cx - b.w * 0.44, by);
    ctx.lineTo(cx + b.w * 0.44, by);
    ctx.lineTo(cx + b.w * 0.3, by - 16);
    ctx.lineTo(cx - b.w * 0.3, by - 16);
    ctx.closePath(); ctx.fill();

    // 身體：木殼鐘箱
    ctx.fillStyle = '#7a5f42';
    U.roundRect(ctx, cx - 28, b.y + 26, 56, b.h - 42, 6); ctx.fill();
    ctx.fillStyle = '#5e4833';
    ctx.fillRect(cx - 28, b.y + 48, 56, 5);

    // 擺錘（左右晃，表示它是活的）
    const swing = Math.sin(t * 0.07) * 12;
    ctx.strokeStyle = '#c8a24a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, b.y + 56);
    ctx.lineTo(cx + swing, b.y + 86);
    ctx.stroke();
    ctx.fillStyle = '#e0c060';
    ctx.beginPath(); ctx.arc(cx + swing, b.y + 88, 6, 0, Math.PI * 2); ctx.fill();

    // 側邊齒輪
    [-1, 1].forEach(function (sd) {
      ctx.save();
      ctx.translate(cx + sd * 34, b.y + 44);
      ctx.rotate(t * (charging ? 0.22 : 0.06) * sd);
      ctx.fillStyle = '#9aa2ae';
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / 4);
        ctx.fillRect(-2.5, -13, 5, 7);
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6b7280';
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    // 頭：鐘面
    ctx.fillStyle = '#f2ead6';
    ctx.beginPath(); ctx.arc(cx, b.y + 16, 20, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a6a3c';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, b.y + 16, 20, 0, Math.PI * 2); ctx.stroke();
    // 刻度
    ctx.fillStyle = '#6b5a44';
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      ctx.fillRect(cx + Math.cos(a) * 15 - 1, b.y + 16 + Math.sin(a) * 15 - 1, 2, 2);
    }
    // 指針：蓄力時飛轉
    const sp = charging ? 0.5 : 0.08;
    ctx.strokeStyle = b.phase === 'recover' ? '#ffd166' : '#b03a2e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, b.y + 16);
    ctx.lineTo(cx + Math.cos(t * sp) * 13, b.y + 16 + Math.sin(t * sp) * 13);
    ctx.stroke();
    ctx.strokeStyle = b.phase === 'recover' ? '#ffd166' : '#2a2f3e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, b.y + 16);
    ctx.lineTo(cx + Math.cos(t * sp * 0.4) * 9, b.y + 16 + Math.sin(t * sp * 0.4) * 9);
    ctx.stroke();
  }

  const bossKinds = {
    windmill: bossWindmill, knight: bossKnight,
    colossus: bossColossus, clockwork: bossClockwork
  };

  /** 魔王本體 + 狀態提示 */
  function boss(ctx, b, t) {
    ctx.save();

    if (b.defeated) {
      // 倒地：往一側翻倒並淡出
      ctx.globalAlpha = Math.max(0, 1 - b.deathTimer / 110);
      ctx.translate(b.x + b.w / 2, b.y + b.h);
      ctx.rotate(Math.min(Math.PI / 2, b.deathTimer * 0.016));
      ctx.translate(-(b.x + b.w / 2), -(b.y + b.h));
    }

    // 預告階段整隻閃紅，讓玩家知道要來了
    if (b.phase === 'telegraph' && Math.floor(t / 4) % 2 === 0) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ff6b6b';
      U.roundRect(ctx, b.x - 6, b.y - 10, b.w + 12, b.h + 14, 10);
      ctx.fill();
      ctx.restore();
    }
    // 受擊白閃
    if (b.hurtFlash > 0 && Math.floor(t / 2) % 2 === 0) ctx.globalAlpha *= 0.55;

    (bossKinds[b.kind] || bossKnight)(ctx, b, t);
    ctx.restore();

    // 破綻期在頭上標示「可攻擊」（v1.31 巴西守門員不用：踩頭沒用，箭頭會誤導玩家去踩他）
    if (!b.defeated && b.phase === 'recover' && b.kind !== 'goalkeeper') {
      const ax = b.x + b.w / 2, ay = b.y - 22 + Math.sin(t * 0.14) * 3;
      ctx.save();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(ax, ay + 9);
      ctx.lineTo(ax - 7, ay - 2);
      ctx.lineTo(ax + 7, ay - 2);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  /** 魔王血條（畫在畫面上方，不隨相機移動） */
  function bossBar(ctx, b, W) {
    const bw = 420, bh = 16, bx = (W - bw) / 2, by = 64;
    ctx.save();
    ctx.fillStyle = 'rgba(12,16,30,0.8)';
    U.roundRect(ctx, bx - 4, by - 22, bw + 8, bh + 28, 8); ctx.fill();
    ctx.strokeStyle = '#7e97c9';
    ctx.lineWidth = 1.5;
    U.roundRect(ctx, bx - 4, by - 22, bw + 8, bh + 28, 8); ctx.stroke();

    U.text(ctx, b.name, bx + bw / 2, by - 10, { size: 14, color: '#ffd166' });

    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    U.roundRect(ctx, bx, by, bw, bh, 5); ctx.fill();
    const frac = Math.max(0, b.hp / b.hpMax);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, '#e0526b');
    g.addColorStop(1, '#ff9aa8');
    ctx.fillStyle = g;
    if (frac > 0) { U.roundRect(ctx, bx, by, bw * frac, bh, 5); ctx.fill(); }

    // 分段刻度
    ctx.strokeStyle = 'rgba(12,16,30,0.6)';
    ctx.lineWidth = 2;
    for (let i = 1; i < b.hpMax; i++) {
      const sx = bx + bw * (i / b.hpMax);
      ctx.beginPath(); ctx.moveTo(sx, by); ctx.lineTo(sx, by + bh); ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * 密道。
   * 未發現：畫一塊跟地形同色的假牆，只留極細的裂縫當線索。
   * 已發現：牆打開，露出裡面的密室。
   */
  /** 隱形磚現形後的樣子：舊石磚 + 刻了一個金色的小記號 */
  function secretBlock(ctx, bk, camX, bump) {
    const x = bk.x - camX, y = bk.y - (bump > 0 ? Math.sin(bump / 14 * Math.PI) * 6 : 0);
    ctx.fillStyle = '#8c7a5c';
    U.roundRect(ctx, x, y, bk.w, bk.h, 3); ctx.fill();
    ctx.fillStyle = '#b4a07a';
    ctx.fillRect(x + 2, y + 2, bk.w - 4, 4);
    ctx.strokeStyle = 'rgba(40, 30, 20, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, bk.w - 1, bk.h - 1);
    ctx.fillStyle = '#e0b85a';
    ctx.beginPath();
    ctx.moveTo(x + bk.w / 2, y + 6); ctx.lineTo(x + bk.w / 2 + 5, y + bk.h / 2 + 2);
    ctx.lineTo(x + bk.w / 2, y + bk.h - 4); ctx.lineTo(x + bk.w / 2 - 5, y + bk.h / 2 + 2);
    ctx.closePath(); ctx.fill();
  }

  /**
   * 岔路密道（v1.9）：彈跳墊 + 空中的舊石板路。
   * 還沒踩上去之前石板是半透明的「浮現中」，踩上第一塊（發現）後變實。
   */
  function secretBranch(ctx, sc, t, camX) {
    const pd = sc.pad;
    if (pd) {
      const x = pd.x - camX, sq = sc.padSquash > 0 ? sc.padSquash / 10 : 0;
      const top = pd.y - 10 + sq * 5;
      // 彈簧
      ctx.strokeStyle = '#6b6f78'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const yy = pd.y - (pd.y - top) * i / 6;
        ctx.lineTo(x + 12 + (i % 2) * (pd.w - 24), yy);
      }
      ctx.stroke();
      ctx.fillStyle = '#d0453a';
      U.roundRect(ctx, x, top - 6, pd.w, 7, 3); ctx.fill();
      ctx.fillStyle = '#ffd36e';
      ctx.fillRect(x + 6, top - 5, pd.w - 12, 2);
      // 往上的小箭頭（找到磚之後才看得到，提示「這裡可以彈上去」）
      const bob = Math.sin(t * 0.12) * 3;
      ctx.fillStyle = 'rgba(255, 233, 168, 0.85)';
      ctx.beginPath();
      ctx.moveTo(x + pd.w / 2, top - 34 + bob);
      ctx.lineTo(x + pd.w / 2 + 9, top - 22 + bob);
      ctx.lineTo(x + pd.w / 2 - 9, top - 22 + bob);
      ctx.closePath(); ctx.fill();
    }
    const alpha = sc.found ? 1 : 0.55 + Math.sin(t * 0.1) * 0.15;
    ctx.globalAlpha = alpha;
    (sc.path || []).forEach(function (pf, i) {
      const x = pf.x - camX;
      if (x > 1000 || x + pf.w < -40) return;
      // 古老石板：底部陰影 + 金色鑲邊 + 石縫
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x + 4, pf.y + pf.h, pf.w - 8, 5);
      ctx.fillStyle = '#9a8a6e';
      U.roundRect(ctx, x, pf.y, pf.w, pf.h, 4); ctx.fill();
      ctx.fillStyle = '#e0b85a';
      ctx.fillRect(x + 2, pf.y, pf.w - 4, 3);
      ctx.strokeStyle = 'rgba(60, 45, 30, 0.45)'; ctx.lineWidth = 1;
      for (let k = 1; k < 4; k++) {
        const sx2 = x + Math.round(pf.w * k / 4);
        ctx.beginPath(); ctx.moveTo(sx2 + 0.5, pf.y + 4); ctx.lineTo(sx2 + 0.5, pf.y + pf.h); ctx.stroke();
      }
      // 盡頭那塊插一面小旗，遠遠就知道「那裡有東西」
      if (i === sc.path.length - 1) {
        ctx.fillStyle = '#6b5a44';
        ctx.fillRect(x + pf.w - 8, pf.y - 46, 3, 46);
        ctx.fillStyle = '#e0b85a';
        const wave = Math.sin(t * 0.15) * 2;
        ctx.beginPath();
        ctx.moveTo(x + pf.w - 5, pf.y - 46);
        ctx.lineTo(x + pf.w + 15, pf.y - 40 + wave);
        ctx.lineTo(x + pf.w - 5, pf.y - 33);
        ctx.closePath(); ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }

  function secretRoom(ctx, sc, def, t, camX) {
    const r = sc.room;
    const sx = r.x - camX;
    ctx.save();

    /*
     * v1.31 洞裡的密道：沒有尖刺的斷崖。畫成往下越來越黑的深洞（看起來就是會摔死的那種），
     * 洞口兩邊掛幾根草根 —— 找過的也一樣（是個洞窟，不是門）。
     */
    if (sc.kind === 'pit' && sc.pit) {
      const pt = sc.pit, x = pt.x - camX, top = pt.y - 30;
      const g = ctx.createLinearGradient(0, top, 0, top + 120);
      g.addColorStop(0, 'rgba(20, 14, 10, 0.25)'); g.addColorStop(1, 'rgba(8, 6, 4, 0.96)');
      ctx.fillStyle = g; ctx.fillRect(x, top, pt.w, 600);
      ctx.strokeStyle = 'rgba(90, 70, 40, 0.8)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const rx = x + 4 + (i % 2 ? pt.w - 10 : 0) + (i > 1 ? (i % 2 ? -6 : 6) : 0);
        ctx.beginPath(); ctx.moveTo(rx, top + 2); ctx.quadraticCurveTo(rx + (i % 2 ? -4 : 4), top + 14, rx + (i % 2 ? -2 : 2), top + 22 + i * 4); ctx.stroke();
      }
      ctx.restore();
      return;
    }

    /*
     * 三種狀態：
     *   隱藏   什麼都不畫。唯一的線索：磚的位置每隔幾秒閃一下極淡的光點
     *          （要剛好在看那裡才會注意到）
     *   現形   磚出現 + 地面浮出一座半埋的石造門洞（入口開了，走進去）
     *   已發現 門洞變成密室內部
     */
    if (sc.block && !sc.revealed) {
      /*
       * v1.9.2：玩家回報「找不到密道」。原本唯一的線索是每 5 秒閃一下、
       * 透明度 0.35 的 8px 光點，實際上沒人看得到。改成由遠到近四層線索：
       *   遠  （v1.31 拿掉了：地上那塊刻金色記號的石板太明顯）
       *   中  磚下方浮一枚引路金幣（在 levels.js 放的，跳起來吃就會頂到磚）
       *   近  玩家靠近時，磚的虛線輪廓浮現 + 細灰從磚縫掉下來
       *   光點更亮、更大、更常閃
       */
      const bk = sc.block;
      const bx = bk.x - camX + bk.w / 2, by = bk.y + bk.h / 2;
      // v1.31 玩家：密道太明顯 → 拿掉地上那塊咖啡色的記號石板（只剩引路金幣、靠近時的虛線和閃光）
      // 靠近時：虛線輪廓 + 掉灰（near 由 game.js 算，0 = 遠、1 = 正下方）
      const near = sc.near || 0;
      if (near > 0) {
        ctx.fillStyle = 'rgba(255, 236, 180, ' + (near * 0.18).toFixed(3) + ')';
        ctx.fillRect(bk.x - camX, bk.y, bk.w, bk.h);
        ctx.strokeStyle = 'rgba(255, 240, 190, ' + (near * 0.9).toFixed(3) + ')';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -t * 0.3;
        ctx.strokeRect(bk.x - camX + 0.5, bk.y + 0.5, bk.w - 1, bk.h - 1);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(220, 205, 170, ' + (near * 0.8).toFixed(3) + ')';
        for (let i = 0; i < 3; i++) {
          const k = (t * 0.9 + i * 37) % 70;
          ctx.fillRect(bk.x - camX + 6 + ((i * 11 + Math.floor(t / 70) * 7) % (bk.w - 12)), bk.y + bk.h + k, 2, 2);
        }
      }
      const cyc = t % 150;
      if (cyc < 26) {
        const a = Math.sin(cyc / 26 * Math.PI) * 0.85;
        ctx.fillStyle = 'rgba(255, 245, 210, ' + a.toFixed(3) + ')';
        ctx.fillRect(bx - 1.5, by - 8, 3, 16);
        ctx.fillRect(bx - 8, by - 1.5, 16, 3);
      }
      ctx.restore();
      return;
    }
    if (sc.block) secretBlock(ctx, sc.block, camX, sc.bumpAnim || 0);

    if (sc.kind === 'branch') {
      secretBranch(ctx, sc, t, camX);
      ctx.restore();
      return;
    }

    if (!sc.found) {
      // 半埋在地裡的石門洞：石框 + 黑漆漆的入口 + 從裡面飄出的微光
      ctx.fillStyle = '#7a6a52';
      ctx.fillRect(sx + 40, r.y + 4, r.w - 80, r.h - 4);
      ctx.fillStyle = '#9c8a6c';
      ctx.fillRect(sx + 34, r.y, r.w - 68, 8);
      ctx.fillStyle = '#120e14';
      ctx.beginPath();
      ctx.moveTo(sx + 66, r.y + r.h);
      ctx.lineTo(sx + 66, r.y + 26);
      ctx.quadraticCurveTo(sx + r.w / 2, r.y + 6, sx + r.w - 66, r.y + 26);
      ctx.lineTo(sx + r.w - 66, r.y + r.h);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255, 210, 130, ' + (0.15 + Math.sin(t * 0.08) * 0.08).toFixed(3) + ')';
      ctx.fillRect(sx + 80, r.y + 34, r.w - 160, r.h - 34);
      ctx.restore();
      return;
    }

    if (sc.found) {
      // 密室內部
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, 'rgba(30,26,40,0.98)');
      g.addColorStop(1, 'rgba(16,14,24,0.99)');
      ctx.fillStyle = g;
      ctx.fillRect(sx, r.y, r.w, r.h);
      // 磚牆邊框
      ctx.strokeStyle = 'rgba(190,170,130,0.5)';
      ctx.lineWidth = 3;
      ctx.strokeRect(sx + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
      // 火把照明
      for (let i = 0; i < 2; i++) {
        const tx = sx + (i === 0 ? 20 : r.w - 20);
        const ty = r.y + 26;
        const fl = 7 + Math.sin(t * 0.3 + i) * 2;
        const rg = ctx.createRadialGradient(tx, ty, 2, tx, ty, 44);
        rg.addColorStop(0, 'rgba(255, 196, 110, 0.5)');
        rg.addColorStop(1, 'rgba(255, 196, 110, 0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(tx, ty, 44, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6b5a44';
        ctx.fillRect(tx - 2, ty, 4, 14);
        ctx.fillStyle = '#ffb347';
        ctx.beginPath(); ctx.ellipse(tx, ty - 4, 4, fl, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      // 假牆：跟地面同色，看起來就是實心地形
      ctx.fillStyle = def.groundBody;
      ctx.fillRect(sx, r.y, r.w, r.h);
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      for (let i = 0; i < r.h; i += 20) {
        ctx.fillRect(sx + 8 + (i % 40 === 0 ? 0 : 14), r.y + i + 6, 16, 5);
      }
      // 唯一線索：一道細裂縫 + 偶爾飄出的灰塵
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx + r.w * 0.5, r.y + 4);
      ctx.lineTo(sx + r.w * 0.46, r.y + r.h * 0.5);
      ctx.lineTo(sx + r.w * 0.52, r.y + r.h - 4);
      ctx.stroke();
      if (Math.floor(t / 40) % 3 === 0) {
        ctx.fillStyle = 'rgba(220,210,190,0.28)';
        const dy = (t % 40) / 40;
        ctx.beginPath();
        ctx.arc(sx + r.w * 0.5, r.y + 10 + dy * 24, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** 魔王落地震波：貼地的土浪，外型明示「跳過去」 */
  function groundWave(ctx, s, t) {
    const cx = s.x + s.w / 2;
    const base = s.y + s.h;
    ctx.save();
    // 土浪本體
    const g = ctx.createLinearGradient(0, s.y - 10, 0, base);
    g.addColorStop(0, 'rgba(255, 214, 140, 0.95)');
    g.addColorStop(1, 'rgba(188, 120, 56, 0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(s.x - 4, base);
    ctx.quadraticCurveTo(cx, s.y - 12 - Math.sin(t * 0.4) * 2, s.x + s.w + 4, base);
    ctx.closePath();
    ctx.fill();
    // 飛濺的碎屑
    ctx.fillStyle = 'rgba(160, 104, 52, 0.8)';
    for (let i = 0; i < 3; i++) {
      const dx = (i - 1) * 7;
      const dy = -6 - ((t * 0.6 + i * 3) % 8);
      ctx.fillRect(cx + dx - 1.5, base + dy, 3, 3);
    }
    ctx.restore();
  }

  /** 彈射物 */
  function shot(ctx, s, t) {
    if (s.slash) { flameSlash(ctx, s, t); return; }
    if (s.lava) { lavaBomb(ctx, s, t); return; }
    if (s.pillar) { sandPillar(ctx, s, t); return; }
    if (s.patch) { firePatch(ctx, s, t); return; }
    if (s.ember) {
      // 火鳥俯衝灑下的火星
      const ex = s.x + s.w / 2, ey = s.y + s.h / 2;
      ctx.fillStyle = 'rgba(255, 140, 40, 0.45)';
      ctx.beginPath(); ctx.arc(ex, ey - 3, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.fill();
      return;
    }
    if (s.wave && s.fire) { fireWave(ctx, s, t); return; }
    if (s.wave) { groundWave(ctx, s, t); return; }
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    ctx.save();
    if (s.bat) { ctx.restore(); batShot(ctx, s, t); return; }
    if (s.splash) {
      // 海獺噴的水：藍色水滴＋後面一小串水花
      ctx.fillStyle = 'rgba(120, 200, 255, 0.9)';
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(230, 248, 255, 0.9)';
      ctx.beginPath(); ctx.arc(cx - 2, cy - 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(120, 200, 255, 0.5)';
      ctx.beginPath(); ctx.arc(cx - (s.vx || 0) * 3, cy - (s.vy || 0) * 3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    if (s.spear) {
      // 騎士的長槍：沿飛行方向的細長槍身 + 鐵槍頭
      ctx.translate(cx, cy);
      ctx.rotate(Math.atan2(s.vy || 0, s.vx || 1));
      ctx.fillStyle = '#7a5a3c';
      ctx.fillRect(-18, -1.5, 26, 3);
      ctx.fillStyle = '#cfd6e0';
      ctx.beginPath(); ctx.moveTo(8, -4); ctx.lineTo(18, 0); ctx.lineTo(8, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d7141a';
      ctx.fillRect(-20, -3, 4, 6);
      ctx.restore();
      return;
    }
    if (s.debris) {
      // 風車葉片碎片：旋轉的木條，地面上有落點陰影預告
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(cx, Levels.GROUND_Y - 2, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.25 + s.x);
      ctx.fillStyle = '#8a5a3c';
      ctx.fillRect(-14, -3, 28, 6);
      ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(-12, -2, 10, 4);
      ctx.restore();
      return;
    }
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, 9);
    g.addColorStop(0, 'rgba(255, 226, 170, 0.95)');
    g.addColorStop(1, 'rgba(226, 122, 60, 0.15)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c75a2c';
    ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe2aa';
    ctx.beginPath(); ctx.arc(cx - 1.2, cy - 1.2, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function coin(ctx, c, t) {
    const ph = Math.cos((t * 0.09) + c.x * 0.01);
    const rw = Math.max(2.5, 11 * Math.abs(ph));
    ctx.save();
    ctx.translate(c.x + 12, c.y + 12);
    ctx.fillStyle = '#e0a94b';
    ctx.beginPath(); ctx.ellipse(0, 0, rw, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f6d98a';
    ctx.beginPath(); ctx.ellipse(0, 0, rw * 0.66, 7.5, 0, 0, Math.PI * 2); ctx.fill();
    if (rw > 6) {
      U.text(ctx, '\u20AC', 0, 1, { size: 12, color: '#9a6b12', stroke: false });
    }
    ctx.restore();
  }

  /**
   * 畫國旗旗面。各國條紋方向不同，一律走這個函式，
   * 免得同一面旗在 HUD、地圖、終點旗三個地方長得不一樣。
   *
   * dir: 'v' 直三色 / 'h' 橫三色 / 'cross' 瑞士 / 'greek' 希臘
   */
  // v1.31：新國旗畫法可以從外面註冊（america.js 的古巴、牙買加、墨西哥、巴拿馬、哥倫比亞、巴西）
  const flagDirs = {};
  function flagFace(ctx, x, y, w, h, colors, dir) {
    const d = dir || 'v';
    if (flagDirs[d]) { flagDirs[d](ctx, x, y, w, h, colors); return; }

    if (d === 'esp') {
      // 西班牙：紅-黃-紅 橫三條，中間的黃色是上下兩條紅的兩倍寬
      ctx.fillStyle = colors[0];
      ctx.fillRect(x, y, w, h * 0.25);
      ctx.fillRect(x, y + h * 0.75, w, h * 0.25);
      ctx.fillStyle = colors[1];
      ctx.fillRect(x, y + h * 0.25, w, h * 0.5);
      return;
    }

    if (d === 'uk') {
      /*
       * 英國米字旗。
       *
       * 線寬要照真實比例收斂，不然在 18x12 這種小尺寸上會整面糊成紅色
       * （第一版對角用 0.3h、正十字用 0.3h，結果中間兩排全紅）。
       * 真旗的比例大致是：對角白 1/5 旗高、對角紅 1/15、
       * 正十字白 3/15、正十字紅 1/5 的一半。這裡取接近的保守值。
       */
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.fillStyle = colors[0];              // 藍底
      ctx.fillRect(x, y, w, h);

      ctx.lineCap = 'butt';
      // 對角：白底
      ctx.strokeStyle = colors[1];
      ctx.lineWidth = h * 0.20;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + w, y + h);
      ctx.moveTo(x + w, y); ctx.lineTo(x, y + h);
      ctx.stroke();
      // 對角：紅線（細）
      ctx.strokeStyle = colors[2];
      ctx.lineWidth = h * 0.08;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + w, y + h);
      ctx.moveTo(x + w, y); ctx.lineTo(x, y + h);
      ctx.stroke();

      // 正十字：白框
      ctx.fillStyle = colors[1];
      ctx.fillRect(x, y + h * 0.40, w, h * 0.20);
      ctx.fillRect(x + w * 0.42, y, w * 0.16, h);
      // 正十字：紅心（比白框窄）
      ctx.fillStyle = colors[2];
      ctx.fillRect(x, y + h * 0.445, w, h * 0.11);
      ctx.fillRect(x + w * 0.455, y, w * 0.09, h);
      ctx.restore();
      return;
    }

    if (d === 'h2') {
      // 兩色橫條（波蘭：上白下紅）
      ctx.fillStyle = colors[0];
      ctx.fillRect(x, y, w, h / 2);
      ctx.fillStyle = colors[1];
      ctx.fillRect(x, y + h / 2, w, h / 2);
      return;
    }

    if (d === 'cze') {
      // 捷克：上白下紅，左側一個藍色三角形楔入
      ctx.fillStyle = colors[0];              // 白
      ctx.fillRect(x, y, w, h / 2);
      ctx.fillStyle = colors[1];              // 紅
      ctx.fillRect(x, y + h / 2, w, h / 2);
      ctx.fillStyle = colors[2];              // 藍
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w * 0.5, y + h / 2);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();
      return;
    }

    if (d === 'cross') {
      // 瑞士：紅底白十字（實際是正方形，這裡配合版面用矩形）
      ctx.fillStyle = colors[0];
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#FFFFFF';
      const armW = w * 0.2, armH = h * 0.2;
      ctx.fillRect(x + w / 2 - armW / 2, y + h * 0.18, armW, h * 0.64);
      ctx.fillRect(x + w * 0.18, y + h / 2 - armH / 2, w * 0.64, armH);
      return;
    }

    if (d === 'greek') {
      // 希臘：9 條藍白橫紋 + 左上角藍底白十字
      const stripes = 9;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? colors[0] : '#FFFFFF';
        ctx.fillRect(x, y + i * (h / stripes), w, h / stripes + 0.5);
      }
      const cs = h * (5 / stripes);     // 角旗佔上面 5 條的高度
      ctx.fillStyle = colors[0];
      ctx.fillRect(x, y, cs, cs);
      ctx.fillStyle = '#FFFFFF';
      const aw = cs * 0.22;
      ctx.fillRect(x + cs / 2 - aw / 2, y, aw, cs);
      ctx.fillRect(x, y + cs / 2 - aw / 2, cs, aw);
      return;
    }

    if (d === 'star') {
      /*
       * 摩洛哥：紅底，正中央一顆綠色的五角星（空心的線條星，不是實心）。
       * 線寬隨旗子大小縮放，小旗（地圖上 18x12）也看得出是星星。
       */
      ctx.fillStyle = colors[0];
      ctx.fillRect(x, y, w, h);
      ctx.save();
      ctx.strokeStyle = colors[1];
      ctx.lineWidth = Math.max(1, h * 0.06);
      ctx.lineJoin = 'miter';
      const cx = x + w / 2, cy = y + h * 0.53, r = h * 0.3;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        // 五角星的一筆畫：每次跳兩個頂點
        const a = -Math.PI / 2 + i * 2 * (Math.PI * 2 / 5);
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      return;
    }

    /*
     * v1.23 非洲篇：新月＋星星的國旗。
     * 新月 = 一個圓再用「底色」的圓挖掉一塊（offset 往開口方向）。
     */
    if (d === 'dz') {
      // 阿爾及利亞：左綠右白，正中間紅色新月（開口朝右）＋紅星
      ctx.fillStyle = colors[0]; ctx.fillRect(x, y, w / 2, h);
      ctx.fillStyle = colors[1]; ctx.fillRect(x + w / 2, y, w / 2, h);
      crescent(ctx, x + w * 0.5, y + h / 2, h * 0.25, colors[2], function (cx, cy, r) {
        // 挖掉的那一圈橫跨綠白兩色：左半補綠、右半補白
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = colors[0]; ctx.fillRect(x, y, w / 2, h);
        ctx.fillStyle = colors[1]; ctx.fillRect(x + w / 2, y, w / 2, h);
        ctx.restore();
      });
      star5(ctx, x + w * 0.56, y + h / 2, h * 0.1, colors[2], -0.3);
      return;
    }
    if (d === 'tn') {
      // 突尼西亞：紅底，中央白色圓盤，裡面紅色新月（開口朝右）＋紅星
      ctx.fillStyle = colors[0]; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = colors[1];
      ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h * 0.25, 0, Math.PI * 2); ctx.fill();
      crescent(ctx, x + w / 2 - h * 0.02, y + h / 2, h * 0.19, colors[0], colors[1]);
      star5(ctx, x + w / 2 + h * 0.07, y + h / 2, h * 0.075, colors[0], -0.3);
      return;
    }
    if (d === 'ly') {
      // 利比亞：紅黑綠橫條（1:2:1），黑色帶中央白色新月＋白星
      ctx.fillStyle = colors[0]; ctx.fillRect(x, y, w, h / 4);
      ctx.fillStyle = colors[1]; ctx.fillRect(x, y + h / 4, w, h / 2);
      ctx.fillStyle = colors[2]; ctx.fillRect(x, y + h * 0.75, w, h / 4 + 0.5);
      crescent(ctx, x + w * 0.48, y + h / 2, h * 0.17, '#FFFFFF', colors[1]);
      star5(ctx, x + w * 0.57, y + h / 2, h * 0.07, '#FFFFFF', -0.3);
      return;
    }
    if (d === 'eg') {
      // 埃及：紅白黑橫三色，中央金色的薩拉丁之鷹（簡化成盾＋展翅）
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = colors[i];
        ctx.fillRect(x, y + i * (h / 3), w, h / 3 + 0.5);
      }
      const cx = x + w / 2, cy = y + h / 2;
      ctx.fillStyle = '#C09300';
      ctx.beginPath();
      ctx.moveTo(cx, cy - h * 0.13);
      ctx.lineTo(cx + h * 0.14, cy - h * 0.04); ctx.lineTo(cx + h * 0.06, cy + h * 0.12);
      ctx.lineTo(cx - h * 0.06, cy + h * 0.12); ctx.lineTo(cx - h * 0.14, cy - h * 0.04);
      ctx.closePath(); ctx.fill();
      return;
    }

    if (d === 'h') {
      // 橫三色
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = colors[i];
        ctx.fillRect(x, y + i * (h / 3), w, h / 3 + 0.5);
      }
      return;
    }

    if (d === 'nordic') {
      /*
       * v1.30 北歐十字旗：直條偏旗桿那側（中心約在 36%）。
       * colors = [底色, 十字, 內十字]；有內十字（挪威、冰島）時外十字當白邊，內十字細一半。
       */
      const cx = x + w * 0.36, cy = y + h / 2;
      const tw = h * (colors[2] ? 0.26 : 0.2);
      ctx.fillStyle = colors[0]; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = colors[1];
      ctx.fillRect(cx - tw / 2, y, tw, h);
      ctx.fillRect(x, cy - tw / 2, w, tw);
      if (colors[2]) {
        const ti = tw * 0.5;
        ctx.fillStyle = colors[2];
        ctx.fillRect(cx - ti / 2, y, ti, h);
        ctx.fillRect(x, cy - ti / 2, w, ti);
      }
      return;
    }

    // 直三色
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = colors[i];
      ctx.fillRect(x + i * (w / 3), y, w / 3 + 0.5, h);
    }
  }

  /** 新月：color 的圓，再用 bg（顏色字串，或 function(cx, cy, r) 自己補底）挖掉右邊一塊 → 開口朝右 */
  function crescent(ctx, cx, cy, r, color, bg) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    const ox = cx + r * 0.32, orr = r * 0.8;
    if (typeof bg === 'function') { bg(ox, cy, orr); return; }
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(ox, cy, orr, 0, Math.PI * 2); ctx.fill();
  }

  /** 實心五角星（rot = 旋轉，0 = 尖角朝上） */
  function star5(ctx, cx, cy, r, color, rot) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (rot || 0) + i * Math.PI / 5;
      const rr = i % 2 ? r * 0.42 : r;
      const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }

  /** 終點旗：旗杆 + 飄動的國旗 */
  function goalFlag(ctx, x, baseY, colors, t, dir) {
    ctx.save();
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(x - 3, baseY - 150, 6, 150);
    ctx.fillStyle = '#e0a94b';
    ctx.beginPath(); ctx.arc(x, baseY - 152, 6, 0, Math.PI * 2); ctx.fill();

    const fw = 72, fh = 48;
    const fx = x + 3, fy = baseY - 148;

    // 用波浪剪裁模擬飄動，旗面本身交給 flagFace 畫（條紋方向才會正確）
    ctx.save();
    ctx.beginPath();
    const wave = Math.sin(t * 0.08) * 4;
    ctx.moveTo(fx, fy);
    for (let i = 0; i <= 12; i++) {
      const tt = i / 12;
      ctx.lineTo(fx + tt * fw, fy + Math.sin(t * 0.08 + tt * 2.2) * 3 * tt);
    }
    for (let i = 12; i >= 0; i--) {
      const tt = i / 12;
      ctx.lineTo(fx + tt * fw, fy + fh + Math.sin(t * 0.08 + tt * 2.2) * 3 * tt);
    }
    ctx.closePath();
    ctx.clip();
    flagFace(ctx, fx, fy + wave * 0.2, fw, fh, colors, dir);
    ctx.restore();

    ctx.strokeStyle = 'rgba(20,24,36,0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(fx, fy, fw, fh);
    ctx.restore();
  }

  // ── 豎井關（小朋友下樓梯玩法） ──────────────────────────────

  /**
   * 一層樓梯。
   *
   * 每種型別都要「一眼看出是什麼」，否則玩家只能靠踩到才知道，
   * 那就變成記憶遊戲而不是反應遊戲：
   *   normal   木色平板
   *   spike    上面一排尖刺（紅色警示）
   *   convL/R  輸送帶，畫箭頭並會動
   *   spring   上面有彈簧圈
   *   crumble  裂縫紋路，踩過後會抖動
   */
  /*
   * v1.30：其他檔案登記的豎井主題（expedition.js 的冥界 'hel'、金字塔 'pyramid'）。
   * 每個主題 { backdrop(ctx, camY, t, W, H), wall(ctx, wall, camY, viewH, t), ceiling(ctx, top, h, w, t),
   *           floor(ctx, f, x, y, w, h, t) → true = 畫好了（false = 用預設畫法，例如滑台）}
   */
  const shaftThemes = {};

  function shaftFloor(ctx, f, t, theme) {
    const r = f.rect;
    const x = r.x, y = r.y, w = r.w, h = r.h;
    if (theme === 'atlantis' && atlantisFloor(ctx, f, x, y, w, h, t)) return;
    if (shaftThemes[theme] && shaftThemes[theme].floor(ctx, f, x, y, w, h, t)) return;

    if (f.goal && theme === 'opera') {
      // 歌劇院的終點：舞台地板（深色木板 + 金色台口線 + 腳燈）
      ctx.fillStyle = '#3a2418';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#d6b05c';
      ctx.fillRect(x, y, w, 4);
      for (let px = x + 20; px < x + w; px += 40) {
        const glow = ctx.createRadialGradient(px, y, 1, px, y, 18);
        glow.addColorStop(0, 'rgba(255, 230, 160, 0.7)');
        glow.addColorStop(1, 'rgba(255, 230, 160, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(px - 18, y - 18, 36, 20);
      }
      return;
    }

    if (f.goal && theme === 'bigben') {
      // 鐘塔的終點：大鐘室的地板（橡木 + 金邊 + 鉚釘）
      ctx.fillStyle = '#4a3222';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#e0b85a';
      ctx.fillRect(x, y, w, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let px = x + 30; px < x + w; px += 60) ctx.fillRect(px, y + 4, 2, h - 4);
      ctx.fillStyle = '#f3d27a';
      for (let px = x + 12; px < x + w; px += 30) {
        ctx.beginPath(); ctx.arc(px, y + 10, 1.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255, 220, 140, 0.25)';
      ctx.fillRect(x, y - 3, w, 3);
      return;
    }

    if (f.goal && theme === 'alps') {
      // 阿爾卑斯的終點：山頂積雪 + 登頂十字架
      ctx.fillStyle = '#6a7686';
      ctx.fillRect(x, y + 4, w, h - 4);
      ctx.fillStyle = '#f6fbff';
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      for (let px = x; px <= x + w; px += 24) ctx.quadraticCurveTo(px + 12, y - 4, px + 24, y + 6);
      ctx.lineTo(x + w, y + 10); ctx.lineTo(x, y + 10);
      ctx.closePath(); ctx.fill();
      // 十字架（阿爾卑斯山頂常見的登頂十字架）
      const cx = x + w - 70;
      ctx.fillStyle = '#5a3c26';
      ctx.fillRect(cx - 2.5, y - 58, 5, 60);
      ctx.fillRect(cx - 16, y - 44, 32, 5);
      return;
    }

    if (f.goal) {
      // 抵達層：整條金色平台，看起來就是終點
      ctx.fillStyle = '#6b5a3c';
      U.roundRect(ctx, x, y, w, h, 4); ctx.fill();
      ctx.fillStyle = '#e0a94b';
      U.roundRect(ctx, x, y, w, 6, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255, 220, 140, 0.25)';
      ctx.fillRect(x, y - 3, w, 3);
      return;
    }

    // 塌陷平台踩過後抖動，提示「要走了」
    let ox = 0;
    if (f.type === 'crumble' && f.touched) {
      ox = Math.sin(t * 0.9) * 1.6;
    }
    ctx.save();
    ctx.translate(ox, 0);

    if (f.type === 'spike') {
      // 底板
      ctx.fillStyle = '#5c4040';
      U.roundRect(ctx, x, y, w, h, 3); ctx.fill();
      ctx.fillStyle = '#8d5050';
      U.roundRect(ctx, x, y, w, 4, 2); ctx.fill();
      // 尖刺
      ctx.fillStyle = '#e0606b';
      const n = Math.max(3, Math.floor(w / 14));
      for (let i = 0; i < n; i++) {
        const sx = x + 4 + i * ((w - 8) / n);
        ctx.beginPath();
        ctx.moveTo(sx, y);
        ctx.lineTo(sx + (w - 8) / n / 2, y - 9);
        ctx.lineTo(sx + (w - 8) / n, y);
        ctx.closePath(); ctx.fill();
      }
    } else if (f.type === 'spring') {
      ctx.fillStyle = '#4a5a6b';
      U.roundRect(ctx, x, y, w, h, 3); ctx.fill();
      ctx.fillStyle = '#7f9ab5';
      U.roundRect(ctx, x, y, w, 4, 2); ctx.fill();
      // 彈簧圈
      ctx.strokeStyle = '#cfe0f5';
      ctx.lineWidth = 2.2;
      const cx = x + w / 2;
      const squash = f.touched && f.flash > 0 ? 3 : 0;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(cx, y - 4 - i * 4 + squash, 11, 2.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (f.type === 'convL' || f.type === 'convR') {
      ctx.fillStyle = '#4b4a58';
      U.roundRect(ctx, x, y, w, h, 3); ctx.fill();
      ctx.fillStyle = '#6f6e80';
      U.roundRect(ctx, x, y, w, 5, 2); ctx.fill();
      // 會動的箭頭
      const dir = f.type === 'convR' ? 1 : -1;
      ctx.fillStyle = '#ffd166';
      const step = 18;
      const off = ((t * 1.6 * dir) % step + step) % step;
      for (let sx = x + 4; sx < x + w - 10; sx += step) {
        const ax = sx + off;
        if (ax > x + w - 10) continue;
        ctx.beginPath();
        if (dir > 0) {
          ctx.moveTo(ax, y + 4); ctx.lineTo(ax + 7, y + h / 2); ctx.lineTo(ax, y + h - 2);
        } else {
          ctx.moveTo(ax + 7, y + 4); ctx.lineTo(ax, y + h / 2); ctx.lineTo(ax + 7, y + h - 2);
        }
        ctx.closePath(); ctx.fill();
      }
    } else if (f.type === 'crumble') {
      ctx.fillStyle = '#6b5f48';
      U.roundRect(ctx, x, y, w, h, 3); ctx.fill();
      ctx.fillStyle = '#9c8c6a';
      U.roundRect(ctx, x, y, w, 4, 2); ctx.fill();
      // 裂縫
      ctx.strokeStyle = 'rgba(30,24,16,0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.3, y);
      ctx.lineTo(x + w * 0.38, y + h);
      ctx.moveTo(x + w * 0.62, y);
      ctx.lineTo(x + w * 0.55, y + h);
      ctx.stroke();
    } else if (f.type === 'slide') {
      // 齒輪滑台：黃銅板 + 兩端的齒輪（跟著位移轉動，一看就知道會動）
      const spin = x * 0.08;
      gear(ctx, x + 8, y + h / 2, 11, 8, spin, '#8a6a2e', '#2a1c10');
      gear(ctx, x + w - 8, y + h / 2, 11, 8, -spin, '#8a6a2e', '#2a1c10');
      ctx.fillStyle = '#9a7432';
      U.roundRect(ctx, x + 6, y, w - 12, h, 3); ctx.fill();
      ctx.fillStyle = '#f0c868';
      U.roundRect(ctx, x + 6, y, w - 12, 4, 2); ctx.fill();
      // 左右箭頭提示「會滑動」
      ctx.fillStyle = 'rgba(40, 26, 10, 0.75)';
      const cx = x + w / 2, cy = y + h / 2 + 2;
      ctx.beginPath();
      ctx.moveTo(cx - 16, cy); ctx.lineTo(cx - 9, cy - 4); ctx.lineTo(cx - 9, cy + 4);
      ctx.moveTo(cx + 16, cy); ctx.lineTo(cx + 9, cy - 4); ctx.lineTo(cx + 9, cy + 4);
      ctx.fill();
      ctx.fillRect(cx - 9, cy - 1, 18, 2);
    } else if (f.type === 'beat') {
      /*
       * 節拍台：鋼琴鍵外觀。
       * 第 1 拍亮、第 2 拍開始閃（預告）、第 3 拍只剩虛線外框（踩不到）。
       * 上面三顆小燈顯示目前是第幾拍 —— 玩家看燈就能數拍子。
       */
      const on = f.beatOn !== false;
      const beat = f.beat || 0, k = f.beatK || 0;
      if (on) {
        const warn = beat === 1 && k > 0.5 && Math.floor(k * 12) % 2 === 0;
        ctx.globalAlpha = warn ? 0.55 : 1;
        ctx.fillStyle = '#f4efe2';
        U.roundRect(ctx, x, y, w, h, 3); ctx.fill();
        ctx.fillStyle = '#1a1a22';
        for (let kx = x + 10; kx < x + w - 8; kx += 16) ctx.fillRect(kx, y, 8, h * 0.6);
        ctx.fillStyle = '#d6b05c';
        ctx.fillRect(x, y + h - 3, w, 3);
        ctx.globalAlpha = 1;
      } else {
        ctx.strokeStyle = 'rgba(244, 239, 226, 0.45)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        U.roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 3); ctx.stroke();
        ctx.setLineDash([]);
      }
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i === beat ? (i === 2 ? '#ff6b7a' : '#ffd166') : 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.arc(x + w / 2 - 12 + i * 12, y - 6, 3, 0, Math.PI * 2); ctx.fill();
      }
    } else if (f.type === 'ice') {
      /*
       * 冰面：半透明的淡藍冰塊 + 斜向反光 + 一道會掃過去的亮光。
       * 跟積雪的木板（普通平台）一眼分得出來：沒有雪、整塊是亮藍色。
       */
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#e6f7ff');
      g.addColorStop(1, '#7cc4ea');
      ctx.fillStyle = g;
      U.roundRect(ctx, x, y, w, h, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(40, 110, 160, 0.55)';
      ctx.lineWidth = 1.2;
      U.roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 4); ctx.stroke();
      // 斜向反光
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2;
      for (let sx = x + 10; sx < x + w - 10; sx += 26) {
        ctx.beginPath(); ctx.moveTo(sx, y + h - 3); ctx.lineTo(sx + 8, y + 3); ctx.stroke();
      }
      // 掃過去的亮光（約 2.5 秒一次）
      const sweep = ((t * 2) % 300) - 40;
      if (sweep > 0 && sweep < w) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.fillRect(x + sweep, y + 1, 6, h - 2);
      }
      // 底下垂著的小冰柱
      ctx.fillStyle = 'rgba(190, 230, 250, 0.9)';
      for (let ix = x + 8; ix < x + w - 6; ix += 17) {
        const len = 5 + ((ix * 7) % 5);
        ctx.beginPath(); ctx.moveTo(ix, y + h); ctx.lineTo(ix + 3, y + h + len); ctx.lineTo(ix + 6, y + h); ctx.fill();
      }
    } else if (theme === 'alps') {
      // 阿爾卑斯的普通樓層：木板棧道 + 上面一層積雪（踩得穩、不會滑）
      ctx.fillStyle = '#6e4e32';
      U.roundRect(ctx, x, y + 3, w, h - 3, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(30, 18, 10, 0.4)';
      ctx.lineWidth = 1;
      for (let px = x + 18; px < x + w - 4; px += 18) {
        ctx.beginPath(); ctx.moveTo(px, y + 6); ctx.lineTo(px, y + h); ctx.stroke();
      }
      ctx.fillStyle = '#f7fbff';
      ctx.beginPath();
      ctx.moveTo(x - 1, y + 6);
      for (let px = x; px < x + w; px += 14) ctx.quadraticCurveTo(px + 7, y - 3, px + 14, y + 4);
      ctx.lineTo(x + w + 1, y + 6);
      ctx.closePath(); ctx.fill();
    } else if (theme === 'opera') {
      // 歌劇院的普通樓層：大理石板 + 金邊
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#f2ece0');
      g.addColorStop(1, '#bdb2a0');
      ctx.fillStyle = g;
      U.roundRect(ctx, x, y, w, h, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(120, 100, 90, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.2, y + 2); ctx.quadraticCurveTo(x + w * 0.4, y + 10, x + w * 0.62, y + 6);
      ctx.stroke();
      ctx.fillStyle = '#d6b05c';
      ctx.fillRect(x, y, w, 3);
      ctx.fillRect(x, y + h - 2, w, 2);
    } else if (theme === 'bigben') {
      // 鐘塔的普通樓層：深色橡木樑 + 黃銅端蓋 + 鉚釘
      ctx.fillStyle = '#5a3c26';
      U.roundRect(ctx, x, y, w, h, 3); ctx.fill();
      ctx.fillStyle = '#8a6040';
      ctx.fillRect(x + 4, y, w - 8, 4);
      ctx.strokeStyle = 'rgba(30, 18, 10, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 9); ctx.lineTo(x + w - 8, y + 9);
      ctx.stroke();
      ctx.fillStyle = '#d2a64e';
      ctx.fillRect(x, y, 7, h);
      ctx.fillRect(x + w - 7, y, 7, h);
      ctx.fillStyle = '#f3d27a';
      ctx.beginPath(); ctx.arc(x + 3.5, y + 8, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + w - 3.5, y + 8, 1.6, 0, Math.PI * 2); ctx.fill();
    } else {
      // normal
      ctx.fillStyle = '#7c6a52';
      U.roundRect(ctx, x, y, w, h, 4); ctx.fill();
      ctx.fillStyle = '#c9a06a';
      U.roundRect(ctx, x, y, w, 5, 3); ctx.fill();
    }

    // 剛踩到的高光
    if (f.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (f.flash / 8 * 0.3).toFixed(3) + ')';
      U.roundRect(ctx, x, y - 1, w, h + 2, 4); ctx.fill();
    }
    ctx.restore();
  }

  /**
   * climb 模式下方的追擊危險區（雪崩／湧水）。
   *
   * 跟尖刺天花板一樣畫在螢幕座標：它是「追著玩家」的壓力來源，
   * 固定在畫面下方才讀得出「還剩多少空間」。
   */
  function shaftFlood(ctx, screenTop, h, w, t, tint, theme) {
    // v1.30：主題自己畫追擊物（丹麥積木塔：湧上來的積木）
    if (theme && shaftThemes[theme] && shaftThemes[theme].flood) { shaftThemes[theme].flood(ctx, screenTop, h, w, t); return; }
    ctx.save();
    const c = tint || ['#e8f2fa', '#9fc4e0'];
    // 主體
    const g = ctx.createLinearGradient(0, screenTop, 0, screenTop + h);
    g.addColorStop(0, c[0]);
    g.addColorStop(1, c[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, screenTop + 8, w, h);

    // 翻騰的表面（兩層不同頻率的波，看起來比較亂、比較急）
    ctx.fillStyle = c[0];
    ctx.beginPath();
    ctx.moveTo(0, screenTop + 14);
    for (let x = 0; x <= w; x += 8) {
      const y = screenTop + 10
        + Math.sin((x + t * 3.2) * 0.035) * 5
        + Math.sin((x - t * 2.1) * 0.017) * 3;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, screenTop + h);
    ctx.lineTo(0, screenTop + h);
    ctx.closePath();
    ctx.fill();

    // 浪花顆粒
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 26; i++) {
      const px = ((i * 137 + t * 2.4) % (w + 40)) - 20;
      const py = screenTop + 6 + Math.sin((px + t * 3) * 0.04) * 5
        + (i % 3) * 3;
      ctx.fillRect(px, py, 3, 3);
    }
    ctx.restore();
  }

  // ── 東歐交通關（v1.20）：東方快車、纜車 ─────────────────────────

  /*
   * 東方快車的車廂（螢幕座標 x、世界座標 y = 車頂）。
   * 車頂 y 就是玩家站的地面；車身往下 52px、車輪再往下，底下是鐵軌（trainTrack）。
   * 配色照東方快車的經典塗裝：深藍車身、金色腰線、亮著暖燈的窗戶。
   * opts.loco：這節是車頭（最右邊 260px 畫成蒸汽機車頭，前面是終點）。
   * opts.coupleTo：跟下一節之間的距離，畫連結器（不能站，只是看的）。
   */
  function trainCar(ctx, sx, y, w, t, opts) {
    opts = opts || {};
    const bodyH = 52;
    const locoW = opts.loco ? Math.min(260, w * 0.45) : 0;
    const carW = w - locoW;

    // 連結器：車廂之間一根鐵桿 + 風擋布（在車身中段，碰不到）
    if (opts.coupleTo > 0) {
      ctx.fillStyle = '#2a2a30';
      ctx.fillRect(sx + w - 2, y + 34, opts.coupleTo + 4, 6);
      ctx.fillStyle = 'rgba(60, 50, 40, 0.8)';
      ctx.fillRect(sx + w, y + 10, 6, 30);
      ctx.fillRect(sx + w + opts.coupleTo - 6, y + 10, 6, 30);
    }

    // 車輪（每節兩組轉向架；轉得很快）
    const spin = t * 0.35;
    function wheel(cx, r) {
      ctx.fillStyle = '#1c1c22';
      ctx.beginPath(); ctx.arc(cx, y + bodyH + 12, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8a8a96';
      ctx.lineWidth = 1.6;
      for (let k = 0; k < 3; k++) {
        const a = spin + k * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(cx - Math.cos(a) * (r - 2), y + bodyH + 12 - Math.sin(a) * (r - 2));
        ctx.lineTo(cx + Math.cos(a) * (r - 2), y + bodyH + 12 + Math.sin(a) * (r - 2));
        ctx.stroke();
      }
    }
    [28, 56, carW - 56, carW - 28].forEach(function (wx) { if (wx > 10 && wx < carW - 10) wheel(sx + wx, 9); });

    // 車身
    ctx.fillStyle = '#1d2a4f';
    U.roundRect(ctx, sx, y + 4, carW, bodyH - 4, 4); ctx.fill();
    // 車頂（玩家站的那一條）：深灰弧頂
    ctx.fillStyle = '#4a4e5a';
    U.roundRect(ctx, sx - 2, y, carW + 4, 8, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(sx + 4, y + 1, carW - 8, 2);
    // 金色腰線
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(sx + 2, y + 13, carW - 4, 2);
    ctx.fillRect(sx + 2, y + bodyH - 8, carW - 4, 2);
    // 窗戶：暖黃燈光，偶爾一扇是暗的（有人拉窗簾）
    for (let wx = 18, k = 0; wx < carW - 30; wx += 40, k++) {
      const lit = ((k + (opts.idx || 0) * 3) % 5) !== 2;
      ctx.fillStyle = lit ? '#f6d68a' : '#46506e';
      U.roundRect(ctx, sx + wx, y + 19, 24, 17, 3); ctx.fill();
      ctx.fillStyle = 'rgba(29, 42, 79, 0.6)';
      ctx.fillRect(sx + wx + 11, y + 19, 2, 17);
    }
    // 車廂兩端的門
    ctx.fillStyle = '#16203c';
    ctx.fillRect(sx + 4, y + 16, 8, bodyH - 22);
    ctx.fillRect(sx + carW - 12, y + 16, 8, bodyH - 22);

    if (!locoW) return;

    // ── 蒸汽車頭：鍋爐（圓筒）+ 煙囪 + 排障器，車頂一樣可以站 ──
    const lx = sx + carW;
    [40, 92, 150, locoW - 40].forEach(function (wx) { wheel(lx + wx, wx < 120 ? 13 : 9); });
    ctx.fillStyle = '#23252c';
    U.roundRect(ctx, lx, y + 4, locoW - 24, bodyH - 10, 10); ctx.fill();
    ctx.fillStyle = '#4a4e5a';
    U.roundRect(ctx, lx - 2, y, locoW - 20, 8, 4); ctx.fill();
    // 紅色飾條 + 黃銅環
    ctx.fillStyle = '#a3262e';
    ctx.fillRect(lx, y + bodyH - 12, locoW - 24, 4);
    ctx.fillStyle = '#d6b05c';
    for (let bx = lx + 50; bx < lx + locoW - 40; bx += 46) ctx.fillRect(bx, y + 6, 3, bodyH - 16);
    // 煙囪（裝飾，比車頂高；不能站）
    const cx = lx + locoW - 60;
    ctx.fillStyle = '#1a1b20';
    ctx.fillRect(cx - 9, y - 30, 18, 32);
    ctx.fillRect(cx - 13, y - 34, 26, 7);
    // 排障器
    ctx.fillStyle = '#a3262e';
    ctx.beginPath();
    ctx.moveTo(lx + locoW - 24, y + 20);
    ctx.lineTo(lx + locoW, y + bodyH + 8);
    ctx.lineTo(lx + locoW - 24, y + bodyH + 8);
    ctx.closePath(); ctx.fill();
    // 頭燈
    ctx.fillStyle = '#fff2b0';
    ctx.beginPath(); ctx.arc(lx + locoW - 26, y + 18, 5, 0, Math.PI * 2); ctx.fill();
    // 煙：一顆顆往後（左上）飄、慢慢變大變淡
    for (let k = 0; k < 7; k++) {
      const life = ((t * 1.2 + k * 26) % 180) / 180;      // 0 → 1
      const px = cx - life * 260, py = y - 40 - life * 90 + Math.sin(life * 6 + k) * 6;
      ctx.fillStyle = 'rgba(235, 235, 240, ' + (0.55 * (1 - life)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(px, py, 10 + life * 26, 0, Math.PI * 2); ctx.fill();
    }
  }

  /**
   * 火車底下的鐵軌與路邊（螢幕座標）。整列車在世界裡不動，靠這層往後飛做出速度感：
   *   電線桿（每 420px 一根、比鏡頭快一點往後退）、枕木（飛快往後）、兩條鋼軌、碎石道床。
   */
  function trainTrack(ctx, camX, t, W, groundY) {
    const RUN = 9;                       // 車速（px/帧）
    ctx.save();
    // 電線桿與電線（在火車後面）
    const pole = 420;
    const off = ((camX * 1.0 + t * RUN * 0.8) % pole + pole) % pole;
    ctx.strokeStyle = 'rgba(40, 34, 30, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, groundY - 96); ctx.lineTo(W, groundY - 92);
    ctx.moveTo(0, groundY - 82); ctx.lineTo(W, groundY - 78);
    ctx.stroke();
    for (let px = -off; px < W + pole; px += pole) {
      ctx.fillStyle = '#5a4630';
      ctx.fillRect(px, groundY - 110, 6, 190);
      ctx.fillRect(px - 14, groundY - 100, 34, 4);
      ctx.fillRect(px - 10, groundY - 86, 26, 3);
    }
    // 碎石道床
    ctx.fillStyle = '#6e6658';
    ctx.fillRect(0, groundY + 70, W, 20);
    // 枕木（飛快往後）
    const sl = 34;
    const so = ((camX + t * RUN) % sl + sl) % sl;
    ctx.fillStyle = '#4a3624';
    for (let px = -so; px < W + sl; px += sl) ctx.fillRect(px, groundY + 72, 20, 6);
    // 鋼軌
    ctx.fillStyle = '#b8bcc6';
    ctx.fillRect(0, groundY + 69, W, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, groundY + 72, W, 1);
    ctx.restore();
  }

  /**
   * 纜車（世界座標的 mover → 螢幕座標畫）：纜線、兩頭的塔架、吊臂、車廂。
   * 平台本身（m.y 起 18px）是車廂地板，玩家站在上面；車廂外框、車頂只是看的。
   * gust：斯洛伐克起風時車廂晃得比較大（風不會把坐纜車的人吹下去，見 Features gusts）。
   * ⚠️ 名字不能叫 gondola：上面已經有義大利的貢多拉船道具（同名函式會互相蓋掉）。
   */
  function cableGondola(ctx, m, camX, t, gust, W, id) {
    const left = m.ox - m.range, right = m.ox + m.range + m.w;      // 行程兩端（世界 x）
    if (right - camX < -60 || left - camX > W + 60) return;
    const cableY = m.oy - 84;
    const ax = left - 26 - camX, bx = right + 26 - camX;
    ctx.save();
    // 塔架（站在月台上）
    ctx.fillStyle = '#5a5e6a';
    [ax, bx].forEach(function (x) {
      ctx.fillRect(x - 4, cableY - 8, 8, m.oy - cableY + 8);
      ctx.fillRect(x - 14, cableY - 10, 28, 6);
    });
    // 纜線（中間微微下垂）
    ctx.strokeStyle = '#2c2c34';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, cableY - 6);
    ctx.quadraticCurveTo((ax + bx) / 2, cableY + 10, bx, cableY - 6);
    ctx.stroke();

    // 車廂：掛在纜線上的點（跟纜線下垂一致），以吊點為軸心晃動
    const sx = m.x - camX;
    const hx = sx + m.w / 2;
    const k = U.clamp((hx - ax) / Math.max(1, bx - ax), 0, 1);
    const hy = cableY - 6 + 16 * 2 * k * (1 - k);      // 二次貝茲在 k 的 y
    const sway = Math.sin(t * 0.05 + m.ox * 0.01) * (gust ? 0.07 : 0.025);
    ctx.translate(hx, hy);
    ctx.rotate(sway);
    ctx.translate(-hx, -hy);
    // 吊臂
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(hx - 2, hy, 4, m.y - 62 - hy);
    ctx.beginPath(); ctx.arc(hx, hy + 2, 5, 0, Math.PI * 2); ctx.fill();
    // 車頂
    const body = id === 'HR' ? '#2d6fb5' : '#c8323c';    // 克羅埃西亞藍、斯洛伐克紅
    ctx.fillStyle = body;
    U.roundRect(ctx, sx - 4, m.y - 64, m.w + 8, 12, 6); ctx.fill();
    // 兩側柱子 + 半截窗（中間鏤空，看得到裡面的玩家）
    ctx.fillRect(sx, m.y - 54, 6, 54);
    ctx.fillRect(sx + m.w - 6, m.y - 54, 6, 54);
    ctx.fillStyle = 'rgba(200, 225, 245, 0.25)';
    ctx.fillRect(sx + 6, m.y - 54, m.w - 12, 30);
    // 地板（可以站的那一條）
    ctx.fillStyle = '#2a2a32';
    U.roundRect(ctx, sx - 2, m.y, m.w + 4, m.h, 4); ctx.fill();
    ctx.fillStyle = body;
    ctx.fillRect(sx - 2, m.y, m.w + 4, 4);
    ctx.restore();
  }

  /** 纜車關的谷底：比地面低很多的森林剪影（視差 0.6，遠一點、霧一點） */
  function valleyFloor(ctx, camX, W, H, groundY, hill) {
    ctx.save();
    const top = groundY + 22;
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, 'rgba(120, 150, 170, 0.35)');
    g.addColorStop(1, 'rgba(50, 70, 80, 0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H - top);
    ctx.fillStyle = hill || '#5a7060';
    ctx.globalAlpha = 0.7;
    const off = ((camX * 0.6) % 46 + 46) % 46;
    for (let x = -off - 46; x < W + 46; x += 46) {
      const h = 26 + ((Math.round((x + camX * 0.6) / 46) * 37) % 3 + 3) % 3 * 9;
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x + 23, H - 30 - h);
      ctx.lineTo(x + 46, H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // ── 瑞士阿爾卑斯主題（theme: 'alps'） ─────────────────────────

  /** 一座雪峰：山體 + 山頂積雪（積雪用同一個三角形往下截一段） */
  function snowPeak(ctx, cx, baseY, halfW, hgt, body, snow) {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(cx - halfW, baseY); ctx.lineTo(cx, baseY - hgt); ctx.lineTo(cx + halfW, baseY);
    ctx.closePath(); ctx.fill();
    const k = 0.32;     // 積雪佔山高的比例
    ctx.fillStyle = snow;
    ctx.beginPath();
    ctx.moveTo(cx - halfW * k, baseY - hgt * (1 - k));
    ctx.lineTo(cx, baseY - hgt);
    ctx.lineTo(cx + halfW * k, baseY - hgt * (1 - k));
    // 雪線不是直的：鋸齒往下
    ctx.lineTo(cx + halfW * k * 0.5, baseY - hgt * (1 - k) + 8);
    ctx.lineTo(cx, baseY - hgt * (1 - k) - 2);
    ctx.lineTo(cx - halfW * k * 0.45, baseY - hgt * (1 - k) + 10);
    ctx.closePath(); ctx.fill();
  }

  /**
   * 阿爾卑斯的背景（螢幕座標，自己算視差）。
   *   遠：一排排雪峰，越往上爬越往下沉（像離山谷越來越遠）
   *   中：馬特洪峰（歪頭的金字塔形，一眼認得出），每爬一大段經過一次
   *   近：飄過的雲、落下的雪花
   * 顏色刻意淡：平台與岩壁要跟背景分得開。
   */
  function alpsBackdrop(ctx, camY, t, W, H) {
    ctx.save();

    // 遠景群峰（視差 0.15，每 520 一排）
    const farY = camY * 0.15;
    const ROW = 520;
    const r0 = Math.floor((farY - 200) / ROW);
    for (let i = r0; i < r0 + Math.ceil(H / ROW) + 2; i++) {
      const base = i * ROW + 420 - farY;
      if (base < -40 || base > H + 300) continue;
      for (let k = 0; k < 6; k++) {
        const cx = ((k * 211 + i * 97) % 1100) - 70;
        const hw = 110 + ((k * 37 + i * 13) % 70);
        const hg = 120 + ((k * 53 + i * 29) % 90);
        snowPeak(ctx, cx, base, hw, hg, 'rgba(96, 128, 160, 0.35)', 'rgba(250, 252, 255, 0.55)');
      }
    }

    // 中景：馬特洪峰（視差 0.3，每 1500 經過一座）
    const midY = camY * 0.3;
    const MH = 1500;
    const m0 = Math.floor((midY - 300) / MH);
    for (let i = m0; i < m0 + 3; i++) {
      const base = i * MH + 520 - midY;
      if (base < -20 || base > H + 420) continue;
      const cx = 480 + ((i % 2) ? 120 : -120);
      ctx.fillStyle = 'rgba(74, 96, 122, 0.42)';
      ctx.beginPath();
      // 馬特洪峰的形：東壁陡、山頂往右勾一點
      ctx.moveTo(cx - 230, base);
      ctx.lineTo(cx - 40, base - 250);
      ctx.lineTo(cx + 6, base - 330);
      ctx.lineTo(cx + 26, base - 312);
      ctx.lineTo(cx + 70, base - 220);
      ctx.lineTo(cx + 240, base);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(252, 253, 255, 0.6)';
      ctx.beginPath();
      ctx.moveTo(cx - 52, base - 236);
      ctx.lineTo(cx + 6, base - 330);
      ctx.lineTo(cx + 26, base - 312);
      ctx.lineTo(cx + 56, base - 246);
      ctx.lineTo(cx + 30, base - 256);
      ctx.lineTo(cx + 8, base - 240);
      ctx.lineTo(cx - 20, base - 252);
      ctx.closePath(); ctx.fill();
    }

    // 近景：雲（視差 0.55，橫向慢慢飄）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
    for (let i = 0; i < 6; i++) {
      const px = ((i * 263 + t * (0.15 + (i % 3) * 0.05)) % (W + 300)) - 150;
      const py = (((i * 331) - camY * 0.55) % (H + 200) + H + 200) % (H + 200) - 100;
      ctx.beginPath();
      ctx.ellipse(px, py, 70, 16, 0, 0, Math.PI * 2);
      ctx.ellipse(px + 40, py - 8, 46, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 雪花：斜斜地往下飄（跟爬的方向相反，更有「往上」的感覺）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 46; i++) {
      const px = (((i * 157) + Math.sin(t * 0.02 + i) * 14 + t * 0.3) % W + W) % W;
      const py = (((i * 211) - camY * 0.9 + t * (0.7 + (i % 4) * 0.2)) % H + H) % H;
      const s = 1.5 + (i % 3) * 0.7;
      ctx.fillRect(px, py, s, s);
    }

    ctx.restore();
  }

  /** 阿爾卑斯的岩壁：灰藍岩層 + 內緣的積雪與冰柱（世界座標，跟著捲動） */
  function alpsWall(ctx, wall, camY, viewH) {
    const g = ctx.createLinearGradient(wall.x, 0, wall.x + wall.w, 0);
    const leftSide = wall.x < 480;
    g.addColorStop(leftSide ? 0 : 1, '#3e4a5a');
    g.addColorStop(leftSide ? 1 : 0, '#66788c');
    ctx.fillStyle = g;
    ctx.fillRect(wall.x, camY - 20, wall.w, viewH + 40);

    const inner = leftSide ? wall.x + wall.w : wall.x;
    const out = leftSide ? -1 : 1;     // 往岩壁裡面的方向
    const STEP = 70;
    const y0 = Math.floor((camY - 80) / STEP) * STEP;
    for (let wy = y0; wy < camY + viewH + 80; wy += STEP) {
      const h = (wy * 7919) % 97;      // 每段的固定亂數，捲動時不會閃
      // 岩層裂縫
      ctx.strokeStyle = 'rgba(25, 32, 44, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(inner + out * 6, wy + h % 30);
      ctx.lineTo(inner + out * (40 + h % 40), wy + 18 + h % 20);
      ctx.lineTo(inner + out * (90 + h % 50), wy + 10 + h % 26);
      ctx.stroke();
      // 內緣的積雪小台
      ctx.fillStyle = '#f2f8fd';
      ctx.beginPath();
      ctx.ellipse(inner + out * 10, wy + 40, 16, 6, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(inner + out * 10 - (leftSide ? 16 : 0), wy + 40, 16, 3);
      // 冰柱
      ctx.fillStyle = 'rgba(200, 236, 252, 0.85)';
      for (let k = 0; k < 3; k++) {
        const ix = inner + out * (4 + k * 7) - (leftSide ? 4 : 0);
        ctx.beginPath(); ctx.moveTo(ix, wy + 43); ctx.lineTo(ix + 2, wy + 52 + (h + k * 3) % 8); ctx.lineTo(ix + 4, wy + 43); ctx.fill();
      }
    }
    // 內緣亮線（跟其他井一樣，讓邊界清楚）
    ctx.strokeStyle = 'rgba(230, 242, 252, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(inner, camY - 20);
    ctx.lineTo(inner, camY + viewH + 20);
    ctx.stroke();
  }

  // ── 英國鐘塔主題（theme: 'bigben'） ─────────────────────────

  /** 齒輪：外圈齒、輪輻、軸心。a = 旋轉角 */
  function gear(ctx, x, y, r, teeth, a, fill, hole) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = fill;
    ctx.beginPath();
    const tw = Math.PI / teeth;
    for (let i = 0; i < teeth * 2; i++) {
      const rr = i % 2 === 0 ? r : r * 0.86;
      const a0 = i * tw - tw * 0.5, a1 = i * tw + tw * 0.5;
      ctx.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
      ctx.lineTo(Math.cos(a1) * rr, Math.sin(a1) * rr);
    }
    ctx.closePath();
    ctx.fill();
    // 鏤空：內圈 + 輪輻之間的空隙
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 5; i++) {
      const sa = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa + 0.18) * r * 0.24, Math.sin(sa + 0.18) * r * 0.24);
      ctx.arc(0, 0, r * 0.66, sa + 0.18, sa + Math.PI * 2 / 5 - 0.18);
      ctx.lineTo(Math.cos(sa + Math.PI * 2 / 5 - 0.18) * r * 0.24,
                 Math.sin(sa + Math.PI * 2 / 5 - 0.18) * r * 0.24);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = hole || 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /**
   * 從鐘塔內部看出去的大鐘面（背光乳白玻璃 + 鑄鐵窗格）。
   * 從裡面看是鏡像的，所以指針逆時針走 —— 小細節，但看得出是「在鐘的背後」。
   */
  function clockDialBack(ctx, x, y, r, t) {
    ctx.save();
    // 外圈光暈
    const halo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.5);
    halo.addColorStop(0, 'rgba(255, 214, 130, 0.22)');
    halo.addColorStop(1, 'rgba(255, 214, 130, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - r * 1.5, y - r * 1.5, r * 3, r * 3);
    // 乳白玻璃
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    // 透明度刻意壓低：鐘面在平台後面，太亮會讓木色平台失去對比
    g.addColorStop(0, 'rgba(255, 244, 205, 0.40)');
    g.addColorStop(1, 'rgba(232, 180, 92, 0.30)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    // 鑄鐵窗格：同心圓 + 放射條
    ctx.strokeStyle = 'rgba(40, 28, 22, 0.85)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2.2;
    [0.78, 0.5, 0.22].forEach(function (k) {
      ctx.beginPath(); ctx.arc(x, y, r * k, 0, Math.PI * 2); ctx.stroke();
    });
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.22, y + Math.sin(a) * r * 0.22);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.stroke();
      // 刻度塊（羅馬數字的位置）
      ctx.fillStyle = 'rgba(40, 28, 22, 0.8)';
      ctx.save();
      ctx.translate(x + Math.cos(a) * r * 0.89, y + Math.sin(a) * r * 0.89);
      ctx.rotate(a);
      ctx.fillRect(-5, -2.5, 10, 5);
      ctx.restore();
    }
    // 指針（鏡像：逆時針）
    const ha = -t * 0.0009 - 1.2, ma = -t * 0.011;
    ctx.strokeStyle = 'rgba(30, 20, 16, 0.92)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ha) * r * 0.5, y + Math.sin(ha) * r * 0.5); ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ma) * r * 0.78, y + Math.sin(ma) * r * 0.78); ctx.stroke();
    ctx.fillStyle = '#2a1c16';
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /**
   * 鐘塔內部的背景（螢幕座標，自己算視差）。
   *
   * 三層，越遠捲得越慢，玩家往下掉時才有「很深」的感覺：
   *   遠：大型齒輪剪影，慢慢轉
   *   中：背光大鐘面（每隔一段出現一次，像經過鐘室）、垂下的鐘錘鍊條
   *   近：飄動的灰塵光點
   */
  function shaftBackdrop(ctx, theme, camY, t, W, H) {
    if (theme === 'atlantis') { atlantisBackdrop(ctx, camY, t, W, H); return; }
    if (shaftThemes[theme]) { shaftThemes[theme].backdrop(ctx, camY, t, W, H); return; }
    if (theme === 'opera') { operaBackdrop(ctx, camY, t, W, H); return; }
    if (theme === 'alps') { alpsBackdrop(ctx, camY, t, W, H); return; }
    if (theme !== 'bigben') return;
    ctx.save();

    // 遠景齒輪（視差 0.3）
    const farY = camY * 0.3;
    const GEAR_STEP = 230;
    const g0 = Math.floor((farY - 120) / GEAR_STEP);
    for (let i = g0; i < g0 + Math.ceil(H / GEAR_STEP) + 3; i++) {
      const sy = i * GEAR_STEP - farY;
      const side = ((i % 2) + 2) % 2;
      const gx = side ? 640 + ((i * 53) % 90) : 250 + ((i * 37) % 80);
      const r = 70 + ((i * 29) % 40);
      const dir = side ? 1 : -1;
      gear(ctx, gx, sy, r, 14 + (i % 3) * 2, dir * t * 0.004 + i, 'rgba(98, 70, 46, 0.32)');
      // 咬合的小齒輪
      gear(ctx, gx + dir * -r * 1.05, sy + r * 0.55, r * 0.45, 9, -dir * t * 0.009 + i,
        'rgba(110, 80, 50, 0.28)');
    }

    // 中景：鐘鍊（視差 0.6）
    const midY = camY * 0.6;
    ctx.strokeStyle = 'rgba(150, 120, 70, 0.28)';
    ctx.lineWidth = 2;
    [300, 342, 618, 660].forEach(function (cx, k) {
      ctx.setLineDash([4, 3]);
      ctx.lineDashOffset = -midY * (k % 2 ? 1 : -1) * 0.3;
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
    });
    ctx.setLineDash([]);

    // 中景：背光鐘面（每 900 一座）
    const DIAL_STEP = 900;
    const d0 = Math.floor((midY - 200) / DIAL_STEP);
    for (let i = d0; i < d0 + 3; i++) {
      const sy = i * DIAL_STEP + 260 - midY;
      if (sy < -220 || sy > H + 220) continue;
      clockDialBack(ctx, 480, sy, 150, t + i * 4000);
    }

    // 近景：灰塵光點，緩緩上飄
    ctx.fillStyle = 'rgba(255, 226, 160, 0.35)';
    for (let i = 0; i < 34; i++) {
      const px = 200 + ((i * 173) % 560) + Math.sin(t * 0.01 + i) * 8;
      const py = (((i * 211) - camY * 0.9 - t * 0.25) % H + H) % H;
      ctx.fillRect(px, py, 2, 2);
    }

    ctx.restore();
  }

  // ── 奧地利歌劇院主題（theme: 'opera'） ─────────────────────

  /** 水晶吊燈：金色骨架 + 一圈燭火 + 垂下的水晶 */
  function chandelier(ctx, x, y, s, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 0.012 + x) * 0.03);   // 微微晃動
    ctx.scale(s, s);
    // 吊鍊
    ctx.strokeStyle = 'rgba(214, 176, 92, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -400); ctx.lineTo(0, -30); ctx.stroke();
    // 光暈
    const g = ctx.createRadialGradient(0, 10, 4, 0, 10, 120);
    g.addColorStop(0, 'rgba(255, 226, 150, 0.4)');
    g.addColorStop(1, 'rgba(255, 226, 150, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 10, 120, 0, Math.PI * 2); ctx.fill();
    // 骨架：三層弧
    ctx.strokeStyle = '#d6b05c';
    ctx.lineWidth = 3;
    [[60, 18], [44, 2], [26, -16]].forEach(function (a) {
      ctx.beginPath(); ctx.ellipse(0, a[1], a[0], a[0] * 0.22, 0, 0, Math.PI); ctx.stroke();
    });
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, 36); ctx.stroke();
    // 燭火
    for (let i = 0; i < 9; i++) {
      const a = (i / 8) * Math.PI;
      const cx = Math.cos(a) * 60, cy = 18 + Math.sin(a) * 13;
      ctx.fillStyle = '#f4e3b0';
      ctx.fillRect(cx - 1.5, cy - 8, 3, 8);
      ctx.fillStyle = 'rgba(255, 214, 120, ' + (0.75 + Math.sin(t * 0.2 + i) * 0.2).toFixed(2) + ')';
      ctx.beginPath(); ctx.ellipse(cx, cy - 11, 2.4, 4, 0, 0, Math.PI * 2); ctx.fill();
    }
    // 水晶垂飾
    ctx.fillStyle = 'rgba(220, 240, 255, 0.8)';
    for (let i = -4; i <= 4; i++) {
      const cx = i * 12, len = 14 + (4 - Math.abs(i)) * 5;
      ctx.beginPath();
      ctx.moveTo(cx - 2, 26); ctx.lineTo(cx, 26 + len); ctx.lineTo(cx + 2, 26);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /**
   * 歌劇院背景：深紅絨布色的觀眾席 + 水晶吊燈（遠景）+ 掃動的舞台光（中景）
   * + 飄起的音符（近景）。三層視差。
   */
  function operaBackdrop(ctx, camY, t, W, H) {
    ctx.save();
    // 遠景：一排排觀眾席的弧形（暗金線條）
    const farY = camY * 0.25;
    ctx.strokeStyle = 'rgba(214, 176, 92, 0.12)';
    ctx.lineWidth = 2;
    for (let i = Math.floor((farY - 60) / 60); i < Math.floor((farY + H) / 60) + 2; i++) {
      const y = i * 60 - farY;
      ctx.beginPath();
      ctx.ellipse(W / 2, y + 200, 360, 200, 0, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
    }

    // 中景：吊燈（視差 0.45），每 520 一盞，左右交錯
    const midY = camY * 0.45;
    const STEP = 520;
    for (let i = Math.floor((midY - 300) / STEP); i < Math.floor((midY + H + 300) / STEP) + 1; i++) {
      const y = i * STEP + 160 - midY;
      const x = (i % 2 === 0) ? 360 : 600;
      chandelier(ctx, x, y, 0.9, t + i * 100);
    }

    // 舞台光：兩道從上方掃下來的光束
    for (let k = 0; k < 2; k++) {
      const sw = Math.sin(t * 0.008 + k * 2.2) * 0.35;
      const ox = k === 0 ? 300 : 660;
      ctx.save();
      ctx.translate(ox, -40);
      ctx.rotate(sw);
      const g = ctx.createLinearGradient(0, 0, 0, H + 80);
      g.addColorStop(0, 'rgba(255, 240, 200, 0.16)');
      g.addColorStop(1, 'rgba(255, 240, 200, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.lineTo(110, H + 80); ctx.lineTo(-110, H + 80);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // 近景：飄起的音符（純裝飾，比較淡，跟會傷人的音符區分）
    for (let i = 0; i < 14; i++) {
      const px = 200 + ((i * 197) % 560) + Math.sin(t * 0.02 + i) * 14;
      const py = (((i * 263) - camY * 0.8 - t * 0.4) % (H + 40) + H + 40) % (H + 40) - 20;
      musicNote(ctx, px, py, 0.7, 'rgba(255, 220, 160, 0.18)', i % 2);
    }
    ctx.restore();
  }

  /** 音符符號（八分音符 / 雙八分音符） */
  function musicNote(ctx, x, y, s, color, dbl) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.ellipse(-4, 6, 6, 4.2, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(1.6, 5); ctx.lineTo(1.6, -14); ctx.stroke();
    if (dbl) {
      ctx.beginPath(); ctx.ellipse(12, 2, 6, 4.2, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(17.6, 1); ctx.lineTo(17.6, -18); ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(1.6, -14); ctx.lineTo(17.6, -18); ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(1.6, -14); ctx.quadraticCurveTo(10, -10, 8, -2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * 會傷人的飛行音符：金色、有紅色光圈、拖著殘影 ——
   * 跟背景那些淡淡的裝飾音符一眼就分得出來。
   */
  function noteHazard(ctx, pd, t) {
    ctx.save();
    const dir = (pd.va || 0) >= 0 ? 1 : -1;
    for (let k = 3; k >= 1; k--) {
      ctx.globalAlpha = 0.12 * (4 - k);
      musicNote(ctx, pd.x - dir * k * 9, pd.y, 1.2, '#ffcf6a', 1);
    }
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(pd.x + 4, pd.y, 2, pd.x + 4, pd.y, 22);
    g.addColorStop(0, 'rgba(255, 120, 110, 0.4)');
    g.addColorStop(1, 'rgba(255, 120, 110, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(pd.x + 4, pd.y, 22, 0, Math.PI * 2); ctx.fill();
    musicNote(ctx, pd.x, pd.y, 1.2, '#ffd166', 1);
    ctx.restore();
  }

  /** 歌劇院牆：一格格金框包廂，裡面是紅絨布和觀眾剪影 */
  function operaWall(ctx, wall, camY, viewH, t) {
    const top = camY - 20, bot = camY + viewH + 20;
    ctx.fillStyle = '#3a0f1a';
    ctx.fillRect(wall.x, top, wall.w, bot - top);
    const left = wall.x < 480;
    const BOX = 106;                     // 一層包廂一樓高，跟層距差不多
    for (let i = Math.floor(top / BOX); i <= Math.ceil(bot / BOX); i++) {
      const by = i * BOX;
      const bx = wall.x + 14, bw = wall.w - 28;
      // 包廂內部（紅絨布）
      const g = ctx.createLinearGradient(0, by + 14, 0, by + 84);
      g.addColorStop(0, '#7a1a28');
      g.addColorStop(1, '#4a0c18');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(bx, by + 84);
      ctx.lineTo(bx, by + 34);
      ctx.quadraticCurveTo(bx + bw / 2, by + 6, bx + bw, by + 34);
      ctx.lineTo(bx + bw, by + 84);
      ctx.closePath(); ctx.fill();
      // 觀眾剪影（每格不一樣，用 i 當種子）
      ctx.fillStyle = 'rgba(20, 6, 10, 0.75)';
      for (let k = 0; k < 3; k++) {
        if (((i * 7 + k * 3) % 5) === 0) continue;
        const hx = bx + 20 + k * (bw - 40) / 2;
        const bob = Math.sin(t * 0.04 + i + k) * 1.2;
        ctx.beginPath(); ctx.arc(hx, by + 60 + bob, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(hx - 9, by + 66 + bob, 18, 14);
      }
      // 金色欄杆 + 框
      ctx.strokeStyle = '#d6b05c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx, by + 84);
      ctx.lineTo(bx, by + 34);
      ctx.quadraticCurveTo(bx + bw / 2, by + 6, bx + bw, by + 34);
      ctx.lineTo(bx + bw, by + 84);
      ctx.stroke();
      ctx.fillStyle = '#c99a45';
      ctx.fillRect(bx - 6, by + 80, bw + 12, 8);
      ctx.fillStyle = '#f3d27a';
      for (let px = bx; px <= bx + bw; px += 14) ctx.fillRect(px, by + 88, 3, 12);
      ctx.fillStyle = '#c99a45';
      ctx.fillRect(bx - 6, by + 98, bw + 12, 4);
    }
    // 內緣：大理石柱 + 金線
    const inner = left ? wall.x + wall.w : wall.x;
    const cx = left ? inner - 12 : inner;
    const mg = ctx.createLinearGradient(cx, 0, cx + 12, 0);
    mg.addColorStop(0, '#e8e0d0');
    mg.addColorStop(0.5, '#fff8ea');
    mg.addColorStop(1, '#c9bca4');
    ctx.fillStyle = mg;
    ctx.fillRect(cx, top, 12, bot - top);
    ctx.fillStyle = '#d6b05c';
    ctx.fillRect(left ? inner - 2 : inner, top, 2, bot - top);
  }

  /** 歌劇院的追擊天花板：放下來的紅絨布帷幕 + 金流蘇，底下一排金色尖飾 */
  function operaCeiling(ctx, screenTop, h, w, t) {
    ctx.save();
    ctx.beginPath(); ctx.rect(0, screenTop, w, h + 8); ctx.clip();
    // 帷幕：一波波垂下的布褶
    ctx.fillStyle = '#8a1424';
    ctx.fillRect(0, screenTop, w, h - 10);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = 0; x < w; x += 24) ctx.fillRect(x + 16, screenTop, 6, h - 10);
    ctx.fillStyle = '#b02234';
    ctx.beginPath();
    ctx.moveTo(0, screenTop + h - 12);
    for (let x = 0; x <= w; x += 48) {
      ctx.quadraticCurveTo(x + 24, screenTop + h - 2, x + 48, screenTop + h - 12);
    }
    ctx.lineTo(w, screenTop); ctx.lineTo(0, screenTop); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d6b05c';
    ctx.fillRect(0, screenTop + 2, w, 3);
    // 金色尖飾（朝下，就是會刺人的部分）
    const n = Math.ceil(w / 24);
    for (let i = 0; i < n; i++) {
      const sx = i * 24;
      ctx.fillStyle = '#d6b05c';
      ctx.beginPath();
      ctx.moveTo(sx + 4, screenTop + h - 8);
      ctx.lineTo(sx + 12, screenTop + h + 4);
      ctx.lineTo(sx + 20, screenTop + h - 8);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d9666f';
      ctx.beginPath(); ctx.arc(sx + 12, screenTop + h + 2, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /** 尖頂拱窗（鐘塔牆上的哥德式窗，窗外是霧夜倫敦） */
  function lancetWindow(ctx, x, y, w, h, t) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + w * 0.6);
    ctx.quadraticCurveTo(x, y, x + w / 2, y - w * 0.2);
    ctx.quadraticCurveTo(x + w, y, x + w, y + w * 0.6);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    const sky = ctx.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, '#1b2440');
    sky.addColorStop(1, '#3a4660');
    ctx.fillStyle = sky;
    ctx.fill();
    ctx.clip();
    // 星星 + 霧
    ctx.fillStyle = 'rgba(255,255,230,0.8)';
    ctx.fillRect(x + w * 0.3, y + 6, 1.5, 1.5);
    ctx.fillRect(x + w * 0.7, y + h * 0.3, 1.5, 1.5);
    ctx.fillStyle = 'rgba(200, 210, 230, 0.18)';
    const fx = (t * 0.2) % (w * 2);
    ctx.beginPath(); ctx.ellipse(x - w + fx, y + h * 0.7, w, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 石框與中梃
    ctx.strokeStyle = '#c9b48a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + w * 0.6);
    ctx.quadraticCurveTo(x, y, x + w / 2, y - w * 0.2);
    ctx.quadraticCurveTo(x + w, y, x + w, y + w * 0.6);
    ctx.lineTo(x + w, y + h);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y - w * 0.2); ctx.lineTo(x + w / 2, y + h);
    ctx.moveTo(x, y + h * 0.55); ctx.lineTo(x + w, y + h * 0.55);
    ctx.stroke();
    ctx.fillStyle = '#c9b48a';
    ctx.fillRect(x - 4, y + h, w + 8, 5);
  }

  /** 鐘塔牆：紅褐磚 + 石材腰線 + 拱窗 + 壁燈 + 內緣鍍金飾條 */
  function bigBenWall(ctx, wall, camY, viewH, t) {
    const top = camY - 20, bot = camY + viewH + 20;
    ctx.fillStyle = '#4a2c26';
    ctx.fillRect(wall.x, top, wall.w, bot - top);

    // 磚
    const brickH = 18;
    const r0 = Math.floor(top / brickH);
    for (let i = 0; i < (bot - top) / brickH + 2; i++) {
      const row = r0 + i;
      const by = row * brickH;
      const stagger = (row % 2) * 18;
      for (let bx = wall.x - 36 + stagger; bx < wall.x + wall.w; bx += 36) {
        const shade = ((row * 7 + Math.floor(bx / 36) * 13) % 5) * 0.018;
        ctx.fillStyle = 'rgba(' + (120 + shade * 400 | 0) + ', 62, 48, 0.55)';
        const x0 = Math.max(bx + 1, wall.x), x1 = Math.min(bx + 35, wall.x + wall.w);
        if (x1 > x0) ctx.fillRect(x0, by + 1, x1 - x0, brickH - 2);
      }
    }

    // 石材腰線 + 拱窗 + 壁燈，每 312 一組（世界座標，跟著捲）
    const BAND = 312;
    const b0 = Math.floor(top / BAND);
    const left = wall.x < 480;
    for (let i = b0; i <= Math.ceil(bot / BAND); i++) {
      const by = i * BAND;
      ctx.fillStyle = '#b8a27a';
      ctx.fillRect(wall.x, by, wall.w, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(wall.x, by + 10, wall.w, 3);

      const ww = 44, wh = 96;
      const wx = wall.x + (wall.w - ww) / 2 + (left ? -10 : 10);
      lancetWindow(ctx, wx, by + 70, ww, wh, t + i * 50);

      // 壁燈（煤氣燈）：光暈 + 燈罩
      const lx = left ? wall.x + wall.w - 18 : wall.x + 18;
      const ly = by + 250;
      const flick = 0.85 + Math.sin(t * 0.13 + i * 3) * 0.08;
      const glow = ctx.createRadialGradient(lx, ly, 2, lx, ly, 46);
      glow.addColorStop(0, 'rgba(255, 210, 120, ' + (0.55 * flick).toFixed(3) + ')');
      glow.addColorStop(1, 'rgba(255, 210, 120, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(lx - 46, ly - 46, 92, 92);
      ctx.fillStyle = '#2b1d16';
      ctx.fillRect(lx - 1.5, ly - 18, 3, 12);
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI * 2); ctx.fill();
    }

    // 內緣鍍金飾條：讓井道邊界一眼看清楚
    const inner = left ? wall.x + wall.w : wall.x;
    ctx.fillStyle = '#7a5a2a';
    ctx.fillRect(left ? inner - 8 : inner, top, 8, bot - top);
    ctx.fillStyle = '#e0b85a';
    ctx.fillRect(left ? inner - 3 : inner, top, 3, bot - top);
    // 飾條上的四葉飾釘
    ctx.fillStyle = '#f3d27a';
    const STUD = 52;
    for (let sy = Math.floor(top / STUD) * STUD; sy < bot; sy += STUD) {
      const sx = left ? inner - 5.5 : inner + 5.5;
      ctx.beginPath(); ctx.arc(sx, sy, 2.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** 鐘擺：支架、黃銅擺桿、擺錘（帶殘影，看得出往哪擺） */
  function pendulum(ctx, pd, t) {
    const d = pd.def;
    if (d.kind === 'note') { noteHazard(ctx, pd, t); return; }
    ctx.save();
    // 殘影：往「剛剛經過」的角度畫幾個淡圈（va = 每帧角速度）
    for (let k = 3; k >= 1; k--) {
      const a = pd.a - (pd.va || 0) * k * 3;
      ctx.fillStyle = 'rgba(255, 200, 110, ' + (0.16 - k * 0.04).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(d.px + Math.sin(a) * d.len, d.py + Math.cos(a) * d.len, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 支架
    ctx.fillStyle = '#3a2a1e';
    ctx.fillRect(d.px - 14, d.py - 6, 28, 8);
    ctx.fillStyle = '#e0b85a';
    ctx.beginPath(); ctx.arc(d.px, d.py, 5, 0, Math.PI * 2); ctx.fill();
    // 擺桿
    ctx.strokeStyle = '#c99a45';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(d.px, d.py); ctx.lineTo(pd.x, pd.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 230, 160, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(d.px + 1, d.py); ctx.lineTo(pd.x + 1, pd.y); ctx.stroke();
    // 擺錘：金色圓盤 + 紅色警示環
    const g = ctx.createRadialGradient(pd.x - 4, pd.y - 4, 2, pd.x, pd.y, d.r);
    g.addColorStop(0, '#fff0b8');
    g.addColorStop(0.5, '#e0a943');
    g.addColorStop(1, '#8a5a1e');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(pd.x, pd.y, d.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c8322e';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pd.x, pd.y, d.r - 1, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  /** 鐘聲：從畫面上方擴散的聲波環 + 「噹」字 */
  function chimeOverlay(ctx, life, W, H, cfg) {
    const label = (cfg && cfg.label) || '噹——';
    const sub = (cfg && cfg.sub) || '鐘聲響起，捲動加速！';
    const k = 1 - life / 90;          // 0 → 1
    ctx.save();
    ctx.globalAlpha = Math.min(1, life / 30);
    for (let i = 0; i < 3; i++) {
      const rr = 40 + (k + i * 0.18) * 520;
      ctx.strokeStyle = 'rgba(255, 214, 120, ' + (0.5 * (1 - k)).toFixed(3) + ')';
      ctx.lineWidth = 4 - i;
      ctx.beginPath(); ctx.arc(W / 2, 60, rr, 0, Math.PI); ctx.stroke();
    }
    U.text(ctx, label, W / 2, 110 - k * 10, { size: 34, color: '#ffd166', strokeWidth: 6 });
    U.text(ctx, sub, W / 2, 144, { size: 14, color: '#f3e3c0' });
    ctx.restore();
  }

  /** 井的兩側石壁 */
  function shaftWall(ctx, wall, camY, viewH, theme, t) {
    if (theme === 'bigben') { bigBenWall(ctx, wall, camY, viewH, t || 0); return; }
    if (theme === 'opera') { operaWall(ctx, wall, camY, viewH, t || 0); return; }
    if (theme === 'alps') { alpsWall(ctx, wall, camY, viewH); return; }
    if (theme === 'atlantis') { atlantisWall(ctx, wall, camY, viewH, t || 0); return; }
    if (shaftThemes[theme]) { shaftThemes[theme].wall(ctx, wall, camY, viewH, t || 0); return; }
    ctx.fillStyle = '#2f2b36';
    ctx.fillRect(wall.x, camY - 20, wall.w, viewH + 40);
    // 內緣亮線，讓井道邊界明確
    const inner = wall.x < 480 ? wall.x + wall.w : wall.x;
    ctx.strokeStyle = 'rgba(190, 200, 220, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(inner, camY - 20);
    ctx.lineTo(inner, camY + viewH + 20);
    ctx.stroke();
    // 石磚紋理
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    const brickH = 26;
    const startRow = Math.floor((camY - 20) / brickH);
    for (let i = 0; i < viewH / brickH + 3; i++) {
      const by = (startRow + i) * brickH;
      const stagger = ((startRow + i) % 2) * 20;
      for (let bx = wall.x + stagger; bx < wall.x + wall.w; bx += 40) {
        ctx.fillRect(bx + 2, by + 2, 34, brickH - 4);
      }
    }
  }

  /**
   * 上方的尖刺天花板。
   *
   * 畫在螢幕座標（不受 camY 影響），因為它是「追著玩家」的壓力來源，
   * 固定在畫面上方才讀得出「還剩多少空間」。
   */
  function shaftCeiling(ctx, screenTop, h, w, t, theme) {
    if (theme === 'bigben') { bigBenCeiling(ctx, screenTop, h, w, t); return; }
    if (theme === 'opera') { operaCeiling(ctx, screenTop, h, w, t); return; }
    if (theme === 'atlantis') { atlantisCeiling(ctx, screenTop, h, w, t); return; }
    if (shaftThemes[theme]) { shaftThemes[theme].ceiling(ctx, screenTop, h, w, t); return; }
    ctx.save();
    // 底座
    ctx.fillStyle = '#3a2f3a';
    ctx.fillRect(0, screenTop, w, h - 10);
    // 金屬反光
    const g = ctx.createLinearGradient(0, screenTop, 0, screenTop + h);
    g.addColorStop(0, 'rgba(255,255,255,0.1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, screenTop, w, h);
    // 尖刺（朝下）
    ctx.fillStyle = '#d9666f';
    const n = Math.ceil(w / 26);
    for (let i = 0; i < n; i++) {
      const sx = i * 26;
      ctx.beginPath();
      ctx.moveTo(sx, screenTop + h - 10);
      ctx.lineTo(sx + 13, screenTop + h + 4);
      ctx.lineTo(sx + 26, screenTop + h - 10);
      ctx.closePath(); ctx.fill();
    }
    // 刺尖高光
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < n; i++) {
      ctx.fillRect(i * 26 + 11, screenTop + h - 8, 2, 6);
    }
    ctx.restore();
  }

  /**
   * 鐘塔的追擊天花板：一整排往下壓的齒輪 + 鑄鐵尖齒。
   * 致命邊緣跟一般天花板一樣在 screenTop + h（判定沒變，只換造型）。
   */
  function bigBenCeiling(ctx, screenTop, h, w, t) {
    ctx.save();
    // 齒輪不能畫進上面的 HUD
    ctx.beginPath(); ctx.rect(0, screenTop, w, h + 8); ctx.clip();
    ctx.fillStyle = '#2a1e18';
    ctx.fillRect(0, screenTop, w, h - 10);
    // 一排咬合的齒輪，相鄰的反向轉
    for (let i = 0; i <= Math.ceil(w / 48); i++) {
      gear(ctx, i * 48, screenTop + 6, 22, 10, (i % 2 ? 1 : -1) * t * 0.05,
        i % 2 ? '#8a6a2e' : '#a07c36', '#1a120c');
    }
    ctx.fillStyle = '#c99a45';
    ctx.fillRect(0, screenTop + h - 12, w, 3);
    // 鑄鐵尖齒（朝下），尖端紅色警示
    const n = Math.ceil(w / 24);
    for (let i = 0; i < n; i++) {
      const sx = i * 24;
      ctx.fillStyle = '#4a4048';
      ctx.beginPath();
      ctx.moveTo(sx, screenTop + h - 10);
      ctx.lineTo(sx + 12, screenTop + h + 4);
      ctx.lineTo(sx + 24, screenTop + h - 10);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d9666f';
      ctx.beginPath();
      ctx.moveTo(sx + 8, screenTop + h - 1);
      ctx.lineTo(sx + 12, screenTop + h + 4);
      ctx.lineTo(sx + 16, screenTop + h - 1);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // ══ 各國遠景（v1.6）════════════════════════════════════════
  // 原本每一關的遠景都是同一條正弦波山丘，只換顏色。
  // 現在每國一套自己的剪影，用視差捲動（簽名：ctx, camX, groundY, W, def, t）。

  /** 以 tileW 為單位重複畫一段剪影，p = 視差係數 */
  function tiled(ctx, camX, p, tileW, W, fn) {
    const off = -((camX * p) % tileW + tileW) % tileW;
    for (let x = off - tileW; x < W + tileW; x += tileW) fn(x);
  }

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /** 一條起伏的山脊（jag = 鋸齒程度），從 baseY 往上，填到地面 */
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

  /** 海平面（地中海、亞得里亞海、愛琴海那種）：一條帶反光的水平帶 */
  function seaBand(ctx, gy, W, top, color, t) {
    ctx.fillStyle = color;
    ctx.fillRect(0, top, W, gy - top);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 12; i++) {
      const x = ((i * 137 + t * 0.3) % (W + 60)) - 30;
      ctx.fillRect(x, top + 6 + (i % 4) * 7, 22, 1.5);
    }
  }

  const skylines = {
    // 西班牙：地中海 + 蒙特惠奇山 + 遠方的提比達波山
    ES: function (ctx, camX, gy, W, def, t) {
      seaBand(ctx, gy, W, gy - 70, 'rgba(70, 150, 200, 0.55)', t);
      ridge(ctx, camX, 0.15, gy - 50, W, rgba(def.hill, 0.5), 110, 4, 1);
      ridge(ctx, camX, 0.3, gy - 10, W, rgba(def.hill, 0.65), 50, 2, 2);
    },
    // 法國：巴黎的鋅灰色孟莎式屋頂 + 煙囪
    FR: function (ctx, camX, gy, W) {
      tiled(ctx, camX, 0.3, 360, W, function (x0) {
        [[0, 70], [60, 92], [130, 78], [200, 100], [270, 84]].forEach(function (b, i) {
          const x = x0 + b[0], h = b[1], w = 64;
          ctx.fillStyle = 'rgba(214, 200, 176, 0.55)';
          ctx.fillRect(x, gy - h, w, h);
          ctx.fillStyle = 'rgba(110, 124, 146, 0.6)';
          ctx.beginPath();
          ctx.moveTo(x - 3, gy - h); ctx.lineTo(x + 8, gy - h - 22); ctx.lineTo(x + w - 8, gy - h - 22); ctx.lineTo(x + w + 3, gy - h);
          ctx.fill();
          ctx.fillStyle = 'rgba(160, 90, 70, 0.6)';
          ctx.fillRect(x + 12 + i * 5, gy - h - 34, 6, 14);
          ctx.fillStyle = 'rgba(60, 60, 80, 0.35)';
          for (let k = 0; k < 3; k++) ctx.fillRect(x + 8 + k * 18, gy - h + 14, 8, 12);
        });
      });
    },
    // 荷蘭：一望無際的圩田 + 遠方的風車 + 運河
    NL: function (ctx, camX, gy, W, def, t) {
      ctx.fillStyle = 'rgba(120, 160, 90, 0.5)';
      ctx.fillRect(0, gy - 30, W, 30);
      ctx.fillStyle = 'rgba(110, 160, 210, 0.55)';
      ctx.fillRect(0, gy - 16, W, 4);
      tiled(ctx, camX, 0.25, 300, W, function (x0) {
        const x = x0 + 150;
        ctx.fillStyle = 'rgba(120, 90, 70, 0.55)';
        ctx.beginPath(); ctx.moveTo(x - 10, gy - 30); ctx.lineTo(x - 6, gy - 80); ctx.lineTo(x + 6, gy - 80); ctx.lineTo(x + 10, gy - 30); ctx.fill();
        ctx.strokeStyle = 'rgba(230, 220, 200, 0.6)'; ctx.lineWidth = 3;
        const a = t * 0.02 + x0;
        for (let k = 0; k < 4; k++) {
          const b = a + k * Math.PI / 2;
          ctx.beginPath(); ctx.moveTo(x, gy - 78); ctx.lineTo(x + Math.cos(b) * 28, gy - 78 + Math.sin(b) * 28); ctx.stroke();
        }
      });
    },
    // 德國：阿爾卑斯雪峰 + 深色松林
    DE: function (ctx, camX, gy, W) {
      ridge(ctx, camX, 0.12, gy - 40, W, 'rgba(150, 165, 185, 0.55)', 170, 26, 3);
      // 雪線：同一條山脊再畫一次，只留頂端的白
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, gy - 150); ctx.clip();
      ridge(ctx, camX, 0.12, gy - 40, W, 'rgba(250, 252, 255, 0.8)', 170, 26, 3);
      ctx.restore();
      tiled(ctx, camX, 0.3, 40, W, function (x) {
        ctx.fillStyle = 'rgba(40, 70, 50, 0.6)';
        ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + 14, gy - 60 - (x % 3) * 8); ctx.lineTo(x + 28, gy); ctx.fill();
      });
    },
    // 捷克：布拉格城堡山 + 聖維特大教堂的尖塔
    CZ: function (ctx, camX, gy, W, def) {
      ridge(ctx, camX, 0.12, gy - 20, W, rgba(def.hill, 0.5), 90, 2, 4);
      tiled(ctx, camX, 0.2, 640, W, function (x0) {
        const x = x0 + 300;
        ctx.fillStyle = 'rgba(120, 110, 100, 0.55)';
        ctx.fillRect(x - 120, gy - 150, 260, 60);
        [[-40, 230], [10, 260], [60, 200]].forEach(function (s) {
          ctx.beginPath(); ctx.moveTo(x + s[0] - 10, gy - 150); ctx.lineTo(x + s[0], gy - s[1]); ctx.lineTo(x + s[0] + 10, gy - 150); ctx.fill();
        });
      });
    },
    // 義大利：羅馬七丘 + 傘松 + 聖彼得大教堂圓頂
    IT: function (ctx, camX, gy, W, def) {
      ridge(ctx, camX, 0.15, gy - 20, W, rgba(def.hill, 0.5), 80, 0, 5);
      tiled(ctx, camX, 0.25, 220, W, function (x0) {
        ctx.fillStyle = 'rgba(60, 80, 50, 0.6)';
        ctx.fillRect(x0 + 60, gy - 70, 4, 50);
        ctx.beginPath(); ctx.ellipse(x0 + 62, gy - 76, 30, 12, 0, 0, Math.PI * 2); ctx.fill();
      });
      tiled(ctx, camX, 0.15, 900, W, function (x0) {
        ctx.fillStyle = 'rgba(200, 180, 150, 0.55)';
        ctx.beginPath(); ctx.arc(x0 + 500, gy - 110, 40, Math.PI, 0); ctx.fill();
        ctx.fillRect(x0 + 450, gy - 110, 100, 70);
        ctx.fillRect(x0 + 496, gy - 168, 8, 20);
      });
    },
    // 希臘：愛琴海 + 小島 + 白色村落
    GR: function (ctx, camX, gy, W, def, t) {
      seaBand(ctx, gy, W, gy - 90, 'rgba(40, 120, 190, 0.6)', t);
      tiled(ctx, camX, 0.12, 520, W, function (x0) {
        ctx.fillStyle = 'rgba(170, 150, 120, 0.6)';
        ctx.beginPath(); ctx.ellipse(x0 + 260, gy - 90, 130, 40, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = 'rgba(250, 250, 250, 0.8)';
        for (let k = 0; k < 6; k++) ctx.fillRect(x0 + 200 + k * 18, gy - 112 + (k % 2) * 6, 12, 10);
        ctx.fillStyle = 'rgba(40, 90, 180, 0.8)';
        ctx.beginPath(); ctx.arc(x0 + 262, gy - 114, 7, Math.PI, 0); ctx.fill();
      });
    },
    // 波蘭：克拉科夫老城的斜屋頂
    PL: function (ctx, camX, gy, W) {
      tiled(ctx, camX, 0.3, 300, W, function (x0) {
        [[0, 60, '#b0584a'], [55, 80, '#8a4a3a'], [110, 66, '#c0684a'], [170, 90, '#9a5040'], [230, 70, '#b0604a']].forEach(function (b) {
          ctx.fillStyle = 'rgba(220, 200, 170, 0.5)';
          ctx.fillRect(x0 + b[0], gy - b[1], 50, b[1]);
          ctx.fillStyle = rgba(b[2], 0.6);
          ctx.beginPath(); ctx.moveTo(x0 + b[0] - 4, gy - b[1]); ctx.lineTo(x0 + b[0] + 25, gy - b[1] - 30); ctx.lineTo(x0 + b[0] + 54, gy - b[1]); ctx.fill();
        });
      });
    },
    // 摩洛哥：遠方積雪的亞特拉斯山 + 紅土城牆與塔樓（馬拉喀什老城 medina）
    MA: function (ctx, camX, gy, W) {
      ridge(ctx, camX, 0.1, gy - 60, W, 'rgba(150, 110, 100, 0.5)', 150, 30, 11);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, gy - 175); ctx.clip();
      ridge(ctx, camX, 0.1, gy - 60, W, 'rgba(250, 246, 240, 0.75)', 150, 30, 11);
      ctx.restore();
      tiled(ctx, camX, 0.3, 360, W, function (x0) {
        ctx.fillStyle = 'rgba(190, 104, 64, 0.55)';
        ctx.fillRect(x0, gy - 54, 360, 54);
        for (let k = 0; k < 360; k += 24) ctx.fillRect(x0 + k, gy - 62, 14, 8);    // 城垛
        ctx.fillRect(x0 + 70, gy - 96, 40, 96);                                    // 塔樓
        ctx.fillRect(x0 + 250, gy - 84, 34, 84);
        ctx.fillStyle = 'rgba(80, 40, 28, 0.4)';
        ctx.beginPath(); ctx.arc(x0 + 180, gy - 18, 14, Math.PI, 0); ctx.fill();  // 城門拱
        ctx.fillRect(x0 + 166, gy - 18, 28, 18);
      });
    },
    // 匈牙利：多瑙河 + 塞切尼鏈橋
    HU: function (ctx, camX, gy, W, def, t) {
      seaBand(ctx, gy, W, gy - 40, 'rgba(80, 130, 170, 0.6)', t);
      ridge(ctx, camX, 0.1, gy - 40, W, rgba(def.hill, 0.45), 70, 0, 6);
      tiled(ctx, camX, 0.2, 700, W, function (x0) {
        const x = x0 + 120;
        ctx.fillStyle = 'rgba(190, 180, 160, 0.65)';
        ctx.fillRect(x, gy - 50, 380, 8);
        [x + 80, x + 300].forEach(function (px) {
          ctx.fillRect(px - 14, gy - 120, 28, 80);
          ctx.fillStyle = 'rgba(80, 70, 60, 0.4)';
          ctx.beginPath(); ctx.moveTo(px - 8, gy - 60); ctx.lineTo(px - 8, gy - 100); ctx.arc(px, gy - 100, 8, Math.PI, 0); ctx.lineTo(px + 8, gy - 60); ctx.fill();
          ctx.fillStyle = 'rgba(190, 180, 160, 0.65)';
        });
        ctx.strokeStyle = 'rgba(120, 110, 100, 0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, gy - 50); ctx.quadraticCurveTo(x + 40, gy - 60, x + 80, gy - 118);
        ctx.quadraticCurveTo(x + 190, gy - 40, x + 300, gy - 118); ctx.quadraticCurveTo(x + 340, gy - 60, x + 380, gy - 50); ctx.stroke();
      });
    },
    // 羅馬尼亞：喀爾巴阡山的鋸齒山峰 + 夜霧
    RO: function (ctx, camX, gy, W, def, t) {
      ctx.fillStyle = 'rgba(240, 230, 210, 0.85)';
      ctx.beginPath(); ctx.arc(780, 110, 26, 0, Math.PI * 2); ctx.fill();
      ridge(ctx, camX, 0.1, gy - 30, W, 'rgba(30, 24, 46, 0.8)', 190, 40, 7);
      ridge(ctx, camX, 0.2, gy, W, 'rgba(46, 36, 64, 0.85)', 90, 14, 8);
      ctx.fillStyle = 'rgba(180, 170, 200, 0.12)';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.ellipse(((i * 300 + t * 0.2) % (W + 400)) - 200, gy - 40 - i * 12, 220, 18, 0, 0, Math.PI * 2); ctx.fill();
      }
    },
    // 斯洛伐克：高塔特拉山（歐洲最小的高山山脈，又陡又尖）
    SK: function (ctx, camX, gy, W) {
      ridge(ctx, camX, 0.1, gy - 30, W, 'rgba(120, 130, 150, 0.6)', 210, 48, 9);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, gy - 190); ctx.clip();
      ridge(ctx, camX, 0.1, gy - 30, W, 'rgba(250, 252, 255, 0.85)', 210, 48, 9);
      ctx.restore();
      ridge(ctx, camX, 0.25, gy, W, 'rgba(50, 80, 60, 0.65)', 70, 10, 10);
    },
    // 克羅埃西亞：亞得里亞海 + 島嶼 + 杜布羅夫尼克的紅瓦城牆
    HR: function (ctx, camX, gy, W, def, t) {
      seaBand(ctx, gy, W, gy - 80, 'rgba(30, 130, 180, 0.6)', t);
      tiled(ctx, camX, 0.1, 480, W, function (x0) {
        ctx.fillStyle = 'rgba(110, 130, 90, 0.6)';
        ctx.beginPath(); ctx.ellipse(x0 + 200, gy - 80, 150, 34, 0, Math.PI, 0); ctx.fill();
      });
      tiled(ctx, camX, 0.25, 420, W, function (x0) {
        ctx.fillStyle = 'rgba(220, 200, 170, 0.6)';
        ctx.fillRect(x0, gy - 60, 420, 30);
        for (let k = 0; k < 6; k++) {
          ctx.fillRect(x0 + k * 70, gy - 78, 30, 20);
          ctx.fillStyle = 'rgba(200, 90, 60, 0.6)';
          ctx.beginPath(); ctx.moveTo(x0 + k * 70 - 2, gy - 78); ctx.lineTo(x0 + k * 70 + 15, gy - 92); ctx.lineTo(x0 + k * 70 + 32, gy - 78); ctx.fill();
          ctx.fillStyle = 'rgba(220, 200, 170, 0.6)';
        }
      });
    },
    // 塞爾維亞：薩瓦河與多瑙河匯流 + 卡萊梅格丹要塞城牆 + 聖薩瓦教堂的圓頂
    RS: function (ctx, camX, gy, W, def, t) {
      seaBand(ctx, gy, W, gy - 34, 'rgba(90, 120, 150, 0.6)', t);
      tiled(ctx, camX, 0.2, 760, W, function (x0) {
        ctx.fillStyle = 'rgba(150, 130, 110, 0.6)';
        ctx.fillRect(x0 + 40, gy - 90, 360, 56);
        for (let k = 0; k < 10; k++) ctx.fillRect(x0 + 40 + k * 36, gy - 100, 20, 12);
        ctx.fillStyle = 'rgba(230, 225, 215, 0.6)';
        ctx.fillRect(x0 + 520, gy - 120, 120, 86);
        ctx.fillStyle = 'rgba(80, 140, 110, 0.7)';
        ctx.beginPath(); ctx.arc(x0 + 580, gy - 120, 44, Math.PI, 0); ctx.fill();
        ctx.fillStyle = 'rgba(230, 200, 120, 0.8)';
        ctx.fillRect(x0 + 577, gy - 186, 6, 22);
      });
    },
    // 保加利亞：玫瑰谷的一行行玫瑰田 + 巴爾幹山脈
    BG: function (ctx, camX, gy, W, def) {
      ridge(ctx, camX, 0.1, gy - 50, W, rgba(def.hill, 0.5), 130, 8, 11);
      ctx.fillStyle = 'rgba(110, 150, 90, 0.5)';
      ctx.fillRect(0, gy - 50, W, 50);
      for (let r = 0; r < 4; r++) {
        tiled(ctx, camX, 0.25 + r * 0.05, 26, W, function (x) {
          ctx.fillStyle = r % 2 ? 'rgba(232, 106, 154, 0.75)' : 'rgba(244, 160, 190, 0.75)';
          ctx.beginPath(); ctx.arc(x + (r % 2) * 13, gy - 44 + r * 12, 4, 0, Math.PI * 2); ctx.fill();
        });
      }
    },
    // 烏克蘭：金色麥田 + 藍天，遠方基輔洞窟修道院的金頂
    UA: function (ctx, camX, gy, W, def, t) {
      ctx.fillStyle = 'rgba(232, 196, 80, 0.6)';
      ctx.beginPath(); ctx.moveTo(0, gy);
      for (let x = 0; x <= W; x += 30) ctx.lineTo(x, gy - 60 - Math.sin((x + camX * 0.2) * 0.01) * 10);
      ctx.lineTo(W, gy); ctx.fill();
      ctx.strokeStyle = 'rgba(200, 160, 50, 0.5)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 7) {
        const sway = Math.sin(t * 0.04 + x * 0.05) * 2;
        ctx.beginPath(); ctx.moveTo(x, gy - 4); ctx.lineTo(x + sway, gy - 26); ctx.stroke();
      }
      tiled(ctx, camX, 0.12, 820, W, function (x0) {
        const x = x0 + 420;
        ctx.fillStyle = 'rgba(240, 236, 226, 0.6)';
        ctx.fillRect(x - 60, gy - 130, 120, 70);
        ctx.fillStyle = 'rgba(232, 190, 70, 0.85)';
        [[-36, 18], [0, 26], [36, 18]].forEach(function (d) {
          ctx.beginPath(); ctx.ellipse(x + d[0], gy - 130, d[1] * 0.7, d[1], 0, Math.PI, 0); ctx.fill();
          ctx.fillRect(x + d[0] - 1.5, gy - 130 - d[1] - 14, 3, 14);
        });
      });
    }
  };

  // ══ 補畫：之前關卡有擺、但從來沒有繪製函式的道具與圖示（v1.5）══
  // drawProps 找不到函式就直接跳過，所以西班牙的聖家堂、噴泉、吉他、橘子樹，
  // 捷克的天文鐘一直是「擺了但看不到」；扇子、長傘、木偶、指揮棒的圖示也是空的。

  /** 西班牙：聖家堂（前景大建築版，背景剪影是 sagradaLm） */
  function sagradaProp(ctx, x, baseY, t, p) {
    const s = (p && p.scale) || 1;
    ctx.save();
    ctx.translate(x, baseY);
    ctx.scale(s, s);
    ctx.fillStyle = '#c8a878';
    ctx.fillRect(-70, -90, 140, 90);
    // 四座玉米棒狀尖塔（聖家堂最有辨識度的剪影）
    [[-54, 230], [-20, 270], [20, 270], [54, 230]].forEach(function (tw) {
      ctx.fillStyle = '#d4b688';
      ctx.beginPath();
      ctx.moveTo(tw[0] - 13, -90);
      ctx.quadraticCurveTo(tw[0] - 11, -tw[1] * 0.7, tw[0], -tw[1]);
      ctx.quadraticCurveTo(tw[0] + 11, -tw[1] * 0.7, tw[0] + 13, -90);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(90, 60, 30, 0.35)';
      for (let y = -100; y > -tw[1] + 30; y -= 14) ctx.fillRect(tw[0] - 6, y, 12, 4);
      ctx.fillStyle = '#e8b040';
      ctx.beginPath(); ctx.arc(tw[0], -tw[1] - 4, 4, 0, Math.PI * 2); ctx.fill();
    });
    // 正門與玫瑰窗
    ctx.fillStyle = '#6b4a30';
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-18, -44); ctx.arc(0, -44, 18, Math.PI, 0); ctx.lineTo(18, 0); ctx.fill();
    ctx.fillStyle = '#5fa0c8';
    ctx.beginPath(); ctx.arc(0, -72, 9, 0, Math.PI * 2); ctx.fill();
    // 施工吊車（「至今仍在施工」）
    ctx.strokeStyle = '#e0a030';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(84, 0); ctx.lineTo(84, -250); ctx.lineTo(10, -250); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(30, -250); ctx.lineTo(30, -200 + Math.sin(t * 0.02) * 10); ctx.stroke();
    ctx.restore();
  }

  /** 西班牙：廣場噴泉 */
  function plazaFountain(ctx, x, baseY, t) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = '#b8a888';
    ctx.fillRect(-44, -18, 88, 18);
    ctx.fillStyle = '#5fb0d8';
    ctx.fillRect(-38, -16, 76, 6);
    ctx.fillStyle = '#c8b898';
    ctx.fillRect(-6, -48, 12, 32);
    ctx.fillRect(-18, -50, 36, 6);
    // 水柱
    ctx.strokeStyle = 'rgba(180, 225, 255, 0.85)';
    ctx.lineWidth = 2;
    for (let k = -1; k <= 1; k += 2) {
      ctx.beginPath();
      ctx.moveTo(0, -52);
      ctx.quadraticCurveTo(k * 18, -76 - Math.sin(t * 0.2) * 3, k * 30, -18);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(220, 240, 255, 0.8)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(-24 + i * 16, -18 - ((t + i * 7) % 10), 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /** 西班牙：靠在牆邊的佛朗明哥吉他 */
  function guitarProp(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.rotate(-0.25);
    ctx.fillStyle = '#c8823c';
    ctx.beginPath(); ctx.ellipse(0, -12, 13, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -32, 10, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2416';
    ctx.beginPath(); ctx.arc(0, -22, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(-2.5, -72, 5, 36);
    ctx.fillRect(-4, -78, 8, 8);
    ctx.restore();
  }

  /** 西班牙：橘子樹（塞維亞街頭那種） */
  function orangeTree(ctx, x, baseY, t) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = '#6b4a2e';
    ctx.fillRect(-4, -36, 8, 36);
    ctx.fillStyle = '#3f7a3a';
    ctx.beginPath(); ctx.arc(0, -52, 24, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-14, -42, 14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(14, -42, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f08a1c';
    [[-12, -56], [8, -62], [16, -44], [-4, -40], [-18, -38], [2, -50]].forEach(function (o) {
      ctx.beginPath(); ctx.arc(o[0], o[1], 3.4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(0, -1, 22, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** 捷克：布拉格天文鐘（塔身 + 兩個鐘面 + 金色骷髏敲鐘人） */
  function astroClock(ctx, x, baseY, t) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = '#7a6a5a';
    ctx.fillRect(-28, -170, 56, 170);
    ctx.fillStyle = '#5a4a3e';
    ctx.beginPath(); ctx.moveTo(-32, -170); ctx.lineTo(0, -210); ctx.lineTo(32, -170); ctx.fill();
    // 上：天文鐘面
    ctx.fillStyle = '#2a4a8a';
    ctx.beginPath(); ctx.arc(0, -110, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c060';
    ctx.beginPath(); ctx.arc(0, -110, 22, Math.PI * 0.15, Math.PI * 0.85); ctx.lineTo(0, -110); ctx.fill();
    ctx.strokeStyle = '#e8c060';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, -110, 22, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -110);
    ctx.lineTo(Math.cos(t * 0.01) * 18, -110 + Math.sin(t * 0.01) * 18); ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(Math.cos(-t * 0.004) * 12, -110 + Math.sin(-t * 0.004) * 12, 3, 0, Math.PI * 2); ctx.fill();
    // 下：月曆盤
    ctx.fillStyle = '#e8dcc0';
    ctx.beginPath(); ctx.arc(0, -46, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a6a3c';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 6, -46 + Math.sin(a) * 6);
      ctx.lineTo(Math.cos(a) * 16, -46 + Math.sin(a) * 16); ctx.stroke();
    }
    // 兩側的使徒窗
    ctx.fillStyle = '#3a2a20';
    ctx.fillRect(-20, -150, 12, 14); ctx.fillRect(8, -150, 12, 14);
    ctx.restore();
  }

  icons.babouche = iconBabouche;

  props.sagrada = sagradaProp;
  props.plazaFountain = plazaFountain;
  props.guitar = guitarProp;
  props.orangeTree = orangeTree;
  props.astroClock = astroClock;

  /** 摩洛哥尖頭拖鞋 babouche：黃色皮革、尖尖翹起的鞋頭（側面） */
  function iconBabouche(ctx, s) {
    ctx.fillStyle = '#e8b830';
    ctx.beginPath();
    ctx.moveTo(-14 * s, 6 * s);
    ctx.quadraticCurveTo(-14 * s, -4 * s, -4 * s, -4 * s);
    ctx.lineTo(10 * s, -2 * s);
    ctx.quadraticCurveTo(16 * s, -3 * s, 17 * s, -9 * s);   // 翹起的鞋尖
    ctx.quadraticCurveTo(18 * s, 4 * s, 10 * s, 6 * s);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a5a20';
    ctx.fillRect(-14 * s, 6 * s, 26 * s, 3 * s);              // 鞋底
    ctx.strokeStyle = '#b8401e'; ctx.lineWidth = 1.4 * s;      // 刺繡
    ctx.beginPath(); ctx.moveTo(-2 * s, -1 * s); ctx.lineTo(8 * s, 0); ctx.stroke();
  }

  function iconFan(ctx, s) {
    // 佛朗明哥扇：半圓扇面 + 扇骨 + 紅色花紋
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.moveTo(0, 8 * s); ctx.arc(0, 8 * s, 15 * s, Math.PI * 1.08, Math.PI * 1.92); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f1bf00';
    ctx.beginPath(); ctx.moveTo(0, 8 * s); ctx.arc(0, 8 * s, 15 * s, Math.PI * 1.08, Math.PI * 1.92); ctx.arc(0, 8 * s, 11 * s, Math.PI * 1.92, Math.PI * 1.08, true); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5a2a14';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI * (1.08 + 0.84 * i / 6);
      ctx.beginPath(); ctx.moveTo(0, 8 * s); ctx.lineTo(Math.cos(a) * 15 * s, 8 * s + Math.sin(a) * 15 * s); ctx.stroke();
    }
    ctx.fillStyle = '#5a2a14';
    ctx.beginPath(); ctx.arc(0, 8 * s, 2.2 * s, 0, Math.PI * 2); ctx.fill();
  }

  function iconBrolly(ctx, s) {
    // 紳士長傘：黑色傘面 + 彎鉤木柄
    ctx.fillStyle = '#22262e';
    ctx.beginPath(); ctx.arc(0, -2 * s, 13 * s, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a3f4a';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(-9.75 * s + i * 6.5 * s, -2 * s, 3.25 * s, 0, Math.PI); ctx.fill();
    }
    ctx.strokeStyle = '#8a5a30';
    ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(0, -2 * s); ctx.lineTo(0, 10 * s); ctx.arc(-3 * s, 10 * s, 3 * s, 0, Math.PI); ctx.stroke();
  }

  function iconPuppet(ctx, s) {
    // 提線木偶：控制十字架 + 三條線 + 小人偶
    ctx.strokeStyle = '#8a6a44';
    ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(-9 * s, -13 * s); ctx.lineTo(9 * s, -13 * s); ctx.moveTo(0, -16 * s); ctx.lineTo(0, -10 * s); ctx.stroke();
    ctx.strokeStyle = 'rgba(220,220,220,0.8)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-9 * s, -13 * s); ctx.lineTo(-7 * s, 2 * s);
    ctx.moveTo(9 * s, -13 * s); ctx.lineTo(7 * s, 2 * s);
    ctx.moveTo(0, -10 * s); ctx.lineTo(0, -5 * s);
    ctx.stroke();
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath(); ctx.arc(0, -3 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d7141a';
    ctx.fillRect(-4 * s, 1 * s, 8 * s, 8 * s);
    ctx.fillStyle = '#11457e';
    ctx.fillRect(-4 * s, 9 * s, 3 * s, 5 * s); ctx.fillRect(1 * s, 9 * s, 3 * s, 5 * s);
  }

  function iconBaton(ctx, s) {
    // 指揮棒：白色細棒 + 軟木握把，旁邊一個音符
    ctx.save();
    ctx.rotate(-0.7);
    ctx.fillStyle = '#f4efe2';
    ctx.fillRect(-1.2 * s, -15 * s, 2.4 * s, 20 * s);
    ctx.fillStyle = '#b08850';
    ctx.beginPath(); ctx.ellipse(0, 7 * s, 3 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.ellipse(8 * s, 8 * s, 3.2 * s, 2.4 * s, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(10.4 * s, -2 * s, 1.4 * s, 10 * s);
  }

  icons.fan = iconFan;
  icons.brolly = iconBrolly;
  icons.puppet = iconPuppet;
  icons.baton = iconBaton;

  // ══ 東歐篇（v1.4）══════════════════════════════════════════
  // 地標（背景剪影）、道具、裝備圖示、魔王都放在這一段，
  // 用「往既有的表裡登記」的方式接上，原本的程式不用動。

  /** 波蘭：克拉科夫紡織會館 + 聖母聖殿的兩座不等高尖塔 */
  function clothHallLm(ctx, x, baseY, s) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(214, 196, 160, 0.55)';
    ctx.fillRect(-120 * s, -70 * s, 240 * s, 70 * s);
    // 文藝復興式女兒牆（一排小尖頂）
    ctx.fillStyle = 'rgba(190, 170, 134, 0.6)';
    for (let i = 0; i < 9; i++) {
      const px = (-112 + i * 28) * s;
      ctx.beginPath();
      ctx.moveTo(px, -70 * s); ctx.lineTo(px + 10 * s, -88 * s); ctx.lineTo(px + 20 * s, -70 * s);
      ctx.closePath(); ctx.fill();
    }
    // 拱廊
    ctx.fillStyle = 'rgba(96, 76, 56, 0.4)';
    for (let i = 0; i < 6; i++) {
      const ax = (-95 + i * 38) * s;
      ctx.beginPath();
      ctx.moveTo(ax - 12 * s, 0); ctx.lineTo(ax - 12 * s, -28 * s);
      ctx.arc(ax, -28 * s, 12 * s, Math.PI, 0);
      ctx.lineTo(ax + 12 * s, 0); ctx.closePath(); ctx.fill();
    }
    // 聖母聖殿：高低兩塔（傳說中兩兄弟建塔的故事）
    ctx.fillStyle = 'rgba(160, 84, 70, 0.55)';
    [[150, 210], [196, 170]].forEach(function (tw) {
      const tx = tw[0] * s, th = tw[1] * s;
      ctx.fillRect(tx - 16 * s, -th, 32 * s, th);
      ctx.beginPath();
      ctx.moveTo(tx - 18 * s, -th); ctx.lineTo(tx, -th - 50 * s); ctx.lineTo(tx + 18 * s, -th);
      ctx.closePath(); ctx.fill();
    });
    ctx.restore();
  }

  /** 匈牙利：布達佩斯國會大廈（中央穹頂 + 一排哥德尖塔），倒映在多瑙河上 */
  function parliamentLm(ctx, x, baseY, s) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(222, 206, 176, 0.55)';
    ctx.fillRect(-170 * s, -60 * s, 340 * s, 60 * s);
    ctx.fillRect(-60 * s, -100 * s, 120 * s, 40 * s);
    // 穹頂
    ctx.fillStyle = 'rgba(150, 70, 60, 0.55)';
    ctx.beginPath(); ctx.arc(0, -100 * s, 44 * s, Math.PI, 0); ctx.fill();
    ctx.fillRect(-4 * s, -170 * s, 8 * s, 30 * s);
    // 尖塔
    ctx.fillStyle = 'rgba(200, 182, 150, 0.6)';
    [-160, -120, -80, 80, 120, 160].forEach(function (px) {
      ctx.beginPath();
      ctx.moveTo((px - 6) * s, -60 * s); ctx.lineTo(px * s, -100 * s); ctx.lineTo((px + 6) * s, -60 * s);
      ctx.closePath(); ctx.fill();
    });
    // 窗
    ctx.fillStyle = 'rgba(80, 64, 50, 0.35)';
    for (let i = 0; i < 16; i++) ctx.fillRect((-158 + i * 20) * s, -46 * s, 8 * s, 22 * s);
    ctx.restore();
  }

  /** 羅馬尼亞：布蘭城堡（德古拉城堡），蓋在山岩上，尖頂紅瓦 */
  function branLm(ctx, x, baseY, s) {
    ctx.save();
    ctx.translate(x, baseY);
    // 山岩
    ctx.fillStyle = 'rgba(60, 54, 70, 0.6)';
    ctx.beginPath();
    ctx.moveTo(-150 * s, 0); ctx.lineTo(-90 * s, -80 * s); ctx.lineTo(-20 * s, -96 * s);
    ctx.lineTo(70 * s, -86 * s); ctx.lineTo(150 * s, 0); ctx.closePath(); ctx.fill();
    // 城牆與塔
    ctx.fillStyle = 'rgba(200, 192, 180, 0.5)';
    ctx.fillRect(-70 * s, -170 * s, 130 * s, 80 * s);
    [[-72, 210], [0, 240], [56, 196]].forEach(function (tw) {
      const tx = tw[0] * s, th = tw[1] * s;
      ctx.fillStyle = 'rgba(200, 192, 180, 0.5)';
      ctx.fillRect(tx - 16 * s, -th, 32 * s, th - 90 * s);
      ctx.fillStyle = 'rgba(140, 50, 46, 0.6)';
      ctx.beginPath();
      ctx.moveTo(tx - 20 * s, -th); ctx.lineTo(tx, -th - 40 * s); ctx.lineTo(tx + 20 * s, -th);
      ctx.closePath(); ctx.fill();
    });
    // 亮著的窗（夜裡）
    ctx.fillStyle = 'rgba(255, 210, 120, 0.6)';
    [[-60, -150], [-4, -190], [40, -140], [-30, -120]].forEach(function (w) {
      ctx.fillRect(w[0] * s, w[1] * s, 7 * s, 11 * s);
    });
    ctx.restore();
  }

  landmarks.clothhall = clothHallLm;
  landmarks.parliament = parliamentLm;
  landmarks.bran = branLm;

  // ── 東歐道具（簽名 (ctx, x, baseY, t, prop)）──

  /** 瓦維爾龍雕像：克拉科夫的噴火龍（真的會定時噴火） */
  function wawelDragon(ctx, x, baseY, t) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = '#4a5a3a';
    ctx.fillRect(-20, -14, 40, 14);          // 石座
    ctx.fillStyle = '#2f5a3a';
    ctx.beginPath();
    ctx.moveTo(-18, -14); ctx.quadraticCurveTo(-24, -40, -6, -46);
    ctx.quadraticCurveTo(10, -60, 16, -72); ctx.lineTo(24, -66);
    ctx.quadraticCurveTo(14, -48, 10, -30); ctx.lineTo(16, -14);
    ctx.closePath(); ctx.fill();
    // 翅膀
    ctx.fillStyle = '#3f6e4a';
    ctx.beginPath(); ctx.moveTo(-4, -40); ctx.lineTo(-30, -62); ctx.lineTo(-10, -30); ctx.fill();
    // 噴火（每 3 秒噴一次）
    const k = (t % 180) / 180;
    if (k < 0.18) {
      ctx.fillStyle = 'rgba(255, 150, 60, ' + (0.8 - k * 3).toFixed(2) + ')';
      ctx.beginPath();
      ctx.moveTo(24, -70); ctx.lineTo(52 + k * 80, -82); ctx.lineTo(48 + k * 80, -60);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /** 匈牙利紅椒攤：掛著一串串乾紅椒 */
  function paprikaStall(ctx, x, baseY, t) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = '#6b4a2e';
    ctx.fillRect(-34, -50, 4, 50); ctx.fillRect(30, -50, 4, 50);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-38, -56, 76, 8);
    ctx.fillStyle = '#e8dcc0';
    for (let i = 0; i < 4; i++) ctx.fillRect(-38 + i * 19, -56, 9, 8);
    // 紅椒串
    for (let k = 0; k < 4; k++) {
      const sx = -24 + k * 16, sw = Math.sin(t * 0.04 + k) * 1.5;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#b02a1e' : '#d8402c';
        ctx.beginPath(); ctx.ellipse(sx + sw, -42 + i * 7, 3, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(-36, -14, 72, 14);
    ctx.restore();
  }

  /** 溫泉池（布達佩斯的澡堂），水面冒蒸氣 */
  function thermalPool(ctx, x, baseY, t) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = '#d8ccb0';
    ctx.fillRect(-56, -12, 112, 12);
    ctx.fillStyle = '#5fb0c8';
    ctx.fillRect(-50, -10, 100, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 4; i++) {
      const py = -20 - ((t * 0.5 + i * 12) % 40);
      ctx.beginPath(); ctx.arc(-36 + i * 24 + Math.sin(t * 0.05 + i) * 4, py, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /** 墓碑 */
  function graveStone(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.fillStyle = '#6a6878';
    ctx.beginPath();
    ctx.moveTo(-12, 0); ctx.lineTo(-12, -24); ctx.arc(0, -24, 12, Math.PI, 0); ctx.lineTo(12, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a4858';
    ctx.fillRect(-1.5, -30, 3, 14); ctx.fillRect(-6, -26, 12, 3);
    ctx.restore();
  }

  /** 枯樹 */
  function deadTree(ctx, x, baseY) {
    ctx.save();
    ctx.translate(x, baseY);
    ctx.strokeStyle = '#2a2230';
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2, -60); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(2, -40); ctx.lineTo(-22, -66);
    ctx.moveTo(2, -52); ctx.lineTo(24, -76);
    ctx.moveTo(-12, -54); ctx.lineTo(-18, -80);
    ctx.moveTo(14, -64); ctx.lineTo(30, -66);
    ctx.stroke();
    ctx.restore();
  }

  props.wawelDragon = wawelDragon;
  props.paprikaStall = paprikaStall;
  props.thermalPool = thermalPool;
  props.graveStone = graveStone;
  props.deadTree = deadTree;
  // 布蘭城堡當背景道具用（魔王關不畫 landmark，改用道具擺一座在後面）
  props.branCastle = function (ctx, x, baseY, t, p) { branLm(ctx, x, baseY, (p && p.scale) || 1); };
  // 寬度與圖層登記在 levelgen.js 的 PROP_WIDTH / PROP_LAYER
  // （levels.js 擺道具時就要用，那時 sprites.js 還沒載入）

  // ── 東歐裝備圖示 ──

  function iconAmber(ctx, s) {
    // 波羅的海琥珀：金褐色的水滴形，裡面有一隻小蟲
    const g = ctx.createRadialGradient(-3 * s, -3 * s, 1, 0, 0, 12 * s);
    g.addColorStop(0, '#ffd88a');
    g.addColorStop(1, '#b8661c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -13 * s);
    ctx.quadraticCurveTo(12 * s, 0, 0, 12 * s);
    ctx.quadraticCurveTo(-12 * s, 0, 0, -13 * s);
    ctx.fill();
    ctx.fillStyle = 'rgba(60, 30, 10, 0.6)';
    ctx.beginPath(); ctx.ellipse(1 * s, 2 * s, 2 * s, 3 * s, 0.5, 0, Math.PI * 2); ctx.fill();
  }

  function iconPaprika(ctx, s) {
    ctx.fillStyle = '#d8402c';
    ctx.beginPath();
    ctx.moveTo(-4 * s, -8 * s);
    ctx.quadraticCurveTo(10 * s, -6 * s, 4 * s, 13 * s);
    ctx.quadraticCurveTo(-10 * s, 2 * s, -4 * s, -8 * s);
    ctx.fill();
    ctx.fillStyle = '#4f8a3a';
    ctx.fillRect(-4 * s, -13 * s, 3 * s, 6 * s);
  }

  function iconGarlic(ctx, s) {
    // 大蒜項鍊：繩子串起三顆蒜頭
    ctx.strokeStyle = '#a0845c';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.arc(0, -4 * s, 11 * s, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
    [-8, 0, 8].forEach(function (dx, i) {
      const y = (i === 1 ? 8 : 4) * s;
      ctx.fillStyle = '#f2ece0';
      ctx.beginPath(); ctx.ellipse(dx * s, y, 4.5 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c8bca4';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(dx * s, y - 4 * s); ctx.lineTo(dx * s, y + 4 * s); ctx.stroke();
    });
  }

  icons.amber = iconAmber;
  icons.paprika = iconPaprika;
  icons.garlic = iconGarlic;

  // ── 羅馬尼亞魔王：吸血伯爵 ──

  /**
   * 外型：高瘦、大披風（紅色內裡）、蒼白臉。
   * b.fade（0~1）是瞬移時的透明度 —— 消失/出現的過程要看得到，
   * 玩家才知道它要去哪裡。
   */
  function bossVampire(ctx, b, t) {
    const cx = b.x + b.w / 2, by = b.y + b.h;
    const fade = b.fade == null ? 1 : b.fade;
    ctx.save();
    ctx.globalAlpha *= Math.max(0.08, fade);
    const flap = b.phase === 'act' ? Math.sin(t * 0.4) * 8 : Math.sin(t * 0.06) * 3;
    // 披風
    ctx.fillStyle = '#1a1424';
    ctx.beginPath();
    ctx.moveTo(cx, b.y + 18);
    ctx.lineTo(cx - 40 - flap, by);
    ctx.lineTo(cx + 40 + flap, by);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a1424';
    ctx.beginPath();
    ctx.moveTo(cx, b.y + 24);
    ctx.lineTo(cx - 28 - flap * 0.6, by - 4);
    ctx.lineTo(cx + 28 + flap * 0.6, by - 4);
    ctx.closePath(); ctx.fill();
    // 身體
    ctx.fillStyle = '#2a2234';
    ctx.fillRect(cx - 12, b.y + 22, 24, b.h - 30);
    ctx.fillStyle = '#e8e0e8';
    ctx.beginPath(); ctx.moveTo(cx - 6, b.y + 24); ctx.lineTo(cx, b.y + 40); ctx.lineTo(cx + 6, b.y + 24); ctx.fill();
    // 高領
    ctx.fillStyle = '#1a1424';
    ctx.beginPath();
    ctx.moveTo(cx - 20, b.y + 10); ctx.lineTo(cx - 10, b.y + 26); ctx.lineTo(cx + 10, b.y + 26); ctx.lineTo(cx + 20, b.y + 10);
    ctx.closePath(); ctx.fill();
    // 臉
    ctx.fillStyle = '#d8d4e0';
    ctx.beginPath(); ctx.ellipse(cx, b.y + 12, 10, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2234';
    ctx.beginPath();
    ctx.moveTo(cx - 10, b.y + 6); ctx.lineTo(cx, b.y + 1); ctx.lineTo(cx + 10, b.y + 6); ctx.lineTo(cx, b.y - 2);
    ctx.closePath(); ctx.fill();
    // 眼睛：破綻期變成暈眩的黃色，平時紅色
    ctx.fillStyle = b.phase === 'recover' ? '#ffd166' : '#ff3b4a';
    ctx.fillRect(cx - 6 + b.dir * 1.5, b.y + 10, 3, 2);
    ctx.fillRect(cx + 3 + b.dir * 1.5, b.y + 10, 3, 2);
    // 獠牙
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 3, b.y + 18, 1.5, 3); ctx.fillRect(cx + 1.5, b.y + 18, 1.5, 3);
    ctx.restore();
  }

  bossKinds.vampire = bossVampire;

  // ══ v1.9：遠程攻擊 ════════════════════════════════════════

  /** 玩家丟出的板球（紅皮白縫線）或辣椒火球（拖著火焰尾巴） */
  function playerShot(ctx, s, camX, t) {
    const cx = s.x + s.w / 2 - camX, cy = s.y + s.h / 2;
    ctx.save();
    if (s.kind === 'fire') {
      const dir = s.vx >= 0 ? 1 : -1;
      for (let i = 3; i >= 1; i--) {
        ctx.fillStyle = 'rgba(255, ' + (90 + i * 30) + ', 40, ' + (0.25 * (4 - i)).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(cx - dir * i * 7, cy, 7 - i, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#d8402c';
      ctx.beginPath(); ctx.ellipse(cx, cy, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd060';
      ctx.beginPath(); ctx.arc(cx + dir * 2, cy - 1, 2.5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.4);
      ctx.fillStyle = '#b02a24';
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f4efe2'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, 4, -0.6, 0.6); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 4, Math.PI - 0.6, Math.PI + 0.6); ctx.stroke();
    }
    ctx.restore();
  }

  icons.cricket = function (ctx, s) {
    // 板球 + 球棒
    ctx.save();
    ctx.rotate(-0.6);
    ctx.fillStyle = '#d8b878'; ctx.fillRect(-3 * s, -14 * s, 6 * s, 22 * s);
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(-1.5 * s, 8 * s, 3 * s, 7 * s);
    ctx.restore();
    ctx.fillStyle = '#b02a24';
    ctx.beginPath(); ctx.arc(8 * s, 6 * s, 5.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f4efe2'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(8 * s, 6 * s, 3.5 * s, -0.7, 0.7); ctx.stroke();
  };

  // ══ 東歐篇第二批（v1.7）：斯洛伐克、克羅埃西亞、塞爾維亞、保加利亞、烏克蘭 ══

  /** 火鳥落地噴出的貼地火焰 */
  function fireWave(ctx, s, t) {
    const cx = s.x + s.w / 2, base = s.y + s.h;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const h = 18 + Math.sin(t * 0.6 + i * 2) * 5 - i * 4;
      ctx.fillStyle = ['rgba(255, 90, 40, 0.9)', 'rgba(255, 170, 50, 0.9)', 'rgba(255, 240, 160, 0.95)'][i];
      ctx.beginPath();
      ctx.moveTo(cx - 10 + i * 3, base);
      ctx.quadraticCurveTo(cx - 6, base - h * 0.6, cx + Math.sin(t * 0.4) * 3, base - h);
      ctx.quadraticCurveTo(cx + 6, base - h * 0.6, cx + 10 - i * 3, base);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 烏克蘭最終魔王：火鳥 Zhar-ptytsia（斯拉夫民間故事裡尾羽會發光的神鳥） */
  function bossFirebird(ctx, b, t) {
    const cx = b.x + b.w / 2, cy = b.y + b.h * 0.45;
    const diving = b.phase === 'act';
    const stunned = b.phase === 'recover';
    const flap = stunned ? 0.2 : Math.sin(t * (diving ? 0.1 : 0.22));
    ctx.save();
    // 光暈
    const g = ctx.createRadialGradient(cx, cy, 6, cx, cy, 70);
    g.addColorStop(0, 'rgba(255, 210, 90, 0.45)');
    g.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 70, 0, Math.PI * 2); ctx.fill();
    // 尾羽：一串長長的火焰羽毛，拖在身後
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + b.dir * 0 + (i - 2) * 0.22;
      const len = 46 + i % 2 * 12 + Math.sin(t * 0.2 + i) * 5;
      const tx = cx - b.dir * Math.cos((i - 2) * 0.22) * len, ty = cy + 20 + Math.sin(a) * 0 + (i - 2) * 8;
      ctx.strokeStyle = i % 2 ? '#ffb030' : '#ff5a2a';
      ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - b.dir * 10, cy + 10);
      ctx.quadraticCurveTo(cx - b.dir * len * 0.5, ty - 10, tx, ty); ctx.stroke();
      ctx.fillStyle = '#fff0a0';
      ctx.beginPath(); ctx.arc(tx, ty, 4, 0, Math.PI * 2); ctx.fill();
    }
    // 翅膀
    [-1, 1].forEach(function (side) {
      ctx.fillStyle = side < 0 ? '#e0462a' : '#f08a2a';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + side * 30, cy - 30 - flap * 26, cx + side * 52, cy - 8 - flap * 34);
      ctx.quadraticCurveTo(cx + side * 30, cy + 4, cx, cy + 10);
      ctx.fill();
    });
    // 身體
    ctx.fillStyle = '#ff7a2a';
    ctx.beginPath(); ctx.ellipse(cx, cy + 6, 16, 20, b.dir * (diving ? 0.6 : 0.15), 0, Math.PI * 2); ctx.fill();
    // 頭 + 冠羽 + 嘴
    const hx = cx + b.dir * 14, hy = cy - 16;
    ctx.fillStyle = '#ffb040';
    ctx.beginPath(); ctx.arc(hx, hy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe070';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(hx - 3 + i * 3, hy - 7); ctx.lineTo(hx - 6 + i * 4, hy - 20 - i * 2); ctx.lineTo(hx + i * 3, hy - 7); ctx.fill();
    }
    ctx.fillStyle = '#c8902a';
    ctx.beginPath(); ctx.moveTo(hx + b.dir * 7, hy - 2); ctx.lineTo(hx + b.dir * 17, hy + 2); ctx.lineTo(hx + b.dir * 7, hy + 4); ctx.fill();
    ctx.fillStyle = stunned ? '#ffd166' : '#2a0a0a';
    ctx.fillRect(hx + b.dir * 3 - 1, hy - 3, 3, 3);
    ctx.restore();
  }

  bossKinds.firebird = bossFirebird;

  /** 斯洛伐克：斯皮什城堡（中歐最大的城堡遺跡，蓋在山丘上） */
  function spisLm(ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(110, 120, 90, 0.55)';
    ctx.beginPath(); ctx.moveTo(-200 * s, 0); ctx.quadraticCurveTo(0, -150 * s, 200 * s, 0); ctx.fill();
    ctx.fillStyle = 'rgba(214, 206, 190, 0.6)';
    ctx.fillRect(-120 * s, -150 * s, 240 * s, 40 * s);
    for (let i = 0; i < 12; i++) ctx.fillRect((-120 + i * 21) * s, -160 * s, 12 * s, 10 * s);
    ctx.fillRect(-20 * s, -230 * s, 44 * s, 100 * s);
    ctx.fillStyle = 'rgba(80, 70, 60, 0.4)';
    ctx.fillRect(-6 * s, -210 * s, 8 * s, 16 * s);
    ctx.restore();
  }

  /** 克羅埃西亞：杜布羅夫尼克城牆與明切塔塔樓 */
  function dubrovnikLm(ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(222, 204, 170, 0.6)';
    ctx.fillRect(-200 * s, -90 * s, 400 * s, 90 * s);
    for (let i = 0; i < 16; i++) ctx.fillRect((-200 + i * 26) * s, -100 * s, 14 * s, 10 * s);
    ctx.beginPath(); ctx.arc(150 * s, -110 * s, 40 * s, Math.PI, 0); ctx.fill();
    ctx.fillRect(110 * s, -110 * s, 80 * s, 110 * s);
    ctx.fillStyle = 'rgba(200, 90, 60, 0.55)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo((-170 + i * 46) * s, -90 * s); ctx.lineTo((-150 + i * 46) * s, -118 * s); ctx.lineTo((-130 + i * 46) * s, -90 * s); ctx.fill();
    }
    ctx.restore();
  }

  /** 塞爾維亞：聖薩瓦大教堂（巴爾幹最大的東正教堂之一，綠色大圓頂） */
  function stSavaLm(ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(236, 232, 222, 0.6)';
    ctx.fillRect(-110 * s, -110 * s, 220 * s, 110 * s);
    ctx.fillStyle = 'rgba(80, 150, 120, 0.65)';
    ctx.beginPath(); ctx.arc(0, -110 * s, 70 * s, Math.PI, 0); ctx.fill();
    [-90, 90].forEach(function (d) { ctx.beginPath(); ctx.arc(d * s, -110 * s, 22 * s, Math.PI, 0); ctx.fill(); });
    ctx.fillStyle = 'rgba(232, 200, 110, 0.85)';
    ctx.fillRect(-3 * s, -210 * s, 6 * s, 30 * s); ctx.fillRect(-12 * s, -200 * s, 24 * s, 5 * s);
    ctx.restore();
  }

  /** 保加利亞：里拉修道院（紅白條紋拱廊 + 中央教堂圓頂） */
  function rilaLm(ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(100, 120, 90, 0.5)';
    ctx.beginPath(); ctx.moveTo(-220 * s, 0); ctx.lineTo(-120 * s, -200 * s); ctx.lineTo(-40 * s, -120 * s); ctx.lineTo(60 * s, -230 * s); ctx.lineTo(220 * s, 0); ctx.fill();
    ctx.fillStyle = 'rgba(240, 232, 214, 0.65)';
    ctx.fillRect(-140 * s, -80 * s, 280 * s, 80 * s);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = 'rgba(170, 60, 50, 0.6)';
      ctx.beginPath(); ctx.arc((-120 + i * 30) * s, -40 * s, 10 * s, Math.PI, 0); ctx.fill();
      ctx.fillStyle = 'rgba(40, 30, 30, 0.45)';
      ctx.fillRect((-128 + i * 30) * s, -40 * s, 16 * s, 30 * s);
    }
    ctx.fillStyle = 'rgba(80, 70, 70, 0.6)';
    ctx.beginPath(); ctx.arc(0, -100 * s, 26 * s, Math.PI, 0); ctx.fill();
    ctx.restore();
  }

  /** 烏克蘭：基輔洞窟修道院的金色圓頂 */
  function lavraLm(ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(244, 240, 230, 0.65)';
    ctx.fillRect(-90 * s, -120 * s, 180 * s, 120 * s);
    ctx.fillRect(130 * s, -220 * s, 40 * s, 220 * s);
    ctx.fillStyle = 'rgba(236, 196, 80, 0.85)';
    [[-50, 22], [0, 32], [50, 22]].forEach(function (d) {
      ctx.beginPath(); ctx.ellipse(d[0] * s, -120 * s, d[1] * 0.75 * s, d[1] * s, 0, Math.PI, 0); ctx.fill();
      ctx.fillRect((d[0] - 1.5) * s, (-120 - d[1] - 16) * s, 3 * s, 16 * s);
    });
    ctx.beginPath(); ctx.ellipse(150 * s, -220 * s, 16 * s, 24 * s, 0, Math.PI, 0); ctx.fill();
    ctx.restore();
  }

  landmarks.spis = spisLm;
  landmarks.dubrovnik = dubrovnikLm;
  landmarks.stsava = stSavaLm;
  landmarks.rila = rilaLm;
  landmarks.lavra = lavraLm;

  // ── 非洲篇（v1.21）地標 ──

  /** 摩洛哥：庫圖比亞清真寺的方形宣禮塔（紅土色塔身、拱形窗、頂上的小塔與三顆金球） */
  function koutoubiaLm(ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    // 旁邊低矮的清真寺本體
    ctx.fillStyle = 'rgba(196, 130, 86, 0.55)';
    ctx.fillRect(-170 * s, -60 * s, 140 * s, 60 * s);
    // 宣禮塔塔身
    ctx.fillStyle = 'rgba(200, 128, 80, 0.75)';
    ctx.fillRect(-30 * s, -250 * s, 60 * s, 250 * s);
    // 塔頂城垛
    ctx.fillStyle = 'rgba(176, 108, 66, 0.8)';
    for (let i = 0; i < 4; i++) ctx.fillRect((-30 + i * 16) * s, -262 * s, 10 * s, 12 * s);
    // 頂上的小塔 + 金球
    ctx.fillStyle = 'rgba(200, 128, 80, 0.8)';
    ctx.fillRect(-12 * s, -300 * s, 24 * s, 40 * s);
    ctx.fillStyle = 'rgba(236, 196, 80, 0.9)';
    [0, 1, 2].forEach(function (k) { ctx.beginPath(); ctx.arc(0, (-306 - k * 9) * s, (5 - k) * s, 0, Math.PI * 2); ctx.fill(); });
    // 拱形窗與綠色磁磚帶
    ctx.fillStyle = 'rgba(70, 40, 30, 0.45)';
    [-200, -140, -80].forEach(function (yy) {
      ctx.beginPath(); ctx.moveTo(-9 * s, yy * s); ctx.lineTo(-9 * s, (yy - 16) * s);
      ctx.arc(0, (yy - 16) * s, 9 * s, Math.PI, 0); ctx.lineTo(9 * s, yy * s); ctx.fill();
    });
    ctx.fillStyle = 'rgba(40, 120, 90, 0.6)';
    ctx.fillRect(-30 * s, -232 * s, 60 * s, 5 * s);
    ctx.restore();
  }

  landmarks.koutoubia = koutoubiaLm;

  // ── v1.23 非洲篇補齊：阿爾及利亞、突尼西亞、利比亞、埃及 ──

  /** 阿爾及利亞：塔西利高原的砂岩石林（風蝕成蘑菇狀的石柱＋天然石拱） */
  function tassiliLm(ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(150, 80, 50, 0.6)';
    // 石拱
    ctx.beginPath();
    ctx.moveTo(-170 * s, 0); ctx.lineTo(-160 * s, -150 * s); ctx.quadraticCurveTo(-90 * s, -190 * s, -20 * s, -150 * s);
    ctx.lineTo(-10 * s, 0); ctx.lineTo(-45 * s, 0); ctx.quadraticCurveTo(-60 * s, -110 * s, -90 * s, -112 * s);
    ctx.quadraticCurveTo(-125 * s, -110 * s, -135 * s, 0); ctx.closePath(); ctx.fill();
    // 蘑菇石柱
    [[40, 210, 26], [110, 160, 20], [170, 230, 30]].forEach(function (c) {
      ctx.fillStyle = 'rgba(165, 92, 58, 0.62)';
      ctx.fillRect((c[0] - c[2] * 0.45) * s, -c[1] * s, c[2] * 0.9 * s, c[1] * s);
      ctx.beginPath(); ctx.ellipse(c[0] * s, -c[1] * s, c[2] * 1.3 * s, c[2] * 0.6 * s, 0, 0, Math.PI * 2); ctx.fill();
    });
    // 岩畫：一頭長頸鹿（白色線條）
    ctx.strokeStyle = 'rgba(250, 236, 210, 0.75)'; ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(-150 * s, -40 * s); ctx.lineTo(-150 * s, -60 * s); ctx.lineTo(-120 * s, -60 * s); ctx.lineTo(-120 * s, -40 * s);
    ctx.moveTo(-122 * s, -60 * s); ctx.lineTo(-112 * s, -96 * s); ctx.lineTo(-104 * s, -96 * s);
    ctx.stroke();
    ctx.restore();
  }

  /** 突尼西亞：托澤老城的黃磚門樓（磚砌出鑽石、菱形的幾何花紋） */
  function tozeurLm(ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(214, 170, 104, 0.7)';
    ctx.fillRect(-110 * s, -170 * s, 220 * s, 170 * s);
    ctx.fillRect(-140 * s, -110 * s, 30 * s, 110 * s);
    ctx.fillRect(110 * s, -110 * s, 30 * s, 110 * s);
    // 門
    ctx.fillStyle = 'rgba(70, 50, 30, 0.5)';
    ctx.beginPath(); ctx.moveTo(-26 * s, 0); ctx.lineTo(-26 * s, -70 * s); ctx.arc(0, -70 * s, 26 * s, Math.PI, 0); ctx.lineTo(26 * s, 0); ctx.fill();
    // 磚紋：凸出的磚排成菱形
    ctx.fillStyle = 'rgba(150, 104, 56, 0.6)';
    for (let r = 0; r < 3; r++) {
      for (let k = -3; k <= 3; k++) {
        const cx = k * 30 * s, cy = (-150 + r * 26) * s;
        ctx.beginPath(); ctx.moveTo(cx, cy - 8 * s); ctx.lineTo(cx + 8 * s, cy); ctx.lineTo(cx, cy + 8 * s); ctx.lineTo(cx - 8 * s, cy); ctx.fill();
      }
    }
    // 頂上的鋸齒
    for (let k = 0; k < 9; k++) ctx.fillRect((-108 + k * 25) * s, -182 * s, 14 * s, 12 * s);
    ctx.restore();
  }

  /** 利比亞：大萊普提斯的塞維魯凱旋門（四面拱門）＋旁邊一排羅馬柱 */
  function leptisLm(ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(226, 206, 168, 0.68)';
    ctx.fillRect(-90 * s, -200 * s, 180 * s, 200 * s);
    ctx.fillStyle = 'rgba(200, 180, 140, 0.7)';
    ctx.fillRect(-100 * s, -216 * s, 200 * s, 18 * s);
    ctx.fillStyle = 'rgba(90, 76, 60, 0.45)';
    ctx.beginPath(); ctx.moveTo(-40 * s, 0); ctx.lineTo(-40 * s, -100 * s); ctx.arc(0, -100 * s, 40 * s, Math.PI, 0); ctx.lineTo(40 * s, 0); ctx.fill();
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = 'rgba(232, 214, 178, 0.6)';
      ctx.fillRect((120 + k * 30) * s, -150 * s, 14 * s, 150 * s);
      ctx.fillRect((115 + k * 30) * s, -158 * s, 24 * s, 8 * s);
    }
    ctx.fillRect(115 * s, -168 * s, 174 * s, 10 * s);
    ctx.restore();
  }

  /** 埃及：吉薩三座金字塔 */
  function pyramidsLm(ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    [[-120, 120, 'rgba(214, 170, 100, 0.55)'], [60, 220, 'rgba(224, 180, 106, 0.7)'], [230, 150, 'rgba(204, 160, 92, 0.6)']].forEach(function (p) {
      ctx.fillStyle = p[2];
      ctx.beginPath(); ctx.moveTo((p[0] - p[1]) * s, 0); ctx.lineTo(p[0] * s, -p[1] * s); ctx.lineTo((p[0] + p[1]) * s, 0); ctx.closePath(); ctx.fill();
      // 背光面
      ctx.fillStyle = 'rgba(120, 80, 40, 0.25)';
      ctx.beginPath(); ctx.moveTo(p[0] * s, -p[1] * s); ctx.lineTo((p[0] + p[1]) * s, 0); ctx.lineTo((p[0] + p[1] * 0.3) * s, 0); ctx.closePath(); ctx.fill();
    });
    ctx.restore();
  }

  landmarks.tassili = tassiliLm;
  landmarks.tozeur = tozeurLm;
  landmarks.leptis = leptisLm;
  landmarks.pyramids = pyramidsLm;

  // 遠景
  // 阿爾及利亞：一層層的紅色沙丘＋遠方平頂山
  skylines.DZ = function (ctx, camX, gy, W) {
    ridge(ctx, camX, 0.08, gy - 50, W, 'rgba(170, 96, 60, 0.45)', 120, 4, 13);
    tiled(ctx, camX, 0.18, 640, W, function (x0) {
      ctx.fillStyle = 'rgba(160, 84, 50, 0.5)';
      ctx.fillRect(x0 + 120, gy - 120, 150, 120);
      ctx.beginPath(); ctx.moveTo(x0 + 90, gy); ctx.lineTo(x0 + 120, gy - 120); ctx.lineTo(x0 + 120, gy); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x0 + 270, gy - 120); ctx.lineTo(x0 + 300, gy); ctx.lineTo(x0 + 270, gy); ctx.fill();
    });
    ridge(ctx, camX, 0.3, gy, W, 'rgba(220, 150, 90, 0.55)', 60, 0, 5);
  };
  // 突尼西亞：鹽湖的白色湖面＋海市蜃樓（倒影晃動的椰棗樹）
  skylines.TN = function (ctx, camX, gy, W, def, t) {
    ctx.fillStyle = 'rgba(236, 240, 236, 0.6)';
    ctx.fillRect(0, gy - 40, W, 40);
    tiled(ctx, camX, 0.15, 420, W, function (x0) {
      for (let k = 0; k < 3; k++) {
        const px = x0 + 80 + k * 46, wob = Math.sin(t * 0.05 + k) * 2;
        ctx.fillStyle = 'rgba(70, 110, 70, 0.45)';
        ctx.fillRect(px + wob, gy - 96, 4, 56);
        ctx.beginPath(); ctx.ellipse(px + 2 + wob, gy - 98, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
        // 倒影
        ctx.fillStyle = 'rgba(70, 110, 70, 0.18)';
        ctx.fillRect(px - wob, gy - 40, 4, 26);
      }
    });
  };
  // 利比亞：地中海＋沙丘上露出的古城牆
  skylines.LY = function (ctx, camX, gy, W, def, t) {
    seaBand(ctx, gy, W, gy - 70, 'rgba(50, 130, 190, 0.55)', t);
    tiled(ctx, camX, 0.25, 520, W, function (x0) {
      ctx.fillStyle = 'rgba(214, 196, 160, 0.6)';
      ctx.fillRect(x0 + 40, gy - 50, 260, 50);
      for (let k = 0; k < 8; k++) ctx.fillRect(x0 + 60 + k * 30, gy - 100, 10, 50);
      ctx.fillRect(x0 + 52, gy - 108, 240, 8);
    });
  };
  // 埃及：尼羅河與三角帆船
  skylines.EG = function (ctx, camX, gy, W, def, t) {
    seaBand(ctx, gy, W, gy - 34, 'rgba(60, 120, 150, 0.55)', t);
    tiled(ctx, camX, 0.2, 480, W, function (x0) {
      const bx = x0 + 200 + Math.sin(t * 0.01) * 20;
      ctx.fillStyle = 'rgba(90, 60, 40, 0.5)';
      ctx.fillRect(bx - 20, gy - 30, 40, 6);
      ctx.fillStyle = 'rgba(250, 244, 230, 0.7)';
      ctx.beginPath(); ctx.moveTo(bx, gy - 30); ctx.lineTo(bx, gy - 90); ctx.lineTo(bx + 34, gy - 34); ctx.closePath(); ctx.fill();
    });
  };

  // 裝備圖示
  /** 圖阿雷格頭巾 tagelmust：靛藍色的纏頭布，只露出眼睛 */
  icons.tagelmust = function (ctx, s) {
    ctx.fillStyle = '#2a3a8a';
    ctx.beginPath(); ctx.ellipse(0, -4 * s, 13 * s, 11 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-11 * s, -2 * s, 22 * s, 12 * s);
    ctx.fillStyle = '#4a5ab0';
    ctx.fillRect(-13 * s, -8 * s, 26 * s, 3 * s);
    ctx.fillStyle = '#c89a6a';
    ctx.fillRect(-8 * s, 0, 16 * s, 4 * s);
    ctx.fillStyle = '#1a1424';
    ctx.fillRect(-5 * s, 1 * s, 3 * s, 2 * s); ctx.fillRect(2 * s, 1 * s, 3 * s, 2 * s);
  };
  /** 法蒂瑪之手 khamsa：藍色手掌、中間一顆眼睛 */
  icons.khamsa = function (ctx, s) {
    ctx.fillStyle = '#3a8ad0';
    for (let k = 0; k < 3; k++) U.roundRect(ctx, (-7 + k * 5) * s, -14 * s, 4 * s, 12 * s, 2 * s), ctx.fill();
    ctx.beginPath(); ctx.ellipse(-10 * s, 0, 3 * s, 6 * s, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10 * s, 0, 3 * s, 6 * s, 0.4, 0, Math.PI * 2); ctx.fill();
    U.roundRect(ctx, -9 * s, -4 * s, 18 * s, 16 * s, 6 * s); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(0, 4 * s, 5 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a3a6a';
    ctx.beginPath(); ctx.arc(0, 4 * s, 1.8 * s, 0, Math.PI * 2); ctx.fill();
  };
  /** 古達米斯皮靴：紅色軟皮短靴，鞋面有黃綠刺繡 */
  icons.ghadames = function (ctx, s) {
    ctx.fillStyle = '#b8402a';
    ctx.beginPath();
    ctx.moveTo(-8 * s, -12 * s); ctx.lineTo(4 * s, -12 * s); ctx.lineTo(4 * s, 0);
    ctx.quadraticCurveTo(14 * s, 0, 15 * s, 6 * s); ctx.lineTo(-10 * s, 6 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6a2a18'; ctx.fillRect(-10 * s, 6 * s, 25 * s, 3 * s);
    ctx.fillStyle = '#f1c40f'; ctx.fillRect(-6 * s, -9 * s, 8 * s, 2 * s);
    ctx.fillStyle = '#3fa04a'; ctx.fillRect(-6 * s, -5 * s, 8 * s, 2 * s);
  };
  /** 安卡 ankh：金色、上面一個環的十字 */
  icons.ankh = function (ctx, s) {
    ctx.strokeStyle = '#e8b830'; ctx.lineWidth = 4 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(0, -9 * s, 5 * s, 6 * s, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -3 * s); ctx.lineTo(0, 13 * s); ctx.moveTo(-9 * s, 1 * s); ctx.lineTo(9 * s, 1 * s); ctx.stroke();
    ctx.lineCap = 'butt';
  };

  /** 埃及：方尖碑（道具） */
  props.obelisk = function (ctx, x, baseY) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = '#d8b878';
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-10, -150); ctx.lineTo(0, -166); ctx.lineTo(10, -150); ctx.lineTo(14, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(120, 80, 40, 0.5)';
    for (let k = 0; k < 6; k++) ctx.fillRect(-4, -136 + k * 20, 8, 3);
    ctx.fillStyle = '#e8c860';
    ctx.beginPath(); ctx.moveTo(-10, -150); ctx.lineTo(0, -166); ctx.lineTo(10, -150); ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  /**
   * 埃及最終魔王：人面獅身。趴著的獅身＋戴法老藍金條紋頭巾（nemes）的人頭。
   * 重壓前會撐起前腳、齊射時張嘴；破綻期趴平、頭巾歪掉。
   */
  function bossSphinx(ctx, b, t) {
    const stunned = b.phase === 'recover';
    const act = b.phase === 'act' || b.phase === 'telegraph';
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h);
    ctx.scale(b.dir < 0 ? -1 : 1, 1);
    // 獅身
    ctx.fillStyle = '#d8a860';
    U.roundRect(ctx, -48, -40, 82, 34, 14); ctx.fill();
    // 腿（前腳伸向前方）
    ctx.fillRect(-44, -12, 14, 12);
    ctx.fillRect(16, -10, 34, 10);
    // 尾巴
    ctx.strokeStyle = '#c0904a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-46, -30); ctx.quadraticCurveTo(-60, -40 + Math.sin(t * 0.1) * 4, -54, -54); ctx.stroke();
    // 頭（在前方偏上）＋把頭接到身體的胸口
    const hy = stunned ? -46 : act ? -76 : -68;
    ctx.fillStyle = '#d8a860';
    ctx.beginPath(); ctx.moveTo(6, -36); ctx.lineTo(14, hy + 14); ctx.lineTo(40, hy + 14); ctx.lineTo(44, -30); ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.translate(26, hy);
    if (stunned) ctx.rotate(0.25);
    // 頭巾 nemes：藍金條紋，兩側垂下
    ctx.fillStyle = '#e8c040';
    ctx.beginPath(); ctx.moveTo(-20, -8); ctx.quadraticCurveTo(0, -30, 20, -8); ctx.lineTo(22, 26); ctx.lineTo(12, 26); ctx.lineTo(10, 4); ctx.lineTo(-10, 4); ctx.lineTo(-12, 26); ctx.lineTo(-22, 26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a50a0';
    for (let k = 0; k < 4; k++) {
      ctx.fillRect(-22 + (k % 2) * 34, 0 + Math.floor(k / 2) * 12 + 4, 10, 4);
    }
    ctx.fillRect(-14, -14, 28, 3);
    // 臉
    ctx.fillStyle = '#c89050';
    U.roundRect(ctx, -10, -8, 20, 22, 6); ctx.fill();
    ctx.fillStyle = stunned ? '#ffd166' : '#1a1424';
    ctx.fillRect(-6, -2, 4, 3); ctx.fillRect(3, -2, 4, 3);
    // 嘴：齊射時張開
    ctx.fillStyle = '#6a2a1a';
    if (b.phase === 'act') {     // 唸咒（噴沙柱）時嘴巴張開
      ctx.beginPath(); ctx.ellipse(1, 8, 4, 3, 0, 0, Math.PI * 2); ctx.fill(); }
    else ctx.fillRect(-3, 8, 7, 1.5);
    // 法老鬍
    ctx.fillStyle = '#2a50a0'; ctx.fillRect(-2, 14, 5, 8);
    ctx.restore();
    ctx.restore();
  }
  bossKinds.sphinx = bossSphinx;

  // ── v1.24.2 亞特蘭提斯改成往下潛的豎井：主題 'atlantis' ──

  /** 背景：越往下越深的藍，遠處一排排沉沒的柱子與拱門（視差）、往上飄的氣泡、斜射的光 */
  function atlantisBackdrop(ctx, camY, t, W, H) {
    ctx.save();
    // 遠處的廢墟（視差 0.3）
    const par = camY * 0.3;
    ctx.fillStyle = 'rgba(120, 180, 200, 0.12)';
    for (let row = Math.floor(par / 260) - 1; row < Math.floor(par / 260) + 3; row++) {
      const y0 = row * 260 - par;
      for (let k = 0; k < 4; k++) {
        const x = ((row * 157 + k * 260) % 1040) - 40;
        ctx.fillRect(x, y0 + 40, 16, 150);
        ctx.fillRect(x + 60, y0 + 40, 16, 150);
        ctx.fillRect(x - 10, y0 + 30, 96, 12);
        ctx.beginPath(); ctx.moveTo(x - 10, y0 + 30); ctx.lineTo(x + 38, y0); ctx.lineTo(x + 86, y0 + 30); ctx.fill();
      }
    }
    // 光
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) {
      const x = 120 + k * 230 + Math.sin(t * 0.01 + k) * 20;
      ctx.fillStyle = 'rgba(160, 220, 255, 0.05)';
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x + 140, H); ctx.lineTo(x + 70, H); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // 氣泡
    ctx.strokeStyle = 'rgba(210, 240, 255, 0.35)'; ctx.lineWidth = 1;
    for (let k = 0; k < 14; k++) {
      const x = (k * 71) % W + Math.sin(t * 0.03 + k) * 6;
      const y = H - ((t * (0.5 + (k % 3) * 0.2) + k * 97 + camY * 0.5) % (H + 40));
      ctx.beginPath(); ctx.arc(x, y, 2 + (k % 3), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  /** 兩側：長滿珊瑚與海藻的石壁 */
  function atlantisWall(ctx, wall, camY, viewH, t) {
    ctx.fillStyle = '#20414e';
    ctx.fillRect(wall.x, camY - 20, wall.w, viewH + 40);
    const inner = wall.x < 480 ? wall.x + wall.w : wall.x;
    const side = wall.x < 480 ? -1 : 1;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    const bh = 30, start = Math.floor((camY - 20) / bh);
    for (let i = 0; i < viewH / bh + 3; i++) {
      const by = (start + i) * bh;
      const st = ((start + i) % 2) * 22;
      for (let bx = wall.x + st; bx < wall.x + wall.w; bx += 44) ctx.fillRect(bx + 2, by + 2, 38, bh - 4);
    }
    // 內緣的珊瑚與海藻（照世界座標排，捲動時不會跳）
    for (let i = 0; i < viewH / 60 + 3; i++) {
      const wy = (Math.floor((camY - 20) / 60) + i) * 60;
      const kind = Math.abs(wy / 60) % 3;
      if (kind === 0) {
        ctx.fillStyle = '#e0708a';
        for (let b = 0; b < 3; b++) {
          ctx.beginPath(); ctx.ellipse(inner + side * (6 + b * 4), wy + 10 + b * 8, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
        }
      } else if (kind === 1) {
        ctx.strokeStyle = '#3fa86a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(inner, wy + 40);
        ctx.quadraticCurveTo(inner - side * (10 + Math.sin(t * 0.05 + wy) * 6), wy + 20, inner - side * 4, wy);
        ctx.stroke();
      }
    }
  }

  /**
   * 海神波賽頓：站在神殿終點迎接玩家（白鬍子、金冠、藍綠色長袍，一手拿三叉戟、一手揮手）。
   * x = 腳底中心、baseY = 站的地面。約 96px 高，比玩家大一倍 —— 一看就知道是神。
   */
  function poseidon(ctx, x, baseY, t) {
    const wave = Math.sin(t * 0.12) * 0.5;
    ctx.save();
    ctx.translate(x, baseY);
    // 光環
    const g = ctx.createRadialGradient(0, -60, 6, 0, -60, 70);
    g.addColorStop(0, 'rgba(160, 250, 240, 0.35)');
    g.addColorStop(1, 'rgba(160, 250, 240, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, -60, 70, 0, Math.PI * 2); ctx.fill();
    // 長袍
    ctx.fillStyle = '#2a8a8a';
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-14, -56); ctx.lineTo(14, -56); ctx.lineTo(20, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8d8b0';
    ctx.beginPath(); ctx.moveTo(-14, -56); ctx.lineTo(4, -56); ctx.lineTo(-10, 0); ctx.lineTo(-18, 0); ctx.closePath(); ctx.fill();   // 斜披的白布
    // 揮手的手臂（右）
    ctx.save();
    ctx.translate(13, -50);
    ctx.rotate(-1.9 + wave);
    ctx.fillStyle = '#7ac8c0';
    U.roundRect(ctx, 0, -4, 24, 8, 4); ctx.fill();
    ctx.beginPath(); ctx.arc(26, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 三叉戟（左手）
    ctx.strokeStyle = '#f0c840'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-24, 2); ctx.lineTo(-24, -96);
    ctx.moveTo(-32, -86); ctx.lineTo(-32, -100); ctx.moveTo(-16, -86); ctx.lineTo(-16, -100); ctx.moveTo(-32, -86); ctx.lineTo(-16, -86);
    ctx.moveTo(-24, -96); ctx.lineTo(-24, -104);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#7ac8c0';
    ctx.beginPath(); ctx.arc(-20, -46, 5, 0, Math.PI * 2); ctx.fill();
    // 頭、白鬍子、金冠
    ctx.fillStyle = '#8ad0c8';
    ctx.beginPath(); ctx.arc(0, -66, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4f4f0';
    ctx.beginPath(); ctx.moveTo(-10, -64); ctx.quadraticCurveTo(0, -38, 10, -64); ctx.quadraticCurveTo(0, -58, -10, -64); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -72, 10, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#1a1424';
    ctx.fillRect(-5, -69, 2, 2); ctx.fillRect(3, -69, 2, 2);
    ctx.fillStyle = '#f0c840';
    ctx.beginPath();
    ctx.moveTo(-10, -78); ctx.lineTo(-8, -88); ctx.lineTo(-4, -81); ctx.lineTo(0, -91); ctx.lineTo(4, -81); ctx.lineTo(8, -88); ctx.lineTo(10, -78);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  /** 樓層：長青苔的石板；終點 = 海神殿（金色地板＋背後的神殿正面） */
  function atlantisFloor(ctx, f, x, y, w, h, t) {
    if (f.goal) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#d8d0b0';
      ctx.fillRect(x + 20, y - 150, w - 40, 14);
      ctx.beginPath(); ctx.moveTo(x + 10, y - 150); ctx.lineTo(x + w / 2, y - 200); ctx.lineTo(x + w - 10, y - 150); ctx.closePath(); ctx.fill();
      for (let cx = x + 40; cx < x + w - 40; cx += 70) ctx.fillRect(cx, y - 136, 18, 136);
      // 山牆上的三叉戟
      ctx.strokeStyle = '#e8c050'; ctx.lineWidth = 3;
      const tx = x + w / 2, ty = y - 172;
      ctx.beginPath(); ctx.moveTo(tx, ty + 20); ctx.lineTo(tx, ty - 10);
      ctx.moveTo(tx - 10, ty - 6); ctx.lineTo(tx - 10, ty + 4); ctx.lineTo(tx + 10, ty + 4); ctx.lineTo(tx + 10, ty - 6);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#8a6a30';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#f0cc60';
      ctx.fillRect(x, y, w, 4);
      const glow = 0.25 + Math.sin(t * 0.08) * 0.1;
      ctx.fillStyle = 'rgba(255, 230, 150, ' + glow.toFixed(2) + ')';
      ctx.fillRect(x, y - 4, w, 4);
      // v1.25.1 玩家：要有海神站在終點迎接我們
      poseidon(ctx, x + w - 80, y, t);
      return true;
    }
    if (f.type && f.type !== 'normal') return false;     // 滑台等特殊樓層照預設畫法
    ctx.fillStyle = '#6a7a72';
    U.roundRect(ctx, x, y, w, h, 4); ctx.fill();
    ctx.fillStyle = '#4f9a6a';
    ctx.beginPath();
    ctx.moveTo(x, y + 5);
    for (let px = x; px < x + w; px += 12) ctx.quadraticCurveTo(px + 6, y - 2, px + 12, y + 4);
    ctx.lineTo(x + w, y + 6); ctx.lineTo(x, y + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + w * 0.3, y + 8, 2, h - 8);
    ctx.fillRect(x + w * 0.7, y + 8, 2, h - 8);
    return true;
  }

  /** 上面追下來的：崩落的礁石，底下一排紫色海膽刺 */
  function atlantisCeiling(ctx, screenTop, h, w, t) {
    ctx.save();
    ctx.fillStyle = '#2c3a48';
    ctx.fillRect(0, screenTop, w, h - 10);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let x = 0; x < w; x += 46) ctx.fillRect(x + 4, screenTop + 4, 38, h - 18);
    const n = Math.ceil(w / 24);
    for (let i = 0; i < n; i++) {
      const sx = i * 24, len = 12 + (i % 3) * 3 + Math.sin(t * 0.2 + i) * 1.5;
      ctx.fillStyle = '#7a3a8a';
      ctx.beginPath(); ctx.arc(sx + 12, screenTop + h - 10, 7, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = '#c070d8'; ctx.lineWidth = 2;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath(); ctx.moveTo(sx + 12, screenTop + h - 8); ctx.lineTo(sx + 12 + k * 6, screenTop + h - 8 + len); ctx.stroke();
      }
    }
    // 碎石往下掉
    ctx.fillStyle = 'rgba(120, 140, 150, 0.7)';
    for (let k = 0; k < 6; k++) {
      const x = (k * 167 + t * 0.7) % w, y = screenTop + h + ((t * 1.3 + k * 31) % 40);
      ctx.fillRect(x, y, 3, 3);
    }
    ctx.restore();
  }

  /**
   * 海神夥伴：騎著海豚的小海神（藍綠色皮膚、金冠、拿三叉戟）。
   * x, y = 中心；s = 大小倍率（過關畫面用小一號的）。
   */
  function seaAlly(ctx, x, y, t, facing, s) {
    s = s || 1;
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 0.08) * 2);
    ctx.scale((facing < 0 ? -1 : 1) * s, s);
    // 光暈
    ctx.fillStyle = 'rgba(140, 240, 230, 0.18)';
    ctx.beginPath(); ctx.arc(0, -2, 26, 0, Math.PI * 2); ctx.fill();
    // 海豚
    ctx.fillStyle = '#5a9ac8';
    ctx.beginPath();
    ctx.moveTo(-22, 4); ctx.quadraticCurveTo(-4, -8, 16, 2); ctx.lineTo(24, 4); ctx.lineTo(16, 7);
    ctx.quadraticCurveTo(-2, 14, -22, 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-20, 5); ctx.lineTo(-28, -2 + Math.sin(t * 0.3) * 2); ctx.lineTo(-27, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d8ecf8';
    ctx.beginPath(); ctx.ellipse(2, 8, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1424'; ctx.fillRect(13, 1, 2, 2);
    // 小海神
    ctx.fillStyle = '#4ab8a8';
    U.roundRect(ctx, -6, -14, 10, 14, 3); ctx.fill();
    ctx.beginPath(); ctx.arc(-1, -19, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0c840';
    ctx.beginPath(); ctx.moveTo(-6, -23); ctx.lineTo(-5, -29); ctx.lineTo(-2, -25); ctx.lineTo(1, -30); ctx.lineTo(3, -25); ctx.lineTo(5, -29); ctx.lineTo(5, -23); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1a1424'; ctx.fillRect(1, -20, 2, 2);
    // 三叉戟
    ctx.strokeStyle = '#f0c840'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(6, -30);
    ctx.moveTo(2, -26); ctx.lineTo(2, -32); ctx.moveTo(10, -26); ctx.lineTo(10, -32); ctx.moveTo(2, -26); ctx.lineTo(10, -26);
    ctx.stroke();
    ctx.restore();
  }

  /** 飛出去的三叉戟（a = 飛行方向角度） */
  function tridentShot(ctx, x, y, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a || 0);
    ctx.strokeStyle = '#f0c840'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(10, 0);
    ctx.moveTo(10, -7); ctx.lineTo(18, -7); ctx.moveTo(10, 7); ctx.lineTo(18, 7); ctx.moveTo(10, -7); ctx.lineTo(10, 7); ctx.moveTo(10, 0); ctx.lineTo(19, 0);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(160, 240, 230, 0.5)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-18, 0); ctx.stroke();
    ctx.restore();
  }

  // ── v1.26 安提基特拉沉船（港口 A：沉船潛水）──

  /** 沉船的寶物圖示（id 見 Encounter.RELICS） */
  function relic(ctx, id, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s || 1, s || 1);
    if (id === 'amphora') {
      ctx.fillStyle = '#c87a48';
      ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(4, -12); ctx.lineTo(3, -8);
      ctx.quadraticCurveTo(10, -4, 6, 6); ctx.lineTo(0, 13); ctx.lineTo(-6, 6); ctx.quadraticCurveTo(-10, -4, -3, -8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#a05a30'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(-6, -8, 3, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(6, -8, 3, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-3, -4, 2, 8);
    } else if (id === 'philosopher') {
      ctx.fillStyle = '#5a8a6a';                       // 銅綠
      ctx.beginPath(); ctx.arc(0, -3, 9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.quadraticCurveTo(0, 16, 8, 0); ctx.closePath(); ctx.fill();   // 大鬍子
      ctx.fillStyle = '#2a3a30'; ctx.fillRect(-4, -5, 2, 2); ctx.fillRect(2, -5, 2, 2);
      ctx.fillStyle = 'rgba(200, 240, 210, 0.35)'; ctx.fillRect(-6, -10, 4, 3);
    } else if (id === 'coin') {
      ctx.fillStyle = '#d8d8e0';
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#9a9aa8'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#8a8a98';
      ctx.beginPath(); ctx.arc(1, -1, 3.5, 0, Math.PI * 2); ctx.fill();   // 頭像
    } else {
      // 安提基特拉機械：青銅外殼裡露出齒輪
      ctx.fillStyle = '#5a7a6a';
      U.roundRect(ctx, -11, -11, 22, 22, 3); ctx.fill();
      ctx.strokeStyle = '#c8a050'; ctx.lineWidth = 1.6;
      [[ -3, -2, 6, 8], [ 5, 4, 4, 6]].forEach(function (g) {
        ctx.beginPath(); ctx.arc(g[0], g[1], g[2], 0, Math.PI * 2); ctx.stroke();
        for (let k = 0; k < g[3]; k++) {
          const a = k * Math.PI * 2 / g[3];
          ctx.beginPath(); ctx.moveTo(g[0] + Math.cos(a) * g[2], g[1] + Math.sin(a) * g[2]);
          ctx.lineTo(g[0] + Math.cos(a) * (g[2] + 2.5), g[1] + Math.sin(a) * (g[2] + 2.5)); ctx.stroke();
        }
      });
    }
    ctx.restore();
  }

  /** 地標：斜躺在海底的羅馬貨船殘骸（斷掉的桅杆、船肋骨架、散落的陶罐） */
  landmarks.wreckhull = function (ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.rotate(-0.08);
    ctx.fillStyle = 'rgba(90, 70, 50, 0.6)';
    ctx.beginPath(); ctx.moveTo(-200 * s, -20 * s); ctx.quadraticCurveTo(-60 * s, 30 * s, 210 * s, -10 * s); ctx.lineTo(180 * s, -90 * s); ctx.lineTo(-170 * s, -80 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(70, 55, 40, 0.7)'; ctx.lineWidth = 6 * s;
    for (let k = 0; k < 7; k++) {
      const bx = (-150 + k * 50) * s;
      ctx.beginPath(); ctx.moveTo(bx, -80 * s); ctx.quadraticCurveTo(bx + 10 * s, -150 * s, bx + 30 * s, -170 * s); ctx.stroke();
    }
    ctx.lineWidth = 8 * s;
    ctx.beginPath(); ctx.moveTo(20 * s, -85 * s); ctx.lineTo(90 * s, -260 * s); ctx.stroke();      // 斷掉的桅杆
    ctx.fillStyle = 'rgba(200, 120, 70, 0.5)';
    for (let k = 0; k < 5; k++) {
      ctx.beginPath(); ctx.ellipse((-120 + k * 40) * s, -6 * s, 8 * s, 14 * s, 0.6 + k * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  /** 遠景：遠方另一艘沉船的剪影＋珊瑚礁 */
  skylines.WRK = function (ctx, camX, gy, W, def, t) {
    ridge(ctx, camX, 0.08, gy - 40, W, 'rgba(20, 60, 100, 0.55)', 140, 12, 33);
    tiled(ctx, camX, 0.18, 700, W, function (x0) {
      ctx.fillStyle = 'rgba(40, 70, 90, 0.5)';
      ctx.beginPath(); ctx.moveTo(x0 + 120, gy - 30); ctx.quadraticCurveTo(x0 + 240, gy, x0 + 380, gy - 40); ctx.lineTo(x0 + 360, gy - 80); ctx.lineTo(x0 + 140, gy - 70); ctx.closePath(); ctx.fill();
      ctx.fillRect(x0 + 250, gy - 190, 6, 120);
      ctx.fillStyle = 'rgba(230, 120, 140, 0.4)';
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x0 + 520 + k * 22, gy - 12 - (k % 2) * 10, 9, 16, 0, 0, Math.PI * 2); ctx.fill(); }
    });
    ridge(ctx, camX, 0.3, gy, W, 'rgba(30, 80, 110, 0.6)', 50, 4, 9);
  };

  /** 沉船的海底生物：螃蟹、魚沿用亞特蘭提斯；追人的換成鯊魚 */
  COUNTRY_ENEMIES.WRK = {
    walker: function () { return COUNTRY_ENEMIES.ATL.walker.apply(null, arguments); },   // ATL 定義在下面：用的時候才取
    flyer: function () { return COUNTRY_ENEMIES.ATL.flyer.apply(null, arguments); },
    chaser: function (ctx, e, t) {
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      const d = (e.vx || 0) < 0 ? -1 : 1;
      ctx.save();
      if (e.squash > 0) { ctx.translate(cx, cy); ctx.scale(1.3, 0.4); ctx.translate(-cx, -cy); }
      ctx.translate(cx, cy); ctx.scale(d, 1);
      ctx.fillStyle = '#7a8a9a';
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.quadraticCurveTo(4, -10, -14, -3); ctx.lineTo(-24, -10 + Math.sin(t * 0.3) * 3); ctx.lineTo(-20, 0);
      ctx.lineTo(-24, 9 + Math.sin(t * 0.3) * 3); ctx.lineTo(-14, 4); ctx.quadraticCurveTo(4, 9, 18, 0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-2, -6); ctx.lineTo(4, -16); ctx.lineTo(8, -5); ctx.closePath(); ctx.fill();   // 背鰭
      ctx.fillStyle = '#e8eef4';
      ctx.beginPath(); ctx.moveTo(16, 1); ctx.quadraticCurveTo(4, 7, -10, 3); ctx.lineTo(16, 1); ctx.fill();
      ctx.fillStyle = '#1a1424'; ctx.fillRect(10, -3, 2, 2);
      ctx.fillStyle = '#ffffff';
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(10 + k * 2, 2); ctx.lineTo(11 + k * 2, 4); ctx.lineTo(12 + k * 2, 2); ctx.fill(); }
      ctx.restore();
    }
  };

  // ── v1.23.1 亞特蘭提斯（潛水關）──

  /** 海帶：幾條會隨水流擺動的長葉（植物欄位用，跟樹一樣種在海床上） */
  decos.kelp = function (ctx, x, y, s) {
    const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 60;
    for (let k = 0; k < 3; k++) {
      const h = (60 + k * 22) * s, bx = x - 8 + k * 8;
      ctx.strokeStyle = k % 2 ? '#2f8a5a' : '#3fa86a';
      ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx, y);
      const sw = Math.sin(t * 0.05 + x * 0.01 + k) * 10 * s;
      ctx.quadraticCurveTo(bx + sw, y - h * 0.5, bx - sw * 0.6, y - h);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  };

  /** 地標：沉在海底的神殿（三角山牆＋斷掉的柱子＋海克力斯之柱的拱門） */
  landmarks.atlantis = function (ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(200, 220, 210, 0.45)';
    ctx.fillRect(-150 * s, -20 * s, 300 * s, 20 * s);
    for (let k = 0; k < 6; k++) {
      const h = k === 4 ? 110 : 170;            // 一根斷了
      ctx.fillRect((-130 + k * 50) * s, -(20 + h) * s, 22 * s, h * s);
    }
    ctx.beginPath(); ctx.moveTo(-160 * s, -190 * s); ctx.lineTo(0, -250 * s); ctx.lineTo(120 * s, -202 * s); ctx.lineTo(118 * s, -190 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(80, 200, 190, 0.35)';
    ctx.beginPath(); ctx.arc(0, -210 * s, 14 * s, 0, Math.PI * 2); ctx.fill();   // 山牆上的三叉戟徽記
    ctx.restore();
  };

  /** 遠景：一層層暗藍的海底丘陵＋遠方倒塌的城牆、珊瑚 */
  skylines.ATL = function (ctx, camX, gy, W, def, t) {
    ridge(ctx, camX, 0.08, gy - 40, W, 'rgba(20, 60, 100, 0.55)', 150, 10, 21);
    tiled(ctx, camX, 0.2, 560, W, function (x0) {
      ctx.fillStyle = 'rgba(120, 170, 180, 0.35)';
      ctx.fillRect(x0 + 60, gy - 90, 200, 90);
      for (let k = 0; k < 6; k++) ctx.fillRect(x0 + 60 + k * 36, gy - 112 + (k % 2) * 14, 18, 24);
      ctx.fillStyle = 'rgba(230, 110, 130, 0.45)';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.ellipse(x0 + 360 + k * 26, gy - 14 - (k % 2) * 10, 10, 18, 0, 0, Math.PI * 2); ctx.fill();
      }
    });
    ridge(ctx, camX, 0.3, gy, W, 'rgba(30, 80, 110, 0.6)', 50, 4, 7);
  };

  /** 亞特蘭提斯的海底生物：螃蟹（地上走）、魚（游）、水母（追著你漂） */
  COUNTRY_ENEMIES.ATL = {
    walker: function (ctx, e, t) {
      const cx = e.x + e.w / 2, by = e.y + e.h;
      ctx.save(); squashed(ctx, e, cx, by);
      ctx.fillStyle = '#e0603a';
      ctx.beginPath(); ctx.ellipse(cx, by - 9, 13, 8, 0, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx - 13, by - 9, 26, 3);
      const c = Math.sin(t * 0.3) * 2;
      [-1, 1].forEach(function (d) {
        ctx.beginPath(); ctx.arc(cx + d * 16, by - 14 + c * d, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(cx + d * 10 - 1.5, by - 6, 3, 6);
      });
      ctx.fillStyle = '#1a1424';
      ctx.fillRect(cx - 5, by - 19, 3, 4); ctx.fillRect(cx + 2, by - 19, 3, 4);
      ctx.restore();
    },
    flyer: function (ctx, e, t) {
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      ctx.save();
      if (e.squash > 0) { ctx.translate(cx, cy); ctx.scale(1.3, 0.4); ctx.translate(-cx, -cy); }
      const d = e.dir || 1;
      ctx.fillStyle = '#f0b030';
      ctx.beginPath(); ctx.ellipse(cx, cy, 15, 9, 0, 0, Math.PI * 2); ctx.fill();
      const tail = Math.sin(t * 0.4) * 4;
      ctx.beginPath(); ctx.moveTo(cx - d * 12, cy); ctx.lineTo(cx - d * 22, cy - 8 + tail); ctx.lineTo(cx - d * 22, cy + 8 + tail); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a6ab0';
      ctx.fillRect(cx - 3, cy - 9, 4, 18);
      ctx.fillStyle = '#1a1424';
      ctx.beginPath(); ctx.arc(cx + d * 8, cy - 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
    chaser: function (ctx, e, t) {
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      ctx.save();
      if (e.squash > 0) { ctx.translate(cx, cy); ctx.scale(1.3, 0.4); ctx.translate(-cx, -cy); }
      ctx.fillStyle = 'rgba(220, 150, 240, 0.8)';
      ctx.beginPath(); ctx.ellipse(cx, cy - 4, 14, 11, 0, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx - 14, cy - 4, 28, 3);
      ctx.strokeStyle = 'rgba(220, 150, 240, 0.7)'; ctx.lineWidth = 2;
      for (let k = 0; k < 4; k++) {
        const x = cx - 10 + k * 7;
        ctx.beginPath(); ctx.moveTo(x, cy); ctx.quadraticCurveTo(x + Math.sin(t * 0.2 + k) * 4, cy + 8, x, cy + 15); ctx.stroke();
      }
      ctx.restore();
    }
  };

  /** 保加利亞：大馬士革玫瑰花叢 */
  function roseBush(ctx, x, baseY, t) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = '#3f6a2e';
    ctx.beginPath(); ctx.ellipse(0, -14, 26, 14, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(-26, -14, 52, 14);
    [[-16, -20], [-4, -26], [10, -22], [20, -14], [-20, -8], [2, -12]].forEach(function (r, i) {
      ctx.fillStyle = i % 2 ? '#e86a9a' : '#f4a0c0';
      ctx.beginPath(); ctx.arc(r[0], r[1] + Math.sin(t * 0.05 + i) * 0.8, 4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  /** 烏克蘭：一叢向日葵 */
  function sunflowers(ctx, x, baseY, t) {
    ctx.save(); ctx.translate(x, baseY);
    for (let k = 0; k < 3; k++) {
      const sx = -24 + k * 24, h = 50 + (k % 2) * 16;
      ctx.strokeStyle = '#3f7a3a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, -h); ctx.stroke();
      ctx.fillStyle = '#f4c020';
      for (let i = 0; i < 10; i++) {
        const a = i / 10 * Math.PI * 2;
        ctx.beginPath(); ctx.ellipse(sx + Math.cos(a) * 9, -h + Math.sin(a) * 9, 4, 2.2, a, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#5a3a1a';
      ctx.beginPath(); ctx.arc(sx, -h, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  props.roseBush = roseBush;
  props.sunflowers = sunflowers;
  props.lavraProp = function (ctx, x, baseY, t, p) { lavraLm(ctx, x, baseY, (p && p.scale) || 1); };

  // 東歐第二批裝備圖示
  icons.valaska = function (ctx, s) {
    // 斯洛伐克牧羊人斧杖（valaška）
    ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.moveTo(-8 * s, 13 * s); ctx.lineTo(7 * s, -10 * s); ctx.stroke();
    ctx.fillStyle = '#b8c0cc';
    ctx.beginPath(); ctx.moveTo(4 * s, -12 * s); ctx.lineTo(13 * s, -10 * s); ctx.lineTo(10 * s, -3 * s); ctx.lineTo(5 * s, -6 * s); ctx.fill();
  };
  icons.cravat = function (ctx, s) {
    // 克羅埃西亞領巾（領帶就是從克羅埃西亞傭兵的領巾流傳開的）
    ctx.fillStyle = '#c0242a';
    ctx.beginPath(); ctx.moveTo(-6 * s, -12 * s); ctx.lineTo(6 * s, -12 * s); ctx.lineTo(3 * s, -6 * s); ctx.lineTo(-3 * s, -6 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-3 * s, -6 * s); ctx.lineTo(3 * s, -6 * s); ctx.lineTo(6 * s, 10 * s); ctx.lineTo(0, 14 * s); ctx.lineTo(-6 * s, 10 * s); ctx.fill();
    ctx.fillStyle = '#f4efe2';
    for (let i = 0; i < 3; i++) ctx.fillRect(-2 * s, (-2 + i * 5) * s, 4 * s, 2 * s);
  };
  icons.opanci = function (ctx, s) {
    // 塞爾維亞翹頭皮鞋（opanak）
    ctx.fillStyle = '#8a5a30';
    ctx.beginPath(); ctx.moveTo(-12 * s, 6 * s); ctx.lineTo(8 * s, 6 * s); ctx.quadraticCurveTo(16 * s, 4 * s, 12 * s, -4 * s);
    ctx.quadraticCurveTo(8 * s, 0, 4 * s, -2 * s); ctx.lineTo(-12 * s, -2 * s); ctx.fill();
    ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo((-9 + i * 4) * s, -2 * s); ctx.lineTo((-7 + i * 4) * s, 6 * s); ctx.stroke(); }
  };
  icons.rose = function (ctx, s) {
    // 保加利亞玫瑰精油瓶
    ctx.fillStyle = 'rgba(230, 120, 160, 0.85)';
    ctx.beginPath(); ctx.ellipse(0, 4 * s, 8 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8a050'; ctx.fillRect(-3 * s, -10 * s, 6 * s, 6 * s);
    ctx.fillStyle = '#e04a6a'; ctx.beginPath(); ctx.arc(0, -12 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
  };
  icons.vyshyvanka = function (ctx, s) {
    // 烏克蘭刺繡襯衫
    ctx.fillStyle = '#f4f0e6';
    ctx.beginPath(); ctx.moveTo(-6 * s, -12 * s); ctx.lineTo(6 * s, -12 * s); ctx.lineTo(14 * s, -6 * s); ctx.lineTo(10 * s, 0); ctx.lineTo(8 * s, -2 * s);
    ctx.lineTo(8 * s, 13 * s); ctx.lineTo(-8 * s, 13 * s); ctx.lineTo(-8 * s, -2 * s); ctx.lineTo(-10 * s, 0); ctx.lineTo(-14 * s, -6 * s); ctx.fill();
    ctx.fillStyle = '#c0242a';
    for (let i = 0; i < 4; i++) { ctx.fillRect(-1.5 * s, (-9 + i * 5) * s, 3 * s, 3 * s); }
    ctx.fillStyle = '#1a1a20';
    ctx.fillRect(-8 * s, 8 * s, 16 * s, 2 * s);
  };

  /** 蝙蝠彈 */
  /**
   * 人面獅身的沙柱（v1.29.1）：
   *   預告期 —— 地上一圈越轉越大的流沙漩渦（還不會痛）
   *   噴發期 —— 沙岩柱從地底衝上來，頂端噴沙
   */
  function sandPillar(ctx, s, t) {
    const cx = s.x + s.w / 2, gy = s.y + s.h;
    if (s.warn > 0) {
      const k = 1 - s.warn / 48;
      ctx.save();
      ctx.translate(cx, gy - 2);
      ctx.fillStyle = 'rgba(120, 80, 30, ' + (0.25 + k * 0.35).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(0, 0, 14 + k * 12, 4 + k * 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255, 220, 150, ' + (0.4 + k * 0.5).toFixed(3) + ')';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        const a0 = t * 0.25 + i * 2.1;
        ctx.beginPath(); ctx.ellipse(0, 0, 6 + i * 6 + k * 6, 2 + i * 1.6, 0, a0, a0 + 2.2); ctx.stroke();
      }
      // 快噴了：沙粒往上跳
      if (s.warn < 16) {
        ctx.fillStyle = '#e8c890';
        for (let i = 0; i < 5; i++) ctx.fillRect(-14 + i * 7, -4 - ((t * 3 + i * 9) % 12), 2, 2);
      }
      ctx.restore();
      return;
    }
    const up = s.life;            // 剩下的帧數：剛噴出時最高，快結束時往下縮
    const rise = Math.min(1, (34 - up) / 6 + 0.2), sink = Math.min(1, up / 8);
    const h = s.h * Math.min(rise, sink);
    ctx.save();
    ctx.fillStyle = '#c8964e';
    ctx.fillRect(s.x + 4, gy - h, s.w - 8, h);
    ctx.fillStyle = '#e0b878';
    ctx.fillRect(s.x + 4, gy - h, 8, h);
    ctx.fillStyle = 'rgba(90, 60, 20, 0.35)';
    for (let y = gy - h + 14; y < gy; y += 22) ctx.fillRect(s.x + 4, y, s.w - 8, 3);
    // 頂端噴沙
    ctx.fillStyle = 'rgba(240, 214, 160, 0.85)';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI - Math.PI;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 16, gy - h + Math.sin(a) * 8 - ((t + i * 5) % 8), 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /** 火鳥落地燒出的火海（不會移動，燒完就熄） */
  function firePatch(ctx, s, t) {
    const a = Math.min(1, s.life / 20);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(200, 60, 20, 0.5)';
    ctx.fillRect(s.x, s.y + s.h - 4, s.w, 4);
    for (let x = s.x + 4; x < s.x + s.w - 4; x += 12) {
      const fh = 10 + Math.sin(t * 0.4 + x * 0.3) * 5;
      ctx.fillStyle = '#ff7a2a';
      ctx.beginPath(); ctx.moveTo(x - 6, s.y + s.h); ctx.quadraticCurveTo(x, s.y + s.h - fh * 2, x + 6, s.y + s.h); ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.moveTo(x - 3, s.y + s.h); ctx.quadraticCurveTo(x, s.y + s.h - fh, x + 3, s.y + s.h); ctx.fill();
    }
    ctx.restore();
  }

  function batShot(ctx, s, t) {
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    const flap = Math.sin(t * 0.5 + s.x) * 4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#2a1a34';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-8, -6 - flap, -14, -2);
    ctx.quadraticCurveTo(-8, 0, -5, 3);
    ctx.lineTo(0, 1);
    ctx.lineTo(5, 3);
    ctx.quadraticCurveTo(8, 0, 14, -2);
    ctx.quadraticCurveTo(8, -6 - flap, 0, 0);
    ctx.fill();
    ctx.fillStyle = '#ff3b4a';
    ctx.fillRect(-2, -1, 1.5, 1.5); ctx.fillRect(1, -1, 1.5, 1.5);
    ctx.restore();
  }

  // ════════════════════════════════════════════════════════════
  // v1.30 北歐篇：丹麥、瑞典、挪威、芬蘭、冰島
  // ════════════════════════════════════════════════════════════

  // ── 地標（遠景，半透明）──

  /** 丹麥：新港運河邊一排彩色的山牆房子＋帆船桅杆 */
  function nyhavnLm(ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    const cols = ['rgba(230, 170, 60, 0.7)', 'rgba(200, 80, 60, 0.7)', 'rgba(70, 120, 170, 0.7)',
                  'rgba(240, 200, 120, 0.7)', 'rgba(110, 160, 110, 0.7)', 'rgba(220, 120, 90, 0.7)'];
    for (let k = 0; k < 6; k++) {
      const hx = (-180 + k * 60) * s, hh = (120 + (k % 3) * 18) * s;
      ctx.fillStyle = cols[k];
      ctx.fillRect(hx, -hh, 56 * s, hh);
      ctx.beginPath(); ctx.moveTo(hx, -hh); ctx.lineTo(hx + 28 * s, -hh - 26 * s); ctx.lineTo(hx + 56 * s, -hh); ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 240, 0.55)';
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) ctx.fillRect(hx + (10 + c * 24) * s, -hh + (14 + r * 32) * s, 10 * s, 14 * s);
    }
    // 運河邊的帆船桅杆
    ctx.strokeStyle = 'rgba(80, 60, 40, 0.6)'; ctx.lineWidth = 2 * s;
    [-150, -40, 90].forEach(function (mx) {
      ctx.beginPath(); ctx.moveTo(mx * s, 0); ctx.lineTo(mx * s, -170 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx * s, -160 * s); ctx.lineTo((mx + 30) * s, -20 * s); ctx.stroke();
    });
    ctx.restore();
  }

  /** 瑞典：冰旅館 —— 一整排用冰磚砌成的圓拱，入口掛著馴鹿皮 */
  function icehotelLm(ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(210, 232, 248, 0.75)';
    ctx.beginPath(); ctx.moveTo(-200 * s, 0); ctx.lineTo(-200 * s, -70 * s);
    ctx.quadraticCurveTo(0, -150 * s, 200 * s, -70 * s); ctx.lineTo(200 * s, 0); ctx.closePath(); ctx.fill();
    // 冰磚縫
    ctx.strokeStyle = 'rgba(140, 190, 225, 0.6)'; ctx.lineWidth = 1.5 * s;
    for (let r = 1; r < 4; r++) { ctx.beginPath(); ctx.moveTo(-200 * s, -r * 20 * s); ctx.lineTo(200 * s, -r * 20 * s); ctx.stroke(); }
    // 拱門入口
    ctx.fillStyle = 'rgba(90, 140, 190, 0.55)';
    ctx.beginPath(); ctx.moveTo(-34 * s, 0); ctx.lineTo(-34 * s, -60 * s); ctx.arc(0, -60 * s, 34 * s, Math.PI, 0); ctx.lineTo(34 * s, 0); ctx.fill();
    ctx.fillStyle = 'rgba(150, 110, 70, 0.6)';
    ctx.fillRect(-26 * s, -70 * s, 52 * s, 60 * s);
    // 兩旁的冰柱
    ctx.fillStyle = 'rgba(230, 245, 255, 0.7)';
    [-120, 120].forEach(function (px) { ctx.fillRect((px - 8) * s, -110 * s, 16 * s, 110 * s); });
    ctx.restore();
  }

  /** 挪威：峽灣兩岸的峭壁，七姊妹瀑布從崖頂分成七道落下 */
  function fjordLm(ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(70, 86, 100, 0.65)';
    ctx.beginPath(); ctx.moveTo(-220 * s, 0); ctx.lineTo(-210 * s, -230 * s); ctx.lineTo(-150 * s, -250 * s); ctx.lineTo(-60 * s, -236 * s);
    ctx.lineTo(-40 * s, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(40 * s, 0); ctx.lineTo(70 * s, -210 * s); ctx.lineTo(160 * s, -240 * s); ctx.lineTo(230 * s, -200 * s);
    ctx.lineTo(240 * s, 0); ctx.closePath(); ctx.fill();
    // 崖頂的雪
    ctx.fillStyle = 'rgba(240, 246, 250, 0.7)';
    ctx.beginPath(); ctx.moveTo(-210 * s, -230 * s); ctx.lineTo(-150 * s, -250 * s); ctx.lineTo(-60 * s, -236 * s); ctx.lineTo(-120 * s, -226 * s); ctx.closePath(); ctx.fill();
    // 七道瀑布
    ctx.strokeStyle = 'rgba(235, 248, 255, 0.75)'; ctx.lineWidth = 2.4 * s;
    for (let k = 0; k < 7; k++) {
      const wx = (-190 + k * 18) * s;
      ctx.beginPath(); ctx.moveTo(wx, -228 * s); ctx.quadraticCurveTo(wx + 4 * s, -120 * s, wx + 8 * s, 0); ctx.stroke();
    }
    // 峽灣的水
    ctx.fillStyle = 'rgba(40, 90, 130, 0.5)';
    ctx.fillRect(-60 * s, -12 * s, 120 * s, 12 * s);
    ctx.restore();
  }

  /** 芬蘭：聖誕老人村的木屋（尖屋頂積雪），地上一條白線就是北極圈 */
  function santaVillageLm(ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(120, 70, 40, 0.7)';
    ctx.fillRect(-110 * s, -90 * s, 220 * s, 90 * s);
    ctx.fillStyle = 'rgba(70, 40, 30, 0.75)';
    ctx.beginPath(); ctx.moveTo(-130 * s, -88 * s); ctx.lineTo(0, -170 * s); ctx.lineTo(130 * s, -88 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(245, 248, 255, 0.85)';
    ctx.beginPath(); ctx.moveTo(-130 * s, -88 * s); ctx.lineTo(0, -170 * s); ctx.lineTo(130 * s, -88 * s); ctx.lineTo(110 * s, -96 * s); ctx.lineTo(0, -156 * s); ctx.lineTo(-110 * s, -96 * s); ctx.closePath(); ctx.fill();
    // 窗戶的暖光
    ctx.fillStyle = 'rgba(255, 210, 120, 0.8)';
    [-70, 50].forEach(function (wx) { ctx.fillRect(wx * s, -64 * s, 26 * s, 22 * s); });
    ctx.fillStyle = 'rgba(60, 30, 20, 0.6)';
    ctx.fillRect(-16 * s, -50 * s, 32 * s, 50 * s);
    // 北極圈的白線＋路牌
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(-240 * s, -3 * s, 480 * s, 3 * s);
    ctx.fillStyle = 'rgba(90, 60, 40, 0.75)';
    ctx.fillRect(160 * s, -80 * s, 4 * s, 80 * s);
    ctx.fillRect(140 * s, -84 * s, 60 * s, 16 * s);
    ctx.restore();
  }

  /** 冰島：哈爾格林姆教堂 —— 像玄武岩柱一樣一階一階往上的白色高塔 */
  function hallgrimsLm(ctx, x, baseY, s) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = 'rgba(220, 220, 214, 0.7)';
    for (let k = 0; k < 6; k++) {
      const hh = (40 + k * 22) * s, ww = 16 * s;
      ctx.fillRect((-120 + k * 16) * s, -hh, ww, hh);
      ctx.fillRect((104 - k * 16) * s, -hh, ww, hh);
    }
    ctx.fillRect(-24 * s, -250 * s, 48 * s, 250 * s);
    ctx.beginPath(); ctx.moveTo(-24 * s, -250 * s); ctx.lineTo(0, -290 * s); ctx.lineTo(24 * s, -250 * s); ctx.fill();
    ctx.fillStyle = 'rgba(120, 120, 120, 0.5)';
    ctx.fillRect(-6 * s, -220 * s, 12 * s, 18 * s);
    ctx.restore();
  }

  landmarks.nyhavn = nyhavnLm;
  landmarks.icehotel = icehotelLm;
  landmarks.fjord = fjordLm;
  landmarks.santaVillage = santaVillageLm;
  landmarks.hallgrims = hallgrimsLm;

  // ── 遠景 ──
  // 丹麥：港口的水＋一排彩色房子
  skylines.DK = function (ctx, camX, gy, W, def, t) {
    seaBand(ctx, gy, W, gy - 40, 'rgba(70, 130, 180, 0.5)', t);
    tiled(ctx, camX, 0.2, 420, W, function (x0) {
      const cols = ['rgba(220, 160, 70, 0.5)', 'rgba(190, 80, 70, 0.5)', 'rgba(80, 120, 170, 0.5)', 'rgba(230, 200, 130, 0.5)'];
      for (let k = 0; k < 4; k++) {
        const hx = x0 + 60 + k * 44, hh = 70 + (k % 2) * 16;
        ctx.fillStyle = cols[k];
        ctx.fillRect(hx, gy - 40 - hh, 40, hh);
        ctx.beginPath(); ctx.moveTo(hx, gy - 40 - hh); ctx.lineTo(hx + 20, gy - 58 - hh); ctx.lineTo(hx + 40, gy - 40 - hh); ctx.fill();
      }
    });
  };
  // 瑞典：拉普蘭的雪山＋結冰的湖面
  skylines.SE = function (ctx, camX, gy, W, def, t) {
    ridge(ctx, camX, 0.04, gy - 40, W, 'rgba(150, 172, 200, 0.55)', 190, 14, 37);
    ridge(ctx, camX, 0.08, gy - 40, W, 'rgba(196, 212, 232, 0.8)', 150, 8, 31);
    ctx.fillStyle = 'rgba(226, 240, 250, 0.7)';
    ctx.fillRect(0, gy - 44, W, 44);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 8; i++) ctx.fillRect(((i * 173 - camX * 0.2) % (W + 80) + W + 80) % (W + 80) - 40, gy - 30 + (i % 3) * 8, 40, 2);
    ridge(ctx, camX, 0.3, gy, W, 'rgba(240, 246, 252, 0.8)', 40, 0, 7);
  };
  // 挪威：峽灣高聳的峭壁（崖頂有雪）＋水面
  skylines.NO = function (ctx, camX, gy, W, def, t) {
    ridge(ctx, camX, 0.06, gy - 30, W, 'rgba(90, 110, 130, 0.7)', 230, 24, 41);
    seaBand(ctx, gy, W, gy - 30, 'rgba(40, 90, 130, 0.6)', t);
    ridge(ctx, camX, 0.2, gy - 30, W, 'rgba(60, 80, 96, 0.6)', 90, 10, 9);
  };
  // 芬蘭：極夜的森林剪影＋雪丘
  skylines.FI = function (ctx, camX, gy, W) {
    ridge(ctx, camX, 0.08, gy - 20, W, 'rgba(60, 76, 120, 0.6)', 80, 0, 17);
    tiled(ctx, camX, 0.22, 300, W, function (x0) {
      ctx.fillStyle = 'rgba(16, 26, 44, 0.85)';
      for (let k = 0; k < 6; k++) {
        const px = x0 + k * 50 + (k % 2) * 10, ph = 70 + (k * 37) % 40;
        ctx.beginPath(); ctx.moveTo(px - 16, gy - 20); ctx.lineTo(px, gy - 20 - ph); ctx.lineTo(px + 16, gy - 20); ctx.fill();
      }
    });
    ridge(ctx, camX, 0.3, gy, W, 'rgba(200, 214, 236, 0.5)', 30, 0, 3);
  };
  // 冰島：冒煙的火山（火山口發紅光）＋冰河
  skylines.IS = function (ctx, camX, gy, W, def, t) {
    ridge(ctx, camX, 0.05, gy - 20, W, 'rgba(220, 230, 240, 0.45)', 90, 2, 23);
    tiled(ctx, camX, 0.12, 760, W, function (x0) {
      const vx = x0 + 380;
      ctx.fillStyle = 'rgba(40, 34, 38, 0.85)';
      ctx.beginPath(); ctx.moveTo(vx - 230, gy); ctx.lineTo(vx - 40, gy - 200); ctx.lineTo(vx + 40, gy - 200); ctx.lineTo(vx + 230, gy); ctx.fill();
      const glow = 0.55 + Math.sin(t * 0.05) * 0.2;
      ctx.fillStyle = 'rgba(255, 120, 40, ' + glow.toFixed(2) + ')';
      ctx.beginPath(); ctx.ellipse(vx, gy - 200, 40, 8, 0, 0, Math.PI * 2); ctx.fill();
      // 熔岩流
      ctx.strokeStyle = 'rgba(255, 110, 40, 0.6)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(vx - 10, gy - 196); ctx.quadraticCurveTo(vx - 40, gy - 120, vx - 70, gy - 40); ctx.stroke();
      // 煙
      ctx.fillStyle = 'rgba(90, 80, 90, 0.4)';
      for (let k = 0; k < 4; k++) {
        const ph = (t * 0.2 + k * 30) % 120;
        ctx.beginPath(); ctx.arc(vx + Math.sin(k + t * 0.01) * 20 + ph * 0.3, gy - 215 - ph, 18 + ph * 0.2, 0, Math.PI * 2); ctx.fill();
      }
    });
  };

  // ── 前景道具 ──
  /** 丹麥：小美人魚銅像，坐在岸邊的大石頭上 */
  props.mermaid = function (ctx, x, baseY) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = '#6a6a66';
    ctx.beginPath(); ctx.ellipse(0, -10, 30, 14, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(-30, -10, 60, 10);
    ctx.fillStyle = '#4f8a78';
    // 魚尾
    ctx.beginPath(); ctx.moveTo(-4, -22); ctx.quadraticCurveTo(18, -20, 22, -14); ctx.lineTo(30, -20); ctx.lineTo(28, -10); ctx.quadraticCurveTo(10, -14, -6, -14); ctx.fill();
    // 身體＋頭
    ctx.beginPath(); ctx.moveTo(-10, -20); ctx.quadraticCurveTo(-14, -40, -6, -50); ctx.lineTo(0, -48); ctx.quadraticCurveTo(-2, -36, 2, -20); ctx.fill();
    ctx.beginPath(); ctx.arc(-3, -54, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f7262';
    ctx.beginPath(); ctx.moveTo(-8, -58); ctx.quadraticCurveTo(-14, -48, -10, -38); ctx.lineTo(-6, -46); ctx.fill();
    ctx.restore();
  };
  /** 瑞典：紅色的達拉木馬 */
  props.dalaHorse = function (ctx, x, baseY) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = '#5a4030'; ctx.fillRect(-20, -6, 40, 6);
    ctx.fillStyle = '#c8202a';
    ctx.fillRect(-14, -26, 6, 20); ctx.fillRect(8, -26, 6, 20);
    U.roundRect(ctx, -16, -40, 32, 16, 5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, -40); ctx.lineTo(14, -58); ctx.lineTo(24, -54); ctx.lineTo(20, -46); ctx.lineTo(16, -36); ctx.fill();
    ctx.fillStyle = '#1e3a8a'; ctx.fillRect(10, -58, 8, 6);
    // 花紋
    ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(-4, -32, 5, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#2f8a5a'; ctx.fillRect(-12, -30, 4, 3);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-16, -26, 32, 2);
    ctx.restore();
  };
  /** 瑞典、挪威：維京人的盧恩石碑（刻著一圈紅色的蛇紋） */
  props.runestone = function (ctx, x, baseY) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = '#8a8a86';
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-18, -56); ctx.quadraticCurveTo(-4, -76, 14, -60); ctx.lineTo(16, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#b8402a'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-12, -52); ctx.quadraticCurveTo(-2, -66, 8, -54); ctx.lineTo(10, -4); ctx.stroke();
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.6)'; ctx.lineWidth = 1.2;
    for (let k = 0; k < 4; k++) {
      const y = -44 + k * 10;
      ctx.beginPath(); ctx.moveTo(-5, y); ctx.lineTo(-1, y - 5); ctx.lineTo(3, y); ctx.moveTo(-1, y - 5); ctx.lineTo(-1, y + 4); ctx.stroke();
    }
    ctx.restore();
  };
  /** 芬蘭、瑞典：湖邊的小木屋三溫暖，煙囪冒煙 */
  props.sauna = function (ctx, x, baseY, t) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = '#8a3020';
    ctx.fillRect(-40, -46, 80, 46);
    ctx.fillStyle = '#5a2418';
    for (let k = 0; k < 4; k++) ctx.fillRect(-40, -40 + k * 11, 80, 2);
    ctx.fillStyle = '#3a2a24';
    ctx.beginPath(); ctx.moveTo(-46, -44); ctx.lineTo(0, -70); ctx.lineTo(46, -44); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4f8ff';
    ctx.beginPath(); ctx.moveTo(-46, -44); ctx.lineTo(0, -70); ctx.lineTo(46, -44); ctx.lineTo(38, -48); ctx.lineTo(0, -64); ctx.lineTo(-38, -48); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a4a4a'; ctx.fillRect(20, -76, 8, 18);
    ctx.fillStyle = '#ffd98a'; ctx.fillRect(-28, -32, 14, 12);
    ctx.fillStyle = '#2a1a14'; ctx.fillRect(4, -30, 16, 30);
    ctx.fillStyle = 'rgba(230, 230, 236, 0.6)';
    for (let k = 0; k < 3; k++) {
      const ph = ((t || 0) * 0.4 + k * 14) % 42;
      ctx.beginPath(); ctx.arc(24 + ph * 0.3, -80 - ph, 4 + ph * 0.12, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };
  /** 芬蘭、瑞典：馴鹿（低頭吃苔蘚） */
  props.reindeer = function (ctx, x, baseY, t) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = '#7a6250';
    [-18, -10, 12, 20].forEach(function (lx) { ctx.fillRect(lx, -24, 4, 24); });
    ctx.beginPath(); ctx.ellipse(0, -30, 26, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath(); ctx.ellipse(18, -30, 9, 8, 0, 0, Math.PI * 2); ctx.fill();
    const nod = Math.sin((t || 0) * 0.04) * 3;
    ctx.fillStyle = '#7a6250';
    ctx.beginPath(); ctx.moveTo(20, -36); ctx.lineTo(34, -22 + nod); ctx.lineTo(40, -24 + nod); ctx.lineTo(30, -40); ctx.fill();
    ctx.strokeStyle = '#c8b090'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(30, -38); ctx.lineTo(26, -54); ctx.lineTo(20, -60); ctx.moveTo(27, -50); ctx.lineTo(34, -58); ctx.moveTo(26, -54); ctx.lineTo(30, -64); ctx.stroke();
    ctx.restore();
  };
  /** 冰島：長著青苔的黑色熔岩石 */
  props.lavaRock = function (ctx, x, baseY) {
    ctx.save(); ctx.translate(x, baseY);
    ctx.fillStyle = '#2a2628';
    ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(-22, -22); ctx.lineTo(-6, -34); ctx.lineTo(14, -28); ctx.lineTo(28, -10); ctx.lineTo(30, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a7a3a';
    ctx.beginPath(); ctx.ellipse(-8, -30, 12, 5, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(16, -24, 9, 4, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    [[-14, -14], [4, -18], [16, -8], [-2, -6]].forEach(function (h) { ctx.beginPath(); ctx.arc(h[0], h[1], 2, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  };

  /** 積雪的松樹（瑞典、芬蘭） */
  decos.snowPine = function (ctx, x, y, s) {
    ctx.fillStyle = '#4a3527';
    ctx.fillRect(x - 3 * s, y - 20 * s, 6 * s, 20 * s);
    for (let i = 0; i < 3; i++) {
      const yy = y - 20 * s - i * 18 * s;
      const half = (24 - i * 6) * s;
      ctx.fillStyle = '#2a5040';
      ctx.beginPath(); ctx.moveTo(x - half, yy); ctx.lineTo(x + half, yy); ctx.lineTo(x, yy - 26 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f4f8fc';
      ctx.beginPath(); ctx.moveTo(x - half * 0.55, yy - 12 * s); ctx.lineTo(x, yy - 26 * s); ctx.lineTo(x + half * 0.55, yy - 12 * s);
      ctx.lineTo(x + half * 0.2, yy - 15 * s); ctx.lineTo(x - half * 0.2, yy - 13 * s); ctx.closePath(); ctx.fill();
    }
  };

  // ── 裝備圖示 ──
  /** 樂高積木：紅色 2x4 積木，上面四顆凸點 */
  icons.lego = function (ctx, s) {
    ctx.fillStyle = '#d8262c';
    ctx.fillRect(-14 * s, -4 * s, 28 * s, 14 * s);
    ctx.fillStyle = '#a8161c';
    ctx.fillRect(-14 * s, 7 * s, 28 * s, 3 * s);
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = '#e84a4a';
      ctx.fillRect((-12 + k * 7) * s, -9 * s, 5 * s, 5 * s);
    }
  };
  /** 馴鹿皮靴 nutukas：鞋尖往上翹，有紅黃藍的鞋帶 */
  icons.nutukas = function (ctx, s) {
    ctx.fillStyle = '#9a7a5a';
    ctx.beginPath();
    ctx.moveTo(-8 * s, -12 * s); ctx.lineTo(4 * s, -12 * s); ctx.lineTo(4 * s, 0);
    ctx.quadraticCurveTo(12 * s, 2 * s, 16 * s, -6 * s); ctx.lineTo(14 * s, 6 * s); ctx.lineTo(-10 * s, 6 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4f0e8'; ctx.fillRect(-9 * s, -14 * s, 14 * s, 4 * s);
    ctx.fillStyle = '#c8202a'; ctx.fillRect(-8 * s, -6 * s, 12 * s, 2 * s);
    ctx.fillStyle = '#1f4aa0'; ctx.fillRect(-8 * s, -3 * s, 12 * s, 2 * s);
  };
  /** 維京太陽石：透明的菱形冰洲石，裡面透出太陽 */
  icons.sunstone = function (ctx, s) {
    ctx.fillStyle = 'rgba(210, 236, 250, 0.9)';
    ctx.beginPath(); ctx.moveTo(-12 * s, 4 * s); ctx.lineTo(-4 * s, -12 * s); ctx.lineTo(12 * s, -4 * s); ctx.lineTo(4 * s, 12 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7ab0d0'; ctx.lineWidth = 1.5 * s; ctx.stroke();
    ctx.fillStyle = '#ffc94a';
    ctx.beginPath(); ctx.arc(0, 0, 4 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(-6 * s, -6 * s, 3 * s, 3 * s);
  };
  /** 馴鹿雪橇鈴：金色鈴鐺＋紅緞帶 */
  icons.bell = function (ctx, s) {
    ctx.fillStyle = '#e8b830';
    ctx.beginPath(); ctx.moveTo(-10 * s, 8 * s); ctx.quadraticCurveTo(-10 * s, -10 * s, 0, -10 * s); ctx.quadraticCurveTo(10 * s, -10 * s, 10 * s, 8 * s); ctx.closePath(); ctx.fill();
    ctx.fillRect(-12 * s, 6 * s, 24 * s, 3 * s);
    ctx.fillStyle = '#8a6a18';
    ctx.beginPath(); ctx.arc(0, 11 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8202a';
    ctx.beginPath(); ctx.moveTo(-6 * s, -12 * s); ctx.lineTo(0, -8 * s); ctx.lineTo(6 * s, -12 * s); ctx.lineTo(4 * s, -16 * s); ctx.lineTo(0, -12 * s); ctx.lineTo(-4 * s, -16 * s); ctx.closePath(); ctx.fill();
  };
  /** 冰島毛衣 lopapeysa：米白色毛衣，領口一圈咖啡色花紋 */
  icons.lopapeysa = function (ctx, s) {
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath(); ctx.moveTo(-8 * s, -12 * s); ctx.lineTo(-16 * s, -6 * s); ctx.lineTo(-14 * s, 4 * s); ctx.lineTo(-9 * s, 2 * s);
    ctx.lineTo(-9 * s, 12 * s); ctx.lineTo(9 * s, 12 * s); ctx.lineTo(9 * s, 2 * s); ctx.lineTo(14 * s, 4 * s); ctx.lineTo(16 * s, -6 * s); ctx.lineTo(8 * s, -12 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6a4a30';
    ctx.beginPath(); ctx.ellipse(0, -9 * s, 10 * s, 5 * s, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#e8e0d0';
    for (let k = 0; k < 5; k++) ctx.fillRect((-8 + k * 4) * s, -8 * s, 2 * s, 2 * s);
    ctx.fillStyle = '#6a4a30'; ctx.fillRect(-9 * s, 9 * s, 18 * s, 2 * s);
  };

  // ── 各國敵人 ──
  COUNTRY_ENEMIES.DK = {
    // 丹麥：安徒生《堅定的錫兵》（只有一條腿）＋《醜小鴨》長大的天鵝
    walker: function (ctx, e, t) {
      const cx = e.x + e.w / 2, by = e.y + e.h;
      ctx.save(); squashed(ctx, e, cx, by);
      const hop = Math.abs(Math.sin(t * 0.3)) * 3;
      ctx.translate(0, -hop);
      ctx.fillStyle = '#2a2a33'; ctx.fillRect(cx - 2, by - 10, 5, 10);           // 一條腿
      ctx.fillStyle = '#1f3a8a'; ctx.fillRect(cx - 6, by - 12, 12, 4);
      ctx.fillStyle = '#c8202a'; U.roundRect(ctx, cx - 7, by - 26, 14, 15, 3); ctx.fill();
      ctx.fillStyle = '#f1f1f1'; ctx.fillRect(cx - 7, by - 21, 14, 2);
      ctx.fillStyle = '#f0c49a'; ctx.beginPath(); ctx.arc(cx, by - 30, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#16161c'; ctx.fillRect(cx - 5, by - 44, 10, 11);            // 高帽
      ctx.fillRect(cx + e.dir * 2 - 1, by - 31, 2, 2);
      ctx.strokeStyle = '#a0a6b0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx + e.dir * 8, by - 12); ctx.lineTo(cx + e.dir * 8, by - 38); ctx.stroke();
      ctx.restore();
    },
    flyer: function (ctx, e, t) {
      bird(ctx, e, t, { body: '#f8f8f4', wing: '#e8e8e2', head: '#f8f8f4', beak: '#f08a30', beakLen: 6, span: 30, flapSpeed: 0.22 });
    }
  };
  COUNTRY_ENEMIES.SE = {
    // 瑞典：駝鹿寶寶（牠們真的會在路上亂晃）＋雪鴞
    walker: function (ctx, e, t) {
      quadruped(ctx, e, t, {
        body: '#6a4a30', leg: '#4a3220', head: 7, neck: 14,
        detail: function (ctx, cx, by, hx, hy, d) {
          ctx.strokeStyle = '#d8c090'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(hx - d * 2, hy - 5); ctx.lineTo(hx - d * 8, hy - 12); ctx.lineTo(hx - d * 4, hy - 14);
          ctx.moveTo(hx - d * 8, hy - 12); ctx.lineTo(hx - d * 12, hy - 10); ctx.stroke();
          ctx.fillStyle = '#5a3a24';
          ctx.beginPath(); ctx.ellipse(hx + d * 6, hy + 2, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
        }
      });
    },
    flyer: function (ctx, e, t) {
      bird(ctx, e, t, {
        body: '#f4f4f0', wing: '#e0e0da', head: '#f4f4f0', beak: '#3a3a3a', beakLen: 2, flapSpeed: 0.26,
        detail: function (ctx, cx, cy, d) {
          ctx.fillStyle = '#4a4a4a';
          for (let k = 0; k < 4; k++) ctx.fillRect(cx - 6 + k * 4, cy - 2 + (k % 2) * 3, 2, 2);
          ctx.fillStyle = '#f1c40f'; ctx.fillRect(cx + d * 11 - 1, cy - 7, 3, 3);
        }
      });
    }
  };
  COUNTRY_ENEMIES.NO = {
    // 挪威：山裡的小山妖 troll（大鼻子、長尾巴）＋海鸚
    walker: function (ctx, e, t) {
      const cx = e.x + e.w / 2, by = e.y + e.h;
      ctx.save(); squashed(ctx, e, cx, by);
      const s = Math.sin(t * 0.3) * 2;
      ctx.fillStyle = '#6a7a5a';
      ctx.fillRect(cx - 8 + s, by - 7, 5, 7); ctx.fillRect(cx + 3 - s, by - 7, 5, 7);
      ctx.beginPath(); ctx.ellipse(cx, by - 16, 12, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6a7a5a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - e.dir * 10, by - 12); ctx.quadraticCurveTo(cx - e.dir * 20, by - 10, cx - e.dir * 18, by - 22); ctx.stroke();
      ctx.fillStyle = '#4a3a2a';
      ctx.beginPath(); ctx.arc(cx - e.dir * 18, by - 23, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a9a6a';
      ctx.beginPath(); ctx.ellipse(cx + e.dir * 10, by - 18, 6, 4, 0, 0, Math.PI * 2); ctx.fill();   // 大鼻子
      ctx.fillStyle = '#5a4a3a';
      for (let k = 0; k < 3; k++) ctx.fillRect(cx - 6 + k * 4, by - 30, 2, 5);                        // 亂髮
      ctx.fillStyle = '#16161c'; ctx.fillRect(cx + e.dir * 4 - 1, by - 22, 2, 2);
      ctx.restore();
    },
    flyer: function (ctx, e, t) {
      bird(ctx, e, t, {
        body: '#1e1e24', wing: '#1e1e24', head: '#1e1e24', beak: '#f05a20', beakLen: 6, flapSpeed: 0.5, flapAmp: 5, span: 22,
        detail: function (ctx, cx, cy, d) {
          ctx.fillStyle = '#f4f4f0';
          ctx.beginPath(); ctx.arc(cx + d * 10, cy - 3, 4, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(cx, cy + 3, 6, 3, 0, 0, Math.PI); ctx.fill();
        }
      });
    }
  };
  COUNTRY_ENEMIES.FI = {
    // 芬蘭：雪兔（冬天整隻變白）＋西伯利亞松鴉（灰身體、橘尾巴）
    walker: function (ctx, e, t) {
      quadruped(ctx, e, t, {
        body: '#f2f4f8', leg: '#dfe4ea', head: 6, bw: 12, bh: 8,
        detail: function (ctx, cx, by, hx, hy, d) {
          ctx.fillStyle = '#f2f4f8';
          ctx.beginPath(); ctx.ellipse(hx - d * 2, hy - 10, 2.5, 7, -d * 0.2, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(hx + d * 2, hy - 10, 2.5, 7, d * 0.2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#2a2a30'; ctx.fillRect(hx - d * 2 - 1, hy - 17, 2, 3);
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx - d * 13, by - 14, 4, 0, Math.PI * 2); ctx.fill();
        }
      });
    },
    flyer: function (ctx, e, t) {
      bird(ctx, e, t, {
        body: '#8a8a90', wing: '#7a7a80', head: '#5a5a60', beak: '#2a2a2a', beakLen: 3, flapSpeed: 0.34,
        detail: function (ctx, cx, cy, d) {
          ctx.fillStyle = '#e07a30';
          ctx.beginPath(); ctx.moveTo(cx - d * 8, cy); ctx.lineTo(cx - d * 18, cy - 3); ctx.lineTo(cx - d * 18, cy + 4); ctx.closePath(); ctx.fill();
        }
      });
    }
  };

  // ── 冰島最終魔王：火巨人蘇爾特 ──
  /**
   * 黑色玄武岩的巨人，身上的裂縫透出熔岩光，頭髮和鬍子是火焰。
   * 揮劍蓄力時：劍舉過頭（高掃）或壓低貼地（低掃），前方同一個高度會亮起一條淡淡的火光帶 —— 劍光會從那裡掃過去。
   */
  function bossSurtr(ctx, b, t) {
    const stunned = b.phase === 'recover';
    const k = b.swingK || 0;
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h);
    ctx.scale(b.dir < 0 ? -1 : 1, 1);
    // 預告的火光帶（畫在最底下）
    if (b.swing && k > 0) {
      const a = (0.12 + 0.28 * k).toFixed(2);
      const g = ctx.createLinearGradient(30, 0, 300, 0);
      g.addColorStop(0, 'rgba(255, 140, 40, ' + a + ')');
      g.addColorStop(1, 'rgba(255, 140, 40, 0)');
      ctx.fillStyle = g;
      // 畫在「從地面算」的高度：低掃 0~28、高掃 62~150（跟 entities.js makeSlash 一致；b.y+b.h 就是地面）
      if (b.swing === 'high') ctx.fillRect(30, -150, 270, 88);
      else ctx.fillRect(30, -28, 270, 28);
    }
    const H = b.h;
    // 腿
    ctx.fillStyle = '#2a2428';
    const step = stunned ? 0 : Math.sin(t * 0.1) * 3;
    ctx.fillRect(-24, -26, 16, 26 + step * 0.3);
    ctx.fillRect(6, -26, 16, 26 - step * 0.3);
    // 身體（癱倒時往前趴、比較矮）
    ctx.save();
    if (stunned) ctx.rotate(0.18);
    ctx.fillStyle = '#332c30';
    U.roundRect(ctx, -32, -H + 18, 64, H - 40, 12); ctx.fill();
    // 熔岩裂縫
    const pulse = 0.6 + Math.sin(t * 0.15) * 0.3;
    ctx.strokeStyle = 'rgba(255, 120, 30, ' + pulse.toFixed(2) + ')'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-18, -H + 30); ctx.lineTo(-8, -H + 46); ctx.lineTo(-14, -H + 60);
    ctx.moveTo(10, -H + 28); ctx.lineTo(4, -H + 44); ctx.lineTo(14, -H + 58); ctx.lineTo(8, -32);
    ctx.stroke();
    // 頭＋火焰頭髮與鬍子
    const hy = -H + 10;
    ctx.fillStyle = '#3a3236';
    ctx.beginPath(); ctx.arc(4, hy, 14, 0, Math.PI * 2); ctx.fill();
    for (let f = 0; f < 5; f++) {
      const fx = -10 + f * 7, fl = 10 + Math.sin(t * 0.3 + f) * 4;
      ctx.fillStyle = f % 2 ? '#ffb030' : '#ff6a20';
      ctx.beginPath(); ctx.moveTo(fx - 4, hy - 8); ctx.lineTo(fx, hy - 8 - fl); ctx.lineTo(fx + 4, hy - 8); ctx.fill();
    }
    ctx.fillStyle = '#ff7a24';
    ctx.beginPath(); ctx.moveTo(-6, hy + 6); ctx.lineTo(4, hy + 22 + Math.sin(t * 0.25) * 3); ctx.lineTo(16, hy + 6); ctx.fill();
    ctx.fillStyle = stunned ? '#ffd166' : '#ffe08a';
    ctx.fillRect(4, hy - 4, 5, 3); ctx.fillRect(12, hy - 4, 4, 3);
    ctx.restore();
    // 火焰劍：肩膀 (18, -H + 34) 為軸。平常斜舉；高掃蓄力舉到頭上往後；低掃蓄力壓到前方地面
    let ang = -0.7;
    if (b.swing === 'high') ang = -0.7 - 1.7 * k;
    else if (b.swing === 'low') ang = -0.7 + 1.5 * k;      // 劍尖壓到貼地（再低就插進地裡了）
    if (stunned) ang = 0.35;                                // 癱倒：劍垂在身前
    ctx.save();
    ctx.translate(18, -H + 34);
    ctx.rotate(ang);
    ctx.fillStyle = '#4a3a30'; ctx.fillRect(-3, -4, 14, 8);           // 手臂
    ctx.fillStyle = '#8a7040'; ctx.fillRect(10, -7, 4, 14);            // 護手
    const fl = 0.75 + Math.sin(t * 0.4) * 0.25;
    const g2 = ctx.createLinearGradient(14, 0, 78, 0);
    g2.addColorStop(0, '#fff2b0'); g2.addColorStop(0.5, '#ffb030'); g2.addColorStop(1, '#ff4a20');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.moveTo(14, -4); ctx.lineTo(74, -2); ctx.lineTo(82, 0); ctx.lineTo(74, 2); ctx.lineTo(14, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255, 120, 30, ' + (0.35 * fl).toFixed(2) + ')';
    ctx.beginPath(); ctx.ellipse(48, 0, 40, 9 + (b.swing ? 4 * k : 0), 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();
  }
  bossKinds.surtr = bossSurtr;

  /** 火焰劍光：月牙形的火焰，朝飛行方向；高掃是一大片、低掃貼著地面 */
  function flameSlash(ctx, s, t) {
    if (s.dark) { darkSlash(ctx, s, t); return; }
    const dir = s.vx < 0 ? -1 : 1;
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(dir, 1);
    const hh = s.h / 2 + 4;
    // 拖在後面的火星
    ctx.fillStyle = 'rgba(255, 170, 60, 0.5)';
    for (let k = 0; k < 4; k++) {
      const ph = (t * 0.5 + k * 9) % 30;
      ctx.beginPath(); ctx.arc(-14 - ph * 1.4, (k - 1.5) * hh * 0.45, 3 - ph * 0.08, 0, Math.PI * 2); ctx.fill();
    }
    // 外圈光暈（整個會痛的範圍都蓋到，一眼看得出這道劍光有多高）
    ctx.fillStyle = 'rgba(255, 110, 30, 0.28)';
    ctx.beginPath(); ctx.ellipse(2, 0, s.w / 2 + 10, hh + 2, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createLinearGradient(-20, 0, 24, 0);
    g.addColorStop(0, 'rgba(255, 80, 20, 0.25)');
    g.addColorStop(0.55, 'rgba(255, 150, 40, 0.95)');
    g.addColorStop(1, 'rgba(255, 244, 180, 1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-10, -hh);
    ctx.quadraticCurveTo(40, 0, -10, hh);
    ctx.quadraticCurveTo(10, 0, -10, -hh);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 252, 230, 0.95)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-4, -hh + 4); ctx.quadraticCurveTo(32, 0, -4, hh - 4); ctx.stroke();
    ctx.restore();
  }

  /** v1.31.2 暗夜騎士的劍氣：紫黑色的月牙，後面拖著黑霧（高低跟火焰劍光一樣，看高度決定跳不跳） */
  function darkSlash(ctx, s, t) {
    const dir = s.vx < 0 ? -1 : 1;
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(dir, 1);
    const hh = s.h / 2 + 4;
    ctx.fillStyle = 'rgba(60, 20, 90, 0.45)';
    for (let k = 0; k < 4; k++) {
      const ph = (t * 0.5 + k * 9) % 30;
      ctx.beginPath(); ctx.arc(-14 - ph * 1.5, (k - 1.5) * hh * 0.45, 4 - ph * 0.1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(150, 70, 255, 0.28)';
    ctx.beginPath(); ctx.ellipse(2, 0, s.w / 2 + 10, hh + 2, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createLinearGradient(-20, 0, 24, 0);
    g.addColorStop(0, 'rgba(40, 10, 70, 0.3)');
    g.addColorStop(0.55, 'rgba(140, 60, 240, 0.95)');
    g.addColorStop(1, 'rgba(235, 215, 255, 1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-10, -hh);
    ctx.quadraticCurveTo(40, 0, -10, hh);
    ctx.quadraticCurveTo(10, 0, -10, -hh);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(250, 240, 255, 0.95)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-4, -hh + 4); ctx.quadraticCurveTo(32, 0, -4, hh - 4); ctx.stroke();
    ctx.restore();
  }

  /** 熔岩彈：發紅光的石塊＋煙，地上有一圈越來越明顯的落點 */
  function lavaBomb(ctx, s, t) {
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    const gy = (typeof Levels !== 'undefined' ? Levels.GROUND_Y : 400);
    const near = U.clamp(1 - (gy - cy) / 360, 0.15, 1);
    ctx.fillStyle = 'rgba(255, 90, 40, ' + (0.25 + 0.45 * near).toFixed(2) + ')';
    ctx.beginPath(); ctx.ellipse(cx, gy - 2, 10 + 10 * near, 3 + 2 * near, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(90, 80, 90, 0.45)';
    ctx.beginPath(); ctx.arc(cx + Math.sin(t * 0.2) * 2, cy - 14, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2a24';
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff7a24';
    ctx.beginPath(); ctx.arc(cx - 2, cy - 1, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath(); ctx.arc(cx - 3, cy - 2, 2, 0, Math.PI * 2); ctx.fill();
  }

  return {
    skylines: skylines,
    playerShot: playerShot,
    countryEnemies: COUNTRY_ENEMIES,
    batShot: batShot,
    landmarks: landmarks,
    props: props,
    shaftBackdrop: shaftBackdrop,
    shaftThemes: shaftThemes,
    pendulum: pendulum,
    chimeOverlay: chimeOverlay,
    shaftFloor: shaftFloor,
    shaftWall: shaftWall,
    shaftCeiling: shaftCeiling,
    relic: function () { return relic.apply(null, arguments); },
    seaAlly: function () { return seaAlly.apply(null, arguments); },
    trident: function () { return tridentShot.apply(null, arguments); },
    shaftFlood: shaftFlood,
    trainCar: trainCar,
    trainTrack: trainTrack,
    cableGondola: cableGondola,
    valleyFloor: valleyFloor,
    propWidth: propWidth,
    propLayer: propLayer,
    decos: decos,
    icons: icons,
    icon: icon,
    equipIcon: equipIcon,
    equipPickup: equipPickup,
    player: player,
    walker: walker,
    flyer: flyer,
    enemy: enemy,
    enemyKinds: enemyKinds,
    boss: boss,
    bossBar: bossBar,
    bossKinds: bossKinds,
    shot: shot,
    secretRoom: secretRoom,
    coin: coin,
    flagFace: flagFace,
    flagDirs: flagDirs,
    goalFlag: goalFlag
  };
})();
