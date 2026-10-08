/**
 * 橫向關卡招牌機制檢查。在瀏覽器執行 runFeatureCheck()（node 測試腳本也能跑）。
 *
 *   A) 每個橫向關卡都要有自己的招牌機制，而且不能跟別國重複（不然又變單調）
 *   B) 奔牛比玩家慢（一直往前跑一定跑得掉）
 *   C) 彈跳墊、間歇泉頭上淨空（有平台會撞頭彈回來），獎勵金幣彈得到
 *   D) 啤酒桶真的會滾到玩家面前（曾經因為生在斷崖上、滾進坑裡，整關一個都碰不到）
 *   E) 鹽礦黑暗區裡有礦燈
 *   v1.30 北歐篇：
 *   I) 丹麥積木：紅藍輪流（同一時間只有一色在）、戴樂高積木一直都在、頂上的金幣跳得到
 *   J) 瑞典冰面：站在冰上會滑（放開後滑得比平地遠），馴鹿皮靴不會滑
 *   K) 挪威浮冰：每道冰海水道都有浮冰、浮冰之間跳得過去；站著不動會沉進海裡
 *   L) 芬蘭極夜：極光會亮也會暗
 */
function runFeatureCheck() {
  const issues = [];
  const seenTypes = {};
  const G = PHYS.GRAVITY;
  const COLUMN_FAR = 400;    // 離倒下的石柱夠遠（不會卡在裡面）

  Levels.list.forEach(function (def, li) {
    if (def.isBoss || def.layout === 'shaft') return;
    const fs = def.features || [];
    const tag = def.country;
    if (!fs.length) { issues.push(tag + '：沒有招牌機制'); return; }
    const kind = fs[0].type;
    if (seenTypes[kind]) issues.push(tag + '：招牌機制 ' + kind + ' 跟 ' + seenTypes[kind] + ' 重複');
    seenTypes[kind] = tag;

    fs.forEach(function (f) {
      if (f.type === 'stampede') {
        if (Features.BULL_SPEED >= PHYS.MAX_RUN) issues.push(tag + '：奔牛跑得比玩家快，躲不掉');
        if (f.x1 <= f.x0) issues.push(tag + '：奔牛區間反了');
      }
      if (f.type === 'pad' || f.type === 'geyser') {
        const v = f.type === 'pad' ? Features.PAD_V : Features.GEYSER_V;
        const rise = v * v / (2 * G);                     // 頭頂能升多高
        const col = { x: f.x - 10, y: f.y - 40 - rise, w: (f.w || 40) + 20, h: rise };
        (def.platforms || []).forEach(function (pf) {
          if (U.overlap(col, pf)) issues.push(tag + '：' + f.type + ' (x=' + f.x + ') 頭上有平台，彈起來會撞頭');
        });
        // 獎勵金幣：在這一欄上方的最高那顆要彈得到
        const top = def.coins.filter(function (c) { return Math.abs(c.x + 12 - (f.x + (f.w || 40) / 2)) < 20; })
          .reduce(function (m, c) { return Math.min(m, c.y); }, Infinity);
        if (top !== Infinity && top + 24 < f.y - 40 - rise) {
          issues.push(tag + '：' + f.type + ' 上方的金幣 (y=' + top + ') 彈不到（頂多到 ' + Math.round(f.y - 40 - rise) + '）');
        }
      }
      if (f.type === 'dark' && !(f.lamps && f.lamps.length)) issues.push(tag + '：鹽礦裡沒有礦燈，全黑看不到路');
    });

    // D) 啤酒桶：站在幾個位置等，桶子要真的滾到面前
    if (fs.some(function (f) { return f.type === 'barrels'; })) {
      const st = buildLevelState(def, li, [], Equipment.resolve([]));
      st.enemies = [];
      const p = st.player;
      const bf = st.features.list.filter(function (f) { return f.type === 'barrels'; })[0];
      let reached = 0;
      [0.2, 0.35, 0.5, 0.65, 0.8].forEach(function (k) {
        const sx = def.width * k;
        const seg = def.groundSegs.filter(function (g) { return sx >= g.x && sx <= g.x + g.w; })[0] ||
          def.groundSegs.filter(function (g) { return g.x > sx; })[0];
        if (!seg) return;
        p.x = seg.x + 20; p.y = seg.y - p.h; p.vy = 0;
        for (let f = 0; f < 300; f++) {
          p.vx = 0; p.invuln = 999;
          Features.update(st, f);
          bf.items.forEach(function (b) { if (!b.counted && b.x < p.x + 30) { b.counted = true; reached++; } });
        }
      });
      if (reached < 3) issues.push(tag + '：啤酒桶只有 ' + reached + ' 個滾到玩家面前，這個機制等於不存在');
    }

    /*
     * F) 突尼西亞駱駝（v1.23）：站在靠左岸的駝峰上不動，要被載到右岸、而且一路沒受傷、沒掉進鹽泥。
     *    鹽泥本身：硬走過去要受傷（不然駱駝就沒意義了）。
     */
    if (fs.some(function (f) { return f.type === 'camel'; })) {
      const input = { isDown: function () { return false; }, once: function () { return false; }, endFrame: function () {} };
      const st = buildLevelState(def, li, [], Equipment.resolve([]));
      st.enemies = [];
      const p = st.player;
      const cam = st.features.list.filter(function (f) { return f.type === 'camel'; })[0];
      const brine = st.features.list.filter(function (f) { return f.brine && f.x > cam.x0 && f.x < cam.x1 + 100; })[0];
      // 找駱駝停在左岸的時刻
      let t0 = 0;
      while (Features.camelX(cam, t0).moving || Features.camelX(cam, t0).x !== cam.x0) t0++;
      Features.update(st, t0);
      p.x = cam.hump.x + 10; p.y = cam.hump.y - p.h; p.vy = 0;
      let hurt = 0, sunk = false, maxX = 0;
      for (let f = 1; f < 420; f++) {
        Features.update(st, t0 + f).forEach(function (e) { if (/:hurt$/.test(e)) hurt++; });
        updatePlayer(st, input, t0 + f);
        if (p.inSand) sunk = true;
        maxX = Math.max(maxX, p.x);
      }
      if (hurt || sunk) issues.push(tag + '：坐在駝峰上不動，還是陷進鹽泥／受傷（受傷 ' + hurt + '）');
      if (!(maxX > brine.x + brine.w)) issues.push(tag + '：坐駱駝沒有被載到對岸（x=' + Math.round(maxX) + '，鹽泥到 ' + (brine.x + brine.w) + '）');
      // 硬走過鹽泥
      const st2 = buildLevelState(def, li, [], Equipment.resolve([]));
      st2.enemies = [];
      const p2 = st2.player;
      const b2 = st2.features.list.filter(function (f) { return f.brine; })[0];
      st2.features.list = st2.features.list.filter(function (f) { return f.type !== 'camel'; });
      p2.x = b2.x - 30; p2.y = b2.y - p2.h; p2.vy = 0;
      const walk = { isDown: function (a) { return a === 'right'; }, once: function () { return false; }, endFrame: function () {} };
      let hurt2 = 0;
      for (let f = 0; f < 240 && p2.x < b2.x + b2.w; f++) {
        Features.update(st2, f).forEach(function (e) { if (/:hurt$/.test(e)) hurt2++; });
        updatePlayer(st2, walk, f);
      }
      if (!hurt2) issues.push(tag + '：直接走過鹽泥也不會受傷，駱駝沒有存在的必要');
    }

    // H) 駱駝坐騎（v1.23.1）：碰到就騎上去；騎著走過流沙／鹽泥不會陷
    if (fs.some(function (f) { return f.type === 'mount'; })) {
      const st = buildLevelState(def, li, [], Equipment.resolve([]));
      st.enemies = [];
      const p = st.player;
      const mt = st.features.list.filter(function (f) { return f.type === 'mount'; })[0];
      p.x = mt.x + 30; p.y = mt.y - p.h; p.vy = 0;
      Features.update(st, 0);
      if (!p.mount) issues.push(tag + '：碰到駱駝沒有騎上去');
      const sand = st.features.list.filter(function (f) { return f.type === 'sand'; })[0];
      if (sand && p.mount) {
        p.x = sand.x + 20; p.y = sand.y - p.h; p.onGround = true;
        Features.update(st, 1);
        if (p.inSand) issues.push(tag + '：騎著駱駝還是陷進沙裡');
      }
    } else if (def.region === 'africa') {
      issues.push(tag + '：非洲關沒有駱駝坐騎');
    }

    // G) 利比亞石柱（v1.23）：走近會倒、站在倒下的範圍裡會受傷、倒完變成可以踩的矮牆
    if (fs.some(function (f) { return f.type === 'column'; })) {
      const st = buildLevelState(def, li, [], Equipment.resolve([]));
      st.enemies = [];
      const p = st.player;
      const col = st.features.list.filter(function (f) { return f.type === 'column'; })[0];
      p.x = col.x - 80; p.y = col.y - p.h; p.vy = 0; p.invuln = 0;
      let hurt = 0;
      for (let f = 0; f < 120; f++) Features.update(st, f).forEach(function (e) { if (/:hurt$/.test(e)) hurt++; });
      if (col.state !== 'down') issues.push(tag + '：玩家站在石柱旁邊，石柱沒有倒（' + col.state + '）');
      if (!hurt) issues.push(tag + '：站在石柱倒下的範圍裡沒有受傷');
      p.x = col.x - COLUMN_FAR; p.invuln = 0;
      Features.update(st, 200);
      if (Features.solids(st).indexOf(col.lying) < 0) issues.push(tag + '：倒下的石柱沒有變成可以踩的地形');
    }

    // I) 丹麥積木
    if (fs.some(function (f) { return f.type === 'brick'; })) {
      const bricks = fs.filter(function (f) { return f.type === 'brick'; });
      if (bricks.length < 9) issues.push(tag + '：積木階梯只放了 ' + bricks.length / 3 + ' 座');
      const a = bricks[0], b = bricks[1];
      let both = 0, onA = 0, onB = 0;
      for (let t = 0; t < Features.BRICK_CYCLE; t++) {
        const sa = Features.brickState(a, t).on, sb = Features.brickState(b, t).on;
        if (sa && sb) both++;
        if (sa) onA++;
        if (sb) onB++;
      }
      if (both) issues.push(tag + '：紅藍積木有 ' + both + ' 帧同時都在，不用抓節奏');
      if (!onA || !onB) issues.push(tag + '：有一色的積木從來不出現');
      const st = buildLevelState(def, li, ['lego'], Equipment.resolve(['lego']));
      Features.update(st, a.color === 0 ? Features.BRICK_CYCLE - 1 : 0);    // 這一帧 a 是沒亮的
      const sol = Features.solids(st);
      const live = st.features.list.filter(function (f) { return f.type === 'brick' && f.x === a.x && f.y === a.y; })[0];
      if (sol.indexOf(live) < 0) issues.push(tag + '：戴著樂高積木，沒亮的積木還是踩不到');
      // 最上面那塊頂上的金幣：從那塊積木跳得到
      const top = bricks[2];
      const rise = PHYS.JUMP_V * PHYS.JUMP_V / (2 * G);
      const cs = def.coins.filter(function (c) { return c.x > top.x - 10 && c.x < top.x + top.w + 10 && c.y < top.y; });
      if (!cs.length) issues.push(tag + '：積木階梯頂上沒有金幣');
      cs.forEach(function (c) { if (c.y + 24 < top.y - 40 - rise) issues.push(tag + '：積木頂上的金幣跳不到 (y=' + c.y + ')'); });
    }

    // J) 瑞典冰面：同樣全速跑、同時放開，冰上要滑得比較遠；穿馴鹿皮靴就跟平地一樣
    if (fs.some(function (f) { return f.type === 'ice'; })) {
      const zone = fs.filter(function (f) { return f.type === 'ice'; })[0];
      function slide(owned) {
        const st = buildLevelState(def, li, owned, Equipment.resolve(owned));
        st.enemies = [];
        const p = st.player;
        const seg = def.groundSegs.filter(function (g) { return g.x + g.w > zone.x0 + 300 && g.x < zone.x1 && g.w > 380; })[0];
        if (!seg) return null;
        p.x = Math.max(seg.x, zone.x0) + 20; p.y = seg.y - p.h; p.vy = 0; p.onGround = true;
        const run = { isDown: function (k) { return k === 'right'; }, once: function () { return false; }, endFrame: function () {} };
        const stop = { isDown: function () { return false; }, once: function () { return false; }, endFrame: function () {} };
        for (let f = 0; f < 40; f++) { updatePlayer(st, run, f); Features.update(st, f); }
        const x0 = p.x;
        for (let f = 40; f < 160; f++) { updatePlayer(st, stop, f); Features.update(st, f); }
        return p.x - x0;
      }
      if (def.autorun) {
        /*
         * v1.30 瑞典改成馴鹿雪橇（自動往前衝）：冰上要衝得比平地快；穿馴鹿皮靴就不會暴衝。
         * 在冰面區間的地面上跑 120 帧，量最快的速度。
         */
        const top = function (owned, onIce) {
          const st = buildLevelState(def, li, owned, Equipment.resolve(owned));
          st.enemies = [];
          const p = st.player;
          const seg = def.groundSegs.filter(function (g) {
            const inZone = g.x + g.w > zone.x0 + 300 && g.x < zone.x1;
            return g.w > 380 && (onIce ? inZone : !def.features.some(function (z) { return z.type === 'ice' && g.x + g.w > z.x0 && g.x < z.x1; }));
          })[0];
          if (!seg) return null;
          p.x = (onIce ? Math.max(seg.x, zone.x0) : seg.x) + 20; p.y = seg.y - p.h; p.vy = 0; p.onGround = true;
          const idle = { isDown: function () { return false; }, once: function () { return false; }, endFrame: function () {} };
          let mx = 0;
          for (let f = 0; f < 70; f++) { updatePlayer(st, idle, f); Features.update(st, f); mx = Math.max(mx, p.vx); }
          return mx;
        };
        const iceV = top([], true), groundV = top([], false), gripV = top(['nutukas'], true);
        if (iceV == null || groundV == null) issues.push(tag + '：雪橇測試找不到冰面／平地的地面');
        else {
          if (!(groundV > 3)) issues.push(tag + '：雪橇沒有自己往前衝（最快 ' + groundV.toFixed(1) + '）');
          if (!(iceV > groundV * 1.15)) issues.push(tag + '：雪橇在冰上沒有比較快（' + iceV.toFixed(1) + ' vs ' + groundV.toFixed(1) + '）');
          if (!(gripV < iceV - 0.3)) issues.push(tag + '：穿馴鹿皮靴，雪橇在冰上還是暴衝');
        }
      } else {
      const ice = slide([]), grip = slide(['nutukas']);
      if (ice == null) issues.push(tag + '：冰面區間裡找不到夠長的地面');
      else {
        if (ice < 30) issues.push(tag + '：站在冰上放開方向鍵只滑了 ' + Math.round(ice) + 'px，感覺不到冰');
        if (!(grip < ice - 20)) issues.push(tag + '：穿馴鹿皮靴還是一樣滑（' + Math.round(grip) + ' vs ' + Math.round(ice) + '）');
      }
      }
    }

    // K) 挪威浮冰
    if (fs.some(function (f) { return f.type === 'floe'; })) {
      (def.channels || []).forEach(function (ch) {
        const fl = fs.filter(function (f) { return f.type === 'floe' && f.bx > ch.x && f.bx < ch.x + ch.w; })
          .sort(function (a, b) { return a.bx - b.bx; });
        if (!fl.length) { issues.push(tag + '：冰海水道 x=' + ch.x + ' 上面沒有浮冰，過不去'); return; }
        // 每一跳（岸 → 浮冰 → 浮冰 → 岸）在浮冰漂得最遠的時候都要跳得過
        const pts = [ch.x];
        fl.forEach(function (f) { pts.push(f.bx - f.amp, f.bx + f.w + f.amp); });
        pts.push(ch.x + ch.w);
        for (let k = 0; k + 1 < pts.length; k += 2) {
          if (pts[k + 1] - pts[k] > 130) issues.push(tag + '：冰海水道 x=' + ch.x + ' 有一跳要 ' + Math.round(pts[k + 1] - pts[k]) + 'px，太遠');
        }
      });
      if (!(def.channels || []).length) issues.push(tag + '：有浮冰但沒有冰海水道');
      // 站在浮冰上不動：要沉進海裡（不能當成一般平台）
      const st = buildLevelState(def, li, [], Equipment.resolve([]));
      st.enemies = [];
      const p = st.player;
      const floe = st.features.list.filter(function (f) { return f.type === 'floe'; })[0];
      Features.update(st, 0);
      p.x = floe.box.x + 20; p.y = floe.box.y - p.h; p.vy = 0;
      const idle = { isDown: function () { return false; }, once: function () { return false; }, endFrame: function () {} };
      let fell = false, rodeAt = -1;
      for (let f = 1; f < 200 && !fell; f++) {
        const ev = updatePlayer(st, idle, f);
        Features.update(st, f);
        if (rodeAt < 0 && p.ridingMover === floe.box) rodeAt = f;
        if (ev.indexOf('fall') >= 0) fell = true;
      }
      if (rodeAt < 0) issues.push(tag + '：站到浮冰上沒有被當成可以站的平台');
      if (!fell) issues.push(tag + '：站在浮冰上 200 帧都沒沉下去，浮冰等於普通平台');
    }

    // L) 芬蘭極夜
    if (fs.some(function (f) { return f.type === 'aurora'; })) {
      let dark = 0, bright = 0;
      for (let t = 0; t < Features.AURORA_CYCLE; t++) {
        const g = Features.auroraGlow(t);
        if (g === 0) dark++;
        if (g === 1) bright++;
      }
      if (!dark || !bright) issues.push(tag + '：極光沒有亮暗交替（暗 ' + dark + '、亮 ' + bright + ' 帧）');
      if (bright < 60) issues.push(tag + '：極光亮的時間太短，來不及看路');
    }
  });
  return { issueCount: issues.length, issues: issues, kinds: seenTypes };
}
