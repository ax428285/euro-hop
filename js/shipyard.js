'use strict';

/**
 * 造船廠（v1.26 玩家：地中海增設港口，升級船隻；造船廠盡量離西班牙近，一進遊戲就能升級）。
 *
 * 地點：瓦倫西亞的皇家造船廠（中世紀的 Drassanes del Grau，西班牙地中海岸最有名的造船廠），
 * 離起點西班牙最近的海岸。地圖上的入口見 worldmap.js PORT_DEFS。
 *
 * 四項升級（存在 Save.ship）：
 *   sail    船帆   大地圖開船更快（每級 +15%）
 *   cannon  船首砲 海盜船艦砲對決：裝填更快；滿級開場先轟一砲（命中 +1）
 *   hull    船身   海上遭遇戰（海鷗、海盜、海獺、斯庫拉⋯⋯）愛心 +1／級；戰艦海戰：砲被打壞後修得快
 *   powder  火藥庫 （v1.30 哥倫布的戰艦海戰）砲彈威力
 *   v1.30：船首砲在戰艦海戰裡 = 甲板上有幾門砲（1～3 門）；船帆 = 敵方砲彈飛得慢（紅圈出現得早）
 *   paint   油漆   船的顏色（只換外觀，買過的可以隨時換回來）
 *
 * 對外 API：
 *   Shipyard.ITEMS / PAINTS
 *   Shipyard.priceOf(id, ship)     下一級的價錢（滿級回 null）
 *   Shipyard.buy(id, ship)         回傳升級後的新 ship 物件（不改原本的）
 *   Shipyard.sanitize(raw)         讀存檔時清理
 *   Shipyard.seaSpeed(ship) / cannonCd(ship) / cannonHead(ship) / hullBonus(ship) / paint(ship)
 */
const Shipyard = (function () {

  const ITEMS = [
    { id: 'sail',   name: '加大船帆', max: 3, prices: [80, 160, 280],
      desc: function (lv) { return '大地圖開船速度 +' + (lv * 15) + '%'; },
      note: '地中海的三角帆（拉丁帆）可以逆風斜著走，大航海時代的卡拉維爾帆船就是靠它出海。' },
    { id: 'cannon', name: '船首砲',   max: 2, prices: [120, 260],
      desc: function (lv) { return (lv >= 2 ? '海盜戰裝填快 50%、開場先轟一砲' : lv === 1 ? '海盜戰裝填快 25%' : '海盜戰的大砲沒有強化') + '・戰艦海戰甲板 ' + (lv + 1) + ' 門砲'; },
      note: '16 世紀的地中海槳帆船，砲都裝在船頭 —— 船要正對敵人才打得到。' },
    { id: 'hull',   name: '加厚船身', max: 2, prices: [150, 300],
      desc: function (lv) { return '海上遭遇戰愛心 +' + lv + (lv ? '・戰艦海戰砲壞了修得快' : ''); },
      note: '威尼斯兵工廠用標準化零件造船，全盛時期一天就能組好一艘槳帆船。' },
    // v1.30 哥倫布的戰艦海戰
    { id: 'powder', name: '火藥庫',   max: 2, prices: [140, 280],
      desc: function (lv) { return lv ? '戰艦海戰砲彈威力 +' + (lv * 50) + '%' : '戰艦海戰的砲彈沒有強化'; },
      note: '大航海時代的戰艦把火藥放在船底最深的艙房，旁邊的燈要隔著玻璃點，免得整艘船炸掉。' },
    { id: 'paint',  name: '船身油漆', max: 0, prices: [],
      desc: function () { return '換船的顏色（買過的可以隨時換）'; },
      note: '' }
  ];
  /** 油漆：hull 船身、sail 帆、trim 船舷飾條 */
  const PAINTS = [
    { id: 'oak',    name: '原木',     price: 0,  hull: '#8a5a3c', sail: '#f4efe2', trim: '#6b4530' },
    { id: 'navy',   name: '海軍藍',   price: 60, hull: '#2a4a7a', sail: '#f4efe2', trim: '#e8c060' },
    { id: 'crimson',name: '腓尼基紫', price: 60, hull: '#6a2a5a', sail: '#c070b0', trim: '#e8c060' },
    { id: 'gold',   name: '黃金帆船', price: 120, hull: '#3a2a1a', sail: '#f2c94c', trim: '#f2c94c' }
  ];

  function item(id) { return ITEMS.filter(function (i) { return i.id === id; })[0]; }
  function paintDef(id) { return PAINTS.filter(function (p) { return p.id === id; })[0] || PAINTS[0]; }

  function blank() { return { sail: 0, cannon: 0, hull: 0, powder: 0, paint: 'oak', paints: ['oak'] }; }

  function sanitize(raw) {
    const s = blank();
    ['sail', 'cannon', 'hull', 'powder'].forEach(function (k) {
      s[k] = U.clamp(parseInt(raw[k], 10) || 0, 0, item(k).max);
    });
    if (Array.isArray(raw.paints)) {
      raw.paints.forEach(function (p) { if (paintDef(p).id === p && s.paints.indexOf(p) < 0) s.paints.push(p); });
    }
    s.paint = s.paints.indexOf(raw.paint) >= 0 ? raw.paint : 'oak';
    return s;
  }

  /** 下一級多少錢（滿級回 null）；油漆傳 paintId */
  function priceOf(id, ship, paintId) {
    if (id === 'paint') {
      const p = paintDef(paintId);
      return ship.paints.indexOf(p.id) >= 0 ? 0 : p.price;
    }
    const it = item(id);
    if (!it || ship[id] >= it.max) return null;
    return it.prices[ship[id]];
  }

  /** 升一級／買並換上油漆：回傳新的 ship 物件 */
  function buy(id, ship, paintId) {
    const s = JSON.parse(JSON.stringify(ship));
    if (id === 'paint') {
      if (s.paints.indexOf(paintId) < 0) s.paints.push(paintId);
      s.paint = paintId;
      return s;
    }
    s[id] = Math.min(item(id).max, s[id] + 1);
    return s;
  }

  return {
    ITEMS: ITEMS,
    PAINTS: PAINTS,
    item: item,
    paintDef: paintDef,
    blank: blank,
    sanitize: sanitize,
    priceOf: priceOf,
    buy: buy,
    seaSpeed: function (ship) { return 1 + 0.15 * ((ship && ship.sail) || 0); },
    /** 艦砲對決的裝填帧數（原本 70） */
    cannonCd: function (ship) { return Math.round(70 * (1 - 0.25 * ((ship && ship.cannon) || 0))); },
    /** 滿級船首砲：開場先命中一次 */
    cannonHead: function (ship) { return ((ship && ship.cannon) || 0) >= 2 ? 1 : 0; },
    hullBonus: function (ship) { return (ship && ship.hull) || 0; },
    // v1.30 戰艦海戰：甲板上幾門砲、每發傷害、砲壞了幾帧修好、敵彈預告多久
    deckGuns: function (ship) { return 1 + ((ship && ship.cannon) || 0); },
    shellDmg: function (ship) { return 6 + 3 * ((ship && ship.powder) || 0); },
    repairTime: function (ship) { return 150 - 40 * ((ship && ship.hull) || 0); },
    warnTime: function (ship) { return 78 + 14 * ((ship && ship.sail) || 0); },
    paint: function (ship) { return paintDef(ship && ship.paint); }
  };
})();
