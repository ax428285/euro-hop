/**
 * 連線遊玩的雙分頁測試工具（v1.17）。
 *
 * 連線要兩個瀏覽器，所以不能像其他測試一支函式跑完；改成在兩個分頁各自載入這支，照順序呼叫：
 *
 *   分頁 A（房主，例如 http://localhost:8765/dist/index.html）
 *     await netTestHost()                 → 建房，回傳邀請碼
 *   分頁 B（朋友，要不同網域才不會共用存檔，例如 http://127.0.0.1:8765/dist/index.html）
 *     await netTestJoin(code)             → 加入
 *   分頁 A
 *     netTestMeasure(關卡 index, 帧數)      → 跑一段、量每秒傳輸量，回傳房主的狀態指紋
 *   分頁 B（等 1 秒讓訊息到齊）
 *     netTestFp()                         → 朋友的狀態指紋，要跟房主一模一樣
 *
 * 兩個分頁在背景時瀏覽器會暫停 requestAnimationFrame，所以一律用 Game.debug.step 手動推進。
 */

/** 狀態指紋：把關卡狀態（不含兩邊本來就各自有的 def、player 別名）做成一個雜湊值 */
function netTestFp() {
  const st = Game.debug.getState();
  if (!st) return null;
  const perKey = {};
  let all = 0;
  Object.keys(st).sort().forEach(function (k) {
    if (k === 'def' || k === 'player') return;
    const s = JSON.stringify(st[k], function (kk, v) {
      return typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 10) / 10 : v;
    }) || '';
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    perKey[k] = h;
    all = (all * 31 + h) | 0;
  });
  return { all: all, perKey: perKey, scene: Game.debug.getScene() };
}

function netTestWait(pred, ms) {
  return new Promise(function (resolve) {
    const t0 = Date.now();
    (function poll() { if (pred() || Date.now() - t0 > ms) resolve(); else setTimeout(poll, 150); })();
  });
}

async function netTestHost() {
  const r = { code: null, errs: [] };
  Net.on('code', function (c) { r.code = c; });
  Net.on('error', function (e) { r.errs.push(e); });
  Net.host();
  await netTestWait(function () { return r.code || r.errs.length; }, 20000);
  return r;
}

async function netTestJoin(code) {
  const r = { opened: false, errs: [] };
  Net.on('open', function () { r.opened = true; });
  Net.on('error', function (e) { r.errs.push(e); });
  Net.join(code);
  await netTestWait(function () { return r.opened || r.errs.length; }, 25000);
  await netTestWait(function () { return Game.debug.getScene() === 'netwait'; }, 5000);
  return { opened: r.opened, errs: r.errs, side: Game.netInfo().side, scene: Game.debug.getScene() };
}

/**
 * 房主：進某一關，兩位玩家一直往右走、每隔一段跳一下，量傳輸量。
 * 最後立刻把狀態送出去（netFlush），朋友那邊收到後的指紋應該跟房主一樣。
 */
function netTestMeasure(li, frames) {
  Game.debug.unlockAll();
  Game.debug.setScene('map');
  Game.debug.enter(li);
  Game.debug.step(3);
  Game.debug.getState().players.forEach(function (p) { p.invuln = 1e9; });
  const key = function (code, down) { window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: code })); };
  Input.remote('right', 1);
  key('ArrowRight', true);
  const orig = Net.send;
  let bytes = 0, msgs = 0, maxMsg = 0;
  Net.send = function (m) {
    if (m.t === 's') { const n = JSON.stringify(m).length; bytes += n; msgs++; maxMsg = Math.max(maxMsg, n); }
    return orig.apply(Net, arguments);
  };
  for (let i = 0; i < frames; i++) {
    Game.debug.step(1);
    if (i % 40 === 20) { key('Space', true); Input.remote('jump', 1); }
    if (i % 40 === 32) { key('Space', false); Input.remote('jump', 0); }
  }
  Net.send = orig;
  key('ArrowRight', false); key('Space', false);
  Input.remote('right', 0); Input.remote('jump', 0);
  Game.debug.netFlush();
  const def = Game.debug.getState().def;
  return {
    level: def.country,
    kind: def.layout === 'shaft' ? '豎井' : (def.bossArena ? '魔王' : '橫向'),
    scene: Game.debug.getScene(),
    kbPerSec: Math.round(bytes / (frames / 60) / 1024 * 10) / 10,
    avgMsg: Math.round(bytes / Math.max(1, msgs)),
    maxMsg: maxMsg,
    fp: netTestFp()
  };
}
