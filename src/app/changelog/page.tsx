import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseChangelog,
  type ChangelogItem,
  type Release,
} from "./parse-changelog";

const REPO_URL = "https://github.com/MichiMauch/flux";

export const metadata = {
  title: "Changelog — Flux",
};

export default function ChangelogPage() {
  const raw = readFileSync(resolve(process.cwd(), "CHANGELOG.md"), "utf8");
  const releases = parseChangelog(raw);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <header className="mb-8 border-b border-border pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Flux · Releases
        </p>
        <h1 className="text-4xl font-bold tracking-tight">Changelog</h1>
        <p className="mt-2 text-muted-foreground">
          Alle nennenswerten Änderungen, sortiert nach Version.
        </p>
      </header>

      <div className="space-y-10">
        {releases.map((r) => (
          <ReleaseBlock key={r.version} release={r} />
        ))}
      </div>
    </div>
  );
}

function ReleaseBlock({ release }: { release: Release }) {
  return (
    <section>
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="font-mono text-xl font-bold tracking-tight">
          v{release.version}
        </h2>
        {release.date && (
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {release.date}
          </span>
        )}
      </div>
      {release.categories.map((cat) => (
        <div key={cat.name} className="mb-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">
            {cat.name}
          </h3>
          <ul className="space-y-1.5">
            {cat.items.map((item, i) => (
              <Item key={i} item={item} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function Item({ item }: { item: ChangelogItem }) {
  return (
    <li className="text-sm leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
      <span dangerouslySetInnerHTML={{ __html: renderMarkdownInline(item.text) }} />
      {item.hashes.length > 0 && (
        <span className="ml-2 inline-flex flex-wrap items-baseline gap-1.5 align-baseline">
          {item.hashes.map((hash) => (
            <a
              key={hash}
              href={`${REPO_URL}/commit/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/70 hover:text-brand"
            >
              {hash.slice(0, 7)}
            </a>
          ))}
        </span>
      )}
    </li>
  );
}

function renderMarkdownInline(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code class="font-mono text-[0.85em]">$1</code>');
}
