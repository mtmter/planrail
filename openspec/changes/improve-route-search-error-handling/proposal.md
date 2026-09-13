## Why

長距離経路検索ではTransit guidance planが現在の10秒timeoutを超えることがあり、timeoutを接続・HTTP・レスポンス・変換エラーと区別できず、ユーザーにも運用者にも原因が伝わりにくい。経路検索の待機上限と失敗分類を見直し、再試行の判断と障害調査に必要な情報を提供する。

## What Changes

- Transit `/api/v1/guidance/plan` のtimeoutを30秒にし、補助的な `/api/v1/places/reverse` は10秒を維持する。
- Guidance planのtimeoutを専用の内部サービスエラーとして伝搬し、HTTP 504へ変換する。その他のprovider・レスポンス・変換エラーはHTTP 502を維持し、入力エラー400と経路なし404も維持する。
- フロントエンドはHTTP 504と502で異なる日本語エラーを表示する。自動retryは行わない。
- 5xxへ変換する経路検索エラーを、例外chain・原因・stack trace、およびTransit HTTP status codeを追跡できる標準loggingで記録する。リクエスト本文、利用者情報、地点ID・座標をログへ含めない。
- 外部APIに依存しない自動テストでtimeout値、例外分類、HTTP status、ログ、フロント表示、およびretryしないことを確認する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `places-and-route-search`: Transit guidance planとreverse lookupのtimeout、経路検索エラーのHTTP分類・表示、および5xx診断ログの要件を更新する。

## Impact

- バックエンド: `backend/route_providers/transit_provider.py`、`backend/routes_service.py`、`backend/main.py` とそれらのunit test。
- フロントエンド: `frontend/src/App.jsx` の経路検索エラー分岐と関連テスト。
- API利用者には、Transit guidance planのtimeoutが502から504へ分類され、フロントの502/504メッセージが具体化される。リクエスト・レスポンス形式、PlacesからTransit endpointへの解決、retry動作、route provider構成は変更しない。
