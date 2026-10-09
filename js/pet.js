'use strict';

/**
 * 寵物：峽灣的黃金獵犬（v1.29 玩家：老漁夫附近放一隻黃金獵犬，身上要有臘腸才會跟你走，
 * 變成寵物後牠會在大地圖上跟在你背後；港口的商品其中一個換成臘腸）。
 *
 *   還沒收養：挪威峽灣岸邊（老漁夫東邊）坐著一隻黃金獵犬，尾巴搖啊搖。
 *             靠近按 Enter —— 船艙裡有臘腸就餵牠一根（扣一箱），牠就跟你走；
 *             沒有臘腸只會聞一聞，提示去熱那亞買（trade.js 的 sausage）。
 *   收養之後：Save.pet() === 'dog'。大地圖上沿著你走過的路跟在後面：
 *             上岸走路時牠用跑的，開船時牠在船尾後面狗爬式游泳。
 *
 * 跟隨用「足跡」：主角每移動一小段就記一個點，狗站在大約 FOLLOW 距離之前的那個點上，
 * 所以轉彎時牠會照原路繞過來，不會穿過陸地或直接貼在身上。
 * 船被瞬間移走（回港口、被漩渦甩出去）時足跡清空，狗直接出現在身邊。
 */
const Pet = (function () {
  // v1.30 玩家：黃金獵犬從挪威峽灣搬到蘇格蘭高地（北歐被雷神的結界罩住，原本的位置過不去了）
  const SPOT = { lon: -4.6, lat: 57.3 };
  const STEP = 1.5;                         // 足跡點的間距
  const FOLLOW = 20;                        // 狗跟在後面多遠
  const trail = [];                         // 最新的在最後面
  const dog = { x: 0, y: 0, facing: 1, step: 0, inWater: false, ready: false };

  function adopted() { return typeof Save !== 'undefined' && Save.pet() === 'dog'; }

  /** 大地圖上那個點（還沒收養時狗坐的地方） */
  function spotPin() {
    const p = EuropeWorld.project(SPOT.lon, SPOT.lat);
    return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
  }

  function snap(x, y) {
    trail.length = 0;
    trail.push({ x: x, y: y });
    dog.x = x - 10; dog.y = y + 2; dog.ready = true;
  }

  /*
   * v1.31.2 玩家：海底城全破，人魚會跟你走（跟狗狗一樣跟在後面）。
   * 用同一條足跡：狗在 FOLLOW 的地方、人魚再後面一點（沒有狗就是她跟在 FOLLOW）。
   * 在水裡她甩著尾巴游，上岸時坐在一顆透明的大水泡裡飄著跟過來。
   */
  const mer = { x: 0, y: 0, facing: 1, ready: false, inWater: true };
  function mermaidOn() { return typeof Quests !== 'undefined' && !!Quests.mermaidJoined && Quests.mermaidJoined(); }

  /** 從足跡最新的點往回量 dist 遠的那一點 */
  function pointBack(ship, dist) {
    let need = dist, tx = trail[0].x, ty = trail[0].y;
    let px = ship.x, py = ship.y;
    for (let i = trail.length - 1; i >= 0; i--) {
      const d = Math.hypot(px - trail[i].x, py - trail[i].y);
      if (d >= need) {
        const k = need / d;
        return { x: px + (trail[i].x - px) * k, y: py + (trail[i].y - py) * k };
      }
      need -= d; px = trail[i].x; py = trail[i].y;
    }
    return { x: px, y: py };
  }
  /** 跟隨者往目標點靠過去（不要一帧跳到位，停下來時會小跑幾步才停） */
  function chase(f, tp) {
    const mv = Math.hypot(tp.x - f.x, tp.y - f.y);
    if (Math.abs(tp.x - f.x) > 0.05) f.facing = tp.x > f.x ? 1 : -1;
    f.x += (tp.x - f.x) * 0.35; f.y += (tp.y - f.y) * 0.35;
    f.step = (f.step || 0) + Math.min(mv, 2) * 0.5;
    f.inWater = typeof Voyage !== 'undefined' && !Voyage.isLand(f.x, f.y);
  }

  /** 每帧（大地圖）：記足跡、把狗（和人魚）放到後面那個點 */
  function update(ship) {
    const hasDog = adopted(), hasMer = mermaidOn();
    if (!hasDog) dog.ready = false;
    if (!hasMer) mer.ready = false;
    if (!hasDog && !hasMer) return;
    const last = trail[trail.length - 1];
    if ((hasDog && !dog.ready) || (hasMer && !mer.ready) || !last || Math.hypot(ship.x - last.x, ship.y - last.y) > 40) {
      snap(ship.x, ship.y);
      if (hasMer) { mer.x = ship.x - (hasDog ? 22 : 12); mer.y = ship.y + 4; mer.ready = true; }
      return;
    }
    if (Math.hypot(ship.x - last.x, ship.y - last.y) >= STEP) {
      trail.push({ x: ship.x, y: ship.y });
      if (trail.length > 80) trail.shift();
    }
    if (hasDog) {
      chase(dog, pointBack(ship, FOLLOW));
      dog.step = dog.step || 0;
    }
    if (hasMer) chase(mer, pointBack(ship, hasDog ? FOLLOW * 2 + 6 : FOLLOW));
  }

  /** 人魚 Thalassa（大地圖上的跟隨者）：在水裡游、上岸坐在水泡裡 */
  function drawMermaid(ctx, x, y, t, facing, inWater) {
    ctx.save();
    ctx.translate(x, y);
    const bob = Math.sin(t * 0.08) * 1.5;
    if (!inWater) {
      // 上岸：一顆透明的大水泡，她坐在裡面飄
      ctx.translate(0, -8 + bob);
      ctx.fillStyle = 'rgba(170, 230, 255, 0.28)';
      ctx.beginPath(); ctx.arc(0, -6, 13, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(220, 250, 255, 0.85)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, -6, 13, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.beginPath(); ctx.ellipse(-5, -12, 3, 1.6, -0.6, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.translate(0, bob);
      ctx.strokeStyle = 'rgba(226, 240, 255, 0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 1, 9, 3, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.scale(facing || 1, 1);
    const wag = Math.sin(t * 0.18) * 3;
    // 尾巴（往後甩）
    ctx.fillStyle = '#2ab0a0';
    ctx.beginPath(); ctx.moveTo(2, -6); ctx.quadraticCurveTo(-4, -2, -9, -3 + wag); ctx.lineTo(-13, -7 + wag); ctx.lineTo(-12, 0 + wag); ctx.quadraticCurveTo(-4, 2, 2, -2); ctx.fill();
    // 上半身（露肩＋貝殼上衣）、頭、往後飄的一大把長髮、紅唇（v1.31.2 辣一點）
    ctx.fillStyle = '#26c4b4';
    ctx.beginPath(); ctx.moveTo(1, -16); ctx.quadraticCurveTo(-8, -14 + wag * 0.6, -10, -6 + wag); ctx.lineTo(-5, -7); ctx.quadraticCurveTo(-2, -10, 1, -10); ctx.fill();
    ctx.fillStyle = '#f2d2bc'; ctx.fillRect(0, -10, 5, 5);
    ctx.fillStyle = '#e86aa8'; ctx.beginPath(); ctx.arc(1.6, -7.6, 1.6, 0, Math.PI * 2); ctx.arc(4.2, -7.6, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2d2bc'; ctx.beginPath(); ctx.arc(3, -13, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#26c4b4';
    ctx.beginPath(); ctx.arc(2.5, -14, 3.8, Math.PI * 0.9, Math.PI * 2.05); ctx.fill();
    ctx.fillStyle = '#16161c'; ctx.fillRect(4.6, -13.6, 1, 1);
    ctx.fillStyle = '#d8203a'; ctx.fillRect(5, -11.4, 1.6, 0.9);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    const sp = 0.8 + Math.abs(Math.sin(t * 0.15)) * 1.6;
    ctx.fillRect(8 - sp, -18, sp * 2, 0.8); ctx.fillRect(7.6, -18.4 - sp, 0.8, sp * 2);
    ctx.restore();
  }

  // ── 繪製（大地圖座標，WorldMap 的 view 裡）──

  // ── v1.31 千里達寵物用品店的配件（Shop.dogAccs()；全部一起戴）。座標是狗自己的座標（頭在 (4, hy)）──
  function accHas(o, k) { return !!(o.accs && o.accs.indexOf(k) >= 0); }
  function drawCape(ctx, hy, t) {
    const w = Math.sin(t * 0.2) * 1.2;
    ctx.fillStyle = '#c8303a';
    ctx.beginPath(); ctx.moveTo(2.6, hy + 1.8); ctx.lineTo(0, hy + 1.2);
    ctx.quadraticCurveTo(-5, -6 + w, -8, -3.5 + w); ctx.lineTo(-3.5, -2.2); ctx.closePath(); ctx.fill();
  }
  function drawHeadAccs(ctx, o, hx, hy) {
    if (accHas(o, 'bandana')) {
      ctx.fillStyle = '#d8303a';
      ctx.beginPath(); ctx.moveTo(hx - 2.6, hy + 2); ctx.lineTo(hx + 1.8, hy + 2.8); ctx.lineTo(hx - 0.8, hy + 5.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(hx - 0.9, hy + 3, 0.7, 0.7);
    }
    if (accHas(o, 'shades')) {
      ctx.fillStyle = '#16161c';
      ctx.fillRect(hx + 0.4, hy - 2, 3.4, 1.8);
      ctx.fillRect(hx - 1.6, hy - 1.6, 2, 0.6);
      ctx.fillStyle = 'rgba(160, 220, 255, 0.7)'; ctx.fillRect(hx + 2.4, hy - 1.8, 0.8, 0.6);
    }
    if (accHas(o, 'sombrero')) {
      ctx.fillStyle = '#e8c870';
      ctx.beginPath(); ctx.ellipse(hx, hy - 2.8, 5.4, 1.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(hx, hy - 4.2, 2.4, 2, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#c8303a'; ctx.fillRect(hx - 2.4, hy - 3.6, 4.8, 0.8);
    }
  }

  /** 黃金獵犬：坐著（sit）或走路；s = 縮放；o.accs = 戴著的配件 */
  function drawDog(ctx, x, y, t, o) {
    o = o || {};
    const fur = '#e0a64a', dark = '#b97a2a';
    ctx.save();
    ctx.translate(x, y);
    ctx.scale((o.facing || 1) * 1.5, 1.5);   // 地圖上的人物大約 18px 高，狗要看得出是狗
    if (o.swim) {
      // 狗爬式：只露出頭和耳朵，旁邊一圈水紋
      ctx.strokeStyle = 'rgba(226,240,255,0.7)'; ctx.lineWidth = 1;
      const r = 5 + Math.sin(t * 0.15) * 0.8;
      ctx.beginPath(); ctx.ellipse(0, 0, r + 2, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.ellipse(1, -2, 3.6, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(-1.6, -1.6, 1.4, 2.4, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.ellipse(4, -1.6, 2, 1.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(5.4, -2.2, 1.2, 1.2);
      ctx.fillRect(2, -3.4, 0.9, 0.9);
      drawHeadAccs(ctx, { accs: (o.accs || []).filter(function (k) { return k !== 'bandana'; }) }, 1.4, -2);
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 1, 6.5, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    // 尾巴（一直搖）
    const wag = Math.sin(t * (o.sit ? 0.35 : 0.25)) * 0.6;
    ctx.strokeStyle = fur; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-5, o.sit ? -2 : -5);
    ctx.quadraticCurveTo(-8, -7 + wag * 2, -9 + wag, -9 + wag * 2); ctx.stroke();
    if (o.sit) {
      // 坐著：身體斜斜的，前腳撐地
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.ellipse(-1.5, -3.5, 4.5, 3.5, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(1, -4, 1.8, 4.5);
      ctx.fillRect(-4.5, -1.5, 4, 1.8);
    } else {
      const sw = Math.sin(dog.step) * 1.6;
      ctx.strokeStyle = dark; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-3.5, -3); ctx.lineTo(-3.5 + sw, 0.5);
      ctx.moveTo(3, -3); ctx.lineTo(3 - sw, 0.5);
      ctx.stroke();
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.ellipse(0, -4.5, 5.5, 2.8, 0, 0, Math.PI * 2); ctx.fill();
    }
    // 頭
    const hy = o.sit ? -9 : -7;
    if (accHas(o, 'cape')) drawCape(ctx, hy, t);
    ctx.fillStyle = fur;
    ctx.beginPath(); ctx.arc(4, hy, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, hy + 1, 2.2, 1.5, 0, 0, Math.PI * 2); ctx.fill();   // 嘴
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(2.6, hy + 0.6, 1.3, 2.4, 0.25, 0, Math.PI * 2); ctx.fill(); // 耳朵
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(8.4, hy + 0.2, 1.2, 1.1);   // 鼻子
    ctx.fillRect(5, hy - 1.2, 0.9, 0.9);     // 眼睛
    if (o.sit) {
      // 吐舌頭
      ctx.fillStyle = '#e86a7a';
      ctx.fillRect(6.4, hy + 2.2, 1.2, 1.6 + Math.max(0, Math.sin(t * 0.2)) * 0.8);
    }
    drawHeadAccs(ctx, o, 4, hy);
    ctx.restore();
  }

  // 寵物用品店的商品圖示：坐著的狗只戴那一樣（Sprites.icon 的格式：原點在中心、s = 縮放）
  if (typeof Sprites !== 'undefined') {
    ['bandana', 'shades', 'sombrero', 'cape'].forEach(function (k) {
      Sprites.icons['dog_' + k] = function (ctx, s) {
        ctx.save(); ctx.scale(s * 1.7, s * 1.7);
        drawDog(ctx, -3, 8, 0, { sit: true, facing: 1, accs: [k] });
        ctx.restore();
      };
    });
  }

  /** 還沒收養：坐在岸邊等人（near = 船靠近，頭上冒個愛心） */
  function drawWaiting(ctx, x, y, t, near) {
    if (near) {
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y - 8, 17 + Math.sin(t * 0.1) * 2, 0, Math.PI * 2); ctx.stroke();
      const hb = Math.sin(t * 0.12) * 2 - 6;
      ctx.fillStyle = '#ff8aa0';
      ctx.beginPath();
      ctx.arc(x + 2, y - 21 + hb, 2, 0, Math.PI * 2); ctx.arc(x + 5.6, y - 21 + hb, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + 0.2, y - 20.4 + hb); ctx.lineTo(x + 3.8, y - 16.5 + hb); ctx.lineTo(x + 7.4, y - 20.4 + hb); ctx.fill();
    }
    drawDog(ctx, x, y, t, { sit: true, facing: -1, accs: typeof Shop !== 'undefined' ? Shop.dogAccs() : [] });
  }

  /** 收養之後：跟在主角後面（WorldMap 畫完、主角畫之前呼叫，狗在主角下面一層） */
  function drawFollower(ctx, t) {
    if (mermaidOn() && mer.ready) drawMermaid(ctx, mer.x, mer.y, t, mer.facing, mer.inWater);
    if (!adopted() || !dog.ready) return;
    drawDog(ctx, dog.x, dog.y, t, { facing: dog.facing, swim: dog.inWater, accs: typeof Shop !== 'undefined' ? Shop.dogAccs() : [] });
  }

  return {
    SPOT: SPOT,
    adopted: adopted,
    mermaidOn: mermaidOn,
    mermaid: mer,
    drawMermaid: drawMermaid,
    spotPin: spotPin,
    update: update,
    snap: snap,
    pos: function () { return { x: dog.x, y: dog.y, ready: dog.ready, inWater: dog.inWater }; },
    drawWaiting: drawWaiting,
    drawFollower: drawFollower
  };
})();
