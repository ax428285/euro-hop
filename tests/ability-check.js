/**
 * 裝備能力檢查（v1.9）。在瀏覽器執行 runAbilityCheck()（node 也能跑）。
 *
 *   A) 「愛心 +1」的裝備不能太多（玩家回報：太多裝備都是加愛心）
 *   B) 板球：按 K 會丟出去，打得死踩不死的盾兵
 *   C) 辣椒火球：會穿透，一發打倒一排
 *   D) 木鞋重踩：踩倒一隻，旁邊地上的也一起倒
 *   E) 大蒜：魔王破綻期變長
 *   F) 沒有遠程裝備時按 K 不會丟東西
 */
function runAbilityCheck() {
  const issues = [];
  const lv = Levels.list.filter(function (d) { return d.layout === 'flat'; })[0];
  const li = Levels.list.indexOf(lv);

  // A)
  const hearts = Equipment.defs.filter(function (d) {
    const s = { maxLives: 3, speed: 1, coinMul: 1, invulnBonus: 0, magnet: 0, reachBonus: 0, jumpBoost: 0 };
    d.apply(s);
    return s.maxLives > 3;
  });
  if (hearts.length > 2) issues.push('加愛心的裝備還有 ' + hearts.length + ' 件：' + hearts.map(function (d) { return d.name; }).join('、'));

  function stage(owned) {
    const stats = Equipment.resolve(owned);
    const st = buildLevelState(lv, li, owned, stats);
    st.enemies = [];
    const p = st.player;
    const g = lv.groundSegs[0];
    p.x = g.x + 40; p.y = g.y - p.h; p.vy = 0; p.facing = 1;
    return st;
  }
  function addEnemy(st, type, dx) {
    const p = st.player;
    const e = makeEnemy({ x: p.x + dx, type: type, left: p.x + dx - 2, right: p.x + dx + 40 });
    e.y = p.y + p.h - e.h; e.baseY = e.y; e.speed = 0;
    st.enemies.push(e);
    return e;
  }
  function run(st, frames, pressK) {
    const input = {
      isDown: function () { return false; },
      once: function (a) { return pressK && a === 'throw'; },
      endFrame: function () {}
    };
    for (let f = 0; f < frames; f++) {
      updatePlayer(st, input, f);
      updatePlayerShots(st);
      pressK = false;
    }
  }

  // B) 板球打盾兵
  let st = stage(['brolly']);
  const guard = addEnemy(st, 'guard', 120);
  run(st, 90, true);
  if (guard.alive) issues.push('板球丟出去沒有打倒前方 120px 的盾兵');

  // F) 沒裝備按 K
  st = stage([]);
  run(st, 2, true);
  if ((st.pshots || []).length) issues.push('沒有遠程裝備，按 K 卻丟出東西了');

  // C) 辣椒火球穿透
  st = stage(['paprika']);
  const row = [90, 150, 210].map(function (dx) { return addEnemy(st, 'spiker', dx); });
  run(st, 80, true);
  const down = row.filter(function (e) { return !e.alive; }).length;
  if (down < 3) issues.push('辣椒火球應該穿透一排，只打倒了 ' + down + ' / 3');

  // D) 重踩震波
  st = stage(['clogs']);
  const p = st.player;
  const target = addEnemy(st, 'walker', 0);
  const side = addEnemy(st, 'walker', 90);
  p.x = target.x + 2; p.y = target.y - p.h - 6; p.vy = 6; p.onGround = false;
  run(st, 3, false);
  if (target.alive) issues.push('木鞋：測試用的踩踏沒有踩倒目標');
  else if (side.alive) issues.push('木鞋重踩：旁邊 90px 的地面敵人沒有一起被震倒');

  // E) 大蒜
  const bossLv = Levels.list.filter(function (d) { return d.isBoss; })[0];
  const bi = Levels.list.indexOf(bossLv);
  function recoverLen(owned) {
    const s2 = buildLevelState(bossLv, bi, owned, Equipment.resolve(owned));
    s2.boss.phase = 'recover'; s2.boss.timer = 100;
    updateBoss(s2, 0);
    return s2.boss.timer;
  }
  if (!(recoverLen(['garlic']) > recoverLen([]) * 1.3)) issues.push('大蒜沒有讓魔王破綻期變長');

  return { issueCount: issues.length, issues: issues };
}
