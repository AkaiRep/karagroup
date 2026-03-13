import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
import models, schemas, auth as auth_utils

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.TokenResponse)
def login(data: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == data.username).first()
    if not user or not auth_utils.verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
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
def telegram_auth(data: TelegramAuthData, db: Session = Depends(get_db)):
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
