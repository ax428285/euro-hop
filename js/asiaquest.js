'use strict';

/**
 * v1.33 亞洲地圖上的劇情人物（用 Quests.registerNpc 掛進 quests.js，地點放進 Quests.AS_SPOTS）：
 *
 *   玄奘 xuanzang（印度・那爛陀寺）：在印度留學十幾年，抄好的經書要送回長安 —— 委託你帶回去
 *   大雁塔 goose（中國・長安）：把玄奘的經書交給這裡的住持 → 稱號「取經人」（flag pilgrim）＋亞洲 EXP
 *   馬可波羅 marco（喀什）：從威尼斯走絲路要去大都見忽必烈；講東方的事（東亞要累積亞洲 EXP、海的那一頭有「黃金之國」）
 *
 * 載入順序：quests.js 之後、worldmap.js 之前（AS_SPOTS 在換到亞洲地圖時才讀）。
 */
const AsiaQuest = (function () {
  const Q = Quests.helpers, L = Q.L;
  const SUTRA_EXP = 150, SUTRA_COINS = 500;
  function flag(k) { return Save.flag(k); }

  Quests.AS_SPOTS.push(
    // 那爛陀寺：七世紀全世界最大的佛學院，玄奘在這裡讀了五年書
    { id: 'Q_xuanzang', npc: 'xuanzang', name: '玄奘', lon: 85.4, lat: 25.1, prompt: '按 Enter 拜見玄奘法師' },
    // 大雁塔：玄奘回到長安後，為了收藏帶回來的經書蓋的塔
    { id: 'Q_goose', npc: 'goose', name: '長安・大雁塔', lon: 108.9, lat: 34.2, prompt: '按 Enter 走進長安的大雁塔' },
    // 喀什：絲路南北兩條路在這裡會合，馬可波羅往東走的時候經過這裡
    { id: 'Q_marco', npc: 'marco', name: '馬可波羅', lon: 76.0, lat: 39.5, prompt: '按 Enter 跟馬可波羅說話' }
  );

  // ── 玄奘 ───────────────────────────────────────────────
  Quests.registerNpc('xuanzang', {
    names: { xuanzang: '玄奘法師', abbot: '大雁塔住持', marco: '馬可波羅' },
    talk: function () {
      const s = flag('sutra');
      if (s >= 2) {
        return { who: 'xuanzang', lines: [
          L('xuanzang', '經書平安回到長安了？阿彌陀佛，辛苦你了。'),
          L('xuanzang', '我從長安走到這裡，翻過沙漠和雪山，走了好幾年。你走得比我快多了。')
        ] };
      }
      if (s === 1) {
        return { who: 'xuanzang', lines: [
          L('xuanzang', '經書就拜託你了。長安的大雁塔，在亞洲地圖的東邊。'),
          L('xuanzang', '一路往東走 —— 沿著絲路，翻過那一大片沙漠就到了。')
        ] };
      }
      return { who: 'xuanzang', lines: [
        L('xuanzang', '施主你好。貧僧玄奘，從長安一路走到天竺（印度）求經。'),
        L('xuanzang', '我在這座那爛陀寺讀了好幾年書，抄了滿滿一大箱的經書。'),
        L('xuanzang', '可是長安的人等了好久⋯⋯能不能請你先幫我把這一箱帶回去，交給大雁塔的住持？'),
        L('me', '交給我吧！')
      ], end: function (complete) {
        if (!complete || flag('sutra')) return null;
        Save.setFlag('sutra', 1);
        return { sfx: 'equip', toast: { text: '玄奘的委託：把經書送到長安的大雁塔', sub: '大雁塔在亞洲地圖的東邊（中國）', life: 280 } };
      } };
    },
    icon: function (ctx, x, y, t, near) {
      // 背著竹書箱、戴斗笠的僧人
      Q.ring(ctx, x, y, t, near, 'rgba(255, 190, 90, 0.95)');
      ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x - 9, y - 22, 7, 14);
      ctx.fillStyle = '#c8a060';
      for (let k = 0; k < 3; k++) ctx.fillRect(x - 9, y - 21 + k * 5, 7, 2);
      Q.tinyPerson(ctx, x + 1, y, '#d8902a', '#e8c49a');
      ctx.fillStyle = '#c8a060'; ctx.beginPath(); ctx.ellipse(x + 1, y - 22, 8, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    },
    portraits: {
      // 玄奘：光頭、慈祥的眉毛、土黃色的袈裟（右肩斜披紅色）、背後一個竹書箱
      xuanzang: function (ctx, t, eyes) {
        ctx.fillStyle = '#8a5a2a'; ctx.fillRect(-34, -30, 14, 70);
        ctx.fillStyle = '#c8a060'; for (let k = 0; k < 5; k++) ctx.fillRect(-34, -26 + k * 14, 14, 4);
        ctx.fillStyle = '#d8902a'; ctx.fillRect(-26, 14, 52, 36);
        ctx.fillStyle = '#b0302a'; ctx.beginPath(); ctx.moveTo(-26, 14); ctx.lineTo(8, 14); ctx.lineTo(26, 50); ctx.lineTo(6, 50); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8c49a'; ctx.beginPath(); ctx.arc(0, -4, 18, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 1.5;
        [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.moveTo(s * 3, -11); ctx.lineTo(s * 12, -10); ctx.stroke(); });
        eyes(-5, 7);
        ctx.strokeStyle = '#a06a50'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 4, 5, 0.2, Math.PI - 0.2); ctx.stroke();
        ctx.fillStyle = '#6a4a2a'; for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(-12 + k * 4, 20, 1.8, 0, Math.PI * 2); ctx.fill(); }   // 佛珠
      },
      // 大雁塔的住持：白眉毛、灰色的袍子
      abbot: function (ctx, t, eyes) {
        ctx.fillStyle = '#6a6a74'; ctx.fillRect(-26, 14, 52, 36);
        ctx.fillStyle = '#e8c49a'; ctx.beginPath(); ctx.arc(0, -4, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f4f4f0';
        [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.moveTo(s * 3, -11); ctx.lineTo(s * 16, -6); ctx.lineTo(s * 12, -11); ctx.fill(); });
        ctx.beginPath(); ctx.moveTo(-8, 8); ctx.quadraticCurveTo(0, 30, 8, 8); ctx.fill();
        eyes(-5, 7);
      },
      // 馬可波羅：威尼斯商人的紅色軟帽、棕色鬍子、毛邊的紅色長袍、背著一個地圖筒
      marco: function (ctx, t, eyes) {
        ctx.fillStyle = '#8a2a2a'; ctx.fillRect(-26, 14, 52, 36);
        ctx.fillStyle = '#e8d8b0'; ctx.fillRect(-26, 14, 52, 5);
        ctx.fillStyle = '#6a4a2a'; ctx.save(); ctx.rotate(-0.5); ctx.fillRect(-4, -10, 8, 60); ctx.restore();
        ctx.fillStyle = '#e0b48a'; ctx.beginPath(); ctx.arc(0, -4, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6a4228'; ctx.beginPath(); ctx.moveTo(-15, 2); ctx.quadraticCurveTo(0, 30, 15, 2); ctx.quadraticCurveTo(0, 12, -15, 2); ctx.fill();
        eyes(-5, 7);
        ctx.fillStyle = '#b0202a'; ctx.beginPath(); ctx.ellipse(2, -20, 22, 9, -0.15, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(12, -16, 10, 6, 0.3, 0, Math.PI * 2); ctx.fill();
      }
    }
  });

  // ── 大雁塔 ─────────────────────────────────────────────
  Quests.registerNpc('goose', {
    talk: function () {
      const s = flag('sutra');
      if (s >= 2) {
        return { who: 'abbot', lines: [
          L('abbot', '經書都收進塔裡了，往後會一卷一卷翻譯成中文。'),
          L('abbot', '玄奘法師回來以後，花了十九年把它們譯完 —— 一共一千三百多卷。')
        ] };
      }
      if (s === 1) {
        return { who: 'abbot', lines: [
          L('me', '住持，這是玄奘法師從天竺託我帶回來的經書。'),
          L('abbot', '⋯⋯這是法師的字！好，好！長安的人等這一天等好久了。'),
          L('abbot', '這座塔就是為了收藏這些經書蓋的。施主，你就是今天的取經人。')
        ], end: function (complete) {
          if (!complete || flag('sutra') !== 1) return null;
          Save.setFlag('sutra', 2);
          Save.setFlag('pilgrim', 1);
          Save.addExpAs(SUTRA_EXP);
          Save.addCoins(SUTRA_COINS);
          return { sfx: 'fanfare', shake: 6, toast: { text: '經書送到了！獲得稱號「取經人」', sub: '+' + SUTRA_EXP + ' 亞洲 EXP、€ ' + SUTRA_COINS, life: 300 } };
        } };
      }
      return { who: 'abbot', lines: [
        L('abbot', '這裡是長安的大慈恩寺。我們在等玄奘法師從天竺帶經書回來。'),
        L('abbot', '聽說他在印度的那爛陀寺⋯⋯不知道什麼時候才回得來。')
      ] };
    },
    icon: function (ctx, x, y, t, near) {
      // 七層的方塔
      Q.ring(ctx, x, y, t, near, 'rgba(255, 200, 120, 0.95)');
      for (let k = 0; k < 6; k++) {
        const w = 18 - k * 2.2, yy = y - 4 - k * 4;
        ctx.fillStyle = k % 2 ? '#c8a878' : '#b8986a'; ctx.fillRect(x - w / 2, yy - 4, w, 4);
        ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x - w / 2 - 1.5, yy - 4.8, w + 3, 1.2);
      }
      ctx.fillStyle = '#8a6a4a'; ctx.fillRect(x - 1, y - 32, 2, 6);
      if (flag('sutra') === 1) {
        const by = y - 40 + Math.sin(t * 0.12) * 2;
        ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.moveTo(x, by + 6); ctx.lineTo(x - 5, by); ctx.lineTo(x + 5, by); ctx.closePath(); ctx.fill();
      }
    }
  });

  // ── 馬可波羅 ───────────────────────────────────────────
  Quests.registerNpc('marco', {
    talk: function () {
      const first = !flag('marco');
      const lines = first ? [
        L('marco', 'Buongiorno！我是威尼斯的馬可波羅，跟著爸爸和叔叔沿著絲路往東走。'),
        L('marco', '我們要去大都（今天的北京）見蒙古的大汗忽必烈。聽說他的宮殿屋頂全是金子！'),
        L('marco', '可是往東邊的中國、蒙古，路不好走 —— 要在亞洲的海上多闖一闖，累積夠經驗（亞洲 EXP）才進得去。'),
        L('marco', '對了，聽中國的商人說，大海的另一頭有一座「黃金之國」，叫做 Zipangu⋯⋯總有一天我要去看看。')
      ] : [
        L('marco', '又見面了！我還在等商隊出發。'),
        L('marco', '回到威尼斯以後，我一定要把一路上看到的事寫成一本書 —— 不知道會不會有人相信呢？')
      ];
      return { who: 'marco', lines: lines, end: function (complete) {
        if (!complete || !first) return null;
        Save.setFlag('marco', 1);
        return { toast: { text: '遇見了馬可波羅', sub: '東亞（中國、蒙古）要累積 ' + Encounter.EASIA_EXP + ' 亞洲 EXP 才開放', life: 260 } };
      } };
    },
    icon: function (ctx, x, y, t, near) {
      Q.ring(ctx, x, y, t, near, 'rgba(255, 150, 140, 0.95)');
      Q.tinyPerson(ctx, x, y, '#8a2a2a', '#e0b48a');
      ctx.fillStyle = '#b0202a'; ctx.beginPath(); ctx.ellipse(x + 1, y - 22, 6, 2.6, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x + 5, y - 16, 2, 14);
    }
  });

  return { SUTRA_EXP: SUTRA_EXP, SUTRA_COINS: SUTRA_COINS };
})();
