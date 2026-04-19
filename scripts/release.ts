#!/usr/bin/env tsx
/**
 * Release-Script: bumpt package.json, pflegt CHANGELOG.md, taggt.
 *
 * - Liest Conventional-Commits seit letztem Tag
 * - Ermittelt Bump (patch / minor / major)
 * - Gruppiert Commits nach Keep-a-Changelog-Kategorien
 * - Schreibt neue Section in CHANGELOG.md
 * - Erstellt Commit + annotated Tag
 *
 * Usage:
 *   npm run release            # auto-bump aus Commits
 *   npm run release -- --dry   # nur Report, nichts schreiben
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type BumpLevel = "patch" | "minor" | "major";

interface ParsedCommit {
  hash: string;
  type: string;
  scope: string | null;
  subject: string;
  breaking: boolean;
}

const ROOT = process.cwd();
const PKG_PATH = resolve(ROOT, "package.json");
const CHANGELOG_PATH = resolve(ROOT, "CHANGELOG.md");
const DRY_RUN = process.argv.includes("--dry");

function sh(cmd: string): string {
  return execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();
}

function lastTag(): string | null {
  try {
    return sh("git describe --tags --abbrev=0");
  } catch {
    return null;
  }
}

function commitsSince(tag: string | null): ParsedCommit[] {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const raw = sh(`git log ${range} --format=%H%x09%s%x09%b%x1e --no-merges`);
  if (!raw) return [];
  return raw
    .split("\x1e")
    .map((e) => e.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, subject, body = ""] = entry.split("\t");
      const match = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/.exec(subject);
      const breaking = /BREAKING CHANGE/i.test(body) || subject.includes("!:");
      if (!match) {
        return { hash, type: "chore", scope: null, subject, breaking };
      }
      return {
        hash,
        type: match[1],
        scope: match[2] ?? null,
        subject: match[4],
        breaking,
      };
    });
}

function bumpLevel(commits: ParsedCommit[]): BumpLevel | null {
  if (commits.length === 0) return null;
  if (commits.some((c) => c.breaking)) return "major";
  if (commits.some((c) => c.type === "feat")) return "minor";
  if (commits.some((c) => ["fix", "perf", "refactor"].includes(c.type))) return "patch";
  return null;
}

function bumpVersion(version: string, level: BumpLevel): string {
  const [maj, min, pat] = version.split(".").map(Number);
  if (level === "major") return `${maj + 1}.0.0`;
  if (level === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

function formatScope(c: ParsedCommit): string {
  const scope = c.scope ? `**${c.scope}:** ` : "";
  return `- ${scope}${c.subject}`;
}

function categorize(commits: ParsedCommit[]): Record<string, string[]> {
  const added: string[] = [];
  const fixed: string[] = [];
  const changed: string[] = [];
  const security: string[] = [];
  for (const c of commits) {
    const line = formatScope(c);
    if (c.type === "feat") added.push(line);
    else if (c.type === "fix" && c.scope === "security") security.push(line);
    else if (c.type === "fix") fixed.push(line);
    else if (["refactor", "perf", "style"].includes(c.type)) changed.push(line);
  }
  const out: Record<string, string[]> = {};
  if (added.length) out["Added"] = added;
  if (changed.length) out["Changed"] = changed;
  if (fixed.length) out["Fixed"] = fixed;
  if (security.length) out["Security"] = security;
  return out;
}

function renderSection(version: string, categories: Record<string, string[]>): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [`## [${version}] - ${today}`, ""];
  for (const [cat, items] of Object.entries(categories)) {
    lines.push(`### ${cat}`, "", ...items, "");
  }
  return lines.join("\n");
}

function prependToChangelog(section: string): void {
  const current = readFileSync(CHANGELOG_PATH, "utf8");
  const marker = /^##\s/m;
  const idx = current.search(marker);
  const next =
    idx >= 0
      ? current.slice(0, idx) + section + "\n" + current.slice(idx)
      : current.trimEnd() + "\n\n" + section + "\n";
  writeFileSync(CHANGELOG_PATH, next);
}

function updatePackageVersion(version: string): void {
  const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8")) as { version: string };
  pkg.version = version;
  writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n");
}

function assertCleanTree(): void {
  // Untracked Files sind OK — sie landen nicht im Tag.
  // Nur tracked Modifications / staged Changes blockieren.
  const tracked = sh("git status --porcelain --untracked-files=no");
  if (tracked) {
    console.error(
      "Working tree hat ungespeicherte Änderungen an tracked files. Commit oder stash zuerst.",
    );
    console.error(tracked);
    process.exit(1);
  }
}

function main(): void {
  if (!DRY_RUN) assertCleanTree();
  const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8")) as { version: string };
  const tag = lastTag();
  const commits = commitsSince(tag);
  const level = bumpLevel(commits);

  if (!level) {
    console.log(
      `Keine release-relevanten Commits seit ${tag ?? "Anfang"}. Nichts zu tun.`,
    );
    return;
  }

  const nextVersion = bumpVersion(pkg.version, level);
  const categories = categorize(commits);
  const section = renderSection(nextVersion, categories);

  console.log(`\nCurrent: ${pkg.version} → Next: ${nextVersion} (${level})\n`);
  console.log(`Seit ${tag ?? "Anfang"}: ${commits.length} Commits\n`);
  console.log(section);

  if (DRY_RUN) {
    console.log("\n[dry-run] Keine Änderungen geschrieben.");
    return;
  }

  updatePackageVersion(nextVersion);
  prependToChangelog(section);
  sh(`git add package.json CHANGELOG.md`);
  sh(`git commit -m "chore(release): v${nextVersion}"`);
  sh(`git tag -a v${nextVersion} -m "v${nextVersion}"`);
  console.log(`\nTag v${nextVersion} erstellt. Zum Deployen: git push && git push --tags`);
}

main();
