# Polar GDPR Export Import

CLI zum Einspielen eines Polar-User-Data-Exports (GDPR-Download) in die flux-DB. Nützlich für historische Daten, die die AccessLink-API nicht mehr liefert.

## Aufruf

```bash
npx tsx --env-file=.env.local scripts/import-polar-export.ts \
  --dir=<pfad-zum-export-ordner> \
  --month=YYYY-MM \
  --email=<user-email> \
  [--dry-run]
```

### Beispiele

```bash
# Dry-Run zuerst (prüft nur, schreibt nichts)
npx tsx --env-file=.env.local scripts/import-polar-export.ts \
  --dir='/Users/michaelmauch/Downloads/polar-user-data-export_...' \
  --month=2026-01 \
  --email=michi.mauch@gmail.com \
  --dry-run

# Realer Import
npx tsx --env-file=.env.local scripts/import-polar-export.ts \
  --dir='/Users/michaelmauch/Downloads/polar-user-data-export_...' \
  --month=2026-01 \
  --email=michi.mauch@gmail.com
```

## Was wird importiert

- **`training-session-YYYY-MM-*.json`** → `activities` Tabelle
  - Route-Waypoints (lat/lon/alt/time)
  - 1 Hz Samples (HR, Speed, Altitude)
  - TRIMP via `computeTrimp()`
  - AI-Titel via `generateActivityTitle()`
- **`activity-YYYY-MM-*.json`** → `dailyActivity` Tabelle
  - Schritte, Kalorien, Distanz
  - Zonen (Export-`activityLevels` → API-kompatible `active-time-zones`)

**Nicht importiert**: `ppi_samples_*`, `247ohr_*`, `sleep-*`, `sport-profiles-*` etc. — kein passendes Schema.

## Idempotenz

- **Trainings**: Unique-Constraint auf `activities.polar_id` → wiederholter Lauf = `SKIP (already imported)`.
- **Tagesaktivitäten**: Upsert auf `(userId, date)` → überschreibt vorhandene Daten.

## Filter

- Trainings unter **5 min** Dauer ODER unter **500 m** Distanz werden automatisch übersprungen (Mini-Sessions durch versehentliches Starten/Stoppen).

## Sport-ID-Map (Vorsicht: gerätespezifisch!)

Polar-Sport-IDs sind **nicht universal** — sie sind je User-Profil und Gerät unterschiedlich. Die Map in `src/lib/polar-sport-map.ts` wurde für Michi Mauchs Vantage V3 (Account `2401976`) kalibriert:

| ID | Type | Notiz |
|---|---|---|
| `1` | RUNNING | best guess |
| `2` | ROAD_BIKING | Rennrad (Speeds 16–20 km/h) |
| `3` | WALKING | Spaziergang (Speeds 4.6–5.6 km/h) — **nicht MTB!** |
| `11` | HIKING | matches Polar Flow Label |
| `15` | MOUNTAIN_BIKING | best guess |
| `38` | ROAD_BIKING | Rennrad (beobachtet März 2026) |

**Für andere User** (z. B. Sibylle):
1. Erst `--dry-run` starten.
2. Die geloggten Types und Speeds stichprobenartig prüfen.
3. Bei Unstimmigkeiten: die Map in `src/lib/polar-sport-map.ts` anpassen.
4. Neue IDs → nach Plausibilität (Speed + Ascent) entscheiden:
   - `> 15 km/h` → Rad (ROAD_BIKING / MOUNTAIN_BIKING je nach Gelände)
   - `4–7 km/h` → WALKING oder HIKING (HIKING bei `ascent ≥ 80 m`)
   - `8–15 km/h` → RUNNING / TRAIL_RUNNING

## Nachträglich Typen korrigieren

Falls nach dem Import die Sport-Zuordnung falsch war, entweder:
- im UI pro Aktivität via Edit-Sheet,
- oder per Ad-hoc-tsx-Script wie damals für die 3 MTB-zu-Walking-Korrekturen (siehe Git-History, Commit `a407f1b` Umfeld).

## Ordner-Struktur einer GDPR-Export-Datei

Typisch:
```
polar-user-data-export_<uuid>/
├─ account-*.json
├─ training-session-YYYY-MM-DDTHH:MM:SS-<id>-<uuid>.json   ← importiert
├─ activity-YYYY-MM-DD-<uuid>.json                          ← importiert
├─ 247ohr_YYYY_MM-<uuid>.json                               ← ignoriert
├─ ppi_samples_YYYY_MM_N-<uuid>.json                        ← ignoriert
├─ sleep-*.json, sport-profiles-*.json, …                   ← ignoriert
```

## Env

Script braucht `.env.local` mit:
- `DATABASE_URL` (SSH-Tunnel muss laufen, siehe `scripts/dev.sh`)
- `OPENAI_API_KEY` (für AI-Titel)
