<script setup>
import { RouterLink } from "vue-router";
import { formatYen } from "@/domain/format";
import { useFireProgressViewModel } from "@/features/progress/useFireProgressViewModel";

const {
  loading,
  error,
  shareMode,
  progress,
  sideProgress,
  fullProgress,
  trend,
  milestones,
  universityFundYen,
} = useFireProgressViewModel();

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

    <section v-if="shareMode" class="table-wrap">
      <h2 class="section-title">FIRE進捗</h2>
      <p class="meta">一時リンク（共有モード）ではFIRE進捗は表示されません。</p>
    </section>

    <template v-else-if="progress && sideProgress">
      <section class="table-wrap">
        <h2 class="section-title">FIRE進捗（サイドFIREが主指標）</h2>
        <p class="meta">
          前提: 週3勤務で年収 {{ formatYen(progress.sideFireAnnualIncomeYen) }} の収入が続く場合。
          FIRE対象資産は総資産から大学資金 {{ formatYen(universityFundYen) }} を除いた額です。
          前提を変えて試す場合は <RouterLink to="/fire">FIRE計算</RouterLink> を使ってください。
        </p>

        <div class="progress-headline">
          <div>
            <p class="progress-rate amount-value">
              {{ sideProgress.progressRatePct != null ? `${sideProgress.progressRatePct.toFixed(1)}%` : "—" }}
            </p>
            <p class="meta">到達率（FIRE対象資産 ÷ 必要資産）</p>
          </div>
          <div class="progress-bar" role="img" aria-label="サイドFIRE到達率">
            <div
              class="progress-bar-fill"
              :style="{ width: `${Math.min(100, Math.max(0, sideProgress.progressRatePct ?? 0))}%` }"
            ></div>
          </div>
        </div>

        <table>
          <tbody>
            <tr>
              <th>総資産</th>
              <td class="amount-value">{{ formatYen(progress.totalAssetsYen) }}</td>
            </tr>
            <tr>
              <th>FIRE対象資産（大学資金を除く）</th>
              <td class="amount-value">{{ formatYen(progress.fireTargetAssetsYen) }}</td>
            </tr>
            <tr>
              <th>必要資産（サイドFIRE）</th>
              <td class="amount-value">{{ sideProgress.requiredAssetsYen != null ? formatYen(sideProgress.requiredAssetsYen) : "—" }}</td>
            </tr>
            <tr>
              <th>あと必要</th>
              <td class="amount-value">{{ sideProgress.gapYen != null ? formatYen(sideProgress.gapYen) : "—" }}</td>
            </tr>
            <tr>
              <th>到達見込み</th>
              <td>
                <template v-if="sideProgress.alreadyReached">
                  現在の前提では、すでに到達可能な水準です
                </template>
                <template v-else-if="sideProgress.reached">
                  あと{{ sideProgress.durationLabel }}（{{ sideProgress.dateLabel }}・{{ sideProgress.ageLabel }}時点）
                </template>
                <template v-else>現在の前提では見込みが立ちません</template>
              </td>
            </tr>
          </tbody>
        </table>

        <p v-if="fullProgress" class="meta">
          補助指標（完全FIRE・収入ゼロ前提）: 必要資産
          <span class="amount-value">{{ fullProgress.requiredAssetsYen != null ? formatYen(fullProgress.requiredAssetsYen) : "—" }}</span>
          <template v-if="fullProgress.alreadyReached">・到達可能な水準です</template>
          <template v-else-if="fullProgress.reached">
            ・あと{{ fullProgress.durationLabel }}（{{ fullProgress.dateLabel }}・{{ fullProgress.ageLabel }}時点）
          </template>
        </p>
      </section>

      <section class="table-wrap">
        <h2 class="section-title">到達率の推移</h2>
        <template v-if="trend.hasTrend">
          <table>
            <thead>
              <tr><th>月</th><th>FIRE対象資産</th><th>到達率</th></tr>
            </thead>
            <tbody>
              <tr v-for="point in trend.points" :key="point.month">
                <td>{{ monthLabel(point.month) }}</td>
                <td class="amount-value">{{ formatYen(point.fireTargetAssetsYen) }}</td>
                <td>{{ point.progressRate != null ? `${(point.progressRate * 100).toFixed(1)}%` : "—" }}</td>
              </tr>
            </tbody>
          </table>
          <p class="meta">必要資産は現在の前提で計算した値で固定して比較しています。</p>
        </template>
        <p v-else class="meta">
          推移は来月から表示されます（月末スナップショットが2か月分たまると表示されます）。
        </p>
      </section>

      <section class="table-wrap">
        <h2 class="section-title">節目の年表</h2>
        <ul class="milestone-list">
          <li v-for="milestone in milestones" :key="milestone.id">
            <strong>{{ milestone.dateLabel }}</strong>（{{ milestone.ageLabel }}）: {{ milestone.label }}
          </li>
        </ul>
      </section>
    </template>
  </section>
</template>

<style scoped>
.progress-headline {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
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

.milestone-list {
  margin: 0;
  padding-left: 18px;
}

.milestone-list li {
  margin: 4px 0;
}
</style>
