"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { Send } from "lucide-react";
import { ActivityFeedCard } from "../activity-feed-card";

const SUGGESTED_QUESTIONS = [
  "Welche war die längste Aktivität?",
  "Wandern auf der Lenzerheide",
  "Wie viele km bin ich diesen Monat gelaufen?",
  "Zeig meine Bike-Touren 2026",
];

const ACTIVITY_ID_RE = /\[activity:([a-f0-9-]{36})\]/g;

interface ToolPart {
  type: string;
  toolName?: string;
  toolCallId: string;
  state?: string;
  input?: Record<string, unknown>;
  args?: Record<string, unknown>;
  output?: unknown;
  result?: unknown;
}

type CompactActivity = {
  id: string;
  name: string;
  type: string;
  startTime: string;
  distanceKm: number | null;
  durationMin: number | null;
  ascentM: number | null;
  trimp: number | null;
};

type FullActivity = CompactActivity & {
  durationMin: number | null;
  movingTimeMin?: number | null;
  avgHeartRate?: number | null;
  descentM?: number | null;
};

function getMessageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function getToolParts(m: UIMessage): ToolPart[] {
  return m.parts.filter(
    (p) =>
      typeof p.type === "string" &&
      (p.type.startsWith("tool-") || p.type === "dynamic-tool")
  ) as unknown as ToolPart[];
}

function collectActivities(messages: UIMessage[]): Map<string, CompactActivity> {
  const map = new Map<string, CompactActivity>();
  for (const m of messages) {
    for (const part of getToolParts(m)) {
      const out = (part.output ?? part.result) as
        | { activities?: CompactActivity[]; activity?: FullActivity; found?: boolean }
        | undefined;
      if (!out) continue;
      if (Array.isArray(out.activities)) {
        for (const a of out.activities) {
          if (a && typeof a.id === "string") map.set(a.id, a);
        }
      }
      if (out.found && out.activity && typeof out.activity.id === "string") {
        map.set(out.activity.id, out.activity);
      }
    }
  }
  return map;
}

function describeToolPart(t: ToolPart): string {
  const name = t.toolName ?? t.type.replace(/^tool-/, "");
  const done = t.state === "output-available";
  const labels: Record<string, [string, string]> = {
    list_activities: ["Lade Aktivitätsübersicht …", "Aktivitätsübersicht geladen"],
    search_activities: ["Durchsuche Aktivitäten …", "Aktivitäten gefiltert"],
    get_activity: ["Lade Aktivitätsdetails …", "Details geladen"],
  };
  const [loading, ready] = labels[name] ?? [`${name} läuft …`, `${name} fertig`];
  return done ? ready : loading;
}

function extractActivityIds(text: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(ACTIVITY_ID_RE)) {
    const id = m[1];
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function stripActivityMarkers(text: string): string {
  return text.replace(ACTIVITY_ID_RE, "").replace(/ {2,}/g, " ").trim();
}

export function SearchChat() {
  const { sendMessage, messages, status } = useChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const isLoading = status === "submitted" || status === "streaming";
  const activityCache = collectActivities(messages);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    sendMessage({ text: trimmed });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.length === 0 && !isLoading && (
          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-bold tracking-[-0.02em]">
                Willkommen,
                <br />
                wie kann ich dir helfen?
              </h3>
              <p className="mt-2 text-sm text-foreground/70">
                Stell eine Frage zu deinen Aktivitäten in natürlicher Sprache.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="rounded-lg border border-border bg-surface/40 px-3 py-3 text-left text-sm text-foreground transition hover:bg-surface"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBlock key={m.id} message={m} activityCache={activityCache} />
        ))}

        {isLoading &&
          messages.length > 0 &&
          messages[messages.length - 1].role === "user" && (
            <div className="flex items-center gap-2 text-sm italic text-foreground/70">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--brand-dark,currentColor)]" />
              Der Assistent durchsucht deine Aktivitäten …
            </div>
          )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-border bg-background px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Frag, was du willst …"
            disabled={isLoading}
            className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-foreground/40 disabled:opacity-60"
            aria-label="Suche"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="inline-flex items-center justify-center rounded-lg bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Senden"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageBlock({
  message,
  activityCache,
}: {
  message: UIMessage;
  activityCache: Map<string, CompactActivity>;
}) {
  const isUser = message.role === "user";
  const text = getMessageText(message);
  const toolParts = getToolParts(message);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl border border-border bg-surface/60 px-4 py-2.5 text-sm">
          {text}
        </div>
      </div>
    );
  }

  const activityIds = text ? extractActivityIds(text) : [];
  const displayText = text ? stripActivityMarkers(text) : "";
  const activeTool = toolParts.find((t) => t.state !== "output-available");

  return (
    <div className="flex flex-col gap-2">
      {toolParts.length > 0 && !text && (
        <div className="flex items-center gap-2 text-xs italic text-foreground/70">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
          {activeTool
            ? describeToolPart(activeTool)
            : describeToolPart(toolParts[toolParts.length - 1])}
        </div>
      )}

      {displayText && (
        <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-relaxed">
          <SimpleMarkdown text={displayText} />
        </div>
      )}

      {activityIds.length > 0 && (
        <div className="flex flex-col gap-2">
          {activityIds.map((id) => {
            const a = activityCache.get(id);
            if (!a) return null;
            return (
              <ActivityFeedCard
                key={id}
                id={a.id}
                name={a.name}
                type={a.type}
                startTime={new Date(a.startTime)}
                distance={a.distanceKm != null ? a.distanceKm * 1000 : null}
                duration={a.durationMin != null ? a.durationMin * 60 : null}
                movingTime={a.durationMin != null ? a.durationMin * 60 : null}
                avgHeartRate={
                  (a as FullActivity).avgHeartRate != null
                    ? (a as FullActivity).avgHeartRate!
                    : null
                }
                ascent={a.ascentM != null ? a.ascentM : null}
                photoCount={0}
              />
            );
          })}
        </div>
      )}

      {text && toolParts.length > 0 && (
        <div className="text-[11px] text-foreground/50 pl-1">
          {toolParts.length} Tool-Aufruf{toolParts.length === 1 ? "" : "e"}
        </div>
      )}
    </div>
  );
}

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {renderInline(line)}
        </p>
      ))}
    </div>
  );
}

function renderInline(line: string): React.ReactNode {
  const boldParts = line.split(/(\*\*[^*]+\*\*)/g);
  return boldParts.map((chunk, i) => {
    if (/^\*\*[^*]+\*\*$/.test(chunk)) {
      return (
        <strong key={i} className="font-semibold">
          {chunk.slice(2, -2)}
        </strong>
      );
    }
    const italicParts = chunk.split(/(\*[^*]+\*)/g);
    return italicParts.map((sub, j) => {
      if (/^\*[^*]+\*$/.test(sub)) {
        return (
          <em key={`${i}-${j}`} className="italic">
            {sub.slice(1, -1)}
          </em>
        );
      }
      return <span key={`${i}-${j}`}>{sub}</span>;
    });
  });
}
