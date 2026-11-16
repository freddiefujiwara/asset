/**
 * 「期限のあるアクション」の判定ロジック。
 * 定義データは @/config/deadlines（静的設定）から渡され、ここでは
 * 「今日の時点で表示すべき項目か」「あと何日か」「緊急度順の並び」だけを決める。
 * 期限と事実の提示までで、行うべき操作の指示は出さない。
 */

/** 表示を始めるのは、開始日（または締切日）のこの日数前から。 */
export const DEADLINE_DISPLAY_LEAD_DAYS = 45;

const DAY_MS = 86400000;

/**
 * "YYYY-MM-DD" をローカル日付（0時）に変換する。不正な形式・存在しない日付は null。
 */
function parseDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  // 存在しない日付（2月30日など）は翌月へ繰り上がるため、文字列に戻して一致を見る。
  const roundTrip = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  if (roundTrip !== match[0]) return null;
  return date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

/**
 * 1件の定義を表示項目に変換する。表示窓の外・不正な定義は null。
 * phase:
 * - "upcoming": 開始（または締切）がまだ先。countdown は開始日／締切日までの日数。
 * - "active": 期間中（window）または対応可能になった（available-from）。
 *   window の countdown は締切までの日数、available-from は 0。
 */
function toDeadlineItem(definition, today) {
  if (!definition || typeof definition !== "object") return null;
  const { id, label, note = "", kind } = definition;
  if (!id || !label) return null;

  if (kind === "window") {
    const start = parseDateKey(definition.startDate);
    const end = parseDateKey(definition.endDate);
    if (!start || !end || end < start) return null;
    const daysUntilStart = daysBetween(today, start);
    const daysUntilEnd = daysBetween(today, end);
    if (daysUntilEnd < 0) return null;
    if (daysUntilStart > 0) {
      if (daysUntilStart > DEADLINE_DISPLAY_LEAD_DAYS) return null;
      return {
        id, label, note, kind,
        phase: "upcoming",
        startDate: definition.startDate,
        endDate: definition.endDate,
        daysUntilStart,
        daysUntilEnd,
        countdownDays: daysUntilStart,
        targetDate: definition.startDate,
      };
    }
    return {
      id, label, note, kind,
      phase: "active",
      startDate: definition.startDate,
      endDate: definition.endDate,
      daysUntilStart: 0,
      daysUntilEnd,
      countdownDays: daysUntilEnd,
      targetDate: definition.endDate,
    };
  }

  if (kind === "deadline") {
    const end = parseDateKey(definition.endDate);
    if (!end) return null;
    const daysUntilEnd = daysBetween(today, end);
    if (daysUntilEnd < 0 || daysUntilEnd > DEADLINE_DISPLAY_LEAD_DAYS) return null;
    return {
      id, label, note, kind,
      phase: "upcoming",
      startDate: null,
      endDate: definition.endDate,
      daysUntilStart: null,
      daysUntilEnd,
      countdownDays: daysUntilEnd,
      targetDate: definition.endDate,
    };
  }

  if (kind === "available-from") {
    const start = parseDateKey(definition.startDate);
    if (!start) return null;
    const daysUntilStart = daysBetween(today, start);
    if (daysUntilStart > DEADLINE_DISPLAY_LEAD_DAYS) return null;
    if (daysUntilStart > 0) {
      return {
        id, label, note, kind,
        phase: "upcoming",
        startDate: definition.startDate,
        endDate: null,
        daysUntilStart,
        daysUntilEnd: null,
        countdownDays: daysUntilStart,
        targetDate: definition.startDate,
      };
    }
    return {
      id, label, note, kind,
      phase: "active",
      startDate: definition.startDate,
      endDate: null,
      daysUntilStart: 0,
      daysUntilEnd: null,
      countdownDays: 0,
      targetDate: definition.startDate,
    };
  }

  return null;
}

/**
 * @param {Array} definitions @/config/deadlines の定義リスト
 * @param {Date} [now]
 * @returns {Array} 緊急度順（countdown の小さい順、同点は id 順）の表示項目
 */
export function buildDeadlineItems(definitions, now = new Date()) {
  const today = startOfDay(now);
  return (Array.isArray(definitions) ? definitions : [])
    .map((definition) => toDeadlineItem(definition, today))
    .filter((item) => item !== null)
    .sort((a, b) => a.countdownDays - b.countdownDays || a.id.localeCompare(b.id));
}
