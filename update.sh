#!/bin/bash
set -e

echo "==> Git pull"
git pull

echo "==> Restart backend"
pm2 restart uvicorn

echo "==> Restart bot"
pm2 restart tg-bot

echo "==> Build web"
cd web
npm run build
cd ..

echo "==> Restart web"
pm2 restart karashop-web

echo "==> Done"
pm2 status
