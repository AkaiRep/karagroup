import asyncio
import logging
from datetime import datetime, timezone, timedelta

from aiogram import Bot
from aiogram.exceptions import TelegramBadRequest

from api import api
from config import settings

log = logging.getLogger(__name__)

POLL_INTERVAL = 10          # seconds between checks
EXPIRY_WARN_HOURS = 36      # warn at 36h (12h before edit window closes)
EDIT_WINDOW_HOURS = 48      # Telegram edit limit

STATUS_LABELS = {
    "paid": "🟡 Ожидает исполнителя",
    "in_progress": "🔵 В работе",
    "completed": "🟢 Выполнен",
    "confirmed": "✅ Подтверждён",
}


def _build_notify_text(order: dict) -> str:
    items_text = ", ".join(
        item["product"]["name"]
        for item in order.get("items", [])
        if item.get("product")
    ) or "—"

    tg_id = order.get("telegram_user_id", "")
    tg_username = order.get("telegram_username", "")
    name = f"@{tg_username}" if tg_username else str(tg_id) if tg_id else "—"
    username_part = f" (@{tg_username})" if tg_username else ""
    if tg_id:
        tg_link = f'<a href="tg://user?id={tg_id}">{name}</a>{username_part}'
    else:
        client_info = order.get("client_info") or "—"
        tg_link = client_info

    promo_line = ""
    if order.get("promo_code"):
        promo_line = f"\n🎟 Промокод: {order['promo_code']['code']}"

    source_map = {"telegram": "Telegram", "funpay": "FunPay", "other": "Другое"}
    source = source_map.get(order.get("source", ""), order.get("source", ""))

    status = order.get("status", "paid")
    status_label = STATUS_LABELS.get(status, status)

    text = (
        f"🆕 <b>Новый заказ #{order['id']}</b> [{source}]\n\n"
        f"👤 Клиент: {tg_link}\n"
        f"📦 Услуги: {items_text}"
        f"{promo_line}\n"
        f"💰 Сумма: <i>Смотреть в приложении</i>\n"
        f"📊 Статус: {status_label}"
    )

    if order.get("worker") and status in ("in_progress", "completed", "confirmed"):
        text += f"\n\n👷 Исполнитель: <b>{order['worker']['username']}</b>"

    if order.get("tg_expiry_warned"):
        text += "\n\n⚠️ Статус заказа больше не обновляется в Telegram. Смотреть в приложении."

    return text


async def _send_notify_message(bot: Bot, order: dict, text: str) -> int | None:
    """Send a new notification message, return message_id or None on failure."""
    try:
        kwargs = {
            "chat_id": settings.NOTIFY_GROUP_ID,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }
        if settings.NOTIFY_TOPIC_ID:
            kwargs["message_thread_id"] = settings.NOTIFY_TOPIC_ID
        sent = await bot.send_message(**kwargs)
        return sent.message_id
    except Exception as e:
        log.error("Failed to send notify message for order #%s: %s", order["id"], e)
        return None


async def _edit_notify_message(bot: Bot, order: dict, text: str) -> bool:
    try:
        await bot.edit_message_text(
            chat_id=settings.NOTIFY_GROUP_ID,
            message_id=order["tg_notify_message_id"],
            text=text,
            parse_mode="HTML",
            disable_web_page_preview=True,
        )
        return True
    except TelegramBadRequest as e:
        if "message is not modified" in str(e):
            return True  # already up to date
        log.error("Failed to edit notify message for order #%s: %s", order["id"], e)
        return False
    except Exception as e:
        log.error("Failed to edit notify message for order #%s: %s", order["id"], e)
        return False


async def check_and_update(bot: Bot) -> None:
    if not settings.NOTIFY_GROUP_ID:
        return

    try:
        orders = await api.get_tg_pending_updates()
    except Exception as e:
        log.error("Failed to fetch pending tg updates: %s", e)
        return

    now = datetime.now(timezone.utc)

    for order in orders:
        status = order.get("status", "paid")

        # ── Case 1: New order, need to send initial notification ──────────────
        if not order.get("tg_notified"):
            text = _build_notify_text(order)
            msg_id = await _send_notify_message(bot, order, text)
            if msg_id:
                try:
                    await api.update_tg_notify(order["id"], {
                        "tg_notify_message_id": msg_id,
                        "tg_notify_sent_at": now.isoformat(),
                        "tg_notified": True,
                        "tg_last_notified_status": status,
                    })
                except Exception as e:
                    log.error("Failed to save tg_notify for order #%s: %s", order["id"], e)
            continue

        # ── Case 2: Already notified, check if edit needed ────────────────────
        sent_at_raw = order.get("tg_notify_sent_at")
        if not sent_at_raw or not order.get("tg_notify_message_id"):
            continue

        sent_at = datetime.fromisoformat(sent_at_raw.replace("Z", "+00:00"))
        if sent_at.tzinfo is None:
            sent_at = sent_at.replace(tzinfo=timezone.utc)

        age_hours = (now - sent_at).total_seconds() / 3600
        if age_hours >= EDIT_WINDOW_HOURS:
            continue

        updates = {}
        needs_edit = False

        # Status changed
        if status != order.get("tg_last_notified_status"):
            updates["tg_last_notified_status"] = status
            needs_edit = True

        # Expiry warning
        if age_hours >= EXPIRY_WARN_HOURS and not order.get("tg_expiry_warned"):
            updates["tg_expiry_warned"] = True
            needs_edit = True

        if not needs_edit:
            # Just sync state without editing
            if updates:
                try:
                    await api.update_tg_notify(order["id"], updates)
                except Exception as e:
                    log.error("Failed to sync tg_notify for order #%s: %s", order["id"], e)
            continue

        # Apply updates to local dict so text builder uses new values
        order.update(updates)
        text = _build_notify_text(order)

        if await _edit_notify_message(bot, order, text):
            try:
                await api.update_tg_notify(order["id"], updates)
            except Exception as e:
                log.error("Failed to save tg_notify flags for order #%s: %s", order["id"], e)


async def run_notifier(bot: Bot) -> None:
    log.info("Notification updater started")
    while True:
        await asyncio.sleep(POLL_INTERVAL)
        try:
            await asyncio.wait_for(check_and_update(bot), timeout=8)
        except asyncio.TimeoutError:
            log.warning("Notifier cycle timed out, skipping")
        except Exception as e:
            log.error("Notifier error: %s", e)
