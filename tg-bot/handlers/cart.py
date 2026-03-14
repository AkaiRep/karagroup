import logging
from aiogram import Router, F
from aiogram.types import CallbackQuery, Message
from aiogram.fsm.context import FSMContext

from api import api
from config import settings
from keyboards import cart_kb, promo_kb, confirm_order_kb, main_menu_kb
from utils import edit_or_send
from states import ShopStates
from handlers.start import WELCOME_TEXT

router = Router()
log = logging.getLogger(__name__)


def format_cart(cart: dict, promo: dict | None = None) -> str:
    if not cart:
        return "🛒 Ваша корзина пуста"

    lines = ["🛒 <b>Ваша корзина:</b>\n"]
    total = 0.0
    for item in cart.values():
        disc = item.get("discount_percent", 0)
        price = round(item["price"] * (1 - disc / 100), 2) if disc > 0 else item["price"]
        total += price
        line = f"• {item['name']} — <b>{price} ₽</b>"
        if disc > 0:
            line += f" (-{disc}%)"
        lines.append(line)

    lines.append(f"\n💰 Итого: <b>{round(total, 2)} ₽</b>")

    if promo:
        discounted = round(total * (1 - promo["discount_percent"] / 100), 2)
        lines.append(
            f"🎟 Промокод <b>{promo['code']}</b>: -{promo['discount_percent']}%"
            f" → <b>{discounted} ₽</b>"
        )

    return "\n".join(lines)


def _cart_total(cart: dict) -> float:
    return round(sum(
        item["price"] * (1 - item.get("discount_percent", 0) / 100)
        for item in cart.values()
    ), 2)


# ── Cart view ─────────────────────────────────────────────────────────────────

@router.callback_query(F.data == "cart")
async def show_cart(callback: CallbackQuery, state: FSMContext):
    await state.set_state(None)
    data = await state.get_data()
    cart = data.get("cart", {})
    await edit_or_send(callback,
        format_cart(cart),
        reply_markup=cart_kb(cart),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data.startswith("remove_"))
async def remove_from_cart(callback: CallbackQuery, state: FSMContext):
    pid = callback.data.split("_")[1]
    data = await state.get_data()
    cart = data.get("cart", {})
    cart.pop(pid, None)
    await state.update_data(cart=cart, promo=None)
    await edit_or_send(callback,
        format_cart(cart),
        reply_markup=cart_kb(cart),
        parse_mode="HTML",
    )
    await callback.answer("Удалено из корзины")


# ── Checkout: promo code step ─────────────────────────────────────────────────

@router.callback_query(F.data == "checkout")
async def checkout(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    if not data.get("cart"):
        await callback.answer("Корзина пуста!")
        return

    await state.update_data(promo=None)
    await state.set_state(ShopStates.waiting_promo)
    await edit_or_send(callback,
        f"{format_cart(data['cart'])}\n\n"
        "🎟 Введите промокод или нажмите «Пропустить»:",
        reply_markup=promo_kb(),
        parse_mode="HTML",
    )
    await callback.answer()


@router.message(ShopStates.waiting_promo)
async def process_promo(message: Message, state: FSMContext):
    code = message.text.strip().upper()
    data = await state.get_data()
    cart = data.get("cart", {})

    try:
        promo = await api.lookup_promo_code(code)
        total = _cart_total(cart)
        final = round(total * (1 - promo["discount_percent"] / 100), 2)
        await state.update_data(promo=promo, pending_total=final)
        await state.set_state(None)

        text = (
            f"{format_cart(cart, promo)}\n\n"
            "Нажмите «Оплатить» для подтверждения заказа."
        )
        await message.answer(text, reply_markup=confirm_order_kb(), parse_mode="HTML")
    except Exception:
        await message.answer(
            "❌ Промокод не найден или недействителен. Попробуйте другой или нажмите «Пропустить».",
            reply_markup=promo_kb(),
        )


@router.callback_query(F.data == "skip_promo")
async def skip_promo(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    cart = data.get("cart", {})
    total = _cart_total(cart)
    await state.update_data(promo=None, pending_total=total)
    await state.set_state(None)

    text = f"{format_cart(cart)}\n\nНажмите «Оплатить» для подтверждения заказа."
    await edit_or_send(callback,text, reply_markup=confirm_order_kb(), parse_mode="HTML")
    await callback.answer()


# ── Payment ───────────────────────────────────────────────────────────────────

@router.callback_query(F.data == "pay_confirm")
async def pay_confirm(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    cart = data.get("cart", {})
    total = data.get("pending_total") or _cart_total(cart)
    promo = data.get("promo")

    if not cart:
        await callback.answer("Корзина пуста!")
        return

    items = [
        {"product_id": item["id"], "quantity": 1, "discount": item.get("discount_percent", 0)}
        for item in cart.values()
    ]

    user = callback.from_user
    order_data = {
        "source": "telegram",
        "status": "pending_payment",
        "items": items,
        "price": total,
        "client_info": f"@{user.username}" if user.username else str(user.id),
        "client_url": f"tg://user?id={user.id}",
        "telegram_user_id": user.id,
        "telegram_username": user.username or "",
    }
    if promo:
        order_data["promo_code"] = promo["code"]

    try:
        order = await api.create_order(order_data)
        order_id = order["id"]
    except Exception as e:
        log.error("Order creation error: %s", e)
        await callback.answer("Ошибка при создании заказа. Попробуйте позже.")
        return

    await state.update_data(pending_order_id=order_id, pending_total=total)

    from aiogram.utils.keyboard import InlineKeyboardBuilder
    kb = InlineKeyboardBuilder()
    kb.button(text="⚡ СБП", callback_data=f"paymethod_{order_id}_2")
    kb.button(text="💳 Карта РФ", callback_data=f"paymethod_{order_id}_11")
    kb.button(text="🌍 Международная", callback_data=f"paymethod_{order_id}_12")
    kb.adjust(1)

    method_text = (
        f"🛒 <b>Заказ #{order_id} создан!</b>\n\n"
        f"💰 Сумма: <b>{total} ₽</b>\n\n"
        f"Выберите способ оплаты:"
    )
    try:
        await callback.message.edit_text(method_text, reply_markup=kb.as_markup(), parse_mode="HTML")
    except Exception:
        await callback.message.answer(method_text, reply_markup=kb.as_markup(), parse_mode="HTML")

    await callback.answer()


@router.callback_query(F.data.startswith("paymethod_"))
async def select_pay_method(callback: CallbackQuery, state: FSMContext):
    _, order_id_str, method_str = callback.data.split("_")
    order_id = int(order_id_str)
    method = int(method_str)

    data = await state.get_data()
    total = data.get("pending_total", "?")

    try:
        payment = await api.create_payment(order_id, method)
        payment_url = payment["payment_url"]
    except Exception as e:
        log.error("Payment creation error: %s", e)
        await callback.answer("Ошибка при создании платежа. Попробуйте позже.", show_alert=True)
        return

    await state.clear()

    from aiogram.utils.keyboard import InlineKeyboardBuilder
    kb = InlineKeyboardBuilder()
    kb.button(text="💳 Перейти к оплате", url=payment_url)
    kb.adjust(1)

    pay_text = (
        f"🛒 <b>Заказ #{order_id} создан!</b>\n\n"
        f"Для завершения оформления оплатите заказ по кнопке ниже.\n"
        f"После оплаты заказ автоматически будет принят в работу.\n\n"
        f"💰 Сумма: <b>{total} ₽</b>"
    )
    try:
        sent = await callback.message.edit_text(pay_text, reply_markup=kb.as_markup(), parse_mode="HTML")
    except Exception:
        sent = await callback.message.answer(pay_text, reply_markup=kb.as_markup(), parse_mode="HTML")
    try:
        await api.update_tg_notify(order_id, {"tg_payment_message_id": sent.message_id})
    except Exception as e:
        log.error("Failed to save payment message_id: %s", e)

    await callback.message.answer(
        WELCOME_TEXT,
        reply_markup=main_menu_kb(settings.CHANNEL_URL),
        parse_mode="HTML",
    )
    await callback.answer()

