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
      worn: null,         // 裝上的裝備 { 部位: id }（v1.22 分部位；null = 舊存檔，讀進來時自動轉換）
      best: {},           // 各關最佳紀錄 { "0": {coins, total, cleared} }
      cleared: [],        // 已通關的關卡 index
      secrets: [],        // 已發現的密道 "關index:密道index"
      bosses: [],         // 已擊敗魔王的關卡 index
      exp: 0,             // 海上遭遇戰累積的經驗值（解鎖東歐篇用）
      seaWins: 0,         // 打贏幾場遭遇戰
      seaBosses: [],      // 打倒過的海上魔王 kind（v1.23 地中海海妖斯庫拉）
      allies: 0,          // 海神夥伴（消耗品，亞特蘭提斯神殿拿到；魔王關自動出戰一次用掉一個）
      costumes: [],     // 擁有的時裝 id（稀有怪掉落）
      costume: null       // 目前穿的時裝（null = 原本的條紋衫）
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
    out.seaWins = Math.max(0, parseInt(d.seaWins, 10) || 0);
    out.allies = U.clamp(parseInt(d.allies, 10) || 0, 0, ALLY_MAX);
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
        data.best[i] = { coins: coins, total: total, score: levelScore };
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

    reset: function () { data = blank(); persist(); }
  };
})();
