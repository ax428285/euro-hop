'use strict';

/**
 * 羽球關（v1.31 玩家：保加利亞換成羽球玩法）—— 保加利亞・玫瑰谷的露天球場。
 *
 * 從側面看的羽球場：你在左半場，對手（玫瑰谷羽球隊長）在右半場，中間是網子。
 *   ←→ 移動、跳躍 = 跳起來。球（羽毛球）飛到身邊就自動揮拍：
 *     一般 = 高遠球（打到對手的後場）
 *     按住 ↓ = 網前小球（輕輕吊過網，落在對手的前場）
 *     跳起來、球在頭上的時候打到 = 殺球（又快又往下，對手很難接）
 *   球落在誰那一邊，對方得一分；打出界（超過底線）算打的人失分；過不了網也是失分。
 *   先拿 MATCH 分就贏了（過關）。對手先拿到 MATCH 分 → 扣一顆愛心，比分歸零重來。
 *   金幣：每贏一分 1 枚（最多 MATCH 枚）＋ 前 SMASH_COINS 次殺球得分各 1 枚。
 *
 * 由 race.js 轉發（def.race.view === 'badminton'），對外介面跟 Race 一樣：plan / makeState / update / draw。
 * 載入順序：race.js 之前（levels.js 定義關卡時就要 plan）。
 */
const Badminton = (function () {

  const GY = 420;                 // 地面
  const NET_X = 480, NET_TOP = GY - 84;
  const LEFT_MIN = 40, LEFT_MAX = NET_X - 26, RIGHT_MIN = NET_X + 26, RIGHT_MAX = 920;
  const BASE_L = 22, BASE_R = 938;   // 底線（超過就出界）
  const G = 0.17, DRAG = 0.992;
  const P_SPEED = 5, AI_SPEED = 3.3;
  const AI_HOME = 740;            // 對手打完回到偏後場的位置等 → 網前小球是你的武器
  const P_JUMP = 10, P_G = 0.5;
  const REACH = 50;
  const MATCH = 5, SMASH_COINS = 3;

  /** 亂數存成數字放在狀態裡（連線時狀態要能轉成 JSON，不能放函式） */
  function rnd(rs) { rs.seed = (rs.seed * 16807) % 2147483647; return (rs.seed - 1) / 2147483646; }

  function plan(cfg) {
    const coins = [];
    for (let k = 0; k < MATCH + SMASH_COINS; k++) coins.push({ k: k });
    return { view: 'badminton', coins: coins, seed: cfg.seed || 1, aiSpeed: cfg.aiSpeed || AI_SPEED, finish: 1 };
  }

  function makeState(def) {
    const pl = def.race;
    const rs = {
      bad: true, seed: (pl.seed * 31 + 7) % 2147483646 + 1,
      me: { x: 200, y: GY, vy: 0, air: false, swing: 0, facing: 1 },
      ai: { x: 760, y: GY, vy: 0, air: false, swing: 0, react: 0, tx: 760, wantJump: false },
      sh: null, last: null, server: 'me', serveT: 70, rally: 0,
      score: [0, 0], coinsTaken: {}, pointCoins: 0, smashCoins: 0, lastShot: null,
      msg: null, done: false, seen: {}, hurtT: 0, invuln: 0, lostMatches: 0
    };
    placeServe(rs);
    return rs;
  }

  function placeServe(rs) {
    const who = rs.server === 'me' ? rs.me : rs.ai;
    rs.sh = { x: who.x + (rs.server === 'me' ? 18 : -18), y: GY - 60, vx: 0, vy: 0, held: true };
    rs.last = null; rs.serveT = rs.server === 'me' ? 90 : 60; rs.rally = 0;
    rs.me.x = 200; rs.ai.x = 760; rs.ai.react = 0;
  }

  /**
   * 從 (x, y) 打到落點 tx：先試 T 帧飛到，過不了網就把弧線拉高（T 加大）。
   * 不算空氣阻力的拋物線，阻力讓球實際短一點點 —— 目標點本身就留了餘裕。
   */
  function aim(x, y, tx, T, down) {
    for (let k = 0; k < 14; k++, T += 8) {
      let vx = (tx - x) / T;
      const vy = (GY - y - 0.5 * G * T * T) / T;
      if (down && vy < 0 && k < 3) continue;     // 殺球：一定要往下打
      // 有空氣阻力：實際模擬一次，把水平速度按比例修正到落點對準 tx（修兩次就很準了）
      let r = fly(x, y, vx, vy);
      for (let j = 0; j < 3; j++) { if (Math.abs(r.x - x) > 1) vx *= (tx - x) / (r.x - x); r = fly(x, y, vx, vy); }
      if (r.netY != null && r.netY > NET_TOP - 14) continue;   // 過不了網 → 弧線拉高再試
      return { vx: vx, vy: vy };
    }
    return { vx: (tx - x) / 70, vy: -7.5 };
  }

  /** 照實際的物理飛一次：回傳落點 x、過網時的高度 */
  function fly(x, y, vx, vy) {
    let netY = null;
    for (let i = 0; i < 500; i++) {
      vy += G; vx *= DRAG; vy *= DRAG;
      const px = x; x += vx; y += vy;
      if (netY == null && (px - NET_X) * (x - NET_X) <= 0) netY = y;
      if (y >= GY - 4) return { x: x, netY: netY, t: i };
    }
    return { x: x, netY: netY, t: 500 };
  }

  /** 模擬球會落在哪裡（AI 跟測試機器人用） */
  function predict(sh) {
    let x = sh.x, y = sh.y, vx = sh.vx, vy = sh.vy;
    for (let i = 0; i < 400; i++) {
      vy += G; vx *= DRAG; vy *= DRAG; x += vx; y += vy;
      if (y >= GY - 30) return { x: x, t: i };
    }
    return { x: x, t: 400 };
  }

  function point(state, rs, winner, events, why) {
    rs.sh = null;
    const meWin = winner === 'me';
    rs.score[meWin ? 0 : 1]++;
    rs.server = winner;
    rs.msg = { text: meWin ? (why || '得分！') : (why || '對手得分'), good: meWin, life: 80 };
    if (meWin) {
      if (rs.pointCoins < MATCH) { rs.pointCoins++; state.coinsGot++; events.push('coin'); rs.coinsTaken[rs.pointCoins - 1] = true; }
      if (rs.lastShot === 'smash' && rs.smashCoins < SMASH_COINS) { rs.smashCoins++; state.coinsGot++; events.push('coin'); rs.coinsTaken[MATCH + rs.smashCoins - 1] = true; }
    }
    events.push(meWin ? 'bad:point' : 'bad:lose');
    rs.pause = 70;
  }

  function hit(rs, who, kind, events) {
    const sh = rs.sh, me = who === 'me';
    let tx, T;
    if (kind === 'smash') { tx = me ? NET_X + 120 + rnd(rs) * 260 : NET_X - 120 - rnd(rs) * 260; T = 22; }
    else if (kind === 'drop') { tx = me ? NET_X + 50 + rnd(rs) * 70 : NET_X - 40 - rnd(rs) * 60; T = 56; }
    else { tx = me ? 760 + rnd(rs) * 140 : 70 + rnd(rs) * 120; T = 78; }
    // 對手會失誤：來回越久越容易（打出底線或打太短掛網）—— 不然高遠球對高遠球會一直打下去
    if (!me && rnd(rs) < 0.025 + rs.rally * 0.008) { if (rnd(rs) < 0.5) tx = -40; else { tx = NET_X + 10; T = 18; } }
    const v = T === 18 && !me ? { vx: -3, vy: 0.5 } : aim(sh.x, sh.y, tx, T, kind === 'smash');
    sh.vx = v.vx; sh.vy = v.vy; sh.held = false;
    rs.last = who; rs.lastShot = kind; rs.rally++;
    (me ? rs.me : rs.ai).swing = 14;
    events.push(kind === 'smash' ? 'bad:smash' : 'bad:hit');
    if (me && kind === 'smash' && !rs.seen.smash) { rs.seen.smash = true; }
    // 對手看到球過來要反應一下才動（殺球反應更慢）
    if (me) { rs.ai.react = kind === 'smash' ? 12 : 8; rs.ai.tx = predict(sh).x + 14; }
  }

  function canReach(p, sh) { return Math.hypot(sh.x - p.x, sh.y - (p.y - 38)) < REACH; }

  function update(state, input, t) {
    const events = [];
    const pl = state.def.race, rs = state.race, p = state.player, st = p.stats || {};
    if (rs.done) return events;
    if (!rs.seen.start) { rs.seen.start = true; events.push('feature:badminton'); }
    if (rs.msg && --rs.msg.life <= 0) rs.msg = null;
    if (rs.invuln > 0) rs.invuln--;
    p.invuln = rs.invuln;
    const me = rs.me, ai = rs.ai;
    // ── 你 ──
    let dir = 0;
    if (input.isDown('left')) dir -= 1;
    if (input.isDown('right')) dir += 1;
    me.x = U.clamp(me.x + dir * P_SPEED * Math.min(1.15, st.speed || 1), LEFT_MIN, LEFT_MAX);
    if (dir) me.facing = 1;
    if (!me.air && input.once('jump') && !(rs.sh && rs.sh.held && rs.server === 'me')) {
      me.air = true; me.vy = -P_JUMP * (1 + (st.jumpBoost || 0) * 0.04); events.push('jump');
    }
    if (me.air) { me.vy += P_G; me.y += me.vy; if (me.y >= GY) { me.y = GY; me.air = false; me.vy = 0; } }
    if (me.swing > 0) me.swing--;
    me.walk = dir ? (me.walk || 0) + 1 : 0;
    // ── 對手 ──
    if (ai.swing > 0) ai.swing--;
    if (ai.react > 0) ai.react--;
    else if (rs.sh && !rs.sh.held && rs.last === 'me') {
      const tx = U.clamp(ai.tx, RIGHT_MIN, RIGHT_MAX);
      if (Math.abs(tx - ai.x) > 3) ai.x += Math.sign(tx - ai.x) * Math.min(pl.aiSpeed, Math.abs(tx - ai.x));
    } else if (!rs.sh || rs.last === 'ai') {
      // 回到場中間等
      if (Math.abs(AI_HOME - ai.x) > 3) ai.x += Math.sign(AI_HOME - ai.x) * 2.2;
    }
    ai.x = U.clamp(ai.x, RIGHT_MIN, RIGHT_MAX);
    if (ai.air) { ai.vy += P_G; ai.y += ai.vy; if (ai.y >= GY) { ai.y = GY; ai.air = false; ai.vy = 0; } }
    // ── 換下一分之前的停頓 ──
    if (rs.pause > 0) {
      if (--rs.pause === 0) {
        if (rs.score[0] >= MATCH) {
          rs.done = true;
          if (state.equip && !state.equip.taken) { state.equip.taken = true; events.push('equip'); }
          state.cleared = true; events.push('clear');
          return events;
        }
        if (rs.score[1] >= MATCH) {
          // 輸了這一局：扣一顆愛心，比分歸零重來（已經拿到的金幣不會不見）
          rs.lostMatches++;
          rs.score = [0, 0]; rs.server = 'me';
          rs.invuln = 60;
          events.push('p0:hurt');
          rs.msg = { text: '這一局輸了⋯⋯比分歸零，再來一局！', good: false, life: 140 };
        }
        placeServe(rs);
      }
      return events;
    }
    const sh = rs.sh;
    if (!sh) return events;
    // ── 發球 ──
    if (sh.held) {
      const who = rs.server === 'me' ? me : ai;
      sh.x = who.x + (rs.server === 'me' ? 18 : -18); sh.y = who.y - 60;
      if (rs.server === 'me') {
        if (input.once('jump') || input.once('throw') || --rs.serveT <= 0) hit(rs, 'me', 'clear', events);
      } else if (--rs.serveT <= 0) {
        hit(rs, 'ai', rnd(rs) < 0.3 ? 'drop' : 'clear', events);
      }
      return events;
    }
    // ── 球的飛行 ──
    const px = sh.x;
    sh.vy += G; sh.vx *= DRAG; sh.vy *= DRAG;
    sh.x += sh.vx; sh.y += sh.vy;
    // 掛網
    if ((px - NET_X) * (sh.x - NET_X) <= 0 && sh.y > NET_TOP) {
      sh.x = px; sh.vx = -sh.vx * 0.15;
      point(state, rs, rs.last === 'me' ? 'ai' : 'me', events, rs.last === 'me' ? '掛網⋯⋯對手得分' : '對手掛網！得分');
      return events;
    }
    // 落地
    if (sh.y >= GY - 4) {
      const out = sh.x < BASE_L || sh.x > BASE_R;
      let winner;
      if (out) winner = rs.last === 'me' ? 'ai' : 'me';
      else winner = sh.x < NET_X ? 'ai' : 'me';
      point(state, rs, winner, events, out ? (winner === 'me' ? '對手出界！得分' : '出界了⋯⋯對手得分')
                                    : (winner === 'me' ? (rs.lastShot === 'smash' ? '殺球得分！' : '得分！') : '沒接到⋯⋯對手得分'));
      return events;
    }
    // ── 揮拍：你 ──
    if (rs.last !== 'me' && sh.x < NET_X && canReach(me, sh)) {
      const kind = me.air && sh.y < me.y - 50 ? 'smash' : input.isDown('down') ? 'drop' : 'clear';
      hit(rs, 'me', kind, events);
      if (kind === 'smash' && !rs.seen.smashTip) { rs.seen.smashTip = true; }
    }
    // ── 揮拍：對手 ──
    else if (rs.last !== 'ai' && sh.x > NET_X && ai.react <= 0) {
      // 球高、又在網前 → 跳起來殺
      if (!ai.air && sh.vy > -1 && sh.y < GY - 110 && sh.y > GY - 170 && Math.abs(sh.x - ai.x) < 40 && sh.x < 680 && rnd(rs) < 0.02) { ai.air = true; ai.vy = -P_JUMP; }
      if (canReach(ai, sh)) {
        // 殺球太快的話有機會接不到
        if (rs.lastShot === 'smash' && rnd(rs) < 0.45) { ai.react = 999; }
        // 往你不在的地方打：你在後場就吊網前、你在網前就打後場（偶爾反其道而行）
        else {
          const back = me.x < 250;
          hit(rs, 'ai', ai.air ? 'smash' : (back ? rnd(rs) < 0.7 : rnd(rs) < 0.15) ? 'drop' : 'clear', events);
        }
      }
    }
    if (ai.react === 999 && (!rs.sh || rs.last !== 'me')) ai.react = 0;
    return events;
  }

  // ── 繪製 ────────────────────────────────────────────────

  function drawRacket(ctx, x, y, dir, swing) {
    const a = swing > 0 ? -1.6 + (14 - swing) / 14 * 2.6 : -0.9;
    ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.rotate(a);
    ctx.strokeStyle = '#3a3a40'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -16); ctx.stroke();
    ctx.strokeStyle = '#d8303a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -24, 7, 9, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.6;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 2.6, -32); ctx.lineTo(k * 2.6, -16); ctx.stroke(); }
    ctx.restore();
  }

  function drawPerson(ctx, pp, who, p, t) {
    const opp = who === 'ai';
    Sprites.player(ctx, { x: pp.x - 11, y: pp.y - 40, w: 22, h: 40, facing: opp ? -1 : 1, onGround: !pp.air,
                          vx: pp.walk ? 1 : 0, invuln: opp ? 0 : p.invuln, pid: opp ? 1 : (p.pid || 0),
                          equipped: opp ? {} : (p.equipped || {}), costume: opp ? null : (p.costume || Save.get().costume) }, t);
    if (opp) {
      // 對手：頭上綁一圈玫瑰花冠（玫瑰谷的採玫瑰節）
      ctx.fillStyle = '#e84a6a';
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.arc(pp.x + k * 4, pp.y - 41, 2.6, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#3f8a3a'; ctx.fillRect(pp.x - 10, pp.y - 40, 20, 1.6);
    }
    drawRacket(ctx, pp.x + (opp ? -10 : 10), pp.y - 22, opp ? -1 : 1, pp.swing);
  }

  function draw(ctx, state, t, W, H) {
    const rs = state.race, p = state.player;
    // 天空、巴爾幹山脈、玫瑰田
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#9ac8ec'); sky.addColorStop(1, '#fbe6ec');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8a9a8a';
    ctx.beginPath(); ctx.moveTo(0, 260);
    for (let x = 0; x <= W; x += 30) ctx.lineTo(x, 190 + Math.sin(x * 0.011) * 36 + Math.sin(x * 0.027) * 14);
    ctx.lineTo(W, 260); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6a8a5a'; ctx.fillRect(0, 256, W, 60);
    for (let row = 0; row < 4; row++) {
      const y = 266 + row * 13;
      ctx.fillStyle = '#4a7a3a'; ctx.fillRect(0, y, W, 6);
      ctx.fillStyle = row % 2 ? '#e84a6a' : '#f28aa0';
      for (let x = (row * 17) % 24; x < W; x += 24) { ctx.beginPath(); ctx.arc(x, y + 1, 2.6, 0, Math.PI * 2); ctx.fill(); }
    }
    // 看台的觀眾（一排小頭，得分時會跳）
    const cheer = rs.msg && rs.msg.good ? Math.abs(Math.sin(t * 0.4)) * 4 : 0;
    for (let x = 30; x < W; x += 26) {
      ctx.fillStyle = ['#e8a87a', '#c88a5a', '#f2c8a0'][Math.floor(x / 26) % 3];
      ctx.beginPath(); ctx.arc(x, 322 - cheer * ((x / 26) % 2), 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ['#d8303a', '#00966e', '#ffffff', '#2f6ab0'][Math.floor(x / 26) % 4];
      ctx.fillRect(x - 7, 328 - cheer * ((x / 26) % 2), 14, 8);
    }
    // 球場
    ctx.fillStyle = '#3a8a5a'; ctx.fillRect(0, 336, W, H - 336);
    ctx.fillStyle = '#2f7a4a'; ctx.fillRect(0, GY, W, H - GY);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(BASE_L - 2, GY - 2, 4, 6); ctx.fillRect(BASE_R - 2, GY - 2, 4, 6);
    ctx.fillRect(BASE_L, GY - 1, BASE_R - BASE_L, 2);
    // 網子
    ctx.fillStyle = '#3a3a40'; ctx.fillRect(NET_X - 2, NET_TOP - 6, 4, GY - NET_TOP + 6);
    ctx.fillStyle = 'rgba(30, 30, 40, 0.35)'; ctx.fillRect(NET_X - 3, NET_TOP, 6, 46);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.8;
    for (let y = NET_TOP + 6; y < NET_TOP + 46; y += 6) { ctx.beginPath(); ctx.moveTo(NET_X - 3, y); ctx.lineTo(NET_X + 3, y); ctx.stroke(); }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(NET_X - 4, NET_TOP - 2, 8, 4);
    // 兩個人
    drawPerson(ctx, rs.ai, 'ai', p, t);
    ctx.save();
    if (rs.invuln > 0 && Math.floor(rs.invuln / 5) % 2 === 0) ctx.globalAlpha = 0.45;
    drawPerson(ctx, rs.me, 'me', p, t);
    ctx.restore();
    // 球的落點預告（淡淡的影子）
    const sh = rs.sh;
    if (sh) {
      if (!sh.held) {
        const pr = predict(sh);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath(); ctx.ellipse(pr.x, GY + 2, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
      }
      // 羽毛球：白色的羽毛裙＋前面的軟木頭（頭朝飛行方向）
      const a = sh.held ? Math.PI / 2 : Math.atan2(sh.vy, sh.vx);
      ctx.save(); ctx.translate(sh.x, sh.y); ctx.rotate(a);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(0, -2.4); ctx.lineTo(-12, -6); ctx.lineTo(-12, 6); ctx.lineTo(0, 2.4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#c8c8d0'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(-12, 6); ctx.stroke();
      ctx.fillStyle = '#f2e6c8'; ctx.beginPath(); ctx.arc(1.5, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (sh.held && rs.server === 'me') U.text(ctx, '按跳躍發球', rs.me.x + 18, rs.me.y - 82, { size: 12, color: '#ffffff' });
    }
    // 計分板
    // 計分板放在畫面中段（上面那一塊留給提示訊息）
    ctx.fillStyle = 'rgba(14, 18, 32, 0.75)'; U.roundRect(ctx, W / 2 - 120, 132, 240, 44, 10); ctx.fill();
    U.text(ctx, '你', W / 2 - 92, 154, { size: 14, color: '#c6d2e8' });
    U.text(ctx, rs.score[0] + ' : ' + rs.score[1], W / 2, 154, { size: 26, color: '#ffd166' });
    U.text(ctx, '對手', W / 2 + 88, 154, { size: 14, color: '#c6d2e8' });
    U.text(ctx, '先拿 ' + MATCH + ' 分獲勝', W / 2, 188, { size: 12, color: '#3a2a3a' });
    if (rs.msg) U.text(ctx, rs.msg.text, W / 2, 222, { size: 22, color: rs.msg.good ? '#2f7a2a' : '#c8303a' });
  }

  return {
    plan: plan, makeState: makeState, update: update, draw: draw, predict: predict,
    GY: GY, NET_X: NET_X, NET_TOP: NET_TOP, MATCH: MATCH, SMASH_COINS: SMASH_COINS, REACH: REACH
  };
})();
