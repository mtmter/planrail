## Context

現状の `App.jsx` は `activeView` に月・週・日・tasksを持ち、`loadScheduleData` の戻り値からevents、tasks、preparationsを状態へ設定している。`AddItemModal` は `itemType` で予定とタスクを切り替え、月表示の項目上限や週・日表示の期限欄も予定とタスクを一緒に扱う。preparation reminderは上部とサイドバーに同じ一覧を配置し、画面幅に応じたCSSとタスク表示状態で配置を切り替えている。

Firestore serviceにはtask専用CRUDがあり、`firestore.rules` はuser配下を包括的に保護する。READMEと `docs/architecture.md` はtasksを現在のデータ・機能として記載しており、`travel-plans` specにも「予定とタスクを表示する」という関連記述がある。バックエンドにはtask APIがなく、経路検索と移動予定は予定詳細に結び付いている。

## Goals / Non-Goals

**Goals:**

- 予定のカレンダー表示と作成を維持したまま、独立タスクに関するUI、state、CRUD、読み込み、表示コードを取り除く。
- 独立タスクと予定ごとのpreparationsを別の概念・保存先のまま保ち、既存のpreparation CRUD、準備案内、通知設定を維持する。
- 既存task documentを保持し、Firestore Security Rules、予定・経路検索・移動予定の挙動に変更を加えない。
- README、アーキテクチャ資料、関連する全現行specを新しい製品境界と一致させる。

**Non-Goals:**

- task documentの削除・変換・export、またはユーザー向けデータ移行。
- preparationsのtask化や名称変更、予定・preparationのデータモデル変更。
- FastAPI、Transit provider、Google Places、Firestore Security Rulesの変更。
- `openspec/changes/archive/` や無関係な進行中changeの編集。

## Decisions

1. **タスク状態をアプリの状態・画面から一括して除く。** `App.jsx` からtask state、選択中task、task更新中状態、task CRUD handler、TaskList / TaskDetailsModal参照を削除する。表示モードはmonth / week / dayのまま初期値monthとし、アプリ外枠は常にカレンダー用レイアウトとする。独立タスク画面は削除する。

2. **追加フォームを予定専用コンポーネントにする。** `AddItemModal` のitemType切替、期限入力、タスク検証・保存経路を除き、送信は常にevent CRUDへ通す。コンポーネント名を `AddEventModal` へ変えるのは、汎用item概念が残らないため自然な整理となる。日付や時刻の初期値は既存の月・週・日表示に応じた予定追加動作を保つ。

3. **カレンダーのデータ入力を予定だけにする。** MonthCalendarは予定のみを日付セル、表示上限、残件数、日別一覧へ渡す。WeekCalendar / DayCalendarは期限欄、task用popup状態、クリック処理を除き、既存の予定時間ブロックと空き時間選択を維持する。task専用コンポーネント、タスク期限のdate utility、task専用CSSを削除し、予定側で使う共通スタイルは残す。

4. **Firestoreではeventsとpreparationsを読み込み、task CRUDを公開しない。** `loadScheduleData` はeventsとpreparationsのみを取得して返す。createTask / updateTask / deleteTaskと `users/{uid}/tasks/{taskId}` への参照を削除する。予定、preparations、travelPlansの読み書きと予定削除時の関連preparation・travelPlan削除処理は維持する。Firestore Security Rulesは既存の包括的なuser配下ルールをそのまま使う。

5. **既存task documentには何もしない。** Firestoreに残るdocumentは新アプリから参照しない。データクリーンアップを導入しないため、ロールバック時には保存済みdocumentを使って旧バージョンのtask機能を再度利用できる。

6. **準備案内はカレンダー画面だけのresponsive配置として保つ。** 月・週・日しかないため、デスクトップ幅では左サイドバー、720px以下では画面上部という既存の配置構造を残し、task表示による条件分岐だけをなくす。preparation reminder listと設定状態、期限再計算ロジックは変更しない。

7. **現行仕様と利用者向け資料からtask機能の説明を除く。** 指定された `schedule-management`、`authentication-and-persistence`、`preparations` に加え、task表示を記載している `travel-plans` も更新する。README、`docs/architecture.md`、ログイン説明の製品紹介文を更新する。これは確認した既存記述との整合のためで、route-search資料と過去のarchiveは変更しない。

## Risks / Trade-offs

- [既存task documentがFirestoreに残り続ける] → これは意図した互換動作であり、画面とコードからtasksを参照しないことを確認する。データ削除を伴わないため、ロールバックでは旧アプリが既存documentを再利用できる。
- [共有する追加フォームやカレンダーCSSの整理で予定機能を誤って壊す] → event専用フォームへの整理後に予定追加・編集・削除、月表示の表示上限、週・日表示の時間軸を確認する。
- [task表示条件を除く際に準備案内の配置が変わる] → 721px以上と720px以下の両方で、デスクトップのサイドバーとモバイルの画面上部表示、通知設定と準備完了後の案内除外を確認する。
- [task削除とは無関係な移動・経路機能へ回帰が及ぶ] → FastAPIやroute providerのコードを変更せず、既存backend unittestに加え、予定詳細からの経路検索と移動予定表示を回帰確認する。

## Migration Plan

データ移行は行わない。新しいフロントエンドをデプロイするとtasksは読み書きされなくなり、既存documentはFirestoreに保持される。問題があればフロントエンドを旧版へ戻せる。Security Rulesとバックエンドのデプロイは不要。

## Open Questions

なし。task documentの保持、preparationsの維持、変更するspec範囲は依頼で確定している。
