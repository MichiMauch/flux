import { join } from "path";

export const PHOTOS_PATH = process.env.PHOTOS_PATH || "./data/photos";

export function getPhotoDir(userId: string, activityId: string): string {
  return join(PHOTOS_PATH, userId, activityId);
}

export function getPhotoFilename(photoId: string, ext: string): string {
  return `${photoId}.${ext}`;
}

export function getThumbnailFilename(photoId: string): string {
  return `${photoId}-thumb.jpg`;
}
