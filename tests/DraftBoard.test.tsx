import { describe, expect, test } from "bun:test";
import React from "react";
import ReactDOMServer from "react-dom/server";
import DraftBoard, {
  addAllyPickHelper,
  addEnemyPickHelper,
  addBanHelper,
  MAX_ALLIES,
  MAX_ENEMIES,
  MAX_BANS
} from "../src/components/DraftBoard";
import type { AdvisorData } from "../src/types";

const mockData: AdvisorData = {
  playerProfile: {
    role: "adc",
    champions: [
      {
        championId: "jinx",
        totalGames: 100,
        winRate: 55,
        averageKda: "3.5",
        comfortLevel: "High",
        notes: ""
      }
    ]
  },
  dossiers: [
    {
      id: "jinx",
      name: "Jinx",
      playerFit: {
        comfortLevel: "High",
        playstyleFit: "high",
        statisticalConfidence: "high",
        rosterNotes: ""
      },
      pickProfile: {
        identity: "immobile hypercarry",
        blindPickSafety: 40,
        lanePattern: "farm",
        scalingCurve: "late",
        damageProfile: "physical",
        mobility: "low",
        selfPeel: "poor",
        objectiveDps: "high"
      },
      supportSynergies: [],
      enemyThreatRules: [],
      teamNeedRules: [],
      execution: {
        lanePlan: "Play safe and scale.",
        teamfightPlan: "Stay in backline and reset.",
        defaultWarnings: []
      },
      patch: {
        reviewedPatch: "14.1",
        status: "stable",
        notes: ""
      }
    }
  ],
  championProfiles: [
    {
      id: "jinx",
      name: "Jinx",
      status: "approved" as const,
      roles: ["dragon"],
      tags: ["immobile", "scaling"],
      profile: {
        draftIdentity: "immobile hypercarry",
        synergyHooks: [],
        threatHooks: [],
        uncertainties: []
      },
      sources: []
    },
    {
      id: "lux",
      name: "Lux",
      status: "approved" as const,
      roles: ["support", "mid"],
      tags: ["poke"],
      profile: {
        draftIdentity: "mage support",
        synergyHooks: [],
        threatHooks: [],
        uncertainties: []
      },
      sources: []
    }
  ]
};

describe("DraftBoard component", () => {
  test("renders DraftBoard correctly with advisor data", () => {
    const html = ReactDOMServer.renderToString(<DraftBoard data={mockData} />);
    
    // Check key structural elements
    expect(html).toContain("Recommendations");
    expect(html).toContain("Allies");
    expect(html).toContain("Enemies");
    expect(html).toContain("Bans");
    expect(html).toContain("Pick Order");
    expect(html).toContain("Reset Draft");

    // Check that at least some champions are listed in the selection grid
    for (const dossier of mockData.dossiers) {
      const escapedName = dossier.name.replace("'", "&#x27;");
      expect(html).toContain(escapedName);
    }
  });

  test("enforces draft size constraints and helper logic", () => {
    // 1. Ally helper limits & duplicates
    let allies = addAllyPickHelper([], "ezreal");
    expect(allies).toHaveLength(1);
    expect(allies[0].role).toBe("support");

    // Add more to reach limit
    allies = addAllyPickHelper(allies, "lux"); // support, mid
    allies = addAllyPickHelper(allies, "vi"); // support, mid, jungle
    allies = addAllyPickHelper(allies, "garen"); // support, mid, jungle, top
    expect(allies).toHaveLength(MAX_ALLIES);

    // Try adding 5th ally
    const alliesWithFifth = addAllyPickHelper(allies, "jinx");
    expect(alliesWithFifth).toHaveLength(MAX_ALLIES);

    // Try adding duplicate ally
    const alliesWithDuplicate = addAllyPickHelper(allies, "ezreal");
    expect(alliesWithDuplicate).toHaveLength(MAX_ALLIES);

    // Dynamic role assignment on removal & re-add
    // Current roles: ezreal (support), lux (mid), vi (jungle), garen (top)
    // Remove "lux" (mid)
    const afterRemoval = allies.filter((a) => a.champion !== "lux");
    expect(afterRemoval).toHaveLength(3);
    expect(afterRemoval.map((a) => a.role)).not.toContain("mid");

    // Re-add a new champion, it should get the first unused role: "mid"
    const afterReAdd = addAllyPickHelper(afterRemoval, "brand");
    expect(afterReAdd).toHaveLength(4);
    const addedChamp = afterReAdd.find((a) => a.champion === "brand");
    expect(addedChamp?.role).toBe("mid");

    // 2. Enemy helper limits & duplicates
    let enemies = addEnemyPickHelper([], "caitlyn");
    expect(enemies).toHaveLength(1);
    expect(enemies[0].role).toBe("dragon");

    // Add up to MAX_ENEMIES (5)
    enemies = addEnemyPickHelper(enemies, "leona");
    enemies = addEnemyPickHelper(enemies, "ahri");
    enemies = addEnemyPickHelper(enemies, "lee_sin");
    enemies = addEnemyPickHelper(enemies, "darius");
    expect(enemies).toHaveLength(MAX_ENEMIES);

    // Try adding 6th enemy
    const enemiesWithSixth = addEnemyPickHelper(enemies, "ashe");
    expect(enemiesWithSixth).toHaveLength(MAX_ENEMIES);

    // Try adding duplicate enemy
    const enemiesWithDuplicate = addEnemyPickHelper(enemies, "caitlyn");
    expect(enemiesWithDuplicate).toHaveLength(MAX_ENEMIES);

    // Dynamic role assignment on enemy removal & re-add
    // Current enemies: caitlyn (dragon), leona (support), ahri (mid), lee_sin (jungle), darius (top)
    // Remove "ahri" (mid)
    const enemiesAfterRemoval = enemies.filter((e) => e.champion !== "ahri");
    expect(enemiesAfterRemoval).toHaveLength(4);
    expect(enemiesAfterRemoval.map((e) => e.role)).not.toContain("mid");

    // Re-add, it should get "mid"
    const enemiesAfterReAdd = addEnemyPickHelper(enemiesAfterRemoval, "zed");
    expect(enemiesAfterReAdd).toHaveLength(5);
    const addedEnemy = enemiesAfterReAdd.find((e) => e.champion === "zed");
    expect(addedEnemy?.role).toBe("mid");

    // 3. Ban helper limits & duplicates
    let bans: string[] = [];
    for (let i = 0; i < MAX_BANS; i++) {
      bans = addBanHelper(bans, `champ_${i}`);
    }
    expect(bans).toHaveLength(MAX_BANS);

    // Try adding 11th ban
    const bansWithEleventh = addBanHelper(bans, "extra_champ");
    expect(bansWithEleventh).toHaveLength(MAX_BANS);

    // Try adding duplicate ban
    const bansWithDuplicate = addBanHelper(bans, "champ_0");
    expect(bansWithDuplicate).toHaveLength(MAX_BANS);
  });
});

