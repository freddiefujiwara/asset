<script setup>
import { computed, ref } from "vue";

const props = defineProps({
  data: { type: Array, default: () => [] }, // Array of { month, income, expense, net }
  showNet: { type: Boolean, default: true },
  averages: { type: Object, default: null },
});

const width = 800;
const height = 300;
const margin = { top: 30, right: 30, bottom: 50, left: 80 };
const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const TOOLTIP_LABELS = {
  income: "収入",
  expense: "支出",
  net: "純収支",
};

const TOOLTIP_OFFSET_X = 14;
const TOOLTIP_OFFSET_Y = 10;
const TOOLTIP_PADDING = 8;

const chartContainerRef = ref(null);
const activeTooltip = ref(null);

const range = computed(() => {
  const values = props.data.flatMap((item) => (
    props.showNet ? [item.income, item.expense, item.net] : [item.income, item.expense]
  ));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100000);

  const diff = max - min;
  const paddedMin = min - diff * 0.1;
  const paddedMax = max + diff * 0.1;
  const step = Math.pow(10, Math.floor(Math.log10(diff || 1)) - 1) * 5 || 10000;

  return {
    min: Math.floor(paddedMin / step) * step,
    max: Math.ceil(paddedMax / step) * step,
  };
});

const yScale = (value) => {
  const { min, max } = range.value;
  const total = max - min || 1;
  return innerHeight - ((value - min) / total) * innerHeight;
};

const xScale = (index) => (index * innerWidth) / Math.max(props.data.length, 1);

const bars = computed(() => {
  const step = innerWidth / Math.max(props.data.length, 1);
  const barWidth = step * 0.35;

  return props.data.map((item, index) => {
    const x = xScale(index) + step * 0.15;
    const y0 = yScale(0);
    const yIncome = yScale(item.income);
    const yExpense = yScale(item.expense);

    return {
      month: item.month,
      income: {
        x,
        y: Math.min(yIncome, y0),
        h: Math.abs(yIncome - y0),
        w: barWidth,
        val: item.income,
      },
      expense: {
        x: x + barWidth,
        y: Math.min(yExpense, y0),
        h: Math.abs(yExpense - y0),
        w: barWidth,
        val: item.expense,
      },
      net: {
        x: x + barWidth,
        y: yScale(item.net),
        val: item.net,
      },
    };
  });
});

const netLinePath = computed(() => {
  if (props.data.length === 0) return "";

  const step = innerWidth / Math.max(props.data.length, 1);
  const points = props.data.map((item, index) => {
    const x = xScale(index) + step * 0.5;
    return `${x},${yScale(item.net)}`;
  });

  return `M ${points.join(" L ")}`;
});

const gridLines = computed(() => {
  const lines = [];
  const { min, max } = range.value;
  const count = 6;
  const step = (max - min) / count;

  for (let index = 0; index <= count; index += 1) {
    const value = min + step * index;
    lines.push({
      y: yScale(value),
      label: Math.round(value).toLocaleString(),
    });
  }

  return lines;
});

const formatYen = (value) => `¥${Math.round(value).toLocaleString()}`;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const buildTooltip = (event, item) => {
  const container = chartContainerRef.value;
  if (!container) {
    return null;
  }

  const rect = container.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  return {
    ...item,
    x: clamp(x + TOOLTIP_OFFSET_X, TOOLTIP_PADDING, rect.width - TOOLTIP_PADDING),
    y: clamp(y - TOOLTIP_OFFSET_Y, TOOLTIP_PADDING, rect.height - TOOLTIP_PADDING),
  };
};

const setTooltip = (event, month, type, value) => {
  const tooltip = buildTooltip(event, {
    month,
    label: TOOLTIP_LABELS[type],
    value,
  });

  if (tooltip) {
    activeTooltip.value = tooltip;
  }
};

const handlePointerLeave = (event) => {
  if (event?.pointerType && event.pointerType !== "mouse") {
    return;
  }
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
          <g v-for="line in gridLines" :key="line.label" class="grid-line">
            <line x1="0" :y1="line.y" :x2="innerWidth" :y2="line.y" stroke="var(--border)" :stroke-dasharray="line.label === '0' ? '0' : '4'" />
            <text x="-10" :y="line.y" text-anchor="end" alignment-baseline="middle" font-size="10" fill="var(--muted)">
              <tspan class="amount-value">{{ line.label }}</tspan>
            </text>
          </g>

          <g v-for="bar in bars" :key="bar.month">
            <rect
              :x="bar.income.x"
              :y="bar.income.y"
              :width="bar.income.w"
              :height="bar.income.h"
              fill="#22c55e"
              rx="2"
              opacity="0.8"
              @pointerenter="setTooltip($event, bar.month, 'income', bar.income.val)"
              @pointermove="setTooltip($event, bar.month, 'income', bar.income.val)"
              @pointerleave="handlePointerLeave($event)"
              @click.stop="setTooltip($event, bar.month, 'income', bar.income.val)"
            >
              <title>{{ bar.month }} 収入: {{ bar.income.val.toLocaleString() }}</title>
            </rect>
            <rect
              :x="bar.expense.x"
              :y="bar.expense.y"
              :width="bar.expense.w"
              :height="bar.expense.h"
              fill="#ef4444"
              rx="2"
              opacity="0.8"
              @pointerenter="setTooltip($event, bar.month, 'expense', bar.expense.val)"
              @pointermove="setTooltip($event, bar.month, 'expense', bar.expense.val)"
              @pointerleave="handlePointerLeave($event)"
              @click.stop="setTooltip($event, bar.month, 'expense', bar.expense.val)"
            >
              <title>{{ bar.month }} 支出: {{ bar.expense.val.toLocaleString() }}</title>
            </rect>
            <text
              :x="bar.income.x + bar.income.w"
              :y="innerHeight + 25"
              text-anchor="middle"
              font-size="12"
              fill="var(--muted)"
            >
              {{ bar.month.split('-')[1] }}月
            </text>
          </g>

          <template v-if="showNet">
            <path :d="netLinePath" fill="none" stroke="#3b82f6" stroke-width="2" />
            <circle
              v-for="bar in bars"
              :key="`net-${bar.month}`"
              :cx="bar.income.x + bar.income.w"
              :cy="bar.net.y"
              r="4"
              fill="#3b82f6"
              @pointerenter="setTooltip($event, bar.month, 'net', bar.net.val)"
              @pointermove="setTooltip($event, bar.month, 'net', bar.net.val)"
              @pointerleave="handlePointerLeave($event)"
              @click.stop="setTooltip($event, bar.month, 'net', bar.net.val)"
            >
              <title>{{ bar.month }} 純収支: {{ bar.net.val.toLocaleString() }}</title>
            </circle>
          </template>

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
    <div class="legend cash-flow-legend">
      <div class="cash-flow-legend-item">
        <span class="cash-flow-swatch cash-flow-income"></span>
        <span class="cash-flow-legend-text">収入</span>
      </div>
      <div class="cash-flow-legend-item">
        <span class="cash-flow-swatch cash-flow-expense"></span>
        <span class="cash-flow-legend-text">支出</span>
      </div>
      <div v-if="showNet" class="cash-flow-legend-item">
        <span class="cash-flow-net-line"></span>
        <span class="cash-flow-legend-text">純収支</span>
      </div>
    </div>
    <p
      v-if="averages && averages.count > 0"
      class="meta cash-flow-averages"
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

.cash-flow-legend {
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 20px;
  margin-top: 10px;
}

.cash-flow-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cash-flow-legend-text {
  font-size: 12px;
}

.cash-flow-swatch {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.cash-flow-income {
  background: #22c55e;
}

.cash-flow-expense {
  background: #ef4444;
}

.cash-flow-net-line {
  width: 12px;
  height: 2px;
  background: #3b82f6;
}

.cash-flow-averages {
  margin-top: 8px;
  text-align: center;
}
</style>
