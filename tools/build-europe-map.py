#!/usr/bin/env python3
"""
⚠️ 已停用（v1.4）：改用 tools/build-europe-map.js（node tools/build-europe-map.js）。
   新版是「比畫面高、可捲動」的世界座標地圖；這支舊腳本產生的是單畫面版本，
   重跑會把地圖蓋回舊的小地圖。保留只供參考。

把 Natural Earth 的真實國界資料轉成遊戲地圖用的畫布座標。

資料來源：Natural Earth 1:110m admin-0 countries（公共領域 / public domain）
          https://www.naturalearthdata.com/

為什麼要這支腳本：
    原本的歐洲地圖是手工捏的多邊形，形狀和相對位置都不對。
    改成從真實經緯度投影，國家輪廓才認得出來。

做法：
    1. 讀 GeoJSON，挑出歐洲國家
    2. 用 Web Mercator 投影（緯度高的地方會被拉長，但這是地圖的慣例長相）
    3. 等比縮放塞進畫布的可用區域
    4. 用 Douglas-Peucker 簡化頂點（原始資料太細，畫起來慢又沒必要）
    5. 輸出成 js/europe-geo.js

輸出座標系：畫布像素，x 往右、y 往下。
"""

import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'ne110m.json')
OUT = os.path.join(ROOT, 'js', 'europe-geo.js')

# 畫布可用區域（對齊 worldmap.js 的 MAP_TOP / MAP_BOTTOM）
CANVAS_W = 960
MAP_TOP = 46
MAP_BOTTOM = 382
PAD_X = 20

# 十個關卡國家（ISO A3 → 遊戲內 id）
LEVEL_COUNTRIES = {
    'ESP': 'ES',   # 1 西班牙
    'FRA': 'FR',   # 2 法國
    'GBR': 'GB',   # 3 英國
    'NLD': 'NL',   # 4 荷蘭（魔王）
    'DEU': 'DE',   # 5 德國
    'CZE': 'CZ',   # 6 捷克
    'AUT': 'AT',   # 7 奧地利
    'CHE': 'CH',   # 8 瑞士
    'ITA': 'IT',   # 9 義大利
    'GRC': 'GR',   # 10 希臘（最終魔王）
}

# 背景國家：不是關卡，但畫出來地圖才不會空蕩蕩
BACKDROP_COUNTRIES = {
    'PRT': 'PT', 'IRL': 'IE', 'BEL': 'BE', 'LUX': 'LU', 'DNK': 'DK',
    'POL': 'PL', 'SVK': 'SK', 'HUN': 'HU', 'SVN': 'SI', 'HRV': 'HR',
    'BIH': 'BA', 'SRB': 'RS', 'MNE': 'ME', 'ALB': 'AL', 'MKD': 'MK',
    'BGR': 'BG', 'ROU': 'RO', 'TUR': 'TR', 'SWE': 'SE', 'NOR': 'NO',
    'LTU': 'LT', 'LVA': 'LV', 'EST': 'EE', 'BLR': 'BY', 'UKR': 'UA',
    'MDA': 'MD', 'MAR': 'MA', 'DZA': 'DZ', 'TUN': 'TN',
}

# 投影框：只框住這 10 國所在的範圍。
# 刻意不含北歐遠北（芬蘭/挪威北部），否則地圖會變得又高又窄，
# 畫布兩側會留下大片沒用的海。
LON_MIN, LON_MAX = -10.5, 29.0
LAT_MIN, LAT_MAX = 34.5, 59.0

# 容許的橫向拉伸上限。
# 歐洲在這個框內接近正方形，但畫布是 2:1，純等比會浪費左右空間。
# 1.35 倍以內看起來還是歐洲，超過就開始變形得明顯。
X_STRETCH_MAX = 1.35

# 背景國家會延伸到取景框外（例如俄羅斯、北非），
# 畫出來會超出可用區域。這裡在投影後直接裁掉超出邊界的部分。
CLIP_MARGIN = 2


def mercator(lon, lat):
    """Web Mercator。回傳未縮放的平面座標。"""
    x = math.radians(lon)
    lat = max(min(lat, 84.0), -84.0)
    y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y


def ring_in_box(ring):
    """整圈是否至少有一點落在歐洲框內"""
    for lon, lat in ring:
        if LON_MIN <= lon <= LON_MAX and LAT_MIN <= lat <= LAT_MAX:
            return True
    return False


def perp_dist(p, a, b):
    """點 p 到線段 ab 的垂直距離"""
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def simplify(pts, tol):
    """Douglas-Peucker 折線簡化"""
    if len(pts) < 3:
        return pts[:]
    first, last = pts[0], pts[-1]
    idx, far = -1, 0.0
    for i in range(1, len(pts) - 1):
        d = perp_dist(pts[i], first, last)
        if d > far:
            idx, far = i, d
    if far > tol:
        left = simplify(pts[:idx + 1], tol)
        right = simplify(pts[idx:], tol)
        return left[:-1] + right
    return [first, last]


def polygon_area(pts):
    """鞋帶公式，用來挑最大的那塊陸地"""
    a = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2.0


def main():
    with open(SRC, 'r', encoding='utf-8') as f:
        data = json.load(f)

    all_wanted = {}
    all_wanted.update(LEVEL_COUNTRIES)
    all_wanted.update(BACKDROP_COUNTRIES)

    # ── 收集歐洲範圍內的所有環 ──
    raw = {}   # iso3 -> list of rings (lon/lat)
    for feat in data['features']:
        props = feat['properties']
        # ⚠️ 不能只看 ISO_A3：Natural Earth 對法國、挪威等國
        #    把 ISO_A3 填成 "-99"（因為有海外屬地的爭議），
        #    真正穩定的代碼在 ADM0_A3。優先用它。
        iso = (props.get('ADM0_A3') or props.get('ISO_A3') or '').upper()
        if iso == '-99':
            iso = (props.get('ISO_A3') or '').upper()
        name = props.get('NAME') or props.get('ADMIN') or ''
        if iso not in all_wanted:
            continue
        geom = feat['geometry']
        if geom is None:
            continue
        polys = []
        if geom['type'] == 'Polygon':
            polys = [geom['coordinates']]
        elif geom['type'] == 'MultiPolygon':
            polys = geom['coordinates']
        rings = []
        for poly in polys:
            outer = [(float(c[0]), float(c[1])) for c in poly[0]]
            if ring_in_box(outer):
                rings.append(outer)
        if rings:
            raw[iso] = {'name': name, 'rings': rings}

    # ── 投影 ──
    # 邊界用「固定的經緯度框」算，不是用資料的實際範圍。
    # 這樣地圖的取景是可預期的，加減國家不會讓整張圖跳動。
    minx, maxy = mercator(LON_MIN, LAT_MAX)
    maxx, miny = mercator(LON_MAX, LAT_MIN)

    projected = {}
    for iso, info in raw.items():
        prings = []
        for ring in info['rings']:
            pr = []
            for lon, lat in ring:
                # 夾在框內，避免遠處的小島/屬地把形狀拉歪
                lon = max(LON_MIN, min(LON_MAX, lon))
                lat = max(LAT_MIN, min(LAT_MAX, lat))
                pr.append(mercator(lon, lat))
            prings.append(pr)
        projected[iso] = {'name': info['name'], 'rings': prings}

    # ── 縮放塞進可用區域 ──
    avail_w = CANVAS_W - PAD_X * 2
    avail_h = MAP_BOTTOM - MAP_TOP
    span_x = maxx - minx
    span_y = maxy - miny

    # 先用等比，再允許 x 方向適度拉伸填滿畫布寬度
    base = min(avail_w / span_x, avail_h / span_y)
    scale_y = base
    scale_x = min(avail_w / span_x, base * X_STRETCH_MAX)

    used_w = span_x * scale_x
    used_h = span_y * scale_y
    off_x = PAD_X + (avail_w - used_w) / 2
    off_y = MAP_TOP + (avail_h - used_h) / 2

    # 取景框是矩形，但實際陸地偏在框的左半（框的東側是俄羅斯/黑海，
    # 我們的 10 國都在西歐/中歐）。純按框置中會讓整張圖偏左，
    # 右邊空出一大片海。這裡量「10 個關卡國家的實際中心」再平移修正。
    lvl_xs = []
    for iso in LEVEL_COUNTRIES:
        if iso not in projected:
            continue
        for ring in projected[iso]['rings']:
            for x, _y in ring:
                lvl_xs.append(off_x + (x - minx) * scale_x)
    if lvl_xs:
        land_mid = (min(lvl_xs) + max(lvl_xs)) / 2
        off_x += (CANVAS_W / 2) - land_mid

    # 畫布邊界（所有輸出的點都會被夾進來，避免蓋到上下 UI 條）
    CLIP_L = CLIP_MARGIN
    CLIP_R = CANVAS_W - CLIP_MARGIN
    CLIP_T = MAP_TOP + CLIP_MARGIN
    CLIP_B = MAP_BOTTOM - CLIP_MARGIN

    def to_canvas(p):
        x, y = p
        cx = off_x + (x - minx) * scale_x
        # Mercator 的 y 往北變大，畫布 y 往下變大 → 要翻轉
        cy = off_y + (maxy - y) * scale_y
        cx = max(CLIP_L, min(CLIP_R, cx))
        cy = max(CLIP_T, min(CLIP_B, cy))
        return (round(cx, 1), round(cy, 1))

    out = {}
    backdrop_out = {}
    for iso, info in projected.items():
        is_level = iso in LEVEL_COUNTRIES
        # 關卡國家保留較多細節（玩家會盯著看），背景國家簡化得兇一點
        tol = 0.9 if is_level else 1.8
        min_area = 10 if is_level else 40

        shapes = []
        for pr in info['rings']:
            cv = [to_canvas(p) for p in pr]
            dedup = [cv[0]]
            for p in cv[1:]:
                if p != dedup[-1]:
                    dedup.append(p)
            if len(dedup) < 4:
                continue
            simp = simplify(dedup, tol)
            if len(simp) < 4:
                continue
            if polygon_area(simp) < min_area:
                continue
            shapes.append(simp)
        if not shapes:
            continue
        shapes.sort(key=polygon_area, reverse=True)
        rec = {'iso': iso, 'name': info['name'], 'shapes': shapes}
        if is_level:
            out[LEVEL_COUNTRIES[iso]] = rec
        else:
            backdrop_out[BACKDROP_COUNTRIES[iso]] = rec

    # ── 算每國的「可放圖釘的點」──
    # 用最大塊陸地的 centroid；若 centroid 落在多邊形外（像義大利靴型），
    # 退而求其次掃格點找一個真正在裡面的。
    def centroid(pts):
        a = 0.0; cx = 0.0; cy = 0.0
        n = len(pts)
        for i in range(n):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % n]
            cr = x1 * y2 - x2 * y1
            a += cr
            cx += (x1 + x2) * cr
            cy += (y1 + y2) * cr
        if abs(a) < 1e-9:
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            return (sum(xs) / n, sum(ys) / n)
        a *= 0.5
        return (cx / (6 * a), cy / (6 * a))

    def in_poly(pt, pts):
        x, y = pt
        inside = False
        n = len(pts)
        j = n - 1
        for i in range(n):
            xi, yi = pts[i]
            xj, yj = pts[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi:
                inside = not inside
            j = i
        return inside

    def inner_point(pts):
        c = centroid(pts)
        if in_poly(c, pts):
            return (round(c[0], 1), round(c[1], 1))
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        best = None; bestd = -1
        for gx in range(12):
            for gy in range(12):
                px = min(xs) + (max(xs) - min(xs)) * (gx + 0.5) / 12
                py = min(ys) + (max(ys) - min(ys)) * (gy + 0.5) / 12
                if not in_poly((px, py), pts):
                    continue
                # 選離邊界最遠的點，圖釘才不會貼在海岸線上
                d = min(perp_dist((px, py), pts[i], pts[(i + 1) % len(pts)])
                        for i in range(len(pts)))
                if d > bestd:
                    bestd = d; best = (px, py)
        if best is None:
            return (round(c[0], 1), round(c[1], 1))
        return (round(best[0], 1), round(best[1], 1))

    for info in out.values():
        info['center'] = inner_point(info['shapes'][0])

    # ── 寫出 JS ──
    def emit(d, name, lines):
        lines.append('const %s = {' % name)
        for key in sorted(d.keys()):
            info = d[key]
            lines.append('  %s: {' % key)
            lines.append('    iso: %s, name: %s,'
                         % (json.dumps(info['iso']), json.dumps(info['name'])))
            if 'center' in info:
                lines.append('    center: [%g, %g],' % info['center'])
            lines.append('    shapes: [')
            for sh in info['shapes']:
                pts = ','.join('[%g,%g]' % (x, y) for x, y in sh)
                lines.append('      [%s],' % pts)
            lines.append('    ]')
            lines.append('  },')
        lines.append('};')
        lines.append('')

    lines = []
    lines.append("'use strict';")
    lines.append('')
    lines.append('/**')
    lines.append(' * 歐洲國界（真實地理資料，已投影成畫布座標）。')
    lines.append(' *')
    lines.append(' * ⚠️ 這個檔案是 tools/build-europe-map.py 產生的，不要手改。')
    lines.append(' *    要調整取景或簡化程度就改腳本再重跑。')
    lines.append(' *')
    lines.append(' * 資料來源：Natural Earth 1:110m admin-0 countries（公共領域 public domain）')
    lines.append(' *           https://www.naturalearthdata.com/')
    lines.append(' * 投影：Web Mercator')
    lines.append(' *   取景框 經度 %.1f ~ %.1f、緯度 %.1f ~ %.1f' % (LON_MIN, LON_MAX, LAT_MIN, LAT_MAX))
    lines.append(' *   縮放 x=%.2f y=%.2f（x 略為拉伸以填滿 2:1 畫布，倍率上限 %.2f）'
                 % (scale_x, scale_y, X_STRETCH_MAX))
    lines.append(' *   位移 (%.1f, %.1f)' % (off_x, off_y))
    lines.append(' *')
    lines.append(' * 每個國家：{ iso, name, center, shapes: [[[x,y], ...], ...] }')
    lines.append(' *   shapes 依面積從大到小排序，第一個是本土')
    lines.append(' *   center 是保證落在本土多邊形內的點（圖釘用）')
    lines.append(' */')
    lines.append('')
    emit(out, 'EuropeGeo', lines)
    lines.append('/** 背景國家（非關卡，只為了讓地圖不空蕩） */')
    emit(backdrop_out, 'EuropeBackdrop', lines)

    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    total_pts = (sum(len(s) for i in out.values() for s in i['shapes'])
                 + sum(len(s) for i in backdrop_out.values() for s in i['shapes']))
    print('wrote %s' % OUT)
    print('level countries: %d, backdrop: %d, total points: %d'
          % (len(out), len(backdrop_out), total_pts))
    print('scale x=%.2f y=%.2f  offset=(%.1f, %.1f)' % (scale_x, scale_y, off_x, off_y))
    print('--- level countries ---')
    for key in sorted(out.keys()):
        info = out[key]
        big = info['shapes'][0]
        xs = [p[0] for p in big]; ys = [p[1] for p in big]
        print('  %-3s %-16s shapes=%-2d center=(%5.0f,%5.0f)  x:%3.0f-%3.0f y:%3.0f-%3.0f'
              % (key, info['name'], len(info['shapes']),
                 info['center'][0], info['center'][1],
                 min(xs), max(xs), min(ys), max(ys)))
    missing = [k for k in LEVEL_COUNTRIES.values() if k not in out]
    if missing:
        print('!! MISSING level countries: %s' % missing)


if __name__ == '__main__':
    main()
