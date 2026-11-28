/* ============================================================
   js/quiz-resume.js の単体テスト（依存なし）
   実行: node tests/resume.test.js
   ============================================================ */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "js", "quiz-resume.js"), "utf8");
vm.runInThisContext(src, { filename: "js/quiz-resume.js" });
const R = globalThis.LeapQuizResume;

let passed = 0;
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _dump: () => map
  };
}

const baseQuiz = {
  subject: "leap",
  ids: [11, 12, 13],
  index: 2,
  style: "spelling",
  label: "Part 1",
  correctCount: 1,
  combo: 1,
  maxCombo: 2,
  earnedCoins: 10,
  earnedExp: 5,
  score: 120,
  mistakeIds: [12],
  isDaily: false,
  isWeak: true,
  savedAt: "2026-11-28T00:00:00.000Z"
};

test("buildPayload: 型をそろえて保存用オブジェクトを作る", () => {
  const p = R.buildPayload({ subject: "leap", ids: ["11", 12.0, 13], index: "2", score: "120.5" });
  assert.strictEqual(p.v, R.VERSION);
  assert.deepStrictEqual(p.ids, [11, 12, 13]);
  assert.strictEqual(p.index, 2);
  assert.strictEqual(p.style, "normal");
  assert.strictEqual(p.score, 120.5);
  assert.strictEqual(typeof p.savedAt, "string");
});

test("buildPayload: 不正な id / index は落として 0 に丸める", () => {
  const p = R.buildPayload({ ids: [0, -1, "x", 5], index: -3 });
  assert.deepStrictEqual(p.ids, [5]);
  assert.strictEqual(p.index, 0);
});

test("isValid: 正常なデータは通る", () => {
  assert.strictEqual(R.isValid(R.buildPayload(baseQuiz)), true);
});

test("isValid: 版違い・語数不足・範囲外 index・壊れた id を弾く", () => {
  const ok = R.buildPayload(baseQuiz);
  assert.strictEqual(R.isValid({ ...ok, v: 0 }), false);
  assert.strictEqual(R.isValid({ ...ok, ids: [11] }), false);
  assert.strictEqual(R.isValid({ ...ok, ids: "11,12" }), false);
  assert.strictEqual(R.isValid({ ...ok, ids: [11, "x"] }), false);
  assert.strictEqual(R.isValid({ ...ok, index: 3 }), false);
  assert.strictEqual(R.isValid({ ...ok, index: -1 }), false);
  assert.strictEqual(R.isValid({ ...ok, index: 1.5 }), false);
  assert.strictEqual(R.isValid(null), false);
});

test("canOverwrite: 1問目(index 0)では上書きしない", () => {
  assert.strictEqual(R.canOverwrite(0), false);
  assert.strictEqual(R.canOverwrite(1), true);
  assert.strictEqual(R.canOverwrite(4), true);
});

test("isResumable: 2問目以降だけ・同一ゾーンだけ・古文は不可", () => {
  const p = R.buildPayload(baseQuiz);
  assert.strictEqual(R.isResumable(p, "leap"), true);
  assert.strictEqual(R.isResumable({ ...p, index: 0 }, "leap"), false);
  assert.strictEqual(R.isResumable(p, "kobun"), false);
  assert.strictEqual(R.isResumable({ ...p, subject: "kobun" }, "kobun"), false);
  assert.strictEqual(R.isResumable({ ...p, v: 9 }, "leap"), false);
});

test("matchesQuiz: 同じクイズだけ一致し、別クイズは一致しない", () => {
  const p = R.buildPayload(baseQuiz);
  assert.strictEqual(R.matchesQuiz(p, "leap", [11, 12, 13]), true);
  assert.strictEqual(R.matchesQuiz(p, "leap", [11, 12, 14]), false);
  assert.strictEqual(R.matchesQuiz(p, "leap", [11, 12]), false);
  assert.strictEqual(R.matchesQuiz(p, "kobun", [11, 12, 13]), false);
  assert.strictEqual(R.matchesQuiz(null, "leap", [11, 12, 13]), false);
});

test("read/write/clear: 保存・読み出し・削除が往復する", () => {
  const store = memoryStorage();
  const p = R.buildPayload(baseQuiz);
  assert.strictEqual(R.read(store), null);
  assert.strictEqual(R.write(store, p), true);
  assert.deepStrictEqual(R.read(store), p);
  R.clear(store);
  assert.strictEqual(R.read(store), null);
});

test("read: 壊れた JSON や不正データは null（例外を投げない）", () => {
  const store = memoryStorage();
  store.setItem(R.RESUME_KEY, "{oops");
  assert.strictEqual(R.read(store), null);
  store.setItem(R.RESUME_KEY, JSON.stringify({ v: 1, ids: [1], index: 0, subject: "leap" }));
  assert.strictEqual(R.read(store), null);
  store.setItem(R.RESUME_KEY, JSON.stringify({ ...R.buildPayload(baseQuiz), v: 2 }));
  assert.strictEqual(R.read(store), null);
});

test("write: 保存できないストレージでも落ちない", () => {
  const broken = { getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem: () => {} };
  assert.strictEqual(R.write(broken, R.buildPayload(baseQuiz)), false);
  assert.doesNotThrow(() => R.clear(broken));
});

for (const t of tests) {
  try {
    t.fn();
    passed += 1;
    console.log(`  ok   ${t.name}`);
  } catch (e) {
    console.error(`  FAIL ${t.name}\n       ${e.message}`);
    process.exitCode = 1;
  }
}
console.log(`\n${passed}/${tests.length} passed`);
