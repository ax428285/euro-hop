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
 */
function runRaceCheck() {
  const issues = [];
  const report = {};
  Levels.list.forEach(function (def, li) {
    if (def.layout !== 'race') return;
    if (def.race.view === 'top') { topCheck(def, li, issues, report); return; }
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
