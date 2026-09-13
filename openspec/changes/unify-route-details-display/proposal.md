## Why

経路検索では選択中経路の詳細をtimelineで確認できる一方、予定詳細の登録済み移動予定は別の簡易表示で、特にsegmentごとの発着時刻を確認できない。1件のRoute詳細表示を共有し、予定詳細でも検索結果と同じ情報を再検索なしで確認できるようにする。

## What Changes

- 選択中の1経路を表示する詳細表示を再利用可能な共通UIとして切り出し、経路検索結果と登録済み移動予定の両方で使用する。
- 予定詳細ではsegmentの発着時刻を含むRoute全体・各segmentの詳細を表示し、取得済みの乗換回数、徒歩・待ち時間、運賃をコンパクトに併記する。
- 欠落したoptional fieldや旧形式のsegmentsを許容し、利用できる基本Route情報の表示を続ける。
- 候補比較・検索警告・登録操作は検索結果側に残し、予定詳細固有の再検索、読み込み、空状態も維持する。
- Route API schema、Transit通信、Firestore schema、および保存データのmigrationは変更しない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `travel-plans`: 登録済み移動予定で、検索結果の選択中Route詳細と同等の全体・segment情報を表示する要件を明確化する。

`places-and-route-search`の現行要件は検索結果の候補比較と選択中Route timelineをすでに定義しているため、このchangeではその要件を変更せず、既存表示の維持を設計・検証対象とする。

## Impact

- Frontend: `RouteSearchResult`と`TravelPlanDetails`の表示責務を整理し、共有Route詳細UIと必要な共有スタイルを追加する。
- OpenSpec: `travel-plans`のspec deltaを追加する。API、Firestore、backend、依存関係への変更はない。
- Verification: 既存のフロントエンドlint/buildと、検索・保存済み表示に対する手動受け入れ確認を行う。新しいtest frameworkは導入しない。
