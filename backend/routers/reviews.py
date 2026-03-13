from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ReviewOut(BaseModel):
    id: int
    author: str
    text: str
    rating: int
    game: Optional[str] = None
    date_str: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/", response_model=List[ReviewOut])
def get_reviews(db: Session = Depends(get_db)):
    return db.query(models.Review).order_by(models.Review.id.desc()).all()
