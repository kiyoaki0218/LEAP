/* 古文単語の詳細データ生成
   入力: 古文単語データ/*.txt（Drive の「古文単語データ」をそのまま配置）
   出力: kobun/kobun_details_data.js（KOBUN_WORD_DETAILS）

   1語の形式:
   {
     num, kanji, form, pos, frequency(1-3), core,
     senses: [{ mark, text, important }],
     notes:  [{ label, text }],            // 解説 / 入試 / 関連
     examples: [{
       mark, target,                        // 「対応訳語」の見出し（① など）
       sentence,                            // 原文（【】付き）
       plain,                               // 原文（【】を外したもの）
       prompt,                              // 空欄化した原文（クイズ用）
       answer,                              // 空欄に入る語
       ja,                                  // 現代語訳（【】付き）
       source,                              // 出典
       note,                                // 補足
       quizEligible                         // 見出し語の訳に対応する例文か
     }]
   }
*/

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "古文単語データ");
const OUT = path.join(ROOT, "kobun", "kobun_details_data.js");

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";

function parseSenses(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];
  const parts = text.split(new RegExp("(?=[" + CIRCLED + "])")).map((s) => s.trim()).filter(Boolean);
  return parts.map((part) => {
    const m = part.match(new RegExp("^([" + CIRCLED + "])\\s*([\\s\\S]*)$"));
    const mark = m ? m[1] : "";
    let body = (m ? m[2] : part).trim();
    const important = /【[^】]*】/.test(body);
    body = body.replace(/【/g, "").replace(/】/g, "").trim();
    return { mark, text: body, important };
  }).filter((s) => s.text);
}

function parseHeader(raw, num) {
  let head = String(raw || "").replace(/^見出し\s*：/, "").trim();
  const freqMatch = head.match(/［重要度：([★☆]+)］/);
  const stars = freqMatch ? (freqMatch[1].match(/★/g) || []).length : 1;
  head = head.replace(/［重要度：[^］]*］/g, "").trim();

  let kanji = "";
  const kanjiMatch = head.match(/《(.+?)》/);
  if (kanjiMatch) {
    kanji = kanjiMatch[1].trim();
    head = head.replace(kanjiMatch[0], "").trim();
  }

  let form = "";
  const formMatch = head.match(/（(.+?)）\s*$/);
  if (formMatch) {
    form = formMatch[1].trim();
    head = head.replace(formMatch[0], "").trim();
  }

  return { num, word: head, kanji, form, frequency: Math.min(3, Math.max(1, stars || 1)) };
}

function derivePos(form) {
  const f = String(form || "");
  if (!f) return "";
  if (/シク活用|ク活用/.test(f)) return "形容詞";
  if (/ナリ活用|タリ活用/.test(f)) return "形容動詞";
  if (/活用|段|変格/.test(f)) return "動詞";
  if (/副詞/.test(f)) return "副詞";
  if (/名詞/.test(f)) return "名詞";
  if (/連語/.test(f)) return "連語";
  if (/接続/.test(f)) return "接続詞";
  if (/感動/.test(f)) return "感動詞";
  if (/敬語/.test(f)) return "敬語";
  return f;
}

function parseExampleSentence(line) {
  let body = String(line || "").trim();
  let source = "";
  const m = body.match(/（([^（）]+)）\s*$/);
  if (m) {
    source = m[1].trim();
    body = body.slice(0, m.index).trim();
  }
  return { sentence: body, source };
}

function parseEntry(num, block) {
  const lines = String(block || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const entry = {
    num,
    word: "",
    kanji: "",
    form: "",
    pos: "",
    frequency: 1,
    core: "",
    senses: [],
    notes: [],
    examples: []
  };
  let mode = "";
  let current = null;

  const pushText = (key, text) => {
    if (!text) return;
    entry[key] = entry[key] ? entry[key] + " " + text : text;
  };

  lines.forEach((line) => {
    let m;
    if ((m = line.match(/^見出し\s*：(.*)$/))) {
      const header = parseHeader(m[0], num);
      Object.assign(entry, header);
      mode = "";
      return;
    }
    if ((m = line.match(/^訳語\s*：(.*)$/))) {
      entry.senses = parseSenses(m[1]);
      mode = "senses";
      return;
    }
    if ((m = line.match(/^核\s*：(.*)$/))) {
      pushText("core", m[1].trim());
      mode = "core";
      return;
    }
    if ((m = line.match(/^解説\s*：(.*)$/))) {
      pushText("explanation", m[1].trim());
      mode = "explanation";
      return;
    }
    if ((m = line.match(/^入試\s*：(.*)$/))) {
      pushText("exam", m[1].trim());
      mode = "exam";
      return;
    }
    if ((m = line.match(/^関連\s*：(.*)$/))) {
      pushText("related", m[1].trim());
      mode = "related";
      return;
    }
    if ((m = line.match(/^例文\s*：(.*)$/))) {
      mode = "examples";
      current = null;
      return;
    }

    if (mode === "examples") {
      const mark = line.match(new RegExp("^([" + CIRCLED + "])（(.+?)）\\s*$"));
      if (mark) {
        const rawTarget = mark[2].trim();
        const senseMark = rawTarget.replace(/^対応訳語\s*[：:]\s*/, "").trim();
        current = {
          mark: mark[1],
          target: senseMark,
          sentence: "",
          plain: "",
          prompt: "",
          answer: "",
          ja: "",
          source: "",
          note: "",
          quizEligible: (new RegExp("^[" + CIRCLED + "]$")).test(senseMark)
        };
        entry.examples.push(current);
        return;
      }
      if (!current) return;
      if ((m = line.match(/^→\s*(.*)$/))) {
        current.ja = m[1].trim();
        return;
      }
      if (/^[*※]/.test(line) || /^-\s/.test(line)) {
        current.note = current.note ? current.note + " " + line.replace(/^[*※]\s*|^-\s*/, "").trim() : line.replace(/^[*※]\s*|^-\s*/, "").trim();
        return;
      }
      if (!current.sentence) {
        const s = parseExampleSentence(line);
        current.sentence = s.sentence;
        current.source = s.source;
        return;
      }
      // 例文の補足説明（原文・訳のあとに続く段落）
      current.note = current.note ? current.note + " " + line : line;
      return;
    }

    // 複数行にまたがるテキスト欄
    if (mode === "explanation") pushText("explanation", line);
    else if (mode === "exam") pushText("exam", line);
    else if (mode === "related") pushText("related", line);
    else if (mode === "core") pushText("core", line);
  });

  entry.pos = derivePos(entry.form);
  entry.notes = [
    { label: "解説", text: entry.explanation || "" },
    { label: "入試", text: entry.exam || "" },
    { label: "関連", text: entry.related || "" }
  ].filter((n) => n.text);
  delete entry.explanation;
  delete entry.exam;
  delete entry.related;

  entry.examples = entry.examples
    .map((ex) => {
      const answerMatch = ex.sentence.match(/【([^】]+)】/);
      const answer = answerMatch ? answerMatch[1] : "";
      const plain = ex.sentence.replace(/【/g, "").replace(/】/g, "");
      // 空欄は最初の【…】だけ。残りの【…】は括弧を外して読めるようにする
      let blanked = false;
      const prompt = ex.sentence.replace(/【([^】]+)】/g, (m, inner) => {
        if (!blanked) { blanked = true; return "[ ____ ]"; }
        return inner;
      });
      return Object.assign({}, ex, { answer, plain, prompt, quizEligible: ex.quizEligible && !!answer });
    })
    .filter((ex) => ex.sentence);

  return entry;
}

function main() {
  const files = fs.readdirSync(SRC_DIR).filter((f) => /\.txt$/i.test(f));
  if (!files.length) {
    console.error("古文単語データ/*.txt が見つかりません");
    process.exit(1);
  }

  const byNum = new Map();
  files.forEach((file) => {
    const raw = fs.readFileSync(path.join(SRC_DIR, file), "utf8").replace(/\r\n?/g, "\n");
    const start = raw.search(/^\[\d{3}\]\s*$/m);
    if (start < 0) return;
    const text = raw.slice(start);
    const parts = text.split(/^\[(\d{3})\]\s*$/m);
    for (let i = 1; i < parts.length; i += 2) {
      const num = parseInt(parts[i], 10);
      const entry = parseEntry(num, parts[i + 1] || "");
      if (!entry.word) continue;
      const prev = byNum.get(num);
      // 重複収録（41〜45 など）は例文が多い方を採用
      if (!prev || entry.examples.length > prev.examples.length) byNum.set(num, entry);
    }
  });

  const nums = [...byNum.keys()].sort((a, b) => a - b);
  const details = {};
  nums.forEach((num) => {
    const e = byNum.get(num);
    details[10000 + num] = {
      num,
      kanji: e.kanji,
      form: e.form,
      pos: e.pos,
      frequency: e.frequency,
      core: e.core,
      senses: e.senses,
      notes: e.notes,
      examples: e.examples
    };
  });

  const missing = [];
  for (let n = 1; n <= 150; n++) if (!byNum.has(n)) missing.push(n);
  const noExample = nums.filter((n) => byNum.get(n).examples.length === 0);
  const exampleCount = nums.reduce((sum, n) => sum + byNum.get(n).examples.length, 0);

  const header = `/* 古文単語の詳細データ（自動生成）\n   生成: patches/build_kobun_details.js\n   出典: 古文単語データ/*.txt（No.001〜No.150）\n   収録: ${nums.length}語 / 例文 ${exampleCount}件\n   手編集しない。元データを直してスクリプトを再実行する。\n*/\n`;
  fs.writeFileSync(OUT, header + "const KOBUN_WORD_DETAILS = " + JSON.stringify(details, null, 1) + ";\n", "utf8");

  console.log(`generated ${path.relative(ROOT, OUT)}`);
  console.log(`entries=${nums.length} examples=${exampleCount} noExample=${noExample.length} missing=${missing.join(",") || "none"}`);
  if (noExample.length) console.log("noExample nums:", noExample.join(","));
}

main();
