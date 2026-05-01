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
  getSellerDebt,
  getSellerTotalGiven,
  getSellerTotalExpected,
  getSellerTotalReceived,
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
      [{ text: "🍵 Особисте" }, { text: "👤 Продавець" }],
      [{ text: "📊 Статистика" }, { text: "📋 Журнал" }],
      [{ text: "⚙️ Меню" }],
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
        { text: "👤 Продавець", callback_data: "action_seller" },
      ],
      [
        { text: "📊 Статистика", callback_data: "action_stats" },
        { text: "📋 Журнал", callback_data: "action_log" },
      ],
      [{ text: "🗑️ Скинути всі дані", callback_data: "action_reset" }],
    ],
  };
}

function getSellerKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "📤 Видати товар", callback_data: "seller_give" },
        { text: "💵 Отримати гроші", callback_data: "seller_receive" },
      ],
      [
        { text: "📊 Рахунок продавця", callback_data: "seller_stats" },
        { text: "⚙️ Змінити ставку", callback_data: "seller_set_price" },
      ],
      [{ text: "↩️ Назад", callback_data: "action_back" }],
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
    `☕ *Вітаю, ${name}!*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Я твій особистий бухгалтер для торгівлі чаєм 🍃\n\n` +
      `Я вмію:\n` +
      `📦 Записувати закупівлі\n` +
      `💰 Фіксувати продажі\n` +
      `👤 Вести облік з продавцем\n` +
      `📊 Рахувати прибуток та баланс\n` +
      `💡 Підказувати скільки можна реінвестувати\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Оберіть дію на клавіатурі нижче 👇`,
    { parse_mode: "Markdown", reply_markup: getMainKeyboard() }
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
  const sellerDebt = getSellerDebt(userId);

  let text =
    `⚙️ *Головне меню*\n\n` +
    `📦 Склад: *${fmtInt(stock)} г*\n` +
    `${netCash >= 0 ? "💰 В кишені: *+" : "💼 Вкладено: *"}${fmt(Math.abs(netCash))} грн*`;

  if (sellerDebt > 0) {
    text += `\n👤 Борг продавця: *${fmt(sellerDebt)} грн*`;
  }

  bot.sendMessage(msg.chat.id, text, {
    parse_mode: "Markdown",
    reply_markup: getMenuKeyboard(),
  });
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
      `❌ *Склад порожній!*\n\nСпочатку зробіть закупівлю 📦`,
      { parse_mode: "Markdown", reply_markup: getMainKeyboard() }
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
    bot.sendMessage(msg.chat.id, `❌ *Склад порожній!*`, {
      parse_mode: "Markdown",
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

export function handleSeller(
  bot: TelegramBot,
  msg: TelegramBot.Message
): void {
  const userId = msg.from!.id;
  const user = getUser(userId);
  user.awaitingInput = null;
  setUser(userId, user);

  const debt = getSellerDebt(userId);
  const totalGiven = getSellerTotalGiven(userId);
  const stock = getTotalStock(userId);

  let debtLine = "";
  if (debt > 0) {
    debtLine = `\n⚠️ Борг продавця: *${fmt(debt)} грн*`;
  } else if (debt === 0 && totalGiven > 0) {
    debtLine = `\n✅ Борг: *погашено*`;
  }

  bot.sendMessage(
    msg.chat.id,
    `👤 *ПРОДАВЕЦЬ*\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `📦 На складі: *${fmtInt(stock)} г*\n` +
      `📊 Ставка: *${user.defaultSellerPrice} грн/г*` +
      debtLine +
      `\n\nОберіть дію:`,
    { parse_mode: "Markdown", reply_markup: getSellerKeyboard() }
  );
}

export function handleSellerGive(
  bot: TelegramBot,
  chatId: number,
  userId: number
): void {
  const stock = getTotalStock(userId);

  if (stock <= 0) {
    bot.sendMessage(
      chatId,
      `❌ *Склад порожній!*\n\nСпочатку зробіть закупівлю 📦`,
      { parse_mode: "Markdown", reply_markup: getMainKeyboard() }
    );
    return;
  }

  const user = getUser(userId);
  user.awaitingInput = "seller_give_grams";
  user.tempData = {};
  setUser(userId, user);

  bot.sendMessage(
    chatId,
    `📤 *ВИДАЧА ТОВАРУ ПРОДАВЦЮ*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📦 На складі: *${fmtInt(stock)} г*\n\n` +
      `Скільки грам видаєте продавцю?\n` +
      `_наприклад: 500_`,
    { parse_mode: "Markdown", reply_markup: { remove_keyboard: true } }
  );
}

export function handleSellerReceive(
  bot: TelegramBot,
  chatId: number,
  userId: number
): void {
  const debt = getSellerDebt(userId);

  if (debt <= 0) {
    bot.sendMessage(
      chatId,
      `✅ *Борг продавця відсутній*\n\nСпочатку видайте товар продавцю 📤`,
      { parse_mode: "Markdown", reply_markup: getMainKeyboard() }
    );
    return;
  }

  const user = getUser(userId);
  user.awaitingInput = "seller_receive_amount";
  user.tempData = {};
  setUser(userId, user);

  bot.sendMessage(
    chatId,
    `💵 *ОТРИМАННЯ КОШТІВ ВІД ПРОДАВЦЯ*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💳 Поточний борг: *${fmt(debt)} грн*\n\n` +
      `Скільки грошей отримали від продавця?\n` +
      `_наприклад: 12000_`,
    { parse_mode: "Markdown", reply_markup: { remove_keyboard: true } }
  );
}

export function handleSellerStats(
  bot: TelegramBot,
  chatId: number,
  userId: number
): void {
  const user = getUser(userId);
  const totalGiven = getSellerTotalGiven(userId);
  const totalExpected = getSellerTotalExpected(userId);
  const totalReceived = getSellerTotalReceived(userId);
  const debt = getSellerDebt(userId);

  if (totalGiven === 0) {
    bot.sendMessage(
      chatId,
      `📊 *Рахунок продавця порожній*\n\nВидайте товар продавцю через 📤 Видати товар`,
      { parse_mode: "Markdown", reply_markup: getSellerKeyboard() }
    );
    return;
  }

  const avgFixedPrice =
    totalGiven > 0 ? totalExpected / totalGiven : user.defaultSellerPrice;

  const sellerGivesLog = [...user.sellerGives]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);

  const recentLines = sellerGivesLog.map((g) => {
    const d = g.date;
    const dateStr =
      `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    return `\`${dateStr}\` 📤 *${fmtInt(g.grams)}г* → ${fmt(g.expectedPayment)} грн`;
  });

  const debtStatus =
    debt > 0
      ? `⚠️ *БОРГ: ${fmt(debt)} грн*`
      : `✅ *Борг погашено*`;

  bot.sendMessage(
    chatId,
    `📊 *РАХУНОК ПРОДАВЦЯ*\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `📤 Видано всього: *${fmtInt(totalGiven)} г*\n` +
      `💰 Мало принести: *${fmt(totalExpected)} грн*\n` +
      `✅ Отримано: *${fmt(totalReceived)} грн*\n` +
      `📊 Ставка: *${fmt(avgFixedPrice)} грн/г*\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `${debtStatus}\n\n` +
      (recentLines.length > 0
        ? `_Останні видачі:_\n${recentLines.join("\n")}`
        : ""),
    { parse_mode: "Markdown", reply_markup: getSellerKeyboard() }
  );
}

export function handleSellerSetPrice(
  bot: TelegramBot,
  chatId: number,
  userId: number
): void {
  const user = getUser(userId);
  user.awaitingInput = "seller_set_price";
  user.tempData = {};
  setUser(userId, user);

  bot.sendMessage(
    chatId,
    `⚙️ *ЗМІНА ФІКСОВАНОЇ СТАВКИ*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Поточна ставка: *${user.defaultSellerPrice} грн/г*\n\n` +
      `Введіть нову ставку за грам:\n` +
      `_наприклад: 24_`,
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
  const sellerDebt = getSellerDebt(userId);
  const sellerReceived = getSellerTotalReceived(userId);

  const totalPurchasedGrams = user.purchases.reduce((s, p) => s + p.grams, 0);
  const totalSoldGrams = user.sales.reduce((s, p) => s + p.grams, 0);
  const totalPersonalGrams = user.personalUse.reduce((s, p) => s + p.grams, 0);
  const totalGivenToSeller = user.sellerGives.reduce((s, g) => s + g.grams, 0);

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
    `├ Особисте: ${fmtInt(totalPersonalGrams)} г\n` +
    (totalGivenToSeller > 0
      ? `├ Видано продавцю: ${fmtInt(totalGivenToSeller)} г\n`
      : "") +
    `└ Залишок: *${fmtInt(stock)} г*\n`;

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

  const sellerSection =
    totalGivenToSeller > 0
      ? `👤 *ПРОДАВЕЦЬ*\n` +
        `━━━━━━━━━━━━━━\n` +
        `├ Отримано від продавця: ${fmt(sellerReceived)} грн\n` +
        (sellerDebt > 0
          ? `└ ⚠️ Борг продавця: *${fmt(sellerDebt)} грн*\n`
          : `└ ✅ Борг погашено\n`)
      : "";

  const cashSection =
    `💼 *ГРОШОВИЙ БАЛАНС*\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `├ Витрачено: ${fmt(spent)} грн\n` +
    `├ Виручено (свої продажі): ${fmt(revenue)} грн\n` +
    (sellerReceived > 0
      ? `├ Отримано від продавця: ${fmt(sellerReceived)} грн\n`
      : "") +
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
    (sellerSection ? `\n` + sellerSection : "") +
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
  for (const g of user.sellerGives) {
    allOps.push({
      date: g.date,
      line: `📤 *−${fmtInt(g.grams)}г* → продавцю, чекаємо *${fmt(g.expectedPayment)} грн*`,
    });
  }
  for (const r of user.sellerReceives) {
    allOps.push({
      date: r.date,
      line: `💵 *+${fmt(r.amount)} грн* від продавця`,
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
      `⚠️ Ви збираєтесь видалити _всі_ операції.\n` +
      `Це незворотньо!`,
    {
      parse_mode: "Markdown",
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
      `❌ *Невірне значення*\n\nВведіть число більше нуля.\n_Наприклад: 500 або 12000_`,
      { parse_mode: "Markdown" }
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
    case "seller_give_grams": {
      const stock = getTotalStock(userId);
      if (value > stock) {
        bot.sendMessage(
          chatId,
          `❌ *Недостатньо товару*\n\nНа складі лише *${fmtInt(stock)} г*\nВведіть менше число.`,
          { parse_mode: "Markdown" }
        );
        return;
      }
      user.tempData["grams"] = value;
      user.awaitingInput = "seller_give_price";
      setUser(userId, user);

      const defaultPrice = user.defaultSellerPrice;
      const suggested = defaultPrice * value;
      bot.sendMessage(
        chatId,
        `✔️ *${fmtInt(value)} г* — зрозуміло!\n\n` +
          `💵 Яка фіксована ціна за грам?\n` +
          `_Поточна ставка: ${defaultPrice} грн/г = ${fmt(suggested)} грн за ${fmtInt(value)} г_\n\n` +
          `Введіть ціну за грам або надішліть *${defaultPrice}* щоб підтвердити:`,
        { parse_mode: "Markdown" }
      );
      break;
    }
    case "seller_give_price": {
      const grams = user.tempData["grams"]!;
      const fixedPrice = value;
      const expectedPayment = grams * fixedPrice;

      user.sellerGives.push({
        id: genId(),
        date: new Date(),
        grams,
        fixedPricePerGram: fixedPrice,
        expectedPayment,
      });
      user.defaultSellerPrice = fixedPrice;
      user.awaitingInput = null;
      user.tempData = {};
      setUser(userId, user);

      const newStock = getTotalStock(userId);
      const newDebt = getSellerDebt(userId);

      bot.sendMessage(
        chatId,
        `✅ *ТОВАР ВИДАНО ПРОДАВЦЮ*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `├ 📤 Видано: *${fmtInt(grams)} г*\n` +
          `├ 💰 Ставка: *${fmt(fixedPrice)} грн/г*\n` +
          `├ 🧾 Має принести: *${fmt(expectedPayment)} грн*\n` +
          `├ 🏪 Залишок на складі: *${fmtInt(newStock)} г*\n` +
          `└ ⚠️ Загальний борг: *${fmt(newDebt)} грн*`,
        { parse_mode: "Markdown", reply_markup: getMainKeyboard() }
      );
      break;
    }
    case "seller_receive_amount": {
      const debt = getSellerDebt(userId);
      const amount = value;

      user.sellerReceives.push({
        id: genId(),
        date: new Date(),
        amount,
      });
      user.awaitingInput = null;
      user.tempData = {};
      setUser(userId, user);

      const newDebt = getSellerDebt(userId);
      const overpaid = amount > debt;

      bot.sendMessage(
        chatId,
        `✅ *ОПЛАТА ОТРИМАНА*\n` +
          `━━━━━━━━━━━━━━\n` +
          `├ 💵 Отримано: *${fmt(amount)} грн*\n` +
          `├ 📊 Було боргу: *${fmt(debt)} грн*\n` +
          (newDebt > 0
            ? `└ ⚠️ Залишок боргу: *${fmt(newDebt)} грн*`
            : overpaid
              ? `└ ✅ Борг погашено, переплата: *${fmt(Math.abs(newDebt))} грн*`
              : `└ ✅ *Борг повністю погашено!* 🎉`),
        { parse_mode: "Markdown", reply_markup: getMainKeyboard() }
      );
      break;
    }
    case "seller_set_price": {
      const user2 = getUser(userId);
      user2.defaultSellerPrice = value;
      user2.awaitingInput = null;
      user2.tempData = {};
      setUser(userId, user2);

      bot.sendMessage(
        chatId,
        `✅ *Ставку оновлено*\n\n` +
          `Нова фіксована ставка: *${fmt(value)} грн/г*`,
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

  const fakeMsg = { ...query.message, from: query.from } as TelegramBot.Message;

  switch (data) {
    case "action_purchase":
      handlePurchase(bot, fakeMsg);
      break;
    case "action_sale":
      handleSale(bot, fakeMsg);
      break;
    case "action_personal":
      handlePersonalUse(bot, fakeMsg);
      break;
    case "action_seller":
      handleSeller(bot, fakeMsg);
      break;
    case "action_stats":
      handleStats(bot, fakeMsg);
      break;
    case "action_log":
      handleLog(bot, fakeMsg);
      break;
    case "action_reset":
      handleReset(bot, fakeMsg);
      break;
    case "action_back":
      bot.sendMessage(chatId, `↩️ Головне меню`, {
        parse_mode: "Markdown",
        reply_markup: getMainKeyboard(),
      });
      break;
    case "seller_give":
      handleSellerGive(bot, chatId, userId);
      break;
    case "seller_receive":
      handleSellerReceive(bot, chatId, userId);
      break;
    case "seller_stats":
      handleSellerStats(bot, chatId, userId);
      break;
    case "seller_set_price":
      handleSellerSetPrice(bot, chatId, userId);
      break;
    case "confirm_reset": {
      const user = getUser(userId);
      user.purchases = [];
      user.sales = [];
      user.personalUse = [];
      user.sellerGives = [];
      user.sellerReceives = [];
      user.awaitingInput = null;
      user.tempData = {};
      setUser(userId, user);
      bot.sendMessage(
        chatId,
        `🗑️ *Всі дані видалено*\n\nМожете починати з чистого аркуша!`,
        { parse_mode: "Markdown", reply_markup: getMainKeyboard() }
      );
      break;
    }
    case "cancel_reset":
      bot.sendMessage(chatId, `↩️ Скасовано.`, {
        parse_mode: "Markdown",
        reply_markup: getMainKeyboard(),
      });
      break;
  }
}
