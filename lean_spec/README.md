# lean_spec — リスク資産集計の実行可能な仕様（Lean 4）

asset の `riskAssetSummary`（`src/domain/holdings/engine.js`）の集計意味論を
Lean 4 で独立に写した「正解マシン（Test Oracle）」と、その不変条件の証明。

- `AssetSpec/Spec.lean` — 実行可能な仕様（株式/投信/年金は評価額、
  0 なら現在価値。暗号資産は残高。評価損益はキーを持つ行だけ）
- `AssetSpec/Proofs.lean` — 保存則と「カテゴリの行を足すと必ず合計が
  その分だけ増える」ことの証明、`#guard` によるコンパイル時チェック
- `Main.lean` — JSON Lines 常駐 Oracle（`asset_oracle`）

文字列→数値の変換（`toNumber`）は JS 側に残し、Oracle は整数化された
フィールドだけを受け取る。検証対象はカテゴリの取り込み・フィールド
選択・フォールバックという集計の意味論。

## 使い方

```sh
# 要 elan（Lean 4.22.0 は lean-toolchain で固定）
lake test    # 証明と #guard の検証（型検査そのもの）
lake build   # Oracle バイナリを .lake/build/bin/asset_oracle に生成
cd .. && npm run test:oracle   # 本体 JS との差分テスト（fast-check）
```

CI では staging ワークフローの `oracle` ジョブが上記を実行し、
必須チェック `e2e` の前提になっている。
