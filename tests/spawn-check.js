/**
 * 開場安全檢查。在瀏覽器執行 runSpawnCheck()（node 測試腳本也能跑）。
 *
 * 由來：關卡產生器把第一個敵人的巡邏區從 x=40 開始排，玩家出生在 x=120，
 * 結果一進關卡什麼都沒按就被撞；希臘的砲台甚至跟出生點同一格。
 *
 *   A) 出生點附近（右邊 SAFE 內）不能有敵人的巡邏範圍
 *   B) 魔王一開始要離玩家夠遠
 *   C) 真物理：玩家站著不動 90 帧（1.5 秒），不能受傷
 */
function runSpawnCheck() {
  const issues = [];
  const SAFE = 420;
  Levels.list.forEach(function (def, li) {
    if (def.layout === 'shaft' || def.layout === 'race') return;
    const st = buildLevelState(def, li, [], Equipment.resolve([]));
    const p = st.player;
    const zone = { x: p.x - 80, y: 0, w: SAFE + 80 + p.w, h: 600 };
    st.enemies.forEach(function (e) {
      const box = { x: e.left, y: 0, w: Math.max(30, e.right - e.left + e.w), h: 600 };
      if (U.overlap(zone, box)) {
        issues.push(def.country + '：' + e.type + ' 的巡邏範圍 [' + e.left + ',' + e.right +
          '] 碰到出生點附近（出生 x=' + Math.round(p.x) + '）');
      }
    });
    if (st.boss && Math.abs(st.boss.x - p.x) < 400) {
      issues.push(def.country + '：魔王一開始離玩家只有 ' + Math.round(Math.abs(st.boss.x - p.x)) + 'px');
    }
    const idle = { isDown: function () { return false; }, once: function () { return false; }, endFrame: function () {} };
    let hurt = 0;
    for (let f = 0; f < 90; f++) {
      updateMovers(st.movers, f);
      updateEnemies(st, f);
      updateBoss(st, f);
      updateShots(st);
      const ev = updatePlayer(st, idle, f);
      if (st.features) Features.update(st, f).forEach(function (e) { if (/:hurt$/.test(e)) ev.push('hurt'); });
      if (ev.indexOf('hurt') >= 0) hurt++;
    }
    if (hurt) issues.push(def.country + '：站在出生點不動 1.5 秒內就受傷 ' + hurt + ' 次');
  });
  return { issueCount: issues.length, issues: issues };
}
