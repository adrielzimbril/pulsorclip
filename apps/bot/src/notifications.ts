import { appConfig, logServer } from "@pulsorclip/core/server";

type TelegramAdminBot = {
  telegram: {
    sendMessage: (chatId: number, text: string) => Promise<unknown>;
    getChat: (chatId: number) => Promise<unknown>;
  };
};

type TelegramNotifyBot = {
  telegram: {
    sendMessage: (chatId: number, text: string) => Promise<unknown>;
  };
};

type AdminDeliveryReport = {
  adminId: number;
  ok: boolean;
  reason?: string;
};

export async function validateAdminRecipients(bot: TelegramAdminBot) {
  if (!appConfig.telegramAdminIds.length) {
    logServer("warn", "bot.admin.validate.skipped", {
      reason: "no_admin_ids",
    });
    return [];
  }

  const reports = await Promise.all(
    appConfig.telegramAdminIds.map(async (adminId): Promise<AdminDeliveryReport> => {
      try {
        logServer("info", "bot.admin.validate.attempt", { adminId });
        const chat = await bot.telegram.getChat(adminId);
        const chatType = typeof chat === "object" && chat && "type" in chat ? (chat as { type?: string }).type : "unknown";
        logServer("info", "bot.admin.validate.ok", {
          adminId,
          chatType,
          status: "reachable",
        });
        return { adminId, ok: true };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const isNotFound = reason.includes("chat not found") || reason.includes("400");
        
        logServer("warn", "bot.admin.validate.failed", {
          adminId,
          reason,
          hint: isNotFound 
            ? "Admin likely hasn't started a private chat with the bot yet." 
            : "Check if the admin ID is correct and the bot has permissions.",
        });
        return { adminId, ok: false, reason };
      }
    }),
  );


  return reports;
}

export async function notifyAdmins(
  bot: TelegramNotifyBot,
  message: string,
) {
  if (!appConfig.telegramAdminIds.length) {
    logServer("warn", "bot.admin.notify.skipped", {
      reason: "no_admin_ids",
    });
    return { delivered: 0, failed: 0 };
  }

  let delivered = 0;
  let failed = 0;

  await Promise.all(
    appConfig.telegramAdminIds.map(async (adminId) => {
      try {
        logServer("info", "bot.admin.notify.attempt", { adminId });
        await bot.telegram.sendMessage(adminId, message);
        delivered += 1;
        logServer("info", "bot.admin.notify.delivered", {
          adminId,
        });
      } catch (error) {
        failed += 1;
        const details = error instanceof Error ? error.message : String(error);
        logServer("error", "bot.admin.notify.failed", {
          adminId,
          reason: details,
          hint: "Make sure this Telegram account has already started a private chat with the bot.",
        });
      }
    }),
  );

  return { delivered, failed };
}
