'use strict';

(function () {
  // 分頁標題一律從 Brand 取（改名時只要改 branding.js 一處）
  document.title = Brand.documentTitle;
  const canvas = document.getElementById('game');

  /*
   * 觸控裝置一律用「橫向全螢幕 + 按鈕疊在畫面上」的版面。
   * 手機直拿時網頁沒辦法強制轉向，所以用 CSS 把整個畫面轉 90°（html.rot），
   * 玩家把手機橫過來就是正的。input.js 會依 html.rot 換算觸控座標。
   */
  const touchMq = window.matchMedia('(hover: none) and (pointer: coarse)');
  function layout() {
    const touch = touchMq.matches;
    const cls = document.documentElement.classList;
    cls.toggle('touch', touch);
    cls.toggle('rot', touch && window.innerHeight > window.innerWidth);
  }
  layout();
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', layout);

  /** 電腦版：畫布實際像素跟著顯示大小走，放大後字和圖才清楚（見 Game.setRenderScale） */
  function fitResolution() {
    if (touchMq.matches) { Game.setRenderScale(1); return; }
    const w = canvas.getBoundingClientRect().width;
    Game.setRenderScale(w * (window.devicePixelRatio || 1) / 960);
  }
  window.addEventListener('resize', fitResolution);

  /*
   * 擋掉瀏覽器的放大手勢（玩家回報：點到按鈕旁邊，畫面突然放大）。
   *
   * CSS 已經設了 touch-action: none，但 iPhone Safari 不完全照做：
   *   - 兩指縮放：Safari 有自己的 gesture 事件，要直接擋
   *   - 點兩下放大：300ms 內第二次點擊的 touchend 擋掉預設行為
   * 按鈕、輸入框、連線面板不擋：按鈕本身已經用 CSS 關掉放大，而且很多按鈕靠 click 事件
   * （選單、「刪除存檔」要連按兩次），擋了 touchend 會讓第二下按不到。
   * 真正會放大的是「按鈕旁邊的空白處」，擋那裡就夠了。
   */
  function zoomSafe(el) {
    return !!(el && el.closest && el.closest('button, input, textarea, .np-box'));
  }
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false });
  });
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function (e) {
    const now = Date.now();
    if (now - lastTouchEnd < 300 && !zoomSafe(e.target)) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  document.addEventListener('touchmove', function (e) {
    // 兩指以上 = 縮放手勢
    if (e.touches && e.touches.length > 1 && !zoomSafe(e.target)) e.preventDefault();
  }, { passive: false });
  /*
   * 「跳」與「確定」合成一顆（手機按鈕太多）。兩個動作用在不同畫面，不會搶：
   *   關卡裡           跳（關卡裡沒有任何東西吃 Enter）
   *   暫停／放棄確認框  繼續（= 取消，最好按的鍵永遠是安全的那個）
   *   其他畫面          確定（地圖進城、商店購買、過關畫面…）
   *
   * 「丟」那顆在放棄確認框裡變成「地圖」= 確定回大地圖（v1.20.2 玩家：按繼續回關卡、按丟回大地圖）。
   * 舊版要再打開 ☰ 選單按一次地圖，太麻煩。
   */
  const MAIN_KEY = {
    play: { action: 'jump', label: '跳', sub: '空白', cls: 'btn-jump' },
    paused: { action: 'back', label: '繼續', sub: 'Esc', cls: 'btn-ok' },
    quitconfirm: { action: 'jump', label: '繼續', sub: 'Esc', cls: 'btn-ok' }
  };
  const MAIN_CONFIRM = { action: 'confirm', label: '確定', sub: 'Enter', cls: 'btn-ok' };
  function mainKey() { return MAIN_KEY[Game.scene()] || MAIN_CONFIRM; }
  const THROW_KEY = {
    quitconfirm: { action: 'confirm', label: '地圖', sub: 'Q' }
  };
  const THROW_NORMAL = { action: 'throw', label: '丟', sub: 'K' };
  function throwKey() { return THROW_KEY[Game.scene()] || THROW_NORMAL; }
  Input.bindPad(document.getElementById('pad'), {
    actionFor: function (key) {
      if (key === 'jump') return mainKey().action;
      if (key === 'throw') return throwKey().action;
      return key;
    },
    onPress: function (key, el) {
      if (el.classList.contains('locked')) Game.lockedHint(key);
    }
  });
  Input.bindCanvasClick(canvas, 960, 480);

  // ☰ 選單：按一下展開功能列；按了其中一顆或點遊戲畫面就收起來
  const pad = document.getElementById('pad');
  const menuBtn = document.getElementById('btn-menu');
  function setMenu(open) {
    pad.classList.toggle('menu', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  /*
   * 子畫面（商店、裝備、存檔）是從 ☰ 選單點進去的，
   * 這時 ☰ 變成「↩ 回大地圖」：再按一次就回去，不用再打開選單找「地圖」。
   */
  // v1.28.3 玩家：進港口（貿易港、造船廠）後左上角沒有返回 → 這兩個畫面也算子畫面
  const SUB_SCREENS = { shop: true, inventory: true, saveinfo: true, mystery: true, market: true, shipyard: true, journal: true };
  /*
   * 關卡裡（從港口進去之後）☰ 也變成 ↩（v1.27.1 玩家要求）。
   * 按下去送「回地圖」：遊戲中會先跳「放棄這一關？」確認框（那時遊戲是凍結的，也就兼當暫停），
   * 在確認框再按一次 ↩ 才真的回去；過關／陣亡畫面直接回地圖 —— 這些遊戲本來就這樣處理「回地圖」。
   * 結局畫面（win）不算：那裡只吃確定，回地圖沒反應。
   * 連線的朋友不換：朋友不能決定離開關卡（房主說了算），而且要留著 ☰ →「連線」才能離開連線。
   */
  const LEVEL_SCREENS = { play: true, paused: true, quitconfirm: true, clear: true, dead: true };
  function onSubScreen() {
    const s = Game.scene();
    if (SUB_SCREENS[s]) return true;
    return !!LEVEL_SCREENS[s] && Game.netInfo().side !== 'guest';
  }
  menuBtn.addEventListener('click', function () {
    if (onSubScreen()) { setMenu(false); Input.press('tomap'); return; }
    setMenu(!pad.classList.contains('menu'));
  });
  document.getElementById('pad-menu').addEventListener('click', function () { setMenu(false); });
  // 電腦版用滑鼠點完按鈕，焦點會留在按鈕上；之後按空白/Enter 可能又「按」到它，所以點完就放掉焦點
  pad.addEventListener('click', function () {
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
  canvas.addEventListener('pointerdown', function () { setMenu(false); });

  // 全螢幕（Android Chrome 可用；iPhone Safari 不支援元素全螢幕，就把按鈕藏起來）
  const fsBtn = document.getElementById('btn-fullscreen');
  const root = document.documentElement;
  const requestFs = root.requestFullscreen || root.webkitRequestFullscreen;
  if (fsBtn && !requestFs) fsBtn.style.display = 'none';
  if (fsBtn && requestFs) {
    fsBtn.addEventListener('click', function () {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        return;
      }
      const p = requestFs.call(root);
      // 全螢幕後順便鎖橫向，畫面最大
      if (p && p.then) {
        p.then(function () {
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(function () {});
          }
        }).catch(function () {});
      }
    });
  }

  // 瀏覽器要求使用者互動後才允許播音效
  function unlock() {
    Sfx.init();
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('pointerdown', unlock);
  }
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);

  Game.init(canvas);
  fitResolution();

  /*
   * 武器鍵上鎖：還沒拿到裝備時，丟的按鈕蓋一個鎖頭。
   * 朋友回報「按了沒反應」—— 他不知道要先去拿武器。按下上鎖的鍵會跳提示告訴他去哪一關拿。
   * 裝備隨時可能拿到（關卡裡撿到、讀存檔、清除存檔），所以定時對一次，只在有變時才改 DOM。
   */
  const weaponBtns = ['throw'].map(function (a) {
    return { action: a, el: pad.querySelector('[data-key="' + a + '"]') };
  });
  function syncLocks() {
    const ab = Game.abilities();
    weaponBtns.forEach(function (w) {
      // 放棄確認框裡這顆是「地圖」，跟有沒有武器無關，不上鎖
      const locked = !ab[w.action] && throwKey() === THROW_NORMAL;
      if (w.el.classList.contains('locked') !== locked) {
        w.el.classList.toggle('locked', locked);
        w.el.setAttribute('aria-label', w.el.getAttribute('aria-label').replace(/（未解鎖）$/, '') +
                          (locked ? '（未解鎖）' : ''));
      }
    });
  }

  /** 合併鍵的字跟顏色跟著畫面換（跳／確定／繼續）；丟那顆在放棄確認框裡換成「地圖」 */
  const mainBtn = pad.querySelector('#actpad [data-key="jump"]');
  const throwBtn = pad.querySelector('#actpad [data-key="throw"]');
  let mainShown = null, throwShown = null;
  function syncMainKey() {
    const k = mainKey();
    if (k !== mainShown) {
      mainShown = k;
      mainBtn.innerHTML = k.label + '<small>' + k.sub + '</small>';
      mainBtn.classList.toggle('btn-jump', k.cls === 'btn-jump');
      mainBtn.classList.toggle('btn-ok', k.cls === 'btn-ok');
      mainBtn.setAttribute('aria-label', k.label);
    }
    const tk = throwKey();
    if (tk !== throwShown) {
      throwShown = tk;
      throwBtn.innerHTML = tk.label + '<small>' + tk.sub + '</small>';
      throwBtn.setAttribute('aria-label', (tk === THROW_NORMAL ? '遠程攻擊' : '回大地圖') +
                            (throwBtn.classList.contains('locked') ? '（未解鎖）' : ''));
    }
  }
  /*
   * 刪除存檔（☰ 選單裡，電腦與手機共用）。
   * 原本鍵盤版只能在存檔畫面按 Delete 兩次，畫面上沒有任何提示，玩家找不到。
   * 刪了救不回來，所以要按兩次：第一次變紅「再按一次確認刪除」（選單保持開著），
   * 3 秒內沒再按就恢復。關卡進行中選單裡不顯示這顆。
   */
  const wipeBtn = document.getElementById('btn-wipe');
  let wipeTimer = null;
  function disarmWipe() {
    clearTimeout(wipeTimer);
    wipeTimer = null;
    wipeBtn.classList.remove('armed');
    wipeBtn.textContent = '刪除存檔';
  }
  wipeBtn.addEventListener('click', function (e) {
    if (!Game.canWipe()) return;
    if (wipeBtn.classList.contains('armed')) {
      disarmWipe();
      Game.wipeSave();
      return;                          // 讓 click 冒泡上去收起選單
    }
    e.stopPropagation();               // 第一次按：選單不要收起來，玩家才按得到第二次
    wipeBtn.classList.add('armed');
    wipeBtn.textContent = '再按一次確認刪除';
    wipeTimer = setTimeout(disarmWipe, 3000);
  });

  /** 關卡中（含暫停、確認框、過關畫面）：選單裡藏起「刪除存檔」 */
  function syncScene() {
    // 大地圖（古地圖羊皮紙）時外框換成木框，見 style.css body.mapframe
    const onMap = Game.scene() === 'map' || Game.scene() === 'title';   // 首頁也是羊皮紙（v1.29.10）
    if (document.body.classList.contains('mapframe') !== onMap) document.body.classList.toggle('mapframe', onMap);
    const inLevel = !Game.canWipe();
    if (pad.classList.contains('inlevel') !== inLevel) {
      pad.classList.toggle('inlevel', inLevel);
      if (inLevel) disarmWipe();
    }
    if (!pad.classList.contains('menu') && wipeBtn.classList.contains('armed')) disarmWipe();
  }

  /** ☰ 的圖示跟著畫面換：子畫面與關卡裡顯示 ↩（回大地圖） */
  function syncMenuIcon() {
    const sub = onSubScreen();
    if (menuBtn.classList.contains('back') === sub) return;
    menuBtn.classList.toggle('back', sub);
    menuBtn.textContent = sub ? '↩' : '☰';
    menuBtn.setAttribute('aria-label', sub ? '回大地圖' : '選單');
    if (sub) setMenu(false);
  }

  /*
   * 連線面板（☰ →「連線」）。
   * 只負責介面：建房、輸入邀請碼、顯示狀態；連線本身在 net.js，遊戲同步在 game.js。
   */
  const np = {
    panel: document.getElementById('netpanel'),
    start: document.getElementById('np-start'),
    room: document.getElementById('np-room'),
    code: document.getElementById('np-code'),
    codeVal: document.getElementById('np-codeval'),
    status: document.getElementById('np-status'),
    leave: document.getElementById('np-leave'),
    netBtn: document.getElementById('btn-net')
  };
  let roomCode = null;

  function npStatus(msg, isErr) {
    np.status.textContent = msg || '';
    np.status.classList.toggle('err', !!isErr);
  }
  function npRender() {
    const role = Net.role();
    np.start.hidden = !!role;
    np.room.hidden = !(role === 'host' && roomCode);
    np.codeVal.textContent = roomCode || '------';
    np.leave.hidden = !role;
  }
  function npOpen() {
    np.panel.hidden = false;
    npRender();
    // 電腦版直接把游標放進輸入框。要等這次點擊處理完（選單會在 click 冒泡時把焦點放掉）；
    // 手機不自動聚焦，不然鍵盤一彈出來就蓋住半個畫面
    if (!Net.role() && !document.documentElement.classList.contains('touch')) {
      setTimeout(function () { np.code.focus({ preventScroll: true }); }, 0);
    }
  }
  function npClose() { np.panel.hidden = true; np.code.blur(); }
  /** 關卡中不能開始連線：房主要從下一關開始帶朋友，朋友加入會離開自己正在打的關卡 */
  function npBusy() {
    if (Game.netInfo().inLevel) { npStatus('請先回到地圖再開始連線', true); return true; }
    return false;
  }
  function copyText(text, okMsg) {
    const done = function () { npStatus(okMsg); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { npStatus('複製失敗，請手動把邀請碼抄給朋友', true); });
    } else {
      npStatus('這個瀏覽器不能自動複製，請手動把邀請碼抄給朋友', true);
    }
  }

  np.netBtn.addEventListener('click', npOpen);
  /*
   * v1.31.8 玩家：電腦版選單沒有快捷鍵 → O = 打開／收起 ☰ 選單、U = 連線面板、F11 = 全螢幕（瀏覽器自己的）。
   * 在輸入框（連線的邀請碼）裡打字時不算。選單打開時按 Esc 先收起選單。
   */
  // v1.31.10 說明列（#hint）的橘色字都是按鈕：點了就跟按那個鍵一樣
  document.querySelectorAll('#hint .hk').forEach(function (b) {
    b.addEventListener('click', function () {
      const act = b.getAttribute('data-act');
      if (act === 'menu') setMenu(!pad.classList.contains('menu'));
      else if (act === 'net') { setMenu(false); npOpen(); }
      else if (act === 'fullscreen') { if (fsBtn && fsBtn.style.display !== 'none') fsBtn.click(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); }
      else Input.press(act === 'jump' ? (Game.scene() === 'play' ? 'jump' : 'confirm') : act);
      b.blur();      // 點完放掉焦點，不然之後按空白／Enter 會又「按」到這顆
    });
  });

  window.addEventListener('keydown', function (e) {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyO') { e.preventDefault(); setMenu(!pad.classList.contains('menu')); }
    else if (e.code === 'KeyU') { e.preventDefault(); setMenu(false); npOpen(); }
    else if (e.code === 'Escape' && pad.classList.contains('menu')) setMenu(false);
  });
  document.getElementById('np-close').addEventListener('click', npClose);
  document.getElementById('np-host').addEventListener('click', function () {
    if (npBusy()) return;
    roomCode = null;
    Net.host();
    npRender();
  });
  function doJoin() {
    if (npBusy()) return;
    Net.join(np.code.value);
    npRender();
  }
  document.getElementById('np-join').addEventListener('click', doJoin);
  np.code.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doJoin(); } });
  document.getElementById('np-copy').addEventListener('click', function () {
    if (roomCode) copyText(roomCode, '已複製邀請碼 ' + roomCode + '，貼到 LINE 給朋友吧');
  });
  document.getElementById('np-copylink').addEventListener('click', function () {
    if (!roomCode) return;
    const url = location.origin + location.pathname + '?join=' + roomCode;
    copyText(url, '已複製邀請連結：朋友點開後按「加入」就好');
  });
  np.leave.addEventListener('click', function () {
    Net.leave();
    roomCode = null;
    npStatus('已離開連線');
    npRender();
  });

  Net.on('code', function (c) { roomCode = c; npRender(); });
  Net.on('status', function (m) { npStatus(m); });
  Net.on('error', function (m) { npStatus(m, true); npRender(); });
  Net.on('open', function () {
    npRender();
    // 連上了就把面板收起來，讓兩人直接看遊戲畫面
    setTimeout(npClose, 900);
  });
  Net.on('close', function () {
    if (Net.role() === 'host') npStatus('朋友離開了，同一個邀請碼可以讓他重新加入');
    else {
      roomCode = null;
      // 被房主拒絕（版本不同、房間滿了）要講原因，不然玩家不知道為什麼連不上
      const why = Game.netInfo().byeReason;
      npStatus(why || '連線已結束', !!why);
      if (why) np.panel.hidden = false;
    }
    npRender();
  });

  // 從邀請連結點進來（?join=代碼）：直接打開面板、填好代碼，按「加入」就行
  // （不自動連線：瀏覽器要玩家先點一下才能放聲音，而且讓朋友知道自己正在加入誰）
  const joinParam = new URLSearchParams(location.search).get('join');
  if (joinParam) {
    np.code.value = Net.normalize(joinParam);
    npOpen();
    npStatus('按「加入」就能和房主連線');
  }

  function syncNetBtn() {
    np.netBtn.classList.toggle('live', Net.connected());
    const label = (Net.connected() ? '連線中' : '連線') + '<small>U</small>';
    if (np.netBtn.innerHTML !== label) np.netBtn.innerHTML = label;
  }

  function syncUi() { syncLocks(); syncScene(); syncMenuIcon(); syncNetBtn(); syncMainKey(); }
  syncUi();
  setInterval(syncUi, 200);
})();
