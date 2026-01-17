# コーディング規約

MembrySubSystem プロジェクトのコーディング規約です。

## 目次

1. [TypeScript規約](#typescript規約)
2. [React/Next.js規約](#reactnextjs規約)
3. [ファイル・ディレクトリ構成](#ファイルディレクトリ構成)
4. [命名規則](#命名規則)
5. [スタイリング規約](#スタイリング規約)
6. [API設計規約](#api設計規約)
7. [コメント・ドキュメント](#コメントドキュメント)

---

## TypeScript規約

### 基本設定

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2017",
    "module": "esnext"
  }
}
```

### 型定義

```typescript
// ✅ Good: 明示的な型定義
interface User {
  id: string;
  name: string;
  email: string;
}

// ❌ Bad: any型の使用
const user: any = { id: "1" };

// ✅ Good: 型推論が明確な場合は省略可
const count = 0;  // number と推論される
const items = []; // 空配列は型指定が必要
const items: string[] = [];
```

### 型定義の配置

- 共通の型は `types/index.ts` に集約
- コンポーネント固有の型はコンポーネントファイル内に定義
- API レスポンス型は `types/` に定義

```typescript
// types/index.ts
export interface MenuDisplayMaster {
  record_id: string;
  menu_id: string;
  menu_name: string;
  level: number;
  // ...
}
```

### null/undefined の扱い

```typescript
// ✅ Good: オプショナルチェーン
const name = user?.profile?.name;

// ✅ Good: Nullish coalescing
const value = data ?? "default";

// ❌ Bad: 非null アサーション（理由なく使わない）
const name = user!.name;
```

---

## React/Next.js規約

### コンポーネント定義

```typescript
// ✅ Good: 関数コンポーネント + 型定義
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

// ❌ Bad: React.FC の使用（非推奨）
const Button: React.FC<ButtonProps> = ({ label }) => { ... };
```

### Client/Server コンポーネント

```typescript
// クライアントコンポーネントは明示的に宣言
"use client";

import { useState } from "react";

export function InteractiveComponent() {
  const [state, setState] = useState(false);
  // ...
}

// サーバーコンポーネントは宣言不要（デフォルト）
export async function ServerComponent() {
  const data = await fetchData();
  // ...
}
```

### Hooks のルール

```typescript
// ✅ Good: カスタムフックは use プレフィックス
function useUserData(userId: string) {
  const [user, setUser] = useState<User | null>(null);
  // ...
  return { user, loading, error };
}

// ✅ Good: 依存配列は正確に
useEffect(() => {
  fetchData(id);
}, [id]);

// ❌ Bad: 依存配列の省略
useEffect(() => {
  fetchData(id);
}, []); // id が変わっても再実行されない
```

---

## ファイル・ディレクトリ構成

```
MembrySubSystem/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   └── [feature]/     # 機能別API
│   │       └── route.ts
│   ├── [feature]/         # ページ（機能別）
│   │   └── page.tsx
│   ├── layout.tsx         # ルートレイアウト
│   └── globals.css        # グローバルスタイル
│
├── components/            # 共通コンポーネント
│   ├── layout/           # レイアウト系
│   ├── ui/               # UIパーツ
│   └── [feature]/        # 機能別コンポーネント
│
├── lib/                   # ユーティリティ・ライブラリ
│   ├── lark-client.ts    # 外部API クライアント
│   └── utils.ts          # 汎用ユーティリティ
│
├── types/                 # 型定義
│   └── index.ts
│
└── docs/                  # ドキュメント
```

### ファイル命名規則

| 種類 | 規則 | 例 |
|------|------|-----|
| コンポーネント | PascalCase | `Sidebar.tsx`, `UserCard.tsx` |
| ページ | kebab-case ディレクトリ | `app/user-settings/page.tsx` |
| API Routes | kebab-case ディレクトリ | `app/api/menu-permission/route.ts` |
| ユーティリティ | kebab-case | `lark-client.ts`, `auth-options.ts` |
| 型定義 | PascalCase (型名) | `UserMenuPermissions`, `MenuDisplayMaster` |

---

## 命名規則

### 変数・関数

```typescript
// ✅ Good: camelCase
const userName = "taro";
function fetchUserData() { }

// ✅ Good: 定数は UPPER_SNAKE_CASE
const API_BASE_URL = "https://api.example.com";
const MAX_RETRY_COUNT = 3;

// ✅ Good: Boolean は is/has/can プレフィックス
const isLoading = true;
const hasPermission = false;
const canEdit = true;
```

### コンポーネント

```typescript
// ✅ Good: PascalCase
export function UserProfile() { }
export function MenuItemList() { }

// ✅ Good: Props は [Component]Props
interface UserProfileProps { }
interface MenuItemListProps { }
```

### イベントハンドラ

```typescript
// ✅ Good: handle + 動詞 + 対象
const handleClickSubmit = () => { };
const handleChangeInput = (e) => { };

// ✅ Good: Props は on + 動詞 + 対象
interface ButtonProps {
  onClick: () => void;
  onSubmit: (data: FormData) => void;
}
```

---

## スタイリング規約

### Tailwind CSS

```tsx
// ✅ Good: 論理的なグループ化
<div className="
  flex items-center gap-4      {/* レイアウト */}
  px-4 py-2                    {/* スペーシング */}
  bg-white rounded-lg shadow   {/* 外観 */}
  hover:bg-gray-50             {/* インタラクション */}
">

// ✅ Good: clsx/tailwind-merge で条件付きクラス
import { cn } from "@/lib/utils";

<button className={cn(
  "px-4 py-2 rounded",
  isActive && "bg-blue-500 text-white",
  disabled && "opacity-50 cursor-not-allowed"
)}>
```

### カラーパレット

```typescript
// プロジェクト標準カラー
const colors = {
  primary: "indigo-500",
  secondary: "emerald-500",
  danger: "red-500",
  warning: "amber-500",
  success: "green-500",
};
```

---

## API設計規約

### エンドポイント命名

```
GET    /api/menu-permission      # 一覧取得
GET    /api/menu-permission?mode=all  # パラメータ付き
POST   /api/master/menu-permissions   # 作成
PUT    /api/master/menu-permissions   # 更新
DELETE /api/master/menu-permissions   # 削除
```

### レスポンス形式

```typescript
// 成功時
{
  success: true,
  data: { ... }
}

// エラー時
{
  success: false,
  error: "エラーメッセージ"
}
```

### API Route 実装

```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const data = await fetchData();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[api/example] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
```

---

## コメント・ドキュメント

### JSDoc

```typescript
/**
 * ユーザーの権限情報を構築
 * @param employeeId - 社員ID
 * @param employeeName - 社員名
 * @param groupIds - 所属グループID配列
 * @returns ユーザーのメニュー権限情報
 */
export async function buildUserPermissions(
  employeeId: string,
  employeeName: string,
  groupIds: string[]
): Promise<UserMenuPermissions> {
  // ...
}
```

### コメント指針

```typescript
// ✅ Good: WHY を説明
// 個別権限を優先チェック（グループ権限より優先度が高いため）
const userPerms = await getUserPermissions(employeeId);

// ❌ Bad: WHAT を説明（コードを読めばわかる）
// ユーザー権限を取得する
const userPerms = await getUserPermissions(employeeId);

// ✅ Good: 複雑なロジックの説明
// 開発環境で権限が空の場合は全メニュー表示（デバッグ用）
const showAll = isDev && hasNoPermissions;
```

---

## Git コミット規約

### Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

| Type | 説明 |
|------|------|
| feat | 新機能 |
| fix | バグ修正 |
| docs | ドキュメント |
| style | フォーマット（コード動作に影響なし） |
| refactor | リファクタリング |
| test | テスト |
| chore | ビルド・補助ツール |

### 例

```
feat(menu): メニュー権限システムを追加

- メニュー表示マスタからの読み込み機能
- グループ/個別権限によるフィルタリング
- Sidebarコンポーネントへの統合

Closes #18
```

---

## チェックリスト

### コードレビュー時の確認項目

- [ ] TypeScript strict mode でエラーがないか
- [ ] any 型を使用していないか
- [ ] 適切な型定義があるか
- [ ] コンポーネントは適切に分割されているか
- [ ] 命名規則に従っているか
- [ ] 不要なコメントがないか
- [ ] エラーハンドリングが適切か
- [ ] セキュリティ上の問題がないか（XSS, インジェクション等）

---

*最終更新: 2026-01-17*
