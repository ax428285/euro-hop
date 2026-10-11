/**
 * v1.32 咖啡與絲路檢查。在瀏覽器執行 runCoffeeCheck()。
 *
 *   A) 中南美洲的關卡（region america）「金幣」是咖啡果實：Game.cherryMode() 為真；歐洲的關卡不是
 *   B) 新大陸地圖上有咖啡烘豆場、歐洲地圖上有絲路公主（都在陸地上）
 *   C) 烘豆場：錢不夠蓋不了；夠錢、聽完就蓋好扣錢；每 ROAST_PER 顆果實烘成一箱烘焙咖啡豆（放船艙）；船艙滿了不烘
 *   D) 烘焙咖啡豆在四個貿易港都能賣、都買不到
 *   E) 絲路公主：沒咖啡只給委託；交 PRINCESS_NEED 箱 → 開通絲路（flag silkRoad），咖啡從船艙扣掉
 * 會暫時改存檔，結束前還原。
 */
function runCoffeeCheck() {
  const issues = [];
  const sv = Save.get(), keep = JSON.stringify(sv);
  try {
    // ── A) 咖啡果實模式 ──
    const am = Levels.list.findIndex(function (l) { return l.region === 'america' && l.layout !== 'race'; });
    const eu = Levels.list.findIndex(function (l) { return l.region === 'west'; });
    Game.debug.enter(am);
    if (!Game.cherryMode()) issues.push('中南美洲的關卡沒有變成咖啡果實（' + Levels.list[am].country + '）');
    Game.debug.enter(eu);
    if (Game.cherryMode()) issues.push('歐洲的關卡也變成咖啡果實了');
    Game.debug.setScene('map');
    if (typeof Sprites.cherry !== 'function') issues.push('沒有咖啡果實的畫法');

    // ── B) 地圖上的地點 ──
    WorldMap.useWorld('am'); Voyage.rebuild();
    const ro = WorldMap.specials.filter(function (s) { return s.def.npc === 'roastery'; })[0];
    if (!ro) issues.push('新大陸地圖上沒有咖啡烘豆場');
    else if (!Voyage.isLand(ro.pin[0], ro.pin[1])) issues.push('咖啡烘豆場不在陸地上');
    WorldMap.useWorld('eu'); Voyage.rebuild();
    const pr = WorldMap.specials.filter(function (s) { return s.def.npc === 'princess'; })[0];
    if (!pr) issues.push('歐洲地圖上沒有絲路公主');
    else if (!Voyage.isLand(pr.pin[0], pr.pin[1])) issues.push('絲路公主不在陸地上');

    // ── C) 烘豆場 ──
    sv.flags.roastery = 0; sv.flags.cherries = 0; sv.cargo = {};
    sv.wallet = Quests.ROAST_COST - 1;
    let tk = Quests.talk('roastery');
    if (tk.end) issues.push('錢不夠也能蓋烘豆場');
    sv.wallet = Quests.ROAST_COST + 100;
    tk = Quests.talk('roastery');
    if (!tk.end) issues.push('錢夠了卻沒辦法蓋烘豆場');
    else {
      tk.end(false);
      if (Save.flag('roastery')) issues.push('對話沒聽完就蓋好了');
      tk.end(true);
      if (!Save.flag('roastery') || sv.wallet !== 100) issues.push('蓋烘豆場沒有扣 ' + Quests.ROAST_COST + '（剩 ' + sv.wallet + '）');
    }
    sv.flags.cherries = Quests.ROAST_PER * 2 + 3;
    tk = Quests.talk('roastery');
    if (tk.end) tk.end(true);
    if ((sv.cargo.coffee || 0) !== 2 || Save.flag('cherries') !== 3) issues.push('果實沒有照 ' + Quests.ROAST_PER + ' 顆一箱烘成咖啡豆（船上 ' + (sv.cargo.coffee || 0) + ' 箱、剩 ' + Save.flag('cherries') + ' 顆）');
    // 船艙滿了不烘
    const cap = Trade.capacity(Save.ship()) + (Shop.resolve().hold || 0);
    sv.cargo = { coffee: cap }; sv.flags.cherries = Quests.ROAST_PER * 5;
    tk = Quests.talk('roastery');
    if (tk.end) { tk.end(true); }
    if (sv.cargo.coffee !== cap) issues.push('船艙滿了還硬塞咖啡豆');

    // ── D) 碼頭 ──
    Trade.PORTS.forEach(function (p) {
      const q = Trade.price(p.id, 'coffee', sv.day || 0);
      if (q.buy != null) issues.push(p.name + '買得到烘焙咖啡豆（應該只能烘）');
      if (!(q.sell > 0)) issues.push(p.name + '不收烘焙咖啡豆');
    });

    // ── E) 絲路公主 ──
    sv.flags.silkRoad = 0; sv.cargo = { coffee: Quests.PRINCESS_NEED - 1 };
    tk = Quests.talk('princess');
    if (tk.end) tk.end(true);
    if (Save.flag('silkRoad')) issues.push('咖啡不夠也開通絲路了');
    sv.cargo = { coffee: Quests.PRINCESS_NEED + 1 };
    tk = Quests.talk('princess');
    tk.end(false);
    if (Save.flag('silkRoad')) issues.push('話沒聽完就開通絲路了');
    tk.end(true);
    if (!Save.flag('silkRoad')) issues.push('交了咖啡豆，絲路沒有開通');
    if (sv.cargo.coffee !== 1) issues.push('交給公主的咖啡豆沒有從船艙扣掉（剩 ' + sv.cargo.coffee + ' 箱）');
  } catch (e) {
    issues.push('出錯：' + e.message);
  }
  const back = JSON.parse(keep);
  Object.keys(sv).forEach(function (k) { if (!(k in back)) delete sv[k]; });
  Object.keys(back).forEach(function (k) { sv[k] = back[k]; });
  Save.touch();
  return { issueCount: issues.length, issues: issues };
}
