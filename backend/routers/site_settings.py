import shutil
import uuid as uuid_lib
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Any, Optional

from database import get_db
import models, auth as auth_utils

router = APIRouter(prefix="/site-settings", tags=["site-settings"])

ALLOWED_KEYS = {
    "dev_banner_enabled",
    "dev_banner_text",
    "dev_banner_color",
    # Hero
    "hero_badge",
    "hero_title",
    "hero_subtitle",
    "hero_button",
    # About
    "about_text",
    "guarantees",
    # Stats
    "stats_title",
    "stats_subtitle",
    "stat_1_num", "stat_1_label", "stat_1_desc",
    "stat_2_num", "stat_2_label", "stat_2_desc",
    "stat_3_num", "stat_3_label", "stat_3_desc",
    # Catalog
    "pinned_category_id",
    # SEO
    "seo_title",
    "seo_description",
    "seo_keywords",
    "seo_og_image",
    # Hero characters
    "hero_char_left",
    "hero_char_right",
    # Payments — LAVA
    "pay_lava_enabled",
    "pay_lava_shop_id",
    "pay_lava_secret_key",
    "pay_lava_additional_key",
    # Payments — Platega
    "pay_platega_enabled",
    "pay_platega_merchant_id",
    "pay_platega_secret",
    "pay_platega_return_url",
    # Payments — commissions (%)
    "pay_commission_sbp",
    "pay_commission_card_rf",
    "pay_commission_intl",
}


def _get(db: Session, key: str) -> Optional[str]:
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


@router.post("/upload-hero-char/{side}")
async def upload_hero_char(
    side: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    from fastapi import HTTPException
    if side not in ("left", "right"):
        raise HTTPException(status_code=400, detail="side must be 'left' or 'right'")
    ext = (file.filename or "png").rsplit(".", 1)[-1].lower() or "png"
    fname = f"hero_char_{side}_{uuid_lib.uuid4().hex[:8]}.{ext}"
    dest = Path(f"uploads/hero/{fname}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    url = f"/uploads/hero/{fname}"
    key = f"hero_char_{side}"
    _set(db, key, url)
    return {"url": url}
