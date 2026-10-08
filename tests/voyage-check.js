/**
 * 大地圖移動檢查（v1.7：海上開船、陸上步行）。在瀏覽器執行 runVoyageCheck()。
 *
 * 舊版是「只能開船」，內陸國要靠挖運河才到得了，這支測試以前大半在驗運河與港口。
 * 現在規則改成陸地可以走路，所以驗的是：
 *   1. 每國入口就在自己的城市圖釘上（不再被擠到遠處的海岸）
 *   2. reset() 會把角色放在該國入口，而且判定為「陸上」
 *   3. 【核心】從第一關實際「駕駛」到每一國都到得了（真的呼叫 Voyage.update）
 *   4. 跨海時會自動上船、到岸自動下船（例如西班牙 → 英國）
 *   5. 船比走路快（不然開船沒意義）
 *   6. 按「上」不會進關卡；按 Enter 會
 *   7. 陸地顏色跟海要看得出差別（船／人在哪種地形一眼可辨）
 *   8. 海上有開闊海面可以生怪物
 */
function runVoyageCheck() {
  const issues = [];
  const ports = Voyage.ports();

  // v1.31：兩張地圖 —— 這裡驗目前這張（歐洲），美洲篇的國家在新大陸地圖上（america-check 驗）
  const here = Levels.list.filter(function (lv) { return (lv.region === 'america') === (WorldMap.world() === 'am'); }).length;
  if (ports.length !== here) {
    issues.push('入口數 ' + ports.length + ' 與這張地圖上的關卡數 ' + here + ' 不一致');
  }

  // 1. 入口 = 圖釘
  ports.forEach(function (p) {
    const n = WorldMap.nations.filter(function (q) { return q.idx === p.idx; })[0];
    if (!n) { issues.push(p.id + ' 沒有對應的圖釘'); return; }
    const d = Math.hypot(p.x - n.pin[0], p.y - n.pin[1]);
    if (d > 8) issues.push(p.id + ' 的入口離自己的城市圖釘 ' + Math.round(d) + 'px');
    if (!Voyage.isLand(p.x, p.y)) issues.push(p.id + ' 的入口不在陸地上（城市應該在國土上）');
  });

  // 2. reset
  ports.forEach(function (p) {
    Voyage.reset(p.idx);
    if (Voyage.nearbyLevel() !== p.idx) issues.push('reset(' + p.idx + ') 後 nearbyLevel = ' + Voyage.nearbyLevel());
    if (Voyage.mode() !== 'land') issues.push('reset(' + p.idx + ') 後應該是步行，結果是 ' + Voyage.mode());
  });

  /** 駕駛：直接朝目標走（現在哪裡都能走，不需要路徑規劃） */
  function drive(fromIdx, target, maxFrames) {
    Voyage.reset(fromIdx);
    const evs = [];
    for (let f = 0; f < maxFrames; f++) {
      const s = Voyage.shipPos();
      if (Math.hypot(s.x - target.x, s.y - target.y) < Voyage.DOCK_RANGE - 4) {
        return { ok: true, frames: f, events: evs };
      }
      const held = {};
      if (target.x - s.x > 2) held.right = true;
      if (target.x - s.x < -2) held.left = true;
      if (target.y - s.y > 2) held.down = true;
      if (target.y - s.y < -2) held.up = true;
      const input = { isDown: function (a) { return !!held[a]; }, once: function () { return false; } };
      Voyage.update(input).forEach(function (e) { evs.push(e); });
    }
    const s = Voyage.shipPos();
    return { ok: false, at: [Math.round(s.x), Math.round(s.y)], events: evs };
  }

  /*
   * 3. 每一國都到得了。
   * v1.30 北歐被雷神的結界罩住（quests.js）：結界還在時要「走不到」，解開後要走得到 —— 兩種都驗。
   */
  const flags = Save.get().flags;
  const northWas = flags.north;
  const dk = ports.filter(function (p) { return p.id === 'DK'; })[0];
  flags.north = 0;
  if (dk && drive(ports[0].idx, dk, 4000).ok) issues.push('北歐的結界還沒解開，卻走得到丹麥');
  flags.north = 1;
  ports.forEach(function (p) {
    if (p.idx === ports[0].idx) return;
    const r = drive(ports[0].idx, p, 4000);
    if (!r.ok) issues.push('從第一關走不到 ' + p.id + '（停在 ' + r.at.join(',') + '）');
  });
  flags.north = northWas;

  // 4. 跨海會上船、到岸會下船
  const gb = ports.filter(function (p) { return p.id === 'GB'; })[0];
  if (gb) {
    const r = drive(ports[0].idx, gb, 4000);
    if (r.events.indexOf('embark') < 0) issues.push('西班牙 → 英國途中沒有上船（跨海應該要變成船）');
    if (r.events.indexOf('land') < 0) issues.push('西班牙 → 英國途中沒有上岸');
  }

  // 5. 船比走路快
  if (!(Voyage.SEA.max > Voyage.LAND.max)) issues.push('船速沒有比步行快，開船沒有意義');

  // 6. 按「上」不可以進關卡；Enter 可以
  Voyage.reset(0);
  const upOnly = {
    isDown: function (a) { return a === 'up'; },
    once: function (a) { return a === 'jump' || a === 'up'; }
  };
  if (Voyage.update(upOnly).indexOf('dock') >= 0) issues.push('按「上」就進關卡 —— 玩家沒辦法往北走');
  Voyage.reset(0);
  const enterOnly = { isDown: function () { return false; }, once: function (a) { return a === 'confirm'; } };
  if (Voyage.update(enterOnly).indexOf('dock') < 0) issues.push('在城市旁按 Enter 沒有進關卡');

  // 7. 陸地看得出來
  (function checkLandVisible() {
    // 只在真的瀏覽器裡跑（node 測試沒有真畫布可以取樣顏色）
    if (typeof HTMLCanvasElement === 'undefined') return;
    const cv = document.createElement('canvas');
    if (!cv || !cv.getContext) return;
    cv.width = WorldMap.WORLD_W; cv.height = WorldMap.WORLD_H;
    const cx2 = cv.getContext('2d');
    if (!cx2 || !cx2.getImageData) return;
    const WW = WorldMap.WORLD_W;
    const sv = Save.get();
    Voyage.draw(cx2, 0, { unlocked: sv.unlocked, clearedFn: function (i) { return Save.isCleared(i); } });
    const img = cx2.getImageData(0, 0, WW, WorldMap.WORLD_H).data;
    const at = function (x, y) { const i = ((y | 0) * WW + (x | 0)) * 4; return [img[i], img[i + 1], img[i + 2]]; };
    let seaRef = null;
    for (let x = 20; x < 120 && !seaRef; x += 4) {
      for (let y = 60; y < WorldMap.WORLD_H - 60; y += 4) {
        if (Voyage.isNavigable(x, y)) { seaRef = at(x, y); break; }
      }
    }
    if (!seaRef) return;
    let bad = 0, total = 0;
    for (let y = 10; y < WorldMap.WORLD_H - 10; y += 5) {
      for (let x = 6; x < WW - 6; x += 5) {
        if (!Voyage.isLand(x, y)) continue;
        total++;
        const c = at(x, y);
        if (Math.hypot(c[0] - seaRef[0], c[1] - seaRef[1], c[2] - seaRef[2]) < 40) bad++;
      }
    }
    const pct = total ? bad / total * 100 : 0;
    if (pct > 6) issues.push('有 ' + pct.toFixed(1) + '% 的陸地顏色跟海太接近，分不出哪裡是陸地');
  })();

  // 8. 開闊海面
  let open = 0;
  for (let y = 20; y < WorldMap.WORLD_H - 20; y += 16) {
    for (let x = 20; x < WorldMap.WORLD_W - 20; x += 16) if (Voyage.isNavigable(x, y)) open++;
  }
  if (open < 200) issues.push('開闊海面太少（' + open + ' 個取樣點），海上怪物沒地方生');

  Voyage.reset(0);
  return { issueCount: issues.length, issues: issues, portCount: ports.length };
}
