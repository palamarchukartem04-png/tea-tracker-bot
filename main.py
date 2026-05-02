import os
import sqlite3
from datetime import datetime
from threading import Thread

import telebot
from flask import Flask
from telebot.types import ReplyKeyboardMarkup, KeyboardButton

TOKEN = os.getenv("BOT_TOKEN")
if not TOKEN:
    raise ValueError("BOT_TOKEN не знайдено")

ADMIN_ID = 8354810202

CARD_NUMBER = "4149511021669346"
CRYPTO_WALLET = "TT9MENYikZyNRLEcR1xJWn7b4gaP6XvFvt"
CRYPTO_NETWORK = "USDT TRC20"
SELLER_NAME = "Кнур"

PRICE_PER_GRAM = 24.0

bot = telebot.TeleBot(TOKEN)
user_state = {}

# ---------- WEB FOR RENDER ----------
app = Flask(__name__)

@app.route("/")
def home():
    return "Bot is running"

def run_web():
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)

Thread(target=run_web).start()

# ---------- DB ----------
conn = sqlite3.connect("data.db", check_same_thread=False)
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY,
    bought REAL DEFAULT 0,
    sold REAL DEFAULT 0,
    personal REAL DEFAULT 0,
    spent REAL DEFAULT 0,
    revenue REAL DEFAULT 0
)
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT,
    created_at TEXT
)
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    grams REAL,
    total REAL,
    comment TEXT,
    payment TEXT,
    status TEXT,
    created_at TEXT
)
""")

if cur.execute("SELECT COUNT(*) FROM stats").fetchone()[0] == 0:
    cur.execute("INSERT INTO stats (id,bought,sold,personal,spent,revenue) VALUES (1,0,0,0,0,0)")
    conn.commit()

def add_journal(text):
    cur.execute(
        "INSERT INTO journal (text, created_at) VALUES (?, ?)",
        (text, datetime.now().strftime("%d.%m.%Y %H:%M"))
    )
    conn.commit()

# ---------- MENUS ----------
def client_menu():
    kb = ReplyKeyboardMarkup(resize_keyboard=True)
    kb.add("🛒 Замовити")
    kb.add("💳 Оплата", "📦 Мої замовлення")
    kb.add("📞 Звʼязок")
    return kb

def admin_menu():
    kb = ReplyKeyboardMarkup(resize_keyboard=True)
    kb.add("🛒 Замовити", "📬 Замовлення")
    kb.add("📦 Закупівля", "💰 Продаж")
    kb.add("🍵 Особисте", "📊 Статистика")
    kb.add("📋 Журнал", "🧹 Очистити")
    return kb

def menu_for(user_id):
    return admin_menu() if user_id == ADMIN_ID else client_menu()

# ---------- START ----------
@bot.message_handler(commands=["start"])
def start(message):
    if message.from_user.id == ADMIN_ID:
        bot.send_message(
            message.chat.id,
            "🍵 MatchaTea CRM\n\nАдмін меню 👇",
            reply_markup=admin_menu()
        )
    else:
        bot.send_message(
            message.chat.id,
            "🍵 Вітаємо в MatchaTea!\n\nОберіть дію 👇",
            reply_markup=client_menu()
        )

# ---------- CLIENT ORDER ----------
@bot.message_handler(func=lambda m: m.text == "🛒 Замовити")
def order_start(message):
    user_state[message.chat.id] = {"action": "order_grams"}
    bot.send_message(message.chat.id, "⚖️ Скільки грам хочете замовити?")

@bot.message_handler(func=lambda m: m.text == "💳 Оплата")
def payment_info(message):
    bot.send_message(
        message.chat.id,
        f"""💳 Оплата на карту:
`{CARD_NUMBER}`

🪙 Крипта:
`{CRYPTO_WALLET}`

Мережа: {CRYPTO_NETWORK}

Після оплати скиньте квитанцію або хеш транзакції в бот.""",
        parse_mode="Markdown"
    )

@bot.message_handler(func=lambda m: m.text == "📦 Мої замовлення")
def my_orders(message):
    rows = cur.execute(
        "SELECT id, grams, total, payment, status, created_at FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 10",
        (message.from_user.id,)
    ).fetchall()

    if not rows:
        bot.send_message(message.chat.id, "У вас ще немає замовлень.")
        return

    text = "📦 Ваші замовлення:\n\n"
    for r in rows:
        text += f"#{r[0]} — {r[1]} г / {r[2]} грн / {r[3]} / {r[4]} / {r[5]}\n"

    bot.send_message(message.chat.id, text)

@bot.message_handler(func=lambda m: m.text == "📞 Звʼязок")
def contact(message):
    bot.send_message(message.chat.id, "📞 Напишіть сюди повідомлення — адмін отримає його.")

# ---------- ADMIN ----------
@bot.message_handler(func=lambda m: m.text == "📬 Замовлення")
def admin_orders(message):
    if message.from_user.id != ADMIN_ID:
        return

    rows = cur.execute(
        "SELECT id, username, grams, total, payment, status, created_at, comment FROM orders ORDER BY id DESC LIMIT 10"
    ).fetchall()

    if not rows:
        bot.send_message(message.chat.id, "Замовлень ще немає.")
        return

    text = "📬 Останні замовлення:\n\n"
    for r in rows:
        text += (
            f"#{r[0]}\n"
            f"👤 @{r[1]}\n"
            f"⚖️ {r[2]} г\n"
            f"💵 {r[3]} грн\n"
            f"💳 {r[4]}\n"
            f"📌 {r[5]}\n"
            f"🕒 {r[6]}\n"
            f"📝 {r[7]}\n\n"
        )

    bot.send_message(message.chat.id, text)

@bot.message_handler(func=lambda m: m.text == "📦 Закупівля")
def buy_start(message):
    if message.from_user.id != ADMIN_ID:
        return
    user_state[message.chat.id] = {"action": "buy_g"}
    bot.send_message(message.chat.id, "📦 Скільки грам закупив?")

@bot.message_handler(func=lambda m: m.text == "💰 Продаж")
def sell_start(message):
    if message.from_user.id != ADMIN_ID:
        return
    user_state[message.chat.id] = {"action": "sell_g"}
    bot.send_message(message.chat.id, f"💰 Скільки грам продав {SELLER_NAME}?")

@bot.message_handler(func=lambda m: m.text == "🍵 Особисте")
def personal_start(message):
    if message.from_user.id != ADMIN_ID:
        return
    user_state[message.chat.id] = {"action": "personal_g"}
    bot.send_message(message.chat.id, "🍵 Скільки грам забрав собі?")

@bot.message_handler(func=lambda m: m.text == "📊 Статистика")
def stats(message):
    if message.from_user.id != ADMIN_ID:
        return

    s = cur.execute("SELECT bought, sold, personal, spent, revenue FROM stats WHERE id=1").fetchone()
    bought, sold, personal, spent, revenue = s

    left = bought - sold - personal
    avg_buy = spent / bought if bought else 0
    avg_sell = revenue / sold if sold else PRICE_PER_GRAM
    cost_sold = sold * avg_buy
    profit = revenue - cost_sold

    left_buy_value = left * avg_buy
    left_sell_value = left * avg_sell
    potential_profit = left_sell_value - left_buy_value

    text = f"""
📊 Статистика

🏪 Склад:
├ Закуплено: {bought:.2f} г
├ Продано: {sold:.2f} г
├ Особисте: {personal:.2f} г
└ Залишок: {left:.2f} г

💵 Фінанси:
├ Витрачено: {spent:.2f} грн
├ Виручка: {revenue:.2f} грн
├ Середня закупка: {avg_buy:.2f} грн/г
├ Середній продаж: {avg_sell:.2f} грн/г
├ Собівартість проданого: {cost_sold:.2f} грн
├ Прибуток реалізований: {profit:+.2f} грн
└ Потенційний прибуток із залишку: {potential_profit:+.2f} грн

👤 Продавець:
└ {SELLER_NAME}

💼 Баланс:
├ Вкладено своїх ще не відбито: {max(spent - revenue, 0):.2f} грн
└ Загальний капітал: {(revenue + left_buy_value - spent):+.2f} грн
"""
    bot.send_message(message.chat.id, text)

@bot.message_handler(func=lambda m: m.text == "📋 Журнал")
def journal(message):
    if message.from_user.id != ADMIN_ID:
        return

    rows = cur.execute("SELECT text, created_at FROM journal ORDER BY id DESC LIMIT 30").fetchall()
    if not rows:
        bot.send_message(message.chat.id, "📋 Журнал порожній")
        return

    text = "📋 Журнал:\n\n"
    for r in rows:
        text += f"{r[1]} — {r[0]}\n"

    bot.send_message(message.chat.id, text)

@bot.message_handler(func=lambda m: m.text == "🧹 Очистити")
def clear_data(message):
    if message.from_user.id != ADMIN_ID:
        return

    cur.execute("UPDATE stats SET bought=0,sold=0,personal=0,spent=0,revenue=0 WHERE id=1")
    cur.execute("DELETE FROM journal")
    cur.execute("DELETE FROM orders")
    conn.commit()

    bot.send_message(message.chat.id, "🧹 Дані очищено", reply_markup=admin_menu())

# ---------- STATE HANDLER ----------
@bot.message_handler(content_types=["text", "photo", "document"])
def handle(message):
    chat_id = message.chat.id

    # receipt / proof
    if chat_id in user_state and user_state[chat_id].get("action") == "wait_receipt":
        order_id = user_state[chat_id]["order_id"]

        bot.send_message(
            ADMIN_ID,
            f"🧾 Квитанція по замовленню #{order_id}\n"
            f"👤 @{message.from_user.username}\n"
            f"🆔 {message.from_user.id}"
        )

        try:
            bot.forward_message(ADMIN_ID, chat_id, message.message_id)
        except:
            bot.send_message(ADMIN_ID, "Не вдалося переслати квитанцію.")

        cur.execute("UPDATE orders SET status=? WHERE id=?", ("Оплата на перевірці", order_id))
        conn.commit()

        bot.send_message(chat_id, "✅ Квитанцію отримано. Адмін перевірить оплату.")
        user_state.pop(chat_id)
        return

    if chat_id not in user_state:
        if message.from_user.id != ADMIN_ID and message.text:
            bot.send_message(
                ADMIN_ID,
                f"📩 Повідомлення від клієнта @{message.from_user.username}:\n\n{message.text}"
            )
            bot.send_message(chat_id, "✅ Повідомлення передано адміну.")
        else:
            bot.send_message(chat_id, "Оберіть дію в меню 👇", reply_markup=menu_for(message.from_user.id))
        return

    state = user_state[chat_id]
    text = (message.text or "").replace(",", ".")

    # order flow
    if state["action"] == "order_grams":
        try:
            grams = float(text)
            if grams <= 0:
                raise ValueError
        except:
            bot.send_message(chat_id, "Введіть кількість грам числом.")
            return

        state["grams"] = grams
        state["total"] = grams * PRICE_PER_GRAM
        state["action"] = "order_comment"

        bot.send_message(
            chat_id,
            f"✅ {grams} г = {state['total']:.2f} грн\n\n"
            f"Напишіть адресу/коментар до замовлення:"
        )
        return

    if state["action"] == "order_comment":
        state["comment"] = message.text

        kb = ReplyKeyboardMarkup(resize_keyboard=True)
        kb.add("💳 Карта", "🪙 Крипта")

        state["action"] = "order_payment"
        bot.send_message(chat_id, "Оберіть спосіб оплати:", reply_markup=kb)
        return

    if state["action"] == "order_payment":
        if message.text not in ["💳 Карта", "🪙 Крипта"]:
            bot.send_message(chat_id, "Оберіть кнопку: карта або крипта.")
            return

        payment = "Карта" if message.text == "💳 Карта" else CRYPTO_NETWORK

        username = message.from_user.username or "no_username"
        grams = state["grams"]
        total = state["total"]
        comment = state["comment"]
        created_at = datetime.now().strftime("%d.%m.%Y %H:%M")

        cur.execute("""
            INSERT INTO orders (user_id, username, grams, total, comment, payment, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            message.from_user.id,
            username,
            grams,
            total,
            comment,
            payment,
            "Очікує оплату",
            created_at
        ))
        conn.commit()

        order_id = cur.lastrowid

        bot.send_message(
            ADMIN_ID,
            f"""🛒 Нове замовлення #{order_id}

👤 @{username}
🆔 {message.from_user.id}
⚖️ {grams} г
💵 {total:.2f} грн
💳 Оплата: {payment}
📝 Коментар: {comment}

📌 Статус: очікує оплату"""
        )

        if payment == "Карта":
            pay_text = f"""
✅ Замовлення #{order_id} створено

💵 До оплати: {total:.2f} грн
💳 Карта:
`{CARD_NUMBER}`

Після оплати скиньте квитанцію сюди в бот.
"""
        else:
            pay_text = f"""
✅ Замовлення #{order_id} створено

💵 Сума: {total:.2f} грн
🪙 Гаманець:
`{CRYPTO_WALLET}`

Мережа: {CRYPTO_NETWORK}

Після оплати скиньте хеш транзакції або скрін сюди в бот.
"""

        bot.send_message(chat_id, pay_text, parse_mode="Markdown")
        user_state[chat_id] = {"action": "wait_receipt", "order_id": order_id}
        return

    # admin business flow
    if message.from_user.id != ADMIN_ID:
        return

    try:
        value = float(text)
    except:
        bot.send_message(chat_id, "Введіть число.")
        return

    if state["action"] == "buy_g":
        state["grams"] = value
        state["action"] = "buy_sum"
        bot.send_message(chat_id, "На яку суму закупив? грн")
        return

    if state["action"] == "buy_sum":
        grams = state["grams"]
        money = value

        cur.execute("UPDATE stats SET bought=bought+?, spent=spent+? WHERE id=1", (grams, money))
        add_journal(f"📦 Закупівля: {grams} г на {money} грн")
        conn.commit()

        user_state.pop(chat_id)
        bot.send_message(chat_id, f"✅ Закупівля додана: {grams} г / {money} грн", reply_markup=admin_menu())
        return

    if state["action"] == "sell_g":
        state["grams"] = value
        state["action"] = "sell_sum"
        bot.send_message(chat_id, "На яку суму продав? грн")
        return

    if state["action"] == "sell_sum":
        grams = state["grams"]
        money = value

        cur.execute("UPDATE stats SET sold=sold+?, revenue=revenue+? WHERE id=1", (grams, money))
        add_journal(f"💰 Продаж ({SELLER_NAME}): {grams} г на {money} грн")
        conn.commit()

        user_state.pop(chat_id)
        bot.send_message(chat_id, f"✅ Продаж Кнура додано: {grams} г / {money} грн", reply_markup=admin_menu())
        return

    if state["action"] == "personal_g":
        cur.execute("UPDATE stats SET personal=personal+? WHERE id=1", (value,))
        add_journal(f"🍵 Особисте: {value} г")
        conn.commit()

        user_state.pop(chat_id)
        bot.send_message(chat_id, f"✅ Особисте додано: {value} г", reply_markup=admin_menu())
        return

print("Bot started...")
bot.infinity_polling(skip_pending=True)
