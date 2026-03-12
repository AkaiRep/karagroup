import uuid
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_
from typing import List, Dict
from database import get_db, SessionLocal
import models, schemas, auth as auth_utils
import json

router = APIRouter(prefix="/chat", tags=["chat"])

UPLOAD_DIR = Path("uploads/chat")
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}

# order_id -> list of websockets
_connections: Dict[int, List[WebSocket]] = {}


async def _broadcast(order_id: int, message: dict):
    if order_id not in _connections:
        return
    dead = []
    for ws in _connections[order_id]:
        try:
            await ws.send_text(json.dumps(message, default=str))
        except Exception:
            dead.append(ws)
    for ws in dead:
        _connections[order_id].remove(ws)


def _load_message(db: Session, msg_id: int) -> models.ChatMessage:
    return (
        db.query(models.ChatMessage)
        .options(joinedload(models.ChatMessage.sender))
        .filter(models.ChatMessage.id == msg_id)
        .first()
    )


def _ensure_utc(dt: datetime) -> datetime:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@router.get("/unread-counts")
def get_unread_counts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """Returns { order_id: count } — messages from others not yet read by current user."""
    receipt_subq = (
        db.query(
            models.ChatReadReceipt.order_id.label("order_id"),
            models.ChatReadReceipt.last_read_at.label("last_read_at"),
        )
        .filter(models.ChatReadReceipt.user_id == current_user.id)
        .subquery()
    )

    q = (
        db.query(
            models.ChatMessage.order_id,
            func.count(models.ChatMessage.id).label("count"),
        )
        .outerjoin(receipt_subq, receipt_subq.c.order_id == models.ChatMessage.order_id)
        .filter(models.ChatMessage.sender_id != current_user.id)
        .filter(
            or_(
                receipt_subq.c.last_read_at == None,
                models.ChatMessage.created_at > receipt_subq.c.last_read_at,
            )
        )
    )

    if current_user.role == models.UserRole.worker:
        q = (
            q.join(models.Order, models.Order.id == models.ChatMessage.order_id)
            .filter(models.Order.worker_id == current_user.id)
        )

    q = q.group_by(models.ChatMessage.order_id)
    return {str(r.order_id): r.count for r in q.all()}


@router.post("/{order_id}/read", status_code=204)
async def mark_read(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """Mark all messages in this order chat as read for current user."""
    now = datetime.now(timezone.utc)
    receipt = (
        db.query(models.ChatReadReceipt)
        .filter_by(order_id=order_id, user_id=current_user.id)
        .first()
    )
    if receipt:
        receipt.last_read_at = now
    else:
        receipt = models.ChatReadReceipt(
            order_id=order_id, user_id=current_user.id, last_read_at=now
        )
        db.add(receipt)
    db.commit()

    await _broadcast(order_id, {
        "type": "read",
        "user_id": current_user.id,
        "read_at": now.isoformat(),
    })


@router.get("/{order_id}/messages", response_model=List[schemas.MessageOut])
def get_messages(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user.role == models.UserRole.worker and order.worker_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get the other party's last_read_at to compute is_read
    other_receipt = (
        db.query(models.ChatReadReceipt)
        .filter(
            models.ChatReadReceipt.order_id == order_id,
            models.ChatReadReceipt.user_id != current_user.id,
        )
        .first()
    )
    other_read_at = _ensure_utc(other_receipt.last_read_at) if other_receipt else None

    messages = (
        db.query(models.ChatMessage)
        .options(joinedload(models.ChatMessage.sender))
        .filter(models.ChatMessage.order_id == order_id)
        .order_by(models.ChatMessage.created_at.asc())
        .all()
    )

    result = []
    for msg in messages:
        msg_out = schemas.MessageOut.model_validate(msg)
        if other_read_at and msg.sender_id == current_user.id:
            msg_out.is_read = other_read_at >= _ensure_utc(msg.created_at)
        result.append(msg_out)
    return result


@router.post("/{order_id}/messages", response_model=schemas.MessageOut)
async def send_message(
    order_id: int,
    data: schemas.MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user.role == models.UserRole.worker and order.worker_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    msg = models.ChatMessage(order_id=order_id, sender_id=current_user.id, content=data.content)
    db.add(msg)
    db.commit()
    db.refresh(msg)

    msg = _load_message(db, msg.id)
    msg_out = schemas.MessageOut.model_validate(msg)
    payload = msg_out.model_dump()
    payload["type"] = "message"
    await _broadcast(order_id, payload)
    return msg_out


@router.post("/{order_id}/upload-image", response_model=schemas.MessageOut)
async def upload_image(
    order_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user.role == models.UserRole.worker and order.worker_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only images (jpg, png, gif, webp) are allowed")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "jpg"
    filename = f"{order_id}_{int(datetime.now(timezone.utc).timestamp())}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOAD_DIR / filename

    with open(filepath, "wb") as f:
        f.write(await file.read())

    image_url = f"/uploads/chat/{filename}"
    msg = models.ChatMessage(
        order_id=order_id,
        sender_id=current_user.id,
        content="",
        image_url=image_url,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    msg = _load_message(db, msg.id)
    msg_out = schemas.MessageOut.model_validate(msg)
    payload = msg_out.model_dump()
    payload["type"] = "message"
    await _broadcast(order_id, payload)
    return msg_out


@router.websocket("/ws/{order_id}")
async def chat_websocket(order_id: int, websocket: WebSocket, token: str):
    db: Session = SessionLocal()
    try:
        payload = auth_utils.decode_token(token)
        if not payload:
            await websocket.close(code=4001)
            return
        user = db.query(models.User).filter(models.User.id == int(payload["sub"])).first()
        if not user or not user.is_active:
            await websocket.close(code=4001)
            return

        order = db.query(models.Order).filter(models.Order.id == order_id).first()
        if not order:
            await websocket.close(code=4004)
            return
        if user.role == models.UserRole.worker and order.worker_id != user.id:
            await websocket.close(code=4003)
            return

        await websocket.accept()
        _connections.setdefault(order_id, []).append(websocket)

        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            if order_id in _connections:
                try:
                    _connections[order_id].remove(websocket)
                except ValueError:
                    pass
    finally:
        db.close()
