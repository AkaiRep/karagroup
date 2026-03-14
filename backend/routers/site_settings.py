from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Any

from database import get_db
import models, auth as auth_utils

router = APIRouter(prefix="/site-settings", tags=["site-settings"])

ALLOWED_KEYS = {
    "dev_banner_enabled",
    "dev_banner_text",
}


def _get(db: Session, key: str) -> str | None:
    s = db.query(models.Setting).filter(models.Setting.key == key).first()
    return s.value if s else None


def _set(db: Session, key: str, value: str):
    s = db.query(models.Setting).filter(models.Setting.key == key).first()
    if s:
        s.value = value
    else:
        db.add(models.Setting(key=key, value=value))
    db.commit()


@router.get("/")
def get_all_settings(db: Session = Depends(get_db)):
    rows = db.query(models.Setting).filter(models.Setting.key.in_(ALLOWED_KEYS)).all()
    return {r.key: r.value for r in rows}


class SettingUpdate(BaseModel):
    value: Any


@router.patch("/{key}")
def update_setting(
    key: str,
    body: SettingUpdate,
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    if key not in ALLOWED_KEYS:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Unknown setting key")
    _set(db, key, str(body.value))
    return {"key": key, "value": str(body.value)}
