## 1. 共有日付・項目・自動展開

- [ ] 1.1 `App.jsx` の月→週切替で `selectedDate` を今日/月初に置き換える処理を除き、Timelineタブと既存`CalendarToolbar`の日単位操作を接続する。確認: 月/週/日/Timelineの全view切替で選択日が不変で、既存の日付ナビゲーションやミニカレンダーの日付選択では意図どおり日付が変わる。
- [ ] 1.2 既存の日重なり判定を用いてEvent・Standalone Journey・Event-linked Journeyを独立項目へ投影し、日跨ぎと同時刻の安定順序を導出する。確認: 既存`dateUtils`/`journeySerializer`と境界・重複ケースで前日継続、翌日到着、同時刻項目を検証する。
- [ ] 1.3 `currentTime`から今日の移動中優先、なければ最も近い次のJourneyを1件導出し、手動展開stateを別に保つ。確認: 出発/到着ちょうど、同時active時の到着→出発→ID順、全件終了、過去/未来、複数手動展開、分更新を検証する。

## 2. Event更新とEvent-linked Journeyの整合

- [ ] 2.1 Event targetの地点同一性と検索可能性を既存Event/Journey詳細の判定と共通化し、到着期限を`getEventArrivalDeadline`で比較する。確認: 同じ`place_id`の名称変更、place_idなしの既存地点比較、目的地変更、有効座標の喪失、開始時刻/到着余裕時間の変更と導出期限が同じ場合を検証する。
- [ ] 2.2 Event更新と必要な`journeys/event-{eventId}`削除をFirestoreの同一原子的commitに変更する。確認: target変更ならEvent更新とJourney削除がともに成功するかともに失敗し、target不変ならJourneyを維持し、Standalone Journeyに影響しないことをFirestoreの統合確認で検証する。
- [ ] 2.3 原子的commit成功後にAppのEvent/Journey配列とEvent詳細の読込済みJourneyを同期し、削除後は「移動予定なし」を表示する。確認: 更新成功時に古い経路・選択中の旧Journeyが残らず、commit失敗時に両方の画面状態と文書が維持される。

## 3. Timeline項目と共通経路表示

- [ ] 3.1 1カラムのTimeline項目列、今日の「現在」境界、過去項目の控えめな表示、日付別空状態を作る。確認: 今日以外で境界がなく、過去項目に完了チェックや実行済み表示がないことをPC/スマホで確認する。
- [ ] 3.2 Journeyのcompact項目と自動/手動展開の上部情報を作り、Event-linkedは`{event.title}へ`、Standaloneは目的地または旧FIXED-onlyの最後の降車地点から`{地点名}へ移動`と表示する。確認: 状態ラベル「移動中」「次の移動」を大見出しと分け、複数Journeyの開閉と既存カレンダー/詳細の名称維持を確認する。
- [ ] 3.3 展開領域に既存`JourneyTimeline`と`RouteDetails`/`RoutePlace`/`RouteTimeSummary`を埋め込み、日跨ぎの全体時刻を読めるよう共有表示だけを必要最小限拡張する。確認: 公共交通、徒歩、FIXED、待機、取得済み路線・行先・駅/バス停・ホーム・発着時刻と「前日/翌日」を確認し、未取得値を0表示しない。
- [ ] 3.4 既存のbutton、typography、spacing、colors、modal/Event UI、route segment CSSを使ってPC/スマホ幅を整える。確認: Journey Builder preview・Journey詳細・Timelineの経路表現が揃い、狭い画面でも横スクロールに依存せず、同等の経路UIや新design systemを複製していない。

## 4. Event、準備、既存操作

- [ ] 4.1 Eventをcompactに描き、準備進捗を加え、Timeline上部/サイドバーの`PreparationReminderList`重複を抑える。確認: 準備2/4、準備取得失敗、Event詳細でのチェック/編集、月/週/日の既存準備案内を確認する。
- [ ] 4.2 Event-linked Journeyがなく`getEventArrivalDeadline(event) > now`でPlaces目的地が検索可能な時だけ「移動を計画」を示し、既存Event詳細のBuilder flowを開く。確認: Event開始が未来でも到着期限が過去なら「到着期限を過ぎています」と表示し、場所未確定なら候補選択案内、Journeyがあるなら新規導線なしとなり、Recovery検索や二重dialogが出ない。
- [ ] 4.3 Event選択、Journey「詳細」、Journey「移動を再計画」を既存のEvent詳細、Journey詳細、Builder edit flowへ接続する。確認: Standalone/Event-linked双方が保存済みIDで開き、通常のEvent target変更後は旧Journeyがなく、既存不整合データだけは詳細で防御的警告を表示でき、「移動を開始」が現れない。

## 5. 統合検証

- [ ] 5.1 `cd frontend && npm run test && npm run lint && npm run build` を実行し、日跨ぎ・時刻境界・Event/Journey原子的更新・表示名・既存月/週/日・経路表示の回帰を確認する。失敗や実行不可の理由を記録する。
- [ ] 5.2 ブラウザでPC/スマホのTimeline、全view間の日付維持、focusの時刻更新、Event-linked計画・削除後の再計画、保存済みJourney編集/詳細、空状態を受け入れ確認する。実Places/Transit/認証済みFirestoreで確認できない範囲は未確認として記録する。
- [ ] 5.3 `redesign-journey-builder-flow` と本changeが共に変更するJourney表示要件を照合し、同期・archive時に採用済みのpreview/詳細表示、Timeline名称、旧不整合データの防御的表示が失われないことを確認する。
