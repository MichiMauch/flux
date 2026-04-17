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

// Observed across user exports (Polar Vantage V3 + Grit X Pro):
// sport.id "2"  → ROAD_BIKING  (Michi + Sibylle, speeds 16–20 km/h)
// sport.id "3"  → WALKING      (Michi + Sibylle, speeds 4–6 km/h, NOT MTB)
// sport.id "11" → HIKING       (Michi + Sibylle, Polar Flow label)
// sport.id "38" → ROAD_BIKING  (Michi, speeds 17–21 km/h)
// sport.id "83" → YOGA (Sibylle, indoor 60 min)
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
  "83": "YOGA",
};

export function polarSportIdToType(sportId: string | null | undefined): string {
  if (!sportId) return "OTHER";
  return SPORT_ID_TO_TYPE[String(sportId)] ?? "OTHER";
}
