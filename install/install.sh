#!/bin/sh
set -eu

REPO="Dielldev/genpact-ag-hack"
BASE="${MESH_RELEASE_URL:-https://github.com/$REPO/releases/latest/download}"
BIN="${MESH_HOME:-$HOME}/.mesh/bin"

if ! command -v node >/dev/null 2>&1; then
  echo "Mesh needs Node.js 20 or newer: https://nodejs.org/en/download" >&2
  exit 1
fi
MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$MAJOR" -lt 20 ]; then
  echo "Mesh needs Node.js 20 or newer, found $MAJOR." >&2
  exit 1
fi

echo "Downloading Mesh..."
mkdir -p "$BIN"
for FILE in cli.mjs hook.mjs SHA256SUMS; do
  curl -fsSL "$BASE/$FILE" -o "$BIN/$FILE"
done

if command -v sha256sum >/dev/null 2>&1; then
  CHECK="sha256sum -c SHA256SUMS"
else
  CHECK="shasum -a 256 -c SHA256SUMS"
fi
if ! (cd "$BIN" && $CHECK >/dev/null); then
  rm -rf "$BIN"
  echo "Checksum mismatch. Nothing was installed." >&2
  exit 1
fi

set -- init
[ -n "${MESH_SERVER:-}" ] && set -- "$@" --server "$MESH_SERVER"
[ -n "${MESH_WORKSPACE:-}" ] && set -- "$@" --workspace "$MESH_WORKSPACE"
[ -n "${MESH_CLIENTS:-}" ] && set -- "$@" --clients "$MESH_CLIENTS"

if [ -r /dev/tty ] && [ -t 1 ]; then
  node "$BIN/cli.mjs" "$@" < /dev/tty
else
  node "$BIN/cli.mjs" "$@" --yes
fi

echo ""
echo "Done. Check it any time with: node \"$BIN/cli.mjs\" status"
