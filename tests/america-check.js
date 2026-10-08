/**
 * v1.31 美洲篇檢查。在瀏覽器執行 runAmericaCheck()。
 *
 *   A) 兩張地圖：新大陸地圖上剛好是美洲篇的 6 國、入口都在陸地上、哥倫布在聖薩爾瓦多島；換回歐洲又是原本的國家
 *   B) 橫越大西洋：歐洲地圖往西開到底會回報 edgeWest、新大陸往東開到底回報 edgeEast；兩邊的入口都在開闊海面
 *   C) 開放條件：沒完成哥倫布的委託，美洲篇鎖著；完成（columbus = 2）就開
 *   D) 招牌機制：
 *      （古巴、墨西哥是往前衝的賽道關，由 race-check 驗）
 *      牙買加手沖咖啡 —— 沖水前有預告；站在水柱裡會燙、站在旁邊不會，而且會被咖啡粉托上去；手沖細口壺不會燙
 *      巴拿馬船閘 —— 閘門比跳躍高（從岸上跳不過）、小船升到頂比閘門高；兩艘船差半個週期
 *      哥倫比亞盪繩 —— 把手擺到岸邊時從岸上跳得到；從正中間往前衝時放手飛得過對岸
 *   E) 巴西足球：踩守門員的頭沒用；球滾進球門 = 扣一格；守門員站著時貼地球會被擋回來；
 *      他躺下（破綻期）時完全擋不到球（貼地球也進得去）；守門員不會撞傷人；踢球機器人贏得了
 *   F) 每一國都有地標、遠景、國旗；橫向關卡有自己的敵人外型
 *   G) 新大陸的海上怪：新大陸只生新大陸的怪（食人魚、黑鬍子、海豚、黃金海龜），四種都是自己的玩法（不跟歐洲重複）；
 *      海豚關的星星自己跳（二段跳也是）碰不到、從海豚背上彈起來才碰得到；
 *      打贏給「美洲 EXP」（跟歐洲的分開）；美洲 EXP 夠了才解鎖南美（哥倫比亞、巴西），中美洲一開始就能玩
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
  // 牙買加手沖咖啡
  (function () {
    const def = AM[1].lv;
    const ps = def.features.filter(function (f) { return f.type === 'pourover'; });
    if (ps.length < 3) { issues.push('牙買加：手沖咖啡只有 ' + ps.length + ' 組'); return; }
    const f = ps[0];
    let pourT = -1, warned = false;
    for (let t = 0; t < 700 && pourT < 0; t++) { const q = Features.pourState(f, t); if (q.warn) warned = true; if (q.pour && warned) pourT = t; }
    if (pourT < 0) { issues.push('牙買加：沖水前沒有預告（或一直不沖水）'); return; }
    // 站在水柱正中間（沖水中）→ 燙到
    const stA = stateOf(def), mid = player(f.x + f.w / 2 - 11, f.y - Features.POUR_BASE - 40);
    stA.players = [mid];
    for (let t = pourT; t < pourT + 10; t++) Features.update(stA, t);
    if (!(mid.invuln > 0)) issues.push('牙買加：站在熱水柱正中間沒有被燙到');
    // 站在旁邊：不會燙；跟著咖啡粉一起被托上去（用 box 的高度驗）
    const stB = stateOf(def), side = player(f.x + 14, f.y - Features.POUR_BASE - 40);
    stB.players = [side];
    let maxLift = 0;
    for (let t = pourT; t < pourT + 140; t++) { Features.update(stB, t); maxLift = Math.max(maxLift, stB.features.list.filter(function (q) { return q.type === 'pourover'; })[0].lift || 0); }
    if (side.invuln > 0) issues.push('牙買加：站在濾杯旁邊也被燙到');
    if (maxLift < Features.POUR_LIFT - 2) issues.push('牙買加：咖啡粉悶蒸只膨脹到 ' + Math.round(maxLift));
    // 被托到最高時往上跳，碰得到上面最高的金幣
    const jumpH = PHYS.JUMP_V * PHYS.JUMP_V / (2 * PHYS.GRAVITY);
    const reach = Features.POUR_BASE + Features.POUR_LIFT + jumpH + 40;
    const top = Math.min.apply(null, def.coins.filter(function (c) { return c.x > f.x - 20 && c.x < f.x + f.w + 20; }).map(function (c) { return c.y; }));
    if (f.y - top > reach) issues.push('牙買加：濾杯上方的金幣（離地 ' + Math.round(f.y - top) + '）托上去也碰不到');
    // 手沖細口壺：不怕燙
    const stC = stateOf(def), pro = player(f.x + f.w / 2 - 11, f.y - Features.POUR_BASE - 40);
    pro.stats = Equipment.resolve(['kettle']); stC.players = [pro];
    for (let t = pourT; t < pourT + 10; t++) Features.update(stC, t);
    if (pro.invuln > 0) issues.push('手沖細口壺：熱水還是會燙');
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

  // ── E) 巴西足球 ──
  (function () {
    const o = AM[5], def = o.lv;
    if (def.boss.pattern !== 'soccer') { issues.push('巴西魔王不是足球（pattern ' + def.boss.pattern + '）'); return; }
    const fresh = function () { return buildLevelState(def, o.i, [], Equipment.resolve([])); };
    const G = Levels.GROUND_Y, S = def.boss.soccer;
    // 踩頭沒用
    let st = fresh();
    st.boss.phase = 'recover'; st.boss.timer = 100;
    if (bossVulnerable(st.boss)) issues.push('巴西：守門員躺下時踩頭也算數（應該只有進球才算）');
    if (!bossHarmless(st.boss)) issues.push('巴西：守門員會撞傷人');
    // 球滾進門 = 扣一格
    st = fresh();
    const hp0 = st.boss.hp;
    st.boss.phase = 'recover'; st.boss.timer = 200;
    st.ball.x = S.goalX - 4; st.ball.y = G - st.ball.h; st.ball.vx = 6; st.ball.vy = 0;
    st.player.x = 200;
    let goal = false;
    for (let f = 0; f < 30 && !goal; f++) goal = updateBoss(st, f).indexOf('goal') >= 0;
    if (!goal || st.boss.hp !== hp0 - 1) issues.push('巴西：球滾進球門沒有算進球（hp ' + hp0 + ' → ' + st.boss.hp + '）');
    // 守門員站著：貼地球擋回來
    st = fresh();
    st.boss.phase = 'idle'; st.boss.timer = 500; st.boss.x = 1110;
    st.ball.x = 900; st.ball.y = G - st.ball.h; st.ball.vx = 8; st.ball.vy = 0;
    st.player.x = 200;
    let saved = false, scored = false;
    for (let f = 0; f < 90; f++) { const ev = updateBoss(st, f); if (ev.indexOf('save') >= 0) saved = true; if (ev.indexOf('goal') >= 0) scored = true; }
    if (!saved || scored) issues.push('巴西：守門員站著時，貼地球沒有被擋下來');
    // 躺下時：貼地球、高吊球都進得去（擋不到）
    [[0, '貼地球'], [-9, '高吊球']].forEach(function (k) {
      st = fresh();
      st.boss.phase = 'recover'; st.boss.timer = 300; st.boss.x = 1110;
      st.ball.x = 860; st.ball.y = G - st.ball.h; st.ball.vx = 8.2; st.ball.vy = k[0];
      st.player.x = 200;
      let sc = false, sv = false;
      for (let f = 0; f < 120 && !sc; f++) { const ev = updateBoss(st, f); if (ev.indexOf('goal') >= 0) sc = true; if (ev.indexOf('save') >= 0) sv = true; }
      if (!sc || sv) issues.push('巴西：守門員躺下時，' + k[1] + '還是被擋住、進不去');
    });
    // 照真人打法的踢球機器人（不作弊、帶前面拿得到的裝備）
    const r = runSoccerBot(def, o.i, false);
    if (!r.won) issues.push('巴西：踢球機器人踢不贏（進 ' + r.goals + ' 球、受傷 ' + r.timesHurt + ' 次）');
    else if (r.timesHurt >= 3) issues.push('巴西：踢球機器人贏了但受傷 ' + r.timesHurt + ' 次，可能太難');
  })();

  // ── G) 新大陸的海上怪、美洲 EXP ──
  (function () {
    const was = WorldMap.world();
    WorldMap.useWorld('am'); Voyage.rebuild(); Encounter.clear();
    const AMK = ['piranhas', 'buccaneers', 'dolphins', 'goldturtle'];
    sv.expAm = 200;
    const seen = {};
    for (let k = 0; k < 400; k++) {
      const m = Encounter.spawn(Voyage.shipPos(), 0);
      if (m) { seen[m.kind] = true; Encounter.remove(m); }
    }
    Object.keys(seen).forEach(function (kd) { if (AMK.indexOf(kd) < 0) issues.push('新大陸生出了歐洲的怪：' + kd); });
    ['piranhas', 'buccaneers', 'dolphins'].forEach(function (kd) { if (!seen[kd]) issues.push('新大陸一直沒生出 ' + kd); });
    Encounter.clear();
    WorldMap.useWorld(was); Voyage.rebuild();
    // v1.31 玩家：遭遇戰不要跟歐洲重複 → 四種都是自己的玩法
    const BASE = { piranhas: 'piranhas', buccaneers: 'buccaneers', dolphins: 'dolphins', goldturtle: 'goldturtle' };
    AMK.forEach(function (kd) {
      const k = Encounter.KINDS[kd];
      if (!k || !k.am) { issues.push(kd + '：不是新大陸的怪'); return; }
      const d = Encounter.makeDef({ kind: kd, def: k, x: 0, y: 0 }, Equipment.resolve([]));
      if (d.minigame !== BASE[kd]) issues.push(kd + '：玩法應該沿用 ' + BASE[kd] + '，現在是 ' + d.minigame);
      if (!d.am) issues.push(kd + '：遭遇戰沒標記新大陸（美洲 EXP）');
      if (['gulls', 'pirates', 'serpent', 'golden'].indexOf(d.minigame) >= 0) issues.push(kd + '：玩法跟歐洲的 ' + d.minigame + ' 重複');
    });
    // 海豚關：星星的高度（二段跳碰不到、海豚彈得到）
    {
      const G = Levels.GROUND_Y;
      const jumpUp = PHYS.JUMP_V * PHYS.JUMP_V / (2 * PHYS.GRAVITY) + PHYS.DOUBLE_JUMP_V * PHYS.DOUBLE_JUMP_V / (2 * PHYS.GRAVITY);
      const dolUp = 16.5 * 16.5 / (2 * PHYS.GRAVITY);
      const d = Encounter.makeDef({ kind: 'dolphins', def: Encounter.KINDS.dolphins, x: 0, y: 0 }, Equipment.resolve([]));
      const st = buildLevelState(d, -1, [], Equipment.resolve([]));
      st.mini = null;
      Encounter.updateSkirmish(st, { isDown: function () { return false; }, once: function () { return false; } });
      const stars = st.mini.starList;
      const lowest = Math.max.apply(null, stars.map(function (s) { return s.y + s.h; }));
      const highest = Math.min.apply(null, stars.map(function (s) { return s.y; }));
      if (G - lowest < jumpUp + 40 + 4) issues.push('海豚關：最低的星星（離地 ' + Math.round(G - lowest) + '）二段跳就碰得到');
      if (G - 100 - dolUp - 40 > highest) issues.push('海豚關：最高的星星從海豚背上彈起來也碰不到');
    }
    // 美洲 EXP 分開算，南美要 SOUTH_EXP
    const e0 = sv.exp;
    sv.expAm = 0;
    Save.addExpAm(90);
    if (sv.exp !== e0 || Save.expAm() !== 90) issues.push('美洲 EXP 沒有跟歐洲的分開算');
    const SE = Encounter.SOUTH_EXP;
    sv.flags.columbus = 2;
    sv.expAm = SE - 1;
    if (Encounter.regionUnlocked('samerica', 99999)) issues.push('美洲 EXP 不夠，南美就開了（看到歐洲的 EXP）');
    sv.expAm = SE;
    if (!Encounter.regionUnlocked('samerica', 0)) issues.push('美洲 EXP 夠了，南美還鎖著');
    const gated = Levels.list.filter(function (lv) { return lv.gate === 'samerica'; }).map(function (lv) { return lv.id; }).sort().join(',');
    if (gated !== 'BR,CO') issues.push('南美要解鎖的應該是哥倫比亞、巴西，現在是：' + gated);
  })();

  // ── F) 美術 ──
  AM.forEach(function (o) {
    const lv = o.lv;
    if (!Sprites.landmarks[lv.landmark]) issues.push(lv.country + '：沒有地標 ' + lv.landmark);
    if (!Sprites.skylines[lv.id]) issues.push(lv.country + '：沒有遠景');
    if (!Sprites.flagDirs[lv.flagDir]) issues.push(lv.country + '：國旗畫法 ' + lv.flagDir + ' 沒有註冊');
    if (!lv.isBoss && lv.layout !== 'shaft' && lv.layout !== 'race' && !(Sprites.countryEnemies[lv.id] && Sprites.countryEnemies[lv.id].walker)) issues.push(lv.country + '：沒有自己的敵人外型');
    if (!Equipment.forLevel(o.i)) issues.push(lv.country + '：沒有裝備');
    if (!Mystery.clueFor || !Mystery.clueFor(o.i)) issues.push(lv.country + '：沒有美洲之謎的線索');
  });
  if (Levels.list.filter(function (lv) { return lv.region === 'america' && lv.layout === 'race'; }).length !== 2) issues.push('美洲篇應該有兩關往前衝的賽道關（古巴、墨西哥）');

  // 還原
  const restored = JSON.parse(backup);
  Object.keys(sv).forEach(function (k) { delete sv[k]; });
  Object.assign(sv, restored);
  Save.save();
  return { issueCount: issues.length, issues: issues };
}
