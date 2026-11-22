import { reactive } from "vue";
import { describe, expect, it } from "vitest";
import { useHoldingTableViewModel } from "@/features/holdings/useHoldingTableViewModel";

describe("useHoldingTableViewModel", () => {
  it("sorts by 評価額 and formats values", () => {
    const props = reactive({
      rows: [{ 評価額: "200", 銘柄名: "B" }, { 評価額: "100", 銘柄名: "A" }],
      columns: [{ key: "評価額", label: "評価額" }, { key: "銘柄名", label: "銘柄名" }],
      isLiability: false,
    });
    const vm = useHoldingTableViewModel(props);
    vm.toggleSort(props.columns[0]);
    expect(vm.displayedRows.value[0]["評価額"]).toBe("100");
    expect(vm.formatCell(props.columns[0], props.rows[0])).toContain("¥");
  });

  it("formats the daily change with its rate when the current value is known", () => {
    const column = { key: "__dailyChange", label: "前日比" };
    const props = reactive({ rows: [], columns: [column], isLiability: false });
    const vm = useHoldingTableViewModel(props);
    // 前日比％ = 100 ÷（1100 − 100）= +10.0%
    expect(vm.formatCell(column, { 評価額: "1100", 前日比: "100" })).toBe("+¥100 (+10.0%)");
    expect(vm.formatCell(column, { 現在価値: "900", 前日比: "-100" })).toBe("-¥100 (-10.0%)");
    // 現在の値が無い・前日の値が0のときは金額のみ
    expect(vm.formatCell(column, { 前日比: "100" })).toBe("+¥100");
    expect(vm.formatCell(column, { 評価額: "100", 前日比: "100" })).toBe("+¥100");
    expect(vm.formatCell(column, { 評価額: "100" })).toBe("-");
  });
});
