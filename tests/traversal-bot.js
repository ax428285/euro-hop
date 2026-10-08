/**
 * 可通關性驗證：用真正的 entities.js 物理跑一個機器人穿過每一關。
 * 目的是確認沒有「寬到跳不過」的斷崖或「高到上不去」的平台。
 *
 * 在瀏覽器 console（或 Playwright evaluate）執行 runTraversalTest()。
 */
function runTraversalTest() {
  const results = [];

  for (let li = 0; li < Levels.list.length; li++) {
    const def = Levels.list[li];
    // 魔王關不是「跑到終點」的關卡，交給 runBossTest() 驗
    if (def.isBoss) {
      results.push({
        level: li + 1,
        name: def.country + ' · ' + def.city,
        skipped: 'boss',
        cleared: true
      });
      continue;
    }
    /*
     * 豎井關也不是「往右跑到終點」的關卡 —— 它要往下降，
     * 而且畫面會自動捲動。這裡的機器人只會往右走，
     * 套上去會回報 0% 的假失敗。交給 runShaftCheck() 驗。
     */
    // v1.31 往前衝的賽道關：由 runRaceCheck() 的開車機器人驗
    if (def.layout === 'race') {
      results.push({ level: li + 1, name: def.country + ' · ' + def.city, skipped: 'race', cleared: true });
      continue;
    }
    if (def.layout === 'shaft') {
      results.push({
        level: li + 1,
        name: def.country + ' · ' + def.city,
        skipped: 'shaft',
        cleared: true
      });
      continue;
    }
    // 用「沒有任何裝備」的狀態驗證：最基本能力就該過得去
    const state = buildLevelState(def, li, [], Equipment.resolve([]));
    // 這個測試只驗地形，把敵人拿掉避免被擊退干擾判讀
    state.enemies = [];

    const bot = makeBot(state);
    let t = 0;
    let falls = 0;
    let maxX = 0;
    let stuckFrames = 0;
    let lastX = -1;
    let cleared = false;
    let featureHurts = 0;
    const featuresMet = [];

    const LIMIT = 20000;
    while (t < LIMIT) {
      t++;
      updateMovers(state.movers, t);
      bot.think(state, t);
      const events = updatePlayer(state, bot.input, t);
      // 招牌機制也要跑（奔牛、啤酒桶會打人；彈跳墊、間歇泉會把人彈走）
      if (state.features) {
        Features.update(state, t).forEach(function (e) {
          if (/:hurt$/.test(e)) featureHurts++;
          if (/^feature:/.test(e)) featuresMet.push(e.slice(8));
        });
      }
      updateParticles(state.particles);

      if (events.indexOf('fall') >= 0) {
        falls++;
        // 照遊戲的方式復活到最近的安全地面
        const p = state.player;
        let sx = 60;
        for (let i = 0; i < def.ground.length; i++) {
          if (def.ground[i].x <= p.x) sx = def.ground[i].x + 40;
        }
        p.x = sx; p.y = Levels.GROUND_Y - p.h - 4;
        p.vx = 0; p.vy = 0;
      }
      if (events.indexOf('clear') >= 0) { cleared = true; break; }

      maxX = Math.max(maxX, state.player.x);
      // 卡住偵測
      if (Math.abs(state.player.x - lastX) < 0.3) stuckFrames++; else stuckFrames = 0;
      lastX = state.player.x;
      if (stuckFrames > 600) break;
    }

    results.push({
      level: li + 1,
      name: def.country + ' · ' + def.city,
      cleared: cleared,
      frames: t,
      falls: falls,
      maxX: Math.round(maxX),
      goal: def.goal,
      reachedPct: Math.round(maxX / def.goal * 100),
      features: (def.features || []).map(function (f) { return f.type; }).join(','),
      featuresMet: featuresMet.join(','),
      featureHurts: featureHurts
    });
  }

  return results;
}

/**
 * 機器人：一直往右，在「站到邊緣」時才起跳。
 * 刻意跳得很晚 —— 提早起跳會落在斷崖中間，真人也是這樣玩。
 */
// 盪繩：起跳後大約這麼多帧碰到把手（起跳時要預判那時候把手在哪）
const bot_ROPE_LEAD = 14;
function makeBot(state) {
  const held = { left: false, right: true, jump: false };
  let jumpEdge = false;
  let stairTarget = null;     // v1.30 挪威積木階梯：這一跳要落在哪一塊

  const input = {
    isDown: function (a) { return !!held[a]; },
    once: function (a) { return a === 'jump' && jumpEdge; },
    takeClick: function () { return null; },
    endFrame: function () {}
  };

  function solidsAll(state) {
    // v1.30：挪威的浮冰也算落腳處（只加浮冰：木橋會塌、積木會消失，機器人照舊直接跳過去）
    const extra = state.features ? Features.solids(state).filter(function (s) { return s.floe; }) : [];
    return state.def.ground.concat(state.def.platforms || [], state.movers, extra);
  }

  /** 腳下 x 位置是否有可站立的表面 */
  function footingAt(state, x, feetY) {
    const probe = { x: x, y: feetY + 2, w: 3, h: 10 };
    const all = solidsAll(state);
    for (let i = 0; i < all.length; i++) if (U.overlap(probe, all[i])) return true;
    return false;
  }

  /** x 位置是否為危險區（尖刺/水） */
  function hazardAt(state, x) {
    const hz = (state.def.spikes || []).concat(state.def.water || []);
    const probe = { x: x, y: Levels.GROUND_Y - 2, w: 3, h: 60 };
    for (let i = 0; i < hz.length; i++) if (U.overlap(probe, hz[i])) return true;
    return false;
  }

  /** 正前方是否有牆（高過膝蓋的側面） */
  function wallAhead(state, p) {
    const probe = { x: p.x + p.w + 2, y: p.y + 6, w: 6, h: p.h - 12 };
    const all = solidsAll(state);
    for (let i = 0; i < all.length; i++) if (U.overlap(probe, all[i])) return true;
    return false;
  }

  return {
    input: input,
    think: function (state, t) {
      const p = state.player;
      const feetY = p.y + p.h;
      jumpEdge = false;
      held.right = true;
      held.left = false;

      /*
       * v1.30 挪威：終點在積木階梯頂上的高台（def.goalY）。
       * 真人的爬法：站在這一塊的右緣，等下一塊亮著（或腳下這塊快消失、下一塊馬上要出現）就往右上跳。
       */
      const fin = state.features ? state.features.list.filter(function (f) { return f.type === 'brick' && f.finale; })
        .sort(function (a, b) { return a.x - b.x; }) : [];
      if (state.def.goalY != null && fin.length && p.x + p.w > fin[0].x - 160) {
        const gp = state.def.platforms.filter(function (q) { return q.goalPlat; })[0];
        const on = function (s) { return p.onGround && Math.abs(feetY - s.y) < 3 && p.x + p.w > s.x && p.x < s.x + s.w; };
        if (gp && on(gp)) { held.jump = false; return; }           // 上了高台：一直往右走到旗子
        if (!p.onGround) {
          // 空中：對準起跳時選的那一塊的中心（不然全速往右會飛過頭）
          held.jump = p.vy < 0;
          if (stairTarget) {
            const pc = p.x + p.w / 2, tc = stairTarget.x + Math.min(stairTarget.w, 64) / 2;
            held.right = pc < tc - 6; held.left = pc > tc + 6;
          }
          return;
        }
        let idx = -1;
        fin.forEach(function (b, i) { if (on(b)) idx = i; });
        const next = idx + 1 < fin.length ? fin[idx + 1] : gp;
        const standX = idx < 0 ? fin[0].x - 40 : fin[idx].x + fin[idx].w - p.w - 4;
        if (idx < 0 && p.x > standX + 30) { held.right = false; held.left = true; held.jump = false; return; }  // 從底下走過頭了：退回去
        if (p.x < standX - 3) { held.jump = false; return; }        // 先走到起跳點
        held.right = false;
        const ns = next.goalPlat ? { on: true } : Features.brickState(next, t);
        const cs = idx < 0 ? { on: true, left: 999 } : Features.brickState(fin[idx], t);
        const go = (ns.on && cs.left > 6) || (!ns.on && cs.on && cs.left <= 26);
        if (go) { jumpEdge = true; held.jump = true; held.right = true; stairTarget = next; }
        else held.jump = false;
        return;
      }

      /*
       * v1.31 哥倫比亞的海盜盪繩：真人的玩法 ——
       *   走到水道邊停下，等把手盪回岸邊那一側、正要往回盪時起跳去抓；
       *   抓住之後不動，等繩子盪過正中間、往前衝最快的那一下按跳躍放手。
       */
      if (p.swing) {
        const v = Features.ropeVel(p.swing, t), h = Features.ropeHandle(p.swing, t);
        held.right = false; held.jump = false;
        if (v.vx > 0 && h.x >= p.swing.ax - 6) { jumpEdge = true; held.jump = true; }
        return;
      }
      const rope = state.features ? state.features.list.filter(function (f) {
        return f.type === 'rope' && p.x + p.w <= f.gx + 6 && f.gx - (p.x + p.w) < 140;
      })[0] : null;
      if (rope && p.onGround) {
        const standX = rope.gx - p.w - 2;
        if (p.x < standX - 4) { held.jump = false; return; }        // 先走到水道邊
        held.right = false;
        const ahead = Features.ropeHandle(rope, t + bot_ROPE_LEAD);
        const back = Features.ropeVel(rope, t + bot_ROPE_LEAD).vx;
        const go = ahead.x - rope.gx < 34 && back <= 0.6;
        if (go) { jumpEdge = true; held.jump = true; held.right = true; } else held.jump = false;
        return;
      }

      if (!p.onGround) {
        held.jump = true;   // 空中按住以取得完整跳躍高度
        return;
      }

      /*
       * 纜車關（v1.20）：山谷跳不過去，要搭纜車。真人的搭法：
       *   月台邊等纜車靠站 → 走上去 → 站著不動讓它載 → 快到對岸時走下去。
       */
      if (state.def.vehicle === 'cable') {
        const rm = p.ridingMover;
        if (rm) {
          held.right = rm.x + rm.w >= rm.ox + rm.range + rm.w - 4;   // 停到對岸那頭才下車
          held.jump = false;
          return;
        }
        if (!footingAt(state, p.x + p.w + 8, feetY)) {
          // 前面是山谷：找這一頭的纜車，停靠中才走上去
          const m = state.movers.filter(function (q) {
            return Math.abs((q.ox - q.range) - (p.x + p.w)) < 60;
          })[0];
          held.right = !!m && m.x <= m.ox - m.range + 4;
          held.jump = false;
          return;
        }
        // 纜車已經靠站（前面的落腳處是纜車）：直接走上去，不要因為底下是海就「跳過危險」——
        // 跳起來會越過 96 寬的車廂掉進海裡（克羅埃西亞實測掉了 49 次）
        const probe = { x: p.x + p.w + 8, y: feetY + 2, w: 3, h: 10 };
        if (state.movers.some(function (q) { return U.overlap(probe, q); })) {
          held.jump = false;
          return;
        }
        /*
         * 車站是平的、站內沒有斷崖，所以「到邊緣就跳」在這裡只會壞事：
         * 機器人跳上站上的浮空平台，再從平台尾端起跳，直接飛過整個山谷掉進海（克羅埃西亞實測）。
         * 只在撞牆時跳。
         */
        jumpEdge = wallAhead(state, p);
        held.jump = jumpEdge;
        return;
      }

      // 站到邊緣（前緣再往前 8px 就沒地板）→ 這一刻起跳
      const atEdge = !footingAt(state, p.x + p.w + 8, feetY) ||
                     hazardAt(state, p.x + p.w + 8);

      if (atEdge || wallAhead(state, p)) {
        jumpEdge = true;
        held.jump = true;
      } else {
        held.jump = false;
      }
    }
  };
}

/**
 * 魔王關「真的打得贏嗎」驗證。
 *
 * 這支跟 runBossTest() 不同：runBossTest 會作弊（直接把魔王設成破綻期、
 * 關掉玩家受傷）只驗機制接線；這支完全照正常規則跑完整場戰鬥，
 * 用一個會閃避、會抓距離的機器人，確認「帶著該有的裝備能打贏」。
 *
 * 之所以需要它：曾經發生魔王機制每一項單測都通過，但實際戰鬥
 * 永遠打不贏（破綻期碰到還是會受傷、癱太低導致跳躍飛過去、
 * 震波貼地無法閃避）。單點測試看不出這種「組合起來不可行」。
 */
function runBossFightTest() {
  const out = [];

  Levels.list.forEach(function (def, li) {
    if (!def.isBoss) return;

    // 進關時應該有的裝備（前面關卡拿得到的）
    const owned = Equipment.defs
      .filter(function (d) { return d.level < li; })
      .map(function (d) { return d.id; });
    const stats = Equipment.resolve(owned);
    const st = buildLevelState(def, li, owned, stats);
    const b = st.boss;
    const arena = def.bossArena;
    const p = st.player;

    b.phase = 'idle';
    b.timer = 90;

    let lives = stats.maxLives;
    let frame = 0, hurts = 0, hits = 0;
    let jE = false, hJ = false, hR = false, hL = false;
    let dodging = false, stompJump = false;
    const inp = {
      isDown: function (a) {
        return (a === 'right' && hR) || (a === 'left' && hL) || (a === 'jump' && hJ);
      },
      once: function (a) {
        return a === 'jump' && jE;
      },
      endFrame: function () {}
    };

    const LIMIT = 15000;
    while (frame < LIMIT && lives > 0 && !b.defeated) {
      frame++;
      updateMovers(st.movers, frame);
      updateEnemies(st, frame);
      updateBoss(st, frame);
      updateShots(st);

      jE = false; hR = false; hL = false; hJ = false;

      const bx = bossBox(b);
      const slumped = b.phase === 'recover';
      const pcx = p.x + p.w / 2, bcx = bx.x + bx.w / 2;

      // 有東西朝自己飛來就跳（震波貼地，跳起來可閃）
      /*
       * 「快撞到了」用接觸時間判斷，不用固定距離。
       * 固定 70px 在震波跟玩家同向移動時會太早跳 —— 相對速度很小，
       * 人落地時震波還在腳下（實測荷蘭魔王連跳時就是這樣被掃到）。
       */
      /*
       * 頭上有平台（低天花板）時跳不高、很快就落回地面，
       * 所以要等震波更近才跳，否則會在震波到之前就落地。
       */
      const lowCeil = (def.platforms || []).some(function (q) {
        return q.x < p.x + p.w && q.x + q.w > p.x &&
               q.y + q.h <= p.y && q.y + q.h > p.y - 110;
      });
      const reactT = lowCeil ? 5 : 13;
      const incoming = st.shots.some(function (s) {
        if (s.debris || s.ember || s.pillar) return false;   // 從天上掉的、從地底噴的另外處理
        if (!(s.y < p.y + p.h + 2 && s.y + s.h > p.y)) return false;
        const dx = (s.x + s.w / 2) - pcx;
        const gap = Math.abs(dx) - (s.w + p.w) / 2;
        if (gap < 3) return true;
        const closing = dx > 0 ? (p.vx - s.vx) : (s.vx - p.vx);
        return closing > 0.2 && gap / closing < reactT;
      });
      // 天上掉下來的碎片：在正上方就往旁邊躲
      const debrisAbove = st.shots.filter(function (s) {
        return (s.debris || s.ember) && Math.abs((s.x + s.w / 2) - pcx) < 34 && s.y < p.y;
      })[0];
      /*
       * ⚠️ 閃避跳要「按住」到上升結束。
       * 原本只在 incoming 為真時才按住，但人一離地，貼地的震波就不再跟
       * 玩家「同高度」，incoming 立刻變 false → 鬆開跳躍鍵 → 可變跳躍把
       * 上升速度砍掉，只跳起 18px，震波照樣掃到腳。真人閃震波會整個跳滿。
       */
      if (p.onGround) dodging = false;
      if (incoming && p.onGround) { jE = true; hJ = true; dodging = true; }
      else if ((incoming || dodging) && p.vy < 0) hJ = true;

      if (slumped) {
        if (!incoming) {
          /*
           * 退到 70~160px 的甜蜜區再跳過去踩頭（v1.18 拿掉揮擊後，近身只能踩頭）。
           *
           * ⚠️ 起跳區正上方不能有平台。原本只會從左邊跳，
           * 魔王被逼到左牆（x=300）時，左側甜蜜區剛好在左平台
           * （80~240, y=290）正下方 —— 每次起跳都撞到平台底、掉回震波上，
           * 同一個位置連死 4 次。真人會換到另一側跳。
           */
          const plats = def.platforms || [];
          function headroom(x0, x1) {
            return !plats.some(function (q) { return q.x < x1 && q.x + q.w > x0 && q.y > 200; });
          }
          const leftOK = headroom(bx.x - 160, bx.x - 70 + p.w) && bx.x - 160 > arena.x;
          const rightOK = headroom(bx.x + bx.w + 70 - p.w, bx.x + bx.w + 160) &&
                          bx.x + bx.w + 160 < arena.x + arena.w;
          // 優先用自己現在所在的那一側，不必穿過魔王繞到另一邊
          const onLeft = pcx < bcx;
          const side = onLeft ? (leftOK || !rightOK ? -1 : 1) : (rightOK || !leftOK ? 1 : -1);
          const d = side < 0 ? bx.x - p.x : p.x - (bx.x + bx.w);
          const toward = side < 0 ? 'R' : 'L';
          if (p.onGround) {
            stompJump = false;
            if (d > 160) { if (toward === 'R') hR = true; else hL = true; }
            else if (d < 70) { if (toward === 'R') hL = true; else hR = true; }
            else {
              jE = true; hJ = true; stompJump = true;
              if (toward === 'R') hR = true; else hL = true;
            }
          } else if (stompJump) {
            // 只有「為了踩頭而跳」才在空中往魔王方向帶；閃震波的跳不要亂帶方向
            if (toward === 'R') hR = true; else hL = true;
            if (p.vy < 0) hJ = true;
          }
        }
      } else {
        /*
         * 非破綻期：拉開距離，但要停在「下次破綻期可以立刻起跳」的位置。
         *
         * 之前只寫「離魔王 230px 以外」，結果機器人一路退到牆角，
         * 破綻期開始時距離 400+，還沒走回甜蜜區窗口就關了 ——
         * 看起來像「打不贏」，其實是站位問題。
         *
         * 實測踩頭的有效起跳距離是 70~190px，所以這裡維持在 200 附近待命。
         */
        const STANDBY = 200;
        const gapToBoss = Math.abs(pcx - bcx);
        if (gapToBoss < STANDBY - 20) {
          if (pcx < bcx) hL = true; else hR = true;      // 太近，退開
        } else if (gapToBoss > STANDBY + 40) {
          if (pcx < bcx) hR = true; else hL = true;      // 太遠，靠回來
        }
        // 撞牆就改往另一側繞（魔王會追過來，不能卡在角落）
        if (p.x <= arena.x + 4) { hL = false; hR = true; }
        if (p.x + p.w >= arena.x + arena.w - 4) { hR = false; hL = true; }
      }
      if (debrisAbove) {
        const goRight = (debrisAbove.x + debrisAbove.w / 2) < pcx;
        hR = goRight; hL = !goRight;
      }
      // 人面獅身的沙柱（v1.29.1）：腳下（或旁邊）冒出流沙漩渦就跑開，牆邊就往另一邊
      const pillarNear = st.shots.filter(function (s) {
        return s.pillar && s.x < p.x + p.w + 26 && s.x + s.w > p.x - 26;
      })[0];
      if (pillarNear) {
        let goRight = (pillarNear.x + pillarNear.w / 2) < pcx;
        if (goRight && p.x + p.w >= arena.x + arena.w - 60) goRight = false;
        if (!goRight && p.x <= arena.x + 60) goRight = true;
        hR = goRight; hL = !goRight;
        if (stompJump === false && !incoming) { jE = false; hJ = hJ && !p.onGround; }
      }

      const ev = updatePlayer(st, inp, frame);
      if (ev.indexOf('hurt') >= 0) { lives--; hurts++; }
      if (ev.indexOf('fall') >= 0) lives--;
      if (ev.indexOf('bosshit') >= 0 || ev.indexOf('bossdown') >= 0) hits++;
    }

    out.push({
      level: li + 1,
      country: def.country,
      bossName: b.name,
      hpMax: b.hpMax,
      won: b.defeated,
      hitsLanded: hits,
      timesHurt: hurts,
      livesLeft: lives,
      frames: frame
    });
  });

  return out;
}

/**
 * 魔王機制接線驗證（會作弊，只確認各判定有接上）。
 *
 * 要確認三件事：
 *   1. 帶著「該有的裝備」真的打得贏（不會因為無敵判定寫錯而無限循環）
 *   2. 破綻期之外打不動（否則魔王等於沒有機制）
 *   3. 打完魔王 → 掉落裝備可以撿到 → 才過關
 *
 * 機器人策略：站在魔王旁邊，只在 recover（破綻期）從頭頂踩下去。
 */
function runBossTest() {
  const out = [];

  Levels.list.forEach(function (def, li) {
    if (!def.isBoss) return;

    // 進魔王關時，玩家應該已經有前面關卡的裝備
    const owned = Equipment.defs
      .filter(function (d) { return d.level < li; })
      .map(function (d) { return d.id; });
    const stats = Equipment.resolve(owned);
    const state = buildLevelState(def, li, owned, stats);
    const b = state.boss;

    const log = {
      level: li + 1,
      name: def.country,
      bossName: b.name,
      hpMax: b.hpMax,
      hitsLanded: 0,
      defeated: false,
      equipTaken: false,
      cleared: false,
      frames: 0,
      playerHurt: 0
    };

    // 破綻期外踩頭應該無效 —— 先在 idle 階段試踩一次
    b.phase = 'idle'; b.timer = 90;
    const idleInput = makeIdleInput();
    {
      const bb = bossBox(b);
      state.player.x = bb.x + bb.w / 2 - state.player.w / 2;
      state.player.y = bb.y - state.player.h + 4;
      state.player.vy = 6;
      state.player.invuln = 999;
    }
    const ev0 = updatePlayer(state, idleInput, 1);
    if (ev0.indexOf('bosshit') >= 0) {
      log.bugNonVulnerableDamage = true;
    }

    // 正式開打
    const LIMIT = 40000;
    let t = 1;
    while (t < LIMIT) {
      t++;
      updateMovers(state.movers, t);
      updateEnemies(state, t);
      updateBoss(state, t);
      updateShots(state);

      const p = state.player;
      // 貼在魔王旁邊（魔王倒下後改去撿裝備）
      let targetX;
      if (state.boss.defeated && state.equip && !state.equip.taken) {
        targetX = state.equip.x - p.w / 2;
      } else {
        targetX = state.boss.x + (state.boss.x > p.x ? -24 : state.boss.w + 4);
      }
      p.x += U.clamp(targetX - p.x, -4, 4);
      p.y = Levels.GROUND_Y - p.h;
      p.vy = 0;
      p.onGround = true;
      p.invuln = 999;          // 排除受傷擊退干擾，專心驗魔王機制
      p.facing = state.boss.x >= p.x ? 1 : -1;

      // 破綻期踩頭（模擬玩家從上方落下）
      const windowOpen = state.boss.phase === 'recover' && !state.boss.defeated;
      if (windowOpen) {
        // 擺在魔王頭頂往下掉，觸發踩擊判定。
        // 用 bossBox 而不是 boss.y —— 破綻期魔王會癱矮，頭頂位置不同。
        const bb = bossBox(state.boss);
        p.x = bb.x + bb.w / 2 - p.w / 2;
        p.y = bb.y - p.h + 4;
        p.vy = 6;
      }
      const events = updatePlayer(state, idleInput, t);

      if (events.indexOf('bosshit') >= 0) log.hitsLanded++;
      if (events.indexOf('bossdown') >= 0) { log.defeated = true; log.hitsLanded++; }
      if (events.indexOf('equip') >= 0) log.equipTaken = true;
      if (events.indexOf('clear') >= 0) { log.cleared = true; break; }
    }
    log.frames = t;
    out.push(log);
  });

  return out;
}

/** 什麼鍵都不按的輸入（位置由測試直接擺，踩頭靠從上方落下） */
function makeIdleInput() {
  return {
    isDown: function () { return false; },
    once: function () { return false; },
    endFrame: function () {}
  };
}
