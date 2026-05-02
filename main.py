import os
import json
import ast
import operator
from datetime import datetime
from threading import Thread

import telebot
from flask import Flask
from telebot.types import ReplyKeyboardMarkup

TOKEN = os.getenv("BOT_TOKEN")
if not TOKEN:
    raise ValueError("BOT_TOKEN не знайдено. Додай BOT_TOKEN у Render Environment Variables.")

ADMIN_ID = int(os.getenv("ADMIN_ID", "8354810202"))

bot = telebot.TeleBot(TOKEN, parse_mode="HTML")

DATA_FILE = "business_data.json"
states = {}

# ---------- WEB ДЛЯ RENDER ----------
app = Flask(__name__)

@app.route("/")
def home():
    return "Business accounting bot is running"

def run_web():
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)

Thread(target=run_web, daemon=True).start()

# ---------- ДАНІ ----------
def empty_data():
    return {
        "bought_g": 0.0,
        "sold_g": 0.0,
        "personal_g": 0.0,

        "spent_goods": 0.0,
        "revenue": 0.0,
        "expenses": 0.0,
        "cash_taken": 0.0,

        "knur_taken_g": 0.0,
        "knur_sold_g": 0.0,
        "knur_returned_g": 0.0,
        "knur_money": 0.0,

        "operations": [],
        "journal": []
    }

def load_data():
    if not os.path.exists(DATA_FILE):
        return empty_data()
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            old = json.load(f)
        base = empty_data()
        base.update(old)
        return base
    except Exception:
        return empty_data()

data = load_data()

def save_data():
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def now():
    return datetime.now().strftime("%d.%m.%Y %H:%M")

def today():
    return datetime.now().strftime("%d.%m")

def is_admin(message):
    return message.from_user and message.from_user.id == ADMIN_ID

def add_operation(kind, amount=0.0, grams=0.0, text=""):
    op = {
        "time": now(),
        "day": today(),
        "kind": kind,
        "amount": float(amount),
        "grams": float(grams),
        "text": text
    }
    data["operations"].append(op)
    data["operations"] = data["operations"][-1000:]

    data["journal"].append(f"{op['time']} — {text}")
    data["journal"] = data["journal"][-200:]
    save_data()

def avg_buy_price():
    return data["spent_goods"] / data["bought_g"] if data["bought_g"] else 0.0

def avg_sell_price():
    return data["revenue"] / data["sold_g"] if data["sold_g"] else 0.0

def stock_left():
    return data["bought_g"] - data["sold_g"] - data["personal_g"] - data["knur_taken_g"] + data["knur_returned_g"]

def knur_left():
    return data["knur_taken_g"] - data["knur_sold_g"] - data["knur_returned_g"]

def gross_profit():
    return data["revenue"] - (data["sold_g"] * avg_buy_price())

def net_profit():
    return gross_profit() - data["expenses"]

# ---------- МЕНЮ ----------
def menu():
    kb = ReplyKeyboardMarkup(resize_keyboard=True)

    kb.row("📊 Загальна статистика")
    kb.row("📦 Закупівля", "💰 Мій продаж")

    kb.row("👤 Кнур взяв", "💰 Кнур продав")
    kb.row("💵 Кнур приніс", "↩️ Кнур повернув")
    kb.row("📊 Кнур статистика")

    kb.row("🍵 Забрав собі", "💸 Витрата")
    kb.row("🏧 Забрав гроші", "📈 Графік прибутку")
    kb.row("🧮 Калькулятор", "📋 Журнал")
    kb.row("🔄 Скинути дію", "🧹 Очистити все")

    return kb

# ---------- START ----------
@bot.message_handler(commands=["start"])
def start(message):
    if not is_admin(message):
        bot.send_message(message.chat.id, "⛔ Доступ закритий.")
        return

    bot.send_message(
        message.chat.id,
        """📒 <b>Бухгалтерія MatchaTea</b>

✅ Автопідрахунок закупки
✅ Автопідрахунок продажів
✅ Окремий облік Кнура
✅ Прибуток, склад, каса
✅ Журнал операцій
✅ Графік прибутку

Обери дію 👇""",
        reply_markup=menu()
    )

# ---------- СТАТИСТИКА ----------
@bot.message_handler(func=lambda m: "Загальна статистика" in (m.text or ""))
def stats(message):
    if not is_admin(message): return

    bought = data["bought_g"]
    sold = data["sold_g"]
    personal = data["personal_g"]
    spent = data["spent_goods"]
    revenue = data["revenue"]
    expenses = data["expenses"]
    cash = data["cash_taken"]

    left = stock_left()
    avg_buy = avg_buy_price()
    avg_sell = avg_sell_price()

    sold_cost = sold * avg_buy
    personal_cost = personal * avg_buy
    left_cost = left * avg_buy
    g_profit = revenue - sold_cost
    n_profit = g_profit - expenses
    cash_box = revenue - expenses - cash

    potential_sell = left * avg_sell if avg_sell else 0
    potential_profit = potential_sell - left_cost

    text = f"""
📊 <b>ЗАГАЛЬНА СТАТИСТИКА</b>

🏪 <b>СКЛАД</b>
├ Закуплено: <b>{bought:.2f} г</b>
├ Продано тобою + Кнуром: <b>{sold:.2f} г</b>
├ Забрав собі: <b>{personal:.2f} г</b>
├ У Кнура зараз: <b>{knur_left():.2f} г</b>
└ На твоєму складі: <b>{left:.2f} г</b>

💵 <b>ГРОШІ</b>
├ Витрачено на товар: <b>{spent:.2f} грн</b>
├ Виручка: <b>{revenue:.2f} грн</b>
├ Інші витрати: <b>{expenses:.2f} грн</b>
├ Забрав гроші собі: <b>{cash:.2f} грн</b>
└ Каса після витрат/зняття: <b>{cash_box:.2f} грн</b>

📈 <b>ЦІНИ І ПРИБУТОК</b>
├ Середня закупка: <b>{avg_buy:.2f} грн/г</b>
├ Середній продаж: <b>{avg_sell:.2f} грн/г</b>
├ Собівартість проданого: <b>{sold_cost:.2f} грн</b>
├ Валовий прибуток: <b>{g_profit:+.2f} грн</b>
└ Чистий прибуток: <b>{n_profit:+.2f} грн</b>

🍵 <b>ОСОБИСТЕ</b>
├ Забрав товару: <b>{personal:.2f} г</b>
└ Собівартість особистого: <b>{personal_cost:.2f} грн</b>

📦 <b>ЗАЛИШОК</b>
├ Собівартість залишку: <b>{left_cost:.2f} грн</b>
├ Потенційна продажна вартість: <b>{potential_sell:.2f} грн</b>
└ Потенційний прибуток: <b>{potential_profit:+.2f} грн</b>

💼 <b>БАЛАНС</b>
├ Ще не відбито вкладених: <b>{max(spent + expenses - revenue, 0):.2f} грн</b>
└ Капітал бізнесу: <b>{(cash_box + left_cost):+.2f} грн</b>
"""
    bot.send_message(message.chat.id, text, reply_markup=menu())

@bot.message_handler(func=lambda m: "Кнур статистика" in (m.text or ""))
def knur_stats(message):
    if not is_admin(message): return

    avg_buy = avg_buy_price()
    knur_sold_cost = data["knur_sold_g"] * avg_buy
    knur_profit = data["knur_money"] - knur_sold_cost

    text = f"""
👤 <b>КНУР</b>

📦 <b>Товар</b>
├ Взяв: <b>{data["knur_taken_g"]:.2f} г</b>
├ Продав: <b>{data["knur_sold_g"]:.2f} г</b>
├ Повернув: <b>{data["knur_returned_g"]:.2f} г</b>
└ Залишок у Кнура: <b>{knur_left():.2f} г</b>

💵 <b>Гроші</b>
├ Приніс: <b>{data["knur_money"]:.2f} грн</b>
├ Собівартість проданого: <b>{knur_sold_cost:.2f} грн</b>
└ Прибуток від Кнура: <b>{knur_profit:+.2f} грн</b>

📌 Якщо Кнур продав товар, натискай:
<b>💰 Кнур продав</b> → грами → сума
"""
    bot.send_message(message.chat.id, text, reply_markup=menu())

# ---------- ГРАФІК ----------
@bot.message_handler(func=lambda m: "Графік прибутку" in (m.text or ""))
def profit_chart(message):
    if not is_admin(message): return

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception:
        bot.send_message(
            message.chat.id,
            "❌ Для графіків треба додати matplotlib у requirements.txt:\n\n<code>matplotlib==3.10.3</code>"
        )
        return

    if not data["operations"]:
        bot.send_message(message.chat.id, "Поки немає даних для графіка.")
        return

    days = []
    revenue_by_day = {}
    expense_by_day = {}
    profit_by_day = {}

    avg_buy = avg_buy_price()

    for op in data["operations"]:
        d = op.get("day", "")
        if d not in days:
            days.append(d)
        revenue_by_day.setdefault(d, 0)
        expense_by_day.setdefault(d, 0)
        profit_by_day.setdefault(d, 0)

        kind = op.get("kind")
        amount = float(op.get("amount", 0))
        grams = float(op.get("grams", 0))

        if kind in ["sale", "knur_sale"]:
            revenue_by_day[d] += amount
            profit_by_day[d] += amount - (grams * avg_buy)
        elif kind in ["expense"]:
            expense_by_day[d] += amount
            profit_by_day[d] -= amount
        elif kind in ["buy"]:
            expense_by_day[d] += amount

    y_profit = [profit_by_day[d] for d in days]
    y_revenue = [revenue_by_day[d] for d in days]
    y_expense = [expense_by_day[d] for d in days]

    plt.figure(figsize=(10, 5))
    plt.plot(days, y_profit, marker="o", label="Прибуток")
    plt.plot(days, y_revenue, marker="o", label="Виручка")
    plt.plot(days, y_expense, marker="o", label="Витрати/закупки")
    plt.title("Графік прибутку")
    plt.xlabel("Дата")
    plt.ylabel("грн")
    plt.xticks(rotation=30)
    plt.legend()
    plt.tight_layout()

    path = "profit_chart.png"
    plt.savefig(path, dpi=160)
    plt.close()

    with open(path, "rb") as photo:
        bot.send_photo(message.chat.id, photo, caption="📈 Графік прибутку / виручки / витрат")

# ---------- КНОПКИ ДІЙ ----------
def set_state(message, action):
    states[message.chat.id] = {"action": action}

@bot.message_handler(func=lambda m: "Закупівля" in (m.text or ""))
def buy_start(message):
    if not is_admin(message): return
    set_state(message, "buy_g")
    bot.send_message(message.chat.id, "📦 Скільки грам закупив?")

@bot.message_handler(func=lambda m: "Мій продаж" in (m.text or ""))
def sell_start(message):
    if not is_admin(message): return
    set_state(message, "sell_g")
    bot.send_message(message.chat.id, "💰 Скільки грам продав ти?")

@bot.message_handler(func=lambda m: "Кнур взяв" in (m.text or ""))
def knur_take_start(message):
    if not is_admin(message): return
    set_state(message, "knur_take")
    bot.send_message(message.chat.id, "👤 Скільки грам дав Кнуру?")

@bot.message_handler(func=lambda m: "Кнур продав" in (m.text or ""))
def knur_sell_start(message):
    if not is_admin(message): return
    set_state(message, "knur_sell_g")
    bot.send_message(message.chat.id, "💰 Скільки грам продав Кнур?")

@bot.message_handler(func=lambda m: "Кнур приніс" in (m.text or ""))
def knur_money_start(message):
    if not is_admin(message): return
    set_state(message, "knur_money_only")
    bot.send_message(message.chat.id, "💵 Скільки грошей Кнур приніс без уточнення грам?")

@bot.message_handler(func=lambda m: "Кнур повернув" in (m.text or ""))
def knur_return_start(message):
    if not is_admin(message): return
    set_state(message, "knur_return")
    bot.send_message(message.chat.id, "↩️ Скільки грам Кнур повернув?")

@bot.message_handler(func=lambda m: "Забрав собі" in (m.text or ""))
def personal_start(message):
    if not is_admin(message): return
    set_state(message, "personal")
    bot.send_message(message.chat.id, "🍵 Скільки грам забрав собі?")

@bot.message_handler(func=lambda m: "Витрата" in (m.text or ""))
def expense_start(message):
    if not is_admin(message): return
    set_state(message, "expense_sum")
    bot.send_message(message.chat.id, "💸 Сума витрати?")

@bot.message_handler(func=lambda m: "Забрав гроші" in (m.text or ""))
def cash_start(message):
    if not is_admin(message): return
    set_state(message, "cash")
    bot.send_message(message.chat.id, "🏧 Скільки грошей забрав з каси?")

@bot.message_handler(func=lambda m: "Журнал" in (m.text or ""))
def journal(message):
    if not is_admin(message): return

    if not data["journal"]:
        bot.send_message(message.chat.id, "📋 Журнал порожній.", reply_markup=menu())
        return

    text = "📋 <b>ОСТАННІ ОПЕРАЦІЇ</b>\n\n" + "\n".join(data["journal"][-30:])
    bot.send_message(message.chat.id, text, reply_markup=menu())

@bot.message_handler(func=lambda m: "Калькулятор" in (m.text or ""))
def calc_start(message):
    if not is_admin(message): return
    set_state(message, "calc")
    bot.send_message(
        message.chat.id,
        """🧮 <b>Калькулятор</b>

Напиши приклад:
<code>500*24</code>
<code>13000/1500</code>
<code>24000-9000</code>"""
    )

@bot.message_handler(func=lambda m: "Скинути" in (m.text or ""))
def reset(message):
    if not is_admin(message): return
    states.pop(message.chat.id, None)
    bot.send_message(message.chat.id, "🔄 Дію скинуто.", reply_markup=menu())

@bot.message_handler(func=lambda m: "Очистити" in (m.text or ""))
def clear_start(message):
    if not is_admin(message): return
    states[message.chat.id] = {"action": "confirm_clear"}
    bot.send_message(message.chat.id, "⚠️ Щоб очистити ВСЕ, напиши: <b>ОЧИСТИТИ</b>")

# ---------- БЕЗПЕЧНИЙ КАЛЬКУЛЯТОР ----------
allowed_ops = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.USub: operator.neg,
}

def safe_eval(expr):
    def eval_node(node):
        if isinstance(node, ast.Num):
            return node.n
        if isinstance(node, ast.Expression):
            return eval_node(node.body)
        if isinstance(node, ast.BinOp):
            return allowed_ops[type(node.op)](eval_node(node.left), eval_node(node.right))
        if isinstance(node, ast.UnaryOp):
            return allowed_ops[type(node.op)](eval_node(node.operand))
        raise ValueError("bad expression")
    return eval_node(ast.parse(expr, mode="eval"))

# ---------- ОБРОБКА ВВОДУ ----------
@bot.message_handler(func=lambda m: True)
def handle(message):
    if not is_admin(message):
        bot.send_message(message.chat.id, "⛔ Доступ закритий.")
        return

    chat_id = message.chat.id
    text = (message.text or "").strip().replace(",", ".")

    if chat_id not in states:
        bot.send_message(chat_id, "Обери дію в меню 👇", reply_markup=menu())
        return

    state = states[chat_id]
    action = state["action"]

    if action == "confirm_clear":
        if message.text == "ОЧИСТИТИ":
            global data
            data = empty_data()
            save_data()
            states.pop(chat_id, None)
            bot.send_message(chat_id, "🧹 Всі дані очищено.", reply_markup=menu())
        else:
            states.pop(chat_id, None)
            bot.send_message(chat_id, "Очищення скасовано.", reply_markup=menu())
        return

    if action == "calc":
        try:
            result = safe_eval(text)
            states.pop(chat_id, None)
            bot.send_message(chat_id, f"🧮 Результат:\n<b>{text} = {result}</b>", reply_markup=menu())
        except Exception:
            bot.send_message(chat_id, "❌ Не можу порахувати. Приклад: 500*24")
        return

    try:
        value = float(text)
    except Exception:
        bot.send_message(chat_id, "❌ Введи число. Наприклад: 500 або 12000")
        return

    if value < 0:
        bot.send_message(chat_id, "❌ Число не може бути мінусовим.")
        return

    if action == "buy_g":
        state["grams"] = value
        state["action"] = "buy_sum"
        bot.send_message(chat_id, "💵 На яку суму закупив? грн")
        return

    if action == "buy_sum":
        grams = state["grams"]
        money = value
        unit_price = money / grams if grams else 0

        data["bought_g"] += grams
        data["spent_goods"] += money

        add_operation("buy", amount=money, grams=grams, text=f"📦 Закупівля: {grams:.2f} г на {money:.2f} грн ({unit_price:.2f} грн/г)")

        states.pop(chat_id, None)
        bot.send_message(
            chat_id,
            f"✅ Закупівля додана\n\n📦 {grams:.2f} г\n💵 {money:.2f} грн\n📌 Автоціна: <b>{unit_price:.2f} грн/г</b>",
            reply_markup=menu()
        )
        return

    if action == "sell_g":
        state["grams"] = value
        state["action"] = "sell_sum"
        bot.send_message(chat_id, "💵 На яку суму продав? грн")
        return

    if action == "sell_sum":
        grams = state["grams"]
        money = value
        unit_price = money / grams if grams else 0

        if grams > stock_left():
            bot.send_message(chat_id, f"⚠️ Увага: на твоєму складі тільки {stock_left():.2f} г. Але я все одно додам.")

        data["sold_g"] += grams
        data["revenue"] += money

        add_operation("sale", amount=money, grams=grams, text=f"💰 Мій продаж: {grams:.2f} г на {money:.2f} грн ({unit_price:.2f} грн/г)")

        states.pop(chat_id, None)
        bot.send_message(
            chat_id,
            f"✅ Продаж додано\n\n💰 {grams:.2f} г\n💵 {money:.2f} грн\n📌 Автоціна: <b>{unit_price:.2f} грн/г</b>",
            reply_markup=menu()
        )
        return

    if action == "knur_take":
        if value > stock_left():
            bot.send_message(chat_id, f"⚠️ Увага: на твоєму складі тільки {stock_left():.2f} г. Але я все одно додам.")

        data["knur_taken_g"] += value
        add_operation("knur_take", grams=value, text=f"👤 Кнур взяв: {value:.2f} г")

        states.pop(chat_id, None)
        bot.send_message(chat_id, f"✅ Записано: Кнур взяв {value:.2f} г", reply_markup=menu())
        return

    if action == "knur_sell_g":
        state["grams"] = value
        state["action"] = "knur_sell_sum"
        bot.send_message(chat_id, "💵 На яку суму продав Кнур? грн")
        return

    if action == "knur_sell_sum":
        grams = state["grams"]
        money = value
        unit_price = money / grams if grams else 0

        if grams > knur_left():
            bot.send_message(chat_id, f"⚠️ Увага: у Кнура по обліку тільки {knur_left():.2f} г. Але я все одно додам.")

        data["knur_sold_g"] += grams
        data["sold_g"] += grams
        data["knur_money"] += money
        data["revenue"] += money

        add_operation("knur_sale", amount=money, grams=grams, text=f"💰 Кнур продав: {grams:.2f} г на {money:.2f} грн ({unit_price:.2f} грн/г)")

        states.pop(chat_id, None)
        bot.send_message(
            chat_id,
            f"✅ Продаж Кнура додано\n\n👤 {grams:.2f} г\n💵 {money:.2f} грн\n📌 Автоціна: <b>{unit_price:.2f} грн/г</b>",
            reply_markup=menu()
        )
        return

    if action == "knur_money_only":
        data["knur_money"] += value
        data["revenue"] += value
        add_operation("knur_money", amount=value, text=f"💵 Кнур приніс гроші без грам: {value:.2f} грн")

        states.pop(chat_id, None)
        bot.send_message(chat_id, f"✅ Записано: Кнур приніс {value:.2f} грн", reply_markup=menu())
        return

    if action == "knur_return":
        data["knur_returned_g"] += value
        add_operation("knur_return", grams=value, text=f"↩️ Кнур повернув: {value:.2f} г")

        states.pop(chat_id, None)
        bot.send_message(chat_id, f"✅ Записано: Кнур повернув {value:.2f} г", reply_markup=menu())
        return

    if action == "personal":
        if value > stock_left():
            bot.send_message(chat_id, f"⚠️ Увага: на твоєму складі тільки {stock_left():.2f} г. Але я все одно додам.")

        data["personal_g"] += value
        add_operation("personal", grams=value, text=f"🍵 Забрав собі: {value:.2f} г")

        states.pop(chat_id, None)
        bot.send_message(chat_id, f"✅ Особисте додано: {value:.2f} г", reply_markup=menu())
        return

    if action == "expense_sum":
        state["sum"] = value
        state["action"] = "expense_comment"
        bot.send_message(chat_id, "📝 Коментар до витрати? Наприклад: зарядка / доставка / пакети")
        return

    if action == "expense_comment":
        money = state["sum"]
        comment = message.text or "Без коментаря"

        data["expenses"] += money
        add_operation("expense", amount=money, text=f"💸 Витрата: {money:.2f} грн — {comment}")

        states.pop(chat_id, None)
        bot.send_message(chat_id, f"✅ Витрату додано\n💸 {money:.2f} грн\n📝 {comment}", reply_markup=menu())
        return

    if action == "cash":
        data["cash_taken"] += value
        add_operation("cash", amount=value, text=f"🏧 Забрав гроші з каси: {value:.2f} грн")

        states.pop(chat_id, None)
        bot.send_message(chat_id, f"✅ Записано: забрав {value:.2f} грн", reply_markup=menu())
        return

print("Bot started...")
bot.infinity_polling(skip_pending=True, none_stop=True)
