# journeys Specification

## Purpose
Eventに紐づく移動とStandaloneの移動を、公共交通経路と固定移動を組み合わせたJourneyとして保存・表示する現行挙動を定義する。Builderでの作成、時間制約、カレンダーと詳細表示も対象とする。

## Requirements

### Requirement: JourneyをEventから独立した保存単位とする

システムは `users/{uid}/journeys/{journeyId}` にJourneyを保存しなければならない（MUST）。Journeyは `event_id: string | null`、`target: {destination: PlacePoint, arrival_deadline: datetime} | null`、`departure_at`、`arrival_at`、行程順の `sections` を持つ。`event_id` がnullならStandalone、文字列ならEvent-linkedとし、1 EventにつきEvent-linked Journeyは最大1件とする。Event-linkedのtargetはEventの目的地と `event.start_at - (arrival_buffer_minutes ?? 0)` から初期設定しなければならない（MUST）。StandaloneのFIXEDのみのJourneyでは `target: null` を許容する。

#### Scenario: Eventから移動を計画する

- **WHEN** ユーザーが目的地と開始時刻を持つEventからJourney Builderを開く
- **THEN** システムはEventの目的地と到着期限を設定し、同じ値の再入力を要求しない

#### Scenario: Eventに検索可能な目的地がない

- **WHEN** Eventの `destination_lat` または `destination_lng` がない
- **THEN** システムは「移動を計画」を無効にし、Places候補から場所を選ぶよう案内する

#### Scenario: Event-linkedで固定移動を先に追加する

- **WHEN** ユーザーがEventからJourney Builderを開き、ROUTEを検索する前にFIXEDを入力する
- **THEN** システムはFIXEDをdraftに追加し、確定した地点情報に応じて前後のROUTE検索を提供する

#### Scenario: Standalone Journeyを作る

- **WHEN** ユーザーがEventを選ばず移動予定の追加を開始する
- **THEN** システムは `event_id: null` のJourney Builderを開く

#### Scenario: 同じEventのJourneyを再保存する

- **WHEN** 対象EventにEvent-linked Journeyが既に存在する
- **THEN** システムはそのJourneyを置換し、同じEventに二件目を作成しない

### Requirement: sectionとRouteSegmentを別の階層として扱う

Journeyの `sections` は行程の大区間を表し、各要素は `kind: ROUTE | FIXED`、`origin: PlacePoint`、`destination: PlacePoint` を持たなければならない（MUST）。ROUTE sectionは選択したRouteを1件持ち、そのRouteの `segments` に従来の `WALK`、`TRANSIT` 等を保持する。FIXED sectionをRouteSegmentとして保存してはならない（MUST NOT）。PlacePointは `name`、`address`、`place_id`、`lat`、`lng`、`types` を持ち、取得できない値はnull、typesは空配列とする。

保存するRouteは `origin`、`destination`、`departure_at`、`arrival_at`、0以上の整数の `duration_minutes`、`transport_mode`、`segments`、nullableな `transfer_count`、`walk_minutes`、`wait_minutes`、`fare` を持つ。`fare` はnullableな `currency`、`ticket`、`ic` を持つ。各segmentは `type`、`from`、`to`、`departure_at`、`arrival_at`、0以上の整数の `duration_minutes`、nullableな `line_name`、`mode`、`train_type`、`headsign`、`from_platform`、`to_platform`、`color`、`headway_based` を持つ。取得できない追加項目はnullとし、候補ID・warning・Transit固有metadata・geometryを含めてはならない（MUST NOT）。

#### Scenario: Routeと固定移動を連結する

- **WHEN** ユーザーがROUTE、FIXED、ROUTEを行程順に確定する
- **THEN** システムは3件のJourneySectionとして順序を保持し、各ROUTE内部のsegmentsをそのRoute内に保持する

### Requirement: 固定移動をJourney内に記録する

FIXED sectionは乗車地点、出発日時、降車地点、到着日時、任意の名称を保持しなければならない（MUST）。名称はnullを許容する。固定移動用の独立collectionを作ってはならない（MUST NOT）。FIXEDの地点入力にもGoogle Places候補を提供し、取得できたPlacePointの識別情報を保存する。

#### Scenario: 固定移動を経路検索より先に追加する

- **WHEN** ユーザーが新しいJourney BuilderでFIXEDを先に入力する
- **THEN** システムはその区間を画面内draftに追加し、前後の未設定区間を個別に検索可能にする

#### Scenario: 固定地点のPlaces候補が得られない

- **WHEN** FIXEDの乗降地点を名前だけで入力する
- **THEN** システムは固定区間の記録には使えるが、その地点を端点とするROUTE検索は座標を持つPlaces候補の選択まで実行しない

#### Scenario: 固定区間だけのStandaloneを保存する

- **WHEN** Standalone Journeyが時刻と地点の確定したFIXED sectionのみで構成される
- **THEN** システムは `target: null` でもJourneyを保存できる

#### Scenario: FIXEDだけでEventの目的地へ到着する

- **WHEN** Event-linked Journeyの末尾FIXEDの降車地点とEvent targetに同じplace_idがあり、到着時刻が期限以前である
- **THEN** システムは追加のROUTEなしで保存できる

#### Scenario: FIXED終点をEventの目的地と同一視できない

- **WHEN** Event-linked Journeyの末尾FIXEDとtargetに一致するplace_idがない
- **THEN** システムは名前だけで同一地点と推測せず、targetまでのROUTE確定を求める

### Requirement: 各ROUTE区間を個別に選択する

Builderは未設定のROUTE区間ごとに経路を検索し、最大3候補のうちユーザーが選んだ1件をその区間に確定しなければならない（MUST）。Journey全体の候補組み合わせを自動最適化してはならない（MUST NOT）。ROUTE sectionの保存Routeには既存の共通Route/Segment項目だけを含め、candidate ID、未選択候補、warnings、推奨情報、raw Transit metadata、geometryを含めてはならない（MUST NOT）。

#### Scenario: FIXED間に経路を入れる

- **WHEN** 連続するFIXEDの間に経路が必要である
- **THEN** システムは前FIXEDの降車地点から次FIXEDの乗車地点への候補を検索し、ユーザーが選んだ1件だけを当該ROUTE sectionへ確定する

#### Scenario: 固定出発に間に合う候補がない

- **WHEN** 検索候補のいずれも次FIXEDの出発時刻までに到着できない
- **THEN** システムはその区間を未設定のまま理由を表示し、Journey保存を許可しない

### Requirement: 完成したJourneyだけを保存する

Builderのdraftと検索結果はFirestoreへ保存してはならない（MUST NOT）。保存時はsectionsが1件以上で、必要な区間がすべて確定し、時刻が行程順に整合し、先頭sectionの出発時刻と末尾sectionの到着時刻からJourney全体の `departure_at` と `arrival_at` を導出できなければならない（MUST）。未設定ROUTE区間や時刻・地点の欠落がある場合は保存してはならない（MUST NOT）。

#### Scenario: Standaloneで目的地と期限だけを入力する

- **WHEN** ユーザーが目的地と到着期限を入力したが、ROUTEもFIXEDも確定していない
- **THEN** システムはFirestoreへJourneyを作成しない

#### Scenario: 未設定区間が残る

- **WHEN** FIXEDの前後または間に必要なROUTEが未選択である
- **THEN** システムは保存操作を無効にし、未設定区間を示す

#### Scenario: すべての区間が確定する

- **WHEN** 全sectionの地点・時刻が確定し、順序と接続が整合する
- **THEN** システムは最初の出発・最後の到着からJourney全体の時刻を導出して保存する

### Requirement: Journeyを一本の行程として詳細表示する

システムは保存済みJourneyのROUTEとFIXEDを同じ縦型タイムラインに順番どおり表示しなければならない（MUST）。ROUTEでは既存Route詳細と同等のsegment・時刻・利用可能な公共交通詳細を表示し、FIXEDでは固定区間であること、名称、乗降地点、出発・到着時刻を明示する。Journey用の必須タイトル入力を追加してはならない（MUST NOT）。

#### Scenario: ROUTEとFIXEDを表示する

- **WHEN** 保存済みJourneyにROUTE、FIXED、ROUTEが含まれる
- **THEN** システムは各区間を一本の縦線上に行程順で表示し、FIXEDの固定表示と時刻を確認できる

#### Scenario: Journey名を生成する

- **WHEN** Event-linked Journeyを表示する
- **THEN** システムは `移動: {event.title}` と表示する
- **WHEN** targetのあるStandalone Journeyを表示する
- **THEN** システムは `移動: {destination.name}` と表示する
- **WHEN** FIXEDのみのStandalone Journeyを表示する
- **THEN** システムは末尾FIXEDの降車地点から表示名を生成する

#### Scenario: Eventの場所または到着期限が変更された

- **WHEN** Event-linked Journeyの保存済みtargetと現在のEventの目的地識別情報または到着期限が異なる
- **THEN** システムはEvent詳細とJourney詳細に再計画を促す案内を表示し、保存済みsectionsとカレンダーの時間ブロックを自動変更しない
