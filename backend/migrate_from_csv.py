#!/usr/bin/env python3
"""
Migration script: import products from prices.json and orders from crm_all_20260311.csv
into the karagroup SQLite database.

Usage (run from project root or backend/ dir):
    cd /path/to/karagroup/backend
    python migrate_from_csv.py
"""

import csv
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from database import SessionLocal, engine, Base
import models
import auth as auth_utils

Base.metadata.create_all(bind=engine)

SCRIPT_DIR  = Path(__file__).parent
PRICES_FILE = SCRIPT_DIR.parent / "prices.json"
CSV_FILE    = SCRIPT_DIR.parent / "crm_all_20260311.csv"

STATUS_MAP = {
    "Выполнено": models.OrderStatus.confirmed,
    "Новая":     models.OrderStatus.paid,
    "Отменено":  None,   # будет пропущен
}
SOURCE_MAP = {
    "Telegram": models.OrderSource.telegram,
    "FanPay":   models.OrderSource.funpay,
}

# "Фарм круток (1 час) x1.5 (249₽)" → name="Фарм круток (1 час)", qty=1.5
ITEM_RE = re.compile(r"^(.+?)\s+x(\d+(?:\.\d+)?)(?:\s*\([\d.]+₽\))?$")
DISCOUNT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*%")


def parse_items(services_str: str) -> list[tuple[str, float]]:
    """Returns list of (name, quantity)."""
    if not services_str.strip():
        return []
    result = []
    for part in services_str.split(";"):
        part = part.strip()
        if not part:
            continue
        m = ITEM_RE.match(part)
        if m:
            result.append((m.group(1).strip(), float(m.group(2))))
        else:
            result.append((part, 1.0))
    return result


def resolve_product(db, name: str, cache: dict) -> models.Product:
    """Find by name (case-insensitive), create with price=0 if missing."""
    key = name.lower()
    for stored_name, prod in cache.items():
        if stored_name.lower() == key:
            return prod
    # Not found → create placeholder
    new_prod = models.Product(name=name, price=0.0, is_active=True)
    db.add(new_prod)
    db.flush()
    cache[name] = new_prod
    return new_prod


def main():
    if not PRICES_FILE.exists():
        print(f"❌  Not found: {PRICES_FILE}")
        sys.exit(1)
    if not CSV_FILE.exists():
        print(f"❌  Not found: {CSV_FILE}")
        sys.exit(1)

    db = SessionLocal()
    try:
        # ── 1. Seed admin ──────────────────────────────────────────────────
        if not db.query(models.User).filter_by(role=models.UserRole.admin).first():
            db.add(models.User(
                username="admin",
                password_hash=auth_utils.hash_password("admin123"),
                role=models.UserRole.admin,
            ))
            db.commit()
            print("✅  Admin created: admin / admin123  ← смените пароль!")

        # ── 2. Import products ─────────────────────────────────────────────
        with open(PRICES_FILE, encoding="utf-8") as f:
            prices_data = json.load(f)

        product_cache: dict[str, models.Product] = {}
        n_new_products = 0

        for item in prices_data["prices"]:
            name  = item["name"].strip()
            price = float(item["price"])
            existing = db.query(models.Product).filter(
                models.Product.name == name
            ).first()
            if existing:
                product_cache[name] = existing
            else:
                prod = models.Product(name=name, price=price, is_active=True)
                db.add(prod)
                db.flush()
                product_cache[name] = prod
                n_new_products += 1

        db.commit()
        already = len(prices_data["prices"]) - n_new_products
        print(f"✅  Продукты: {n_new_products} создано, {already} уже существовало")

        # Обновить кэш из БД (чтобы id были корректными)
        for p in db.query(models.Product).all():
            product_cache[p.name] = p

        # ── 3. Import orders ───────────────────────────────────────────────
        n_imported = 0
        n_skipped  = 0
        n_dupes    = 0
        created_products: list[str] = []

        with open(CSV_FILE, encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                status_str = row["Статус"].strip()
                status = STATUS_MAP.get(status_str)
                if status is None:
                    print(f"  ⚠  Пропущен (отменён) #{row['ID']}: {row['Клиент']}")
                    n_skipped += 1
                    continue

                ext_id = row["ID"].strip()
                # Пропустить дубликаты по external_id
                if db.query(models.Order).filter_by(external_id=ext_id).first():
                    n_dupes += 1
                    continue

                # Дата
                try:
                    created_at = datetime.strptime(
                        row["Дата"].strip(), "%Y-%m-%d"
                    ).replace(tzinfo=timezone.utc)
                except ValueError:
                    created_at = datetime.now(timezone.utc)

                source = SOURCE_MAP.get(row["Платформа"].strip(), models.OrderSource.other)

                client_info = row["Клиент"].strip() or row["TG"].strip()

                fanpay_url = row.get("FanPay ссылка", "").strip()
                tg = row.get("TG", "").strip()
                if fanpay_url:
                    client_url = fanpay_url
                elif tg.startswith("@"):
                    client_url = f"https://t.me/{tg[1:]}"
                else:
                    client_url = None

                try:
                    price = float(row["Итого"].strip())
                except (ValueError, KeyError):
                    price = 0.0

                # Собираем notes
                notes_parts = []
                raw_note = row.get("Заметка", "").strip()
                if raw_note:
                    notes_parts.append(raw_note)
                discount_str = row.get("Скидка", "").strip()
                if discount_str:
                    notes_parts.append(f"Скидка: {discount_str}")

                # Разбираем услуги
                parsed_items = parse_items(row.get("Услуги", ""))
                # Дробные кол-ва — пишем в заметку
                for name, qty in parsed_items:
                    if qty != int(qty):
                        notes_parts.append(f"{name}: кол-во {qty} (округлено до {round(qty)})")

                notes = "; ".join(notes_parts) or None

                order = models.Order(
                    external_id=ext_id,
                    source=source,
                    price=price,
                    notes=notes,
                    client_info=client_info,
                    client_url=client_url,
                    created_at=created_at,
                    status=status,
                )
                if status == models.OrderStatus.confirmed:
                    order.taken_at      = created_at
                    order.completed_at  = created_at
                    order.confirmed_at  = created_at

                db.add(order)
                db.flush()

                for name, qty in parsed_items:
                    qty_int = max(1, round(qty))
                    before = len(product_cache)
                    prod = resolve_product(db, name, product_cache)
                    if len(product_cache) > before:
                        created_products.append(f"{name} (price=0)")
                    db.add(models.OrderItem(
                        order_id=order.id,
                        product_id=prod.id,
                        quantity=qty_int,
                        discount=0.0,
                    ))

                n_imported += 1

        db.commit()
        print(f"✅  Заказы: {n_imported} импортировано, "
              f"{n_skipped} пропущено (отменённые), "
              f"{n_dupes} дублей пропущено")

        if created_products:
            print(f"\n⚠   Созданы {len(created_products)} неизвестных продуктов с ценой 0 "
                  f"(исправьте в разделе «Услуги»):")
            for p in sorted(set(created_products)):
                print(f"     • {p}")

        print("\n🎉  Миграция завершена!")

    except Exception:
        db.rollback()
        import traceback
        print("❌  Ошибка:")
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
