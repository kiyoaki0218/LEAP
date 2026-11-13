/* ============================================================
   例文データ（例文・文脈テストモード用）
   ------------------------------------------------------------
   ・キーは LEAP_WORDS_DATA の id（= 単語番号）
   ・en: 例文（対象単語をそのままの形で含める）
   ・ja: 例文の全訳（例文モードでは英文とセットで最初から表示）
   ・pos: 品詞。ダミー選択肢の品詞統一と、四角い品詞バッジの表示に使用
     受け付ける値の例:
       他動詞 → "vt" / "verb_transitive" / "他動詞"   （バッジ: 他）
       自動詞 → "vi" / "verb_intransitive" / "自動詞" （バッジ: 自）
       動詞   → "v" / "verb" / "動詞"                 （バッジ: 動）
       名詞   → "n" / "noun" / "名詞"                 （バッジ: 名）
       形容詞 → "adj" / "adjective" / "形容詞"         （バッジ: 形）
       形容動詞 → "adjn" / "na-adj" / "形容動詞"       （バッジ: 形動）
       副詞   → "adv" / "adverb" / "副詞"             （バッジ: 副）
       前置詞 → "prep" / 接続詞 → "conj" / 代名詞 → "pron"
     単語オブジェクト側に pos を書いても同じように反映されます。

   追加の例文は「単語データJSONを読み込む」からも取り込めます。
   形式の例:
     [{ "id": 61, "example": "The soup tastes good.", "example_ja": "そのスープはよい味がする。" }]
     [{ "id": 61, "word": "taste", "examples": ["The soup tastes good."] }]
   単語オブジェクトに example / examples / sentence を持たせてもOKです。
   ============================================================ */

const LEAP_EXAMPLE_DATA = {
  1: { en: "I agree with your opinion.", ja: "私はあなたの意見に賛成だ。", pos: "verb" },
  2: { en: "Many residents oppose the new plan.", ja: "多くの住民が新しい計画に反対している。", pos: "verb" },
  3: { en: "The doctor advised me to rest.", ja: "医者は私に休むよう忠告した。", pos: "verb" },
  4: { en: "He gave me a helpful tip about the exam.", ja: "彼は試験について役に立つヒントをくれた。", pos: "noun" },
  5: { en: "We discussed the problem for an hour.", ja: "私たちはその問題を1時間話し合った。", pos: "verb" },
  6: { en: "Don't blame others for your mistake.", ja: "自分の間違いを他人のせいにしないで。", pos: "verb" },
  7: { en: "He argued that the plan was too expensive.", ja: "彼はその計画は高すぎると主張した。", pos: "verb" },
  8: { en: "She claims that she saw the man.", ja: "彼女はその男を見たと主張している。", pos: "verb" },
  9: { en: "Customers complained about the noise.", ja: "客たちは騒音について文句を言った。", pos: "verb" },
  10: { en: "He offered to help me.", ja: "彼は私を手伝うと申し出た。", pos: "verb" },
  11: { en: "I suggest taking a break now.", ja: "今休憩を取ることを提案する。", pos: "verb" },
  12: { en: "I recommend this book to beginners.", ja: "この本を初心者におすすめする。", pos: "verb" },
  13: { en: "I am grateful for your kindness.", ja: "あなたの親切に感謝している。", pos: "adj" },
  14: { en: "You should apologize to her.", ja: "彼女に謝るべきだ。", pos: "verb" },
  15: { en: "There is no excuse for being late.", ja: "遅刻する言い訳はない。", pos: "noun" },
  16: { en: "We celebrated her birthday at home.", ja: "私たちは家で彼女の誕生日を祝った。", pos: "verb" },
  17: { en: "I congratulated him on his success.", ja: "私は彼の成功をお祝いした。", pos: "verb" },
  18: { en: "I admire her courage.", ja: "私は彼女の勇気を称賛する。", pos: "verb" },
  19: { en: "His speech impressed everyone.", ja: "彼の演説は皆に感銘を与えた。", pos: "verb" },
  20: { en: "She received an award for her research.", ja: "彼女は研究で賞を受けた。", pos: "noun" },
  21: { en: "Please explain the rule again.", ja: "もう一度その規則を説明してください。", pos: "verb" },
  22: { en: "Can you describe the man you saw?", ja: "あなたが見た男を説明できますか。", pos: "verb" },
  23: { en: "We communicate by email.", ja: "私たちはメールで意思の疎通をはかる。", pos: "verb" },
  24: { en: "She expressed her feelings in a letter.", ja: "彼女は手紙で気持ちを表現した。", pos: "verb" },
  25: { en: "He kept his promise.", ja: "彼は約束を守った。", pos: "noun" },
  26: { en: "This information is very useful.", ja: "この情報はとても役に立つ。", pos: "noun" },
  27: { en: "Modern technology has changed our lives.", ja: "現代の技術は私たちの生活を変えた。", pos: "noun" },
  28: { en: "Her research focuses on climate change.", ja: "彼女の研究は気候変動に焦点を当てている。", pos: "noun" },
  29: { en: "This material feels like cotton.", ja: "この生地は綿のように感じる。", pos: "noun" },
  30: { en: "The lake is artificial.", ja: "その湖は人工的だ。", pos: "adj" },
  31: { en: "He bought an electric car.", ja: "彼は電気自動車を買った。", pos: "adj" },
  32: { en: "Who invented the telephone?", ja: "誰が電話を発明したのですか。", pos: "verb" },
  33: { en: "Scientists discovered a new species.", ja: "科学者たちは新種を発見した。", pos: "verb" },
  34: { en: "The company is developing a new app.", ja: "その会社は新しいアプリを開発している。", pos: "verb" },
  35: { en: "Reading skill improves with practice.", ja: "読解の技術は練習で伸びる。", pos: "noun" },
  36: { en: "She has the ability to lead the team.", ja: "彼女にはチームを率いる能力がある。", pos: "noun" },
  37: { en: "He has a talent for music.", ja: "彼には音楽の才能がある。", pos: "noun" },
  38: { en: "Success requires effort.", ja: "成功には努力が必要だ。", pos: "noun" },
  39: { en: "Practice makes perfect.", ja: "練習が完璧を作る。", pos: "noun" },
  40: { en: "She achieved her goal at last.", ja: "彼女はついに目標を達成した。", pos: "verb" },
  41: { en: "I managed to finish the work.", ja: "私は何とかその仕事を終えた。", pos: "verb" },
  42: { en: "Reading every day improves your English.", ja: "毎日読むことは英語を改善する。", pos: "verb" },
  43: { en: "This factory produces cars.", ja: "この工場は車を生産する。", pos: "verb" },
  44: { en: "The artist created a beautiful sculpture.", ja: "その芸術家は美しい彫刻を創造した。", pos: "verb" },
  45: { en: "They established a new company in 2010.", ja: "彼らは2010年に新しい会社を設立した。", pos: "verb" },
  46: { en: "These two words form a phrase.", ja: "この2語は句を形成する。", pos: "verb" },
  47: { en: "This app saves you a lot of time.", ja: "このアプリは多くの時間を省いてくれる。", pos: "verb" },
  48: { en: "Take this medicine after meals.", ja: "この薬を食後に飲んでください。", pos: "noun" },
  49: { en: "The patient is waiting for the doctor.", ja: "その患者は医者を待っている。", pos: "noun" },
  50: { en: "The car is in good condition.", ja: "その車は良い状態だ。", pos: "noun" },
  51: { en: "She needs medical care.", ja: "彼女には医療のケアが必要だ。", pos: "adj" },
  52: { en: "Too much stress is bad for you.", ja: "ストレスが多すぎるのは体に悪い。", pos: "noun" },
  53: { en: "He suffers from headaches.", ja: "彼は頭痛に苦しんでいる。", pos: "verb" },
  54: { en: "Daily exercise keeps you healthy.", ja: "毎日の運動は健康を保つ。", pos: "noun" },
  55: { en: "Breathe deeply and relax.", ja: "深く呼吸してリラックスして。", pos: "verb" },
  56: { en: "I am thirsty after running.", ja: "走った後でのどが渇いている。", pos: "adj" },
  57: { en: "Physical exercise is important.", ja: "身体的な運動は大切だ。", pos: "adj" },
  58: { en: "She has a slight fever.", ja: "彼女は少し熱がある。", pos: "noun" },
  59: { en: "He lost his strength after the illness.", ja: "彼は病気の後で体力を失った。", pos: "noun" },
  60: { en: "A tear rolled down her cheek.", ja: "涙が彼女の頬を伝った。", pos: "noun" }
};
