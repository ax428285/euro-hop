'use strict';

/**
 * 豎井關卡（「小朋友下樓梯」/ NS-SHAFT 玩法），支援兩個方向。
 *
 * ── 兩種模式 ──────────────────────────────────────────────
 *
 * mode 'descend'（往下降，dir = +1）
 *   畫面往下捲 → 樓梯在畫面上往上移動
 *   玩家不斷往下跳；太慢被上方尖刺天花板追到，太快掉出畫面底部
 *
 * mode 'climb'（往上爬，dir = -1）
 *   畫面往上捲 → 樓梯在畫面上往下移動
 *   玩家不斷往上跳；太慢被下方的危險區（雪崩/水位）追到，
 *   跳不上去而掉下去也一樣會碰到危險區
 *
 * 兩者共用同一套資料結構與碰撞，差別只在 dir 的正負、
 * 危險區在上還是在下、以及「樓層間距要可跳上去」的額外限制。
 *
 * ⚠️ climb 的層距有硬上限：玩家的基礎跳躍高度是
 *   JUMP_V² / (2·GRAVITY) = 12.6² / 1.24 ≈ 128px。
 * 層距必須明顯小於這個值（這裡用 84），否則沒有二段跳的玩家
 * 根本跳不上去 —— 那是「無解」而不是「難」。
 *
 * ── 實作取捨：樓層是靜態的，動的是相機 ──────────────────────
 *
 * 比較直覺的做法是「每帧把所有平台搬動」，但那樣平台座標一直變，
 * 很難寫測試、也沒辦法事先知道金幣總數（過關畫面要顯示 x/總數）。
 *
 * 所以改成：用固定 seed 事先排好整座井（世界座標固定），
 * 真正會動的只有相機，危險區跟著相機走。
 * 這樣碰撞可以完全沿用既有的 solids 機制，而且整座井可重現、可驗證。
 *
 * ── 對外 API ──────────────────────────────────────────────
 *   Shaft.plan(seed, cfg)        排好整座井
 *   Shaft.hazardY(pl, camY)      危險區的「致命邊緣」世界 y
 *   Shaft.floorAtY(pl, y)        某個世界 y 對應第幾層
 *   Shaft.scrollAt(pl, floor)    在第 N 層時的捲動速度
 *   Shaft.camLimit(pl, viewH)    相機能捲到的極限
 *   Shaft.camStart(pl, viewH)    相機起始位置
 */
const Shaft = (function () {

  const VIEW_H = 480;            // 畫面高
  const VIEW_W = 960;

  // 危險區相對相機的位置。
  // descend：尖刺天花板在畫面上方（放在 HUD 下面才看得見）
  const CEIL_TOP = 44;
  const CEIL_H = 30;
  // climb：雪崩/水位在畫面下方
  const FLOOD_H = 56;

  const WALL_W = 150;            // 兩側石壁厚度（純視覺 + 擋住玩家）

  const PLAT_H = 16;

  // climb 模式的層距上限（見檔頭說明：基礎跳躍高度約 128px）
  const MAX_CLIMB_GAP = 92;

  /**
   * 平台型別。
   *
   * 每一種都要「改變玩家的節奏」，否則只是換皮：
   *   normal   普通
   *   spike    踩到受傷（要閃開）
   *   convL/R  輸送帶，站上去會被推向一側（破壞水平控制）
   *   spring   彈簧，把玩家往上彈
   *            （descend 是陷阱：會送你去吃尖刺；climb 是助力：省一次跳）
   *   crumble  踩到後會塌掉（不能久留）
   *
   * ⚠️ climb 模式的樓層必須是「單向平台」（從下往上可以穿過去，
   * 從上面才踩得到）。原因：往上爬時玩家是跳上去的，若平台四面皆實心，
   * 跳起來會直接撞到頭底部被擋回來，只能從旁邊繞 ——
   * 在窄井裡幾乎等於無法前進。這是 climb 能不能玩的關鍵，
   * 不是手感微調。實作在 entities.js 的垂直碰撞。
   */
  const TYPES = {
    normal:  { solid: true,  hurt: false },
    spike:   { solid: true,  hurt: true  },
    convL:   { solid: true,  hurt: false, push: -1.9 },
    convR:   { solid: true,  hurt: false, push: 1.9 },
    /*
     * 彈簧：把玩家往上彈。
     *
     * ⚠️ 彈力不能太強。原本 -13.4 的初速會把玩家彈起約 145px，
     * 比層距（104px）還高 —— 玩家會彈回「上一層」，然後又掉回同一個彈簧，
     * 形成無限彈跳迴圈卡死在原地（測試機器人就這樣卡住 2000 帧）。
     * 改成 -8.8（約彈起 62px），比層距小：會明顯延遲下降、
     * 很可能被尖刺追上，但不會讓玩家回到上一層而循環。
     */
    spring:  { solid: true,  hurt: false, bounce: -8.8 },
    crumble: { solid: true,  hurt: false, crumbleAfter: 26 },
    /*
     * 齒輪滑台（目前只有英國鐘塔用，見 cfg.extras）：左右來回滑動，
     * 站上去會被載著走。落點會移動 —— 要「看準時機」才跳，
     * 不是單純找縫隙。
     */
    slide:   { solid: true,  hurt: false, slide: true },
    /*
     * 節拍台（奧地利歌劇院用）：跟著華爾滋的三拍子閃爍 ——
     * 第 1、2 拍實心，第 3 拍消失。站著不動會在第 3 拍掉下去，
     * 從上面落下時剛好遇到第 3 拍也會穿過去。要「數拍子」才踩得穩。
     */
    beat:    { solid: true,  hurt: false, beat: true },
    /*
     * 冰面（瑞士阿爾卑斯用）：站在上面會滑 —— 加速慢、放開方向鍵也停不下來。
     * 要提早放開、甚至反方向踩一下才停得住；往上跳時的助跑也會被帶著走。
     * 不會傷人、也不會消失（climb 模式不能有會消失的平台，見 pickType）。
     */
    ice:     { solid: true,  hurt: false, ice: true }
  };

  // 節拍台的一拍幾帧（≈ 奧地利曲目 126 BPM 的一拍，平台跟音樂同步）
  const BEAT_FRAMES = 29;

  /** 節拍台在第 frame 帧是不是實心的（第 3 拍消失） */
  function beatOn(frame) {
    return Math.floor(frame / BEAT_FRAMES) % 3 !== 2;
  }

  /** 第 frame 帧在這一拍裡的進度 0→1，以及是第幾拍（0,1,2） */
  function beatPhase(frame) {
    return { beat: Math.floor(frame / BEAT_FRAMES) % 3, k: (frame % BEAT_FRAMES) / BEAT_FRAMES };
  }

  // 滑台的擺動參數：幅度上限、角速度（約 3.5 秒一個來回）
  const SLIDE_RANGE = 46;
  const SLIDE_SPEED = 0.03;

  /*
   * 鐘擺（cfg.pendulums 指定掛在哪幾層下方）。
   *
   * 幾何是算過的，不是隨便抓：擺錘只會掃過「上層腳底」與「下層頭頂」之間
   * 那條 64px 的空帶（層距 104 − 身高 40），所以
   *   - 站在任何一層上都不會被打到（不會「站著不動也扣血」）
   *   - 只有「正在往下掉」的玩家要抓時機
   * 支點在上層上方 PEND_PIVOT、擺長 PEND_LEN、擺幅 PEND_AMP（弧度）：
   *   最高點 = 支點 + LEN·cos(AMP) − R = 上層 + 3   （> 上層腳底）
   *   最低點 = 支點 + LEN + R        = 上層 + 63  （< 下層頭頂 64）
   */
  const PEND_PIVOT = 100;
  const PEND_LEN = 149;
  const PEND_AMP = 0.67;
  const PEND_R = 14;
  const PEND_SPEED = 0.045;

  /**
   * 每一層的型別抽樣權重。
   *
   * 依深度調整：前幾層全部給普通平台當教學區，
   * 之後逐步加入危險型別。權重是刻意保守的 ——
   * 這個玩法本身就有時間壓力，再加上滿滿的陷阱會變成純運氣。
   */
  /**
   * prevType 用來避免「連續兩層彈簧」。
   *
   * ⚠️ 單一彈簧的彈起高度已經壓在層距以下（見 TYPES.spring），
   * 但連續兩層彈簧還是會卡死：從上層彈簧掉到下層彈簧，被彈回上層，
   * 上層又把你彈起來⋯⋯兩個彈簧互相把玩家丟來丟去。
   * （實測關卡 7 的第 30/31 層與關卡 8 的第 30 層就是這樣卡住。）
   */
  function pickType(r, floor, total, prevType, mode, extras) {
    // 前 4 層：純普通，讓玩家先理解該往哪個方向走
    if (floor < 4) return 'normal';

    const prog = floor / total;          // 0 → 1
    const roll = r();

    /*
     * 額外型別（關卡自選）。只有開了 extras 才多抽一次亂數 ——
     * 否則沒用到的關卡樓層排列會整個被打亂。
     * 滑台不連續出現：兩片都在動的話落點完全讀不出來。
     */
    if (extras && extras.indexOf('slide') >= 0 && floor >= 6 && prevType !== 'slide') {
      if (r() < 0.2 + prog * 0.12) return 'slide';
    }
    // 節拍台也不連續出現：兩層一起消失的話會直接掉兩層，太懲罰
    // 'beat-lite'：比例調低（v1.20.2 奧地利太難）
    const beatLite = !!(extras && extras.indexOf('beat-lite') >= 0);
    if (extras && (beatLite || extras.indexOf('beat') >= 0) && floor >= 5 && prevType !== 'beat') {
      if (r() < (beatLite ? 0.14 + prog * 0.08 : 0.24 + prog * 0.12)) return 'beat';
    }
    // 冰面不連續出現：兩層都滑的話，滑下去又落在冰上，玩家會覺得完全控制不了
    if (extras && extras.indexOf('ice') >= 0 && floor >= 4 && prevType !== 'ice') {
      if (r() < 0.26 + prog * 0.14) return 'ice';
    }

    // 普通平台的比例從 70% 緩降到 46%
    const normalShare = 0.70 - prog * 0.24;
    if (roll < normalShare) return 'normal';

    /*
     * ⚠️ climb 模式完全不使用塌陷平台（crumble）。
     *
     * 這座井是一條單線通路，往上爬的唯一路徑就是「一層接一層」。
     * 塌陷平台踩過就永久消失 —— 一旦塌掉，上下兩層的間距會變成
     * 兩倍層距（實測 25 層 y=472 到 27 層 y=304 = 168px），
     * 遠超過基礎跳躍高度 128px，玩家永遠上不去 = 關卡變成無解。
     *
     * descend 沒有這個問題：平台塌掉剛好幫你往下走。
     * 方向不同，同一個機制的意義就完全相反。
     */
    const useCrumble = mode !== 'climb';

    // 剩下的機率分給特殊平台
    const rest = (roll - normalShare) / (1 - normalShare);
    if (rest < 0.30) return r() < 0.5 ? 'convL' : 'convR';
    if (rest < 0.58) return useCrumble ? 'crumble' : 'normal';
    /*
     * v1.30 丹麥積木塔（蓄力跳）'charge'：沒有彈簧、尖刺 ——
     * 要站著蓄力才跳得上去，彈簧一落地就把人彈走、尖刺站不住，都會變成上不去。
     */
    const chargeOnly = !!(extras && extras.indexOf('charge') >= 0);
    if (chargeOnly) return 'normal';
    if (rest < 0.82) return 'spike';
    // 上一層已經是彈簧 → 換掉，避免兩個彈簧把玩家互丟
    if (prevType === 'spring') return useCrumble ? 'crumble' : 'normal';
    return 'spring';
  }

  /**
   * 排出整座井。
   *
   * cfg:
   *   floors      要降幾層才過關
   *   gapY        層間垂直距離
   *   platW       平台寬度
   *   shaftW      井的內部寬度
   *   scroll      [起始捲速, 結束捲速]
   *
   * 關鍵約束（playability）：
   *   相鄰兩層的水平距離必須在「一次下墜時間內跑得到」的範圍內，
   *   否則玩家只能站在原地等著被尖刺追上，無解。
   *   下墜 gapY 需時 t = sqrt(2*gapY/GRAVITY)，
   *   期間最多橫移 MAX_RUN * t，這裡取其 0.6 當安全上限。
   */
  function plan(seed, cfg) {
    const r = LevelGen.rng(seed);
    const mode = cfg.mode === 'climb' ? 'climb' : 'descend';
    const dir = mode === 'climb' ? -1 : 1;   // 樓層往哪個方向延伸
    const floors = cfg.floors || 32;
    // climb 的層距要夾在可跳上去的範圍內
    let gapY = cfg.gapY || (mode === 'climb' ? 84 : 104);
    // v1.30 丹麥積木塔（蓄力跳，最高約 216px）：上限放寬到 170
    if (mode === 'climb') gapY = Math.min(gapY, cfg.chargeJump ? 170 : MAX_CLIMB_GAP);
    const platW = cfg.platW || 104;
    const shaftW = cfg.shaftW || 560;
    const shaftX = Math.round((VIEW_W - shaftW) / 2);

    /*
     * 第一層的位置（世界座標）。
     *
     * descend：往下延伸，所以第一層在上面。要離尖刺天花板夠遠 ——
     *   玩家一進場就被刺到是最糟的開場（實測 190 時開場直接掉兩條命：
     *   玩家身高 40，站在 190 上頭頂在 150，天花板底緣在 74，
     *   相機捲幾十帧就追上來）。放 260 給約 3 秒反應時間。
     *
     * climb：往上延伸，所以第一層在下面。世界座標從一個足夠大的
     *   基準往上長，避免出現負座標（負座標本身能跑，但除錯時很難讀）。
     */
    const firstY = mode === 'climb' ? 220 + floors * gapY : 260;

    // 水平可達距離。
    // descend 用「下墜時間」算，climb 用「跳躍滯空時間」算 ——
    // 跳起來再落到同高度的滯空時間是 2·|JUMP_V|/GRAV，比單純下墜久，
    // 所以 climb 的水平可達距離其實比較寬鬆。
    const GRAV = 0.62, MAX_RUN = 4.6, JUMP_V = 12.6;
    const airFrames = mode === 'climb'
      ? (2 * JUMP_V / GRAV) * 0.5          // 上升段的時間
      : Math.sqrt(2 * gapY / GRAV);
    const reach = Math.max(120, airFrames * MAX_RUN * 0.6);

    const list = [];
    let prevX = shaftX + Math.round((shaftW - platW) / 2);

    /*
     * 相鄰兩層的水平關係 —— 兩種模式的需求完全相反：
     *
     * descend 需要「錯開」：玩家是走出平台邊緣掉下去的，
     *   上下層若幾乎重疊，站在上層就找不到縫隙往下走。
     *
     * climb 需要「重疊」：玩家是跳上去的。
     *   ⚠️ 實測 25 層(333~441) 與 26 層(227~335) 只重疊 2px，
     *   玩家得在上升的那幾帧內橫移 100px 才接得到 —— 做不到，
     *   於是在兩層之間反覆彈跳永遠上不去（卡到 20000 帧上限）。
     *   所以 climb 改成限制「最大位移」而不是「最小錯開」，
     *   保證相鄰層至少重疊 platW 的 35%。
     */
    const MIN_OFFSET = Math.round(platW * 0.55);
    const MAX_SHIFT = Math.round(platW * 0.65);

    /*
     * 產生 0 ~ floors 層，抵達層（= 第 floors 層）就是最底層。
     *
     * ⚠️ 第一版寫 `floors + 3`，在抵達層底下又多排了 3 層。
     * 後果是玩家可以直接穿過抵達層旁邊繼續往下掉 ——
     * 測試機器人因此「到第 32 層」（整座井只有 26 層）然後掉出畫面。
     * 抵達層必須是最後一層，底下是實心的井底，沒有別的路。
     */
    for (let i = 0; i <= floors; i++) {
      // dir = +1 往下長（descend）、-1 往上長（climb）
      const y = firstY + dir * i * gapY;
      let x;
      if (i === 0) {
        x = prevX;
      } else {
        /*
         * 在「可達範圍內」且「與上一層錯開足夠」的位置隨機。
         *
         * ⚠️ 只限制可達距離是不夠的 —— 隨機可能排出上下層幾乎對齊
         * （實測第 22 層 506~618 疊在第 23 層 511~623 上面，只錯開 5px）。
         * 那會讓玩家站在上層卻幾乎沒有縫隙往下走，
         * 配上彈簧更會變成彈回上層的無限循環，整關卡死。
         *
         * 作法：先算出左右兩個「錯開足夠」的候選區間，隨機挑一邊。
         * 兩邊都不可行時（井太窄）才退回原本的可達區間。
         */
        const loBound = Math.max(shaftX + 6, prevX - reach);
        const hiBound = Math.min(shaftX + shaftW - platW - 6, prevX + reach);

        if (mode === 'climb') {
          // 限制「最多偏移多少」，確保跟上一層有足夠重疊可以跳上去
          const lo = Math.max(loBound, prevX - MAX_SHIFT);
          const hi = Math.min(hiBound, prevX + MAX_SHIFT);
          x = Math.round(lo + r() * Math.max(0, hi - lo));
        } else {
          // 往左錯開：x <= prevX - MIN_OFFSET
          const leftHi = Math.min(hiBound, prevX - MIN_OFFSET);
          // 往右錯開：x >= prevX + MIN_OFFSET
          const rightLo = Math.max(loBound, prevX + MIN_OFFSET);
          const canLeft = leftHi >= loBound;
          const canRight = rightLo <= hiBound;

          if (canLeft && canRight) {
            if (r() < 0.5) x = Math.round(loBound + r() * (leftHi - loBound));
            else x = Math.round(rightLo + r() * (hiBound - rightLo));
          } else if (canLeft) {
            x = Math.round(loBound + r() * (leftHi - loBound));
          } else if (canRight) {
            x = Math.round(rightLo + r() * (hiBound - rightLo));
          } else {
            x = Math.round(loBound + r() * (hiBound - loBound));
          }
        }
      }
      prevX = x;

      /*
       * 樓層型別。
       *
       * 抵達層固定 normal。另外「抵達層前的最後一層」在 climb 模式
       * 也強制 normal ——
       * ⚠️ climb 的最後一躍是從它跳上終點。若它是 crumble（會塌），
       * 玩家踩上去還沒站穩就消失，於是在終點下方反覆掉落、
       * 永遠跳不上最後一層（實測機器人在第 26/27 層之間
       * 來回震盪到 20000 帧上限，因為兩層剛好都抽到 crumble）。
       * 下降模式沒這個問題：塌掉剛好幫你往下走。
       */
      const isGoal = i === floors;
      // 沒有追擊危險區的井（cfg.calm）：最底層是整片地面，掉下去最多回到起點，不會掉出井外
      const isBase = i === 0 && !!cfg.calm;
      const isLastStep = mode === 'climb' && i === floors - 1;
      const prevType = list.length ? list[list.length - 1].type : null;
      const type = (isGoal || isLastStep)
        ? 'normal'
        : pickType(r, i, floors, prevType, mode, cfg.extras);

      const fl = {
        floor: i,
        x: (isGoal || isBase) ? shaftX + 6 : x,
        y: y,
        w: (isGoal || isBase) ? shaftW - 12 : platW,
        h: PLAT_H,
        type: type,
        goal: isGoal
      };
      if (type === 'slide') {
        // 幅度夾在井內，不能滑進石壁
        const room = Math.min(x - (shaftX + 6), (shaftX + shaftW - 6) - (x + platW));
        fl.slideRange = Math.max(12, Math.min(SLIDE_RANGE, room));
        fl.slidePhase = r() * Math.PI * 2;
      }
      list.push(fl);
    }

    /*
     * 鐘擺：掛在指定樓層的下方空帶。支點 x 取兩層之間，
     * 讓擺錘掃過「從上層掉到下層」最可能經過的地方。
     */
    const pendulums = (cfg.pendulums || []).filter(function (k) {
      return k >= 0 && k < floors;
    }).map(function (k, n) {
      const up = list[k], dn = list[k + 1];
      const mid = ((up.x + up.w / 2) + (dn.x + dn.w / 2)) / 2;
      const lo = shaftX + 110, hi = shaftX + shaftW - 110;
      return {
        floor: k,
        px: Math.round(U.clamp(mid, lo, hi)),
        py: up.y - PEND_PIVOT,
        len: PEND_LEN,
        amp: PEND_AMP,
        r: PEND_R,
        speed: PEND_SPEED,
        phase: n * 1.7
      };
    });

    /*
     * 飛行音符（奧地利）：在上下兩層之間的空帶裡左右來回飛。
     * 跟鐘擺共用同一套判定（Shaft.pendulumPos 依 kind 分流），
     * 高度固定在空帶正中央 —— 同樣保證「站在平台上不會被打到」。
     */
    (cfg.notes || []).forEach(function (k, n) {
      if (k < 0 || k >= floors) return;
      const up = list[k];
      pendulums.push({
        kind: 'note',
        floor: k,
        px: shaftX + shaftW / 2,
        py: up.y + 33,
        range: shaftW / 2 - 40,
        len: 0, amp: 0,
        r: 12,
        speed: 0.022 + (n % 3) * 0.004,
        phase: n * 2.3
      });
    });

    /*
     * 金幣：擺在部分平台上方。
     * 不放在 spike / spring 上（引誘玩家去踩傷害平台很惡意）。
     * 冰面上可以放：滑過去順手撿是冰面的樂趣之一。
     *
     * climb 模式不放 spring 的限制可以放寬 —— 往上爬時彈簧是助力
     * 而不是陷阱，但為了程式單純還是一併跳過。
     */
    const coins = [];
    list.forEach(function (f) {
      if (f.goal || f.type === 'spike' || f.type === 'spring') return;
      if (r() > 0.55) return;
      const n = 1 + (r() < 0.35 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        coins.push({
          x: Math.round(f.x + f.w / 2 - 12 + (k === 0 ? -16 : 16)),
          y: f.y - 34
        });
      }
    });

    const goalY = firstY + dir * floors * gapY;

    /*
     * 世界座標範圍。
     *
     * 兩種模式的「井」延伸方向不同，所以 walls 不能再寫 y:0 ——
     * climb 的終點在負方向之上，石壁若從 0 開始會在玩家頭上斷掉。
     * 這裡直接算出實際用到的 y 範圍再加一個畫面的餘裕。
     */
    const topY = Math.min(firstY, goalY) - VIEW_H;
    const botY = Math.max(firstY, goalY) + VIEW_H;

    return {
      mode: mode,
      dir: dir,
      floors: floors,
      gapY: gapY,
      firstY: firstY,
      shaftX: shaftX,
      shaftW: shaftW,
      platforms: list,
      coins: coins,
      topY: topY,
      botY: botY,
      height: botY,
      // 兩側石壁（collision 用，玩家撞不出井外）
      walls: [
        { x: shaftX - WALL_W, y: topY, w: WALL_W, h: botY - topY },
        { x: shaftX + shaftW, y: topY, w: WALL_W, h: botY - topY }
      ],
      scroll: cfg.scroll || [0.95, 1.95],
      pendulums: pendulums,
      // 鐘聲加速（null = 這座井沒有）：{ every 間隔帧, dur 持續帧, boost 捲速倍率 }
      chime: cfg.chime || null,
      /*
       * calm：沒有追擊的危險區（瑞士 v1.19：有冰面就不要雪崩，玩家要求）。
       * 相機不自己捲，只跟著玩家（上下都跟）；挑戰改成冰面與尖刺 —— 滑下去就要重爬。
       */
      calm: !!cfg.calm,
      // 玩家出生在第一層上方（calm 的第一層是整片地面，出生在原本隨機位置的正上方，跟上一層對得上）
      spawn: { x: (cfg.calm ? shaftX + Math.round((shaftW - platW) / 2) + platW / 2 : list[0].x + list[0].w / 2) - 11,
               y: list[0].y - 44 },
      goalFloor: floors,
      goalY: goalY
    };
  }

  /** 滑台在第 frame 帧的 x（基準 x ± 幅度） */
  function slideX(f, frame) {
    return f.x + Math.sin(frame * SLIDE_SPEED + f.slidePhase) * f.slideRange;
  }

  /** 鐘擺在第 frame 帧的擺錘中心 */
  function pendulumPos(pd, frame) {
    if (pd.kind === 'note') {
      const s = Math.sin(frame * pd.speed + pd.phase);
      // a 拿來存「往哪飛」（畫殘影用），音符本身不轉
      return { x: pd.px + s * pd.range, y: pd.py + Math.sin(frame * 0.12 + pd.phase) * 3, a: s };
    }
    const a = Math.sin(frame * pd.speed + pd.phase) * pd.amp;
    return { x: pd.px + Math.sin(a) * pd.len, y: pd.py + Math.cos(a) * pd.len, a: a };
  }

  /**
   * 鐘聲加速：第 frame 帧的捲速倍率。
   *
   * 大笨鐘每隔 every 帧敲一次，之後 dur 帧內相機捲得比較快 ——
   * 讓這關的節奏有「平常 / 急」的起伏，而不是從頭到尾等速。
   * 前 warm 帧不敲（開場先讓玩家熟悉操作）。
   * 回傳 { boost, ringing, start }，start = 這一帧剛好開始敲。
   */
  function chimeAt(pl, frame) {
    const c = pl.chime;
    if (!c || frame < c.every) return { boost: 1, ringing: false, start: false };
    const k = frame % c.every;
    const ringing = k < c.dur;
    return { boost: ringing ? c.boost : 1, ringing: ringing, start: k === 0 };
  }

  /** 第 N 層時的捲動速度（線性加速，越接近終點越急） */
  function scrollAt(pl, floor) {
    const a = pl.scroll[0], b = pl.scroll[1];
    const k = U.clamp(floor / pl.floors, 0, 1);
    return a + (b - a) * k;
  }

  /**
   * 危險區的「致命邊緣」世界 y。
   *
   * descend：尖刺天花板的底緣 —— 玩家頭頂高過它就被刺到
   * climb  ：雪崩/水位的頂緣 —— 玩家腳底低於它就被捲進去
   */
  function hazardY(pl, camY) {
    // calm：沒有危險區 —— 放在無限遠，碰撞判定永遠不會成立
    if (pl.calm) return pl.mode === 'climb' ? Infinity : -Infinity;
    if (pl.mode === 'climb') return camY + VIEW_H - FLOOD_H;
    return camY + CEIL_TOP + CEIL_H;
  }

  /**
   * 相機的起始位置。
   *
   * descend 從 0 開始往下捲；
   * climb 要讓「第一層」出現在畫面偏下的位置，所以相機起點是
   * 第一層往上推一段 —— 玩家才看得到自己上方有樓梯可爬。
   */
  function camStart(pl, viewH) {
    if (pl.mode === 'climb') return pl.firstY + 80 - viewH;
    return 0;
  }

  /**
   * 相機能捲到的極限（到終點就停）。
   *
   * 不停的話：
   *   - 危險區會繼續逼近，把站在終點的玩家擠死
   *   - 推回修正甚至會把玩家擠穿抵達層
   *     （實際發生過：descend 時玩家 y 一路到 3432，井底只到 2894）
   */
  function camLimit(pl, viewH) {
    if (pl.mode === 'climb') {
      // 往上捲：極限是「抵達層在畫面上方一點」
      return pl.goalY - 120;
    }
    return pl.goalY + 60 - viewH;
  }

  /**
   * 相機往目標方向推進一步（把方向差異收在這裡，呼叫端不用判斷）。
   *
   * playerY 是選用參數，只有 climb 會用到 —— 見下面的說明。
   * boost 選用：捲速倍率（鐘聲加速，見 chimeAt）。
   */
  function advanceCam(pl, camY, viewH, playerY, boost) {
    const mid = camY + viewH * 0.5;
    const floor = floorAtY(pl, mid);
    const step = scrollAt(pl, floor) * (boost || 1);
    const lim = camLimit(pl, viewH);

    /*
     * calm（沒有追擊的井）：相機不自己捲，只緩追玩家 —— 上下都追。
     * 沒有雪崩，玩家滑下去要看得到自己掉到哪；下限是起始位置（再往下就是井底外面）。
     */
    if (pl.calm && playerY != null) {
      const want = playerY - viewH * 0.55;
      const lo = Math.min(lim, camStart(pl, viewH)), hi = Math.max(lim, camStart(pl, viewH));
      return U.clamp(camY + (want - camY) * 0.12, lo, hi);
    }

    if (pl.dir < 0) {
      /*
       * climb：相機往上捲，而且「玩家爬得比相機快時要跟上去」。
       *
       * 為什麼 climb 需要跟隨、descend 不需要：
       *   descend 跟隨會讓「掉出畫面底部」永遠不觸發（玩家與畫面底的
       *     距離恆定），直接毀掉一個失敗條件 —— 所以絕對不能跟。
       *   climb 的失敗條件是「被下方雪崩追到」。相機跟著玩家往上時，
       *     雪崩也一起上移，相對距離不變，失敗條件依然成立。
       *     而不跟隨的話，玩家爬快一點就衝出畫面頂端看不見自己 ——
       *     那是比較嚴重的問題。
       *
       * 取 min（更往上的那個），並且單調不回頭：爬上去的高度不會還回去。
       *
       * ⚠️ 跟隨要「緩追」而不是直接貼齊。原本 `min(camY - step, follow)`
       * 會在玩家跳過畫面 45% 線時讓相機以玩家的上升速度（約 12px/帧）
       * 硬拉上去，到跳躍頂點又瞬間停住 —— 每跳一次畫面就抽一下，
       * 玩家感受是「跳上去卡卡的」。改成每帧只補差距的 12%，
       * 相機會平順地滑上去；跳躍頂點的玩家仍在畫面內（上方留有 45% 空間）。
       */
      const follow = playerY == null ? Infinity : playerY - viewH * 0.45;
      const chase = follow < camY ? camY + (follow - camY) * 0.12 : Infinity;
      const next = Math.min(camY - step, chase);
      return Math.max(Math.min(next, camY), lim);
    }
    return Math.min(camY + step, lim);
  }

  /** 相機是否已經到底（到了就不再推進，避免把玩家擠死） */
  function camDone(pl, camY, viewH) {
    const lim = camLimit(pl, viewH);
    return pl.dir < 0 ? camY <= lim + 0.5 : camY >= lim - 0.5;
  }

  /**
   * 世界 y 對應第幾層（進度用）。
   * climb 的樓層往上長，所以要除以 -gapY。
   */
  function floorAtY(pl, y) {
    return Math.max(0, Math.round((y - pl.firstY) / (pl.dir * pl.gapY)));
  }

  return {
    TYPES: TYPES,
    plan: plan,
    scrollAt: scrollAt,
    slideX: slideX,
    pendulumPos: pendulumPos,
    beatOn: beatOn,
    beatPhase: beatPhase,
    BEAT_FRAMES: BEAT_FRAMES,
    chimeAt: chimeAt,
    hazardY: hazardY,
    camStart: camStart,
    camLimit: camLimit,
    advanceCam: advanceCam,
    camDone: camDone,
    floorAtY: floorAtY,
    VIEW_H: VIEW_H,
    CEIL_TOP: CEIL_TOP,
    CEIL_H: CEIL_H,
    FLOOD_H: FLOOD_H,
    WALL_W: WALL_W,
    PLAT_H: PLAT_H,
    MAX_CLIMB_GAP: MAX_CLIMB_GAP
  };
})();
