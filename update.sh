#!/bin/bash
# update.sh — обновить код на текущем сервере (git pull + rebuild)
# На reg.ru: backend + web
# На Hetzner: только bot
set -e

PROJECT=/root/karagroup
cd $PROJECT
git pull

# Определяем что запущено на этом сервере
HAS_BACKEND=$(pm2 list 2>/dev/null | grep -c karagroup-backend || true)
HAS_BOT=$(pm2 list 2>/dev/null | grep -c karagroup-bot || true)
HAS_WEB=$(pm2 list 2>/dev/null | grep -c karagroup-web || true)

if [ "$HAS_BACKEND" -gt 0 ]; then
  echo "==> Backend deps"
  $PROJECT/backend/.venv/bin/pip install -r $PROJECT/backend/requirements.txt -q
  echo "==> Restart backend"
  pm2 restart karagroup-backend
fi

if [ "$HAS_BOT" -gt 0 ]; then
  echo "==> Bot deps"
  $PROJECT/tg-bot/.venv/bin/pip install -r $PROJECT/tg-bot/requirements.txt -q
  echo "==> Restart bot"
  pm2 restart karagroup-bot
fi

if [ "$HAS_WEB" -gt 0 ]; then
  echo "==> Build web"
  cd $PROJECT/web
  grep -E '^NEXT_PUBLIC_' $PROJECT/backend/.env > $PROJECT/web/.env.production 2>/dev/null || true
  npm install --silent
  npm run build
  echo "==> Restart web"
  pm2 restart karagroup-web
fi

pm2 save --force

echo ""
echo "✓ Done"
pm2 status
