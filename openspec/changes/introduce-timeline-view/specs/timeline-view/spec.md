## Purpose

Timelineは、選択した1日のEventとJourneyを実行順に確認し、今日の移動中または次のJourneyの経路全体を詳細画面を開かずに読めるスケジュール表示である。

## ADDED Requirements

### Requirement: Timelineで選択日を表示する

Timelineは月・週・日と共有する表示基準日の1日を表示し、既存カレンダーと同種の日付操作で前日・今日・翌日へ移動できなければならない（MUST）。

#### Scenario: 日付を移動する

- **WHEN** ユーザーがTimelineで前へ、今日、次へを選択する
- **THEN** システムはそれぞれ前日、当日、翌日を表示する

### Requirement: EventとJourneyを時系列に並べる

Timelineは選択日に時間的に重なるEvent、Standalone Journey、Event-linked Journeyを別項目として表示しなければならない（MUST）。JourneyをEventカード内に強くネストしてはならない（MUST NOT）。同時刻に重なる項目も省略してはならない（MUST NOT）。

#### Scenario: EventとJourneyが同じ日にある

- **WHEN** 選択日にEventとEvent-linked/Standalone Journeyが重なる
- **THEN** システムは全てを時刻順の独立した項目として表示し、Event-linked Journeyと対応Eventの関係を判別できる

#### Scenario: 同時刻の項目がある

- **WHEN** 複数のEventまたはJourneyが同時刻に重なる
- **THEN** システムは全項目を安定した順序で表示し、それぞれ選択できる

### Requirement: 今日の対象Journeyを自動展開する

選択日が今日の場合、Timelineは `departure_at <= now < arrival_at` のJourneyを優先し、該当がなければ `departure_at > now` のうち最も近いJourneyを1件自動展開しなければならない（MUST）。今日これ以上のJourneyがない場合、および選択日が過去または未来の場合は自動展開してはならない（MUST NOT）。この内部選択の名称をユーザーUIへ表示してはならない（MUST NOT）。

#### Scenario: 移動中のJourneyがある

- **WHEN** 今日のJourneyが現在時刻を跨いでいる
- **THEN** システムは対象のJourneyを自動展開し、「移動中」と到着予定時刻を示す

#### Scenario: 移動中がなく次のJourneyがある

- **WHEN** 今日の移動中Journeyはなく、出発時刻が未来のJourneyがある
- **THEN** システムは最も近いJourneyを自動展開し、「次の移動」と出発までの時間を示す

#### Scenario: 今日のJourneyがすべて終了した

- **WHEN** 今日のJourneyは全て `arrival_at <= now` であり、未来に出発するJourneyがない
- **THEN** システムはJourneyを自動展開せず、終了済みを「完了」と推測しない

#### Scenario: 過去または未来の日を見る

- **WHEN** 選択日が今日ではない
- **THEN** システムはJourneyを自動展開しない

### Requirement: 展開したJourneyの全行程を表示する

自動展開または手動展開されたJourneyは、詳細モーダルを開かずにJourney全体の出発・到着時刻、所要時間、出発地、目的地、および保存済み区間の徒歩・公共交通・路線名・行先・駅/バス停・発着時刻・取得済みホーム・固定移動・待機時間を行程順に表示しなければならない（MUST）。既存のJourney詳細/Builder previewと同じ経路表示体系を使い、内部語の `ROUTE`、`section`、`gap`、`Journey Builder`、`FIXED` をユーザーに表示してはならない（MUST NOT）。固定区間は「固定移動」等の既存のユーザー向け表現にする。

#### Scenario: 複数区間のJourneyをその場で確認する

- **WHEN** 自動展開Journeyに公共交通、徒歩、固定移動、待機を含む保存済み区間がある
- **THEN** システムは詳細モーダルなしで全区間を連続した既存の経路表示体系で示し、取得済みの路線・行先・駅/バス停・ホームと各時刻を読める

#### Scenario: 取得できない経路情報がある

- **WHEN** 保存済みRouteのホームや比較指標などがnullである
- **THEN** システムは未取得値を0や推測値に置き換えず、存在する情報だけを表示する

### Requirement: その他のJourneyを必要時に展開する

自動展開対象以外のJourneyは、出発時刻・ユーザー向け名称・両端の地点と時刻・取得済みの簡潔な指標をcompactに表示しなければならない（MUST）。「経路を見る」はその場で全行程を展開し、「閉じる」はcompactへ戻さなければならない（MUST）。

#### Scenario: その他のJourneyを見る

- **WHEN** ユーザーが自動展開対象以外のJourneyを初めて見る
- **THEN** システムはcompactな項目と「経路を見る」を表示する

#### Scenario: 経路をインライン展開する

- **WHEN** ユーザーが「経路を見る」を選択する
- **THEN** システムはモーダルを開かず、そのJourney項目内に同じ経路表示を展開する

#### Scenario: 手動展開を閉じる

- **WHEN** ユーザーが手動展開したJourneyの「閉じる」を選択する
- **THEN** システムはそのJourneyをcompact表示へ戻す

### Requirement: 既存の詳細と再計画へ進む

展開したJourneyは既存Journey詳細と既存Journey Builderの編集フローへの導線だけを提供しなければならない（MUST）。Timeline内に独自の検索条件入力を設けたり、未実装の「移動を開始」を表示したりしてはならない（MUST NOT）。

#### Scenario: Journey詳細を開く

- **WHEN** ユーザーがJourneyの「詳細」を選択する
- **THEN** システムは既存Journey詳細を開く

#### Scenario: Journeyを再計画する

- **WHEN** ユーザーがJourneyの再検索・再計画操作を選択する
- **THEN** システムはその保存済みJourneyを既存Journey Builderの編集フローで開く

#### Scenario: 移動開始を表示しない

- **WHEN** ユーザーがTimelineのJourneyを見る
- **THEN** システムは「移動を開始」、Active Journey、GPS、地図への操作を表示しない

### Requirement: Eventを簡潔に表示する

Eventは開始時刻とタイトルを必ず表示し、存在する終了時刻・場所名を添えるcompactな予定項目でなければならない（MUST）。説明本文や全準備チェックリストを常時展開してはならず（MUST NOT）、選択時は既存Event詳細を開かなければならない（MUST）。

#### Scenario: Eventを選択する

- **WHEN** ユーザーがTimelineのEvent項目を選択する
- **THEN** システムは既存Event詳細を開き、説明や準備チェックリストはそこで確認・編集できる

### Requirement: Eventに準備進捗を統合する

準備項目を取得できた場合、TimelineのEventは該当Eventの完了数と総数を集計して進捗を表示しなければならない（MUST）。Timeline上部に準備案内一覧を重複表示せず、準備項目のチェック・編集UIを新設してはならない（MUST NOT）。

#### Scenario: 準備項目がある

- **WHEN** Eventに4件の準備項目があり2件が完了している
- **THEN** システムはEvent項目に「準備 2 / 4 完了」のような進捗を表示する

#### Scenario: 準備項目を取得できない

- **WHEN** 準備項目の取得に失敗している
- **THEN** システムは未取得の進捗を0件と誤表示せず、既存の取得失敗案内を維持する

### Requirement: Journeyのない未来Eventから移動を計画する

現在時刻より後に始まるEventにEvent-linked Journeyがなく、検索可能なPlaces目的地がある場合、TimelineのEvent項目は小さな「移動を計画」導線を表示しなければならない（MUST）。目的地が検索不能な場合は候補選択の案内を表示し、無効ボタンを並べてはならない（MUST NOT）。

#### Scenario: 検索可能な未来EventにJourneyがない

- **WHEN** Eventの開始が未来で、目的地に有効なPlaces座標があり、Event-linked Journeyが存在しない
- **THEN** システムは「移動予定なし」と「移動を計画」を示し、操作時に既存Event-linked Journey Builderを開く

#### Scenario: 場所が候補から確定していない

- **WHEN** 未来EventにEvent-linked Journeyがなく、目的地の経路検索に必要なPlaces情報がない
- **THEN** システムは場所を候補から選ぶ案内を表示し、利用できない計画ボタンを置かない

#### Scenario: JourneyがあるかEventが未来でない

- **WHEN** Event-linked Journeyが既にある、またはEventの開始が現在時刻以前である
- **THEN** システムは新規移動計画の案内を表示しない

### Requirement: 今日の現在境界を示す

今日のTimelineは時間が過ぎた項目と現在進行中・未来の項目との境界に「現在」separatorを表示しなければならない（MUST）。分単位の連続時間軸は必要とせず、過去項目を時刻だけで「完了」「実行済み」と扱ってはならない（MUST NOT）。

#### Scenario: 今日の項目列を見る

- **WHEN** 選択日が今日で、過去項目と現在以降の項目がある
- **THEN** システムは両者の間に「現在」を表示し、過去項目を完了扱いしない

#### Scenario: 今日以外を見る

- **WHEN** 選択日が過去または未来である
- **THEN** システムは「現在」separatorを表示しない

### Requirement: 日跨ぎの予定と移動を扱う

選択日に重なるEventとJourneyは開始日が別日でも表示しなければならない（MUST）。Journeyは当日の断片に時刻を切り詰めず、全体の発着時刻と選択日から見た日付差を明示しなければならない（MUST）。

#### Scenario: 翌日到着のJourneyを見る

- **WHEN** Journeyが選択日の23:30に出発し翌日06:40に到着する
- **THEN** システムは選択日のTimelineに表示し、「23:30 → 翌 06:40」のように全体の時刻と翌日到着を示す

#### Scenario: 前日から続くJourneyを見る

- **WHEN** Journeyが選択日の前日23:30に出発し選択日06:40に到着する
- **THEN** システムは選択日のTimelineに表示し、「前日 23:30 → 06:40」のように前日出発を示す

#### Scenario: 日跨ぎEventを見る

- **WHEN** Eventの時間範囲が選択日に重なる
- **THEN** システムはそのEventを選択日のTimelineに表示し、前日からの継続または翌日への継続を判別できる

### Requirement: 空状態と狭幅表示を提供する

選択日に対象項目がない場合、Timelineはその日に対応した空状態を表示しなければならない（MUST）。PC・スマホとも本文は1カラムとし、PCでは読みやすい最大幅で中央寄せ、スマホではほぼ全幅を使い、横スクロールを前提としてはならない（MUST NOT）。

#### Scenario: 今日は予定がない

- **WHEN** 今日に重なるEventとJourneyがない
- **THEN** システムは「今日はまだ予定がありません」のような空状態を表示する

#### Scenario: 別の日に予定がない

- **WHEN** 今日以外の選択日に重なるEventとJourneyがない
- **THEN** システムは選択日に対応する空状態を表示する

#### Scenario: PCとスマホで表示する

- **WHEN** ユーザーがPC幅またはスマホの狭い幅でTimelineを見る
- **THEN** システムは1カラムの項目列と展開経路を横スクロールに依存せず表示する
