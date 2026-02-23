import cron from "node-cron";
import { sendDailySummary } from "./email-service";

let cronTask: ReturnType<typeof cron.schedule> | null = null;

export function startEmailCron(): void {
  const hour = process.env.DAILY_SUMMARY_HOUR || "7";
  const minute = process.env.DAILY_SUMMARY_MINUTE || "0";
  const cronExpression = `${minute} ${hour} * * *`;

  if (cronTask) {
    cronTask.stop();
  }

  cronTask = cron.schedule(cronExpression, async () => {
    console.log("[CRON] Running daily summary email job...");
    try {
      const sent = await sendDailySummary();
      console.log(`[CRON] Daily summary complete — ${sent} emails sent`);
    } catch (err: any) {
      console.error("[CRON] Daily summary failed:", err.message);
    }
  }, {
    timezone: "Europe/Madrid",
  });

  console.log(`[CRON] Daily summary scheduled at ${hour}:${minute.padStart(2, "0")} Europe/Madrid`);
}

export function stopEmailCron(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log("[CRON] Daily summary cron stopped");
  }
}
