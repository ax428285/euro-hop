'use strict';

/**
 * 紀念品（v1.31 玩家：後面的關卡不一定要給裝備 → 美洲篇改成給紀念品）。
 *
 * 跟裝備一樣放在關卡裡（密道裡、賽道上、魔王倒下後），撿到的流程也一樣（state.equip，souvenir: true），
 * 但只是收藏、不加任何能力，也不佔裝備欄。存在 Save.souvenirs。
 * level = 關卡 index（Levels.list 的順序）。
 *
 * 載入順序：save.js 之前（讀檔時要檢查紀念品 id）、entities.js 之前（buildLevelState 會找這一關的紀念品）。
 */
const Souvenirs = (function () {
  const defs = [
    { id: 'maracas', level: 28, country: '古巴', icon: 'maracas', name: '古巴沙鈴',
      note: '古巴的頌樂裡少不了沙鈴：乾葫蘆裡裝著種子，一搖就沙沙響，跟著邦戈鼓一起打拍子。' },
    { id: 'bmcoffee', level: 29, country: '牙買加', icon: 'bmcoffee', name: '藍山咖啡豆',
      note: '藍山咖啡以前都裝在小木桶裡運到日本，到今天還有莊園照這個傳統出貨。' },
    { id: 'pinata', level: 30, country: '墨西哥', icon: 'pinata', name: '墨西哥皮納塔',
      note: '彩色紙糊的皮納塔裡塞滿了糖果，生日派對上大家輪流蒙著眼睛拿棍子打它，打破了糖果就掉滿地。' },
    { id: 'mola', level: 31, country: '巴拿馬', icon: 'mola', name: '古納族莫拉布',
      note: '巴拿馬古納族的女生把好幾層彩色的布一層層剪開、縫起來，拼出鳥、魚和花的圖案，縫在衣服上。' },
    { id: 'emerald', level: 32, country: '哥倫比亞', icon: 'emerald', name: '哥倫比亞祖母綠',
      note: '世界上最好的祖母綠很多都出自哥倫比亞的山裡，翠綠得像透光的樹葉。' },
    { id: 'cupball', level: 33, country: '巴西', icon: 'cupball', name: '世界盃足球',
      note: '巴西拿過五次世界盃冠軍，是拿最多次的國家；黃綠色的球衣全世界都認得。' }
  ];
  const byId = {}, byLevel = {};
  defs.forEach(function (d) { byId[d.id] = d; byLevel[d.level] = d; });
  return {
    defs: defs,
    count: defs.length,
    get: function (id) { return byId[id] || null; },
    forLevel: function (i) { return byLevel[i] || null; }
  };
})();
