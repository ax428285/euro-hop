'use strict';

/**
 * 極簡 WebAudio 音效，不需要任何音檔。
 * 瀏覽器要求使用者互動後才能播放，所以 init() 要在第一次按鍵/點擊時呼叫。
 */
const Sfx = (function () {
  let ctx = null;
  let muted = false;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    // 背景音樂跟音效共用同一個 AudioContext
    // （瀏覽器對數量有限制，而且共用才能一起被 resume）
    if (ctx && typeof Music !== 'undefined') Music.attach(ctx);
  }

  function tone(freq, dur, type, gain) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain == null ? 0.12 : gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function seq(notes) {
    if (!ctx || muted) return;
    let delay = 0;
    notes.forEach(function (n) {
      setTimeout(function () { tone(n[0], n[1], n[2] || 'square', n[3]); }, delay * 1000);
      delay += n[1] * 0.8;
    });
  }

  return {
    init: init,
    toggleMute: function () {
      muted = !muted;
      // 靜音要連背景音樂一起（不然只有音效靜掉，很怪）
      if (typeof Music !== 'undefined') Music.setMuted(muted);
      return muted;
    },
    isMuted: function () { return muted; },
    jump:    function () { tone(520, 0.12, 'square', 0.10); },
    doubleJump: function () { seq([[660, 0.07], [880, 0.1]]); },
    swing:   function () { tone(420, 0.07, 'triangle', 0.09); },
    coin:    function () { seq([[988, 0.06], [1319, 0.12]]); },
    stomp:   function () { tone(160, 0.12, 'sawtooth', 0.12); },
    hurt:    function () { seq([[300, 0.1, 'sawtooth'], [180, 0.18, 'sawtooth']]); },
    land:    function () { tone(120, 0.05, 'triangle', 0.06); },
    equip:   function () { seq([[784, 0.09], [988, 0.09], [1319, 0.1], [1568, 0.22]]); },
    clear:   function () { seq([[659, 0.1], [784, 0.1], [988, 0.1], [1319, 0.26]]); },
    gameover:function () { seq([[392, 0.16, 'sawtooth'], [311, 0.16, 'sawtooth'], [233, 0.34, 'sawtooth']]); },
    select:  function () { tone(740, 0.07, 'square', 0.08); },
    // 歌劇院「漸強」：樂團齊奏的上行和弦
    fanfare: function () {
      seq([[392, 0.12, 'triangle', 0.1], [494, 0.12, 'triangle', 0.1],
           [587, 0.12, 'triangle', 0.1], [784, 0.4, 'triangle', 0.12]]);
      tone(196, 0.9, 'sawtooth', 0.04);
    },
    // 大笨鐘：低音 E 加上不協和泛音，長尾音聽起來才像大鐘
    bell:    function () {
      tone(165, 1.6, 'sine', 0.16);
      tone(330, 1.1, 'sine', 0.07);
      tone(396, 0.8, 'triangle', 0.04);
    },

    // 密道：找到入口的低鳴 + 打開的上行音
    talk:    function () { seq([[620, 0.05, 'triangle'], [780, 0.07, 'triangle']]); },
    secret:  function () { seq([[330, 0.12, 'triangle'], [440, 0.12, 'triangle'], [587, 0.2, 'triangle']]); },
    // 敵人：彈射物、盾兵被彈開
    shoot:   function () { tone(300, 0.08, 'sawtooth', 0.07); },
    clang:   function () { tone(220, 0.09, 'square', 0.09); },
    // 魔王
    bossRoar: function () { seq([[160, 0.2, 'sawtooth', 0.14], [120, 0.3, 'sawtooth', 0.14]]); },
    bossHit:  function () { seq([[520, 0.07, 'square'], [300, 0.12, 'sawtooth']]); },
    bossDown: function () { seq([[300, 0.14, 'sawtooth'], [240, 0.14, 'sawtooth'], [180, 0.2, 'sawtooth'], [120, 0.4, 'sawtooth']]); }
  };
})();
