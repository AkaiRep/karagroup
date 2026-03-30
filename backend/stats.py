#!/usr/bin/env python3
"""Quick stats script for KaraGroup DB."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
from models import User, UserRole, Order, OrderStatus
from sqlalchemy import func
from datetime import datetime, timezone, timedelta

db = SessionLocal()

try:
    total = db.query(func.count(User.id)).filter(User.is_active == True).scalar()
    clients = db.query(func.count(User.id)).filter(User.role == UserRole.client, User.is_active == True).scalar()
    workers = db.query(func.count(User.id)).filter(User.role == UserRole.worker, User.is_active == True).scalar()
    admins = db.query(func.count(User.id)).filter(User.role == UserRole.admin, User.is_active == True).scalar()

    with_tg = db.query(func.count(User.id)).filter(User.telegram_id != None, User.is_active == True).scalar()
    without_tg = db.query(func.count(User.id)).filter(User.telegram_id == None, User.role == UserRole.client, User.is_active == True).scalar()

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    new_this_week = db.query(func.count(User.id)).filter(User.created_at >= week_ago, User.role == UserRole.client).scalar()

    total_orders = db.query(func.count(Order.id)).scalar()
    orders_by_status = db.query(Order.status, func.count(Order.id)).group_by(Order.status).all()

    print("=" * 40)
    print("       KARAGROUP STATS")
    print("=" * 40)
    print(f"  Всего пользователей:  {total}")
    print(f"  ├─ Клиенты:           {clients}")
    print(f"  ├─ Воркеры:           {workers}")
    print(f"  └─ Админы:            {admins}")
    print()
    print(f"  С Telegram:           {with_tg}")
    print(f"  Без Telegram (клиенты): {without_tg}")
    print(f"  Новых за 7 дней:      {new_this_week}")
    print()
    print(f"  Всего заказов:        {total_orders}")
    for status, count in sorted(orders_by_status, key=lambda x: x[1], reverse=True):
        print(f"  ├─ {status.value:<20} {count}")
    print("=" * 40)

    print("\nПоследние 10 клиентов:")
    recent = (
        db.query(User)
        .filter(User.role == UserRole.client, User.is_active == True)
        .order_by(User.created_at.desc())
        .limit(10)
        .all()
    )
    for u in recent:
        tg = f"@{u.telegram_username}" if u.telegram_username else ("tg_id:" + str(u.telegram_id) if u.telegram_id else "no tg")
        print(f"  {u.id:>4}  {u.username:<24} {tg}")

finally:
    db.close()
