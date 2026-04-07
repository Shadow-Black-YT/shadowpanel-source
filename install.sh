#!/usr/bin/env bash
# ================================================================
#  shadowPanel v1.0 — One-Command Enterprise Installer
#  Developed by Nystic.Shadow | Powered by shadowblack
#  Support: https://discord.gg/eezz8RAQ9c
#
#  Usage:
#    curl -sSL https://raw.githubusercontent.com/Shadow-Black-YT/shadowpanel-source/main/install.sh | bash
#    bash install.sh --domain panel.yourdomain.com
#    bash install.sh --cf-token TOKEN --cf-account ACCOUNT
# ================================================================
set -euo pipefail
IFS=$'\n\t'

# ── Colors ────────────────────────────────────────────────────
C='\033[0;36m' G='\033[0;32m' Y='\033[1;33m' R='\033[0;31m'
B='\033[0;34m' P='\033[0;35m' BOLD='\033[1m' DIM='\033[2m' NC='\033[0m'

clear
printf "${P}${BOLD}"
cat << 'BANNER'
  ░██████╗██╗  ██╗ █████╗ ██████╗  ██████╗ ██╗    ██╗
  ██╔════╝██║  ██║██╔══██╗██╔══██╗██╔═══██╗██║    ██║
  ╚█████╗ ███████║███████║██║  ██║██║   ██║██║ █╗ ██║
  ╚════██║██╔══██║██╔══██║██║  ██║██║   ██║██║███╗██║
  ███████║██║  ██║██║  ██║██████╔╝╚██████╔╝╚███╔███╔╝
  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝  ╚═════╝  ╚══╝╚══╝
       v1.0 — Enterprise Hosting Control Panel
BANNER
printf "${C}  Developed by Nystic.Shadow  |  Powered by shadowblack\n"
printf "${DIM}  Support: https://discord.gg/eezz8RAQ9c\n${NC}\n"

# ── Helpers ───────────────────────────────────────────────────
ok()   { printf "${G}  ✓ ${BOLD}%s${NC}\n" "$*"; }
warn() { printf "${Y}  ⚠  %s${NC}\n" "$*"; }
err()  { printf "${R}  ✗ %s${NC}\n" "$*" >&2; exit 1; }
info() { printf "${C}  → %s${NC}\n" "$*"; }
hdr()  { printf "\n${BOLD}${B}  ┌─ %s ─────${NC}\n\n" "$*"; }
ask()  { 
  exec 3<&0
  exec 0</dev/tty
  printf "${P}  ?${NC} ${BOLD}%s${NC}\n" "$1" >&2
  read -r -p "    › " "$2"
  exec 0<&3
}
askp() { 
  exec 3<&0
  exec 0</dev/tty
  printf "${P}  ?${NC} ${BOLD}%s${NC}\n" "$1" >&2
  read -r -s -p "    › " "$2"
  echo
  exec 0<&3
}

# ── Parse args ────────────────────────────────────────────────
DOMAIN="" EMAIL="" ADMIN_USER="admin" ADMIN_PASS=""
CF_TOKEN="" CF_ACCOUNT="" INSTALL_DIR="/opt/shadowpanel"
GIT_USER="" GIT_TOKEN=""
SKIP_DOCKER=false FORCE_TUNNEL=false YES=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --domain)     DOMAIN="$2";     shift 2 ;;
    --email)      EMAIL="$2";      shift 2 ;;
    --user)       ADMIN_USER="$2"; shift 2 ;;
    --pass)       ADMIN_PASS="$2"; shift 2 ;;
    --cf-token)   CF_TOKEN="$2";   shift 2 ;;
    --cf-account) CF_ACCOUNT="$2"; shift 2 ;;
    --dir)        INSTALL_DIR="$2"; shift 2 ;;
    --git-user)   GIT_USER="$2";   shift 2 ;;
    --git-token)  GIT_TOKEN="$2";  shift 2 ;;
    --skip-docker) SKIP_DOCKER=true; shift ;;
    --force-tunnel) FORCE_TUNNEL=true; shift ;;
    -y|--yes)     YES=true; shift ;;
    *) warn "Unknown: $1"; shift ;;
  esac
done

[[ $EUID -ne 0 ]] && err "Please run as root: sudo bash install.sh"

# ── Interactive config ────────────────────────────────────────
hdr "Setup Configuration"

$YES || {
  [[ -z "$EMAIL" ]] && { ask "[Required for Admin Login] Admin email:" EMAIL; [[ -z "$EMAIL" ]] && err "Email required"; }
  [[ -z "$ADMIN_PASS" ]] && { askp "[Security] Admin password (blank = auto-generate):" ADMIN_PASS; }
}

[[ -z "$EMAIL" ]] && EMAIL="admin@shadowpanel.local"
[[ -z "$ADMIN_PASS" ]] && ADMIN_PASS=$(tr -dc 'A-Za-z0-9!@#$' < /dev/urandom | head -c 20)
ok "Configuration set"

# ── System check ─────────────────────────────────────────────
hdr "System Check"
. /etc/os-release 2>/dev/null || true
info "OS: ${PRETTY_NAME:-Unknown} · Arch: $(uname -m)"
RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
info "RAM: ${RAM_MB}MB · Disk: $(df -BG / | awk 'NR==2{print $4}')B free"
[[ $RAM_MB -lt 512 ]] && warn "Low RAM. 1GB+ recommended."

# Detect package manager
if command -v apt-get &>/dev/null; then PKG=apt
elif command -v yum &>/dev/null;   then PKG=yum
elif command -v dnf &>/dev/null;   then PKG=dnf
else err "No supported package manager (apt/yum/dnf)"; fi

info "[Dependencies] Installing system requirements (curl, git, jq, etc)..."
case $PKG in
  apt) apt-get update -qq && apt-get install -y -qq curl wget git openssl ca-certificates jq unzip lsb-release gnupg 2>/dev/null ;;
  yum) yum install -y -q curl wget git openssl ca-certificates jq unzip gnupg2 2>/dev/null ;;
  dnf) dnf install -y -q curl wget git openssl ca-certificates jq unzip gnupg2 2>/dev/null ;;
esac
ok "System packages ready"

# ── Network detection ─────────────────────────────────────────
hdr "Network Detection"
PUBLIC_IPV4="" PUBLIC_IPV6="" ACCESS_METHOD="direct"

info "[Network Mapping] Probing external IPv4 address..."
for URL in "https://api4.ipify.org" "https://ipv4.icanhazip.com" "https://checkip.amazonaws.com"; do
  IP=$(curl -sf --connect-timeout 4 "$URL" 2>/dev/null | tr -d '[:space:]') || continue
  if [[ "$IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
    if ! echo "$IP" | grep -qE '^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)'; then
      PUBLIC_IPV4="$IP"; break
    fi
  fi
done

info "[Network Mapping] Probing external IPv6 address..."
for URL in "https://api6.ipify.org" "https://ipv6.icanhazip.com"; do
  IP=$(curl -sf --connect-timeout 4 "$URL" 2>/dev/null | tr -d '[:space:]') || continue
  [[ "$IP" =~ ^[0-9a-fA-F:]+$ && ${#IP} -gt 4 ]] && { PUBLIC_IPV6="$IP"; break; }
done

[[ -n "$PUBLIC_IPV4" ]] && { ok "IPv4: $PUBLIC_IPV4"; ACCESS_METHOD="ipv4"; }
[[ -n "$PUBLIC_IPV6" ]] && { ok "IPv6: $PUBLIC_IPV6"; [[ "$ACCESS_METHOD" == "direct" ]] && ACCESS_METHOD="ipv6"; }
[[ -z "$PUBLIC_IPV4" && -z "$PUBLIC_IPV6" ]] && { info "[Failover] No direct IP found, activating Cloudflare Tunnel requirement."; ACCESS_METHOD="tunnel"; }
$FORCE_TUNNEL && { info "[Config] Forcing Cloudflare Tunnel networking."; ACCESS_METHOD="tunnel"; }

[[ -z "$DOMAIN" ]] && {
  [[ "$ACCESS_METHOD" == "ipv4" ]] && DOMAIN="$PUBLIC_IPV4"
  [[ "$ACCESS_METHOD" == "ipv6" ]] && DOMAIN="[$PUBLIC_IPV6]"
  [[ "$ACCESS_METHOD" == "tunnel" ]] && DOMAIN="pending"
}
ok "Access method: $ACCESS_METHOD"

# ── Docker ───────────────────────────────────────────────────
hdr "Docker Engine"
if ! $SKIP_DOCKER && ! command -v docker &>/dev/null; then
  info "Installing Docker Engine..."
  if [[ "$PKG" == "apt" ]]; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/${ID:-ubuntu}/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID:-ubuntu} $(lsb_release -cs 2>/dev/null || echo stable) stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -qq && apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin 2>/dev/null
  else
    curl -fsSL https://get.docker.com | sh
  fi
  systemctl enable docker --now
  ok "Docker installed"
else
  ok "Docker: $(docker --version 2>/dev/null | cut -d' ' -f3 | tr -d ',')"
fi

# Ensure compose plugin
docker compose version &>/dev/null || {
  mkdir -p /usr/local/lib/docker/cli-plugins
  ARCH=$(uname -m); [[ "$ARCH" == "aarch64" ]] && ARCH="arm64" || ARCH="amd64"
  curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${ARCH}" -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
}
ok "Docker Compose: $(docker compose version --short)"

# ── Cloudflare Tunnel (if needed) ────────────────────────────
TUNNEL_URL="" TUNNEL_TYPE="none"
if [[ "$ACCESS_METHOD" == "tunnel" ]]; then
  hdr "Cloudflare Tunnel"
  ARCH=$(uname -m); CF_ARCH="amd64"; [[ "$ARCH" == "aarch64" ]] && CF_ARCH="arm64"

  if ! command -v cloudflared &>/dev/null; then
    info "Installing cloudflared..."
    wget -q "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" -O /usr/local/bin/cloudflared
    chmod +x /usr/local/bin/cloudflared
    ok "cloudflared installed"
  fi

  mkdir -p "$INSTALL_DIR"

  if [[ -n "$CF_TOKEN" && -n "$CF_ACCOUNT" ]]; then
    info "Creating named permanent tunnel..."
    TNAME="shadowpanel-$(hostname | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | head -c 20)"
    RESP=$(curl -sf -X POST "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/cfd_tunnel" \
      -H "Authorization: Bearer ${CF_TOKEN}" -H "Content-Type: application/json" \
      -d "{\"name\":\"${TNAME}\",\"tunnel_secret\":\"$(openssl rand -base64 32)\"}" 2>/dev/null || echo '{}')
    TID=$(echo "$RESP"  | jq -r '.result.id   // empty' 2>/dev/null || true)
    TTOK=$(echo "$RESP" | jq -r '.result.token // empty' 2>/dev/null || true)
    if [[ -n "$TID" && -n "$TTOK" ]]; then
      echo "$TTOK" > "$INSTALL_DIR/.cf-tunnel-token"
      echo "$TID"  > "$INSTALL_DIR/.cf-tunnel-id"
      TUNNEL_URL="https://${TID}.cfargotunnel.com"
      echo "$TUNNEL_URL" > "$INSTALL_DIR/.tunnel-url"
      TUNNEL_TYPE="named"
      ok "Named tunnel: $TUNNEL_URL (permanent)"
    else
      warn "Named tunnel creation failed — using quick tunnel (24h renewal)"
      TUNNEL_TYPE="quick"
    fi
  else
    TUNNEL_TYPE="quick"
    warn "No CF credentials provided. Using quick tunnel (renews every 24h)."
    info "For permanent URL: bash install.sh --cf-token TOKEN --cf-account ACCOUNT_ID"
  fi

  # Write tunnel runner script
  cat > "$INSTALL_DIR/tunnel.sh" << 'TUNSH'
#!/usr/bin/env bash
INSTALL_DIR="/opt/shadowpanel"
URL_FILE="$INSTALL_DIR/.tunnel-url"
if [[ -f "$INSTALL_DIR/.cf-tunnel-token" ]]; then
  exec cloudflared tunnel --no-autoupdate run --token "$(cat $INSTALL_DIR/.cf-tunnel-token)"
else
  while true; do
    LOG=$(mktemp /tmp/tunnel.XXXX.log)
    cloudflared tunnel --no-autoupdate --url "http://localhost:80" --logfile "$LOG" &
    PID=$!
    for i in $(seq 1 40); do
      sleep 3
      URL=$(grep -oE 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$LOG" 2>/dev/null | head -1 || true)
      if [[ -n "$URL" ]]; then
        echo "$URL" > "$URL_FILE"
        echo "[$(date)] Tunnel active: $URL"
        curl -sf -X POST "http://localhost:5000/api/v1/tunnel/url" -H "Content-Type: application/json" -d "{\"url\":\"$URL\"}" >/dev/null 2>&1 || true
        wait $PID
        break
      fi
    done
    rm -f "$LOG"
    echo "[$(date)] Tunnel ended — restarting in 5s..."
    sleep 5
  done
fi
TUNSH
  chmod +x "$INSTALL_DIR/tunnel.sh"

  cat > /etc/systemd/system/shadowpanel-tunnel.service << SVC
[Unit]
Description=shadowPanel Cloudflare Tunnel
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=/bin/bash ${INSTALL_DIR}/tunnel.sh
Restart=always
RestartSec=10
StandardOutput=append:${INSTALL_DIR}/tunnel.log
StandardError=append:${INSTALL_DIR}/tunnel.log
[Install]
WantedBy=multi-user.target
SVC
  systemctl daemon-reload && systemctl enable shadowpanel-tunnel
  ok "Tunnel service registered"
fi

# ── Download Source ───────────────────────────────────────────
hdr "Downloading shadowPanel Source"

if [[ ! -f "$INSTALL_DIR/docker-compose.yml" ]]; then
  info "[Source Code] Attempting to fetch panel files..."
  if [ "$YES" = "false" ]; then
    if [ -z "$GIT_USER" ]; then ask "[Optional] GitHub Username (leave blank for public anonymous pull):" GIT_USER; fi
    if [ -z "$GIT_TOKEN" ]; then askp "[Optional] GitHub Access Token (leave blank for public anonymous pull):" GIT_TOKEN; fi
  fi

  info "[Repository] Cloning into $INSTALL_DIR..."
  rm -rf "$INSTALL_DIR"
  if [[ -n "$GIT_USER" && -n "$GIT_TOKEN" ]]; then
    if ! git clone -q "https://${GIT_USER}:${GIT_TOKEN}@github.com/Shadow-Black-YT/shadowpanel-source.git" "$INSTALL_DIR"; then
      err "Failed to clone repository with provided token. Check token permissions."
    fi
  else
    info "[Anon] Attempting anonymous public install..."
    if ! git clone -q "https://github.com/Shadow-Black-YT/shadowpanel-source.git" "$INSTALL_DIR"; then
      err "Anonymous clone failed. The repository is likely private. Please re-run and provide a GitHub token!"
    fi
  fi
  ok "Source code downloaded successfully"
fi

# ── Install ───────────────────────────────────────────────────
hdr "Installing shadowPanel v1.0"
mkdir -p "$INSTALL_DIR" && cd "$INSTALL_DIR"
mkdir -p logs nginx/certs

# Generate secrets
gen32() { openssl rand -hex 32; }
genPW()  { LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 24 || true; }

JWT_SECRET=$(gen32); JWT_REFRESH=$(gen32)
AGENT_SECRET=$(gen32); DB_PASS=$(genPW); REDIS_PASS=$(genPW)
WEBHOOK_SECRET=$(gen32)

PANEL_URL="http://${DOMAIN:-localhost}"
[[ "$ACCESS_METHOD" == "tunnel" && -n "$TUNNEL_URL" ]] && PANEL_URL="$TUNNEL_URL"

# Write .env
cat > "$INSTALL_DIR/.env" << ENV
# shadowPanel v1.0 — Generated $(date)
# Developed by Nystic.Shadow | Powered by shadowblack | Support: discord.gg/eezz8RAQ9c

NODE_ENV=production
PANEL_URL=${PANEL_URL}
PANEL_DOMAIN=${DOMAIN:-localhost}
API_PORT=5000

POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=shadowpanel
POSTGRES_USER=shadow
POSTGRES_PASSWORD=${DB_PASS}
DATABASE_URL=postgresql://shadow:${DB_PASS}@postgres:5432/shadowpanel

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASS}
REDIS_URL=redis://:${REDIS_PASS}@redis:6379

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=${JWT_REFRESH}
JWT_REFRESH_EXPIRES_IN=30d

AGENT_SECRET=${AGENT_SECRET}
AGENT_PORT=8080
AGENT_HOST=agent

DOCKER_SOCKET=/var/run/docker.sock

ADMIN_EMAIL=${EMAIL}
ADMIN_PASSWORD=${ADMIN_PASS}
ADMIN_USERNAME=${ADMIN_USER}

ACCESS_METHOD=${ACCESS_METHOD}
PUBLIC_IPV4=${PUBLIC_IPV4}
PUBLIC_IPV6=${PUBLIC_IPV6}
TUNNEL_URL=${TUNNEL_URL}
CF_API_TOKEN=${CF_TOKEN}
CF_ACCOUNT_ID=${CF_ACCOUNT}
TUNNEL_TYPE=${TUNNEL_TYPE}
INSTALL_DIR=${INSTALL_DIR}

SMTP_ENABLED=false
LOG_LEVEL=info
STORAGE_PATH=/data/servers
BACKUP_PATH=/data/backups

WEBHOOK_SECRET=${WEBHOOK_SECRET}
ENV

ok ".env generated"

# ── Build & Start ─────────────────────────────────────────────
hdr "Building & Starting Services"

if [[ -f "docker-compose.yml" ]]; then
  info "Building Docker images (may take 3–6 minutes on first run)..."
  docker compose build --parallel 2>&1 | tail -5

  info "Starting services..."
  docker compose up -d --remove-orphans
  ok "Services started"

  # Wait for backend
  info "Waiting for backend API..."
  for i in $(seq 1 60); do
    curl -sf "http://localhost:5000/health" &>/dev/null && break
    sleep 3
    [[ $i -eq 60 ]] && warn "Backend taking longer than expected — check: docker compose logs backend"
  done
else
  warn "docker-compose.yml not found. Place the shadowPanel files in $INSTALL_DIR first."
  warn "Then run: cd $INSTALL_DIR && docker compose up -d"
fi

# Start tunnel if needed
[[ "$ACCESS_METHOD" == "tunnel" ]] && {
  systemctl start shadowpanel-tunnel 2>/dev/null || true
  ok "Tunnel service started"
  info "Waiting for tunnel URL..."
  sleep 12
  [[ -f "$INSTALL_DIR/.tunnel-url" ]] && TUNNEL_URL=$(cat "$INSTALL_DIR/.tunnel-url") && PANEL_URL="$TUNNEL_URL"
}

# ── Systemd service ───────────────────────────────────────────
cat > /etc/systemd/system/shadowpanel.service << SVC
[Unit]
Description=shadowPanel v1.0
Requires=docker.service
After=docker.service
[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/docker compose up -d --remove-orphans
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300
[Install]
WantedBy=multi-user.target
SVC
systemctl daemon-reload && systemctl enable shadowpanel 2>/dev/null || true
ok "Systemd service registered"

# ── Complete ──────────────────────────────────────────────────
printf "\n${G}${BOLD}╔══════════════════════════════════════════════════════════════╗\n"
printf "║   🌑  shadowPanel v1.0 — Installation Complete!             ║\n"
printf "║   Developed by Nystic.Shadow  |  Powered by shadowblack     ║\n"
printf "╚══════════════════════════════════════════════════════════════╝${NC}\n\n"

printf "  ${BOLD}%-22s${NC} ${C}%s${NC}\n" "Panel URL:"     "${PANEL_URL:-http://${PUBLIC_IPV4:-localhost}}"
printf "  ${BOLD}%-22s${NC} ${C}%s${NC}\n" "Admin Email:"   "${EMAIL}"
printf "  ${BOLD}%-22s${NC} ${Y}%s${NC}\n" "Admin Password:""${ADMIN_PASS}"
printf "  ${BOLD}%-22s${NC} ${C}%s${NC}\n" "Network Mode:"  "${ACCESS_METHOD}"
[[ -n "$PUBLIC_IPV4" ]] && printf "  ${BOLD}%-22s${NC} ${C}%s${NC}\n" "Public IPv4:" "$PUBLIC_IPV4"
[[ "$ACCESS_METHOD" == "tunnel" ]] && printf "  ${BOLD}%-22s${NC} ${C}%s${NC}\n" "Tunnel Type:" "$TUNNEL_TYPE"

printf "\n  ${BOLD}Quick commands:${NC}\n"
printf "  ${C}  cd $INSTALL_DIR && docker compose logs -f${NC}\n"
printf "  ${C}  docker compose restart backend${NC}\n"
printf "  ${C}  docker compose ps${NC}\n"
printf "\n  ${B}Discord Support:${NC} ${C}https://discord.gg/eezz8RAQ9c${NC}\n"

[[ "$ACCESS_METHOD" == "tunnel" && "$TUNNEL_TYPE" == "quick" ]] && printf "\n  ${Y}⚠  Quick tunnel renews every 24h. For permanent:\n  bash install.sh --cf-token TOKEN --cf-account ID${NC}\n"

# Save creds
cat > /root/.shadowpanel << CRED
shadowPanel v1.0 Credentials — $(date)
Developed by Nystic.Shadow | Powered by shadowblack
====================================================
Panel URL:     ${PANEL_URL}
Admin Email:   ${EMAIL}
Admin Pass:    ${ADMIN_PASS}
Network Mode:  ${ACCESS_METHOD}
IPv4:          ${PUBLIC_IPV4}
IPv6:          ${PUBLIC_IPV6}
Tunnel Type:   ${TUNNEL_TYPE}
Install Dir:   ${INSTALL_DIR}
DB Password:   ${DB_PASS}
Redis Pass:    ${REDIS_PASS}
Agent Secret:  ${AGENT_SECRET}
Discord:       https://discord.gg/eezz8RAQ9c
CRED
chmod 600 /root/.shadowpanel

printf "\n  ${DIM}Credentials saved to: /root/.shadowpanel${NC}\n"
printf "  ${R}${BOLD}Change your admin password after first login!${NC}\n\n"
