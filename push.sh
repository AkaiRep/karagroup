#!/bin/bash
cd "$(dirname "$0")"

if [ -z "$(git status --porcelain)" ]; then
    echo "Нет изменений для коммита."
    exit 0
fi

git add .

MSG=${1:-"update $(date '+%Y-%m-%d %H:%M')"}
git commit -m "$MSG"

git push origin master
echo "✅ Залито на GitHub"
