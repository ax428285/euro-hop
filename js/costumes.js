'use strict';

/**
 * 時裝 —— 純外觀，不影響任何能力。
 *
 * 只能從地圖上的稀有怪（黃金海馬）身上拿到（見 encounter.js）。
 * 擁有的時裝與目前穿哪一套存在 Save（costumes / costume）。
 * 繪製在 Sprites.player：時裝會蓋掉條紋衫與頭飾，但手上的啤酒杯等裝備照樣畫。
 */
const Costumes = (function () {
  const defs = [
    { id: 'captain', name: '海盜船長', desc: '三角帽 + 紅色長大衣' },
    { id: 'matador', name: '鬥牛士', desc: '金色刺繡短外套 + 黑色鬥牛士帽' },
    { id: 'viking', name: '維京戰士', desc: '牛角頭盔 + 毛皮背心' },
    { id: 'harlequin', name: '威尼斯小丑', desc: '菱格紋衣 + 雙角鈴鐺帽' },
    { id: 'royal', name: '歐羅巴王子', desc: '金王冠 + 紫色披風' },
    { id: 'golden', name: '黃金套裝', desc: '全身金光閃閃' }
  ];
  const byId = {};
  defs.forEach(function (d) { byId[d.id] = d; });
  return {
    defs: defs,
    count: defs.length,
    get: function (id) { return byId[id]; }
  };
})();
