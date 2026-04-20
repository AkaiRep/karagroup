from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas, auth as auth_utils

router = APIRouter(prefix="/applications", tags=["applications"])


@router.post("/", response_model=schemas.WorkerApplicationOut, status_code=201)
def create_application(data: schemas.WorkerApplicationCreate, db: Session = Depends(get_db)):
    if not data.consent_data or not data.consent_documents:
        raise HTTPException(status_code=400, detail="Необходимо дать оба согласия")
    obj = models.WorkerApplication(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/", response_model=List[schemas.WorkerApplicationOut])
def list_applications(db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    return db.query(models.WorkerApplication).order_by(models.WorkerApplication.id.desc()).all()


@router.patch("/{app_id}", response_model=schemas.WorkerApplicationOut)
def update_application(
    app_id: int,
    data: schemas.WorkerApplicationUpdate,
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    obj = db.query(models.WorkerApplication).filter(models.WorkerApplication.id == app_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{app_id}")
def delete_application(app_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    obj = db.query(models.WorkerApplication).filter(models.WorkerApplication.id == app_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(obj)
    db.commit()
    return {"ok": True}
