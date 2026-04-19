import { rajdhani, spaceMono } from "../components/bento/bento-fonts";

const NEON = "#FF6A00";

const MONTH_LABELS_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

function monthLabel(key: string): { month: string; year: string } {
  const [y, m] = key.split("-");
  return { month: MONTH_LABELS_DE[parseInt(m, 10) - 1] ?? "", year: y };
}

export type MonthHeaderVariant = "compact" | "editorial";

export function ActivityMonthHeader({
  monthKey,
  index,
  count,
  variant,
}: {
  monthKey: string;
  index: number;
  count: number;
  variant: MonthHeaderVariant;
}) {
  const { month, year } = monthLabel(monthKey);
  const meta = (
    <span
      className={`${spaceMono.className} shrink-0 text-[10px] font-bold uppercase tracking-[0.32em]`}
      style={{ color: "#6a6a6a" }}
    >
      <span style={{ color: NEON }}>━━</span>{" "}
      {String(index + 1).padStart(2, "0")} · {count}{" "}
      {count === 1 ? "EINTRAG" : "EINTRÄGE"}
    </span>
  );
  const headingFontSize =
    variant === "editorial"
      ? "clamp(48px, 7vw, 96px)"
      : "clamp(20px, 2.4vw, 32px)";
  const yearMl = variant === "editorial" ? "ml-4" : "ml-3";
  const heading = (
    <h2
      className={`${rajdhani.className} font-bold uppercase leading-none tracking-[-0.02em]`}
      style={{
        fontSize: headingFontSize,
        color: "transparent",
        WebkitTextStroke: `1px ${NEON}`,
        textShadow: `0 0 18px ${NEON}73, 0 0 40px ${NEON}38`,
      }}
    >
      {month}
      <span
        className={`${yearMl} align-top`}
        style={{
          fontSize: "0.4em",
          color: `${NEON}8c`,
          WebkitTextStroke: "0",
          textShadow: "none",
        }}
      >
        {year}
      </span>
    </h2>
  );

  if (variant === "editorial") {
    return (
      <header className="relative mb-8 select-none" aria-label={`${month} ${year}`}>
        <div>{meta}</div>
        <div className="mt-2">{heading}</div>
      </header>
    );
  }

  return (
    <div
      className="sticky top-0 z-10 -mx-1 mb-3 flex items-baseline gap-4 border-b border-[#2a2a2a] bg-black/85 px-1 pb-2 pt-1 backdrop-blur"
      aria-label={`${month} ${year}`}
    >
      {meta}
      {heading}
    </div>
  );
}
