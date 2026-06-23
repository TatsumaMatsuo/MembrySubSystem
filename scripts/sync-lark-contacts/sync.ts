/**
 * Lark Contact → 社員マスタ 同期 CLI。
 *
 *   npx tsx scripts/sync-lark-contacts/sync.ts            # dry-run（差分サマリのみ）
 *   npx tsx scripts/sync-lark-contacts/sync.ts --execute  # 実反映（本番マスタへ書込）
 *   npx tsx scripts/sync-lark-contacts/sync.ts --execute --force  # スコープ警告を無視して反映
 *
 * ⚠️ 書込先 master base は本番main・全featブランチ共有。--execute は本番反映。
 */
import * as dotenv from "dotenv";
import { syncLarkContacts, checkContactScopes } from "../../lib/lark-contact-sync";

dotenv.config();

async function main() {
  const execute = process.argv.includes("--execute");
  const force = process.argv.includes("--force");
  const dryRun = !execute;

  console.log(`=== Lark Contact 同期 ${dryRun ? "(DRY-RUN)" : "(EXECUTE — 本番マスタへ書込)"} ===\n`);

  // プリフライト: スコープ検証
  console.log("[1/2] スコープ検証...");
  const scope = await checkContactScopes();
  console.log(`  氏名取得: ${scope.ok ? "OK" : "NG"}`);
  if (scope.missing.length) {
    console.log("  取得できない項目 / 不足スコープの目安:");
    for (const m of scope.missing) console.log(`    - ${m}`);
  }
  console.log(`  user.get サンプル: ${JSON.stringify(scope.sample)}\n`);

  if (execute && !scope.ok && !force) {
    console.error(
      "✗ 氏名すら取得できません。プロフィール読取スコープ未付与の可能性が高いため書込を中止します。\n" +
        "  docs/lark-contact-sync/README.md のスコープ手順を実施するか、--force で強制実行してください。"
    );
    process.exit(2);
  }

  console.log(`[2/2] 同期実行 (dryRun=${dryRun})...`);
  const r = await syncLarkContacts({ dryRun });

  console.log("\n=== サマリ ===");
  console.log(`  Contactディレクトリ人数 : ${r.contactCount}`);
  console.log(`  社員マスタ行数          : ${r.masterCount}`);
  console.log(`  CREATE(新規)            : ${r.created}`);
  console.log(`  UPDATE(変更)            : ${r.updated}`);
  console.log(`  RETIRE(退職確認→フラグ) : ${r.retired}（is_resigned=true 確証分のみ）`);
  console.log(`  退職判定不能(範囲外)    : ${r.retireUnresolved}`);
  console.log(`  open_id無し手動行(skip) : ${r.skippedNoOpenId}`);
  console.log(`  所要                    : ${r.durationMs}ms`);
  if (r.errors.length) {
    console.log("  エラー:");
    for (const e of r.errors) console.log(`    - ${e}`);
  }

  if (r.preview.create.length) {
    console.log("\n--- CREATE プレビュー(先頭) ---");
    for (const c of r.preview.create) console.log(`  + ${c.name || "(氏名なし)"} code=${c.employeeNo || "(空)"} ${c.openId}`);
  }
  if (r.preview.update.length) {
    console.log("\n--- UPDATE プレビュー(先頭) ---");
    for (const u of r.preview.update) console.log(`  ~ ${u.name || "(氏名なし)"} [${u.changed.join(", ")}] ${u.openId}`);
  }
  if (r.preview.retire.length) {
    console.log("\n--- RETIRE プレビュー(先頭) ---");
    for (const x of r.preview.retire) console.log(`  - ${x.name || "(氏名なし)"} ${x.openId}`);
  }

  if (dryRun) console.log("\n(dry-run のため書き込んでいません。反映するには --execute)");
}

main().catch((e) => {
  console.error("FATAL:", e?.response?.data || e);
  process.exit(1);
});
