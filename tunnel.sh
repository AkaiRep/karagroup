#!/bin/bash
# tunnel.sh — запуск и проверка AmneziaWG туннеля на обоих серверах
# Запускать на Hetzner: bash tunnel.sh

REGRU_HOST="194.67.101.248"
REGRU_USER="root"
AWG_CONF="/etc/amnezia/amneziawg/awg0.conf"

read -s -p "Пароль REG.RU: " REGRU_PASS
echo ""
TUNNEL_IP_HETZNER="10.0.0.1"
TUNNEL_IP_REGRU="10.0.0.2"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# Проверяем sshpass
if ! command -v sshpass &>/dev/null; then
    info "Устанавливаем sshpass..."
    apt-get install -y sshpass -qq
fi

SSH="sshpass -p $REGRU_PASS ssh -o StrictHostKeyChecking=no $REGRU_USER@$REGRU_HOST"

echo ""
echo "========================================"
echo "  Поднимаем AmneziaWG туннель"
echo "========================================"
echo ""

# ── 1. Hetzner: сбрасываем и поднимаем туннель ─────────────────────────────
info "Hetzner: сбрасываем туннель..."
ip link del awg0 2>/dev/null && info "Старый интерфейс удалён" || true
ip link del wg0  2>/dev/null || true

info "Hetzner: поднимаем с amneziawg-go..."
WG_QUICK_USERSPACE_IMPLEMENTATION=amneziawg-go awg-quick up "$AWG_CONF"
if [ $? -eq 0 ]; then
    ok "Hetzner: туннель поднят"
else
    err "Hetzner: не удалось поднять туннель"
    exit 1
fi

# ── 2. REG.RU: сбрасываем и поднимаем туннель ──────────────────────────────
info "REG.RU: подключаемся и сбрасываем туннель..."
$SSH bash <<'REMOTE'
    ip link del awg0 2>/dev/null || true
    ip link del wg0  2>/dev/null || true
    echo "[remote] Старые интерфейсы удалены"
REMOTE

info "REG.RU: поднимаем с amneziawg-go..."
$SSH bash <<'REMOTE'
    WG_QUICK_USERSPACE_IMPLEMENTATION=amneziawg-go awg-quick up /etc/amnezia/amneziawg/awg0.conf
REMOTE
if [ $? -eq 0 ]; then
    ok "REG.RU: туннель поднят"
else
    err "REG.RU: не удалось поднять туннель"
    exit 1
fi

# ── 3. Ждём handshake ───────────────────────────────────────────────────────
info "Ждём handshake (до 30 сек)..."
for i in $(seq 1 6); do
    sleep 5
    HANDSHAKE=$(awg show awg0 latest-handshakes 2>/dev/null | awk '{print $2}')
    if [ -n "$HANDSHAKE" ] && [ "$HANDSHAKE" -gt 0 ]; then
        AGE=$(( $(date +%s) - HANDSHAKE ))
        if [ "$AGE" -lt 60 ]; then
            ok "Handshake установлен (${AGE}s назад)"
            break
        fi
    fi
    info "Попытка $i/6..."
done

# ── 4. Проверяем ping Hetzner → REG.RU ─────────────────────────────────────
info "Hetzner → REG.RU ping..."
if ping -c 3 -W 3 "$TUNNEL_IP_REGRU" &>/dev/null; then
    ok "Hetzner → REG.RU: пинг проходит"
else
    err "Hetzner → REG.RU: пинг не проходит"
fi

# ── 5. Проверяем ping REG.RU → Hetzner ─────────────────────────────────────
info "REG.RU → Hetzner ping..."
PING_RESULT=$($SSH ping -c 3 -W 3 "$TUNNEL_IP_HETZNER" 2>/dev/null | tail -2)
if echo "$PING_RESULT" | grep -q "0% packet loss\|33% packet loss"; then
    ok "REG.RU → Hetzner: пинг проходит"
    echo "$PING_RESULT"
else
    err "REG.RU → Hetzner: пинг не проходит"
    echo "$PING_RESULT"
fi

# ── 6. Проверяем сайт ───────────────────────────────────────────────────────
info "Проверяем https://karashop.ru..."
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://karashop.ru)
if [ "$HTTP_CODE" = "200" ]; then
    ok "Сайт работает (HTTP $HTTP_CODE)"
else
    err "Сайт недоступен (HTTP $HTTP_CODE)"
fi

# ── 7. Итог ─────────────────────────────────────────────────────────────────
echo ""
echo "========================================"
echo "  awg show (Hetzner)"
echo "========================================"
awg show

echo ""
echo "========================================"
echo "  awg show (REG.RU)"
echo "========================================"
$SSH awg show
