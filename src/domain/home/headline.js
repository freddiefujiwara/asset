/**
 * トップページ冒頭の「一行の結論」。
 * 純資産の先月比（月次スナップショットの直近2件）と、ペース判定を返す。
 *
 * ペース判定は完全FIREの到達見込みの先月比（buildProjectionTrend の delta）で
 * 決める: 見込みが近づいた = "improving"、遠のいた = "worsening"、
 * 変わらない = "steady"。見込みの先月比が無い間（スナップショット2件未満など）
 * は pace=null で、純資産の増減という事実だけを出す。
 *
 * スナップショットが2件未満の間は hasComparison=false とし、現在の純資産
 * （ポートフォリオの totals）でフォールバックする。
 */
import { diffRatePct } from "../signed";

export function buildHeadline({
  snapshots,
  currentNetAssetsYen = 0,
  projectionDeltaMonths = null,
} = {}) {
  const rows = (Array.isArray(snapshots) ? [...snapshots] : []).sort((a, b) =>
    String(a?.month ?? "").localeCompare(String(b?.month ?? "")),
  );
  const latest = rows[rows.length - 1];
  const previous = rows[rows.length - 2];

  if (!previous || !latest) {
    return {
      hasComparison: false,
      month: latest?.month ?? "",
      previousMonth: "",
      netAssetsYen: currentNetAssetsYen || latest?.netAssetsYen || 0,
      diffYen: null,
      diffRatePct: null,
      pace: null,
      projectionDeltaMonths: null,
    };
  }

  const pace =
    projectionDeltaMonths == null
      ? null
      : projectionDeltaMonths > 0
        ? "improving"
        : projectionDeltaMonths < 0
          ? "worsening"
          : "steady";

  const diffYen = latest.netAssetsYen - previous.netAssetsYen;
  return {
    hasComparison: true,
    month: latest.month,
    previousMonth: previous.month,
    netAssetsYen: latest.netAssetsYen,
    diffYen,
    diffRatePct: diffRatePct(diffYen, previous.netAssetsYen),
    pace,
    projectionDeltaMonths,
  };
}
