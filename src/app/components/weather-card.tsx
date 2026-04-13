import { Cloud, Thermometer, Wind, Droplets } from "lucide-react";
import { windDirection, wmoEmoji, type WeatherData } from "@/lib/weather";

export function WeatherCard({ weather }: { weather: WeatherData }) {
  return (
    <div className="mb-6">
      <h2 className="font-semibold mb-3">Wetter</h2>
      <div className="rounded-lg border p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="text-5xl leading-none">{wmoEmoji(weather.icon)}</div>
          <div>
            <div className="text-3xl font-semibold">
              {weather.temp.toFixed(1)}°C
            </div>
            <div className="text-sm text-muted-foreground capitalize">
              {weather.description}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Gefühlt</div>
              <div className="font-medium">{weather.feelsLike.toFixed(1)}°C</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Wind className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Wind</div>
              <div className="font-medium">
                {weather.windSpeed} km/h {windDirection(weather.windDeg)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Bewölkung</div>
              <div className="font-medium">{weather.clouds}%</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Luftfeuchte</div>
              <div className="font-medium">{weather.humidity}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
