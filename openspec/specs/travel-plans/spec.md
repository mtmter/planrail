# Travel Plans Specification

## Purpose

検索した経路を予定に対応する移動予定として保存・表示する現行挙動を定義する。検索結果と永続化の境界、上書き、削除連携もこの仕様の対象とする。

## Requirements

### Requirement: 検索と保存を分離する

経路を検索しただけでは移動予定を保存してはならない（MUST）。登録時はユーザーが選択したRouteCandidate 1件だけを対象予定の移動予定として保存しなければならない（MUST）。保存データはPlanRailの共通Route/Segment項目から明示的に構築し、候補選択用ID、未選択候補、推奨情報、coverage warning、Transitのrank・score・decision metadata、raw response、geometryを含めてはならない（MUST NOT）。

#### Scenario: 経路を検索する

- **WHEN** 経路検索APIが結果を返す
- **THEN** システムは結果を画面に表示するがFirestoreへ保存しない

#### Scenario: 経路を登録する

- **WHEN** ユーザーが候補を選択して「この経路を登録」を選ぶ
- **THEN** システムは選択した候補1件だけを対象予定の移動予定としてFirestoreへ保存する

#### Scenario: 検索専用データを含む候補を登録する

- **WHEN** 選択中候補や検索レスポンスに候補ID、推奨情報、warnings、Transit metadata、またはgeometryが含まれる
- **THEN** システムはそれらを保存せず、選択した共通Route/Segment項目だけを保存する

### Requirement: 1予定につき1件保存する

移動予定は `users/{uid}/travelPlans/{eventId}` に保存し、保存データへ文字列の `event_id` を含めなければならない（MUST）。

#### Scenario: 初めて登録する

- **WHEN** 対象予定に移動予定が存在しない
- **THEN** システムは予定IDをドキュメントIDとして移動予定を作成する

#### Scenario: 再検索結果を登録する

- **WHEN** 対象予定に既存の移動予定がある状態で新しい経路を登録する
- **THEN** システムは同じドキュメントIDの内容を上書きする

### Requirement: 予定詳細で移動予定を表示する

システムは予定詳細を開いたとき、その予定IDに対応する移動予定をFirestoreから読み込まなければならない（MUST）。保存した経路情報から再検索を行わずに、出発・到着時刻、所要時間、出発地、目的地、区間、取得済みの乗換回数、徒歩・待ち時間、運賃、および区間の公共交通詳細を表示できなければならない（MUST）。

登録済みの移動予定は、経路検索結果で選択中のRoute詳細と同等の情報を表示しなければならない（MUST）。Route全体の出発時刻、到着時刻、総所要時間、出発地、目的地に加え、各segmentの種別、路線名、所要時間、発着地点、出発時刻、到着時刻を表示する。値が存在する場合は、mode、train type、headsign、from/to platform、headway情報も表示する。segmentの発着時刻は各segmentの詳細として確認できなければならない（MUST）。nullableまたは未設定の追加情報はその項目だけを表示せず、他の利用可能なRoute情報の表示を続けなければならない（MUST）。

Firestoreへ保存するRoute項目は `origin`、`destination`、`departure_at`、`arrival_at`、0以上の整数の `duration_minutes`、`transport_mode`、`segments`、nullableな `transfer_count`、`walk_minutes`、`wait_minutes`、およびnullableな `fare` とする。`fare` は `currency: string | null`、`ticket: number | null`、`ic: number | null` を持つ。各segmentは `type`、`from`、`to`、`departure_at`、`arrival_at`、0以上の整数の `duration_minutes`、`line_name: string | null` に加え、nullableな `mode`、`train_type`、`headsign`、`from_platform`、`to_platform`、`color`、`headway_based` を持つ。Transitから値を取得できなかった追加項目はnullとして保存する。既存移動予定に新しい項目がなくても読み込みと表示を続ける。

移動予定が持つ比較用metricsは、乗換回数、徒歩時間、待ち時間、運賃の順に、利用可能な値だけを経路全体の補助サマリーとしてコンパクトに表示する。運賃はIC運賃を優先し、なければticket運賃を表示する。

予定詳細は登録済みRouteを1件表示する。候補比較、候補選択、おすすめ表示、coverage warningなど経路検索専用の情報は予定詳細へ表示してはならない（MUST NOT）。予定詳細固有の移動予定見出し、読み込み中表示、未登録時の空状態、経路再検索操作は維持する。segment一覧が欠落または旧形式であっても、表示可能な基本Route情報を表示しなければならず、旧データをmigrationしてはならない（MUST NOT）。

#### Scenario: 登録済み移動予定がある

- **WHEN** 予定詳細の読み込み時に対応する移動予定が存在する
- **THEN** システムはRoute全体の出発・到着時刻、所要時間、出発地、目的地と、利用可能なsegment詳細を表示し、経路再検索操作を提供する

#### Scenario: segmentごとの発着時刻と詳細を表示する

- **WHEN** travel planに出発・到着時刻、segmentの発着時刻、および路線・mode・train type・headsign・platform・headway情報が保存されている
- **THEN** システムはRoute全体の発着時刻と各segmentの発着時刻を表示し、存在するsegment情報を経路検索結果の選択中Route詳細と同等に確認できるようにする

#### Scenario: 拡張Route情報を保存後に表示する

- **WHEN** travel planに比較用Route情報または公共交通segmentの追加情報が保存されている
- **THEN** システムは再検索せずに取得済みの乗換数、徒歩・待ち時間、IC運賃優先の運賃、mode、train type、headsign、platform、headway情報を詳細表示する。segmentの`color`は保存済みroute dataに保持し、色を使った表示は要求しない

#### Scenario: nullableなRoute情報が保存されている

- **WHEN** travel planの運賃または比較用・追加segment情報の一部がnullまたは未設定である
- **THEN** システムは既存の必須Route/segment詳細を引き続き表示し、null値を0または空の確定情報として扱わない

#### Scenario: 旧形式またはsegment一覧のない移動予定を表示する

- **WHEN** travel planに新しいoptional fieldがない、segment一覧が欠落・空である、またはsegmentが新しい追加情報を持たない旧形式である
- **THEN** システムはmigrationを行わず、存在する基本Route情報と旧形式segmentの表示可能な値を表示し続ける

#### Scenario: 予定詳細に検索専用情報を表示しない

- **WHEN** 登録済みの移動予定を予定詳細に表示する
- **THEN** システムは候補番号、候補選択、おすすめ表示、coverage warning、検索時専用metadataを表示せず、1件の登録済みRouteと補助metricsを表示する

#### Scenario: 移動予定がない

- **WHEN** 対応する移動予定が存在せず、予定に経路検索可能な目的地がある
- **THEN** システムは移動予定がないことと経路検索操作を表示する

### Requirement: 予定削除時に移動予定を削除する

システムは予定削除時に対応する移動予定も削除しなければならない（MUST）。

#### Scenario: 予定を削除する

- **WHEN** ユーザーが予定の削除を確定する
- **THEN** システムは同じ予定IDをドキュメントIDとする移動予定も同じバッチで削除する

### Requirement: カレンダー表示とは独立して扱う

現行システムは移動予定を予定詳細に表示し、月・週・日のカレンダー用データとして読み込んではならない（MUST）。カレンダーには予定だけを表示しなければならない（MUST）。

#### Scenario: カレンダーを表示する

- **WHEN** 月、週、日のカレンダーを表示する
- **THEN** システムは予定だけを表示し、移動予定を時間ブロックとして表示しない
