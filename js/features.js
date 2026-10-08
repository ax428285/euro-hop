'use strict';

/**
 * 橫向關卡的「招牌機制」。
 *
 * 五個橫向關卡原本都是同一個產生器鋪出來的：地面、斷崖、兩層平台、
 * 移動平台、敵人 —— 換了皮，但玩起來差不多。這裡每國給一個只有那裡才有的機制，
 * 讓每一關中段都有一段「不一樣的事」：
 *
 *   stampede  西班牙  奔牛：中段一群公牛從後面衝過來，要一路往前跑或躲上平台
 *   bouncers  法國    咖啡館遮陽篷彈跳墊：踩上去彈很高，空中有額外金幣
 *   barrels   德國    滾動啤酒桶：從前方山坡滾下來，跳過去或踩碎
 *   dark      波蘭    維利奇卡鹽礦：一段漆黑的礦坑，只看得到自己身邊和礦燈
 *   geysers   匈牙利  溫泉間歇泉：定時噴發，站上去會被衝上天（可以拿來飛越河面）
 *   （東歐、非洲篇的見 plan 裡各段註解）
 *   bricks    丹麥    樂高積木階梯：紅、藍積木輪流出現，要抓節奏往上跳
 *   ice       瑞典    結冰的湖面：加速慢、放開還會滑
 *   floes     挪威    冰海水道上的浮冰：會漂、站上去會下沉
 *   aurora    芬蘭    極夜：一片漆黑，極光亮起來才看得清楚
 *   （v1.31 美洲篇）
 *   waves     古巴    馬雷貢海堤的大浪：浪頭先在堤後捲起來，接著整片拍上路面（跳起來躲）
 *   pourover  牙買加  手沖咖啡：巨大的細口壺定時傾斜、沖下熱水柱（會燙）；底下濾杯裡的咖啡粉一吸水就「悶蒸」膨脹，
 *                     把站在上面的人往上托（拿高處的金幣）—— 要站在水柱旁邊，不能站在正中間
 *   speakers  （v1.31 試做的雷鬼音響，目前沒有關卡用）
 *   locks     巴拿馬  運河船閘：閘室中間一道閘門牆跳不過去，兩側的小船交替升降，搭升起來的船翻過閘門
 *   ropes     哥倫比亞 海盜盪繩：寬水道上方掛著來回盪的繩子，跳起來抓住、盪到前面按跳躍放手飛過去
 *
 * 規劃（plan）在關卡定義時用固定 seed 跑，結果可重現、可測試；
 * 執行期（update）每帧處理碰撞，事件格式跟玩家事件一樣帶 'p0:' 前綴。
 *
 * 載入順序：要在 levelgen.js 之後、levels.js 之前（levels.js 定義關卡時就要 plan）。
 */
const Features = (function () {

  const BULL_SPEED = 3.7;        // 比玩家最高跑速 4.6 慢：一直往前跑一定跑得掉
  const BULL_H = 46, BULL_W = 170;
  const PAD_V = -16.5;           // 彈跳墊初速（約彈起 220px）
  const GEYSER_V = -17;
  const GEYSER_CYCLE = 170;
  const BARREL_SPEED = 2.4;
  const BARREL_R = 15;

  // ── 規劃 ───────────────────────────────────────────────

  /**
   * 在地面上找一個「頭上淨空」的位置。
   * 彈跳墊、間歇泉會把人往上送，頭上有平台就會撞頭彈回來，所以那一欄要空。
   */
  function clearSpot(ctx, x, w, headroom) {
    const s = ctx.segs.filter(function (g) { return x >= g.x + 40 && x + w <= g.x + g.w - 40; })[0];
    if (!s) return null;
    const col = { x: x - 20, y: s.y - headroom, w: w + 40, h: headroom };
    const blocked = ctx.platforms.concat(ctx.avoid).some(function (b) {
      return col.x < b.x + b.w && col.x + col.w > b.x && col.y < b.y + b.h && col.y + col.h > b.y;
    });
    if (blocked) return null;
    if (Math.abs(x - ctx.goal) < 260) return null;
    return { x: x, y: s.y, seg: s };
  }

  /**
   * v1.31：寬水道（巴拿馬船閘、哥倫比亞盪繩）上方不能有浮空平台 —— 不然踩平台就過去了，用不到船、繩子。
   * 水道兩側各多清 40px，之後的機制、金幣也不會再放進來（ctx.avoid）。
   */
  function clearChannel(ctx, g) {
    const zone = { x: g.x - 40, y: 0, w: g.w + 80, h: 600 };
    for (let i = ctx.platforms.length - 1; i >= 0; i--) {
      const q = ctx.platforms[i];
      if (q.x < zone.x + zone.w && q.x + q.w > zone.x) ctx.platforms.splice(i, 1);
    }
    ctx.avoid.push(zone);
    (ctx.cleared || (ctx.cleared = [])).push(zone);
  }

  /** 從偏好位置往兩側找第一個合格點 */
  function findSpot(ctx, prefer, w, headroom, force) {
    for (let d = 0; d < 1600; d += 20) {
      for (const sgn of [1, -1]) {
        const sp = (force ? forceSpot : clearSpot)(ctx, Math.round(prefer + sgn * d), w, headroom);
        if (sp) return sp;
      }
    }
    return null;
  }

  /**
   * 跟 clearSpot 一樣，但頭上的浮空平台不算阻擋 —— 找到後把那一欄的平台拿掉。
   * 駱駝、石柱要一大片平地（380~460 寬），平地關卡兩層平台幾乎蓋滿，照 clearSpot 的規則一整關只放得下 1 隻。
   * 駝峰上的人頭頂 ≈ 地面上 100px，剛好撞到第一層平台（92），所以那一欄的平台本來就得拿掉。
   * （平台上的金幣會留在空中，玩家跳起來一樣吃得到）
   */
  function forceSpot(ctx, x, w, headroom) {
    const s = ctx.segs.filter(function (g) { return x >= g.x + 40 && x + w <= g.x + g.w - 40; })[0];
    if (!s) return null;
    const col = { x: x - 20, y: s.y - headroom, w: w + 40, h: headroom };
    const hit = function (b) { return col.x < b.x + b.w && col.x + col.w > b.x && col.y < b.y + b.h && col.y + col.h > b.y; };
    if (ctx.avoid.some(hit)) return null;
    if (Math.abs(x - ctx.goal) < 260 || x + w > ctx.goal - 200) return null;
    for (let i = ctx.platforms.length - 1; i >= 0; i--) if (hit(ctx.platforms[i])) ctx.platforms.splice(i, 1);
    return { x: x, y: s.y, seg: s };
  }

  /** 一串往上排的金幣（彈跳／間歇泉的獎勵） */
  function coinColumn(x, groundY, from, to, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ x: Math.round(x - 12), y: Math.round(groundY - from - (to - from) * i / (n - 1)) });
    }
    return out;
  }

  /**
   * cfg 例：{ type: 'bouncers', count: 4 }
   * ctx：{ segs, gaps, platforms, width, goal, avoid }
   * 回傳 { list: [...], coins: [...] }（coins 要併進關卡金幣）
   */
  function plan(cfgs, ctx) {
    const list = [], coins = [];
    let goalPlat = null;
    (cfgs || []).forEach(function (c) {
      const W = ctx.width;
      if (c.type === 'stampede') {
        list.push({ type: 'stampede', x0: Math.round(W * (c.from || 0.42)), x1: Math.round(W * (c.to || 0.64)) });
      } else if (c.type === 'bouncers') {
        const n = c.count || 4;
        for (let i = 0; i < n; i++) {
          const sp = findSpot(ctx, W * (0.15 + 0.7 * i / Math.max(1, n - 1)), 56, 300);
          if (!sp) continue;
          list.push({ type: 'pad', x: sp.x, y: sp.y, w: 56, h: 10 });
          ctx.avoid.push({ x: sp.x - 60, y: 0, w: 176, h: 600 });
          coinColumn(sp.x + 28, sp.y, 130, 250, 4).forEach(function (q) { coins.push(q); });
        }
      } else if (c.type === 'barrels') {
        list.push({ type: 'barrels', x0: Math.round(W * 0.15), x1: Math.round(W * 0.85), every: c.every || 190 });
      } else if (c.type === 'dark') {
        const x0 = Math.round(W * (c.from || 0.5)), x1 = Math.round(W * (c.to || 0.7));
        const lamps = [];
        for (let x = x0 + 160; x < x1 - 80; x += 300) lamps.push(x);
        list.push({ type: 'dark', x0: x0, x1: x1, lamps: lamps });
      } else if (c.type === 'geysers') {
        // 優先放在斷崖（河面）前：噴起來剛好可以飛過去
        const prefers = ctx.gaps.map(function (g) { return g.x - 70; });
        const n = c.count || 4;
        for (let i = 0; i < n; i++) {
          const pref = prefers[Math.floor((i + 0.5) * prefers.length / n)] || W * (0.2 + 0.6 * i / n);
          const sp = findSpot(ctx, pref, 40, 300);
          if (!sp) continue;
          list.push({ type: 'geyser', x: sp.x, y: sp.y, w: 40, phase: i * 47 });
          ctx.avoid.push({ x: sp.x - 60, y: 0, w: 160, h: 600 });
          coinColumn(sp.x + 20, sp.y, 160, 260, 3).forEach(function (q) { coins.push(q); });
        }
      } else if (c.type === 'gusts') {
        // 斯洛伐克：塔特拉山風。一段區間內週期性起逆風
        list.push({ type: 'gusts', x0: Math.round(W * (c.from || 0.3)), x1: Math.round(W * (c.to || 0.8)) });
      } else if (c.type === 'cannons') {
        // 克羅埃西亞：杜布羅夫尼克城牆的砲台往城外砲擊
        list.push({ type: 'cannons', x0: Math.round(W * (c.from || 0.25)), x1: Math.round(W * (c.to || 0.85)), every: c.every || 130 });
      } else if (c.type === 'bridges') {
        // 塞爾維亞：河上的舊木橋。挑夠寬的斷崖架橋，踩上去一會兒就塌
        ctx.gaps.filter(function (g) { return g.w >= 90 && Math.abs(g.x - ctx.goal) > 300; })
          .slice(0, c.count || 6).forEach(function (g) {
            const ly = LevelGen.groundAt(ctx.segs, g.x - 4);
            const ry = LevelGen.groundAt(ctx.segs, g.x + g.w + 4);
            if (ly == null || ry == null || Math.abs(ly - ry) > 2) return;   // 只架在兩岸一樣高的斷崖
            list.push({ type: 'bridge', x: g.x - 6, y: ly, w: g.w + 12, h: 12 });
          });
      } else if (c.type === 'quicksand') {
        // 摩洛哥：撒哈拉流沙。平地上幾片沙坑，踩進去會變慢、跳不高、越陷越深
        const n = c.count || 6;
        for (let i = 0; i < n; i++) {
          const sp = findSpot(ctx, W * (0.12 + 0.76 * i / Math.max(1, n - 1)), SAND_W, 60);
          if (!sp || sp.x < 700) continue;
          list.push({ type: 'sand', x: sp.x, y: sp.y, w: SAND_W });
          ctx.avoid.push({ x: sp.x - 100, y: 0, w: SAND_W + 200, h: 600 });
        }
      } else if (c.type === 'sandstorm') {
        // 阿爾及利亞：撒哈拉沙塵暴。一段區間內週期性起逆風＋黃沙蓋住畫面
        list.push({ type: 'sandstorm', x0: Math.round(W * (c.from || 0.25)), x1: Math.round(W * (c.to || 0.85)) });
      } else if (c.type === 'camels') {
        /*
         * 突尼西亞：杰里德鹽湖。平地上幾大片鹽泥（比摩洛哥流沙寬、陷得快），
         * 每片配一隻駱駝在湖兩岸之間來回走，駝峰是會移動的平台（站上去會被載著走）。
         */
        const n = c.count || 4;
        for (let i = 0; i < n; i++) {
          const sp = findSpot(ctx, W * (0.14 + 0.72 * i / Math.max(1, n - 1)), BRINE_W + 2 * CAMEL_MARGIN, 120, true);
          if (!sp || sp.x < 700) continue;
          const sx = sp.x + CAMEL_MARGIN;
          // 駱駝先放（feature-check 用第一個的 type 判斷各國招牌不重複；鹽泥跟摩洛哥同是 sand）
          list.push({ type: 'camel', x0: sp.x - 10, x1: sp.x + BRINE_W + 2 * CAMEL_MARGIN - CAMEL_W + 10, y: sp.y, phase: i * 97 });
          list.push({ type: 'sand', x: sx, y: sp.y, w: BRINE_W, brine: true, limit: BRINE_LIMIT });
          ctx.avoid.push({ x: sp.x - 100, y: 0, w: BRINE_W + 2 * CAMEL_MARGIN + 200, h: 600 });
        }
      } else if (c.type === 'flood') {
        /*
         * 淹水段（v1.25.1 玩家：上一版亞特蘭提斯的橫向游泳很有創意，移植到現有的某一關）：
         * 一段地形整個泡在海裡，進到水裡就換潛水物理（跳躍 = 往上游、慢慢下沉），頭上有空氣計，
         * 裡面放幾個氣泡噴口。出了水面就是一般物理、空氣馬上補滿。
         */
        const x0 = Math.round(W * (c.from || 0.7)), x1 = Math.round(W * (c.to || 0.88));
        // ⚠️ 不能用 Levels.GROUND_Y：規劃時 levels.js 還在定義關卡，Levels 還不存在 → 用這段地面的高度
        const gy = LevelGen.groundAt(ctx.segs, x0) || ctx.segs[0].y;
        list.push({ type: 'flood', x0: x0, x1: x1, top: gy - (c.depth || 250) });
        for (let x = x0 + 380; x < x1 - 200; x += 560) {
          const sp = findSpot(ctx, x, 40, 60);
          if (!sp || sp.x <= x0 || sp.x >= x1 - 60) continue;
          if (list.some(function (q) { return q.type === 'vent' && Math.abs(q.x - sp.x) < 300; })) continue;   // 兩個噴口不要擠在一起
          list.push({ type: 'vent', x: sp.x, y: sp.y, w: 40 });
        }
      } else if (c.type === 'currents') {
        /*
         * 沉船潛水：暗流。關卡裡三段，方向交替（逆流、順流、逆流），水流把人往一個方向推。
         * 逆流段要貼著海底走（海底水流比較慢：推力只剩一半），或趁空檔游過去。
         */
        [[0.22, 0.34, -1], [0.46, 0.56, 1], [0.66, 0.8, -1]].forEach(function (z) {
          list.push({ type: 'current', x0: Math.round(W * z[0]), x1: Math.round(W * z[1]), dir: z[2] });
        });
      } else if (c.type === 'clams') {
        // 巨蚌：躺在海床上一開一合，合起來的瞬間夾到會痛；張開時裡面有珍珠（金幣）
        const n = c.count || 6;
        for (let i = 0; i < n; i++) {
          const sp = findSpot(ctx, W * (0.12 + 0.76 * i / Math.max(1, n - 1)), 56, 50);
          if (!sp || sp.x < 700) continue;
          list.push({ type: 'clam', x: sp.x, y: sp.y, w: 56, phase: (i * 61) % CLAM_CYCLE });
          ctx.avoid.push({ x: sp.x - 60, y: 0, w: 176, h: 600 });
        }
      } else if (c.type === 'relics') {
        /*
         * 沉船的寶物：三件放在沿路比較難拿的地方（高處平台上，或斷崖另一邊的海底），
         * 第四件（安提基特拉機械）在終點，過關自動拿到。
         */
        /*
         * 三件都不在「直直往前游」的路線上（v1.26 測試機器人一路往右就全撿到了，等於不用找）：
         *   陶罐     靠近水面的高處 —— 要特地往上游
         *   青銅頭像 斷崖坑底、尖刺正上方 —— 要潛下去再游上來
         *   銀幣     第三段逆流的正中間高處 —— 要頂著水流游過去
         */
        const surfaceY = 78;
        list.push({ type: 'relic', id: 'amphora', x: Math.round(W * 0.27), y: surfaceY, w: 28, h: 28 });
        const pit = ctx.gaps.filter(function (g) { return g.w >= 70 && g.x > W * 0.45 && g.x < W * 0.62; })[0] ||
                    ctx.gaps.filter(function (g) { return g.w >= 60 && g.x > W * 0.4; })[0];
        if (pit) {
          const gy = LevelGen.groundAt(ctx.segs, pit.x - 4) || ctx.segs[0].y;
          list.push({ type: 'relic', id: 'philosopher', x: Math.round(pit.x + pit.w / 2 - 14), y: gy + 2, w: 28, h: 28 });
        }
        list.push({ type: 'relic', id: 'coin', x: Math.round(W * 0.73), y: 110, w: 28, h: 28 });
      } else if (c.type === 'air') {
        /*
         * 亞特蘭提斯（潛水）：海底的氣泡噴口，每隔 VENT_EVERY 一個。
         * 空氣滿格撐 AIR_MAX 帧（14 秒），潛水橫移約 3px/帧 → 兩個噴口之間 5 秒左右，夠用；
         * 但在一個地方繞太久、或掉進坑裡慢慢游，就要記得回去補氣。
         */
        for (let x = 520; x < ctx.goal - 150; x += VENT_EVERY) {
          const sp = findSpot(ctx, x, 40, 160);
          if (!sp || list.some(function (f) { return f.type === 'vent' && Math.abs(f.x - sp.x) < 300; })) continue;
          list.push({ type: 'vent', x: sp.x, y: sp.y, w: 40 });
        }
      } else if (c.type === 'mounts') {
        /*
         * 非洲關的駱駝坐騎（v1.23.1 玩家要求）：路邊趴著一隻駱駝，碰一下就騎上去。
         * 騎著：跑快 30%、跳高 10%、不會陷進流沙／鹽泥、不怕沙塵暴；
         * 被打到 → 駱駝嚇跑（不扣血，像耀西那樣）。駱駝跑掉一陣子後會回到原地。
         */
        (c.at || [0.35]).forEach(function (k) {
          const sp = findSpot(ctx, W * k, MOUNT_W, 70);
          if (!sp) return;
          list.push({ type: 'mount', x: sp.x, y: sp.y, w: MOUNT_W });
          ctx.avoid.push({ x: sp.x - 60, y: 0, w: MOUNT_W + 120, h: 600 });
        });
      } else if (c.type === 'columns') {
        // 利比亞：羅馬古城的石柱，靠近就倒（倒向玩家走來的方向 = 左邊）
        const n = c.count || 6;
        for (let i = 0; i < n; i++) {
          const sp = findSpot(ctx, W * (0.12 + 0.76 * i / Math.max(1, n - 1)), COL_FALL + 40, COL_H + 30, true);
          if (!sp || sp.x < 700) continue;
          list.push({ type: 'column', x: sp.x + COL_FALL + 20, y: sp.y });
          ctx.avoid.push({ x: sp.x - 80, y: 0, w: COL_FALL + 200, h: 600 });
        }
      } else if (c.type === 'bricks' && c.toGoal) {
        /*
         * v1.30 挪威（玩家：加紅藍消失積木，關卡一樣橫向，終點在右上角高處）：
         * 終點改放在一座高台上（離地 258），只能踩三塊紅藍輪流出現的積木上去。
         * 高台底下那一欄的浮空平台拿掉（不然直接從平台跳上去就不用抓節奏了）。
         */
        const gy = LevelGen.groundAt(ctx.segs, ctx.goal) || ctx.segs[ctx.segs.length - 1].y;
        const px = ctx.goal - 60;
        for (let k = 0; k < 3; k++) {
          list.push({ type: 'brick', x: px - (3 - k) * BRICK_STEP, y: gy - 66 - k * BRICK_RISE, w: BRICK_W, h: BRICK_H,
                      color: k % 2, phase: 0, passThru: true, finale: true });
        }
        goalPlat = { x: px, y: gy - 66 - 3 * BRICK_RISE, w: 220, h: 18, goalPlat: true };
        const zone = { x: px - 3 * BRICK_STEP - 40, y: 0, w: 3 * BRICK_STEP + 300, h: gy };
        for (let i = ctx.platforms.length - 1; i >= 0; i--) {
          const q = ctx.platforms[i];
          if (q.x < zone.x + zone.w && q.x + q.w > zone.x && q.y < zone.y + zone.h) ctx.platforms.splice(i, 1);
        }
        ctx.avoid.push(zone);
        // 每塊積木上方一枚金幣（終點後面不放東西，所以放在階梯上）
        for (let k = 0; k < 3; k++) coins.push({ x: px - (3 - k) * BRICK_STEP + 20, y: gy - 66 - k * BRICK_RISE - 36 });
      } else if (c.type === 'bricks') {
        /*
         * 丹麥：樂高積木階梯。每座三塊積木往右上排（離地 66 / 130 / 194），紅藍交錯；
         * 紅色亮著的時候藍色是虛線框（踩不到），一段時間後交換 —— 要抓「換色的那一下」跳過去。
         * 最上面那塊頂上有一排金幣。整座要一大片頭頂淨空：那一欄的浮空平台拿掉（forceSpot）。
         */
        const n = c.count || 5;
        for (let i = 0; i < n; i++) {
          const sp = findSpot(ctx, W * (0.14 + 0.72 * i / Math.max(1, n - 1)), BRICK_STEP * 2 + BRICK_W, BRICK_RISE * 3 + 70, true);
          if (!sp || sp.x < 700) continue;
          for (let k = 0; k < 3; k++) {
            list.push({ type: 'brick', x: sp.x + k * BRICK_STEP, y: sp.y - 66 - k * BRICK_RISE, w: BRICK_W, h: BRICK_H,
                        color: k % 2, phase: (i * 53) % BRICK_CYCLE, passThru: true });
          }
          const top = sp.y - 66 - 2 * BRICK_RISE;
          for (let q = 0; q < 3; q++) coins.push({ x: sp.x + 2 * BRICK_STEP + 4 + q * 20, y: top - 36 });
          ctx.avoid.push({ x: sp.x - 60, y: 0, w: BRICK_STEP * 2 + BRICK_W + 120, h: 600 });
        }
      } else if (c.type === 'ice') {
        // 瑞典：結冰的湖面。幾段區間內的地面是冰（只算地面，浮空平台照舊）
        (c.zones || [[0.3, 0.6]]).forEach(function (z) {
          list.push({ type: 'ice', x0: Math.round(W * z[0]), x1: Math.round(W * z[1]) });
        });
      } else if (c.type === 'floes') {
        /*
         * 挪威：冰海水道（Levels cfg.channels 拓寬過的斷崖，gap.channel）上放浮冰。
         * 一道水放 2 塊，同一道水的浮冰一起漂（間距固定 ≈ 86，跳得過）；離岸的距離會變（19~67）。
         */
        ctx.gaps.filter(function (g) { return g.channel; }).forEach(function (g, gi) {
          const ly = LevelGen.groundAt(ctx.segs, g.x - 4);
          const n = Math.max(1, Math.round((g.w - 40) / 130));
          const amp = Math.max(0, Math.min(FLOE_AMP, (g.w / n - FLOE_W) / 2 - 8));
          for (let k = 0; k < n; k++) {
            const cx = g.x + g.w * (k + 0.5) / n;
            list.push({ type: 'floe', x: Math.round(cx - FLOE_W / 2), bx: Math.round(cx - FLOE_W / 2), by: ly + FLOE_DROP, w: FLOE_W, amp: amp, phase: gi * 97 });
            coins.push({ x: Math.round(cx - 12), y: ly - 70 });
          }
        });
      } else if (c.type === 'pourover') {
        // 牙買加：手沖咖啡。濾杯頭上要淨空（咖啡粉會把人托上去），上面放一排要靠悶蒸才拿得到的金幣
        const n = c.count || 4;
        for (let i = 0; i < n; i++) {
          const sp = findSpot(ctx, W * (0.16 + 0.68 * i / Math.max(1, n - 1)), POUR_W, 380);
          if (!sp) continue;
          list.push({ type: 'pourover', x: sp.x, y: sp.y, w: POUR_W, phase: (i * 71) % POUR_CYCLE });
          ctx.avoid.push({ x: sp.x - 80, y: 0, w: POUR_W + 160, h: 600 });
          // 金幣在濾杯的兩側上方（水柱在正中間）
          [0.18, 0.82].forEach(function (k) {
            coinColumn(sp.x + POUR_W * k, sp.y - POUR_BASE, 150, 250, 3).forEach(function (q) { coins.push(q); });
          });
        }
      } else if (c.type === 'speakers') {
        // 牙買加：雷鬼音響。跟彈跳墊一樣頭上要淨空、上面放金幣，但只有節拍到的那一下才會彈
        const n = c.count || 5;
        for (let i = 0; i < n; i++) {
          const sp = findSpot(ctx, W * (0.15 + 0.7 * i / Math.max(1, n - 1)), 60, 320);
          if (!sp) continue;
          list.push({ type: 'beatpad', x: sp.x, y: sp.y, w: 60, h: 12, phase: (i * 23) % BEAT_PERIOD });
          ctx.avoid.push({ x: sp.x - 60, y: 0, w: 180, h: 600 });
          coinColumn(sp.x + 30, sp.y, 150, 280, 4).forEach(function (q) { coins.push(q); });
        }
      } else if (c.type === 'ropes') {
        /*
         * 哥倫比亞：海盜盪繩。每一道寬水道（cfg.channels，約 300 寬，跳不過去）正上方吊一條繩子，
         * 一直來回盪（ROPE_PERIOD、擺幅 ROPE_AMP）。跳起來碰到繩尾的把手就抓住，按跳躍放手 ——
         * 放手時帶著繩子盪的速度飛出去：盪到正中間往前衝的那一下放手最遠。
         */
        ctx.gaps.filter(function (g) { return g.channel; }).forEach(function (g, gi) {
          clearChannel(ctx, g);
          const ly = LevelGen.groundAt(ctx.segs, g.x - 4);
          list.push({ type: 'rope', ax: Math.round(g.x + g.w / 2), ay: ly - ROPE_TOP, len: ROPE_LEN, gx: g.x, gw: g.w,
                      x: Math.round(g.x + g.w / 2), phase: gi * 50 });
          coins.push({ x: Math.round(g.x + g.w / 2 - 12), y: ly - 120 });
        });
      } else if (c.type === 'waves') {
        // 古巴：馬雷貢海堤的大浪。每一段各自有節奏（phase 錯開），不會三段同時打上來
        (c.zones || [[0.3, 0.5]]).forEach(function (z, i) {
          list.push({ type: 'waves', x0: Math.round(W * z[0]), x1: Math.round(W * z[1]), phase: i * 83 });
        });
      } else if (c.type === 'locks') {
        /*
         * 巴拿馬：運河船閘。每一道閘室（cfg.channels 拓寬過的斷崖，gap.channel）正中間有一道閘門牆，
         * 頂端比岸高 GATE_H（跳不過去）；牆的兩側各一艘小船，像升降梯一樣交替升降（週期 LOCK_PERIOD）：
         * 最低跟岸一樣高、最高比岸高 LOCK_RISE（比閘門還高）。
         * 搭左邊的船升上去 → 翻過閘門跳到右邊（右邊的船這時剛好降到底）→ 走上對岸。
         */
        ctx.gaps.filter(function (g) { return g.channel; }).forEach(function (g, gi) {
          clearChannel(ctx, g);
          const ly = LevelGen.groundAt(ctx.segs, g.x - 4);
          const gx = Math.round(g.x + g.w / 2 - GATE_W / 2);
          const bw = Math.round((g.w - GATE_W) / 2 - 18);
          list.push({ type: 'lockGate', x: gx, y: ly - GATE_H, w: GATE_W, h: GATE_H + 120, gy: ly });
          [0, 1].forEach(function (side) {
            const bx = side === 0 ? g.x + 10 : gx + GATE_W + 8;
            list.push({ type: 'lock', x: bx, y: ly, w: bw, gx: side === 0 ? g.x : gx + GATE_W, gw: side === 0 ? gx - g.x : g.x + g.w - gx - GATE_W,
                        phase: gi * 140 + side * LOCK_PERIOD / 2, side: side });
          });
          coins.push({ x: gx - 5, y: ly - GATE_H - 60 });
        });
      } else if (c.type === 'aurora') {
        // 芬蘭：極夜。一段區間整片黑，極光週期性亮起
        list.push({ type: 'aurora', x0: Math.round(W * (c.from || 0.3)), x1: Math.round(W * (c.to || 0.8)) });
      } else if (c.type === 'thorns') {
        // 保加利亞：玫瑰荊棘，定時從地裡冒出來
        const n = c.count || 8;
        for (let i = 0; i < n; i++) {
          const sp = findSpot(ctx, W * (0.12 + 0.76 * i / Math.max(1, n - 1)), 80, 40);
          if (!sp || sp.x < 700) continue;
          list.push({ type: 'thorn', x: sp.x, y: sp.y, w: 80, phase: (i * 53) % 150 });
          ctx.avoid.push({ x: sp.x - 120, y: 0, w: 320, h: 600 });
        }
      }
    });
    return { list: list, coins: coins, goalPlat: goalPlat, cleared: ctx.cleared || [] };
  }

  /*
   * 流沙（摩洛哥）：站在裡面每帧水平速度只剩 55%、起跳初速 ×0.7，
   * 身體慢慢往下陷（畫面上沙子淹到腳），陷滿 SAND_LIMIT 帧就受傷、被彈出來。
   * 全速走過 120px 寬的沙坑約 50 帧，遠低於 150 —— 一直走就不會受傷，停在裡面才會。
   */
  const SAND_W = 120;
  const SAND_LIMIT = 150;
  const SAND_MAX_RUN = 2.3;

  /*
   * 鹽湖（突尼西亞）：鹽泥比流沙寬、陷得快一倍 —— 硬走過去一定受傷一次，
   * 正解是等駱駝靠岸、跳上駝峰讓牠載過去（或用二段跳飛過去）。
   */
  const BRINE_W = 200;
  const BRINE_LIMIT = 70;
  const CAMEL_W = 84;
  const CAMEL_MARGIN = 60;    // 湖兩岸各留多少乾地給駱駝停
  const CAMEL_SPEED = 1.3;
  const CAMEL_PAUSE = 80;     // 靠岸停多久（給玩家上下駱駝）
  const HUMP_Y = 58;          // 駝峰頂離地多高
  /*
   * 石柱（利比亞）：玩家走到柱子左邊 COL_TRIGGER 內 → 搖晃 COL_SHAKE 帧 → 往左倒（COL_DROP 帧）。
   * 倒下時壓在左邊 COL_FALL 寬的地上；倒完變成一道矮牆（可以踩、要跳過）。
   * 全速跑過 200px 約 43 帧 < 45：反應快可以衝過去，不然就停下來等它倒。
   */
  const COL_H = 150;
  const COL_FALL = 150;
  const COL_TRIGGER = 200;
  const COL_SHAKE = 45;
  const COL_DROP = 22;
  const COL_LYING_H = 22;
  // 沉船潛水：暗流、巨蚌
  const CURRENT_PUSH = 1.5;
  const CLAM_CYCLE = 170;     // 張開 120 → 合起來 50
  // 潛水的空氣
  const AIR_MAX = 840;
  const VENT_EVERY = 820;
  const VENT_H = 230;          // 噴口往上冒的氣泡柱有多高（碰到就補氣）
  // 駱駝坐騎
  const MOUNT_W = 90;
  const MOUNT_RESPAWN = 300;   // 駱駝跑掉後多久回到原地
  // 沙塵暴（阿爾及利亞）
  const STORM_CYCLE = 440;    // 安靜 220 → 預告 60 → 颳 160
  const STORM_PUSH = 0.8;

  /** 阿爾及利亞沙塵暴：這一帧的狀態，以及黃沙濃度 0~1（預告時慢慢變濃、颳完慢慢散） */
  function stormState(t) {
    const k = t % STORM_CYCLE;
    if (k < 220) return { state: 'calm', haze: k < 30 ? 1 - k / 30 : 0 };
    if (k < 280) return { state: 'warn', haze: (k - 220) / 60 * 0.6 };
    return { state: 'blow', haze: Math.min(1, 0.6 + (k - 280) / 30 * 0.4) };
  }

  /** 突尼西亞駱駝：用時間直接算位置（停左岸 → 走到右岸 → 停 → 走回來），結果可重現 */
  function camelX(f, t) {
    const walk = (f.x1 - f.x0) / CAMEL_SPEED;
    const period = 2 * (CAMEL_PAUSE + walk);
    const k = (t + f.phase) % period;
    if (k < CAMEL_PAUSE) return { x: f.x0, dir: 1, moving: false };
    if (k < CAMEL_PAUSE + walk) return { x: f.x0 + (k - CAMEL_PAUSE) * CAMEL_SPEED, dir: 1, moving: true };
    if (k < 2 * CAMEL_PAUSE + walk) return { x: f.x1, dir: -1, moving: false };
    return { x: f.x1 - (k - 2 * CAMEL_PAUSE - walk) * CAMEL_SPEED, dir: -1, moving: true };
  }

  /*
   * 樂高積木（丹麥）：一輪 BRICK_CYCLE 帧，前半紅色在、後半藍色在；要消失前 BRICK_WARN 帧開始閃。
   * 跳一次滯空約 40 帧：站在紅色上看它開始閃就起跳，落下時剛好換成藍色。
   */
  const BRICK_W = 64, BRICK_H = 18, BRICK_STEP = 84, BRICK_RISE = 64;
  const BRICK_CYCLE = 220, BRICK_WARN = 44;
  /** 這塊積木這一帧在不在（樂高積木裝備：一直都在） */
  function brickState(f, t) {
    const k = (t + f.phase) % BRICK_CYCLE, half = BRICK_CYCLE / 2;
    const on = f.color === 0 ? k < half : k >= half;
    const left = f.color === 0 ? half - k : BRICK_CYCLE - k;      // 亮著的話，再幾帧就要消失
    return { on: on, warn: on && left <= BRICK_WARN, left: on ? left : 0 };
  }
  /*
   * 浮冰（挪威）：在水道裡左右漂（週期 FLOE_PERIOD）。有人站上去 FLOE_GRACE 帧後開始往下沉，
   * 每帧沉 FLOE_SINK；浮冰頂比岸低 FLOE_DROP，水面比岸低 12 —— 沉超過 9px 腳就碰到水（掉進冰海）。
   * 從站上去算起大約 68 帧（1 秒多）就會落水：不能停，要一直往前跳。沒人站就慢慢浮回來。
   */
  const FLOE_W = 64, FLOE_DROP = 3, FLOE_AMP = 24, FLOE_PERIOD = 260;
  const FLOE_GRACE = 18, FLOE_SINK = 0.18, FLOE_RISE = 0.35, FLOE_MAX = 16;
  function floeX(f, t) { return f.bx + Math.sin((t + f.phase) * Math.PI * 2 / FLOE_PERIOD) * f.amp; }

  /*
   * 古巴的大浪：週期 WAVE_CYCLE，前段平靜、接著 WAVE_WARN 帧浪頭在堤後捲起來（看得到、聽得到），
   * 最後 WAVE_HIT 帧整片拍上路面：腳底低於「路面 − WAVE_H」的人都會被打到（跳起來就躲得過）。
   */
  /*
   * 牙買加的手沖咖啡：週期 POUR_CYCLE。
   *   平常（idle）咖啡粉平平的，面在地上 POUR_BASE 高；
   *   壺開始傾斜、冒蒸氣 POUR_WARN 帧（預告）→ 沖水 POUR_TIME 帧（正中間的水柱會燙，咖啡粉一路膨脹往上 POUR_LIFT）→
   *   停一下 → 慢慢消下去。站在咖啡粉上的人會被托上去（box 是有 dy 的平台）。
   */
  const POUR_W = 132, POUR_BASE = 56, POUR_LIFT = 150, POUR_CYCLE = 330, POUR_WARN = 50, POUR_TIME = 80, POUR_HOLD = 50, POUR_STREAM = 16;
  function pourState(f, t) {
    const k = (t + f.phase) % POUR_CYCLE;
    const pourAt = POUR_CYCLE - POUR_TIME - POUR_HOLD - 60, warnAt = pourAt - POUR_WARN;
    let lift = 0;
    if (k >= pourAt && k < pourAt + POUR_TIME) lift = POUR_LIFT * (k - pourAt) / POUR_TIME;
    else if (k >= pourAt + POUR_TIME && k < pourAt + POUR_TIME + POUR_HOLD) lift = POUR_LIFT;
    else if (k >= pourAt + POUR_TIME + POUR_HOLD) lift = POUR_LIFT * (1 - (k - pourAt - POUR_TIME - POUR_HOLD) / 60);
    return { k: k, warn: k >= warnAt && k < pourAt, pour: k >= pourAt && k < pourAt + POUR_TIME, lift: lift, tilt: k >= warnAt && k < pourAt + POUR_TIME ? Math.min(1, (k - warnAt) / POUR_WARN) : 0 };
  }

  /*
   * 牙買加的雷鬼音響：每 BEAT_PERIOD 帧「咚」一下（BEAT_WINDOW 帧內站在上面的人被彈上去），
   * 節拍前 BEAT_WARN 帧喇叭上的紅黃綠燈一顆顆亮起來（準備）。初速比法國遮陽篷再高一點。
   */
  const BEAT_PERIOD = 80, BEAT_WINDOW = 8, BEAT_WARN = 24, BEAT_V = -17.2;
  function beatState(f, t) {
    const k = (t + f.phase) % BEAT_PERIOD;
    return { boom: k < BEAT_WINDOW, warn: k >= BEAT_PERIOD - BEAT_WARN, k: k };
  }
  /*
   * 哥倫比亞的盪繩：角度 θ = ROPE_AMP·sin(2π(t+phase)/ROPE_PERIOD)，把手在 (ax + len·sinθ, ay + len·cosθ)。
   * 錨點在岸上方 ROPE_TOP；擺到最邊時把手離岸約 30、離地約 130（從岸上跳得到）。
   */
  const ROPE_TOP = 250, ROPE_LEN = 168, ROPE_AMP = 0.78, ROPE_PERIOD = 150, ROPE_GRAB = 22;
  function ropeAngle(f, t) { return ROPE_AMP * Math.sin((t + f.phase) * Math.PI * 2 / ROPE_PERIOD); }
  function ropeHandle(f, t) {
    const a = ropeAngle(f, t);
    return { x: f.ax + f.len * Math.sin(a), y: f.ay + f.len * Math.cos(a), a: a };
  }
  /** 繩尾的切線速度（每帧 px） */
  function ropeVel(f, t) {
    const a = ropeAngle(f, t);
    const w = ROPE_AMP * (Math.PI * 2 / ROPE_PERIOD) * Math.cos((t + f.phase) * Math.PI * 2 / ROPE_PERIOD);
    return { vx: f.len * Math.cos(a) * w, vy: -f.len * Math.sin(a) * w };
  }
  /*
   * 按跳躍放手時的初速：帶著繩子盪的速度，再加一次完整的跳躍（不然空中最快只有跑速，飛不過 300 寬的水道）。
   * entities.js 放手、america-check 算落點都用這個。
   */
  function ropeRelease(f, t) {
    const v = ropeVel(f, t);
    return { vx: U.clamp(v.vx * 1.15, -7, 7), vy: Math.min(v.vy, 2) + PHYS.JUMP_V };
  }

  const WAVE_CYCLE = 260, WAVE_WARN = 70, WAVE_HIT = 22, WAVE_H = 62;
  function waveState(f, t) {
    const k = (t + f.phase) % WAVE_CYCLE;
    const hitAt = WAVE_CYCLE - WAVE_HIT, warnAt = hitAt - WAVE_WARN;
    return { k: k, warn: k >= warnAt && k < hitAt, hit: k >= hitAt, rise: k >= warnAt ? Math.min(1, (k - warnAt) / WAVE_WARN) : 0 };
  }

  /*
   * 巴拿馬船閘：船頂 = 岸高 − LOCK_RISE × (1 − cos) / 2 —— 最低跟岸齊平、最高比岸高 LOCK_RISE。
   * 閘門牆頂比岸高 GATE_H 150 > 跳躍高度 128：從岸上、從降到底的船上都跳不過去，要搭船升上去。
   * 同一道閘室的兩艘船差半個週期：左邊升到頂時，右邊剛好降到底。
   */
  const LOCK_RISE = 180, LOCK_PERIOD = 400, GATE_W = 16, GATE_H = 150;
  function lockLift(f, t) {
    return LOCK_RISE * (1 - Math.cos((t + f.phase) * Math.PI * 2 / LOCK_PERIOD)) / 2;
  }
  /*
   * 極夜（芬蘭）：一輪 AURORA_CYCLE 帧 —— 漆黑 240 → 極光慢慢亮 50 → 全亮 90 → 慢慢暗 40。
   * glow 0~1：0 = 只看得到身邊，1 = 整片看得清楚。
   */
  const AURORA_CYCLE = 420;
  function auroraGlow(t) {
    const k = t % AURORA_CYCLE;
    if (k < 240) return 0;
    if (k < 290) return (k - 240) / 50;
    if (k < 380) return 1;
    return 1 - (k - 380) / 40;
  }

  const GUST_CYCLE = 320;     // 一輪：安靜 → 預告 → 颳風
  const GUST_PUSH = 1.5;      // 逆風時每帧把地面上的玩家往回推幾 px（空中不推：跳躍距離不受影響）
  const THORN_CYCLE = 150;
  const SHELL_FUSE = 80;      // 砲彈從預告到落地的帧數

  /** 斯洛伐克山風：這一帧在不在颳 */
  function gustState(t) {
    const k = t % GUST_CYCLE;
    return k < 110 ? 'calm' : k < 150 ? 'warn' : 'blow';
  }

  /** 塌橋：還在不在 */
  function bridgeSolid(f) { return f.state !== 'fallen'; }

  /** 給 entities.js 的 solidsOf 用：招牌機制裡「可以站上去」的東西 */
  function solids(state) {
    const fs = state.features;
    if (!fs) return [];
    const out = fs.list.filter(function (f) { return f.type === 'bridge' && bridgeSolid(f); });
    fs.list.forEach(function (f) {
      // 駝峰：會動的平台（有 dx → entities.js 會讓站在上面的人跟著走）
      if (f.type === 'camel' && f.hump) out.push(f.hump);
      // 倒下的石柱：沒有人卡在裡面時才是實心（剛倒下壓到人時先不算，免得把人卡進牆裡）
      if (f.type === 'column' && f.state === 'down' && f.lying && !f.blocked) out.push(f.lying);
      // 丹麥積木：亮著的那一色才踩得到（從下往上可以穿過，跟浮空平台一樣）
      if (f.type === 'brick' && (f.on || fs.brickSolid)) out.push(f);
      // 挪威浮冰：會漂、會沉的平台（有 dx/dy → entities.js 會載著站在上面的人）
      if (f.type === 'floe' && f.box) out.push(f.box);
      // 巴拿馬船閘：跟著水位升降的小船、正中間的閘門牆
      if (f.type === 'lock' && f.box) out.push(f.box);
      // 牙買加手沖咖啡：濾杯裡的咖啡粉（悶蒸時會往上膨脹）
      if (f.type === 'pourover' && f.box) out.push(f.box);
      if (f.type === 'lockGate') out.push(f);
    });
    return out;
  }

  // ── 執行期 ─────────────────────────────────────────────

  function makeState(def) {
    return {
      list: (def.features || []).map(function (f) {
        const o = Object.assign({}, f);
        if (f.type === 'stampede') { o.active = false; o.done = false; o.front = 0; }
        if (f.type === 'barrels') { o.items = []; o.cd = 60; }
        if (f.type === 'cannons') { o.shells = []; o.cd = 60; o.seq = 0; }
        if (f.type === 'bridge') { o.state = 'ok'; o.timer = 0; }
        if (f.type === 'column') { o.state = 'stand'; o.timer = 0; o.angle = 0; }
        if (f.type === 'mount') { o.state = 'wait'; o.timer = 0; }
        if (f.type === 'brick') { o.on = brickState(o, 0).on; }
        if (f.type === 'pourover') {
          o.lift = 0;
          o.box = { x: o.x + 10, y: o.y - POUR_BASE, w: o.w - 20, h: 14, dx: 0, dy: 0, passThru: true, floe: true };
        }
        if (f.type === 'lock') {
          o.lift = lockLift(o, 0);
          o.box = { x: o.x, y: o.y - o.lift, w: o.w, h: 16, dx: 0, dy: 0, passThru: true, floe: true };
        }
        if (f.type === 'floe') {
          o.depth = 0; o.rideT = 0;
          o.box = { x: floeX(o, 0), y: o.by, w: o.w, h: 14, dx: 0, dy: 0, passThru: true, floe: true };
        }
        if (f.type === 'camel') {
          const c0 = camelX(o, 0);
          o.cx = c0.x; o.dir = c0.dir;
          o.hump = { x: o.cx + 16, y: o.y - HUMP_Y, w: 52, h: 10, dx: 0, dy: 0, camel: true, passThru: true };
        }
        return o;
      }),
      seen: {}
    };
  }

  function groundTop(def, x) {
    const segs = def.groundSegs;
    if (!segs) return Levels.GROUND_Y;
    return LevelGen.groundAt(segs, x);
  }

  /** 讓玩家受傷（跟 updatePlayer 裡的規則一致：無敵帧內不重複） */
  function hurt(p, fromX, events, pid) {
    if (p.invuln > 0) return;
    p.invuln = 90 + (p.stats.invulnBonus || 0);
    const kb = p.stats.steady ? 0.5 : 1;          // 冰島毛衣：被打到只退一半
    p.vy = -6 * kb;
    p.vx = (fromX > p.x ? -1 : 1) * 4 * kb;
    events.push('p' + pid + ':hurt');
  }

  /** 玩家編號（事件前綴用）。P1 的 pid 是 0，不能寫成 p.pid || i */
  function pidOf(p, i) { return p.pid != null ? p.pid : i; }

  function launch(p, v, events, pid) {
    p.vy = v;
    p.onGround = false;
    p.coyote = 0;
    p.launched = true;
    events.push('p' + pid + ':spring');
  }

  function update(state, t) {
    const events = [];
    const fs = state.features;
    if (!fs) return events;
    const def = state.def;
    const players = state.players.filter(function (p) { return !p.out; });
    const lead = players.reduce(function (a, p) { return !a || p.x > a.x ? p : a; }, null);
    if (!lead) return events;
    players.forEach(function (p) { p.inSand = false; });
    // 樂高積木裝備：有人戴著，積木就一直都在（雙人時隊友也踩得到）
    fs.brickSolid = players.some(function (p) { return p.stats && p.stats.brickSolid; });

    fs.list.forEach(function (f) {
      // 第一次接近時發一個事件，game.js 顯示提示
      const near = f.x0 != null ? lead.x > f.x0 - 300 && lead.x < (f.x1 || f.x0) : Math.abs(lead.x - f.x) < 420;
      // 鹽湖跟流沙同一套機制，提示分開；v1.31 牙買加音響、哥倫比亞海盜砲、巴拿馬閘門也各有自己的提示
      const tipKey = f.brine ? 'brine' : f.type === 'lockGate' ? 'lock' : f.type;
      if (near && !fs.seen[tipKey]) { fs.seen[tipKey] = true; events.push('feature:' + tipKey); }

      if (f.type === 'stampede') {
        if (!f.active && !f.done && lead.x > f.x0) {
          f.active = true;
          // 從畫面左邊外面衝進來（相機把玩家放在畫面 38% 處）
          f.front = lead.x - 420;
          events.push('stampede');
        }
        if (f.active) {
          f.front += BULL_SPEED;
          if (f.front > f.x1 + 300) { f.active = false; f.done = true; }
          const gy = groundTop(def, f.front) || Levels.GROUND_Y;
          f.box = { x: f.front - BULL_W, y: gy - BULL_H, w: BULL_W, h: BULL_H };
          players.forEach(function (p, i) {
            if (U.overlap(p, f.box)) hurt(p, f.front - BULL_W, events, pidOf(p, i));
          });
        }
      } else if (f.type === 'pad') {
        players.forEach(function (p, i) {
          const feet = p.y + p.h;
          if (p.onGround && Math.abs(feet - f.y) < 3 && p.x + p.w > f.x + 4 && p.x < f.x + f.w - 4) {
            launch(p, PAD_V, events, pidOf(p, i));
            f.squash = 10;
          }
        });
        if (f.squash > 0) f.squash--;
      } else if (f.type === 'geyser') {
        const k = (t + f.phase) % GEYSER_CYCLE;
        f.state = k < 70 ? 'idle' : k < 110 ? 'warn' : k < 150 ? 'erupt' : 'idle';
        if (f.state === 'erupt') {
          const col = { x: f.x, y: f.y - 260, w: f.w, h: 262 };
          players.forEach(function (p, i) {
            if (U.overlap(p, col) && p.vy > GEYSER_V + 2) launch(p, GEYSER_V, events, pidOf(p, i));
          });
        }
      } else if (f.type === 'gusts') {
        f.state = gustState(t);
        if (f.state === 'blow') {
          players.forEach(function (p) {
            /*
             * 坐在纜車上不吹（v1.20 斯洛伐克改纜車關）：纜車廂只有 96 寬，
             * 一陣風推 1.5px/帧 × 170 帧，一定被吹進山谷 —— 那不是挑戰是陷阱。
             * 改成纜車廂跟著風晃（畫面上，Sprites.gondola），在車站月台上才會被吹。
             */
            if (p.ridingMover) return;
            if (p.stats && p.stats.stormProof) return;     // 圖阿雷格頭巾：風沙不怕
            if (p.onGround && p.x > f.x0 && p.x < f.x1) p.x -= GUST_PUSH;
          });
        }
      } else if (f.type === 'sandstorm') {
        const ss = stormState(t);
        f.state = ss.state;
        // 只在區間內才算（離開區間黃沙慢慢散）
        const inside = lead.x > f.x0 && lead.x < f.x1;
        f.haze = inside ? ss.haze : Math.max(0, (f.haze || 0) - 0.03);
        if (f.state === 'blow') {
          players.forEach(function (p) {
            if (p.ridingMover || p.mount || (p.stats && p.stats.stormProof)) return;
            if (p.onGround && p.x > f.x0 && p.x < f.x1) p.x -= STORM_PUSH;
          });
        }
      } else if (f.type === 'current') {
        players.forEach(function (p) {
          const cx = p.x + p.w / 2;
          if (cx < f.x0 || cx > f.x1) return;
          p.x += f.dir * CURRENT_PUSH * (p.onGround ? 0.5 : 1);      // 貼著海底比較推不動
        });
      } else if (f.type === 'clam') {
        const k = (t + f.phase) % CLAM_CYCLE;
        const prev = f.state;
        f.state = k < 100 ? 'open' : k < 120 ? 'warn' : 'shut';
        if (f.state === 'shut' && prev !== 'shut') {
          const box = { x: f.x + 4, y: f.y - 30, w: f.w - 8, h: 30 };
          players.forEach(function (p, i) { if (U.overlap(p, box)) hurt(p, f.x + f.w / 2, events, pidOf(p, i)); });
        }
        // 張開時拿珍珠
        if (f.state === 'open' && !f.pearlTaken) {
          const pb = { x: f.x + f.w / 2 - 8, y: f.y - 16, w: 16, h: 16 };
          players.forEach(function (p, i) {
            if (!f.pearlTaken && U.overlap(p, pb)) { f.pearlTaken = true; events.push('p' + pidOf(p, i) + ':pearl'); }
          });
        }
      } else if (f.type === 'relic') {
        if (!f.taken) {
          players.forEach(function (p, i) {
            if (!f.taken && U.overlap(p, f)) { f.taken = true; events.push('p' + pidOf(p, i) + ':relic:' + f.id); }
          });
        }
      } else if (f.type === 'mount') {
        if (f.state === 'wait') {
          const box = { x: f.x + 10, y: f.y - 44, w: f.w - 20, h: 44 };
          players.forEach(function (p, i) {
            if (f.state !== 'wait' || p.mount || !U.overlap(p, box)) return;
            p.mount = { kind: 'camel', from: f };
            f.state = 'gone';
            events.push('p' + pidOf(p, i) + ':mount');
          });
        } else if (!players.some(function (p) { return p.mount && p.mount.from === f; })) {
          // 沒人騎了（被打到嚇跑）：等一下回到原地
          if (++f.timer >= MOUNT_RESPAWN) { f.state = 'wait'; f.timer = 0; }
        }
      } else if (f.type === 'runaway') {
        f.x += f.dir * 3.2;
        f.life--;
      } else if (f.type === 'camel') {
        const c = camelX(f, t);
        const dx = c.x - f.cx;
        f.cx = c.x; f.dir = c.dir; f.moving = c.moving;
        f.hump.dx = dx;
        f.hump.x = f.cx + 16;
      } else if (f.type === 'column') {
        if (f.state === 'stand') {
          const trig = players.some(function (p) { return p.x + p.w > f.x - COL_TRIGGER && p.x < f.x + 10; });
          if (trig) { f.state = 'shake'; f.timer = COL_SHAKE; events.push('creak'); }
        } else if (f.state === 'shake') {
          if (--f.timer <= 0) { f.state = 'fall'; f.timer = 0; }
        } else if (f.state === 'fall') {
          f.timer++;
          const k = f.timer / COL_DROP;
          f.angle = k * k * Math.PI / 2;           // 越倒越快
          if (k >= 0.6) {
            // 快倒到地上了：底下的人被壓到
            const zone = { x: f.x - COL_FALL, y: f.y - 40, w: COL_FALL - 6, h: 40 };
            players.forEach(function (p, i) { if (U.overlap(p, zone)) hurt(p, f.x - COL_FALL / 2, events, pidOf(p, i)); });
          }
          if (f.timer >= COL_DROP) {
            f.state = 'down'; f.angle = Math.PI / 2;
            f.lying = { x: f.x - COL_FALL, y: f.y - COL_LYING_H, w: COL_FALL - 6, h: COL_LYING_H };
            events.push('collapse');
          }
        }
        if (f.state === 'down') {
          f.blocked = players.some(function (p) { return U.overlap(p, f.lying); });
        }
      } else if (f.type === 'cannons') {
        if (lead.x > f.x0 && lead.x < f.x1 && --f.cd <= 0) {
          f.cd = f.every;
          // 落點在玩家附近（偏前方），用序號錯開，不用 Math.random —— 結果可重現
          const tx = lead.x + lead.w / 2 + [-30, 140, 60, 220, 10, 180][f.seq++ % 6];
          const ty = groundTop(def, tx);
          if (ty != null) f.shells.push({ x: tx, y: ty, fuse: SHELL_FUSE, fuse0: SHELL_FUSE });
        }
        f.shells.forEach(function (s) {
          if (--s.fuse === 0) {
            s.boom = 16;
            players.forEach(function (p, i) {
              const dx = Math.abs(p.x + p.w / 2 - s.x);
              if (dx < 36 && p.y + p.h > s.y - 70) hurt(p, s.x, events, pidOf(p, i));
            });
            events.push('cannon');
          }
          if (s.fuse < 0 && s.boom > 0) s.boom--;
        });
        f.shells = f.shells.filter(function (s) { return s.fuse > 0 || s.boom > 0; });
      } else if (f.type === 'bridge') {
        if (f.state === 'ok') {
          const on = players.some(function (p) {
            return p.onGround && Math.abs(p.y + p.h - f.y) < 3 && p.x + p.w > f.x && p.x < f.x + f.w;
          });
          if (on) { f.state = 'shaking'; f.timer = 36; events.push('creak'); }
        } else if (f.state === 'shaking') {
          if (--f.timer <= 0) { f.state = 'fallen'; f.timer = 260; events.push('collapse'); }
        } else if (--f.timer <= 0) {
          f.state = 'ok';                    // 過一陣子橋又「修好」（不然掉下去重生後就沒路了）
        }
      } else if (f.type === 'sand') {
        players.forEach(function (p) {
          if ((p.stats && p.stats.sandWalk) || p.mount) return;   // 古達米斯皮靴／騎駱駝：沙地、鹽泥都不會陷
          const feet = p.y + p.h;
          if (p.onGround && !p.ridingMover && Math.abs(feet - f.y) < 3 && p.x + p.w > f.x + 6 && p.x < f.x + f.w - 6) {
            p.inSand = true;
            p.sandLimit = f.limit || SAND_LIMIT;
          }
        });
      } else if (f.type === 'brick') {
        const bs = brickState(f, t);
        f.on = bs.on; f.warn = bs.warn;
      } else if (f.type === 'ice') {
        // 站在這段的地面上 → 下一帧的水平移動用冰面物理（見 entities.js「水平輸入」）
        players.forEach(function (p) {
          if (!p.onGround || p.ridingMover || (p.stats && p.stats.iceGrip)) return;
          const cx = p.x + p.w / 2;
          if (cx < f.x0 || cx > f.x1) return;
          const gy = groundTop(def, cx);
          if (gy != null && Math.abs(p.y + p.h - gy) < 3) p.onIce = true;
        });
      } else if (f.type === 'floe') {
        const nx = floeX(f, t);
        const ridden = players.some(function (p) { return p.ridingMover === f.box && p.onGround; });
        if (ridden) {
          if (++f.rideT > FLOE_GRACE) f.depth = Math.min(FLOE_MAX, f.depth + FLOE_SINK);
        } else {
          f.rideT = 0;
          f.depth = Math.max(0, f.depth - FLOE_RISE);
        }
        const ny = f.by + f.depth;
        f.box.dx = nx - f.box.x; f.box.dy = ny - f.box.y;
        f.box.x = nx; f.box.y = ny;
        f.sinking = ridden && f.rideT > FLOE_GRACE;
      } else if (f.type === 'pourover') {
        const ps = pourState(f, t);
        f.warn = ps.warn; f.pour = ps.pour; f.tilt = ps.tilt;
        const ny = f.y - POUR_BASE - ps.lift;
        f.box.dy = ny - f.box.y; f.box.y = ny; f.lift = ps.lift;
        if (ps.k === POUR_CYCLE - POUR_TIME - POUR_HOLD - 60 && Math.abs(lead.x - f.x) < 600) events.push('pour');
        if (ps.pour) {
          // 正中間的熱水柱：從壺嘴一路到咖啡粉的面
          const sx = f.x + f.w / 2 - POUR_STREAM / 2;
          const stream = { x: sx, y: f.y - POUR_TOP, w: POUR_STREAM, h: (ny) - (f.y - POUR_TOP) };
          players.forEach(function (p, i) {
            if (U.overlap(p, stream)) hurt(p, f.x + f.w / 2, events, pidOf(p, i));
          });
        }
      } else if (f.type === 'beatpad') {
        const bs = beatState(f, t);
        f.boom = bs.boom; f.warn = bs.warn;
        if (bs.boom) {
          players.forEach(function (p, i) {
            const feet = p.y + p.h;
            if (p.onGround && Math.abs(feet - f.y) < 3 && p.x + p.w > f.x + 4 && p.x < f.x + f.w - 4) {
              launch(p, BEAT_V, events, pidOf(p, i));
              f.squash = 10;
            }
          });
        }
        if (bs.k === 0 && Math.abs(lead.x - f.x) < 500) events.push('beat');
        if (f.squash > 0) f.squash--;
      } else if (f.type === 'rope') {
        const h = ropeHandle(f, t);
        f.hx = h.x; f.hy = h.y; f.ang = h.a;
        if (f.cool > 0) f.cool--;
        players.forEach(function (p, i) {
          if (p.swing || p.onGround || f.cool > 0) return;
          const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
          if (Math.abs(cx - h.x) < ROPE_GRAB && Math.abs(cy - h.y) < ROPE_GRAB + 10) {
            p.swing = f;                     // 抓住了：entities.js 的 updatePlayer 會讓人跟著繩子走，按跳躍放手
            events.push('p' + pidOf(p, i) + ':grab');
          }
        });
      } else if (f.type === 'waves') {
        const ws = waveState(f, t);
        f.warn = ws.warn; f.hit = ws.hit; f.rise = ws.rise;
        if (ws.warn && ws.k === WAVE_CYCLE - WAVE_HIT - WAVE_WARN && lead.x > f.x0 - 500 && lead.x < f.x1 + 200) events.push('waveWarn');
        if (ws.hit) {
          players.forEach(function (p, i) {
            const cx = p.x + p.w / 2;
            if (cx < f.x0 || cx > f.x1) return;
            const gy = groundTop(def, cx);
            if (gy == null || p.y + p.h <= gy - WAVE_H) return;
            hurt(p, p.x + p.w + 40, events, pidOf(p, i));
          });
        }
      } else if (f.type === 'lock') {
        const lift = lockLift(f, t);
        const ny = f.y - lift;
        f.box.dx = 0; f.box.dy = ny - f.box.y;
        f.box.y = ny; f.lift = lift;
      } else if (f.type === 'aurora') {
        f.glow = auroraGlow(t);
      } else if (f.type === 'thorn') {
        const k = (t + f.phase) % THORN_CYCLE;
        f.state = k < 80 ? 'bud' : k < 104 ? 'warn' : 'spike';
        if (f.state === 'spike') {
          const box = { x: f.x + 4, y: f.y - 22, w: f.w - 8, h: 22 };
          players.forEach(function (p, i) { if (U.overlap(p, box)) hurt(p, f.x + f.w / 2, events, pidOf(p, i)); });
        }
      } else if (f.type === 'barrels') {
        if (--f.cd <= 0) {
          f.cd = f.every;
          /*
           * 生在畫面右邊外面的地面上。
           * ⚠️ 不能只試一個固定距離：那裡剛好是斷崖就生不出來，
           * 玩家站著不動時每次都是同一點 → 整關一個桶子都沒有（實測就是這樣）。
           * 往前掃一段，找第一個有地面的位置。
           */
          /*
           * 而且要生在「跟玩家連在一起的地面」上：中間隔著斷崖的話，
           * 桶子還沒滾到就掉進坑裡，玩家一個都碰不到（德國關斷崖多，實測幾乎全掉坑）。
           * 從玩家腳下那段往右走，接得上的段落（沒有空隙）都算同一片地面。
           */
          const segs = def.groundSegs || [];
          let end = null;
          for (let i = 0; i < segs.length; i++) {
            const g = segs[i];
            if (end == null) {
              if (lead.x + lead.w / 2 >= g.x && lead.x + lead.w / 2 <= g.x + g.w) end = g.x + g.w;
            } else if (g.x <= end + 1) {
              end = g.x + g.w;
            } else break;
          }
          const sx = end == null ? null : Math.min(end - BARREL_R * 2 - 4, lead.x + 640);
          if (lead.x > f.x0 && sx != null && sx < f.x1 && sx > lead.x + 130) {
            // 從上方「翻下山坡」掉進來（離玩家可能不遠，從畫面上方落下才看得到它從哪來）
            const gy = groundTop(def, sx);
            if (gy != null) f.items.push({ x: sx, y: gy - 300, vy: 2, rot: 0, alive: true });
          } else {
            f.cd = 30;   // 這次生不出來（前面太快遇到斷崖），等一下再試
          }
        }
        f.items.forEach(function (b) {
          b.x -= BARREL_SPEED;
          b.rot -= BARREL_SPEED / BARREL_R;
          const gy = groundTop(def, b.x + BARREL_R);
          if (gy == null || b.y + BARREL_R * 2 < gy - 2) {
            // 滾出斷崖或從高處落下
            b.vy = Math.min(b.vy + 0.6, 12);
            b.y += b.vy;
            if (gy != null && b.y + BARREL_R * 2 >= gy) { b.y = gy - BARREL_R * 2; b.vy = 0; }
          } else {
            // 地面變高：小台階（≤ 36px）會「蹦」上去繼續滾；太高的牆就撞碎
            const step = (b.y + BARREL_R * 2) - gy;
            if (step > 36) { b.alive = false; return; }
            b.y = gy - BARREL_R * 2;
            if (step > 6) b.vy = -3;
          }
          if (b.y > (def.height || 480) + 40) b.alive = false;
          const box = { x: b.x + 2, y: b.y + 2, w: BARREL_R * 2 - 4, h: BARREL_R * 2 - 4 };
          players.forEach(function (p, i) {
            if (!b.alive || !U.overlap(p, box)) return;
            const stomping = p.vy > 0 && (p.y + p.h) - box.y < 14;
            if (stomping) {
              b.alive = false;
              p.vy = PHYS.STOMP_BOUNCE;
              events.push('p' + (pidOf(p, i)) + ':stomp');
            } else {
              hurt(p, b.x, events, pidOf(p, i));
            }
          });
        });
        f.items = f.items.filter(function (b) { return b.alive && b.x > lead.x - 900; });
      }
    });

    // 潛水：空氣每帧減少，碰到噴口的氣泡柱補回來；用完 → 嗆水（扣一顆愛心、空氣補滿）
    // 淹水段：身體中心在水面以下就算在水裡（entities.js 用 p.inWater 換潛水物理）
    const floods = fs.list.filter(function (f) { return f.type === 'flood'; });
    if (floods.length) {
      players.forEach(function (p) {
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
        const was = p.inWater;
        p.inWater = floods.some(function (f) { return cx > f.x0 && cx < f.x1 && cy > f.top; });
        if (p.inWater && !was) state.particles.push({ x: cx, y: p.y, vx: 0, vy: -1, life: 18, color: '#e0f6ff' });
      });
    }
    if (def.underwater || floods.length) {
      const vents = fs.list.filter(function (f) { return f.type === 'vent'; });
      players.forEach(function (p, i) {
        if (p.air == null) p.air = AIR_MAX;
        if (!def.underwater && !p.inWater) { p.air = AIR_MAX; p.breathing = false; return; }   // 出水面就能呼吸
        const inBubbles = vents.some(function (v) {
          return p.x + p.w > v.x && p.x < v.x + v.w && p.y + p.h > v.y - VENT_H && p.y < v.y;
        });
        if (inBubbles) {
          if (p.air < AIR_MAX - 30 && !p.breathing) events.push('p' + pidOf(p, i) + ':breathe');
          p.breathing = true;
          p.air = Math.min(AIR_MAX, p.air + 14);
        } else {
          p.breathing = false;
          p.air--;
        }
        if (p.air <= 0) {
          p.air = AIR_MAX;
          events.push('p' + pidOf(p, i) + ':drown');
        }
      });
    }

    // 嚇跑的駱駝跑出畫面就收掉
    fs.list = fs.list.filter(function (f) { return f.type !== 'runaway' || f.life > 0; });

    // 流沙的效果（所有沙坑判定完才算，避免站在兩片交界時被算兩次）
    players.forEach(function (p, i) {
      if (p.inSand) {
        p.sandT = (p.sandT || 0) + 1;
        /*
         * 走不快：速度上限 2.3（正常 4.6 的一半），走過 120px 約 52 帧。
         * ⚠️ 不能寫成每帧 vx *= 0.55：玩家每帧又加速 0.62，平衡點只有 0.76px/帧，
         * 走完一片沙坑要 158 帧 > SAND_LIMIT，等於「一定受傷」。
         */
        p.vx = U.clamp(p.vx, -SAND_MAX_RUN, SAND_MAX_RUN);
        if (p.sandT > (p.sandLimit || SAND_LIMIT)) {
          // 陷太深：受傷，順勢被彈出沙坑
          p.sandT = 0;
          hurt(p, p.x + p.w / 2 + (p.facing || 1) * -10, events, pidOf(p, i));
          events.push('p' + pidOf(p, i) + ':sinkout');
        }
      } else {
        // 剛從沙裡起跳的那一下：初速打折（跳不高）
        if (p.wasInSand && !p.onGround && p.vy < -9) p.vy *= 0.7;
        p.sandT = Math.max(0, (p.sandT || 0) - 4);   // 離開沙坑，下陷慢慢回復
      }
      p.wasInSand = p.inSand;
    });
    return events;
  }

  // ── 繪製 ───────────────────────────────────────────────

  function drawBull(ctx, x, y, t, k) {
    const bob = Math.abs(Math.sin(t * 0.35 + k)) * 3;
    ctx.save();
    ctx.translate(x, y - bob);
    ctx.fillStyle = '#2a1c16';
    U.roundRect(ctx, -30, -30, 52, 26, 10); ctx.fill();
    ctx.beginPath(); ctx.ellipse(26, -22, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#efe4c8';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(26, -30); ctx.quadraticCurveTo(36, -42, 40, -34); ctx.stroke();
    ctx.fillStyle = '#2a1c16';
    const leg = Math.sin(t * 0.5 + k) * 6;
    ctx.fillRect(-24 + leg, -6, 6, 6); ctx.fillRect(10 - leg, -6, 6, 6);
    ctx.fillStyle = '#ff6b5a';
    ctx.fillRect(28, -24, 3, 2);
    ctx.restore();
  }

  /** 駱駝（側面）：x = 身體左緣、gy = 地面；dir 1 = 面向右。背上一塊紅色鞍毯（就是可以站的駝峰） */
  function drawCamel(ctx, x, gy, dir, t) {
    ctx.save();
    ctx.translate(x + CAMEL_W / 2, gy);
    ctx.scale(dir, 1);
    const leg = t ? Math.sin(t * 0.18) * 6 : 0;
    ctx.fillStyle = '#b8864e';
    // 腿
    [[-26, leg], [-14, -leg], [14, leg], [24, -leg]].forEach(function (l) {
      ctx.fillRect(l[0] + l[1] * 0.3, -30, 6, 30);
    });
    // 身體 + 駝峰
    ctx.beginPath(); ctx.ellipse(0, -36, 34, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-2, -46, 20, 12, 0, Math.PI, 0); ctx.fill();
    // 脖子 + 頭
    ctx.beginPath();
    ctx.moveTo(26, -42); ctx.quadraticCurveTo(44, -48, 40, -66); ctx.lineTo(48, -70);
    ctx.quadraticCurveTo(58, -68, 56, -62); ctx.lineTo(46, -60); ctx.quadraticCurveTo(48, -40, 32, -30);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a2414';
    ctx.fillRect(48, -68, 2, 2);
    // 鞍毯（站的地方）
    ctx.fillStyle = '#c0392b';
    U.roundRect(ctx, -26, -HUMP_Y, 52, 8, 3); ctx.fill();
    ctx.fillStyle = '#f1c40f';
    for (let k = 0; k < 5; k++) ctx.fillRect(-22 + k * 10, -HUMP_Y + 6, 6, 4);
    // 尾巴
    ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-33, -38); ctx.quadraticCurveTo(-40, -30, -37, -22); ctx.stroke();
    ctx.restore();
  }

  /** 羅馬石柱：立著（搖晃時左右抖）→ 以底部右端為軸往左倒 → 躺在地上 */
  function drawColumn(ctx, sx, gy, f, t) {
    ctx.save();
    let shake = 0;
    if (f.state === 'shake') shake = Math.sin(t * 1.3) * 0.04;
    ctx.translate(sx, gy);
    ctx.rotate(-(f.angle || 0) - shake);
    // 柱身：以 (0,0) 為左下角（倒下的轉軸）往上長，寬 0~28
    ctx.fillStyle = '#e6d6b4';
    ctx.fillRect(5, -COL_H + 12, 18, COL_H - 22);
    ctx.fillStyle = 'rgba(150, 120, 80, 0.35)';
    for (let k = 0; k < 3; k++) ctx.fillRect(9 + k * 5, -COL_H + 14, 2, COL_H - 26);
    // 柱頭、柱基
    ctx.fillStyle = '#d4c09a';
    ctx.fillRect(0, -COL_H, 28, 12);
    ctx.fillRect(1, -10, 26, 10);
    // 裂縫
    ctx.strokeStyle = 'rgba(90, 70, 50, 0.6)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(6, -70); ctx.lineTo(13, -76); ctx.lineTo(20, -68); ctx.stroke();
    ctx.restore();
    // 要倒了：地上預告它會壓到的範圍（紅色虛線框）
    if (f.state === 'shake' || f.state === 'fall') {
      ctx.strokeStyle = 'rgba(255, 80, 70, ' + (f.state === 'fall' ? 0.9 : 0.5 + Math.sin(t * 0.5) * 0.3).toFixed(2) + ')';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.strokeRect(sx - COL_FALL, gy - 6, COL_FALL - 6, 5);
      ctx.setLineDash([]);
      if (f.state === 'shake') {
        // 柱頭掉下來的灰塵
        ctx.fillStyle = 'rgba(220, 200, 160, 0.7)';
        for (let k = 0; k < 3; k++) {
          ctx.beginPath(); ctx.arc(sx + 8 + k * 6, gy - COL_H + 20 + ((t * 2 + k * 13) % 40), 2, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  /**
   * layer：'bg'（只畫鹽礦岩壁，要在建築後面）或 'fg'（其他全部）。
   * ⚠️ 一定要傳完整的 state：山風要讀玩家位置。原本 game.js 傳的是
   * 只有 features 的包裝物件，斯洛伐克一進關就在這裡丟例外、整個畫面停住。
   */
  function drawWorld(ctx, state, camX, t, layer) {
    const fs = state.features;
    if (!fs) return;
    fs.list.forEach(function (f) {
      // 背景層：鹽礦岩壁、極夜的星空與極光（要在建築後面）
      if (layer && (layer === 'bg') !== (f.type === 'dark' || f.type === 'aurora')) return;
      if (f.type === 'pourover') {
        const sx = f.x - camX;
        if (sx < -160 || sx > 1100) return;
        drawPourover(ctx, sx, f, t);
      } else if (f.type === 'beatpad') {
        const sx = f.x - camX;
        if (sx < -80 || sx > 1040) return;
        drawSpeaker(ctx, sx, f.y, f, t);
      } else if (f.type === 'rope') {
        const ax = f.ax - camX;
        if (ax < -220 || ax > 1180) return;
        drawRope(ctx, ax, f, t);
      } else if (f.type === 'pad') {
        const sx = f.x - camX;
        if (sx < -80 || sx > 1040) return;
        const sq = f.squash > 0 ? 4 : 0;
        // 咖啡館遮陽篷：紅白條紋的彈床
        ctx.fillStyle = '#5a4030';
        ctx.fillRect(sx + 4, f.y - 10 + sq, 4, 10 - sq);
        ctx.fillRect(sx + f.w - 8, f.y - 10 + sq, 4, 10 - sq);
        for (let i = 0; i < 7; i++) {
          ctx.fillStyle = i % 2 ? '#f4efe2' : '#c0392b';
          ctx.fillRect(sx + i * (f.w / 7), f.y - 14 + sq, f.w / 7 + 0.5, 6);
        }
        ctx.fillStyle = 'rgba(255, 220, 140, 0.7)';
        ctx.beginPath();
        ctx.moveTo(sx + f.w / 2 - 6, f.y - 24); ctx.lineTo(sx + f.w / 2, f.y - 32 - Math.sin(t * 0.15) * 3);
        ctx.lineTo(sx + f.w / 2 + 6, f.y - 24); ctx.fill();
      } else if (f.type === 'geyser') {
        const sx = f.x - camX;
        if (sx < -80 || sx > 1040) return;
        // 石砌泉口
        ctx.fillStyle = '#8c8070';
        ctx.fillRect(sx - 4, f.y - 8, f.w + 8, 8);
        ctx.fillStyle = '#5fb0c8';
        ctx.fillRect(sx + 4, f.y - 6, f.w - 8, 4);
        if (f.state === 'warn') {
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          for (let i = 0; i < 4; i++) {
            const by = f.y - 10 - ((t * 1.2 + i * 9) % 30);
            ctx.beginPath(); ctx.arc(sx + 8 + i * 8, by, 3, 0, Math.PI * 2); ctx.fill();
          }
        } else if (f.state === 'erupt') {
          const g = ctx.createLinearGradient(0, f.y - 260, 0, f.y);
          g.addColorStop(0, 'rgba(230, 245, 255, 0)');
          g.addColorStop(0.3, 'rgba(230, 245, 255, 0.75)');
          g.addColorStop(1, 'rgba(160, 220, 240, 0.95)');
          ctx.fillStyle = g;
          const wob = Math.sin(t * 0.6) * 3;
          ctx.beginPath();
          ctx.moveTo(sx + 4, f.y);
          ctx.quadraticCurveTo(sx - 10 + wob, f.y - 140, sx + f.w / 2, f.y - 262);
          ctx.quadraticCurveTo(sx + f.w + 10 - wob, f.y - 140, sx + f.w - 4, f.y);
          ctx.closePath(); ctx.fill();
        }
      } else if (f.type === 'barrels') {
        f.items.forEach(function (b) {
          const sx = b.x - camX;
          if (sx < -60 || sx > 1020) return;
          ctx.save();
          ctx.translate(sx + BARREL_R, b.y + BARREL_R);
          ctx.rotate(b.rot);
          ctx.fillStyle = '#8a5a30';
          ctx.beginPath(); ctx.arc(0, 0, BARREL_R, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#3a3a40';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(0, 0, BARREL_R - 2, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, BARREL_R * 0.45, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#c8a050';
          ctx.fillRect(-2, -BARREL_R + 3, 4, BARREL_R * 2 - 6);
          ctx.restore();
        });
      } else if (f.type === 'stampede' && f.active && f.box) {
        const bx = f.box.x - camX;
        // 塵土
        ctx.fillStyle = 'rgba(200, 170, 120, 0.45)';
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.arc(bx + i * 30 + Math.sin(t * 0.3 + i) * 6, f.box.y + 34 - (i % 2) * 10, 18, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let k = 0; k < 4; k++) {
          drawBull(ctx, bx + 30 + k * 38, f.box.y + BULL_H - (k % 2) * 4, t, k);
        }
      } else if (f.type === 'gusts') {
        const p = state.player;
        if (p.x < f.x0 - 200 || p.x > f.x1 + 200) return;
        // 預告：樹葉開始往左飄；颳風：整個畫面的風線
        const n = f.state === 'blow' ? 26 : f.state === 'warn' ? 8 : 0;
        for (let i = 0; i < n; i++) {
          const sx = 960 - ((t * (f.state === 'blow' ? 14 : 5) + i * 173) % 1100);
          const sy = 70 + (i * 61) % 320;
          if (f.state === 'blow') {
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 70, sy - 3); ctx.stroke();
          } else {
            ctx.fillStyle = 'rgba(120, 160, 70, 0.8)';
            ctx.beginPath(); ctx.ellipse(sx, sy + Math.sin(t * 0.1 + i) * 6, 4, 2, 0.6, 0, Math.PI * 2); ctx.fill();
          }
        }
      } else if (f.type === 'cannons') {
        f.shells.forEach(function (s) {
          const sx = s.x - camX;
          if (sx < -60 || sx > 1020) return;
          if (s.fuse > 0) {
            // 落點預告：地上的紅圈越縮越小
            const k = Math.min(1, s.fuse / (s.fuse0 || SHELL_FUSE));
            ctx.strokeStyle = 'rgba(255, 80, 70, ' + (0.9 - k * 0.5).toFixed(2) + ')';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(sx, s.y - 2, 12 + k * 24, 4 + k * 6, 0, 0, Math.PI * 2); ctx.stroke();
            if (s.fuse < 34) {
              const by = s.y - 8 - s.fuse * 11;
              ctx.fillStyle = '#2a2a30';
              ctx.beginPath(); ctx.arc(sx, by, 7, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#ff9a40'; ctx.fillRect(sx - 1, by - 10, 2, 4);
            }
          } else if (s.boom > 0) {
            ctx.fillStyle = 'rgba(255, 170, 70, ' + (s.boom / 16).toFixed(2) + ')';
            ctx.beginPath(); ctx.arc(sx, s.y - 12, 40 - s.boom, 0, Math.PI * 2); ctx.fill();
          }
        });
      } else if (f.type === 'sand' && f.brine) {
        // 鹽湖：白色鹽殼裂成一塊一塊，縫裡是藍綠色的鹵水（跟摩洛哥的黃沙流沙一眼分得出來）
        const sx = f.x - camX;
        if (sx > 1000 || sx + f.w < -40) return;
        ctx.fillStyle = '#5a9a98';
        ctx.beginPath(); ctx.ellipse(sx + f.w / 2, f.y + 3, f.w / 2 + 4, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#eef2ea';
        for (let k = 0; k < 8; k++) {
          const x = sx + 12 + k * (f.w - 24) / 8;
          ctx.beginPath(); ctx.ellipse(x + 12, f.y + 1, 11, 3.5, (k % 3 - 1) * 0.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = 'rgba(200, 240, 235, 0.8)';
        for (let b = 0; b < 4; b++) {
          const ph = (t * 0.04 + b * 1.3) % 3;
          if (ph < 1) { ctx.beginPath(); ctx.arc(sx + 30 + b * 56, f.y - ph * 4, 1.5 + ph * 2, 0, Math.PI * 2); ctx.fill(); }
        }
      } else if (f.type === 'current') {
        // 暗流：一條條往流向飄的水紋
        const a = f.x0 - camX, b = f.x1 - camX;
        if (b < 0 || a > 960) return;
        ctx.strokeStyle = 'rgba(200, 240, 255, 0.35)'; ctx.lineWidth = 2;
        for (let k = 0; k < 18; k++) {
          const span = f.x1 - f.x0;
          const wx = f.x0 + (((k * 137 + t * 3 * f.dir) % span) + span) % span;
          const sx = wx - camX, sy = 90 + (k * 53) % 300;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + f.dir * 18, sy - 4, sx + f.dir * 36, sy); ctx.stroke();
        }
        // 兩端的標示：箭頭
        U.text(ctx, f.dir < 0 ? '◀ 暗流' : '暗流 ▶', Math.max(40, Math.min(920, a + 50)), 100, { size: 14, color: 'rgba(210, 245, 255, 0.85)' });
      } else if (f.type === 'clam') {
        const sx = f.x - camX;
        if (sx < -80 || sx > 1040) return;
        const open = f.state === 'open' ? 1 : f.state === 'warn' ? 0.5 + Math.sin(t * 1.2) * 0.2 : 0.05;
        ctx.save();
        ctx.translate(sx + f.w / 2, f.y);
        ctx.fillStyle = '#b07a9a';
        ctx.beginPath(); ctx.ellipse(0, -2, f.w / 2, 9, 0, 0, Math.PI); ctx.fill();          // 下殼
        if (!f.pearlTaken && open > 0.3) {
          ctx.fillStyle = '#f8f4ff';
          ctx.beginPath(); ctx.arc(0, -8, 5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.save();
        ctx.translate(-f.w / 2 + 4, -2);
        ctx.rotate(-open * 0.9);
        ctx.fillStyle = '#c890b0';
        ctx.beginPath(); ctx.ellipse(f.w / 2 - 4, 0, f.w / 2, 10, 0, Math.PI, 0); ctx.fill();   // 上殼
        ctx.strokeStyle = 'rgba(90, 40, 70, 0.5)'; ctx.lineWidth = 1.2;
        for (let r = 1; r < 5; r++) {
          ctx.beginPath(); ctx.moveTo(f.w / 2 - 4, 0); ctx.lineTo(f.w / 2 - 4 + Math.cos(Math.PI + r * 0.62) * f.w / 2, Math.sin(Math.PI + r * 0.62) * 10); ctx.stroke();
        }
        ctx.restore();
        ctx.restore();
      } else if (f.type === 'relic') {
        if (f.taken) return;
        const sx = f.x - camX;
        if (sx < -60 || sx > 1020) return;
        const bob = Math.sin(t * 0.06 + f.x) * 3;
        ctx.fillStyle = 'rgba(255, 230, 150, 0.25)';
        ctx.beginPath(); ctx.arc(sx + 14, f.y + 14 + bob, 22, 0, Math.PI * 2); ctx.fill();
        if (typeof Sprites !== 'undefined' && Sprites.relic) Sprites.relic(ctx, f.id, sx + 14, f.y + 14 + bob, 1);
      } else if (f.type === 'vent') {
        // 海底的氣泡噴口：石砌的口＋一串往上冒、左右晃的氣泡
        const sx = f.x - camX;
        if (sx > 1000 || sx < -80) return;
        ctx.fillStyle = '#7a8a8a';
        ctx.fillRect(sx - 4, f.y - 10, f.w + 8, 10);
        ctx.fillStyle = '#3a4a52';
        ctx.fillRect(sx + 6, f.y - 8, f.w - 12, 5);
        for (let k = 0; k < 9; k++) {
          const ph = (t * 1.6 + k * 26) % VENT_H;
          const bx = sx + f.w / 2 + Math.sin(t * 0.08 + k * 1.7) * 8;
          ctx.strokeStyle = 'rgba(220, 245, 255, ' + (0.85 - ph / VENT_H * 0.6).toFixed(2) + ')';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(bx, f.y - 12 - ph, 3 + (k % 3) * 1.5, 0, Math.PI * 2); ctx.stroke();
        }
      } else if (f.type === 'mount') {
        if (f.state !== 'wait') return;
        const sx = f.x - camX;
        if (sx > 1040 || sx < -120) return;
        drawCamel(ctx, sx, f.y, 1, 0);
        // 頭上一個上下飄的鞍形記號：「可以騎」
        const by = f.y - HUMP_Y - 22 + Math.sin(t * 0.1) * 3;
        ctx.fillStyle = 'rgba(20, 16, 30, 0.75)';
        U.roundRect(ctx, sx + CAMEL_W / 2 - 22, by - 9, 44, 18, 6); ctx.fill();
        U.text(ctx, '騎乘', sx + CAMEL_W / 2, by, { size: 11, color: '#ffd166', stroke: false });
      } else if (f.type === 'runaway') {
        const sx = f.x - camX;
        if (sx > 1040 || sx < -120) return;
        ctx.save();
        ctx.globalAlpha = Math.min(1, f.life / 30);
        drawCamel(ctx, sx, f.y, f.dir, t * 2);
        ctx.restore();
      } else if (f.type === 'camel') {
        const sx = f.cx - camX;
        if (sx > 1040 || sx + CAMEL_W < -80) return;
        drawCamel(ctx, sx, f.y, f.dir, f.moving ? t : 0);
      } else if (f.type === 'column') {
        const sx = f.x - camX;
        if (sx > 1060 || sx < -200) return;
        drawColumn(ctx, sx, f.y, f, t);
      } else if (f.type === 'sandstorm') {
        if (!(f.haze > 0)) return;
        // 颳風時一條條飛過的沙線（往左）
        const n = f.state === 'blow' ? 30 : 10;
        for (let i = 0; i < n; i++) {
          const sx = 960 - ((t * (f.state === 'blow' ? 16 : 6) + i * 157) % 1100);
          const sy = 60 + (i * 53) % 360;
          ctx.strokeStyle = 'rgba(240, 200, 140, ' + (0.5 * f.haze).toFixed(2) + ')';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 60, sy - 4); ctx.stroke();
        }
      } else if (f.type === 'sand') {
        // 流沙：比地面深一點的沙色、表面有慢慢轉的漩渦和冒泡（一眼看得出「這片不一樣」）
        const sx = f.x - camX;
        if (sx > 1000 || sx + f.w < -40) return;
        ctx.fillStyle = '#c08848';
        ctx.beginPath(); ctx.ellipse(sx + f.w / 2, f.y + 3, f.w / 2 + 4, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8b878';
        ctx.beginPath(); ctx.ellipse(sx + f.w / 2, f.y + 1, f.w / 2 - 4, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(140, 90, 40, 0.6)';
        ctx.lineWidth = 1.5;
        for (let r = 0; r < 3; r++) {
          const a = t * 0.03 + r * 2.1;
          ctx.beginPath();
          ctx.ellipse(sx + f.w / 2, f.y + 1, 12 + r * 14, 2.5 + r, 0, a, a + Math.PI * 1.2);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255, 230, 180, 0.8)';
        for (let b = 0; b < 3; b++) {
          const ph = (t * 0.05 + b * 1.7) % 3;
          if (ph < 1) {
            ctx.beginPath(); ctx.arc(sx + 24 + b * 34, f.y - ph * 4, 2 + ph * 2, 0, Math.PI * 2); ctx.fill();
          }
        }
      } else if (f.type === 'bridge') {
        if (f.state === 'fallen') return;
        const sx = f.x - camX + (f.state === 'shaking' ? Math.sin(t * 1.3) * 2 : 0);
        if (sx > 1000 || sx + f.w < -40) return;
        ctx.fillStyle = '#7a5a34';
        for (let x = 0; x < f.w; x += 14) ctx.fillRect(sx + x, f.y, 12, f.h);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(sx, f.y + f.h - 3, f.w, 3);
        ctx.strokeStyle = '#a08060'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(sx, f.y - 14); ctx.quadraticCurveTo(sx + f.w / 2, f.y - 4, sx + f.w, f.y - 14); ctx.stroke();
        ctx.fillStyle = '#5a3a20';
        ctx.fillRect(sx - 2, f.y - 18, 4, 18); ctx.fillRect(sx + f.w - 2, f.y - 18, 4, 18);
      } else if (f.type === 'thorn') {
        const sx = f.x - camX;
        if (sx < -100 || sx > 1060) return;
        // 平常是一排玫瑰花苞，預告時抖動，冒刺時一整排荊棘
        const shake = f.state === 'warn' ? Math.sin(t * 1.4) * 1.5 : 0;
        for (let i = 0; i < 5; i++) {
          const x = sx + 8 + i * 16 + shake;
          if (f.state === 'spike') {
            ctx.fillStyle = '#3f6a2e';
            ctx.beginPath(); ctx.moveTo(x - 5, f.y); ctx.lineTo(x, f.y - 22); ctx.lineTo(x + 5, f.y); ctx.fill();
            ctx.fillStyle = '#e04a6a';
            ctx.beginPath(); ctx.arc(x, f.y - 22, 3, 0, Math.PI * 2); ctx.fill();
          } else {
            ctx.fillStyle = '#4f7a3a';
            ctx.fillRect(x - 1, f.y - 7, 2, 7);
            ctx.fillStyle = f.state === 'warn' ? '#ff6a8a' : '#c8507a';
            ctx.beginPath(); ctx.arc(x, f.y - 8, 3, 0, Math.PI * 2); ctx.fill();
          }
        }
      } else if (f.type === 'brick') {
        const sx = f.x - camX;
        if (sx < -80 || sx > 1040) return;
        drawBrick(ctx, sx, f.y, f, t, fs.brickSolid);
      } else if (f.type === 'ice') {
        // 結冰的湖面：這段地面頂上蓋一層淡藍色的冰，帶反光
        const a = f.x0 - camX, b = f.x1 - camX;
        if (b < 0 || a > 960) return;
        (state.def.groundSegs || []).forEach(function (g) {
          const x0 = Math.max(g.x, f.x0) - camX, x1 = Math.min(g.x + g.w, f.x1) - camX;
          if (x1 <= x0 || x1 < 0 || x0 > 960) return;
          ctx.fillStyle = 'rgba(190, 228, 250, 0.9)';
          ctx.fillRect(x0, g.y - 2, x1 - x0, 9);
          ctx.fillStyle = 'rgba(120, 180, 220, 0.55)';
          ctx.fillRect(x0, g.y + 6, x1 - x0, 3);
          // 反光：斜斜的白線（跟著世界座標，不會跟著鏡頭飄）
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; ctx.lineWidth = 1.5;
          for (let wx = Math.ceil((x0 + camX) / 46) * 46; wx < x1 + camX - 10; wx += 46) {
            const sx = wx - camX;
            ctx.beginPath(); ctx.moveTo(sx, g.y + 4); ctx.lineTo(sx + 9, g.y - 1); ctx.stroke();
          }
          // 冰上的小裂紋
          ctx.strokeStyle = 'rgba(90, 150, 200, 0.5)'; ctx.lineWidth = 1;
          for (let wx = Math.ceil((x0 + camX) / 130) * 130 + 60; wx < x1 + camX - 20; wx += 130) {
            const sx = wx - camX;
            ctx.beginPath(); ctx.moveTo(sx, g.y + 2); ctx.lineTo(sx + 6, g.y + 5); ctx.lineTo(sx + 14, g.y + 3); ctx.stroke();
          }
        });
      } else if (f.type === 'floe') {
        const bx = f.box.x - camX;
        if (bx < -100 || bx > 1060) return;
        drawFloe(ctx, bx, f.box.y, f, t);
      } else if (f.type === 'waves') {
        drawWaves(ctx, state, f, camX, t);
      } else if (f.type === 'lock') {
        const gx = f.gx - camX;
        if (gx < -f.gw - 40 || gx > 1000) return;
        drawLock(ctx, gx, f, f.box.x - camX, f.box.y, t);
      } else if (f.type === 'lockGate') {
        const gx = f.x - camX;
        if (gx < -40 || gx > 1000) return;
        drawLockGate(ctx, gx, f, t);
      } else if (f.type === 'aurora') {
        drawAuroraSky(ctx, state, f, camX, t);
      } else if (f.type === 'dark') {
        // 鹽礦內部：岩壁 + 木頭支架 + 礦燈（畫在地形後面，當背景）
        const a = f.x0 - camX, b = f.x1 - camX;
        if (b < 0 || a > 960) return;
        ctx.fillStyle = '#3a3430';
        ctx.fillRect(a, 44, b - a, Levels.GROUND_Y - 44);
        ctx.fillStyle = 'rgba(220, 230, 240, 0.12)';
        for (let x = f.x0; x < f.x1; x += 70) {
          const sx = x - camX;
          ctx.beginPath();
          ctx.moveTo(sx, 140 + (x % 3) * 20); ctx.lineTo(sx + 12, 120 + (x % 5) * 10); ctx.lineTo(sx + 22, 150);
          ctx.fill();
        }
        ctx.fillStyle = '#6b4a2e';
        for (let x = f.x0 + 40; x < f.x1; x += 160) {
          const sx = x - camX;
          ctx.fillRect(sx, 70, 10, Levels.GROUND_Y - 70);
          ctx.fillRect(sx - 30, 64, 70, 10);
        }
        f.lamps.forEach(function (lx) {
          const sx = lx - camX;
          ctx.fillStyle = '#3a2a1e';
          ctx.fillRect(sx - 1, 74, 2, 30);
          ctx.fillStyle = '#ffd98a';
          ctx.beginPath(); ctx.arc(sx, 108, 6, 0, Math.PI * 2); ctx.fill();
        });
      }
    });
  }

  /** 樂高積木：亮著 = 實心積木（上面四顆凸點）；沒亮 = 虛線外框；快消失時閃爍 */
  function drawBrick(ctx, sx, y, f, t, always) {
    const col = f.color === 0 ? ['#d8262c', '#a8161c', '#f25a5a'] : ['#1f6fd0', '#12489a', '#5a9af0'];
    if (!(f.on || always)) {
      // 沒亮：淡淡的底色＋深色虛線框（背景是彩色房子，太淡會看不出積木在哪）
      ctx.fillStyle = f.color === 0 ? 'rgba(216, 38, 44, 0.16)' : 'rgba(31, 111, 208, 0.16)';
      ctx.fillRect(sx, y, f.w, f.h);
      ctx.strokeStyle = f.color === 0 ? 'rgba(200, 40, 40, 0.9)' : 'rgba(30, 90, 200, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(sx + 1, y + 1, f.w - 2, f.h - 2);
      ctx.setLineDash([]);
      return;
    }
    if (f.warn && !always && Math.floor(t / 5) % 2 === 0) ctx.globalAlpha = 0.45;
    ctx.fillStyle = col[0];
    ctx.fillRect(sx, y, f.w, f.h);
    ctx.fillStyle = col[1];
    ctx.fillRect(sx, y + f.h - 4, f.w, 4);
    // 凸點
    for (let k = 0; k < 4; k++) {
      const cx = sx + 8 + k * 16;
      ctx.fillStyle = col[1];
      ctx.fillRect(cx - 5, y - 4, 10, 4);
      ctx.fillStyle = col[2];
      ctx.fillRect(cx - 5, y - 4, 10, 1.5);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(sx + 2, y + 2, f.w - 4, 2);
    ctx.globalAlpha = 1;
  }

  /** 浮冰：白色冰塊，水面以下的部分畫成淡藍；下沉時邊緣冒水花 */
  function drawFloe(ctx, sx, y, f, t) {
    const bob = Math.sin(t * 0.08 + f.phase) * 1.2;
    ctx.save();
    ctx.translate(0, bob);
    ctx.fillStyle = 'rgba(160, 210, 235, 0.55)';
    ctx.beginPath(); ctx.ellipse(sx + f.w / 2, y + 14, f.w / 2 + 2, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4fbff';
    ctx.beginPath();
    ctx.moveTo(sx + 4, y); ctx.lineTo(sx + f.w - 6, y); ctx.lineTo(sx + f.w, y + 8);
    ctx.lineTo(sx + f.w - 4, y + 14); ctx.lineTo(sx + 6, y + 14); ctx.lineTo(sx, y + 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#bfe2f4';
    ctx.fillRect(sx + 3, y + 8, f.w - 7, 6);
    ctx.strokeStyle = 'rgba(120, 180, 215, 0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx + 18, y + 2); ctx.lineTo(sx + 24, y + 6); ctx.lineTo(sx + 30, y + 4); ctx.stroke();
    if (f.sinking) {
      ctx.fillStyle = 'rgba(220, 245, 255, 0.9)';
      for (let k = 0; k < 4; k++) {
        const ph = (t * 0.3 + k * 1.7) % 3;
        ctx.beginPath(); ctx.arc(sx + (k < 2 ? -2 - ph * 2 : f.w + 2 + ph * 2), y + 10 - ph * 3, 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  /*
   * 牙買加的手沖咖啡：木架子上一個白色的錐形濾杯（底下是玻璃分享壺），裡面是咖啡粉；
   * 上方一支木頭吊臂掛著銀色的細口壺，預告時壺身慢慢往前傾、壺嘴冒蒸氣，沖水時一條細細的熱水柱落在正中間。
   */
  const POUR_TOP = 300;          // 壺嘴離地多高
  function drawPourover(ctx, sx, f, t) {
    const gy = f.y, top = gy - POUR_BASE, cx = sx + f.w / 2;
    // 吊臂（左邊一根柱子，往右伸到濾杯正上方）
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(sx - 30, gy - POUR_TOP - 60, 8, POUR_TOP + 60);
    ctx.fillRect(sx - 30, gy - POUR_TOP - 60, cx - sx + 60, 7);
    // 底下的玻璃分享壺＋木架
    ctx.fillStyle = 'rgba(200, 230, 240, 0.5)';
    ctx.beginPath(); ctx.moveTo(cx - 34, gy); ctx.lineTo(cx - 40, gy - 30); ctx.lineTo(cx + 40, gy - 30); ctx.lineTo(cx + 34, gy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(90, 50, 20, 0.85)'; ctx.fillRect(cx - 32, gy - 10 - Math.min(18, f.lift * 0.12), 64, 10 + Math.min(18, f.lift * 0.12));
    ctx.fillStyle = '#8a5a2a'; ctx.fillRect(sx + 4, top + 10, f.w - 8, 6);
    // 濾杯（白色錐形，上寬下窄）
    ctx.fillStyle = '#f4f0e8';
    ctx.beginPath(); ctx.moveTo(sx, top - 16); ctx.lineTo(sx + f.w, top - 16); ctx.lineTo(cx + 26, top + 12); ctx.lineTo(cx - 26, top + 12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(200, 190, 170, 0.8)'; ctx.lineWidth = 1.5;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(sx + k * f.w / 4, top - 14); ctx.lineTo(cx + (k - 2) * 10, top + 10); ctx.stroke(); }
    // 咖啡粉（就是踩的地方）：悶蒸時像舒芙蕾一樣從濾杯裡鼓起來 —— 底下窄、上面一顆冒泡的奶泡圓頂
    const by = f.box.y, lift = f.lift || 0;
    if (lift > 2) {
      const g = ctx.createLinearGradient(0, top - 10, 0, by);
      g.addColorStop(0, '#5a3a1e'); g.addColorStop(1, '#a8743e');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - 30, top - 12);
      ctx.quadraticCurveTo(sx + 6, (top + by) / 2, sx + 12, by + 6);
      ctx.lineTo(sx + f.w - 12, by + 6);
      ctx.quadraticCurveTo(sx + f.w - 6, (top + by) / 2, cx + 30, top - 12);
      ctx.closePath(); ctx.fill();
      // 冒上來的泡泡
      ctx.fillStyle = 'rgba(240, 210, 160, 0.7)';
      for (let k = 0; k < 8; k++) {
        const bx = sx + 20 + ((k * 29) % (f.w - 40)), byy = by + 10 + ((k * 37 + t * 0.8) % Math.max(8, top - by - 10));
        ctx.beginPath(); ctx.arc(bx, byy, 2 + (k % 3), 0, Math.PI * 2); ctx.fill();
      }
    }
    // 頂上的奶泡圓頂（平常就是濾杯裡平平的一層咖啡粉）
    ctx.fillStyle = lift > 2 ? '#d8a864' : '#5a3a1e';
    ctx.beginPath(); ctx.ellipse(cx, by + 4, f.w / 2 - 8, 9 + Math.min(6, lift * 0.05), 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(sx + 8, by + 3, f.w - 16, 5);
    if (lift > 2) {
      ctx.fillStyle = 'rgba(255, 240, 210, 0.9)';
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(sx + 22 + k * (f.w - 44) / 4, by - 2 - (k % 2) * 3, 3, 0, Math.PI * 2); ctx.fill(); }
    }
    // 細口壺（銀色）：預告時往前傾、冒蒸氣
    const kx = cx - 30, ky = gy - POUR_TOP - 40;
    ctx.save();
    ctx.translate(kx, ky);
    ctx.rotate((f.tilt || 0) * 0.6);
    ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -14); ctx.stroke();
    ctx.fillStyle = '#c8ccd4';
    U.roundRect(ctx, -16, -14, 32, 30, 8); ctx.fill();
    ctx.fillStyle = '#e8ecf2'; ctx.fillRect(-12, -10, 6, 22);
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(-18, -2, 4, 14);                     // 把手
    ctx.strokeStyle = '#b8bcc4'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(16, 10); ctx.quadraticCurveTo(28, 6, 30, 22); ctx.stroke();   // 鵝頸壺嘴
    ctx.restore();
    if (f.warn || f.pour) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.6 + k * 9) % 26;
        ctx.beginPath(); ctx.arc(cx + Math.sin(t * 0.1 + k) * 4, gy - POUR_TOP - 10 - ph, 4 + ph * 0.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 熱水柱
    if (f.pour) {
      ctx.fillStyle = 'rgba(200, 150, 90, 0.75)';
      ctx.fillRect(cx - POUR_STREAM / 4, gy - POUR_TOP, POUR_STREAM / 2, by - (gy - POUR_TOP));
      ctx.fillStyle = 'rgba(255, 240, 220, 0.6)';
      ctx.fillRect(cx - 1, gy - POUR_TOP, 2, by - (gy - POUR_TOP));
      // 水落下去濺起來的熱氣
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      for (let k = 0; k < 3; k++) { const ph = (t * 0.5 + k * 7) % 16; ctx.beginPath(); ctx.arc(cx + (k - 1) * 10, by - 4 - ph, 3 + ph * 0.2, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  /** 牙買加的雷鬼音響：一疊黑色喇叭箱；節拍前燈一顆顆亮起來（準備），「咚」的那一下喇叭鼓出來、冒出聲波圈 */
  function drawSpeaker(ctx, sx, y, f, t) {
    const sq = f.squash > 0 ? 4 : 0;
    const pull = f.warn ? 2 : 0, push = f.boom ? 3 : 0;
    ctx.fillStyle = '#1e1e22';
    ctx.fillRect(sx + 2, y - 8, f.w - 4, 8);
    ctx.fillRect(sx, y - 18 + sq, f.w, 12);
    ctx.fillStyle = '#3a3a40';
    ctx.beginPath(); ctx.ellipse(sx + f.w / 2, y - 14 + sq, f.w / 2 - 6, 4 - pull + push, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a5a62';
    ctx.beginPath(); ctx.ellipse(sx + f.w / 2, y - 14 + sq, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
    // 紅黃綠的燈：快到節拍時三顆依序亮起來
    const k = (t + f.phase) % BEAT_PERIOD;
    const lit = f.warn ? Math.min(3, Math.floor((k - (BEAT_PERIOD - BEAT_WARN)) / 8) + 1) : f.boom ? 3 : 0;
    ['#d8262c', '#f2c230', '#2f9a4a'].forEach(function (c, i) {
      ctx.fillStyle = i < lit ? c : 'rgba(80, 80, 80, 0.8)';
      ctx.beginPath(); ctx.arc(sx + 12 + i * 18, y - 3, 3, 0, Math.PI * 2); ctx.fill();
    });
    // 「咚」的聲波圈
    if (k < 20) {
      ctx.strokeStyle = 'rgba(255, 230, 140, ' + (1 - k / 20).toFixed(2) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx + f.w / 2, y - 16, 20 + k * 2.4, 6 + k * 0.6, 0, Math.PI, 0); ctx.stroke();
    }
  }

  /** 哥倫比亞的盪繩：從上方的木樑垂下來的粗繩，繩尾一個打結的把手 */
  function drawRope(ctx, ax, f, t) {
    const hx = (f.hx != null ? f.hx : f.ax) - f.ax + ax, hy = f.hy != null ? f.hy : f.ay + f.len;
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(ax - 40, f.ay - 8, 80, 8);
    ctx.fillStyle = '#4a3220'; ctx.fillRect(ax - 4, f.ay - 14, 8, 8);
    ctx.strokeStyle = '#c8a46a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(ax, f.ay); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = 'rgba(110, 80, 40, 0.7)'; ctx.lineWidth = 1;
    for (let k = 1; k < 8; k++) {
      const q = k / 8, x = ax + (hx - ax) * q, y = f.ay + (hy - f.ay) * q;
      ctx.beginPath(); ctx.moveTo(x - 3, y - 2); ctx.lineTo(x + 3, y + 2); ctx.stroke();
    }
    ctx.fillStyle = '#a8804a'; ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 230, 140, ' + (0.25 + Math.sin(t * 0.15) * 0.15).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(hx, hy, 13, 0, Math.PI * 2); ctx.fill();
  }

  /** 古巴的大浪：海堤後面捲起來的浪頭（預告），拍上來時整段路面蓋一層白浪 */
  function drawWaves(ctx, state, f, camX, t) {
    const x0 = f.x0 - camX, x1 = f.x1 - camX;
    if (x1 < -40 || x0 > 1000) return;
    const gy = groundTop(state.def, (f.x0 + f.x1) / 2) || Levels.GROUND_Y;
    // 這段路邊的海堤（矮牆），提醒玩家「這裡會有浪」
    ctx.fillStyle = 'rgba(200, 190, 170, 0.9)';
    ctx.fillRect(x0, gy - 16, x1 - x0, 6);
    if (f.rise > 0 && !f.hit) {
      // 浪頭從堤後升起來（越來越高、越來越白）
      const h = 20 + f.rise * 70;
      ctx.fillStyle = 'rgba(70, 150, 200, ' + (0.35 + f.rise * 0.4).toFixed(2) + ')';
      ctx.beginPath(); ctx.moveTo(x0, gy - 16);
      for (let x = x0; x <= x1; x += 24) ctx.lineTo(x, gy - 16 - h + Math.sin(x * 0.05 + t * 0.2) * 8);
      ctx.lineTo(x1, gy - 16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.4 + f.rise * 0.5).toFixed(2) + ')';
      for (let x = x0; x <= x1; x += 24) {
        ctx.beginPath(); ctx.arc(x, gy - 16 - h + Math.sin(x * 0.05 + t * 0.2) * 8, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (f.hit) {
      // 整片白浪拍上路面
      ctx.fillStyle = 'rgba(230, 245, 255, 0.85)';
      ctx.fillRect(x0, gy - WAVE_H, x1 - x0, WAVE_H);
      ctx.fillStyle = 'rgba(120, 190, 230, 0.6)';
      for (let x = x0; x < x1; x += 30) {
        ctx.beginPath(); ctx.arc(x + 15, gy - WAVE_H + Math.sin(x + t) * 4, 14, Math.PI, 0); ctx.fill();
      }
    }
  }

  /** 巴拿馬船閘：半邊閘室的水（從船底一直到底，跟著船一起升降）＋水上的小拖船＋升降的箭頭 */
  function drawLock(ctx, gx, f, bx, by, t) {
    const water = by + 12;
    ctx.fillStyle = 'rgba(40, 110, 140, 0.85)';
    ctx.fillRect(gx, water, f.gw, 480 - water);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let x = gx + 6; x < gx + f.gw - 8; x += 22) ctx.fillRect(x + Math.sin(t * 0.05 + x) * 2, water + 2, 10, 2);
    // 閘室外牆（岸邊那一側）
    ctx.fillStyle = '#8a8a84';
    if (f.side === 0) ctx.fillRect(gx - 6, f.y - 2, 6, 482 - f.y);
    else ctx.fillRect(gx + f.gw, f.y - 2, 6, 482 - f.y);
    // 小拖船（船頂就是踩的地方）
    ctx.fillStyle = '#c8402a';
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + f.w, by); ctx.lineTo(bx + f.w - 10, by + 16); ctx.lineTo(bx + 10, by + 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4efe2'; ctx.fillRect(bx, by, f.w, 3);
    ctx.fillStyle = '#e8e0d0'; ctx.fillRect(bx + f.w / 2 - 14, by - 12, 28, 12);
    ctx.fillStyle = '#4a6a8a'; ctx.fillRect(bx + f.w / 2 - 10, by - 9, 7, 5); ctx.fillRect(bx + f.w / 2 + 3, by - 9, 7, 5);
    // 升／降的箭頭（綠色 = 正在升）
    const rising = Math.sin((t + f.phase) * Math.PI * 2 / LOCK_PERIOD) > 0;
    ctx.fillStyle = rising ? 'rgba(140, 230, 140, 0.95)' : 'rgba(255, 170, 90, 0.95)';
    const ax = bx + f.w / 2, ay = by - 24;
    ctx.beginPath();
    if (rising) { ctx.moveTo(ax - 6, ay + 4); ctx.lineTo(ax + 6, ay + 4); ctx.lineTo(ax, ay - 5); }
    else { ctx.moveTo(ax - 6, ay - 4); ctx.lineTo(ax + 6, ay - 4); ctx.lineTo(ax, ay + 5); }
    ctx.closePath(); ctx.fill();
  }

  /** 閘門牆：混凝土牆＋鋼製閘門（中間一道縫） */
  function drawLockGate(ctx, gx, f, t) {
    ctx.fillStyle = '#7a7a74';
    ctx.fillRect(gx, f.y, f.w, 480 - f.y);
    ctx.fillStyle = '#4a5a6a';
    ctx.fillRect(gx + 2, f.y + 6, f.w - 4, 480 - f.y - 6);
    ctx.fillStyle = '#2a3440'; ctx.fillRect(gx + f.w / 2 - 0.5, f.y + 6, 1, 480 - f.y - 6);
    ctx.fillStyle = '#f2c230';
    for (let y = f.y; y < f.y + 30; y += 10) ctx.fillRect(gx, y, f.w, 4);       // 頂端的黃黑警示條
    ctx.fillStyle = '#e8e0d0'; ctx.fillRect(gx - 3, f.y - 3, f.w + 6, 3);
  }

  /** 極夜的天空：星星＋綠紫色的極光簾幕（glow 越亮越明顯；畫在建築後面） */
  function drawAuroraSky(ctx, state, f, camX, t) {
    const p = state.player;
    const near = U.clamp(Math.min(p.x - (f.x0 - 400), (f.x1 + 400) - p.x) / 400, 0, 1);
    if (near <= 0) return;
    ctx.save();
    ctx.globalAlpha = near;
    // 星星（跟著遠景慢慢捲）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 197 - camX * 0.05) % 980 + 980) % 980;
      const sy = 20 + (i * 71) % 200;
      const tw = 0.5 + 0.5 * Math.sin(t * 0.05 + i);
      ctx.globalAlpha = near * (0.3 + 0.5 * tw);
      ctx.fillRect(sx, sy, 2, 2);
    }
    // 極光：幾條上下飄動的光帶
    const g = 0.12 + 0.55 * (f.glow || 0);
    ctx.globalCompositeOperation = 'lighter';
    for (let b = 0; b < 3; b++) {
      const grad = ctx.createLinearGradient(0, 30 + b * 30, 0, 230 + b * 20);
      grad.addColorStop(0, 'rgba(160, 90, 220, 0)');
      grad.addColorStop(0.35, b === 1 ? 'rgba(170, 110, 230, 0.6)' : 'rgba(90, 240, 170, 0.7)');
      grad.addColorStop(1, 'rgba(60, 220, 160, 0)');
      ctx.fillStyle = grad;
      ctx.globalAlpha = near * g * (b === 1 ? 0.6 : 1);
      ctx.beginPath();
      const base = 60 + b * 34;
      ctx.moveTo(-20, 260);
      for (let x = -20; x <= 980; x += 30) {
        const wx = x + camX * 0.08;
        ctx.lineTo(x, base + Math.sin(wx * 0.006 + t * 0.012 + b * 2) * 26 + Math.sin(wx * 0.017 - t * 0.02) * 10);
      }
      ctx.lineTo(980, 260);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /**
   * 黑暗遮罩（鹽礦）：整個畫面蓋黑，只在玩家身邊與礦燈周圍挖光圈。
   * 用離屏畫布做（直接在主畫布 destination-out 會把底下的關卡一起挖掉）。
   *
   * ⚠️ 效能（v1.20.1 玩家回報：第 11 關手機版 lag）：
   *   舊版每帧在全解析度（960×480）的暗幕上，對「每一盞礦燈（含畫面外的）」各建一個放射漸層、
   *   用 destination-out 挖洞 —— 實測單是這一步就要 33ms/帧（整片塗滿一次才 1ms），手機直接掉幀。
   *   改成：
   *     1. 暗幕用 1/4 解析度畫，最後放大貼上（光圈本來就是柔邊，放大看不出差別；像素少 16 倍）
   *     2. 光圈只在第一次畫成一張小圖，之後每帧直接 drawImage（不再每帧 createRadialGradient）
   *     3. 畫面外的礦燈不挖
   */
  const DARK_SCALE = 0.25;
  let dark = null, darkCtx = null, holeImg = null;
  function makeHole() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 32 * 0.3, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return c;
  }
  /**
   * 潛水的水面效果：整片藍色濾鏡、從水面斜射下來的光束、水面的波紋，
   * 以及每位玩家頭上的空氣計（快用完時變紅閃爍）。
   */
  function drawUnderwater(ctx, state, camX, t, W, H, camY) {
    camY = camY || 0;
    const shaft = state.def.layout === 'shaft';
    ctx.save();
    ctx.fillStyle = 'rgba(20, 90, 150, 0.22)';
    ctx.fillRect(0, 0, W, H);
    // 光束
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 5; k++) {
      const x = ((k * 230 - camX * 0.3) % 1150 + 1150) % 1150 - 100;
      const a = 0.05 + Math.sin(t * 0.02 + k) * 0.025;
      ctx.fillStyle = 'rgba(180, 230, 255, ' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x + 50, 60); ctx.lineTo(x + 170, H); ctx.lineTo(x + 70, H); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // 水面（豎井是往深處潛，看不到水面）
    if (!shaft) {
    ctx.strokeStyle = 'rgba(220, 245, 255, 0.55)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 12) {
      const y = 62 + Math.sin((x + camX) * 0.03 + t * 0.06) * 2.5;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    }
    // 空氣計
    state.players.forEach(function (p) {
      if (p.out || p.air == null) return;
      const k = p.air / AIR_MAX;
      if (k > 0.98) return;                    // 滿的時候不擋畫面
      const cx = p.x + p.w / 2 - camX, y = p.y - 22 - camY;
      const low = k < 0.3;
      if (low && Math.floor(t / 8) % 2 === 0) return;
      const n = 6, on = Math.ceil(k * n);
      for (let i = 0; i < n; i++) {
        ctx.strokeStyle = low ? '#ff8a8a' : '#d8f4ff';
        ctx.fillStyle = i < on ? (low ? 'rgba(255,120,120,0.85)' : 'rgba(170,225,255,0.85)') : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx - (n - 1) * 5 + i * 10, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    });
    ctx.restore();
  }

  /**
   * 淹水段（西班牙）：只在那一段畫半透明的海水、水面波紋、光束；在水裡的玩家頭上畫空氣計。
   * 畫在所有東西之上（含玩家），看起來人就是泡在水裡。
   */
  function drawFlood(ctx, state, camX, t, W, H) {
    state.features.list.forEach(function (f) {
      if (f.type !== 'flood') return;
      const a = f.x0 - camX, b = f.x1 - camX;
      if (b < 0 || a > W) return;
      ctx.save();
      const g = ctx.createLinearGradient(0, f.top, 0, H);
      g.addColorStop(0, 'rgba(20, 130, 220, 0.42)');
      g.addColorStop(1, 'rgba(8, 50, 130, 0.62)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(a, H);
      for (let x = a; x <= b; x += 12) ctx.lineTo(x, f.top + Math.sin((x + camX) * 0.03 + t * 0.06) * 3);
      ctx.lineTo(b, H);
      ctx.closePath(); ctx.fill();
      // 水面亮線
      ctx.strokeStyle = 'rgba(230, 248, 255, 0.7)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = a; x <= b; x += 12) {
        const y = f.top + Math.sin((x + camX) * 0.03 + t * 0.06) * 3;
        if (x === a) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // 光束
      ctx.globalCompositeOperation = 'lighter';
      for (let x = Math.ceil((f.x0) / 240) * 240; x < f.x1 - 60; x += 240) {
        const sx = x - camX + Math.sin(t * 0.02 + x) * 10;
        ctx.fillStyle = 'rgba(180, 230, 255, 0.06)';
        ctx.beginPath(); ctx.moveTo(sx, f.top); ctx.lineTo(sx + 40, f.top); ctx.lineTo(sx + 120, H); ctx.lineTo(sx + 60, H); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    });
    drawAirMeters(ctx, state, camX, t, 0);
  }

  /** 頭上的空氣計（快用完時變紅閃爍；滿的時候不畫，不擋畫面） */
  function drawAirMeters(ctx, state, camX, t, camY) {
    state.players.forEach(function (p) {
      if (p.out || p.air == null) return;
      const k = p.air / AIR_MAX;
      if (k > 0.98) return;
      const cx = p.x + p.w / 2 - camX, y = p.y - 22 - camY;
      const low = k < 0.3;
      if (low && Math.floor(t / 8) % 2 === 0) return;
      const n = 6, on = Math.ceil(k * n);
      for (let i = 0; i < n; i++) {
        ctx.strokeStyle = low ? '#ff8a8a' : '#d8f4ff';
        ctx.fillStyle = i < on ? (low ? 'rgba(255,120,120,0.85)' : 'rgba(170,225,255,0.85)') : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx - (n - 1) * 5 + i * 10, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    });
  }
  /** 低解析度遮罩：整片塗 color，再用 holes(hole) 挖出柔邊的圓（hole(x, y, r)） */
  function maskWithHoles(ctx, W, H, color, holes) {
    if (!dark) {
      if (typeof document === 'undefined' || !document.createElement) return;
      dark = document.createElement('canvas');
      dark.width = Math.ceil(W * DARK_SCALE); dark.height = Math.ceil(H * DARK_SCALE);
      darkCtx = dark.getContext('2d');
      holeImg = makeHole();
    }
    const d = darkCtx;
    if (!d) return;
    const S = DARK_SCALE;
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, dark.width, dark.height);
    d.fillStyle = color;
    d.fillRect(0, 0, dark.width, dark.height);
    d.globalCompositeOperation = 'destination-out';
    holes(function (x, y, r) {
      if (x + r < 0 || x - r > W) return;
      d.drawImage(holeImg, (x - r) * S, (y - r) * S, r * 2 * S, r * 2 * S);
    });
    d.globalCompositeOperation = 'source-over';
    ctx.drawImage(dark, 0, 0, W, H);
  }

  function drawOverlay(ctx, state, camX, t, W, H, camY) {
    const fs = state.features;
    if (!fs) return;
    if (state.def.underwater) drawUnderwater(ctx, state, camX, t, W, H, camY);
    else if (fs.list.some(function (f) { return f.type === 'flood'; })) drawFlood(ctx, state, camX, t, W, H);
    /*
     * 流沙：陷進去的玩家，腳邊蓋一圈沙（畫在玩家之後，看起來就像身體陷進沙裡）。
     * 越久越高，快到上限時沙子變紅閃爍 —— 提醒玩家「要受傷了，快跳」。
     */
    (state.players || []).forEach(function (p) {
      if (p.out || !(p.sandT > 0)) return;
      const k = U.clamp(p.sandT / (p.sandLimit || SAND_LIMIT), 0, 1);
      const sx = p.x + p.w / 2 - camX, gy = p.y + p.h;
      const hgt = 6 + k * 22;
      const warn = k > 0.7 && Math.floor(t / 6) % 2 === 0;
      ctx.fillStyle = warn ? '#d8704a' : '#e0ae70';
      ctx.beginPath(); ctx.ellipse(sx, gy + 2, 20, hgt, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = 'rgba(150, 100, 50, 0.5)';
      ctx.fillRect(sx - 20, gy, 40, 3);
    });
    fs.list.forEach(function (f) {
      if (f.type === 'sandstorm' && f.haze > 0) {
        /*
         * 沙塵暴：整個畫面蓋一層黃沙，玩家身邊挖一個看得見的圈。
         * 戴圖阿雷格頭巾（stormProof）沙比較淡、圈比較大。共用鹽礦的 1/4 解析度遮罩（效能見下面說明）。
         */
        const proof = state.players.some(function (q) { return !q.out && q.stats && q.stats.stormProof; });
        const a = (proof ? 0.5 : 0.82) * f.haze;
        maskWithHoles(ctx, W, H, 'rgba(196, 140, 80, ' + a.toFixed(3) + ')', function (hole) {
          state.players.forEach(function (q) {
            if (!q.out) hole(q.x + q.w / 2 - camX, q.y + q.h / 2, proof ? 260 : 165);
          });
        });
        return;
      }
      if (f.type === 'aurora') {
        /*
         * 極夜：跟鹽礦一樣的低解析度暗幕，但沒有礦燈；極光亮起來時暗幕變淡（glow = 1 時幾乎看得清整片）。
         * 維京太陽石（nightSight）：身邊的光圈比較大、暗幕淡一點。
         */
        const pa = state.player;
        const pc = pa.x + pa.w / 2;
        const ka = Math.min(U.clamp((pc - f.x0) / 200, 0, 1), U.clamp((f.x1 - pc) / 200, 0, 1));
        if (ka <= 0) return;
        const sight = state.players.some(function (q) { return !q.out && q.stats && q.stats.nightSight; });
        const alpha = ((sight ? 0.82 : 0.94) - 0.72 * (f.glow || 0)) * ka;
        if (alpha <= 0.02) return;
        maskWithHoles(ctx, W, H, 'rgba(4, 8, 22, ' + alpha.toFixed(3) + ')', function (hole) {
          state.players.forEach(function (q) {
            if (!q.out) hole(q.x + q.w / 2 - camX, q.y + q.h / 2, (sight ? 230 : 135) + Math.sin(t * 0.1) * 4);
          });
        });
        return;
      }
      if (f.type !== 'dark') return;
      const p = state.player;
      const pcx = p.x + p.w / 2;
      // 進出礦坑時漸暗/漸亮，不要瞬間黑掉
      const fadeIn = U.clamp((pcx - f.x0) / 200, 0, 1);
      const fadeOut = U.clamp((f.x1 - pcx) / 200, 0, 1);
      const k = Math.min(fadeIn, fadeOut);
      if (k <= 0) return;
      if (!dark) {
        if (typeof document === 'undefined' || !document.createElement) return;
        dark = document.createElement('canvas');
        dark.width = Math.ceil(W * DARK_SCALE); dark.height = Math.ceil(H * DARK_SCALE);
        darkCtx = dark.getContext('2d');
        holeImg = makeHole();
      }
      const d = darkCtx;
      if (!d) return;
      const S = DARK_SCALE;
      d.globalCompositeOperation = 'source-over';
      d.clearRect(0, 0, dark.width, dark.height);
      d.fillStyle = 'rgba(4, 4, 10, ' + (0.93 * k).toFixed(3) + ')';
      d.fillRect(0, 0, dark.width, dark.height);
      d.globalCompositeOperation = 'destination-out';
      function hole(x, y, r) {
        if (x + r < 0 || x - r > W) return;          // 畫面外不挖
        d.drawImage(holeImg, (x - r) * S, (y - r) * S, r * 2 * S, r * 2 * S);
      }
      // 維京太陽石（v1.30 nightSight）：鹽礦裡也看得比較遠
      const seeFar = state.players.some(function (q) { return !q.out && q.stats && q.stats.nightSight; });
      state.players.forEach(function (q) {
        if (!q.out) hole(q.x + q.w / 2 - camX, q.y + q.h / 2, (seeFar ? 220 : 150) + Math.sin(t * 0.1) * 4);
      });
      f.lamps.forEach(function (lx) { hole(lx - camX, 108, 110); });
      d.globalCompositeOperation = 'source-over';
      ctx.drawImage(dark, 0, 0, W, H);
    });
  }

  /** 被打到：駱駝嚇跑（往玩家面向的反方向跑出畫面），人留在原地 */
  function dismount(state, p) {
    if (!p.mount) return;
    p.mount = null;
    if (state.features) {
      state.features.list.push({ type: 'runaway', x: p.x + p.w / 2 - CAMEL_W / 2, y: p.y + p.h, dir: -(p.facing || 1), life: 110 });
    }
  }

  /**
   * 騎著的駱駝：畫在玩家之後，蓋住腿 —— 看起來就是人坐在鞍上。
   * sx = 玩家左緣的螢幕座標、gy = 玩家腳底。
   */
  function drawMount(ctx, p, sx, t) {
    if (!p.mount) return;
    ctx.save();
    ctx.translate(sx + p.w / 2, p.y + p.h);      // 腳踩地；玩家本人在 game.js 往上畫 14px（坐在鞍上）
    ctx.scale(p.facing < 0 ? -1 : 1, 1);
    if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) ctx.globalAlpha = 0.5;
    const run = p.onGround && Math.abs(p.vx) > 0.5;
    const leg = run ? Math.sin(t * 0.4) * 5 : 0;
    ctx.fillStyle = '#b8864e';
    [[-20, leg], [-11, -leg], [10, leg], [18, -leg]].forEach(function (l) { ctx.fillRect(l[0] + l[1] * 0.4, -16, 5, 16); });
    ctx.beginPath(); ctx.ellipse(0, -20, 26, 10, 0, 0, Math.PI * 2); ctx.fill();
    // 脖子＋頭（往前）
    ctx.beginPath();
    ctx.moveTo(20, -24); ctx.quadraticCurveTo(32, -28, 30, -42); ctx.lineTo(37, -45);
    ctx.quadraticCurveTo(45, -43, 43, -38); ctx.lineTo(35, -36); ctx.quadraticCurveTo(36, -22, 24, -14);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a2414'; ctx.fillRect(37, -43, 2, 2);
    // 鞍毯（蓋住玩家的腿）
    ctx.fillStyle = '#c0392b';
    U.roundRect(ctx, -16, -30, 30, 12, 4); ctx.fill();
    ctx.fillStyle = '#f1c40f';
    for (let k = 0; k < 3; k++) ctx.fillRect(-12 + k * 9, -20, 5, 3);
    ctx.restore();
  }

  /**
   * 瑞典的馴鹿雪橇（v1.30 def.autorun）：紅色木雪橇墊在玩家腳下、彎彎的滑板，前面一頭馴鹿拉著跑。
   * sx = 玩家左緣的螢幕座標；在冰上加速時馴鹿後面噴冰屑。
   */
  function drawSled(ctx, p, sx, t) {
    ctx.save();
    ctx.translate(sx + p.w / 2, p.y + p.h);
    if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) ctx.globalAlpha = 0.5;
    // 雪橇
    ctx.fillStyle = '#b8282a';
    U.roundRect(ctx, -20, -12, 36, 10, 3); ctx.fill();
    ctx.fillStyle = '#e8c040'; ctx.fillRect(-20, -12, 36, 2);
    ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(18, 0); ctx.quadraticCurveTo(26, 0, 24, -8); ctx.stroke();   // 滑板
    ctx.beginPath(); ctx.moveTo(-14, -2); ctx.lineTo(-14, 0); ctx.moveTo(10, -2); ctx.lineTo(10, 0); ctx.stroke();
    // 韁繩＋馴鹿
    const run = p.onGround ? Math.sin(t * 0.45) * 5 : 3;
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(14, -10); ctx.lineTo(34, -22); ctx.stroke();
    ctx.fillStyle = '#7a6250';
    [[30, run], [38, -run], [52, run], [58, -run]].forEach(function (l) { ctx.fillRect(l[0] + l[1] * 0.4, -14, 4, 14); });
    ctx.beginPath(); ctx.ellipse(46, -20, 16, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(56, -24); ctx.lineTo(64, -34); ctx.lineTo(70, -32); ctx.lineTo(62, -20); ctx.fill();
    ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.ellipse(36, -20, 5, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c0281e'; ctx.beginPath(); ctx.arc(70, -32, 2, 0, Math.PI * 2); ctx.fill();   // 紅鼻子
    ctx.strokeStyle = '#c8b090'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(64, -34); ctx.lineTo(60, -44); ctx.lineTo(56, -48); ctx.moveTo(61, -41); ctx.lineTo(66, -46); ctx.stroke();
    // 冰上加速：後面噴出來的冰屑
    if (p.onIce && p.onGround) {
      ctx.fillStyle = 'rgba(220, 240, 255, 0.85)';
      for (let k = 0; k < 4; k++) {
        const ph = (t * 0.5 + k * 7) % 14;
        ctx.beginPath(); ctx.arc(-24 - ph * 2, -2 - ph * 0.8, 1.8, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * 古巴的老爺車（v1.31 def.ride === 'car'）：1950 年代的粉紅敞篷車，玩家坐在駕駛座上；
   * 後面排氣管冒煙，跑起來車輪會轉。sx = 玩家左緣的螢幕座標。
   */
  function drawCar(ctx, p, sx, t) {
    ctx.save();
    ctx.translate(sx + p.w / 2, p.y + p.h);
    if (p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0) ctx.globalAlpha = 0.5;
    // 車身（長長的尾鰭）
    ctx.fillStyle = '#e87aa0';
    ctx.beginPath();
    ctx.moveTo(-34, -8); ctx.lineTo(-30, -20); ctx.lineTo(-22, -18); ctx.lineTo(-14, -14);
    ctx.lineTo(24, -14); ctx.quadraticCurveTo(40, -14, 44, -6); ctx.lineTo(44, -4); ctx.lineTo(-34, -4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4f0e8'; ctx.fillRect(-34, -9, 78, 3);                   // 白色腰線
    ctx.fillStyle = '#c8c8d0'; ctx.fillRect(40, -8, 6, 4); ctx.fillRect(-36, -8, 4, 4);   // 保險桿
    ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.arc(43, -11, 2.4, 0, Math.PI * 2); ctx.fill();   // 大燈
    ctx.fillStyle = 'rgba(190, 230, 250, 0.7)';
    ctx.beginPath(); ctx.moveTo(10, -14); ctx.lineTo(16, -24); ctx.lineTo(19, -14); ctx.fill();   // 擋風玻璃
    // 車輪
    const spin = t * 0.4;
    [-20, 28].forEach(function (wx) {
      ctx.fillStyle = '#1e1e22'; ctx.beginPath(); ctx.arc(wx, -3, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8d8e0'; ctx.beginPath(); ctx.arc(wx, -3, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8a8a92'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(wx + Math.cos(spin) * 3, -3 + Math.sin(spin) * 3); ctx.lineTo(wx - Math.cos(spin) * 3, -3 - Math.sin(spin) * 3); ctx.stroke();
    });
    // 排氣管的煙
    ctx.fillStyle = 'rgba(160, 160, 170, 0.5)';
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.4 + k * 6) % 18;
      ctx.beginPath(); ctx.arc(-38 - ph * 1.5, -6 - ph * 0.5, 2 + ph * 0.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  return {
    dismount: dismount,
    drawMount: drawMount,
    drawSled: drawSled,
    drawCar: drawCar,
    waveState: waveState,
    beatState: beatState,
    pourState: pourState,
    POUR_LIFT: POUR_LIFT,
    POUR_BASE: POUR_BASE,
    POUR_W: POUR_W,
    POUR_TOP: POUR_TOP,
    POUR_STREAM: POUR_STREAM,
    ropeHandle: ropeHandle,
    ropeVel: ropeVel,
    ropeRelease: ropeRelease,
    BEAT_PERIOD: BEAT_PERIOD,
    BEAT_WINDOW: BEAT_WINDOW,
    BEAT_V: BEAT_V,
    ROPE_PERIOD: ROPE_PERIOD,
    lockLift: lockLift,
    WAVE_H: WAVE_H,
    LOCK_RISE: LOCK_RISE,
    LOCK_PERIOD: LOCK_PERIOD,
    GATE_H: GATE_H,
    plan: plan,
    solids: solids,
    gustState: gustState,
    GUST_PUSH: GUST_PUSH,
    makeState: makeState,
    update: update,
    drawWorld: drawWorld,
    drawOverlay: drawOverlay,
    stormState: stormState,
    camelX: camelX,
    brickState: brickState,
    floeX: floeX,
    auroraGlow: auroraGlow,
    AURORA_CYCLE: AURORA_CYCLE,
    BRICK_CYCLE: BRICK_CYCLE,
    BRINE_LIMIT: BRINE_LIMIT,
    CURRENT_PUSH: CURRENT_PUSH,
    AIR_MAX: AIR_MAX,
    BULL_SPEED: BULL_SPEED,
    PAD_V: PAD_V,
    GEYSER_V: GEYSER_V
  };
})();
