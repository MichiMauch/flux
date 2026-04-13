export interface WeatherData {
  temp: number;
  feelsLike: number;
  windSpeed: number; // km/h
  windDeg: number;
  clouds: number; // %
  humidity: number;
  description: string;
  icon: string; // WMO weather code as string
}

// WMO Weather interpretation codes → Beschreibung (de)
// https://open-meteo.com/en/docs
const WMO_DE: Record<number, string> = {
  0: "Klar",
  1: "Überwiegend klar",
  2: "Teilweise bewölkt",
  3: "Bedeckt",
  45: "Nebel",
  48: "Reifnebel",
  51: "Leichter Nieselregen",
  53: "Nieselregen",
  55: "Starker Nieselregen",
  56: "Gefrierender Nieselregen",
  57: "Starker gefrierender Nieselregen",
  61: "Leichter Regen",
  63: "Regen",
  65: "Starker Regen",
  66: "Gefrierender Regen",
  67: "Starker gefrierender Regen",
  71: "Leichter Schneefall",
  73: "Schneefall",
  75: "Starker Schneefall",
  77: "Schneegriesel",
  80: "Leichte Regenschauer",
  81: "Regenschauer",
  82: "Starke Regenschauer",
  85: "Leichte Schneeschauer",
  86: "Starke Schneeschauer",
  95: "Gewitter",
  96: "Gewitter mit leichtem Hagel",
  99: "Gewitter mit starkem Hagel",
};

export async function fetchHistoricalWeather(
  lat: number,
  lon: number,
  timestamp: Date
): Promise<WeatherData | null> {
  const date = timestamp.toISOString().slice(0, 10); // YYYY-MM-DD
  const hour = timestamp.getUTCHours();

  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    start_date: date,
    end_date: date,
    hourly:
      "temperature_2m,apparent_temperature,relative_humidity_2m,cloud_cover,wind_speed_10m,wind_direction_10m,weather_code",
    timezone: "UTC",
    wind_speed_unit: "kmh",
  });
  const url = `https://archive-api.open-meteo.com/v1/archive?${params}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Open-Meteo error:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const h = data.hourly;
    if (!h || !h.time) return null;

    // Archive can lag a few days; if our hour isn't available, bail
    const idx = h.time.findIndex((t: string) => t.endsWith(`T${String(hour).padStart(2, "0")}:00`));
    if (idx < 0 || h.temperature_2m[idx] == null) return null;

    const code = h.weather_code[idx] ?? 0;
    return {
      temp: h.temperature_2m[idx],
      feelsLike: h.apparent_temperature[idx],
      windSpeed: Math.round(h.wind_speed_10m[idx] * 10) / 10,
      windDeg: h.wind_direction_10m[idx],
      clouds: h.cloud_cover[idx],
      humidity: h.relative_humidity_2m[idx],
      description: WMO_DE[code] ?? `Code ${code}`,
      icon: String(code),
    };
  } catch (err) {
    console.error("Weather fetch failed:", err);
    return null;
  }
}

export function windDirection(deg: number): string {
  const dirs = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

// Map WMO code → lucide-react equivalent handled in UI via emoji fallback
export function wmoEmoji(code: string): string {
  const n = parseInt(code, 10);
  if (n === 0) return "☀️";
  if (n <= 2) return "🌤️";
  if (n === 3) return "☁️";
  if (n <= 48) return "🌫️";
  if (n <= 57) return "🌦️";
  if (n <= 67) return "🌧️";
  if (n <= 77) return "🌨️";
  if (n <= 82) return "🌦️";
  if (n <= 86) return "🌨️";
  if (n >= 95) return "⛈️";
  return "🌡️";
}
