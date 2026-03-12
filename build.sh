#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=============================="
echo " KaraGroup Build"
echo "=============================="

build_app() {
    local name=$1
    local dir=$2
    local target=$3

    echo ""
    echo "▶ Building $name ($target)..."
    cd "$ROOT/$dir"
    npm run build

    if [ "$target" = "win" ]; then
        npx electron-builder --win --x64
    elif [ "$target" = "mac" ]; then
        npx electron-builder --mac
    fi

    echo "✅ $name ($target) done → $dir/dist-electron/"
}

MODE=${1:-"both"}

if [ "$MODE" = "win" ]; then
    build_app "Admin"  "admin-app"  "win"
    build_app "Worker" "worker-app" "win"
elif [ "$MODE" = "mac" ]; then
    build_app "Admin"  "admin-app"  "mac"
    build_app "Worker" "worker-app" "mac"
else
    build_app "Admin"  "admin-app"  "win"
    build_app "Admin"  "admin-app"  "mac"
    build_app "Worker" "worker-app" "win"
    build_app "Worker" "worker-app" "mac"
fi

echo ""
echo "=============================="
echo " Все билды готовы!"
echo "=============================="
