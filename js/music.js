'use strict';

/**
 * 背景音樂 —— 每關一首，用 WebAudio 即時合成，不需要任何音檔。
 *
 * 為什麼不用 mp3：
 *   10 首曲子的音檔動輒好幾 MB，而且要處理載入失敗、授權來源。
 *   這個遊戲的畫面全部是程式畫的，音樂用同樣的方式產生比較一致，
 *   而且整個遊戲還是維持「單一資料夾、雙擊就能玩」。
 *
 * 作法：
 *   每關給一組音階（調式）+ 和弦進行 + 節奏型。
 *   用排程器每小節往前排音符，所以不會因為分頁切換而走音
 *   （setInterval 會漂移，這裡用 AudioContext.currentTime 當時鐘）。
 *
 * 各關的曲調刻意用不同調式與配置，聽起來才會是「不同的曲子」而不是變速：
 *   西班牙 佛朗明哥感的西班牙音階（Phrygian dominant）
 *   法國   華爾滋 3/4 拍
 *   英國   小調進行曲
 *   荷蘭   魔王戰：急促的半音下行
 *   德國   大調、重拍在一三拍（啤酒節感）
 *   捷克   波希米亞風的小調舞曲
 *   奧地利 圓舞曲（3/4，但比法國明亮）
 *   瑞士   五聲音階 + 長音（山谷迴響感）
 *   義大利 大調、跳躍的塔朗泰拉節奏
 *   希臘   最終魔王：Hijaz 調式 + 不規則拍
 *
 * v1.11：西班牙、法國、英國、德國、奧地利、瑞士、義大利、烏克蘭改播該國的
 * 公共領域代表曲（見 TUNES），上面那份清單只剩其他國家適用。
 */
const Music = (function () {

  let ctx = null;          // 跟 Sfx 共用的 AudioContext（由 attach 傳入）
  let master = null;       // 音樂總音量（跟音效分開，可獨立調）
  let timer = null;        // 排程用的 setInterval
  let muted = false;
  let current = -1;        // 正在播第幾關的曲子（-1 = 沒播）
  let nextNoteTime = 0;    // 下一個音符的排程時間
  let step = 0;            // 目前走到第幾個 16 分音符
  let track = null;        // 當前曲目定義

  const LOOKAHEAD = 0.1;   // 每次排程往前看多少秒
  const TICK = 25;         // 排程器觸發間隔（毫秒）

  /** 音名轉頻率。A4 = 440Hz */
  function hz(semitonesFromA4) {
    return 440 * Math.pow(2, semitonesFromA4 / 12);
  }

  /**
   * 曲目定義。
   *
   * scale    音階（相對主音的半音數），決定「聽起來是哪個地方的音樂」
   * root     主音（相對 A4 的半音數），決定高低
   * bass     低音進行（音階上的級數，每小節一個）
   * melody   旋律樣式（音階級數；null = 休止）
   * drum     節奏樣式（1 = 重拍，0.5 = 弱拍，0 = 休止）
   * bpm      速度
   * wave     旋律的波形
   */
  const TRACKS = {
    // 荷蘭（魔王）：半音下行，緊迫
    NL: {
      bpm: 142, wave: 'sawtooth',
      root: -12,
      scale: [0, 1, 3, 5, 6, 8, 10],
      bass: [0, 0, 6, 6, 5, 5, 1, 0],
      melody: [6, 5, 4, 3, 2, 1, 0, null, 6, 5, 4, 3, 2, 1, 0, null],
      drum:   [1, 0.5, 1, 0.5, 1, 0.5, 1, 0.5, 1, 0.5, 1, 0.5, 1, 0.5, 1, 1]
    },
    // 捷克：波希米亞小調舞曲
    CZ: {
      bpm: 132, wave: 'triangle',
      root: -8,
      scale: [0, 2, 3, 5, 7, 8, 10],
      bass: [0, 3, 4, 3, 0, 5, 4, 0],
      melody: [0, 2, 3, 4, 3, 2, 0, null, 5, 4, 3, 2, 0, null, 2, null],
      drum:   [1, 0, 0.5, 0.5, 1, 0, 0.5, 0, 1, 0, 0.5, 0.5, 1, 0.5, 0, 0]
    },
    // 希臘（最終魔王）：Hijaz 調式，壓迫感
    GR: {
      bpm: 150, wave: 'sawtooth',
      root: -14,
      scale: [0, 1, 4, 5, 7, 8, 11],
      bass: [0, 0, 0, 5, 5, 4, 4, 0],
      melody: [0, 1, 2, 1, 0, null, 4, 3, 2, 1, 0, null, 2, 1, 0, null],
      drum:   [1, 0.5, 0.5, 1, 0.5, 1, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 1, 0.5, 0.5]
    },

    /*
     * 大地圖（航海）：D 多利安的水手歌，6/8 搖擺感（3+3 的重音），
     * 速度放慢、用三角波 —— 開船逛地圖是「放鬆」的時段，不能跟關卡一樣緊。
     * 旋律 32 步（兩小節一句），比關卡長，聽久了才不膩。
     */
    MAP: {
      bpm: 92, wave: 'triangle',
      root: -7,
      scale: [0, 2, 3, 5, 7, 9, 10],
      bass: [0, 0, 6, 6, 3, 3, 4, 4, 5, 5, 3, 3, 4, 4, 0, 0],
      // 64 步 = 4 小節一整句（問句 → 答句 → 展開 → 收尾），再加上編曲變奏
      melody: [0, null, 2, 4, null, 4, 5, null, 4, 2, null, 0, 2, null, null, null,
               4, null, 5, 7, null, 7, 6, null, 5, 4, null, 2, 1, null, null, null,
               7, null, 6, 5, null, 4, 5, null, 6, 7, null, 9, 8, null, 7, null,
               5, null, 4, 2, null, 4, 3, null, 2, 1, null, 1, 0, null, null, null],
      drum:   [1, 0, 0, 0.5, 0, 0, 1, 0, 0, 0.5, 0, 0, 1, 0, 0.5, 0],
      snare: [6, 14],
      soft: true
    },

    /*
     * 海上遭遇戰：E 小調、快、四拍全重音 —— 一聽就知道「打起來了」。
     */
    BATTLE: {
      bpm: 158, wave: 'square',
      root: -5,
      scale: [0, 2, 3, 5, 7, 8, 10],
      bass: [0, 0, 5, 5, 3, 3, 4, 4, 0, 0, 2, 2, 5, 5, 4, 4],
      // 64 步：主題 → 主題變形 → 上行的高潮句 → 下行收尾
      melody: [0, 0, 2, 0, 3, null, 2, 0, 4, 4, 3, 2, 3, null, 4, null,
               0, 0, 2, 0, 3, null, 5, 4, 3, 2, 1, 2, 0, null, null, null,
               4, 5, 7, null, 7, 8, 7, 5, 4, null, 5, 4, 3, null, 2, null,
               7, 7, 6, 5, 4, null, 3, 4, 5, 4, 3, 1, 0, null, 0, null],
      drum:   [1, 0, 0.5, 0, 1, 0, 0.5, 0.5, 1, 0, 0.5, 0, 1, 0.5, 1, 0.5]
    },

    // ── 東歐篇 ──
    // 波蘭：馬祖卡（3 拍、重音在第 2、3 拍），小調
    PL: {
      bpm: 128, wave: 'triangle',
      root: -8,
      scale: [0, 2, 3, 5, 7, 8, 11],
      bass: [0, 4, 0, 4, 5, 3, 4, 0],
      melody: [0, null, 2, 3, 4, null, 3, 2, 4, 5, 4, null, 2, null, 0, null,
               4, null, 5, 7, 8, null, 7, 5, 4, 3, 2, null, 4, null, null, null],
      drum:   [0.5, 0, 1, 0, 1, 0, 0.5, 0, 1, 0, 1, 0, 0.5, 0, 1, 0]
    },
    // ── 非洲篇（v1.21）──
    // 摩洛哥：Hijaz 音階（小二度＋增二度，北非與中東音樂的味道），中速、像市集裡的手鼓
    MA: {
      bpm: 112, wave: 'square',
      root: -7,
      scale: [0, 1, 4, 5, 7, 8, 10],
      bass: [0, 0, 1, 0, 0, 3, 1, 0],
      melody: [4, null, 3, 2, 1, null, 2, null, 4, 5, 4, 3, 2, null, 1, null,
               0, 1, 2, null, 4, null, 5, 4, 3, 2, 1, null, 0, null, null, null],
      drum:   [1, 0, 0.5, 1, 0, 0.5, 1, 0, 1, 0, 0.5, 1, 0, 0.5, 1, 0.5]
    },
    // ── v1.23 非洲篇補齊 ──
    // 阿爾及利亞：圖阿雷格的沙漠藍調（小調、慢而搖擺的駝步節奏）
    DZ: {
      bpm: 104, wave: 'triangle',
      root: -9,
      scale: [0, 2, 3, 5, 7, 8, 10],
      bass: [0, 0, 2, 2, 3, 3, 1, 0],
      melody: [0, null, 1, 2, null, 1, 0, null, 3, null, 2, 1, 2, null, null, null,
               4, null, 3, 2, 3, null, 2, 1, 0, 1, 2, null, 0, null, null, null],
      drum:   [1, 0, 0, 0.5, 0, 0.5, 1, 0, 0, 0.5, 0, 0.5, 1, 0, 0.5, 0]
    },
    // 突尼西亞：malouf（安達魯斯傳下來的宮廷音樂），Hijaz 但比摩洛哥輕快
    TN: {
      bpm: 124, wave: 'square',
      root: -5,
      scale: [0, 1, 4, 5, 7, 8, 10],
      bass: [0, 3, 1, 0, 0, 4, 3, 0],
      melody: [0, 1, 2, 1, 2, 4, 2, null, 5, 4, 2, 1, 2, null, 0, null,
               4, 5, 6, 5, 4, null, 2, 4, 2, 1, 0, 1, 0, null, null, null],
      drum:   [1, 0.5, 0, 1, 0, 0.5, 1, 0, 1, 0.5, 0, 1, 0.5, 0, 1, 0]
    },
    // 利比亞：沙漠古城，低音的 Phrygian（地中海與阿拉伯之間），沉穩的步伐
    LY: {
      bpm: 116, wave: 'triangle',
      root: -10,
      scale: [0, 1, 3, 5, 7, 8, 10],
      bass: [0, 0, 1, 1, 5, 5, 1, 0],
      melody: [4, null, 3, null, 2, 1, 0, null, 1, 2, 3, null, 4, null, null, null,
               6, null, 5, 4, 3, null, 4, 3, 2, 1, 2, null, 0, null, null, null],
      drum:   [1, 0, 0.5, 0, 1, 0, 0.5, 0, 1, 0, 0.5, 0.5, 1, 0, 0.5, 0]
    },
    // 埃及（最終魔王：人面獅身）：雙重和聲小調，快、壓迫，像神廟裡的戰鼓
    EG: {
      bpm: 150, wave: 'sawtooth',
      root: -13,
      scale: [0, 1, 4, 5, 7, 8, 11],
      bass: [0, 0, 1, 1, 0, 0, 4, 4],
      melody: [0, 1, 2, null, 1, 0, 6, null, 0, 1, 2, 3, 4, null, 3, null,
               4, 5, 6, 5, 4, 3, 2, null, 1, 2, 1, 0, 0, null, null, null],
      drum:   [1, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5, 1, 0.5, 0.5, 1, 1, 0.5, 1, 1]
    },
    // ── 北歐篇（v1.30）── 挪威播葛利格的〈山大王的大廳〉（見 TUNES）
    // 丹麥：明亮的大調，輕快得像港口邊的手風琴
    DK: {
      bpm: 128, wave: 'square',
      root: -3,
      scale: [0, 2, 4, 5, 7, 9, 11],
      bass: [0, 4, 5, 4, 0, 3, 4, 0],
      melody: [0, 2, 4, null, 4, 5, 4, 2, 3, null, 3, 4, 2, null, null, null,
               4, null, 5, 7, 6, 5, 4, null, 2, 3, 4, 2, 0, null, null, null],
      drum:   [1, 0, 0.5, 0, 1, 0, 0.5, 0, 1, 0, 0.5, 0, 1, 0.5, 0.5, 0]
    },
    // 瑞典：拉普蘭的冰湖，小調民謠（polska 的搖擺感），三角波像木笛
    SE: {
      bpm: 112, wave: 'triangle',
      root: -7,
      scale: [0, 2, 3, 5, 7, 8, 10],
      bass: [0, 0, 5, 5, 3, 3, 4, 4],
      melody: [4, null, 3, 2, 3, null, 4, 5, 4, null, 2, null, 0, null, null, null,
               2, 3, 4, null, 5, 4, 3, null, 2, null, 1, 2, 0, null, null, null],
      drum:   [1, 0, 0, 0.5, 0, 0, 1, 0, 0, 0.5, 0, 0, 1, 0, 0.5, 0]
    },
    // 芬蘭：極夜的雪原，Dorian 調式、慢而空靈（像芬蘭的箏 kantele），正弦波
    FI: {
      bpm: 96, wave: 'sine',
      root: -5,
      scale: [0, 2, 3, 5, 7, 9, 10],
      bass: [0, 0, 3, 3, 4, 4, 6, 4],
      melody: [0, null, 2, null, 4, null, 5, 4, 2, null, null, 3, 2, null, null, null,
               4, null, 5, 6, 7, null, 6, 4, 5, null, 3, null, 2, null, null, null],
      drum:   [0.5, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 0, 0, 0.5],
      soft: true
    },
    // 冰島（最終魔王：火巨人蘇爾特）：Phrygian、鋸齒波、快 —— 火山底下的戰鼓
    IS: {
      bpm: 152, wave: 'sawtooth',
      root: -12,
      scale: [0, 1, 3, 5, 7, 8, 10],
      bass: [0, 0, 1, 1, 0, 0, 5, 4],
      melody: [0, 1, 0, null, 3, null, 1, 0, 4, 5, 4, 3, 1, null, 0, null,
               7, null, 6, 5, 4, null, 5, 4, 3, 1, 3, 4, 0, null, null, null],
      drum:   [1, 0.5, 0, 1, 0.5, 0, 1, 0.5, 1, 0.5, 0, 1, 1, 0.5, 1, 1]
    },
    // 亞特蘭提斯（潛水，v1.23.1）：慢、空靈的 Lydian（升四級），正弦波像水裡傳來的鐘聲
    ATL: {
      bpm: 88, wave: 'sine',
      root: -3,
      scale: [0, 2, 4, 6, 7, 9, 11],
      bass: [0, 0, 3, 3, 4, 4, 1, 1],
      melody: [4, null, 6, null, 7, null, 6, 4, 2, null, null, 4, 3, null, null, null,
               7, null, 9, null, 8, 7, 6, null, 4, null, 2, 3, 0, null, null, null],
      drum:   [0.5, 0, 0, 0, 0, 0, 0.5, 0, 0.5, 0, 0, 0, 0, 0, 0, 0],
      soft: true
    },
    // 匈牙利：查爾達什（吉普賽小調，增二度），先慢後快的感覺用跳音表現
    HU: {
      bpm: 140, wave: 'sawtooth',
      root: -9,
      scale: [0, 2, 3, 6, 7, 8, 11],
      bass: [0, 0, 4, 4, 3, 3, 4, 0],
      melody: [0, 2, 3, 4, 3, 2, 3, null, 4, 5, 6, 5, 4, null, 3, null,
               7, 6, 5, 4, 3, null, 4, 3, 2, 1, 2, 3, 0, null, null, null],
      drum:   [1, 0, 0.5, 0, 1, 0, 0.5, 0.5, 1, 0, 0.5, 0, 1, 0, 1, 1]
    },
    // 斯洛伐克：山歌，大調、跳躍的五度音程（牧羊人的 fujara 長笛感）
    SK: {
      bpm: 116, wave: 'triangle',
      root: -5,
      scale: [0, 2, 4, 5, 7, 9, 10],
      bass: [0, 4, 3, 4, 0, 5, 4, 0],
      melody: [0, null, 4, null, 7, 6, 4, null, 5, 4, 2, null, 4, null, null, null,
               7, null, 9, 7, 6, null, 4, 5, 4, 2, 1, null, 0, null, null, null],
      drum:   [1, 0, 0, 0.5, 1, 0, 0.5, 0, 1, 0, 0, 0.5, 1, 0, 0.5, 0]
    },
    // 克羅埃西亞：達爾馬提亞海岸的 klapa 合唱，慢板、大調、長音
    HR: {
      bpm: 100, wave: 'sine',
      root: -7,
      scale: [0, 2, 4, 5, 7, 9, 11],
      bass: [0, 0, 5, 5, 3, 3, 4, 4],
      melody: [2, null, 4, null, 5, 4, 2, null, 0, null, 2, 4, 2, null, null, null,
               4, null, 5, null, 7, 5, 4, null, 2, 4, 1, null, 0, null, null, null],
      drum:   [1, 0, 0, 0, 0.5, 0, 0, 0, 1, 0, 0, 0, 0.5, 0, 0.5, 0],
      soft: true
    },
    // 塞爾維亞：巴爾幹銅管樂（kolo 圓舞），快、小調、密集的切分
    RS: {
      bpm: 152, wave: 'square',
      root: -7,
      scale: [0, 1, 4, 5, 7, 8, 10],
      bass: [0, 0, 5, 4, 0, 0, 4, 0],
      melody: [0, 1, 2, 1, 0, 2, 4, null, 4, 5, 4, 2, 1, 2, 0, null,
               4, 4, 5, 4, 2, 4, 1, null, 2, 1, 0, 1, 0, null, null, null],
      drum:   [1, 0.5, 0, 1, 0.5, 0, 1, 0.5, 1, 0.5, 0, 1, 0.5, 1, 0.5, 1]
    },
    // 保加利亞：不規則拍（7/8 的 rachenitsa 感，用重音位置模擬）
    BG: {
      bpm: 136, wave: 'triangle',
      root: -6,
      scale: [0, 2, 3, 5, 7, 8, 10],
      bass: [0, 0, 3, 3, 4, 4, 0, 0],
      melody: [0, 2, 3, null, 4, 3, 2, 0, 2, null, 3, 4, 5, 4, 3, null,
               4, 5, 7, null, 5, 4, 3, 2, 3, null, 2, 1, 0, null, null, null],
      drum:   [1, 0, 0.5, 1, 0, 0.5, 0, 1, 0, 0.5, 1, 0, 0.5, 0, 1, 0]
    },
    // 羅馬尼亞（魔王：吸血伯爵）：低沉的小調管風琴風，慢而壓迫
    RO: {
      bpm: 112, wave: 'sawtooth',
      root: -14,
      scale: [0, 1, 4, 5, 7, 8, 10],
      bass: [0, 0, 5, 5, 6, 6, 4, 4],
      melody: [7, null, 6, 5, 4, null, 5, null, 1, null, 2, 1, 0, null, null, null,
               4, 5, 6, 7, 8, null, 7, null, 6, 5, 4, null, 0, null, 1, null],
      drum:   [1, 0, 0, 0, 0.5, 0, 0, 0, 1, 0, 0.5, 0, 0.5, 0, 1, 0]
    }
  };

  /*
   * ── 各國代表曲（v1.11）──────────────────────────────────
   *
   * 玩家要求「抓每國具有代表性的曲子」。只能用公共領域的曲子：
   * 作曲者過世超過 70 年的古典樂、或傳統民謠。近代流行歌（例如 Despacito、
   * 希臘左巴舞曲）作曲版權還在，就算用程式重新合成旋律也是侵權，不能放。
   *
   *   西班牙   比才〈哈巴奈拉〉（歌劇《卡門》，故事在塞維亞）      Bizet 1875 歿
   *   法國     奧芬巴哈〈地獄中的奧菲斯〉康康舞曲                  Offenbach 1880 歿
   *   英國     〈綠袖子〉Greensleeves                              16 世紀英格蘭民謠
   *   德國     貝多芬〈快樂頌〉                                    Beethoven 1827 歿
   *   奧地利   小約翰・史特勞斯〈藍色多瑙河〉                      Strauss II 1899 歿
   *   瑞士     羅西尼〈威廉・泰爾〉序曲終曲（瑞士英雄的故事）      Rossini 1868 歿
   *   義大利   韋瓦第〈四季・春〉                                  Vivaldi 1741 歿
   *   烏克蘭   列昂托維奇〈Shchedryk〉（後來被改編成 Carol of the Bells）Leontovych 1921 歿
   *            ⚠️ 用的是烏克蘭原曲的頑固音型，不是 1936 年美國改編版（那個還有版權）
   *
   * 其他國家沒有「人人聽得出來、又確定是公共領域」而且我能準確寫出音符的曲子，
   * 維持原本依當地音階（佛朗明哥、查爾達什、巴爾幹⋯⋯）作的原創配樂。
   *
   * 記譜：「音名八度:長度」，長度以 16 分音符為單位（4 = 四分音符）；r = 休止。
   * 和弦：「和弦名:長度」，例 'Dm:8 A7:8'。
   * barLen = 一小節幾個 16 分音符（4/4 = 16、3/4 = 12、2/4 = 8、6/8 = 12）。
   * style = 伴奏型：waltz（蹦恰恰）／oompah（蹦恰）／habanera／six8／baroque（八分音符走低音）
   */
  const TUNES = {
    /*
     * v1.30 挪威：葛利格〈山大王的大廳〉（1875，《皮爾金》配樂，公共領域）。
     * 山妖住在挪威的山裡 —— 一句在 B 小調、一句移到屬音 F#，再整段高八度重來。
     */
    NO: {
      bpm: 138, wave: 'square', barLen: 16, style: 'oompah',
      drum: [1, 0, 0, 0, 0.5, 0, 0, 0, 1, 0, 0, 0, 0.5, 0, 0, 0],
      tune:
        'B3:2 C#4:2 D4:2 E4:2 F#4:2 D4:2 F#4:4 F4:2 C#4:2 F4:4 E4:2 C4:2 E4:4 ' +
        'B3:2 C#4:2 D4:2 E4:2 F#4:2 D4:2 F#4:2 B4:2 A4:2 F#4:2 D4:2 F#4:2 A4:8 ' +
        'F#4:2 G#4:2 A#4:2 B4:2 C#5:2 A#4:2 C#5:4 D5:2 A#4:2 D5:4 C#5:2 A#4:2 C#5:4 ' +
        'F#4:2 G#4:2 A#4:2 B4:2 C#5:2 A#4:2 C#5:2 F#5:2 E5:2 C#5:2 A#4:2 C#5:2 E5:8 ' +
        'B4:2 C#5:2 D5:2 E5:2 F#5:2 D5:2 F#5:4 F5:2 C#5:2 F5:4 E5:2 C5:2 E5:4 ' +
        'B4:2 C#5:2 D5:2 E5:2 F#5:2 D5:2 F#5:2 B5:2 A5:2 F#5:2 D5:2 F#5:2 A5:8 ' +
        'F#4:2 G#4:2 A#4:2 B4:2 C#5:2 A#4:2 C#5:4 D5:2 A#4:2 D5:4 C#5:2 A#4:2 C#5:4 ' +
        'F#4:2 G#4:2 A#4:2 B4:2 C#5:2 A#4:2 C#5:2 F#5:2 E5:2 C#5:2 A#4:2 C#5:2 B4:8',
      chords:
        'Bm:16 C#7:8 C:8 Bm:16 D:16 F#:16 F#7:16 F#:16 F#7:16 ' +
        'Bm:16 C#7:8 C:8 Bm:16 D:16 F#:16 F#7:16 F#7:16 Bm:16'
    },
    ES: {
      bpm: 100, wave: 'square', barLen: 8, style: 'habanera',
      drum: [1, 0, 0, 0.6, 0.8, 0, 0.6, 0],
      tune:
        'r:8 r:8 ' +
        'D5:3 C#5:1 C5:2 B4:2 Bb4:3 A4:1 Ab4:2 G4:2 F4:2 G4:1 F4:1 E4:2 F4:2 G4:2 F4:1 E4:1 D4:4 ' +
        'D5:3 C#5:1 C5:2 B4:2 Bb4:3 A4:1 Ab4:2 G4:2 F4:2 G4:1 A4:1 Bb4:2 A4:2 A4:6 r:2 ' +
        'D5:3 C#5:1 C5:2 B4:2 Bb4:3 A4:1 Ab4:2 G4:2 F#4:2 G4:1 F#4:1 E4:2 F#4:2 G4:2 F#4:1 E4:1 D4:4 ' +
        'D5:3 C#5:1 C5:2 B4:2 Bb4:3 A4:1 Ab4:2 G4:2 F#4:2 G4:1 A4:1 B4:2 A4:2 D5:6 r:2',
      chords:
        'Dm:16 ' +
        'Dm:8 A7:8 A7:8 Dm:8 Dm:8 A7:8 A7:8 A7:8 ' +
        'D:8 A7:8 A7:8 D:8 D:8 A7:8 A7:8 D:8'
    },
    FR: {
      bpm: 168, wave: 'square', barLen: 8, style: 'oompah',
      drum: [1, 0, 0.5, 0, 1, 0, 0.5, 0],
      tune:
        'r:4 C5:4 ' +
        'D5:2 F5:2 E5:2 D5:2 G5:4 G5:4 G5:2 A5:2 E5:2 F5:2 D5:4 D5:4 ' +
        'D5:2 F5:2 E5:2 D5:2 C5:2 C6:2 B5:2 A5:2 G5:2 F5:2 E5:2 D5:2 r:4 C5:4 ' +
        'D5:2 F5:2 E5:2 D5:2 G5:4 G5:4 G5:2 A5:2 E5:2 F5:2 D5:4 D5:4 ' +
        'D5:2 G5:2 E5:2 F5:2 D5:2 G5:2 B4:2 D5:2 C5:4 C5:4 r:8',
      chords:
        'C:8 G7:8 C:8 C:8 G7:8 G7:8 C:8 G7:8 C:8 ' +
        'G7:8 C:8 C:8 G7:8 G7:8 G7:8 C:8 C:8'
    },
    GB: {
      bpm: 104, wave: 'triangle', barLen: 12, style: 'six8',
      drum: [1, 0, 0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0],
      snare: [6],
      tune:
        'r:10 A4:2 ' +
        'C5:4 D5:2 E5:3 F5:1 E5:2 D5:4 B4:2 G4:3 A4:1 B4:2 C5:4 A4:2 A4:3 G#4:1 A4:2 B4:4 G#4:2 E4:4 A4:2 ' +
        'C5:4 D5:2 E5:3 F5:1 E5:2 D5:4 B4:2 G4:3 A4:1 B4:2 C5:3 B4:1 A4:2 G#4:3 F#4:1 G#4:2 A4:12 ' +
        'G5:6 G5:3 F#5:1 E5:2 D5:4 B4:2 G4:3 A4:1 B4:2 C5:4 A4:2 A4:3 G#4:1 A4:2 B4:4 G#4:2 E4:6 ' +
        'G5:6 G5:3 F#5:1 E5:2 D5:4 B4:2 G4:3 A4:1 B4:2 C5:3 B4:1 A4:2 G#4:3 F#4:1 G#4:2 A4:12',
      chords:
        'Am:12 Am:12 G:12 Am:12 E:12 Am:12 G:12 Am:6 E:6 Am:12 ' +
        'C:12 G:12 Am:12 E:12 C:12 G:12 Am:6 E:6 Am:12'
    },
    DE: {
      bpm: 126, wave: 'square', barLen: 16, style: 'oompah',
      drum: [1, 0, 0, 0, 0.5, 0, 0, 0, 1, 0, 0, 0, 0.5, 0, 0, 0],
      tune:
        'E5:4 E5:4 F5:4 G5:4 G5:4 F5:4 E5:4 D5:4 C5:4 C5:4 D5:4 E5:4 E5:6 D5:2 D5:8 ' +
        'E5:4 E5:4 F5:4 G5:4 G5:4 F5:4 E5:4 D5:4 C5:4 C5:4 D5:4 E5:4 D5:6 C5:2 C5:8 ' +
        'D5:4 D5:4 E5:4 C5:4 D5:4 E5:2 F5:2 E5:4 C5:4 D5:4 E5:2 F5:2 E5:4 D5:4 C5:4 D5:4 G4:8 ' +
        'E5:4 E5:4 F5:4 G5:4 G5:4 F5:4 E5:4 D5:4 C5:4 C5:4 D5:4 E5:4 D5:6 C5:2 C5:8',
      chords:
        'C:16 G:16 C:16 G:16 C:16 G:16 C:16 G:8 C:8 ' +
        'G:16 C:8 G:8 C:8 G:8 C:8 G:8 C:16 G:16 C:16 G:8 C:8'
    },
    AT: {
      bpm: 168, wave: 'triangle', barLen: 12, style: 'waltz',
      drum: [1, 0, 0, 0, 0.4, 0, 0, 0, 0.4, 0, 0, 0],
      tune:
        'D4:4 D4:4 F#4:4 A4:12 r:4 A5:4 A5:4 r:4 F#5:4 F#5:4 ' +
        'D4:4 D4:4 F#4:4 A4:12 r:4 A5:4 A5:4 r:4 G5:4 G5:4 ' +
        'C#4:4 C#4:4 E4:4 B4:12 r:4 B5:4 B5:4 r:4 G5:4 G5:4 ' +
        'C#4:4 C#4:4 E4:4 B4:12 r:4 B5:4 B5:4 r:4 F#5:4 F#5:4 ' +
        'D4:4 D4:4 F#4:4 A4:12 r:4 D6:4 D6:4 r:4 A5:4 A5:4 ' +
        'D4:4 D4:4 F#4:4 A4:12 r:4 D6:4 D6:4 r:4 B5:4 B5:4 ' +
        'E4:4 E4:4 G4:4 B4:12 r:4 B5:4 B5:4 r:4 G5:4 G5:4 ' +
        'A4:4 A4:4 C#5:4 E5:12 F#5:4 E5:4 C#5:4 D5:12',
      chords:
        'D:12 D:12 D:12 D:12 D:12 D:12 D:12 A7:12 ' +
        'A7:12 A7:12 A7:12 A7:12 A7:12 A7:12 A7:12 D:12 ' +
        'D:12 D:12 D:12 D:12 D:12 D:12 G:12 G:12 ' +
        'Em:12 Em:12 Em:12 Em:12 A7:12 A7:12 A7:12 D:12'
    },
    CH: {
      bpm: 152, wave: 'square', barLen: 8, style: 'oompah',
      drum: [1, 0, 0.5, 0, 1, 0, 0.5, 0.5],
      tune:
        'B4:1 B4:1 B4:2 B4:1 B4:1 B4:2 B4:1 B4:1 E5:2 F#5:2 G#5:2 ' +
        'B4:1 B4:1 B4:2 B4:1 B4:1 B4:2 B4:1 B4:1 G#5:2 F#5:2 D#5:2 ' +
        'B4:1 B4:1 B4:2 B4:1 B4:1 B4:2 B4:1 B4:1 E5:2 F#5:2 G#5:2 ' +
        'E5:2 G#5:2 B5:2 G#5:2 F#5:2 D#5:2 E5:4 ' +
        'E5:1 E5:1 E5:2 F#5:1 F#5:1 F#5:2 G#5:1 G#5:1 G#5:2 A5:1 A5:1 A5:2 B5:2 G#5:2 E5:2 G#5:2 F#5:4 B4:4 ' +
        'E5:1 E5:1 E5:2 F#5:1 F#5:1 F#5:2 G#5:1 G#5:1 G#5:2 A5:1 A5:1 A5:2 B5:2 A5:2 G#5:2 F#5:2 E5:4 r:4',
      chords:
        'E:8 E:8 E:8 B7:8 E:8 E:8 E:8 B7:4 E:4 ' +
        'E:8 A:8 E:8 B7:8 E:8 A:8 B7:8 E:8'
    },
    IT: {
      bpm: 132, wave: 'sawtooth', barLen: 16, style: 'baroque',
      drum: [1, 0, 0, 0, 0.6, 0, 0, 0, 1, 0, 0, 0, 0.6, 0, 0.4, 0],
      tune:
        'r:14 E5:2 ' +
        'G#5:2 G#5:2 G#5:2 F#5:1 E5:1 B5:6 B5:1 A5:1 G#5:2 G#5:2 G#5:2 F#5:1 E5:1 B5:6 B5:1 A5:1 ' +
        'G#5:2 A5:1 B5:1 A5:2 G#5:2 F#5:4 r:2 B4:2 G#5:2 A5:1 B5:1 A5:2 G#5:2 F#5:4 r:2 E5:2 ' +
        'G#5:2 G#5:2 G#5:2 F#5:1 E5:1 B5:6 B5:1 A5:1 G#5:2 G#5:2 G#5:2 F#5:1 E5:1 B5:6 B5:1 A5:1 ' +
        'G#5:2 A5:1 B5:1 A5:2 G#5:2 F#5:4 r:2 B4:2 G#5:2 A5:1 B5:1 A5:2 G#5:2 F#5:4 E5:4 ' +
        'B5:2 A5:1 G#5:1 A5:2 B5:2 C#6:4 B5:4 A5:2 G#5:1 F#5:1 G#5:2 A5:2 B5:4 A5:4 ' +
        'G#5:2 F#5:1 E5:1 F#5:2 G#5:2 A5:4 G#5:4 F#5:4 D#5:4 E5:8',
      chords:
        'E:16 E:16 E:16 E:8 B7:8 E:8 B7:8 E:16 E:16 E:8 B7:8 E:8 B7:8 ' +
        'E:8 A:8 A:8 E:8 E:8 A:8 B7:8 E:8'
    },
    UA: {
      bpm: 168, wave: 'sawtooth', barLen: 12, style: 'waltz',
      drum: [1, 0, 0, 0, 0.6, 0, 0.4, 0, 0.6, 0, 0, 0],
      snare: [4, 8],
      tune:
        'Bb4:4 A4:2 Bb4:2 G4:4 Bb4:4 A4:2 Bb4:2 G4:4 Bb4:4 A4:2 Bb4:2 G4:4 Bb4:4 A4:2 Bb4:2 G4:4 ' +
        'Bb4:4 A4:2 Bb4:2 G4:4 Bb4:4 A4:2 Bb4:2 G4:4 Bb4:4 A4:2 Bb4:2 G4:4 Bb4:4 A4:2 Bb4:2 G4:4 ' +
        'D5:4 C5:2 D5:2 Bb4:4 D5:4 C5:2 D5:2 Bb4:4 D5:4 C5:2 D5:2 Bb4:4 D5:4 C5:2 D5:2 Bb4:4 ' +
        'C5:4 Bb4:2 C5:2 A4:4 C5:4 Bb4:2 C5:2 A4:4 G5:4 F5:4 Eb5:4 D5:4 C5:4 Bb4:4 ' +
        'G5:6 F5:6 Eb5:6 D5:6 C5:6 Bb4:6 A4:6 D5:6 ' +
        'Bb4:4 A4:2 Bb4:2 G4:4 Bb4:4 A4:2 Bb4:2 G4:4 Bb4:4 A4:2 Bb4:2 G4:4 G4:12',
      chords:
        'Gm:12 Gm:12 Gm:12 Gm:12 Gm:12 Gm:12 Gm:12 Gm:12 ' +
        'Gm:12 Gm:12 Gm:12 Gm:12 F:12 F:12 Cm:12 Gm:12 ' +
        'Gm:12 Cm:12 Gm:12 D7:12 Gm:12 Gm:12 Gm:12 Gm:12'
    }
  };

  // ── 記譜解析 ──
  const NOTE_IDX = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  /** 'C#5' → 相對 A4 的半音數 */
  function noteSemis(name) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
    if (!m) throw new Error('看不懂的音名 ' + name);
    return NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) - 4) * 12;
  }
  const CHORD_Q = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10] };
  /** 'C#m' → { root: 第 3 八度的根音半音數, tones: [...] } */
  function parseChord(name) {
    const m = /^([A-G])(#|b)?(m7|m|7)?$/.exec(name);
    if (!m) throw new Error('看不懂的和弦 ' + name);
    const root = NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) - 12;
    return { root: root, tones: CHORD_Q[m[3] || ''] };
  }
  /**
   * 把字串譜展開成「每個 16 分音符一格」的陣列：
   *   mel[i] = { semi, dur }（音頭）或 undefined（延音／休止）
   *   chd[i] = { root, tones, start }（每格都有，start = 這個和弦從第幾格開始）
   */
  function compileTune(tk) {
    const mel = [];
    let len = 0;
    tk.tune.trim().split(/\s+/).forEach(function (tok) {
      const p = tok.split(':');
      const dur = parseInt(p[1], 10);
      if (p[0] !== 'r') mel[len] = { semi: noteSemis(p[0]), dur: dur };
      len += dur;
    });
    const bars = Math.ceil(len / tk.barLen);
    len = bars * tk.barLen;
    const chd = [];
    let at = 0;
    tk.chords.trim().split(/\s+/).forEach(function (tok) {
      const p = tok.split(':');
      const c = parseChord(p[0]);
      const dur = parseInt(p[1], 10);
      for (let k = 0; k < dur; k++) chd[at + k] = { root: c.root, tones: c.tones, start: at };
      at += dur;
    });
    // 和弦寫得比旋律短：最後一個和弦延長到底
    for (let i = at; i < len; i++) chd[i] = chd[at - 1];
    tk._mel = mel; tk._chd = chd; tk._len = len;
    return tk;
  }
  Object.keys(TUNES).forEach(function (k) { TRACKS[k] = compileTune(TUNES[k]); });

  /*
   * ── 編曲 ──────────────────────────────────────────────
   *
   * 舊版每關只有「一小節旋律 + 低音 + 大鼓」無限重複，
   * 十幾秒就聽完了，之後全是同一段 —— 這就是「很單調」的原因。
   *
   * 現在用同一份曲目資料自動編出一首 16 小節的曲子（約 30~40 秒才循環一次）：
   *
   *   小節  0-3   A   主旋律，只有大鼓 + 低音（開場，留空間）
   *         4-7   A'  主旋律 + 三度和聲 + 琶音 + 小鼓/鈸
   *         8-11  B   旋律移高（依低音級數變奏）+ 和弦墊底 + 琶音換型
   *         12-13 A"  主旋律高八度 + 全部樂器
   *         14    斷奏  只剩低音與和弦，旋律前半句（喘口氣）
   *         15    過門  鼓的填充（連打）把人帶回 A
   *
   * 每一層都是從 scale / bass / melody 推出來的，所以各國的調式特色保留，
   * 但聽起來有起承轉合，不再是同一段跳針。
   * 主旋律另外送進一條延遲線（迴聲），聽起來比較有空間感。
   */
  /*
   * v1.4：16 小節還是太短 —— 主旋律只有 1~2 小節，在一首裡被原樣播了 8~16 次，
   * 聽起來就是同一句一直跳針（地圖曲與遭遇戰最明顯，因為停留最久）。
   *
   * 改成 32 小節，而且旋律「每小節都會發展」（見 developMelody）：
   *   A   0-3    主題 → 模進（往上移）→ 逆行 → 收尾句
   *   A2  4-7    同上 + 三度和聲 + 琶音 + 小鼓
   *   B   8-11   換一句：主題倒影（上下顛倒）+ 和弦墊底
   *   C   12-15  轉調到下屬調（+5 半音）的新段落，逆行倒影
   *   A2  16-19
   *   B   20-23
   *   A3  24-29  高八度高潮
   *   BRK 30     斷奏
   *   FILL 31    鼓的過門
   * 一輪約 60~80 秒才回到開頭，而且每 4 小節的句型都不一樣。
   */
  const FORM = ['A', 'A', 'A', 'A', 'A2', 'A2', 'A2', 'A2',
                'B', 'B', 'B', 'B', 'C', 'C', 'C', 'C',
                'A2', 'A2', 'A2', 'A2', 'B', 'B', 'B', 'B',
                'A3', 'A3', 'A3', 'A3', 'A3', 'A3', 'BRK', 'FILL'];

  /** 主旋律的「中心音」（倒影的軸），取原旋律的平均級數 */
  function melodyCenter(mel) {
    let s = 0, n = 0;
    mel.forEach(function (d) { if (d != null) { s += d; n++; } });
    return n ? Math.round(s / n) : 2;
  }

  /**
   * 旋律發展：同一份主題，依「這是句子裡的第幾小節」與「哪個段落」變形。
   *
   *   句中第 0 小節：原樣（讓人記住主題）
   *   第 1 小節：模進 —— 整句往上移 1~2 級（同樣的形狀、不同的高度）
   *   第 2 小節：逆行 —— 倒過來唱
   *   第 3 小節：收尾 —— 前半原樣，後半走回主音（句子有「結束感」）
   *   B 段：倒影（以中心音為軸上下顛倒）
   *   C 段：逆行 + 倒影
   *
   * 主題本身若比一小節長（地圖曲、遭遇戰是 4 小節），就照它自己的長度走，
   * 變形只套在它的每一小節上。
   */
  function developMelody(s, sec) {
    const mel = track.melody;
    const L = mel.length;
    const bar = Math.floor(s / 16);
    const inBar = s % 16;
    const phraseBar = bar % 4;
    const center = track._center != null ? track._center : (track._center = melodyCenter(mel));

    let idx = s % L;
    let d;
    if (sec === 'C' || phraseBar === 2) {
      // 逆行：在這一小節內倒著走
      const barStart = idx - inBar;
      idx = barStart + (15 - inBar);
      if (idx < 0) idx += L;
      idx = idx % L;
    }
    d = mel[idx];
    if (d == null) return null;

    if (sec === 'B' || sec === 'C') d = center * 2 - d;          // 倒影
    if (phraseBar === 1) d += (bar % 8 < 4 ? 1 : 2);              // 模進
    if (phraseBar === 3 && inBar >= 8) {
      // 收尾：後半小節一步步走回主音，最後一拍停在主音上
      const tail = [2, null, 1, null, 0, null, null, null];
      d = tail[inBar - 8];
      if (d == null) return null;
    }
    return d;
  }

  /** 從音階取第 n 級的半音數（可超出一個八度） */
  function degreeToSemis(scale, deg) {
    const n = scale.length;
    const oct = Math.floor(deg / n);
    const idx = ((deg % n) + n) % n;
    return scale[idx] + oct * 12;
  }

  let echo = null;         // 主旋律的延遲線（迴聲）入口
  let echoDelay = null;
  let noiseBuf = null;     // 小鼓/鈸用的白噪音

  function attach(audioCtx) {
    ctx = audioCtx;
    if (!ctx) return;
    master = ctx.createGain();
    master.gain.value = 0.055;      // 背景音樂要明顯比音效小
    master.connect(ctx.destination);

    // 迴聲：延遲 + 衰減回授，只接主旋律
    echo = ctx.createGain();
    echo.gain.value = 0.32;
    echoDelay = ctx.createDelay(1.5);
    echoDelay.delayTime.value = 0.3;
    const fb = ctx.createGain();
    fb.gain.value = 0.3;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2200;     // 迴聲悶一點，才不會跟原音搶
    echo.connect(echoDelay);
    echoDelay.connect(tone);
    tone.connect(fb);
    fb.connect(echoDelay);
    tone.connect(master);

    // 一秒的白噪音，小鼓與鈸共用
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  /** 排一個音符。send = 也送進迴聲 */
  function note(freq, at, dur, wave, gain, send) {
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(master);
    if (send && echo) g.connect(echo);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  /** 和弦墊底：柔和的長音，攻擊慢、收尾慢 */
  function pad(freq, at, dur, gain) {
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  /** 噪音打擊：kind 'snare'（中頻、較長）或 'hat'（高頻、很短） */
  function noise(at, kind, strength) {
    if (!ctx || !master || !noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const snare = kind === 'snare';
    f.type = snare ? 'bandpass' : 'highpass';
    f.frequency.value = snare ? 1800 : 7000;
    const dur = snare ? 0.14 : 0.04;
    const peak = (snare ? 0.32 : 0.12) * strength;
    g.gain.setValueAtTime(peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(master);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.02);
  }

  /** 低頻打擊（當鼓用） */
  function hit(at, strength) {
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, at);
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.1);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.5 * strength, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
    osc.connect(g).connect(master);
    osc.start(at);
    osc.stop(at + 0.16);
  }

  /** 某一步所在段落（見 FORM） */
  function sectionAt(s) {
    return FORM[Math.floor(s / 16) % FORM.length];
  }

  /** 某一步的低音級數（每半小節換一次） */
  function bassDegAt(s) {
    return track.bass[Math.floor(s / 8) % track.bass.length];
  }

  /*
   * ── 代表曲的編曲 ──
   *
   * 旋律一個音都不改（改了就聽不出是哪首），變化全放在編曲上，一輪四遍：
   *   第 1 遍 A   旋律 + 低音 + 大鼓（開場，讓人先認出曲子）
   *   第 2 遍 A2  加和聲（旋律下方的和弦音）+ 琶音 + 小鼓、鈸
   *   第 3 遍 A3  旋律高八度 + 和弦墊底，全部樂器（高潮）
   *   第 4 遍 B   柔和間奏：旋律改成正弦波、鼓變輕、和弦墊底（喘口氣再回到開頭）
   */
  const TUNE_SECTIONS = ['A', 'A2', 'A3', 'B'];

  function tuneSection(s) { return TUNE_SECTIONS[Math.floor(s / track._len) % 4]; }

  function chordFreqs(ch, octave) {
    return ch.tones.map(function (k) { return hz(ch.root + 12 * octave + k); });
  }

  function scheduleTune(s, at) {
    const sixteenth = 60 / track.bpm / 4;
    const L = track._len, i = s % L, bl = track.barLen;
    const inBar = i % bl;
    const sec = tuneSection(s);
    const ch = track._chd[i];
    const lastBar = i >= L - bl;

    // ── 主旋律 ──
    const ev = track._mel[i];
    if (ev) {
      const oct = sec === 'A3' ? 12 : 0;
      const dur = sixteenth * Math.max(1.1, ev.dur * 0.92);
      const soft = sec === 'B';
      note(hz(ev.semi + oct), at, dur, soft ? 'sine' : track.wave, soft ? 0.42 : (track.wave === 'sawtooth' ? 0.36 : 0.46), true);
      // 和聲：旋律下方最近的和弦音（至少差小三度）
      if (sec === 'A2' || sec === 'A3') {
        let best = null;
        for (let o = -1; o <= 2; o++) {
          ch.tones.forEach(function (k) {
            const t = ch.root + 12 * o + k;
            if (t <= ev.semi - 3 && (best == null || t > best)) best = t;
          });
        }
        if (best != null) note(hz(best + oct), at, dur, 'triangle', 0.2);
      }
    }

    // ── 伴奏型 ──
    const root = ch.root - 12;                     // 低音在第 2 八度
    const fifth = root + ch.tones[2];
    const stab = function (g) {
      chordFreqs(ch, 1).forEach(function (f) { note(f, at, sixteenth * 1.6, 'triangle', g); });
    };
    const bass = function (semi, len, g) { note(hz(semi), at, sixteenth * len, 'triangle', g); };
    switch (track.style) {
      case 'waltz':        // 蹦—恰—恰
        if (inBar === 0) bass(root, 3.6, 0.85);
        else if (inBar === 4 || inBar === 8) stab(sec === 'A' ? 0.07 : 0.1);
        break;
      case 'habanera':     // 附點八分 + 十六分 + 兩個八分
        if (inBar === 0) bass(root, 2.8, 0.85);
        else if (inBar === 3) bass(root, 0.9, 0.6);
        else if (inBar === 4 || inBar === 6) bass(fifth, 1.8, 0.65);
        break;
      case 'six8':         // 6/8：每個附點四分一下低音，中間撥和弦
        if (inBar === 0 || inBar === 6) bass(inBar === 0 ? root : fifth, 5, 0.8);
        else if (sec !== 'A' && (inBar === 2 || inBar === 4 || inBar === 8 || inBar === 10)) stab(0.06);
        break;
      case 'baroque':      // 八分音符的走動低音：根-五-八度-五
        if (i % 2 === 0) {
          const walk = [root, fifth, root + 12, fifth][(i / 2) % 4];
          bass(walk, 1.8, 0.62);
        }
        break;
      default:             // oompah：蹦—恰。低音在根音與五度之間輪流
        if (inBar % 4 === 0) {
          const beat = inBar / 4 + Math.floor(i / bl) * (bl / 4);
          if (beat % 2 === 0) bass(beat % 4 === 0 ? root : fifth, 3.5, 0.8);
          else stab(sec === 'A' ? 0.06 : 0.09);
        }
        break;
    }

    // ── 琶音（A2、A3）：和弦音每兩格往上跑 ──
    if ((sec === 'A2' || sec === 'A3') && i % 2 === 0) {
      const fs = chordFreqs(ch, 1);
      const order = [0, 1, 2, 1];
      note(fs[order[(i / 2) % 4] % fs.length] * 2, at, sixteenth * 0.9, 'triangle', 0.1);
    }

    // ── 和弦墊底（A3、B）：換和弦時鋪一層 ──
    if ((sec === 'A3' || sec === 'B') && ch.start === i) {
      let n = 1;
      while (i + n < L && track._chd[i + n].start === i) n++;
      chordFreqs(ch, 1).forEach(function (f) { pad(f, at, sixteenth * n, 0.08); });
    }

    // ── 鼓 ──
    const dr = track.drum[inBar] || 0;
    if (lastBar && sec === 'B' && inBar >= bl / 2) {
      // 一輪結束前的過門，把人帶回第 1 遍
      hit(at, 0.5 + (inBar - bl / 2) / bl);
      noise(at, 'snare', 0.5);
    } else if (dr > 0) {
      hit(at, sec === 'B' ? dr * 0.45 : dr);
    }
    if (sec === 'A2' || sec === 'A3') {
      const snares = track.snare || [bl / 2];
      if (snares.indexOf(inBar) >= 0) noise(at, 'snare', 0.8);
      if (inBar % 2 === 0) noise(at, 'hat', inBar % 4 === 2 ? 0.9 : 0.5);
    }
  }

  /** 把第 step 個 16 分音符排進時間軸 */
  function scheduleStep(s, at) {
    if (track.tune) { scheduleTune(s, at); return; }
    const sixteenth = 60 / track.bpm / 4;
    const sec = sectionAt(s);
    const inBar = s % 16;
    const soft = !!track.soft;
    const bassDeg = bassDegAt(s);

    // C 段轉到下屬調（+5 半音）：所有聲部一起移，聽起來是「換了個地方」
    const key = track.root + (sec === 'C' ? 5 : 0);

    // ── 主旋律 ──
    let deg = developMelody(s, sec);
    // 斷奏小節只留前半句
    if (sec === 'BRK' && inBar >= 8) deg = null;
    if (sec === 'FILL') deg = null;
    if (deg != null) {
      const d = deg;
      // A" 段：高八度，是整首最亮的地方
      const oct = sec === 'A3' ? 24 : 12;
      const f = hz(key + oct + degreeToSemis(track.scale, d));
      note(f, at, sixteenth * 2.2, track.wave, soft ? 0.42 : 0.5, true);
      // 三度和聲（A'、A"、C）
      if (sec === 'A2' || sec === 'A3' || sec === 'C') {
        const hf = hz(key + oct + degreeToSemis(track.scale, d - 2));
        note(hf, at, sixteenth * 2, 'triangle', 0.22);
      }
    } else if (sec === 'A2' && inBar % 4 === 2) {
      // 主旋律休止時偶爾補一個經過音（低音量），填掉旋律的空洞
      const pf = hz(key + 12 + degreeToSemis(track.scale, bassDeg + 4));
      note(pf, at, sixteenth * 1.2, 'sine', 0.16);
    }

    // ── 低音：每半小節換一次；A' 以後加八分音符的跳動 ──
    if (s % 8 === 0) {
      const bf = hz(key - 12 + degreeToSemis(track.scale, bassDeg));
      note(bf, at, sixteenth * (sec === 'A' || sec === 'BRK' ? 7 : 3.5), 'triangle', 0.85);
    } else if (s % 8 === 4 && sec !== 'A' && sec !== 'BRK') {
      const bf = hz(key - 12 + degreeToSemis(track.scale, bassDeg + 4));
      note(bf, at, sixteenth * 3, 'triangle', 0.6);
    }

    // ── 和弦墊底（B、A"、斷奏）：低音級數上的三和弦 ──
    if (s % 8 === 0 && (sec === 'B' || sec === 'A3' || sec === 'BRK')) {
      [0, 2, 4].forEach(function (k) {
        pad(hz(key + degreeToSemis(track.scale, bassDeg + k)), at, sixteenth * 8, 0.09);
      });
    }

    // ── 琶音（A'、B、A"）：和弦音上下跑，B 段換成跳進的型 ──
    if (sec === 'A2' || sec === 'B' || sec === 'A3') {
      const shape = sec === 'B' ? [0, 4, 2, 4, 7, 4, 2, 4] : [0, 2, 4, 2];
      const every = soft ? 2 : 1;             // 慢歌的琶音只走八分音符
      if (s % every === 0) {
        const k = shape[(s / every) % shape.length | 0];
        const af = hz(key + 12 + degreeToSemis(track.scale, bassDeg + k));
        note(af, at, sixteenth * 0.9, soft ? 'sine' : 'triangle', 0.14);
      }
    }

    // ── 鼓 ──
    const dr = track.drum[s % track.drum.length];
    if (sec === 'FILL') {
      // 過門：後半小節連打，越打越密
      if (inBar < 8) { if (dr > 0) hit(at, dr); }
      else { hit(at, 0.5 + (inBar - 8) / 16); noise(at, 'snare', 0.4 + (inBar - 8) / 14); }
    } else if (dr > 0) {
      hit(at, sec === 'BRK' ? dr * 0.5 : dr);
    }
    if (sec !== 'A' && sec !== 'BRK' && sec !== 'FILL') {
      const snares = track.snare || [4, 12];
      if (snares.indexOf(inBar) >= 0) noise(at, 'snare', soft ? 0.5 : 1);
      if (inBar % 2 === 0) noise(at, 'hat', inBar % 4 === 2 ? 1 : 0.55);
    }
  }

  function scheduler() {
    if (!ctx || !track) return;
    const sixteenth = 60 / track.bpm / 4;
    while (nextNoteTime < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(step, nextNoteTime);
      nextNoteTime += sixteenth;
      step++;
    }
  }

  /**
   * 播某一首曲子（key = 國家 id 或 'MAP' / 'BATTLE'）。
   * 同一首重複呼叫不會重新開始 —— 地圖 ↔ 商店 ↔ 裝備畫面切來切去時，
   * 音樂要一路接著播，不能每切一次就從頭。
   */
  let currentKey = null;
  function playTrack(key) {
    const tk = TRACKS[key];
    if (!tk) return;
    if (!ctx || muted) { currentKey = key; return; }
    if (currentKey === key && timer) return;   // 已經在播同一首

    stop();
    track = tk;
    currentKey = key;
    step = 0;
    nextNoteTime = ctx.currentTime + 0.06;
    timer = setInterval(scheduler, TICK);
  }

  /** 開始播某一關的曲子。同一關重複呼叫不會重新開始。 */
  function playForLevel(levelIndex) {
    const lv = Levels.list[levelIndex];
    if (!lv) return;
    playTrack(lv.id);
    current = levelIndex;
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    track = null;
    current = -1;
    currentKey = null;
  }

  function setMuted(m) {
    muted = m;
    if (muted) stop();
  }

  return {
    attach: attach,
    playForLevel: playForLevel,
    playTrack: playTrack,
    /**
     * 測試用：分析一首曲子一輪裡「有幾種不同的旋律小節」與一輪多長。
     * 用來防止旋律又退化成同一句跳針（tests/music-check.js）。
     */
    analyze: function (key) {
      const saved = track;
      track = TRACKS[key];
      const bars = {};
      if (track.tune) {
        // 代表曲：一輪 = 4 遍（每遍編曲不同），旋律小節加上段落標記一起算
        const bl = track.barLen, L = track._len;
        for (let s0 = 0; s0 < L * 4; s0 += bl) {
          const sec = tuneSection(s0);
          const notes = [];
          for (let k = 0; k < bl; k++) {
            const ev = track._mel[(s0 + k) % L];
            notes.push(ev ? ev.semi + '/' + ev.dur : '-');
          }
          bars[sec + ':' + notes.join(',')] = true;
        }
        const out = { distinctBars: Object.keys(bars).length, totalBars: L * 4 / bl,
          loopSeconds: Math.round(L * 4 * (60 / track.bpm / 4)), tune: true };
        track = saved;
        return out;
      }
      for (let b = 0; b < FORM.length; b++) {
        const sec = FORM[b];
        const notes = [];
        for (let i = 0; i < 16; i++) {
          const s = b * 16 + i;
          let d = developMelody(s, sec);
          if (sec === 'BRK' && i >= 8) d = null;
          if (sec === 'FILL') d = null;
          notes.push(d == null ? '-' : (sec === 'C' ? 'c' : '') + (sec === 'A3' ? 'h' : '') + d);
        }
        bars[notes.join(',')] = true;
      }
      const seconds = FORM.length * 16 * (60 / track.bpm / 4);
      track = saved;
      return { distinctBars: Object.keys(bars).length, totalBars: FORM.length, loopSeconds: Math.round(seconds) };
    },
    currentTrack: function () { return currentKey; },
    stop: stop,
    setMuted: setMuted,
    isPlaying: function () { return !!timer; },
    currentLevel: function () { return current; },
    /** 測試用：確認每關都有不同的曲子 */
    trackIdFor: function (levelId) { return TRACKS[levelId] ? levelId : null; },
    tracks: TRACKS
  };
})();
