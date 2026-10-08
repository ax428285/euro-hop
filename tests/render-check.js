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
  ['map', 'shop', 'inventory', 'saveinfo', 'shipyard', 'title'].forEach(function (s) {
    Game.debug.setScene(s);
    tryRender('畫面 ' + s);
  });
  Game.debug.setScene('title');
  return { issueCount: issues.length, issues: issues.slice(0, 20) };
}
