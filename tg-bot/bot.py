import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage

from config import settings
from api import api
from handlers import start, shop, cart, orders, about
from notifier import run_notifier

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


async def main():
    bot = Bot(token=settings.BOT_TOKEN)
    dp = Dispatcher(storage=MemoryStorage())

    dp.include_router(start.router)
    dp.include_router(shop.router)
    dp.include_router(cart.router)
    dp.include_router(orders.router)
    dp.include_router(about.router)

    try:
        await bot.delete_webhook(drop_pending_updates=True)
        asyncio.create_task(run_notifier(bot))
        await dp.start_polling(bot)
    finally:
        await api.close()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
