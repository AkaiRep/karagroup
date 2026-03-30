#!/usr/bin/env python3
"""KaraGroup — расширенная статистика."""
import sqlite3, os
from datetime import datetime, timezone, timedelta
from colorama import init, Fore, Back, Style

init(autoreset=True)

DB_PATH = os.path.join(os.path.dirname(__file__), "karagroup.db")
db = sqlite3.connect(DB_PATH)
db.row_factory = sqlite3.Row

now      = datetime.now(timezone.utc)
today    = now.strftime("%Y-%m-%d")
week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")
month_ago= (now - timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")

def q(sql, *args):
    return db.execute(sql, args).fetchone()[0]

def rows(sql, *args):
    return db.execute(sql, args).fetchall()

def fmt_money(v):
    if v is None: v = 0
    return f"{v:,.0f} ₽".replace(",", " ")

# ─── palette ────────────────────────────────────────────────────────────────
W  = Style.BRIGHT + Fore.WHITE
DIM= Style.DIM    + Fore.WHITE
G  = Style.BRIGHT + Fore.GREEN
Y  = Style.BRIGHT + Fore.YELLOW
C  = Style.BRIGHT + Fore.CYAN
M  = Style.BRIGHT + Fore.MAGENTA
R  = Style.BRIGHT + Fore.RED
B  = Style.BRIGHT + Fore.BLUE
RS = Style.RESET_ALL

def header(title):
    bar = "─" * 44
    print(f"\n{C}╭{bar}╮{RS}")
    pad = (44 - len(title)) // 2
    print(f"{C}│{RS}{' '*pad}{W}{title}{RS}{' '*(44-pad-len(title))}{C}│{RS}")
    print(f"{C}╰{bar}╯{RS}")

def row(label, value, color=W, note=""):
    note_str = f"  {DIM}{note}{RS}" if note else ""
    print(f"  {DIM}{label:<28}{RS}{color}{value}{RS}{note_str}")

def divider():
    print(f"  {DIM}{'─'*42}{RS}")

# ════════════════════════════════════════════════════════════════════
header("👥  ПОЛЬЗОВАТЕЛИ")

total    = q("SELECT COUNT(*) FROM users WHERE is_active=1")
clients  = q("SELECT COUNT(*) FROM users WHERE role='client' AND is_active=1")
workers  = q("SELECT COUNT(*) FROM users WHERE role='worker' AND is_active=1")
admins   = q("SELECT COUNT(*) FROM users WHERE role='admin'  AND is_active=1")
with_tg  = q("SELECT COUNT(*) FROM users WHERE telegram_id IS NOT NULL AND is_active=1 AND role='client'")
no_tg    = q("SELECT COUNT(*) FROM users WHERE telegram_id IS NULL AND role='client' AND is_active=1")
new_week = q("SELECT COUNT(*) FROM users WHERE role='client' AND created_at >= ?", week_ago)
new_month= q("SELECT COUNT(*) FROM users WHERE role='client' AND created_at >= ?", month_ago)
tg_pct   = round(with_tg / clients * 100) if clients else 0

row("Всего активных",         str(total),    W)
row("  Клиенты",              str(clients),  C)
row("  Воркеры",              str(workers),  M)
row("  Админы",               str(admins),   Y)
divider()
row("С Telegram",             f"{with_tg}  ({tg_pct}%)", G)
row("Без Telegram",           str(no_tg),    Y)
row("Новых за 7 дней",        str(new_week), G if new_week > 0 else DIM)
row("Новых за 30 дней",       str(new_month),G if new_month > 0 else DIM)

# ════════════════════════════════════════════════════════════════════
header("📦  ЗАКАЗЫ")

total_orders   = q("SELECT COUNT(*) FROM orders")
pending_pay    = q("SELECT COUNT(*) FROM orders WHERE status='pending_payment'")
paid           = q("SELECT COUNT(*) FROM orders WHERE status='paid'")
in_progress    = q("SELECT COUNT(*) FROM orders WHERE status='in_progress'")
completed      = q("SELECT COUNT(*) FROM orders WHERE status='completed'")
confirmed      = q("SELECT COUNT(*) FROM orders WHERE status='confirmed'")
orders_week    = q("SELECT COUNT(*) FROM orders WHERE created_at >= ?", week_ago)
orders_month   = q("SELECT COUNT(*) FROM orders WHERE created_at >= ?", month_ago)
orders_today   = q("SELECT COUNT(*) FROM orders WHERE date(created_at) = ?", today)

STATUS_COLOR = {
    "pending_payment": Y,
    "paid":            C,
    "in_progress":     B,
    "completed":       G,
    "confirmed":       M,
}
STATUS_LABEL = {
    "pending_payment": "Ожидают оплаты",
    "paid":            "Оплачены",
    "in_progress":     "В работе",
    "completed":       "Завершены",
    "confirmed":       "Подтверждены",
}

row("Всего заказов",          str(total_orders), W)
for status, cnt in [
    ("pending_payment", pending_pay),
    ("paid",            paid),
    ("in_progress",     in_progress),
    ("completed",       completed),
    ("confirmed",       confirmed),
]:
    pct = round(cnt / total_orders * 100) if total_orders else 0
    row(f"  {STATUS_LABEL[status]}", f"{cnt}  ({pct}%)", STATUS_COLOR[status])
divider()
row("Сегодня",                str(orders_today), G if orders_today > 0 else DIM)
row("За 7 дней",              str(orders_week),  G if orders_week  > 0 else DIM)
row("За 30 дней",             str(orders_month), G if orders_month > 0 else DIM)

# ════════════════════════════════════════════════════════════════════
header("💰  ВЫРУЧКА")

rev_total = q("SELECT COALESCE(SUM(price),0) FROM orders WHERE status NOT IN ('pending_payment')")
rev_week  = q("SELECT COALESCE(SUM(price),0) FROM orders WHERE status NOT IN ('pending_payment') AND created_at >= ?", week_ago)
rev_month = q("SELECT COALESCE(SUM(price),0) FROM orders WHERE status NOT IN ('pending_payment') AND created_at >= ?", month_ago)
rev_today = q("SELECT COALESCE(SUM(price),0) FROM orders WHERE status NOT IN ('pending_payment') AND date(created_at) = ?", today)
avg_order = q("SELECT COALESCE(AVG(price),0) FROM orders WHERE status NOT IN ('pending_payment')")

# website-only
rev_web   = q("SELECT COALESCE(SUM(price),0) FROM orders WHERE source='website' AND status NOT IN ('pending_payment')")
rev_tg    = q("SELECT COALESCE(SUM(price),0) FROM orders WHERE source='telegram' AND status NOT IN ('pending_payment')")
rev_fp    = q("SELECT COALESCE(SUM(price),0) FROM orders WHERE source='funpay' AND status NOT IN ('pending_payment')")

row("Всего выручки",          fmt_money(rev_total),  G)
row("Сегодня",                fmt_money(rev_today),  G if rev_today > 0 else DIM)
row("За 7 дней",              fmt_money(rev_week),   G if rev_week  > 0 else DIM)
row("За 30 дней",             fmt_money(rev_month),  G if rev_month > 0 else DIM)
row("Средний чек",            fmt_money(avg_order),  C)
divider()
row("  Сайт (website)",       fmt_money(rev_web),    C)
row("  Telegram",             fmt_money(rev_tg),     B)
row("  FunPay",               fmt_money(rev_fp),     M)

# ════════════════════════════════════════════════════════════════════
header("🏆  ТОП ВОРКЕРЫ (по завершённым заказам)")

top_workers = rows("""
    SELECT u.username, u.telegram_username,
           COUNT(o.id) as cnt,
           COALESCE(SUM(o.price),0) as total
    FROM users u
    JOIN orders o ON o.worker_id = u.id
    WHERE o.status IN ('completed','confirmed')
    GROUP BY u.id
    ORDER BY cnt DESC
    LIMIT 5
""")

if top_workers:
    medals = ["🥇", "🥈", "🥉", "  4.", "  5."]
    for i, w in enumerate(top_workers):
        tg = f"@{w['telegram_username']}" if w['telegram_username'] else ""
        line = f"{w['username']:<18} {tg:<16} {w['cnt']} заказов  {fmt_money(w['total'])}"
        print(f"  {medals[i]} {W if i==0 else RS}{line}{RS}")
else:
    print(f"  {DIM}Нет данных{RS}")

# ════════════════════════════════════════════════════════════════════
header("🛒  ТОП КЛИЕНТЫ (по сумме заказов)")

top_clients = rows("""
    SELECT u.username, u.telegram_username,
           COUNT(o.id) as cnt,
           COALESCE(SUM(o.price),0) as total
    FROM users u
    JOIN orders o ON o.telegram_user_id = u.telegram_id
    WHERE o.status NOT IN ('pending_payment') AND u.role='client'
    GROUP BY u.id
    ORDER BY total DESC
    LIMIT 5
""")

if top_clients:
    for i, c in enumerate(top_clients):
        tg = f"@{c['telegram_username']}" if c['telegram_username'] else ""
        color = [G, C, Y, RS, DIM][i]
        print(f"  {i+1}. {color}{c['username']:<18} {tg:<16} {c['cnt']} заказ(ов)  {fmt_money(c['total'])}{RS}")
else:
    print(f"  {DIM}Нет данных{RS}")

# ════════════════════════════════════════════════════════════════════
header("🕐  ПОСЛЕДНИЕ 10 КЛИЕНТОВ")

recent = rows("""
    SELECT id, username, telegram_id, telegram_username, created_at
    FROM users WHERE role='client' AND is_active=1
    ORDER BY created_at DESC LIMIT 10
""")

for u in recent:
    if u["telegram_username"]:
        tg = f"{G}@{u['telegram_username']}{RS}"
    elif u["telegram_id"]:
        tg = f"{Y}tg:{u['telegram_id']}{RS}"
    else:
        tg = f"{DIM}no tg{RS}"
    dt = u["created_at"][:16] if u["created_at"] else "?"
    print(f"  {DIM}{u['id']:>4}{RS}  {W}{u['username']:<24}{RS} {tg:<32} {DIM}{dt}{RS}")

# ════════════════════════════════════════════════════════════════════
print(f"\n{DIM}  Данные на {now.strftime('%Y-%m-%d %H:%M')} UTC{RS}\n")

db.close()
