// Reverse geocoding via Mapbox
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface MapboxFeature {
  text: string;
  place_type: string[];
  context?: { id: string; text: string }[];
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string | null> {
  if (!MAPBOX_TOKEN) return null;

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=place,locality,neighborhood,region&language=de&limit=1`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const feature: MapboxFeature | undefined = data.features?.[0];
    if (!feature) return null;

    // Build short location string: "Place, Region"
    const place = feature.text;
    const region = feature.context?.find((c) => c.id.startsWith("region"))?.text;
    const country = feature.context?.find((c) => c.id.startsWith("country"))?.text;

    if (region && region !== place) return `${place}, ${region}`;
    if (country) return `${place}, ${country}`;
    return place;
  } catch (e) {
    console.warn("Reverse geocode failed:", e);
    return null;
  }
}
