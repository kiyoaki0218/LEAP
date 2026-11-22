/* provides: 称号・アイテムのマスタ / ゾーン定義・切替 / 出題スタイル定数 / 画面遷移 / 確認ダイアログ
   requires: LEAP_WORDS_DATA, KOBUN_WORDS_DATA, KOBUN_PARTS（外部データ。typeof ガード済み）
   注: クラシックスクリプト。トップレベルの宣言は index.html のインライン JS と共有される。
       index.html のインライン <script> より先に読み込む。 */

    // 称号マスターデータ（前称号 35種 ＆ 後称号 35種 ＝ 1,225通り）
    const PREFIX_TITLES = [
      { id: "pre_init", name: "始まりの", price: 0 },
      { id: "pre_novice", name: "見習いの", price: 50 },
      { id: "pre_steady", name: "コツコツの", price: 80 },
      { id: "pre_effort", name: "努力の", price: 100 },
      { id: "pre_earnest", name: "ひたむきな", price: 120 },
      { id: "pre_daily", name: "日課の", price: 150 },
      { id: "pre_swift", name: "疾風の", price: 200 },
      { id: "pre_lightning", name: "電光石火の", price: 250 },
      { id: "pre_precise", name: "精密な", price: 300 },
      { id: "pre_veteran", name: "歴戦の", price: 350 },
      { id: "pre_skilled", name: "熟練の", price: 400 },
      { id: "pre_sleeping", name: "眠れる", price: 450 },
      { id: "pre_lone", name: "孤高の", price: 500 },
      { id: "pre_fierce", name: "猛烈な", price: 550 },
      { id: "pre_active", name: "現役の", price: 600 },
      { id: "pre_talented", name: "秀才の", price: 650 },
      { id: "pre_ronin", name: "歴戦浪人の", price: 700 },
      { id: "pre_study", name: "学究の", price: 750 },
      { id: "pre_awakened", name: "覚醒の", price: 800 },
      { id: "pre_academic", name: "知性の", price: 900 },
      { id: "pre_genius", name: "天才の", price: 1000 },
      { id: "pre_unbeaten", name: "常勝の", price: 1100 },
      { id: "pre_indomitable", name: "不屈の", price: 1200 },
      { id: "pre_crimson", name: "紅蓮の", price: 1300 },
      { id: "pre_azure", name: "蒼穹の", price: 1400 },
      { id: "pre_darkness", name: "漆黒の", price: 1500 },
      { id: "pre_abyss", name: "深淵の", price: 1600 },
      { id: "pre_phantom", name: "幻影の", price: 1800 },
      { id: "pre_transcend", name: "超越の", price: 2000 },
      { id: "pre_dimension", name: "異次元の", price: 2200 },
      { id: "pre_legendary", name: "伝説の", price: 2500 },
      { id: "pre_mythic", name: "神話の", price: 3000 },
      { id: "pre_truth", name: "真理の", price: 3500 },
      { id: "pre_absolute", name: "絶対の", price: 4000 },
      { id: "pre_ultimate", name: "究極の", price: 5000 },
      { id: "pre_dawn", name: "黎明の", price: 6000 },
      { id: "pre_stargazer", name: "星詠みの", price: 6500 },
      { id: "pre_moonshadow", name: "月影の", price: 7000 },
      { id: "pre_daybreak", name: "暁の", price: 7500 },
      { id: "pre_silence", name: "静寂の", price: 8000 },
      { id: "pre_silver", name: "白銀の", price: 8500 },
      { id: "pre_golden", name: "黄金の", price: 9000 },
      { id: "pre_jade", name: "翡翠の", price: 9500 },
      { id: "pre_lapis", name: "瑠璃の", price: 10000 },
      { id: "pre_eternal", name: "永久の", price: 10500 },
      { id: "pre_infinite", name: "無限の", price: 11000 },
      { id: "pre_universe", name: "万象の", price: 11500 },
      { id: "pre_vacuum", name: "真空の", price: 12000 },
      { id: "pre_spacetime", name: "時空の", price: 12500 },
      { id: "pre_karma", name: "因果の", price: 13000 },
      { id: "pre_fate", name: "運命の", price: 13500 },
      { id: "pre_revelation", name: "天啓の", price: 14000 },
      { id: "pre_wisdom", name: "英知の", price: 14500 },
      { id: "pre_seeking", name: "求道の", price: 15000 },
      { id: "pre_pioneer", name: "開拓の", price: 15500 },
      { id: "pre_ambition", name: "覇道の", price: 16000 },
      { id: "pre_crown", name: "王冠の", price: 16500 },
      { id: "pre_dragon", name: "竜脈の", price: 17000 },
      { id: "pre_phoenix", name: "鳳凰の", price: 17500 },
      { id: "pre_kirin", name: "麒麟の", price: 18000 },
      { id: "pre_yatagarasu", name: "八咫烏の", price: 18500 },
      { id: "pre_thunder", name: "神雷の", price: 19000 },
      { id: "pre_freeze", name: "氷結の", price: 19500 },
      { id: "pre_burn", name: "灼熱の", price: 20000 },
      { id: "pre_starsea", name: "星海の", price: 21000 },
      { id: "pre_galaxy", name: "銀河の", price: 22000 },
      { id: "pre_cosmos", name: "宇宙の", price: 23000 },
      { id: "pre_dimensional", name: "次元の", price: 24000 },
      { id: "pre_allthings", name: "万物の", price: 26000 },
      { id: "pre_onlyme", name: "唯我の", price: 30000 },
      // 追加: 必ず名詞（後称号）が続く連体形で終わる前称号
      { id: "pre_rookie", name: "駆け出しの", price: 60 },
      { id: "pre_midnight", name: "深夜の", price: 140 },
      { id: "pre_onestroke", name: "一問入魂の", price: 500 },
      { id: "pre_kyoto", name: "京都の", price: 700 },
      { id: "pre_story", name: "物語を編む", price: 850 },
      { id: "pre_perfect", name: "全問正解の", price: 900 },
      { id: "pre_wordsmith", name: "言葉を紡ぐ", price: 950 },
      { id: "pre_fullmark", name: "満点の", price: 1100 },
      { id: "pre_etymology", name: "語源を極めし", price: 1300 },
      { id: "pre_affix", name: "接辞を刻みし", price: 1500 },
      // 実績で自動解放される称号（購入不可）
      { id: "pre_earned_streak7", name: "不抜の", price: 0, unlockAchievement: "streak_7" },
      { id: "pre_earned_streak30", name: "星霜の", price: 0, unlockAchievement: "streak_30" },
      { id: "pre_earned_review", name: "錬磨の", price: 0, unlockAchievement: "review_20" },
      { id: "pre_earned_perfect", name: "天稟の", price: 0, unlockAchievement: "perfect_3" },
      { id: "pre_earned_avatar", name: "収集の", price: 0, unlockAchievement: "avatar_all" },
      { id: "pre_earned_1000", name: "不滅の", price: 0, unlockAchievement: "correct_1000" }
    ];

    const SUFFIX_TITLES = [
      { id: "suf_beginner", name: "ビギナー", price: 0 },
      { id: "suf_challenger", name: "チャレンジャー", price: 50 },
      { id: "suf_student", name: "受験生", price: 80 },
      { id: "suf_worker", name: "努力家", price: 100 },
      { id: "suf_learner", name: "学習者", price: 120 },
      { id: "suf_candidate", name: "志望者", price: 150 },
      { id: "suf_honor", name: "優等生", price: 200 },
      { id: "suf_collector", name: "単語集め人", price: 250 },
      { id: "suf_speed", name: "速読派", price: 300 },
      { id: "suf_seeker", name: "求道者", price: 350 },
      { id: "suf_fighter", name: "戦士", price: 400 },
      { id: "suf_expert", name: "エキスパート", price: 450 },
      { id: "suf_elite", name: "難関大志望", price: 500 },
      { id: "suf_march", name: "MARCH志望", price: 550 },
      { id: "suf_waseda", name: "早慶志望", price: 600 },
      { id: "suf_med", name: "医学部志望", price: 700 },
      { id: "suf_kyodai", name: "京大志望", price: 800 },
      { id: "suf_todai", name: "東大志望", price: 1000 },
      { id: "suf_passer", name: "合格者", price: 1100 },
      { id: "suf_sage", name: "賢者", price: 1200 },
      { id: "suf_machine", name: "暗記マシン", price: 1300 },
      { id: "suf_pioneer", name: "開拓者", price: 1400 },
      { id: "suf_brave", name: "勇者", price: 1500 },
      { id: "suf_king", name: "読解王", price: 1600 },
      { id: "suf_conqueror", name: "語彙覇者", price: 1800 },
      { id: "suf_master", name: "LEAPマスター", price: 2000 },
      { id: "suf_grandmaster", name: "名誉教授", price: 2200 },
      { id: "suf_linguist", name: "言語学者", price: 2500 },
      { id: "suf_philosopher", name: "哲学者", price: 3000 },
      { id: "suf_overlord", name: "覇王", price: 3500 },
      { id: "suf_ruler", name: "絶対王者", price: 4000 },
      { id: "suf_incarnation", name: "化身", price: 4500 },
      { id: "suf_god", name: "語彙の神", price: 5000 },
      { id: "suf_oracle", name: "神託", price: 5500 },
      { id: "suf_concept", name: "概念", price: 6000 },
      { id: "suf_apprentice", name: "単語見習い", price: 60 },
      { id: "suf_vocab_king", name: "語彙王", price: 7000 },
      { id: "suf_collector2", name: "単語蒐集家", price: 7500 },
      { id: "suf_memory_keeper", name: "記憶番人", price: 8000 },
      { id: "suf_spelling_mage", name: "綴り魔術師", price: 8500 },
      { id: "suf_meaning_seeker", name: "意味探求者", price: 9000 },
      { id: "suf_quiz_master", name: "四択達人", price: 9500 },
      { id: "suf_combo_artisan", name: "コンボ職人", price: 10000 },
      { id: "suf_streak_hunter", name: "連答狩人", price: 10500 },
      { id: "suf_accuracy99", name: "正答率99%", price: 11000 },
      { id: "suf_all_correct", name: "全問正解者", price: 11500 },
      { id: "suf_perfect", name: "パーフェクト", price: 12000 },
      { id: "suf_unbroken", name: "不屈受験生", price: 12500 },
      { id: "suf_midnight", name: "深夜学習者", price: 13000 },
      { id: "suf_morning", name: "朝型秀才", price: 13500 },
      { id: "suf_commuter", name: "通学求道者", price: 14000 },
      { id: "suf_wordbook", name: "単語帳マイスター", price: 14500 },
      { id: "suf_dictionary", name: "辞書愛好家", price: 15000 },
      { id: "suf_etymology", name: "語源ハンター", price: 15500 },
      { id: "suf_synonym", name: "類義語マスター", price: 16000 },
      { id: "suf_example", name: "例文マスター", price: 16500 },
      { id: "suf_pronounce", name: "発音申し子", price: 17000 },
      { id: "suf_listening", name: "リスニング鬼", price: 17500 },
      { id: "suf_longtext", name: "長文支配者", price: 18000 },
      { id: "suf_translation", name: "和訳求道者", price: 18500 },
      { id: "suf_composition", name: "英作文魔術師", price: 19000 },
      { id: "suf_breaker", name: "難関突破者", price: 19500 },
      { id: "suf_exam_child", name: "試験申し子", price: 20000 },
      { id: "suf_score_source", name: "得点源", price: 21000 },
      { id: "suf_fullmark", name: "満点請負人", price: 22000 },
      { id: "suf_alchemist", name: "語彙錬金術師", price: 24000 },
      { id: "suf_dominator", name: "単語支配者", price: 26000 },
      { id: "suf_transcender", name: "言語超越者", price: 28000 },
      { id: "suf_knowledge_king", name: "知識王", price: 30000 },
      { id: "suf_omniscient", name: "全知者", price: 35000 },
      // 追加: 助詞を含まない純粋な名詞（体言止め）の後称号
      { id: "suf_sprint_king", name: "快速王", price: 1400 },
      { id: "suf_affix_hunter", name: "接辞ハンター", price: 1500 },
      { id: "suf_pronunciation", name: "発音職人", price: 1600 },
      { id: "suf_reader", name: "長文読解者", price: 1700 },
      { id: "suf_etymologist", name: "語源探究者", price: 1800 },
      { id: "suf_storyteller", name: "語り部", price: 1900 },
      { id: "suf_memory_master", name: "記憶達人", price: 2000 },
      { id: "suf_word_smith", name: "言葉職人", price: 2100 },
      // 実績で自動解放される称号（購入不可）
      { id: "suf_earned_streak7", name: "継続者", price: 0, unlockAchievement: "streak_7" },
      { id: "suf_earned_streak30", name: "毎日学習者", price: 0, unlockAchievement: "streak_30" },
      { id: "suf_earned_review", name: "復習達人", price: 0, unlockAchievement: "review_20" },
      { id: "suf_earned_perfect", name: "完全主義者", price: 0, unlockAchievement: "perfect_3" },
      { id: "suf_earned_avatar", name: "絵柄蒐集家", price: 0, unlockAchievement: "avatar_all" },
      { id: "suf_earned_1000", name: "全知全能", price: 0, unlockAchievement: "correct_1000" }
    ];

    // 旧称号名→新称号名（助詞を排除した体言止めへの移行用）
    const SUFFIX_NAME_MIGRATION = {
      "語彙の覇者": "語彙覇者",
      "英単語の化身": "化身",
      "記憶の番人": "記憶番人",
      "綴りの魔術師": "綴り魔術師",
      "意味の探求者": "意味探求者",
      "四択の達人": "四択達人",
      "連答の狩人": "連答狩人",
      "不屈の受験生": "不屈受験生",
      "深夜の学習者": "深夜学習者",
      "朝型の秀才": "朝型秀才",
      "電車内の求道者": "通学求道者",
      "単語帳の主": "単語帳マイスター",
      "辞書の愛好家": "辞書愛好家",
      "類義語の使い手": "類義語マスター",
      "発音の申し子": "発音申し子",
      "リスニングの鬼": "リスニング鬼",
      "長文の支配者": "長文支配者",
      "和訳の求道者": "和訳求道者",
      "英作文の魔術師": "英作文魔術師",
      "試験の申し子": "試験申し子",
      "語彙の錬金術師": "語彙錬金術師",
      "単語の支配者": "単語支配者",
      "言語の超越者": "言語超越者",
      "知識の王": "知識王",
      "全知の存在": "全知者",
      "復習の達人": "復習達人"
    };
    // 旧名の前称号は現行データに存在しないが、将来の改名に備えて用意
    const PREFIX_NAME_MIGRATION = {};

    // アバターフレーム（ショップで購入・装着）
    const FRAME_ITEMS = [
      { id: "frame_normal", name: "ノーマル", price: 0, emoji: "🦉", box: "bg-slate-100 ring-2 ring-slate-300" },
      { id: "frame_silver", name: "シルバー", price: 150, emoji: "🥈", box: "bg-gradient-to-br from-slate-100 to-slate-400 ring-4 ring-slate-400 shadow-lg" },
      { id: "frame_gold", name: "ゴールド", price: 300, emoji: "🦉", box: "bg-gradient-to-br from-amber-200 to-yellow-400 ring-4 ring-amber-400 shadow-lg" },
      { id: "frame_emerald", name: "エメラルド", price: 450, emoji: "🍀", box: "bg-gradient-to-br from-emerald-200 to-teal-500 ring-4 ring-emerald-400 shadow-lg" },
      { id: "frame_ruby", name: "ルビー", price: 600, emoji: "🌹", box: "bg-gradient-to-br from-rose-300 to-red-600 ring-4 ring-rose-400 shadow-lg" },
      { id: "frame_sapphire", name: "サファイア", price: 750, emoji: "💧", box: "bg-gradient-to-br from-sky-200 to-blue-600 ring-4 ring-blue-400 shadow-lg" },
      { id: "frame_galaxy", name: "宇宙柄", price: 800, emoji: "🌌", box: "bg-gradient-to-br from-indigo-900 via-purple-800 to-slate-900 ring-4 ring-indigo-400 shadow-lg" },
      { id: "frame_aurora", name: "オーロラ", price: 1500, emoji: "✨", box: "bg-gradient-to-br from-teal-300 via-sky-400 to-fuchsia-400 ring-4 ring-teal-300 shadow-lg" },
      { id: "frame_sakura", name: "サクラ", price: 2000, emoji: "🌸", box: "bg-gradient-to-br from-pink-200 via-rose-300 to-fuchsia-300 ring-4 ring-pink-400 shadow-lg" },
      { id: "frame_ocean", name: "オーシャン", price: 2200, emoji: "🐬", box: "bg-gradient-to-br from-cyan-300 to-blue-700 ring-4 ring-cyan-400 shadow-lg" },
      { id: "frame_thunder", name: "サンダー", price: 2600, emoji: "⚡", box: "bg-gradient-to-br from-yellow-200 to-indigo-600 ring-4 ring-yellow-400 shadow-lg" },
      { id: "frame_flame", name: "フレイム", price: 2800, emoji: "🔥", box: "bg-gradient-to-br from-amber-300 to-red-600 ring-4 ring-orange-400 shadow-lg" },
      { id: "frame_legend", name: "レジェンド", price: 3000, emoji: "👑", box: "bg-gradient-to-br from-rose-500 via-amber-400 to-yellow-300 ring-4 ring-rose-400 shadow-lg" },
      { id: "frame_ice", name: "アイス", price: 3200, emoji: "❄️", box: "bg-gradient-to-br from-sky-100 to-cyan-400 ring-4 ring-cyan-300 shadow-lg" },
      { id: "frame_forest", name: "フォレスト", price: 3500, emoji: "🌲", box: "bg-gradient-to-br from-lime-200 to-emerald-700 ring-4 ring-lime-400 shadow-lg" },
      { id: "frame_desert", name: "デザート", price: 3800, emoji: "🌵", box: "bg-gradient-to-br from-amber-200 to-orange-500 ring-4 ring-amber-400 shadow-lg" },
      { id: "frame_moon", name: "ムーン", price: 4200, emoji: "🌙", box: "bg-gradient-to-br from-slate-200 to-indigo-900 ring-4 ring-indigo-300 shadow-lg" },
      { id: "frame_sun", name: "サン", price: 4600, emoji: "☀️", box: "bg-gradient-to-br from-yellow-200 to-orange-500 ring-4 ring-yellow-400 shadow-lg" },
      { id: "frame_star", name: "スター", price: 5000, emoji: "⭐", box: "bg-gradient-to-br from-yellow-100 via-amber-300 to-orange-400 ring-4 ring-amber-300 shadow-lg" },
      { id: "frame_dragon", name: "ドラゴン", price: 6000, emoji: "🐉", box: "bg-gradient-to-br from-emerald-400 via-teal-600 to-slate-900 ring-4 ring-emerald-500 shadow-lg" },
      { id: "frame_unicorn", name: "ユニコーン", price: 7000, emoji: "🦄", box: "bg-gradient-to-br from-pink-200 via-purple-300 to-sky-300 ring-4 ring-purple-300 shadow-lg" },
      { id: "frame_phoenix", name: "フェニックス", price: 8000, emoji: "🦅", box: "bg-gradient-to-br from-orange-300 via-rose-500 to-purple-700 ring-4 ring-rose-400 shadow-lg" },
      { id: "frame_planet", name: "プラネット", price: 9000, emoji: "🪐", box: "bg-gradient-to-br from-indigo-400 via-purple-600 to-slate-900 ring-4 ring-purple-400 shadow-lg" },
      { id: "frame_infinity", name: "インフィニティ", price: 12000, emoji: "♾️", box: "bg-gradient-to-br from-slate-800 via-indigo-600 to-cyan-400 ring-4 ring-cyan-300 shadow-lg" },
      { id: "frame_ultimate", name: "アルティメット", price: 15000, emoji: "🌟", box: "bg-gradient-to-br from-amber-200 via-yellow-400 to-rose-400 ring-4 ring-amber-300 shadow-lg" },
      { id: "frame_chaos", name: "カオス", price: 18000, emoji: "🌀", box: "bg-gradient-to-br from-fuchsia-500 via-purple-700 to-slate-900 ring-4 ring-fuchsia-400 shadow-lg" },
      { id: "frame_god", name: "ゴッド", price: 25000, emoji: "👁️", box: "bg-gradient-to-br from-white via-amber-200 to-yellow-500 ring-4 ring-yellow-300 shadow-lg" }
    ];

    // アバターの絵柄（フレームとは独立して選択・レベルや実績で解放）
    const AVATAR_ITEMS = [
      { id: "avatar_auto", name: "フレーム準拠", emoji: "", unlockType: "free", unlockLabel: "最初から利用可能" },
      { id: "avatar_chick", name: "ヒヨコ", emoji: "🐣", unlockType: "level", unlockValue: 3, unlockLabel: "Lv.3 で解放" },
      { id: "avatar_book", name: "本読み", emoji: "📘", unlockType: "level", unlockValue: 5, unlockLabel: "Lv.5 で解放" },
      { id: "avatar_fox", name: "キツネ", emoji: "🦊", unlockType: "level", unlockValue: 8, unlockLabel: "Lv.8 で解放" },
      { id: "avatar_cat", name: "ネコ", emoji: "🐱", unlockType: "level", unlockValue: 12, unlockLabel: "Lv.12 で解放" },
      { id: "avatar_panda", name: "パンダ", emoji: "🐼", unlockType: "level", unlockValue: 16, unlockLabel: "Lv.16 で解放" },
      { id: "avatar_owl", name: "フクロウ博士", emoji: "🦉", unlockType: "level", unlockValue: 20, unlockLabel: "Lv.20 で解放" },
      { id: "avatar_lion", name: "ライオン", emoji: "🦁", unlockType: "level", unlockValue: 25, unlockLabel: "Lv.25 で解放" },
      { id: "avatar_rocket", name: "ロケット", emoji: "🚀", unlockType: "level", unlockValue: 30, unlockLabel: "Lv.30 で解放" },
      { id: "avatar_unicorn", name: "ユニコーン", emoji: "🦄", unlockType: "achievement", unlockValue: "perfect_clear", unlockLabel: "実績「完全無欠」で解放" },
      { id: "avatar_dragon", name: "ドラゴン", emoji: "🐉", unlockType: "achievement", unlockValue: "correct_100", unlockLabel: "実績「暗記マスター」で解放" },
      { id: "avatar_crown", name: "王冠", emoji: "👑", unlockType: "achievement", unlockValue: "correct_500", unlockLabel: "実績「語彙の求道者」で解放" },
      { id: "avatar_galaxy", name: "銀河", emoji: "🌌", unlockType: "achievement", unlockValue: "streak_30", unlockLabel: "実績「皆勤の求道者」で解放" },
      { id: "avatar_hero", name: "勇者", emoji: "🦸", unlockType: "achievement", unlockValue: "part3_80", unlockLabel: "実績「Part 3 制圧」で解放" },
      { id: "avatar_eye", name: "全知の目", emoji: "👁️", unlockType: "level", unlockValue: 50, unlockLabel: "Lv.50 で解放" }
    ];

    // Part定義（収録データに応じて利用可否を自動判定）
    const LEAP_PARTS = [
      { id: 1, name: "Part 1", desc: "重要・基礎単語", start: 1, end: 400 },
      { id: 2, name: "Part 2", desc: "標準・頻出単語", start: 401, end: 1000 },
      { id: 3, name: "Part 3", desc: "応用・発展単語", start: 1001, end: 1400 },
      { id: 4, name: "Part 4", desc: "最難関・発展単語", start: 1401, end: 2000 },
      { id: 5, name: "+α 難単語", desc: "プラスアルファ", start: 2001, end: 2300 }
    ];

    // ===== ゾーン（表の世界 / 裏世界） =====
    const LEAP_SOURCE = (typeof LEAP_WORDS_DATA !== "undefined" && Array.isArray(LEAP_WORDS_DATA)) ? LEAP_WORDS_DATA : [];
    const KOBUN_SOURCE = (typeof KOBUN_WORDS_DATA !== "undefined" && Array.isArray(KOBUN_WORDS_DATA)) ? KOBUN_WORDS_DATA : [];
    const KOBUN_PART_DEFS = (typeof KOBUN_PARTS !== "undefined" && Array.isArray(KOBUN_PARTS)) ? KOBUN_PARTS : [];
    const SUBJECT_STORAGE_KEY = "LEAP_SUBJECT_V1";

    const SUBJECTS = {
      leap: {
        key: "leap", short: "LEAP", label: "LEAP 英単語",
        heading: "LEAP 4択英単語",
        sub: "英語から日本語の語義を素早く答えるトレーニング",
        badge: "SIMPLE & SPEEDY",
        words: LEAP_SOURCE, parts: LEAP_PARTS
      },
      kobun: {
        key: "kobun", short: "裏世界", label: "古文単語（裏世界）",
        heading: "古文単語330",
        sub: "古典の語義を4択で。表の世界とは別の記録として残ります",
        badge: "ANOTHER WORLD",
        words: KOBUN_SOURCE, parts: KOBUN_PART_DEFS
      }
    };

    let currentSubject = "leap";
    let PARTS = LEAP_PARTS;
    let ALL_WORDS = [...LEAP_SOURCE];

    // ===== 単語詳細データ（LEAP単語データ/*.txt から生成） =====
    // 発音記号・品詞・コラム・例文を単語オブジェクトに紐づける
    function hydrateLeapDetails() {
      if (typeof LEAP_WORD_DETAILS === "undefined" || !LEAP_WORD_DETAILS) return;
      LEAP_SOURCE.forEach(w => {
        const d = LEAP_WORD_DETAILS[w.id] || LEAP_WORD_DETAILS[String(w.id)];
        if (!d) return;
        w.detail = d;
        if (d.ipa) w.ipa = d.ipa;
        if (Array.isArray(d.posTags) && d.posTags.length) w.pos = d.posTags[0];
      });
    }

    // ===== 出題スタイル（通常4択 / 例文・文脈テスト）＆ゲームモード =====
    const QUIZ_STYLE_KEY = "LEAP_QUIZ_STYLE_V1";
    const GAME_MODE_KEY = "LEAP_GAME_MODE_V1";
    const GAME_MODES = {
      normal: { id: "normal", label: "通常", icon: "📚", desc: "時間制限なしでじっくり" },
      sprint: { id: "sprint", label: "60秒スプリント", icon: "⏱️", desc: "5コンボ +3秒 / 誤答 -2秒" },
      sudden: { id: "sudden", label: "サドンデス", icon: "💀", desc: "1問8秒・ミス即終了" }
    };
    const SPRINT_TOTAL_MS = 60000;
    const SPRINT_BONUS_MS = 3000;
    const SPRINT_PENALTY_MS = 2000;
    const SUDDEN_MS = 8000;
    let quizStyle = "normal";
    let gameMode = "normal";
    // 今回のクイズで実際に使うゲームモード（忘却曲線復習などは常に通常）
    let quizGameMode = "normal";

    // 古文単語には例文データがないため、常に通常4択で出題する
    function effectiveQuizStyle() {
      return currentSubject === "kobun" ? "normal" : quizStyle;
    }

    // クイズ実施中に使う出題スタイル（忘却曲線復習などは設定を引き継がず通常4択に固定）
    function activeQuizStyle() {
      return quizState.style || effectiveQuizStyle();
    }

    function loadUiModes() {
      try {
        const s = localStorage.getItem(QUIZ_STYLE_KEY);
        if (s === "context" || s === "normal") quizStyle = s;
        const g = localStorage.getItem(GAME_MODE_KEY);
        if (GAME_MODES[g]) gameMode = g;
      } catch (e) {}
      syncModeUi();
    }

    function setQuizStyle(style) {
      if (style === "context" && currentSubject === "kobun") {
        showAlert({
          title: "例文モードはLEAP専用です",
          message: "古文単語には例文データがないため、通常4択モードで出題します。",
          icon: "📝"
        });
        return;
      }
      quizStyle = style === "context" ? "context" : "normal";
      try { localStorage.setItem(QUIZ_STYLE_KEY, quizStyle); } catch (e) {}
      syncModeUi();
      renderPartSelectList();
      updatePartSelectionSummary();
      updateQuizStatusHint();
    }

    function setGameMode(mode) {
      if (!GAME_MODES[mode]) return;
      gameMode = mode;
      try { localStorage.setItem(GAME_MODE_KEY, gameMode); } catch (e) {}
      syncModeUi();
      updateQuizStatusHint();
    }

    function syncModeUi() {
      const activeCls = "flex-1 py-2 text-xs font-bold rounded-lg bg-white shadow-sm text-slate-900 transition-all cursor-pointer";
      const idleCls = "flex-1 py-2 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-800 transition-all cursor-pointer";
      const normalBtn = document.getElementById("style-btn-normal");
      const contextBtn = document.getElementById("style-btn-context");
      const style = effectiveQuizStyle();
      if (normalBtn) normalBtn.className = style === "normal" ? activeCls : idleCls;
      if (contextBtn) {
        contextBtn.className = style === "context" ? activeCls : idleCls;
        contextBtn.disabled = currentSubject === "kobun";
        contextBtn.classList.toggle("opacity-40", currentSubject === "kobun");
      }
      document.querySelectorAll("[data-game-mode]").forEach(btn => {
        const on = btn.dataset.gameMode === gameMode;
        btn.className = "py-2 text-[11px] font-bold border rounded-lg transition cursor-pointer " +
          (on ? "bg-slate-900 text-white border-slate-900" : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100");
      });
      const badge = document.getElementById("context-coverage-badge");
      if (badge) {
        if (currentSubject === "kobun") {
          badge.textContent = "古文は通常モードのみ";
          badge.className = "text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md";
        } else {
          const total = ALL_WORDS.length;
          const withEx = ALL_WORDS.filter(w => getContextData(w)).length;
          badge.textContent = `例文 ${withEx} / ${total} 語`;
          badge.className = withEx > 0
            ? "text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md"
            : "text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md";
        }
      }
      const styleHint = document.getElementById("style-hint");
      if (styleHint) {
        styleHint.textContent = style === "context"
          ? "例文の空欄に入る英単語を選ぶ「学校小テスト風」モード。日本語訳の強調部分をヒントに英文を完成させよう（例文ありの単語のみ出題）。"
          : "英単語を見て日本語の語義を選ぶ通常モード。選択肢が出る前に“自力想起”の時間があります。";
      }
      const gameHint = document.getElementById("game-mode-hint");
      if (gameHint) {
        const g = GAME_MODES[gameMode] || GAME_MODES.normal;
        gameHint.textContent = `${g.icon} ${g.desc}`;
      }
      syncCustomRangeLockUi();
    }

    // 例文・文脈テストでもカスタム範囲指定を利用できる
    function syncCustomRangeLockUi() {
      const body = document.getElementById("custom-range-body");
      const lockedNotice = document.getElementById("custom-range-locked");
      if (body) body.classList.remove("hidden");
      if (lockedNotice) lockedNotice.classList.add("hidden");
    }

    function currentZone() {
      return SUBJECTS[currentSubject] || SUBJECTS.leap;
    }

    function getSavedSubject() {
      try {
        const v = localStorage.getItem(SUBJECT_STORAGE_KEY);
        return SUBJECTS[v] ? v : "leap";
      } catch (e) { return "leap"; }
    }

    function syncZoneButtons() {
      const leapBtn = document.getElementById("zone-btn-leap");
      const kobunBtn = document.getElementById("zone-btn-kobun");
      const base = "flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer";
      if (leapBtn) leapBtn.className = base + (currentSubject === "leap" ? " bg-white shadow-sm text-slate-900" : " text-slate-500");
      if (kobunBtn) kobunBtn.className = base + (currentSubject === "kobun" ? " bg-white shadow-sm text-violet-800" : " text-slate-500");
      const zoneLabel = document.getElementById("zone-label");
      if (zoneLabel) zoneLabel.textContent = currentZone().short;
    }

    function applySubject(subject, opts) {
      const key = SUBJECTS[subject] ? subject : "leap";
      const conf = SUBJECTS[key];
      if (!conf.words.length && key !== "leap") {
        showToast("このゾーンの単語データはまだありません");
        currentSubject = "leap";
        return false;
      }
      currentSubject = key;
      ALL_WORDS = [...conf.words];
      PARTS = conf.parts;
      document.body.classList.toggle("kobun-mode", key === "kobun");
      try { localStorage.setItem(SUBJECT_STORAGE_KEY, key); } catch (e) {}

      const heroBadge = document.getElementById("home-hero-badge");
      const heroTitle = document.getElementById("home-hero-title");
      const heroSub = document.getElementById("home-hero-sub");
      const dot = document.getElementById("header-zone-dot");
      if (heroBadge) {
        heroBadge.textContent = conf.badge;
        heroBadge.className = key === "kobun"
          ? "inline-block px-3 py-1 bg-violet-100 text-violet-800 text-xs font-semibold rounded-full tracking-wider"
          : "inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full tracking-wider";
      }
      if (heroTitle) heroTitle.textContent = conf.heading;
      if (heroSub) heroSub.textContent = conf.sub;
      if (dot) {
        dot.classList.toggle("bg-violet-500", key === "kobun");
        dot.classList.toggle("bg-emerald-500", key !== "kobun");
      }
      syncZoneButtons();
      loadDictionaryFilter();
      loadCustomRange();
      renderPartSelectList();
      syncDataRangeUi();
      syncModeUi();
      updateUserUI();
      if (!opts || !opts.silent) {
        showToast(key === "kobun" ? "🌌 裏世界（古文単語）へ移動しました" : "🌤 表の世界（LEAP）へ戻りました");
      }
      return true;
    }

    function switchSubject(subject) {
      if (subject === currentSubject) return;
      if (!applySubject(subject)) return;
      const parts = getAvailableParts();
      selectedParts = parts.length ? [parts[0].id] : [];
      savePartSelection();
      renderPartSelectList();
      updatePartSelectionSummary();
      navigate("screen-home", { replace: true });
    }

    // 収録データが対応するID範囲（データ追加に応じて自動で拡張される）
    function getDataIdRange() {
      let start = Infinity, end = 0;
      ALL_WORDS.forEach(w => {
        if (typeof w.id !== "number") return;
        if (w.id < start) start = w.id;
        if (w.id > end) end = w.id;
      });
      if (end === 0) return { start: 1, end: 0 };
      return { start: Number.isFinite(start) ? start : 1, end };
    }

    // 範囲入力の上限とデータ表記を実際の収録範囲に合わせる
    function syncDataRangeUi() {
      const range = getDataIdRange();
      if (!range.end) return;
      const statusEl = document.getElementById("data-status-text");
      if (statusEl) statusEl.textContent = `${currentZone().heading} (ID: ${range.start}〜${range.end}) 読込済`;
      ["custom-qcount-input", "dict-range-start", "dict-range-end"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.max = String(range.end);
      });
      // カスタム範囲は「単語番号」基準（古文は 1〜150、LEAPは ID = 単語番号）
      const numRange = subjectNumberRange();
      ["custom-start-id", "custom-end-id"].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.min = String(numRange.min); el.max = String(numRange.max); }
      });
    }

    async function checkAndFetchData() {
      if (currentSubject !== "leap") return;
      if (ALL_WORDS.length > 0) return;
      try {
        const res = await fetch("./LEAP単語データ/words.json");
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json) && json.length > 0) {
            ALL_WORDS = json;
            syncDataRangeUi();
            renderPartSelectList();
          }
        }
      } catch (e) {
        console.warn("fetch fallback", e);
      }
    }

    // 前称号（連体形）＋後称号（体言止め）を自然な日本語に連結する
    // 例: 「天才の」＋「語彙王」→「天才の語彙王」／「物語を編む」＋「語り部」→「物語を編む語り部」
    const TITLE_CONNECTIVE_TAIL = /(の|な|し|る|む|く|た|い|き|ず)$/;
    function composeTitle(prefix, suffix) {
      let head = String(prefix == null ? "" : prefix).trim();
      const tail = String(suffix == null ? "" : suffix).trim();
      if (!head && !tail) return "始まりのビギナー";
      if (!head) return tail;
      if (!tail) return /の$/.test(head) ? head.slice(0, -1) : head;
      // 「〜の」＋「〜の」で助詞が重複する場合
      if (/の$/.test(head) && /^の/.test(tail)) head = head.slice(0, -1);
      // 「満点の」＋「満点請負人」のように語幹が重複する場合は前称号を落とす
      const stem = head.replace(/[のな]$/, "");
      if (stem.length >= 2 && tail.indexOf(stem) === 0) head = "";
      // 体言で終わる前称号には「の」を補って連結する
      if (head && !TITLE_CONNECTIVE_TAIL.test(head)) head += "の";
      return head + tail;
    }

    function getFullTitle() {
      return composeTitle(userData.prefix, userData.suffix);
    }

    // 画面遷移
    const SCREENS = ["screen-home", "screen-select", "screen-quiz", "screen-shop", "screen-social", "screen-dictionary", "screen-reference", "screen-affix", "screen-affix-rush", "screen-affix-memory", "screen-reader", "screen-result"];
    function currentScreenId() {
      const found = SCREENS.find(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains("hidden");
      });
      return found || "screen-home";
    }

    // ===== サイト内の確認ダイアログ（ブラウザconfirmの代替） =====
    let appConfirmResolver = null;

    function showConfirm(options) {
      const opts = options || {};
      const modal = document.getElementById("app-confirm");
      if (!modal) return Promise.resolve(window.confirm(opts.message || ""));
      const titleEl = document.getElementById("app-confirm-title");
      const msgEl = document.getElementById("app-confirm-message");
      const iconEl = document.getElementById("app-confirm-icon");
      const okEl = document.getElementById("app-confirm-ok");
      const cancelEl = document.getElementById("app-confirm-cancel");
      if (titleEl) titleEl.textContent = opts.title || "確認";
      if (msgEl) msgEl.textContent = opts.message || "";
      if (iconEl) iconEl.textContent = opts.icon || "⚠️";
      if (okEl) {
        okEl.textContent = opts.okText || "OK";
        okEl.className = "flex-1 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer text-white " +
          (opts.danger === false ? "bg-slate-900 hover:bg-slate-700" : "bg-rose-600 hover:bg-rose-700");
      }
      if (cancelEl) {
        cancelEl.textContent = opts.cancelText || "キャンセル";
        cancelEl.classList.toggle("hidden", !!opts.hideCancel);
      }
      modal.classList.remove("hidden");
      return new Promise((resolve) => { appConfirmResolver = resolve; });
    }

    function showAlert(options) {
      return showConfirm(Object.assign({ danger: false, okText: "OK", hideCancel: true }, options || {}));
    }

    function closeAppConfirm(result) {
      const modal = document.getElementById("app-confirm");
      if (modal) modal.classList.add("hidden");
      const resolve = appConfirmResolver;
      appConfirmResolver = null;
      if (resolve) resolve(!!result);
    }

    // ===== ブラウザ／Androidの「戻る」操作を画面遷移に対応 =====
    function initScreenHistory() {
      try { history.replaceState({ screen: currentScreenId() }, ""); } catch (e) {}
    }

    function navigate(screenId, opts) {
      const options = opts || {};
      // クイズ画面を離れるときはタイマーを止める（背後で時間が進み続けるのを防ぐ）
      if (screenId !== "screen-quiz") stopQuizTimers();
      // 接辞クイズのタイマーも同様に止める（ラッシュは終了時にコインを確定）
      if (screenId !== "screen-affix-rush") {
        if (affixRush && !affixRush.ended) endAffixRush();
        else stopAffixRushTimer();
      }
      if (screenId !== "screen-affix-memory") {
        if (affixMemory && !affixMemory.ended) affixMemory.ended = true;
        stopAffixMemoryTimer();
      }
      SCREENS.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          if (id === screenId) {
            el.classList.remove("hidden");
            el.classList.add("fade-in");
          } else {
            el.classList.add("hidden");
            el.classList.remove("fade-in");
          }
        }
      });
      window.scrollTo(0, 0);
      if (screenId === "screen-shop") renderShop();
      if (screenId === "screen-select") {
        loadCustomRange();
        renderPartSelectList();
        updatePartSelectionSummary();
        updateCustomRangeStats();
        syncModeUi();
        updateQuizStatusHint();
      }
      if (screenId === "screen-dictionary") {
        applyDictFilterPanelState();
        updateDictFilterBadge();
        applyDictionaryFilters();
      }
      if (screenId === "screen-home") updateUserUI();

      if (!options.fromHistory) {
        const same = !!(history.state && history.state.screen === screenId);
        try {
          if (options.replace || same) history.replaceState({ screen: screenId }, "");
          else history.pushState({ screen: screenId }, "");
        } catch (e) {}
      }
    }

    // 戻る操作: モーダルが開いていれば閉じ、そうでなければ前の画面へ
    window.addEventListener("popstate", (event) => {
      const confirmEl = document.getElementById("app-confirm");
      if (confirmEl && !confirmEl.classList.contains("hidden")) {
        closeAppConfirm(false);
        try { history.pushState({ screen: currentScreenId() }, ""); } catch (e) {}
        return;
      }
      if (currentScreenId() === "screen-quiz") {
        if (!quizState.questions || quizState.questions.length === 0 || quizState.currentIndex === 0) {
          navigate("screen-select", { fromHistory: true });
          return;
        }
        showConfirm({
          title: "クイズを中断しますか？",
          message: quizInterruptMessage(),
          okText: "中断する",
          cancelText: "続ける",
          icon: "🏳️"
        }).then((ok) => {
          if (ok) { checkAchievements(); finishQuiz(true); }
          else { try { history.pushState({ screen: "screen-quiz" }, ""); } catch (e) {} }
        });
        return;
      }
      const openModal = ["achievements-modal", "modal-weak-words", "word-detail-modal"]
        .map(id => document.getElementById(id))
        .find(el => el && !el.classList.contains("hidden"));
      if (openModal) {
        if (openModal.id === "word-detail-modal") closeWordDetail();
        else openModal.classList.add("hidden");
        try { history.pushState({ screen: currentScreenId() }, ""); } catch (e) {}
        return;
      }
      let target = (event.state && event.state.screen) ? event.state.screen : "screen-home";
      // 終わったクイズ画面には戻さず、設定画面へ
      if (target === "screen-quiz") target = "screen-select";
      navigate(target, { fromHistory: true });
    });
