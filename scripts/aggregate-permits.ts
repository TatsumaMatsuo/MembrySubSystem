import * as lark from "@larksuiteoapi/node-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const SYARYO_BASE = process.env.LARK_SYARYO_BASE_TOKEN || "NNLCbCdohajZpYsHCrkjy1adpNX";
const PERMITS_TABLE = process.env.LARK_TABLE_PERMITS || "tblQ3QSv261nYwJt";

(async () => {
  const c = new lark.Client({
    appId: process.env.LARK_APP_ID!,
    appSecret: process.env.LARK_APP_SECRET!,
    appType: lark.AppType.SelfBuild,
    domain: process.env.LARK_DOMAIN || "https://open.larksuite.com",
  });

  const items: any[] = [];
  let pt: string | undefined;
  do {
    const r: any = await c.bitable.appTableRecord.list({
      path: { app_token: SYARYO_BASE, table_id: PERMITS_TABLE },
      params: { page_size: 500, page_token: pt },
    });
    items.push(...(r.data?.items || []));
    pt = r.data?.has_more ? r.data?.page_token : undefined;
  } while (pt);

  const byEmp: Record<string, any> = {};
  const now = Date.now();
  for (const it of items) {
    const f = it.fields || {};
    const eid = String(f.employee_id || "(empty)");
    const st = String(f.status || "(empty)");
    const nameRaw = f.employee_name;
    const name = Array.isArray(nameRaw)
      ? nameRaw[0]?.name
      : typeof nameRaw === "object" && nameRaw
      ? (nameRaw as any).name
      : nameRaw || "";
    if (!byEmp[eid]) byEmp[eid] = { valid: 0, expired: 0, revoked: 0, empty: 0, hasFile: 0, noFile: 0, name: "" };
    byEmp[eid].name = byEmp[eid].name || name;
    if (st === "valid") {
      const exp = Number(f.expiration_date || 0);
      if (exp > now) byEmp[eid].valid++;
      else byEmp[eid].expired++;
    } else if (st === "expired") byEmp[eid].expired++;
    else if (st === "revoked") byEmp[eid].revoked++;
    else byEmp[eid].empty++;
    if (f.permit_file_key) byEmp[eid].hasFile++;
    else byEmp[eid].noFile++;
  }

  console.log("Total permits:", items.length);
  console.log("Employees with permits:", Object.keys(byEmp).length);
  console.log("");
  for (const [eid, s] of Object.entries(byEmp)) {
    console.log(
      `${eid} (${(s as any).name}): valid=${(s as any).valid} expired=${(s as any).expired} revoked=${(s as any).revoked} empty=${(s as any).empty} | file: yes=${(s as any).hasFile} no=${(s as any).noFile}`
    );
  }
})().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
