'use strict';

/**
 * 存檔。寫 localStorage，壞檔或無痕模式都不會讓遊戲掛掉。
 */
const Save = (function () {
  const KEY = 'eurohop.save.v2';

  /**
   * ⚠️ save.js 在 index.html 裡排在 levels.js 之前，
   * 所以「模組初始化階段」不能碰 Levels（會 ReferenceError，整個 Save 消失）。
   * 需要關卡數時一律走這個 getter，它只在被呼叫時才讀 Levels。
   */
  function levelCount() {
    return (typeof Levels !== 'undefined' && Levels.count) ? Levels.count : 6;
  }

  function blank() {
    return {
      // 六關全開，玩家自由選。
      // （原本是逐關解鎖，Antony 要求改成自由選擇）
      unlocked: levelCount(),
      score: 0,           // 累積分數
      wallet: 0,          // 可花用的金幣（商店用）
      upgrades: {},       // 已買的強化 { id: level }
      equipment: [],      // 已取得的裝備 id
      souvenirs: [],      // v1.31 美洲篇撿到的紀念品 id（souvenirs.js，只是收藏）
      worn: null,         // 裝上的裝備 { 部位: id }（v1.22 分部位；null = 舊存檔，讀進來時自動轉換）
      best: {},           // 各關最佳紀錄 { "0": {coins, total, cleared} }
      cleared: [],        // 已通關的關卡 index
      secrets: [],        // 已發現的密道 "關index:密道index"
      bosses: [],         // 已擊敗魔王的關卡 index
      exp: 0,             // 海上遭遇戰累積的經驗值（解鎖東歐篇用）
      expAm: 0,           // v1.31 新大陸的海上遭遇戰另外累積的「美洲 EXP」（解鎖南美用）
      seaWins: 0,         // 打贏幾場遭遇戰
      seaBosses: [],      // 打倒過的海上魔王 kind（v1.23 地中海海妖斯庫拉）
      ship: { sail: 0, cannon: 0, hull: 0, powder: 0, paint: 'oak', paints: ['oak'] },   // 造船廠升級（v1.26，見 shipyard.js）
      day: 0,             // 貿易的「日子」：打完一關或一場海戰過一天，價格與懸賞跟著換（v1.27）
      cargo: {},          // 船艙裡的貨 { goodId: 箱數 }
      bounty: null,       // 接下的懸賞（一次一張，見 trade.js）
      bountyDone: 0,      // 今天已完成幾張（完成後同一天換新的三張）
      relics: [],         // 沉船潛水撈到的寶物 id（v1.26 安提基特拉沉船）
      pet: null,          // 寵物（v1.29：'dog' = 峽灣的黃金獵犬，餵一根臘腸就跟你走）
      allies: 0,          // 海神夥伴（消耗品，亞特蘭提斯神殿拿到；魔王關自動出戰一次用掉一個）
      costumes: [],     // 擁有的時裝 id（稀有怪掉落）
      costume: null,      // 目前穿的時裝（null = 原本的條紋衫）
      /*
       * v1.30 劇情旗標（見 quests.js）：
       *   thorAsked 跟索爾講過話（知道洛基躲在漩渦底下）
       *   loki      在冥界找到洛基
       *   north     北歐的結界解開了（北歐篇開放）
       *   columbus  哥倫布的委託：1 = 接下了（戰艦出現）、2 = 完成（美洲預告）
       */
      flags: {},
      // v1.30 瑞士銀行：open = 開戶了；bal = 存款；last = 上次算利息的時間（ms）
      bank: { open: false, bal: 0, last: 0 },
      // v1.30 阿爾及利亞動物園：{ 動物 id: 隻數 }；zooDay = 上次收門票是第幾天
      zoo: {},
      zooDay: 0
    };
  }

  const ALLY_MAX = 1;     // 海神夥伴最多帶幾個（v1.25.1 玩家：最多只能一位）
  let data = blank();

  function sanitize(d) {
    const out = blank();
    if (!d || typeof d !== 'object') return out;

    // 全開模式：舊存檔（可能寫著 unlocked:1）讀進來也一律開滿
    out.unlocked = levelCount();
    out.score = Math.max(0, parseInt(d.score, 10) || 0);
    out.wallet = Math.max(0, parseInt(d.wallet, 10) || 0);
    out.exp = Math.max(0, parseInt(d.exp, 10) || 0);
    out.expAm = Math.max(0, parseInt(d.expAm, 10) || 0);
    out.seaWins = Math.max(0, parseInt(d.seaWins, 10) || 0);
    out.allies = U.clamp(parseInt(d.allies, 10) || 0, 0, ALLY_MAX);
    out.day = Math.max(0, parseInt(d.day, 10) || 0);
    out.bountyDone = Math.max(0, parseInt(d.bountyDone, 10) || 0);
    if (d.cargo && typeof d.cargo === 'object' && typeof Trade !== 'undefined') {
      // v1.29 熱那亞的橄欖油換成臘腸：舊存檔船艙裡的橄欖油當成臘腸（同一個產地、同樣的箱數）
      if (d.cargo.oil && !d.cargo.sausage) d.cargo.sausage = d.cargo.oil;
      Trade.GOODS.forEach(function (g) { const n = parseInt(d.cargo[g.id], 10) || 0; if (n > 0) out.cargo[g.id] = n; });
    }
    if (d.bounty && typeof d.bounty === 'object' && typeof d.bounty.type === 'string') {
      out.bounty = d.bounty;
      if (out.bounty.good === 'oil') out.bounty.good = 'sausage';
    }
    if (d.pet === 'dog') out.pet = 'dog';
    if (d.ship && typeof d.ship === 'object' && typeof Shipyard !== 'undefined') out.ship = Shipyard.sanitize(d.ship);
    if (Array.isArray(d.relics)) {
      d.relics.forEach(function (r) { if (typeof r === 'string' && out.relics.indexOf(r) < 0) out.relics.push(r); });
    }
    if (Array.isArray(d.seaBosses)) {
      d.seaBosses.forEach(function (k) {
        if (typeof k === 'string' && out.seaBosses.indexOf(k) < 0) out.seaBosses.push(k);
      });
    }
    if (Array.isArray(d.costumes) && typeof Costumes !== 'undefined') {
      d.costumes.forEach(function (id) {
        if (Costumes.get(id) && out.costumes.indexOf(id) < 0) out.costumes.push(id);
      });
    }
    out.costume = out.costumes.indexOf(d.costume) >= 0 ? d.costume : null;
    // v1.30 劇情旗標、銀行、動物園
    if (d.flags && typeof d.flags === 'object') {
      Object.keys(d.flags).forEach(function (k) {
        const v = d.flags[k];
        if (typeof v === 'number' || typeof v === 'boolean') out.flags[k] = v;
      });
    }
    if (d.bank && typeof d.bank === 'object') {
      out.bank.open = !!d.bank.open;
      out.bank.bal = Math.max(0, parseInt(d.bank.bal, 10) || 0);
      out.bank.last = Math.max(0, Number(d.bank.last) || 0);
    }
    if (d.zoo && typeof d.zoo === 'object') {
      Object.keys(d.zoo).forEach(function (k) {
        const n = parseInt(d.zoo[k], 10) || 0;
        if (n > 0 && /^[a-z]+$/.test(k)) out.zoo[k] = 1;
      });
    }
    out.zooDay = Math.max(0, parseInt(d.zooDay, 10) || 0);

    // 強化：只留真的存在的 id，階數夾在 [0, maxLevel]
    if (d.upgrades && typeof d.upgrades === 'object') {
      Object.keys(d.upgrades).forEach(function (id) {
        const it = (typeof Shop !== 'undefined') ? Shop.get(id) : null;
        if (!it) return;
        const lv = parseInt(d.upgrades[id], 10);
        if (!(lv > 0)) return;
        out.upgrades[id] = Math.min(lv, it.maxLevel);
      });
    }

    if (Array.isArray(d.souvenirs) && typeof Souvenirs !== 'undefined') {
      d.souvenirs.forEach(function (id) {
        if (Souvenirs.get(id) && out.souvenirs.indexOf(id) < 0) out.souvenirs.push(id);
      });
    }

    // 只留真的存在的裝備 id，去重
    if (Array.isArray(d.equipment)) {
      const seen = {};
      d.equipment.forEach(function (id) {
        if (Equipment.get(id) && !seen[id]) { seen[id] = true; out.equipment.push(id); }
      });
    }
    /*
     * 裝上的裝備（v1.22）。只留「有這件、而且部位對得上」的。
     * 舊存檔沒有 worn：以前所有裝備都生效，轉換成每個部位裝一件（依 Equipment.SLOTS 的優先順序）。
     */
    out.worn = {};
    if (d.worn && typeof d.worn === 'object') {
      Object.keys(d.worn).forEach(function (slot) {
        const id = d.worn[slot];
        if (out.equipment.indexOf(id) >= 0 && Equipment.slotOf(id) === slot) out.worn[slot] = id;
      });
    } else {
      Equipment.pickWorn(out.equipment).forEach(function (id) { out.worn[Equipment.slotOf(id)] = id; });
    }

    if (Array.isArray(d.cleared)) {
      d.cleared.forEach(function (i) {
        const n = parseInt(i, 10);
        if (n >= 0 && n < Levels.count && out.cleared.indexOf(n) < 0) out.cleared.push(n);
      });
    }

    // 密道 key 格式 "關:索引"，兩段都要是合理數字
    if (Array.isArray(d.secrets)) {
      d.secrets.forEach(function (k) {
        if (typeof k !== 'string') return;
        const parts = k.split(':');
        const lv = parseInt(parts[0], 10);
        const si = parseInt(parts[1], 10);
        if (!(lv >= 0 && lv < Levels.count) || !(si >= 0)) return;
        if (out.secrets.indexOf(k) < 0) out.secrets.push(k);
      });
    }

    if (Array.isArray(d.bosses)) {
      d.bosses.forEach(function (i) {
        const n = parseInt(i, 10);
        if (n >= 0 && n < Levels.count && out.bosses.indexOf(n) < 0) out.bosses.push(n);
      });
    }

    if (d.best && typeof d.best === 'object') {
      Object.keys(d.best).forEach(function (k) {
        const n = parseInt(k, 10);
        if (!(n >= 0 && n < Levels.count)) return;
        const b = d.best[k];
        if (!b) return;
        out.best[n] = {
          coins: Math.max(0, parseInt(b.coins, 10) || 0),
          total: Math.max(0, parseInt(b.total, 10) || 0),
          score: Math.max(0, parseInt(b.score, 10) || 0)
        };
      });
    }
    return out;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? sanitize(JSON.parse(raw)) : blank();
    } catch (e) {
      data = blank();
    }
    return data;
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;   // 無痕模式/配額滿，遊戲照樣能玩
    }
  }

  return {
    load: load,
    save: persist,
    get: function () { return data; },

    /** 存檔位置與狀態，給「存檔資訊」畫面用 */
    key: KEY,
    info: function () {
      let bytes = 0;
      let writable = false;
      try {
        const raw = localStorage.getItem(KEY);
        bytes = raw ? raw.length : 0;
        // 實際試寫一次才知道能不能存（無痕模式會丟錯）
        const probe = KEY + '.probe';
        localStorage.setItem(probe, '1');
        localStorage.removeItem(probe);
        writable = true;
      } catch (e) {
        writable = false;
      }
      return { key: KEY, bytes: bytes, writable: writable };
    },

    hasEquip: function (id) { return data.equipment.indexOf(id) >= 0; },

    /** v1.31 紀念品（美洲篇）：有沒有／拿到一個（已經有就回 false） */
    hasSouvenir: function (id) { return data.souvenirs.indexOf(id) >= 0; },
    addSouvenir: function (id) {
      if (typeof Souvenirs === 'undefined' || !Souvenirs.get(id) || data.souvenirs.indexOf(id) >= 0) return false;
      data.souvenirs.push(id);
      persist();
      return true;
    },

    /** 拿到一件裝備。那個部位空著就順便裝上（v1.22：部位有東西了就只放進背包） */
    addEquip: function (id) {
      if (!Equipment.get(id) || data.equipment.indexOf(id) >= 0) return false;
      data.equipment.push(id);
      if (!data.worn) data.worn = {};
      const slot = Equipment.slotOf(id);
      if (slot && !data.worn[slot]) data.worn[slot] = id;
      persist();
      return true;
    },

    /** 生效中的裝備 id（每個部位最多一件；能力值一律用這個算） */
    wornIds: function () {
      const w = data.worn || {};
      return Equipment.SLOTS.map(function (s) { return w[s.id]; }).filter(Boolean);
    },
    isWorn: function (id) {
      const slot = Equipment.slotOf(id);
      return !!(slot && data.worn && data.worn[slot] === id);
    },
    /** 裝上（同部位原本那件會被換下來）；回傳被換下來的 id */
    wear: function (id) {
      if (data.equipment.indexOf(id) < 0) return null;
      const slot = Equipment.slotOf(id);
      if (!slot) return null;
      if (!data.worn) data.worn = {};
      const prev = data.worn[slot] || null;
      data.worn[slot] = id;
      persist();
      return prev;
    },
    /** 卸下某件（那個部位變空的） */
    unwear: function (id) {
      const slot = Equipment.slotOf(id);
      if (!slot || !data.worn || data.worn[slot] !== id) return false;
      delete data.worn[slot];
      persist();
      return true;
    },

    isCleared: function (i) { return data.cleared.indexOf(i) >= 0; },

    /**
     * 把一關變回「還沒破」（v1.31 塞爾維亞、保加利亞換了新玩法，已經破過的玩家也要能再玩到）：
     * 拿掉通關、最佳紀錄、這關的密道紀錄。裝備不收回。
     */
    resetLevel: function (i) {
      data.cleared = data.cleared.filter(function (k) { return k !== i; });
      delete data.best[i];
      data.secrets = data.secrets.filter(function (k) { return k.indexOf(i + ':') !== 0; });
      data.bosses = data.bosses.filter(function (k) { return k !== i; });
      persist();
    },

    /** 密道發現紀錄。key = "關index:密道index" */
    secretKey: function (lv, si) { return lv + ':' + si; },

    hasSecret: function (lv, si) {
      return data.secrets.indexOf(lv + ':' + si) >= 0;
    },

    markSecret: function (lv, si) {
      const k = lv + ':' + si;
      if (data.secrets.indexOf(k) >= 0) return false;
      data.secrets.push(k);
      persist();
      return true;
    },

    /** 這一關總共發現幾條密道 */
    secretsFound: function (lv) {
      const pre = lv + ':';
      return data.secrets.filter(function (k) { return k.indexOf(pre) === 0; }).length;
    },

    bossBeaten: function (i) { return data.bosses.indexOf(i) >= 0; },

    markBoss: function (i) {
      if (data.bosses.indexOf(i) >= 0) return false;
      data.bosses.push(i);
      persist();
      return true;
    },

    markCleared: function (i, coins, total, levelScore) {
      if (data.cleared.indexOf(i) < 0) data.cleared.push(i);
      if (i + 1 < Levels.count && data.unlocked < i + 2) data.unlocked = i + 2;
      const prev = data.best[i];
      if (!prev || coins > prev.coins || levelScore > prev.score) {
        // v1.30：金幣、分數各自留最高（瑞士銀行看「金幣有沒有收滿過」，不能被分數比較高的那次蓋掉）
        data.best[i] = { coins: Math.max(coins, prev ? prev.coins : 0), total: total,
                         score: Math.max(levelScore, prev ? prev.score : 0) };
      }
      persist();
    },

    addScore: function (n) { data.score += n; persist(); },

    /** 拿到一套時裝（已經有就回 false）；第一次拿到會順便穿上 */
    addCostume: function (id) {
      if (!Costumes.get(id) || data.costumes.indexOf(id) >= 0) return false;
      data.costumes.push(id);
      data.costume = id;
      persist();
      return true;
    },

    /** 換穿時裝（null = 脫掉，穿回條紋衫） */
    wearCostume: function (id) {
      if (id != null && data.costumes.indexOf(id) < 0) return false;
      data.costume = id;
      persist();
      return true;
    },

    /** 造船廠：目前的船（{ sail, cannon, hull, paint, paints }） */
    ship: function () { return data.ship; },
    /** 花錢升級／買油漆（Shipyard 算好價錢與上限才呼叫） */
    setShip: function (ship, cost) {
      if (cost > data.wallet) return false;
      data.wallet -= cost;
      data.ship = ship;
      persist();
      return true;
    },
    // ── 貿易與懸賞（v1.27）──
    /** 過一天：價格換、今天完成數歸零 */
    nextDay: function () { data.day++; data.bountyDone = 0; persist(); },
    cargoCount: function () { return Object.keys(data.cargo).reduce(function (s, k) { return s + data.cargo[k]; }, 0); },
    /** 船艙加減貨（n 可以是負的）；錢在呼叫端算好一起傳（正 = 收錢，負 = 付錢） */
    moveCargo: function (goodId, n, money) {
      const now = (data.cargo[goodId] || 0) + n;
      if (now < 0 || data.wallet + money < 0) return false;
      if (now === 0) delete data.cargo[goodId]; else data.cargo[goodId] = now;
      data.wallet += money;
      persist();
      return true;
    },
    setBounty: function (b) { data.bounty = b; persist(); },
    // ── 寵物（v1.29）──
    pet: function () { return data.pet; },
    setPet: function (id) { data.pet = id; persist(); },
    /** 懸賞完成：清掉、加今天的完成數（獎勵由呼叫端用 addCoins / addExp 給） */
    finishBounty: function () { data.bounty = null; data.bountyDone++; persist(); },
    /** 只改記憶體不存檔（送信倒數每帧都在減，呼叫端隔一段再 save） */
    touch: function () { persist(); },

    /** 沉船寶物：第一次撈到回 true */
    addRelic: function (id) {
      if (data.relics.indexOf(id) >= 0) return false;
      data.relics.push(id);
      persist();
      return true;
    },

    /** 海神夥伴：拿到一個（最多 ALLY_MAX，回傳拿到後的數量） */
    addAlly: function () { data.allies = Math.min(ALLY_MAX, (data.allies || 0) + 1); persist(); return data.allies; },
    /** 用掉一個海神夥伴（沒有就回 false） */
    useAlly: function () { if (!(data.allies > 0)) return false; data.allies--; persist(); return true; },
    ALLY_MAX: ALLY_MAX,

    /** 海上魔王：第一次打倒回 true（之後再打只給一般獎勵） */
    markSeaBoss: function (kind) {
      if (data.seaBosses.indexOf(kind) >= 0) return false;
      data.seaBosses.push(kind);
      persist();
      return true;
    },
    seaBossDown: function (kind) { return data.seaBosses.indexOf(kind) >= 0; },

    /** 懸賞之類的額外 EXP（不算一場遭遇戰勝利） */
    gainExp: function (n) { if (n > 0) { data.exp += n; persist(); } },

    /** v1.31 新大陸的遭遇戰勝利：加「美洲 EXP」（跟歐洲的 EXP 分開算） */
    expAm: function () { return data.expAm || 0; },
    addExpAm: function (n) {
      const before = data.expAm || 0;
      if (n > 0) data.expAm = before + n;
      data.seaWins++;
      persist();
      return { before: before, after: data.expAm || 0 };
    },

    /** 遭遇戰勝利：加 EXP，回傳加之前/之後（過關畫面要判斷是不是剛好解鎖） */
    addExp: function (n) {
      const before = data.exp;
      if (n > 0) data.exp += n;
      data.seaWins++;
      persist();
      return { before: before, after: data.exp };
    },

    // ── 金幣錢包（商店用）──
    // 跟 score 分開：score 是成績，wallet 是可花用的餘額。
    addCoins: function (n) {
      if (!(n > 0)) return;
      data.wallet += n;
      persist();
    },

    spendCoins: function (n) {
      if (!(n > 0) || data.wallet < n) return false;
      data.wallet -= n;
      persist();
      return true;
    },

    // ── 商店強化 ──
    upgradeLevel: function (id) {
      return data.upgrades[id] || 0;
    },

    addUpgrade: function (id) {
      const it = (typeof Shop !== 'undefined') ? Shop.get(id) : null;
      if (!it) return false;
      const cur = data.upgrades[id] || 0;
      if (cur >= it.maxLevel) return false;
      data.upgrades[id] = cur + 1;
      persist();
      return true;
    },

    // v1.30 劇情旗標（quests.js）
    flag: function (k) { return data.flags[k] || 0; },
    setFlag: function (k, v) { data.flags[k] = v; persist(); },
    bank: function () { return data.bank; },
    zoo: function () { return data.zoo; },
    // v1.30 玩家：動物園每種動物一隻就好 → 回傳 true = 這種是新抓到的
    addAnimal: function (id) { const fresh = !data.zoo[id]; data.zoo[id] = 1; persist(); return fresh; },
    reset: function () { data = blank(); persist(); }
  };
})();
