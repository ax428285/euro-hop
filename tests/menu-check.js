/**
 * ☰ 選單檢查（v1.15）。在瀏覽器執行 `await runMenuCheck()`（電腦版畫面）。
 *
 * 玩家回饋：電腦版找不到刪除存檔、也沒有提示 → 刪除存檔搬進 ☰ 選單，電腦用滑鼠點、手機用手指點。
 * 另外關卡中按「回大地圖」要先跳確認框，按確定才回去。
 *
 * runWipeMenuCheck(wait) 是電腦／手機共用的那段（touch-check.js 也會呼叫，要先載入這支）。
 * ⚠️ 會動到存檔，呼叫端負責備份還原（runMenuCheck 自己有做）。
 */
async function runWipeMenuCheck(wait) {
  const issues = [];
  const passed = [];
  function check(ok, label) { (ok ? passed : issues).push(label); }

  const pad = document.getElementById('pad');
  const menuBtn = document.getElementById('btn-menu');
  const wipe = document.getElementById('btn-wipe');
  const shown = function (el) { return el.offsetParent !== null && el.getBoundingClientRect().width > 0; };

  // 關卡中（v1.27.1）：☰ 變成 ↩；按一次跳「放棄這一關？」、再按一次回地圖；選單打不開（所以也碰不到刪除存檔）
  Game.debug.enter(0);
  await wait(1200);
  check(menuBtn.textContent === '↩', '關卡中：左上角變成 ↩');
  menuBtn.click();
  Game.debug.step(1);
  check(Game.debug.getScene() === 'quitconfirm' && !pad.classList.contains('menu') && !shown(wipe),
        '關卡中按 ↩：先跳「放棄這一關？」確認框（選單不會打開）');
  menuBtn.click();
  Game.debug.step(1);
  check(Game.debug.getScene() === 'map', '確認框再按一次 ↩：回大地圖');
  // 過關畫面：沒有進度可以丟，按 ↩ 直接回地圖
  Game.debug.enter(0);
  Game.debug.getState().player.invuln = 1e9;
  Game.debug.warpToGoal();
  for (let k = 0; k < 300 && Game.debug.getScene() !== 'clear'; k++) Game.debug.step(1);
  await wait(1200);
  check(menuBtn.textContent === '↩', '過關畫面：左上角是 ↩');
  menuBtn.click();
  Game.debug.step(1);
  check(Game.debug.getScene() === 'map', '過關畫面按 ↩：直接回大地圖');

  // 地圖上：按一次只變紅、選單不收起來；3 秒沒按第二次就取消；連按兩次才刪
  Game.debug.setScene('map');
  await wait(1200);
  menuBtn.click();
  check(shown(wipe), '地圖上打開選單：看得到「刪除存檔」');
  Game.debug.grantAll();
  wipe.click();
  check(wipe.classList.contains('armed') && wipe.textContent.indexOf('再按一次') >= 0,
        '刪除存檔按第一次：變成「再按一次確認刪除」');
  check(pad.classList.contains('menu'), '刪除存檔按第一次：選單保持開著（才按得到第二次）');
  check(Save.get().equipment.length === Equipment.count, '刪除存檔按第一次：還沒刪');
  await wait(3600);
  check(!wipe.classList.contains('armed'), '按一次後 3 秒沒再按：自動取消');
  wipe.click();
  wipe.click();
  check(Save.get().equipment.length === 0 && Save.get().exp === 0, '連按兩次：真的刪掉');
  check(!Game.abilities().throw, '刪掉後能力重算（武器重新上鎖）');
  check(Game.debug.getScene() === 'map' && Game.debug.getCursor() === 0, '在地圖刪除：留在地圖、回到第一國');
  check(!pad.classList.contains('menu'), '刪完選單自動收起');

  // 標題畫面也能刪
  Game.debug.grantAll();
  Game.debug.setScene('title');
  await wait(1200);
  menuBtn.click();
  wipe.click();
  wipe.click();
  check(Save.get().equipment.length === 0 && Game.debug.getScene() === 'title', '標題畫面從選單刪除：刪掉、留在標題');

  // 遊戲 API 本身也要擋：關卡中不能刪
  Game.debug.grantAll();
  Game.debug.enter(0);
  check(Game.wipeSave() === false && Save.get().equipment.length === Equipment.count, '關卡進行中呼叫刪除：被擋下');
  Game.debug.setScene('title');

  return { passed: passed, issues: issues };
}

/** 電腦版（非觸控）畫面的選單與確認框檢查 */
async function runMenuCheck() {
  const issues = [];
  const passed = [];
  function check(ok, label) { (ok ? passed : issues).push(label); }
  const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  if (document.documentElement.classList.contains('touch')) {
    return { error: '這支要在電腦版（非觸控）畫面跑；手機請用 runTouchCheck()' };
  }
  const SAVE_KEY = 'eurohop.save.v2';
  const backup = localStorage.getItem(SAVE_KEY);
  try {
    const menuBtn = document.getElementById('btn-menu');
    const canvas = document.getElementById('game');
    const shown = function (el) { return el.offsetParent !== null && el.getBoundingClientRect().width > 0; };

    // 版面：電腦版只有 ☰，沒有搖桿和動作鍵；☰ 在遊戲畫面上
    check(shown(menuBtn), '電腦版看得到 ☰ 選單鈕');
    check(!shown(document.getElementById('dpad')) && !shown(document.querySelector('#pad .pad-actions')),
          '電腦版不顯示搖桿與動作鍵');
    const c = canvas.getBoundingClientRect(), m = menuBtn.getBoundingClientRect();
    check(m.left >= c.left && m.right <= c.right && m.top >= c.top && m.bottom <= c.bottom, '☰ 疊在遊戲畫面裡');
    check(document.getElementById('hint').textContent.indexOf('刪除存檔') >= 0, '畫面下方的操作說明有寫「刪除存檔」在選單裡');
    // 遊戲畫面中央點得到（地圖點國家）
    check(document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2) === canvas, '畫面中央沒被選單擋住');

    // 刪除存檔（跟手機共用的流程）
    const r = await runWipeMenuCheck(wait);
    r.passed.forEach(function (s) { passed.push(s); });
    r.issues.forEach(function (s) { issues.push(s); });

    // 關卡中按 Q：先跳確認框
    const key = function (code) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: code }));
      Game.debug.step(1);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: code }));
      Game.debug.step(1);
    };
    Game.debug.enter(0);
    key('KeyQ');
    check(Game.debug.getScene() === 'quitconfirm', '關卡中按 Q：先跳「放棄這一關？」');
    key('Escape');
    check(Game.debug.getScene() === 'play', '確認框按 Esc：回到關卡');
    key('KeyQ'); key('Space');
    check(Game.debug.getScene() === 'play', '確認框按 空白：回到關卡');
    key('KeyQ'); key('KeyP');
    check(Game.debug.getScene() === 'play', '確認框按 P：回到關卡');
    key('KeyQ'); key('KeyQ');
    // v1.17.5 起「再按一次回地圖」也算確定（手機的跳／確定合成一顆，在確認框裡它是「繼續」，
    // 要離開就再按一次地圖）；v1.27.1 左上角的 ↩ 也是靠這個。這裡原本測「再按 Q 不會離開」，已過時
    check(Game.debug.getScene() === 'map', '確認框再按 Q：回大地圖');
    Game.debug.enter(0);
    key('KeyQ'); key('Enter');
    check(Game.debug.getScene() === 'map', '確認框按 Enter：回大地圖');
    let drew = true;
    try { Game.debug.enter(0); key('KeyQ'); Game.debug.render(); } catch (e) { drew = e.message; }
    check(drew === true, '確認框畫得出來' + (drew === true ? '' : '（' + drew + '）'));
    // 已經結束的畫面（過關／陣亡）按 Q 不用確認，沒有進度可以丟
    Game.debug.setScene('dead');
    key('KeyQ');
    check(Game.debug.getScene() === 'map', '陣亡畫面按 Q：直接回地圖（不用確認）');
  } finally {
    if (backup === null) localStorage.removeItem(SAVE_KEY); else localStorage.setItem(SAVE_KEY, backup);
    Save.load();
    Game.debug.setScene('title');
  }
  return { passed: passed.length, failed: issues.length, issues: issues };
}
