import { appConfig } from "@pulsorclip/core/server";

export async function notifyAdmins(
  bot: { telegram: { sendMessage: (chatId: number, text: string) => Promise<unknown> } },
  message: string,
) {
  if (!appConfig.telegramAdminIds.length) {
    console.warn("[pulsorclip-bot] no TELEGRAM_ADMIN_IDS configured; skipping admin notification.");
    return;
  }

  await Promise.all(
    appConfig.telegramAdminIds.map(async (adminId) => {
      try {
        await bot.telegram.sendMessage(adminId, message);
        console.log(`[pulsorclip-bot] admin notification delivered to ${adminId}`);
      } catch (error) {
        const details = error instanceof Error ? error.message : String(error);
        console.error(
          `[pulsorclip-bot] failed to notify admin ${adminId}. Make sure this Telegram account has already started a private chat with the bot.`,
          details,
        );
      }
    }),
  );
}
