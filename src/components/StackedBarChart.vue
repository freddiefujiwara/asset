<script setup>
import { computed } from "vue";

const props = defineProps({
  title: { type: String, required: true },
  data: { type: Array, default: () => [] }, // [{ label, value, color }]
  valueFormatter: { type: Function, default: null },
});

const size = 160;
const barWidth = 48;
const barPadding = 10;
const maxHeight = size - barPadding * 2;

const total = computed(() =>
  props.data.reduce((sum, item) => sum + (item.value > 0 ? item.value : 0), 0)
);

const bars = computed(() => {
  if (!total.value) return [];

  // Stack order: Bottom: 固定費 (Fixed), Top: 変動費 (Variable)
  // Requirement: "除外" (Exclude) is NOT drawn in the bar.
  const fixedItem = props.data.find((d) => d.label === "固定費");
  const variableItem = props.data.find((d) => d.label === "変動費");

  const result = [];
  let currentY = maxHeight + barPadding; // Start from bottom of the chart area

  if (fixedItem && fixedItem.value > 0) {
    const h = (fixedItem.value / total.value) * maxHeight;
    result.push({
      label: fixedItem.label,
      value: fixedItem.value,
      color: fixedItem.color || "#38bdf8",
      x: (size - barWidth) / 2,
      y: currentY - h,
      width: barWidth,
      height: h,
    });
    currentY -= h;
  }

  if (variableItem && variableItem.value > 0) {
    const h = (variableItem.value / total.value) * maxHeight;
    result.push({
      label: variableItem.label,
      value: variableItem.value,
      color: variableItem.color || "#f59e0b",
      x: (size - barWidth) / 2,
      y: currentY - h,
      width: barWidth,
      height: h,
    });
    currentY -= h;
  }

  return result;
});

const formatValue = (value) => {
  if (props.valueFormatter) {
    return props.valueFormatter(value);
  }
  return `${Math.round(value).toLocaleString("ja-JP")}`;
};
</script>

<template>
  <section class="chart-card">
    <h3 class="section-title">{{ title }}</h3>
    <div class="pie-layout">
      <svg
        :viewBox="`0 0 ${size} ${size}`"
        class="pie-svg"
        role="img"
        :aria-label="title"
      >
        <!-- Background track -->
        <rect
          :x="(size - barWidth) / 2"
          :y="barPadding"
          :width="barWidth"
          :height="maxHeight"
          fill="var(--surface-elevated)"
          rx="4"
        />
        <!-- Stacked bars (Fixed and Variable only) -->
        <rect
          v-for="bar in bars"
          :key="bar.label"
          :x="bar.x"
          :y="bar.y"
          :width="bar.width"
          :height="bar.height"
          :fill="bar.color"
        />
      </svg>
      <ul class="legend">
        <li v-for="item in data" :key="`legend-${item.label}`">
          <span class="swatch" :style="{ backgroundColor: item.color }" />
          <span class="legend-label">{{ item.label }}</span>
          <strong class="legend-values">
            <span
              >{{
                total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0"
              }}%</span
            >
            <span class="amount-value">({{ formatValue(item.value) }})</span>
          </strong>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.legend-label {
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}

.legend-values {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 4px;
  flex-wrap: wrap;
  text-align: right;
  font-size: 0.85rem;
}

@media (max-width: 700px) {
  .legend {
    width: 100%;
  }

  .legend li {
    grid-template-columns: 10px minmax(0, 1fr);
    row-gap: 2px;
  }

  .legend-values {
    grid-column: 2;
    justify-content: flex-start;
    font-size: 0.78rem;
  }
}
</style>
