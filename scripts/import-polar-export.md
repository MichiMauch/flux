# Polar GDPR Export Import

CLI zum Einspielen eines Polar-User-Data-Exports (GDPR-Download) in die flux-DB. Nützlich für historische Daten, die die AccessLink-API nicht mehr liefert.

## Aufruf

```bash
npx tsx --env-file=.env.local scripts/import-polar-export.ts \
  --dir=<pfad-zum-export-ordner> \
  --email=<user-email> \
  ( --month=YYYY-MM | [--from=YYYY-MM-DD] [--until=YYYY-MM-DD] ) \
  [--types=HIKING,WALKING,CYCLING,...] \
  [--collapse-cycling] \
  [--no-daily] \
  [--analyze | --dry-run]
```

### Flags

- `--month=YYYY-MM` — Single-Month-Modus (Legacy). Schliesst sich mit `--from/--until` aus.
- `--from=YYYY-MM-DD` / `--until=YYYY-MM-DD` — Datumsbereich (inkl.). Beide optional.
- `--types=A,B,C` — Allowlist nach Type-Mapping (case-insensitive). Default: alle.
- `--collapse-cycling` — `ROAD_BIKING` / `MOUNTAIN_BIKING` / `GRAVEL_RIDING` / `EBIKE_RIDE` werden zu generischem `CYCLING`. Skript-lokal, ändert die Sport-ID-Map nicht permanent.
- `--no-daily` — Überspringt `activity-YYYY-MM-DD-*.json` komplett.
- `--analyze` — Read-only Inventar-Pass: parst alle Files, druckt Pivot-Tabelle (sport.id × device × final-type × decision), aber **kein einziger DB-Call**. Ideal für die erste Sichtprüfung.
- `--dry-run` — Liest die DB (Idempotenz-Check) aber schreibt nichts. AI-Titel werden im Dry-Run **übersprungen** (würden eh nicht gespeichert).

### Beispiele

```bash
# Single-Month (Legacy)
npx tsx --env-file=.env.local scripts/import-polar-export.ts \
  --dir='/Users/michaelmauch/Downloads/polar-user-data-export_...' \
  --month=2026-01 \
  --email=michi.mauch@gmail.com

# Historischer Bulk-Import (Wanderungen / Spaziergänge / Velo / Schneeschuh, alles bis 2025-12-31):
# 1. Inventar
npx tsx --env-file=.env.local scripts/import-polar-export.ts \
  --dir='/Users/.../polar-user-data-export_...' \
  --email=michi.mauch@gmail.com \
  --until=2025-12-31 \
  --types=HIKING,WALKING,SNOWSHOE_TREKKING,CYCLING \
  --collapse-cycling --no-daily --analyze

# 2. Dry-Run (DB-Lookup + Counter, ohne AI-Titel)
…  # gleicher Aufruf, --analyze durch --dry-run ersetzen

# 3. Real-Import
…  # ohne --analyze und ohne --dry-run
```

## Was wird importiert

- **`training-session-YYYY-MM-DDT…json`** → `activities` Tabelle
  - Route-Waypoints (lat/lon/alt/time)
  - 1 Hz Samples (HR, Speed, Altitude)
  - TRIMP via `computeTrimp()`
  - AI-Titel via `generateActivityTitle()` (im Real-Run; Dry-Run und Analyze überspringen den Call)
- **`activity-YYYY-MM-DD-…json`** → `dailyActivity` Tabelle (nur ohne `--no-daily`)
  - Schritte, Kalorien, Distanz
  - Zonen (Export-`activityLevels` → API-kompatible `active-time-zones`)

**Nicht importiert**: `ppi_samples_*`, `247ohr_*`, `sleep-*`, `sport-profiles-*` etc. — kein passendes Schema.

## Idempotenz

- **Trainings**: Unique-Constraint auf `activities.polar_id` → wiederholter Lauf = `SKIP (already imported)`.
- **Tagesaktivitäten**: Upsert auf `(userId, date)` → überschreibt vorhandene Daten.

## Filter-Pipeline (Reihenfolge)

1. Filename-Match + Datumsbereich (`--month` / `--from` / `--until`).
2. JSON-Parse → `parseTrainingSession()`.
3. Type-Mapping via `polarSportIdToType()`.
4. Optional: `--collapse-cycling` faltet Bike-Subtypes zu `CYCLING`.
5. Optional: `--types`-Allowlist filtert auf gewünschte Final-Types.
6. **Mini-Session-Filter**: <5 min Dauer ODER <500 m Distanz (bei recorded distance) → skip.
7. DB-Lookup: `activities.polar_id` → skip wenn schon vorhanden; `deletedPolarActivities` → skip wenn blacklisted.
8. Insert (oder log-only in Dry-/Analyze-Modus).

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
1. Erst `--analyze` starten — die Pivot-Tabelle zeigt sport.id × device × final-type ohne DB-Calls.
2. Die geloggten Types und Speeds stichprobenartig prüfen.
3. Bei Unstimmigkeiten: die Map in `src/lib/polar-sport-map.ts` anpassen.
4. Neue IDs → nach Plausibilität (Speed + Ascent) entscheiden:
   - `> 15 km/h` → Rad (ROAD_BIKING / MOUNTAIN_BIKING je nach Gelände)
   - `4–7 km/h` → WALKING oder HIKING (HIKING bei `ascent ≥ 80 m`)
   - `8–15 km/h` → RUNNING / TRAIL_RUNNING

**Achtung Bike-Computer**: Der Polar V650 ist ein reiner Velo-Computer, wurde aber fallweise auch für Wanderungen und Schneeschuhtouren genutzt. Sport-IDs auf dem V650 dürfen also NICHT pauschal als CYCLING angenommen werden — immer die offizielle Sport-Map befolgen.

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
