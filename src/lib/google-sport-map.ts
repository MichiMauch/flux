/**
 * Google-Health-Sportart auf einen flux-Aktivitätstyp abbilden.
 *
 * Bewusst als Heuristik gebaut und nicht als Tabelle: Von Googles
 * exerciseType-Enum ist bisher nur WALKING real beobachtet worden. Eine
 * ausgeschriebene Liste wäre geraten, und geratene Enum-Werte fallen erst
 * auf, wenn eine Aktivität als "Sonstiges" in der Liste steht.
 *
 * Unbekannte Werte landen deshalb auf OTHER und werden vom Aufrufer geloggt.
 * Sobald ein neuer Wert auftaucht, kann er hier ergänzt werden — dann mit
 * einem Beleg im Kommentar, so wie es polar-sport-map.ts hält.
 */

/** Bisher tatsächlich in einer Antwort gesehen. */
const CONFIRMED: Record<string, string> = {
  // 2026-09-05 und 2026-09-07, Pixel Watch 5, displayName "Gehen"
  WALKING: "WALKING",
};

export function normalizeGoogleType(
  exerciseType: string | null | undefined,
  displayName?: string | null
): { type: string; known: boolean } {
  const e = (exerciseType ?? "").toUpperCase().trim();
  if (!e) return { type: "OTHER", known: false };

  const confirmed = CONFIRMED[e];
  if (confirmed) return { type: confirmed, known: true };

  // Substring-Heuristik, gleiches Vorgehen wie normalizePolarType in
  // ai-title.ts. Deckt die naheliegenden Schreibweisen ab, ohne zu behaupten,
  // die Enum-Werte zu kennen.
  const haystack = `${e} ${(displayName ?? "").toUpperCase()}`;
  if (haystack.includes("TRAIL")) return { type: "TRAIL_RUNNING", known: false };
  if (haystack.includes("RUN") || haystack.includes("JOG"))
    return { type: "RUNNING", known: false };
  if (haystack.includes("HIK") || haystack.includes("TREK"))
    return { type: "HIKING", known: false };
  if (haystack.includes("WALK")) return { type: "WALKING", known: false };
  if (haystack.includes("BIK") || haystack.includes("CYCL") || haystack.includes("RIDE"))
    return { type: "CYCLING", known: false };
  if (haystack.includes("SWIM")) return { type: "SWIMMING", known: false };
  if (haystack.includes("YOGA")) return { type: "YOGA", known: false };
  if (haystack.includes("PILATES") || haystack.includes("CORE"))
    return { type: "CORE", known: false };
  if (haystack.includes("WEIGHT") || haystack.includes("STRENGTH"))
    return { type: "STRENGTH_TRAINING", known: false };
  if (haystack.includes("SKI")) return { type: "SKIING", known: false };

  return { type: "OTHER", known: false };
}
