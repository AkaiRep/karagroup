from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from database import get_db
import models, schemas, auth as auth_utils

router = APIRouter(prefix="/financial", tags=["financial"])


@router.get("/dashboard", response_model=schemas.DashboardStats)
def get_dashboard(
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    orders = (
        db.query(models.Order)
        .options(
            joinedload(models.Order.worker),
            joinedload(models.Order.items).joinedload(models.OrderItem.product),
        )
        .all()
    )

    confirmed_orders = [o for o in orders if o.status == models.OrderStatus.confirmed]
    total_revenue = sum(o.price for o in confirmed_orders)
    avg_order_value = total_revenue / len(confirmed_orders) if confirmed_orders else 0.0

    # Profit split per confirmed order — use snapshotted values set at take time
    # Chain: price → media cut → worker cut → owner split
    # VIP:     remainder → 100% owner 1
    # Non-VIP: remainder → 40% owner 1, 60% owner 2
    media_total = sum(o.media_earnings or 0.0 for o in confirmed_orders)
    owner1_profit = 0.0
    owner2_profit = 0.0
    for o in confirmed_orders:
        media_cut = o.media_earnings or 0.0
        net_after_media = o.price - media_cut
        # Use snapshotted worker_earnings; fall back to current percentage if missing
        if o.worker_earnings is not None:
            worker_cut = o.worker_earnings
        elif o.worker:
            worker_cut = net_after_media * (o.worker.worker_percentage / 100.0)
        else:
            worker_cut = 0.0
        remainder = net_after_media - worker_cut
        is_vip = o.worker_is_vip if o.worker_is_vip is not None else (o.worker.is_vip if o.worker else False)
        if is_vip:
            owner1_profit += remainder
        else:
            owner1_profit += remainder * 0.40
            owner2_profit += remainder * 0.60

    orders_by_status = {s.value: 0 for s in models.OrderStatus}
    orders_by_source = {s.value: 0 for s in models.OrderSource}
    for o in orders:
        orders_by_status[o.status.value] += 1
        orders_by_source[o.source.value] += 1

    transactions = db.query(models.Transaction).all()
    pending_earnings = sum(t.amount for t in transactions if t.status == models.TransactionStatus.pending)
    paid_earnings = sum(t.amount for t in transactions if t.status == models.TransactionStatus.paid)

    # Top products by confirmed order count
    product_stats: dict = {}
    for o in orders:
        if o.status == models.OrderStatus.confirmed:
            n = max(len(o.items), 1)
            for item in o.items:
                pid = item.product_id
                if pid not in product_stats:
                    product_stats[pid] = {"product_id": pid, "count": 0, "revenue": 0.0}
                product_stats[pid]["count"] += 1
                product_stats[pid]["revenue"] += o.price / n

    # Enrich with product names
    products = {p.id: p for p in db.query(models.Product).all()}
    top_products = sorted(product_stats.values(), key=lambda x: x["count"], reverse=True)[:10]
    for tp in top_products:
        p = products.get(tp["product_id"])
        tp["name"] = p.name if p else "Unknown"

    # Revenue by day (last 30 days)
    from collections import defaultdict
    daily: dict = defaultdict(float)
    for o in orders:
        if o.status == models.OrderStatus.confirmed and o.confirmed_at:
            day = o.confirmed_at.strftime("%Y-%m-%d")
            daily[day] += o.price
    revenue_by_day = [{"date": d, "revenue": v} for d, v in sorted(daily.items())]

    # Worker stats
    workers = db.query(models.User).filter(models.User.role == models.UserRole.worker).all()
    worker_tx = {w.id: [] for w in workers}
    for t in transactions:
        if t.worker_id in worker_tx:
            worker_tx[t.worker_id].append(t)

    worker_orders = {w.id: [] for w in workers}
    for o in orders:
        if o.worker_id and o.worker_id in worker_orders:
            worker_orders[o.worker_id].append(o)

    workers_stats = []
    for w in workers:
        tx_list = worker_tx[w.id]
        o_list = worker_orders[w.id]
        workers_stats.append({
            "worker_id": w.id,
            "username": w.username,
            "worker_percentage": w.worker_percentage,
            "is_vip": w.is_vip,
            "total_orders": len(o_list),
            "completed_orders": sum(1 for o in o_list if o.status in (models.OrderStatus.completed, models.OrderStatus.confirmed)),
            "earnings_pending": sum(t.amount for t in tx_list if t.status == models.TransactionStatus.pending),
            "earnings_paid": sum(t.amount for t in tx_list if t.status == models.TransactionStatus.paid),
        })

    return schemas.DashboardStats(
        total_revenue=total_revenue,
        avg_order_value=avg_order_value,
        total_orders=len(orders),
        orders_by_status=orders_by_status,
        orders_by_source=orders_by_source,
        worker_earnings_pending=pending_earnings,
        worker_earnings_paid=paid_earnings,
        media_total=media_total,
        owner1_profit=owner1_profit,
        owner2_profit=owner2_profit,
        top_products=top_products,
        revenue_by_day=revenue_by_day,
        workers_stats=workers_stats,
    )


@router.get("/transactions", response_model=List[schemas.TransactionOut])
def list_transactions(
    worker_id: Optional[int] = None,
    status: Optional[models.TransactionStatus] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    q = db.query(models.Transaction).options(
        joinedload(models.Transaction.worker),
        joinedload(models.Transaction.order).joinedload(models.Order.items).joinedload(models.OrderItem.product),
    )
    if current_user.role == models.UserRole.worker:
        q = q.filter(models.Transaction.worker_id == current_user.id)
    elif worker_id:
        q = q.filter(models.Transaction.worker_id == worker_id)
    if status:
        q = q.filter(models.Transaction.status == status)
    return q.order_by(models.Transaction.created_at.desc()).all()


@router.patch("/transactions/{tx_id}/pay", response_model=schemas.TransactionOut)
def pay_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    tx = db.query(models.Transaction).filter(models.Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx.status == models.TransactionStatus.paid:
        raise HTTPException(status_code=400, detail="Already paid")
    tx.status = models.TransactionStatus.paid
    tx.paid_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(tx)
    return tx


@router.patch("/transactions/{tx_id}/unpay", response_model=schemas.TransactionOut)
def unpay_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    tx = db.query(models.Transaction).filter(models.Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx.status != models.TransactionStatus.paid:
        raise HTTPException(status_code=400, detail="Transaction is not paid")
    tx.status = models.TransactionStatus.pending
    tx.paid_at = None
    db.commit()
    db.refresh(tx)
    return tx
