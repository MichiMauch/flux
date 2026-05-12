#!/bin/sh

# Prüfe ob SSH-Tunnel schon läuft
if ! lsof -i:5432 -sTCP:LISTEN > /dev/null 2>&1; then
  echo "🔌 Starte SSH-Tunnel zur Prod-DB..."
  ssh -f -N -L 5432:localhost:54321 root@78.46.189.129
  sleep 1
  if lsof -i:5432 -sTCP:LISTEN > /dev/null 2>&1; then
    echo "✓ SSH-Tunnel läuft"
  else
    echo "✗ SSH-Tunnel konnte nicht gestartet werden"
    exit 1
  fi
else
  echo "✓ SSH-Tunnel läuft bereits"
fi

# Dev-Server starten — TZ=UTC matched den Prod-Container (Node-Alpine ohne TZ),
# sodass `postgres.js` Werte aus `timestamp WITHOUT TIME ZONE` korrekt als UTC
# interpretiert. Ohne das liest der Mac (Europe/Zurich) gespeicherte Zeiten 2h
# zu früh aus (s. Hero-Card "Letzte Aktivität").
exec env TZ=UTC npx next dev -p 3002
