/** スコープ付与後の実データ点検（読み取り専用）: custom_attrs/mobile の実在状況と退職判定者の実名 */
import * as dotenv from "dotenv";
import { enumerateContactUsers, F, EMP_TABLE_ID } from "../../lib/lark-contact-sync";
import { getBaseRecords, getLarkBaseTokenForMaster } from "../../lib/lark-client";

dotenv.config();

function textOf(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.text ?? x?.name ?? "")).join("");
  return v?.text ?? v?.name ?? String(v);
}
function openIdOf(v: any): string {
  const a = Array.isArray(v) ? v : v ? [v] : [];
  return a.find((p: any) => typeof p?.id === "string")?.id || "";
}

(async () => {
  const contacts = await enumerateContactUsers();
  console.log(`Contact列挙: ${contacts.size}名`);

  let withMobile = 0, withCustom = 0, resigned = 0;
  const customKeys = new Set<string>();
  for (const u of contacts.values()) {
    if (u.mobile) withMobile++;
    if (Object.keys(u.customAttrs).length) { withCustom++; Object.keys(u.customAttrs).forEach((k) => customKeys.add(k)); }
    if (u.isResigned) resigned++;
  }
  console.log(`  mobile保有: ${withMobile} / custom_attrs保有: ${withCustom} / is_resigned=true: ${resigned}`);
  console.log(`  出現したcustom_attrsキー: ${customKeys.size ? [...customKeys].join(", ") : "(なし=テナントにカスタム項目未設定)"}`);

  // 退職判定者（マスタにopen_id有・Contact列挙に無い）の実名一覧
  const baseToken = getLarkBaseTokenForMaster();
  const rows: any[] = [];
  let pt: string | undefined;
  do {
    const r: any = await getBaseRecords(EMP_TABLE_ID, { baseToken, pageSize: 500, pageToken: pt });
    rows.push(...(r.data?.items || []));
    pt = r.data?.has_more ? r.data?.page_token : undefined;
  } while (pt);

  const retireCandidates = rows
    .map((it) => ({ openId: openIdOf(it.fields?.[F.member]), name: textOf(it.fields?.[F.name]), code: textOf(it.fields?.[F.code]), retired: it.fields?.[F.retired] === true }))
    .filter((r) => r.openId && !contacts.has(r.openId) && !r.retired);

  console.log(`\n退職判定候補(open_id有・Contact非在籍・未退職フラグ): ${retireCandidates.length}名`);
  for (const r of retireCandidates) console.log(`  - ${r.name || "(氏名なし)"} code=${r.code || "(空)"} ${r.openId}`);
})().catch((e) => { console.error("FATAL:", e?.response?.data || e); process.exit(1); });
