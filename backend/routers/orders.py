import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from database import get_db, SessionLocal
import models, schemas, auth as auth_utils

router = APIRouter(prefix="/orders", tags=["orders"])

MAX_WORKER_ACTIVE_ORDERS = 3


def _order_options():
    return [
        joinedload(models.Order.items).joinedload(models.OrderItem.product),
        joinedload(models.Order.worker),
    ]


def _load_order(db: Session, order_id: int) -> models.Order:
    order = db.query(models.Order).options(*_order_options()).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/", response_model=List[schemas.OrderOut])
def list_orders(
    status: Optional[models.OrderStatus] = None,
    exclude_status: Optional[models.OrderStatus] = None,
    source: Optional[models.OrderSource] = None,
    worker_id: Optional[int] = None,
    telegram_user_id: Optional[int] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    q = db.query(models.Order).options(*_order_options())

    if current_user.role == models.UserRole.worker:
        q = q.filter(
            (models.Order.worker_id == current_user.id) |
            (models.Order.status == models.OrderStatus.paid)
        )
    else:
        if worker_id is not None:
            q = q.filter(models.Order.worker_id == worker_id)
        if telegram_user_id is not None:
            q = q.filter(models.Order.telegram_user_id == telegram_user_id)

    if status is not None:
        q = q.filter(models.Order.status == status)
    elif telegram_user_id is None:
        # По умолчанию скрываем неоплаченные заказы (кроме запросов от бота по telegram_user_id)
        q = q.filter(models.Order.status != models.OrderStatus.pending_payment)
    if exclude_status is not None:
        q = q.filter(models.Order.status != exclude_status)
    if source is not None:
        q = q.filter(models.Order.source == source)
    if search:
        q = q.filter(
            (models.Order.external_id.contains(search)) |
            (models.Order.client_info.contains(search))
        )
    if date_from:
        try:
            q = q.filter(models.Order.created_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            q = q.filter(models.Order.created_at <= datetime.fromisoformat(date_to))
        except ValueError:
            pass
    if price_min is not None:
        q = q.filter(models.Order.price >= price_min)
    if price_max is not None:
        q = q.filter(models.Order.price <= price_max)

    return q.order_by(models.Order.created_at.desc()).all()


@router.get("/recent")
def recent_orders(db: Session = Depends(get_db)):
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    orders = (
        db.query(models.Order)
        .options(
            joinedload(models.Order.items).joinedload(models.OrderItem.product),
        )
        .filter(
            models.Order.status.in_([
                models.OrderStatus.completed,
                models.OrderStatus.confirmed,
            ]),
            models.Order.created_at >= cutoff,
        )
        .order_by(models.Order.id.desc())
        .limit(10)
        .all()
    )
    def mask_name(name: str | None) -> str | None:
        if not name:
            return None
        n = name.strip()
        if len(n) <= 2:
            return n[0] + '***' if n else None
        return n[0] + '***' + n[-1]

    result = []
    for o in orders:
        product_name = o.items[0].product.name if o.items and o.items[0].product else "Услуга"
        result.append({
            "id": o.id,
            "product": product_name,
            "price": o.price,
            "client": mask_name(o.client_info),
            "created_at": o.created_at.isoformat(),
        })
    return result


@router.get("/available", response_model=List[schemas.OrderOut])
def list_available_orders(
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.require_worker),
):
    return (
        db.query(models.Order)
        .options(*_order_options())
        .filter(
            models.Order.status == models.OrderStatus.paid,
            models.Order.worker_id == None,
        )
        .order_by(models.Order.created_at.asc())
        .all()
    )


@router.post("/", response_model=schemas.OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(
    data: schemas.OrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    # Resolve promo code if provided
    promo = None
    if data.promo_code:
        promo = db.query(models.PromoCode).filter(
            models.PromoCode.code == data.promo_code.upper(),
            models.PromoCode.is_active == True,
        ).first()

    final_price = data.price
    media_earnings = None
    if promo:
        final_price = round(data.price * (1 - promo.discount_percent / 100), 2)
        media_earnings = round(final_price * promo.media_percent / 100, 2)

    # Для клиентов — авто-заполняем данные и статус
    is_client = current_user.role == models.UserRole.client
    order_status = models.OrderStatus.pending_payment if is_client else (data.status or models.OrderStatus.paid)
    order_source = models.OrderSource.website if is_client and data.source == models.OrderSource.other else data.source
    tg_user_id = current_user.telegram_id if is_client else data.telegram_user_id
    client_info = data.client_info or (f"@{current_user.username}" if is_client else None)
    client_url = data.client_url or (f"tg://user?id={current_user.telegram_id}" if is_client and current_user.telegram_id else None)

    order = models.Order(
        external_id=data.external_id,
        source=order_source,
        status=order_status,
        original_price=data.price if promo else None,
        price=final_price,
        promo_code_id=promo.id if promo else None,
        media_earnings=media_earnings,
        notes=data.notes,
        client_info=client_info,
        client_url=client_url,
        telegram_user_id=tg_user_id,
        telegram_username=data.telegram_username,
    )
    db.add(order)
    db.flush()

    for item in data.items:
        if db.query(models.Product).filter(models.Product.id == item.product_id).first():
            db.add(models.OrderItem(order_id=order.id, product_id=item.product_id, quantity=item.quantity, discount=item.discount))

    db.commit()
    return _load_order(db, order.id)


@router.get("/tg-pending-updates", response_model=List[schemas.OrderOut])
def get_tg_pending_updates(
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    """Orders that the bot may need to send or update Telegram notifications for."""
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    warn_threshold = now - timedelta(hours=36)
    edit_cutoff = now - timedelta(hours=48)

    # 1. New orders that haven't been notified yet (limit to last 24h to avoid flooding)
    # Exclude pending_payment — notify only after payment confirmed
    new_orders = (
        db.query(models.Order)
        .options(*_order_options())
        .filter(
            models.Order.tg_notified == False,
            models.Order.status != models.OrderStatus.pending_payment,
            models.Order.created_at >= (now - timedelta(hours=24)),
        )
        .all()
    )

    # 2. Already-notified orders that need message edits (status changed or expiry warning)
    from sqlalchemy import cast, String
    editable = (
        db.query(models.Order)
        .options(*_order_options())
        .filter(
            models.Order.tg_notified == True,
            models.Order.tg_notify_message_id.isnot(None),
            models.Order.tg_notify_sent_at > edit_cutoff,
            (
                (cast(models.Order.status, String) != models.Order.tg_last_notified_status) |
                models.Order.tg_last_notified_status.is_(None) |
                (
                    (models.Order.tg_notify_sent_at <= warn_threshold) &
                    (models.Order.tg_expiry_warned == False)
                )
            ),
        )
        .all()
    )

    seen = {o.id for o in new_orders}
    return new_orders + [o for o in editable if o.id not in seen]


@router.patch("/{order_id}/tg-notify", response_model=schemas.OrderOut)
def update_tg_notify(
    order_id: int,
    data: schemas.OrderTgNotifyUpdate,
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(order, field, value)
    db.commit()
    return _load_order(db, order_id)


@router.get("/{order_id}", response_model=schemas.OrderOut)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    order = _load_order(db, order_id)
    if current_user.role == models.UserRole.worker and order.worker_id != current_user.id:
        if order.status != models.OrderStatus.paid:
            raise HTTPException(status_code=403, detail="Access denied")
    return order


@router.patch("/{order_id}", response_model=schemas.OrderOut)
def update_order(
    order_id: int,
    data: schemas.OrderUpdate,
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    order = _load_order(db, order_id)
    for field in ("external_id", "source", "notes", "client_info", "client_url", "price"):
        val = getattr(data, field)
        if val is not None:
            setattr(order, field, val)

    if data.items is not None:
        db.query(models.OrderItem).filter(models.OrderItem.order_id == order_id).delete()
        for item in data.items:
            if db.query(models.Product).filter(models.Product.id == item.product_id).first():
                db.add(models.OrderItem(order_id=order_id, product_id=item.product_id, quantity=item.quantity, discount=item.discount))

    db.commit()
    return _load_order(db, order_id)


@router.post("/{order_id}/take", response_model=schemas.OrderOut)
def take_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.require_worker),
):
    order = _load_order(db, order_id)

    if order.status != models.OrderStatus.paid or order.worker_id is not None:
        raise HTTPException(status_code=400, detail="Order is not available")

    active_count = (
        db.query(models.Order)
        .filter(
            models.Order.worker_id == current_user.id,
            models.Order.status == models.OrderStatus.in_progress,
        )
        .count()
    )
    if active_count >= MAX_WORKER_ACTIVE_ORDERS:
        raise HTTPException(
            status_code=400,
            detail=f"You cannot have more than {MAX_WORKER_ACTIVE_ORDERS} active orders",
        )

    order.worker_id = current_user.id
    order.status = models.OrderStatus.in_progress
    order.taken_at = datetime.now(timezone.utc)
    net = order.price - (order.media_earnings or 0.0)
    order.worker_earnings = round(net * current_user.worker_percentage / 100, 2)
    order.worker_is_vip = current_user.is_vip

    db.add(models.Transaction(
        order_id=order.id,
        worker_id=current_user.id,
        amount=order.worker_earnings,
    ))
    db.commit()
    return _load_order(db, order_id)


@router.patch("/{order_id}/status", response_model=schemas.OrderOut)
def update_order_status(
    order_id: int,
    data: schemas.OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    order = _load_order(db, order_id)
    now = datetime.now(timezone.utc)

    if current_user.role == models.UserRole.worker:
        if order.worker_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        if data.status != models.OrderStatus.completed:
            raise HTTPException(status_code=403, detail="Workers can only mark orders as completed")

    order.status = data.status
    if data.status == models.OrderStatus.completed:
        order.completed_at = now
    elif data.status == models.OrderStatus.confirmed:
        order.confirmed_at = now

    db.commit()
    return _load_order(db, order_id)


@router.post("/{order_id}/remove-worker", response_model=schemas.OrderOut)
def remove_worker(
    order_id: int,
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    order = _load_order(db, order_id)
    if order.worker_id is None:
        raise HTTPException(status_code=400, detail="Order has no worker")
    # Delete the pending transaction for this order if it exists
    tx = db.query(models.Transaction).filter(
        models.Transaction.order_id == order_id,
        models.Transaction.status == models.TransactionStatus.pending,
    ).first()
    if tx:
        db.delete(tx)
    order.worker_id = None
    order.status = models.OrderStatus.paid
    order.taken_at = None
    order.worker_earnings = None
    order.worker_is_vip = None
    db.commit()
    return _load_order(db, order_id)


@router.websocket("/ws/recent")
async def ws_recent_orders(websocket: WebSocket):
    await websocket.accept()
    last_ids: set = set()
    db: Session = SessionLocal()
    try:
        while True:
            from datetime import timedelta
            cutoff = datetime.now(timezone.utc) - timedelta(days=30)
            orders = (
                db.query(models.Order)
                .options(joinedload(models.Order.items).joinedload(models.OrderItem.product))
                .filter(
                    models.Order.status.in_([
                        models.OrderStatus.completed,
                        models.OrderStatus.confirmed,
                    ]),
                    models.Order.created_at >= cutoff,
                )
                .order_by(models.Order.id.desc())
                .limit(10)
                .all()
            )
            db.expire_all()
            def mask(name):
                if not name:
                    return None
                n = name.strip()
                if len(n) <= 2:
                    return n[0] + '***' if n else None
                return n[0] + '***' + n[-1]

            result = []
            for o in orders:
                product_name = o.items[0].product.name if o.items and o.items[0].product else "Услуга"
                result.append({
                    "id": o.id,
                    "product": product_name,
                    "price": o.price,
                    "client": mask(o.client_info),
                    "created_at": o.created_at.isoformat(),
                })
            current_ids = {o["id"] for o in result}
            if last_ids:
                new_orders = [o for o in result if o["id"] not in last_ids]
                for order in new_orders:
                    await websocket.send_json(order)
            last_ids = current_ids
            await asyncio.sleep(5)
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        db.close()


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(order)
    db.commit()
