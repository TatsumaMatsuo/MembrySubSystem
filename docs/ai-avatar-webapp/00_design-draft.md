# 社内AIチャット 音声アバターWebアプリ 設計ドラフト(Epic #30 / トラック2)

> ステータス: **設計中(実装は保留)**。トラック1(方式C=Lark Botディープリンク・テキスト)を先行提供済み。
> 本アプリの着手条件は「shainai への到達経路(内部HTTPS公開)」のセキュリティ承認。

## 背景・位置づけ

- Epic #30 の核は「音声アバターWebアプリ」= 回答を**アバターが音声で話す**リッチなWeb体験。
- 方式C(既存 Lark Bot のチャット画面へ誘導)は**テキストのみ**でアバター描画ができないため、アバターは自前Web UI(方式A系)が必須。
- ハイブリッド方針: **C を即時提供(テキスト)** しつつ、本アプリ(A)を並行準備する。

## アーキテクチャ(確定事項)

- 認証: MembrySubSystem の next-auth セッション相乗り(middleware保護)。`user.id` = Lark open_id。
- バックエンド: VPC内 shainai `/api/chat`(既存, `src/webchat/routes.ts`)。POST `{text}` + `Authorization: Bearer <JWT>`、応答 `{text, route, citations}`。
- 認可トークン: セッション open_id を載せた短命 HS256 JWT(鍵=`NEXTAUTH_SECRET` を shainai `WEBCHAT_JWT_SECRET` と共有)。
- **先行実装済みコードが土台**: 埋め込みチャットUI(`app/chat/page.tsx`)とトークン発行API(`app/api/chat/token/route.ts`)は commit `1974042` に存在。トラック1で production から一旦削除したが、**本アプリ着手時に同コミットから復元して拡張**する。

## 未確定・要決定(着手前提)

1. **shainai への到達経路(最重要・セキュリティ判断)**
   - 方式A: 内部HTTPS公開(nginx+SG443を社内NW/VPN限定)+ `server.ts` 常駐化。回答は自社VPC内で完結。
   - 方式A': アウトバウンドトンネル(no-inbound維持)だが第三者エッジがデータ経路に入る=SEC-01懸念。
   - → 現行の「インバウンド無し=攻撃面最小」設計を崩す判断。情シス承認が前提。
2. **TTS(音声合成)の実行場所とデータ経路**
   - ブラウザ内蔵 Web Speech API: 外部送信ゼロ(SEC-01維持)だが声質限定。
   - 外部TTS(ElevenLabs/Azure等): 高品質だが**社内回答テキストを外部へ送る**=SEC-01再検討必須。
   - 社内TTS(EC2上でOSSモデル): 外部送信なしだが構築/負荷コスト。
3. **アバター描画**: ブラウザ側JSライブラリ(2D/3D + リップシンク)。回答テキスト/音声をブラウザに持つ前提。
4. shainai 側の従量/レート制御が未実装(memory)。ブラウザ叩けるHTTP新設に伴い、per-userレート制限/コスト上限の追加が必要。

## 実装タスク(着手時)

- [ ] 到達経路(A/A')確定・shainai 側 `server.ts` 常駐化 + リバプロ/TLS + SG
- [ ] shainai `WEBCHAT_JWT_SECRET`=Membry `NEXTAUTH_SECRET`, `WEBCHAT_ALLOWED_ORIGINS`(本番/検証origin)設定
- [ ] Membry `NEXT_PUBLIC_SHAINAI_CHAT_URL`(両ブランチ)設定
- [ ] `app/chat` + `app/api/chat/token` を commit 1974042 から復元
- [ ] TTS 方式決定 → 音声再生実装
- [ ] アバター描画 + リップシンク実装
- [ ] レート制限/コスト上限(shainai側)
- [ ] メニュー: 方式Cのapplink項目を本Webアプリ(内部ルート)へ差し替え or 併存

## 関連

- トラック1(方式C): メニュー `共通 › AIアシスタント › 社内AIチャット`(PGM051)= Lark Bot applink(`cli_aac2ce0c2778de18`)。
- shainai 側実装: `src/webchat/routes.ts`(#31)、契約整合済み。
