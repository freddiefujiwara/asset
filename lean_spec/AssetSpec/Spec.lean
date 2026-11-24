/-!
Executable specification of the asset app's risk-asset aggregation.

Mirrors `riskAssetSummary(holdings)` in the asset repository
(`src/domain/holdings/engine.js`):

- stocks / funds / pensions rows contribute
  `toNumber(row["評価額"]) || toNumber(row["現在価値"])`
  (a zero or absent 評価額 falls back to 現在価値),
- crypto rows contribute `toNumber(row["残高"])` — crypto is part of
  the risk assets (this is the rule whose omission caused the
  2026-11-23 balance mismatch),
- `totalProfitYen` sums `評価損益` over stocks/funds/pensions rows
  that carry the field; crypto never contributes.

The string→number parsing (`toNumber`) stays on the JS side: rows
arrive here already reduced to integer yen, with an absent field
represented as 0 and `hasProfit` mirroring JS `"評価損益" in row`.
-/

namespace AssetSpec

/-- One holdings row, reduced to the fields the aggregation reads. -/
structure Row where
  /-- 評価額 (stocks / funds / pensions) -/
  eval : Int := 0
  /-- 現在価値 (pensions; fallback for the others) -/
  cur : Int := 0
  /-- 残高 (crypto) -/
  bal : Int := 0
  /-- 評価損益 -/
  profit : Int := 0
  /-- whether the row carries 評価損益 at all (JS `in` semantics) -/
  hasProfit : Bool := false
  deriving Repr, DecidableEq

/-- JS: `toNumber(row?.["評価額"]) || toNumber(row?.["現在価値"])`. -/
def valueOf (r : Row) : Int := if r.eval = 0 then r.cur else r.eval

/-- Sum over rows, matching the JS `reduce((s, r) => s + f r, 0)`. -/
def sumBy (f : Row → Int) (rows : List Row) : Int :=
  rows.foldl (fun s r => s + f r) 0

/-- `riskAssetSummary(holdings).totalYen`. -/
def riskTotal (stocks funds pensions crypto : List Row) : Int :=
  sumBy valueOf (stocks ++ funds ++ pensions) + sumBy (fun r => r.bal) crypto

/-- `riskAssetSummary(holdings).totalProfitYen`. -/
def profitTotal (stocks funds pensions : List Row) : Int :=
  sumBy (fun r => if r.hasProfit then r.profit else 0) (stocks ++ funds ++ pensions)

end AssetSpec
