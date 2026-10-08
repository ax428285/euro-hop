'use strict';

/**
 * 裝備系統。
 *
 * 每一關藏一件該國的代表性裝備，拿到就寫進存檔。
 *
 * ── 部位（v1.22 玩家要求）──────────────────────────────────
 * 裝備分 5 個部位：頭、身體、手、腳、飾品。同一個部位一次只能裝一件，
 * 只有「裝上的」才生效（存檔 Save 另外記 worn：{ 部位: id }）。
 * 部位內刻意放互相取捨的東西，例如頭：貝雷帽（二段跳）vs 月桂冠（金幣 ×2）；
 * 手：板球／辣椒火球（遠程）vs 斧杖（破甲踩）vs 扇子（滑翔）。
 *
 * 對外 API（其他模組依賴這些，改動請同步）：
 *   Equipment.defs            全部裝備定義（陣列，順序 = 關卡順序；每件有 slot）
 *   Equipment.count           裝備總數
 *   Equipment.get(id)         取單一定義，不存在回 undefined
 *   Equipment.forLevel(i)     第 i 關藏的裝備（沒有則 undefined）
 *   Equipment.SLOTS           部位清單 [{ id, name }]
 *   Equipment.pickWorn(ids)   從一堆裝備裡每個部位挑一件（依部位內的優先順序）—— 舊存檔轉換、連線朋友用
 *   Equipment.resolve(ids)    把「生效中」的 id 陣列換算成能力值 stats（stats.worn = 那串 id，畫人物用）
 *
 * stats 欄位（entities.js / game.js 會讀）：
 *   maxLives      愛心上限
 *   speed         跑速倍率
 *   doubleJump    二段跳
 *   wallJump      蹬牆跳
 *   coinMul       金幣分數倍率
 *   invulnBonus   受傷後無敵帧數加成
 */
const Equipment = (function () {

  const defs = [
    {
      id: 'fan', level: 0, country: '西班牙', icon: 'fan',
      name: '佛朗明哥扇',
      desc: '下墜時按住跳躍可滑翔',
      note: '佛朗明哥的扇子舞源自安達盧西亞，扇子開合是重要的節奏記號。',
      apply: function (s) { s.glide = true; }
    },
    {
      id: 'beret', level: 1, country: '法國', icon: 'beret',
      name: '藝術家貝雷帽',
      desc: '解鎖二段跳：空中再跳一次',
      note: '貝雷帽源自巴斯克地區，20 世紀成了巴黎藝術家的標誌。',
      apply: function (s) { s.doubleJump = true; }
    },
    {
      // v1.9：原本是「紳士長傘 愛心 +1」，換成遠程武器（id 不變，舊存檔照樣認得）
      id: 'brolly', level: 2, country: '英國', icon: 'cricket',
      name: '板球',
      desc: '解鎖遠程攻擊（K 鍵）：丟出會彈跳一次的板球',
      note: '板球 16 世紀起源於英格蘭東南部，一場正式國際賽可以打上五天。',
      apply: function (s) { if (!s.ranged) s.ranged = 'ball'; }
    },
    {
      id: 'clogs', level: 3, country: '荷蘭', icon: 'clogs',
      name: '荷蘭木鞋',
      desc: '重踩：踩倒敵人時，震波會把附近地上的敵人一起震倒',
      note: '木鞋是荷蘭工人的工作鞋，防水也防重物砸腳。',
      apply: function (s) { s.stompWave = true; }
    },
    /*
     * v1.18 拿掉近戰揮擊：原本的啤酒杯（解鎖揮擊）、指揮棒（揮擊冷卻）、斧杖（揮擊範圍）換成新效果。
     * id 不變，已經拿到的玩家存檔直接套用新效果。
     */
    {
      id: 'stein', level: 4, country: '德國', icon: 'stein',
      name: '啤酒節大啤酒杯',
      desc: '連丟更快：遠程攻擊的冷卻縮短 40%',
      note: '慕尼黑啤酒節從 1810 年一場皇室婚禮延續至今。',
      apply: function (s) { s.fastThrow = true; }
    },
    {
      id: 'puppet', level: 5, country: '捷克', icon: 'puppet',
      name: '波希米亞提線木偶',
      desc: '金幣分數 x1.5',
      note: '捷克的提線木偶劇 2016 年被列入世界非物質文化遺產。',
      apply: function (s) { s.coinMul = Math.max(s.coinMul, 1.5); }
    },
    {
      id: 'baton', level: 6, country: '奧地利', icon: 'baton',
      name: '指揮棒',
      desc: '踩敵人彈得更高，連踩更順',
      note: '維也納愛樂的新年音樂會，指揮每年換人，是樂界的榮譽。',
      apply: function (s) { s.highStomp = true; }
    },
    {
      id: 'rope', level: 7, country: '瑞士', icon: 'rope',
      name: '阿爾卑斯登山繩',
      desc: '解鎖蹬牆跳：貼牆可往反方向彈開',
      note: '瑞士嚮導制度始於 19 世紀的阿爾卑斯登山熱。',
      apply: function (s) { s.wallJump = true; }
    },
    {
      id: 'sandals', level: 8, country: '義大利', icon: 'sandals',
      name: '羅馬軍團涼鞋',
      desc: '跑速提升 25%',
      note: '羅馬軍團的 caliga 軍靴，讓士兵一天能行軍約 30 公里。',
      apply: function (s) { s.speed = 1.25; }
    },
    {
      id: 'laurel', level: 9, country: '希臘', icon: 'laurel',
      name: '奧林匹亞橄欖桂冠',
      desc: '金幣分數 x2',
      note: '古代奧運的優勝獎品就是一頂橄欖枝編的桂冠。',
      apply: function (s) { s.coinMul = 2; }
    },
    // ── 東歐篇 ──
    {
      id: 'amber', level: 10, country: '波蘭', icon: 'amber',
      name: '波羅的海琥珀',
      desc: '受傷後的無敵時間大幅延長',
      note: '波蘭的波羅的海沿岸是世界最大的琥珀產地，格但斯克被稱為琥珀之都。',
      apply: function (s) { s.invulnBonus += 45; }
    },
    {
      id: 'paprika', level: 11, country: '匈牙利', icon: 'paprika',
      name: '匈牙利紅椒',
      desc: 'K 鍵改丟辣椒火球：直線飛行、穿透敵人、冷卻減半',
      note: '匈牙利紅椒粉是燉牛肉湯（gulyás）的靈魂，塞格德是紅椒之都。',
      apply: function (s) { s.ranged = 'fire'; }
    },
    {
      id: 'garlic', level: 12, country: '羅馬尼亞', icon: 'garlic',
      name: '大蒜項鍊',
      desc: '魔王倒地（破綻）的時間延長 50%',
      note: '外西凡尼亞的民間傳說裡，大蒜能驅趕吸血鬼 strigoi。',
      apply: function (s) { s.bossStun = 1.5; }
    },
    {
      id: 'valaska', level: 13, country: '斯洛伐克', icon: 'valaska',
      name: '牧羊人斧杖',
      desc: '破甲：戴鋼盔的衛兵、刺蝟也踩得倒',
      note: 'valaška 是斯洛伐克山區牧羊人的長柄小斧，也是傳說中俠盜 Jánošík 的武器。',
      apply: function (s) { s.stompAll = true; }
    },
    {
      id: 'cravat', level: 14, country: '克羅埃西亞', icon: 'cravat',
      name: '克羅埃西亞領巾',
      desc: '吸引附近的金幣',
      note: '17 世紀克羅埃西亞傭兵的領巾傳到法國，演變成今天的領帶（cravate）。',
      apply: function (s) { s.magnet = Math.max(s.magnet, 70); }
    },
    {
      id: 'opanci', level: 15, country: '塞爾維亞', icon: 'opanci',
      name: '翹頭皮鞋',
      desc: '跳得更高',
      note: 'opanak 是塞爾維亞的傳統翹頭皮鞋，鞋尖的形狀各地都不一樣。',
      apply: function (s) { s.jumpBoost += 1; }
    },
    {
      id: 'rose', level: 16, country: '保加利亞', icon: 'rose',
      name: '玫瑰精油',
      desc: '受傷後的無敵時間更長',
      note: '保加利亞玫瑰谷生產全世界大約一半的玫瑰精油，3 噸花瓣才煉出 1 公斤。',
      apply: function (s) { s.invulnBonus += 30; }
    },
    {
      id: 'vyshyvanka', level: 17, country: '烏克蘭', icon: 'vyshyvanka',
      name: '刺繡襯衫',
      desc: '愛心上限 +1',
      note: 'vyshyvanka 上的刺繡花紋各地不同，傳統上被當成保佑穿的人平安的護身符。',
      apply: function (s) { s.maxLives += 1; }
    },
    // ── 非洲篇（v1.21）──
    {
      id: 'babouche', level: 18, country: '摩洛哥', icon: 'babouche',
      name: '尖頭拖鞋',
      desc: '踩空邊緣後還來得及跳（寬限時間加倍）',
      note: '摩洛哥的 babouche 是不分左右腳的尖頭皮拖鞋，馬拉喀什的市集一整條街都在賣。',
      apply: function (s) { s.coyoteX = 2; }
    },
    // ── v1.23 非洲篇補齊 ──
    {
      id: 'tagelmust', level: 19, country: '阿爾及利亞', icon: 'tagelmust',
      name: '圖阿雷格頭巾',
      desc: '不怕風沙：逆風、沙塵暴推不動你，黃沙裡也看得比較遠',
      note: '撒哈拉的圖阿雷格男子用好幾公尺長的靛藍布纏頭遮臉，被稱為「藍色的人」。',
      apply: function (s) { s.stormProof = true; }
    },
    {
      id: 'khamsa', level: 20, country: '突尼西亞', icon: 'khamsa',
      name: '法蒂瑪之手',
      desc: '護身符：每一關第一次「最後一顆愛心」被打掉時，替你擋下來',
      note: '五指張開的手形護身符 khamsa 在北非到處都是，掛在門上、戴在身上，傳說能擋住「邪眼」。',
      apply: function (s) { s.guardian = true; }
    },
    {
      id: 'ghadames', level: 21, country: '利比亞', icon: 'ghadames',
      name: '古達米斯皮靴',
      desc: '走沙地不會陷：流沙、鹽泥都照常跑跳',
      note: '利比亞的古達米斯是「沙漠中的珍珠」，當地的皮革手工很有名，歐洲人以前就叫這種軟皮 gadamesi。',
      apply: function (s) { s.sandWalk = true; }
    },
    {
      id: 'ankh', level: 22, country: '埃及', icon: 'ankh',
      name: '安卡生命之符',
      desc: '愛心上限 +1',
      note: '上端是圓環的十字 ankh 在古埃及象形文字裡就是「生命」，法老和眾神的畫像常拿著它。',
      apply: function (s) { s.maxLives += 1; }
    },
    // ── 北歐篇（v1.30）──
    {
      id: 'lego', level: 23, country: '丹麥', icon: 'lego',
      name: '樂高積木',
      desc: '積木不會消失：丹麥積木塔的紅積木一直都踩得到（其他豎井的節拍台也是）',
      note: '樂高 1932 年在丹麥比隆誕生，名字取自丹麥語 leg godt（好好玩）；1958 年才有現在這種卡得住的凸點積木。',
      apply: function (s) { s.brickSolid = true; }
    },
    {
      id: 'nutukas', level: 24, country: '瑞典', icon: 'nutukas',
      name: '馴鹿皮靴',
      desc: '冰面不會滑：瑞士冰岩照常跑跳、瑞典的雪橇在冰上不會暴衝',
      note: '拉普蘭的薩米人用馴鹿皮縫靴子，鞋尖往上翹，裡面塞乾草保暖，零下三十度也走得動。',
      apply: function (s) { s.iceGrip = true; }
    },
    {
      id: 'sunstone', level: 25, country: '挪威', icon: 'sunstone',
      name: '維京太陽石',
      desc: '黑暗裡看得比較遠：極夜、鹽礦的光圈變大',
      note: '傳說維京人陰天出海時，會拿一塊透明的冰洲石對著天空，找出被雲擋住的太陽在哪個方向。',
      apply: function (s) { s.nightSight = true; }
    },
    {
      id: 'bell', level: 26, country: '芬蘭', icon: 'bell',
      name: '馴鹿雪橇鈴',
      desc: '吸引附近的金幣（範圍比領巾大）',
      note: '芬蘭拉普蘭的馴鹿比人還多；冬天馴鹿雪橇掛著鈴鐺，在雪地裡老遠就聽得到。',
      apply: function (s) { s.magnet = Math.max(s.magnet, 110); }
    },
    {
      id: 'lopapeysa', level: 27, country: '冰島', icon: 'lopapeysa',
      name: '冰島毛衣',
      desc: '站得穩：被打到只退一半，不容易被撞下平台；受傷後的無敵時間也稍微延長',
      note: '冰島羊毛衣 lopapeysa 用沒染色的冰島羊毛織成，領口一圈花紋；羊毛防水又保暖，漁夫出海都穿它。',
      apply: function (s) { s.steady = true; s.invulnBonus += 20; }
    }
    // 美洲篇（v1.31）不給裝備，改給紀念品（souvenirs.js，不加能力、不佔裝備欄）
  ];

  /*
   * 部位分配。每個部位裡的順序 = 優先順序（舊存檔轉換、自動挑選時，同部位有好幾件就挑排前面的）。
   * 手：只放武器（火球 > 板球 > 斧杖）。遠程攻擊是唯一的攻擊手段，舊存檔優先保留。
   * ⚠️ 扇子（滑翔）放飾品不放手：西班牙第 1 關就拿到扇子，放手的話會先佔住手，
   *    之後英國的板球「部位不空、不自動裝」→ 新玩家整個西歐篇都沒有遠程攻擊（touch-check 抓到的）。
   */
  const SLOTS = [
    { id: 'head', name: '頭',   items: ['beret', 'laurel', 'tagelmust'] },
    { id: 'body', name: '身體', items: ['rope', 'vyshyvanka', 'cravat', 'lopapeysa'] },
    { id: 'hand', name: '手',   items: ['paprika', 'brolly', 'valaska'] },
    { id: 'feet', name: '腳',   items: ['sandals', 'opanci', 'clogs', 'babouche', 'ghadames', 'nutukas'] },
    { id: 'acc',  name: '飾品', items: ['amber', 'rose', 'puppet', 'garlic', 'baton', 'stein', 'fan', 'ankh', 'khamsa', 'lego', 'sunstone', 'bell'] }
  ];

  const byId = {};
  const byLevel = {};
  defs.forEach(function (d) {
    byId[d.id] = d;
    byLevel[d.level] = d;
  });
  SLOTS.forEach(function (s) {
    s.items.forEach(function (id) { if (byId[id]) byId[id].slot = s.id; });
  });

  /** 每個部位挑一件（ids 裡同部位有好幾件時，取 SLOTS 優先順序最前面的） */
  function pickWorn(ids) {
    const have = {};
    (ids || []).forEach(function (id) { have[id] = true; });
    const out = [];
    SLOTS.forEach(function (s) {
      const id = s.items.filter(function (k) { return have[k]; })[0];
      if (id) out.push(id);
    });
    return out;
  }

  /** 基礎能力值（完全沒裝備時） */
  function baseStats() {
    return {
      maxLives: 3,
      speed: 1,
      doubleJump: false,
      wallJump: false,
      coinMul: 1,
      invulnBonus: 0,
      glide: false,       // 滑翔（西班牙扇）
      // v1.18 新能力（取代揮擊相關的三件）
      fastThrow: false,   // 遠程攻擊冷卻縮短（德國啤酒杯）
      highStomp: false,   // 踩敵人彈得更高（奧地利指揮棒）
      stompAll: false,    // 踩不死的敵人也踩得倒（斯洛伐克斧杖）
      coyoteX: 1,         // 踩空邊緣後還能跳的寬限帧數倍率（v1.21 摩洛哥尖頭拖鞋）
      // v1.23 非洲篇
      stormProof: false,  // 風沙推不動、沙塵暴看得遠（阿爾及利亞頭巾）
      guardian: false,    // 每關擋一次致命傷（突尼西亞法蒂瑪之手）
      sandWalk: false,    // 流沙／鹽泥不會陷（利比亞皮靴）
      // v1.30 北歐篇
      brickSolid: false,  // 積木階梯一直都在（丹麥樂高積木）
      iceGrip: false,     // 冰面不會滑（瑞典馴鹿皮靴）
      nightSight: false,  // 黑暗裡光圈變大（挪威維京太陽石）
      steady: false,      // 被打到只退一半（冰島毛衣）
      // 以下由商店強化提供（Shop.resolve）
      magnet: 0,          // 金幣吸取半徑，0 = 沒有
      jumpBoost: 0,       // 跳躍力加成
      // v1.9 新能力
      ranged: null,       // 遠程攻擊：'ball'（板球）/ 'fire'（辣椒火球）
      stompWave: false,   // 重踩震波（荷蘭木鞋）
      bossStun: 1         // 魔王破綻期倍率（大蒜）
    };
  }

  /**
   * 把擁有的裝備換算成能力值，並疊上商店買的永久強化。
   * 未知 id 會被忽略。
   */
  function resolve(ownedIds) {
    const s = baseStats();
    s.worn = [];
    (ownedIds || []).forEach(function (id) {
      const d = byId[id];
      if (d) { d.apply(s); s.worn.push(id); }
    });

    // 商店強化疊加在裝備之上。
    // Shop 可能還沒載入（例如測試單獨跑 Equipment），所以要防。
    if (typeof Shop !== 'undefined' && typeof Save !== 'undefined') {
      const b = Shop.resolve();
      s.maxLives += b.bonusLives;
      s.invulnBonus += b.invulnBonus;
      /*
       * ⚠️ 要「疊加」不能「覆蓋」：原本寫成 s.magnet = b.magnet，
       * 裝備給的加成（東歐篇的領巾、斧杖、皮鞋）會被商店的 0 蓋掉，等於沒效果。
       */
      s.magnet = Math.max(s.magnet, b.magnet);
      s.jumpBoost += b.jumpBoost;
      s.coinMul += b.coinBonus;
    }
    // v1.30 玩家：整個遊戲的愛心上限太高 → 不管裝備、商店怎麼加，最多 5 顆
    s.maxLives = Math.min(MAX_LIVES, s.maxLives);
    return s;
  }
  const MAX_LIVES = 5;

  return {
    defs: defs,
    count: defs.length,
    SLOTS: SLOTS,
    pickWorn: pickWorn,
    slotOf: function (id) { return byId[id] ? byId[id].slot : null; },
    get: function (id) { return byId[id]; },
    forLevel: function (i) { return byLevel[i]; },
    resolve: resolve,
    MAX_LIVES: MAX_LIVES
  };
})();
