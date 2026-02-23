<script setup>
import { ref, onMounted, watch, onUnmounted, computed } from 'vue';
import * as d3 from 'd3';
import { formatYen, formatSignedYen } from "@/domain/format";
import { signedClass } from "@/domain/signed";

const props = defineProps({
  title: { type: String, required: true },
  tiles: { type: Array, required: true },
  showDailyChange: { type: Boolean, default: true },
});

const container = ref(null);
const width = ref(800);
const height = ref(400);
const tooltip = ref({
  show: false,
  x: 0,
  y: 0,
  data: {}
});

const updateDimensions = () => {
  if (container.value) {
    const newWidth = container.value.clientWidth;
    if (newWidth > 0) {
      width.value = newWidth;
    }
    // Adjust height based on window height to follow target look & feel
    height.value = Math.min(600, Math.max(300, window.innerHeight * 0.4));
  }
};

const layoutNodes = computed(() => {
  if (!props.tiles || props.tiles.length === 0) return [];

  const root = d3.hierarchy({ children: props.tiles })
    .sum(d => d.value)
    .sort((a, b) => b.value - a.value);

  d3.treemap()
    .size([width.value, height.value])
    .padding(1)
    (root);

  return root.leaves();
});

const getFontSize = (leaf) => {
  const w = leaf.x1 - leaf.x0;
  const h = leaf.y1 - leaf.y0;
  const side = Math.min(w, h);
  // Align with target repository scaling: side/4.5, w/8
  // Lowered minimum font size to 6px as requested
  return Math.max(6, Math.min(side / 4.5, w / 8, 36));
};

const getTileColor = (changeRate) => {
  const neutral = "#1f2937"; // --surface-elevated
  const positive = "#22c55e";
  const negative = "#ef4444";

  if (!props.showDailyChange) return neutral;

  if (changeRate > 0) {
    const intensity = Math.min(changeRate / 5, 1);
    return d3.interpolateRgb(neutral, positive)(intensity);
  } else if (changeRate < 0) {
    const intensity = Math.min(Math.abs(changeRate) / 5, 1);
    return d3.interpolateRgb(neutral, negative)(intensity);
  }
  return neutral;
};

const showTooltip = (event, leaf) => {
  const totalValuation = props.tiles.reduce((sum, d) => sum + d.value, 0);
  tooltip.value = {
    show: true,
    x: event.clientX + 10,
    y: event.clientY + 10,
    data: {
      ...leaf.data,
      ratio: totalValuation > 0 ? (leaf.data.value / totalValuation) * 100 : 0
    }
  };
};

const hideTooltip = () => {
  tooltip.value.show = false;
};

let ro;
onMounted(() => {
  updateDimensions();
  ro = new ResizeObserver(() => {
    updateDimensions();
  });
  if (container.value) {
    ro.observe(container.value);
  }
});

onUnmounted(() => {
  if (ro) ro.disconnect();
});
</script>

<template>
  <section class="table-wrap">
    <h3 class="section-title">
      <slot name="title">{{ title }}</slot>
    </h3>
    <div ref="container" class="treemap-container" :style="{ height: height + 'px' }">
      <div v-if="layoutNodes.length === 0" class="empty-treemap-message">
        有効なデータがありません。
      </div>
      <article
        v-for="leaf in layoutNodes"
        :key="`${leaf.data.name}-${leaf.data.value}`"
        class="stock-tile"
        :style="{
          left: leaf.x0 + 'px',
          top: leaf.y0 + 'px',
          width: (leaf.x1 - leaf.x0) + 'px',
          height: (leaf.y1 - leaf.y0) + 'px',
          fontSize: getFontSize(leaf) + 'px',
          backgroundColor: getTileColor(leaf.data.changeRate)
        }"
        @mousemove="showTooltip($event, leaf)"
        @mouseleave="hideTooltip"
      >
        <div v-if="(leaf.x1 - leaf.x0) >= 14 && (leaf.y1 - leaf.y0) >= 14" class="tile-label-container">
          <div class="stock-tile-name" :title="leaf.data.name">{{ leaf.data.name }}</div>
          <div v-if="leaf.data.symbol && (leaf.y1 - leaf.y0) >= 24" class="tile-symbol" :style="{ fontSize: (getFontSize(leaf) * 0.7) + 'px' }">
            {{ leaf.data.symbol }}
          </div>
          <div v-if="props.showDailyChange && leaf.data.changeRate !== undefined && (leaf.y1 - leaf.y0) >= 18" class="tile-change" :style="{ fontSize: (getFontSize(leaf) * 0.8) + 'px' }">
            {{ leaf.data.changeRate > 0 ? '+' : '' }}{{ leaf.data.changeRate.toFixed(2) }}%
          </div>
        </div>
      </article>

      <Teleport to="body">
        <div v-if="tooltip.show" class="stock-tile-tooltip" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
          <div class="tooltip-header">
            <strong>{{ tooltip.data.name }}</strong>
            <span v-if="tooltip.data.symbol"> ({{ tooltip.data.symbol }})</span>
          </div>
          <div class="tooltip-row">
            <span>評価額:</span>
            <span class="amount-value">{{ formatYen(tooltip.data.value) }}</span>
          </div>
          <div class="tooltip-row">
            <span>比率:</span>
            <span>{{ tooltip.data.ratio.toFixed(2) }}%</span>
          </div>
          <template v-if="props.showDailyChange && tooltip.data.dailyChange != null">
            <div class="tooltip-row">
              <span>前日比:</span>
              <span :class="signedClass(tooltip.data.dailyChange)">
                {{ formatSignedYen(tooltip.data.dailyChange) }} ({{ tooltip.data.changeRate > 0 ? '+' : '' }}{{ tooltip.data.changeRate.toFixed(2) }}%)
              </span>
            </div>
          </template>
          <template v-if="tooltip.data.profit != null">
            <div class="tooltip-row">
              <span>評価損益:</span>
              <span :class="signedClass(tooltip.data.profit)">{{ formatSignedYen(tooltip.data.profit) }}</span>
            </div>
          </template>
          <template v-if="tooltip.data.details && tooltip.data.details.length > 1">
            <hr class="tooltip-divider">
            <div class="tooltip-details">
              <div v-for="(detail, idx) in tooltip.data.details" :key="idx" class="detail-row">
                <small>{{ detail.institution }}: {{ formatYen(detail.value) }}</small>
              </div>
            </div>
          </template>
        </div>
      </Teleport>
    </div>
  </section>
</template>

<style scoped>
.treemap-container {
  width: 100%;
  position: relative;
  background: var(--surface-elevated);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.empty-treemap-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--muted);
  font-size: 0.9rem;
  text-align: center;
}

.stock-tile {
  position: absolute;
  box-sizing: border-box;
  padding: 3px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  overflow: hidden;
  cursor: help;
  transition: filter 0.2s;
  color: #fff;
  /* Multi-layered text shadow for maximum legibility on various backgrounds */
  text-shadow: 0 1px 2px rgb(0 0 0 / 0.8), 0 0 4px rgb(0 0 0 / 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.stock-tile:hover {
  filter: brightness(1.2);
  z-index: 1;
}

.tile-label-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.stock-tile-name {
  width: 100%;
  font-weight: 600;
  line-height: 1.1;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-all;
}

.tile-symbol {
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.8;
}

.tile-change {
  font-weight: bold;
}

.stock-tile-tooltip {
  position: fixed;
  z-index: 1000;
  pointer-events: none;
  background: color-mix(in oklab, #020617 90%, var(--surface));
  color: #f8fafc;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 10px;
  font-size: 0.85rem;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  min-width: 200px;
}

.tooltip-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 6px;
  margin-bottom: 6px;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 2px;
}

.tooltip-divider {
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin: 6px 0;
}

.detail-row {
  white-space: nowrap;
}
</style>
