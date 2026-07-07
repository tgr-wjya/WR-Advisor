import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { discoverChampions, scrapeChampionAbilities } from "./scrape-abilities";
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

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const targetIds = args.filter((arg) => arg !== "--force" && arg !== "-f");

  let championsToScrape: string[] = [];

  if (targetIds.length > 0) {
    championsToScrape = targetIds.map(id => id.trim().toLowerCase());
    console.log(`Targeting specific champions: ${championsToScrape.join(", ")}`);
  } else {
    console.log("Discovering all champions from official Wild Rift site...");
    try {
      championsToScrape = await discoverChampions();
      console.log(`Discovered ${championsToScrape.length} champions.`);
    } catch (error) {
      console.error("Failed to auto-discover champions, falling back to roster seeds:", error);
      // Fallback to seeds from official-sources and comfort roster
      championsToScrape = OFFICIAL_SOURCES.filter(s => s.kind === "champion").map(s => s.id.replace("champion-", ""));
    }
  }

  // Handle patch updates and other non-champion sources
  const nonChampionSources = OFFICIAL_SOURCES.filter(s => s.kind !== "champion");
  for (const source of nonChampionSources) {
    const cachedFilePath = join(cacheDir, `${source.id}.txt`);
    if (existsSync(cachedFilePath) && !force) {
      console.log(`[Skip] Non-champion source already cached: ${source.id}`);
      continue;
    }

    console.log(`Fetching non-champion source: ${source.title} (${source.url})`);
    try {
      const response = await fetch(source.url, {
        headers: { "user-agent": "wild-rift-advisor research cache" },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const html = await response.text();
      writeFileSync(join(cacheDir, `${source.id}.html`), html);
      writeFileSync(
        cachedFilePath,
        [
          `title: ${source.title}`,
          `url: ${source.url}`,
          `cachedAt: ${new Date().toISOString()}`,
          "",
          textFromHtml(html),
        ].join("\n"),
      );
      console.log(`[Success] Cached ${source.id}`);
    } catch (error) {
      console.error(`[Error] Failed to fetch non-champion source ${source.id}:`, error);
    }
  }

  // Scrape each champion
  for (let i = 0; i < championsToScrape.length; i++) {
    const championId = championsToScrape[i];
    const sourceId = `champion-${championId}`;
    const cachedFilePath = join(cacheDir, `${sourceId}.txt`);

    if (existsSync(cachedFilePath) && !force) {
      console.log(`[Skip] (${i + 1}/${championsToScrape.length}) ${championId} is already cached.`);
      continue;
    }

    console.log(`[Scrape] (${i + 1}/${championsToScrape.length}) Crawling abilities for ${championId}...`);
    try {
      const champ = await scrapeChampionAbilities(championId);
      const cachedAt = new Date().toISOString();

      const formattedText = [
        `title: ${champ.name} champion page`,
        `url: https://wildrift.leagueoflegends.com/en-us/champions/${championId}/`,
        `cachedAt: ${cachedAt}`,
        "",
        "ABILITIES",
        "",
        ...champ.abilities.flatMap(ability => [
          `Name: ${ability.title}`,
          `Slot: ${ability.subtitle}`,
          `Description: ${ability.description}`,
          ""
        ])
      ].join("\n");

      writeFileSync(cachedFilePath, formattedText);
      console.log(`[Success] Cached details for ${champ.name}`);

      // Polite rate limit delay to prevent block
      if (i < championsToScrape.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (error: any) {
      console.error(`[Error] Failed to crawl ${championId}:`, error.message || error);
    }
  }

  console.log("Caching process complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
