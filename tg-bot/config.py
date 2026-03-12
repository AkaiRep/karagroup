from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    BOT_TOKEN: str
    BACKEND_URL: str = "http://localhost:8000"
    BACKEND_USERNAME: str = "admin"
    BACKEND_PASSWORD: str = "admin123"
    CHANNEL_URL: str = "https://t.me/yourchannel"
    MANAGER_USERNAME: str = "@manager"
    NOTIFY_GROUP_ID: int = 0
    NOTIFY_TOPIC_ID: int = 0

    TERMS_TEXT: str = (
        "<b>📄 Пользовательское соглашение</b>\n\n"
        "Настоящее соглашение регулирует использование бота и оказываемых услуг.\n\n"
        "1. Принимая условия, вы соглашаетесь с правилами сервиса.\n"
        "2. Мы оставляем за собой право отказать в обслуживании без объяснения причин.\n"
        "3. После оплаты возврат средств возможен только до начала выполнения заказа.\n\n"
        "<i>Актуальная версия от 01.01.2025</i>"
    )

    PRIVACY_TEXT: str = (
        "<b>🔒 Политика конфиденциальности</b>\n\n"
        "Мы собираем минимально необходимые данные для оказания услуг:\n\n"
        "• Telegram ID и имя пользователя\n"
        "• Игровой ник, указанный при оформлении заказа\n\n"
        "Мы не передаём ваши данные третьим лицам и не используем их в рекламных целях.\n\n"
        "<i>Актуальная версия от 01.01.2025</i>"
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
