import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OFFICIAL_SOURCES } from "./official-sources";

function textFromHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function main(): Promise<void> {
  const rootDir = process.cwd();
  const cacheDir = join(rootDir, "data", "source-cache");
  mkdirSync(cacheDir, { recursive: true });

  for (const source of OFFICIAL_SOURCES) {
    const response = await fetch(source.url, {
      headers: {
        "user-agent": "wild-rift-advisor research cache",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${source.url}: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const cachedAt = new Date().toISOString();
    writeFileSync(join(cacheDir, `${source.id}.html`), html);
    writeFileSync(
      join(cacheDir, `${source.id}.txt`),
      [
        `title: ${source.title}`,
        `url: ${source.url}`,
        `cachedAt: ${cachedAt}`,
        "",
        textFromHtml(html),
      ].join("\n"),
    );
  }

  writeFileSync(
    join(cacheDir, "manifest.json"),
    JSON.stringify(
      {
        cachedAt: new Date().toISOString(),
        sources: OFFICIAL_SOURCES,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
