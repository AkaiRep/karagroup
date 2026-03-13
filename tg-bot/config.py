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
    TERMS_URL: str = "https://telegra.ph/terms"
    PRIVACY_URL: str = "https://telegra.ph/privacy"
    WEB_APP_URL: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
