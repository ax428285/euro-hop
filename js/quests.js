'use strict';

/**
 * 地圖上的劇情人物與委託（v1.30）。
 *
 *   雷神索爾   北海上：北歐被他的結界罩住（船開不進去、進不了城）。
 *              跟他講過話 → 知道洛基躲在卡律布狄斯的漩渦底下；
 *              在「漩渦逃生」裡故意死掉 → 掉進冥界赫爾海姆（expedition.js 的豎井關），最底下遇到洛基；
 *              回來再找索爾 → 一段逗趣的對話，結界解開 = 北歐篇開放（取代原本的 700 EXP）。
 *   哥倫布     西班牙帕洛斯港外：委託你打敗西歐五國的戰艦（expedition.js 的戰艦海戰），完成 → 美洲預告。
 *   瑞士銀行   日內瓦：歐洲每一關的金幣都收滿過才能開戶；之後每分鐘生 1 枚金幣的利息（離開遊戲也算，最多一天份）。
 *   動物園     阿爾及爾：放撒哈拉動物大遷徙抓回來的動物，每過一天收一次門票。
 *   金字塔     吉薩：直接進「金字塔探險」（expedition.js）。
 *
 * 對話（talk）回傳 { who, lines: [{ who, text }], panel?, end? }，game.js 的 'talk' 場景負責顯示。
 * end() 在講完時呼叫，可以回傳 { toast, sfx, start }（start = 要開始的探險，例如 'pyramid'）。
 * 劇情進度存在 Save.flag（thorAsked / loki / north / columbus）。
 */
const Quests = (function () {

  const SPOTS = [
    { id: 'Q_thor', npc: 'thor', name: '雷神索爾', lon: 5.6, lat: 58.4, prompt: '按 Enter 跟雷神索爾說話' },
    // v1.30 玩家：原本在加的斯灣，亞特蘭提斯的名牌擋到 → 搬到塞維亞（哥倫布的墓就在塞維亞大教堂）
    { id: 'Q_columbus', npc: 'columbus', name: '哥倫布', lon: -6.0, lat: 38.2, prompt: '按 Enter 跟哥倫布說話' },
    { id: 'Q_bank', npc: 'bank', name: '瑞士銀行', lon: 6.2, lat: 46.3, prompt: '按 Enter 進入瑞士銀行' },
    { id: 'Q_zoo', npc: 'zoo', name: '阿爾及爾動物園', lon: 3.1, lat: 36.3, prompt: '按 Enter 參觀阿爾及爾動物園' },
    // v1.30 玩家：太靠近亞歷山卓港和埃及的圖釘 → 搬到南邊的沙漠深處，改叫「失落的金字塔」
    { id: 'Q_pyramid', npc: 'pyramid', name: '失落的金字塔', lon: 32.5, lat: 24.5, prompt: '按 Enter 走進失落的金字塔' }
  ];

  const NAMES = { thor: '雷神索爾', loki: '洛基', me: '你', columbus: '哥倫布', banker: '銀行家', keeper: '動物園園長' };

  function flag(k) { return typeof Save !== 'undefined' ? Save.flag(k) : 0; }
  function northOpen() { return !!flag('north'); }
  /** 卡律布狄斯裡死掉要不要掉進冥界：還沒找到洛基就會 */
  function helReady() { return !flag('loki'); }

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
    } else if (kind === 'columbus') {
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
  function drawMapExtras(ctx, t) {
    if (flag('columbus') < 2 || typeof EuropeWorld === 'undefined') return;
    const p = EuropeWorld.project(-21, 41);
    ctx.save();
    const rc = 'rgba(120, 60, 30, 0.55)';
    U.text(ctx, '←　美　洲', p[0], p[1], { size: 22, weight: 800, color: rc, stroke: false });
    U.text(ctx, '（篇章開發中）', p[0] + 6, p[1] + 22, { size: 12, color: rc, stroke: false });
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
    return { got: got, total: total };
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
      L('thor', '活人是進不去那裡的⋯⋯只有被吞到最深、連命都交出去的人，才會掉到他躲的地方。'),
      L('thor', '⋯⋯喂，你那是什麼表情？我可沒叫你去送死喔。')
    ], end: function () {
      Save.setFlag('thorAsked', 1);
      return { toast: { text: '索爾的謎語', sub: '南方溫暖的海，有一張「吞下船的嘴」⋯⋯被吞到最深的人才找得到洛基', life: 280 } };
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
        L('columbus', '我還是覺得那裡是印度⋯⋯可是大家都說，那是一片新大陸。')
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
        return { sfx: 'fanfare', toast: { text: '哥倫布出航了！委託完成 +€ 500', sub: '地圖最西邊出現了「美洲」（篇章開發中）', life: 280 } };
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
    if (!b.open && pr.got < pr.total) {
      return { who: 'banker', lines: [
        L('banker', '歡迎光臨瑞士銀行。很抱歉，本行只接待真正的收藏家。'),
        L('banker', '請把歐洲每一國的金幣都收集齊全（每一關都拿滿過一次），再來開戶。'),
        L('banker', '目前您收滿了 ' + pr.got + ' / ' + pr.total + ' 國。祝您好運。')
      ] };
    }
    if (!b.open) {
      return { who: 'banker', lines: [
        L('banker', '⋯⋯歐洲每一國的金幣，全都收齊了？了不起。'),
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
        L('keeper', '抓回來的動物會住在這裡，每過一天都會有遊客買門票。')
      ] };
    }
    const days = Math.max(0, sv.day - sv.zooDay);
    const fee = zooFee();
    const income = Math.min(days, 10) * fee;       // 太久沒來最多算 10 天
    const z = Save.zoo();
    const list = Object.keys(ANIMALS).filter(function (k) { return z[k]; })
      .map(function (k) { return ANIMALS[k].name + ' ' + z[k]; }).join('、');
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

  function talk(id) {
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
  function drawPanel(ctx, kind, W, t) {
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
      U.text(ctx, ANIMALS[k].name + ' ×' + z[k], x, y + 24, { size: 14, color: '#ffffff' });
    });
  }

  return {
    SPOTS: SPOTS,
    NAMES: NAMES,
    ANIMALS: ANIMALS,
    northOpen: northOpen,
    helReady: helReady,
    blocked: blocked,
    drawShield: drawShield,
    drawMapIcon: drawMapIcon,
    drawMapExtras: drawMapExtras,
    coinProgress: coinProgress,
    tick: tick,
    zooFee: zooFee,
    talk: talk,
    portrait: portrait,
    drawPanel: drawPanel
  };
})();
