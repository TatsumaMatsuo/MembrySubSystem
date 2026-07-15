# セキュリティ判断ブリーフ — 社内AI 音声アバターWebアプリ(Epic #30)

> 目的: 「音声アバターWebアプリ」を実現するために必要な **shainai(社内AIバックエンド)の到達経路** をどう用意するか、情シス判断を仰ぐための1枚。
> 判断が必要な理由: アバターは自前Web UI が必須で、ブラウザから社内RAG(shainai)へ届く経路が要る。現状 shainai は**インバウンド無し**設計のため、経路新設の可否がボトルネック。

## 前提(現状)

- **Membry**: AWS Amplify(公開クラウド)で https 配信。認証は Lark OAuth + next-auth。
- **shainai**: VPC内EC2。本番は **Lark長連接WS常駐のみ**で、**HTTPサーバ(`/api/chat`)は未起動**、SGインバウンドは **SSHのみ**(攻撃面最小の設計)。
- 既に用意済み(方式A復活時に流用): 埋め込みチャットUI + 短命JWT発行API(commit `1974042`)、shainai側 `/api/chat`(#31, JWT検証・CORS・緊急停止対応)。
- 既知の制約: shainai は **per-userレート制限/コスト上限が未実装**([[shainai-help-bot]])。

## すでに提供済みの代替(方式C, 実装・検証済)

Membryメニュー → **既存Lark Botへディープリンク**(applink)。新規公開口ゼロで最も安全。ただし**テキストのみ・アバター不可**。アバターが要らない用途はこれで足りる。

## 判断が必要な選択肢(アバターをやる場合)

| | A. 内部HTTPS公開 | A'. アウトバウンドトンネル |
|---|---|---|
| 概要 | nginx+TLSで`/api/chat`を社内公開、SGで443を社内NW/VPN限定 | Cloudflare Tunnel等でEC2から外向き接続しHTTPS URL取得 |
| 新規インバウンド | **有**(443/社内限定) | 無(現行の"インバウンド無し"維持) |
| 社内RAG回答の経路 | **自社VPC内で完結** | **第三者エッジを経由**(TLSだが外部SaaSがデータ経路に入る) |
| SEC-01(社内情報を外に出さない) | 適合 | **懸念**(方式bを却下したのと同種の論点) |
| 運用 | nginx/証明書/SG管理 | トンネルagent管理・ID制御(Access)可 |
| 推奨 | **セキュリティ上こちらを推奨** | 導入は楽だがSEC-01と衝突しやすい |

## 必須のハードニング(A採用時)

1. **per-userレート制限 / コスト上限**(shainai側): ブラウザ叩けるHTTPを新設=悪用/従量コストの新経路。要追加。
2. SGは社内NW/VPNのCIDR限定 + 既存のJWT(HS256共有鍵) + CORS allowlist + 短命トークン(いずれも実装済/設計済)。
3. nginxのTLS/パッチ運用、`server.ts`の常駐化(pm2/systemd)。
4. アクセスは社内NW/VPN前提(社外利用は対象外 or 別途VPN必須)。

## TTS(音声合成)のデータ経路 — 併せて判断

| 方式 | 外部送信 | 音質 | 備考 |
|---|---|---|---|
| ブラウザ内蔵 Web Speech API | **無し** | 標準 | プロトタイプ既定。SEC-01維持で最も安全 |
| 外部TTS(ElevenLabs/Azure等) | **有(回答テキスト)** | 高 | SEC-01再検討必須 |
| 社内TTS(EC2上OSS) | 無し | 中〜高 | 構築/負荷コスト |

## 決定してほしいこと(チェックリスト)

- [ ] アバター(音声Web体験)を正式にやるか / 当面は方式C(テキスト)で足りるか
- [ ] やる場合の到達経路: **A(内部HTTPS, 推奨)** / A'(トンネル)
- [ ] 443を社内NW/VPNのどのCIDRに開けるか(SG設計)
- [ ] TTS方式: Web Speech(既定) / 外部TTS(SEC-01再検討) / 社内TTS
- [ ] shainai per-userレート制限/コスト上限の実装担当・期限

## 参考

- 実装の土台: commit `1974042`(埋め込みUI + トークンAPI)、shainai `src/webchat/routes.ts`。
- Membryオリジン(shainai CORS 用): `https://main.d4a0s1k3z8dqc.amplifyapp.com`, `https://feat-sales-analysis.d4a0s1k3z8dqc.amplifyapp.com`。
- 設計全体: `docs/ai-avatar-webapp/00_design-draft.md` / インフラ手順: `02_shainai-infra-prep.md`。
