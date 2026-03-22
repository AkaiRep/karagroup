import shutil
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List

from database import get_db
import models, auth as auth_utils

router = APIRouter(prefix="/teleports", tags=["teleports"])

TELEPORTS_DIR = Path("uploads/teleports")


class GroupCreate(BaseModel):
    name: str


class GroupOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class PresetOut(BaseModel):
    id: int
    group_id: int
    name: str
    filename: str

    class Config:
        from_attributes = True


@router.get("/groups", response_model=List[GroupOut])
def list_groups(db: Session = Depends(get_db), _=Depends(auth_utils.get_current_user)):
    return db.query(models.TeleportGroup).order_by(models.TeleportGroup.name).all()


@router.post("/groups", response_model=GroupOut, status_code=201)
def create_group(data: GroupCreate, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    group = models.TeleportGroup(name=data.name)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


@router.patch("/groups/{group_id}", response_model=GroupOut)
def update_group(group_id: int, data: GroupCreate, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    group = db.query(models.TeleportGroup).filter(models.TeleportGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    group.name = data.name
    db.commit()
    db.refresh(group)
    return group


@router.delete("/groups/{group_id}", status_code=204)
def delete_group(group_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    group = db.query(models.TeleportGroup).filter(models.TeleportGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    # Delete files on disk
    for preset in group.presets:
        path = TELEPORTS_DIR / preset.filename
        if path.exists():
            path.unlink()
    db.delete(group)
    db.commit()


@router.get("/groups/{group_id}/presets", response_model=List[PresetOut])
def list_presets(group_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.get_current_user)):
    group = db.query(models.TeleportGroup).filter(models.TeleportGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return db.query(models.TeleportPreset).filter(models.TeleportPreset.group_id == group_id).order_by(models.TeleportPreset.name).all()


@router.post("/groups/{group_id}/presets", response_model=PresetOut, status_code=201)
async def upload_preset(
    group_id: int,
    name: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    group = db.query(models.TeleportGroup).filter(models.TeleportGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    TELEPORTS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.json"
    dest = TELEPORTS_DIR / filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    preset = models.TeleportPreset(group_id=group_id, name=name, filename=filename)
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return preset


@router.delete("/presets/{preset_id}", status_code=204)
def delete_preset(preset_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    preset = db.query(models.TeleportPreset).filter(models.TeleportPreset.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    path = TELEPORTS_DIR / preset.filename
    if path.exists():
        path.unlink()
    db.delete(preset)
    db.commit()


@router.get("/presets/{preset_id}/download")
def download_preset(preset_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.get_current_user)):
    preset = db.query(models.TeleportPreset).filter(models.TeleportPreset.id == preset_id).first()
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    path = TELEPORTS_DIR / preset.filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="application/json", filename=f"{preset.name}.json")
