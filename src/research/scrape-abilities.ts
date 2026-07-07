import puppeteer from "puppeteer";

export interface ScrapedAbility {
  title: string;
  subtitle: string;
  description: string;
}

export interface ScrapedChampion {
  id: string;
  name: string;
  abilities: ScrapedAbility[];
}

export async function scrapeChampionAbilities(championId: string): Promise<ScrapedChampion> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    const url = `https://wildrift.leagueoflegends.com/en-us/champions/${championId}/`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Try to close cookie/consent banner if it overlays
    try {
      await page.evaluate(() => {
        const closeBtn = Array.from(document.querySelectorAll("button")).find(btn =>
          btn.textContent?.includes("Close this dialog") ||
          btn.getAttribute("aria-label")?.includes("Close") ||
          btn.id === "onetrust-reject-all-handler" ||
          btn.id === "onetrust-accept-btn-handler"
        );
        if (closeBtn) {
          (closeBtn as HTMLButtonElement).click();
        }
      });
      await new Promise(r => setTimeout(r, 500));
    } catch {
      // Ignore errors closing the overlay
    }

    // Get name of the champion from the header h1
    const name = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      return h1 ? h1.textContent?.trim() || "" : "";
    });

    const tabsCount = await page.evaluate(() => {
      return document.querySelectorAll(".icon-tab-tab").length;
    });

    if (tabsCount === 0) {
      throw new Error(`No ability tabs found for champion ${championId}. The page layout might have changed or failed to load.`);
    }

    const abilities: ScrapedAbility[] = [];

    for (let i = 0; i < tabsCount; i++) {
      // Click the tab
      await page.evaluate((index) => {
        const tabs = document.querySelectorAll(".icon-tab-tab");
        const tab = tabs[index] as HTMLElement;
        if (tab) tab.click();
      }, i);

      // Wait 300ms for description updates
      await new Promise(r => setTimeout(r, 300));

      const ability = await page.evaluate(() => {
        const titleEl = document.querySelector(".icon-tab-media-title");
        const subtitleEl = document.querySelector(".icon-tab-media-subtitle");
        const descEl = document.querySelector(".icon-tab-media-description");

        return {
          title: titleEl ? titleEl.textContent?.trim() || "" : "",
          subtitle: subtitleEl ? subtitleEl.textContent?.trim() || "" : "",
          description: descEl ? descEl.textContent?.trim() || "" : "",
        };
      });

      abilities.push(ability);
    }

    return {
      id: championId,
      name: name || championId,
      abilities,
    };
  } finally {
    await browser.close();
  }
}

export async function discoverChampions(): Promise<string[]> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto("https://wildrift.leagueoflegends.com/en-us/champions/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    const slugs = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a")).map((a) => a.href);
      const prefix = "https://wildrift.leagueoflegends.com/en-us/champions/";
      
      const set = new Set<string>();
      for (const href of links) {
        if (href.startsWith(prefix) && href !== prefix) {
          // Remove prefix and trailing slashes to get slug
          const slug = href.replace(prefix, "").replace(/\//g, "").trim().toLowerCase();
          if (slug) {
            set.add(slug);
          }
        }
      }
      return Array.from(set);
    });

    return slugs.sort();
  } finally {
    await browser.close();
  }
}
