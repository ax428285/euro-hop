/**
 * v1.30 劇情與新冒險檢查。在瀏覽器執行 runQuestCheck()。
 *
 *   A) 北歐篇：結界沒解開前鎖住、北歐國土走不進去；旗標 north 之後才開
 *   B) 卡律布狄斯：還沒找到洛基時「漩渦逃生」沒命 → 要接冥界；冥界、金字塔的豎井有終點
 *   C) 戰艦海戰：五艘都打得贏（升滿級的船、機器人會躲紅圈、踩水兵），沒升級也至少打得贏最弱的
 *   D) 動物大遷徙：機器人抓得到 3 隻以上
 *   E) 瑞士銀行：每分鐘 1 枚、離線最多一天份；動物園的門票照天數算
 *   H) 比利時的扒手：開到海灣底、走進比利時都會被偷 100 枚（不夠就全拿）、停著不會一直扣、離開再回來才會再偷；
 *      船開得到那裡，荷蘭港口的圖釘和海上靠港的位置碰不到
 *   I) 埃及豔后：看完對話才付錢買聖蛇護身符（Esc 不買、錢不夠不買），買過之後扒手每次都被嚇跑（永久）
 *   J) 芬蘭的聖誕老人：走近就拿到聖誕禮物（記在 Save.flag('gift')），只給一次
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
  if (!Quests.helReady()) issues.push('掉進漩渦眼不會進冥界');
  ['thor', 'columbus', 'bank', 'zoo'].forEach(function (k) {
    const tk = Quests.talk(k);
    if (!tk || !tk.lines.length) issues.push(k + '：沒有對話');
  });
  // 索爾 → 洛基 → 索爾，旗標要依序推進
  let tk = Quests.talk('thor'); if (tk.end) tk.end();
  if (!Save.flag('thorAsked')) issues.push('跟索爾講完話沒有記下線索');
  // 洛基被鎖在籠子裡：沒有鑰匙，冥界走到底只能隔著欄杆聊（傳回大地圖、不算救出）
  const helSk = { kind: 'hel', def: Encounter.KINDS.hel };
  let ex = Expedition.onClear(helSk, { def: {}, mini: {} });
  if (ex.talk !== 'lokiLocked') issues.push('沒有鑰匙，冥界走到底卻救得出洛基（' + ex.talk + '）');
  tk = Quests.talk('lokiLocked'); if (tk.end) tk.end();
  if (Save.flag('loki')) issues.push('隔著籠子講完話，洛基就被算成救出來了');
  // 失落的金字塔 → 神祕的鑰匙
  Expedition.onClear({ kind: 'pyramid', def: Encounter.KINDS.pyramid }, { def: { firstBoss: false }, mini: {} });
  if (!Save.flag('key')) issues.push('走完失落的金字塔沒有拿到神祕的鑰匙');
  if (Encounter.KINDS.pyramid.bossCoins) issues.push('金字塔的獎勵應該是鑰匙，不是金幣');
  ex = Expedition.onClear(helSk, { def: {}, mini: {} });
  if (ex.talk !== 'loki') issues.push('帶著鑰匙走到冥界底，沒有救出洛基');
  tk = Quests.talk('loki'); if (tk.end) tk.end();
  if (!Save.flag('loki')) issues.push('跟洛基講完話沒有記下');
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
  if (simWar('warES', 0) !== 'win') issues.push('西班牙戰艦（最弱）：沒升級的船打不贏');

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
      // 只對準發光的落單小動物跳（踩別隻沒用）
      const a = st.mini.animals.filter(function (q) { return q.target && q.x + q.w > p.x; }).sort(function (q, r) { return q.x - r.x; })[0];
      if (p.onGround && a && a.x - (p.x + p.w) < 70 && a.x - (p.x + p.w) > 0) jumpNow = held.jump = true;
      if (!p.onGround) held.jump = true;
      if (p.x < 300) held.right = true;
      updatePlayer(st, input, f).concat(Encounter.updateSkirmish(st, input)).forEach(function (e) {
        if (e === 'clear') res = 'win'; if (e === 'minifail') res = 'fail';
      });
    }
    if (res !== 'win') issues.push('動物大遷徙：機器人抓不到發光的那一隻（' + res + '）');
    if (st.mini.animals.concat([]).some(function (q) { return q.id !== st.mini.species; })) issues.push('動物大遷徙：一群裡混了別種動物');
  })();

  // E) 銀行、動物園
  sv.bank = { open: true, bal: 0, last: Date.now() - 3 * 60000 - 500 };
  for (let k = 0; k < 61; k++) Quests.tick();
  if (sv.bank.bal !== 3) issues.push('銀行：過了 3 分鐘應該存入 3 枚，結果 ' + sv.bank.bal);
  sv.bank = { open: true, bal: 0, last: Date.now() - 3 * 24 * 3600 * 1000 };
  for (let k = 0; k < 61; k++) Quests.tick();
  if (sv.bank.bal !== 24 * 60) issues.push('銀行：離開三天應該只算一天份（1440），結果 ' + sv.bank.bal);
  sv.zoo = { zebra: 1, lion: 1 }; sv.zooDay = sv.day - 2;
  if (Save.addAnimal('zebra')) issues.push('動物園已經有斑馬了，再抓一隻還算新的');
  if (Save.zoo().zebra !== 1) issues.push('動物園每種動物應該只有一隻（斑馬 ' + Save.zoo().zebra + '）');
  const fee = Quests.zooFee();
  const w0 = sv.wallet;
  tk = Quests.talk('zoo'); if (tk.end) tk.end();
  if (sv.wallet - w0 !== fee * 2) issues.push('動物園：兩天的門票應該是 ' + fee * 2 + '，結果 ' + (sv.wallet - w0));

  // F) 愛心最多 5 顆；所有橫向關終點之後沒有金幣、怪物
  const all = Equipment.defs.map(function (d) { return d.id; });
  if (Equipment.resolve(all).maxLives > 5) issues.push('全部裝備穿上，愛心上限超過 5（' + Equipment.resolve(all).maxLives + '）');
  Levels.list.forEach(function (def) {
    if (def.layout === 'shaft' || def.layout === 'race' || def.isBoss) return;
    const c = def.coins.filter(function (q) { return q.x + 24 > def.goal; }).length;
    const e = def.enemies.filter(function (q) { return q.x > def.goal - 30 || (q.right != null && q.right > def.goal); }).length;
    if (c || e) issues.push(def.country + '：終點後面還有 ' + c + ' 枚金幣、' + e + ' 隻怪物');
  });

  // G) 卡律布狄斯：掉進漩渦眼一次就接冥界（不用把命用完）
  (function () {
    sv.flags = {};
    const m = { kind: 'charybdis', def: Encounter.KINDS.charybdis, x: 0, y: 0 };
    const st = buildLevelState(Encounter.makeDef(m, Equipment.resolve([])), -1, [], Equipment.resolve([]));
    const idle = { isDown: function () { return false; }, once: function () { return false; }, endFrame: function () {} };
    Encounter.updateSkirmish(st, idle);
    st.player.x = 470; st.player.y = Levels.GROUND_Y + 40;
    const ev = Encounter.updateSkirmish(st, idle);
    if (ev.indexOf('helfall') < 0) issues.push('掉進卡律布狄斯的漩渦眼沒有接冥界');
  })();

  // H) 比利時的扒手
  (function () {
    const far = { x: 100, y: 100 };
    Quests.pickpocket(far);
    const p = EuropeWorld.project(2.6, 51.35), at = { x: p[0] - 3, y: p[1] - 8 };
    if (!Voyage.isNavigable(at.x, at.y)) issues.push('比利時扒手的位置船開不到');
    sv.wallet = 150;
    if (Quests.pickpocket(at) !== 100 || sv.wallet !== 50) issues.push('開到比利時沒有被偷 100 枚（錢包剩 ' + sv.wallet + '）');
    if (Quests.pickpocket(at) !== 0 || sv.wallet !== 50) issues.push('停在比利時會一直被偷');
    Quests.pickpocket(far);
    if (Quests.pickpocket(at) !== 50 || sv.wallet !== 0) issues.push('錢包不到 100 枚時沒有全拿');
    Quests.pickpocket(far);
    if (Quests.pickpocket(at) !== -1) issues.push('錢包空空時扒手應該摸個空');
    // 走進比利時（布魯塞爾）也會被偷
    Quests.pickpocket(far); sv.wallet = 300;
    const bxl = EuropeWorld.project(4.35, 50.85);
    if (Quests.pickpocket({ x: bxl[0], y: bxl[1] }) !== 100) issues.push('走進比利時沒有被偷');
    // 去荷蘭靠港：圖釘本身、港口 DOCK_RANGE 內海上的點都不該被偷
    const nl0 = Voyage.ports().filter(function (q) { return q.id === 'NL'; })[0];
    Quests.pickpocket(far);
    if (nl0 && Quests.pickpocket({ x: nl0.x, y: nl0.y }) !== 0) issues.push('站在荷蘭的港口圖釘上也會被比利時扒手偷');
    const nl = Voyage.ports().filter(function (q) { return q.id === 'NL' || q.name === 'NL'; })[0];
    if (nl) {
      for (let dx = -Voyage.DOCK_RANGE; dx <= Voyage.DOCK_RANGE; dx += 2) {
        for (let dy = -Voyage.DOCK_RANGE; dy <= Voyage.DOCK_RANGE; dy += 2) {
          const x = nl.x + dx, y = nl.y + dy;
          if (Math.hypot(dx, dy) > Voyage.DOCK_RANGE || !Voyage.isNavigable(x, y)) continue;
          Quests.pickpocket(far);
          if (Quests.pickpocket({ x: x, y: y }) !== 0) { issues.push('在荷蘭港口靠港也會被比利時扒手偷'); return; }
        }
      }
    }
  })();

  // I) 埃及豔后的聖蛇護身符
  (function () {
    const far = { x: 100, y: 100 };
    const p = EuropeWorld.project(2.6, 51.35), at = { x: p[0] - 3, y: p[1] - 8 };
    sv.flags.asp = 0; sv.wallet = 150;
    let tk = Quests.talk('cleopatra');
    if (tk.end && tk.end(true)) issues.push('錢不夠也買得到聖蛇護身符');
    sv.wallet = 500;
    tk = Quests.talk('cleopatra');
    if (!tk.end) issues.push('錢夠了，埃及豔后卻沒有要賣護身符');
    else {
      tk.end(false);
      if (Save.flag('asp') || sv.wallet !== 500) issues.push('中途按 Esc 離開也買了護身符');
      tk = Quests.talk('cleopatra'); tk.end(true);
      if (!Save.flag('asp') || sv.wallet !== 500 - Quests.ASP_COST) issues.push('看完對話沒有買到護身符（錢包 ' + sv.wallet + '）');
    }
    Quests.pickpocket(far);
    const w0 = sv.wallet;
    if (Quests.pickpocket(at) !== -2 || sv.wallet !== w0) issues.push('有聖蛇護身符還是被扒手偷了');
    Quests.pickpocket(far);
    if (Quests.pickpocket(at) !== -2 || !Save.flag('asp') || sv.wallet !== w0) issues.push('聖蛇護身符應該永久有效，第二次還是被偷了');
    if (Quests.talk('cleopatra').end) issues.push('已經有護身符了，埃及豔后還要再賣');
  })();

  // J) 芬蘭的聖誕老人
  (function () {
    const fi = Levels.list.findIndex(function (d) { return d.id === 'FI'; });
    const def = Levels.list[fi];
    const santa = (def.npcs || []).filter(function (n) { return n.gift; })[0];
    if (!santa) { issues.push('芬蘭關卡裡沒有聖誕老人'); return; }
    if (Math.abs(santa.x - def.goal) > 1200) issues.push('聖誕老人離終點太遠（應該在聖誕老人村）');
    // 太近的話一拿到禮物就過關，提示被過關畫面蓋掉（玩家回報：沒看到「拿到聖誕老人的禮物」）
    if (def.goal - santa.x < 400) issues.push('聖誕老人離終點太近（' + Math.round(def.goal - santa.x) + 'px），禮物提示會被過關畫面蓋掉');
    sv.flags.gift = 0;
    const st = { npcs: Npcs.makeState(def), players: [{ x: santa.x - 10, y: santa.y - 40, w: 22, h: 40 }] };
    const ev = Npcs.update(st);
    if (ev.indexOf('gift') < 0 || !Save.flag('gift')) issues.push('走近聖誕老人沒有拿到聖誕禮物');
    const st2 = { npcs: Npcs.makeState(def), players: st.players };
    if (Npcs.update(st2).indexOf('gift') >= 0) issues.push('聖誕禮物可以重複拿');
  })();

  // 還原存檔
  const restored = JSON.parse(backup);
  Object.keys(sv).forEach(function (k) { delete sv[k]; });
  Object.assign(sv, restored);
  Save.save();
  return { issueCount: issues.length, issues: issues };
}
