'use strict';

/**
 * 世界之謎（v1.16）。
 *
 * 每個洲一個謎。每打完一關拿到一條線索，該洲的線索全部到齊就解開謎底。
 * 洲與洲之間是同一個家族的故事 —— 解開一個洲的謎，就會指向下一個洲。
 *
 * ── 故事主軸：大陸的名字是一家人 ────────────────────────────
 * 遊戲叫 EUROPA ODYSSEY，而「歐羅巴」正是歐洲名字的由來：
 *   希臘神話裡，腓尼基（今黎巴嫩，在亞洲）的公主歐羅巴，被化身白牛的宙斯載過大海到克里特島。
 *   她的祖母叫利比亞 —— 古希臘人就用「利比亞」稱呼非洲。
 *   她的家鄉在亞洲；她的哥哥卡德摩斯為了找她，把腓尼基字母帶到希臘。
 * 所以：歐洲之謎的答案 → 指向非洲（祖母利比亞）與亞洲（故鄉、字母）。
 *
 * 線索內容盡量是真實的神話情節與史實（希臘 2 歐元硬幣、布拉格天文鐘的黃道環、
 * 希羅多德的疑問、西里爾字母⋯⋯），讓玩家拼完會覺得「原來是真的」。
 *
 * ── 存檔 ──────────────────────────────────────────────
 * 不另存資料：「拿到線索」= 該關已通關（Save.cleared）。舊存檔讀進來，已通關的線索自動都有。
 *
 * ── 對外 API ─────────────────────────────────────────
 *   Mystery.continents             各洲（含還沒開放的）
 *   Mystery.clueFor(levelIndex)    某關的線索（沒有回 null）
 *   Mystery.progress(contId)       { got, total, complete }
 *   Mystery.slots(contId)          依關卡順序的線索格 [{ levelIndex, def, clue, got }]
 */
const Mystery = (function () {

  /*
   * 線索依關卡 id 對應（不用 index：關卡順序調整時線索不會錯位）。
   * item = 在那一國找到的東西（遊戲內的小道具，純故事）；text = 線索內容。
   * text 會自動換行，但一條最好不要超過 60 字（畫面放得下兩行半）。
   */
  const CLUES = {
    // ── 西歐篇：白牛 ──
    ES: { item: '鬥牛場邊的舊瓷磚', text: '故事要從一頭牛說起：一頭雪白發亮、角彎得像新月的公牛。' },
    FR: { item: '塞納河畔的舊書頁', text: '白牛出現在遙遠東方的海邊，混進了一位國王的牛群裡吃草，溫馴得不像話。' },
    GB: { item: '撕成兩半的航海圖', text: '海邊有一位公主和朋友在摘花。她一點也不怕白牛，還替牠戴上了花環。' },
    NL: { item: '鬱金香球根袋裡的紙條', text: '公主才剛坐上牛背，白牛就站起來，一路衝進了大海。' },
    DE: { item: '啤酒杯底的刻字', text: '白牛載著她往西游。公主一手抓緊牛角，回頭看著家鄉的海岸越來越遠。' },
    CZ: { item: '天文鐘的一枚齒輪', text: '布拉格天文鐘的黃道環上有一頭牛 —— 金牛座。傳說那就是那頭白牛，後來被放上了天空。' },
    AT: { item: '夾在樂譜裡的書籤', text: '白牛一直游到一座大島才停下來。那座島，就在希臘的南方 —— 克里特島。' },
    CH: { item: '綁在登山繩上的布條', text: '上了岸，白牛變回原本的樣子 —— 牠根本不是牛，是眾神之王宙斯。' },
    IT: { item: '噴泉池底的古錢幣', text: '公主留在島上，成了克里特的王后。她的兒子米諾斯，後來是傳說中最有名的國王之一。' },
    GR: { item: '一枚希臘 2 歐元硬幣', text: '希臘的 2 歐元硬幣背面，刻著一位騎在公牛背上的女子。她的名字是 —— 歐羅巴。' },
    // ── 東歐篇：尋找 ──
    PL: { item: '鹽礦深處的一盞礦燈', text: '公主不見了。她的父王派王子們出海去找，還下了命令：找不到妹妹，就不准回家。' },
    HU: { item: '溫泉池裡的銅板', text: '哥哥卡德摩斯找遍各地都沒找到。神諭要他跟著一頭母牛走，在牠躺下的地方建城 —— 那就是底比斯。' },
    RO: { item: '古堡藏書室的家譜', text: '伯爵的家譜裡寫著：公主的高祖母伊娥，也曾被變成一頭母牛，一路逃到了埃及。' },
    SK: { item: '牧羊人哼的老歌', text: '卡德摩斯沒有找回妹妹，卻把家鄉的文字帶到了希臘 —— 那是腓尼基人的字母。' },
    HR: { item: '城牆石縫裡的地圖', text: '歐羅巴的家鄉叫泰爾，是腓尼基人的港口，在地中海最東邊，今天的黎巴嫩 —— 屬於亞洲。' },
    RS: { item: '木橋下撈起的瓶中信', text: '兩千多年前，希臘史學家希羅多德就覺得奇怪：這片土地，為什麼要用一位亞洲公主的名字？' },
    BG: { item: '玫瑰谷修道院的古書', text: '保加利亞誕生的西里爾字母，是從希臘字母來的；而傳說中，希臘字母是那位尋找妹妹的王子帶來的。' },
    UA: { item: '一根火鳥的羽毛', text: '歐羅巴的祖母叫利比亞 —— 古希臘人就用她的名字，稱呼地中海對面那片南方大陸。' },
    // ── 非洲篇：利比亞（v1.21 第一階段：摩洛哥、肯亞；其餘六國之後補）──
    MA: { item: '市集地毯店裡的古地圖', text: '古希臘的地圖上，地中海對岸整片南方大陸只寫著一個名字：利比亞。' },
    KE: { item: '馬賽長老手上的串珠', text: '可是今天這片大陸叫「非洲」。這個名字不是希臘人取的 —— 是後來的羅馬人。' }
  };

  /*
   * 各洲。levels = 這個洲有哪些關（依 Levels.list 的 region 判斷）；
   * 還沒有關卡的洲 open: false，只顯示預告（跟歐洲的謎底接得起來）。
   */
  const continents = [
    {
      id: 'europe',
      name: '歐洲之謎',
      question: '「歐洲」這個名字，是從哪裡來的？',
      open: true,
      regions: ['west', 'east'],
      groups: [
        { region: 'west', title: '西歐篇・白牛' },
        { region: 'east', title: '東歐篇・尋找' }
      ],
      answerTitle: '歐洲的名字，來自一位亞洲公主',
      answer: [
        '歐洲（Europe）的名字來自希臘神話裡的公主「歐羅巴」。',
        '宙斯化身白牛，把她從腓尼基（今天的黎巴嫩）載過大海，送到克里特島。',
        '她到今天都還在：希臘 2 歐元硬幣、歐元紙鈔的浮水印，還有木星的一顆衛星，都叫歐羅巴。',
        '而她的家族，把名字留在了另外兩片大陸 ——',
        '她生在亞洲；她的祖母「利比亞」，是古希臘人對非洲的稱呼。',
        '三片大陸的名字，原來是一家人。'
      ],
      next: '下一個謎：非洲之謎 ——「利比亞」是誰？'
    },
    {
      id: 'africa',
      name: '非洲之謎',
      question: '歐羅巴的祖母，為什麼把名字留在了南方？',
      /*
       * v1.21 第一階段：非洲篇只有 2 關，但謎題規劃 8 條線索。
       * wip = 還在開發中：線索照樣收集、顯示「x / 8」，但不會「到齊」也不會揭曉謎底
       * （不然打完兩關就跳出謎底畫面，而且謎底畫面目前只會畫歐洲的）。八國都做完再拿掉 wip、補上 answer。
       */
      open: true,
      wip: true,
      planned: 8,
      regions: ['africa'],
      groups: [{ region: 'africa', title: '非洲篇・利比亞' }],
      teaser: '利比亞的父親厄帕福斯，出生在尼羅河畔⋯⋯（非洲篇開發中）'
    },
    {
      id: 'asia',
      name: '亞洲之謎',
      question: '公主的故鄉，藏著什麼祕密？',
      open: false,
      teaser: '泰爾的商船從這裡出發，字母也是⋯⋯（亞洲篇開發中）'
    }
  ];

  function byId(id) { return continents.filter(function (c) { return c.id === id; })[0]; }

  function clueFor(levelIndex) {
    const def = Levels.list[levelIndex];
    return def ? (CLUES[def.id] || null) : null;
  }

  /** 依關卡順序列出某洲的線索格 */
  function slots(contId) {
    const c = byId(contId);
    if (!c || !c.open) return [];
    const sv = Save.get();
    const out = [];
    Levels.list.forEach(function (def, i) {
      if (c.regions.indexOf(def.region || 'west') < 0) return;
      out.push({ levelIndex: i, def: def, clue: CLUES[def.id] || null, got: sv.cleared.indexOf(i) >= 0 });
    });
    return out;
  }

  function progress(contId) {
    const c = byId(contId);
    const s = slots(contId);
    const got = s.filter(function (x) { return x.got; }).length;
    // 開發中的洲：總數用規劃的線索數，而且永遠不算「到齊」
    const total = Math.max(s.length, (c && c.planned) || 0);
    return { got: got, total: total, complete: !(c && c.wip) && s.length > 0 && got === s.length };
  }

  /** 這一關屬於哪個洲（沒有回 null） */
  function continentOf(levelIndex) {
    const def = Levels.list[levelIndex];
    if (!def) return null;
    const region = def.region || 'west';
    return continents.filter(function (c) { return c.open && c.regions.indexOf(region) >= 0; })[0] || null;
  }

  return {
    continents: continents,
    CLUES: CLUES,
    get: byId,
    clueFor: clueFor,
    slots: slots,
    progress: progress,
    continentOf: continentOf
  };
})();
