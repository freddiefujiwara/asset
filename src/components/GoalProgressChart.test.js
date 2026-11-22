import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import GoalProgressChart from "./GoalProgressChart.vue";

const series = [
  { month: "2026-10", value: 77000000 },
  { month: "2026-11", value: 78139712 },
];

describe("GoalProgressChart", () => {
  it("renders actual and projected lines, goal lines and the legend", () => {
    const wrapper = mount(GoalProgressChart, {
      props: {
        actualTotal: series,
        actualNet: series.map((p) => ({ ...p, value: p.value - 11000000 })),
        projectedTotal: [{ month: "2028-12", value: 101000000 }],
        projectedNet: [{ month: "2030-09", value: 100500000 }],
        goalYen: 100000000,
        fullRequiredAssetsYen: 128643042,
      },
    });
    const polylines = wrapper.findAll("polyline");
    expect(polylines).toHaveLength(4);
    expect(wrapper.text()).toContain("総資産（実績）");
    expect(wrapper.text()).toContain("純資産（見込み）");
    expect(wrapper.text()).toContain("目標ライン（1億円）");
    expect(wrapper.text()).toContain("完全FIREの必要資産");
  });

  it("omits the full FIRE line when the required assets are unknown", () => {
    const wrapper = mount(GoalProgressChart, {
      props: {
        actualTotal: series,
        actualNet: [],
        projectedTotal: [],
        projectedNet: [],
        goalYen: 100000000,
        fullRequiredAssetsYen: null,
      },
    });
    expect(wrapper.findAll("polyline")).toHaveLength(1);
    expect(wrapper.text()).not.toContain("完全FIREの必要資産");
  });

  it("shows a placeholder when there is no data", () => {
    const wrapper = mount(GoalProgressChart, { props: { goalYen: 100000000 } });
    expect(wrapper.find("svg").exists()).toBe(false);
    expect(wrapper.text()).toContain("グラフのデータがまだありません");
  });
});
