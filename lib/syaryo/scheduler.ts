import cron from "node-cron";
import { runExpirationMonitor } from "@/lib/syaryo/services/expiration-monitor.job";

/**
 * スケジュールジョブを初期化
 */
export function initializeScheduler() {
  // 毎日午前9時に有効期限監視ジョブを実行
  cron.schedule(
    "0 9 * * *",
    async () => {
      console.log("[Scheduler] Running daily expiration monitor job");
      try {
        await runExpirationMonitor();
      } catch (error) {
        console.error("[Scheduler] Expiration monitor job failed:", error);
      }
    },
    {
      timezone: "Asia/Tokyo",
    }
  );

  console.log("[Scheduler] Scheduled jobs initialized");
  console.log("[Scheduler] - Expiration monitor: Daily at 9:00 AM JST");
}

/**
 * 手動でジョブを実行（テスト用）
 */
export async function runManualJob() {
  console.log("[Scheduler] Running manual expiration monitor job");
  await runExpirationMonitor();
}
