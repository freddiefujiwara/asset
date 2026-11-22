import { toNumber } from "./parse";
import { assetAmountYen, assetDisplayName } from "./family";

/**
 * 実質地域配分: 保有銘柄を「実質的にどの地域の資産か」で読み替えて
 * 集計する。指数ファンドは指数の国別構成比（重み）で按分する
 * ルックスルー概算で、重みは asset-gas が region-weights.csv を
 * 正本として API の weights キーで返す（月次バッチで見直し）。
 * API から重みが取れない場合は FALLBACK_REGION_WEIGHTS を使う。
 */

export const REGION_BUCKETS = [
  { key: "japan", label: "日本", color: "#38bdf8" },
  { key: "us", label: "米国", color: "#818cf8" },
  { key: "developed_other", label: "その他先進国", color: "#34d399" },
  { key: "emerging", label: "新興国", color: "#f59e0b" },
  { key: "other", label: "その他・未分類", color: "#f87171" },
];

export const REGION_WEIGHT_SET_NAMES = ["acwi", "acwi_ex_japan", "developed", "emerging"];

/**
 * フォールバック初期値（asset-gas 側のシードと同値）。
 * MSCI ACWI / MSCI World ファクトシート（2026-10-30 時点）の
 * 国別構成から導出: ACWI は米国 64.63・日本 5.08、新興国比率
 * 11.19 は2つのファクトシートから逆算した先進国比率の残差。
 * developed は MSCI World（除く日本）を 100 に正規化したもの。
 * acwi_ex_japan は acwi から日本を除いて 100 に正規化したもの
 * （米国 68.09・その他先進国 20.12・新興国 11.79）。
 */
export const FALLBACK_REGION_WEIGHTS = {
  acwi: { japan: 5.08, us: 64.63, developed_other: 19.1, emerging: 11.19, other: 0, effectiveDate: "2026-10-30" },
  acwi_ex_japan: { japan: 0, us: 68.09, developed_other: 20.12, emerging: 11.79, other: 0, effectiveDate: "2026-10-30" },
  developed: { japan: 0, us: 77.19, developed_other: 22.81, emerging: 0, other: 0, effectiveDate: "2026-10-30" },
  emerging: { japan: 0, us: 0, developed_other: 0, emerging: 100, other: 0, effectiveDate: "2026-10-30" },
};

const HOLDING_CATEGORIES = ["cashLike", "stocks", "funds", "pensions", "crypto", "points"];

// 重みセットで按分するルール（上から順に最初に当たったものを採用）。
// 新興国を全世界より先に見るのは「新興国株式」を含む名称の誤判定を
// 防ぐため。先進国は「先進国株式」等に限定し、先進国債券・リートを
// 巻き込まない。mustMatch を持つルールは patterns のいずれかに加えて
// mustMatch の全てに当たった場合だけ採用する（全世界株式（除く日本）
// は日本を 0 にした専用セットへ振るため、汎用の acwi より先に置く）。
const WORLD_PATTERNS = [/オールカントリー/, /オール・カントリー/, /全世界株式/, /全世界株/, /ACWI/i];
const WEIGHTED_RULES = [
  { set: "emerging", patterns: [/新興国株式/, /新興国株/, /エマージング/] },
  { set: "acwi_ex_japan", patterns: WORLD_PATTERNS, mustMatch: [/除く日本/] },
  { set: "acwi", patterns: WORLD_PATTERNS },
  { set: "developed", patterns: [/先進国株式/, /先進国株/, /コクサイ/, /ワールド株式/, /MSCI\s*World/i] },
];

// 単一バケットへ寄せるルール。
const FIXED_RULES = [
  { bucket: "other", patterns: [/暗号/, /仮想通貨/, /ビットコイン/, /イーサリアム/, /BTC/i] },
  { bucket: "us", patterns: [/米国/, /全米/, /アメリカ/, /S&P/i, /Ｓ＆Ｐ/, /NASDAQ/i, /ナスダック/, /US株式/] },
  { bucket: "japan", patterns: [/日本株式/, /日本株/, /国内株式/, /TOPIX/i, /トピックス/, /日経/] },
];

const FOREIGN_CURRENCY_PATTERNS = [/外貨/, /米ドル/, /ドル建て/, /USD/i];

/**
 * 銘柄名とカテゴリから地域の読み替えを決める。
 * @returns {{kind:"fixed", bucket:string} | {kind:"weighted", set:string} | null}
 *   null は未分類（その他・未分類バケットに入り、内訳に残る）。
 */
export function classifyRegion(name, categoryKey) {
  let text;
  try {
    text = String(name ?? "");
  } catch {
    // Unstringifiable names carry no classification signal.
    text = "";
  }

  if (categoryKey === "cashLike") {
    // 円の現金・預金は日本。外貨預金だけは通貨で寄せる。
    return FOREIGN_CURRENCY_PATTERNS.some((pattern) => pattern.test(text))
      ? { kind: "fixed", bucket: "us" }
      : { kind: "fixed", bucket: "japan" };
  }
  if (categoryKey === "points") {
    return { kind: "fixed", bucket: "japan" };
  }

  for (const rule of WEIGHTED_RULES) {
    if (!rule.patterns.some((pattern) => pattern.test(text))) {
      continue;
    }
    if (rule.mustMatch && !rule.mustMatch.every((pattern) => pattern.test(text))) {
      continue;
    }
    return { kind: "weighted", set: rule.set };
  }
  for (const rule of FIXED_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return { kind: "fixed", bucket: rule.bucket };
    }
  }

  // 個別株は日本株を前提に日本へ寄せる。投信・年金は名称から
  // 読み替えられないものを未分類として残す（新しい銘柄に
  // 気付けるようにするため）。
  if (categoryKey === "stocks") {
    return { kind: "fixed", bucket: "japan" };
  }
  return null;
}

function resolveWeightSet(weights, setName) {
  const candidate = weights?.[setName];
  if (!candidate || typeof candidate !== "object") {
    return FALLBACK_REGION_WEIGHTS[setName];
  }
  const resolved = {
    effectiveDate: candidate.effectiveDate || FALLBACK_REGION_WEIGHTS[setName].effectiveDate,
  };
  for (const { key } of REGION_BUCKETS) {
    resolved[key] = toNumber(candidate[key]);
  }
  return resolved;
}

/**
 * 保有明細全体を地域バケットへ集計する。金額は表示時点の保有額を
 * そのまま使い、重みだけが月次更新に追随する。
 * @param {object} holdings normalize 済みの holdings
 * @param {object|null} weights normalize 済みの weights（null なら全てフォールバック）
 */
export function buildRegionAllocation(holdings, weights) {
  const sets = {};
  for (const setName of REGION_WEIGHT_SET_NAMES) {
    sets[setName] = resolveWeightSet(weights, setName);
  }

  const totals = { japan: 0, us: 0, developed_other: 0, emerging: 0, other: 0 };
  const unclassified = [];
  let totalYen = 0;
  let effectiveDate = "";

  for (const categoryKey of HOLDING_CATEGORIES) {
    const rows = Array.isArray(holdings?.[categoryKey]) ? holdings[categoryKey] : [];
    for (const row of rows) {
      const amountYen = assetAmountYen(row);
      if (!(amountYen > 0)) {
        continue;
      }
      totalYen += amountYen;
      const name = assetDisplayName(row);
      const classification = classifyRegion(name, categoryKey);
      if (!classification) {
        totals.other += amountYen;
        unclassified.push({ name, categoryKey, amountYen });
        continue;
      }
      if (classification.kind === "fixed") {
        totals[classification.bucket] += amountYen;
        continue;
      }
      const set = sets[classification.set];
      if (set.effectiveDate > effectiveDate) {
        effectiveDate = set.effectiveDate;
      }
      for (const { key } of REGION_BUCKETS) {
        totals[key] += (amountYen * set[key]) / 100;
      }
    }
  }

  unclassified.sort((a, b) => b.amountYen - a.amountYen);

  return {
    buckets: REGION_BUCKETS.map((bucket) => ({
      ...bucket,
      amountYen: Math.round(totals[bucket.key]),
      ratioPct: totalYen > 0 ? (totals[bucket.key] / totalYen) * 100 : 0,
    })),
    totalYen,
    unclassified,
    effectiveDate,
  };
}
