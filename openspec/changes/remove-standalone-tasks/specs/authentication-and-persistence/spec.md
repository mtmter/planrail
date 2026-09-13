## MODIFIED Requirements

### Requirement: データをユーザーごとに分離する

システムは認証中ユーザーのuidを使い、次のFirestoreパスでデータを読み書きしなければならない（MUST）。

```text
users/{uid}/events/{eventId}
users/{uid}/preparations/{preparationId}
users/{uid}/travelPlans/{eventId}
```

#### Scenario: スケジュールを読み込む

- **WHEN** 認証済みユーザーのスケジュール画面を開始する
- **THEN** システムはそのuid配下の予定と準備項目を読み込み、tasksコレクションへアクセスしない

#### Scenario: 既存のtask documentがある

- **WHEN** ユーザーの `users/{uid}/tasks/{taskId}` に既存documentがある状態でスケジュール画面を開始する
- **THEN** システムはそのdocumentを読み書きまたは削除せず、データをそのまま残す

#### Scenario: 別ユーザーのパスへアクセスする

- **WHEN** 認証中のuidと異なる `users/{uid}` 配下を読み書きしようとする
- **THEN** Firestore Security Rulesはアクセスを許可しない

### Requirement: スケジュールデータはFirestoreへ直接保存する

フロントエンドは予定、準備項目、移動予定のCRUDをCloud Firestoreへ直接行わなければならない（MUST）。独立タスクのCRUDを行ってはならず、FastAPIをこれらのCRUDの中継に使用してはならない（MUST NOT）。

#### Scenario: 予定を作成する

- **WHEN** 認証済みユーザーが予定追加フォームを送信する
- **THEN** フロントエンドはそのユーザーの `events` サブコレクションへ予定を追加する

#### Scenario: 準備項目を保存する

- **WHEN** 認証済みユーザーが予定の準備項目を追加、編集、削除、または完了状態を変更する
- **THEN** フロントエンドはそのユーザーの `preparations` サブコレクションへ直接変更を保存する

#### Scenario: 経路検索を実行する

- **WHEN** 認証済みユーザーが予定の経路を検索する
- **THEN** フロントエンドはFastAPIの経路検索APIを呼び出す

#### Scenario: 移動予定を保存する

- **WHEN** 認証済みユーザーが検索結果を予定の移動予定として登録する
- **THEN** フロントエンドはそのユーザーの `travelPlans` サブコレクションへ直接保存する
