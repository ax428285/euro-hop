'use strict';

/**
 * 地中海貿易與懸賞（v1.27 玩家：做提案的 C 貿易航線、D 懸賞板）。
 *
 * ── C 貿易 ─────────────────────────────────────────────
 * 四個貿易港各產一樣特產，在產地買便宜、運到別的港口賣貴。
 *   熱那亞   橄欖油   羅德島  葡萄酒（古代羅德島的酒裝在雙耳陶罐裡賣遍地中海）
 *   迦太基   椰棗     亞歷山卓 莎草紙（古埃及的紙，整個地中海世界都靠它寫字）
 * 價格每「天」變一次（打完一關或一場海戰就過一天，Save.day），用 day 當亂數種子 —— 同一天價格固定、可以比價。
 * 船艙：3 箱起跳，造船廠加厚船身每級 +1。
 * 風險：船上有貨時海盜比較常出現；海戰打輸會被搶走一箱（見 game.js onMiniFail）。
 *
 * ── D 懸賞板 ───────────────────────────────────────────
 * 每個貿易港的第二頁。每天三張委託，同時只能接一張，完成自動領賞：
 *   hunt    擊退 N 隻海上怪物
 *   letter  限時送信到某港（地圖上倒數，只有在大地圖上才會走）
 *   cargo   把 N 箱某貨物運到某港（賣掉不算，要交給委託人）
 *   golden  抓到黃金海馬
 *   scylla  打倒海妖斯庫拉（可以重打）
 *
 * 對外 API：
 *   Trade.GOODS / PORTS
 *   Trade.price(portId, goodId, day)  { buy, sell }（buy = 這裡買的價錢；這裡不賣這樣貨時 buy 為 null）
 *   Trade.capacity(ship)
 *   Trade.offers(day, done)            今天的三張委託
 *   Trade.describe(b)                  委託的說明文字
 */
const Trade = (function () {

  const GOODS = [
    { id: 'oil',     name: '橄欖油', home: 'genoa',      base: 46, color: '#b8b040' },
    { id: 'wine',    name: '葡萄酒', home: 'rhodes',     base: 52, color: '#8a2a4a' },
    { id: 'dates',   name: '椰棗',   home: 'carthage',   base: 40, color: '#8a5a2a' },
    { id: 'papyrus', name: '莎草紙', home: 'alexandria', base: 58, color: '#d8c890' }
  ];
  /** 貿易港（lon/lat 放在外海，靠岸不會跟關卡城市的圖釘搶） */
  const PORTS = [
    { id: 'genoa',      name: '熱那亞',   lon: 8.6,  lat: 43.9 },
    { id: 'rhodes',     name: '羅德島',   lon: 27.9, lat: 36.0 },
    { id: 'carthage',   name: '迦太基',   lon: 10.6, lat: 37.4 },
    { id: 'alexandria', name: '亞歷山卓', lon: 29.6, lat: 31.8 }
  ];
  const HOLD_BASE = 3;

  function good(id) { return GOODS.filter(function (g) { return g.id === id; })[0]; }
  function port(id) { return PORTS.filter(function (p) { return p.id === id; })[0]; }

  /** 兩港之間的「距離」（經緯度直線，0~1 正規化），越遠賣越貴 */
  function dist(a, b) {
    const pa = port(a), pb = port(b);
    return Math.min(1, Math.hypot(pa.lon - pb.lon, pa.lat - pb.lat) / 22);
  }

  /** 固定種子的 0~1 亂數（同一天、同一港、同一貨永遠一樣） */
  function noise(day, i, j) {
    let s = (day * 2654435761 + i * 40503 + j * 9973) >>> 0;
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return (s % 10000) / 10000;
  }

  /**
   * 價錢：
   *   產地買價 ≈ 底價 × 0.45（每天 ±15%），賣回產地只拿到買價的八成
   *   別的港口賣價 ≈ 底價 × (0.8 + 距離 × 0.9)，再乘上今天的行情 0.75~1.3
   *   → 跑最遠的航線、挑行情好的那天賣，一箱能賺兩三倍
   */
  function price(portId, goodId, day) {
    const g = good(goodId);
    const pi = PORTS.indexOf(port(portId)), gi = GOODS.indexOf(g);
    const mood = 0.75 + noise(day, pi, gi) * 0.55;
    if (g.home === portId) {
      const buy = Math.round(g.base * 0.45 * (0.85 + noise(day + 7, pi, gi) * 0.3));
      return { buy: buy, sell: Math.round(buy * 0.8) };
    }
    return { buy: null, sell: Math.round(g.base * (0.8 + dist(g.home, portId) * 0.9) * mood) };
  }

  function capacity(ship) { return HOLD_BASE + ((ship && ship.hull) || 0); }

  /** 今天的三張委託（done = 已完成幾張：同一天完成一張後換新的） */
  function offers(day, done) {
    const out = [];
    const seed = day * 7 + done * 3;
    const types = ['hunt', 'letter', 'cargo', 'golden', 'scylla'];
    const used = {};
    for (let k = 0; out.length < 3 && k < 20; k++) {
      const type = types[Math.floor(noise(seed, k, 1) * types.length)];
      if (used[type]) continue;
      used[type] = true;
      const to = PORTS[Math.floor(noise(seed, k, 2) * PORTS.length)].id;
      const b = { type: type, id: seed + ':' + k };
      if (type === 'hunt') { b.n = 2 + Math.floor(noise(seed, k, 3) * 2); b.reward = 70 + b.n * 35; b.exp = 30 * b.n; }
      if (type === 'letter') { b.to = to; b.time = 60 * 75; b.reward = 120; b.exp = 40; }
      if (type === 'cargo') {
        b.to = to;
        b.good = GOODS.filter(function (g) { return g.home !== to; })[Math.floor(noise(seed, k, 4) * 3)].id;
        b.n = 2; b.reward = 220; b.exp = 60;
      }
      if (type === 'golden') { b.reward = 180; b.exp = 60; }
      if (type === 'scylla') { b.reward = 250; b.exp = 80; }
      out.push(b);
    }
    return out;
  }

  function describe(b) {
    if (b.type === 'hunt') return '擊退 ' + b.n + ' 隻海上怪物' + (b.got != null ? '（' + b.got + '/' + b.n + '）' : '');
    if (b.type === 'letter') return '限時把信送到' + port(b.to).name + '（' + Math.round(b.time / 60) + ' 秒）';
    if (b.type === 'cargo') return '把 ' + b.n + ' 箱' + good(b.good).name + '運到' + port(b.to).name;
    if (b.type === 'golden') return '抓到閃金光的黃金海馬';
    if (b.type === 'scylla') return '打倒墨西拿海峽的海妖斯庫拉';
    return '';
  }

  return {
    GOODS: GOODS,
    PORTS: PORTS,
    good: good,
    port: port,
    price: price,
    capacity: capacity,
    offers: offers,
    describe: describe
  };
})();
