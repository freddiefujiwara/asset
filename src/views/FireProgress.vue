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
  bothReached,
  primaryProgress,
  secondaryProgress,
  trendRows,
  hasAnyTrend,
  sideDeltaLabel,
  fullDeltaLabel,
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
        <h2 class="section-title">
          <template v-if="bothReached">FIRE進捗</template>
          <template v-else-if="primaryProgress">FIRE進捗（{{ primaryProgress.label }}が主指標）</template>
          <template v-else>FIRE進捗</template>
        </h2>
        <p v-if="bothReached" class="meta">
          サイドFIRE・完全FIREともに、現在の前提ではすでに到達可能な水準です。
          前提を変えて試す場合は <RouterLink to="/fire">FIRE計算</RouterLink> を使ってください。
        </p>
        <p v-else-if="primaryProgress?.kind === 'full'" class="meta">
          サイドFIRE（週3勤務で年収 {{ formatYen(progress.sideFireAnnualIncomeYen) }} の収入が続く場合）は、
          現在の前提ではすでに到達可能な水準のため、主指標を完全FIRE（収入ゼロ前提）に切り替えています。
          完全FIREは総資産を対象に計算しています。
          前提を変えて試す場合は <RouterLink to="/fire">FIRE計算</RouterLink> を使ってください。
        </p>
        <p v-else class="meta">
          前提: 週3勤務で年収 {{ formatYen(progress.sideFireAnnualIncomeYen) }} の収入が続く場合。
          FIRE対象資産は総資産から大学資金 {{ formatYen(universityFundYen) }} を除いた額です。
          前提を変えて試す場合は <RouterLink to="/fire">FIRE計算</RouterLink> を使ってください。
        </p>

        <template v-if="primaryProgress">
          <div class="progress-headline">
            <div>
              <p class="progress-rate amount-value">
                {{ primaryProgress.progressRatePct != null ? `${primaryProgress.progressRatePct.toFixed(1)}%` : "—" }}
              </p>
              <p class="meta">{{ primaryProgress.rateLabel }}</p>
            </div>
            <div class="progress-bar" role="img" :aria-label="`${primaryProgress.label}到達率`">
              <div
                class="progress-bar-fill"
                :style="{ width: `${Math.min(100, Math.max(0, primaryProgress.progressRatePct ?? 0))}%` }"
              ></div>
            </div>
          </div>

          <table>
            <tbody>
              <tr>
                <th>総資産</th>
                <td class="amount-value">{{ formatYen(progress.totalAssetsYen) }}</td>
              </tr>
              <tr v-if="primaryProgress.baseAssetsLabel">
                <th>{{ primaryProgress.baseAssetsLabel }}</th>
                <td class="amount-value">{{ formatYen(primaryProgress.baseAssetsYen) }}</td>
              </tr>
              <tr>
                <th>必要資産（{{ primaryProgress.label }}）</th>
                <td class="amount-value">{{ primaryProgress.requiredAssetsYen != null ? formatYen(primaryProgress.requiredAssetsYen) : "—" }}</td>
              </tr>
              <tr>
                <th>あと必要</th>
                <td class="amount-value">{{ primaryProgress.gapYen != null ? formatYen(primaryProgress.gapYen) : "—" }}</td>
              </tr>
              <tr>
                <th>到達見込み</th>
                <td>
                  <template v-if="primaryProgress.alreadyReached">
                    現在の前提では、すでに到達可能な水準です
                  </template>
                  <template v-else-if="primaryProgress.reached">
                    あと{{ primaryProgress.durationLabel }}（{{ primaryProgress.dateLabel }}・{{ primaryProgress.ageLabel }}時点）
                  </template>
                  <template v-else>現在の前提では見込みが立ちません</template>
                </td>
              </tr>
            </tbody>
          </table>
        </template>

        <table v-else-if="bothReached">
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
              <th>サイドFIRE</th>
              <td>
                到達率 {{ sideProgress.progressRatePct != null ? `${sideProgress.progressRatePct.toFixed(1)}%` : "—" }}
                ・現在の前提では到達可能な水準です
              </td>
            </tr>
            <tr>
              <th>完全FIRE</th>
              <td>
                到達率 {{ fullProgress.progressRatePct != null ? `${fullProgress.progressRatePct.toFixed(1)}%` : "—" }}
                ・現在の前提では到達可能な水準です
              </td>
            </tr>
          </tbody>
        </table>

        <p v-if="secondaryProgress" class="meta">
          補助指標（{{ secondaryProgress.label }}<template v-if="secondaryProgress.kind === 'full'">・収入ゼロ前提</template><template v-else>・週3勤務で年収 {{ formatYen(progress.sideFireAnnualIncomeYen) }} の収入が続く前提</template>）:
          <template v-if="secondaryProgress.achieved">
            達成済み（到達率 {{ secondaryProgress.progressRatePct != null ? `${secondaryProgress.progressRatePct.toFixed(1)}%` : "—" }}・現在の前提では到達可能な水準です）
          </template>
          <template v-else>
            到達率 {{ secondaryProgress.progressRatePct != null ? `${secondaryProgress.progressRatePct.toFixed(1)}%` : "—" }}
            ・必要資産
            <span class="amount-value">{{ secondaryProgress.requiredAssetsYen != null ? formatYen(secondaryProgress.requiredAssetsYen) : "—" }}</span>
            <template v-if="secondaryProgress.reached">
              ・あと{{ secondaryProgress.durationLabel }}（{{ secondaryProgress.dateLabel }}・{{ secondaryProgress.ageLabel }}時点）
            </template>
            <template v-else>・現在の前提では見込みが立ちません</template>
          </template>
        </p>
      </section>

      <section class="table-wrap">
        <h2 class="section-title">推移（到達率と到達見込み）</h2>
        <template v-if="hasAnyTrend">
          <table>
            <thead>
              <tr>
                <th>月</th><th>FIRE対象資産</th><th>到達率</th>
                <th>到達見込み（サイドFIRE）</th><th>到達見込み（完全FIRE）</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in trendRows" :key="row.month">
                <td>{{ monthLabel(row.month) }}</td>
                <td class="amount-value">{{ formatYen(row.fireTargetAssetsYen) }}</td>
                <td>{{ row.progressRate != null ? `${(row.progressRate * 100).toFixed(1)}%` : "—" }}</td>
                <td>{{ row.sideProjectedLabel }}</td>
                <td>{{ row.fullProjectedLabel }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="sideDeltaLabel" class="meta">サイドFIRE: {{ sideDeltaLabel }}</p>
          <p v-if="fullDeltaLabel" class="meta">完全FIRE: {{ fullDeltaLabel }}</p>
          <p class="meta">到達率は、必要資産を現在の前提で計算した値で固定して比較しています。</p>
          <p class="meta">
            到達見込みは、各月の資産・収支（12か月平均）を現在の前提（利回り・月額投資など）で
            エンジンに差し替えて振り返り計算したものです。前提が当時と異なるため、
            当時の見込みそのものではありません。
          </p>
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
