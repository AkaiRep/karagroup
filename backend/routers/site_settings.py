from fastapi import APIRouter, Depends
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
    # Design
    "accent_color",
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
