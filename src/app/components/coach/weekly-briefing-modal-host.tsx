import { auth } from "@/auth";
import { WeeklyBriefingModal } from "./weekly-briefing-modal";

/**
 * Server-component gate: only mounts the client modal for authenticated
 * users. Unauthenticated pages (login) never ship the modal bundle.
 */
export async function WeeklyBriefingModalHost() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return <WeeklyBriefingModal />;
}
