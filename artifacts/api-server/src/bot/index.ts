import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger.js";
import {
  handleStart,
  handleMenuCommand,
  handlePurchase,
  handleSale,
  handlePersonalUse,
  handleSeller,
  handleStats,
  handleLog,
  handleReset,
  handleTextInput,
  handleCallbackQuery,
} from "./handlers.js";

export function startBot(): void {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN is not set, bot will not start");
    return;
  }

  const bot = new TelegramBot(token, { polling: true });

  bot.onText(/\/start/, (msg) => handleStart(bot, msg));
  bot.onText(/\/menu/, (msg) => handleMenuCommand(bot, msg));

  bot.on("message", (msg) => {
    const text = msg.text?.trim();
    if (!text) return;

    if (text.startsWith("/")) return;

    switch (text) {
      case "📦 Закупівля":
        handlePurchase(bot, msg);
        break;
      case "💰 Продаж":
        handleSale(bot, msg);
        break;
      case "🍵 Особисте":
        handlePersonalUse(bot, msg);
        break;
      case "👤 Продавець":
        handleSeller(bot, msg);
        break;
      case "📊 Статистика":
        handleStats(bot, msg);
        break;
      case "📋 Журнал":
        handleLog(bot, msg);
        break;
      case "⚙️ Меню":
        handleMenuCommand(bot, msg);
        break;
      default:
        handleTextInput(bot, msg);
        break;
    }
  });

  bot.on("callback_query", (query) => handleCallbackQuery(bot, query));

  bot.on("polling_error", (err) => {
    logger.error({ err }, "Telegram polling error");
  });

  logger.info("Telegram bot started");
}
