/* ============================================================
   js/roadmap.js（LeapRoadmapPlan）の単体テスト
   実行: node tests/roadmap.test.js
   ============================================================ */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "js", "roadmap.js"), "utf8"), { filename: "js/roadmap.js" });
const P = globalThis.LeapRoadmapPlan;

let passed = 0;
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const PARTS = [
  { part: 1, label: "Part 1", total: 400, done: 200 },
  { part: 2, label: "Part 2", total: 600, done: 0 },
  { part: 3, label: "Part 3", total: 400, done: 0 },
  { part: 4, label: "Part 4", total: 600, done: 0 },
  { part: 5, label: "Part 5", total: 300, done: 0 }
];

test("日付計算（うるう年・月跨ぎ）", () => {
  assert.strictEqual(P.daysBetween("2026-02-27", "2026-03-01"), 2);
  assert.strictEqual(P.daysBetween("2024-02-28", "2024-03-01"), 2);
  assert.strictEqual(P.daysBetween("2026-03-01", "2026-02-27"), -2);
  assert.strictEqual(P.addDays("2026-12-30", 3), "2027-01-02");
});

test("残り語数と1日ノルマを逆算する", () => {
  const plan = P.computePlan({ today: "2026-12-01", examDate: "2027-01-30", startDate: "2026-12-01", parts: PARTS });
  assert.strictEqual(plan.totalWords, 2300);
  assert.strictEqual(plan.totalDone, 200);
  assert.strictEqual(plan.remaining, 2100);
  assert.strictEqual(plan.daysLeft, 60);
  assert.strictEqual(plan.wordsPerDay, 35);
});

test("当日受験なら 1 日で残り全部（0除算しない）", () => {
  const plan = P.computePlan({ today: "2027-01-30", examDate: "2027-01-30", startDate: "2026-12-01", parts: PARTS });
  assert.strictEqual(plan.daysLeft, 0);
  assert.strictEqual(plan.wordsPerDay, 2100);
  assert.strictEqual(plan.overdue, false);
});

test("マイルストーンは Part 順で累積し、期限が試験日を超えない", () => {
  const plan = P.computePlan({ today: "2026-12-01", examDate: "2027-01-30", startDate: "2026-12-01", parts: PARTS });
  const ms = plan.milestones;
  assert.deepStrictEqual(ms.map((m) => m.part), [1, 2, 3, 4, 5]);
  assert.strictEqual(ms[0].complete, false);
  assert.ok(ms[0].cumulative < ms[4].cumulative);
  ms.forEach((m) => assert.ok(m.dueDate <= "2027-01-30", m.dueDate));
  assert.strictEqual(ms[4].dueDate, "2027-01-30");
});

test("完了済みの Part は期限なし・complete", () => {
  const plan = P.computePlan({
    today: "2026-12-01", examDate: "2026-12-31", startDate: "2026-12-01",
    parts: [{ part: 1, label: "Part 1", total: 400, done: 400 }, { part: 2, label: "Part 2", total: 600, done: 100 }]
  });
  assert.strictEqual(plan.milestones[0].complete, true);
  assert.strictEqual(plan.milestones[0].remaining, 0);
  assert.strictEqual(plan.remaining, 500);
  assert.strictEqual(plan.wordsPerDay, 17);
});

test("予定線より遅れていれば behind と遅れ日数", () => {
  const plan = P.computePlan({
    today: "2026-12-31", examDate: "2027-01-30", startDate: "2026-12-01",
    parts: [{ part: 1, label: "Part 1", total: 1000, done: 100 }]
  });
  assert.strictEqual(plan.status, "behind");
  assert.ok(plan.daysBehind > 0, String(plan.daysBehind));
  assert.ok(plan.diff < 0);
});

test("予定線より進んでいれば ahead", () => {
  const plan = P.computePlan({
    today: "2026-12-31", examDate: "2027-01-30", startDate: "2026-12-01",
    parts: [{ part: 1, label: "Part 1", total: 1000, done: 900 }]
  });
  assert.strictEqual(plan.status, "ahead");
  assert.ok(plan.diff > 0);
});

test("全範囲習得済みなら 0 語/日・progress 1", () => {
  const plan = P.computePlan({
    today: "2026-12-01", examDate: "2026-12-31", startDate: "2026-12-01",
    parts: [{ part: 1, label: "Part 1", total: 100, done: 100 }]
  });
  assert.strictEqual(plan.remaining, 0);
  assert.strictEqual(plan.wordsPerDay, 0);
  assert.strictEqual(plan.progress, 1);
});

test("試験日を過ぎていたら overdue", () => {
  const plan = P.computePlan({
    today: "2027-02-01", examDate: "2027-01-30", startDate: "2026-12-01",
    parts: [{ part: 1, label: "Part 1", total: 100, done: 10 }]
  });
  assert.strictEqual(plan.daysLeft, 0);
  assert.strictEqual(plan.overdue, true);
});

test("Part が空でも落ちない", () => {
  const plan = P.computePlan({ today: "2026-12-01", examDate: "2026-12-31", parts: [] });
  assert.strictEqual(plan.totalWords, 0);
  assert.strictEqual(plan.wordsPerDay, 0);
  assert.deepStrictEqual(plan.milestones, []);
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
