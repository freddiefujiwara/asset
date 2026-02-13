<script setup>
import { formatYen } from "@/domain/format";

defineProps({
  items: { type: Array, required: true },
});
</script>

<template>
  <div class="table-wrap">
    <h3 class="section-title">明細一覧</h3>
    <table class="stack-table">
      <thead>
        <tr>
          <th>日付</th>
          <th>内容</th>
          <th>カテゴリ</th>
          <th>金額</th>
          <th style="text-align: center;">振替</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, i) in items" :key="i">
          <td data-label="日付">{{ item.date }}</td>
          <td data-label="内容">{{ item.name }}</td>
          <td data-label="カテゴリ">{{ item.category || "未分類" }}</td>
          <td data-label="金額" :class="item.isTransfer ? '' : (item.amount > 0 ? 'is-positive' : 'is-negative')">
            <span class="amount-value">{{ formatYen(item.amount) }}</span>
          </td>
          <td data-label="振替" style="text-align: center;">
            <span v-if="item.isTransfer" title="振替">✔</span>
          </td>
        </tr>
        <tr v-if="items.length === 0">
          <td colspan="5" style="text-align: center; padding: 20px; color: var(--muted);">
            該当する明細はありません
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
