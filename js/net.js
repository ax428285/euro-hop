'use strict';

/**
 * 連線傳輸層（v1.17）：用邀請碼把兩個瀏覽器直接連起來（WebRTC）。
 *
 * ── 為什麼這樣做 ──────────────────────────────────────────
 * 遊戲放在 Netlify（純靜態網頁，不能跑伺服器），所以不能自己架連線伺服器。
 * 改用 PeerJS 的免費公共伺服器做「媒合」：它只負責讓兩邊找到對方，
 * 連上之後資料是兩個瀏覽器直接傳（P2P），不經過任何伺服器。
 *
 * 限制（要讓玩家知道）：
 *   - 公共伺服器是別人的免費服務，偶爾會掛
 *   - 少數網路環境（部分行動網路、公司網路）P2P 打不通，會連不上
 *
 * PeerJS 函式庫只在玩家打開「連線」時才從 CDN 載入 —— 單人遊玩完全不受影響，
 * CDN 掛了也只是連線功能不能用。
 *
 * 這一層只管「連上、收發訊息、斷線」，不懂遊戲邏輯；遊戲同步在 game.js 的「連線遊玩」段落。
 *
 * ── 對外 API ─────────────────────────────────────────
 *   Net.host()            建房間 → 'code' 事件給邀請碼
 *   Net.join(code)        用邀請碼加入
 *   Net.leave()           離開
 *   Net.send(msg)         傳訊息（物件，JSON）
 *   Net.on(evt, fn)       事件：'code' 'open' 'data' 'close' 'error' 'status'
 *   Net.role()            'host' | 'guest' | null
 *   Net.connected()       資料通道是否已打開
 *   Net.normalize(code)   把玩家輸入的邀請碼整理成標準格式（大寫、去空白）
 */
const Net = (function () {
  const LIB_URL = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  // 公共伺服器上所有 PeerJS 用戶共用 id 空間，加前綴避免撞到別的網站
  const PREFIX = 'eurohop-europa-';
  // 去掉 0/O、1/I/L 這種容易看錯的字，口頭唸或手打都不會搞混
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const CODE_LEN = 6;
  const JOIN_TIMEOUT = 15000;

  let peer = null;
  let conn = null;
  let role = null;
  let joinTimer = null;
  const handlers = {};

  function on(evt, fn) { (handlers[evt] || (handlers[evt] = [])).push(fn); }
  function emit(evt, arg) { (handlers[evt] || []).forEach(function (fn) { try { fn(arg); } catch (e) { console.error(e); } }); }

  let libPromise = null;
  function loadLib() {
    if (window.Peer) return Promise.resolve();
    if (libPromise) return libPromise;
    libPromise = new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = LIB_URL;
      s.async = true;
      s.onload = function () { window.Peer ? resolve() : reject(new Error('lib')); };
      s.onerror = function () { libPromise = null; reject(new Error('lib')); };
      document.head.appendChild(s);
    });
    return libPromise;
  }

  function makeCode() {
    const a = new Uint32Array(CODE_LEN);
    (window.crypto || window.msCrypto).getRandomValues(a);
    let c = '';
    for (let i = 0; i < CODE_LEN; i++) c += ALPHABET[a[i] % ALPHABET.length];
    return c;
  }

  /** 玩家手打的邀請碼：轉大寫、去掉空白與符號（小寫、中間多打空格都能用） */
  function normalize(code) {
    return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  /** 回傳錯誤訊息；沒問題回 null */
  function problem(code) {
    if (code.length !== CODE_LEN) return '邀請碼是 ' + CODE_LEN + ' 個英文字母或數字';
    for (const ch of code) {
      if (ALPHABET.indexOf(ch) < 0) return '邀請碼裡不會有 0、O、1、I、L，請再對一次';
    }
    return null;
  }
  function valid(code) { return problem(normalize(code)) === null; }

  /** PeerJS 的錯誤 → 給玩家看的中文 */
  function explain(err) {
    const type = err && err.type;
    if (type === 'peer-unavailable') return '找不到這個邀請碼：確認有沒有打錯，或請房主重新建立房間';
    if (type === 'network' || type === 'server-error' || type === 'socket-error' || type === 'socket-closed') {
      return '連不上媒合伺服器，請檢查網路後再試一次';
    }
    if (type === 'browser-incompatible') return '這個瀏覽器不支援連線，請換 Chrome 或 Safari';
    if (err && err.message === 'lib') return '無法載入連線元件，請檢查網路後再試一次';
    if (err && err.message === 'timeout') return '連線逾時：雙方的網路可能不支援直接連線（例如某些行動網路或公司網路），換個網路再試試';
    return '連線發生錯誤' + (type ? '（' + type + '）' : '');
  }

  function clearJoinTimer() { if (joinTimer) { clearTimeout(joinTimer); joinTimer = null; } }

  function attach(c) {
    conn = c;
    c.on('open', function () {
      clearJoinTimer();
      emit('status', role === 'host' ? '朋友連上了！' : '已連上房主');
      emit('open');
    });
    c.on('data', function (d) { emit('data', d); });
    c.on('close', function () {
      if (conn !== c) return;
      conn = null;
      emit('close');
      // 房主留著房間，同一個邀請碼可以讓朋友重新加入；朋友這邊就整個結束
      if (role === 'guest') teardown();
    });
    c.on('error', function (e) { emit('error', explain(e)); });
  }

  function teardown() {
    clearJoinTimer();
    if (conn) { try { conn.close(); } catch (e) { /* 已經斷了 */ } }
    if (peer) { try { peer.destroy(); } catch (e) { /* 已經關了 */ } }
    conn = null;
    peer = null;
    role = null;
  }

  function host() {
    teardown();
    role = 'host';
    emit('status', '建立房間中⋯⋯');
    return loadLib().then(function () {
      let tries = 0;
      (function open() {
        const code = makeCode();
        peer = new window.Peer(PREFIX + code, { debug: 0 });
        peer.on('open', function () { emit('code', code); emit('status', '等朋友輸入邀請碼⋯⋯'); });
        peer.on('connection', function (c) {
          // 一間房只收一位朋友；房間滿了就直接拒絕
          if (conn && conn.open) {
            c.on('open', function () { c.send({ t: 'bye', why: 'full' }); setTimeout(function () { c.close(); }, 300); });
            return;
          }
          attach(c);
        });
        peer.on('error', function (e) {
          // 邀請碼剛好撞到別人：換一個再試
          if (e.type === 'unavailable-id' && tries++ < 3) { peer.destroy(); open(); return; }
          emit('error', explain(e));
        });
        peer.on('disconnected', function () {
          // 跟媒合伺服器斷了（已經連上的朋友不受影響），試著重連，讓新朋友還能用同一個碼加入
          if (peer && !peer.destroyed) { try { peer.reconnect(); } catch (e) { /* 下次再說 */ } }
        });
      })();
    }).catch(function (e) { role = null; emit('error', explain(e)); });
  }

  function join(raw) {
    const code = normalize(raw);
    const bad = problem(code);
    if (bad) { emit('error', bad); return Promise.resolve(); }
    teardown();
    role = 'guest';
    emit('status', '連線中⋯⋯');
    return loadLib().then(function () {
      peer = new window.Peer({ debug: 0 });
      peer.on('open', function () {
        attach(peer.connect(PREFIX + code, { reliable: true, serialization: 'json' }));
        joinTimer = setTimeout(function () {
          if (conn && conn.open) return;
          emit('error', explain(new Error('timeout')));
          teardown();
        }, JOIN_TIMEOUT);
      });
      peer.on('error', function (e) { emit('error', explain(e)); teardown(); });
    }).catch(function (e) { role = null; emit('error', explain(e)); });
  }

  function leave() {
    const was = role;
    if (conn && conn.open) { try { conn.send({ t: 'bye', why: 'leave' }); } catch (e) { /* 斷了就算了 */ } }
    teardown();
    if (was) emit('close');
  }

  function send(msg) {
    if (!conn || !conn.open) return false;
    try { conn.send(msg); return true; } catch (e) { return false; }
  }

  return {
    host: host,
    join: join,
    leave: leave,
    send: send,
    on: on,
    role: function () { return role; },
    connected: function () { return !!(conn && conn.open); },
    normalize: normalize,
    valid: valid,
    CODE_LEN: CODE_LEN,
    /** 測試用：不經過網路，直接塞一則「收到的訊息」 */
    _inject: function (d) { emit('data', d); }
  };
})();
