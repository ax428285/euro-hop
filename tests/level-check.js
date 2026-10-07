/**
 * 關卡靜態檢查。
 *
 * 心法：不要用「距地面高度」這種啟發式規則去猜 —— 平台是靠階梯式往上踩的，
 * 單看高度會噴一堆假警報。真正可靠的做法是用遊戲自己的物理去模擬軌跡。
 *
 * 在瀏覽器執行 runLevelCheck()。
 */
function runLevelCheck() {
  const issues = [];

  const PH = PHYS.JUMP_V * PHYS.JUMP_V / (2 * PHYS.GRAVITY);
  const AIR = (-PHYS.JUMP_V / PHYS.GRAVITY) * 2;
  const REACH = PHYS.MAX_RUN * AIR;

  Levels.list.forEach(function (def, li) {
    /*
     * 豎井關（layout === 'shaft'）跳過。
     *
     * 這支檢查的每一條規則都預設「橫向關卡」：斷崖可跳、終點在最後一段
     * 地面上、敵人不該飄在斷崖上空⋯⋯。豎井關沒有 ground（底下是無底洞）、
     * 沒有 x 方向的終點，套進來只會噴一堆無意義的錯（實測直接 throw）。
     * 它的專屬約束由 tests/shaft-check.js 負責。
     */
    if (def.layout === 'shaft') return;

    const tag = '關 ' + (li + 1) + ' ' + def.country;
    const solids = def.ground.concat(def.platforms || []);
    const hazards = (def.spikes || []).concat(def.water || []);

    // 斷崖清單
    const gaps = [];
    for (let i = 0; i < def.ground.length - 1; i++) {
      const a = def.ground[i], b = def.ground[i + 1];
      const x0 = a.x + a.w, w = b.x - x0;
      if (w > 0) gaps.push({ x: x0, w: w });
    }

    // ── 1. 每個斷崖都要有一條可行的跳躍軌跡 ──
    // 纜車關（v1.20）的山谷本來就跳不過去，改成檢查「有一台纜車兩頭都接得上月台」
    gaps.forEach(function (g) {
      if (def.vehicle === 'cable') {
        const ok = (def.movers || []).some(function (m) {
          const lo = m.x - m.range, hi = m.x + m.range + m.w;
          const leftY = groundTopAt(def, g.x - 4), rightY = groundTopAt(def, g.x + g.w + 4);
          // 兩頭離月台邊都在 8px 內，而且地板跟兩邊月台同高
          return Math.abs(lo - g.x) <= 8 && Math.abs(hi - (g.x + g.w)) <= 8 &&
                 m.y === leftY && m.y === rightY;
        });
        if (!ok) issues.push(tag + '：山谷 x=' + g.x + ' 寬 ' + g.w + ' 沒有兩頭都接得上月台的纜車');
        return;
      }
      if (!gapCrossable(g, solids, hazards, def)) {
        issues.push(tag + '：斷崖 x=' + g.x + ' 寬 ' + g.w +
          ' 找不到可行的跳躍軌跡（可能被上方平台擋住或太寬）');
      }
    });

    // ── 2. 裝備要拿得到 ──
    if (def.equipAt) {
      if (!equipReachable(def.equipAt, def)) {
        issues.push(tag + '：裝備 (' + def.equipAt.x + ',' + def.equipAt.y +
          ') 沒有可達的起跳平台');
      }
    }

    // ── 3. 終點必須在最後一段地面上 ──
    const lastSeg = def.ground[def.ground.length - 1];
    if (def.goal < lastSeg.x || def.goal > lastSeg.x + lastSeg.w) {
      issues.push(tag + '：終點 x=' + def.goal + ' 不在最後一段地面上');
    }

    // ── 4. 地面敵人不該飄在斷崖上空（它們沒有重力） ──
    //    空中單位由 ENEMY_KINDS.air 決定，不要在這裡寫死型別名稱，
    //    否則每加一種飛行敵人都要同步改測試。
    (def.enemies || []).forEach(function (en) {
      const kind = ENEMY_KINDS[en.type];
      if (kind && kind.air) return;
      gaps.forEach(function (g) {
        if (en.left < g.x + g.w && en.right > g.x) {
          issues.push(tag + '：地面敵人 x=' + en.x + ' 巡邏 [' +
            en.left + ',' + en.right + '] 會飄過斷崖 x=' + g.x);
        }
      });
    });

    // ── 4b. 移動平台的行程不可沉入地面或飛出畫面 ──
    //
    // 「地面」要看平台所在位置的實際地面高度（關卡有起伏），
    // 不能用單一的 GROUND_Y，否則垂直關卡會噴一堆假警報。
    (def.movers || []).forEach(function (m) {
      // 平台行程覆蓋的 x 範圍內，地面最高的那層（y 最小）才是會擋到的
      const span = m.axis === 'x'
        ? { a: m.x - m.range, b: m.x + m.range + m.w }
        : { a: m.x, b: m.x + m.w };
      const gr = groundRangeIn(def, span.a, span.b);
      const floor = gr.highest;   // 最高的地面 = 最先擋到平台的

      if (m.axis === 'y') {
        const lowest = m.y + m.range;       // 最低點（y 往下為正）
        const highest = m.y - m.range;
        if (floor != null && lowest + m.h > floor) {
          issues.push(tag + '：移動平台 x=' + m.x + ' 最低點 ' +
            Math.round(lowest + m.h) + ' 沉入地面 ' + floor);
        }
        if (highest < 60) {
          issues.push(tag + '：移動平台 x=' + m.x + ' 最高點 ' +
            Math.round(highest) + ' 衝進 HUD 區（< 60）');
        }
      } else {
        const left = m.x - m.range, right = m.x + m.range + m.w;
        if (left < 0 || right > def.width + 200) {
          issues.push(tag + '：移動平台 x=' + m.x + ' 水平行程 [' +
            Math.round(left) + ',' + Math.round(right) + '] 超出關卡範圍');
        }
        // 水平移動平台也不該穿進地面
        if (floor != null && m.y + m.h > floor) {
          issues.push(tag + '：移動平台 x=' + m.x + ' y=' + m.y +
            ' 沉入地面 ' + floor);
        }
      }
    });

    // ── 5a. 前景道具不該互相重疊（背景層有視差，不檢查） ──
    const fg = (def.props || []).filter(function (p) {
      return (Sprites.propLayer[p.type] || 'fg') === 'fg';
    }).map(function (p) {
      const w = Sprites.propWidth[p.type] || 100;
      return { type: p.type, x: p.x, left: p.x - w / 2, right: p.x + w / 2 };
    }).sort(function (a, b) { return a.left - b.left; });

    for (let i = 0; i < fg.length - 1; i++) {
      const a = fg[i], b = fg[i + 1];
      const ov = a.right - b.left;
      if (ov > 10) {
        issues.push(tag + '：前景道具 ' + a.type + ' (x=' + a.x + ') 與 ' +
          b.type + ' (x=' + b.x + ') 重疊 ' + Math.round(ov) + 'px');
      }
    }

    // ── 5b. 前景道具不該站在斷崖上空（會浮空） ──
    fg.forEach(function (p) {
      // 橋與漁船是刻意跨/浮在斷崖上的，排除
      if (p.type === 'bridge' || p.type === 'fishBoat') return;
      gaps.forEach(function (g) {
        if (p.x > g.x - 8 && p.x < g.x + g.w + 8) {
          issues.push(tag + '：前景道具 ' + p.type + ' (x=' + p.x +
            ') 站在斷崖 x=' + g.x + ' 上空');
        }
      });
    });

    // ── 5c. 前景道具不該被平台壓住（視覺穿模） ──
    fg.forEach(function (p) {
      // 以道具所在的地面高度判斷「低平台」，不是全關統一的 GROUND_Y
      const gy = groundTopAt(def, p.x);
      if (gy == null) return;
      (def.platforms || []).forEach(function (pf) {
        // 只抓貼近地面的低平台（高平台在道具上方，正常）
        if (pf.y < gy - 90) return;
        const ov = Math.min(pf.x + pf.w, p.right) - Math.max(pf.x, p.left);
        if (ov > 20) {
          issues.push(tag + '：前景道具 ' + p.type + ' (x=' + p.x +
            ') 被低平台 x=' + pf.x + ' y=' + pf.y + ' 壓住');
        }
      });
    });

    // ── 5d. 高大的背景建築不該跟平台重疊（有視差，但起始位置重疊看起來就是穿模） ──
    // 背景層畫在 0.78 視差，camX=0 時位置與世界座標相同，先用這個最保守的情況檢查。
    const bg = (def.props || []).filter(function (p) {
      return (Sprites.propLayer[p.type] || 'fg') === 'bg';
    }).map(function (p) {
      const w = Sprites.propWidth[p.type] || 100;
      return { type: p.type, x: p.x, left: p.x - w / 2, right: p.x + w / 2 };
    });

    bg.forEach(function (p) {
      if (p.type === 'cableCar') return;   // 纜車是刻意橫跨整個天空的
      const gy = groundTopAt(def, p.x);
      if (gy == null) return;
      (def.platforms || []).forEach(function (pf) {
        const ov = Math.min(pf.x + pf.w, p.right) - Math.max(pf.x, p.left);
        // 只抓重疊很明顯的（建築高度大致 60~180，平台在這區間內才會視覺打架）
        if (ov > 30 && pf.y > gy - 180) {
          issues.push(tag + '：背景建築 ' + p.type + ' (x=' + p.x +
            ') 與平台 x=' + pf.x + ' y=' + pf.y + ' 重疊 ' + Math.round(ov) + 'px');
        }
      });
    });

    // ── 6. 金幣不該埋在實體裡（拿不到） ──
    (def.coins || []).forEach(function (c) {
      const box = { x: c.x, y: c.y, w: 24, h: 24 };
      for (let i = 0; i < solids.length; i++) {
        const s = solids[i];
        // 容許貼著表面，只抓「整顆陷進去」的
        const ov = Math.min(box.x + box.w, s.x + s.w) - Math.max(box.x, s.x);
        const ovY = Math.min(box.y + box.h, s.y + s.h) - Math.max(box.y, s.y);
        if (ov > 14 && ovY > 14) {
          issues.push(tag + '：金幣 (' + c.x + ',' + c.y + ') 埋在實體 x=' + s.x + ' 裡');
          break;
        }
      }
    });
  });

  return {
    jumpHeight: Math.round(PH),
    airTime: Math.round(AIR),
    horizontalReach: Math.round(REACH),
    issueCount: issues.length,
    issues: issues
  };
}

/** 玩家碰撞箱 */
const CHK_W = 22, CHK_H = 40;

function chkHit(x, y, list) {
  const b = { x: x, y: y, w: CHK_W, h: CHK_H };
  for (let i = 0; i < list.length; i++) if (U.overlap(b, list[i])) return list[i];
  return null;
}

/**
 * 斷崖是否可跨越。
 *
 * 重點：只接受「玩家真的會用的跳法」—— 走到邊緣、全速、按住跳躍鍵。
 * 如果只有某種刁鑽的短按組合才過得去，那對玩家來說等於過不去，要算失敗。
 */
function gapCrossable(gap, solids, hazards, def) {
  const landX = gap.x + gap.w;
  // 起跳點的地面高度：關卡有高低起伏，不能假設都在 GROUND_Y
  const takeoffY = groundTopAt(def, gap.x - 8);
  if (takeoffY == null) return true;   // 斷崖左側沒有地面（關卡開頭），不檢查

  // 邊緣起跳：玩家通常在前緣 0~24px 內起跳
  const starts = [0, 4, 8, 14, 20, 24];
  for (let si = 0; si < starts.length; si++) {
    // 按住跳躍鍵（全高跳）
    if (simJump(gap.x - CHK_W - starts[si], takeoffY, 999, landX, solids, hazards, def)) {
      return true;
    }
  }
  return false;
}

/** 查某個 x 的地面頂端高度（取最高的那層地面） */
function groundTopAt(def, x) {
  let best = null;
  def.ground.forEach(function (s) {
    if (x >= s.x && x <= s.x + s.w) {
      if (best == null || s.y < best) best = s.y;
    }
  });
  return best;
}

/**
 * 用遊戲真正的物理數值跑一次跳躍。
 * 回傳是否安全落在 landX 之後的實體上。
 */
function simJump(x0, takeoffY, holdFrames, landX, solids, hazards, def) {
  let x = x0;
  // 從實際的地面高度起跳（關卡有起伏，不是固定 GROUND_Y）
  let y = (takeoffY == null ? Levels.GROUND_Y : takeoffY) - CHK_H;
  let vx = PHYS.MAX_RUN;         // 全速助跑
  let vy = PHYS.JUMP_V;

  for (let f = 0; f < 120; f++) {
    // 放開跳躍鍵後上升速度衰減（跟 updatePlayer 一致）
    if (f >= holdFrames && vy < 0) vy *= PHYS.JUMP_CUT;

    vy = Math.min(vy + PHYS.GRAVITY, PHYS.MAX_FALL);

    // 水平
    x += vx;
    const hw = chkHit(x, y, solids);
    if (hw) {
      // 撞到側面 → 這條軌跡失敗（除非已經過了落地點且是站上去）
      x = hw.x - CHK_W;
      vx = 0;
    }

    // 垂直
    y += vy;
    const hv = chkHit(x, y, solids);
    if (hv) {
      if (vy >= 0) {
        // 落地
        y = hv.y - CHK_H;
        if (x + CHK_W > landX && !chkHit(x, y, hazards)) return true;
        return false;   // 落在斷崖內或原地
      }
      // 撞頭 → 被天花板打斷，繼續掉（通常就失敗了）
      y = hv.y + hv.h;
      vy = 0;
    }

    // 掉進危險區或掉出世界底部
    if (chkHit(x, y, hazards)) return false;
    // ⚠️ 不能寫死 520：垂直關卡的世界高達 860，
    // 用固定值會讓還在正常飛行的軌跡被判定「掉出畫面」而失敗。
    if (y > (def.height || 480) + 40) return false;
  }
  return false;
}

/** 裝備是否可達：從任一表面起跳能不能碰到 */
function equipReachable(e, def) {
  const surfaces = def.ground.concat(def.platforms || []);
  // 移動平台取其行程兩端
  (def.movers || []).forEach(function (m) {
    if (m.axis === 'y') {
      surfaces.push({ x: m.x, y: m.y - m.range, w: m.w, h: m.h });
      surfaces.push({ x: m.x, y: m.y + m.range, w: m.w, h: m.h });
    } else {
      surfaces.push({ x: m.x - m.range, y: m.y, w: m.w, h: m.h });
      surfaces.push({ x: m.x + m.range, y: m.y, w: m.w, h: m.h });
    }
  });

  const PH = PHYS.JUMP_V * PHYS.JUMP_V / (2 * PHYS.GRAVITY);
  const AIR = (-PHYS.JUMP_V / PHYS.GRAVITY) * 2;
  const REACH = PHYS.MAX_RUN * AIR;

  // 裝備的拾取範圍（entities.js 用 30x30 置中）
  const box = { x: e.x - 15, y: e.y - 15, w: 30, h: 30 };

  for (let i = 0; i < surfaces.length; i++) {
    const s = surfaces[i];
    // 站在這個表面上時，玩家身體佔的垂直範圍
    const standTop = s.y - CHK_H;
    // 跳起來頭頂能到的最高點
    const peakTop = standTop - PH;
    // 裝備底邊要在 [peakTop, standTop + CHK_H] 之間才碰得到
    if (box.y + box.h < peakTop) continue;
    if (box.y > s.y + 10) continue;
    // 水平距離要在半個跳躍射程內
    const dx = Math.max(0, Math.max(s.x - (box.x + box.w), box.x - (s.x + s.w)));
    if (dx <= REACH * 0.55) return true;
  }
  return false;
}
