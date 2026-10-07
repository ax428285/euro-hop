/**
 * 地圖版面檢查。
 *
 * 用 measureText 實際量文字框，抓三類問題：
 *   1. 標籤或國界跑到上/下 UI 條底下（會被蓋住）
 *   2. 標籤互相重疊
 *   3. 標籤壓到別國的圖釘（會誤導「這名字是誰的」）
 *
 * 在瀏覽器執行 runMapCheck()。
 */
function runMapCheck() {
  const issues = [];
  const ctx = document.getElementById('game').getContext('2d');
  const W = WorldMap.WORLD_W, H = WorldMap.WORLD_H;   // 世界座標（v1.4 起地圖會捲動）
  const top = WorldMap.MAP_TOP;
  const bottom = WorldMap.MAP_BOTTOM;

  /** 算出標籤的實際邊界框（跟 U.text 的對齊方式一致） */
  function labelBox(n, size) {
    const lv = Levels.list[n.idx];
    ctx.font = '600 ' + size + 'px "Segoe UI", "Microsoft JhengHei", sans-serif';
    const w = ctx.measureText(lv.country).width;
    const align = n.labelAlign || 'center';
    let x = n.label[0];
    if (align === 'center') x -= w / 2;
    else if (align === 'right') x -= w;
    // textBaseline = middle，高度約 size * 1.2
    const h = size * 1.2;
    return { x: x - 3, y: n.label[1] - h / 2, w: w + 6, h: h, name: lv.country };
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // 用「被選取」的字級量（最大的狀況），確保最壞情況也不衝突
  const boxes = WorldMap.nations.map(function (n) { return labelBox(n, WorldMap.LABEL_SIZE_SEL); });

  // ── 1. 標籤必須完全在可用地圖區域內 ──
  boxes.forEach(function (b, i) {
    if (b.y < top) {
      issues.push('標籤「' + b.name + '」頂端 ' + Math.round(b.y) +
        ' 高於地圖上緣 ' + top + '（會被頂部標題條蓋住）');
    }
    if (b.y + b.h > bottom) {
      issues.push('標籤「' + b.name + '」底端 ' + Math.round(b.y + b.h) +
        ' 低於地圖下緣 ' + bottom + '（會被底部資訊卡蓋住）');
    }
    if (b.x < 4) {
      issues.push('標籤「' + b.name + '」左緣 ' + Math.round(b.x) + ' 超出畫面');
    }
    if (b.x + b.w > W - 4) {
      issues.push('標籤「' + b.name + '」右緣 ' + Math.round(b.x + b.w) +
        ' 超出畫面寬 ' + W);
    }
  });

  // ── 2. 標籤之間不可重疊 ──
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (rectsOverlap(boxes[i], boxes[j])) {
        issues.push('標籤「' + boxes[i].name + '」與「' + boxes[j].name + '」重疊');
      }
    }
  }

  // ── 3. 標籤不可壓到任何圖釘（含旗子），自己的也不行 ──
  //
  // 國名改成印在國土上之後，標籤跟圖釘在同一塊地上，
  // 壓到自己的旗子一樣會讀不到字。佔用範圍用 WorldMap.pinBox（跟擺放邏輯同一份）。
  WorldMap.nations.forEach(function (n, pi) {
    const pin = WorldMap.pinBox(n.pin);
    boxes.forEach(function (b, bi) {
      if (rectsOverlap(b, pin)) {
        issues.push('標籤「' + b.name + '」壓到 ' +
          Levels.list[n.idx].country + ' 的圖釘/旗子');
      }
    });
  });

  // ── 3b. 標籤要離「自己的」圖釘足夠近，否則看不出屬於誰 ──
  WorldMap.nations.forEach(function (n, i) {
    const b = boxes[i];
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const d = Math.hypot(cx - n.pin[0], cy - n.pin[1]);
    if (d > 110) {
      issues.push('標籤「' + b.name + '」距離自己的圖釘 ' + Math.round(d) +
        'px，太遠會看不出對應關係');
    }
  });

  // ── 4. 國界輪廓要在可用區域內 ──
  //
  // 幾何資料是真實地理投影（EuropeGeo），一個國家可能有多個 shape
  // （本土 + 離島），所以走 n.shapes 而不是舊的 n.pts。
  // 國界允許被畫面邊緣裁切（歐洲本來就延伸到畫面外），
  // 這裡只檢查「圖釘與標籤」這些必須看得見的東西。
  function checkPts(pts, who) {
    let outTop = 0, outBottom = 0;
    pts.forEach(function (p) {
      if (p[1] < top) outTop++;
      if (p[1] > bottom) outBottom++;
    });
    // 整塊都在可用區外才算問題（部分超出是正常的裁切）
    if (outTop === pts.length) issues.push(who + ' 整塊都在地圖上緣之外');
    if (outBottom === pts.length) issues.push(who + ' 整塊都在地圖下緣之外');
  }
  WorldMap.nations.forEach(function (n) {
    const name = Levels.list[n.idx].country;
    (n.shapes || []).forEach(function (sh, si) {
      checkPts(sh, '國界「' + name + '」#' + (si + 1));
    });
    // 圖釘必須完全可見（含上方旗子）
    if (n.pin[1] - 30 < top) {
      issues.push(name + ' 的圖釘旗子頂端 ' + Math.round(n.pin[1] - 30) +
        ' 會被標題條蓋住');
    }
    if (n.pin[1] + 6 > bottom) {
      issues.push(name + ' 的圖釘 ' + Math.round(n.pin[1]) + ' 會被底部資訊卡蓋住');
    }
    if (n.pin[0] < 20 || n.pin[0] > W - 20) {
      issues.push(name + ' 的圖釘 x=' + Math.round(n.pin[0]) + ' 太靠畫面邊緣');
    }
  });

  // ── 5. 圖釘之間要分得開，否則點擊選不準（hitTest 半徑 40） ──
  for (let i = 0; i < WorldMap.nations.length; i++) {
    for (let j = i + 1; j < WorldMap.nations.length; j++) {
      const a = WorldMap.nations[i].pin, b = WorldMap.nations[j].pin;
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (d < 34) {
        issues.push('圖釘「' + Levels.list[WorldMap.nations[i].idx].country +
          '」與「' + Levels.list[WorldMap.nations[j].idx].country +
          '」距離只有 ' + Math.round(d) + 'px，點擊會選錯');
      }
    }
  }

  // ── 6. 每個圖釘都要落在自己的國界內 ──
  //
  // 這條最重要：圖釘是「可以點、代表這一國」的東西，
  // 掉到鄰國身上玩家會以為自己在選別的國家。
  // 真實地理資料的 center 是 bounding box 中心，對於彎曲的國家
  // （例如希臘、挪威）可能落在國境外，所以必須驗。
  function inPoly(pt, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > pt[1]) !== (yj > pt[1])) &&
          (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  // ── 7. 國名要印在自己的國土上（字的中心在國界內） ──
  WorldMap.nations.forEach(function (n) {
    const ok = (n.shapes || []).some(function (sh) { return inPoly(n.label, sh); });
    if (!ok) issues.push('標籤「' + Levels.list[n.idx].country + '」不在自己的國土上');
  });

  WorldMap.nations.forEach(function (n) {
    const ownName = Levels.list[n.idx].country;
    const inOwn = (n.shapes || []).some(function (sh) { return inPoly(n.pin, sh); });
    if (!inOwn) {
      issues.push(ownName + ' 的圖釘 (' + Math.round(n.pin[0]) + ',' +
        Math.round(n.pin[1]) + ') 不在自己的國界內');
    }
    // 也不可落在別國的國界內
    WorldMap.nations.forEach(function (o) {
      if (o === n) return;
      const inOther = (o.shapes || []).some(function (sh) { return inPoly(n.pin, sh); });
      if (inOther) {
        issues.push(ownName + ' 的圖釘落在 ' +
          Levels.list[o.idx].country + ' 的國界內');
      }
    });
  });

  return { issueCount: issues.length, issues: issues, mapTop: top, mapBottom: bottom };
}
