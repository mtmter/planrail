## Why

月・週・日のカレンダーは予定と移動の配置を確認できるが、今日これから行う移動の経路を確認するにはJourney詳細を開く必要がある。EventとJourneyを1日の順序で読み、移動中または次のJourneyの行程をその場で確認できる実行向けのTimelineを追加する。

## What Changes

- 月・週・日に「Timeline」を加え、4表示の切替だけでは共有の `selectedDate` を変えない。現行の月→週切替で日付を書き換える特殊処理も解消する。
- 選択日に重なるEventとStandalone/Event-linked Journeyを独立した時系列項目として表示する。今日の移動中、なければ次のJourneyを自動展開し、ほかのJourneyは必要時にインライン展開する。
- 展開したJourneyに保存済み経路の全行程と最小限の詳細・再計画導線を表示する。Event項目には準備進捗と、条件を満たす場合の移動計画導線を含める。
- Timelineの「移動を計画」はJourneyがなく、目的地を検索でき、Event由来の到着期限が現在より後の場合に限る。期限後はその状態を示し、リカバリー検索は行わない。
- 今日の現在時刻境界、日跨ぎ表示、空状態、PCとスマホで使える1カラム配置を追加する。
- TimelineのJourney大見出しはEvent-linkedなら `{event.title}へ`、Standaloneなら目的地または旧FIXED-onlyの最後の降車地点から `{地点名}へ移動` とする。既存Journey詳細・カレンダーの名称規則は維持する。
- Event編集でJourney targetの目的地・到着期限が変わるか、検索可能だった目的地の有効座標を失う場合、Event更新とEvent-linked Journey削除を原子的に行う。targetに影響しない編集では維持し、削除後は通常の「移動予定なし」状態へ戻す。

## Capabilities

### New Capabilities

- `timeline-view`: 選択日単位の時系列、Journeyの自動・手動展開、Eventと準備、現在境界、日跨ぎ、操作とレスポンシブ表示。

### Modified Capabilities

- `schedule-management`: 既存3表示の切替要件を4表示へ拡張し、全view切替で `selectedDate` を維持する。Event更新時の関連Journey削除を予定管理要件へ加える。
- `journeys`: Event-linked Journeyのtarget依存関係と削除条件、TimelineのJourney名称規則を加える。保存形や必須タイトルは変えない。
- `authentication-and-persistence`: Event更新と必要なEvent-linked Journey削除をFirestore上で同じ原子的な書き込みとして扱う。

## Impact

- Frontend: `App.jsx` の全view切替・日付・現在時刻・追加/詳細導線とEvent/Journey状態更新、Timeline表示、既存`JourneyTimeline`/`RouteDetails`系とEvent詳細/Builderの最小限の再利用拡張、日付utility、既存CSSと関連テスト。
- Persistence: 既存の `users/{uid}/events` と `journeys/event-{eventId}` に対する原子的な更新・条件付き削除。Firestore構造、アクセス規則、backend API、依存関係は変更しない。
- 進行中の `redesign-journey-builder-flow` のedit flowを利用する前提とし、このchangeでBuilder自体の再設計は行わない。
- 対象外: GPS/Geolocation、地図と経路描画、Active Journeyと「移動を開始」、遅延自動検知、リカバリー、リアルタイム追跡、TanStack Query、Cloud Run、PWA、アプリ全体のスマホUI再設計。
