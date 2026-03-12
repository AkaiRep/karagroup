from aiogram.types import CallbackQuery, InlineKeyboardMarkup
from aiogram.exceptions import TelegramBadRequest


async def edit_or_send(callback: CallbackQuery, text: str, reply_markup: InlineKeyboardMarkup | None = None, **kwargs):
    """Edit message if possible, otherwise send a new one."""
    try:
        await callback.message.edit_text(text, reply_markup=reply_markup, **kwargs)
    except TelegramBadRequest:
        await callback.message.answer(text, reply_markup=reply_markup, **kwargs)
