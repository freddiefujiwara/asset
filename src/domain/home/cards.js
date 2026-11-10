import { getExpenseType } from "../cashFlow/classifiers";
import { getMonthKey } from "../cashFlow/shared";

/**
 * ホーム画面（今月の判断）のアクションカード判定ロジック。
 * すべて既存データ（mfcf明細・スナップショット）だけから計算する。
 * カードの状態は "ok"（基準どおり）| "attention"（要確認）の2値で、
 * 売買などの指示は出さない。
 */

export const CARD_STATUS = { OK: "ok", ATTENTION: "attention" };

/** 投資の基準額（月額）。FIREシミュレータの初期値と同じ。 */
export const MONTHLY_INVESTMENT_STANDARD_YEN = 423000;
/** 投資カード: 基準の -5% 未満で要確認（超過は要確認にしない）。 */
export const INVESTMENT_TOLERANCE_RATE = 0.05;
/** 生活費カード: 12か月平均の +10% 超で要確認。 */
export const LIVING_COST_ATTENTION_RATE = 1.1;
/**
 * 鮮度カード: 明細の最新日がこの日数以上前なら要確認。
 * 日単位の粒度では「2日前」は48時間未満の可能性が残るため、
 * 48時間を確実に超える「3日以上前」を要確認のラインにする。
 */
export const FRESHNESS_STALE_DAYS = 3;

/**
 * 投資実行とみなす明細の名称キーワード。
 * 実データ（2025-11〜2026-10）で確認した積立の引き落とし名称:
 * - 「ラクテンショウケンカブシキガイシャ (投信積立代金)」楽天証券の銀行引落積立
 * - 「楽天証券投信積立0.5%~」楽天カード積立
 * - 「コクミンネンキンキキンレンゴウカイ(カクテイキヨシユツネンキン)」iDeCo掛金
 * いずれも is_transfer=true の振替として記録され、支出分類からは除外される。
 * 給与天引き分など明細に現れない投資は数えられない（保守的な定義）。
 */
const INVESTMENT_NAME_KEYWORDS = ["投信積立", "確定拠出年金", "カクテイキヨシユツネンキン"];

export function formatMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonthKey(monthKey, delta) {
  const [year, month] = String(monthKey).split("-").map(Number);
  const shifted = new Date(year, month - 1 + delta, 1);
  return formatMonthKey(shifted);
}

export function isInvestmentExecution(item) {
  if (!item || Number(item.amount) >= 0) return false;
  const name = String(item.name ?? "");
  return INVESTMENT_NAME_KEYWORDS.some((keyword) => name.includes(keyword));
}

export function sumInvestmentExecutions(cashFlow, monthKey) {
  return (cashFlow ?? [])
    .filter((item) => getMonthKey(item) === monthKey && isInvestmentExecution(item))
    .reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);
}

/**
 * 投資カード: 判定は先月（確定分）。当月は進捗表示のみ。
 */
export function buildInvestmentCard(cashFlow, now = new Date()) {
  const currentMonth = formatMonthKey(now);
  const lastMonth = shiftMonthKey(currentMonth, -1);
  const lastAmount = sumInvestmentExecutions(cashFlow, lastMonth);
  const standard = MONTHLY_INVESTMENT_STANDARD_YEN;
  const status =
    lastAmount >= standard * (1 - INVESTMENT_TOLERANCE_RATE)
      ? CARD_STATUS.OK
      : CARD_STATUS.ATTENTION;
  return {
    status,
    standardYen: standard,
    lastMonth: { month: lastMonth, amountYen: lastAmount },
    currentMonth: { month: currentMonth, amountYen: sumInvestmentExecutions(cashFlow, currentMonth) },
  };
}

function livingCostOfMonth(cashFlow, monthKey) {
  let total = 0;
  const byLargeCategory = {};
  (cashFlow ?? []).forEach((item) => {
    if (getMonthKey(item) !== monthKey) return;
    if (item.isTransfer || Number(item.amount) >= 0) return;
    // 生活費 = 固定費 + 変動費。特別な支出・カード引き落とし等は
    // 既存分類（getExpenseType）の "exclude" として常に除く。
    if (getExpenseType(item) === "exclude") return;
    const absAmount = Math.abs(Number(item.amount));
    total += absAmount;
    const largeCategory = String(item.category ?? "未分類").split("/")[0] || "未分類";
    byLargeCategory[largeCategory] = (byLargeCategory[largeCategory] ?? 0) + absAmount;
  });
  return { total, byLargeCategory };
}

/**
 * 生活費カード: 先月の生活費 vs 直近12か月平均（当月除く）。
 * 平均の窓と割り方は FIRE画面の12か月集計（getPast12MonthSummary）と同じ。
 */
export function buildLivingCostCard(cashFlow, now = new Date()) {
  const currentMonth = formatMonthKey(now);
  const lastMonth = shiftMonthKey(currentMonth, -1);
  const last = livingCostOfMonth(cashFlow, lastMonth);

  let windowTotal = 0;
  const windowByCategory = {};
  for (let i = 1; i <= 12; i++) {
    const monthResult = livingCostOfMonth(cashFlow, shiftMonthKey(currentMonth, -i));
    windowTotal += monthResult.total;
    Object.entries(monthResult.byLargeCategory).forEach(([label, value]) => {
      windowByCategory[label] = (windowByCategory[label] ?? 0) + value;
    });
  }
  const average = windowTotal / 12;

  const labels = new Set([...Object.keys(windowByCategory), ...Object.keys(last.byLargeCategory)]);
  const topCategories = Array.from(labels)
    .map((label) => {
      const lastMonthYen = last.byLargeCategory[label] ?? 0;
      const averageYen = (windowByCategory[label] ?? 0) / 12;
      return {
        label,
        lastMonthYen,
        averageYen: Math.round(averageYen),
        excessYen: Math.round(lastMonthYen - averageYen),
      };
    })
    .filter((category) => category.excessYen > 0)
    .sort((a, b) => b.excessYen - a.excessYen)
    .slice(0, 3);

  const status =
    average > 0 && last.total > average * LIVING_COST_ATTENTION_RATE
      ? CARD_STATUS.ATTENTION
      : CARD_STATUS.OK;

  return {
    status,
    lastMonth: { month: lastMonth, amountYen: last.total },
    averageYen: Math.round(average),
    topCategories,
  };
}

/**
 * 特別支出の明細（カテゴリが「特別な支出」で始まる出金）。
 * getExpenseType で "exclude" 扱いとなり、生活費には含まれない。
 */
export function listSpecialExpenses(cashFlow, monthKey) {
  return (cashFlow ?? [])
    .filter(
      (item) =>
        getMonthKey(item) === monthKey &&
        !item.isTransfer &&
        Number(item.amount) < 0 &&
        String(item.category ?? "").startsWith("特別な支出"),
    )
    .map((item) => ({
      date: item.date,
      name: item.name,
      category: item.category,
      amountYen: Math.abs(Number(item.amount)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * 特別支出カード: 先月・今月分を金額と内容で出す情報カード（判定なし）。
 */
export function buildSpecialExpenseCard(cashFlow, now = new Date()) {
  const currentMonth = formatMonthKey(now);
  const build = (month) => {
    const items = listSpecialExpenses(cashFlow, month);
    return { month, items, totalYen: items.reduce((sum, item) => sum + item.amountYen, 0) };
  };
  return {
    lastMonth: build(shiftMonthKey(currentMonth, -1)),
    currentMonth: build(currentMonth),
  };
}

/**
 * 節目カードの定数リスト（暦で決まる資産まわりの節目だけ）。
 * start/end は毎年繰り返す月日。表示は開始30日前から終了日まで。
 */
export const MILESTONE_DEFINITIONS = [
  {
    id: "ideco-increase-application",
    label: "iDeCo増額の申請期間",
    description: "楽天証券 e-iDeCo の掛金増額申請ができる期間です。",
    startMonth: 12,
    startDay: 1,
    endMonth: 12,
    endDay: 24,
  },
];

export function buildMilestoneCard(now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const items = [];
  MILESTONE_DEFINITIONS.forEach((definition) => {
    for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
      const start = new Date(year, definition.startMonth - 1, definition.startDay);
      const end = new Date(year, definition.endMonth - 1, definition.endDay, 23, 59, 59);
      const showFrom = new Date(start);
      showFrom.setDate(showFrom.getDate() - 30);
      if (startOfToday >= showFrom && now <= end) {
        const active = startOfToday >= start;
        items.push({
          id: definition.id,
          label: definition.label,
          description: definition.description,
          state: active ? "active" : "upcoming",
          daysUntilStart: active
            ? 0
            : Math.round((start - startOfToday) / 86400000),
          periodLabel: `${definition.startMonth}月${definition.startDay}日〜${definition.endMonth}月${definition.endDay}日`,
        });
        break;
      }
    }
  });
  return {
    visible: items.length > 0,
    status: items.some((item) => item.state === "active")
      ? CARD_STATUS.ATTENTION
      : CARD_STATUS.OK,
    items,
  };
}

/**
 * データ鮮度カード。
 * APIに「最終取り込み日時」が無いため、明細の最新日で代用する。
 * フィードは毎朝再生成されるが、金融機関側の投稿遅延で最新日は
 * 1〜2日前になるのが通常。最新日が3日以上前なら48時間を確実に
 * 超えているため、取り込みが止まっている目安として要確認にする。
 */
export function buildFreshnessCard(cashFlow, now = new Date()) {
  let latestDate = "";
  (cashFlow ?? []).forEach((item) => {
    if (item.date && item.date > latestDate) latestDate = item.date;
  });
  if (!latestDate) {
    return { status: CARD_STATUS.ATTENTION, latestDate: "", ageDays: null };
  }
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const latest = new Date(`${latestDate}T00:00:00`);
  const ageDays = Math.round((startOfToday - latest) / 86400000);
  return {
    status: ageDays >= FRESHNESS_STALE_DAYS ? CARD_STATUS.ATTENTION : CARD_STATUS.OK,
    latestDate,
    ageDays,
  };
}

/**
 * ブロックC: 先月からの変化（月次スナップショット）。
 * スナップショットが2か月分未満なら available=false（「来月から表示されます」）。
 */
export function buildMonthlyChanges(snapshots, universityFundYen) {
  const rows = Array.isArray(snapshots) ? snapshots : [];
  if (rows.length < 2) {
    return { available: false, month: rows[0]?.month ?? "", previousMonth: "", rows: [] };
  }
  const previous = rows[rows.length - 2];
  const current = rows[rows.length - 1];
  const definitions = [
    { key: "netAssets", label: "純資産", pick: (row) => row.netAssetsYen },
    {
      key: "fireTargetAssets",
      label: "FIRE対象資産（大学資金を除く）",
      pick: (row) => row.totalAssetsYen - universityFundYen,
    },
    {
      key: "livingCostAverage",
      label: "生活費（12か月平均）",
      pick: (row) => row.livingCost12mAvgYen,
    },
  ];
  return {
    available: true,
    month: current.month,
    previousMonth: previous.month,
    rows: definitions.map((definition) => {
      const currentYen = definition.pick(current);
      const previousYen = definition.pick(previous);
      return {
        key: definition.key,
        label: definition.label,
        currentYen,
        previousYen,
        diffYen: currentYen - previousYen,
      };
    }),
  };
}
