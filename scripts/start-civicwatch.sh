#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/start-civicwatch.sh [--skip-db-start] [--production]

Starts CivicWatch on Linux/macOS.

Options:
  --skip-db-start   Do not start the local .postgres-data cluster.
                    Use this for managed/remote Postgres.
  --production      Run built Node servers instead of Vite/tsx dev servers.
                    Run pnpm run build first.
  -h, --help        Show this help text.
EOF
}

trim() {
  local value="$*"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

load_dotenv() {
  local file="$1"
  [[ -f "$file" ]] || return 0

  local line name value
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="$(trim "$line")"
    [[ -z "$line" || "${line:0:1}" == "#" || "$line" != *"="* ]] && continue

    name="$(trim "${line%%=*}")"
    value="$(trim "${line#*=}")"
    [[ "$name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

    if [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
      value="${value:1:${#value}-2}"
    fi

    if [[ -z "${!name+x}" || -z "${!name}" ]]; then
      export "$name=$value"
    fi
  done < "$file"
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

skip_db_start=false
production=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-db-start)
      skip_db_start=true
      ;;
    --production)
      production=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
  shift
done

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"
cd "$repo_root"

load_dotenv "$repo_root/.env"

export POSTGRES_HOST="${POSTGRES_HOST:-${DB_HOST:-localhost}}"
if [[ -z "${POSTGRES_PORT:-}" ]]; then
  if [[ -n "${DB_PORT:-}" ]]; then
    export POSTGRES_PORT="$DB_PORT"
  elif [[ -n "${DB_HOST:-}" || -n "${DB_NAME:-}" || -n "${DB_USER:-}" || -n "${DB_PASSWORD:-}" ]]; then
    export POSTGRES_PORT="5432"
  else
    export POSTGRES_PORT="55432"
  fi
fi
export POSTGRES_DB="${POSTGRES_DB:-${DB_NAME:-civicwatch_explore}}"
export POSTGRES_USER="${POSTGRES_USER:-${DB_USER:-postgres}}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -n "${DB_PASSWORD:-}" ]]; then
    export DATABASE_URL="postgres://${POSTGRES_USER}:${DB_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
  else
    export DATABASE_URL="postgres://${POSTGRES_USER}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
  fi
fi

export API_PORT="${API_PORT:-${PORT:-4000}}"
export API_HOST="${API_HOST:-127.0.0.1}"
export API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:${API_PORT}/api/v1}"
export PUBLIC_API_BASE_URL="${PUBLIC_API_BASE_URL:-$API_BASE_URL}"
export WEB_HOST="${WEB_HOST:-127.0.0.1}"
export WEB_PORT="${WEB_PORT:-3000}"

data_dir="$repo_root/.postgres-data"
log_dir="$repo_root/.postgres-log"

if [[ "$skip_db_start" == false ]]; then
  [[ -d "$data_dir" ]] || die "Postgres data directory not found at $data_dir. Restore the CivicWatch dump before launching, or pass --skip-db-start for remote Postgres."
  command -v pg_ctl >/dev/null 2>&1 || die "pg_ctl was not found on PATH. Add PostgreSQL's bin directory to PATH, then run this script again."

  mkdir -p "$log_dir"

  if pg_ctl status -D "$data_dir" >/dev/null 2>&1; then
    printf 'CivicWatch Postgres is already running from .postgres-data.\n'
  else
    printf 'Starting isolated CivicWatch Postgres on localhost:%s...\n' "$POSTGRES_PORT"
    pg_ctl \
      -D "$data_dir" \
      -o "-p $POSTGRES_PORT -c listen_addresses=localhost -c shared_buffers=1GB -c work_mem=32MB -c maintenance_work_mem=1GB" \
      -l "$log_dir/postgres.log" \
      start
  fi
fi

if [[ "$production" == true ]]; then
  [[ -f "$repo_root/apps/api/dist/server.js" ]] || die "API build not found. Run pnpm run build first."
  [[ -f "$repo_root/apps/web/build/index.js" ]] || die "Web build not found. Run pnpm run build first."

  printf 'Launching CivicWatch production servers...\n'
  printf 'Web: http://%s:%s/\n' "$WEB_HOST" "$WEB_PORT"
  printf 'API: http://%s:%s/\n' "$API_HOST" "$API_PORT"

  node "$repo_root/apps/api/dist/server.js" &
  api_pid=$!

  (
    cd "$repo_root/apps/web"
    HOST="$WEB_HOST" PORT="$WEB_PORT" node build
  ) &
  web_pid=$!

  shutdown() {
    kill "$api_pid" "$web_pid" >/dev/null 2>&1 || true
  }
  trap shutdown INT TERM EXIT

  while true; do
    if ! kill -0 "$api_pid" >/dev/null 2>&1; then
      set +e
      wait "$api_pid"
      exit_code=$?
      set -e
      shutdown
      wait "$web_pid" >/dev/null 2>&1 || true
      exit "$exit_code"
    fi

    if ! kill -0 "$web_pid" >/dev/null 2>&1; then
      set +e
      wait "$web_pid"
      exit_code=$?
      set -e
      shutdown
      wait "$api_pid" >/dev/null 2>&1 || true
      exit "$exit_code"
    fi

    sleep 1
  done
fi

printf 'Launching CivicWatch development servers...\n'
printf 'Web: http://127.0.0.1:5173/\n'
printf 'API: http://%s:%s/\n' "$API_HOST" "$API_PORT"
pnpm run dev
