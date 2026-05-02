import os
import json
import telebot
from flask import Flask
from threading import Thread
from telebot.types import ReplyKeyboardMarkup, KeyboardButton

TOKEN = os.getenv("BOT_TOKEN")
if not TOKEN:
    raise ValueError("BOT_TOKEN не знайдено")

bot = telebot.TeleBot(TOKEN)

DATA_FILE = "data.json"
user_state = {}

def load_data():
    if not os.path.exists(DATA_FILE):
        return {
            "bought_g": 0,
            "sold_g": 0,
            "personal_g": 0,
            "spent": 0,
            "revenue": 0,
            "journal": []
        }
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

data = load_data()

app = Flask(__name__)

@app.route("/")
def home():
    return "Bot is running"

def run_web():
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)

Thread(target=run_web).start()

def menu():
    kb = ReplyKeyboardMarkup(resize_keyboard=True)
    kb.add(KeyboardButton("📦 Закупівля"), KeyboardButton("💰 Продаж"))
    kb.add(KeyboardButton("🍵 Особисте"), KeyboardButton("📊 Статистика"))
    kb.add(KeyboardButton("📋 Журнал"), KeyboardButton("🧹 Очистити"))
    return kb

@bot.message_handler(commands=["start"])
def start(message):
    bot.send_message(
        message.chat.id,
        "✅ Бот працює на Render\n\nОбери дію 👇",
        reply_markup=menu()
    )

@bot.message_handler(func=lambda m: m.text == "📦 Закупівля")
def buy_start(message):
    user_state[message.chat.id] = {"action": "buy_g"}
    bot.send_message(message.chat.id, "Скільки грам закупив?")

@bot.message_handler(func=lambda m: m.text == "💰 Продаж")
def sell_start(message):
    user_state[message.chat.id] = {"action": "sell_g"}
    bot.send_message(message.chat.id, "Скільки грам продав?")

@bot.message_handler(func=lambda m: m.text == "🍵 Особисте")
def personal_start(message):
    user_state[message.chat.id] = {"action": "personal_g"}
    bot.send_message(message.chat.id, "Скільки грам забрав собі?")

@bot.message_handler(func=lambda m: m.text == "📊 Статистика")
def stats(message):
    bought = data["bought_g"]
    sold = data["sold_g"]
    personal = data["personal_g"]
    left = bought - sold - personal

    spent = data["spent"]
    revenue = data["revenue"]

    avg_buy = spent / bought if bought else 0
    avg_sell = revenue / sold if sold else 0

    cost_sold = sold * avg_buy
    profit = revenue - cost_sold

    left_buy_value = left * avg_buy
    left_sell_value = left * avg_sell if avg_sell else 0
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
└ Прибуток реалізований: {profit:+.2f} грн

📦 Залишок:
├ Вартість по закупці: {left_buy_value:.2f} грн
├ Вартість по продажу: {left_sell_value:.2f} грн
└ Потенційний прибуток: {potential_profit:+.2f} грн

💼 Баланс:
├ Вкладено своїх ще не відбито: {max(spent - revenue, 0):.2f} грн
└ Загальний капітал: {(revenue + left_buy_value - spent):+.2f} грн
"""
    bot.send_message(message.chat.id, text)

@bot.message_handler(func=lambda m: m.text == "📋 Журнал")
def journal(message):
    if not data["journal"]:
        bot.send_message(message.chat.id, "Журнал порожній")
        return

    text = "📋 Журнал:\n\n" + "\n".join(data["journal"][-20:])
    bot.send_message(message.chat.id, text)

@bot.message_handler(func=lambda m: m.text == "🧹 Очистити")
def clear(message):
    global data
    data = {
        "bought_g": 0,
        "sold_g": 0,
        "personal_g": 0,
        "spent": 0,
        "revenue": 0,
        "journal": []
    }
    save_data(data)
    bot.send_message(message.chat.id, "🧹 Дані очищено", reply_markup=menu())

@bot.message_handler(func=lambda m: True)
def handle(message):
    chat_id = message.chat.id
    text = message.text.replace(",", ".")

    if chat_id not in user_state:
        bot.send_message(chat_id, "Обери дію на клавіатурі 👇", reply_markup=menu())
        return

    state = user_state[chat_id]

    try:
        value = float(text)
    except:
        bot.send_message(chat_id, "Введи число")
        return

    if state["action"] == "buy_g":
        state["grams"] = value
        state["action"] = "buy_price"
        bot.send_message(chat_id, "На яку суму закупив? грн")

    elif state["action"] == "buy_price":
        grams = state["grams"]
        price = value

        data["bought_g"] += grams
        data["spent"] += price
        data["journal"].append(f"📦 Закупівля: {grams} г на {price} грн")

        save_data(data)
        user_state.pop(chat_id)

        bot.send_message(chat_id, f"✅ Закупівля додана\n{grams} г на {price} грн", reply_markup=menu())

    elif state["action"] == "sell_g":
        state["grams"] = value
        state["action"] = "sell_price"
        bot.send_message(chat_id, "На яку суму продав? грн")

    elif state["action"] == "sell_price":
        grams = state["grams"]
        price = value

        data["sold_g"] += grams
        data["revenue"] += price
        data["journal"].append(f"💰 Продаж: {grams} г на {price} грн")

        save_data(data)
        user_state.pop(chat_id)

        bot.send_message(chat_id, f"✅ Продаж додано\n{grams} г на {price} грн", reply_markup=menu())

    elif state["action"] == "personal_g":
        data["personal_g"] += value
        data["journal"].append(f"🍵 Особисте: {value} г")

        save_data(data)
        user_state.pop(chat_id)

        bot.send_message(chat_id, f"✅ Особисте додано: {value} г", reply_markup=menu())

print("Bot started...")
bot.infinity_polling(skip_pending=True)
