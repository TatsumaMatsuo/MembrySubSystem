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

## 7. VOICEVOX 音声合成サーバー(常時稼働)

アバターの音声(日本語ニューラルTTS)。**利用者PCでの起動は不要**にするため、社内サーバーで
**常時稼働のサービス**として立てる(プロトタイプのローカル localhost:50021 はあくまで検証用)。
外部送信なし=SEC-01維持。VOICEVOX は**クレジット表記**が利用条件(例: 画面フッターに「VOICEVOX:雨晴はう」)。

### 7-1. Docker で常時起動(推奨)

```bash
# CPU版(GPU不要)。engine は 50021 で HTTP API を公開。
docker run -d --name voicevox --restart always \
  -p 127.0.0.1:50021:50021 \
  voicevox/voicevox_engine:cpu-latest
# GPUがあるなら voicevox/voicevox_engine:nvidia-latest + --gpus all で高速化
```
- `--restart always` で再起動後も自動復帰(=常時ON、誰も起動不要)。
- `127.0.0.1:50021` にバインドし、外部公開は nginx 経由に限定(直接露出させない)。
- モデル更新や話者追加はイメージ更新で対応。

### 7-2. nginx で HTTPS 公開(/api/chat と同じ内部ドメイン配下)

```nginx
# server { listen 443 ssl; server_name ai-chat.内部ドメイン; ... } 内に追記
location /voicevox/ {
    proxy_pass http://127.0.0.1:50021/;   # 末尾スラッシュでプレフィックス除去
    proxy_set_header Host $host;
    proxy_read_timeout 60s;               # 合成の待ち
    client_max_body_size 1m;
}
```
- CORS: VOICEVOX engine 既定 `--cors_policy_mode=localapps` はローカル以外を弾く。ブラウザ直叩きするため
  **`--cors_policy_mode=all` にはせず**、nginx 側で Membry オリジンのみ許可するか、
  engine 起動に `--allow_origin https://main....amplifyapp.com https://feat-sales-analysis....amplifyapp.com` を付ける。
- SG 443 は §4 と同じ社内NW/VPN 限定。`/voicevox/` も同じ制限下に入る。

### 7-3. Membry 側の設定

```bash
# Amplify env(両ブランチ)。ブラウザから直接叩くフルURL。
NEXT_PUBLIC_VOICEVOX_URL=https://ai-chat.内部ドメイン/voicevox
NEXT_PUBLIC_VOICEVOX_SPEAKER=10   # 既定話者(雨晴はう)。UIのドロップダウンで変更可
```
- `app/ai-avatar` は `NEXT_PUBLIC_VOICEVOX_URL` を叩くだけ(未設定/不通ならブラウザ音声へフォールバック)。
- **クレジット表記**を画面に常設すること(利用条件)。

### 7-4. 疎通確認

```bash
curl -s https://ai-chat.内部ドメイン/voicevox/version
curl -s -X POST "https://ai-chat.内部ドメイン/voicevox/audio_query?speaker=10&text=こんにちは" -o /dev/null -w "%{http_code}\n"
```

## チェックリスト

- [ ] `npm run build` → `dist/server.js` 常駐(pm2 or systemd)
- [ ] shainai .env: `WEBCHAT_JWT_SECRET`(=Membry NEXTAUTH_SECRET), `WEBCHAT_ALLOWED_ORIGINS`
- [ ] shainai .env: `WEBCHAT_JWT_SECRET`(=Membry NEXTAUTH_SECRET), `WEBCHAT_ALLOWED_ORIGINS`
- [ ] nginx TLS + `/api/chat` のみ proxy、証明書発行
- [ ] SG 443 を社内NW/VPN CIDR 限定、DNS 内部レコード
- [ ] per-user レート制限/コスト上限を実装
- [ ] curl 疎通 → Membry `NEXT_PUBLIC_SHAINAI_CHAT_URL` 設定(両ブランチ再デプロイ)
- [ ] VOICEVOX を Docker 常時稼働(`--restart always`)+ nginx `/voicevox/` 公開 + CORS許可
- [ ] Membry `NEXT_PUBLIC_VOICEVOX_URL` / `NEXT_PUBLIC_VOICEVOX_SPEAKER` 設定、画面にVOICEVOXクレジット表記
- [ ] Membry: commit 1974042 の `app/chat` + `app/api/chat/token` を復元し、アバター試作(`app/ai-avatar`)と統合
