/**
 * 魔王規則檢查。在瀏覽器執行 runBossRuleCheck()。
 *
 *   A) 一次破綻只能打一下：被打中後立刻起身（不再是 recover）
 *   B) 捷克魔王：玩家一直站在平台上時，每次癱倒前都要先丟完 3 支長槍（平台不是安全區），
 *      而且癱倒時間要比衝刺撞牆短（v1.20.2 起丟完槍會短暫癱倒；舊版完全不倒，玩家以為打不到是 bug）
 */
function runBossRuleCheck() {
  const issues = [];

  // ── A) 一次破綻只能打一下 ──
  Levels.list.forEach(function (def, li) {
    if (!def.isBoss) return;
    const st = buildLevelState(def, li, [], Equipment.resolve([]));
    const b = st.boss;
    b.phase = 'recover';
    b.timer = 100;
    const ev = damageBoss(st, b);
    if (ev === 'bosshit' && b.phase === 'recover') {
      issues.push(def.country + '：被打中後還在破綻期，可以連踩');
    }
    if (ev === 'bosshit' && !(b.graceTimer > 0)) {
      issues.push(def.country + '：被打中起身時沒有寬容期，會立刻反傷玩家');
    }
  });

  // ── B) 捷克：站在平台上等 ──
  const li = Levels.list.findIndex(function (d) { return d.id === 'CZ'; });
  const def = Levels.list[li];
  const st = buildLevelState(def, li, [], Equipment.resolve([]));
  const p = st.player;
  const pf = def.platforms[0];
  let spears = 0, spearsSince = 0, episodes = 0, run = 0, longest = 0;
  const idle = { isDown: function () { return false; }, once: function () { return false; }, endFrame: function () {} };
  for (let f = 0; f < 1500; f++) {
    // 玩家一直站在左平台上不動
    p.x = pf.x + 40; p.y = pf.y - p.h; p.vy = 0; p.invuln = 999;
    const wasRecover = st.boss.phase === 'recover';
    updateBoss(st, f);
    updateShots(st);
    updatePlayer(st, idle, f);
    st.shots.forEach(function (s) { if (s.spear && !s.counted) { s.counted = true; spears++; spearsSince++; } });
    const nowRecover = st.boss.phase === 'recover';
    if (nowRecover && !wasRecover) {
      episodes++;
      if (spearsSince < 3) issues.push('捷克：玩家躲在平台上，魔王只丟了 ' + spearsSince + ' 支槍就癱倒（平台太安全）');
      spearsSince = 0;
    }
    run = nowRecover ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  if (spears < 3) issues.push('捷克：玩家躲在平台上，魔王只丟了 ' + spears + ' 支槍，平台太安全');
  if (episodes === 0) issues.push('捷克：玩家躲在平台上，魔王丟完槍都不會癱倒（站平台的玩家打不到它）');
  if (longest >= 170) issues.push('捷克：丟完槍的癱倒（' + longest + ' 帧）不能跟衝刺撞牆（170）一樣長');

  return { issueCount: issues.length, issues: issues };
}
