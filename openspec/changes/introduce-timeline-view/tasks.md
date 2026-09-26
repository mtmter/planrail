## 1. 日付・項目・自動展開の導出

- [ ] 1.1 `App.jsx` にTimelineタブ、共有`selectedDate`を使う描画分岐、既存`CalendarToolbar`の前日/今日/翌日、Timelineでのグローバル追加初期日を接続する。確認: 月/週/日/Timelineを往復して選択日が引き継がれ、各日付操作が1日ずつ動く。
- [ ] 1.2 既存の日重なり判定を用いてEvent・Standalone Journey・Event-linked Journeyを独立項目へ投影し、日跨ぎと同時刻の安定順序を導出する。確認: 既存`dateUtils`/`journeySerializer`のテストと追加した境界・重複テストで前日継続、翌日到着、同時刻項目を検証する。
- [ ] 1.3 `currentTime`から今日の移動中優先、なければ最も近い次のJourneyを1件導出し、その他の日と終了済みを自動展開しない。手動展開stateは別に保つ。確認: 出発/到着ちょうど、複数同時移動、次のJourney、全件終了、過去/未来、分更新での切替テストが通る。

## 2. Timeline項目と共通経路表示

- [ ] 2.1 1カラムのTimeline項目列、今日の「現在」境界、過去項目の控えめな表示、日付別空状態を作る。確認: 過去/進行中/未来の順序、今日以外で境界がないこと、完了チェックや実行済み表示がないことをブラウザで確認する。
- [ ] 2.2 Journeyのcompact項目と自動/手動展開の上部情報を作り、Event名または目的地から自然な見出しを生成する。「経路を見る」/「閉じる」で同じ場所を開閉する。確認: 複数Journeyの手動展開、移動中/次の移動の状態表示、既存カレンダー/詳細の表示名維持を確認する。
- [ ] 2.3 展開領域に既存`JourneyTimeline`とその`RouteDetails`/`RoutePlace`/`RouteTimeSummary`を埋め込み、日跨ぎの全体時刻が読めるよう共有表示を必要最小限だけ拡張する。確認: ROUTE/FIXED/待機を含む保存済みJourneyで徒歩・公共交通・路線・行先・駅/バス停・取得済みホーム・発着時刻と「前日/翌日」を確認し、未取得値を0表示しない。
- [ ] 2.4 既存のbuttons、typography、spacing、colors、route segment CSSでPC中央最大幅とスマホほぼ全幅を整える。確認: デスクトップ幅と狭いスマホ幅でJourney全体を横スクロールなしに読め、Builder preview・Journey詳細と同じ経路visual languageであることを確認する。

## 3. Event、準備、既存操作への接続

- [ ] 3.1 Eventを開始時刻・タイトル中心のcompact項目として描き、取得済み終了時刻・場所と準備進捗を加える。Timelineでは上部/サイドバーの`PreparationReminderList`重複を抑え、他の表示の配置は維持する。確認: 準備2/4、準備取得失敗、Event詳細でのチェック/編集、他表示の準備案内を確認する。
- [ ] 3.2 未来EventにEvent-linked Journeyがない時だけ目的地の検索可能性に応じて「移動を計画」または候補選択案内を示し、既存Event詳細内のBuilder flowを直接開く。確認: 座標あり/なし、既存Journeyあり、開始済みEventで導線が正しく分岐し、新しい検索フォームや二重dialogが出ないことを確認する。
- [ ] 3.3 Event選択、Journey「詳細」、Journey「経路を再検索/再計画」を既存のEvent詳細、Journey詳細、Builder edit flowへ接続する。確認: Standalone/Event-linked双方を保存済みIDで開け、Event target変更時の既存再計画警告を失わず、「移動を開始」が現れないことを確認する。

## 4. 統合検証

- [ ] 4.1 `cd frontend && npm run test && npm run lint && npm run build` を実行し、日跨ぎ・時刻境界・表示名・既存月/週/日・経路表示の回帰を確認する。失敗や実行不可の理由を記録する。
- [ ] 4.2 ブラウザでPC/スマホのTimeline、日付往復、focusの時刻更新、Event-linked計画、保存済みJourney編集/詳細、空状態を受け入れ確認する。実Places/Transit/認証済みFirestoreで確認できない範囲は未確認として記録する。
