import io, sys

P = "index.html"
s = io.open(P, encoding="utf-8", newline="").read()
s = s.replace("\r\n", "\n").replace("\r", "\n")


def rep(old, new):
    global s
    if old not in s:
        sys.exit("ANCHOR NOT FOUND:\n" + old[:180])
    s = s.replace(old, new, 1)


# 1) 音声読み上げ: ゾーンに応じて日本語/英語
rep('''        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(word);
        utter.lang = "en-US";
        utter.rate = 0.9;
        utter.pitch = 1.0;
        window.speechSynthesis.speak(utter);''',
'''        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(word);
        const isKobun = currentSubject === "kobun";
        utter.lang = isKobun ? "ja-JP" : "en-US";
        utter.rate = isKobun ? 1.0 : 0.9;
        utter.pitch = 1.0;
        if (isKobun) {
          try {
            const voices = window.speechSynthesis.getVoices() || [];
            const jaVoice = voices.find(v => /^ja/i.test(v.lang)) || voices.find(v => /japan/i.test(v.name));
            if (jaVoice) utter.voice = jaVoice;
          } catch (e) {}
        }
        window.speechSynthesis.speak(utter);''')

# 2) 辞典のPartタブをゾーンに合わせて生成
rep('''        <div class="flex bg-slate-200/70 p-1 rounded-lg">
          <button type="button" id="dict-filter-all" data-dict-part="all" onclick="setDictionaryPartFilter('all')" class="flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer">全て</button>
          <button type="button" id="dict-filter-part1" data-dict-part="1" onclick="setDictionaryPartFilter('1')" class="flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer">Part 1</button>
          <button type="button" id="dict-filter-part2" data-dict-part="2" onclick="setDictionaryPartFilter('2')" class="flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer">Part 2</button>
        </div>''',
'''        <div id="dict-part-filters" class="flex flex-wrap gap-1.5"></div>''')

rep('''    function openDictionary() {''',
'''    // 辞典のPart絞り込みは、いまのゾーンのPart定義から生成する
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

    function openDictionary() {''')

rep('''      syncDictionaryFilterUi();
      applyDictionaryFilters();
    }

    // ===== 辞典の絞り込み（Part・番号範囲） =====''',
'''      renderDictionaryPartFilters();
      applyDictionaryFilters();
    }

    // ===== 辞典の絞り込み（Part・番号範囲） =====''')

# 3) 絞り込み条件をゾーンごとに保存
rep('''    function saveDictionaryFilter() {
      try { localStorage.setItem(DICT_FILTER_KEY, JSON.stringify(dictionaryFilter)); } catch (e) {}
    }''',
'''    function dictFilterStorageKey() {
      return DICT_FILTER_KEY + "_" + currentSubject;
    }

    function saveDictionaryFilter() {
      try { localStorage.setItem(dictFilterStorageKey(), JSON.stringify(dictionaryFilter)); } catch (e) {}
    }''')

rep('''        const saved = JSON.parse(localStorage.getItem(DICT_FILTER_KEY) || "null");''',
'''        const rawSaved = localStorage.getItem(dictFilterStorageKey())
          || (currentSubject === "leap" ? localStorage.getItem(DICT_FILTER_KEY) : null);
        const saved = JSON.parse(rawSaved || "null");''')

# ゾーン切替時にそのゾーンの絞り込みを読み直す
rep('''      syncZoneButtons();
      renderPartSelectList();
      syncDataRangeUi();
      updateUserUI();''',
'''      syncZoneButtons();
      loadDictionaryFilter();
      renderPartSelectList();
      syncDataRangeUi();
      updateUserUI();''')

# 4) 苦手単語帳をゾーン単位に
rep('''      const items = Object.values(userData.weakWords || {});
      listContainer.innerHTML = "";

      if (items.length === 0) {
        listContainer.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs">現在記録されている苦手単語はありません！</div>`;''',
'''      const items = getSubjectWeakWords();
      listContainer.innerHTML = "";

      if (items.length === 0) {
        listContainer.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs">${currentSubject === "kobun" ? "裏世界（古文単語）で記録された苦手単語はまだありません！" : "現在記録されている苦手単語はありません！"}</div>`;''')

rep('''    function clearWeakWords() {
      if (confirm("苦手単語データをすべて消去しますか？")) {
        userData.weakWords = {};
        saveUserData();
        openWeakWordsModal();
        showToast("苦手単語データをリセットしました");
      }
    }''',
'''    function clearWeakWords() {
      const label = currentSubject === "kobun" ? "裏世界（古文単語）の苦手単語" : "苦手単語データ";
      if (confirm(`${label}をすべて消去しますか？\\n※もう一方のゾーンの記録は残ります。`)) {
        const ids = new Set(ALL_WORDS.map(w => w.id));
        Object.keys(userData.weakWords || {}).forEach(id => {
          if (ids.has(Number(id))) delete userData.weakWords[id];
        });
        saveUserData();
        openWeakWordsModal();
        showToast(currentSubject === "kobun" ? "裏世界の苦手単語をリセットしました" : "苦手単語データをリセットしました");
      }
    }''')

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("patched ok")
