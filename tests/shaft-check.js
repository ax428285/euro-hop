/**
 * 豎井關檢查（「小朋友下樓梯」玩法）。
 *
 * 這個玩法的失敗模式跟橫向關卡完全不同，所以需要自己的測試：
 *
 *   A) 下一層太遠 → 玩家在下墜時間內橫移不到，只能站著等尖刺追上 = 無解
 *   B) 平台重疊／擠在一起 → 看起來一層其實兩層，踩起來很怪
 *   C) 平台超出井壁 → 畫在石壁裡，玩家踩不到
 *   D) 捲動速度 > 玩家能下降的速度 → 必死
 *   E) 抵達層拿不到 → 永遠不能過關
 *   F) 金幣擺在尖刺／彈簧上 → 引誘玩家去受傷，很惡意
 *
 * 最重要的是 G）**用真物理跑一次**：
 *   機器人朝「下一層」移動並往下掉，看能不能撐到抵達層。
 *   前面幾項都是靜態約束，只有真的跑過才知道「玩起來」行不行。
 *   （沿用之前的教訓：靜態連通性 ≠ 實際可通行。）
 *
 * 在瀏覽器執行 runShaftCheck()。
 */
function runShaftCheck() {
  const issues = [];
  const shaftLevels = [];
  Levels.list.forEach(function (lv, i) {
    if (lv.layout === 'shaft') shaftLevels.push({ idx: i, def: lv });
  });

  if (!shaftLevels.length) {
    return { issueCount: 1, issues: ['沒有任何豎井關卡'], levels: 0 };
  }

  const GRAV = PHYS.GRAVITY, MAX_RUN = PHYS.MAX_RUN, MAX_FALL = PHYS.MAX_FALL;

  shaftLevels.forEach(function (entry) {
    const def = entry.def;
    const pl = def.shaft;
    const tag = '關卡 ' + (entry.idx + 1) + '（' + def.country + '）';
    const floors = pl.platforms;

    // ── B) 平台不可重疊 ──
    for (let i = 0; i < floors.length; i++) {
      for (let j = i + 1; j < floors.length; j++) {
        const a = floors[i], b = floors[j];
        if (Math.abs(a.y - b.y) > 4) continue;
        if (a.x < b.x + b.w && b.x < a.x + a.w) {
          issues.push(tag + '：第 ' + a.floor + ' 與 ' + b.floor + ' 層重疊');
        }
      }
    }

    // ── C) 平台要在井內 ──
    floors.forEach(function (f) {
      if (f.x < pl.shaftX - 1 || f.x + f.w > pl.shaftX + pl.shaftW + 1) {
        issues.push(tag + '：第 ' + f.floor + ' 層超出井壁（x=' + f.x +
          ' w=' + f.w + '，井 ' + pl.shaftX + '~' + (pl.shaftX + pl.shaftW) + '）');
      }
    });

    /*
     * ── 相鄰層必須錯開足夠（只對 descend） ──
     *
     * 這是從實際卡關挖出來的約束：
     * 第 22 層 506~618 疊在第 23 層 511~623 上面，只錯開 5px。
     * 玩家站在上層時幾乎沒有縫隙可以走下去，而下一層是彈簧，
     * 於是「掉一點點 → 被彈回上層 → 再掉」無限循環，整關卡死。
     *
     * climb 模式不需要這條：往上爬是「跳上去」，平台可以從下方穿過
     * （oneWay），上下對齊完全沒問題 —— 事實上對齊還比較好跳。
     */
    if (pl.mode !== 'climb') {
      const MIN_EXPOSED = 26;
      for (let i = 1; i < floors.length; i++) {
        const up = floors[i - 1], dn = floors[i];
        const u0 = up.x, u1 = up.x + up.w;
        const d0 = dn.x, d1 = dn.x + dn.w;
        const leftSeg = Math.max(0, Math.min(d1, u0) - d0);
        const rightSeg = Math.max(0, d1 - Math.max(d0, u1));
        const exposed = Math.max(leftSeg, rightSeg);
        if (exposed < MIN_EXPOSED) {
          issues.push(tag + '：第 ' + dn.floor + ' 層只露出 ' + Math.round(exposed) +
            'px（被第 ' + up.floor + ' 層遮住），玩家找不到縫隙往下走' +
            (dn.type === 'spring' ? '，而且下一層是彈簧會無限彈回' : ''));
        }
      }
    }

    /*
     * ── climb 專屬：層距必須跳得上去 ──
     *
     * 基礎跳躍高度 = JUMP_V²/(2·GRAVITY)。層距若接近或超過這個值，
     * 沒有二段跳的玩家就上不去 —— 那是無解而不是難。
     * 留 25% 餘裕（玩家要邊跳邊橫移，不會每次都跳在最高點）。
     */
    if (pl.mode === 'climb') {
      // v1.30 丹麥積木塔（chargeJump）：蓄滿力的跳躍才是基準
      const jv = PHYS.JUMP_V * (def.chargeJump ? PHYS.CHARGE_HI : 1);
      const jumpH = (jv * jv) / (2 * GRAV);
      if (def.chargeJump && pl.gapY <= (PHYS.JUMP_V * PHYS.JUMP_V) / (2 * GRAV)) {
        issues.push(tag + '：蓄力跳關卡的層距 ' + pl.gapY + 'px，不蓄力也跳得上去，蓄力就沒意義了');
      }
      if (pl.gapY > jumpH * 0.75) {
        issues.push(tag + '：層距 ' + pl.gapY + 'px 超過安全跳躍高度 ' +
          Math.round(jumpH * 0.75) + 'px（基礎跳躍 ' + Math.round(jumpH) +
          'px），沒有二段跳的玩家爬不上去');
      }

      /*
       * 抵達層前的最後一層不可以是會塌的。
       *
       * 最後一躍要從它跳上終點；若它會塌掉，玩家踩上去還沒站穩就消失，
       * 於是在終點下方反覆掉落、永遠上不去
       * （實測第 26、27 層剛好都抽到 crumble，機器人卡到上限）。
       */
      /*
       * climb 完全不能有塌陷平台。
       *
       * 往上爬是單線通路：任何一層塌掉，上下層間距就變成兩倍層距
       * （實測 168px），遠超基礎跳躍高度 128px → 關卡變成無解。
       * descend 相反，塌掉剛好幫玩家往下走，所以只限制 climb。
       */
      const crumbles = floors.filter(function (f) { return f.type === 'crumble'; });
      if (crumbles.length) {
        issues.push(tag + '：有 ' + crumbles.length +
          ' 層塌陷平台（第 ' + crumbles.map(function (f) { return f.floor; }).join('、') +
          ' 層）。往上爬時塌掉會讓間距變兩倍，玩家永遠上不去');
      }

      /*
       * climb 專屬：相鄰層必須有足夠的水平重疊。
       *
       * 跟 descend 的「必須錯開」完全相反 —— 往上爬是跳上去的，
       * 若上下層只重疊幾 px，玩家得在上升的短短幾帧內橫移整個平台寬度，
       * 實際上做不到，會在兩層間反覆彈跳永遠上不去
       * （實測 25 層 333~441 與 26 層 227~335 只重疊 2px 就卡死）。
       */
      const MIN_OVERLAP = 24;
      for (let i = 1; i < floors.length; i++) {
        const lower = floors[i - 1], upper = floors[i];
        const ov = Math.min(lower.x + lower.w, upper.x + upper.w) -
                   Math.max(lower.x, upper.x);
        if (ov < MIN_OVERLAP) {
          issues.push(tag + '：第 ' + lower.floor + '→' + upper.floor +
            ' 層只重疊 ' + Math.round(ov) + 'px（需要 ' + MIN_OVERLAP +
            'px），往上跳時來不及橫移，爬不上去');
        }
      }
    }

    // ── A) 相鄰層的水平距離要在下墜時間內到得了 ──
    // 下墜 gapY 需時 t（等加速度），期間最多橫移 MAX_RUN * t。
    // 留 15% 餘裕，因為玩家還要加速到最高速。
    const fallFrames = Math.sqrt(2 * pl.gapY / GRAV);
    const reachable = MAX_RUN * fallFrames * 0.85;
    for (let i = 1; i < floors.length; i++) {
      const prev = floors[i - 1], cur = floors[i];
      // 水平「需要移動的距離」：兩平台最近緣的間距（有重疊就是 0）
      let dx = 0;
      if (cur.x > prev.x + prev.w) dx = cur.x - (prev.x + prev.w);
      else if (prev.x > cur.x + cur.w) dx = prev.x - (cur.x + cur.w);
      if (dx > reachable) {
        issues.push(tag + '：第 ' + prev.floor + '→' + cur.floor +
          ' 層水平距離 ' + Math.round(dx) + 'px，超過可達 ' +
          Math.round(reachable) + 'px，玩家跳不過去');
      }
    }

    // ── D) 捲速不能超過玩家的下降能力 ──
    // 玩家靠「踩一層、落下一層」推進，平均下降速度約 gapY / (下墜帧數 + 落地緩衝)
    const descendRate = pl.gapY / (fallFrames + 10);
    const maxScroll = Shaft.scrollAt(pl, pl.floors);
    if (maxScroll > descendRate * 0.8) {
      issues.push(tag + '：最終捲速 ' + maxScroll.toFixed(2) +
        ' 太快（玩家可下降 ' + descendRate.toFixed(2) + '/帧），追不上會必死');
    }

    // ── E) 抵達層必須存在、唯一、而且是「前進方向上的最後一層」──
    const goal = floors.filter(function (f) { return f.goal; });
    if (goal.length !== 1) {
      issues.push(tag + '：抵達層數量 = ' + goal.length + '，應為 1');
    } else {
      /*
       * 抵達層的「前方」不可以還有樓層，否則玩家會越過終點，
       * 永遠不會過關（實際發生過：產生器多排了 3 層）。
       *
       * ⚠️ 方向要跟著 mode 走。第一版寫死「y 比終點大就是多餘」，
       * 在 climb 模式下整整 28 層都在終點下方（終點在最上面），
       * 於是噴出「抵達層底下還有 28 層」的假警報。
       */
      const beyond = floors.filter(function (f) {
        return pl.dir < 0 ? f.y < goal[0].y - 1 : f.y > goal[0].y + 1;
      });
      if (beyond.length) {
        issues.push(tag + '：抵達層' + (pl.dir < 0 ? '上方' : '底下') +
          '還有 ' + beyond.length + ' 層，玩家會越過終點永遠無法過關');
      }
    }

    /*
     * ── 彈簧彈力不可超過層距 ──
     *
     * 彈起高度 = v²/(2g)。若大於 gapY，玩家會被彈回上一層、
     * 再掉回同一個彈簧 → 無限彈跳卡死（實際發生過）。
     */
    const sp = Shaft.TYPES.spring.bounce;
    const bounceH = (sp * sp) / (2 * GRAV);
    if (bounceH >= pl.gapY) {
      issues.push(tag + '：彈簧可彈起 ' + Math.round(bounceH) +
        'px，≥ 層距 ' + pl.gapY + 'px，玩家會無限彈跳卡死');
    }

    /*
     * 不可以有連續兩層彈簧。
     *
     * 即使單一彈簧的高度已壓在層距以下，兩層相鄰時還是會
     * 「上彈簧 ↔ 下彈簧」互相把玩家丟來丟去而卡死。
     */
    for (let i = 1; i < floors.length; i++) {
      if (floors[i].type === 'spring' && floors[i - 1].type === 'spring') {
        issues.push(tag + '：第 ' + floors[i - 1].floor + '、' + floors[i].floor +
          ' 層都是彈簧，玩家會在兩層之間彈來彈去卡死');
      }
    }

    // ── F) 金幣不可擺在尖刺／彈簧上 ──
    def.coins.forEach(function (c) {
      floors.forEach(function (f) {
        if (f.type !== 'spike' && f.type !== 'spring') return;
        // 金幣在這層正上方 40px 內
        if (c.y > f.y - 44 && c.y < f.y &&
            c.x + 24 > f.x && c.x < f.x + f.w) {
          issues.push(tag + '：金幣擺在 ' + f.type + ' 平台上方（第 ' +
            f.floor + ' 層），會引誘玩家受傷');
        }
      });
    });

    /*
     * ── 鐘擺不可以打到「站在平台上」的玩家 ──
     *
     * 設計意圖是「往下掉時要閃」，不是「站著也扣血」。
     * 整個擺動週期取樣，擺錘的圓不能碰到任何一層上方 40px（玩家身高）的站立區。
     */
    (pl.pendulums || []).forEach(function (pd) {
      for (let fr = 0; fr < 600; fr += 3) {
        const c = Shaft.pendulumPos(pd, fr);
        floors.forEach(function (f) {
          const top = f.y - 40, bot = f.y;
          const nx = U.clamp(c.x, f.x - 22, f.x + f.w + 22);
          const ny = U.clamp(c.y, top, bot);
          if (Math.hypot(c.x - nx, c.y - ny) < pd.r) {
            issues.push(tag + '：第 ' + pd.floor + ' 層的鐘擺會打到站在第 ' +
              f.floor + ' 層上的玩家（站著不動也扣血）');
            fr = 1e9;
          }
        });
      }
    });

    // 出生點要在第一層上面
    const f0 = floors[0];
    if (def.spawnX < f0.x - 10 || def.spawnX > f0.x + f0.w + 10) {
      issues.push(tag + '：出生點 x=' + def.spawnX + ' 不在第一層上方（' +
        f0.x + '~' + (f0.x + f0.w) + '）');
    }

    // ── G) 真物理跑一次 ──
    const sim = pl.mode === 'climb'
      ? playClimb(entry.idx, def)
      : playShaft(entry.idx, def);
    const verb = pl.mode === 'climb' ? '爬不到頂' : '下不到底';
    if (!sim.ok) {
      issues.push(tag + '：機器人' + verb + ' —— ' + sim.why +
        '（到第 ' + sim.deepest + '/' + pl.floors + ' 層，' +
        sim.frames + ' 帧，受傷 ' + sim.hurt + ' 次）');
    } else if (sim.hurt > 6) {
      issues.push(tag + '：機器人成功但受傷 ' + sim.hurt +
        ' 次，對一般玩家可能太難');
    }
  });

  /**
   * 攀登機器人（climb 模式）。
   *
   * 策略跟下降完全不同，所以寫成獨立的函式而不是在 playShaft 裡加
   * 一堆 if —— 下降是「找縫隙走出邊緣」，攀登是「對準上一層然後跳」。
   * 混在一起只會變成互相干擾的特例堆。
   *
   * 作法：
   *   1. 找「比自己高、最接近的」那一層當目標
   *   2. 水平對準它（平台可從下方穿過，所以直接瞄中心就好）
   *   3. 對準且在地面上就跳
   * 如果這樣都爬不上去，就是層距太大或水平距離太遠 —— 關卡設計問題。
   */
  function playClimb(levelIndex, def) {
    const stats = Equipment.resolve([]);
    const st = buildLevelState(def, levelIndex, [], stats);
    const pl = def.shaft;
    const p = st.player;

    let camY = Shaft.camStart(pl, Shaft.VIEW_H);
    st.shaft.camY = camY;
    let hurt = 0;
    let held = {};
    let wantJump = false;
    /*
     * 跳躍鍵要「按住」而不是點一下。
     *
     * ⚠️ 遊戲有可變跳躍高度：鬆開跳躍鍵就把上升速度乘 JUMP_CUT(0.42)。
     * 機器人若只實作 once('jump')、isDown('jump') 永遠回 false，
     * 初速 -12.6 會在同一帧被砍成 -5.29，只跳得起約 22px ——
     * 層距 84px 當然爬不上去（實測爬 25 層受傷 31 次就是這個原因）。
     * 真人會按住跳躍鍵，所以這裡用一個倒數計時器模擬按住 14 帧。
     */
    let jumpHold = 0, chargeCool = 0;
    const input = {
      isDown: function (a) {
        if (a === 'jump') return jumpHold > 0;
        return !!held[a];
      },
      once: function (a) { return a === 'jump' && wantJump; },
      endFrame: function () {}
    };

    const MAXF = 20000;
    for (let f = 0; f < MAXF; f++) {
      // 傳 p.y：climb 的相機要跟上爬得快的玩家（跟 game.js 一致）
      camY = Shaft.advanceCam(pl, camY, Shaft.VIEW_H, p.y,
        Shaft.chimeAt(pl, st.shaft.frame).boost);
      st.shaft.camY = camY;

      /*
       * 目標：比玩家「現在站的那層」更高的最近一層。
       *
       * ⚠️ 不能只用「比腳底高」當條件。站在某層上時腳底 == 該層的 y，
       * `fl.rect.y < feet - 4` 會把自己腳下那層也算進候選，
       * 於是機器人對準自己站的平台原地跳，永遠上不去
       * （實測在第 24 層原地跳到被雪崩追上，受傷 31 次）。
       * 門檻改成「要比腳底高出至少半層」，才確定是上面那一層。
       */
      const feet = p.y + p.h;
      const above = st.shaft.floors.filter(function (fl) {
        return !fl.gone && fl.rect.y < feet - pl.gapY * 0.5;
      }).sort(function (a, b) { return b.rect.y - a.rect.y; });
      const target = above[0] || null;

      held = {};
      wantJump = false;
      // 蓄力跳：放開的那一帧之後要等幾帧，不然同一帧又開始蓄力、永遠沒真的放開
      if (chargeCool > 0) chargeCool--;
      if (jumpHold > 0) { jumpHold--; if (jumpHold === 0 && def.chargeJump) chargeCool = 4; }

      if (target) {
        const t0 = target.rect.x, t1 = target.rect.x + target.rect.w;
        const px = p.x + p.w / 2;

        /*
         * 瞄點：目標平台上「離我最近、而且我站得到」的位置。
         *
         * ⚠️ 不能直接瞄目標平台的中心。
         * 實測：站在第 27 層（342~450）要上抵達層（216~744，中心 480），
         * 瞄中心會讓機器人往右走到 450 的邊緣外 → 掉下去 → 再爬上來 →
         * 又往右走⋯⋯無限循環（卡到 20000 帧上限）。
         *
         * 正確做法：站在平台上時，瞄點要夾在「目前平台」的範圍內 ——
         * 兩個平台 x 區間的交集就是「不用離開腳下平台就能起跳」的位置。
         * 沒有交集才需要走到自己平台的邊緣再跳過去。
         */
        const cur = p.onGround ? st.shaft.floors.filter(function (q) {
          return !q.gone && Math.abs((p.y + p.h) - q.rect.y) < 3 &&
                 p.x + p.w > q.rect.x && p.x < q.rect.x + q.rect.w;
        })[0] : null;

        let aim;
        if (cur) {
          const c0 = cur.rect.x, c1 = cur.rect.x + cur.rect.w;
          const lo = Math.max(t0, c0), hi = Math.min(t1, c1);
          if (lo <= hi) {
            // 有交集：留在腳下平台上，走到交集內離自己最近的點
            aim = U.clamp(px, lo + 6, hi - 6);
          } else {
            // 沒有交集：走到自己平台靠目標那一側的邊緣
            aim = t0 > c1 ? c1 - 8 : c0 + 8;
          }
        } else {
          aim = U.clamp(px, t0 + 6, t1 - 6);
        }

        /*
         * 已經站在最後一層、目標是終點平台時，裝備在終點正上方 ——
         * 直接瞄裝備的 x。
         *
         * ⚠️ 不加這段的話：機器人跳上終點時，x 停在「與上一層的交集」
         * 範圍內（約 300~400），但裝備在 x=480。
         * 過關條件要求裝備已入手，於是它站在終點上卻不前進、
         * 也不再有更高的目標可追，就在那裡耗到 20000 帧上限。
         */
        /*
         * ⚠️ 只有「站著」時才改瞄裝備（cur 有值）。
         * 跳在半空中、還沒落到最後一層時，「比腳底高半層」的目標會先變成終點 ——
         * 這時若去追裝備的 x，會飄出最後一層的範圍、沒接到就掉回好幾層
         * （v1.19 瑞士 calm 實測：第 26 層起跳 → 半空追 x=480 → 錯過第 27 層 → 掉回第 22 層，無限循環。
         * 以前有雪崩時被重生拉回來，看不出問題）。
         */
        if (target.goal && st.equip && !st.equip.taken && cur) {
          aim = U.clamp(st.equip.x, t0 + 6, t1 - 6);
          /*
           * ⚠️ 但還站在最後一層時，瞄點要夾在腳下平台內。
           * 不夾的話機器人會為了對準裝備直接走出平台邊緣掉下去
           * （終點平台很寬，從哪裡跳都上得去，沒必要先對準）。
           * 以前沒出事，是因為單向平台的側面碰撞會把下墜中的玩家
           * 「吸」到下層平台邊緣 —— 那正是瑞士關跳起來卡卡的 bug，已修掉。
           */
          if (cur) aim = U.clamp(aim, cur.rect.x + 8, cur.rect.x + cur.rect.w - 8);
        }

        const dx = aim - px;
        if (dx > 6) held.right = true;
        else if (dx < -6) held.left = true;
        // 對準了而且站著 → 跳，並按住 14 帧讓跳躍不被截斷
        // v1.30 蓄力跳：按住到「夠跳上目標」的蓄力帧數再放開（多留 25px 餘裕）
        if (p.onGround && Math.abs(dx) < 24 && jumpHold === 0 && chargeCool === 0) {
          if (def.chargeJump) {
            const need = (p.y + p.h) - target.rect.y + 25;
            const mul = Math.sqrt(2 * GRAV * need) / -PHYS.JUMP_V;
            const k = U.clamp((mul - PHYS.CHARGE_LO) / (PHYS.CHARGE_HI - PHYS.CHARGE_LO), 0, 1);
            jumpHold = Math.ceil(k * PHYS.CHARGE_MAX) + 2;
            wantJump = true;
          } else { wantJump = true; jumpHold = 14; }
        }
        if (def.chargeJump && p.onGround && jumpHold > 0) { held.left = held.right = false; }
      } else if (st.equip && !st.equip.taken) {
        // 已經到頂 → 去撿裝備（同 playShaft 的理由：不撿就不會過關）
        const dx = st.equip.x - (p.x + p.w / 2);
        if (dx > 3) held.right = true;
        else if (dx < -3) held.left = true;
      }

      updateShaftFloors(st);
      const evs = updatePlayer(st, input, f);
      // 亞特蘭提斯（潛水豎井）：空氣與噴口也要跑，嗆水算受傷
      if (st.features) Features.update(st, f).forEach(function (e) { if (/drown$/.test(e)) { hurt++; drowned++; } });

      if (evs.indexOf('hurt') >= 0 || evs.indexOf('spikefloor') >= 0 ||
          evs.indexOf('hazard') >= 0) hurt++;
      /*
       * 被危險區碰到要重生 —— 跟真實遊戲一致（game.js 的 loseLife(true)）。
       *
       * ⚠️ 少了這行會驗錯東西：雪崩會把玩家往上推，而 climb 的平台是
       * 單向的（可從下穿過），於是玩家被推著一路上升、永遠落不到地上、
       * 也沒辦法跳，只能一直受傷到上限。測試會回報「關卡無法通過」，
       * 但真實遊戲其實把他重生在平台上了。
       */
      if (evs.indexOf('hazard') >= 0) respawnInShaft(st, 90);
      if (evs.indexOf('fall') >= 0) {
        return { ok: false, why: '被推出畫面', deepest: st.shaft.deepest,
                 frames: f, hurt: hurt };
      }
      if (evs.indexOf('clear') >= 0 || st.cleared) {
        return { ok: true, deepest: st.shaft.deepest, frames: f, hurt: hurt };
      }
      if (hurt > 30) {
        return { ok: false, why: '受傷過多（' + hurt + ' 次）',
                 deepest: st.shaft.deepest, frames: f, hurt: hurt };
      }
    }
    return { ok: false, why: '超過 ' + MAXF + ' 帧還沒到頂',
             deepest: st.shaft.deepest, frames: MAXF, hurt: hurt };
  }

  /**
   * 豎井駕駛機器人。
   *
   * 策略刻意簡單（接近真人）：
   *   找「比自己低、且最接近的」那一層，朝它的中心水平移動。
   *   在上面就往下走（不跳）—— 這個玩法基本不需要跳躍，
   *   跳只會把自己送向尖刺天花板。
   * 如果這樣都下不去，就是關卡設計有問題。
   */
  function playShaft(levelIndex, def) {
    const stats = Equipment.resolve([]);
    const st = buildLevelState(def, levelIndex, [], stats);
    const pl = def.shaft;
    const p = st.player;

    let camY = Shaft.camStart(pl, Shaft.VIEW_H);
    st.shaft.camY = camY;
    let hurt = 0, drowned = 0;
    let held = {};
    const input = {
      isDown: function (a) { return !!held[a]; },
      once: function () { return false; },
      endFrame: function () {}
    };

    const MAXF = 20000;
    for (let f = 0; f < MAXF; f++) {
      // 相機推進：純自動捲動，不跟隨玩家（跟 game.js updateCamera 一致）。
      // 這裡若寫成「跟隨玩家」，掉出畫面的判定就永遠不會觸發，
      // 測試會把「玩家一路掉到井底外」當成通關。
      // 鐘聲加速也要算進來（跟 game.js 一致），否則測不到「趕路」那段
      camY = Shaft.advanceCam(pl, camY, Shaft.VIEW_H, undefined,
        Shaft.chimeAt(pl, st.shaft.frame).boost);
      st.shaft.camY = camY;

      // 選目標：比玩家腳底低、最接近的那一層
      /*
       * 選目標層：腳下最近的那一層。
       *
       * ⚠️ 但「不要瞄彈簧」。
       * 彈簧會把玩家往上彈，彈起後往下掉時，那片彈簧又變成
       * 「腳下最近的一層」→ 機器人再次對準它的中心 → 又被彈起。
       * 無限迴圈（實測關卡 7 第 30 層卡到 20000 帧上限）。
       *
       * 真人的做法是「越過彈簧，瞄它下面那一層」，
       * 落下過程中自然就會偏離彈簧。所以目標往下找一層。
       */
      const feet = p.y + p.h;
      const below = st.shaft.floors.filter(function (fl) {
        return !fl.gone && fl.rect.y >= feet + 2;
      }).sort(function (a, b) { return a.rect.y - b.rect.y; });

      let target = below[0] || null;
      if (target && target.type === 'spring' && below[1]) target = below[1];

      /*
       * 走位。
       *
       * 之前用「一堆特例」寫這段，每修一個情境就壞另一個
       * （瞄中心→卡在平台上不掉；把空中也算 cur→走出目標平台摔死；
       *  彈簧上不動→無限彈跳）。改成用明確的三個狀態來分流：
       *
       *   A. 站在平台上（onGround）
       *      → 目標是「走到可以掉下去的位置」：
       *        下一層露出於目前平台之外的那一段。
       *        完全被蓋住就走出最近的邊緣。
       *   B. 正在上升（vy < 0，被彈簧彈起或剛離開平台）
       *      → 腳下那片仍會接住我，所以要往它的外側移動，否則會彈回同一片。
       *   C. 正在下墜（vy >= 0 且不在地上）
       *      → 已經committed，直接瞄落點平台的中心，別再亂動。
       *
       * 關鍵是 B 與 C 用「上升 / 下墜」區分，而不是用距離 ——
       * 距離分不出「我剛從這片彈起來」與「我正要落到這片上」。
       */
      held = {};

      // 腳下那片平台（支撐我的，或我剛離開的）
      function footFloor() {
        return st.shaft.floors.filter(function (q) {
          if (q.gone) return false;
          const dy = q.rect.y - (p.y + p.h);
          return dy > -4 && dy < 80 &&
                 p.x + p.w > q.rect.x && p.x < q.rect.x + q.rect.w;
        })[0];
      }

      let aim = null;

      if (target) {
        const t0 = target.rect.x, t1 = target.rect.x + target.rect.w;

        if (p.onGround || p.vy < 0) {
          // 狀態 A / B：要離開腳下這片
          const cur = footFloor();
          if (cur) {
            const c0 = cur.rect.x, c1 = cur.rect.x + cur.rect.w;
            const leftSeg = Math.max(0, Math.min(t1, c0) - t0);
            const rightSeg = Math.max(0, t1 - Math.max(t0, c1));
            if (rightSeg >= leftSeg && rightSeg > 10) {
              aim = (Math.max(t0, c1) + t1) / 2;
            } else if (leftSeg > 10) {
              aim = (t0 + Math.min(t1, c0)) / 2;
            } else {
              // 下一層完全被蓋住 → 走出最近的邊緣
              const px0 = p.x + p.w / 2;
              aim = (px0 - c0 < c1 - px0) ? c0 - 22 : c1 + 22;
            }
          } else {
            aim = (t0 + t1) / 2;
          }
        } else {
          // 狀態 C：下墜中，瞄落點中心
          aim = (t0 + t1) / 2;
        }
      } else if (st.equip && !st.equip.taken) {
        /*
         * 沒有下一層了（已經在抵達層）→ 去撿裝備。
         *
         * ⚠️ 少了這段會卡死：抵達層是最後一層，target 變成 null，
         * 機器人就完全不動；而過關條件要求裝備已入手，
         * 於是站在終點平台上耗到 20000 帧上限
         * （實測關卡 3 到了第 26/26 層卻沒過關，就是這個原因）。
         */
        aim = st.equip.x;
      }

      if (aim != null) {
        const px = p.x + p.w / 2;
        if (aim - px > 3) held.right = true;
        else if (aim - px < -3) held.left = true;
      }
      /*
       * 節奏控制：真人不會一路往下衝。
       *
       * 兩個方向都要管：
       *   太快 → 比相機快很多，掉出畫面底部（實測第 9 層就掉出去）
       *   太慢 → 被尖刺天花板追上
       * 所以只有「畫面上半部」時才主動往下走；已經落到下半部就待著，
       * 讓相機追上來，再繼續降。
       *
       * ⚠️ 相機到抵達層會停（Shaft.maxCamY）。停住後若還在等相機，
       * 就永遠不往下 → 死鎖（實測跑到 20000 帧上限）。
       * 所以相機到底時解除這個限制。
       */
      const screenY = p.y - camY;
      const camDone = Shaft.camDone(pl, camY, Shaft.VIEW_H);
      // 站在尖刺樓梯上不能「原地等相機」——真人會立刻走開，原地等只會一直被刺
      const onSpike = st.shaft.floors.some(function (q) {
        return q.type === 'spike' && !q.gone && Math.abs((p.y + p.h) - q.rect.y) < 3 &&
               p.x + p.w > q.rect.x && p.x < q.rect.x + q.rect.w;
      });
      if (!camDone && p.onGround && !onSpike && screenY > Shaft.VIEW_H * 0.34) {
        /*
         * 等相機追上來。
         *
         * ⚠️ 不能單純放開按鍵（held = {}）。站在輸送帶上放手的話，
         * 輸送帶會把玩家一路推出平台邊緣，然後掉進空隙 ——
         * 實測機器人就是這樣從第 27 層（convL）被推下去，
         * 落點 x=352 完全不在下一層（460~556）範圍內而摔死。
         *
         * 真人會「抵著輸送帶站穩」。所以改成朝目前平台的中心微調，
         * 原地等待而不是被推走。
         */
        held = {};
        const cur2 = st.shaft.floors.filter(function (q) {
          return !q.gone && Math.abs((p.y + p.h) - q.rect.y) < 3 &&
                 p.x + p.w > q.rect.x && p.x < q.rect.x + q.rect.w;
        })[0];
        if (cur2) {
          const mid = cur2.rect.x + cur2.rect.w / 2;
          const px2 = p.x + p.w / 2;
          if (mid - px2 > 2) held.right = true;
          else if (mid - px2 < -2) held.left = true;
        }
      }

      updateShaftFloors(st);
      const evs = updatePlayer(st, input, f);
      // 亞特蘭提斯（潛水豎井）：空氣與噴口也要跑，嗆水算受傷
      if (st.features) Features.update(st, f).forEach(function (e) { if (/drown$/.test(e)) { hurt++; drowned++; } });

      if (evs.indexOf('hurt') >= 0 || evs.indexOf('spikefloor') >= 0 ||
          evs.indexOf('hazard') >= 0) hurt++;
      // 跟真實遊戲一致：被危險區碰到會重生（見 playClimb 的說明）
      if (evs.indexOf('hazard') >= 0) respawnInShaft(st, 90);
      if (evs.indexOf('fall') >= 0) {
        return { ok: false, why: '掉出畫面底部', deepest: st.shaft.deepest,
                 frames: f, hurt: hurt };
      }
      if (evs.indexOf('clear') >= 0 || st.cleared) {
        return { ok: true, deepest: st.shaft.deepest, frames: f, hurt: hurt, drowned: drowned };
      }
      // 受傷太多次等於死了（真人會沒命）
      if (hurt > 30) {
        return { ok: false, why: '受傷過多（' + hurt + ' 次）',
                 deepest: st.shaft.deepest, frames: f, hurt: hurt };
      }
    }
    return { ok: false, why: '超過 ' + MAXF + ' 帧還沒到底',
             deepest: st.shaft.deepest, frames: MAXF, hurt: hurt };
  }

  /*
   * 亞特蘭提斯（v1.24.2 改成往下潛的豎井，不在 Levels.list 裡）：同一個機器人潛到底，
   * 不能嗆水（噴口要夠密），也不能受傷太多次。
   */
  let dive = null;
  if (typeof Encounter !== 'undefined' && Encounter.boss) {
    const ddef = Encounter.makeDef(Encounter.boss('atlantis'));
    dive = playShaft(-1, ddef);
    if (!dive.ok) issues.push('亞特蘭提斯：機器人潛不到神殿 —— ' + dive.why + '（第 ' + dive.deepest + '/' + ddef.shaft.floors + ' 層，受傷 ' + dive.hurt + ' 次）');
    else if (dive.drowned) issues.push('亞特蘭提斯：照路線潛下去也會嗆水 ' + dive.drowned + ' 次（噴口太少）');
    else if (dive.hurt > 6) issues.push('亞特蘭提斯：機器人潛到了但受傷 ' + dive.hurt + ' 次，可能太難');
  }

  return {
    issueCount: issues.length,
    issues: issues,
    dive: dive,
    levels: shaftLevels.length
  };
}
