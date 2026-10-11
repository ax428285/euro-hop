'use strict';

/**
 * v1.33.3 東方艦隊的海戰（玩家：亞洲新增一個地方可以買船，亞洲的戰艦戰改成要用買的船來打，戰鬥方式你想一下）。
 *
 * 從上面往下看的海面，你開著在泉州造船廠買的船跟敵艦單挑 —— 帆船時代真正的打法：
 *   ←→ 轉舵、↑ 升滿帆加速、↓ 收帆減速；按 K／丟 兩側的舷砲一起齊射（砲彈往船的左右兩邊飛）
 *   所以要把船開到跟敵艦「並排」才打得中；敵艦也一樣，會繞到你旁邊轟你 —— 不要讓它停在你的正側面。
 *   海上有幾座礁石島，撞到會卡住、扣一點船身。
 * 船的性能（SHIPS）：速度、轉向、船身、一側幾門砲、裝填時間；造船廠（歐洲）的砲（cannon）等級加砲彈威力、船身（hull）等級加船身。
 * 敵艦（expedition.js 的 ASIA_WARSHIPS）：血量照 hp，tier 越高越快、砲越多、裝填越快。
 *
 * 用 Encounter.registerMini('naval') 掛進遭遇戰的流程；關卡定義在 expedition.js（minigame 'naval'，hidePlayer）。
 * 載入順序：expedition.js 之後。
 */
const NavalWar = (function () {
  const W = 960, TOP = 92, BOT = 470;
  const SHIPS = {
    dhow:     { name: '阿拉伯三角帆船', speed: 2.7, turn: 0.050, hp: 70,  guns: 2, reload: 66, len: 46, wid: 14 },
    fuchuan:  { name: '福船',           speed: 2.2, turn: 0.040, hp: 110, guns: 3, reload: 74, len: 56, wid: 18 },
    baochuan: { name: '鄭和寶船',       speed: 1.9, turn: 0.030, hp: 170, guns: 4, reload: 72, len: 72, wid: 24 }
  };
  const ENEMY_SIZE = { dhow: [46, 14], junk: [56, 18], atake: [64, 22] };
  const ROCKS = [{ x: 480, y: 290, r: 34 }, { x: 250, y: 170, r: 22 }, { x: 720, y: 390, r: 24 }];
  const BALL_SPEED = 6.5, BALL_LIFE = 44;
  const H = Encounter.helpers;

  function shipOf(id) { return SHIPS[id] || null; }
  function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
  /** 砲彈有沒有打到船（換到船的座標：x 沿著船身、y 往船的兩側） */
  function hitShip(b, s) {
    const dx = b.x - s.x, dy = b.y - s.y, c = Math.cos(-s.a), si = Math.sin(-s.a);
    const lx = dx * c - dy * si, ly = dx * si + dy * c;
    return Math.abs(lx) < s.len / 2 + 3 && Math.abs(ly) < s.wid / 2 + 3;
  }
  /** 船開一步：碰到礁石、邊界就停下來 */
  function sail(s, events, bump) {
    s.x += Math.cos(s.a) * s.v; s.y += Math.sin(s.a) * s.v;
    if (s.x < 30 || s.x > W - 30 || s.y < TOP + 20 || s.y > BOT - 10) {
      s.x = U.clamp(s.x, 30, W - 30); s.y = U.clamp(s.y, TOP + 20, BOT - 10); s.v *= 0.5;
    }
    ROCKS.forEach(function (r) {
      const d = Math.hypot(s.x - r.x, s.y - r.y), min = r.r + s.wid;
      if (d < min && d > 0.01) {
        s.x = r.x + (s.x - r.x) / d * min; s.y = r.y + (s.y - r.y) / d * min;
        s.v *= 0.3;
        if (bump && s.bumpCd <= 0) { s.bumpCd = 40; bump(); }
      }
    });
    if (s.bumpCd > 0) s.bumpCd--;
  }
  /** 兩側齊射：每側 n 門砲沿著船身排開 */
  function broadside(mini, s, n, side, mine) {
    const fx = Math.cos(s.a), fy = Math.sin(s.a);
    [-1, 1].forEach(function (sd) {
      if (side && sd !== side) return;
      const px = -fy * sd, py = fx * sd;
      for (let g = 0; g < n; g++) {
        const off = (g - (n - 1) / 2) * (s.len / (n + 1));
        mini.balls.push({ x: s.x + fx * off + px * s.wid * 0.6, y: s.y + fy * off + py * s.wid * 0.6,
                          vx: px * BALL_SPEED + fx * s.v * 0.6, vy: py * BALL_SPEED + fy * s.v * 0.6, life: BALL_LIFE, mine: mine });
        mini.flashes.push({ x: s.x + fx * off + px * s.wid * 0.7, y: s.y + fy * off + py * s.wid * 0.7, t: 10 });
      }
    });
  }

  Encounter.registerMini('naval', {
    def: { name: '海戰', lv: '', exp: 0, game: '戰艦海戰', usesThrow: true },
    init: function (state, mini) {
      const def = state.def, sp = shipOf(def.asShip) || SHIPS.dhow, yard = Save.ship();
      const w = def.monster.def.warship, size = ENEMY_SIZE[w.style] || [56, 18];
      mini.me = { x: 170, y: 380, a: -0.4, v: 1, len: sp.len, wid: sp.wid, bumpCd: 0, type: def.asShip || 'dhow' };
      mini.hpMax = sp.hp + (yard.hull || 0) * 15; mini.hp = mini.hpMax;
      mini.guns = sp.guns; mini.reloadMax = sp.reload; mini.reload = 30;
      mini.dmg = 3.5 * (1 + (yard.cannon || 0) * 0.15);       // 一發砲彈；歐洲造船廠的砲每級 +15%
      mini.speed = sp.speed; mini.turn = sp.turn;
      mini.foe = { x: 780, y: 190, a: Math.PI * 0.85, v: 1.4, len: size[0], wid: size[1], bumpCd: 0, style: w.style };
      mini.foeHp = mini.foeMax = Math.round(w.hp * 0.6);      // 這種打法一發一發算，船身比甲板海戰少一點
      mini.foeGuns = Math.min(4, 2 + Math.floor(w.tier / 2));
      mini.foeReloadMax = Math.max(80, 150 - w.tier * 12); mini.foeReload = 90;
      mini.foeSpeed = 1.5 + w.tier * 0.12; mini.foeTurn = 0.026 + w.tier * 0.003;
      mini.foeDmg = 2.5 + w.tier * 0.4;
      mini.circle = 1; mini.balls = []; mini.flashes = []; mini.splash = []; mini.wake = []; mini.shake = 0; mini.sinkT = 0;
    },
    update: function (state, input, mini, events, win, fail) {
      const me = mini.me, foe = mini.foe;
      // 主角的船（藏起來的平台角色不管它）
      let target = mini.speed * 0.6;
      if (input && input.isDown('up')) target = mini.speed;
      if (input && input.isDown('down')) target = mini.speed * 0.2;
      me.v += (target - me.v) * 0.04;
      const steer = mini.turn * (0.45 + 0.55 * me.v / mini.speed);
      if (input && input.isDown('left')) me.a -= steer;
      if (input && input.isDown('right')) me.a += steer;
      sail(me, events, function () { mini.hp -= 3; mini.shake = 8; events.push('clang'); });
      if (mini.reload > 0) mini.reload--;
      if (mini.reload === 0 && input && input.once('throw')) {
        broadside(mini, me, mini.guns, 0, true);
        mini.reload = mini.reloadMax; events.push('fire');
      }
      // 敵艦：保持在 140～230 的距離繞著你轉，你在它的正側面就齊射
      const dx = me.x - foe.x, dy = me.y - foe.y, dist = Math.hypot(dx, dy), toMe = Math.atan2(dy, dx);
      let want = toMe + mini.circle * Math.PI / 2;
      if (dist > 230) want = toMe + mini.circle * 0.5;
      else if (dist < 140) want = toMe + mini.circle * 2.2;
      foe.a += U.clamp(wrap(want - foe.a), -mini.foeTurn, mini.foeTurn);
      foe.v += (mini.foeSpeed - foe.v) * 0.03;
      sail(foe, events, function () { mini.circle = -mini.circle; });
      if (mini.elapsed % 600 === 599) mini.circle = -mini.circle;       // 偶爾換邊繞
      if (mini.foeReload > 0) mini.foeReload--;
      const rel = wrap(toMe - foe.a);
      if (mini.foeReload === 0 && dist < 290 && Math.abs(Math.abs(rel) - Math.PI / 2) < 0.4) {
        broadside(mini, foe, mini.foeGuns, rel > 0 ? 1 : -1, false);
        mini.foeReload = mini.foeReloadMax; events.push('cannon');
      }
      // 砲彈
      mini.balls.forEach(function (b) {
        b.x += b.vx; b.y += b.vy; b.life--;
        if (b.mine && mini.foeHp > 0 && hitShip(b, foe)) {
          b.dead = true; mini.foeHp = Math.max(0, mini.foeHp - mini.dmg); events.push('hit');
          mini.splash.push({ x: b.x, y: b.y, t: 20, fire: true });
          if (mini.foeHp <= 0) win();
        } else if (!b.mine && hitShip(b, me)) {
          b.dead = true; mini.hp -= mini.foeDmg; mini.shake = 10; events.push('boom');
          mini.splash.push({ x: b.x, y: b.y, t: 20, fire: true });
        } else if (b.life <= 0) { b.dead = true; mini.splash.push({ x: b.x, y: b.y, t: 18 }); }
      });
      mini.balls = mini.balls.filter(function (b) { return !b.dead; });
      [me, foe].forEach(function (s) { if (mini.elapsed % 4 === 0) mini.wake.push({ x: s.x - Math.cos(s.a) * s.len / 2, y: s.y - Math.sin(s.a) * s.len / 2, t: 50 }); });
      mini.wake.forEach(function (q) { q.t--; }); mini.wake = mini.wake.filter(function (q) { return q.t > 0; });
      mini.splash.forEach(function (q) { q.t--; }); mini.splash = mini.splash.filter(function (q) { return q.t > 0; });
      mini.flashes.forEach(function (q) { q.t--; }); mini.flashes = mini.flashes.filter(function (q) { return q.t > 0; });
      if (mini.shake > 0) mini.shake--;
      if (mini.hp <= 0) { mini.hp = 0; fail(); }
      else if (!mini.done && mini.time <= 0) fail();
    },
    draw: function (ctx, state, t) {
      const mini = state.mini;
      ctx.save();
      if (mini.shake > 0) ctx.translate(Math.sin(t * 2) * 3, 0);
      const g = ctx.createLinearGradient(0, 0, 0, 480);
      g.addColorStop(0, '#2a6a9a'); g.addColorStop(1, '#1a4a72');
      ctx.fillStyle = g; ctx.fillRect(-10, 0, W + 20, 480);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'; ctx.lineWidth = 1.5;
      for (let k = 0; k < 40; k++) {
        const x = (k * 137 + t * 0.4) % (W + 40) - 20, y = TOP + (k * 71) % (BOT - TOP);
        ctx.beginPath(); ctx.arc(x, y, 8, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      }
      // 礁石島
      ROCKS.forEach(function (r) {
        ctx.fillStyle = 'rgba(200, 230, 240, 0.35)'; ctx.beginPath(); ctx.arc(r.x, r.y, r.r + 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c8b888'; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6a8a4a'; ctx.beginPath(); ctx.arc(r.x - r.r * 0.2, r.y - r.r * 0.2, r.r * 0.55, 0, Math.PI * 2); ctx.fill();
      });
      // 船跡
      mini.wake.forEach(function (q) { ctx.fillStyle = 'rgba(230, 245, 255, ' + (q.t / 50 * 0.35).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(q.x, q.y, 3 + (50 - q.t) * 0.12, 0, Math.PI * 2); ctx.fill(); });
      // 敵艦（被擊沉：慢慢傾斜沉下去）
      const foe = mini.foe;
      if (mini.foeHp <= 0) mini.sinkT = Math.min(80, mini.sinkT + 1);
      ctx.save(); ctx.globalAlpha = 1 - mini.sinkT / 90;
      drawTopShip(ctx, foe, foe.style, t, mini.foeHp <= 0 ? mini.sinkT / 40 : 0);
      ctx.restore();
      drawTopShip(ctx, mini.me, mini.me.type, t, 0);
      // 砲口火光、砲彈、水花
      mini.flashes.forEach(function (q) { ctx.fillStyle = 'rgba(255, 200, 100, ' + (q.t / 10).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(q.x, q.y, 4 + (10 - q.t) * 0.6, 0, Math.PI * 2); ctx.fill(); });
      mini.balls.forEach(function (b) { ctx.fillStyle = b.mine ? '#1a1a1a' : '#3a1a1a'; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill(); });
      mini.splash.forEach(function (q) {
        ctx.fillStyle = q.fire ? 'rgba(255, 140, 60, ' + (q.t / 20).toFixed(2) + ')' : 'rgba(230, 245, 255, ' + (q.t / 18 * 0.8).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(q.x, q.y, 3 + (20 - q.t) * 0.5, 0, Math.PI * 2); ctx.fill();
      });
      // 船身條＋裝填（我方畫在船旁邊）
      const me = mini.me;
      ctx.fillStyle = 'rgba(14, 18, 32, 0.6)'; U.roundRect(ctx, me.x - 26, me.y + 22, 52, 8, 4); ctx.fill();
      ctx.fillStyle = mini.reload === 0 ? '#8fe3a0' : '#ffd166'; U.roundRect(ctx, me.x - 25, me.y + 23, 50 * (1 - mini.reload / mini.reloadMax), 6, 3); ctx.fill();
      if (mini.reload === 0) U.text(ctx, '可以開砲', me.x, me.y + 38, { size: 10, color: '#8fe3a0', strokeWidth: 3 });
      // 我方的記號（兩艘船可能長得很像）
      ctx.fillStyle = '#8fe3a0'; ctx.beginPath(); ctx.moveTo(me.x - 6, me.y - 34); ctx.lineTo(me.x + 6, me.y - 34); ctx.lineTo(me.x, me.y - 26); ctx.closePath(); ctx.fill();
      U.text(ctx, '你', me.x, me.y - 42, { size: 11, color: '#8fe3a0', strokeWidth: 3 });
      [[mini.hp, mini.hpMax, '我方：' + (shipOf(me.type) || SHIPS.dhow).name, 120, '#8fe3a0'], [mini.foeHp, mini.foeMax, '敵艦：' + state.def.monster.def.warship.label, 640, '#ff8a7a']].forEach(function (q) {
        ctx.fillStyle = 'rgba(14, 18, 32, 0.7)'; U.roundRect(ctx, q[3], 90, 200, 24, 6); ctx.fill();
        ctx.fillStyle = q[4]; U.roundRect(ctx, q[3] + 4, 104, 192 * Math.max(0, q[0]) / q[1], 6, 3); ctx.fill();
        U.text(ctx, q[2] + '　' + Math.max(0, Math.ceil(q[0])) + ' / ' + q[1], q[3] + 100, 97, { size: 10, color: '#ffffff', stroke: false });
      });
      ctx.restore();
    },
    hud: function (mini, sec) { return '←→ 轉舵、↑ 加速・開到敵艦旁邊按 K／丟 兩側齊射　剩 ' + sec + ' 秒'; }
  });

  /** 從上面看的船（原點 = 船身中心、往 s.a 的方向開）；tilt = 沉船時的傾斜 */
  function drawTopShip(ctx, s, type, t, tilt) {
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a + (tilt || 0) * 0.5);
    const L = s.len, Wd = s.wid;
    const hull = type === 'atake' ? '#3a2a20' : type === 'junk' || type === 'fuchuan' ? '#6a3a1a' : type === 'baochuan' ? '#8a4a24' : '#7a5030';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath(); ctx.ellipse(3, 3, L / 2, Wd / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hull;
    ctx.beginPath(); ctx.moveTo(L / 2, 0); ctx.quadraticCurveTo(L / 4, -Wd / 2, -L / 2, -Wd / 2); ctx.lineTo(-L / 2, Wd / 2); ctx.quadraticCurveTo(L / 4, Wd / 2, L / 2, 0); ctx.fill();
    ctx.fillStyle = type === 'atake' ? '#5a4a3a' : '#c8a070';
    ctx.beginPath(); ctx.moveTo(L / 2 - 6, 0); ctx.quadraticCurveTo(L / 4, -Wd / 2 + 3, -L / 2 + 3, -Wd / 2 + 3); ctx.lineTo(-L / 2 + 3, Wd / 2 - 3); ctx.quadraticCurveTo(L / 4, Wd / 2 - 3, L / 2 - 6, 0); ctx.fill();
    const sw = Math.sin(t * 0.08) * 0.08;
    if (type === 'atake') {
      ctx.fillStyle = '#7a6a5a'; ctx.fillRect(-L * 0.3, -Wd * 0.35, L * 0.5, Wd * 0.7);
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(-L * 0.18, -Wd * 0.25, L * 0.26, Wd * 0.5);
      ctx.fillStyle = '#c8202a'; ctx.beginPath(); ctx.arc(L * 0.3, 0, 3, 0, Math.PI * 2); ctx.fill();
    } else {
      const masts = type === 'baochuan' ? 5 : type === 'fuchuan' || type === 'junk' ? 3 : 1;
      const sail = type === 'dhow' ? '#f4efe2' : '#c0402a';
      for (let k = 0; k < masts; k++) {
        const mx = masts === 1 ? 0 : -L * 0.32 + k * (L * 0.62 / (masts - 1));
        ctx.save(); ctx.translate(mx, 0); ctx.rotate(sw);
        ctx.fillStyle = sail;
        if (type === 'dhow') { ctx.beginPath(); ctx.moveTo(L * 0.25, -2); ctx.lineTo(-L * 0.3, -Wd * 0.9); ctx.lineTo(-L * 0.2, 2); ctx.closePath(); ctx.fill(); }
        else {
          ctx.fillRect(-3, -Wd * 0.75, 6, Wd * 1.5);
          ctx.fillStyle = 'rgba(60, 20, 10, 0.5)'; for (let r = 1; r < 4; r++) ctx.fillRect(-3, -Wd * 0.75 + r * Wd * 0.375, 6, 1);
        }
        ctx.restore();
        ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.arc(mx, 0, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  return { SHIPS: SHIPS, shipOf: shipOf, drawTopShip: drawTopShip, ROCKS: ROCKS };
})();
