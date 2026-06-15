#!/bin/sh
# Mount /data/photos vom Prod-Server (Hetzner) lokal als ./data/photos via sshfs.
# Voraussetzungen: macFUSE + sshfs (brew install --cask macfuse && brew install sshfs).
# Idempotent: läuft schon ein Mount, passiert nichts.

set -e

REMOTE="root@78.46.189.129"
REMOTE_PATH="/data/photos"
LOCAL_PATH="$(cd "$(dirname "$0")/.." && pwd)/data/photos"

if mount | grep -q " on $LOCAL_PATH "; then
  echo "✓ data/photos ist bereits gemountet"
  exit 0
fi

if [ ! -d "$LOCAL_PATH" ]; then
  mkdir -p "$LOCAL_PATH"
fi

# Mountpoint muss leer sein, sonst weigert sich sshfs.
if [ -n "$(ls -A "$LOCAL_PATH" 2>/dev/null)" ]; then
  echo "✗ $LOCAL_PATH ist nicht leer — bitte aufräumen oder umbenennen."
  ls -la "$LOCAL_PATH"
  exit 1
fi

echo "🔌 Mounte $REMOTE:$REMOTE_PATH → $LOCAL_PATH ..."
sshfs "$REMOTE:$REMOTE_PATH" "$LOCAL_PATH" \
  -o reconnect,defer_permissions,noappledouble,volname=flux-photos

if mount | grep -q " on $LOCAL_PATH "; then
  echo "✓ Mount aktiv. Beispiel-Inhalt:"
  ls "$LOCAL_PATH" | head -5
else
  echo "✗ Mount konnte nicht hergestellt werden."
  exit 1
fi
