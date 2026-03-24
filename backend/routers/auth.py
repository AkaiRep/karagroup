import os
import hmac
import hashlib
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth as auth_utils

router = APIRouter(prefix="/auth", tags=["auth"])

_auth_rate: dict[str, deque] = defaultdict(deque)
AUTH_RATE_LIMIT = 10   # попыток
AUTH_RATE_WINDOW = 60  # секунд


def _check_auth_rate(request: Request):
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    dq = _auth_rate[ip]
    while dq and dq[0] < now - AUTH_RATE_WINDOW:
        dq.popleft()
    if len(dq) >= AUTH_RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Слишком много попыток. Подождите минуту.")
    dq.append(now)


@router.post("/login", response_model=schemas.TokenResponse)
def login(request: Request, data: schemas.LoginRequest, db: Session = Depends(get_db)):
    _check_auth_rate(request)
    user = db.query(models.User).filter(models.User.username == data.username).first()
    if not user or not auth_utils.verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    # Version check — only for workers
    if user.role == models.UserRole.worker:
        required = db.query(models.Setting).filter(models.Setting.key == "worker_required_version").first()
        required_version = required.value.strip() if required and required.value and required.value.strip() else None
        if required_version:
            if not data.version or data.version.strip() != required_version:
                raise HTTPException(
                    status_code=status.HTTP_426_UPGRADE_REQUIRED,
                    detail=f"Устаревшая версия приложения. Обновите до версии {required_version}.",
                )

    token = auth_utils.create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}


class TelegramWebAppAuthData(BaseModel):
    init_data: str


@router.post("/telegram-webapp", response_model=schemas.TokenResponse)
def telegram_webapp_auth(request: Request, data: TelegramWebAppAuthData, db: Session = Depends(get_db)):
    _check_auth_rate(request)
    bot_token = os.getenv("BOT_TOKEN")
    if not bot_token:
        raise HTTPException(status_code=503, detail="Telegram auth not configured")

    params = dict(parse_qsl(data.init_data, keep_blank_values=True))
    received_hash = params.pop("hash", None)
    if not received_hash:
        raise HTTPException(status_code=401, detail="Missing hash")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_hash, received_hash):
        raise HTTPException(status_code=401, detail="Invalid Telegram WebApp data")

    import json
    user_json = params.get("user")
    if not user_json:
        raise HTTPException(status_code=401, detail="No user data")
    tg_user = json.loads(user_json)

    tg_id = tg_user.get("id")
    first_name = tg_user.get("first_name", "")
    last_name = tg_user.get("last_name")
    username = tg_user.get("username")

    user = db.query(models.User).filter(models.User.telegram_id == tg_id).first()
    if not user:
        display = " ".join(filter(None, [first_name, last_name])) or username or f"tg_{tg_id}"
        user = models.User(
            username=display,
            password_hash="",
            role=models.UserRole.client,
            telegram_id=tg_id,
            telegram_username=username,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if username and user.telegram_username != username:
            user.telegram_username = username
            db.commit()

    token = auth_utils.create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/register", response_model=schemas.TokenResponse)
def register(request: Request, data: schemas.RegisterRequest, db: Session = Depends(get_db)):
    _check_auth_rate(request)
    existing = db.query(models.User).filter(models.User.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Имя пользователя уже занято")
    user = models.User(
        username=data.username,
        password_hash=auth_utils.hash_password(data.password),
        role=models.UserRole.client,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = auth_utils.create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/telegram-link-token")
def get_telegram_link_token(
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.telegram_id:
        return {"already_linked": True, "telegram_username": current_user.telegram_username}
    token = secrets.token_urlsafe(16)
    expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.query(models.TelegramLinkToken).filter(
        models.TelegramLinkToken.user_id == current_user.id
    ).delete()
    db.add(models.TelegramLinkToken(token=token, user_id=current_user.id, expires_at=expires))
    db.commit()
    bot_username = os.getenv("BOT_USERNAME", "karashipikbot")
    return {
        "already_linked": False,
        "token": token,
        "link": f"https://t.me/{bot_username}?start={token}",
        "expires_in": 900,
    }


@router.get("/check-telegram-link")
def check_telegram_link(
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    db.refresh(current_user)
    return {
        "linked": current_user.telegram_id is not None,
        "telegram_username": current_user.telegram_username,
        "telegram_id": current_user.telegram_id,
    }


class LinkTelegramRequest(BaseModel):
    token: str
    telegram_id: int
    telegram_username: Optional[str] = None


@router.post("/link-telegram")
def link_telegram(
    data: LinkTelegramRequest,
    current_user: models.User = Depends(auth_utils.get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in (models.UserRole.admin, models.UserRole.worker):
        raise HTTPException(status_code=403, detail="Forbidden")
    link_token = db.query(models.TelegramLinkToken).filter(
        models.TelegramLinkToken.token == data.token
    ).first()
    if not link_token:
        raise HTTPException(status_code=404, detail="Token not found or already used")
    expires = link_token.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        db.delete(link_token)
        db.commit()
        raise HTTPException(status_code=400, detail="Token expired")

    new_user = db.query(models.User).filter(models.User.id == link_token.user_id).first()
    if not new_user:
        raise HTTPException(status_code=404, detail="User not found")

    # If this telegram_id already belongs to another account — merge
    old_user = db.query(models.User).filter(
        models.User.telegram_id == data.telegram_id,
        models.User.id != new_user.id,
    ).first()

    if old_user:
        _merge_accounts(db, old_user=old_user, new_user=new_user)

    new_user.telegram_id = data.telegram_id
    new_user.telegram_username = data.telegram_username
    db.delete(link_token)
    db.commit()
    return {"success": True, "username": new_user.username, "merged": old_user is not None}


def _merge_accounts(db: Session, old_user: models.User, new_user: models.User):
    """Transfer all data from old_user to new_user, then deactivate old_user."""
    from sqlalchemy import text

    # Orders where old_user was the worker
    db.query(models.Order).filter(models.Order.worker_id == old_user.id).update(
        {"worker_id": new_user.id}, synchronize_session=False
    )
    # Chat messages
    db.query(models.ChatMessage).filter(models.ChatMessage.sender_id == old_user.id).update(
        {"sender_id": new_user.id}, synchronize_session=False
    )
    # Global chat messages
    db.query(models.GlobalChatMessage).filter(models.GlobalChatMessage.sender_id == old_user.id).update(
        {"sender_id": new_user.id}, synchronize_session=False
    )
    # Transactions
    db.query(models.Transaction).filter(models.Transaction.worker_id == old_user.id).update(
        {"worker_id": new_user.id}, synchronize_session=False
    )
    # Work sessions
    db.query(models.WorkSession).filter(models.WorkSession.user_id == old_user.id).update(
        {"user_id": new_user.id}, synchronize_session=False
    )
    # Chat read receipts — delete if new_user already has receipt for same order
    existing_receipts = {r.order_id for r in db.query(models.ChatReadReceipt).filter(
        models.ChatReadReceipt.user_id == new_user.id
    ).all()}
    db.query(models.ChatReadReceipt).filter(
        models.ChatReadReceipt.user_id == old_user.id,
        models.ChatReadReceipt.order_id.in_(existing_receipts),
    ).delete(synchronize_session=False)
    db.query(models.ChatReadReceipt).filter(models.ChatReadReceipt.user_id == old_user.id).update(
        {"user_id": new_user.id}, synchronize_session=False
    )
    # Blog likes — skip posts new_user already liked to avoid unique constraint violation
    existing_likes = {lk.post_id for lk in db.query(models.BlogLike).filter(
        models.BlogLike.user_id == new_user.id
    ).all()}
    db.query(models.BlogLike).filter(
        models.BlogLike.user_id == old_user.id,
        models.BlogLike.post_id.in_(existing_likes),
    ).delete(synchronize_session=False)
    db.query(models.BlogLike).filter(models.BlogLike.user_id == old_user.id).update(
        {"user_id": new_user.id}, synchronize_session=False
    )
    # Blog comments
    db.query(models.BlogComment).filter(models.BlogComment.user_id == old_user.id).update(
        {"user_id": new_user.id}, synchronize_session=False
    )
    # Deactivate old account and clear its telegram_id to avoid FK/unique conflicts
    old_user.telegram_id = None
    old_user.is_active = False
    db.flush()


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(auth_utils.get_current_user)):
    return current_user


class TelegramAuthData(BaseModel):
    model_config = {"extra": "allow"}

    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str


@router.post("/telegram", response_model=schemas.TokenResponse)
def telegram_auth(request: Request, data: TelegramAuthData, db: Session = Depends(get_db)):
    _check_auth_rate(request)
    bot_token = os.getenv("BOT_TOKEN")
    if not bot_token:
        raise HTTPException(status_code=503, detail="Telegram auth not configured")

    payload = data.model_dump()
    if not auth_utils.verify_telegram_auth(payload, bot_token):
        raise HTTPException(status_code=401, detail="Invalid Telegram auth data")

    user = db.query(models.User).filter(models.User.telegram_id == data.id).first()
    if not user:
        username = data.username or f"tg_{data.id}"
        display = " ".join(filter(None, [data.first_name, data.last_name])) or username
        user = models.User(
            username=display,
            password_hash="",
            role=models.UserRole.client,
            telegram_id=data.id,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = auth_utils.create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}
