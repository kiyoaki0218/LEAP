// 例文の和訳強調の現状を調査する（フォールバック＝和訳全体が緑になる例を洗い出す）
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const ctx = { console };
vm.createContext(ctx);
for (const f of ["words_data.js", "examples_data.js"]) {
  const src = fs.readFileSync(path.join(ROOT, f), "utf8");
  vm.runInContext(src, ctx, { filename: f });
}
const { LEAP_WORDS_DATA, LEAP_WORD_DETAILS } = vm.runInContext(
  "({ LEAP_WORDS_DATA, LEAP_WORD_DETAILS })", ctx);

const overrides = JSON.parse(fs.readFileSync(path.join(__dirname, "ja_highlight_overrides.json"), "utf8"));

// index.html の highlightJapanese と同じ候補生成
function candidatesOf(w) {
  const candidates = new Set();
  const add = (raw) => {
    let s = String(raw || "").replace(/[①-⑳]/g, "")
      .replace(/^[〜~～]+/, "")
      .replace(/^[（(][^）)]*[）)]/, "")
      .replace(/[（(][^）)]*$/g, "")
      .trim();
    s = s.replace(/(している|している|される|られた|する|した|な|の|だ)$/g, "").trim();
    if (s.length > 2) s = s.replace(/^[をにがはとでへの]/, "");
    if (s.length >= 2 && !/^(こと|もの|ひと|人|〜|する|ある)$/.test(s)) candidates.add(s);
  };
  if (w && w.meaning) String(w.meaning).split(/[、,／\/]/).forEach(add);
  if (w && w.detail && Array.isArray(w.detail.senses)) {
    w.detail.senses.forEach(se => {
      String(se.text || "").split(/[、,／\/\s　]/).forEach(seg => {
        add(seg);
        add(seg.replace(/[（(][^）)]*[）)]/g, ""));
      });
    });
  }
  return candidates;
}

function expand(text, start, len) {
  const isKanji = (c) => /[\u4e00-\u9fff]/.test(c);
  const isKata = (c) => /[\u30a0-\u30ff]/.test(c);
  const isHira = (c) => /[\u3040-\u309f]/.test(c);
  const particles = "のにをがはでともへや";
  let s = start, e = start + len;
  while (s > 0 && (isKanji(text[s - 1]) || isKata(text[s - 1]))) s--;
  while (e < text.length && (isKanji(text[e]) || isKata(text[e]))) e++;
  while (e < text.length && isHira(text[e]) && !particles.includes(text[e])) e++;
  return { start: s, end: e };
}

const words = new Map();
LEAP_WORDS_DATA.forEach(w => words.set(w.id, w));

const rows = [];
Object.keys(LEAP_WORD_DETAILS).forEach(idStr => {
  const d = LEAP_WORD_DETAILS[idStr];
  const w = words.get(d.id) || { id: d.id, word: d.word, meaning: "" };
  w.detail = d;
  const candidates = candidatesOf(w);
  d.examples.forEach((ex, i) => {
    const key = d.id + ":" + i;
    const text = String(ex.ja || "");
    const forced = overrides[key];
    if (forced && text.includes(forced)) return;
    let best = "";
    candidates.forEach(c => { if (text.includes(c) && c.length > best.length) best = c; });
    let kanjiOnly = false;
    if (!best) {
      const kanji = new Set();
      candidates.forEach(c => { for (const ch of c) if (/[\u4e00-\u9fff]/.test(ch)) kanji.add(ch); });
      kanji.forEach(ch => { if (text.includes(ch)) { best = best || ch; kanjiOnly = true; } });
    }
    let mark = best;
    let status = "ok";
    if (!best) {
      status = "fallback";
    } else {
      const r = expand(text, text.indexOf(best), best.length);
      mark = text.slice(r.start, r.end);
      if (mark === text) status = "whole";
      else if (kanjiOnly) status = "kanji";
      else if (mark.length <= 1 && text.length > 6) status = "short";
    }
    if (status !== "ok") {
      rows.push({ key, id: d.id, word: d.word, answer: ex.answer, ja: text, mark, status });
    }
  });
});

const counts = rows.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {});
console.error("needs work:", counts, "total", rows.length);
const mode = process.argv[2] || "all";
const out = rows.filter(r => mode === "all" || r.status === mode);
out.forEach(r => console.log([r.key, r.status, r.word, r.answer, r.mark, r.ja].join("\t")));
