/**
 * Strava `sport_type` → flux normalized activity type.
 *
 * Strava's `sport_type` is richer than the older `type` field and is
 * our preferred input. Unknown types fall back to "OTHER" with a
 * console warning so the user can verify and correct manually.
 */

const SPORT_TYPE_MAP: Record<string, string> = {
  // Cycling
  Ride: "ROAD_BIKING",
  VirtualRide: "ROAD_BIKING",
  EBikeRide: "ROAD_BIKING",
  GravelRide: "ROAD_BIKING",
  MountainBikeRide: "MOUNTAIN_BIKING",
  EMountainBikeRide: "MOUNTAIN_BIKING",
  Handcycle: "CYCLING",
  Velomobile: "ROAD_BIKING",

  // Running / walking
  Run: "RUNNING",
  VirtualRun: "RUNNING",
  TrailRun: "TRAIL_RUNNING",
  Walk: "WALKING",
  Hike: "HIKING",

  // Swimming
  Swim: "SWIMMING",

  // Winter
  AlpineSki: "SKIING",
  BackcountrySki: "SKIING",
  NordicSki: "CROSS_COUNTRY_SKIING",
  Snowboard: "SKIING",
  Snowshoe: "SNOWSHOE_TREKKING",
  IceSkate: "OTHER",

  // Water
  Kayaking: "OTHER",
  Rowing: "OTHER",
  StandUpPaddling: "OTHER",
  Surfing: "OTHER",
  Kitesurf: "OTHER",
  Windsurf: "OTHER",

  // Gym / indoor
  WeightTraining: "STRENGTH_TRAINING",
  Workout: "OTHER_INDOOR",
  Crossfit: "STRENGTH_TRAINING",
  Elliptical: "OTHER_INDOOR",
  StairStepper: "OTHER_INDOOR",
  Yoga: "YOGA",
  Pilates: "YOGA",

  // Other
  RockClimbing: "OTHER",
  Golf: "OTHER",
  InlineSkate: "OTHER",
  Skateboard: "OTHER",
  Wheelchair: "OTHER",
};

export function stravaSportToType(sportType: string | undefined | null): string {
  if (!sportType) return "OTHER";
  const mapped = SPORT_TYPE_MAP[sportType];
  if (mapped) return mapped;
  console.warn(`[strava-sport-map] unmapped sport_type "${sportType}" → OTHER`);
  return "OTHER";
}
