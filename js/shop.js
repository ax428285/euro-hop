'use strict';

/**
 * 金幣商店 —— 讓收集金幣有意義。
 *
 * 設計取捨：
 *   金幣原本只是加分數，收集完沒有任何回饋。改成「可以買永久強化」，
 *   收集就變成實際的投資行為。
 *
 *   跟裝備（Equipment）的差別：
 *     裝備  = 關卡裡找到的，解鎖「新能力」（二段跳、揮擊⋯⋯），不可逆
 *     強化  = 用金幣買的，是「數值加成」，可以分階段買
 *
 *   金幣是跨關卡累積的「錢包」（Save.wallet），跟單關的收集數分開記。
 *   已經買過的強化不會退費，所以買之前介面要寫清楚效果。
 *
 * 對外 API：
 *   Shop.items                  全部商品定義
 *   Shop.priceOf(id, owned)     下一階的價格（已滿級回 null）
 *   Shop.levelOf(id)            目前已買幾階
 *   Shop.canBuy(id)             錢夠不夠 + 還沒滿級
 *   Shop.buy(id)                扣錢並記錄，回傳是否成功
 *   Shop.resolve()              把已買的強化換算成加成值
 */
const Shop = (function () {

  /**
   * 商品。
   * maxLevel  可以買幾階
   * cost      第 n 階的價格（陣列長度 = maxLevel）
   * apply     把加成寫進 bonus 物件
   */
  const items = [
    {
      id: 'heart',
      name: '多一顆愛心',
      icon: 'heart',
      desc: '每關開始時多一條命',
      // v1.9.1：裝備不再大量加愛心（改成新能力），商店多開第 3 階補回來
      maxLevel: 3,
      cost: [60, 150, 280],
      apply: function (b, lv) { b.bonusLives += lv; }
    },
    {
      id: 'magnet',
      name: '金幣磁鐵',
      icon: 'magnet',
      desc: '附近的金幣會被吸過來',
      maxLevel: 2,
      cost: [80, 180],
      apply: function (b, lv) { b.magnet = lv * 46; }
    },
    {
      id: 'reach',
      name: '加長揮擊',
      icon: 'reach',
      desc: '揮擊的攻擊範圍變大',
      maxLevel: 2,
      cost: [70, 160],
      apply: function (b, lv) { b.reachBonus = lv * 14; }
    },
    {
      id: 'shield',
      name: '旅人護符',
      icon: 'shield',
      desc: '受傷後的無敵時間更長',
      maxLevel: 2,
      cost: [50, 120],
      apply: function (b, lv) { b.invulnBonus += lv * 40; }
    },
    {
      id: 'boots',
      name: '彈簧鞋',
      icon: 'boots',
      desc: '跳得更高一點',
      maxLevel: 2,
      cost: [90, 200],
      apply: function (b, lv) { b.jumpBoost = lv * 0.6; }
    },
    {
      id: 'luck',
      name: '幸運徽章',
      icon: 'luck',
      desc: '金幣分數加成',
      maxLevel: 2,
      cost: [100, 220],
      apply: function (b, lv) { b.coinBonus = lv * 0.5; }
    }
  ];

  const byId = {};
  items.forEach(function (it) { byId[it.id] = it; });

  function levelOf(id) {
    return Save.upgradeLevel(id);
  }

  /** 下一階價格；已滿級回 null */
  function priceOf(id, ownedLevel) {
        const it = byId[id];
    if (!it) return null;
    const lv = ownedLevel == null ? levelOf(id) : ownedLevel;
    if (lv >= it.maxLevel) return null;
    return it.cost[lv];
  }

  function canBuy(id) {
    const p = priceOf(id);
    if (p == null) return false;
    return Save.get().wallet >= p;
  }

  function buy(id) {
    const p = priceOf(id);
    if (p == null) return false;
    if (Save.get().wallet < p) return false;
    Save.spendCoins(p);
    Save.addUpgrade(id);
    return true;
  }

  /** 把已買的強化換算成加成。欄位會被 Equipment.resolve 合併。 */
  function resolve() {
    const b = {
      bonusLives: 0,
      magnet: 0,
      reachBonus: 0,
      invulnBonus: 0,
      jumpBoost: 0,
      coinBonus: 0
    };
    items.forEach(function (it) {
      const lv = levelOf(it.id);
      if (lv > 0) it.apply(b, lv);
    });
    return b;
  }

  /** 全部買完需要多少金幣（介面顯示用） */
  function totalCost() {
    return items.reduce(function (n, it) {
      return n + it.cost.reduce(function (a, c) { return a + c; }, 0);
    }, 0);
  }

  return {
    items: items,
    get: function (id) { return byId[id]; },
    levelOf: levelOf,
    priceOf: priceOf,
    canBuy: canBuy,
    buy: buy,
    resolve: resolve,
    totalCost: totalCost,
    count: items.length
  };
})();
