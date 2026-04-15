import { Thermometer, Wind, Droplets } from "lucide-react";
import { windDirection, wmoEmoji, type WeatherData } from "@/lib/weather";

const NEON = "#FF6A00";

export function BentoWeatherTile({ weather }: { weather: WeatherData | null }) {
  if (!weather) return null;
  return (
    <div className="rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] p-4">
      <div className="[font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6b6b] mb-3">
        Wetter
      </div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl leading-none">{wmoEmoji(weather.icon)}</span>
        <span className="[font-family:var(--bento-mono)] text-sm text-[#d4d4d4]">
          {weather.description}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <WeatherStat
          icon={<Thermometer className="h-3.5 w-3.5" />}
          label="Temp"
          value={`${weather.temp.toFixed(0)}°`}
        />
        <WeatherStat
          icon={<Wind className="h-3.5 w-3.5" />}
          label="Wind"
          value={`${Math.round(weather.windSpeed)} km/h ${windDirection(weather.windDeg)}`}
        />
        <WeatherStat
          icon={<Droplets className="h-3.5 w-3.5" />}
          label="Feuchte"
          value={`${weather.humidity}%`}
        />
      </div>
    </div>
  );
}

function WeatherStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 [font-family:var(--bento-mono)] text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b6b] mb-1">
        <span style={{ color: NEON }}>{icon}</span>
        {label}
      </div>
      <div className="[font-family:var(--bento-mono)] text-sm font-bold text-white tabular-nums">
        {value}
      </div>
    </div>
  );
}
