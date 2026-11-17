/* ============================================================
   接頭辞・接尾辞クイズ用データ
   ------------------------------------------------------------
   1グループ = 共通の接辞（画面上部に固定表示）＋語根4〜5個。
   各語根は「語根 + 接辞 = 完成単語」と日本語訳を持つ。
   core は語根のコアイメージ（解説・選択肢に表示）。
   ============================================================ */

const AFFIX_DATA = {
  prefixes: [
    {
      affix: "pre-", meaning: "前に", note: "時間・位置が「前」",
      roots: [
        { root: "dict", core: "言う", word: "predict", ja: "予測する" },
        { root: "vent", core: "来る", word: "prevent", ja: "妨げる・予防する" },
        { root: "pare", core: "準備する", word: "prepare", ja: "準備する" },
        { root: "serve", core: "保つ", word: "preserve", ja: "保存する" },
        { root: "view", core: "見る", word: "preview", ja: "試写・下見" }
      ]
    },
    {
      affix: "re-", meaning: "再び・後ろへ", note: "もう一度／元へ戻す",
      roots: [
        { root: "build", core: "建てる", word: "rebuild", ja: "再建する" },
        { root: "duce", core: "導く", word: "reduce", ja: "減らす" },
        { root: "view", core: "見る", word: "review", ja: "復習する・見直す" },
        { root: "act", core: "行う", word: "react", ja: "反応する" },
        { root: "cover", core: "覆う", word: "recover", ja: "回復する" }
      ]
    },
    {
      affix: "un-", meaning: "否定・反対", note: "〜でない／反対の動作",
      roots: [
        { root: "expected", core: "予期された", word: "unexpected", ja: "予期しない" },
        { root: "able", core: "できる", word: "unable", ja: "できない" },
        { root: "fair", core: "公平な", word: "unfair", ja: "不公平な" },
        { root: "known", core: "知られた", word: "unknown", ja: "未知の" },
        { root: "lock", core: "鍵をかける", word: "unlock", ja: "解錠する" }
      ]
    },
    {
      affix: "dis-", meaning: "離れて・否定", note: "ばらばらに／打ち消す",
      roots: [
        { root: "cover", core: "覆う", word: "discover", ja: "発見する" },
        { root: "agree", core: "賛成する", word: "disagree", ja: "意見が合わない" },
        { root: "appear", core: "現れる", word: "disappear", ja: "消える" },
        { root: "order", core: "秩序", word: "disorder", ja: "無秩序" },
        { root: "trust", core: "信じる", word: "distrust", ja: "不信" }
      ]
    },
    {
      affix: "in- / im-", meaning: "否定", note: "〜でない（m の前では im-）",
      roots: [
        { root: "possible", core: "可能な", word: "impossible", ja: "不可能な" },
        { root: "correct", core: "正しい", word: "incorrect", ja: "不正確な" },
        { root: "visible", core: "見える", word: "invisible", ja: "見えない" },
        { root: "polite", core: "礼儀正しい", word: "impolite", ja: "無礼な" }
      ]
    },
    {
      affix: "ex-", meaning: "外へ", note: "外に出す・外へ向かう",
      roots: [
        { root: "port", core: "運ぶ", word: "export", ja: "輸出する" },
        { root: "clude", core: "閉じる", word: "exclude", ja: "除外する" },
        { root: "tract", core: "引く", word: "extract", ja: "抽出する" },
        { root: "press", core: "押す", word: "express", ja: "表現する" }
      ]
    },
    {
      affix: "sub-", meaning: "下に", note: "下・下位・補助",
      roots: [
        { root: "way", core: "道", word: "subway", ja: "地下鉄" },
        { root: "marine", core: "海の", word: "submarine", ja: "潜水艦" },
        { root: "mit", core: "送る", word: "submit", ja: "提出する" },
        { root: "urb", core: "都市", word: "suburb", ja: "郊外" }
      ]
    },
    {
      affix: "inter-", meaning: "間・相互", note: "〜の間で／お互いに",
      roots: [
        { root: "national", core: "国の", word: "international", ja: "国際的な" },
        { root: "act", core: "行う", word: "interact", ja: "交流する" },
        { root: "view", core: "見る", word: "interview", ja: "面接する" },
        { root: "rupt", core: "破る", word: "interrupt", ja: "中断する" }
      ]
    },
    {
      affix: "trans-", meaning: "越えて", note: "横切る・移す",
      roots: [
        { root: "port", core: "運ぶ", word: "transport", ja: "輸送する" },
        { root: "late", core: "運ぶ", word: "translate", ja: "翻訳する" },
        { root: "form", core: "形", word: "transform", ja: "変形させる" },
        { root: "mit", core: "送る", word: "transmit", ja: "伝える" }
      ]
    },
    {
      affix: "con- / com-", meaning: "共に", note: "一緒に・完全に",
      roots: [
        { root: "nect", core: "結ぶ", word: "connect", ja: "つなぐ" },
        { root: "bine", core: "束ねる", word: "combine", ja: "結合する" },
        { root: "struct", core: "建てる", word: "construct", ja: "建設する" },
        { root: "firm", core: "固い", word: "confirm", ja: "確認する" }
      ]
    },
    {
      affix: "pro-", meaning: "前に・代わって", note: "前へ押し出す",
      roots: [
        { root: "gress", core: "進む", word: "progress", ja: "進歩する" },
        { root: "mote", core: "動かす", word: "promote", ja: "促進する" },
        { root: "tect", core: "覆う", word: "protect", ja: "守る" },
        { root: "pose", core: "置く", word: "propose", ja: "提案する" }
      ]
    },
    {
      affix: "anti-", meaning: "反対", note: "〜に逆らう・対抗する",
      roots: [
        { root: "social", core: "社会的な", word: "antisocial", ja: "反社会的な" },
        { root: "biotic", core: "生命の", word: "antibiotic", ja: "抗生物質" },
        { root: "body", core: "体", word: "antibody", ja: "抗体" },
        { root: "war", core: "戦争", word: "antiwar", ja: "反戦の" }
      ]
    },
    {
      affix: "over-", meaning: "過度に・上に", note: "度を越す／上から",
      roots: [
        { root: "eat", core: "食べる", word: "overeat", ja: "食べすぎる" },
        { root: "come", core: "来る", word: "overcome", ja: "克服する" },
        { root: "look", core: "見る", word: "overlook", ja: "見落とす" },
        { root: "weight", core: "重さ", word: "overweight", ja: "太りすぎの" }
      ]
    },
    {
      affix: "under-", meaning: "下に・不十分", note: "下／不足",
      roots: [
        { root: "stand", core: "立つ", word: "understand", ja: "理解する" },
        { root: "ground", core: "地面", word: "underground", ja: "地下の" },
        { root: "estimate", core: "見積もる", word: "underestimate", ja: "過小評価する" },
        { root: "line", core: "線", word: "underline", ja: "下線を引く" }
      ]
    },
    {
      affix: "co- / col-", meaning: "共に", note: "同じ立場で一緒に",
      roots: [
        { root: "operate", core: "動く", word: "cooperate", ja: "協力する" },
        { root: "labor", core: "働く", word: "collaborate", ja: "共同で働く" },
        { root: "exist", core: "存在する", word: "coexist", ja: "共存する" },
        { root: "league", core: "同盟", word: "colleague", ja: "同僚" }
      ]
    },
    {
      affix: "mis-", meaning: "誤って", note: "間違った方向へ",
      roots: [
        { root: "understand", core: "理解する", word: "misunderstand", ja: "誤解する" },
        { root: "take", core: "取る", word: "mistake", ja: "間違える" },
        { root: "lead", core: "導く", word: "mislead", ja: "誤解させる" },
        { root: "spell", core: "つづる", word: "misspell", ja: "つづりを間違える" }
      ]
    }
  ],
  suffixes: [
    {
      affix: "-able", meaning: "〜できる", note: "動詞を形容詞にする",
      roots: [
        { root: "read", core: "読む", word: "readable", ja: "読める" },
        { root: "enjoy", core: "楽しむ", word: "enjoyable", ja: "楽しい" },
        { root: "vis", core: "見る", word: "visible", ja: "見える" },
        { root: "cred", core: "信じる", word: "credible", ja: "信頼できる" }
      ]
    },
    {
      affix: "-ation", meaning: "名詞化", note: "行為・状態を表す名詞",
      roots: [
        { root: "inform", core: "知らせる", word: "information", ja: "情報" },
        { root: "invite", core: "招く", word: "invitation", ja: "招待" },
        { root: "expect", core: "予期する", word: "expectation", ja: "予想" },
        { root: "admire", core: "称賛する", word: "admiration", ja: "称賛" }
      ]
    },
    {
      affix: "-sion", meaning: "名詞化", note: "行為・結果を表す名詞",
      roots: [
        { root: "decide", core: "決める", word: "decision", ja: "決定" },
        { root: "confuse", core: "混同する", word: "confusion", ja: "混乱" },
        { root: "express", core: "表現する", word: "expression", ja: "表現" },
        { root: "conclude", core: "結論づける", word: "conclusion", ja: "結論" }
      ]
    },
    {
      affix: "-ment", meaning: "名詞化", note: "行為・結果・状態",
      roots: [
        { root: "agree", core: "賛成する", word: "agreement", ja: "同意" },
        { root: "develop", core: "発展させる", word: "development", ja: "発展" },
        { root: "achieve", core: "達成する", word: "achievement", ja: "達成" },
        { root: "govern", core: "統治する", word: "government", ja: "政府" }
      ]
    },
    {
      affix: "-ly", meaning: "〜に・〜く", note: "形容詞を副詞にする",
      roots: [
        { root: "quick", core: "速い", word: "quickly", ja: "素早く" },
        { root: "sudden", core: "突然の", word: "suddenly", ja: "突然" },
        { root: "happy", core: "幸せな", word: "happily", ja: "幸せに" },
        { root: "careful", core: "注意深い", word: "carefully", ja: "注意深く" }
      ]
    },
    {
      affix: "-ful", meaning: "〜に満ちた", note: "名詞を形容詞にする",
      roots: [
        { root: "care", core: "注意", word: "careful", ja: "注意深い" },
        { root: "use", core: "使うこと", word: "useful", ja: "役に立つ" },
        { root: "power", core: "力", word: "powerful", ja: "強力な" },
        { root: "wonder", core: "驚き", word: "wonderful", ja: "素晴らしい" }
      ]
    },
    {
      affix: "-less", meaning: "〜がない", note: "〜を欠いている",
      roots: [
        { root: "home", core: "家", word: "homeless", ja: "家のない" },
        { root: "hope", core: "希望", word: "hopeless", ja: "絶望的な" },
        { root: "care", core: "注意", word: "careless", ja: "不注意な" },
        { root: "end", core: "終わり", word: "endless", ja: "終わりのない" }
      ]
    },
    {
      affix: "-er", meaning: "〜する人・もの", note: "動詞を名詞にする",
      roots: [
        { root: "teach", core: "教える", word: "teacher", ja: "教師" },
        { root: "build", core: "建てる", word: "builder", ja: "建築者" },
        { root: "drive", core: "運転する", word: "driver", ja: "運転手" },
        { root: "paint", core: "描く", word: "painter", ja: "画家" }
      ]
    },
    {
      affix: "-or", meaning: "〜する人", note: "行為をする人",
      roots: [
        { root: "act", core: "演じる", word: "actor", ja: "俳優" },
        { root: "invent", core: "発明する", word: "inventor", ja: "発明家" },
        { root: "conduct", core: "指揮する", word: "conductor", ja: "指揮者" },
        { root: "visit", core: "訪れる", word: "visitor", ja: "訪問者" }
      ]
    },
    {
      affix: "-ist", meaning: "〜する人・主義者", note: "専門家・信奉者",
      roots: [
        { root: "art", core: "芸術", word: "artist", ja: "芸術家" },
        { root: "science", core: "科学", word: "scientist", ja: "科学者" },
        { root: "piano", core: "ピアノ", word: "pianist", ja: "ピアニスト" },
        { root: "tour", core: "旅行する", word: "tourist", ja: "観光客" }
      ]
    },
    {
      affix: "-ness", meaning: "状態・性質", note: "形容詞を名詞にする",
      roots: [
        { root: "dark", core: "暗い", word: "darkness", ja: "暗闇" },
        { root: "kind", core: "親切な", word: "kindness", ja: "親切" },
        { root: "happy", core: "幸せな", word: "happiness", ja: "幸福" },
        { root: "weak", core: "弱い", word: "weakness", ja: "弱さ" }
      ]
    },
    {
      affix: "-ity", meaning: "状態・性質", note: "形容詞を名詞にする",
      roots: [
        { root: "real", core: "現実の", word: "reality", ja: "現実" },
        { root: "able", core: "できる", word: "ability", ja: "能力" },
        { root: "active", core: "活動的な", word: "activity", ja: "活動" },
        { root: "curious", core: "好奇心旺盛な", word: "curiosity", ja: "好奇心" }
      ]
    },
    {
      affix: "-ous", meaning: "〜に富む", note: "名詞を形容詞にする",
      roots: [
        { root: "danger", core: "危険", word: "dangerous", ja: "危険な" },
        { root: "fame", core: "名声", word: "famous", ja: "有名な" },
        { root: "nerve", core: "神経", word: "nervous", ja: "緊張した" },
        { root: "mountain", core: "山", word: "mountainous", ja: "山がちの" }
      ]
    },
    {
      affix: "-ive", meaning: "〜の性質を持つ", note: "動詞を形容詞にする",
      roots: [
        { root: "create", core: "作る", word: "creative", ja: "創造的な" },
        { root: "attract", core: "引きつける", word: "attractive", ja: "魅力的な" },
        { root: "decide", core: "決める", word: "decisive", ja: "決定的な" },
        { root: "impress", core: "印象づける", word: "impressive", ja: "印象的な" }
      ]
    },
    {
      affix: "-ize", meaning: "〜化する", note: "形容詞・名詞を動詞にする",
      roots: [
        { root: "modern", core: "現代の", word: "modernize", ja: "近代化する" },
        { root: "real", core: "現実の", word: "realize", ja: "実現する・気づく" },
        { root: "organ", core: "器官", word: "organize", ja: "組織する" },
        { root: "memory", core: "記憶", word: "memorize", ja: "暗記する" }
      ]
    },
    {
      affix: "-en", meaning: "〜にする", note: "形容詞を動詞にする",
      roots: [
        { root: "wide", core: "広い", word: "widen", ja: "広げる" },
        { root: "strength", core: "強さ", word: "strengthen", ja: "強める" },
        { root: "sharp", core: "鋭い", word: "sharpen", ja: "鋭くする" },
        { root: "soft", core: "柔らかい", word: "soften", ja: "柔らかくする" }
      ]
    }
  ]
};
