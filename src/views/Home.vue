<script setup>
import { RouterLink } from "vue-router";
import { formatSignedYen, formatYen } from "@/domain/format";
import { useHomeViewModel } from "@/features/home/useHomeViewModel";

const {
  loading,
  error,
  shareMode,
  investmentCard,
  livingCostCard,
  specialExpenseCard,
  milestoneCard,
  freshnessCard,
  monthlyChanges,
  checklistItems,
  toggleChecklistItem,
} = useHomeViewModel();

const monthLabel = (monthKey) => {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-");
  return `${year}年${Number(month)}月`;
};
</script>

<template>
  <section>
    <p v-if="loading">読み込み中...</p>
    <p v-if="error" class="error">{{ error }}</p>

    <h2 class="section-title">今月の判断</h2>

    <!-- ブロックA: アクションカード -->
    <div class="card-grid">
      <article class="card" :class="{ 'is-attention': investmentCard.status === 'attention' }">
        <h2>投資（{{ monthLabel(investmentCard.lastMonth.month) }}・確定分）</h2>
        <p class="amount-value">{{ formatYen(investmentCard.lastMonth.amountYen) }}</p>
        <p class="meta">
          基準 {{ formatYen(investmentCard.standardYen) }} に対して
          <strong v-if="investmentCard.status === 'ok'">基準どおり</strong>
          <strong v-else class="error">要確認（基準未満）</strong>
        </p>
        <p class="meta">
          今月はここまで <span class="amount-value">{{ formatYen(investmentCard.currentMonth.amountYen) }}</span> 実行済み
        </p>
        <p class="meta">
          判定は明細で確認できる本人分（月{{ formatYen(investmentCard.standardYen) }}）が対象です
        </p>
      </article>

      <article class="card" :class="{ 'is-attention': livingCostCard.status === 'attention' }">
        <h2>生活費（{{ monthLabel(livingCostCard.lastMonth.month) }}）</h2>
        <p class="amount-value">{{ formatYen(livingCostCard.lastMonth.amountYen) }}</p>
        <p class="meta">
          直近12か月平均 <span class="amount-value">{{ formatYen(livingCostCard.averageYen) }}</span>
          <template v-if="livingCostCard.status === 'attention'">
            ・<strong class="error">要確認（平均の+10%超）</strong>
          </template>
        </p>
        <ul v-if="livingCostCard.topCategories.length" class="meta card-list">
          <li v-for="category in livingCostCard.topCategories" :key="category.label">
            {{ category.label }}:
            <span class="amount-value">{{ formatYen(category.lastMonthYen) }}</span>
            （平均 <span class="amount-value">{{ formatYen(category.averageYen) }}</span>）
          </li>
        </ul>
        <p class="meta"><RouterLink to="/cash-flow">収支を見る</RouterLink></p>
      </article>

      <article class="card">
        <h2>特別支出</h2>
        <p class="meta">
          {{ monthLabel(specialExpenseCard.lastMonth.month) }}:
          <span class="amount-value">{{ formatYen(specialExpenseCard.lastMonth.totalYen) }}</span>
          ／ {{ monthLabel(specialExpenseCard.currentMonth.month) }}:
          <span class="amount-value">{{ formatYen(specialExpenseCard.currentMonth.totalYen) }}</span>
        </p>
        <ul class="meta card-list">
          <li v-for="item in specialExpenseCard.lastMonth.items" :key="`last-${item.date}-${item.name}`">
            先月: {{ item.name }} <span class="amount-value">{{ formatYen(item.amountYen) }}</span>
          </li>
          <li v-for="item in specialExpenseCard.currentMonth.items" :key="`cur-${item.date}-${item.name}`">
            今月: {{ item.name }} <span class="amount-value">{{ formatYen(item.amountYen) }}</span>
          </li>
          <li v-if="!specialExpenseCard.lastMonth.items.length && !specialExpenseCard.currentMonth.items.length">
            先月・今月とも特別支出はありません
          </li>
        </ul>
        <p class="meta">特別支出は生活費の数字には含まれていません</p>
      </article>

      <article
        v-if="milestoneCard.visible"
        class="card"
        :class="{ 'is-attention': milestoneCard.status === 'attention' }"
      >
        <h2>節目</h2>
        <ul class="card-list">
          <li v-for="item in milestoneCard.items" :key="item.id">
            <strong>{{ item.label }}</strong>（{{ item.periodLabel }}）
            <span v-if="item.state === 'active'" class="error">期間中です</span>
            <span v-else class="meta">あと{{ item.daysUntilStart }}日で開始</span>
            <br><span class="meta">{{ item.description }}</span>
          </li>
        </ul>
      </article>

      <article class="card" :class="{ 'is-attention': freshnessCard.status === 'attention' }">
        <h2>データの鮮度</h2>
        <p v-if="freshnessCard.latestDate" class="meta">
          明細は {{ freshnessCard.latestDate }} 分まで取り込み済み
          <strong v-if="freshnessCard.status === 'attention'" class="error">
            要確認（{{ freshnessCard.ageDays }}日前で止まっています）
          </strong>
        </p>
        <p v-else class="error">明細データがありません</p>
      </article>
    </div>

    <!-- ブロックB: 月次チェックリスト -->
    <section class="table-wrap">
      <h2 class="section-title">月次チェックリスト</h2>
      <ul class="checklist">
        <li v-for="item in checklistItems" :key="item.id">
          <label>
            <input
              type="checkbox"
              :checked="item.checked"
              @change="toggleChecklistItem(item.id)"
            >
            {{ item.label }}
          </label>
        </li>
      </ul>
      <p class="meta">チェックはこの端末にだけ保存され、月が替わると自動でリセットされます。</p>
    </section>

    <!-- ブロックC: 先月からの変化 -->
    <section class="table-wrap">
      <h2 class="section-title">先月からの変化</h2>
      <template v-if="monthlyChanges.available">
        <table>
          <thead>
            <tr><th>項目</th><th>{{ monthLabel(monthlyChanges.month) }}</th><th>前月比</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in monthlyChanges.rows" :key="row.key">
              <td>{{ row.label }}</td>
              <td class="amount-value">{{ formatYen(row.currentYen) }}</td>
              <td class="amount-value">{{ formatSignedYen(row.diffYen) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="meta">月末時点のスナップショット（{{ monthLabel(monthlyChanges.previousMonth) }} → {{ monthLabel(monthlyChanges.month) }}）で比較しています。</p>
      </template>
      <p v-else class="meta">来月から表示されます（月末スナップショットが2か月分たまると表示されます）。</p>
    </section>

    <p v-if="!shareMode" class="meta">
      <RouterLink to="/progress">FIRE進捗を見る</RouterLink>
    </p>
  </section>
</template>

<style scoped>
.card.is-attention {
  border-color: var(--error);
}

.card-list {
  margin: 4px 0;
  padding-left: 18px;
}

.card-list li {
  margin: 2px 0;
}

.checklist {
  list-style: none;
  margin: 0;
  padding: 0;
}

.checklist li {
  margin: 6px 0;
}

.checklist label {
  cursor: pointer;
}
</style>
