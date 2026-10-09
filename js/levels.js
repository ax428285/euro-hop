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
      gate: cfg.gate || null,         // v1.31 除了篇章，還要另外解鎖（南美：美洲 EXP）
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
      // v1.31.2 玩家：魔王關的 NPC 全數移除（原本出生點旁站一位當地人提醒打法）
      npcs: [],
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
      calm: cfg.calm,
      chargeJump: cfg.chargeJump
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
      intro: cfg.intro || null,    // 開場提示（兩行），沒有就用預設
      chargeJump: !!cfg.chargeJump, // v1.30 丹麥積木塔：按住跳躍蓄力、放開才跳

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

  /**
   * v1.31 往前衝的賽道關（race.js）：賽道由 Race.plan 用固定 seed 排好。
   * 沒有橫向的地形、敵人、密道、NPC；過關靠開到終點線（state.race 判定），所以 goal 給 Infinity。
   */
  function raceLevel(cfg) {
    const pl = Race.plan(cfg);
    return {
      id: cfg.id, country: cfg.country, city: cfg.city, flag: cfg.flag, flagDir: cfg.flagDir,
      landmark: cfg.landmark, fact: cfg.fact, region: cfg.region || 'west', finale: !!cfg.finale,
      sky: cfg.sky, cloud: cfg.cloud, hill: cfg.hill, groundTop: cfg.groundTop, groundBody: cfg.groundBody, deco: cfg.deco,
      intro: cfg.intro || null,
      layout: 'race',
      race: pl,
      width: 960, height: 480,
      spawnX: 460, spawnY: GROUND_Y - 40,
      ground: [], platforms: [], water: [], spikes: [], props: [], movers: [], secrets: [], enemies: [], npcs: [],
      // 金幣、裝備由 race.js 自己管；這裡給一份同樣數量的金幣，HUD 的「€ 拿到/總數」才對
      coins: pl.coins.map(function (c) { return { x: -1000, y: -1000 }; }),
      goal: Infinity,
      equipAt: { x: -1000, y: -1000 }
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
      climb: climb,
      startW: cfg.autorun ? 760 : 0
    });
    /*
     * v1.30 挪威峽灣（cfg.channels）：把中段幾道斷崖拓寬成「冰海水道」（約 300 寬，跳不過去），
     * 只能踩水上的浮冰過去（浮冰由 Features 'floes' 放）。要在平台、敵人、金幣之前改，
     * 後面的產生流程才會照拓寬後的地形擺東西。寬度從兩岸各借一半，地面段至少留 240。
     */
    const channels = [];
    if (cfg.channels) {
      (cfg.channels.at || []).forEach(function (k) {
        const want = width * k;
        let best = -1;
        g.gaps.forEach(function (gp, i) {
          if (gp.channel || i === 0) return;
          const L = g.segs[i], R = g.segs[i + 1];       // 斷崖 i 的左岸是 segs[i]、右岸是 segs[i+1]
          if (!L || !R || L.y !== R.y) return;          // 兩岸一樣高（浮冰在水面上，高低差跳不上去）
          if (best < 0 || Math.abs(gp.x - want) < Math.abs(g.gaps[best].x - want)) best = i;
        });
        if (best < 0) return;
        const gp = g.gaps[best], L = g.segs[best], R = g.segs[best + 1];
        const extra = (cfg.channels.width || 300) - gp.w;
        const takeL = Math.min(Math.ceil(extra / 2), L.w - 240), takeR = Math.min(extra - takeL, R.w - 240);
        if (takeL < 0 || takeR < 0) return;
        L.w -= takeL;
        gp.x -= takeL; gp.w += takeL + takeR;
        R.x += takeR; R.w -= takeR;
        gp.channel = true;
        channels.push({ x: gp.x, w: gp.w });
      });
    }

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
    /*
     * v1.31「洞裡的密道」（cfg.secretKind = 'pit'）：挑一個斷崖，底下不放尖刺 —— 看起來就是會摔死的洞，
     * 其實跳下去會掉進地底的洞窟（game.js 的 pitcave）：發現密道、拿到洞裡的金幣和裝備，從斷崖對面爬上來。
     * 挑的斷崖：不是第一個（剛開始的人還不熟操作）、兩邊都有地面、離終點遠、越靠近 secretNear 越好。
     */
    if (!tall && cfg.secretKind === 'pit') {
      const total = g.segs[g.segs.length - 1].x + g.segs[g.segs.length - 1].w;
      const cand = g.gaps.map(function (gp, gi) { return { gp: gp, gi: gi }; }).filter(function (o) {
        const gp = o.gp;
        return o.gi > 0 && gp.x + gp.w < goalX - 400 &&
          LevelGen.groundAt(g.segs, gp.x - 6) != null && LevelGen.groundAt(g.segs, gp.x + gp.w + 60) != null;
      }).sort(function (a, b) {
        const pa = (a.gp.x + a.gp.w / 2) / total, pb = (b.gp.x + b.gp.w / 2) / total;
        return Math.abs(pa - (cfg.secretNear || 0.5)) - Math.abs(pb - (cfg.secretNear || 0.5));
      });
      if (cand.length) {
        const gp = cand[0].gp;
        const ly = LevelGen.groundAt(g.segs, gp.x - 6), ry = LevelGen.groundAt(g.segs, gp.x + gp.w + 6);
        const top = Math.max(ly, ry);
        const exitX = gp.x + gp.w + 40;
        const exitY = LevelGen.groundAt(g.segs, exitX + 11);
        sc = {
          kind: 'pit', pitGap: cand[0].gi,
          pit: { x: gp.x, y: top + 30, w: gp.w, h: 200 },           // 掉到地面下 30 就算掉進洞窟
          room: { x: gp.x, y: top, w: gp.w, h: 120 },               // 給擺裝飾、NPC 的時候避開用
          trigger: { x: -9999, y: -9999, w: 1, h: 1 },
          exit: { x: exitX, y: exitY },
          hint: cfg.secretHint,
          holdsEquip: true,
          equipAt: { x: exitX + 11, y: exitY - 30 },
          // 洞窟裡的金幣（掉進去就全部拿到；不算在關卡的金幣總數裡，跟其他密室一樣是額外的）
          coins: [0, 1, 2, 3, 4, 5].map(function (k) { return { x: gp.x + 10 + (k % 3) * 24, y: top + 60 + Math.floor(k / 3) * 30 }; })
        };
      }
    }
    if (!sc && !tall && cfg.secretKind !== 'room') {
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
    /*
     * v1.30 挪威：終點在積木階梯頂上的高台（Features 'bricks' toGoal）。
     * 那一欄的浮空平台被拿掉了，原本擺在平台上的金幣會懸在半空 → 一起拿掉。
     */
    /*
     * v1.31 巴拿馬船閘、哥倫比亞盪繩：水道上方的浮空平台被拿掉了（不然踩平台就過去）——
     * 原本擺在平台上的金幣、會載人過去的移動平台也一起拿掉。
     */
    feat.cleared.forEach(function (z) {
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        if (c.x + 24 > z.x && c.x < z.x + z.w) coins.splice(i, 1);
      }
      for (let i = movers.length - 1; i >= 0; i--) {
        const m = movers[i], x0 = m.x - (m.axis === 'x' ? m.range : 0), x1 = m.x + m.w + (m.axis === 'x' ? m.range : 0);
        if (x0 < z.x + z.w && x1 > z.x) movers.splice(i, 1);
      }
      // 站在被拿掉的平台上的敵人（有 y 的是平台上的）
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.y != null && e.left < z.x + z.w && e.right > z.x) enemies.splice(i, 1);
      }
    });
    const goalPlat = feat.goalPlat || null;
    if (goalPlat) {
      platforms.push(goalPlat);
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        if (c.x + 24 > goalPlat.x - 300 && c.x < goalPlat.x + goalPlat.w && c.y < goalPlat.y + 200) coins.splice(i, 1);
      }
    }
    feat.coins.forEach(function (c) { coins.push(c); });

    // 危險區：斷崖底部放尖刺或水。
    // 火車的連結處、沒有海的纜車山谷不放：掉下去本來就摔出畫面（鐵軌、深谷），尖刺反而怪
    const openPits = vehicle === 'train' || (vehicle === 'cable' && !cfg.water);
    const pitGap = secrets.length && secrets[0].kind === 'pit' ? secrets[0].pitGap : -1;
    const hazards = openPits ? [] : g.gaps.filter(function (gp, gi) { return gi !== pitGap; }).map(function (gp) {
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

    /*
     * v1.30 玩家：斯洛伐克實測金幣吃不滿 —— 纜車山谷上那排弧形金幣是照「跳過斷崖」的高度擺的，
     * 但山谷跳不過去、只能搭纜車，坐在纜車上跳起來，纜車會從腳下滑走。→ 降到「站在纜車裡就碰得到」的高度。
     */
    if (vehicle === 'cable') {
      coins.forEach(function (c) {
        const over = g.segs.some(function (sg) { return c.x + 12 > sg.x && c.x + 12 < sg.x + sg.w; });
        if (!over) c.y = baseY - 36;
      });
    }
    // v1.30 玩家：所有終點後不要再放怪物和金幣（過了旗子就過關了，後面的東西拿不到也打不到）
    for (let i = coins.length - 1; i >= 0; i--) if (coins[i].x + 24 > goal - 16) coins.splice(i, 1);
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.x + 30 > goal - 40) { enemies.splice(i, 1); continue; }
      if (e.right != null && e.right > goal - 40) e.right = goal - 40;
    }

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
      autorun: !!cfg.autorun,       // v1.30 瑞典馴鹿雪橇：自動往前衝，只能跳
      intro: cfg.intro || null,     // v1.31.2 開場提示（兩行；海底城的珊瑚市集要先講怎麼游）
      gate: cfg.gate || null,       // v1.31 除了篇章，還要另外解鎖（南美：美洲 EXP）
      ride: cfg.ride || null,       // v1.31 自動往前衝時坐的是什麼：預設馴鹿雪橇，'car' = 古巴老爺車
      channels: channels,           // v1.30 挪威冰海水道（要踩浮冰過，level-check 另外驗）
      goalY: goalPlat ? goalPlat.y : null,   // v1.30 挪威：終點在高台上（要站上去才過關）
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
    // v1.25.1 試過最後一段淹在地中海裡（features 'flood'），v1.25.3 玩家：潛水那段太短，先拿掉（機制留著）
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
    // v1.31 玩家：密道太明顯、其中一些密道放到會死掉的洞 → 這國的密道藏在一個沒有尖刺的斷崖裡（跳下去才找得到）
    secretKind: 'pit',
    secretHint: '掉進了巴黎的地下墓穴！幾百萬人的骨頭排成一面一面的牆',
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
      hp: 4,   // v1.29.1 玩家：魔王血統一 4 格
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
    // v1.31 玩家：密道太明顯、其中一些密道放到會死掉的洞 → 這國的密道藏在一個沒有尖刺的斷崖裡（跳下去才找得到）
    secretKind: 'pit',
    secretHint: '掉進了巴伐利亞的老鹽礦，礦工以前坐著木頭滑梯下來',
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
      hp: 4,   // v1.29.1 玩家：魔王血統一 4 格
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
     * 改成都在右側，第一發晚一點，玩家先看清楚場面。
     *
     * v1.20.3 玩家：魔王旁邊的小怪物一直射砲也太難。
     *   原本兩座（地面、右平台）各每 110 帧瞄準開火，加上魔王灑彈＋小兵，三層攻擊疊在一起。
     *   拿掉地面那座，平台上那座改成每 220 帧一發、第一發等 240 帧；它還是踩得死。
     */
    enemies: [
      { x: 1100, y: 260, type: 'turret', left: 1100, right: 1130, cd: 240, every: 220 }
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
    // v1.31 玩家：密道太明顯、其中一些密道放到會死掉的洞 → 這國的密道藏在一個沒有尖刺的斷崖裡（跳下去才找得到）
    secretKind: 'pit',
    secretHint: '掉進了瓦維爾山腳的龍洞，傳說噴火龍就住在這裡',
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
       * 瞬移型：化霧消失 → 出現在玩家背後 → 放出會追人的蝙蝠（v1.29.1：原本是扇形直射，跟義大利的齊射重複）。
       * 蝙蝠會慢慢轉向追你，飛一陣子就散掉 —— 要繞著跑、或引牠們撞地，不能只找空隙站著。
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
  // 16. 塞爾維亞 · 科帕奧尼克 —— ⛷ 滑雪（v1.31 玩家：換成滑雪玩法；原本是東方快車的斷橋）
  // ────────────────────────────────────────────────────────────
  list.push(raceLevel({
    seed: 1023,
    id: 'RS', country: '塞爾維亞', city: '科帕奧尼克', region: 'east',
    flag: ['#C6363C', '#0C4076', '#FFFFFF'], flagDir: 'h',
    landmark: 'stsava',
    fact: '科帕奧尼克是塞爾維亞最大的滑雪場，最高的潘契奇峰海拔 2017 公尺，一年有兩百天看得到太陽。',
    sky: ['#6aa8e0', '#d8ecf8'], hill: '#9ab4d0',
    groundTop: '#f6fafe', groundBody: '#c8dcf0',
    deco: 'tree',
    view: 'ski',
    /*
     * 從側面看的下坡雪道（ski.js）：人自己往下滑，坡越陡越快。
     * 石頭、雪人、倒下的樹幹要跳；低低的纜車椅要按住 ↓ 壓低鑽過去；跳台會把人拋上天（空中有金幣）。
     */
    length: 22000,
    obsEvery: 520,
    intro: ['科帕奧尼克滑雪場！人會自己往下滑', '按住 ↓ 壓低滑得更快、按 ← 剎車、跳躍跳過石頭和雪人；纜車椅要壓低鑽過去']
  }));

  // ────────────────────────────────────────────────────────────
  // 17. 保加利亞 · 玫瑰谷 —— 🏸 羽球對決（v1.31 玩家：換成羽球玩法；原本是東方快車的玫瑰荊棘）
  // ────────────────────────────────────────────────────────────
  list.push(raceLevel({
    seed: 1024,
    id: 'BG', country: '保加利亞', city: '玫瑰谷', region: 'east',
    flag: ['#FFFFFF', '#00966E', '#D62612'], flagDir: 'h',
    landmark: 'rila',
    fact: '玫瑰谷每年五、六月採收大馬士革玫瑰，要在清晨露水還沒乾時用手摘；採收季還有玫瑰節。',
    sky: ['#9ac8ec', '#fbe6ec'], hill: '#8a9a8a',
    groundTop: '#3a8a5a', groundBody: '#2f7a4a',
    deco: 'tree',
    view: 'badminton',
    /*
     * 玫瑰節的露天羽球場（badminton.js）：跟玫瑰谷的羽球隊長比一場，先拿 5 分贏。
     * 球過來自動揮拍：一般是高遠球、按住 ↓ 是網前小球、跳起來打是殺球。
     */
    intro: ['玫瑰谷羽球對決！先拿 5 分就贏了', '←→ 跑位，球過來會自動揮拍；按住 ↓ 打網前小球，跳起來打是殺球']
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
       * 俯衝途中沿路灑下火星，落地處燒成一片火海（v1.29.1：原本落地往兩側噴貼地火焰，跟荷蘭的震波重複）；
       * 火海燒完之前靠近會燙到，等火熄了再去踩牠。
       * 剩一半血進狂暴：連續俯衝兩次。
       * 跟前面所有魔王都不同 —— 它的威脅來自「上方斜角」。
       */
      pattern: 'dive',
      x: 760, w: 70, h: 70,
      y: GROUND_Y - 240,     // 一開始就在空中盤旋
      hp: 4,   // v1.29.1 玩家：魔王血統一 4 格
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

  // ════════════════════════════════════════════════════════════
  // 非洲篇（v1.21，海上 EXP 解鎖，見 Encounter.REGIONS）
  // 一定要接在最後面：存檔的通關紀錄、裝備是照關卡順序記的，插在中間會讓舊存檔整個錯位。
  // 只做地中海沿岸（v1.21.1 玩家：不要開發太南邊）：摩洛哥 → 阿爾及利亞 → 突尼西亞 → 利比亞 → 埃及
  // v1.21 先做摩洛哥，v1.23 補齊其餘四國（埃及是最終魔王）。（中間試做過肯亞，拿掉了）
  // ════════════════════════════════════════════════════════════

  // ────────────────────────────────────────────────────────────
  // 19. 摩洛哥 · 馬拉喀什 —— 紅土老城與撒哈拉邊緣：流沙
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1031,
    id: 'MA', country: '摩洛哥', city: '馬拉喀什', region: 'africa',
    flag: ['#C1272D', '#006233'], flagDir: 'star',
    landmark: 'koutoubia',
    fact: '馬拉喀什的庫圖比亞清真寺宣禮塔高約 77 公尺，12 世紀完工，是全城最高的建築。',
    sky: ['#e8a060', '#f8dcae'], hill: '#b8683e',
    groundTop: '#d89a5a', groundBody: '#8a5030',
    deco: 'palm',
    layout: 'hills',
    groundTypes: ['walker', 'spiker', 'charger', 'guard'],
    airTypes: ['flyer', 'chaser'],
    density: 1.05,
    // 招牌：撒哈拉流沙 —— 踩進去會走不快、跳不高、越陷越深，站太久會受傷
    features: [{ type: 'quicksand', count: 6 }, { type: 'mounts', at: [0.3] }],
    // v1.31 玩家：密道太明顯、其中一些密道放到會死掉的洞 → 這國的密道藏在一個沒有尖刺的斷崖裡（跳下去才找得到）
    secretKind: 'pit',
    secretHint: '掉進了地下的 khettara 水道，沙漠裡的人靠它把山上的水引過來',
    secretNear: 0.55,
    props: [
      { type: 'paprikaStall', x: 900 },    // 香料攤（借用匈牙利紅椒攤的造型）
      { type: 'paprikaStall', x: 4300 }
    ]
  }));

  // ────────────────────────────────────────────────────────────
  // 20. 阿爾及利亞 · 塔西利高原 —— 撒哈拉的沙塵暴（v1.23）
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1036,
    id: 'DZ', country: '阿爾及利亞', city: '塔西利高原', region: 'africa',
    flag: ['#006633', '#FFFFFF', '#D21034'], flagDir: 'dz',
    landmark: 'tassili',
    fact: '塔西利高原的岩壁上有上萬幅史前岩畫，畫著長頸鹿和河馬 —— 撒哈拉以前是一片草原。',
    sky: ['#e0a868', '#f6e0b8'], hill: '#a8603a',
    groundTop: '#d8a060', groundBody: '#7a4428',
    deco: 'palm',
    layout: 'hills',
    groundTypes: ['walker', 'spiker', 'charger', 'guard'],
    airTypes: ['flyer', 'chaser'],
    density: 1.1,
    // 招牌：沙塵暴 —— 一陣一陣颳過來，逆風推人、整個畫面被黃沙蓋住只看得到身邊
    features: [{ type: 'sandstorm', from: 0.25, to: 0.85 }, { type: 'mounts', at: [0.2] }],
    secretHint: '岩畫洞窟最深處，畫著一頭長頸鹿的那面牆',
    secretNear: 0.5,
    props: []
  }));

  // ────────────────────────────────────────────────────────────
  // 21. 突尼西亞 · 托澤 —— 杰里德鹽湖：騎駱駝過湖（v1.23）
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1033,
    id: 'TN', country: '突尼西亞', city: '托澤', region: 'africa',
    flag: ['#E70013', '#FFFFFF'], flagDir: 'tn',
    landmark: 'tozeur',
    fact: '托澤老城用黃磚砌出幾何花紋；旁邊的杰里德湖是撒哈拉最大的鹽湖，夏天常出現海市蜃樓。',
    sky: ['#9ac0e0', '#f8ead0'], hill: '#c8a878',
    groundTop: '#e0c890', groundBody: '#8a6a40',
    deco: 'palm',
    layout: 'flat',
    groundTypes: ['walker', 'spiker', 'charger', 'guard'],
    airTypes: ['flyer', 'chaser'],
    density: 1.05,
    // 招牌：鹽湖沼澤 —— 一大片陷得很快的鹽泥，駱駝商隊來回走，騎在駝峰上過去最安全
    features: [{ type: 'camels', count: 4 }, { type: 'mounts', at: [0.4] }],
    secretHint: '黃磚牆上少了一塊花紋的地方',
    secretNear: 0.55,
    props: []
  }));

  // ────────────────────────────────────────────────────────────
  // 22. 利比亞 · 大萊普提斯 —— 羅馬古城的石柱會倒下來（v1.23）
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1034,
    id: 'LY', country: '利比亞', city: '大萊普提斯', region: 'africa',
    flag: ['#E70013', '#000000', '#239E46'], flagDir: 'ly',
    landmark: 'leptis',
    fact: '大萊普提斯是羅馬皇帝塞維魯的故鄉，被沙子埋了上千年，所以保存得比羅馬城裡的遺跡還完整。',
    sky: ['#78b0e0', '#f4e4c4'], hill: '#b89868',
    groundTop: '#d8c098', groundBody: '#7a6448',
    deco: 'olive',
    layout: 'flat',
    groundTypes: ['walker', 'guard', 'charger', 'spiker'],
    airTypes: ['flyer', 'chaser'],
    density: 1.1,
    // 招牌：老石柱 —— 人一靠近就搖晃、倒下來（被壓到會痛），倒下後變成可以踩的矮牆
    features: [{ type: 'columns', count: 7 }, { type: 'mounts', at: [0.3] }],
    secretHint: '凱旋門柱基的石縫裡，有風吹出來',
    secretNear: 0.5,
    props: []
  }));

  // ────────────────────────────────────────────────────────────
  // 23. 埃及 · 吉薩 —— ⚔ 非洲篇最終魔王：人面獅身
  // ────────────────────────────────────────────────────────────
  list.push(bossLevel({
    id: 'EG', country: '埃及', city: '吉薩', region: 'africa',
    finale: true,     // 非洲篇最後一關
    flag: ['#CE1126', '#FFFFFF', '#000000'], flagDir: 'eg',
    landmark: 'pyramids',
    fact: '吉薩大金字塔建於約 4500 年前，在將近 4000 年的時間裡都是世界上最高的建築。',
    sky: ['#e8b070', '#f8e4c0'], hill: '#c8964e',
    groundTop: '#e0b878', groundBody: '#8a6234',
    deco: 'palm',
    boss: {
      name: '人面獅身 Sphinx',
      kind: 'sphinx',
      /*
       * 沙柱（pattern 'sphinx'，見 entities.js）：
       * 原本是「荷蘭的跳躍震波＋義大利的扇形齊射」輪流出，v1.29.1 玩家嫌跟前面的魔王重複 → 換成自己的招：
       *   坐定唸咒，玩家腳下冒出流沙漩渦（預告），一會兒後噴出一根沙柱 —— 要一直換位置。
       *   連噴三根（狂暴五根），每根都瞄玩家「當下」的位置；狂暴時另外一根瞄「往前跑會到的地方」。
       * 前面沒有魔王是「從腳底下」攻擊的：不能跳、不能只往一邊跑，要看地上的漩渦走位。
       */
      pattern: 'sphinx',
      x: 760, w: 96, h: 84,
      hp: 4,   // v1.29.1 玩家：魔王血統一 4 格
      rageAt: 2,
      recoverTime: 140,
      idleTime: 70,
      left: 300, right: 900,
      speed: 1.3
    },
    equipAt: { x: 620, y: 380 },
    props: [
      { type: 'obelisk', x: 220 },
      { type: 'obelisk', x: 1060 }
    ],
    platforms: [
      { x: 70, y: 290, w: 160, h: 20 },
      { x: 1050, y: 290, w: 160, h: 20 }
    ],
    coins: [
      { x: 100, y: 248 }, { x: 134, y: 248 }, { x: 168, y: 248 }, { x: 202, y: 248 },
      { x: 1080, y: 248 }, { x: 1114, y: 248 }, { x: 1148, y: 248 }, { x: 1182, y: 248 },
      { x: 520, y: 330 }, { x: 554, y: 330 }, { x: 588, y: 330 }, { x: 622, y: 330 }
    ]
  }));

  // ════════════════════════════════════════════════════════════
  // 北歐篇（v1.30，海上 EXP 700 解鎖，見 Encounter.REGIONS）
  // 一定要接在最後面：存檔的通關紀錄、裝備是照關卡順序記的，插在中間會讓舊存檔整個錯位。
  // 丹麥 → 瑞典 → 挪威 → 芬蘭 → 冰島（最終魔王）
  // ════════════════════════════════════════════════════════════

  // ────────────────────────────────────────────────────────────
  // 24. 丹麥 · 哥本哈根 —— 樂高積木高塔：一路往上跳，終點在雲端
  //     （v1.30 玩家：北歐關卡跟之前差不多，要變化大一點；積木一直往上跳的想法不錯，終點就放在天上）
  // ────────────────────────────────────────────────────────────
  list.push(shaftLevel({
    seed: 1041,
    id: 'DK', country: '丹麥', city: '哥本哈根', region: 'north',
    flag: ['#C8102E', '#FFFFFF'], flagDir: 'nordic',
    landmark: 'nyhavn',
    fact: '樂高 1932 年誕生在丹麥的比隆，名字來自丹麥語「leg godt」—— 好好玩。',
    sky: ['#cfeaff', '#5aa0e0'], hill: '#6a8a9a',
    groundTop: '#8c9a88', groundBody: '#5a5048',
    deco: 'tree',
    mode: 'climb',
    // 美術主題：樂高積木塔（彩色積木牆、積木平台、雲端的終點，見 expedition.js 的 'lego'）
    theme: 'lego',
    /*
     * v1.30 玩家：要按著跳不放蓄力才跳得上去 → chargeJump：層距 150（一般跳 128 上不去），
     * 蓄力約 28 帧以上才夠高；底下是湧上來的積木（Sprites.shaftThemes.lego.flood）。
     */
    chargeJump: true,
    extras: ['charge'],          // 沒有彈簧、尖刺平台（見 Shaft pickType）
    floors: 24,
    gapY: 150,
    platW: 120,
    shaftW: 560,
    scroll: [0.35, 0.8],
    intro: ['往上爬到雲端！底下湧上來的積木會追上來', '按住跳躍蓄力、放開才跳 —— 按越久跳越高'],
    equipAt: 'goal'
  }));

  // ────────────────────────────────────────────────────────────
  // 25. 瑞典 · 拉普蘭 —— 結冰的湖面：會滑，要提早放開方向鍵
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1042,
    id: 'SE', country: '瑞典', city: '拉普蘭', region: 'north',
    flag: ['#006AA7', '#FECC00'], flagDir: 'nordic',
    landmark: 'icehotel',
    fact: '尤卡斯耶爾維的冰旅館每年冬天用托訥河的冰重新蓋一次，春天就融回河裡。',
    sky: ['#9cc2e6', '#f0f4fa'], hill: '#9aaabc',
    groundTop: '#eef4f8', groundBody: '#6a7482',
    deco: 'snowPine',
    layout: 'hills',
    groundTypes: ['walker', 'charger', 'guard', 'spiker'],
    airTypes: ['flyer', 'chaser'],
    density: 1.05,
    /*
     * v1.30 玩家：北歐關卡要變化大一點 → 坐馴鹿雪橇：自動往前衝、不能停、只能跳。
     * 招牌：結冰的湖面 —— 雪橇在冰上越滑越快（跳得更遠），斷崖前要算準起跳點
     */
    autorun: true,
    // v1.31.5 玩家：雪橇不能停，怎麼撞隱形密道磚？→ 改成「洞裡的密道」：挑一個沒有尖刺的斷崖，衝下去就掉進洞窟
    secretKind: 'pit',
    features: [{ type: 'ice', zones: [[0.16, 0.32], [0.42, 0.58], [0.68, 0.84]] }],
    secretHint: '冰湖中間有一道斷崖底下沒有冰柱，雪橇衝下去好像也不會摔壞',
    secretNear: 0.5,
    props: [
      { type: 'dalaHorse', x: 900 },
      { type: 'runestone', x: 1900 },
      { type: 'sauna', x: 3100 },
      { type: 'dalaHorse', x: 4400 },
      { type: 'runestone', x: 5600 },
      { type: 'reindeer', x: 6300 }
    ]
  }));

  // ────────────────────────────────────────────────────────────
  // 26. 挪威 · 蓋倫格峽灣 —— 冰海水道跳不過去，要踩會漂、會沉的浮冰
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1043,
    id: 'NO', country: '挪威', city: '蓋倫格峽灣', region: 'north',
    flag: ['#BA0C2F', '#FFFFFF', '#00205B'], flagDir: 'nordic',
    landmark: 'fjord',
    fact: '蓋倫格峽灣的「七姊妹瀑布」從兩百多公尺高的峭壁上分成七道落進海裡。',
    sky: ['#78a6d6', '#e2ecf4'], hill: '#4e5e6e',
    groundTop: '#6f9a5e', groundBody: '#4a4a54',
    deco: 'pine',
    layout: 'flat',
    water: true,          // 斷崖底下是峽灣的冰海
    groundTypes: ['walker', 'guard', 'charger', 'spiker'],
    airTypes: ['flyer', 'chaser'],
    density: 1.05,
    // 冰海水道：三道約 300 寬的水，只能踩浮冰過去
    channels: { at: [0.3, 0.52, 0.74], width: 300 },
    // 招牌：浮冰 —— 在水上漂來漂去，站上去會慢慢往下沉，不能久站
    // v1.30 玩家：加紅藍輪流消失的積木，終點在右上角高處（踩積木階梯上高台）
    features: [{ type: 'floes' }, { type: 'bricks', count: 3 }, { type: 'bricks', toGoal: true }],
    secretHint: '峭壁上的維京人石洞，門口刻著盧恩文字',
    secretNear: 0.42,
    props: [
      { type: 'runestone', x: 800 },
      { type: 'fishBoat', x: 1500 },
      { type: 'chalet', x: 2600 },
      { type: 'runestone', x: 4600 },
      { type: 'chalet', x: 6100 }
    ]
  }));

  // ────────────────────────────────────────────────────────────
  // 27. 芬蘭 · 羅瓦涅米 —— 北極圈的極夜：一片漆黑，極光亮起來才看得到路
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1044,
    id: 'FI', country: '芬蘭', city: '羅瓦涅米', region: 'north',
    flag: ['#FFFFFF', '#002F6C'], flagDir: 'nordic',
    landmark: 'santaVillage',
    fact: '羅瓦涅米的聖誕老人村正好跨在北極圈上，地上畫了一條白線，一步就能跨進北極圈。',
    sky: ['#0a1430', '#2a3c6c'], hill: '#1c2846',
    cloud: 'rgba(120, 140, 190, 0.28)',
    groundTop: '#e2eaf4', groundBody: '#4a5468',
    deco: 'snowPine',
    layout: 'hills',
    groundTypes: ['walker', 'charger', 'guard', 'spiker'],
    airTypes: ['flyer', 'chaser'],
    density: 1.0,
    // 招牌：極夜 —— 中段一大片黑，只看得到身邊；極光每隔一陣子亮起來，整片才看得清楚
    features: [{ type: 'aurora', from: 0.3, to: 0.82 }],
    secretHint: '聖誕老人郵局後門，堆滿了全世界寄來的信',
    secretNear: 0.2,
    props: [
      { type: 'reindeer', x: 700 },
      { type: 'sauna', x: 1500 },
      { type: 'reindeer', x: 6100 },
      { type: 'sauna', x: 6500 }
    ]
  }));

  // ────────────────────────────────────────────────────────────
  // 28. 冰島 · 火山 —— ⚔ 北歐篇最終魔王：火巨人蘇爾特
  // ────────────────────────────────────────────────────────────
  list.push(bossLevel({
    id: 'IS', country: '冰島', city: '赫克拉火山', region: 'north',
    finale: true,     // 北歐篇最後一關
    flag: ['#02529C', '#FFFFFF', '#DC1E35'], flagDir: 'nordic',
    landmark: 'hallgrims',
    fact: '1963 年冰島南邊的海底火山噴發，冒出一座新島，取名叫蘇爾特塞島 —— 用的就是火巨人蘇爾特的名字。',
    sky: ['#2e2638', '#d8744a'], hill: '#2a2a30',
    cloud: 'rgba(90, 80, 90, 0.45)',
    groundTop: '#3c3a3e', groundBody: '#1e1c20',
    boss: {
      name: '火巨人 Surtr',
      kind: 'surtr',
      /*
       * 火焰劍（pattern 'surtr'，見 entities.js）：
       *   每一劍先舉劍蓄力 —— 劍舉到頭頂 = 高掃（站在地上別跳），劍壓低貼地 = 低掃（跳過去）。
       *   一輪連揮三劍（狂暴四劍，還會從火山噴出熔岩彈從天上掉）。
       * 前面沒有魔王是「要你讀高低、決定跳或不跳」的：不能看到東西飛來就反射性地跳。
       */
      pattern: 'surtr',
      x: 760, w: 80, h: 92,
      hp: 4,
      rageAt: 2,
      debris: 3,
      left: 300, right: 920,
      speed: 1.2,
      recoverTime: 150,
      idleTime: 80
    },
    equipAt: { x: 600, y: 380 },
    props: [
      { type: 'lavaRock', x: 180 },
      { type: 'runestone', x: 470 },
      { type: 'lavaRock', x: 900 },
      { type: 'lavaRock', x: 1130 }
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

  // ════════════════════════════════════════════════════════════
  // 美洲篇（v1.31）：另一張「新大陸」地圖（加勒比海、中南美洲沿岸）。
  // 完成哥倫布的委託（打敗西歐五艘戰艦、回去找他）才開放，從歐洲地圖一直往西開就到。
  // 一樣接在最後面（存檔照關卡順序記）。
  // 古巴 → 牙買加 → 墨西哥 → 巴拿馬 → 哥倫比亞 → 巴西（最終魔王）
  // ════════════════════════════════════════════════════════════

  // ────────────────────────────────────────────────────────────
  // 29. 古巴 · 哈瓦那 —— 🏎 上帝視角的賽車（topdown.js）：從正上方看，開老爺車飆馬雷貢海濱大道
  //     （v1.31 玩家：古巴改成上帝視角賽車關卡，附參考圖；墨西哥維持往前衝的賽道）
  // ────────────────────────────────────────────────────────────
  list.push(raceLevel({
    seed: 1061,
    id: 'CU', country: '古巴', city: '哈瓦那', region: 'america',
    flag: ['#002A8F', '#FFFFFF', '#CF142B'], flagDir: 'cuba',
    landmark: 'capitolio',
    fact: '哈瓦那街上還在跑的 1950 年代美國老爺車有好幾萬輛，很多都是靠自己手工改裝的零件撐到今天。',
    sky: ['#f6a970', '#ffe0b0'], hill: '#6aa0a0',
    groundTop: '#d8c8a8', groundBody: '#8a7a64',
    deco: 'palm',
    view: 'top',
    theme: 'car',
    /*
     * 從正上方看：左邊是海和海堤、右邊是人行道和彩色老房子。馬路一路左彎右彎往前延伸。
     * 路上有慢吞吞的老爺車、坑洞、三角錐、水果推車（要閃）；
     * 海堤冒出水花 = 大浪要從左邊打上路面、蓋住左邊三分之二的馬路 —— 趕快開到最右邊的車道。
     */
    length: 24000,
    bends: [[900, 0], [1600, 120], [1400, -200], [1200, 0], [1800, 160], [1400, -120], [1600, -80], [1400, 200],
            [1600, 0], [1800, -180], [1400, 100], [1600, 0], [1400, -60], [2000, 0]],
    waves: [0.2, 0.42, 0.62, 0.82],
    // v1.31 玩家：古巴障礙物少一點 → 障礙間隔 300 → 480、路上的車 14 → 8
    traffic: 8,
    maxSpeed: 7.2,
    obsEvery: 480,
    intro: ['開著老爺車飆馬雷貢海濱大道！←→ 轉向，車子自己往前開', '閃開路上的車和坑洞；海堤冒水花 = 大浪要從左邊打上來，快開到最右邊！']
  }));

  // ────────────────────────────────────────────────────────────
  // 30. 牙買加 · 藍山 —— 手沖咖啡：熱水沖下來，咖啡粉悶蒸膨脹把人托上去
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1052,
    id: 'JM', country: '牙買加', city: '藍山', region: 'america',
    flag: ['#009B3A', '#FED100', '#000000'], flagDir: 'jamaica',
    landmark: 'blueMountains',
    fact: '牙買加藍山的咖啡長在海拔一千多公尺、常年起霧的山坡上，是世界上最貴的咖啡之一。',
    sky: ['#8fd0f0', '#e6f6e0'], hill: '#3f7a5a',
    groundTop: '#6aa84a', groundBody: '#6a4a30',
    deco: 'palm',
    layout: 'hills',
    groundTypes: ['walker', 'charger', 'guard', 'spiker'],
    airTypes: ['flyer', 'chaser'],
    density: 1.05,
    /*
     * 招牌：手沖咖啡（v1.31 玩家：牙買加藍山設計跟咖啡有關的，手沖咖啡）——
     * 巨大的細口壺定時沖下熱水（正中間的水柱會燙），濾杯裡的咖啡粉一吸水就悶蒸膨脹，把人托上去拿高處的金幣。
     */
    features: [{ type: 'pourover', count: 4 }],
    // v1.31 玩家：密道太明顯、其中一些密道放到會死掉的洞 → 這國的密道藏在一個沒有尖刺的斷崖裡（跳下去才找得到）
    secretKind: 'pit',
    secretHint: '掉進了綠洞（Green Grotto）！以前的走私販把東西藏在這裡',
    secretNear: 0.6,
    props: [
      { type: 'soundSystem', x: 900 },
      { type: 'coffeeSacks', x: 2000 },
      { type: 'soundSystem', x: 3400 },
      { type: 'coffeeSacks', x: 4800 },
      { type: 'soundSystem', x: 6200 }
    ]
  }));

  // ────────────────────────────────────────────────────────────
  // 31. 墨西哥 · 銅峽谷 —— 🏎 往前衝的賽道：緝毒大追擊
  //     （v1.31 玩家：墨西哥往毒品的方向想 → 從「抓走私販」的角度做，不出現毒品本身）
  // ────────────────────────────────────────────────────────────
  list.push(raceLevel({
    seed: 1053,
    id: 'MX', country: '墨西哥', city: '銅峽谷', region: 'america',
    flag: ['#006847', '#FFFFFF', '#CE1126'], flagDir: 'mexico',
    landmark: 'chichenItza',
    fact: '奇瓦瓦州的銅峽谷是好幾條峽谷連在一起的大峽谷群，比美國的大峽谷還深、還大。',
    sky: ['#5aa8e0', '#f8dca0'], hill: '#b8643a',
    groundTop: '#d8945a', groundBody: '#8a5a34',
    deco: 'palm',
    theme: 'chase',
    /*
     * 開警車在峽谷公路上追走私販的卡車：卡車沿路丟下一整排木箱（擋住整條路，要跳）；
     * 仙人掌、紅色油桶要閃（v1.31.8 原本是石頭，玩家看不出是障礙物），風滾草可以跳。追到終點，路障前攔下卡車就過關。
     * 峽谷公路彎多、起伏大，比古巴難。
     */
    // v1.31 玩家：墨西哥太難、障礙很難跳過去 → 彎緩一點、車速慢一點、障礙少一點、整排木箱只剩 3 處（前面有警示牌）
    course: [[60, 0, 0], [100, -2, 800], [90, 3, -600], [120, -3, 1200], [80, 0, -1400], [110, 3, 600], [90, -3, -600],
             [120, 2, 1000], [100, -3, -1200], [120, 3, 0], [140, -2, 800], [100, 0, -800]],
    obsEvery: 42,
    maxSpeed: 112,
    crates: [0.25, 0.55, 0.82],
    intro: ['緝毒大追擊！開警車追上前面逃跑的走私卡車', '仙人掌、紅色油桶要閃，卡車丟下的整排木箱要跳過去！']
  }));

  // ────────────────────────────────────────────────────────────
  // 32. 巴拿馬 · 巴拿馬運河 —— 運河的船閘：水位一下升一下降，船跟著上下
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1054,
    id: 'PA', country: '巴拿馬', city: '巴拿馬運河', region: 'america',
    flag: ['#FFFFFF', '#DA121A', '#005293'], flagDir: 'panama',
    landmark: 'canalLocks',
    fact: '巴拿馬運河的船閘像水梯：關上閘門灌水把船抬高 26 公尺，翻過中間的加通湖，再一格一格放下去。',
    sky: ['#8ccaf0', '#eaf6f0'], hill: '#3a7a4a',
    groundTop: '#8a9a7a', groundBody: '#5a5a54',
    deco: 'palm',
    layout: 'flat',
    water: true,          // 閘室裡是運河的水
    groundTypes: ['walker', 'guard', 'charger', 'spiker'],
    airTypes: ['flyer', 'chaser'],
    density: 1.0,
    // 三個閘室，每個約 300 寬，跳不過去
    channels: { at: [0.3, 0.52, 0.74], width: 300 },
    // 招牌：船閘 —— 閘室裡的小船跟著水位上下：水滿時船跟岸一樣高，水退時船沉到底下，要等它升上來
    features: [{ type: 'locks' }],
    secretHint: '閘門控制室底下，有一條給工人走的維修通道',
    secretNear: 0.42,
    props: [
      { type: 'canalMule', x: 800 },
      { type: 'shipContainer', x: 1700 },
      { type: 'canalMule', x: 4200 },
      { type: 'shipContainer', x: 6100 }
    ]
  }));

  // ────────────────────────────────────────────────────────────
  // 33. 哥倫比亞 · 卡塔赫納 —— 加勒比海的城牆老城：抓著海盜的盪繩飛過水道
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1055,
    id: 'CO', country: '哥倫比亞', city: '卡塔赫納', region: 'america', gate: 'samerica',
    flag: ['#FCD116', '#003893', '#CE1126'], flagDir: 'colombia',
    landmark: 'cartagena',
    fact: '卡塔赫納的老城被 11 公里長的城牆圍住，是西班牙人為了擋加勒比海的海盜一段一段蓋起來的。',
    sky: ['#82c8f0', '#fbe6c8'], hill: '#c88a5a',
    groundTop: '#d8b878', groundBody: '#8a6440',
    deco: 'palm',
    layout: 'flat',       // 寬水道（channels）要平地才拓得出來
    groundTypes: ['walker', 'charger', 'guard', 'spiker'],
    airTypes: ['flyer', 'chaser'],
    density: 1.05,
    water: true,          // 城牆外的護城河、海
    // 三道約 300 寬的水道，跳不過去
    channels: { at: [0.3, 0.52, 0.74], width: 300 },
    // 招牌：海盜盪繩 —— 水道上方吊著來回盪的繩子，跳起來抓住、盪到前面按跳躍放手飛過去
    features: [{ type: 'ropes' }],
    secretHint: '城牆底下的地道，當年守軍從這裡偷運火藥',
    secretNear: 0.5,
    props: [
      { type: 'balcony', x: 800 },
      { type: 'coffeeSacks', x: 1800 },
      { type: 'balcony', x: 3100 },
      { type: 'balcony', x: 4700 },
      { type: 'coffeeSacks', x: 6100 }
    ]
  }));

  // ────────────────────────────────────────────────────────────
  // 34. 巴西 · 里約熱內盧 —— ⚔ 美洲篇最終魔王：足球！巨人守門員
  //     （v1.31 玩家：巴西魔王關改成踢足球）
  // ────────────────────────────────────────────────────────────
  list.push(bossLevel({
    id: 'BR', country: '巴西', city: '里約熱內盧', region: 'america', gate: 'samerica',
    finale: true,     // 美洲篇最後一關
    flag: ['#009C3B', '#FFDF00', '#002776'], flagDir: 'brazil',
    landmark: 'sugarloaf',
    fact: '里約的馬拉卡納球場 1950 年世界盃決賽擠進了將近 20 萬人，到今天還是世界紀錄。',
    sky: ['#7cc0f0', '#f6e6b8'], hill: '#3a7a4a',
    groundTop: '#4aa84a', groundBody: '#3a7a3a',
    deco: 'palm',
    boss: {
      name: '巨人守門員 Goleiro',
      kind: 'goalkeeper',
      /*
       * 足球（pattern 'soccer'，見 entities.js）：踩頭沒用，要把球踢進他身後的球門，進 4 球就贏。
       *   他站著時身體會擋球、看到高球會跳起來擋；
       *   會抱著備用球一顆顆丟向你（狂暴三顆），丟完累倒在地上 —— 這時完全擋不到球，趕快射門。
       */
      pattern: 'soccer',
      soccer: { goalX: 1186, barY: 262 },
      x: 1110, w: 62, h: 96,
      hp: 4,
      rageAt: 2,
      left: 1040, right: 1180,
      speed: 1.0,
      recoverTime: 190,
      idleTime: 130
    },
    equipAt: { x: 620, y: 380 },
    props: [],
    platforms: [
      { x: 50, y: 292, w: 150, h: 20 }
    ],
    coins: [
      { x: 80, y: 250 }, { x: 114, y: 250 }, { x: 148, y: 250 },
      { x: 400, y: 332 }, { x: 434, y: 332 }, { x: 468, y: 332 }, { x: 502, y: 332 },
      { x: 700, y: 300 }, { x: 734, y: 300 }, { x: 768, y: 300 }
    ]
  }));

  // ════════════════════════════════════════════════════════════
  // 亞特蘭提斯海底城（v1.31.2）：第一次潛到亞特蘭提斯的神殿之後，那裡變成海底城的入口（另一張地圖 'sea'，見 abyss.js）
  // 一定要接在最後面（存檔照關卡順序記）。珊瑚市集 → 水晶宮 → 海馬競技場 → 海神神殿（最終魔王）
  // ════════════════════════════════════════════════════════════

  // ────────────────────────────────────────────────────────────
  // 35. 珊瑚市集 —— 水下游泳關：發光水母（踩傘蓋彈高、碰到觸手被電）、暗流、氣泡噴口
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1061,
    id: 'A1', country: '珊瑚市集', city: '亞特蘭提斯', region: 'abyss',
    flag: ['#1a6a8a', '#e86a8a', '#e8c050'], flagDir: 'atlantis',
    landmark: 'coralBazaar',
    fact: '柏拉圖說亞特蘭提斯的城市一圈一圈的，陸地和水道互相圍著，正中間是海神的神殿。',
    sky: ['#0c4a78', '#2a90c0'], hill: '#1c4c6c', cloud: 'rgba(190, 235, 255, 0.08)',
    groundTop: '#e0c890', groundBody: '#5a6a6c',
    deco: 'kelp',
    layout: 'hills',
    groundTypes: ['walker', 'walker', 'spiker'],
    airTypes: ['flyer', 'chaser'],
    density: 0.9,
    features: [{ type: 'air' }, { type: 'currents' }, { type: 'jellies', count: 7 }],
    // 水裡游泳跳不高，頂不到隱形磚 → 密道藏在沒有尖刺的海溝裡（跟法國、德國⋯⋯一樣，掉下去才找得到）
    secretKind: 'pit',
    secretHint: '掉進了市集底下的海溝！以前的商人把最好的珍珠藏在這裡',
    secretNear: 0.55,
    intro: ['珊瑚市集：要游泳的海底市場！跳躍 = 往上游', '頭上的氣泡是空氣，游進噴口補氣；發光水母的傘蓋可以踩，碰到觸手會被電'],
    props: []
  }));
  list[list.length - 1].underwater = true;     // 整關都在水裡（游泳的物理、空氣條，跟沉船潛水一樣）

  // ────────────────────────────────────────────────────────────
  // 36. 水晶宮 —— 氣泡罩住的宮殿（不用游泳）：水晶光束貼著地面掃過去，要跳起來閃
  // ────────────────────────────────────────────────────────────
  list.push(makeLevel({
    seed: 1062,
    id: 'A2', country: '水晶宮', city: '亞特蘭提斯', region: 'abyss',
    flag: ['#2a4a7a', '#a8e8ff', '#ffffff'], flagDir: 'atlantis',
    landmark: 'crystalPalace',
    fact: '傳說亞特蘭提斯有一種會發光的金屬「山銅」（orichalcum），神殿的牆壁整面都包著它。',
    sky: ['#1a5a7a', '#8ad0e0'], hill: '#2a6a8a',
    groundTop: '#d8ecf4', groundBody: '#6a8a9a',
    deco: 'kelp',
    layout: 'flat',
    groundTypes: ['walker', 'guard', 'charger', 'spiker'],
    airTypes: ['flyer', 'chaser'],
    density: 1.05,
    features: [{ type: 'beams', count: 7 }],
    secretHint: '水晶柱後面的牆，映出來的影子少了一根柱子',
    secretNear: 0.45,
    props: []
  }));

  // ────────────────────────────────────────────────────────────
  // 37. 海馬競技場 —— 騎海馬往前衝的賽道（race.js 主題 'seahorse'）
  // ────────────────────────────────────────────────────────────
  list.push(raceLevel({
    seed: 1063,
    id: 'A3', country: '海馬競技場', city: '亞特蘭提斯', region: 'abyss',
    flag: ['#1a5a6a', '#e8b040', '#ffffff'], flagDir: 'atlantis',
    landmark: 'hippodrome',
    fact: '柏拉圖寫道：亞特蘭提斯的國王們養了很多戰馬，城裡有一條圍著整座島的賽馬跑道。',
    sky: ['#0a3a62', '#3a9ac0'], hill: '#1e5a7a',
    groundTop: '#c8b88a', groundBody: '#8a7a5a',
    deco: 'kelp',
    theme: 'seahorse',
    /*
     * 騎著海馬繞競技場：珊瑚柱、大水母要閃，海膽可以跳；一整排從沙裡冒出來的礁石牆要跳（前面兩旁先冒泡泡）。
     */
    course: [[60, 0, 0], [110, 2, 600], [100, -3, -400], [120, 3, 800], [90, -2, -800], [120, 2, 400], [110, -3, -600],
             [120, 3, 600], [100, -2, -400], [130, 0, 0], [90, 0, 0]],
    obsEvery: 40,
    maxSpeed: 112,
    reefs: [0.28, 0.56, 0.84],
    intro: ['海馬競技場！騎上海馬繞場一圈', '←→ 閃開珊瑚柱和水母，海膽、整排的礁石牆按跳躍跳過去']
  }));

  // ────────────────────────────────────────────────────────────
  // 38. 海神神殿 —— ⚔ 海底城最終魔王：巨型章魚克拉肯
  // ────────────────────────────────────────────────────────────
  list.push(bossLevel({
    id: 'A4', country: '海神神殿', city: '亞特蘭提斯', region: 'abyss',
    finale: true,     // 海底城最後一關
    flag: ['#3a2a6a', '#e8c050', '#e8c050'], flagDir: 'atlantis',
    landmark: 'poseidonTemple',
    fact: '柏拉圖說亞特蘭提斯在「一天一夜之間」沉進海裡；有人認為他寫的是三千六百年前希臘聖托里尼島的火山大爆發。',
    sky: ['#06203c', '#1c5a8c'], hill: '#1c4c6c', cloud: 'rgba(190, 235, 255, 0.06)',
    groundTop: '#d8d0bc', groundBody: '#5a5a6c',
    deco: 'kelp',
    boss: {
      name: '巨型章魚 克拉肯',
      kind: 'kraken',
      /*
       * 觸手（跟人面獅身同一套 pattern 'sphinx'，見 entities.js）：坐定之後，你腳下冒出墨汁漩渦（預告），
       * 一會兒後一根觸手從地底竄出來 —— 要一直換位置。連三根（狂暴五根）；打完累倒在地上，跳上去踩頭。
       */
      pattern: 'sphinx',
      x: 760, w: 120, h: 96,
      hp: 4,
      rageAt: 2,
      recoverTime: 140,
      idleTime: 70,
      left: 300, right: 860,          // 克拉肯比人面獅身寬（120），右邊縮一點才不會穿過右邊的平台
      speed: 1.2
    },
    equipAt: { x: 620, y: 380 },
    props: [],
    platforms: [
      { x: 70, y: 290, w: 160, h: 20 },
      { x: 1050, y: 290, w: 160, h: 20 }
    ],
    coins: [
      { x: 100, y: 248 }, { x: 134, y: 248 }, { x: 168, y: 248 }, { x: 202, y: 248 },
      { x: 1080, y: 248 }, { x: 1114, y: 248 }, { x: 1148, y: 248 }, { x: 1182, y: 248 },
      { x: 520, y: 330 }, { x: 554, y: 330 }, { x: 588, y: 330 }, { x: 622, y: 330 }
    ]
  }));

  return {
    GROUND_Y: GROUND_Y,
    GROUND_H: GROUND_H,
    MAX_GAP: MAX_GAP,
    MAX_STEP: LevelGen.MAX_STEP,
    BASE_WIDTH: BASE_WIDTH,
    // v1.23.1：亞特蘭提斯（潛水）不在關卡清單裡（不佔存檔的關卡編號），由 Encounter 用同一個產生器臨時做
    make: makeLevel,
    // v1.24.2：亞特蘭提斯改成往下潛的豎井關（同倫敦鐘塔的玩法）
    makeShaft: shaftLevel,
    list: list,
    count: list.length
  };
})();
