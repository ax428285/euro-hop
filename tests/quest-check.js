/**
 * v1.30 劇情與新冒險檢查。在瀏覽器執行 runQuestCheck()。
 *
 *   A) 北歐篇：結界沒解開前鎖住、北歐國土走不進去；旗標 north 之後才開
 *   B) 卡律布狄斯：還沒找到洛基時「漩渦逃生」沒命 → 要接冥界；冥界、金字塔的豎井有終點
 *   C) 戰艦海戰：七艘都打得贏（升滿級的船、機器人會躲紅圈、踩水兵），沒升級也至少打得贏最弱的
 *   D) 動物大遷徙：機器人抓得到 3 隻以上
 *   E) 瑞士銀行：每分鐘 1 枚、離線最多一天份；動物園的門票照天數算
 * 會暫時改存檔，結束前還原。
 */
function runQuestCheck() {
  const issues = [];
  const sv = Save.get();
  const backup = JSON.stringify(sv);

  // A) 北歐結界
  sv.flags = {};
  if (Encounter.regionUnlocked('north', 99999)) issues.push('北歐篇不該靠 EXP 解鎖');
  const no = WorldMap.nations.filter(function (n) { return n.id === 'NO'; })[0];
  if (!no) issues.push('地圖上沒有挪威');
  else {
    if (!Quests.blocked(no.pin[0], no.pin[1])) issues.push('結界沒解開，挪威的國土卻沒被擋住');
    sv.flags.north = 1;
    if (Quests.blocked(no.pin[0], no.pin[1])) issues.push('結界解開了，挪威還是走不進去');
    if (!Encounter.regionUnlocked('north', 0)) issues.push('旗標 north 之後北歐篇還是鎖著');
    sv.flags = {};
  }
  if (!Quests.helReady()) issues.push('還沒找到洛基，漩渦裡沒命卻不會掉進冥界');
  ['thor', 'columbus', 'bank', 'zoo'].forEach(function (k) {
    const tk = Quests.talk(k);
    if (!tk || !tk.lines.length) issues.push(k + '：沒有對話');
  });
  // 索爾 → 洛基 → 索爾，旗標要依序推進
  let tk = Quests.talk('thor'); if (tk.end) tk.end();
  if (!Save.flag('thorAsked')) issues.push('跟索爾講完話沒有記下線索');
  tk = Quests.talk('loki'); if (tk.end) tk.end();
  if (!Save.flag('loki')) issues.push('跟洛基講完話沒有記下');
  if (Quests.helReady()) issues.push('找到洛基之後，漩渦裡沒命還是會掉進冥界');
  tk = Quests.talk('thor'); if (tk.end) tk.end();
  if (!Quests.northOpen()) issues.push('帶著洛基的話回去找索爾，北歐沒有解開');

  // B) 冥界、金字塔
  ['hel', 'pyramid'].forEach(function (k) {
    const def = Encounter.makeDef(Expedition.questMonster(k, { x: 0, y: 0 }), Equipment.resolve([]));
    if (def.layout !== 'shaft' || !def.shaft) { issues.push(k + '：不是豎井關'); return; }
    if (!def.shaft.platforms.some(function (f) { return f.goal; })) issues.push(k + '：豎井沒有終點層');
    if (!Sprites.shaftThemes[def.theme]) issues.push(k + '：沒有美術主題 ' + def.theme);
  });

  // C) 戰艦海戰
  function simWar(kind, lv) {
    const keep = sv.ship;
    sv.ship = Object.assign(Shipyard.blank(), { sail: lv, cannon: lv, hull: lv, powder: lv });
    const m = { kind: kind, def: Encounter.KINDS[kind], x: 0, y: 0 };
    const st = buildLevelState(Encounter.makeDef(m, Equipment.resolve([])), -1, [], Equipment.resolve([]));
    const p = st.player, held = {};
    let res = null, fireNow = false, jumpNow = false;
    const input = { isDown: function (a) { return !!held[a]; }, once: function (a) { return (a === 'throw' && fireNow) || (a === 'jump' && jumpNow); }, endFrame: function () {}, takeClick: function () { return null; } };
    Encounter.updateSkirmish(st, input);
    for (let f = 0; f < 121 * 60 && !res; f++) {
      const mini = st.mini;
      fireNow = jumpNow = false; held.left = held.right = held.jump = false;
      const pcx = p.x + p.w / 2;
      const danger = mini.shells.filter(function (s) { return s.fuse > 0 && s.fuse < 45 && Math.abs(s.x - pcx) < 55; })[0];
      const marine = st.enemies.filter(function (e) { return e.alive; })[0];
      let tx = pcx;
      if (danger) tx = U.clamp(danger.x > pcx ? danger.x - 110 : danger.x + 110, 20, 540);
      else if (marine && Math.abs(marine.x - pcx) < 200) { tx = marine.x + marine.w / 2; if (Math.abs(tx - pcx) < 60 && p.onGround) jumpNow = held.jump = true; }
      else {
        const g = mini.guns.filter(function (q) { return !q.jam && !q.blocked; }).sort(function (a, b) { return a.cd - b.cd; })[0];
        if (g) { tx = g.x; if (g.cd === 0 && Math.abs(g.x - pcx) < 30) fireNow = true; }
      }
      if (!p.onGround) held.jump = true;
      if (tx > pcx + 6) held.right = true; else if (tx < pcx - 6) held.left = true;
      updateEnemies(st, f);
      updatePlayer(st, input, f).concat(Encounter.updateSkirmish(st, input)).forEach(function (e) {
        if (e === 'clear') res = 'win'; if (e === 'minifail') res = 'fail';
      });
    }
    sv.ship = keep;
    return res;
  }
  Expedition.WARSHIPS.forEach(function (w) {
    if (simWar(w.kind, 2) !== 'win') issues.push(w.country + '戰艦：升滿級的船也打不贏');
  });
  if (simWar('warGR', 0) !== 'win') issues.push('希臘戰艦（最弱）：沒升級的船打不贏');

  // D) 動物大遷徙
  (function () {
    const m = { kind: 'herd', def: Encounter.KINDS.herd, x: 0, y: 0 };
    const st = buildLevelState(Encounter.makeDef(m, Equipment.resolve([])), -1, [], Equipment.resolve([]));
    const p = st.player, held = {};
    let res = null, jumpNow = false;
    const input = { isDown: function (a) { return !!held[a]; }, once: function (a) { return a === 'jump' && jumpNow; }, endFrame: function () {}, takeClick: function () { return null; } };
    Encounter.updateSkirmish(st, input);
    for (let f = 0; f < 41 * 60 && !res; f++) {
      jumpNow = false; held.left = held.right = held.jump = false;
      const a = st.mini.animals.filter(function (q) { return q.x + q.w > p.x; }).sort(function (q, r) { return q.x - r.x; })[0];
      if (p.onGround && a && a.x - (p.x + p.w) < 70 && a.x - (p.x + p.w) > 0) jumpNow = held.jump = true;
      if (!p.onGround) held.jump = true;
      if (p.x < 300) held.right = true;
      updatePlayer(st, input, f).concat(Encounter.updateSkirmish(st, input)).forEach(function (e) {
        if (e === 'clear') res = 'win'; if (e === 'minifail') res = 'fail';
      });
    }
    if (res !== 'win') issues.push('動物大遷徙：機器人抓不到 3 隻（' + res + '，抓到 ' + st.mini.caught.length + '）');
  })();

  // E) 銀行、動物園
  sv.bank = { open: true, bal: 0, last: Date.now() - 3 * 60000 - 500 };
  for (let k = 0; k < 61; k++) Quests.tick();
  if (sv.bank.bal !== 3) issues.push('銀行：過了 3 分鐘應該存入 3 枚，結果 ' + sv.bank.bal);
  sv.bank = { open: true, bal: 0, last: Date.now() - 3 * 24 * 3600 * 1000 };
  for (let k = 0; k < 61; k++) Quests.tick();
  if (sv.bank.bal !== 24 * 60) issues.push('銀行：離開三天應該只算一天份（1440），結果 ' + sv.bank.bal);
  sv.zoo = { zebra: 2, lion: 1 }; sv.zooDay = sv.day - 2;
  const fee = Quests.zooFee();
  const w0 = sv.wallet;
  tk = Quests.talk('zoo'); if (tk.end) tk.end();
  if (sv.wallet - w0 !== fee * 2) issues.push('動物園：兩天的門票應該是 ' + fee * 2 + '，結果 ' + (sv.wallet - w0));

  // 還原存檔
  const restored = JSON.parse(backup);
  Object.keys(sv).forEach(function (k) { delete sv[k]; });
  Object.assign(sv, restored);
  Save.save();
  return { issueCount: issues.length, issues: issues };
}
