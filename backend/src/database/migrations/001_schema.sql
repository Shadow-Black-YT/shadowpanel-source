-- ============================================================
--  shadowPanel v1.0 — Database Schema
--  Developed by Nystic.Shadow | Powered by shadowblack
--  Support: https://discord.gg/eezz8RAQ9c
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enums ─────────────────────────────────────────────────────
CREATE TYPE user_role     AS ENUM ('superadmin','admin','client');
CREATE TYPE server_status AS ENUM ('installing','running','stopped','error','rebuilding','suspended');
CREATE TYPE node_status   AS ENUM ('online','offline','maintenance');
CREATE TYPE backup_status AS ENUM ('pending','running','completed','failed');

-- ── Users ─────────────────────────────────────────────────────
CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username         VARCHAR(32)  UNIQUE NOT NULL,
  email            VARCHAR(255) UNIQUE NOT NULL,
  password_hash    TEXT NOT NULL,
  role             user_role NOT NULL DEFAULT 'client',

  -- Limits
  server_limit     INTEGER DEFAULT 2,
  ram_limit        INTEGER DEFAULT 1024,
  cpu_limit        INTEGER DEFAULT 100,
  disk_limit       INTEGER DEFAULT 5120,

  -- Security
  totp_secret      TEXT,
  totp_enabled     BOOLEAN DEFAULT FALSE,
  email_verified   BOOLEAN DEFAULT FALSE,
  last_login_at    TIMESTAMPTZ,
  last_login_ip    INET,
  failed_logins    INTEGER DEFAULT 0,
  locked_until     TIMESTAMPTZ,

  -- GitHub
  github_id        VARCHAR(64),
  github_token_enc TEXT,
  github_username  VARCHAR(128),

  is_suspended     BOOLEAN DEFAULT FALSE,
  suspension_reason TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_hash TEXT NOT NULL UNIQUE,
  ip_address   INET,
  user_agent   TEXT,
  last_used    TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  is_revoked   BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE api_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(128) NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,
  token_prefix VARCHAR(12) NOT NULL,
  last_used    TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Nodes ─────────────────────────────────────────────────────
CREATE TABLE nodes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(128) NOT NULL,
  fqdn             VARCHAR(255),
  location         VARCHAR(128),
  agent_url        TEXT NOT NULL,
  agent_secret     TEXT NOT NULL,
  status           node_status DEFAULT 'offline',

  -- Hardware
  total_ram        INTEGER DEFAULT 0,
  total_cpu        INTEGER DEFAULT 0,
  total_disk       INTEGER DEFAULT 0,
  allocated_ram    INTEGER DEFAULT 0,
  allocated_cpu    INTEGER DEFAULT 0,
  allocated_disk   INTEGER DEFAULT 0,

  -- Networking
  public_ip        INET,
  port_range_start INTEGER DEFAULT 25000,
  port_range_end   INTEGER DEFAULT 35000,
  used_ports       INTEGER[] DEFAULT '{}',

  -- Health
  cpu_usage        NUMERIC(5,2) DEFAULT 0,
  ram_usage        INTEGER DEFAULT 0,
  disk_usage       INTEGER DEFAULT 0,
  load_avg         NUMERIC(5,2) DEFAULT 0,
  last_ping        TIMESTAMPTZ,

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Servers ───────────────────────────────────────────────────
CREATE TABLE servers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  node_id         UUID NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
  name            VARCHAR(128) NOT NULL,
  description     TEXT,
  status          server_status NOT NULL DEFAULT 'installing',

  -- Container
  container_id    VARCHAR(128),
  docker_image    TEXT NOT NULL,
  startup_command TEXT,
  environment     JSONB DEFAULT '{}',
  port_mappings   JSONB DEFAULT '[]',
  volumes         JSONB DEFAULT '[]',

  -- Resources
  ram_limit       INTEGER NOT NULL DEFAULT 512,
  cpu_limit       INTEGER NOT NULL DEFAULT 100,
  disk_limit      INTEGER NOT NULL DEFAULT 2048,
  swap_limit      INTEGER DEFAULT 0,

  -- Networking
  internal_port   INTEGER,
  external_port   INTEGER,
  domain          VARCHAR(255),
  ssl_enabled     BOOLEAN DEFAULT FALSE,

  -- Git
  git_repo        TEXT,
  git_branch      VARCHAR(128) DEFAULT 'main',
  git_auto_deploy BOOLEAN DEFAULT FALSE,
  last_deployed   TIMESTAMPTZ,

  -- Backup
  auto_backup     BOOLEAN DEFAULT FALSE,
  backup_schedule VARCHAR(64) DEFAULT '0 3 * * *',

  -- Stats snapshot
  cpu_usage       NUMERIC(5,2) DEFAULT 0,
  ram_usage       INTEGER DEFAULT 0,
  disk_usage      INTEGER DEFAULT 0,
  net_rx          BIGINT DEFAULT 0,
  net_tx          BIGINT DEFAULT 0,

  -- Type/template
  template_name   VARCHAR(128),
  server_type     VARCHAR(64) DEFAULT 'custom',

  suspended_at    TIMESTAMPTZ,
  suspension_reason TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Sub-user server access
CREATE TABLE server_access (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by  UUID NOT NULL REFERENCES users(id),
  permissions TEXT[] DEFAULT '{"view","console","files"}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(server_id, user_id)
);

-- ── Stats (time-series) ───────────────────────────────────────
CREATE TABLE server_stats (
  id          BIGSERIAL PRIMARY KEY,
  server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  cpu_usage   NUMERIC(5,2),
  ram_usage   INTEGER,
  disk_usage  INTEGER,
  net_rx      BIGINT DEFAULT 0,
  net_tx      BIGINT DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Templates ─────────────────────────────────────────────────
CREATE TABLE templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(128) NOT NULL,
  description     TEXT,
  category        VARCHAR(32) NOT NULL DEFAULT 'custom',
  icon            VARCHAR(8) DEFAULT '⚡',
  docker_image    TEXT NOT NULL,
  startup_cmd     TEXT,
  default_env     JSONB DEFAULT '{}',
  default_ports   JSONB DEFAULT '[]',
  default_ram     INTEGER DEFAULT 512,
  default_cpu     INTEGER DEFAULT 100,
  default_disk    INTEGER DEFAULT 2048,
  is_featured     BOOLEAN DEFAULT FALSE,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Backups ───────────────────────────────────────────────────
CREATE TABLE backups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id    UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         VARCHAR(255),
  status       backup_status DEFAULT 'pending',
  size_bytes   BIGINT DEFAULT 0,
  file_path    TEXT,
  checksum     TEXT,
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  error_msg    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Domains ───────────────────────────────────────────────────
CREATE TABLE domains (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  server_id   UUID REFERENCES servers(id) ON DELETE SET NULL,
  domain      VARCHAR(255) UNIQUE NOT NULL,
  target_port INTEGER,
  ssl_enabled BOOLEAN DEFAULT FALSE,
  ssl_expires TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Settings ─────────────────────────────────────────────────
CREATE TABLE settings (
  key        VARCHAR(128) PRIMARY KEY,
  value      TEXT,
  type       VARCHAR(16) DEFAULT 'string',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Audit log ─────────────────────────────────────────────────
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(64) NOT NULL,
  resource    VARCHAR(64),
  resource_id UUID,
  ip_address  INET,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tunnel config ─────────────────────────────────────────────
CREATE TABLE tunnel_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tunnel_type VARCHAR(16) DEFAULT 'quick',
  tunnel_url  TEXT,
  cf_token_enc TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  last_seen   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_users_email       ON users(email);
CREATE INDEX idx_servers_user      ON servers(user_id);
CREATE INDEX idx_servers_node      ON servers(node_id);
CREATE INDEX idx_servers_status    ON servers(status);
CREATE INDEX idx_server_stats_time ON server_stats(server_id, recorded_at DESC);
CREATE INDEX idx_sessions_user     ON sessions(user_id) WHERE is_revoked = FALSE;
CREATE INDEX idx_audit_user        ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_backups_server    ON backups(server_id);

-- ── Triggers ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_ts   BEFORE UPDATE ON users   FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_servers_ts BEFORE UPDATE ON servers FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_nodes_ts   BEFORE UPDATE ON nodes   FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Auto-sync node allocations
CREATE OR REPLACE FUNCTION sync_node_alloc() RETURNS TRIGGER AS $$
BEGIN
  UPDATE nodes SET
    allocated_ram  = COALESCE((SELECT SUM(ram_limit)  FROM servers WHERE node_id = COALESCE(NEW.node_id, OLD.node_id) AND status != 'suspended'), 0),
    allocated_cpu  = COALESCE((SELECT SUM(cpu_limit)  FROM servers WHERE node_id = COALESCE(NEW.node_id, OLD.node_id) AND status != 'suspended'), 0),
    allocated_disk = COALESCE((SELECT SUM(disk_limit) FROM servers WHERE node_id = COALESCE(NEW.node_id, OLD.node_id) AND status != 'suspended'), 0),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.node_id, OLD.node_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_alloc AFTER INSERT OR UPDATE OR DELETE ON servers FOR EACH ROW EXECUTE FUNCTION sync_node_alloc();

-- Cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_data() RETURNS void AS $$
BEGIN
  DELETE FROM server_stats WHERE recorded_at < NOW() - INTERVAL '7 days';
  UPDATE sessions SET is_revoked = TRUE WHERE expires_at < NOW() AND is_revoked = FALSE;
  DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ================================================================
--  shadowPanel v1.0 — Feature Additions (GDrive + Git Deploy)
-- ================================================================

-- ── Google Drive connections ──────────────────────────────────
CREATE TABLE gdrive_connections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  email            VARCHAR(255),
  display_name     VARCHAR(255),
  root_folder_id   VARCHAR(128),       -- shadowPanel root folder in Drive
  is_active        BOOLEAN DEFAULT TRUE,
  connected_at     TIMESTAMPTZ DEFAULT NOW(),
  last_sync        TIMESTAMPTZ
);

-- ── Backup schedules ──────────────────────────────────────────
CREATE TABLE backup_schedules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id    UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE UNIQUE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_enabled   BOOLEAN DEFAULT TRUE,
  cron_expr    VARCHAR(64) NOT NULL DEFAULT '0 3 * * *',  -- daily 3am
  destination  VARCHAR(16) DEFAULT 'local',               -- 'local' | 'gdrive' | 'both'
  gdrive_folder_id VARCHAR(128),                          -- auto-created per server
  retain_count INTEGER DEFAULT 7,
  compress     BOOLEAN DEFAULT TRUE,
  last_run     TIMESTAMPTZ,
  next_run     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── GitHub connections (per user) ─────────────────────────────
CREATE TABLE github_connections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  github_id        VARCHAR(64) NOT NULL,
  github_username  VARCHAR(128) NOT NULL,
  github_email     VARCHAR(255),
  access_token_enc TEXT NOT NULL,     -- AES-256 encrypted
  avatar_url       TEXT,
  scopes           TEXT[] DEFAULT '{"repo","read:user"}',
  connected_at     TIMESTAMPTZ DEFAULT NOW(),
  last_used        TIMESTAMPTZ
);

-- ── Git deployments (per server) ─────────────────────────────
CREATE TABLE git_deployments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id       UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_url        TEXT NOT NULL,
  repo_name       VARCHAR(255),
  branch          VARCHAR(128) NOT NULL DEFAULT 'main',
  is_private      BOOLEAN DEFAULT FALSE,
  auto_deploy     BOOLEAN DEFAULT FALSE,
  webhook_secret  VARCHAR(128),
  last_commit_sha VARCHAR(64),
  last_commit_msg TEXT,
  last_deploy_at  TIMESTAMPTZ,
  deploy_status   VARCHAR(16) DEFAULT 'idle',   -- idle | deploying | success | failed
  deploy_log      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_git_deploy_server ON git_deployments(server_id);

-- ── GDrive backup log ─────────────────────────────────────────
CREATE TABLE gdrive_backup_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id    UUID NOT NULL REFERENCES backups(id) ON DELETE CASCADE,
  file_id      VARCHAR(128),         -- Google Drive file ID
  file_name    TEXT,
  folder_id    VARCHAR(128),
  size_bytes   BIGINT DEFAULT 0,
  status       VARCHAR(16) DEFAULT 'pending',  -- pending|uploading|done|failed
  error_msg    TEXT,
  uploaded_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Update users table for encryption key
ALTER TABLE users ADD COLUMN IF NOT EXISTS enc_key VARCHAR(64) DEFAULT encode(gen_random_bytes(32),'hex');
