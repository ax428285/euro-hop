'use strict';

/** 通用小工具 */
const U = {
  clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); },

  lerp(a, b, t) { return a + (b - a) * t; },

  /** AABB 重疊判定 */
  overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  },

  /** 確定性亂數（同一 seed 每次都一樣，背景裝飾用） */
  rng(seed) {
    let s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5;  s >>>= 0;
      return s / 4294967296;
    };
  },

  /** 圓角矩形路徑 */
  roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  },

  /*
   * v1.31.10 玩家：手機版也會看到這些手機不能用的按鍵 → 在觸控裝置（html.touch）上，畫面上的按鍵提示自動換成手機的說法：
   *   「Esc、Q 回地圖」「I、Q、Esc 返回」這類 →「↩ 回地圖」（左上角的 ↩ 鈕）
   *   「B 商店　I 裝備　N 世界之謎　F2 存檔」→「☰ 選單：商店、裝備、世界之謎」
   *   「Enter」→「確定」（右下角那顆鈕）、「空白鍵」→「跳」
   * 所有畫面上的字都走 U.text，所以這裡改一次就全部生效；電腦版完全不變。
   */
  touchText(str) {
    if (typeof str !== 'string' || typeof document === 'undefined' || !document.documentElement.classList.contains('touch')) return str;
    return str
      .replace(/B 商店　I 裝備　N 世界之謎　F2 存檔/g, '☰ 選單：商店、裝備、世界之謎')
      .replace(/^B 商店・/, '☰ 選單的商店・')                           // 首頁「怎麼玩」的港口
      .replace(/C 同機雙人，或 ☰ 選單「連線」/g, '☰ 選單「連線」找朋友當 2P')  // 首頁「怎麼玩」的兩人一起（手機沒有 C 鍵）
      .replace(/（N 查看）/g, '（☰ 選單查看）')
      .replace(/(?:(?:[A-Z][0-9]?|Esc|Enter)\s?(?:[、／]|\s或\s|或)\s?)*(?:[A-Z][0-9]?|Esc)\s(回到大地圖|回大地圖|返回地圖|回地圖|返回|取消)/g, '↩ $1')
      .replace(/按 Enter 或 空白鍵/g, '按「確定」')
      .replace(/Enter（確定）/g, '「確定」')
      .replace(/Enter（或點一下）/g, '「確定」（或點一下）')
      .replace(/按 Enter/g, '按「確定」')
      .replace(/Enter/g, '確定')
      .replace(/空白鍵/g, '跳');
  },

  /** 置中文字，附描邊讓任何背景都讀得清楚 */
  text(ctx, str, x, y, opts) {
    const o = opts || {};
    str = U.touchText(str);
    ctx.save();
    ctx.font = `${o.weight || 600} ${o.size || 16}px "Segoe UI", "Microsoft JhengHei", sans-serif`;
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = o.baseline || 'middle';
    if (o.stroke !== false) {
      ctx.lineWidth = o.strokeWidth || 4;
      ctx.strokeStyle = o.strokeColor || 'rgba(12,16,28,0.85)';
      ctx.lineJoin = 'round';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = o.color || '#ffffff';
    ctx.fillText(str, x, y);
    ctx.restore();
  }
};
