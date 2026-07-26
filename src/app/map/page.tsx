import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BentoPageShell } from "../components/bento/bento-page-shell";
import { BentoPageHeader } from "../components/bento/bento-page-header";
import { MapView } from "./map-view";

export const metadata = {
  title: "Karte · Flux",
};

export default async function MapPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <BentoPageShell>
      <BentoPageHeader section="Karte" title="Karte" />
      <MapView />
    </BentoPageShell>
  );
}
