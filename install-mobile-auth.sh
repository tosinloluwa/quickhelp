#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ $# -lt 1 ]]; then
  echo "Usage: bash install-mobile-auth.sh /path/to/quickhelp/public_html [--php php-cli]" >&2
  exit 2
fi
ROOT="$1"
shift
exec python3 "$SCRIPT_DIR/scripts/install-mobile-auth.py" install --root "$ROOT" "$@"
