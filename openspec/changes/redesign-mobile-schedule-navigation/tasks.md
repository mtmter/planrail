## 1. 画面状態とスマホshell

- [x] 1.1 `ScheduleApp` の既存データ取得、`selectedDate`、Event/Journey/Preparation更新、詳細modal callbackを共有したまま、720px以下のmobile tabと721px以上のdesktop viewを分ける。完了条件: スマホ初回は今日のタイムライン、PC初回は従来の月表示。幅の境界を跨いでも選択日と各幅で最後に選んだ画面が保たれ、Firestore取得が二重化しない。
- [x] 1.2 スマホの3項目bottom navigationと画面固有top barを既存スタイルで実装し、PC用 `app-header` の縦積みを置き換える。完了条件: 3画面とも既存AccountMenuへアクセスでき、タブの選択状態と操作名を識別できる。PCのheader、sidebar、MiniCalendar、月/週/日/Timeline切替に変更を及ぼさない。
- [x] 1.3 固定navigation・FAB・sheet・AccountMenuのレイアウトを狭幅とsafe areaに合わせる。完了条件: 320/375/720/721pxで横スクロールが画面全体に出ず、スクロール末尾、入力操作、account/logout、各画面で扱うエラーと再読み込みへ到達できる。

## 2. タイムラインのページ操作

- [x] 2.1 mainへ実装済みの `TimelineView` をスマホページに配置し、同じ選択日・現在時刻・データ・詳細/再計画callbackを渡す。本文のEvent/Journey表示、現在区間強調、route segment、summaryの再設計は行わない。完了条件: 今日以外のEvent/Journeyも既存Timeline表示で開け、Timelineから既存Event/Journey詳細とEvent-linked計画へ進める。
- [x] 2.2 選択日見出し、前後3日を含む7日ストリップ、今日以外での「今日」をページ上部に追加する。`selectedDate` 変更時は現行 `key={getDateKey(selectedDate)}` による `TimelineView` の再mount、または同等の最小限のlocal state resetを維持する。完了条件: 月末・年末を跨ぐ日付選択、今日へ戻る操作、キーボード操作で `selectedDate` と本文が一致し、前日に手動展開したJourneyが次の日に展開済みとして残らない。PCツールバーとTimeline内部表示は維持する。

## 3. スマホの月カレンダー

- [x] 3.1 `getMonthDates`、`eventOccursOnDate`、既存のEvent/Journey表示投影を使うcompact月presentationを作る。完了条件: 5/6週を1画面幅に収め、日付、最大1件の短いタイトル、残りの `+N` を表示する。EventとJourneyが同日にある場合は1件のタイトルしか見えなくても青/オレンジ等の両type cueが見え、`+N` は両種を合わせた非表示件数となる。日跨ぎ項目も日ごとの合計に入り、長いタイトルで列幅が広がらない。
- [x] 3.2 スマホの月セル全体を日付選択→タイムライン遷移の単一操作にする。前/次月は表示月の1日、今日操作は今日を `selectedDate` に設定する。完了条件: セル内のタイトル/`+N` を押しても予定追加は開かず、選択日のTimelineが表示される。カレンダーへ戻ると選択日を含む月が見える。
- [x] 3.3 PC `MonthCalendar`、`WeekCalendar`、`DayCalendar` は既存componentと操作を維持する。完了条件: PCの月セルは引き続きEvent追加、Event/Journey項目は詳細、週/日の空き時間は従来の初期時刻でEvent追加となり、PCの期間移動とmini calendarも動く。

## 4. FABと既存追加フロー

- [x] 4.1 スマホのタイムライン/カレンダーだけに `＋` FABを設け、720px以下では既存 `AddChoiceModal` の外側shellをmobile bottom sheetとして表示する。既存の「予定 / 移動予定」tab、embedded Event form、Journey Builder contentを再利用し、721px以上は既存dialogを維持する。完了条件: 準備画面にFABはなく、sheet内の内容と操作がスクロールで到達でき、フォーム切替中の未保存入力が混ざらず、中間の2択ダイアログやnested backdrop/dialogを作らない。
- [x] 4.2 FABを押した時点の `selectedDate` を新規Eventと新規Standalone Journeyの初期値に渡す。Journey側には到着希望日時の初期値だけを渡し、保存済み編集/Event-linked Builderには適用しない。完了条件: 任意日のTimeline、別月のCalendar、タブ切替、フォーム内日付編集を検証し、Eventは既存09:00–10:00、Standaloneの到着希望は選択日09:00から編集できる。Event詳細→Journey BuilderはEventの場所・到着期限を使う。

## 5. 準備画面と通知設定

- [x] 5.1 取得済みEvents/Preparationsと `currentTime` から、未来のEventに紐づく未完了項目をEvent開始順に導出する。通知期間内フラグと項目総数badgeも同じ対象から計算する。完了条件: 期間外の未来項目も表示し、0件ならbadgeなし。過去/開始済みEvent、完了済み/孤立項目、無効日時は除外し、Preparation取得失敗時は0件扱いしない。
- [x] 5.2 Eventグループ、開始日時、未完了チェックボックス、空状態、通知期間内の強調を既存UI primitiveで表示する。項目チェックは `handleUpdatePreparation`、Event名は既存Event詳細へつなぐ。完了条件: チェック保存後に一覧とbadgeが更新され、失敗時は操作失敗を示す。追加・編集・削除は既存Event詳細でできる。
- [x] 5.3 スマホの準備top barへ `PreparationReminderSettingsModal` を開く導線を移し、説明文を一覧と強調の新しい関係に合わせる。スマホの上部 `PreparationReminderList` は外し、PCのheader設定とsidebar案内は残す。完了条件: localStorageの既存値が継続し、通知期間変更で強調だけが変わり、期間外の未来の準備は消えない。
- [x] 5.4 Preparationだけ取得に失敗した場合のエラー配置をスマホ向けに分ける。既存の再読み込み処理を準備画面から呼び、スケジュール全体のglobal errorとPCの既存エラー表示は維持する。完了条件: Events/Journeys取得成功・Preparation失敗ではTimeline/CalendarにPreparation専用global bannerを出さず、準備画面内に失敗と再読み込みを示し、badgeを隠す。スケジュール全体の取得失敗では従来のglobal errorを表示する。

## 6. 検証とchangeの整合

- [x] 6.1 日付ストリップと日付変更時の手動展開reset、月セルの日跨ぎ/両type cue/`+N`、選択日引継ぎ、FABの両フォームの日付、準備抽出/件数/時間境界/Preparation単独取得失敗を確認する。変更範囲に応じて既存 `frontend/package.json` の `npm test`、`npm run lint`、`npm run build` を実行する。backendへ影響が生じた場合はrepository guideのbackend unittestを実行する。
- [ ] 6.2 ブラウザで720px以下と721px以上、5/6週の月、両type cue、長い日本語タイトル、日跨ぎJourney、縦方向に長いTimeline/準備一覧、safe area、キーボード表示、AccountMenu、mobile bottom sheet/PC dialogの開閉、Preparation単独/全体取得失敗を確認する。完了条件: スマホのカレンダー本文に横スクロールがなく、PCの月/週/日操作とエラー表示が回帰せず、Journey/Timeline内部の既存表示を維持する。
- [x] 6.3 mainへマージ済みのTimeline実装、未archiveの `introduce-timeline-view` 文書、`redesign-journey-builder-flow` の現行コードとchange文書を照合し、実装またはcanonical spec同期時に `schedule-management` のview切替・追加操作を採用済み挙動と統合する。完了条件: 既存Timeline/Builder契約をこのchangeが上書きせず、残るspec/code不整合と未確認のブラウザ/Firestore範囲を記録する。
