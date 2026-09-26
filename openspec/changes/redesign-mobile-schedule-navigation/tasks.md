## 1. 画面状態とスマホshell

- [ ] 1.1 `ScheduleApp` の既存データ取得、`selectedDate`、Event/Journey/Preparation更新、詳細modal callbackを共有したまま、720px以下のmobile tabと721px以上のdesktop viewを分ける。完了条件: スマホ初回は今日のタイムライン、PC初回は従来の月表示。幅の境界を跨いでも選択日と各幅で最後に選んだ画面が保たれ、Firestore取得が二重化しない。
- [ ] 1.2 スマホの3項目bottom navigationと画面固有top barを既存スタイルで実装し、PC用 `app-header` の縦積みを置き換える。完了条件: 3画面とも既存AccountMenuへアクセスでき、タブの選択状態と操作名を識別できる。PCのheader、sidebar、MiniCalendar、月/週/日/Timeline切替に変更を及ぼさない。
- [ ] 1.3 固定navigation・FAB・modal・AccountMenuのレイアウトを狭幅とsafe areaに合わせる。完了条件: 320/375/720/721pxで横スクロールが画面全体に出ず、スクロール末尾、入力操作、account/logout、エラーと再読み込みへ到達できる。

## 2. タイムラインのページ操作

- [ ] 2.1 既存 `TimelineView` をスマホページに配置し、同じ選択日・現在時刻・データ・詳細/再計画callbackを渡す。本文のEvent/Journey表示、route segment、summaryの再設計は行わない。完了条件: 今日以外のEvent/Journeyも既存Timeline表示で開け、Timelineから既存Event/Journey詳細とEvent-linked計画へ進める。
- [ ] 2.2 選択日見出し、前後3日を含む7日ストリップ、今日以外での「今日」をページ上部に追加する。完了条件: 月末・年末を跨ぐ日付選択、今日へ戻る操作、キーボード操作で `selectedDate` とTimeline本文が一致する。既存TimelineのPCツールバーは維持する。

## 3. スマホの月カレンダー

- [ ] 3.1 `getMonthDates`、`eventOccursOnDate`、既存のEvent/Journey表示投影を使うcompact月presentationを作る。完了条件: 5/6週を1画面幅に収め、日付、Event/Journeyの色による存在、最大1件の短いタイトル、残りの `+N` を表示する。日跨ぎ項目も日ごとの合計に入り、長いタイトルで列幅が広がらない。
- [ ] 3.2 スマホの月セル全体を日付選択→タイムライン遷移の単一操作にする。前/次月は表示月の1日、今日操作は今日を `selectedDate` に設定する。完了条件: セル内のタイトル/`+N` を押しても予定追加は開かず、選択日のTimelineが表示される。カレンダーへ戻ると選択日を含む月が見える。
- [ ] 3.3 PC `MonthCalendar`、`WeekCalendar`、`DayCalendar` は既存componentと操作を維持する。完了条件: PCの月セルは引き続きEvent追加、Event/Journey項目は詳細、週/日の空き時間は従来の初期時刻でEvent追加となり、PCの期間移動とmini calendarも動く。

## 4. FABと既存追加フロー

- [ ] 4.1 スマホのタイムライン/カレンダーだけに `＋` FABを設け、既存 `AddChoiceModal` の予定/移動予定tabと単一dialog内のフォームをスマホで扱える表示にする。完了条件: 準備画面にFABはなく、フォーム切替中の未保存入力が混ざらず、nested backdrop/dialogを作らない。
- [ ] 4.2 FABを押した時点の `selectedDate` を新規Eventと新規Standalone Journeyの初期値に渡す。Journey側には到着希望日時の初期値だけを渡し、保存済み編集/Event-linked Builderには適用しない。完了条件: 任意日のTimeline、別月のCalendar、タブ切替、フォーム内日付編集を検証し、Eventは既存09:00–10:00、Standaloneの到着希望は選択日09:00から編集できる。Event詳細→Journey BuilderはEventの場所・到着期限を使う。

## 5. 準備画面と通知設定

- [ ] 5.1 取得済みEvents/Preparationsと `currentTime` から、未来のEventに紐づく未完了項目をEvent開始順に導出する。通知期間内フラグと項目総数badgeも同じ対象から計算する。完了条件: 期間外の未来項目も表示し、0件ならbadgeなし。過去/開始済みEvent、完了済み/孤立項目、無効日時は除外し、Preparation取得失敗時は0件扱いしない。
- [ ] 5.2 Eventグループ、開始日時、未完了チェックボックス、空状態、通知期間内の強調を既存UI primitiveで表示する。項目チェックは `handleUpdatePreparation`、Event名は既存Event詳細へつなぐ。完了条件: チェック保存後に一覧とbadgeが更新され、失敗時は操作失敗を示す。追加・編集・削除は既存Event詳細でできる。
- [ ] 5.3 スマホの準備top barへ `PreparationReminderSettingsModal` を開く導線を移し、説明文を一覧と強調の新しい関係に合わせる。スマホの上部 `PreparationReminderList` は外し、PCのheader設定とsidebar案内は残す。完了条件: localStorageの既存値が継続し、通知期間変更で強調だけが変わり、期間外の未来の準備は消えない。

## 6. 検証とchangeの整合

- [ ] 6.1 日付ストリップ、月セルの日跨ぎ/`+N`、選択日引継ぎ、FABの両フォームの日付、準備抽出/件数/時間境界/取得失敗を自動テストで確認する。既存 `frontend/package.json` の `npm test`、`npm run lint`、`npm run build` を実行する。backend変更は想定しないが、影響が生じた場合はrepository guideのbackend unittestを実行する。
- [ ] 6.2 ブラウザで720px以下と721px以上、5/6週の月、長い日本語タイトル、日跨ぎJourney、縦方向に長いTimeline/準備一覧、safe area、キーボード表示、AccountMenu、modal開閉を確認する。完了条件: スマホのカレンダー本文に横スクロールがなく、PCの月/週/日操作が回帰せず、Journey/Timeline内部の既存表示を維持する。
- [ ] 6.3 `introduce-timeline-view` と `redesign-journey-builder-flow` の進捗を確認し、実装またはcanonical spec同期時に `schedule-management` のview切替・追加操作を両changeと統合する。完了条件: 採用済みTimeline/Builder契約をこのchangeが上書きせず、残るspec/code不整合と未確認のブラウザ/Firestore範囲を記録する。
