## Why

PlanRailの中心価値を、予定に対する移動・出発・準備の支援に絞る。独立したタスク管理は汎用ToDoアプリの再実装へ広がるため、予定に紐づく準備項目を維持したまま、独立タスク機能を製品境界から取り除く。

## What Changes

- **BREAKING** 独立タスクの一覧、追加、編集、削除、完了状態、期限、詳細を削除し、ヘッダーと月・週・日の表示からタスクへの導線と表示をなくす。カレンダー表示は月・週・日の3種類で、初期表示は月のままとする。
- 「追加」は常に予定追加を開く。現在の予定・タスク兼用モーダルを予定専用にし、実装上自然な範囲で汎用名も予定専用名へ整理する。
- フロントエンドのtask state、TaskList / TaskDetailsModal、task CRUD、各カレンダーのtask props・期限欄・一覧ポップアップ、タスク専用スタイルと期限ユーティリティを削除する。
- 起動時の読み込みと以後の書き込みからFirestoreの `users/{uid}/tasks/{taskId}` を外す。既存task documentはそのまま残し、自動削除や移行処理を追加しない。Firestore Security Rulesの包括的なuser配下ルールは変更しない。
- 予定ごとのpreparations、準備案内、通知設定は維持する。準備案内はデスクトップの月・週・日表示では左サイドバー、モバイル幅では画面上部に置き、「タスク表示」の条件をなくす。
- README、アーキテクチャ資料、および影響する現行OpenSpec capabilityを、タスク機能のないプロダクト境界に合わせる。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `schedule-management`: 月・週・日のみの表示、予定だけを表示するカレンダー、予定専用の追加操作を定義し、独立タスク管理要件を除く。
- `authentication-and-persistence`: 認証後にtasksを読み込まず、events / preparations / travelPlansのみを扱うデータ境界を定義する。
- `preparations`: デスクトップとモバイルの配置を維持しつつ、タスク表示を条件から除いた準備案内レイアウトを定義する。
- `travel-plans`: カレンダー表示のシナリオに残る「予定とタスク」の記述を、タスク削除後の表示契約に合わせる。

## Impact

- 主な実装対象は `frontend/src/App.jsx`、`firestoreService.js`、`dateUtils.js`、`AddItemModal.jsx`、`MonthCalendar.jsx`、`WeekCalendar.jsx`、`DayCalendar.jsx`、`App.css`。独立タスク専用の `TaskList.jsx` と `TaskDetailsModal.jsx` は削除対象。
- READMEと `docs/architecture.md` の機能説明、Firestoreデータ一覧、初回読み込み説明を更新する。バックエンド経路APIとroute provider、Google Places、予定・準備・移動予定の挙動には変更を加えない。
- 既存のFirestore task documentは未参照のまま残す。新しいデータクリーンアップ、Firestore Security Rules変更、アーカイブ変更は行わない。
- 完了条件では、タスク導線・表示・CRUD・Firestore読み込みがないこと、preparationsが使えること、予定・経路検索・移動予定の回帰がないこと、README / docs / current specsの一致、frontend lint / build成功を確認する。
