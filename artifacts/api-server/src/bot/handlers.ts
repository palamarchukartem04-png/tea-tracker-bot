import TelegramBot from "node-telegram-bot-api";
import {
  getUser,
  setUser,
  getTotalStock,
  getTotalSpent,
  getTotalRevenue,
  getAvgCostPerGram,
  getAvgSalePricePerGram,
  getProfit,
  getTotalCOGS,
  getNetCash,
  getLastSaleRevenue,
  getEffectiveCapital,
} from "./store.js";

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function fmt(n: number): string {
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function fmtInt(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function stockBar(grams: number): string {
  const kg = grams / 1000;
  const filled = Math.min(10, Math.round(kg * 2));
  const empty = 10 - filled;
  return "🟩".repeat(filled) + "⬜".repeat(empty) + ` ${fmtInt(grams)} г`;
}

function profitEmoji(value: number): string {
  if (value > 5000) return "🤑";
  if (value > 0) return "😊";
  if (value === 0) return "😐";
  return "😬";
}

function trendArrow(value: number): string {
  return value >= 0 ? "📈" : "📉";
}

export function getMainKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: "📦 Закупівля" }, { text: "💰 Продаж" }],
      [{ text: "🍵 Особисте" }, { text: "📊 Статистика" }],
      [{ text: "📋 Журнал" }, { text: "⚙️ Меню" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

function getMenuKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "📦 Нова закупівля", callback_data: "action_purchase" },
        { text: "💰 Новий продаж", callback_data: "action_sale" },
      ],
      [
        { text: "🍵 Особисте використання", callback_data: "action_personal" },
      ],
      [
        { text: "📊 Статистика", callback_data: "action_stats" },
        { text: "📋 Журнал", callback_data: "action_log" },
      ],
      [{ text: "🗑️ Скинути всі дані", callback_data: "action_reset" }],
    ],
  };
}

export function handleStart(bot: TelegramBot, msg: TelegramBot.Message): void {
  const userId = msg.from!.id;
  const user = getUser(userId);
  user.awaitingInput = null;
  setUser(userId, user);

  const name = msg.from?.first_name ?? "Друже";

  bot.sendMessage(
    msg.chat.id,
    `☕ *Вітаю, ${name}\\!*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Я твій особистий бухгалтер для торгівлі чаєм 🍃\n\n` +
      `Я вмію:\n` +
      `📦 Записувати закупівлі\n` +
      `💰 Фіксувати продажі\n` +
      `📊 Рахувати прибуток та баланс\n` +
      `💡 Підказувати скільки можна реінвестувати\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Оберіть дію на клавіатурі нижче 👇`,
    { parse_mode: "MarkdownV2", reply_markup: getMainKeyboard() }
  );
}

export function handleMenuCommand(
  bot: TelegramBot,
  msg: TelegramBot.Message
): void {
  const userId = msg.from!.id;
  const user = getUser(userId);
  user.awaitingInput = null;
  setUser(userId, user);

  const stock = getTotalStock(userId);
  const netCash = getNetCash(userId);

  bot.sendMessage(
    msg.chat.id,
    `⚙️ *Головне меню*\n\n` +
      `📦 Склад: *${fmtInt(stock)} г*\n` +
      `${netCash >= 0 ? "💰 В кишені: *+" : "💼 Вкладено: *"}${fmt(Math.abs(netCash))} грн*`,
    { parse_mode: "Markdown", reply_markup: getMenuKeyboard() }
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
    `📦 *НОВА ЗАКУПІВЛЯ*\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `Введіть кількість грам:\n` +
      `_наприклад: 1000 або 500_`,
    { parse_mode: "Markdown", reply_markup: { remove_keyboard: true } }
  );
}

export function handleSale(bot: TelegramBot, msg: TelegramBot.Message): void {
  const userId = msg.from!.id;
  const stock = getTotalStock(userId);

  if (stock <= 0) {
    bot.sendMessage(
      msg.chat.id,
      `❌ *Склад порожній\\!*\n\nСпочатку зробіть закупівлю 📦`,
      { parse_mode: "MarkdownV2", reply_markup: getMainKeyboard() }
    );
    return;
  }

  const user = getUser(userId);
  user.awaitingInput = "sale_grams";
  user.tempData = {};
  setUser(userId, user);

  bot.sendMessage(
    msg.chat.id,
    `💰 *НОВИЙ ПРОДАЖ*\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `📦 На складі зараз:\n` +
      `${stockBar(stock)}\n\n` +
      `Скільки грам продаєте?\n` +
      `_наприклад: 500_`,
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
    bot.sendMessage(msg.chat.id, `❌ *Склад порожній\\!*`, {
      parse_mode: "MarkdownV2",
      reply_markup: getMainKeyboard(),
    });
    return;
  }

  const user = getUser(userId);
  user.awaitingInput = "personal_grams";
  user.tempData = {};
  setUser(userId, user);

  bot.sendMessage(
    msg.chat.id,
    `🍵 *ОСОБИСТЕ ВИКОРИСТАННЯ*\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `📦 На складі: *${fmtInt(stock)} г*\n\n` +
      `Скільки грам берете для себе?`,
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
  const avgSalePrice = getAvgSalePricePerGram(userId);
  const netCash = getNetCash(userId);
  const effectiveCapital = getEffectiveCapital(userId);

  const totalPurchasedGrams = user.purchases.reduce((s, p) => s + p.grams, 0);
  const totalSoldGrams = user.sales.reduce((s, p) => s + p.grams, 0);
  const totalPersonalGrams = user.personalUse.reduce((s, p) => s + p.grams, 0);

  const stockValueAtCost = stock * avgCost;
  const stockValueAtSalePrice = avgSalePrice > 0 ? stock * avgSalePrice : 0;
  const potentialProfit =
    avgSalePrice > 0 ? stockValueAtSalePrice - stockValueAtCost : 0;

  const margin =
    avgCost > 0 && avgSalePrice > 0
      ? ((avgSalePrice - avgCost) / avgCost) * 100
      : 0;

  const stockSection =
    `🏪 *СКЛАД*\n` +
    `━━━━━━━━━━━━━━\n` +
    `${stockBar(stock)}\n` +
    `├ Закуплено всього: ${fmtInt(totalPurchasedGrams)} г\n` +
    `├ Продано: ${fmtInt(totalSoldGrams)} г\n` +
    `└ Особисте: ${fmtInt(totalPersonalGrams)} г\n`;

  const pricesSection =
    `📈 *ЦІНИ*\n` +
    `━━━━━━━━━━━━━━\n` +
    `├ Середня закупівля: *${fmt(avgCost)} грн/г*\n` +
    `├ Середній продаж: *${fmt(avgSalePrice > 0 ? avgSalePrice : 0)} грн/г*\n` +
    `└ Маржа: *${margin > 0 ? "+" : ""}${margin.toFixed(1)}%*\n`;

  const stockValueSection =
    avgSalePrice > 0
      ? `📦 *ВАРТІСТЬ ЗАЛИШКУ*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `├ За закупівлею: ${fmt(stockValueAtCost)} грн\n` +
        `├ За продажною: *${fmt(stockValueAtSalePrice)} грн*\n` +
        `└ Прихований прибуток: *+${fmt(potentialProfit)} грн* 💎\n`
      : `📦 *ВАРТІСТЬ ЗАЛИШКУ*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `└ За закупівлею: ${fmt(stockValueAtCost)} грн\n`;

  const cashSection =
    `💼 *ГРОШОВИЙ БАЛАНС*\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `├ Витрачено: ${fmt(spent)} грн\n` +
    `├ Виручено: ${fmt(revenue)} грн\n` +
    `├ Реалізований прибуток: *${profit >= 0 ? "+" : ""}${fmt(profit)} грн* ${trendArrow(profit)}\n` +
    (netCash >= 0
      ? `├ 💵 Гроші в кишені: *+${fmt(netCash)} грн* ✅\n`
      : `├ 💼 Ще не відбито: *${fmt(Math.abs(netCash))} грн*\n`) +
    `└ Загальний капітал: *${effectiveCapital >= 0 ? "+" : ""}${fmt(effectiveCapital)} грн* ${profitEmoji(effectiveCapital)}\n`;

  const text =
    `📊 *СТАТИСТИКА* ${profitEmoji(profit)}\n\n` +
    stockSection +
    `\n` +
    pricesSection +
    `\n` +
    stockValueSection +
    `\n` +
    cashSection;

  bot.sendMessage(msg.chat.id, text, {
    parse_mode: "Markdown",
    reply_markup: getMainKeyboard(),
  });
}

export function handleLog(bot: TelegramBot, msg: TelegramBot.Message): void {
  const userId = msg.from!.id;
  const user = getUser(userId);

  const allOps: Array<{ date: Date; line: string }> = [];

  for (const p of user.purchases) {
    allOps.push({
      date: p.date,
      line: `📦 *+${fmtInt(p.grams)}г* за ${fmt(p.totalCost)} грн _(${fmt(p.pricePerGram)}/г)_`,
    });
  }
  for (const s of user.sales) {
    allOps.push({
      date: s.date,
      line: `💰 *−${fmtInt(s.grams)}г* → ${fmt(s.totalRevenue)} грн _(${fmt(s.pricePerGram)}/г)_`,
    });
  }
  for (const u of user.personalUse) {
    allOps.push({
      date: u.date,
      line: `🍵 *−${fmtInt(u.grams)}г* особисте`,
    });
  }

  allOps.sort((a, b) => a.date.getTime() - b.date.getTime());

  if (allOps.length === 0) {
    bot.sendMessage(
      msg.chat.id,
      `📋 *Журнал порожній*\n\nПочніть з першої закупівлі 📦`,
      { parse_mode: "Markdown", reply_markup: getMainKeyboard() }
    );
    return;
  }

  const recent = allOps.slice(-20);
  const lines: string[] = [
    `📋 *ЖУРНАЛ ОПЕРАЦІЙ*`,
    `━━━━━━━━━━━━━━━━━━`,
  ];

  for (const op of recent) {
    const d = op.date;
    const dateStr =
      `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}` +
      ` ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    lines.push(`\`${dateStr}\` ${op.line}`);
  }

  if (allOps.length > 20) {
    lines.push(`\n_...останні 20 з ${allOps.length} операцій_`);
  }

  lines.push(`\n━━━━━━━━━━━━━━━━━━`);
  lines.push(`_Всього операцій: ${allOps.length}_`);

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
    `🗑️ *СКИДАННЯ ДАНИХ*\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `⚠️ Ви збираєтесь видалити _всі_ операції\\.\n` +
      `Це незворотньо\\!`,
    {
      parse_mode: "MarkdownV2",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🗑️ Так, видалити все", callback_data: "confirm_reset" },
            { text: "↩️ Скасувати", callback_data: "cancel_reset" },
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
    bot.sendMessage(
      chatId,
      `❌ *Невірне значення*\n\nВведіть число більше нуля\\.\n_Наприклад: 500 або 12000_`,
      { parse_mode: "MarkdownV2" }
    );
    return;
  }

  switch (user.awaitingInput) {
    case "purchase_grams": {
      user.tempData["grams"] = value;
      user.awaitingInput = "purchase_cost";
      setUser(userId, user);
      bot.sendMessage(
        chatId,
        `✔️ *${fmtInt(value)} г* — зрозуміло!\n\n` +
          `💵 Скільки всього заплатили за цю партію?\n` +
          `_введіть суму в гривнях_`,
        { parse_mode: "Markdown" }
      );
      break;
    }
    case "purchase_cost": {
      const grams = user.tempData["grams"]!;
      const cost = value;
      const pricePerGram = cost / grams;
      const lastSaleRevenue = getLastSaleRevenue(userId);
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

      let cycleNote = "";
      if (lastSaleRevenue !== null) {
        const pocketed = lastSaleRevenue - cost;
        if (pocketed > 0) {
          cycleNote =
            `\n\n` +
            `🔄 *ЦИКЛ ЗАВЕРШЕНО*\n` +
            `━━━━━━━━━━━━━━\n` +
            `├ Виручка з продажу: ${fmt(lastSaleRevenue)} грн\n` +
            `├ Витрачено на партію: ${fmt(cost)} грн\n` +
            `└ 💵 *В кишеню: +${fmt(pocketed)} грн* 🎉`;
        } else if (pocketed < 0) {
          cycleNote =
            `\n\n` +
            `🔄 *ЦИКЛ ЗАВЕРШЕНО*\n` +
            `━━━━━━━━━━━━━━\n` +
            `├ Виручка з продажу: ${fmt(lastSaleRevenue)} грн\n` +
            `├ Витрачено на партію: ${fmt(cost)} грн\n` +
            `└ ⚠️ *Доплачено зі своїх: ${fmt(Math.abs(pocketed))} грн*`;
        }
      }

      bot.sendMessage(
        chatId,
        `✅ *ЗАКУПІВЛЯ ЗАПИСАНА*\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `├ 📦 Куплено: *${fmtInt(grams)} г*\n` +
          `├ 💵 Сплачено: *${fmt(cost)} грн*\n` +
          `├ 🏷️ Ціна: *${fmt(pricePerGram)} грн/г*\n` +
          `└ 🏪 Склад: *${fmtInt(stock)} г*` +
          cycleNote,
        { parse_mode: "Markdown", reply_markup: getMainKeyboard() }
      );
      break;
    }
    case "sale_grams": {
      const stock = getTotalStock(userId);
      if (value > stock) {
        bot.sendMessage(
          chatId,
          `❌ *Недостатньо товару*\n\n` +
            `На складі лише *${fmtInt(stock)} г*\n` +
            `Введіть менше число.`,
          { parse_mode: "Markdown" }
        );
        return;
      }
      user.tempData["grams"] = value;
      user.awaitingInput = "sale_revenue";
      setUser(userId, user);
      bot.sendMessage(
        chatId,
        `✔️ *${fmtInt(value)} г* — зрозуміло!\n\n` +
          `💰 Скільки отримали за цей продаж?\n` +
          `_введіть суму в гривнях_`,
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
      const canBuyGrams = avgCost > 0 ? Math.floor(revenue / avgCost) : 0;

      const reinvestLine =
        avgCost > 0
          ? `\n\n` +
            `💡 *РЕІНВЕСТИЦІЯ*\n` +
            `━━━━━━━━━━━━━━\n` +
            `На ${fmt(revenue)} грн можна купити:\n` +
            `└ *~${fmtInt(canBuyGrams)} г* нового товару`
          : "";

      bot.sendMessage(
        chatId,
        `✅ *ПРОДАЖ ЗАПИСАНО* ${profitEmoji(profit)}\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `├ 📦 Продано: *${fmtInt(grams)} г*\n` +
          `├ 💰 Виручка: *${fmt(revenue)} грн*\n` +
          `├ 🏷️ Ціна: *${fmt(pricePerGram)} грн/г*\n` +
          `├ ${profit >= 0 ? "📈" : "📉"} Прибуток: *${profit >= 0 ? "+" : ""}${fmt(profit)} грн*\n` +
          `└ 🏪 Склад: *${fmtInt(stock)} г*` +
          reinvestLine,
        { parse_mode: "Markdown", reply_markup: getMainKeyboard() }
      );
      break;
    }
    case "personal_grams": {
      const stock = getTotalStock(userId);
      if (value > stock) {
        bot.sendMessage(
          chatId,
          `❌ *Недостатньо товару*\n\nНа складі лише *${fmtInt(stock)} г*`,
          { parse_mode: "Markdown" }
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
        `✅ *ЗАПИСАНО*\n` +
          `━━━━━━━━━━━━\n` +
          `├ 🍵 Взято для себе: *${fmtInt(value)} г*\n` +
          `└ 🏪 Склад: *${fmtInt(newStock)} г*`,
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

  switch (data) {
    case "action_purchase":
      handlePurchase(bot, query.message as TelegramBot.Message);
      break;
    case "action_sale":
      handleSale(bot, query.message as TelegramBot.Message);
      break;
    case "action_personal":
      handlePersonalUse(bot, query.message as TelegramBot.Message);
      break;
    case "action_stats":
      handleStats(bot, query.message as TelegramBot.Message);
      break;
    case "action_log":
      handleLog(bot, query.message as TelegramBot.Message);
      break;
    case "action_reset":
      handleReset(bot, query.message as TelegramBot.Message);
      break;
    case "confirm_reset": {
      const user = getUser(userId);
      user.purchases = [];
      user.sales = [];
      user.personalUse = [];
      user.awaitingInput = null;
      user.tempData = {};
      setUser(userId, user);
      bot.sendMessage(
        chatId,
        `🗑️ *Всі дані видалено*\n\nМожете починати з чистого аркуша\\!`,
        { parse_mode: "MarkdownV2", reply_markup: getMainKeyboard() }
      );
      break;
    }
    case "cancel_reset":
      bot.sendMessage(chatId, `↩️ Скасовано\\.`, {
        parse_mode: "MarkdownV2",
        reply_markup: getMainKeyboard(),
      });
      break;
  }
}
