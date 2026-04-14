/**
 * POST /api/chat — streaming chat endpoint for the natural-language search.
 *
 * Uses Vercel AI SDK v6 streamText with OpenAI gpt-4o-mini and up to 5 tool
 * steps. All tools are scoped to the authenticated user's ID.
 */

import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getSearchTools } from "@/lib/search-tools";

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

Sprache: Deutsch. Ton: sachlich, knapp, hilfsbereit.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const messages = body.messages;

  if (!Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: "messages array required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    tools: getSearchTools(session.user.id),
    stopWhen: stepCountIs(5),
    temperature: 0.3,
  });

  return result.toUIMessageStreamResponse();
}
