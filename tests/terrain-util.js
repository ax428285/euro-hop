/**
 * 地形查詢工具（測試共用）。
 *
 * 為什麼需要這個：關卡現在有「往上爬 / 往下走」的走向，地面不再
 * 固定在 Levels.GROUND_Y。測試裡任何「玩家站在地上」「裝飾貼著地面」
 * 「平台不能沉入地面」的判斷，都必須問「那個 x 的地面在哪」，
 * 不能再用單一常數。
 *
 * 先前所有測試都寫死 GROUND_Y，導致垂直關卡冒出大量假警報
 * （密室「在地面以下」其實是在它那段地面的正確高度）。
 */

/** 某個 x 的地面頂端（取最高的一層；沒有地面回 null） */
function groundTopAt(def, x) {
  let best = null;
  (def.ground || []).forEach(function (s) {
    if (x >= s.x && x <= s.x + s.w) {
      if (best == null || s.y < best) best = s.y;
    }
  });
  return best;
}

/** 某個矩形範圍內，地面的最高點與最低點 */
function groundRangeIn(def, x0, x1) {
  let hi = null, lo = null;
  (def.ground || []).forEach(function (s) {
    if (s.x + s.w < x0 || s.x > x1) return;
    if (hi == null || s.y < hi) hi = s.y;
    if (lo == null || s.y > lo) lo = s.y;
  });
  return { highest: hi, lowest: lo };
}

/** 這一關的世界高度（垂直關卡比畫面高） */
function worldHeightOf(def) {
  return def.height || 480;
}

/** 把地面段轉成斷崖清單 */
function gapsOfDef(def) {
  const out = [];
  const g = (def.ground || []).slice().sort(function (a, b) { return a.x - b.x; });
  for (let i = 0; i < g.length - 1; i++) {
    const end = g[i].x + g[i].w;
    const start = g[i + 1].x;
    if (start > end) {
      out.push({
        x: end, w: start - end,
        leftY: g[i].y, rightY: g[i + 1].y
      });
    }
  }
  return out;
}
