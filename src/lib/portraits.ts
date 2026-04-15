import { join } from "path";

export const PORTRAITS_PATH = process.env.PORTRAITS_PATH || "./data/portraits";

export function getPortraitPath(userId: string): string {
  return join(PORTRAITS_PATH, `${userId}.webp`);
}
