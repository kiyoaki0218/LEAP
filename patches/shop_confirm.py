import io, sys

P = "index.html"
s = io.open(P, encoding="utf-8", newline="").read().replace("\r\n", "\n").replace("\r", "\n")


def rep(old, new):
    global s
    if old not in s:
        sys.exit("ANCHOR NOT FOUND:\n" + old[:180])
    s = s.replace(old, new, 1)


# 1) ダイアログ: キャンセル非表示（アラート用）に対応
rep('      if (cancelEl) cancelEl.textContent = opts.cancelText || "キャンセル";',
'''      if (cancelEl) {
        cancelEl.textContent = opts.cancelText || "キャンセル";
        cancelEl.classList.toggle("hidden", !!opts.hideCancel);
      }''')

# 2) アラート用ヘルパー
rep('    function closeAppConfirm(result) {',
'''    function showAlert(options) {
      return showConfirm(Object.assign({ danger: false, okText: "OK", hideCancel: true }, options || {}));
    }

    function closeAppConfirm(result) {''')

# 3) 称号の購入
rep('''    function buyPart(id, price, name, type) {
      if (userData.coins < price) {
        alert(`コインが足りません！（必要: 🪙 ${price} Coin / 現在所持: 🪙 ${userData.coins} Coin）\\nクイズに正解してコインを貯めましょう！`);
        return;
      }
      userData.coins -= price;''',
'''    async function buyPart(id, price, name, type) {
      if (userData.coins < price) {
        await showAlert({
          title: "コインが足りません",
          message: `必要: 🪙 ${price} Coin / 所持: 🪙 ${userData.coins} Coin\\nクイズに正解してコインを貯めましょう！`,
          icon: "🪙"
        });
        return;
      }
      const ok = await showConfirm({
        title: `「${name}」を購入しますか？`,
        message: `🪙 ${price} Coin を消費します。\\n購入後はそのまま装着されます。\\n残り: 🪙 ${userData.coins - price} Coin`,
        okText: "購入する",
        cancelText: "やめる",
        icon: "🛍️",
        danger: false
      });
      if (!ok) return;
      userData.coins -= price;''')

# 4) フレーム購入（重複していた1つ目）
rep('''    function buyFrame(id, price, name) {
      if (userData.coins < price) {
        alert(`コインが足りません！（必要: 🪙 ${price} Coin / 現在所持: 🪙 ${userData.coins} Coin）\\nクイズに正解してコインを貯めましょう！`);
        return;
      }
      userData.coins -= price;
      if (!userData.ownedFrames.includes(id)) userData.ownedFrames.push(id);
      userData.ownedFrames.sort((a, b) => a.price - b.price);
      userData.equippedFrame = id;''',
'''    async function buyFrame(id, price, name) {
      if (userData.coins < price) {
        await showAlert({
          title: "コインが足りません",
          message: `必要: 🪙 ${price} Coin / 所持: 🪙 ${userData.coins} Coin\\nクイズに正解してコインを貯めましょう！`,
          icon: "🪙"
        });
        return;
      }
      const ok = await showConfirm({
        title: `フレーム「${name}」を購入しますか？`,
        message: `🪙 ${price} Coin を消費します。\\n購入後はそのまま装着されます。\\n残り: 🪙 ${userData.coins - price} Coin`,
        okText: "購入する",
        cancelText: "やめる",
        icon: "🖼️",
        danger: false
      });
      if (!ok) return;
      userData.coins -= price;
      if (!userData.ownedFrames.includes(id)) userData.ownedFrames.push(id);
      userData.equippedFrame = id;''')

# 5) 重複していた buyFrame 定義を削除
rep('''    function buyFrame(id, price, name) {
      if (userData.coins < price) {
        alert(`コインが足りません！（必要: 🪙 ${price} Coin / 現在所持: 🪙 ${userData.coins} Coin）\\nクイズに正解してコインを貯めましょう！`);
        return;
      }
      userData.coins -= price;
      if (!userData.ownedFrames.includes(id)) userData.ownedFrames.push(id);
      userData.equippedFrame = id;
      saveUserData();
      showToast(`フレーム「${name}」を購入し、装着しました！`);
      renderShop();
    }

''', '')

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("patched ok")
