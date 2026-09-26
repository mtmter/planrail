## Why

現行のスマホ画面はPCの大きなheaderと月・週・日の表示を狭い幅へ配置している。`MonthCalendar` は最小幅840px、週表示は7列の時間グリッドを持ち、横スクロールなしに「今日の行動」「日付の俯瞰」「予定までの準備」を行き来しにくい。PlanRailのスマホでの主要な利用目的に合わせ、画面構造と日付・追加導線を整理する。

## What Changes

- 幅720px以下では、ログイン後の初期画面を今日の「タイムライン」とし、固定bottom navigationで「タイムライン」「カレンダー」「準備」を切り替える。準備には未来の予定に紐づく未完了準備項目の件数をbadgeで示す。
- スマホの大きな共通headerを、各画面固有の小さなtop barに置き換える。AccountMenuへのアクセスを保ち、準備通知設定を準備画面へ移す。
- タイムライン上部に選択日の見出し、選択日付近の7日ストリップ、今日以外での「今日」を設ける。本文のEvent/Journey表示と行程は進行中の `introduce-timeline-view` を再利用する。
- スマホのカレンダーを画面幅内のcompactな月表示とし、日付タップでその日のタイムラインへ移る。予定追加はタイムライン・カレンダーのFABに分離する。週・日の時間グリッドと月/週/日切替はスマホの主要画面から外す。
- 準備画面では、通知期間に関係なく未来のEventに紐づく未完了項目をEvent開始順にまとめる。通知期間内のものを強調し、既存の準備更新処理・Event詳細を使う。
- PC（721px以上）のheader、sidebar、mini calendar、月/週/日表示と操作を維持する。既存Timeline changeが追加するPCのTimelineも維持する。Firestore形とbackend APIは変えない。

## Capabilities

### New Capabilities

- `mobile-schedule-navigation`: スマホの3画面、top bar、bottom navigation、選択日の移動、AccountMenuとFABの画面レベル導線。

### Modified Capabilities

- `schedule-management`: 画面幅による表示構成、スマホのcompact月表示・日付選択、追加操作と初期日付。PCの月/週/日と既存操作は維持。
- `preparations`: スマホの未来の未完了準備一覧、件数badge、通知期間内の強調、通知設定の配置。PCの準備案内は維持。

## Impact

- Frontend: 主に `App.jsx` / `App.css` の画面分岐と状態、スマホ用月表示・日付ストリップ・準備一覧・bottom navigation、`AddChoiceModal` / `JourneyBuilderContent` の初期日付受け渡し。既存の `TimelineView`、Event/Journey詳細、準備更新、日付utility、UI primitiveと取得済みデータを利用する。
- 進行中changeとの関係: `introduce-timeline-view` がTimeline本文・Journey行程とPCでの4表示を定義し、`redesign-journey-builder-flow` が追加タブ・Builderを定義する。このchangeはその上にスマホのnavigation layerを重ねる。適用またはarchive時に同名の `schedule-management` 要件を両changeの採用内容と統合する。
- 対象外: PCカレンダー全面改修、Timeline/Journey内部の再設計、Journey Builderの検索・保存フロー変更、独立Preparationモデル、通知機構の新設、Firestore schema・route API・backend変更、PWA/native化、router導入、PCの週/日表示削除。
