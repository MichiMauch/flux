# Changelog

Alle nennenswerten Änderungen an Flux werden hier dokumentiert.
Format: [Keep a Changelog](https://keepachangelog.com/de/1.1.0/) · Versionierung: [SemVer](https://semver.org).

## [1.0.0] - 2026-05-04

Erste stabile Public-Version.

### Added

- **groups:** Activity Groups — Aktivitäten zu Sammlungen bündeln (Schema 0021–0023, CRUD-Pages, Server-Actions)
- **groups:** Multi-Route-Map mit Sport-Color-Palette, Auto-Fit-Bounds, Layer-Switcher, Hover-Highlight und Klick-zum-Fokussieren mit Stats-Card
- **groups:** Bento-Dashboard pro Gruppe (Stats / Map / Activities / Galerie)
- **groups:** Aktivitäts-Liste 2-spaltig auf Desktop mit LED-Schrift für Distanz/Zeit/Höhenmeter
- **groups:** Cover-Bild-Upload mit Drag-to-Reposition (Maus + Touch), Auto-Save der Position
- **groups:** Activity-Picker mit Virtualization (`@tanstack/react-virtual`), Sport-/Datums-Filter, Bulk-Aktionen
- **groups:** Foto-Galerie aller Aktivitäten in der Gruppe mit PhotoLightbox (Mobile-Snap-Slider, Desktop-Grid)
- **groups:** Mit-Partner-Teilen (Toggle) — Read-only-Zugriff für den verknüpften Partner
- **groups:** „Gruppen"-Eintrag in der Navigation mit map-Lottie-Icon
- **groups:** Cross-Link auf Activity-Detail-Seite — zeigt Group-Memberships als Badges
- **stream:** /stream-Route mit Partner-Activities und Boost (Like/Kudo) pro Aktivität
- **stream/boost:** Push + In-App-Notification an den Activity-Owner bei Boost
- **trophies:** Phase 1 — 9 neue Trophies
- **trophies:** Phase 2 — Geocoding via Mapbox + 4 Country-Trophies
- **trophies:** Individuelle PNG-Icons je Trophy, Default-Logo als Level-Tile-Icon
- **activity-detail:** Fullscreen-Map mit zuschaltbaren Overlays (Splits, HR, Höhe)
- **activity:** Bewegungszeit (`movingTime`) als primäre Anzeige; Gesamtzeit als Sub
- **dashboard:** Höhenmeter in der Wochen- und Monats-Card

### Changed

- **nav:** Neuordnung in 3 thematische Sektionen (Bewegung / Analyse / Gesundheit) — primary/secondary-Modell ersetzt durch `section` + `showInBottomNav`
- **nav (mobile):** Form & Statistik standardmäßig im Mehr-Menu, Bottom-Nav schlanker
- **goals:** Karten-Styling an das Dashboard angeglichen
- **photos-tile:** Horizontaler Snap-Slider auf Mobile
- **activity-detail (mobile):** Stat-Grid auf 2 Spalten, Pairs übereinander, ausklappbare Kilometer-Liste, GPX-Tile volle Breite
- **stream:** Single-Column max-w-2xl, prominenterer Owner-Badge, EditorialFeed-Layout wiederverwendet
- **trophies-server:** Server-only Guard von der Logik getrennt
- **ui:** Globaler `cursor: pointer` auf Buttons (Tailwind-v4-Default-Fix), Sonner-Toast-Benachrichtigungen für Speichern/Upload/Delete

### Fixed

- **groups:** Cover-Image in Übersicht und Detail mit `unoptimized` (Next-Image-Optimizer trägt keine Session-Cookies)
- **groups-map:** SVG-Renderer statt `preferCanvas` — verhindert `clearRect`-Fehler bei React Strict Mode
- **docker:** `/data/group-covers` im Image-Build anlegen, sonst Persistenz-Verlust beim Redeploy
- **photos:** Partner darf Fotos verknüpfter Activities sehen
- **boost:** Server liefert volle Booster-Liste, Client setzt sie direkt; Boost-Button als Sibling des Card-Links — verhindert Detail-Navigation
- **boost-button:** Compact-Variante deutlich größer für Mobile-Touch; auf Mobile unter die Daten links in der Editorial-Card
- **activity-map-fullscreen:** Tabs als Schubladen-Griffe am Rand; z-index auf 2000; Kilometer-Tab vertikal
- **kilometer-list:** Runden-Header nicht mehr sticky
- **activity-hero:** `items-start` — Hauptzahlen aller Tiles auf gleicher Höhe trotz Sub-Zeile bei Zeit
- **backfill-locality:** Dynamische DB-Imports nach `dotenv.config()`, lädt `.env.local` explizit

## [0.6.0] - 2026-05-01

### Added

- **photo-upload:** GPS aus Aktivitäts-Track (Strategie 5) — fixt Mobile [cd127b4]
- **activity-photos:** Foto-Upload-Tile auf Mobile + Desktop sichtbar [1033750]
- **ai-title:** Sportart aus Titel entfernen — nur noch Ortsnamen [ee4e353]
- **ai-title:** Sample 6 Wegpunkte für Ortskette, keine Tageszeit-Wörter [7bc8e78]
- **notifications:** In-App Notification Bell + DB-Persistenz aller Pushes [3c55752]

### Fixed

- **photo-upload:** EXIF DateTimeOriginal + OffsetTimeOriginal korrekt zu UTC [f093fda]
- **photo-upload:** Route-Match-Toleranz von 30min auf 24h erhöht [c321cff]
- **photo-upload:** clean GPS-Ref normalization regex (no control chars in source) [23dadaa]
- **photo-upload:** piexif GPS-Ref normalisieren (Samsung schreibt "N\0") [c23cee2]
- **photo-upload:** piexif-ts als 4. EXIF-Strategie + Library-Diversität [b74f71b]
- **photo-upload:** manuelle DMS→Dezimal-Konvertierung als GPS-Fallback [4d5dfdc]
- **photo-upload:** doppelte EXIF-Extraktion server-side + verbessertes Logging [58e4509]
- **photo-upload:** NaN-Koordinaten verhindern Detailseiten-Crash [dea2eac]
- **photo-upload:** Client-Komprimierung entfernen — Original bewahrt EXIF [c69ab20]
- **photo-upload:** EXIF-GPS überlebt Client-Komprimierung zuverlässig [35e3547]
- **activities:** Monatsfilter lädt fehlende Sektionen nach [c73929e]
- **activity-detail:** Map mit outdoors-v12 Style statt dark-v11 [b24639a]
- **activity-detail:** Map-Card Frame in Activity-Color statt schwarz [88445d4]
- **activity-detail:** Titel in Activity-Color + Stats-Card ebenfalls farbig [c19d286]
- **activity-detail:** Hero-Card farbig statt zusätzliche Feed-Karte [9da97ee]
- **activity-detail:** farbige Feed-Karte oben + Mobile-Map nur mit 2 Fingern [9586366]
- **ai-title:** max_completion_tokens für gpt-5.4-mini + erweitere isGenericTitle [dc462d6]
- **sleep:** Start/Ende-Zeiten in Europe/Zurich statt Server-UTC [838140b]
- **mobile:** Jahr-Selector in eigene Row auf /stats [252034f]
- **mobile:** Datums-Navigation unter Titel statt daneben auf /sleep [1806380]
- **mobile:** ganze Kalenderzelle als Tap-Area bei einer Aktivität [12d7c5b]
- **mobile:** verberge Distanz-Text in Kalender-Tageszellen unter sm [30989cf]
- **mobile:** Zeit-Format und Unit-Farbe auf Sleep-Seite angleichen [2b15da0]
- **mobile:** kürze 'Inaktivitätsstempel'-Label zu 'Inaktivität' im Daily-Grid [ef1e4b7]
- **mobile:** Y-Achsen-Labels im Gewicht-Chart auf 1 Dezimalstelle runden [c95bb2e]
- **mobile:** Fade-Gradients am Rand der Monats-Filter-Ribbon als Scroll-Hint [322223d]
- **mobile:** stapel Ziel-Teaser-Karten vertikal auf schmalen Viewports [fd0dc59]
- **mobile:** stack Σ-Woche-Summen unter der Wochenzeile auf schmalen Viewports [5b6147e]

## [0.5.0] - 2026-04-20

### Added

- **withings:** Auto-Sync des Gewichts via Webhook [1c9877b]

## [0.4.0] - 2026-04-20

### Added

- **branding:** neues Flux App-Icon und Header-Logo [8d9a6d6]
- **push:** Partner-Benachrichtigung bei neuer Aktivität [45d9d6d]
- **coach:** AI-Coach mit Wochen-Briefing, Sonntag-Push und Modal [3500b50]
- **nav:** add energy Lottie to Form nav item [502c574]
- **training-load:** Bereitschaft-Score + Fitness/Ermüdung-Chart [a2be11f]
- **changelog:** link commit hashes from each entry [600599d]

### Fixed

- **profile:** Hydration-Mismatch in PortraitUpload [1362b38]
- **push:** proper Android badge icon + cache-bust notification icon [9846e79]

## [0.3.0] - 2026-04-20

### Added

- **push:** web push notifications for activities, trophies, step goal
- **branding:** swap PWA icons + favicon to training-schedule motif

## [0.2.1] - 2026-04-19

### Fixed

- **stats:** align KPI LED look with the rest of the app
- **calendar:** avoid nested <h2> in BentoTile title

## [0.2.0] - 2026-04-19

### Added

- PWA shell, calendar redesign, styleguide, changelog, sport chips

## [0.1.0] - 2026-04-19

### Added

- Initial release
