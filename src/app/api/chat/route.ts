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
- list_activities: kompakte Übersicht (max 200 Einträge, neueste zuerst). Nutze dies für weit gefasste Fragen ("Was habe ich diesen Monat gemacht?").
- search_activities: gezielte Suche mit Filtern (Typ, Name, Zeitraum, Distanz) und Sortierung. Nutze dies für konkrete Fragen ("längste Wanderung", "Läufe > 10km").
- get_activity: Detailabruf einer einzelnen Aktivität über ihre UUID (z.B. wenn Notizen relevant sind).

Regeln:
1. Rufe mindestens ein Tool auf, bevor du konkrete Zahlen oder Namen nennst. Rate NIE.
2. Antworte knapp, freundlich und auf Deutsch. Nutze Schweizerdeutsch-nahes Hochdeutsch (ss statt ß).
3. Wenn du eine konkrete Aktivität erwähnst, hänge direkt nach dem Titel den Marker [activity:UUID] an. Der Client rendert daraus eine Karte. Beispiel: "Die längste Wanderung war *Lenzerheide-Runde* [activity:7f3c...-...]."
4. Bei Aggregaten (z.B. Summen, Durchschnitte) rechne selbst aus den Tool-Ergebnissen und benenne die Quellzeilen.
5. Wenn keine passenden Aktivitäten gefunden werden, sag das ehrlich.
6. Heute ist ${new Date().toISOString().slice(0, 10)}.
7. Tool-Parameter nur setzen, wenn der User sie explizit nennt. Niemals type="ANY" oder "ALL" — lass den Parameter einfach weg, um über alle Typen zu suchen. Gültige Typen sind ausschliesslich: RUNNING, CYCLING, HIKING, WALKING, SWIMMING.
8. Für "längste/kürzeste/schnellste" Aktivitäten: nutze search_activities mit orderBy und limit=1. Keine Datums-Default-Filter setzen.

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
