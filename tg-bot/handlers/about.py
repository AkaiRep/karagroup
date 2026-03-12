from aiogram import Router, F
from aiogram.types import CallbackQuery

from config import settings
from keyboards import about_kb, back_kb
from utils import edit_or_send

router = Router()


@router.callback_query(F.data == "about")
async def show_about(callback: CallbackQuery):
    await edit_or_send(callback,
        "ℹ️ <b>О боте</b>\n\n"
        "Мы занимаемся профессиональным бустингом игровых аккаунтов.\n\n"
        "Выберите раздел:",
        reply_markup=about_kb(),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data == "terms")
async def show_terms(callback: CallbackQuery):
    await edit_or_send(callback,
        settings.TERMS_TEXT,
        reply_markup=back_kb("about"),
        parse_mode="HTML",
    )
    await callback.answer()


@router.callback_query(F.data == "privacy")
async def show_privacy(callback: CallbackQuery):
    await edit_or_send(callback,
        settings.PRIVACY_TEXT,
        reply_markup=back_kb("about"),
        parse_mode="HTML",
    )
    await callback.answer()
