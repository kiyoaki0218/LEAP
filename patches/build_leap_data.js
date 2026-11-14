// LEAP単語データ/*.txt をアプリ用のJSONに変換するビルドスクリプト
// 実行: node patches/build_leap_data.js
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "LEAP単語データ");
const WORD_FILES = [
  "001_101.txt", "102_203.txt", "204_301.txt", "302_400.txt",
  "401_505.txt", "506_603.txt", "604_702.txt", "703_807.txt"
];

const POS_MAP = {
  "自": "vi", "自動": "vi",
  "他": "vt", "他動": "vt",
  "動": "v", "動詞": "v",
  "名": "n", "名詞": "n",
  "形": "adj", "形容詞": "adj",
  "形動": "adjn", "形容動詞": "adjn",
  "副": "adv", "副詞": "adv",
  "前": "prep", "前置詞": "prep",
  "接": "conj", "接続詞": "conj",
  "代": "pron", "代名詞": "pron",
  "助": "aux", "助動詞": "aux",
  "助詞": "part",
  "間": "int", "間投": "int", "間投詞": "int"
};

const JP_RE = /[\u3040-\u30ff\u3400-\u9fff\uff01-\uff60\uff66-\uff9f]/;

function stripBrackets(s) {
  return String(s || "").replace(/【/g, "").replace(/】/g, "");
}

function parseHead(head) {
  const text = head.replace(/^\s+/, "");
  let m = text.match(/^([^\s\u3000]+)\s*\[([^\]]*)\]\s*([\s\S]*)$/);
  let word = "";
  let ipa = "";
  let rest = text;
  if (m) {
    word = m[1].trim();
    ipa = m[2].trim();
    rest = m[3].trim();
  } else {
    const sp = text.split(/[\s\u3000]+/);
    word = (sp[0] || "").trim();
    rest = text.slice(word.length).trim();
  }
  word = word.replace(/^[【（(]+|[】）)]+$/g, "").trim();

  // 品詞の後ろに発音記号が来る形式（例: increase 自動：[inkríːs]）に対応
  const ipaTokens = [];
  rest = rest.replace(/\[([^\]]*)\]/g, (all, inner) => {
    const looksIpa = /[a-zæɑɒəɜɪʊʌʃʒθðŋːˈˌ]/i.test(inner) && !JP_RE.test(inner);
    if (!looksIpa) return all;
    ipaTokens.push(inner.trim());
    return " ";
  });
  if (!ipa && ipaTokens.length) ipa = ipaTokens[0];
  rest = rest.replace(/[\s\u3000]{2,}/g, " ").trim();

  // 「自：… 他：…」のような品詞マーカーで分割
  const senses = [];
  const POS_TOKEN = "(?:自動|他動|動詞|名詞|形容動詞|形容詞|副詞|前置詞|接続詞|代名詞|助動詞|間投詞|自|他|動|名|形動|形|副|前|接|代|助|間)";
  const re = new RegExp("(" + POS_TOKEN + "(?:・" + POS_TOKEN + ")*)：", "g");
  let match;
  const marks = [];
  while ((match = re.exec(rest)) !== null) {
    // 「名詞：」などコラム内の語ではなく、先頭または空白区切りの品詞ラベルだけを対象にする
    const before = rest.slice(0, match.index);
    if (!(match.index === 0 || /[\s\u3000]$/.test(before))) continue;
    marks.push({ index: match.index, tag: match[1], markLen: match[0].length });
  }
  if (marks.length === 0) {
    senses.push({ tag: "", text: rest.trim() });
  } else {
    if (marks[0].index > 0) {
      const lead = rest.slice(0, marks[0].index).trim();
      if (lead) senses.push({ tag: "", text: lead });
    }
    marks.forEach((mk, i) => {
      const start = mk.index + mk.markLen;
      const end = i + 1 < marks.length ? marks[i + 1].index : rest.length;
      senses.push({ tag: mk.tag, text: rest.slice(start, end).trim() });
    });
  }
  const posTags = [];
  senses.forEach(s => {
    String(s.tag || "").split("・").forEach(part => {
      const tag = POS_MAP[part];
      if (tag && !posTags.includes(tag)) posTags.push(tag);
    });
  });
  return { word, ipa, senses, posTags, senseText: rest.trim() };
}

function cleanEnglish(raw) {
  return String(raw || "")
    .replace(/^[\s\u3000]+/, "")
    .replace(/[\s\u3000]*[①-⑳]+[\s\u3000]*$/, "")
    .replace(/[\s\u3000]+$/, "")
    .trim();
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function looksLikeTarget(token, word) {
  const t = String(token || "").toLowerCase().replace(/[^a-z-]/g, "");
  const w = String(word || "").toLowerCase().replace(/[^a-z-]/g, "");
  if (!t || !w) return false;
  if (t === w || t.startsWith(w) || w.startsWith(t)) return true;
  return t.length >= 3 && w.length >= 3 && (t.includes(w) || w.includes(t));
}

function parseExampleLine(line, word) {
  const t = line.replace(/^[\s\u3000]+/, "").trim();
  if (!t) return null;
  const firstJp = t.search(JP_RE);
  let en = "";
  let ja = "";
  if (firstJp < 0) {
    en = t;
  } else {
    en = t.slice(0, firstJp).trim();
    ja = t.slice(firstJp).trim();
  }
  // 和訳の先頭にある数字が英文側に取り残されるケースを戻す
  // 例: 「by 5　5時までに」「pay a debt of 100 dollars　100ドルの…」
  if (ja) {
    if (/^[＝=]/.test(ja)) {
      const math = en.match(/[\d\s+÷×=.,/-]+$/);
      if (math && /\d/.test(math[0])) {
        ja = math[0].trim() + ja;
        en = en.slice(0, math.index);
      }
    } else if (!/^\d/.test(ja)) {
      const num = en.match(/(\d[\d,.]*)\s*$/);
      if (num) {
        ja = num[1] + ja;
        en = en.slice(0, num.index);
      }
    }
  }
  en = cleanEnglish(en).replace(/^[①-⑳]+[\s\u3000]*/, "");
  if (!en && !ja) return null;

  // マーカーは 【word】 と [word] の2形式がある
  let marked = /【[^】]*】/.test(en);
  if (!marked) {
    en = en.replace(/\[([^\]]+)\]/g, (all, inner) => {
      return looksLikeTarget(inner, word) ? "【" + inner + "】" : all;
    });
    marked = /【[^】]*】/.test(en);
  }
  if (!marked && word) {
    const re = new RegExp("\\b" + escapeRegExp(word) + "(?:s|es|ed|d|ing|ly)?\\b", "i");
    if (re.test(en)) en = en.replace(re, m => "【" + m + "】");
  }

  const bracketMatches = en.match(/【[^】]*】/g) || [];
  const answer = bracketMatches.length ? bracketMatches[0].replace(/【|】/g, "") : "";
  const prompt = en.replace(/【[^】]*】/g, "[ ____ ]");
  const plain = stripBrackets(en).trim();
  return {
    en: en,
    ja: ja,
    plain: plain,
    prompt: prompt,
    answer: answer,
    hasBlank: bracketMatches.length > 0
  };
}

function parseWordFile(file) {
  const text = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
  const lines = text.split(/\r?\n/);
  const entries = [];
  let cur = null;
  let section = "";
  lines.forEach(raw => {
    const line = raw;
    const idMatch = line.match(/^\s*(\d{3})\s*$/);
    if (idMatch) {
      if (cur) entries.push(cur);
      cur = { id: Number(idMatch[1]), headLines: [], notes: [], rawExamples: [], started: true };
      section = "head";
      return;
    }
    if (!cur) return;
    const t = line.trim();
    if (!t) return;
    if (/^ー[-ー]+$/.test(t)) { section = "notes"; return; }
    if (/^例文[:：]?$/.test(t)) { section = "examples"; return; }
    const inlineExamples = t.match(/^例文[:：]\s*(.+)$/);
    if (inlineExamples) {
      section = "examples";
      inlineExamples[1].split(/\s+\/\s+(?=[①-⑳])/).forEach(part => {
        if (part.trim()) cur.rawExamples.push(part.trim());
      });
      return;
    }
    if (section === "head") { cur.headLines.push(line); return; }
    if (section === "notes") {
      // 1行に「コラム：… / 語源：…」と詰め込まれた注記を項目ごとに分ける
      t.split(/\s*\/\s+(?=(?:コラム|語源|派生語?|類語|頻出|表現|関連語|覚え方|対義語|比較|注意|補充)[:：])/)
        .forEach(part => { if (part.trim()) cur.notes.push(part.trim()); });
      return;
    }
    if (section === "examples") {
      cur.rawExamples.push(line);
    }
  });
  if (cur) entries.push(cur);
  return entries;
}

// ===== 例文の和訳ハイライト（個別指定） =====
// 語彙の言い換えなどで自動一致できない例文だけ、対応する和訳を明示する
const OVERRIDE_PATH = path.join(__dirname, "ja_highlight_overrides.json");
const jaOverrides = fs.existsSync(OVERRIDE_PATH)
  ? JSON.parse(fs.readFileSync(OVERRIDE_PATH, "utf8"))
  : {};
const usedOverrides = new Set();
const badOverrides = [];

// ===== 単語データの統合 =====
const details = {};
const anomalies = [];
WORD_FILES.forEach(file => {
  const entries = parseWordFile(file);
  entries.forEach(e => {
    const head = parseHead(e.headLines.join(" "));
    if (!head.word || !head.ipa) anomalies.push(`${file} #${e.id}: head=${e.headLines.join(" | ")}`);
    const exs = e.rawExamples.map(line => parseExampleLine(line, head.word)).filter(x => x && x.en);
    exs.forEach((ex, i) => {
      const key = e.id + ":" + i;
      const mark = jaOverrides[key];
      if (!mark) return;
      if (ex.ja && ex.ja.includes(mark)) {
        ex.jaMark = mark;
        usedOverrides.add(key);
      } else {
        badOverrides.push(key + " -> " + mark);
      }
    });
    details[e.id] = {
      id: e.id,
      word: head.word,
      ipa: head.ipa,
      senses: head.senses,
      senseText: head.senseText,
      posTags: head.posTags,
      notes: e.notes,
      examples: exs
    };
    if (!exs.length) anomalies.push(`${file} #${e.id}: no example`);
  });
});

// ===== 参考資料（code_artifact.txt）の解析 =====
function parseReference(file) {
  const text = fs.readFileSync(path.join(DATA_DIR, file), "utf8");
  const lines = text.split(/\r?\n/);
  const chapters = [];
  let chapter = null;
  let wordEntry = null;
  let mode = "blocks";

  const flushWord = () => {
    if (!wordEntry) return;
    const head = parseHead(wordEntry.headLines.join(" "));
    chapter.words.push({
      word: head.word,
      ipa: head.ipa,
      senses: head.senses,
      senseText: head.senseText,
      posTags: head.posTags,
      notes: wordEntry.notes
    });
    wordEntry = null;
  };

  lines.forEach(raw => {
    const t = raw.trim();
    if (/^=+$/.test(t)) return;
    const ch = t.match(/^【(第[^】]+)】\s*(.*)$/);
    if (ch) {
      flushWord();
      chapter = { title: ch[1], subtitle: ch[2] || "", words: [], blocks: [] };
      chapters.push(chapter);
      mode = /基本動詞/.test(ch[1] + ch[2]) ? "words" : "blocks";
      return;
    }
    if (!chapter) {
      chapter = { title: "参考資料", subtitle: "", words: [], blocks: [] };
      chapters.push(chapter);
    }
    if (mode === "words") {
      const isHead = /^\s*[^\s\u3000]+\s*\[[^\]]*\]/.test(raw);
      if (isHead) {
        flushWord();
        wordEntry = { headLines: [raw], notes: [] };
        return;
      }
      if (!wordEntry) return;
      if (!t) return;
      if (/^ー[-ー]+$/.test(t)) return;
      wordEntry.notes.push(t.replace(/^コラム[:：]\s*/, ""));
      return;
    }
    if (!t) return;
    chapter.blocks.push(t);
  });
  flushWord();
  return chapters;
}

const reference = parseReference("code_artifact.txt");

const outPath = path.join(ROOT, "examples_data.js");
const exData = {};
Object.keys(details).forEach(k => {
  const d = details[k];
  const first = d.examples[0];
  if (first) {
    exData[k] = {
      en: first.plain || stripBrackets(first.en),
      ja: first.ja || "",
      pos: d.posTags[0] || ""
    };
  }
});

const header = `/* ============================================================
   LEAP単語データ（LEAP単語データ/*.txt）から自動生成した詳細データ
   ------------------------------------------------------------
   LEAP_WORD_DETAILS[id] = {
     word, ipa, senses[{tag,text}], senseText, posTags[], notes[], examples[]
   }
   examples[] = { en, ja, plain, prompt, answer, hasBlank }
   LEAP_EXAMPLE_DATA[id] = { en, ja, pos }（例文クイズ・品詞バッジ用）
   ============================================================ */

`;

const body = header
  + "const LEAP_WORD_DETAILS = " + JSON.stringify(details, null, 0) + ";\n\n"
  + "const LEAP_EXAMPLE_DATA = " + JSON.stringify(exData, null, 0) + ";\n";

fs.writeFileSync(outPath, body, "utf8");

const refPath = path.join(ROOT, "reference_data.js");
const refBody = `/* ============================================================
   LEAP 参考資料（code_artifact.txt）から自動生成
   基礎単語の詳細 / 語源・接頭辞・接尾辞 / ディスコースマーカー /
   発音・アクセントのルール
   ============================================================ */

const LEAP_REFERENCE_DATA = ${JSON.stringify(reference, null, 0)};
`;
fs.writeFileSync(refPath, refBody, "utf8");

console.log("words:", Object.keys(details).length);
console.log("examples:", Object.keys(exData).length);
console.log("reference chapters:", reference.map(c => `${c.title}(${c.words.length}w/${c.blocks.length}l)`).join(" / "));
console.log("anomalies:", anomalies.length);
console.log("ja highlight overrides:", usedOverrides.size, "/", Object.keys(jaOverrides).length);
if (badOverrides.length) console.log("invalid overrides:\n" + badOverrides.join("\n"));
const unused = Object.keys(jaOverrides).filter(k => !usedOverrides.has(k));
if (unused.length) console.log("unused overrides:", unused.length, unused.slice(0, 10).join(", "));
console.log(anomalies.slice(0, 15).join("\n"));
console.log("size details:", fs.statSync(outPath).size, "ref:", fs.statSync(refPath).size);
