#!/bin/bash
set -e

PROJECT=/root/karagroup

echo "==> Backend"
cd $PROJECT/backend
pip install -r requirements.txt -q
pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name uvicorn 2>/dev/null || pm2 restart uvicorn

echo "==> Bot"
cd $PROJECT/tg-bot
pip install -r requirements.txt -q
pm2 start "python3 bot.py" --name tg-bot 2>/dev/null || pm2 restart tg-bot

echo "==> Web"
cd $PROJECT/web
npm install --silent
npm run build
pm2 start "npm start" --name karashop-web 2>/dev/null || pm2 restart karashop-web

echo "==> Save pm2"
pm2 save

echo "==> Done"
pm2 status
