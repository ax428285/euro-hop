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
  const SPOT = { lon: 8.0, lat: 62.3 };    // 峽灣岸邊往內一點（老漁夫在西邊的海上；太近兩個名字會黏在一起）
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

  /** 每帧（大地圖）：記足跡、把狗放到後面那個點 */
  function update(ship) {
    if (!adopted()) { dog.ready = false; return; }
    const last = trail[trail.length - 1];
    if (!dog.ready || !last || Math.hypot(ship.x - last.x, ship.y - last.y) > 40) { snap(ship.x, ship.y); return; }
    if (Math.hypot(ship.x - last.x, ship.y - last.y) >= STEP) {
      trail.push({ x: ship.x, y: ship.y });
      if (trail.length > 80) trail.shift();
    }
    // 從最新往回量 FOLLOW 的距離
    let need = FOLLOW, tx = trail[0].x, ty = trail[0].y;
    let px = ship.x, py = ship.y;
    for (let i = trail.length - 1; i >= 0; i--) {
      const d = Math.hypot(px - trail[i].x, py - trail[i].y);
      if (d >= need) {
        const k = need / d;
        tx = px + (trail[i].x - px) * k; ty = py + (trail[i].y - py) * k;
        need = 0;
        break;
      }
      need -= d; px = trail[i].x; py = trail[i].y;
    }
    if (need > 0) { tx = px; ty = py; }
    const mv = Math.hypot(tx - dog.x, ty - dog.y);
    if (Math.abs(tx - dog.x) > 0.05) dog.facing = tx > dog.x ? 1 : -1;
    // 慢慢靠過去（不要一帧跳到位，停下來時會小跑幾步才停）
    dog.x += (tx - dog.x) * 0.35; dog.y += (ty - dog.y) * 0.35;
    dog.step += Math.min(mv, 2) * 0.5;
    dog.inWater = typeof Voyage !== 'undefined' && !Voyage.isLand(dog.x, dog.y);
  }

  // ── 繪製（大地圖座標，WorldMap 的 view 裡）──

  /** 黃金獵犬：坐著（sit）或走路；s = 縮放 */
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
    ctx.restore();
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
    drawDog(ctx, x, y, t, { sit: true, facing: -1 });
  }

  /** 收養之後：跟在主角後面（WorldMap 畫完、主角畫之前呼叫，狗在主角下面一層） */
  function drawFollower(ctx, t) {
    if (!adopted() || !dog.ready) return;
    drawDog(ctx, dog.x, dog.y, t, { facing: dog.facing, swim: dog.inWater });
  }

  return {
    SPOT: SPOT,
    adopted: adopted,
    spotPin: spotPin,
    update: update,
    snap: snap,
    pos: function () { return { x: dog.x, y: dog.y, ready: dog.ready, inWater: dog.inWater }; },
    drawWaiting: drawWaiting,
    drawFollower: drawFollower
  };
})();
