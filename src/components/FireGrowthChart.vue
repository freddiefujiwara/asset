<script setup>
import { computed } from "vue";

const props = defineProps({
  data: { type: Array, default: () => [] }, // Array of { month, assets, requiredAssets, isFire }
  width: { type: Number, default: 800 },
  height: { type: Number, default: 350 },
  baseAge: { type: Number, default: 40 },
});

const margin = { top: 20, right: 30, bottom: 50, left: 80 };
const innerWidth = props.width - margin.left - margin.right;
const innerHeight = props.height - margin.top - margin.bottom;

const range = computed(() => {
  if (props.data.length === 0) return { min: 0, max: 100000000 };
  const allValues = props.data.flatMap((d) => [d.assets, d.requiredAssets]);
  const max = Math.max(...allValues, 1000000);
  return { min: 0, max: max * 1.1 };
});

const yScale = (val) => {
  const { min, max } = range.value;
  return innerHeight - ((val - min) / (max - min)) * innerHeight;
};

const xScale = (i) => (i * innerWidth) / Math.max(props.data.length - 1, 1);

const assetsPath = computed(() => {
  if (props.data.length === 0) return "";
  const points = props.data.map((d, i) => `${xScale(i)},${yScale(d.assets)}`);
  return `M ${points.join(" L ")}`;
});

const requiredPath = computed(() => {
  if (props.data.length === 0) return "";
  const points = props.data.map((d, i) => `${xScale(i)},${yScale(d.requiredAssets)}`);
  return `M ${points.join(" L ")}`;
});

const firePoint = computed(() => {
  const index = props.data.findIndex((d) => d.isFire);
  if (index === -1) return null;
  const d = props.data[index];
  return {
    x: xScale(index),
    y: yScale(d.assets),
  };
});

const xLabels = computed(() => {
  const labels = [];
  const totalMonths = props.data.length;
  const step = Math.max(12, Math.floor(totalMonths / 10)); // Year or proportional
  for (let i = 0; i < totalMonths; i += step) {
    labels.push({
      x: xScale(i),
      text: `${props.baseAge + Math.floor(i / 12)}歳`,
    });
  }
  return labels;
});

const yLabels = computed(() => {
  const { max } = range.value;
  const labels = [];
  const step = Math.pow(10, Math.floor(Math.log10(max)) - 1) * 5 || 10000000;
  for (let val = 0; val <= max; val += step) {
    labels.push({
      y: yScale(val),
      text: `${Math.round(val / 10000).toLocaleString()}万`,
    });
  }
  return labels;
});
</script>

<template>
  <div class="chart-card">
    <h3 class="section-title">資産成長シミュレーション（期待値ベース）</h3>
    <div class="chart-container" style="overflow-x: auto;">
      <svg :viewBox="`0 0 ${width} ${height}`" style="min-width: 600px; width: 100%; height: auto;">
        <g :transform="`translate(${margin.left}, ${margin.top})`">
          <!-- Grid lines -->
          <g v-for="label in yLabels" :key="label.text" class="grid-line">
            <line x1="0" :y1="label.y" :x2="innerWidth" :y2="label.y" stroke="var(--border)" stroke-dasharray="4" />
            <text x="-10" :y="label.y" text-anchor="end" alignment-baseline="middle" font-size="10" fill="var(--muted)">
              {{ label.text }}
            </text>
          </g>

          <!-- Axes -->
          <line x1="0" :y1="innerHeight" :x2="innerWidth" :y2="innerHeight" stroke="var(--text)" />
          <line x1="0" y1="0" x2="0" :y2="innerHeight" stroke="var(--text)" />

          <!-- Paths -->
          <path :d="requiredPath" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="4" />
          <path :d="assetsPath" fill="none" stroke="#3b82f6" stroke-width="3" />

          <!-- FIRE reached point -->
          <g v-if="firePoint">
            <circle :cx="firePoint.x" :cy="firePoint.y" r="6" fill="#ef4444" />
            <text :x="firePoint.x" :y="firePoint.y - 15" text-anchor="middle" font-weight="bold" fill="#ef4444" font-size="14">
              FIRE!
            </text>
          </g>

          <!-- X Labels -->
          <g v-for="label in xLabels" :key="label.text">
            <text :x="label.x" :y="innerHeight + 25" text-anchor="middle" font-size="12" fill="var(--muted)">
              {{ label.text }}
            </text>
          </g>
        </g>
      </svg>
    </div>
    <div class="legend" style="display: flex; justify-content: center; gap: 20px; margin-top: 10px; font-size: 12px;">
      <div style="display: flex; align-items: center; gap: 4px;">
        <span style="width: 20px; height: 3px; background: #3b82f6;"></span>
        <span>総資産</span>
      </div>
      <div style="display: flex; align-items: center; gap: 4px;">
        <span style="width: 20px; height: 2px; border-bottom: 2px dashed var(--muted);"></span>
        <span>必要資産 (100歳寿命)</span>
      </div>
    </div>
  </div>
</template>
