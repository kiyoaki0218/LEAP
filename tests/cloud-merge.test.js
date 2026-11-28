/* ============================================================
   js/cloud-merge.js の単体テスト（依存なし）
   実行: node tests/cloud-merge.test.js
   ============================================================ */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "js", "cloud-merge.js"), "utf8");
vm.runInThisContext(src, { filename: "js/cloud-merge.js" });
const M = globalThis.LeapCloudMerge;

let passed = 0;
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function w(overrides) {
  return Object.assign({
    id: 1, word: "agree", meaning: "賛成する", count: 2, stage: 1,
    nextReview: "2026-11-29", lastReviewed: "2026-11-28", source: "quiz"
  }, overrides);
}

test("mergeWeakWord: 後から復習した端末の stage / nextReview を採用する", () => {
  const pc = w({ stage: 2, nextReview: "2026-11-30", lastReviewed: "2026-11-28" });
  const phone = w({ stage: 4, nextReview: "2026-12-15", lastReviewed: "2026-12-01" });
  const merged = M.mergeWeakWord(pc, phone);
  assert.strictEqual(merged.stage, 4);
  assert.strictEqual(merged.nextReview, "2026-12-15");
  assert.strictEqual(merged.lastReviewed, "2026-12-01");
});

test("mergeWeakWord: 以前のように早い nextReview へ巻き戻さない", () => {
  const advanced = w({ stage: 3, nextReview: "2026-12-05", lastReviewed: "2026-11-28" });
  const stale = w({ stage: 3, nextReview: "2026-11-28", lastReviewed: "2026-11-25" });
  assert.strictEqual(M.mergeWeakWord(advanced, stale).nextReview, "2026-12-05");
  assert.strictEqual(M.mergeWeakWord(stale, advanced).nextReview, "2026-12-05");
});

test("mergeWeakWord: 同日なら stage が高い方、stage も同じなら nextReview が遅い方", () => {
  const low = w({ stage: 1, nextReview: "2026-11-29", lastReviewed: "2026-11-28" });
  const high = w({ stage: 2, nextReview: "2026-12-01", lastReviewed: "2026-11-28" });
  assert.strictEqual(M.mergeWeakWord(low, high).stage, 2);
  const sameA = w({ stage: 2, nextReview: "2026-12-01" });
  const sameB = w({ stage: 2, nextReview: "2026-12-03" });
  assert.strictEqual(M.mergeWeakWord(sameA, sameB).nextReview, "2026-12-03");
});

test("mergeWeakWord: 間違い回数は多い方を残す", () => {
  const a = w({ count: 2, lastReviewed: "2026-11-28" });
  const b = w({ count: 9, lastReviewed: "2026-11-20" });
  assert.strictEqual(M.mergeWeakWord(a, b).count, 9);
});

test("mergeWeak: 片方にしかない単語はそのまま残す", () => {
  const merged = M.mergeWeak(
    { weakWords: { 1: w({ id: 1 }) } },
    { weakWords: { 2: w({ id: 2, word: "oppose" }) } }
  );
  assert.deepStrictEqual(Object.keys(merged.weakWords).sort(), ["1", "2"]);
});

test("mergeWeak: 克服済みの単語は古い端末データから復活させない", () => {
  const local = { weakWords: { 1: w({ id: 1, stage: 4, lastReviewed: "2026-11-27" }) } };
  const cloud = { weakWords: {}, graduatedWords: { 1: "2026-11-28" } };
  const merged = M.mergeWeak(local, cloud);
  assert.deepStrictEqual(merged.weakWords, {});
  assert.deepStrictEqual(merged.graduatedWords, { 1: "2026-11-28" });
});

test("mergeWeak: 克服後にまた間違えたら苦手に戻す", () => {
  const local = { weakWords: { 1: w({ id: 1, stage: 1, lastReviewed: "2026-12-01" }) }, graduatedWords: { 1: "2026-11-28" } };
  const cloud = {};
  const merged = M.mergeWeak(local, cloud);
  assert.ok(merged.weakWords["1"]);
  assert.strictEqual(merged.graduatedWords["1"], undefined);
});

test("mergeWeak: 克服日の記録は新しい方を残す", () => {
  const merged = M.mergeWeak(
    { graduatedWords: { 1: "2026-11-20", 2: "2026-11-25" } },
    { graduatedWords: { 1: "2026-11-28" } }
  );
  assert.deepStrictEqual(merged.graduatedWords, { 1: "2026-11-28", 2: "2026-11-25" });
});

test("mergeWeak: 壊れた入力でも落ちない", () => {
  assert.deepStrictEqual(M.mergeWeak(null, undefined), { weakWords: {}, graduatedWords: {} });
  assert.deepStrictEqual(M.mergeWeak({ weakWords: { 1: null } }, { weakWords: "x" }), { weakWords: {}, graduatedWords: {} });
});

test("mergeWeak: stage / count の異常値を丸める", () => {
  const merged = M.mergeWeak({ weakWords: { 1: w({ id: 1, stage: 99, count: -5 }) } }, {});
  assert.strictEqual(merged.weakWords["1"].stage, 4);
  assert.strictEqual(merged.weakWords["1"].count, 1);
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
