import os
import uuid
import logging
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from database import get_db
import models, auth as auth_utils

log = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])


def _configure_yookassa():
    from yookassa import Configuration
    shop_id = os.getenv("YOOKASSA_SHOP_ID")
    secret_key = os.getenv("YOOKASSA_SECRET_KEY")
    log.info("YooKassa config: shop_id=%s secret_key=%s", shop_id, "***" if secret_key else None)
    if not shop_id or not secret_key:
        raise HTTPException(status_code=503, detail="YooKassa не настроена")
    Configuration.configure(shop_id, secret_key)


@router.post("/create/{order_id}")
def create_payment(
    order_id: int,
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    from yookassa import Payment

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != models.OrderStatus.pending_payment:
        raise HTTPException(status_code=400, detail="Заказ не ожидает оплаты")

    _configure_yookassa()

    return_url = os.getenv("YOOKASSA_RETURN_URL", "https://t.me/")

    payment = Payment.create({
        "amount": {
            "value": f"{order.price:.2f}",
            "currency": "RUB",
        },
        "confirmation": {
            "type": "redirect",
            "return_url": return_url,
        },
        "capture": True,
        "description": f"Заказ #{order_id}",
        "metadata": {"order_id": str(order_id)},
    }, str(uuid.uuid4()))

    return {
        "payment_url": payment.confirmation.confirmation_url,
        "payment_id": payment.id,
    }


@router.post("/webhook")
async def payment_webhook(request: Request, db: Session = Depends(get_db)):
    from yookassa import Configuration, Payment as YKPayment

    shop_id = os.getenv("YOOKASSA_SHOP_ID")
    secret_key = os.getenv("YOOKASSA_SECRET_KEY")
    if not shop_id or not secret_key:
        return {"status": "ok"}

    Configuration.configure(shop_id, secret_key)

    body = await request.body()
    try:
        data = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = data.get("event")
    obj = data.get("object", {})

    log.info("YooKassa webhook: event=%s payment_id=%s", event, obj.get("id"))

    if event == "payment.succeeded":
        payment_id = obj.get("id")
        order_id = int(obj.get("metadata", {}).get("order_id", 0))

        if not payment_id or not order_id:
            return {"status": "ok"}

        # Верифицируем платёж через API ЮКассы
        try:
            payment = YKPayment.find_one(payment_id)
            if payment.status != "succeeded":
                log.warning("Payment %s status is %s, not succeeded", payment_id, payment.status)
                return {"status": "ok"}
        except Exception as e:
            log.error("Payment verification failed: %s", e)
            raise HTTPException(status_code=500, detail="Payment verification error")

        order = db.query(models.Order).filter(models.Order.id == order_id).first()
        if order and order.status == models.OrderStatus.pending_payment:
            order.status = models.OrderStatus.paid
            db.commit()
            log.info("Order #%s marked as paid", order_id)

    return {"status": "ok"}
