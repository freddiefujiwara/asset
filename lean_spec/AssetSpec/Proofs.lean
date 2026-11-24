import AssetSpec.Spec

namespace AssetSpec

/-- The fold used by `sumBy` is exactly "initial value + sum of the
    mapped list". Proved once, by induction, and reused everywhere. -/
theorem foldl_add (f : Row → Int) (rows : List Row) (init : Int) :
    rows.foldl (fun s r => s + f r) init = init + (rows.map f).sum := by
  induction rows generalizing init with
  | nil => simp
  | cons x xs ih =>
      simp only [List.foldl_cons, List.map_cons, List.sum_cons]
      rw [ih (init := init + f x)]
      omega

theorem sumBy_eq (f : Row → Int) (rows : List Row) :
    sumBy f rows = (rows.map f).sum := by
  unfold sumBy
  rw [foldl_add]
  simp

/-- `(l₁ ++ l₂).sum = l₁.sum + l₂.sum`, by induction
    (kept local so the file needs nothing beyond Lean core). -/
theorem list_sum_append (l₁ l₂ : List Int) :
    (l₁ ++ l₂).sum = l₁.sum + l₂.sum := by
  induction l₁ with
  | nil => simp
  | cons x xs ih => simp only [List.cons_append, List.sum_cons, ih]; omega

theorem sumBy_append (f : Row → Int) (a b : List Row) :
    sumBy f (a ++ b) = sumBy f a + sumBy f b := by
  rw [sumBy_eq, sumBy_eq, sumBy_eq, List.map_append, list_sum_append]

theorem sumBy_snoc (f : Row → Int) (rows : List Row) (r : Row) :
    sumBy f (rows ++ [r]) = sumBy f rows + f r := by
  rw [sumBy_append]
  simp [sumBy_eq]

/-- Conservation: the risk total is exactly the sum over every row in
    every category — nothing added, nothing dropped, nothing counted
    twice. -/
theorem riskTotal_conservation (s f p c : List Row) :
    riskTotal s f p c
      = (s.map valueOf).sum + (f.map valueOf).sum + (p.map valueOf).sum
        + (c.map (fun r => r.bal)).sum := by
  unfold riskTotal
  rw [sumBy_append, sumBy_append, sumBy_eq, sumBy_eq, sumBy_eq, sumBy_eq]

/-- The anti-omission property (the 2026-11-23 incident shape):
    appending one crypto row always moves the total by exactly that
    row's balance. Crypto can never be silently dropped. -/
theorem riskTotal_crypto_snoc (s f p c : List Row) (r : Row) :
    riskTotal s f p (c ++ [r]) = riskTotal s f p c + r.bal := by
  unfold riskTotal
  rw [sumBy_snoc]
  omega

/-- Same for a value category: appending a stock row moves the total
    by exactly that row's value. -/
theorem riskTotal_stock_snoc (s f p c : List Row) (r : Row) :
    riskTotal (s ++ [r]) f p c = riskTotal s f p c + valueOf r := by
  rw [riskTotal_conservation, riskTotal_conservation, List.map_append,
    list_sum_append]
  simp
  omega

/-- A single row's profit contribution is its 評価損益 when the field
    is carried, and 0 otherwise — the field's mere value in a row that
    does not carry it (the JS object simply lacks the key) never leaks
    into the total. -/
theorem profitTotal_single (r : Row) :
    profitTotal [r] [] [] = if r.hasProfit then r.profit else 0 := by
  unfold profitTotal sumBy
  simp

-- Compile-time examples (#guard): if any of these fail, `lake test`
-- (and the build) fails.

-- The incident shape: a single crypto row must show up in the total.
#guard riskTotal [] [] [] [{ bal := 52107 }] = 52107

-- Fallback rule: a pension row with no 評価額 counts its 現在価値.
#guard riskTotal [{ eval := 1000 }] [] [{ cur := 2500 }] [{ bal := 300 }] = 3800

-- A negative 評価額 is a real value, not a fallback trigger.
#guard riskTotal [{ eval := -500, cur := 9999 }] [] [] [] = -500

-- Profit: carried fields count (even when negative), uncarried do not.
#guard profitTotal [{ profit := -400, hasProfit := true }] [] [] = -400
#guard profitTotal [{ profit := 999, hasProfit := false }] [] [] = 0

end AssetSpec
