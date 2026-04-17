/**
 * Polar sport-id → normalized activity type mapping.
 *
 * Used by the local Polar user-data-export importer. The normal
 * AccessLink API returns sport as a string, so this map is only
 * needed for the GDPR/data-export JSON files which use numeric IDs.
 *
 * Values below are the commonly observed Polar sport IDs. Unknown
 * IDs fall back to "OTHER" and can be corrected manually via the
 * activity edit sheet.
 */

// Observed from this user's export (Polar Vantage V3, account 2401976):
// sport.id "2"  → ROAD_BIKING (speeds 16–20 km/h, Rennrad)
// sport.id "3"  → WALKING (speeds 4.6–5.6 km/h, not MTB)
// sport.id "11" → HIKING  (matches Polar Flow label)
// sport.id "38" → ROAD_BIKING (speeds 17–21 km/h, Rennrad, March 2026)
//
// Other IDs below are best-effort guesses; unknown IDs fall back to OTHER.
// The user can correct labels via the activity edit sheet.
const SPORT_ID_TO_TYPE: Record<string, string> = {
  "1": "RUNNING",
  "2": "ROAD_BIKING",
  "3": "WALKING",
  "4": "OTHER_OUTDOOR",
  "5": "ROAD_RUNNING",
  "6": "OTHER_INDOOR",
  "11": "HIKING",
  "12": "ROAD_BIKING",
  "15": "MOUNTAIN_BIKING",
  "16": "NORDIC_WALKING",
  "17": "TRAIL_RUNNING",
  "18": "SKIING",
  "19": "CROSS_COUNTRY_SKIING",
  "28": "SWIMMING",
  "29": "SNOWSHOE_TREKKING",
  "33": "STRENGTH_TRAINING",
  "38": "ROAD_BIKING",
  "52": "CORE",
};

export function polarSportIdToType(sportId: string | null | undefined): string {
  if (!sportId) return "OTHER";
  return SPORT_ID_TO_TYPE[String(sportId)] ?? "OTHER";
}
