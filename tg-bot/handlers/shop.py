from aiogram import Router, F
from aiogram.types import CallbackQuery
from aiogram.fsm.context import FSMContext

from api import api
from keyboards import categories_kb, products_kb, back_kb
from utils import edit_or_send

router = Router()


def _effective_discount(product: dict, global_discount: float) -> float:
    return product["discount_percent"] if product["discount_percent"] > 0 else global_discount


def _discounted_price(price: float, discount: float) -> float:
    return round(price * (1 - discount / 100), 2)


def format_product_list(category: dict, products: list, global_discount: float) -> str:
    lines = [f"📦 <b>{category['name']}</b>"]

    if category.get("description"):
        lines.append(f"\n{category['description']}")

    lines.append("")

    for p in products:
        disc = _effective_discount(p, global_discount)
        if disc > 0:
            final = _discounted_price(p["price"], disc)
            lines.append(
                f"• {p['name']} — <s>{p['price']} ₽</s> <b>{final} ₽</b> (-{disc}%)"
            )
        else:
            lines.append(f"• {p['name']} — <b>{p['price']} ₽</b>")

    return "\n".join(lines)


@router.callback_query(F.data == "shop")
async def show_categories(callback: CallbackQuery, state: FSMContext):
    categories = await api.get_categories()
    data = await state.get_data()
    cart = data.get("cart", {})

    if not categories:
        await edit_or_send(callback,
            "😔 Категорий пока нет",
            reply_markup=back_kb("main"),
        )
        await callback.answer()
        return

    await edit_or_send(callback,
        "🛒 <b>Магазин</b>\n\nВыберите категорию:",
        reply_markup=categories_kb(categories, len(cart)),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data.startswith("cat_"))
async def show_category_products(callback: CallbackQuery, state: FSMContext):
    category_id = int(callback.data.split("_")[1])
    await _render_category(callback, state, category_id, page=0)


@router.callback_query(F.data.startswith("pcat_"))
async def paginate_category(callback: CallbackQuery, state: FSMContext):
    _, category_id_str, page_str = callback.data.split("_")
    await _render_category(callback, state, int(category_id_str), page=int(page_str))


@router.callback_query(F.data == "noop")
async def noop(callback: CallbackQuery):
    await callback.answer()


async def _render_category(callback: CallbackQuery, state: FSMContext, category_id: int, page: int):
    categories, all_products, gd = await _fetch_catalog()
    category = next((c for c in categories if c["id"] == category_id), None)
    if not category:
        await callback.answer("Категория не найдена")
        return

    products = [p for p in all_products if p.get("category_id") == category_id]
    global_discount = gd.get("value", 0)

    data = await state.get_data()
    cart = data.get("cart", {})
    await state.update_data(current_category_id=category_id, current_page=page)

    if not products:
        await edit_or_send(callback,
            f"📦 <b>{category['name']}</b>\n\nВ этой категории пока нет услуг.",
            reply_markup=back_kb("shop"),
            parse_mode="HTML",
        )
        await callback.answer()
        return

    text = format_product_list(category, products, global_discount)
    await edit_or_send(callback,
        text,
        reply_markup=products_kb(products, cart, category_id, page),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data.startswith("add_"))
async def toggle_cart(callback: CallbackQuery, state: FSMContext):
    product_id = int(callback.data.split("_")[1])

    categories, all_products, gd = await _fetch_catalog()
    product = next((p for p in all_products if p["id"] == product_id), None)
    if not product:
        await callback.answer("Услуга не найдена")
        return

    global_discount = gd.get("value", 0)
    data = await state.get_data()
    cart = data.get("cart", {})
    pid = str(product_id)

    if pid in cart:
        del cart[pid]
        await callback.answer("Убрано из корзины")
    else:
        disc = _effective_discount(product, global_discount)
        cart[pid] = {
            "id": product["id"],
            "name": product["name"],
            "price": product["price"],
            "discount_percent": disc,
        }
        await callback.answer("✅ Добавлено в корзину!")

    await state.update_data(cart=cart)

    # Refresh the products view keeping current page
    category_id = data.get("current_category_id")
    current_page = data.get("current_page", 0)
    if category_id:
        category = next((c for c in categories if c["id"] == category_id), None)
        products = [p for p in all_products if p.get("category_id") == category_id]
        if category and products:
            text = format_product_list(category, products, global_discount)
            await edit_or_send(callback,
                text,
                reply_markup=products_kb(products, cart, category_id, current_page),
                parse_mode="HTML",
            )


async def _fetch_catalog():
    import asyncio
    categories, all_products, gd = await asyncio.gather(
        api.get_categories(),
        api.get_products(active_only=True),
        api.get_global_discount(),
    )
    return categories, all_products, gd
