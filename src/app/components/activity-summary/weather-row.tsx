import { Droplets, Thermometer, Wind } from "lucide-react";
import { windDirection, wmoEmoji, type WeatherData } from "@/lib/weather";

function WeatherItem({
  icon,
  value,
  isLabel,
}: {
  icon: React.ReactNode;
  value: string;
  isLabel?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="flex-shrink-0">{icon}</span>
      <span
        className={`text-xs truncate ${
          isLabel ? "text-muted-foreground capitalize" : "font-semibold"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function WeatherRow({
  weather,
  columns = "grid-cols-4",
}: {
  weather: WeatherData;
  columns?: string;
}) {
  return (
    <div className={`grid ${columns} gap-2 tabular-nums`}>
      <WeatherItem
        icon={<span className="text-base leading-none">{wmoEmoji(weather.icon)}</span>}
        value={weather.description}
        isLabel
      />
      <WeatherItem
        icon={<Thermometer className="h-3.5 w-3.5 text-muted-foreground" />}
        value={`${weather.temp.toFixed(0)}°C`}
      />
      <WeatherItem
        icon={<Wind className="h-3.5 w-3.5 text-muted-foreground" />}
        value={`${Math.round(weather.windSpeed)} km/h ${windDirection(weather.windDeg)}`}
      />
      <WeatherItem
        icon={<Droplets className="h-3.5 w-3.5 text-muted-foreground" />}
        value={`${weather.humidity}%`}
      />
    </div>
  );
}
