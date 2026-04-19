import { spaceMono } from "./bento/bento-fonts";
import { SevenSegDisplay } from "./bento/seven-seg";

const NEON = "#FF6A00";

interface ActivityMetricProps {
  icon: React.ReactNode;
  value: string;
  unit: string;
}

export function ActivityMetric({ icon, value, unit }: ActivityMetricProps) {
  return (
    <span className="inline-flex items-baseline gap-1 leading-none">
      <span
        className={`${spaceMono.className} text-[0.5em]`}
        style={{ color: "#a3a3a3" }}
      >
        {icon}
      </span>
      <SevenSegDisplay value={value} />
      <span
        className={`${spaceMono.className} text-[0.4em] font-bold lowercase`}
        style={{ color: NEON }}
      >
        {unit}
      </span>
    </span>
  );
}
