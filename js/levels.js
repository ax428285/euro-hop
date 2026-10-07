'use strict';

/**
 * 十個關卡。
 *
 * 地形由 LevelGen 依規則產生（固定 seed，所以每次都一樣），
 * 各國的主題、裝飾、敵人組合、走向則在這裡指定。
 *
 * 關卡走向（layout）：
 *   'flat'     傳統橫向
 *   'hills'    高低起伏，仍在一個畫面內
 *   'boss'     魔王競技場，一片平地
 *   'shaft'    豎井下墜（「小朋友下樓梯」玩法，見 shaft.js）
 *
 * 註：原本還有 'climb' / 'descend' 兩種「世界比畫面高的橫向關卡」，
 * 但那只是橫向卷軸加高低差，並不是真正的垂直玩法。
 * 已改成 'shaft' —— 畫面往下捲、玩家不斷往下跳、上方有尖刺天花板追。
 *
 * 長度：基準 7200（舊版約 4800 的 1.5 倍）。豎井關不用這個值。
 */
const Levels = (function () {
  const GROUND_Y = LevelGen.GROUND_Y;
  const GROUND_H = LevelGen.GROUND_H;
  const MAX_GAP = LevelGen.MAX_GAP;

  const BASE_WIDTH = 7200;      // 4800 × 1.5

  const list = [];

  /** 魔王關：一片平地競技場 */
  function bossLevel(cfg) {
    const width = cfg.width || 1280;
    return {
      id: cfg.id,
      country: cfg.country,
      city: cfg.city,
      flag: cfg.flag,
      flagDir: cfg.flagDir,
      landmark: cfg.landmark,
      fact: cfg.fact,
      region: cfg.region || 'west',   // 西歐篇 / 東歐篇（東歐要 EXP 解鎖）
      finale: !!cfg.finale,           // 篇章最終關：打完播結局
      sky: cfg.sky,
      cloud: cfg.cloud,   // 雲的顏色（夜景關卡要暗一點），沒給就用白雲
      hill: cfg.hill,
      groundTop: cfg.groundTop,
      groundBody: cfg.groundBody,
      deco: cfg.deco,
      width: width,
      height: 480,
      layout: 'boss',
      spawnX: 120,
      isBoss: true,
      bossArena: { x: 0, y: 0, w: width, h: 480 },
      boss: cfg.boss,
      equipAt: cfg.equipAt,
      ground: [{ x: 0, y: GROUND_Y, w: width, h: GROUND_H }],
      water: [],
      spikes: [],
      props: cfg.props || [],
      platforms: cfg.platforms || [],
      movers: [],
      secrets: [],
      enemies: cfg.enemies || [],
      coins: cfg.coins || [],
      // 出生點旁的當地人，開場提醒魔王打法
      npcs: Npcs.placeBoss(cfg.id, GROUND_Y),
      goal: width
    };
  }

  /**
   * 豎井關卡（「小朋友下樓梯」玩法）。
   *
   * 樓層由 Shaft.plan 用固定 seed 排好，所以可重現、可測試。
   * 跟其他關卡最大的差別：
   *   - 沒有 goal x 座標，過關條件是「降到第 N 層」
   *   - 沒有 ground（底下是無底洞），掉出畫面就死
   *   - 畫面會自己往下捲，玩家不能停
   */
  function shaftLevel(cfg) {
    const pl = Shaft.plan(cfg.seed, {
      mode: cfg.mode,                 // 'climb' 往上爬 / 預設 'descend' 往下降
      floors: cfg.floors || 30,
      gapY: cfg.gapY,
      platW: cfg.platW || 104,
      shaftW: cfg.shaftW || 560,
      scroll: cfg.scroll,
      extras: cfg.extras,
      pendulums: cfg.pendulums,
      notes: cfg.notes,
      chime: cfg.chime,
      calm: cfg.calm
    });

    return {
      id: cfg.id,
      country: cfg.country,
      city: cfg.city,
      flag: cfg.flag,
      flagDir: cfg.flagDir,
      landmark: cfg.landmark,
      fact: cfg.fact,
      region: cfg.region || 'west',   // 西歐篇 / 東歐篇（東歐要 EXP 解鎖）
      finale: !!cfg.finale,           // 篇章最終關：打完播結局
      sky: cfg.sky,
      cloud: cfg.cloud,   // 雲的顏色（夜景關卡要暗一點），沒給就用白雲
      hill: cfg.hill,
      groundTop: cfg.groundTop,
      groundBody: cfg.groundBody,
      deco: cfg.deco,
      theme: cfg.theme || null,

      layout: 'shaft',
      shaft: pl,                 // 整座井的資料（繪製與碰撞都讀它）
      floodTint: cfg.floodTint,  // climb 的追擊物顏色（雪崩白 / 湧水藍）
      width: 960,                // 單畫面寬，不橫向卷軸
      height: pl.height,
      spawnX: pl.spawn.x,
      spawnY: pl.spawn.y,

      // 碰撞：樓層平台 + 兩側石壁。沒有 ground（底下是無底洞）
      ground: [],
      platforms: pl.platforms.concat(pl.walls),
      shaftFloors: pl.platforms,
      water: [],
      spikes: [],
      props: [],
      movers: [],
      secrets: [],
      enemies: [],
      coins: pl.coins,
      // 過關靠深度，不靠 x。給一個不可能達成的 goal 避免誤判
      goal: Infinity,
      goalFloor: pl.goalFloor,
      /*
       * 'goal' = 把裝備放在抵達層「站得到的那一側」。
       * 寫成字串而不是座標，是因為座標要等 Shaft.plan 排完才知道。
       *
       * ⚠️ 不能一律放在 y - 40（抵達層上方）。
       * climb 模式的玩家是從下面跳上抵達層、站在它「上面」——
       * 這點跟 descend 一樣；但抵達層是最高的一層，
       * 放在它上方 40px 其實剛好是玩家站上去後的身體位置，沒問題。
       * 真正的差別是 descend 的玩家從上方落下，-40 在他頭頂；
       * climb 的玩家跳上來時 -40 會先碰到 —— 兩者都拿得到，
       * 所以共用 -40 是對的。這裡保留註解說明為何不需要分流。
       */
      equipAt: cfg.equipAt === 'goal'
        ? { x: pl.shaftX + pl.shaftW / 2, y: pl.goalY - 40 }
        : (cfg.equipAt || null)
    };
  }

  /** 一般關卡：用產生器鋪地形 */
  function makeLevel(cfg) {
    const r = LevelGen.rng(cfg.seed);
    const layout = cfg.layout || 'flat';
    const width = cfg.width || BASE_WIDTH;

    // 垂直關卡：世界比畫面高
    const tall = layout === 'climb' || layout === 'descend';
    const climb = tall ? (cfg.climb || 260) : 0;
    // 往上爬 → 起點在低處（世界底部）；往下走 → 起點在高處
    const baseY = layout === 'climb' ? GROUND_Y + climb
                : layout === 'descend' ? GROUND_Y - 40
                : GROUND_Y;
    const worldH = tall ? 480 + climb + 80 : 480;

    /*
     * v1.20 東歐交通關（cfg.vehicle）：
     *   'train'  東方快車 —— 地面段是車廂頂、斷崖是車廂連結處；不放浮空平台與移動平台（火車上不會有）
     *   'cable'  纜車 —— 地面段是纜車站、斷崖是跳不過去的山谷，每個山谷一台纜車
     */
    const vehicle = cfg.vehicle || null;
    const g = LevelGen.buildGround(r, {
      width: width,
      profile: vehicle || (layout === 'boss' ? 'flat' : layout),
      baseY: baseY,
      climb: climb
    });

    const platforms = vehicle === 'train' ? [] : LevelGen.buildPlatforms(r, g.segs, {
      tiers: cfg.tiers || [92, 162]
    });
    const movers = LevelGen.buildMovers(r, g.segs, g.gaps, {
      movers: cfg.movers !== false && vehicle !== 'train',
      gondolas: vehicle === 'cable'
    });
    const coins = LevelGen.buildCoins(r, g.segs, g.gaps, platforms);
    const enemies = LevelGen.buildEnemies(r, g.segs, {
      groundTypes: cfg.groundTypes,
      airTypes: cfg.airTypes,
      density: cfg.density
    });

    const secrets = [];
    // 終點位置（跟下面 return 的 goal 同一個算法），密道要避開
    const lastSeg0 = g.segs[g.segs.length - 1];
    const goalX = Math.round(lastSeg0.x + lastSeg0.w * 0.62);
    const secretOpts = {
      holdsEquip: true,
      hint: cfg.secretHint,
      near: cfg.secretNear,
      goal: goalX
    };
    /*
     * v1.9：橫向關卡優先做「岔路密道」（頂磚 → 彈跳墊 → 空中的另一條路，裝備在盡頭）。
     * 放不下才退回地面小密室。cfg.secretKind = 'room' 可以強制用舊式密室。
     */
    let sc = null;
    if (!tall && cfg.secretKind !== 'room') {
      const bOpts = { holdsEquip: true, hint: cfg.branchHint, near: cfg.secretNear, goal: goalX };
      sc = LevelGen.buildBranch(g.segs, g.gaps, platforms, movers, coins, enemies, bOpts);
      if (!sc) {
        // 備案同密室版：先不管敵人找位置，再把擋路的敵人移走
        sc = LevelGen.buildBranch(g.segs, g.gaps, platforms, movers, coins, [], bOpts);
        if (sc) {
          for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            const zone = e.y == null ? { x: sc.room.x - 40, w: sc.room.w + 80 } : { x: sc.span.x - 40, w: sc.span.w + 80 };
            const near = e.y == null || Math.abs(e.y - sc.path[0].y) < 120;
            if (near && e.left < zone.x + zone.w && e.right > zone.x) enemies.splice(i, 1);
          }
        }
      }
      if (sc) {
        // 主線金幣若剛好落在空路平台裡（現形後會被埋住）或入口那一欄（擋住彈跳的視線）→ 拿掉
        const cz = sc.clearZone;
        for (let i = coins.length - 1; i >= 0; i--) {
          const c = coins[i];
          if (c.x < cz.x + cz.w && c.x + 24 > cz.x && c.y < cz.y + cz.h && c.y + 24 > cz.y) { coins.splice(i, 1); continue; }
          if (sc.path.some(function (pf) {
            return c.x < pf.x + pf.w + 4 && c.x + 24 > pf.x - 4 && c.y < pf.y + pf.h + 4 && c.y + 24 > pf.y - 4;
          })) coins.splice(i, 1);
        }
      }
    }
    if (!sc) sc = LevelGen.buildSecret(g.segs, g.gaps, platforms, movers, coins, enemies, secretOpts);
    /*
     * 找不到位置的備案：先不管敵人擺密道，再把巡邏路線擋到密室的敵人移走。
     *
     * 水上關（匈牙利、塞爾維亞）斷崖多、每段地面短，地面敵人又會擋住整欄，
     * 常常「每一段都有敵人」→ 密道放不下 → 那一國的裝備根本拿不到。
     * 以前靠換 seed 碰運氣，塞爾維亞試了 8 個都不行；改成保證放得下。
     */
    if (!sc) {
      sc = LevelGen.buildSecret(g.segs, g.gaps, platforms, movers, coins, [], secretOpts);
      if (sc) {
        const clearZone = { x: sc.room.x - 60, w: sc.room.w + 120 };
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          if (e.left < clearZone.x + clearZone.w && e.right > clearZone.x) enemies.splice(i, 1);
        }
      }
    }
    /*
     * 最後的備案（v1.20 纜車關）：車站短（380~520），站上一排金幣加敵人就把 200 寬的密室擠不下了。
     * 連金幣也先不管，找到位置後把擋到密室的金幣移走。前面幾種都放得下的關卡不會走到這裡。
     */
    if (!sc) {
      sc = LevelGen.buildSecret(g.segs, g.gaps, platforms, movers, [], [], secretOpts);
      if (sc) {
        const rz = { x: sc.room.x - 60, w: sc.room.w + 120 };
        for (let i = enemies.length - 1; i >= 0; i--) {
          if (enemies[i].left < rz.x + rz.w && enemies[i].right > rz.x) enemies.splice(i, 1);
        }
        for (let i = coins.length - 1; i >= 0; i--) {
          const c = coins[i];
          if (c.x < sc.room.x + sc.room.w + 10 && c.x + 24 > sc.room.x - 10 &&
              c.y < sc.room.y + sc.room.h && c.y + 24 > sc.room.y - 140) coins.splice(i, 1);
        }
      }
    }
    if (sc) {
      secrets.push(sc);
      /*
       * 引路金幣：浮在隱形磚正下方（磚底在地面上 112，金幣在 80~104）。
       * 玩家看到金幣自然會跳起來吃，頭就順勢頂到磚 —— 不用文字提示也能發現。
       */
      if (sc.block) {
        const gy = sc.block.y + sc.block.h + 112;
        coins.push({ x: Math.round(sc.block.x + sc.block.w / 2 - 12), y: gy - 104 });
      }
    }

    /*
     * 招牌機制（見 features.js）：每國一個只有那裡才有的段落。
     * 彈跳墊、間歇泉要避開密室（磚的那一欄要留給玩家頂）與移動平台。
     */
    const avoid = [];
    secrets.forEach(function (s) {
      avoid.push(s.room);
      if (s.block) avoid.push({ x: s.block.x - 30, y: 0, w: s.block.w + 60, h: 600 });
      // 岔路：整條空路底下都不放彈跳墊、間歇泉（會把人噴進空路底面）
      if (s.span) avoid.push({ x: s.span.x - 30, y: 0, w: s.span.w + 60, h: 600 });
    });
    movers.forEach(function (m) {
      avoid.push({ x: m.x - (m.range || 0) - 20, y: 0, w: m.w + (m.range || 0) * 2 + 40, h: 600 });
    });
    const feat = Features.plan(cfg.features, {
      segs: g.segs, gaps: g.gaps, platforms: platforms,
      width: width, goal: goalX, avoid: avoid
    });
    feat.coins.forEach(function (c) { coins.push(c); });

    // 危險區：斷崖底部放尖刺或水。
    // 火車的連結處、沒有海的纜車山谷不放：掉下去本來就摔出畫面（鐵軌、深谷），尖刺反而怪
    const openPits = vehicle === 'train' || (vehicle === 'cable' && !cfg.water);
    const hazards = openPits ? [] : g.gaps.map(function (gp) {
      const ly = LevelGen.groundAt(g.segs, gp.x - 6);
      const ry = LevelGen.groundAt(g.segs, gp.x + gp.w + 6);
      const top = Math.max(ly == null ? GROUND_Y : ly, ry == null ? GROUND_Y : ry);
      return { x: gp.x + 6, y: top + 26, w: gp.w - 12, h: 22 };
    });

    // 裝飾物：把手寫的位置搬到合法處（避開斷崖、平台、密室、彼此）
    const props = LevelGen.placeProps(cfg.props || [], {
      segs: g.segs,
      gaps: g.gaps,
      platforms: platforms,
      secrets: secrets,
      width: width,
      widthOf: function (ty) { return LevelGen.PROP_WIDTH[ty] || 120; },
      layerOf: function (ty) { return LevelGen.PROP_LAYER[ty] || 'fg'; }
    });

    // 終點：最後一段地面的中後段
    const lastSeg = g.segs[g.segs.length - 1];
    const goal = Math.round(lastSeg.x + lastSeg.w * 0.62);

    // 會講話的當地居民（見 npcs.js）：避開斷崖、密道入口、招牌機制
    const npcs = Npcs.place(Npcs.specs(cfg.id), {
      segs: g.segs, gaps: g.gaps, platforms: platforms, secrets: secrets,
      features: feat.list, enemies: enemies, goal: goal, width: width
    });

    return {
      id: cfg.id,
      country: cfg.country,
      city: cfg.city,
      flag: cfg.flag,
      flagDir: cfg.flagDir,
      landmark: cfg.landmark,
      fact: cfg.fact,
      region: cfg.region || 'west',   // 西歐篇 / 東歐篇（東歐要 EXP 解鎖）
      finale: !!cfg.finale,           // 篇章最終關：打完播結局
      sky: cfg.sky,
      cloud: cfg.cloud,   // 雲的顏色（夜景關卡要暗一點），沒給就用白雲
      hill: cfg.hill,
      groundTop: cfg.groundTop,
      groundBody: cfg.groundBody,
      deco: cfg.deco,
      vehicle: vehicle,
      width: width,
      height: worldH,
      layout: layout,
      tall: tall,
      spawnX: 120,
      ground: LevelGen.groundRects(g.segs, worldH),
      groundSegs: g.segs,
      water: cfg.water ? hazards.map(function (h) {
        return { x: h.x - 6, y: h.y - 14, w: h.w + 12, h: h.h + 40 };
      }) : [],
      spikes: cfg.water ? [] : hazards,
      props: props,
      platforms: platforms,
      movers: movers,
      coins: coins,
      enemies: enemies,
      secrets: secrets,
      features: feat.list,
      npcs: npcs,
      goal: goal
    };
  }

  // ────────────────────────────────────────────────────────────
  // 1. 西班牙 · 巴塞隆納
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1001,
    id: 'ES', country: '西班牙', city: '巴塞隆納',
    flag: ['#AA151B', '#F1BF00', '#AA151B'], flagDir: 'esp',
    landmark: 'sagrada',
    fact: '聖家堂 1882 年動工，高第接手後改了設計，至今仍在施工。',
    sky: ['#f7c873', '#fde9c4'], hill: '#c89a62',
    groundTop: '#d8a860', groundBody: '#7a5a3c',
    deco: 'olive',
    layout: 'flat',
    groundTypes: ['walker', 'walker', 'spiker'],
    airTypes: ['flyer'],
    density: 0.9,
    // 招牌：奔牛 —— 中段一群公牛從後面衝過來
    features: [{ type: 'stampede', from: 0.42, to: 0.64 }],
    secretHint: '舊城區的巷底，牆磚鬆了一塊',
    secretNear: 0.3,
    props: [
      { type: 'sagrada', x: 1400, scale: 0.95 },
      { type: 'plazaFountain', x: 700 },
      { type: 'plazaFountain', x: 4200 },
      { type: 'guitar', x: 2600 },
      { type: 'guitar', x: 5600 },
      { type: 'orangeTree', x: 3400 },
      { type: 'orangeTree', x: 6400 }
    ]
  }));

  // ────────────────────────────────────────────────────────────
  // 2. 法國 · 巴黎
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1002,
    id: 'FR', country: '法國', city: '巴黎',
    flag: ['#0055A4', '#FFFFFF', '#EF4135'], flagDir: 'v',
    landmark: 'eiffel',
    fact: '艾菲爾鐵塔 1889 年為世界博覽會而建，當年原本打算 20 年後拆掉。',
    sky: ['#9fc4f0', '#e8d9c5'], hill: '#b6a68c',
    groundTop: '#8fae5e', groundBody: '#6b5a44',
    deco: 'tree',
    layout: 'flat',
    groundTypes: ['walker', 'spiker'],
    airTypes: ['flyer', 'chaser'],
    density: 1,
    // 招牌：咖啡館遮陽篷彈跳墊（彈很高，空中有金幣）
    features: [{ type: 'bouncers', count: 5 }],
    secretHint: '往左回頭的牆後面，有地下酒窖的味道',
    secretNear: 0.2,
    props: [
      { type: 'arcTriomphe', x: 1800, scale: 1 },
      { type: 'arcTriomphe', x: 5200, scale: 0.85 },
      { type: 'cafe', x: 620 },
      { type: 'cafe', x: 3600 },
      { type: 'cafe', x: 6400 },
      { type: 'kiosk', x: 1200 },
      { type: 'kiosk', x: 4800 },
      { type: 'lamp', x: 400 },
      { type: 'lamp', x: 2400 },
      { type: 'lamp', x: 4000 },
      { type: 'lamp', x: 5800 },
      { type: 'lamp', x: 6900 }
    ]
  }));

  // ────────────────────────────────────────────────────────────
  // 3. 英國 · 倫敦 —— 豎井：大鐘塔內部往下降
  // ────────────────────────────────────────────────────────────
  list.push(shaftLevel({
    seed: 1003,
    id: 'GB', country: '英國', city: '倫敦',
    flag: ['#012169', '#FFFFFF', '#C8102E'], flagDir: 'uk',
    landmark: 'bigben',
    fact: '大本鐘其實是鐘的名字，塔在 2012 年才正式改名伊莉莎白塔。',
    sky: ['#2a2238', '#4a3a3a'], hill: '#3f4a5a',
    groundTop: '#8a7a5e', groundBody: '#4a4336',
    deco: 'tree',
    // 美術主題：鐘塔內部（齒輪、鐘面窗、維多利亞磚牆，見 Sprites.shaftBackdrop）
    theme: 'bigben',
    /*
     * 第一座豎井，井最寬、捲速最慢，但不能只是「一路往下走」。
     * 鐘塔專屬的三個變化，各自改變不同的節奏：
     *   slide      齒輪滑台：落點會移動，要看時機才跳
     *   pendulums  鐘擺：掃過樓層之間的空帶，往下掉時要閃
     *              （幾何上保證站在平台上不會被打到，見 shaft.js）
     *   chime      大笨鐘每 12 秒敲一次，之後 2 秒捲速 ×1.45 —— 平常/趕路交替
     */
    floors: 26,
    gapY: 104,
    platW: 112,
    shaftW: 580,
    scroll: [0.85, 1.6],
    extras: ['slide'],
    pendulums: [7, 12, 17, 22],
    chime: { every: 720, dur: 120, boost: 1.45 },
    // 鐘塔裡的紳士長傘：降到底才拿得到
    equipAt: 'goal'
  }));

  // ────────────────────────────────────────────────────────────
  // 4. 荷蘭 · 阿姆斯特丹 —— ⚔ 魔王：風車巨人
  // ────────────────────────────────────────────────────────────
  list.push(bossLevel({
    id: 'NL', country: '荷蘭', city: '阿姆斯特丹',
    flag: ['#AE1C28', '#FFFFFF', '#21468B'], flagDir: 'h',
    landmark: 'windmill',
    fact: '荷蘭約有四分之一國土低於海平面，靠堤防與抽水風車守住。',
    sky: ['#7f9fc8', '#e2d4bc'], hill: '#86a474',
    groundTop: '#7fb05a', groundBody: '#5d4f3c',
    deco: 'tulip',
    boss: {
      name: '風車巨人 De Molen',
      kind: 'windmill',
      pattern: 'slam',        // 跳躍落地 + 兩側貼地震波（跳起來閃）
      x: 760, w: 80, h: 92,
      /*
       * 加難（原本 3 血、單跳、直上直下 —— 站遠一點跳一下震波就沒事）：
       *   5 血；每輪連跳 2 下，空中會追著玩家修正落點；
       *   剩 2 血進狂暴：連跳 3 下、震波變快、天上掉風車葉片碎片；
       *   破綻期從 170 縮到 130 帧，要更準才踩得到。
       */
      hp: 5,
      jumps: 2,
      rageAt: 2,
      rageJumps: 3,
      homing: 2.0,
      waveSpeed: 2.9,
      recoverTime: 130,
      idleTime: 70,
      debris: 3,
      left: 300, right: 880,
      speed: 1.35
    },
    equipAt: { x: 600, y: 380 },
    props: [
      { type: 'canalHouse', x: 420 },
      { type: 'bike', x: 330 },
      { type: 'cow', x: 700 }
    ],
    platforms: [
      { x: 80, y: 290, w: 160, h: 20 },
      { x: 1010, y: 290, w: 160, h: 20 }
    ],
    coins: [
      { x: 110, y: 248 }, { x: 144, y: 248 }, { x: 178, y: 248 }, { x: 212, y: 248 },
      { x: 1040, y: 248 }, { x: 1074, y: 248 }, { x: 1108, y: 248 }, { x: 1142, y: 248 },
      { x: 480, y: 330 }, { x: 514, y: 330 }, { x: 548, y: 330 }, { x: 582, y: 330 }
    ]
  }));

  // ────────────────────────────────────────────────────────────
  // 5. 德國 · 巴伐利亞
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1005,
    id: 'DE', country: '德國', city: '巴伐利亞',
    flag: ['#000000', '#DD0000', '#FFCE00'], flagDir: 'h',
    landmark: 'castle',
    fact: '新天鵝堡是路德維希二世 1869 年開工的夢想城堡，他住進去不到半年就過世了。',
    sky: ['#7fa8d8', '#dfe6ea'], hill: '#6f7f6a',
    groundTop: '#5f8f4e', groundBody: '#4c4336',
    deco: 'pine',
    layout: 'hills',
    groundTypes: ['walker', 'spiker', 'charger'],
    airTypes: ['flyer', 'chaser'],
    density: 1.05,
    // 招牌：從前方山坡滾下來的啤酒桶（跳過或踩碎）
    features: [{ type: 'barrels', every: 190 }],
    secretHint: '鐘樓底下的石牆，敲起來是空的',
    secretNear: 0.45,
    props: [
      { type: 'brandenburg', x: 2000, scale: 0.95 },
      { type: 'halfTimber', x: 700 },
      { type: 'halfTimber', x: 3400 },
      { type: 'halfTimber', x: 6300 },
      { type: 'beerTent', x: 1200 },
      { type: 'beerTent', x: 4400 },
      { type: 'clockTower', x: 2800 },
      { type: 'clockTower', x: 5600 },
      { type: 'pretzel', x: 1600 },
      { type: 'pretzel', x: 5000 }
    ]
  }));

  // ────────────────────────────────────────────────────────────
  // 6. 捷克 · 布拉格 —— ⚔ 魔王：鐵騎守衛（衝刺型）
  // ────────────────────────────────────────────────────────────
  list.push(bossLevel({
    id: 'CZ', country: '捷克', city: '布拉格',
    flag: ['#FFFFFF', '#D7141A', '#11457E'], flagDir: 'cze',
    landmark: 'charlesbridge',
    fact: '布拉格天文鐘 1410 年啟用，是世界上還在運轉的最古老天文鐘。',
    sky: ['#a98458', '#e8d8b8'], hill: '#8c7458',
    groundTop: '#a88a5e', groundBody: '#5e4c3a',
    deco: 'tree',
    boss: {
      name: '鐵騎守衛 Rytíř',
      kind: 'knight',
      // 橫向衝刺撞牆。威脅是「地面被整片掃過」，
      // 玩家要跳過它或繞到另一側，不是靠跳躍閃高度。
      pattern: 'charge',
      x: 620, w: 76, h: 90,
      hp: 4,
      // 衝刺範圍要留出兩側平台的空間。
      // 掃動範圍 = [left-40, right+w+40] = [220, 1016]，
      // 所以平台必須在 x<220 或 x>1016。
      left: 260, right: 900,
      speed: 1.25
    },
    equipAt: { x: 560, y: 380 },
    props: [
      { type: 'astroClock', x: 1200 },
      { type: 'lamp', x: 150 },
      { type: 'lamp', x: 620 }
    ],
    // 平台放在魔王衝刺範圍之外的兩側
    platforms: [
      { x: 40, y: 292, w: 150, h: 20 },
      { x: 1050, y: 292, w: 150, h: 20 }
    ],
    coins: [
      { x: 70, y: 250 }, { x: 104, y: 250 }, { x: 138, y: 250 },
      { x: 1080, y: 250 }, { x: 1114, y: 250 }, { x: 1148, y: 250 },
      { x: 480, y: 332 }, { x: 514, y: 332 }, { x: 548, y: 332 }, { x: 582, y: 332 }
    ]
  }));

  // ────────────────────────────────────────────────────────────
  // 7. 奧地利 · 維也納 —— 豎井：歌劇院地下墓穴
  // ────────────────────────────────────────────────────────────
  list.push(shaftLevel({
    seed: 1007,
    id: 'AT', country: '奧地利', city: '維也納',
    flag: ['#ED2939', '#FFFFFF', '#ED2939'], flagDir: 'h',
    landmark: 'operahouse',
    fact: '維也納金色大廳的新年音樂會從 1939 年開始，每年元旦全球轉播。',
    sky: ['#2a0f1c', '#5a1a2a'], hill: '#332e45',
    groundTop: '#9a8a6a', groundBody: '#423a4a',
    deco: 'pine',
    // 美術主題：歌劇院（包廂牆、水晶吊燈、舞台光，見 Sprites.shaftBackdrop）
    theme: 'opera',
    /*
     * 第二座：井窄一點、層數多一點。
     * 歌劇院專屬的三個變化（跟英國鐘塔刻意不同）：
     *   beat   節拍台：跟著華爾滋三拍子閃爍，第 3 拍消失 —— 要數拍子
     *   notes  飛行音符：在樓層之間左右來回飛，往下掉時要抓空檔
     *   chime  漸強：每 10 秒樂團加速一次，捲動跟著變快
     */
    /*
     * v1.20.2 玩家：奧地利太難 → 每一項都調鬆：
     *   層數 32→26、平台寬 100→116、捲速 0.95~1.85 → 0.85~1.5、音符 5→3、
     *   漸強 每 10 秒 ×1.4 → 每 12 秒 ×1.25、節拍台比例約 24~36% → 14~22%（'beat-lite'）
     */
    floors: 26,
    gapY: 106,
    platW: 116,
    shaftW: 520,
    scroll: [0.85, 1.5],
    extras: ['beat-lite'],
    notes: [8, 15, 21],
    chime: { every: 720, dur: 100, boost: 1.25, label: '漸強！', sub: '樂團加速，捲動變快', sound: 'fanfare' },
    equipAt: 'goal'
  }));

  // ────────────────────────────────────────────────────────────
  // 8. 瑞士 · 阿爾卑斯 —— 豎井（往上爬）：馬特洪峰攀登，雪崩在後面追
  // ────────────────────────────────────────────────────────────
  list.push(shaftLevel({
    seed: 1008,
    id: 'CH', country: '瑞士', city: '阿爾卑斯',
    flag: ['#FF0000', '#FFFFFF', '#FF0000'], flagDir: 'cross',
    landmark: 'matterhorn',
    fact: '馬特洪峰高 4478 公尺，1865 年首登成功，下山時卻發生了山難。',
    // 往上爬 → 背景越高越亮（接近峰頂的天空）
    sky: ['#9fd0ee', '#5b8cb8'], hill: '#5a7d96',
    groundTop: '#eaf2f8', groundBody: '#49607a',
    deco: 'pine',
    mode: 'climb',
    // 美術主題：阿爾卑斯山（雪山遠景、馬特洪峰、岩壁積雪、山頂十字架，見 Sprites.shaftBackdrop）
    theme: 'alps',
    /*
     * v1.19 玩家：瑞士關有點單調（三座豎井只有這座沒有專屬機關）→ 加冰面：站上去會滑，要提早放開方向鍵。
     * 玩家：有冰面就不要雪崩 → calm：沒有追擊的危險區，相機只跟著玩家；滑下去就要重爬。
     * （中間試過「轟隆聲雪崩加速」，雪崩拿掉後一起拿掉）
     */
    extras: ['ice'],
    calm: true,
    /*
     * 往上爬的參數要比往下降保守：
     *   層距 84 —— 必須明顯小於基礎跳躍高度（約 128px），
     *   否則沒有二段跳的玩家跳不上去（那是無解，不是難）。
     *   層數少一點、井寬一點 —— 往上跳本來就比自由落下難控制。
     */
    floors: 28,
    gapY: 84,
    platW: 108,
    shaftW: 540,
    scroll: [0.8, 1.5],
    // 雪崩是白色的（水是藍色的）
    floodTint: ['#ffffff', '#b9d2e4'],
    equipAt: 'goal'
  }));

  // ────────────────────────────────────────────────────────────
  // 9. 義大利 · 羅馬 —— ⚔ 魔王：大鐘錶匠（齊射型）
  // ────────────────────────────────────────────────────────────
  list.push(bossLevel({
    id: 'IT', country: '義大利', city: '羅馬',
    flag: ['#008C45', '#F4F5F0', '#CD212A'], flagDir: 'v',
    landmark: 'colosseum',
    fact: '羅馬競技場西元 80 年落成，可容納約 5 萬人，入場靠陶片門票分流。',
    sky: ['#e09a4a', '#f8dca8'], hill: '#a87c50',
    groundTop: '#c9a06a', groundBody: '#6e523a',
    deco: 'cypress',
    boss: {
      name: '大鐘錶匠 Orologiaio',
      kind: 'clockwork',
      // 站定扇形齊射。威脅來自空中彈幕，
      // 跳躍閃不掉，要左右走位找空隙 —— 跟前兩隻完全不同。
      pattern: 'volley',
      x: 620, w: 76, h: 94,
      // 3 血：「打一下就起身」之後每滴血都要等一整輪齊射，4 血拖太長
      hp: 3,
      // 掃動範圍 = [220, 1016]，平台放在這之外
      left: 260, right: 900,
      speed: 1.0
    },
    equipAt: { x: 560, y: 380 },
    props: [
      { type: 'trevi', x: 950 },
      { type: 'vespa', x: 150 },
      { type: 'pizzaStand', x: 620 }
    ],
    platforms: [
      { x: 40, y: 292, w: 150, h: 20 },
      { x: 1050, y: 292, w: 150, h: 20 }
    ],
    coins: [
      { x: 70, y: 250 }, { x: 104, y: 250 }, { x: 138, y: 250 },
      { x: 1080, y: 250 }, { x: 1114, y: 250 }, { x: 1148, y: 250 },
      { x: 480, y: 332 }, { x: 514, y: 332 }, { x: 548, y: 332 }, { x: 582, y: 332 }
    ]
  }));

  // ────────────────────────────────────────────────────────────
  // 10. 希臘 · 雅典 —— ⚔ 最終魔王：大理石巨像
  // ────────────────────────────────────────────────────────────
  list.push(bossLevel({
    id: 'GR', country: '希臘', city: '雅典',
    finale: true,     // 西歐篇的最後一關：打完播結局
    flag: ['#0D5EAF', '#FFFFFF', '#0D5EAF'], flagDir: 'greek',
    landmark: 'parthenon',
    fact: '帕德嫩神廟西元前 438 年完工，列柱微微向內傾斜，是刻意的視覺矯正。',
    sky: ['#2f6f9e', '#d8e6ee'], hill: '#a89877',
    groundTop: '#ddd0b0', groundBody: '#7a6a52',
    deco: 'olive',
    boss: {
      name: '大理石巨像 Kolossos',
      kind: 'colossus',
      // 最終魔王：升空灑彈 + 召喚小兵。
      // 壓力來自「場上越來越亂」，玩家要在清兵與打本體之間取捨。
      pattern: 'summon',
      x: 760, w: 80, h: 96,
      // 4 血（原 5）：一次破綻只能打一下後，每輪都會再召一批小兵，5 血會被耗死
      hp: 4,
      left: 340, right: 900,
      speed: 1.3
    },
    equipAt: { x: 640, y: 380 },
    props: [
      { type: 'blueDome', x: 40 },
      { type: 'statue', x: 330 },
      { type: 'statue', x: 980 },
      { type: 'amphora', x: 660 },
      { type: 'greekWindmill', x: 1250 }
    ],
    platforms: [
      { x: 70, y: 290, w: 170, h: 20 },
      { x: 1040, y: 290, w: 170, h: 20 }
    ],
    /*
     * ⚠️ 左邊的砲台原本放在 x=120 —— 剛好就是玩家的出生點，一進場就撞上。
     * 改成兩座都在右側（地面一座、右平台上一座），第一發晚一點，玩家先看清楚場面。
     */
    enemies: [
      { x: 1100, y: 260, type: 'turret', left: 1100, right: 1130, cd: 150 },
      { x: 1150, type: 'turret', left: 1150, right: 1180, cd: 120 }
    ],
    coins: [
      { x: 100, y: 248 }, { x: 134, y: 248 }, { x: 168, y: 248 }, { x: 202, y: 248 },
      { x: 1070, y: 248 }, { x: 1104, y: 248 }, { x: 1138, y: 248 }, { x: 1172, y: 248 },
      { x: 500, y: 330 }, { x: 534, y: 330 }, { x: 568, y: 330 },
      { x: 602, y: 330 }, { x: 636, y: 330 }
    ]
  }));

  // ════════════════════════════════════════════════════════════
  // 東歐篇（海上遭遇戰累積 EXP 解鎖，見 Encounter.EAST_EXP）
  // ════════════════════════════════════════════════════════════

  // ────────────────────────────────────────────────────────────
  // 11. 波蘭 · 克拉科夫 —— 起伏的老城，盾兵與公牛較多
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1011,
    id: 'PL', country: '波蘭', city: '克拉科夫', region: 'east',
    flag: ['#FFFFFF', '#DC143C'], flagDir: 'h2',
    landmark: 'clothhall',
    fact: '克拉科夫聖母聖殿的號角每小時吹一次，曲子會在中途突然中斷，紀念 13 世紀中箭的號手。',
    sky: ['#8fb4d8', '#f0e2c8'], hill: '#7a8a6a',
    groundTop: '#7a9a5a', groundBody: '#5a4836',
    deco: 'pine',
    layout: 'hills',
    // 東歐篇的玩家已經有遠程攻擊（英國板球），所以可以放踩不死的盾兵與刺蝟
    groundTypes: ['walker', 'guard', 'charger', 'spiker'],
    airTypes: ['flyer', 'chaser'],
    density: 1.15,
    // 招牌：維利奇卡鹽礦 —— 一段漆黑礦坑，只看得到身邊與礦燈
    features: [{ type: 'dark', from: 0.48, to: 0.68 }],
    secretHint: '瓦維爾山腳的龍洞，傳說噴火龍就住在這裡',
    secretNear: 0.55,
    props: [
      { type: 'wawelDragon', x: 1500 },
      { type: 'halfTimber', x: 900 },
      { type: 'halfTimber', x: 4300 },
      { type: 'clockTower', x: 2700 },
      { type: 'clockTower', x: 6000 },
      { type: 'cafe', x: 3600 },
      { type: 'kiosk', x: 5200 },
      { type: 'lamp', x: 500 },
      { type: 'lamp', x: 2300 },
      { type: 'lamp', x: 4900 },
      { type: 'wawelDragon', x: 6500 }
    ]
  }));

  // ────────────────────────────────────────────────────────────
  // 12. 匈牙利 · 布達佩斯 —— 🚂 東方快車（v1.20）：在車廂頂上往車頭跑，間歇泉從車頂通風口噴出
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1015,
    id: 'HU', country: '匈牙利', city: '布達佩斯', region: 'east',
    flag: ['#CD2A3E', '#FFFFFF', '#436F4D'], flagDir: 'h',
    landmark: 'parliament',
    fact: '1883 年首航的東方快車從巴黎開往伊斯坦堡，沿途就經過布達佩斯。',
    sky: ['#6f9ccc', '#f4d2a4'], hill: '#5d6f80',
    groundTop: '#a8a088', groundBody: '#5a5048',
    deco: 'tree',
    layout: 'flat',
    vehicle: 'train',
    groundTypes: ['walker', 'charger', 'guard', 'spiker'],
    airTypes: ['flyer', 'chaser'],
    density: 1.05,
    // 招牌：溫泉間歇泉（火車開過溫泉區，蒸氣從車頂噴上來），噴發時站上去會被衝上天
    features: [{ type: 'geysers', count: 5 }],
    secretHint: '行李車廂的夾層，裡面暖暖的有溫泉的味道',
    secretNear: 0.85,
    props: []             // 車頂上不擺街景道具
  }));

  // ────────────────────────────────────────────────────────────
  // 13. 羅馬尼亞 · 外西凡尼亞 —— ⚔ 東歐篇魔王：吸血伯爵
  // ────────────────────────────────────────────────────────────
  list.push(bossLevel({
    id: 'RO', country: '羅馬尼亞', city: '外西凡尼亞', region: 'east',
    // （v1.7 起東歐篇的最後一關改成烏克蘭的火鳥）
    flag: ['#002B7F', '#FCD116', '#CE1126'], flagDir: 'v',
    landmark: 'bran',
    fact: '布蘭城堡常被稱為「德古拉城堡」，但真實的弗拉德三世大概只在這裡短暫停留過。',
    // 夜晚的墓園
    sky: ['#141428', '#4a2c4a'], hill: '#2a2440',
    cloud: 'rgba(110, 96, 140, 0.35)',
    groundTop: '#4a4a3a', groundBody: '#2a2620',
    deco: 'pine',
    boss: {
      name: '吸血伯爵 Strigoi',
      kind: 'vampire',
      /*
       * 瞬移型：化霧消失 → 出現在玩家背後 → 兩波扇形蝙蝠。
       * 跟前面四隻都不同 —— 它會換位置，玩家要一直轉身確認它在哪。
       */
      pattern: 'blink',
      x: 760, w: 64, h: 96,
      hp: 4,
      left: 300, right: 900,
      speed: 1.1,
      recoverTime: 140,
      idleTime: 80
    },
    equipAt: { x: 600, y: 380 },
    props: [
      { type: 'branCastle', x: 640, scale: 0.9 },
      { type: 'graveStone', x: 230 },
      { type: 'graveStone', x: 520 },
      { type: 'graveStone', x: 980 },
      { type: 'deadTree', x: 120 },
      { type: 'deadTree', x: 1160 }
    ],
    platforms: [
      { x: 40, y: 292, w: 150, h: 20 },
      { x: 1050, y: 292, w: 150, h: 20 }
    ],
    coins: [
      { x: 70, y: 250 }, { x: 104, y: 250 }, { x: 138, y: 250 },
      { x: 1080, y: 250 }, { x: 1114, y: 250 }, { x: 1148, y: 250 },
      { x: 480, y: 332 }, { x: 514, y: 332 }, { x: 548, y: 332 }, { x: 582, y: 332 }
    ]
  }));

  // ────────────────────────────────────────────────────────────
  // 14. 斯洛伐克 · 高塔特拉 —— 🚡 纜車（v1.20）：在山頭纜車站之間搭纜車，強風吹襲
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1021,
    id: 'SK', country: '斯洛伐克', city: '高塔特拉', region: 'east',
    flag: ['#FFFFFF', '#0B4EA2', '#EE1C25'], flagDir: 'h',
    landmark: 'spis',
    fact: '高塔特拉的纜車可以一路坐到海拔 2634 公尺的隆尼茨峰頂。',
    sky: ['#9cc4e8', '#e8eef2'], hill: '#7a8a9a',
    groundTop: '#6f9a58', groundBody: '#4f4436',
    deco: 'pine',
    layout: 'flat',
    vehicle: 'cable',
    groundTypes: ['walker', 'guard', 'spiker', 'charger'],
    airTypes: ['flyer', 'chaser'],
    density: 1.15,
    features: [{ type: 'gusts', from: 0.25, to: 0.85 }],
    secretHint: '岩縫裡有冷風灌出來，後面是空的',
    secretNear: 0.4,
    props: [
      { type: 'chalet', x: 800 },
      { type: 'chalet', x: 4200 },
      { type: 'clockTower', x: 2500 },
      { type: 'lamp', x: 1500 },
      { type: 'lamp', x: 3300 },
      { type: 'lamp', x: 5600 },
      { type: 'halfTimber', x: 6200 }
    ]
  }));

  // ────────────────────────────────────────────────────────────
  // 15. 克羅埃西亞 · 杜布羅夫尼克 —— 🚡 纜車（v1.20）：海面上的纜車，岸邊砲台在打
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1022,
    id: 'HR', country: '克羅埃西亞', city: '杜布羅夫尼克', region: 'east',
    flag: ['#FF0000', '#FFFFFF', '#171796'], flagDir: 'h',
    landmark: 'dubrovnik',
    fact: '杜布羅夫尼克的纜車 1969 年啟用，幾分鐘就能從古城外坐上山頂俯瞰整座城牆。',
    sky: ['#7ab8e8', '#f4e4c4'], hill: '#7a9a8a',
    groundTop: '#d8c8a0', groundBody: '#8a7a5a',
    deco: 'cypress',
    layout: 'flat',
    vehicle: 'cable',
    water: true,          // 纜車底下是亞得里亞海
    groundTypes: ['walker', 'guard', 'charger', 'spiker'],
    airTypes: ['flyer', 'chaser'],
    density: 1.1,
    features: [{ type: 'cannons', from: 0.2, to: 0.85, every: 130 }],
    secretHint: '城牆下的排水口，聽得到海浪聲',
    secretNear: 0.5,
    props: [
      { type: 'fishBoat', x: 900 },
      { type: 'cafe', x: 1900 },
      { type: 'lamp', x: 2600 },
      { type: 'statue', x: 3300 },
      { type: 'cafe', x: 4400 },
      { type: 'lamp', x: 5100 },
      { type: 'fishBoat', x: 5900 }
    ]
  }));

  // ────────────────────────────────────────────────────────────
  // 16. 塞爾維亞 · 貝爾格勒 —— 🚂 東方快車（v1.20）：車廂之間的連結板，踩了會塌
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1023,
    id: 'RS', country: '塞爾維亞', city: '貝爾格勒', region: 'east',
    flag: ['#C6363C', '#0C4076', '#FFFFFF'], flagDir: 'h',
    landmark: 'stsava',
    fact: '貝爾格勒位在薩瓦河匯入多瑙河的地方，歷史上被摧毀又重建了將近 40 次。',
    sky: ['#8ab0d0', '#e8d8c0'], hill: '#6a7a8a',
    groundTop: '#9a9478', groundBody: '#5a5040',
    deco: 'tree',
    layout: 'flat',
    vehicle: 'train',
    groundTypes: ['walker', 'charger', 'guard', 'spiker'],
    airTypes: ['flyer', 'chaser'],
    density: 1.15,
    // 招牌：會塌的木橋 → 火車上是「車廂之間的連結板」，站上去搖一搖就掉下去
    features: [{ type: 'bridges', count: 6 }],
    secretHint: '餐車底下的儲藏格，傳說藏過國王的酒',
    secretNear: 0.6,
    props: []
  }));

  // ────────────────────────────────────────────────────────────
  // 17. 保加利亞 · 玫瑰谷 —— 🚂 東方快車（v1.20）：載滿玫瑰的貨車廂，荊棘定時冒出
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1024,
    id: 'BG', country: '保加利亞', city: '玫瑰谷', region: 'east',
    flag: ['#FFFFFF', '#00966E', '#D62612'], flagDir: 'h',
    landmark: 'rila',
    fact: '玫瑰谷每年五、六月採收大馬士革玫瑰，要在清晨露水還沒乾時用手摘。',
    sky: ['#a8c8e8', '#f8e4e8'], hill: '#7a8a6a',
    groundTop: '#7aa85a', groundBody: '#5a4a3a',
    deco: 'tree',
    layout: 'flat',
    vehicle: 'train',
    groundTypes: ['walker', 'spiker', 'guard', 'charger'],
    airTypes: ['flyer', 'chaser'],
    density: 1.1,
    // 招牌：玫瑰荊棘 → 長在載玫瑰的車廂頂上，定時冒刺
    features: [{ type: 'thorns', count: 9 }],
    secretHint: '玫瑰貨車廂的木箱後面，聞得到花香',
    secretNear: 0.45,
    props: []
  }));

  // ────────────────────────────────────────────────────────────
  // 18. 烏克蘭 · 基輔 —— ⚔ 東歐篇最終魔王：火鳥
  // ────────────────────────────────────────────────────────────
  list.push(bossLevel({
    id: 'UA', country: '烏克蘭', city: '基輔', region: 'east',
    finale: true,     // 東歐篇最後一關
    flag: ['#0057B7', '#FFD500'], flagDir: 'h2',
    landmark: 'lavra',
    fact: '基輔洞窟修道院建於 1051 年，地底有長長的洞窟通道，金色圓頂在第聶伯河畔閃閃發亮。',
    sky: ['#5a8ad0', '#f0d890'], hill: '#8a7a50',
    groundTop: '#c8a850', groundBody: '#6a5432',
    deco: 'tree',
    boss: {
      name: '火鳥 Zhar-ptytsia',
      kind: 'firebird',
      /*
       * 俯衝型：平常在空中盤旋，預告後鎖定玩家位置斜線俯衝，
       * 落地時往兩側噴出貼地火焰（跳起來閃），之後癱在地上可以打。
       * 剩一半血進狂暴：連續俯衝兩次。
       * 跟前面所有魔王都不同 —— 它的威脅來自「上方斜角」。
       */
      pattern: 'dive',
      x: 760, w: 70, h: 70,
      y: GROUND_Y - 240,     // 一開始就在空中盤旋
      hp: 5,
      rageAt: 2,
      left: 280, right: 920,
      speed: 1.6,
      recoverTime: 130,
      idleTime: 75
    },
    equipAt: { x: 600, y: 380 },
    props: [
      { type: 'lavraProp', x: 640, scale: 0.9 },
      { type: 'sunflowers', x: 160 },
      { type: 'sunflowers', x: 470 },
      { type: 'sunflowers', x: 860 },
      { type: 'sunflowers', x: 1150 }
    ],
    platforms: [
      { x: 40, y: 292, w: 150, h: 20 },
      { x: 1060, y: 292, w: 150, h: 20 }
    ],
    coins: [
      { x: 70, y: 250 }, { x: 104, y: 250 }, { x: 138, y: 250 },
      { x: 1090, y: 250 }, { x: 1124, y: 250 }, { x: 1158, y: 250 },
      { x: 480, y: 332 }, { x: 514, y: 332 }, { x: 548, y: 332 }, { x: 582, y: 332 }
    ]
  }));

  return {
    GROUND_Y: GROUND_Y,
    GROUND_H: GROUND_H,
    MAX_GAP: MAX_GAP,
    MAX_STEP: LevelGen.MAX_STEP,
    BASE_WIDTH: BASE_WIDTH,
    list: list,
    count: list.length
  };
})();
