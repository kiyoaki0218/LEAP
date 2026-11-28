/* ============================================================
   js/mock-score.js の単体テスト（依存なし）
   実行: node tests/mock-score.test.js
   ============================================================ */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "difficulty_data.js"), "utf8") + "\nglobalThis.LEAP_DIFFICULTY = LEAP_DIFFICULTY;", { filename: "difficulty_data.js" });
vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "js", "mock-score.js"), "utf8"), { filename: "js/mock-score.js" });
const S = globalThis.LeapMockScore;
const DIFF = globalThis.LEAP_DIFFICULTY;

let passed = 0;
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
const items = (b, n, correct) => Array.from({ length: n }, () => ({ b, correct }));

test("p3pl: 4択の当て推量 0.25 を下回らない", () => {
  assert.ok(S.p3pl(-4, 0) > 0.25);
  assert.ok(S.p3pl(-4, 0) < 0.27);
  assert.ok(S.p3pl(4, 0) > 0.95);
});

test("全問正解でも Part 1（易）だけなら 75 に張り付かない", () => {
  const r = S.estimateAbility(items(-1.7, 30, true));
  assert.strictEqual(r.total, 30);
  assert.ok(r.deviation < 75, `deviation=${r.deviation}`);
  assert.ok(r.deviation > 55, `deviation=${r.deviation}`);
});

test("難しい語を取ると偏差値が上がる（難易度が反映される）", () => {
  const easyOnly = S.estimateAbility([...items(-1.7, 30, true), ...items(-1.7, 20, false)]);
  const withHard = S.estimateAbility([...items(-1.7, 30, true), ...items(1.2, 20, true)]);
  assert.ok(withHard.deviation > easyOnly.deviation + 3, `${withHard.deviation} vs ${easyOnly.deviation}`);
});

test("全問不正解は低い偏差値になり、下限も低い", () => {
  const r = S.estimateAbility(items(-1.0, 30, false));
  assert.ok(r.deviation < 45, `deviation=${r.deviation}`);
  assert.ok(r.lo <= r.deviation && r.hi >= r.deviation);
  assert.ok(r.hi - r.lo > 0);
});

test("正解数が増えるほど単調に上がる", () => {
  let prev = -Infinity;
  for (let c = 0; c <= 20; c += 4) {
    const r = S.estimateAbility(Array.from({ length: 20 }, (_, i) => ({ b: 0, correct: i < c })));
    assert.ok(r.deviation >= prev, `${c}: ${r.deviation} < ${prev}`);
    prev = r.deviation;
  }
});

test("問題数が多いほど信頼区間が狭い", () => {
  const few = S.estimateAbility(items(0, 5, true));
  const many = S.estimateAbility(items(0, 50, true));
  assert.ok((many.hi - many.lo) < (few.hi - few.lo));
  assert.ok(many.se < few.se);
});

test("偏差値は 20〜80 に収まる", () => {
  assert.strictEqual(S.deviationFromTheta(10), 80);
  assert.strictEqual(S.deviationFromTheta(-10), 20);
  assert.strictEqual(S.deviationFromTheta(0), 50);
});

test("judgeTier: 信頼区間の下限で tier 別に判定する", () => {
  assert.strictEqual(S.judgeTier(1, 66).grade, "A");
  assert.strictEqual(S.judgeTier(1, 60).grade, "B");
  assert.strictEqual(S.judgeTier(1, 50).grade, "C");
  assert.strictEqual(S.judgeTier(1, 40).grade, "D");
  assert.strictEqual(S.judgeTier(4, 54).grade, "A");
  assert.strictEqual(S.judgeTier("", 0).grade, "D");
});

test("judgeTier: 志望者内パーセンタイルで 1 段だけ動く", () => {
  assert.strictEqual(S.judgeTier(2, 56, { percentileWithin: 20 }).grade, "A");
  assert.strictEqual(S.judgeTier(2, 56, { percentileWithin: 50 }).grade, "B");
  assert.strictEqual(S.judgeTier(2, 56, { percentileWithin: 90 }).grade, "C");
  assert.strictEqual(S.judgeTier(2, 70, { percentileWithin: 10 }).grade, "A");
});

test("bForWord: Part ごとに別の難易度、個別上書きが優先", () => {
  assert.strictEqual(S.bForWord({ id: 1, part: 1 }, DIFF), -1.7);
  assert.strictEqual(S.bForWord({ id: 401, part: 2 }, DIFF), -1.0);
  assert.strictEqual(S.bForWord({ id: 2000, part: 5 }, DIFF), 1.2);
  const custom = { parts: DIFF.parts, words: { 401: { b: 2.5 } } };
  assert.strictEqual(S.bForWord({ id: 401, part: 2 }, custom), 2.5);
  assert.strictEqual(S.bForWord({ id: 9999, part: 99 }, DIFF), 0);
});

test("itemsFromAnswers: answers の正誤と単語の Part を対応づける", () => {
  const words = { 1: { id: 1, part: 1 }, 402: { id: 402, part: 2 } };
  const got = S.itemsFromAnswers([{ id: 1, correct: true }, { id: 402, correct: false }, { id: 999, correct: true }], words, DIFF);
  assert.strictEqual(got.length, 2);
  assert.strictEqual(got[0].b, -1.7);
  assert.strictEqual(got[0].correct, true);
  assert.strictEqual(got[1].b, -1.0);
  assert.strictEqual(got[1].correct, false);
});

test("estimateAbility: 空でも落ちない", () => {
  const r = S.estimateAbility([]);
  assert.strictEqual(r.total, 0);
  assert.strictEqual(r.deviation, 50);
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
