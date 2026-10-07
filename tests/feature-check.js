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
  });
  return { issueCount: issues.length, issues: issues, kinds: seenTypes };
}
