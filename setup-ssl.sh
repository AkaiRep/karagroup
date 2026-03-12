#!/bin/bash
# KaraGroup — настройка Nginx + SSL
# Запускать от root на сервере: bash setup-ssl.sh

set -e

read -p "Введи домен (например karashop.ru): " DOMAIN
read -p "Введи email для SSL-сертификата: " EMAIL

echo ""
echo "▶ Устанавливаем Nginx и Certbot..."
apt-get update -q
apt-get install -y nginx certbot python3-certbot-nginx

echo "▶ Создаём конфиг Nginx для $DOMAIN..."
cat > /etc/nginx/sites-available/karashop << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

ln -sf /etc/nginx/sites-available/karashop /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

echo "▶ Проверяем конфиг Nginx..."
nginx -t

echo "▶ Перезапускаем Nginx..."
systemctl enable nginx
systemctl restart nginx

echo "▶ Получаем SSL-сертификат..."
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m $EMAIL

echo ""
echo "=============================="
echo " Готово!"
echo "=============================="
echo ""
echo " Сайт доступен по адресу: https://$DOMAIN"
echo " Webhook для ЮКассы: https://$DOMAIN/payments/webhook"
echo ""
echo " Не забудь обновить .env бэкенда:"
echo " YOOKASSA_RETURN_URL=https://$DOMAIN"
echo ""
echo " И зарегистрировать webhook в ЮКассе:"
echo " https://$DOMAIN/payments/webhook"
