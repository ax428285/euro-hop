/**
 * v1.31 美洲篇檢查。在瀏覽器執行 runAmericaCheck()。
 *
 *   A) 兩張地圖：新大陸地圖上剛好是美洲篇的 6 國、入口都在陸地上、哥倫布在聖薩爾瓦多島；換回歐洲又是原本的國家
 *   B) 橫越大西洋：歐洲地圖往西開到底會回報 edgeWest、新大陸往東開到底回報 edgeEast；兩邊的入口都在開闊海面
 *   C) 開放條件：沒完成哥倫布的委託，美洲篇鎖著；完成（columbus = 2）就開
 *   D) 招牌機制：
 *      古巴大浪 —— 拍上來時站在路面會痛、跳在半空中不會；古巴襯衫不會痛
 *      牙買加音響 —— 只有節拍那一下會彈，平常站上去不會
 *      巴拿馬船閘 —— 閘門比跳躍高（從岸上跳不過）、小船升到頂比閘門高；兩艘船差半個週期
 *      哥倫比亞盪繩 —— 把手擺到岸邊時從岸上跳得到；從正中間往前衝時放手飛得過對岸
 *   E) 亞馬遜大蛇：身體在竄出地面前碰到不痛；弧線兩端都在地上；鑽進地底時本體碰不到
 *   F) 每一國都有地標、遠景、國旗；橫向關卡有自己的敵人外型
 * 會暫時改存檔、換地圖，結束前還原。
 */
function runAmericaCheck() {
  const issues = [];
  const sv = Save.get();
  const backup = JSON.stringify(sv);
  const AM = Levels.list.map(function (lv, i) { return { lv: lv, i: i }; }).filter(function (o) { return o.lv.region === 'america'; });
  if (AM.length !== 6) issues.push('美洲篇應該 6 國，現在 ' + AM.length + ' 國');

  // ── A) 兩張地圖 ──
  const startWorld = WorldMap.world();
  WorldMap.useWorld('am'); Voyage.rebuild();
  const amIds = WorldMap.nations.map(function (n) { return n.id; }).sort().join(',');
  if (amIds !== AM.map(function (o) { return o.lv.id; }).sort().join(',')) issues.push('新大陸地圖上的國家不對：' + amIds);
  Voyage.ports().forEach(function (p) {
    if (!Voyage.isLand(p.x, p.y)) issues.push('新大陸：' + p.id + ' 的入口不在陸地上');
  });
  if (!WorldMap.specials.some(function (s) { return s.def.npc === 'columbusAm'; })) issues.push('新大陸地圖上沒有哥倫布');
  // 國名標籤離自己的圖釘不能太遠
  WorldMap.nations.forEach(function (n) {
    const d = Math.hypot(n.label[0] - n.pin[0], n.label[1] - n.pin[1]);
    if (d > 110) issues.push('新大陸：' + n.id + ' 的國名離圖釘 ' + Math.round(d) + 'px');
  });
  // ── B) 往東開到底 ──
  (function () {
    const p = WorldMap.project(-31.2, 15);
    let at = null;
    for (let r = 0; r <= 200 && !at; r += 8) for (let k = 0; k < 16 && !at; k++) {
      const x = p[0] + Math.cos(k * Math.PI / 8) * r, y = p[1] + Math.sin(k * Math.PI / 8) * r;
      if (Voyage.isNavigable(x, y)) at = { x: x, y: y };
    }
    if (!at) { issues.push('新大陸：大西洋的入口附近沒有開闊海面'); return; }
    Voyage.placeShip(at.x, at.y);
    const inp = { isDown: function (a) { return a === 'right'; }, once: function () { return false; } };
    let hit = false;
    for (let f = 0; f < 900 && !hit; f++) hit = Voyage.update(inp).indexOf('edgeEast') >= 0;
    if (!hit) issues.push('新大陸：從入口一直往東開，到不了地圖東邊（回不了歐洲）');
  })();
  WorldMap.useWorld('eu'); Voyage.rebuild();
  if (WorldMap.nations.some(function (n) { return Levels.list[n.idx].region === 'america'; })) issues.push('歐洲地圖上出現了美洲的國家');
  if (WorldMap.nations.length !== Levels.count - AM.length) issues.push('換回歐洲地圖後國家數不對：' + WorldMap.nations.length);
  // ── B) 往西開到底 ──
  (function () {
    const p = WorldMap.project(-25.6, 31);
    let at = null;
    for (let r = 0; r <= 200 && !at; r += 8) for (let k = 0; k < 16 && !at; k++) {
      const x = p[0] + Math.cos(k * Math.PI / 8) * r, y = p[1] + Math.sin(k * Math.PI / 8) * r;
      if (Voyage.isNavigable(x, y)) at = { x: x, y: y };
    }
    if (!at) { issues.push('歐洲：大西洋的入口附近沒有開闊海面'); return; }
    Voyage.placeShip(at.x + 60, at.y);
    const inp = { isDown: function (a) { return a === 'left'; }, once: function () { return false; } };
    let hit = false;
    for (let f = 0; f < 600 && !hit; f++) hit = Voyage.update(inp).indexOf('edgeWest') >= 0;
    if (!hit) issues.push('歐洲：從大西洋一直往西開，沒有回報 edgeWest（去不了新大陸）');
  })();
  if (startWorld !== 'eu') { WorldMap.useWorld(startWorld); Voyage.rebuild(); }

  // ── C) 開放條件 ──
  sv.flags = sv.flags || {};
  sv.flags.columbus = 1;
  if (Quests.americaOpen() || Encounter.regionUnlocked('america', 99999)) issues.push('哥倫布還沒出航，美洲篇就開了');
  sv.flags.columbus = 2;
  if (!Quests.americaOpen() || !Encounter.regionUnlocked('america', 0)) issues.push('哥倫布出航了，美洲篇還鎖著');

  // ── D) 招牌機制 ──
  function stateOf(def) {
    const st = { def: def, players: [], features: Features.makeState(def), particles: [], enemies: [], shots: [] };
    return st;
  }
  function player(x, y) {
    return { x: x, y: y, w: 22, h: 40, vx: 0, vy: 0, onGround: true, invuln: 0, stats: Equipment.resolve([]), pid: 0 };
  }
  // 古巴大浪
  (function () {
    const def = AM[0].lv;
    const wv = def.features.filter(function (f) { return f.type === 'waves'; })[0];
    if (!wv) { issues.push('古巴：沒有大浪'); return; }
    let hitT = -1;
    for (let t = 0; t < 600 && hitT < 0; t++) if (Features.waveState(wv, t).hit) hitT = t;
    let warned = false;
    for (let t = Math.max(0, hitT - 60); t < hitT; t++) if (Features.waveState(wv, t).warn) warned = true;
    if (!warned) issues.push('古巴：浪拍上來之前沒有預告');
    const mid = (wv.x0 + wv.x1) / 2, gy = LevelGen.groundAt(def.groundSegs, mid);
    const st = stateOf(def);
    const ground = player(mid, gy - 40), air = player(mid + 60, gy - 40 - Features.WAVE_H - 10);
    air.onGround = false;
    st.players = [ground, air];
    const ev = Features.update(st, hitT);
    if (!(ground.invuln > 0)) issues.push('古巴：浪拍上來時站在路面上沒有受傷');
    if (air.invuln > 0) issues.push('古巴：跳在浪頭上方還是被打到');
    const st2 = stateOf(def);
    const tough = player(mid, gy - 40); tough.stats = Equipment.resolve(['guayabera']);
    st2.players = [tough];
    Features.update(st2, hitT);
    if (tough.invuln > 0) issues.push('古巴襯衫：浪打到還是會痛');
  })();
  // 牙買加音響
  (function () {
    const def = AM[1].lv;
    const sp = def.features.filter(function (f) { return f.type === 'beatpad'; });
    if (sp.length < 3) { issues.push('牙買加：音響太少（' + sp.length + '）'); return; }
    const f = sp[0];
    let boomT = -1, quietT = -1;
    for (let t = 0; t < 200; t++) {
      const b = Features.beatState(f, t);
      if (b.boom && boomT < 0) boomT = t;
      if (!b.boom && !b.warn && quietT < 0) quietT = t;
    }
    const st = stateOf(def);
    const p1 = player(f.x + 10, f.y - 40); st.players = [p1];
    Features.update(st, quietT);
    if (p1.vy < 0) issues.push('牙買加：沒有節拍的時候站上音響也被彈起來');
    const st2 = stateOf(def);
    const p2 = player(f.x + 10, f.y - 40); st2.players = [p2];
    Features.update(st2, boomT);
    if (!(p2.vy < -10)) issues.push('牙買加：節拍「咚」的那一下沒有被彈起來（vy=' + p2.vy + '）');
  })();
  // 巴拿馬船閘
  (function () {
    const def = AM[3].lv;
    const gates = def.features.filter(function (f) { return f.type === 'lockGate'; });
    const locks = def.features.filter(function (f) { return f.type === 'lock'; });
    if (gates.length !== (def.channels || []).length || locks.length !== gates.length * 2) {
      issues.push('巴拿馬：閘門 ' + gates.length + '、小船 ' + locks.length + '，跟水道數 ' + (def.channels || []).length + ' 對不上');
      return;
    }
    const jumpH = PHYS.JUMP_V * PHYS.JUMP_V / (2 * PHYS.GRAVITY);
    if (Features.GATE_H <= jumpH + 8) issues.push('巴拿馬：閘門只比岸高 ' + Features.GATE_H + '，從岸上就跳得過去（跳躍 ' + Math.round(jumpH) + '）');
    if (Features.LOCK_RISE <= Features.GATE_H + 10) issues.push('巴拿馬：小船升到頂也沒有比閘門高');
    const a = locks[0], b = locks[1];
    const t0 = 0;
    const la = Features.lockLift(a, t0), lb = Features.lockLift(b, t0);
    if (Math.abs((la + lb) - Features.LOCK_RISE) > 2) issues.push('巴拿馬：同一道閘室的兩艘船沒有一升一降（' + Math.round(la) + ' / ' + Math.round(lb) + '）');
    // 從最低點（跟岸齊平）一定走得上船：船兩側離岸／閘門的空隙要比玩家窄（不會掉下去）也要跳得過
    const gapL = a.x - a.gx;
    if (gapL > 40) issues.push('巴拿馬：小船離岸 ' + gapL + 'px，船降到底時要跳才上得去（應該走得上去）');
  })();
  // 寬水道上方不能有浮空平台、移動平台（踩上去就過去了，用不到船、盪繩）
  [AM[3].lv, AM[4].lv].forEach(function (def) {
    (def.channels || []).forEach(function (g) {
      const over = function (x0, x1) { return x0 < g.x + g.w + 20 && x1 > g.x - 20; };
      if ((def.platforms || []).some(function (q) { return !q.goalPlat && over(q.x, q.x + q.w); })) issues.push(def.country + '：水道 x=' + g.x + ' 上方有浮空平台，不用' + (def.id === 'PA' ? '搭船' : '盪繩') + '就過得去');
      if ((def.movers || []).some(function (m) { return over(m.x - (m.axis === 'x' ? m.range : 0), m.x + m.w + (m.axis === 'x' ? m.range : 0)); })) issues.push(def.country + '：水道 x=' + g.x + ' 上方有移動平台');
    });
  });
  // 哥倫比亞盪繩
  (function () {
    const def = AM[4].lv;
    const ropes = def.features.filter(function (f) { return f.type === 'rope'; });
    if (ropes.length !== (def.channels || []).length) { issues.push('哥倫比亞：盪繩 ' + ropes.length + ' 條，水道 ' + (def.channels || []).length + ' 道'); return; }
    const jumpH = PHYS.JUMP_V * PHYS.JUMP_V / (2 * PHYS.GRAVITY);
    ropes.forEach(function (r, i) {
      const ly = LevelGen.groundAt(def.groundSegs, r.gx - 4);
      // 擺到最左邊：把手跟岸的距離、高度
      let best = null;
      for (let t = 0; t < Features.ROPE_PERIOD; t++) {
        const h = Features.ropeHandle(r, t);
        if (!best || h.x < best.x) best = h;
      }
      const dx = best.x - r.gx, up = ly - best.y;
      // 跳到最高時身體中心在腳底上方 20（身高 40）→ 中心最高到 ly - jumpH - 20
      if (up - 20 > jumpH + 20) issues.push('哥倫比亞：第 ' + (i + 1) + ' 條盪繩的把手太高（離地 ' + Math.round(up) + '），從岸上跳不到');
      if (dx > 90) issues.push('哥倫比亞：第 ' + (i + 1) + ' 條盪繩擺到最邊還離岸 ' + Math.round(dx) + 'px，跳不過去抓');
      // 從正中間往前衝的那一下放手：拋物線落點要過對岸
      let tMid = 0, bestV = -Infinity;
      for (let t = 0; t < Features.ROPE_PERIOD; t++) { const v = Features.ropeVel(r, t).vx; if (v > bestV) { bestV = v; tMid = t; } }
      // 放手後人在空中最快只有跑速（按著往前也一樣），所以 vx 要截在 MAX_RUN
      const h = Features.ropeHandle(r, tMid), v = Features.ropeRelease(r, tMid);
      let x = h.x + 11, y = h.y - 8 + 40, vx = Math.min(v.vx, PHYS.MAX_RUN), vy = v.vy;
      for (let f = 0; f < 200 && (vy < 0 || y < ly); f++) { vy = Math.min(vy + PHYS.GRAVITY, PHYS.MAX_FALL || 12); x += vx; y += vy; }
      if (x < r.gx + r.gw + 10) issues.push('哥倫比亞：第 ' + (i + 1) + ' 條盪繩盪到正中間放手，只飛到 x=' + Math.round(x) + '（對岸 ' + (r.gx + r.gw) + '）');
    });
  })();

  // ── E) 亞馬遜大蛇 ──
  (function () {
    const def = AM[5].lv;
    if (def.boss.pattern !== 'boiuna') { issues.push('巴西魔王的招式不是 boiuna'); return; }
    const st = { def: def, shots: [], particles: [], enemies: [] };
    const end = makeSerpentArc(st, 400, 800, 0);
    const segs = st.shots.filter(function (s) { return s.serpent; });
    if (segs.length < 4) issues.push('大蛇：身體只有 ' + segs.length + ' 節');
    if (!st.shots.some(function (s) { return s.arcMark; })) issues.push('大蛇：沒有虛線弧的預告');
    if (segs.some(function (s) { return !(s.warn > 30); })) issues.push('大蛇：身體竄出來之前的預告太短');
    if (!(end > 60)) issues.push('大蛇：整段竄過去的時間算錯（' + end + '）');
    const b = makeBoss(def.boss);
    b.fade = 0;
    if (!bossHarmless(b)) issues.push('大蛇：鑽進地底時本體還會撞傷人');
  })();

  // ── F) 美術 ──
  AM.forEach(function (o) {
    const lv = o.lv;
    if (!Sprites.landmarks[lv.landmark]) issues.push(lv.country + '：沒有地標 ' + lv.landmark);
    if (!Sprites.skylines[lv.id]) issues.push(lv.country + '：沒有遠景');
    if (!Sprites.flagDirs[lv.flagDir]) issues.push(lv.country + '：國旗畫法 ' + lv.flagDir + ' 沒有註冊');
    if (!lv.isBoss && lv.layout !== 'shaft' && !(Sprites.countryEnemies[lv.id] && Sprites.countryEnemies[lv.id].walker)) issues.push(lv.country + '：沒有自己的敵人外型');
    if (!Equipment.forLevel(o.i)) issues.push(lv.country + '：沒有裝備');
    if (!Mystery.clueFor || !Mystery.clueFor(o.i)) issues.push(lv.country + '：沒有美洲之謎的線索');
  });
  if (!Sprites.shaftThemes.cenote) issues.push('墨西哥：沒有聖井的豎井主題');

  // 還原
  const restored = JSON.parse(backup);
  Object.keys(sv).forEach(function (k) { delete sv[k]; });
  Object.assign(sv, restored);
  Save.save();
  return { issueCount: issues.length, issues: issues };
}
