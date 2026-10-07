/**
 * 手機觸控測試（只能在瀏覽器跑，而且要用觸控裝置或手機模擬）：runTouchCheck()
 *
 * 直拿（html.rot，畫面轉 90°）與橫拿各跑一次。檢查兩類問題：
 *   版面：遊戲畫面夠大、按鈕都在螢幕內、沒擋住頂端資訊列與畫面中央、按鈕互不重疊
 *   操作：每顆按鈕真的會觸發對應動作；搖桿方向在轉 90° 後仍然正確；點畫布的座標換算正確
 *
 * 用模擬的 pointer 事件按按鈕，再用 Game.debug.step 手動推進帧 —— 全部同步執行，
 * 不會被 requestAnimationFrame 的迴圈插隊，結果可重現（分頁在背景、rAF 停住也能跑）。
 * 只有「武器鍵上鎖」要等計時器同步，所以整支是 async。
 *
 * 用法：載入後 `await runTouchCheck()`
 */
async function runTouchCheck() {
  const issues = [];
  const passed = [];
  function check(ok, label) { (ok ? passed : issues).push(label); }

  const html = document.documentElement;
  const rot = html.classList.contains('rot');
  if (!html.classList.contains('touch')) {
    return { error: '不是觸控模式（請用手機模擬或真機）', mode: html.className };
  }

  const canvas = document.getElementById('game');
  const vw = window.innerWidth, vh = window.innerHeight;
  const GW = 960, GH = 480;

  /** 遊戲座標 → 螢幕座標（轉 90° 時，遊戲 x 軸朝螢幕下方、y 軸朝螢幕左方） */
  function toScreen(gx, gy) {
    const r = canvas.getBoundingClientRect();
    return rot
      ? { x: r.right - gy / GH * r.width, y: r.top + gx / GW * r.height }
      : { x: r.left + gx / GW * r.width, y: r.top + gy / GH * r.height };
  }
  /** 遊戲方向 → 螢幕方向 */
  function dirToScreen(dx, dy) { return rot ? { x: -dy, y: dx } : { x: dx, y: dy }; }

  let pid = 100;
  function fire(el, type, x, y, id) {
    el.dispatchEvent(new PointerEvent(type, {
      pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch'
    }));
  }
  /** 按一下按鈕，推進一帧讓遊戲讀到 */
  function tap(key) {
    const b = document.querySelector('#pad [data-key="' + key + '"]');
    const id = ++pid;
    fire(b, 'pointerdown', 0, 0, id);
    Game.debug.step(1);
    fire(b, 'pointerup', 0, 0, id);
    b.click();   // 選單是靠 click 收起來的
  }
  function player() {
    const st = Game.debug.getState();
    return st.players ? st.players[0] : st.player;
  }

  // ── 版面 ────────────────────────────────────────────

  const cr = canvas.getBoundingClientRect();
  const cover = (cr.width * cr.height) / (vw * vh);
  check(cover > 0.85, '遊戲畫面佔螢幕 ' + Math.round(cover * 100) + '%（要 > 85%）');
  // 轉向正確：橫拿時畫布寬 > 高；直拿轉 90° 後畫布在螢幕上應該是高 > 寬
  check(rot ? cr.height > cr.width : cr.width > cr.height, '畫面方向是橫的（以玩家拿手機的方向看）');

  const visible = Array.prototype.filter.call(
    document.querySelectorAll('#pad .btn, #pad .sbtn, #pad .dpad'),
    function (el) { return el.offsetParent !== null; });
  visible.forEach(function (el) {
    const r = el.getBoundingClientRect();
    const name = el.getAttribute('aria-label') || el.id;
    check(r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1, '按鈕在螢幕內：' + name);
    // 轉 90° 時寬高對調，所以看短邊／長邊
    check(Math.min(r.width, r.height) >= 32 && Math.max(r.width, r.height) >= 36,'按鈕夠大好按：' + name + '（' + Math.round(r.width) + '×' + Math.round(r.height) + '）');
  });
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i].getBoundingClientRect(), b = visible[j].getBoundingClientRect();
      const overlap = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
      if (overlap) issues.push('按鈕重疊：' + (visible[i].getAttribute('aria-label') || visible[i].id) +
                               ' 與 ' + (visible[j].getAttribute('aria-label') || visible[j].id));
    }
  }

  // 頂端資訊列（關卡名、金幣、分數、愛心）不能被擋住
  Game.debug.enter(0);
  Game.debug.step(60);
  let hudBlocked = [];
  for (let gx = 20; gx <= GW - 20; gx += 40) {
    const p = toScreen(gx, 18);
    const hit = document.elementFromPoint(p.x, p.y);
    if (hit !== canvas) hudBlocked.push(gx);
  }
  check(hudBlocked.length === 0, '頂端資訊列沒被按鈕擋住' + (hudBlocked.length ? '（被擋 x=' + hudBlocked.join(',') + '）' : ''));

  // 畫面中央（玩家活動區）點得到畫布
  let midBlocked = 0;
  for (let gx = 300; gx <= 660; gx += 60) {
    for (let gy = 120; gy <= 360; gy += 60) {
      const p = toScreen(gx, gy);
      if (document.elementFromPoint(p.x, p.y) !== canvas) midBlocked++;
    }
  }
  check(midBlocked === 0, '畫面中央沒被按鈕擋住');

  // ── 操作 ────────────────────────────────────────────

  // 點畫布的座標換算
  Input.takeClick();
  const target = { x: 200, y: 300 };
  const sp = toScreen(target.x, target.y);
  fire(canvas, 'pointerdown', sp.x, sp.y, ++pid);
  fire(canvas, 'pointerup', sp.x, sp.y, pid);
  const got = Input.takeClick();
  check(got && Math.abs(got.x - target.x) < 3 && Math.abs(got.y - target.y) < 3,
        '點畫布座標換算正確（點 ' + target.x + ',' + target.y + ' → 得到 ' +
        (got ? Math.round(got.x) + ',' + Math.round(got.y) : '無') + '）');

  // 搖桿：往遊戲裡的各方向推，要得到對應的方向
  const dpad = document.getElementById('dpad');
  [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]].forEach(function (d) {
    const r = dpad.getBoundingClientRect();
    const s = dirToScreen(d[1], d[2]);
    const id = ++pid;
    fire(dpad, 'pointerdown', r.left + r.width / 2 + s.x * r.width * 0.35,
                              r.top + r.height / 2 + s.y * r.height * 0.35, id);
    const held = ['left', 'right', 'up', 'down'].filter(function (k) { return Input.isDown(k); });
    fire(dpad, 'pointerup', 0, 0, id);
    check(held.length === 1 && held[0] === d[0], '搖桿往' + d[0] + ' → ' + (held.join('+') || '沒反應'));
  });
  check(!['left', 'right', 'up', 'down'].some(function (k) { return Input.isDown(k); }), '放開搖桿後方向歸零');

  // 關卡裡：按住搖桿右，玩家要往右走
  {
    const r = dpad.getBoundingClientRect();
    const s = dirToScreen(1, 0);
    const x0 = player().x;
    const id = ++pid;
    fire(dpad, 'pointerdown', r.left + r.width / 2 + s.x * r.width * 0.35,
                              r.top + r.height / 2 + s.y * r.height * 0.35, id);
    Game.debug.step(40);
    fire(dpad, 'pointerup', 0, 0, id);
    check(player().x > x0 + 40, '按住搖桿右，玩家往右走（' + Math.round(x0) + ' → ' + Math.round(player().x) + '）');
  }

  // 跳躍鍵
  {
    Game.debug.step(60);
    const y0 = player().y;
    const b = document.querySelector('#pad [data-key="jump"]');
    const id = ++pid;
    fire(b, 'pointerdown', 0, 0, id);
    let minY = y0;
    for (let k = 0; k < 20; k++) { Game.debug.step(1); minY = Math.min(minY, player().y); }
    fire(b, 'pointerup', 0, 0, id);
    check(minY < y0 - 20, '跳躍鍵讓玩家跳起來（最高離地 ' + Math.round(y0 - minY) + 'px）');
  }

  // 暫停鍵：暫停、再按一次繼續
  tap('pause');
  check(Game.debug.getScene() === 'paused', '暫停鍵 → 暫停');
  tap('pause');
  check(Game.debug.getScene() === 'play', '再按暫停鍵 → 繼續');

  // 回地圖、確定鍵、商店、裝備
  // 關卡中回大地圖：要先跳確認框，按「確定」才回去；跳／暫停 是取消
  tap('tomap');
  check(Game.debug.getScene() === 'quitconfirm', '關卡中按地圖鍵 → 先跳「放棄這一關？」確認框');
  tap('jump');
  check(Game.debug.getScene() === 'play', '確認框按 跳 → 取消、回到關卡');
  tap('tomap');
  tap('pause');
  check(Game.debug.getScene() === 'play', '確認框按 暫停 → 取消、回到關卡');
  tap('pause');
  tap('tomap');
  check(Game.debug.getScene() === 'quitconfirm', '暫停中按地圖鍵 → 也要確認');
  tap('confirm');
  check(Game.debug.getScene() === 'map', '確認框按 確定 → 回大地圖');
  Game.debug.setScene('title');
  tap('confirm');
  check(Game.debug.getScene() === 'map', '確定鍵 → 從標題進地圖');
  tap('shop');
  check(Game.debug.getScene() === 'shop', '商店鍵 → 開商店');
  tap('shop');
  check(Game.debug.getScene() === 'map', '再按商店鍵 → 回地圖');
  tap('inventory');
  check(Game.debug.getScene() === 'inventory', '裝備鍵 → 開裝備');
  tap('inventory');

  // ☰ 選單：按了展開、點畫面收起
  const pad = document.getElementById('pad');
  const menuBtn = document.getElementById('btn-menu');
  menuBtn.click();
  const opened = pad.classList.contains('menu') &&
    document.getElementById('pad-menu').getBoundingClientRect().width > 0;
  fire(canvas, 'pointerdown', sp.x, sp.y, ++pid);
  fire(canvas, 'pointerup', sp.x, sp.y, pid);
  check(opened && !pad.classList.contains('menu'), '☰ 選單按了會展開、點畫面會收起');
  Input.takeClick();

  Game.debug.setScene('title');

  // ── 武器鍵上鎖 ─────────────────────────────────────
  // 會動到存檔，先備份、測完還原（這台瀏覽器的進度不能被測試洗掉）
  const SAVE_KEY = 'eurohop.save.v2';
  const backup = localStorage.getItem(SAVE_KEY);
  const atk = document.querySelector('#pad [data-key="attack"]');
  const thr = document.querySelector('#pad [data-key="throw"]');
  function lockedNow() { return [atk.classList.contains('locked'), thr.classList.contains('locked')]; }
  try {
    Game.debug.resetSave();
    await new Promise(function (r) { setTimeout(r, 1200); });   // 鎖頭每 200ms 同步一次（背景分頁會被放慢）
    const fresh = lockedNow();
    check(fresh[0] && fresh[1], '新存檔：揮、丟都顯示鎖頭');
    check(getComputedStyle(atk, '::after').backgroundImage.indexOf('svg') >= 0, '鎖頭圖案有畫出來');

    Game.debug.grantAll();
    await new Promise(function (r) { setTimeout(r, 1200); });
    const owned = lockedNow();
    check(!owned[0] && !owned[1], '拿到裝備後：鎖頭消失');

    // 密技：裝備畫面用搖桿輸入 ↑↑↓↓←→←→
    Game.debug.resetSave();
    Game.debug.setScene('inventory');
    const costumeBefore = Save.get().costume;
    const DIR = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
    function push(code) {
      code.split('').forEach(function (c) {
        const r = dpad.getBoundingClientRect();
        const s = dirToScreen(DIR[c][0], DIR[c][1]);
        const id = ++pid;
        fire(dpad, 'pointerdown', r.left + r.width / 2 + s.x * r.width * 0.35,
                                  r.top + r.height / 2 + s.y * r.height * 0.35, id);
        Game.debug.step(1);
        fire(dpad, 'pointerup', 0, 0, id);
        Game.debug.step(1);
      });
    }
    push('UUDDLRL');
    check(Save.get().equipment.length === 0, '密技還沒輸入完：不會提早發動');
    push('R');
    check(Save.get().equipment.length === Equipment.count,
          '密技 ↑↑↓↓←→←→：裝備全開（' + Save.get().equipment.length + '/' + Equipment.count + '）');
    check(Game.abilities().attack && Game.abilities().throw, '密技後揮、丟都能用');
    check(Save.get().costume === costumeBefore, '密技輸入完時裝沒被換掉');
    check(Game.debug.getScene() === 'inventory', '密技後還停在裝備畫面');

    // ☰ 在子畫面（商店／裝備／存檔）= ↩ 回大地圖；在地圖上還是打開選單
    for (const sc of ['shop', 'inventory', 'saveinfo']) {
      Game.debug.setScene(sc);
      await new Promise(function (r) { setTimeout(r, 1200); });
      check(menuBtn.textContent === '↩', sc + ' 畫面：☰ 變成 ↩');
      menuBtn.click();
      Game.debug.step(1);
      check(Game.debug.getScene() === 'map', sc + ' 畫面：按 ↩ 回大地圖（' + Game.debug.getScene() + '）');
    }
    await new Promise(function (r) { setTimeout(r, 1200); });
    check(menuBtn.textContent === '☰', '回到地圖：↩ 變回 ☰');
    menuBtn.click();
    check(pad.classList.contains('menu') && Game.debug.getScene() === 'map', '地圖上按 ☰：打開選單（不會跳走）');
    menuBtn.click();

    // 刪除存檔（在 ☰ 選單裡，要按兩次）
    const wipe = document.getElementById('btn-wipe');
    const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    const r1 = await runWipeMenuCheck(wait);
    r1.passed.forEach(function (s) { passed.push(s); });
    r1.issues.forEach(function (s) { issues.push(s); });
    // 手機才有的：選單裡的刪除鍵在螢幕內、夠大
    Game.debug.setScene('map');
    await wait(1200);
    menuBtn.click();
    const wr = wipe.getBoundingClientRect();
    check(wr.right <= vw + 1 && wr.bottom <= vh + 1 && wr.left >= -1 && wr.top >= -1, '選單裡的刪除存檔鍵在螢幕內');
    check(Math.min(wr.width, wr.height) >= 30, '選單裡的刪除存檔鍵夠大好按');
    menuBtn.click();
  } finally {
    if (backup === null) localStorage.removeItem(SAVE_KEY); else localStorage.setItem(SAVE_KEY, backup);
    Save.load();
  }

  return {
    mode: rot ? '直拿（畫面轉 90°）' : '橫拿',
    viewport: vw + '×' + vh,
    passed: passed.length,
    failed: issues.length,
    issues: issues
  };
}
