#!/bin/bash
# KaraGroup — первичная установка на сервер
# Запускать от root или через sudo на Ubuntu/Debian
# Использование: bash deploy.sh

set -e

APP_DIR="/opt/karagroup"
USER="karagroup"

echo "=============================="
echo " KaraGroup Deploy"
echo "=============================="

# ── 1. Зависимости ────────────────────────────────────────────────────────────
echo ""
echo "▶ Устанавливаем зависимости..."
apt-get update -q
apt-get install -y -q python3 python3-pip python3-venv git curl

# ── 2. Пользователь ───────────────────────────────────────────────────────────
if ! id "$USER" &>/dev/null; then
    echo "▶ Создаём пользователя $USER..."
    useradd -r -m -d "$APP_DIR" -s /bin/bash "$USER"
fi

# ── 3. Копируем файлы ─────────────────────────────────────────────────────────
echo "▶ Копируем файлы в $APP_DIR..."
mkdir -p "$APP_DIR"
cp -r backend "$APP_DIR/"
cp -r tg-bot "$APP_DIR/"
chown -R "$USER:$USER" "$APP_DIR"

# ── 4. Виртуальные окружения ──────────────────────────────────────────────────
echo "▶ Устанавливаем зависимости бэкенда..."
sudo -u "$USER" bash -c "
    cd $APP_DIR/backend
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -q -r requirements.txt
"

echo "▶ Устанавливаем зависимости бота..."
sudo -u "$USER" bash -c "
    cd $APP_DIR/tg-bot
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -q -r requirements.txt
"

# ── 5. .env для бота ──────────────────────────────────────────────────────────
if [ ! -f "$APP_DIR/tg-bot/.env" ]; then
    echo ""
    echo "⚠️  Файл $APP_DIR/tg-bot/.env не найден."
    echo "    Создай его по образцу $APP_DIR/tg-bot/.env.example"
    echo "    и запусти: sudo systemctl start karagroup-bot"
fi

# ── 6. systemd — бэкенд ───────────────────────────────────────────────────────
echo "▶ Создаём systemd сервис для бэкенда..."
cat > /etc/systemd/system/karagroup-backend.service << EOF
[Unit]
Description=KaraGroup Backend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR/backend
ExecStart=$APP_DIR/backend/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# ── 7. systemd — бот ──────────────────────────────────────────────────────────
echo "▶ Создаём systemd сервис для бота..."
cat > /etc/systemd/system/karagroup-bot.service << EOF
[Unit]
Description=KaraGroup Telegram Bot
After=network.target karagroup-backend.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR/tg-bot
ExecStart=$APP_DIR/tg-bot/.venv/bin/python bot.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# ── 8. Включаем и запускаем ───────────────────────────────────────────────────
echo "▶ Запускаем сервисы..."
systemctl daemon-reload
systemctl enable karagroup-backend karagroup-bot
systemctl start karagroup-backend

echo ""
echo "=============================="
echo " Готово!"
echo "=============================="
echo ""
echo " Бэкенд:  http://$(curl -s ifconfig.me):8000"
echo " Статус:  ./server.sh status"
echo " Логи:    ./server.sh logs"
echo ""
if [ ! -f "$APP_DIR/tg-bot/.env" ]; then
    echo " ⚠️  Не забудь создать $APP_DIR/tg-bot/.env"
    echo "    После этого запусти: ./server.sh start"
else
    systemctl start karagroup-bot
    echo " Бот запущен!"
fi
