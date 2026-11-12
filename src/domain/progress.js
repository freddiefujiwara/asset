import { generateGrowthTable, calculateFirePortfolio, performFireSimulation } from "./fire";
import { calculateAge, USER_BIRTH_DATE } from "./family";

/**
 * FIRE進捗画面のドメインロジック。
 * 入力なし・見るだけの画面用に、既存のFIRE計算エンジン（generateGrowthTable）を
 * 既定の前提で回し、到達率・差額・到達見込みだけを取り出す。
 * 前提を変えた試算はFIRE計算画面の役割で、ここでは行わない。
 */

/** 娘の大学資金（設定値）。FIRE対象資産 = 総資産 − 大学資金。 */
export const UNIVERSITY_FUND_YEN = 10450000;
/** サイドFIREの前提: 週3勤務で続く年収。 */
export const SIDE_FIRE_ANNUAL_INCOME_YEN = 4000000;

/** 年表マーカー（月は YYYY-MM）。 */
export const PROGRESS_MILESTONES = [
  { id: "age-50", label: "50歳", monthKey: "2029-09" },
  { id: "daughter-independence", label: "娘の独立", monthKey: "2037-04" },
  { id: "mortgage-payoff", label: "住宅ローン完済", monthKey: "2042-05" },
];

/**
 * 主指標の振り分け。
 * サイドFIREが未到達の間はサイドFIREを主指標にする。サイドFIREが到達可能な
 * 水準（alreadyReached）に達したら、未達成の完全FIREを主指標に昇格させ、
 * サイドFIREは達成済みとして補助に回す。両方とも到達可能な水準なら
 * focus="both" で、主指標は置かない。
 * 「達成済み」は alreadyReached（到達まで0か月）で判定し、到達見込みが
 * 立たない（reached=false）場合は未達成として扱う。
 *
 * @param {{side?: object, full?: object}} runs buildFireProgress の各指標の結果
 * @returns {{focus: "side"|"full"|"both", primaryKind: string|null,
 *   secondaryKind: string|null, sideAchieved: boolean, fullAchieved: boolean}}
 */
export function selectProgressFocus({ side, full } = {}) {
  const sideAchieved = Boolean(side?.alreadyReached);
  const fullAchieved = Boolean(full?.alreadyReached);
  if (sideAchieved && fullAchieved) {
    return {
      focus: "both",
      primaryKind: null,
      secondaryKind: null,
      sideAchieved,
      fullAchieved,
    };
  }
  if (sideAchieved) {
    return {
      focus: "full",
      primaryKind: "full",
      secondaryKind: "side",
      sideAchieved,
      fullAchieved,
    };
  }
  return {
    focus: "side",
    primaryKind: "side",
    secondaryKind: "full",
    sideAchieved,
    fullAchieved,
  };
}

export function computeFireTargetAssetsYen(portfolio, universityFundYen = UNIVERSITY_FUND_YEN) {
  const totalAssetsYen = Number(portfolio?.totals?.assetsYen ?? 0);
  return Math.max(0, totalAssetsYen - universityFundYen);
}

function summarizeRun(params, currentAssetsYen) {
  const { table, fireReachedMonth } = generateGrowthTable(params);
  const reached = fireReachedMonth >= 0 && fireReachedMonth < 1200;
  if (!reached) {
    return {
      reached: false,
      alreadyReached: false,
      monthsToReach: null,
      requiredAssetsYen: null,
      progressRate: null,
      gapYen: null,
    };
  }
  // 到達月が0（今すぐ到達可能）のとき、到達月の資産額には退職金の一括注入が
  // 含まれて必要資産が膨らむため、必要資産は現在の資産額とみなす（到達率100%）。
  if (fireReachedMonth === 0) {
    return {
      reached: true,
      alreadyReached: true,
      monthsToReach: 0,
      requiredAssetsYen: currentAssetsYen,
      progressRate: 1,
      gapYen: 0,
    };
  }
  const firePoint = table.find((row) => row.month === fireReachedMonth);
  const requiredAssetsYen = Math.round(firePoint?.assets ?? 0);
  return {
    reached: true,
    alreadyReached: false,
    monthsToReach: fireReachedMonth,
    requiredAssetsYen,
    progressRate: requiredAssetsYen > 0 ? currentAssetsYen / requiredAssetsYen : null,
    gapYen: requiredAssetsYen - currentAssetsYen,
  };
}

/**
 * @param {object} args
 * @param {object} args.portfolio 正規化済みポートフォリオ
 * @param {object} args.baseParams FIRE計算画面と同じ既定の前提
 *   （initialAssets / riskAssets はここで差し替えるので含めなくてよい）
 * @param {number} [args.universityFundYen]
 * @param {number} [args.sideFireAnnualIncomeYen]
 */
export function buildFireProgress({
  portfolio,
  baseParams,
  universityFundYen = UNIVERSITY_FUND_YEN,
  sideFireAnnualIncomeYen = SIDE_FIRE_ANNUAL_INCOME_YEN,
}) {
  const totalAssetsYen = Number(portfolio?.totals?.assetsYen ?? 0);
  const fireTargetAssetsYen = computeFireTargetAssetsYen(portfolio, universityFundYen);
  const firePortfolio = calculateFirePortfolio(portfolio);
  // リスク資産の内訳は従来のFIRE計算（本人・妻の保有分）と同じ集計を使う。
  // FIRE対象資産を超える場合は対象資産を上限にする。
  const riskAssetsYen = Math.min(firePortfolio.riskAssetsYen, fireTargetAssetsYen);

  const sharedParams = {
    ...baseParams,
    riskAssets: riskAssetsYen,
  };

  // サイドFIREの計算。週3勤務の収入が続く分を、FIRE後の追加支出の
  // マイナスとしてエンジンに渡す（エンジンはFIRE後に定期収入が
  // ゼロになる前提のため、継続収入は支出側で相殺するのが既存の枠組みに合う）。
  const sideFireMonthlyIncomeYen = Math.round(sideFireAnnualIncomeYen / 12);
  const side = summarizeRun(
    {
      ...sharedParams,
      initialAssets: fireTargetAssetsYen,
      postFireExtraExpense:
        Number(baseParams?.postFireExtraExpense ?? 0) - sideFireMonthlyIncomeYen,
    },
    fireTargetAssetsYen,
  );

  // 完全FIREの計算。FIRE計算画面の現在の表示と同じ前提・同じ資産範囲
  // （本人・妻の合計、大学資金は差し引かない）で計算する。
  const full = summarizeRun(
    {
      ...baseParams,
      initialAssets: firePortfolio.totalAssetsYen,
      riskAssets: firePortfolio.riskAssetsYen,
    },
    firePortfolio.totalAssetsYen,
  );

  return {
    totalAssetsYen,
    // 完全FIREの対象資産（本人・妻の保有銘柄合計）。総資産（totals）とは
    // 集計範囲の違いでわずかに異なる場合がある。
    fullAssetsYen: firePortfolio.totalAssetsYen,
    universityFundYen,
    fireTargetAssetsYen,
    sideFireAnnualIncomeYen,
    side,
    full,
    focus: selectProgressFocus({ side, full }),
  };
}

/**
 * スナップショットから到達率の月次推移を作る。
 * 必要資産は「現在の前提で計算した値」で固定した近似。
 * 到達見込み時期の推移は buildProjectionTrend が担う。
 * 行が1件だけの間は hasTrend=false。
 */
export function buildProgressTrend(snapshots, { universityFundYen, requiredAssetsYen }) {
  const rows = Array.isArray(snapshots) ? snapshots : [];
  const points = rows.map((row) => {
    const targetAssetsYen = Math.max(0, row.totalAssetsYen - universityFundYen);
    return {
      month: row.month,
      fireTargetAssetsYen: targetAssetsYen,
      progressRate:
        requiredAssetsYen > 0 ? targetAssetsYen / requiredAssetsYen : null,
    };
  });
  return { hasTrend: points.length >= 2, points };
}

/** "YYYY-MM" を { year, month } に分解する。不正な形式は null。 */
function parseMonthKey(monthKey) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey ?? ""));
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

function monthKeyToIndex(monthKey) {
  const parsed = parseMonthKey(monthKey);
  /* v8 ignore next -- defensive: callers only pass months that passed parseMonthKey */
  if (!parsed) return null;
  return parsed.year * 12 + (parsed.month - 1);
}

function indexToMonthKey(index) {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function addMonthsToMonthKey(monthKey, months) {
  const index = monthKeyToIndex(monthKey);
  /* v8 ignore next -- defensive: callers only pass months that passed parseMonthKey */
  if (index == null) return null;
  return indexToMonthKey(index + months);
}

/**
 * スナップショットの月末時点の年齢。
 * 現在の年齢をそのまま使うと過去の時点ほど到達までの猶予を短く見積もるため、
 * 生年月日からその月の年齢を逆算する。
 */
export function ageAtSnapshotMonth(monthKey) {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return null;
  // 月末日を基準にする（節目の年齢表示と同じ流儀）。
  return calculateAge(USER_BIRTH_DATE, new Date(parsed.year, parsed.month, 0));
}

/**
 * エンジンを1回回して到達までの月数だけを取り出す。
 * summarizeRun と同じ到達判定（0か月は到達可能な水準として扱う）。
 * 月次テーブルの記録を伴わない performFireSimulation を使うため軽い。
 */
function estimateReach(params) {
  const { fireReachedMonth } = performFireSimulation(params);
  const reached = fireReachedMonth >= 0 && fireReachedMonth < 1200;
  if (!reached) {
    return { reached: false, alreadyReached: false, monthsToReach: null };
  }
  return {
    reached: true,
    alreadyReached: fireReachedMonth === 0,
    monthsToReach: fireReachedMonth,
  };
}

/**
 * スナップショットの月に時点を差し替えたエンジン入力を作る。
 * 差し替えるのは「その月時点の値」だけ（資産・リスク資産・年齢・生活費・収入）で、
 * 利回り・税率・月額投資・ローン完済月などの前提は現在の設定（baseParams）のまま。
 * 生活費・収入はスナップショットの12か月平均を使い、欠けている場合は現在の値に倒す。
 */
function buildRetrospectiveParams({
  snapshot,
  baseParams,
  initialAssetsYen,
  riskAssetsYen,
  postFireExtraExpenseAdjustmentYen = 0,
}) {
  return {
    ...baseParams,
    initialAssets: initialAssetsYen,
    riskAssets: riskAssetsYen,
    /* v8 ignore next -- defensive: snapshot months are pre-filtered by parseMonthKey */
    currentAge: ageAtSnapshotMonth(snapshot.month) ?? baseParams.currentAge,
    monthlyExpense:
      snapshot.livingCost12mAvgYen > 0
        ? snapshot.livingCost12mAvgYen
        : baseParams.monthlyExpense,
    monthlyIncome:
      snapshot.income12mAvgYen > 0
        ? snapshot.income12mAvgYen
        : baseParams.monthlyIncome,
    postFireExtraExpense:
      Number(baseParams?.postFireExtraExpense ?? 0) + postFireExtraExpenseAdjustmentYen,
  };
}

function projectAtSnapshot(snapshot, { baseParams, universityFundYen, sideFireAnnualIncomeYen }) {
  const totalAssetsYen = Math.max(0, Number(snapshot?.totalAssetsYen ?? 0));
  const snapshotRiskAssetsYen = Math.max(0, Number(snapshot?.riskAssetsYen ?? 0));
  const fireTargetAssetsYen = Math.max(0, totalAssetsYen - universityFundYen);

  const toProjection = (reach) => ({
    ...reach,
    // 到達可能な水準の月は、その月自体を到達見込みとする。
    projectedMonth: reach.reached
      ? addMonthsToMonthKey(snapshot.month, reach.monthsToReach)
      : null,
  });

  // サイドFIRE（buildFireProgress と同じ資産範囲・継続収入の相殺）。
  const side = toProjection(
    estimateReach(
      buildRetrospectiveParams({
        snapshot,
        baseParams,
        initialAssetsYen: fireTargetAssetsYen,
        riskAssetsYen: Math.min(snapshotRiskAssetsYen, fireTargetAssetsYen),
        postFireExtraExpenseAdjustmentYen: -Math.round(sideFireAnnualIncomeYen / 12),
      }),
    ),
  );

  // 完全FIRE（大学資金を差し引かない資産範囲）。
  const full = toProjection(
    estimateReach(
      buildRetrospectiveParams({
        snapshot,
        baseParams,
        initialAssetsYen: totalAssetsYen,
        riskAssetsYen: Math.min(snapshotRiskAssetsYen, totalAssetsYen),
      }),
    ),
  );

  return { month: snapshot.month, fireTargetAssetsYen, side, full };
}

/**
 * 先月比の「見込みが何か月近づいたか」。
 * 到達見込みの絶対月どうしの差で数えるため、単に1か月経っただけでは
 * ゼロにもならず、到達までの月数の減りから経過分を引いた値になる。
 * 前月がすでに到達可能な水準だった場合や、どちらかが見込みなしの場合は null。
 */
function projectionDeltaMonths(previous, latest) {
  /* v8 ignore next -- defensive: only called with both points present */
  if (!previous || !latest) return null;
  if (previous.alreadyReached) return null;
  if (!previous.projectedMonth || !latest.projectedMonth) return null;
  return monthKeyToIndex(previous.projectedMonth) - monthKeyToIndex(latest.projectedMonth);
}

/**
 * スナップショット各月の到達見込み時期の推移を作る。
 * スナップショットには当時の見込みが保存されていないため、各月の資産・収支を
 * 現在の前提でエンジンに差し替えて振り返り計算する（当時の表示の再現ではない）。
 * 行が1件だけの間は hasTrend=false で、先月比（delta）も出さない。
 */
export function buildProjectionTrend(
  snapshots,
  {
    baseParams,
    universityFundYen = UNIVERSITY_FUND_YEN,
    sideFireAnnualIncomeYen = SIDE_FIRE_ANNUAL_INCOME_YEN,
  } = {},
) {
  const rows = (Array.isArray(snapshots) ? snapshots : [])
    .filter((row) => parseMonthKey(row?.month))
    .sort((a, b) => a.month.localeCompare(b.month));
  const points = rows.map((row) =>
    projectAtSnapshot(row, { baseParams, universityFundYen, sideFireAnnualIncomeYen }),
  );
  const hasTrend = points.length >= 2;
  const previous = points[points.length - 2];
  const latest = points[points.length - 1];
  return {
    hasTrend,
    points,
    delta: {
      side: hasTrend ? projectionDeltaMonths(previous?.side, latest?.side) : null,
      full: hasTrend ? projectionDeltaMonths(previous?.full, latest?.full) : null,
    },
  };
}
