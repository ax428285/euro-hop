'use strict';

/**
 * 歐洲大地圖（主畫面）。
 *
 * 國界用的是真實地理資料（Natural Earth 1:110m，公共領域），
 * 由 tools/build-europe-map.js 投影成「世界座標」，產出 js/europe-geo.js。
 * 這裡只負責畫，不含任何手捏的座標。
 *
 * ── 世界座標與相機（v1.4）──────────────────────────────────
 * 舊版整張地圖塞在一個畫面裡，國家很小、兩側一堆海。
 * 現在世界是 960 x EuropeWorld.h（比畫面高），畫面只顯示
 * 標題條與資訊卡之間的那一段（VIEW_TOP 起、高 VIEW_H），相機跟著船上下捲。
 *
 *   世界座標 → 畫面座標：sx = wx - cam.x，sy = wy - cam.y + VIEW_TOP
 *   所有國界、圖釘、標籤、港口、怪物都存世界座標；
 *   要畫的時候包在 beginView() / endView() 之間就好。
 *
 * 版面約束（tests/map-check.js 會驗證）：
 *   標籤與圖釘都要在世界範圍 [MAP_TOP, MAP_BOTTOM] 內。
 */
const WorldMap = (function () {

  const TOP_BAR = 40;        // 頂部標題條高度
  const BOTTOM_PANEL = 88;   // 底部資訊卡高度
  const VIEW_TOP = TOP_BAR;
  const VIEW_H = 480 - TOP_BAR - BOTTOM_PANEL;   // = 352，畫面上看得到的地圖高度
  const WORLD_W = EuropeWorld.w;
  const WORLD_H = EuropeWorld.h;
  // 世界座標裡的可用範圍（貼著世界邊緣一點點不放東西）
  const MAP_TOP = 6;
  const MAP_BOTTOM = WORLD_H - 6;

  // 相機（世界座標，畫面左上角對應的點）
  const cam = { x: 0, y: 0 };

  /** 相機對準世界座標 (x, y)；snap = 直接跳過去（進地圖時），否則緩追 */
  function follow(x, y, snap) {
    const tx = U.clamp(x - 480, 0, Math.max(0, WORLD_W - 960));
    const ty = U.clamp(y - VIEW_H / 2, 0, Math.max(0, WORLD_H - VIEW_H));
    if (snap) { cam.x = tx; cam.y = ty; return; }
    cam.x += (tx - cam.x) * 0.1;
    cam.y += (ty - cam.y) * 0.1;
  }

  /** 開始畫世界：裁在地圖可視帶內，並套上相機位移 */
  function beginView(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, VIEW_TOP, 960, VIEW_H);
    ctx.clip();
    ctx.translate(-Math.round(cam.x), VIEW_TOP - Math.round(cam.y));
  }

  function endView(ctx) { ctx.restore(); }

  /** 畫面座標（滑鼠點擊）→ 世界座標 */
  function toWorld(sx, sy) {
    return { x: sx + Math.round(cam.x), y: sy - VIEW_TOP + Math.round(cam.y) };
  }

  /** 這個世界座標點目前在畫面上看得到嗎 */
  function onScreen(x, y, pad) {
    const p = pad || 0;
    return x >= cam.x - p && x <= cam.x + 960 + p &&
           y >= cam.y - p && y <= cam.y + VIEW_H + p;
  }

  const SEA = '#1d3a5c';
  const SEA_DEEP = '#15293f';
  const LAND_LOCKED = '#444f68';
  const LAND_OPEN = '#5f8052';
  const LAND_DONE = '#47795d';

  /*
   * 背景國（不可進入的鄰國）的填色。
   *
   * ⚠️ 原本是 '#2b3850'，畫出來跟海（#1d3a5c）的 RGB 距離只有 19 ——
   * 肉眼幾乎分不出來。在航海模式下這是個嚴重問題：愛爾蘭、比利時、
   * 丹麥、克羅埃西亞這些國家看起來像海，但船撞上去就停住，
   * 玩家的感受就是「到處都是隱形牆、船開不動」。
   *
   * 改成明顯偏暖的灰褐色（跟藍色系的海拉開色相），
   * 並把邊界線加亮，讓「哪裡是陸地」一眼可辨。
   */
  const BACKDROP_FILL = '#4a4535';
  const BACKDROP_EDGE = 'rgba(214, 204, 170, 0.55)';

  /**
   * 標籤擺放：國名直接印在自己的國土上。
   *
   * 舊版把標籤拉到國外再用虛線指回圖釘，十個國家擠在一起時
   * 字和線交錯成一團，很亂。改成「字就在那塊地上」，不需要引線。
   *
   * 位置用搜尋決定，不手調：在國土 bounding box 內取樣候選點，
   * 評分 = 字框落在國土內的比例（最重要）− 壓到任何旗子/圖釘（重罰）
   *        − 壓到別國標籤（重罰）− 離國土中心的距離（輕罰）。
   * 小國（瑞士、荷蘭）放不下完整字框時，會取「最多在國內」的位置。
   */
  const LABEL_SIZE = 13;          // 平常字級；選取時 +1
  const LABEL_SIZE_SEL = 14;

  /**
   * 圖釘微調。
   *
   * 預設圖釘放在國家輪廓的 bounding box 中心，但那只是幾何中心，
   * 有兩個問題：
   *   1. 形狀彎曲的國家（希臘、義大利）中心可能落在海上或鄰國
   *   2. 相鄰的小國（捷克/奧地利）中心會靠得太近，點擊選不準
   * 這裡針對實際量出來的衝突做偏移，map-check 會驗證結果。
   */
  /*
   * v1.4 地圖放大約 1.6 倍後，小國也放得下圖釘＋國名，
   * 舊版為了擠空間做的偏移（捷克往北、奧地利往東、瑞士往東）都不需要了。
   * 保留這張表，之後真的有衝突再加。
   */
  const PIN_NUDGE = {};

  /**
   * 關卡國家。idx 對應 Levels.list 的索引，幾何資料來自 EuropeGeo。
   * 這個陣列在模組載入時建好（Levels 與 EuropeGeo 都已就緒）。
   */
  const nations = [];

  function inPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  function inShapes(x, y, shapes) {
    for (let i = 0; i < shapes.length; i++) if (inPoly(x, y, shapes[i])) return true;
    return false;
  }

  /** 標籤字框（置中對齊）。中文字寬約等於字級，用估算就夠準 */
  function labelBoxAt(name, x, y, size) {
    const w = name.length * size + 6, h = size * 1.2;
    return { x: x - w / 2, y: y - h / 2, w: w, h: h };
  }

  /**
   * 圖釘 + 旗子實際佔用的範圍（對照 drawPin）：
   *   旗杆 x-1..x+1、旗面 x+1..x+19、y-29..y-11（含選取時 ±3 擺動）、底座半徑 5。
   * 再留 2px 餘裕。map-check 用同一個函式驗證。
   */
  function pinBox(pin) {
    return { x: pin[0] - 7, y: pin[1] - 31, w: 29, h: 38 };
  }

  function boxOverlap(a, b) {
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return ox > 0 && oy > 0 ? ox * oy : 0;
  }

  /** 字框有多少比例落在國土內（取樣 5×3 個點） */
  function insideFrac(b, shapes) {
    let hit = 0, n = 0;
    for (let i = 0; i <= 4; i++) {
      for (let j = 0; j <= 2; j++) {
        n++;
        if (inShapes(b.x + b.w * i / 4, b.y + b.h * j / 2, shapes)) hit++;
      }
    }
    return hit / n;
  }

  /** 國土面積（所有 shape 的鞋帶公式加總），排擺放順序用 */
  function areaOf(n) {
    return n.shapes.reduce(function (s, pts) {
      let a = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
      }
      return s + Math.abs(a / 2);
    }, 0);
  }

  // 已擺好的所有標籤字框（關卡國 + 東歐國共用，避免互相重疊）
  const placed = [];

  function placeLabels() {
    placed.length = 0;
    /*
     * 小國先擺：瑞士、荷蘭這種小塊國土能放字的位置本來就少，
     * 讓大國（法國、德國）去遷就它們，而不是反過來被擠到沒地方。
     */
    const order = nations.slice().sort(function (a, b) { return areaOf(a) - areaOf(b); });
    order.forEach(function (n) {
      placeOne(n, Levels.list[n.idx].country, n.pin);
    });
  }

  /** 在國土上找一個放得下國名的位置，寫進 n.label */
  function placeOne(n, name, fallbackPin) {
    if (n) {
      // 只在主要國土（點最多的那塊）上找，離島放不下字
      const main = n.shapes.reduce(function (a, b) { return b.length > a.length ? b : a; });
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      main.forEach(function (p) {
        x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
        y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      });
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;

      /*
       * 硬條件：不壓任何旗子/圖釘、不壓已擺好的標籤、字的中心在自己國內。
       * 軟條件（評分）：字框在國內的比例越高越好，離國土中心越近越好。
       * 硬條件全滿足的位置找不到時（理論上不該發生），才退回只看評分。
       */
      let best = null, bestScore = -Infinity, soft = null, softScore = -Infinity;
      for (let y = y0; y <= y1; y += 2) {
        for (let x = x0; x <= x1; x += 2) {
          if (!inPoly(x, y, main)) continue;
          // 用選取時的字級評估（最大的狀況）
          const b = labelBoxAt(name, x, y, LABEL_SIZE_SEL);
          if (b.y < MAP_TOP + 2 || b.y + b.h > MAP_BOTTOM - 2) continue;
          let clash = 0;
          nations.forEach(function (o) { clash += boxOverlap(b, pinBox(o.pin)); });
          placed.forEach(function (pb) { clash += boxOverlap(b, pb); });
          const base = insideFrac(b, n.shapes) * 100 - Math.hypot(x - mx, y - my) * 0.15;
          if (clash === 0 && base > bestScore) { bestScore = base; best = [x, y]; }
          if (base - clash * 3 > softScore) { softScore = base - clash * 3; soft = [x, y]; }
        }
      }
      if (!best) best = soft;
      if (!best) best = [fallbackPin[0], fallbackPin[1] + 16];
      n.label = best;
      n.labelAlign = 'center';
      placed.push(labelBoxAt(name, best[0], best[1], LABEL_SIZE_SEL));
    }
  }

  /**
   * 東歐篇（尚未開發關卡內容，只先標在地圖上）。
   *
   * 用的是背景國的真實國界（EuropeBackdrop），所以不必新增地理資料。
   * EXP 累積到 Encounter.EAST_EXP 之前顯示為「鎖住」，之後顯示為「已解鎖・開發中」。
   */
  // v1.4：波蘭、匈牙利、羅馬尼亞已經有關卡（在 Levels.list 裡，region: 'east'），
  // 這裡只剩還沒開發關卡的國家。
  // v1.7：東歐 8 國全部有關卡了，這張「只標名字」的清單清空（功能保留，之後加新區域可用）
  const EAST_DEFS = [
  ];
  const EAST_DEFS_OLD = [
    { id: 'SK', name: '斯洛伐克' },
    { id: 'BG', name: '保加利亞' },
    { id: 'RS', name: '塞爾維亞' },
    { id: 'HR', name: '克羅埃西亞' },
    { id: 'UA', name: '烏克蘭' }
  ];
  const east = [];

  function buildEast() {
    east.length = 0;
    if (typeof EuropeBackdrop === 'undefined') return;
    EAST_DEFS.forEach(function (d) {
      const geo = EuropeBackdrop[d.id];
      if (!geo) return;
      const n = { id: d.id, name: d.name, shapes: geo.shapes, label: [0, 0] };
      // 克羅埃西亞形狀細長、塞爾維亞較小：一樣用搜尋，放不下時取最多在國內的位置
      let cx = 0, cy = 0, k = 0;
      geo.shapes[0].forEach(function (p) { cx += p[0]; cy += p[1]; k++; });
      placeOne(n, d.name, [cx / k, cy / k]);
      east.push(n);
    });
  }

  /**
   * 東歐國的國土顏色：鎖住 = 紫灰，解鎖 = 亮紫（跟關卡國的綠色區分「還沒有關卡」）。
   * ⚠️ 鎖住的紫灰不能太暗：原本 #3f3a52 跟海（#1d3a5c）色距只有 35，
   * 看起來像海但船撞得上去（voyage-check 的「陸地要看得出來」會擋）。
   */
  function drawEast(ctx, unlocked, t) {
    east.forEach(function (n) {
      n.shapes.forEach(function (sh) {
        poly(ctx, sh);
        ctx.fillStyle = unlocked ? '#6b5a8e' : '#524870';
        ctx.fill();
        ctx.strokeStyle = unlocked ? 'rgba(220, 200, 255, 0.6)' : 'rgba(170, 160, 200, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    });
  }

  /** 小鎖頭（不用 emoji：Segoe UI 沒有，會被換字型、基線跑掉） */
  function lockIcon(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = '#b9b0d6';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x, y - 2, 2.6, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#b9b0d6';
    ctx.fillRect(x - 3.6, y - 2, 7.2, 5.5);
    ctx.restore();
  }

  function drawEastLabels(ctx, unlocked) {
    east.forEach(function (n) {
      U.text(ctx, n.name, n.label[0], n.label[1], {
        size: 11,
        color: unlocked ? '#efe6ff' : '#9d95b8',
        strokeWidth: 3,
        strokeColor: 'rgba(20, 16, 34, 0.75)'
      });
      if (!unlocked) lockIcon(ctx, n.label[0], n.label[1] + 12);
    });
  }

  /** 點到哪個東歐國（沒有回 null） */
  function hitTestEast(mx, my) {
    for (let i = 0; i < east.length; i++) {
      if (inShapes(mx, my, east[i].shapes)) return east[i];
    }
    return null;
  }

  /** 多邊形內「離邊界最遠」的點（圖釘用；跟 tools/build-europe-map.js 同一個算法） */
  function innerPoint(pts) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, sx = 0, sy = 0;
    pts.forEach(function (p) {
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
      y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      sx += p[0]; sy += p[1];
    });
    const c = [sx / pts.length, sy / pts.length];
    let best = c, bestScore = -Infinity;
    for (let gx = 0; gx < 24; gx++) {
      for (let gy = 0; gy < 24; gy++) {
        const x = x0 + (x1 - x0) * (gx + 0.5) / 24, y = y0 + (y1 - y0) * (gy + 0.5) / 24;
        if (!inPoly(x, y, pts)) continue;
        let d = Infinity;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          const dx = b[0] - a[0], dy = b[1] - a[1];
          const k = U.clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
          d = Math.min(d, Math.hypot(x - (a[0] + k * dx), y - (a[1] + k * dy)));
        }
        const score = d - Math.hypot(x - c[0], y - c[1]) * 0.15;
        if (score > bestScore) { bestScore = score; best = [x, y]; }
      }
    }
    return [Math.round(best[0] * 10) / 10, Math.round(best[1] * 10) / 10];
  }

  function build() {
    nations.length = 0;
    Levels.list.forEach(function (lv, i) {
      // 東歐篇的國家國界在 EuropeBackdrop（產生器把它們當背景國），圖釘點在這裡算
      const geo = EuropeGeo[lv.id] || EuropeBackdrop[lv.id];
      if (!geo) return;   // 沒有地理資料的國家就不畫（不該發生，map-check 會抓）
      const center = geo.center || innerPoint(geo.shapes[0]);
      const nudge = PIN_NUDGE[lv.id] || [0, 0];
      const cx = center[0] + nudge[0], cy = center[1] + nudge[1];
      nations.push({
        idx: i,
        id: lv.id,
        shapes: geo.shapes,
        pin: [cx, cy],
        label: [cx, cy],
        labelAlign: 'center'
      });
    });
    // 圖釘全部定位後才擺標籤（要避開所有國家的旗子）
    placeLabels();
    // 東歐國最後擺：要避開關卡國已經擺好的字
    buildEast();
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  function drawSea(ctx, W, H, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, SEA);
    g.addColorStop(1, SEA_DEEP);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += 48) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(160, 200, 240, 0.10)';
    ctx.lineWidth = 2;
    for (let i = 0; i < Math.ceil(H / 60); i++) {
      const yy = 60 + i * 60;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 10) {
        const y2 = yy + Math.sin((x + t * 0.6 + i * 40) * 0.016) * 4;
        if (x === 0) ctx.moveTo(x, y2); else ctx.lineTo(x, y2);
      }
      ctx.stroke();
    }
  }

  function drawBackdrop(ctx) {
    Object.keys(EuropeBackdrop).forEach(function (k) {
      EuropeBackdrop[k].shapes.forEach(function (sh) {
        poly(ctx, sh);
        ctx.fillStyle = BACKDROP_FILL;
        ctx.fill();
        ctx.strokeStyle = BACKDROP_EDGE;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    });
  }

  /** 連接各國的旅程航線（依關卡順序） */
  function drawRoute(ctx, clearedFn, t) {
    ctx.save();
    for (let i = 0; i < nations.length - 1; i++) {
      const a = nations[i].pin, b = nations[i + 1].pin;
      // 兩端都通關過，航線才點亮
      const done = clearedFn(nations[i].idx) && clearedFn(nations[i + 1].idx);
      ctx.strokeStyle = done ? 'rgba(255, 209, 102, 0.9)' : 'rgba(255,255,255,0.22)';
      ctx.lineWidth = done ? 3 : 2;
      ctx.setLineDash([7, 7]);
      ctx.lineDashOffset = done ? -t * 0.5 : 0;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - 14;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo(mx, my, b[0], b[1]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawPin(ctx, n, lv, st, selected, t) {
    const x = n.pin[0], y = n.pin[1];
    const bob = selected ? Math.sin(t * 0.08) * 3 : 0;

    ctx.save();

    if (selected) {
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, 15 + Math.sin(t * 0.1) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 旗杆
    ctx.fillStyle = '#d8dee8';
    ctx.fillRect(x - 1, y - 26 + bob, 2, 26);

    // 小旗
    const fw = 18, fh = 12;
    Sprites.flagFace(ctx, x + 1, y - 26 + bob, fw, fh, lv.flag, lv.flagDir);
    ctx.strokeStyle = 'rgba(12,18,30,0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1, y - 26 + bob, fw, fh);

    // 魔王關的旗杆頂加一點紅，掃一眼就知道哪幾關是魔王
    if (lv.isBoss) {
      ctx.fillStyle = st === 'done' ? '#8fe3a0' : '#e0526b';
      ctx.beginPath();
      ctx.arc(x, y - 28 + bob, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 底座
    ctx.fillStyle = st === 'locked' ? '#79839a' : (st === 'done' ? '#8fe3a0' : '#ffd166');
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(12,18,30,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.stroke();

    if (st === 'done') {
      ctx.strokeStyle = '#17331f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 2.5, y); ctx.lineTo(x - 0.5, y + 2); ctx.lineTo(x + 3, y - 2.5);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** 國名印在國土上：字小一點、描邊細一點，像地圖上的印刷字而不是浮標 */
  function drawLabel(ctx, n, lv, st, selected) {
    const color = st === 'locked' ? '#aeb6c8' : (selected ? '#ffd166' : '#f2f5fb');
    U.text(ctx, lv.country, n.label[0], n.label[1], {
      size: selected ? LABEL_SIZE_SEL : LABEL_SIZE,
      color: color,
      align: 'center',
      strokeWidth: 3,
      strokeColor: 'rgba(16, 24, 18, 0.7)'
    });
  }

  /**
   * 海名。用經緯度定位（EuropeWorld.project），地圖重新取景也不用改。
   * 字刻意淡、斜體、字距拉開 —— 是「地圖上印的字」，不能跟國名搶。
   */
  const SEAS = [
    { name: '地　中　海', lon: 17.5, lat: 34.6, size: 20 },
    { name: '大　西　洋', lon: -9.5, lat: 41.5, size: 17, vertical: true },
    { name: '北　海', lon: 3.2, lat: 56.3, size: 14 },
    { name: '波羅的海', lon: 19.2, lat: 57.4, size: 12 },
    { name: '黑　海', lon: 34, lat: 43.2, size: 16 },
    { name: '愛琴海', lon: 25.2, lat: 38.4, size: 11 },
    { name: '亞得里亞海', lon: 15.3, lat: 43.1, size: 10, angle: 0.62 },
    { name: '比斯開灣', lon: -4.5, lat: 45.3, size: 11 },
    { name: '第勒尼安海', lon: 11.8, lat: 40, size: 10 },
    // v1.9：北歐、非洲先畫出來（還沒有關卡）
    { name: '挪　威　海', lon: 1, lat: 67, size: 16 },
    { name: '巴倫支海', lon: 38, lat: 71, size: 13 },
    { name: '波的尼亞灣', lon: 20.5, lat: 62.8, size: 10, angle: -1.2 },
    { name: '紅海', lon: 38.5, lat: 20.5, size: 11, angle: -1.0 },
    // v1.21 非洲篇：地圖往南延伸到好望角
    { name: '幾內亞灣', lon: 3, lat: 1.5, size: 13 },
    { name: '印　度　洋', lon: 48, lat: -8, size: 17, vertical: true },
    { name: '莫三比克海峽', lon: 40.5, lat: -18.5, size: 10, angle: -1.3 },
    { name: '亞丁灣', lon: 47.5, lat: 12.6, size: 10 },
    { name: '大　西　洋', lon: 0, lat: -18, size: 17, vertical: true }
  ];

  /** 區域名稱（大而淡，像地圖上印的大字；還沒有關卡的標「篇章開發中」） */
  const REGIONS = [
    { name: '北　歐', sub: '（篇章開發中）', lon: 17, lat: 65.5, size: 26 },
    { name: '非　洲', lon: 20, lat: 8, size: 30 },
    { name: '撒哈拉沙漠', lon: 6, lat: 23.5, size: 16 },
    { name: '剛果盆地', lon: 21, lat: -2.5, size: 12 },
    { name: '喀拉哈里沙漠', lon: 22, lat: -24, size: 12 }
  ];

  function drawRegionNames(ctx) {
    REGIONS.forEach(function (r) {
      const p = EuropeWorld.project(r.lon, r.lat);
      U.text(ctx, r.name, p[0], p[1], { size: r.size, weight: 800, color: 'rgba(246, 232, 196, 0.32)', stroke: false });
      if (r.sub) U.text(ctx, r.sub, p[0], p[1] + r.size * 0.9, { size: 12, color: 'rgba(246, 232, 196, 0.32)', stroke: false });
    });
  }

  function drawSeaNames(ctx) {
    SEAS.forEach(function (s) {
      const p = EuropeWorld.project(s.lon, s.lat);
      ctx.save();
      ctx.translate(p[0], p[1]);
      if (s.angle) ctx.rotate(s.angle);
      const opt = {
        size: s.size, weight: 500, color: 'rgba(170, 205, 240, 0.5)',
        stroke: false
      };
      if (s.vertical) {
        // 大西洋直排，貼著西邊海岸
        const chars = s.name.replace(/　/g, '');
        for (let i = 0; i < chars.length; i++) {
          U.text(ctx, chars[i], 0, i * (s.size + 8), opt);
        }
      } else {
        U.text(ctx, s.name, 0, 0, opt);
      }
      ctx.restore();
    });
  }

  function draw(ctx, W, H, opts) {
    // W/H 參數保留相容舊呼叫；世界大小以 EuropeWorld 為準
    const t = opts.t;
    drawSea(ctx, WORLD_W, WORLD_H, t);
    drawSeaNames(ctx);
    drawBackdrop(ctx);
    drawRegionNames(ctx);
    // 東歐篇：opts.east = { unlocked }。不傳就不畫（商店等底圖畫面不需要）
    if (opts.east) drawEast(ctx, opts.east.unlocked, t);
    // v1.8：各國之間的虛線（建議旅程）拿掉了 —— 現在陸上可以走、海上可以開船，
    // 哪裡都去得了，虛線只是畫面雜訊。drawRoute 保留，之後需要再打開。
    if (opts.showRoute) drawRoute(ctx, opts.clearedFn, t);

    /*
     * 分三輪畫：國土 → 國名 → 圖釘。
     * 國名一定要在「所有」國土之後，否則後畫的鄰國會蓋掉前一國的字；
     * 圖釘最後畫，旗子永遠在最上層。
     */
    const eastOpen = !!(opts.east && opts.east.unlocked);
    /*
     * 要 EXP 解鎖的篇章（東歐、v1.21 非洲）：還沒解鎖時整國鎖住（紫灰色 + 鎖頭）。
     * opts.regionOpen(region) 由 game.js 給；舊呼叫端只傳 opts.east 也照舊能用。
     */
    function regionLocked(region) {
      if (!region || region === 'west') return false;
      if (opts.regionOpen) return !opts.regionOpen(region);
      return region === 'east' ? !eastOpen : !!opts.east;
    }
    const info = nations.map(function (n) {
      const lv = Levels.list[n.idx];
      const eastLock = regionLocked(lv.region);
      const open = n.idx < opts.unlocked && !eastLock;
      const done = opts.clearedFn(n.idx);
      return {
        n: n,
        lv: lv,
        selected: n.idx === opts.cursor,
        open: open,
        done: done,
        eastLock: eastLock,
        st: !open ? 'locked' : (done ? 'done' : 'open')
      };
    });

    info.forEach(function (o) {
      o.n.shapes.forEach(function (sh) {
        poly(ctx, sh);
        ctx.fillStyle = o.eastLock ? '#524870'
          : !o.open ? LAND_LOCKED : (o.done ? LAND_DONE : LAND_OPEN);
        ctx.fill();
        ctx.strokeStyle = o.selected ? '#ffd166' : 'rgba(225, 238, 255, 0.5)';
        ctx.lineWidth = o.selected ? 2.5 : 1.1;
        ctx.stroke();
      });
    });
    // 選取的國家邊框要壓在鄰國上面才看得完整，再描一次
    info.forEach(function (o) {
      if (!o.selected) return;
      o.n.shapes.forEach(function (sh) {
        poly(ctx, sh);
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      });
    });
    // 呼叫端要夾在「國土」與「國名」之間畫的東西（航海模式的運河）
    if (opts.afterLand) opts.afterLand();
    if (opts.east) drawEastLabels(ctx, opts.east.unlocked);
    info.forEach(function (o) {
      drawLabel(ctx, o.n, o.lv, o.st, o.selected);
      if (o.eastLock) lockIcon(ctx, o.n.label[0], o.n.label[1] + 14);
    });
    info.forEach(function (o) { drawPin(ctx, o.n, o.lv, o.st, o.selected, t); });
  }

  function hitTest(mx, my) {
    let best = -1, bestD = 34 * 34;
    nations.forEach(function (n) {
      const dx = mx - n.pin[0], dy = my - n.pin[1];
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = n.idx; }
    });
    return best;
  }

  build();

  return {
    draw: draw,
    hitTest: hitTest,
    rebuild: build,
    nations: nations,
    east: east,
    hitTestEast: hitTestEast,
    pinBox: pinBox,
    LABEL_SIZE_SEL: LABEL_SIZE_SEL,
    cam: cam,
    follow: follow,
    beginView: beginView,
    endView: endView,
    toWorld: toWorld,
    onScreen: onScreen,
    WORLD_W: WORLD_W,
    WORLD_H: WORLD_H,
    VIEW_TOP: VIEW_TOP,
    VIEW_H: VIEW_H,
    MAP_TOP: MAP_TOP,
    MAP_BOTTOM: MAP_BOTTOM,
    TOP_BAR: TOP_BAR,
    BOTTOM_PANEL: BOTTOM_PANEL
  };
})();
