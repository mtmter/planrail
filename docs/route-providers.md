# Route Providers

この文書は、現在実装されている経路Providerと変換処理の保守情報をまとめます。利用者に見えるAPI契約は `openspec/specs/places-and-route-search/spec.md` とその未アーカイブの変更差分を参照してください。

## Providerの選択

`ROUTE_PROVIDER` では `transit` または `mock` を指定します。未設定時は `transit` です。

| 値 | 動作 |
| --- | --- |
| `transit` | Transit APIで公共交通経路を検索する。通常のProvider |
| `mock` | ローカルのTransit形式fixtureを変換する。開発・自動テスト用 |

対応していない値はProvider設定エラーになり、`POST /api/route-search` はHTTP 502を返します。Transit APIは公開APIで、APIキーは不要です。

```text
Transit Provider ──┬── /api/v1/places/reverse (駅・停留所候補への安全な解決)
                   └── /api/v1/guidance/plan (到着時刻指定の経路検索)
                                      │
                                      v
                         convert_transit_routes()
                                      │
                                      v
                         RouteCandidate response
```

API仕様は[Transit API reference](https://api.transit.ls8h.com/api/docs)と[OpenAPI JSON](https://api.transit.ls8h.com/api/openapi.json)を参照してください。

## Transit Provider

Transit Providerは次の条件で `GET /api/v1/guidance/plan` を呼び出します。

```text
from=<station endpoint | geo:<lat>,<lon>>
to=<station endpoint | geo:<lat>,<lon>>
fromLabel=<origin display name>
toLabel=<destination display name>
date=YYYYMMDD
time=HH:MM
type=arrival
numItineraries=3
strategy=balanced
live=false
tracking=none
```

`date` と `time` は予定開始日時から到着余裕時間を引いた時刻を日本時間にして作ります。`/api/route-search` から来るタイムゾーンなしの日時は、日本時間として扱います。1回のHTTP呼び出しは10秒でタイムアウトします。

### Google Places地点の駅・停留所解決

緯度・経度と表示名がある各地点について、Transitの `GET /api/v1/places/reverse` を `radiusMeters=300`、`limit=10` で呼び出します。候補のうち `station` または `stop` で、planner endpointがあり300m以内のものだけを対象にします。名前はUnicode NFKC、case folding、空白除去の後、末尾の `駅`、`バス停`、`停留所`、`station`、`busstop`、`stop` のいずれかを1つだけ取り除いて完全一致で比較します。複数一致時は最も近い候補を使います。

名前が一致しない場合やreverse検索の通信・HTTP・JSON・レスポンス形式に問題がある場合はstation/stopへ吸着せず `geo:<lat>,<lon>` を使います。場所候補を選んでいない自由入力には座標もTransit endpointもないため、経路検索はHTTP 400でGoogle Places候補の選択を促します。これは予定のテキストのみ保存を妨げません。

Transit endpointやPlace IDはリクエスト時だけ利用し、共通Route JSONやFirestoreの予定・移動予定へ保存しません。

### エラー

- Transit APIのタイムアウト、接続失敗、HTTPエラー、planの不正JSONまたは変換エラー: HTTP 502
- planに候補がない、または候補が徒歩legだけ: HTTP 404
- planner endpointを作れない座標なし入力: HTTP 400
- reverse APIのエラー: `geo:` にフォールバックし、plan検索を継続

成功レスポンスはTransitの候補順を保った最大3件の候補を返し、徒歩legだけの候補は除外します。各候補には比較用の乗換数、徒歩・待ち時間、運賃と拡張leg情報を含めます。推奨候補IDはTransitのdecision情報を優先し、なければ候補の推奨フラグ、さらに該当がなければ最初の有効候補を使います。既知のcoverage noticeは日本語の警告として返します。

## Mock Provider

Mock Providerは `backend/fixtures/transit_guidance_plan_demo.json` を読み込みます。fixtureの基準検索日時はコード上で `2026-08-25T10:12:00+09:00` です。検索日時との差分をfixture内のjourney/legの `departureSecs` と `arrivalSecs` に加えて表示時刻を移動します。Transit APIへ通信せず、実Providerと同じconverterを使用します。指定時刻に実際の運行便を再検索するものではありません。

fixtureを置き換える場合は `mock_provider.py` の `FIXTURE_DESIRED_ARRIVAL_AT` もfixtureの基準条件に合わせてください。

## Converter

`convert_transit_routes()` はTransitの `options` を先頭から最大3件変換し、Transitの `date` と `timezone` のサービス日0時に `departureSecs`、`arrivalSecs` を加えて日時を作ります。秒値は翌日に進んだり負になったりするため、日付をまたぐ値もそのまま扱います。画面用の日時は日本時間の `YYYY-MM-DDTHH:mm`、durationは秒数から分へ切り上げます。レスポンスは `candidates`、`recommended_candidate_id`、`warnings` の形式で、候補IDはそのレスポンス内でのみ有効です。

- `kind=walk` は `WALK`、`line_name=null`
- `kind=transit` は `TRANSIT`、`line_name=routeName`。取得できる場合は列車種別、方面、乗降platform、路線色、headway情報も含めます
- 公共交通legがないjourneyは採用せず、経路なしとしてHTTP 404
- `transfer_count`、`walk_minutes`、`wait_minutes`、`fare` は欠損値をnullで表し、IC運賃がある場合は通常運賃より優先します
- Transitの駅ID、生レスポンス、geometry、ranking metadataは共通Route JSONに含めません

検索レスポンスの候補一覧やwarning、推奨・順位情報は検索中だけの情報です。Firestoreには利用者が選択した候補1件の明示的なallowlist項目だけを保存し、候補ID、他候補、warning、Transit固有のranking metadata、geometryは保存しません。

Transitの生レスポンスやTransit endpoint IDはフロントエンドへ渡しません。
