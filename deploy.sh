#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  KaraGroup — Deploy Script
#  Ubuntu 22.04+, запускать от root или через sudo
#  Использование: bash deploy.sh
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
set -e

# ── Настройки ─────────────────────────────────────────────
DOMAIN="${DOMAIN:-karashop.ru}"
APP_DIR="/root/karagroup"
BACKEND_PORT=8000
WEB_PORT=3000

# ── Цвета ─────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()      { echo -e "${GREEN}  ✔ $1${NC}"; }
warn()    { echo -e "${YELLOW}  ! $1${NC}"; }
fail()    { echo -e "${RED}  ✘ $1${NC}"; exit 1; }
section() { echo -e "\n${GREEN}━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

[ "$EUID" -ne 0 ] && fail "Запускай от root или через sudo"

echo -e "${GREEN}"
echo "  ██╗  ██╗ █████╗ ██████╗  █████╗ "
echo "  ██║ ██╔╝██╔══██╗██╔══██╗██╔══██╗"
echo "  █████╔╝ ███████║██████╔╝███████║"
echo "  ██╔═██╗ ██╔══██║██╔══██╗██╔══██║"
echo "  ██║  ██╗██║  ██║██║  ██║██║  ██║"
echo "  ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝"
echo -e "  Deploy Script${NC}"
echo ""

# ── Спросить домен если не задан ──────────────────────────
if [ "$DOMAIN" = "karashop.ru" ]; then
  read -p "  Домен [karashop.ru]: " input
  [ -n "$input" ] && DOMAIN="$input"
fi
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "1. Системные зависимости"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
apt-get update -q
apt-get install -y -q software-properties-common
add-apt-repository -y ppa:deadsnakes/ppa
apt-get update -q
apt-get install -y -q \
  curl git nginx certbot python3-certbot-nginx \
  python3.11 python3.11-venv python3.11-distutils \
  build-essential
ok "Системные пакеты"

# Node.js 20 LTS
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -q nodejs
fi
ok "Node.js $(node -v)"

# PM2
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2 --silent
fi
ok "PM2 $(pm2 -v)"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "2. Код проекта"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ok "Код: $APP_DIR"

mkdir -p "$APP_DIR/backend/uploads/products"
mkdir -p "$APP_DIR/backend/uploads/chat"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "3. .env файл"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BACKEND_ENV="$APP_DIR/backend/.env"
if [ ! -f "$BACKEND_ENV" ]; then
  warn ".env не найден — создаю шаблон"
  cat > "$BACKEND_ENV" <<EOF
SECRET_KEY=ЗАМЕНИ_НА_СЛУЧАЙНУЮ_СТРОКУ_32_СИМВОЛА
DATABASE_URL=sqlite:///./karagroup.db

BOT_TOKEN=
NOTIFY_GROUP_ID=
NOTIFY_TOPIC_ID=

PLATEGA_MERCHANT_ID=
PLATEGA_SECRET=
PLATEGA_RETURN_URL=https://${DOMAIN}
PLATEGA_PAYMENT_METHOD=2

NEXT_PUBLIC_API_URL=https://${DOMAIN}
NEXT_PUBLIC_BOT_CHANNEL=
NEXT_PUBLIC_MANAGER=
EOF
  warn "Заполни $BACKEND_ENV и перезапусти: pm2 restart all"
else
  ok ".env найден"
fi


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "4. Backend (FastAPI)"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cd "$APP_DIR/backend"
[ -d ".venv" ] || python3.11 -m venv .venv --without-pip
curl -sS https://bootstrap.pypa.io/get-pip.py | .venv/bin/python3.11
.venv/bin/pip install --upgrade pip --quiet
.venv/bin/pip install -r requirements.txt --quiet
ok "Backend зависимости"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "5. Telegram Bot"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cd "$APP_DIR/tg-bot"
[ -d ".venv" ] || python3.11 -m venv .venv --without-pip
curl -sS https://bootstrap.pypa.io/get-pip.py | .venv/bin/python3.11
.venv/bin/pip install --upgrade pip --quiet
.venv/bin/pip install -r requirements.txt --quiet

# Бот читает .env из backend
[ -f ".env" ] || ln -s "$BACKEND_ENV" .env

ok "Bot зависимости"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "6. Web (Next.js)"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cd "$APP_DIR/web"

# Пробросить NEXT_PUBLIC переменные из .env бэкенда
export $(grep -E '^NEXT_PUBLIC_' "$BACKEND_ENV" | xargs) 2>/dev/null || true

npm install --silent
npm run build
ok "Next.js собран"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "7. PM2 процессы"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pm2 delete karagroup-backend karagroup-bot karagroup-web 2>/dev/null || true

pm2 start "$APP_DIR/backend/.venv/bin/uvicorn" \
  --name karagroup-backend \
  --cwd "$APP_DIR/backend" \
  -- main:app --host 127.0.0.1 --port $BACKEND_PORT --workers 2

pm2 start "$APP_DIR/tg-bot/.venv/bin/python" \
  --name karagroup-bot \
  --cwd "$APP_DIR/tg-bot" \
  -- bot.py

pm2 start npm \
  --name karagroup-web \
  --cwd "$APP_DIR/web" \
  -- start

pm2 save
# Автозапуск при ребуте
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root | tail -1 | bash 2>/dev/null || true

ok "PM2 процессы запущены"
pm2 status


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "8. Nginx"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cat > /etc/nginx/sites-available/karagroup <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 20M;

    # ── Backend API ──────────────────────────────────────
    location ~ ^/(auth|categories|products|payments|chat|orders|users|financial|media|global-chat|reviews|site-settings|health) {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }

    # ── Загруженные файлы ────────────────────────────────
    location /uploads/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/uploads/;
    }

    # ── Фронтенд ─────────────────────────────────────────
    location / {
        proxy_pass http://127.0.0.1:${WEB_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/karagroup /etc/nginx/sites-enabled/karagroup
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx
ok "Nginx настроен"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "9. Перенос данных со старого сервера"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
read -p "  Скопировать данные со старого сервера? [y/N]: " migrate_answer
if [[ "$migrate_answer" =~ ^[Yy]$ ]]; then
  read -p "  IP старого сервера: " OLD_HOST
  read -p "  Пользователь [root]: " OLD_USER
  OLD_USER="${OLD_USER:-root}"
  read -s -p "  Пароль: " OLD_PASS
  echo ""
  read -p "  Директория проекта на старом сервере [/root/karagroup]: " OLD_DIR
  OLD_DIR="${OLD_DIR:-/root/karagroup}"

  # Установить sshpass если нет
  if ! command -v sshpass &>/dev/null; then
    apt-get install -y -q sshpass
  fi

  SCP="sshpass -p '$OLD_PASS' scp -o StrictHostKeyChecking=no -o ConnectTimeout=10"

  echo ""
  warn "Копирую базу данных..."
  eval "$SCP -r '${OLD_USER}@${OLD_HOST}:${OLD_DIR}/backend/*.db' '$APP_DIR/backend/'" \
    && ok "База данных скопирована" \
    || warn "БД не найдена или ошибка копирования"

  warn "Копирую uploads..."
  eval "$SCP -r '${OLD_USER}@${OLD_HOST}:${OLD_DIR}/backend/uploads/' '$APP_DIR/backend/'" \
    && ok "Uploads скопированы" \
    || warn "Uploads не найдены или ошибка копирования"

  warn "Копирую .env..."
  eval "$SCP '${OLD_USER}@${OLD_HOST}:${OLD_DIR}/backend/.env' '$APP_DIR/backend/.env'" \
    && ok ".env скопирован" \
    || warn ".env не найден или ошибка копирования"

  warn "Перезапускаю сервисы с новыми данными..."
  pm2 restart all
  ok "Готово"
else
  warn "Перенос пропущен"
fi


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "10. SSL (Let's Encrypt)"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
read -p "  Получить SSL сертификат сейчас? [y/N]: " ssl_answer
if [[ "$ssl_answer" =~ ^[Yy]$ ]]; then
  read -p "  Email для certbot: " ssl_email
  certbot --nginx \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    -m "$ssl_email" \
    --redirect
  ok "SSL сертификат получен"
else
  warn "SSL пропущен. Запусти позже: certbot --nginx -d $DOMAIN"
fi


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${GREEN}━━━ Деплой завершён! ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "
  Сайт:     https://${DOMAIN}
  API docs: https://${DOMAIN}/docs
  Статус:   pm2 status

  Логи:
    pm2 logs karagroup-backend
    pm2 logs karagroup-bot
    pm2 logs karagroup-web

"
