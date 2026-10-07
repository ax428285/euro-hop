/**
 * 繪製函式齊全檢查。在瀏覽器執行 runSpriteCheck()（node 測試腳本也能跑）。
 *
 * 由來：drawProps / equipIcon 找不到函式時會「安靜地跳過」，不會報錯。
 * 結果西班牙的聖家堂、噴泉、吉他、橘子樹與捷克的天文鐘擺了好幾個版本都沒人發現看不到，
 * 扇子、長傘、木偶、指揮棒的裝備圖示也一直是空格。這支把「有引用但畫不出來」的全部列出來。
 */
function runSpriteCheck() {
  const issues = [];
  Levels.list.forEach(function (lv) {
    (lv.props || []).forEach(function (p) {
      if (!Sprites.props[p.type]) issues.push(lv.country + '：道具 ' + p.type + ' 沒有繪製函式（畫面上看不到）');
    });
    if (lv.landmark && !Sprites.landmarks[lv.landmark]) {
      issues.push(lv.country + '：地標 ' + lv.landmark + ' 沒有繪製函式');
    }
    if (lv.deco && !Sprites.decos[lv.deco]) issues.push(lv.country + '：植物 ' + lv.deco + ' 沒有繪製函式');
    (lv.enemies || []).forEach(function (e) {
      if (!Sprites.enemyKinds[e.type]) issues.push(lv.country + '：敵人 ' + e.type + ' 沒有繪製函式');
    });
    if (lv.boss && !Sprites.bossKinds[lv.boss.kind]) issues.push(lv.country + '：魔王 ' + lv.boss.kind + ' 沒有繪製函式');
  });
  Equipment.defs.forEach(function (d) {
    if (!Sprites.icons[d.icon]) issues.push('裝備 ' + d.name + ' 的圖示 ' + d.icon + ' 沒有繪製函式');
  });
  return { issueCount: issues.length, issues: issues };
}
