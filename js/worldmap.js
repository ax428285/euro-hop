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
  /*
   * v1.31 美洲篇：兩張地圖 —— 'eu' 歐洲（EuropeWorld）、'am' 新大陸（AmericaWorld，tools/build-america-map.js）。
   * 兩張世界一樣大、比例尺相同（上面的 WORLD_W / WORLD_H 兩邊通用），
   * 換地圖只要換國界資料與投影、再 build() 一次（Voyage 也要重烘陸地，見 Voyage.rebuild）。
   * 歐洲專屬的東西（商店、港口、劇情人物、結界、扒手⋯⋯）都只在 'eu' 建、只在 'eu' 畫。
   */
  const WORLDS = {
    eu: { id: 'eu', proj: EuropeWorld, geo: EuropeGeo, back: typeof EuropeBackdrop !== 'undefined' ? EuropeBackdrop : {} },
    am: typeof AmericaWorld !== 'undefined'
      ? { id: 'am', proj: AmericaWorld, geo: AmericaGeo, back: AmericaBackdrop } : null
  };
  let WD = WORLDS.eu;
  /** 目前這張地圖的經緯度 → 世界座標 */
  function project(lon, lat) { return WD.proj.project(lon, lat); }
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

  function endView(ctx) {
    ctx.restore();
    if (PAL.paper) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, VIEW_TOP, 960, VIEW_H); ctx.clip();
      drawPaperVignette(ctx);
      ctx.restore();
    }
  }

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

  /*
   * 大地圖配色（v1.29.4 玩家：整個大地圖配色不太好看，給幾個提案選）。
   * 顏色集中在 PALETTES，WorldMap.setPalette(name) 切換；畫的時候才讀，切了下一帧就生效。
   */
  const PALETTES = {
    current: { sea: '#1d3a5c', seaDeep: '#15293f', wave: 'rgba(160, 200, 240, 0.10)',
               open: '#5f8052', done: '#47795d', locked: '#444f68', eastLocked: '#524870', eastOpen: '#6b5a8e',
               edge: 'rgba(225, 238, 255, 0.5)', euFill: '#56684f', euEdge: 'rgba(225, 238, 255, 0.38)',
               bgFill: '#4a4535', bgEdge: 'rgba(214, 204, 170, 0.55)', seaName: 'rgba(170, 205, 240, 0.5)' },
    // A 古地圖（v1.29.8 玩家：顏色太亂，改用古地圖，羊皮紙感要出來）：
    //   泛黃的紙＋紙紋與污漬、四周燒黃的暈邊、灰綠的海上刻線波紋、深褐墨水的國界和字、角落一個羅盤
    parchment: { sea: '#bcd3c6', seaDeep: '#a9c4b6', wave: 'rgba(60, 80, 70, 0.22)',
                 open: '#f3e2b2', done: '#dcd79c', locked: '#cdbd9b', eastLocked: '#cdbd9b', eastOpen: '#d9c39a',
                 lockedEdge: 'rgba(110, 80, 50, 0.55)', doneEdge: 'rgba(150, 95, 20, 0.95)',
                 edge: 'rgba(90, 58, 28, 0.85)', euFill: '#e9d7aa', euEdge: 'rgba(90, 58, 28, 0.5)',
                 bgFill: '#e0c896', bgEdge: 'rgba(90, 58, 28, 0.45)', seaName: 'rgba(50, 66, 58, 0.62)',
                 label: '#3a2410', labelSel: '#a3260f', labelLocked: '#6e5a40', labelStroke: 'rgba(250, 238, 205, 0.85)',
                 spLabel: '#3a2410', merchantLabel: '#4a2a5a', portLabel: '#1e4a52', region: 'rgba(90, 58, 28, 0.28)',
                 spFill: { PT: '#ead08f', IE: '#efc596' }, lockIcon: '#6e4a2a', lockedPin: '#9a7d55',
                 // 破完的圖釘點：紅色封蠟＋米白打勾（綠色跟羊皮紙不搭）
                 donePin: '#a8321e', doneCheck: '#f6e7c0', bossDone: '#c8962e', paper: true },
    // B 明亮卡通：亮藍海、鮮綠陸地
    cartoon: { sea: '#2f86c8', seaDeep: '#1d63a0', wave: 'rgba(255, 255, 255, 0.16)',
               open: '#7cc25e', done: '#4caf7a', locked: '#8b94a8', eastLocked: '#9a86c0', eastOpen: '#b49ce0',
               edge: 'rgba(255, 255, 255, 0.75)', euFill: '#a3c98a', euEdge: 'rgba(255, 255, 255, 0.5)',
               bgFill: '#d9c08a', bgEdge: 'rgba(255, 255, 255, 0.45)', seaName: 'rgba(225, 240, 255, 0.7)' },
    // C 地中海暖陽：土耳其藍的海、橄欖綠與赭色陸地
    // v1.29.5 玩家：還沒解鎖的用 D 夜航的國家色（藍灰＋青色國界；夜航的「鎖住色」太暗），解開、破完的自由發揮：
    //   解開 = 亮橄欖綠（等你來）、破完 = 深一點的翠綠＋金色國界（像拿到月桂冠）
    sunny: { sea: '#1f7a94', seaDeep: '#135a72', wave: 'rgba(220, 250, 255, 0.13)',
             open: '#a9bf6a', done: '#4f9a6a', locked: '#35566a', eastLocked: '#35566a', eastOpen: '#b897b4',
             lockedEdge: 'rgba(130, 225, 255, 0.6)', doneEdge: 'rgba(255, 214, 102, 0.85)',
             edge: 'rgba(255, 246, 220, 0.65)', euFill: '#b3ab7c', euEdge: 'rgba(255, 246, 220, 0.42)',
             bgFill: '#cfa774', bgEdge: 'rgba(255, 240, 210, 0.45)', seaName: 'rgba(220, 245, 250, 0.6)' },
    // D 夜航：深海軍藍、低彩度陸地、亮青色國界
    night: { sea: '#122238', seaDeep: '#0b1626', wave: 'rgba(120, 200, 255, 0.10)',
             open: '#35566a', done: '#2f6b62', locked: '#2a3346', eastLocked: '#3d3657', eastOpen: '#57497e',
             edge: 'rgba(130, 225, 255, 0.6)', euFill: '#2c4152', euEdge: 'rgba(130, 225, 255, 0.3)',
             bgFill: '#3a352c', bgEdge: 'rgba(230, 200, 140, 0.35)', seaName: 'rgba(130, 200, 240, 0.55)' }
  };
  // v1.29.8 玩家改選 A 古地圖（羊皮紙版）；sunny 是 v1.29.4～1.29.7 的配色、current 是 v1.29.3 以前的，留著對照
  let PAL = PALETTES.parchment;

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

  /*
   * v1.29.3 玩家：歐洲、東歐的地圖開了，中間還夾著咖啡色的國家很醜。
   * → 歐洲的背景國改成灰綠色（跟關卡國同色系、灰一點，有沒有圖釘一看就分得出來），
   *   北非、中東、土耳其這些沙漠地帶維持沙褐色。跟海（#1d3a5c）的色距還是夠大，看得出是陸地。
   */
  const BACKDROP_EU = { AL: 1, BA: 1, BE: 1, BG: 1, BY: 1, DK: 1, EE: 1, FI: 1, HR: 1, HU: 1, IE: 1, LT: 1, LU: 1,
                        LV: 1, MD: 1, ME: 1, MK: 1, NO: 1, PL: 1, PT: 1, RO: 1, RS: 1, RU: 1, SE: 1, SI: 1, SK: 1,
                        UA: 1, XK: 1 };

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
  /*
   * v1.31 新大陸：圖釘直接放在關卡城市的經緯度上（國土中心常常離城市很遠：
   * 巴西的中心在內陸的馬托格羅索、墨西哥被地圖西緣切掉一大半）。
   */
  const PIN_LONLAT = {
    CU: [-82.2, 22.9],    // 哈瓦那
    JM: [-77.6, 18.3],    // 島的中間（地圖上的牙買加很小，東邊的藍山一帶放不下入口）
    MX: [-88.6, 20.6],    // 奇琴伊察（猶加敦半島）
    PA: [-79.3, 9.35],    // 運河北口（地峽很窄，再往南入口會落在海上）
    CO: [-75.2, 10.2],    // 卡塔赫納
    BR: [-43.4, -22.6]    // 里約熱內盧
  };
  const PIN_NUDGE = {
    // v1.30 挪威：國土中心在峽灣附近，跟黃金獵犬、峽灣老漁夫擠在一起，國名被擠到很遠 → 往東南（奧斯陸那側）挪
    NO: [34, 14]
  };

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
          specials.forEach(function (o) { clash += boxOverlap(b, pinBox(o.pin)); });
          placed.forEach(function (pb) { clash += boxOverlap(b, pb); });
          /*
           * v1.30：狹長的國家（挪威）外框中心離圖釘很遠，字會被拉到看不出是誰的地方 →
           * 離自己的圖釘超過 100px 就大幅扣分（map-check 要求 110 以內）。
           */
          const farPin = Math.max(0, Math.hypot(x - fallbackPin[0], y - fallbackPin[1]) - 100);
          const base = insideFrac(b, n.shapes) * 100 - Math.hypot(x - mx, y - my) * 0.15 - farPin * 2;
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

  /*
   * 特殊地點（v1.21.1 玩家要求）：不是關卡，走過去按 Enter 打開功能畫面。
   *   葡萄牙 → 商店（大航海時代的貿易港，買賣東西很合理）
   *   愛爾蘭 → 裝備
   * 國界用背景國的真實資料（EuropeBackdrop），圖釘換成功能圖示（不是國旗）。
   */
  // 愛爾蘭：國旗的橘色（v1.23 玩家：原本的綠色跟英國太像；葡萄牙維持金褐色）
  const SPECIAL_DEFS = [
    { id: 'PT', name: '葡萄牙', role: '商店', scene: 'shop', seller: 'portugal', fill: '#7a6438', edge: 'rgba(255, 214, 140, 0.75)', badge: '#e8b84a' },
    { id: 'IE', name: '愛爾蘭', role: '裝備', scene: 'inventory', fill: '#c0702e', edge: 'rgba(255, 210, 160, 0.8)', badge: '#5fd08a' }
  ];
  /*
   * 神祕商人（v1.22 玩家要求）：藏在地圖不起眼的地方，賣葡萄牙商店沒有的東西（見 Shop.SELLERS）。
   * 用經緯度定位（EuropeWorld.project），沒有國土，地圖上畫成披紫色斗篷、提著燈的人。
   *   藥草婆婆  地中海：西西里島南邊的小島海域（船開得到）
   *   老漁夫    北歐：挪威外海的峽灣口（船開得到）
   *   駱駝商隊  撒哈拉：阿爾及利亞內陸的綠洲（上岸用走的）
   */
  const MERCHANT_DEFS = [
    { id: 'M_isle', seller: 'isle', name: '藥草婆婆', lon: 14.2, lat: 35.4, prompt: '按 Enter 跟地中海的藥草婆婆交易' },
    { id: 'M_fjord', seller: 'fjord', name: '峽灣老漁夫', lon: 3.6, lat: 62.6, prompt: '按 Enter 跟峽灣的老漁夫交易' },
    // v1.23：阿爾及利亞變成關卡，圖釘落在國土中央 → 商隊往西南挪，不然兩個圖釘疊在一起
    { id: 'M_oasis', seller: 'oasis', name: '駱駝商隊', lon: -1.5, lat: 26.6, prompt: '按 Enter 跟綠洲的駱駝商隊交易' }
  ];
  /*
   * 地中海港口（v1.26 玩家：地中海增設港口，A 沉船潛水、B 造船廠，分別放不同港口；造船廠盡量離西班牙近）
   *   瓦倫西亞造船廠：離起點西班牙最近的地中海岸（中世紀的皇家造船廠 Drassanes del Grau）
   *   安提基特拉沉船：克里特島北邊的小島外海，1900 年採海綿的潛水夫在這裡發現兩千年前的羅馬沉船
   */
  const PORT_DEFS = [
    { id: 'P_yard', kind: 'shipyard', name: '瓦倫西亞造船廠', lon: 0.0, lat: 39.45, scene: 'shipyard',
      prompt: '按 Enter 進入瓦倫西亞造船廠（升級你的船）' },
    { id: 'P_wreck', kind: 'wreck', name: '安提基特拉沉船', lon: 23.3, lat: 35.85, scene: 'dive',
      prompt: '按 Enter 潛到安提基特拉沉船（撈兩千年前的寶物）' },
    /*
     * 雙人試煉（v1.28，關卡在 duo.js）：選擇性地點，不擋主線。
     *   v1.28.1 玩家：地中海太擠 → 兩個都搬到土耳其（內陸很空），主題也換成土耳其的古蹟
     *   哈圖沙獅子門：西臺帝國的首都（安卡拉東邊）
     *   代林庫尤地下城：卡帕多奇亞的地下城（哈圖沙南邊；兩個圖釘上下要拉開，不然字會壓到另一個圖釘）
     */
    { id: 'P_duo1', kind: 'duoTwins', name: '哈圖沙獅子門', lon: 34.0, lat: 40.7, scene: 'duo', duo: true,
      prompt: '按 Enter 挑戰哈圖沙獅子門（需雙人）' },
    { id: 'P_duo2', kind: 'duoMaze', name: '代林庫尤地下城', lon: 35.2, lat: 38.0, scene: 'duo', duo: true,
      prompt: '按 Enter 挑戰代林庫尤地下城（需雙人）' }
  ];
  const specials = [];

  function buildSpecials() {
    specials.length = 0;
    if (WD.id !== 'eu') { buildAmericaSpecials(); return; }
    if (typeof EuropeBackdrop === 'undefined') return;
    SPECIAL_DEFS.forEach(function (d) {
      const geo = EuropeBackdrop[d.id];
      if (!geo) return;
      const main = geo.shapes.reduce(function (a, b) { return b.length > a.length ? b : a; });
      const pin = innerPoint(main);
      specials.push({ id: d.id, def: d, name: d.name, shapes: geo.shapes, pin: pin, label: [pin[0], pin[1] + 16] });
    });
    MERCHANT_DEFS.forEach(function (m) {
      const p = EuropeWorld.project(m.lon, m.lat);
      const pin = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
      specials.push({
        // v1.25.2 玩家：神祕商人要用本名顯示在地圖上（原本三位都只寫「神祕商人」）
        id: m.id, name: m.name, shapes: [], pin: pin, label: [pin[0], pin[1] + 16],
        def: { role: '神祕商人', scene: 'shop', seller: m.seller, merchant: true, prompt: m.prompt }
      });
    });
    // v1.27 貿易港（C 貿易、D 懸賞板）：位置在 trade.js
    if (typeof Trade !== 'undefined') {
      Trade.PORTS.forEach(function (tp) {
        const p = EuropeWorld.project(tp.lon, tp.lat);
        const pin = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
        specials.push({
          id: 'T_' + tp.id, name: tp.name, shapes: [], pin: pin, label: [pin[0], pin[1] + 16],
          def: { role: '貿易港', scene: 'market', port: 'market', market: tp.id,
                 prompt: '按 Enter 進入' + tp.name + '貿易港（買賣特產、接懸賞）' }
        });
      });
    }
    // v1.29 峽灣的黃金獵犬（pet.js）：收養之後就不在這裡了（gone() 為真時不畫、不算靠近）
    if (typeof Pet !== 'undefined') {
      const dp = Pet.spotPin();
      specials.push({
        id: 'PET_dog', name: '黃金獵犬', shapes: [], pin: dp, label: [dp[0], dp[1] + 16],
        def: { role: '黃金獵犬', scene: 'dog', dog: true, gone: Pet.adopted, prompt: '按 Enter 跟黃金獵犬打招呼' }
      });
    }
    PORT_DEFS.forEach(function (m) {
      const p = EuropeWorld.project(m.lon, m.lat);
      const pin = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
      specials.push({
        id: m.id, name: m.name, shapes: [], pin: pin, label: [pin[0], pin[1] + 16],
        def: { role: m.duo ? '雙人試煉' : '港口', scene: m.scene, port: m.kind, prompt: m.prompt, duo: !!m.duo }
      });
    });
    // v1.30 劇情人物與地點（quests.js）：雷神索爾、哥倫布、瑞士銀行、動物園、金字塔
    if (typeof Quests !== 'undefined') {
      Quests.SPOTS.forEach(function (q) {
        const p = EuropeWorld.project(q.lon, q.lat);
        const pin = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
        specials.push({
          id: q.id, name: q.name, shapes: [], pin: pin, label: [pin[0], pin[1] + 16],
          def: { role: q.name, scene: 'talk', npc: q.npc, prompt: q.prompt }
        });
      });
    }
  }

  /** v1.31 新大陸地圖上的特殊地點（quests.js 的 AM_SPOTS，用美洲的投影） */
  function buildAmericaSpecials() {
    if (typeof Quests === 'undefined' || !Quests.AM_SPOTS) return;
    Quests.AM_SPOTS.forEach(function (q) {
      const p = project(q.lon, q.lat);
      const pin = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
      specials.push({
        id: q.id, name: q.name, shapes: [], pin: pin, label: [pin[0], pin[1] + 16],
        // v1.31 服裝店／寵物用品店：跟神祕商人一樣進商店（merchant 讓字放在店底下），畫成小店面
        def: q.seller ? { role: '商店', scene: 'shop', seller: q.seller, merchant: true, stall: q.seller, prompt: q.prompt }
                      : { role: q.name, scene: 'talk', npc: q.npc, prompt: q.prompt }
      });
    });
  }

  /** v1.31 新大陸的小店面：條紋遮雨棚＋招牌（服裝店掛衣架、寵物店掛骨頭） */
  function drawStall(ctx, x, y, t, near, kind) {
    ctx.save();
    ctx.translate(x, y);
    if (near) {
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, -8, 17 + Math.sin(t * 0.1) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 1, 10, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    // 牆＋門
    ctx.fillStyle = '#f2e6cc'; ctx.fillRect(-9, -12, 18, 12);
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(-2.5, -7, 5, 7);
    // 遮雨棚（紅白／藍白條紋）
    const c = kind === 'petshop' ? '#3a7ac8' : '#d0405a';
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = k % 2 ? '#ffffff' : c;
      ctx.beginPath(); ctx.moveTo(-11 + k * 4.4, -12); ctx.lineTo(-11 + (k + 1) * 4.4, -12);
      ctx.lineTo(-11 + (k + 1) * 4.4, -15.5); ctx.lineTo(-11 + k * 4.4, -15.5); ctx.fill();
    }
    // 招牌
    const sw = Math.sin(t * 0.05) * 0.12;
    ctx.save(); ctx.translate(0, -20); ctx.rotate(sw);
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a2410'; ctx.fillStyle = '#3a2410'; ctx.lineWidth = 1.1;
    if (kind === 'petshop') {
      ctx.fillRect(-2.4, -0.6, 4.8, 1.2);
      [[-2.6, -1], [-2.6, 1], [2.6, -1], [2.6, 1]].forEach(function (q) { ctx.beginPath(); ctx.arc(q[0], q[1], 1.1, 0, Math.PI * 2); ctx.fill(); });
    } else {
      ctx.beginPath(); ctx.moveTo(0, -2.6); ctx.lineTo(0, -1.2); ctx.lineTo(-3.4, 1.8); ctx.lineTo(3.4, 1.8); ctx.lineTo(0, -1.2); ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }

  /** 神祕商人：紫色斗篷 + 兜帽 + 提燈（燈會微微晃，遠遠就看得到） */
  function drawMerchant(ctx, x, y, t, near) {
    ctx.save();
    ctx.translate(x, y);
    const glow = 0.5 + Math.sin(t * 0.08) * 0.2;
    ctx.fillStyle = 'rgba(200, 160, 255, ' + (0.18 + glow * 0.15).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(0, -10, near ? 18 : 14, 0, Math.PI * 2); ctx.fill();
    // 斗篷
    ctx.fillStyle = '#5a3a8a';
    ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-4, -16); ctx.lineTo(4, -16); ctx.lineTo(7, 0); ctx.closePath(); ctx.fill();
    // 兜帽（臉藏在陰影裡）
    ctx.beginPath(); ctx.arc(0, -17, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1028';
    ctx.beginPath(); ctx.arc(0.8, -16.5, 3, 0, Math.PI * 2); ctx.fill();
    // 一雙發亮的眼睛
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(-0.6, -17.2, 1.2, 1.2); ctx.fillRect(1.8, -17.2, 1.2, 1.2);
    // 提燈
    const sw = Math.sin(t * 0.06) * 1.5;
    ctx.strokeStyle = '#2a1e10'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(6, -10); ctx.lineTo(9 + sw, -6); ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(9 + sw, -4, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** 港口記號：碼頭木樁＋圓徽章 —— 造船廠畫錨，沉船畫潛水頭盔（會冒泡） */
  function drawPort(ctx, x, y, t, near, kind) {
    ctx.save();
    ctx.translate(x, y);
    if (near) {
      ctx.strokeStyle = 'rgba(160, 230, 255, 0.95)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, -8, 17 + Math.sin(t * 0.1) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    const duo = kind === 'duoTwins' || kind === 'duoMaze';
    // 底座：地上一圈影子＋一小根桿子（v1.29.1 雙人試煉、v1.29.7 港口與造船廠：原本的咖啡色碼頭架很怪，拿掉）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = duo ? '#c89af0' : '#e8f6ff';
    ctx.fillRect(-1, -5, 2, 5);
    // 徽章
    const by = -14 + (near ? Math.sin(t * 0.08) * 2 : 0);
    ctx.fillStyle = kind === 'shipyard' ? '#3a7ab8' : kind === 'market' ? '#b8862a' : duo ? '#8a4ab8' : '#1f6a78';
    ctx.beginPath(); ctx.arc(0, by, 9.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e8f6ff'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, by, 9.5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#f4efe2'; ctx.fillStyle = '#f4efe2'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    if (kind === 'shipyard') {
      // 造船廠（v1.29.6：錨讓給貿易港）：船台上蓋到一半的船 —— 船身＋桅杆＋兩根斜撐
      ctx.beginPath(); ctx.moveTo(-6, by + 1); ctx.lineTo(6, by + 1); ctx.lineTo(3.5, by + 5); ctx.lineTo(-3.5, by + 5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, by + 1); ctx.lineTo(0, by - 6);
      ctx.moveTo(-6.5, by + 6); ctx.lineTo(-3, by - 2); ctx.moveTo(6.5, by + 6); ctx.lineTo(3, by - 2);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.8, by - 6); ctx.lineTo(4.5, by - 2); ctx.lineTo(0.8, by - 2); ctx.closePath(); ctx.fill();
    } else if (duo) {
      // 雙人試煉：兩個小人並肩（一大一小，像在疊羅漢）
      ctx.beginPath(); ctx.arc(-3.2, by - 4, 2.2, 0, Math.PI * 2); ctx.arc(3.2, by - 4, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-5.4, by - 1, 4.4, 6); ctx.fillRect(1, by - 1, 4.4, 6);
    } else if (kind === 'market') {
      // 貿易港（v1.29.6 玩家：港口換成港口的圖案；原本的木箱看起來像信封）：船錨＋底下一道浪
      ctx.beginPath(); ctx.arc(0, by - 5.2, 1.6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, by - 3.6); ctx.lineTo(0, by + 4);
      ctx.moveTo(-3, by - 1.6); ctx.lineTo(3, by - 1.6);
      ctx.moveTo(-5, by + 0.5); ctx.quadraticCurveTo(-4.5, by + 4.5, 0, by + 4.5); ctx.quadraticCurveTo(4.5, by + 4.5, 5, by + 0.5);
      ctx.stroke();
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(-6, by + 7); ctx.quadraticCurveTo(-3, by + 5.6, 0, by + 7); ctx.quadraticCurveTo(3, by + 8.4, 6, by + 7); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(0, by, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1f6a78';
      ctx.beginPath(); ctx.arc(0, by, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4efe2';
      ctx.fillRect(-6, by + 4.5, 12, 2);
      ctx.strokeStyle = 'rgba(220, 245, 255, 0.85)'; ctx.lineWidth = 1;
      const ph = (t * 0.4) % 14;
      ctx.beginPath(); ctx.arc(7, by - 6 - ph, 1.5, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.restore();
  }

  /** 特殊地點的國土：自己的顏色，一眼跟關卡國、背景國分得開 */
  function drawSpecialLand(ctx, nearId) {
    specials.forEach(function (s) {
      s.shapes.forEach(function (sh) {
        poly(ctx, sh);
        ctx.fillStyle = (PAL.spFill && PAL.spFill[s.id]) || s.def.fill;
        ctx.fill();
        ctx.strokeStyle = s.id === nearId ? '#ffd166' : s.def.edge;
        ctx.lineWidth = s.id === nearId ? 2.5 : 1.2;
        ctx.stroke();
      });
    });
  }

  /** 特殊地點的圖釘：圓形徽章 + 功能圖示（商店 = 錢袋、裝備 = 寶箱），下面印「國名・功能」 */
  function drawSpecialPins(ctx, nearId, t) {
    specials.forEach(function (s) {
      const x = s.pin[0], y = s.pin[1];
      const near = s.id === nearId;
      if (s.def.gone && s.def.gone()) return;
      if (s.def.dog) { Pet.drawWaiting(ctx, x, y, t, near); return; }
      if (s.def.npc) { Quests.drawMapIcon(ctx, s.def.npc, x, y, t, near); return; }
      if (s.def.stall) { drawStall(ctx, x, y, t, near, s.def.stall); return; }
      if (s.def.merchant) {
        if (near) {
          ctx.strokeStyle = 'rgba(216, 184, 255, 0.95)'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(x, y - 6, 16 + Math.sin(t * 0.1) * 2, 0, Math.PI * 2); ctx.stroke();
        }
        drawMerchant(ctx, x, y, t, near);
        return;
      }
      if (s.def.port) { drawPort(ctx, x, y, t, near, s.def.port); return; }
      const bob = near ? Math.sin(t * 0.08) * 3 : 0;
      ctx.save();
      if (near) {
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x, y, 15 + Math.sin(t * 0.1) * 2, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#d8dee8';
      ctx.fillRect(x - 1, y - 16 + bob, 2, 16);
      // 徽章
      const by = y - 22 + bob;
      ctx.fillStyle = s.def.badge;
      ctx.beginPath(); ctx.arc(x, by, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(12,18,30,0.75)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, by, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#2a1e10';
      if (s.def.scene === 'shop') {
        // 錢袋：圓袋身 + 綁口 + €
        ctx.beginPath(); ctx.arc(x, by + 2, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(x - 2.5, by - 6, 5, 3);
        ctx.fillStyle = s.def.badge;
        ctx.font = '700 7px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('€', x, by + 2.5);
      } else {
        // 寶箱：箱身 + 箱蓋 + 鎖扣
        ctx.fillRect(x - 6, by - 2, 12, 7);
        ctx.fillRect(x - 6, by - 6, 12, 3);
        ctx.fillStyle = s.def.badge;
        ctx.fillRect(x - 1.5, by - 2, 3, 3);
      }
      // 底座
      ctx.fillStyle = s.def.badge;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }

  function drawSpecialLabels(ctx, nearId) {
    specials.forEach(function (s) {
      const near = s.id === nearId;
      if (s.def.gone && s.def.gone()) return;
      const bare = s.def.merchant || s.def.port || s.def.dog || s.def.npc;     // 沒有國土的地點：只印名字
      U.text(ctx, bare ? s.name : s.name + '・' + s.def.role, s.label[0], s.label[1], {
        size: near ? LABEL_SIZE_SEL : (bare ? 11 : 12),
        color: near ? (PAL.labelSel || '#ffd166') : (s.def.merchant ? (PAL.merchantLabel || '#e6d8ff')
          : s.def.port ? (PAL.portLabel || '#bdf0ff') : (PAL.spLabel || '#fff4dc')),
        align: 'center',
        strokeWidth: 3,
        strokeColor: PAL.labelStroke || 'rgba(16, 24, 18, 0.75)'
      });
    });
  }

  /** 哪個特殊地點離 (x, y) 最近、而且在 range 內（沒有回 null） */
  function nearSpecial(x, y, range) {
    let best = null, bestD = range;
    specials.forEach(function (s) {
      if (s.def.gone && s.def.gone()) return;
      const d = Math.hypot(x - s.pin[0], y - (s.pin[1] + 4));
      if (d < bestD) { bestD = d; best = s; }
    });
    return best;
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
    if (typeof EuropeBackdrop === 'undefined' || WD.id !== 'eu') return;
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
        ctx.fillStyle = unlocked ? PAL.eastOpen : PAL.eastLocked;
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
    ctx.strokeStyle = PAL.lockIcon || '#b9b0d6';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x, y - 2, 2.6, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = PAL.lockIcon || '#b9b0d6';
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
      // v1.31：只建「這張地圖上」的國家（美洲篇的國家只在新大陸地圖、歐洲的只在歐洲地圖）
      const geo = WD.geo[lv.id] || WD.back[lv.id];
      if (!geo) return;   // 沒有地理資料的國家就不畫（不該發生，map-check 會抓）
      const ll = WD.id === 'am' && PIN_LONLAT[lv.id];
      const center = ll ? project(ll[0], ll[1]) : (geo.center || innerPoint(geo.shapes[0]));
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
    // 特殊地點（葡萄牙商店、愛爾蘭裝備）的圖釘也要先定位：國名標籤要避開它們
    buildSpecials();
    // 圖釘全部定位後才擺標籤（要避開所有國家的旗子）
    placeLabels();
    // 特殊地點的標籤（「葡萄牙・商店」比國名長，最後擺：避開關卡國已經擺好的字）
    specials.forEach(function (s) {
      if (s.def.merchant || s.def.port || s.def.dog || s.def.npc) return;          // 神祕商人、港口、黃金獵犬、劇情人物沒有國土，字就放在人底下（buildSpecials 已設好）
      const name = s.name + '・' + s.def.role;
      placeOne(s, name, s.pin);
      // 國土太小（愛爾蘭）放不下時，字會壓在自己的圖釘上 → 改放圖釘正下方
      if (boxOverlap(labelBoxAt(name, s.label[0], s.label[1], LABEL_SIZE_SEL), pinBox(s.pin)) > 0) {
        s.label = [s.pin[0], s.pin[1] + 16];
      }
    });
    // 東歐國最後擺：要避開關卡國已經擺好的字
    buildEast();
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  /*
   * 羊皮紙（PAL.paper）：
   *   紙紋 —— 一張 256×256 的雜點＋淡污漬貼圖，用 multiply 蓋在海和陸地上（跟著地圖捲動，像印在同一張紙上）
   *   暈邊 —— 畫面四周燒黃變深（endView 畫，固定在畫面上）
   *   羅盤 —— 大西洋上一個古地圖的羅盤玫瑰
   * 貼圖用固定種子產生，每次開遊戲都一樣。
   */
  let paperTex = null;
  function paperPattern(ctx) {
    if (paperTex) return paperTex;
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 256);
    let seed = 7;
    const rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    // 大塊淡污漬
    for (let i = 0; i < 9; i++) {
      const x = rnd() * 256, y = rnd() * 256, r = 30 + rnd() * 60;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(150, 110, 60, 0.22)');
      rg.addColorStop(1, 'rgba(150, 110, 60, 0)');
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // 細紙纖維雜點
    for (let i = 0; i < 2600; i++) {
      const a = 0.05 + rnd() * 0.12;
      g.fillStyle = 'rgba(110, 80, 40, ' + a.toFixed(3) + ')';
      g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 1.4, 1);
    }
    paperTex = ctx.createPattern(c, 'repeat');
    return paperTex;
  }
  function drawPaperGrain(ctx) {
    const pat = paperPattern(ctx);
    if (!pat) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pat;
    ctx.fillRect(cam.x - 2, cam.y - 2, 964, VIEW_H + 4);
    ctx.restore();
  }
  function drawCompass(ctx) {
    // 羅盤：歐洲在比斯開灣外的大西洋，新大陸在小安地列斯群島東邊的大西洋
    const p = WD.id === 'eu' ? project(-13.5, 47.5) : project(-42, 21);
    ctx.save();
    ctx.translate(p[0], p[1]);
    ctx.strokeStyle = 'rgba(80, 52, 24, 0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, long = i % 2 === 0, r = long ? 30 : 18;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(120, 40, 20, 0.75)' : 'rgba(80, 52, 24, 0.55)';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(a + 0.35) * 5, Math.sin(a + 0.35) * 5);
      ctx.lineTo(0, 0);
      ctx.closePath(); ctx.fill();
    }
    U.text(ctx, 'N', 0, -37, { size: 11, weight: 800, color: 'rgba(90, 30, 15, 0.85)', stroke: false });
    ctx.restore();
  }
  function drawPaperVignette(ctx) {
    const g = ctx.createRadialGradient(480, VIEW_TOP + VIEW_H / 2, VIEW_H * 0.45, 480, VIEW_TOP + VIEW_H / 2, 620);
    g.addColorStop(0, 'rgba(120, 70, 20, 0)');
    g.addColorStop(1, 'rgba(110, 60, 15, 0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, VIEW_TOP, 960, VIEW_H);
    ctx.strokeStyle = 'rgba(90, 55, 20, 0.6)'; ctx.lineWidth = 3;
    ctx.strokeRect(1.5, VIEW_TOP + 1.5, 957, VIEW_H - 3);
  }

  function drawSea(ctx, W, H, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, PAL.sea);
    g.addColorStop(1, PAL.seaDeep);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // （v1.26.2 玩家：海背後的網格拿掉，只留波紋）
    ctx.strokeStyle = PAL.wave;
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

  /*
   * 背景國標出國名＋國旗（v1.29.1 玩家：土耳其的國名和國旗先出來，但靠近不會有反應；v1.29.2 加北歐四國）。
   * 國旗「貼在土地上」：壓扁＋斜切，像畫在地面上，不是插旗桿的圖釘（那是關卡國的樣子）。
   * 只是裝飾：不進 specials、不算靠近、按 Enter 沒反應。
   */
  // v1.29.2 玩家：國旗再小一點；北歐也先印上去（冰島在地圖外面）
  // v1.30 北歐篇：北歐五國有關卡了（地圖往西延伸、冰島也進來了）→ 改成關卡國的圖釘，這裡只剩土耳其
  const PAINTED = [
    { id: 'TR', name: '土耳其', lon: 30.6, lat: 39.3, flag: 'turkey' },
    // v1.30 玩家：黃金獵犬搬到蘇格蘭，把蘇格蘭標出來（國界在英國的資料裡，只印名字＋聖安德魯十字旗）
    // over：畫在關卡國的國土上面（蘇格蘭在英國的國土裡，畫在底下會被蓋掉）
    { id: 'SCO', name: '蘇格蘭', lon: -3.4, lat: 56.4, flag: 'scotland', over: true },
    // v1.30 玩家：新增比利時（不是關卡，海邊有扒手，見 quests.js 的 pickpocket）
    { id: 'BE', name: '比利時', lon: 4.7, lat: 50.6, flag: 'belgium' }
  ];
  const PF_W = 20, PF_H = 13;     // 平貼國旗的大小（關卡國的旗子約 22×15，這個要比較低調）
  /** 北歐十字旗：直條偏旗桿那側（約 37%），inner = 挪威十字裡面那條藍 */
  function drawNordicFlag(ctx, w, h, d) {
    ctx.fillStyle = d.bg;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    const cx = -w / 2 + w * 0.37, t = h * 0.26;
    ctx.fillStyle = d.cross;
    ctx.fillRect(cx - t / 2, -h / 2, t, h);
    ctx.fillRect(-w / 2, -t / 2, w, t);
    if (d.inner) {
      const ti = t * 0.5;
      ctx.fillStyle = d.inner;
      ctx.fillRect(cx - ti / 2, -h / 2, ti, h);
      ctx.fillRect(-w / 2, -ti / 2, w, ti);
    }
  }
  /** 蘇格蘭：藍底白色斜十字（聖安德魯十字） */
  function drawSaltire(ctx, w, h) {
    ctx.fillStyle = '#005eb8';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.clip();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = h * 0.2;
    ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.moveTo(w / 2, -h / 2); ctx.lineTo(-w / 2, h / 2); ctx.stroke();
    ctx.restore();
  }
  function drawTurkeyFlag(ctx, w, h) {
    ctx.fillStyle = '#e30a17';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    // 白色新月＋星（月亮偏左、星在右邊）
    const r = h * 0.32;
    const mx = -w * 0.12;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(mx, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e30a17';
    ctx.beginPath(); ctx.arc(mx + r * 0.28, 0, r * 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    const sx = mx + r * 1.15, sr = r * 0.42;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? sr * 0.42 : sr;
      ctx.lineTo(sx + Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }
  function drawPaintedNations(ctx, over) {
    if (WD.id !== 'eu') return;
    PAINTED.forEach(function (d) {
      if (!!d.over !== !!over) return;
      const p = EuropeWorld.project(d.lon, d.lat);
      ctx.save();
      ctx.translate(p[0], p[1]);
      // 平貼在地上：上下壓扁、往右斜，邊緣淡一點像漆在地面
      ctx.transform(1, 0, -0.35, 0.62, 0, 0);
      ctx.globalAlpha = 0.9;
      if (d.flag === 'turkey') drawTurkeyFlag(ctx, PF_W, PF_H);
      else if (d.flag === 'scotland') drawSaltire(ctx, PF_W, PF_H);
      else if (d.flag === 'belgium') {
        // 黑黃紅直條
        ['#1a1a1a', '#fdda24', '#ef3340'].forEach(function (c, k) { ctx.fillStyle = c; ctx.fillRect(-PF_W / 2 + k * PF_W / 3, -PF_H / 2, PF_W / 3 + 0.5, PF_H); });
      }
      else drawNordicFlag(ctx, PF_W, PF_H, d);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.8;
      ctx.strokeRect(-PF_W / 2, -PF_H / 2, PF_W, PF_H);
      ctx.restore();
      // v1.30 玩家：沒有關卡的國家出現國旗就好，不用國名（name 留著給程式、測試看）
    });
  }

  function drawBackdrop(ctx) {
    Object.keys(WD.back).forEach(function (k) {
      // 新大陸：一律用跟關卡國同色系的灰綠（沒有沙漠色的國家）
      const eu = WD.id !== 'eu' || !!BACKDROP_EU[k];
      WD.back[k].shapes.forEach(function (sh) {
        poly(ctx, sh);
        ctx.fillStyle = eu ? PAL.euFill : PAL.bgFill;
        ctx.fill();
        ctx.strokeStyle = eu ? PAL.euEdge : PAL.bgEdge;
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
      ctx.fillStyle = st === 'done' ? (PAL.bossDone || '#8fe3a0') : '#e0526b';
      ctx.beginPath();
      ctx.arc(x, y - 28 + bob, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 底座
    ctx.fillStyle = st === 'locked' ? (PAL.lockedPin || '#79839a') : (st === 'done' ? (PAL.donePin || '#8fe3a0') : '#ffd166');
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(12,18,30,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.stroke();

    if (st === 'done') {
      ctx.strokeStyle = PAL.doneCheck || '#17331f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 2.5, y); ctx.lineTo(x - 0.5, y + 2); ctx.lineTo(x + 3, y - 2.5);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** 國名印在國土上：字小一點、描邊細一點，像地圖上的印刷字而不是浮標 */
  function drawLabel(ctx, n, lv, st, selected) {
    const color = st === 'locked' ? (PAL.labelLocked || '#aeb6c8') : (selected ? (PAL.labelSel || '#ffd166') : (PAL.label || '#f2f5fb'));
    U.text(ctx, lv.country, n.label[0], n.label[1], {
      size: selected ? LABEL_SIZE_SEL : LABEL_SIZE,
      color: color,
      align: 'center',
      strokeWidth: 3,
      strokeColor: PAL.labelStroke || 'rgba(16, 24, 18, 0.7)'
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
    // v1.30：地圖往西延伸到冰島
    { name: '格陵蘭海', lon: -10, lat: 70.2, size: 12 },
    { name: '丹麥海峽', lon: -24.5, lat: 67.6, size: 10, angle: -0.5 },
    { name: '巴倫支海', lon: 38, lat: 71, size: 13 },
    { name: '波的尼亞灣', lon: 20.5, lat: 62.8, size: 10, angle: -1.2 },
    { name: '紅海', lon: 38.5, lat: 20.5, size: 11, angle: -1.0 }
  ];

  /** 區域名稱（大而淡，像地圖上印的大字；還沒有關卡的標「篇章開發中」） */
  const REGIONS = [
    { name: '北　歐', lon: 17, lat: 65.5, size: 26 },
    { name: '非　洲', lon: 14, lat: 25, size: 30 },
    { name: '撒哈拉沙漠', lon: 2, lat: 22.5, size: 14 }
  ];

  // v1.31 新大陸
  const SEAS_AM = [
    { name: '加　勒　比　海', lon: -75, lat: 14.6, size: 20 },
    { name: '墨西哥灣', lon: -91, lat: 25.2, size: 15 },
    { name: '大　西　洋', lon: -38, lat: 10, size: 17, vertical: true },
    { name: '太　平　洋', lon: -92, lat: 4, size: 17, vertical: true },
    { name: '亞馬遜河口', lon: -46.5, lat: 1.6, size: 10 }
  ];
  const REGIONS_AM = [
    { name: '南　美　洲', lon: -60, lat: -17, size: 30 },
    { name: '中美洲', lon: -87.5, lat: 15.8, size: 13 },
    { name: '亞馬遜雨林', lon: -62, lat: -5, size: 14 },
    { name: '北　美　洲', lon: -94, lat: 31, size: 18 }
  ];

  function drawRegionNames(ctx) {
    (WD.id === 'eu' ? REGIONS : REGIONS_AM).forEach(function (r) {
      const p = project(r.lon, r.lat);
      const rc = PAL.region || 'rgba(246, 232, 196, 0.32)';
      U.text(ctx, r.name, p[0], p[1], { size: r.size, weight: 800, color: rc, stroke: false });
      if (r.sub) U.text(ctx, r.sub, p[0], p[1] + r.size * 0.9, { size: 12, color: rc, stroke: false });
    });
  }

  function drawSeaNames(ctx) {
    (WD.id === 'eu' ? SEAS : SEAS_AM).forEach(function (s) {
      const p = project(s.lon, s.lat);
      ctx.save();
      ctx.translate(p[0], p[1]);
      if (s.angle) ctx.rotate(s.angle);
      const opt = {
        size: s.size, weight: 500, color: PAL.seaName,
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
    // 特殊地點（葡萄牙商店、愛爾蘭裝備）蓋在背景國上面；opts.specialNear = 靠近的那個（高亮）
    drawSpecialLand(ctx, opts.specialNear);
    drawRegionNames(ctx);
    drawPaintedNations(ctx);
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
      // v1.31 南美（哥倫比亞、巴西）另外要美洲 EXP（gate: 'samerica'）
      const eastLock = regionLocked(lv.region) || (lv.gate ? regionLocked(lv.gate) : false);
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
        ctx.fillStyle = o.eastLock ? PAL.eastLocked
          : !o.open ? PAL.locked : (o.done ? PAL.done : PAL.open);
        ctx.fill();
        ctx.strokeStyle = o.selected ? '#ffd166'
          : (o.eastLock || !o.open) ? (PAL.lockedEdge || PAL.edge)
          : o.done ? (PAL.doneEdge || PAL.edge) : PAL.edge;
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
    // 羊皮紙：紙紋蓋在海和國土上、國名和圖釘之下（字要清楚）
    if (PAL.paper) { drawPaperGrain(ctx); drawCompass(ctx); }
    // v1.30：北歐的雷電結界（還沒解開時）、哥倫布出航後的美洲預告
    if (typeof Quests !== 'undefined' && WD.id === 'eu') { Quests.drawShield(ctx, t); Quests.drawMapExtras(ctx, t); }
    drawPaintedNations(ctx, true);
    // 呼叫端要夾在「國土」與「國名」之間畫的東西（航海模式的運河）
    if (opts.afterLand) opts.afterLand();
    if (opts.east) drawEastLabels(ctx, opts.east.unlocked);
    info.forEach(function (o) {
      drawLabel(ctx, o.n, o.lv, o.st, o.selected);
      if (o.eastLock) lockIcon(ctx, o.n.label[0], o.n.label[1] + 14);
    });
    drawSpecialLabels(ctx, opts.specialNear);
    info.forEach(function (o) { drawPin(ctx, o.n, o.lv, o.st, o.selected, t); });
    drawSpecialPins(ctx, opts.specialNear, t);
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
    /** v1.31 目前是哪一張地圖：'eu' 歐洲、'am' 新大陸 */
    world: function () { return WD.id; },
    /** 換地圖（換完要 Voyage.rebuild()）；回傳有沒有換 */
    useWorld: function (id) {
      if (!WORLDS[id] || WD.id === id) return false;
      WD = WORLDS[id];
      build();
      return true;
    },
    project: project,
    /** 這張地圖所有國界資料（Voyage 烘陸地格子用） */
    landSources: function () { return [WD.geo, WD.back]; },
    nations: nations,
    east: east,
    hitTestEast: hitTestEast,
    specials: specials,
    PALETTES: PALETTES,
    /** 首頁也要同一張羊皮紙（v1.29.10）：在 (x, y, w, h) 蓋紙紋＋燒黃暈邊（畫面座標） */
    paperOverlay: function (ctx, x, y, w, h) {
      const pat = paperPattern(ctx);
      ctx.save();
      if (pat) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.5; ctx.fillStyle = pat; ctx.fillRect(x, y, w, h); }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      const g = ctx.createRadialGradient(x + w / 2, y + h / 2, h * 0.45, x + w / 2, y + h / 2, w * 0.62);
      g.addColorStop(0, 'rgba(120, 70, 20, 0)');
      g.addColorStop(1, 'rgba(110, 60, 15, 0.32)');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      ctx.restore();
    },
    setPalette: function (name) { if (PALETTES[name]) PAL = PALETTES[name]; return !!PALETTES[name]; },
    nearSpecial: nearSpecial,
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
