## Why

`introduce-journey-builder` は Journey の保存と経路検索を実装したが、初期画面に `ROUTE` や区間単位の検索操作を露出し、ユーザーが完成まで内部 section を組み立てる必要がある。保存済み Journey の編集導線もなく、詳細表示は複数の Route 詳細を縦積みした印象になっている。Places の選択状態も Event 入力と異なり、候補選択済みの地点で検索できない事例がある。

## What Changes

- Builder を「出発地・目的地・到着期限・任意の固定移動」から一度の検索で全行程を構築する画面へ変更する。Event-linked は目的地と期限を現在の Event から設定する。
- Builder を入力 → 検索中 → 完成した移動予定の確認という3状態にし、検索後は一本のタイムラインを主要表示とする。「条件を変更」で入力へ戻り、入力フォームと結果一覧を常時併置しない。
- 固定移動を時刻順に並べ、必要な公共交通 gap と時間制約を自動導出し、全 gap を検索する。推奨候補を初期選択し、一部失敗は地点間ごとに示す。候補変更は検索後の任意操作とする。
- 固定移動の追加は入力画面の「固定移動を追加」に一本化し、区間上の挿入操作を廃止する。
- 保存済み Journey を詳細から編集・削除できるようにする。編集時は入力条件を復元し、条件変更後は全 gap を一括再検索して同じ文書を更新する。
- 選択済み Places 表示をEventとJourneyで同じ共通コンポーネントへ統一する。追加モーダルのタブと一本の縦型タイムラインには既存・過去の UI 部品と CSS を使い、Journey独自のvisual languageを作らない。ユーザー向けの内部用語を取り除く。
- Builderの内容とmodal shellを分け、グローバル追加タブとEvent詳細のどちらでも二重backdrop/dialogを作らない。
- Places 選択から検索 request までの PlacePoint 伝搬を検証し、フロントエンドの状態不整合と Transit の経路なしを区別する。

## Capabilities

### Modified Capabilities

- `journeys`: Builder 入力、固定移動、gap 導出と一括検索、結果、保存、編集・削除、詳細と用語。
- `places-and-route-search`: Journey の選択済み地点 UI と検索リクエストの一貫性。既存 API の地点と時間制約を利用する。
- `schedule-management`: グローバル追加を「予定 / 移動予定」タブに変更し、カレンダーからの予定追加は維持する。

## Impact

- Frontend: Journey Builder/draft/serializer、Journey 詳細とカレンダー選択、Event 詳細、追加モーダル、共通 Places 入力、既存 RouteDetails/CSS、Firestore service と関連テスト。
- Backend: `POST /api/route-search` の契約は原則維持する。Places 選択後の検索失敗がフロントエンドで再現するか、endpoint 解決または Transit の経路なしなのかを切り分け、契約内の不具合が確認された場合だけ修正する。
- Firestore: `users/{uid}/journeys/{journeyId}` の Journey/section/Route 保存形を維持し、既存 ID への更新と文書削除を追加する。旧 `travelPlans` 移行は扱わない。
- 対象外: 経路の組み合わせ最適化、区間ごとの再検索操作、新しい一括検索 API、予約サービス連携、到着余裕時間の新仕様、無関係なカレンダー改修。

実装済みの `unify-event-place-field` と `introduce-journey-builder` は、このchangeのレビュー時にその順でcanonical specsへ同期し、archiveした。本changeの `MODIFIED` / `REMOVED` は同期後のcanonicalを基準とする。先行 `introduce-journey-builder` のFirestore Emulator・ブラウザ受け入れ確認は未完了タスクとしてarchiveに記録されている。
