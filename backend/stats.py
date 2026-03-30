#!/usr/bin/env python3
"""Quick stats script for KaraGroup DB."""
import sqlite3
import os
from datetime import datetime, timezone, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "karagroup.db")
db = sqlite3.connect(DB_PATH)
db.row_factory = sqlite3.Row

week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")

def q(sql, *args):
    return db.execute(sql, args).fetchone()[0]

def rows(sql, *args):
    return db.execute(sql, args).fetchall()

total    = q("SELECT COUNT(*) FROM users WHERE is_active=1")
clients  = q("SELECT COUNT(*) FROM users WHERE role='client' AND is_active=1")
workers  = q("SELECT COUNT(*) FROM users WHERE role='worker' AND is_active=1")
admins   = q("SELECT COUNT(*) FROM users WHERE role='admin'  AND is_active=1")
with_tg  = q("SELECT COUNT(*) FROM users WHERE telegram_id IS NOT NULL AND is_active=1")
no_tg    = q("SELECT COUNT(*) FROM users WHERE telegram_id IS NULL AND role='client' AND is_active=1")
new_week = q("SELECT COUNT(*) FROM users WHERE role='client' AND created_at >= ?", week_ago)

total_orders  = q("SELECT COUNT(*) FROM orders")
order_statuses = rows("SELECT status, COUNT(*) as cnt FROM orders GROUP BY status ORDER BY cnt DESC")

print("=" * 42)
print("         KARAGROUP STATS")
print("=" * 42)
print(f"  Всего пользователей:     {total}")
print(f"  ├─ Клиенты:              {clients}")
print(f"  ├─ Воркеры:              {workers}")
print(f"  └─ Админы:               {admins}")
print()
print(f"  С Telegram:              {with_tg}")
print(f"  Без Telegram (клиенты):  {no_tg}")
print(f"  Новых за 7 дней:         {new_week}")
print()
print(f"  Всего заказов:           {total_orders}")
for row in order_statuses:
    print(f"  ├─ {row['status']:<22} {row['cnt']}")
print("=" * 42)

print("\nПоследние 10 клиентов:")
recent = rows(
    "SELECT id, username, telegram_id, telegram_username, created_at "
    "FROM users WHERE role='client' AND is_active=1 "
    "ORDER BY created_at DESC LIMIT 10"
)
for u in recent:
    if u["telegram_username"]:
        tg = f"@{u['telegram_username']}"
    elif u["telegram_id"]:
        tg = f"tg:{u['telegram_id']}"
    else:
        tg = "no tg"
    print(f"  {u['id']:>4}  {u['username']:<24} {tg:<24} {u['created_at'][:16]}")

db.close()
