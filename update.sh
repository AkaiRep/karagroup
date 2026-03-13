#!/bin/bash
set -e
PROJECT=/root/karagroup

echo "==> Git pull"
cd $PROJECT
git pull

echo "==> Backend deps"
pip install -r $PROJECT/backend/requirements.txt -q

echo "==> Restart backend"
pm2 restart uvicorn 2>/dev/null || pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name uvicorn --cwd $PROJECT/backend

echo "==> Restart bot"
pm2 restart tg-bot 2>/dev/null || pm2 start "python3 bot.py" --name tg-bot --cwd $PROJECT/tg-bot

echo "==> Build web"
cd $PROJECT/web
npm install --silent
npm run build

echo "==> Restart web"
pm2 restart karashop-web 2>/dev/null || pm2 start "npm start" --name karashop-web --cwd $PROJECT/web

pm2 save --force

echo ""
echo "✓ Done"
pm2 status
