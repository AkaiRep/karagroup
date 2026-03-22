import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
import json

from database import get_db, SessionLocal
import models, schemas, auth as auth_utils

router = APIRouter(prefix="/global-chat", tags=["global-chat"])

UPLOAD_DIR = Path("uploads/chat")
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}

# All connected websockets for the global chat room
_connections: List[WebSocket] = []


async def _broadcast(message: dict):
    dead = []
    for ws in _connections:
        try:
            await ws.send_text(json.dumps(message, default=str))
        except Exception:
            dead.append(ws)
    for ws in dead:
        _connections.remove(ws)


@router.get("/messages", response_model=List[schemas.GlobalMessageOut])
def get_messages(
    limit: int = 100,
    db: Session = Depends(get_db),
    _: models.User = Depends(auth_utils.get_current_user),
):
    return (
        db.query(models.GlobalChatMessage)
        .options(joinedload(models.GlobalChatMessage.sender))
        .order_by(models.GlobalChatMessage.created_at.desc())
        .limit(limit)
        .all()[::-1]  # reverse to chronological order
    )


@router.get("/unread-count")
def get_unread_count(
    since: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    q = db.query(func.count(models.GlobalChatMessage.id)).filter(
        models.GlobalChatMessage.sender_id != current_user.id
    )
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
            q = q.filter(models.GlobalChatMessage.created_at > since_dt)
        except ValueError:
            pass
    return {"count": q.scalar() or 0}


@router.post("/messages", response_model=schemas.GlobalMessageOut)
async def send_message(
    data: schemas.MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    msg = models.GlobalChatMessage(sender_id=current_user.id, content=data.content)
    db.add(msg)
    db.commit()
    db.refresh(msg)

    msg = (
        db.query(models.GlobalChatMessage)
        .options(joinedload(models.GlobalChatMessage.sender))
        .filter(models.GlobalChatMessage.id == msg.id)
        .first()
    )
    msg_out = schemas.GlobalMessageOut.model_validate(msg)
    await _broadcast(msg_out.model_dump())
    return msg_out


@router.post("/upload-image", response_model=schemas.GlobalMessageOut)
async def upload_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only images are allowed")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "jpg"
    filename = f"global_{int(datetime.now(timezone.utc).timestamp())}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOAD_DIR / filename

    with open(filepath, "wb") as f:
        f.write(await file.read())

    msg = models.GlobalChatMessage(
        sender_id=current_user.id,
        content="",
        image_url=f"/uploads/chat/{filename}",
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    msg = (
        db.query(models.GlobalChatMessage)
        .options(joinedload(models.GlobalChatMessage.sender))
        .filter(models.GlobalChatMessage.id == msg.id)
        .first()
    )
    msg_out = schemas.GlobalMessageOut.model_validate(msg)
    await _broadcast(msg_out.model_dump())
    return msg_out


@router.websocket("/ws")
async def global_chat_ws(websocket: WebSocket, token: str):
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
    finally:
        db.close()

    await websocket.accept()
    _connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        try:
            _connections.remove(websocket)
        except ValueError:
            pass
