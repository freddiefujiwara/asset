<script setup>
import { computed } from "vue";

const props = defineProps({
  title: { type: String, required: true },
  data: { type: Array, default: () => [] },
});

const radius = 72;
const size = 160;
const center = size / 2;
const palette = ["#38bdf8", "#818cf8", "#34d399", "#f59e0b", "#f87171", "#a78bfa"];

const total = computed(() => props.data.reduce((sum, item) => sum + (item.value > 0 ? item.value : 0), 0));

function pointAt(angleRad) {
  return {
    x: center + radius * Math.cos(angleRad),
    y: center + radius * Math.sin(angleRad),
  };
}

const slices = computed(() => {
  if (!total.value) {
    return [];
  }

  let start = -Math.PI / 2;
  return props.data
    .filter((item) => item.value > 0)
    .map((item, index) => {
      const sweep = (item.value / total.value) * Math.PI * 2;
      const end = start + sweep;
      const p1 = pointAt(start);
      const p2 = pointAt(end);
      const largeArc = sweep > Math.PI ? 1 : 0;
      const d = `M ${center} ${center} L ${p1.x} ${p1.y} A ${radius} ${radius} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;

      const result = {
        label: item.label,
        value: item.value,
        d,
        color: item.color ?? palette[index % palette.length],
      };
      start = end;
      return result;
    });
});
</script>

<template>
  <section class="chart-card">
    <h3 class="section-title">{{ title }}</h3>
    <div class="pie-layout">
      <svg :viewBox="`0 0 ${size} ${size}`" class="pie-svg" role="img" :aria-label="title">
        <circle :cx="center" :cy="center" :r="radius" fill="var(--surface-elevated)" />
        <path v-for="slice in slices" :key="slice.label" :d="slice.d" :fill="slice.color" />
      </svg>
      <ul class="legend">
        <li v-for="slice in slices" :key="`legend-${slice.label}`">
          <span class="swatch" :style="{ backgroundColor: slice.color }" />
          <span>{{ slice.label }}</span>
          <strong>{{ ((slice.value / total) * 100).toFixed(1) }}%</strong>
        </li>
      </ul>
    </div>
  </section>
</template>
