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

  /** 置中文字，附描邊讓任何背景都讀得清楚 */
  text(ctx, str, x, y, opts) {
    const o = opts || {};
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
