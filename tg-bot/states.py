from aiogram.fsm.state import State, StatesGroup


class ShopStates(StatesGroup):
    waiting_promo = State()
