import type { ActivityFeedItem } from "../actions";
import { ActivityMonthHeader } from "../activity-month-header";
import { EditorialCard, type CardSize } from "./editorial-card";

function sizeFor(distance: number | null): CardSize {
  if (distance != null && distance >= 10000) return "hero";
  if (distance != null && distance >= 5000) return "medium";
  return "small";
}

function spanFor(size: CardSize): string {
  if (size === "hero") return "md:col-span-12";
  if (size === "medium") return "md:col-span-7";
  return "md:col-span-5";
}

interface Props {
  monthKey: string;
  index: number;
  items: ActivityFeedItem[];
}

export function EditorialMonthSection({ monthKey, index, items }: Props) {
  let idxInMonth = 0;
  return (
    <section
      id={`month-${monthKey}`}
      data-month-anchor={monthKey}
      className="scroll-mt-24"
    >
      <ActivityMonthHeader
        monthKey={monthKey}
        index={index}
        count={items.length}
        variant="editorial"
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6">
        {items.map((a) => {
          const size = sizeFor(a.distance);
          const span = spanFor(size);
          const mirror = size === "hero" ? false : idxInMonth % 2 === 1;
          const reveal = idxInMonth;
          idxInMonth += 1;
          return (
            <div key={a.id} className={`${span} col-span-1`}>
              <EditorialCard
                a={a}
                size={size}
                mirror={mirror}
                revealIndex={reveal}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
