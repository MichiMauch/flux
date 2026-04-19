import { ChevronDown } from "lucide-react";

export function AccordionSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="border-t border-border group" open={defaultOpen}>
      <summary className="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none hover:bg-surface/60 list-none [&::-webkit-details-marker]:hidden">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground flex-1">
          {title}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div>{children}</div>
    </details>
  );
}
