/* provides: 単語辞典・単語詳細シート・参考資料・実績（ACHIEVEMENTS と解除判定）・ショップ（称号/フレーム/アバター）の描画と操作
   requires: core.js（PREFIX_TITLES / SUFFIX_TITLES / FRAME_ITEMS / AVATAR_ITEMS / ゾーン定義 / navigate / showToast / showConfirm）
             words_data.js / examples_data.js / reference_data.js、index.html の userData / saveUserData 等。
             いずれも呼び出し時の参照のみで、読み込み順には依存しない。
   note: index.html のインライン JS から Stage 4 として切り出し（コードは無改変）。 */
    // ===== 実績・トロフィー =====
    // condition(userData) が true になったら達成。userData の実フィールドだけを使う。
    function _history(u) { return Array.isArray(u.scoreHistory) ? u.scoreHistory : []; }
    function _totalCorrect(u) {
      // EXPは正解1問で +10 なので、正解数の累計として使える
      return Math.floor((Number(u.exp) || 0) / 10);
    }
    // Partごとの解答済み単語の割合（0〜1）
    function _partCoverage(u, partId) {
      const part = LEAP_PARTS.find(p => p.id === partId);
      if (!part) return 0;
      const words = LEAP_SOURCE.filter(w => w.id >= part.start && w.id <= part.end);
      if (words.length === 0) return 0;
      const stats = u.wordStats || {};
      return words.filter(w => stats[w.id]).length / words.length;
    }
    const ACHIEVEMENTS = [
      // === はじめの一歩・基本機能 ===
      { id: "first_correct", name: "はじめの一歩", icon: "🐣", category: "basic", desc: "クイズで初めて1問正解する", price: 50,
        condition: (u) => (Number(u.exp) || 0) >= 10 },
      { id: "first_victory", name: "初勝利", icon: "🏆", category: "basic", desc: "クイズを最後まで解き切る", price: 100,
        condition: (u) => (u.totalQuizzes || 0) >= 1 || _history(u).length >= 1 },
      { id: "dict_explorer", name: "単語帳の探究者", icon: "📖", category: "basic", desc: "単語辞典を開いて閲覧する", price: 50,
        condition: (u) => !!u.dictOpened },
      { id: "night_owl", name: "夜の読書家", icon: "🌙", category: "basic", desc: "ダークモードを有効にする", price: 50,
        condition: (u) => getDarkMode() === true },
      { id: "voice_listener", name: "リスニング派", icon: "🔊", category: "basic", desc: "音声読み上げ機能を有効にしてプレイ", price: 80,
        condition: (u) => !!u.voiceEnabled && ((u.totalQuizzes || 0) >= 1 || _history(u).length >= 1) },

      // === 正解数・知識 ===
      { id: "correct_10", name: "単語ルーキー", icon: "🥉", category: "correct", desc: "累計10問正解を達成する", price: 100,
        condition: (u) => _totalCorrect(u) >= 10 },
      { id: "correct_30", name: "単語ホープ", icon: "🥈", category: "correct", desc: "累計30問正解を達成する", price: 150,
        condition: (u) => _totalCorrect(u) >= 30 },
      { id: "correct_50", name: "努力の結晶", icon: "🥇", category: "correct", desc: "累計50問正解を達成する", price: 250,
        condition: (u) => _totalCorrect(u) >= 50 },
      { id: "correct_100", name: "暗記マスター", icon: "🎖️", category: "correct", desc: "累計100問正解を達成する", price: 400,
        condition: (u) => _totalCorrect(u) >= 100 },
      { id: "correct_200", name: "ボキャブラリー強者", icon: "👑", category: "correct", desc: "累計200問正解を達成する", price: 600,
        condition: (u) => _totalCorrect(u) >= 200 },
      { id: "correct_300", name: "英単語の達人", icon: "🏛️", category: "correct", desc: "累計300問正解を達成する", price: 800,
        condition: (u) => _totalCorrect(u) >= 300 },
      { id: "correct_500", name: "語彙の求道者", icon: "🌌", category: "correct", desc: "累計500問正解を達成する", price: 1200,
        condition: (u) => _totalCorrect(u) >= 500 },
      { id: "correct_1000", name: "語彙の神", icon: "🌟", category: "correct", desc: "累計1000問正解を達成する", price: 2500,
        condition: (u) => _totalCorrect(u) >= 1000 },

      // === レベルアップ ===
      { id: "level_2", name: "レベルアップ！", icon: "🌸", category: "level", desc: "プレイヤーLv.2に到達する", price: 100,
        condition: (u) => getLevelState(u.exp).level >= 2 },
      { id: "level_5", name: "成長の兆し", icon: "🌱", category: "level", desc: "プレイヤーLv.5に到達する", price: 200,
        condition: (u) => getLevelState(u.exp).level >= 5 },
      { id: "level_10", name: "知識の開花", icon: "🌿", category: "level", desc: "プレイヤーLv.10に到達する", price: 400,
        condition: (u) => getLevelState(u.exp).level >= 10 },
      { id: "level_20", name: "そびえ立つ大樹", icon: "🌳", category: "level", desc: "プレイヤーLv.20に到達する", price: 800,
        condition: (u) => getLevelState(u.exp).level >= 20 },
      { id: "level_30", name: "学問の頂", icon: "🏔️", category: "level", desc: "プレイヤーLv.30に到達する", price: 1500,
        condition: (u) => getLevelState(u.exp).level >= 30 },

      // === コンボ・フィーバー ===
      { id: "combo_3", name: "トリプルアンサー", icon: "⚡", category: "combo", desc: "3問連続で正解する", price: 50,
        condition: (u) => (u.maxComboEver || 0) >= 3 || (quizState && quizState.maxCombo >= 3) || _history(u).some(h => Number(h.combo) >= 3) },
      { id: "combo_5", name: "5連コンボ", icon: "🔥", category: "combo", desc: "5問連続で正解する", price: 100,
        condition: (u) => (u.maxComboEver || 0) >= 5 || (quizState && quizState.maxCombo >= 5) || _history(u).some(h => Number(h.combo) >= 5) },
      { id: "combo_10", name: "10連フィーバー！", icon: "💥", category: "combo", desc: "10問連続で正解する", price: 200,
        condition: (u) => (u.maxComboEver || 0) >= 10 || (quizState && quizState.maxCombo >= 10) || _history(u).some(h => Number(h.combo) >= 10) },
      { id: "combo_15", name: "疾風怒濤", icon: "🌠", category: "combo", desc: "15問連続で正解する", price: 350,
        condition: (u) => (u.maxComboEver || 0) >= 15 || (quizState && quizState.maxCombo >= 15) || _history(u).some(h => Number(h.combo) >= 15) },
      { id: "combo_20", name: "異次元の集中力", icon: "☄️", category: "combo", desc: "20問連続で正解する", price: 500,
        condition: (u) => (u.maxComboEver || 0) >= 20 || (quizState && quizState.maxCombo >= 20) || _history(u).some(h => Number(h.combo) >= 20) },
      { id: "combo_30", name: "ゾーン突入", icon: "🌌", category: "combo", desc: "30問連続で正解する", price: 1000,
        condition: (u) => (u.maxComboEver || 0) >= 30 || (quizState && quizState.maxCombo >= 30) || _history(u).some(h => Number(h.combo) >= 30) },

      // === クイズ精度・完走 ===
      { id: "high_accuracy", name: "秀才の証", icon: "✨", category: "accuracy", desc: "正答率90%以上でクイズをクリアする", price: 150,
        condition: (u) => _history(u).some(h => Number(h.accuracy) >= 90 && Number(h.total) >= 10) },
      { id: "perfect_clear", name: "完全無欠", icon: "🎯", category: "accuracy", desc: "10問以上で正答率100%を達成する", price: 300,
        condition: (u) => _history(u).some(h => Number(h.accuracy) === 100 && Number(h.total) >= 10) },
      { id: "quiz_5_times", name: "反復学習", icon: "🔄", category: "accuracy", desc: "累計5回クイズを完走する", price: 150,
        condition: (u) => (u.totalQuizzes || 0) >= 5 || _history(u).length >= 5 },
      { id: "quiz_10_times", name: "学習習慣", icon: "📅", category: "accuracy", desc: "累計10回クイズを完走する", price: 300,
        condition: (u) => (u.totalQuizzes || 0) >= 10 },
      { id: "marathon_20", name: "ミニマラソン", icon: "🏃", category: "accuracy", desc: "20問以上のクイズを完走する", price: 150,
        condition: (u) => _history(u).some(h => Number(h.total) >= 20) },
      { id: "marathon_50", name: "ハーフマラソン", icon: "🚴", category: "accuracy", desc: "50問以上のクイズを完走する", price: 350,
        condition: (u) => _history(u).some(h => Number(h.total) >= 50) },
      { id: "marathon_100", name: "ウルトラマラソン", icon: "🚀", category: "accuracy", desc: "100問以上のクイズを完走する", price: 700,
        condition: (u) => _history(u).some(h => Number(h.total) >= 100) },
      { id: "daily_first_clear", name: "日課の達人", icon: "🌅", category: "accuracy", desc: "デイリーチャレンジをクリアする", price: 200,
        condition: (u) => !!u.lastDailyDate },

      // === コイン・コレクション ===
      { id: "coin_100", name: "お小遣い", icon: "🪙", category: "collection", desc: "所持コインが100を突破する", price: 50,
        condition: (u) => Number(u.coins) >= 100 },
      { id: "coin_500", name: "貯蓄家", icon: "💰", category: "collection", desc: "所持コインが500を突破する", price: 200,
        condition: (u) => Number(u.coins) >= 500 },
      { id: "coin_1000", name: "富豪", icon: "💎", category: "collection", desc: "所持コインが1000を突破する", price: 400,
        condition: (u) => Number(u.coins) >= 1000 },
      { id: "coin_3000", name: "大富豪", icon: "👑", category: "collection", desc: "所持コインが3000を突破する", price: 1000,
        condition: (u) => Number(u.coins) >= 3000 },
      { id: "three_acquired", name: "称号コレクター", icon: "🏷️", category: "collection", desc: "前称号・後称号を計3つ以上取得する", price: 150,
        condition: (u) => (u.purchasedPrefixes || []).length + (u.purchasedSuffixes || []).length >= 3 },
      { id: "ten_titles", name: "二つ名マスター", icon: "🎖️", category: "collection", desc: "前称号・後称号を計10個以上取得する", price: 500,
        condition: (u) => (u.purchasedPrefixes || []).length + (u.purchasedSuffixes || []).length >= 10 },
      { id: "all_frames", name: "フレームコンプリート", icon: "🖼️", category: "collection", desc: "全アバターフレームを揃える", price: 600,
        condition: (u) => (u.ownedFrames || []).length >= FRAME_ITEMS.length },

      // === 単語学習（単語ごとの解答履歴） ===
      { id: "words_10", name: "学習の第一歩", icon: "📗", category: "words", desc: "異なる10単語に解答する", price: 100,
        condition: (u) => Object.keys(u.wordStats || {}).length >= 10 },
      { id: "words_50", name: "単語の散歩道", icon: "📘", category: "words", desc: "異なる50単語に解答する", price: 250,
        condition: (u) => Object.keys(u.wordStats || {}).length >= 50 },
      { id: "words_100", name: "単語の森", icon: "📚", category: "words", desc: "異なる100単語に解答する", price: 500,
        condition: (u) => Object.keys(u.wordStats || {}).length >= 100 },
      { id: "words_300", name: "語彙の大地", icon: "🌍", category: "words", desc: "異なる300単語に解答する", price: 900,
        condition: (u) => Object.keys(u.wordStats || {}).length >= 300 },
      { id: "words_600", name: "語彙の大陸", icon: "🗺️", category: "words", desc: "異なる600単語に解答する", price: 1800,
        condition: (u) => Object.keys(u.wordStats || {}).length >= 600 },
      { id: "mastered_10", name: "定着した10語", icon: "🌾", category: "words", desc: "3回以上正解した単語を10語つくる", price: 200,
        condition: (u) => Object.values(u.wordStats || {}).filter(s => (s.correct || 0) >= 3).length >= 10 },
      { id: "mastered_50", name: "定着した50語", icon: "🌻", category: "words", desc: "3回以上正解した単語を50語つくる", price: 600,
        condition: (u) => Object.values(u.wordStats || {}).filter(s => (s.correct || 0) >= 3).length >= 50 },
      { id: "mastered_100", name: "定着した100語", icon: "🌟", category: "words", desc: "3回以上正解した単語を100語つくる", price: 1200,
        condition: (u) => Object.values(u.wordStats || {}).filter(s => (s.correct || 0) >= 3).length >= 100 },

      // === 苦手復習・忘却曲線 ===
      { id: "weak_first", name: "弱点発見", icon: "🔍", category: "review", desc: "初めて苦手単語が記録される", price: 50,
        condition: (u) => Object.keys(u.weakWords || {}).length >= 1 },
      { id: "weak_10", name: "苦手ノート", icon: "🔥", category: "review", desc: "苦手単語が10語たまる", price: 150,
        condition: (u) => Object.keys(u.weakWords || {}).length >= 10 },
      { id: "weak_30", name: "弱点コレクター", icon: "🧯", category: "review", desc: "苦手単語が30語たまる", price: 300,
        condition: (u) => Object.keys(u.weakWords || {}).length >= 30 },
      { id: "review_stage2", name: "復習の成果", icon: "🔄", category: "review", desc: "復習ステージ2に到達した単語を5語つくる", price: 200,
        condition: (u) => Object.values(u.weakWords || {}).filter(w => (w.stage || 1) >= 2).length >= 5 },
      { id: "review_stage3", name: "記憶の定着", icon: "🧠", category: "review", desc: "復習ステージ3に到達した単語を3語つくる", price: 350,
        condition: (u) => Object.values(u.weakWords || {}).filter(w => (w.stage || 1) >= 3).length >= 3 },

      // === 連続学習・デイリー ===
      { id: "streak_3", name: "三日坊主返上", icon: "🔥", category: "daily", desc: "3日連続で学習する", price: 200,
        condition: (u) => (u.streak || 0) >= 3 },
      { id: "streak_7", name: "一週間の習慣", icon: "📅", category: "daily", desc: "7日連続で学習する", price: 400,
        condition: (u) => (u.streak || 0) >= 7 },
      { id: "streak_14", name: "二週間の継続", icon: "🗓️", category: "daily", desc: "14日連続で学習する", price: 700,
        condition: (u) => (u.streak || 0) >= 14 },
      { id: "streak_30", name: "皆勤の求道者", icon: "🌕", category: "daily", desc: "30日連続で学習する", price: 1500,
        condition: (u) => (u.streak || 0) >= 30 },
      { id: "daily_5", name: "デイリー5回", icon: "🌟", category: "daily", desc: "デイリーチャレンジを5回クリアする", price: 300,
        condition: (u) => (u.dailyClears || 0) >= 5 },
      { id: "daily_10", name: "デイリー10回", icon: "💫", category: "daily", desc: "デイリーチャレンジを10回クリアする", price: 600,
        condition: (u) => (u.dailyClears || 0) >= 10 },

      // === 復習の継続 ===
      { id: "review_5", name: "復習の常連", icon: "🔁", category: "review", desc: "忘却曲線復習を5回完了する", price: 250,
        condition: (u) => (u.reviewClears || 0) >= 5 },
      { id: "review_20", name: "記憶の番人", icon: "🧠", category: "review", desc: "忘却曲線復習を20回完了する", price: 800,
        condition: (u) => (u.reviewClears || 0) >= 20 },

      // === Part攻略 ===
      { id: "part1_80", name: "Part 1 制圧", icon: "1️⃣", category: "words", desc: "Part 1の8割の単語に解答する", price: 400,
        condition: (u) => _partCoverage(u, 1) >= 0.8 },
      { id: "part2_80", name: "Part 2 制圧", icon: "2️⃣", category: "words", desc: "Part 2の8割の単語に解答する", price: 800,
        condition: (u) => _partCoverage(u, 2) >= 0.8 },
      { id: "part3_80", name: "Part 3 制圧", icon: "3️⃣", category: "words", desc: "Part 3の8割の単語に解答する", price: 1200,
        condition: (u) => _partCoverage(u, 3) >= 0.8 },

      // === アバター絵柄 ===
      { id: "avatar_5", name: "絵柄コレクター", icon: "🧑‍🎨", category: "shop", desc: "アバター絵柄を5種類解放する", price: 300,
        condition: (u) => (u.ownedAvatars || []).length >= 5 },
      { id: "avatar_all", name: "絵柄コンプリート", icon: "🎭", category: "shop", desc: "アバター絵柄をすべて解放する", price: 2000,
        condition: (u) => (u.ownedAvatars || []).length >= AVATAR_ITEMS.length },

      // === ショップ・アバター ===
      { id: "first_frame", name: "初めての着せ替え", icon: "🎨", category: "shop", desc: "アバターフレームを2種類以上所持する", price: 100,
        condition: (u) => (u.ownedFrames || []).length >= 2 },
      { id: "frames_5", name: "フレーム好き", icon: "🖼️", category: "shop", desc: "アバターフレームを5種類所持する", price: 300,
        condition: (u) => (u.ownedFrames || []).length >= 5 },
      { id: "frames_10", name: "フレーム蒐集家", icon: "🗃️", category: "shop", desc: "アバターフレームを10種類所持する", price: 700,
        condition: (u) => (u.ownedFrames || []).length >= 10 },
      { id: "frames_20", name: "フレームの主", icon: "👑", category: "shop", desc: "アバターフレームを20種類所持する", price: 1500,
        condition: (u) => (u.ownedFrames || []).length >= 20 },
      { id: "titles_20", name: "二つ名の趣味", icon: "🏷️", category: "shop", desc: "前称号・後称号を計20個取得する", price: 800,
        condition: (u) => (u.purchasedPrefixes || []).length + (u.purchasedSuffixes || []).length >= 20 },
      { id: "titles_50", name: "二つ名コンプ手前", icon: "🎗️", category: "shop", desc: "前称号・後称号を計50個取得する", price: 1500,
        condition: (u) => (u.purchasedPrefixes || []).length + (u.purchasedSuffixes || []).length >= 50 },
      { id: "all_prefix", name: "前称号制覇", icon: "📕", category: "shop", desc: "前称号をすべて所持する", price: 2000,
        condition: (u) => (u.purchasedPrefixes || []).length >= PREFIX_TITLES.length },
      { id: "all_suffix", name: "後称号制覇", icon: "📗", category: "shop", desc: "後称号をすべて所持する", price: 2000,
        condition: (u) => (u.purchasedSuffixes || []).length >= SUFFIX_TITLES.length },

      // === 継続・その他 ===
      { id: "three_days", name: "三日続けた人", icon: "📆", category: "daily", desc: "3日以上プレイする（履歴の日付で判定）", price: 200,
        condition: (u) => new Set(_history(u).map(h => h && h.date).filter(Boolean)).size >= 3 },
      { id: "quiz_25_times", name: "学習の鬼", icon: "😤", category: "daily", desc: "累計25回クイズを完走する", price: 600,
        condition: (u) => (u.totalQuizzes || 0) >= 25 },
      { id: "quiz_50_times", name: "継続は力", icon: "🏆", category: "daily", desc: "累計50回クイズを完走する", price: 1200,
        condition: (u) => (u.totalQuizzes || 0) >= 50 }
    ];

    let unlockedAchievements = [];
    let achievementCallbacks = [];

    // === 追加実績（裏世界・学習の深さ） ===
    ACHIEVEMENTS.push(
      { id: "kobun_first", name: "裏世界への扉", icon: "🌌", category: "kobun", desc: "裏世界（古文単語）で初めて1問解く", price: 100,
        condition: (u) => Object.keys(u.wordStats || {}).some(k => Number(k) >= 10001) },
      { id: "kobun_10", name: "古文の入り口", icon: "📜", category: "kobun", desc: "古文単語を10語学習する", price: 150,
        condition: (u) => Object.keys(u.wordStats || {}).filter(k => Number(k) >= 10001).length >= 10 },
      { id: "kobun_50", name: "一章制覇", icon: "🏯", category: "kobun", desc: "1章の50語すべてに解答する", price: 400,
        condition: (u) => Object.keys(u.wordStats || {}).filter(k => Number(k) >= 10001).length >= 50 },
      { id: "kobun_master_10", name: "古文の定着", icon: "🖋️", category: "kobun", desc: "古文単語を10語マスターする", price: 500,
        condition: (u) => Object.entries(u.wordStats || {}).filter(([k, v]) => Number(k) >= 10001 && (v.correct || 0) >= 3).length >= 10 },
      { id: "both_worlds", name: "二つの世界", icon: "🌗", category: "kobun", desc: "表と裏の両方で3語ずつ学習する", price: 300,
        condition: (u) => {
          const keys = Object.keys(u.wordStats || {});
          return keys.filter(k => Number(k) < 10001).length >= 3 && keys.filter(k => Number(k) >= 10001).length >= 3;
        } },
      { id: "streak_10", name: "10連コンボ", icon: "⚡", category: "combo", desc: "1回のクイズで10コンボを達成する", price: 200,
        condition: (u) => (u.maxComboEver || 0) >= 10 },
      { id: "streak_20", name: "20連コンボ", icon: "🌩️", category: "combo", desc: "1回のクイズで20コンボを達成する", price: 450,
        condition: (u) => (u.maxComboEver || 0) >= 20 },
      { id: "quiz_30_times", name: "もはや日課", icon: "🗓️", category: "accuracy", desc: "累計30回クイズを完走する", price: 600,
        condition: (u) => (u.totalQuizzes || 0) >= 30 },
      { id: "accuracy_95", name: "ほぼ完璧", icon: "🔬", category: "accuracy", desc: "20問以上で正答率95%以上を達成する", price: 400,
        condition: (u) => _history(u).some(h => Number(h.accuracy) >= 95 && Number(h.total) >= 20) },
      { id: "perfect_3", name: "三度の完全無欠", icon: "🧿", category: "accuracy", desc: "正答率100%を3回達成する", price: 700,
        condition: (u) => _history(u).filter(h => Number(h.accuracy) === 100 && Number(h.total) >= 10).length >= 3 },
      { id: "level_50", name: "伝説の学習者", icon: "🪐", category: "level", desc: "プレイヤーLv.50に到達する", price: 3000,
        condition: (u) => getLevelState(u.exp).level >= 50 },
      { id: "coins_10000", name: "財宝の山", icon: "🏦", category: "collection", desc: "所持コインが10000を突破する", price: 3000,
        condition: (u) => Number(u.coins) >= 10000 }
    );

    // === 追加実績（到達度テスト・語源ゲーム・学習量） ===
    // 既存の userData フィールドだけで判定できるものに限定している。
    function _sumDailyLog(u) {
      return Object.values(u.dailyLog || {}).reduce((s, n) => s + (Number(n) || 0), 0);
    }
    function _maxDailyLog(u) {
      return Object.values(u.dailyLog || {}).reduce((m, n) => Math.max(m, Number(n) || 0), 0);
    }
    function _kobunLearned(u) {
      return Object.keys(u.wordStats || {}).filter(k => Number(k) >= 10001).length;
    }
    function _rushBest(u) {
      const r = (u.affixStats && u.affixStats.rushBest) || {};
      return Math.max(Number(r.prefix) || 0, Number(r.suffix) || 0);
    }
    function _memoryClears(u) {
      const m = (u.affixStats && u.affixStats.memoryBest) || {};
      return Object.values(m).filter(v => v && Number(v.moves) > 0).length;
    }
    function _exams(u) {
      return (Array.isArray(u.examHistory) ? u.examHistory : []).filter(h => h && h.grade);
    }
    const _GRADE_RANK = { D: 1, C: 2, B: 3, A: 4, S: 5 };
    function _bestExamAccuracy(u) {
      return _exams(u).reduce((m, h) => Math.max(m, Number(h.accuracy) || 0), 0);
    }

    ACHIEVEMENTS.push(
      // === 到達度テスト（exam） ===
      { id: "exam_first", name: "はじめての到達度テスト", icon: "🎓", category: "exam", desc: "到達度テストを最後まで受験する", price: 150,
        condition: (u) => _exams(u).length >= 1, progress: (u) => [_exams(u).length, 1] },
      { id: "exam_grade_b", name: "合格圏が見えた", icon: "📋", category: "exam", desc: "到達度テストでB判定以上をとる", price: 300,
        condition: (u) => _exams(u).some(h => (_GRADE_RANK[h.grade] || 0) >= 3) },
      { id: "exam_grade_a", name: "A判定ブレイク", icon: "🥇", category: "exam", desc: "到達度テストでA判定以上をとる", price: 600,
        condition: (u) => _exams(u).some(h => (_GRADE_RANK[h.grade] || 0) >= 4) },
      { id: "exam_grade_s", name: "S判定の頂", icon: "💎", category: "exam", desc: "到達度テストでS判定をとる", price: 1200,
        condition: (u) => _exams(u).some(h => h.grade === "S") },
      { id: "exam_5", name: "テスト常連", icon: "🔁", category: "exam", desc: "到達度テストを5回受験する", price: 500,
        condition: (u) => _exams(u).length >= 5, progress: (u) => [_exams(u).length, 5] },
      { id: "exam_perfect", name: "到達度満点", icon: "🎯", category: "exam", desc: "到達度テストで正答率100%をとる", price: 900,
        condition: (u) => _bestExamAccuracy(u) >= 100 },

      // === 語源ラッシュ・接辞神経衰弱（game） ===
      { id: "rush_500", name: "語源ラッシュ入門", icon: "🧩", category: "game", desc: "語源ラッシュで500点をとる", price: 150,
        condition: (u) => _rushBest(u) >= 500, progress: (u) => [_rushBest(u), 500] },
      { id: "rush_1500", name: "接辞ハンター", icon: "🧠", category: "game", desc: "語源ラッシュで1500点をとる", price: 400,
        condition: (u) => _rushBest(u) >= 1500, progress: (u) => [_rushBest(u), 1500] },
      { id: "rush_3000", name: "語源の支配者", icon: "👑", category: "game", desc: "語源ラッシュで3000点をとる", price: 900,
        condition: (u) => _rushBest(u) >= 3000, progress: (u) => [_rushBest(u), 3000] },
      { id: "memory_clear", name: "神経衰弱クリア", icon: "🃏", category: "game", desc: "接辞神経衰弱をクリアする", price: 200,
        condition: (u) => _memoryClears(u) >= 1, progress: (u) => [_memoryClears(u), 1] },
      { id: "memory_both", name: "神経衰弱マスター", icon: "🎴", category: "game", desc: "接頭辞・接尾辞の両方で神経衰弱をクリアする", price: 500,
        condition: (u) => _memoryClears(u) >= 2, progress: (u) => [_memoryClears(u), 2] },

      // === 学習量（words） ===
      { id: "answers_500", name: "500問の積み上げ", icon: "📝", category: "words", desc: "累計500問に解答する", price: 300,
        condition: (u) => _sumDailyLog(u) >= 500, progress: (u) => [_sumDailyLog(u), 500] },
      { id: "answers_2000", name: "2000問の努力", icon: "📚", category: "words", desc: "累計2000問に解答する", price: 800,
        condition: (u) => _sumDailyLog(u) >= 2000, progress: (u) => [_sumDailyLog(u), 2000] },
      { id: "answers_5000", name: "5000問の怪物", icon: "🌏", category: "words", desc: "累計5000問に解答する", price: 2000,
        condition: (u) => _sumDailyLog(u) >= 5000, progress: (u) => [_sumDailyLog(u), 5000] },
      { id: "day_100", name: "1日100問", icon: "🔥", category: "words", desc: "1日で100問に解答する", price: 300,
        condition: (u) => _maxDailyLog(u) >= 100, progress: (u) => [_maxDailyLog(u), 100] },
      { id: "day_300", name: "1日300問", icon: "🌋", category: "words", desc: "1日で300問に解答する", price: 900,
        condition: (u) => _maxDailyLog(u) >= 300, progress: (u) => [_maxDailyLog(u), 300] },
      { id: "words_1000", name: "語彙の惑星", icon: "🗺️", category: "words", desc: "異なる1000単語に解答する", price: 3000,
        condition: (u) => Object.keys(u.wordStats || {}).length >= 1000, progress: (u) => [Object.keys(u.wordStats || {}).length, 1000] },
      { id: "words_1500", name: "語彙の宇宙", icon: "🌐", category: "words", desc: "異なる1500単語に解答する", price: 4000,
        condition: (u) => Object.keys(u.wordStats || {}).length >= 1500, progress: (u) => [Object.keys(u.wordStats || {}).length, 1500] },
      { id: "mastered_300", name: "定着した300語", icon: "🏅", category: "words", desc: "3回以上正解した単語を300語つくる", price: 2500,
        condition: (u) => Object.values(u.wordStats || {}).filter(s => (s.correct || 0) >= 3).length >= 300,
        progress: (u) => [Object.values(u.wordStats || {}).filter(s => (s.correct || 0) >= 3).length, 300] },
      { id: "part4_80", name: "Part 4 制圧", icon: "4️⃣", category: "words", desc: "Part 4の8割の単語に解答する", price: 1600,
        condition: (u) => _partCoverage(u, 4) >= 0.8, progress: (u) => [Math.round(_partCoverage(u, 4) * 100), 80] },
      { id: "part5_80", name: "Part 5 制圧", icon: "5️⃣", category: "words", desc: "Part 5の8割の単語に解答する", price: 2000,
        condition: (u) => _partCoverage(u, 5) >= 0.8, progress: (u) => [Math.round(_partCoverage(u, 5) * 100), 80] },

      // === 裏世界（kobun） ===
      { id: "kobun_150", name: "裏世界の全踏破", icon: "📜", category: "kobun", desc: "古文単語150語すべてに解答する", price: 2000,
        condition: (u) => _kobunLearned(u) >= 150, progress: (u) => [_kobunLearned(u), 150] },
      { id: "kobun_master_30", name: "古文の達人", icon: "🖌️", category: "kobun", desc: "古文単語を30語マスターする", price: 1200,
        condition: (u) => Object.entries(u.wordStats || {}).filter(([k, v]) => Number(k) >= 10001 && (v.correct || 0) >= 3).length >= 30,
        progress: (u) => [Object.entries(u.wordStats || {}).filter(([k, v]) => Number(k) >= 10001 && (v.correct || 0) >= 3).length, 30] },

      // === 継続（daily） ===
      { id: "streak_60", name: "二ヶ月の求道者", icon: "🗓️", category: "daily", desc: "60日連続で学習する", price: 3000,
        condition: (u) => (u.streak || 0) >= 60, progress: (u) => [Number(u.streak) || 0, 60] },
      { id: "daily_30", name: "デイリー常連", icon: "💫", category: "daily", desc: "デイリーチャレンジを30回クリアする", price: 1200,
        condition: (u) => (u.dailyClears || 0) >= 30, progress: (u) => [Number(u.dailyClears) || 0, 30] },
      { id: "review_50", name: "記憶の管理者", icon: "🧭", category: "daily", desc: "忘却曲線復習を50回完了する", price: 2000,
        condition: (u) => (u.reviewClears || 0) >= 50, progress: (u) => [Number(u.reviewClears) || 0, 50] },
      { id: "correct_2000", name: "語彙のレジェンド", icon: "🏆", category: "correct", desc: "累計2000問正解を達成する", price: 4000,
        condition: (u) => _totalCorrect(u) >= 2000, progress: (u) => [_totalCorrect(u), 2000] }
    );

    // 既存の数値系実績の進捗（現在値 / 目標値）。「あと少し」表示と進捗バーに使う。
    const ACHIEVEMENT_PROGRESS = {
      correct_10: (u) => [_totalCorrect(u), 10],
      correct_30: (u) => [_totalCorrect(u), 30],
      correct_50: (u) => [_totalCorrect(u), 50],
      correct_100: (u) => [_totalCorrect(u), 100],
      correct_200: (u) => [_totalCorrect(u), 200],
      correct_300: (u) => [_totalCorrect(u), 300],
      correct_500: (u) => [_totalCorrect(u), 500],
      correct_1000: (u) => [_totalCorrect(u), 1000],
      level_2: (u) => [getLevelState(u.exp).level, 2],
      level_5: (u) => [getLevelState(u.exp).level, 5],
      level_10: (u) => [getLevelState(u.exp).level, 10],
      level_20: (u) => [getLevelState(u.exp).level, 20],
      level_30: (u) => [getLevelState(u.exp).level, 30],
      level_50: (u) => [getLevelState(u.exp).level, 50],
      combo_3: (u) => [Number(u.maxComboEver) || 0, 3],
      combo_5: (u) => [Number(u.maxComboEver) || 0, 5],
      combo_10: (u) => [Number(u.maxComboEver) || 0, 10],
      combo_15: (u) => [Number(u.maxComboEver) || 0, 15],
      combo_20: (u) => [Number(u.maxComboEver) || 0, 20],
      combo_30: (u) => [Number(u.maxComboEver) || 0, 30],
      words_10: (u) => [Object.keys(u.wordStats || {}).length, 10],
      words_50: (u) => [Object.keys(u.wordStats || {}).length, 50],
      words_100: (u) => [Object.keys(u.wordStats || {}).length, 100],
      words_300: (u) => [Object.keys(u.wordStats || {}).length, 300],
      words_600: (u) => [Object.keys(u.wordStats || {}).length, 600],
      mastered_10: (u) => [Object.values(u.wordStats || {}).filter(s => (s.correct || 0) >= 3).length, 10],
      mastered_50: (u) => [Object.values(u.wordStats || {}).filter(s => (s.correct || 0) >= 3).length, 50],
      mastered_100: (u) => [Object.values(u.wordStats || {}).filter(s => (s.correct || 0) >= 3).length, 100],
      streak_3: (u) => [Number(u.streak) || 0, 3],
      streak_7: (u) => [Number(u.streak) || 0, 7],
      streak_14: (u) => [Number(u.streak) || 0, 14],
      streak_30: (u) => [Number(u.streak) || 0, 30],
      daily_5: (u) => [Number(u.dailyClears) || 0, 5],
      daily_10: (u) => [Number(u.dailyClears) || 0, 10],
      review_5: (u) => [Number(u.reviewClears) || 0, 5],
      review_20: (u) => [Number(u.reviewClears) || 0, 20],
      coin_100: (u) => [Number(u.coins) || 0, 100],
      coin_500: (u) => [Number(u.coins) || 0, 500],
      coin_1000: (u) => [Number(u.coins) || 0, 1000],
      coin_3000: (u) => [Number(u.coins) || 0, 3000],
      coins_10000: (u) => [Number(u.coins) || 0, 10000],
      quiz_5_times: (u) => [Number(u.totalQuizzes) || 0, 5],
      quiz_10_times: (u) => [Number(u.totalQuizzes) || 0, 10],
      quiz_25_times: (u) => [Number(u.totalQuizzes) || 0, 25],
      quiz_30_times: (u) => [Number(u.totalQuizzes) || 0, 30],
      quiz_50_times: (u) => [Number(u.totalQuizzes) || 0, 50],
      part1_80: (u) => [Math.round(_partCoverage(u, 1) * 100), 80],
      part2_80: (u) => [Math.round(_partCoverage(u, 2) * 100), 80],
      part3_80: (u) => [Math.round(_partCoverage(u, 3) * 100), 80],
      kobun_10: (u) => [_kobunLearned(u), 10],
      kobun_50: (u) => [_kobunLearned(u), 50],
      kobun_master_10: (u) => [Object.entries(u.wordStats || {}).filter(([k, v]) => Number(k) >= 10001 && (v.correct || 0) >= 3).length, 10]
    };

    // 実績の進捗（未対応のものは null）
    function achievementProgress(a) {
      if (!a) return null;
      try {
        const fn = typeof a.progress === "function" ? a.progress : ACHIEVEMENT_PROGRESS[a.id];
        if (typeof fn !== "function") return null;
        const p = fn(userData);
        if (!Array.isArray(p) || p.length < 2) return null;
        const cur = Number(p[0]) || 0;
        const goal = Math.max(1, Number(p[1]) || 1);
        return { cur: Math.max(0, Math.round(cur)), goal: Math.round(goal) };
      } catch (e) { return null; }
    }

    function isAchievementDone(id) {
      return unlockedAchievements.includes(id);
    }

    function evalAchievement(a) {
      try { return typeof a.condition === "function" ? !!a.condition(userData) : false; }
      catch (e) { return false; }
    }

    function unlockIfMet(a) {
      if (!isAchievementDone(a.id) && evalAchievement(a)) {
        unlockedAchievements.push(a.id);
        return true;
      }
      return false;
    }

    // 実績で自動解放される称号を所持リストへ追加
    function syncEarnedTitles() {
      const granted = [];
      const grant = (list, owned) => {
        list.forEach(t => {
          if (!t.unlockAchievement) return;
          if (!isAchievementDone(t.unlockAchievement)) return;
          if (!Array.isArray(owned) || owned.includes(t.id)) return;
          owned.push(t.id);
          granted.push(t);
        });
      };
      grant(PREFIX_TITLES, userData.purchasedPrefixes);
      grant(SUFFIX_TITLES, userData.purchasedSuffixes);
      return granted;
    }

    function initAchievements() {
      loadAchievements();
      syncOwnedAvatars();
      ACHIEVEMENTS.forEach(unlockIfMet);
      const newTitles = syncEarnedTitles();
      const newAvatars = syncOwnedAvatars();
      saveAchievements();
      updateAchievementCount();
      if (newTitles.length || newAvatars.length) saveUserData();
    }

    function getAchievementById(id) {
      return ACHIEVEMENTS.find(a => a.id === id);
    }

    function getAchievementsList() {
      return ACHIEVEMENTS.map(a => ({
        ...a,
        done: isAchievementDone(a.id)
      }));
    }

    function loadAchievements() {
      try {
        const saved = localStorage.getItem("LEAP_ACHIEVEMENTS_V1");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) unlockedAchievements = parsed;
        }
      } catch (e) { unlockedAchievements = []; }
      sanitizeAchievements();
    }

    // 旧バージョンのIDや重複を除去（分母より分子が多くなる不具合の修正）
    function sanitizeAchievements() {
      const known = new Set(ACHIEVEMENTS.map(a => a.id));
      const seen = new Set();
      unlockedAchievements = (Array.isArray(unlockedAchievements) ? unlockedAchievements : [])
        .filter(id => typeof id === "string" && known.has(id) && !seen.has(id) && seen.add(id));
      return unlockedAchievements;
    }

    function countUnlocked() {
      return ACHIEVEMENTS.filter(a => unlockedAchievements.includes(a.id)).length;
    }

    function saveAchievements() {
      try { localStorage.setItem("LEAP_ACHIEVEMENTS_V1", JSON.stringify(unlockedAchievements)); } catch (e) {}
    }

    function checkAchievements() {
      const newAvatars = syncOwnedAvatars();
      const newly = [];
      ACHIEVEMENTS.forEach(a => { if (unlockIfMet(a)) newly.push(a); });
      const newTitles = syncEarnedTitles();
      newAvatars.push(...syncOwnedAvatars());
      if (newly.length || newTitles.length || newAvatars.length) {
        saveAchievements();
        updateAchievementCount();
        saveUserData();
      }
      if (newly.length) notifyAchievements(newly);
      newTitles.forEach(t => showToast(`🏷️ 実績称号「${composeTitle(userData.prefix, t.name)}」を獲得！`));
      newAvatars.forEach(a => showToast(`🎭 アバター「${a.name}」を解放！`));
    }

    function notifyAchievements(newly) {
      newly.forEach(a => {
        showToast(`${a.icon} 実績解除: ${a.name}（ボーナス ${a.price} Coin）`);
      });
      const earned = newly.reduce((sum, a) => sum + (a.price || 0), 0);
      if (earned > 0) {
        userData.coins += earned;
        saveUserData();
      }
    }

    function updateAchievementCount() {
      sanitizeAchievements();
      const text = `${countUnlocked()}/${ACHIEVEMENTS.length}`;
      ["header-achievement-count", "shop-achievement-count", "achievement-modal-count", "home-achievement-count-badge"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
      });
    }

    function openAchievementsModal() {
      const modal = document.getElementById("achievements-modal");
      if (!modal) return;
      ACHIEVEMENTS.forEach(unlockIfMet);
      saveAchievements();
      updateAchievementCount();
      renderAchievementList();
      modal.classList.remove("hidden");
    }

    function closeAchievementsModal() {
      const modal = document.getElementById("achievements-modal");
      if (modal) modal.classList.add("hidden");
    }

    let currentAchievementTab = "all";
    let currentAchievementDone = "all";

    function setAchievementTab(tab) {
      currentAchievementTab = tab;
      renderAchievementList();
    }

    function setAchievementDone(done) {
      currentAchievementDone = done;
      renderAchievementList();
    }

    function renderAchievementList() {
      const list = document.getElementById("achievement-list");
      if (!list) return;
      list.innerHTML = "";

      sanitizeAchievements();
      const totalCount = ACHIEVEMENTS.length;
      const doneCount = countUnlocked();
      const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

      // 上部に進捗プログレスバー
      const progDiv = document.createElement("div");
      progDiv.className = "p-3 bg-emerald-50 rounded-2xl border border-emerald-200 mb-2";
      progDiv.innerHTML = `
        <div class="flex justify-between items-center text-xs font-bold text-emerald-800 mb-1">
          <span>🏆 実績達成率</span>
          <span>${doneCount} / ${totalCount} (${pct}%)</span>
        </div>
        <div class="w-full bg-emerald-200/60 h-2 rounded-full overflow-hidden">
          <div class="bg-emerald-600 h-full rounded-full transition-all duration-300" style="width: ${pct}%"></div>
        </div>
      `;
      list.appendChild(progDiv);

      // あと少しで解除できる実績（未達成のうち進捗率が高いもの）
      const nextGoals = ACHIEVEMENTS
        .filter(a => !isAchievementDone(a.id))
        .map(a => ({ a: a, p: achievementProgress(a) }))
        .filter(x => x.p && x.p.cur > 0 && x.p.cur < x.p.goal)
        .sort((x, y) => (y.p.cur / y.p.goal) - (x.p.cur / x.p.goal))
        .slice(0, 3);
      if (nextGoals.length) {
        const goalsBox = document.createElement("div");
        goalsBox.className = "p-3 bg-amber-50/70 border border-amber-200 rounded-2xl mb-2 space-y-2";
        goalsBox.innerHTML = `<p class="text-[11px] font-extrabold text-amber-900">🎯 あと少しで解除</p>`
          + nextGoals.map(({ a, p }) => {
            const gPct = Math.min(100, Math.round((p.cur / p.goal) * 100));
            return `<div class="space-y-1">`
              + `<div class="flex items-center justify-between gap-2 text-[11px] font-bold text-amber-900"><span class="truncate">${a.icon} ${a.name}</span><span class="shrink-0 tabular-nums">${p.cur} / ${p.goal}</span></div>`
              + `<div class="w-full bg-amber-200/70 h-1.5 rounded-full overflow-hidden"><div class="bg-amber-500 h-full rounded-full" style="width:${gPct}%"></div></div>`
              + `</div>`;
          }).join("");
        list.appendChild(goalsBox);
      }

      // カテゴリフィルタータブ
      const tabs = [
        { id: "all", label: "すべて" },
        { id: "basic", label: "基本" },
        { id: "correct", label: "正解数" },
        { id: "combo", label: "コンボ" },
        { id: "level", label: "レベル" },
        { id: "accuracy", label: "クイズ" },
        { id: "collection", label: "収集" },
        { id: "words", label: "単語" },
        { id: "review", label: "復習" },
        { id: "shop", label: "ショップ" },
        { id: "daily", label: "継続" },
        { id: "exam", label: "テスト" },
        { id: "game", label: "語源ゲーム" },
        { id: "kobun", label: "裏世界" }
      ];
      const tabContainer = document.createElement("div");
      tabContainer.className = "flex gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-1 text-[11px] font-bold";
      tabs.forEach(t => {
        const tBtn = document.createElement("button");
        tBtn.type = "button";
        const isActive = currentAchievementTab === t.id;
        tBtn.className = `px-2.5 py-1 rounded-lg shrink-0 transition cursor-pointer ${
          isActive
            ? "bg-slate-900 text-white"
            : "bg-slate-100 hover:bg-slate-200 text-slate-600"
        }`;
        tBtn.textContent = t.label;
        tBtn.onclick = () => setAchievementTab(t.id);
        tabContainer.appendChild(tBtn);
      });
      list.appendChild(tabContainer);

      const doneBar = document.createElement("div");
      doneBar.className = "flex gap-1.5 mb-2 text-[11px] font-bold";
      [
        { id: "all", label: "すべて" },
        { id: "done", label: "達成済み" },
        { id: "todo", label: "未達成" }
      ].forEach(d => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "flex-1 py-1.5 rounded-lg transition cursor-pointer " + (currentAchievementDone === d.id ? "bg-emerald-600 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-600");
        b.textContent = d.label;
        b.onclick = () => setAchievementDone(d.id);
        doneBar.appendChild(b);
      });
      list.appendChild(doneBar);

      const filtered = ACHIEVEMENTS.filter(a => {
        const tabOk = currentAchievementTab === "all" || a.category === currentAchievementTab;
        if (!tabOk) return false;
        const done = isAchievementDone(a.id);
        if (currentAchievementDone === "done") return done;
        if (currentAchievementDone === "todo") return !done;
        return true;
      });

      filtered.forEach(a => {
        const done = isAchievementDone(a.id);
        const prog = done ? null : achievementProgress(a);
        const progPct = prog ? Math.min(100, Math.round((prog.cur / prog.goal) * 100)) : 0;
        const progHtml = prog
          ? `<div class="mt-1.5"><div class="w-full bg-slate-200 h-1 rounded-full overflow-hidden"><div class="bg-emerald-500 h-full rounded-full" style="width:${progPct}%"></div></div><div class="text-[10px] font-bold text-slate-400 tabular-nums mt-0.5">${prog.cur} / ${prog.goal}</div></div>`
          : "";
        const div = document.createElement("div");
        div.className = `flex items-center gap-3 p-2.5 rounded-2xl border transition-all ${
          done
            ? "bg-emerald-50/70 border-emerald-300 shadow-sm"
            : "bg-white border-slate-200 opacity-60"
        }`;
        div.innerHTML = `
          <span class="text-2xl shrink-0 p-1.5 rounded-xl ${done ? "bg-emerald-100" : "bg-slate-100"}">${a.icon}</span>
          <div class="min-w-0 flex-1">
            <div class="font-extrabold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5 truncate">
              <span>${a.name}</span>
              ${done ? '<span class="text-[10px] text-emerald-700 bg-emerald-200/80 px-1.5 py-0.2 rounded font-bold">達成！</span>' : ''}
            </div>
            <div class="text-[11px] text-slate-400 mt-0.5 truncate">${a.desc}</div>
            ${progHtml}
          </div>
          <div class="text-right shrink-0">
            <span class="text-xs font-bold ${done ? "text-amber-600" : "text-slate-400"}">🪙 +${a.price}</span>
          </div>
        `;
        list.appendChild(div);
      });
    }

    function registerAchievementCallback(fn) {
      achievementCallbacks.push(fn);
    }

    function notifyAchievementsVerbose(newly) {
      newly.forEach(a => showToast(`${a.icon} 実績解除: ${a.name}（ボーナス ${a.price} Coin）`));
      const earned = newly.reduce((sum, a) => sum + (a.price || 0), 0);
      if (earned > 0) {
        userData.coins += earned;
        saveUserData();
      }
    }

    // ===== 単語辞典（番号順） =====
    let dictionaryEntries = [];
    let dictPage = 1;
    const DICT_PAGE_SIZE = 100;
    const DICT_FILTER_KEY = "LEAP_DICTIONARY_FILTER_V1";
    const DICT_FILTER_OPEN_KEY = "LEAP_DICT_FILTER_OPEN_V1";
    let dictFilterOpen = false;

    // 絞り込みパネルの開閉（スマホで固定バーが高くなりすぎないよう既定は閉じる）
    function loadDictFilterOpenState() {
      try { dictFilterOpen = localStorage.getItem(DICT_FILTER_OPEN_KEY) === "1"; }
      catch (e) { dictFilterOpen = false; }
      applyDictFilterPanelState();
    }

    function applyDictFilterPanelState() {
      const panel = document.getElementById("dict-filter-panel");
      const chevron = document.getElementById("dict-filter-chevron");
      if (panel) panel.classList.toggle("hidden", !dictFilterOpen);
      if (chevron) chevron.textContent = dictFilterOpen ? "▲" : "▼";
    }

    function toggleDictFilterPanel() {
      dictFilterOpen = !dictFilterOpen;
      try { localStorage.setItem(DICT_FILTER_OPEN_KEY, dictFilterOpen ? "1" : "0"); } catch (e) {}
      applyDictFilterPanelState();
    }

    // 適用中の絞り込み数をバッジ表示
    function updateDictFilterBadge() {
      const badge = document.getElementById("dict-filter-active-count");
      if (!badge) return;
      const f = dictionaryFilter || {};
      const active = (Array.isArray(f.parts) ? f.parts.length : 0)
        + (Array.isArray(f.statuses) ? f.statuses.length : 0)
        + (f.start !== "" && f.start != null ? 1 : 0)
        + (f.end !== "" && f.end != null ? 1 : 0);
      badge.textContent = String(active);
      badge.classList.toggle("hidden", active === 0);
    }
    // ===== 学習ステータス判定（辞典・出題絞り込みで共通利用） =====
    const WORD_STATUSES = ["all", "unlearned", "weak", "learning", "mastered"];
    const WORD_STATUS_LABEL = {
      all: "すべて",
      unlearned: "未学習",
      weak: "苦手",
      learning: "学習中",
      mastered: "マスター"
    };

    // マスター: 正解3回以上かつ正答率90%以上 / 苦手: 正答率50%未満 / 学習中: それ以外
    function getWordStatus(id) {
      const s = (userData.wordStats || {})[id];
      if (!s || !s.total) return "unlearned";
      const pct = Math.round((s.correct / s.total) * 100);
      if (s.correct >= 3 && pct >= 90) return "mastered";
      if (pct < 50) return "weak";
      if (s.correct >= 1) return "learning";
      return "weak";
    }

    function toHiragana(str) {
      return String(str || "").replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
    }

    // 漢字→かな対応表。データ追加時にここへ追記すると、ひらがな検索で漢字の語がヒットする。
    const KANJI_READINGS = {};

    function kanaFromKanji(word) {
      const src = String(word || "");
      let out = "";
      let sawKanji = false;
      for (const ch of src) {
        if (/[\u4e00-\u9fff\u3005]/.test(ch)) {
          sawKanji = true;
          const kana = KANJI_READINGS[ch];
          if (!kana) return "";
          out += kana;
        } else {
          out += ch;
        }
      }
      return sawKanji ? out : "";
    }

    function normalizeSearchText(str) {
      const raw = String(str || "");
      const base = raw.normalize ? raw.normalize("NFKC").toLowerCase() : raw.toLowerCase();
      return toHiragana(base);
    }

    function wordMatchesStatus(id, status) {
      if (!status || status === "all") return true;
      return getWordStatus(id) === status;
    }

    // 複数選択（いずれかに一致＝OR。範囲やPartとはANDで組み合わせる）
    function wordMatchesStatuses(id, statuses) {
      if (!Array.isArray(statuses) || statuses.length === 0) return true;
      return statuses.includes(getWordStatus(id));
    }

    let dictionaryFilter = { parts: [], start: "", end: "", statuses: [] };

    // 辞典のPart絞り込みは、いまのゾーンのPart定義から生成する
    function renderDictionaryPartFilters() {
      const box = document.getElementById("dict-part-filters");
      if (!box) return;
      const valid = PARTS.filter(p => isPartAvailable(p));
      const validIds = valid.map(p => String(p.id));
      dictionaryFilter.parts = dictionaryFilter.parts.filter(p => validIds.includes(p));
      box.innerHTML = "";
      const addChip = (id, label) => {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.dictPart = id;
        b.textContent = label;
        b.onclick = () => setDictionaryPartFilter(id);
        box.appendChild(b);
      };
      addChip("all", "全て");
      valid.forEach(p => addChip(String(p.id), p.name));
      syncDictionaryFilterUi();
    }

    function openDictionary() {
      userData.dictOpened = true;
      saveUserData();
      checkAchievements();
      renderDictionary();
      navigate("screen-dictionary");
    }

    function renderDictionary() {
      const list = document.getElementById("dictionary-list");
      if (!list) return;
      const words = [...ALL_WORDS].sort((a, b) => a.id - b.id);
      const searchEl = document.getElementById("dictionary-search");
      if (searchEl) searchEl.value = "";
      dictionaryEntries = [];
      dictPage = 1;

      const frag = document.createDocumentFragment();
      words.forEach(w => {
        const row = document.createElement("div");
        row.className = "bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex gap-3 items-start cursor-pointer hover:bg-slate-50 transition-colors";
        row.setAttribute("role", "button");
        row.tabIndex = 0;
        row.addEventListener("click", () => openWordDetail(w.id));
        row.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openWordDetail(w.id); }
        });

        
        const idEl = document.createElement("span");
        idEl.className = "text-[11px] font-bold text-slate-400 tabular-nums w-9 shrink-0 pt-0.5";
        idEl.textContent = w.num || w.id;

        const body = document.createElement("div");
        body.className = "min-w-0 flex-1";
        const wordEl = document.createElement("div");
        wordEl.className = "font-bold text-slate-900 text-sm break-words flex items-center justify-between gap-2";
        
        // 単語学習ステータスバッジ
        const st = (userData.wordStats || {})[w.id];
        let statusBadge = '<span class="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded shrink-0">未出題</span>';
        if (st && st.total > 0) {
          const pct = Math.round((st.correct / st.total) * 100);
          if (st.correct >= 3 && pct >= 90) {
            statusBadge = `<span class="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded shrink-0">👑マスター (${pct}%)</span>`;
          } else if (pct < 50) {
            statusBadge = `<span class="text-[10px] font-bold text-rose-800 bg-rose-100 px-1.5 py-0.2 rounded shrink-0">苦手 (${pct}% ・ ${st.correct}/${st.total})</span>`;
          } else {
            statusBadge = `<span class="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded shrink-0">学習中 (${pct}% ・ ${st.correct}/${st.total})</span>`;
          }
        }
        wordEl.innerHTML = `<span class="flex items-center gap-1.5 flex-wrap min-w-0"><span>${escapeHtml(w.word)}</span>${posBadgesHtml(w)}</span>${statusBadge}`;

        const ipaEl = document.createElement("div");
        ipaEl.className = "hidden text-[11px] font-medium text-slate-400 tracking-wide mt-0.5";
        applyWordIpa(ipaEl, w);

        const meaningEl = document.createElement("div");
        meaningEl.className = "text-xs text-slate-500 mt-0.5 break-words";
        meaningEl.textContent = w.subject === "kobun" ? formatKobunMeaning(w.meaning) : w.meaning;
        if (w.subject === "kobun" && w.reading && w.reading !== w.word) {
          const readingEl = document.createElement("div");
          readingEl.className = "text-[11px] font-bold text-violet-500 mt-0.5 break-words";
          readingEl.textContent = `読み：${w.reading}`;
          body.appendChild(readingEl);
        }
        body.appendChild(wordEl);
        body.appendChild(ipaEl);
        body.appendChild(meaningEl);


        row.appendChild(idEl);
        row.appendChild(body);
        frag.appendChild(row);

        const numVal = (typeof w.num === "number") ? w.num : w.id;
        dictionaryEntries.push({
          el: row,
          id: w.id,
          num: numVal,
          part: String(w.part || 1),
          status: getWordStatus(w.id),
          searchKana: normalizeSearchText([w.reading || "", w.yomi || "", kanaFromKanji(w.word)].filter(Boolean).join(" ")),
          idText: String(w.id),
          numText: String(numVal),
          word: String(w.word || "").toLowerCase(),
          meaningNorm: String(w.meaning || "").normalize("NFKC").toLowerCase()
        });
      });

      list.innerHTML = "";
      list.appendChild(frag);

      renderDictionaryPartFilters();
      applyDictionaryFilters();
    }

    // ===== 単語詳細シート =====
    let currentDetailWord = null;

    function escapeRegExpLocal(s) {
      return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function sensesHtml(senses) {
      return (senses || []).map(s => {
        const tag = normalizePosDetail(s.tag);
        return `<div class="flex gap-1.5 items-start">`
          + `<span class="shrink-0 pt-0.5">${tag ? posBadgeHtml(tag) : ""}</span>`
          + `<span class="text-xs leading-relaxed ${s.important ? "font-bold text-slate-900" : "text-slate-700"} break-words">${escapeHtml(s.text)}</span>`
          + `</div>`;
      }).join("");
    }

    function highlightWordInSentence(text, answer) {
      const safeText = String(text || "");
      const ans = String(answer || "");
      if (!ans) return escapeHtml(safeText);
      const re = new RegExp(escapeRegExpLocal(ans), "i");
      const m = safeText.match(re);
      if (!m) return escapeHtml(safeText);
      const i = m.index;
      return escapeHtml(safeText.slice(0, i))
        + `<strong class="text-emerald-700 underline decoration-emerald-300 underline-offset-2">${escapeHtml(m[0])}</strong>`
        + escapeHtml(safeText.slice(i + m[0].length));
    }

    function openWordDetail(wordId) {
      const w = ALL_WORDS.find(x => x.id === Number(wordId));
      if (!w) return;
      const isKobun = isKobunZone();
      const numOrId = (isKobun && typeof w.num === "number") ? `単語番号: #${w.num}` : `ID: #${w.id}`;
      const partName = isKobun
        ? (PARTS.find(p => p.id === w.part)?.name || `Part ${w.part || "-"}`)
        : `Part ${w.part || "-"}`;
      openWordSheet(w, `${numOrId} ・ ${partName}`);
    }

    // 参考資料（第1部の基礎単語）も辞典と同じシートで表示する
    function openReferenceWord(chapterIndex, wordIndex) {
      if (typeof LEAP_REFERENCE_DATA === "undefined" || !Array.isArray(LEAP_REFERENCE_DATA)) return;
      const ch = LEAP_REFERENCE_DATA[chapterIndex];
      const rw = ch && ch.words && ch.words[wordIndex];
      if (!rw) return;
      const w = {
        id: null,
        word: rw.word,
        ipa: rw.ipa,
        posTags: rw.posTags || [],
        meaning: (rw.senses || []).map(s => s.text).join("、"),
        detail: {
          ipa: rw.ipa,
          senses: rw.senses || [],
          posTags: rw.posTags || [],
          notes: rw.notes || [],
          examples: []
        }
      };
      openWordSheet(w, `基礎単語 ・ ${ch.title}`);
    }

    function openWordSheet(w, metaText) {
      const modal = document.getElementById("word-detail-modal");
      if (!modal) return;
      currentDetailWord = w;
      const d = w.detail || null;

      const meta = document.getElementById("word-detail-meta");
      if (meta) meta.textContent = metaText || "";
      const title = document.getElementById("word-detail-title");
      if (title) title.textContent = w.word || "";
      const posEl = document.getElementById("word-detail-pos");
      if (posEl) posEl.innerHTML = posBadgesHtml(w);
      applyWordIpa(document.getElementById("word-detail-ipa"), w);

      const body = document.getElementById("word-detail-body");
      if (!body) return;
      let html = "";

      // 古文単語は品詞・IPA・例文の代わりに、読み・章・単語番号を見せる
      const isKobunWord = (w.subject === "kobun") || (isKobunZone() && typeof w.num === "number");
      if (isKobunWord) {
        const chapter = PARTS.find(p => p.id === w.part);
        const reading = w.reading || w.yomi || "";
        const info = [
          reading && reading !== w.word ? `読み：${reading}` : "",
          (d && d.kanji) ? `漢字：${d.kanji}` : "",
          (d && d.form) ? `${d.pos || "活用"}：${d.form}` : "",
          (d && d.frequency) ? `重要度：${"★".repeat(d.frequency)}${"☆".repeat(Math.max(0, 3 - d.frequency))}` : "",
          chapter ? `収録：${chapter.name}` : "",
          (typeof w.num === "number") ? `単語番号：#${w.num}` : ""
        ].filter(Boolean);
        if (info.length) {
          html += `<div class="bg-violet-50/70 border border-violet-200 rounded-xl p-3">`
            + `<p class="text-[10px] font-bold uppercase tracking-wider text-violet-700 mb-1">古文情報</p>`
            + `<p class="text-xs leading-relaxed text-violet-900 break-words">${info.map(escapeHtml).join(" ・ ")}</p>`
            + `</div>`;
        }
      }

      html += `<div>`
        + `<p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">語義</p>`
        + `<div class="space-y-1.5">${d && d.senses && d.senses.length ? sensesHtml(d.senses) : `<div class="text-xs leading-relaxed text-slate-700">${escapeHtml(isKobunWord ? formatKobunMeaning(w.meaning) : (w.meaning || ""))}</div>`}</div>`
        + `</div>`;

      if (isKobunWord && d && d.core) {
        html += `<div class="bg-violet-50/70 border border-violet-200 rounded-xl p-3">`
          + `<p class="text-[10px] font-bold uppercase tracking-wider text-violet-700">コアイメージ</p>`
          + `<p class="text-xs leading-relaxed text-violet-900 break-words">${escapeHtml(d.core)}</p>`
          + `</div>`;
      }

      if (d && d.notes && d.notes.length) {
        const noteHtml = d.notes.map(n => typeof n === "string"
          ? `<p class="text-xs leading-relaxed text-slate-600 whitespace-pre-line">${escapeHtml(n)}</p>`
          : `<div class="space-y-0.5">`
            + (n.label ? `<p class="text-[10px] font-bold text-amber-700">${escapeHtml(n.label)}</p>` : "")
            + `<p class="text-xs leading-relaxed text-slate-600 whitespace-pre-line">${escapeHtml(n.text || "")}</p>`
            + `</div>`
        ).join("");
        html += `<div class="bg-amber-50/70 border border-amber-200 rounded-xl p-3 space-y-1.5">`
          + `<p class="text-[10px] font-bold uppercase tracking-wider text-amber-700">${isKobunWord ? "解説・入試・関連" : "コラム・頻出"}</p>`
          + noteHtml + `</div>`;
      }

      if (d && d.examples && d.examples.length) {
        if (isKobunWord) {
          const exHtml = d.examples.map((ex, i) => {
            const sentence = ex.sentence ? formatKobunMarked(ex.sentence) : escapeHtml(ex.plain || "");
            const ja = ex.ja ? formatKobunMarked(ex.ja) : "";
            const source = ex.source
              ? `<span class="ml-1 inline-block text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded px-1 py-0.5 align-[1px]">${escapeHtml(ex.source)}</span>`
              : "";
            return `<li class="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 space-y-1.5">`
              + `<div class="flex gap-2 items-start">`
              + `<span class="shrink-0 mt-0.5 w-5 h-5 rounded-md bg-white border border-slate-200 text-slate-500 text-[10px] font-bold flex items-center justify-center">${i + 1}</span>`
              + `<p class="flex-1 text-[13px] font-semibold text-slate-800 leading-relaxed break-words">${sentence}</p>`
              + `<button type="button" onclick="speakDetailExample(${i})" title="例文を読み上げ" class="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 flex items-center justify-center text-[13px] transition cursor-pointer">🔊</button>`
              + `</div>`
              + (ja
                ? `<p class="pl-7 text-xs text-slate-600 leading-relaxed break-words"><span class="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 mr-1 align-[1px]">訳</span>${ja}${source}</p>`
                : (source ? `<p class="pl-7 text-[11px] text-slate-500">出典：${escapeHtml(ex.source)}</p>` : ""))
              + (ex.note ? `<p class="pl-7 text-[11px] text-slate-500 leading-relaxed break-words">${escapeHtml(ex.note)}</p>` : "")
              + `</li>`;
          }).join("");
          html += `<div>`
            + `<div class="flex items-center justify-between mb-1.5">`
            + `<p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">例文・出典</p>`
            + `<span class="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">${d.examples.length}件</span>`
            + `</div>`
            + `<ul class="space-y-2">${exHtml}</ul></div>`;
        } else {
          const exHtml = d.examples.map((ex, i) => {
            const en = highlightWordInSentence(ex.plain || ex.en || "", ex.answer || w.word);
            const ja = ex.ja ? highlightJapanese(ex.ja, w, ex.jaMark) : "";
            return `<li class="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 space-y-1.5">`
              + `<div class="flex gap-2 items-start">`
              + `<span class="shrink-0 mt-0.5 w-5 h-5 rounded-md bg-white border border-slate-200 text-slate-500 text-[10px] font-bold flex items-center justify-center">${i + 1}</span>`
              + `<p class="flex-1 text-[13px] font-semibold text-slate-800 leading-relaxed break-words">${en}</p>`
              + `<button type="button" onclick="speakDetailExample(${i})" title="例文を読み上げ" class="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 flex items-center justify-center text-[13px] transition cursor-pointer">🔊</button>`
              + `</div>`
              + (ja ? `<p class="pl-7 text-xs text-slate-600 leading-relaxed break-words"><span class="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 mr-1 align-[1px]">訳</span>${ja}</p>` : "")
              + `</li>`;
          }).join("");
          html += `<div>`
            + `<div class="flex items-center justify-between mb-1.5">`
            + `<p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">例文</p>`
            + `<span class="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">${d.examples.length}件</span>`
            + `</div>`
            + `<ul class="space-y-2">${exHtml}</ul></div>`;
        }
      } else if (!d) {
        html += isKobunWord
          ? `<p class="text-xs text-slate-400">この古語の詳細データはまだ収録されていません。</p>`
          : `<p class="text-xs text-slate-400">この単語の詳細データ（発音記号・コラム・例文）はまだ収録されていません。</p>`;
      }

      body.innerHTML = html;
      modal.classList.remove("hidden");
      modal.classList.add("flex");
      const sheet = modal.querySelector(".sheet-in");
      if (sheet) {
        sheet.classList.remove("sheet-in");
        void sheet.offsetWidth;
        sheet.classList.add("sheet-in");
      }
    }

    function closeWordDetail() {
      const modal = document.getElementById("word-detail-modal");
      if (!modal) return;
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      currentDetailWord = null;
    }

    // ===== 参考資料（語源・接頭辞・接尾辞） =====
    function refLineHtml(line) {
      const t = String(line || "");
      if (/^■/.test(t)) return `<h4 class="text-sm font-extrabold text-slate-800 mt-3 mb-1">${escapeHtml(t)}</h4>`;
      if (/^【/.test(t)) return `<p class="text-xs font-extrabold text-emerald-700 mt-2">${escapeHtml(t)}</p>`;
      if (/^[・\-]/.test(t)) return `<p class="text-xs text-slate-600 pl-3 leading-relaxed">${escapeHtml(t)}</p>`;
      if (/^\(\d+\)/.test(t)) return `<p class="text-xs font-bold text-slate-700 mt-1.5 leading-relaxed">${escapeHtml(t)}</p>`;
      return `<p class="text-xs text-slate-600 leading-relaxed">${escapeHtml(t)}</p>`;
    }

    let referenceTab = 0;
    let referenceQuizItems = [];
    const referenceQuizState = {};

    // 第5部の「20問」を問題・選択肢・正解に分解する
    function parseReferenceQuiz(blocks) {
      const items = [];
      let section = "";
      let cur = null;
      (blocks || []).forEach(raw => {
        const t = String(raw || "").trim();
        if (!t) return;
        if (/^■/.test(t)) { section = t.replace(/^■\s*/, ""); return; }
        let m = t.match(/^\((\d+)\)\s*(.+)$/);
        if (m) { cur = { no: m[1], ja: m[2], section: section }; return; }
        if (cur && !cur.raw && /[①-⑳]/.test(t) && /\/\s*\[?[①-⑳]/.test(t)) { cur.raw = t; return; }
        m = t.match(/^★正解[:：]\s*([①-⑳])\s*(.*)$/);
        if (m && cur && cur.raw) {
          const labels = cur.raw.match(/[①-⑳]/g) || [];
          cur.answerLabel = m[1];
          cur.answerText = m[2];
          cur.correct = labels.indexOf(m[1]);
          cur.choices = labels;
          // 正解を示す括弧を外して、回答前は答えが分からないようにする
          cur.en = cur.raw.replace(/\[([①-⑳][^\]]*)\]/g, "$1");
          items.push(cur);
          cur = null;
        }
      });
      return items;
    }

    function referenceQuizItemHtml(i) {
      const it = referenceQuizItems[i];
      if (!it) return "";
      const selected = referenceQuizState[i];
      const answered = selected !== undefined;
      const isRight = answered && selected === it.correct;
      const en = answered
        ? escapeHtml(it.en).replace(it.answerLabel, `<mark class="bg-emerald-100 text-emerald-900 font-bold px-0.5 rounded">${it.answerLabel}</mark>`)
        : escapeHtml(it.en);
      const footer = answered
        ? `<p class="text-xs font-bold ${isRight ? "text-emerald-700" : "text-rose-600"}">${isRight ? "○ 正解！" : "× 不正解"}　正解：${escapeHtml(it.answerLabel)} ${escapeHtml(it.answerText)}</p>`
        : `<div class="flex items-center gap-2 pt-0.5">
            ${it.choices.map((label, ci) => `<button type="button" onclick="answerReferenceQuiz(${i}, ${ci})" class="min-w-[46px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-extrabold text-slate-700 hover:border-emerald-400 hover:text-emerald-700 transition cursor-pointer">${label}</button>`).join("")}
            <span class="text-[10px] text-slate-400">正しい方を選ぼう</span>
          </div>`;
      return `<div id="ref-quiz-${i}" class="rounded-xl border border-slate-200 bg-white px-3 py-3 space-y-1.5">
          <p class="text-xs font-bold text-slate-800 leading-relaxed">(${escapeHtml(it.no)}) ${escapeHtml(it.ja)}</p>
          <p class="text-[13px] font-semibold text-slate-700 leading-relaxed break-words">${en}</p>
          ${footer}
        </div>`;
    }

    function answerReferenceQuiz(index, choice) {
      if (referenceQuizState[index] !== undefined) return;
      referenceQuizState[index] = choice;
      const el = document.getElementById("ref-quiz-" + index);
      if (el) el.outerHTML = referenceQuizItemHtml(index);
    }

    function renderReferenceQuiz() {
      let html = "";
      let lastSection = "";
      referenceQuizItems.forEach((it, i) => {
        if (it.section !== lastSection) {
          lastSection = it.section;
          if (lastSection) html += `<h4 class="text-sm font-extrabold text-slate-800 mt-3 mb-1">■ ${escapeHtml(lastSection)}</h4>`;
        }
        html += referenceQuizItemHtml(i);
      });
      return html;
    }

    function setReferenceTab(index) {
      referenceTab = Number(index) || 0;
      renderReference();
      try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { window.scrollTo(0, 0); }
    }

    function referenceTabShortTitle(ch) {
      return String(ch.subtitle || "")
        .replace(/（[^）]*）/g, "")
        .replace(/^[\s\u3000]+|[\s\u3000]+$/g, "");
    }

    function renderReference() {
      const box = document.getElementById("reference-content");
      const tabsEl = document.getElementById("reference-tabs");
      if (!box) return;
      if (typeof LEAP_REFERENCE_DATA === "undefined" || !Array.isArray(LEAP_REFERENCE_DATA)) {
        box.innerHTML = `<p class="text-sm text-slate-400">参考資料が読み込まれていません。</p>`;
        if (tabsEl) tabsEl.innerHTML = "";
        return;
      }
      if (referenceTab < 0 || referenceTab >= LEAP_REFERENCE_DATA.length) referenceTab = 0;

      // 部ごとのタブ
      if (tabsEl) {
        tabsEl.innerHTML = LEAP_REFERENCE_DATA.map((ch, i) => {
          const active = i === referenceTab;
          return `<button type="button" onclick="setReferenceTab(${i})" class="shrink-0 px-3 py-2 rounded-xl border text-left transition cursor-pointer ${
            active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
          }">
            <span class="block text-xs font-extrabold">${escapeHtml(ch.title || "")}</span>
            <span class="block text-[10px] mt-0.5 max-w-[120px] truncate ${active ? "text-slate-300" : "text-slate-400"}">${escapeHtml(referenceTabShortTitle(ch))}</span>
          </button>`;
        }).join("");
      }

      const ch = LEAP_REFERENCE_DATA[referenceTab];
      if (!ch) { box.innerHTML = ""; return; }
      referenceQuizItems = parseReferenceQuiz(ch.blocks);

      // 第1部の基礎単語は辞典と同じ行スタイル（タップで詳細シート）
      const words = (ch.words || []).map((w, i) => `
        <div class="bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex gap-3 items-start cursor-pointer hover:bg-slate-50 transition-colors"
             role="button" tabindex="0" onclick="openReferenceWord(${referenceTab}, ${i})"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openReferenceWord(${referenceTab}, ${i});}">
          <div class="min-w-0 flex-1">
            <div class="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
              <span>${escapeHtml(w.word)}</span>
              ${(w.posTags || []).map(t => posBadgeHtml(t)).join("")}
              <span class="text-[11px] font-medium text-slate-400 tracking-wide">${w.ipa ? "[" + escapeHtml(w.ipa) + "]" : ""}</span>
            </div>
            <div class="text-xs text-slate-500 mt-0.5 break-words">${escapeHtml((w.senses || []).map(s => s.text).join(" / "))}</div>
          </div>
          <span class="text-slate-300 text-sm pt-0.5 shrink-0">›</span>
        </div>`).join("");

      const blocks = referenceQuizItems.length ? "" : (ch.blocks || []).map(refLineHtml).join("");
      const quizHtml = referenceQuizItems.length
        ? `<p class="text-[11px] font-bold text-slate-400">全${referenceQuizItems.length}問 ・ ①か②を選ぶと正解が表示されます</p>
           <div class="space-y-2">${renderReferenceQuiz()}</div>`
        : "";
      box.innerHTML = `
        <div class="bg-slate-900 text-white rounded-2xl p-4">
          <p class="text-[10px] font-bold uppercase tracking-widest text-emerald-300">REFERENCE</p>
          <h3 class="text-lg font-extrabold mt-0.5">${escapeHtml(ch.title || "")}</h3>
          ${ch.subtitle ? `<p class="text-[11px] text-slate-300 mt-0.5">${escapeHtml(ch.subtitle)}</p>` : ""}
        </div>
        ${ch.words && ch.words.length ? `<p class="text-[11px] font-bold text-slate-400">${ch.words.length} 語 ・ タップで詳細</p>${words}` : ""}
        ${quizHtml}
        ${blocks ? `<div class="bg-white border border-slate-200 rounded-xl p-4 space-y-0.5">${blocks}</div>` : ""}
      `;
    }

    function openReference() {
      renderReference();
      navigate("screen-reference");
    }

    // ===== 辞典の絞り込み（Part・番号範囲） =====
    function loadDictionaryFilter() {
      try {
        const rawSaved = localStorage.getItem(dictFilterStorageKey())
          || (currentSubject === "leap" ? localStorage.getItem(DICT_FILTER_KEY) : null);
        const saved = JSON.parse(rawSaved || "null");
        if (saved && typeof saved === "object") {
          const validParts = PARTS.map(p => String(p.id));
          const parts = Array.isArray(saved.parts)
            ? saved.parts.map(String)
            : (saved.part && saved.part !== "all" ? [String(saved.part)] : []);
          const statuses = Array.isArray(saved.statuses)
            ? saved.statuses.map(String)
            : (saved.status && saved.status !== "all" ? [String(saved.status)] : []);
          dictionaryFilter.parts = parts.filter(p => validParts.includes(p));
          dictionaryFilter.statuses = statuses.filter(st => WORD_STATUSES.includes(st) && st !== "all");
          dictionaryFilter.start = saved.start === undefined || saved.start === null ? "" : String(saved.start);
          dictionaryFilter.end = saved.end === undefined || saved.end === null ? "" : String(saved.end);
        }
      } catch (e) { console.warn("dictionary filter load failed", e); }
      syncDictionaryFilterUi();
    }

    function dictFilterStorageKey() {
      return DICT_FILTER_KEY + "_" + currentSubject;
    }

    function saveDictionaryFilter() {
      try { localStorage.setItem(dictFilterStorageKey(), JSON.stringify(dictionaryFilter)); } catch (e) {}
    }

    function syncDictionaryFilterUi() {
      updateDictFilterBadge();
      const dictChip = (active) => "px-2.5 py-1 text-[11px] font-bold rounded-md border transition cursor-pointer " +
        (active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100");
      document.querySelectorAll("[data-dict-part]").forEach(btn => {
        const pid = btn.dataset.dictPart;
        const active = pid === "all" ? dictionaryFilter.parts.length === 0 : dictionaryFilter.parts.includes(pid);
        btn.className = dictChip(active);
      });
      const isKobun = isKobunZone();
      const startEl = document.getElementById("dict-range-start");
      const endEl = document.getElementById("dict-range-end");
      if (startEl) {
        startEl.placeholder = isKobun ? "開始番号" : "開始ID";
        if (document.activeElement !== startEl) startEl.value = dictionaryFilter.start;
      }
      if (endEl) {
        endEl.placeholder = isKobun ? "終了番号" : "終了ID";
        if (document.activeElement !== endEl) endEl.value = dictionaryFilter.end;
      }
      const searchEl = document.getElementById("dictionary-search");
      if (searchEl) {
        searchEl.placeholder = isKobun
          ? "番号・古文・現代語訳で検索（例: 1 / をかし / 趣がある）"
          : "番号・英語・日本語で検索（例: 1 / debate / 討論）";
      }
      document.querySelectorAll("[data-dict-status]").forEach(btn => {
        const st = btn.dataset.dictStatus;
        const active = st === "all" ? dictionaryFilter.statuses.length === 0 : dictionaryFilter.statuses.includes(st);
        btn.className = dictChip(active);
      });
    }

    function setDictionaryPartFilter(part) {
      const value = String(part);
      dictPage = 1;
      const valid = PARTS.map(p => String(p.id));
      if (value === "all") {
        dictionaryFilter.parts = [];
      } else if (!valid.includes(value)) {
        return;
      } else if (dictionaryFilter.parts.includes(value)) {
        dictionaryFilter.parts = dictionaryFilter.parts.filter(p => p !== value);
      } else {
        dictionaryFilter.parts = [...dictionaryFilter.parts, value];
      }
      saveDictionaryFilter();
      syncDictionaryFilterUi();
      applyDictionaryFilters();
    }

    function setDictionaryStatusFilter(status) {
      dictPage = 1;
      if (status === "all" || !WORD_STATUSES.includes(status)) {
        dictionaryFilter.statuses = [];
      } else if (dictionaryFilter.statuses.includes(status)) {
        dictionaryFilter.statuses = dictionaryFilter.statuses.filter(st => st !== status);
      } else {
        dictionaryFilter.statuses = [...dictionaryFilter.statuses, status];
      }
      saveDictionaryFilter();
      syncDictionaryFilterUi();
      applyDictionaryFilters();
    }

    function setDictionaryStatusSelection(statuses) {
      dictPage = 1;
      dictionaryFilter.statuses = (statuses || []).filter(st => WORD_STATUSES.includes(st) && st !== "all");
      saveDictionaryFilter();
      syncDictionaryFilterUi();
      applyDictionaryFilters();
    }

    function handleDictionaryRangeInput() {
      dictPage = 1;
      dictionaryFilter.start = (document.getElementById("dict-range-start").value || "").trim();
      dictionaryFilter.end = (document.getElementById("dict-range-end").value || "").trim();
      saveDictionaryFilter();
      applyDictionaryFilters();
    }

    function resetDictionaryFilters() {
      dictPage = 1;
      dictionaryFilter = { parts: [], start: "", end: "", statuses: [] };
      const searchEl = document.getElementById("dictionary-search");
      if (searchEl) searchEl.value = "";
      saveDictionaryFilter();
      syncDictionaryFilterUi();
      applyDictionaryFilters();
    }

    // 番号（部分一致）・英語・日本語を同じ入力欄でまとめて判定する
    function applyDictionaryFilters() {
      const searchEl = document.getElementById("dictionary-search");
      const rawQuery = ((searchEl && searchEl.value) || "").trim();
      const query = normalizeSearchText(rawQuery);
      const startNum = dictionaryFilter.start === "" ? null : Number(dictionaryFilter.start);
      const endNum = dictionaryFilter.end === "" ? null : Number(dictionaryFilter.end);
      const hasRange = (startNum !== null && !Number.isNaN(startNum)) || (endNum !== null && !Number.isNaN(endNum));
      const countEl = document.getElementById("dictionary-count");
      const emptyEl = document.getElementById("dictionary-empty");
      const isKobun = isKobunZone();

      const matches = [];
      dictionaryEntries.forEach(entry => {
        let hit = true;
        if (dictionaryFilter.parts.length > 0 && !dictionaryFilter.parts.includes(entry.part)) hit = false;
        if (hit && dictionaryFilter.statuses.length > 0 && !dictionaryFilter.statuses.includes(entry.status)) hit = false;
        const targetNum = (isKobun && typeof entry.num === "number") ? entry.num : entry.id;
        if (hit && startNum !== null && !Number.isNaN(startNum) && targetNum < startNum) hit = false;
        if (hit && endNum !== null && !Number.isNaN(endNum) && targetNum > endNum) hit = false;
        if (hit && query) {
          const numberHit = isKobun
            ? (entry.numText.includes(query) || entry.idText.includes(query))
            : entry.idText.includes(query);
          hit = numberHit
            || normalizeSearchText(entry.word).includes(query)
            || entry.searchKana.includes(query)
            || entry.meaningNorm.includes(query);
        }
        if (hit) matches.push(entry);
      });

      if (query && /^\d+$/.test(query)) {
        // 数字検索時、単語番号が完全一致するものを先頭に優先表示する
        matches.sort((a, b) => {
          const aTarget = isKobun ? a.numText : a.idText;
          const bTarget = isKobun ? b.numText : b.idText;
          if (aTarget === query && bTarget !== query) return -1;
          if (bTarget === query && aTarget !== query) return 1;
          return 0;
        });
      }

      const total = dictionaryEntries.length;
      const pageCount = Math.max(1, Math.ceil(matches.length / DICT_PAGE_SIZE));
      if (dictPage > pageCount) dictPage = pageCount;
      if (dictPage < 1) dictPage = 1;
      const from = (dictPage - 1) * DICT_PAGE_SIZE;
      const to = from + DICT_PAGE_SIZE;

      // ページ内の100語だけを表示する
      dictionaryEntries.forEach(entry => entry.el.classList.add("hidden"));
      matches.slice(from, to).forEach(entry => entry.el.classList.remove("hidden"));

      const filtering = query !== "" || dictionaryFilter.parts.length > 0 || hasRange || dictionaryFilter.statuses.length > 0;
      if (countEl) {
        if (total === 0) {
          countEl.textContent = "単語データが読み込まれていません";
        } else if (filtering) {
          countEl.textContent = `該当 ${matches.length} 語 / 全 ${total} 語 ・ ${dictPage}/${pageCount}ページ`;
        } else {
          countEl.textContent = `全 ${total} 語 ・ 100語ずつ ・ ${dictPage}/${pageCount}ページ`;
        }
      }
      renderDictionaryPagination(matches.length, pageCount);
      if (emptyEl) emptyEl.classList.toggle("hidden", matches.length > 0 || total === 0);
    }

    // ===== 辞典のページ送り（100語ずつ） =====
    function dictionaryPageLabel(n) {
      return String(n);
    }

    function handleDictionarySearch() {
      dictPage = 1;
      applyDictionaryFilters();
    }

    function setDictionaryPage(page) {
      dictPage = Number(page) || 1;
      applyDictionaryFilters();
      try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { window.scrollTo(0, 0); }
    }

    function renderDictionaryPagination(matchCount, pageCount) {
      const top = document.getElementById("dict-pagination-top");
      const bottom = document.getElementById("dict-pagination-bottom");
      if (!top && !bottom) return;
      let html = "";
      if (pageCount > 1) {
        const btnBase = "w-7 h-7 rounded-md border text-[11px] font-bold flex items-center justify-center transition cursor-pointer tabular-nums ";
        const active = "bg-slate-900 text-white border-slate-900";
        const idle = "bg-white text-slate-600 border-slate-300 hover:bg-slate-100";
        html += `<button type="button" onclick="setDictionaryPage(${dictPage - 1})" ${dictPage <= 1 ? "disabled" : ""} class="${btnBase} ${dictPage <= 1 ? "bg-slate-100 text-slate-300 border-slate-200" : idle}">◀</button>`;
        // ページ番号は現在ページの前後＋先頭・末尾を表示し、間は ⋯ で省略
        const pages = [];
        const addPage = (n) => { if (n >= 1 && n <= pageCount && !pages.includes(n)) pages.push(n); };
        addPage(1);
        for (let n = dictPage - 2; n <= dictPage + 2; n++) addPage(n);
        addPage(pageCount);
        pages.sort((a, b) => a - b);
        let prev = 0;
        pages.forEach(n => {
          if (n - prev > 1) html += `<span class="px-0.5 text-slate-400 text-[11px] font-bold">⋯</span>`;
          html += `<button type="button" onclick="setDictionaryPage(${n})" class="${btnBase} ${n === dictPage ? active : idle}" title="${n}ページ目">${dictionaryPageLabel(n)}</button>`;
          prev = n;
        });
        html += `<button type="button" onclick="setDictionaryPage(${dictPage + 1})" ${dictPage >= pageCount ? "disabled" : ""} class="${btnBase} ${dictPage >= pageCount ? "bg-slate-100 text-slate-300 border-slate-200" : idle}">▶</button>`;
        html += `<span class="text-[10px] font-semibold text-slate-400 ml-auto">${dictPage} / ${pageCount}ページ（全 ${matchCount} 語）</span>`;
      } else {
        html = `<span class="text-[10px] font-semibold text-slate-400">${matchCount} 語</span>`;
      }
      if (top) top.innerHTML = html;
      if (bottom) bottom.innerHTML = html;
    }

    // ショップ機能
    let currentShopTab = "prefix";

    function switchShopTab(tab) {
      currentShopTab = tab;
      const tabs = {
        prefix: document.getElementById("shop-tab-prefix"),
        suffix: document.getElementById("shop-tab-suffix"),
        frame: document.getElementById("shop-tab-frame"),
        avatar: document.getElementById("shop-tab-avatar")
      };
      const activeClass = "flex-1 min-w-[70px] shrink-0 py-2 px-1 text-[11px] font-bold rounded-lg bg-white shadow-sm text-slate-900 transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap";
      const idleClass = "flex-1 min-w-[70px] shrink-0 py-2 px-1 text-[11px] font-bold rounded-lg text-slate-600 hover:text-slate-900 transition-all flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap";
      Object.keys(tabs).forEach(key => {
        if (!tabs[key]) return;
        tabs[key].className = key === tab ? activeClass : idleClass;
      });
      renderShop();
    }

    function renderShop() {
      const container = document.getElementById("shop-grid-container");
      if (!container) return;
      container.innerHTML = "";

      const newTitles = syncEarnedTitles();
      if (newTitles.length) saveUserData();

      // タブを開いたときだけでなく、ショップを表示した時点で全タブの分数を最新化する
      // （HTML の初期値のままタブをタップするまで古い分子が残る不具合の修正）
      const newAvatars = syncOwnedAvatars();
      if (newAvatars.length) saveUserData();
      const ownedCounts = {
        "prefix-owned-count": `${userData.purchasedPrefixes.length}/${PREFIX_TITLES.length}`,
        "suffix-owned-count": `${userData.purchasedSuffixes.length}/${SUFFIX_TITLES.length}`,
        "frame-owned-count": `${userData.ownedFrames.length}/${FRAME_ITEMS.length}`,
        "avatar-owned-count": `${userData.ownedAvatars.length}/${AVATAR_ITEMS.length}`
      };
      Object.keys(ownedCounts).forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = ownedCounts[id];
      });

      // アバターの絵柄一覧（レベル・実績で解放）
      if (currentShopTab === "avatar") {
        AVATAR_ITEMS.forEach(item => {
          const unlocked = isAvatarUnlocked(item);
          const isEquipped = userData.equippedAvatar === item.id;
          const emoji = item.emoji || getFrameItem(userData.equippedFrame).emoji || "🦉";

          const box = document.createElement("div");
          box.className = `p-3 rounded-2xl border transition-all text-center flex flex-col justify-between items-center min-h-[140px] relative ${
            isEquipped
              ? "bg-emerald-50 border-emerald-500 shadow-sm ring-1 ring-emerald-500/30"
              : unlocked
                ? "bg-white border-slate-200 hover:border-slate-400 cursor-pointer shadow-sm"
                : "bg-slate-50 border-slate-200 opacity-70"
          }`;

          let statusBadge = "";
          if (isEquipped) {
            statusBadge = `<span class="text-[10px] font-extrabold bg-emerald-500 text-white px-2 py-0.5 rounded-full">装着中</span>`;
          } else if (!unlocked) {
            statusBadge = `<span class="text-[10px] font-bold bg-slate-200 text-slate-500 px-2 py-1 rounded-lg w-full block">🔒 ${item.unlockLabel}</span>`;
          } else {
            statusBadge = `<button type="button" onclick="equipAvatar('${item.id}', '${item.name}')" class="text-[10px] font-bold bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1 rounded-lg w-full transition cursor-pointer">装着する</button>`;
          }

          box.innerHTML = `
            <div class="w-full flex justify-between items-center text-[10px] text-slate-400 font-semibold mb-1">
              <span>アバター絵柄</span>
              ${unlocked ? '<span class="text-emerald-600">✓ 解放済</span>' : ''}
            </div>
            <div class="my-auto flex justify-center">
              <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl bg-white ring-2 ring-slate-200 ${unlocked ? "" : "grayscale"}">${unlocked ? emoji : "🔒"}</div>
            </div>
            <div class="font-extrabold text-xs text-slate-900 mt-2 ${isEquipped ? 'text-emerald-700' : ''}">${item.name}</div>
            <div class="w-full mt-2">${statusBadge}</div>
          `;
          container.appendChild(box);
        });
        return;
      }

      // アバターフレーム一覧（価格昇順で正しくソートして表示）
      if (currentShopTab === "frame") {
        const sortedFrames = [...FRAME_ITEMS].sort((a, b) => a.price - b.price);
        sortedFrames.forEach(frame => {
          const isOwned = userData.ownedFrames.includes(frame.id);
          const isEquipped = userData.equippedFrame === frame.id;

          const box = document.createElement("div");
          box.className = `p-3 rounded-2xl border transition-all text-center flex flex-col justify-between items-center min-h-[140px] relative ${
            isEquipped
              ? "bg-emerald-50 border-emerald-500 shadow-sm ring-1 ring-emerald-500/30"
              : isOwned
                ? "bg-white border-slate-200 hover:border-slate-400 cursor-pointer shadow-sm"
                : "bg-white border-slate-200 hover:border-amber-400 cursor-pointer shadow-sm"
          }`;

          let statusBadge = "";
          if (isEquipped) {
            statusBadge = `<span class="text-[10px] font-extrabold bg-emerald-500 text-white px-2 py-0.5 rounded-full">装着中</span>`;
          } else if (isOwned) {
            statusBadge = `<button type="button" onclick="equipFrame('${frame.id}', '${frame.name}')" class="text-[10px] font-bold bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1 rounded-lg w-full transition cursor-pointer">装着する</button>`;
          } else {
            statusBadge = `<button type="button" onclick="buyFrame('${frame.id}', ${frame.price}, '${frame.name}')" class="text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded-lg w-full transition flex items-center justify-center gap-1 shadow-sm cursor-pointer"><span>🪙 ${frame.price}</span><span>購入</span></button>`;
          }

          box.innerHTML = `
            <div class="w-full flex justify-between items-center text-[10px] text-slate-400 font-semibold mb-1">
              <span>アバター</span>
              ${isOwned ? '<span class="text-emerald-600">✓ 所持</span>' : ''}
            </div>
            <div class="my-auto flex justify-center">
              <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${frame.box}">${frame.emoji}</div>
            </div>
            <div class="font-extrabold text-xs text-slate-900 mt-2 ${isEquipped ? 'text-emerald-700' : ''}">${frame.name}</div>
            <div class="w-full mt-2">${statusBadge}</div>
          `;
          container.appendChild(box);
        });
        return;
      }

      const isPrefix = currentShopTab === "prefix";
      // 前称号・後称号ともに price の昇順（安い順）で正確にソート！
      const rawList = isPrefix ? PREFIX_TITLES : SUFFIX_TITLES;
      const sortedList = [...rawList].sort((a, b) => a.price - b.price);
      const ownedList = isPrefix ? userData.purchasedPrefixes : userData.purchasedSuffixes;
      const currentEquipped = isPrefix ? userData.prefix : userData.suffix;

      sortedList.forEach(item => {
        const isOwned = ownedList.includes(item.id);
        const isEquipped = currentEquipped === item.name;
        const earnAch = item.unlockAchievement ? getAchievementById(item.unlockAchievement) : null;
        const isLocked = !!item.unlockAchievement && !isAchievementDone(item.unlockAchievement);

        const box = document.createElement("div");
        box.className = `p-3 rounded-2xl border transition-all text-center flex flex-col justify-between items-center min-h-[110px] relative ${
          isEquipped
            ? "bg-emerald-50 border-emerald-500 shadow-sm ring-1 ring-emerald-500/30"
            : isLocked
              ? "bg-slate-50 border-slate-200 opacity-70"
              : isOwned
                ? "bg-white border-slate-200 hover:border-slate-400 cursor-pointer shadow-sm"
                : "bg-white border-slate-200 hover:border-amber-400 cursor-pointer shadow-sm"
        }`;

        let statusBadge = "";
        if (isEquipped) {
          statusBadge = `<span class="text-[10px] font-extrabold bg-emerald-500 text-white px-2 py-0.5 rounded-full">装着中</span>`;
        } else if (isLocked) {
          statusBadge = `<span class="text-[10px] font-bold bg-slate-200 text-slate-500 px-2 py-1 rounded-lg w-full block">🔒 実績「${earnAch ? earnAch.name : "条件"}」で解放</span>`;
        } else if (isOwned) {
          statusBadge = `<button type="button" onclick="equipPart('${item.id}', '${item.name}', '${currentShopTab}')" class="text-[10px] font-bold bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1 rounded-lg w-full transition cursor-pointer">装着する</button>`;
        } else {
          statusBadge = `<button type="button" onclick="buyPart('${item.id}', ${item.price}, '${item.name}', '${currentShopTab}')" class="text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded-lg w-full transition flex items-center justify-center gap-1 shadow-sm cursor-pointer"><span>🪙 ${item.price}</span><span>購入</span></button>`;
        }

        box.innerHTML = `
          <div class="w-full flex justify-between items-center text-[10px] text-slate-400 font-semibold mb-1">
            <span>${item.unlockAchievement ? "実績称号" : (isPrefix ? "前称号" : "後称号")}</span>
            ${isOwned ? '<span class="text-emerald-600">✓ 所持</span>' : ''}
          </div>
          <div class="font-extrabold text-sm text-slate-900 tracking-tight my-auto ${isEquipped ? 'text-emerald-700' : ''}">
            ${item.name}
          </div>
          <div class="w-full mt-2">
            ${statusBadge}
          </div>
        `;

        container.appendChild(box);
      });
    }

    async function buyPart(id, price, name, type) {
      if (userData.coins < price) {
        await showAlert({
          title: "コインが足りません",
          message: `必要: 🪙 ${price} Coin / 所持: 🪙 ${userData.coins} Coin\nクイズに正解してコインを貯めましょう！`,
          icon: "🪙"
        });
        return;
      }
      const ok = await showConfirm({
        title: `「${name}」を購入しますか？`,
        message: `🪙 ${price} Coin を消費します。\n購入後はそのまま装着されます。\n残り: 🪙 ${userData.coins - price} Coin`,
        okText: "購入する",
        cancelText: "やめる",
        icon: "🛍️",
        danger: false
      });
      if (!ok) return;
      userData.coins -= price;
      if (type === "prefix") {
        userData.purchasedPrefixes.push(id);
        userData.prefix = name;
        userData.purchasedPrefixes.sort((a, b) => a.price - b.price);
      } else {
        userData.purchasedSuffixes.push(id);
        userData.suffix = name;
        userData.purchasedSuffixes.sort((a, b) => a.price - b.price);
      }
      saveUserData();
      checkAchievements();
      showToast(`「${name}」を購入し、装着しました！`);
      renderShop();
      cloudPushSoon("shop");
    }

    async function buyFrame(id, price, name) {
      if (userData.coins < price) {
        await showAlert({
          title: "コインが足りません",
          message: `必要: 🪙 ${price} Coin / 所持: 🪙 ${userData.coins} Coin\nクイズに正解してコインを貯めましょう！`,
          icon: "🪙"
        });
        return;
      }
      const ok = await showConfirm({
        title: `フレーム「${name}」を購入しますか？`,
        message: `🪙 ${price} Coin を消費します。\n購入後はそのまま装着されます。\n残り: 🪙 ${userData.coins - price} Coin`,
        okText: "購入する",
        cancelText: "やめる",
        icon: "🖼️",
        danger: false
      });
      if (!ok) return;
      userData.coins -= price;
      if (!userData.ownedFrames.includes(id)) userData.ownedFrames.push(id);
      userData.equippedFrame = id;
      saveUserData();
      showToast(`フレーム「${name}」を購入し、装着しました！`);
      renderShop();
      cloudPushSoon("shop");
    }

    function equipPart(id, name, type) {
      if (type === "prefix") {
        userData.prefix = name;
      } else {
        userData.suffix = name;
      }
      saveUserData();
      showToast(`「${name}」を装着しました`);
      renderShop();
      cloudPushSoon("equip");
    }

    function equipFrame(id, name) {
      if (!userData.ownedFrames.includes(id)) return;
      userData.equippedFrame = id;
      saveUserData();
      showToast(`フレーム「${name}」を装着しました`);
      renderShop();
      cloudPushSoon("equip");
    }

    function equipAvatar(id, name) {
      if (!userData.ownedAvatars.includes(id)) return;
      userData.equippedAvatar = id;
      saveUserData();
      showToast(`アバター「${name}」に変更しました`);
      renderShop();
      cloudPushSoon("equip");
    }

    // ショップ用: コイン額面の昇順に整える（取得用）
    function getPriceSortedFrameList() {
      return [...FRAME_ITEMS].sort((a, b) => a.price - b.price);
    }
    function getPriceSortedPrefixList() {
      return [...PREFIX_TITLES].sort((a, b) => a.price - b.price);
    }
    function getPriceSortedSuffixList() {
      return [...SUFFIX_TITLES].sort((a, b) => a.price - b.price);
    }
