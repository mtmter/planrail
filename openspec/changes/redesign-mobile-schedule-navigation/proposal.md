## Why

現行のスマホ画面はPCの大きなheaderと月・週・日の表示を狭い幅へ配置している。`MonthCalendar` は最小幅840px、週表示は7列の時間グリッドを持ち、横スクロールなしに「今日の行動」「日付の俯瞰」「予定までの準備」を行き来しにくい。PlanRailのスマホでの主要な利用目的に合わせ、画面構造と日付・追加導線を整理する。

## What Changes

- 幅720px以下では、ログイン後の初期画面を今日の「タイムライン」とし、固定bottom navigationで「タイムライン」「カレンダー」「準備」を切り替える。準備には未来の予定に紐づく未完了準備項目の件数をbadgeで示す。
- スマホの大きな共通headerを、各画面固有の小さなtop barに置き換える。AccountMenuへのアクセスを保ち、準備通知設定を準備画面へ移す。
- タイムライン上部に選択日の見出し、選択日付近の7日ストリップ、今日以外での「今日」を設ける。本文のEvent/Journey表示と現在区間強調はmainへ実装済みの `TimelineView` を再利用し、日付変更時に前日の手動展開stateを持ち越さない。
- スマホのカレンダーを画面幅内のcompactな月表示とし、日付タップでその日のタイムラインへ移る。1件のタイトルしか収まらなくても、EventとJourneyの両方がある日は既存の色によるtype cueで両種を判別できるようにする。週・日の時間グリッドと月/週/日切替はスマホの主要画面から外し、予定追加はタイムライン・カレンダーのFABに分離する。
- スマホのFABは既存の「予定 / 移動予定」タブとフォームをmobile bottom sheetで開く。PCの追加dialogは維持する。
- 準備画面では、通知期間に関係なく未来のEventに紐づく未完了項目をEvent開始順にまとめる。Preparationだけの取得失敗はスマホの準備画面内で案内し、badgeを隠す。
- PC（721px以上）のheader、sidebar、mini calendar、月/週/日表示と操作、および既存Timelineを維持する。Firestore形とbackend APIは変えない。

## Capabilities

### New Capabilities

- `mobile-schedule-navigation`: スマホの3画面、top bar、bottom navigation、選択日の移動、AccountMenuとFABの画面レベル導線。

### Modified Capabilities

- `schedule-management`: 画面幅による表示構成、スマホのcompact月表示・日付選択、追加操作と初期日付。PCの月/週/日と既存操作は維持。
- `preparations`: スマホの未来の未完了準備一覧、件数badge、通知期間内の強調、通知設定の配置。PCの準備案内は維持。

## Impact

- Frontend: 主に `App.jsx` / `App.css` の画面分岐と状態、スマホ用月表示・日付ストリップ・準備一覧・bottom navigation、`AddChoiceModal` / `JourneyBuilderContent` の初期日付受け渡し。Preparation単独の取得失敗を区別するため、既存 `loadScheduleData` の結果を分離する。既存の `TimelineView`、Event/Journey詳細、準備更新、日付utility、UI primitiveと取得済みデータを利用する。
- 関連changeとの関係: Timeline本文・Journey行程は `introduce-timeline-view` から、現在区間強調は後続コミットからmainへ実装・マージ済みである。`introduce-timeline-view` のchange文書は未archiveである。`redesign-journey-builder-flow` の追加タブ・Builderも現行コードに存在し、change文書は未archiveである。このchangeは既存実装の上にスマホのnavigation layerを重ねる。canonical specへの同期時は未archiveのdeltaと採用済み挙動を照合する。
- 対象外: PCカレンダー全面改修、Timeline/Journey内部の再設計、Journey Builderの検索・保存フロー変更、独立Preparationモデル、通知機構の新設、Firestore schema・route API・backend変更、PWA/native化、router導入、PCの週/日表示削除。
