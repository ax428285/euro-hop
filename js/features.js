'use strict';

/**
 * 橫向關卡的「招牌機制」。
 *
 * 五個橫向關卡原本都是同一個產生器鋪出來的：地面、斷崖、兩層平台、
 * 移動平台、敵人 —— 換了皮，但玩起來差不多。這裡每國給一個只有那裡才有的機制，
 * 讓每一關中段都有一段「不一樣的事」：
 *
 *   stampede  西班牙  奔牛：中段一群公牛從後面衝過來，要一路往前跑或躲上平台
 *   bouncers  法國    咖啡館遮陽篷彈跳墊：踩上去彈很高，空中有額外金幣
 *   barrels   德國    滾動啤酒桶：從前方山坡滾下來，跳過去或踩碎
 *   dark      波蘭    維利奇卡鹽礦：一段漆黑的礦坑，只看得到自己身邊和礦燈
 *   geysers   匈牙利  溫泉間歇泉：定時噴發，站上去會被衝上天（可以拿來飛越河面）
 *
 * 規劃（plan）在關卡定義時用固定 seed 跑，結果可重現、可測試；
 * 執行期（update）每帧處理碰撞，事件格式跟玩家事件一樣帶 'p0:' 前綴。
 *
 * 載入順序：要在 levelgen.js 之後、levels.js 之前（levels.js 定義關卡時就要 plan）。
 */
const Features = (function () {

  const BULL_SPEED = 3.7;        // 比玩家最高跑速 4.6 慢：一直往前跑一定跑得掉
  const BULL_H = 46, BULL_W = 170;
  const PAD_V = -16.5;           // 彈跳墊初速（約彈起 220px）
  const GEYSER_V = -17;
  const GEYSER_CYCLE = 170;
  const BARREL_SPEED = 2.4;
  const BARREL_R = 15;

  // ── 規劃 ───────────────────────────────────────────────

  /**
   * 在地面上找一個「頭上淨空」的位置。
   * 彈跳墊、間歇泉會把人往上送，頭上有平台就會撞頭彈回來，所以那一欄要空。
   */
  function clearSpot(ctx, x, w, headroom) {
    const s = ctx.segs.filter(function (g) { return x >= g.x + 40 && x + w <= g.x + g.w - 40; })[0];
    if (!s) return null;
    const col = { x: x - 20, y: s.y - headroom, w: w + 40, h: headroom };
    const blocked = ctx.platforms.concat(ctx.avoid).some(function (b) {
      return col.x < b.x + b.w && col.x + col.w > b.x && col.y < b.y + b.h && col.y + col.h > b.y;
    });
    if (blocked) return null;
    if (Math.abs(x - ctx.goal) < 260) return null;
    return { x: x, y: s.y, seg: s };
  }

  /** 從偏好位置往兩側找第一個合格點 */
  function findSpot(ctx, prefer, w, headroom) {
    for (let d = 0; d < 1600; d += 20) {
      for (const sgn of [1, -1]) {
        const sp = clearSpot(ctx, Math.round(prefer + sgn * d), w, headroom);
        if (sp) return sp;
      }
    }
    return null;
  }

  /** 一串往上排的金幣（彈跳／間歇泉的獎勵） */
  function coinColumn(x, groundY, from, to, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ x: Math.round(x - 12), y: Math.round(groundY - from - (to - from) * i / (n - 1)) });
    }
    return out;
  }

  /**
   * cfg 例：{ type: 'bouncers', count: 4 }
   * ctx：{ segs, gaps, platforms, width, goal, avoid }
   * 回傳 { list: [...], coins: [...] }（coins 要併進關卡金幣）
   */
  function plan(cfgs, ctx) {
    const list = [], coins = [];
    (cfgs || []).forEach(function (c) {
      const W = ctx.width;
      if (c.type === 'stampede') {
        list.push({ type: 'stampede', x0: Math.round(W * (c.from || 0.42)), x1: Math.round(W * (c.to || 0.64)) });
      } else if (c.type === 'bouncers') {
        const n = c.count || 4;
        for (let i = 0; i < n; i++) {
          const sp = findSpot(ctx, W * (0.15 + 0.7 * i / Math.max(1, n - 1)), 56, 300);
          if (!sp) continue;
          list.push({ type: 'pad', x: sp.x, y: sp.y, w: 56, h: 10 });
          ctx.avoid.push({ x: sp.x - 60, y: 0, w: 176, h: 600 });
          coinColumn(sp.x + 28, sp.y, 130, 250, 4).forEach(function (q) { coins.push(q); });
        }
      } else if (c.type === 'barrels') {
        list.push({ type: 'barrels', x0: Math.round(W * 0.15), x1: Math.round(W * 0.85), every: c.every || 190 });
      } else if (c.type === 'dark') {
        const x0 = Math.round(W * (c.from || 0.5)), x1 = Math.round(W * (c.to || 0.7));
        const lamps = [];
        for (let x = x0 + 160; x < x1 - 80; x += 300) lamps.push(x);
        list.push({ type: 'dark', x0: x0, x1: x1, lamps: lamps });
      } else if (c.type === 'geysers') {
        // 優先放在斷崖（河面）前：噴起來剛好可以飛過去
        const prefers = ctx.gaps.map(function (g) { return g.x - 70; });
        const n = c.count || 4;
        for (let i = 0; i < n; i++) {
          const pref = prefers[Math.floor((i + 0.5) * prefers.length / n)] || W * (0.2 + 0.6 * i / n);
          const sp = findSpot(ctx, pref, 40, 300);
          if (!sp) continue;
          list.push({ type: 'geyser', x: sp.x, y: sp.y, w: 40, phase: i * 47 });
          ctx.avoid.push({ x: sp.x - 60, y: 0, w: 160, h: 600 });
          coinColumn(sp.x + 20, sp.y, 160, 260, 3).forEach(function (q) { coins.push(q); });
        }
      } else if (c.type === 'gusts') {
        // 斯洛伐克：塔特拉山風。一段區間內週期性起逆風
        list.push({ type: 'gusts', x0: Math.round(W * (c.from || 0.3)), x1: Math.round(W * (c.to || 0.8)) });
      } else if (c.type === 'cannons') {
        // 克羅埃西亞：杜布羅夫尼克城牆的砲台往城外砲擊
        list.push({ type: 'cannons', x0: Math.round(W * (c.from || 0.25)), x1: Math.round(W * (c.to || 0.85)), every: c.every || 130 });
      } else if (c.type === 'bridges') {
        // 塞爾維亞：河上的舊木橋。挑夠寬的斷崖架橋，踩上去一會兒就塌
        ctx.gaps.filter(function (g) { return g.w >= 90 && Math.abs(g.x - ctx.goal) > 300; })
          .slice(0, c.count || 6).forEach(function (g) {
            const ly = LevelGen.groundAt(ctx.segs, g.x - 4);
            const ry = LevelGen.groundAt(ctx.segs, g.x + g.w + 4);
            if (ly == null || ry == null || Math.abs(ly - ry) > 2) return;   // 只架在兩岸一樣高的斷崖
            list.push({ type: 'bridge', x: g.x - 6, y: ly, w: g.w + 12, h: 12 });
          });
      } else if (c.type === 'quicksand') {
        // 摩洛哥：撒哈拉流沙。平地上幾片沙坑，踩進去會變慢、跳不高、越陷越深
        const n = c.count || 6;
        for (let i = 0; i < n; i++) {
          const sp = findSpot(ctx, W * (0.12 + 0.76 * i / Math.max(1, n - 1)), SAND_W, 60);
          if (!sp || sp.x < 700) continue;
          list.push({ type: 'sand', x: sp.x, y: sp.y, w: SAND_W });
          ctx.avoid.push({ x: sp.x - 100, y: 0, w: SAND_W + 200, h: 600 });
        }
      } else if (c.type === 'thorns') {
        // 保加利亞：玫瑰荊棘，定時從地裡冒出來
        const n = c.count || 8;
        for (let i = 0; i < n; i++) {
          const sp = findSpot(ctx, W * (0.12 + 0.76 * i / Math.max(1, n - 1)), 80, 40);
          if (!sp || sp.x < 700) continue;
          list.push({ type: 'thorn', x: sp.x, y: sp.y, w: 80, phase: (i * 53) % 150 });
          ctx.avoid.push({ x: sp.x - 120, y: 0, w: 320, h: 600 });
        }
      }
    });
    return { list: list, coins: coins };
  }

  /*
   * 流沙（摩洛哥）：站在裡面每帧水平速度只剩 55%、起跳初速 ×0.7，
   * 身體慢慢往下陷（畫面上沙子淹到腳），陷滿 SAND_LIMIT 帧就受傷、被彈出來。
   * 全速走過 120px 寬的沙坑約 50 帧，遠低於 150 —— 一直走就不會受傷，停在裡面才會。
   */
  const SAND_W = 120;
  const SAND_LIMIT = 150;
  const SAND_MAX_RUN = 2.3;

  const GUST_CYCLE = 320;     // 一輪：安靜 → 預告 → 颳風
  const GUST_PUSH = 1.5;      // 逆風時每帧把地面上的玩家往回推幾 px（空中不推：跳躍距離不受影響）
  const THORN_CYCLE = 150;
  const SHELL_FUSE = 80;      // 砲彈從預告到落地的帧數

  /** 斯洛伐克山風：這一帧在不在颳 */
  function gustState(t) {
    const k = t % GUST_CYCLE;
    return k < 110 ? 'calm' : k < 150 ? 'warn' : 'blow';
  }

  /** 塌橋：還在不在 */
  function bridgeSolid(f) { return f.state !== 'fallen'; }

  /** 給 entities.js 的 solidsOf 用：招牌機制裡「可以站上去」的東西 */
  function solids(state) {
    const fs = state.features;
    if (!fs) return [];
    return fs.list.filter(function (f) { return f.type === 'bridge' && bridgeSolid(f); });
  }

  // ── 執行期 ─────────────────────────────────────────────

  function makeState(def) {
    return {
      list: (def.features || []).map(function (f) {
        const o = Object.assign({}, f);
        if (f.type === 'stampede') { o.active = false; o.done = false; o.front = 0; }
        if (f.type === 'barrels') { o.items = []; o.cd = 60; }
        if (f.type === 'cannons') { o.shells = []; o.cd = 60; o.seq = 0; }
        if (f.type === 'bridge') { o.state = 'ok'; o.timer = 0; }
        return o;
      }),
      seen: {}
    };
  }

  function groundTop(def, x) {
    const segs = def.groundSegs;
    if (!segs) return Levels.GROUND_Y;
    return LevelGen.groundAt(segs, x);
  }

  /** 讓玩家受傷（跟 updatePlayer 裡的規則一致：無敵帧內不重複） */
  function hurt(p, fromX, events, pid) {
    if (p.invuln > 0) return;
    p.invuln = 90 + (p.stats.invulnBonus || 0);
    p.vy = -6;
    p.vx = (fromX > p.x ? -1 : 1) * 4;
    events.push('p' + pid + ':hurt');
  }

  /** 玩家編號（事件前綴用）。P1 的 pid 是 0，不能寫成 p.pid || i */
  function pidOf(p, i) { return p.pid != null ? p.pid : i; }

  function launch(p, v, events, pid) {
    p.vy = v;
    p.onGround = false;
    p.coyote = 0;
    p.launched = true;
    events.push('p' + pid + ':spring');
  }

  function update(state, t) {
    const events = [];
    const fs = state.features;
    if (!fs) return events;
    const def = state.def;
    const players = state.players.filter(function (p) { return !p.out; });
    const lead = players.reduce(function (a, p) { return !a || p.x > a.x ? p : a; }, null);
    if (!lead) return events;
    players.forEach(function (p) { p.inSand = false; });

    fs.list.forEach(function (f) {
      // 第一次接近時發一個事件，game.js 顯示提示
      const near = f.x0 != null ? lead.x > f.x0 - 300 && lead.x < (f.x1 || f.x0) : Math.abs(lead.x - f.x) < 420;
      if (near && !fs.seen[f.type]) { fs.seen[f.type] = true; events.push('feature:' + f.type); }

      if (f.type === 'stampede') {
        if (!f.active && !f.done && lead.x > f.x0) {
          f.active = true;
          // 從畫面左邊外面衝進來（相機把玩家放在畫面 38% 處）
          f.front = lead.x - 420;
          events.push('stampede');
        }
        if (f.active) {
          f.front += BULL_SPEED;
          if (f.front > f.x1 + 300) { f.active = false; f.done = true; }
          const gy = groundTop(def, f.front) || Levels.GROUND_Y;
          f.box = { x: f.front - BULL_W, y: gy - BULL_H, w: BULL_W, h: BULL_H };
          players.forEach(function (p, i) {
            if (U.overlap(p, f.box)) hurt(p, f.front - BULL_W, events, pidOf(p, i));
          });
        }
      } else if (f.type === 'pad') {
        players.forEach(function (p, i) {
          const feet = p.y + p.h;
          if (p.onGround && Math.abs(feet - f.y) < 3 && p.x + p.w > f.x + 4 && p.x < f.x + f.w - 4) {
            launch(p, PAD_V, events, pidOf(p, i));
            f.squash = 10;
          }
        });
        if (f.squash > 0) f.squash--;
      } else if (f.type === 'geyser') {
        const k = (t + f.phase) % GEYSER_CYCLE;
        f.state = k < 70 ? 'idle' : k < 110 ? 'warn' : k < 150 ? 'erupt' : 'idle';
        if (f.state === 'erupt') {
          const col = { x: f.x, y: f.y - 260, w: f.w, h: 262 };
          players.forEach(function (p, i) {
            if (U.overlap(p, col) && p.vy > GEYSER_V + 2) launch(p, GEYSER_V, events, pidOf(p, i));
          });
        }
      } else if (f.type === 'gusts') {
        f.state = gustState(t);
        if (f.state === 'blow') {
          players.forEach(function (p) {
            /*
             * 坐在纜車上不吹（v1.20 斯洛伐克改纜車關）：纜車廂只有 96 寬，
             * 一陣風推 1.5px/帧 × 170 帧，一定被吹進山谷 —— 那不是挑戰是陷阱。
             * 改成纜車廂跟著風晃（畫面上，Sprites.gondola），在車站月台上才會被吹。
             */
            if (p.ridingMover) return;
            if (p.onGround && p.x > f.x0 && p.x < f.x1) p.x -= GUST_PUSH;
          });
        }
      } else if (f.type === 'cannons') {
        if (lead.x > f.x0 && lead.x < f.x1 && --f.cd <= 0) {
          f.cd = f.every;
          // 落點在玩家附近（偏前方），用序號錯開，不用 Math.random —— 結果可重現
          const tx = lead.x + lead.w / 2 + [-30, 140, 60, 220, 10, 180][f.seq++ % 6];
          const ty = groundTop(def, tx);
          if (ty != null) f.shells.push({ x: tx, y: ty, fuse: SHELL_FUSE });
        }
        f.shells.forEach(function (s) {
          if (--s.fuse === 0) {
            s.boom = 16;
            players.forEach(function (p, i) {
              const dx = Math.abs(p.x + p.w / 2 - s.x);
              if (dx < 36 && p.y + p.h > s.y - 70) hurt(p, s.x, events, pidOf(p, i));
            });
            events.push('cannon');
          }
          if (s.fuse < 0 && s.boom > 0) s.boom--;
        });
        f.shells = f.shells.filter(function (s) { return s.fuse > 0 || s.boom > 0; });
      } else if (f.type === 'bridge') {
        if (f.state === 'ok') {
          const on = players.some(function (p) {
            return p.onGround && Math.abs(p.y + p.h - f.y) < 3 && p.x + p.w > f.x && p.x < f.x + f.w;
          });
          if (on) { f.state = 'shaking'; f.timer = 36; events.push('creak'); }
        } else if (f.state === 'shaking') {
          if (--f.timer <= 0) { f.state = 'fallen'; f.timer = 260; events.push('collapse'); }
        } else if (--f.timer <= 0) {
          f.state = 'ok';                    // 過一陣子橋又「修好」（不然掉下去重生後就沒路了）
        }
      } else if (f.type === 'sand') {
        players.forEach(function (p) {
          const feet = p.y + p.h;
          if (p.onGround && Math.abs(feet - f.y) < 3 && p.x + p.w > f.x + 6 && p.x < f.x + f.w - 6) p.inSand = true;
        });
      } else if (f.type === 'thorn') {
        const k = (t + f.phase) % THORN_CYCLE;
        f.state = k < 80 ? 'bud' : k < 104 ? 'warn' : 'spike';
        if (f.state === 'spike') {
          const box = { x: f.x + 4, y: f.y - 22, w: f.w - 8, h: 22 };
          players.forEach(function (p, i) { if (U.overlap(p, box)) hurt(p, f.x + f.w / 2, events, pidOf(p, i)); });
        }
      } else if (f.type === 'barrels') {
        if (--f.cd <= 0) {
          f.cd = f.every;
          /*
           * 生在畫面右邊外面的地面上。
           * ⚠️ 不能只試一個固定距離：那裡剛好是斷崖就生不出來，
           * 玩家站著不動時每次都是同一點 → 整關一個桶子都沒有（實測就是這樣）。
           * 往前掃一段，找第一個有地面的位置。
           */
          /*
           * 而且要生在「跟玩家連在一起的地面」上：中間隔著斷崖的話，
           * 桶子還沒滾到就掉進坑裡，玩家一個都碰不到（德國關斷崖多，實測幾乎全掉坑）。
           * 從玩家腳下那段往右走，接得上的段落（沒有空隙）都算同一片地面。
           */
          const segs = def.groundSegs || [];
          let end = null;
          for (let i = 0; i < segs.length; i++) {
            const g = segs[i];
            if (end == null) {
              if (lead.x + lead.w / 2 >= g.x && lead.x + lead.w / 2 <= g.x + g.w) end = g.x + g.w;
            } else if (g.x <= end + 1) {
              end = g.x + g.w;
            } else break;
          }
          const sx = end == null ? null : Math.min(end - BARREL_R * 2 - 4, lead.x + 640);
          if (lead.x > f.x0 && sx != null && sx < f.x1 && sx > lead.x + 130) {
            // 從上方「翻下山坡」掉進來（離玩家可能不遠，從畫面上方落下才看得到它從哪來）
            const gy = groundTop(def, sx);
            if (gy != null) f.items.push({ x: sx, y: gy - 300, vy: 2, rot: 0, alive: true });
          } else {
            f.cd = 30;   // 這次生不出來（前面太快遇到斷崖），等一下再試
          }
        }
        f.items.forEach(function (b) {
          b.x -= BARREL_SPEED;
          b.rot -= BARREL_SPEED / BARREL_R;
          const gy = groundTop(def, b.x + BARREL_R);
          if (gy == null || b.y + BARREL_R * 2 < gy - 2) {
            // 滾出斷崖或從高處落下
            b.vy = Math.min(b.vy + 0.6, 12);
            b.y += b.vy;
            if (gy != null && b.y + BARREL_R * 2 >= gy) { b.y = gy - BARREL_R * 2; b.vy = 0; }
          } else {
            // 地面變高：小台階（≤ 36px）會「蹦」上去繼續滾；太高的牆就撞碎
            const step = (b.y + BARREL_R * 2) - gy;
            if (step > 36) { b.alive = false; return; }
            b.y = gy - BARREL_R * 2;
            if (step > 6) b.vy = -3;
          }
          if (b.y > (def.height || 480) + 40) b.alive = false;
          const box = { x: b.x + 2, y: b.y + 2, w: BARREL_R * 2 - 4, h: BARREL_R * 2 - 4 };
          players.forEach(function (p, i) {
            if (!b.alive || !U.overlap(p, box)) return;
            const stomping = p.vy > 0 && (p.y + p.h) - box.y < 14;
            if (stomping) {
              b.alive = false;
              p.vy = PHYS.STOMP_BOUNCE;
              events.push('p' + (pidOf(p, i)) + ':stomp');
            } else {
              hurt(p, b.x, events, pidOf(p, i));
            }
          });
        });
        f.items = f.items.filter(function (b) { return b.alive && b.x > lead.x - 900; });
      }
    });

    // 流沙的效果（所有沙坑判定完才算，避免站在兩片交界時被算兩次）
    players.forEach(function (p, i) {
      if (p.inSand) {
        p.sandT = (p.sandT || 0) + 1;
        /*
         * 走不快：速度上限 2.3（正常 4.6 的一半），走過 120px 約 52 帧。
         * ⚠️ 不能寫成每帧 vx *= 0.55：玩家每帧又加速 0.62，平衡點只有 0.76px/帧，
         * 走完一片沙坑要 158 帧 > SAND_LIMIT，等於「一定受傷」。
         */
        p.vx = U.clamp(p.vx, -SAND_MAX_RUN, SAND_MAX_RUN);
        if (p.sandT > SAND_LIMIT) {
          // 陷太深：受傷，順勢被彈出沙坑
          p.sandT = 0;
          hurt(p, p.x + p.w / 2 + (p.facing || 1) * -10, events, pidOf(p, i));
          events.push('p' + pidOf(p, i) + ':sinkout');
        }
      } else {
        // 剛從沙裡起跳的那一下：初速打折（跳不高）
        if (p.wasInSand && !p.onGround && p.vy < -9) p.vy *= 0.7;
        p.sandT = Math.max(0, (p.sandT || 0) - 4);   // 離開沙坑，下陷慢慢回復
      }
      p.wasInSand = p.inSand;
    });
    return events;
  }

  // ── 繪製 ───────────────────────────────────────────────

  function drawBull(ctx, x, y, t, k) {
    const bob = Math.abs(Math.sin(t * 0.35 + k)) * 3;
    ctx.save();
    ctx.translate(x, y - bob);
    ctx.fillStyle = '#2a1c16';
    U.roundRect(ctx, -30, -30, 52, 26, 10); ctx.fill();
    ctx.beginPath(); ctx.ellipse(26, -22, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#efe4c8';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(26, -30); ctx.quadraticCurveTo(36, -42, 40, -34); ctx.stroke();
    ctx.fillStyle = '#2a1c16';
    const leg = Math.sin(t * 0.5 + k) * 6;
    ctx.fillRect(-24 + leg, -6, 6, 6); ctx.fillRect(10 - leg, -6, 6, 6);
    ctx.fillStyle = '#ff6b5a';
    ctx.fillRect(28, -24, 3, 2);
    ctx.restore();
  }

  /**
   * layer：'bg'（只畫鹽礦岩壁，要在建築後面）或 'fg'（其他全部）。
   * ⚠️ 一定要傳完整的 state：山風要讀玩家位置。原本 game.js 傳的是
   * 只有 features 的包裝物件，斯洛伐克一進關就在這裡丟例外、整個畫面停住。
   */
  function drawWorld(ctx, state, camX, t, layer) {
    const fs = state.features;
    if (!fs) return;
    fs.list.forEach(function (f) {
      if (layer && (layer === 'bg') !== (f.type === 'dark')) return;
      if (f.type === 'pad') {
        const sx = f.x - camX;
        if (sx < -80 || sx > 1040) return;
        const sq = f.squash > 0 ? 4 : 0;
        // 咖啡館遮陽篷：紅白條紋的彈床
        ctx.fillStyle = '#5a4030';
        ctx.fillRect(sx + 4, f.y - 10 + sq, 4, 10 - sq);
        ctx.fillRect(sx + f.w - 8, f.y - 10 + sq, 4, 10 - sq);
        for (let i = 0; i < 7; i++) {
          ctx.fillStyle = i % 2 ? '#f4efe2' : '#c0392b';
          ctx.fillRect(sx + i * (f.w / 7), f.y - 14 + sq, f.w / 7 + 0.5, 6);
        }
        ctx.fillStyle = 'rgba(255, 220, 140, 0.7)';
        ctx.beginPath();
        ctx.moveTo(sx + f.w / 2 - 6, f.y - 24); ctx.lineTo(sx + f.w / 2, f.y - 32 - Math.sin(t * 0.15) * 3);
        ctx.lineTo(sx + f.w / 2 + 6, f.y - 24); ctx.fill();
      } else if (f.type === 'geyser') {
        const sx = f.x - camX;
        if (sx < -80 || sx > 1040) return;
        // 石砌泉口
        ctx.fillStyle = '#8c8070';
        ctx.fillRect(sx - 4, f.y - 8, f.w + 8, 8);
        ctx.fillStyle = '#5fb0c8';
        ctx.fillRect(sx + 4, f.y - 6, f.w - 8, 4);
        if (f.state === 'warn') {
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          for (let i = 0; i < 4; i++) {
            const by = f.y - 10 - ((t * 1.2 + i * 9) % 30);
            ctx.beginPath(); ctx.arc(sx + 8 + i * 8, by, 3, 0, Math.PI * 2); ctx.fill();
          }
        } else if (f.state === 'erupt') {
          const g = ctx.createLinearGradient(0, f.y - 260, 0, f.y);
          g.addColorStop(0, 'rgba(230, 245, 255, 0)');
          g.addColorStop(0.3, 'rgba(230, 245, 255, 0.75)');
          g.addColorStop(1, 'rgba(160, 220, 240, 0.95)');
          ctx.fillStyle = g;
          const wob = Math.sin(t * 0.6) * 3;
          ctx.beginPath();
          ctx.moveTo(sx + 4, f.y);
          ctx.quadraticCurveTo(sx - 10 + wob, f.y - 140, sx + f.w / 2, f.y - 262);
          ctx.quadraticCurveTo(sx + f.w + 10 - wob, f.y - 140, sx + f.w - 4, f.y);
          ctx.closePath(); ctx.fill();
        }
      } else if (f.type === 'barrels') {
        f.items.forEach(function (b) {
          const sx = b.x - camX;
          if (sx < -60 || sx > 1020) return;
          ctx.save();
          ctx.translate(sx + BARREL_R, b.y + BARREL_R);
          ctx.rotate(b.rot);
          ctx.fillStyle = '#8a5a30';
          ctx.beginPath(); ctx.arc(0, 0, BARREL_R, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#3a3a40';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(0, 0, BARREL_R - 2, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, BARREL_R * 0.45, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#c8a050';
          ctx.fillRect(-2, -BARREL_R + 3, 4, BARREL_R * 2 - 6);
          ctx.restore();
        });
      } else if (f.type === 'stampede' && f.active && f.box) {
        const bx = f.box.x - camX;
        // 塵土
        ctx.fillStyle = 'rgba(200, 170, 120, 0.45)';
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.arc(bx + i * 30 + Math.sin(t * 0.3 + i) * 6, f.box.y + 34 - (i % 2) * 10, 18, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let k = 0; k < 4; k++) {
          drawBull(ctx, bx + 30 + k * 38, f.box.y + BULL_H - (k % 2) * 4, t, k);
        }
      } else if (f.type === 'gusts') {
        const p = state.player;
        if (p.x < f.x0 - 200 || p.x > f.x1 + 200) return;
        // 預告：樹葉開始往左飄；颳風：整個畫面的風線
        const n = f.state === 'blow' ? 26 : f.state === 'warn' ? 8 : 0;
        for (let i = 0; i < n; i++) {
          const sx = 960 - ((t * (f.state === 'blow' ? 14 : 5) + i * 173) % 1100);
          const sy = 70 + (i * 61) % 320;
          if (f.state === 'blow') {
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 70, sy - 3); ctx.stroke();
          } else {
            ctx.fillStyle = 'rgba(120, 160, 70, 0.8)';
            ctx.beginPath(); ctx.ellipse(sx, sy + Math.sin(t * 0.1 + i) * 6, 4, 2, 0.6, 0, Math.PI * 2); ctx.fill();
          }
        }
      } else if (f.type === 'cannons') {
        f.shells.forEach(function (s) {
          const sx = s.x - camX;
          if (sx < -60 || sx > 1020) return;
          if (s.fuse > 0) {
            // 落點預告：地上的紅圈越縮越小
            const k = s.fuse / SHELL_FUSE;
            ctx.strokeStyle = 'rgba(255, 80, 70, ' + (0.9 - k * 0.5).toFixed(2) + ')';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(sx, s.y - 2, 12 + k * 24, 4 + k * 6, 0, 0, Math.PI * 2); ctx.stroke();
            if (s.fuse < 34) {
              const by = s.y - 8 - s.fuse * 11;
              ctx.fillStyle = '#2a2a30';
              ctx.beginPath(); ctx.arc(sx, by, 7, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#ff9a40'; ctx.fillRect(sx - 1, by - 10, 2, 4);
            }
          } else if (s.boom > 0) {
            ctx.fillStyle = 'rgba(255, 170, 70, ' + (s.boom / 16).toFixed(2) + ')';
            ctx.beginPath(); ctx.arc(sx, s.y - 12, 40 - s.boom, 0, Math.PI * 2); ctx.fill();
          }
        });
      } else if (f.type === 'sand') {
        // 流沙：比地面深一點的沙色、表面有慢慢轉的漩渦和冒泡（一眼看得出「這片不一樣」）
        const sx = f.x - camX;
        if (sx > 1000 || sx + f.w < -40) return;
        ctx.fillStyle = '#c08848';
        ctx.beginPath(); ctx.ellipse(sx + f.w / 2, f.y + 3, f.w / 2 + 4, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8b878';
        ctx.beginPath(); ctx.ellipse(sx + f.w / 2, f.y + 1, f.w / 2 - 4, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(140, 90, 40, 0.6)';
        ctx.lineWidth = 1.5;
        for (let r = 0; r < 3; r++) {
          const a = t * 0.03 + r * 2.1;
          ctx.beginPath();
          ctx.ellipse(sx + f.w / 2, f.y + 1, 12 + r * 14, 2.5 + r, 0, a, a + Math.PI * 1.2);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255, 230, 180, 0.8)';
        for (let b = 0; b < 3; b++) {
          const ph = (t * 0.05 + b * 1.7) % 3;
          if (ph < 1) {
            ctx.beginPath(); ctx.arc(sx + 24 + b * 34, f.y - ph * 4, 2 + ph * 2, 0, Math.PI * 2); ctx.fill();
          }
        }
      } else if (f.type === 'bridge') {
        if (f.state === 'fallen') return;
        const sx = f.x - camX + (f.state === 'shaking' ? Math.sin(t * 1.3) * 2 : 0);
        if (sx > 1000 || sx + f.w < -40) return;
        ctx.fillStyle = '#7a5a34';
        for (let x = 0; x < f.w; x += 14) ctx.fillRect(sx + x, f.y, 12, f.h);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(sx, f.y + f.h - 3, f.w, 3);
        ctx.strokeStyle = '#a08060'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(sx, f.y - 14); ctx.quadraticCurveTo(sx + f.w / 2, f.y - 4, sx + f.w, f.y - 14); ctx.stroke();
        ctx.fillStyle = '#5a3a20';
        ctx.fillRect(sx - 2, f.y - 18, 4, 18); ctx.fillRect(sx + f.w - 2, f.y - 18, 4, 18);
      } else if (f.type === 'thorn') {
        const sx = f.x - camX;
        if (sx < -100 || sx > 1060) return;
        // 平常是一排玫瑰花苞，預告時抖動，冒刺時一整排荊棘
        const shake = f.state === 'warn' ? Math.sin(t * 1.4) * 1.5 : 0;
        for (let i = 0; i < 5; i++) {
          const x = sx + 8 + i * 16 + shake;
          if (f.state === 'spike') {
            ctx.fillStyle = '#3f6a2e';
            ctx.beginPath(); ctx.moveTo(x - 5, f.y); ctx.lineTo(x, f.y - 22); ctx.lineTo(x + 5, f.y); ctx.fill();
            ctx.fillStyle = '#e04a6a';
            ctx.beginPath(); ctx.arc(x, f.y - 22, 3, 0, Math.PI * 2); ctx.fill();
          } else {
            ctx.fillStyle = '#4f7a3a';
            ctx.fillRect(x - 1, f.y - 7, 2, 7);
            ctx.fillStyle = f.state === 'warn' ? '#ff6a8a' : '#c8507a';
            ctx.beginPath(); ctx.arc(x, f.y - 8, 3, 0, Math.PI * 2); ctx.fill();
          }
        }
      } else if (f.type === 'dark') {
        // 鹽礦內部：岩壁 + 木頭支架 + 礦燈（畫在地形後面，當背景）
        const a = f.x0 - camX, b = f.x1 - camX;
        if (b < 0 || a > 960) return;
        ctx.fillStyle = '#3a3430';
        ctx.fillRect(a, 44, b - a, Levels.GROUND_Y - 44);
        ctx.fillStyle = 'rgba(220, 230, 240, 0.12)';
        for (let x = f.x0; x < f.x1; x += 70) {
          const sx = x - camX;
          ctx.beginPath();
          ctx.moveTo(sx, 140 + (x % 3) * 20); ctx.lineTo(sx + 12, 120 + (x % 5) * 10); ctx.lineTo(sx + 22, 150);
          ctx.fill();
        }
        ctx.fillStyle = '#6b4a2e';
        for (let x = f.x0 + 40; x < f.x1; x += 160) {
          const sx = x - camX;
          ctx.fillRect(sx, 70, 10, Levels.GROUND_Y - 70);
          ctx.fillRect(sx - 30, 64, 70, 10);
        }
        f.lamps.forEach(function (lx) {
          const sx = lx - camX;
          ctx.fillStyle = '#3a2a1e';
          ctx.fillRect(sx - 1, 74, 2, 30);
          ctx.fillStyle = '#ffd98a';
          ctx.beginPath(); ctx.arc(sx, 108, 6, 0, Math.PI * 2); ctx.fill();
        });
      }
    });
  }

  /**
   * 黑暗遮罩（鹽礦）：整個畫面蓋黑，只在玩家身邊與礦燈周圍挖光圈。
   * 用離屏畫布做（直接在主畫布 destination-out 會把底下的關卡一起挖掉）。
   *
   * ⚠️ 效能（v1.20.1 玩家回報：第 11 關手機版 lag）：
   *   舊版每帧在全解析度（960×480）的暗幕上，對「每一盞礦燈（含畫面外的）」各建一個放射漸層、
   *   用 destination-out 挖洞 —— 實測單是這一步就要 33ms/帧（整片塗滿一次才 1ms），手機直接掉幀。
   *   改成：
   *     1. 暗幕用 1/4 解析度畫，最後放大貼上（光圈本來就是柔邊，放大看不出差別；像素少 16 倍）
   *     2. 光圈只在第一次畫成一張小圖，之後每帧直接 drawImage（不再每帧 createRadialGradient）
   *     3. 畫面外的礦燈不挖
   */
  const DARK_SCALE = 0.25;
  let dark = null, darkCtx = null, holeImg = null;
  function makeHole() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 32 * 0.3, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return c;
  }
  function drawOverlay(ctx, state, camX, t, W, H) {
    const fs = state.features;
    if (!fs) return;
    /*
     * 流沙：陷進去的玩家，腳邊蓋一圈沙（畫在玩家之後，看起來就像身體陷進沙裡）。
     * 越久越高，快到上限時沙子變紅閃爍 —— 提醒玩家「要受傷了，快跳」。
     */
    (state.players || []).forEach(function (p) {
      if (p.out || !(p.sandT > 0)) return;
      const k = U.clamp(p.sandT / SAND_LIMIT, 0, 1);
      const sx = p.x + p.w / 2 - camX, gy = p.y + p.h;
      const hgt = 6 + k * 22;
      const warn = k > 0.7 && Math.floor(t / 6) % 2 === 0;
      ctx.fillStyle = warn ? '#d8704a' : '#e0ae70';
      ctx.beginPath(); ctx.ellipse(sx, gy + 2, 20, hgt, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = 'rgba(150, 100, 50, 0.5)';
      ctx.fillRect(sx - 20, gy, 40, 3);
    });
    fs.list.forEach(function (f) {
      if (f.type !== 'dark') return;
      const p = state.player;
      const pcx = p.x + p.w / 2;
      // 進出礦坑時漸暗/漸亮，不要瞬間黑掉
      const fadeIn = U.clamp((pcx - f.x0) / 200, 0, 1);
      const fadeOut = U.clamp((f.x1 - pcx) / 200, 0, 1);
      const k = Math.min(fadeIn, fadeOut);
      if (k <= 0) return;
      if (!dark) {
        if (typeof document === 'undefined' || !document.createElement) return;
        dark = document.createElement('canvas');
        dark.width = Math.ceil(W * DARK_SCALE); dark.height = Math.ceil(H * DARK_SCALE);
        darkCtx = dark.getContext('2d');
        holeImg = makeHole();
      }
      const d = darkCtx;
      if (!d) return;
      const S = DARK_SCALE;
      d.globalCompositeOperation = 'source-over';
      d.clearRect(0, 0, dark.width, dark.height);
      d.fillStyle = 'rgba(4, 4, 10, ' + (0.93 * k).toFixed(3) + ')';
      d.fillRect(0, 0, dark.width, dark.height);
      d.globalCompositeOperation = 'destination-out';
      function hole(x, y, r) {
        if (x + r < 0 || x - r > W) return;          // 畫面外不挖
        d.drawImage(holeImg, (x - r) * S, (y - r) * S, r * 2 * S, r * 2 * S);
      }
      state.players.forEach(function (q) {
        if (!q.out) hole(q.x + q.w / 2 - camX, q.y + q.h / 2, 150 + Math.sin(t * 0.1) * 4);
      });
      f.lamps.forEach(function (lx) { hole(lx - camX, 108, 110); });
      d.globalCompositeOperation = 'source-over';
      ctx.drawImage(dark, 0, 0, W, H);
    });
  }

  return {
    plan: plan,
    solids: solids,
    gustState: gustState,
    GUST_PUSH: GUST_PUSH,
    makeState: makeState,
    update: update,
    drawWorld: drawWorld,
    drawOverlay: drawOverlay,
    BULL_SPEED: BULL_SPEED,
    PAD_V: PAD_V,
    GEYSER_V: GEYSER_V
  };
})();
