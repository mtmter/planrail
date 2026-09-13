# Places and Route Search Specification

## Purpose

場所入力、Google Mapsリンク、および公共交通経路検索APIの現行契約を定義する。Provider選択、共通レスポンス、検索結果表示までをこの仕様の対象とする。

## Requirements

### Requirement: 場所候補と文字入力を提供する

予定の追加・編集時と経路検索時の地点入力には、1つのGoogle Places候補入力を提供しなければならない（MUST）。Google Maps APIキーがない場合または候補を読み込めない場合は、通常の文字入力へフォールバックしなければならない。

#### Scenario: Places候補を選択する

- **WHEN** ユーザーがPlaces候補を選択する
- **THEN** システムは場所名、住所、Place ID、緯度、経度を取得する

#### Scenario: 候補を選択せず入力する

- **WHEN** ユーザーが文字列だけを入力する
- **THEN** システムはPlace IDや座標がなくても、予定の単一場所として受け付ける

#### Scenario: 予定へ候補を保存する

- **WHEN** 選択したPlaces候補を含む予定を保存する
- **THEN** システムは名前を `location_name`、住所を `destination`、Place IDを `destination_place_id`、座標を `destination_lat` と `destination_lng` に保存する

### Requirement: 座標を持つ地点だけで経路検索を開始する

システムは、検索する両地点に緯度と経度がそろっている場合だけ経路検索操作を有効にしなければならない（MUST）。予定の自由入力場所は保存できるが、座標を持たないまま経路検索APIへ送信してはならない（MUST NOT）。

#### Scenario: 保存済み予定に座標がない

- **WHEN** ユーザーが座標を持たない予定の経路検索操作を表示する
- **THEN** システムは操作を無効化し、Places候補を選び直す案内を表示する

#### Scenario: 検索地点を自由入力した

- **WHEN** ユーザーが経路検索フォームの地点を候補選択せずに入力する
- **THEN** システムは検索を開始せず、候補を選択する案内を表示する

#### Scenario: 保存済み地点に座標がない状態で再検索する

- **WHEN** ユーザーが予定詳細または移動詳細から経路を再検索する
- **THEN** システムは座標のない保存済み地点をPlaces候補から選び直す入力を表示し、選択後に経路検索を開始できる

### Requirement: Google Mapsリンクを生成する

予定に場所名、住所、座標、またはPlace IDから検索可能な情報がある場合、システムは保存済みURLではなく表示時にGoogle Maps Search URLを生成しなければならない（MUST）。

#### Scenario: Place IDがある

- **WHEN** 予定に `destination_place_id` がある
- **THEN** システムはURLへ `query_place_id` を含める

#### Scenario: Place IDがない

- **WHEN** 予定にPlace IDがなく、住所、場所名、または座標がある
- **THEN** システムは利用可能な値を `query` とするリンクを表示する

### Requirement: 経路検索リクエストを受け付ける

システムは `POST /api/route-search` で出発地情報と対象予定をJSONとして受け付けなければならない（MUST）。

#### Scenario: 地点を解決する

- **WHEN** 出発地または目的地に緯度と経度の両方がある
- **THEN** システムは `緯度,経度` をProviderへ渡す地点として優先する
- **WHEN** 座標がない
- **THEN** システムは住所、次に表示名の順で利用可能な文字列を使用する

#### Scenario: 出発地または目的地がない

- **WHEN** 利用可能な出発地または目的地の情報がない
- **THEN** APIはHTTP 400を返す

#### Scenario: 予定開始日時が不正である

- **WHEN** `event.start_at` が `YYYY-MM-DDTHH:mm` として解析できない
- **THEN** APIはHTTP 400を返す

### Requirement: 到着希望日時を計算する

バックエンドは予定開始日時から到着余裕時間を減算してProviderへ渡す到着希望日時を計算しなければならない（MUST）。到着余裕時間が未設定の場合は0分として扱わなければならない。

#### Scenario: 到着余裕時間が設定されている

- **WHEN** 予定開始が10:30で到着余裕時間が10分である
- **THEN** バックエンドは10:20を到着希望日時として検索する

### Requirement: Route Providerを選択する

バックエンドは `ROUTE_PROVIDER_MODE` によりProviderを選択し、未設定時は `auto` を使用しなければならない（MUST）。`auto` は日本国内の座標を持つ両地点にLS8H Transit APIを優先して使用しなければならない（MUST）。

#### Scenario: 未知のProviderを指定する

- **WHEN** `ROUTE_PROVIDER` に対応していない名前を指定する
- **THEN** APIはProvider設定エラーとしてHTTP 502を返す

#### Scenario: 駅すぱあとキーがない

- **WHEN** `ekispert` を選択し `EKISPERT_API_KEY` が設定されていない
- **THEN** APIはHTTP 500を返す

#### Scenario: LS8H Transit APIで公共交通を検索する

- **WHEN** `transit` または国内座標の `auto` を選択して経路を検索する
- **THEN** バックエンドはLS8H Transit APIへ座標、日付、時刻および到着・出発種別を送る

#### Scenario: 徒歩候補と公共交通候補が混在する

- **WHEN** LS8H Transit APIが徒歩のみの候補と公共交通を含む候補を返す
- **THEN** バックエンドは公共交通を含む候補を共通Routeとして返す

### Requirement: 共通Route JSONを返す

Providerのレスポンスは、フロントエンドへ返す前に次の共通形式へ変換しなければならない（MUST）。

```text
origin: string
destination: string
departure_at: YYYY-MM-DDTHH:mm
arrival_at: YYYY-MM-DDTHH:mm
duration_minutes: 0以上の整数
transport_mode: string
segments: RouteSegment[]

RouteSegment:
  type: string
  from: string
  to: string
  departure_at: YYYY-MM-DDTHH:mm
  arrival_at: YYYY-MM-DDTHH:mm
  duration_minutes: 0以上の整数
  line_name: string | null
```

#### Scenario: 駅すぱあと形式を変換する

- **WHEN** Providerが有効な駅すぱあと形式のCourseを返す
- **THEN** システムは最初のCourseを共通Route JSONへ変換する

#### Scenario: 経路がない

- **WHEN** Providerの結果にCourseがない
- **THEN** APIはHTTP 404を返す

#### Scenario: Providerとの通信または変換に失敗する

- **WHEN** Providerが通信エラーまたは不正なデータを返す
- **THEN** APIはHTTP 502を返す

### Requirement: 読める経路ラベルを表示する

システムは経路区間に人が読める路線名または路線記号を表示しなければならない（MUST）。数字だけのProvider内部識別子を路線名として表示してはならない（MUST NOT）。

#### Scenario: 数字だけの路線識別子を受け取る

- **WHEN** Providerが数字だけの区間ラベルを返す
- **THEN** システムはそれを表示せず、利用可能な読める路線名または交通種別を表示する

### Requirement: 経路結果を登録前に表示する

フロントエンドは検索結果の出発・到着時刻、所要時間、出発地、目的地、および各区間を表示しなければならない（MUST）。

#### Scenario: 検索に成功する

- **WHEN** 経路検索APIが共通Route JSONを返す
- **THEN** システムは縦型の経路結果と「この経路を登録」操作を表示する

#### Scenario: 条件を変更する

- **WHEN** ユーザーが検索条件の変更を選択する
- **THEN** システムは検索結果をクリアして出発地入力へ戻る
