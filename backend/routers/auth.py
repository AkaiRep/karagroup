import os
import hmac
import hashlib
import time
from collections import defaultdict, deque
from urllib.parse import parse_qsl
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
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
