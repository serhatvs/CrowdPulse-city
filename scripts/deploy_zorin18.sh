#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

OS_RELEASE_FILE="/etc/os-release"
REQUIRED_DEPS=(curl git jq)
APT_DEPS=(curl git jq ca-certificates gnupg lsb-release)
NEEDS_UPDATE=0

log() { printf "\n[deploy-zorin18] %s\n" "$*"; }
warn() { printf "\n[deploy-zorin18][warn] %s\n" "$*"; }

command_exists() { command -v "$1" >/dev/null 2>&1; }

ensure_os_compatibility() {
  if [[ -f "$OS_RELEASE_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$OS_RELEASE_FILE"
    local name_lower="${NAME,,}"
    local version_id="${VERSION_ID:-unknown}"
    if [[ "$name_lower" != *"zorin"* ]]; then
      warn "Bu script Zorin OS 18 hedeflenerek yazıldı (algılanan: ${NAME:-unknown} ${version_id}). Devam ediliyor."
    elif [[ "$version_id" != 18* ]]; then
      warn "Algılanan sürüm ${version_id}. Script Zorin OS 18 için optimize edilmiştir."
    else
      log "Zorin OS 18 doğrulandı."
    fi
  else
    warn "/etc/os-release okunamadı; OS doğrulaması atlanıyor."
  fi
}

install_with_apt() {
  local packages=("$@")
  if ! command_exists apt-get; then
    warn "apt-get bulunamadı; otomatik kurulum atlanıyor."
    return 1
  fi

  if [[ $NEEDS_UPDATE -eq 0 ]]; then
    log "apt paket listesi güncelleniyor..."
    sudo apt-get update -y
    NEEDS_UPDATE=1
  fi

  log "Eksik paketler kuruluyor: ${packages[*]}"
  sudo apt-get install -y "${packages[@]}"
}

ensure_base_deps() {
  local missing=()
  for dep in "${REQUIRED_DEPS[@]}"; do
    command_exists "$dep" || missing+=("$dep")
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    log "Temel bağımlılıklar eksik: ${missing[*]}"
    install_with_apt "${APT_DEPS[@]}"
  else
    log "Temel bağımlılıklar hazır."
  fi
}

ensure_node() {
  if command_exists node && command_exists npm; then
    log "Node.js hazır: $(node --version), npm: $(npm --version)"
    return
  fi

  log "Node.js/npm eksik, NodeSource üzerinden Node 20 kuruluyor..."
  install_with_apt ca-certificates curl gnupg

  if [[ ! -f /etc/apt/keyrings/nodesource.gpg ]]; then
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  fi

  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
    | sudo tee /etc/apt/sources.list.d/nodesource.list >/dev/null

  NEEDS_UPDATE=0
  install_with_apt nodejs
  log "Node.js kuruldu: $(node --version), npm: $(npm --version)"
}

ensure_docker() {
  if command_exists docker && docker compose version >/dev/null 2>&1; then
    log "Docker + docker compose hazır."
    return
  fi

  log "Docker eksik, resmi Docker deposu ile kuruluyor..."
  install_with_apt ca-certificates curl gnupg

  sudo install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | sudo tee /etc/apt/keyrings/docker.asc >/dev/null
    sudo chmod a+r /etc/apt/keyrings/docker.asc
  fi

  # shellcheck disable=SC1090
  source /etc/os-release
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-noble} stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

  NEEDS_UPDATE=0
  install_with_apt docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo systemctl enable --now docker

  if ! groups "$USER" | grep -q '\bdocker\b'; then
    sudo usermod -aG docker "$USER"
    warn "Kullanıcı docker grubuna eklendi. Yeni grup üyeliği için tekrar login gerekebilir."
  fi
}

prepare_env() {
  if [[ ! -f .env && -f .env.example ]]; then
    cp .env.example .env
    log ".env.example -> .env kopyalandı."
  fi
}

deploy_services() {
  if command_exists docker && docker compose version >/dev/null 2>&1; then
    log "Servisler docker compose ile ayağa kaldırılıyor..."
    docker compose up -d --build

    log "API sağlık kontrolü yapılıyor..."
    for _ in {1..20}; do
      if curl -fsS "http://localhost:3001/health" >/dev/null; then
        log "API başarılı şekilde ayağa kalktı: http://localhost:3001/health"
        docker compose ps
        return
      fi
      sleep 2
    done

    warn "API sağlık kontrolü zaman aşımına uğradı. Loglar:"
    docker compose logs --tail=100 api || true
    exit 1
  fi

  warn "Docker yok; fallback olarak API lokal başlatılıyor."
  npm install
  nohup npm run dev:api > /tmp/crowdpulse-api.log 2>&1 &
  sleep 3
  curl -fsS "http://localhost:3001/health" >/dev/null
  log "API lokal modda çalışıyor. Log: /tmp/crowdpulse-api.log"
}

main() {
  ensure_os_compatibility
  ensure_base_deps
  ensure_node
  ensure_docker
  prepare_env
  deploy_services
  log "Tamamlandı."
}

main "$@"
