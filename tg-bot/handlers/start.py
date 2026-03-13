from aiogram import Router, F
from aiogram.filters import CommandStart
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext

from config import settings
from keyboards import main_menu_kb
from utils import edit_or_send

router = Router()

WELCOME_TEXT = (
    "<b>👋 Добро пожаловать!</b>\n\n"
    "Мы занимаемся профессиональным бустингом игровых аккаунтов.\n\n"
    "Выберите нужный раздел:"
)


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    await message.answer(
        WELCOME_TEXT,
        reply_markup=main_menu_kb(settings.CHANNEL_URL, settings.WEB_APP_URL),
        parse_mode="HTML",
    )


@router.callback_query(F.data == "main")
async def go_main(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    await edit_or_send(callback,
        WELCOME_TEXT,
        reply_markup=main_menu_kb(settings.CHANNEL_URL, settings.WEB_APP_URL),
        parse_mode="HTML",
    )
    await callback.answer()
