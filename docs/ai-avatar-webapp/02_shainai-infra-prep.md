# shainai インフラ準備手順(方式A: 内部HTTPS公開)

> 適用先: **shainai-help-bot リポジトリ / EC2**。Membry側ではなく社内AIバックエンド側の作業。
> 前提: セキュリティ判断ブリーフ(`01_security-decision-brief.md`)で方式A承認後に実施。
> 目的: 既存WS常駐に加え、`/api/chat` を **社内NW/VPN限定の HTTPS** で到達可能にする。

## 全体像

```
[利用者ブラウザ(社内NW/VPN)] --https--> [nginx :443 (TLS終端)] --http--> [server.ts :4500 (/api/chat)]
                                                                              |
                                              (既存) lark-ws.ts 常駐 <---WS--- Lark
```
- Membry(Amplify)はUI/認証のみ。回答本体は**VPC内で完結**(SEC-01)。

## 1. HTTPサーバ(server.ts)の常駐化

現状 `pm2 start "npm run dev:ws"` はWSのみ。HTTPサーバ(`server.ts`, `/api` に webChatRouter をマウント, `config.port`=既定4500)も常駐させる。

```bash
# ビルドして dist/server.js を使う(本番はtsxでなくnode)
npm run build

# pm2 で2プロセス常駐(WS + HTTP)
pm2 start dist/server.js --name shainai-http
pm2 start "npm run dev:ws" --name shainai-ws   # 既存
pm2 save
```

systemd を使う場合(例: `/etc/systemd/system/shainai-http.service`):
```ini
[Unit]
Description=shainai HTTP (/api/chat)
After=network.target

[Service]
WorkingDirectory=/home/ubuntu/shainai-help-bot
Environment=NODE_ENV=production
Environment=PORT=4500
ExecStart=/usr/bin/node dist/server.js
Restart=always
User=ubuntu

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now shainai-http
```

## 2. 環境変数(shainai .env)

```bash
WEBCHAT_JWT_SECRET=<Membryの NEXTAUTH_SECRET と同一値>   # HS256共有鍵。fail-closed
WEBCHAT_ALLOWED_ORIGINS=https://main.d4a0s1k3z8dqc.amplifyapp.com,https://feat-sales-analysis.d4a0s1k3z8dqc.amplifyapp.com
# WEBCHAT_USER_CLAIM=sub   # 既定sub。Membryは sub/open_id 両方載せるため通常設定不要
```

## 3. nginx リバースプロキシ + TLS

`/etc/nginx/sites-available/shainai`(内部ドメイン例 `ai-chat.内部ドメイン`):
```nginx
server {
    listen 443 ssl;
    server_name ai-chat.内部ドメイン;

    ssl_certificate     /etc/ssl/certs/ai-chat.crt;   # 社内CA or Let's Encrypt(DNS-01)
    ssl_certificate_key /etc/ssl/private/ai-chat.key;

    # /api/chat のみ公開(他は露出させない)
    location /api/chat {
        proxy_pass http://127.0.0.1:4500;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_read_timeout 120s;    # RAG/LLM生成の待ち
    }
    # /admin, /webhook/lark 等はここで公開しない(SGでも遮断)
}
```
※ 証明書は Membry が https のため**必須**(混在コンテンツ回避)。社内CA発行 or Let's Encrypt(DNS-01チャレンジ)。

## 4. セキュリティグループ / DNS

- SG インバウンド: **443 を社内NW/VPN の CIDR のみ**許可(SSHは従来どおり自社IP)。`/admin`用ポートは開けない。
- DNS: 内部(Route53 Private Hosted Zone 等)で `ai-chat.内部ドメイン` → EC2 プライベートIP。
- 決まる URL = `https://ai-chat.内部ドメイン/api/chat` → Membry `NEXT_PUBLIC_SHAINAI_CHAT_URL` に設定(両ブランチ・再デプロイ)。

## 5. per-user レート制限 / コスト上限(必須の追加実装)

ブラウザ叩けるHTTPを開くと悪用/従量コストの新経路になる。`src/webchat/routes.ts` の `/chat` に、`extractUserId(payload)` 後のガードを追加する想定:

```ts
// 例: メモリ簡易版(単一インスタンス前提。複数台なら Redis 等の共有ストアへ)
const WINDOW_MS = 60_000, MAX_PER_MIN = 10, MAX_PER_DAY = 200;
// userId 単位で分/日のカウントを持ち、超過時 429 を返す。
// 既存の全体キルスイッチ(isEmergencyStopped)・max_tokens上限と併用。
```
- マルチインスタンス運用なら共有ストア(Redis)必須(memory: 現状は状態非共有)。
- 併せて監査ログにweb経路を記録(既存 rag/service のメーターに乗る想定)。

## 6. 疎通確認

```bash
# JWT(HS256, NEXTAUTH_SECRET署名, sub=open_id, exp未来)を用意して:
curl -sS https://ai-chat.内部ドメイン/api/chat \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"text":"有給休暇について"}'
# 期待: {"text":"...","route":"internal|general","citations":[...]}
# 無トークン→401 / 鍵不一致→401 / 未設定→503(fail-closed)
```

## チェックリスト

- [ ] `npm run build` → `dist/server.js` 常駐(pm2 or systemd)
- [ ] shainai .env: `WEBCHAT_JWT_SECRET`(=Membry NEXTAUTH_SECRET), `WEBCHAT_ALLOWED_ORIGINS`
- [ ] nginx TLS + `/api/chat` のみ proxy、証明書発行
- [ ] SG 443 を社内NW/VPN CIDR 限定、DNS 内部レコード
- [ ] per-user レート制限/コスト上限を実装
- [ ] curl 疎通 → Membry `NEXT_PUBLIC_SHAINAI_CHAT_URL` 設定(両ブランチ再デプロイ)
- [ ] Membry: commit 1974042 の `app/chat` + `app/api/chat/token` を復元し、アバター試作(`app/ai-avatar`)と統合
