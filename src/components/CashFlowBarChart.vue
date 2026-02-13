<script setup>
import { computed } from "vue";

const props = defineProps({
  data: { type: Array, default: () => [] }, // Array of { month, income, expense, net }
});

const width = 800;
const height = 300;
const margin = { top: 30, right: 30, bottom: 50, left: 80 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const range = computed(() => {
  const values = props.data.flatMap((d) => [d.income, d.expense, d.net]);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100000);

  // Padding
  const diff = max - min;
  const paddedMin = min - diff * 0.1;
  const paddedMax = max + diff * 0.1;

  // Round to nice numbers
  const step = Math.pow(10, Math.floor(Math.log10(diff || 1)) - 1) * 5 || 10000;
  return {
    min: Math.floor(paddedMin / step) * step,
    max: Math.ceil(paddedMax / step) * step
  };
});

const yScale = (val) => {
  const { min, max } = range.value;
  const total = max - min || 1;
  return innerHeight - ((val - min) / total) * innerHeight;
};

const xScale = (i) => (i * innerWidth) / Math.max(props.data.length, 1);

const bars = computed(() => {
  const step = innerWidth / Math.max(props.data.length, 1);
  const barWidth = step * 0.35;
  return props.data.map((d, i) => {
    const x = xScale(i) + step * 0.15;
    const y0 = yScale(0);

    const yIncome = yScale(d.income);
    const yExpense = yScale(d.expense);

    return {
      month: d.month,
      income: {
        x,
        y: Math.min(yIncome, y0),
        h: Math.abs(yIncome - y0),
        w: barWidth,
        val: d.income,
      },
      expense: {
        x: x + barWidth,
        y: Math.min(yExpense, y0),
        h: Math.abs(yExpense - y0),
        w: barWidth,
        val: d.expense,
      },
      net: {
        x: x + barWidth, // This is the center point (x + 0.35*step = xScale + 0.5*step)
        y: yScale(d.net),
        val: d.net,
      },
    };
  });
});

const netLinePath = computed(() => {
  if (props.data.length === 0) return "";
  const step = innerWidth / Math.max(props.data.length, 1);
  const points = props.data.map((d, i) => {
    const x = xScale(i) + step * 0.5;
    const y = yScale(d.net);
    return `${x},${y}`;
  });
  return `M ${points.join(" L ")}`;
});

const gridLines = computed(() => {
  const lines = [];
  const { min, max } = range.value;
  const count = 6;
  const step = (max - min) / count;
  for (let i = 0; i <= count; i++) {
    const val = min + step * i;
    lines.push({
      y: yScale(val),
      label: Math.round(val).toLocaleString(),
    });
  }
  return lines;
});
</script>

<template>
  <div class="chart-card">
    <h3 class="section-title">月次収支推移</h3>
    <div class="chart-container" style="overflow-x: auto;">
      <svg :viewBox="`0 0 ${width} ${height}`" class="bar-chart-svg" style="min-width: 600px; width: 100%; height: auto;">
        <g :transform="`translate(${margin.left}, ${margin.top})`">
          <!-- Grid lines -->
          <g v-for="line in gridLines" :key="line.label" class="grid-line">
            <line x1="0" :y1="line.y" :x2="innerWidth" :y2="line.y" stroke="var(--border)" :stroke-dasharray="line.label === '0' ? '0' : '4'" />
            <text x="-10" :y="line.y" text-anchor="end" alignment-baseline="middle" font-size="10" fill="var(--muted)">
              {{ line.label }}
            </text>
          </g>

          <!-- Bars -->
          <g v-for="b in bars" :key="b.month">
            <rect
              :x="b.income.x"
              :y="b.income.y"
              :width="b.income.w"
              :height="b.income.h"
              fill="#22c55e"
              rx="2"
              opacity="0.8"
            >
              <title>{{ b.month }} 収入: {{ b.income.val.toLocaleString() }}</title>
            </rect>
            <rect
              :x="b.expense.x"
              :y="b.expense.y"
              :width="b.expense.w"
              :height="b.expense.h"
              fill="#ef4444"
              rx="2"
              opacity="0.8"
            >
              <title>{{ b.month }} 支出: {{ b.expense.val.toLocaleString() }}</title>
            </rect>
            <text
              :x="b.income.x + b.income.w"
              :y="innerHeight + 25"
              text-anchor="middle"
              font-size="12"
              fill="var(--muted)"
            >
              {{ b.month.split('-')[1] }}月
            </text>
          </g>

          <!-- Net Line -->
          <path :d="netLinePath" fill="none" stroke="#3b82f6" stroke-width="2" />
          <circle v-for="b in bars" :key="'net-'+b.month" :cx="b.income.x + b.income.w" :cy="b.net.y" r="4" fill="#3b82f6">
             <title>{{ b.month }} 純収支: {{ b.net.val.toLocaleString() }}</title>
          </circle>

          <!-- Zero line -->
          <line x1="0" :y1="yScale(0)" :x2="innerWidth" :y2="yScale(0)" stroke="var(--text)" stroke-width="1" />
        </g>
      </svg>
    </div>
    <div class="legend" style="display: flex; flex-direction: row; justify-content: center; gap: 20px; margin-top: 10px;">
      <div style="display: flex; align-items: center; gap: 4px;">
        <span style="width: 12px; height: 12px; background: #22c55e; border-radius: 2px;"></span>
        <span style="font-size: 12px;">収入</span>
      </div>
      <div style="display: flex; align-items: center; gap: 4px;">
        <span style="width: 12px; height: 12px; background: #ef4444; border-radius: 2px;"></span>
        <span style="font-size: 12px;">支出</span>
      </div>
      <div style="display: flex; align-items: center; gap: 4px;">
        <span style="width: 12px; height: 2px; background: #3b82f6;"></span>
        <span style="font-size: 12px;">純収支</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bar-chart-svg {
  font-family: inherit;
}
</style>
