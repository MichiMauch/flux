#!/bin/sh
# Unmount des sshfs-Mounts unter ./data/photos.
set -e

LOCAL_PATH="$(cd "$(dirname "$0")/.." && pwd)/data/photos"

if ! mount | grep -q " on $LOCAL_PATH "; then
  echo "✓ data/photos ist nicht gemountet"
  exit 0
fi

echo "🔌 Unmounte $LOCAL_PATH ..."
umount "$LOCAL_PATH" 2>/dev/null || diskutil unmount "$LOCAL_PATH"
echo "✓ Unmounted"
