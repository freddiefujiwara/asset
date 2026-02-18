<script setup>
import { formatYen, formatSignedYen } from "@/domain/format";
import { signedClass } from "@/domain/signed";

defineProps({
  title: { type: String, required: true },
  tiles: { type: Array, required: true },
});
</script>

<template>
  <section class="table-wrap">
    <h3 class="section-title">{{ title }}</h3>
    <div class="stock-tile-grid">
      <article
        v-for="tile in tiles"
        :key="`${tile.name}-${tile.value}`"
        class="stock-tile"
        :class="tile.isNegative ? 'is-negative-box' : 'is-positive-box'"
        tabindex="0"
        :aria-label="`${tile.name} 評価額 ${formatYen(tile.value)}`"
        :style="{
          left: `${tile.x}%`,
          top: `${tile.y}%`,
          width: `${tile.width}%`,
          height: `${tile.height}%`,
          '--name-scale': tile.fontScale,
        }"
      >
        <p class="stock-tile-name" :title="tile.name">{{ tile.name }}</p>
        <span class="stock-tile-tooltip" role="tooltip">
          <div class="tooltip-content">
            <strong>{{ tile.name }}</strong><br>
            評価額: <span class="amount-value">{{ formatYen(tile.value) }}</span>
            <template v-if="tile.dailyChange != null">
              <br>前日比: <span :class="signedClass(tile.dailyChange)">{{ formatSignedYen(tile.dailyChange) }}</span>
            </template>
            <template v-if="tile.profit != null">
              <br>評価損益: <span :class="signedClass(tile.profit)">{{ formatSignedYen(tile.profit) }}</span>
            </template>
            <template v-if="tile.details && tile.details.length > 1">
              <hr class="tooltip-divider">
              <div class="tooltip-details">
                <div v-for="(detail, idx) in tile.details" :key="idx" class="detail-row">
                  <small>{{ detail.institution }}: {{ formatYen(detail.value) }}</small>
                </div>
              </div>
            </template>
          </div>
        </span>
      </article>
    </div>
  </section>
</template>

<style scoped>
.tooltip-content {
  text-align: left;
}
.tooltip-divider {
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  margin: 4px 0;
}
.detail-row {
  white-space: nowrap;
}
</style>
