/**
 * v1.31.2 亞特蘭提斯海底城檢查。在瀏覽器執行 runAbyssCheck()。
 *
 *   A) 地圖：海底城地圖上剛好是 4 區、入口都在陸地上；光之井（出口）在開得到的水裡、人魚站在陸地上、船游得到她旁邊；
 *      圖釘、地點都在地圖範圍內（只用到上面 760）；國名離自己的圖釘不遠；海底城的地圖上不生海上怪物
 *   B) 開放與進出：只潛到亞特蘭提斯的神殿還不夠 —— 要解開「海神的封印」（flag abyssGate）海底城篇才開；
 *      進海底城 → 地圖換成 'sea'、人在光之井下面；回海面 → 換回歐洲、人在亞特蘭提斯旁邊的海上
 *   C) 機關：發光水母從上面踩會彈起來、碰到觸手會痛；水晶光束預告時不痛、發射時站在地上會痛、跳在空中不痛
 *   E) 海神的封印（亞特蘭提斯潛水關的最底層）：三幅壁畫的圖案各不相同、都在井裡；照順序踩石板 = 解開、過一會兒過關；
 *      踩錯順序 = 石板浮回來重來；不解謎游進右邊的氣泡柱也能過關（但封印沒解開）；剛到底就站在氣泡柱裡不算
 *      回大地圖：潛過神殿、封印沒解開 → 講一次「再潛一次」；解開、還沒進去過 → 講一次「海底城開放了」；亞特蘭提斯的圖示跟著換
 *   F) 珊瑚貝殼屋（海底城的服裝店）在地圖上、賣人魚和海神時裝（買了就穿上、有圖示畫得出來）；
 *      海底城全破、跟人魚說完話 → 她跟在你後面（大地圖上），廣場上就沒有她了
 *   G) 亞特蘭提斯在歐洲地圖上：封印沒解開時會沉下去又浮上來（一段時間看不到）；解開之後一直都在
 *   D) 每一區有地標、遠景、旗子、紀念品（放在關卡裡）、世界之謎的線索、曲子；橫向關有自己的敵人外型；
 *      最終魔王克拉肯的觸手畫得出來（Sprites.shot 的 tentacle）
 * 會暫時改存檔、換地圖，結束前還原。
 */
function runAbyssCheck() {
  const issues = [];
  const sv = Save.get();
  const backup = JSON.stringify(sv);
  const AB = Levels.list.map(function (lv, i) { return { lv: lv, i: i }; }).filter(function (o) { return o.lv.region === 'abyss'; });
  if (AB.length !== 4) issues.push('海底城應該 4 區，現在 ' + AB.length + ' 區');

  // ── A) 地圖 ──
  const startWorld = WorldMap.world();
  WorldMap.useWorld('sea'); Voyage.rebuild();
  const ids = WorldMap.nations.map(function (n) { return n.id; }).sort().join(',');
  if (ids !== AB.map(function (o) { return o.lv.id; }).sort().join(',')) issues.push('海底城地圖上的區不對：' + ids);
  Voyage.ports().forEach(function (p) { if (!Voyage.isLand(p.x, p.y)) issues.push('海底城：' + p.id + ' 的入口不在陸地上'); });
  const surf = WorldMap.specials.filter(function (s) { return s.def.surface; })[0];
  const mer = WorldMap.specials.filter(function (s) { return s.def.npc === 'mermaid'; })[0];
  if (!surf) issues.push('海底城沒有出口（光之井）');
  else if (!Voyage.isNavigable(surf.pin[0], surf.pin[1] + 30)) issues.push('海底城：光之井底下不是開得到的水');
  if (!mer) issues.push('海底城沒有人魚');
  else {
    if (!Voyage.isLand(mer.pin[0], mer.pin[1])) issues.push('海底城：人魚沒有站在陸地上');
    let reach = false;
    for (let a = 0; a < 32 && !reach; a++) for (let r = 4; r <= 80 && !reach; r += 4) reach = Voyage.isNavigable(mer.pin[0] + Math.cos(a / 5.1) * r, mer.pin[1] + Math.sin(a / 5.1) * r);
    if (!reach) issues.push('海底城：潛水鐘游不到人魚旁邊');
  }
  WorldMap.nations.concat(WorldMap.specials).forEach(function (n) {
    if (n.pin[1] > WorldMap.mapBottom() - 30 || n.pin[1] < 40) issues.push('海底城：' + n.id + ' 太靠近地圖上下緣');
    if (n.pin[0] < 30 || n.pin[0] > WorldMap.WORLD_W - 30) issues.push('海底城：' + n.id + ' 太靠近地圖左右緣');
  });
  WorldMap.nations.forEach(function (n) {
    const d = Math.hypot(n.label[0] - n.pin[0], n.label[1] - n.pin[1]);
    if (d > 110) issues.push('海底城：' + n.id + ' 的名字離圖釘 ' + Math.round(d) + 'px');
  });
  // 地圖畫得出來（配色換成海底城的）
  try {
    const c = document.createElement('canvas').getContext('2d');
    WorldMap.draw(c, 960, 480, { t: 0, unlocked: Levels.count, clearedFn: function () { return false; }, cursor: AB[0].i });
  } catch (e) { issues.push('海底城地圖畫不出來：' + e.message); }
  // 地圖上不生海上怪物
  Encounter.clear();
  for (let k = 0; k < 2000; k++) Encounter.updateMap(Voyage.shipPos(), 0);
  if (Encounter.monsters().length) issues.push('海底城的地圖上生出了海上怪物（' + Encounter.monsters().map(function (m) { return m.kind; }).join(',') + '）');
  Encounter.clear();
  WorldMap.useWorld(startWorld); Voyage.rebuild();

  // ── B) 開放與進出 ──
  const bosses0 = sv.seaBosses.slice();
  sv.seaBosses = sv.seaBosses.filter(function (k) { return k !== 'atlantis'; });
  sv.flags.abyssGate = 0;
  if (Encounter.regionUnlocked('abyss', sv.exp)) issues.push('還沒潛到亞特蘭提斯的神殿，海底城就開了');
  sv.seaBosses.push('atlantis');
  if (Encounter.regionUnlocked('abyss', sv.exp)) issues.push('只潛到神殿、還沒解開封印，海底城就開了');
  sv.flags.abyssGate = 1;
  if (!Encounter.regionUnlocked('abyss', sv.exp)) issues.push('解開了海神的封印，海底城還是鎖著');
  Game.debug.enterAbyss();
  if (WorldMap.world() !== 'sea') issues.push('進海底城之後地圖不是 sea（' + WorldMap.world() + '）');
  else if (surf && Math.hypot(Voyage.shipPos().x - surf.pin[0], Voyage.shipPos().y - surf.pin[1]) > 60) issues.push('進海底城之後人不在光之井下面');
  try { Game.debug.render(); } catch (e) { issues.push('海底城的大地圖畫面畫不出來：' + e.message); }
  Game.debug.leaveAbyss();
  if (WorldMap.world() !== 'eu') issues.push('回海面之後地圖不是歐洲（' + WorldMap.world() + '）');
  else {
    const ap = EuropeWorld.project(-9.4, 33.4), sp = Voyage.shipPos();
    if (Math.hypot(sp.x - ap[0], sp.y - ap[1]) > 260) issues.push('回海面之後人不在亞特蘭提斯旁邊');
    if (!Voyage.isNavigable(sp.x, sp.y)) issues.push('回海面之後人不在開得到的海上');
  }
  sv.seaBosses = bosses0;

  // ── C) 機關 ──
  function player(x, y) {
    return { x: x, y: y, w: 22, h: 40, vx: 0, vy: 0, onGround: false, invuln: 0, facing: 1,
             stats: Equipment.resolve([]), equipped: {}, pid: 0 };
  }
  (function () {
    const o = AB.filter(function (q) { return q.lv.id === 'A1'; })[0];
    if (!o) return;
    const jl = o.lv.features.filter(function (f) { return f.type === 'jelly'; });
    if (jl.length < 4) issues.push('珊瑚市集的發光水母太少（' + jl.length + '）');
    if (!jl.length) return;
    const f0 = jl[0];
    const mk = function () {
      const st = buildLevelState(o.lv, o.i, [], Equipment.resolve([]));
      st.features.list = st.features.list.filter(function (f) { return f.type === 'jelly'; }).slice(0, 1);
      return st;
    };
    // 從上面踩傘蓋
    let st = mk(); Features.update(st, 0);
    const f = st.features.list[0];
    let p = player(f.x - 11, f.y - 16 - 40 + 5); p.vy = 2; st.players = [p]; st.player = p;     // 腳剛好踩進傘蓋頂 5px
    let ev = Features.update(st, 0);
    if (!ev.some(function (e) { return /spring$/.test(e); }) || p.vy >= 0) issues.push('珊瑚市集：從上面踩水母沒有被彈起來');
    if (p.invuln > 0) issues.push('珊瑚市集：踩水母傘蓋也被電到');
    // 碰到觸手
    st = mk(); Features.update(st, 0);
    const g = st.features.list[0];
    p = player(g.x - 11, g.y + 4); st.players = [p]; st.player = p;
    ev = Features.update(st, 0);
    if (!(p.invuln > 0)) issues.push('珊瑚市集：碰到水母的觸手沒有被電');
  })();
  (function () {
    const o = AB.filter(function (q) { return q.lv.id === 'A2'; })[0];
    if (!o) return;
    const bm = o.lv.features.filter(function (f) { return f.type === 'beam'; });
    if (bm.length < 4) issues.push('水晶宮的水晶光束太少（' + bm.length + '）');
    if (!bm.length) return;
    const b0 = bm[0];
    const gy = LevelGen.groundAt(o.lv.groundSegs, b0.x + 150);
    if (gy == null || Math.abs(gy - b0.y) > 1) issues.push('水晶宮：光束掃過的那段不是平地（有斷崖或高低差）');
    // 找一個「預告中」和「發射中」的時間
    let tWarn = -1, tFire = -1;
    for (let t = 0; t < 400 && (tWarn < 0 || tFire < 0); t++) {
      const st = buildLevelState(o.lv, o.i, [], Equipment.resolve([]));
      st.players = []; st.player = player(-999, 0); st.players = [st.player];
      Features.update(st, t);
      const f = st.features.list.filter(function (q) { return q.type === 'beam'; })[0];
      if (f.state === 'warn' && tWarn < 0) tWarn = t;
      if (f.state === 'fire' && tFire < 0) tFire = t;
    }
    if (tWarn < 0 || tFire < 0) { issues.push('水晶宮：光束沒有預告／發射'); return; }
    [['warn', tWarn, false, false], ['fire', tFire, false, true], ['fire', tFire, true, false]].forEach(function (c) {
      const st = buildLevelState(o.lv, o.i, [], Equipment.resolve([]));
      st.features.list = st.features.list.filter(function (q) { return q.type === 'beam'; }).slice(0, 1);
      const f = st.features.list[0];
      const p = player(f.x + 120, c[2] ? f.y - 40 - 50 : f.y - 40); p.onGround = !c[2];
      st.players = [p]; st.player = p;
      Features.update(st, c[1]);
      const hurt = p.invuln > 0;
      if (hurt !== c[3]) issues.push('水晶宮：光束' + (c[0] === 'warn' ? '預告時' : '發射時') + (c[2] ? '跳在空中' : '站在地上') + (c[3] ? '應該會痛' : '不應該痛'));
    });
  })();

  // ── E) 海神的封印 ──
  (function () {
    const m = { kind: 'atlantis', def: Encounter.KINDS.atlantis, x: 0, y: 0 };
    const def = Encounter.makeDef(m, Equipment.resolve([]));
    if (!def.riddle) { issues.push('亞特蘭提斯的潛水關沒有海神的封印'); return; }
    const gf = def.shaftFloors.filter(function (f) { return f.goal; })[0];
    const inp = { isDown: function () { return false; }, once: function () { return false; }, endFrame: function () {} };
    function fresh() {
      sv.flags.abyssGate = 0;
      const st = buildLevelState(def, -1, [], Equipment.resolve([]));
      st.enemies = []; st.shots = [];
      const p = st.player;
      p.y = gf.y - p.h; p.vy = 0; p.onGround = true;
      return st;
    }
    function stand(st, x, n) {
      const p = st.player, evs = [];
      for (let f = 0; f < (n || 3); f++) {
        p.x = x - p.w / 2; p.y = gf.y - p.h; p.vx = 0; if (p.vy < 0) p.vy = 0;
        updatePlayer(st, inp, 1000 + f).forEach(function (e) { evs.push(String(e).replace(/^p\d:/, '')); });
      }
      return evs;
    }
    let st = fresh();
    const r = st.riddle;
    if (!r) { issues.push('潛水關的狀態裡沒有封印'); return; }
    if (r.murals.length !== 3 || new Set(r.murals.map(function (q) { return q.sym; })).size !== 3) issues.push('封印的三幅壁畫圖案要各不相同');
    r.murals.forEach(function (q) {
      if (q.x < gf.x - 10 || q.x + 100 > gf.x + gf.w + 10) issues.push('封印的壁畫畫到井外面去了');
      if (q.y > gf.y - 100 || q.y < def.shaftFloors[0].y - 400) issues.push('封印的壁畫不在往下潛的路上');
    });
    const plateX = function (st, sym) { const q = st.riddle.plates.filter(function (k) { return k.sym === sym; })[0]; return q.x + q.w / 2; };
    // 照順序踩
    stand(st, gf.x + gf.w * 0.12, 4);
    if (!st.riddle.arrived) issues.push('站上神殿最底層沒有開始解謎');
    if (st.cleared) issues.push('封印還沒解開，一到底就過關了');
    let all = [];
    st.riddle.order.forEach(function (sym) { all = all.concat(stand(st, plateX(st, sym), 3)); stand(st, gf.x + gf.w * 0.12, 2); });
    if (all.indexOf('riddle:solved') < 0 || !st.riddle.solved) issues.push('照壁畫的順序踩石板，封印沒有解開（' + all.join(',') + '）');
    let cleared = false;
    for (let f = 0; f < 200 && !cleared; f++) { if (stand(st, gf.x + gf.w * 0.12, 1).indexOf('clear') >= 0) cleared = true; }
    if (!cleared) issues.push('封印解開之後沒有過關');
    // 踩錯順序
    st = fresh();
    stand(st, gf.x + gf.w * 0.12, 4);
    const wrong = stand(st, plateX(st, st.riddle.order[1]), 3);
    if (wrong.indexOf('riddle:wrong') < 0) issues.push('踩錯順序沒有反應');
    stand(st, gf.x + gf.w * 0.12, 60);
    if (st.riddle.pressed.length || st.riddle.plates.some(function (q) { return q.down; })) issues.push('踩錯之後石板沒有浮回來');
    // 不解謎：游進氣泡柱
    st = fresh();
    const ex = st.riddle.exit.x + st.riddle.exit.w / 2;
    const early = stand(st, ex, 3);
    if (early.indexOf('clear') >= 0) issues.push('剛到底就站在氣泡柱裡也算浮上去了');
    stand(st, gf.x + gf.w * 0.12, 70);
    const leave = stand(st, ex, 3);
    if (leave.indexOf('clear') < 0) issues.push('不解謎游進右邊的氣泡柱，沒有過關');
    if (st.riddle.solved) issues.push('沒解謎浮上去，封印卻算解開了');
    // 回大地圖的提示、地圖上的圖示
    WorldMap.useWorld('eu'); Voyage.rebuild();
    if (sv.seaBosses.indexOf('atlantis') < 0) sv.seaBosses.push('atlantis');
    sv.flags.abyssGate = 0; sv.flags.abyssHint = 0; sv.flags.abyssNews = 0; sv.flags.abyssVisited = 0;
    const n1 = Game.debug.abyssNotice(), n2 = Game.debug.abyssNotice();
    if (!n1 || n1.text.indexOf('亞特蘭提斯') < 0) issues.push('潛過神殿、封印沒解開，回大地圖沒有提示再潛一次');
    if (n2) issues.push('「再潛一次」的提示講了不只一次');
    sv.flags.abyssGate = 1;
    const n3 = Game.debug.abyssNotice(), n4 = Game.debug.abyssNotice();
    if (!n3 || n3.text.indexOf('海底城') < 0) issues.push('封印解開了，回大地圖沒有提示海底城開放');
    if (n4) issues.push('「海底城開放了」的提示講了不只一次');
    try {
      Encounter.clear(); Encounter.updateMap(Voyage.shipPos(), 0);
      if (!Encounter.monsters().some(function (q) { return q.kind === 'atlantis'; })) issues.push('歐洲地圖上找不到亞特蘭提斯');
      const c = document.createElement('canvas').getContext('2d');
      sv.flags.abyssGate = 0; Encounter.drawMap(c, 0);
      sv.flags.abyssGate = 1; Encounter.drawMap(c, 0);
    } catch (e) { issues.push('亞特蘭提斯的地圖圖示畫不出來：' + e.message); }
    Encounter.clear();
  })();

  // ── F) 珊瑚貝殼屋、人魚跟著走 ──
  (function () {
    WorldMap.useWorld('sea'); Voyage.rebuild();
    const shop = WorldMap.specials.filter(function (q) { return q.def.seller === 'shellHouse'; })[0];
    if (!shop) issues.push('海底城地圖上沒有珊瑚貝殼屋');
    else if (!Voyage.isLand(shop.pin[0], shop.pin[1])) issues.push('珊瑚貝殼屋沒有蓋在陸地上');
    const items = Shop.itemsOf('shellHouse');
    if (!items.some(function (it) { return it.costume === 'athena'; })) issues.push('珊瑚貝殼屋沒有賣雅典娜時裝');
    if (Costumes.get('mermaid')) issues.push('人魚時裝應該拿掉了（v1.31.3）');
    items.forEach(function (it) {
      if (!Costumes.get(it.costume)) issues.push('珊瑚貝殼屋賣的 ' + it.name + ' 不是時裝');
      if (!Sprites.icons[it.icon]) issues.push('珊瑚貝殼屋的 ' + it.name + ' 沒有圖示');
    });
    const w0 = sv.wallet, cos0 = sv.costumes.slice(), c0 = sv.costume;
    sv.wallet = 99999; sv.costumes = sv.costumes.filter(function (k) { return k !== 'athena'; });
    if (!Shop.buy('cos_athena') || sv.costume !== 'athena') issues.push('買了雅典娜時裝沒有穿上');
    try {
      const c = document.createElement('canvas').getContext('2d');
      ['athena'].forEach(function (id) {
        Sprites.player(c, { x: 100, y: 100, w: 22, h: 40, facing: 1, onGround: true, vx: 0, invuln: 0, pid: 0, equipped: {}, costume: id }, 0);
      });
    } catch (e) { issues.push('雅典娜時裝畫不出來：' + e.message); }
    sv.wallet = w0; sv.costumes = cos0; sv.costume = c0;
    // 人魚
    const mer = WorldMap.specials.filter(function (q) { return q.def.npc === 'mermaid'; })[0];
    sv.flags.mermaid = 0;
    if (Pet.mermaidOn()) issues.push('還沒跟人魚說話，她就跟著你了');
    if (mer && mer.def.gone && mer.def.gone()) issues.push('還沒帶人魚走，廣場上就沒有她了');
    const done0 = sv.cleared.slice();
    AB.forEach(function (o) { if (sv.cleared.indexOf(o.i) < 0) sv.cleared.push(o.i); });
    const tk = Quests.talk('mermaid');
    const r = tk && tk.end ? tk.end(true) : null;
    if (!r || !Save.flag('mermaid')) issues.push('海底城全破之後跟人魚說話，她沒有跟你走');
    if (!(mer && mer.def.gone && mer.def.gone())) issues.push('人魚跟你走了，廣場上還站著她');
    const sp = Voyage.shipPos();
    for (let k = 0; k < 120; k++) { Voyage.placeShip(sp.x + k * 0.8, sp.y); Pet.update(Voyage.shipPos()); }
    if (!Pet.mermaid.ready) issues.push('人魚跟你走了，大地圖上卻沒有出現在你後面');
    else if (Math.hypot(Pet.mermaid.x - Voyage.shipPos().x, Pet.mermaid.y - Voyage.shipPos().y) > 80) issues.push('人魚沒有跟在你後面（離太遠）');
    try { Pet.drawMermaid(document.createElement('canvas').getContext('2d'), 50, 50, 0, 1, true); Pet.drawMermaid(document.createElement('canvas').getContext('2d'), 50, 50, 0, -1, false); }
    catch (e) { issues.push('人魚跟隨者畫不出來：' + e.message); }
    sv.cleared = done0; sv.flags.mermaid = 0;
    WorldMap.useWorld('eu'); Voyage.rebuild();
  })();

  // ── G) 亞特蘭提斯時有時無 ──
  (function () {
    WorldMap.useWorld('eu'); Voyage.rebuild();
    sv.flags.abyssGate = 0;
    Encounter.clear();
    let seen = 0, gone = 0;
    for (let k = 0; k < 60 * 130; k++) {
      Encounter.updateMap(Voyage.shipPos(), 0);
      if (k % 30) continue;
      if (Encounter.monsters().some(function (m) { return m.kind === 'atlantis'; })) seen++; else gone++;
    }
    if (!seen) issues.push('封印沒解開時，亞特蘭提斯一直都沒出現');
    if (!gone) issues.push('封印沒解開時，亞特蘭提斯一直都在（應該偶爾沉下去）');
    sv.flags.abyssGate = 1;
    Encounter.clear(); gone = 0;
    for (let k = 0; k < 60 * 130; k++) {
      Encounter.updateMap(Voyage.shipPos(), 0);
      if (k % 30 === 0 && !Encounter.monsters().some(function (m) { return m.kind === 'atlantis'; })) gone++;
    }
    if (gone) issues.push('封印解開之後，亞特蘭提斯還會消失');
    Encounter.clear();
  })();

  // ── D) 美術與內容 ──
  AB.forEach(function (o) {
    const lv = o.lv;
    if (!Sprites.landmarks[lv.landmark]) issues.push(lv.country + '：沒有地標 ' + lv.landmark);
    if (!Sprites.skylines[lv.id]) issues.push(lv.country + '：沒有遠景');
    if (!Sprites.flagDirs[lv.flagDir]) issues.push(lv.country + '：旗子畫法 ' + lv.flagDir + ' 沒有註冊');
    if (!lv.isBoss && lv.layout !== 'race' && !(Sprites.countryEnemies[lv.id] && Sprites.countryEnemies[lv.id].walker)) issues.push(lv.country + '：沒有自己的敵人外型');
    const sou = Souvenirs.forLevel(o.i);
    if (!sou) issues.push(lv.country + '：沒有紀念品');
    else {
      if (!Sprites.icons[sou.icon]) issues.push(lv.country + '：紀念品沒有圖示');
      const st = buildLevelState(lv, o.i, [], Equipment.resolve([]));
      if (!st.equip || st.equip.id !== sou.id) issues.push(lv.country + '：關卡裡沒有放紀念品');
    }
    if (!Mystery.clueFor(o.i)) issues.push(lv.country + '：沒有世界之謎的線索');
    if (!Music.tracks[lv.id]) issues.push(lv.country + '：沒有曲子');
  });
  const fin = AB.filter(function (o) { return o.lv.isBoss; })[0];
  if (!fin) issues.push('海底城沒有最終魔王');
  else {
    if (!fin.lv.finale) issues.push('海神神殿沒有標成篇章最終關（finale）');
    if (!Sprites.bossKinds[fin.lv.boss.kind]) issues.push('克拉肯沒有畫法');
    try {
      const c = document.createElement('canvas').getContext('2d');
      Sprites.shot(c, { x: 100, y: 300, w: 44, h: 124, warn: 20, life: 82, pillar: true, tentacle: true }, 0);
      Sprites.shot(c, { x: 100, y: 300, w: 44, h: 124, warn: 0, life: 20, pillar: true, tentacle: true }, 0);
    } catch (e) { issues.push('克拉肯的觸手畫不出來：' + e.message); }
  }

  // 還原
  const keep = JSON.parse(backup);
  Object.keys(keep).forEach(function (k) { sv[k] = keep[k]; });
  Save.touch();
  WorldMap.useWorld('eu'); Voyage.rebuild();
  Game.debug.setScene('map');
  return { issueCount: issues.length, issues: issues };
}
