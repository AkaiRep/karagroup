import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI

load_dotenv(Path(__file__).parent / ".env", override=True)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import engine, Base
import models  # noqa: F401
from routers import auth, users, orders, products, financial, chat, global_chat, media, categories, payments, reviews

# Ensure uploads directory exists
Path("uploads/chat").mkdir(parents=True, exist_ok=True)
Path("uploads/products").mkdir(parents=True, exist_ok=True)

# Create tables
Base.metadata.create_all(bind=engine)


# ── Migrations (safe, non-destructive) ────────────────────────────────────────
def run_migrations():
    from sqlalchemy import text, inspect
    inspector = inspect(engine)
    with engine.connect() as conn:
        # Add category_id to products if missing
        product_cols = [c["name"] for c in inspector.get_columns("products")]
        if "category_id" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN category_id INTEGER REFERENCES categories(id)"))
            conn.commit()
        # Add discount_percent to products if missing
        if "discount_percent" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN discount_percent REAL NOT NULL DEFAULT 0.0"))
            conn.commit()
        if "image_url" not in product_cols:
            conn.execute(text("ALTER TABLE products ADD COLUMN image_url VARCHAR(512)"))
            conn.commit()
        # Add description to categories if missing
        cat_cols = [c["name"] for c in inspector.get_columns("categories")]
        if "description" not in cat_cols:
            conn.execute(text("ALTER TABLE categories ADD COLUMN description TEXT"))
            conn.commit()
        # Add telegram fields to orders if missing
        order_cols = [c["name"] for c in inspector.get_columns("orders")]
        if "telegram_user_id" not in order_cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN telegram_user_id INTEGER"))
            conn.commit()
        if "telegram_username" not in order_cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN telegram_username VARCHAR(128)"))
            conn.commit()
        if "tg_notify_message_id" not in order_cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN tg_notify_message_id INTEGER"))
            conn.commit()
        if "tg_notify_sent_at" not in order_cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN tg_notify_sent_at DATETIME"))
            conn.commit()
        user_cols = [c["name"] for c in inspector.get_columns("users")]
        if "telegram_id" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN telegram_id INTEGER"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_telegram_id ON users (telegram_id)"))
            conn.commit()
        if "telegram_username" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN telegram_username VARCHAR(128)"))
            conn.commit()
        if "tg_payment_message_id" not in order_cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN tg_payment_message_id INTEGER"))
            conn.commit()
        if "tg_notified" not in order_cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN tg_notified BOOLEAN NOT NULL DEFAULT 1"))
            conn.commit()
        if "tg_last_notified_status" not in order_cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN tg_last_notified_status VARCHAR(32)"))
            # Sync existing notified orders so we don't re-edit them unnecessarily
            conn.execute(text(
                "UPDATE orders SET tg_last_notified_status = status WHERE tg_notify_message_id IS NOT NULL"
            ))
            conn.commit()
        if "tg_expiry_warned" not in order_cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN tg_expiry_warned BOOLEAN NOT NULL DEFAULT 0"))
            conn.commit()


run_migrations()

app = FastAPI(title="KaraGroup API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(orders.router)
app.include_router(products.router)
app.include_router(financial.router)
app.include_router(chat.router)
app.include_router(global_chat.router)
app.include_router(media.router)
app.include_router(categories.router)
app.include_router(payments.router)
app.include_router(reviews.router)


@app.get("/")
def root():
    return {"status": "ok", "version": "1.0.0"}


# ── Seed admin on first run ───────────────────────────────────────────────────
from sqlalchemy.orm import Session
from database import SessionLocal
import auth as auth_utils


def seed_admin():
    db: Session = SessionLocal()
    try:
        if not db.query(models.User).filter(models.User.role == models.UserRole.admin).first():
            db.add(models.User(
                username="admin",
                password_hash=auth_utils.hash_password("admin123"),
                role=models.UserRole.admin,
            ))
            db.commit()
            print("✅ Admin created: admin / admin123 — CHANGE THIS PASSWORD!")
    finally:
        db.close()


seed_admin()
