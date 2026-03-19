import asyncio
import logging
from datetime import datetime, timezone, timedelta

from aiogram import Bot
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import User as TgUser
from aiogram.utils.formatting import Bold, Italic, Text, TextMention, as_list

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


def _build_notify_content(order: dict):
    items_text = ", ".join(
        item["product"]["name"]
        for item in order.get("items", [])
        if item.get("product")
    ) or "—"

    tg_id = order.get("telegram_user_id")
    if tg_id:
        client_part = TextMention(str(tg_id), user=TgUser(id=int(tg_id), is_bot=False, first_name=str(tg_id)))
    else:
        client_part = Text(order.get("client_info") or "—")

    source_map = {"telegram": "Telegram", "funpay": "FunPay", "other": "Другое"}
    source = source_map.get(order.get("source", ""), order.get("source", ""))

    status = order.get("status", "paid")
    status_label = STATUS_LABELS.get(status, status)

    lines = [
        Text(Bold(f"🆕 Новый заказ #{order['id']}"), f" [{source}]"),
        Text(""),
        Text("👤 Клиент: ", client_part),
        Text(f"📦 Услуги: {items_text}"),
    ]

    if order.get("promo_code"):
        lines.append(Text(f"🎟 Промокод: {order['promo_code']['code']}"))

    lines.append(Text("💰 Сумма: ", Italic("Смотреть в приложении")))
    lines.append(Text(f"📊 Статус: {status_label}"))

    if order.get("worker") and status in ("in_progress", "completed", "confirmed"):
        lines.append(Text(""))
        lines.append(Text("👷 Исполнитель: ", Bold(order["worker"]["username"])))

    if order.get("tg_expiry_warned"):
        lines.append(Text(""))
        lines.append(Text("⚠️ Статус заказа больше не обновляется в Telegram. Смотреть в приложении."))

    return as_list(*lines, sep="\n")


async def _send_notify_message(bot: Bot, order: dict, content) -> int | None:
    """Send a new notification message, return message_id or None on failure."""
    try:
        kwargs = {
            "chat_id": settings.NOTIFY_GROUP_ID,
            "disable_web_page_preview": True,
            **content.as_kwargs(),
        }
        if settings.NOTIFY_TOPIC_ID:
            kwargs["message_thread_id"] = settings.NOTIFY_TOPIC_ID
        sent = await bot.send_message(**kwargs)
        return sent.message_id
    except Exception as e:
        log.error("Failed to send notify message for order #%s: %s", order["id"], e)
        return None


async def _edit_notify_message(bot: Bot, order: dict, content) -> bool:
    try:
        await bot.edit_message_text(
            chat_id=settings.NOTIFY_GROUP_ID,
            message_id=order["tg_notify_message_id"],
            disable_web_page_preview=True,
            **content.as_kwargs(),
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
            content = _build_notify_content(order)
            msg_id = await _send_notify_message(bot, order, content)
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
        content = _build_notify_content(order)

        if await _edit_notify_message(bot, order, content):
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
