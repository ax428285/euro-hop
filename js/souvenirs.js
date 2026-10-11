'use strict';

/**
 * 紀念品（v1.31 玩家：後面的關卡不一定要給裝備 → 美洲篇改成給紀念品；v1.31.2 亞特蘭提斯海底城也是）。
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
      note: '巴西拿過五次世界盃冠軍，是拿最多次的國家；黃綠色的球衣全世界都認得。' },
    // v1.31.2 亞特蘭提斯海底城
    { id: 'coralneck', level: 34, country: '珊瑚市集', icon: 'coralNecklace', name: '紅珊瑚項鍊',
      note: '紅珊瑚要好幾十年才長一公分；地中海的古羅馬人相信戴著紅珊瑚可以保佑出海平安。' },
    { id: 'prism', level: 35, country: '水晶宮', icon: 'prism', name: '水晶稜鏡',
      note: '一道白光穿過三角形的稜鏡，會分成彩虹的七種顏色 —— 牛頓就是用稜鏡發現的。' },
    { id: 'saddle', level: 36, country: '海馬競技場', icon: 'seahorseSaddle', name: '海馬的小鞍',
      note: '海馬是爸爸生小孩的魚：媽媽把卵產在爸爸的育兒袋裡，小海馬從爸爸肚子裡出生。' },
    { id: 'trident', level: 37, country: '海神神殿', icon: 'tridentModel', name: '三叉戟模型',
      note: '希臘神話的海神波賽頓拿著三叉戟，一敲地面就能掀起大浪、讓大地震動；柏拉圖說亞特蘭提斯就是他的國家。' },
    // v1.32.1 亞洲篇（asia: true —— 人魚只收歐洲、美洲、海底城的紀念品，好感度的上限不會因為新的篇章變高）
    { id: 'minicarpet', level: 38, country: '伊朗', icon: 'miniCarpet', name: '波斯小地毯', asia: true,
      note: '一張手織的波斯地毯，每平方公分打了上百個結；好的地毯可以用上一百年，越用越漂亮。' },
    { id: 'suzani', level: 39, country: '烏茲別克', icon: 'suzani', name: '蘇札尼刺繡',
      asia: true, note: '蘇札尼是烏茲別克的大塊刺繡布，上面繡著石榴和太陽；以前新娘出嫁時，要帶著媽媽繡的蘇札尼。' },
    // v1.33 亞洲篇第二批
    { id: 'masala', level: 40, country: '印度', icon: 'masala', name: '印度香料盒', asia: true,
      note: '印度的廚房都有一個圓圓的香料盒，裡面裝著薑黃、辣椒、孜然、肉桂⋯⋯每天煮咖哩都要用。' },
    { id: 'prayerflag', level: 41, country: '尼泊爾', icon: 'prayerFlags', name: '五色經幡', asia: true,
      note: '藍白紅綠黃的經幡掛在山口和寺廟上，風一吹，印在上面的經文就跟著吹到世界各地。' },
    { id: 'porcelain', level: 42, country: '中國', icon: 'porcelain', name: '青花瓷瓶', asia: true,
      note: '白底藍花的青花瓷是元朝、明朝最有名的瓷器，用波斯來的鈷藍顏料畫的，沿著海上絲路賣到全世界。' },
    { id: 'morinkhuur', level: 43, country: '蒙古', icon: 'morinKhuur', name: '馬頭琴', asia: true,
      note: '馬頭琴只有兩根弦，琴桿頂上雕著一個馬頭；傳說是一個牧人為了想念死去的白馬做的。' }
  ];
  const byId = {}, byLevel = {};
  defs.forEach(function (d) { byId[d.id] = d; byLevel[d.level] = d; });
  return {
    defs: defs,
    count: defs.length,
    get: function (id) { return byId[id] || null; },
    forLevel: function (i) { return byLevel[i] || null; },
    /** v1.32.1 人魚收的紀念品（不含亞洲篇的） */
    merDefs: function () { return defs.filter(function (d) { return !d.asia; }); }
  };
})();
