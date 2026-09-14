## Why

Transit経路検索は、Google Placesで得た出発地・目的地の両方について、駅名が一致する可能性の低い一般POIにもreverse lookupを行ってから `/guidance/plan` を呼び出す。不要な通信をなくし、各処理段階の時間を位置情報を含めずに観測できるようにすることで、長距離検索の遅延原因を判別し、plan timeoutによる失敗を減らす。

## What Changes

- Places候補のtype情報を経路検索に伝え、駅・停留所等の公共交通地点に限って既存のTransit reverse lookupと厳密な名称一致によるendpoint解決を行う。
- 公共交通typeがない一般POIと、type情報のない既存データはreverse lookupせず、保存済み座標から `geo:<lat>,<lng>` endpointを直接使う。
- endpoint解決、Transit `/guidance/plan`、RouteCandidate変換、検索全体の段階別latencyを、地点名・住所・座標・Place IDを含めないサーバーログで確認可能にする。
- Transit `/guidance/plan` のtimeoutを30秒から45秒へ変更する。reverse lookupの10秒timeout、失敗時fallback、504を含む既存エラー分類は維持する。
- `POST /api/route-search`、RouteCandidateとsegmentのレスポンス、最大3候補、recommended candidate、保存済み座標、候補未選択時のvalidationを維持する。

**対象外:** FastAPI全体のasync化、`httpx.AsyncClient`への全面移行、reverse lookupの並列化、TanStack Queryやserver state管理の変更、別route provider、キャッシュ、インフラ移行、大規模UI変更。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `places-and-route-search`: Places候補のtype保持、地点typeに基づくendpoint解決、診断用latencyログ、およびTransit plan timeoutを変更する。

## Impact

- Frontend: Places候補の `types` 取得、予定への目的地type保存、route-search requestへのorigin/destination type伝搬。
- Backend: route-search request model、Transit endpoint resolution、段階別計測ログ、plan timeoutと関連unit tests。
- Firestoreの既存予定は移行しない。新しいtype情報を持たない既存データは安全側に倒して座標endpointを使うため、既存の `destination_lat` / `destination_lng` は引き続き必要かつ維持される。
- 成功レスポンスのAPI契約、Transit由来の駅前徒歩区間、400/404/502/504の分類に変更はない。
