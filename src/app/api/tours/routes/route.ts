import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listTourRoutesForUser } from "@/app/tours/data";

/**
 * Alle sichtbaren Touren mit ihren vereinfachten Etappen-Linien. Wird erst
 * geladen, wenn die Karte auf /tours geöffnet wird — die Übersicht selbst
 * kommt ohne die Geometrie aus.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const routes = await listTourRoutesForUser(session.user.id);

  return NextResponse.json(
    { routes },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
