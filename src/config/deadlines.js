/**
 * トップページ（ホーム）の「期限のあるアクション」の静的設定リスト。
 *
 * 判定・並び替え・カウントダウンのロジックは @/domain/home の
 * buildDeadlineItems が担い、ここはデータだけを持つ。
 * 項目の追加・変更・削除はこのファイルを編集するだけでよい。
 *
 * kind の意味:
 * - "window": 申請期間など開始日と終了日があるもの。
 *   開始45日前から表示し、期間中は締切までの日数を数える。
 * - "deadline": 締切日（endDate）だけがあるもの。
 *   締切45日前から表示し、締切までの日数を数える。過ぎると消える。
 * - "available-from": 開始日（startDate）から対応可能になるもの。
 *   開始45日前から「あと◯日で可能になります」と表示し、
 *   開始日以降は「対応可能」として残る（終了日はない）。
 *
 * 日付は "YYYY-MM-DD"（その日の終わりまで有効）で書く。
 */
export const DEADLINE_DEFINITIONS = [
  {
    id: "ideco-increase-application",
    label: "iDeCo掛金の増額申請",
    note: "楽天証券 e-iDeCo の掛金増額申請ができる期間です。申請するか・いくらにするかは未決定です。",
    kind: "window",
    startDate: "2026-12-01",
    endDate: "2026-12-24",
  },
  {
    id: "share-link-expiry",
    label: "一時アクセスリンクの失効",
    note: "失効したら、新しい一時アクセスリンクの再発行が必要です。",
    kind: "deadline",
    endDate: "2026-12-02",
  },
  {
    id: "chatgpt-business-cancel",
    label: "ChatGPT Business の解約",
    note: "1月10日の更新前に解約します（解約方針は決定済み、手続きは未実施）。",
    kind: "deadline",
    endDate: "2027-01-09",
  },
  {
    id: "openmoney-repost",
    label: "OpenMoney 資産レポートの再投稿",
    note: "前回の投稿（2026年10月30日）から90日が経過し、再投稿できるようになります。",
    kind: "available-from",
    startDate: "2027-01-28",
  },
];
