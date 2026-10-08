'use strict';

/** 物理常數。斷崖寬度上限（Levels.MAX_GAP）就是依這組算出來的 */
const PHYS = {
  GRAVITY: 0.62,
  MAX_FALL: 14,
  ACCEL: 0.62,
  FRICTION: 0.78,
  MAX_RUN: 4.6,
  JUMP_V: -12.6,
  DOUBLE_JUMP_V: -10.8,
  JUMP_CUT: 0.42,
  COYOTE: 6,
  JUMP_BUFFER: 8,
  STOMP_BOUNCE: -7.6,
  WALL_SLIDE: 2.2,      // 貼牆滑降的最大下墜速度
  GLIDE_FALL: 2.6,      // 滑翔時的最大下墜速度
  WALL_JUMP_X: 5.6,
  WALL_JUMP_Y: -11.4,
  STOMP_BOUNCE_HIGH: -10.2,  // 指揮棒：踩敵人彈得更高
  /*
   * v1.30 丹麥積木塔（def.chargeJump）：按住跳躍鍵蓄力、放開才跳。
   * 蓄滿 CHARGE_MAX 帧 → 初速 ×CHARGE_HI（約 216px 高）；剛按就放 → ×CHARGE_LO（約 39px）。
   */
  CHARGE_MAX: 40,
  CHARGE_LO: 0.55,
  CHARGE_HI: 1.3
};
/** 蓄力 charge 帧放開時的起跳倍率 */
function chargeMul(charge) {
  const k = Math.min(1, charge / PHYS.CHARGE_MAX);
  return PHYS.CHARGE_LO + (PHYS.CHARGE_HI - PHYS.CHARGE_LO) * k;
}

// 潛水時划一下的往上初速（重力只剩 28%，所以一下就能游很高）
const SWIM_V = -4.4;

function makePlayer(x, y, stats) {
  return {
    x: x, y: y, w: 22, h: 40,
    vx: 0, vy: 0,
    facing: 1,
    onGround: false,
    coyote: 0,
    jumpBuffer: 0,
    airJumps: 0,          // 剩餘空中跳次數
    wallDir: 0,           // 貼著哪一邊的牆（-1 左 / 1 右 / 0 無）
    wallSliding: false,
    invuln: 0,
    gliding: false,
    launched: false,      // 被外力彈起（彈簧平台）—— 不套用可變跳躍截斷
    ridingMover: null,    // 正站在哪座移動平台上（要跟著它位移）
    stats: stats,
    equipped: {}
  };
}

/**
 * 敵人型別表。
 *
 * stompable  能不能踩死（false = 踩上去反而受傷，要用遠程攻擊；有斯洛伐克斧杖就踩得死）
 * hp         需要幾次攻擊
 * air        是不是空中單位（y 由 baseY + 擺動決定）
 */
const ENEMY_KINDS = {
  // 鴿子：基本型，地面來回走
  walker:  { w: 30, h: 26, speed: 1.0, stompable: true,  hp: 1, air: false },
  // 海鷗：空中來回飛
  flyer:   { w: 36, h: 24, speed: 1.5, stompable: true,  hp: 1, air: true },
  // 衛兵：戴鋼盔，踩不死（會彈開），要用丟的
  guard:   { w: 32, h: 34, speed: 0.85, stompable: false, hp: 1, air: false },
  // 刺蝟：背上有刺，踩不死，走得快
  spiker:  { w: 30, h: 24, speed: 1.6, stompable: false, hp: 1, air: false },
  // 蜜蜂：空中追著玩家跑（有限範圍內）
  chaser:  { w: 26, h: 22, speed: 1.9, stompable: true,  hp: 1, air: true },
  // 砲台：不動，定時往玩家方向吐彈
  turret:  { w: 30, h: 30, speed: 0,   stompable: true,  hp: 1, air: false },
  // 公牛：看到玩家會加速衝撞，撞牆後暈眩
  charger: { w: 44, h: 32, speed: 1.1, stompable: true,  hp: 1, air: false }
};

function makeEnemy(def) {
  const k = ENEMY_KINDS[def.type] || ENEMY_KINDS.walker;
  const baseY = def.y == null ? (k.air ? 180 : Levels.GROUND_Y - k.h) : def.y;
  return {
    type: def.type,
    kind: k,
    x: def.x,
    y: baseY,
    w: k.w,
    h: k.h,
    left: def.left,
    right: def.right,
    baseY: baseY,
    dir: def.dir || -1,
    speed: def.speed || k.speed,
    phase: (def.x % 100) / 100 * Math.PI * 2,
    hp: k.hp,
    alive: true,
    squash: 0,
    // 型別專用狀態
    // 砲台射擊冷卻。def.cd 可指定第一發要等多久（開場附近的砲台要給玩家時間）
    cd: def.cd != null ? def.cd : 30 + (def.x % 40),
    every: def.every || null,  // 砲台開火間隔（沒給 = 110 帧）
    charging: false,         // 公牛衝撞中
    stun: 0,                 // 公牛撞牆暈眩
    bump: 0                  // 盾兵被踩彈開的視覺回饋
  };
}

/** 砲台的彈射物 */
function makeShot(x, y, vx, vy) {
  return { x: x, y: y, w: 12, h: 12, vx: vx, vy: vy, life: 240, dead: false };
}

/**
 * 魔王落地震波。
 *
 * 跟砲台彈分開是因為它要「貼著地面掃過去」，而且必須可以靠跳躍躲開。
 * 高度刻意只有 10px 並貼在地面線上：
 *   玩家站著 → 身體底部剛好在地面線，會被掃到（所以不能站著不動）
 *   玩家起跳 → 第 2 帧腳底就離地 23px，輕鬆閃過
 * 速度也放慢到 2.6，讓玩家看得到它過來。
 */
function makeWave(x, dir, speed) {
  return {
    x: x, y: Levels.GROUND_Y - 10, w: 16, h: 10,
    vx: dir * (speed || 2.6), vy: 0,
    life: 200, wave: true
  };
}

/**
 * 人面獅身的沙柱（v1.29.1）：先在地上冒流沙漩渦（warn 帧，不會痛），時間到從地底噴出一根沙柱。
 * fixed = 不移動、不做地形碰撞（柱子本來就插在地裡）。
 */
/*
 * 冰島火巨人的火焰劍光（v1.30）：從劍尖往前飛、貼著一個高度掃過整個競技場。
 *   low  貼地（離地 0~28）：要跳過去
 *   high 齊胸以上（離地 62~150）：站在地上就不會被打到，跳起來反而會撞上；兩側平台上也會被掃到
 * 玩家站著頭頂離地 40，跳最高約 128 —— 兩種劍光不能用同一招躲。
 */
const SLASH_SPEED = 4.2;
const SLASH_WINDUP = 34;      // 每一劍舉劍蓄力多久（看得出高低）
const SLASH_GAP = 56;         // 兩劍之間隔多久（含蓄力）：劍光間距約 235px，跳過一道落地前下一道還沒到
function makeSlash(x, dir, high) {
  const G = Levels.GROUND_Y;
  return high
    ? { x: x, y: G - 150, w: 30, h: 88, vx: dir * SLASH_SPEED, vy: 0, life: 300, slash: 'high', fixed: true }
    : { x: x, y: G - 28, w: 30, h: 28, vx: dir * SLASH_SPEED, vy: 0, life: 300, slash: 'low', fixed: true };
}

const PILLAR_WARN = 48, PILLAR_UP = 34;
function makePillar(x) {
  return { x: x, y: Levels.GROUND_Y - 124, w: 44, h: 124, vx: 0, vy: 0,
           life: PILLAR_WARN + PILLAR_UP, warn: PILLAR_WARN, pillar: true, fixed: true };
}

/** 魔王。每關可給不同參數，但行為共用一套狀態機。 */
function makeBoss(def) {
  return {
    name: def.name,
    kind: def.kind,                  // 畫圖用：決定外觀
    // 行為模式。每隻魔王都不一樣：
    //   slam   跳躍落地 + 兩側貼地震波（跳起來閃）
    //   charge 橫向衝刺撞牆（往反方向繞或跳過）
    //   volley 站定扇形齊射（左右走位找空隙）
    //   summon 升空灑彈 + 放小兵（要取捨清兵或打本體）
    //   blink  瞬移到背後 + 會追人的蝙蝠
    //   dive   空中斜線俯衝 + 沿路火星、落地火海
    //   sphinx 腳底下噴沙柱（看地上的漩渦走位）
    //   surtr  火焰劍高掃／低掃（看劍舉高還壓低，決定跳或不跳）
    pattern: def.pattern || 'slam',
    shotsLeft: 0,
    shotCd: 0,
    hoverBase: null,
    x: def.x, y: def.y == null ? Levels.GROUND_Y - 86 : def.y,
    w: def.w || 76, h: def.h || 86,
    hpMax: def.hp || 5,
    hp: def.hp || 5,
    left: def.left, right: def.right,
    dir: -1,
    speed: def.speed || 1.3,
    // 狀態機：idle → telegraph（預告）→ act（攻擊）→ recover
    phase: 'idle',
    timer: 90,
    invuln: 0,
    hurtFlash: 0,
    vy: 0,
    onGround: true,
    jumpsLeft: 0,
    defeated: false,
    deathTimer: 0,
    graceTimer: 0,       // 起身後的寬容期，期間不造成接觸傷害

    /*
     * 難度參數（都有預設值，沒指定的魔王行為跟以前完全一樣）：
     *   jumps        slam 每輪連跳幾下（每下落地都放震波）
     *   rageAt       血量 <= 這個值進入狂暴（0 = 沒有狂暴）
     *   rageJumps    狂暴時的連跳數
     *   homing       空中每帧最多往玩家方向修正幾 px（0 = 直上直下）
     *   waveSpeed    震波速度
     *   recoverTime  破綻期長度（越短越難打）
     *   idleTime     兩輪攻擊之間走動多久
     *   debris       狂暴時每輪從天上掉幾塊碎片
     */
    jumps: def.jumps || 1,
    rageAt: def.rageAt || 0,
    rageJumps: def.rageJumps || def.jumps || 1,
    homing: def.homing || 0,
    waveSpeed: def.waveSpeed || 2.6,
    recoverTime: def.recoverTime || 170,
    idleTime: def.idleTime || 90,
    debris: def.debris || 0,
    landPause: 0
  };
}

/** 魔王是否進入狂暴（血量到一半以下，招式變多變快） */
function bossEnraged(b) {
  return b.rageAt > 0 && b.hp <= b.rageAt;
}

function makeMover(def) {
  return {
    x: def.x, y: def.y, w: def.w, h: def.h,
    ox: def.x, oy: def.y,
    axis: def.axis,
    range: def.range,
    speed: def.speed,
    phase: (def.x % 97) / 97 * Math.PI * 2,
    dx: 0, dy: 0
  };
}

/**
 * 建立一關的執行期狀態。
 * ownedEquip 是已擁有的裝備 id 陣列；alreadyHasLevelEquip 決定這關的裝備要不要出現。
 */
function buildLevelState(def, levelIndex, ownedEquip, stats, coop) {
  const st = stats || Equipment.resolve(ownedEquip);
  // 魔王關：玩家從競技場左側進場
  const spawnX = def.spawnX != null ? def.spawnX
    : (def.bossArena ? def.bossArena.x + 40 : 60);
  // 豎井關的出生點在第一層平台上，不是地面線
  const spawnY = def.spawnY != null ? def.spawnY : Levels.GROUND_Y - 40;
  const p = makePlayer(spawnX, spawnY, st);

  // 把「裝上的」裝備攤成布林表（畫人物身上的配件用）。
  // v1.22 分部位：擁有 ≠ 裝上 —— st.worn 是生效中的那幾件；舊呼叫端沒有 worn 就退回擁有清單
  const wornList = st.worn || ownedEquip || [];
  wornList.forEach(function (id) { p.equipped[id] = true; });

  const levelEquip = Equipment.forLevel(levelIndex);
  const equipTaken = !levelEquip || (ownedEquip || []).indexOf(levelEquip.id) >= 0;

  // 密道：每條有入口觸發區、內部空間、獎勵
  const secrets = (def.secrets || []).map(function (s, i) {
    return {
      idx: i,
      // 入口偵測區（玩家走進去就開）
      trigger: { x: s.trigger.x, y: s.trigger.y, w: s.trigger.w, h: s.trigger.h },
      // 密室本體（繪製用）
      room: s.room,
      hint: s.hint || '這面牆後面有風吹出來⋯⋯',
      found: false,
      // 隱形磚：從下面頂到才會現形，現形後密室入口才打開（沒有磚的舊資料 = 直接開放）
      block: s.block ? { x: s.block.x, y: s.block.y, w: s.block.w, h: s.block.h } : null,
      revealed: !s.block,
      bumpAnim: 0,
      // 密室裡的金幣
      coins: (s.coins || []).map(function (c) {
        return { x: c.x, y: c.y, w: 24, h: 24, taken: false };
      }),
      // 裝備藏在這條密道裡嗎
      holdsEquip: !!s.holdsEquip,
      // 岔路密道（v1.9）：頂磚後浮出彈跳墊 + 空中的另一條路
      kind: s.kind || 'room',
      pad: s.pad ? { x: s.pad.x, y: s.pad.y, w: s.pad.w, h: s.pad.h } : null,
      padV: s.padV,
      padSquash: 0,
      path: (s.path || []).map(function (pf) { return { x: pf.x, y: pf.y, w: pf.w, h: pf.h }; }),
      span: s.span || s.room
    };
  });

  // 裝備位置：若藏在密道裡，就用密道指定的座標
  let equipPos = def.equipAt;
  let equipSecretIdx = -1;
  (def.secrets || []).forEach(function (s, i) {
    if (s.holdsEquip && s.equipAt) { equipPos = s.equipAt; equipSecretIdx = i; }
  });

  /*
   * 兩人同機（coop）。
   *
   * 設計取捨：state.player 保留為「P1」，另外用 state.players 陣列
   * 存所有玩家。這樣：
   *   - 既有的幾十處 state.player 用法（相機、HUD、過關判定、測試）完全不用改
   *   - 想處理所有玩家的地方就走 state.players
   * 若反過來只留陣列，要改的呼叫點太多，很容易漏掉一個就出現
   * 「玩家 2 能動但不會被判定」這種半壞狀態。
   */
  const players = [p];
  if (coop) {
    const p2 = makePlayer(spawnX + 34, spawnY, st);
    wornList.forEach(function (id) { p2.equipped[id] = true; });
    p2.pid = 1;
    players.push(p2);
  }
  p.pid = 0;

  return {
    def: def,
    levelIndex: levelIndex,
    player: p,
    players: players,
    coop: !!coop,
    enemies: (def.enemies || []).map(makeEnemy),
    movers: (def.movers || []).map(makeMover),
    shots: [],
    boss: def.boss ? makeBoss(def.boss) : null,
    secrets: secrets,
    coins: (def.coins || []).map(function (c) {
      return { x: c.x, y: c.y, w: 24, h: 24, taken: false };
    }),
    // 這關的裝備。已經拿過就不再出現
    equip: (levelEquip && equipPos) ? {
      id: levelEquip.id,
      def: levelEquip,
      x: equipPos.x,
      y: equipPos.y,
      w: 30, h: 30,
      taken: equipTaken,
      // 要先找到對應密道才看得到（-1 表示不在密道裡）
      secretIdx: equipSecretIdx
    } : null,
    particles: [],
    // 豎井關的執行期狀態（非豎井關是 null）
    shaft: def.layout === 'shaft' ? makeShaftState(def) : null,
    // 橫向關卡的招牌機制（奔牛、彈跳墊⋯⋯見 features.js）
    features: def.features && def.features.length ? Features.makeState(def) : null,
    // 雙人試煉的壓板、閘門（見 duo.js；一般關卡是 null）
    duo: def.duo && typeof Duo !== 'undefined' ? Duo.makeState(def) : null,
    // 會講話的 NPC（見 npcs.js）
    npcs: typeof Npcs !== 'undefined' ? Npcs.makeState(def) : [],
    coinsTotal: (def.coins || []).length,
    coinsGot: 0,
    secretsFound: 0,
    cleared: false
  };
}

/**
 * 豎井關的執行期狀態。
 *
 * 樓層資料從 def.shaft 複製一份出來，因為每一層有「踩過沒」、
 * 「塌掉沒」這種單場狀態，不能寫回共用的 def。
 */
function makeShaftState(def) {
  const pl = def.shaft;
  return {
    // camY 由 game.js 的相機推進，這裡記一份給碰撞與判定用
    camY: 0,
    deepest: 0,            // 到過最深的層（算進度用）
    frame: 0,              // 本關經過的帧數（滑台、鐘擺、鐘聲都用它，確保測試可重現）
    chime: 0,              // 鐘聲的視覺餘韻（>0 時畫面上顯示「噹」）
    pendulums: (pl.pendulums || []).map(function (pd) {
      const pos = Shaft.pendulumPos(pd, 0);
      return { def: pd, x: pos.x, y: pos.y, a: pos.a };
    }),
    floors: pl.platforms.map(function (f) {
      const rect = { x: f.x, y: f.y, w: f.w, h: f.h, oneWay: true };
      // 滑台：有 dx 才會被 updatePlayer 當成「會載人的移動平台」
      if (f.type === 'slide') { rect.x = Shaft.slideX(f, 0); rect.dx = 0; rect.dy = 0; }
      return {
        floor: f.floor,
        type: f.type,
        goal: !!f.goal,
        src: f,            // 原始定義（滑台要用基準 x 與幅度）
        // oneWay 讓 climb 模式的樓層可以從下方穿過（見 updatePlayer）
        rect: rect,
        touched: false,    // 踩過了嗎（塌陷平台用）
        timer: 0,          // 塌陷倒數
        gone: false,       // 已經塌掉
        flash: 0           // 視覺回饋（踩到的瞬間）
      };
    }),
    walls: pl.walls.map(function (w) {
      return { x: w.x, y: w.y, w: w.w, h: w.h };
    })
  };
}

/**
 * 把玩家重新放到畫面內安全的樓層（豎井關專用）。
 *
 * 為什麼要獨立成函式：game.js 的 loseLife() 與測試機器人都需要這段。
 * 之前只寫在 game.js 裡，測試機器人沒有複製 → 兩邊行為不一致：
 * 測試中玩家被雪崩推著穿過單向平台、永遠落不到地上、也不能跳，
 * 於是一路riding到受傷上限，看起來像「關卡無法通過」，
 * 但真實遊戲其實會把他重生在平台上。驗錯東西的典型案例。
 *
 * 兩種模式的安全方向相反：
 *   descend 危險在上 → 挑畫面內最上面但離天花板夠遠的
 *   climb   危險在下 → 挑畫面內最下面但離雪崩夠遠的
 */
function respawnInShaft(state, invulnFrames, who) {
  const p = who || state.player;
  const pl = state.def.shaft;
  const camTop = state.shaft.camY;
  const hz = Shaft.hazardY(pl, camTop);
  const viewH = Shaft.VIEW_H;
  let best = null;

  state.shaft.floors.forEach(function (f) {
    if (f.gone) return;
    // 不要重生在節拍台上（下一拍就消失，等於一重生又掉下去）
    if (f.type === 'beat' || f.type === 'slide') return;
    /*
     * 也不要重生在尖刺上：無敵時間一過就被刺，等於重生在陷阱裡。
     * v1.19 瑞士關實測：雪崩追到頂端時唯一合格的是第 26 層尖刺台，
     * 重生 → 從尖刺台起跳沒接到 → 掉進雪崩 → 又重生在同一層，無限循環。
     */
    if (f.type === 'spike') return;
    const top = f.rect.y;
    if (pl.mode === 'climb') {
      if (top > hz - 70) return;            // 離雪崩至少 70px
      if (top < camTop + 40) return;        // 還要在畫面內
      if (!best || top > best.rect.y) best = f;   // 越低越好（別送玩家一段路）
    } else {
      if (top < hz + 70) return;
      if (top > camTop + viewH - 40) return;
      if (!best || top < best.rect.y) best = f;
    }
  });

  if (best) {
    p.x = best.rect.x + best.rect.w / 2 - p.w / 2;
    p.y = best.rect.y - p.h - 2;
  } else {
    // 畫面內沒有可站的樓層（極少見）→ 放在井道中央的安全高度
    p.x = pl.shaftX + pl.shaftW / 2 - p.w / 2;
    p.y = pl.mode === 'climb' ? hz - 110 : hz + 40;
  }
  p.vx = 0; p.vy = 0;
  p.launched = false;
  p.ridingMover = null;
  p.invuln = invulnFrames;
}

/**
 * 豎井樓層的每帧更新：塌陷倒數、滑台位移、鐘擺、鐘聲。
 * 回傳事件（'crumble' / 'chime'，給音效用）。
 */
function updateShaftFloors(state) {
  const events = [];
  if (!state.shaft) return events;
  const sh = state.shaft;
  const pl = state.def.shaft;
  const frame = ++sh.frame;

  // 鐘聲
  if (sh.chime > 0) sh.chime--;
  const ch = Shaft.chimeAt(pl, frame);
  if (ch.start) { sh.chime = 90; events.push('chime'); }

  // 鐘擺
  sh.pendulums.forEach(function (p) {
    const pos = Shaft.pendulumPos(p.def, frame);
    p.va = pos.a - p.a;      // 角速度，畫殘影用
    p.x = pos.x; p.y = pos.y; p.a = pos.a;
  });

  // 節拍台的狀態寫在樓層上，繪製端才知道現在第幾拍
  const bp = Shaft.beatPhase(frame);
  const bOn = Shaft.beatOn(frame);

  sh.floors.forEach(function (f) {
    if (f.flash > 0) f.flash--;
    if (f.type === 'beat') { f.beatOn = bOn; f.beat = bp.beat; f.beatK = bp.k; }
    // 滑台：記下這帧的位移，updatePlayer 會讓站在上面的玩家跟著走
    if (f.type === 'slide' && !f.gone) {
      const nx = Shaft.slideX(f.src, frame);
      f.rect.dx = nx - f.rect.x;
      f.rect.x = nx;
    }
    if (f.gone || !f.touched) return;
    const spec = Shaft.TYPES[f.type];
    if (!spec || !spec.crumbleAfter) return;
    if (++f.timer >= spec.crumbleAfter) {
      f.gone = true;
      events.push('crumble');
      // 碎屑
      for (let i = 0; i < 10; i++) {
        state.particles.push({
          x: f.rect.x + Math.random() * f.rect.w,
          y: f.rect.y + f.rect.h / 2,
          vx: (Math.random() - 0.5) * 3,
          vy: Math.random() * 2,
          life: 26, color: '#b7a98c'
        });
      }
    }
  });
  return events;
}

function updateMovers(movers, t) {
  movers.forEach(function (m) {
    const px = m.x, py = m.y;
    const off = Math.sin(t * 0.02 * m.speed + m.phase) * m.range;
    if (m.axis === 'x') { m.x = m.ox + off; m.y = m.oy; }
    else { m.x = m.ox; m.y = m.oy + off; }
    m.dx = m.x - px;
    m.dy = m.y - py;
  });
}

/**
 * 敵人 AI。state 需要 player 與 shots，所以簽名吃整個 state。
 * 回傳事件陣列（目前只有砲台開火）。
 */
function updateEnemies(state, t) {
  const events = [];
  const p = state.player;
  const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;

  state.enemies.forEach(function (e) {
    if (!e.alive) { if (e.squash > 0) e.squash--; return; }
    if (e.bump > 0) e.bump--;

    switch (e.type) {
      case 'turret': {
        // 不移動，面向玩家，定時開火
        e.dir = pcx < e.x + e.w / 2 ? -1 : 1;
        if (--e.cd <= 0) {
          e.cd = e.every || 110;      // def.every：這座砲台多久開一次火（希臘魔王旁邊的放慢）
          const sx = e.x + e.w / 2, sy = e.y + 8;
          const dx = pcx - sx, dy = pcy - sy;
          const d = Math.max(1, Math.hypot(dx, dy));
          // 只在玩家還算靠近時才開火，避免畫面外亂射
          if (d < 420) {
            const sp = 3.1;
            state.shots.push(makeShot(sx - 6, sy, dx / d * sp, dy / d * sp));
            events.push('shoot');
          }
        }
        break;
      }

      case 'chaser': {
        // 在自己的巡邏範圍內追玩家；玩家太遠就回到中心晃
        const cx = e.x + e.w / 2;
        const inRange = pcx > e.left - 60 && pcx < e.right + 60;
        if (inRange) {
          const tx = U.clamp(pcx - e.w / 2, e.left, e.right - e.w);
          e.x += U.clamp(tx - e.x, -e.speed, e.speed);
          const ty = U.clamp(pcy - e.h / 2, 90, Levels.GROUND_Y - 60);
          e.y += U.clamp(ty - e.y, -e.speed * 0.8, e.speed * 0.8);
          e.dir = pcx < cx ? -1 : 1;
        } else {
          e.x += e.dir * e.speed * 0.5;
          if (e.x < e.left) { e.x = e.left; e.dir = 1; }
          if (e.x + e.w > e.right) { e.x = e.right - e.w; e.dir = -1; }
          e.y = e.baseY + Math.sin(t * 0.05 + e.phase) * 20;
        }
        break;
      }

      case 'charger': {
        if (e.stun > 0) { e.stun--; break; }
        // 玩家在同一高度且在前方 → 衝刺
        const sameLevel = Math.abs((p.y + p.h) - (e.y + e.h)) < 40;
        const ahead = (e.dir < 0 && pcx < e.x) || (e.dir > 0 && pcx > e.x + e.w);
        e.charging = sameLevel && ahead && Math.abs(pcx - (e.x + e.w / 2)) < 300;
        const sp = e.charging ? e.speed * 2.8 : e.speed;
        e.x += e.dir * sp;
        if (e.x < e.left) {
          e.x = e.left; e.dir = 1;
          if (e.charging) { e.stun = 45; e.charging = false; }
        }
        if (e.x + e.w > e.right) {
          e.x = e.right - e.w; e.dir = -1;
          if (e.charging) { e.stun = 45; e.charging = false; }
        }
        break;
      }

      default: {
        // walker / flyer / guard / spiker：單純來回
        e.x += e.dir * e.speed;
        if (e.x < e.left) { e.x = e.left; e.dir = 1; }
        if (e.x + e.w > e.right) { e.x = e.right - e.w; e.dir = -1; }
        if (e.kind.air) e.y = e.baseY + Math.sin(t * 0.04 + e.phase) * 28;
      }
    }
  });

  return events;
}

/**
 * 彈射物移動。撞到地形、飛出關卡範圍、或壽命到了就消失。
 *
 * 「飛出範圍就刪」很重要：魔王的落地震波是貼地飛的，如果只靠壽命
 * （240 帧）回收，它們會在畫面外繼續存在，下一輪震波又生出兩顆，
 * 場上累積一堆看不見的彈，玩家會莫名被打到。
 */
function updateShots(state) {
  const solids = solidsOf(state);
  const maxX = state.def.width + 80;
  for (let i = state.shots.length - 1; i >= 0; i--) {
    const s = state.shots[i];
    if (s.warn > 0) s.warn--;
    // 吸血伯爵的蝙蝠（v1.29.1）：每帧往最近的玩家轉一點點（轉向有上限，繞著跑就甩得掉）
    if (s.homing) {
      let tgt = null, best = Infinity;
      (state.players || [state.player]).forEach(function (q) {
        if (q.out) return;
        const d = Math.hypot(q.x + q.w / 2 - s.x, q.y + q.h / 2 - s.y);
        if (d < best) { best = d; tgt = q; }
      });
      if (tgt) {
        const sp = Math.hypot(s.vx, s.vy) || 1;
        const cur = Math.atan2(s.vy, s.vx);
        const want = Math.atan2(tgt.y + tgt.h / 2 - s.y, tgt.x + tgt.w / 2 - s.x);
        let da = want - cur;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const a = cur + U.clamp(da, -0.035, 0.035);
        s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
      }
    }
    s.x += s.vx;
    s.y += s.vy;
    let gone = --s.life <= 0 ||
               s.x < -80 || s.x > maxX ||
               s.y < -80 || s.y > 520;
    // 震波是貼著地面掃的，不做地形碰撞（否則一生成就被地面吃掉）
    if (!gone && !s.wave && !s.fixed) {
      for (let k = 0; k < solids.length; k++) {
        if (U.overlap(s, solids[k])) { gone = true; break; }
      }
    }
    if (gone) state.shots.splice(i, 1);
  }
}

/**
 * 魔王狀態機。
 *
 * 共同節奏：idle（走動）→ telegraph（停下閃爍預告，給玩家反應時間）
 *          → act（跳躍落地震波 / 衝刺）→ recover（露出破綻，可被攻擊）
 * 破綻期（recover）才吃傷害，其他時間是無敵的 —— 這樣玩家必須讀招。
 */
function updateBoss(state, t) {
  const b = state.boss;
  const events = [];
  if (!b) return events;

  if (b.hurtFlash > 0) b.hurtFlash--;
  if (b.invuln > 0) b.invuln--;
  if (b.graceTimer > 0) b.graceTimer--;

  // 大蒜項鍊：魔王一倒地，破綻期就拉長（每次倒地只套用一次）
  if (b.phase === 'recover' && !b.stunApplied) {
    const k = (state.player && state.player.stats && state.player.stats.bossStun) || 1;
    if (k !== 1) b.timer = Math.round(b.timer * k);
    b.stunApplied = true;
  } else if (b.phase !== 'recover') {
    b.stunApplied = false;
  }

  if (b.defeated) {
    b.deathTimer++;
    // 倒地下沉
    b.y += 0.6;
    if (b.deathTimer % 6 === 0) {
      state.particles.push({
        x: b.x + Math.random() * b.w, y: b.y + Math.random() * b.h,
        vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2.5,
        life: 34, color: '#ffd166'
      });
    }
    return events;
  }

  const p = state.player;
  const pcx = p.x + p.w / 2;

  b.timer--;

  switch (b.phase) {
    case 'idle': {
      // 朝玩家靠近
      b.dir = pcx < b.x + b.w / 2 ? -1 : 1;
      b.x += b.dir * b.speed;
      b.x = U.clamp(b.x, b.left, b.right - b.w);
      // 火鳥：平常盤旋在半空中（落地只發生在俯衝之後）
      if (b.pattern === 'dive') {
        const hoverY = Levels.GROUND_Y - b.h - 170 + Math.sin(t * 0.05) * 8;
        b.y += U.clamp(hoverY - b.y, -2.4, 2.4);
      }
      if (b.timer <= 0) {
        b.phase = 'telegraph';
        b.timer = 50;            // 預告時間，夠長讓玩家閃開
        events.push('telegraph');
      }
      break;
    }

    case 'telegraph': {
      // 停住閃爍預告，不動。時間到才真的出手。
      if (b.timer <= 0) {
        b.phase = 'act';
        events.push('act');
        switch (bossPatternOf(b)) {
          case 'surtr': {
            /*
             * 火巨人：站定連揮三劍（狂暴四劍），高低交錯。順序固定（不用亂數，結果可重現），
             * 但每一輪從哪一種開始輪流換 —— 玩家要看劍，不能背順序。
             * 狂暴時火山同時噴出熔岩彈，從天上掉在玩家附近（跟荷蘭風車碎片同一套：看影子躲）。
             */
            const rage = bossEnraged(b);
            b.round = (b.round || 0) + 1;
            const first = b.round % 2 === 0;           // true = 這輪先高掃
            b.slashes = [];
            for (let k = 0; k < (rage ? 4 : 3); k++) b.slashes.push((k % 2 === 0) === first);
            b.swingT = 0;
            b.dir = pcx < b.x + b.w / 2 ? -1 : 1;
            b.timer = 60 + b.slashes.length * SLASH_GAP + 60;
            if (rage && b.debris > 0) {
              const ar = state.def.bossArena || { x: 0, w: state.def.width };
              for (let k = 0; k < b.debris; k++) {
                const dx = (k - (b.debris - 1) / 2) * 150;
                const sx = U.clamp(pcx + dx, ar.x + 10, ar.x + ar.w - 24);
                const sh = makeShot(sx, 30 - k * 40, 0, 2.6);
                sh.debris = true; sh.lava = true; sh.w = sh.h = 16;
                state.shots.push(sh);
              }
              events.push('shoot');
            }
            break;
          }
          case 'sphinx':
            // 人面獅身：坐定唸咒，連噴三根沙柱（狂暴五根），每根瞄玩家當下的位置
            b.pillarsLeft = bossEnraged(b) ? 5 : 3;
            b.shotCd = 0;
            b.timer = 420;
            break;
          case 'charge':
            b.timer = 70;
            b.dir = pcx < b.x + b.w / 2 ? -1 : 1;
            /*
             * 玩家站在平台上 → 不衝刺，改擲長槍。
             *
             * ⚠️ 之前的漏洞：兩側平台在衝刺範圍外，玩家站上去等，
             * 魔王衝過去撞牆就癱倒，跳下來打一下再跳回去 —— 完全無風險。
             * 現在「躲上平台」會換來三發往上丟的長槍，而且這招結束後沒有破綻期，
             * 想打它就得下來地面面對衝刺。
             */
            b.throwing = (p.y + p.h) < Levels.GROUND_Y - 24;
            if (b.throwing) { b.shotsLeft = 3; b.shotCd = 0; b.timer = 110; }
            break;
          case 'volley':
            // 連續扇形齊射：不移動，分幾波吐彈
            b.timer = 96;
            b.shotsLeft = 4;
            b.shotCd = 0;
            break;
          case 'dive': {
            /*
             * 火鳥：鎖定玩家「現在的位置」斜線俯衝，落地噴出兩道火焰沿地面燒過去。
             * 預告期（telegraph）它會在空中停住發光，玩家看得到俯衝角度、有時間跑開。
             * 狂暴時連續俯衝兩次（第二次從空中重新瞄準）。
             */
            if (b.divesLeft == null || b.divesLeft <= 0) b.divesLeft = bossEnraged(b) ? 2 : 1;
            const tx = pcx - b.w / 2, ty = Levels.GROUND_Y - b.h;
            const dx = tx - b.x, dy = ty - b.y;
            const d = Math.max(1, Math.hypot(dx, dy));
            b.vx = dx / d * 8.5;
            b.vy = dy / d * 8.5;
            b.timer = 90;
            break;
          }
          case 'blink':
            /*
             * 吸血伯爵：化成霧消失 → 在玩家「背後」出現 → 放出兩波蝙蝠。
             * 跟其他魔王的差別是「它會換位置」—— 玩家不能只盯著一個方向。
             * 出現前地上有一團紅霧預告落點（見 Sprites），給反應時間。
             */
            b.timer = 170;
            b.blinkT = 0;
            b.shotsLeft = 2;
            b.shotCd = 0;
            {
              const ar = state.def.bossArena || { x: 0, w: state.def.width };
              const side = p.facing > 0 ? -1 : 1;   // 出現在玩家背後
              b.blinkTo = U.clamp(pcx + side * 150 - b.w / 2, Math.max(ar.x + 10, b.left), Math.min(ar.x + ar.w - b.w - 10, b.right - b.w));
            }
            break;
          case 'summon':
            // 召喚小兵 + 自己升空灑彈
            b.timer = 120;
            b.shotsLeft = 3;
            b.shotCd = 18;
            b.hoverBase = b.y;
            break;
          default: { // 'slam'
            const rage = bossEnraged(b);
            b.jumpsLeft = (rage ? b.rageJumps : b.jumps) - 1;
            b.timer = 60 + b.jumpsLeft * 70;
            b.vy = -13.5;          // 跳起來
            b.onGround = false;
            b.landPause = 0;
            /*
             * 狂暴：風車葉片碎片從天而降。
             * 落點瞄玩家附近（左右散開），從畫面頂端慢慢掉，
             * 約 1.6 秒才落地 —— 看得到、躲得掉，但會逼玩家移動。
             */
            if (rage && b.debris > 0) {
              for (let k = 0; k < b.debris; k++) {
                const dx = (k - (b.debris - 1) / 2) * 120 + (Math.random() - 0.5) * 40;
                // 夾在整個競技場內（不是魔王的走動範圍）：玩家躲在兩側平台時也照樣會掉
                const ar = state.def.bossArena || { x: 0, w: state.def.width };
                const sx = U.clamp(pcx + dx, ar.x + 10, ar.x + ar.w - 20);
                const sh = makeShot(sx, 50 - k * 30, 0, 2.6);
                sh.debris = true;
                state.shots.push(sh);
              }
              events.push('shoot');
            }
          }
        }
      }
      break;
    }

    case 'act': {
      switch (bossPatternOf(b)) {
        case 'surtr': {
          /*
           * 每一劍：前 SLASH_WINDUP 帧舉劍（b.swing = 'high' / 'low'，畫面上劍的位置不一樣），
           * 時間到從劍尖放出劍光；接著等到 SLASH_GAP 再揮下一劍。揮的方向在每一劍蓄力開始時對準玩家。
           */
          const k = b.swingT % SLASH_GAP;
          const idx = Math.floor(b.swingT / SLASH_GAP);
          if (idx < b.slashes.length) {
            const high = b.slashes[idx];
            if (k === 0) { b.dir = pcx < b.x + b.w / 2 ? -1 : 1; events.push('throw'); }
            b.swing = high ? 'high' : 'low';
            b.swingK = Math.min(1, k / SLASH_WINDUP);
            if (k === SLASH_WINDUP) {
              const sx = b.dir > 0 ? b.x + b.w : b.x - 30;
              state.shots.push(makeSlash(sx, b.dir, high));
              events.push('shoot');
            }
          } else {
            b.swing = null;
            if (b.swingT >= b.slashes.length * SLASH_GAP + 24) {
              b.phase = 'recover';
              b.timer = b.recoverTime;
              events.push('slam');
            }
          }
          b.swingT++;
          break;
        }

        case 'sphinx': {
          /*
           * 沙柱：每 42 帧在玩家腳下放一個流沙漩渦，48 帧後噴出沙柱。
           * 漩渦出現時人還來得及走開（走 48 帧 ≈ 200px），站著不動就會被頂到。
           * 狂暴：每隔一根，另外在「照現在的速度再跑 40 帧會到的地方」也放一根 —— 不能一直往同一邊跑。
           */
          b.dir = pcx < b.x + b.w / 2 ? -1 : 1;
          const ar = state.def.bossArena || { x: 0, w: state.def.width };
          const aim = function (x) { return U.clamp(x - 22, ar.x + 10, ar.x + ar.w - 54); };
          if (b.shotCd > 0) b.shotCd--;
          else if (b.pillarsLeft > 0) {
            b.pillarsLeft--;
            b.shotCd = 42;
            state.shots.push(makePillar(aim(pcx)));
            if (bossEnraged(b) && b.pillarsLeft % 2 === 0 && Math.abs(p.vx) > 1) {
              state.shots.push(makePillar(aim(pcx + p.vx * 40)));
            }
            events.push('shoot');
          }
          if (b.pillarsLeft <= 0 && b.shotCd <= 0 && !state.shots.some(function (q) { return q.pillar; })) {
            b.phase = 'recover';
            b.timer = b.recoverTime;
            events.push('slam');
          }
          break;
        }

        case 'charge': {
          if (b.throwing) {
            // 擲槍：站定，朝玩家目前位置連丟三發（每發之間玩家都還能移動閃）
            b.dir = pcx < b.x + b.w / 2 ? -1 : 1;
            if (b.shotCd > 0) b.shotCd--;
            else if (b.shotsLeft > 0) {
              b.shotsLeft--;
              b.shotCd = 26;
              const sx = b.x + b.w / 2, sy = b.y + 18;
              const px = p.x + p.w / 2, py = p.y + p.h / 2;
              const d = Math.max(1, Math.hypot(px - sx, py - sy));
              const sp = 4.6;
              const s = makeShot(sx - 6, sy, (px - sx) / d * sp, (py - sy) / d * sp);
              s.spear = true;
              state.shots.push(s);
              events.push('shoot');
            }
            if (b.shotsLeft <= 0 && b.shotCd <= 0) {
              /*
               * 丟完三支槍也會癱倒，但比撞牆短（100 vs 170 帧）。
               * v1.20.2 玩家：射完箭為何不會癱瘓 —— 舊版丟完直接回去走動、完全沒破綻，
               * 站平台的玩家打不到它，以為是 bug。躲平台還是得先閃三支槍，只是不再「打不到」。
               */
              b.throwing = false;
              b.phase = 'recover';
              b.timer = SPEAR_RECOVER;
              events.push('slam');
            }
            break;
          }
          // 橫向衝刺，撞牆就進破綻
          b.x += b.dir * b.speed * 3.4;
          if (b.x <= b.left || b.x + b.w >= b.right) {
            b.x = U.clamp(b.x, b.left, b.right - b.w);
            b.phase = 'recover';
            b.timer = 170;
            events.push('slam');
          }
          break;
        }

        case 'volley': {
          /*
           * 齊射型：站定不動，分 4 波朝玩家方向吐出扇形彈幕。
           *
           * 跟 slam/charge 的差別在於「威脅來自空中而不是地面」：
           * 玩家不能只靠跳躍閃，必須左右走位找彈幕空隙。
           */
          b.dir = pcx < b.x + b.w / 2 ? -1 : 1;
          if (b.shotCd > 0) b.shotCd--;
          else if (b.shotsLeft > 0) {
            b.shotsLeft--;
            b.shotCd = 22;
            const sx = b.x + b.w / 2, sy = b.y + 22;
            const px = p.x + p.w / 2, py = p.y + p.h / 2;
            const base = Math.atan2(py - sy, px - sx);
            // 三發扇形，中間直射、上下各偏 16 度
            [-0.28, 0, 0.28].forEach(function (off) {
              const a = base + off;
              const sp = 3.0;
              state.shots.push(
                makeShot(sx - 6, sy, Math.cos(a) * sp, Math.sin(a) * sp));
            });
            events.push('shoot');
          }
          if (b.shotsLeft <= 0 && b.shotCd <= 0) {
            b.phase = 'recover';
            b.timer = 150;
          }
          break;
        }

        case 'dive': {
          b.x += b.vx;
          b.y += b.vy;
          // 俯衝途中沿路灑火星（往下慢慢掉，掉到地上就熄）
          b.emberT = (b.emberT || 0) + 1;
          if (b.emberT % 7 === 0 && b.y < Levels.GROUND_Y - b.h - 30) {
            const em = makeShot(b.x + b.w / 2 - 5, b.y + b.h - 12, 0, 2.0);
            em.w = em.h = 10; em.ember = true;
            state.shots.push(em);
          }
          b.x = U.clamp(b.x, b.left, b.right - b.w);
          b.dir = b.vx < 0 ? -1 : 1;
          const floor = Levels.GROUND_Y - b.h;
          if (b.y >= floor) {
            b.y = floor;
            events.push('slam');
            // 落地處燒成一片火海（不會移動，燒 110 帧；火熄了再過去踩牠）
            state.shots.push({ x: b.x - 34, y: Levels.GROUND_Y - 14, w: b.w + 68, h: 14, vx: 0, vy: 0,
                               life: 110, patch: true, fixed: true });
            b.divesLeft--;
            if (b.divesLeft > 0) {
              b.phase = 'rise';              // 狂暴：飛回空中再俯衝一次
              b.timer = 60;
            } else {
              b.phase = 'recover';
              b.timer = b.recoverTime;
            }
          }
          break;
        }

        case 'blink': {
          b.blinkT++;
          if (b.blinkT <= 24) {
            b.fade = 1 - b.blinkT / 24;               // 化霧消失
          } else if (b.blinkT === 25) {
            b.x = b.blinkTo;                          // 瞬移
          } else if (b.blinkT <= 45) {
            b.fade = (b.blinkT - 25) / 20;            // 重新出現
          } else {
            b.fade = 1;
            b.dir = pcx < b.x + b.w / 2 ? -1 : 1;
            if (b.shotCd > 0) b.shotCd--;
            else if (b.shotsLeft > 0) {
              b.shotsLeft--;
              b.shotCd = 50;
              // 一波 3 隻蝙蝠往上散開，再慢慢轉向追玩家（見 updateShots 的 homing）；飛 150 帧就散掉
              const sx = b.x + b.w / 2, sy = b.y + 24;
              [-2.2, -1.57, -0.94].forEach(function (a) {
                const s = makeShot(sx - 6, sy, Math.cos(a) * 2.4, Math.sin(a) * 2.4);
                s.bat = true; s.homing = true; s.life = 150;
                state.shots.push(s);
              });
              events.push('shoot');
            }
            if (b.shotsLeft <= 0 && b.shotCd <= 0) {
              b.phase = 'recover';
              b.timer = b.recoverTime;
            }
          }
          break;
        }

        case 'summon': {
          /*
           * 召喚型：升到半空，一邊丟彈一邊放小兵下來。
           *
           * 這隻的壓力不是單次大招，而是「場上會越來越亂」。
           * 玩家得決定先清小兵還是趁破綻期打本體 —— 是取捨型的壓力，
           * 跟前三隻的「讀招閃避」完全不同。
           */
          const hover = (b.hoverBase == null ? b.y : b.hoverBase) - 74;
          b.y += U.clamp(hover - b.y, -3.2, 3.2);
          // 左右緩慢飄移，不讓玩家站定一個點就安全
          b.x += Math.sin(t * 0.05) * 1.6;
          b.x = U.clamp(b.x, b.left, b.right - b.w);

          if (b.shotCd > 0) b.shotCd--;
          else if (b.shotsLeft > 0) {
            b.shotsLeft--;
            b.shotCd = 30;
            // 往下丟一顆慢速彈（落點在玩家目前位置）
            const sx = b.x + b.w / 2, sy = b.y + b.h;
            const px = p.x + p.w / 2;
            const dx = U.clamp((px - sx) / 60, -1.6, 1.6);
            state.shots.push(makeShot(sx - 6, sy, dx, 2.4));
            events.push('shoot');

            // 同時放一隻小兵（上限 3 隻，避免畫面被塞滿）
            const alive = state.enemies.filter(function (e) {
              return e.alive && e.summoned;
            }).length;
            if (alive < 3) {
              const spawnX = U.clamp(b.x + b.w / 2 - 15, b.left, b.right - 30);
              const minion = makeEnemy({
                x: spawnX, type: 'walker',
                left: b.left, right: b.right
              });
              minion.summoned = true;
              state.enemies.push(minion);
              events.push('summon');
            }
          }
          if (b.shotsLeft <= 0 && b.shotCd <= 0) {
            b.phase = 'drop';
            b.timer = 40;
          }
          break;
        }

        default: {   // 'slam'
          // 連跳之間的落地停頓：站穩一下再起跳，玩家才讀得到節奏
          if (b.landPause > 0) {
            if (--b.landPause === 0) {
              b.vy = -12.2;
              b.onGround = false;
            }
            break;
          }
          // 跳躍落地 → 兩側震波
          b.vy = Math.min(b.vy + 0.62, 14);
          // 追蹤跳：空中往玩家方向修正（只在下落段，起跳時還看得出往哪跳）
          if (b.homing && b.vy > 0) {
            const tx = pcx - b.w / 2;
            b.x += U.clamp((tx - b.x) * 0.06, -b.homing, b.homing);
            b.x = U.clamp(b.x, b.left, b.right - b.w);
          }
          b.y += b.vy;
          const floor = Levels.GROUND_Y - b.h;
          if (b.y >= floor) {
            b.y = floor;
            b.vy = 0;
            b.onGround = true;
            events.push('slam');
            /*
             * 連跳的「中間幾下」只放短程震波（約 110px 就消散），
             * 最後一下才放跑全場的大震波。
             * 全部都放大震波的話，震波間隔比玩家一次跳躍的滯空還短，
             * 剛落地就被下一道掃到，根本沒有閃的空間（實測機器人 4 條命全賠在這）。
             * 這樣分層之後：中間幾下是「別貼著它」，最後一下是「看準了跳」。
             */
            const ws = b.waveSpeed * (bossEnraged(b) ? 1.15 : 1);
            const last = b.jumpsLeft <= 0;
            const w1 = makeWave(b.x - 16, -1, ws), w2 = makeWave(b.x + b.w, 1, ws);
            if (!last) { w1.life = w2.life = 38; w1.small = w2.small = true; }
            // 大震波也只跑約 380px：跑全場會把退到牆角的玩家逼成「只能賭一次跳」
            else if (b.jumps > 1) { w1.life = w2.life = 130; }
            state.shots.push(w1, w2);
            if (b.jumpsLeft > 0) {
              b.jumpsLeft--;
              b.landPause = 24;
            } else {
              b.phase = 'recover';
              b.timer = b.recoverTime;
            }
          }
        }
      }

      if (b.timer <= 0 && b.phase === 'act') {
        // 保險：超時強制往下一階段，避免卡在 act
        b.phase = b.pattern === 'summon' ? 'drop' : 'recover';
        b.timer = b.pattern === 'summon' ? 40 : 90;
      }
      break;
    }

    case 'rise': {
      // 火鳥狂暴：俯衝落地後立刻飛回空中，短暫停頓後再俯衝
      const hoverY = Levels.GROUND_Y - b.h - 150;
      b.y += U.clamp(hoverY - b.y, -5, 5);
      if (b.timer <= 0 || Math.abs(b.y - hoverY) < 2) {
        b.phase = 'telegraph';
        b.timer = 30;
        events.push('telegraph');
      }
      break;
    }

    case 'drop': {
      // 召喚型專用：從空中落回地面才露出破綻
      b.vy = Math.min(b.vy + 0.7, 14);
      b.y += b.vy;
      const floor = Levels.GROUND_Y - b.h;
      if (b.y >= floor || b.timer <= 0) {
        b.y = Math.min(b.y, floor);
        b.vy = 0;
        b.onGround = true;
        b.phase = 'recover';
        b.timer = 160;
        events.push('slam');
      }
      break;
    }

    case 'recover': {
      // 破綻期：不動，可被打
      b.swing = null;
      if (b.timer <= 0) {
        b.phase = 'idle';
        b.timer = b.idleTime;
        // 起身寬容期：剛站起來的 30 帧內不造成接觸傷害。
        // 否則玩家貼著魔王打，破綻期一結束就立刻被身體判定打到，
        // 等於「攻擊完必定被反傷」，沒有脫離的機會。
        b.graceTimer = 30;
      }
      break;
    }
  }

  return events;
}

/**
 * 魔王是否可被傷害。
 * invuln 是「剛被打到的短暫硬直」，避免一次攻擊連續扣好幾滴血。
 */
/** 這一輪實際用的招式（v1.29.1 起每隻魔王都只用自己的招；保留這個函式，呼叫端不用改） */
function bossPatternOf(b) {
  return b.pattern;
}

function bossVulnerable(b) {
  return !!b && !b.defeated && b.phase === 'recover' && b.invuln <= 0;
}

/**
 * 魔王是否處於「癱倒無害」狀態。
 *
 * 跟 bossVulnerable 分開是刻意的：剛被打中的那 26 帧（invuln）雖然
 * 不能再扣血，但魔王還癱在地上，這時候不該突然變得會傷人 ——
 * 否則玩家踩完頭落地，就在原地被同一隻癱著的魔王反傷，很莫名。
 * 判定只看 phase，不看 invuln。
 */
function bossHarmless(b) {
  // 吸血伯爵化成霧（半透明以下）時穿過去不會痛 —— 看不到的東西不該打人
  return !!b && !b.defeated &&
    (b.phase === 'recover' || b.graceTimer > 0 || (b.fade != null && b.fade < 0.5));
}

/**
 * 破綻期魔王會「癱下來」，頭降低好踩。
 *
 * 高度要抓得剛剛好：
 *   癱太少（頭頂 308）→ 玩家跳起來腳底最高 278，只剩 30px 餘裕，踩不準
 *   癱太多（頭頂 362）→ 玩家的跳躍弧線會「飛過去」，整段滯空都在它上方
 *                       卻完全不重疊，落地時人已經在魔王另一側
 * 20 實測最好：頭頂降到 334，玩家跳起來自然會落在它身上。
 */
const BOSS_SLUMP = 20;
// 捷克騎士丟完長槍後的破綻期（比衝刺撞牆的 170 短：躲平台可以打，但比較難打）
const SPEAR_RECOVER = 100;

/** 魔王當前的碰撞盒（癱倒期間會變矮，跟繪製一致） */
function bossBox(b) {
  const slump = (b && b.phase === 'recover' && !b.defeated) ? BOSS_SLUMP : 0;
  return { x: b.x, y: b.y + slump, w: b.w, h: b.h - slump };
}

/** 對魔王造成一點傷害 */
function damageBoss(state, b) {
  b.hp--;
  b.hurtFlash = 14;
  b.invuln = 26;
  for (let i = 0; i < 14; i++) {
    state.particles.push({
      x: b.x + b.w / 2, y: b.y + b.h / 2,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      life: 26, color: '#ff9aa8'
    });
  }
  if (b.hp <= 0) {
    b.defeated = true;
    b.deathTimer = 0;
    return 'bossdown';
  }
  /*
   * 被打中就立刻起身：一次破綻只能打一下。
   *
   * 原本被打後魔王還癱在原地，剩下的破綻期內可以連踩好幾下，
   * 一輪就能打掉大半血 —— 魔王戰變成「等它癱倒，然後連打」。
   * 現在打中一下就結束破綻期，每一滴血都要重新讀一次招。
   * graceTimer 讓它起身的瞬間不會反傷剛踩完、還站在它頭上的玩家。
   */
  b.phase = 'idle';
  b.timer = b.idleTime;
  b.graceTimer = 45;
  b.vy = 0;
  return 'bosshit';
}

function solidsOf(state) {
  const d = state.def;
  /*
   * 豎井關：碰撞體 = 還沒塌掉的樓層 + 兩側石壁。
   *
   * 樓層的執行期狀態（有沒有被踩過、有沒有塌掉）存在 state.shaft.floors，
   * 不會動到 def —— def 是關卡定義、整場遊戲共用一份，
   * 改它會導致「重玩這一關」時平台已經不見了。
   */
  if (d.layout === 'shaft' && state.shaft) {
    const live = [];
    const beatOn = Shaft.beatOn(state.shaft.frame);
    state.shaft.floors.forEach(function (f) {
      if (f.gone) return;
      // 節拍台在第 3 拍消失（不是實心，站著的人會掉下去）；v1.30 丹麥的樂高積木裝備：紅積木一直都在
      if (f.type === 'beat' && !beatOn && !(state.player && state.player.stats && state.player.stats.brickSolid)) return;
      live.push(f.rect);
    });
    return live.concat(state.shaft.walls);
  }
  // 已現形的隱形磚變成實心的磚塊（可以站上去）
  const blocks = [];
  (state.secrets || []).forEach(function (sc) {
    if (sc.block && sc.revealed) blocks.push(sc.block);
    // 岔路的空中平台：現形後才踩得到（現形前人會直接穿過去）
    if (sc.revealed && sc.path) sc.path.forEach(function (pf) { blocks.push(pf); });
  });
  // 招牌機制裡可以站的東西（塞爾維亞的木橋）
  const extra = state.features ? Features.solids(state) : [];
  (d.platforms || []).forEach(function (pf) { pf.passThru = true; });
  state.movers.forEach(function (m) { m.passThru = true; });
  // 雙人試煉：關著的閘門、放下的吊橋與踏板
  const duo = state.duo ? Duo.solids(state) : [];
  return d.ground.concat(d.platforms || [], state.movers, blocks, extra, duo);
}

/** 擊殺一個敵人，噴粒子 */
function killEnemy(state, e) {
  e.alive = false;
  e.squash = 16;
  for (let i = 0; i < 8; i++) {
    state.particles.push({
      x: e.x + e.w / 2, y: e.y + e.h / 2,
      vx: (Math.random() - 0.5) * 4,
      vy: -Math.random() * 3,
      life: 20, color: '#aab4c8'
    });
  }
}

/**
 * 玩家物理 + 碰撞。回傳事件字串陣列，由 game.js 決定音效與計分。
 */
/**
 * 玩家物理 + 碰撞。
 *
 * who 選填：要更新哪一位玩家（預設 state.player = P1）。
 * 兩人同機時由 game.js 對每位玩家各呼叫一次，各自傳入自己的 input。
 * 這樣整個函式本體完全不用知道「有幾個玩家」。
 */
function updatePlayer(state, input, t, who) {
  const p = who || state.player;
  const st = p.stats;
  const events = [];
  const solids = solidsOf(state);
  // 雙人試煉：隊友的頭頂可以站（疊羅漢）。只加在玩家自己的碰撞裡，敵人不會踩在玩家頭上
  if (state.duo) Duo.heads(state, p).forEach(function (s) { solids.push(s); });

  // ── 水平輸入（涼鞋加速） ──
  /*
   * 站在冰面上（上一帧踩到的是瑞士關的冰面）：加速變慢、放開後還會滑一段。
   * 摩擦 0.95：全速放開約再滑 45px（平台寬 108）—— 要提早放開，但不會一放就整個滑下去。
   * （試過 0.975：放開後滑 86px，幾乎每次都滑出平台，太懲罰）
   */
  const onIce = p.onIce && p.onGround;
  // 騎駱駝（v1.23.1 非洲關坐騎，見 Features 'mount'）：跑快 30%、跳高一點
  /*
   * 潛水（v1.23.1 亞特蘭提斯，def.underwater）：
   *   重力只剩 28%、下沉最快 2.6；跳躍鍵 = 划水（隨時都能按，往上游一下）；橫向慢 20%。
   */
  // 整關潛水（亞特蘭提斯）或游進淹水段（v1.25.1 西班牙，features 'flood' 設 p.inWater）
  const uw = !!state.def.underwater || !!p.inWater;
  /*
   * v1.30 瑞典馴鹿雪橇（def.autorun）：一直往右衝、不能停也不能往回走，只能跳；
   * 冰面上雪橇越滑越快（極速 ×1.35，馴鹿皮靴 iceGrip 抓地 → 不會加速），跳得也更遠。
   */
  const auto = !!state.def.autorun;
  const iceDash = auto && p.onIce && !st.iceGrip;
  const maxRun = PHYS.MAX_RUN * st.speed * (p.mount ? 1.3 : 1) * (uw ? 0.8 : 1) * (iceDash ? 1.35 : 1);
  const accel = PHYS.ACCEL * (st.speed > 1 ? 1.15 : 1) * (onIce ? 0.3 : 1);
  const friction = onIce ? 0.95 : PHYS.FRICTION;
  const left = !auto && input.isDown('left');
  const right = auto || input.isDown('right');
  if (left && !right) { p.vx -= accel; p.facing = -1; }
  else if (right && !left) { p.vx += accel; p.facing = 1; }
  else { p.vx *= friction; if (Math.abs(p.vx) < 0.05) p.vx = 0; }
  p.vx = U.clamp(p.vx, -maxRun, maxRun);

  // ── 跳躍 ──
  if (input.once('jump')) p.jumpBuffer = PHYS.JUMP_BUFFER;
  if (p.jumpBuffer > 0) p.jumpBuffer--;
  if (p.coyote > 0) p.coyote--;

  // 彈簧鞋（商店強化）讓跳躍初速更快。
  // 乘在 JUMP_V 上，所以二段跳與蹬牆跳也一起受益。
  const jumpMul = (1 + (st.jumpBoost || 0) * 0.055) * (p.mount ? 1.1 : 1);

  if (uw) {
    if (p.jumpBuffer > 0) {
      p.vy = Math.min(p.vy * 0.4, 0) + SWIM_V;
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      events.push('swim');
      state.particles.push({ x: p.x + p.w / 2, y: p.y + p.h, vx: (Math.random() - 0.5), vy: 0.6, life: 20, color: '#d8f4ff' });
    }
  } else if (state.def.chargeJump && (p.charge > 0 || (p.onGround && input.isDown('jump')))) {
    /*
     * 蓄力跳：站在地上按住跳躍 → 蓄力（腳步慢下來、人往下蹲）；放開 → 依蓄力多久起跳。
     * 空中按跳躍照舊可以二段跳（下面的分支），所以這裡只管「在地上」的情況。
     */
    if (p.onGround && input.isDown('jump')) {
      p.charge = Math.min(PHYS.CHARGE_MAX, (p.charge || 0) + 1);
      p.vx *= 0.8;
      p.jumpBuffer = 0;
      if (p.charge === PHYS.CHARGE_MAX) p.chargeFull = (p.chargeFull || 0) + 1;
    } else if (p.onGround) {
      p.vy = PHYS.JUMP_V * jumpMul * chargeMul(p.charge);
      p.onGround = false;
      p.coyote = 0;
      p.launched = true;          // 已經放開跳躍鍵了：不要被可變跳躍高度截斷
      p.charge = 0; p.chargeFull = 0;
      p.jumpBuffer = 0;
      events.push('jump');
    } else {
      p.charge = 0; p.chargeFull = 0;   // 蓄力中被撞離地面：作廢
    }
  } else if (p.jumpBuffer > 0) {
    if (p.coyote > 0 && !state.def.chargeJump) {
      // 地面跳
      p.vy = PHYS.JUMP_V * jumpMul;
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      events.push('jump');
    } else if (st.wallJump && p.wallDir !== 0) {
      // 蹬牆跳：往反方向彈開
      p.vy = PHYS.WALL_JUMP_Y;
      p.vx = -p.wallDir * PHYS.WALL_JUMP_X;
      p.facing = -p.wallDir;
      p.wallDir = 0;
      p.wallSliding = false;
      p.jumpBuffer = 0;
      events.push('walljump');
    } else if (st.doubleJump && p.airJumps > 0) {
      // 二段跳
      p.vy = PHYS.DOUBLE_JUMP_V * jumpMul;
      p.airJumps--;
      p.jumpBuffer = 0;
      events.push('doublejump');
      for (let i = 0; i < 6; i++) {
        state.particles.push({
          x: p.x + p.w / 2, y: p.y + p.h,
          vx: (Math.random() - 0.5) * 3,
          vy: Math.random() * 2,
          life: 16, color: '#cfe0f5'
        });
      }
    }
  }
  /*
   * 可變跳躍高度：鬆開跳躍鍵就截斷上升速度。
   *
   * ⚠️ 只能對「玩家自己跳的」生效。
   * 彈簧平台（豎井關）把玩家往上彈時，玩家並沒有按跳躍鍵，
   * 若一併截斷，彈簧的初速每帧被乘 0.42，等於完全彈不起來 ——
   * 實測玩家會黏在彈簧上原地彈，y 座標完全不動，然後被尖刺追上。
   * 所以用 launched 標記外力彈射，跳過截斷。
   */
  if (!uw && !input.isDown('jump') && p.vy < 0 && !p.launched) p.vy *= PHYS.JUMP_CUT;
  // 上升結束後解除外力標記
  if (p.launched && p.vy >= 0) p.launched = false;

  // 滑翔（佛朗明哥扇）：下墜時按住跳躍鍵，限制下墜速度。
  // 只在「已經在下墜」時生效，所以不影響跳躍高度。
  p.gliding = false;
  if (st.glide && p.vy > 0 && !p.onGround && input.isDown('jump')) {
    p.gliding = true;
  }

  /*
   * ── 遠程攻擊（K 鍵）──
   * 板球：拋物線、落地彈一次，冷卻較長；辣椒火球：直線、穿透、冷卻減半。
   * 德國啤酒杯：冷卻再縮短 40%。
   * 飛行物的移動與命中在 updatePlayerShots（每帧呼叫一次，所有玩家共用）。
   * （v1.18 拿掉近戰揮擊：按鍵太多，遠程攻擊已經能打所有敵人與魔王）
   */
  if (p.throwCd > 0) p.throwCd--;
  if (st.ranged && input.once('throw') && !(p.throwCd > 0)) {
    const fire = st.ranged === 'fire';
    const sx = p.x + p.w / 2 + p.facing * 12, sy = p.y + 16;
    (state.pshots || (state.pshots = [])).push(fire
      ? { kind: 'fire', x: sx - 7, y: sy - 7, w: 14, h: 14, vx: p.facing * 7.5, vy: 0, life: 75, hitSet: [] }
      : { kind: 'ball', x: sx - 6, y: sy - 6, w: 12, h: 12, vx: p.facing * 6.2 + p.vx * 0.3, vy: -4.5, life: 120, bounces: 0 });
    p.throwCd = Math.round((fire ? 16 : 34) * (st.fastThrow ? 0.6 : 1));
    events.push('throw');
  }

  // ── 重力（貼牆滑降、滑翔都會限制下墜速度） ──
  if (uw) p.vy = Math.min(p.vy + PHYS.GRAVITY * 0.28, 2.6);
  else p.vy = Math.min(p.vy + PHYS.GRAVITY, PHYS.MAX_FALL);
  if (p.wallSliding && p.vy > PHYS.WALL_SLIDE) p.vy = PHYS.WALL_SLIDE;
  if (p.gliding && p.vy > PHYS.GLIDE_FALL) p.vy = PHYS.GLIDE_FALL;

  /*
   * ── 被移動平台「載著走」 ──
   *
   * 必須在玩家自己的水平移動之前做，而且要用上一帧站著的平台。
   *
   * 之前的寫法是在垂直碰撞裡 `p.x += s.dx`，但那發生在水平碰撞「之後」，
   * 於是 x 軸電梯會出現這個 bug：
   *   平台往旁邊滑 → 玩家 x 沒跟上 → 平台邊緣從側面撞到玩家
   *   → 水平碰撞把玩家推回去（p.x = s.x - p.w）→ 看起來就是「被擠到旁邊」
   *   → 最後被擠出平台邊緣掉下去。
   * 實測 x 軸電梯上的玩家相對位置從 -45 漂到 +100，確實會被擠掉。
   *
   * 改成「先跟著平台位移，再處理自己的移動」就不會被自己的碰撞推回。
   */
  if (p.ridingMover) {
    const rm = p.ridingMover;
    // 平台還在腳下才載（玩家可能已經跳開或走出邊緣）
    const stillAbove = (p.x + p.w) > rm.x && p.x < (rm.x + rm.w);
    if (stillAbove) {
      p.x += rm.dx;
      p.y += rm.dy;
    } else {
      p.ridingMover = null;
    }
  }

  /*
   * 單向平台（豎井 climb 模式）不參與側面碰撞。
   *
   * ⚠️ 這是瑞士關「跳上去卡卡的」的主因：往上穿過平台的那幾帧，
   * 玩家身體跟平台重疊，側面碰撞會把玩家瞬間推到平台左右邊緣、
   * 還把 vx 歸零 —— 看起來就是跳到一半被吸到旁邊、頓一下。
   * 單向平台只該從上面接住玩家，側面與底面都應該能穿過。
   */
  const oneWayMode = !!(state.shaft && state.def.shaft.mode === 'climb');
  /*
   * v1.23.1 玩家：所有關卡的浮空平台（階梯）、移動平台，從下往上跳都要能穿過去站上去，
   * 不要撞到底面上不去。這些在 solidsOf 標了 passThru；地面、牆、隱形磚、倒下的石柱照舊是實心。
   */
  const isOneWay = function (s) { return s.passThru || (oneWayMode && s.oneWay); };

  // ── 水平移動 + 側面碰撞（順便偵測貼牆） ──
  p.x += p.vx;
  let touchedWall = 0;
  solids.forEach(function (s) {
    if (!U.overlap(p, s)) return;
    if (isOneWay(s)) return;
    // 站在上面的那座平台不做側面推擠 —— 否則 x 軸電梯會把乘客擠開
    if (s === p.ridingMover) return;
    if (p.vx > 0) { p.x = s.x - p.w; touchedWall = 1; }
    else if (p.vx < 0) { p.x = s.x + s.w; touchedWall = -1; }
    p.vx = 0;
  });
  // 魔王關把玩家鎖在競技場內，別的關卡只擋左邊界
  if (state.def.bossArena) {
    const a = state.def.bossArena;
    p.x = U.clamp(p.x, a.x, a.x + a.w - p.w);
  } else {
    p.x = U.clamp(p.x, 0, state.def.width + 200 - p.w);
  }

  // ── 垂直移動 + 上下碰撞 ──
  const wasOnGround = p.onGround;
  p.onGround = false;
  // 移動前的腳底位置（單向平台判定要用）
  const pFeetBefore = p.y + p.h;
  const pHeadBefore = p.y;
  p.y += p.vy;
  // 潛水：游不出水面（畫面上方 HUD 底下是水面）
  if (state.def.underwater && p.y < 64) { p.y = 64; if (p.vy < 0) p.vy = 0; }

  /*
   * 頂隱形磚：往上跳、頭頂這一帧從磚的下方穿過磚底 → 磚現形。
   * 用 swept 判定（上一帧頭頂在磚底下、這一帧越過），跟單向平台同一套道理，
   * 不然跳得快時一帧就穿過去了。
   */
  if (p.vy < 0 && state.secrets) {
    state.secrets.forEach(function (sc) {
      if (!sc.block || sc.revealed) return;
      const bk = sc.block;
      const bottom = bk.y + bk.h;
      if (p.x + p.w > bk.x + 2 && p.x < bk.x + bk.w - 2 &&
          pHeadBefore >= bottom - 1 && p.y < bottom) {
        sc.revealed = true;
        sc.bumpAnim = 14;
        p.y = bottom;
        p.vy = 0;
        events.push('secretbump');
        for (let i = 0; i < 12; i++) {
          state.particles.push({
            x: bk.x + bk.w / 2, y: bk.y + bk.h / 2,
            vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3,
            life: 26, color: '#ffe9a8'
          });
        }
      }
    });
  }

  /*
   * 垂直碰撞。
   *
   * 豎井的「往上爬」模式要用單向平台（從下往上穿過、從上面才踩得到）。
   * 否則玩家往上跳會撞到平台底面被擋回來，在窄井裡根本爬不上去。
   * 判斷條件用「上一帧的腳底是否已經在平台頂面之上」，
   * 單純看 vy 方向不夠 —— 玩家在平台內部由下往上穿越的那幾帧 vy<0，
   * 但到了頂點 vy 轉正時人還在平台裡，會被瞬間吸附到頂面（穿模）。
   */
  const oneWay = oneWayMode;
  const prevFeet = pFeetBefore;

  // 記下這一帧站在哪座移動平台上，下一帧開頭要跟著它位移
  p.ridingMover = null;
  let landedOn = null;        // 這一帧踩到的 solid（豎井關要看它是什麼型別）
  solids.forEach(function (s) {
    if (!U.overlap(p, s)) return;

    /*
     * 單向平台：往下落時才會被接住，往上穿的時候無視。
     *
     * ⚠️ 條件只能看「這一帧是不是在往下落，而且落下前腳底還在平台上方」。
     * 我第一版寫 `prevFeet <= s.y + 1`，+1 的容差太小：
     * 玩家上升穿過平台後回落時，判定那帧的 prevFeet 已經在平台上方，
     * 但數值上差了好幾 px，條件過不了 → 直接穿回去落到下面，
     * 永遠踩不到最上面那層（實測跳到 feet=186 越過了 y=220 的終點，
     * 卻沒有 land 事件，然後掉回去）。
     *
     * 改成用「這一帧的位移區間是否跨過平台頂面」：
     *   prevFeet <= s.y  且  現在的 feet >= s.y
     * 這是標準的 swept 檢查，不受容差大小影響。
     */
    if (isOneWay(s)) {
      const feetNow = p.y + p.h;
      if (p.vy >= 0 && prevFeet <= s.y && feetNow >= s.y) {
        p.y = s.y - p.h;
        p.vy = 0;
        p.onGround = true;
        landedOn = s;
        if (s.dx !== undefined) p.ridingMover = s;
      }
      return;
    }

    if (p.vy >= 0) {
      p.y = s.y - p.h;
      p.vy = 0;
      p.onGround = true;
      landedOn = s;
      // dx 只有移動平台才有（見 makeMover）
      if (s.dx !== undefined) p.ridingMover = s;
    } else {
      p.y = s.y + s.h;
      p.vy = 0;
    }
  });

  // 貼牆狀態：空中、貼著牆、且正往那個方向推
  if (!p.onGround && touchedWall !== 0 &&
      ((touchedWall > 0 && right) || (touchedWall < 0 && left))) {
    p.wallDir = touchedWall;
    p.wallSliding = st.wallJump && p.vy > 0;
  } else {
    p.wallDir = 0;
    p.wallSliding = false;
  }

  if (p.onGround) {
    // 摩洛哥尖頭拖鞋：踩空邊緣後還能跳的寬限帧數加倍
    p.coyote = PHYS.COYOTE * (st.coyoteX || 1);
    p.airJumps = st.doubleJump ? 1 : 0;
    if (!wasOnGround && p.vy === 0) events.push('land');
  }

  /*
   * ── 豎井關：樓層型別的效果 ──
   *
   * 必須放在垂直碰撞之後（要知道踩到了誰），
   * 但在「尖刺天花板 / 死亡判定」之前（彈簧可能把玩家送上去吃尖刺）。
   */
  p.onIce = false;
  if (state.shaft && landedOn) {
    const sf = state.shaft.floors.filter(function (f) {
      return !f.gone && f.rect === landedOn;
    })[0];
    if (sf) {
      const spec = Shaft.TYPES[sf.type] || Shaft.TYPES.normal;

      // 冰面：下一帧的水平移動會讀這個（見「水平輸入」）；v1.30 馴鹿皮靴（iceGrip）不會滑
      if (spec.ice && !st.iceGrip) p.onIce = true;

      if (!sf.touched) {
        sf.touched = true;
        sf.flash = 8;
      }

      // 輸送帶：把玩家推向一側（破壞水平控制）
      if (spec.push) p.x += spec.push;

      // 彈簧：往上彈。這是雙面刃 —— 高度能救命，也可能把你送去吃尖刺。
      // launched 讓這股初速不被「鬆開跳躍鍵就截斷」吃掉（見上面說明）。
      if (spec.bounce && p.vy >= 0) {
        p.vy = spec.bounce;
        p.onGround = false;
        p.coyote = 0;
        p.launched = true;
        events.push('spring');
      }

      // 尖刺平台：踩到就痛（不彈開，否則連鎖受傷很難處理）
      if (spec.hurt && p.invuln <= 0) {
        events.push('spikefloor');
        p.invuln = 90 + st.invulnBonus;
        p.vy = -7.2;
      }
    }
  }

  /*
   * ── 豎井關：鐘擺 ──
   * 擺錘是圓的，用「圓心到玩家矩形的最近距離」判定，比方框貼身。
   * 打到 = 跟尖刺樓梯同一套處理（扣命、無敵帧、往外彈開）。
   */
  if (state.shaft && p.invuln <= 0) {
    state.shaft.pendulums.forEach(function (pd) {
      if (p.invuln > 0) return;
      const nx = U.clamp(pd.x, p.x, p.x + p.w);
      const ny = U.clamp(pd.y, p.y, p.y + p.h);
      const r = pd.def.r;
      if ((pd.x - nx) * (pd.x - nx) + (pd.y - ny) * (pd.y - ny) > r * r) return;
      events.push('spikefloor');
      p.invuln = 90 + st.invulnBonus;
      p.vx = (p.x + p.w / 2 < pd.x ? -1 : 1) * 4;
    });
  }

  // ── 金幣 ──
  // 磁鐵（商店強化）：範圍內的金幣會被拉過來。
  // 只動金幣的座標，吃取判定還是靠碰撞，所以行為一致。
  const magnet = st.magnet || 0;
  const pcx0 = p.x + p.w / 2, pcy0 = p.y + p.h / 2;

  function pullCoin(c) {
    if (c.taken || magnet <= 0) return;
    const ccx = c.x + c.w / 2, ccy = c.y + c.h / 2;
    const dx = pcx0 - ccx, dy = pcy0 - ccy;
    const d = Math.hypot(dx, dy);
    if (d > magnet || d < 0.5) return;
    // 越近吸得越快
    const pull = 3.4 * (1 - d / magnet) + 0.7;
    c.x += (dx / d) * pull;
    c.y += (dy / d) * pull;
  }

  function takeCoin(c) {
    c.taken = true;
    state.coinsGot++;
    events.push('coin');
    for (let i = 0; i < 6; i++) {
      state.particles.push({
        x: c.x + 12, y: c.y + 12,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 3 - 1,
        life: 24, color: '#f6d98a'
      });
    }
  }

  state.coins.forEach(function (c) {
    if (c.taken) return;
    pullCoin(c);
    if (U.overlap(p, c)) takeCoin(c);
  });

  // ── 裝備拾取 ──
  // 三種藏法：密道裡（要先找到密道）、魔王掉落（要先打倒）、直接放在場上
  const inSecret = state.equip && state.equip.secretIdx >= 0;
  const secretOpen = inSecret &&
    state.secrets[state.equip.secretIdx] && state.secrets[state.equip.secretIdx].found;
  const bossCleared = !state.boss || state.boss.defeated;
  const equipVisible = state.equip && !state.equip.taken && bossCleared &&
    (!inSecret || secretOpen);
  if (equipVisible) {
    const box = {
      x: state.equip.x - state.equip.w / 2,
      y: state.equip.y - state.equip.h / 2,
      w: state.equip.w, h: state.equip.h
    };
    if (U.overlap(p, box)) {
      state.equip.taken = true;
      p.equipped[state.equip.id] = true;
      events.push('equip');
      for (let i = 0; i < 18; i++) {
        state.particles.push({
          x: state.equip.x, y: state.equip.y,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          life: 30, color: '#ffe9a8'
        });
      }
    }
  }

  // ── 敵人 ──
  if (p.invuln > 0) p.invuln--;

  /** 受傷共用處理 */
  function hurtPlayer(fromX) {
    if (p.invuln > 0) return;
    events.push('hurt');
    p.invuln = 90 + st.invulnBonus;
    // 冰島毛衣（v1.30 steady）：被打到只退一半，不容易被撞下平台、撞進海裡
    const kb = st.steady ? 0.5 : 1;
    p.vy = -5.5 * kb;
    p.vx = (fromX != null && fromX > p.x ? -1 : 1) * 3.5 * kb;
  }

  state.enemies.forEach(function (e) {
    if (!e.alive || !U.overlap(p, e)) return;
    const stomping = p.vy > 0 && (p.y + p.h) - e.y < e.h * 0.7;
    // 斯洛伐克斧杖：破甲，連鋼盔衛兵、刺蝟都踩得死
    if (stomping && (e.kind.stompable || st.stompAll)) {
      killEnemy(state, e);
      // 荷蘭木鞋：重踩震波，附近地上的敵人一起震倒（空中的不算）
      if (st.stompWave) {
        state.enemies.forEach(function (o) {
          if (!o.alive || o.kind.air || o === e) return;
          if (Math.abs((o.x + o.w / 2) - (e.x + e.w / 2)) < 140 && Math.abs((o.y + o.h) - (e.y + e.h)) < 30) {
            killEnemy(state, o);
            events.push('hitkill');
          }
        });
        for (let i = 0; i < 12; i++) {
          state.particles.push({ x: e.x + e.w / 2 + (i - 6) * 20, y: e.y + e.h, vx: (i - 6) * 0.4, vy: -2, life: 20, color: '#c8a070' });
        }
        events.push('quake');
      }
      p.vy = st.highStomp ? PHYS.STOMP_BOUNCE_HIGH : PHYS.STOMP_BOUNCE;
      // 踩中後恢復二段跳，連續踩敵人很順
      p.airJumps = st.doubleJump ? 1 : 0;
      events.push('stomp');
    } else if (stomping) {
      // 踩到鋼盔/尖刺：被彈開並受傷（這隻要用丟的，或拿到斧杖再來踩）
      e.bump = 10;
      p.vy = -6.5;
      hurtPlayer(e.x + e.w / 2);
      events.push('clang');
    } else {
      hurtPlayer(e.x + e.w / 2);
    }
  });

  // ── 彈射物 ──
  for (let i = state.shots.length - 1; i >= 0; i--) {
    if (state.shots[i].warn > 0) continue;     // 沙柱還在預告（地上只有漩渦），碰到不痛
    if (U.overlap(p, state.shots[i])) {
      const s = state.shots[i];
      state.shots.splice(i, 1);
      hurtPlayer(s.x);
    }
  }

  // ── 魔王本體碰撞 ──
  //
  // 破綻期（癱下來）魔王不造成接觸傷害 —— 它是暈的。
  // 這點很重要：否則玩家衝過去想踩頭，只要稍微沒對準就從側面撞上去受傷，
  // 變成「每次攻擊都在賭」。實測這樣會先被耗死而打不完 5 滴血。
  // 現在規則很乾淨：魔王站著 = 碰到就痛，魔王癱著 = 安全，可以靠近打。
  if (state.boss && !state.boss.defeated) {
    const b = state.boss;
    const box = bossBox(b);
    if (U.overlap(p, box)) {
      const stomping = p.vy > 0 && (p.y + p.h) - box.y < box.h * 0.9;
      if (bossVulnerable(b) && stomping) {
        events.push(damageBoss(state, b));
        p.vy = st.highStomp ? PHYS.STOMP_BOUNCE_HIGH : PHYS.STOMP_BOUNCE;
        p.airJumps = st.doubleJump ? 1 : 0;
      } else if (!bossHarmless(b)) {
        hurtPlayer(b.x + b.w / 2);
      }
      // 癱倒中 / 起身寬容期 → 碰到不受傷，玩家可以安全脫離
    }
  }

  // ── 密道入口 ──
  state.secrets.forEach(function (sc) {
    if (sc.bumpAnim > 0) sc.bumpAnim--;
    if (sc.padSquash > 0) sc.padSquash--;
    // 岔路的彈跳墊（磚現形後才有）：站上去就把人彈上空路
    if (sc.pad && sc.revealed && p.onGround && Math.abs(p.y + p.h - sc.pad.y) < 3 &&
        p.x + p.w > sc.pad.x + 4 && p.x < sc.pad.x + sc.pad.w - 4) {
      p.vy = sc.padV || -20;
      p.onGround = false;
      p.coyote = 0;
      p.launched = true;
      sc.padSquash = 10;
      events.push('spring');
    }
    // 還沒頂出隱形磚 → 密室入口還不存在，走過去什麼都不會發生
    if (sc.found || !sc.revealed || !U.overlap(p, sc.trigger)) return;
    sc.found = true;
    state.secretsFound++;
    events.push('secret:' + sc.idx);
    for (let i = 0; i < 20; i++) {
      state.particles.push({
        x: sc.trigger.x + sc.trigger.w / 2,
        y: sc.trigger.y + sc.trigger.h / 2,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 30, color: '#cfe0f5'
      });
    }
  });

  // 密室裡的金幣（只在密道被發現後才能拿）
  state.secrets.forEach(function (sc) {
    if (!sc.found) return;
    sc.coins.forEach(function (c) {
      if (c.taken) return;
      pullCoin(c);
      if (U.overlap(p, c)) takeCoin(c);
    });
  });

  /*
   * ── 豎井關：尖刺天花板 + 掉出畫面 ──
   *
   * 兩端都會死（這就是這個玩法的核心張力）：
   *   太慢 → 被往上推到尖刺（受傷，不是直接死，給玩家反應機會）
   *   太快 → 掉出畫面底部（死亡）
   *
   * 注意「掉出底部」的判定用的是相機，不是世界高度 ——
   * 整座井很深，用世界高度判定等於永遠不會觸發。
   */
  if (state.shaft) {
    const camY = state.shaft.camY;
    const pl = state.def.shaft;
    const edge = Shaft.hazardY(pl, camY);

    if (pl.mode === 'climb') {
      /*
       * climb：下方的雪崩／水位往上追。
       * 腳底低於致命邊緣就被捲進去。
       *
       * 跟 descend 的天花板一樣要做「推回」，而且同樣要先確認
       * 推上去的位置是空的 —— 否則會把玩家推進平台內部。
       */
      if (p.y + p.h > edge) {
        const probe = { x: p.x, y: edge - p.h, w: p.w, h: p.h };
        let blocked = false;
        for (let i = 0; i < solids.length; i++) {
          if (U.overlap(probe, solids[i])) { blocked = true; break; }
        }
        if (!blocked) {
          p.y = edge - p.h;
          if (p.vy > 0) p.vy = 0;
        }
        if (p.invuln <= 0) {
          events.push('hazard');
          p.invuln = 90 + st.invulnBonus;
          if (!blocked) p.vy = -3;
        }
      }
      /*
       * climb 沒有「掉出去就死」—— 往上爬時高處是安全的，
       * 而下方唯一的威脅（雪崩）已經由上面的 hazard 判定處理。
       *
       * ⚠️ 不要在這裡加「被推到畫面上方就死」。
       * 玩家爬得比相機快是正常甚至值得鼓勵的事（相機會自己追上來），
       * 判死會讓「爬太快」反而受罰 —— 實測機器人在第 8 層就被判死。
       * 真正的失敗條件只有一個：被雪崩追到。
       */
    } else {
      /*
       * descend：上方的尖刺天花板往下追。
       *
       * ⚠️ 「推回天花板下方」必須檢查推下去會不會穿過平台。
       * 原本無條件 `p.y = ceil`，若玩家正站在平台上被天花板追到，
       * 這一行會把他直接搬到平台下面 → 繼續往下掉 →
       * 一路穿過所有樓層掉出井底（實測玩家 y 跑到 3432，井底只有 2894）。
       */
      if (p.y < edge) {
        const probe = { x: p.x, y: edge, w: p.w, h: p.h };
        let blocked = false;
        for (let i = 0; i < solids.length; i++) {
          if (U.overlap(probe, solids[i])) { blocked = true; break; }
        }
        if (!blocked) {
          p.y = edge;
          if (p.vy < 0) p.vy = 0;
        }
        if (p.invuln <= 0) {
          events.push('hazard');
          p.invuln = 90 + st.invulnBonus;
          if (!blocked) p.vy = 2.5;
        }
      }
      // 掉出畫面底部 = 死亡
      if (p.y > camY + Shaft.VIEW_H + 30) events.push('fall');
    }

    // 記錄到過的最遠層（HUD 與過關判定用）
    const depth = Shaft.floorAtY(pl, p.y);
    if (depth > state.shaft.deepest) state.shaft.deepest = depth;
  } else {
    // ── 一般關卡：尖刺 / 水 / 掉出畫面 ──
    const deathY = (state.def.height || 480) + 40;
    const hazards = (state.def.spikes || []).concat(state.def.water || []);
    let fell = p.y > deathY;
    if (!fell) {
      for (let i = 0; i < hazards.length; i++) {
        if (U.overlap(p, hazards[i])) { fell = true; break; }
      }
    }
    if (fell) events.push('fall');
  }

  // ── 過關條件 ──
  if (!state.cleared) {
    if (state.boss) {
      // 魔王關：打倒魔王 + 掉落的裝備已入手（或本來就有）才過關，
      // 否則剛打完就跳過關畫面，玩家根本來不及撿獎勵。
      const dropPending = state.equip && !state.equip.taken;
      if (state.boss.defeated && state.boss.deathTimer > 70 && !dropPending) {
        state.cleared = true;
        events.push('clear');
      }
    } else if (state.shaft) {
      /*
       * 豎井關：站上「抵達層」就過關。
       *
       * 用「踩到 goal 樓層」而不是「深度 >= goalFloor」——
       * 深度判定在玩家還在空中時就會觸發，畫面會在半空中切過關，
       * 看起來像 bug。而且裝備放在抵達層上方，要讓玩家有時間撿。
       */
      const dropPending = state.equip && !state.equip.taken;
      const onGoal = p.onGround && landedOn &&
        state.shaft.floors.some(function (f) {
          return f.goal && f.rect === landedOn;
        });
      if (onGoal && !dropPending) {
        state.cleared = true;
        events.push('clear');
      }
    } else if (p.x + p.w >= state.def.goal &&
               // v1.30 挪威：終點在右上角的高台上 —— 要站上高台才算（從底下走過去不算）
               (state.def.goalY == null || (p.onGround && p.y + p.h <= state.def.goalY + 2))) {
      state.cleared = true;
      events.push('clear');
    }
  }

  return events;
}

/**
 * 玩家丟出去的東西（板球／辣椒火球）。每帧呼叫一次。
 * 打得死任何小怪（包含踩不死的盾兵、刺蝟），魔王只在破綻期吃傷害。
 * 回傳事件：'hitkill'、'bosshit'、'bossdown'、'blocked'
 */
function updatePlayerShots(state) {
  const events = [];
  const list = state.pshots;
  if (!list || !list.length) return events;
  const solids = solidsOf(state);
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i];
    let dead = --s.life <= 0;
    if (s.kind === 'ball') s.vy = Math.min(s.vy + 0.42, 10);
    s.x += s.vx;
    s.y += s.vy;
    // 撞地形：板球落地彈一次（第二次就停），火球直接熄掉
    for (let k = 0; k < solids.length && !dead; k++) {
      const b = solids[k];
      if (!U.overlap(s, b)) continue;
      if (s.kind === 'ball' && s.vy > 0 && s.y + s.h - s.vy <= b.y + 2 && s.bounces < 1) {
        s.y = b.y - s.h; s.vy = -s.vy * 0.55; s.bounces++;
      } else {
        dead = true;
      }
    }
    if (s.x < -60 || s.x > state.def.width + 60 || s.y > (state.def.height || 480) + 60) dead = true;
    // 打敵人
    if (!dead) {
      state.enemies.forEach(function (e) {
        if (dead || !e.alive || !U.overlap(s, e)) return;
        if (s.kind === 'fire') {
          if (s.hitSet.indexOf(e) >= 0) return;   // 穿透：同一隻只打一次
          s.hitSet.push(e);
        } else {
          dead = true;
        }
        if (--e.hp <= 0) { killEnemy(state, e); events.push('hitkill'); }
      });
    }
    // 打魔王
    if (!dead && state.boss && !state.boss.defeated && U.overlap(s, bossBox(state.boss))) {
      dead = true;
      if (bossVulnerable(state.boss)) events.push(damageBoss(state, state.boss));
      else events.push('blocked');
    }
    if (dead) {
      for (let k = 0; k < 5; k++) {
        state.particles.push({ x: s.x + s.w / 2, y: s.y + s.h / 2, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2,
          life: 14, color: s.kind === 'fire' ? '#ff8a3a' : '#f4efe2' });
      }
      list.splice(i, 1);
    }
  }
  return events;
}

function updateParticles(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i];
    q.x += q.vx;
    q.y += q.vy;
    q.vy += 0.18;
    if (--q.life <= 0) list.splice(i, 1);
  }
}
