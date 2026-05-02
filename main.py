import os
import telebot
from flask import Flask
from threading import Thread

TOKEN = os.getenv("BOT_TOKEN")
if not TOKEN:
    raise ValueError("BOT_TOKEN не знайдено")

bot = telebot.TeleBot(TOKEN)

app = Flask(__name__)

@app.route("/")
def home():
    return "Bot is running"

def run_web():
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)

Thread(target=run_web).start()

@bot.message_handler(commands=["start"])
def start(message):
    bot.send_message(message.chat.id, "✅ Бот працює на Render")

@bot.message_handler(func=lambda message: True)
def echo(message):
    bot.send_message(message.chat.id, message.text)

print("Bot started...")
bot.infinity_polling(skip_pending=True)
