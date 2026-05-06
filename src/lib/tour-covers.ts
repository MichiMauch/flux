import { join } from "path";

export const TOUR_COVERS_PATH =
  process.env.TOUR_COVERS_PATH ||
  process.env.GROUP_COVERS_PATH ||
  "/data/group-covers";

export function getTourCoverPath(tourId: string): string {
  return join(TOUR_COVERS_PATH, `${tourId}.webp`);
}

export function getTourCoverUrl(tourId: string): string {
  return `/api/tours/${tourId}/cover`;
}
