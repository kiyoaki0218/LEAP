/* 全国一斉模試: 志望校マスタ
   - 画面では「大学名＋学部名」を選ぶ
   - 集計・判定は MOCK_UNIV_GROUPS の groupId（大学 × 文理区分）単位で行う
   - 各学部は id / univ / faculty / groupId を持つ
   注: クラシックスクリプト。index.html のインライン JS より先に読み込む。
       index.html / js/core.js とトップレベルの宣言名を重複させない。 */

// 大学 × 文理区分のグループ定義（tier: 1=最難関 / 2=難関 / 3=中堅 / 4=チャレンジ）
const MOCK_UNIV_GROUPS = {
  // ==== 国公立（関西） ====
  kyoto_bun: { name: "京都大学（文系）", univ: "京都大学", tier: 1, category: "国公立" },
  kyoto_ri: { name: "京都大学（理系）", univ: "京都大学", tier: 1, category: "国公立" },
  osaka_bun: { name: "大阪大学（文系）", univ: "大阪大学", tier: 1, category: "国公立" },
  osaka_ri: { name: "大阪大学（理系）", univ: "大阪大学", tier: 1, category: "国公立" },
  kobe_bun: { name: "神戸大学（文系）", univ: "神戸大学", tier: 1, category: "国公立" },
  kobe_ri: { name: "神戸大学（理系）", univ: "神戸大学", tier: 1, category: "国公立" },
  osakafu_bun: { name: "大阪公立大学（文系）", univ: "大阪公立大学", tier: 2, category: "国公立" },
  osakafu_ri: { name: "大阪公立大学（理系）", univ: "大阪公立大学", tier: 2, category: "国公立" },
  kyotofu_bun: { name: "京都府立大学（文系）", univ: "京都府立大学", tier: 2, category: "国公立" },
  kyotofu_ri: { name: "京都府立大学（理系）", univ: "京都府立大学", tier: 2, category: "国公立" },
  nara_bun: { name: "奈良女子大学（文系）", univ: "奈良女子大学", tier: 2, category: "国公立" },
  nara_ri: { name: "奈良女子大学（理系）", univ: "奈良女子大学", tier: 2, category: "国公立" },
  wakayama_bun: { name: "和歌山大学（文系）", univ: "和歌山大学", tier: 3, category: "国公立" },
  wakayama_ri: { name: "和歌山大学（理系）", univ: "和歌山大学", tier: 3, category: "国公立" },
  shiga_bun: { name: "滋賀大学（文系）", univ: "滋賀大学", tier: 3, category: "国公立" },
  shiga_ri: { name: "滋賀大学（理系）", univ: "滋賀大学", tier: 3, category: "国公立" },

  // ==== 国公立（関西圏以外の有名大） ====
  todai_bun: { name: "東京大学（文系）", univ: "東京大学", tier: 1, category: "国公立" },
  todai_ri: { name: "東京大学（理系）", univ: "東京大学", tier: 1, category: "国公立" },
  hitotsubashi_bun: { name: "一橋大学（文系）", univ: "一橋大学", tier: 1, category: "国公立" },
  tokodai_ri: { name: "東京科学大学（理系）", univ: "東京科学大学", tier: 1, category: "国公立" },
  hokkaido_bun: { name: "北海道大学（文系）", univ: "北海道大学", tier: 1, category: "国公立" },
  hokkaido_ri: { name: "北海道大学（理系）", univ: "北海道大学", tier: 1, category: "国公立" },
  tohoku_bun: { name: "東北大学（文系）", univ: "東北大学", tier: 1, category: "国公立" },
  tohoku_ri: { name: "東北大学（理系）", univ: "東北大学", tier: 1, category: "国公立" },
  nagoya_bun: { name: "名古屋大学（文系）", univ: "名古屋大学", tier: 1, category: "国公立" },
  nagoya_ri: { name: "名古屋大学（理系）", univ: "名古屋大学", tier: 1, category: "国公立" },
  kyushu_bun: { name: "九州大学（文系）", univ: "九州大学", tier: 1, category: "国公立" },
  kyushu_ri: { name: "九州大学（理系）", univ: "九州大学", tier: 1, category: "国公立" },
  tsukuba_bun: { name: "筑波大学（文系）", univ: "筑波大学", tier: 2, category: "国公立" },
  tsukuba_ri: { name: "筑波大学（理系）", univ: "筑波大学", tier: 2, category: "国公立" },
  hiroshima_bun: { name: "広島大学（文系）", univ: "広島大学", tier: 2, category: "国公立" },
  hiroshima_ri: { name: "広島大学（理系）", univ: "広島大学", tier: 2, category: "国公立" },
  okayama_bun: { name: "岡山大学（文系）", univ: "岡山大学", tier: 2, category: "国公立" },
  okayama_ri: { name: "岡山大学（理系）", univ: "岡山大学", tier: 2, category: "国公立" },

  // ==== 関関同立 ====
  doshisha_bun: { name: "同志社大学（文系）", univ: "同志社大学", tier: 2, category: "関関同立" },
  doshisha_ri: { name: "同志社大学（理系）", univ: "同志社大学", tier: 2, category: "関関同立" },
  kansai_bun: { name: "関西学院大学（文系）", univ: "関西学院大学", tier: 2, category: "関関同立" },
  kansai_ri: { name: "関西学院大学（理系）", univ: "関西学院大学", tier: 2, category: "関関同立" },
  ritsumeikan_bun: { name: "立命館大学（文系）", univ: "立命館大学", tier: 2, category: "関関同立" },
  ritsumeikan_ri: { name: "立命館大学（理系）", univ: "立命館大学", tier: 2, category: "関関同立" },
  kansaidai_bun: { name: "関西大学（文系）", univ: "関西大学", tier: 2, category: "関関同立" },
  kansaidai_ri: { name: "関西大学（理系）", univ: "関西大学", tier: 2, category: "関関同立" },

  // ==== 産近甲龍 ====
  kindai_bun: { name: "近畿大学（文系）", univ: "近畿大学", tier: 3, category: "産近甲龍" },
  kindai_ri: { name: "近畿大学（理系）", univ: "近畿大学", tier: 3, category: "産近甲龍" },
  konan_bun: { name: "甲南大学（文系）", univ: "甲南大学", tier: 3, category: "産近甲龍" },
  konan_ri: { name: "甲南大学（理系）", univ: "甲南大学", tier: 3, category: "産近甲龍" },
  ryukoku_bun: { name: "龍谷大学（文系）", univ: "龍谷大学", tier: 3, category: "産近甲龍" },
  ryukoku_ri: { name: "龍谷大学（理系）", univ: "龍谷大学", tier: 3, category: "産近甲龍" },
  kyotosangyo_bun: { name: "京都産業大学（文系）", univ: "京都産業大学", tier: 3, category: "産近甲龍" },
  kyotosangyo_ri: { name: "京都産業大学（理系）", univ: "京都産業大学", tier: 3, category: "産近甲龍" },

  // ==== 関西の中堅私立 ====
  kansaigaidai_bun: { name: "関西外国語大学（文系）", univ: "関西外国語大学", tier: 3, category: "関西中堅私立" },
  osakakeizai_bun: { name: "大阪経済大学（文系）", univ: "大阪経済大学", tier: 3, category: "関西中堅私立" },
  settsu_bun: { name: "摂南大学（文系）", univ: "摂南大学", tier: 4, category: "関西中堅私立" },
  settsu_ri: { name: "摂南大学（理系）", univ: "摂南大学", tier: 4, category: "関西中堅私立" },
  bukkyo_bun: { name: "佛教大学（文系）", univ: "佛教大学", tier: 4, category: "関西中堅私立" },

  // ==== 早慶 ====
  waseda_bun: { name: "早稲田大学（文系）", univ: "早稲田大学", tier: 1, category: "早慶" },
  waseda_ri: { name: "早稲田大学（理系）", univ: "早稲田大学", tier: 1, category: "早慶" },
  keio_bun: { name: "慶應義塾大学（文系）", univ: "慶應義塾大学", tier: 1, category: "早慶" },
  keio_ri: { name: "慶應義塾大学（理系）", univ: "慶應義塾大学", tier: 1, category: "早慶" },

  // ==== MARCH・関東難関私立 ====
  sophia_bun: { name: "上智大学（文系）", univ: "上智大学", tier: 2, category: "関東難関私立" },
  sophia_ri: { name: "上智大学（理系）", univ: "上智大学", tier: 2, category: "関東難関私立" },
  meiji_bun: { name: "明治大学（文系）", univ: "明治大学", tier: 2, category: "MARCH" },
  meiji_ri: { name: "明治大学（理系）", univ: "明治大学", tier: 2, category: "MARCH" },
  aoyama_bun: { name: "青山学院大学（文系）", univ: "青山学院大学", tier: 2, category: "MARCH" },
  aoyama_ri: { name: "青山学院大学（理系）", univ: "青山学院大学", tier: 2, category: "MARCH" },
  rikkyo_bun: { name: "立教大学（文系）", univ: "立教大学", tier: 2, category: "MARCH" },
  rikkyo_ri: { name: "立教大学（理系）", univ: "立教大学", tier: 2, category: "MARCH" },
  chuo_bun: { name: "中央大学（文系）", univ: "中央大学", tier: 2, category: "MARCH" },
  chuo_ri: { name: "中央大学（理系）", univ: "中央大学", tier: 2, category: "MARCH" },
  hosei_bun: { name: "法政大学（文系）", univ: "法政大学", tier: 2, category: "MARCH" },
  hosei_ri: { name: "法政大学（理系）", univ: "法政大学", tier: 2, category: "MARCH" },
  rika_ri: { name: "東京理科大学（理系）", univ: "東京理科大学", tier: 2, category: "関東難関私立" }
};

// 学部マスタ（画面の選択肢）。集計は groupId 単位。
const MOCK_FACULTIES = [
  // 京都大学
  { id: "kyoto_bun_letters", univ: "京都大学", faculty: "文学部", groupId: "kyoto_bun" },
  { id: "kyoto_bun_education", univ: "京都大学", faculty: "教育学部", groupId: "kyoto_bun" },
  { id: "kyoto_bun_law", univ: "京都大学", faculty: "法学部", groupId: "kyoto_bun" },
  { id: "kyoto_bun_economics", univ: "京都大学", faculty: "経済学部", groupId: "kyoto_bun" },
  { id: "kyoto_ri_science", univ: "京都大学", faculty: "理学部", groupId: "kyoto_ri" },
  { id: "kyoto_ri_engineering", univ: "京都大学", faculty: "工学部", groupId: "kyoto_ri" },
  { id: "kyoto_ri_agriculture", univ: "京都大学", faculty: "農学部", groupId: "kyoto_ri" },
  { id: "kyoto_ri_medicine", univ: "京都大学", faculty: "医学部（医学科）", groupId: "kyoto_ri" },

  // 大阪大学
  { id: "osaka_bun_letters", univ: "大阪大学", faculty: "文学部", groupId: "osaka_bun" },
  { id: "osaka_bun_law", univ: "大阪大学", faculty: "法学部", groupId: "osaka_bun" },
  { id: "osaka_bun_economics", univ: "大阪大学", faculty: "経済学部", groupId: "osaka_bun" },
  { id: "osaka_bun_human", univ: "大阪大学", faculty: "人間科学部", groupId: "osaka_bun" },
  { id: "osaka_ri_science", univ: "大阪大学", faculty: "理学部", groupId: "osaka_ri" },
  { id: "osaka_ri_engineering", univ: "大阪大学", faculty: "工学部", groupId: "osaka_ri" },
  { id: "osaka_ri_engineering_science", univ: "大阪大学", faculty: "基礎工学部", groupId: "osaka_ri" },
  { id: "osaka_ri_medicine", univ: "大阪大学", faculty: "医学部（医学科）", groupId: "osaka_ri" },

  // 神戸大学
  { id: "kobe_bun_letters", univ: "神戸大学", faculty: "文学部", groupId: "kobe_bun" },
  { id: "kobe_bun_law", univ: "神戸大学", faculty: "法学部", groupId: "kobe_bun" },
  { id: "kobe_bun_economics", univ: "神戸大学", faculty: "経済学部", groupId: "kobe_bun" },
  { id: "kobe_bun_business", univ: "神戸大学", faculty: "経営学部", groupId: "kobe_bun" },
  { id: "kobe_ri_science", univ: "神戸大学", faculty: "理学部", groupId: "kobe_ri" },
  { id: "kobe_ri_engineering", univ: "神戸大学", faculty: "工学部", groupId: "kobe_ri" },
  { id: "kobe_ri_agriculture", univ: "神戸大学", faculty: "農学部", groupId: "kobe_ri" },
  { id: "kobe_ri_medicine", univ: "神戸大学", faculty: "医学部（医学科）", groupId: "kobe_ri" },

  // 大阪公立大学
  { id: "osakafu_bun_letters", univ: "大阪公立大学", faculty: "文学部", groupId: "osakafu_bun" },
  { id: "osakafu_bun_law", univ: "大阪公立大学", faculty: "法学部", groupId: "osakafu_bun" },
  { id: "osakafu_bun_economics", univ: "大阪公立大学", faculty: "経済学部", groupId: "osakafu_bun" },
  { id: "osakafu_bun_business", univ: "大阪公立大学", faculty: "商学部", groupId: "osakafu_bun" },
  { id: "osakafu_ri_science", univ: "大阪公立大学", faculty: "理学部", groupId: "osakafu_ri" },
  { id: "osakafu_ri_engineering", univ: "大阪公立大学", faculty: "工学部", groupId: "osakafu_ri" },
  { id: "osakafu_ri_agriculture", univ: "大阪公立大学", faculty: "農学部", groupId: "osakafu_ri" },
  { id: "osakafu_ri_human_life", univ: "大阪公立大学", faculty: "生活科学部", groupId: "osakafu_ri" },

  // 京都府立大学
  { id: "kyotofu_bun_letters", univ: "京都府立大学", faculty: "文学部", groupId: "kyotofu_bun" },
  { id: "kyotofu_bun_policy", univ: "京都府立大学", faculty: "公共政策学部", groupId: "kyotofu_bun" },
  { id: "kyotofu_ri_life_env", univ: "京都府立大学", faculty: "生命環境学部", groupId: "kyotofu_ri" },

  // 奈良女子大学
  { id: "nara_bun_letters", univ: "奈良女子大学", faculty: "文学部", groupId: "nara_bun" },
  { id: "nara_bun_human_life", univ: "奈良女子大学", faculty: "生活環境学部", groupId: "nara_bun" },
  { id: "nara_ri_science", univ: "奈良女子大学", faculty: "理学部", groupId: "nara_ri" },

  // 和歌山大学
  { id: "wakayama_bun_economics", univ: "和歌山大学", faculty: "経済学部", groupId: "wakayama_bun" },
  { id: "wakayama_bun_education", univ: "和歌山大学", faculty: "教育学部", groupId: "wakayama_bun" },
  { id: "wakayama_ri_systems", univ: "和歌山大学", faculty: "システム工学部", groupId: "wakayama_ri" },

  // 滋賀大学
  { id: "shiga_bun_economics", univ: "滋賀大学", faculty: "経済学部", groupId: "shiga_bun" },
  { id: "shiga_bun_education", univ: "滋賀大学", faculty: "教育学部", groupId: "shiga_bun" },
  { id: "shiga_ri_data_science", univ: "滋賀大学", faculty: "データサイエンス学部", groupId: "shiga_ri" },

  // 東京大学
  { id: "todai_bun_law", univ: "東京大学", faculty: "法学部", groupId: "todai_bun" },
  { id: "todai_bun_economics", univ: "東京大学", faculty: "経済学部", groupId: "todai_bun" },
  { id: "todai_bun_letters", univ: "東京大学", faculty: "文学部", groupId: "todai_bun" },
  { id: "todai_ri_science", univ: "東京大学", faculty: "理学部", groupId: "todai_ri" },
  { id: "todai_ri_engineering", univ: "東京大学", faculty: "工学部", groupId: "todai_ri" },
  { id: "todai_ri_medicine", univ: "東京大学", faculty: "医学部（医学科）", groupId: "todai_ri" },

  // 一橋大学・東京科学大学
  { id: "hitotsubashi_bun_law", univ: "一橋大学", faculty: "法学部", groupId: "hitotsubashi_bun" },
  { id: "hitotsubashi_bun_economics", univ: "一橋大学", faculty: "経済学部", groupId: "hitotsubashi_bun" },
  { id: "hitotsubashi_bun_commerce", univ: "一橋大学", faculty: "商学部", groupId: "hitotsubashi_bun" },
  { id: "hitotsubashi_bun_social", univ: "一橋大学", faculty: "社会学部", groupId: "hitotsubashi_bun" },
  { id: "tokodai_ri_science", univ: "東京科学大学", faculty: "理学院", groupId: "tokodai_ri" },
  { id: "tokodai_ri_engineering", univ: "東京科学大学", faculty: "工学院", groupId: "tokodai_ri" },
  { id: "tokodai_ri_medicine", univ: "東京科学大学", faculty: "医歯学系", groupId: "tokodai_ri" },

  // 北海道大学
  { id: "hokkaido_bun_letters", univ: "北海道大学", faculty: "文学部", groupId: "hokkaido_bun" },
  { id: "hokkaido_bun_law", univ: "北海道大学", faculty: "法学部", groupId: "hokkaido_bun" },
  { id: "hokkaido_bun_economics", univ: "北海道大学", faculty: "経済学部", groupId: "hokkaido_bun" },
  { id: "hokkaido_ri_science", univ: "北海道大学", faculty: "理学部", groupId: "hokkaido_ri" },
  { id: "hokkaido_ri_engineering", univ: "北海道大学", faculty: "工学部", groupId: "hokkaido_ri" },
  { id: "hokkaido_ri_agriculture", univ: "北海道大学", faculty: "農学部", groupId: "hokkaido_ri" },

  // 東北大学
  { id: "tohoku_bun_letters", univ: "東北大学", faculty: "文学部", groupId: "tohoku_bun" },
  { id: "tohoku_bun_law", univ: "東北大学", faculty: "法学部", groupId: "tohoku_bun" },
  { id: "tohoku_bun_economics", univ: "東北大学", faculty: "経済学部", groupId: "tohoku_bun" },
  { id: "tohoku_ri_science", univ: "東北大学", faculty: "理学部", groupId: "tohoku_ri" },
  { id: "tohoku_ri_engineering", univ: "東北大学", faculty: "工学部", groupId: "tohoku_ri" },
  { id: "tohoku_ri_medicine", univ: "東北大学", faculty: "医学部（医学科）", groupId: "tohoku_ri" },

  // 名古屋大学
  { id: "nagoya_bun_letters", univ: "名古屋大学", faculty: "文学部", groupId: "nagoya_bun" },
  { id: "nagoya_bun_law", univ: "名古屋大学", faculty: "法学部", groupId: "nagoya_bun" },
  { id: "nagoya_bun_economics", univ: "名古屋大学", faculty: "経済学部", groupId: "nagoya_bun" },
  { id: "nagoya_ri_science", univ: "名古屋大学", faculty: "理学部", groupId: "nagoya_ri" },
  { id: "nagoya_ri_engineering", univ: "名古屋大学", faculty: "工学部", groupId: "nagoya_ri" },
  { id: "nagoya_ri_agriculture", univ: "名古屋大学", faculty: "農学部", groupId: "nagoya_ri" },

  // 九州大学
  { id: "kyushu_bun_letters", univ: "九州大学", faculty: "文学部", groupId: "kyushu_bun" },
  { id: "kyushu_bun_law", univ: "九州大学", faculty: "法学部", groupId: "kyushu_bun" },
  { id: "kyushu_bun_economics", univ: "九州大学", faculty: "経済学部", groupId: "kyushu_bun" },
  { id: "kyushu_ri_science", univ: "九州大学", faculty: "理学部", groupId: "kyushu_ri" },
  { id: "kyushu_ri_engineering", univ: "九州大学", faculty: "工学部", groupId: "kyushu_ri" },
  { id: "kyushu_ri_agriculture", univ: "九州大学", faculty: "農学部", groupId: "kyushu_ri" },

  // 筑波大学
  { id: "tsukuba_bun_humanities", univ: "筑波大学", faculty: "人文・文化学群", groupId: "tsukuba_bun" },
  { id: "tsukuba_bun_social", univ: "筑波大学", faculty: "社会・国際学群", groupId: "tsukuba_bun" },
  { id: "tsukuba_bun_business", univ: "筑波大学", faculty: "ビジネスサイエンス系", groupId: "tsukuba_bun" },
  { id: "tsukuba_ri_science", univ: "筑波大学", faculty: "理工学群", groupId: "tsukuba_ri" },
  { id: "tsukuba_ri_life", univ: "筑波大学", faculty: "生命環境学群", groupId: "tsukuba_ri" },
  { id: "tsukuba_ri_medicine", univ: "筑波大学", faculty: "医学群", groupId: "tsukuba_ri" },

  // 広島大学
  { id: "hiroshima_bun_letters", univ: "広島大学", faculty: "文学部", groupId: "hiroshima_bun" },
  { id: "hiroshima_bun_law", univ: "広島大学", faculty: "法学部", groupId: "hiroshima_bun" },
  { id: "hiroshima_bun_economics", univ: "広島大学", faculty: "経済学部", groupId: "hiroshima_bun" },
  { id: "hiroshima_ri_science", univ: "広島大学", faculty: "理学部", groupId: "hiroshima_ri" },
  { id: "hiroshima_ri_engineering", univ: "広島大学", faculty: "工学部", groupId: "hiroshima_ri" },
  { id: "hiroshima_ri_medicine", univ: "広島大学", faculty: "医学部（医学科）", groupId: "hiroshima_ri" },

  // 岡山大学
  { id: "okayama_bun_letters", univ: "岡山大学", faculty: "文学部", groupId: "okayama_bun" },
  { id: "okayama_bun_law", univ: "岡山大学", faculty: "法学部", groupId: "okayama_bun" },
  { id: "okayama_bun_economics", univ: "岡山大学", faculty: "経済学部", groupId: "okayama_bun" },
  { id: "okayama_ri_science", univ: "岡山大学", faculty: "理学部", groupId: "okayama_ri" },
  { id: "okayama_ri_engineering", univ: "岡山大学", faculty: "工学部", groupId: "okayama_ri" },
  { id: "okayama_ri_medicine", univ: "岡山大学", faculty: "医学部（医学科）", groupId: "okayama_ri" },

  // 同志社大学
  { id: "doshisha_bun_theology", univ: "同志社大学", faculty: "神学部", groupId: "doshisha_bun" },
  { id: "doshisha_bun_letters", univ: "同志社大学", faculty: "文学部", groupId: "doshisha_bun" },
  { id: "doshisha_bun_law", univ: "同志社大学", faculty: "法学部", groupId: "doshisha_bun" },
  { id: "doshisha_bun_economics", univ: "同志社大学", faculty: "経済学部", groupId: "doshisha_bun" },
  { id: "doshisha_bun_commerce", univ: "同志社大学", faculty: "商学部", groupId: "doshisha_bun" },
  { id: "doshisha_bun_sociology", univ: "同志社大学", faculty: "社会学部", groupId: "doshisha_bun" },
  { id: "doshisha_bun_policy", univ: "同志社大学", faculty: "政策学部", groupId: "doshisha_bun" },
  { id: "doshisha_ri_science_eng", univ: "同志社大学", faculty: "理工学部", groupId: "doshisha_ri" },
  { id: "doshisha_ri_life_medical", univ: "同志社大学", faculty: "生命医科学部", groupId: "doshisha_ri" },
  { id: "doshisha_ri_culture_info", univ: "同志社大学", faculty: "文化情報学部", groupId: "doshisha_ri" },
  { id: "doshisha_ri_sports", univ: "同志社大学", faculty: "スポーツ健康科学部", groupId: "doshisha_ri" },

  // 関西学院大学
  { id: "kansai_bun_theology", univ: "関西学院大学", faculty: "神学部", groupId: "kansai_bun" },
  { id: "kansai_bun_letters", univ: "関西学院大学", faculty: "文学部", groupId: "kansai_bun" },
  { id: "kansai_bun_law", univ: "関西学院大学", faculty: "法学部", groupId: "kansai_bun" },
  { id: "kansai_bun_economics", univ: "関西学院大学", faculty: "経済学部", groupId: "kansai_bun" },
  { id: "kansai_bun_business", univ: "関西学院大学", faculty: "商学部", groupId: "kansai_bun" },
  { id: "kansai_bun_sociology", univ: "関西学院大学", faculty: "社会学部", groupId: "kansai_bun" },
  { id: "kansai_bun_policy", univ: "関西学院大学", faculty: "総合政策学部", groupId: "kansai_bun" },
  { id: "kansai_ri_science", univ: "関西学院大学", faculty: "理学部", groupId: "kansai_ri" },
  { id: "kansai_ri_engineering", univ: "関西学院大学", faculty: "工学部", groupId: "kansai_ri" },
  { id: "kansai_ri_human_welfare", univ: "関西学院大学", faculty: "人間福祉学部", groupId: "kansai_ri" },

  // 立命館大学
  { id: "ritsumeikan_bun_letters", univ: "立命館大学", faculty: "文学部", groupId: "ritsumeikan_bun" },
  { id: "ritsumeikan_bun_law", univ: "立命館大学", faculty: "法学部", groupId: "ritsumeikan_bun" },
  { id: "ritsumeikan_bun_economics", univ: "立命館大学", faculty: "経済学部", groupId: "ritsumeikan_bun" },
  { id: "ritsumeikan_bun_business", univ: "立命館大学", faculty: "経営学部", groupId: "ritsumeikan_bun" },
  { id: "ritsumeikan_bun_social", univ: "立命館大学", faculty: "産業社会学部", groupId: "ritsumeikan_bun" },
  { id: "ritsumeikan_bun_international", univ: "立命館大学", faculty: "国際関係学部", groupId: "ritsumeikan_bun" },
  { id: "ritsumeikan_bun_policy", univ: "立命館大学", faculty: "政策科学部", groupId: "ritsumeikan_bun" },
  { id: "ritsumeikan_ri_science_eng", univ: "立命館大学", faculty: "理工学部", groupId: "ritsumeikan_ri" },
  { id: "ritsumeikan_ri_info", univ: "立命館大学", faculty: "情報理工学部", groupId: "ritsumeikan_ri" },
  { id: "ritsumeikan_ri_life", univ: "立命館大学", faculty: "生命科学部", groupId: "ritsumeikan_ri" },
  { id: "ritsumeikan_ri_pharmacy", univ: "立命館大学", faculty: "薬学部", groupId: "ritsumeikan_ri" },

  // 関西大学
  { id: "kansaidai_bun_law", univ: "関西大学", faculty: "法学部", groupId: "kansaidai_bun" },
  { id: "kansaidai_bun_letters", univ: "関西大学", faculty: "文学部", groupId: "kansaidai_bun" },
  { id: "kansaidai_bun_economics", univ: "関西大学", faculty: "経済学部", groupId: "kansaidai_bun" },
  { id: "kansaidai_bun_business", univ: "関西大学", faculty: "商学部", groupId: "kansaidai_bun" },
  { id: "kansaidai_bun_sociology", univ: "関西大学", faculty: "社会学部", groupId: "kansaidai_bun" },
  { id: "kansaidai_bun_policy", univ: "関西大学", faculty: "政策創造学部", groupId: "kansaidai_bun" },
  { id: "kansaidai_ri_science_eng", univ: "関西大学", faculty: "理工学部", groupId: "kansaidai_ri" },
  { id: "kansaidai_ri_env_urban", univ: "関西大学", faculty: "環境都市工学部", groupId: "kansaidai_ri" },
  { id: "kansaidai_ri_chemistry", univ: "関西大学", faculty: "化学生命工学部", groupId: "kansaidai_ri" },

  // 近畿大学
  { id: "kindai_bun_law", univ: "近畿大学", faculty: "法学部", groupId: "kindai_bun" },
  { id: "kindai_bun_economics", univ: "近畿大学", faculty: "経済学部", groupId: "kindai_bun" },
  { id: "kindai_bun_business", univ: "近畿大学", faculty: "経営学部", groupId: "kindai_bun" },
  { id: "kindai_bun_letters", univ: "近畿大学", faculty: "文芸学部", groupId: "kindai_bun" },
  { id: "kindai_ri_science_eng", univ: "近畿大学", faculty: "理工学部", groupId: "kindai_ri" },
  { id: "kindai_ri_agriculture", univ: "近畿大学", faculty: "農学部", groupId: "kindai_ri" },
  { id: "kindai_ri_pharmacy", univ: "近畿大学", faculty: "薬学部", groupId: "kindai_ri" },
  { id: "kindai_ri_medicine", univ: "近畿大学", faculty: "医学部（医学科）", groupId: "kindai_ri" },

  // 甲南大学
  { id: "konan_bun_letters", univ: "甲南大学", faculty: "文学部", groupId: "konan_bun" },
  { id: "konan_bun_law", univ: "甲南大学", faculty: "法学部", groupId: "konan_bun" },
  { id: "konan_bun_economics", univ: "甲南大学", faculty: "経済学部", groupId: "konan_bun" },
  { id: "konan_bun_business", univ: "甲南大学", faculty: "経営学部", groupId: "konan_bun" },
  { id: "konan_ri_science", univ: "甲南大学", faculty: "理工学部", groupId: "konan_ri" },
  { id: "konan_ri_intelligence", univ: "甲南大学", faculty: "知能情報学部", groupId: "konan_ri" },

  // 龍谷大学
  { id: "ryukoku_bun_letters", univ: "龍谷大学", faculty: "文学部", groupId: "ryukoku_bun" },
  { id: "ryukoku_bun_law", univ: "龍谷大学", faculty: "法学部", groupId: "ryukoku_bun" },
  { id: "ryukoku_bun_economics", univ: "龍谷大学", faculty: "経済学部", groupId: "ryukoku_bun" },
  { id: "ryukoku_bun_business", univ: "龍谷大学", faculty: "経営学部", groupId: "ryukoku_bun" },
  { id: "ryukoku_bun_sociology", univ: "龍谷大学", faculty: "社会学部", groupId: "ryukoku_bun" },
  { id: "ryukoku_ri_science_eng", univ: "龍谷大学", faculty: "理工学部", groupId: "ryukoku_ri" },
  { id: "ryukoku_ri_agriculture", univ: "龍谷大学", faculty: "農学部", groupId: "ryukoku_ri" },

  // 京都産業大学
  { id: "kyotosangyo_bun_economics", univ: "京都産業大学", faculty: "経済学部", groupId: "kyotosangyo_bun" },
  { id: "kyotosangyo_bun_law", univ: "京都産業大学", faculty: "法学部", groupId: "kyotosangyo_bun" },
  { id: "kyotosangyo_bun_business", univ: "京都産業大学", faculty: "経営学部", groupId: "kyotosangyo_bun" },
  { id: "kyotosangyo_bun_letters", univ: "京都産業大学", faculty: "文化学部", groupId: "kyotosangyo_bun" },
  { id: "kyotosangyo_ri_science", univ: "京都産業大学", faculty: "理学部", groupId: "kyotosangyo_ri" },
  { id: "kyotosangyo_ri_info", univ: "京都産業大学", faculty: "情報理工学部", groupId: "kyotosangyo_ri" },
  { id: "kyotosangyo_ri_life", univ: "京都産業大学", faculty: "生命科学部", groupId: "kyotosangyo_ri" },

  // 関西外国語大学・大阪経済大学・摂南大学・佛教大学
  { id: "kansaigaidai_bun_foreign", univ: "関西外国語大学", faculty: "外国語学部", groupId: "kansaigaidai_bun" },
  { id: "kansaigaidai_bun_intl", univ: "関西外国語大学", faculty: "英語国際学部", groupId: "kansaigaidai_bun" },
  { id: "osakakeizai_bun_economics", univ: "大阪経済大学", faculty: "経済学部", groupId: "osakakeizai_bun" },
  { id: "osakakeizai_bun_business", univ: "大阪経済大学", faculty: "経営学部", groupId: "osakakeizai_bun" },
  { id: "settsu_bun_law", univ: "摂南大学", faculty: "法学部", groupId: "settsu_bun" },
  { id: "settsu_bun_economics", univ: "摂南大学", faculty: "経済学部", groupId: "settsu_bun" },
  { id: "settsu_ri_science_eng", univ: "摂南大学", faculty: "理工学部", groupId: "settsu_ri" },
  { id: "settsu_ri_pharmacy", univ: "摂南大学", faculty: "薬学部", groupId: "settsu_ri" },
  { id: "bukkyo_bun_letters", univ: "佛教大学", faculty: "文学部", groupId: "bukkyo_bun" },
  { id: "bukkyo_bun_education", univ: "佛教大学", faculty: "教育学部", groupId: "bukkyo_bun" },

  // 早稲田大学
  { id: "waseda_bun_political", univ: "早稲田大学", faculty: "政治経済学部", groupId: "waseda_bun" },
  { id: "waseda_bun_law", univ: "早稲田大学", faculty: "法学部", groupId: "waseda_bun" },
  { id: "waseda_bun_letters", univ: "早稲田大学", faculty: "文学部", groupId: "waseda_bun" },
  { id: "waseda_bun_commerce", univ: "早稲田大学", faculty: "商学部", groupId: "waseda_bun" },
  { id: "waseda_bun_social", univ: "早稲田大学", faculty: "社会科学部", groupId: "waseda_bun" },
  { id: "waseda_bun_intl_liberal", univ: "早稲田大学", faculty: "国際教養学部", groupId: "waseda_bun" },
  { id: "waseda_ri_fundamental", univ: "早稲田大学", faculty: "基幹理工学部", groupId: "waseda_ri" },
  { id: "waseda_ri_creative", univ: "早稲田大学", faculty: "創造理工学部", groupId: "waseda_ri" },
  { id: "waseda_ri_advanced", univ: "早稲田大学", faculty: "先進理工学部", groupId: "waseda_ri" },

  // 慶應義塾大学
  { id: "keio_bun_law", univ: "慶應義塾大学", faculty: "法学部", groupId: "keio_bun" },
  { id: "keio_bun_economics", univ: "慶應義塾大学", faculty: "経済学部", groupId: "keio_bun" },
  { id: "keio_bun_commerce", univ: "慶應義塾大学", faculty: "商学部", groupId: "keio_bun" },
  { id: "keio_bun_letters", univ: "慶應義塾大学", faculty: "文学部", groupId: "keio_bun" },
  { id: "keio_bun_policy", univ: "慶應義塾大学", faculty: "総合政策学部", groupId: "keio_bun" },
  { id: "keio_bun_environment", univ: "慶應義塾大学", faculty: "環境情報学部", groupId: "keio_bun" },
  { id: "keio_ri_science_eng", univ: "慶應義塾大学", faculty: "理工学部", groupId: "keio_ri" },
  { id: "keio_ri_medicine", univ: "慶應義塾大学", faculty: "医学部（医学科）", groupId: "keio_ri" },
  { id: "keio_ri_pharmacy", univ: "慶應義塾大学", faculty: "薬学部", groupId: "keio_ri" },

  // 上智大学
  { id: "sophia_bun_law", univ: "上智大学", faculty: "法学部", groupId: "sophia_bun" },
  { id: "sophia_bun_economics", univ: "上智大学", faculty: "経済学部", groupId: "sophia_bun" },
  { id: "sophia_bun_letters", univ: "上智大学", faculty: "文学部", groupId: "sophia_bun" },
  { id: "sophia_bun_foreign", univ: "上智大学", faculty: "外国語学部", groupId: "sophia_bun" },
  { id: "sophia_bun_human", univ: "上智大学", faculty: "総合人間科学部", groupId: "sophia_bun" },
  { id: "sophia_ri_science_eng", univ: "上智大学", faculty: "理工学部", groupId: "sophia_ri" },

  // 明治大学
  { id: "meiji_bun_law", univ: "明治大学", faculty: "法学部", groupId: "meiji_bun" },
  { id: "meiji_bun_economics", univ: "明治大学", faculty: "経済学部", groupId: "meiji_bun" },
  { id: "meiji_bun_business", univ: "明治大学", faculty: "商学部", groupId: "meiji_bun" },
  { id: "meiji_bun_letters", univ: "明治大学", faculty: "文学部", groupId: "meiji_bun" },
  { id: "meiji_bun_political", univ: "明治大学", faculty: "政治経済学部", groupId: "meiji_bun" },
  { id: "meiji_ri_science_eng", univ: "明治大学", faculty: "理工学部", groupId: "meiji_ri" },
  { id: "meiji_ri_agriculture", univ: "明治大学", faculty: "農学部", groupId: "meiji_ri" },

  // 青山学院大学
  { id: "aoyama_bun_law", univ: "青山学院大学", faculty: "法学部", groupId: "aoyama_bun" },
  { id: "aoyama_bun_economics", univ: "青山学院大学", faculty: "経済学部", groupId: "aoyama_bun" },
  { id: "aoyama_bun_business", univ: "青山学院大学", faculty: "経営学部", groupId: "aoyama_bun" },
  { id: "aoyama_bun_letters", univ: "青山学院大学", faculty: "文学部", groupId: "aoyama_bun" },
  { id: "aoyama_ri_science_eng", univ: "青山学院大学", faculty: "理工学部", groupId: "aoyama_ri" },
  { id: "aoyama_ri_social_info", univ: "青山学院大学", faculty: "社会情報学部", groupId: "aoyama_ri" },

  // 立教大学
  { id: "rikkyo_bun_law", univ: "立教大学", faculty: "法学部", groupId: "rikkyo_bun" },
  { id: "rikkyo_bun_economics", univ: "立教大学", faculty: "経済学部", groupId: "rikkyo_bun" },
  { id: "rikkyo_bun_business", univ: "立教大学", faculty: "経営学部", groupId: "rikkyo_bun" },
  { id: "rikkyo_bun_letters", univ: "立教大学", faculty: "文学部", groupId: "rikkyo_bun" },
  { id: "rikkyo_bun_global", univ: "立教大学", faculty: "グローバル教養学部", groupId: "rikkyo_bun" },
  { id: "rikkyo_ri_science", univ: "立教大学", faculty: "理学部", groupId: "rikkyo_ri" },

  // 中央大学
  { id: "chuo_bun_law", univ: "中央大学", faculty: "法学部", groupId: "chuo_bun" },
  { id: "chuo_bun_economics", univ: "中央大学", faculty: "経済学部", groupId: "chuo_bun" },
  { id: "chuo_bun_business", univ: "中央大学", faculty: "商学部", groupId: "chuo_bun" },
  { id: "chuo_bun_letters", univ: "中央大学", faculty: "文学部", groupId: "chuo_bun" },
  { id: "chuo_ri_science_eng", univ: "中央大学", faculty: "理工学部", groupId: "chuo_ri" },

  // 法政大学
  { id: "hosei_bun_law", univ: "法政大学", faculty: "法学部", groupId: "hosei_bun" },
  { id: "hosei_bun_economics", univ: "法政大学", faculty: "経済学部", groupId: "hosei_bun" },
  { id: "hosei_bun_business", univ: "法政大学", faculty: "経営学部", groupId: "hosei_bun" },
  { id: "hosei_bun_social", univ: "法政大学", faculty: "社会学部", groupId: "hosei_bun" },
  { id: "hosei_ri_science_eng", univ: "法政大学", faculty: "理工学部", groupId: "hosei_ri" },
  { id: "hosei_ri_life", univ: "法政大学", faculty: "生命科学部", groupId: "hosei_ri" },

  // 東京理科大学
  { id: "rika_ri_science", univ: "東京理科大学", faculty: "理学部", groupId: "rika_ri" },
  { id: "rika_ri_engineering", univ: "東京理科大学", faculty: "工学部", groupId: "rika_ri" },
  { id: "rika_ri_science_tech", univ: "東京理科大学", faculty: "創域理工学部", groupId: "rika_ri" },
  { id: "rika_ri_pharmacy", univ: "東京理科大学", faculty: "薬学部", groupId: "rika_ri" }
];

const MOCK_TIER_LABELS = { 1: "最難関", 2: "難関", 3: "中堅", 4: "チャレンジ" };
