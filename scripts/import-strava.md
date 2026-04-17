# Strava Import

CLI zum Einspielen von Strava-Aktivitäten in die flux-DB via Strava REST API.

## Aufruf

```bash
npx tsx --env-file=.env.local scripts/import-strava.ts \
  --month=YYYY-MM \
  --email=<user-email> \
  [--dry-run] [--yes]
```

### Beispiele

```bash
# Dry-Run (zeigt Listing + Dedup-Ergebnis, kein DB-Write, keine Prompts)
npx tsx --env-file=.env.local scripts/import-strava.ts \
  --month=2026-01 --email=michi.mauch@gmail.com --dry-run

# Realer Lauf — bei unklaren Duplikaten wird interaktiv y/n gefragt
npx tsx --env-file=.env.local scripts/import-strava.ts \
  --month=2026-02 --email=michi.mauch@gmail.com

# Realer Lauf ohne Prompts (importiert auch Weak-Duplicates automatisch)
npx tsx --env-file=.env.local scripts/import-strava.ts \
  --month=2026-02 --email=michi.mauch@gmail.com --yes
```

## Env-Keys

Aus `~/Documents/Development/strava-dashboard/.env.local` in `flux/.env.local` übernommen:

```
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
STRAVA_REFRESH_TOKEN=...
```

Refresh-Token wird bei jedem Lauf automatisch gegen einen 6h-Access-Token getauscht (im Memory gecached).

## Was wird importiert

- `/athlete/activities?after=<ts>&before=<ts>` — paginierte Aktivitätsliste
- Pro Aktivität zusätzlich `/activities/{id}/streams?keys=latlng,time,heartrate,velocity_smooth,altitude,distance&key_by_type=true` für Route/HR/Speed/Altitude-Timelines.
- Insert in `activities` mit `polarId = "strava:<id>"` (Lineage-Marker, nutzt den bestehenden Unique-Constraint für Idempotenz).

**Nicht importiert**: Daily Steps (Strava kennt das nicht — bleibt Polar-exklusiv), Fotos, Segmente, Kudos, Suffer-Score.

## Dedup-Regeln

Pro Strava-Aktivität wird geprüft:

1. **`polarId="strava:<id>"` bereits vorhanden** → `SKIP (already imported)` (reiner Re-Run).
2. **Strong-Match** (silent skip): existierende Aktivität mit `|startTime diff| ≤ 5 min` **und** Distanz ±10 %.
3. **Weak-Match** (Prompt): andere Aktivität am **selben Local-Date** (Europe/Zurich). Zeigt Side-by-Side-Vergleich und fragt `y/N/a`:
   - `y` → importieren
   - `N` / Enter → skippen
   - `a` → alle weiteren Weak-Matches ebenfalls importieren
4. **Min-Session-Filter**: `moving_time < 5 min` ODER `distance < 500 m` → skip.

`--yes` überspringt alle Prompts (akzeptiert alle Weak-Matches).

## Sport-Type-Mapping

`src/lib/strava-sport-map.ts` übersetzt Strava's `sport_type` nach flux-Types:

| Strava `sport_type` | flux type |
|---|---|
| `Ride`, `EBikeRide`, `VirtualRide`, `GravelRide` | ROAD_BIKING |
| `MountainBikeRide`, `EMountainBikeRide` | MOUNTAIN_BIKING |
| `Run`, `VirtualRun` | RUNNING |
| `TrailRun` | TRAIL_RUNNING |
| `Walk` | WALKING |
| `Hike` | HIKING |
| `Swim` | SWIMMING |
| `AlpineSki`, `BackcountrySki`, `Snowboard` | SKIING |
| `NordicSki` | CROSS_COUNTRY_SKIING |
| `WeightTraining`, `Crossfit` | STRENGTH_TRAINING |
| (unbekannt) | OTHER + Warn-Log |

## Rate-Limits

- Strava: 100 req / 15 min, 1000 req / Tag.
- Für einen Monat: 1 Listing + N Stream-Calls (ca. 5–30 je nach Aktivitätsdichte).
- Bei HTTP 429 wartet das Script 60 s und retry (max 3 Versuche).

## DB-Setup

- SSH-Tunnel zur Prod-DB muss laufen (siehe `scripts/dev.sh`):
  ```
  ssh -f -N -L 5432:localhost:54321 root@78.46.189.129
  ```

## Scope

- **Einmalig für Michi** (`michi.mauch@gmail.com`). Nicht für Sibylle.
- Kalenderweise durchgehen: `--month=2026-01`, `--month=2026-02`, …

## Re-Run-Verhalten

- Idempotent: ein wiederholter Lauf für denselben Monat liefert nur
  `SKIP (already imported)` für bereits gespeicherte Strava-IDs.
- Polar-Nachimporte stören nicht: Strong-Match erkennt zurück-importierte
  Polar-Trainings und überspringt die Strava-Kopie.
