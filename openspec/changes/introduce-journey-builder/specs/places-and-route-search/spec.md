## MODIFIED Requirements

### Requirement: 経路検索リクエストを受け付ける

システムは `POST /api/route-search` でJourneyのROUTE section向けに出発地・目的地のPlacePointと `time_constraint: {type: arrival | departure, at: YYYY-MM-DDTHH:mm}` を受け付けなければならない（MUST）。両端には有効な座標を要求する。名前のみの場合は検索せずPlaces候補の選択を促すHTTP 400を返す。PlacePointのtypesは既存の保守的な駅/停留所endpoint解決へ伝搬する。新規フロントエンドは旧Event形式を送信せず、既存クライアント向けの受理互換があってもJourneyの保存契約には影響させてはならない（MUST NOT）。

座標と表示名を持つ公共交通typeの地点だけにTransit reverse lookupを試し、300m以内で正規化した表示名が一致するstation/stop endpointがあれば使い、それ以外とreverse lookup失敗時は `geo:<lat>,<lon>` を使わなければならない（MUST）。公共交通typeがない地点やtype不明の地点は名前から推測せずgeo endpointを使う。

#### Scenario: Event-linked Journeyの区間を検索する

- **WHEN** Eventから開いたBuilderがEvent由来のtargetに基づくROUTE section検索を送る
- **THEN** APIはStandalone Journeyと同じ地点・時間制約形式で検索する

#### Scenario: JourneyのROUTE sectionを検索する

- **WHEN** フロントエンドが座標を持つ両端PlacePointと有効なtime_constraintを送る
- **THEN** APIは地点を解決し、指定された到着または出発制約で経路を検索する

#### Scenario: Journeyの地点が名前のみである

- **WHEN** ROUTE sectionの出発地または目的地に有効な座標がない
- **THEN** APIは文字列から地点を推測せずHTTP 400を返す

#### Scenario: Journeyの時間制約が不正である

- **WHEN** time_constraintのtypeが未知、またはatが有効な日時でない
- **THEN** APIはProviderを呼ばず入力エラーを返す

#### Scenario: 公共交通地点の候補を選択する

- **WHEN** PlacePointのtypesに公共交通typeがあり、近傍のstation/stop候補と表示名が一致する
- **THEN** システムは既存の保守的なTransit endpoint解決を使う

#### Scenario: 一般地点またはreverse失敗

- **WHEN** PlacePointに公共交通typeがない、またはreverse lookupが失敗する
- **THEN** システムは保存済み座標からgeo endpointを作り検索を続ける

#### Scenario: 出発地と目的地の両方に座標がある

- **WHEN** 出発地と目的地の両方に有効な座標がある
- **THEN** システムはそれぞれの座標を経路検索へ渡す

#### Scenario: 地点を解決する

- **WHEN** 経路検索の地点が座標を持つ
- **THEN** システムは既存の地点解決処理で検索用endpointを決める

#### Scenario: 一般POIを解決する

- **WHEN** 地点が公共交通typeを持たない一般POIである
- **THEN** システムは名前から駅を推測せずgeo endpointを使う

#### Scenario: 既存データに地点typeがない

- **WHEN** 保存済み地点にtypesがない
- **THEN** システムは保守的な駅endpoint推測を行わずgeo endpointを使う

#### Scenario: 駅または停留所名が近傍候補と一致する

- **WHEN** 公共交通地点の表示名が近傍候補と一致する
- **THEN** システムは一致した駅または停留所endpointを使う

#### Scenario: 駅または停留所名が一致しない

- **WHEN** 公共交通地点の表示名が近傍候補と一致しない
- **THEN** システムはgeo endpointへフォールバックする

#### Scenario: reverse検索に失敗する

- **WHEN** reverse lookupが失敗する
- **THEN** システムはgeo endpointで検索を継続する

#### Scenario: 地点を検索用endpointへ解決できない

- **WHEN** 出発地または目的地に有効な座標がない
- **THEN** APIはHTTP 400を返す

#### Scenario: 出発地または目的地がない

- **WHEN** 出発地または目的地の情報が空である
- **THEN** APIはHTTP 400を返す

#### Scenario: 予定開始日時が不正である

- **WHEN** 時間制約の日時が不正である
- **THEN** APIはProviderを呼ばずHTTP 400を返す

### Requirement: 経路結果を登録前に表示する

フロントエンドはJourney sectionの検索結果で最大3件の候補を比較・選択できるようにし、推奨候補を初期選択し、選択中候補の既存Routeタイムラインを表示しなければならない（MUST）。候補カードには出発・到着、所要時間、利用可能な乗換・徒歩・運賃を表示し、未取得値を0と見せてはならない（MUST NOT）。warningは検索結果で表示し、保存データへ含めない。

#### Scenario: Journey sectionの候補を選択する

- **WHEN** ユーザーが1件以上3件以下の候補から1件を選ぶ
- **THEN** システムはその候補の詳細を表示し、選んだ1件を当該sectionのdraftへ確定する

#### Scenario: 条件を変更する

- **WHEN** ユーザーが当該sectionの検索条件を変更する
- **THEN** システムはその区間の検索結果と選択候補をクリアし、他の確定区間を維持する

#### Scenario: 検索に成功する

- **WHEN** 経路検索APIが有効な候補を返す
- **THEN** システムは候補をBuilder内に表示する

#### Scenario: 初期候補を選択する

- **WHEN** 検索直後に候補が返る
- **THEN** システムは推奨候補または先頭候補を初期選択する

#### Scenario: 推奨表示の候補をユーザーが選び直す

- **WHEN** ユーザーが推奨候補と異なる候補を選ぶ
- **THEN** システムは選択した候補を当該sectionへ確定する

#### Scenario: 選択した経路を登録する

- **WHEN** ユーザーが全区間を確定してJourney保存を選ぶ
- **THEN** システムは選択した経路だけをJourneyへ保存する

#### Scenario: Coverage warningがある

- **WHEN** 検索結果にcoverage warningがある
- **THEN** システムは画面にwarningを表示し保存データへ含めない

## ADDED Requirements

### Requirement: Journey sectionの時間制約を適用する

システムはJourney Builderが指定した `time_constraint` の日時と種別を用いなければならない（MUST）。Event-linkedの到着期限はフロントエンドが `event.start_at - (arrival_buffer_minutes ?? 0)` で求め、Standaloneと同じ区間検索契約に渡す。Transit APIへは日本時間の `date=YYYYMMDD` と `time=HH:MM`、到着制約なら `type=arrival`、出発制約なら `type=departure` を渡す。いずれも `numItineraries=3`、`strategy=balanced`、`live=false`、`tracking=none` とする。

#### Scenario: Event-linkedの期限を検索に使う

- **WHEN** Event-linked Journeyがtargetへ向かうROUTEを検索する
- **THEN** システムはEventから計算した到着期限をarrival制約として渡す

#### Scenario: FIXED後から出発する

- **WHEN** ROUTE sectionがFIXED到着後の出発を必要とする
- **THEN** システムはFIXED到着時刻をTransitのdeparture検索へ渡す

#### Scenario: 最大3件の候補を要求する

- **WHEN** Journeyの経路検索をTransitへ送る
- **THEN** システムはbalanced itineraryを最大3件要求し、返された有効候補の順序を維持する

### Requirement: Journey sectionの上下限を検証する

システムはJourneyの各ROUTE区間で、先頭から最初のFIXEDまではそのFIXED出発時刻以前の到着、FIXED間では前FIXED到着時刻以降の出発と次FIXED出発時刻以前の到着、最後のFIXEDからtargetまではFIXED到着時刻以降の出発とtarget到着期限以前の到着、FIXEDなしではtarget到着期限以前の到着を条件にしなければならない（MUST）。複数制約のときはAPIの出発制約で得た候補の実際の発着時刻を上下限で検証し、満たさない候補を選択可能にしてはならない（MUST NOT）。

#### Scenario: 最初のFIXEDへ向かう

- **WHEN** Journeyの開始地点から最初のFIXED乗車地点へのROUTEを検索する
- **THEN** システムはFIXED出発時刻を到着制約にする

#### Scenario: 二つのFIXEDをつなぐ

- **WHEN** 前FIXEDと次FIXEDの間のROUTEを検索する
- **THEN** システムは前FIXED到着時刻を出発制約にし、次FIXED出発時刻までに到着する候補だけを選択可能にする

#### Scenario: 最後のFIXEDからtargetへ向かう

- **WHEN** 最後のFIXEDからtargetへのROUTEを検索する
- **THEN** システムはFIXED到着時刻を出発制約にし、target到着期限までに到着する候補だけを選択可能にする

#### Scenario: 有効候補がない

- **WHEN** Providerが返した最大3候補のうち上下限を満たすものがない
- **THEN** システムは区間を未確定として理由を表示し、追加候補の取得や行程全体の自動最適化を行わない

## REMOVED Requirements

### Requirement: 到着希望日時を計算する

**Reason**: Event専用のAPI計算を廃止し、Event-linkedを含むJourney Builderが時間制約を渡す。

**Migration**: 旧Eventリクエスト形式は維持しない。

バックエンドは予定開始日時から到着余裕時間を減算してTransit APIへ渡す到着希望日時を計算しなければならない（MUST）。到着余裕時間が未設定の場合は0分として扱わなければならない（MUST）。日時は日本時間の `date=YYYYMMDD` と `time=HH:MM` に分け、`/api/v1/guidance/plan` の `type=arrival` で問い合わせなければならない（MUST）。問い合わせでは `numItineraries=3`、`strategy=balanced`、`live=false`、`tracking=none` を指定する。

#### Scenario: 到着余裕時間が設定されている

- **WHEN** 予定開始が10:30で到着余裕時間が10分である
- **THEN** バックエンドは10:20を到着希望日時として検索する

#### Scenario: 1件のbalanced itineraryを検索する

- **WHEN** バックエンドは3件を要求し、Transit APIが有効なoptionを1件だけ返す
- **THEN** システムはその1件だけを候補として返す

#### Scenario: 最大3件のbalanced itineraryを検索する

- **WHEN** バックエンドがTransit APIへ経路検索を送る
- **THEN** リクエストは `numItineraries=3`、`strategy=balanced`、`live=false`、`tracking=none` を指定する
