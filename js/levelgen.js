'use strict';

/**
 * 關卡地形產生器。
 *
 * 為什麼用產生器而不是手寫座標：
 *   10 關 × 約 7500px，每關要擺地面、平台、金幣、敵人、密道、裝飾。
 *   手寫等於幾千個數字，之前 6 關的經驗是「每次手調都會撞出新的重疊問題」
 *   （金幣被埋進牆、敵人飄過斷崖、裝飾壓到密室）。
 *   改成由規則產生 + 用同一份約束檢查，就不會再出現那類錯。
 *
 * 用固定 seed 的偽隨機：同一個 seed 每次產生完全一樣的關卡，
 * 所以測試結果可重現，玩家每次玩到的也是同一張圖。
 *
 * 產生器保證的約束（tests 會再驗一次）：
 *   - 斷崖寬度 <= MAX_GAP
 *   - 相鄰地面高低差 <= MAX_STEP（跳得上去）
 *   - 平台在跳躍可達範圍內
 *   - 金幣不會卡在地形裡
 *   - 地面敵人的巡邏範圍不跨越斷崖
 *   - 密室不跟任何東西重疊
 */
const LevelGen = (function () {

  const GROUND_Y = 400;      // 標準地面高度（橫向關卡）
  const GROUND_H = 80;
  const MAX_GAP = 110;       // 斷崖寬度上限（跳躍可達 185，留餘裕）
  const MAX_STEP = 86;       // 相鄰地面的高低差上限（跳躍高度 128，留餘裕）
  const PLAYER_W = 22;
  const PLAYER_H = 40;

  /**
   * 裝飾物的視覺寬度（擺位與重疊檢查用）。
   * 放在這裡而不是 sprites.js，因為 levels.js 產生關卡時就要用，
   * 而它的載入順序在 sprites.js 之前。
   */
  const PROP_WIDTH = {
    arcTriomphe: 150, cafe: 100, kiosk: 60, lamp: 26,
    canalHouse: 130, bike: 56, bridge: 160, cow: 80,
    brandenburg: 180, halfTimber: 100, beerTent: 130,
    clockTower: 56, pretzel: 60,
    chalet: 120, cableCar: 820, swissClock: 44,
    pisaTower: 90, trevi: 130, ruinColumns: 110,
    gondola: 80, pizzaStand: 100, vespa: 60,
    blueDome: 90, amphora: 40, statue: 50,
    fishBoat: 180, greekWindmill: 70,
    // 新國家
    sagrada: 160, plazaFountain: 90, guitar: 40, orangeTree: 60,
    bigben: 90, phoneBox: 34, doubleDecker: 110,
    charlesbridge: 190, astroClock: 60, redRoofHouse: 100,
    operahouse: 170, ferrisWheel: 140, pianoBench: 70,
    // 東歐篇
    wawelDragon: 60, paprikaStall: 80, thermalPool: 112,
    graveStone: 26, deadTree: 60, branCastle: 300,
    roseBush: 56, sunflowers: 72, lavraProp: 340,
    // 北歐篇（v1.30）
    mermaid: 64, dalaHorse: 50, runestone: 40, sauna: 96, reindeer: 76, lavaRock: 62,
    // 美洲篇（v1.31）
    classicCar: 112, bongos: 40, soundSystem: 70, coffeeSacks: 64, canalMule: 76, shipContainer: 120, balcony: 84, beachKiosk: 80
  };

  /**
   * 高大的建築物歸「背景層」：用視差畫在地形後面，不會跟平台/樹打架。
   * 小件的生活道具歸「前景層」：貼著地面畫，增加現場感。
   */
  const PROP_LAYER = {
    arcTriomphe: 'bg', brandenburg: 'bg', pisaTower: 'bg',
    canalHouse: 'bg', halfTimber: 'bg', chalet: 'bg',
    clockTower: 'bg', swissClock: 'bg', greekWindmill: 'bg',
    blueDome: 'bg', trevi: 'bg', ruinColumns: 'bg',
    beerTent: 'bg', cableCar: 'bg',
    sagrada: 'bg', bigben: 'bg', charlesbridge: 'bg',
    operahouse: 'bg', ferrisWheel: 'bg', redRoofHouse: 'bg',
    astroClock: 'bg',
    cafe: 'fg', kiosk: 'fg', lamp: 'fg', bike: 'fg', cow: 'fg',
    pretzel: 'fg', gondola: 'fg', pizzaStand: 'fg', vespa: 'fg',
    amphora: 'fg', statue: 'fg', bridge: 'fg', fishBoat: 'fg',
    plazaFountain: 'fg', guitar: 'fg', orangeTree: 'fg',
    phoneBox: 'fg', doubleDecker: 'fg', pianoBench: 'fg',
    branCastle: 'bg', lavraProp: 'bg', roseBush: 'fg', sunflowers: 'fg',
    wawelDragon: 'fg', paprikaStall: 'fg', thermalPool: 'fg', graveStone: 'fg', deadTree: 'fg',
    mermaid: 'fg', dalaHorse: 'fg', runestone: 'fg', sauna: 'fg', reindeer: 'fg', lavaRock: 'fg',
    classicCar: 'fg', bongos: 'fg', soundSystem: 'fg', coffeeSacks: 'fg', canalMule: 'fg', shipContainer: 'fg', balcony: 'fg', beachKiosk: 'fg'
  };

  /** 可重現的偽隨機 */
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5;  s >>>= 0;
      return s / 4294967296;
    };
  }

  function pick(r, arr) {
    return arr[Math.floor(r() * arr.length) % arr.length];
  }

  function randInt(r, lo, hi) {
    return lo + Math.floor(r() * (hi - lo + 1));
  }

  /**
   * 產生地面段。
   *
   * profile：
   *   'flat'   全部同高（傳統橫向關）
   *   'hills'  高低起伏，但都在一個畫面內
   *   'climb'  整體往上爬（垂直關卡，終點在高處）
   *   'descend' 整體往下走（終點在低處）
   */
  function buildGround(r, opts) {
    const width = opts.width;
    const profile = opts.profile || 'flat';
    const baseY = opts.baseY != null ? opts.baseY : GROUND_Y;
    if (profile === 'train') return buildTrain(r, width, baseY);
    if (profile === 'cable') return buildCable(r, width, baseY);
    const segs = [];
    const gaps = [];

    // 起點一定給一段平地，讓玩家站穩
    let x = 0;
    let y = baseY;
    const startW = 280;
    segs.push({ x: 0, y: y, w: startW });
    x = startW;

    // 爬升/下降的總落差，平均分給每一段
    const climbTotal = profile === 'climb' ? -(opts.climb || 0)
                     : profile === 'descend' ? (opts.climb || 0)
                     : 0;

    const nSeg = Math.max(6, Math.round(width / 760));
    const perStep = nSeg > 1 ? climbTotal / (nSeg - 1) : 0;

    for (let i = 0; i < nSeg && x < width - 420; i++) {
      // 斷崖
      const gw = randInt(r, 72, MAX_GAP);
      gaps.push({ x: x, w: gw });
      x += gw;

      // 下一段的高度
      let ny = y + perStep;
      if (profile === 'hills') {
        ny = baseY + randInt(r, -70, 40);
      } else if (profile === 'climb' || profile === 'descend') {
        ny += randInt(r, -22, 22);
      } else {
        ny = baseY;
      }
      // 夾住：不能太高（頂到天）也不能太低（掉出世界）
      ny = Math.max(150, Math.min(baseY + 120, ny));
      // 高低差不能超過跳得上去的範圍
      if (ny < y - MAX_STEP) ny = y - MAX_STEP;
      if (ny > y + MAX_STEP) ny = y + MAX_STEP;
      ny = Math.round(ny);

      const segW = randInt(r, 340, 620);
      segs.push({ x: x, y: ny, w: segW });
      x += segW;
      y = ny;
    }

    // 最後一段補到底，終點放這裡
    if (x < width) {
      segs.push({ x: x, y: y, w: width - x });
    }

    return { segs: segs, gaps: gaps, endY: y };
  }

  /*
   * v1.20 東歐交通關：火車（東方快車）與纜車。地面段的意義換掉，其餘產生流程（敵人、金幣、
   * 密道、招牌機制、居民）完全照舊 —— 它們只看「地面段＋斷崖」，不在乎那段地面是什麼。
   */

  /**
   * 火車：每一段地面 = 一節車廂的車頂，斷崖 = 車廂之間的連結處（掉下去就摔到鐵軌上）。
   * 整列車在世界座標裡是靜止的，「在跑」的感覺靠背景的鐵軌、電線桿往後飛（見 Sprites.trainTrack）。
   * 車廂間距 80~104：比一般斷崖窄一點（車廂本來就靠很近），但一定要跳；
   * ≥ 90 的有一半以上 —— 塞爾維亞的「斷橋」要放在夠寬、兩側等高的縫上（Features.plan）。
   * 最後一段 = 車頭（至少 520 寬，終點在 62% 的位置，車頭畫在最後面）。
   */
  function buildTrain(r, width, baseY) {
    const segs = [], gaps = [];
    let x = 0;
    // 每次都留得下「這節最長 420 + 縫 104 + 車頭 520」，車頭才不會超出關卡寬度（超出就走不到終點）
    while (x + 420 + 104 + 520 <= width) {
      const w = randInt(r, 300, 420);
      segs.push({ x: x, y: baseY, w: w, car: true });
      x += w;
      const gw = randInt(r, 80, 104);
      gaps.push({ x: x, w: gw });
      x += gw;
    }
    segs.push({ x: x, y: baseY, w: width - x, loco: true });
    return { segs: segs, gaps: gaps, endY: baseY };
  }

  /**
   * 纜車：地面段 = 山上的纜車站（平台），斷崖 = 站與站之間的山谷（寬 300~380，跳不過去）。
   * 每個山谷配一台纜車（buildMovers 的 gondolas 選項）來回接送。
   * 站都在同一個高度：纜車只沿著纜線水平走，兩頭要剛好接得上月台。
   */
  function buildCable(r, width, baseY) {
    const segs = [], gaps = [];
    let x = 0;
    segs.push({ x: 0, y: baseY, w: 420, station: true });
    x = 420;
    // 每次都留得下「這一段（谷 380 + 站 520）+ 終點（谷 360 + 站 520）」，終點站才不會超出關卡寬度
    while (x + (380 + 520) + (360 + 520) <= width) {
      const gw = randInt(r, 300, 380);
      gaps.push({ x: x, w: gw, valley: true });
      x += gw;
      const w = randInt(r, 380, 520);
      segs.push({ x: x, y: baseY, w: w, station: true });
      x += w;
    }
    // 最後一段：終點站
    const gw = randInt(r, 300, 360);
    gaps.push({ x: x, w: gw, valley: true });
    x += gw;
    segs.push({ x: x, y: baseY, w: width - x, station: true });
    return { segs: segs, gaps: gaps, endY: baseY };
  }

  /**
   * 纜車：每個山谷一台，沿著纜線在兩站之間來回（x 軸、正弦擺動 —— 兩頭會自然減速停靠）。
   * 兩頭各離月台邊 2px：不跟地面重疊（level-check 4b），玩家走過 2px 的縫完全沒感覺。
   * 速度 0.8~1.0：最快約 3px/帧；在月台邊 10px 內停留約 40 帧，夠走上去。
   */
  const GONDOLA_W = 96;
  function buildGondolas(r, segs, gaps) {
    return gaps.map(function (g) {
      const floor = groundAt(segs, g.x - 6);
      return {
        x: Math.round(g.x + g.w / 2 - GONDOLA_W / 2), y: floor,
        w: GONDOLA_W, h: 18,
        axis: 'x',
        range: Math.round(g.w / 2 - GONDOLA_W / 2 - 2),
        speed: 0.8 + r() * 0.2,
        gondola: true
      };
    });
  }

  /** 地面段轉成碰撞矩形。高度補到世界底部，免得側面看到空隙。 */
  function groundRects(segs, worldH) {
    return segs.map(function (s) {
      return { x: s.x, y: s.y, w: s.w, h: Math.max(GROUND_H, worldH - s.y) };
    });
  }

  /** 查詢某個 x 的地面高度（沒有地面回 null） */
  function groundAt(segs, x) {
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (x >= s.x && x <= s.x + s.w) return s.y;
    }
    return null;
  }

  /**
   * 在地面上方擺平台。
   * 每段地面放 1~3 座，高度相對該段地面，確保跳得到。
   */
  function buildPlatforms(r, segs, opts) {
    const out = [];
    const tiers = opts.tiers || [92, 164];   // 相對地面的高度
    segs.forEach(function (s, si) {
      if (s.w < 300) return;
      const n = Math.min(3, Math.floor(s.w / 300));
      for (let i = 0; i < n; i++) {
        const pw = randInt(r, 96, 140);
        // 平均分布在這段地面內，留邊界餘裕
        const slot = s.w / n;
        const px = Math.round(s.x + slot * i + randInt(r, 40, Math.max(40, slot - pw - 40)));
        if (px + pw > s.x + s.w - 30) continue;
        const tier = tiers[(si + i) % tiers.length];
        const py = Math.round(s.y - tier);
        if (py < 120) continue;          // 太高頂到 HUD
        out.push({ x: px, y: py, w: pw, h: 20 });
      }
    });
    return out;
  }

  /**
   * 移動平台。放在斷崖上方，當成過關的替代路線。
   *
   * ⚠️ y 軸平台的「行程最低點」必須高於兩側地面，否則平台會沉進土裡
   * （玩家站上去會被地面卡住，看起來像 bug）。所以要同時看斷崖左右
   * 兩段地面的較高者（y 值較小者），再從那裡往上扣 range。
   */
  function buildMovers(r, segs, gaps, opts) {
    const out = [];
    if (opts.gondolas) return buildGondolas(r, segs, gaps);
    if (!opts.movers) return out;
    gaps.forEach(function (g, i) {
      if (i % 2 !== 0) return;           // 隔一個放，不要每個斷崖都有
      const leftY = groundAt(segs, g.x - 10);
      const rightY = groundAt(segs, g.x + g.w + 10);
      if (leftY == null && rightY == null) return;
      const axis = (i % 4 === 0) ? 'x' : 'y';
      const range = axis === 'x' ? 70 : 80;
      const MOVER_H = 18;

      /*
       * 基準高度要取「平台行程會經過的所有地面中，最高的那一層」。
       *
       * 注意 y 軸向下為正，所以「最高的地面」= y 值最小。
       * 之前用 Math.max（最低的地面）當基準，結果平台往下擺時
       * 會穿進較高的那一側地面 —— 垂直關卡左右高低差大，這很明顯。
       */
      const spanA = axis === 'x' ? (g.x + g.w / 2 - 45) - range
                                 : (g.x + g.w / 2 - 45);
      const spanB = axis === 'x' ? (g.x + g.w / 2 - 45) + 90 + range
                                 : (g.x + g.w / 2 - 45) + 90;
      let floor = null;
      segs.forEach(function (s) {
        if (s.x + s.w < spanA || s.x > spanB) return;
        if (floor == null || s.y < floor) floor = s.y;
      });
      if (floor == null) {
        floor = Math.min(leftY == null ? rightY : leftY,
                         rightY == null ? leftY : rightY);
      }

      // 最低點（y 軸平台是 y+range+h）必須高於地面，留 12px 餘裕
      const clearance = (axis === 'y' ? range : 0) + MOVER_H + 12;
      const y = Math.round(floor - clearance);
      if (y < 140) return;               // 太高會頂到 HUD
      if (y - range < 60) return;        // y 軸平台最高點也不能衝進 HUD
      out.push({
        x: Math.round(g.x + g.w / 2 - 45), y: y,
        w: 90, h: 18,
        axis: axis,
        range: range,
        speed: 1 + r() * 0.4
      });
    });
    return out;
  }

  /**
   * 金幣。
   * 三種擺法：地面上一排、平台上一排、跨斷崖的拱形（提示跳躍路線）。
   */
  function buildCoins(r, segs, gaps, platforms) {
    const out = [];

    // 地面排：擺在地面上方 50px，不會卡進地形
    segs.forEach(function (s) {
      if (s.w < 220) return;
      const n = Math.min(5, Math.floor(s.w / 190));
      for (let i = 0; i < n; i++) {
        const cx = Math.round(s.x + 70 + i * 160 + randInt(r, 0, 30));
        if (cx > s.x + s.w - 60) continue;
        out.push({ x: cx, y: s.y - 50 });
      }
    });

    // 平台排：平台正上方
    platforms.forEach(function (pf, i) {
      if (i % 2 !== 0) return;
      const n = Math.min(3, Math.floor(pf.w / 40));
      for (let k = 0; k < n; k++) {
        out.push({ x: Math.round(pf.x + 16 + k * 34), y: pf.y - 34 });
      }
    });

    // 斷崖拱形
    gaps.forEach(function (g) {
      const ly = groundAt(segs, g.x - 6);
      const ry = groundAt(segs, g.x + g.w + 6);
      if (ly == null || ry == null) return;
      const base = Math.min(ly, ry) - 46;
      const n = 4;
      for (let i = 0; i < n; i++) {
        const tt = (i / (n - 1)) * 2 - 1;
        out.push({
          x: Math.round(g.x + (g.w / (n - 1)) * i - 12),
          y: Math.round(base - 34 * (1 - tt * tt))
        });
      }
    });

    return out;
  }

  /**
   * 敵人。
   * 巡邏範圍一律限制在「單一地面段」內，所以不可能飄過斷崖。
   * 型別依關卡難度給，越後面的關卡越兇。
   */
  function buildEnemies(r, segs, opts) {
    const out = [];
    const groundTypes = opts.groundTypes || ['walker'];
    const airTypes = opts.airTypes || ['flyer'];
    const density = opts.density || 1;

    segs.forEach(function (s, si) {
      if (s.w < 260) return;
      const n = Math.max(1, Math.round(s.w / 520 * density));
      for (let i = 0; i < n; i++) {
        const slot = s.w / n;
        // 巡邏範圍完全落在這段地面內，兩側各留 40px
        const left = Math.round(s.x + slot * i + 40);
        const right = Math.round(Math.min(s.x + s.w - 40, left + randInt(r, 90, 260)));
        if (right - left < 60) continue;

        if (r() < 0.26 && airTypes.length) {
          // 空中敵人：y 用該段地面往上算
          out.push({
            x: Math.round((left + right) / 2),
            type: pick(r, airTypes),
            left: left, right: right,
            y: Math.round(s.y - randInt(r, 120, 190))
          });
        } else {
          const ty = pick(r, groundTypes);
          if (ty === 'turret') {
            // 砲台不移動，範圍給很窄
            const tx = Math.round((left + right) / 2);
            out.push({ x: tx, type: 'turret', left: tx, right: tx + 30 });
          } else {
            out.push({ x: Math.round((left + right) / 2), type: ty, left: left, right: right });
          }
        }
      }
    });
    /*
     * 開場安全區：出生點（x=120）附近不放敵人。
     *
     * ⚠️ 之前第一段地面的第一個巡邏區就從 x=40 開始，敵人直接生在玩家身上，
     * 一進關卡什麼都沒按就被撞（西班牙、法國、德國、波蘭、匈牙利都是）。
     * 用「排完再濾掉」而不是改排法：亂數序列不變，其他地方的敵人位置維持原樣。
     * 560 = 出生點 + 一個畫面左右的距離，玩家有時間看清楚再接戰。
     */
    return out.filter(function (e) { return e.left >= SAFE_START; });
  }

  /** 出生點右邊這段距離內不放敵人（見 buildEnemies），tests/spawn-check.js 會驗 */
  const SAFE_START = 560;

  /**
   * 密道。
   * 找一段夠寬、沒有平台/移動平台/金幣/敵人佔用的地面，把密室塞在地面層。
   * 回傳 null 表示這關找不到合適位置（呼叫端要能接受）。
   */
  function buildSecret(segs, gaps, platforms, movers, coins, enemies, opts) {
    const RW = opts.w || 200;
    const RH = 60;
    const blockers = [];

    gaps.forEach(function (g) {
      blockers.push({ x: g.x - 40, y: 0, w: g.w + 80, h: 600 });
    });
    platforms.forEach(function (p) { blockers.push(p); });
    movers.forEach(function (m) {
      blockers.push(m.axis === 'x'
        ? { x: m.x - m.range, y: m.y, w: m.w + m.range * 2, h: m.h }
        : { x: m.x, y: m.y - m.range, w: m.w, h: m.h + m.range * 2 });
    });
    coins.forEach(function (c) { blockers.push({ x: c.x, y: c.y, w: 24, h: 24 }); });
    // 終點旗附近不放：旗杆會插在密室中間，而且玩家衝終點時根本不會停下來找
    // v1.31：終點後面也不放（碰到終點就過關了，後面的密室、裝備永遠拿不到）
    if (opts.goal != null) blockers.push({ x: opts.goal - 160, y: 0, w: 100000, h: 600 });
    enemies.forEach(function (e) {
      // ⚠️ 地面敵人沒有 y（貼地走）。原本當成 y=0，擋的是畫面頂端，
      // 等於完全沒擋到 —— 密室會蓋在地面敵人的巡邏路線上。地面敵人整欄都擋。
      if (e.y == null) {
        blockers.push({ x: e.left - 20, y: 0, w: (e.right - e.left) + 40, h: 600 });
      } else {
        blockers.push({ x: e.left - 20, y: e.y - 20, w: (e.right - e.left) + 40, h: 90 });
      }
    });

    function hits(box) {
      for (let i = 0; i < blockers.length; i++) {
        const b = blockers[i];
        if (box.x < b.x + b.w && box.x + box.w > b.x &&
            box.y < b.y + b.h && box.y + box.h > b.y) return true;
      }
      return false;
    }

    // 從偏好的位置開始找（opts.near），找不到就全掃
    const order = [];
    const prefer = opts.near || 0.5;
    for (let i = 0; i < segs.length; i++) order.push(i);
    order.sort(function (a, b) {
      const ca = (segs[a].x + segs[a].w / 2);
      const cb = (segs[b].x + segs[b].w / 2);
      const total = segs[segs.length - 1].x + segs[segs.length - 1].w;
      return Math.abs(ca / total - prefer) - Math.abs(cb / total - prefer);
    });

    for (let oi = 0; oi < order.length; oi++) {
      const s = segs[order[oi]];
      if (s.w < RW + 120) continue;
      /*
       * 密室高度的關鍵約束：
       *
       * 玩家站在這段地面上時，身體佔 [s.y - PLAYER_H, s.y]。
       * 密室必須跟這個區間重疊，玩家才走得進去、裝備才撿得到。
       * 之前把密室埋在 s.y + 14（地面以下）→ 入口在腳底下，
       * 走過去永遠觸發不了，裝備也永遠拿不到。
       *
       * 正確做法：密室底部對齊地面線，往上挖 RH 高。
       */
      const ry = s.y - RH;                     // 室頂
      const floorY = s.y;                      // 室底 = 地面線
      if (ry < 120) continue;                  // 太高會頂到 HUD
      for (let px = s.x + 50; px + RW < s.x + s.w - 50; px += 20) {
        const room = { x: px, y: ry, w: RW, h: RH };
        if (hits(room)) continue;
        /*
         * 隱形磚：密道不再一開始就看得到。
         *
         * 舊版的假牆是一塊凸出地面 200x60 的方塊，平地上突然多一塊，
         * 玩家一眼就知道「這裡有東西」。現在密室平常完全不畫，
         * 要在它上方找到一塊「隱形磚」從下面頂一下，密室入口才會浮出來。
         *
         * 高度：磚底在地面上方 112px。玩家站著頭頂在 -40，
         * 基礎跳躍頭頂能到 -168，一跳就頂得到；但站著走過去不會碰到。
         * 磚的那一整欄（到地面）不能有平台或敵人，否則根本跳不到底下。
         */
        const BW = 34, BH = 22;
        const block = { x: px + RW / 2 - BW / 2, y: floorY - 112 - BH, w: BW, h: BH };
        const column = { x: block.x - 16, y: block.y - 30, w: BW + 32, h: floorY - block.y + 30 };
        if (hits(column)) continue;
        return {
          room: room,
          block: block,
          // 觸發區放在室內下半部，玩家走進來就會碰到
          trigger: { x: px + 12, y: ry + 10, w: RW - 24, h: RH - 14 },
          hint: opts.hint || '這面牆後面有風吹出來⋯⋯',
          holdsEquip: !!opts.holdsEquip,
          // 裝備放在室內地板上方，跟站著的玩家身體重疊
          equipAt: { x: px + 42, y: floorY - 20 },
          coins: [
            { x: px + 92, y: floorY - 34 },
            { x: px + 124, y: floorY - 34 },
            { x: px + 156, y: floorY - 34 }
          ]
        };
      }
    }
    return null;
  }

  /*
   * 岔路密道（v1.9）。
   *
   * 玩家回報：密道只是地上一間小房間，進去拿完就出來，沒有「走另一條路」的感覺。
   * 改成：頂出隱形磚 → 旁邊浮出一塊彈跳墊 → 彈上空中一條平常看不到的路，
   * 跟主線平行往前走一大段，裝備就放在這條路的盡頭，走完再跳回主線。
   *
   *   磚     地面上方 112px（跟密室版一樣，一跳頂得到）
   *   彈跳墊 磚右邊，彈起約 320px（BRANCH_PAD_V）
   *   空路   頂面在地面上方 250px，5 塊平台、每塊 140 寬、間隔 85
   *
   * 高度的取捨：主線最高一層平台在地面上方 162，站在上面頭頂到 202；
   * 空路底面在 234 → 不會卡頭。彈跳墊彈到 322，比空路高 72，夠落上去。
   * 第一塊空路平台離墊子 150px：墊子上起跳時還在空路下方，太近會從側面撞上去。
   */
  const BRANCH_PAD_V = -20;
  const BRANCH = { rise: 250, n: 5, pw: 140, gap: 85, h: 16, padW: 56, toFirst: 150 };

  function buildBranch(segs, gaps, platforms, movers, coins, enemies, opts) {
    const B = BRANCH;
    const ground = [];          // 地面附近的阻擋物（入口那一段要淨空）
    const sky = [];             // 空路附近的阻擋物
    gaps.forEach(function (g) { ground.push({ x: g.x - 40, y: 0, w: g.w + 80, h: 600 }); });
    platforms.forEach(function (p) { ground.push(p); sky.push(p); });
    movers.forEach(function (m) {
      const box = m.axis === 'x'
        ? { x: m.x - m.range, y: m.y, w: m.w + m.range * 2, h: m.h }
        : { x: m.x, y: m.y - m.range, w: m.w, h: m.h + m.range * 2 };
      ground.push(box); sky.push(box);
    });
    // 金幣不擋：入口與空路上的主線金幣由呼叫端拿掉（見 clearZone），不然幾乎每段都放不下
    if (opts.goal != null) {
      const gz = { x: opts.goal - 260, y: 0, w: 100000, h: 600 };     // v1.31：連終點後面一起擋
      ground.push(gz); sky.push(gz);
    }
    enemies.forEach(function (e) {
      if (e.y == null) ground.push({ x: e.left - 20, y: 0, w: (e.right - e.left) + 40, h: 600 });
      else {
        const box = { x: e.left - 20, y: e.y - 20, w: (e.right - e.left) + 40, h: 90 };
        ground.push(box); sky.push(box);
      }
    });
    function hits(list, box) {
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y) return true;
      }
      return false;
    }
    function inGap(x) {
      for (let i = 0; i < gaps.length; i++) if (x > gaps[i].x - 30 && x < gaps[i].x + gaps[i].w + 30) return true;
      return false;
    }

    const total = segs[segs.length - 1].x + segs[segs.length - 1].w;
    const order = segs.map(function (_, i) { return i; });
    const prefer = opts.near || 0.4;
    order.sort(function (a, b) {
      return Math.abs((segs[a].x + segs[a].w / 2) / total - prefer) -
             Math.abs((segs[b].x + segs[b].w / 2) / total - prefer);
    });

    const BW = 34, BH = 22;
    for (let oi = 0; oi < order.length; oi++) {
      const s = segs[order[oi]];
      const floorY = s.y;
      const pathY = floorY - B.rise;
      if (pathY < 100) continue;                      // 太高會頂到 HUD
      for (let bx = s.x + 60; bx < s.x + s.w; bx += 20) {
        const padX = bx + BW + 36;
        const p0 = padX + B.toFirst;
        // 磚、墊子、起跳的弧線底下都要是同一段地面（彈歪了掉回來不能是斷崖）
        if (padX + B.padW + 60 > s.x + s.w - 20) break;
        if (bx < SAFE_START) continue;
        const entry = { x: bx - 16, y: pathY - 40, w: p0 - (bx - 16), h: floorY - pathY + 40 };
        if (hits(ground, entry)) continue;

        const path = [];
        let ok = true;
        const n = opts._short ? B.n - 1 : B.n;
        for (let i = 0; i < n && ok; i++) {
          const px = p0 + i * (B.pw + B.gap);
          const pf = { x: px, y: pathY, w: B.pw, h: B.h };
          if (px + B.pw > total - 40) { ok = false; break; }
          // 上下要留空間：上面站人、下面不能有主線平台頂到頭
          // 底下留 48px：站在底下平台上的人頭頂到空路底面至少還有 8px（地面上 162 那層平台剛好過）
          if (hits(sky, { x: px - 20, y: pathY - 60, w: B.pw + 40, h: 60 + B.h + 48 })) ok = false;
          // 起伏地形：地面不能長得太高，貼到空路底下
          [px, px + B.pw / 2, px + B.pw].forEach(function (x) {
            const gy = groundAt(segs, x);
            if (gy != null && gy - pathY < 200) ok = false;
          });
          path.push(pf);
        }
        if (!ok) continue;
        // 空路走完要能安全落回主線：盡頭前方是實地，不是斷崖
        const last = path[path.length - 1];
        const endX = last.x + last.w;
        // 從 250px 高跑著掉下來，會往前飄 130px 左右 → 前方 220px 都要是實地
        if ([20, 60, 100, 140, 180, 220].map(function (d) { return endX + d; }).some(function (x) { return groundAt(segs, x) == null || inGap(x); })) continue;

        const block = { x: bx, y: floorY - 112 - BH, w: BW, h: BH };
        const pad = { x: padX, y: floorY, w: B.padW, h: 10 };
        const pathCoins = [];
        path.forEach(function (pf, i) {
          if (i === path.length - 1) return;
          pathCoins.push({ x: pf.x + 30, y: pathY - 34 }, { x: pf.x + 86, y: pathY - 34 });
          // 平台之間的空中也放一枚，引導玩家往前跳
          pathCoins.push({ x: pf.x + pf.w + B.gap / 2 - 12, y: pathY - 70 });
        });
        return {
          kind: 'branch',
          // room = 地面上的入口區（磚 + 彈跳墊那一段），裝飾物、招牌機制都要避開
          room: { x: bx - 16, y: floorY - 60, w: padX + B.padW + 16 - (bx - 16), h: 60 },
          block: block,
          pad: pad,
          path: path,
          padV: BRANCH_PAD_V,
          clearZone: entry,
          // 落上第一塊空路平台 = 發現密道
          trigger: { x: path[0].x, y: pathY - 44, w: path[0].w, h: 44 },
          // 整條岔路的包圍盒（繪製裁切、招牌機制避讓用）
          span: { x: bx - 16, y: pathY - 60, w: endX + 16 - (bx - 16), h: floorY - pathY + 60 },
          hint: opts.hint || '屋頂上有一條沒人知道的近路',
          holdsEquip: !!opts.holdsEquip,
          equipAt: { x: last.x + last.w - 36, y: pathY - 20 },
          coins: pathCoins
        };
      }
    }
    // 5 塊放不下就試 4 塊的短岔路
    if (!opts._short) return buildBranch(segs, gaps, platforms, movers, coins, enemies, Object.assign({}, opts, { _short: true }));
    return null;
  }

  /**
   * 把手寫的裝飾物搬到合法位置。
   *
   * 裝飾物的 x 是人工指定的（哪個國家擺什麼、大概在哪），但地形是
   * 產生器鋪的，所以常常撞到：站在斷崖上空、被低平台壓住、
   * 壓在密室上、或兩個裝飾疊在一起。
   *
   * 這個函式保留「原本想擺的位置」當偏好，往兩側找最近的合法點。
   * 找不到就整個丟掉 —— 裝飾是純裝飾，少一個不影響玩法，
   * 留著壞位置反而難看。
   *
   * widthOf(type) 要回傳該裝飾的視覺寬度，layerOf(type) 回 'bg' / 'fg'。
   */
  function placeProps(props, ctx2) {
    const segs = ctx2.segs;
    const gaps = ctx2.gaps;
    const platforms = ctx2.platforms || [];
    const secrets = ctx2.secrets || [];
    const widthOf = ctx2.widthOf;
    const layerOf = ctx2.layerOf;
    const worldW = ctx2.width;

    const placed = [];

    function overlaps(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x &&
             a.y < b.y + b.h && a.y + a.h > b.y;
    }

    /** 這個 x 擺得下嗎？ */
    function ok(type, x) {
      const pw = widthOf(type);
      const layer = layerOf(type);
      const half = pw / 2;

      // 1. 整個底座都要站在同一段連續地面上
      const gLeft = groundAt(segs, x - half);
      const gMid = groundAt(segs, x);
      const gRight = groundAt(segs, x + half);
      if (gLeft == null || gMid == null || gRight == null) return false;
      // 跨越高低差太大的地面接縫會看起來浮空
      if (Math.abs(gLeft - gRight) > 4) return false;

      // 2. 不可跨在斷崖上（連邊緣都不行，會半邊浮空）
      for (let i = 0; i < gaps.length; i++) {
        const g = gaps[i];
        if (x - half < g.x + g.w + 10 && x + half > g.x - 10) return false;
      }

      /*
       * 3. 跟平台的關係。
       *
       * 判定條件必須跟 tests/level-check.js 的 5c / 5d 一致，
       * 否則產生器以為沒問題、測試卻報錯（之前就是這樣：
       * 這裡只看水平重疊量，測試還多看了平台高度）。
       *
       * bg（高大建築）：重疊 > 30px 且平台位於建築的垂直範圍內（gMid-180 以下）
       * fg（小道具）  ：被 gMid-110 以下的低平台壓住
       */
      for (let i = 0; i < platforms.length; i++) {
        const pf = platforms[i];
        const left = x - half, right = x + half;
        const ov = Math.min(right, pf.x + pf.w) - Math.max(left, pf.x);
        if (ov <= 0) continue;
        if (layer === 'bg') {
          if (ov > 30 && pf.y > gMid - 180) return false;
        } else {
          if (ov > 20 && pf.y >= gMid - 90) return false;
        }
      }

      // 用於密室/彼此重疊檢查的包圍盒
      const box = { x: x - half, y: gMid - 120, w: pw, h: 120 };

      // 4. 不可壓在密室上（密室打開後裝飾會浮在室內）
      for (let i = 0; i < secrets.length; i++) {
        if (overlaps(box, secrets[i].room)) return false;
      }

      // 5. 不可跟已擺好的裝飾重疊
      for (let i = 0; i < placed.length; i++) {
        const q = placed[i];
        const qHalf = widthOf(q.type) / 2;
        if (Math.abs(q.x - x) < half + qHalf - 6) return false;
      }

      return true;
    }

    props.forEach(function (p) {
      // 從原本想要的位置往外找，step 由小到大
      for (let d = 0; d <= 1400; d += 20) {
        const cands = d === 0 ? [p.x] : [p.x - d, p.x + d];
        for (let k = 0; k < cands.length; k++) {
          const x = cands[k];
          if (x < 60 || x > worldW - 60) continue;
          if (ok(p.type, x)) {
            const copy = {};
            Object.keys(p).forEach(function (key) { copy[key] = p[key]; });
            copy.x = Math.round(x);
            // 記住該站的地面高度，繪製時才知道要貼在哪
            copy.groundY = groundAt(segs, x);
            placed.push(copy);
            return;
          }
        }
      }
      // 找不到合法位置 → 捨棄這個裝飾
    });

    return placed;
  }

  return {
    GROUND_Y: GROUND_Y,
    GROUND_H: GROUND_H,
    MAX_GAP: MAX_GAP,
    MAX_STEP: MAX_STEP,
    SAFE_START: SAFE_START,
    PROP_WIDTH: PROP_WIDTH,
    PROP_LAYER: PROP_LAYER,
    rng: rng,
    randInt: randInt,
    pick: pick,
    buildGround: buildGround,
    groundRects: groundRects,
    groundAt: groundAt,
    buildPlatforms: buildPlatforms,
    buildMovers: buildMovers,
    buildCoins: buildCoins,
    buildEnemies: buildEnemies,
    buildSecret: buildSecret,
    buildBranch: buildBranch,
    BRANCH: BRANCH,
    placeProps: placeProps
  };
})();
