/**
 * 音樂檢查。在瀏覽器執行 runMusicCheck()（node 測試腳本也能跑，不需要真的發聲）。
 *
 * 抓「曲子太短、一直重複同一句」：
 *   每首一輪至少要 45 秒才循環，
 *   而且一輪 32 小節裡至少要有 12 種不同的旋律小節（不能同一句一直跳針）。
 * 每一關、地圖、遭遇戰都要有曲子。
 */
function runMusicCheck() {
  const issues = [];
  const keys = Levels.list.map(function (lv) { return lv.id; }).concat(['MAP', 'BATTLE']);
  const report = {};
  keys.forEach(function (k) {
    if (!Music.tracks[k]) { issues.push(k + '：沒有曲子'); return; }
    const a = Music.analyze(k);
    report[k] = a;
    if (a.loopSeconds < 45) issues.push(k + '：一輪只有 ' + a.loopSeconds + ' 秒就重複');
    if (a.distinctBars < 12) {
      issues.push(k + '：一輪 ' + a.totalBars + ' 小節裡只有 ' + a.distinctBars + ' 種旋律，聽起來會一直重複');
    }
  });
  return { issueCount: issues.length, issues: issues, report: report };
}
