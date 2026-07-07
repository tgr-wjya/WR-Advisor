import { loadAdvisorData } from "../data";
import { recommendAdcs } from "../recommend";
import type { DraftInput, DraftChampion } from "../types";

function approveAllProfiles(data: ReturnType<typeof loadAdvisorData>) {
  return {
    ...data,
    championProfiles: data.championProfiles.map((p) => ({
      ...p,
      status: "approved" as const,
    })),
  };
}

function runAndPrintScenario(name: string, draft: DraftInput, data: ReturnType<typeof loadAdvisorData>) {
  const result = recommendAdcs(data, draft);
  console.log(`\n========================================`);
  console.log(`Scenario: ${name}`);
  console.log(`========================================`);
  console.log(`Allies:  ${draft.allies.map((c) => `${c.champion} (${c.role})`).join(", ") || "None"}`);
  console.log(`Enemies: ${draft.enemies.map((c) => `${c.champion} (${c.role})`).join(", ") || "None"}`);
  console.log(`Bans/Unavailable: ${draft.unavailableChampionIds.join(", ") || "None"}`);
  console.log(`\nTop Recommendations:`);

  result.recommendations.forEach((rec, idx) => {
    console.log(`\n${idx + 1}. ${rec.championName} (Score: ${rec.score})`);
    console.log(`   Breakdown: PlayerFit=${rec.scoreBreakdown.playerFit}, BlindSafety=${rec.scoreBreakdown.blindPickSafety}, SupportSynergy=${rec.scoreBreakdown.supportSynergy}, EnemyThreats=${rec.scoreBreakdown.enemyThreats}, TeamNeeds=${rec.scoreBreakdown.teamNeeds}, Patch=${rec.scoreBreakdown.patch}`);
    console.log(`   Reasons:`);
    rec.reasons.forEach((r) => console.log(`     - ${r}`));
    if (rec.warnings.length > 0) {
      console.log(`   Warnings:`);
      rec.warnings.forEach((w) => console.log(`     * ${w}`));
    }
  });
}

function generateRandomDraft(allSlugs: string[]): DraftInput {
  const shuffled = [...allSlugs].sort(() => Math.random() - 0.5);
  
  // Pick random count of allies (0 to 4) and enemies (0 to 5)
  const allyCount = Math.floor(Math.random() * 5);
  const enemyCount = Math.floor(Math.random() * 6);

  const allyRoles: Array<"support" | "mid" | "jungle" | "top"> = ["support", "mid", "jungle", "top"];
  const enemyRoles: Array<"dragon" | "support" | "mid" | "jungle" | "top"> = ["dragon", "support", "mid", "jungle", "top"];

  let ptr = 0;
  const allies: DraftChampion[] = [];
  const enemies: DraftChampion[] = [];

  for (let i = 0; i < allyCount; i++) {
    allies.push({
      champion: shuffled[ptr++],
      role: allyRoles[i],
    });
  }

  for (let i = 0; i < enemyCount; i++) {
    enemies.push({
      champion: shuffled[ptr++],
      role: enemyRoles[i],
    });
  }

  const bannedCount = Math.floor(Math.random() * 10);
  const unavailableChampionIds: string[] = [];
  for (let i = 0; i < bannedCount; i++) {
    unavailableChampionIds.push(shuffled[ptr++]);
  }

  // Include picks in unavailable to prevent drafting already-picked ones
  allies.forEach((a) => unavailableChampionIds.push(a.champion));
  enemies.forEach((e) => unavailableChampionIds.push(e.champion));

  return {
    playerPickOrder: Math.floor(Math.random() * 5) + 1,
    allies,
    enemies,
    unavailableChampionIds,
  };
}

async function main() {
  const rawData = loadAdvisorData();
  const testData = approveAllProfiles(rawData);
  const allSlugs = testData.championProfiles.map((p) => p.id);

  const args = process.argv.slice(2);
  if (args.includes("--random")) {
    const draft = generateRandomDraft(allSlugs);
    runAndPrintScenario("Randomized Draft Simulation", draft, testData);
    return;
  }

  // Run defined test scenarios
  
  // Scenario 1: Protect the Carry (High Peel/Enchanter)
  const scenarioPeel: DraftInput = {
    playerPickOrder: 4,
    allies: [
      { champion: "lulu", role: "support" },
      { champion: "maokai", role: "jungle" },
      { champion: "shen", role: "top" },
    ],
    enemies: [
      { champion: "garen", role: "top" },
      { champion: "ezreal", role: "dragon" },
    ],
    unavailableChampionIds: ["lulu", "maokai", "shen", "garen", "ezreal", "yuumi", "soraka"],
  };
  runAndPrintScenario("Protect the Carry (High Peel Ally Comp)", scenarioPeel, testData);

  // Scenario 2: Anti-Dive (Enemy Assassin threats)
  const scenarioDive: DraftInput = {
    playerPickOrder: 5,
    allies: [
      { champion: "nautilus", role: "support" },
    ],
    enemies: [
      { champion: "zed", role: "mid" },
      { champion: "talon", role: "jungle" },
      { champion: "akali", role: "top" },
    ],
    unavailableChampionIds: ["nautilus", "zed", "talon", "akali"],
  };
  runAndPrintScenario("Anti-Dive (Enemy Zed, Talon, Akali Threats)", scenarioDive, testData);

  // Scenario 3: Engage Synergy (Ally Wombo Combo)
  const scenarioEngage: DraftInput = {
    playerPickOrder: 3,
    allies: [
      { champion: "leona", role: "support" },
      { champion: "vi", role: "jungle" },
      { champion: "yasuo", role: "mid" },
    ],
    enemies: [
      { champion: "janna", role: "support" },
      { champion: "lux", role: "mid" },
    ],
    unavailableChampionIds: ["leona", "vi", "yasuo", "janna", "lux"],
  };
  runAndPrintScenario("Engage & Lane Pressure (Ally Leona, Vi, Yasuo)", scenarioEngage, testData);
}

main().catch((err) => {
  console.error("Error running simulation:", err);
  process.exit(1);
});
