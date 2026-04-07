<div align="center">

<br/>

<img src="https://raw.githubusercontent.com/Shadow-Black-YT/shadowpanel/main/docs/logo.svg" alt="shadowPanel" width="90" height="90"/>

# shadowPanel

<h3>Enterprise Hosting Control Panel</h3>

<p>Deploy, manage, and monitor your servers with a stunning Mission Control interface.<br/>Built for developers who demand both power and beauty.</p>

<br/>

[![Version](https://img.shields.io/badge/version-1.0.0-00d4ff?style=for-the-badge&labelColor=020209&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI4IiBjeT0iOCIgcj0iOCIgZmlsbD0iIzAwZDRmZiIvPjwvc3ZnPg==)](https://github.com/Shadow-Black-YT/shadowpanel/releases)
[![Docker](https://img.shields.io/badge/Docker-✓-2496ED?style=for-the-badge&labelColor=020209&logo=docker)](https://docker.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-✓-3178C6?style=for-the-badge&labelColor=020209&logo=typescript)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-✓-336791?style=for-the-badge&labelColor=020209&logo=postgresql)](https://postgresql.org)
[![React](https://img.shields.io/badge/React-✓-61DAFB?style=for-the-badge&labelColor=020209&logo=react)](https://reactjs.org)
[![License](https://img.shields.io/badge/license-MIT-7928ca?style=for-the-badge&labelColor=020209)](LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Support-5865f2?style=for-the-badge&labelColor=020209&logo=discord&logoColor=white)](https://discord.gg/eezz8RAQ9c)
[![Powered by](https://img.shields.io/badge/Powered%20by-shadowblack-00ff88?style=for-the-badge&labelColor=020209)](https://discord.gg/eezz8RAQ9c)

<br/>

```bash
# One-Command Installation
curl -sSL https://raw.githubusercontent.com/Shadow-Black-YT/shadowpanel-source/main/install.sh | sudo bash
```

<br/>

</div>

---

<div align="center">

## ✦ What is shadowPanel?

</div>

shadowPanel is a **self-hosted enterprise hosting control panel** — designed to run on your own VPS and manage Docker containers, game servers, web apps, Discord bots, and databases with a single, beautiful interface.

Think mission control for your infrastructure. No cloud lock-in. No per-seat fees. No compromise.

<br/>

## 🚀 One-Click Installation

### Quick Install (All-in-One)
```bash
# Install with default settings
curl -sSL https://raw.githubusercontent.com/Shadow-Black-YT/shadowpanel-source/main/install.sh | sudo bash

# Or with custom domain
sudo bash install.sh --domain panel.yourdomain.com --email admin@yourdomain.com

# Cloudflare Tunnel (no domain required)
sudo bash install.sh --cf-token YOUR_TOKEN --cf-account YOUR_ACCOUNT_ID

# Force Cloudflare quick tunnel
sudo bash install.sh --force-tunnel
```

### Docker Compose Installation
```bash
# Clone repository
git clone https://github.com/Shadow-Black-YT/shadowpanel-source.git
cd shadowpanel-source

# Copy environment file
cp .env.example .env
# Edit .env with your settings
nano .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

## 📦 Uninstallation

### Complete Removal (Including Data)
```bash
# Stop and remove all containers, volumes, and networks
docker-compose down -v

# Remove installation directory
sudo rm -rf /opt/shadowpanel

# Remove Docker images
docker rmi $(docker images -q shadowpanel-*) 2>/dev/null || true
```

### Quick Uninstall Script
```bash
# Download and run uninstaller
curl -sSL https://raw.githubusercontent.com/Shadow-Black-YT/shadowpanel-source/main/uninstall.sh | sudo bash
```

<br/>

## ⚡ Features

<table>
<tr>
<td width="50%" valign="top">

### 🖥️ **Server Management**
- **Multi-Node Support** - Deploy across multiple physical/virtual servers
- **Docker Containerization** - Isolated game/application servers
- **Real-time Monitoring** - CPU, RAM, Disk, Network metrics
- **One-Click Templates** - Minecraft, CS:GO, Rust, ARK, and more
- **Auto-Scaling** - Scale resources based on demand
- **Web-based Terminal** - Browser-based SSH-like terminal
- **File Manager** - Full CRUD operations with Monaco code editor

### ☁️ **Google Drive Backup**
- **OAuth2 Integration** - One-click connection
- **Scheduled Backups** - Hourly, daily, weekly, custom cron
- **Auto-organization** - Creates `shadowPanel Backups/ServerName/` folder
- **Multi-destination** - Local, Google Drive, or both simultaneously
- **Incremental Backups** - Save storage space
- **Retention Policies** - Keep 1-30 backup copies
- **One-Click Restoration** - Rollback to any point

### 🐙 **Git Integration**
- **GitHub OAuth** - Connect private and public repositories
- **Auto-deployment** - Deploy on `git push` via webhook
- **Branch Selection** - Deploy specific branches
- **Real-time Logs** - Live deployment progress
- **Commit Tracking** - SHA + message tracking
- **Webhook Security** - HMAC signature verification

</td>
<td width="50%" valign="top">

### 🔐 **Security & Access**
- **JWT + Refresh Tokens** - 15min access, 30day refresh
- **TOTP 2FA** - QR code setup with Google Authenticator
- **Role-Based Access Control** - Superadmin → Admin → Client
- **API Token Management** - Granular permissions with prefix display
- **Per-Session Revocation** - Revoke individual sessions
- **Account Lockout** - After failed login attempts
- **Server Sub-user Access** - Granular permissions per server

### 🌍 **Networking & Access**
- **Auto-detection** - Public IPv4 and IPv6 detection
- **Cloudflare Tunnel** - Secure public access without port forwarding
- **Named Tunnels** - Permanent URLs via Cloudflare API
- **Quick Tunnels** - 24h auto-renewal for testing
- **Custom Domain Management** - Map domains to servers with SSL support
- **NGINX Reverse Proxy** - Built-in with WebSocket support
- **SSL/TLS Certificates** - Automatic Let's Encrypt integration

### 🏗️ **Infrastructure**
- **Multi-Node Architecture** - Distributed agent-based deployment
- **Node Health Monitoring** - 30-second polling
- **Port Auto-allocation** - Smart port range management
- **cgroup Isolation** - Memory, CPU quota limits
- **Security Hardened** - `no-new-privileges:true`, `CAP_DROP ALL`
- **Docker Compose + systemd** - Production-ready service management
- **Audit Logging** - Complete activity tracking

</td>
</tr>
</table>

<br/>

## 🎮 Template Gallery

| Template | Type | Default RAM | Description |
|----------|------|-------------|-------------|
| ⛏ Minecraft Java (PaperMC) | Game | 1024 MB | Latest PaperMC with optimizations |
| ⛏ Minecraft Bedrock | Game | 512 MB | Bedrock Dedicated Server |
| 🎯 CS2 Dedicated Server | Game | 2048 MB | Counter-Strike 2 server |
| 🦀 Rust | Game | 4096 MB | Rust dedicated server |
| ⚔️ Valheim | Game | 2048 MB | Valheim dedicated server |
| 🎮 ARK: Survival Evolved | Game | 4096 MB | ARK Survival Evolved |
| ⬡ Node.js App | Web App | 512 MB | Node.js with PM2 process manager |
| 🐍 Python (FastAPI/Flask) | Web App | 256 MB | Python web applications |
| ▲ Next.js | Web App | 512 MB | Next.js with production build |
| 🤖 Discord Bot | Bot | 256 MB | Discord.js/Pycord bot template |
| 🔵 WordPress | Web | 512 MB | WordPress with MySQL |
| 🌐 Static Site (Nginx) | Web | 64 MB | Nginx serving static files |
| 🗄 MySQL 8.0 | Database | 512 MB | MySQL database server |
| 🐘 PostgreSQL 16 | Database | 256 MB | PostgreSQL database |
| 🔴 Redis | Database | 128 MB | Redis cache server |
| ⚡ Custom Docker | Custom | Any | Custom Docker image support |

<br/>

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     shadowPanel v1.0                         │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React) │  Backend (Node.js)  │   Agent (Go)      │
│  • Dashboard      │  • REST API         │  • Docker Control │
│  • Real-time UI   │  • WebSocket        │  • Resource Stats │
│  • Theme System   │  • Authentication   │  • Backup Exec    │
└───────────────────┴─────────────────────┴───────────────────┘
                            │
                    ┌───────▼───────┐
                    │  PostgreSQL   │
                    │  • Users      │
                    │  • Servers    │
                    │  • Nodes      │
                    └───────┬───────┘
                            │
                    ┌───────▼───────┐
                    │     Redis     │
                    │  • Sessions   │
                    │  • Cache      │
                    │  • Pub/Sub    │
                    └───────────────┘
```

<br/>

## 📋 System Requirements

### Minimum
- **CPU**: 2 cores (x86_64 or ARM64)
- **RAM**: 2 GB
- **Storage**: 20 GB SSD
- **OS**: Ubuntu 20.04+, Debian 11+, CentOS 8+
- **Docker**: 20.10+
- **Docker Compose**: 2.0+

### Recommended
- **CPU**: 4+ cores
- **RAM**: 4+ GB  
- **Storage**: 50+ GB SSD
- **Network**: 100+ Mbps

<br/>

## 🔧 Configuration

### Environment Variables
Create `.env` file from template:
```bash
cp .env.example .env
```

Key configuration options:
```env
# Required
PANEL_URL=https://panel.yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=secure_password

# Database
POSTGRES_PASSWORD=secure_db_password
DATABASE_URL=postgresql://shadow:password@postgres:5432/shadowpanel

# Redis
REDIS_PASSWORD=secure_redis_password

# Security
JWT_SECRET=64_char_random_string
JWT_REFRESH_SECRET=64_char_random_string

# Agent
AGENT_SECRET=agent_communication_secret

# Google Drive (Optional)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://your-panel.com/api/v1/gdrive/callback

# GitHub (Optional)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

### Port Configuration
- **80/443**: Web interface (NGINX)
- **5000**: Backend API
- **8080**: Agent communication
- **5432**: PostgreSQL (internal)
- **6379**: Redis (internal)

<br/>

## 🐙 Setting Up GitHub Integration

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) → **New OAuth App**
2. Set **Authorization callback URL** to `https://your-panel.com/api/v1/git/callback`
3. Copy Client ID and Secret to `/opt/shadowpanel/.env`
4. Restart the backend: `docker compose restart backend`
5. In shadowPanel → **Settings** → **GitHub Integration** → Connect

Once connected, you can deploy any **public or private** repository to any server.

<br/>

## ☁️ Setting Up Google Drive Backups

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable **Google Drive API**
3. Create OAuth 2.0 credentials (Web application)
4. Add redirect URI: `https://your-panel.com/api/v1/gdrive/callback`
5. Copy Client ID and Secret to `/opt/shadowpanel/.env`
6. Restart backend, then in shadowPanel → **Settings** → **Google Drive** → Connect

shadowPanel will automatically create `shadowPanel Backups/<ServerName>/` in your Drive.

<br/>

## 📊 Monitoring & Logs

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f agent

# Application logs
tail -f logs/backend.log
tail -f logs/agent.log
```

### Health Checks
```bash
# API Health
curl http://localhost:5000/health

# Database connection
docker-compose exec postgres pg_isready -U shadow

# Redis connection  
docker-compose exec redis redis-cli -a $REDIS_PASSWORD ping
```

<br/>

## 🔌 API

shadowPanel exposes a full REST API at `/api/v1/`. Authenticate with:

```bash
# Get token
curl -X POST https://your-panel.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"yourpass"}'

# Use token
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-panel.com/api/v1/servers

# Or use API tokens (from Settings → API Tokens)
curl -H "X-API-Token: sp_your_api_token" \
     https://your-panel.com/api/v1/servers
```

<br/>

## 🔄 Updates

### Update to Latest Version
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose pull
docker-compose build --no-cache
docker-compose up -d
```

### Backup Before Update
```bash
# Create backup
docker-compose exec postgres pg_dump -U shadow shadowpanel > backup_$(date +%Y%m%d).sql

# Restore backup
cat backup.sql | docker-compose exec -T postgres psql -U shadow shadowpanel
```

<br/>

## 🐛 Troubleshooting

### Common Issues

**Issue**: "Docker not found"  
**Solution**: Install Docker and Docker Compose
```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
```

**Issue**: "Port already in use"  
**Solution**: Change ports in `.env` or stop conflicting services

**Issue**: "Database connection failed"  
**Solution**: Check PostgreSQL logs and credentials
```bash
docker-compose logs postgres
```

**Issue**: "Permission denied on /var/run/docker.sock"  
**Solution**: Add user to docker group
```bash
sudo usermod -aG docker $USER
newgrp docker
```

**Issue**: "Cloudflare tunnel not working"  
**Solution**: Check tunnel service status
```bash
systemctl status shadowpanel-tunnel
cat /opt/shadowpanel/.tunnel-url
```

<br/>

## 🛡️ Security Notes

- All passwords are bcrypt-hashed (cost 12)
- OAuth tokens are AES-256-GCM encrypted at rest
- JWT expiry: 15 minutes (access) / 30 days (refresh)
- Rate limiting: 300 req/15min globally, 10/15min for auth
- Containers run with `CAP_DROP ALL` + selective add-back
- `no-new-privileges:true` on all containers
- Per-session revocation support
- Audit logging for all administrative actions

<br/>

## 🤝 Support

<div align="center">

**Questions? Issues? Feature requests?**

Join the community Discord server for help and updates.

[![Discord](https://img.shields.io/badge/Join%20Discord-5865f2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/eezz8RAQ9c)

</div>

<br/>

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

<br/>

---

<div align="center">

<sub>Developed by <strong>Nystic.Shadow</strong> · Powered by <strong>shadowblack</strong></sub>

<sub>© 2025 shadowPanel. Built with ❤️ for the self-hosting community.</sub>

</div>
