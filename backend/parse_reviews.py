"""
Парсер отзывов с FunPay.
Запуск: python3 parse_reviews.py
"""
import httpx
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session
from database import SessionLocal
import models

FUNPAY_URL = "https://funpay.com/users/4503762/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "ru-RU,ru;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def parse_rating(item) -> int:
    """Извлекает рейтинг из класса div.ratingX"""
    rating_div = item.select_one(".review-item-rating .rating > div")
    if rating_div:
        for cls in rating_div.get("class", []):
            if cls.startswith("rating") and cls[6:].isdigit():
                return int(cls[6:])
    return 5


def parse_reviews() -> list[dict]:
    reviews = []
    try:
        resp = httpx.get(FUNPAY_URL, headers=HEADERS, timeout=15, follow_redirects=True)
        resp.raise_for_status()
    except Exception as e:
        print(f"[ERROR] Failed to fetch page: {e}")
        return reviews

    soup = BeautifulSoup(resp.text, "html.parser")

    for container in soup.select(".review-container"):
        text_el = container.select_one(".review-item-text")
        date_el = container.select_one(".review-item-date")
        detail_el = container.select_one(".review-item-detail")

        text = text_el.get_text(strip=True) if text_el else ""
        if not text or len(text) < 2:
            continue

        # Игнорируем отзывы из одного числа типа "5"
        if text.isdigit():
            continue

        date_str = date_el.get_text(strip=True) if date_el else ""
        detail = detail_el.get_text(strip=True) if detail_el else ""
        # detail выглядит как "Genshin Impact, 8 €" — берём только игру
        game = detail.split(",")[0].strip() if detail else ""
        rating = parse_rating(container)

        reviews.append({
            "author": "Покупатель",
            "text": text,
            "rating": rating,
            "game": game,
            "date_str": date_str,
        })

    print(f"[INFO] Parsed {len(reviews)} reviews")
    return reviews


def save_reviews(reviews: list[dict]):
    db: Session = SessionLocal()
    try:
        existing = {r.text for r in db.query(models.Review).all()}
        added = 0
        for r in reviews:
            if r["text"] not in existing:
                db.add(models.Review(**r))
                added += 1
        db.commit()
        print(f"[INFO] Saved {added} new reviews")
    finally:
        db.close()


if __name__ == "__main__":
    reviews = parse_reviews()
    if reviews:
        save_reviews(reviews)
    else:
        print("[WARN] No reviews found")
