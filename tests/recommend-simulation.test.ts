import { describe, it, expect } from "bun:test";
import { loadAdvisorData } from "../src/data";
import { recommendAdcs } from "../src/recommend";
import type { DraftInput, DraftChampion } from "../src/types";

function approveAllProfiles(data: ReturnType<typeof loadAdvisorData>) {
  return {
    ...data,
    championProfiles: data.championProfiles.map((p) => ({
      ...p,
      status: "approved" as const,
    })),
  };
}

function selectRandomElements<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

describe("Draft Recommendations & Randomized Comp Testing", () => {
  const rawData = loadAdvisorData();
  const testData = approveAllProfiles(rawData);
  const allSlugs = testData.championProfiles.map((p) => p.id);

  // List of dive/assassin threats from the database
  const diveThreats = [
    "zed",
    "talon",
    "akali",
    "fizz",
    "kassadin",
    "ekko",
    "diana",
    "darius",
    "jax",
    "riven",
    "camille",
    "tryndamere",
    "renekton",
    "olaf",
    "pantheon",
    "wukong",
  ];

  // List of enchanter supports
  const enchanters = [
    "lulu",
    "yuumi",
    "soraka",
    "janna",
    "nami",
    "karma",
    "sona",
    "seraphine",
  ];

  // List of pure engage/tank supports (no enchanter or peel tags)
  const engageSupports = [
    "leona",
    "nautilus",
    "alistar",
    "blitzcrank",
    "pyke",
    "thresh",
  ];

  it("should penalize immobile ADCs and favor mobile ADCs against dive threat comps", () => {
    const draft: DraftInput = {
      playerPickOrder: 5,
      allies: [{ champion: "nautilus", role: "support" }],
      enemies: [
        { champion: "zed", role: "mid" },
        { champion: "talon", role: "jungle" },
        { champion: "akali", role: "top" },
      ],
      unavailableChampionIds: ["nautilus", "zed", "talon", "akali"],
    };

    const result = recommendAdcs(testData, draft);
    
    // Immobile Jinx vs Mobile Zeri
    const zeriRec = result.candidates.find((c) => c.championId === "zeri");
    const jinxRec = result.candidates.find((c) => c.championId === "jinx");

    expect(zeriRec).toBeDefined();
    expect(jinxRec).toBeDefined();
    
    // Zeri must score higher than Jinx due to the dive threat penalty applied to Jinx (-12 vs -3)
    expect(zeriRec!.score).toBeGreaterThan(jinxRec!.score);
  });

  it("should favor Jinx with enchanter support synergies compared to engage supports", () => {
    const draftEnchanter: DraftInput = {
      playerPickOrder: 4,
      allies: [{ champion: "lulu", role: "support" }],
      enemies: [],
      unavailableChampionIds: ["lulu"],
    };

    const draftEngage: DraftInput = {
      playerPickOrder: 4,
      allies: [{ champion: "leona", role: "support" }],
      enemies: [],
      unavailableChampionIds: ["leona"],
    };

    const resultEnchanter = recommendAdcs(testData, draftEnchanter);
    const resultEngage = recommendAdcs(testData, draftEngage);
    
    const jinxEnchanter = resultEnchanter.candidates.find((c) => c.championId === "jinx")!;
    const jinxEngage = resultEngage.candidates.find((c) => c.championId === "jinx")!;

    // Jinx gets +14 supportSynergy +6 teamNeeds with Lulu, but only +3 supportSynergy with Leona
    expect(jinxEnchanter.score).toBeGreaterThan(jinxEngage.score);
  });

  it("should pass 100 randomized drafts and satisfy math/sorting/uniqueness invariants", () => {
    for (let run = 0; run < 100; run++) {
      const shuffled = [...allSlugs].sort(() => Math.random() - 0.5);
      
      const alliesCount = Math.floor(Math.random() * 4) + 1; // 1 to 4 allies
      const enemiesCount = Math.floor(Math.random() * 5) + 1; // 1 to 5 enemies
      
      let ptr = 0;
      const allies: DraftChampion[] = Array.from({ length: alliesCount }, (_, i) => ({
        champion: shuffled[ptr++],
        role: (["support", "mid", "jungle", "top"] as const)[i % 4],
      }));

      const enemies: DraftChampion[] = Array.from({ length: enemiesCount }, (_, i) => ({
        champion: shuffled[ptr++],
        role: (["dragon", "support", "mid", "jungle", "top"] as const)[i % 5],
      }));

      const bannedCount = Math.floor(Math.random() * 5);
      const bans = Array.from({ length: bannedCount }, () => shuffled[ptr++]);

      const unavailable = new Set([
        ...bans,
        ...allies.map((a) => a.champion),
        ...enemies.map((e) => e.champion),
      ]);

      const draft: DraftInput = {
        playerPickOrder: Math.floor(Math.random() * 5) + 1,
        allies,
        enemies,
        unavailableChampionIds: Array.from(unavailable),
      };

      const result = recommendAdcs(testData, draft);

      // Invariant 1: Sorting order
      for (let i = 0; i < result.candidates.length - 1; i++) {
        expect(result.candidates[i].score).toBeGreaterThanOrEqual(result.candidates[i + 1].score);
      }

      // Invariant 2: Math breakdown sum
      for (const rec of result.candidates) {
        const sum = Object.values(rec.scoreBreakdown).reduce((a, b) => a + b, 0);
        expect(rec.score).toEqual(sum);
      }

      // Invariant 3: Uniqueness / Bans exclusions
      for (const rec of result.recommendations) {
        expect(unavailable.has(rec.championId)).toBe(false);
      }
    }
  });

  it("should statistically favor mobile carries over immobile carries against random dive comps", () => {
    let zeriTotalScore = 0;
    let jinxTotalScore = 0;
    const runs = 50;

    for (let i = 0; i < runs; i++) {
      const enemies = selectRandomElements(diveThreats, 3).map((champion) => ({
        champion,
        role: "jungle" as const,
      }));

      const draft: DraftInput = {
        playerPickOrder: 5,
        allies: [],
        enemies,
        unavailableChampionIds: enemies.map((e) => e.champion),
      };

      const result = recommendAdcs(testData, draft);
      const zeriRec = result.candidates.find((c) => c.championId === "zeri")!;
      const jinxRec = result.candidates.find((c) => c.championId === "jinx")!;

      zeriTotalScore += zeriRec.score;
      jinxTotalScore += jinxRec.score;
    }

    const zeriAvg = zeriTotalScore / runs;
    const jinxAvg = jinxTotalScore / runs;

    console.log(`\nStatistical Dive Test (${runs} runs):`);
    console.log(`  Zeri Average Score: ${zeriAvg.toFixed(2)}`);
    console.log(`  Jinx Average Score: ${jinxAvg.toFixed(2)}`);

    expect(zeriAvg).toBeGreaterThan(jinxAvg);
  });

  it("should statistically favor enchanter supports for Jinx compared to engage supports", () => {
    let jinxEnchanterScore = 0;
    let jinxEngageScore = 0;
    const runs = 50;

    for (let i = 0; i < runs; i++) {
      const enchanter = selectRandomElements(enchanters, 1)[0];
      const engage = selectRandomElements(engageSupports, 1)[0];

      const draftEnchanter: DraftInput = {
        playerPickOrder: 4,
        allies: [{ champion: enchanter, role: "support" as const }],
        enemies: [],
        unavailableChampionIds: [enchanter],
      };

      const draftEngage: DraftInput = {
        playerPickOrder: 4,
        allies: [{ champion: engage, role: "support" as const }],
        enemies: [],
        unavailableChampionIds: [engage],
      };

      const resultEnchanter = recommendAdcs(testData, draftEnchanter);
      const resultEngage = recommendAdcs(testData, draftEngage);

      jinxEnchanterScore += resultEnchanter.candidates.find((c) => c.championId === "jinx")!.score;
      jinxEngageScore += resultEngage.candidates.find((c) => c.championId === "jinx")!.score;
    }

    const enchanterAvg = jinxEnchanterScore / runs;
    const engageAvg = jinxEngageScore / runs;

    console.log(`\nStatistical Support Test (${runs} runs):`);
    console.log(`  Jinx with Enchanters Average Score: ${enchanterAvg.toFixed(2)}`);
    console.log(`  Jinx with Engage Average Score:     ${engageAvg.toFixed(2)}`);

    expect(enchanterAvg).toBeGreaterThan(engageAvg);
  });
});
