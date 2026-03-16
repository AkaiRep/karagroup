from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas, auth as auth_utils

router = APIRouter(prefix="/blog", tags=["blog"])


@router.get("/", response_model=List[schemas.PostOut])
def list_posts(db: Session = Depends(get_db)):
    return db.query(models.Post).filter(models.Post.is_published == True).order_by(models.Post.created_at.desc()).all()


@router.get("/all", response_model=List[schemas.PostOut])
def list_posts_all(db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    return db.query(models.Post).order_by(models.Post.created_at.desc()).all()


@router.get("/{slug}", response_model=schemas.PostOut)
def get_post(slug: str, db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.slug == slug, models.Post.is_published == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="Not found")
    return post


@router.post("/", response_model=schemas.PostOut)
def create_post(data: schemas.PostCreate, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    if db.query(models.Post).filter(models.Post.slug == data.slug).first():
        raise HTTPException(status_code=400, detail="Slug already exists")
    post = models.Post(**data.model_dump())
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.patch("/{post_id}", response_model=schemas.PostOut)
def update_post(post_id: int, data: schemas.PostUpdate, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Not found")
    updates = data.model_dump(exclude_none=True)
    if "slug" in updates and updates["slug"] != post.slug:
        if db.query(models.Post).filter(models.Post.slug == updates["slug"]).first():
            raise HTTPException(status_code=400, detail="Slug already exists")
    for k, v in updates.items():
        setattr(post, k, v)
    from datetime import datetime, timezone
    post.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(post)
    return post


@router.delete("/{post_id}")
def delete_post(post_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    post = db.query(models.Post).filter(models.Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(post)
    db.commit()
    return {"ok": True}
