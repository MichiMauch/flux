ALTER TABLE "activities" ADD COLUMN "source" text DEFAULT 'polar' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_activity" ADD COLUMN "source" text DEFAULT 'polar' NOT NULL;--> statement-breakpoint
ALTER TABLE "sleep_sessions" ADD COLUMN "source" text DEFAULT 'polar' NOT NULL;--> statement-breakpoint

-- Bestandsdaten einordnen. Der Default 'polar' stimmt für die 1544 Zeilen ohne
-- Prefix; die beiden anderen Gruppen sind am polar_id-Prefix erkennbar.
UPDATE "activities" SET "source" = 'strava' WHERE "polar_id" LIKE 'strava:%';--> statement-breakpoint
UPDATE "activities" SET "source" = 'manual' WHERE "polar_id" IS NULL;--> statement-breakpoint

-- Altlast wegräumen, bevor der UNIQUE-Index greift.
--
-- Webhook und Cron konnten denselben Tag gleichzeitig verarbeiten: beide fanden
-- keine Zeile, beide fügten eine ein. Danach traf das findFirst des Upserts nur
-- noch eine der beiden, die andere blieb mit veralteten Werten liegen. In der
-- Produktionsdatenbank betraf das 13 Tage und 3 Nächte.
--
-- Behalten wird pro Gruppe die zuletzt aktualisierte Zeile. Sie ist immer die
-- vollständigere: bei allen 13 Paaren war der Wert der jüngeren Zeile gleich
-- oder höher (am 25.07. etwa 26'409 statt 24'338 Schritte). Die id dient nur
-- als Tiebreaker, damit das Ergebnis bei identischem Zeitstempel eindeutig ist.
DELETE FROM "daily_activity" d
USING "daily_activity" k
WHERE d."user_id" = k."user_id"
  AND d."date" = k."date"
  AND d."source" = k."source"
  AND d."id" <> k."id"
  AND (k."updated_at", k."id") > (d."updated_at", d."id");--> statement-breakpoint

DELETE FROM "sleep_sessions" d
USING "sleep_sessions" k
WHERE d."user_id" = k."user_id"
  AND d."date" = k."date"
  AND d."source" = k."source"
  AND d."id" <> k."id"
  AND (k."updated_at", k."id") > (d."updated_at", d."id");--> statement-breakpoint

CREATE UNIQUE INDEX "daily_activity_user_date_source_idx" ON "daily_activity" USING btree ("user_id","date","source");--> statement-breakpoint
CREATE UNIQUE INDEX "sleep_sessions_user_date_source_idx" ON "sleep_sessions" USING btree ("user_id","date","source");
