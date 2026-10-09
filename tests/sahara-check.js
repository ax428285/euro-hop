/**
 * v1.31.2 撒哈拉沙漠檢查。在瀏覽器執行 runSaharaCheck()。
 *
 *   A) 歐洲地圖上有「撒哈拉沙漠」地點，在陸地上（非洲）
 *   B) 沙漠關：沒有終點、沒有敵人；一直往右走 5 分鐘之前都不會過關，滿 5 分鐘綠洲出現在前面，走進去就過關
 *   C) 遠征圖鑑列得出撒哈拉沙漠；時裝：雅典娜取代波賽頓
 */
function runSaharaCheck() {
  const issues = [];
  // ── A) 地圖上的地點 ──
  WorldMap.useWorld('eu'); Voyage.rebuild();
  const sp = WorldMap.specials.filter(function (s) { return s.def.npc === 'sahara'; })[0];
  if (!sp) issues.push('歐洲地圖上沒有撒哈拉沙漠');
  else if (!Voyage.isLand(sp.pin[0], sp.pin[1])) issues.push('撒哈拉沙漠的地點不在陸地上');

  // ── B) 沙漠關 ──
  const K = Encounter.KINDS.sahara;
  const m = Expedition.questMonster('sahara', { x: 0, y: 0 });
  const def = Encounter.makeDef(m, Equipment.resolve([]));
  if (def.minigame !== 'desert') issues.push('撒哈拉不是沙漠小遊戲');
  if (isFinite(def.goal)) issues.push('撒哈拉不該有終點旗');
  if ((def.enemies || []).length) issues.push('撒哈拉不該有敵人');
  const st = buildLevelState(def, -1, [], Equipment.resolve([]));
  const p = st.player;
  let clearedAt = -1, oasisAt = -1;
  for (let f = 0; f < 5 * 3600 + 900 && clearedAt < 0; f++) {
    p.x += 4.6;                 // 一直往右走（跟真人按住右鍵差不多快）
    const ev = Encounter.updateSkirmish(st, null);
    if (oasisAt < 0 && st.mini && st.mini.oasis) oasisAt = f;
    if (ev.indexOf('clear') >= 0) clearedAt = f;
  }
  if (oasisAt < 0) issues.push('走了 5 分鐘以上都沒看到綠洲');
  else if (oasisAt < 5 * 3600 - 2) issues.push('綠洲太早出現了（第 ' + oasisAt + ' 帧）');
  if (clearedAt < 0) issues.push('看到綠洲走過去也沒有過關');
  else if (clearedAt < 5 * 3600) issues.push('不到 5 分鐘就過關了');
  const r = Expedition.onClear({ kind: 'sahara', def: K }, st);
  if (!r.note || r.note.indexOf('綠洲') < 0) issues.push('過關畫面沒講找到綠洲');

  // ── C) 圖鑑、時裝 ──
  if (!(K.fixed || K.desert)) issues.push('撒哈拉沒有列進遠征圖鑑');
  if (!Costumes.get('athena')) issues.push('沒有雅典娜時裝');
  if (Costumes.get('poseidon')) issues.push('波賽頓時裝還在');
  return { issueCount: issues.length, issues: issues, oasisAt: oasisAt, clearedAt: clearedAt };
}
