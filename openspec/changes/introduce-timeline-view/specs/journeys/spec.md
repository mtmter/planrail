## MODIFIED Requirements

### Requirement: JourneyをEventから独立した保存単位とする

システムは `users/{uid}/journeys/{journeyId}` にJourneyを保存しなければならない（MUST）。Journeyは `event_id: string | null`、`target: {destination: PlacePoint, arrival_deadline: datetime} | null`、`departure_at`、`arrival_at`、行程順の `sections` を持つ。`event_id` がnullならStandalone、文字列ならEvent-linkedとし、1 EventにつきEvent-linked Journeyは最大1件とする。Event-linkedのtargetはEventの目的地と `event.start_at - (arrival_buffer_minutes ?? 0)` から初期設定しなければならない（MUST）。StandaloneのFIXEDのみのJourneyでは `target: null` を許容する。Event編集で導出targetの目的地同一性または到着期限が変わる場合、既存Event-linked Journeyを削除しなければならない（MUST）。検索可能だった目的地の有効座標を失う場合も削除しなければならない（MUST）。

#### Scenario: Eventから移動を計画する

- **WHEN** ユーザーが目的地と開始時刻を持つEventからJourney Builderを開く
- **THEN** システムはEventの目的地と到着期限を設定し、同じ値の再入力を要求しない

#### Scenario: Eventに検索可能な目的地がない

- **WHEN** Eventの `destination_lat` または `destination_lng` がない状態で既存Event詳細を開く
- **THEN** システムは「移動を計画」を無効にし、Places候補から場所を選ぶよう案内する

#### Scenario: TimelineでEventの目的地が検索不能である

- **WHEN** Eventの到着期限は未来だが、`destination_lat` または `destination_lng` がない状態でTimelineを見る
- **THEN** システムは移動計画に場所の候補選択が必要なことを案内し、無効な計画ボタンを並べない

#### Scenario: Event-linkedで固定移動を先に追加する

- **WHEN** ユーザーがEventからJourney Builderを開き、ROUTEを検索する前にFIXEDを入力する
- **THEN** システムはFIXEDをdraftに追加し、確定した地点情報に応じて前後のROUTE検索を提供する

#### Scenario: Standalone Journeyを作る

- **WHEN** ユーザーがEventを選ばず移動予定の追加を開始する
- **THEN** システムは `event_id: null` のJourney Builderを開く

#### Scenario: 同じEventのJourneyを再保存する

- **WHEN** 対象EventにEvent-linked Journeyが既に存在する
- **THEN** システムはそのJourneyを置換し、同じEventに二件目を作成しない

#### Scenario: targetの目的地または到着期限を変更する

- **WHEN** Event更新前後で目的地を同一地点と判定できない、または `getEventArrivalDeadline(event)` 相当の導出期限が異なる
- **THEN** システムは `journeys/event-{eventId}` をEvent更新とともに削除し、Standalone Journeyには影響させない

#### Scenario: 場所の検索可能な情報が失われる

- **WHEN** Event更新前の目的地は有効座標を持ち、更新後は同じ `place_id` が残っていても有効座標を持たない
- **THEN** システムは対応するEvent-linked Journeyを削除する

#### Scenario: targetが同じまま予定を編集する

- **WHEN** 検索可能な座標を維持し、Eventのタイトル、説明、終了時刻、同一 `place_id` の表示文字列、または導出期限が変わらない開始時刻・到着余裕時間だけを変更する
- **THEN** システムは対応するEvent-linked Journeyを維持する

### Requirement: Journeyを一本の行程として詳細表示する

システムは保存済みJourneyのROUTEとFIXEDを同じ縦型タイムラインに順番どおり表示しなければならない（MUST）。ROUTEでは既存Route詳細と同等のsegment・時刻・利用可能な公共交通詳細を表示し、FIXEDでは固定区間であること、名称、乗降地点、出発・到着時刻を明示する。Journey用の必須タイトル入力を追加してはならない（MUST NOT）。TimelineでのJourneyの大見出しは、Event-linkedなら `{event.title}へ`、targetのあるStandaloneなら `{destination.name}へ移動`、targetを持たない旧FIXED-only Standaloneなら `{最後の降車地点}へ移動` とし、既存のカレンダー項目とJourney詳細の表示名は維持しなければならない（MUST）。

#### Scenario: ROUTEとFIXEDを表示する

- **WHEN** 保存済みJourneyにROUTE、FIXED、ROUTEが含まれる
- **THEN** システムは各区間を一本の縦線上に行程順で表示し、FIXEDの固定表示と時刻を確認できる

#### Scenario: Journey名を生成する

- **WHEN** Event-linked Journeyをカレンダー項目またはJourney詳細に表示する
- **THEN** システムは `移動: {event.title}` と表示する
- **WHEN** targetのあるStandalone Journeyをカレンダー項目またはJourney詳細に表示する
- **THEN** システムは `移動: {destination.name}` と表示する
- **WHEN** FIXEDのみのStandalone Journeyをカレンダー項目またはJourney詳細に表示する
- **THEN** システムは末尾FIXEDの降車地点から表示名を生成する

#### Scenario: TimelineでJourney名を生成する

- **WHEN** Event-linked JourneyをTimelineの大見出しに表示する
- **THEN** システムは `{event.title}へ` と表示し、`移動: ` 接頭辞を付けない
- **WHEN** targetのあるStandalone JourneyをTimelineの大見出しに表示する
- **THEN** システムは `{destination.name}へ移動` と表示する
- **WHEN** targetを持たない旧FIXED-only Standalone JourneyをTimelineの大見出しに表示する
- **THEN** システムは `{最後の降車地点}へ移動` と表示する

#### Scenario: Eventの場所または到着期限が変更された

- **WHEN** 新しいEvent更新処理を経ずに残ったEvent-linked Journeyの保存済みtargetと現在のEventの目的地識別情報または到着期限が異なる
- **THEN** システムはEvent詳細とJourney詳細に再計画を促す案内を表示し、保存済みsectionsとカレンダーの時間ブロックを自動変更しない
