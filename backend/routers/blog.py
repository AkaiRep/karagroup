from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.orm import Session
from typing import List
from pathlib import Path
import shutil, uuid as uuid_lib, hashlib
from datetime import date
from database import get_db
import models, schemas, auth as auth_utils

router = APIRouter(prefix="/api/blog", tags=["blog"])


@router.get("/", response_model=List[schemas.PostOut])
def list_posts(db: Session = Depends(get_db)):
    return db.query(models.Post).filter(models.Post.is_published == True).order_by(models.Post.created_at.desc()).all()


@router.get("/all", response_model=List[schemas.PostOut])
def list_posts_all(db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    return db.query(models.Post).order_by(models.Post.created_at.desc()).all()


# Admin comment endpoints — MUST be before /{slug} to avoid slug-matching "admin"
@router.get("/admin/comments")
def list_pending_comments(db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    comments = db.query(models.BlogComment).filter(models.BlogComment.is_approved == False).order_by(models.BlogComment.created_at.desc()).all()
    result = []
    for c in comments:
        result.append({
            "id": c.id,
            "post_id": c.post_id,
            "post_title": c.post.title if c.post else "",
            "text": c.text,
            "author_name": c.user.username if c.user else "?",
            "created_at": c.created_at.isoformat(),
        })
    return result


@router.patch("/admin/comments/{comment_id}/approve")
def approve_comment(comment_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    c = db.query(models.BlogComment).filter(models.BlogComment.id == comment_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    c.is_approved = True
    db.commit()
    return {"ok": True}


@router.delete("/admin/comments/{comment_id}")
def delete_comment(comment_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    c = db.query(models.BlogComment).filter(models.BlogComment.id == comment_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(c)
    db.commit()
    return {"ok": True}


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


@router.post("/upload-image")
async def upload_blog_image(file: UploadFile = File(...), _=Depends(auth_utils.require_admin)):
    ext = (file.filename or '').rsplit('.', 1)[-1].lower()
    if ext not in ('jpg', 'jpeg', 'png', 'gif', 'webp'):
        raise HTTPException(status_code=400, detail="Unsupported file type")
    fname = f"{uuid_lib.uuid4().hex}.{ext}"
    dest = Path(f"uploads/blog/{fname}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open('wb') as out:
        shutil.copyfileobj(file.file, out)
    return {"url": f"/uploads/blog/{fname}"}


@router.post("/{slug}/view")
def increment_view(slug: str, request: Request, db: Session = Depends(get_db)):
    post = db.query(models.Post).filter(models.Post.slug == slug, models.Post.is_published == True).first()
    if not post:
        return {"ok": True}
    # Get real IP (behind proxy)
    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0].strip() if forwarded else request.client.host
    ip_hash = hashlib.sha256(ip.encode()).hexdigest()
    today = date.today().isoformat()
    already = db.query(models.BlogViewLog).filter(
        models.BlogViewLog.post_id == post.id,
        models.BlogViewLog.ip_hash == ip_hash,
        models.BlogViewLog.viewed_date == today,
    ).first()
    if not already:
        db.add(models.BlogViewLog(post_id=post.id, ip_hash=ip_hash, viewed_date=today))
        post.views = (post.views or 0) + 1
        db.commit()
    return {"ok": True}


@router.get("/{slug}/social")
def get_social(slug: str, db: Session = Depends(get_db), current_user=Depends(auth_utils.get_optional_user)):
    post = db.query(models.Post).filter(models.Post.slug == slug, models.Post.is_published == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="Not found")
    likes_count = db.query(models.BlogLike).filter(models.BlogLike.post_id == post.id).count()
    liked_by_me = False
    if current_user:
        liked_by_me = db.query(models.BlogLike).filter(models.BlogLike.post_id == post.id, models.BlogLike.user_id == current_user.id).first() is not None
    comments = db.query(models.BlogComment).filter(models.BlogComment.post_id == post.id, models.BlogComment.is_approved == True).order_by(models.BlogComment.created_at.asc()).all()
    result_comments = []
    for c in comments:
        result_comments.append({
            "id": c.id,
            "post_id": c.post_id,
            "user_id": c.user_id,
            "text": c.text,
            "is_approved": c.is_approved,
            "created_at": c.created_at,
            "author_name": c.user.username if c.user else "Аноним",
            "author_photo": getattr(c.user, 'photo_url', None),
        })
    return {"views": post.views or 0, "likes": likes_count, "liked_by_me": liked_by_me, "comments": result_comments}


@router.post("/{slug}/like")
def toggle_like(slug: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    post = db.query(models.Post).filter(models.Post.slug == slug, models.Post.is_published == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="Not found")
    existing = db.query(models.BlogLike).filter(models.BlogLike.post_id == post.id, models.BlogLike.user_id == current_user.id).first()
    if existing:
        db.delete(existing)
        liked = False
    else:
        db.add(models.BlogLike(post_id=post.id, user_id=current_user.id))
        liked = True
    db.commit()
    likes_count = db.query(models.BlogLike).filter(models.BlogLike.post_id == post.id).count()
    return {"liked": liked, "likes": likes_count}


@router.post("/{slug}/comments")
def add_comment(slug: str, data: schemas.BlogCommentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    post = db.query(models.Post).filter(models.Post.slug == slug, models.Post.is_published == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="Not found")
    comment = models.BlogComment(post_id=post.id, user_id=current_user.id, text=data.text)
    db.add(comment)
    db.commit()
    return {"ok": True, "message": "Комментарий отправлен на модерацию"}
