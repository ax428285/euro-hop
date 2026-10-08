'use strict';

/**
 * 雙人試煉（v1.28 玩家：增加需要雙人合作才能過的關卡，關卡資訊標註需雙人）。
 *
 * 跟安提基特拉沉船一樣是大地圖上的「選擇性地點」（worldmap.js 的 PORT_DEFS），
 * 不在 Levels.list 裡 —— 不佔關卡編號、不擋解鎖、不算主線通關數，世界之謎也不用線索格。
 * 進關走 game.js 的 startSkirmish（levelIndex = -1），第一次過關的獎勵記在 Save.seaBosses。
 *
 * 三種一個人過不了的機制：
 *   壓力板（plate）  有人站著才算按下。可以接「閘門」（鐵柵門，打開時底下留一道縫）、
 *                     「吊橋」（深坑上的木橋，放下才走得過去）
 *   雙開關（mode:'all'） 兩塊壓板要「同時」有人站著，石門才會打開（打開就不再關上）
 *   疊羅漢（heads）   站在隊友頭上再跳，可以上一個人跳不上去的高台
 *   拉桿（lever）     爬上高台的人拉下拉桿，放下踏板讓隊友也能上來
 *
 * ⚠️ 一個人過不了的前提是跳躍力固定：二段跳、蹬牆跳、滑翔、跳躍強化在試煉裡都封印（seal）。
 *    單人一口氣最高跳約 122px，高台做 150px；疊羅漢多 40px（一個人的身高）就夠得到。
 *    壓板到閘門的距離 > 閘門關上前跑得到的距離，所以「踩一下就衝過去」也來不及。
 */
const Duo = (function () {
  const GY = 400;            // 地面（同 Levels.GROUND_Y）
  const GATE_GAP = 90;       // 閘門全開時底下的縫（人高 40）
  const OPEN_SPEED = 1 / 14;
  const CLOSE_SPEED = 1 / 8; // 關得比開得快：放開壓板 5 帧內縫就小於人高
  const HIGH = GY - 150;     // 高台頂面：一個人跳 122px 上不去，疊羅漢 162px 上得去

  /*
   * 兩關的地形全部手排（不用 LevelGen 隨機產生）：機制之間的距離要精準，
   * 隨機地形可能讓壓板離閘門太近（一個人踩完衝得過去）或出現跳得上去的台階。
   * segs 在每道閘門／石門後面切一段：掉坑重生是退回「左邊最近一段地面的開頭」，
   * 不切的話會被送回已經關上的閘門前面。
   */
  const LAYOUTS = {
    // 雙子燈塔：壓板＋閘門、壓板＋吊橋、最後一道雙開關石門
    twins: {
      width: 3660, goal: 3380,
      segs: [
        { x: 0, y: GY, w: 800 }, { x: 800, y: GY, w: 500 },
        { x: 1560, y: GY, w: 1200 }, { x: 2760, y: GY, w: 900 }
      ],
      plates: [
        { id: 'a', x: 430, y: GY }, { id: 'b', x: 900, y: GY },
        { id: 'c', x: 1120, y: GY }, { id: 'd', x: 1660, y: GY },
        { id: 'e', x: 2260, y: GY }, { id: 'f', x: 2580, y: GY }
      ],
      locks: [
        { kind: 'gate', x: 760, w: 28, need: ['a', 'b'], mode: 'any' },
        { kind: 'bridge', x: 1300, w: 260, y: GY, need: ['c', 'd'], mode: 'any' },
        { kind: 'door', x: 2720, w: 32, need: ['e', 'f'], mode: 'all', latch: true }
      ],
      enemies: [{ type: 'walker', x: 2000, left: 1880, right: 2180 }, { type: 'walker', x: 3050, left: 2900, right: 3250 }],
      coins: [[300, 340, 4], [960, 330, 3], [1340, 300, 6], [1800, 340, 5], [2380, 320, 4], [2900, 340, 5]]
    },
    // 米諾斯迷宮：疊羅漢上高台＋拉桿放踏板、高柱上的雙開關、閘門接力、疊羅漢登上終點王座
    maze: {
      width: 3560, goal: 3330,
      segs: [
        { x: 0, y: GY, w: 700 }, { x: 700, y: HIGH, w: 300 }, { x: 1000, y: GY, w: 950 },
        { x: 1950, y: GY, w: 600 }, { x: 2550, y: GY, w: 450 }, { x: 3000, y: HIGH, w: 560 }
      ],
      // 懸空的高台（雙開關的其中一塊在上面）：底下走得過去，一個人跳不上去
      platforms: [{ x: 1500, y: HIGH, w: 140, h: 20 }],
      plates: [
        { id: 'L', x: 900, y: HIGH, lever: true },
        { id: 'p', x: 1230, y: GY }, { id: 'q', x: 1538, y: HIGH },
        { id: 'r', x: 2250, y: GY }, { id: 's', x: 2660, y: GY }
      ],
      locks: [
        { kind: 'step', x: 606, w: 84, y: 320, need: ['L'], mode: 'any', latch: true },
        { kind: 'door', x: 1910, w: 32, need: ['p', 'q'], mode: 'all', latch: true },
        { kind: 'gate', x: 2510, w: 28, need: ['r', 's'], mode: 'any' }
      ],
      enemies: [{ type: 'walker', x: 1750, left: 1660, right: 1880 }, { type: 'walker', x: 2850, left: 2760, right: 2960 }],
      coins: [[320, 340, 4], [760, 210, 5], [1080, 340, 3], [1540, 210, 3], [2050, 340, 4], [3080, 210, 6]]
    }
  };
  const PLATE_W = 64;
  const LEVER_W = 24;

  const THEMES = {
    twins: {
      id: 'DUO1', country: '雙子燈塔', city: '博尼法喬海峽',
      flag: ['#2a4a7a', '#f2e6c8', '#c84a3a'], flagDir: 'v',
      fact: '博尼法喬海峽隔開科西嘉島（法國）和薩丁尼亞島（義大利），最窄的地方只有約 11 公里。',
      sky: ['#3a6fa8', '#9fd0ea'], hill: '#5a7a8a', groundTop: '#c8b890', groundBody: '#7a6a58', deco: 'olive'
    },
    maze: {
      id: 'DUO2', country: '米諾斯迷宮', city: '克里特島克諾索斯',
      flag: ['#8a2a2a', '#e8d0a0', '#8a2a2a'], flagDir: 'h',
      fact: '希臘神話：忒修斯靠阿里阿德涅給的線團，才走出關著牛頭人米諾陶洛斯的迷宮。',
      sky: ['#c87a3a', '#f2c88a'], hill: '#9a6a4a', groundTop: '#d8a868', groundBody: '#8a5a3a', deco: 'olive'
    }
  };

  const cache = {};
  function build(key) {
    if (cache[key]) return cache[key];
    const L = LAYOUTS[key], th = THEMES[key];
    const coins = [];
    L.coins.forEach(function (c) { for (let i = 0; i < c[2]; i++) coins.push({ x: c[0] + i * 34, y: c[1] }); });
    // 深坑底部放尖刺（同 makeLevel 的 hazards）
    const spikes = [];
    for (let i = 0; i < L.segs.length - 1; i++) {
      const a = L.segs[i], b = L.segs[i + 1];
      const gx = a.x + a.w, gw = b.x - gx;
      if (gw > 0) spikes.push({ x: gx + 6, y: Math.max(a.y, b.y) + 26, w: gw - 12, h: 22 });
    }
    const def = {
      id: th.id, country: th.country, city: th.city, flag: th.flag, flagDir: th.flagDir,
      landmark: null, fact: th.fact, region: 'sea', finale: false,
      sky: th.sky, hill: th.hill, groundTop: th.groundTop, groundBody: th.groundBody, deco: th.deco,
      width: L.width, height: 480, layout: 'flat', spawnX: 120,
      ground: LevelGen.groundRects(L.segs, 480), groundSegs: L.segs,
      water: [], spikes: spikes, props: [], platforms: (L.platforms || []).map(function (q) { return Object.assign({}, q); }), movers: [], secrets: [], features: [], npcs: [],
      coins: coins, enemies: L.enemies,
      goal: L.goal,
      duo: {
        key: key,
        plates: L.plates.map(function (p) { return { id: p.id, x: p.x, y: p.y, w: p.lever ? LEVER_W : PLATE_W, lever: !!p.lever }; }),
        locks: L.locks
      }
    };
    cache[key] = def;
    return def;
  }

  /** Encounter.makeDef 轉過來：m.def 是 Encounter.KINDS 裡那一筆（有 duo: 'twins' / 'maze'） */
  function makeDef(m) {
    const base = build(m.def.duo);
    const k = m.def;
    const first = !(typeof Save !== 'undefined' && Save.seaBossDown(m.kind));
    return Object.assign({}, base, {
      monster: m,
      exp: first ? k.bossExp : k.exp,
      bossCoins: first ? k.bossCoins : 0,
      firstBoss: first,
      fact: base.fact + (first ? '　第一次過關：' + k.bossExp + ' EXP＋' + k.bossCoins + ' 金幣' : '　再闖一次：' + k.exp + ' EXP')
    });
  }

  /** 封印跳躍類裝備（不然二段跳、蹬牆跳一個人就上得了高台） */
  function seal(st) {
    if (!st) return st;
    return Object.assign({}, st, { doubleJump: false, wallJump: false, glide: false, jumpBoost: 0 });
  }

  /** 執行期狀態（只放純資料：連線時整個 state 會序列化傳給朋友） */
  function makeState(def) {
    const d = def.duo;
    return {
      plates: d.plates.map(function (p) { return { id: p.id, x: p.x, y: p.y, w: p.w, lever: p.lever, down: false, held: 0 }; }),
      locks: d.locks.map(function (l) {
        return { kind: l.kind, x: l.x, w: l.w, y: l.y, need: l.need.slice(), mode: l.mode, latch: !!l.latch, o: 0, latched: false };
      }),
      prevX: []
    };
  }

  /** 閘門／石門的實心範圍（從天上一路到地面，縫隨開度變大；跳不過去） */
  function gateRect(l) {
    const bottom = GY - GATE_GAP * l.o;
    return { x: l.x, y: -800, w: l.w, h: bottom + 800 };
  }

  function solids(state) {
    if (!state.duo) return [];
    const out = [];
    state.duo.locks.forEach(function (l) {
      if (l.kind === 'gate' || l.kind === 'door') out.push(gateRect(l));
      // 吊橋是實心的；踏板是單向的（從底下跳得上去，不會撞頭）
      else if (l.o > 0.5) out.push({ x: l.x, y: l.y, w: l.w, h: 14, passThru: l.kind === 'step' });
    });
    return out;
  }

  /**
   * 疊羅漢：隊友的頭頂是一塊只從上面踩得到的平台（passThru = 單向）。
   * dx 是隊友上一帧走了多少，updatePlayer 會把站在上面的人一起帶著走（同移動平台）。
   */
  function heads(state, self) {
    if (!state.duo) return [];
    const out = [];
    const prev = state.duo.prevX;
    state.players.forEach(function (q, i) {
      if (q === self || q.out) return;
      out.push({ x: q.x - 3, y: q.y, w: q.w + 6, h: 10, passThru: true, head: true,
                 dx: prev[i] != null ? q.x - prev[i] : 0, dy: 0 });
    });
    return out;
  }

  function standingOn(p, pl) {
    if (p.out || !p.onGround) return false;
    const feet = p.y + p.h;
    return Math.abs(feet - pl.y) < 4 && p.x + p.w > pl.x + 4 && p.x < pl.x + pl.w - 4;
  }

  /** 每帧（玩家物理之後）：壓板、門的開關。回傳事件給 game.js 放音效 */
  function update(state) {
    const ds = state.duo;
    if (!ds) return [];
    const ev = [];
    const players = state.players;
    ds.plates.forEach(function (pl) {
      const was = pl.down;
      if (pl.lever) {
        // 拉桿：碰到就拉下，之後一直是拉下的
        if (!pl.down) pl.down = players.some(function (p) { return !p.out && U.overlap(p, { x: pl.x, y: pl.y - 44, w: pl.w, h: 44 }); });
      } else {
        pl.down = players.some(function (p) { return standingOn(p, pl); });
      }
      if (pl.down && !was) ev.push('duo:press');
      pl.held = pl.down ? pl.held + 1 : 0;
    });
    const byId = {};
    ds.plates.forEach(function (pl) { byId[pl.id] = pl; });
    ds.locks.forEach(function (l) {
      const on = l.mode === 'all'
        ? l.need.every(function (id) { return byId[id] && byId[id].down; })
        : l.need.some(function (id) { return byId[id] && byId[id].down; });
      if (on && l.latch && !l.latched) { l.latched = true; ev.push('duo:unlock'); }
      const target = (on || l.latched) ? 1 : 0;
      if (target > l.o) l.o = Math.min(1, l.o + OPEN_SPEED);
      else if (target < l.o) {
        // 閘門底下有人：卡住不往下關（不然人會被壓進門裡）
        if (l.kind === 'gate' || l.kind === 'door') {
          const next = Object.assign({}, l, { o: Math.max(0, l.o - CLOSE_SPEED) });
          const r = gateRect(next);
          if (players.some(function (p) { return !p.out && U.overlap(p, r); })) return;
          l.o = next.o;
        } else {
          l.o = Math.max(0, l.o - CLOSE_SPEED);
        }
      }
    });
    ds.prevX = players.map(function (p) { return p.x; });
    return ev;
  }

  // ── 畫面 ──
  function drawPlate(ctx, pl, sx, t) {
    if (pl.lever) {
      // 拉桿：木座＋桿子，拉下後倒向右邊
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(sx, pl.y - 8, pl.w, 8);
      const a = pl.down ? 0.9 : -0.5;
      ctx.save();
      ctx.translate(sx + pl.w / 2, pl.y - 6);
      ctx.rotate(a);
      ctx.fillStyle = '#9a9aa8';
      ctx.fillRect(-2, -30, 4, 30);
      ctx.fillStyle = pl.down ? '#8fe3a0' : '#e0526b';
      ctx.beginPath(); ctx.arc(0, -30, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (!pl.down) {
        const bob = Math.sin(t * 0.12) * 3;
        U.text(ctx, '拉', sx + pl.w / 2, pl.y - 52 + bob, { size: 12, color: '#ffd166' });
      }
      return;
    }
    const h = pl.down ? 3 : 7;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(sx - 2, pl.y - 2, pl.w + 4, 4);
    ctx.fillStyle = pl.down ? '#8fe3a0' : '#e8b84a';
    ctx.fillRect(sx, pl.y - h, pl.w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(sx + 3, pl.y - h, pl.w - 6, 2);
    if (pl.down) {
      ctx.fillStyle = 'rgba(143,227,160,' + (0.25 + Math.sin(t * 0.2) * 0.1).toFixed(3) + ')';
      ctx.fillRect(sx - 4, pl.y - h - 10, pl.w + 8, 10);
    }
  }

  function drawLock(ctx, l, sx, t) {
    if (l.kind === 'gate') {
      // 鐵柵門：從上面垂下來，打開時往上收
      const r = gateRect(l);
      const top = -20, bottom = r.y + r.h;
      ctx.fillStyle = '#3a3e4a';
      ctx.fillRect(sx - 6, top, l.w + 12, 24);
      ctx.fillStyle = '#5a6070';
      for (let bx = sx + 2; bx < sx + l.w; bx += 8) ctx.fillRect(bx, top, 4, bottom - top);
      for (let by = bottom - 6; by > top; by -= 34) ctx.fillRect(sx, by, l.w, 4);
      ctx.fillStyle = '#8a90a0';
      for (let bx = sx + 2; bx < sx + l.w; bx += 8) {
        ctx.beginPath(); ctx.moveTo(bx - 1, bottom); ctx.lineTo(bx + 2, bottom + 6); ctx.lineTo(bx + 5, bottom); ctx.fill();
      }
    } else if (l.kind === 'door') {
      // 石門：一大塊石板，打開時往上升；兩個燈號表示雙開關各自有沒有人站
      const r = gateRect(l);
      const bottom = r.y + r.h;
      ctx.fillStyle = '#8a8072';
      ctx.fillRect(sx, -20, l.w, bottom + 20);
      ctx.strokeStyle = 'rgba(40,30,20,0.4)';
      ctx.lineWidth = 2;
      for (let by = bottom - 40; by > 0; by -= 40) { ctx.beginPath(); ctx.moveTo(sx, by); ctx.lineTo(sx + l.w, by); ctx.stroke(); }
      ctx.fillStyle = '#6a6052';
      ctx.fillRect(sx, bottom - 6, l.w, 6);
    } else if (l.kind === 'bridge') {
      // 吊橋：從左岸往右伸出去的木板，放到一半以上才踩得住
      const len = l.w * l.o;
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(sx, l.y, len, 14);
      ctx.fillStyle = '#5a3a20';
      for (let bx = sx; bx < sx + len - 2; bx += 20) ctx.fillRect(bx, l.y, 2, 14);
      ctx.strokeStyle = '#3a2a1a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx, l.y - 50); ctx.lineTo(sx + len, l.y); ctx.stroke();
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(sx - 6, l.y - 56, 8, 56);
    } else if (l.kind === 'step') {
      // 踏板：拉桿拉下後從牆裡伸出來
      const len = l.w * l.o;
      ctx.fillStyle = '#9a7a52';
      ctx.fillRect(sx + l.w - len, l.y, len, 14);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(sx + l.w - len, l.y + 10, len, 4);
    }
  }

  function drawWorld(ctx, state, camX, t, W) {
    const ds = state.duo;
    if (!ds) return;
    // 壓板到門之間的虛線（埋在地面上的機關線），有人踩著就亮綠色：一看就知道哪塊開哪道門
    const plateOf = {};
    ds.plates.forEach(function (pl) { plateOf[pl.id] = pl; });
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 3;
    ds.locks.forEach(function (l) {
      const lx = l.kind === 'bridge' ? l.x : l.kind === 'step' ? l.x + l.w : l.x + l.w / 2;
      l.need.forEach(function (id) {
        const pl = plateOf[id];
        const px = pl.x + pl.w / 2;
        if (Math.max(px, lx) - camX < -20 || Math.min(px, lx) - camX > W + 20) return;
        ctx.strokeStyle = pl.down ? 'rgba(143,227,160,0.95)' : 'rgba(255,214,102,0.75)';
        ctx.beginPath();
        ctx.moveTo(px - camX, pl.y + 6);
        ctx.lineTo(px - camX, Math.max(pl.y, GY) + 6);
        ctx.lineTo(lx - camX, Math.max(pl.y, GY) + 6);
        ctx.stroke();
      });
    });
    ctx.restore();
    ds.locks.forEach(function (l) {
      const sx = l.x - camX;
      if (sx > W + 40 || sx + l.w < -40) return;
      drawLock(ctx, l, sx, t);
    });
    ds.plates.forEach(function (pl) {
      const sx = pl.x - camX;
      if (sx > W + 20 || sx + pl.w < -20) return;
      drawPlate(ctx, pl, sx, t);
    });
    // 雙開關的石門：上方標出還差幾個人
    const byId = {};
    ds.plates.forEach(function (pl) { byId[pl.id] = pl; });
    ds.locks.forEach(function (l) {
      if (l.mode !== 'all' || l.latched) return;
      const dx = l.x - camX + l.w / 2;
      if (dx < -60 || dx > W + 200) return;
      const sx = U.clamp(dx, 90, W - 90);    // 門還在畫面外時，字先貼著邊緣出現
      const n = l.need.filter(function (id) { return byId[id].down; }).length;
      U.text(ctx, '兩塊壓板同時有人 ' + n + '/' + l.need.length, sx, 120, { size: 12, color: n ? '#8fe3a0' : '#ffd166' });
    });
  }

  return {
    LAYOUTS: LAYOUTS,
    HIGH: HIGH,
    build: build,
    makeDef: makeDef,
    seal: seal,
    makeState: makeState,
    solids: solids,
    heads: heads,
    update: update,
    drawWorld: drawWorld
  };
})();
