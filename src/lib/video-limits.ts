// Grenzen für Video-Uploads. Eigene Datei ohne Node-Importe, damit Client
// (Upload-Hook) und Server (ffmpeg-Bibliothek) dieselben Werte nutzen.

/** Grösse eines Upload-Stücks. Bleibt unter Nexts 10-MB-Grenze für Anfragen. */
export const VIDEO_CHUNK_BYTES = 8 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 600 * 1024 * 1024;
export const VIDEO_MAX_DURATION_SEC = 5 * 60;
/** Instagram und WhatsApp schneiden Stories nach 60 Sekunden ab. */
export const STORY_MAX_DURATION_SEC = 60;
