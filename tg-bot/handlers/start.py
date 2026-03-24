from aiogram import Router, F
from aiogram.filters import CommandStart, CommandObject
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext

from config import settings
from keyboards import main_menu_kb
from utils import edit_or_send
from api import api

router = Router()

WELCOME_TEXT = (
    "<b>👋 Добро пожаловать!</b>\n\n"
    "Мы занимаемся профессиональным бустингом игровых аккаунтов.\n\n"
    "Выберите нужный раздел:"
)


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext, command: CommandObject):
    await state.clear()

    # Handle Telegram account linking via deep link token
    token = command.args
    if token:
        try:
            result = await api.link_telegram_account(
                token=token,
                telegram_id=message.from_user.id,
                telegram_username=message.from_user.username,
            )
            await message.answer(
                f"✅ Telegram успешно привязан к аккаунту <b>{result['username']}</b>!\n\n"
                "Теперь вы можете оформлять заказы на сайте.",
                parse_mode="HTML",
            )
            return
        except Exception as e:
            err = str(e)
            if "409" in err or "уже привязан" in err.lower():
                await message.answer("⚠️ Этот Telegram уже привязан к другому аккаунту.")
            elif "404" in err or "Token not found" in err:
                await message.answer("⚠️ Ссылка недействительна или уже использована.")
            elif "400" in err or "expired" in err.lower():
                await message.answer("⚠️ Ссылка устарела. Сгенерируйте новую на сайте в профиле.")
            else:
                await message.answer("⚠️ Не удалось привязать аккаунт. Попробуйте снова.")
            return

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
