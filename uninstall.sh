#!/usr/bin/env bash
# ================================================================
#  shadowPanel v1.0 — Complete Uninstaller
#  Developed by Nystic.Shadow | Powered by shadowblack
#  Support: https://discord.gg/eezz8RAQ9c
#
#  Usage:
#    curl -sSL https://raw.githubusercontent.com/Shadow-Black-YT/shadowpanel-source/main/uninstall.sh | sudo bash
#    sudo bash uninstall.sh --all
#    sudo bash uninstall.sh --containers-only
# ================================================================
set -euo pipefail
IFS=$'\n\t'

# ── Colors ────────────────────────────────────────────────────
C='\033[0;36m' G='\033[0;32m' Y='\033[1;33m' R='\033[0;31m'
B='\033[0;34m' P='\033[0;35m' BOLD='\033[1m' DIM='\033[2m' NC='\033[0m'

clear
printf "${P}${BOLD}"
cat << 'BANNER'
   ██████╗ ███╗   ██╗██╗███████╗████████╗ █████╗ ██╗     ██╗     
  ██╔═══██╗████╗  ██║██║██╔════╝╚══██╔══╝██╔══██╗██║     ██║     
  ██║   ██║██╔██╗ ██║██║███████╗   ██║   ███████║██║     ██║     
  ██║   ██║██║╚██╗██║██║╚════██║   ██║   ██╔══██║██║     ██║     
  ╚██████╔╝██║ ╚████║██║███████║   ██║   ██║  ██║███████╗███████╗
   ╚═════╝ ╚═╝  ╚═══╝╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝
        v1.0 — Complete Uninstallation
BANNER
printf "${C}  Developed by Nystic.Shadow  |  Powered by shadowblack\n"
printf "${DIM}  Support: https://discord.gg/eezz8RAQ9c\n${NC}\n"

# ── Helpers ───────────────────────────────────────────────────
ok()   { printf "${G}  ✓ ${BOLD}%s${NC}\n" "$*"; }
warn() { printf "${Y}  ⚠  %s${NC}\n" "$*"; }
err()  { printf "${R}  ✗ %s${NC}\n" "$*" >&2; exit 1; }
info() { printf "${C}  → %s${NC}\n" "$*"; }
hdr()  { printf "\n${BOLD}${B}  ┌─ %s ─────${NC}\n\n" "$*"; }

# ── Parse args ────────────────────────────────────────────────
REMOVE_ALL=true
REMOVE_VOLUMES=true
REMOVE_IMAGES=true
REMOVE_DIR=true
INSTALL_DIR="/opt/shadowpanel"

while [[ $# -gt 0 ]]; do
  case $1 in
    --containers-only) REMOVE_VOLUMES=false; REMOVE_IMAGES=false; REMOVE_DIR=false; shift ;;
    --keep-data)       REMOVE_VOLUMES=false; shift ;;
    --keep-images)     REMOVE_IMAGES=false; shift ;;
    --keep-dir)        REMOVE_DIR=false; shift ;;
    --dir)             INSTALL_DIR="$2"; shift 2 ;;
    -y|--yes)          AUTO_YES=true; shift ;;
    -h|--help)         cat << HELP
Usage: $0 [options]

Options:
  --containers-only    Remove only containers, keep volumes, images, and directory
  --keep-data          Keep volume data (databases, backups, etc.)
  --keep-images        Keep Docker images for faster reinstall
  --keep-dir           Keep installation directory
  --dir PATH           Custom installation directory (default: /opt/shadowpanel)
  -y, --yes            Skip confirmation prompts
  -h, --help           Show this help message

Examples:
  sudo bash uninstall.sh                 # Complete removal
  sudo bash uninstall.sh --containers-only  # Remove only containers
  sudo bash uninstall.sh --keep-data     # Keep database data
HELP
                     exit 0 ;;
    *) warn "Unknown option: $1"; shift ;;
  esac
done

[[ $EUID -ne 0 ]] && err "Please run as root: sudo bash uninstall.sh"

# ── Confirmation ──────────────────────────────────────────────
hdr "Uninstall Summary"

info "Installation directory: $INSTALL_DIR"
$REMOVE_VOLUMES && info "Remove volumes: YES (databases, backups, servers)" || info "Remove volumes: NO"
$REMOVE_IMAGES  && info "Remove images: YES" || info "Remove images: NO"
$REMOVE_DIR     && info "Remove directory: YES" || info "Remove directory: NO"

if [[ ! ${AUTO_YES:-} ]]; then
  printf "\n${Y}${BOLD}  ⚠  WARNING: This will remove shadowPanel and all associated data${NC}\n"
  printf "${DIM}     This action cannot be undone!${NC}\n\n"
  read -r -p "  Continue? (y/N): " CONFIRM
  [[ $CONFIRM =~ ^[Yy]$ ]] || { info "Uninstall cancelled"; exit 0; }
fi

# ── Stop Services ─────────────────────────────────────────────
hdr "Stopping Services"

if docker-compose --version &>/dev/null && [ -f "$INSTALL_DIR/docker-compose.yml" ]; then
  cd "$INSTALL_DIR" 2>/dev/null && {
    info "Stopping Docker Compose stack..."
    docker-compose down --remove-orphans 2>/dev/null || true
    ok "Docker Compose stack stopped"
  } || warn "Could not cd to $INSTALL_DIR"
else
  info "No Docker Compose stack found at $INSTALL_DIR"
fi

# Stop any remaining shadowPanel containers
info "Stopping any remaining shadowPanel containers..."
docker ps -a --filter "name=shadowpanel" --format "{{.Names}}" | while read -r c; do
  docker stop "$c" 2>/dev/null && docker rm "$c" 2>/dev/null && info "Removed container: $c"
done

# ── Remove Containers ────────────────────────────────────────
hdr "Removing Containers"

CONTAINERS=$(docker ps -a --filter "label=com.shadowpanel.component" --format "{{.Names}}" 2>/dev/null || true)
if [[ -n "$CONTAINERS" ]]; then
  echo "$CONTAINERS" | while read -r c; do
    docker stop "$c" 2>/dev/null || true
    docker rm "$c" 2>/dev/null && info "Removed: $c"
  done
  ok "All shadowPanel containers removed"
else
  info "No shadowPanel containers found"
fi

# ── Remove Volumes ────────────────────────────────────────────
if $REMOVE_VOLUMES; then
  hdr "Removing Volumes"
  
  VOLUMES=$(docker volume ls --filter "label=com.shadowpanel.volume" -q 2>/dev/null || true)
  if [[ -n "$VOLUMES" ]]; then
    echo "$VOLUMES" | while read -r v; do
      docker volume rm "$v" 2>/dev/null && info "Removed volume: $v"
    done
    ok "All shadowPanel volumes removed"
  else
    # Try to remove known volume names
    for v in shadowpanel_postgres_data shadowpanel_redis_data shadowpanel_server_data shadowpanel_backup_data; do
      docker volume rm "$v" 2>/dev/null && info "Removed volume: $v" || true
    done
  fi
fi

# ── Remove Images ─────────────────────────────────────────────
if $REMOVE_IMAGES; then
  hdr "Removing Images"
  
  IMAGES=$(docker images --filter "label=com.shadowpanel.image" -q 2>/dev/null || true)
  if [[ -n "$IMAGES" ]]; then
    echo "$IMAGES" | while read -r i; do
      docker rmi "$i" 2>/dev/null && info "Removed image: $i" || warn "Could not remove image $i (may be in use)"
    done
  fi
  
  # Remove by name pattern
  docker images --format "{{.Repository}}:{{.Tag}}" | grep -i shadowpanel | while read -r i; do
    docker rmi "$i" 2>/dev/null && info "Removed image: $i" || true
  done
  
  ok "shadowPanel images removed"
fi

# ── Remove Networks ───────────────────────────────────────────
hdr "Removing Networks"

NETWORKS=$(docker network ls --filter "label=com.shadowpanel.network" -q 2>/dev/null || true)
if [[ -n "$NETWORKS" ]]; then
  echo "$NETWORKS" | while read -r n; do
    docker network rm "$n" 2>/dev/null && info "Removed network: $n"
  done
  ok "shadowPanel networks removed"
else
  # Try to remove known networks
  for n in shadowpanel_sp_internal shadowpanel_sp_public; do
    docker network rm "$n" 2>/dev/null && info "Removed network: $n" || true
  done
fi

# ── Remove Installation Directory ─────────────────────────────
if $REMOVE_DIR && [ -d "$INSTALL_DIR" ]; then
  hdr "Removing Installation Directory"
  
  info "Removing: $INSTALL_DIR"
  rm -rf "$INSTALL_DIR" 2>/dev/null && ok "Directory removed" || warn "Could not remove directory (permissions?)"
  
  # Remove symlinks
  for link in /usr/local/bin/shadowpanel /usr/bin/shadowpanel; do
    if [ -L "$link" ]; then
      rm -f "$link" && info "Removed symlink: $link"
    fi
  done
fi

# ── Cleanup System ────────────────────────────────────────────
hdr "System Cleanup"

# Remove cron jobs
crontab -l 2>/dev/null | grep -v shadowpanel | crontab - 2>/dev/null && info "Cron jobs cleaned"

# Remove systemd services
for service in shadowpanel-backend shadowpanel-agent shadowpanel-nginx; do
  if systemctl list-unit-files | grep -q "$service"; then
    systemctl stop "$service" 2>/dev/null || true
    systemctl disable "$service" 2>/dev/null || true
    rm -f "/etc/systemd/system/$service.service" 2>/dev/null || true
    info "Removed service: $service"
  fi
done

# Remove nginx configs
if [ -f "/etc/nginx/sites-enabled/shadowpanel" ]; then
  rm -f "/etc/nginx/sites-enabled/shadowpanel" "/etc/nginx/sites-available/shadowpanel"
  nginx -t && nginx -s reload 2>/dev/null || true
  info "Nginx configuration removed"
fi

# ── Final Check ───────────────────────────────────────────────
hdr "Final Verification"

RUNNING=$(docker ps --filter "name=shadowpanel" --format "{{.Names}}" 2>/dev/null | wc -l)
if [[ $RUNNING -eq 0 ]]; then
  ok "No shadowPanel containers are running"
else
  warn "$RUNNING shadowPanel container(s) still running:"
  docker ps --filter "name=shadowpanel" --format "{{.Names}}"
fi

if $REMOVE_DIR && [ ! -d "$INSTALL_DIR" ]; then
  ok "Installation directory removed"
elif [ -d "$INSTALL_DIR" ]; then
  info "Installation directory remains at: $INSTALL_DIR"
fi

# ── Completion ────────────────────────────────────────────────
printf "\n${G}${BOLD}"
cat << 'COMPLETE'
   ██████╗ ██████╗ ███╗   ███╗██████╗ ██╗     ███████╗████████╗███████╗
  ██╔════╝██╔═══██╗████╗ ████║██╔══██╗██║     ██╔════╝╚══██╔══╝██╔════╝
  ██║     ██║   ██║██╔████╔██║██████╔╝██║     █████╗     ██║   █████╗  
  ██║     ██║   ██║██║╚██╔╝██║██╔═══╝ ██║     ██╔══╝     ██║   ██╔══╝  
  ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║     ███████╗███████╗   ██║   ███████╗
   ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚══════╝╚══════╝   ╚═╝   ╚══════╝
COMPLETE
printf "${NC}"

printf "\n${G}${BOLD}  ✓ shadowPanel has been successfully uninstalled${NC}\n"
printf "${DIM}  To reinstall, visit: https://github.com/Shadow-Black-YT/shadowpanel-source\n"
printf "  Support: https://discord.gg/eezz8RAQ9c\n\n"

if $REMOVE_VOLUMES; then
  printf "${Y}  ⚠  Note: All data (databases, backups, servers) has been permanently deleted${NC}\n"
fi

exit 0