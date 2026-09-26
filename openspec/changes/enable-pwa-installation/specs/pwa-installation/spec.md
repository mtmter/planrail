## Purpose

PlanRailを既存のWebアプリと同じ機能のまま、iPhoneとAndroidのホーム画面から起動できるPWAとして提供する。静的な起動資源と更新、通常のブラウザ利用との共存を定義する。

## ADDED Requirements

### Requirement: PlanRailのインストール情報を配信する

システムはHTTPSのfrontend originから有効なWeb App Manifestを配信し、`name`と`short_name`を`PlanRail`、`display`を`standalone`、`start_url`と`scope`を`/`、`theme_color`を`#2957c8`、`background_color`を`#ffffff`としなければならない（MUST）。manifestは取得可能な192×192と512×512の通常アイコン、maskable用途のアイコンを参照しなければならない（MUST）。

#### Scenario: 本番のmanifestを取得する

- **WHEN** Vercelのfrontend originでmanifestを取得する
- **THEN** JSONとして正しいContent-Typeで取得でき、定義した名前・表示・URL・色・アイコンが読み取れ、アイコンURLは画像を返す

#### Scenario: ホーム画面へ追加する

- **WHEN** 対応ブラウザでPlanRailをホーム画面へ追加する
- **THEN** PlanRailの名前とアイコンが使用され、起動先は同じoriginの`/`になる

### Requirement: ホーム画面から既存アプリを起動する

システムはiPhone SafariとAndroidの対応ブラウザから追加されたホーム画面アイコンで、同じReactアプリをstandalone表示で起動しなければならない（MUST）。起動後の認証と画面遷移は既存のものを使い、新しいPWA専用ホーム画面を挟んではならない（MUST NOT）。

#### Scenario: iPhoneのホーム画面から開く

- **WHEN** iPhone Safariからホーム画面へ追加したPlanRailをアイコンから開く
- **THEN** 通常のSafariタブではなくstandaloneのWebアプリとして起動し、ログイン後に既存のタイムライン・カレンダー・準備を利用できる

#### Scenario: Androidのホーム画面から開く

- **WHEN** Androidの対応ブラウザからインストールしたPlanRailをアイコンから開く
- **THEN** standaloneで起動し、通常のWeb版と同じ認証済み画面を利用できる

#### Scenario: 通常のブラウザから開く

- **WHEN** PCブラウザ、通常のスマホSafari/Chrome、またはVercel previewでPlanRailを開く
- **THEN** 既存のReactアプリ、認証、PCまたはスマホの画面構造と操作が引き続き利用できる

### Requirement: 静的な起動資源のみをキャッシュする

システムはproduction buildのapp shellと静的assetをService Workerで基本的にキャッシュしなければならない（MUST）。Service WorkerはFirestoreのユーザーデータ、Firebase Authentication、経路検索、Google Places、Transit、Journey検索結果、その他の動的APIレスポンスをruntime cacheしてはならない（MUST NOT）。

#### Scenario: オンラインで再起動する

- **WHEN** インストール済みPWAをネットワーク接続下で再起動する
- **THEN** 静的資源からアプリを起動でき、ユーザーデータと外部機能は従来どおりネットワークを利用する

#### Scenario: ネットワークがない

- **WHEN** Service Worker導入後にネットワークを切ってPWAを開く
- **THEN** キャッシュ済みの静的な起動資源は利用できるが、認証・Firestoreデータ・経路検索などの動的機能をオフラインで成功したものとして扱わない

### Requirement: デプロイ後の版を自動更新する

システムはService Workerの新しい版を自動的に確認・有効化し、再訪または起動後に手動のキャッシュ削除や更新ボタンを要求せず、新しいVercel deploymentの静的アプリ版へ移行できなければならない（MUST）。古い版の不要なprecacheは更新後に残し続けてはならない（MUST NOT）。

#### Scenario: 新しいbuildをデプロイする

- **WHEN** インストール済みPWAを一度起動した後、frontendの新しいbuildを同じoriginへデプロイして再訪または再起動する
- **THEN** Service Worker更新を検出・適用し、手動のキャッシュ削除なしに新しい静的アプリ版を表示できる

### Requirement: standaloneでも画面の操作領域を守る

システムは既存の`viewport-fit=cover`とスマホ画面構造を維持し、standalone時にもtop bar、bottom navigation、FAB、modal、bottom sheetの操作領域がnotch・Dynamic Island・status bar・Home Indicatorと重ならないようにしなければならない（MUST）。

#### Scenario: safe areaのあるiPhoneで操作する

- **WHEN** safe areaのあるiPhoneでホーム画面から起動して画面やmodalを操作する
- **THEN** タイムライン・カレンダー・準備の移動、FAB、modalとbottom sheetの表示・閉じる操作が画面の安全領域内で行える

### Requirement: Vercelのfrontend originでPWA資源を配信する

システムは通常のVite buildで生成したmanifest、アイコン、Service Workerを、frontendの本番とpreviewの各originから正しいURL、Content-Type、Service Worker scopeで配信しなければならない（MUST）。Service Workerはそのorigin以外のbackendや外部サービスを支配してはならない（MUST NOT）。

#### Scenario: 本番とpreviewの配信を確認する

- **WHEN** 本番またはpreview originの`/`を開く
- **THEN** manifestとアイコンは直接取得でき、対応ブラウザではService Workerがそのfrontend originの`/`をscopeとして登録される
