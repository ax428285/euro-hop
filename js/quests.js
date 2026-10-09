'use strict';

/**
 * 地圖上的劇情人物與委託（v1.30）。
 *
 *   雷神索爾   北海上：北歐被他的結界罩住（船開不進去、進不了城）。
 *              跟他講過話 → 知道洛基躲在卡律布狄斯的漩渦底下；
 *              在「漩渦逃生」裡故意死掉 → 掉進冥界赫爾海姆（expedition.js 的豎井關），最底下遇到洛基；
 *              回來再找索爾 → 一段逗趣的對話，結界解開 = 北歐篇開放（取代原本的 700 EXP）。
 *   哥倫布     塞維亞：委託你打敗西歐五國的戰艦（expedition.js 的戰艦海戰），完成 → 美洲篇開放（v1.31）。
 *              美洲篇是另一張「新大陸」地圖：歐洲地圖往西開到底就橫越大西洋；哥倫布在巴哈馬群島的安德羅斯島上等你（AM_SPOTS）。
 *   瑞士銀行   日內瓦：歐洲任意 10 國的金幣收滿過就能開戶（v1.31 從「全部」降到 10 國）；之後每分鐘生 1 枚金幣的利息（離開遊戲也算，最多一天份）。
 *   動物園     阿爾及爾：放撒哈拉動物大遷徙抓回來的動物，每過一天收一次門票。
 *   金字塔     吉薩：直接進「金字塔探險」（expedition.js）。
 *   埃及豔后   西奈半島：賣「聖蛇護身符」（ASP_COST 金幣）—— 買過之後比利時的扒手永遠偷不到你（聖蛇會把他嚇跑）。
 *
 * 對話（talk）回傳 { who, lines: [{ who, text }], panel?, end? }，game.js 的 'talk' 場景負責顯示。
 * end() 在講完時呼叫，可以回傳 { toast, sfx, start }（start = 要開始的探險，例如 'pyramid'）。
 * 劇情進度存在 Save.flag（thorAsked / loki / north / columbus）。
 */
const Quests = (function () {

  // 西奈半島（埃及的圖釘、亞歷山卓港、失落的金字塔附近都很擠，這裡最空）
  const CLEO_AT = [33.8, 29.3];
  const ASP_COST = 500;          // v1.31 金幣來源變多 → 200 調到 500

  const SPOTS = [
    { id: 'Q_thor', npc: 'thor', name: '雷神索爾', lon: 5.6, lat: 58.4, prompt: '按 Enter 跟雷神索爾說話' },
    // v1.30 玩家：原本在加的斯灣，亞特蘭提斯的名牌擋到 → 搬到塞維亞（哥倫布的墓就在塞維亞大教堂）
    { id: 'Q_columbus', npc: 'columbus', name: '哥倫布', lon: -6.0, lat: 38.2, prompt: '按 Enter 跟哥倫布說話' },
    { id: 'Q_bank', npc: 'bank', name: '瑞士銀行', lon: 6.2, lat: 46.3, prompt: '按 Enter 進入瑞士銀行' },
    { id: 'Q_zoo', npc: 'zoo', name: '阿爾及爾動物園', lon: 3.1, lat: 36.3, prompt: '按 Enter 參觀阿爾及爾動物園' },
    // v1.30 玩家：太靠近亞歷山卓港和埃及的圖釘 → 搬到南邊的沙漠深處，改叫「失落的金字塔」
    { id: 'Q_pyramid', npc: 'pyramid', name: '失落的金字塔', lon: 32.5, lat: 24.5, prompt: '按 Enter 走進失落的金字塔' },
    // v1.30 玩家：增加埃及豔后 NPC（用途自由發揮）→ 西奈半島的金色遊船上，賣嚇跑比利時扒手的聖蛇護身符
    { id: 'Q_cleopatra', npc: 'cleopatra', name: '埃及豔后', lon: CLEO_AT[0], lat: CLEO_AT[1], prompt: '按 Enter 晉見埃及豔后' }
  ];

  /*
   * v1.31 新大陸地圖上的地點（用美洲的投影，見 WorldMap.buildAmericaSpecials）。
   *   哥倫布：巴哈馬群島（1492 年 10 月 12 日他在群島東邊的聖薩爾瓦多島第一次踏上美洲）。
   *     v1.31 玩家：放在海上好奇怪 → 聖薩爾瓦多島太小、地圖資料裡沒有，改站在群島最大的安德羅斯島上。
   */
  const AM_SPOTS = [
    { id: 'Q_columbusAm', npc: 'columbusAm', name: '哥倫布', lon: -77.95, lat: 24.4, prompt: '按 Enter 跟哥倫布說話' },
    // v1.31 玩家：除了能力想想還能買甚麼 → 兩家只賣外觀的店（shop.js 的 boutique / petshop）
    { id: 'M_boutique', seller: 'boutique', name: '聖胡安服裝店', lon: -66.1, lat: 18.4, prompt: '按 Enter 逛聖胡安服裝店' },
    { id: 'M_petshop', seller: 'petshop', name: '千里達寵物用品店', lon: -61.3, lat: 10.6, prompt: '按 Enter 逛千里達寵物用品店' }
  ];

  const NAMES = { thor: '雷神索爾', loki: '洛基', me: '你', columbus: '哥倫布', banker: '銀行家', keeper: '動物園園長', cleopatra: '埃及豔后', mermaid: '人魚 Thalassa', thalassa: 'Thalassa' };

  function flag(k) { return typeof Save !== 'undefined' ? Save.flag(k) : 0; }
  function northOpen() { return !!flag('north'); }
  /** v1.31 美洲篇開放了嗎：完成哥倫布的委託（他出航之後） */
  function americaOpen() { return flag('columbus') >= 2; }
  /** v1.31.2 亞特蘭提斯海底城開放了嗎：在亞特蘭提斯潛水關的最底層解開「海神的封印」之後（abyss.js 的 riddle） */
  function abyssOpen() { return !!flag('abyssGate'); }
  /** v1.31.2 海底城全破之後，跟人魚說話她就跟你走（pet.js 畫在後面） */
  function mermaidJoined() { return !!flag('mermaid'); }
  /*
   * v1.31.2 人魚的好感度：把撿到的紀念品（souvenirs.js）送給 Thalassa，每送一樣 +1，全部送完 = 滿。
   * 送出去的紀念品還是算你收集到的（Save.souvenirs 不動），只多記一個旗標 merGift_<id>；她家的架子上會擺出來。
   * 好感度全滿＋打倒暗夜騎士＋她跟著你 → 走到巴黎（法國的圖釘）會看巴黎鐵塔的夜景，看完她變成人類（flag merHuman）。
   */
  function merGifted(id) { return !!flag('merGift_' + id); }
  function merLove() { return typeof Souvenirs === 'undefined' ? 0 : Souvenirs.defs.filter(function (d) { return merGifted(d.id); }).length; }
  function merLoveMax() { return typeof Souvenirs === 'undefined' ? 1 : Souvenirs.count; }
  function merHuman() { return !!flag('merHuman'); }
  function eiffelReady() {
    return mermaidJoined() && !merHuman() && merLove() >= merLoveMax() && Save.seaBossDown('darkKnight');
  }
  /** 卡律布狄斯的漩渦眼掉下去要不要接冥界：v1.30 玩家：進漩渦關掉下去一次就進得去 → 一律會（救出洛基後再去也行） */
  function helReady() { return true; }

  // ── 北歐的結界 ──────────────────────────────────────────

  function inPoly(x, y, pts) {
    let ins = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi) ins = !ins;
    }
    return ins;
  }
  function northNations() {
    if (typeof WorldMap === 'undefined') return [];
    return WorldMap.nations.filter(function (n) { return Levels.list[n.idx].region === 'north'; });
  }
  /** 給 Voyage：(x, y) 被結界擋住嗎（北歐的國土，還沒解開時） */
  function blocked(x, y) {
    if (northOpen()) return false;
    return northNations().some(function (n) {
      return n.shapes.some(function (sh) { return inPoly(x, y, sh); });
    });
  }

  /** 結界：北歐國土蓋一層會流動的藍白電光（還沒解開時才畫） */
  function drawShield(ctx, t) {
    if (northOpen()) return;
    ctx.save();
    northNations().forEach(function (n) {
      n.shapes.forEach(function (sh) {
        ctx.beginPath();
        sh.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
        ctx.closePath();
        // 偏金色的電光（羊皮紙地圖的海是淡青色，用藍色蓋上去會分不出哪裡是陸地）
        ctx.fillStyle = 'rgba(255, 226, 140, ' + (0.2 + Math.sin(t * 0.05) * 0.05).toFixed(3) + ')';
        ctx.fill();
        ctx.save();
        ctx.clip();
        // 斜斜流動的光紋
        ctx.strokeStyle = 'rgba(255, 250, 220, 0.4)'; ctx.lineWidth = 1.2;
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        sh.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
        const off = (t * 0.6) % 14;
        for (let k = x0 - (y1 - y0) - 14 + off; k < x1; k += 14) {
          ctx.beginPath(); ctx.moveTo(k, y1); ctx.lineTo(k + (y1 - y0), y0); ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(255, 210, 90, ' + (0.6 + Math.sin(t * 0.12) * 0.3).toFixed(2) + ')';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    });
    // 偶爾劈下來的小閃電（在結界邊上）
    const ns = northNations();
    if (ns.length && t % 90 < 8) {
      const n = ns[Math.floor(t / 90) % ns.length];
      const pin = n.pin;
      ctx.strokeStyle = 'rgba(255, 250, 200, 0.9)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(pin[0] - 6, pin[1] - 40); ctx.lineTo(pin[0] + 2, pin[1] - 26); ctx.lineTo(pin[0] - 3, pin[1] - 22); ctx.lineTo(pin[0] + 5, pin[1] - 8); ctx.stroke();
    }
    ctx.restore();
  }

  // ── 地圖上的人物圖示 ─────────────────────────────────────

  function ring(ctx, x, y, t, near, color) {
    if (!near) return;
    ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y - 8, 17 + Math.sin(t * 0.1) * 2, 0, Math.PI * 2); ctx.stroke();
  }

  /** 小人：x, y = 腳底；body = 衣服顏色、head = 頭部畫法 */
  function tinyPerson(ctx, x, y, body, skin) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x, y, 7, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x - 4, y - 14); ctx.lineTo(x + 4, y - 14); ctx.lineTo(x + 6, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = skin || '#f0c49a';
    ctx.beginPath(); ctx.arc(x, y - 18, 4.5, 0, Math.PI * 2); ctx.fill();
  }

  function drawMapIcon(ctx, kind, x, y, t, near) {
    ctx.save();
    if (kind === 'merHome') {
      // v1.31.2 人魚的家：一顆粉紅色的大螺貝殼屋，圓窗亮著燈；好感度有幾格就冒幾顆愛心（送滿了一直冒）
      ring(ctx, x, y, t, near, 'rgba(255, 150, 200, 0.95)');
      ctx.fillStyle = '#f2a0c0';
      ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.quadraticCurveTo(x - 14, y - 16, x, y - 24); ctx.quadraticCurveTo(x + 14, y - 16, x + 12, y); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#c86a98'; ctx.lineWidth = 1.2;
      for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(x - 12 + k * 2, y - k * 6); ctx.quadraticCurveTo(x, y - k * 6 - 4, x + 12 - k * 2, y - k * 6); ctx.stroke(); }
      ctx.fillStyle = '#7a3a5a'; U.roundRect(ctx, x - 3, y - 8, 6, 8, 3); ctx.fill();
      ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(x + 6, y - 13, 2.2, 0, Math.PI * 2); ctx.fill();
      if (merLove() > 0) {
        const hb = ((t * 0.6) % 40) / 40;
        ctx.fillStyle = 'rgba(255, 110, 150, ' + (1 - hb).toFixed(2) + ')';
        const hx = x + 4, hy = y - 28 - hb * 14;
        ctx.beginPath(); ctx.arc(hx - 1.8, hy, 2, 0, Math.PI * 2); ctx.arc(hx + 1.8, hy, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(hx - 3.8, hy + 0.6); ctx.lineTo(hx, hy + 4.5); ctx.lineTo(hx + 3.8, hy + 0.6); ctx.fill();
      }
      ctx.restore();
      return;
    }
    if (kind === 'mermaid') {
      // v1.31.2 海底城的人魚：坐在一塊石頭上，青綠色的頭髮、會甩的魚尾巴
      ring(ctx, x, y, t, near, 'rgba(150, 240, 255, 0.95)');
      ctx.fillStyle = '#5a6a7a';
      ctx.beginPath(); ctx.ellipse(x, y, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
      const wag = Math.sin(t * 0.1) * 3;
      ctx.fillStyle = '#2ab0a0';
      ctx.beginPath(); ctx.moveTo(x - 3, y - 6); ctx.quadraticCurveTo(x + 4, y - 2, x + 9, y - 4 + wag); ctx.lineTo(x + 13, y - 8 + wag); ctx.lineTo(x + 12, y - 1 + wag); ctx.quadraticCurveTo(x + 2, y + 2, x - 4, y - 2); ctx.fill();
      // v1.31.2 辣一點：露肩、貝殼上衣、一大把披到腰的長髮，身邊一閃一閃
      ctx.fillStyle = '#f2d2bc'; ctx.fillRect(x - 4, y - 13, 7, 6);
      ctx.fillStyle = '#e86aa8'; ctx.beginPath(); ctx.arc(x - 2.4, y - 10.5, 2, 0, Math.PI * 2); ctx.arc(x + 1.6, y - 10.5, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2d2bc'; ctx.beginPath(); ctx.arc(x - 1, y - 16, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#26c4b4'; ctx.beginPath(); ctx.arc(x - 2, y - 17, 4.6, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 6, y - 17); ctx.quadraticCurveTo(x - 9, y - 10, x - 6, y - 5); ctx.lineTo(x - 3, y - 7); ctx.lineTo(x - 3, y - 17); ctx.fill();
      ctx.fillStyle = '#d8203a'; ctx.fillRect(x, y - 14, 2, 1);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      const sp = 1 + Math.abs(Math.sin(t * 0.15)) * 2;
      ctx.fillRect(x + 7 - sp, y - 20, sp * 2, 1); ctx.fillRect(x + 6.5, y - 20.5 - sp, 1, sp * 2);
      ctx.restore();
      return;
    }
    if (kind === 'thor') {
      ring(ctx, x, y, t, near, 'rgba(255, 230, 140, 0.95)');
      // 站在一朵雷雲上
      ctx.fillStyle = 'rgba(90, 100, 130, 0.85)';
      ctx.beginPath(); ctx.ellipse(x, y, 13, 5, 0, 0, Math.PI * 2); ctx.ellipse(x - 7, y - 2, 7, 4, 0, 0, Math.PI * 2); ctx.ellipse(x + 7, y - 2, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
      tinyPerson(ctx, x, y - 3, '#3a5aa0');
      ctx.fillStyle = '#c0281e';
      ctx.fillRect(x - 6, y - 15, 3, 13);                       // 紅披風
      ctx.fillStyle = '#d8622a';
      ctx.beginPath(); ctx.arc(x, y - 18, 4.5, 0.2, Math.PI - 0.2); ctx.fill();   // 紅鬍子
      ctx.fillStyle = '#a0a8b4';
      ctx.beginPath(); ctx.arc(x, y - 22, 4.6, Math.PI, 0); ctx.fill();          // 頭盔
      // 舉起的雷神之鎚
      const sw = Math.sin(t * 0.08) * 0.2;
      ctx.save(); ctx.translate(x + 5, y - 14); ctx.rotate(-0.6 + sw);
      ctx.fillStyle = '#6a4a30'; ctx.fillRect(-1, -10, 2, 10);
      ctx.fillStyle = '#9aa2ae'; ctx.fillRect(-4, -14, 8, 5);
      ctx.restore();
      if (t % 70 < 6) {
        ctx.strokeStyle = 'rgba(255, 250, 190, 0.95)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x + 9, y - 34); ctx.lineTo(x + 5, y - 28); ctx.lineTo(x + 9, y - 26); ctx.lineTo(x + 4, y - 20); ctx.stroke();
      }
    } else if (kind === 'columbus' || kind === 'columbusAm') {
      ring(ctx, x, y, t, near, 'rgba(255, 220, 150, 0.95)');
      // 哥倫布：黑外套、黑帽子，捧著一顆地球儀（他相信往西一直開就能到印度）
      tinyPerson(ctx, x, y, '#2a2a3a');
      ctx.fillStyle = '#1a1a20';
      ctx.fillRect(x - 6, y - 23, 12, 2); ctx.fillRect(x - 3.5, y - 27, 7, 4);   // 帽子
      ctx.fillStyle = '#c8c0b0'; ctx.fillRect(x - 5, y - 20, 2, 6); ctx.fillRect(x + 3, y - 20, 2, 6);   // 灰白頭髮
      const gx = x + 9, gy = y - 10;
      ctx.fillStyle = '#3a7ab8'; ctx.beginPath(); ctx.arc(gx, gy, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7ab060';
      ctx.beginPath(); ctx.ellipse(gx - 1 + Math.sin(t * 0.03) * 1.5, gy - 1, 2, 1.6, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c8a040'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(gx, gy, 5.5, -1.2, 2.2); ctx.stroke();
    } else if (kind === 'bank') {
      ring(ctx, x, y, t, near, 'rgba(255, 209, 102, 0.95)');
      // 銀行：三角山牆＋四根柱子＋門口的金幣
      const open = typeof Save !== 'undefined' && Save.bank().open;
      ctx.fillStyle = '#e8e2d2';
      ctx.beginPath(); ctx.moveTo(x - 12, y - 16); ctx.lineTo(x, y - 24); ctx.lineTo(x + 12, y - 16); ctx.closePath(); ctx.fill();
      ctx.fillRect(x - 11, y - 3, 22, 3);
      for (let k = 0; k < 4; k++) ctx.fillRect(x - 10 + k * 6, y - 15, 3, 12);
      ctx.fillStyle = '#c8102e'; ctx.fillRect(x - 3, y - 21, 6, 4);              // 瑞士國旗
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 0.6, y - 20.5, 1.2, 3); ctx.fillRect(x - 1.5, y - 19.6, 3, 1.2);
      if (open) {
        ctx.fillStyle = '#f2c94c';
        ctx.beginPath(); ctx.arc(x + 12, y - 4 - Math.abs(Math.sin(t * 0.08)) * 4, 3, 0, Math.PI * 2); ctx.fill();
      }
    } else if (kind === 'zoo') {
      ring(ctx, x, y, t, near, 'rgba(160, 230, 140, 0.95)');
      // 動物園：拱門＋長頸鹿探出頭
      ctx.fillStyle = '#8a5a30';
      ctx.fillRect(x - 12, y - 16, 3, 16); ctx.fillRect(x + 9, y - 16, 3, 16);
      ctx.fillStyle = '#3a8a4a'; ctx.fillRect(x - 13, y - 20, 26, 5);
      ctx.fillStyle = '#e8b04a';
      ctx.fillRect(x + 1, y - 30, 3, 22);
      ctx.beginPath(); ctx.ellipse(x + 4, y - 31, 4, 2.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a5a20';
      ctx.fillRect(x + 1.6, y - 26, 1.6, 1.6); ctx.fillRect(x + 2, y - 20, 1.6, 1.6);
    } else if (kind === 'cleopatra') {
      ring(ctx, x, y, t, near, 'rgba(255, 220, 120, 0.95)');
      // 金色遊船，船上站著白袍、黑色齊瀏海、金頭冠的女王，旁邊一隻昂首的眼鏡蛇
      ctx.fillStyle = '#c99a2e';
      ctx.beginPath(); ctx.moveTo(-15 + x, y - 3); ctx.lineTo(15 + x, y - 3); ctx.quadraticCurveTo(13 + x, y + 3, x, y + 3); ctx.quadraticCurveTo(-13 + x, y + 3, -15 + x, y - 3); ctx.fill();
      ctx.fillRect(x - 17, y - 9, 3, 7); ctx.fillRect(x + 14, y - 9, 3, 7);
      tinyPerson(ctx, x - 2, y - 3, '#f4efe2', '#c8946a');
      ctx.fillStyle = '#16161a';
      ctx.beginPath(); ctx.arc(x - 2, y - 22, 5, Math.PI, 0); ctx.fill();
      ctx.fillRect(x - 7, y - 22, 3, 7); ctx.fillRect(x + 3, y - 22, 3, 7);          // 齊肩黑髮
      ctx.fillStyle = '#f2c94c'; ctx.fillRect(x - 7, y - 24, 10, 2);                 // 金頭冠
      const sw = Math.sin(t * 0.09) * 1.5;
      ctx.strokeStyle = '#3a6a3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 6, y - 3); ctx.quadraticCurveTo(x + 11, y - 6, x + 8 + sw, y - 12); ctx.stroke();
      ctx.fillStyle = '#3a6a3a'; ctx.beginPath(); ctx.ellipse(x + 8 + sw, y - 13, 2.6, 2, 0, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'pyramid') {
      ring(ctx, x, y, t, near, 'rgba(255, 220, 140, 0.95)');
      // 半埋在沙丘裡
      ctx.fillStyle = 'rgba(200, 160, 100, 0.5)';
      ctx.beginPath(); ctx.ellipse(x, y + 1, 20, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8b070';
      ctx.beginPath(); ctx.moveTo(x - 15, y); ctx.lineTo(x, y - 20); ctx.lineTo(x + 15, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(120, 80, 40, 0.35)';
      ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x + 15, y); ctx.lineTo(x + 4, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - 2, y - 6, 4, 6);              // 入口
      const g = 0.5 + Math.sin(t * 0.1) * 0.3;
      ctx.fillStyle = 'rgba(255, 230, 140, ' + g.toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(x, y - 22, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /** 地圖上額外的東西：美洲預告（往西的箭頭＋字），哥倫布出航後才有 */
  // ── 比利時的扒手 ───────────────────────────────────────
  /*
   * v1.30 玩家：新增比利時，到那邊會被偷錢 100 元（歐洲扒手多）。v1.31.2 玩家：偷 50 就好。
   * 比利時不是關卡國，只在地圖上標國名＋國旗；走進比利時的國土、或船開進奧斯坦德前面那個小海灣的底（PICK_R 以內），
   * 就被扒走 PICK_COINS 枚（海灣的範圍刻意小：去荷蘭港口的船停在海灣東側，碰不到）。
   * 錢包不夠就全拿。離開比利時、也離海灣夠遠（PICK_REARM 以外）才會再被偷一次，不會停在那邊一直扣。
   */
  const PICK_AT = [2.6, 51.35], PICK_OFF = [-3, -8], PICK_R = 18, PICK_REARM = 60, PICK_COINS = 50;
  let pickArmed = true;
  function pickSpot() { const p = EuropeWorld.project(PICK_AT[0], PICK_AT[1]); return [p[0] + PICK_OFF[0], p[1] + PICK_OFF[1]]; }
  /** 大地圖每帧呼叫：這一帧被偷了幾枚（0 = 沒事） */
  function pickpocket(ship) {
    if (typeof Save === 'undefined' || typeof EuropeWorld === 'undefined') return 0;
    if (typeof WorldMap !== 'undefined' && WorldMap.world && WorldMap.world() !== 'eu') return 0;   // 新大陸沒有比利時
    const p = pickSpot(), d = Math.hypot(ship.x - p[0], ship.y - p[1]);
    const inBE = typeof EuropeBackdrop !== 'undefined' && EuropeBackdrop.BE &&
                 EuropeBackdrop.BE.shapes.some(function (sh) { return inPoly(ship.x, ship.y, sh); });
    if (!inBE && d > PICK_REARM) { pickArmed = true; return 0; }
    if (!pickArmed || (!inBE && d > PICK_R)) return 0;
    pickArmed = false;
    if (hasAsp()) return -2;   // -2：被埃及豔后的聖蛇嚇跑（v1.30 玩家：買過就永遠不怕扒手）
    const n = Math.min(PICK_COINS, Save.get().wallet || 0);
    if (n > 0) { Save.spendCoins(n); Save.setFlag('robbed', (flag('robbed') || 0) + n); }
    return n || -1;          // -1：錢包空空，扒手摸了個空
  }
  /** 港邊鬼鬼祟祟的扒手：戴黑帽、揹著錢袋，左右張望 */
  /** 埃及豔后的聖蛇護身符還在嗎（v1.30）：在的話扒手會被嚇跑 */
  function hasAsp() { return !!flag('asp'); }
  function drawPickpocket(ctx, t) {
    const p = pickSpot(), x = p[0] + 8, y = p[1] + 16;
    tinyPerson(ctx, x, y, '#2a2a30');
    ctx.fillStyle = '#16161a';
    ctx.fillRect(x - 6, y - 23, 12, 2); ctx.fillRect(x - 4, y - 28, 8, 5);
    const look = Math.sin(t * 0.05) > 0 ? 1 : -1;
    ctx.fillStyle = '#16161a'; ctx.fillRect(x + look * 1.5 - 1, y - 19, 2, 1.5);
    ctx.fillStyle = '#c9a227';
    ctx.beginPath(); ctx.arc(x - look * 8, y - 6, 4, 0, Math.PI * 2); ctx.fill();
    U.text(ctx, '$', x - look * 8, y - 5.5, { size: 6, weight: 800, color: '#5a4310', stroke: false });
  }

  function drawMapExtras(ctx, t) {
    if (typeof EuropeWorld !== 'undefined') drawPickpocket(ctx, t);
    if (flag('columbus') < 2 || typeof EuropeWorld === 'undefined') return;
    const p = EuropeWorld.project(-21, 41);
    ctx.save();
    const rc = 'rgba(120, 60, 30, 0.55)';
    U.text(ctx, '←　美　洲', p[0], p[1], { size: 22, weight: 800, color: rc, stroke: false });
    U.text(ctx, '（一直往西開）', p[0] + 6, p[1] + 22, { size: 12, color: rc, stroke: false });
    // 往西航行的聖瑪利亞號（一直往左飄，飄出去再從右邊回來）
    const k = (t * 0.15) % 160;
    ctx.translate(p[0] + 90 - k, p[1] + 50);
    ctx.fillStyle = 'rgba(106, 66, 40, 0.8)';
    ctx.beginPath(); ctx.moveTo(-10, -2); ctx.lineTo(10, -2); ctx.lineTo(7, 3); ctx.lineTo(-7, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(244, 239, 226, 0.9)';
    ctx.beginPath(); ctx.moveTo(1, -16); ctx.quadraticCurveTo(-7, -10, 1, -4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ── 銀行 ───────────────────────────────────────────────

  const BANK_OFFLINE_MAX = 24 * 60;      // 離開遊戲的期間最多算一天份的利息
  const BANK_NEED = 10;                  // v1.31 玩家：要收滿歐洲全部國家太多了 → 任意 10 國的金幣收滿就能開戶
  /** 歐洲（西歐、東歐、北歐篇）每一關：金幣有沒有收滿過 */
  function coinProgress() {
    const sv = Save.get();
    let got = 0, total = 0;
    Levels.list.forEach(function (lv, i) {
      if (['west', 'east', 'north'].indexOf(lv.region || 'west') < 0) return;
      total++;
      const b = sv.best[i];
      if (b && b.total > 0 && b.coins >= b.total) got++;
    });
    return { got: got, total: total, need: Math.min(BANK_NEED, total) };
  }
  /** 地圖上每帧呼叫：開戶後每過一分鐘存入 1 枚（用真實時間算，所以在關卡裡、離開遊戲都有在算） */
  let tickT = 0;
  function tick() {
    if (typeof Save === 'undefined' || ++tickT % 60) return;
    const b = Save.bank();
    if (!b.open) return;
    const now = Date.now();
    if (!b.last || b.last > now) { b.last = now; Save.touch(); return; }
    const mins = Math.floor((now - b.last) / 60000);
    if (mins <= 0) return;
    b.bal += Math.min(mins, BANK_OFFLINE_MAX);
    b.last += mins * 60000;
    Save.touch();
  }

  // ── 動物園 ─────────────────────────────────────────────

  // 每隻每天的門票收入（稀有的比較吸引人）
  const ANIMALS = {
    zebra: { name: '斑馬', fee: 3 }, wildebeest: { name: '牛羚', fee: 2 }, gazelle: { name: '瞪羚', fee: 2 },
    giraffe: { name: '長頸鹿', fee: 4 }, lion: { name: '獅子', fee: 8 }, elephant: { name: '大象', fee: 8 }
  };
  function zooFee() {
    const z = Save.zoo();
    return Object.keys(z).reduce(function (s, k) { return s + (ANIMALS[k] ? ANIMALS[k].fee * z[k] : 0); }, 0);
  }
  function zooCount() {
    const z = Save.zoo();
    return Object.keys(z).reduce(function (s, k) { return s + z[k]; }, 0);
  }

  // ── 對話 ───────────────────────────────────────────────

  function L(who, text) { return { who: who, text: text }; }

  function talkThor() {
    if (northOpen()) {
      return { who: 'thor', lines: [
        L('thor', '北歐的大門為你敞開！峽灣、冰湖、極光都等著你。'),
        L('thor', '要是又看到洛基，幫我在他屁股上踹一腳。')
      ] };
    }
    if (flag('loki')) {
      return { who: 'thor', lines: [
        L('thor', '你回來了！⋯⋯咦，你身上怎麼有一股冥界的霉味？'),
        L('me', '我在冥界最底下找到洛基了。他要我帶一句話給你。'),
        L('thor', '那個小偷！他把我的雷神之鎚藏到哪去了？'),
        L('me', '他說：「鎚子一直都在你自己的床底下。」'),
        L('thor', '⋯⋯'),
        L('thor', '⋯⋯（彎腰看了一眼）⋯⋯在、在了。'),
        L('thor', '我找了整整三天，連拉車的兩頭山羊都被我審問過一遍！'),
        L('thor', '咳。總之，謝謝你，旅行者。這件事不准說出去。'),
        L('thor', '雷神之鎚，回來 —— 北歐的結界，解開！')
      ], end: function () {
        Save.setFlag('north', 1);
        return { sfx: 'fanfare', shake: 14, toast: { text: '北歐的結界解開了！', sub: '丹麥、瑞典、挪威、芬蘭、冰島都可以去了', life: 260 } };
      } };
    }
    // v1.30 玩家：提示要隱晦一點 —— 不直接講地名，用謎語
    return { who: 'thor', lines: [
      L('thor', '站住！我是雷神索爾。北歐已經被我的雷電結界封起來了。'),
      L('thor', '洛基那個搗蛋鬼偷了我的雷神之鎚！在抓到他之前，誰都別想進去。'),
      L('me', '洛基在哪裡？'),
      L('thor', '烏鴉告訴我：他往南逃了，逃到一片溫暖的海，那裡有一張「吞下船的嘴」。'),
      L('thor', '活人是進不去那裡的⋯⋯除非你自己往那張嘴的正中央跳下去，一路被吞到最深的地方。'),
      L('thor', '⋯⋯喂，你那是什麼表情？我可沒叫你去送死喔。')
    ], end: function () {
      Save.setFlag('thorAsked', 1);
      return { toast: { text: '索爾的謎語', sub: '南方溫暖的海，有一張「吞下船的嘴」⋯⋯往它的正中央跳下去', life: 280 } };
    } };
  }

  /*
   * 冥界最底下的洛基（探險打完、回到地圖時由 game.js 打開）。
   * v1.30 玩家：洛基被鎖在冥界的牢籠裡，要有「神祕的鑰匙」（失落的金字塔深處）才救得出來。
   * 沒有鑰匙：只隔著欄杆講兩句（提示鎖是哪裡的東西），然後就被傳回大地圖。
   */
  function talkLokiLocked() {
    return { who: 'loki', lines: [
      L('loki', '喂！別光站在那裡看，快放我出去！'),
      L('loki', '冥界的女主人把我關在這個籠子裡⋯⋯這把鎖可不是北歐的東西。'),
      L('loki', '你看鎖頭上刻的：一隻畫著眼線的眼睛，還有一個頭上帶圈的十字。'),
      L('loki', '那是曬著大太陽、滿地黃沙的國度才有的手藝。去找能打開它的鑰匙吧！')
    ], end: function () {
      Save.setFlag('lokiSeen', 1);
      return { toast: { text: '洛基被鎖在冥界的牢籠裡', sub: '鎖上刻著眼睛和帶圈的十字⋯⋯得找到能打開它的鑰匙', life: 280 } };
    } };
  }

  function talkLoki() {
    return { who: 'loki', lines: [
      L('me', '我帶來了一把鑰匙 —— 在一座被沙子埋住的金字塔深處找到的。'),
      L('loki', '⋯⋯喀擦！哈！自由了！'),
      L('loki', '你是第一個「故意」掉下來、還帶著鑰匙的人類。'),
      L('loki', '讓我猜猜：那個肌肉比腦袋大的雷神派你來的？'),
      L('me', '索爾說你偷了他的雷神之鎚。'),
      L('loki', '偷？說得真難聽。我只是借來壓住他床底下那疊沒洗的襪子。'),
      L('loki', '回去告訴他：鎚子一直都在他自己的床底下。'),
      L('loki', '還有，別說是我說的⋯⋯好啦，說了也沒關係，反正他追不到我。')
    ], end: function () {
      Save.setFlag('loki', 1);
      return { toast: { text: '救出洛基了！', sub: '回北海找雷神索爾，把洛基的話告訴他', life: 240 } };
    } };
  }

  function talkColumbus() {
    const st = flag('columbus');
    const ships = typeof Expedition !== 'undefined' ? Expedition.WARSHIPS : [];
    const left = ships.filter(function (w) { return !Save.seaBossDown(w.kind); });
    if (st >= 2) {
      return { who: 'columbus', lines: [
        L('columbus', '我回來了！大西洋的另一邊，真的有一片陸地。'),
        L('columbus', '我還是覺得那裡是印度⋯⋯可是大家都說，那是一片新大陸。'),
        L('columbus', '你也去看看吧：從地圖最西邊一直往西開，就能橫越大西洋。')
      ] };
    }
    if (st === 1 && !left.length) {
      return { who: 'columbus', lines: [
        L('columbus', '五國的戰艦都退開了！海面終於清空了。'),
        L('columbus', '1492 年 8 月 3 日，我的聖瑪利亞號、平塔號、尼尼亞號從帕洛斯港出發⋯⋯'),
        L('columbus', '一路往西，找一條通往印度的新航路！'),
        L('columbus', '等我回來，再告訴你海的另一邊有什麼。謝謝你，年輕的船長！')
      ], end: function () {
        Save.setFlag('columbus', 2);
        Save.addCoins(500);
        return { sfx: 'fanfare', toast: { text: '哥倫布出航了！委託完成 +€ 500', sub: '美洲篇開放了！從地圖最西邊一直往西開，就能橫越大西洋', life: 300 } };
      } };
    }
    if (st === 1) {
      return { who: 'columbus', lines: [
        L('columbus', '還剩 ' + left.length + ' 艘戰艦擋在海上：'),
        L('columbus', left.map(function (w) { return w.country; }).join('、') + '。'),
        L('columbus', '地圖上掛著國旗的大船就是。記得先去瓦倫西亞造船廠升級船首砲和火藥庫！')
      ] };
    }
    return { who: 'columbus', lines: [
      L('columbus', '年輕的船長！我是克里斯多福・哥倫布，熱那亞人。'),
      L('columbus', '我要往西橫越大西洋，找一條通往印度的新航路。'),
      L('columbus', '可是西歐各國的戰艦都在海上巡邏，誰也不讓我過去。'),
      L('columbus', '幫我打敗' + ships.map(function (w) { return w.country; }).join('、') + '這' + ships.length + '國的戰艦吧！'),
      L('columbus', '戰艦很硬，船首砲越多門、火藥越強越好打 —— 瓦倫西亞造船廠可以升級。')
    ], end: function () {
      Save.setFlag('columbus', 1);
      return { toast: { text: '接下哥倫布的委託', sub: '西歐五國的海上出現了戰艦（掛國旗的大船）', life: 240 } };
    } };
  }

  function talkBank() {
    const b = Save.bank();
    const pr = coinProgress();
    if (!b.open && pr.got < pr.need) {
      return { who: 'banker', lines: [
        L('banker', '歡迎光臨瑞士銀行。很抱歉，本行只接待真正的收藏家。'),
        L('banker', '請在歐洲任意 ' + pr.need + ' 個國家把金幣收集齊全（那一關的金幣拿滿過一次），再來開戶。'),
        L('banker', '目前您收滿了 ' + pr.got + ' / ' + pr.need + ' 國。祝您好運。')
      ] };
    }
    if (!b.open) {
      return { who: 'banker', lines: [
        L('banker', '⋯⋯' + pr.need + ' 個國家的金幣，全都收齊了？了不起。'),
        L('banker', '從今天起，您就是本行的尊貴客戶。'),
        L('banker', '您的帳戶每分鐘會生 1 枚金幣的利息 —— 就算您不在，金幣也會一直存進來。'),
        L('banker', '想領錢的時候，隨時回來找我。')
      ], end: function () {
        b.open = true; b.last = Date.now(); Save.touch();
        return { sfx: 'fanfare', toast: { text: '瑞士銀行開戶了！', sub: '每分鐘存入 1 枚金幣，回來這裡就能領', life: 240 } };
      } };
    }
    tick();
    if (b.bal <= 0) {
      return { who: 'banker', lines: [L('banker', '您的帳戶目前沒有新的利息。過幾分鐘再來吧，金幣會自己長出來的。')] };
    }
    const n = b.bal;
    return { who: 'banker', lines: [
      L('banker', '您的帳戶目前有 € ' + n + '。'),
      L('banker', '已經幫您全部領出來了。瑞士銀行，安全又準時。')
    ], end: function () {
      b.bal = 0; Save.touch(); Save.addCoins(n);
      return { sfx: 'coin', toast: { text: '從瑞士銀行領出 € ' + n, sub: '錢包餘額 € ' + Save.get().wallet, life: 200 } };
    } };
  }

  function talkZoo() {
    const sv = Save.get();
    const n = zooCount();
    if (!n) {
      return { who: 'keeper', lines: [
        L('keeper', '歡迎來到阿爾及爾動物園！⋯⋯雖然現在一隻動物都沒有。'),
        L('keeper', '聽說撒哈拉的邊緣有動物大遷徙，走路過去碰到牠們的話，跳到背上就抓得到！'),
        L('keeper', '每次遷徙只會經過一種動物。每種抓一隻回來就好，每過一天都會有遊客買門票。')
      ] };
    }
    const days = Math.max(0, sv.day - sv.zooDay);
    const fee = zooFee();
    const income = Math.min(days, 10) * fee;       // 太久沒來最多算 10 天
    const z = Save.zoo();
    // v1.30 玩家：每種動物一隻就好
    const list = Object.keys(ANIMALS).filter(function (k) { return z[k]; })
      .map(function (k) { return ANIMALS[k].name; }).join('、');
    return { who: 'keeper', panel: 'zoo', lines: [
      L('keeper', '動物們都很好！現在園裡有：' + list + '。'),
      income > 0 ? L('keeper', '這 ' + Math.min(days, 10) + ' 天的門票收入一共 € ' + income + '，給你！')
                 : L('keeper', '今天的門票剛收過了。每打完一關或一場海戰就算過了一天，再來看看吧。')
    ], end: function () {
      sv.zooDay = sv.day;
      if (income > 0) Save.addCoins(income); else Save.touch();
      return income > 0 ? { sfx: 'coin', toast: { text: '動物園門票收入 +€ ' + income, sub: '每天 € ' + fee + '（動物越多、越稀有，收入越多）', life: 200 } } : null;
    } };
  }

  /*
   * 埃及豔后（v1.30）：賣聖蛇護身符。對話沒有選項 → 最後一句說明「Enter 買、Esc 不買」，
   * end(complete) 只有把對話看完（complete = true）才付錢；中途按 Esc 離開不會買。
   */
  function talkCleopatra() {
    const robbed = flag('robbed') || 0;
    if (hasAsp()) {
      return { who: 'cleopatra', lines: [
        L('cleopatra', '我的聖蛇還盤在你的錢包上呢。'),
        L('cleopatra', '比利時那個扒手要是敢伸手⋯⋯嘶～保證他再也不敢了。')
      ] };
    }
    const lines = [
      L('cleopatra', '我是克麗奧佩脫拉七世，尼羅河的女王。'),
      robbed > 0 ? L('cleopatra', '聽說你在比利時被扒了 ' + robbed + ' 枚金幣？整個地中海都在笑呢。')
                 : L('cleopatra', '要去歐洲？小心比利時港邊的扒手，他們的手比尼羅河的鱷魚還快。'),
      L('cleopatra', '傳說我把一顆珍珠溶在醋裡喝掉，只為了跟安東尼打賭誰的晚宴比較貴。'),
      L('cleopatra', '財寶，就要讓聖蛇來守。牠是埃及的守護神，盤在你的錢包上，誰伸手就咬誰。')
    ];
    const w = Save.get().wallet || 0;
    if (w < ASP_COST) {
      lines.push(L('cleopatra', '一條聖蛇 ' + ASP_COST + ' 枚金幣。你身上只有 ' + w + ' 枚⋯⋯存夠了再來吧。'));
      return { who: 'cleopatra', lines: lines };
    }
    lines.push(L('cleopatra', '一條聖蛇 ' + ASP_COST + ' 枚金幣，牠會一輩子守著你的錢包。要的話按 Enter，不要就按 Esc 離開。'));
    return { who: 'cleopatra', lines: lines, end: function (complete) {
      if (!complete || !Save.spendCoins(ASP_COST)) return null;
      Save.setFlag('asp', 1);
      return { sfx: 'equip', toast: { text: '得到聖蛇護身符！-' + ASP_COST + ' 金幣', sub: '從此比利時的扒手再也偷不到你了', life: 240 } };
    } };
  }

  /** v1.31 新大陸的哥倫布：巴哈馬群島（第一次上岸的地方就在群島東邊） */
  function talkColumbusAm() {
    const cleared = Levels.list.filter(function (lv, i) { return lv.region === 'america' && Save.isCleared(i); }).length;
    const total = Levels.list.filter(function (lv) { return lv.region === 'america'; }).length;
    if (cleared >= total) {
      return { who: 'columbus', lines: [
        L('columbus', '你把整片新大陸都走遍了！比我還厲害。'),
        L('columbus', '我到死都以為這裡是亞洲的邊緣⋯⋯所以這些島到今天還叫「西印度群島」。'),
        L('columbus', '後來有個叫亞美利哥的佛羅倫斯人說：這是一塊新的大陸。地圖上就用了他的名字。')
      ] };
    }
    return { who: 'columbus', lines: [
      L('columbus', '你也來了！這裡是巴哈馬群島 —— 1492 年 10 月 12 日，我們在群島東邊的聖薩爾瓦多島第一次上岸。'),
      L('columbus', '我把住在這裡的人叫做「印地安人」，因為我以為這裡是印度。'),
      L('columbus', '往南、往西還有好多國家：古巴、牙買加、墨西哥、巴拿馬、哥倫比亞，一直到巴西。'),
      L('columbus', '聽說巴西有個巨人守門員，從來沒有人踢進過他的球門⋯⋯小心點，年輕的船長！'),
      L('columbus', '想回歐洲的話，往東一直開到地圖最東邊就好。（目前走過 ' + cleared + ' / ' + total + ' 國）')
    ] };
  }

  /** v1.31.2 海底城的人魚 Thalassa：講城裡的事、提示各區打法；全部破完講亞特蘭提斯為什麼沉下去 */
  function talkMermaid() {
    const lv = Levels.list.map(function (l, i) { return { l: l, i: i }; }).filter(function (o) { return o.l.region === 'abyss'; });
    const cleared = lv.filter(function (o) { return Save.isCleared(o.i); }).length;
    if (cleared >= lv.length) {
      return { who: 'mermaid', lines: [
        L('mermaid', '你把克拉肯趕走了！整座城的人都在唱歌。'),
        L('mermaid', '老人家說，很久很久以前我們的國王太驕傲，想征服海面上的國家，海神一生氣，整座島一夜之間就沉了下來。'),
        L('mermaid', '從那天起，我們就一直住在海底 —— 其實也不壞，對吧？'),
        L('mermaid', '不過⋯⋯我好想看看海面上的世界。帶我一起去旅行好不好？'),
        L('mermaid', '就這麼說定了！不管你游到哪、走到哪，我都跟在你後面。')
      ], end: function () {
        if (Save.flag('mermaid')) return null;
        Save.setFlag('mermaid', 1);
        return { sfx: 'fanfare', toast: { text: '人魚 Thalassa 跟著你走了！', sub: '在水裡她會游在你後面，上岸時坐在水泡裡飄著跟過來', life: 260 } };
      } };
    }
    return { who: 'mermaid', lines: [
      L('mermaid', '人類？你是第一個游到這裡來的人類！歡迎來到亞特蘭提斯。'),
      L('mermaid', '這座城有四區：西北的珊瑚市集、東北的水晶宮、西南的海馬競技場，還有東南的海神神殿。'),
      L('mermaid', '珊瑚市集要游泳，記得看頭上的氣泡；水晶宮的光束貼著地面掃，跳起來就閃得過。'),
      L('mermaid', '海神神殿裡住著一隻巨大的章魚克拉肯，把我們的神殿佔走了⋯⋯拜託你，把牠趕出去！'),
      L('mermaid', '想回海面的話，往上游到最上面的「光之井」。（海底城 ' + cleared + ' / ' + lv.length + ' 區）')
    ] };
  }

  /** 送紀念品時她的反應 */
  const MER_THANKS = {
    maracas: '沙沙沙～好好玩！我要在家裡開一場舞會，你一定要來喔。',
    bmcoffee: '好香⋯⋯海底煮不了咖啡，那我每天打開來聞一聞就好。',
    pinata: '裡面裝著糖果？我捨不得打破它，掛在窗邊好了！',
    mola: '好漂亮的布，有魚、有鳥⋯⋯我要拿來當窗簾！',
    emerald: '綠得跟陽光照進海草裡一樣⋯⋯謝謝你，我會好好收著。',
    cupball: '這個圓圓的我知道！海馬們最喜歡拿它頂來頂去。',
    coralneck: '紅珊瑚項鍊！你、你幫我戴上好不好？⋯⋯嘻嘻，好看嗎？',
    prism: '一道光變成彩虹了！我的房間現在亮晶晶的。',
    saddle: '這是我小時候騎的那隻海馬的小鞍！你在哪裡找到的？',
    trident: '海神爺爺的三叉戟⋯⋯擺在架子最中間，保佑我們。'
  };
  function merHint(who) {
    if (merHuman()) return L(who, '用雙腳跟你一起走路去看世界，比我想像的還要好玩一百倍！');
    if (!mermaidJoined()) return L(who, '等海底城平靜下來，我好想去海面上看看⋯⋯');
    if (!Save.seaBossDown('darkKnight')) return L(who, '我好想看看海面上的城市晚上的樣子⋯⋯聽說巴黎有一座會發光的鐵塔，可是有一個很兇的黑騎士守著它。');
    return L(who, '我好想看看海面上的城市晚上的樣子⋯⋯聽說巴黎有一座會發光的鐵塔。你帶我去好不好？');
  }
  /** v1.31.2 人魚的家：把還沒送的紀念品全部送給她（一樣一樣說），架子上擺出來（panel 'merHome'） */
  function talkMerHome() {
    const who = merHuman() ? 'thalassa' : 'mermaid';
    const max = merLoveMax(), love0 = merLove();
    const give = Souvenirs.defs.filter(function (d) { return Save.hasSouvenir(d.id) && !merGifted(d.id); });
    const lines = [], reveal = [];
    if (give.length) {
      lines.push(L(who, love0 ? '你又來看我了！⋯⋯咦，你手上拿的是什麼？' : '歡迎來我家！這是我從小住的貝殼屋 —— 咦，你手上拿的是什麼？'));
      give.forEach(function (d) {
        lines.push(L('me', '這個送給你：「' + d.name + '」，從' + d.country + '帶回來的。'));
        reveal.push({ id: d.id, at: lines.length });
        lines.push(L(who, MER_THANKS[d.id] || '謝謝你！我會把它擺在架子上。'));
      });
      const love = love0 + give.length;
      lines.push(L(who, love >= max ? '架子⋯⋯全部擺滿了。每一樣都是你送的，我好喜歡你。（好感度 ♥ 全滿）'
                                     : '我把它們擺在架子上了！（好感度 ♥ ' + love + ' / ' + max + '）'));
      if (love >= max) lines.push(merHint(who));
    } else if (love0 >= max) {
      lines.push(L(who, '架子上的每一樣東西，我每天都會一樣一樣看過一遍。'));
      lines.push(merHint(who));
    } else {
      lines.push(L(who, love0 ? '架子上還有好多空位喔⋯⋯（好感度 ♥ ' + love0 + ' / ' + max + '）' : '歡迎來我家！這是我從小住的貝殼屋。'));
      lines.push(L(who, '聽說海面上的國家有好多漂亮的紀念品⋯⋯新大陸那邊、還有我們海底城的每一區都找得到。帶回來給我看好不好？'));
    }
    return { who: who, panel: 'merHome', reveal: reveal, lines: lines, end: function () {
      if (!give.length) return null;
      give.forEach(function (d) { Save.setFlag('merGift_' + d.id, 1); });
      const love = merLove();
      return love >= max
        ? { sfx: 'fanfare', toast: { text: 'Thalassa 的好感度全滿了！ ♥ ' + love + ' / ' + max, sub: Save.seaBossDown('darkKnight') ? '帶著她去巴黎，看巴黎鐵塔的夜景吧' : '她想去看巴黎鐵塔的夜景⋯⋯可是鐵塔被法國的暗夜騎士守著', life: 300 } }
        : { sfx: 'equip', toast: { text: '送給 Thalassa ' + give.length + ' 樣紀念品', sub: '好感度 ♥ ' + love + ' / ' + max + '　（撿到新的紀念品再拿來送她）', life: 240 } };
    } };
  }
  /*
   * v1.31.2 巴黎鐵塔的夜景（panel 'eiffel'）：好感度全滿、打倒暗夜騎士、帶著人魚走到巴黎就會自動開始。
   * 鐵塔整點閃燈的時候她的尾巴發光，看完變成人類（之後 pet.js 畫成用雙腳走路的女生）。
   */
  function talkEiffel() {
    const lines = [
      L('mermaid', '哇⋯⋯這就是巴黎鐵塔？晚上竟然整座都會發光！'),
      L('me', '那個黑騎士說，他每天晚上都在這裡守著它。'),
      L('mermaid', '在海底，我只看過水母和珊瑚會發光⋯⋯原來人類的城市也這麼漂亮。'),
      L('mermaid', '你送我的那些東西，我都擺在家裡的架子上，每天都會看一遍。'),
      L('me', '⋯⋯'),
      L('mermaid', '海神爺爺說過一個傳說：人魚只要在陸地上最美的夜景前面，被一個人真心地喜歡著⋯⋯'),
      L('mermaid', '她就能得到一雙腳，跟那個人一起走下去。'),
      L('mermaid', '啊！鐵塔在閃了⋯⋯我的尾巴⋯⋯好燙、在發光！'),
      L('thalassa', '⋯⋯我、我站起來了！我有腳了！'),
      L('thalassa', '從今天起，我不用再坐在水泡裡了。我們一起用走的，去看全世界吧！')
    ];
    return { who: 'mermaid', panel: 'eiffel', glowAt: 7, humanAt: 8, lines: lines, end: function (complete) {
      if (!complete || merHuman()) return null;
      Save.setFlag('merHuman', 1);
      return { sfx: 'fanfare', shake: 8, toast: { text: '人魚 Thalassa 變成人類了！', sub: '她會用雙腳跟在你後面走（下水時就游泳）', life: 300 } };
    } };
  }

  function talk(id) {
    if (id === 'merHome') return talkMerHome();
    if (id === 'eiffel') return talkEiffel();
    if (id === 'mermaid') return talkMermaid();
    if (id === 'columbusAm') return talkColumbusAm();
    if (id === 'cleopatra') return talkCleopatra();
    if (id === 'thor') return talkThor();
    if (id === 'loki') return talkLoki();
    if (id === 'lokiLocked') return talkLokiLocked();
    if (id === 'columbus') return talkColumbus();
    if (id === 'bank') return talkBank();
    if (id === 'zoo') return talkZoo();
    return null;
  }

  // ── 對話框的頭像 ────────────────────────────────────────

  /** 頭像（cx, cy = 臉的中心，約 80px 見方） */
  function portrait(ctx, who, cx, cy, t) {
    ctx.save();
    ctx.translate(cx, cy);
    const blink = Math.floor(t / 7) % 30 === 0;
    function eyes(y, gap, color) {
      ctx.fillStyle = color || '#1a1424';
      if (blink) { ctx.fillRect(-gap - 3, y, 6, 1.5); ctx.fillRect(gap - 3, y, 6, 1.5); }
      else { ctx.fillRect(-gap - 2, y - 2, 4, 5); ctx.fillRect(gap - 2, y - 2, 4, 5); }
    }
    if (who === 'thor') {
      ctx.fillStyle = '#c0281e'; ctx.fillRect(-34, 10, 68, 40);                       // 紅披風
      ctx.fillStyle = '#3a5aa0'; ctx.fillRect(-22, 14, 44, 36);
      ctx.fillStyle = '#f0c49a'; ctx.beginPath(); ctx.arc(0, -4, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8622a';
      ctx.beginPath(); ctx.moveTo(-20, -2); ctx.quadraticCurveTo(0, 40, 20, -2); ctx.quadraticCurveTo(0, 12, -20, -2); ctx.fill();   // 大紅鬍子
      ctx.fillStyle = '#a0a8b4'; ctx.beginPath(); ctx.arc(0, -10, 21, Math.PI, 0); ctx.fill();               // 頭盔
      ctx.fillStyle = '#f4f4f0';
      [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.moveTo(s * 18, -16); ctx.quadraticCurveTo(s * 34, -24, s * 30, -36); ctx.lineTo(s * 22, -20); ctx.fill(); });   // 翅膀
      eyes(-6, 8);
      ctx.fillStyle = '#9aa2ae'; ctx.fillRect(26, -30, 16, 12); ctx.fillStyle = '#6a4a30'; ctx.fillRect(32, -18, 4, 30);   // 鎚子
    } else if (who === 'loki') {
      ctx.fillStyle = '#2a6a3a'; ctx.fillRect(-26, 14, 52, 36);
      ctx.fillStyle = '#e8c040'; ctx.fillRect(-26, 14, 52, 4);
      ctx.fillStyle = '#e8d0b8'; ctx.beginPath(); ctx.arc(0, -2, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(0, -8, 19, Math.PI, 0); ctx.fill();               // 黑髮
      ctx.fillStyle = '#e8c040';
      [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.moveTo(s * 8, -22); ctx.quadraticCurveTo(s * 20, -40, s * 14, -52); ctx.lineTo(s * 16, -26); ctx.fill(); });   // 金色長角
      eyes(-4, 7, '#2a8a4a');
      ctx.strokeStyle = '#6a2a2a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-8, 8); ctx.quadraticCurveTo(2, 14, 10, 4); ctx.stroke();                      // 壞笑
    } else if (who === 'columbus') {
      ctx.fillStyle = '#2a2a3a'; ctx.fillRect(-26, 14, 52, 36);
      ctx.fillStyle = '#f4efe2'; ctx.fillRect(-8, 14, 16, 8);
      ctx.fillStyle = '#f0c49a'; ctx.beginPath(); ctx.arc(0, -2, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c8c0b0'; ctx.fillRect(-19, -10, 6, 20); ctx.fillRect(13, -10, 6, 20);             // 灰白長髮
      ctx.fillStyle = '#1a1a20'; ctx.fillRect(-22, -22, 44, 8); ctx.fillRect(-14, -30, 28, 10);             // 帽子
      eyes(-2, 7);
    } else if (who === 'banker') {
      ctx.fillStyle = '#2a2a36'; ctx.fillRect(-26, 14, 52, 36);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-8, 14); ctx.lineTo(0, 30); ctx.lineTo(8, 14); ctx.fill();
      ctx.fillStyle = '#c8102e'; ctx.fillRect(-2, 18, 4, 12);
      ctx.fillStyle = '#f0c49a'; ctx.beginPath(); ctx.arc(0, -2, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a8a8a'; ctx.beginPath(); ctx.arc(0, -10, 18, Math.PI, 0); ctx.fill();
      eyes(-2, 7);
      ctx.strokeStyle = '#c8a040'; ctx.lineWidth = 1.5;                                                      // 單片眼鏡
      ctx.beginPath(); ctx.arc(7, -2, 6, 0, Math.PI * 2); ctx.stroke();
    } else if (who === 'mermaid' || who === 'thalassa') {
      /*
       * 人魚 Thalassa（v1.31.2 玩家：人魚開發的辣一點）：
       * 一大把波浪長髮從兩邊披到腰、露肩、珍珠串的貝殼上衣、紅唇、長睫毛，對你眨一隻眼；身邊一閃一閃。
       */
      const wave = Math.sin(t * 0.06) * 2;
      ctx.fillStyle = '#1fa89a';
      ctx.beginPath(); ctx.moveTo(-18, -26);
      ctx.bezierCurveTo(-46, -6 + wave, -24, 22, -40, 50); ctx.lineTo(-22, 50); ctx.bezierCurveTo(-16, 24, -30, 4, -14, -16); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(18, -26);
      ctx.bezierCurveTo(46, -6 - wave, 26, 22, 42, 50); ctx.lineTo(24, 50); ctx.bezierCurveTo(16, 24, 30, 4, 14, -16); ctx.closePath(); ctx.fill();
      // 露肩、脖子
      ctx.fillStyle = '#f2d2bc';
      ctx.beginPath(); ctx.moveTo(-26, 50); ctx.quadraticCurveTo(-24, 18, -8, 14); ctx.lineTo(8, 14); ctx.quadraticCurveTo(24, 18, 26, 50); ctx.closePath(); ctx.fill();
      ctx.fillRect(-6, 8, 12, 10);
      // 貝殼上衣（兩片扇貝）＋珍珠串
      ctx.fillStyle = '#e86aa8';
      [-1, 1].forEach(function (s) {
        ctx.beginPath(); ctx.moveTo(s * 2, 44); ctx.lineTo(s * 20, 32); ctx.quadraticCurveTo(s * 12, 22, s * 2, 30); ctx.closePath(); ctx.fill();
      });
      ctx.strokeStyle = 'rgba(255, 220, 240, 0.8)'; ctx.lineWidth = 1;
      [-1, 1].forEach(function (s) { for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(s * 3, 42); ctx.lineTo(s * (8 + k * 4), 28 + k); ctx.stroke(); } });
      ctx.fillStyle = '#fff8f0';
      for (let k = 0; k < 9; k++) { const a = Math.PI * 0.15 + k * Math.PI * 0.0875; ctx.beginPath(); ctx.arc(Math.cos(a) * 14, 12 + Math.sin(a) * 10, 1.8, 0, Math.PI * 2); ctx.fill(); }
      if (who === 'thalassa') {
        // 變成人類：白色露肩小洋裝＋粉紅緞帶（v1.31.2 巴黎鐵塔的夜景之後）
        ctx.fillStyle = '#fbf4f6';
        ctx.beginPath(); ctx.moveTo(-24, 50); ctx.quadraticCurveTo(-20, 30, -18, 26); ctx.quadraticCurveTo(0, 32, 18, 26); ctx.quadraticCurveTo(20, 30, 24, 50); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff8ab8'; ctx.fillRect(-19, 38, 38, 4);
        ctx.beginPath(); ctx.arc(10, 40, 3.4, 0, Math.PI * 2); ctx.fill();
      }
      // 臉
      ctx.fillStyle = '#f2d2bc'; ctx.beginPath(); ctx.ellipse(0, -4, 17, 20, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#26c4b4'; ctx.beginPath(); ctx.ellipse(0, -16, 21, 13, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-20, -14); ctx.quadraticCurveTo(-8, -10, 2, -22); ctx.lineTo(-4, -26); ctx.closePath(); ctx.fill();   // 斜瀏海
      // 左眼：長睫毛的大眼睛；右眼：眨眼（一條彎線）
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(-7, -3, 4.5, 3.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a6a8a'; ctx.beginPath(); ctx.arc(-6.5, -3, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-6, -5, 1.4, 1.4);
      ctx.strokeStyle = '#1a1424'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(-7, -3, 4.8, 3.8, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      [[-11, -6, -13, -9], [-8, -7, -9, -10], [-5, -7, -4, -10]].forEach(function (l) { ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(3, -3); ctx.quadraticCurveTo(7, -6, 11, -3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(12, -7); ctx.stroke();
      // 腮紅、紅唇（微微一笑）
      ctx.fillStyle = 'rgba(255, 120, 150, 0.35)';
      ctx.beginPath(); ctx.ellipse(-10, 4, 4, 2.4, 0, 0, Math.PI * 2); ctx.ellipse(10, 4, 4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8203a';
      ctx.beginPath(); ctx.moveTo(-5, 7); ctx.quadraticCurveTo(-2, 5, 0, 6.4); ctx.quadraticCurveTo(2, 5, 5, 7); ctx.quadraticCurveTo(0, 11.5, -5, 7); ctx.fill();
      // 頭上的海星＋粉紅色的花
      ctx.fillStyle = '#f2a040';
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; ctx.beginPath(); ctx.moveTo(14, -24); ctx.lineTo(14 + Math.cos(a) * 9, -24 + Math.sin(a) * 9); ctx.lineTo(14 + Math.cos(a + 0.6) * 3, -24 + Math.sin(a + 0.6) * 3); ctx.fill(); }
      ctx.fillStyle = '#ff7ab0';
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(-15 + Math.cos(a) * 4, -24 + Math.sin(a) * 4, 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#ffe070'; ctx.beginPath(); ctx.arc(-15, -24, 2, 0, Math.PI * 2); ctx.fill();
      // 一閃一閃
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      [[30, -30], [-34, 10], [34, 20]].forEach(function (q, k) {
        const s2 = 2 + Math.abs(Math.sin(t * 0.12 + k * 2)) * 3;
        ctx.fillRect(q[0] - s2, q[1] - 0.6, s2 * 2, 1.2); ctx.fillRect(q[0] - 0.6, q[1] - s2, 1.2, s2 * 2);
      });
    } else if (who === 'cleopatra') {
      ctx.fillStyle = '#f4efe2'; ctx.fillRect(-26, 14, 52, 36);                                           // 白袍
      ctx.fillStyle = '#2a7ab0'; ctx.fillRect(-24, 14, 48, 6);                                            // 寬領圈（青金石）
      ctx.fillStyle = '#f2c94c'; ctx.fillRect(-24, 20, 48, 3);
      ctx.fillStyle = '#16161a'; ctx.fillRect(-22, -20, 44, 40);                                          // 齊肩黑髮
      ctx.fillStyle = '#c8946a'; ctx.beginPath(); ctx.arc(0, -2, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#16161a'; ctx.fillRect(-18, -20, 36, 10);                                          // 齊瀏海
      ctx.fillStyle = '#f2c94c'; ctx.fillRect(-20, -22, 40, 4);                                           // 金頭冠
      ctx.fillStyle = '#3a8a4a'; ctx.beginPath(); ctx.ellipse(0, -27, 3.5, 5, 0, 0, Math.PI * 2); ctx.fill();   // 額前的聖蛇
      eyes(-2, 7);
      ctx.strokeStyle = '#16161a'; ctx.lineWidth = 1.5;                                                   // 眼線
      [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.moveTo(s * 4, -4); ctx.lineTo(s * 13, -5); ctx.stroke(); });
      ctx.fillStyle = '#b8323a'; ctx.fillRect(-4, 8, 8, 2.5);
    } else if (who === 'keeper') {
      ctx.fillStyle = '#6a8a3a'; ctx.fillRect(-26, 14, 52, 36);
      ctx.fillStyle = '#c8946a'; ctx.beginPath(); ctx.arc(0, -2, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8c080'; ctx.beginPath(); ctx.ellipse(0, -14, 28, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-14, -26, 28, 12);   // 遮陽帽
      eyes(-2, 7);
    } else {
      // 你：條紋衫
      for (let k = 0; k < 5; k++) { ctx.fillStyle = k % 2 ? '#f4f4f0' : '#2a4a8a'; ctx.fillRect(-24, 14 + k * 7, 48, 7); }
      ctx.fillStyle = '#f0c49a'; ctx.beginPath(); ctx.arc(0, -2, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6a4a30'; ctx.beginPath(); ctx.arc(0, -8, 18, Math.PI, 0); ctx.fill();
      eyes(-2, 7);
    }
    ctx.restore();
  }

  /** 動物園的對話框上面畫一排動物（有幾種畫幾種） */
  function heart(ctx, x, y, r, on) {
    ctx.fillStyle = on ? '#ff6a9a' : 'rgba(255, 255, 255, 0.18)';
    ctx.beginPath(); ctx.arc(x - r * 0.5, y, r * 0.55, 0, Math.PI * 2); ctx.arc(x + r * 0.5, y, r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - r * 1.04, y + r * 0.15); ctx.lineTo(x, y + r * 1.1); ctx.lineTo(x + r * 1.04, y + r * 0.15); ctx.fill();
  }
  /** 人魚的家：粉紅色的貝殼屋裡，兩層架子擺著送她的紀念品；右邊圓窗外是海、她坐在大蚌殼上 */
  function drawMerHome(ctx, W, t, tk) {
    const shown = function (id) {
      return merGifted(id) || (tk && (tk.reveal || []).some(function (q) { return q.id === id && tk.i >= q.at; }));
    };
    const g = ctx.createLinearGradient(0, 24, 0, 300);
    g.addColorStop(0, '#f6b8cc'); g.addColorStop(1, '#b8608e');
    ctx.fillStyle = g; U.roundRect(ctx, 60, 22, W - 120, 280, 18); ctx.fill();
    ctx.strokeStyle = '#ffe0ec'; ctx.lineWidth = 3; U.roundRect(ctx, 60, 22, W - 120, 280, 18); ctx.stroke();
    // 貝殼的紋路
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'; ctx.lineWidth = 2;
    for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.moveTo(60 + k * 130, 302); ctx.quadraticCurveTo(W / 2, 40, W - 60 - k * 130, 302); ctx.stroke(); }
    U.text(ctx, '人魚的家', W / 2, 42, { size: 18, weight: 800, color: '#fff4f8', strokeWidth: 3 });
    // 好感度
    const max = merLoveMax();
    let n = 0;
    Souvenirs.defs.forEach(function (d) { if (shown(d.id)) n++; });
    U.text(ctx, '好感度', W / 2 - 150, 68, { size: 13, color: '#fff4f8', align: 'right' });
    for (let k = 0; k < max; k++) heart(ctx, W / 2 - 132 + k * 28, 66, 9, k < n);
    // 架子（兩層，一層 5 格）
    const x0 = 110, gap = 92;
    Souvenirs.defs.forEach(function (d, i) {
      const row = Math.floor(i / 5), col = i % 5;
      const x = x0 + col * gap + 40, y = 132 + row * 96;
      if (col === 0) {
        ctx.fillStyle = '#7a3a2a'; ctx.fillRect(x0, y + 30, gap * 5, 8);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; ctx.fillRect(x0, y + 38, gap * 5, 4);
      }
      if (shown(d.id)) {
        const pop = tk && (tk.reveal || []).some(function (q) { return q.id === d.id && tk.i === q.at; });
        if (pop) { ctx.fillStyle = 'rgba(255, 255, 220, ' + (0.35 + Math.sin(t * 0.2) * 0.2).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(x, y, 36, 0, Math.PI * 2); ctx.fill(); }
        Sprites.icon(ctx, d.icon, x, y, 0.8);
        U.text(ctx, d.name, x, y + 50, { size: 11, color: '#fff4f8' });
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 24, y - 22, 48, 48); ctx.setLineDash([]);
        U.text(ctx, '?', x, y + 2, { size: 18, color: 'rgba(255, 255, 255, 0.4)' });
      }
    });
    // 圓窗（外面是海、氣泡往上飄）
    const wx = W - 170, wy = 120;
    ctx.fillStyle = '#1a5a8a'; ctx.beginPath(); ctx.arc(wx, wy, 52, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(200, 240, 255, 0.6)';
    for (let k = 0; k < 6; k++) { const p = ((t * 0.5 + k * 17) % 100) / 100; ctx.beginPath(); ctx.arc(wx - 30 + k * 12, wy + 44 - p * 88, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = '#ffe0ec'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(wx, wy, 52, 0, Math.PI * 2); ctx.stroke();
    // 她坐在大蚌殼上
    const mx = W - 170, my = 286;
    ctx.fillStyle = '#f8e0ea';
    ctx.beginPath(); ctx.ellipse(mx, my, 70, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(mx, my - 6); ctx.scale(3.6, 3.6);
    if (typeof Pet !== 'undefined') { if (merHuman()) Pet.drawThalassa(ctx, 0, 0, t, -1, false, true); else Pet.drawMermaid(ctx, 0, 0, t, -1, true); }
    ctx.restore();
  }
  /** 巴黎鐵塔的夜景：借暗夜騎士決鬥場的背景（Sprites.skylines.KNT），前面一條塞納河，她和你站在河岸 */
  function drawEiffel(ctx, W, t, tk) {
    const gy = 300;
    const g = ctx.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, '#040818'); g.addColorStop(1, '#1c1838');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 480);
    if (Sprites.skylines.KNT) {
      const k = 0.82;
      ctx.save(); ctx.translate(0, gy * (1 - k)); ctx.scale(k, k);
      Sprites.skylines.KNT(ctx, 0, gy, W / k, null, t + (tk && tk.i >= tk.glowAt ? 0 : 0));
      ctx.restore();
    }
    // 塞納河（金色的倒影）
    ctx.fillStyle = '#0a1028'; ctx.fillRect(0, gy, W, 480 - gy);
    for (let k = 0; k < 18; k++) {
      const yy = gy + 6 + k * 7, a = 0.5 - k * 0.025;
      ctx.fillStyle = 'rgba(255, 190, 90, ' + Math.max(0.05, a).toFixed(2) + ')';
      const w = 30 + Math.sin(t * 0.08 + k) * 10;
      ctx.fillRect(W / 2 - w / 2 + Math.sin(t * 0.05 + k * 1.3) * 8, yy, w, 2);
    }
    // 河岸的欄杆
    ctx.fillStyle = '#060814'; ctx.fillRect(0, gy - 4, W, 6);
    for (let x = 10; x < W; x += 26) ctx.fillRect(x, gy - 22, 3, 20);
    ctx.fillRect(0, gy - 24, W, 3);
    // 你（背影的剪影）和她
    const px = W / 2 - 200, py = gy - 4;
    // 鐵塔的金光照在背上：先描一圈金邊再填黑
    ctx.fillStyle = 'rgba(255, 190, 90, 0.55)';
    ctx.beginPath(); ctx.arc(px + 1.5, py - 44, 10.5, 0, Math.PI * 2); ctx.fill();
    U.roundRect(ctx, px - 10, py - 35.5, 23, 28, 7); ctx.fill();
    ctx.fillStyle = '#1a1a2c';
    ctx.beginPath(); ctx.arc(px, py - 44, 9, 0, Math.PI * 2); ctx.fill();
    U.roundRect(ctx, px - 10, py - 34, 20, 26, 6); ctx.fill();
    ctx.fillRect(px - 8, py - 10, 6, 10); ctx.fillRect(px + 2, py - 10, 6, 10);
    const glow = tk && tk.i >= tk.glowAt, human = tk && tk.i >= tk.humanAt;
    const mx = W / 2 - 150, my = gy - 2;
    if (glow && !human) {
      // 尾巴發光、身邊轉著光點
      const r = ctx.createRadialGradient(mx, my - 30, 4, mx, my - 30, 60);
      r.addColorStop(0, 'rgba(255, 240, 200, 0.75)'); r.addColorStop(1, 'rgba(255, 240, 200, 0)');
      ctx.fillStyle = r; ctx.beginPath(); ctx.arc(mx, my - 30, 60, 0, Math.PI * 2); ctx.fill();
    }
    if (glow) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      for (let k = 0; k < 8; k++) {
        const a = t * 0.08 + k * Math.PI / 4, rr = 34 + Math.sin(t * 0.1 + k) * 6;
        const s2 = 2 + Math.abs(Math.sin(t * 0.2 + k)) * 2.5, x = mx + Math.cos(a) * rr, y = my - 30 + Math.sin(a) * rr * 0.8;
        ctx.fillRect(x - s2, y - 0.6, s2 * 2, 1.2); ctx.fillRect(x - 0.6, y - s2, 1.2, s2 * 2);
      }
    }
    ctx.save(); ctx.translate(mx, my); ctx.scale(2.6, 2.6);
    if (typeof Pet !== 'undefined') { if (human) Pet.drawThalassa(ctx, 0, 0, t, -1, false, true); else Pet.drawMermaid(ctx, 0, 0, t, -1, false); }
    ctx.restore();
  }

  function drawPanel(ctx, kind, W, t, tk) {
    if (kind === 'merHome') { drawMerHome(ctx, W, t, tk); return; }
    if (kind === 'eiffel') { drawEiffel(ctx, W, t, tk); return; }
    if (kind !== 'zoo' || typeof Expedition === 'undefined') return;
    const z = Save.zoo();
    const ids = Object.keys(ANIMALS).filter(function (k) { return z[k]; });
    const gap = Math.min(140, 760 / Math.max(1, ids.length));
    const x0 = W / 2 - (ids.length - 1) * gap / 2;
    // 底板：莽原色的圍欄區
    ctx.fillStyle = 'rgba(40, 32, 18, 0.82)';
    U.roundRect(ctx, 60, 150, W - 120, 140, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(200, 160, 90, 0.8)'; ctx.lineWidth = 2;
    U.roundRect(ctx, 60, 150, W - 120, 140, 14); ctx.stroke();
    U.text(ctx, '阿爾及爾動物園', W / 2, 166, { size: 14, color: '#ffd166' });
    ids.forEach(function (k, i) {
      const x = x0 + i * gap, y = 250;
      ctx.fillStyle = 'rgba(120, 160, 80, 0.35)';
      ctx.beginPath(); ctx.ellipse(x, y + 2, 50, 10, 0, 0, Math.PI * 2); ctx.fill();
      Expedition.drawAnimal(ctx, k, x - 30, y, 1, t, false);
      U.text(ctx, ANIMALS[k].name, x, y + 24, { size: 14, color: '#ffffff' });
    });
  }

  return {
    SPOTS: SPOTS,
    NAMES: NAMES,
    ANIMALS: ANIMALS,
    northOpen: northOpen,
    americaOpen: americaOpen,
    abyssOpen: abyssOpen,
    mermaidJoined: mermaidJoined,
    merLove: merLove,
    merLoveMax: merLoveMax,
    merGifted: merGifted,
    merHuman: merHuman,
    eiffelReady: eiffelReady,
    AM_SPOTS: AM_SPOTS,
    BANK_NEED: BANK_NEED,
    helReady: helReady,
    blocked: blocked,
    drawShield: drawShield,
    drawMapIcon: drawMapIcon,
    drawMapExtras: drawMapExtras,
    coinProgress: coinProgress,
    tick: tick,
    ASP_COST: ASP_COST,
    pickpocket: pickpocket,
    PICK_COINS: PICK_COINS,
    zooFee: zooFee,
    talk: talk,
    portrait: portrait,
    drawPanel: drawPanel
  };
})();
