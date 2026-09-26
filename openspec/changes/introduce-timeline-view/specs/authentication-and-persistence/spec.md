## ADDED Requirements

### Requirement: Event更新と関連Journeyの削除を原子的に保存する

フロントエンドは認証済みユーザーのEventを更新するとき、Journey targetの目的地・到着期限が変わるか、検索可能だった目的地の有効座標を失う場合の `users/{uid}/journeys/event-{eventId}` 削除とEvent文書の更新をFirestoreの同じ原子的な書き込みで確定しなければならない（MUST）。片方だけを成功させてはならず（MUST NOT）、別ユーザーの文書やStandalone Journeyを変更してはならない（MUST NOT）。

#### Scenario: targetが変わるEventを更新する

- **WHEN** Event更新前後でJourney targetの目的地・到着期限が変わるか、目的地の検索可能な座標を失う
- **THEN** システムは同じ認証uid配下のEvent更新と `journeys/event-{eventId}` 削除を同時に確定する

#### Scenario: 原子的な更新が失敗する

- **WHEN** Event更新または必要なJourney削除を含む書き込みが失敗する
- **THEN** システムはどちらの変更も確定せず、画面に失敗を伝える

#### Scenario: targetが変わらないEventを更新する

- **WHEN** Event更新後もJourney targetの目的地と到着期限が同じで、検索可能な地点情報も失われない
- **THEN** システムはEventだけを更新し、既存Journey文書を維持する
