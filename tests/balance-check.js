/**
 * 數值與流程檢查（v1.13.1，玩家回饋三項）。在瀏覽器執行 runBalanceCheck()。
 *
 *   1. 海上怪 EXP：Lv1 海鷗不能少到「白打」—— 牠一定打滿全程，用「每秒 EXP」比較
 *   2. 大地圖步行速度：實際走得到的速度（不是 max 設定值）要夠快，但仍比開船慢
 *   3. 打完關卡回地圖：人物停在剛打完的那一國，不會被傳到下一國
 *
 * ⚠️ 會動到存檔（解鎖關卡），先備份、測完還原。
 */
function runBalanceCheck() {
  const issues = [];
  const report = {};

  // ── 1. EXP ───────────────────────────────────────
  const K = Encounter.KINDS;
  const GULL_SECONDS = 25;       // 守護午餐：撐滿全程（約 1500 帧）
  const gullRate = K.gulls.exp / GULL_SECONDS;
  report.gullExpPerSec = Math.round(gullRate * 10) / 10;
  if (!(K.gulls.exp < K.pirates.exp && K.pirates.exp < K.serpent.exp)) {
    issues.push('EXP 要隨等級遞增：海鷗 ' + K.gulls.exp + ' / 海盜 ' + K.pirates.exp + ' / 海蛇 ' + K.serpent.exp);
  }
  if (gullRate < 2.5) issues.push('海鷗每秒只有 ' + report.gullExpPerSec + ' EXP，打 Lv1 怪太不划算');
  const fights = Math.ceil(Encounter.EAST_EXP / ((K.gulls.exp + K.pirates.exp + K.serpent.exp) / 3));
  report.fightsToEast = fights;
  if (fights < 3) issues.push('解鎖東歐篇只要 ' + fights + ' 場，太容易');
  if (fights > 5) issues.push('解鎖東歐篇要 ' + fights + ' 場，太久');

  // ── 2. 步行速度 ───────────────────────────────────
  /** 假輸入：一直按住某方向 */
  function hold(dir) {
    return { isDown: function (a) { return a === dir; }, once: function () { return false; }, endFrame: function () {} };
  }
  /** 從某點往某方向走 n 帧，只算還在陸地上的那段的平均速度 */
  function walkSpeed(port, dir, n) {
    Voyage.reset(port.idx);
    if (Voyage.mode() !== 'land') return null;
    const input = hold(dir);
    for (let i = 0; i < 15; i++) {                        // 先加速到穩定
      Voyage.update(input);
      if (Voyage.mode() !== 'land') return null;          // 中途下過海，速度混到船速，不算
    }
    const a = Voyage.shipPos();
    let b = a, k = 0;
    while (k < n) {
      Voyage.update(input);
      if (Voyage.mode() !== 'land') break;                // 走到海邊：這一步不算
      b = Voyage.shipPos();
      k++;
    }
    if (k < 20) return null;                              // 太快走到海邊，這個方向不準
    return Math.hypot(b.x - a.x, b.y - a.y) / k;
  }
  const speeds = [];
  Voyage.ports().forEach(function (p) {
    ['left', 'right', 'up', 'down'].forEach(function (d) {
      const s = walkSpeed(p, d, 60);
      if (s != null) speeds.push(s);
    });
  });
  const walk = speeds.reduce(function (m, s) { return Math.max(m, s); }, 0);
  report.walkSpeed = Math.round(walk * 100) / 100;
  report.seaMax = Voyage.SEA.max;
  if (!speeds.length) issues.push('找不到可以測步行的路段');
  if (walk < 2.0) issues.push('步行實際速度 ' + report.walkSpeed + '，太慢（要 ≥ 2.0）');
  if (walk >= Voyage.SEA.max) issues.push('步行 ' + report.walkSpeed + ' 不能比開船快（' + Voyage.SEA.max + '）');

  // ── 3. 打完關卡回地圖的位置 ───────────────────────────
  const SAVE_KEY = 'eurohop.save.v2';
  const backup = localStorage.getItem(SAVE_KEY);
  try {
    Game.debug.unlockAll();
    // 挑幾個非終章的橫向關（終章會播結局，不回地圖）
    const picks = Levels.list
      .map(function (def, i) { return { def: def, i: i }; })
      .filter(function (o) { return !o.def.finale && o.def.layout !== 'shaft' && !o.def.bossArena; })
      .slice(0, 3);
    picks.forEach(function (o) {
      Game.debug.enter(o.i);
      Game.debug.getState().player.invuln = 1e9;
      Game.debug.warpToGoal();
      let k = 0;
      while (Game.debug.getScene() !== 'clear' && k++ < 300) Game.debug.step(1);
      if (Game.debug.getScene() !== 'clear') { issues.push(o.def.country + '：走到終點沒有過關'); return; }
      Game.debug.step(200);                                  // 等過關畫面的倒數
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
      Game.debug.step(1);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Enter' }));
      Game.debug.step(1);
      const port = Voyage.ports().filter(function (p) { return p.idx === o.i; })[0];
      const pos = Voyage.shipPos();
      const d = Math.hypot(pos.x - port.x, pos.y - port.y);
      if (Game.debug.getScene() !== 'map') issues.push(o.def.country + '：過關後按 Enter 沒回到地圖（' + Game.debug.getScene() + '）');
      else if (d > Voyage.DOCK_RANGE) issues.push(o.def.country + '：回地圖後人物不在這一國（離城市 ' + Math.round(d) + 'px）');
      else if (Game.debug.getCursor() !== o.i) issues.push(o.def.country + '：資訊卡顯示的不是這一國');
    });
    report.clearReturnChecked = picks.map(function (o) { return o.def.country; });
  } finally {
    if (backup === null) localStorage.removeItem(SAVE_KEY); else localStorage.setItem(SAVE_KEY, backup);
    Save.load();
    Game.debug.setScene('title');
  }

  return { issueCount: issues.length, issues: issues, report: report };
}
