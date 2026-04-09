import { appConfig } from "@pulsorclip/core/server";

export async function notifyAdmins(
  bot: { telegram: { sendMessage: (chatId: number, text: string) => Promise<unknown> } },
  message: string,
) {
  await Promise.all(
    appConfig.telegramAdminIds.map(async (adminId) => {
      try {
        await bot.telegram.sendMessage(adminId, message);
      } catch (error) {
        console.error(`[pulsorclip-bot] failed to notify admin ${adminId}`, error);
      }
    }),
  );
}
