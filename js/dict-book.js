/* ============================================================
   単語辞典：本誌ビュー（LEAP 本誌の見開き風）
   ============================================================ */
(function (root) {
  const MIN_SWIPE = 45;
  const PER_PAGE = 4;
  const PER_SPREAD = PER_PAGE * 2;
  let list = [];
  let spreadIndex = 0;
  let busy = false;
  let touchX = null;

  function allWords() {
    const words = (typeof ALL_WORDS !== "undefined" && Array.isArray(ALL_WORDS)) ? ALL_WORDS : [];
    return words.filter((w) => w && w.subject !== "kobun").sort((a, b) => a.id - b.id);
  }

  function detailOf(w) {
    if (typeof LEAP_WORD_DETAILS === "undefined" || !LEAP_WORD_DETAILS || !w) return null;
    return LEAP_WORD_DETAILS[String(w.id)] || LEAP_WORD_DETAILS[w.id] || null;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function partOf(w) {
    const parts = (typeof PARTS !== "undefined" && Array.isArray(PARTS)) ? PARTS : [];
    return parts.find((p) => w.id >= p.start && w.id <= p.end) || parts.find((p) => p.id === w.part) || null;
  }

  function partName(p) {
    if (!p) return "";
    return p.desc ? (p.name + " ・ " + p.desc) : p.name;
  }

  const POS_JA = { v: "動詞", vi: "自動詞", vt: "他動詞", n: "名詞", adj: "形容詞", adv: "副詞", prep: "前置詞", conj: "接続詞" };
  function posJa(w, d) {
    const tags = (d && Array.isArray(d.posTags)) ? d.posTags : [];
    const ja = tags.map((t) => POS_JA[t]).filter(Boolean);
    if (ja.length) return ja.join("・");
    const senses = (d && Array.isArray(d.senses)) ? d.senses : [];
    return senses.map((s) => POS_JA[s.tag] || s.tag).filter(Boolean).join("・");
  }

  function markSenseNumbers(text) {
    return esc(text).replace(/([①-⑳])/g, '<span class="db-sense-num">$1</span>');
  }

  function renderEntry(w, d) {
    const ipa = (d && d.ipa) || w.ipa || "";
    const senses = (d && Array.isArray(d.senses) && d.senses.length)
      ? d.senses
      : [{ tag: "", text: w.meaning || "" }];
    const notes = (d && Array.isArray(d.notes)) ? d.notes : [];
    const examples = (d && Array.isArray(d.examples) && d.examples.length) ? d.examples : [];
    const num = String(w.num != null ? w.num : w.id).padStart(3, "0");

    const senseHtml = senses.map((s) => {
      const tag = s.tag ? ('<span class="db-postag">' + esc(s.tag) + '</span>') : "";
      return '<p class="db-sense">' + tag + markSenseNumbers(s.text || "") + '</p>';
    }).join("");

    const noteHtml = notes.map((n) => '<p class="db-note">' + esc(n) + '</p>').join("");

    const exHtml = examples.length
      ? examples.map((ex, i) => {
          const en = esc(ex.en || "").replace(/【(.+?)】/g, '<b class="db-hl">$1</b>');
          const ja = ex.ja ? ('<p class="db-ja">' + esc(ex.ja) + '</p>') : "";
          const mark = String.fromCharCode(0x2460 + i);
          return '<li><span class="db-exnum">' + mark + '</span><span class="db-en">' + en + '</span>' + ja + '</li>';
        }).join("")
      : '<li class="db-empty">例文データはまだありません。</li>';

    return (
      '<article class="db-entry">' +
        '<div class="db-entry-cols">' +
          '<div class="db-col-left">' +
            '<span class="db-numbox">' + num + '</span>' +
            '<h3 class="db-word">' + esc(w.word) + '</h3>' +
            (ipa ? ('<p class="db-ipa">[' + esc(ipa) + ']</p>') : "") +
            '<p class="db-pos">' + esc(posJa(w, d)) + '</p>' +
          '</div>' +
          '<div class="db-col-mid">' +
            '<div class="db-senses">' + senseHtml + '</div>' +
            (noteHtml ? ('<div class="db-notes">' + noteHtml + '</div>') : "") +
          '</div>' +
          '<div class="db-col-right">' +
            '<ol class="db-examples">' + exHtml + '</ol>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function renderPage(words, side, pageNum) {
    const isRight = side === "right";
    let lastPart = null;
    let html = '<div class="db-page-inner db-page-inner--' + side + '">';
    if (isRight) html += '<p class="db-runhead">Active Vocabulary（基幹語）</p>';
    words.forEach((w) => {
      const p = partOf(w);
      if (p && (!lastPart || p.id !== lastPart.id)) {
        lastPart = p;
        html += '<div class="db-section"><span class="db-section-tab">' + esc(partName(p)) + '</span></div>';
      }
      html += renderEntry(w, detailOf(w));
    });
    if (!words.length) {
      html += '<p class="db-empty-page">このページには単語がありません。</p>';
    }
    html += '<p class="db-pagenum db-pagenum--' + side + '">' + pageNum + '</p>';
    if (isRight && lastPart) {
      html += '<div class="db-parttab">Part ' + lastPart.id + '</div>';
    }
    html += '</div>';
    return html;
  }

  function totalSpreads() {
    return Math.max(1, Math.ceil(list.length / PER_SPREAD));
  }

  function ensureOverlay() {
    let el = document.getElementById("dict-book");
    if (el) return el;
    el = document.createElement("div");
    el.id = "dict-book";
    el.className = "dict-book";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "本誌ビュー");
    el.innerHTML =
      '<div class="dict-book-shell">' +
        '<div class="dict-book-bar">' +
          '<div class="min-w-0">' +
            '<p class="dict-book-bar-title">LEAP 本誌ビュー</p>' +
            '<p id="dict-book-sub" class="dict-book-bar-sub"></p>' +
          '</div>' +
          '<button type="button" class="dict-book-close" onclick="closeDictBook()" aria-label="閉じる">✕</button>' +
        '</div>' +
        '<div id="dict-book-spread" class="dict-book-spread">' +
          '<div id="dict-book-left" class="dict-book-page dict-book-page--left"></div>' +
          '<div id="dict-book-right" class="dict-book-page dict-book-page--right"></div>' +
        '</div>' +
        '<div class="dict-book-nav">' +
          '<button type="button" id="dict-book-prev" class="dict-book-btn" onclick="dictBookStep(-1)">← 前の見開き</button>' +
          '<span id="dict-book-counter" class="dict-book-counter"></span>' +
          '<button type="button" id="dict-book-next" class="dict-book-btn" onclick="dictBookStep(1)">次の見開き →</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    const spread = el.querySelector("#dict-book-spread");
    spread.addEventListener("touchstart", (ev) => {
      touchX = ev.touches && ev.touches[0] ? ev.touches[0].clientX : null;
    }, { passive: true });
    spread.addEventListener("touchend", (ev) => {
      if (touchX == null) return;
      const t = ev.changedTouches && ev.changedTouches[0];
      const dx = t ? t.clientX - touchX : 0;
      touchX = null;
      if (Math.abs(dx) < MIN_SWIPE) return;
      root.dictBookStep(dx < 0 ? 1 : -1);
    }, { passive: true });
    return el;
  }

  function render() {
    const ts = totalSpreads();
    if (spreadIndex < 0) spreadIndex = 0;
    if (spreadIndex > ts - 1) spreadIndex = ts - 1;
    const start = spreadIndex * PER_SPREAD;
    const leftWords = list.slice(start, start + PER_PAGE);
    const rightWords = list.slice(start + PER_PAGE, start + PER_SPREAD);
    const left = document.getElementById("dict-book-left");
    const right = document.getElementById("dict-book-right");
    if (left) left.innerHTML = renderPage(leftWords, "left", spreadIndex * 2 + 1);
    if (right) right.innerHTML = renderPage(rightWords, "right", spreadIndex * 2 + 2);
    const first = list[start];
    const sub = document.getElementById("dict-book-sub");
    if (sub && first) sub.textContent = "No." + String(first.num != null ? first.num : first.id).padStart(3, "0") + " ・ " + first.word + " 〜";
    const counter = document.getElementById("dict-book-counter");
    if (counter) counter.textContent = (spreadIndex + 1) + " / " + ts + " 見開き";
    const prev = document.getElementById("dict-book-prev");
    const next = document.getElementById("dict-book-next");
    if (prev) prev.disabled = spreadIndex <= 0;
    if (next) next.disabled = spreadIndex >= ts - 1;
    const spread = document.getElementById("dict-book-spread");
    if (spread) {
      const lp = spread.querySelector("#dict-book-left");
      if (lp) lp.scrollTop = 0;
      const rp = spread.querySelector("#dict-book-right");
      if (rp) rp.scrollTop = 0;
    }
  }

  function flip(dir) {
    const spread = document.getElementById("dict-book-spread");
    if (!spread || busy) return;
    busy = true;
    spread.classList.add(dir > 0 ? "flip-next" : "flip-prev");
    window.setTimeout(() => {
      render();
      window.setTimeout(() => {
        spread.classList.remove("flip-next", "flip-prev");
        busy = false;
      }, 220);
    }, 120);
  }

  root.dictBookStep = function (dir) {
    const ts = totalSpreads();
    const nextIndex = spreadIndex + (dir > 0 ? 1 : -1);
    if (nextIndex < 0 || nextIndex >= ts || busy) return;
    spreadIndex = nextIndex;
    flip(dir);
  };

  root.openDictBook = function (wordId) {
    list = allWords();
    if (!list.length) return;
    const id = (wordId != null) ? wordId : ((typeof currentDetailWord !== "undefined" && currentDetailWord) ? currentDetailWord.id : null);
    const found = list.findIndex((w) => w.id === id);
    const wordIndex = found >= 0 ? found : 0;
    spreadIndex = Math.floor(wordIndex / PER_SPREAD);
    const el = ensureOverlay();
    el.classList.add("is-open");
    document.body.style.overflow = "hidden";
    render();
    document.addEventListener("keydown", onKey);
  };

  root.openDictBookFromDetail = function () {
    root.openDictBook((typeof currentDetailWord !== "undefined" && currentDetailWord) ? currentDetailWord.id : null);
  };

  root.closeDictBook = function () {
    const el = document.getElementById("dict-book");
    if (el) el.classList.remove("is-open");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKey);
  };

  function onKey(ev) {
    if (ev.key === "Escape") { root.closeDictBook(); return; }
    if (ev.key === "ArrowRight") { ev.preventDefault(); root.dictBookStep(1); }
    if (ev.key === "ArrowLeft") { ev.preventDefault(); root.dictBookStep(-1); }
  }
})(typeof window !== "undefined" ? window : globalThis);
