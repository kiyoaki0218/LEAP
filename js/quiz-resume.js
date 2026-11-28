/* ============================================================
   中断したクイズの保存データ（LEAP_QUIZ_RESUME_V1）を扱う純粋ロジック
   ------------------------------------------------------------
   DOM に触らないので、ブラウザからも Node のテストからも使える。
   保存先（localStorage 互換オブジェクト）は呼び出し側が渡す。
   ============================================================ */
(function (root) {
  const RESUME_KEY = "LEAP_QUIZ_RESUME_V1";
  const VERSION = 1;

  function normalizeSubject(subject) {
    return subject === "kobun" ? "kobun" : "leap";
  }

  function toNonNegativeInt(value) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function normalizeIds(ids) {
    if (!Array.isArray(ids)) return [];
    return ids
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
  }

  // クイズの現在地から保存用のオブジェクトを作る（型をそろえるだけ）
  function buildPayload(input) {
    const src = input || {};
    return {
      v: VERSION,
      subject: normalizeSubject(src.subject),
      ids: normalizeIds(src.ids),
      index: toNonNegativeInt(src.index),
      style: String(src.style || "normal"),
      label: String(src.label || ""),
      correctCount: toNonNegativeInt(src.correctCount),
      combo: toNonNegativeInt(src.combo),
      maxCombo: toNonNegativeInt(src.maxCombo),
      earnedCoins: toNonNegativeInt(src.earnedCoins),
      earnedExp: toNonNegativeInt(src.earnedExp),
      score: Number(src.score) || 0,
      mistakeIds: normalizeIds(src.mistakeIds),
      isDaily: !!src.isDaily,
      isWeak: !!src.isWeak,
      savedAt: src.savedAt || new Date().toISOString()
    };
  }

  // 形として壊れていないか（subject や「再開できるか」は別判定）
  function isValid(payload) {
    if (!payload || typeof payload !== "object") return false;
    if (payload.v !== VERSION) return false;
    if (!Array.isArray(payload.ids) || payload.ids.length < 2) return false;
    if (!payload.ids.every((id) => Number.isInteger(id) && id > 0)) return false;
    const index = payload.index;
    if (!Number.isInteger(index) || index < 0 || index >= payload.ids.length) return false;
    if (typeof payload.subject !== "string") return false;
    return true;
  }

  // 別のクイズが保存されている状態で、新しいクイズの1問目を表示しただけでは上書きしない
  function canOverwrite(currentIndex) {
    return Number(currentIndex) >= 1;
  }

  // いま見ているゾーンで「つづきから」を出してよいか（古文は対象外）
  function isResumable(payload, subject) {
    if (!isValid(payload)) return false;
    if (payload.subject === "kobun") return false;
    if (payload.subject !== normalizeSubject(subject)) return false;
    return payload.index >= 1;
  }

  // 保存されているのが「いま終えたクイズ」自身か（別のクイズの保存を消さないため）
  function matchesQuiz(payload, subject, ids) {
    if (!payload || !Array.isArray(ids)) return false;
    if (payload.subject !== normalizeSubject(subject)) return false;
    if (!Array.isArray(payload.ids) || payload.ids.length !== ids.length) return false;
    return payload.ids.every((id, i) => id === Number(ids[i]));
  }

  function read(storage) {
    if (!storage) return null;
    try {
      const raw = storage.getItem(RESUME_KEY);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      return isValid(payload) ? payload : null;
    } catch (e) {
      return null;
    }
  }

  function write(storage, payload) {
    if (!storage) return false;
    try {
      storage.setItem(RESUME_KEY, JSON.stringify(payload));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clear(storage) {
    if (!storage) return;
    try { storage.removeItem(RESUME_KEY); } catch (e) {}
  }

  root.LeapQuizResume = {
    RESUME_KEY,
    VERSION,
    buildPayload,
    isValid,
    canOverwrite,
    isResumable,
    matchesQuiz,
    read,
    write,
    clear
  };
})(typeof window !== "undefined" ? window : globalThis);
