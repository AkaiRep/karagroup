#!/bin/bash
set -e
PROJECT=/root/karagroup

echo "==> Backend deps"
pip install -r $PROJECT/backend/requirements.txt -q

echo "==> Bot deps"
pip install -r $PROJECT/tg-bot/requirements.txt -q

echo "==> Start backend"
pm2 delete uvicorn 2>/dev/null || true
pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name uvicorn --cwd $PROJECT/backend

echo "==> Start bot"
pm2 delete tg-bot 2>/dev/null || true
pm2 start "python3 bot.py" --name tg-bot --cwd $PROJECT/tg-bot

echo "==> Build web"
cd $PROJECT/web
npm install --silent
npm run build

echo "==> Start web"
pm2 delete karashop-web 2>/dev/null || true
pm2 start "npm start" --name karashop-web --cwd $PROJECT/web

echo "==> Setup reviews cron"
pm2 delete parse-reviews 2>/dev/null || true
pm2 start "python3 parse_reviews.py" --name parse-reviews --cwd $PROJECT/backend --cron "0 4 * * *" --no-autorestart

pm2 save --force
pm2 startup

echo ""
echo "✓ Done"
pm2 status
