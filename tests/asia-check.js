/**
 * v1.32.1 亞洲篇（第一批：伊朗、烏茲別克）檢查。在瀏覽器執行 runAsiaCheck()。
 *
 *   A) 亞洲地圖：useWorld('as') 有伊朗、烏茲別克的圖釘（在陸地上），而且只出現在亞洲地圖、不在歐洲地圖
 *   B) 絲路：歐洲地圖在土耳其一直往東走，走到底會回報 silkEast；亞洲地圖一直往西走回報 silkWest
 *   C) 絲路還沒開通時過不去；開通後過得去、落腳點在亞洲的陸地上；往西走回到歐洲
 *   D) 亞洲的關卡「金幣」是蠶繭：入帳到 Save.flag('cocoons')，不進錢包
 *   E) 招牌機制：伊朗有氣流、宣禮塔、整關坐飛毯；烏茲別克有駱駝商隊，盜賊撞到駱駝會扣貨、扣光扣一條命
 *   v1.33 第二批：
 *   F) 印度、尼泊爾、中國、蒙古在亞洲地圖上；中國、蒙古是東亞（gate easia），亞洲 EXP 夠了才解鎖
 *   G) 印度：騎大象才撞得開路障；尼泊爾：氧氣會掉、帳篷補滿、用完扣命；中國：烽火全點燃關門才開、箭雨會痛；蒙古：射中箭靶
 *   H) 亞洲的海上冒險：四種都生得出來、跑得動；龍舟照鼓點打會贏、不打會輸；香料接得到
 *   I) 玄奘的委託：接下 → 經書送到大雁塔 → 稱號「取經人」、亞洲 EXP；玄奘、大雁塔、馬可波羅都在陸地上
 *   v1.33.1：
 *   J) 亞洲地圖上有三隻海上魔王（大鵬、龍王、八岐大蛇）和東方艦隊三艘戰艦，都在海上；南海海盜船會出現
 *   K) 三隻魔王都打得倒（照牠們的破綻踩），時間到會輸；東方艦隊的海戰給亞洲 EXP
 * 會暫時改存檔，結束前還原。
 */
function runAsiaCheck() {
  const issues = [];
  const sv = Save.get(), keep = JSON.stringify(sv);
  const startWorld = WorldMap.world();
  const cur0 = Game.debug.getCursor();       // 測試會進亞洲的關卡、換地圖，結束前把地圖游標放回來（不然世界之謎會打開亞洲的那一頁）
  const AS = Levels.list.map(function (lv, i) { return lv.region === 'asia' ? i : -1; }).filter(function (i) { return i >= 0; });
  try {
    if (AS.length < 2) issues.push('亞洲的關卡少於 2 關（' + AS.length + '）');
    if (AS[0] !== Levels.list.length - AS.length) issues.push('亞洲的關卡沒有接在關卡清單的最後面');

    // ── A) 地圖 ──
    WorldMap.useWorld('as'); Voyage.rebuild();
    ['IR', 'UZ'].forEach(function (id) {
      const n = WorldMap.nations.filter(function (q) { return Levels.list[q.idx].id === id; })[0];
      if (!n) { issues.push('亞洲地圖上沒有 ' + id); return; }
      if (!Voyage.isLand(n.pin[0], n.pin[1])) issues.push(id + ' 的圖釘不在陸地上');
    });
    if (WorldMap.nations.some(function (n) { return Levels.list[n.idx].region !== 'asia'; })) issues.push('亞洲地圖上出現了別洲的國家');
    // ── B) 往西走到底 ──
    (function () {
      const p = WorldMap.project(46.2, 38.2);
      let at = null;
      for (let r = 0; r <= 120 && !at; r += 6) for (let k = 0; k < 16 && !at; k++) {
        const x = p[0] + Math.cos(k * Math.PI / 8) * r, y = p[1] + Math.sin(k * Math.PI / 8) * r;
        if (Voyage.isLand(x, y)) at = { x: x, y: y };
      }
      if (!at) { issues.push('亞洲：絲路的入口附近沒有陸地'); return; }
      Voyage.placeShip(at.x, at.y);
      const inp = { isDown: function (a) { return a === 'left'; }, once: function () { return false; } };
      let hit = false;
      for (let f = 0; f < 900 && !hit; f++) hit = Voyage.update(inp).indexOf('silkWest') >= 0;
      if (!hit) issues.push('亞洲：從入口一直往西走，到不了地圖西邊（回不了歐洲）');
    })();
    WorldMap.useWorld('eu'); Voyage.rebuild();
    if (WorldMap.nations.some(function (n) { return Levels.list[n.idx].region === 'asia'; })) issues.push('歐洲地圖上出現了亞洲的國家');
    // ── B) 往東走到底 ──
    (function () {
      const p = WorldMap.project(43.4, 39.4);
      let at = null;
      for (let r = 0; r <= 120 && !at; r += 6) for (let k = 0; k < 16 && !at; k++) {
        const x = p[0] + Math.cos(k * Math.PI / 8) * r, y = p[1] + Math.sin(k * Math.PI / 8) * r;
        if (Voyage.isLand(x, y)) at = { x: x, y: y };
      }
      if (!at) { issues.push('歐洲：土耳其東邊沒有陸地'); return; }
      Voyage.placeShip(at.x - 30, at.y);
      const inp = { isDown: function (a) { return a === 'right'; }, once: function () { return false; } };
      let hit = false;
      for (let f = 0; f < 900 && !hit; f++) hit = Voyage.update(inp).indexOf('silkEast') >= 0;
      if (!hit) issues.push('歐洲：在土耳其一直往東走，沒有回報 silkEast（去不了亞洲）');
    })();

    // ── C) 開通條件（照真的地圖流程走：Game 的地圖畫面收到 silkEast） ──
    if (typeof Game.debug.crossSilk === 'function') {
      sv.flags.silkRoad = 0;
      Game.debug.setScene('map');
      Game.debug.crossSilk('as');
      if (WorldMap.world() !== 'eu') issues.push('絲路還沒開通，就走進亞洲了');
      sv.flags.silkRoad = 1;
      Game.debug.crossSilk('as');
      if (WorldMap.world() !== 'as') issues.push('絲路開通了，還是走不進亞洲');
      else if (!Voyage.isLand(Voyage.shipPos().x, Voyage.shipPos().y)) issues.push('走進亞洲的落腳點不在陸地上');
      Game.debug.crossSilk('eu');
      if (WorldMap.world() !== 'eu') issues.push('從亞洲往西走，沒有回到歐洲');
    } else issues.push('Game.debug.crossSilk 不見了');

    // ── D) 蠶繭 ──
    sv.flags.cocoons = 0;
    const w0 = sv.wallet;
    Game.debug.enter(AS[0]);
    if (Game.harvestKind() !== 'cocoon') issues.push('亞洲的關卡「金幣」不是蠶繭（' + Game.harvestKind() + '）');
    if (typeof Sprites.cocoon !== 'function') issues.push('沒有蠶繭的畫法');
    if (typeof Game.debug.bank === 'function') {
      Game.debug.bank(7);
      if (Save.flag('cocoons') !== 7 || sv.wallet !== w0) issues.push('蠶繭沒有入帳到 cocoons（cocoons ' + Save.flag('cocoons') + '、錢包 ' + (sv.wallet - w0) + '）');
    }

    // ── E) 招牌機制 ──
    const IR = Levels.list.filter(function (l) { return l.id === 'IR'; })[0];
    const UZ = Levels.list.filter(function (l) { return l.id === 'UZ'; })[0];
    const fsIR = Features.makeState(IR).list;
    if (!IR.carpet) issues.push('伊朗沒有坐飛毯');
    if (fsIR.filter(function (f) { return f.type === 'wind'; }).length < 3) issues.push('伊朗的氣流少於 3 段');
    if (fsIR.filter(function (f) { return f.type === 'minaret'; }).length < 3) issues.push('伊朗的宣禮塔少於 3 座');
    fsIR.filter(function (f) { return f.type === 'minaret'; }).forEach(function (f) {
      if (f.h + 26 > 210) issues.push('伊朗的宣禮塔太高（' + (f.h + 26) + '），飛毯飛不過去');
    });
    const fsUZ = Features.makeState(UZ);
    const ct = fsUZ.list.filter(function (f) { return f.type === 'camelTrain'; })[0];
    if (!ct) issues.push('烏茲別克沒有駱駝商隊');
    else {
      // 模擬：玩家往右走一段，駱駝跟在後面；放一個盜賊撞上駱駝
      const p = { x: 300, y: Levels.GROUND_Y - 30, w: 22, h: 30, vx: 0, vy: 0, stats: {}, pid: 0, invuln: 0 };
      const st = { def: UZ, players: [p], features: fsUZ, particles: [], enemies: [], shots: [] };
      for (let f = 0; f < 120; f++) { p.x += 2; Features.update(st, f); }
      if (!ct.box) issues.push('駱駝沒有跟在玩家後面');
      else {
        if (ct.box.x >= p.x) issues.push('駱駝沒有走在玩家後面');
        let lost = 0;
        for (let k = 0; k < SilkRoad.CAMEL_HP; k++) {
          const e = makeEnemy({ type: 'walker', x: ct.box.x + 10, y: ct.box.y + ct.box.h - 26, left: 0, right: 9999 });
          e.bandit = true; st.enemies.push(e);
          const ev = Features.update(st, 200 + k);
          if (ev.indexOf('p0:caravanLost') >= 0) lost++;
          if (e.alive) issues.push('盜賊撞到駱駝後沒有消失');
        }
        if (lost !== 1) issues.push('駱駝被撞 ' + SilkRoad.CAMEL_HP + ' 次，應該扣一條命（caravanLost ' + lost + ' 次）');
        if (ct.hp !== SilkRoad.CAMEL_HP) issues.push('貨被搶光後駱駝沒有重新裝貨（剩 ' + ct.hp + '）');
      }
    }
    ['IR', 'UZ'].forEach(function (id) {
      if (!Sprites.skylines[id]) issues.push(id + ' 沒有遠景');
      if (!Sprites.countryEnemies[id]) issues.push(id + ' 沒有自己的敵人長相');
      if (!Music.tracks[id]) issues.push(id + ' 沒有曲子');
      if (!Mystery.CLUES[id]) issues.push(id + ' 沒有亞洲之謎的線索');
    });
    if (!Music.tracks.ASMAP) issues.push('亞洲大地圖沒有曲子');

    // ── F) 第二批的國家 ──
    const B2 = ['IN', 'NP', 'CN', 'MN'];
    WorldMap.useWorld('as'); Voyage.rebuild();
    B2.forEach(function (id) {
      const lv = Levels.list.filter(function (l) { return l.id === id; })[0];
      if (!lv) { issues.push('沒有 ' + id + ' 這一關'); return; }
      const n = WorldMap.nations.filter(function (q) { return Levels.list[q.idx].id === id; })[0];
      if (!n) issues.push('亞洲地圖上沒有 ' + id);
      else if (!Voyage.isLand(n.pin[0], n.pin[1])) issues.push(id + ' 的圖釘不在陸地上');
      if ((id === 'CN' || id === 'MN') !== (lv.gate === 'easia')) issues.push(id + ' 的東亞門檻（gate easia）不對');
      if (!Music.tracks[id]) issues.push(id + ' 沒有曲子');
      if (!Mystery.CLUES[id]) issues.push(id + ' 沒有亞洲之謎的線索');
      if (!Souvenirs.forLevel(Levels.list.indexOf(lv))) issues.push(id + ' 沒有紀念品');
      if (id !== 'MN' && !Sprites.skylines[id]) issues.push(id + ' 沒有遠景');
    });
    // 地圖上的劇情人物
    ['xuanzang', 'goose', 'marco'].forEach(function (npc) {
      const s = WorldMap.specials.filter(function (q) { return q.def.npc === npc; })[0];
      if (!s) issues.push('亞洲地圖上沒有 ' + npc);
      else if (!Voyage.isLand(s.pin[0], s.pin[1])) issues.push(npc + ' 不在陸地上');
    });
    WorldMap.useWorld('eu'); Voyage.rebuild();
    sv.flags.silkRoad = 1;
    sv.expAs = Encounter.EASIA_EXP - 1;
    if (Encounter.regionUnlocked('easia')) issues.push('亞洲 EXP 不夠，東亞就解鎖了');
    sv.expAs = Encounter.EASIA_EXP;
    if (!Encounter.regionUnlocked('easia')) issues.push('亞洲 EXP 夠了，東亞還鎖著');

    // ── G) 招牌機制 ──
    function lvOf(id) { return Levels.list.filter(function (l) { return l.id === id; })[0]; }
    function mkState(def) {
      const p = { x: 100, y: Levels.GROUND_Y - 30, w: 22, h: 30, vx: 0, vy: 0, stats: {}, pid: 0, invuln: 0, onGround: true, facing: 1 };
      return { def: def, players: [p], player: p, features: Features.makeState(def), particles: [], enemies: [], shots: [] };
    }
    // 印度
    (function () {
      const def = lvOf('IN'), st = mkState(def), p = st.player, L = st.features.list;
      const eles = L.filter(function (f) { return f.type === 'mount' && f.kind === 'elephant'; });
      const bars = L.filter(function (f) { return f.type === 'barricade'; });
      if (eles.length < 2) issues.push('印度的大象少於 2 隻（' + eles.length + '）');
      if (bars.length < 4) issues.push('印度的路障少於 4 個（' + bars.length + '）');
      if (!bars.length || !eles.length) return;
      if (bars.some(function (b) { return b.x < eles[0].x; })) issues.push('印度：第一隻大象前面就有路障');
      const b = bars[0];
      if (!Features.solids(st).some(function (s) { return s.x === b.x && s.h === b.h; })) issues.push('印度的路障不是實心的');
      // 沒騎大象貼著推：不會倒
      p.x = b.x - p.w; p.y = b.y - p.h;
      for (let k = 0; k < 30; k++) Features.update(st, k);
      if (b.broken) issues.push('沒騎大象也撞得開路障');
      // 騎著大象衝過去：撞開
      p.mount = { kind: 'elephant', from: eles[0], lift: 34 };
      p.x = b.x - p.w - 30;
      const ev = Features.update(st, 40);
      if (!b.broken || ev.indexOf('barricade:smash') < 0) issues.push('騎著大象撞不開路障');
      if (Features.solids(st).some(function (s) { return s.x === b.x && s.h === b.h; })) issues.push('撞開的路障還是實心的');
    })();
    // 尼泊爾
    (function () {
      const def = lvOf('NP'), st = mkState(def), p = st.player, L = st.features.list;
      const sts = L.filter(function (f) { return f.type === 'o2station'; });
      if (sts.length < 3) issues.push('尼泊爾的氧氣補給站少於 3 個（' + sts.length + '）');
      for (let k = 1; k < sts.length; k++) if (sts[k].x - sts[k - 1].x > 2000) issues.push('尼泊爾的補給站隔太遠（' + Math.round(sts[k].x - sts[k - 1].x) + '）');
      p.x = 300;
      Features.update(st, 0);
      const o0 = p.o2;
      for (let k = 0; k < 60; k++) Features.update(st, k);
      if (!(p.o2 < o0)) issues.push('尼泊爾的氧氣不會掉');
      if (sts[0]) {
        const box = SilkRoad.stationBox(sts[0]);
        p.x = box.x + 10; p.y = box.y + box.h - p.h;
        for (let k = 0; k < 60; k++) Features.update(st, k);
        if (p.o2 !== SilkRoad.O2_MAX) issues.push('走進補給站氧氣沒有補滿');
      }
      p.x = 300; p.y = Levels.GROUND_Y - p.h; p.o2 = 2;
      let lost = false;
      for (let k = 0; k < 4; k++) if (Features.update(st, k).indexOf('p0:hypoxia') >= 0) lost = true;
      if (!lost) issues.push('氧氣用完沒有扣命（hypoxia）');
    })();
    // 中國
    (function () {
      const def = lvOf('CN'), st = mkState(def), p = st.player, L = st.features.list;
      const bs = L.filter(function (f) { return f.type === 'beacon'; });
      const gate = L.filter(function (f) { return f.type === 'beaconGate'; })[0];
      if (bs.length !== 5) issues.push('長城的烽火台不是 5 座（' + bs.length + '）');
      if (!gate) { issues.push('長城沒有終點前的關門'); return; }
      if (!(gate.x < def.goal && gate.x > def.goal - 400)) issues.push('長城的關門不在終點前');
      if (!Features.solids(st).some(function (s) { return s.x === gate.x; })) issues.push('烽火沒點，關門卻是開的');
      // 站在地上碰不到火盆；跳起來碰得到
      p.x = bs[0].x + 20; p.y = bs[0].y - p.h;
      Features.update(st, 0);
      if (bs[0].lit) issues.push('站在地上就點著烽火了（應該要跳）');
      bs.forEach(function (b, k) {
        const fb = SilkRoad.fireBox(b);
        p.x = fb.x + 4; p.y = fb.y + 10;
        Features.update(st, k + 1);
        if (!b.lit) issues.push('跳起來碰到火盆，烽火台 ' + (k + 1) + ' 沒點著');
      });
      p.x = 100; p.y = Levels.GROUND_Y - p.h;
      Features.update(st, 10); Features.update(st, 11);
      if (!gate.open || Features.solids(st).some(function (s) { return s.x === gate.x; })) issues.push('烽火全點了，關門沒有打開');
      // 箭雨：紅圈落下來會痛
      const v = L.filter(function (f) { return f.type === 'volley'; })[0];
      if (!v) issues.push('長城沒有箭雨');
      else {
        p.x = 2000; p.y = Levels.GROUND_Y - p.h; p.invuln = 0;
        v.marks = [{ x: p.x + p.w / 2, y: Levels.GROUND_Y, t: 1 }];
        const ev = Features.update(st, 20);
        if (ev.indexOf('p0:hurt') < 0) issues.push('箭雨落在身上不會痛');
      }
    })();
    // 蒙古
    (function () {
      const li = Levels.list.findIndex(function (l) { return l.id === 'MN'; }), def = Levels.list[li];
      if (def.layout !== 'race' || def.race.theme !== 'steppe') { issues.push('蒙古不是騎馬射箭的賽道'); return; }
      const st = buildLevelState(def, li, [], Equipment.resolve([]));
      const rs = st.race, tg = def.race.extra.targets[0];
      rs.pos = (tg.seg - 20) * Race.SEG - Race.PLAYER_Z; rs.x = tg.x; rs.speed = def.race.maxSpeed;
      let shot = true, hit = false;
      const inp = { isDown: function () { return false; }, once: function (a) { if (a === 'throw' && shot) { shot = false; return true; } return false; } };
      for (let k = 0; k < 40; k++) { const ev = Race.update(st, inp, k); if (ev.indexOf('archery:hit') >= 0) hit = true; rs.x = tg.x; }
      if (!hit) issues.push('蒙古：對準箭靶射箭沒有射中');
      if (rs.hitN !== 1) issues.push('蒙古：射中的箭靶數不對（' + rs.hitN + '）');
      if (!def.race.segs.some(function (s) { return s.obs.some(function (o) { return o.kind === 'fence'; }); })) issues.push('蒙古的賽道上沒有圍欄');
    })();

    // ── H) 亞洲的海上冒險 ──
    ['spices', 'dragonboat', 'typhoon', 'goldkoi'].forEach(function (kind) {
      const k = Encounter.KINDS[kind];
      if (!k || !k.as) { issues.push('沒有亞洲的海上冒險 ' + kind); return; }
      const m = { kind: kind, def: k, x: 0, y: 0 };
      const def = Encounter.makeDef(m);
      if (!def.as || def.minigame !== kind || !(def.duration > 0)) issues.push(kind + '：關卡定義不對');
      const st = buildLevelState(def, -1, [], Equipment.resolve([]));
      try {
        for (let f = 0; f < 600; f++) { Encounter.updateSkirmish(st, { isDown: function () { return false; }, once: function () { return false; } }); }
        const cv = document.createElement('canvas'); cv.width = 960; cv.height = 480;
        Encounter.drawWorld(cv.getContext('2d'), st, 100); Encounter.drawHud(cv.getContext('2d'), st, 960);
      } catch (e) { issues.push(kind + ' 跑起來出錯：' + e.message); }
    });
    (function () {
      function race(press) {
        const k = Encounter.KINDS.dragonboat, def = Encounter.makeDef({ kind: 'dragonboat', def: k });
        const st = buildLevelState(def, -1, [], Equipment.resolve([]));
        let res = null;
        for (let f = 0; f < 60 * 60 && !res; f++) {
          const now = press && st.mini && (st.mini.elapsed + 1) % AsiaSea.BEAT === 0;
          const ev = Encounter.updateSkirmish(st, { isDown: function () { return false; }, once: function (a) { return a === 'throw' && now; } });
          if (ev.indexOf('clear') >= 0) res = 'win';
          if (ev.indexOf('minifail') >= 0) res = 'lose';
        }
        return res;
      }
      if (race(true) !== 'win') issues.push('龍舟：每一下都照鼓點打，還是輸了');
      if (race(false) !== 'lose') issues.push('龍舟：完全不打鼓也贏了');
    })();
    WorldMap.useWorld('as'); Voyage.rebuild();
    const sea = WorldMap.project(88, 14);          // 孟加拉灣
    Voyage.placeShip(sea[0], sea[1]);
    if (!Voyage.isNavigable(sea[0], sea[1])) issues.push('孟加拉灣不能航行？');
    const picked = {};
    for (let k = 0; k < 200; k++) {
      const m = Encounter.spawn(Voyage.shipPos(), 0);
      if (m) { picked[m.kind] = true; Encounter.remove(m); }
    }
    if (!picked.spices || Object.keys(picked).some(function (k) { return !Encounter.KINDS[k].as; })) issues.push('亞洲地圖上生出來的海上怪不對（' + Object.keys(picked).join('、') + '）');
    WorldMap.useWorld('eu'); Voyage.rebuild();

    // ── I) 玄奘的委託 ──
    sv.flags.sutra = 0; sv.flags.pilgrim = 0;
    const e0 = sv.expAs;
    let tk = Quests.talk('goose');
    if (tk.end) { tk.end(true); }
    if (Save.flag('pilgrim')) issues.push('沒帶經書就拿到「取經人」');
    tk = Quests.talk('xuanzang');
    if (!tk.end) issues.push('玄奘沒有給委託');
    else { tk.end(false); if (Save.flag('sutra')) issues.push('話沒聽完就接了委託'); tk.end(true); }
    if (Save.flag('sutra') !== 1) issues.push('接下玄奘的委託後沒有記成帶著經書');
    tk = Quests.talk('goose');
    if (tk.end) tk.end(true);
    if (Save.flag('sutra') !== 2 || !Save.flag('pilgrim')) issues.push('經書送到大雁塔沒有完成委託');
    if (sv.expAs !== e0 + AsiaQuest.SUTRA_EXP) issues.push('經書送到沒有加亞洲 EXP');
    tk = Quests.talk('marco');
    if (!tk || !tk.lines.length) issues.push('馬可波羅不會說話');

    // ── J) 亞洲地圖上的魔王、艦隊 ──
    WorldMap.useWorld('as'); Voyage.rebuild(); Encounter.clear();
    Encounter.updateMap(Voyage.shipPos(), 0);
    const mons = Encounter.monsters();
    ['roc', 'dragon', 'orochi', 'warDH', 'warZY', 'warAT'].forEach(function (k) {
      const m = mons.filter(function (q) { return q.kind === k; })[0];
      if (!m) issues.push('亞洲地圖上沒有 ' + k);
      else if (!Voyage.isNavigable(m.x, m.y)) issues.push(k + ' 不在海上');
    });
    if (mons.some(function (m) { return m.kind === 'scylla' || m.kind === 'warFR'; })) issues.push('歐洲的魔王、戰艦跑到亞洲地圖上了');
    const sea2 = WorldMap.project(88, 14); Voyage.placeShip(sea2[0], sea2[1]);
    let pir = false;
    for (let k = 0; k < 300 && !pir; k++) { const m = Encounter.spawn(Voyage.shipPos(), 0); if (m) { if (m.kind === 'asPirates') pir = true; Encounter.remove(m); } }
    if (!pir) issues.push('亞洲地圖上不會出現南海海盜船');
    Encounter.clear();
    WorldMap.useWorld('eu'); Voyage.rebuild();
    // 東方艦隊：海戰給亞洲 EXP
    (function () {
      const k = Encounter.KINDS.warZY, def = Encounter.makeDef({ kind: 'warZY', def: k, x: 0, y: 0 });
      if (def.minigame !== 'warship' || !def.as) issues.push('鄭一嫂的紅旗號不是給亞洲 EXP 的戰艦海戰');
      const st = buildLevelState(def, -1, [], Equipment.resolve([]));
      try {
        for (let f = 0; f < 300; f++) Encounter.updateSkirmish(st, { isDown: function () { return false; }, once: function () { return false; } });
        const cv = document.createElement('canvas'); cv.width = 960; cv.height = 480;
        ['warDH', 'warZY', 'warAT'].forEach(function (kk) {
          const d2 = Encounter.makeDef({ kind: kk, def: Encounter.KINDS[kk], x: 0, y: 0 });
          const s2 = buildLevelState(d2, -1, [], Equipment.resolve([]));
          Encounter.updateSkirmish(s2, { isDown: function () { return false; }, once: function () { return false; } });
          Encounter.drawWorld(cv.getContext('2d'), s2, 10);
        });
      } catch (e) { issues.push('東方艦隊的海戰出錯：' + e.message); }
    })();

    // ── K) 三隻魔王打得倒 ──
    const NOIN = { isDown: function () { return false; }, once: function () { return false; } };
    function bossRun(kind, act) {
      const k = Encounter.KINDS[kind], def = Encounter.makeDef({ kind: kind, def: k, x: 0, y: 0 });
      if (!def.as || !def.firstBoss && !Save.seaBossDown(kind)) issues.push(kind + '：魔王的定義不對（亞洲 EXP、第一次的獎勵）');
      const st = buildLevelState(def, -1, [], Equipment.resolve([]));
      const p = st.player;
      let res = null, f = 0;
      try {
        for (; f < def.duration + 10 && !res; f++) {
          p.invuln = 999;
          if (act && st.mini) act(st, st.mini, p);
          const ev = Encounter.updateSkirmish(st, NOIN);
          if (ev.indexOf('clear') >= 0) res = 'win';
          if (ev.indexOf('minifail') >= 0) res = 'lose';
        }
        const cv = document.createElement('canvas'); cv.width = 960; cv.height = 480;
        Encounter.drawWorld(cv.getContext('2d'), st, f); Encounter.drawHud(cv.getContext('2d'), st, 960);
      } catch (e) { issues.push(kind + ' 出錯：' + e.message); }
      return { res: res, frames: f };
    }
    const GYc = Levels.GROUND_Y;
    // 大鵬：停在甲板上時從頭上踩
    let r = bossRun('roc', function (st, mini, p) {
      if (mini.phase === 'perch' && mini.hurtT === 0) { p.x = mini.bx + mini.face * 34 - p.w / 2; p.y = GYc - 124 - p.h + 6; p.vy = 4; }
    });
    if (r.res !== 'win') issues.push('大鵬金翅鳥：照破綻踩也打不倒（' + r.res + '）');
    if (bossRun('roc').res !== 'lose') issues.push('大鵬金翅鳥：什麼都不做也不會輸');
    // 龍王：頭靠在甲板上時踩龍珠
    r = bossRun('dragon', function (st, mini, p) {
      if (mini.phase === 'rest' && mini.hurtT === 0) { p.x = mini.hx - p.w / 2; p.y = GYc - 76 - p.h + 6; p.vy = 4; }
    });
    if (r.res !== 'win') issues.push('東海龍王：照破綻踩也打不倒（' + r.res + '）');
    if (bossRun('dragon').res !== 'lose') issues.push('東海龍王：什麼都不做也不會輸');
    // 八岐大蛇：一個一個打開酒罈，醉倒了就踩
    r = bossRun('orochi', function (st, mini, p) {
      const drunk = mini.heads.filter(function (h) { return h.alive && h.state === 'drunk'; })[0];
      if (drunk) { p.x = drunk.x - p.w / 2; p.y = GYc - 38 - p.h + 6; p.vy = 4; return; }
      const v = mini.vats.filter(function (q) { return !q.open && !q.empty; })[0];
      if (v && !mini.vats.some(function (q) { return q.open; })) { p.x = v.x - p.w / 2; p.y = GYc - p.h; p.vy = 0; }
      else { p.x = 470; p.y = GYc - p.h; }
    });
    if (r.res !== 'win') issues.push('八岐大蛇：打開酒罈、踩醉倒的頭也打不倒（' + r.res + '）');
    if (bossRun('orochi').res !== 'lose') issues.push('八岐大蛇：什麼都不做也不會輸');
    Game.debug.setScene('map');
  } catch (e) {
    issues.push('出錯：' + e.message);
  }
  const back = JSON.parse(keep);
  Object.keys(sv).forEach(function (k) { if (!(k in back)) delete sv[k]; });
  Object.keys(back).forEach(function (k) { sv[k] = back[k]; });
  Save.touch();
  if (WorldMap.world() !== startWorld) { WorldMap.useWorld(startWorld); Voyage.rebuild(); }
  Game.debug.setCursor(cur0);
  return { issueCount: issues.length, issues: issues };
}
