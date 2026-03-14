import time
import os
from collections import deque
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text, func
import httpx

from database import get_db
import models, auth as auth_utils

router = APIRouter(prefix="/health", tags=["health"])

_start_time = time.time()

# In-memory ring buffer: last 30 snapshots of db latency + order counts
_history: deque = deque(maxlen=30)


def _snapshot(db: Session) -> dict:
    t0 = time.monotonic()
    db.execute(text("SELECT 1"))
    db_ms = round((time.monotonic() - t0) * 1000, 1)

    orders_active = db.query(models.Order).filter(
        models.Order.status.in_(["paid", "in_progress"])
    ).count()

    orders_pending = db.query(models.Order).filter(
        models.Order.status == models.OrderStatus.pending_payment
    ).count()

    return {
        "t": datetime.now(timezone.utc).strftime("%H:%M:%S"),
        "db_ms": db_ms,
        "orders_active": orders_active,
        "orders_pending": orders_pending,
    }


async def _check_telegram(bot_token: str) -> dict:
    result = {"bot_ok": False, "bot_username": None, "tg_latency_ms": None}
    try:
        t0 = time.monotonic()
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"https://api.telegram.org/bot{bot_token}/getMe")
        result["tg_latency_ms"] = round((time.monotonic() - t0) * 1000)
        if r.status_code == 200:
            data = r.json()
            result["bot_ok"] = data.get("ok", False)
            result["bot_username"] = data.get("result", {}).get("username")
    except Exception as e:
        result["bot_error"] = str(e)
    return result


async def _check_tg_servers() -> dict:
    """Ping Telegram's status API."""
    result = {"tg_servers_ok": False, "tg_servers_latency_ms": None}
    try:
        t0 = time.monotonic()
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get("https://api.telegram.org")
        result["tg_servers_latency_ms"] = round((time.monotonic() - t0) * 1000)
        result["tg_servers_ok"] = r.status_code < 500
    except Exception as e:
        result["tg_servers_error"] = str(e)
    return result


@router.get("/")
async def health_check(
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    results = {}

    # ── Database ───────────────────────────────────────────────────────────────
    db_ok = False
    db_ms = None
    try:
        t0 = time.monotonic()
        db.execute(text("SELECT 1"))
        db_ms = round((time.monotonic() - t0) * 1000, 1)
        db_ok = True
    except Exception as e:
        results["db_error"] = str(e)

    results["database"] = {"ok": db_ok, "latency_ms": db_ms}

    # ── Counts ─────────────────────────────────────────────────────────────────
    try:
        results["counts"] = {
            "orders_total": db.query(models.Order).count(),
            "orders_active": db.query(models.Order).filter(
                models.Order.status.in_(["paid", "in_progress"])
            ).count(),
            "orders_pending_payment": db.query(models.Order).filter(
                models.Order.status == models.OrderStatus.pending_payment
            ).count(),
            "users_total": db.query(models.User).count(),
            "users_online": db.query(models.User).filter(
                models.User.is_online == True
            ).count() if hasattr(models.User, "is_online") else None,
            "products_active": db.query(models.Product).filter(
                models.Product.is_active == True
            ).count(),
            "products_total": db.query(models.Product).count(),
        }
    except Exception as e:
        results["counts_error"] = str(e)

    # ── History snapshot ───────────────────────────────────────────────────────
    try:
        snap = _snapshot(db)
        _history.append(snap)
    except Exception:
        pass
    results["history"] = list(_history)

    # ── Telegram ───────────────────────────────────────────────────────────────
    bot_token = os.getenv("BOT_TOKEN", "")
    tg_bot = await _check_telegram(bot_token) if bot_token else {"bot_ok": False, "bot_error": "BOT_TOKEN не задан"}
    tg_servers = await _check_tg_servers()
    results["telegram"] = {**tg_bot, **tg_servers}

    # ── Env vars ───────────────────────────────────────────────────────────────
    results["env"] = {
        "BOT_TOKEN":           bool(os.getenv("BOT_TOKEN")),
        "PLATEGA_MERCHANT_ID": bool(os.getenv("PLATEGA_MERCHANT_ID")),
        "PLATEGA_SECRET":      bool(os.getenv("PLATEGA_SECRET")),
        "PLATEGA_RETURN_URL":  bool(os.getenv("PLATEGA_RETURN_URL")),
        "NOTIFY_GROUP_ID":     bool(os.getenv("NOTIFY_GROUP_ID")),
    }

    # ── Uptime ─────────────────────────────────────────────────────────────────
    uptime_sec = int(time.time() - _start_time)
    h, rem = divmod(uptime_sec, 3600)
    m, s = divmod(rem, 60)
    results["uptime"] = f"{h}ч {m}м {s}с"
    results["uptime_sec"] = uptime_sec
    results["ok"] = db_ok
    return results
