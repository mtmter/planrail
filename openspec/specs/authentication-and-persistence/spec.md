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

システムは認証中ユーザーのuidを使い、`users/{uid}/events/{eventId}`、`users/{uid}/preparations/{preparationId}`、および `users/{uid}/journeys/{journeyId}` を読み書きしなければならない（MUST）。旧 `travelPlans` はアプリから読み書きしてはならない（MUST NOT）。Firestore Security Rulesは認証uidとパスのuidが一致する場合に限りアクセスを許可する。

#### Scenario: スケジュールを読み込む

- **WHEN** 認証済みユーザーのスケジュール画面を開始する
- **THEN** システムはそのuid配下のEvent、Preparation、Journeyを読み込み、旧travelPlanを読み込まない

#### Scenario: 別ユーザーのJourneyを読む

- **WHEN** 認証uidと異なる `users/{uid}/journeys/{journeyId}` にアクセスする
- **THEN** Firestore Security Rulesは読み書きを許可しない

#### Scenario: 別ユーザーのパスへアクセスする

- **WHEN** 認証uidと異なる `users/{uid}` 配下へアクセスする
- **THEN** Firestore Security Rulesは読み書きを許可しない

#### Scenario: 既存のtask documentがある

- **WHEN** `users/{uid}/tasks/{taskId}` に既存文書がある
- **THEN** システムはそれを読み書きまたは削除せず残す

### Requirement: スケジュールデータはFirestoreへ直接保存する

フロントエンドはEvent、Preparation、JourneyのCRUDをCloud Firestoreへ直接行わなければならない（MUST）。旧travelPlanのCRUDと独立taskのCRUDを行わず、FastAPIをこれらのCRUDの中継に使用してはならない（MUST NOT）。

#### Scenario: Journeyを保存する

- **WHEN** 認証済みユーザーが完成したJourneyの保存を確定する
- **THEN** フロントエンドはそのuid配下の `journeys` に直接保存する

#### Scenario: Journey Builderのdraftを編集する

- **WHEN** ユーザーが保存前に地点、FIXED、候補選択を編集する
- **THEN** フロントエンドはFirestoreへ作業中のJourneyを書き込まない

#### Scenario: EventとPreparationを保存する

- **WHEN** 認証済みユーザーがEventまたはPreparationを保存する
- **THEN** フロントエンドは従来どおり対応するuid配下のcollectionへ直接保存する

#### Scenario: 予定を作成する

- **WHEN** 認証済みユーザーがEventを作成する
- **THEN** フロントエンドはそのuid配下の `events` へ直接保存する

#### Scenario: 準備項目を保存する

- **WHEN** 認証済みユーザーがPreparationを保存する
- **THEN** フロントエンドはそのuid配下の `preparations` へ直接保存する

#### Scenario: 経路検索を実行する

- **WHEN** ユーザーが経路検索を実行する
- **THEN** フロントエンドはFastAPIの経路検索APIを呼び出し、Firestoreへ検索結果を直接保存しない

#### Scenario: 移動予定を保存する

- **WHEN** ユーザーが確定した移動予定を保存する
- **THEN** フロントエンドはそのuid配下の `journeys` へ直接保存する

### Requirement: FastAPIの公開範囲を限定する

FastAPIはアプリ用APIとしてヘルスチェックと経路検索だけを公開しなければならない（MUST）。

#### Scenario: API一覧を確認する

- **WHEN** `/api/` 以下のルートを列挙する
- **THEN** `GET /api/health` と `POST /api/route-search` だけが存在する
