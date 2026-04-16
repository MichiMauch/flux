import { Thermometer, Wind, Droplets } from "lucide-react";
import { windDirection, wmoEmoji, type WeatherData } from "@/lib/weather";
import { spaceMono } from "./bento-fonts";
import { SevenSegDisplay } from "./seven-seg";

const NEON = "#FF6A00";

export function BentoWeatherTile({ weather }: { weather: WeatherData | null }) {
  if (!weather) return null;
  return (
    <div className="rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] p-4">
      <div
        className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6b6b] mb-3`}
      >
        Wetter
      </div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl leading-none">{wmoEmoji(weather.icon)}</span>
        <span className={`${spaceMono.className} text-sm text-[#d4d4d4]`}>
          {weather.description}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <WeatherStat
          icon={<Thermometer className="h-3.5 w-3.5" />}
          label="Temp"
          numeric={weather.temp.toFixed(0)}
          unit="°"
        />
        <WeatherStat
          icon={<Wind className="h-3.5 w-3.5" />}
          label="Wind"
          numeric={`${Math.round(weather.windSpeed)}`}
          unit={`km/h ${windDirection(weather.windDeg)}`}
        />
        <WeatherStat
          icon={<Droplets className="h-3.5 w-3.5" />}
          label="Feuchte"
          numeric={`${weather.humidity}`}
          unit="%"
        />
      </div>
    </div>
  );
}

function WeatherStat({
  icon,
  label,
  numeric,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  numeric: string;
  unit: string;
}) {
  return (
    <div>
      <div
        className={`flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6b6b] mb-1.5`}
      >
        <span style={{ color: NEON }}>{icon}</span>
        {label}
      </div>
      <div className="flex items-baseline gap-1.5 leading-none" style={{ fontSize: "22px" }}>
        <SevenSegDisplay value={numeric} />
        <span
          className={`${spaceMono.className} text-[0.4em] font-bold lowercase`}
          style={{ color: NEON }}
        >
          {unit}
        </span>
      </div>
    </div>
  );
}
