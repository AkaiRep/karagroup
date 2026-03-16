import os
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

PLATEGA_BASE = "https://app.platega.io"


def _platega_headers():
    merchant_id = os.getenv("PLATEGA_MERCHANT_ID")
    secret = os.getenv("PLATEGA_SECRET")
    if not merchant_id or not secret:
        raise HTTPException(status_code=503, detail="Platega не настроена")
    return {"X-MerchantId": merchant_id, "X-Secret": secret}


class PaymentRequest(BaseModel):
    payment_method: Optional[int] = None  # 2=СБП, 11=карта РФ, 12=международная


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
    if current_user.role == models.UserRole.client and order.telegram_user_id != current_user.telegram_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return_url = os.getenv("PLATEGA_RETURN_URL", "https://t.me/")
    payment_method = body.payment_method or int(os.getenv("PLATEGA_PAYMENT_METHOD", "2"))

    payload = {
        "paymentMethod": payment_method,
        "paymentDetails": {
            "amount": round(order.price, 2),
            "currency": "RUB",
        },
        "description": f"Заказ #{order_id}",
        "return": return_url,
        "failedUrl": return_url,
        "payload": str(order_id),
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{PLATEGA_BASE}/transaction/process",
            json=payload,
            headers=_platega_headers(),
            timeout=15,
        )

    if resp.status_code != 200:
        log.error("Platega create error: %s %s", resp.status_code, resp.text)
        raise HTTPException(status_code=502, detail="Ошибка платёжной системы")

    data = resp.json()
    transaction_id = data.get("transactionId")
    redirect_url = data.get("redirect")

    if not redirect_url:
        log.error("Platega no redirect: %s", data)
        raise HTTPException(status_code=502, detail="Ошибка платёжной системы")

    log.info("Platega payment created: order=%s transaction=%s", order_id, transaction_id)

    return {
        "payment_url": redirect_url,
        "payment_id": transaction_id,
    }


@router.post("/webhook")
async def payment_webhook(request: Request, db: Session = Depends(get_db)):
    merchant_id = os.getenv("PLATEGA_MERCHANT_ID")
    secret = os.getenv("PLATEGA_SECRET")

    if not merchant_id or not secret:
        return {"status": "ok"}

    # Верификация — Platega присылает те же заголовки что и мы
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
