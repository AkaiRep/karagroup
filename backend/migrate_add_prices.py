#!/usr/bin/env python3
"""Migration: add price_usd and price_eur columns to products table."""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "karagroup.db")
db = sqlite3.connect(DB_PATH)

cols = {row[1] for row in db.execute("PRAGMA table_info(products)")}

added = []
if "price_usd" not in cols:
    db.execute("ALTER TABLE products ADD COLUMN price_usd REAL")
    added.append("price_usd")

if "price_eur" not in cols:
    db.execute("ALTER TABLE products ADD COLUMN price_eur REAL")
    added.append("price_eur")

db.commit()
db.close()

if added:
    print(f"✅ Added columns: {', '.join(added)}")
else:
    print("✅ Columns already exist, nothing to do.")
