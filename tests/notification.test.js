// tests/notification.test.js
// 学習リマインダー通知ロジックの単体テスト

const assert = require("assert");

// モック環境のセットアップ
const mockStorage = {};
global.localStorage = {
  getItem: (k) => (k in mockStorage ? mockStorage[k] : null),
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

global.window = global;
global.document = {
  getElementById: () => null,
  addEventListener: () => {}
};

// notification.js をロード
require("../js/notification.js");
const notif = global.LEAP_NOTIFICATION;

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log("Running notification tests...");

test("初期設定・デフォルト値の取得", () => {
  global.localStorage.clear();
  const cfg = notif.getConfig();
  assert.strictEqual(cfg.enabled, false);
  assert.strictEqual(cfg.time, "20:00");
  assert.strictEqual(cfg.review, true);
  assert.strictEqual(cfg.streak, true);
});

test("設定の保存と反映", () => {
  global.localStorage.clear();
  notif.saveConfig({ enabled: true, time: "21:30", review: false, streak: true });
  const cfg = notif.getConfig();
  assert.strictEqual(cfg.enabled, true);
  assert.strictEqual(cfg.time, "21:30");
  assert.strictEqual(cfg.review, false);
  assert.strictEqual(cfg.streak, true);
});

test("時刻判定 (isTimeToNotify): 一致と不一致", () => {
  const dateAt2000 = new Date(2026, 10, 28, 20, 0, 0);
  const dateAt2001 = new Date(2026, 10, 28, 20, 1, 0);
  const dateAt0800 = new Date(2026, 10, 28, 8, 0, 0);

  assert.strictEqual(notif.isTimeToNotify("20:00", dateAt2000), true);
  assert.strictEqual(notif.isTimeToNotify("20:00", dateAt2001), false);
  assert.strictEqual(notif.isTimeToNotify("20:00", dateAt0800), false);
  assert.strictEqual(notif.isTimeToNotify("invalid", dateAt2000), false);
});

test("通知メッセージ生成 (通常時)", () => {
  const payload = notif.buildReminderContent({ dueReviewCount: 0, streakDays: 0 });
  assert.ok(payload.title.includes("LEAP単語学習"));
  assert.strictEqual(payload.tag, "leap-study-reminder");
});

test("通知メッセージ生成 (忘却曲線の復習対象がある場合)", () => {
  const payload = notif.buildReminderContent({ dueReviewCount: 15, streakDays: 3 });
  assert.ok(payload.title.includes("15 語"));
  assert.ok(payload.title.includes("忘却曲線"));
});

test("通知メッセージ生成 (ストリーク維持のメッセージ)", () => {
  const payload = notif.buildReminderContent({ dueReviewCount: 0, streakDays: 7 });
  assert.ok(payload.title.includes("7 日目"));
  assert.ok(payload.title.includes("連続学習"));
});

test("isNotificationActive の判定", () => {
  global.localStorage.clear();
  // Notification 未定義
  assert.strictEqual(notif.isNotificationActive(), false);

  // Notification API モック
  global.Notification = { permission: "default" };
  assert.strictEqual(notif.isNotificationActive(), false);

  global.Notification.permission = "granted";
  assert.strictEqual(notif.isNotificationActive(), false); // enabled is false

  notif.saveConfig({ enabled: true });
  assert.strictEqual(notif.isNotificationActive(), true);

  global.Notification.permission = "denied";
  assert.strictEqual(notif.isNotificationActive(), false);
});

console.log(`\n${passed}/7 passed`);
