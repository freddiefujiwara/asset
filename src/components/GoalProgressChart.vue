<script setup>
import { computed } from "vue";

/**
 * 3目標（完全FIRE・金融資産1億円・純金融資産1億円）を1つのグラフで見る部品。
 * 実績（スナップショット）は実線、見込み（シミュレーション）は破線で描き、
 * 1億円ラインと完全FIREの必要資産ラインを横線で示す。
 */
const props = defineProps({
  actualTotal: { type: Array, default: () => [] },
  actualNet: { type: Array, default: () => [] },
  projectedTotal: { type: Array, default: () => [] },
  projectedNet: { type: Array, default: () => [] },
  goalYen: { type: Number, default: 0 },
  fullRequiredAssetsYen: { type: Number, default: null },
});

const WIDTH = 720;
const HEIGHT = 320;
const PADDING = { top: 16, right: 16, bottom: 28, left: 64 };

const monthIndex = (monthKey) => {
  const [year, month] = monthKey.split("-").map(Number);
  return year * 12 + (month - 1);
};

const allPoints = computed(() => [
  ...props.actualTotal,
  ...props.actualNet,
  ...props.projectedTotal,
  ...props.projectedNet,
]);

const xMin = computed(() =>
  allPoints.value.length
    ? Math.min(...allPoints.value.map((p) => monthIndex(p.month)))
    : 0,
);
const xMax = computed(() =>
  allPoints.value.length
    ? Math.max(...allPoints.value.map((p) => monthIndex(p.month)))
    : 1,
);

const yMax = computed(() => {
  const values = [
    ...allPoints.value.map((p) => p.value),
    props.goalYen,
    props.fullRequiredAssetsYen ?? 0,
  ];
  return Math.max(...values, 1) * 1.05;
});
const yMin = computed(() => {
  const values = allPoints.value.map((p) => p.value);
  return values.length ? Math.min(...values) * 0.95 : 0;
});

const x = (monthKey) =>
  PADDING.left +
  ((monthIndex(monthKey) - xMin.value) / Math.max(1, xMax.value - xMin.value)) *
    (WIDTH - PADDING.left - PADDING.right);
const y = (value) =>
  PADDING.top +
  (1 - (value - yMin.value) / Math.max(1, yMax.value - yMin.value)) *
    (HEIGHT - PADDING.top - PADDING.bottom);

const toPoints = (series) =>
  series.map((p) => `${x(p.month)},${y(p.value)}`).join(" ");

const formatOku = (value) => `${(value / 100000000).toFixed(1)}億円`;

const yTicks = computed(() => {
  const ticks = [];
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const value = yMin.value + ((yMax.value - yMin.value) * i) / steps;
    ticks.push({ value, label: formatOku(value), y: y(value) });
  }
  return ticks;
});

const xTicks = computed(() => {
  const ticks = [];
  const startYear = Math.ceil(xMin.value / 12);
  const endYear = Math.floor(xMax.value / 12);
  for (let year = startYear; year <= endYear; year++) {
    const jan = `${year}-01`;
    ticks.push({ label: `${year}年`, x: x(jan) });
  }
  return ticks;
});

const hasData = computed(() => allPoints.value.length > 0);
</script>

<template>
  <div class="goal-chart">
    <svg
      v-if="hasData"
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      style="width: 100%; height: auto"
      role="img"
      aria-label="総資産と純資産の実績・見込みと目標ラインのグラフ"
    >
      <g v-for="tick in yTicks" :key="`y-${tick.label}-${tick.y}`">
        <line
          :x1="PADDING.left"
          :x2="WIDTH - PADDING.right"
          :y1="tick.y"
          :y2="tick.y"
          stroke="var(--border)"
          stroke-width="0.5"
        />
        <text
          :x="PADDING.left - 8"
          :y="tick.y"
          text-anchor="end"
          alignment-baseline="middle"
          font-size="10"
          fill="var(--muted)"
        >
          {{ tick.label }}
        </text>
      </g>
      <g v-for="tick in xTicks" :key="`x-${tick.label}`">
        <text
          :x="tick.x"
          :y="HEIGHT - 8"
          text-anchor="middle"
          font-size="10"
          fill="var(--muted)"
        >
          {{ tick.label }}
        </text>
      </g>

      <!-- 目標ライン -->
      <line
        :x1="PADDING.left"
        :x2="WIDTH - PADDING.right"
        :y1="y(goalYen)"
        :y2="y(goalYen)"
        stroke="#ef4444"
        stroke-width="1.5"
        stroke-dasharray="6 4"
      />
      <line
        v-if="fullRequiredAssetsYen"
        :x1="PADDING.left"
        :x2="WIDTH - PADDING.right"
        :y1="y(fullRequiredAssetsYen)"
        :y2="y(fullRequiredAssetsYen)"
        stroke="#f59e0b"
        stroke-width="1.5"
        stroke-dasharray="6 4"
      />

      <!-- 見込み（破線） -->
      <polyline
        v-if="projectedTotal.length"
        :points="toPoints(projectedTotal)"
        fill="none"
        stroke="#3b82f6"
        stroke-width="2"
        stroke-dasharray="5 4"
      />
      <polyline
        v-if="projectedNet.length"
        :points="toPoints(projectedNet)"
        fill="none"
        stroke="#10b981"
        stroke-width="2"
        stroke-dasharray="5 4"
      />
      <!-- 実績（実線） -->
      <polyline
        v-if="actualTotal.length"
        :points="toPoints(actualTotal)"
        fill="none"
        stroke="#3b82f6"
        stroke-width="2.5"
      />
      <polyline
        v-if="actualNet.length"
        :points="toPoints(actualNet)"
        fill="none"
        stroke="#10b981"
        stroke-width="2.5"
      />
    </svg>
    <p v-else class="meta">グラフのデータがまだありません。</p>

    <div class="legend">
      <div class="legend-item">
        <span class="line" style="border-bottom: 3px solid #3b82f6"></span>総資産（実績）
      </div>
      <div class="legend-item">
        <span class="line" style="border-bottom: 2px dashed #3b82f6"></span>総資産（見込み）
      </div>
      <div class="legend-item">
        <span class="line" style="border-bottom: 3px solid #10b981"></span>純資産（実績）
      </div>
      <div class="legend-item">
        <span class="line" style="border-bottom: 2px dashed #10b981"></span>純資産（見込み）
      </div>
      <div class="legend-item">
        <span class="line" style="border-bottom: 2px dashed #ef4444"></span>目標ライン（1億円）
      </div>
      <div v-if="fullRequiredAssetsYen" class="legend-item">
        <span class="line" style="border-bottom: 2px dashed #f59e0b"></span>完全FIREの必要資産
      </div>
    </div>
  </div>
</template>

<style scoped>
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 8px;
  font-size: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-item .line {
  display: inline-block;
  width: 22px;
  height: 0;
}
</style>
