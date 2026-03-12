from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas, auth as auth_utils

router = APIRouter(prefix="/products", tags=["products"])

GLOBAL_DISCOUNT_KEY = "global_discount_percent"


@router.get("/global-discount", response_model=schemas.GlobalDiscountOut)
def get_global_discount(db: Session = Depends(get_db), _=Depends(auth_utils.get_current_user)):
    setting = db.query(models.Setting).filter(models.Setting.key == GLOBAL_DISCOUNT_KEY).first()
    return {"value": float(setting.value) if setting else 0.0}


@router.patch("/global-discount", response_model=schemas.GlobalDiscountOut)
def set_global_discount(
    value: float = Body(..., ge=0, le=100, embed=True),
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    setting = db.query(models.Setting).filter(models.Setting.key == GLOBAL_DISCOUNT_KEY).first()
    if setting:
        setting.value = str(value)
    else:
        db.add(models.Setting(key=GLOBAL_DISCOUNT_KEY, value=str(value)))
    db.commit()
    return {"value": value}


@router.get("/", response_model=List[schemas.ProductOut])
def list_products(
    active_only: bool = False,
    db: Session = Depends(get_db),
):
    q = db.query(models.Product)
    if active_only:
        q = q.filter(models.Product.is_active == True)
    return q.order_by(models.Product.created_at.desc()).all()


@router.post("/", response_model=schemas.ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(data: schemas.ProductCreate, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    product = models.Product(**data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("/{product_id}", response_model=schemas.ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.get_current_user)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.patch("/{product_id}", response_model=schemas.ProductOut)
def update_product(product_id: int, data: schemas.ProductUpdate, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
