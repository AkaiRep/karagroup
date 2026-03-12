#!/bin/bash
# KaraGroup — управление сервисами на сервере
# Использование: ./server.sh [start|stop|restart|status|logs|logs-bot|logs-backend|update]

BACKEND="karagroup-backend"
BOT="karagroup-bot"
APP_DIR="/opt/karagroup"

cmd=${1:-"status"}

case "$cmd" in
    start)
        echo "▶ Запускаем..."
        systemctl start $BACKEND $BOT
        systemctl status $BACKEND $BOT --no-pager
        ;;

    stop)
        echo "■ Останавливаем..."
        systemctl stop $BOT $BACKEND
        echo "Остановлено."
        ;;

    restart)
        echo "↺ Перезапускаем..."
        systemctl restart $BACKEND
        sleep 2
        systemctl restart $BOT
        systemctl status $BACKEND $BOT --no-pager
        ;;

    status)
        systemctl status $BACKEND $BOT --no-pager
        ;;

    logs)
        echo "=== Бэкенд + Бот (Ctrl+C для выхода) ==="
        journalctl -u $BACKEND -u $BOT -f --no-pager
        ;;

    logs-backend)
        journalctl -u $BACKEND -f --no-pager
        ;;

    logs-bot)
        journalctl -u $BOT -f --no-pager
        ;;

    update)
        echo "▶ Обновляем файлы..."
        cp -r backend "$APP_DIR/"
        cp -r tg-bot "$APP_DIR/"
        chown -R karagroup:karagroup "$APP_DIR"

        echo "▶ Обновляем зависимости бэкенда..."
        sudo -u karagroup bash -c "
            cd $APP_DIR/backend
            source .venv/bin/activate
            pip install -q -r requirements.txt
        "

        echo "▶ Обновляем зависимости бота..."
        sudo -u karagroup bash -c "
            cd $APP_DIR/tg-bot
            source .venv/bin/activate
            pip install -q -r requirements.txt
        "

        echo "↺ Перезапускаем сервисы..."
        systemctl restart $BACKEND
        sleep 2
        systemctl restart $BOT
        echo "✅ Обновление завершено"
        systemctl status $BACKEND $BOT --no-pager
        ;;

    *)
        echo "Использование: $0 [start|stop|restart|status|logs|logs-bot|logs-backend|update]"
        exit 1
        ;;
esac
