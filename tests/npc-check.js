/**
 * NPC 檢查（v1.10）。在瀏覽器執行 runNpcCheck()（node 也能跑）。
 *
 *   1. 橫向關每國 3 位、魔王關 1 位，豎井關不放（往下掉沒空看）
 *   2. 站位：踩在地面上、不在斷崖邊、不擋密道入口、不擋招牌機制、不在漆黑鹽礦裡、
 *      不靠近終點、彼此不擠在一起
 *   3. 台詞：每位 2~4 句，每句塞得進泡泡（最多 3 行）
 *   4. 執行期：走近會講（第一次發 'npc' 事件）、走遠不講、講完一句會換下一句
 */
function runNpcCheck() {
  const issues = [];
  const counts = {};

  Levels.list.forEach(function (def, li) {
    const tag = '關 ' + (li + 1) + ' ' + def.country;
    const npcs = def.npcs || [];
    counts[def.id] = npcs.length;
    // v1.30：送禮物的特別 NPC（芬蘭的聖誕老人）另外算
    const want = (def.layout === 'shaft' || def.layout === 'race' ? 0 : def.isBoss ? 0 : 3) + npcs.filter(function (n) { return n.gift; }).length;
    if (npcs.length !== want) issues.push(tag + '：NPC 有 ' + npcs.length + ' 位，應該 ' + want + ' 位');

    npcs.forEach(function (n) {
      const who = tag + ' ' + n.name;
      // 2. 站位
      const gy = def.groundSegs ? LevelGen.groundAt(def.groundSegs, n.x) : Levels.GROUND_Y;
      if (gy == null || Math.abs(gy - n.y) > 1) issues.push(who + '：沒有站在地面上（x=' + n.x + '）');
      const gaps = [];
      (def.groundSegs || []).forEach(function (s, i, a) {
        if (i < a.length - 1 && a[i + 1].x > s.x + s.w) gaps.push({ x: s.x + s.w, w: a[i + 1].x - s.x - s.w });
      });
      gaps.forEach(function (g) {
        if (n.x > g.x - 40 && n.x < g.x + g.w + 40) issues.push(who + '：站在斷崖邊');
      });
      (def.secrets || []).forEach(function (s) {
        if (n.x > s.room.x - 40 && n.x < s.room.x + s.room.w + 40) issues.push(who + '：擋在密道入口');
      });
      (def.features || []).forEach(function (f) {
        if (f.type === 'dark' && n.x > f.x0 && n.x < f.x1) issues.push(who + '：站在漆黑鹽礦裡，看不到');
        if (f.x != null && f.w != null && n.x > f.x - 50 && n.x < f.x + f.w + 50) issues.push(who + '：擋在' + f.type + '上');
      });
      if (!def.isBoss && Math.abs(n.x - def.goal) < 150) issues.push(who + '：離終點旗太近');
      // v1.30：過了終點就直接過關，站在後面的人永遠講不到話
      if (!def.isBoss && n.x > def.goal) issues.push(who + '：站在終點後面（x=' + n.x + '，終點 ' + def.goal + '）');
      npcs.forEach(function (o) {
        if (o !== n && Math.abs(o.x - n.x) < 200) issues.push(who + '：跟 ' + o.name + ' 擠在一起');
      });

      // 3. 台詞
      if (!n.lines || n.lines.length < 2 || n.lines.length > 4) issues.push(who + '：台詞要 2~4 句');
      (n.lines || []).forEach(function (s) {
        // 泡泡寬 250、13px 字：一行約 17 個中文字，3 行以內 ≈ 48 字
        let rows;
        try {
          const cv = document.createElement('canvas').getContext('2d');
          rows = Npcs.bubbleRows(cv, s).length;
        } catch (e) { rows = Math.ceil(s.length / 17); }
        if (rows > 3) issues.push(who + '：「' + s.slice(0, 10) + '⋯」太長，泡泡要 ' + rows + ' 行');
      });
    });
  });

  // 4. 執行期
  const li = Levels.list.findIndex(function (d) { return (d.npcs || []).length === 3; });
  if (li >= 0) {
    const def = Levels.list[li];
    const st = buildLevelState(def, li, [], Equipment.resolve([]));
    const n = st.npcs[0], p = st.player;
    p.x = n.x + 400; p.y = n.y - p.h;
    let ev = Npcs.update(st);
    if (ev.length || n.talking) issues.push('離 NPC 400px 就開始講話了');
    p.x = n.x + 20;
    ev = Npcs.update(st);
    if (ev.indexOf('npc') < 0 || !n.talking) issues.push('走到 NPC 旁邊沒有開始講話');
    let changed = false;
    for (let f = 0; f < 800 && !changed; f++) changed = Npcs.update(st).indexOf('npcline') >= 0;
    if (!changed || n.line !== 1) issues.push('NPC 講完一句沒有換下一句');
    ev = Npcs.update(st);
    if (ev.indexOf('npc') >= 0) issues.push('同一位 NPC 重複發「第一次搭話」事件');
    p.x = n.x + 400;
    for (let f = 0; f < 5; f++) Npcs.update(st);
    if (n.talking) issues.push('走遠了 NPC 還在講');
  }

  return { issueCount: issues.length, issues: issues, counts: counts };
}
