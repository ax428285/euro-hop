/**
 * 雙人試煉檢查（v1.28）。在瀏覽器執行 runDuoCheck()。
 *
 *   A) 跳躍力：一個人（全裝備、封印後）跳不上高台；站在隊友頭上就跳得上去
 *   B) 一個人過不了：單人機器人一路往右衝（踩到壓板也照衝），20000 帧內到不了終點
 *      —— 用「全裝備」的能力值再封印，確認二段跳、蹬牆跳沒有漏網
 *   C) 兩個人過得了：照設計的步驟（一人踩壓板、另一人過門；疊羅漢⋯⋯）走，要過關、不能掉坑
 *   D) 每道門、每塊壓板都有用到（機器人走完後全部被踩過、門都開過）
 *   E) 地圖上有兩個試煉地點，資訊用的 KINDS 齊全
 */
function runDuoCheck() {
  const issues = [];
  const report = {};
  const allEquip = Equipment.defs.map(function (d) { return d.id; });
  const sealed = Duo.seal(Equipment.resolve(allEquip));
  const plain = Duo.seal(Equipment.resolve([]));

  /** 假輸入：held 按住、jumpEdge 這帧剛按下 */
  function makeInput() {
    const io = { held: {}, edge: false };
    io.isDown = function (a) { return !!io.held[a]; };
    io.once = function (a) { return a === 'jump' && io.edge; };
    io.endFrame = function () {};
    return io;
  }

  /** 照遊戲的方式重生：退回左邊最近一段地面的開頭（game.js loseLife） */
  function respawn(state, p) {
    let sx = state.def.spawnX, sy = Levels.GROUND_Y;
    state.def.groundSegs.forEach(function (s) { if (s.x <= p.x) { sx = s.x + 40; sy = s.y; } });
    p.x = sx; p.y = sy - p.h - 4; p.vx = 0; p.vy = 0; p.ridingMover = null;
  }

  /**
   * 走向 x 的控制器：到了就停；推著牆走不動、或腳下前方是坑時跳一下（按滿）
   * 每位玩家各一個，記自己的「卡住幾帧」與跳躍按鍵狀態
   */
  function makeWalker() {
    return { input: makeInput(), stuck: 0, lastX: null, jumpHold: 0 };
  }
  function drive(w, p, tx, hop) {
    const io = w.input;
    io.held = {}; io.edge = false;
    const cx = p.x + p.w / 2;
    const dir = tx > cx + 5 ? 1 : tx < cx - 5 ? -1 : 0;
    if (dir > 0) io.held.right = true;
    if (dir < 0) io.held.left = true;
    if (dir !== 0 && p.onGround && w.lastX != null && Math.abs(p.x - w.lastX) < 0.3) w.stuck++;
    else if (p.onGround) w.stuck = 0;
    if (w.jumpHold > 0) { io.held.jump = true; w.jumpHold--; }
    else if ((w.stuck >= 3 || hop) && p.onGround) { io.held.jump = true; io.edge = true; w.jumpHold = 26; w.stuck = 0; }
    w.lastX = p.x;
    return Math.abs(tx - cx) <= 6;
  }

  function onPlate(state, id, p) {
    const pl = state.duo.plates.filter(function (q) { return q.id === id; })[0];
    return pl && p.onGround && Math.abs(p.y + p.h - pl.y) < 4 && p.x + p.w > pl.x + 4 && p.x < pl.x + pl.w - 4;
  }
  function plateMid(state, id) {
    const pl = state.duo.plates.filter(function (q) { return q.id === id; })[0];
    return pl.x + pl.w / 2;
  }

  /** 跑一整關。plan = 每階段 { a: 目標x 或 null（P1 停著）, b: P2 目標, done(state) } */
  function run(key, coop, stats, plan) {
    const def = Duo.build(key);
    const state = buildLevelState(def, -1, [], stats, coop);
    state.enemies = [];
    const ws = state.players.map(makeWalker);
    let phase = 0, t = 0, falls = 0;
    const log = [];
    while (t < 20000 && !state.cleared) {
      t++;
      const step = plan[Math.min(phase, plan.length - 1)];
      state.players.forEach(function (p, i) {
        const tx = typeof step[i] === 'function' ? step[i](state) : step[i];
        if (tx == null) { ws[i].input.held = {}; ws[i].input.edge = false; }
        else drive(ws[i], p, tx, step.hop === i);
        const ev = updatePlayer(state, ws[i].input, t, p);
        if (ev.indexOf('fall') >= 0) { falls++; log.push('P' + (i + 1) + ' 第 ' + phase + ' 步掉下去 x=' + Math.round(p.x)); respawn(state, p); }
        if (ev.indexOf('hurt') >= 0) log.push('P' + (i + 1) + ' 受傷');
      });
      state.players.forEach(function (q) { q.out = false; });
      Duo.update(state);
      if (phase < plan.length && plan[phase].done && plan[phase].done(state)) { phase++; log.push('第 ' + phase + ' 步完成 @' + t); }
    }
    return { cleared: state.cleared, frames: t, falls: falls, phase: phase, log: log, state: state };
  }

  // ── A) 跳躍力 ──
  (function () {
    const def = Duo.build('maze');
    const st = buildLevelState(def, -1, [], sealed, false);
    const p = st.player;
    const io = makeInput();
    let minY = p.y, f = 0;
    p.x = 300; p.y = Levels.GROUND_Y - p.h; p.onGround = true;
    for (f = 0; f < 120; f++) {
      io.held = { jump: true }; io.edge = f === 0;
      updatePlayer(st, io, f, p);
      minY = Math.min(minY, p.y);
    }
    const jumpH = Levels.GROUND_Y - p.h - minY;
    report.jumpHeight = Math.round(jumpH);
    const wall = Levels.GROUND_Y - Duo.HIGH;
    if (jumpH >= wall) issues.push('封印後一個人就跳得上 ' + wall + 'px 的高台（跳 ' + Math.round(jumpH) + 'px）');
    if (jumpH + 40 < wall + 4) issues.push('疊羅漢也跳不上高台：跳 ' + Math.round(jumpH) + '+40 < ' + wall);
    if (sealed.doubleJump || sealed.wallJump || sealed.glide || sealed.jumpBoost) issues.push('Duo.seal 沒有封掉跳躍類能力');
  })();

  // ── B) 一個人過不了（一路往右衝；壓板踩過就算了，照衝）──
  ['twins', 'maze'].forEach(function (key) {
    [sealed, plain].forEach(function (stats, si) {
      const r = run(key, false, stats, [{ 0: 99999 }]);
      if (r.cleared) issues.push(key + '：一個人（' + (si ? '沒裝備' : '全裝備') + '）就過關了');
      report[key + (si ? 'SoloPlain' : 'SoloFull')] = Math.round(r.state.player.x);
    });
    // 兩人同機但 2P 站著不動：也要過不了
    const idle = run(key, true, sealed, [{ 0: 99999, 1: null }]);
    if (idle.cleared) issues.push(key + '：2P 站著不動，1P 自己就過關了');
  });

  // ── C) 兩個人照步驟過關 ──
  const S = function (a, b, done, hop) { return { 0: a, 1: b, done: done, hop: hop }; };
  const HIGH = Duo.HIGH;
  const onHead = function (s, i, j) { const a = P(s, i), b = P(s, j); return a.onGround && Math.abs(a.y + a.h - b.y) < 2; };
  const P = function (st, i) { return st.players[i]; };
  const lock = function (st, i) { return st.duo.locks[i]; };
  const twins = [
    S(function (s) { return plateMid(s, 'a'); }, 660, function (s) { return onPlate(s, 'a', P(s, 0)) && lock(s, 0).o >= 1; }),
    S(function (s) { return plateMid(s, 'a'); }, function (s) { return plateMid(s, 'b'); }, function (s) { return onPlate(s, 'b', P(s, 1)); }),
    S(1040, function (s) { return plateMid(s, 'b'); }, function (s) { return P(s, 0).x > 1000; }),
    S(function (s) { return plateMid(s, 'c'); }, 1250, function (s) { return onPlate(s, 'c', P(s, 0)) && lock(s, 1).o >= 1 && P(s, 1).x > 1200; }),
    S(function (s) { return plateMid(s, 'c'); }, function (s) { return plateMid(s, 'd'); }, function (s) { return onPlate(s, 'd', P(s, 1)); }),
    S(1760, function (s) { return plateMid(s, 'd'); }, function (s) { return P(s, 0).x > 1720; }),
    S(function (s) { return plateMid(s, 'e'); }, function (s) { return plateMid(s, 'f'); }, function (s) { return lock(s, 2).latched; }),
    S(99999, 99999)
  ];
  const maze = [
    S(690, 600, function (s) { return P(s, 0).x > 670 && P(s, 0).onGround; }),
    S(689, 760, function (s) { return P(s, 1).onGround && P(s, 1).y + P(s, 1).h === HIGH; }),
    S(689, function (s) { return plateMid(s, 'L'); }, function (s) { return s.duo.plates[0].down && lock(s, 0).o >= 1; }),
    S(780, 960, function (s) { return P(s, 0).onGround && P(s, 0).y + P(s, 0).h === HIGH; }),
    S(1100, 1060, function (s) { return P(s, 0).x > 1050 && P(s, 1).x > 1020 && P(s, 0).onGround && P(s, 1).onGround; }),
    // 懸空高台：1P 站在高台左緣底下，2P 先跳到 1P 頭上，再從頭上跳上高台
    S(1520, 1420, function (s) { return Math.abs(P(s, 0).x + 11 - 1520) < 7 && P(s, 0).onGround; }),
    S(1520, 1520, function (s) { return onHead(s, 1, 0); }, 1),
    S(1520, function (s) { return plateMid(s, 'q'); }, function (s) { return onPlate(s, 'q', P(s, 1)); }, 1),
    S(function (s) { return plateMid(s, 'p'); }, function (s) { return plateMid(s, 'q'); }, function (s) { return lock(s, 1).latched; }),
    S(2100, 2060, function (s) { return P(s, 0).x > 2050 && P(s, 1).x > 2000; }),
    S(function (s) { return plateMid(s, 'r'); }, 2440, function (s) { return onPlate(s, 'r', P(s, 0)) && lock(s, 2).o >= 1 && P(s, 1).x > 2400; }),
    S(function (s) { return plateMid(s, 'r'); }, function (s) { return plateMid(s, 's'); }, function (s) { return onPlate(s, 's', P(s, 1)); }),
    S(2800, function (s) { return plateMid(s, 's'); }, function (s) { return P(s, 0).x > 2760; }),
    S(2990, 2900, function (s) { return P(s, 0).x > 2970 && P(s, 0).onGround; }),
    S(2989, 99999)
  ];
  [['twins', twins], ['maze', maze]].forEach(function (pair) {
    const r = run(pair[0], true, sealed, pair[1]);
    report[pair[0]] = { cleared: r.cleared, secs: Math.round(r.frames / 60), falls: r.falls, steps: r.phase + '/' + pair[1].length };
    if (!r.cleared) issues.push(pair[0] + '：兩個人照步驟走還是沒過關（卡在第 ' + (r.phase + 1) + ' 步；' + r.log.slice(-4).join('、') + '）');
    if (r.falls) issues.push(pair[0] + '：照步驟走掉下去 ' + r.falls + ' 次（' + r.log.filter(function (x) { return /掉/.test(x); }).join('、') + '）');
    // D) 每塊壓板都被踩過、每道門都開過
    r.state.duo.locks.forEach(function (l, i) {
      if (l.kind === 'gate' || l.kind === 'bridge') return;    // 會關回去的，看 C 的步驟條件就有驗到開過
      if (!l.latched) issues.push(pair[0] + '：第 ' + (i + 1) + ' 道（' + l.kind + '）走完還沒打開');
    });
  });

  // ── E) 地圖地點與 KINDS ──
  ['duoTwins', 'duoMaze'].forEach(function (k) {
    const K = Encounter.KINDS[k];
    if (!K || !K.duo || !Duo.LAYOUTS[K.duo]) issues.push('Encounter.KINDS.' + k + ' 缺 duo 設定');
    const sp = WorldMap.specials.filter(function (s) { return s.def.port === k; })[0];
    if (!sp) issues.push('大地圖上找不到 ' + k + ' 的地點');
    else if (!sp.def.duo || !/需雙人/.test(sp.def.prompt)) issues.push(k + ' 的地點沒有標「需雙人」');
  });

  report.issues = issues;
  return report;
}
