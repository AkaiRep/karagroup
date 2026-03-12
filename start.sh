#!/bin/bash
# KaraGroup — запуск бэкенда

cd "$(dirname "$0")/backend"

if [ ! -d ".venv" ]; then
  echo "🔧 Создаём виртуальное окружение..."
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q -r requirements.txt

echo "🚀 Запускаем сервер на http://localhost:8000"
echo "📖 Документация API: http://localhost:8000/docs"
echo ""
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
