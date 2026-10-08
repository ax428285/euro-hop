/**
 * 畫面煙霧測試（只能在瀏覽器跑）：runRenderCheck()
 *
 * 由來：斯洛伐克的山風在「繪製」時讀不到玩家位置而丟例外，整個畫面停住 ——
 * 所有邏輯測試都只跑物理、不畫圖，完全沒抓到。
 * 這支把每一關、每一個招牌機制附近、地圖與各種畫面都實際畫一次，有例外就列出來。
 */
function runRenderCheck() {
  const issues = [];
  function tryRender(label) {
    try { Game.debug.render(); } catch (e) { issues.push(label + '：' + e.message); }
  }
  Levels.list.forEach(function (def, li) {
    Game.debug.enter(li);
    const st = Game.debug.getState();
    st.player.invuln = 1e9;
    const spots = [0.1, 0.35, 0.6, 0.85].map(function (k) { return def.width * k; });
    (st.features ? st.features.list : []).forEach(function (f) {
      spots.push(f.x != null ? f.x - 100 : f.x0 + 300);
    });
    spots.forEach(function (x, i) {
      if (def.layout !== 'shaft') Game.debug.warpTo(Math.min(x, def.width - 200));
      for (let k = 0; k < 40; k++) {
        try { Game.debug.step(1); } catch (e) { issues.push(def.country + ' 更新：' + e.message); break; }
        if (k % 10 === 0) tryRender(def.country + ' (位置 ' + i + ')');
      }
    });
  });
  // 雙人試煉（v1.28）：每道門、每塊壓板附近都畫一次，門開著、關著各一次
  ['duoTwins', 'duoMaze'].forEach(function (kind) {
    const st = Game.debug.enterDuo(kind);
    st.players.forEach(function (p) { p.invuln = 1e9; });
    const xs = st.duo.locks.map(function (l) { return l.x - 160; }).concat(st.duo.plates.map(function (p) { return p.x - 100; }));
    xs.forEach(function (x, i) {
      Game.debug.warpTo(x);
      st.duo.locks.forEach(function (l) { l.o = i % 2; });
      for (let k = 0; k < 20; k++) {
        try { Game.debug.step(1); } catch (e) { issues.push(kind + ' 更新：' + e.message); break; }
        if (k % 10 === 0) tryRender(kind + ' (位置 ' + i + ')');
      }
    });
  });
  // 大地圖：船停在雙人試煉旁邊（資訊卡換成試煉的），單人、雙人各畫一次
  Game.debug.setScene('map');
  WorldMap.specials.filter(function (s) { return s.def.duo; }).forEach(function (sp) {
    [false, true].forEach(function (two) {
      Game.debug.setCoop(two);
      Voyage.placeShip(sp.pin[0] + 2, sp.pin[1] + 2);
      try { Game.debug.step(1); } catch (e) { issues.push(sp.name + ' 地圖更新：' + e.message); }
      tryRender('地圖 ' + sp.name + (two ? '（兩人）' : '（一人）'));
    });
  });
  Game.debug.setCoop(false);
  ['map', 'shop', 'inventory', 'saveinfo', 'shipyard', 'title'].forEach(function (s) {
    Game.debug.setScene(s);
    tryRender('畫面 ' + s);
  });
  Game.debug.setScene('title');
  return { issueCount: issues.length, issues: issues.slice(0, 20) };
}
