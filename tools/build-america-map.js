#!/usr/bin/env node
'use strict';
/**
 * v1.31 美洲篇：另開一張「新大陸」地圖（加勒比海、中美洲、南美洲）。
 *
 * 跟 tools/build-europe-map.js 同一套做法（Natural Earth 1:110m admin-0，公共領域），差別只有取景：
 *   ⚠️ 比例尺、世界大小跟歐洲地圖「完全一樣」（1196 × 1239）—— 船速、相機、陸地格子、
 *      WorldMap / Voyage 裡用到世界大小的常數都不用改，換地圖時只要換國界資料和投影。
 *   經度 -101 ~ -30（跟歐洲一樣寬 71 度），北緯 32.5 往南、一直到世界高度用完（約南緯 45 度）。
 *
 * 所有國家都當「背景國」輸出（AmericaGeo 留空）：圖釘由 worldmap 用 innerPoint 算，跟東歐、非洲、北歐篇一樣。
 *
 * 用法：node tools/build-america-map.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'ne110m.json');
const OUT = path.join(ROOT, 'js', 'america-geo.js');

// 比例尺沿用歐洲地圖（見 build-europe-map.js）
const SCALE_LON_MIN = -12, SCALE_LON_MAX = 45, SCALE_W = 960;
const X_STRETCH = 1.15;
const LON_MIN = -101, LON_MAX = -30;
const LAT_MAX = 32.5;
const EU_WORLD_H = 1239;              // 歐洲地圖的世界高度：美洲地圖一樣高
function mercY0(lat) { const r = lat * Math.PI / 180; return Math.log(Math.tan(Math.PI / 4 + r / 2)); }
const SX0 = SCALE_W / ((SCALE_LON_MAX - SCALE_LON_MIN) * Math.PI / 180), SY0 = SX0 / X_STRETCH;
const LAT_MIN = Math.round(Math.atan(Math.sinh(mercY0(LAT_MAX) - EU_WORLD_H / SY0)) * 180 / Math.PI * 100) / 100;

const LEVEL_COUNTRIES = {};
const BACKDROP_COUNTRIES = {
  // 關卡國（v1.31）：古巴、牙買加、墨西哥、巴拿馬、哥倫比亞、巴西
  CUB: 'CU', JAM: 'JM', MEX: 'MX', PAN: 'PA', COL: 'CO', BRA: 'BR',
  // 背景國
  USA: 'US', BHS: 'BS', HTI: 'HT', DOM: 'DO', PRI: 'PR', TTO: 'TT',
  BLZ: 'BZ', GTM: 'GT', HND: 'HN', SLV: 'SV', NIC: 'NI', CRI: 'CR',
  VEN: 'VE', GUY: 'GY', SUR: 'SR', ECU: 'EC', PER: 'PE', BOL: 'BO',
  PRY: 'PY', URY: 'UY', ARG: 'AR', CHL: 'CL', FLK: 'FK',
  // 法屬圭亞那在 Natural Earth 裡併在 FRA（法國本土在取景外，會被 ringInBox 濾掉）
  FRA: 'GF'
};

// 小國：簡化與最小面積放寬，不然會被濾掉（牙買加、波多黎各、千里達、巴哈馬⋯⋯）
const SMALL_OK = { JAM: 1, PRI: 1, TTO: 1, BHS: 1, SLV: 1, BLZ: 1 };

function mercY(lat) {
  const r = Math.max(Math.min(lat, 84), -84) * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + r / 2));
}
const minX = LON_MIN * Math.PI / 180, maxX = LON_MAX * Math.PI / 180;
const maxY = mercY(LAT_MAX), minY = mercY(LAT_MIN);
const SCALE_X = SCALE_W / ((SCALE_LON_MAX - SCALE_LON_MIN) * Math.PI / 180);
const SCALE_Y = SCALE_X / X_STRETCH;
const WORLD_W = Math.round((maxX - minX) * SCALE_X);
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
    const small = !!SMALL_OK[iso];
    const tol = isLevel || small ? 0.8 : 1.4;
    const minArea = isLevel ? 12 : small ? 3 : 30;
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
  L.push(' * 美洲國界（v1.31 美洲篇；真實地理資料，已投影成「世界座標」）。');
  L.push(' *');
  L.push(' * ⚠️ 這個檔案是 tools/build-america-map.js 產生的，不要手改。');
  L.push(' *    要調整取景或簡化程度就改腳本再重跑：node tools/build-america-map.js');
  L.push(' *');
  L.push(' * 資料來源：Natural Earth 1:110m admin-0 countries（公共領域 public domain）');
  L.push(' * 投影：Web Mercator，經度 ' + LON_MIN + ' ~ ' + LON_MAX + '、緯度 ' + LAT_MIN + ' ~ ' + LAT_MAX);
  L.push(' * 世界大小 ' + WORLD_W + ' x ' + WORLD_H + '（跟歐洲地圖一樣大）');
  L.push(' */');
  L.push('');
  L.push('/** 世界大小 + 經緯度 → 世界座標 */');
  L.push('const AmericaWorld = {');
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
  emit(out, 'AmericaGeo', L);
  L.push('/** 背景國家（非關卡，只為了讓地圖完整） */');
  emit(back, 'AmericaBackdrop', L);
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
