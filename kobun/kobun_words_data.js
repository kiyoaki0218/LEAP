/* 古文単語330 — 1章 読解必修語（50語）
   出典: 古文単語データ/【全訳】古文単語1~50.xlsx
   id = 10001 + (冊内番号 - 1) / part 101 = 1章
   ※ 2章〜5章は語データ追加時に KOBUN_PARTS と part を追記する
*/
const KOBUN_WORDS_DATA = [
  {"id": 10001, "num": 1, "word": "おどろく", "reading": "おどろく", "meaning": "（はっと）気づく。、（ふと）目を覚ます。", "part": 101, "subject": "kobun"},
  {"id": 10002, "num": 2, "word": "ののしる", "reading": "ののしる", "meaning": "大声で騒ぐ。、評判になる。うわさになる。", "part": 101, "subject": "kobun"},
  {"id": 10003, "num": 3, "word": "ねんず", "reading": "ねんず", "meaning": "（心の中で）祈る。、がまんする。", "part": 101, "subject": "kobun"},
  {"id": 10004, "num": 4, "word": "おぼゆ", "reading": "おぼゆ", "meaning": "（自然に）思われる。、似る。似ている。、思い出される。、（人から）思われる。", "part": 101, "subject": "kobun"},
  {"id": 10005, "num": 5, "word": "しのぶ", "reading": "しのぶ", "meaning": "〔耐え忍ぶ〕がまんする。恋心を包み隠す。、〔人目を忍ぶ〕人目を避ける。", "part": 101, "subject": "kobun"},
  {"id": 10006, "num": 6, "word": "ながむ", "reading": "ながむ", "meaning": "もの思いに沈む。（もの思いに沈んで）ぼんやり見る。", "part": 101, "subject": "kobun"},
  {"id": 10007, "num": 7, "word": "みゆ", "reading": "みゆ", "meaning": "（自然と）見える。思われる。、姿を見せる。現れる。、（人から）見られる。見せる。結婚する。", "part": 101, "subject": "kobun"},
  {"id": 10008, "num": 8, "word": "あふ", "reading": "あふ", "meaning": "結婚する。男女が契る。", "part": 101, "subject": "kobun"},
  {"id": 10009, "num": 9, "word": "ゐる", "reading": "ゐる", "meaning": "座る。動かずにいる。、〜ている。", "part": 101, "subject": "kobun"},
  {"id": 10010, "num": 10, "word": "ありく", "reading": "ありく", "meaning": "動き回る。出歩く。外出する。、（〜して）まわる。（時間に）〜し続ける。", "part": 101, "subject": "kobun"},
  {"id": 10011, "num": 11, "word": "あく", "reading": "あく", "meaning": "満足する。、〔「飽かず」の形で〕満ち足りない。いやにならない。", "part": 101, "subject": "kobun"},
  {"id": 10012, "num": 12, "word": "うつくし", "reading": "うつくし", "meaning": "かわいらしい。、立派だ。", "part": 101, "subject": "kobun"},
  {"id": 10013, "num": 13, "word": "かなし", "reading": "かなし", "meaning": "いとしい。かわいい。", "part": 101, "subject": "kobun"},
  {"id": 10014, "num": 14, "word": "いみじ", "reading": "いみじ", "meaning": "とても。たいそう。、とてもうれしい。、とても悲しい。ひどい。大変だ。", "part": 101, "subject": "kobun"},
  {"id": 10015, "num": 15, "word": "をかし", "reading": "をかし", "meaning": "趣がある。おもしろい。、美しい。かわいい。、滑稽だ。", "part": 101, "subject": "kobun"},
  {"id": 10016, "num": 16, "word": "よし", "reading": "よし", "meaning": "よい。すぐれている。、身分が高く教養がある。", "part": 101, "subject": "kobun"},
  {"id": 10017, "num": 17, "word": "あやし", "reading": "あやし", "meaning": "不思議だ。変だ。、けしからん。よくない。、身分が低い。卑しい。、粗末だ。みすぼらしい。", "part": 101, "subject": "kobun"},
  {"id": 10018, "num": 18, "word": "おとなし", "reading": "おとなし", "meaning": "大人らしい。大人びている。、年配だ。（年長で）主だっている。、（年配で）思慮分別がある。", "part": 101, "subject": "kobun"},
  {"id": 10019, "num": 19, "word": "ゆかし", "reading": "ゆかし", "meaning": "見たい。聞きたい。知りたい。", "part": 101, "subject": "kobun"},
  {"id": 10020, "num": 20, "word": "おぼつかなし", "reading": "おぼつかなし", "meaning": "ぼんやりしている。はっきりしない。、気がかりだ。不安だ。、待ち遠しい。もどかしい。", "part": 101, "subject": "kobun"},
  {"id": 10021, "num": 21, "word": "ありがたし", "reading": "ありがたし", "meaning": "めったにない。、（めったにないほど）立派だ。すぐれている。", "part": 101, "subject": "kobun"},
  {"id": 10022, "num": 22, "word": "めでたし", "reading": "めでたし", "meaning": "すばらしい。立派だ。", "part": 101, "subject": "kobun"},
  {"id": 10023, "num": 23, "word": "くちをし", "reading": "くちをし", "meaning": "残念だ。期待はずれだ。", "part": 101, "subject": "kobun"},
  {"id": 10024, "num": 24, "word": "うし", "reading": "うし", "meaning": "つらい。いやだ。", "part": 101, "subject": "kobun"},
  {"id": 10025, "num": 25, "word": "わびし", "reading": "わびし", "meaning": "つらい。困ったことだ。、興ざめだ。もの足りない。", "part": 101, "subject": "kobun"},
  {"id": 10026, "num": 26, "word": "あはれなり", "reading": "あはれなり", "meaning": "心もしみじみと感じられる。", "part": 101, "subject": "kobun"},
  {"id": 10027, "num": 27, "word": "おろかなり", "reading": "おろかなり", "meaning": "おろそかだ。いい加減だ。、（〜という）言葉では言い尽くせない。", "part": 101, "subject": "kobun"},
  {"id": 10028, "num": 28, "word": "ねんごろなり", "reading": "ねんごろなり", "meaning": "熱心だ。丁寧だ。、親しい。親密だ。", "part": 101, "subject": "kobun"},
  {"id": 10029, "num": 29, "word": "つれづれなり", "reading": "つれづれなり", "meaning": "退屈だ。手持ちぶさただ。、しんみりと寂しい。", "part": 101, "subject": "kobun"},
  {"id": 10030, "num": 30, "word": "いたづらなり", "reading": "いたづらなり", "meaning": "むだだ。役に立たない。、手持ちぶさただ。暇だ。", "part": 101, "subject": "kobun"},
  {"id": 10031, "num": 31, "word": "としごろ", "reading": "としごろ", "meaning": "長年。数年（の間）。", "part": 101, "subject": "kobun"},
  {"id": 10032, "num": 32, "word": "かたち", "reading": "かたち", "meaning": "容貌。人の姿。、姿。形。", "part": 101, "subject": "kobun"},
  {"id": 10033, "num": 33, "word": "かげ", "reading": "かげ", "meaning": "光。、姿。", "part": 101, "subject": "kobun"},
  {"id": 10034, "num": 34, "word": "ほい", "reading": "ほい", "meaning": "かねてからの願い。本来の目的。宿願。", "part": 101, "subject": "kobun"},
  {"id": 10035, "num": 35, "word": "ものがたり", "reading": "ものがたり", "meaning": "雑談。世間話。、物語。", "part": 101, "subject": "kobun"},
  {"id": 10036, "num": 36, "word": "ふみ", "reading": "ふみ", "meaning": "手紙。、漢詩。漢文。学問。", "part": 101, "subject": "kobun"},
  {"id": 10037, "num": 37, "word": "ほど", "reading": "ほど", "meaning": "時。時分。间。、あたり。距離。長さ。広さ。、身分。身のほど。年齢。間柄。、様子。程度。ほど。", "part": 101, "subject": "kobun"},
  {"id": 10038, "num": 38, "word": "なさけ", "reading": "なさけ", "meaning": "思いやり。人情。、男女間の情愛。恋情。、情趣を解する心。風流心。", "part": 101, "subject": "kobun"},
  {"id": 10039, "num": 39, "word": "ちぎり", "reading": "ちぎり", "meaning": "約束。、前世からの因縁。宿縁。、男女の仲。逢瀬。", "part": 101, "subject": "kobun"},
  {"id": 10040, "num": 40, "word": "けしき", "reading": "けしき", "meaning": "様子。そぶり。、機嫌。顔色。、思い。意向。", "part": 101, "subject": "kobun"},
  {"id": 10041, "num": 41, "word": "いと", "reading": "いと", "meaning": "とても。たいそう。実に。、たいして（〜ない）。それほど（〜ない）。", "part": 101, "subject": "kobun"},
  {"id": 10042, "num": 42, "word": "あまた", "reading": "あまた", "meaning": "たくさん。数多く。", "part": 101, "subject": "kobun"},
  {"id": 10043, "num": 43, "word": "げに", "reading": "げに", "meaning": "なるほど。本当に。", "part": 101, "subject": "kobun"},
  {"id": 10044, "num": 44, "word": "なほ", "reading": "なほ", "meaning": "やはり。", "part": 101, "subject": "kobun"},
  {"id": 10045, "num": 45, "word": "やがて", "reading": "やがて", "meaning": "そのまま。、すぐに。", "part": 101, "subject": "kobun"},
  {"id": 10046, "num": 46, "word": "やうやう", "reading": "やうやう", "meaning": "だんだん。しだいに。", "part": 101, "subject": "kobun"},
  {"id": 10047, "num": 47, "word": "え〜打消", "reading": "え〜打消", "meaning": "〜できない。", "part": 101, "subject": "kobun"},
  {"id": 10048, "num": 48, "word": "な〜そ", "reading": "な〜そ", "meaning": "〜（する）な。〜（し）てくれるな。", "part": 101, "subject": "kobun"},
  {"id": 10049, "num": 49, "word": "さらに〜打消", "reading": "さらに〜打消", "meaning": "まったく〜ない。決して〜ない。", "part": 101, "subject": "kobun"},
  {"id": 10050, "num": 50, "word": "いかで・いかでか", "reading": "いかで・いかでか", "meaning": "どうして（〜か）。、どうして（〜か、いや〜ない）。、どうにかして（〜たい・〜てほしい・〜よう）。", "part": 101, "subject": "kobun"}
];

const KOBUN_PARTS = [
  { id: 101, name: "1章 読解必修語", desc: "読解必修語（50語）", start: 10001, end: 10050 }
];
