from aiogram.types import InlineKeyboardMarkup, WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder


def main_menu_kb(channel_url: str, web_app_url: str = "") -> InlineKeyboardMarkup:
    from aiogram.types import InlineKeyboardButton
    kb = InlineKeyboardBuilder()
    if web_app_url:
        kb.row(InlineKeyboardButton(text="🌐 Открыть магазин", web_app=WebAppInfo(url=web_app_url)))
    kb.button(text="🛒 Магазин", callback_data="shop")
    kb.button(text="📢 Наш канал", url=channel_url)
    kb.button(text="📋 Мои заказы", callback_data="my_orders")
    kb.button(text="ℹ️ О боте", callback_data="about")
    kb.adjust(2, 2)
    return kb.as_markup()


def categories_kb(categories: list, cart_count: int = 0) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    for cat in categories:
        kb.button(text=cat["name"], callback_data=f"cat_{cat['id']}")
    kb.adjust(2)
    row = []
    if cart_count > 0:
        kb.button(text=f"🛒 Корзина ({cart_count})", callback_data="cart")
        row.append(1)
    kb.button(text="← Назад", callback_data="main")
    row.append(1)
    kb.adjust(2, *row)
    return kb.as_markup()


PAGE_SIZE = 5


PAGE_SIZE = 5


def products_kb(products: list, cart: dict, category_id: int, page: int = 0) -> InlineKeyboardMarkup:
    from aiogram.types import InlineKeyboardButton

    total = len(products)
    total_pages = max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE)
    page = max(0, min(page, total_pages - 1))

    kb = InlineKeyboardBuilder()

    # Product buttons — one per row
    for p in products[page * PAGE_SIZE:(page + 1) * PAGE_SIZE]:
        in_cart = str(p["id"]) in cart
        kb.row(InlineKeyboardButton(
            text=f"{'✅ ' if in_cart else '➕ '}{p['name']}",
            callback_data=f"add_{p['id']}",
        ))

    # Pagination row — three buttons in one row
    if total_pages > 1:
        kb.row(
            InlineKeyboardButton(
                text="◀️" if page > 0 else "·",
                callback_data=f"pcat_{category_id}_{page - 1}" if page > 0 else "noop",
            ),
            InlineKeyboardButton(
                text=f"{page + 1} / {total_pages}",
                callback_data="noop",
            ),
            InlineKeyboardButton(
                text="▶️" if page < total_pages - 1 else "·",
                callback_data=f"pcat_{category_id}_{page + 1}" if page < total_pages - 1 else "noop",
            ),
        )

    cart_count = len(cart)
    if cart_count > 0:
        kb.row(InlineKeyboardButton(text=f"🛒 Корзина ({cart_count})", callback_data="cart"))
    kb.row(InlineKeyboardButton(text="← К категориям", callback_data="shop"))

    return kb.as_markup()


def cart_kb(cart: dict) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    for pid, item in cart.items():
        kb.button(text=f"❌ {item['name']}", callback_data=f"remove_{pid}")
    kb.adjust(1)
    if cart:
        kb.button(text="✅ Оформить заказ", callback_data="checkout")
    kb.button(text="🛒 Продолжить покупки", callback_data="shop")
    kb.adjust(1)
    return kb.as_markup()


def promo_kb() -> InlineKeyboardMarkup:
    from aiogram.types import InlineKeyboardButton
    kb = InlineKeyboardBuilder()
    kb.row(InlineKeyboardButton(text="➡️ Пропустить", callback_data="skip_promo"))
    kb.row(InlineKeyboardButton(text="← Назад в корзину", callback_data="cart"))
    return kb.as_markup()


def confirm_order_kb() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="💳 Оплатить", callback_data="pay_confirm")
    kb.button(text="← Назад в корзину", callback_data="cart")
    kb.adjust(1)
    return kb.as_markup()


def about_kb(terms_url: str, privacy_url: str) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="📄 Пользовательское соглашение", url=terms_url)
    kb.button(text="🔒 Политика конфиденциальности", url=privacy_url)
    kb.button(text="← Назад", callback_data="main")
    kb.adjust(1)
    return kb.as_markup()


def back_kb(target: str = "main") -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="← Назад", callback_data=target)
    return kb.as_markup()
