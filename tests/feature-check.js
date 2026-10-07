/**
 * 橫向關卡招牌機制檢查。在瀏覽器執行 runFeatureCheck()（node 測試腳本也能跑）。
 *
 *   A) 每個橫向關卡都要有自己的招牌機制，而且不能跟別國重複（不然又變單調）
 *   B) 奔牛比玩家慢（一直往前跑一定跑得掉）
 *   C) 彈跳墊、間歇泉頭上淨空（有平台會撞頭彈回來），獎勵金幣彈得到
 *   D) 啤酒桶真的會滾到玩家面前（曾經因為生在斷崖上、滾進坑裡，整關一個都碰不到）
 *   E) 鹽礦黑暗區裡有礦燈
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
  });
  return { issueCount: issues.length, issues: issues, kinds: seenTypes };
}
