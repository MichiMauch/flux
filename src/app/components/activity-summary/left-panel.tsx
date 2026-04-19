import Image from "next/image";
import type { WeatherData } from "@/lib/weather";
import { WeatherRow } from "./weather-row";

interface Photo {
  id: string;
  location: string | null;
}

export function SummaryLeftPanel({
  notes,
  photos,
  weather,
}: {
  notes: string | null;
  photos: Photo[];
  weather: WeatherData | null;
}) {
  return (
    <div className="p-4 border-b md:border-b-0 border-border flex flex-col">
      {notes && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {notes}
        </p>
      )}

      {photos.length > 0 && (
        <div className="mt-3 flex gap-1 overflow-x-auto scrollbar-none">
          {photos.slice(0, 6).map((p) => (
            <a
              key={p.id}
              href={`#photo=${p.id}`}
              className="flex-shrink-0 block rounded-sm overflow-hidden hover:opacity-90 transition-opacity"
              style={{ width: 56, height: 56 }}
            >
              <Image
                src={`/api/photos/${p.id}?thumb=1`}
                alt=""
                width={56}
                height={56}
                className="w-full h-full object-cover"
                unoptimized
              />
            </a>
          ))}
          {photos.length > 6 && (
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-sm bg-surface text-foreground border border-border text-xs font-bold"
              style={{ width: 56, height: 56 }}
            >
              +{photos.length - 6}
            </div>
          )}
        </div>
      )}

      {weather && (
        <div className="mt-auto pt-3 border-t border-border">
          <WeatherRow weather={weather} />
        </div>
      )}
    </div>
  );
}
