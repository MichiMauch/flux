export interface Category {
  name: string;
  items: string[];
}

export interface Release {
  version: string;
  date: string | null;
  categories: Category[];
}

/**
 * Parst eine CHANGELOG.md im Keep-a-Changelog-Format.
 * Erwartet Releases als `## [version] - date` und Kategorien als `### Name`.
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
      currentCategory.items.push(itemMatch[1].trim());
    }
  }

  if (currentRelease) releases.push(currentRelease);
  return releases;
}
