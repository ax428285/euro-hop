'use strict';

/**
 * 金幣商店 —— 讓收集金幣有意義。
 *
 * 設計取捨：
 *   金幣原本只是加分數，收集完沒有任何回饋。改成「可以買永久強化」，
 *   收集就變成實際的投資行為。
 *
 *   跟裝備（Equipment）的差別：
 *     裝備  = 關卡裡找到的，解鎖「新能力」（二段跳、遠程攻擊⋯⋯），不可逆
 *     強化  = 用金幣買的，是「數值加成」，可以分階段買
 *
 *   金幣是跨關卡累積的「錢包」（Save.wallet），跟單關的收集數分開記。
 *   已經買過的強化不會退費，所以買之前介面要寫清楚效果。
 *
 * 對外 API：
 *   Shop.items                  全部商品定義（每件有 seller：誰在賣）
 *   Shop.SELLERS / itemsOf(s)   賣家（葡萄牙商店、三位神祕商人）與各自賣的東西
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
    // v1.18 拿掉「加長揮擊」（遊戲不再有近戰揮擊）；買過的不退費，存檔裡的紀錄留著但不再有作用
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

  /*
   * 賣家（v1.22 玩家要求：地圖放神祕商人，某些東西要去那邊買）。
   * 葡萄牙商店（地圖上的葡萄牙、按 B）只剩愛心；其他四樣分給三位藏在地圖角落的神祕商人，
   * 要開船／走路去找。位置在 worldmap.js 的 MERCHANTS（經緯度）。
   */
  const SELLERS = {
    portugal: { name: '金幣商店', who: '葡萄牙的港口商店', line: '關卡裡撿的金幣會存進錢包，在這裡換永久強化' },
    isle:     { name: '神祕商人・藥草婆婆', who: '地中海小島上的藥草婆婆', line: '「海風吹來的金幣，我這道符都吸得過來。」' },
    fjord:    { name: '神祕商人・峽灣老漁夫', who: '北歐峽灣的老漁夫', line: '「在冰冷的海上跑船，護身符和好鞋子少不了。」' },
    oasis:    { name: '神祕商人・駱駝商隊', who: '撒哈拉綠洲的駱駝商隊', line: '「穿過沙漠的人，都相信這枚幸運徽章。」' }
  };
  const SELLER_OF = { heart: 'portugal', magnet: 'isle', shield: 'fjord', boots: 'fjord', luck: 'oasis' };
  items.forEach(function (it) { it.seller = SELLER_OF[it.id] || 'portugal'; });

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
    SELLERS: SELLERS,
    /** 某個賣家賣的東西（葡萄牙商店 / 神祕商人） */
    itemsOf: function (seller) { return items.filter(function (it) { return it.seller === seller; }); },
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
