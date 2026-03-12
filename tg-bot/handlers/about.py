from aiogram import Router, F
from aiogram.types import CallbackQuery

from config import settings
from keyboards import about_kb
from utils import edit_or_send

router = Router()


@router.callback_query(F.data == "about")
async def show_about(callback: CallbackQuery):
    await edit_or_send(callback,
        "ℹ️ <b>О боте</b>\n\n"
        "Мы занимаемся профессиональным бустингом игровых аккаунтов.\n\n"
        f"📢 Наш канал: {settings.CHANNEL_URL}\n"
        f"👤 Поддержка: {settings.MANAGER_USERNAME}",
        reply_markup=about_kb(settings.TERMS_URL, settings.PRIVACY_URL),
        parse_mode="HTML",
    )
    await callback.answer()
