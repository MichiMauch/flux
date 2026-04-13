/**
 * NOAA-based sunrise/sunset calculation.
 * Ported from https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 *
 * Accuracy: ±1 minute for latitudes between ±65°.
 */

function toJulian(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

function fromJulian(j: number): Date {
  return new Date((j - 2440587.5) * 86400000);
}

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

function rad2deg(r: number): number {
  return (r * 180) / Math.PI;
}

/**
 * Returns sunrise and sunset times for a given day at a given location.
 * The `date` argument identifies the calendar day (any time during that day works).
 * Returns null if sun never rises / never sets on that day at that latitude.
 */
export function getSunTimes(
  lat: number,
  lng: number,
  date: Date
): { sunrise: Date | null; sunset: Date | null } {
  // Use UTC midnight of the date's local day as the reference
  const refDate = new Date(date);
  refDate.setUTCHours(0, 0, 0, 0);
  const jd = toJulian(refDate);
  const n = jd - 2451545.0 + 0.0008;

  const Jstar = n - lng / 360;
  const M = (357.5291 + 0.98560028 * Jstar) % 360;
  const Mrad = deg2rad(M);
  const C =
    1.9148 * Math.sin(Mrad) +
    0.02 * Math.sin(2 * Mrad) +
    0.0003 * Math.sin(3 * Mrad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const lambdaRad = deg2rad(lambda);
  const Jtransit =
    2451545.0 + Jstar + 0.0053 * Math.sin(Mrad) - 0.0069 * Math.sin(2 * lambdaRad);
  const decl = Math.asin(Math.sin(lambdaRad) * Math.sin(deg2rad(23.44)));

  const latRad = deg2rad(lat);
  const cosH =
    (Math.sin(deg2rad(-0.83)) - Math.sin(latRad) * Math.sin(decl)) /
    (Math.cos(latRad) * Math.cos(decl));

  if (cosH > 1) return { sunrise: null, sunset: null }; // polar night
  if (cosH < -1) return { sunrise: null, sunset: null }; // polar day

  const H = rad2deg(Math.acos(cosH));
  const Jrise = Jtransit - H / 360;
  const Jset = Jtransit + H / 360;

  return { sunrise: fromJulian(Jrise), sunset: fromJulian(Jset) };
}
