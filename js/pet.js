'use strict';

/**
 * 寵物：峽灣的黃金獵犬（v1.29 玩家：老漁夫附近放一隻黃金獵犬，身上要有臘腸才會跟你走，
 * 變成寵物後牠會在大地圖上跟在你背後；港口的商品其中一個換成臘腸）。
 *
 *   還沒收養：挪威峽灣岸邊（老漁夫東邊）坐著一隻黃金獵犬，尾巴搖啊搖。
 *             靠近按 Enter —— 船艙裡有臘腸就餵牠一根（扣一箱），牠就跟你走；
 *             沒有臘腸只會聞一聞，提示去熱那亞買（trade.js 的 sausage）。
 *   收養之後：Save.pet() === 'dog'。大地圖上沿著你走過的路跟在後面：
 *             上岸走路時牠用跑的，開船時牠在船尾後面狗爬式游泳。
 *
 * 跟隨用「足跡」：主角每移動一小段就記一個點，狗站在大約 FOLLOW 距離之前的那個點上，
 * 所以轉彎時牠會照原路繞過來，不會穿過陸地或直接貼在身上。
 * 船被瞬間移走（回港口、被漩渦甩出去）時足跡清空，狗直接出現在身邊。
 */
const Pet = (function () {
  // v1.30 玩家：黃金獵犬從挪威峽灣搬到蘇格蘭高地（北歐被雷神的結界罩住，原本的位置過不去了）
  const SPOT = { lon: -4.6, lat: 57.3 };
  const STEP = 1.5;                         // 足跡點的間距
  const FOLLOW = 20;                        // 狗跟在後面多遠
  const trail = [];                         // 最新的在最後面
  const dog = { x: 0, y: 0, facing: 1, step: 0, inWater: false, ready: false };

  function adopted() { return typeof Save !== 'undefined' && Save.pet() === 'dog'; }

  /** 大地圖上那個點（還沒收養時狗坐的地方） */
  function spotPin() {
    const p = EuropeWorld.project(SPOT.lon, SPOT.lat);
    return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
  }

  function snap(x, y) {
    trail.length = 0;
    trail.push({ x: x, y: y });
    dog.x = x - 10; dog.y = y + 2; dog.ready = true;
  }

  /*
   * v1.31.2 玩家：海底城全破，人魚會跟你走（跟狗狗一樣跟在後面）。
   * 用同一條足跡：狗在 FOLLOW 的地方、人魚再後面一點（沒有狗就是她跟在 FOLLOW）。
   * 在水裡她甩著尾巴游，上岸時坐在一顆透明的大水泡裡飄著跟過來。
   */
  const mer = { x: 0, y: 0, facing: 1, ready: false, inWater: true };
  function mermaidOn() { return typeof Quests !== 'undefined' && !!Quests.mermaidJoined && Quests.mermaidJoined(); }

  /** 從足跡最新的點往回量 dist 遠的那一點 */
  function pointBack(ship, dist) {
    let need = dist, tx = trail[0].x, ty = trail[0].y;
    let px = ship.x, py = ship.y;
    for (let i = trail.length - 1; i >= 0; i--) {
      const d = Math.hypot(px - trail[i].x, py - trail[i].y);
      if (d >= need) {
        const k = need / d;
        return { x: px + (trail[i].x - px) * k, y: py + (trail[i].y - py) * k };
      }
      need -= d; px = trail[i].x; py = trail[i].y;
    }
    return { x: px, y: py };
  }
  /** 跟隨者往目標點靠過去（不要一帧跳到位，停下來時會小跑幾步才停） */
  function chase(f, tp) {
    const mv = Math.hypot(tp.x - f.x, tp.y - f.y);
    if (Math.abs(tp.x - f.x) > 0.05) f.facing = tp.x > f.x ? 1 : -1;
    f.x += (tp.x - f.x) * 0.35; f.y += (tp.y - f.y) * 0.35;
    f.step = (f.step || 0) + Math.min(mv, 2) * 0.5;
    f.inWater = typeof Voyage !== 'undefined' && !Voyage.isLand(f.x, f.y);
  }

  /** 每帧（大地圖）：記足跡、把狗（和人魚）放到後面那個點 */
  function update(ship) {
    const hasDog = adopted(), hasMer = mermaidOn();
    if (!hasDog) dog.ready = false;
    if (!hasMer) mer.ready = false;
    if (!hasDog && !hasMer) return;
    const last = trail[trail.length - 1];
    if ((hasDog && !dog.ready) || (hasMer && !mer.ready) || !last || Math.hypot(ship.x - last.x, ship.y - last.y) > 40) {
      snap(ship.x, ship.y);
      if (hasMer) { mer.x = ship.x - (hasDog ? 22 : 12); mer.y = ship.y + 4; mer.ready = true; }
      return;
    }
    if (Math.hypot(ship.x - last.x, ship.y - last.y) >= STEP) {
      trail.push({ x: ship.x, y: ship.y });
      if (trail.length > 80) trail.shift();
    }
    if (hasDog) {
      chase(dog, pointBack(ship, FOLLOW));
      dog.step = dog.step || 0;
    }
    if (hasMer) chase(mer, pointBack(ship, hasDog ? FOLLOW * 2 + 6 : FOLLOW));
  }

  /** 人魚 Thalassa（大地圖上的跟隨者）：在水裡游、上岸坐在水泡裡 */
  function drawMermaid(ctx, x, y, t, facing, inWater, noRing) {
    ctx.save();
    ctx.translate(x, y);
    const bob = Math.sin(t * 0.08) * 1.5;
    if (!inWater) {
      // 上岸：一顆透明的大水泡，她坐在裡面飄
      ctx.translate(0, -8 + bob);
      ctx.fillStyle = 'rgba(170, 230, 255, 0.28)';
      ctx.beginPath(); ctx.arc(0, -8, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(220, 250, 255, 0.85)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, -8, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.beginPath(); ctx.ellipse(-6, -15, 3, 1.6, -0.6, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.translate(0, bob);
      if (!noRing) {
        ctx.strokeStyle = 'rgba(226, 240, 255, 0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 1, 9, 3, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.scale(facing || 1, 1);
    chibiMer(ctx, t, false);
    ctx.restore();
  }

  /*
   * v1.31.2 玩家：你的人魚好醜，請用範例圖重畫 → Q 版小人魚（原點 = 尾巴底下，約 22px 高）：
   * 大頭、粉紅色波浪長髮（髮尾帶紫）、藍色大眼睛、黃色海星髮飾、粉紅貝殼上衣、青綠色魚尾巴。
   * human = 變成人類的 Thalassa（尾巴換成粉紅白色小洋裝和兩隻腳，step = 走路的步伐）。
   */
  /*
   * v1.31.3 玩家：人魚時裝再幫我多弄幾套 → Thalassa 自己的衣服（珊瑚貝殼屋買，買了她就換上；再按一次 = 換回貝殼上衣）。
   * 0 號是原本的白貝殼上衣（不用買）。旗標 merOutfit = 現在穿第幾套。變成人類之後，洋裝也換成同一套的顏色。
   */
  const MER_OUTFITS = Shop.MER_OUTFITS;     // 清單放在 shop.js（shop.js 比 pet.js 先載入，商品要用）
  function merOutfit() {
    const k = typeof Save !== 'undefined' ? (Save.flag('merOutfit') || 0) : 0;
    return MER_OUTFITS[k] || MER_OUTFITS[0];
  }

  function chibiMer(ctx, t, human, step, outfitOverride) {
    const of = outfitOverride || merOutfit();
    /*
     * v1.31.3 玩家給的範例圖：一頭及腰的灰棕色長髮、珍珠頭飾、耳朵是白色的小魚鰭、白色貝殼上衣、
     * 藍銀色的魚尾巴配半透明的大尾鰭，手上提著一盞發橘光的燈籠（變成人類之後也還提著）。
     */
    const wag = Math.sin(t * 0.18) * 2.2;
    const hairC = '#8a7a6c', hairHi = '#b8a894';
    // 及腰的長髮（往後披）
    ctx.fillStyle = hairC;
    ctx.beginPath(); ctx.moveTo(-3.5, -19.5); ctx.quadraticCurveTo(-9, -15, -7.5, -6 + Math.sin(t * 0.06)); ctx.quadraticCurveTo(-6, -2, -3, -4);
    ctx.lineTo(3, -5); ctx.quadraticCurveTo(5.6, -10, 4.6, -19); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = hairHi; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(-3, -17); ctx.quadraticCurveTo(-7, -12, -5.6, -6); ctx.stroke();
    if (!human) {
      // 藍銀色魚尾巴＋半透明的大尾鰭
      const tg = ctx.createLinearGradient(0, -8, 0, 0);
      tg.addColorStop(0, '#6a94b8'); tg.addColorStop(1, '#3a5a80');
      ctx.fillStyle = tg;
      ctx.beginPath(); ctx.moveTo(-2.8, -8); ctx.lineTo(2.8, -8); ctx.quadraticCurveTo(3.6, -2, -2, -0.6);
      ctx.quadraticCurveTo(-5, 0.4, -8, -1 + wag * 0.3); ctx.lineTo(-6.5, -3.4); ctx.quadraticCurveTo(-3, -3.4, -2.8, -8); ctx.fill();
      ctx.fillStyle = 'rgba(210, 235, 255, 0.7)';
      ctx.beginPath(); ctx.moveTo(-7, -1.6 + wag * 0.3); ctx.quadraticCurveTo(-11, -6 + wag, -14, -6 + wag);
      ctx.quadraticCurveTo(-11, -1.5, -14, 3 + wag); ctx.quadraticCurveTo(-11, 2 + wag, -7, -0.6 + wag * 0.3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(220, 240, 255, 0.7)'; ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.arc(-0.4, -5.6, 1.1, 0, Math.PI); ctx.arc(1.8, -5.6, 1.1, 0, Math.PI); ctx.stroke();
    } else {
      const sw = Math.sin((step || 0) * 0.9) * 1.6;
      ctx.strokeStyle = '#f6dccb'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-1.2, -5); ctx.lineTo(-1.2 + sw, -0.6); ctx.moveTo(1.4, -5); ctx.lineTo(1.4 - sw, -0.6); ctx.stroke();
      ctx.fillStyle = '#c8d8e8'; ctx.fillRect(-2.2 + sw, -1, 2.2, 1.1); ctx.fillRect(0.4 - sw, -1, 2.2, 1.1);
      ctx.fillStyle = of.dress;
      ctx.beginPath(); ctx.moveTo(-2.8, -11); ctx.lineTo(2.8, -11); ctx.lineTo(4.6, -4.4); ctx.lineTo(-4.6, -4.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = of.trim; ctx.fillRect(-4.6, -5, 9.2, 0.8); ctx.fillRect(-2.8, -9.4, 5.6, 0.8);
    }
    // 身體＋白色貝殼上衣
    ctx.fillStyle = '#f6dccb'; ctx.fillRect(-2.4, -11.5, 4.8, human ? 1.8 : 4);
    if (!human) {
      if (of.id === 'shell') {
        ctx.fillStyle = of.main;
        ctx.beginPath(); ctx.arc(-1.2, -9.4, 1.3, Math.PI, 0); ctx.arc(1.2, -9.4, 1.3, Math.PI, 0); ctx.fill();
      } else {
        // 其他衣服：一件包住上半身的小上衣（水手服多一條領子、星空多一點星光）
        ctx.fillStyle = of.main; ctx.fillRect(-2.7, -11.4, 5.4, of.id === 'sailor' ? 4 : 3);
        ctx.fillStyle = of.accent;
        if (of.id === 'sailor') { ctx.beginPath(); ctx.moveTo(-2.7, -11.4); ctx.lineTo(2.7, -11.4); ctx.lineTo(0, -9.6); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#d83040'; ctx.fillRect(-0.5, -9.8, 1, 1); }
        else if (of.id === 'star') { if (Math.sin(t * 0.2) > 0) ctx.fillRect(-1.6, -10.6, 0.6, 0.6); ctx.fillRect(1, -9.6, 0.6, 0.6); }
        else ctx.fillRect(-2.7, -8.8, 5.4, 0.6);
      }
    }
    // 伸出去的手提著一盞燈籠（橘光）
    const lx = 6.2, ly = -9.4 + Math.sin(t * 0.07) * 0.4;
    ctx.strokeStyle = '#f6dccb'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(1.6, -10.6); ctx.lineTo(lx, -11.4); ctx.stroke();
    const glow = ctx.createRadialGradient(lx, ly + 2.6, 0.4, lx, ly + 2.6, 7);
    glow.addColorStop(0, 'rgba(255, 210, 120, 0.85)'); glow.addColorStop(1, 'rgba(255, 170, 60, 0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(lx, ly + 2.6, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5a4a30'; ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(lx, -11.4); ctx.lineTo(lx, ly + 0.8); ctx.stroke();
    ctx.fillStyle = '#ffd88a'; ctx.fillRect(lx - 1, ly + 1, 2, 2.6);
    ctx.fillStyle = '#5a4a30'; ctx.fillRect(lx - 1.3, ly + 0.6, 2.6, 0.6); ctx.fillRect(lx - 1.3, ly + 3.6, 2.6, 0.6);
    // 頭：瓜子臉、藍灰色的眼睛
    ctx.fillStyle = '#f6dccb'; ctx.fillRect(-0.6, -13.4, 2.2, 2);
    ctx.beginPath(); ctx.ellipse(0.8, -15.6, 3.2, 3.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hairC;
    ctx.beginPath(); ctx.moveTo(-2.6, -14.4); ctx.arc(0.8, -16, 3.8, Math.PI * 1.02, Math.PI * 1.96);
    ctx.quadraticCurveTo(3.4, -18.4, 1, -18.2); ctx.quadraticCurveTo(-1.2, -17, -2.6, -14.4); ctx.fill();
    ctx.fillStyle = '#2a2430';
    ctx.fillRect(1.6, -16, 1.2, 0.8); ctx.fillRect(3.2, -16, 1, 0.8);
    ctx.fillStyle = '#7ab0d8'; ctx.fillRect(1.8, -15.4, 0.8, 0.6); ctx.fillRect(3.3, -15.4, 0.7, 0.6);
    ctx.fillStyle = '#d88a8a'; ctx.fillRect(2.6, -13.6, 1.2, 0.6);
    // 白色的魚鰭耳朵＋珍珠頭飾
    ctx.fillStyle = 'rgba(235, 245, 255, 0.95)';
    ctx.beginPath(); ctx.moveTo(-1.2, -15.6); ctx.lineTo(-4.4, -18.2); ctx.lineTo(-3.6, -15.8); ctx.lineTo(-4.2, -14.2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 5; k++) { const a = Math.PI * 1.15 + k * Math.PI * 0.17; ctx.beginPath(); ctx.arc(0.8 + Math.cos(a) * 3.9, -16 + Math.sin(a) * 3.9, 0.45, 0, Math.PI * 2); ctx.fill(); }
  }

  /*
   * v1.31.2 變成人類的 Thalassa（巴黎鐵塔的夜景之後，flag merHuman）：白色露肩小洋裝、粉紅緞帶、
   * 一大把青綠色長髮往後飄、頭上一朵粉紅花；陸地上用雙腳走（walk = 腳在動），下水就只露出頭游泳。
   * 原點在腳底，大小跟人魚一樣（約 20px 高）。
   */
  function drawThalassa(ctx, x, y, t, facing, inWater, stand) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing || 1, 1);
    if (inWater) {
      // 下水：只露出頭游泳
      ctx.strokeStyle = 'rgba(226, 240, 255, 0.7)'; ctx.lineWidth = 1;
      const r = 5 + Math.sin(t * 0.15) * 0.8;
      ctx.beginPath(); ctx.ellipse(0, 0, r + 3, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.translate(0, 12);
      ctx.save(); ctx.beginPath(); ctx.rect(-12, -40, 24, 28); ctx.clip();
      chibiMer(ctx, t, true, 0);
      ctx.restore();
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath(); ctx.ellipse(0, 0.5, 5, 1.6, 0, 0, Math.PI * 2); ctx.fill();
    chibiMer(ctx, t, true, stand ? 0 : (mer.step || 0));
    ctx.restore();
  }

  // ── 繪製（大地圖座標，WorldMap 的 view 裡）──

  // ── v1.31 千里達寵物用品店的配件（Shop.dogAccs()；全部一起戴）。座標是狗自己的座標（頭在 (4, hy)）──
  function accHas(o, k) { return !!(o.accs && o.accs.indexOf(k) >= 0); }
  function drawCape(ctx, hy, t) {
    const w = Math.sin(t * 0.2) * 1.2;
    ctx.fillStyle = '#c8303a';
    ctx.beginPath(); ctx.moveTo(2.6, hy + 1.8); ctx.lineTo(0, hy + 1.2);
    ctx.quadraticCurveTo(-5, -6 + w, -8, -3.5 + w); ctx.lineTo(-3.5, -2.2); ctx.closePath(); ctx.fill();
  }
  function drawHeadAccs(ctx, o, hx, hy) {
    if (accHas(o, 'bandana')) {
      ctx.fillStyle = '#d8303a';
      ctx.beginPath(); ctx.moveTo(hx - 2.6, hy + 2); ctx.lineTo(hx + 1.8, hy + 2.8); ctx.lineTo(hx - 0.8, hy + 5.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(hx - 0.9, hy + 3, 0.7, 0.7);
    }
    if (accHas(o, 'shades')) {
      ctx.fillStyle = '#16161c';
      ctx.fillRect(hx + 0.4, hy - 2, 3.4, 1.8);
      ctx.fillRect(hx - 1.6, hy - 1.6, 2, 0.6);
      ctx.fillStyle = 'rgba(160, 220, 255, 0.7)'; ctx.fillRect(hx + 2.4, hy - 1.8, 0.8, 0.6);
    }
    if (accHas(o, 'sombrero')) {
      ctx.fillStyle = '#e8c870';
      ctx.beginPath(); ctx.ellipse(hx, hy - 2.8, 5.4, 1.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(hx, hy - 4.2, 2.4, 2, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#c8303a'; ctx.fillRect(hx - 2.4, hy - 3.6, 4.8, 0.8);
    }
  }

  /** 黃金獵犬：坐著（sit）或走路；s = 縮放；o.accs = 戴著的配件 */
  function drawDog(ctx, x, y, t, o) {
    o = o || {};
    const fur = '#e0a64a', dark = '#b97a2a';
    ctx.save();
    ctx.translate(x, y);
    ctx.scale((o.facing || 1) * 1.5, 1.5);   // 地圖上的人物大約 18px 高，狗要看得出是狗
    if (o.swim) {
      // 狗爬式：只露出頭和耳朵，旁邊一圈水紋
      ctx.strokeStyle = 'rgba(226,240,255,0.7)'; ctx.lineWidth = 1;
      const r = 5 + Math.sin(t * 0.15) * 0.8;
      ctx.beginPath(); ctx.ellipse(0, 0, r + 2, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.ellipse(1, -2, 3.6, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(-1.6, -1.6, 1.4, 2.4, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.ellipse(4, -1.6, 2, 1.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(5.4, -2.2, 1.2, 1.2);
      ctx.fillRect(2, -3.4, 0.9, 0.9);
      drawHeadAccs(ctx, { accs: (o.accs || []).filter(function (k) { return k !== 'bandana'; }) }, 1.4, -2);
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 1, 6.5, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    // 尾巴（一直搖）
    const wag = Math.sin(t * (o.sit ? 0.35 : 0.25)) * 0.6;
    ctx.strokeStyle = fur; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-5, o.sit ? -2 : -5);
    ctx.quadraticCurveTo(-8, -7 + wag * 2, -9 + wag, -9 + wag * 2); ctx.stroke();
    if (o.sit) {
      // 坐著：身體斜斜的，前腳撐地
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.ellipse(-1.5, -3.5, 4.5, 3.5, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(1, -4, 1.8, 4.5);
      ctx.fillRect(-4.5, -1.5, 4, 1.8);
    } else {
      const sw = Math.sin(dog.step) * 1.6;
      ctx.strokeStyle = dark; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-3.5, -3); ctx.lineTo(-3.5 + sw, 0.5);
      ctx.moveTo(3, -3); ctx.lineTo(3 - sw, 0.5);
      ctx.stroke();
      ctx.fillStyle = fur;
      ctx.beginPath(); ctx.ellipse(0, -4.5, 5.5, 2.8, 0, 0, Math.PI * 2); ctx.fill();
    }
    // 頭
    const hy = o.sit ? -9 : -7;
    if (accHas(o, 'cape')) drawCape(ctx, hy, t);
    ctx.fillStyle = fur;
    ctx.beginPath(); ctx.arc(4, hy, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, hy + 1, 2.2, 1.5, 0, 0, Math.PI * 2); ctx.fill();   // 嘴
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(2.6, hy + 0.6, 1.3, 2.4, 0.25, 0, Math.PI * 2); ctx.fill(); // 耳朵
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(8.4, hy + 0.2, 1.2, 1.1);   // 鼻子
    ctx.fillRect(5, hy - 1.2, 0.9, 0.9);     // 眼睛
    if (o.sit) {
      // 吐舌頭
      ctx.fillStyle = '#e86a7a';
      ctx.fillRect(6.4, hy + 2.2, 1.2, 1.6 + Math.max(0, Math.sin(t * 0.2)) * 0.8);
    }
    drawHeadAccs(ctx, o, 4, hy);
    ctx.restore();
  }

  // v1.31.3 Thalassa 衣服的商品圖示（shop.js 的 mer_*）
  if (typeof Sprites !== 'undefined') {
    MER_OUTFITS.forEach(function (o, k) {
      if (k) Sprites.icons['mer_' + o.id] = function (ctx, s) { ctx.save(); ctx.scale(s * 2.4, s * 2.4); ctx.translate(1, 10); chibiMer(ctx, 0, false, 0, o); ctx.restore(); };
    });
  }

  // 寵物用品店的商品圖示：坐著的狗只戴那一樣（Sprites.icon 的格式：原點在中心、s = 縮放）
  if (typeof Sprites !== 'undefined') {
    ['bandana', 'shades', 'sombrero', 'cape'].forEach(function (k) {
      Sprites.icons['dog_' + k] = function (ctx, s) {
        ctx.save(); ctx.scale(s * 1.7, s * 1.7);
        drawDog(ctx, -3, 8, 0, { sit: true, facing: 1, accs: [k] });
        ctx.restore();
      };
    });
  }

  /** 還沒收養：坐在岸邊等人（near = 船靠近，頭上冒個愛心） */
  function drawWaiting(ctx, x, y, t, near) {
    if (near) {
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y - 8, 17 + Math.sin(t * 0.1) * 2, 0, Math.PI * 2); ctx.stroke();
      const hb = Math.sin(t * 0.12) * 2 - 6;
      ctx.fillStyle = '#ff8aa0';
      ctx.beginPath();
      ctx.arc(x + 2, y - 21 + hb, 2, 0, Math.PI * 2); ctx.arc(x + 5.6, y - 21 + hb, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + 0.2, y - 20.4 + hb); ctx.lineTo(x + 3.8, y - 16.5 + hb); ctx.lineTo(x + 7.4, y - 20.4 + hb); ctx.fill();
    }
    drawDog(ctx, x, y, t, { sit: true, facing: -1, accs: typeof Shop !== 'undefined' ? Shop.dogAccs() : [] });
  }

  /** 收養之後：跟在主角後面（WorldMap 畫完、主角畫之前呼叫，狗在主角下面一層） */
  function drawFollower(ctx, t) {
    if (mermaidOn() && mer.ready) {
      if (Quests.merHuman && Quests.merHuman()) drawThalassa(ctx, mer.x, mer.y, t, mer.facing, mer.inWater);
      else drawMermaid(ctx, mer.x, mer.y, t, mer.facing, mer.inWater);
    }
    if (!adopted() || !dog.ready) return;
    drawDog(ctx, dog.x, dog.y, t, { facing: dog.facing, swim: dog.inWater, accs: typeof Shop !== 'undefined' ? Shop.dogAccs() : [] });
  }

  return {
    SPOT: SPOT,
    adopted: adopted,
    mermaidOn: mermaidOn,
    mermaid: mer,
    drawMermaid: drawMermaid,
    MER_OUTFITS: MER_OUTFITS,
    merOutfit: merOutfit,
    /** 衣服的商品圖示：小人魚穿那一套（Sprites.icon 的格式：原點在中心、s = 縮放） */
    drawOutfitIcon: function (ctx, s, k) {
      ctx.save(); ctx.scale(s * 2.4, s * 2.4); ctx.translate(1, 10);
      chibiMer(ctx, 0, false, 0, MER_OUTFITS[k]);
      ctx.restore();
    },
    drawThalassa: drawThalassa,
    spotPin: spotPin,
    update: update,
    snap: snap,
    pos: function () { return { x: dog.x, y: dog.y, ready: dog.ready, inWater: dog.inWater }; },
    drawWaiting: drawWaiting,
    drawFollower: drawFollower
  };
})();
