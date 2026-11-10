import { generateGrowthTable, calculateFirePortfolio } from "./fire";

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

  // 主指標: サイドFIRE。週3勤務の収入が続く分を、FIRE後の追加支出の
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

  // 補助指標: 完全FIRE。FIRE計算画面の現在の表示と同じ前提・同じ資産範囲
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
    universityFundYen,
    fireTargetAssetsYen,
    sideFireAnnualIncomeYen,
    side,
    full,
  };
}

/**
 * スナップショットから到達率の月次推移を作る。
 * 必要資産は「現在の前提で計算した値」で固定した近似（スナップショットには
 * 当時の到達見込みが保存されていないため、見込み時期の推移は出せない）。
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
