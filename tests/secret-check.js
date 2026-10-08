/**
 * 密道 / 魔王關檢查。
 *
 * 密道最容易出的錯是「位置跟別的東西打架」：
 *   蓋在斷崖上（玩家掉下去）、把金幣埋進假牆裡（拿不到）、
 *   跟平台或敵人重疊、或是入口根本走不到。
 * 這些用眼睛看很難抓，所以全部用座標驗。
 *
 * 在瀏覽器執行 runSecretCheck()。
 */
function runSecretCheck() {
  const issues = [];
  const PH = 40, PW = 22;       // 玩家尺寸

  function rects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  /** 把地面段轉成斷崖清單 */
  function gapsOf(def) {
    const out = [];
    const g = def.ground;
    for (let i = 0; i < g.length - 1; i++) {
      const end = g[i].x + g[i].w;
      const start = g[i + 1].x;
      if (start > end) out.push({ x: end, y: Levels.GROUND_Y, w: start - end, h: 200 });
    }
    return out;
  }

  Levels.list.forEach(function (def, li) {
    const tag = '關 ' + (li + 1) + ' ' + def.country;
    const secrets = def.secrets || [];

    // ── 魔王關的結構檢查 ──
    if (def.isBoss) {
      if (!def.boss) issues.push(tag + '：標記 isBoss 但沒有 boss 定義');
      if (!def.bossArena) issues.push(tag + '：魔王關缺 bossArena，玩家會跑出場外');
      if (def.boss) {
        const b = def.boss;
        if (b.left == null || b.right == null) {
          issues.push(tag + '：魔王沒有 left/right 活動範圍');
        } else {
          // v1.31 巴西足球的守門員本來就只守在球門前（只靠進球打他），不算
          if (b.right - b.left < 300 && b.pattern !== 'soccer') {
            issues.push(tag + '：魔王活動範圍只有 ' + (b.right - b.left) + 'px，太窄');
          }
          const a = def.bossArena;
          if (b.left < a.x || b.right > a.x + a.w) {
            issues.push(tag + '：魔王活動範圍超出競技場');
          }
        }
        if (!Sprites.bossKinds[b.kind]) {
          issues.push(tag + '：魔王外觀 kind="' + b.kind + '" 沒有對應繪製函式');
        }
        if (!b.hp || b.hp < 2) issues.push(tag + '：魔王 hp 太低，打一下就死沒有魔王感');

        // 魔王身體（含風車葉片這類外伸部件）不該穿過平台。
        // 魔王站在地上，身體佔 [GROUND_Y-h, GROUND_Y]；
        // 葉片/武器會往外伸，所以左右各留 40px 餘裕。
        if (b.left != null && b.right != null) {
          const bodyTop = Levels.GROUND_Y - (b.h || 86) - 50;  // 含頭頂葉片
          const sweep = {
            x: b.left - 40, y: bodyTop,
            w: (b.right - b.left) + (b.w || 76) + 80,
            h: Levels.GROUND_Y - bodyTop
          };
          (def.platforms || []).forEach(function (pf) {
            if (rects(sweep, pf)) {
              issues.push(tag + '：魔王行進範圍會穿過平台 x=' + pf.x + ' y=' + pf.y +
                '（把平台移出 [' + b.left + ',' + b.right + '] 或縮小魔王範圍）');
            }
          });
        }
      }
      // 魔王關地面要連續，否則玩家會掉進斷崖
      if (gapsOf(def).length > 0) {
        issues.push(tag + '：魔王關地面有斷崖，競技場應該是連續地面');
      }
      // 魔王關不該有終點旗需求（靠打倒魔王過關），但要有裝備來源
      if (Equipment.forLevel(li) && !def.equipAt) {
        issues.push(tag + '：魔王關沒有 equipAt，裝備拿不到');
      }
      // 掉落的裝備要讓站在地上的玩家碰得到。
      // 拾取框是以 equipAt 為中心的 30x30，玩家站著佔 [GROUND_Y-40, GROUND_Y]。
      if (def.equipAt) {
        const box = {
          x: def.equipAt.x - 15, y: def.equipAt.y - 15, w: 30, h: 30
        };
        const stand = {
          x: box.x, y: Levels.GROUND_Y - PH, w: PW, h: PH
        };
        const vertical = box.y < stand.y + stand.h && box.y + box.h > stand.y;
        if (!vertical) {
          issues.push(tag + '：魔王掉落的裝備 y=' + def.equipAt.y +
            ' 跟站立的玩家 [' + (Levels.GROUND_Y - PH) + ',' + Levels.GROUND_Y +
            '] 沒有交集，走過去撿不到');
        }
        if (def.bossArena) {
          const a = def.bossArena;
          if (box.x < a.x || box.x + box.w > a.x + a.w) {
            issues.push(tag + '：魔王掉落的裝備在競技場外');
          }
        }
      }
    }

    // ── 每一關都該有裝備來源 ──
    const eq = Equipment.forLevel(li);
    if (eq) {
      const inSecret = secrets.some(function (s) { return s.holdsEquip && s.equipAt; });
      if (!inSecret && !def.equipAt) {
        issues.push(tag + '：裝備 ' + eq.name + ' 沒有任何擺放位置');
      }
    }

    // ── 密道本身 ──
    secrets.forEach(function (s, si) {
      const label = tag + ' 密道#' + (si + 1);
      const r = s.room;
      if (!r) { issues.push(label + '：缺 room'); return; }

      // 1. 不可超出世界高度與關卡寬度
      //    垂直關卡的世界比畫面(480)高，要用 def.height。
      const worldH = worldHeightOf(def);
      if (r.y < 0 || r.y + r.h > worldH) {
        issues.push(label + '：垂直超出世界 (y=' + r.y + ' h=' + r.h +
          ' 世界高 ' + worldH + ')');
      }
      if (r.x < 0 || r.x + r.w > def.width) {
        issues.push(label + '：水平超出關卡範圍');
      }

      // 2. 密室要夠大，玩家站得進去
      if (r.h < PH + 16) {
        issues.push(label + '：高度 ' + r.h + ' 不足，玩家(' + PH + ')站不進去');
      }
      if (r.w < PW + 40) {
        issues.push(label + '：寬度 ' + r.w + ' 太窄');
      }

      // 3. 不可蓋在斷崖上
      gapsOf(def).forEach(function (g) {
        if (rects(r, g)) issues.push(label + '：蓋在斷崖上 (斷崖 x=' + g.x + ')');
      });

      // 4. 不可跟平台重疊（平台會穿進密室）
      (def.platforms || []).forEach(function (pf) {
        if (rects(r, pf)) {
          issues.push(label + '：跟平台重疊 (平台 x=' + pf.x + ' y=' + pf.y + ')');
        }
      });
      (def.movers || []).forEach(function (m) {
        // 移動平台取行程兩端的包圍盒
        const box = m.axis === 'x'
          ? { x: m.x - m.range, y: m.y, w: m.w + m.range * 2, h: m.h }
          : { x: m.x, y: m.y - m.range, w: m.w, h: m.h + m.range * 2 };
        if (rects(r, box)) issues.push(label + '：跟移動平台行程重疊 (x=' + m.x + ')');
      });

      // 5. 主線金幣不可被埋進假牆（未發現前拿不到，會被誤認為漏拿）
      (def.coins || []).forEach(function (c) {
        const box = { x: c.x, y: c.y, w: 24, h: 24 };
        if (rects(r, box)) {
          issues.push(label + '：主線金幣 (' + c.x + ',' + c.y + ') 被埋在密室內');
        }
      });

      // 6. 尖刺/水不可在密室內
      (def.spikes || []).concat(def.water || []).forEach(function (hz) {
        if (rects(r, hz)) issues.push(label + '：密室內有尖刺或水');
      });

      // 6b. 裝飾物件不可壓在密室上。
      //     props 畫在密室之後，發現密道後會看到桌椅/招牌浮在黑漆漆的密室裡。
      (def.props || []).forEach(function (p) {
        const pw = Sprites.propWidth[p.type] || 120;
        // 裝飾貼著它所在的地面，不是全關統一高度
        const pgy = groundTopAt(def, p.x);
        const pBase = pgy == null ? Levels.GROUND_Y : pgy;
        const box = { x: p.x - pw / 2, y: pBase - 120, w: pw, h: 120 };
        if (rects(r, box)) {
          issues.push(label + '：裝飾物 ' + p.type + ' (x=' + p.x +
            ') 壓在密室上，打開後會浮在室內');
        }
      });

      // 7. 敵人巡邏範圍不該重疊密室（會卡在牆裡）
      (def.enemies || []).forEach(function (e) {
        const ey = e.y == null ? Levels.GROUND_Y - 34 : e.y;
        const box = { x: e.left, y: ey - 10, w: Math.max(10, e.right - e.left), h: 54 };
        if (rects(r, box)) {
          issues.push(label + '：敵人巡邏範圍 (' + e.left + '-' + e.right + ') 穿進密室');
        }
      });

      const tr = s.trigger;
      if (!tr) { issues.push(label + '：缺 trigger'); return; }

      // ── 岔路密道（v1.9）：入口在地上，觸發區與裝備在空路上，另外驗 ──
      if (s.kind === 'branch') {
        if (!s.pad || !s.path || s.path.length < 3) { issues.push(label + '：岔路缺彈跳墊或空路'); return; }
        const mainSolids = (def.platforms || []).concat((def.movers || []).map(function (m) {
          return m.axis === 'x'
            ? { x: m.x - m.range, y: m.y, w: m.w + m.range * 2, h: m.h }
            : { x: m.x, y: m.y - m.range, w: m.w, h: m.h + m.range * 2 };
        }));
        s.path.forEach(function (pf, i) {
          if (pf.y < 90) issues.push(label + '：空路第 ' + (i + 1) + ' 塊太高，會被 HUD 擋住');
          if (pf.x + pf.w > def.width) issues.push(label + '：空路超出關卡寬度');
          // 上面要能站人、下面不能有主線平台（站在上面的人會卡頭）
          const room = { x: pf.x - 10, y: pf.y - PH - 6, w: pf.w + 20, h: PH + 6 + pf.h + PH + 8 };
          mainSolids.forEach(function (o) {
            if (rects(room, o)) issues.push(label + '：空路第 ' + (i + 1) + ' 塊跟主線平台 x=' + o.x + ' 太近');
          });
          (def.coins || []).forEach(function (c) {
            if (rects(pf, { x: c.x, y: c.y, w: 24, h: 24 })) issues.push(label + '：主線金幣被埋在空路平台裡');
          });
          if (i > 0) {
            const gap = pf.x - (s.path[i - 1].x + s.path[i - 1].w);
            if (gap > 150) issues.push(label + '：空路第 ' + i + '→' + (i + 1) + ' 塊間距 ' + gap + '，跳不過去');
          }
        });
        if (!rects(tr, s.path[0])) {
          const above = { x: s.path[0].x, y: s.path[0].y - PH, w: s.path[0].w, h: PH };
          if (!rects(tr, above)) issues.push(label + '：觸發區不在第一塊空路平台上');
        }
        const last = s.path[s.path.length - 1];
        if (s.holdsEquip) {
          const e = s.equipAt;
          if (!e || e.x < last.x || e.x > last.x + last.w || e.y > last.y || e.y < last.y - PH) {
            issues.push(label + '：裝備沒有放在空路盡頭的平台上');
          }
        }
        if (def.goal && last.x + last.w > def.goal - 200 && s.room.x < def.goal + 200) {
          issues.push(label + '：岔路跟終點旗重疊');
        }
        return;
      }

      // 8. 入口觸發區要在密室內，否則會「還沒走到就開」或「走進去開不了」
      if (tr.x < r.x || tr.x + tr.w > r.x + r.w ||
          tr.y < r.y || tr.y + tr.h > r.y + r.h) {
        issues.push(label + '：入口觸發區沒有完全落在密室內');
      }

      // 9. 入口要碰得到：觸發區必須跟「站在該處地面上的玩家」有交集。
      //    地面高度要查實際位置（關卡有起伏），不能用全關統一的 GROUND_Y。
      const localGround = groundTopAt(def, r.x + r.w / 2);
      const floorY = localGround == null ? Levels.GROUND_Y : localGround;
      const standTop = floorY - PH;
      const reachTop = standTop - 128;   // 跳起來約 128（見 level-check 實測）
      if (tr.y > floorY) {
        issues.push(label + '：入口在地面以下（地面 ' + floorY + '），走不進去');
      }
      if (tr.y + tr.h < reachTop) {
        issues.push(label + '：入口太高，跳不到 (y=' + tr.y + ')');
      }

      // 10. 密室裡的獎勵要在室內
      (s.coins || []).forEach(function (c) {
        const box = { x: c.x, y: c.y, w: 24, h: 24 };
        if (!(box.x >= r.x && box.x + box.w <= r.x + r.w &&
              box.y >= r.y && box.y + box.h <= r.y + r.h)) {
          issues.push(label + '：密室金幣 (' + c.x + ',' + c.y + ') 跑到室外');
        }
      });
      if (s.holdsEquip) {
        if (!s.equipAt) {
          issues.push(label + '：標記 holdsEquip 但沒給 equipAt');
        } else {
          const box = { x: s.equipAt.x - 15, y: s.equipAt.y - 15, w: 30, h: 30 };
          if (!(box.x >= r.x && box.x + box.w <= r.x + r.w &&
                box.y >= r.y && box.y + box.h <= r.y + r.h)) {
            issues.push(label + '：裝備位置跑到密室外');
          }
          // 裝備要在玩家構得到的高度（用密室所在的地面高度判斷）
          if (box.y + box.h > floorY + 2) {
            issues.push(label + '：裝備埋在地面以下（地面 ' + floorY + '），撿不到');
          }
        }
      }
    });

    /*
     * ── 隱形磚：真物理跑一次 ──
     *   1. 站在磚正下方的地面，按住跳 → 必須頂到（secretbump）
     *   2. 頂到之前，走進密室不會觸發；頂到之後走進去才會發現密道
     *   3. 磚那一欄不能有平台（會擋住跳躍）
     */
    secrets.forEach(function (s, si) {
      const label = tag + ' 密道#' + (si + 1);
      if (!s.block) { issues.push(label + '：沒有隱形磚，密道一開始就看得到'); return; }
      // v1.9.2 引路金幣：磚正下方要有一枚主線金幣（跳起來吃就會頂到磚）
      const guide = (def.coins || []).some(function (c) {
        return c.x + 12 > s.block.x && c.x + 12 < s.block.x + s.block.w &&
               c.y > s.block.y + s.block.h && c.y < s.block.y + s.block.h + 60;
      });
      if (!guide) issues.push(label + '：隱形磚底下沒有引路金幣，玩家很難發現');
      if (def.goal && s.room.x < def.goal + 150 && s.room.x + s.room.w > def.goal - 150) {
        issues.push(label + '：密室離終點旗太近（旗杆會插在密室上）');
      }
      // v1.31：碰到終點就過關，終點後面的密室（還有裡面的裝備）永遠拿不到
      if (def.goal && s.room.x > def.goal) issues.push(label + '：密室在終點後面（x=' + s.room.x + '，終點 ' + def.goal + '），拿不到');
      (def.platforms || []).forEach(function (pf) {
        const col = { x: s.block.x - 10, y: s.block.y, w: s.block.w + 20, h: Levels.GROUND_Y - s.block.y + 40 };
        if (rects(col, pf)) issues.push(label + '：隱形磚底下有平台擋著，跳不到');
      });

      const st = buildLevelState(def, li, [], Equipment.resolve([]));
      st.enemies = [];
      const p = st.player;
      const sc = st.secrets[si];
      const floorY = groundTopAt(def, s.block.x + s.block.w / 2);
      let held = {};
      const inp = {
        isDown: function (a) { return !!held[a]; },
        once: function (a) { return a === 'jump' && held.jumpOnce; },
        endFrame: function () {}
      };

      // 2a. 先直接走過密室（沒頂磚）：不該被發現
      p.x = s.room.x - 30; p.y = floorY - p.h; p.vy = 0;
      held = { right: true };
      let early = false;
      for (let f = 0; f < 90; f++) {
        const ev = updatePlayer(st, inp, f);
        if (ev.some(function (e) { return String(e).indexOf('secret:') === 0; })) early = true;
      }
      if (early) issues.push(label + '：還沒頂磚，走過去就發現密道了（不夠隱晦）');

      // 1. 站在磚下跳
      let bumped = false;
      if (def.autorun) {
        // v1.30 瑞典馴鹿雪橇：停不下來 → 改驗「衝過去時在磚前面起跳，頂得到」
        p.x = s.block.x - 200; p.y = floorY - p.h; p.vy = 0; p.vx = PHYS.MAX_RUN;
        let jumped = false;
        for (let f = 0; f < 120 && !bumped; f++) {
          const go = !jumped && p.onGround && p.x + p.w / 2 >= s.block.x - 24;
          if (go) jumped = true;
          held = { jump: jumped, jumpOnce: go };
          const ev = updatePlayer(st, inp, 100 + f);
          if (ev.indexOf('secretbump') >= 0) bumped = true;
        }
        if (!bumped) { issues.push(label + '：雪橇衝過去時在隱形磚前起跳，頂不到'); return; }
      } else {
      p.x = s.block.x + s.block.w / 2 - p.w / 2; p.y = floorY - p.h; p.vy = 0; p.vx = 0;
      for (let f = 0; f < 5; f++) { held = {}; updatePlayer(st, inp, f); }
      for (let f = 0; f < 60 && !bumped; f++) {
        held = { jump: true, jumpOnce: f === 0 };
        const ev = updatePlayer(st, inp, 100 + f);
        if (ev.indexOf('secretbump') >= 0) bumped = true;
      }
      if (!bumped) { issues.push(label + '：站在隱形磚下面跳，頂不到'); return; }
      }

      for (let f = 0; f < 60; f++) { held = {}; updatePlayer(st, inp, 200 + f); }

      // 2c. 岔路：走上彈跳墊 → 彈上空路 → 一路跳到盡頭拿裝備 → 再落回主線
      //     用沒有任何裝備的玩家跑（最基本的跳躍力），保證第一次來就走得完
      if (sc.kind === 'branch') {
        p.x = s.pad.x - 60; p.y = floorY - p.h; p.vy = 0; p.vx = 0;
        const last = sc.path[sc.path.length - 1];
        let sprung = false, found = false, gotEquip = false, landed = false, fell = false;
        const eqBefore = st.equip && st.equip.taken;
        for (let f = 0; f < 900; f++) {
          // 站在空路平台上、快到邊緣 → 起跳；其他時間一直往右
          const onPath = p.onGround && sc.path.some(function (pf) {
            return Math.abs(p.y + p.h - pf.y) < 2 && p.x + p.w > pf.x && p.x < pf.x + pf.w;
          });
          const curPf = onPath && sc.path.filter(function (pf) { return p.x + p.w > pf.x && p.x < pf.x + pf.w; })[0];
          const jumpNow = onPath && curPf !== last && p.x + p.w > curPf.x + curPf.w - 14;
          held = { right: true, jump: jumpNow || (!p.onGround && p.vy < 0), jumpOnce: jumpNow };
          const ev = updatePlayer(st, inp, 400 + f);
          if (ev.indexOf('spring') >= 0) sprung = true;
          if (ev.some(function (e) { return String(e).indexOf('secret:') === 0; })) found = true;
          if (ev.indexOf('equip') >= 0) gotEquip = true;
          if (ev.indexOf('fall') >= 0 || p.y > (def.height || 480)) { fell = true; break; }
          if (gotEquip && p.onGround && Math.abs(p.y + p.h - (groundTopAt(def, p.x + p.w / 2) || -999)) < 2) { landed = true; break; }
        }
        if (!sprung) issues.push(label + '：頂出磚之後，走上彈跳墊沒有被彈起來');
        else if (!found) issues.push(label + '：彈起來落不上空路第一塊平台（x=' + p.x.toFixed(0) + ' y=' + p.y.toFixed(0) + '）');
        else if (!gotEquip && !eqBefore && st.equip && st.equip.secretIdx === si) issues.push(label + '：走完空路沒拿到裝備（卡在 x=' + p.x.toFixed(0) + '）');
        else if (fell) issues.push(label + '：空路盡頭落下去是斷崖');
        else if (gotEquip && !landed) issues.push(label + '：拿完裝備沒有落回主線地面');
        return;
      }

      // 2b. 頂到之後走進密室：要發現
      //     （磚就在密室正上方，頂完落地通常直接落在門洞裡 → 當場就發現了，也算數）
      if (sc.found) return;
      p.x = s.room.x - 30; p.y = floorY - p.h; p.vy = 0;
      let found = false;
      for (let f = 0; f < 120 && !found; f++) {
        held = { right: true };
        const ev = updatePlayer(st, inp, 300 + f);
        if (ev.some(function (e) { return String(e).indexOf('secret:') === 0; })) found = true;
      }
      if (!found || !sc.found) issues.push(label + '：頂出磚之後走進密室，還是沒有發現密道');
    });

    // ── 密道之間不可互相重疊 ──
    for (let i = 0; i < secrets.length; i++) {
      for (let j = i + 1; j < secrets.length; j++) {
        if (secrets[i].room && secrets[j].room && rects(secrets[i].room, secrets[j].room)) {
          issues.push(tag + '：密道 #' + (i + 1) + ' 與 #' + (j + 1) + ' 重疊');
        }
      }
    }
  });

  // ── 敵人型別都要有對應的繪製與行為 ──
  Levels.list.forEach(function (def, li) {
    (def.enemies || []).forEach(function (e) {
      if (!ENEMY_KINDS[e.type]) {
        issues.push('關 ' + (li + 1) + '：敵人型別 "' + e.type + '" 未定義');
      }
      if (!Sprites.enemyKinds[e.type]) {
        issues.push('關 ' + (li + 1) + '：敵人型別 "' + e.type + '" 沒有繪製函式');
      }
      if (e.left == null || e.right == null) {
        issues.push('關 ' + (li + 1) + '：敵人 x=' + e.x + ' 沒有巡邏範圍');
      } else if (e.right <= e.left) {
        issues.push('關 ' + (li + 1) + '：敵人 x=' + e.x + ' 巡邏範圍反了');
      }
    });
  });

  // ── 踩不死的敵人要用遠程攻擊打（v1.18 拿掉揮擊），遠程攻擊來自英國關的板球 ──
  const rangedLevel = Equipment.defs.filter(function (d) { return d.id === 'brolly'; })[0].level;
  Levels.list.forEach(function (def, li) {
    if (li > rangedLevel) return;
    (def.enemies || []).forEach(function (e) {
      const k = ENEMY_KINDS[e.type];
      if (k && !k.stompable && li < rangedLevel) {
        // 踩不死又還沒有武器 → 只能繞過，必須確認不是擋路的唯一通道
        // 這裡只提示，不當錯誤（繞過是合理設計）
      }
    });
  });

  return { issueCount: issues.length, issues: issues };
}
