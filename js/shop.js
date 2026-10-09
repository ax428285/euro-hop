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
      // v1.31 玩家：金幣的來源變多了（銀行利息、貿易、懸賞⋯⋯）→ 商店的價格大約翻倍
      cost: [150, 350, 650],
      apply: function (b, lv) { b.bonusLives += lv; }
    },
    {
      id: 'magnet',
      name: '金幣磁鐵',
      icon: 'magnet',
      desc: '附近的金幣會被吸過來',
      maxLevel: 2,
      cost: [200, 420],
      apply: function (b, lv) { b.magnet = lv * 46; }
    },
    // v1.18 拿掉「加長揮擊」（遊戲不再有近戰揮擊）；買過的不退費，存檔裡的紀錄留著但不再有作用
    {
      id: 'shield',
      name: '旅人護符',
      icon: 'shield',
      desc: '受傷後的無敵時間更長',
      maxLevel: 2,
      cost: [120, 300],
      apply: function (b, lv) { b.invulnBonus += lv * 40; }
    },
    {
      id: 'boots',
      name: '彈簧鞋',
      icon: 'boots',
      desc: '跳得更高一點',
      maxLevel: 2,
      cost: [220, 480],
      apply: function (b, lv) { b.jumpBoost = lv * 0.6; }
    },
    {
      id: 'luck',
      name: '幸運徽章',
      icon: 'luck',
      desc: '金幣分數加成',
      maxLevel: 2,
      cost: [240, 520],
      apply: function (b, lv) { b.coinBonus = lv * 0.5; }
    },
    // v1.31 玩家：葡萄牙商店只賣一樣商品也太空虛 → 多三樣跟葡萄牙有關的
    {
      id: 'cork',
      name: '軟木救生圈',
      icon: 'cork',
      desc: '每關第一次掉下去不扣愛心',
      note: '全世界一半的軟木塞都產自葡萄牙；軟木又輕又會浮，以前的救生圈就是用它做的。',
      maxLevel: 1,
      cost: [600],
      apply: function (b) { b.pitSave = true; }
    },
    {
      id: 'hold',
      name: '卡拉維爾大船艙',
      icon: 'hold',
      desc: '貿易時船艙多放 1 箱貨',
      note: '大航海時代葡萄牙的卡拉維爾帆船又小又快，迪亞士就是開著它繞過非洲南端的好望角。',
      maxLevel: 2,
      cost: [300, 650],
      apply: function (b, lv) { b.hold = lv; }
    },
    {
      id: 'astrolabe',
      name: '航海家的星盤',
      icon: 'astrolabe',
      desc: '海上遭遇戰的 EXP 多 25%',
      note: '葡萄牙的「航海家」亨利王子招募天文學家改良星盤，船員量星星的高度就知道自己在多南、多北。',
      maxLevel: 2,
      cost: [350, 750],
      apply: function (b, lv) { b.expBonus = lv * 0.25; }
    }
  ];

  /*
   * v1.31 玩家：「除了能力想想還能買甚麼」→ 新大陸開了兩家只賣外觀的店（kind: 'look'，不加任何能力，買一次就有）。
   *   聖胡安服裝店（波多黎各）：時裝。原本只有稀有怪會掉；黃金套裝和法老還是只能打怪／探險拿。
   *     擁有與否直接看 Save 的 costumes（打怪拿過的這裡會顯示「已擁有」）。
   *   千里達寵物用品店：給黃金獵犬的小配件，買了地圖上的狗就戴著（全部一起戴）。要先收養狗才能買。
   *     擁有與否存在 Save.upgrades（跟強化一樣，maxLevel 1）。
   */
  [
    ['captain', '海盜船長', '三角帽 + 紅色長大衣', 600],
    ['matador', '鬥牛士', '金色刺繡短外套 + 黑色鬥牛士帽', 600],
    ['viking', '維京戰士', '牛角頭盔 + 毛皮背心', 600],
    ['harlequin', '威尼斯小丑', '菱格紋衣 + 雙角鈴鐺帽', 800],
    ['royal', '歐羅巴王子', '金王冠 + 紫色披風', 1200]
  ].forEach(function (c) {
    items.push({ id: 'cos_' + c[0], costume: c[0], name: c[1], icon: 'cos_' + c[0], desc: '時裝：' + c[2],
                 kind: 'look', maxLevel: 1, cost: [c[3]] });
  });
  // v1.31.2 亞特蘭提斯海底城的珊瑚貝殼屋：海底才有的時裝
  [
    ['mermaid', '人魚', '粉紅長髮＋貝殼上衣＋整條魚尾巴', 1500],
    ['athena', '雅典娜女神', '白袍＋金頭盔＋盾牌和長矛', 2000]
  ].forEach(function (c) {
    items.push({ id: 'cos_' + c[0], costume: c[0], name: c[1], icon: 'cos_' + c[0], desc: '時裝：' + c[2],
                 kind: 'look', maxLevel: 1, cost: [c[3]], shop: 'shellHouse' });
  });
  [
    ['bandana', '紅色領巾', '綁在脖子上的紅色三角巾', 250],
    ['shades', '酷酷墨鏡', '加勒比海的太陽好大', 300],
    ['sombrero', '小草帽', '墨西哥的寬邊草帽，縮小版', 400],
    ['cape', '英雄披風', '跑起來會飄的紅色小披風', 600]
  ].forEach(function (c) {
    items.push({ id: 'dog_' + c[0], acc: c[0], name: c[1], icon: 'dog_' + c[0], desc: c[2],
                 kind: 'look', maxLevel: 1, cost: [c[3]], needDog: true });
  });

  /*
   * 賣家（v1.22 玩家要求：地圖放神祕商人，某些東西要去那邊買）。
   * 葡萄牙商店（地圖上的葡萄牙、按 B）只剩愛心；其他四樣分給三位藏在地圖角落的神祕商人，
   * 要開船／走路去找。位置在 worldmap.js 的 MERCHANTS（經緯度）。
   */
  const SELLERS = {
    portugal: { name: '金幣商店', who: '葡萄牙的港口商店', line: '關卡裡撿的金幣會存進錢包，在這裡換永久強化' },
    isle:     { name: '神祕商人・藥草婆婆', who: '地中海小島上的藥草婆婆', line: '「海風吹來的金幣，我這道符都吸得過來。」' },
    fjord:    { name: '神祕商人・峽灣老漁夫', who: '北歐峽灣的老漁夫', line: '「在冰冷的海上跑船，護身符和好鞋子少不了。」' },
    oasis:    { name: '神祕商人・駱駝商隊', who: '撒哈拉綠洲的駱駝商隊', line: '「穿過沙漠的人，都相信這枚幸運徽章。」' },
    // v1.31 新大陸
    boutique: { name: '聖胡安服裝店', who: '波多黎各聖胡安的服裝店', line: '「出門旅行，總要有幾套體面的衣服。」買了就穿上，按 I 可以換', look: true },
    petshop:  { name: '千里達寵物用品店', who: '千里達的寵物用品店', line: '「給你的狗狗也打扮一下吧！」買了狗狗就會戴上', look: true },
    // v1.31.2 亞特蘭提斯海底城
    shellHouse: { name: '珊瑚貝殼屋', who: '亞特蘭提斯中央廣場的服裝店', line: '「海底才買得到的衣服喔！」買了就穿上，按 I 可以換', look: true }
  };
  const SELLER_OF = { heart: 'portugal', magnet: 'isle', shield: 'fjord', boots: 'fjord', luck: 'oasis' };
  items.forEach(function (it) { it.seller = it.shop || (it.costume ? 'boutique' : it.acc ? 'petshop' : (SELLER_OF[it.id] || 'portugal')); });

  const byId = {};
  items.forEach(function (it) { byId[it.id] = it; });

  function levelOf(id) {
    const it = byId[id];
    if (it && it.costume) return Save.get().costumes.indexOf(it.costume) >= 0 ? 1 : 0;
    return Save.upgradeLevel(id);
  }

  /** 買不買得了（跟錢無關的條件）：回傳不能買的原因，可以買回 null */
  function blockedOf(id) {
    const it = byId[id];
    if (it && it.needDog && !(typeof Pet !== 'undefined' && Pet.adopted())) return '要先有一隻狗狗（蘇格蘭高地的黃金獵犬）';
    return null;
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
    if (p == null || blockedOf(id)) return false;
    return Save.get().wallet >= p;
  }

  function buy(id) {
    const p = priceOf(id);
    if (p == null) return false;
    if (Save.get().wallet < p || blockedOf(id)) return false;
    Save.spendCoins(p);
    if (byId[id].costume) Save.addCostume(byId[id].costume);     // 時裝：買了就穿上
    else Save.addUpgrade(id);
    return true;
  }

  /** 把已買的強化換算成加成。欄位會被 Equipment.resolve 合併。 */
  function resolve() {
    const b = {
      bonusLives: 0,
      magnet: 0,
      invulnBonus: 0,
      jumpBoost: 0,
      coinBonus: 0,
      pitSave: false,     // 軟木救生圈：每關第一次掉下去不扣愛心
      hold: 0,            // 卡拉維爾大船艙：船艙多放幾箱
      expBonus: 0         // 航海家的星盤：遭遇戰 EXP 加成
    };
    items.forEach(function (it) {
      if (!it.apply) return;           // 外觀商品沒有加成
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
    blockedOf: blockedOf,
    /** 黃金獵犬戴著哪些配件（寵物用品店買的；v1.31.2 脫下來的不算 —— 旗標 dogOff_<配件>） */
    dogAccs: function () {
      return items.filter(function (it) { return it.acc && Save.upgradeLevel(it.id) > 0 && !Save.flag('dogOff_' + it.acc); }).map(function (it) { return it.acc; });
    },
    /** 有沒有穿著這件外觀商品（時裝 = 身上這套；狗狗配件 = 買了而且沒脫下來） */
    wearing: function (id) {
      const it = byId[id];
      if (!it) return false;
      if (it.costume) return Save.get().costume === it.costume;
      if (it.acc) return Save.upgradeLevel(it.id) > 0 && !Save.flag('dogOff_' + it.acc);
      return false;
    },
    /*
     * v1.31.2 玩家：人魚和狗狗的時裝要可以脫下來 → 外觀商店裡已經擁有的東西，再按一次 Enter（手機點一下）= 穿上／脫下。
     * 回傳 'on'（穿上了）、'off'（脫下了），沒擁有回傳 null。
     */
    toggleWear: function (id) {
      const it = byId[id];
      if (!it || levelOf(id) <= 0) return null;
      if (it.costume) {
        const on = Save.get().costume === it.costume;
        Save.wearCostume(on ? null : it.costume);
        return on ? 'off' : 'on';
      }
      if (it.acc) {
        const off = !!Save.flag('dogOff_' + it.acc);
        Save.setFlag('dogOff_' + it.acc, off ? 0 : 1);
        return off ? 'on' : 'off';
      }
      return null;
    },
    priceOf: priceOf,
    canBuy: canBuy,
    buy: buy,
    resolve: resolve,
    totalCost: totalCost,
    count: items.length
  };
})();
