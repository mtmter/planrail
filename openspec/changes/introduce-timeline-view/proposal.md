## Why

月・週・日のカレンダーは予定と移動の配置を確認できるが、今日これから行う移動の経路を確認するにはJourney詳細を開く必要がある。EventとJourneyを1日の順序で読み、移動中または次のJourneyの行程をその場で確認できる実行向けのTimelineを追加する。

## What Changes

- 月・週・日に「Timeline」を加え、共有の表示基準日と既存の日付操作で選択日を表示する。
- 選択日に重なるEventとStandalone/Event-linked Journeyを独立した時系列項目として表示する。今日の移動中、なければ次のJourneyを自動展開し、ほかのJourneyは必要時にインライン展開する。
- 展開したJourneyに保存済み経路の全行程と最小限の詳細・再計画導線を表示する。Event項目には準備進捗と、条件を満たす場合の移動計画導線を含める。
- 今日の現在時刻境界、日跨ぎ表示、空状態、PCとスマホで使える1カラム配置を追加する。
- Timelineの見出しでは目的地または関連Event名から自然な名称を使う。既存Journey詳細・カレンダーの名称規則は維持する。

## Capabilities

### New Capabilities

- `timeline-view`: 選択日単位の時系列、Journeyの自動・手動展開、Eventと準備、現在境界、日跨ぎ、操作とレスポンシブ表示。

### Modified Capabilities

- `schedule-management`: 既存3表示の切替要件を4表示へ拡張し、共有の表示基準日をTimelineにも引き継ぐ。
- `journeys`: 既存のJourney表示名規則に、Timelineの自然な見出しという表示文脈を追加する。保存形や必須タイトルは変えない。

## Impact

- Frontend: `App.jsx` の表示切替・日付・現在時刻・追加/詳細導線、Timeline表示、既存`JourneyTimeline`/`RouteDetails`系とEvent詳細/Builderの最小限の再利用拡張、日付utility、既存CSSと関連テスト。
- 既存の `users/{uid}/events`、`journeys`、`preparations` を読む。Firestore構造、アクセス規則、backend API、依存関係は変更しない。
- 進行中の `redesign-journey-builder-flow` のedit flowを利用する前提とし、このchangeでBuilder自体の再設計は行わない。
- 対象外: GPS/Geolocation、地図と経路描画、Active Journeyと「移動を開始」、遅延自動検知、リカバリー、リアルタイム追跡、TanStack Query、Cloud Run、PWA、アプリ全体のスマホUI再設計。
