from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, Body
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas, auth as auth_utils

router = APIRouter(prefix="/products", tags=["products"])

GLOBAL_DISCOUNT_KEY = "global_discount_percent"


@router.get("/global-discount", response_model=schemas.GlobalDiscountOut)
def get_global_discount(db: Session = Depends(get_db)):
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
    from sqlalchemy import func
    q = db.query(models.Product)
    if active_only:
        q = q.filter(models.Product.is_active == True)
    products = q.all()

    counts = dict(
        db.query(models.OrderItem.product_id, func.count(models.OrderItem.id))
        .group_by(models.OrderItem.product_id)
        .all()
    )
    for p in products:
        p.order_count = counts.get(p.id, 0)

    return sorted(products, key=lambda p: p.order_count, reverse=True)


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


@router.post("/{product_id}/image", response_model=schemas.ProductOut)
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    ext = Path(file.filename).suffix.lower() if file.filename else '.jpg'
    filename = f"product_{product_id}{ext}"
    path = Path("uploads/products") / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        f.write(await file.read())
    product.image_url = f"/uploads/products/{filename}"
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}/image", response_model=schemas.ProductOut)
def delete_product_image(
    product_id: int,
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.image_url = None
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


# ── Subregions ────────────────────────────────────────────────────────────────

@router.get("/{product_id}/subregions", response_model=List[schemas.SubregionOut])
def list_subregions(product_id: int, db: Session = Depends(get_db)):
    return db.query(models.ProductSubregion).filter(
        models.ProductSubregion.product_id == product_id
    ).order_by(models.ProductSubregion.id).all()


@router.post("/{product_id}/subregions", response_model=schemas.SubregionOut, status_code=201)
def create_subregion(
    product_id: int,
    data: schemas.SubregionCreate,
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if data.auto_price:
        count = db.query(models.ProductSubregion).filter(
            models.ProductSubregion.product_id == product_id
        ).count() + 1
        price = round(product.price / count, 2)
        # пересчитываем существующие авто-субрегионы
        existing = db.query(models.ProductSubregion).filter(
            models.ProductSubregion.product_id == product_id,
            models.ProductSubregion.auto_price == True,
        ).all()
        for s in existing:
            s.price = price
        obj = models.ProductSubregion(product_id=product_id, name=data.name, price=price, auto_price=True)
    else:
        obj = models.ProductSubregion(product_id=product_id, name=data.name, price=data.price, auto_price=False)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/{product_id}/subregions/{sub_id}", response_model=schemas.SubregionOut)
def update_subregion(
    product_id: int,
    sub_id: int,
    data: schemas.SubregionUpdate,
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    obj = db.query(models.ProductSubregion).filter(
        models.ProductSubregion.id == sub_id,
        models.ProductSubregion.product_id == product_id,
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Subregion not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{product_id}/subregions/{sub_id}")
def delete_subregion(
    product_id: int,
    sub_id: int,
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    obj = db.query(models.ProductSubregion).filter(
        models.ProductSubregion.id == sub_id,
        models.ProductSubregion.product_id == product_id,
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Subregion not found")
    db.delete(obj)
    db.commit()
    # пересчитываем авто-цены после удаления
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if product:
        remaining = db.query(models.ProductSubregion).filter(
            models.ProductSubregion.product_id == product_id,
            models.ProductSubregion.auto_price == True,
        ).all()
        if remaining:
            price = round(product.price / len(remaining), 2)
            for s in remaining:
                s.price = price
            db.commit()
    return {"ok": True}
