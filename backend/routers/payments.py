import os
import hmac
import json
import hashlib
import logging
import time
from collections import defaultdict, deque
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
import models, auth as auth_utils

log = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])

# Rate limiter: 5 payment creation requests per user per 60 seconds
_payment_rate: dict[int, deque] = defaultdict(deque)
RATE_LIMIT = 5
RATE_WINDOW = 60


def _check_rate_limit(user_id: int):
    now = time.monotonic()
    dq = _payment_rate[user_id]
    while dq and dq[0] < now - RATE_WINDOW:
        dq.popleft()
    if len(dq) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Слишком много запросов. Попробуйте через минуту.")
    dq.append(now)


# ── Settings helper ───────────────────────────────────────────────────────────

def _cfg(db: Session, key: str, env_key: str = None, default: str = "") -> str:
    """Read setting from DB, fallback to env var, then default."""
    row = db.query(models.Setting).filter(models.Setting.key == key).first()
    if row and row.value:
        return row.value
    if env_key:
        val = os.getenv(env_key)
        if val:
            return val
    return default


# ── Platega ──────────────────────────────────────────────────────────────────

PLATEGA_BASE = "https://app.platega.io"


def _platega_headers(db: Session):
    merchant_id = _cfg(db, "pay_platega_merchant_id", "PLATEGA_MERCHANT_ID")
    secret = _cfg(db, "pay_platega_secret", "PLATEGA_SECRET")
    if not merchant_id or not secret:
        raise HTTPException(status_code=503, detail="Platega не настроена")
    return {"X-MerchantId": merchant_id, "X-Secret": secret}


def _platega_commission(db: Session, payment_method: int) -> float:
    defaults = {2: "11", 11: "12", 12: "5"}
    db_keys = {2: "pay_commission_sbp", 11: "pay_commission_card_rf", 12: "pay_commission_intl"}
    pct_str = _cfg(db, db_keys.get(payment_method, "pay_commission_card_rf"), default=defaults.get(payment_method, "12"))
    try:
        return float(pct_str) / 100
    except ValueError:
        return 0.12


async def _create_platega_payment(order: models.Order, payment_method: int, db: Session) -> dict:
    return_url = _cfg(db, "pay_platega_return_url", "PLATEGA_RETURN_URL", "https://t.me/")
    commission = _platega_commission(db, payment_method)
    amount_with_fee = round(order.price * (1 + commission), 2)
    payload = {
        "paymentMethod": payment_method,
        "paymentDetails": {
            "amount": amount_with_fee,
            "currency": "RUB",
        },
        "description": f"Заказ #{order.id}",
        "return": return_url,
        "failedUrl": return_url,
        "payload": str(order.id),
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PLATEGA_BASE}/transaction/process",
            json=payload,
            headers=_platega_headers(db),
            timeout=15,
        )

    if resp.status_code != 200:
        log.error("Platega create error: %s %s", resp.status_code, resp.text)
        raise HTTPException(status_code=502, detail="Ошибка платёжной системы")

    data = resp.json()
    redirect_url = data.get("redirect")
    transaction_id = data.get("transactionId")

    if not redirect_url:
        log.error("Platega no redirect: %s", data)
        raise HTTPException(status_code=502, detail="Ошибка платёжной системы")

    log.info("Platega payment created: order=%s transaction=%s", order.id, transaction_id)
    return {"payment_url": redirect_url, "payment_id": transaction_id}


# ── LAVA ─────────────────────────────────────────────────────────────────────

LAVA_BASE = "https://api.lava.ru"


def _lava_sign(payload: dict, secret_key: str) -> str:
    sorted_payload = dict(sorted(payload.items()))
    json_str = json.dumps(sorted_payload, ensure_ascii=False, separators=(",", ":"))
    return hmac.new(secret_key.encode(), json_str.encode(), hashlib.sha256).hexdigest()


def _lava_headers(payload: dict, secret_key: str) -> dict:
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Signature": _lava_sign(payload, secret_key),
    }


async def _create_lava_payment(order: models.Order, db: Session) -> dict:
    shop_id = _cfg(db, "pay_lava_shop_id", "LAVA_SHOP_ID")
    secret_key = _cfg(db, "pay_lava_secret_key", "LAVA_SECRET_KEY")
    if not shop_id or not secret_key:
        raise HTTPException(status_code=503, detail="LAVA не настроена")

    site_url = os.getenv("NEXT_PUBLIC_SITE_URL", "https://karashop.ru")
    hook_url = os.getenv("LAVA_WEBHOOK_URL", "https://karashop.ru/payments/webhook/lava")

    payload = {
        "shopId": shop_id,
        "sum": str(round(order.price, 2)),
        "orderId": f"{order.id}-{int(time.time())}",
        "hookUrl": hook_url,
        "successUrl": f"{site_url}/orders",
        "failUrl": f"{site_url}/orders",
        "comment": f"Заказ #{order.id}",
    }

    sorted_payload = dict(sorted(payload.items()))
    json_body = json.dumps(sorted_payload, ensure_ascii=False, separators=(",", ":"))

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{LAVA_BASE}/business/invoice/create",
            content=json_body,
            headers=_lava_headers(payload, secret_key),
            timeout=15,
        )

    if resp.status_code != 200:
        log.error("LAVA create error: %s %s", resp.status_code, resp.text)
        raise HTTPException(status_code=502, detail="Ошибка платёжной системы")

    data = resp.json()
    invoice_data = data.get("data", {})
    payment_url = invoice_data.get("url")
    invoice_id = invoice_data.get("invoiceId")

    if not payment_url:
        log.error("LAVA no url: %s", data)
        raise HTTPException(status_code=502, detail="Ошибка платёжной системы")

    # Store invoice_id so we can poll status later
    if invoice_id and not order.external_id:
        order.external_id = f"lava:{invoice_id}"
        db.commit()

    log.info("LAVA payment created: order=%s invoice=%s", order.id, invoice_id)
    return {"payment_url": payment_url, "payment_id": invoice_id}


def _lava_verify_webhook(invoice_id: str, amount: str, pay_time: str, sign: str, db: Session) -> bool:
    additional_key = _cfg(db, "pay_lava_additional_key", "LAVA_ADDITIONAL_KEY")
    expected = hashlib.md5(f"{invoice_id}:{amount}:{pay_time}:{additional_key}".encode()).hexdigest()
    return expected == sign


# ── Endpoints ─────────────────────────────────────────────────────────────────

class PaymentRequest(BaseModel):
    payment_method: Optional[int] = None  # Platega: 2=СБП, 11=карта РФ, 12=международная
    provider: str = "platega"             # "platega" or "lava"


@router.post("/create/{order_id}")
async def create_payment(
    order_id: int,
    body: PaymentRequest = PaymentRequest(),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    _check_rate_limit(current_user.id)

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != models.OrderStatus.pending_payment:
        raise HTTPException(status_code=400, detail="Заказ не ожидает оплаты")
    if current_user.role != models.UserRole.admin:
        if order.telegram_user_id != current_user.telegram_id:
            raise HTTPException(status_code=403, detail="Access denied")

    if body.provider == "lava":
        if _cfg(db, "pay_lava_enabled", default="true") == "false":
            raise HTTPException(status_code=503, detail="LAVA временно недоступна")
        return await _create_lava_payment(order, db)

    # Platega
    if _cfg(db, "pay_platega_enabled", default="true") == "false":
        raise HTTPException(status_code=503, detail="Platega временно недоступна")
    payment_method = body.payment_method or int(os.getenv("PLATEGA_PAYMENT_METHOD", "2"))
    return await _create_platega_payment(order, payment_method, db)


@router.post("/check-lava")
async def check_lava_payments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """Check Lava invoice status for user's pending orders and mark paid if confirmed."""
    shop_id = _cfg(db, "pay_lava_shop_id", "LAVA_SHOP_ID")
    secret_key = _cfg(db, "pay_lava_secret_key", "LAVA_SECRET_KEY")
    if not shop_id or not secret_key:
        raise HTTPException(status_code=503, detail="LAVA не настроена")

    pending = db.query(models.Order).filter(
        models.Order.telegram_user_id == current_user.telegram_id,
        models.Order.status == models.OrderStatus.pending_payment,
        models.Order.external_id.like("lava:%"),
    ).all()

    updated = []
    async with httpx.AsyncClient() as client:
        for order in pending:
            invoice_id = order.external_id[5:]  # strip "lava:"
            payload = {"shopId": shop_id, "invoiceId": invoice_id}
            sorted_payload = dict(sorted(payload.items()))
            json_body = json.dumps(sorted_payload, ensure_ascii=False, separators=(",", ":"))
            try:
                resp = await client.post(
                    f"{LAVA_BASE}/business/invoice/status",
                    content=json_body,
                    headers=_lava_headers(payload, secret_key),
                    timeout=10,
                )
                data = resp.json()
                log.info("LAVA check: order=%s invoice=%s http=%s body=%s", order.id, invoice_id, resp.status_code, data)
                if resp.status_code != 200:
                    continue
                # Lava returns status inside data.status or data.data.status
                invoice_data = data.get("data", data)
                status = invoice_data.get("status", "")
                if status in ("success", "paid", "completed"):
                    order.status = models.OrderStatus.paid
                    db.commit()
                    updated.append(order.id)
                    await _notify_user_payment(order)
            except Exception as e:
                log.warning("LAVA check error order=%s: %s", order.id, e)

    return {"checked": len(pending), "updated": updated}


@router.post("/webhook")
async def payment_webhook(request: Request, db: Session = Depends(get_db)):
    """Platega webhook"""
    merchant_id = _cfg(db, "pay_platega_merchant_id", "PLATEGA_MERCHANT_ID")
    secret = _cfg(db, "pay_platega_secret", "PLATEGA_SECRET")

    if not merchant_id or not secret:
        return {"status": "ok"}

    incoming_merchant = request.headers.get("X-MerchantId")
    incoming_secret = request.headers.get("X-Secret")

    if incoming_merchant != merchant_id or incoming_secret != secret:
        log.warning("Platega webhook auth failed: merchant=%s", incoming_merchant)
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    status = data.get("status")
    order_id_str = data.get("payload")
    transaction_id = data.get("id")

    log.info("Platega webhook: status=%s order=%s transaction=%s", status, order_id_str, transaction_id)

    if status == "CONFIRMED" and order_id_str:
        try:
            order_id = int(order_id_str)
        except ValueError:
            return {"status": "ok"}

        order = db.query(models.Order).filter(models.Order.id == order_id).first()
        if order and order.status == models.OrderStatus.pending_payment:
            order.status = models.OrderStatus.paid
            db.commit()
            log.info("Order #%s marked as paid via Platega", order_id)
            await _notify_user_payment(order)

    return {"status": "ok"}


@router.post("/webhook/lava")
async def lava_webhook(request: Request, db: Session = Depends(get_db)):
    """LAVA webhook"""
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    invoice_id = str(data.get("invoice_id", ""))
    amount = str(data.get("amount", ""))
    pay_time = str(data.get("pay_time", ""))
    sign = data.get("sign", "")
    status = data.get("status", "")
    order_id_str = str(data.get("order_id", ""))

    log.info("LAVA webhook: invoice=%s order=%s status=%s", invoice_id, order_id_str, status)

    if sign and not _lava_verify_webhook(invoice_id, amount, pay_time, sign, db):
        log.warning("LAVA webhook signature mismatch for invoice=%s", invoice_id)
        raise HTTPException(status_code=401, detail="Invalid signature")

    if status == "success" and order_id_str:
        try:
            order_id = int(order_id_str.split("-")[0])
        except ValueError:
            return {"status": "ok"}

        order = db.query(models.Order).filter(models.Order.id == order_id).first()
        if order and order.status == models.OrderStatus.pending_payment:
            order.status = models.OrderStatus.paid
            db.commit()
            log.info("Order #%s marked as paid via LAVA", order_id)
            await _notify_user_payment(order)

    return {"status": "ok"}


async def _notify_user_payment(order):
    bot_token = os.getenv("BOT_TOKEN")
    tg_user_id = order.telegram_user_id
    if not bot_token or not tg_user_id:
        return

    text = (
        f"✅ <b>Оплата прошла успешно!</b>\n\n"
        f"Заказ <b>#{order.id}</b> принят в работу.\n"
        f"Наш исполнитель скоро возьмётся за него.\n\n"
        f"Спасибо за заказ! 🎮"
    )

    try:
        async with httpx.AsyncClient() as client:
            if order.tg_payment_message_id:
                await client.post(
                    f"https://api.telegram.org/bot{bot_token}/editMessageText",
                    json={
                        "chat_id": tg_user_id,
                        "message_id": order.tg_payment_message_id,
                        "text": text,
                        "parse_mode": "HTML",
                    },
                )
            else:
                await client.post(
                    f"https://api.telegram.org/bot{bot_token}/sendMessage",
                    json={"chat_id": tg_user_id, "text": text, "parse_mode": "HTML"},
                )
    except Exception as e:
        log.error("Failed to notify user about payment: %s", e)
