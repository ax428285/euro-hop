/**
 * v1.31 往前衝的賽道關檢查。在瀏覽器執行 runRaceCheck()。
 *
 *   A) 賽道本身：有終點、終點後面沒有障礙和金幣；古巴有大浪（整條路，要跳）、墨西哥有整排木箱；
 *      最急的彎在極速時壓得住（離心力 < 轉向力）
 *   B) 會開車的機器人（看前面的路選車道、矮的障礙就跳、高的閃開）沒有任何裝備也開得到終點，受傷不超過 2 次
 *   C) 站著不動（不轉向、不跳）一定會撞到東西 —— 不是放著就會過
 *   D) 大浪打到會痛（v1.31 古巴襯衫拿掉了，浪一定要躲）
 *   E) 上帝視角（v1.31 古巴，topdown.js）：路一直在畫面範圍內、終點後面沒有障礙；大浪前有預告、浪只蓋左邊（右車道安全）；
 *      會開車的機器人（看前面選車道、浪來就往右）開得到終點、受傷不超過 2 次；完全不轉向一定會撞到；浪打到會痛
 *   F) 塞爾維亞滑雪、保加利亞羽球（v1.31，runRemakeCheck）：機器人過得了、不操作過不了
 */
function runRaceCheck() {
  const issues = [];
  const report = {};
  Levels.list.forEach(function (def, li) {
    if (def.layout !== 'race') return;
    if (def.race.view === 'top') { topCheck(def, li, issues, report); return; }
    if (def.race.view === 'ski' || def.race.view === 'badminton') return;   // F) 由 runRemakeCheck 驗
    const pl = def.race, tag = def.country;
    // ── A) ──
    if (!(pl.finish > 100 && pl.finish < pl.total)) issues.push(tag + '：終點位置不對（' + pl.finish + ' / ' + pl.total + '）');
    for (let i = pl.finish - 20; i < pl.total; i++) {
      if (pl.segs[i].obs.length || pl.segs[i].coins.length) { issues.push(tag + '：終點附近／後面還有障礙或金幣（第 ' + i + ' 段）'); break; }
    }
    const fulls = pl.segs.filter(function (s) { return s.obs.some(function (o) { return o.w > 2; }); }).length;
    if (def.id === 'CU' && !pl.segs.some(function (s) { return s.obs.some(function (o) { return o.kind === 'wave'; }); })) issues.push('古巴：賽道上沒有大浪');
    if (def.id === 'MX' && !pl.segs.some(function (s) { return s.obs.some(function (o) { return o.kind === 'crates'; }); })) issues.push('墨西哥：賽道上沒有走私卡車丟的木箱');
    if (fulls < 2) issues.push(tag + '：要跳才過得去的整排障礙太少（' + fulls + '）');
    const maxCurve = Math.max.apply(null, pl.segs.map(function (s) { return Math.abs(s.curve); }));
    if (maxCurve * 0.0062 >= 0.034) issues.push(tag + '：最急的彎（' + maxCurve.toFixed(1) + '）在極速時壓不住');
    if (!pl.coins.length) issues.push(tag + '：賽道上沒有金幣');

    // ── B) 開車機器人 ──
    function drive(smart, stats) {
      const st = buildLevelState(def, li, [], stats || Equipment.resolve([]));
      const rs = st.race;
      let hurts = 0, frames = 0, cleared = false, jumpNow = false;
      const held = {};
      const input = { isDown: function (a) { return !!held[a]; }, once: function (a) { return a === 'jump' && jumpNow; } };
      for (; frames < 9000 && !cleared; frames++) {
        held.left = held.right = false; jumpNow = false;
        if (smart) {
          const here = Math.floor((rs.pos + Race.PLAYER_Z) / Race.SEG);
          // 每個車道的危險：前面 26 段內高的障礙、同車道前面的車
          const danger = Race.LANES.map(function (lx) {
            let d = 0;
            for (let k = 1; k < 26; k++) {
              const s = pl.segs[here + k];
              if (!s) break;
              s.obs.forEach(function (o) { if (!o.low && Math.abs(o.x - lx) < (o.w + Race.PLAYER_W) / 2 + 0.06) d += 30 - k; });
            }
            rs.cars.forEach(function (c) {
              const dz = (c.z - (rs.pos + Race.PLAYER_Z)) / Race.SEG;
              if (dz > -1 && dz < 30 && Math.abs(c.x - lx) < 0.5) d += 34 - dz;
            });
            return d + Math.abs(lx - rs.x) * 4;
          });
          let best = 0;
          danger.forEach(function (d, i) { if (d < danger[best]) best = i; });
          const tx = Race.LANES[best];
          if (rs.x < tx - 0.04) held.right = true;
          if (rs.x > tx + 0.04) held.left = true;
          // 彎道：離心力往外甩，提早往內壓
          const seg = Race.segAt(pl, rs.pos + Race.PLAYER_Z);
          if (seg.curve > 1.5 && rs.x > tx - 0.1) { held.left = false; held.right = true; }
          if (seg.curve < -1.5 && rs.x < tx + 0.1) { held.right = false; held.left = true; }
          // 矮的障礙壓在自己的位置上、3～6 段後就到：跳
          for (let k = 2; k <= 5; k++) {
            const s = pl.segs[here + k];
            if (s && rs.hop <= 0 && s.obs.some(function (o) { return o.low && Math.abs(o.x - rs.x) < (o.w + Race.PLAYER_W) / 2 + 0.05; })) jumpNow = true;
          }
        }
        const evs = Race.update(st, input, frames);
        evs.forEach(function (e) { if (/hurt$/.test(e)) hurts++; if (e === 'clear') cleared = true; });
      }
      return { cleared: cleared, hurts: hurts, frames: frames, coins: st.coinsGot };
    }
    const r = drive(true);
    report[def.id] = r;
    if (!r.cleared) issues.push(tag + '：開車機器人 9000 帧內開不到終點');
    else if (r.hurts > 2) issues.push(tag + '：開車機器人受傷 ' + r.hurts + ' 次，可能太難');
    if (r.frames < 1800) issues.push(tag + '：太短了（' + r.frames + ' 帧就到終點）');
    // ── C) ──
    const idle = drive(false);
    if (idle.hurts === 0) issues.push(tag + '：完全不轉向、不跳也不會撞到東西，沒有挑戰性');
    // ── D) ──
    if (def.id === 'CU') {
      const st = buildLevelState(def, li, [], Equipment.resolve([]));
      const wi = pl.segs.findIndex(function (s) { return s.obs.some(function (o) { return o.kind === 'wave'; }); });
      st.race.pos = wi * Race.SEG - Race.PLAYER_Z - Race.SEG * 0.5; st.race.speed = pl.maxSpeed; st.race.x = 0;
      const ev = Race.update(st, { isDown: function () { return false; }, once: function () { return false; } }, 1);
      if (!ev.some(function (e) { return /hurt$/.test(e); })) issues.push(tag + '：大浪打到不會痛');
    }
  });
  if (!Object.keys(report).length) issues.push('沒有任何賽道關');
  const rm = runRemakeCheck();
  rm.issues.forEach(function (x) { issues.push(x); });
  report.remake = rm.report;
  return { issueCount: issues.length, issues: issues, report: report };
}

/** v1.31 上帝視角賽車（古巴）的檢查 */
function topCheck(def, li, issues, report) {
  const pl = def.race, tag = def.country;
  let minC = 1e9, maxC = -1e9;
  for (let y = 0; y < pl.length; y += 40) { const c = TopRace.centerAt(pl, y); minC = Math.min(minC, c); maxC = Math.max(maxC, c); }
  if (minC - TopRace.RW < 60 || maxC + TopRace.RW > 900) issues.push(tag + '：馬路彎到畫面外面了（中線 ' + Math.round(minC) + '～' + Math.round(maxC) + '）');
  if (pl.obs.some(function (o) { return o.y > pl.finish - 200; })) issues.push(tag + '：終點附近／後面還有障礙');
  if (pl.waves.length < 2) issues.push(tag + '：大浪太少（' + pl.waves.length + '）');
  if (!pl.coins.length) issues.push(tag + '：路上沒有金幣');
  // 浪只蓋左邊：右車道的車子不會被打到
  const w0 = { y: 0, state: 'hit' }, box = TopRace.waveBox(pl, w0), c0 = TopRace.centerAt(pl, TopRace.WAVE_LEN / 2);
  if (!(box.w < c0 + TopRace.LANE - TopRace.CAR_W / 2 - 4)) issues.push(tag + '：大浪蓋到最右邊的車道，躲不掉');
  if (!(box.w > c0)) issues.push(tag + '：大浪連中間車道都沒蓋到，沒有壓力');

  function drive(smart, owned) {
    const stats = Equipment.resolve(owned || []);
    const st = buildLevelState(def, li, owned || [], stats);
    const rs = st.race;
    let hurts = 0, frames = 0, cleared = false, waveWarned = false;
    const held = {};
    const input = { isDown: function (a) { return !!held[a]; }, once: function () { return false; } };
    for (; frames < 9000 && !cleared; frames++) {
      held.left = held.right = false;
      if (smart) {
        const ahead = function (lx, from, to) {
          return pl.obs.some(function (o) { return Math.abs(o.lx - lx) < 60 && o.y > rs.d + from && o.y < rs.d + to; }) ||
                 rs.cars.some(function (car) { return Math.abs(car.lx - lx) < 60 && car.y > rs.d - 40 && car.y < rs.d + to * 0.8; });
        };
        const waveSoon = rs.waves.some(function (w) { return (w.state === 'warn' || w.state === 'hit') || (w.state === 'idle' && rs.d > w.y - 520); });
        let target;
        if (waveSoon) target = TopRace.LANES[2];
        else {
          const cur = TopRace.LANES.reduce(function (b, lx) { return Math.abs(rs.x - TopRace.centerAt(pl, rs.d) - lx) < Math.abs(rs.x - TopRace.centerAt(pl, rs.d) - b) ? lx : b; }, 0);
          const free = TopRace.LANES.filter(function (lx) { return !ahead(lx, -20, 360); });
          target = free.indexOf(cur) >= 0 ? cur : (free.sort(function (a, b) { return Math.abs(a - cur) - Math.abs(b - cur); })[0] != null ? free[0] : cur);
        }
        const tx = TopRace.centerAt(pl, rs.d + 60) + target;
        if (rs.x < tx - 6) held.right = true;
        if (rs.x > tx + 6) held.left = true;
      }
      const evs = TopRace.update(st, input, frames);
      evs.forEach(function (e) { if (/hurt$/.test(e)) hurts++; if (e === 'clear') cleared = true; if (e === 'waveWarn') waveWarned = true; });
    }
    return { cleared: cleared, hurts: hurts, frames: frames, coins: st.coinsGot, waveWarned: waveWarned };
  }
  const r = drive(true);
  report[def.id] = r;
  if (!r.cleared) issues.push(tag + '：開車機器人 9000 帧內開不到終點');
  else if (r.hurts > 2) issues.push(tag + '：開車機器人受傷 ' + r.hurts + ' 次，可能太難');
  if (!r.waveWarned) issues.push(tag + '：大浪打上來之前沒有預告');
  if (r.frames < 1800) issues.push(tag + '：太短了（' + r.frames + ' 帧就到終點）');
  const idle = drive(false);
  if (idle.hurts === 0) issues.push(tag + '：完全不轉向也不會撞到東西，沒有挑戰性');
  // 停在浪裡（左車道）：浪打到要會痛
  const st = buildLevelState(def, li, [], Equipment.resolve([]));
  const w = st.race.waves[0];
  st.race.d = w.y + 40; st.race.x = TopRace.centerAt(pl, st.race.d) - TopRace.LANE; st.race.speed = 0;
  w.state = 'hit'; w.t = 20;
  st.race.cars = [];
  const ev = TopRace.update(st, { isDown: function () { return false; }, once: function () { return false; } }, 1);
  if (!ev.some(function (e) { return /hurt$/.test(e); })) issues.push(tag + '：大浪打到不會痛');
}

/*
 * v1.31 塞爾維亞滑雪（ski.js）：
 *   會滑雪的機器人（前面有石頭、雪人、樹幹就跳，纜車椅就壓低，其他時候壓低加速）沒有裝備也滑得到終點、摔倒不超過 2 次；
 *   完全不操作一定會撞到；纜車椅站著過去會撞、壓低過得去；跳台後面的金幣飛得到；終點後面沒有障礙
 */
function skiBot(def, li, smart) {
  const st = buildLevelState(def, li, [], Equipment.resolve([]));
  const pl = def.race, rs = st.race;
  let hurts = 0, frames = 0, cleared = false, jumpNow = false, down = false;
  const input = { isDown: function (a) { return a === 'down' && down; }, once: function (a) { return a === 'jump' && jumpNow; } };
  for (; frames < 9000 && !cleared; frames++) {
    jumpNow = false; down = false;
    if (smart) {
      down = true;
      const lead = rs.vx * 11 + 24;
      pl.obs.forEach(function (o) {
        const dx = o.x - rs.x;
        if (o.low) { if (dx > -30 && dx < rs.vx * 18 + 60) down = true; }
        else if (!rs.air && dx > lead - rs.vx && dx <= lead) jumpNow = true;
      });
      // 纜車椅就在前面的時候不要起跳（會撞到椅子）
      if (pl.obs.some(function (o) { return o.low && o.x - rs.x > -30 && o.x - rs.x < 360; })) jumpNow = false;
    }
    const ev = Race.update(st, input, frames);
    ev.forEach(function (e) { if (/hurt$/.test(e)) hurts++; if (e === 'clear') cleared = true; });
  }
  return { cleared: cleared, hurts: hurts, frames: frames, coins: st.coinsGot, total: pl.coins.length };
}

function badmintonBot(def, li, smart) {
  const st = buildLevelState(def, li, [], Equipment.resolve([]));
  const rs = st.race;
  let hurts = 0, frames = 0, cleared = false, jumpNow = false, held = {};
  const input = { isDown: function (a) { return !!held[a]; }, once: function (a) { return a === 'jump' && jumpNow; } };
  for (; frames < 30000 && !cleared; frames++) {
    jumpNow = false; held = {};
    const sh = rs.sh;
    if (smart && sh) {
      if (sh.held && rs.server === 'me') jumpNow = frames % 30 === 0;
      else if (!sh.held && rs.last !== 'me') {
        const pr = Badminton.predict(sh);
        const tx = Math.min(Badminton.NET_X - 30, pr.x - 14);
        // 對手站在後場 → 打網前小球
        if (rs.ai.x > 700) held.down = true;
        if (rs.me.x < tx - 4) held.right = true;
        else if (rs.me.x > tx + 4) held.left = true;
        // 球高高地落到身邊：跳起來殺
        if (sh.vy > 0 && sh.x < Badminton.NET_X && Math.abs(sh.x - rs.me.x) < 60 && sh.y < rs.me.y - 120 && sh.y > rs.me.y - 150 && !rs.me.air) jumpNow = true;
      } else {
        if (rs.me.x < 240) held.right = true; else if (rs.me.x > 260) held.left = true;
      }
    }
    const ev = Race.update(st, input, frames);
    ev.forEach(function (e) { if (/hurt$/.test(e)) hurts++; if (e === 'clear') cleared = true; });
  }
  return { cleared: cleared, hurts: hurts, frames: frames, coins: st.coinsGot, score: rs.score.join(':'), lost: rs.lostMatches };
}

function runRemakeCheck() {
  const issues = [], report = {};
  const rsI = Levels.list.findIndex(function (l) { return l.id === 'RS'; }), bgI = Levels.list.findIndex(function (l) { return l.id === 'BG'; });
  const rsDef = Levels.list[rsI], bgDef = Levels.list[bgI];
  if (!rsDef || rsDef.layout !== 'race' || rsDef.race.view !== 'ski') issues.push('塞爾維亞不是滑雪關');
  if (!bgDef || bgDef.layout !== 'race' || bgDef.race.view !== 'badminton') issues.push('保加利亞不是羽球關');
  if (issues.length) return { issueCount: issues.length, issues: issues };
  // ── 滑雪 ──
  const pl = rsDef.race;
  if (pl.obs.some(function (o) { return o.x > pl.finish - 200; })) issues.push('滑雪：終點附近還有障礙');
  if (!pl.obs.some(function (o) { return o.low; })) issues.push('滑雪：沒有要壓低的纜車椅');
  if (pl.kickers.length < 3) issues.push('滑雪：跳台太少（' + pl.kickers.length + '）');
  const sk = skiBot(rsDef, rsI, true);
  report.ski = sk;
  if (!sk.cleared) issues.push('滑雪：機器人滑不到終點');
  else if (sk.hurts > 2) issues.push('滑雪：機器人摔了 ' + sk.hurts + ' 次，可能太難');
  if (sk.frames < 1500) issues.push('滑雪：太短了（' + sk.frames + ' 帧）');
  if (sk.coins < sk.total * 0.6) issues.push('滑雪：機器人只拿到 ' + sk.coins + ' / ' + sk.total + ' 枚金幣（空中的金幣飛不到？）');
  const idle = skiBot(rsDef, rsI, false);
  report.skiIdle = idle;
  if (idle.hurts === 0) issues.push('滑雪：完全不操作也不會撞到，沒有挑戰性');
  // 纜車椅：站著會撞、壓低過得去
  const chair = pl.obs.filter(function (o) { return o.low; })[0];
  [false, true].forEach(function (duck) {
    const st = buildLevelState(rsDef, rsI, [], Equipment.resolve([]));
    st.race.x = chair.x - 60; st.race.y = Ski.groundAt(pl, st.race.x); st.race.vx = 8;
    let hurt = false;
    for (let f = 0; f < 20; f++) {
      const ev = Race.update(st, { isDown: function (a) { return duck && a === 'down'; }, once: function () { return false; } }, f);
      if (ev.some(function (e) { return /hurt$/.test(e); })) hurt = true;
    }
    if (duck && hurt) issues.push('滑雪：壓低還是撞到纜車椅');
    if (!duck && !hurt) issues.push('滑雪：站著過纜車椅不會撞到（那就不用壓低了）');
  });
  // ── 羽球 ──
  const bd = badmintonBot(bgDef, bgI, true);
  report.badminton = bd;
  if (!bd.cleared) issues.push('羽球：機器人打不贏（' + bd.score + '）');
  else if (bd.hurts > 2) issues.push('羽球：機器人輸了 ' + bd.hurts + ' 局，可能太難');
  if (bd.frames < 1200) issues.push('羽球：太快就打完了（' + bd.frames + ' 帧），對手太弱');
  const bi = badmintonBot(bgDef, bgI, false);
  report.badmintonIdle = bi;
  if (bi.cleared) issues.push('羽球：站著不動也會贏');
  if (bi.hurts === 0) issues.push('羽球：站著不動也不會輸掉任何一局');
  // 舊存檔：破過的塞爾維亞、保加利亞要變回還沒破
  return { issueCount: issues.length, issues: issues, report: report };
}
