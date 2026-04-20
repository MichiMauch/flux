export interface ChangelogItem {
  text: string;
  hashes: string[];
}

export interface Category {
  name: string;
  items: ChangelogItem[];
}

export interface Release {
  version: string;
  date: string | null;
  categories: Category[];
}

const TRAILING_HASHES = /\s*\[([0-9a-f]{6,40}(?:\s*,\s*[0-9a-f]{6,40})*)\]\s*$/i;

function splitItem(raw: string): ChangelogItem {
  const match = TRAILING_HASHES.exec(raw);
  if (!match) return { text: raw, hashes: [] };
  return {
    text: raw.slice(0, match.index).trimEnd(),
    hashes: match[1].split(/\s*,\s*/).map((h) => h.toLowerCase()),
  };
}

/**
 * Parst eine CHANGELOG.md im Keep-a-Changelog-Format.
 * Erwartet Releases als `## [version] - date` und Kategorien als `### Name`.
 * Optionale `[hash]` am Zeilenende werden als Commit-Referenzen extrahiert.
 */
export function parseChangelog(raw: string): Release[] {
  const lines = raw.split("\n");
  const releases: Release[] = [];
  let currentRelease: Release | null = null;
  let currentCategory: Category | null = null;

  for (const line of lines) {
    const releaseMatch = /^##\s+\[([^\]]+)\](?:\s+-\s+(.+))?$/.exec(line);
    if (releaseMatch) {
      if (currentRelease) releases.push(currentRelease);
      currentRelease = {
        version: releaseMatch[1],
        date: releaseMatch[2]?.trim() ?? null,
        categories: [],
      };
      currentCategory = null;
      continue;
    }

    const categoryMatch = /^###\s+(.+)$/.exec(line);
    if (categoryMatch && currentRelease) {
      currentCategory = { name: categoryMatch[1].trim(), items: [] };
      currentRelease.categories.push(currentCategory);
      continue;
    }

    const itemMatch = /^-\s+(.+)$/.exec(line);
    if (itemMatch && currentCategory) {
      currentCategory.items.push(splitItem(itemMatch[1].trim()));
    }
  }

  if (currentRelease) releases.push(currentRelease);
  return releases;
}
