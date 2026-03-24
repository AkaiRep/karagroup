#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  KaraGroup — Deploy REG.RU (web + backend, без бота)
#  Ubuntu 22.04+, запускать от root
#  Использование: bash deploy-regru.sh
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
set -e

DOMAIN="${DOMAIN:-karashop.ru}"
APP_DIR="/root/karagroup"
BACKEND_PORT=8000
WEB_PORT=3000
HETZNER_IP=""   # заполнится интерактивно

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()      { echo -e "${GREEN}  ✔ $1${NC}"; }
warn()    { echo -e "${YELLOW}  ! $1${NC}"; }
fail()    { echo -e "${RED}  ✘ $1${NC}"; exit 1; }
section() { echo -e "\n${GREEN}━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

[ "$EUID" -ne 0 ] && fail "Запускай от root или через sudo"

echo -e "${GREEN}"
echo "  REG.RU Deploy — Web + Backend"
echo -e "${NC}"

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
  build-essential sshpass
ok "Системные пакеты"

if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -q nodejs
fi
ok "Node.js $(node -v)"

if ! command -v pm2 &>/dev/null; then
  npm install -g pm2 --silent
fi
ok "PM2 $(pm2 -v)"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "2. Код проекта"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
mkdir -p "$APP_DIR/backend/uploads/products"
mkdir -p "$APP_DIR/backend/uploads/chat"
mkdir -p "$APP_DIR/backend/uploads/screenshots"
mkdir -p "$APP_DIR/backend/uploads/webcam"
mkdir -p "$APP_DIR/backend/uploads/hero"
mkdir -p "$APP_DIR/backend/uploads/teleports"
ok "Директории созданы: $APP_DIR"


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
python3.11 -m venv .venv
.venv/bin/python3.11 -m ensurepip --upgrade
.venv/bin/pip install --upgrade pip -q
.venv/bin/pip install -r requirements.txt -q
ok "Backend зависимости"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "5. Web (Next.js)"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cd "$APP_DIR/web"
grep -E '^NEXT_PUBLIC_' "$BACKEND_ENV" > "$APP_DIR/web/.env.production" 2>/dev/null || true
npm install --silent
npm run build
ok "Next.js собран"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "6. PM2 процессы"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pm2 delete karagroup-backend karagroup-web 2>/dev/null || true

pm2 start "$APP_DIR/backend/.venv/bin/uvicorn" \
  --name karagroup-backend \
  --interpreter none \
  --cwd "$APP_DIR/backend" \
  -- main:app --host 127.0.0.1 --port $BACKEND_PORT --workers 2

pm2 start npm \
  --name karagroup-web \
  --cwd "$APP_DIR/web" \
  -- start

pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root | tail -1 | bash 2>/dev/null || true
ok "PM2 запущен (backend + web)"
pm2 status


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "7. Nginx"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
cat > /etc/nginx/sites-available/karagroup <<NGINX
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    client_max_body_size 50M;

    # ── Backend API ──────────────────────────────────────
    location ~ ^/(auth|categories|products|payments|chat|orders|users|financial|media|global-chat|reviews|site-settings|health|faq|teleports|api)/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # ── Статика (uploads) ────────────────────────────────
    location /uploads/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/uploads/;
        proxy_read_timeout 30s;
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
nginx -t && systemctl enable nginx && systemctl reload nginx
ok "Nginx настроен"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "8. Перенос данных с Hetzner"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
read -p "  Скопировать базу и uploads с Hetzner? [y/N]: " migrate_answer
if [[ "$migrate_answer" =~ ^[Yy]$ ]]; then
  read -p "  IP Hetzner сервера: " HETZNER_IP
  read -p "  Пользователь [root]: " HETZNER_USER
  HETZNER_USER="${HETZNER_USER:-root}"
  read -s -p "  Пароль SSH: " HETZNER_PASS
  echo ""
  read -p "  Директория на Hetzner [/root/karagroup]: " HETZNER_DIR
  HETZNER_DIR="${HETZNER_DIR:-/root/karagroup}"

  SCP="sshpass -p '$HETZNER_PASS' scp -o StrictHostKeyChecking=no -o ConnectTimeout=15"
  SSH="sshpass -p '$HETZNER_PASS' ssh -o StrictHostKeyChecking=no ${HETZNER_USER}@${HETZNER_IP}"

  warn "Копирую базу данных..."
  eval "$SCP '${HETZNER_USER}@${HETZNER_IP}:${HETZNER_DIR}/backend/*.db' '$APP_DIR/backend/'" \
    && ok "База скопирована" || warn "БД не найдена"

  warn "Копирую uploads..."
  eval "$SCP -r '${HETZNER_USER}@${HETZNER_IP}:${HETZNER_DIR}/backend/uploads/' '$APP_DIR/backend/'" \
    && ok "Uploads скопированы" || warn "Uploads не найдены"

  warn "Копирую .env..."
  eval "$SCP '${HETZNER_USER}@${HETZNER_IP}:${HETZNER_DIR}/backend/.env' '$APP_DIR/backend/.env'" \
    && ok ".env скопирован" || warn ".env не скопирован"

  # Обновляем Next.js env после копирования нового .env
  grep -E '^NEXT_PUBLIC_' "$BACKEND_ENV" > "$APP_DIR/web/.env.production" 2>/dev/null || true
  cd "$APP_DIR/web" && npm run build
  pm2 restart all
  ok "Данные перенесены, сервисы перезапущены"

  # Обновляем BACKEND_URL бота на Hetzner
  warn "Обновляю BACKEND_URL бота на Hetzner..."
  eval "$SSH" <<EOF
    sed -i 's|BACKEND_URL=.*|BACKEND_URL=https://${DOMAIN}|' /root/karagroup/tg-bot/.env 2>/dev/null || \
    sed -i 's|BACKEND_URL=.*|BACKEND_URL=https://${DOMAIN}|' /root/karagroup/backend/.env 2>/dev/null || true
    pm2 restart karagroup-bot 2>/dev/null || true
    pm2 delete karagroup-backend karagroup-web 2>/dev/null || true
    pm2 save --force
    echo "Hetzner: бот обновлён, backend/web остановлены"
EOF
  ok "Бот на Hetzner переключён на ${DOMAIN}"
else
  warn "Перенос пропущен"
fi


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
section "9. SSL (Let's Encrypt)"
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
warn "DNS должен уже указывать на этот сервер (${DOMAIN} → $(curl -s ifconfig.me))"
read -p "  Получить SSL сертификат? [y/N]: " ssl_answer
if [[ "$ssl_answer" =~ ^[Yy]$ ]]; then
  read -p "  Email: " ssl_email
  certbot --nginx \
    -d "$DOMAIN" -d "www.$DOMAIN" \
    --non-interactive --agree-tos \
    -m "$ssl_email" --redirect
  ok "SSL получен"
else
  warn "SSL пропущен. Запусти: certbot --nginx -d $DOMAIN"
fi


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo -e "\n${GREEN}━━━ Готово! ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "
  Сайт:         https://${DOMAIN}
  API:          https://${DOMAIN}/docs
  PM2 статус:   pm2 status
  Логи backend: pm2 logs karagroup-backend
  Логи web:     pm2 logs karagroup-web

  На Hetzner остался только бот:
    pm2 status          — проверить
    pm2 logs karagroup-bot — логи бота
"
