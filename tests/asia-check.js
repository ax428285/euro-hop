/**
 * v1.32.1 亞洲篇（第一批：伊朗、烏茲別克）檢查。在瀏覽器執行 runAsiaCheck()。
 *
 *   A) 亞洲地圖：useWorld('as') 有伊朗、烏茲別克的圖釘（在陸地上），而且只出現在亞洲地圖、不在歐洲地圖
 *   B) 絲路：歐洲地圖在土耳其一直往東走，走到底會回報 silkEast；亞洲地圖一直往西走回報 silkWest
 *   C) 絲路還沒開通時過不去；開通後過得去、落腳點在亞洲的陸地上；往西走回到歐洲
 *   D) 亞洲的關卡「金幣」是蠶繭：入帳到 Save.flag('cocoons')，不進錢包
 *   E) 招牌機制：伊朗有氣流、宣禮塔、整關坐飛毯；烏茲別克有駱駝商隊，盜賊撞到駱駝會扣貨、扣光扣一條命
 * 會暫時改存檔，結束前還原。
 */
function runAsiaCheck() {
  const issues = [];
  const sv = Save.get(), keep = JSON.stringify(sv);
  const startWorld = WorldMap.world();
  const AS = Levels.list.map(function (lv, i) { return lv.region === 'asia' ? i : -1; }).filter(function (i) { return i >= 0; });
  try {
    if (AS.length < 2) issues.push('亞洲的關卡少於 2 關（' + AS.length + '）');
    if (AS[0] !== Levels.list.length - AS.length) issues.push('亞洲的關卡沒有接在關卡清單的最後面');

    // ── A) 地圖 ──
    WorldMap.useWorld('as'); Voyage.rebuild();
    ['IR', 'UZ'].forEach(function (id) {
      const n = WorldMap.nations.filter(function (q) { return Levels.list[q.idx].id === id; })[0];
      if (!n) { issues.push('亞洲地圖上沒有 ' + id); return; }
      if (!Voyage.isLand(n.pin[0], n.pin[1])) issues.push(id + ' 的圖釘不在陸地上');
    });
    if (WorldMap.nations.some(function (n) { return Levels.list[n.idx].region !== 'asia'; })) issues.push('亞洲地圖上出現了別洲的國家');
    // ── B) 往西走到底 ──
    (function () {
      const p = WorldMap.project(46.2, 38.2);
      let at = null;
      for (let r = 0; r <= 120 && !at; r += 6) for (let k = 0; k < 16 && !at; k++) {
        const x = p[0] + Math.cos(k * Math.PI / 8) * r, y = p[1] + Math.sin(k * Math.PI / 8) * r;
        if (Voyage.isLand(x, y)) at = { x: x, y: y };
      }
      if (!at) { issues.push('亞洲：絲路的入口附近沒有陸地'); return; }
      Voyage.placeShip(at.x, at.y);
      const inp = { isDown: function (a) { return a === 'left'; }, once: function () { return false; } };
      let hit = false;
      for (let f = 0; f < 900 && !hit; f++) hit = Voyage.update(inp).indexOf('silkWest') >= 0;
      if (!hit) issues.push('亞洲：從入口一直往西走，到不了地圖西邊（回不了歐洲）');
    })();
    WorldMap.useWorld('eu'); Voyage.rebuild();
    if (WorldMap.nations.some(function (n) { return Levels.list[n.idx].region === 'asia'; })) issues.push('歐洲地圖上出現了亞洲的國家');
    // ── B) 往東走到底 ──
    (function () {
      const p = WorldMap.project(43.4, 39.4);
      let at = null;
      for (let r = 0; r <= 120 && !at; r += 6) for (let k = 0; k < 16 && !at; k++) {
        const x = p[0] + Math.cos(k * Math.PI / 8) * r, y = p[1] + Math.sin(k * Math.PI / 8) * r;
        if (Voyage.isLand(x, y)) at = { x: x, y: y };
      }
      if (!at) { issues.push('歐洲：土耳其東邊沒有陸地'); return; }
      Voyage.placeShip(at.x - 30, at.y);
      const inp = { isDown: function (a) { return a === 'right'; }, once: function () { return false; } };
      let hit = false;
      for (let f = 0; f < 900 && !hit; f++) hit = Voyage.update(inp).indexOf('silkEast') >= 0;
      if (!hit) issues.push('歐洲：在土耳其一直往東走，沒有回報 silkEast（去不了亞洲）');
    })();

    // ── C) 開通條件（照真的地圖流程走：Game 的地圖畫面收到 silkEast） ──
    if (typeof Game.debug.crossSilk === 'function') {
      sv.flags.silkRoad = 0;
      Game.debug.setScene('map');
      Game.debug.crossSilk('as');
      if (WorldMap.world() !== 'eu') issues.push('絲路還沒開通，就走進亞洲了');
      sv.flags.silkRoad = 1;
      Game.debug.crossSilk('as');
      if (WorldMap.world() !== 'as') issues.push('絲路開通了，還是走不進亞洲');
      else if (!Voyage.isLand(Voyage.shipPos().x, Voyage.shipPos().y)) issues.push('走進亞洲的落腳點不在陸地上');
      Game.debug.crossSilk('eu');
      if (WorldMap.world() !== 'eu') issues.push('從亞洲往西走，沒有回到歐洲');
    } else issues.push('Game.debug.crossSilk 不見了');

    // ── D) 蠶繭 ──
    sv.flags.cocoons = 0;
    const w0 = sv.wallet;
    Game.debug.enter(AS[0]);
    if (Game.harvestKind() !== 'cocoon') issues.push('亞洲的關卡「金幣」不是蠶繭（' + Game.harvestKind() + '）');
    if (typeof Sprites.cocoon !== 'function') issues.push('沒有蠶繭的畫法');
    if (typeof Game.debug.bank === 'function') {
      Game.debug.bank(7);
      if (Save.flag('cocoons') !== 7 || sv.wallet !== w0) issues.push('蠶繭沒有入帳到 cocoons（cocoons ' + Save.flag('cocoons') + '、錢包 ' + (sv.wallet - w0) + '）');
    }

    // ── E) 招牌機制 ──
    const IR = Levels.list.filter(function (l) { return l.id === 'IR'; })[0];
    const UZ = Levels.list.filter(function (l) { return l.id === 'UZ'; })[0];
    const fsIR = Features.makeState(IR).list;
    if (!IR.carpet) issues.push('伊朗沒有坐飛毯');
    if (fsIR.filter(function (f) { return f.type === 'wind'; }).length < 3) issues.push('伊朗的氣流少於 3 段');
    if (fsIR.filter(function (f) { return f.type === 'minaret'; }).length < 3) issues.push('伊朗的宣禮塔少於 3 座');
    fsIR.filter(function (f) { return f.type === 'minaret'; }).forEach(function (f) {
      if (f.h + 26 > 210) issues.push('伊朗的宣禮塔太高（' + (f.h + 26) + '），飛毯飛不過去');
    });
    const fsUZ = Features.makeState(UZ);
    const ct = fsUZ.list.filter(function (f) { return f.type === 'camelTrain'; })[0];
    if (!ct) issues.push('烏茲別克沒有駱駝商隊');
    else {
      // 模擬：玩家往右走一段，駱駝跟在後面；放一個盜賊撞上駱駝
      const p = { x: 300, y: Levels.GROUND_Y - 30, w: 22, h: 30, vx: 0, vy: 0, stats: {}, pid: 0, invuln: 0 };
      const st = { def: UZ, players: [p], features: fsUZ, particles: [], enemies: [], shots: [] };
      for (let f = 0; f < 120; f++) { p.x += 2; Features.update(st, f); }
      if (!ct.box) issues.push('駱駝沒有跟在玩家後面');
      else {
        if (ct.box.x >= p.x) issues.push('駱駝沒有走在玩家後面');
        let lost = 0;
        for (let k = 0; k < SilkRoad.CAMEL_HP; k++) {
          const e = makeEnemy({ type: 'walker', x: ct.box.x + 10, y: ct.box.y + ct.box.h - 26, left: 0, right: 9999 });
          e.bandit = true; st.enemies.push(e);
          const ev = Features.update(st, 200 + k);
          if (ev.indexOf('p0:caravanLost') >= 0) lost++;
          if (e.alive) issues.push('盜賊撞到駱駝後沒有消失');
        }
        if (lost !== 1) issues.push('駱駝被撞 ' + SilkRoad.CAMEL_HP + ' 次，應該扣一條命（caravanLost ' + lost + ' 次）');
        if (ct.hp !== SilkRoad.CAMEL_HP) issues.push('貨被搶光後駱駝沒有重新裝貨（剩 ' + ct.hp + '）');
      }
    }
    ['IR', 'UZ'].forEach(function (id) {
      if (!Sprites.skylines[id]) issues.push(id + ' 沒有遠景');
      if (!Sprites.countryEnemies[id]) issues.push(id + ' 沒有自己的敵人長相');
      if (!Music.tracks[id]) issues.push(id + ' 沒有曲子');
      if (!Mystery.CLUES[id]) issues.push(id + ' 沒有亞洲之謎的線索');
    });
    if (!Music.tracks.ASMAP) issues.push('亞洲大地圖沒有曲子');
    Game.debug.setScene('map');
  } catch (e) {
    issues.push('出錯：' + e.message);
  }
  const back = JSON.parse(keep);
  Object.keys(sv).forEach(function (k) { if (!(k in back)) delete sv[k]; });
  Object.keys(back).forEach(function (k) { sv[k] = back[k]; });
  Save.touch();
  if (WorldMap.world() !== startWorld) { WorldMap.useWorld(startWorld); Voyage.rebuild(); }
  return { issueCount: issues.length, issues: issues };
}
