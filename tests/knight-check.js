/**
 * v1.31.2 暗夜騎士檢查。在瀏覽器執行 runKnightCheck()（要先載入 traversal-bot.js，借用魔王對打機器人）。
 *
 *   A) 歐洲地圖上有暗夜騎士，一直待在法國的國土裡走來走去（不會走進海裡、不會走出法國）；要走路才碰得到（開船碰不到）
 *   B) 決鬥：巴黎鐵塔下、沒有平台、騎馬衝鋒＋劍氣（joust）；血 9 格、有狂暴；
 *      魔王對打機器人：沒裝備、22 件裝備打不贏，28 件全套打得贏
 *   C) 第一次打倒拿到稱號「神之手」（flag godHand）；冒險紀錄裡列得出來
 *   D) 紀念品送給人魚（人魚的家）→ 好感度滿 → 巴黎鐵塔的夜景看完 → 變成人類（flag merHuman）
 * 會暫時改存檔，結束前還原。
 */
function runKnightCheck() {
  const issues = [], report = {};
  const sv = Save.get();
  const backup = JSON.stringify(sv);
  const K = Encounter.KINDS.darkKnight;
  if (!K) return { issueCount: 1, issues: ['沒有暗夜騎士'] };

  // ── A) 地圖上的暗夜騎士 ──
  WorldMap.useWorld('eu'); Voyage.rebuild();
  Encounter.clear();
  Encounter.updateMap(Voyage.shipPos(), 0);
  const m = Encounter.monsters().filter(function (q) { return q.kind === 'darkKnight'; })[0];
  const fr = WorldMap.nations.filter(function (n) { return n.id === 'FR'; })[0];
  function inPoly(x, y, pts) {
    let ins = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi) ins = !ins;
    }
    return ins;
  }
  const inFr = function (x, y) { return fr.shapes.some(function (sh) { return inPoly(x, y, sh); }); };
  if (!m) issues.push('歐洲地圖上沒有暗夜騎士');
  else {
    if (!inFr(m.x, m.y)) issues.push('暗夜騎士不在法國');
    const x0 = m.x, y0 = m.y;
    let outside = 0, moved = 0;
    for (let k = 0; k < 3000; k++) {
      Encounter.updateMap({ x: -999, y: -999 }, 0);
      if (!inFr(m.x, m.y) || !Voyage.isLand(m.x, m.y)) outside++;
    }
    moved = Math.hypot(m.x - x0, m.y - y0);
    if (outside) issues.push('暗夜騎士走出法國或走進海裡（' + outside + ' 帧）');
    if (moved < 5) issues.push('暗夜騎士都沒在走動');
    if (Expedition.mapNear(m, { x: m.x, y: m.y }, 0) !== (Voyage.mode() === 'land')) issues.push('暗夜騎士要走路才碰得到');
  }
  Encounter.clear();

  // ── B) 決鬥 ──
  const mon = { kind: 'darkKnight', def: K, x: 0, y: 0 };
  const def = Encounter.makeDef(mon, Equipment.resolve([]));
  if (!def.boss || def.boss.hp < 9) issues.push('暗夜騎士血太少（' + (def.boss && def.boss.hp) + '）');
  if (!def.boss || !def.boss.rageAt) issues.push('暗夜騎士沒有狂暴');
  if (def.skirmish) issues.push('暗夜騎士的決鬥不該是海上小遊戲（def.skirmish）');
  if (!Sprites.bossKinds[def.boss.kind]) issues.push('暗夜騎士沒有畫法');
  const fight = function (owned) {
    const d = Object.assign({}, def, { isBoss: true });
    return runBossFightTest([{ def: d, li: -1, owned: owned }])[0];
  };
  // 天上掉的魔彈有亂數：打 3 場，最多只能贏 1 場
  const bares = [fight([]), fight([]), fight([])];
  report.bare = bares.map(function (q) { return q.won + ':' + q.hitsLanded; }).join(' ');
  if (bares.filter(function (q) { return q.won; }).length > 1) issues.push('沒有裝備的機器人也常常打贏暗夜騎士（太簡單）');
  const full = fight(Equipment.defs.map(function (d) { return d.id; }));
  report.full = full.won + ':' + full.hitsLanded + ' 受傷 ' + full.timesHurt;
  if (!full.won) issues.push('全套裝備的機器人也打不贏暗夜騎士（太難）');
  const most = fight(Equipment.defs.slice(0, 22).map(function (d) { return d.id; }));
  report.most = most.won + ':' + most.hitsLanded;
  if (most.won) issues.push('裝備沒收齊（22 件）的機器人就打贏暗夜騎士了（太簡單）');
  // v1.31.2 沒有平台給玩家站
  if ((def.platforms || []).length) issues.push('暗夜騎士的決鬥場不該有平台');
  if (def.boss.pattern !== 'joust') issues.push('暗夜騎士要用騎馬衝鋒＋劍氣（joust）');

  // ── C) 稱號 ──
  sv.flags.godHand = 0;
  const r = Expedition.onClear({ kind: 'darkKnight', def: K }, { def: def });
  if (!Save.flag('godHand') || !r.note || r.note.indexOf('神之手') < 0) issues.push('打倒暗夜騎士沒有拿到稱號「神之手」');

  // ── D) 人魚的好感度 → 巴黎鐵塔的夜景 → 變成人類 ──
  sv.flags.merHuman = 0; sv.flags.mermaid = 1; Save.markSeaBoss('darkKnight');
  Souvenirs.defs.forEach(function (d) { sv.flags['merGift_' + d.id] = 0; Save.addSouvenir(d.id); });
  if (!Abyss.SPOTS.some(function (q) { return q.npc === 'merHome'; })) issues.push('海底城沒有人魚的家');
  const home = Quests.talk('merHome');
  if (!home || home.panel !== 'merHome' || home.reveal.length !== Souvenirs.count) issues.push('人魚的家沒有把紀念品一樣一樣送出去');
  home.end(true);
  if (Quests.merLove() !== Quests.merLoveMax()) issues.push('紀念品全送完好感度沒有滿（' + Quests.merLove() + '）');
  if (!Quests.eiffelReady()) issues.push('好感度滿＋打倒騎士＋人魚同行，卻沒辦法看巴黎鐵塔的夜景');
  const ev = Quests.talk('eiffel');
  ev.end(false);
  if (Quests.merHuman()) issues.push('夜景沒看完就變成人類了');
  ev.end(true);
  if (!Quests.merHuman() || Quests.eiffelReady()) issues.push('看完巴黎鐵塔的夜景，人魚沒有變成人類');

  const keep = JSON.parse(backup);
  Object.keys(keep).forEach(function (k) { sv[k] = keep[k]; });
  Save.touch();
  return { issueCount: issues.length, issues: issues, report: report };
}
