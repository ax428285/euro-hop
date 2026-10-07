/**
 * 世界之謎檢查（v1.16）。在瀏覽器執行 runMysteryCheck()。
 *
 *   資料：每一關都有線索、每條線索都對得到關卡、文字放得進畫面（不會被切掉）
 *   流程：第一次通關才拿線索；最後一條到齊 → 回地圖直接揭曉謎底；重打不會再給
 *   畫面：N 開關、方向鍵選格、沒到齊按 Enter 不會揭曉、各畫面畫得出來
 *
 * ⚠️ 會動到存檔，先備份、測完還原。
 */
function runMysteryCheck() {
  const issues = [];
  const report = {};

  // ── 資料 ───────────────────────────────────────
  const cont = Mystery.get('europe');
  Levels.list.forEach(function (def, i) {
    if (!Mystery.clueFor(i)) issues.push(def.country + ' 沒有線索');
    if (!Mystery.continentOf(i)) issues.push(def.country + ' 不屬於任何一洲');
  });
  Object.keys(Mystery.CLUES).forEach(function (id) {
    if (!Levels.list.some(function (d) { return d.id === id; })) issues.push('線索 ' + id + ' 對不到關卡');
  });

  // 文字寬度：跟畫面用同一套字型量
  const c = document.createElement('canvas').getContext('2d');
  function linesOf(str, maxW, size) {
    c.font = '600 ' + size + 'px "Segoe UI", "Microsoft JhengHei", sans-serif';
    let n = 1, line = '';
    for (const ch of str) {
      if (line && c.measureText(line + ch).width > maxW) { n++; line = ''; }
      line += ch;
    }
    return n;
  }
  function width(str, size) {
    c.font = '600 ' + size + 'px "Segoe UI", "Microsoft JhengHei", sans-serif';
    return c.measureText(str).width;
  }
  const W = 960;
  Levels.list.forEach(function (def, i) {
    const cl = Mystery.clueFor(i);
    if (!cl) return;
    if (linesOf(cl.text, 660, 16) > 3) issues.push(def.country + ' 的線索超過 3 行，會被切掉');
    if (width('線索 18・' + def.country + '：' + cl.item, 15) > W - 120) issues.push(def.country + ' 的道具名稱太長');
    // 過關畫面那一行（面板寬 540）
    if (width('🔍 歐洲之謎・新線索：' + cl.item + '（18/18）', 15) > 530) issues.push(def.country + ' 過關畫面的線索行太長');
  });
  let answerH = 0;
  cont.answer.forEach(function (p, i) {
    const last = i === cont.answer.length - 1;
    answerH += linesOf(p, W - 260, 16) * (last ? 30 : 26) + 4;
  });
  report.answerHeight = answerH;
  if (138 + answerH > 480 - 90) issues.push('謎底文字太長，會壓到下方的提示（高 ' + answerH + '）');
  if (width(cont.name + '：' + cont.question, 16) + width('線索 18 / 18', 16) > W - 100) issues.push('謎題標題太長');

  // ── 流程 ───────────────────────────────────────
  const SAVE_KEY = 'eurohop.save.v2';
  const backup = localStorage.getItem(SAVE_KEY);
  const key = function (code) {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: code }));
    Game.debug.step(1);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: code }));
    Game.debug.step(1);
  };
  /** 真的把某一關打到過關畫面，再按 Enter 離開 */
  function playThrough(i) {
    Game.debug.enter(i);
    Game.debug.getState().player.invuln = 1e9;
    Game.debug.warpToGoal();
    let k = 0;
    while (Game.debug.getScene() !== 'clear' && k++ < 300) Game.debug.step(1);
    if (Game.debug.getScene() !== 'clear') return false;
    const atClear = Game.debug.getMystery().newClue;
    let drew = true;
    try { Game.debug.render(); } catch (e) { drew = e.message; }
    Game.debug.step(200);
    key('Enter');
    return { clue: atClear, drew: drew };
  }
  function tryRender(label) {
    try { Game.debug.render(); } catch (e) { issues.push(label + ' 畫不出來：' + e.message); }
  }

  try {
    Game.debug.resetSave();
    Game.debug.unlockAll();
    const first = 0;                                            // 西班牙：最簡單的橫向關
    const p0 = Mystery.progress('europe');
    report.total = p0.total;
    if (p0.got !== 0) issues.push('新存檔不該有線索（' + p0.got + '）');

    // 第一次通關：拿到線索，但還沒到齊 → 回地圖（不揭曉）
    const r1 = playThrough(first);
    if (!r1) issues.push('西班牙走到終點沒過關');
    else {
      if (!r1.clue || r1.clue.clue !== Mystery.clueFor(first)) issues.push('第一次通關沒有拿到線索');
      if (r1.drew !== true) issues.push('過關畫面（含線索）畫不出來：' + r1.drew);
      if (Game.debug.getScene() !== 'map') issues.push('線索還沒到齊，過關後應回地圖（' + Game.debug.getScene() + '）');
    }
    if (Mystery.progress('europe').got !== 1) issues.push('通關後線索數應為 1');

    // 重打同一關：不會再給
    const r2 = playThrough(first);
    if (r2 && r2.clue) issues.push('重打已通關的關卡又給了一次線索');

    // 地圖按 N 開謎畫面；沒到齊按 Enter 不揭曉；方向鍵會動；N 返回
    key('KeyN');
    if (Game.debug.getScene() !== 'mystery') issues.push('地圖按 N 沒有打開世界之謎');
    tryRender('謎畫面（1 條線索）');
    key('Enter');
    if (Game.debug.getMystery().reveal) issues.push('線索沒到齊，按 Enter 卻揭曉了謎底');
    key('ArrowRight'); key('ArrowRight'); key('ArrowDown');
    if (Game.debug.getMystery().cursor !== 7) issues.push('方向鍵選格不對（→→↓ 應到第 8 格，實際 ' + (Game.debug.getMystery().cursor + 1) + '）');
    for (let k = 0; k < 20; k++) key('ArrowRight');
    if (Game.debug.getMystery().cursor !== p0.total - 1) issues.push('一直按 → 應停在最後一格');
    key('KeyN');
    if (Game.debug.getScene() !== 'map') issues.push('謎畫面按 N 沒回地圖');
    key('KeyN'); key('KeyQ');
    if (Game.debug.getScene() !== 'map') issues.push('謎畫面按 Q 沒回地圖');

    // 其餘只剩最後一條：其他關直接記成已通關，留一個橫向關實際打
    const last = Levels.list.findIndex(function (d, i) {
      return i !== first && !d.finale && d.layout !== 'shaft' && !d.bossArena;
    });
    Levels.list.forEach(function (d, i) { if (i !== first && i !== last) Save.markCleared(i, 0, 0, 0); });
    if (Mystery.progress('europe').got !== p0.total - 1) issues.push('準備階段：應該只差 1 條');
    const r3 = playThrough(last);
    if (!r3) issues.push(Levels.list[last].country + ' 走到終點沒過關');
    else {
      if (!r3.clue || !r3.clue.completed) issues.push('最後一條線索沒有標記「到齊」');
      if (Game.debug.getScene() !== 'mystery' || !Game.debug.getMystery().reveal) {
        issues.push('最後一條到齊後，回地圖應直接揭曉謎底（' + Game.debug.getScene() + '）');
      }
    }
    tryRender('謎底畫面');
    key('Enter');
    if (Game.debug.getMystery().reveal) issues.push('謎底畫面按 Enter 沒有關掉');
    tryRender('謎畫面（全部到齊）');
    key('Enter');
    if (!Game.debug.getMystery().reveal) issues.push('到齊後在謎畫面按 Enter 應可再看一次謎底');
    key('Escape');
    key('Escape');
    if (Game.debug.getScene() !== 'map') issues.push('Esc 兩次應回地圖');
    report.after = Mystery.progress('europe');
  } finally {
    if (backup === null) localStorage.removeItem(SAVE_KEY); else localStorage.setItem(SAVE_KEY, backup);
    Save.load();
    Game.debug.setScene('title');
  }

  return { issueCount: issues.length, issues: issues, report: report };
}
