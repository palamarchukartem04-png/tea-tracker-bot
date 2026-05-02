import os, sqlite3
from datetime import datetime
from threading import Thread
import telebot
from flask import Flask
from telebot.types import ReplyKeyboardMarkup, InlineKeyboardMarkup, InlineKeyboardButton

TOKEN=os.getenv("BOT_TOKEN")
if not TOKEN: raise ValueError("BOT_TOKEN не знайдено")
ADMIN_ID=int(os.getenv("ADMIN_ID","8354810202"))
SHOP_NAME="🍵 MatchaTea"; SELLER_NAME="Кнур"
CARD_NUMBER=os.getenv("CARD_NUMBER","4149511021669346")
CRYPTO_WALLET=os.getenv("CRYPTO_WALLET","TT9MENYikZyNRLEcR1xJWn7b4gaP6XvFvt")
CRYPTO_NETWORK=os.getenv("CRYPTO_NETWORK","USDT TRC20")
DEFAULT_PRICE=float(os.getenv("PRICE_PER_GRAM","24"))
bot=telebot.TeleBot(TOKEN, parse_mode="HTML"); states={}

app=Flask(__name__)
@app.route("/")
def home(): return "MatchaTea bot is running"
def run_web():
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT",10000)))
Thread(target=run_web,daemon=True).start()

conn=sqlite3.connect("shop.db",check_same_thread=False); cur=conn.cursor()
cur.execute("CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT)")
cur.execute("""CREATE TABLE IF NOT EXISTS stats(id INTEGER PRIMARY KEY CHECK(id=1),
bought_g REAL DEFAULT 0,sold_g REAL DEFAULT 0,personal_g REAL DEFAULT 0,spent_uah REAL DEFAULT 0,revenue_uah REAL DEFAULT 0)""")
cur.execute("""CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,username TEXT,full_name TEXT,
grams REAL,price_per_g REAL,total_uah REAL,payment_method TEXT,address TEXT,receipt_type TEXT,receipt_file_id TEXT,receipt_text TEXT,status TEXT,created_at TEXT,updated_at TEXT)""")
cur.execute("CREATE TABLE IF NOT EXISTS journal(id INTEGER PRIMARY KEY AUTOINCREMENT,event_type TEXT,text TEXT,created_at TEXT)")
if cur.execute("SELECT COUNT(*) FROM stats").fetchone()[0]==0:
    cur.execute("INSERT INTO stats VALUES(1,0,0,0,0,0)")
if not cur.execute("SELECT value FROM settings WHERE key='price_per_g'").fetchone():
    cur.execute("INSERT INTO settings VALUES('price_per_g',?)",(str(DEFAULT_PRICE),))
conn.commit()

def now(): return datetime.now().strftime("%d.%m.%Y %H:%M")
def is_admin(m): return m.from_user and m.from_user.id==ADMIN_ID
def uname(u): return u.username or "без_username"
def fname(u): return (f"{u.first_name or ''} {u.last_name or ''}".strip() or "Без імені")
def price():
    r=cur.execute("SELECT value FROM settings WHERE key='price_per_g'").fetchone()
    return float(r[0]) if r else DEFAULT_PRICE
def set_price(v):
    cur.execute("INSERT OR REPLACE INTO settings VALUES('price_per_g',?)",(str(v),)); conn.commit()
def journal(t,x):
    cur.execute("INSERT INTO journal(event_type,text,created_at) VALUES(?,?,?)",(t,x,now())); conn.commit()

def client_menu():
    kb=ReplyKeyboardMarkup(resize_keyboard=True)
    kb.row("🛒 Замовити","💳 Оплата"); kb.row("📦 Мої замовлення","📞 Звʼязок")
    return kb
def admin_menu():
    kb=ReplyKeyboardMarkup(resize_keyboard=True)
    kb.row("📬 Замовлення","📊 Статистика"); kb.row("📦 Закупівля","💰 Продаж")
    kb.row("🍵 Особисте","👤 Кнур"); kb.row("💵 Ціна","📋 Журнал"); kb.row("🧹 Очистити")
    return kb
def menu(uid): return admin_menu() if uid==ADMIN_ID else client_menu()
def pay_kb():
    kb=ReplyKeyboardMarkup(resize_keyboard=True); kb.row("💳 Карта","🪙 Крипта"); kb.row("⬅️ Меню"); return kb
def order_buttons(oid):
    kb=InlineKeyboardMarkup()
    kb.row(InlineKeyboardButton("✅ Оплату підтверджено",callback_data=f"paid:{oid}"))
    kb.row(InlineKeyboardButton("📦 Передано Кнуру",callback_data=f"issued:{oid}"),InlineKeyboardButton("❌ Скасувати",callback_data=f"cancel:{oid}"))
    return kb

@bot.message_handler(commands=["start"])
def start(m):
    bot.send_message(m.chat.id, f"{SHOP_NAME}\n\n"+("🔐 Адмін меню 👇" if is_admin(m) else "Вітаємо! Оберіть дію 👇"), reply_markup=menu(m.from_user.id))

@bot.message_handler(func=lambda m:m.text=="⬅️ Меню")
def back(m): states.pop(m.chat.id,None); bot.send_message(m.chat.id,"Меню 👇",reply_markup=menu(m.from_user.id))

@bot.message_handler(func=lambda m:m.text=="🛒 Замовити")
def order_start(m): states[m.chat.id]={"a":"order_g"}; bot.send_message(m.chat.id,"⚖️ Скільки грам хочете замовити?")

@bot.message_handler(func=lambda m:m.text=="💳 Оплата")
def pay_info(m):
    bot.send_message(m.chat.id,f"💳 Карта:\n<code>{CARD_NUMBER}</code>\n\n🪙 Крипта:\n<code>{CRYPTO_WALLET}</code>\nМережа: <b>{CRYPTO_NETWORK}</b>\n\nЦіна: <b>{price():.2f} грн/г</b>")

@bot.message_handler(func=lambda m:m.text=="📦 Мої замовлення")
def my_orders(m):
    rows=cur.execute("SELECT id,grams,total_uah,payment_method,status,created_at FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 10",(m.from_user.id,)).fetchall()
    if not rows: return bot.send_message(m.chat.id,"📦 У вас ще немає замовлень.",reply_markup=client_menu())
    txt="📦 <b>Ваші замовлення:</b>\n\n"+"".join([f"#{r[0]} — {r[1]:.2f} г / {r[2]:.2f} грн / {r[3]} / <b>{r[4]}</b> / {r[5]}\n" for r in rows])
    bot.send_message(m.chat.id,txt,reply_markup=client_menu())

@bot.message_handler(func=lambda m:m.text=="📞 Звʼязок")
def contact(m): states[m.chat.id]={"a":"contact"}; bot.send_message(m.chat.id,"✍️ Напишіть повідомлення адміну:")

@bot.message_handler(func=lambda m:m.text=="📬 Замовлення")
def admin_orders(m):
    if not is_admin(m): return
    rows=cur.execute("SELECT id,username,full_name,grams,total_uah,payment_method,status,created_at,address FROM orders ORDER BY id DESC LIMIT 15").fetchall()
    if not rows: return bot.send_message(m.chat.id,"📬 Замовлень ще немає.",reply_markup=admin_menu())
    for r in rows:
        bot.send_message(m.chat.id,f"📬 <b>Замовлення #{r[0]}</b>\n👤 @{r[1]}\n🧾 {r[2]}\n⚖️ {r[3]:.2f} г\n💵 {r[4]:.2f} грн\n💳 {r[5]}\n📌 <b>{r[6]}</b>\n🕒 {r[7]}\n📍 {r[8]}",reply_markup=order_buttons(r[0]))

@bot.message_handler(func=lambda m:m.text=="📦 Закупівля")
def buy(m):
    if is_admin(m): states[m.chat.id]={"a":"buy_g"}; bot.send_message(m.chat.id,"📦 Скільки грам закупив?")
@bot.message_handler(func=lambda m:m.text=="💰 Продаж")
def sell(m):
    if is_admin(m): states[m.chat.id]={"a":"sell_g"}; bot.send_message(m.chat.id,f"💰 Скільки грам продав {SELLER_NAME}?")
@bot.message_handler(func=lambda m:m.text=="🍵 Особисте")
def personal(m):
    if is_admin(m): states[m.chat.id]={"a":"personal_g"}; bot.send_message(m.chat.id,"🍵 Скільки грам забрав собі?")
@bot.message_handler(func=lambda m:m.text=="💵 Ціна")
def price_start(m):
    if is_admin(m): states[m.chat.id]={"a":"set_price"}; bot.send_message(m.chat.id,f"Поточна ціна: {price():.2f} грн/г\nВведи нову ціну:")
@bot.message_handler(func=lambda m:m.text=="👤 Кнур")
def knur(m):
    if not is_admin(m): return
    sold,revenue=cur.execute("SELECT sold_g,revenue_uah FROM stats WHERE id=1").fetchone()
    bot.send_message(m.chat.id,f"👤 <b>{SELLER_NAME}</b>\n\nПродано: {sold:.2f} г\nВиручка: {revenue:.2f} грн",reply_markup=admin_menu())

@bot.message_handler(func=lambda m:m.text=="📊 Статистика")
def stats(m):
    if not is_admin(m): return
    bought,sold,personal,spent,revenue=cur.execute("SELECT bought_g,sold_g,personal_g,spent_uah,revenue_uah FROM stats WHERE id=1").fetchone()
    left=bought-sold-personal; avg_buy=spent/bought if bought else 0; avg_sell=revenue/sold if sold else price()
    cost=sold*avg_buy; profit=revenue-cost; left_buy=left*avg_buy; left_sell=left*avg_sell
    pending=cur.execute("SELECT COUNT(*) FROM orders WHERE status='Очікує оплату'").fetchone()[0]
    checking=cur.execute("SELECT COUNT(*) FROM orders WHERE status='Оплата на перевірці'").fetchone()[0]
    txt=f"""📊 <b>Статистика</b>

🏪 <b>Склад:</b>
├ Закуплено: {bought:.2f} г
├ Продано: {sold:.2f} г
├ Особисте: {personal:.2f} г
└ Залишок: <b>{left:.2f} г</b>

💵 <b>Фінанси:</b>
├ Витрачено: {spent:.2f} грн
├ Виручка: {revenue:.2f} грн
├ Середня закупка: {avg_buy:.2f} грн/г
├ Середній продаж: {avg_sell:.2f} грн/г
├ Собівартість проданого: {cost:.2f} грн
├ Прибуток реалізований: <b>{profit:+.2f} грн</b>
└ Потенційний прибуток: <b>{(left_sell-left_buy):+.2f} грн</b>

📬 Замовлення:
├ Очікує оплату: {pending}
└ На перевірці: {checking}

👤 Продавець: <b>{SELLER_NAME}</b>
💼 Загальний капітал: <b>{(revenue+left_buy-spent):+.2f} грн</b>"""
    bot.send_message(m.chat.id,txt,reply_markup=admin_menu())

@bot.message_handler(func=lambda m:m.text=="📋 Журнал")
def show_journal(m):
    if not is_admin(m): return
    rows=cur.execute("SELECT event_type,text,created_at FROM journal ORDER BY id DESC LIMIT 30").fetchall()
    txt="📋 <b>Журнал:</b>\n\n"+"".join([f"{r[2]} — {r[0]}: {r[1]}\n" for r in rows]) if rows else "📋 Журнал порожній."
    bot.send_message(m.chat.id,txt,reply_markup=admin_menu())

@bot.message_handler(func=lambda m:m.text=="🧹 Очистити")
def clear(m):
    if is_admin(m): states[m.chat.id]={"a":"clear"}; bot.send_message(m.chat.id,"⚠️ Для очищення напиши: ОЧИСТИТИ")

@bot.callback_query_handler(func=lambda c:True)
def cb(c):
    if c.from_user.id!=ADMIN_ID: return bot.answer_callback_query(c.id,"Нема доступу")
    act,oid_s=c.data.split(":"); oid=int(oid_s)
    row=cur.execute("SELECT user_id,grams,total_uah,status FROM orders WHERE id=?",(oid,)).fetchone()
    if not row: return bot.answer_callback_query(c.id,"Не знайдено")
    uid,grams,total,status=row
    if act=="paid":
        cur.execute("UPDATE orders SET status=?,updated_at=? WHERE id=?",("Оплату підтверджено",now(),oid))
        journal("✅ Оплата",f"Замовлення #{oid}: оплату підтверджено")
        conn.commit(); bot.send_message(uid,f"✅ Оплату по замовленню #{oid} підтверджено."); bot.answer_callback_query(c.id,"Готово")
    elif act=="issued":
        cur.execute("UPDATE orders SET status=?,updated_at=? WHERE id=?",("Передано Кнуру",now(),oid))
        cur.execute("UPDATE stats SET sold_g=sold_g+?,revenue_uah=revenue_uah+? WHERE id=1",(grams,total))
        journal("📦 Кнур",f"Замовлення #{oid}: {grams:.2f} г / {total:.2f} грн")
        conn.commit(); bot.send_message(uid,f"📦 Замовлення #{oid} передано продавцю."); bot.answer_callback_query(c.id,"Передано")
    elif act=="cancel":
        cur.execute("UPDATE orders SET status=?,updated_at=? WHERE id=?",("Скасовано",now(),oid))
        journal("❌ Скасування",f"Замовлення #{oid}")
        conn.commit(); bot.send_message(uid,f"❌ Замовлення #{oid} скасовано."); bot.answer_callback_query(c.id,"Скасовано")

@bot.message_handler(content_types=["text","photo","document"])
def handle(m):
    chat=m.chat.id
    if chat not in states:
        if not is_admin(m) and m.text:
            bot.send_message(ADMIN_ID,f"📩 Повідомлення від клієнта @{uname(m.from_user)}:\n🆔 {m.from_user.id}\n\n{m.text}")
            return bot.send_message(chat,"✅ Повідомлення передано адміну.",reply_markup=client_menu())
        return bot.send_message(chat,"Оберіть дію в меню 👇",reply_markup=menu(m.from_user.id))
    st=states[chat]; a=st["a"]; text=(m.text or "").strip().replace(",",".")
    if a=="wait_receipt":
        oid=st["oid"]; rtype="text"; fid=None; rtext=m.text or ""
        if m.photo: rtype="photo"; fid=m.photo[-1].file_id
        elif m.document: rtype="document"; fid=m.document.file_id
        cur.execute("UPDATE orders SET status=?,receipt_type=?,receipt_file_id=?,receipt_text=?,updated_at=? WHERE id=?",("Оплата на перевірці",rtype,fid,rtext,now(),oid)); conn.commit()
        bot.send_message(ADMIN_ID,f"🧾 Квитанція по замовленню #{oid}\n👤 @{uname(m.from_user)}\n🆔 {m.from_user.id}")
        try: bot.forward_message(ADMIN_ID,chat,m.message_id)
        except Exception: pass
        states.pop(chat,None); return bot.send_message(chat,"✅ Квитанцію отримано. Адмін перевірить оплату.",reply_markup=client_menu())
    if a=="contact":
        bot.send_message(ADMIN_ID,f"📩 Повідомлення від клієнта @{uname(m.from_user)}:\n🆔 {m.from_user.id}\n\n{m.text}")
        states.pop(chat,None); return bot.send_message(chat,"✅ Повідомлення передано адміну.",reply_markup=client_menu())
    if a=="order_g":
        try: g=float(text); assert g>0
        except Exception: return bot.send_message(chat,"Введіть число грам. Наприклад: 50")
        p=price(); states[chat]={"a":"order_addr","g":g,"p":p,"total":g*p}
        return bot.send_message(chat,f"✅ {g:.2f} г = <b>{g*p:.2f} грн</b>\n📍 Напишіть адресу/коментар:")
    if a=="order_addr":
        st["addr"]=m.text or "-"; st["a"]="order_pay"; return bot.send_message(chat,"Оберіть спосіб оплати:",reply_markup=pay_kb())
    if a=="order_pay":
        if m.text not in ["💳 Карта","🪙 Крипта"]: return bot.send_message(chat,"Оберіть кнопку оплати.")
        payment="Карта" if m.text=="💳 Карта" else CRYPTO_NETWORK; created=now()
        cur.execute("""INSERT INTO orders(user_id,username,full_name,grams,price_per_g,total_uah,payment_method,address,status,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)""",(m.from_user.id,uname(m.from_user),fname(m.from_user),st["g"],st["p"],st["total"],payment,st.get("addr","-"),"Очікує оплату",created,created)); conn.commit()
        oid=cur.lastrowid
        bot.send_message(ADMIN_ID,f"🛒 <b>Нове замовлення #{oid}</b>\n👤 @{uname(m.from_user)}\n🆔 {m.from_user.id}\n⚖️ {st['g']:.2f} г\n💵 {st['total']:.2f} грн\n💳 {payment}\n📍 {st.get('addr','-')}",reply_markup=order_buttons(oid))
        if payment=="Карта":
            paytxt=f"✅ Замовлення #{oid} створено\n\n💵 До оплати: <b>{st['total']:.2f} грн</b>\n💳 Карта:\n<code>{CARD_NUMBER}</code>\n\nПісля оплати скиньте квитанцію сюди."
        else:
            paytxt=f"✅ Замовлення #{oid} створено\n\n💵 Сума: <b>{st['total']:.2f} грн</b>\n🪙 Гаманець:\n<code>{CRYPTO_WALLET}</code>\nМережа: <b>{CRYPTO_NETWORK}</b>\n\nСкиньте хеш або скрін."
        states[chat]={"a":"wait_receipt","oid":oid}; return bot.send_message(chat,paytxt)
    if not is_admin(m): return
    if a=="clear":
        if m.text=="ОЧИСТИТИ":
            cur.execute("UPDATE stats SET bought_g=0,sold_g=0,personal_g=0,spent_uah=0,revenue_uah=0 WHERE id=1"); cur.execute("DELETE FROM orders"); cur.execute("DELETE FROM journal"); conn.commit()
            states.pop(chat,None); return bot.send_message(chat,"🧹 Все очищено.",reply_markup=admin_menu())
        states.pop(chat,None); return bot.send_message(chat,"Скасовано.",reply_markup=admin_menu())
    try: v=float(text)
    except Exception: return bot.send_message(chat,"Введіть число.")
    if a=="buy_g": st["g"]=v; st["a"]="buy_sum"; return bot.send_message(chat,"💵 На яку суму закупив?")
    if a=="buy_sum":
        cur.execute("UPDATE stats SET bought_g=bought_g+?,spent_uah=spent_uah+? WHERE id=1",(st["g"],v)); journal("📦 Закупівля",f"{st['g']:.2f} г / {v:.2f} грн"); conn.commit()
        states.pop(chat,None); return bot.send_message(chat,"✅ Закупівля додана",reply_markup=admin_menu())
    if a=="sell_g": st["g"]=v; st["a"]="sell_sum"; return bot.send_message(chat,"💵 На яку суму продав?")
    if a=="sell_sum":
        cur.execute("UPDATE stats SET sold_g=sold_g+?,revenue_uah=revenue_uah+? WHERE id=1",(st["g"],v)); journal("💰 Продаж",f"{SELLER_NAME}: {st['g']:.2f} г / {v:.2f} грн"); conn.commit()
        states.pop(chat,None); return bot.send_message(chat,"✅ Продаж додано",reply_markup=admin_menu())
    if a=="personal_g":
        cur.execute("UPDATE stats SET personal_g=personal_g+? WHERE id=1",(v,)); journal("🍵 Особисте",f"{v:.2f} г"); conn.commit()
        states.pop(chat,None); return bot.send_message(chat,"✅ Особисте додано",reply_markup=admin_menu())
    if a=="set_price":
        set_price(v); journal("💵 Ціна",f"{v:.2f} грн/г"); states.pop(chat,None)
        return bot.send_message(chat,f"✅ Нова ціна: {v:.2f} грн/г",reply_markup=admin_menu())

print("Bot started...")
bot.infinity_polling(skip_pending=True)
