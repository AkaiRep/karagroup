from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas, auth as auth_utils

router = APIRouter(prefix="/media", tags=["media"])


def _enrich_promo(promo: models.PromoCode, db: Session) -> schemas.PromoCodeOut:
    orders = (
        db.query(models.Order)
        .filter(
            models.Order.promo_code_id == promo.id,
            models.Order.status == models.OrderStatus.confirmed,
        )
        .all()
    )
    return schemas.PromoCodeOut(
        id=promo.id,
        code=promo.code,
        discount_percent=promo.discount_percent,
        media_percent=promo.media_percent,
        is_active=promo.is_active,
        created_at=promo.created_at,
        order_count=len(orders),
        total_media_earnings=sum(o.media_earnings or 0 for o in orders),
    )


def _enrich_media(media: models.Media, db: Session) -> schemas.MediaOut:
    return schemas.MediaOut(
        id=media.id,
        name=media.name,
        is_active=media.is_active,
        created_at=media.created_at,
        promo_codes=[_enrich_promo(p, db) for p in media.promo_codes],
    )


@router.get("/", response_model=List[schemas.MediaOut])
def list_media(db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    all_media = db.query(models.Media).order_by(models.Media.created_at.desc()).all()
    return [_enrich_media(m, db) for m in all_media]


@router.post("/", response_model=schemas.MediaOut, status_code=status.HTTP_201_CREATED)
def create_media(data: schemas.MediaCreate, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    m = models.Media(name=data.name)
    db.add(m)
    db.commit()
    db.refresh(m)
    return _enrich_media(m, db)


@router.patch("/{media_id}", response_model=schemas.MediaOut)
def update_media(media_id: int, data: schemas.MediaUpdate, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    m = db.query(models.Media).filter(models.Media.id == media_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Media not found")
    if data.name is not None:
        m.name = data.name
    if data.is_active is not None:
        m.is_active = data.is_active
    db.commit()
    db.refresh(m)
    return _enrich_media(m, db)


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(media_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    m = db.query(models.Media).filter(models.Media.id == media_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Media not found")
    db.delete(m)
    db.commit()


@router.post("/{media_id}/promo-codes", response_model=schemas.PromoCodeOut, status_code=status.HTTP_201_CREATED)
def create_promo_code(media_id: int, data: schemas.PromoCodeCreate, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    if not db.query(models.Media).filter(models.Media.id == media_id).first():
        raise HTTPException(status_code=404, detail="Media not found")
    if db.query(models.PromoCode).filter(models.PromoCode.code == data.code).first():
        raise HTTPException(status_code=400, detail="Promo code already exists")
    p = models.PromoCode(
        media_id=media_id,
        code=data.code.upper(),
        discount_percent=data.discount_percent,
        media_percent=data.media_percent,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _enrich_promo(p, db)


@router.patch("/promo-codes/{promo_id}", response_model=schemas.PromoCodeOut)
def update_promo_code(promo_id: int, data: schemas.PromoCodeUpdate, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    p = db.query(models.PromoCode).filter(models.PromoCode.id == promo_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Promo code not found")
    if data.discount_percent is not None:
        p.discount_percent = data.discount_percent
    if data.media_percent is not None:
        p.media_percent = data.media_percent
    if data.is_active is not None:
        p.is_active = data.is_active
    db.commit()
    db.refresh(p)
    return _enrich_promo(p, db)


@router.delete("/promo-codes/{promo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_promo_code(promo_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    p = db.query(models.PromoCode).filter(models.PromoCode.id == promo_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Promo code not found")
    db.delete(p)
    db.commit()


@router.get("/promo-codes/lookup/{code}", response_model=schemas.PromoCodeOut)
def lookup_promo_code(code: str, db: Session = Depends(get_db)):
    p = db.query(models.PromoCode).filter(
        models.PromoCode.code == code.upper(),
        models.PromoCode.is_active == True,
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Promo code not found or inactive")
    return _enrich_promo(p, db)
