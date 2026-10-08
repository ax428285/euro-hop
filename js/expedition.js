'use strict';

/**
 * v1.30 新的海上／陸上冒險（掛在 Encounter 底下，跟其他遭遇戰共用整套關卡流程）。
 *
 *   戰艦海戰 war**   哥倫布的委託：西歐五國各一艘戰艦停在自己的海岸外（接下委託後才出現）。
 *                    你在自己的甲板上跑：站到砲旁按 K／Enter 開砲（砲彈自己飛過去打船身）；
 *                    敵艦一輪輪齊射，甲板上的紅圈是落點 —— 打到人會痛，打到砲會把砲打壞一陣子；
 *                    敵方水兵會盪過來佔住你的砲，踩扁他們。把敵艦船身打到 0 就贏。
 *                    造船廠：船首砲 = 甲板上幾門砲、火藥庫 = 威力、船身 = 砲壞了修得快、船帆 = 紅圈出現得早。
 *   動物大遷徙 herd  撒哈拉的陸地上遊走的一群動物（非洲篇開放後才有），走路碰到就開始。
 *                    動物從右邊一隻隻跑過來：跳到背上就抓到，被撞到會痛。40 秒內至少抓 3 隻，送進阿爾及爾動物園。
 *   冥界 hel         卡律布狄斯「漩渦逃生」把命用完（還沒找到洛基時）就沉到這裡：往下掉的豎井關，最底下是洛基。
 *   金字塔 pyramid   吉薩：往下走的豎井關（崩落的石磚、滑動的石台），最底下是法老的墓室：第一次拿到「法老」時裝。
 */
const Expedition = (function () {
  const K = Encounter.KINDS;
  const GY = function () { return Levels.GROUND_Y; };

  // ── 戰艦 ───────────────────────────────────────────────
  const WARSHIPS = [
    { id: 'FR', country: '法國', ship: '「皇家路易號」', lon: -4.0, lat: 46.6, hp: 34, fact: '路易十四時代的皇家路易號有三層砲甲板，船尾雕滿了金色的太陽。' },
    { id: 'GB', country: '英國', ship: '皇家海軍「勝利號」', lon: -0.9, lat: 50.0, hp: 42, fact: '勝利號 1765 年下水，是納爾遜將軍在特拉法加海戰的旗艦，到今天還停在樸茨茅斯。' },
    { id: 'NL', country: '荷蘭', ship: '東印度公司「巴達維亞號」', lon: 3.6, lat: 53.5, hp: 30, fact: '巴達維亞號是 1628 年荷蘭東印度公司的大帆船，處女航就在澳洲外海觸礁；今天荷蘭照原樣重造了一艘。' },
    { id: 'DE', country: '德國', ship: '漢薩同盟「呂貝克之鷹號」', lon: 11.4, lat: 54.5, hp: 32, fact: '1566 年呂貝克造的呂貝克之鷹號，是當年波羅的海最大的戰艦。' },
    { id: 'GR', country: '希臘', ship: '三列槳戰船「奧林匹亞斯號」', lon: 25.6, lat: 39.4, hp: 26, fact: '三列槳戰船靠船頭的青銅撞角撞沉敵船；1987 年希臘照古書重造了一艘，取名奧林匹亞斯號。' }
  ];
  /*
   * v1.30 玩家：戰艦有分等級，外觀要不一樣。
   * style = 船型（地圖圖示與海戰裡的大船都照它畫）；rank = 星等（船身越硬越高）。
   *   trireme  三列槳戰船：低矮、一面方帆、兩排槳、船頭青銅撞角、畫著眼睛         ★
   *   galley   槳帆船：兩面三角帆（拉丁帆）、一排槳、紅金船身                        ★
   *   galleon  蓋倫帆船：三桅、一層砲門                                              ★
   *   cog      柯克船：一根粗桅、一面大方帆、船頭船尾高高的木城樓、一層砲門            ★★
   *   liner2   兩層砲甲板的戰列艦：三桅、兩排砲門、船身更高                          ★★
   *   liner3   三層砲甲板的一級戰列艦（勝利號）：最高大，黑黃相間的「納爾遜棋盤」    ★★★
   */
  // v1.30 玩家：船艦五艘就好，放在地圖上比較空的國家（西班牙、義大利附近已經很擠，拿掉）
  const STYLE = { GR: 'trireme', NL: 'galleon', DE: 'cog', FR: 'liner2', GB: 'liner3', IT: 'galley' };
  WARSHIPS.forEach(function (w, i) {
    w.style = STYLE[w.id];
    w.rank = w.hp <= 30 ? 1 : w.hp <= 36 ? 2 : 3;
    w.kind = 'war' + w.id;
    // 難度級數 0～5（船身越硬的越兇：齊射更密、水兵更常盪過來）
    w.tier = [26, 30, 32, 34, 36, 42].indexOf(w.hp);
    K[w.kind] = { name: w.country + w.ship, lv: '戰艦', exp: 70, bossExp: 150, bossCoins: 150, game: '戰艦海戰',
                  goal: '站在砲旁按 K／Enter 開砲！紅圈是敵艦砲彈的落點・踩扁跳上船的水兵', custom: true, warship: w, fixed: true,
                  clearTitle: '擊沉了' + w.country + '的戰艦！' };
  });

  K.herd = { name: '動物大遷徙', lv: '遷徙', exp: 60, game: '抓動物', custom: true,
             goal: '跳到動物背上就抓到了！被撞到會痛・40 秒內至少抓 3 隻（最多 12 隻）', clearTitle: '抓到動物了！' };
  K.hel = { name: '冥界赫爾海姆', lv: '冥界', exp: 50, bossExp: 120, bossCoins: 100, game: '墜入冥界', custom: true, quest: true,
            goal: '一路往下掉到冥界最底層！上面的冰刺會追下來', clearTitle: '掉到冥界最底層了！' };
  /*
   * v1.30 玩家：金字塔的金幣獎勵改成「神祕的鑰匙」—— 冥界的洛基被關在籠子裡，要這把鑰匙才救得出來
   * （沒有鑰匙：冥界走到底只會隔著欄杆聊兩句、被傳回大地圖）。
   */
  K.pyramid = { name: '失落的金字塔', lv: '遺跡', exp: 80, bossExp: 180, bossCoins: 0, game: '金字塔探險', custom: true, quest: true,
                goal: '往下走到法老的墓室！小心崩落的天花板和滑動的石台', clearTitle: '找到法老的墓室了！' };

  /** 這個小遊戲（state.def.minigame）歸這裡管嗎 */
  function has(kind) { return kind === 'warship' || kind === 'herd'; }

  // ── 地圖上的戰艦、遷徙的動物 ───────────────────────────

  let herdCd = 0;

  function seaNear(lon, lat) {
    const p = EuropeWorld.project(lon, lat);
    for (let r = 0; r <= 70; r += 4) {
      for (let k = 0; k < 16; k++) {
        const a = k * Math.PI / 8;
        const x = p[0] + Math.cos(a) * r, y = p[1] + Math.sin(a) * r;
        if (Voyage.isNavigable(x, y)) return { x: x, y: y };
        if (r === 0) break;
      }
    }
    return null;
  }

  // 撒哈拉北緣的遷徙範圍（世界座標，第一次用到才算）
  let herdBox = null;
  function box() {
    if (!herdBox) {
      const a = EuropeWorld.project(-6, 31.5), b = EuropeWorld.project(28, 22);
      herdBox = { x0: a[0], y0: a[1], x1: b[0], y1: b[1] };
    }
    return herdBox;
  }
  function africaOpen() {
    return typeof Save !== 'undefined' && Encounter.regionUnlocked('africa', Save.get().exp);
  }

  /** Encounter.updateMap 每帧呼叫：該有的戰艦、動物群不在清單上就補 */
  function ensure(monsters) {
    if (typeof Save === 'undefined' || typeof Voyage === 'undefined') return;
    if (Save.flag('columbus') >= 1) {
      WARSHIPS.forEach(function (w) {
        if (monsters.some(function (m) { return m.kind === w.kind; })) return;
        const at = seaNear(w.lon, w.lat);
        if (at) monsters.push({ kind: w.kind, def: K[w.kind], x: at.x, y: at.y, heading: Math.PI, life: Infinity, appear: 1, custom: true });
      });
    }
    if (herdCd > 0) { herdCd--; return; }
    if (africaOpen() && !monsters.some(function (m) { return m.kind === 'herd'; })) {
      const b = box();
      for (let k = 0; k < 60; k++) {
        const x = b.x0 + Math.random() * (b.x1 - b.x0), y = b.y0 + Math.random() * (b.y1 - b.y0);
        if (!Voyage.isLand(x, y)) continue;
        monsters.push({ kind: 'herd', def: K.herd, x: x, y: y, heading: Math.random() * Math.PI * 2, life: Infinity, appear: 0, custom: true });
        break;
      }
      herdCd = 120;
    }
  }

  /** 每帧：動物群在撒哈拉北緣慢慢走；回傳船（人）是不是夠近、可以按 Enter */
  function mapNear(m, ship, d) {
    if (m.kind === 'herd') {
      m.heading += (Math.random() - 0.5) * 0.1;
      const b = box();
      const nx = m.x + Math.cos(m.heading) * 0.22, ny = m.y + Math.sin(m.heading) * 0.22;
      if (nx > b.x0 && nx < b.x1 && ny > b.y0 && ny < b.y1 && Voyage.isLand(nx, ny)) { m.x = nx; m.y = ny; }
      else m.heading += Math.PI * (0.6 + Math.random() * 0.8);
      return d < 26 && Voyage.mode() === 'land';
    }
    return d < 34;
  }

  /** 地圖上的戰艦：三桅帆船＋該國國旗＋名牌（打沉過的牌子變灰） */
  function drawMapMonster(ctx, m, t, near) {
    const w = m.def.warship;
    if (m.kind === 'herd') {
      if (near) {
        ctx.strokeStyle = 'rgba(255, 220, 140, 0.95)'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.arc(0, -4, 20 + Math.sin(t * 0.1) * 2, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(200, 160, 100, 0.45)';
      ctx.beginPath(); ctx.ellipse(-4, 2, 20, 5, 0, 0, Math.PI * 2); ctx.fill();
      [['zebra', -14, 0], ['wildebeest', -2, -3], ['gazelle', 9, 1]].forEach(function (a, i) {
        ctx.save();
        ctx.translate(a[1], a[2] + Math.abs(Math.sin(t * 0.25 + i)) * -1.5);
        ctx.scale(0.28, 0.28);
        drawAnimal(ctx, a[0], -30, 0, -1, t, true);
        ctx.restore();
      });
      ctx.fillStyle = 'rgba(90, 60, 20, 0.85)';
      U.roundRect(ctx, -30, -30, 60, 13, 4); ctx.fill();
      U.text(ctx, '動物大遷徙', 0, -23.5, { size: 9, color: '#ffe0a0', stroke: false });
      return;
    }
    const down = Save.seaBossDown(m.kind);
    const lv = Levels.list.filter(function (l) { return l.id === w.id; })[0];
    const sz = [0, 0.8, 1, 1.25][w.rank];          // 等級越高，地圖上的船越大
    if (near) {
      ctx.strokeStyle = 'rgba(255, 120, 110, 0.95)'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(0, -8, 20 * sz + 4 + Math.sin(t * 0.1) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.save();
    ctx.rotate(Math.sin(t * 0.05 + w.lon) * 0.05);
    ctx.scale(sz, sz);
    const top = drawMapShip(ctx, w.style, down, t);
    if (lv) Sprites.flagFace(ctx, 0.7, top - 8, 11, 7, lv.flag, lv.flagDir);
    ctx.restore();
    const tagY = -46 * sz - 4;
    const label = '★★★'.slice(0, w.rank) + ' ' + w.country + '戰艦' + (down ? '（已擊沉）' : '');
    ctx.fillStyle = down ? 'rgba(50, 40, 40, 0.9)' : 'rgba(110, 20, 20, 0.92)';
    U.roundRect(ctx, -40, tagY, 80, 13, 4); ctx.fill();
    U.text(ctx, label, 0, tagY + 6.5, { size: 9, color: down ? '#c8bcb0' : '#ffd0c8', stroke: false });
  }

  /** 地圖上的小戰艦（船型見 STYLE）；回傳主桅頂端的 y（國旗插在那裡） */
  function drawMapShip(ctx, style, down, t) {
    const sail = down ? '#bcb4a8' : '#f4efe2';
    const hull = down ? '#5a5048' : style === 'galley' ? '#8a2a20' : style === 'liner3' ? '#1e1e22' : '#4a2c1a';
    if (style === 'trireme' || style === 'galley') {
      // 低矮的長船身＋一排排的槳
      ctx.fillStyle = hull;
      ctx.beginPath(); ctx.moveTo(-18, -1); ctx.lineTo(16, -2); ctx.lineTo(13, 3); ctx.lineTo(-15, 3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(80, 50, 30, 0.9)'; ctx.lineWidth = 0.8;
      const sw = Math.sin(t * 0.2) * 1.5;
      for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.moveTo(-13 + k * 4, 2); ctx.lineTo(-15 + k * 4 + sw, 7); ctx.stroke(); }
      ctx.fillStyle = '#e8c060'; ctx.fillRect(-16, -1, 30, 1);
      if (style === 'trireme') {
        ctx.fillStyle = '#c8903a';
        ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(21, 2); ctx.lineTo(15, 3); ctx.closePath(); ctx.fill();   // 撞角
        ctx.fillStyle = '#d8d0bc'; ctx.fillRect(-0.7, -18, 1.4, 17);
        ctx.fillStyle = sail; ctx.fillRect(-6, -16, 12, 9);
        return -18;
      }
      ctx.fillStyle = '#d8d0bc'; ctx.fillRect(-6.7, -18, 1.4, 17); ctx.fillRect(4.3, -14, 1.4, 13);
      ctx.fillStyle = sail;
      ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(1, -4); ctx.lineTo(-11, -4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(5, -14); ctx.lineTo(10, -4); ctx.lineTo(1, -4); ctx.closePath(); ctx.fill();
      return -18;
    }
    if (style === 'cog') {
      ctx.fillStyle = hull;
      ctx.beginPath(); ctx.moveTo(-14, -4); ctx.lineTo(14, -4); ctx.lineTo(10, 5); ctx.lineTo(-10, 5); ctx.closePath(); ctx.fill();
      ctx.fillRect(-15, -9, 7, 6); ctx.fillRect(8, -8, 7, 5);                                  // 船頭船尾的木城樓
      ctx.fillStyle = '#d8d0bc'; ctx.fillRect(-0.8, -26, 1.6, 22);
      ctx.fillStyle = sail; ctx.fillRect(-8, -23, 16, 14);
      ctx.fillStyle = '#c0281e'; ctx.fillRect(-1.5, -20, 3, 8);
      return -26;
    }
    // 三桅帆船：蓋倫船、戰列艦（砲門排數不同）
    const decks = style === 'liner3' ? 3 : style === 'liner2' ? 2 : 1;
    const hh = 3 + decks * 3;
    ctx.fillStyle = hull;
    ctx.beginPath(); ctx.moveTo(-17, -hh); ctx.lineTo(17, -hh - 2); ctx.lineTo(12, 5); ctx.lineTo(-13, 5); ctx.closePath(); ctx.fill();
    for (let d = 0; d < decks; d++) {
      const y = -hh + 2 + d * 3;
      ctx.fillStyle = style === 'liner3' ? '#e8c040' : '#e8c060';
      if (style === 'liner3' || d === 0) ctx.fillRect(-15, y, 30, 1.2);
      ctx.fillStyle = '#120c06';
      for (let k = 0; k < 6; k++) ctx.fillRect(-13 + k * 5, y + 1.3, 1.6, 1.4);
    }
    const mh = 22 + decks * 2;
    ctx.fillStyle = '#d8d0bc';
    [-8, 0, 8].forEach(function (mx, i) { ctx.fillRect(mx - 0.7, -hh - mh + i % 2 * 4 + 2, 1.4, mh - i % 2 * 4); });
    ctx.fillStyle = sail;
    [-8, 0, 8].forEach(function (mx, i) {
      for (let s = 0; s < decks + 1; s++) ctx.fillRect(mx - 4.5 + s * 0.5, -hh - mh + 6 + i % 2 * 4 + s * 7, 9 - s, 5.5);
    });
    return -hh - mh + 2;
  }

  function prompt(m) {
    if (m.kind === 'herd') return '按 Enter 去抓動物（' + K.herd.exp + ' EXP，抓到的送進阿爾及爾動物園）';
    const down = Save.seaBossDown(m.kind);
    return '按 Enter 跟' + '★★★'.slice(0, m.def.warship.rank) + m.def.name + '開戰（' + (down ? '再戰 +' + m.def.exp + ' EXP' : '首次 +' + m.def.bossExp + ' EXP、€' + m.def.bossCoins) + '）';
  }

  // ── 關卡定義 ─────────────────────────────────────────

  const DECK_W = 560;
  const ENEMY_X = 610;
  const GUN_SLOTS = [150, 290, 430];

  function arena(m, extra) {
    const G = GY();
    return Object.assign({
      // 左上角的標題（country　city）要短，不然會壓到旁邊的金幣數
      // 戰艦海戰用 'WAR'：跳上船的小怪畫成水兵（見下面 Sprites.countryEnemies.WAR）
      id: m.def.warship ? 'WAR' : 'SEA', country: m.def.game, city: m.def.warship ? m.def.warship.country + '戰艦' : '撒哈拉',
      flag: ['#1d3a5c', '#e8e2d2', '#1d3a5c'], flagDir: 'h', landmark: null,
      sky: ['#5fa8d8', '#f6dcae'], hill: '#2f6f9a', groundTop: '#b88a58', groundBody: '#6a4a30',
      deco: null, width: 960, height: 480, layout: 'boss', skirmish: true, spawnX: 120, isBoss: false,
      bossArena: { x: 0, y: 0, w: 960, h: 480 },
      ground: [{ x: 0, y: G, w: 960, h: Levels.GROUND_H }],
      water: [], spikes: [], props: [], platforms: [], movers: [], secrets: [], enemies: [], coins: [],
      goal: Infinity, monster: m, exp: m.def.exp
    }, extra);
  }

  function firstTime(m) { return !Save.seaBossDown(m.kind); }

  const shaftBase = {};
  function shaftDef(m) {
    const kind = m.kind;
    if (!shaftBase[kind]) {
      const cfg = kind === 'hel' ? {
        seed: 1071, id: 'HEL', country: '冥界', city: '赫爾海姆', region: 'sea',
        flag: ['#1a2a2a', '#9ad0c0', '#1a2a2a'], flagDir: 'h', landmark: null,
        fact: '北歐神話裡，冥界赫爾海姆在世界樹最深的根底下，由洛基的女兒赫爾掌管，終年寒冷。',
        sky: ['#0a161c', '#1a2c34'], hill: '#14202a', groundTop: '#8ab0b0', groundBody: '#2a3a3c',
        theme: 'hel', floors: 20, gapY: 110, platW: 112, shaftW: 580, scroll: [0.8, 1.25], extras: ['ice']
      } : {
        seed: 1072, id: 'PYR', country: '失落的金字塔', city: '法老的墓室', region: 'sea',
        flag: ['#CE1126', '#FFFFFF', '#000000'], flagDir: 'eg', landmark: null,
        fact: '沙漠深處被黃沙埋了幾千年的金字塔。傳說最深的墓室裡，藏著一把不屬於人間的鑰匙。',
        sky: ['#3a2a1a', '#6a4a2a'], hill: '#4a3420', groundTop: '#d8b878', groundBody: '#7a5a34',
        theme: 'pyramid', floors: 26, gapY: 110, platW: 112, shaftW: 560, scroll: [0.75, 1.4], extras: ['slide'],
        chime: { every: 620, dur: 140, boost: 1.6, label: '轟隆——', sub: '機關啟動！天花板降得更快了', sound: 'rumble' }
      };
      shaftBase[kind] = Levels.makeShaft(cfg);
      shaftBase[kind].intro = kind === 'hel'
        ? ['往下掉到冥界最底層！上面的冰刺會追下來', '藍色的冰面會滑，要提早放開方向鍵']
        : ['往下走到法老的墓室！上面的天花板會壓下來', '石台會左右滑動・「轟隆」一聲之後天花板會降得更快'];
    }
    const first = firstTime(m);
    return Object.assign({}, shaftBase[kind], {
      quest: true,
      monster: m, exp: first ? m.def.bossExp : m.def.exp, bossCoins: first ? m.def.bossCoins : 0, firstBoss: first,
      fact: shaftBase[kind].fact + (first ? '　第一次走到底：' + m.def.bossExp + ' EXP' + (m.def.bossCoins ? '＋' + m.def.bossCoins + ' 金幣' : '') : '　再來一次：' + m.def.exp + ' EXP')
    });
  }

  function makeDef(m) {
    if (m.def.quest) return shaftDef(m);
    const G = GY();
    if (m.kind === 'herd') {
      return arena(m, {
        minigame: 'herd', duration: 40 * 60, spawnX: 200,
        sky: ['#f0b060', '#f8e4b0'], hill: '#c8963e', groundTop: '#c8b060', groundBody: '#7a5a30',
        fact: '每年有上百萬頭牛羚、斑馬跟著雨季遷徙找草吃，是地球上最壯觀的動物大移動。抓到的動物會送進阿爾及爾動物園。'
      });
    }
    const w = m.def.warship;
    const lv = Levels.list.filter(function (l) { return l.id === w.id; })[0];
    const first = firstTime(m);
    return arena(m, {
      minigame: 'warship', duration: 120 * 60,
      flag: lv ? lv.flag : ['#1d3a5c', '#e8e2d2', '#1d3a5c'], flagDir: lv ? lv.flagDir : 'h',
      sky: ['#6a9ac8', '#ead8b4'],
      bossArena: { x: 0, y: 0, w: DECK_W, h: 480 },
      ground: [{ x: 0, y: G, w: DECK_W, h: Levels.GROUND_H }],
      exp: first ? m.def.bossExp : m.def.exp, bossCoins: first ? m.def.bossCoins : 0, firstBoss: first,
      fact: w.fact + (first ? '　第一次擊沉：' + m.def.bossExp + ' EXP＋' + m.def.bossCoins + ' 金幣' : '　再戰：' + m.def.exp + ' EXP')
    });
  }

  // ── 小遊戲：執行期 ─────────────────────────────────────

  function initMini(state, mini) {
    if (mini.kind === 'warship') {
      const ship = Save.ship();
      const w = state.def.monster.def.warship;
      const n = Shipyard.deckGuns(ship);
      mini.w = w;
      mini.guns = GUN_SLOTS.slice(3 - n).map(function (x) { return { x: x, cd: 40, jam: 0 }; });
      // 船身 = 表上的 hp × 4；沒升級的船（1 門砲、每發 6）要打一分多鐘，升滿級（3 門、每發 12）大約 15～30 秒
      mini.hp = mini.hpMax = w.hp * 4;
      mini.dmg = Shipyard.shellDmg(ship);
      mini.warn = Shipyard.warnTime(ship);
      mini.repair = Shipyard.repairTime(ship);
      mini.reload = 150;
      mini.balls = []; mini.shells = []; mini.volCd = 110; mini.marineCd = 420; mini.seq = 0; mini.shake = 0; mini.flash = 0;
    } else if (mini.kind === 'herd') {
      mini.animals = []; mini.next = 50; mini.seq = 0; mini.caught = [];
    }
  }

  function hurt(p, fromX, events) {
    if (p.invuln > 0) return;
    p.invuln = 90 + (p.stats.invulnBonus || 0);
    const kb = p.stats.steady ? 0.5 : 1;
    p.vy = -6 * kb;
    p.vx = (fromX > p.x ? -1 : 1) * 4 * kb;
    events.push('p' + (p.pid || 0) + ':hurt');
  }
  function burst(state, x, y, color, n) {
    for (let i = 0; i < (n || 10); i++) {
      state.particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4, life: 24, color: color });
    }
  }

  // 出場順序（固定，結果可重現）：稀有的獅子、大象各一隻夾在中間
  const HERD_SEQ = ['zebra', 'wildebeest', 'gazelle', 'zebra', 'giraffe', 'lion', 'wildebeest', 'gazelle',
                    'elephant', 'zebra', 'wildebeest', 'giraffe', 'gazelle', 'zebra'];
  const SPEC = {
    zebra: { w: 60, h: 40, sp: 2.6 }, wildebeest: { w: 62, h: 42, sp: 2.9 }, gazelle: { w: 44, h: 32, sp: 3.6 },
    giraffe: { w: 60, h: 46, sp: 2.2 }, lion: { w: 62, h: 36, sp: 3.2 }, elephant: { w: 96, h: 66, sp: 1.5 }
  };

  function update(state, input, mini, events, win, fail) {
    const G = GY();
    const p = state.player;
    const players = state.players.filter(function (q) { return !q.out; });

    if (mini.kind === 'warship') {
      const tier = mini.w.tier;
      mini.guns.forEach(function (g) {
        if (g.cd > 0) g.cd--;
        if (g.jam > 0) g.jam--;
        g.blocked = state.enemies.some(function (e) { return e.alive && Math.abs(e.x + e.w / 2 - g.x) < 28; });
      });
      const fire = input && (input.once('throw') || input.once('confirm'));
      if (fire) {
        const g = mini.guns.filter(function (q) { return Math.abs(p.x + p.w / 2 - q.x) < 42 && p.onGround; })[0];
        if (g) {
          if (g.cd === 0 && !g.jam && !g.blocked) {
            mini.balls.push({ x: g.x + 26, y: G - 40, vx: 7.5, vy: -6.2 });
            g.cd = mini.reload; g.kick = 10;
            events.push('fire');
          } else events.push('clang');
        }
      }
      mini.guns.forEach(function (g) { if (g.kick > 0) g.kick--; });
      mini.balls.forEach(function (b) {
        b.x += b.vx; b.y += b.vy; b.vy += 0.18;
        if (b.x > ENEMY_X + 30 && b.y > G - 170) {
          b.dead = true;
          mini.hp = Math.max(0, mini.hp - mini.dmg);
          mini.shake = 18; mini.flash = 8;
          events.push('hit');
          burst(state, b.x, b.y, '#ffb050', 16);
          if (mini.hp <= 0) win();
        } else if (b.y > G + 30) { b.dead = true; burst(state, b.x, G + 10, '#bfe3ff', 8); }
      });
      mini.balls = mini.balls.filter(function (b) { return !b.dead; });
      if (mini.shake > 0) mini.shake--;
      if (mini.flash > 0) mini.flash--;
      // 敵艦齊射：一發瞄你、一發（tier 2 以上）瞄一門砲
      if (--mini.volCd <= 0) {
        mini.volCd = Math.max(80, 132 - tier * 9);
        const tx = U.clamp(p.x + p.w / 2 + [0, -80, 70, -40, 100][mini.seq % 5], 30, DECK_W - 30);
        mini.shells.push({ x: tx, fuse: mini.warn, max: mini.warn });
        // 比較兇的戰艦（tier 2 以上）每三輪會多一發瞄你的砲（只有一門砲時不能一直被打壞，不然根本打不了）
        if (tier >= 2 && mini.seq % 3 === 2) {
          const g = mini.guns[mini.seq % mini.guns.length];
          if (Math.abs(g.x - tx) > 60) mini.shells.push({ x: g.x + 10, fuse: mini.warn + 20, max: mini.warn + 20 });
        }
        mini.seq++;
        events.push('cannon');
      }
      mini.shells.forEach(function (s) {
        if (--s.fuse === 0) {
          s.boom = 16;
          players.forEach(function (q) {
            if (Math.abs(q.x + q.w / 2 - s.x) < 34 && q.y + q.h > G - 70) hurt(q, s.x, events);
          });
          mini.guns.forEach(function (g) { if (Math.abs(g.x + 10 - s.x) < 34) g.jam = Math.max(g.jam, mini.repair); });
          events.push('boom');
        }
        if (s.fuse < 0) s.boom--;
      });
      mini.shells = mini.shells.filter(function (s) { return s.fuse > 0 || s.boom > 0; });
      // 水兵盪過來（最多兩個）
      if (--mini.marineCd <= 0) {
        mini.marineCd = Math.max(300, 520 - tier * 45);
        if (state.enemies.filter(function (e) { return e.alive; }).length < 2) {
          const e = makeEnemy({ x: DECK_W - 50, type: 'walker', left: 20, right: DECK_W - 10, dir: -1 });
          e.summoned = true; e.marine = true;
          state.enemies.push(e);
          burst(state, DECK_W - 40, G - 30, '#d8c8a0', 8);
          events.push('shoo');
        }
      }
      if (!mini.done && mini.time <= 0) fail();

    } else if (mini.kind === 'herd') {
      if (--mini.next <= 0) {
        const id = HERD_SEQ[mini.seq++ % HERD_SEQ.length];
        const sp = SPEC[id];
        mini.next = 46 + (mini.seq % 3) * 16 + (id === 'elephant' ? 40 : 0);
        mini.animals.push({ id: id, x: 990, w: sp.w, h: sp.h, sp: sp.sp * (1 + mini.elapsed / 7200) });
      }
      mini.animals.forEach(function (a) {
        a.x -= a.sp;
        const bx = { x: a.x, y: G - a.h, w: a.w, h: a.h };
        players.forEach(function (q) {
          if (a.gone || !U.overlap(q, bx)) return;
          if (q.vy > 0 && (q.y + q.h) - bx.y < 20) {
            a.gone = true;
            mini.caught.push(a.id);
            q.vy = PHYS.STOMP_BOUNCE;
            events.push('catch');
            burst(state, a.x + a.w / 2, bx.y, '#ffe9a0', 14);
          } else {
            hurt(q, a.x + a.w / 2, events);
          }
        });
      });
      mini.animals = mini.animals.filter(function (a) { return !a.gone && a.x > -140; });
      if (mini.caught.length >= 12) win();         // 一次最多抓 12 隻
      else if (!mini.done && mini.time <= 0) { if (mini.caught.length >= 3) win(); else fail(); }
    }
  }

  /** 打贏之後：動物送進動物園；冥界 → 回地圖要跟洛基說話；金字塔第一次 → 法老時裝 */
  function onClear(skirmish, state) {
    const out = {};
    if (skirmish.kind === 'herd') {
      herdCd = 900;
      const cnt = {};
      (state.mini.caught || []).forEach(function (id) { cnt[id] = (cnt[id] || 0) + 1; });
      Object.keys(cnt).forEach(function (id) { Save.addAnimal(id, cnt[id]); });
      out.note = '抓到：' + Object.keys(cnt).map(function (id) { return Quests.ANIMALS[id].name + ' ' + cnt[id]; }).join('、') + ' —— 已送到阿爾及爾動物園';
    }
    if (skirmish.kind === 'hel' && !Save.flag('loki')) {
      // 有鑰匙 → 救出洛基；沒有 → 隔著籠子聊兩句（提示鎖是哪裡的手藝），傳回大地圖
      if (Save.flag('key')) out.talk = 'loki';
      else { out.talk = 'lokiLocked'; out.note = '最底層有一個上了鎖的籠子⋯⋯沒有鑰匙打不開，先回大地圖吧'; }
    }
    if (skirmish.kind === 'pyramid') {
      if (!Save.flag('key')) {
        Save.setFlag('key', 1);
        out.note = '獲得「神祕的鑰匙」—— 冰冷的金屬上刻著一隻眼睛，和一個頭上帶圈的十字';
      }
      if (state.def.firstBoss && typeof Costumes !== 'undefined' && !Save.get().costumes.includes('pharaoh')) {
        Save.addCostume('pharaoh');
        out.costume = Costumes.get('pharaoh');
      }
    }
    if (skirmish.def.warship) {
      const left = WARSHIPS.filter(function (w) { return !Save.seaBossDown(w.kind); }).length;
      out.note = left ? '哥倫布的委託：還剩 ' + left + ' 艘戰艦' : '五國戰艦全部擊沉！回塞維亞找哥倫布吧';
    }
    return out;
  }

  // ── 小遊戲：繪製 ───────────────────────────────────────

  /** 動物側面（x = 左緣、gy = 地面、dir = -1 面向左）；scale 用 ctx 外面縮 */
  function drawAnimal(ctx, id, x, gy, dir, t, run) {
    const sp = SPEC[id] || SPEC.zebra;
    ctx.save();
    ctx.translate(x + sp.w / 2, gy);
    ctx.scale(dir < 0 ? -1 : 1, 1);       // 畫的時候頭朝右（+x），dir -1 就翻過來
    const leg = run ? Math.sin(t * 0.45) * 6 : 0;
    const W2 = sp.w / 2;
    function legs(col, lx, h) {
      ctx.fillStyle = col;
      [[-W2 + lx, leg], [-W2 + lx + 10, -leg], [W2 - lx - 14, leg], [W2 - lx - 4, -leg]].forEach(function (l) {
        ctx.fillRect(l[0] + l[1] * 0.4, -h, 5, h);
      });
    }
    if (id === 'zebra' || id === 'wildebeest' || id === 'gazelle') {
      const body = id === 'zebra' ? '#f4f4f0' : id === 'wildebeest' ? '#6a6460' : '#d8a060';
      const H = sp.h, lh = H * 0.45;
      legs(id === 'zebra' ? '#2a2a2a' : body, 6, lh);
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(-2, -lh - H * 0.18, W2 - 6, H * 0.24, 0, 0, Math.PI * 2); ctx.fill();
      // 脖子＋頭
      ctx.beginPath(); ctx.moveTo(W2 - 14, -lh - H * 0.3); ctx.lineTo(W2 - 2, -H + 2); ctx.lineTo(W2 + 8, -H + 6); ctx.lineTo(W2 + 6, -H + 14); ctx.lineTo(W2 - 6, -lh - H * 0.08); ctx.closePath(); ctx.fill();
      if (id === 'zebra') {
        ctx.fillStyle = '#1e1e22';
        for (let k = 0; k < 6; k++) ctx.fillRect(-W2 + 10 + k * 7, -lh - H * 0.4, 3, H * 0.4);
        ctx.fillRect(W2 - 8, -H + 2, 3, 10);
        ctx.fillRect(W2 - 14, -H + 2, 10, 3);     // 鬃毛
      } else if (id === 'wildebeest') {
        ctx.fillStyle = '#2a2420'; ctx.fillRect(W2 - 4, -H + 8, 8, 8);    // 鬍鬚
        ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(W2 + 2, -H + 2); ctx.quadraticCurveTo(W2 - 4, -H - 6, W2 - 8, -H); ctx.stroke();
      } else {
        ctx.fillStyle = '#f4efe2'; ctx.fillRect(-W2 + 6, -lh - 6, W2 * 2 - 16, 4);
        ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(W2 + 2, -H + 4); ctx.lineTo(W2 - 2, -H - 8); ctx.moveTo(W2 + 5, -H + 4); ctx.lineTo(W2 + 3, -H - 8); ctx.stroke();
      }
      ctx.fillStyle = '#16161c'; ctx.fillRect(W2 + 2, -H + 6, 2, 2);
    } else if (id === 'giraffe') {
      const lh = 26;
      legs('#e8b04a', 8, lh);
      ctx.fillStyle = '#e8b04a';
      ctx.beginPath(); ctx.ellipse(-2, -lh - 8, W2 - 6, 12, -0.08, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(W2 - 18, -lh - 14); ctx.lineTo(W2 - 2, -lh - 70); ctx.lineTo(W2 + 6, -lh - 66); ctx.lineTo(W2 - 6, -lh - 6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(W2 + 4, -lh - 72, 9, 5, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9a5a20';
      [[-14, -40], [-2, -34], [8, -42], [W2 - 8, -lh - 30], [W2 - 4, -lh - 50]].forEach(function (s) { ctx.beginPath(); ctx.arc(s[0], s[1], 3, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#16161c'; ctx.fillRect(W2 + 6, -lh - 74, 2, 2);
    } else if (id === 'lion') {
      const lh = 14;
      legs('#d8a050', 8, lh);
      ctx.fillStyle = '#d8a050';
      ctx.beginPath(); ctx.ellipse(-4, -lh - 10, W2 - 8, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9a5a20';
      ctx.beginPath(); ctx.arc(W2 - 6, -lh - 16, 14, 0, Math.PI * 2); ctx.fill();         // 鬃毛
      ctx.fillStyle = '#d8a050';
      ctx.beginPath(); ctx.arc(W2 - 2, -lh - 15, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d8a050'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-W2 + 6, -lh - 12); ctx.quadraticCurveTo(-W2 - 6, -lh - 20, -W2 - 2, -lh - 28); ctx.stroke();
      ctx.fillStyle = '#16161c'; ctx.fillRect(W2 + 1, -lh - 18, 2, 2);
    } else if (id === 'elephant') {
      const lh = 26;
      ctx.fillStyle = '#8a8a90';
      [[-W2 + 10, leg], [-W2 + 26, -leg], [W2 - 30, leg], [W2 - 16, -leg]].forEach(function (l) { ctx.fillRect(l[0] + l[1] * 0.3, -lh, 12, lh); });
      ctx.beginPath(); ctx.ellipse(-4, -lh - 18, W2 - 4, 24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(W2 - 8, -lh - 26, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a7a80';
      ctx.beginPath(); ctx.ellipse(W2 - 18, -lh - 26, 10, 16, 0.2, 0, Math.PI * 2); ctx.fill();  // 耳朵
      ctx.strokeStyle = '#8a8a90'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(W2 + 6, -lh - 20); ctx.quadraticCurveTo(W2 + 16, -lh, W2 + 10, -4); ctx.stroke();   // 鼻子
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#f4efe2'; ctx.fillRect(W2 + 2, -lh - 14, 8, 3);
      ctx.fillStyle = '#16161c'; ctx.fillRect(W2 - 2, -lh - 32, 3, 3);
    }
    ctx.restore();
  }

  /** 海戰裡的敵艦（船型見 STYLE）：x0 = 船身左緣、G = 水線 */
  function drawBigShip(ctx, mini, x0, G, t, lv) {
    const style = mini.w.style;
    const sailCol = mini.flash > 0 ? '#ffd8b0' : '#f2ebd8';
    const flashSide = mini.volCd > Math.max(80, 132 - mini.w.tier * 9) - 8;
    const decks = style === 'liner3' ? 3 : style === 'liner2' ? 2 : style === 'galleon' || style === 'cog' ? 1 : 0;
    const low = style === 'trireme' || style === 'galley';
    const hullTop = low ? G - 50 : G - 70 - decks * 26;            // 船身頂（越多層砲甲板越高）
    const hullCol = style === 'galley' ? '#8a2a20' : style === 'liner3' ? '#1e1e22' : style === 'trireme' ? '#3a2a1a' : '#4a2c1a';
    const trim = style === 'liner2' && mini.w.id === 'NL' ? '#e07a20' : style === 'liner2' ? '#2a4aa0' : '#e8c060';
    function mast(mx, top, rows, w0) {
      ctx.fillStyle = '#5a3a24'; ctx.fillRect(x0 + mx - 3, top, 6, hullTop + 4 - top);
      ctx.fillStyle = sailCol;
      for (let s = 0; s < rows; s++) {
        const sy = top + 18 + s * 58, sw = w0 - s * 6;
        ctx.beginPath(); ctx.moveTo(x0 + mx - sw / 2, sy); ctx.lineTo(x0 + mx + sw / 2, sy);
        ctx.quadraticCurveTo(x0 + mx + sw / 2 + 6, sy + 24, x0 + mx + sw / 2 - 4, sy + 46); ctx.lineTo(x0 + mx - sw / 2 + 4, sy + 46);
        ctx.quadraticCurveTo(x0 + mx - sw / 2 - 6, sy + 24, x0 + mx - sw / 2, sy); ctx.fill();
      }
    }
    let flagAt = null;
    if (style === 'trireme') {
      mast(170, G - 230, 1, 120);
      ctx.fillStyle = '#c0281e'; ctx.fillRect(x0 + 120, G - 190, 100, 8);        // 帆上的紅條
      flagAt = [173, G - 236];
    } else if (style === 'galley') {
      // 兩面三角帆
      [[110, G - 250, 120], [240, G - 210, 90]].forEach(function (m) {
        ctx.fillStyle = '#5a3a24'; ctx.fillRect(x0 + m[0] - 3, m[1], 6, hullTop - m[1]);
        ctx.fillStyle = sailCol;
        ctx.beginPath(); ctx.moveTo(x0 + m[0], m[1]); ctx.lineTo(x0 + m[0] + m[2] * 0.4, hullTop - 14); ctx.lineTo(x0 + m[0] - m[2] * 0.6, hullTop - 14); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c8a040'; ctx.fillRect(x0 + m[0] - m[2] * 0.3, hullTop - 50, m[2] * 0.5, 4);
      });
      flagAt = [113, G - 256];
    } else if (style === 'cog') {
      mast(180, G - 300, 2, 150);
      ctx.fillStyle = '#c0281e'; ctx.fillRect(x0 + 168, G - 280, 24, 90);
      flagAt = [183, G - 306];
    } else {
      const tall = style === 'liner3' ? 40 : style === 'liner2' ? 20 : 0;
      [[90, 10], [190, -20], [280, 10]].forEach(function (m, i) {
        mast(m[0], G - 290 - tall + m[1], 3 + (tall > 30 ? 1 : 0), 70 + tall * 0.4);
        if (i === 1) flagAt = [m[0] + 3, G - 290 - tall + m[1] - 6];
      });
    }
    // 船身
    ctx.fillStyle = hullCol;
    ctx.beginPath();
    ctx.moveTo(x0 - 10, hullTop); ctx.lineTo(x0 + 350, hullTop - (low ? 6 : 16)); ctx.lineTo(x0 + 330, G + 10); ctx.lineTo(x0 + 20, G + 10); ctx.closePath(); ctx.fill();
    if (style === 'cog') {
      // 船頭船尾的木城樓
      ctx.fillRect(x0 - 10, hullTop - 50, 80, 52); ctx.fillRect(x0 + 280, hullTop - 40, 70, 42);
      ctx.fillStyle = '#6a4228';
      for (let k = 0; k < 5; k++) { ctx.fillRect(x0 - 6 + k * 16, hullTop - 60, 10, 10); ctx.fillRect(x0 + 284 + k * 13, hullTop - 50, 8, 10); }
    }
    if (low) {
      // 槳：一排排划動
      ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = 3;
      const rows = style === 'trireme' ? 3 : 1;
      for (let r = 0; r < rows; r++) {
        for (let k = 0; k < 12; k++) {
          const ox = x0 + 20 + k * 26 + r * 6, oy = G - 30 + r * 8, sw = Math.sin(t * 0.15 + r) * 10;
          ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox - 10 + sw, G + 26); ctx.stroke();
        }
      }
      ctx.fillStyle = trim; ctx.fillRect(x0, hullTop + 4, 340, 4);
      if (style === 'trireme') {
        ctx.fillStyle = '#c8903a';
        ctx.beginPath(); ctx.moveTo(x0 - 10, G - 10); ctx.lineTo(x0 - 44, G - 2); ctx.lineTo(x0 - 10, G + 6); ctx.closePath(); ctx.fill();   // 青銅撞角
        ctx.fillStyle = '#f4efe2'; ctx.beginPath(); ctx.ellipse(x0 + 14, hullTop + 20, 9, 5, 0, 0, Math.PI * 2); ctx.fill();   // 船頭的眼睛
        ctx.fillStyle = '#1a1424'; ctx.beginPath(); ctx.arc(x0 + 12, hullTop + 20, 3, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      // 砲甲板：一層一排砲門（齊射時閃火光）；三層的勝利號是黑黃相間的條紋
      for (let d = 0; d < decks; d++) {
        const y = hullTop + 14 + d * 26;
        if (style === 'liner3') { ctx.fillStyle = '#e8c040'; ctx.fillRect(x0 + 2, y - 2, 336, 16); }
        else { ctx.fillStyle = trim; ctx.fillRect(x0 + 2, y - 6, 336, 3); }
        for (let k = 0; k < 7; k++) {
          const gx = x0 + 18 + k * 44;
          ctx.fillStyle = '#1a1008'; ctx.fillRect(gx, y, 16, 12);
          if (flashSide && (d + k) % 2 === 0) { ctx.fillStyle = 'rgba(255, 190, 90, 0.9)'; ctx.beginPath(); ctx.arc(gx, y + 6, 9, 0, Math.PI * 2); ctx.fill(); }
        }
      }
      ctx.fillStyle = trim; ctx.fillRect(x0, hullTop + 2, 340, 4);
    }
    if (flagAt && lv) Sprites.flagFace(ctx, x0 + flagAt[0], flagAt[1], 48, 32, lv.flag, lv.flagDir);
    // 被打中的破洞
    const holes = Math.min(14, Math.floor((mini.hpMax - mini.hp) / 12));
    ctx.fillStyle = '#120c06';
    for (let i = 0; i < holes; i++) {
      ctx.beginPath(); ctx.arc(x0 + 40 + (i * 53) % 280, G - 14 - (i % 3) * ((G - hullTop) / 4), 7, 0, Math.PI * 2); ctx.fill();
    }
    // 星等
    U.text(ctx, '★★★'.slice(0, mini.w.rank), x0 + 170, G + 50, { size: 18, color: '#ffd166' });
  }

  function drawWarship(ctx, state, mini, t) {
    const G = GY();
    const W = 960;
    // 海
    ctx.fillStyle = '#2f6f9a';
    ctx.fillRect(DECK_W, G - 6, W - DECK_W, 86);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 6; i++) ctx.fillRect(DECK_W + ((i * 83 + t) % (W - DECK_W)), G + 6 + (i % 3) * 14, 26, 2);
    // 敵艦
    const sh = mini.shake > 0 ? Math.sin(t * 2) * 4 : 0;
    const sink = mini.done && mini.hp <= 0 ? Math.min(60, (mini.sinkT = (mini.sinkT || 0) + 1)) : 0;
    const x0 = ENEMY_X + sh, bob = Math.sin(t * 0.05) * 3 + sink;
    const lv = Levels.list.filter(function (l) { return l.id === mini.w.id; })[0];
    ctx.save();
    ctx.translate(0, bob);
    drawBigShip(ctx, mini, x0, G, t, lv);
    ctx.restore();
    // 我方的砲
    mini.guns.forEach(function (g) {
      const kick = g.kick > 0 ? -g.kick * 0.6 : 0;
      ctx.save();
      ctx.translate(g.x + kick, G - 22);
      ctx.rotate(-0.55);
      ctx.fillStyle = g.jam ? '#4a3a3a' : '#2a2a30'; ctx.fillRect(0, -7, 40, 14);
      ctx.fillStyle = '#4a4a54'; ctx.fillRect(34, -9, 8, 18);
      ctx.restore();
      ctx.fillStyle = '#6a4a30';
      ctx.beginPath(); ctx.arc(g.x - 4 + kick, G - 10, 10, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(g.x + 14 + kick, G - 10, 10, 0, Math.PI * 2); ctx.fill();
      // 狀態
      const lx = g.x + 6, ly = G - 64;
      if (g.jam) {
        ctx.fillStyle = 'rgba(120, 120, 120, 0.55)';
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(lx + Math.sin(t * 0.1 + k) * 6, ly + 10 - ((t * 0.6 + k * 12) % 30), 7, 0, Math.PI * 2); ctx.fill(); }
        U.text(ctx, '修理中', lx, ly - 14, { size: 11, color: '#ffb0a0' });
      } else if (g.blocked) {
        U.text(ctx, '水兵！', lx, ly - 4, { size: 12, color: '#ffd0a0' });
      } else if (g.cd > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(lx, ly, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#ffd166';
        ctx.beginPath(); ctx.arc(lx, ly, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - g.cd / mini.reload)); ctx.stroke();
      } else {
        ctx.fillStyle = '#8fe3a0';
        ctx.beginPath(); ctx.arc(lx, ly, 6 + Math.sin(t * 0.2), 0, Math.PI * 2); ctx.fill();
      }
    });
    mini.balls.forEach(function (b) {
      ctx.fillStyle = '#1a1a20'; ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, Math.PI * 2); ctx.fill();
    });
    mini.shells.forEach(function (s) {
      if (s.fuse > 0) {
        const k = s.fuse / s.max;
        ctx.strokeStyle = 'rgba(255, 80, 70, ' + (0.9 - k * 0.5).toFixed(2) + ')'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(s.x, G - 2, 12 + k * 24, 4 + k * 6, 0, 0, Math.PI * 2); ctx.stroke();
        if (s.fuse < 30) {
          ctx.fillStyle = '#2a2a30';
          ctx.beginPath(); ctx.arc(s.x + s.fuse * 9, G - 8 - s.fuse * 8, 7, 0, Math.PI * 2); ctx.fill();
        }
      } else if (s.boom > 0) {
        ctx.fillStyle = 'rgba(255, 170, 70, ' + (s.boom / 16).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(s.x, G - 12, 40 - s.boom, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  function drawWorld(ctx, state, t) {
    const mini = state.mini;
    if (!mini) return;
    if (mini.kind === 'warship') { drawWarship(ctx, state, mini, t); return; }
    if (mini.kind === 'herd') {
      const G = GY();
      // 莽原遠景：金合歡樹
      ctx.fillStyle = 'rgba(110, 90, 40, 0.5)';
      [120, 430, 760].forEach(function (x) {
        ctx.fillRect(x - 3, G - 90, 6, 90);
        ctx.beginPath(); ctx.ellipse(x, G - 92, 50, 12, 0, 0, Math.PI * 2); ctx.fill();
      });
      // 塵土
      ctx.fillStyle = 'rgba(210, 180, 120, 0.35)';
      for (let i = 0; i < 8; i++) {
        ctx.beginPath(); ctx.arc(((i * 137 - t * 2.5) % 1100 + 1100) % 1100 - 70, G - 6 - (i % 3) * 6, 16 + (i % 3) * 6, 0, Math.PI * 2); ctx.fill();
      }
      mini.animals.forEach(function (a) { drawAnimal(ctx, a.id, a.x, G, -1, t + a.x, true); });
    }
  }

  function hud(mini) {
    const sec = Math.max(0, Math.ceil(mini.time / 60));
    if (mini.kind === 'warship') return '敵艦船身 ' + mini.hp + ' / ' + mini.hpMax + '　剩 ' + sec + ' 秒（砲旁按 K 開砲・紅圈是落點）';
    return '抓到 ' + mini.caught.length + ' 隻（至少 3 隻）　剩 ' + sec + ' 秒';
  }

  // ── 冥界、金字塔的豎井美術（掛到 Sprites.shaftThemes）─────────────

  /** 洛基：綠色長袍、金色長角頭盔，站在冥界最底層壞笑揮手（x = 腳底中心） */
  function lokiFigure(ctx, x, baseY, t) {
    ctx.save();
    ctx.translate(x, baseY);
    const g = ctx.createRadialGradient(0, -50, 6, 0, -50, 60);
    g.addColorStop(0, 'rgba(120, 255, 170, 0.3)'); g.addColorStop(1, 'rgba(120, 255, 170, 0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -50, 60, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a6a3a';
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-12, -50); ctx.lineTo(12, -50); ctx.lineTo(16, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8c040'; ctx.fillRect(-12, -30, 24, 3);
    ctx.save(); ctx.translate(11, -46); ctx.rotate(-2 + Math.sin(t * 0.15) * 0.5);
    ctx.fillStyle = '#2a6a3a'; U.roundRect(ctx, 0, -3, 20, 7, 3); ctx.fill();
    ctx.fillStyle = '#e8d0b8'; ctx.beginPath(); ctx.arc(22, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#e8d0b8'; ctx.beginPath(); ctx.arc(0, -60, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(0, -64, 10, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#e8c040';
    [-1, 1].forEach(function (s) { ctx.beginPath(); ctx.moveTo(s * 4, -70); ctx.quadraticCurveTo(s * 12, -82, s * 8, -92); ctx.lineTo(s * 9, -72); ctx.fill(); });
    ctx.fillStyle = '#2a8a4a'; ctx.fillRect(-5, -62, 3, 2); ctx.fillRect(3, -62, 3, 2);
    ctx.strokeStyle = '#6a2a2a'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-4, -55); ctx.quadraticCurveTo(1, -52, 5, -57); ctx.stroke();
    ctx.restore();
  }

  const helTheme = {
    backdrop: function (ctx, camY, t, W, H) {
      ctx.save();
      // 世界樹的根（視差）
      const par = camY * 0.25;
      ctx.strokeStyle = 'rgba(40, 60, 64, 0.8)'; ctx.lineWidth = 10; ctx.lineCap = 'round';
      for (let row = Math.floor(par / 300) - 1; row < Math.floor(par / 300) + 3; row++) {
        const y0 = row * 300 - par;
        for (let k = 0; k < 3; k++) {
          const x = ((row * 211 + k * 330) % 1000) - 20;
          ctx.beginPath(); ctx.moveTo(x, y0); ctx.bezierCurveTo(x + 60, y0 + 90, x - 40, y0 + 180, x + 30, y0 + 300); ctx.stroke();
        }
      }
      ctx.lineCap = 'butt';
      // 鬼火：往上飄的藍綠光點
      for (let k = 0; k < 16; k++) {
        const x = (k * 67) % W + Math.sin(t * 0.03 + k) * 10;
        const y = H - ((t * (0.4 + (k % 3) * 0.15) + k * 83 + camY * 0.4) % (H + 40));
        const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
        g.addColorStop(0, 'rgba(150, 255, 220, 0.6)'); g.addColorStop(1, 'rgba(150, 255, 220, 0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    },
    wall: function (ctx, wall, camY, viewH) {
      ctx.fillStyle = '#1c2a30';
      ctx.fillRect(wall.x, camY - 20, wall.w, viewH + 40);
      ctx.fillStyle = 'rgba(200, 240, 255, 0.06)';
      const bh = 34, start = Math.floor((camY - 20) / bh);
      for (let i = 0; i < viewH / bh + 3; i++) {
        const by = (start + i) * bh, st = ((start + i) % 2) * 20;
        for (let bx = wall.x + st; bx < wall.x + wall.w; bx += 40) ctx.fillRect(bx + 2, by + 2, 36, bh - 4);
      }
      // 結霜的內緣
      const inner = wall.x < 480 ? wall.x + wall.w - 4 : wall.x;
      ctx.fillStyle = 'rgba(220, 245, 255, 0.4)';
      ctx.fillRect(inner, camY - 20, 4, viewH + 40);
    },
    ceiling: function (ctx, screenTop, h, w, t) {
      ctx.save();
      ctx.fillStyle = '#9cc8dc';
      ctx.fillRect(0, screenTop, w, h - 10);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (let x = 0; x < w; x += 40) ctx.fillRect(x + 4, screenTop + 4, 30, 3);
      ctx.fillStyle = '#d8f0fa';
      for (let i = 0; i < w / 20; i++) {
        const sx = i * 20, len = 14 + (i % 3) * 4;
        ctx.beginPath(); ctx.moveTo(sx, screenTop + h - 10); ctx.lineTo(sx + 10, screenTop + h - 10 + len); ctx.lineTo(sx + 20, screenTop + h - 10); ctx.fill();
      }
      ctx.restore();
    },
    floor: function (ctx, f, x, y, w, h, t) {
      if (f.goal) {
        ctx.fillStyle = '#2a4a44'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#8af0c8'; ctx.fillRect(x, y, w, 3);
        // 洛基被關在籠子裡；救出來之後只剩打開的空籠子
        const free = typeof Save !== 'undefined' && Save.flag('loki');
        const cx = x + w - 70;
        if (!free) lokiFigure(ctx, cx, y, t);
        ctx.strokeStyle = '#9aa8b0'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(cx, y - 104, 34, 8, 0, Math.PI, 0); ctx.stroke();
        for (let k = 0; k < 6; k++) {
          const bx = cx - 30 + k * 12;
          if (free && k > 1 && k < 4) continue;                // 打開的門
          ctx.beginPath(); ctx.moveTo(bx, y - 104); ctx.lineTo(bx, y); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(cx - 34, y - 2); ctx.lineTo(cx + 34, y - 2); ctx.stroke();
        if (!free) {
          // 鎖頭：刻著眼睛和帶圈的十字
          ctx.fillStyle = '#c8a040'; U.roundRect(ctx, cx - 8, y - 56, 16, 14, 3); ctx.fill();
          ctx.strokeStyle = '#c8a040'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx, y - 56, 5, Math.PI, 0); ctx.stroke();
          ctx.fillStyle = '#4a3010'; ctx.fillRect(cx - 1, y - 52, 2, 6);
        }
        return true;
      }
      if (f.type && f.type !== 'normal') return false;
      ctx.fillStyle = '#4a5c60';
      U.roundRect(ctx, x, y, w, h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(220, 245, 255, 0.5)'; ctx.fillRect(x + 2, y, w - 4, 3);
      return true;
    }
  };

  const pyramidTheme = {
    backdrop: function (ctx, camY, t, W, H) {
      ctx.save();
      const par = camY * 0.3;
      // 遠處牆上的象形文字（一欄一欄）
      ctx.fillStyle = 'rgba(120, 80, 40, 0.35)';
      for (let row = Math.floor(par / 220) - 1; row < Math.floor(par / 220) + 3; row++) {
        const y0 = row * 220 - par;
        for (let c = 0; c < 6; c++) {
          const x = 70 + c * 150 + (row % 2) * 40;
          for (let k = 0; k < 5; k++) {
            const gy = y0 + 20 + k * 38, s = (row * 7 + c * 3 + k) % 4;
            if (s === 0) { ctx.beginPath(); ctx.ellipse(x, gy, 9, 5, 0, 0, Math.PI * 2); ctx.fill(); }        // 眼
            else if (s === 1) { ctx.fillRect(x - 6, gy - 8, 4, 16); ctx.fillRect(x - 2, gy - 8, 10, 4); }    // 鳥
            else if (s === 2) { ctx.beginPath(); ctx.arc(x, gy - 6, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x - 1.5, gy - 2, 3, 12); ctx.fillRect(x - 6, gy, 12, 3); }   // 安卡
            else { ctx.fillRect(x - 8, gy - 2, 16, 4); }
          }
        }
      }
      // 火把
      for (let k = 0; k < 2; k++) {
        const x = k ? W - 60 : 60;
        for (let row = Math.floor(par / 260); row < Math.floor(par / 260) + 3; row++) {
          const y = row * 260 - par + 80;
          ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 2, y, 4, 22);
          const fl = Math.sin(t * 0.3 + row) * 2;
          const g = ctx.createRadialGradient(x, y - 4, 0, x, y - 4, 40);
          g.addColorStop(0, 'rgba(255, 200, 100, 0.35)'); g.addColorStop(1, 'rgba(255, 200, 100, 0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 4, 40, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ffb040'; ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.quadraticCurveTo(x + fl, y - 18, x + 5, y); ctx.fill();
        }
      }
      ctx.restore();
    },
    wall: function (ctx, wall, camY, viewH) {
      ctx.fillStyle = '#a07a48';
      ctx.fillRect(wall.x, camY - 20, wall.w, viewH + 40);
      ctx.strokeStyle = 'rgba(70, 46, 20, 0.45)'; ctx.lineWidth = 1.5;
      const bh = 28, start = Math.floor((camY - 20) / bh);
      for (let i = 0; i < viewH / bh + 3; i++) {
        const by = (start + i) * bh, st = ((start + i) % 2) * 24;
        ctx.beginPath(); ctx.moveTo(wall.x, by); ctx.lineTo(wall.x + wall.w, by); ctx.stroke();
        for (let bx = wall.x + st; bx < wall.x + wall.w; bx += 48) { ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by + bh); ctx.stroke(); }
      }
    },
    ceiling: function (ctx, screenTop, h, w, t) {
      ctx.save();
      ctx.fillStyle = '#7a5a34';
      ctx.fillRect(0, screenTop, w, h - 10);
      ctx.strokeStyle = 'rgba(40, 26, 10, 0.5)'; ctx.lineWidth = 2;
      for (let x = 0; x < w; x += 64) { ctx.beginPath(); ctx.moveTo(x, screenTop); ctx.lineTo(x, screenTop + h - 10); ctx.stroke(); }
      ctx.fillStyle = '#c8963e';
      for (let i = 0; i < w / 22; i++) {
        const sx = i * 22;
        ctx.beginPath(); ctx.moveTo(sx + 3, screenTop + h - 10); ctx.lineTo(sx + 11, screenTop + h + 4 + (i % 2) * 3); ctx.lineTo(sx + 19, screenTop + h - 10); ctx.fill();
      }
      ctx.restore();
    },
    floor: function (ctx, f, x, y, w, h, t) {
      if (f.goal) {
        // 法老的墓室：石棺＋金色寶藏＋發光的黃金面具
        ctx.fillStyle = '#8a6a34'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#f0cc60'; ctx.fillRect(x, y, w, 4);
        const sx = x + w - 120;
        ctx.fillStyle = '#c8a060'; U.roundRect(ctx, sx, y - 40, 90, 40, 8); ctx.fill();
        ctx.fillStyle = '#2a50a0'; ctx.fillRect(sx + 10, y - 34, 70, 4);
        const g = 0.4 + Math.sin(t * 0.1) * 0.2;
        ctx.fillStyle = 'rgba(255, 220, 120, ' + g.toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(sx + 45, y - 60, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8b830';
        ctx.beginPath(); ctx.moveTo(sx + 31, y - 72); ctx.quadraticCurveTo(sx + 45, y - 86, sx + 59, y - 72); ctx.lineTo(sx + 62, y - 46); ctx.lineTo(sx + 28, y - 46); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a50a0'; ctx.fillRect(sx + 30, y - 66, 4, 18); ctx.fillRect(sx + 56, y - 66, 4, 18);
        ctx.fillStyle = '#1a1424'; ctx.fillRect(sx + 38, y - 66, 4, 2); ctx.fillRect(sx + 48, y - 66, 4, 2);
        ctx.fillStyle = '#f2c94c';
        for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(x + 30 + k * 14, y - 5 - (k % 2) * 4, 5, 0, Math.PI * 2); ctx.fill(); }
        return true;
      }
      if (f.type && f.type !== 'normal') return false;
      ctx.fillStyle = '#c8a060';
      U.roundRect(ctx, x, y, w, h, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255, 240, 200, 0.4)'; ctx.fillRect(x + 2, y, w - 4, 3);
      ctx.fillStyle = 'rgba(90, 60, 30, 0.3)';
      ctx.fillRect(x + w * 0.33, y + 4, 2, h - 4); ctx.fillRect(x + w * 0.66, y + 4, 2, h - 4);
      return true;
    }
  };
  /** 戰艦盪過來的水兵：紅外套、三角帽、手上一把彎刀（行為跟一般走路小怪一樣，踩得扁） */
  if (typeof Sprites !== 'undefined' && Sprites.countryEnemies) {
    Sprites.countryEnemies.WAR = {
      walker: function (ctx, e, t) {
        const cx = e.x + e.w / 2, by = e.y + e.h;
        ctx.save();
        if (e.squash > 0) { ctx.translate(cx, by); ctx.scale(1.3, 0.35); ctx.translate(-cx, -by); }
        const s = Math.sin(t * 0.35) * 2;
        ctx.fillStyle = '#2a2a33';
        ctx.fillRect(cx - 6 + s, by - 7, 4, 7); ctx.fillRect(cx + 2 - s, by - 7, 4, 7);
        ctx.fillStyle = '#b8282a'; U.roundRect(ctx, cx - 8, by - 22, 16, 15, 3); ctx.fill();
        ctx.fillStyle = '#f4efe2'; ctx.fillRect(cx - 1, by - 22, 2, 15);
        ctx.fillStyle = '#f0c49a'; ctx.beginPath(); ctx.arc(cx, by - 26, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a1a20';
        ctx.beginPath(); ctx.moveTo(cx - 8, by - 28); ctx.lineTo(cx, by - 35); ctx.lineTo(cx + 8, by - 28); ctx.closePath(); ctx.fill();
        ctx.fillRect(cx + e.dir * 2 - 1, by - 27, 2, 2);
        ctx.strokeStyle = '#c8d0dc'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx + e.dir * 8, by - 16); ctx.quadraticCurveTo(cx + e.dir * 16, by - 22, cx + e.dir * 14, by - 30); ctx.stroke();
        ctx.restore();
      }
    };
  }
  if (typeof Sprites !== 'undefined' && Sprites.shaftThemes) {
    Sprites.shaftThemes.hel = helTheme;
    Sprites.shaftThemes.pyramid = pyramidTheme;
  }

  /** 給 game.js：開始冥界／金字塔（船停在 at 的位置；冥界要回到卡律布狄斯旁邊） */
  function questMonster(kind, at) {
    return { kind: kind, def: K[kind], x: at.x, y: at.y, quest: true };
  }

  return {
    WARSHIPS: WARSHIPS,
    has: has,
    ensure: ensure,
    mapNear: mapNear,
    drawMapMonster: drawMapMonster,
    prompt: prompt,
    makeDef: makeDef,
    initMini: initMini,
    update: update,
    drawWorld: drawWorld,
    hud: hud,
    onClear: onClear,
    drawAnimal: drawAnimal,
    questMonster: questMonster,
    SPEC: SPEC
  };
})();
