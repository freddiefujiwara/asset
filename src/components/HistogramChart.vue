<script setup>
import { computed } from "vue";

const props = defineProps({
  data: { type: Array, default: () => [] }, // Array of months (trial results)
  maxMonths: { type: Number, default: 1200 },
  width: { type: Number, default: 800 },
  height: { type: Number, default: 300 },
  baseAge: { type: Number, default: 0 },
});

const margin = { top: 20, right: 30, bottom: 50, left: 60 };
const innerWidth = props.width - margin.left - margin.right;
const innerHeight = props.height - margin.top - margin.bottom;

const bins = computed(() => {
  if (props.data.length === 0) return [];

  const binCount = 30;
  const maxVal = Math.min(Math.max(...props.data, 1), props.maxMonths);
  const step = maxVal / binCount;

  const result = Array.from({ length: binCount }, (_, i) => ({
    start: i * step,
    end: (i + 1) * step,
    count: 0,
  }));

  props.data.forEach((val) => {
    const idx = Math.min(Math.floor(val / step), binCount - 1);
    result[idx].count++;
  });

  return result;
});

const maxCount = computed(() => {
  if (bins.value.length === 0) return 1;
  return Math.max(...bins.value.map((b) => b.count), 1);
});

const yScale = (count) => innerHeight - (count / maxCount.value) * innerHeight;
const xScale = (i) => (i * innerWidth) / bins.value.length;
const barWidth = computed(() => (innerWidth / bins.value.length) * 0.9);

</script>

<template>
  <div class="chart-card">
    <h3 class="section-title">達成月数分布（モンテカルロ）</h3>
    <div class="chart-container">
      <svg :viewBox="`0 0 ${width} ${height}`" style="width: 100%; height: auto;">
        <g :transform="`translate(${margin.left}, ${margin.top})`">
          <!-- Bars -->
          <g v-for="(bin, i) in bins" :key="i">
            <rect
              :x="xScale(i)"
              :y="yScale(bin.count)"
              :width="barWidth"
              :height="innerHeight - yScale(bin.count)"
              fill="#22c55e"
              opacity="0.8"
              rx="2"
            >
              <title>{{ Math.round(props.baseAge + bin.start/12) }}〜{{ Math.round(props.baseAge + bin.end/12) }}歳: {{ bin.count }}回</title>
            </rect>
          </g>

          <!-- Axes -->
          <line x1="0" :y1="innerHeight" :x2="innerWidth" :y2="innerHeight" stroke="var(--text)" />

          <!-- X Labels (every 5 bars) -->
          <g v-for="(bin, i) in bins" :key="'label-'+i">
            <text
              v-if="i % 5 === 0"
              :x="xScale(i) + barWidth/2"
              :y="innerHeight + 20"
              text-anchor="middle"
              font-size="10"
              fill="var(--muted)"
            >
              {{ Math.round(props.baseAge + bin.start / 12) }}歳
            </text>
          </g>

          <text :x="innerWidth / 2" :y="innerHeight + 40" text-anchor="middle" font-size="12" fill="var(--muted)">
            達成時の年齢
          </text>
        </g>
      </svg>
    </div>
  </div>
</template>
