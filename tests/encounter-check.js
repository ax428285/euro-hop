/**
 * 海上遭遇戰檢查（v1.8：小遊戲版）。在瀏覽器執行 runEncounterCheck()（node 也能跑）。
 *
 *   A) 地圖上的怪生在開闊海面上，遊蕩後也不會跑上岸
 *   B) 每個小遊戲：照規則玩的機器人打得贏，而且在時限內
 *   C) 每個小遊戲：站著不動會輸（不然就不是挑戰）
 *   D) 艦砲對決：砲口擺動的範圍裡一定有「打得中」的角度
 *   E) 稀有怪有 EXP、時裝表不是空的
 */
function runEncounterCheck() {
  const issues = [];
  const ship = Voyage.shipPos();

  // ── A) ──
  Encounter.clear();
  for (let i = 0; i < 30; i++) {
    const m = Encounter.spawn(ship, 0, i % 2 ? 'golden' : 'gulls');
    if (m && !Voyage.isNavigable(m.x, m.y)) issues.push(m.def.name + ' 生在不能航行的地方');
    if (m) Encounter.remove(m);
  }
  const wander = ['pirates', 'serpent', 'golden'].map(function (k) { return Encounter.spawn(ship, 0, k); }).filter(Boolean);
  for (let f = 0; f < 600; f++) Encounter.updateMap({ x: -999, y: -999 }, 0);
  wander.forEach(function (m) {
    if (Encounter.monsters().indexOf(m) >= 0 && !Voyage.isNavigable(m.x, m.y)) issues.push(m.def.name + ' 遊蕩後跑上岸');
  });
  Encounter.clear();

  // ── D) ──
  let anyHit = false;
  for (let a = Encounter.CANNON.angMin; a <= Encounter.CANNON.angMax; a += 0.5) if (Encounter.shotHits(a)) anyHit = true;
  if (!anyHit) issues.push('艦砲對決：砲口擺動範圍內沒有任何角度打得中海盜船');

  /** 跑一場小遊戲。think(st, held, f) 決定按鍵；回傳 { won, frames, hurt } */
  function play(kind, think) {
    const m = { kind: kind, def: Encounter.KINDS[kind], x: 0, y: 0 };
    const stats = Equipment.resolve([]);
    const def = Encounter.makeDef(m, stats);
    const st = buildLevelState(def, -1, [], stats);
    const p = st.player;
    let held = {}, press = {};
    const input = {
      isDown: function (a) { return !!held[a]; },
      once: function (a) { return !!press[a]; },
      endFrame: function () {}
    };
    let hurt = 0;
    for (let f = 0; f < def.duration + 120; f++) {
      held = {}; press = {};
      think(st, held, press, f);
      updateShots(st);
      const evs = updatePlayer(st, input, f);
      Encounter.updateSkirmish(st, input).forEach(function (e) { evs.push(e.replace(/^p\d:/, '')); });
      if (evs.indexOf('hurt') >= 0) hurt++;
      if (evs.indexOf('clear') >= 0) return { won: true, frames: f, hurt: hurt };
      if (evs.indexOf('minifail') >= 0) return { won: false, frames: f, hurt: hurt, why: 'fail' };
      if (p.y > 600) { p.y = 300; p.x = 300; p.vy = 0; }
    }
    return { won: false, frames: -1, hurt: hurt, why: 'timeout' };
  }

  function moveTo(p, held, x, tol) {
    const cx = p.x + p.w / 2;
    if (x - cx > (tol || 6)) held.right = true;
    else if (cx - x > (tol || 6)) held.left = true;
  }

  const bots = {
    // 守護午餐：衝向離籃子最近的那隻海鷗，牠在頭上就跳
    gulls: function (st, held, press) {
      const p = st.player, mini = st.mini;
      if (!mini) return;
      const diving = mini.gulls.filter(function (g) { return g.mode !== 'flee'; });
      if (!diving.length) { moveTo(p, held, 480); return; }
      const g = diving.reduce(function (a, b) { return Math.abs(a.x - 470) < Math.abs(b.x - 470) ? a : b; });
      moveTo(p, held, g.x + g.w / 2, 8);
      if (p.onGround && Math.abs(g.x + g.w / 2 - (p.x + p.w / 2)) < 60 && g.y + g.h < p.y) { press.jump = true; held.jump = true; }
      if (!p.onGround) held.jump = true;
    },
    // 艦砲對決：站在砲旁，綠燈才開砲；有砲彈要落在附近就先躲開
    pirates: function (st, held, press, f) {
      const p = st.player, mini = st.mini;
      if (!mini) return;
      const danger = mini.shells.filter(function (s) { return s.fuse > 0 && s.fuse < 55; })
        .some(function (s) { return Math.abs(s.x - (p.x + p.w / 2)) < 50; });
      if (danger) { moveTo(p, held, Encounter.CANNON.x - 140, 4); return; }
      moveTo(p, held, Encounter.CANNON.x, 10);
      if (Encounter.shotHits(Encounter.cannonAngle(mini.elapsed + 1), Encounter.shipX(mini.elapsed + 60))) press.attack = true;
    },
    // 打地鼠：跑到冒出來的蛇頭旁邊跳起來踩
    serpent: function (st, held, press) {
      const p = st.player, mini = st.mini;
      if (!mini) return;
      const up = mini.heads.filter(function (h) { return h.up && h.box && h.box.h > 30; });
      if (!up.length) return;
      const h = up.reduce(function (a, b) { return Math.abs(a.x - p.x) < Math.abs(b.x - p.x) ? a : b; });
      // 口水飛過來就先跳起來閃（真人也會）
      const spit = st.shots.some(function (s) { return Math.abs(s.x - (p.x + p.w / 2)) < 70 && s.y > p.y - 10 && s.y < p.y + p.h + 10; });
      if (spit && p.onGround) { press.jump = true; held.jump = true; return; }
      moveTo(p, held, h.x, 4);
      if (p.onGround && Math.abs(h.x - (p.x + p.w / 2)) < 40) { press.jump = true; held.jump = true; }
      if (!p.onGround && p.vy < 0) held.jump = true;
    },
    // 捕捉：追著黃金海馬跑，牠在上面就跳
    golden: function (st, held, press) {
      const p = st.player, mini = st.mini;
      if (!mini) return;
      moveTo(p, held, mini.px, 6);
      if (p.onGround && mini.py < p.y && Math.abs(mini.px - (p.x + p.w / 2)) < 80) { press.jump = true; held.jump = true; }
      if (!p.onGround && p.vy < 0) held.jump = true;
    }
  };

  const report = {};
  Object.keys(bots).forEach(function (kind) {
    const k = Encounter.KINDS[kind];
    // B) 會玩的機器人要贏
    const r = play(kind, bots[kind]);
    report[kind] = r;
    if (!r.won) issues.push(k.game + '（' + k.name + '）：照規則玩的機器人打不贏（' + r.why + '，受傷 ' + r.hurt + '）');
    else if (r.hurt >= 3) issues.push(k.game + '：機器人贏了但受傷 ' + r.hurt + ' 次，可能太難');
    // C) 站著不動要輸
    const idle = play(kind, function () {});
    if (idle.won) issues.push(k.game + '：站著不動也會贏，沒有挑戰性');
    // E)
    if (!(k.exp > 0)) issues.push(k.name + ' 沒有 EXP');
  });
  /*
   * 守護午餐：「反應慢一點的玩家」也要贏得了。
   * 由來：玩家回報「我跳起來要踩海鷗，對方就搶走麵包了」—— 完美機器人贏不代表真人贏得了。
   * 這個機器人每 12 帧才重新決定一次（約 0.2 秒反應時間），而且只會去攔「正在盤旋」的海鷗。
   */
  (function () {
    let plan = null, last = -99;
    const slow = play('gulls', function (st, held, press, f) {
      const p = st.player, mini = st.mini;
      if (!mini) return;
      if (f - last >= 12) {
        last = f;
        const hov = mini.gulls.filter(function (g) { return g.mode === 'hover' || g.mode === 'dive'; });
        plan = hov.length ? hov.reduce(function (a, b) { return Math.abs(a.x - p.x) < Math.abs(b.x - p.x) ? a : b; }) : null;
      }
      if (!plan || plan.mode === 'flee') { moveTo(p, held, 480); return; }
      moveTo(p, held, plan.x + plan.w / 2, 10);
      if (p.onGround && Math.abs(plan.x + plan.w / 2 - (p.x + p.w / 2)) < 40) { press.jump = true; held.jump = true; }
      if (!p.onGround) held.jump = true;
    });
    report.gullsSlow = slow;
    if (!slow.won) issues.push('守護午餐：反應慢一點的玩家打不贏（太難）');
  })();

  if (!Costumes.count) issues.push('時裝表是空的，稀有怪沒東西可以掉');

  return { issueCount: issues.length, issues: issues, report: report };
}
