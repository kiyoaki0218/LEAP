import io, re, sys

P = "index.html"
s = io.open(P, encoding="utf-8", newline="").read().replace("\r\n", "\n").replace("\r", "\n")


def rep(old, new):
    global s
    if old not in s:
        sys.exit("ANCHOR NOT FOUND:\n" + old[:160])
    s = s.replace(old, new, 1)


# 1) サイト内の確認ダイアログ（HTML）
rep('  <!-- 実績・トロフィーモーダル -->',
'''  <!-- サイト内の確認ダイアログ -->
  <div id="app-confirm" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 hidden" role="dialog" aria-modal="true" aria-labelledby="app-confirm-title">
    <div class="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
      <div class="flex items-start gap-3">
        <span id="app-confirm-icon" class="text-2xl shrink-0">⚠️</span>
        <div class="min-w-0">
          <h3 id="app-confirm-title" class="font-extrabold text-base text-slate-900">確認</h3>
          <p id="app-confirm-message" class="text-xs text-slate-500 mt-1 leading-relaxed whitespace-pre-line"></p>
        </div>
      </div>
      <div class="flex gap-2 pt-1">
        <button type="button" id="app-confirm-cancel" onclick="closeAppConfirm(false)" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer">キャンセル</button>
        <button type="button" id="app-confirm-ok" onclick="closeAppConfirm(true)" class="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer">OK</button>
      </div>
    </div>
  </div>

  <!-- 実績・トロフィーモーダル -->''')

# 2) 確認ダイアログのJS
rep('    // ===== ブラウザ／Androidの「戻る」操作を画面遷移に対応 =====',
'''    // ===== サイト内の確認ダイアログ（ブラウザconfirmの代替） =====
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
      if (cancelEl) cancelEl.textContent = opts.cancelText || "キャンセル";
      modal.classList.remove("hidden");
      return new Promise((resolve) => { appConfirmResolver = resolve; });
    }

    function closeAppConfirm(result) {
      const modal = document.getElementById("app-confirm");
      if (modal) modal.classList.add("hidden");
      const resolve = appConfirmResolver;
      appConfirmResolver = null;
      if (resolve) resolve(!!result);
    }

    // ===== ブラウザ／Androidの「戻る」操作を画面遷移に対応 =====''')

# 3) 戻る操作: 確認ダイアログ中はキャンセル、クイズ中は中断確認
rep('''    window.addEventListener("popstate", (event) => {
      const openModal = ["achievements-modal", "modal-weak-words"]''',
'''    window.addEventListener("popstate", (event) => {
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
          message: `ここまで ${quizState.currentIndex} 問に回答しています。中断すると結果画面へ移動します。`,
          okText: "中断する",
          cancelText: "続ける",
          icon: "🏳️"
        }).then((ok) => {
          if (ok) { checkAchievements(); finishQuiz(true); }
          else { try { history.pushState({ screen: "screen-quiz" }, ""); } catch (e) {} }
        });
        return;
      }
      const openModal = ["achievements-modal", "modal-weak-words"]''')

# 4) 中断ボタン
rep('    function abortQuiz() {', '    async function abortQuiz() {')
s2, n = re.subn(
    r"\n      const confirmMsg = quizState\.earnedCoins > 0[\s\S]*?\n\n      if \(confirm\(confirmMsg\)\) \{",
    '''
      const ok = await showConfirm({
        title: "クイズを中断しますか？",
        message: quizState.earnedCoins > 0
          ? `ここまでに獲得した 🪙 ${quizState.earnedCoins} Coin は保存されます。`
          : "ここまでの結果を確定して終了します。",
        okText: "中断する",
        cancelText: "続ける",
        icon: "🏳️"
      });
      if (ok) {''',
    s, count=1)
if n != 1:
    sys.exit("abortQuiz regex failed")
s = s2

# 5) デイリーチャレンジ
rep('    function startDailyChallenge() {', '    async function startDailyChallenge() {')
s2, n = re.subn(
    r'        if \(!confirm\("今日はすでにデイリーチャレンジをクリアしました！[\s\S]*?\) return;',
    '''        const again = await showConfirm({
          title: "本日のデイリーはクリア済み",
          message: "もう一度プレイしますか？（コイン2倍ボーナスはありません）",
          okText: "もう一度プレイ",
          cancelText: "やめておく",
          icon: "🌅",
          danger: false
        });
        if (!again) return;''',
    s, count=1)
if n != 1:
    sys.exit("daily regex failed")
s = s2

# 6) 苦手単語の全消去
rep('    function clearWeakWords() {', '    async function clearWeakWords() {')
s2, n = re.subn(
    r'      if \(confirm\(`\$\{label\}をすべて消去しますか？[\s\S]*?\)\) \{',
    '''      const ok = await showConfirm({
        title: `${label}をすべて消去しますか？`,
        message: "もう一方のゾーンの記録は残ります。この操作は取り消せません。",
        okText: "消去する",
        cancelText: "キャンセル",
        icon: "🗑️"
      });
      if (ok) {''',
    s, count=1)
if n != 1:
    sys.exit("clearWeakWords regex failed")
s = s2

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("patched ok")
