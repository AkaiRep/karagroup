from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas, auth as auth_utils

router = APIRouter(prefix="/faq", tags=["faq"])


@router.get("/", response_model=List[schemas.FAQOut])
def list_faq(db: Session = Depends(get_db)):
    return db.query(models.FAQ).filter(models.FAQ.is_active == True).order_by(models.FAQ.order, models.FAQ.id).all()


@router.get("/all", response_model=List[schemas.FAQOut])
def list_faq_all(db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    return db.query(models.FAQ).order_by(models.FAQ.order, models.FAQ.id).all()


@router.post("/", response_model=schemas.FAQOut)
def create_faq(data: schemas.FAQCreate, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    item = models.FAQ(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{faq_id}", response_model=schemas.FAQOut)
def update_faq(faq_id: int, data: schemas.FAQUpdate, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    item = db.query(models.FAQ).filter(models.FAQ.id == faq_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{faq_id}")
def delete_faq(faq_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    item = db.query(models.FAQ).filter(models.FAQ.id == faq_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()
    return {"ok": True}
