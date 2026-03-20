import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas, auth as auth_utils

SCREENSHOTS_DIR = Path("uploads/screenshots")

router = APIRouter(prefix="/users", tags=["users"])

# Gap in seconds: if no heartbeat longer than this, the session is considered ended
SESSION_GAP = 120


def _ensure_utc(dt: datetime) -> datetime:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _online_threshold_seconds() -> int:
    return SESSION_GAP + 30  # a bit more than gap to account for delays


@router.get("/", response_model=List[schemas.UserOut])
def list_users(db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    return db.query(models.User).all()


@router.post("/heartbeat", status_code=204)
def heartbeat(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    now = datetime.now(timezone.utc)
    last_seen = _ensure_utc(current_user.last_seen_at)

    open_session = (
        db.query(models.WorkSession)
        .filter(
            models.WorkSession.user_id == current_user.id,
            models.WorkSession.ended_at == None,
        )
        .first()
    )

    if open_session:
        if last_seen and (now - last_seen).total_seconds() > SESSION_GAP:
            # Gap detected — close old session, start fresh
            open_session.ended_at = last_seen
            db.add(models.WorkSession(user_id=current_user.id, started_at=now))
        # else session continues, nothing to update
    else:
        db.add(models.WorkSession(user_id=current_user.id, started_at=now))

    current_user.last_seen_at = now
    db.commit()


@router.post("/screenshot", status_code=204)
async def upload_screenshot(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    if current_user.role != models.UserRole.worker:
        raise HTTPException(status_code=403, detail="Only workers can upload screenshots")
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    path = SCREENSHOTS_DIR / f"{current_user.id}.jpg"
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)


@router.get("/workers/stats", response_model=List[schemas.WorkerStatsOut])
def workers_stats(
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    now = datetime.now(timezone.utc)
    online_cutoff = SESSION_GAP + 30

    workers = (
        db.query(models.User)
        .filter(models.User.role == models.UserRole.worker)
        .all()
    )

    result = []
    for w in workers:
        last_seen = _ensure_utc(w.last_seen_at)
        is_online = bool(last_seen and (now - last_seen).total_seconds() < online_cutoff)

        # Total online time
        sessions = (
            db.query(models.WorkSession)
            .filter(models.WorkSession.user_id == w.id)
            .all()
        )
        total_online = 0
        for s in sessions:
            start = _ensure_utc(s.started_at)
            end = _ensure_utc(s.ended_at) if s.ended_at else now
            total_online += max(0, (end - start).total_seconds())

        # Order time stats
        orders = (
            db.query(models.Order)
            .filter(
                models.Order.worker_id == w.id,
                models.Order.taken_at != None,
            )
            .all()
        )
        total_orders = len(orders)
        completed = [
            o for o in orders
            if o.completed_at and o.taken_at
        ]
        total_order_secs = sum(
            (_ensure_utc(o.completed_at) - _ensure_utc(o.taken_at)).total_seconds()
            for o in completed
        )
        avg_order_secs = (total_order_secs / len(completed)) if completed else None

        result.append(schemas.WorkerStatsOut(
            user_id=w.id,
            username=w.username,
            is_online=is_online,
            last_seen_at=last_seen,
            total_online_seconds=int(total_online),
            total_orders=total_orders,
            completed_orders=len(completed),
            avg_order_seconds=avg_order_secs,
            total_order_seconds=int(total_order_secs),
        ))

    return result


@router.post("/", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def create_user(data: schemas.UserCreate, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    if db.query(models.User).filter(models.User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    user = models.User(
        username=data.username,
        email=data.email,
        password_hash=auth_utils.hash_password(data.password),
        role=data.role,
        worker_percentage=data.worker_percentage,
        is_vip=data.is_vip,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(user_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/{user_id}/screenshot")
def get_screenshot(user_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    path = SCREENSHOTS_DIR / f"{user_id}.jpg"
    if not path.exists():
        raise HTTPException(status_code=404, detail="No screenshot available")
    mtime_ms = int(os.path.getmtime(path) * 1000)
    return FileResponse(path, media_type="image/jpeg", headers={"X-Captured-At": str(mtime_ms)})


@router.patch("/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: int, data: schemas.UserUpdate, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if data.email is not None:
        user.email = data.email
    if data.worker_percentage is not None:
        user.worker_percentage = data.worker_percentage
    if data.is_vip is not None:
        user.is_vip = data.is_vip
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.password is not None:
        user.password_hash = auth_utils.hash_password(data.password)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
