<script setup>
import { computed } from "vue";
import { formatYen } from "@/domain/format";

const props = defineProps({
  title: { type: String, required: true },
  amountYen: { type: Number, default: 0 },
  count: { type: Number, default: 0 },
});

const safeCount = computed(() => Number(props.count) || 0);
</script>

<template>
  <article class="card">
    <h3 class="section-title">{{ title }}</h3>
    <p class="amount-value">{{ formatYen(amountYen) }}</p>
    <p class="meta">{{ safeCount }}件</p>
  </article>
</template>
