/**
 * POST /api/chat — streaming chat endpoint for the natural-language search.
 *
 * Uses Vercel AI SDK v6 streamText with the shared OpenAI client and model
 * (see `src/lib/openai.ts`). Up to 5 tool steps, all scoped to the authenticated user.
 */

import { streamText, stepCountIs, convertToModelMessages } from "ai";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getSearchTools } from "@/lib/search-tools";
import { DEFAULT_MODEL, getAiSdkClient } from "@/lib/openai";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Du bist der Fitness-Aktivitäten-Such-Assistent von Flux. Du hilfst der angemeldeten Person, ihre eigenen Aktivitäten in natürlicher Sprache zu finden, zu filtern und zu vergleichen.

Du hast Zugriff auf drei Tools:
- search_activities: durchsucht ALLE Aktivitäten (auch viele Jahre alte, z.B. 2018) mit Filtern (Typ, Name, Zeitraum, Distanz) und Sortierung. DAS ist dein Standard-Tool, um Aktivitäten zu finden — immer wenn nach einem Typ ("Wanderungen", "Läufe"), Namen, Jahr/Zeitraum oder Bestwert gefragt wird.
- list_activities: NUR die 200 neuesten Aktivitäten. Ausschliesslich für "was habe ich zuletzt / diesen Monat gemacht". Niemals nutzen, um zu entscheiden, ob eine bestimmte oder ältere Aktivität existiert.
- get_activity: Detailabruf einer einzelnen Aktivität über ihre UUID (z.B. wenn Notizen relevant sind).

Regeln:
1. Rufe mindestens ein Tool auf, bevor du konkrete Zahlen oder Namen nennst. Rate NIE.
2. Antworte knapp, freundlich und auf Deutsch. Nutze Schweizerdeutsch-nahes Hochdeutsch (ss statt ß).
3. Wenn du eine konkrete Aktivität erwähnst, hänge direkt nach dem Titel den Marker [activity:UUID] an. Der Client rendert daraus eine Karte. Beispiel: "Die längste Wanderung war *Lenzerheide-Runde* [activity:7f3c...-...]."
4. Bei Aggregaten (z.B. Summen, Durchschnitte) rechne selbst aus den Tool-Ergebnissen und benenne die Quellzeilen.
5. Sag erst "nichts gefunden", wenn search_activities (über ALLE Aktivitäten, ohne Datums-Default) wirklich leer zurückkommt. Schliesse NIE aus list_activities (nur die 200 neuesten), dass etwas nicht existiert.
6. Heute ist ${new Date().toISOString().slice(0, 10)}.
7. Bei Suche nach einem Aktivitätstyp ("Wanderungen", "Läufe", "Velotouren") IMMER search_activities mit gesetztem type nutzen und limit=100, damit auch alte Treffer erscheinen. Deutsch→type: Wanderung/wandern → HIKING; Spaziergang/Gehen → WALKING; Lauf/Joggen/Rennen → RUNNING; Velo/Rad/Bike → CYCLING; Schwimmen → SWIMMING. Gültige Typen ausschliesslich: RUNNING, CYCLING, HIKING, WALKING, SWIMMING.
8. dateFrom/dateTo nur setzen, wenn der User einen Zeitraum nennt (z.B. "2018" → dateFrom=2018-01-01, dateTo=2018-12-31). Ohne Zeitraum-Angabe KEINE Datums-Filter setzen, sonst werden alte Aktivitäten fälschlich ausgeschlossen.
9. Für "längste/kürzeste/schnellste" Aktivitäten: search_activities mit passendem orderBy/orderDir und limit=1.
10. Dauer-Suche ("über 7 Stunden", "länger als 90 Min", "unter 1h"): nutze minDurationMin/maxDurationMin (in Minuten, z.B. 7h → 420). Das filtert die GESAMTDAUER (inkl. Pausen) — genau das meinen User mit "X Stunden lang". In den Ergebnissen ist durationMin die Gesamtdauer, movingMin die reine Bewegungszeit; für "wie lang war …" zählt durationMin.

Sprache: Deutsch. Ton: sachlich, knapp, hilfsbereit.`;

export async function POST(req: NextRequest) {
  console.log("[/api/chat] POST received");
  const session = await auth();
  if (!session?.user?.id) {
    console.warn("[/api/chat] unauthorized");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  console.log("[/api/chat] userId:", session.user.id);

  const body = await req.json();
  const messages = body.messages;

  if (!Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: "messages array required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const openai = getAiSdkClient();

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: openai(DEFAULT_MODEL),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    tools: getSearchTools(session.user.id),
    stopWhen: stepCountIs(5),
    // Force a tool call on the first step so the model always queries the DB
    // instead of answering from memory ("findet nichts" obwohl es Treffer gibt).
    // Subsequent steps default to auto, so it can answer once it has results.
    prepareStep: ({ stepNumber }) =>
      stepNumber === 0 ? { toolChoice: "required" } : {},
    temperature: 0.3,
    onError: (e) => {
      console.error("[/api/chat] streamText error:", e);
    },
    onFinish: ({ text, finishReason, usage }) => {
      console.log("[/api/chat] finished:", { finishReason, textLen: text.length, usage });
    },
  });

  return result.toUIMessageStreamResponse({
    onError: (e) => {
      console.error("[/api/chat] stream response error:", e);
      return e instanceof Error ? e.message : "Unknown error";
    },
  });
}
