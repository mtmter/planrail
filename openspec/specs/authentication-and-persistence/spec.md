# Authentication and Persistence Specification

## Purpose

PlanRailの利用者認証、ユーザー別データ保存、およびFirestoreへのアクセス境界を定義する。

## Requirements

### Requirement: Googleアカウントで認証する

システムはFirebase AuthenticationのGoogleポップアップ認証を提供し、認証済みユーザーだけにスケジュール画面を表示しなければならない（MUST）。

#### Scenario: 未認証でアプリを開く

- **WHEN** Firebaseの認証状態にユーザーが存在しない
- **THEN** システムはGoogleログインボタンを含むログイン画面を表示する

#### Scenario: 認証済みでアプリを開く

- **WHEN** Firebaseの認証状態にユーザーが存在する
- **THEN** システムはそのユーザーのスケジュール画面を表示する

#### Scenario: ログアウトする

- **WHEN** ユーザーがアカウントメニューからログアウトする
- **THEN** システムはFirebaseからログアウトし、ログイン画面へ戻る

### Requirement: データをユーザーごとに分離する

システムは認証中ユーザーのuidを使い、次のFirestoreパスでデータを読み書きしなければならない（MUST）。

```text
users/{uid}/events/{eventId}
users/{uid}/tasks/{taskId}
users/{uid}/preparations/{preparationId}
users/{uid}/travelPlans/{eventId}
```

#### Scenario: スケジュールを読み込む

- **WHEN** 認証済みユーザーのスケジュール画面を開始する
- **THEN** システムはそのuid配下の予定、タスク、準備項目をFirestoreから読み込む

#### Scenario: 別ユーザーのパスへアクセスする

- **WHEN** 認証中のuidと異なる `users/{uid}` 配下を読み書きしようとする
- **THEN** Firestore Security Rulesはアクセスを許可しない

### Requirement: スケジュールデータはFirestoreへ直接保存する

フロントエンドは予定、タスク、準備項目、移動予定のCRUDをCloud Firestoreへ直接行わなければならない（MUST）。FastAPIをこれらのCRUDの中継に使用してはならない。

#### Scenario: 予定を作成する

- **WHEN** 認証済みユーザーが予定追加フォームを送信する
- **THEN** フロントエンドはそのユーザーの `events` サブコレクションへ予定を追加する

#### Scenario: 経路検索を実行する

- **WHEN** 認証済みユーザーが予定の経路を検索する
- **THEN** フロントエンドはFastAPIの経路検索APIを呼び出す

### Requirement: FastAPIの公開範囲を限定する

FastAPIはアプリ用APIとしてヘルスチェックと経路検索だけを公開しなければならない（MUST）。

#### Scenario: API一覧を確認する

- **WHEN** `/api/` 以下のルートを列挙する
- **THEN** `GET /api/health` と `POST /api/route-search` だけが存在する
