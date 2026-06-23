# Lark Contact → Bitable 社員マスタ 自前同期

定期ジョブで Lark 組織のユーザー（＋部署・カスタム項目）を取得し、Base の**社員マスタ**へ
upsert する仕組み。既存レコードをキー（`open_id`）で突合し、新規・変更・退職分だけ batch で
反映する。

- 起動: GitHub Actions cron → `POST /api/batch/sync-lark-contacts`（`Bearer BATCH_SECRET`）
- ローカル/手動: `npx tsx scripts/sync-lark-contacts/sync.ts`（既定 dry-run、`--execute` で反映）
- コア実装: `lib/lark-contact-sync.ts`

---

## 同期先テーブル

**社員マスタ** `tblXpm1d05ovRf1y` @ master base（`LARK_BASE_TOKEN_MASTER = J09zbrPDxa5QR8sEgU9jqLlxpxg`）

> ⚠️ master base は **本番main・全featブランチで共有**。書き込むと全環境に即反映される。

### フィールド構成（プローブ実測 2026-06-23）

| フィールド名 | type | 書込 | 用途 |
|---|---|---|---|
| `社員コード` | 1 text | ✅ | 社員番号（employee_no）。名前検索・安定キー |
| `社員名` | 1 text | ✅ | 氏名（name）。名前検索が読む列 |
| `退職者フラグ` | 7 checkbox | ✅ | 在職状態（status.is_resigned）/ ディレクトリ非在籍 |
| `社員名 (メンバー )` | 11 people | ✅ | `[{ id: open_id }]` をセット。**突合キーの本体** |
| `membership_type` | 3 select | ✅ | internal/external/contractor（Contact非提供・現状は触らない） |
| `社員名 (メンバー ).部署` | 4 lookup | ❌ | People から自動解決 |
| `社員名 (メンバー ).社員番号` | 1 lookup | ❌ | People から自動解決 |
| `社員名 (メンバー ).職位` | 3 lookup | ❌ | People から自動解決 |
| `社員名 (メンバー ).直属上司` | 11 lookup | ❌ | People から自動解決 |
| `社員名 (メンバー ).仕事用メールアドレス` | 1 lookup | ❌ | People から自動解決 |

**ポイント**: People フィールド（`社員名 (メンバー )`）に `open_id` をセットすれば、部署・社員番号・
職位・上司・メールは Lark 側のルックアップで自動補完される（アプリのContactスコープに依存しない）。
独立列として持つのは `社員コード`/`社員名`/`退職者フラグ` のみ。

### 追加が必要な列（スコープ付与後に確定）

- `携帯番号`（mobile）… 標準項目として持つ場合
- カスタム項目（custom_attrs）… 実データを見て、必要な属性ごとに text/select 列を新設

---

## 🔑 必須: Lark Contact スコープ追加（管理者作業）

**現状アプリに付与されているのはディレクトリ読取相当のみ**。`contact.user.get` を叩いても
`email / open_id / union_id / user_id / mobile_visible` しか返らず、**氏名・社員番号・携帯・役職・
在職状態・custom_attrs は取得できない**（実測で確認済み）。「標準＋カスタム項目の同期」には
以下スコープの追加と管理者承認が必須。

### 追加するスコープ

| スコープ | 取得できる項目 |
|---|---|
| `contact:user.base:readonly` | 氏名（name / en_name）、avatar |
| `contact:user.employee_id:readonly` | 社員番号（employee_no） |
| `contact:user.phone:readonly` | 携帯番号（mobile） |
| `contact:user.employee:readonly` | 在職状態（status.is_resigned 等）、役職、所属詳細 |
| `contact:user.custom_attr:readonly` | カスタム項目（custom_attrs） |
| `contact:department.base:readonly` | 部署列挙（既に付与済みのはず） |

> スコープ名は Lark Developer Console の表記に合わせて選択。テナント/国際版で細分名が異なる
> 場合があるため、「ユーザーの氏名」「ユーザーの社員番号」「ユーザーの電話番号」「ユーザーの
> 在職状態」「ユーザーのカスタムフィールド」に相当する**読み取り専用**権限を全て追加する。

### 手順

1. **Lark Developer Console**（https://open.larksuite.com/app）で対象アプリ
   （`cli_a9d79d0bbf389e1c`）を開く。
2. 「権限管理」→ 上記スコープを検索して追加。
3. **バージョンを作成して公開申請** → テナント管理者が承認（自社アプリでも再承認が必要）。
4. 承認後、`scripts/sync-lark-contacts/probe.ts` を再実行し、`user.get` の戻りに
   `name / employee_no / mobile / status / custom_attrs` が現れることを確認。
5. custom_attrs の中身（属性キー・名称）を見て、社員マスタへ追加する列を確定 → 列追加 →
   `lib/lark-contact-sync.ts` の `FIELD_MAP` を更新。

---

## 同期アルゴリズム

```
1. Contact 列挙
   - contact.department.list(parent="0", fetch_child=true) で全部署 open_department_id 取得
   - 各部署で contact.user.list（ページング）→ open_id を集約（重複排除）
   - contact.user.batch（最大50件/回）で氏名・社員番号・携帯・在職状態・custom_attrs を解決
   → Map<open_id, ContactUser>（在籍ディレクトリの全ユーザー）

2. 社員マスタ 読込
   - getBaseRecords(EMP_TABLE, baseToken=master) を全ページ
   - People フィールドから open_id を抽出 → Map<open_id, {recordId, currentFields}>

3. 突合（キー= open_id）
   - Contactにあり マスタに無い        → CREATE（People=[{id}], 社員コード, 社員名, 退職=false, …）
   - 両方にあり 値が差分              → UPDATE（変わった列のみ）
   - マスタにあり Contactディレクトリに無い → RETIRE（退職者フラグ=true）※行は残す
   - open_id 未抽出の手動行            → スキップ（ログに記録）

4. 反映
   - batchCreateBaseRecords / batchUpdateBaseRecords（500件分割・既存ヘルパー流用）
   - dry-run 時は差分サマリのみ出力し書き込まない
```

### 突合キーの理由

`open_id` はLark内で不変。`email` は変更され得るため副キー（open_id が People から取れない
古い手動行の救済にのみ使用）。

### 冪等性

- 既存値と新値を比較し、**差分のある列だけ** UPDATE する（無差分はスキップ）。
- 何度実行しても同じ状態に収束する。dry-run で差分0になれば同期済み。

### プリフライト（安全装置）

`--execute` 実行前に `checkContactScopes()` を呼び、`user.get` の戻りに氏名等が含まれるか検証。
**スコープ未付与なら書き込みを中止**して不足スコープを表示する（空の氏名でマスタを壊さない）。

### RETIRE 安全弁（誤一括退職の防止）

退職判定は「Contact ディレクトリ列挙に居ない」で行うため、**列挙が不完全だと在籍者を誤って
退職扱いにする**リスクがある（部署単位の `user.list` が権限等で失敗→silent skip するケース）。
対策として、RETIRE 件数がマスタ行数の **20%（既定）を超えたら退職フラグ更新を抑止**し
`retireSuppressed=true` を返す。閾値は `syncLarkContacts({ retireThresholdRatio })` で調整可能。

> 2026-06-23 dry-run 実測（スコープ未付与状態）: Contact列挙=129 / マスタ=298（open_id有=171・
> 無=127）/ RETIRE候補=46（27%）。スコープ付与後に列挙が増えれば RETIRE は減るはず。
> 付与後の dry-run で RETIRE 内訳（誰が退職判定か）を必ず目視し、閾値を最終調整すること。

---

## 運用

| 項目 | 値 |
|---|---|
| cron | 毎日 02:00 JST（`0 17 * * *` UTC）想定 |
| 手動実行 | GitHub Actions `workflow_dispatch`（`dry_run` 入力あり） |
| 認証 | `Authorization: Bearer ${BATCH_SECRET}`（route 側で検証） |
| タイムアウト | Amplify SSR 上限に注意。298名規模なので batch 集約で十分収まる |

### secrets / env

- `BATCH_SECRET` … GitHub Actions secret ＆ Amplify 環境変数（一致させる）
- `LARK_APP_ID` / `LARK_APP_SECRET` / `LARK_BASE_TOKEN_MASTER` … 既存

---

## スコープ付与後のチェックリスト

- [ ] `probe.ts` 再実行で氏名/社員番号/携帯/status/custom_attrs が返ることを確認
- [ ] custom_attrs を見て社員マスタへ追加列を作成、`FIELD_MAP` 更新
- [ ] `sync.ts`（dry-run）で CREATE/UPDATE/RETIRE 件数と内訳を確認
- [ ] 少数で `--execute` 試行 → マスタのルックアップ自動補完を目視確認
- [ ] GitHub Actions `workflow_dispatch`（dry_run=true）でAPI経路を確認
- [ ] cron 有効化
