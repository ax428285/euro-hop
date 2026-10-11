'use strict';

/**
 * 亞洲地圖上的劇情（用 Quests.registerNpc 掛進 quests.js，地點放進 Quests.AS_SPOTS；收徒弟、火焰山的小遊戲用 Encounter.registerMini）。
 *
 * v1.33.2 玩家：玄奘的任務太無聊、馬可波羅沒有任務 →
 *
 *   西天取經（flag sutra）
 *     0 → 印度那爛陀寺的玄奘：三個徒弟走散了，幫我找回來                                   sutra 1
 *         五行山的孫悟空   xyWukong  三打白骨精：三個村民裡有一個是白骨精變的（影子是骷髏），踩對的那一個
 *         高老莊的豬八戒   xyBajie   吃西瓜比賽：天上掉西瓜，搶在八戒前面吃掉 10 顆
 *         流沙河的沙悟淨   xyWujing  渡流沙河：踩著會沉下去的石頭過河，來回兩趟
 *       （打贏 = Save.seaBossDown(那一關)；收到的徒弟先回那爛陀寺跟師父會合 —— v1.33.3 玩家：任務解完後不要跟在我後面）
 *     三個都收齊 → 回去找玄奘：師徒四人一起出發                                           sutra 2
 *     → 火焰山 xyFlame：往前走過整座火焰山（地上的裂縫會噴火）                              sutra 3
 *     → 長安的大雁塔：稱號「取經人」（pilgrim）、時裝「齊天大聖」、亞洲 EXP、金幣             sutra 4
 *
 *   大汗的寶物（flag marco）
 *     0 → 喀什的馬可波羅：帶我去上都見忽必烈（跟在你後面走）                               marco 1
 *     → 上都（要先解鎖東亞）：忽必烈想看看亞洲各地的寶物 —— 波斯小地毯、印度香料盒、青花瓷瓶   marco 2
 *     → 三件紀念品都拿到了，再去上都：稱號「大汗的使者」（envoy）、亞洲 EXP、金幣              marco 3
 *
 * 載入順序：asiaboss.js 之後（要用 Encounter.registerMini），worldmap.js 換到亞洲地圖時才讀 AS_SPOTS。
 */
const AsiaQuest = (function () {
  const Q = Quests.helpers, L = Q.L, W = 960;
  const SUTRA_EXP = 300, SUTRA_COINS = 800, KHAN_EXP = 250, KHAN_COINS = 1500;
  const KHAN_WANTS = ['minicarpet', 'masala', 'porcelain'];
  const DISCIPLES = [
    { id: 'wukong', kind: 'xyWukong', name: '孫悟空', where: '五行山' },
    { id: 'bajie', kind: 'xyBajie', name: '豬八戒', where: '高老莊' },
    { id: 'wujing', kind: 'xyWujing', name: '沙悟淨', where: '流沙河' }
  ];
  function flag(k) { return Save.flag(k) || 0; }
  function got(d) { return Save.seaBossDown(d.kind); }
  function missing() { return DISCIPLES.filter(function (d) { return !got(d); }); }
  function easiaOpen() { return Encounter.regionUnlocked('easia'); }

  Quests.AS_SPOTS.push(
    // 那爛陀寺：七世紀全世界最大的佛學院，玄奘在這裡讀了五年書
    { id: 'Q_xuanzang', npc: 'xuanzang', name: '玄奘', lon: 85.4, lat: 25.1, prompt: '按 Enter 拜見玄奘法師', gone: function () { const s = Save.flag('sutra') || 0; return s === 2 || s === 3; } },
    // 大雁塔：玄奘回到長安後，為了收藏帶回來的經書蓋的塔
    { id: 'Q_goose', npc: 'goose', name: '長安・大雁塔', lon: 108.9, lat: 34.2, prompt: '按 Enter 走進長安的大雁塔' },
    // 《西遊記》的地方（照小說大概的方向擺：五行山在大唐邊境、高老莊在烏斯藏、流沙河、火焰山在吐魯番）
    { id: 'Q_wukong', npc: 'wukong', name: '五行山', lon: 97.0, lat: 37.6, prompt: '按 Enter 走到五行山下' },
    { id: 'Q_bajie', npc: 'bajie', name: '高老莊', lon: 103.0, lat: 30.8, prompt: '按 Enter 走進高老莊' },
    { id: 'Q_wujing', npc: 'wujing', name: '流沙河', lon: 92.5, lat: 40.6, prompt: '按 Enter 走到流沙河邊' },
    { id: 'Q_flame', npc: 'flame', name: '火焰山', lon: 89.0, lat: 43.6, prompt: '按 Enter 走向火焰山' },
    // 喀什：絲路南北兩條路在這裡會合；上都：忽必烈的夏宮（馬可波羅寫的 Xanadu）
    // v1.33.4 玩家：馬可波羅跟在後面時，地圖原本的位置還寫著他的名字 → 出發去上都之後（marco ≥ 1）這個地點就收起來
    { id: 'Q_marco', npc: 'marco', name: '馬可波羅', lon: 76.0, lat: 39.5, prompt: '按 Enter 跟馬可波羅說話', gone: function () { return (Save.flag('marco') || 0) >= 1; } },
    { id: 'Q_xanadu', npc: 'xanadu', name: '上都', lon: 120.0, lat: 44.6, prompt: '按 Enter 走進忽必烈的上都' },
    // v1.33.3 玩家：亞洲新增一個地方可以買船 → 泉州（馬可波羅說它是世界最大的港口「刺桐」），東方艦隊的海戰要開買來的船
    // v2.0.1 玩家：要讓泉州的跟原本只能升級的造船廠有區別 → 改名「泉州船行」（賣整艘船的船商），地圖圖示是碼頭邊掛著「賣」字的帆船
    { id: 'M_asYard', seller: 'asYard', name: '泉州船行', lon: 118.0, lat: 25.7, prompt: '按 Enter 進泉州船行買一艘新船（歐洲的瓦倫西亞造船廠是升級船）' }
  );

  // ════════════════════════════════════════════════════════
  // 西天取經
  // ════════════════════════════════════════════════════════
  Quests.registerNpc('xuanzang', {
    names: { xuanzang: '玄奘法師', abbot: '大雁塔住持', marco: '馬可波羅', wukong: '孫悟空', bajie: '豬八戒', wujing: '沙悟淨', kublai: '忽必烈大汗', guard: '上都的守衛' },
    talk: function () {
      const s = flag('sutra');
      if (s >= 4) return { who: 'xuanzang', lines: [L('xuanzang', '經書平安回到長安了。阿彌陀佛，你是我們師徒的大恩人。')] };
      if (s >= 2) {
        return { who: 'xuanzang', lines: [
          L('xuanzang', s === 2 ? '我們在火焰山腳下等你 —— 八百里的火焰，連鐵都會燒紅。' : '我們在長安的大雁塔等你。'),
          L('wukong', s === 2 ? '師父別怕，有俺老孫在！火焰山就在西邊的吐魯番。' : '走走走，大雁塔就在東邊！')
        ] };
      }
      if (s === 1) {
        const m = missing();
        if (m.length) {
          return { who: 'xuanzang', lines: [
            L('xuanzang', '還有 ' + m.length + ' 個徒弟沒找到：' + m.map(function (d) { return d.where + '的' + d.name; }).join('、') + '。'),
            L('xuanzang', '他們都在中國的西邊，拜託你了。')
          ] };
        }
        return { who: 'xuanzang', lines: [
          L('wukong', '師父！俺老孫來了！'),
          L('bajie', '師父～我們什麼時候吃飯？'),
          L('wujing', '師父，行李我來挑。'),
          L('xuanzang', '好，好！徒兒們都到齊了。我們回長安 —— 經書要送到大雁塔。'),
          L('xuanzang', '路上要過西邊的火焰山，我們先往那裡走，在山腳下等你，一起過山。')
        ], end: function (complete) {
          if (!complete || flag('sutra') !== 1) return null;
          Save.setFlag('sutra', 2);
          return { sfx: 'fanfare', toast: { text: '師徒四人出發了！', sub: '他們先到西邊的火焰山腳下等你', life: 260 } };
        } };
      }
      return { who: 'xuanzang', lines: [
        L('xuanzang', '施主你好。貧僧玄奘，從長安一路走到天竺（印度）求經，抄好了一大箱經書。'),
        L('xuanzang', '可是回去的路上妖怪太多，我那三個徒弟又走散了 ——'),
        L('xuanzang', '大徒弟孫悟空被壓在五行山下、二徒弟豬八戒跑回高老莊、三徒弟沙悟淨在流沙河。'),
        L('xuanzang', '能不能請你幫我把他們找回來？找齊了，我們師徒四人一起回長安。'),
        L('me', '交給我吧！')
      ], end: function (complete) {
        if (!complete || flag('sutra')) return null;
        Save.setFlag('sutra', 1);
        return { sfx: 'equip', toast: { text: '玄奘的委託：找回三個徒弟', sub: '五行山、高老莊、流沙河都在中國的西邊', life: 280 } };
      } };
    },
    icon: function (ctx, x, y, t, near) {
      Q.ring(ctx, x, y, t, near, 'rgba(255, 190, 90, 0.95)');
      ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x - 9, y - 22, 7, 14);
      ctx.fillStyle = '#c8a060';
      for (let k = 0; k < 3; k++) ctx.fillRect(x - 9, y - 21 + k * 5, 7, 2);
      Q.tinyPerson(ctx, x + 1, y, '#d8902a', '#e8c49a');
      ctx.fillStyle = '#c8a060'; ctx.beginPath(); ctx.ellipse(x + 1, y - 22, 8, 2.6, 0, 0, Math.PI * 2); ctx.fill();
      questMark(ctx, x, y, t, flag('sutra') === 0 || (flag('sutra') === 1 && !missing().length));
    },
    portraits: {
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
        ctx.fillStyle = '#6a4a2a'; for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(-12 + k * 4, 20, 1.8, 0, Math.PI * 2); ctx.fill(); }
      },
      abbot: function (ctx, t, eyes) {
        ctx.fillStyle = '#6a6a74'; ctx.fillRect(-26, 14, 52, 36);
        ctx.fillStyle = '#e8c49a'; ctx.beginPath(); ctx.arc(0, -4, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f4f4f0';
        [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.moveTo(s * 3, -11); ctx.lineTo(s * 16, -6); ctx.lineTo(s * 12, -11); ctx.fill(); });
        ctx.beginPath(); ctx.moveTo(-8, 8); ctx.quadraticCurveTo(0, 30, 8, 8); ctx.fill();
        eyes(-5, 7);
      },
      marco: function (ctx, t, eyes) {
        ctx.fillStyle = '#8a2a2a'; ctx.fillRect(-26, 14, 52, 36);
        ctx.fillStyle = '#e8d8b0'; ctx.fillRect(-26, 14, 52, 5);
        ctx.fillStyle = '#6a4a2a'; ctx.save(); ctx.rotate(-0.5); ctx.fillRect(-4, -10, 8, 60); ctx.restore();
        ctx.fillStyle = '#e0b48a'; ctx.beginPath(); ctx.arc(0, -4, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6a4228'; ctx.beginPath(); ctx.moveTo(-15, 2); ctx.quadraticCurveTo(0, 30, 15, 2); ctx.quadraticCurveTo(0, 12, -15, 2); ctx.fill();
        eyes(-5, 7);
        ctx.fillStyle = '#b0202a'; ctx.beginPath(); ctx.ellipse(2, -20, 22, 9, -0.15, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(12, -16, 10, 6, 0.3, 0, Math.PI * 2); ctx.fill();
      },
      // 孫悟空：金色的毛臉、金箍、紅色的衣服，扛著金箍棒
      wukong: function (ctx, t, eyes) {
        ctx.fillStyle = '#c8302a'; ctx.fillRect(-24, 14, 48, 36);
        ctx.fillStyle = '#e8a030'; ctx.fillRect(-24, 34, 48, 16);
        ctx.fillStyle = '#1a1a1a'; for (let k = 0; k < 4; k++) ctx.fillRect(-20 + k * 12, 36, 4, 12);
        ctx.strokeStyle = '#d8a020'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-36, 46); ctx.lineTo(30, -40); ctx.stroke();
        ctx.fillStyle = '#c8302a'; ctx.fillRect(26, -46, 10, 8); ctx.fillRect(-40, 42, 10, 8);
        ctx.fillStyle = '#b8803a'; ctx.beginPath(); ctx.arc(0, -4, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f0c49a'; ctx.beginPath(); ctx.ellipse(0, 2, 13, 12, 0, 0, Math.PI * 2); ctx.fill();
        eyes(-2, 6);
        ctx.strokeStyle = '#e8c040'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -4, 20, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();   // 金箍
        ctx.fillStyle = '#7a3a1a'; ctx.beginPath(); ctx.arc(0, 8, 4, 0.1, Math.PI - 0.1); ctx.fill();
      },
      // 豬八戒：粉紅色的豬臉、大耳朵、黑色僧帽、九齒釘耙
      bajie: function (ctx, t, eyes) {
        ctx.fillStyle = '#2a2a3a'; ctx.fillRect(-28, 14, 56, 36);
        ctx.strokeStyle = '#8a8a96'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(28, 50); ctx.lineTo(34, -30); ctx.stroke();
        ctx.fillStyle = '#8a8a96'; ctx.fillRect(24, -36, 22, 6); for (let k = 0; k < 4; k++) ctx.fillRect(24 + k * 6, -30, 2, 8);
        ctx.fillStyle = '#f0a8b0'; ctx.beginPath(); ctx.arc(0, -2, 22, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-22, -10, 10, 14, -0.5, 0, Math.PI * 2); ctx.ellipse(22, -10, 10, 14, 0.5, 0, Math.PI * 2); ctx.fill();
        eyes(-8, 8);
        ctx.fillStyle = '#e08890'; ctx.beginPath(); ctx.ellipse(0, 6, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7a3a40'; ctx.beginPath(); ctx.arc(-3, 6, 1.6, 0, Math.PI * 2); ctx.arc(3, 6, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a2a3a'; ctx.beginPath(); ctx.arc(0, -16, 14, Math.PI, 0); ctx.fill();
      },
      // 沙悟淨：藍灰色的臉、紅鬍子、脖子上掛著一大串念珠
      wujing: function (ctx, t, eyes) {
        ctx.fillStyle = '#5a6a8a'; ctx.fillRect(-26, 14, 52, 36);
        ctx.fillStyle = '#7a9ab0'; ctx.beginPath(); ctx.arc(0, -4, 18, 0, Math.PI * 2); ctx.fill();
        eyes(-6, 7, '#f4f0e0');
        ctx.fillStyle = '#c8402a'; ctx.beginPath(); ctx.moveTo(-14, 4); ctx.quadraticCurveTo(0, 30, 14, 4); ctx.quadraticCurveTo(0, 12, -14, 4); ctx.fill();
        ctx.fillStyle = '#f4ead0'; for (let k = 0; k < 9; k++) { const a = Math.PI * 0.15 + k * Math.PI * 0.7 / 8; ctx.beginPath(); ctx.arc(Math.cos(a) * 24, 10 + Math.sin(a) * 18, 3.2, 0, Math.PI * 2); ctx.fill(); }
      },
      // 忽必烈：蒙古的大汗，皮帽、白鬍子、金色的長袍
      kublai: function (ctx, t, eyes) {
        ctx.fillStyle = '#d8a030'; ctx.fillRect(-28, 14, 56, 36);
        ctx.fillStyle = '#8a2a2a'; ctx.fillRect(-28, 14, 56, 6);
        ctx.fillStyle = '#e0b48a'; ctx.beginPath(); ctx.arc(0, -4, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f4f4f0'; ctx.beginPath(); ctx.moveTo(-12, 4); ctx.quadraticCurveTo(0, 34, 12, 4); ctx.quadraticCurveTo(0, 14, -12, 4); ctx.fill();
        eyes(-5, 7);
        ctx.fillStyle = '#6a4a2a'; ctx.beginPath(); ctx.ellipse(0, -20, 22, 10, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#c8302a'; ctx.beginPath(); ctx.arc(0, -28, 6, 0, Math.PI * 2); ctx.fill();
      },
      guard: function (ctx, t, eyes) {
        ctx.fillStyle = '#2a4a8a'; ctx.fillRect(-26, 14, 52, 36);
        ctx.fillStyle = '#d8a880'; ctx.beginPath(); ctx.arc(0, -4, 18, 0, Math.PI * 2); ctx.fill();
        eyes(-5, 7);
        ctx.fillStyle = '#8a8a96'; ctx.beginPath(); ctx.moveTo(-18, -12); ctx.quadraticCurveTo(0, -36, 18, -12); ctx.closePath(); ctx.fill();
        ctx.fillRect(-1.5, -40, 3, 10);
      }
    }
  });
  /** 地圖圖示上方的「！」（這裡有事可以做） */
  function questMark(ctx, x, y, t, on) {
    if (!on) return;
    const by = y - 34 + Math.sin(t * 0.12) * 2;
    ctx.fillStyle = 'rgba(255, 209, 102, ' + (0.75 + Math.sin(t * 0.2) * 0.25).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(x + 12, by, 7, 0, Math.PI * 2); ctx.fill();
    U.text(ctx, '！', x + 12, by, { size: 10, weight: 800, color: '#5a2a0a', stroke: false });
  }

  // ── 三個徒弟的地點 ──
  const DISCIPLE_TALK = {
    wukong: {
      wait: ['wukong', '（山底下傳來聲音）喂！上面的！俺老孫被壓在這五行山下五百年了，你認識我師父嗎？'],
      ask: [L('wukong', '你是師父派來的？太好了！可是山頂有一道封印 —— 附近的白骨精一直跑來搗亂。'),
            L('wukong', '她會變成村民的樣子騙人，看她的影子就知道：影子是骷髏的才是她！'),
            L('wukong', '踩她三下，俺老孫就能把封印撕掉出來！千萬別踩到真的村民啊。')],
      done: '俺老孫先回那爛陀寺找師父了！'
    },
    bajie: {
      wait: ['bajie', '我是豬八戒，在高老莊吃好睡好⋯⋯什麼師父？我不記得了，呼嚕嚕。'],
      ask: [L('bajie', '師父找我？可是⋯⋯西瓜季到了，我要在這裡吃西瓜。'),
            L('bajie', '不然這樣：我們來比吃西瓜！天上掉下來的西瓜，誰先吃到 10 顆誰贏。'),
            L('bajie', '你贏了我就跟你走。嘿嘿，我可是很會吃的喔！')],
      done: '我先回師父那裡⋯⋯路上有好吃的記得叫我！'
    },
    wujing: {
      wait: ['wujing', '（流沙河裡冒出一顆光頭）⋯⋯這條河鵝毛都浮不起來，你過不去的。'],
      ask: [L('wujing', '你是師父派來接我的？我在河的那一頭等，可是流沙河的石頭一踩就會沉下去。'),
            L('wujing', '踩著石頭過河，來回兩趟，證明你走得過去 —— 我就跟你走。'),
            L('wujing', '小心河裡會冒出水柱！')],
      done: '我先去那爛陀寺，師父的行李交給我挑。'
    }
  };
  DISCIPLES.forEach(function (d) {
    const T = DISCIPLE_TALK[d.id];
    Quests.registerNpc(d.id, {
      talk: function () {
        if (got(d)) return { who: d.id, lines: [L(d.id, T.done)] };
        if (flag('sutra') < 1) return { who: T.wait[0], lines: [L(T.wait[0], T.wait[1])] };
        return { who: d.id, lines: T.ask, end: function (complete) { return complete ? { fight: d.kind } : null; } };
      },
      icon: function (ctx, x, y, t, near) {
        Q.ring(ctx, x, y, t, near, 'rgba(255, 200, 120, 0.95)');
        if (d.id === 'wukong') {
          // 五行山：五座尖山，山腳探出一顆猴頭
          ctx.fillStyle = '#7a6a54';
          for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(x - 14 + k * 6, y); ctx.lineTo(x - 11 + k * 6, y - 14 - (k % 2) * 6); ctx.lineTo(x - 8 + k * 6, y); ctx.fill(); }
          if (!got(d)) { ctx.fillStyle = '#b8803a'; ctx.beginPath(); ctx.arc(x + 12, y - 3, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#e8c040'; ctx.fillRect(x + 8, y - 6, 8, 1.4); }
        } else if (d.id === 'bajie') {
          // 高老莊：一間農舍＋一顆西瓜
          ctx.fillStyle = '#c8a878'; ctx.fillRect(x - 10, y - 10, 16, 10);
          ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.moveTo(x - 12, y - 10); ctx.lineTo(x - 2, y - 18); ctx.lineTo(x + 8, y - 10); ctx.fill();
          ctx.fillStyle = '#3a8a3a'; ctx.beginPath(); ctx.arc(x + 11, y - 4, 4.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#1a5a1a'; ctx.fillRect(x + 10, y - 8, 1, 8);
        } else {
          // 流沙河：一條黃色的河＋河裡的光頭
          ctx.strokeStyle = '#d8b878'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.moveTo(x - 14, y - 2); ctx.quadraticCurveTo(x, y - 10, x + 14, y - 2); ctx.stroke();
          if (!got(d)) { ctx.fillStyle = '#7a9ab0'; ctx.beginPath(); ctx.arc(x + 2, y - 8, 3.4, Math.PI, 0); ctx.fill(); }
        }
        questMark(ctx, x, y, t, flag('sutra') === 1 && !got(d));
      }
    });
    // 打贏之後接的那段話
    Quests.registerNpc('xyJoin_' + d.id, {
      talk: function () {
        const m = missing();
        return { who: d.id, lines: [
          L(d.id, d.id === 'wukong' ? '哈哈！封印撕掉了，俺老孫自由啦！' : d.id === 'bajie' ? '⋯⋯好吧，你比我還會吃，我認輸。' : '你過得了流沙河，我信你了。'),
          L(d.id, '我先回那爛陀寺找師父，在那裡等你！'),
          L('me', m.length ? '還有' + m.map(function (q) { return q.where + '的' + q.name; }).join('、') + '要找。' : '三個徒弟都到齊了，回那爛陀寺找玄奘法師吧！')
        ] };
      }
    });
  });

  // ── 火焰山 ──
  Quests.registerNpc('flame', {
    talk: function () {
      const s = flag('sutra');
      if (s === 2) {
        return { who: 'wukong', lines: [
          L('xuanzang', '好熱⋯⋯前面整座山都在燒。'),
          L('wukong', '師父別怕！地上的裂縫冒煙就是要噴火了，看準空檔一口氣衝過去！'),
          L('bajie', '我⋯⋯我殿後好了。')
        ], end: function (complete) { return complete ? { fight: 'xyFlame' } : null; } };
      }
      return { who: 'wukong', lines: [L(s >= 3 ? 'wukong' : 'me', s >= 3 ? '火焰山已經過了，長安就在東邊！' : '整座山都在燒⋯⋯一個人可過不去。')] };
    },
    icon: function (ctx, x, y, t, near) {
      Q.ring(ctx, x, y, t, near, 'rgba(255, 120, 80, 0.95)');
      ctx.fillStyle = '#b8402a'; ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x - 4, y - 14); ctx.lineTo(x + 4, y - 9); ctx.lineTo(x + 14, y); ctx.fill();
      for (let k = 0; k < 3; k++) {
        const fl = Math.sin(t * 0.3 + k * 2) * 2;
        ctx.fillStyle = k % 2 ? '#ffa030' : '#ff5a2a';
        ctx.beginPath(); ctx.moveTo(x - 8 + k * 7, y - 8); ctx.quadraticCurveTo(x - 6 + k * 7 + fl, y - 20, x - 4 + k * 7, y - 8); ctx.fill();
      }
      // v1.33.14 玩家：玄奘放在火焰山那 —— 接完委託出發後，他站在火焰山旁邊等你（不然像是消失了）
      if (flag('sutra') === 2) waiting(ctx, ['xuanzang'], x, y, t);
      questMark(ctx, x, y, t, flag('sutra') === 2);
    }
  });

  // ── 大雁塔 ──
  Quests.registerNpc('goose', {
    talk: function () {
      const s = flag('sutra');
      if (s >= 4) {
        return { who: 'abbot', lines: [
          L('abbot', '經書都收進塔裡了，往後會一卷一卷翻譯成中文。'),
          L('abbot', '玄奘法師花了十九年，把它們譯成一千三百多卷。')
        ] };
      }
      if (s === 3) {
        return { who: 'abbot', lines: [
          L('xuanzang', '住持，貧僧玄奘回來了！這是從天竺帶回來的經書。'),
          L('abbot', '⋯⋯真的是法師！長安的人等這一天等好久了！'),
          L('wukong', '一路上妖怪、火焰山，全靠這位朋友帶路！'),
          L('xuanzang', '施主，這件衣服是悟空的心意 —— 你就是我們的取經人。')
        ], end: function (complete) {
          if (!complete || flag('sutra') !== 3) return null;
          Save.setFlag('sutra', 4);
          Save.setFlag('pilgrim', 1);
          Save.addExpAs(SUTRA_EXP);
          Save.addCoins(SUTRA_COINS);
          if (typeof Costumes !== 'undefined' && !Save.get().costumes.includes('wukong')) Save.addCostume('wukong');
          return { sfx: 'fanfare', shake: 8, toast: { text: '西天取經完成！稱號「取經人」', sub: '時裝「齊天大聖」已經穿上（裝備畫面可以換）・+' + SUTRA_EXP + ' 亞洲 EXP、€ ' + SUTRA_COINS, life: 340 } };
        } };
      }
      return { who: 'abbot', lines: [
        L('abbot', '這裡是長安的大慈恩寺。我們在等玄奘法師從天竺帶經書回來。'),
        L('abbot', s ? '聽說法師的徒弟們走散了⋯⋯但願他平安。' : '聽說他在印度的那爛陀寺⋯⋯不知道什麼時候才回得來。')
      ] };
    },
    icon: function (ctx, x, y, t, near) {
      Q.ring(ctx, x, y, t, near, 'rgba(255, 200, 120, 0.95)');
      for (let k = 0; k < 6; k++) {
        const w = 18 - k * 2.2, yy = y - 4 - k * 4;
        ctx.fillStyle = k % 2 ? '#c8a878' : '#b8986a'; ctx.fillRect(x - w / 2, yy - 4, w, 4);
        ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x - w / 2 - 1.5, yy - 4.8, w + 3, 1.2);
      }
      ctx.fillStyle = '#8a6a4a'; ctx.fillRect(x - 1, y - 32, 2, 6);
      if (flag('sutra') === 3) waiting(ctx, ['xuanzang'], x, y, t);      // 過了火焰山：玄奘到大雁塔旁邊等
      questMark(ctx, x, y - 8, t, flag('sutra') === 3);
    }
  });

  // ════════════════════════════════════════════════════════
  // 大汗的寶物（馬可波羅）
  // ════════════════════════════════════════════════════════
  const WANT_INFO = {
    minicarpet: '伊朗', masala: '印度', porcelain: '中國'
  };
  function wantName(id) { const d = Souvenirs.get(id); return d ? d.name : id; }
  function haveAll() { return KHAN_WANTS.every(function (id) { return Save.hasSouvenir(id); }); }
  Quests.registerNpc('marco', {
    talk: function () {
      const m = flag('marco');
      if (m >= 2) {
        return { who: 'marco', lines: [L('marco', m >= 3 ? '回到威尼斯以後，我要把這一路寫成一本書 ——《東方見聞錄》！' : '我還在上都等你！大汗想看的寶物找到了嗎？')] };
      }
      if (m === 1) return { who: 'marco', lines: [L('marco', '我在上都等你！大汗的夏宮在中國北邊的草原上。')] };
      return { who: 'marco', lines: [
        L('marco', 'Buongiorno！我是威尼斯的馬可波羅，跟著爸爸和叔叔沿著絲路往東走。'),
        L('marco', '我們要去上都見蒙古的大汗忽必烈。聽說他的宮殿是用大理石和金子蓋的！'),
        L('marco', '大汗只見有人引薦的客人。你走遍了絲路，能不能跟我一起去見他？'),
        L('marco', '我先跟著商隊出發，在上都的城門口等你 —— 上都在中國北邊的草原上。'),
        L('me', '好，上都見！')
      ], end: function (complete) {
        if (!complete || flag('marco')) return null;
        Save.setFlag('marco', 1);
        return { sfx: 'equip', toast: { text: '馬可波羅先去上都了！', sub: '到上都跟他會合，一起見忽必烈（要先解鎖東亞）', life: 260 } };
      } };
    },
    icon: function (ctx, x, y, t, near) {
      if (flag('marco') >= 1) return;        // 跟著你走了／在上都
      Q.ring(ctx, x, y, t, near, 'rgba(255, 150, 140, 0.95)');
      Q.tinyPerson(ctx, x, y, '#8a2a2a', '#e0b48a');
      ctx.fillStyle = '#b0202a'; ctx.beginPath(); ctx.ellipse(x + 1, y - 22, 6, 2.6, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x + 5, y - 16, 2, 14);
      questMark(ctx, x, y, t, true);
    }
  });
  Quests.registerNpc('xanadu', {
    talk: function () {
      const m = flag('marco');
      if (!easiaOpen()) {
        return { who: 'guard', lines: [
          L('guard', '站住！這裡是大汗的上都，外地人不能隨便進來。'),
          L('guard', '（東亞篇還沒解鎖：在亞洲的海上冒險累積 ' + Encounter.EASIA_EXP + ' 亞洲 EXP）')
        ] };
      }
      if (m === 0) return { who: 'guard', lines: [L('guard', '大汗只見有人引薦的西方客人。聽說喀什有個威尼斯人正要過來⋯⋯')] };
      if (m === 1) {
        return { who: 'kublai', lines: [
          L('marco', '偉大的大汗！我是威尼斯的馬可波羅，這位朋友一路帶我走到這裡。'),
          L('kublai', '西方來的客人！好，好。我的國家從草原一直到大海，可是我還沒看過整個亞洲的寶物。'),
          L('kublai', '替我把三樣東西帶來：' + KHAN_WANTS.map(function (id) { return WANT_INFO[id] + '的' + wantName(id); }).join('、') + '。'),
          L('marco', '我就留在大汗身邊等你！聽說那些寶物都藏在那幾個國家的密道裡。')
        ], end: function (complete) {
          if (!complete || flag('marco') !== 1) return null;
          Save.setFlag('marco', 2);
          return { sfx: 'equip', toast: { text: '忽必烈的委託：亞洲的三件寶物', sub: KHAN_WANTS.map(wantName).join('、') + '（關卡的密道裡）', life: 300 } };
        } };
      }
      if (m === 2) {
        if (!haveAll()) {
          const lack = KHAN_WANTS.filter(function (id) { return !Save.hasSouvenir(id); });
          return { who: 'kublai', lines: [L('kublai', '還差' + lack.map(function (id) { return WANT_INFO[id] + '的' + wantName(id); }).join('、') + '。去那幾個國家的密道裡找找。')] };
        }
        return { who: 'kublai', lines: [
          L('me', '大汗，這是波斯的小地毯、印度的香料盒，還有中國的青花瓷瓶。'),
          L('kublai', '⋯⋯了不起！整個亞洲都在我的眼前了。'),
          L('kublai', '我封你為「大汗的使者」，這面金牌帶在身上，整個帝國都會為你開路。'),
          L('marco', '太好了！我要把這一切都寫進我的書裡！')
        ], end: function (complete) {
          if (!complete || flag('marco') !== 2 || !haveAll()) return null;
          Save.setFlag('marco', 3);
          Save.setFlag('envoy', 1);
          Save.addExpAs(KHAN_EXP);
          Save.addCoins(KHAN_COINS);
          return { sfx: 'fanfare', shake: 8, toast: { text: '獲得稱號「大汗的使者」！', sub: '+' + KHAN_EXP + ' 亞洲 EXP、€ ' + KHAN_COINS, life: 320 } };
        } };
      }
      return { who: 'kublai', lines: [L('kublai', '我的使者，你帶來的寶物，我每天都會拿出來看。'), L('marco', '我在大汗身邊當官了！說不定會待上十七年呢。')] };
    },
    icon: function (ctx, x, y, t, near) {
      // 上都：白色的大帳篷宮殿＋金頂
      Q.ring(ctx, x, y, t, near, 'rgba(255, 220, 120, 0.95)');
      ctx.fillStyle = '#f4f0e6'; ctx.fillRect(x - 12, y - 10, 24, 10);
      ctx.beginPath(); ctx.moveTo(x - 13, y - 10); ctx.quadraticCurveTo(x, y - 24, x + 13, y - 10); ctx.fill();
      ctx.fillStyle = '#e8b830'; ctx.beginPath(); ctx.arc(x, y - 20, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c8302a'; ctx.fillRect(x - 3, y - 7, 6, 7);
      const m = flag('marco');
      if (m >= 1) waiting(ctx, ['marco'], x, y, t);
      questMark(ctx, x, y, t, easiaOpen() && (m === 1 || (m === 2 && haveAll())));
    }
  });

  // ════════════════════════════════════════════════════════
  // 地圖上跟在後面走的人（亞洲地圖）
  // ════════════════════════════════════════════════════════
  const trail = [];
  /*
   * v1.33.11 玩家：除了人魚和黃金獵犬，其他 NPC 不要跟在我後面（隊伍太長）→ 沒有人跟著走了：
   * 師徒四人先去下一站等（出發後在火焰山腳下、過了火焰山在長安的大雁塔），馬可波羅先去上都等。地點的圖示旁邊畫出等你的人。
   */
  function followers() { return []; }
  /** 在地點的圖示旁邊畫一排等你的人 */
  function waiting(ctx, list, x, y, t) {
    list.forEach(function (who, i) { drawChibi(ctx, who, x + 14 + i * 7, y + 2, t + i * 9); });
  }
  // v1.33.12 玩家：玄奘師徒不用出現在地圖上 → 徒弟不畫；v1.33.14 玄奘本人出發後站在火焰山（過了山站在大雁塔）旁邊；馬可波羅在上都等
  /** game.js 畫地圖時呼叫（在主角之前畫） */
  function drawFollowers(ctx, t) {
    if (WorldMap.world() !== 'as') { trail.length = 0; return; }
    const sp = Voyage.shipPos();
    const last = trail[0];
    if (!last || Math.hypot(sp.x - last.x, sp.y - last.y) > 1.2) { trail.unshift({ x: sp.x, y: sp.y }); if (trail.length > 120) trail.pop(); }
    if (Voyage.mode() !== 'land') return;
    followers().forEach(function (who, i) {
      const q = trail[Math.min(trail.length - 1, (i + 1) * 10)];
      if (!q) return;
      drawChibi(ctx, who, q.x, q.y, t + i * 7);
    });
  }
  /** 地圖上的小人（腳底在 x, y） */
  function drawChibi(ctx, who, x, y, t) {
    const b = Math.abs(Math.sin(t * 0.2)) * 1.2;
    ctx.save(); ctx.translate(x, y - b);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'; ctx.beginPath(); ctx.ellipse(0, b + 1, 5, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    const C = {
      xuanzang: ['#d8902a', '#e8c49a'], wukong: ['#c8302a', '#b8803a'], bajie: ['#2a2a3a', '#f0a8b0'],
      wujing: ['#5a6a8a', '#7a9ab0'], marco: ['#8a2a2a', '#e0b48a']
    }[who];
    ctx.fillStyle = C[0]; ctx.fillRect(-3, -11, 6, 9);
    ctx.fillStyle = C[1]; ctx.beginPath(); ctx.arc(0, -14, who === 'bajie' ? 3.6 : 3, 0, Math.PI * 2); ctx.fill();
    if (who === 'wukong') { ctx.fillStyle = '#e8c040'; ctx.fillRect(-3, -16, 6, 1.2); ctx.strokeStyle = '#d8a020'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(4, -2); ctx.lineTo(6, -18); ctx.stroke(); }
    if (who === 'bajie') { ctx.fillStyle = '#e08890'; ctx.fillRect(-1.5, -14, 3, 2); }
    if (who === 'wujing') { ctx.fillStyle = '#f4ead0'; ctx.fillRect(-3, -9, 6, 1.4); }
    if (who === 'xuanzang') { ctx.fillStyle = '#c8a060'; ctx.beginPath(); ctx.ellipse(0, -17, 5, 1.6, 0, 0, Math.PI * 2); ctx.fill(); }
    if (who === 'marco') { ctx.fillStyle = '#b0202a'; ctx.beginPath(); ctx.ellipse(0.5, -17, 3.6, 1.6, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  // ════════════════════════════════════════════════════════
  // 收徒弟、火焰山的小遊戲（跟海上遭遇戰同一套流程；第一次打贏 = Save.seaBossDown）
  // ════════════════════════════════════════════════════════
  const H = Encounter.helpers;
  function rnd(mini) { mini.rs = (mini.rs * 16807) % 2147483647; return (mini.rs - 1) / 2147483646; }
  function seed(mini) { mini.rs = 1 + Math.floor(Math.random() * 2147483000); }
  function stomped(q, box) {
    if (!U.overlap(q, box) || q.vy <= 0 || (q.y + q.h) - box.y > 24) return false;
    q.vy = PHYS.STOMP_BOUNCE;
    return true;
  }
  function hills(ctx, GY, col, off) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, GY);
    for (let x = 0; x <= W; x += 30) ctx.lineTo(x, GY - 90 - 50 * Math.abs(Math.sin((x + off) * 0.008)) - 20 * Math.sin((x + off) * 0.03));
    ctx.lineTo(W, GY); ctx.closePath(); ctx.fill();
  }
  const base = { lv: '西遊記', exp: 60, bossExp: 150, bossCoins: 150, as: true, fixed: true, xiyou: true, loseNote: '師父還在等你 —— 準備好再來一次' };

  // ── 孫悟空：三打白骨精 ──
  const BONE_GOAL = 3;
  const LOOKS = [['#e8a0b0', '#f0c49a'], ['#8a7a6a', '#e0c0a0'], ['#6a8aaa', '#e8c8a8']];   // 村姑、老婆婆、老公公（衣服、臉）
  Encounter.registerMini('xyWukong', {
    def: Object.assign({}, base, {
      name: '五行山・三打白骨精', game: '三打白骨精', duration: 60 * 60, winTalk: 'xyJoin_wukong', clearTitle: '孫悟空出來了！',
      fact: '《西遊記》裡，白骨精變成村姑、老婆婆、老公公三次來騙唐僧，都被孫悟空的火眼金睛看穿。',
      goal: '影子是骷髏的才是白骨精，踩她 3 下・別踩到真的村民'
    }),
    arena: function () { return { country: '西遊記', sky: ['#8ab0d0', '#f0e8d0'], spawnX: 460, groundTop: '#9a8a64', groundBody: '#6a5a3a' }; },
    init: function (state, mini) { seed(mini); mini.hits = 0; mini.round = 0; mini.folk = []; mini.next = 40; mini.bones = []; mini.boneCd = 120; },
    update: function (state, input, mini, events, win, fail, players) {
      const GY = Levels.GROUND_Y;
      if (!mini.folk.length && --mini.next <= 0) {
        // 新的一回合：三個村民站開，其中一個是白骨精
        const slots = [180, 480, 780].map(function (x) { return x + (rnd(mini) - 0.5) * 80; });
        const demon = Math.floor(rnd(mini) * 3);
        mini.folk = slots.map(function (x, i) { return { x: x, dir: rnd(mini) < 0.5 ? -1 : 1, look: (i + mini.round) % 3, demon: i === demon, sp: 0.6 + rnd(mini) * 0.5 }; });
        mini.round++;
      }
      mini.folk.forEach(function (f) {
        f.x += f.dir * f.sp;
        if (f.x < 60 || f.x > W - 60) f.dir = -f.dir;
        const box = { x: f.x - 13, y: GY - 44, w: 26, h: 44 };
        players.forEach(function (q) {
          if (f.gone || !stomped(q, box)) return;
          f.gone = true;
          if (f.demon) {
            mini.hits++; events.push('hit');
            H.burst(state, f.x, GY - 30, '#f4f0e6', 18);
            mini.folk.forEach(function (o) { o.gone = true; });
            mini.next = 60;
          } else {
            H.hurt(q, f.x, events);
            mini.wrong = 90;
            mini.folk.forEach(function (o) { o.gone = true; });   // 踩錯了：大家嚇跑，重來
            mini.next = 70;
          }
        });
      });
      mini.folk = mini.folk.filter(function (f) { return !f.gone; });
      if (mini.wrong > 0) mini.wrong--;
      // 白骨精偷偷丟骨頭（從她身上飛出來）
      const dm = mini.folk.filter(function (f) { return f.demon; })[0];
      if (dm && --mini.boneCd <= 0) {
        mini.boneCd = 110;
        const p = state.player, T = 50;
        mini.bones.push({ x: dm.x, y: GY - 40, vx: (p.x + p.w / 2 - dm.x) / T, vy: -7, t: 0 });
      }
      mini.bones.forEach(function (b) {
        b.x += b.vx; b.y += b.vy; b.vy += 0.28; b.t++;
        players.forEach(function (q) { if (!b.dead && U.overlap(q, { x: b.x - 8, y: b.y - 4, w: 16, h: 8 })) { b.dead = true; H.hurt(q, b.x, events); } });
        if (b.y > GY) b.dead = true;
      });
      mini.bones = mini.bones.filter(function (b) { return !b.dead; });
      if (mini.hits >= BONE_GOAL) win();
      else if (!mini.done && mini.time <= 0) fail();
    },
    draw: function (ctx, state, t, GY) {
      const mini = state.mini;
      hills(ctx, GY, '#9aa880', 0);
      // 五行山：左邊一座五個尖峰的大山，山腳壓著探出頭來的孫悟空
      ctx.fillStyle = '#7a6a54';
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-40 + k * 50, GY); ctx.lineTo(-10 + k * 50, GY - 170 - (k % 2) * 50); ctx.lineTo(20 + k * 50, GY); ctx.fill(); }
      ctx.fillStyle = '#f2c230'; ctx.fillRect(95, GY - 230, 14, 30);           // 山頂的封印
      ctx.fillStyle = '#c8302a'; U.text(ctx, '封', 102, GY - 215, { size: 10, color: '#c8302a', stroke: false });
      ctx.fillStyle = '#b8803a'; ctx.beginPath(); ctx.arc(30, GY - 14, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0c49a'; ctx.beginPath(); ctx.ellipse(32, GY - 12, 9, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8c040'; ctx.fillRect(18, GY - 22, 24, 3);
      if (mini.wrong > 0) U.text(ctx, '那是好人啊！', 60, GY - 50, { size: 14, color: '#ffe070', strokeWidth: 4 });
      mini.folk.forEach(function (f) {
        // 影子：白骨精的影子每隔一陣子變成骷髏
        const flick = f.demon && (Math.floor(t / 20) % 3 !== 0);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        if (flick) {
          ctx.strokeStyle = 'rgba(30, 20, 30, 0.7)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(f.x + 14, GY - 2, 18, 4, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(f.x + 26, GY - 3, 3.4, 0, Math.PI * 2); ctx.stroke();
          for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(f.x + 6 + k * 5, GY - 6); ctx.lineTo(f.x + 6 + k * 5, GY + 1); ctx.stroke(); }
        } else { ctx.beginPath(); ctx.ellipse(f.x + 10, GY - 2, 16, 4, 0, 0, Math.PI * 2); ctx.fill(); }
        const C = LOOKS[f.look], sw = Math.sin(t * 0.2 + f.x) * 2;
        ctx.fillStyle = '#3a2a22'; ctx.fillRect(f.x - 6 + sw, GY - 10, 4, 10); ctx.fillRect(f.x + 2 - sw, GY - 10, 4, 10);
        ctx.fillStyle = C[0]; ctx.fillRect(f.x - 11, GY - 34, 22, 25);
        ctx.fillStyle = C[1]; ctx.beginPath(); ctx.arc(f.x, GY - 39, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = f.look === 1 ? '#d8d8d8' : '#2a1a10'; ctx.beginPath(); ctx.arc(f.x, GY - 43, 7, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#16161c'; ctx.fillRect(f.x - 3 + f.dir, GY - 40, 1.6, 1.6); ctx.fillRect(f.x + 2 + f.dir, GY - 40, 1.6, 1.6);
        if (f.demon && Math.floor(t / 20) % 6 === 1) { ctx.fillStyle = '#ff2a2a'; ctx.fillRect(f.x - 3 + f.dir, GY - 40, 1.6, 1.6); ctx.fillRect(f.x + 2 + f.dir, GY - 40, 1.6, 1.6); }
      });
      mini.bones.forEach(function (b) {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 0.3);
        ctx.fillStyle = '#f4f0e6'; ctx.fillRect(-7, -1.5, 14, 3);
        ctx.beginPath(); ctx.arc(-7, -1.5, 2.4, 0, Math.PI * 2); ctx.arc(-7, 1.5, 2.4, 0, Math.PI * 2); ctx.arc(7, -1.5, 2.4, 0, Math.PI * 2); ctx.arc(7, 1.5, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
    },
    hud: function (mini, sec) { return '踩到白骨精 ' + mini.hits + ' / ' + BONE_GOAL + '　剩 ' + sec + ' 秒　（影子是骷髏的才是她）'; }
  });

  // ── 豬八戒：吃西瓜比賽 ──
  const MELON_GOAL = 10;
  Encounter.registerMini('xyBajie', {
    def: Object.assign({}, base, {
      name: '高老莊・吃西瓜比賽', game: '吃西瓜比賽', duration: 70 * 60, winTalk: 'xyJoin_bajie', clearTitle: '豬八戒認輸了！',
      fact: '豬八戒本來是天上的天蓬元帥，喝醉了被貶到人間，結果投胎成了一隻豬。',
      goal: '天上掉西瓜，搶在八戒前面吃掉 10 顆・撞到八戒的大肚子會被彈開'
    }),
    arena: function () { return { country: '西遊記', sky: ['#9ad0f0', '#f4f0d8'], spawnX: 200, groundTop: '#7aa850', groundBody: '#6a4a30' }; },
    init: function (state, mini) { seed(mini); mini.me = 0; mini.pig = 0; mini.melons = []; mini.next = 30; mini.px = 700; mini.pdir = -1; mini.chew = 0; },
    update: function (state, input, mini, events, win, fail, players) {
      const GY = Levels.GROUND_Y;
      if (--mini.next <= 0) {
        mini.next = 62;
        mini.melons.push({ x: 60 + rnd(mini) * 840, y: -30, vy: 0, on: false });
      }
      mini.melons.forEach(function (m) {
        if (!m.on) { m.vy += 0.25; m.y += m.vy; if (m.y >= GY - 16) { m.y = GY - 16; m.on = true; } }
        const box = { x: m.x - 16, y: m.y - 14, w: 32, h: 28 };
        players.forEach(function (q) { if (!m.gone && m.on && U.overlap(q, box)) { m.gone = true; mini.me++; events.push('catch'); H.burst(state, m.x, m.y, '#e84a4a', 10); } });
      });
      // 八戒：走向最近、已經落地的西瓜，走到就吃掉
      if (mini.chew > 0) mini.chew--;
      else {
        const tgt = mini.melons.filter(function (m) { return m.on && !m.gone; }).sort(function (a, b) { return Math.abs(a.x - mini.px) - Math.abs(b.x - mini.px); })[0];
        if (tgt) {
          mini.pdir = tgt.x > mini.px ? 1 : -1;
          mini.px += mini.pdir * Math.min(2.6, 1.9 + mini.elapsed / 3000);
          if (Math.abs(tgt.x - mini.px) < 14) { tgt.gone = true; mini.pig++; mini.chew = 30; events.push('shoo'); }
        }
      }
      // 撞到八戒的大肚子：被彈開
      const belly = { x: mini.px - 30, y: GY - 60, w: 60, h: 60 };
      players.forEach(function (q) { if (U.overlap(q, belly)) { q.vx = (q.x + q.w / 2 < mini.px ? -1 : 1) * 7; q.vy = Math.min(q.vy, -4); } });
      mini.melons = mini.melons.filter(function (m) { return !m.gone; });
      if (mini.me >= MELON_GOAL) win();
      else if (mini.pig >= MELON_GOAL || mini.time <= 0) fail();
    },
    draw: function (ctx, state, t, GY) {
      const mini = state.mini;
      hills(ctx, GY, '#8ab870', 200);
      // 高老莊的農舍
      ctx.fillStyle = '#d8c8a0'; ctx.fillRect(720, GY - 120, 180, 120);
      ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.moveTo(700, GY - 120); ctx.lineTo(810, GY - 180); ctx.lineTo(920, GY - 120); ctx.fill();
      ctx.fillStyle = '#7a4a2a'; ctx.fillRect(790, GY - 60, 40, 60);
      mini.melons.forEach(function (m) {
        if (!m.on) {
          const k = U.clamp(1 - (GY - m.y) / GY, 0.1, 1);
          ctx.fillStyle = 'rgba(0,0,0,' + (0.1 + k * 0.25).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(m.x, GY - 2, 8 + k * 10, 3, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#2f8a3a'; ctx.beginPath(); ctx.ellipse(m.x, m.y, 18, 15, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1a5a22'; ctx.lineWidth = 2;
        for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.ellipse(m.x + k * 7, m.y, 3, 14, 0, 0, Math.PI * 2); ctx.stroke(); }
      });
      // 八戒（粉紅色的大肚子，黑色僧衣，扛著釘耙）
      const x = mini.px, bob = mini.chew > 0 ? Math.sin(t * 0.8) * 2 : Math.abs(Math.sin(t * 0.3)) * 2;
      ctx.save(); ctx.translate(x, GY); ctx.scale(mini.pdir, 1);
      ctx.fillStyle = '#2a2a3a'; ctx.fillRect(-14, -14, 10, 14); ctx.fillRect(4, -14, 10, 14);
      ctx.beginPath(); ctx.ellipse(0, -36 - bob, 30, 26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0a8b0'; ctx.beginPath(); ctx.ellipse(6, -34 - bob, 18, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(10, -70 - bob, 18, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-4, -82 - bob, 7, 10, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e08890'; ctx.beginPath(); ctx.ellipse(26, -68 - bob, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(14, -76 - bob, 3, 3);
      ctx.strokeStyle = '#8a8a96'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-26, -10); ctx.lineTo(-20, -110); ctx.stroke();
      ctx.fillStyle = '#8a8a96'; ctx.fillRect(-32, -116, 26, 6);
      ctx.restore();
      if (mini.chew > 0) U.text(ctx, '嚼嚼', x, GY - 110, { size: 13, color: '#ffffff', strokeWidth: 3 });
      // 比分
      ctx.fillStyle = 'rgba(14, 18, 32, 0.6)'; U.roundRect(ctx, W / 2 - 120, 92, 240, 28, 8); ctx.fill();
      U.text(ctx, '你 ' + mini.me + '　：　八戒 ' + mini.pig, W / 2, 106, { size: 15, color: '#ffe9a8', stroke: false });
    },
    hud: function (mini, sec) { return '吃到 ' + mini.me + ' / ' + MELON_GOAL + '（八戒 ' + mini.pig + '）　剩 ' + sec + ' 秒'; }
  });

  // ── 沙悟淨：渡流沙河 ──
  const BANK_L = 150, BANK_R = 810, CROSS_GOAL = 2, STONE_X = [190, 300, 410, 520, 630, 740];
  Encounter.registerMini('xyWujing', {
    def: Object.assign({}, base, {
      name: '流沙河・渡河', game: '渡流沙河', duration: 70 * 60, winTalk: 'xyJoin_wujing', clearTitle: '沙悟淨跟你走了！',
      fact: '小說裡說流沙河「八百流沙界，三千弱水深，鵝毛飄不起，蘆花定底沉」—— 什麼東西掉進去都會沉。',
      goal: '石頭站一下就會沉，一塊接一塊跳過河・來回 2 趟'
    }),
    arena: function (GY) {
      const pl = STONE_X.map(function (x) { return { x: x, y: GY - 14, w: 60, h: 14, home: GY - 14, sink: 0, gone: 0 }; });
      return { country: '西遊記', sky: ['#e8c890', '#f8ecd0'], spawnX: 60, groundTop: '#d8b878', groundBody: '#a07a4a',
               ground: [{ x: 0, y: GY, w: BANK_L, h: Levels.GROUND_H }, { x: BANK_R, y: GY, w: W - BANK_R, h: Levels.GROUND_H }],
               platforms: pl, stones: pl };
    },
    init: function (state, mini) { seed(mini); mini.cross = 0; mini.goRight = true; mini.spouts = []; mini.spCd = 120; },
    update: function (state, input, mini, events, win, fail, players) {
      const GY = Levels.GROUND_Y, p = state.player, stones = state.def.stones;
      stones.forEach(function (s, i) {
        if (s.gone > 0) { if (--s.gone === 0) { s.y = s.home; s.sink = 0; s.x = STONE_X[i]; } return; }
        const on = players.some(function (q) { return q.onGround && Math.abs(q.y + q.h - s.y) < 3 && q.x + q.w > s.x && q.x < s.x + s.w; });
        if (on) s.sink++;
        else if (s.sink > 0 && s.y <= s.home + 1) s.sink = Math.max(0, s.sink - 1);
        if (s.sink > 26) s.y += 0.9;
        if (s.y > s.home + 34) { s.gone = 110; s.x = -500; }
      });
      // 河裡冒出的水柱（先冒泡）
      if (--mini.spCd <= 0) {
        mini.spCd = 150;
        mini.spouts.push({ x: STONE_X[Math.floor(rnd(mini) * STONE_X.length)] + 30, t: 120 });
      }
      mini.spouts.forEach(function (s) {
        s.t--;
        if (s.t < 60 && s.t > 0) players.forEach(function (q) { if (Math.abs(q.x + q.w / 2 - s.x) < 22 && q.y + q.h > GY - 160) H.hurt(q, s.x, events); });
      });
      mini.spouts = mini.spouts.filter(function (s) { return s.t > 0; });
      // 到對岸：算一趟，換方向
      if (p.onGround && (mini.goRight ? p.x > BANK_R + 10 : p.x + p.w < BANK_L - 10)) {
        mini.cross++; mini.goRight = !mini.goRight; events.push('catch');
        if (mini.cross >= CROSS_GOAL) win();
      }
      // 掉進流沙：痛一下，回到出發的岸邊
      players.forEach(function (q) {
        if (q.y + q.h > GY + 18 && q.x + q.w / 2 > BANK_L && q.x + q.w / 2 < BANK_R) {
          H.hurt(q, q.x, events);
          q.x = mini.goRight ? 60 : W - 90; q.y = GY - 60; q.vx = 0; q.vy = 0;
          H.burst(state, q.x, GY, '#d8b878', 12);
        }
      });
      if (!mini.done && mini.time <= 0) fail();
    },
    draw: function (ctx, state, t, GY) {
      const mini = state.mini;
      // 流沙河：黃濁的河水在兩岸中間慢慢流
      ctx.fillStyle = '#8a6a3a'; ctx.fillRect(BANK_L, GY - 4, BANK_R - BANK_L, 90);
      ctx.fillStyle = 'rgba(60, 40, 20, 0.5)'; ctx.fillRect(BANK_L, GY - 4, 6, 90); ctx.fillRect(BANK_R - 6, GY - 4, 6, 90);
      ctx.strokeStyle = 'rgba(255, 240, 200, 0.5)'; ctx.lineWidth = 2;
      for (let k = 0; k < 14; k++) { const x = BANK_L + ((k * 53 + t * 0.6) % (BANK_R - BANK_L)); ctx.beginPath(); ctx.arc(x, GY + 8 + (k % 4) * 12, 8, 0.2, Math.PI - 0.2); ctx.stroke(); }
      state.def.stones.forEach(function (s) {
        if (s.gone > 0) return;
        const shake = s.sink > 14 ? Math.sin(t * 1.4) * 1.5 : 0;
        ctx.fillStyle = s.sink > 14 ? '#8a7a64' : '#9a9080';
        ctx.beginPath(); ctx.ellipse(s.x + s.w / 2 + shake, s.y + 6, s.w / 2, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'; ctx.beginPath(); ctx.ellipse(s.x + s.w / 2 - 8 + shake, s.y + 2, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
      });
      mini.spouts.forEach(function (s) {
        if (s.t >= 60) {
          ctx.strokeStyle = 'rgba(255, 250, 230, 0.8)'; ctx.lineWidth = 1.5;
          for (let k = 0; k < 4; k++) { const ph = (t * 0.6 + k * 6) % 20; ctx.beginPath(); ctx.arc(s.x - 10 + k * 7, GY - ph, 3, 0, Math.PI * 2); ctx.stroke(); }
        } else {
          ctx.fillStyle = 'rgba(220, 200, 150, 0.85)'; ctx.fillRect(s.x - 18, GY - 160, 36, 160);
          ctx.fillStyle = 'rgba(255, 250, 230, 0.6)'; ctx.fillRect(s.x - 8, GY - 160, 8, 160);
          if (s.t > 40) { ctx.fillStyle = '#7a9ab0'; ctx.beginPath(); ctx.arc(s.x, GY - 170, 12, 0, Math.PI * 2); ctx.fill(); }   // 沙悟淨探頭
        }
      });
      // 要去的那一岸插一面旗子
      const fx = mini.goRight ? BANK_R + 70 : BANK_L - 70;
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(fx, GY - 70, 4, 70);
      ctx.fillStyle = '#c8302a'; ctx.beginPath(); ctx.moveTo(fx + 4, GY - 70); ctx.lineTo(fx + 30, GY - 62); ctx.lineTo(fx + 4, GY - 54); ctx.fill();
    },
    hud: function (mini, sec) { return '過河 ' + mini.cross + ' / ' + CROSS_GOAL + ' 趟（往' + (mini.goRight ? '右' : '左') + '岸）　剩 ' + sec + ' 秒　（石頭站一下就會沉）'; }
  });

  // ── 火焰山 ──
  const FLAME_W = 3200, VENT_GAP = 300;
  Encounter.registerMini('xyFlame', {
    def: Object.assign({}, base, {
      name: '火焰山', game: '過火焰山', duration: 120 * 60, bossExp: 250, bossCoins: 250, clearTitle: '過了火焰山！',
      onWin: function () { if (Save.flag('sutra') === 2) Save.setFlag('sutra', 3); return '師徒四人過了火焰山！他們先去長安，到大雁塔找他們'; },
      fact: '吐魯番的火焰山是紅色的砂岩山，夏天地表可以熱到七十幾度；《西遊記》說孫悟空向鐵扇公主借芭蕉扇才搧熄了火。',
      goal: '一直往右走過火焰山・地上的裂縫冒煙就要噴火了'
    }),
    arena: function (GY) {
      return { country: '西遊記', sky: ['#e8603a', '#f8c070'], spawnX: 80, groundTop: '#c8603a', groundBody: '#8a3a20', width: FLAME_W, bossArena: null,
               ground: [{ x: 0, y: GY, w: FLAME_W, h: Levels.GROUND_H }] };
    },
    init: function (state, mini) {
      mini.vents = [];
      for (let x = 400, k = 0; x < FLAME_W - 300; x += VENT_GAP, k++) mini.vents.push({ x: x, ph: (k * 47) % 200 });
    },
    update: function (state, input, mini, events, win, fail, players) {
      const GY = Levels.GROUND_Y, p = state.player;
      // 每個裂縫：冒煙 50 帧 → 噴火 60 帧 → 休息 90 帧（彼此錯開）
      mini.vents.forEach(function (v) {
        const c = (mini.elapsed + v.ph) % 200;
        v.state = c < 90 ? 'rest' : c < 140 ? 'smoke' : 'fire';
        if (v.state === 'fire') players.forEach(function (q) { if (Math.abs(q.x + q.w / 2 - v.x) < 30 && q.y + q.h > GY - 170) H.hurt(q, v.x, events); });
      });
      if (p.x > FLAME_W - 160) win();
      else if (!mini.done && mini.time <= 0) fail();
    },
    draw: function (ctx, state, t, GY) {
      const mini = state.mini, camX = Game.debug ? Game.debug.getCam().x : 0;
      // 紅色的山（視差）
      ctx.fillStyle = '#b84a2a';
      ctx.beginPath(); ctx.moveTo(0, GY);
      for (let x = 0; x <= W; x += 24) { const wx = x + camX * 0.3; ctx.lineTo(x, GY - 120 - 40 * Math.abs(Math.sin(wx * 0.006)) - 10 * Math.sin(wx * 0.05)); }
      ctx.lineTo(W, GY); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(120, 40, 20, 0.5)'; ctx.lineWidth = 2;
      for (let x = -((camX * 0.3) % 40); x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, GY - 20); ctx.lineTo(x + 10, GY - 90); ctx.stroke(); }
      // 熱浪
      ctx.fillStyle = 'rgba(255, 220, 160, 0.12)';
      for (let k = 0; k < 6; k++) ctx.fillRect(0, GY - 200 + k * 30 + Math.sin(t * 0.1 + k) * 4, W, 6);
      mini.vents.forEach(function (v) {
        const sx = v.x - camX;
        if (sx < -60 || sx > W + 60) return;
        ctx.fillStyle = '#3a1a10'; ctx.fillRect(sx - 20, GY - 3, 40, 5);                      // 裂縫
        if (v.state === 'smoke') {
          for (let k = 0; k < 4; k++) { const ph = (t * 0.8 + k * 8) % 40; ctx.fillStyle = 'rgba(90, 80, 80, ' + (0.5 - ph / 100).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(sx - 8 + k * 6, GY - 10 - ph * 1.5, 6 + ph * 0.2, 0, Math.PI * 2); ctx.fill(); }
        } else if (v.state === 'fire') {
          for (let k = 0; k < 3; k++) {
            const fl = Math.sin(t * 0.5 + k * 2) * 6;
            ctx.fillStyle = ['#ff4a1a', '#ff9a30', '#ffe070'][k];
            ctx.beginPath(); ctx.moveTo(sx - 30 + k * 9, GY); ctx.quadraticCurveTo(sx + fl, GY - 180 + k * 40, sx + 30 - k * 9, GY); ctx.fill();
          }
        }
      });
      // 終點：山的另一頭，往長安的路牌
      const ex = FLAME_W - 120 - camX;
      if (ex < W + 40) {
        ctx.fillStyle = '#6a4a2a'; ctx.fillRect(ex, GY - 80, 6, 80);
        ctx.fillStyle = '#e8d8b0'; ctx.fillRect(ex - 30, GY - 80, 70, 22);
        U.text(ctx, '往長安 →', ex + 5, GY - 69, { size: 11, color: '#3a2a1a', stroke: false });
      }
    },
    hud: function (mini, sec) { return '走過火焰山　剩 ' + sec + ' 秒　（裂縫冒煙就要噴火了）'; }
  });

  return { SUTRA_EXP: SUTRA_EXP, SUTRA_COINS: SUTRA_COINS, KHAN_EXP: KHAN_EXP, KHAN_COINS: KHAN_COINS, KHAN_WANTS: KHAN_WANTS,
           DISCIPLES: DISCIPLES, drawFollowers: drawFollowers, followers: followers, FLAME_W: FLAME_W };
})();
