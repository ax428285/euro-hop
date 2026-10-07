#!/usr/bin/env node
'use strict';
/**
 * 把 Natural Earth 的真實國界資料轉成遊戲地圖用的「世界座標」。
 *
 * （原本是 build-europe-map.py；改成 Node 版，因為開發機不一定有 Python，
 *   而 Node 本來就拿來跑測試。輸出格式相同，多了 EuropeWorld。）
 *
 * 資料來源：Natural Earth 1:110m admin-0 countries（公共領域 / public domain）
 *
 * ── 取景（v1.4 改版）──────────────────────────────────────
 * 舊版把整個歐洲塞進一個畫面（960×336），國家很小、而且歐洲本身接近正方形，
 * 塞進 2:1 的畫面後左右各剩一大片海。
 *
 * 新版：地圖寬度剛好等於畫面寬（960），高度比畫面高，大地圖會跟著船上下捲動。
 *   經度 -12 ~ 45：西邊留一點大西洋，東邊到黑海 / 高加索（東歐篇需要）
 *   緯度 30.5 ~ 61：南邊含整個地中海與北非海岸，北邊到波羅的海
 * 國家比舊版大約 1.6 倍。
 *
 * 用法：node tools/build-europe-map.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'ne110m.json');
const OUT = path.join(ROOT, 'js', 'europe-geo.js');

const WORLD_W = 960;
const LON_MIN = -12, LON_MAX = 45;
// v1.9：往北到挪威北角（北歐）、往南到撒哈拉（非洲），先畫出來給之後的篇章用
const LAT_MIN = 19, LAT_MAX = 71.5;
// x 相對 y 的拉伸（Mercator 在這個緯度帶看起來偏瘦，略拉寬比較像大家印象中的歐洲）
const X_STRETCH = 1.15;

const LEVEL_COUNTRIES = {
  ESP: 'ES', FRA: 'FR', GBR: 'GB', NLD: 'NL', DEU: 'DE',
  CZE: 'CZ', AUT: 'AT', CHE: 'CH', ITA: 'IT', GRC: 'GR'
};

const BACKDROP_COUNTRIES = {
  PRT: 'PT', IRL: 'IE', BEL: 'BE', LUX: 'LU', DNK: 'DK',
  POL: 'PL', SVK: 'SK', HUN: 'HU', SVN: 'SI', HRV: 'HR',
  BIH: 'BA', SRB: 'RS', MNE: 'ME', ALB: 'AL', MKD: 'MK',
  BGR: 'BG', ROU: 'RO', TUR: 'TR', SWE: 'SE', NOR: 'NO',
  LTU: 'LT', LVA: 'LV', EST: 'EE', BLR: 'BY', UKR: 'UA',
  MDA: 'MD', MAR: 'MA', DZA: 'DZ', TUN: 'TN', KOS: 'XK',
  // 新取景框多進來的：東邊與地中海南岸
  RUS: 'RU', FIN: 'FI', GEO: 'GE', ARM: 'AM', AZE: 'AZ',
  CYP: 'CY', CYN: 'CN', SYR: 'SY', LBN: 'LB', ISR: 'IL', JOR: 'JO',
  IRQ: 'IQ', IRN: 'IR', EGY: 'EG', LBY: 'LY', SAU: 'SA',
  // 非洲（撒哈拉一帶）與阿拉伯半島北部
  SAH: 'EH', MRT: 'MR', MLI: 'ML', NER: 'NE', TCD: 'TD', SDN: 'SD', ERI: 'ER', YEM: 'YE'
};

function mercY(lat) {
  const r = Math.max(Math.min(lat, 84), -84) * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + r / 2));
}
const minX = LON_MIN * Math.PI / 180, maxX = LON_MAX * Math.PI / 180;
const maxY = mercY(LAT_MAX), minY = mercY(LAT_MIN);
const SCALE_X = WORLD_W / (maxX - minX);
const SCALE_Y = SCALE_X / X_STRETCH;
const WORLD_H = Math.round((maxY - minY) * SCALE_Y);

function project(lon, lat) {
  lon = Math.max(LON_MIN, Math.min(LON_MAX, lon));
  lat = Math.max(LAT_MIN, Math.min(LAT_MAX, lat));
  const x = (lon * Math.PI / 180 - minX) * SCALE_X;
  const y = (maxY - mercY(lat)) * SCALE_Y;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

function ringInBox(ring) {
  return ring.some(function (c) {
    return c[0] >= LON_MIN && c[0] <= LON_MAX && c[1] >= LAT_MIN && c[1] <= LAT_MAX;
  });
}

function perpDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts.slice();
  const first = pts[0], last = pts[pts.length - 1];
  let idx = -1, far = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], first, last);
    if (d > far) { idx = i; far = d; }
  }
  if (far > tol) {
    const l = simplify(pts.slice(0, idx + 1), tol);
    const r = simplify(pts.slice(idx), tol);
    return l.slice(0, -1).concat(r);
  }
  return [first, last];
}

function area(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

function inPoly(pt, pts) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if (((yi > pt[1]) !== (yj > pt[1])) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi + 1e-12) + xi) ins = !ins;
  }
  return ins;
}

function centroid(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const cr = p[0] * q[1] - q[0] * p[1];
    a += cr; cx += (p[0] + q[0]) * cr; cy += (p[1] + q[1]) * cr;
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

/** 保證落在多邊形內、而且離邊界最遠的點（圖釘用） */
function innerPoint(pts) {
  const c = centroid(pts);
  const xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
  const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
  const y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  let best = null, bestScore = -Infinity;
  for (let gx = 0; gx < 24; gx++) {
    for (let gy = 0; gy < 24; gy++) {
      const p = [x0 + (x1 - x0) * (gx + 0.5) / 24, y0 + (y1 - y0) * (gy + 0.5) / 24];
      if (!inPoly(p, pts)) continue;
      let d = Infinity;
      for (let i = 0; i < pts.length; i++) d = Math.min(d, perpDist(p, pts[i], pts[(i + 1) % pts.length]));
      // 離邊界越遠越好，但也別離幾何中心太遠
      const score = d - Math.hypot(p[0] - c[0], p[1] - c[1]) * 0.15;
      if (score > bestScore) { bestScore = score; best = p; }
    }
  }
  const r = best || c;
  return [Math.round(r[0] * 10) / 10, Math.round(r[1] * 10) / 10];
}

function main() {
  const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const out = {}, back = {};
  data.features.forEach(function (f) {
    const p = f.properties;
    let iso = String(p.ADM0_A3 || p.ISO_A3 || '').toUpperCase();
    if (iso === '-99') iso = String(p.ISO_A3 || '').toUpperCase();
    const isLevel = !!LEVEL_COUNTRIES[iso];
    if (!isLevel && !BACKDROP_COUNTRIES[iso]) return;
    const g = f.geometry;
    if (!g) return;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    // 關卡國保留較多細節；背景國簡化得兇一點
    const tol = isLevel ? 0.8 : 1.4;
    const minArea = isLevel ? 12 : 30;
    const shapes = [];
    polys.forEach(function (poly) {
      const ring = poly[0];
      if (!ringInBox(ring)) return;
      const cv = [];
      ring.forEach(function (c) {
        const q = project(c[0], c[1]);
        const last = cv[cv.length - 1];
        if (!last || last[0] !== q[0] || last[1] !== q[1]) cv.push(q);
      });
      if (cv.length < 4) return;
      const s = simplify(cv, tol);
      if (s.length < 4 || area(s) < minArea) return;
      shapes.push(s);
    });
    if (!shapes.length) return;
    shapes.sort(function (a, b) { return area(b) - area(a); });
    const rec = { iso: iso, name: p.NAME || p.ADMIN || '', shapes: shapes };
    if (isLevel) {
      rec.center = innerPoint(shapes[0]);
      out[LEVEL_COUNTRIES[iso]] = rec;
    } else {
      back[BACKDROP_COUNTRIES[iso]] = rec;
    }
  });

  function emit(d, name, lines) {
    lines.push('const ' + name + ' = {');
    Object.keys(d).sort().forEach(function (k) {
      const r = d[k];
      lines.push('  ' + k + ': {');
      lines.push('    iso: ' + JSON.stringify(r.iso) + ', name: ' + JSON.stringify(r.name) + ',');
      if (r.center) lines.push('    center: [' + r.center[0] + ', ' + r.center[1] + '],');
      lines.push('    shapes: [');
      r.shapes.forEach(function (s) {
        lines.push('      [' + s.map(function (q) { return '[' + q[0] + ',' + q[1] + ']'; }).join(',') + '],');
      });
      lines.push('    ]');
      lines.push('  },');
    });
    lines.push('};');
    lines.push('');
  }

  const L = [];
  L.push("'use strict';");
  L.push('');
  L.push('/**');
  L.push(' * 歐洲國界（真實地理資料，已投影成「世界座標」）。');
  L.push(' *');
  L.push(' * ⚠️ 這個檔案是 tools/build-europe-map.js 產生的，不要手改。');
  L.push(' *    要調整取景或簡化程度就改腳本再重跑：node tools/build-europe-map.js');
  L.push(' *');
  L.push(' * 資料來源：Natural Earth 1:110m admin-0 countries（公共領域 public domain）');
  L.push(' * 投影：Web Mercator，經度 ' + LON_MIN + ' ~ ' + LON_MAX + '、緯度 ' + LAT_MIN + ' ~ ' + LAT_MAX);
  L.push(' * 世界大小 ' + WORLD_W + ' x ' + WORLD_H + '（比畫面高，大地圖會上下捲動）');
  L.push(' */');
  L.push('');
  L.push('/** 世界大小 + 經緯度 → 世界座標（海名標籤之類的要用） */');
  L.push('const EuropeWorld = {');
  L.push('  w: ' + WORLD_W + ', h: ' + WORLD_H + ',');
  L.push('  project: function (lon, lat) {');
  L.push('    const LON_MIN = ' + LON_MIN + ', LON_MAX = ' + LON_MAX + ', LAT_MIN = ' + LAT_MIN + ', LAT_MAX = ' + LAT_MAX + ';');
  L.push('    lon = Math.max(LON_MIN, Math.min(LON_MAX, lon));');
  L.push('    lat = Math.max(LAT_MIN, Math.min(LAT_MAX, lat));');
  L.push('    const my = function (a) { return Math.log(Math.tan(Math.PI / 4 + a * Math.PI / 360)); };');
  L.push('    return [(lon - LON_MIN) * Math.PI / 180 * ' + SCALE_X.toFixed(4) + ',');
  L.push('            (my(LAT_MAX) - my(lat)) * ' + SCALE_Y.toFixed(4) + '];');
  L.push('  }');
  L.push('};');
  L.push('');
  emit(out, 'EuropeGeo', L);
  L.push('/** 背景國家（非關卡，只為了讓地圖完整） */');
  emit(back, 'EuropeBackdrop', L);
  fs.writeFileSync(OUT, L.join('\n'), 'utf8');

  console.log('world ' + WORLD_W + 'x' + WORLD_H + '  scale x=' + SCALE_X.toFixed(1) + ' y=' + SCALE_Y.toFixed(1));
  console.log('level ' + Object.keys(out).length + ', backdrop ' + Object.keys(back).length);
  Object.keys(out).sort().forEach(function (k) {
    const s = out[k].shapes[0];
    const xs = s.map(function (q) { return q[0]; }), ys = s.map(function (q) { return q[1]; });
    console.log('  ' + k + ' center=' + out[k].center + ' x:' + Math.min.apply(null, xs) + '-' + Math.max.apply(null, xs) +
      ' y:' + Math.min.apply(null, ys) + '-' + Math.max.apply(null, ys));
  });
}

main();
