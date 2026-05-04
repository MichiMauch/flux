import { join } from "path";

export const GROUP_COVERS_PATH =
  process.env.GROUP_COVERS_PATH || "/data/group-covers";

export function getGroupCoverPath(groupId: string): string {
  return join(GROUP_COVERS_PATH, `${groupId}.webp`);
}

export function getGroupCoverUrl(groupId: string): string {
  return `/api/groups/${groupId}/cover`;
}
