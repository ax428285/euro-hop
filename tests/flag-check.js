/**
 * 國旗畫法檢查。
 *
 * 主題是「遊歐洲」，旗子畫錯方向很丟臉（荷蘭/德國是橫三色，不是直的）。
 * 這支測試把每面旗畫到離屏 canvas，取樣像素，驗證條紋方向與顏色順序。
 *
 * 在瀏覽器執行 runFlagCheck()。
 */
function runFlagCheck() {
  const issues = [];

  // 各國旗的「正確事實」—— 參照真實國旗
  const expected = {
    ES: { dir: 'esp', order: null },                         // 紅黃紅 橫（中帶較寬）
    FR: { dir: 'v', order: ['blue', 'white', 'red'] },       // 藍白紅 直
    GB: { dir: 'uk', order: null },                          // 米字旗
    NL: { dir: 'h', order: ['red', 'white', 'blue'] },       // 紅白藍 橫
    DE: { dir: 'h', order: ['black', 'red', 'gold'] },       // 黑紅金 橫
    CZ: { dir: 'cze', order: null },                         // 白紅橫 + 左側藍三角
    AT: { dir: 'h', order: ['red', 'white', 'red'] },        // 紅白紅 橫
    CH: { dir: 'cross', order: null },                       // 紅底白十字
    IT: { dir: 'v', order: ['green', 'white', 'red'] },      // 綠白紅 直
    GR: { dir: 'greek', order: null },                       // 藍白橫紋 + 角十字
    PL: { dir: 'h2', order: ['white', 'red'] },              // 白紅 兩色橫
    HU: { dir: 'h', order: ['red', 'white', 'green'] },      // 紅白綠 橫
    RO: { dir: 'v', order: ['blue', 'gold', 'red'] },        // 藍黃紅 直
    SK: { dir: 'h', order: ['white', 'blue', 'red'] },       // 白藍紅 橫（國徽省略）
    HR: { dir: 'h', order: ['red', 'white', 'blue'] },       // 紅白藍 橫（棋盤國徽省略）
    RS: { dir: 'h', order: ['red', 'blue', 'white'] },       // 紅藍白 橫（國徽省略）
    BG: { dir: 'h', order: ['white', 'green', 'red'] },      // 白綠紅 橫
    UA: { dir: 'h2', order: ['blue', 'gold'] },              // 藍黃 兩色橫
    // v1.21 非洲篇
    MA: { dir: 'star', order: null },                        // 紅底，中央綠色五角星（空心線條）
    // v1.23
    DZ: { dir: 'dz', order: null },                          // 左綠右白，中央紅新月＋紅星
    TN: { dir: 'tn', order: null },                          // 紅底，中央白圓盤裡紅新月＋紅星
    LY: { dir: 'ly', order: null },                          // 紅黑綠（1:2:1），黑帶裡白新月＋白星
    EG: { dir: 'eg', order: null },                          // 紅白黑橫三色，中央金鷹
    // v1.30 北歐篇：北歐十字（直條偏旗桿那側）
    DK: { dir: 'nordic', field: 'red', cross: 'white' },
    SE: { dir: 'nordic', field: 'blue', cross: 'gold' },
    NO: { dir: 'nordic', field: 'red', cross: 'white', inner: 'blue' },
    FI: { dir: 'nordic', field: 'white', cross: 'blue' },
    IS: { dir: 'nordic', field: 'blue', cross: 'white', inner: 'red' },
    // v1.31 美洲篇：取幾個特徵點驗顏色（points: [x 比例, y 比例, 顏色]）
    CU: { dir: 'cuba', points: [[0.9, 0.1, 'blue'], [0.9, 0.3, 'white'], [0.06, 0.2, 'red'], [0.15, 0.5, 'white']] },        // 藍白五條＋紅三角白星
    JM: { dir: 'jamaica', points: [[0.5, 0.06, 'green'], [0.5, 0.94, 'green'], [0.06, 0.5, 'black'], [0.94, 0.5, 'black'], [0.5, 0.5, 'gold']] },
    MX: { dir: 'mexico', points: [[0.15, 0.5, 'green'], [0.5, 0.15, 'white'], [0.85, 0.5, 'red']] },                         // 綠白紅直條＋國徽
    PA: { dir: 'panama', points: [[0.75, 0.25, 'red'], [0.25, 0.75, 'blue'], [0.05, 0.05, 'white'], [0.25, 0.25, 'blue'], [0.75, 0.75, 'red']] },
    CO: { dir: 'colombia', points: [[0.5, 0.2, 'gold'], [0.5, 0.62, 'blue'], [0.5, 0.88, 'red']] },                          // 黃（一半）藍紅
    BR: { dir: 'brazil', points: [[0.04, 0.06, 'green'], [0.3, 0.5, 'gold'], [0.5, 0.4, 'blue']] }                           // 綠底黃菱形藍球
  };

  const cv = document.createElement('canvas');
  cv.width = 120; cv.height = 90;
  const c = cv.getContext('2d');

  function px(x, y) {
    const d = c.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    return [d[0], d[1], d[2]];
  }

  /** 把 RGB 歸類成粗略色名，避免逐一比對 hex */
  function name(rgb) {
    const r = rgb[0], g = rgb[1], b = rgb[2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx < 60) return 'black';
    if (mn > 200) return 'white';
    if (r > 150 && g > 110 && b < 90) return 'gold';
    if (r > 120 && r > g * 1.6 && r > b * 1.6) return 'red';
    // 綠：保加利亞國旗的官方綠 #00966E 偏藍綠（b=110），門檻放寬到 b 的 1.2 倍
    if (g > 90 && g > r * 1.4 && g > b * 1.2) return 'green';
    if (b > 90 && b > r * 1.3 && b >= g) return 'blue';
    return 'other(' + rgb.join(',') + ')';
  }

  Levels.list.forEach(function (lv) {
    const exp = expected[lv.id];
    if (!exp) { issues.push(lv.id + ' 沒有預期的旗子定義'); return; }

    // 資料裡宣告的方向要跟事實一致
    if ((lv.flagDir || 'v') !== exp.dir) {
      issues.push(lv.country + ' 的 flagDir=' + (lv.flagDir || 'v') +
        '，正確應為 ' + exp.dir);
    }

    // 實際畫出來再驗
    const W = 90, H = 60;
    c.clearRect(0, 0, cv.width, cv.height);
    Sprites.flagFace(c, 0, 0, W, H, lv.flag, lv.flagDir);
    (exp.points || []).forEach(function (q) {
      const got = name(px(W * q[0], H * q[1]));
      if (got !== q[2]) issues.push(lv.country + ' 國旗 (' + q[0] + ', ' + q[1] + ') 應為 ' + q[2] + '，量到 ' + got);
    });

    if (exp.dir === 'v') {
      // 直三色：橫向取三點應該是三種色，縱向同一欄應該同色
      const got = [px(W / 6, H / 2), px(W / 2, H / 2), px(W * 5 / 6, H / 2)].map(name);
      if (got.join(',') !== exp.order.join(',')) {
        issues.push(lv.country + ' 直三色順序錯：量到 [' + got.join(', ') +
          ']，應為 [' + exp.order.join(', ') + ']');
      }
      const top = name(px(W / 6, H * 0.2));
      const bot = name(px(W / 6, H * 0.8));
      if (top !== bot) {
        issues.push(lv.country + ' 宣告直三色，但同一欄上下色不同（' +
          top + ' vs ' + bot + '）→ 實際畫成橫的');
      }
    } else if (exp.dir === 'h') {
      // 橫三色：縱向取三點應是三種色，橫向同一列應同色
      const got = [px(W / 2, H / 6), px(W / 2, H / 2), px(W / 2, H * 5 / 6)].map(name);
      if (got.join(',') !== exp.order.join(',')) {
        issues.push(lv.country + ' 橫三色順序錯：量到 [' + got.join(', ') +
          ']，應為 [' + exp.order.join(', ') + ']');
      }
      const left = name(px(W * 0.2, H / 6));
      const right = name(px(W * 0.8, H / 6));
      if (left !== right) {
        issues.push(lv.country + ' 宣告橫三色，但同一列左右色不同（' +
          left + ' vs ' + right + '）→ 實際畫成直的');
      }
    } else if (exp.dir === 'h2') {
      const got = [px(W / 2, H / 4), px(W / 2, H * 3 / 4)].map(name);
      if (got.join(',') !== exp.order.join(',')) {
        issues.push(lv.country + ' 兩色橫條順序錯：量到 [' + got.join(', ') +
          ']，應為 [' + exp.order.join(', ') + ']');
      }
    } else if (exp.dir === 'cross') {
      // 瑞士：中心白、四角紅
      const center = name(px(W / 2, H / 2));
      const corner = name(px(4, 4));
      if (center !== 'white') {
        issues.push(lv.country + ' 應為白十字，中心量到 ' + center);
      }
      if (corner !== 'red') {
        issues.push(lv.country + ' 應為紅底，左上角量到 ' + corner);
      }
    } else if (exp.dir === 'greek') {
      // 希臘：右側應有藍白交替橫紋；左上角十字中心為白
      const s1 = name(px(W * 0.85, H * (0.5 / 9)));
      const s2 = name(px(W * 0.85, H * (1.5 / 9)));
      if (s1 === s2) {
        issues.push(lv.country + ' 橫紋沒有交替（連續兩條都是 ' + s1 + '）');
      }
      if (s1 !== 'blue') {
        issues.push(lv.country + ' 最上面一條應為藍，量到 ' + s1);
      }
      // 角旗十字的中心線（垂直臂）應是白
      const crossSize = H * (5 / 9);
      const arm = name(px(crossSize / 2, crossSize * 0.25));
      if (arm !== 'white') {
        issues.push(lv.country + ' 角旗十字的垂直臂應為白，量到 ' + arm);
      }
    } else if (exp.dir === 'esp') {
      // 西班牙：紅-黃-紅 橫三條，黃色帶是中間那半
      const t1 = name(px(W / 2, H * 0.12));
      const t2 = name(px(W / 2, H * 0.5));
      const t3 = name(px(W / 2, H * 0.88));
      if (t1 !== 'red' || t3 !== 'red') {
        issues.push(lv.country + ' 上下應為紅，量到 ' + t1 + ' / ' + t3);
      }
      if (t2 !== 'gold') {
        issues.push(lv.country + ' 中間應為黃，量到 ' + t2);
      }
      // 同一列左右要同色（確認不是畫成直的）
      if (name(px(W * 0.15, H * 0.5)) !== name(px(W * 0.85, H * 0.5))) {
        issues.push(lv.country + ' 宣告橫條，但同一列左右色不同 → 實際畫成直的');
      }
    } else if (exp.dir === 'uk') {
      // 英國米字旗：藍底、正十字中心為紅、對角線上要有紅色。
      // 取樣點要避開對角帶 —— 左上角正好在對角線上，會量到紅/白。
      // 選「上緣偏左 1/4」這種落在藍色區塊的位置。
      const corner = name(px(W * 0.26, H * 0.08));
      if (corner !== 'blue') {
        issues.push(lv.country + ' 底色應為藍，藍區取樣量到 ' + corner);
      }
      const centre = name(px(W / 2, H / 2));
      if (centre !== 'red') {
        issues.push(lv.country + ' 正十字中心應為紅，量到 ' + centre);
      }
      // 正十字的橫臂（遠離中心處）也要是紅
      const armH = name(px(W * 0.12, H * 0.5));
      if (armH !== 'red') {
        issues.push(lv.country + ' 正十字橫臂應為紅，量到 ' + armH);
      }
      // 必須有對角元素（米字）。沿左上→右下的對角線取樣，
      // 該處應落在白或紅的對角帶上，而不是藍底。
      const diag = name(px(W * 0.2, H * 0.2));
      if (diag !== 'white' && diag !== 'red') {
        issues.push(lv.country + ' 缺少對角線（米字），對角取樣量到 ' + diag);
      }
    } else if (exp.dir === 'cze') {
      // 捷克：右上白、右下紅、左緣中央為藍三角
      const tr = name(px(W * 0.85, H * 0.2));
      const br = name(px(W * 0.85, H * 0.8));
      const leftMid = name(px(W * 0.06, H * 0.5));
      if (tr !== 'white') issues.push(lv.country + ' 右上應為白，量到 ' + tr);
      if (br !== 'red') issues.push(lv.country + ' 右下應為紅，量到 ' + br);
      if (leftMid !== 'blue') {
        issues.push(lv.country + ' 左緣中央應為藍三角，量到 ' + leftMid);
      }
    } else if (exp.dir === 'star') {
      // 摩洛哥：四角紅；正中央是星星中間的空心處（紅）；星星的線條是綠
      const corner = name(px(4, 4));
      if (corner !== 'red') issues.push(lv.country + ' 底色應為紅，左上角量到 ' + corner);
      // 星星最上面那個尖角附近一定有綠色線條（往上掃一段，找得到綠就算）
      let green = false;
      for (let y = H * 0.18; y < H * 0.5 && !green; y += 1) green = name(px(W / 2, y)) === 'green';
      if (!green) issues.push(lv.country + ' 中央應有綠色五角星，量不到綠色線條');
    } else if (exp.dir === 'dz') {
      // 阿爾及利亞：左上綠、右上白（左右兩半，不是上下）；中央附近有紅
      const tl = name(px(W * 0.1, H * 0.1)), tr = name(px(W * 0.9, H * 0.1));
      const bl = name(px(W * 0.1, H * 0.9));
      if (tl !== 'green' || bl !== 'green') issues.push(lv.country + ' 左半應為綠，量到 ' + tl + ' / ' + bl);
      if (tr !== 'white') issues.push(lv.country + ' 右半應為白，量到 ' + tr);
      let red = false;
      for (let x = W * 0.3; x < W * 0.7 && !red; x += 1) red = name(px(x, H / 2)) === 'red';
      if (!red) issues.push(lv.country + ' 中央應有紅色新月');
    } else if (exp.dir === 'tn') {
      // 突尼西亞：四角紅；中央橫線上有白（圓盤）也有紅（新月）
      if (name(px(4, 4)) !== 'red') issues.push(lv.country + ' 底色應為紅');
      let white = false, red = false;
      for (let x = W * 0.35; x < W * 0.65; x += 1) {
        const n = name(px(x, H / 2));
        if (n === 'white') white = true;
        if (n === 'red') red = true;
      }
      if (!white) issues.push(lv.country + ' 中央應有白色圓盤');
      if (!red) issues.push(lv.country + ' 白圓盤裡應有紅色新月');
    } else if (exp.dir === 'ly') {
      // 利比亞：上紅、中黑、下綠（橫條）；黑帶中央有白新月
      const t1 = name(px(W * 0.1, H * 0.1)), t2 = name(px(W * 0.1, H * 0.5)), t3 = name(px(W * 0.1, H * 0.9));
      if (t1 !== 'red' || t2 !== 'black' || t3 !== 'green') issues.push(lv.country + ' 橫條應為紅/黑/綠，量到 ' + [t1, t2, t3].join('/'));
      if (name(px(W * 0.9, H * 0.1)) !== 'red') issues.push(lv.country + ' 宣告橫條，但同一列左右色不同');
      let white = false;
      for (let x = W * 0.35; x < W * 0.65 && !white; x += 1) white = name(px(x, H / 2)) === 'white';
      if (!white) issues.push(lv.country + ' 黑帶中央應有白色新月');
    } else if (exp.dir === 'nordic') {
      // 北歐十字：四角是底色；十字中心、右臂、上臂是（內）十字色；十字偏左 → 右上半邊是底色
      const inner = exp.inner || exp.cross;
      const corner = name(px(4, 4));
      if (corner !== exp.field) issues.push(lv.country + ' 底色應為 ' + exp.field + '，左上角量到 ' + corner);
      const got = [px(W * 0.36, H / 2), px(W * 0.85, H / 2), px(W * 0.36, H * 0.08)].map(name);
      if (got.some(function (n) { return n !== inner; })) issues.push(lv.country + ' 十字應為 ' + inner + '，量到 ' + got.join('/'));
      if (name(px(W * 0.6, H * 0.12)) !== exp.field) issues.push(lv.country + ' 十字的直條應偏旗桿那側（右上應為底色）');
      if (exp.inner) {
        const border = name(px(W * 0.85, H / 2 - H * 0.1));
        if (border !== exp.cross) issues.push(lv.country + ' 內十字外面應有一圈 ' + exp.cross + '，量到 ' + border);
      }
    } else if (exp.dir === 'eg') {
      // 埃及：紅白黑橫三色（取樣避開中央的金鷹），中央是金色
      const got = [px(W * 0.15, H / 6), px(W * 0.15, H / 2), px(W * 0.15, H * 5 / 6)].map(name);
      if (got.join(',') !== 'red,white,black') issues.push(lv.country + ' 橫三色應為 紅,白,黑，量到 ' + got.join(','));
      if (name(px(W / 2, H / 2)) !== 'gold') issues.push(lv.country + ' 中央應有金色的鷹');
    }
  });

  // ── 收尾：不同 flagDir 必須真的畫出不同結果 ──
  //
  // 這條是補一個實際踩到的漏洞：新增的 'uk' / 'esp' / 'cze' 在
  // flagFace 裡沒有對應分支時，會靜默落到預設的「直三色」，
  // 結果英國關的 HUD 畫出法國國旗，而上面的逐項檢查卻全過。
  // 作法：確認每種方向畫出來的像素指紋都不一樣。
  const fingerprints = {};
  Object.keys(expected).forEach(function (id) {
    const lv = Levels.list.filter(function (l) { return l.id === id; })[0];
    if (!lv) return;
    c.clearRect(0, 0, cv.width, cv.height);
    Sprites.flagFace(c, 0, 0, 90, 60, lv.flag, lv.flagDir);
    // 取 5x4 網格的色名當指紋
    const fp = [];
    for (let gy = 0; gy < 4; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        fp.push(name(px(90 * (gx + 0.5) / 5, 60 * (gy + 0.5) / 4)));
      }
    }
    const key = fp.join('|');
    const dirKey = lv.flagDir || 'v';
    if (!fingerprints[dirKey]) fingerprints[dirKey] = {};
    fingerprints[dirKey][id] = key;
  });

  // 「宣告了特殊畫法」的國家，不該跟任何直三色國家畫出一樣的圖
  const plainV = [];
  Object.keys(fingerprints.v || {}).forEach(function (id) {
    plainV.push(fingerprints.v[id]);
  });
  ['uk', 'esp', 'cze', 'cross', 'greek', 'h', 'star', 'dz', 'tn', 'ly', 'eg', 'nordic'].forEach(function (dirKey) {
    const group = fingerprints[dirKey];
    if (!group) return;
    Object.keys(group).forEach(function (id) {
      if (plainV.indexOf(group[id]) >= 0) {
        issues.push(id + ' 宣告 flagDir=' + dirKey +
          '，但畫出來跟直三色一模一樣 → flagFace 少了這個分支');
      }
    });
  });

  return { issueCount: issues.length, issues: issues };
}
