## MODIFIED Requirements

### Requirement: JourneyをEventから独立した保存単位とする

システムは `users/{uid}/journeys/{journeyId}` にJourneyを保存しなければならない（MUST）。Journeyは `event_id: string | null`、`target: {destination: PlacePoint, arrival_deadline: datetime} | null`、`departure_at`、`arrival_at`、行程順の `sections` を持つ。`event_id` がnullならStandalone、文字列ならEvent-linkedとし、1 EventにつきEvent-linked Journeyは最大1件とする。Event-linkedのtargetは現在のEventの目的地と `event.start_at - (arrival_buffer_minutes ?? 0)` から設定し、再計画時も現在のEventを優先しなければならない（MUST）。新規Standaloneの入力には出発地・目的地・到着期限を要求する。既存の `target: null` のFIXEDのみのJourneyは表示できるが、編集して再確定する前には目的地と期限を入力させる。

#### Scenario: Eventから移動を計画する

- **WHEN** ユーザーが検索可能な目的地を持つEventから移動計画を開く
- **THEN** システムは現在のEventから目的地と到着期限を設定し、再入力を要求せず、出発地と任意の固定移動を入力させる

#### Scenario: Eventに検索可能な目的地がない

- **WHEN** Eventの目的地に有効な緯度または経度がない
- **THEN** システムは移動計画を無効にし、Places候補の選択を案内する

#### Scenario: Standaloneを作る

- **WHEN** ユーザーがEventを選ばず移動予定を追加する
- **THEN** システムは出発地、目的地、到着したい日時、任意の固定移動を入力する画面を開く

#### Scenario: 同じEventのJourneyを再保存する

- **WHEN** 対象EventにEvent-linked Journeyが既に存在し、再計画を確定する
- **THEN** システムは同じ文書IDのJourneyを置換し、二件目を作成しない

#### Scenario: 旧FIXEDのみのStandaloneを開く

- **WHEN** `target: null` の保存済みStandaloneを開く
- **THEN** システムは詳細を表示し、編集確定には目的地と期限の追加を求める

### Requirement: 固定移動をJourney内に記録する

FIXED sectionは乗車地点、出発日時、降車地点、到着日時、任意の名称を保持しなければならない（MUST）。名称はnullを許容し、固定移動用の独立collectionを作ってはならない（MUST NOT）。Builderは固定移動を検索前の入力条件として追加・編集・削除でき、複数件を時刻順に扱わなければならない（MUST）。ユーザーにsectionの挿入位置を指定させてはならない（MUST NOT）。

#### Scenario: 固定移動を追加する

- **WHEN** ユーザーが「固定移動を追加」を選ぶ
- **THEN** システムは乗車地点・出発日時・降車地点・到着日時・任意名称の入力を追加し、ROUTEへの挿入位置を聞かない

#### Scenario: 複数の固定移動を編集・削除する

- **WHEN** ユーザーが固定移動の地点または日時を変更するか1件を削除する
- **THEN** システムは時刻順の固定移動一覧と導出される移動全体を更新し、古い検索結果を確定に使わない

#### Scenario: 固定地点のPlaces候補が得られない

- **WHEN** 固定移動の乗降地点を名前だけで入力する
- **THEN** システムは固定移動の入力を保持するが、その地点を端点とする公共交通検索には座標を持つ地点の選択を求める

#### Scenario: 固定移動だけで両端をつなぐ

- **WHEN** 固定移動の地点と時刻が出発地から目的地まで連続し、検索すべきgapが0件になる
- **THEN** システムは「経路を検索」操作で接続と期限を検証してプレビューし、検証成功後に確定可能とする

### Requirement: 完成したJourneyだけを保存する

Builderの入力途中、検索中、dirtyな結果、失敗gap、未確定の必要区間をFirestoreへ保存してはならない（MUST NOT）。ユーザーが完成した移動予定を確認して明示的に確定したとき、システムは既存Journey serializerでsectionsの地点・時刻・接続、target期限、全体の発着時刻を検証し、選択中のROUTEとFIXEDだけを保存しなければならない（MUST）。新規Standaloneはtargetを必須とする。保存済みJourneyの編集は元のIDへ更新しなければならない（MUST）。

#### Scenario: 入力途中または検索途中

- **WHEN** 必須入力が欠ける、検索中である、または入力変更後に再検索していない
- **THEN** システムは確定を無効にし、Journeyを保存しない

#### Scenario: 一部の地点間に候補がない

- **WHEN** 1件以上のgapが検索失敗または有効候補0件である
- **THEN** システムは失敗した地点間を示し、確定を無効にする

#### Scenario: 全区間が有効である

- **WHEN** 全ての必要gapに有効な選択候補があり、FIXEDとの接続・時刻・到着期限が整合する
- **THEN** システムは「この移動予定を確定」で先頭出発と末尾到着を導出し、選択中の各ROUTEだけを保存する

#### Scenario: 保存済みStandaloneを編集する

- **WHEN** ユーザーが保存済みStandaloneの編集結果を確定する
- **THEN** システムは新しいStandalone文書を作らず、元のJourney IDの文書を更新する

### Requirement: Journeyを一本の行程として詳細表示する

システムは検索後プレビューと保存済みJourney詳細に、ROUTEの公共交通segmentとFIXEDを同じ一本の縦型タイムラインで行程順に表示しなければならない（MUST）。FIXEDの固定性・任意名称・乗降地点・日時、ROUTEの取得済みの時刻・乗換・徒歩・運賃等を示し、待機時間も連続した行程として読めなければならない（MUST）。Journey用の必須タイトル入力を追加してはならない（MUST NOT）。保存済み詳細は編集と、確認付き削除を提供する。

#### Scenario: ROUTE・FIXED・ROUTEを表示する

- **WHEN** Journeyに公共交通、固定移動、公共交通が含まれる
- **THEN** システムは独立カードの羅列ではなく一本の線上に各移動と接続地点・時刻を順番に表示する

#### Scenario: Journey名を生成する

- **WHEN** Event-linked Journeyを表示する
- **THEN** システムは `移動: {event.title}` と表示する
- **WHEN** targetのあるStandaloneを表示する
- **THEN** システムは `移動: {destination.name}` と表示する

#### Scenario: Eventの目的地または到着期限が変わった

- **WHEN** 保存済みtargetと現在のEvent targetが異なる
- **THEN** システムは再計画を促し、保存済みsectionsとカレンダー時間ブロックを自動変更しない

#### Scenario: 保存済みJourneyを削除する

- **WHEN** ユーザーがJourney詳細で削除を確認する
- **THEN** システムは対象Journey文書だけを削除し、Eventや準備項目を残す

## ADDED Requirements

### Requirement: Builderの入力条件から移動全体を構築する

Builderは検索前にはユーザーへ出発地、目的地、到着したい日時、任意の固定移動を提示しなければならない（MUST）。Event-linkedでは目的地と期限をEventから表示する。初期画面に未設定ROUTE、section、gapや区間検索操作を表示してはならない（MUST NOT）。内部ではFIXEDを出発時刻順に整列し、出発地→最初のFIXED、FIXED間、最後のFIXED→目的地のうち異なる地点間をROUTE gapとして導出する。FIXED 0件では出発地→目的地の1 gapを導出する。

#### Scenario: FIXEDがない

- **WHEN** 出発地A、目的地F、到着期限が入力され、FIXEDが0件である
- **THEN** システムはA→Fの1件を検索対象とする

#### Scenario: FIXEDが1件ある

- **WHEN** AからFへの移動にB→CのFIXEDが1件ある
- **THEN** システムはA→BとC→Fを検索対象とする

#### Scenario: FIXEDが複数ある

- **WHEN** AからFへの移動にB→CとD→EのFIXEDがある
- **THEN** システムはA→B、C→D、E→Fを検索対象とし、FIXEDは時刻順に配置する

#### Scenario: 隣接地点が同一である

- **WHEN** 境界の両端が同じ非空place_idまたは同じ有効座標で確認できる
- **THEN** システムはその境界に不要な検索gapを作らず、待機時間を行程に残す

### Requirement: 全ての公共交通区間を一度に検索する

Builderはユーザーの「経路を検索」1操作で全ての必要gapを検索しなければならない（MUST）。各gapには前FIXED到着以降の出発と次FIXED出発またはJourney target期限以前の到着を適用する。検索中はボタンをdisabledにし、進行中表示と複数gapの完了数を示す。成功したgapは推奨候補、なければ先頭候補を自動選択する。一部gapだけ失敗した場合は成功結果を保持し、失敗した地点間と理由を表示する。個別gapの検索ボタンをユーザーに要求してはならない（MUST NOT）。

#### Scenario: FIXED前後の時間制約

- **WHEN** A→BがFIXED前、C→FがFIXED後である
- **THEN** システムはA→BにFIXED出発時刻の到着上限を、C→FにFIXED到着時刻の出発下限とtarget期限の到着上限を適用する

#### Scenario: FIXED間の時間制約

- **WHEN** C→Dが二つのFIXEDの間にある
- **THEN** システムは前FIXED到着以降の出発と次FIXED出発以前の到着を満たす候補だけを選ぶ

#### Scenario: 全gapを検索している

- **WHEN** ユーザーが複数gapの「経路を検索」を押す
- **THEN** システムはボタンをdisabledにし、`経路を検索中...` と `全N区間中M区間を検索しました` に相当する進捗を表示する

#### Scenario: 1gapだけ失敗する

- **WHEN** 複数gapのうち一つだけが経路なしまたは通信失敗になる
- **THEN** システムは成功区間を失わず、失敗した地点A→地点Bと理由を表示して確定を禁止する

#### Scenario: 自動選択する

- **WHEN** gap検索で1件以上の有効候補が返る
- **THEN** システムは返された推奨IDが有効ならその候補、そうでなければ先頭候補を選び、移動全体を完成した状態でプレビューする

### Requirement: 検索後に区間の候補を任意で変更する

ユーザーは検索後の公共交通区間で「別の候補を見る」から最大3件の候補を比較し、当該区間だけ選択を変更できなければならない（MUST）。候補の時刻・所要時間・乗換・徒歩・運賃は取得済み値だけを表示し、未取得を0として扱ってはならない（MUST NOT）。検索条件を変更した結果はdirtyとして確定不可にし、「経路を再検索」で全gapを再構築する。

#### Scenario: 一区間だけ変更する

- **WHEN** ユーザーが一つの公共交通区間で別候補を選ぶ
- **THEN** システムは当該区間の時刻・詳細だけを差し替え、他区間の選択を維持する

#### Scenario: 条件を変更して再検索する

- **WHEN** ユーザーが出発地・目的地・期限・FIXEDの地点または時刻を変更する
- **THEN** システムは古い結果での確定を禁止し、一つの「経路を再検索」で必要な全gapを検索する

### Requirement: 保存済みJourneyを同じBuilderで編集する

システムは保存済みJourney詳細から編集画面を開き、出発地、目的地、到着期限、FIXED一覧を復元しなければならない（MUST）。Event-linkedでは現在のEvent targetを優先する。有効で現入力と一致する保存済みROUTEは初期プレビューに利用してよいが、入力条件が変わった場合は再検索まで確定に利用してはならない（MUST NOT）。

#### Scenario: 保存済みJourneyを開く

- **WHEN** ユーザーが詳細から「編集」を選ぶ
- **THEN** システムは元のJourneyと同じIDを対象とするedit modeで入力条件を復元する

#### Scenario: Event-linkedを再計画する

- **WHEN** 現在のEvent targetが保存済みtargetと異なる
- **THEN** システムは現在のEvent targetを表示し、古いROUTE結果をdirtyにして全gap再検索を求める

### Requirement: ユーザー向け表示から内部構造名を除く

画面ではJourneyを「移動予定」、FIXEDを「固定移動」と呼び、Builderのタイトルは「移動予定を追加」または「移動予定を編集」としなければならない（MUST）。ROUTE番号、section、gap、Journey Builderという内部名を通常のユーザー向け操作名や見出しに表示してはならない（MUST NOT）。

#### Scenario: 検索前と検索後を表示する

- **WHEN** ユーザーが入力画面または検索結果を開く
- **THEN** システムは内部区間の名称や番号を理解しなくても、入力、移動全体の確認、確定ができる

## REMOVED Requirements

### Requirement: 各ROUTE区間を個別に選択する

**Reason**: 未設定ROUTEごとの手動検索・確定を廃止し、一括検索と自動選択へ置き換える。保存データのROUTE allowlistは `sectionとRouteSegmentを別の階層として扱う` と `完成したJourneyだけを保存する` で維持する。

#### Scenario: FIXED間に経路を入れる

- **WHEN** 連続するFIXEDの間に経路が必要である
- **THEN** 旧仕様ではユーザーが当該ROUTEを個別検索・選択していた

#### Scenario: 固定出発に間に合う候補がない

- **WHEN** 候補が次FIXEDの出発に間に合わない
- **THEN** 旧仕様では当該ROUTEを未設定としていた
