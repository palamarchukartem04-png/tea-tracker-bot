import TelegramBot from "node-telegram-bot-api";
import {
  getUser,
  setUser,
  getTotalStock,
  getTotalSpent,
  getTotalRevenue,
  getAvgCostPerGram,
  getProfit,
  getTotalCOGS,
} from "./store.js";

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function fmt(n: number): string {
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function getMainKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: "📦 Закупівля" }, { text: "💰 Продаж" }],
      [{ text: "🍵 Особисте використання" }, { text: "📊 Статистика" }],
      [{ text: "📋 Журнал операцій" }, { text: "🔄 Скинути всі дані" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

export function handleStart(bot: TelegramBot, msg: TelegramBot.Message): void {
  const userId = msg.from!.id;
  const user = getUser(userId);
  user.awaitingInput = null;
  setUser(userId, user);

  bot.sendMessage(
    msg.chat.id,
    `Привіт! 👋 Я бот для обліку торгівлі чаєм 🍵\n\nОберіть дію:`,
    { reply_markup: getMainKeyboard() }
  );
}

export function handlePurchase(
  bot: TelegramBot,
  msg: TelegramBot.Message
): void {
  const userId = msg.from!.id;
  const user = getUser(userId);
  user.awaitingInput = "purchase_grams";
  user.tempData = {};
  setUser(userId, user);

  bot.sendMessage(
    msg.chat.id,
    "📦 *Нова закупівля*\n\nСкільки грам чаю ви купили?",
    { parse_mode: "Markdown", reply_markup: { remove_keyboard: true } }
  );
}

export function handleSale(bot: TelegramBot, msg: TelegramBot.Message): void {
  const userId = msg.from!.id;
  const stock = getTotalStock(userId);

  if (stock <= 0) {
    bot.sendMessage(
      msg.chat.id,
      "❌ У вас немає чаю на складі. Спочатку зробіть закупівлю.",
      { reply_markup: getMainKeyboard() }
    );
    return;
  }

  const user = getUser(userId);
  user.awaitingInput = "sale_grams";
  user.tempData = {};
  setUser(userId, user);

  bot.sendMessage(
    msg.chat.id,
    `💰 *Новий продаж*\n\nНа складі: *${fmt(stock)} г*\n\nСкільки грам ви продали?`,
    { parse_mode: "Markdown", reply_markup: { remove_keyboard: true } }
  );
}

export function handlePersonalUse(
  bot: TelegramBot,
  msg: TelegramBot.Message
): void {
  const userId = msg.from!.id;
  const stock = getTotalStock(userId);

  if (stock <= 0) {
    bot.sendMessage(
      msg.chat.id,
      "❌ У вас немає чаю на складі.",
      { reply_markup: getMainKeyboard() }
    );
    return;
  }

  const user = getUser(userId);
  user.awaitingInput = "personal_grams";
  user.tempData = {};
  setUser(userId, user);

  bot.sendMessage(
    msg.chat.id,
    `🍵 *Особисте використання*\n\nНа складі: *${fmt(stock)} г*\n\nСкільки грам ви взяли для себе?`,
    { parse_mode: "Markdown", reply_markup: { remove_keyboard: true } }
  );
}

export function handleStats(bot: TelegramBot, msg: TelegramBot.Message): void {
  const userId = msg.from!.id;
  const user = getUser(userId);

  const stock = getTotalStock(userId);
  const spent = getTotalSpent(userId);
  const revenue = getTotalRevenue(userId);
  const profit = getProfit(userId);
  const cogs = getTotalCOGS(userId);
  const avgCost = getAvgCostPerGram(userId);

  const totalPurchasedGrams = user.purchases.reduce((s, p) => s + p.grams, 0);
  const totalSoldGrams = user.sales.reduce((s, p) => s + p.grams, 0);
  const totalPersonalGrams = user.personalUse.reduce((s, p) => s + p.grams, 0);

  const avgSalePrice =
    totalSoldGrams > 0 ? revenue / totalSoldGrams : 0;

  const stockValue = stock * avgCost;

  const text = `📊 *Статистика*

*🏪 Склад:*
├ Закуплено: ${fmt(totalPurchasedGrams)} г
├ Продано: ${fmt(totalSoldGrams)} г
├ Особисте: ${fmt(totalPersonalGrams)} г
└ Залишок: *${fmt(stock)} г*

*💵 Фінанси:*
├ Витрачено на закупівлю: ${fmt(spent)} грн
├ Середня ціна закупівлі: ${fmt(avgCost)} грн/г
├ Виручка від продажів: ${fmt(revenue)} грн
├ Середня ціна продажу: ${fmt(avgSalePrice)} грн/г
├ Собівартість проданого: ${fmt(cogs)} грн
├ Вартість залишку: ${fmt(stockValue)} грн
└ *Прибуток: ${profit >= 0 ? "+" : ""}${fmt(profit)} грн*`;

  bot.sendMessage(msg.chat.id, text, {
    parse_mode: "Markdown",
    reply_markup: getMainKeyboard(),
  });
}

export function handleLog(bot: TelegramBot, msg: TelegramBot.Message): void {
  const userId = msg.from!.id;
  const user = getUser(userId);

  const lines: string[] = ["📋 *Журнал операцій*\n"];

  const allOps: Array<{ date: Date; line: string }> = [];

  for (const p of user.purchases) {
    allOps.push({
      date: p.date,
      line: `📦 Закупівля: ${fmt(p.grams)}г по ${fmt(p.pricePerGram)} грн/г = ${fmt(p.totalCost)} грн`,
    });
  }
  for (const s of user.sales) {
    allOps.push({
      date: s.date,
      line: `💰 Продаж: ${fmt(s.grams)}г по ${fmt(s.pricePerGram)} грн/г = ${fmt(s.totalRevenue)} грн`,
    });
  }
  for (const u of user.personalUse) {
    allOps.push({
      date: u.date,
      line: `🍵 Особисте: ${fmt(u.grams)}г`,
    });
  }

  allOps.sort((a, b) => a.date.getTime() - b.date.getTime());

  if (allOps.length === 0) {
    bot.sendMessage(msg.chat.id, "Журнал порожній. Почніть з закупівлі.", {
      reply_markup: getMainKeyboard(),
    });
    return;
  }

  const recent = allOps.slice(-20);
  for (const op of recent) {
    const d = op.date;
    const dateStr = `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    lines.push(`_${dateStr}_ — ${op.line}`);
  }

  if (allOps.length > 20) {
    lines.push(`\n_...показано останні 20 з ${allOps.length} операцій_`);
  }

  bot.sendMessage(msg.chat.id, lines.join("\n"), {
    parse_mode: "Markdown",
    reply_markup: getMainKeyboard(),
  });
}

export function handleReset(bot: TelegramBot, msg: TelegramBot.Message): void {
  const userId = msg.from!.id;
  const user = getUser(userId);
  user.awaitingInput = null;
  user.tempData = {};
  setUser(userId, user);

  bot.sendMessage(
    msg.chat.id,
    "⚠️ Ви впевнені, що хочете *скинути всі дані*? Це незворотньо!",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Так, скинути", callback_data: "confirm_reset" },
            { text: "❌ Скасувати", callback_data: "cancel_reset" },
          ],
        ],
      },
    }
  );
}

export function handleTextInput(
  bot: TelegramBot,
  msg: TelegramBot.Message
): void {
  const userId = msg.from!.id;
  const user = getUser(userId);
  const text = msg.text?.trim() ?? "";
  const chatId = msg.chat.id;

  if (user.awaitingInput === null) return;

  const value = parseFloat(text.replace(",", "."));
  if (isNaN(value) || value <= 0) {
    bot.sendMessage(chatId, "❌ Введіть коректне число більше нуля.");
    return;
  }

  switch (user.awaitingInput) {
    case "purchase_grams": {
      user.tempData["grams"] = value;
      user.awaitingInput = "purchase_cost";
      setUser(userId, user);
      bot.sendMessage(
        chatId,
        `Добре, *${fmt(value)} г*.\n\nСкільки всього ви заплатили за цю партію (грн)?`,
        { parse_mode: "Markdown" }
      );
      break;
    }
    case "purchase_cost": {
      const grams = user.tempData["grams"]!;
      const cost = value;
      const pricePerGram = cost / grams;
      user.purchases.push({
        id: genId(),
        date: new Date(),
        grams,
        totalCost: cost,
        pricePerGram,
      });
      user.awaitingInput = null;
      user.tempData = {};
      setUser(userId, user);

      const stock = getTotalStock(userId);
      bot.sendMessage(
        chatId,
        `✅ *Закупівля записана!*\n\n` +
          `├ Куплено: ${fmt(grams)} г\n` +
          `├ Сплачено: ${fmt(cost)} грн\n` +
          `├ Ціна за грам: ${fmt(pricePerGram)} грн/г\n` +
          `└ Залишок на складі: *${fmt(stock)} г*`,
        { parse_mode: "Markdown", reply_markup: getMainKeyboard() }
      );
      break;
    }
    case "sale_grams": {
      const stock = getTotalStock(userId);
      if (value > stock) {
        bot.sendMessage(
          chatId,
          `❌ Не можна продати більше ніж є на складі (${fmt(stock)} г). Введіть інше число.`
        );
        return;
      }
      user.tempData["grams"] = value;
      user.awaitingInput = "sale_revenue";
      setUser(userId, user);
      bot.sendMessage(
        chatId,
        `Добре, *${fmt(value)} г*.\n\nСкільки всього ви отримали за цей продаж (грн)?`,
        { parse_mode: "Markdown" }
      );
      break;
    }
    case "sale_revenue": {
      const grams = user.tempData["grams"]!;
      const revenue = value;
      const pricePerGram = revenue / grams;
      const avgCost = getAvgCostPerGram(userId);
      const profit = (pricePerGram - avgCost) * grams;

      user.sales.push({
        id: genId(),
        date: new Date(),
        grams,
        totalRevenue: revenue,
        pricePerGram,
      });
      user.awaitingInput = null;
      user.tempData = {};
      setUser(userId, user);

      const stock = getTotalStock(userId);
      bot.sendMessage(
        chatId,
        `✅ *Продаж записано!*\n\n` +
          `├ Продано: ${fmt(grams)} г\n` +
          `├ Виручка: ${fmt(revenue)} грн\n` +
          `├ Ціна за грам: ${fmt(pricePerGram)} грн/г\n` +
          `├ Прибуток з продажу: *${profit >= 0 ? "+" : ""}${fmt(profit)} грн*\n` +
          `└ Залишок на складі: *${fmt(stock)} г*`,
        { parse_mode: "Markdown", reply_markup: getMainKeyboard() }
      );
      break;
    }
    case "personal_grams": {
      const stock = getTotalStock(userId);
      if (value > stock) {
        bot.sendMessage(
          chatId,
          `❌ Не можна взяти більше ніж є на складі (${fmt(stock)} г). Введіть інше число.`
        );
        return;
      }
      user.personalUse.push({
        id: genId(),
        date: new Date(),
        grams: value,
      });
      user.awaitingInput = null;
      user.tempData = {};
      setUser(userId, user);

      const newStock = getTotalStock(userId);
      bot.sendMessage(
        chatId,
        `✅ *Записано!*\n\n` +
          `├ Взято для себе: ${fmt(value)} г\n` +
          `└ Залишок на складі: *${fmt(newStock)} г*`,
        { parse_mode: "Markdown", reply_markup: getMainKeyboard() }
      );
      break;
    }
  }
}

export function handleCallbackQuery(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery
): void {
  const userId = query.from.id;
  const chatId = query.message!.chat.id;
  const data = query.data;

  bot.answerCallbackQuery(query.id);

  if (data === "confirm_reset") {
    const user = getUser(userId);
    user.purchases = [];
    user.sales = [];
    user.personalUse = [];
    user.awaitingInput = null;
    user.tempData = {};
    setUser(userId, user);

    bot.sendMessage(chatId, "🗑️ Всі дані скинуто.", {
      reply_markup: getMainKeyboard(),
    });
  } else if (data === "cancel_reset") {
    bot.sendMessage(chatId, "❌ Скасовано.", {
      reply_markup: getMainKeyboard(),
    });
  }
}
