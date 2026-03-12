from aiogram import Router, F
from aiogram.types import CallbackQuery

from api import api
from keyboards import back_kb
from utils import edit_or_send

router = Router()

STATUS_LABEL = {
    "pending_payment": "💳 Ожидает оплаты",
    "paid": "⏳ Ожидает исполнителя",
    "in_progress": "🔧 В работе",
    "completed": "✅ Выполнен",
    "confirmed": "🎉 Подтверждён",
}


@router.callback_query(F.data == "my_orders")
async def show_my_orders(callback: CallbackQuery):
    orders = await api.get_user_orders(callback.from_user.id)

    if not orders:
        await edit_or_send(callback,
            "📋 <b>Мои заказы</b>\n\nУ вас пока нет заказов.",
            reply_markup=back_kb("main"),
            parse_mode="HTML",
        )
        await callback.answer()
        return

    lines = ["📋 <b>Мои заказы:</b>\n"]
    for order in orders[:10]:
        items_text = ", ".join(
            item["product"]["name"]
            for item in order.get("items", [])
            if item.get("product")
        ) or "—"
        status = STATUS_LABEL.get(order["status"], order["status"])
        lines.append(f"<b>#{order['id']}</b> — {items_text}\n   💰 {order['price']} ₽  ·  {status}\n")

    await edit_or_send(callback,
        "\n".join(lines),
        reply_markup=back_kb("main"),
        parse_mode="HTML",
    )
    await callback.answer()
