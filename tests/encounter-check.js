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
  // v1.30：漩渦逃生掉進漩渦眼會直接沉到冥界（quest-check 驗）→ 這裡驗「一般的漩渦逃生」，先把冥界入口關掉、跑完還原
  const flags = Save.get().flags, lokiWas = flags.loki;
  flags.loki = 1;
  const helWas = Quests.helReady;
  Quests.helReady = function () { return false; };

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
      if (Encounter.shotHits(Encounter.cannonAngle(mini.elapsed + 1), Encounter.shipX(mini.elapsed + 60))) press.throw = true;
    },
    // 拍拍頭：跑到冒出來的海獺旁邊跳起來拍（v1.26.1 前是海蛇）
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
    // 斯庫拉（魔王）：浪來了就跳、紅圈罩著自己就閃開、頭卡在甲板上就跑過去踩
    scylla: function (st, held, press) {
      const p = st.player, mini = st.mini;
      if (!mini) return;
      const cx = p.x + p.w / 2;
      if (!p.onGround && p.vy < 0) held.jump = true;
      const wave = mini.waves.filter(function (w) { return w.warn <= 0 && (w.x - cx) * w.dir < 0 && Math.abs(w.x - cx) < 70; })[0];
      if (wave) { if (p.onGround) { press.jump = true; held.jump = true; } return; }
      const aim = mini.heads.filter(function (h) { return h.alive && h.state === 'aim' && Math.abs(h.tx - cx) < 95; })[0];
      if (aim) {
        const away = aim.tx + (cx < aim.tx ? -140 : 140);
        moveTo(p, held, away < 40 ? aim.tx + 140 : away > 920 ? aim.tx - 140 : away, 4);
        return;
      }
      const stuck = mini.heads.filter(function (h) { return h.alive && h.state === 'stuck' && h.t < 105; })[0];
      if (stuck) {
        moveTo(p, held, stuck.x, 6);
        if (p.onGround && Math.abs(stuck.x - cx) < 46) { press.jump = true; held.jump = true; }
      }
    },
    // 漩渦逃生（v1.27）：往救生圈走、在它底下跳起來抓；木桶滾過來就跳；別被拖進中間的漩渦眼
    charybdis: function (st, held, press) {
      const p = st.player, mini = st.mini;
      if (!mini) return;
      const cx = p.x + p.w / 2;
      if (!p.onGround && p.vy < 0) held.jump = true;
      const junk = mini.junk.filter(function (j) { return (j.x + 14 - cx) * j.dir < 0 && Math.abs(j.x + 14 - cx) < 70; })[0];
      if (junk && p.onGround) { press.jump = true; held.jump = true; }
      const tx = mini.buoy ? mini.buoy.x : 150;
      // 漩渦眼兩側的邊緣不能站（會被拖下去）：目標在另一邊時，跳過去
      moveTo(p, held, tx, 6);
      const eyeL = 400, eyeR = 560;
      const crossing = (cx < eyeL && tx > eyeR) || (cx > eyeR && tx < eyeL);
      if (crossing && p.onGround && (Math.abs(cx - eyeL) < 40 || Math.abs(cx - eyeR) < 40)) { press.jump = true; held.jump = true; }
      if (mini.buoy && p.onGround && Math.abs(mini.buoy.x - cx) < 30) { press.jump = true; held.jump = true; }
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

  /*
   * I) 安提基特拉沉船（v1.26 港口 A）：潛水關、三件寶物不在「直直往右游」的路線上、
   *    一直往右游（偶爾划水）一分鐘多到得了終點、不會嗆水。
   */
  (function () {
    const m = { kind: 'wreck', def: Encounter.KINDS.wreck, x: 0, y: 0 };
    const def = Encounter.makeDef(m, Equipment.resolve([]));
    if (!def.underwater) issues.push('沉船不是潛水關');
    const rel = (def.features || []).filter(function (f) { return f.type === 'relic'; });
    if (rel.length !== 3) issues.push('沉船寶物應該 3 件，有 ' + rel.length + ' 件');
    const st = buildLevelState(def, -1, [], Equipment.resolve([]));
    st.enemies = [];
    const p = st.player;
    let press = false, lastX = 0, stuck = 0, drown = 0, got = 0, f;
    const input = { isDown: function (a) { return a === 'right' || a === 'jump'; },
                    once: function (a) { return a === 'jump' && press; }, endFrame: function () {} };
    for (f = 0; f < 9000 && p.x + p.w < def.goal; f++) {
      press = f % 14 === 0 && (p.y > 280 || stuck > 8);
      updateMovers(st.movers, f);
      updatePlayer(st, input, f).concat(Features.update(st, f)).forEach(function (e) {
        if (/drown$/.test(e)) drown++;
        if (/relic:/.test(e)) got++;
      });
      if (p.y > 600) p.y = 200;
      stuck = Math.abs(p.x - lastX) < 0.5 ? stuck + 1 : 0; lastX = p.x;
    }
    report.wreck = { secs: Math.round(f / 60), drown: drown, relicsOnTheWay: got };
    if (p.x + p.w < def.goal) issues.push('沉船：一直往右游到不了終點');
    if (drown) issues.push('沉船：照路線游也會嗆水 ' + drown + ' 次');
    if (f < 60 * 45) issues.push('沉船：直直游 ' + Math.round(f / 60) + ' 秒就到底，太短');
    if (got >= 3) issues.push('沉船：一路往右游就把三件寶物全撿到了，不用找');
  })();

  /*
   * K) 貿易與懸賞（v1.27）：每樣貨在產地買得到、別處買不到；
   *    跑到別的港口賣，30 天裡大部分日子要有賺頭（不然沒人想跑貿易）；每天三張不同的懸賞。
   */
  (function () {
    Trade.GOODS.forEach(function (g) {
      let profitable = 0;
      for (let d = 0; d < 30; d++) {
        const home = Trade.price(g.home, g.id, d);
        if (home.buy == null) { issues.push('貿易：' + g.name + ' 在產地買不到'); return; }
        const best = Math.max.apply(null, Trade.PORTS.filter(function (p) { return p.id !== g.home; })
          .map(function (p) {
            const pr = Trade.price(p.id, g.id, d);
            if (pr.buy != null) issues.push('貿易：' + g.name + ' 在非產地 ' + p.name + ' 也買得到');
            return pr.sell;
          }));
        if (best > home.buy) profitable++;
      }
      if (profitable < 25) issues.push('貿易：' + g.name + ' 30 天裡只有 ' + profitable + ' 天有賺頭');
    });
    for (let d = 0; d < 10; d++) {
      const os = Trade.offers(d, 0);
      const types = os.map(function (o) { return o.type; });
      if (os.length !== 3 || new Set(types).size !== 3) issues.push('懸賞：第 ' + d + ' 天的委託不是三張不同的（' + types.join(',') + '）');
    }
    if (Trade.capacity(Shipyard.blank()) !== 3) issues.push('貿易：船艙預設應該 3 箱');
  })();

  // J) 造船廠（v1.26 港口 B）：價錢、滿級、船首砲裝填、船身愛心
  (function () {
    let s = Shipyard.blank();
    if (Shipyard.priceOf('sail', s) !== Shipyard.item('sail').prices[0]) issues.push('造船廠：船帆第一級價錢不對');
    for (let k = 0; k < 5; k++) s = Shipyard.buy('sail', s);
    if (s.sail !== Shipyard.item('sail').max || Shipyard.priceOf('sail', s) !== null) issues.push('造船廠：船帆滿級後還能買');
    if (!(Shipyard.seaSpeed(s) > 1.3)) issues.push('造船廠：滿級船帆沒有變快');
    const c2 = Shipyard.buy('cannon', Shipyard.buy('cannon', Shipyard.blank()));
    if (!(Shipyard.cannonCd(c2) < Shipyard.cannonCd(Shipyard.blank())) || !Shipyard.cannonHead(c2)) issues.push('造船廠：滿級船首砲沒有效果');
    const p1 = Shipyard.buy('paint', Shipyard.blank(), 'navy');
    if (p1.paint !== 'navy' || Shipyard.priceOf('paint', p1, 'navy') !== 0) issues.push('造船廠：買過的油漆應該免費換回');
  })();

  /*
   * H) 亞特蘭提斯潛水關（v1.23.1）：
   *   一直往右游、偶爾划水的機器人要能潛到終點、不會嗆水；
   *   原地不動要會嗆水（空氣系統真的有作用）；地圖上的入口在開闊海面上。
   */
  (function () {
    const m = Encounter.boss('atlantis');
    if (!m) { issues.push('地圖上找不到亞特蘭提斯'); return; }
    if (!Voyage.isNavigable(m.x, m.y)) issues.push('亞特蘭提斯的入口不在能航行的海面上');
    const def = Encounter.makeDef(m, Equipment.resolve([]));
    // v1.24.2 改成往下潛的豎井（潛到底由 shaft-check 的機器人驗）；這裡驗設定與空氣系統
    if (!def.underwater || def.layout !== 'shaft') issues.push('亞特蘭提斯應該是往下潛的潛水豎井');
    const vents = (def.features || []).filter(function (f) { return f.type === 'vent'; });
    if (vents.length < 4) issues.push('亞特蘭提斯的氣泡噴口太少（' + vents.length + ' 個）');
    const st = buildLevelState(def, -1, [], Equipment.resolve([]));
    const p = st.player;
    let drown = 0;
    for (let f = 0; f < Features.AIR_MAX + 30; f++) {
      p.x = 40; p.y = 100;     // 待在井外的角落，碰不到任何噴口
      Features.update(st, f).forEach(function (e) { if (/drown$/.test(e)) drown++; });
    }
    if (!drown) issues.push('潛水關：一直沒補氣也不會嗆水，空氣系統沒作用');
  })();

  flags.loki = lokiWas;
  Quests.helReady = helWas;
  return { issueCount: issues.length, issues: issues, report: report };
}
