"""
把國家特色物件搬到不會跟平台/斷崖打架的位置。

做法：
  1. 從 levels.js 解析出每關的平台、斷崖、以及 props 清單
  2. 針對每個 prop 算出「候選 x」—— 掃過整關，找滿足所有約束的位置
  3. 盡量靠近原本的 x（保持關卡節奏），改寫回 levels.js

約束（與 tests/level-check.js 一致）：
  * 前景道具：不壓低平台、不站斷崖上空、彼此不重疊
  * 背景建築：不與任何 y > GROUND_Y-180 的平台重疊
"""
import json
import re
import pathlib
import subprocess
import sys

GROUND_Y = 400
ROOT = pathlib.Path(__file__).parent.parent
LEVELS = ROOT / "js" / "levels.js"

PROP_WIDTH = {
    "arcTriomphe": 150, "cafe": 100, "kiosk": 60, "lamp": 26,
    "canalHouse": 130, "bike": 56, "bridge": 160, "cow": 80,
    "brandenburg": 180, "halfTimber": 100, "beerTent": 130,
    "clockTower": 56, "pretzel": 60,
    "chalet": 120, "cableCar": 820, "swissClock": 44,
    "pisaTower": 90, "trevi": 130, "ruinColumns": 110,
    "gondola": 80, "pizzaStand": 100, "vespa": 60,
    "blueDome": 90, "amphora": 40, "statue": 50,
    "fishBoat": 180, "greekWindmill": 70,
}

BG = {
    "arcTriomphe", "brandenburg", "pisaTower", "canalHouse", "halfTimber",
    "chalet", "clockTower", "swissClock", "greekWindmill", "blueDome",
    "trevi", "ruinColumns", "beerTent", "cableCar",
}

# 這些是刻意跨在斷崖上的，不要搬
PINNED = {"bridge", "fishBoat", "cableCar"}

src = LEVELS.read_text(encoding="utf-8")


def level_blocks(text):
    """切出六個 list.push({...}) 區塊的起訖"""
    out = []
    for m in re.finditer(r"list\.push\(\{", text):
        start = m.end() - 1
        depth = 0
        i = start
        while i < len(text):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    out.append((start, i + 1))
                    break
            i += 1
    return out


def parse_array(block, key):
    """抓 key: [ ... ] 的原始字串與範圍"""
    m = re.search(key + r":\s*\[", block)
    if not m:
        return None
    start = m.end() - 1
    depth = 0
    i = start
    while i < len(block):
        if block[i] == "[":
            depth += 1
        elif block[i] == "]":
            depth -= 1
            if depth == 0:
                return (start, i + 1, block[start:i + 1])
        i += 1
    return None


def nums(s, key):
    m = re.search(key + r":\s*(-?\d+)", s)
    return int(m.group(1)) if m else None


blocks = level_blocks(src)
print("found %d levels" % len(blocks))

new_src = src
# 從後往前改，避免位移失效
for bi in range(len(blocks) - 1, -1, -1):
    bs, be = blocks[bi]
    block = src[bs:be]
    # const width / const gaps 宣告在 list.push 之前的 IIFE 裡，
    # 所以往前多看 900 字元才抓得到
    prelude = src[max(0, bs - 900):bs]

    # 關卡寬度與 goal。
    # 注意：block 裡的 width 欄位寫成 `width: width`（引用區塊開頭的 const），
    # 所以要從 `const width = N` 抓，不能直接讀欄位。
    wm = re.search(r"const width = (\d+)", prelude)
    width = int(wm.group(1)) if wm else None
    goal = nums(block, "goal")
    if width is None:
        print("  !! level %d: 讀不到 width，跳過" % (bi + 1))
        continue

    # 平台
    plats = []
    pa = parse_array(block, "platforms")
    if pa:
        for m in re.finditer(r"\{ x: (\d+), y: (\d+), w: (\d+), h: (\d+) \}", pa[2]):
            x, y, w, h = map(int, m.groups())
            plats.append({"x": x, "y": y, "w": w, "h": h})

    # 斷崖：從 gaps 的定義抓（同樣在 prelude 裡）
    gm = re.search(r"const gaps = (\[\[.*?\]\]);", prelude, re.S)
    gaps = []
    if gm:
        raw = gm.group(1).replace(" ", "")
        for g in re.finditer(r"\[(\d+),(\d+)\]", raw):
            gaps.append((int(g.group(1)), int(g.group(2))))

    # props
    pr = parse_array(block, "props")
    if not pr:
        continue
    props = []
    for m in re.finditer(
        r"\{ type: '(\w+)'(?:, x: (\d+))?(?:, scale: ([\d.]+))?(?:, span: (\d+))?[^}]*\}",
        pr[2],
    ):
        t = m.group(1)
        x = int(m.group(2)) if m.group(2) else 0
        props.append({
            "type": t, "x": x,
            "scale": m.group(3), "span": m.group(4),
            "raw": m.group(0),
        })

    def ok_fg(t, x, placed):
        w = PROP_WIDTH[t]
        left, right = x - w / 2, x + w / 2
        if left < 40 or right > width - 40:
            return False
        # 不站斷崖上空
        for gx, gw in gaps:
            if gx - 8 < x < gx + gw + 8:
                return False
            # 整體也不要壓在斷崖上
            if right > gx and left < gx + gw:
                return False
        # 不被低平台壓住
        for p in plats:
            if p["y"] < GROUND_Y - 90:
                continue
            if min(p["x"] + p["w"], right) - max(p["x"], left) > 20:
                return False
        # 不要太靠近終點旗
        if goal and abs(x - goal) < 90:
            return False
        # 彼此不重疊
        for q in placed:
            qw = PROP_WIDTH[q["type"]]
            if min(q["x"] + qw / 2, right) - max(q["x"] - qw / 2, left) > 10:
                return False
        return True

    def ok_bg(t, x):
        w = PROP_WIDTH[t]
        left, right = x - w / 2, x + w / 2
        if left < 30 or right > width - 30:
            return False
        for p in plats:
            if p["y"] <= GROUND_Y - 180:
                continue
            if min(p["x"] + p["w"], right) - max(p["x"], left) > 30:
                return False
        if goal and abs(x - goal) < 110:
            return False
        return True

    placed_fg = []
    changed = 0
    for pp in props:
        t = pp["type"]
        if t in PINNED:
            continue
        test = ok_bg if t in BG else (lambda tt, xx: ok_fg(tt, xx, placed_fg))
        orig = pp["x"]
        best = None
        # 由原位置向外螺旋搜尋，step 10
        for d in range(0, 2600, 10):
            for cand in ([orig] if d == 0 else [orig - d, orig + d]):
                if cand < 0 or cand > width:
                    continue
                if test(t, cand):
                    best = cand
                    break
            if best is not None:
                break
        if best is None:
            print("  !! level %d: 找不到 %s 的位置（原 x=%d）" % (bi + 1, t, orig))
            best = orig
        if best != orig:
            changed += 1
        pp["new_x"] = best
        if t not in BG:
            placed_fg.append({"type": t, "x": best})

    # 重建 props 陣列文字
    lines = []
    for pp in props:
        t = pp["type"]
        x = pp.get("new_x", pp["x"])
        s = "{ type: '%s', x: %d" % (t, x)
        if pp["scale"]:
            s += ", scale: %s" % pp["scale"]
        if pp["span"]:
            s += ", span: %s" % pp["span"]
        s += " }"
        lines.append(s)

    body = ",\n        ".join(lines)
    new_arr = "[\n        " + body + "\n      ]"

    ns, ne = pr[0], pr[1]
    new_block = block[:ns] + new_arr + block[ne:]
    new_src = new_src[:bs] + new_block + new_src[be:]
    print("level %d: moved %d props" % (bi + 1, changed))

LEVELS.write_text(new_src, encoding="utf-8")
print("written")
