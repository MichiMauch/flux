import { notFound } from "next/navigation";
import { StyleguideView } from "./styleguide-view";

export const metadata = {
  title: "Styleguide — Flux",
  robots: { index: false, follow: false },
};

export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <StyleguideView />;
}
