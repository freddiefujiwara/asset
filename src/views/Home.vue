<script setup>
import { RouterLink } from "vue-router";
import { formatSignedYen, formatYen } from "@/domain/format";
import { formatSignedPercent } from "@/domain/signed";
import { useHomeViewModel } from "@/features/home/useHomeViewModel";

const {
  loading,
  error,
  shareMode,
  headline,
  assetDaily,
  attention,
  recentExpenses,
  fireSummary,
} = useHomeViewModel();

const monthLabel = (monthKey) => {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-");
  return `${year}年${Number(month)}月`;
};

const dateLabel = (dateKey) => {
  if (!dateKey) return "";
  const [, month, day] = dateKey.split("-").map(Number);
  return `${month}月${day}日`;
};

const signedClass = (value) => (value > 0 ? "is-positive" : value < 0 ? "is-negative" : "");
</script>

<template>
  <section>
    <p v-if="loading">読み込み中...</p>
    <p v-if="error" class="error">{{ error }}</p>

    <!-- 1. 一行の結論 -->
    <section class="table-wrap">
      <h2 class="section-title">今月の結論</h2>
      <template v-if="headline.hasComparison">
        <p class="headline-line">
          純資産は <span class="amount-value">{{ formatYen(headline.netAssetsYen) }}</span>
          （{{ monthLabel(headline.month) }}末・先月比
          <span class="amount-value">{{ formatSignedYen(headline.diffYen) }}</span><template v-if="headline.diffRatePct != null">（{{ formatSignedPercent(headline.diffRatePct, 1) }}）</template>）
          <template v-if="headline.pace === 'improving'">
            。完全FIREの到達見込みは先月より{{ headline.projectionDeltaMonths }}か月近づきました。
          </template>
          <template v-else-if="headline.pace === 'worsening'">
            。完全FIREの到達見込みは先月より{{ -headline.projectionDeltaMonths }}か月遠のきました。
          </template>
          <template v-else-if="headline.pace === 'steady'">
            。完全FIREの到達見込みは先月から変わりません。
          </template>
        </p>
      </template>
      <p v-else class="headline-line">
        現在の純資産は <span class="amount-value">{{ formatYen(headline.netAssetsYen) }}</span> です。
        <span class="meta">先月比は来月から表示されます（月末スナップショットが2か月分たまると表示されます）。</span>
      </p>
    </section>

    <!-- 2. 資産推移（前日比と主な原因） -->
    <section class="table-wrap">
      <h2 class="section-title">資産推移</h2>
      <template v-if="assetDaily.hasData">
        <p class="headline-line">
          リスク資産は前日比
          <span class="amount-value" :class="signedClass(assetDaily.totalDailyChangeYen)">
            {{ formatSignedYen(assetDaily.totalDailyChangeYen) }}<template v-if="assetDaily.totalChangeRatePct != null">（{{ formatSignedPercent(assetDaily.totalChangeRatePct, 1) }}）</template>
          </span>
          （現在 <span class="amount-value">{{ formatYen(assetDaily.riskAssetsYen) }}</span>）
        </p>
        <p class="meta">前日比への寄与が大きい銘柄：</p>
        <ul class="daily-list">
          <li v-for="contributor in assetDaily.contributors" :key="contributor.name">
            {{ contributor.name }}
            <span class="amount-value" :class="signedClass(contributor.changeYen)">
              {{ formatSignedYen(contributor.changeYen) }}<template v-if="contributor.changeRatePct != null">（{{ formatSignedPercent(contributor.changeRatePct, 1) }}）</template>
            </span>
          </li>
        </ul>
        <p v-if="assetDaily.rowsWithData < assetDaily.rowsTotal" class="meta">
          ※ 前日比は、値がある {{ assetDaily.rowsWithData }}／{{ assetDaily.rowsTotal }} 銘柄分だけを集計しています。
        </p>
      </template>
      <p v-else class="meta">
        前日比のデータがありません（リスク資産は現在
        <span class="amount-value">{{ formatYen(assetDaily.riskAssetsYen) }}</span>）。
      </p>
    </section>

    <!-- 3. 要確認（最大3件） -->
    <section class="table-wrap">
      <h2 class="section-title">要確認</h2>
      <template v-if="attention.items.length">
        <ul class="attention-list">
          <li v-for="item in attention.items" :key="item.id">
            <template v-if="item.kind === 'freshness'">
              <strong class="error">明細の取り込みが止まっています</strong>
              <span v-if="item.latestDate" class="meta">
                （最新は {{ item.latestDate }} 分・{{ item.ageDays }}日前）
              </span>
              <span v-else class="meta">（明細データがありません）</span>
            </template>
            <template v-else-if="item.kind === 'investment'">
              <strong class="error">先月（{{ monthLabel(item.month) }}）の投資実行額が基準未満でした</strong>
              <span class="meta">
                （<span class="amount-value">{{ formatYen(item.amountYen) }}</span>／基準
                <span class="amount-value">{{ formatYen(item.standardYen) }}</span>・判定は本人分のみ）
              </span>
            </template>
            <template v-else-if="item.kind === 'category'">
              <strong class="error">{{ item.label }}が12か月平均を大きく上回りました</strong>
              <span class="meta">
                （先月 <span class="amount-value">{{ formatYen(item.monthYen) }}</span>／平均
                <span class="amount-value">{{ formatYen(item.averageYen) }}</span><template v-if="item.ratioPct != null">・+{{ item.ratioPct }}%</template>）
              </span>
              <ul v-if="item.topExpenses.length" class="top-expenses">
                <li v-for="(expense, index) in item.topExpenses" :key="index">
                  {{ dateLabel(expense.date) }} {{ expense.name }}
                  <span class="amount-value">{{ formatYen(expense.amountYen) }}</span>
                </li>
              </ul>
            </template>
            <template v-else-if="item.kind === 'living-cost'">
              <strong class="error">生活費が12か月平均の+10%を超えました</strong>
              <span class="meta">
                （先月 <span class="amount-value">{{ formatYen(item.amountYen) }}</span>／平均
                <span class="amount-value">{{ formatYen(item.averageYen) }}</span>）
              </span>
            </template>
            <template v-else-if="item.kind === 'special'">
              <strong class="error">先月に大きな特別支出がありました</strong>
              <span class="meta">
                （{{ item.name }} <span class="amount-value">{{ formatYen(item.amountYen) }}</span>）
              </span>
            </template>
            <RouterLink v-if="item.linkTo" :to="item.linkTo">詳細を見る</RouterLink>
          </li>
        </ul>
        <p v-if="attention.totalCount > attention.items.length" class="meta">
          ほか{{ attention.totalCount - attention.items.length }}件あります。詳細は収支画面で確認できます。
        </p>
      </template>
      <p v-else class="meta">要確認はありません。</p>
    </section>

    <!-- 4. 過去3日間の支出 -->
    <section class="table-wrap">
      <h2 class="section-title">過去3日間の支出</h2>
      <template v-if="recentExpenses.hasData">
        <p class="meta">
          {{ dateLabel(recentExpenses.fromDate) }}〜{{ dateLabel(recentExpenses.latestDate) }}の支出
          （明細の最新日を末日にしています）。合計
          <span class="amount-value">{{ formatYen(recentExpenses.totalYen) }}</span>
        </p>
        <template v-for="group in recentExpenses.groups" :key="group.date">
          <h3 class="day-title">
            {{ dateLabel(group.date) }}
            <span class="meta">（<span class="amount-value">{{ formatYen(group.totalYen) }}</span>）</span>
          </h3>
          <ul class="expense-list">
            <li v-for="(expense, index) in group.items" :key="index">
              {{ expense.name }}
              <span class="meta">{{ expense.category }}</span>
              <span class="amount-value">{{ formatYen(expense.amountYen) }}</span>
            </li>
          </ul>
        </template>
      </template>
      <p v-else class="meta">過去3日間の支出は記録されていません。</p>
    </section>

    <!-- 5. FIRE進捗の要点（共有モードでは出さない） -->
    <section v-if="!shareMode && fireSummary" class="table-wrap">
      <h2 class="section-title">FIRE進捗の要点（完全FIRE）</h2>
      <div class="progress-headline">
        <div>
          <p class="progress-rate amount-value">
            {{ fireSummary.progressRatePct != null ? `${fireSummary.progressRatePct.toFixed(1)}%` : "—" }}
          </p>
          <p class="meta">到達率（総資産 ÷ 必要資産）</p>
        </div>
        <div class="progress-bar" role="img" aria-label="完全FIRE到達率">
          <div
            class="progress-bar-fill"
            :style="{ width: `${Math.min(100, Math.max(0, fireSummary.progressRatePct ?? 0))}%` }"
          ></div>
        </div>
      </div>
      <p class="meta">
        <template v-if="fireSummary.alreadyReached">
          現在の前提では、すでに到達可能な水準です。
        </template>
        <template v-else-if="fireSummary.reached">
          到達見込みは {{ fireSummary.dateLabel }}（{{ fireSummary.ageLabel }}時点・あと{{ fireSummary.durationLabel }}）。
          必要資産 <span class="amount-value">{{ formatYen(fireSummary.requiredAssetsYen) }}</span>、
          あと <span class="amount-value">{{ formatYen(fireSummary.gapYen) }}</span> です。
        </template>
        <template v-else>現在の前提では到達見込みが立ちません。</template>
        <template v-if="fireSummary.hasTrend && fireSummary.deltaMonths != null">
          <template v-if="fireSummary.deltaMonths > 0">
            先月より見込みが{{ fireSummary.deltaMonths }}か月近づきました。
          </template>
          <template v-else-if="fireSummary.deltaMonths < 0">
            先月より見込みが{{ -fireSummary.deltaMonths }}か月遠のきました。
          </template>
          <template v-else>先月から見込みは変わりません。</template>
        </template>
      </p>
      <p class="meta"><RouterLink to="/progress">FIRE進捗の詳細を見る</RouterLink></p>
    </section>
  </section>
</template>

<style scoped>
.headline-line {
  font-size: 1.1rem;
  margin: 4px 0;
}

.attention-list {
  margin: 0;
  padding-left: 18px;
}

.attention-list li {
  margin: 6px 0;
}

.top-expenses {
  margin: 4px 0 4px 18px;
  padding: 0;
}

.daily-list,
.expense-list {
  margin: 0;
  padding-left: 18px;
}

.daily-list li,
.expense-list li {
  margin: 4px 0;
}

.day-title {
  margin: 10px 0 4px;
  font-size: 1rem;
}

.progress-headline {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.progress-rate {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
}

.progress-bar {
  flex: 1;
  min-width: 160px;
  height: 12px;
  background: var(--border);
  border-radius: 999px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--primary);
}
</style>
