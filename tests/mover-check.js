/**
 * 移動平台（電梯）乘載測試。
 *
 * 由來：x 軸電梯有個 bug —— 站上去會被「擠到旁邊」然後掉下去。
 * 原因是玩家跟著平台位移的程式寫在「垂直碰撞」裡，執行順序在
 * 水平碰撞之後，於是：
 *   平台往旁滑 → 玩家 x 沒跟上 → 平台邊緣從側面撞到玩家
 *   → 水平碰撞把玩家推開 → 一路被擠出平台。
 *
 * 這支測試用真物理驗三件事：
 *   1. 站著不動，相對平台不可以漂移（兩個軸向都要）
 *   2. 站著不動不可以掉下去
 *   3. 走幾步再放手，仍應留在平台上被載著走
 *
 * 在瀏覽器執行 runMoverCheck()。
 */
function runMoverCheck() {
  const issues = [];

  /** 單一情境：axis 軸向、pushFrames 按方向鍵的帧數 */
  function sim(axis, pushFrames, speed) {
    const st = buildLevelState(Levels.list[0], 0, [], Equipment.resolve([]));
    st.enemies = []; st.shots = []; st.secrets = [];
    const m = makeMover({
      x: 400, y: 300, w: 90, h: 18,
      axis: axis, range: 80, speed: speed || 1.2
    });
    st.movers = [m];
    // 乾淨的測試場地：一片遠一點的地面當「掉下去」的判定基準
    st.def = Object.assign({}, st.def, {
      ground: [{ x: 0, y: 460, w: 2000, h: 80 }],
      platforms: [], spikes: [], water: [],
      width: 2000, height: 480, bossArena: null
    });

    const p = st.player;
    let frame = 0;
    const inp = {
      isDown: function (a) { return a === 'right' && frame < pushFrames; },
      once: function () { return false; },
      endFrame: function () {}
    };

    // 先推進兩帧讓平台的 dx/dy 進入穩定狀態
    // （第一帧是從初始座標跳到正弦位置，位移量異常大）
    updateMovers(st.movers, 0);
    updateMovers(st.movers, 1);

    p.x = m.x + m.w / 2 - p.w / 2;
    p.y = m.y - p.h - 1;
    p.vx = 0; p.vy = 0;

    let landedAt = -1, rel0 = null, maxDrift = 0, fell = false;
    for (frame = 2; frame < 400; frame++) {
      updateMovers(st.movers, frame);
      updatePlayer(st, inp, frame);
      if (p.onGround && landedAt < 0) landedAt = frame;
      // 落地後等 2 帧再取基準（避免落地瞬間的修正量）
      if (landedAt >= 0 && frame === landedAt + 2) rel0 = p.x - m.x;
      if (rel0 != null) {
        maxDrift = Math.max(maxDrift, Math.abs((p.x - m.x) - rel0));
        if (p.y + p.h >= 459) fell = true;
      }
    }
    const stillOn = (p.x + p.w) > m.x && p.x < (m.x + m.w);
    return {
      axis: axis, landedAt: landedAt, fell: fell,
      maxDrift: maxDrift, stillOn: stillOn
    };
  }

  ['x', 'y'].forEach(function (axis) {
    const label = axis === 'x' ? '水平電梯' : '垂直電梯';

    // 1 + 2：站著不動
    const still = sim(axis, 0);
    if (still.landedAt < 0) {
      issues.push(label + '：玩家根本沒站上平台（測試場景有問題）');
    } else {
      if (still.maxDrift > 1.5) {
        issues.push(label + '：站著不動卻相對平台漂移 ' +
          Math.round(still.maxDrift) + 'px —— 乘客沒被正確載著走');
      }
      if (still.fell) {
        issues.push(label + '：站著不動卻被擠下平台');
      }
      if (!still.stillOn) {
        issues.push(label + '：站著不動卻離開了平台範圍');
      }
    }

    // 3：走幾步再放手
    const stepped = sim(axis, 8);
    if (stepped.fell) {
      issues.push(label + '：走幾步後放手就掉下去了（應該留在平台上）');
    }
    if (!stepped.stillOn) {
      issues.push(label + '：走幾步後放手就離開平台（應該被載著走）');
    }
  });

  // 快速平台也要能載人（速度越快，漂移 bug 越明顯）
  const fast = sim('x', 0, 2.0);
  if (fast.maxDrift > 2) {
    issues.push('高速水平電梯：站著不動漂移 ' + Math.round(fast.maxDrift) + 'px');
  }
  if (fast.fell) {
    issues.push('高速水平電梯：站著不動卻被擠下平台');
  }

  return { issueCount: issues.length, issues: issues };
}
