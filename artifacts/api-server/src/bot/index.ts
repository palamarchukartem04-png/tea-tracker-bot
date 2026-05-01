import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger.js";
import {
  handleStart,
  handlePurchase,
  handleSale,
  handlePersonalUse,
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

  bot.on("message", (msg) => {
    const text = msg.text?.trim();
    if (!text) return;

    if (text === "/start") return;

    switch (text) {
      case "📦 Закупівля":
        handlePurchase(bot, msg);
        break;
      case "💰 Продаж":
        handleSale(bot, msg);
        break;
      case "🍵 Особисте використання":
        handlePersonalUse(bot, msg);
        break;
      case "📊 Статистика":
        handleStats(bot, msg);
        break;
      case "📋 Журнал операцій":
        handleLog(bot, msg);
        break;
      case "🔄 Скинути всі дані":
        handleReset(bot, msg);
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
