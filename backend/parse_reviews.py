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
}


def parse_reviews() -> list[dict]:
    reviews = []
    try:
        resp = httpx.get(FUNPAY_URL, headers=HEADERS, timeout=15, follow_redirects=True)
        resp.raise_for_status()
    except Exception as e:
        print(f"[ERROR] Failed to fetch page: {e}")
        return reviews

    soup = BeautifulSoup(resp.text, "html.parser")

    # Отзывы в блоках .review или .order-review
    items = soup.select(".review-item, .order-review, [class*='review']")

    # Fallback — ищем по структуре FunPay
    if not items:
        items = soup.select(".param-item")

    for item in items:
        text_el = item.select_one(".review-text, .text, p")
        author_el = item.select_one(".nickname, .username, .name, a[href*='/users/']")
        date_el = item.select_one(".date, time, .ago")
        game_el = item.select_one(".game, .category, .lot-name")

        text = text_el.get_text(strip=True) if text_el else ""
        author = author_el.get_text(strip=True) if author_el else "Покупатель"
        date_str = date_el.get_text(strip=True) if date_el else ""
        game = game_el.get_text(strip=True) if game_el else ""

        if not text or len(text) < 3:
            continue

        reviews.append({
            "author": author,
            "text": text,
            "rating": 5,
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
        print("[WARN] No reviews found — check selectors")
