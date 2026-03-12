#!/bin/bash
# KaraGroup — запуск TG-бота

cd "$(dirname "$0")"

if [ ! -f ".env" ]; then
  echo "⚠️  Файл .env не найден. Создаём из шаблона..."
  cp .env.example .env
  echo "📝 Заполни .env своими данными и запусти скрипт снова."
  exit 1
fi

if [ ! -d ".venv" ]; then
  echo "🔧 Создаём виртуальное окружение..."
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q -r requirements.txt

echo "🤖 Запускаем TG-бота..."
echo ""
python bot.py
