import cron from "node-cron";
import { sendDailySummary } from "./email-service";
import { runReminderCheck } from "./provider-email-service";

let cronTask: ReturnType<typeof cron.schedule> | null = null;
let reminderCronTask: ReturnType<typeof cron.schedule> | null = null;

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

  // Provider appointment reminders (48h before)
  const reminderHour = process.env.REMINDER_CRON_HOUR || "8";
  const reminderMinute = process.env.REMINDER_CRON_MINUTE || "0";
  const reminderCronExpression = `${reminderMinute} ${reminderHour} * * *`;

  if (reminderCronTask) {
    reminderCronTask.stop();
  }

  reminderCronTask = cron.schedule(reminderCronExpression, async () => {
    console.log("[CRON] Running provider reminder check...");
    try {
      const sent = await runReminderCheck();
      console.log(`[CRON] Provider reminders complete — ${sent} reminders sent`);
    } catch (err: any) {
      console.error("[CRON] Provider reminder check failed:", err.message);
    }
  }, {
    timezone: "Europe/Madrid",
  });

  console.log(`[CRON] Provider reminders scheduled at ${reminderHour}:${reminderMinute.padStart(2, "0")} Europe/Madrid`);
}

export function stopEmailCron(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log("[CRON] Daily summary cron stopped");
  }
  if (reminderCronTask) {
    reminderCronTask.stop();
    reminderCronTask = null;
    console.log("[CRON] Provider reminder cron stopped");
  }
}
