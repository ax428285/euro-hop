'use strict';

/**
 * 鍵盤 + 觸控輸入。
 *
 * ── 兩人同機（本機 2P） ────────────────────────────────────
 *
 * 按鍵分成三組：
 *   UI    選單、暫停、商店⋯⋯（誰按都算）
 *   P1    方向鍵 + 空白 + J
 *   P2    WASD + G
 *
 * ⚠️ 相容性：舊的 Input.isDown('left') 等呼叫遍布全專案
 * （地圖航行、各種選單、測試機器人）。所以「合併視圖」保留原本語意 ——
 * 任何一位玩家或 UI 按鍵都算。這樣單人模式與地圖操作完全不受影響，
 * 只有關卡內的玩家物理會改用 Input.pad(i) 讀各自的輸入。
 *
 * WASD 原本是 P1 的替代鍵，現在移給 P2。單人玩家用方向鍵或 WASD
 * 都還是能動（因為合併視圖），不會覺得被拿掉。
 */
const Input = (function () {

  // 全域 / UI 按鍵：不屬於任何一位玩家
  const MAP_UI = {
    Enter: 'confirm', NumpadEnter: 'confirm',
    KeyP: 'pause',
    Escape: 'back',
    KeyM: 'mute',
    KeyI: 'inventory', Tab: 'inventory',
    KeyB: 'shop',
    KeyN: 'mystery',     // 世界之謎（地圖上）
    // 隨時回歐洲大地圖（遊戲中、暫停中、過關畫面都能用）
    KeyQ: 'tomap', Backquote: 'tomap',
    // 存檔資訊 / 清除存檔
    F2: 'saveinfo',
    Delete: 'wipe',
    // 兩人模式切換（標題與地圖畫面用）
    KeyC: 'coop'
  };

  // 玩家 1：方向鍵 + 空白 + J
  // ↑ 在關卡裡是跳躍、在航海地圖是往北 —— 兩個動作都註冊，各場景自己選。
  const MAP_P1 = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: ['jump', 'up'],
    ArrowDown: 'down',
    Space: 'jump',
    KeyJ: 'attack',
    KeyK: 'throw'        // 遠程攻擊（板球／辣椒火球，要有裝備）
  };

  // 玩家 2：WASD + G
  const MAP_P2 = {
    KeyA: 'left',
    KeyD: 'right',
    KeyW: ['jump', 'up'],
    KeyS: 'down',
    KeyG: 'attack',
    KeyF: 'attack',
    KeyH: 'throw'
  };

  /** 連線時朋友能操作的動作（只有關卡內的角色操作；選關、暫停由房主決定） */
  const REMOTE_ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'throw'];

  /** 建一組 held/pressed 狀態 */
  function makeState() {
    return { held: Object.create(null), pressed: Object.create(null) };
  }

  const ui = makeState();
  const pads = [makeState(), makeState()];

  function set(st, action, down) {
    if (!action) return;
    if (down && !st.held[action]) st.pressed[action] = true;
    st.held[action] = down;
  }

  /** 一個按鍵可以對應多個動作（例如 ↑ 同時是 jump 與 up） */
  function setAll(st, mapped, down) {
    if (Array.isArray(mapped)) {
      for (let i = 0; i < mapped.length; i++) set(st, mapped[i], down);
    } else {
      set(st, mapped, down);
    }
  }

  /** 把一個 keydown/keyup 分派到對應的狀態組。回傳是否有處理。 */
  function dispatch(code, down) {
    let hit = false;
    if (MAP_UI[code]) { setAll(ui, MAP_UI[code], down); hit = true; }
    if (MAP_P1[code]) { setAll(pads[0], MAP_P1[code], down); hit = true; }
    if (MAP_P2[code]) { setAll(pads[1], MAP_P2[code], down); hit = true; }
    return hit;
  }

  /** 這個鍵有被對應到嗎（決定要不要 preventDefault） */
  function known(code) {
    return !!(MAP_UI[code] || MAP_P1[code] || MAP_P2[code]);
  }

  /** 正在輸入框打字（例如連線的邀請碼）：按鍵給輸入框，不要被遊戲吃掉 */
  function typing(e) {
    const el = e.target;
    return !!(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable));
  }

  window.addEventListener('keydown', function (e) {
    if (typing(e) || !known(e.code)) return;
    // 方向鍵/空白鍵會捲動頁面，擋掉
    e.preventDefault();
    // 長按的重複事件不要再觸發一次 pressed
    if (e.repeat) return;
    dispatch(e.code, true);
  }, { passive: false });

  window.addEventListener('keyup', function (e) {
    if (typing(e) || !known(e.code)) return;
    e.preventDefault();
    dispatch(e.code, false);
  }, { passive: false });

  // 失焦時全部放開，避免卡住一直往前走
  window.addEventListener('blur', function () {
    [ui, pads[0], pads[1]].forEach(function (st) {
      for (const k in st.held) st.held[k] = false;
    });
  });

  /** 合併查詢：UI 或任一玩家按了就算（維持舊行為） */
  function anyDown(a) {
    return !!(ui.held[a] || pads[0].held[a] || pads[1].held[a]);
  }
  function anyOnce(a) {
    return !!(ui.pressed[a] || pads[0].pressed[a] || pads[1].pressed[a]);
  }

  /**
   * 手機直拿時整個遊戲被 CSS 轉 90°（html.rot，由 main.js 依螢幕方向切換），
   * 觸控座標要跟著轉回遊戲座標。
   */
  function rotated() {
    return document.documentElement.classList.contains('rot');
  }

  /** 方向與跳躍攻擊給 P1，其餘（如回地圖、確定）算 UI */
  function targetOf(action) {
    return (action === 'left' || action === 'right' ||
            action === 'jump' || action === 'attack' || action === 'throw' ||
            action === 'up' || action === 'down') ? pads[0] : ui;
  }

  /**
   * 觸控按鈕綁定（手機只支援 P1）。
   * opts.mainAction()：動作搖桿「上」那顆現在代表什麼動作（關卡裡是 jump，其他畫面是 confirm…），
   *                    按下的那一刻問一次
   * opts.onPress(key, el)：動作搖桿某顆被按下（main.js 用來跳「武器未解鎖」提示）
   */
  function bindPad(root, opts) {
    if (!root) return;
    opts = opts || {};
    // 長按不要跳出系統選單（複製/存圖）
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    const actpad = root.querySelector('#actpad');
    root.querySelectorAll('[data-key]').forEach(function (btn) {
      if (actpad && actpad.contains(btn)) return;      // 動作搖桿整塊一起處理（bindActpad）
      const action = btn.getAttribute('data-key');
      const target = targetOf(action);
      // 同一顆按鈕可能被兩根手指按住，全部放開才算放開
      const fingers = new Set();
      const on = function (e) {
        e.preventDefault();
        fingers.add(e.pointerId);
        btn.classList.add('on');
        set(target, action, true);
      };
      const off = function (e) {
        e.preventDefault();
        fingers.delete(e.pointerId);
        if (fingers.size) return;
        btn.classList.remove('on');
        set(target, action, false);
      };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointerleave', off);
      btn.addEventListener('pointercancel', off);
      touchReleasers.push(function () {
        if (!fingers.size) return;
        fingers.clear();
        btn.classList.remove('on');
        set(target, action, false);
      });
    });
    bindDpad(root.querySelector('#dpad'));
    bindActpad(actpad, opts);
  }

  const DIRS = ['left', 'right', 'up', 'down'];

  /** 方向搖桿：搖桿的方向直接就是方向鍵 */
  function bindDpad(el) {
    if (!el) return;
    bindStick(el, function (dirs) {
      DIRS.forEach(function (d) {
        set(pads[0], d, !!dirs[d]);
        const mark = el.querySelector('[data-dir="' + d + '"]');
        if (mark) mark.classList.toggle('on', !!dirs[d]);
      });
    });
  }

  /**
   * 動作搖桿：跟方向搖桿一樣的拖曳操作，每個方向對應一顆鍵（data-dir）。
   * 手指不抬起來就能從 跳 滑到 揮；斜上方同時按兩顆（跳＋揮）。
   * 每顆鍵按下時才決定送出哪個動作，放開時放掉同一個動作 ——
   * 按住期間畫面切換（例如跳著過關），也不會留下卡住的鍵。
   */
  function bindActpad(el, opts) {
    if (!el) return;
    const slots = [];
    el.querySelectorAll('[data-dir]').forEach(function (btn) {
      slots.push({ dir: btn.getAttribute('data-dir'), key: btn.getAttribute('data-key'), el: btn, held: null });
    });
    bindStick(el, function (dirs) {
      slots.forEach(function (s) {
        const want = !!dirs[s.dir];
        if (want === !!s.held) return;
        if (want) {
          s.held = (s.key === 'jump' && opts.mainAction && opts.mainAction()) || s.key;
          set(targetOf(s.held), s.held, true);
          if (opts.onPress) opts.onPress(s.key, s.el);
        } else {
          set(targetOf(s.held), s.held, false);
          s.held = null;
        }
        s.el.classList.toggle('on', want);
      });
    });
  }

  /**
   * 搖桿：一整塊區域，用手指相對中心的角度決定方向（八方向）。
   *
   * 比分開的按鈕好用 —— 手指不必抬起來就能從 ← 滑到 →，
   * 也能按斜向（航海地圖要用）。用 pointer capture，手指滑出搖桿範圍也繼續追蹤。
   * apply(dirs) 收到 { left, right, up, down }，放開時收到 {}。
   */
  function bindStick(el, apply) {
    let finger = null;
    touchReleasers.push(function () {
      if (finger === null) return;
      finger = null;
      apply({});
    });

    function track(e) {
      const r = el.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      // 畫面被轉了 90°（手機直拿）：螢幕上的「往下」才是遊戲裡的「往右」
      if (rotated()) { const t = dx; dx = dy; dy = -t; }
      const dead = r.width * 0.12;
      // tan(67.5°) ≈ 2.414：八方向，每個斜向各佔 45°
      const ax = Math.abs(dx), ay = Math.abs(dy);
      apply({
        left: dx < -dead && ay < ax * 2.414,
        right: dx > dead && ay < ax * 2.414,
        up: dy < -dead && ax < ay * 2.414,
        down: dy > dead && ax < ay * 2.414
      });
    }

    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      /*
       * 已經有手指在追蹤時又按下來：直接換成新的這根。
       * 玩家回報（v1.17.5）：進瑞士關後方向卡在左上，再怎麼按搖桿都沒用 ——
       * 手機漏送了舊手指的放開事件，舊版在這裡 return，搖桿就永遠卡住。
       * 一個搖桿實際上只會有一根拇指，換手指不會誤判；舊手指之後真的放開也不理它。
       */
      finger = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* 舊瀏覽器 */ }
      track(e);
    });
    el.addEventListener('pointermove', function (e) {
      if (e.pointerId === finger) { e.preventDefault(); track(e); }
    });
    const release = function (e) {
      if (e.pointerId !== finger) return;
      finger = null;
      apply({});
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
    // pointer capture 沒抓到（舊瀏覽器、被系統搶走）時，放開事件會送到別的元素：整個視窗都聽
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  }

  /*
   * 觸控保險：所有手指都離開螢幕了，就把觸控按住的東西全部放開。
   * 不管手機是哪一步漏送了 pointerup，手指全放開那一下一定會歸零，不會一直往某個方向走。
   * （觸控的 touchend 在 pointerup 之後才送，正常放開時這裡什麼都不用做。）
   */
  const touchReleasers = [];
  function releaseAllTouch() { touchReleasers.forEach(function (f) { f(); }); }
  ['touchend', 'touchcancel'].forEach(function (ev) {
    window.addEventListener(ev, function (e) {
      if (!e.touches || e.touches.length === 0) releaseAllTouch();
    });
  });
  // 切到別的 App、拉下通知列：手指的放開事件不會回來
  document.addEventListener('visibilitychange', function () { if (document.hidden) releaseAllTouch(); });
  window.addEventListener('blur', releaseAllTouch);

  /** 畫面任意處點擊也能當 confirm（手機進標題畫面用） */
  function bindTapConfirm(el) {
    if (!el) return;
    el.addEventListener('pointerdown', function () { set(ui, 'confirm', true); });
    el.addEventListener('pointerup', function () { set(ui, 'confirm', false); });
  }

  /** 把點擊位置換算成畫布座標，地圖選國家用 */
  let lastClick = null;
  function bindCanvasClick(canvas, logicalW, logicalH) {
    if (!canvas) return;
    canvas.addEventListener('pointerdown', function (e) {
      const r = canvas.getBoundingClientRect();
      // 轉 90° 時畫布的 x 軸朝螢幕下方、y 軸朝螢幕左方
      lastClick = rotated() ? {
        x: (e.clientY - r.top) / r.height * logicalW,
        y: (r.right - e.clientX) / r.width * logicalH
      } : {
        x: (e.clientX - r.left) / r.width * logicalW,
        y: (e.clientY - r.top) / r.height * logicalH
      };
    });
  }

  /**
   * 取得某位玩家的輸入介面（0 = P1, 1 = P2）。
   * 形狀跟 Input 本身一樣，所以可以直接傳給 updatePlayer。
   */
  const padViews = pads.map(function (st) {
    return {
      isDown: function (a) { return !!st.held[a]; },
      once: function (a) { return !!st.pressed[a]; },
      endFrame: function () {}
    };
  });

  return {
    bindPad: bindPad,
    bindTapConfirm: bindTapConfirm,
    bindCanvasClick: bindCanvasClick,
    takeClick: function () { const c = lastClick; lastClick = null; return c; },
    /** 程式觸發一次 UI 動作（等同按一下就放開），例如手機 ☰ 在子畫面當「回地圖」 */
    press: function (action) { set(ui, action, true); set(ui, action, false); },
    /**
     * 連線遊玩：朋友的按鍵（由房主這邊收到）灌進 P2。
     * 跟鍵盤事件走同一個 set()，所以「按下那一帧」的判定完全一樣。
     */
    remote: function (action, down) {
      if (REMOTE_ACTIONS.indexOf(action) >= 0) set(pads[1], action, !!down);
    },
    /** 連線斷了：朋友那邊按住的鍵全部放開，不然 P2 會一直往前跑 */
    releaseRemote: function () { for (const k in pads[1].held) pads[1].held[k] = false; },
    REMOTE_ACTIONS: REMOTE_ACTIONS,
    isDown: anyDown,
    /** 只在按下的那一帧為 true */
    once: anyOnce,
    /** 單一玩家的輸入視圖 */
    pad: function (i) { return padViews[i] || padViews[0]; },
    /** 每帧結尾呼叫，清掉 pressed */
    endFrame: function () {
      [ui, pads[0], pads[1]].forEach(function (st) {
        for (const k in st.pressed) delete st.pressed[k];
      });
    }
  };
})();
