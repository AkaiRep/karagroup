#!/bin/bash
set -e
PROJECT=/root/karagroup

echo "==> Git pull"
cd $PROJECT
git pull

echo "==> Backend deps"
$PROJECT/backend/.venv/bin/pip install -r $PROJECT/backend/requirements.txt -q

echo "==> Restart backend"
pm2 restart karagroup-backend 2>/dev/null || \
  pm2 start $PROJECT/backend/.venv/bin/uvicorn \
    --name karagroup-backend \
    --interpreter none \
    --cwd $PROJECT/backend \
    -- main:app --host 127.0.0.1 --port 8000 --workers 2

echo "==> Bot deps"
$PROJECT/tg-bot/.venv/bin/pip install -r $PROJECT/tg-bot/requirements.txt -q

echo "==> Restart bot"
pm2 restart karagroup-bot 2>/dev/null || \
  pm2 start $PROJECT/tg-bot/.venv/bin/python \
    --name karagroup-bot \
    --interpreter none \
    --cwd $PROJECT/tg-bot \
    -- bot.py

echo "==> Build web"
cd $PROJECT/web
grep -E '^NEXT_PUBLIC_' $PROJECT/backend/.env > $PROJECT/web/.env.production 2>/dev/null || true
echo "BACKEND_URL=http://localhost:8000" >> $PROJECT/web/.env.production
npm install --silent
npm run build

echo "==> Restart web"
pm2 restart karagroup-web 2>/dev/null || \
  pm2 start npm --name karagroup-web --cwd $PROJECT/web -- start

pm2 save --force

echo ""
echo "✓ Done"
pm2 status
