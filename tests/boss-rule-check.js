/**
 * 魔王規則檢查。在瀏覽器執行 runBossRuleCheck()。
 *
 *   A) 一次破綻只能打一下：被打中後立刻起身（不再是 recover）
 *   B) 捷克魔王：玩家一直站在平台上，魔王不能癱倒（否則「站上去等它撞牆」穩贏），
 *      而且要真的有攻擊打向平台上的玩家
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
  let recovered = 0, spears = 0;
  const idle = { isDown: function () { return false; }, once: function () { return false; }, endFrame: function () {} };
  for (let f = 0; f < 1500; f++) {
    // 玩家一直站在左平台上不動
    p.x = pf.x + 40; p.y = pf.y - p.h; p.vy = 0; p.invuln = 999;
    updateBoss(st, f);
    updateShots(st);
    updatePlayer(st, idle, f);
    if (st.boss.phase === 'recover') recovered++;
    st.shots.forEach(function (s) { if (s.spear && !s.counted) { s.counted = true; spears++; } });
  }
  if (recovered > 0) issues.push('捷克：玩家躲在平台上，魔王還是會癱倒 ' + recovered + ' 帧（平台蹲點穩贏）');
  if (spears < 3) issues.push('捷克：玩家躲在平台上，魔王只丟了 ' + spears + ' 支槍，平台太安全');

  return { issueCount: issues.length, issues: issues };
}
