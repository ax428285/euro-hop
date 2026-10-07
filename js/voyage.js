'use strict';

/**
 * 大地圖移動 —— 海上開船、陸上走路（v1.7 重寫）。
 *
 * ── 為什麼重寫 ──────────────────────────────────────────────
 * 舊版只能開船，內陸國（瑞士、奧地利、捷克、匈牙利⋯⋯）船到不了，
 * 只好用 A* 在陸地上「挖運河」把水路硬接過去，海峽太窄也要另外挖。
 * 結果地圖上到處是穿過國土的人工水道，而且港口被迫放在海岸邊，
 * 常常離國家很遠（荷蘭港口一度在布列塔尼外海）。
 *
 * 現在的規則很單純：
 *   - 角色在海上就是一艘船（快、有慣性），在陸地上就下船步行（慢一點）
 *   - 船靠岸自動下船，走到海邊自動上船 —— 不用按鍵切換
 *   - 每一國的入口就是該國的城市圖釘，走到旁邊按 Enter 進關卡
 *   - 地圖上所有地方都去得了，不需要挖任何水道
 *
 * ── 對外 API ──────────────────────────────────────────────
 *   Voyage.reset(levelIndex)   把角色放到某國城市
 *   Voyage.placeShip(x, y)     把角色放回指定位置（打完遭遇戰回來）
 *   Voyage.update(input)       每帧更新，回傳事件（'dock' 進關卡、'embark' 上船、'land' 上岸）
 *   Voyage.draw(ctx, t, opts)
 *   Voyage.nearbyLevel()       目前可進入的關卡 index（沒有回 -1）
 *   Voyage.shipPos()           角色位置（世界座標）
 *   Voyage.mode()              'sea' / 'land'
 *   Voyage.isLand(x, y)        這一點是陸地嗎（真實國界多邊形）
 *   Voyage.isNavigable(x, y)   開闊海面（離岸夠遠，海上怪物生成用）
 *   Voyage.ports()             各國入口（= 城市圖釘位置）
 */
const Voyage = (function () {

  const CELL = 4;
  const W = WorldMap.WORLD_W, H = WorldMap.WORLD_H;
  const MAP_TOP = WorldMap.MAP_TOP;
  const MAP_BOTTOM = WorldMap.MAP_BOTTOM;

  // 船：有慣性，比較像在水上
  const SEA = { accel: 0.22, friction: 0.94, max: 2.8 };
  /*
   * 步行：比船慢一點、幾乎沒有慣性（放開就停）。
   *
   * ⚠️ 實際速度是「終端速度」accel × friction / (1 − friction)，不是 max。
   * 舊值 accel 0.45 只走得到 1.16（max 1.7 根本碰不到），約船速的四成，玩家反應太慢。
   * 現在 0.95 → 終端 2.44，被 max 2.4 截住：約船速的 85%，放開一樣立刻停。
   */
  const LAND = { accel: 0.95, friction: 0.72, max: 2.4 };

  const DOCK_RANGE = 26;          // 離城市圖釘多近可以進關卡
  const OPEN_SEA = 3;             // 「開闊海面」：離岸至少幾格（怪物生成用）

  let gridW = 0, gridH = 0;
  let land = null;                // Uint8Array，1 = 陸地
  let clear = null;               // Int16Array，海面格離最近陸地幾格
  let ports = [];
  const ship = { x: 0, y: 0, vx: 0, vy: 0, heading: 0, wake: [], mode: 'sea', step: 0, facing: 1 };
  let nearIdx = -1;
  let built = false;

  function inPoly(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  function allLandShapes() {
    const out = [];
    [EuropeGeo, typeof EuropeBackdrop !== 'undefined' ? EuropeBackdrop : {}].forEach(function (src) {
      Object.keys(src).forEach(function (k) { src[k].shapes.forEach(function (sh) { out.push(sh); }); });
    });
    return out;
  }

  /** 烘陸地遮罩 + 每格海面離岸距離 */
  function bake() {
    gridW = Math.ceil(W / CELL);
    gridH = Math.ceil(H / CELL);
    land = new Uint8Array(gridW * gridH);
    const boxes = allLandShapes().map(function (sh) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      sh.forEach(function (p) {
        x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
        y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      });
      return { x0: x0, y0: y0, x1: x1, y1: y1, pts: sh };
    });
    for (let gy = 0; gy < gridH; gy++) {
      const py = gy * CELL + CELL / 2;
      for (let gx = 0; gx < gridW; gx++) {
        const px = gx * CELL + CELL / 2;
        for (let i = 0; i < boxes.length; i++) {
          const b = boxes[i];
          if (px < b.x0 || px > b.x1 || py < b.y0 || py > b.y1) continue;
          if (inPoly(px, py, b.pts)) { land[gy * gridW + gx] = 1; break; }
        }
      }
    }
    // 離岸距離（BFS 從所有陸地格往外長）
    clear = new Int16Array(gridW * gridH).fill(-1);
    const q = new Int32Array(gridW * gridH);
    let head = 0, tail = 0;
    for (let i = 0; i < land.length; i++) if (land[i]) { clear[i] = 0; q[tail++] = i; }
    while (head < tail) {
      const i = q[head++];
      const gx = i % gridW, gy = (i - gx) / gridW;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        const nx = gx + d[0], ny = gy + d[1];
        if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) return;
        const ni = ny * gridW + nx;
        if (clear[ni] !== -1) return;
        clear[ni] = clear[i] + 1;
        q[tail++] = ni;
      });
    }
  }

  function cellAt(x, y) {
    const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
    if (gx < 0 || gy < 0 || gx >= gridW || gy >= gridH) return -1;
    return gy * gridW + gx;
  }

  function isLand(x, y) {
    const i = cellAt(x, y);
    return i >= 0 && land[i] === 1;
  }

  function isNavigable(x, y) {
    const i = cellAt(x, y);
    if (i < 0 || y < MAP_TOP || y > MAP_BOTTOM) return false;
    return land[i] === 0 && clear[i] >= OPEN_SEA;
  }

  /** 各國入口 = 城市圖釘（底座正下方一點，角色站上去剛好在圖釘腳邊） */
  function buildPorts() {
    ports = WorldMap.nations.map(function (n) {
      return { idx: n.idx, id: n.id, x: Math.round(n.pin[0]), y: Math.round(n.pin[1] + 4), cx: n.pin[0], cy: n.pin[1] };
    });
  }

  function build() {
    bake();
    buildPorts();
    built = true;
  }

  function clampToWorld() {
    ship.x = U.clamp(ship.x, 6, W - 6);
    ship.y = U.clamp(ship.y, MAP_TOP + 4, MAP_BOTTOM - 4);
  }

  function reset(levelIndex) {
    if (!built) build();
    const p = ports.filter(function (q) { return q.idx === levelIndex; })[0] || ports[0];
    ship.x = p.x; ship.y = p.y;
    ship.vx = 0; ship.vy = 0;
    ship.wake = [];
    ship.mode = isLand(ship.x, ship.y) ? 'land' : 'sea';
    nearIdx = p.idx;
  }

  function placeShip(x, y) {
    if (!built) build();
    ship.x = x; ship.y = y;
    ship.vx = 0; ship.vy = 0;
    ship.wake = [];
    clampToWorld();
    ship.mode = isLand(ship.x, ship.y) ? 'land' : 'sea';
  }

  function update(input) {
    if (!built) build();
    const events = [];

    let ax = 0, ay = 0;
    if (input.isDown('left')) ax -= 1;
    if (input.isDown('right')) ax += 1;
    if (input.isDown('up')) ay -= 1;
    if (input.isDown('down')) ay += 1;
    if (ax && ay) { ax *= 0.707; ay *= 0.707; }

    const phys = ship.mode === 'sea' ? SEA : LAND;
    ship.vx = (ship.vx + ax * phys.accel) * phys.friction;
    ship.vy = (ship.vy + ay * phys.accel) * phys.friction;
    const sp = Math.hypot(ship.vx, ship.vy);
    if (sp > phys.max) { ship.vx = ship.vx / sp * phys.max; ship.vy = ship.vy / sp * phys.max; }
    if (sp > 0.15) ship.heading = Math.atan2(ship.vy, ship.vx);
    if (Math.abs(ship.vx) > 0.1) ship.facing = ship.vx > 0 ? 1 : -1;

    ship.x += ship.vx;
    ship.y += ship.vy;
    clampToWorld();

    // 換地形：上岸／上船
    const nowMode = isLand(ship.x, ship.y) ? 'land' : 'sea';
    if (nowMode !== ship.mode) {
      ship.mode = nowMode;
      events.push(nowMode === 'land' ? 'land' : 'embark');
      // 船速比步行快很多：上岸時把速度壓到步行上限，不然會「滑」進內陸
      if (nowMode === 'land') { ship.vx *= 0.5; ship.vy *= 0.5; }
    }
    if (ship.mode === 'land' && sp > 0.3) ship.step += sp * 0.25;

    if (ship.mode === 'sea' && sp > 0.3) {
      ship.wake.push({ x: ship.x, y: ship.y, life: 34 });
      if (ship.wake.length > 40) ship.wake.shift();
    }
    for (let i = ship.wake.length - 1; i >= 0; i--) {
      if (--ship.wake[i].life <= 0) ship.wake.splice(i, 1);
    }

    nearIdx = -1;
    let bestD = DOCK_RANGE;
    ports.forEach(function (p) {
      const d = Math.hypot(ship.x - p.x, ship.y - p.y);
      if (d < bestD) { bestD = d; nearIdx = p.idx; }
    });

    // 進關卡只吃 Enter（方向鍵「上」同時對應 jump，吃 jump 的話往北走會誤觸）
    if (nearIdx >= 0 && input.once('confirm')) events.push('dock');
    return events;
  }

  // ── 繪製 ───────────────────────────────────────────────

  function drawShip(ctx, t) {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.heading);
    ctx.fillStyle = '#8a5a3c';
    ctx.beginPath();
    ctx.moveTo(11, 0); ctx.lineTo(-7, -5.5); ctx.lineTo(-9, 0); ctx.lineTo(-7, 5.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6b4530';
    ctx.fillRect(-7, -1.2, 16, 2.4);
    ctx.strokeStyle = '#e8e2d2';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -13); ctx.stroke();
    const bil = Math.sin(t * 0.08) * 1.4;
    ctx.fillStyle = '#f4efe2';
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.quadraticCurveTo(9 + bil, -8, 1, -2.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ded6c2';
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(-7 - bil, -8, -1, -3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /** 步行中的旅人：背包 + 手杖，走路時雙腳交替 */
  function drawWalker(ctx, t) {
    const x = ship.x, y = ship.y;
    const sw = Math.sin(ship.step) * 2.5;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(ship.facing, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 1, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a2230'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(-2 + sw, 0); ctx.moveTo(0, -5); ctx.lineTo(2 - sw, 0); ctx.stroke();
    ctx.fillStyle = '#2f54a0';                                // 條紋衫（跟關卡裡的主角同一件）
    ctx.fillRect(-3, -12, 6, 7);
    ctx.fillStyle = '#f4efe2'; ctx.fillRect(-3, -10, 6, 1.5);
    ctx.fillStyle = '#8a5a30'; ctx.fillRect(-6, -12, 3, 6);  // 背包
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath(); ctx.arc(0, -15, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a07040'; ctx.lineWidth = 1.2;        // 手杖
    ctx.beginPath(); ctx.moveTo(4, -10); ctx.lineTo(6, 0); ctx.stroke();
    ctx.restore();
  }

  function draw(ctx, t, opts) {
    WorldMap.draw(ctx, W, H, {
      unlocked: opts.unlocked,
      clearedFn: opts.clearedFn,
      cursor: nearIdx,
      t: t,
      east: opts.east,
      regionOpen: opts.regionOpen       // v1.21：各篇章（東歐、非洲）的解鎖狀態
      // 不再隱藏固定航線：各國之間的虛線就是建議旅程
    });

    // 尾流（只有開船時有）
    ctx.save();
    ship.wake.forEach(function (w) {
      const a = w.life / 34;
      ctx.fillStyle = 'rgba(226, 240, 255, ' + (a * 0.5).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(w.x, w.y, 1 + (1 - a) * 3.5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();

    // 靠近的城市：腳下一圈虛線（入口範圍）
    if (nearIdx >= 0) {
      const p = ports.filter(function (q) { return q.idx === nearIdx; })[0];
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(p.x, p.y, DOCK_RANGE, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    if (opts.beforeShip) opts.beforeShip();
    if (ship.mode === 'sea') drawShip(ctx, t); else drawWalker(ctx, t);
  }

  return {
    build: build,
    reset: reset,
    placeShip: placeShip,
    update: update,
    draw: draw,
    nearbyLevel: function () { return nearIdx; },
    shipPos: function () { return { x: ship.x, y: ship.y }; },
    mode: function () { return ship.mode; },
    isLand: function (x, y) { if (!built) build(); return isLand(x, y); },
    isNavigable: function (x, y) { if (!built) build(); return isNavigable(x, y); },
    ports: function () { if (!built) build(); return ports; },
    DOCK_RANGE: DOCK_RANGE,
    SEA: SEA,
    LAND: LAND,
    CELL: CELL
  };
})();
