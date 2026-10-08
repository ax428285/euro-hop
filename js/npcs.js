'use strict';

/**
 * 會講話的 NPC（v1.10）。
 *
 * 每個橫向關卡站 3 位當地居民、魔王關在出生點旁站 1 位。
 * 玩家走近就自動冒對話泡泡，輪流講這個國家的特色；
 * 招牌機制前面那位會順便提醒「前面那個東西要怎麼過」。
 *
 * 不用按鍵對話：鍵位已經很多（跳、丟、商店⋯⋯），
 * 而且這是橫向卷軸，停下來按鍵會打斷節奏。走近就講、走遠就停。
 *
 * 對外 API：
 *   Npcs.specs(levelId)          這一國的 NPC 設定（at = 偏好位置佔關卡寬的比例）
 *   Npcs.place(specs, ctx)       找合法站位，回傳 [{ x, y, name, look, lines }]
 *   Npcs.placeBoss(levelId)      魔王關：站在出生點左邊
 *   Npcs.makeState(def)          執行期狀態
 *   Npcs.update(state)           每帧更新，回傳事件（第一次搭話 → 'npc'）
 *   Npcs.draw(ctx, state, camX, t)        畫人（世界座標層）
 *   Npcs.drawBubbles(ctx, state, camX, t, W)  畫對話泡泡（蓋在最上層、HUD 底下）
 */
const Npcs = (function () {

  /*
   * look：
   *   skin / hair / shirt / pants  顏色
   *   hat   'beret' | 'chef' | 'cap' | 'scarf' | 'wreath' | 'helmet' | 'straw' | 'fur' | 'tricorn' | 'kerchief' | null
   *   hatColor
   *   apron 圍裙顏色（可省略）
   *   item  手上拿的東西 'baguette' | 'brush' | 'mug' | 'pretzel' | 'fan' | 'pan' | 'trumpet' | 'lamp' |
   *         'cube' | 'towel' | 'crook' | 'net' | 'spear' | 'oar' | 'rose' | 'jar' | 'book' | 'map' | null
   */
  const DATA = {
    ES: [
      { at: 0.12, name: '高第迷 Jordi',
        look: { skin: '#e8b48a', hair: '#3a2a20', shirt: '#2f6fb0', pants: '#3b3b48', hat: null, item: 'book' },
        lines: ['那座還在蓋的教堂是聖家堂，1882 年就動工了！', '高第說過：「我的業主不趕時間。」他指的是上帝。', '巴塞隆納有 7 座高第的建築被列為世界遺產。'] },
      { at: 0.36, name: '牧牛人 Pablo',
        look: { skin: '#d9a172', hair: '#1e1a18', shirt: '#ffffff', pants: '#ffffff', hat: 'kerchief', hatColor: '#c8202a', item: null },
        lines: ['小心！前面要放牛了，聽到鼓聲就往前衝！', '真正的奔牛節在潘普洛納，每年 7 月舉行。', '跑的人穿白衣、繫紅領巾，就跟我一樣。'] },
      { at: 0.78, name: '海鮮飯大嬸 Carmen',
        look: { skin: '#e3a97e', hair: '#2b1d16', shirt: '#b8323a', pants: '#2b2b33', hat: null, apron: '#f2e6c8', item: 'pan' },
        lines: ['海鮮飯 paella 來自瓦倫西亞，最早放的是雞肉跟兔肉。', '我們晚餐常常 9、10 點才開動，你餓了嗎？', '午後的小睡 siesta，是給大太陽的時間。'] }
    ],
    FR: [
      { at: 0.1, name: '麵包師傅 Luc',
        look: { skin: '#f0c49c', hair: '#6b4a2e', shirt: '#ffffff', pants: '#3a3f55', hat: 'chef', hatColor: '#ffffff', apron: '#e9e1d0', item: 'baguette' },
        lines: ['前面的遮陽篷彈性很好，踩上去會彈很高！', '法國長棍 baguette 在 2022 年列入人類非物質文化遺產。', '法國一年大約烤出 60 億根長棍！'] },
      { at: 0.42, name: '畫家 Amélie',
        look: { skin: '#f3cfae', hair: '#b5652e', shirt: '#2a2f45', pants: '#2a2f45', hat: 'beret', hatColor: '#c8202a', item: 'brush' },
        lines: ['艾菲爾鐵塔是 1889 年萬國博覽會蓋的，原本只打算放 20 年。', '在店裡記得先說 Bonjour，再點麵包喔。', '羅浮宮的蒙娜麗莎其實比你想像的小很多。'] },
      { at: 0.76, name: '咖啡館侍者 Henri',
        look: { skin: '#eec39d', hair: '#2a2420', shirt: '#ffffff', pants: '#1e1e26', hat: null, apron: '#1e1e26', item: 'mug' },
        lines: ['在吧台站著喝的咖啡，通常比坐露天座便宜。', '可頌其實是從奧地利的 kipferl 演變來的。', '法國有超過一千種起司，每天吃一種要吃三年。'] }
    ],
    DE: [
      { at: 0.12, name: '城堡導遊 Greta',
        look: { skin: '#f3d0b0', hair: '#e2c26a', shirt: '#2d5a3a', pants: '#2d5a3a', hat: null, item: 'map' },
        lines: ['前面會有啤酒桶一路滾下來，跳過去就好！', '新天鵝堡是國王路德維希二世蓋的夢幻城堡。', '據說迪士尼睡美人城堡的靈感就是來自它。'] },
      { at: 0.4, name: '啤酒節侍者 Lena',
        look: { skin: '#f5d2b2', hair: '#d9a64a', shirt: '#ffffff', pants: '#2a5a8a', hat: null, apron: '#2a5a8a', item: 'mug' },
        lines: ['巴伐利亞的旗子是藍白菱格，跟天空一樣。', '一公升的大杯叫 Maß，我一次能端十杯。', '慕尼黑啤酒節大多在九月，十月第一個週日結束。'] },
      { at: 0.72, name: '麵包師 Hans',
        look: { skin: '#efc6a2', hair: '#8a6a4a', shirt: '#6b4a2e', pants: '#3a3020', hat: 'tricorn', hatColor: '#2d5a3a', item: 'pretzel' },
        lines: ['德國登記在案的麵包超過 3000 種！', '蝴蝶餅 Brezel 的形狀，傳說是祈禱時交叉的手臂。', '我身上這件是傳統皮褲 Lederhosen。'] }
    ],
    PL: [
      { at: 0.12, name: '號手 Marek',
        look: { skin: '#f0c9a6', hair: '#5a4030', shirt: '#7a1e2a', pants: '#2a2a36', hat: 'cap', hatColor: '#2a2a36', item: 'trumpet' },
        lines: ['聖母聖殿每到整點就會吹號 Hejnał。', '曲子會在中途突然斷掉，紀念當年被箭射中的號手。', '克拉科夫的中央市場廣場是中世紀歐洲最大的廣場之一。'] },
      { at: 0.42, name: '鹽礦工 Tomasz',
        look: { skin: '#e6bc98', hair: '#3a3028', shirt: '#4a4a52', pants: '#30303a', hat: 'helmet', hatColor: '#e0b030', item: 'lamp' },
        lines: ['前面就是鹽礦，很暗，跟著燈走！', '維利奇卡鹽礦裡有一整座用鹽雕出來的教堂。', '連吊燈都是用鹽結晶做的，舔一下是鹹的喔。'] },
      { at: 0.8, name: '餃子奶奶 Zofia',
        look: { skin: '#f2cdb0', hair: '#cfcfcf', shirt: '#c83a3a', pants: '#2a2a36', hat: 'scarf', hatColor: '#f2d04a', apron: '#ffffff', item: 'pan' },
        lines: ['波蘭餃子 pierogi 有鹹有甜，連藍莓口味都有。', '聖誕夜的晚餐要準備 12 道菜，而且不吃肉。', '居禮夫人就是在華沙出生的喔。'] }
    ],
    HU: [
      { at: 0.12, name: '泡湯大叔 Gábor',
        look: { skin: '#eebd96', hair: '#4a3a30', shirt: '#f2f2f2', pants: '#2a5a9a', hat: 'cap', hatColor: '#f2f2f2', item: 'towel' },
        lines: ['前面冒煙的地方等一下會噴，可以搭便車飛過河！', '布達佩斯地底下有一百多個溫泉，被叫做溫泉之都。', '我們在溫泉池裡下西洋棋，一下就是一下午。'] },
      { at: 0.45, name: '發明迷 Eszter',
        look: { skin: '#f3cfae', hair: '#2a1e18', shirt: '#3a7a3a', pants: '#2a2a36', hat: null, item: 'cube' },
        lines: ['魔術方塊是匈牙利人魯比克在 1974 年發明的。', '原本是他拿來教學生立體結構的教具。', '原子筆的發明人比羅也是匈牙利人！'] },
      { at: 0.78, name: '紅椒小販 Péter',
        look: { skin: '#e9b48c', hair: '#3a2a20', shirt: '#ffffff', pants: '#2a2a36', hat: 'fur', hatColor: '#3a2a20', apron: '#b8202a', item: 'jar' },
        lines: ['國會大廈是匈牙利最大的建築，就在多瑙河邊。', '燉牛肉湯 gulyás 一定要加大把紅椒粉。', '多瑙河把城市分成山上的布達和平地的佩斯。'] }
    ],
    SK: [
      { at: 0.12, name: '牧羊人 Juraj',
        look: { skin: '#e6b892', hair: '#3a2a20', shirt: '#f2f2f2', pants: '#f2f2f2', hat: 'straw', hatColor: '#2a2a2a', item: 'crook' },
        lines: ['前面山風很大，在地上會被往回吹——跳起來就不怕！', '塔特拉山是喀爾巴阡山最高的一段，最高峰 2655 公尺。', '樹葉開始往左飄，就是風要來了。'] },
      { at: 0.45, name: '城堡守衛 Milan',
        look: { skin: '#efc4a0', hair: '#6a5040', shirt: '#7a2a2a', pants: '#3a3030', hat: 'helmet', hatColor: '#9aa0a8', item: 'spear' },
        lines: ['斯皮什城堡是中歐面積最大的城堡遺址之一。', '它在 1993 年列入世界遺產。', '斯洛伐克的城堡密度，是全世界最高的國家之一。'] },
      { at: 0.75, name: '說書人 Anna',
        look: { skin: '#f3d0b0', hair: '#8a5a30', shirt: '#c8202a', pants: '#2a2a36', hat: 'wreath', hatColor: '#e8c040', apron: '#ffffff', item: 'book' },
        lines: ['傳說俠盜 Jánošík 劫富濟貧，是我們的羅賓漢。', '他的武器就是牧羊人的長柄小斧 valaška。', '每年冬天，山上的木屋會點起整排燈籠。'] }
    ],
    HR: [
      { at: 0.1, name: '守城兵 Ivan',
        look: { skin: '#e6b892', hair: '#2a2220', shirt: '#2a3a6a', pants: '#2a2a36', hat: 'helmet', hatColor: '#9aa0a8', item: 'spear' },
        lines: ['前面會打砲！地上出現紅圈，就是砲彈要落下的地方。', '杜布羅夫尼克的城牆將近 2 公里長，可以繞老城走一圈。', '紅圈越縮越小，代表砲彈越來越近了。'] },
      { at: 0.45, name: '漁夫 Ante',
        look: { skin: '#d9a172', hair: '#cfcfcf', shirt: '#2a5a9a', pants: '#e8dcc0', hat: 'cap', hatColor: '#2a2a36', item: 'net' },
        lines: ['大麥町犬的名字，就是來自我們的達爾馬提亞海岸。', '亞得里亞海的海水清澈到能看見十幾公尺深。', '克羅埃西亞的海岸線上有一千多座島嶼。'] },
      { at: 0.78, name: '裁縫 Marija',
        look: { skin: '#f3cfae', hair: '#3a2a20', shirt: '#ffffff', pants: '#c8202a', hat: null, item: 'book' },
        lines: ['領帶的法文 cravate，就是「克羅埃西亞人」的意思。', '17 世紀我們的傭兵脖子上繫著領巾，被法國人學走了。', '每年 10 月 18 日是克羅埃西亞的領帶日。'] }
    ],
    RS: [
      { at: 0.12, name: '船夫 Dragan',
        look: { skin: '#e3ad86', hair: '#2a2220', shirt: '#4a6a3a', pants: '#2a2a36', hat: 'fur', hatColor: '#2a2220', item: 'oar' },
        lines: ['前面河上的舊木橋，踩上去一會兒就會塌，快點過！', '貝爾格勒就蓋在薩瓦河和多瑙河交會的地方。', '城名的意思是「白色之城」。'] },
      { at: 0.45, name: '修士 Sava',
        look: { skin: '#efc4a0', hair: '#3a2a20', shirt: '#1e1e26', pants: '#1e1e26', hat: 'fur', hatColor: '#1e1e26', item: 'book' },
        lines: ['聖薩瓦教堂是世界上最大的東正教教堂之一。', '圓頂底下的金色馬賽克，是好幾年一片片貼上去的。', '我們用的是西里爾字母，也會用拉丁字母。'] },
      { at: 0.78, name: '科學迷 Nina',
        look: { skin: '#f3d0b0', hair: '#5a3a28', shirt: '#2a4a8a', pants: '#2a2a36', hat: null, item: 'lamp' },
        lines: ['發明交流電系統的特斯拉，是塞爾維亞裔。', '貝爾格勒的機場就叫「尼古拉·特斯拉機場」。', '城裡還有一座特斯拉博物館，收著他的骨灰。'] }
    ],
    BG: [
      { at: 0.12, name: '採花姑娘 Rosa',
        look: { skin: '#f3d0b0', hair: '#3a2420', shirt: '#ffffff', pants: '#c8325a', hat: 'wreath', hatColor: '#e8507a', apron: '#c8325a', item: 'rose' },
        lines: ['前面的玫瑰花苞一抖，荊棘就要冒出來了！', '玫瑰要在清晨採，太陽一出來香味就散掉了。', '大約 3 噸花瓣才煉得出 1 公斤玫瑰精油。'] },
      { at: 0.45, name: '優格爺爺 Ivan',
        look: { skin: '#e8b892', hair: '#e0e0e0', shirt: '#6a4a2e', pants: '#2a2a36', hat: 'fur', hatColor: '#2a2220', item: 'jar' },
        lines: ['保加利亞乳桿菌，就是用我們國家命名的。', '我每天喝優格，所以活到 90 歲還能爬山！', '冷湯 tarator 是優格加小黃瓜，夏天最消暑。'] },
      { at: 0.75, name: '小學生 Mila',
        look: { skin: '#f3d0b0', hair: '#8a5a30', shirt: '#2a6a4a', pants: '#2a2a36', hat: null, item: 'book' },
        lines: ['在保加利亞，點頭是「不要」，搖頭才是「好」！', '西里爾字母是在保加利亞第一帝國發展起來的。', '里拉修道院是我們最有名的世界遺產。'] }
    ],
    // ── 魔王關：出生點旁邊一位，提醒打法 + 一則國家小知識 ──
    NL: [
      { name: '風車守護人 Joost',
        look: { skin: '#f3d0b0', hair: '#e2c26a', shirt: '#2a5a9a', pants: '#2a2a36', hat: 'cap', hatColor: '#e8742a', item: null },
        lines: ['風車巨人落地會噴出貼地震波，跟著跳起來閃！', '荷蘭大約四分之一的國土低於海平面。', '荷蘭的腳踏車比人還多！'] }
    ],
    CZ: [
      { name: '提線木偶師 Jan',
        look: { skin: '#efc4a0', hair: '#4a3a30', shirt: '#7a1e2a', pants: '#2a2a36', hat: 'beret', hatColor: '#2a2a36', item: 'book' },
        lines: ['鐵騎守衛會整片橫衝過來，跳過它或繞到另一邊！', '查理大橋上一共有 30 座聖人雕像。', '布拉格天文鐘從 1410 年走到現在。'] }
    ],
    IT: [
      { name: '冰淇淋師傅 Marco',
        look: { skin: '#e8b48a', hair: '#2a1e18', shirt: '#ffffff', pants: '#2a2a36', hat: 'chef', hatColor: '#ffffff', apron: '#3a8a4a', item: 'mug' },
        lines: ['大鐘錶匠會射扇形彈幕，跳是閃不掉的，要左右找空隙！', '羅馬競技場可以容納大約五萬名觀眾。', '在羅馬，把硬幣丟進許願池代表你會再回來。'] }
    ],
    GR: [
      { name: '哲學家 Nikos',
        look: { skin: '#e3ad86', hair: '#cfcfcf', shirt: '#f2f2f2', pants: '#f2f2f2', hat: 'wreath', hatColor: '#6a9a3a', item: 'book' },
        lines: ['巨像會升空灑彈、叫小兵出來，先清兵再打本體！', '帕德嫩神廟是獻給女神雅典娜的。', '第一屆現代奧運，1896 年就在雅典舉行。'] }
    ],
    RO: [
      { name: '村長 Vlad',
        look: { skin: '#e6bc98', hair: '#2a2220', shirt: '#ffffff', pants: '#2a2a36', hat: 'fur', hatColor: '#2a2220', item: 'lamp' },
        lines: ['伯爵會化霧瞬移到你背後，記得常常回頭看！', '布朗城堡常被叫做德古拉城堡。', '但寫《德古拉》的作者其實從沒來過羅馬尼亞。'] }
    ],
    UA: [
      { name: '彩蛋畫師 Oksana',
        look: { skin: '#f3d0b0', hair: '#e2c26a', shirt: '#ffffff', pants: '#c8202a', hat: 'wreath', hatColor: '#e8c040', item: 'brush' },
        lines: ['火鳥俯衝落地會噴貼地火焰，跳起來閃，再趁它癱著打！', '烏克蘭是世界上最大的向日葵油產國。', '彩蛋 pysanka 是用蠟一層層畫出來的。'] }
    ],
    // ── 非洲篇（v1.21）──
    MA: [
      { at: 0.12, name: '地毯商 Youssef',
        look: { skin: '#c8946a', hair: '#1e1814', shirt: '#3a6ab0', pants: '#3a6ab0', hat: 'cap', hatColor: '#b8202a', item: 'map' },
        lines: ['前面的沙地有流沙，踩進去要趕快走出來！', '馬拉喀什的老城 medina 是世界遺產，巷子多到像迷宮。', '殺價是市集的禮貌，第一個價錢通常可以砍很多喔。'] },
      { at: 0.45, name: '薄荷茶師傅 Fatima',
        look: { skin: '#d8a57a', hair: '#2a1e18', shirt: '#2f8a5a', pants: '#2f8a5a', hat: 'scarf', hatColor: '#e8c040', item: 'jar' },
        lines: ['摩洛哥薄荷茶要從高處倒，倒出泡泡才好喝。', '請客人喝茶是待客之道，通常要喝三杯。', '塔吉鍋 tagine 是尖尖的陶鍋，用來慢慢燉肉和蔬菜。'] },
      { at: 0.78, name: '說書人 Hassan',
        look: { skin: '#b8845a', hair: '#cfcfcf', shirt: '#e8dcc0', pants: '#e8dcc0', hat: 'kerchief', hatColor: '#ffffff', item: 'book' },
        lines: ['德吉瑪廣場一到晚上，就有說書人、樂師和小吃攤。', '撒哈拉沙漠差不多跟整個美國一樣大。', '這裡的房子大多是紅土蓋的，所以馬拉喀什又叫「紅城」。'] }
    ],
    // ── v1.23 非洲篇補齊 ──
    DZ: [
      { at: 0.12, name: '嚮導 Moussa',
        look: { skin: '#a8744e', hair: '#1e1814', shirt: '#2a3a8a', pants: '#2a3a8a', hat: 'scarf', hatColor: '#2a3a8a', item: 'map' },
        lines: ['前面會起沙塵暴！風會把你往回推，黃沙裡只看得到身邊。', '颳風前沙子會先慢慢變濃，趁還看得到的時候多走幾步。', '我們圖阿雷格人用靛藍頭巾擋風沙，被叫做「藍色的人」。'] },
      { at: 0.45, name: '考古學家 Leïla',
        look: { skin: '#c8946a', hair: '#3a2a20', shirt: '#c8b080', pants: '#6a5a40', hat: 'straw', hatColor: '#d8c080', item: 'brush' },
        lines: ['塔西利的岩畫有上萬幅，最老的超過一萬年。', '畫裡有長頸鹿、河馬和牛群 —— 撒哈拉以前是草原。', '阿爾及利亞是非洲面積最大的國家。'] },
      { at: 0.78, name: '椰棗農 Karim',
        look: { skin: '#b8845a', hair: '#2a2220', shirt: '#e8dcc0', pants: '#8a6a40', hat: 'kerchief', hatColor: '#ffffff', item: 'jar' },
        lines: ['綠洲的椰棗樹要人爬上去，一朵一朵幫它授粉。', '最好吃的椰棗叫 Deglet Nour，意思是「光之椰棗」。', '沙漠白天很熱，晚上卻冷到要生火。'] }
    ],
    TN: [
      { at: 0.12, name: '駱駝伕 Salah',
        look: { skin: '#b8845a', hair: '#1e1814', shirt: '#e8dcc0', pants: '#e8dcc0', hat: 'cap', hatColor: '#c8202a', item: 'crook' },
        lines: ['前面是鹽湖！鹽泥陷得很快，等駱駝靠岸，跳上駝峰讓牠載你過去。', '駱駝在岸邊會停一下，那就是上下的時機。', '駱駝的駝峰裡存的是脂肪，不是水喔。'] },
      { at: 0.45, name: '磚匠 Amel',
        look: { skin: '#c8946a', hair: '#2a1e18', shirt: '#d8a860', pants: '#6a4a2e', hat: 'scarf', hatColor: '#3a8ad0', item: 'book' },
        lines: ['托澤的老城用黃磚砌出上百種花紋，沒有一面牆一樣。', '夏天的杰里德湖會出現海市蜃樓，看起來像真的湖。', '突尼西亞的國旗跟土耳其很像，但中間多了一個白圓。'] },
      { at: 0.78, name: '茉莉花小販 Hédi',
        look: { skin: '#d8a57a', hair: '#3a2a20', shirt: '#ffffff', pants: '#2a4a8a', hat: null, item: 'rose' },
        lines: ['突尼西亞人會把茉莉花別在耳朵上，男生別左邊、女生別右邊。', '迦太基古城就在首都突尼斯旁邊。', '哈里薩辣醬 harissa 是我們的國民醬料。'] }
    ],
    LY: [
      { at: 0.12, name: '遺址守衛 Omar',
        look: { skin: '#b8845a', hair: '#2a2220', shirt: '#6a7a4a', pants: '#3a3a30', hat: 'cap', hatColor: '#3a3a30', item: 'spear' },
        lines: ['小心前面的老石柱，一走近就會搖、會倒！', '看到地上的紅框就是它倒下的位置 —— 衝過去，或等它倒完。', '倒下的石柱可以踩上去，當跳板也不錯。'] },
      { at: 0.45, name: '歷史老師 Aisha',
        look: { skin: '#c8946a', hair: '#1e1814', shirt: '#2a6a5a', pants: '#2a2a36', hat: 'scarf', hatColor: '#e8dcc0', item: 'book' },
        lines: ['大萊普提斯是羅馬皇帝塞維魯的故鄉。', '古城被沙子埋了上千年，反而保存得很完整。', '利比亞大約九成的土地是撒哈拉沙漠。'] },
      { at: 0.78, name: '皮匠 Yusuf',
        look: { skin: '#a8744e', hair: '#cfcfcf', shirt: '#b8402a', pants: '#3a2a20', hat: 'kerchief', hatColor: '#f1c40f', item: 'jar' },
        lines: ['古達米斯的皮靴又軟又輕，在沙地上走也不會陷。', '古達米斯老城的屋頂連成一片，女人以前在屋頂上走來走去。', '一千多年前，商隊從這裡出發穿越撒哈拉。'] }
    ],
    EG: [
      { name: '考古學家 Nour',
        look: { skin: '#c8946a', hair: '#2a1e18', shirt: '#e8dcc0', pants: '#8a6a40', hat: 'straw', hatColor: '#d8c080', item: 'lamp' },
        lines: ['人面獅身會輪流出兩招：跳起來重壓就跳過沙浪，張嘴吐沙就左右閃！', '吉薩大金字塔用了大約 230 萬塊石頭。', '人面獅身的鼻子早就不見了，原因到現在還有爭議。'] }
    ],
    // ── 北歐篇（v1.30）──
    DK: [
      { at: 0.12, name: '積木設計師 Mette',
        look: { skin: '#f3d6bc', hair: '#e8cf8a', shirt: '#d8262c', pants: '#2a3a6a', hat: 'beanie', hatColor: '#f1c40f', item: 'cube' },
        lines: ['前面的紅色、藍色積木會輪流出現！', '看到腳下的積木開始閃就起跳，落下時另一色剛好出來。', '最上面那塊積木頂上有金幣喔。'] },
      { at: 0.45, name: '說故事的 Hans',
        look: { skin: '#f0cfb0', hair: '#8a6a4a', shirt: '#2a2a36', pants: '#2a2a36', hat: 'tricorn', hatColor: '#1e1e26', item: 'book' },
        lines: ['安徒生寫了《小美人魚》《醜小鴨》《國王的新衣》。', '港口邊的小美人魚銅像 1913 年就站在那裡了。', '新港的彩色房子以前住的都是水手和商人。'] },
      { at: 0.78, name: '單車郵差 Lars',
        look: { skin: '#f3d6bc', hair: '#c8a060', shirt: '#2f8a5a', pants: '#3a3a44', hat: 'cap', hatColor: '#c8102e', item: 'map' },
        lines: ['哥本哈根騎腳踏車的人比開車的還多。', '下雪天大家照樣騎，路上還有腳踏車專用的紅綠燈。', '丹麥國旗是世界上沿用最久的國旗之一。'] }
    ],
    SE: [
      { at: 0.12, name: '冰湖釣客 Erik',
        look: { skin: '#f3d6bc', hair: '#d8c8a0', shirt: '#2a5aa0', pants: '#3a3a44', hat: 'beanie', hatColor: '#fecc00', item: 'net' },
        lines: ['坐穩了！馴鹿雪橇會自己往前衝，停不下來喔。', '你只要管跳：看到斷崖、看到怪物就跳！', '結冰的湖面上雪橇會越滑越快，跳得也更遠。'] },
      { at: 0.45, name: '薩米牧人 Áilu',
        look: { skin: '#e8c4a0', hair: '#2a2220', shirt: '#1f4aa0', pants: '#2a2a36', hat: 'fur', hatColor: '#c8202a', item: 'crook' },
        lines: ['薩米人在拉普蘭養馴鹿，已經好幾千年了。', '我們的傳統衣服 gákti 是藍色、紅色、黃色。', '馴鹿的蹄冬天會變硬，像冰爪一樣抓得住冰。'] },
      { at: 0.78, name: '冰雕師傅 Ingrid',
        look: { skin: '#f3d6bc', hair: '#f0e0b0', shirt: '#e8eef4', pants: '#4a5a7a', hat: 'beanie', hatColor: '#2a6ad0', item: 'brush' },
        lines: ['冰旅館的床、杯子、整間教堂都是冰做的。', '房間裡大概零下五度，大家睡在馴鹿皮上。', '紅色的達拉木馬是瑞典最有名的紀念品。'] }
    ],
    NO: [
      { at: 0.12, name: '漁夫 Olav',
        look: { skin: '#e8c4a0', hair: '#c8a878', shirt: '#c8202a', pants: '#2a3a5a', hat: 'beanie', hatColor: '#00205b', item: 'oar' },
        lines: ['前面的冰海太寬了，跳不過去！', '踩著浮冰過去 —— 浮冰站一下就會往下沉，別停！', '浮冰會漂來漂去，等它靠近了再跳。'] },
      { at: 0.45, name: '維京故事迷 Sigrid',
        look: { skin: '#f3d6bc', hair: '#e8cf8a', shirt: '#6a4a2a', pants: '#3a3020', hat: 'kerchief', hatColor: '#e8dcc0', item: 'spear' },
        lines: ['維京人的長船很淺，可以一路開進河裡。', '真正的維京頭盔其實沒有角，那是後來的人畫的。', '一千年前，維京人就開船到過冰島和格陵蘭。'] },
      { at: 0.78, name: '峽灣嚮導 Kari',
        look: { skin: '#f0cfb0', hair: '#8a5a3a', shirt: '#2f8a5a', pants: '#3a3a44', hat: 'cap', hatColor: '#ba0c2f', item: 'map' },
        lines: ['峽灣是冰河挖出來的山谷，後來海水灌進來。', '七姊妹瀑布對面有一道瀑布叫「求婚者」。', '挪威的海岸線拉直了，可以繞地球大半圈。'] }
    ],
    FI: [
      { at: 0.24, name: '雪橇犬主人 Aino',
        look: { skin: '#f3d6bc', hair: '#f0e0b0', shirt: '#e8eef4', pants: '#2a3a6a', hat: 'beanie', hatColor: '#002f6c', item: 'lamp' },
        lines: ['前面是極夜，太陽一整天都不會出來！', '暗的時候只看得到身邊 —— 等天上的極光亮起來再看路。', '極光一亮，整片雪地都看得清清楚楚。'] },
      { at: 0.1, name: '三溫暖老爹 Matti',
        look: { skin: '#e8b090', hair: '#cfcfcf', shirt: '#ffffff', pants: '#ffffff', hat: 'kerchief', hatColor: '#ffffff', item: 'towel' },
        lines: ['芬蘭有三百多萬間三溫暖，差不多每兩個人就有一間。', '蒸完三溫暖，跳進結冰的湖裡最過癮！', '三溫暖 sauna 這個字，就是從芬蘭語來的。'] },
      { at: 0.93, name: '聖誕郵局職員 Leena',
        look: { skin: '#f3d6bc', hair: '#c88a4a', shirt: '#c8202a', pants: '#2a2a36', hat: 'beanie', hatColor: '#c8202a', item: 'book' },
        lines: ['全世界的小朋友，每年寄幾十萬封信給聖誕老人。', '寄到這裡的信都會蓋上北極圈的郵戳。', '這裡冬天的極光，一年可以看到兩百多個晚上。'] },
      /*
       * v1.30 玩家：芬蘭關卡中有聖誕老人，靠近他可以拿到聖誕禮物（用途先不開發，但要記住玩家身上有）
       * 離終點遠一點（約 500px）：太近的話一拿到禮物就碰到終點，提示被過關畫面蓋掉、玩家根本沒看到。
       * → gift：第一次搭話時給一份，記在 Save.flag('gift')；game.js 收到 'gift' 事件跳提示。
       */
      { at: 0.86, name: '聖誕老人 Joulupukki', gift: 'gift',
        look: { skin: '#f3d0b8', hair: '#f4f4f0', shirt: '#c8202a', pants: '#c8202a', hat: 'santa', hatColor: '#c8202a', beard: true, item: 'gift' },
        lines: ['呵呵呵！你從那麼遠的地方來看我呀？', '這份聖誕禮物送給你 —— 先別拆，留到最需要的時候。', '在芬蘭，大家叫我 Joulupukki，意思是「聖誕山羊」。'] }
    ],
    IS: [
      { name: '火山學家 Guðrún',
        look: { skin: '#f3d6bc', hair: '#e8cf8a', shirt: '#e86a2a', pants: '#2a2a36', hat: 'helmet', hatColor: '#f1c40f', item: 'lamp' },
        lines: ['看他的劍！舉到頭上就是高掃 —— 站著別跳；壓低貼地就跳過去！', '冰島底下有一百多座火山，平均四、五年就有一座噴發。', '冰島有一成的土地被冰河蓋住，冰底下還有火山。'] }
    ],
    // ── 美洲篇（v1.31）──
    // 古巴（v1.31 改成往前衝的賽道關，沒有站在路邊的 NPC）
    JM: [
      { at: 0.1, name: '雷鬼歌手 Desmond',
        look: { skin: '#6a4a30', hair: '#1e1a18', shirt: '#2f9a4a', pants: '#2a2a36', hat: 'beanie', hatColor: '#f2c230', item: null },
        lines: ['壺嘴冒蒸氣就要沖水了 —— 站在濾杯旁邊，別站在正中間的熱水柱底下！', '熱水一沖下去，咖啡粉就會「悶蒸」鼓起來，把你托得高高的。', '雷鬼音樂 1960 年代在金斯敦誕生，巴布・馬利讓全世界都聽到了。'] },
      { at: 0.42, name: '咖啡農 Marcia',
        look: { skin: '#7a5236', hair: '#2a2018', shirt: '#f4f0e6', pants: '#6a8a4a', hat: 'straw', hatColor: '#e8d8a8', item: 'jar' },
        lines: ['藍山咖啡長在常年起霧的山上，豆子慢慢長，味道特別柔順。', '手沖的時候先倒一點點熱水，等咖啡粉膨脹、冒泡 —— 這叫「悶蒸」。', '藍山咖啡以前都裝在木桶裡運到日本，現在還有人照這個傳統。'] },
      { at: 0.8, name: '短跑選手 Usain',
        look: { skin: '#5a3a24', hair: '#1e1a18', shirt: '#f2c230', pants: '#2f9a4a', hat: null, item: null },
        lines: ['牙買加的人口不到三百萬，卻出了好多奧運短跑冠軍。', '跑步的祕訣？放鬆！越緊張越跑不快。', '1988 年牙買加還組了一支冬季奧運的雪橇隊 —— 這個國家根本不下雪！'] }
    ],
    PA: [
      { at: 0.1, name: '閘門管理員 Rodrigo',
        look: { skin: '#c8946a', hair: '#2a2420', shirt: '#e8a020', pants: '#3a3a44', hat: 'helmet', hatColor: '#f4f0e6', item: 'map' },
        lines: ['中間那道閘門跳不過去 —— 站上小船，等它升上去！', '小船升到頂的時候，翻過閘門跳到另一邊，那邊的船剛好降到底。', '一艘大船通過整條運河，大概要八到十個小時。'] },
      { at: 0.44, name: '水手 Lucía',
        look: { skin: '#b8845a', hair: '#3a2a20', shirt: '#f4f4f0', pants: '#1f3a8a', hat: 'cap', hatColor: '#1f3a8a', item: 'oar' },
        lines: ['運河讓船不用繞過整個南美洲 —— 少開一萬多公里！', '船閘裡的水不用幫浦，全靠中間加通湖的水往下流。', '每一艘船都要付過路費。1928 年有人游泳通過，只付了 36 美分！'] },
      { at: 0.86, name: '雨林嚮導 Iván',
        look: { skin: '#a8724a', hair: '#1e1a18', shirt: '#4a7a3a', pants: '#6a5a3a', hat: 'straw', hatColor: '#c8b890', item: 'lamp' },
        lines: ['運河兩旁都是雨林，樹上住著樹懶和巨嘴鳥。', '樹懶一個禮拜才下樹一次 —— 去上廁所。', '巴拿馬是南北美洲之間的陸橋，動物都從這裡走過去。'] }
    ],
    CO: [
      { at: 0.1, name: '城牆衛兵 Andrés',
        look: { skin: '#c8946a', hair: '#2a2420', shirt: '#1f3a8a', pants: '#f4f0e6', hat: 'tricorn', hatColor: '#16161c', item: 'spear' },
        lines: ['水道太寬跳不過去 —— 跳起來抓住海盜的盪繩！', '盪到往前衝的那一下按跳躍放手，就會飛到對岸。', '以前英國的海盜德瑞克，真的打進過這座城；城牆蓋了兩百年，就是為了擋海盜。'] },
      { at: 0.46, name: '水果小販 Palenquera',
        look: { skin: '#5a3a24', hair: '#1e1a18', shirt: '#f2c230', pants: '#d8262c', hat: 'kerchief', hatColor: '#2a6ab8', item: 'jar' },
        lines: ['我頂在頭上的這盆水果，是卡塔赫納的招牌風景！', '要不要來一杯芒果汁？還是熱帶的百香果？', '我們穿的黃、藍、紅，剛好就是哥倫比亞國旗的顏色。'] },
      { at: 0.84, name: '作家 Gabriel',
        look: { skin: '#c8946a', hair: '#cfcfcf', shirt: '#f4f0e6', pants: '#e8e0d0', hat: null, item: 'book' },
        lines: ['寫《百年孤寂》的馬奎斯，年輕時就在這座城裡當記者。', '他說這座城的陽台、九重葛和海風，全都寫進了他的小說。', '哥倫比亞的咖啡多半是一顆一顆用手摘的。'] }
    ],
    BR: [
      { name: '足球少女 Ana',
        look: { skin: '#a8724a', hair: '#2a1e18', shirt: '#f2c230', pants: '#2a4aa8', hat: null, item: null },
        lines: ['踩他的頭沒用 —— 把球踢進他身後的球門，進 4 球就贏！', '他丟完球會累倒在地上，這時候他擋不到球 —— 趕快帶球衝過去射門！', '他站著的時候看到高球會跳起來擋，那就踢貼地球。'] }
    ]
  };

  function specs(levelId) { return DATA[levelId] || []; }

  /**
   * 找站位。ctx：{ segs, gaps, platforms, secrets, features, enemies, goal, width }
   * 規則：踩在平坦實地上、不靠近斷崖、不站在密道入口（會擋住磚的提示）、
   * 不擋招牌機制（彈跳墊、間歇泉、荊棘）、不在漆黑鹽礦裡（看不到泡泡）、
   * 不被低平台蓋住、彼此至少隔 220。第一輪也避開地面敵人的巡邏區，找不到才放寬。
   */
  function place(list, ctx) {
    const out = [];
    function bad(x, strict) {
      const gl = LevelGen.groundAt(ctx.segs, x - 16), gm = LevelGen.groundAt(ctx.segs, x),
            gr = LevelGen.groundAt(ctx.segs, x + 16);
      if (gl == null || gm == null || gr == null || Math.abs(gl - gr) > 2 || Math.abs(gl - gm) > 2) return true;
      if (x < 220 || x > ctx.width - 60) return true;
      if (Math.abs(x - ctx.goal) < 160) return true;
      if (x > ctx.goal) return true;      // v1.30：終點後面走不到（碰到終點就過關了）
      if (ctx.gaps.some(function (g) { return x > g.x - 60 && x < g.x + g.w + 60; })) return true;
      if ((ctx.secrets || []).some(function (s) {
        const r = s.room;
        return x > r.x - 70 && x < r.x + r.w + 70;
      })) return true;
      if ((ctx.features || []).some(function (f) {
        if (f.type === 'dark' || f.type === 'aurora') return x > f.x0 - 40 && x < f.x1 + 40;   // 黑暗裡看不到泡泡
        if (f.type === 'flood') return x > f.x0 - 60 && x < f.x1 + 60;      // 泡在海裡講不了話
        // 石柱：倒下的範圍在柱子左邊 150（站那裡會被壓到）；駱駝：整段來回走的範圍
        if (f.type === 'column') return x > f.x - 230 && x < f.x + 100;
        if (f.type === 'camel') return x > f.x0 - 70 && x < f.x1 + 160;
        if (f.x == null || f.w == null) return false;
        return x > f.x - 70 && x < f.x + f.w + 70;
      })) return true;
      if (ctx.platforms.some(function (p) { return x + 18 > p.x && x - 18 < p.x + p.w && p.y > gm - 80; })) return true;
      if (out.some(function (n) { return Math.abs(n.x - x) < 220; })) return true;
      if (strict && (ctx.enemies || []).some(function (e) {
        return e.y == null && x > e.left - 40 && x < e.right + 60;
      })) return true;
      return false;
    }
    // 送禮物的特別 NPC（聖誕老人）先挑位置，才不會被別人佔走、擠到終點旁邊
    list.filter(function (sp) { return sp.gift; }).concat(list.filter(function (sp) { return !sp.gift; })).forEach(function (sp) {
      const want = Math.round(ctx.width * sp.at);
      for (let pass = 0; pass < 2; pass++) {
        for (let d = 0; d <= 2400; d += 20) {
          const cands = d === 0 ? [want] : [want + d, want - d];
          for (let k = 0; k < cands.length; k++) {
            if (bad(cands[k], pass === 0)) continue;
            out.push({ x: cands[k], y: LevelGen.groundAt(ctx.segs, cands[k]), name: sp.name, look: sp.look, lines: sp.lines, gift: sp.gift });
            return;
          }
        }
      }
    });
    return out;
  }

  /** 魔王關：站在出生點左邊，玩家一開場就在他旁邊 */
  function placeBoss(levelId, groundY) {
    return specs(levelId).slice(0, 1).map(function (sp) {
      return { x: 52, y: groundY, name: sp.name, look: sp.look, lines: sp.lines };
    });
  }

  // ── 執行期 ─────────────────────────────────────────────

  const TALK_R = 90;      // 水平距離多近開始講
  function lineTime(s) { return Math.max(170, s.length * 9); }

  function makeState(def) {
    return (def.npcs || []).map(function (n) {
      return { x: n.x, y: n.y, name: n.name, look: n.look, lines: n.lines, gift: n.gift,
        line: 0, timer: 0, talking: false, talked: false, fade: 0, face: -1 };
    });
  }

  function update(state) {
    const events = [];
    (state.npcs || []).forEach(function (n) {
      let best = null, bd = 1e9;
      state.players.forEach(function (p) {
        if (p.out) return;
        const d = Math.abs(p.x + p.w / 2 - n.x);
        if (d < bd && Math.abs(p.y + p.h - n.y) < 110) { bd = d; best = p; }
      });
      const near = best && bd < TALK_R;
      if (best && bd < 260) n.face = best.x + best.w / 2 > n.x ? 1 : -1;
      if (near) {
        if (!n.talking) { n.talking = true; n.timer = 0; }
        if (!n.talked) {
          n.talked = true; events.push('npc');
          // 聖誕老人送禮物：一人只有一份
          if (n.gift && typeof Save !== 'undefined' && !Save.flag(n.gift)) { Save.setFlag(n.gift, 1); events.push('gift'); }
        }
        if (++n.timer > lineTime(n.lines[n.line])) {
          n.timer = 0;
          n.line = (n.line + 1) % n.lines.length;
          events.push('npcline');
        }
      } else if (n.talking) {
        n.talking = false;
        // 講到一半走掉，下次從下一句接著講（才不會一直重聽第一句）
        if (n.timer > 40) n.line = (n.line + 1) % n.lines.length;
      }
      n.fade = U.clamp(n.fade + (n.talking ? 0.12 : -0.08), 0, 1);
    });
    return events;
  }

  // ── 繪製 ──────────────────────────────────────────────

  function drawHat(ctx, L, hx, hy) {
    const c = L.hatColor || '#2a2a36';
    ctx.fillStyle = c;
    switch (L.hat) {
      case 'beret':
        ctx.beginPath(); ctx.ellipse(hx + 1, hy - 7, 10, 4, -0.15, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(hx, hy - 12, 2, 3);
        break;
      case 'beanie':
        // 北歐毛線帽（v1.30）：圓頂＋白色反摺邊＋頂上的毛球
        ctx.beginPath(); ctx.arc(hx, hy - 6, 9, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#f4f4f0';
        ctx.fillRect(hx - 9, hy - 7, 18, 4);
        ctx.beginPath(); ctx.arc(hx, hy - 16, 3.5, 0, Math.PI * 2); ctx.fill();
        break;
      case 'chef':
        ctx.fillRect(hx - 7, hy - 10, 14, 5);
        ctx.beginPath(); ctx.arc(hx - 4, hy - 15, 5, 0, Math.PI * 2); ctx.arc(hx + 4, hy - 15, 5, 0, Math.PI * 2); ctx.arc(hx, hy - 18, 5, 0, Math.PI * 2); ctx.fill();
        break;
      case 'santa':
        // 聖誕帽：往後垂的紅色尖帽＋白色毛邊＋尾巴的白毛球
        ctx.beginPath(); ctx.moveTo(hx - 9, hy - 5); ctx.quadraticCurveTo(hx - 2, hy - 22, hx - 14, hy - 16); ctx.lineTo(hx + 9, hy - 5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f4f4f0';
        ctx.fillRect(hx - 10, hy - 7, 20, 4);
        ctx.beginPath(); ctx.arc(hx - 14, hy - 16, 3, 0, Math.PI * 2); ctx.fill();
        break;
      case 'cap':
        ctx.beginPath(); ctx.arc(hx, hy - 5, 8.5, Math.PI, 0); ctx.fill();
        ctx.fillRect(hx, hy - 6, 12, 3);
        break;
      case 'scarf':
      case 'kerchief':
        ctx.beginPath(); ctx.arc(hx, hy - 3, 9.2, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(hx + 9, hy - 1); ctx.lineTo(hx - 9, hy - 1); ctx.fill();
        if (L.hat === 'scarf') { ctx.beginPath(); ctx.moveTo(hx - 8, hy + 2); ctx.lineTo(hx - 13, hy + 9); ctx.lineTo(hx - 5, hy + 6); ctx.fill(); }
        break;
      case 'wreath':
        for (let i = 0; i < 7; i++) {
          const a = Math.PI + i * Math.PI / 6;
          ctx.fillStyle = i % 2 ? c : '#5a9a3a';
          ctx.beginPath(); ctx.arc(hx + Math.cos(a) * 8.5, hy - 3 + Math.sin(a) * 7, 2.6, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case 'helmet':
        ctx.beginPath(); ctx.arc(hx, hy - 4, 9.5, Math.PI, 0); ctx.fill();
        ctx.fillRect(hx - 11, hy - 5, 22, 2.5);
        if (L.item === 'lamp' || c === '#e0b030') { ctx.fillStyle = '#fff2a8'; ctx.beginPath(); ctx.arc(hx + 2, hy - 10, 2.5, 0, Math.PI * 2); ctx.fill(); }
        break;
      case 'straw':
        ctx.fillRect(hx - 13, hy - 6, 26, 3);
        ctx.fillRect(hx - 6, hy - 12, 12, 7);
        break;
      case 'fur':
        ctx.fillRect(hx - 9, hy - 14, 18, 10);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(hx - 9, hy - 14, 18, 2);
        break;
      case 'tricorn':
        ctx.beginPath(); ctx.moveTo(hx - 11, hy - 5); ctx.lineTo(hx, hy - 15); ctx.lineTo(hx + 11, hy - 5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f2f2f2'; ctx.fillRect(hx + 3, hy - 13, 2, 6);   // 帽上的羽毛
        break;
      default: break;
    }
  }

  function drawItem(ctx, it, x, y, t) {
    switch (it) {
      case 'gift': ctx.fillStyle = '#2f9a4a'; ctx.fillRect(x - 6, y - 10, 12, 10); ctx.fillStyle = '#f2c94c'; ctx.fillRect(x - 1, y - 10, 2, 10); ctx.fillRect(x - 6, y - 6, 12, 2); ctx.beginPath(); ctx.arc(x - 2.5, y - 12, 2.5, 0, Math.PI * 2); ctx.arc(x + 2.5, y - 12, 2.5, 0, Math.PI * 2); ctx.fill(); break;
      case 'baguette': ctx.fillStyle = '#d9a35a'; ctx.save(); ctx.translate(x, y); ctx.rotate(-0.9); U.roundRect(ctx, -3, -16, 6, 30, 3); ctx.fill(); ctx.restore(); break;
      case 'brush': ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x - 1, y - 14, 2, 14); ctx.fillStyle = '#3a7ad0'; ctx.fillRect(x - 2, y - 18, 4, 5); break;
      case 'mug': ctx.fillStyle = '#f2e6b0'; ctx.fillRect(x - 4, y - 9, 8, 10); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 4, y - 11, 8, 3); ctx.strokeStyle = '#d9c890'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 4, y - 7, 3, 5); break;
      case 'pretzel': ctx.strokeStyle = '#a0602a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x - 3, y - 5, 4, 0, Math.PI * 2); ctx.arc(x + 4, y - 5, 4, 0, Math.PI * 2); ctx.stroke(); break;
      case 'pan': ctx.fillStyle = '#3a3a42'; ctx.fillRect(x, y - 2, 10, 2); ctx.beginPath(); ctx.ellipse(x - 4, y - 2, 8, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f0b030'; ctx.beginPath(); ctx.ellipse(x - 4, y - 3.5, 6, 2, 0, 0, Math.PI * 2); ctx.fill(); break;
      case 'trumpet': ctx.fillStyle = '#e8c040'; ctx.fillRect(x - 2, y - 4, 14, 3); ctx.beginPath(); ctx.moveTo(x + 12, y - 2.5); ctx.lineTo(x + 17, y - 7); ctx.lineTo(x + 17, y + 2); ctx.closePath(); ctx.fill(); break;
      case 'lamp': {
        ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x - 3, y - 2, 6, 9);
        const g = 0.5 + Math.sin(t * 0.1) * 0.15;
        ctx.fillStyle = 'rgba(255, 220, 120, ' + g.toFixed(3) + ')'; ctx.beginPath(); ctx.arc(x, y + 3, 7, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'cube': {
        const cs = ['#d02a2a', '#f2f2f2', '#2a6ad0', '#f0c020', '#2aa04a', '#f07a20'];
        for (let i = 0; i < 9; i++) { ctx.fillStyle = cs[(i * 5 + Math.floor(t / 40)) % 6]; ctx.fillRect(x - 5 + (i % 3) * 3.5, y - 9 + Math.floor(i / 3) * 3.5, 3, 3); }
        break;
      }
      case 'towel': ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, y - 4, 6, 14); ctx.fillStyle = '#7ab0e0'; ctx.fillRect(x - 3, y + 6, 6, 2); break;
      case 'crook': ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.lineTo(x, y - 22); ctx.arc(x + 4, y - 22, 4, Math.PI, 0); ctx.stroke(); break;
      case 'net': ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.lineTo(x, y - 14); ctx.stroke(); ctx.strokeStyle = 'rgba(230,230,230,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y - 19, 6, 0, Math.PI * 2); ctx.moveTo(x - 6, y - 19); ctx.lineTo(x + 6, y - 19); ctx.moveTo(x, y - 25); ctx.lineTo(x, y - 13); ctx.stroke(); break;
      case 'spear': ctx.strokeStyle = '#6a5040'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.lineTo(x, y - 30); ctx.stroke(); ctx.fillStyle = '#c8ccd2'; ctx.beginPath(); ctx.moveTo(x, y - 38); ctx.lineTo(x + 3.5, y - 29); ctx.lineTo(x - 3.5, y - 29); ctx.closePath(); ctx.fill(); break;
      case 'oar': ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x, y - 24); ctx.lineTo(x, y + 8); ctx.stroke(); ctx.fillStyle = '#8a6a4a'; U.roundRect(ctx, x - 4, y + 6, 8, 12, 3); ctx.fill(); break;
      case 'rose': ctx.strokeStyle = '#3a8a3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x, y - 10); ctx.stroke(); ctx.fillStyle = '#e8406a'; ctx.beginPath(); ctx.arc(x, y - 12, 3.5, 0, Math.PI * 2); ctx.fill(); break;
      case 'jar': ctx.fillStyle = '#f2ecd8'; U.roundRect(ctx, x - 4, y - 8, 9, 10, 2); ctx.fill(); ctx.fillStyle = '#c84a2a'; ctx.fillRect(x - 4, y - 10, 9, 3); break;
      case 'book': ctx.fillStyle = '#7a2a2a'; ctx.fillRect(x - 5, y - 8, 9, 11); ctx.fillStyle = '#f2e6c8'; ctx.fillRect(x - 4, y - 7, 1.5, 9); break;
      case 'map': ctx.fillStyle = '#f2e6c8'; ctx.fillRect(x - 6, y - 10, 11, 13); ctx.strokeStyle = '#c84a2a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x - 1, y - 5); ctx.lineTo(x + 3, y - 3); ctx.stroke(); break;
      default: break;
    }
  }

  /** 一位 NPC。(sx, gy) = 腳底中心的畫面座標 */
  function drawOne(ctx, n, sx, gy, t) {
    const L = n.look;
    const bob = Math.sin(t * 0.08 + n.x * 0.01) * (n.talking ? 1.4 : 0.6);
    ctx.save();
    ctx.translate(sx, gy);
    ctx.scale(n.face, 1);
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
    // 腿
    ctx.fillStyle = L.pants;
    ctx.fillRect(-6, -13, 5, 13); ctx.fillRect(1, -13, 5, 13);
    ctx.fillStyle = '#2a2020';
    ctx.fillRect(-7, -2, 6, 2); ctx.fillRect(1, -2, 7, 2);
    ctx.translate(0, bob * 0.3);
    // 身體
    ctx.fillStyle = L.shirt;
    U.roundRect(ctx, -9, -31, 18, 19, 5); ctx.fill();
    if (L.apron) { ctx.fillStyle = L.apron; ctx.fillRect(-6, -24, 12, 13); }
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
    U.roundRect(ctx, -9, -31, 18, 19, 5); ctx.stroke();
    // 手臂：講話時前面那隻手會比手畫腳
    const wave = n.talking ? Math.sin(t * 0.25) * 0.5 : 0;
    ctx.fillStyle = L.shirt;
    ctx.save(); ctx.translate(-8, -28); ctx.rotate(0.15); ctx.fillRect(-2.5, 0, 5, 13); ctx.fillStyle = L.skin; ctx.fillRect(-2.5, 12, 5, 3); ctx.restore();
    ctx.save(); ctx.translate(8, -28); ctx.rotate(-0.5 - wave);
    ctx.fillRect(-2.5, 0, 5, 13); ctx.fillStyle = L.skin; ctx.fillRect(-2.5, 12, 5, 3);
    if (L.item) drawItem(ctx, L.item, 0, 15, t);
    ctx.restore();
    // 頭
    const hy = -40 + bob * 0.5;
    ctx.fillStyle = L.skin;
    ctx.beginPath(); ctx.arc(0, hy, 8.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = L.hair;
    ctx.beginPath(); ctx.arc(0, hy - 1, 8.8, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    ctx.fillRect(-8.6, hy - 3, 3, 6);
    // 眼睛 + 嘴（講話時嘴巴開合）
    ctx.fillStyle = '#1e1a1a';
    ctx.fillRect(2, hy - 1, 2, 2.5); ctx.fillRect(6, hy - 1, 1.6, 2.5);
    const mouth = n.talking && Math.floor(t / 7) % 2 === 0 ? 2.5 : 1;
    ctx.fillStyle = '#8a3a3a'; ctx.fillRect(3, hy + 4, 3, mouth);
    ctx.fillStyle = 'rgba(230, 120, 120, 0.35)'; ctx.fillRect(5.5, hy + 1.5, 3, 2);
    if (L.beard) {
      // 白色大鬍子（聖誕老人）：蓋住下半張臉，講話時跟著上下動
      ctx.fillStyle = '#f4f4f0';
      ctx.beginPath(); ctx.moveTo(-6, hy + 1); ctx.quadraticCurveTo(2, hy + 18 + mouth, 9, hy + 2); ctx.lineTo(9, hy + 4); ctx.lineTo(-6, hy + 4); ctx.closePath(); ctx.fill();
      ctx.fillRect(2, hy + 2, 7, 2);
      // 黑腰帶＋金扣
      ctx.fillStyle = '#1e1a1a'; ctx.fillRect(-9, -20, 18, 3);
      ctx.fillStyle = '#f2c94c'; ctx.fillRect(-2, -20.5, 4, 4);
    }
    drawHat(ctx, L, 0, hy);
    ctx.restore();
  }

  function draw(ctx, state, camX, t) {
    (state.npcs || []).forEach(function (n) {
      const sx = n.x - camX;
      if (sx < -40 || sx > 1000) return;
      drawOne(ctx, n, sx, n.y, t);
      // 還沒搭過話：頭上冒「⋯」吸引注意
      if (!n.talked) {
        const by = n.y - 66 + Math.sin(t * 0.1 + n.x) * 2;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        U.roundRect(ctx, sx - 13, by - 8, 26, 15, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(sx - 3, by + 7); ctx.lineTo(sx + 3, by + 7); ctx.lineTo(sx, by + 11); ctx.fill();
        ctx.fillStyle = '#4a5068';
        for (let i = 0; i < 3; i++) {
          const on = Math.floor(t / 14) % 4 > i;
          ctx.globalAlpha = on ? 1 : 0.3;
          ctx.beginPath(); ctx.arc(sx - 6 + i * 6, by, 1.8, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    });
  }

  /** 中文斷行：依寬度切，不讓「，。！？」落在行首 */
  function wrap(ctx, s, maxW) {
    const rows = [];
    let cur = '';
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (cur && ctx.measureText(cur + ch).width > maxW && !/[，。！？、」）：；…—]/.test(ch)) {
        rows.push(cur); cur = ch;
      } else cur += ch;
    }
    if (cur) rows.push(cur);
    // 最後一行只剩 1~2 個字（像「行。」）很難看：從上一行挪幾個字下來
    const n = rows.length;
    if (n > 1 && rows[n - 1].length <= 3) {
      const take = Math.min(4, rows[n - 2].length - 4);
      if (take > 0) {
        rows[n - 1] = rows[n - 2].slice(-take) + rows[n - 1];
        rows[n - 2] = rows[n - 2].slice(0, -take);
      }
    }
    return rows;
  }

  const BUBBLE_W = 250;
  const FONT = '600 13px "Segoe UI", "Microsoft JhengHei", sans-serif';

  /** 泡泡尺寸（測試也會用，確認每句都塞得進泡泡） */
  function bubbleRows(ctx, s) {
    ctx.save(); ctx.font = FONT;
    const rows = wrap(ctx, s, BUBBLE_W - 22);
    ctx.restore();
    return rows;
  }

  function drawBubbles(ctx, state, camX, t, W) {
    (state.npcs || []).forEach(function (n) {
      if (n.fade <= 0) return;
      const sx = n.x - camX;
      if (sx < -200 || sx > W + 200) return;
      const s = n.lines[n.line];
      ctx.save();
      ctx.globalAlpha = n.fade;
      ctx.font = FONT;
      const rows = wrap(ctx, s, BUBBLE_W - 22);
      const wTxt = rows.reduce(function (m, r) { return Math.max(m, ctx.measureText(r).width); }, 0);
      const bw = Math.max(120, Math.ceil(wTxt) + 22);
      const bh = 28 + rows.length * 18;
      const bx = U.clamp(sx - bw / 2, 8, W - bw - 8);
      const by = n.y - 62 - bh + (1 - n.fade) * 6;
      ctx.fillStyle = 'rgba(255, 252, 244, 0.97)';
      U.roundRect(ctx, bx, by, bw, bh, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(60, 50, 40, 0.5)'; ctx.lineWidth = 1.5;
      U.roundRect(ctx, bx, by, bw, bh, 10); ctx.stroke();
      // 尾巴指向說話的人
      const tx = U.clamp(sx, bx + 14, bx + bw - 14);
      ctx.fillStyle = 'rgba(255, 252, 244, 0.97)';
      ctx.beginPath(); ctx.moveTo(tx - 7, by + bh - 1); ctx.lineTo(tx + 7, by + bh - 1); ctx.lineTo(sx, by + bh + 10); ctx.closePath(); ctx.fill();
      // 名字 + 第幾句
      U.text(ctx, n.name, bx + 11, by + 13, { size: 11, align: 'left', color: '#b5762a', stroke: false, weight: 700 });
      U.text(ctx, (n.line + 1) + '/' + n.lines.length, bx + bw - 10, by + 13, { size: 10, align: 'right', color: '#a09888', stroke: false });
      rows.forEach(function (r, i) {
        U.text(ctx, r, bx + 11, by + 32 + i * 18, { size: 13, align: 'left', color: '#2e2a26', stroke: false });
      });
      // 這句的剩餘時間（細進度條）
      ctx.fillStyle = 'rgba(181, 118, 42, 0.45)';
      ctx.fillRect(bx + 10, by + bh - 5, (bw - 20) * U.clamp(n.timer / lineTime(s), 0, 1), 2);
      ctx.restore();
    });
  }

  return {
    specs: specs,
    place: place,
    placeBoss: placeBoss,
    makeState: makeState,
    update: update,
    draw: draw,
    drawBubbles: drawBubbles,
    bubbleRows: bubbleRows,
    TALK_R: TALK_R,
    ids: Object.keys(DATA)
  };
})();
