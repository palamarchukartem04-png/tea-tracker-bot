import os
import sqlite3
import telebot
from flask import Flask
from threading import Thread
from telebot.types import ReplyKeyboardMarkup, KeyboardButton

TOKEN = os.getenv("BOT_TOKEN")
ADMIN_ID = 8354810202

bot = telebot.TeleBot(TOKEN)

# ---------------- DB ----------------
conn = sqlite3.connect("data.db", check_same_thread=False)
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY,
    bought REAL,
    sold REAL,
    personal REAL,
    spent REAL,
    revenue REAL
)
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT
)
""")

cur.execute("""
CREATE TABLE IF NOT EXISTS sellers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    sold REAL
)
""")

if cur.execute("SELECT COUNT(*) FROM stats").fetchone()[0] == 0:
    cur.execute("INSERT INTO stats VALUES (1,0,0,0,0,0)")
    conn.commit()

# ---------------- WEB ----------------
app = Flask(__name__)

@app.route("/")
def home():
    return "Bot running"

def run_web():
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)

Thread(target=run_web).start()

# ---------------- MENU ----------------
def menu():
    kb = ReplyKeyboardMarkup(resize_keyboard=True)
    kb.add("📦 Закупівля", "💰 Продаж")
    kb.add("👥 Продавці", "📊 Статистика")
    kb.add("📋 Журнал", "🧹 Очистити")
    return kb

# ---------------- START ----------------
@bot.message_handler(commands=["start"])
def start(message):
    if message.from_user.id != ADMIN_ID:
        return
    bot.send_message(message.chat.id, "🚀 Бізнес бот запущено", reply_markup=menu())

# ---------------- SELLERS ----------------
@bot.message_handler(func=lambda m: m.text == "👥 Продавці")
def sellers(message):
    rows = cur.execute("SELECT name, sold FROM sellers").fetchall()
    if not rows:
        bot.send_message(message.chat.id, "Нема продавців")
        return

    text = "👥 Продавці:\n\n"
    for r in rows:
        text += f"{r[0]} — {r[1]} г\n"

    bot.send_message(message.chat.id, text)

# ---------------- STATS ----------------
@bot.message_handler(func=lambda m: m.text == "📊 Статистика")
def stats(message):
    s = cur.execute("SELECT * FROM stats").fetchone()

    bought, sold, personal, spent, revenue = s[1:]

    left = bought - sold - personal
    avg_buy = spent / bought if bought else 0
    avg_sell = revenue / sold if sold else 0

    profit = revenue - (sold * avg_buy)

    text = f"""
📊 Статистика

📦 Закуплено: {bought}
💰 Продано: {sold}
🍵 Особисте: {personal}
📦 Залишок: {left}

💵 Витрати: {spent}
💵 Виручка: {revenue}

📈 Прибуток: {profit}
"""
    bot.send_message(message.chat.id, text)

# ---------------- JOURNAL ----------------
@bot.message_handler(func=lambda m: m.text == "📋 Журнал")
def journal(message):
    rows = cur.execute("SELECT text FROM journal ORDER BY id DESC LIMIT 20").fetchall()
    text = "\n".join([r[0] for r in rows]) or "Порожньо"
    bot.send_message(message.chat.id, text)

# ---------------- CLEAR ----------------
@bot.message_handler(func=lambda m: m.text == "🧹 Очистити")
def clear(message):
    cur.execute("UPDATE stats SET bought=0,sold=0,personal=0,spent=0,revenue=0")
    cur.execute("DELETE FROM journal")
    cur.execute("DELETE FROM sellers")
    conn.commit()
    bot.send_message(message.chat.id, "Очищено")

print("Bot started...")
bot.infinity_polling()
