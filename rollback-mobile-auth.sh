#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ $# -ne 2 ]]; then
  echo "Usage: bash rollback-mobile-auth.sh /path/to/quickhelp/public_html /root/quickhelp-mobile-backups/quickhelp-mobile-TIMESTAMP" >&2
  exit 2
fi
ROOT="$1"
BACKUP="$2"
if [[ ! -d "$BACKUP" ]]; then
  echo "Backup directory not found: $BACKUP" >&2
  exit 2
fi
exec python3 "$SCRIPT_DIR/scripts/install-mobile-auth.py" rollback --root "$ROOT" --backup "$BACKUP"
