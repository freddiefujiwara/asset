<script setup>
import { computed, ref } from "vue";

const props = defineProps({
  data: { type: Array, default: () => [] }, // Array of { month, income, expense, net }
  showNet: { type: Boolean, default: true },
  averages: { type: Object, default: null },
});

const chartContainerRef = ref(null);
const activeTooltip = ref(null);

const width = 800;
const height = 300;
const margin = { top: 30, right: 30, bottom: 50, left: 80 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const range = computed(() => {
  const values = props.data.flatMap((d) =>
    props.showNet ? [d.income, d.expense, d.net] : [d.income, d.expense],
  );
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

const formatYen = (value) => `¥${Math.round(value).toLocaleString()}`;

const showTooltip = (event, item) => {
  const container = chartContainerRef.value;
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  activeTooltip.value = {
    ...item,
    x: Math.min(Math.max(x + 14, 8), rect.width - 8),
    y: Math.min(Math.max(y - 10, 8), rect.height - 8),
  };
};

const hideTooltip = (event) => {
  if (event?.pointerType && event.pointerType !== "mouse") return;
  activeTooltip.value = null;
};

const clearTooltip = () => {
  activeTooltip.value = null;
};
</script>

<template>
  <div class="chart-card">
    <h3 class="section-title">月次収支推移</h3>
    <div
      ref="chartContainerRef"
      class="chart-container cash-flow-chart-container"
      style="overflow-x: auto;"
      @click="clearTooltip"
    >
      <svg :viewBox="`0 0 ${width} ${height}`" class="bar-chart-svg" style="min-width: 600px; width: 100%; height: auto;">
        <g :transform="`translate(${margin.left}, ${margin.top})`">
          <!-- Grid lines -->
          <g v-for="line in gridLines" :key="line.label" class="grid-line">
            <line x1="0" :y1="line.y" :x2="innerWidth" :y2="line.y" stroke="var(--border)" :stroke-dasharray="line.label === '0' ? '0' : '4'" />
            <text
              x="-10"
              :y="line.y"
              text-anchor="end"
              alignment-baseline="middle"
              font-size="10"
              fill="var(--muted)"
              class="amount-value"
              style="filter: var(--amount-mask-filter, none);"
            >
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
              @pointerenter="showTooltip($event, { month: b.month, label: '収入', value: b.income.val })"
              @pointermove="showTooltip($event, { month: b.month, label: '収入', value: b.income.val })"
              @pointerleave="hideTooltip($event)"
              @click.stop="showTooltip($event, { month: b.month, label: '収入', value: b.income.val })"
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
              @pointerenter="showTooltip($event, { month: b.month, label: '支出', value: b.expense.val })"
              @pointermove="showTooltip($event, { month: b.month, label: '支出', value: b.expense.val })"
              @pointerleave="hideTooltip($event)"
              @click.stop="showTooltip($event, { month: b.month, label: '支出', value: b.expense.val })"
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
          <template v-if="showNet">
            <path :d="netLinePath" fill="none" stroke="#3b82f6" stroke-width="2" />
            <circle
              v-for="b in bars"
              :key="'net-'+b.month"
              :cx="b.income.x + b.income.w"
              :cy="b.net.y"
              r="4"
              fill="#3b82f6"
              @pointerenter="showTooltip($event, { month: b.month, label: '純収支', value: b.net.val })"
              @pointermove="showTooltip($event, { month: b.month, label: '純収支', value: b.net.val })"
              @pointerleave="hideTooltip($event)"
              @click.stop="showTooltip($event, { month: b.month, label: '純収支', value: b.net.val })"
            >
               <title>{{ b.month }} 純収支: {{ b.net.val.toLocaleString() }}</title>
            </circle>
          </template>

          <!-- Zero line -->
          <line x1="0" :y1="yScale(0)" :x2="innerWidth" :y2="yScale(0)" stroke="var(--text)" stroke-width="1" />
        </g>
      </svg>
      <div
        v-if="activeTooltip"
        class="cash-flow-tooltip"
        :style="{ left: `${activeTooltip.x}px`, top: `${activeTooltip.y}px` }"
        role="tooltip"
      >
        <div>{{ activeTooltip.month }} {{ activeTooltip.label }}</div>
        <div><span class="amount-value">{{ formatYen(activeTooltip.value) }}</span></div>
      </div>
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
      <div v-if="showNet" style="display: flex; align-items: center; gap: 4px;">
        <span style="width: 12px; height: 2px; background: #3b82f6;"></span>
        <span style="font-size: 12px;">純収支</span>
      </div>
    </div>
    <p
      v-if="averages && averages.count > 0"
      class="meta"
      style="margin-top: 8px; text-align: center;"
    >
      直近{{ averages.count }}か月平均：
      収入 <span class="amount-value">{{ Math.round(averages.income).toLocaleString() }}</span> /
      支出 <span class="amount-value">{{ Math.round(averages.expense).toLocaleString() }}</span>
      <template v-if="showNet">
        / 純収支 <span class="amount-value">{{ Math.round(averages.net).toLocaleString() }}</span>
      </template>
    </p>
  </div>
</template>

<style scoped>
.bar-chart-svg {
  font-family: inherit;
}

.cash-flow-chart-container {
  position: relative;
}

.cash-flow-tooltip {
  position: absolute;
  transform: translate(-50%, -100%);
  pointer-events: none;
  background: color-mix(in srgb, var(--surface-elevated) 90%, black 10%);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
  z-index: 2;
  white-space: nowrap;
}
</style>
