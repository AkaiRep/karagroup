import time
import os
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
import models, auth as auth_utils

router = APIRouter(prefix="/health", tags=["health"])

_start_time = time.time()


@router.get("/")
def health_check(
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
            "orders_total":    db.query(models.Order).count(),
            "orders_active":   db.query(models.Order).filter(
                models.Order.status.in_(["paid", "in_progress"])
            ).count(),
            "orders_pending_payment": db.query(models.Order).filter(
                models.Order.status == models.OrderStatus.pending_payment
            ).count(),
            "users_total":     db.query(models.User).count(),
            "users_online":    db.query(models.User).filter(
                models.User.is_online == True
            ).count() if hasattr(models.User, "is_online") else None,
            "products_active": db.query(models.Product).filter(
                models.Product.is_active == True
            ).count(),
            "products_total":  db.query(models.Product).count(),
        }
    except Exception as e:
        results["counts_error"] = str(e)

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
